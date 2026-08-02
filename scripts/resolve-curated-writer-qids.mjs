import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createServer } from "vite";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const outputPath = path.join(
  projectRoot,
  "src",
  "data",
  "countries",
  "generated",
  "curatedWriterQids.generated.json"
);
const reportPath = path.join(projectRoot, "reports", "curated-writer-qids.json");
const cacheDirectory = path.join(projectRoot, "scripts", ".cache", "curated-writer-qids");
const cachePath = path.join(cacheDirectory, "exact-label-query.json");
const refresh = process.argv.includes("--refresh");
const applyChanges = process.argv.includes("--apply");

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

function chunks(values, size) {
  const result = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

async function readJson(filename, fallback) {
  try {
    return JSON.parse(await readFile(filename, "utf8"));
  } catch {
    return fallback;
  }
}

async function loadPublicCountries() {
  const vite = await createServer({
    root: projectRoot,
    appType: "custom",
    logLevel: "error",
    server: { middlewareMode: true },
  });
  try {
    const module = await vite.ssrLoadModule("/src/data/countries/index.ts");
    return module.countries;
  } finally {
    await vite.close();
  }
}

function writerNames(writer) {
  return [...new Set([writer.name, writer.fullName].filter(Boolean).map(String))];
}

function birthYear(writer) {
  return String(writer.birthDate || writer.birth || writer.years || "").match(
    /[+-]?(\d{3,4})/u
  )?.[1] || "";
}

function language(value) {
  return /[А-Яа-яЁё]/u.test(value) ? "ru" : "en";
}

function sparqlString(value) {
  return String(value).replace(/\\/gu, "\\\\").replace(/"/gu, '\\"');
}

async function queryLabels(labels, attempt = 1) {
  const values = labels
    .map((label) => `"${sparqlString(label)}"@${language(label)}`)
    .join(" ");
  const query = `
SELECT DISTINCT ?label ?item ?birth ?image WHERE {
  VALUES ?label { ${values} }
  ?item rdfs:label ?label;
        wdt:P31 wd:Q5.
  OPTIONAL { ?item wdt:P569 ?birth. }
  OPTIONAL { ?item wdt:P18 ?image. }
}`;
  try {
    const parameters = new URLSearchParams({ query });
    const response = await fetch(
      `https://query.wikidata.org/sparql?${parameters.toString()}`,
      {
      headers: {
        Accept: "application/sparql-results+json",
        "User-Agent": "ProbPeraCuratedWriterResolver/1.0 (probperasite@yandex.ru)",
      },
      signal: AbortSignal.timeout(45_000),
      }
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  } catch (error) {
    if (attempt >= 3) throw error;
    await sleep(2_000 * attempt);
    return queryLabels(labels, attempt + 1);
  }
}

function filenameFromCommonsUrl(value) {
  if (!value) return "";
  const segment = value.split("/").pop() || "";
  try {
    return decodeURIComponent(segment).replace(/_/gu, " ");
  } catch {
    return segment.replace(/_/gu, " ");
  }
}

function yearFromSparql(value) {
  return String(value || "").match(/^-?(\d{3,4})/u)?.[1] || "";
}

function rowsByLabel(payloads) {
  const result = new Map();
  for (const payload of payloads) {
    for (const binding of payload.results?.bindings || []) {
      const label = binding.label?.value || "";
      const qid = binding.item?.value?.match(/Q\d+$/u)?.[0] || "";
      if (!label || !qid) continue;
      const values = result.get(label) || [];
      values.push({
        qid,
        birthYear: yearFromSparql(binding.birth?.value),
        portraitFilename: filenameFromCommonsUrl(binding.image?.value),
      });
      result.set(label, values);
    }
  }
  return result;
}

function uniqueCandidate(candidates, expectedBirthYear) {
  let filtered = candidates || [];
  if (expectedBirthYear) {
    const sameYear = filtered.filter(
      (candidate) => candidate.birthYear === expectedBirthYear
    );
    if (sameYear.length) filtered = sameYear;
  }
  const unique = new Map(filtered.map((candidate) => [candidate.qid, candidate]));
  return unique.size === 1 ? [...unique.values()][0] : null;
}

async function main() {
  const countries = await loadPublicCountries();
  const records = countries.flatMap((country) =>
    country.writers.map((writer) => ({ countryId: country.id, writer }))
  );
  const labels = [
    ...new Set(records.flatMap(({ writer }) => writerNames(writer))),
  ];

  const cache = refresh
    ? { labels: {} }
    : await readJson(cachePath, { labels: {} });
  if (!cache.labels || Array.isArray(cache)) cache.labels = {};
  const missingLabels = labels.filter(
    (label) => !Object.hasOwn(cache.labels, label)
  );
  const batches = chunks(missingLabels, 12);
  let failedBatches = 0;
  await mkdir(cacheDirectory, { recursive: true });
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
    const batch = batches[batchIndex];
    try {
      const payload = await queryLabels(batch);
      const batchRows = rowsByLabel([payload]);
      for (const label of batch) {
        cache.labels[label] = batchRows.get(label) || [];
      }
      await writeFile(cachePath, `${JSON.stringify(cache)}\n`, "utf8");
    } catch (error) {
      failedBatches += 1;
      process.stderr.write(
        `\nWikidata batch skipped (${error.message}); it will be retried on the next run.\n`
      );
    }
    process.stdout.write(`\rWikidata labels: ${batchIndex + 1}/${batches.length}`);
    if (batchIndex + 1 < batches.length) await sleep(500);
  }
  if (batches.length) process.stdout.write("\n");

  const index = new Map(Object.entries(cache.labels));
  const writers = {};
  const manualReview = [];
  for (const { countryId, writer } of records) {
    const expectedYear = birthYear(writer);
    const candidates = writerNames(writer).flatMap((name) => index.get(name) || []);
    const candidate = uniqueCandidate(candidates, expectedYear);
    if (!candidate) {
      manualReview.push({
        countryId,
        writerId: writer.id,
        name: writer.name || writer.fullName,
        birthYear: expectedYear,
        reason: candidates.length ? "ambiguous-or-date-mismatch" : "exact-label-not-found",
      });
      continue;
    }
    writers[`${countryId}:${writer.id}`] = {
      wikidataId: candidate.qid,
      portraitFilename: candidate.portraitFilename || undefined,
      identityRule: "exact-label-and-birth-year",
      sourceUrl: `https://www.wikidata.org/wiki/${candidate.qid}`,
      checkedAt: new Date().toISOString().slice(0, 10),
    };
  }

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      writerRecords: records.length,
      uniqueLabels: labels.length,
      resolved: Object.keys(writers).length,
      resolvedWithPortrait: Object.values(writers).filter(
        (writer) => writer.portraitFilename
      ).length,
      manualReview: manualReview.length,
      cachedLabels: Object.keys(cache.labels).length,
      failedBatches,
    },
    manualReview,
  };
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  if (applyChanges) {
    await writeFile(
      outputPath,
      `${JSON.stringify({ generatedAt: report.generatedAt, writers }, null, 2)}\n`,
      "utf8"
    );
  }
  console.log(JSON.stringify(report.summary, null, 2));
}

await main();
