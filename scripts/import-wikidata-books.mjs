import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { build } from "esbuild";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const generatedDirectory = path.join(
  projectRoot,
  "src",
  "data",
  "countries",
  "generated"
);
const cacheDirectory = path.join(scriptDirectory, ".cache", "wikidata-books");
const publishedOutputPath = path.join(generatedDirectory, "books.generated.json");
const stagingOutputPath = path.join(
  generatedDirectory,
  "books.wikidata.candidates.json"
);
const qidsPath = path.join(
  generatedDirectory,
  "curatedWriterQids.generated.json"
);
const archiveBundlePath = path.join(cacheDirectory, "book-import-source.mjs");
const targetArgument = process.argv.find((value) => value.startsWith("--target="));
const maxAuthorsArgument = process.argv.find((value) =>
  value.startsWith("--max-authors=")
);
const candidateLimit = Number(targetArgument?.split("=")[1] || 10_000);
const maxAuthors = Number(maxAuthorsArgument?.split("=")[1] || Infinity);
const applyChanges = process.argv.includes("--apply");
const batchSize = 24;

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

function normalizeTitle(value = "") {
  return String(value)
    .normalize("NFKC")
    .toLocaleLowerCase("ru")
    .replace(/ё/gu, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function yearFromClaim(entity) {
  const claims = entity.claims?.P577 || [];
  for (const claim of claims) {
    if (claim.rank === "deprecated") continue;
    const value = claim.mainsnak?.datavalue?.value?.time;
    const match = String(value || "").match(/^\+?(\d{1,4})-/u);
    if (!match) continue;
    const year = Number(match[1]);
    if (Number.isInteger(year) && year > 0 && year <= new Date().getUTCFullYear()) {
      return year;
    }
  }
  return undefined;
}

function entityIdFromClaim(entity, property) {
  return (entity.claims?.[property] || [])
    .filter((claim) => claim.rank !== "deprecated")
    .map((claim) => claim.mainsnak?.datavalue?.value?.id)
    .find(Boolean);
}

function originalTitle(entity) {
  const values = (entity.claims?.P1476 || [])
    .filter((claim) => claim.rank !== "deprecated")
    .map((claim) => claim.mainsnak?.datavalue?.value)
    .filter((value) => value?.text);
  return (
    values.find((value) => value.language !== "ru")?.text ||
    values[0]?.text ||
    entity.labels?.en?.value ||
    ""
  );
}

function looksLiterary(entity) {
  const description = [
    entity.descriptions?.ru?.value,
    entity.descriptions?.en?.value,
  ]
    .filter(Boolean)
    .join(" ");
  return /роман|книг|повест|рассказ|поэм|стих|пьес|драм|литератур|сборник|novel|book|novella|short stor|poem|poetry|play|drama|literary|story collection/iu.test(
    description
  );
}

function stableBatchName(qids) {
  return createHash("sha1").update(qids.join("|")).digest("hex").slice(0, 14);
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
      signal: AbortSignal.timeout(45_000),
    });
    if (response.ok) return response.json();
    if (attempt >= 6) throw new Error(`HTTP ${response.status}: ${url}`);
    const retryAfter = Number(response.headers.get("retry-after") || 0);
    await sleep(Math.max(retryAfter * 1000, attempt * 2200));
  } catch (error) {
    if (attempt >= 6) throw error;
    await sleep(attempt * 2500);
  }
  return fetchJson(url, attempt + 1);
}

async function fetchEntityLabels(qids) {
  const labels = new Map();
  for (let index = 0; index < qids.length; index += 50) {
    const batch = qids.slice(index, index + 50);
    const params = new URLSearchParams({
      action: "wbgetentities",
      ids: batch.join("|"),
      props: "labels",
      languages: "ru|en",
      languagefallback: "1",
      format: "json",
      origin: "*",
    });
    const payload = await fetchJson(
      `https://www.wikidata.org/w/api.php?${params.toString()}`
    );
    for (const entity of Object.values(payload.entities || {})) {
      labels.set(
        entity.id,
        entity.labels?.ru?.value || entity.labels?.en?.value || entity.id
      );
    }
    await sleep(120);
  }
  return labels;
}

async function fetchEntities(qids) {
  const entities = [];
  for (let index = 0; index < qids.length; index += 50) {
    const batch = qids.slice(index, index + 50);
    const params = new URLSearchParams({
      action: "wbgetentities",
      ids: batch.join("|"),
      props: "labels|descriptions|claims|sitelinks",
      languages: "ru|en",
      languagefallback: "1",
      format: "json",
      origin: "*",
    });
    const payload = await fetchJson(
      `https://www.wikidata.org/w/api.php?${params.toString()}`
    );
    entities.push(...Object.values(payload.entities || {}));
    await sleep(120);
  }
  return entities;
}

async function fetchAuthorBatch(authorQids) {
  const cachePath = path.join(cacheDirectory, `${stableBatchName(authorQids)}.json`);
  try {
    return JSON.parse(await readFile(cachePath, "utf8"));
  } catch {
    // A missing cache is expected on the first verified import.
  }

  const query = `
SELECT DISTINCT ?work ?author ?sitelinks WHERE {
  VALUES ?author { ${authorQids.map((qid) => `wd:${qid}`).join(" ")} }
  ?work wdt:P50 ?author;
        wikibase:sitelinks ?sitelinks.
  FILTER(?sitelinks >= 1)
}
ORDER BY DESC(?sitelinks)
LIMIT 1600
  `.trim();
  const payload = await fetchJson(
    `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`
  );
  const rows = (payload.results?.bindings || []).map((binding) => ({
    qid: binding.work?.value?.match(/\/(Q\d+)$/u)?.[1] || "",
    authorQid: binding.author?.value?.match(/\/(Q\d+)$/u)?.[1] || "",
    sitelinks: Number(binding.sitelinks?.value || 0),
  })).filter((row) => row.qid && row.authorQid);
  const entities = await fetchEntities([...new Set(rows.map((row) => row.qid))]);
  const entityById = new Map(entities.map((entity) => [entity.id, entity]));
  const languageIds = [...new Set(entities.map((entity) => entityIdFromClaim(entity, "P407")).filter(Boolean))];
  const languageLabels = await fetchEntityLabels(languageIds);

  const candidates = rows
    .map((row) => {
      const entity = entityById.get(row.qid);
      if (!entity || !looksLiterary(entity)) return null;
      const title = entity.labels?.ru?.value || entity.labels?.en?.value || "";
      if (!title) return null;
      const languageId = entityIdFromClaim(entity, "P407");
      return {
        ...row,
        title,
        originalTitle: originalTitle(entity),
        firstPublished: yearFromClaim(entity),
        originalLanguage: languageId ? languageLabels.get(languageId) || "" : "",
      };
    })
    .filter(Boolean);

  await writeFile(cachePath, `${JSON.stringify(candidates, null, 2)}\n`, "utf8");
  return candidates;
}

await mkdir(generatedDirectory, { recursive: true });
await mkdir(cacheDirectory, { recursive: true });

const [{ archiveBooks }, qidPayload, previousPayload] = await Promise.all([
  sourceArchive(),
  readFile(qidsPath, "utf8").then(JSON.parse),
  readFile(publishedOutputPath, "utf8").then(JSON.parse),
]);

const mappings = Object.entries(qidPayload.writers || {})
  .map(([key, value]) => ({ key, qid: value.wikidataId }))
  .filter((entry) => /^Q\d+$/u.test(entry.qid))
  .slice(0, maxAuthors);
const keyByQid = new Map(mappings.map((entry) => [entry.qid, entry.key]));
const previousGeneratedKeys = new Set(
  Object.entries(previousPayload.works || {}).flatMap(([writerKey, works]) =>
    works.map((work) => `${writerKey}:${work.id}`)
  )
);
const existingByWriter = new Map();
for (const book of archiveBooks) {
  const key = `${book.countryId}:${book.writerId}`;
  if (previousGeneratedKeys.has(`${key}:${book.id}`)) continue;
  if (!existingByWriter.has(key)) existingByWriter.set(key, new Set());
  existingByWriter.get(key).add(normalizeTitle(book.title));
}

const candidates = [];

for (let index = 0; index < mappings.length; index += batchSize) {
  const batch = mappings.slice(index, index + batchSize);
  const fetched = await fetchAuthorBatch(batch.map((entry) => entry.qid));
  candidates.push(...fetched);
  console.log(
    `Авторы ${Math.min(index + batchSize, mappings.length)}/${mappings.length}: кандидатов ${candidates.length}`
  );
  await sleep(350);
}

candidates.sort(
  (first, second) =>
    second.sitelinks - first.sitelinks ||
    first.title.localeCompare(second.title, "ru")
);

const works = {};
const acceptedIdentities = new Set();
for (const candidate of candidates) {
  if (acceptedIdentities.size >= candidateLimit) break;
  const key = keyByQid.get(candidate.authorQid);
  if (!key) continue;
  const normalized = normalizeTitle(candidate.title);
  const identity = `${key}:${normalized}`;
  if (!normalized || acceptedIdentities.has(identity)) continue;
  if (existingByWriter.get(key)?.has(normalized)) continue;

  const work = {
    id: `wikidata-${candidate.qid.toLocaleLowerCase("en")}`,
    title: candidate.title,
    ...(candidate.originalTitle && candidate.originalTitle !== candidate.title
      ? { originalTitle: candidate.originalTitle }
      : {}),
    ...(candidate.firstPublished
      ? { firstPublished: candidate.firstPublished }
      : {}),
    ...(candidate.originalLanguage
      ? { originalLanguage: candidate.originalLanguage }
      : {}),
    genres: ["литературное произведение"],
    tags: ["Wikidata", "редакционная очередь"],
    sourceUrl: `https://www.wikidata.org/wiki/${candidate.qid}`,
    editorial: { status: "draft" },
  };
  if (!works[key]) works[key] = [];
  works[key].push(work);
  acceptedIdentities.add(identity);
}

const output = {
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  publicationPolicy:
    "Staging only. Promotion requires reviewed RU/EN descriptions and field-level provenance.",
  source: {
    provider: "Wikidata",
    url: "https://www.wikidata.org/wiki/Wikidata:Data_access",
    license: "CC0",
    licenseUrl: "https://www.wikidata.org/wiki/Wikidata:Licensing",
    usage: "structured-candidate-discovery-only",
  },
  works,
};

const summary = {
  publicationFileUntouched: path.relative(projectRoot, publishedOutputPath),
  stagingFile: path.relative(projectRoot, stagingOutputPath),
  candidateLimit,
  mappedAuthors: mappings.length,
  candidates: candidates.length,
  acceptedDrafts: acceptedIdentities.size,
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
