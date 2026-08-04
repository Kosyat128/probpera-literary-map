import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { build } from "esbuild";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const generatedDirectory = path.join(projectRoot, "src", "data", "countries", "generated");
const cacheDirectory = path.join(scriptDirectory, ".cache", "openlibrary-books");
const outputPath = path.join(generatedDirectory, "books.generated.json");
const qidsPath = path.join(generatedDirectory, "curatedWriterQids.generated.json");
const archiveBundlePath = path.join(cacheDirectory, "book-import-source.mjs");
const targetArgument = process.argv.find((value) => value.startsWith("--target="));
const maxAuthorsArgument = process.argv.find((value) => value.startsWith("--max-authors="));
const targetArchiveSize = Number(targetArgument?.split("=")[1] || 10_000);
const maxAuthors = Number(maxAuthorsArgument?.split("=")[1] || Infinity);
const applyChanges = process.argv.includes("--apply");
const concurrency = 6;

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function normalizeTitle(value = "") {
  return String(value)
    .normalize("NFKC")
    .toLocaleLowerCase("ru")
    .replace(/ё/gu, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

async function sourceArchive() {
  await mkdir(cacheDirectory, { recursive: true });
  await build({
    absWorkingDir: projectRoot,
    entryPoints: [path.join(projectRoot, "scripts", "archive-source.ts")],
    bundle: true,
    platform: "node",
    packages: "external",
    format: "esm",
    target: "node22",
    outfile: archiveBundlePath,
    logLevel: "silent",
  });
  return import(`${pathToFileURL(archiveBundlePath).href}?v=${Date.now()}`);
}

async function fetchJson(url, attempt = 1) {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "ProbPeraLiteraryMap/1.0 (probperasite@yandex.ru)",
      },
      signal: AbortSignal.timeout(22_000),
    });
    if (response.ok) return response.json();
    if (attempt >= 4) throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    if (attempt >= 4) throw error;
  }
  await sleep(attempt * 1600);
  return fetchJson(url, attempt + 1);
}

function claimString(entity, property) {
  return (entity.claims?.[property] || [])
    .filter((claim) => claim.rank !== "deprecated")
    .map((claim) => claim.mainsnak?.datavalue?.value)
    .find((value) => typeof value === "string") || "";
}

async function resolveOpenLibraryAuthors(mappings) {
  const cachePath = path.join(cacheDirectory, "author-links.json");
  let cached = {};
  try {
    cached = JSON.parse(await readFile(cachePath, "utf8"));
  } catch {
    // Cache will be created below.
  }

  const unresolved = mappings.filter((entry) => !Object.hasOwn(cached, entry.qid));
  for (let index = 0; index < unresolved.length; index += 50) {
    const batch = unresolved.slice(index, index + 50);
    const params = new URLSearchParams({
      action: "wbgetentities",
      ids: batch.map((entry) => entry.qid).join("|"),
      props: "claims",
      format: "json",
      origin: "*",
    });
    try {
      const payload = await fetchJson(`https://www.wikidata.org/w/api.php?${params.toString()}`);
      for (const entry of batch) {
        cached[entry.qid] = claimString(payload.entities?.[entry.qid] || {}, "P648");
      }
      await writeFile(cachePath, `${JSON.stringify(cached, null, 2)}\n`, "utf8");
    } catch (error) {
      console.warn(`Не удалось получить пакет авторов ${index + 1}: ${error.message}`);
    }
    await sleep(180);
  }

  return mappings
    .map((entry) => ({ ...entry, openLibraryId: cached[entry.qid] || "" }))
    .filter((entry) => /^OL\d+A$/u.test(entry.openLibraryId));
}

async function fetchAuthorWorks(author) {
  const cachePath = path.join(cacheDirectory, `${author.openLibraryId}.json`);
  try {
    return JSON.parse(await readFile(cachePath, "utf8"));
  } catch {
    // First request for this author.
  }

  const params = new URLSearchParams({
    author_key: author.openLibraryId,
    fields: "key,title,first_publish_year,edition_count,ratings_count,language",
    sort: "rating",
    limit: "40",
  });
  try {
    const payload = await fetchJson(`https://openlibrary.org/search.json?${params.toString()}`);
    const rows = (payload.docs || [])
      .filter((work) => work.key && work.title)
      .map((work) => ({
        writerKey: author.key,
        workKey: work.key,
        title: work.title,
        firstPublished: Number(work.first_publish_year) || undefined,
        editionCount: Number(work.edition_count) || 0,
        ratingsCount: Number(work.ratings_count) || 0,
      }));
    await writeFile(cachePath, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
    return rows;
  } catch (error) {
    console.warn(`Пропущен ${author.openLibraryId}: ${error.message}`);
    return [];
  }
}

async function mapConcurrent(items, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function next() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, next));
  return results;
}

await mkdir(generatedDirectory, { recursive: true });
await mkdir(cacheDirectory, { recursive: true });

const [{ archiveBooks }, qidPayload, previousPayload] = await Promise.all([
  sourceArchive(),
  readFile(qidsPath, "utf8").then(JSON.parse),
  readFile(outputPath, "utf8").then(JSON.parse),
]);
const mappings = Object.entries(qidPayload.writers || {})
  .map(([key, value]) => ({ key, qid: value.wikidataId }))
  .filter((entry) => /^Q\d+$/u.test(entry.qid))
  .slice(0, maxAuthors);
const linkedAuthors = await resolveOpenLibraryAuthors(mappings);

let completed = 0;
const candidateGroups = await mapConcurrent(linkedAuthors, async (author) => {
  const rows = await fetchAuthorWorks(author);
  completed += 1;
  if (completed % 25 === 0 || completed === linkedAuthors.length) {
    console.log(`Open Library: ${completed}/${linkedAuthors.length} авторов`);
  }
  await sleep(120);
  return rows;
});
const candidates = candidateGroups.flat();

const previousCount = Object.values(previousPayload.works || {}).reduce(
  (sum, works) => sum + works.length,
  0
);
const currentWithoutGenerated = Math.max(0, archiveBooks.length - previousCount);
const needed = Math.max(0, targetArchiveSize - currentWithoutGenerated);
const existingByWriter = new Map();
for (const book of archiveBooks) {
  const key = `${book.countryId}:${book.writerId}`;
  if (!existingByWriter.has(key)) existingByWriter.set(key, new Set());
  existingByWriter.get(key).add(normalizeTitle(book.title));
}

candidates.sort(
  (first, second) =>
    second.ratingsCount - first.ratingsCount ||
    second.editionCount - first.editionCount ||
    first.title.localeCompare(second.title, "ru")
);
const works = {};
const accepted = new Set();
for (const candidate of candidates) {
  if (accepted.size >= needed) break;
  const normalized = normalizeTitle(candidate.title);
  const identity = `${candidate.writerKey}:${normalized}`;
  if (!normalized || accepted.has(identity)) continue;
  if (existingByWriter.get(candidate.writerKey)?.has(normalized)) continue;
  const openLibraryKey = candidate.workKey.replace(/^\//u, "");
  const work = {
    id: `openlibrary-${openLibraryKey.toLocaleLowerCase("en").replace(/\//gu, "-")}`,
    title: candidate.title,
    ...(candidate.firstPublished && candidate.firstPublished <= new Date().getUTCFullYear()
      ? { firstPublished: candidate.firstPublished }
      : {}),
    genres: ["литературное произведение"],
    tags: ["Open Library", "редакционная очередь"],
    sourceUrl: `https://openlibrary.org/${openLibraryKey}`,
    editorial: { status: "draft" },
  };
  if (!works[candidate.writerKey]) works[candidate.writerKey] = [];
  works[candidate.writerKey].push(work);
  accepted.add(identity);
}

const output = {
  generatedAt: new Date().toISOString(),
  targetArchiveSize,
  source: "Wikidata author identity + Open Library works; editorial drafts",
  works,
};
const summary = {
  currentWithoutGenerated,
  requestedTarget: targetArchiveSize,
  mappedAuthors: mappings.length,
  openLibraryAuthors: linkedAuthors.length,
  candidates: candidates.length,
  acceptedDrafts: accepted.size,
  resultingArchiveSize: currentWithoutGenerated + accepted.size,
  applyChanges,
};
console.log(JSON.stringify(summary, null, 2));
if (applyChanges) {
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`Сохранено: ${path.relative(projectRoot, outputPath)}`);
} else {
  console.log("Проверочный режим: файл не изменён. Для записи добавьте --apply.");
}
if (summary.resultingArchiveSize < targetArchiveSize) process.exitCode = 2;
