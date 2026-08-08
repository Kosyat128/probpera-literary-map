import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { build } from "esbuild";
import {
  dedupeOpenLibraryCandidates,
  evaluateOpenLibraryCandidate,
  normalizeBookTitle,
  normalizeOpenLibraryId,
} from "./lib/book-import-policy.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const generatedDirectory = path.join(projectRoot, "src", "data", "countries", "generated");
const cacheDirectory = path.join(scriptDirectory, ".cache", "openlibrary-books");
const publishedOutputPath = path.join(generatedDirectory, "books.generated.json");
const stagingOutputPath = path.join(
  generatedDirectory,
  "books.candidates.json"
);
const qidsPath = path.join(generatedDirectory, "curatedWriterQids.generated.json");
const archiveBundlePath = path.join(cacheDirectory, "book-import-source.mjs");
const targetArgument = process.argv.find((value) => value.startsWith("--target="));
const maxAuthorsArgument = process.argv.find((value) => value.startsWith("--max-authors="));
const candidateLimit = Number(targetArgument?.split("=")[1] || 10_000);
const maxAuthors = Number(maxAuthorsArgument?.split("=")[1] || Infinity);
const applyChanges = process.argv.includes("--apply");
const concurrency = 6;

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

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
    const cached = JSON.parse(await readFile(cachePath, "utf8"));
    if (
      Array.isArray(cached) &&
      cached.every((work) => Array.isArray(work.authorKeys))
    ) {
      return cached;
    }
  } catch {
    // First request for this author.
  }

  const params = new URLSearchParams({
    author_key: author.openLibraryId,
    fields:
      "key,title,author_key,author_name,first_publish_year,edition_count,ratings_count,language,type,subject",
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
        authorKeys: work.author_key || [],
        authorNames: work.author_name || [],
        firstPublished: Number(work.first_publish_year) || undefined,
        editionCount: Number(work.edition_count) || 0,
        ratingsCount: Number(work.ratings_count) || 0,
        languages: work.language || [],
        type: work.type || "",
        subjects: work.subject || [],
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
  readFile(publishedOutputPath, "utf8").then(JSON.parse),
]);
const writerProfileByKey = new Map(
  archiveBooks.map((book) => [
    `${book.countryId}:${book.writerId}`,
    book.writer || {},
  ])
);
const profileYear = (profile, field, fallbackField, preferLast = false) => {
  const value = `${profile?.[field] || ""} ${profile?.[fallbackField] || ""} ${
    profile?.years || ""
  }`;
  const matches = [...value.matchAll(/\b(\d{3,4})\b/gu)];
  const match = preferLast ? matches.at(-1) : matches[0];
  return Number(match?.[1]) || undefined;
};
const mappings = Object.entries(qidPayload.writers || {})
  .map(([key, value]) => ({ key, qid: value.wikidataId }))
  .filter((entry) => /^Q\d+$/u.test(entry.qid))
  .map((entry) => {
    const profile = writerProfileByKey.get(entry.key);
    return {
      ...entry,
      birthYear: profileYear(profile, "birthDate", "birth"),
      deathYear: profileYear(profile, "deathDate", "death", true),
    };
  })
  .slice(0, maxAuthors);
const linkedAuthors = await resolveOpenLibraryAuthors(mappings);
const linkedAuthorByKey = new Map(
  linkedAuthors.map((author) => [author.key, author])
);

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

const previousGeneratedKeys = new Set(
  Object.entries(previousPayload.works || {}).flatMap(([writerKey, works]) =>
    works.map((work) => `${writerKey}:${work.id}`)
  )
);
const existingByWriter = new Map();
const existingExternalIds = new Set();
for (const book of archiveBooks) {
  const key = `${book.countryId}:${book.writerId}`;
  for (const externalId of book.externalIds || []) {
    if (externalId.scheme === "openlibrary") {
      existingExternalIds.add(normalizeOpenLibraryId(externalId.value));
    }
  }
  const sourceExternalId = normalizeOpenLibraryId(book.sourceUrl || book.id);
  if (/^OL\d+W$/u.test(sourceExternalId)) {
    existingExternalIds.add(sourceExternalId);
  }
  if (previousGeneratedKeys.has(`${key}:${book.id}`)) continue;
  if (!existingByWriter.has(key)) existingByWriter.set(key, new Set());
  existingByWriter.get(key).add(normalizeBookTitle(book.title));
}

const evaluated = candidates.map((candidate) => {
  const author = linkedAuthorByKey.get(candidate.writerKey) || {};
  const quality = evaluateOpenLibraryCandidate(candidate, author);
  return {
    ...candidate,
    provider: "openlibrary",
    externalId: quality.externalId,
    qualityScore: quality.score,
    rejectionReasons: quality.reasons,
    sourceUrl: quality.externalId
      ? `https://openlibrary.org/works/${quality.externalId}`
      : "",
  };
});
const policyRejected = evaluated.filter(
  (candidate) => candidate.rejectionReasons.length > 0
);
const policyAccepted = evaluated.filter(
  (candidate) => candidate.rejectionReasons.length === 0
);
const globallyDeduped = dedupeOpenLibraryCandidates(policyAccepted);
const bestByWriterTitle = new Map();
const duplicateTitles = [];
for (const candidate of [...globallyDeduped.accepted].sort(
  (first, second) => second.qualityScore - first.qualityScore
)) {
  const key = `${candidate.writerKey}:${normalizeBookTitle(candidate.title)}`;
  if (bestByWriterTitle.has(key)) {
    duplicateTitles.push({
      ...candidate,
      rejectionReasons: ["duplicate-normalized-title-for-writer"],
    });
  } else {
    bestByWriterTitle.set(key, candidate);
  }
}
const globallyUnique = [...bestByWriterTitle.values()]
  .filter((candidate) => !existingExternalIds.has(candidate.externalId))
  .filter(
    (candidate) =>
      !existingByWriter
        .get(candidate.writerKey)
        ?.has(normalizeBookTitle(candidate.title))
  );
const alreadyExisting = [...bestByWriterTitle.values()]
  .filter(
    (candidate) =>
      existingExternalIds.has(candidate.externalId) ||
      existingByWriter
        .get(candidate.writerKey)
        ?.has(normalizeBookTitle(candidate.title))
  )
  .map((candidate) => ({
    ...candidate,
    rejectionReasons: ["already-exists-in-curated-archive"],
  }));

globallyUnique.sort(
  (first, second) =>
    second.qualityScore - first.qualityScore ||
    second.ratingsCount - first.ratingsCount ||
    second.editionCount - first.editionCount ||
    first.title.localeCompare(second.title, "ru")
);
const accepted = globallyUnique.slice(0, Math.max(0, candidateLimit));
const rejected = [
  ...policyRejected,
  ...globallyDeduped.rejected,
  ...duplicateTitles,
  ...alreadyExisting,
].map((candidate) => ({
  writerKey: candidate.writerKey,
  externalId: candidate.externalId,
  title: candidate.title,
  sourceUrl: candidate.sourceUrl,
  rejectionReasons: [...new Set(candidate.rejectionReasons || [])],
}));

const output = {
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  publicationPolicy:
    "Staging only. Promotion requires reviewed RU/EN descriptions and field-level provenance.",
  source: {
    provider: "Open Library",
    url: "https://openlibrary.org/developers/api",
    licenseUrl: "https://openlibrary.org/developers/licensing",
    usage: "candidate-discovery-only",
  },
  candidates: accepted.map((candidate) => ({
    writerKey: candidate.writerKey,
    externalId: candidate.externalId,
    title: candidate.title,
    firstPublished: candidate.firstPublished,
    languages: candidate.languages,
    editionCount: candidate.editionCount,
    ratingsCount: candidate.ratingsCount,
    qualityScore: candidate.qualityScore,
    sourceUrl: candidate.sourceUrl,
    editorialStatus: "draft",
  })),
  rejected,
};
const summary = {
  publicationFileUntouched: path.relative(projectRoot, publishedOutputPath),
  stagingFile: path.relative(projectRoot, stagingOutputPath),
  candidateLimit,
  mappedAuthors: mappings.length,
  openLibraryAuthors: linkedAuthors.length,
  fetchedCandidates: candidates.length,
  policyRejected: policyRejected.length,
  globalExternalIdCollisions: globallyDeduped.rejected.length,
  duplicateWriterTitles: duplicateTitles.length,
  alreadyCurated: alreadyExisting.length,
  stagedCandidates: accepted.length,
  applyChanges,
};
console.log(JSON.stringify(summary, null, 2));
if (applyChanges) {
  await writeFile(
    stagingOutputPath,
    `${JSON.stringify(output, null, 2)}\n`,
    "utf8"
  );
  console.log(`Сохранён staging: ${path.relative(projectRoot, stagingOutputPath)}`);
} else {
  console.log("Проверочный режим: файл не изменён. Для записи добавьте --apply.");
}
