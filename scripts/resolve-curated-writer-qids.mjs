import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createServer } from "vite";

import {
  selectUniqueWriterCandidate,
} from "./lib/curated-writer-identity.mjs";

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
const CACHE_VERSION = 2;

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
SELECT DISTINCT ?label ?item ?birth ?image ?literaryOccupation ?description WHERE {
  VALUES ?label { ${values} }
  ?item rdfs:label ?label;
        wdt:P31 wd:Q5.
  OPTIONAL { ?item wdt:P569 ?birth. }
  OPTIONAL { ?item wdt:P18 ?image. }
  OPTIONAL {
    ?item wdt:P106 ?literaryOccupation.
    VALUES ?literaryRoot {
      wd:Q36180 wd:Q49757 wd:Q6625963 wd:Q214917
      wd:Q11774202 wd:Q4853732 wd:Q18814623 wd:Q4263842
    }
    ?literaryOccupation wdt:P279* ?literaryRoot.
  }
  OPTIONAL {
    ?item schema:description ?description.
    FILTER(LANG(?description) IN ("ru", "en"))
  }
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
      const byQid = result.get(label) || new Map();
      const candidate = byQid.get(qid) || {
        qid,
        human: true,
        birthYears: [],
        portraitFilename: "",
        literaryOccupationIds: [],
        descriptions: {},
      };
      const candidateBirthYear = yearFromSparql(binding.birth?.value);
      if (candidateBirthYear) {
        candidate.birthYears = [
          ...new Set([...candidate.birthYears, candidateBirthYear]),
        ].sort();
      }
      candidate.portraitFilename ||=
        filenameFromCommonsUrl(binding.image?.value);
      const occupationId =
        binding.literaryOccupation?.value?.match(/Q\d+$/u)?.[0] || "";
      if (occupationId) {
        candidate.literaryOccupationIds = [
          ...new Set([...candidate.literaryOccupationIds, occupationId]),
        ].sort();
      }
      const description = binding.description?.value?.trim() || "";
      const descriptionLanguage = binding.description?.["xml:lang"] || "";
      if (description && descriptionLanguage) {
        candidate.descriptions[descriptionLanguage] = description;
      }
      byQid.set(qid, candidate);
      result.set(label, byQid);
    }
  }
  return new Map(
    [...result.entries()].map(([label, byQid]) => [label, [...byQid.values()]])
  );
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
    ? { version: CACHE_VERSION, labels: {} }
    : await readJson(cachePath, { version: CACHE_VERSION, labels: {} });
  if (
    cache.version !== CACHE_VERSION ||
    !cache.labels ||
    Array.isArray(cache)
  ) {
    cache.version = CACHE_VERSION;
    cache.labels = {};
  }
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
    const selection = candidates.length
      ? selectUniqueWriterCandidate(candidates, expectedYear)
      : { candidate: null, reason: "exact-label-not-found" };
    const candidate = selection.candidate;
    if (!candidate) {
      manualReview.push({
        countryId,
        writerId: writer.id,
        name: writer.name || writer.fullName,
        birthYear: expectedYear,
        reason: selection.reason,
      });
      continue;
    }
    writers[`${countryId}:${writer.id}`] = {
      wikidataId: candidate.qid,
      portraitFilename: candidate.portraitFilename || undefined,
      identityRule: "exact-label-and-birth-year",
      identitySignals: ["human", "exact-label", "birth-year", "literary-role"],
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
      manualReviewReasonCounts: Object.fromEntries(
        [...new Set(manualReview.map((item) => item.reason))]
          .sort()
          .map((reason) => [
            reason,
            manualReview.filter((item) => item.reason === reason).length,
          ])
      ),
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

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await main();
}
