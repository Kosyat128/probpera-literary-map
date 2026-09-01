import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createServer } from "vite";

import {
  hasLiteraryIdentitySignal,
  mergeIdentityCandidates,
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
const identityRemediationPath = path.join(
  projectRoot,
  "src",
  "data",
  "countries",
  "generated",
  "writerIdentityRemediations.generated.json"
);
const cacheDirectory = path.join(projectRoot, "scripts", ".cache", "curated-writer-qids");
const cachePath = path.join(cacheDirectory, "exact-label-query.json");
const aliasCachePath = path.join(
  cacheDirectory,
  "exact-alias-query-v2.json"
);
const refresh = process.argv.includes("--refresh");
const applyChanges = process.argv.includes("--apply");
const CACHE_VERSION = 2;
const ALIAS_CACHE_VERSION = 2;

export const EVIDENCE_BACKED_QID_REPLACEMENTS = Object.freeze({
  "angola:ana_paula_tavares": Object.freeze({
    previousWikidataId: "Q59186426",
    replacementWikidataId: "Q460121",
    reason:
      "Q59186426 identifies a different ORCID-linked researcher; Q460121 identifies the Angolan writer and poet born 1952-10-30.",
    evidenceUrls: Object.freeze([
      "https://www.wikidata.org/wiki/Q59186426",
      "https://www.wikidata.org/wiki/Q460121",
    ]),
    checkedAt: "2026-08-31",
  }),
});

export const CURATED_MANUAL_IDENTITY_OVERRIDES = Object.freeze({
  "russia:avvakum": Object.freeze({
    wikidataId: "Q318473",
    portraitFilename: "Protopop Avvakym.jpg",
    identityRule: "curated-authoritative-source-and-wikidata",
    identitySignals: Object.freeze([
      "human",
      "authoritative-source",
      "birth-period",
      "literary-role",
      "historical-title-alias",
    ]),
    sourceUrl: "https://www.wikidata.org/wiki/Q318473",
    authoritativeSourceUrl:
      "https://www.prlib.ru/Great_Russia/cultural_XVII/Avvakum_Petrov",
    checkedAt: "2026-08-31",
  }),
});

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

export function writerNames(writer) {
  return [...new Set([writer.name, writer.fullName].filter(Boolean).map(String))];
}

export function birthYear(writer) {
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

async function queryAliases(aliases, attempt = 1) {
  const values = aliases
    .map((alias) => `"${sparqlString(alias)}"@${language(alias)}`)
    .join(" ");
  const query = `
SELECT DISTINCT ?alias ?item ?birth ?image ?literaryOccupation ?description WHERE {
  VALUES ?alias { ${values} }
  ?item skos:altLabel ?alias;
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
    return queryAliases(aliases, attempt + 1);
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

function rowsByTerm(payloads, termName) {
  const result = new Map();
  for (const payload of payloads) {
    for (const binding of payload.results?.bindings || []) {
      const term = binding[termName]?.value || "";
      const qid = binding.item?.value?.match(/Q\d+$/u)?.[0] || "";
      if (!term || !qid) continue;
      const byQid = result.get(term) || new Map();
      const candidate = byQid.get(qid) || {
        qid,
        human: true,
        birthYears: [],
        portraitFilename: "",
        literaryOccupationIds: [],
        literaryConfirmed: false,
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
        // The SPARQL pattern binds only occupations that are equal to or
        // descend from one of the approved literary roots. Keep that proof
        // explicitly: the leaf occupation QID need not itself be a root QID.
        candidate.literaryConfirmed = true;
      }
      const description = binding.description?.value?.trim() || "";
      const descriptionLanguage = binding.description?.["xml:lang"] || "";
      if (description && descriptionLanguage) {
        candidate.descriptions[descriptionLanguage] = description;
      }
      byQid.set(qid, candidate);
      result.set(term, byQid);
    }
  }
  return new Map(
    [...result.entries()].map(([term, byQid]) => [term, [...byQid.values()]])
  );
}

function rowsByLabel(payloads) {
  return rowsByTerm(payloads, "label");
}

export function rowsByAlias(payloads) {
  return rowsByTerm(payloads, "alias");
}

export function selectIndexedWriterCandidate(
  writer,
  index,
  notFoundReason
) {
  const expectedYear = birthYear(writer);
  const candidates = writerNames(writer).flatMap((name) => index.get(name) || []);
  const selection = candidates.length
    ? selectUniqueWriterCandidate(candidates, expectedYear)
    : { candidate: null, reason: notFoundReason };
  return { ...selection, expectedYear };
}

function mergeResolverCandidates(candidates) {
  const literaryConfirmedQids = new Set(
    candidates
      .filter((candidate) => candidate?.literaryConfirmed === true)
      .map((candidate) => String(candidate?.qid || "").toUpperCase())
  );
  return mergeIdentityCandidates(candidates).map((candidate) => ({
    ...candidate,
    literaryConfirmed: literaryConfirmedQids.has(candidate.qid),
  }));
}

export function selectStrictAliasWriterCandidate(
  writer,
  index,
  notFoundReason = "exact-alias-not-found"
) {
  const expectedYear = birthYear(writer);
  const indexedCandidates = writerNames(writer).flatMap(
    (name) => index.get(name) || []
  );
  if (!indexedCandidates.length) {
    return { candidate: null, reason: notFoundReason, expectedYear };
  }

  const humans = mergeResolverCandidates(indexedCandidates).filter(
    (candidate) => candidate.human !== false
  );
  if (!humans.length) {
    return {
      candidate: null,
      reason: "human-identity-not-established",
      expectedYear,
    };
  }

  const dateCompatible = expectedYear
    ? humans.filter((candidate) => candidate.birthYears.includes(expectedYear))
    : humans;
  if (!dateCompatible.length) {
    return {
      candidate: null,
      reason: expectedYear
        ? "birth-year-mismatch-or-missing"
        : "human-identity-not-established",
      expectedYear,
    };
  }
  if (dateCompatible.length !== 1) {
    return { candidate: null, reason: "ambiguous-identity", expectedYear };
  }

  const candidate = dateCompatible[0];
  if (
    candidate.literaryConfirmed !== true &&
    !hasLiteraryIdentitySignal(candidate)
  ) {
    return {
      candidate: null,
      reason: "literary-identity-not-established",
      expectedYear,
    };
  }
  return { candidate, reason: null, expectedYear };
}

export function collectUnresolvedAliasTerms(unresolvedRecords) {
  return [
    ...new Set(
      unresolvedRecords.flatMap(({ writer }) => writerNames(writer))
    ),
  ];
}

export function createAliasIdentity(candidate, expectedYear, checkedAt) {
  const hasExpectedBirthYear = Boolean(expectedYear);
  return {
    wikidataId: candidate.qid,
    portraitFilename: candidate.portraitFilename || undefined,
    identityRule: hasExpectedBirthYear
      ? "exact-alias-and-birth-year"
      : "exact-alias-and-literary-role",
    identitySignals: [
      "human",
      "exact-alias",
      ...(hasExpectedBirthYear ? ["birth-year"] : []),
      "literary-role",
    ],
    sourceUrl: `https://www.wikidata.org/wiki/${candidate.qid}`,
    checkedAt,
  };
}

export function assertResolverCachesComplete({
  labels,
  aliases,
  labelCache,
  aliasCache,
  failedBatches = 0,
  failedAliasBatches = 0,
}) {
  const uncachedLabels = labels.filter(
    (label) => !Object.hasOwn(labelCache, label)
  );
  const uncachedAliases = aliases.filter(
    (alias) => !Object.hasOwn(aliasCache, alias)
  );
  if (
    failedBatches ||
    failedAliasBatches ||
    uncachedLabels.length ||
    uncachedAliases.length
  ) {
    throw new Error(
      "Refusing --apply because the exact-label or exact-alias cache is incomplete."
    );
  }
  return true;
}

export async function writeAppliedWriterRegistry({
  applyChanges,
  labels,
  aliases,
  labelCache,
  aliasCache,
  failedBatches,
  failedAliasBatches,
  targetPath,
  payload,
  writeOutput = writeFile,
}) {
  if (!applyChanges) return false;
  assertResolverCachesComplete({
    labels,
    aliases,
    labelCache,
    aliasCache,
    failedBatches,
    failedAliasBatches,
  });
  await writeOutput(
    targetPath,
    `${JSON.stringify(payload, null, 2)}\n`,
    "utf8"
  );
  return true;
}

export function mergePublishedWriterMappings(
  existingWriters,
  freshWriters,
  approvedReplacements = EVIDENCE_BACKED_QID_REPLACEMENTS
) {
  const publishedWriters = { ...existingWriters };
  const newlyAddedKeys = [];
  const conflicts = [];
  let preservedExisting = Object.keys(existingWriters).length;
  let evidenceBackedReplacements = 0;

  for (const [key, freshMapping] of Object.entries(freshWriters)) {
    if (!Object.hasOwn(existingWriters, key)) {
      publishedWriters[key] = freshMapping;
      newlyAddedKeys.push(key);
      continue;
    }

    const existingMapping = existingWriters[key];
    const existingWikidataId = String(existingMapping?.wikidataId || "");
    const freshWikidataId = String(freshMapping?.wikidataId || "");
    if (existingWikidataId === freshWikidataId) continue;

    const remediation = approvedReplacements[key];
    const evidenceBackedReplacement = Boolean(
      remediation &&
        remediation.previousWikidataId === existingWikidataId &&
        remediation.replacementWikidataId === freshWikidataId
    );
    if (evidenceBackedReplacement) {
      publishedWriters[key] = freshMapping;
      preservedExisting -= 1;
      evidenceBackedReplacements += 1;
    }
    conflicts.push({
      key,
      existingWikidataId,
      freshWikidataId,
      resolution: evidenceBackedReplacement
        ? "evidence-backed-replacement"
        : "preserved-existing",
      ...(evidenceBackedReplacement ? { remediation } : {}),
    });
  }

  const removedExistingKeys = Object.keys(existingWriters).filter(
    (key) => !Object.hasOwn(publishedWriters, key)
  );
  if (removedExistingKeys.length) {
    throw new Error("Writer registry merge invariant failed: existing mappings removed.");
  }

  return {
    writers: publishedWriters,
    newlyAddedKeys,
    conflicts,
    preservedExisting,
    evidenceBackedReplacements,
    removedExistingKeys,
  };
}

export function addManualIdentityOverrides(freshWriters) {
  return { ...freshWriters, ...CURATED_MANUAL_IDENTITY_OVERRIDES };
}

export function filterBlockedFreshMappings(freshWriters, removedMappings) {
  const blockedPairs = new Map(
    removedMappings.map((item) => [
      `${String(item?.key || "")}:${String(item?.oldQid || "")}`,
      item,
    ])
  );
  const writers = {};
  const blocked = [];
  for (const [key, mapping] of Object.entries(freshWriters)) {
    const pairKey = `${key}:${String(mapping?.wikidataId || "")}`;
    const remediation = blockedPairs.get(pairKey);
    if (remediation) {
      blocked.push({
        key,
        wikidataId: mapping.wikidataId,
        reason: remediation.reason,
        resolution: "blocked-by-identity-remediation",
      });
      continue;
    }
    writers[key] = mapping;
  }
  return { writers, blocked };
}

async function main() {
  const countries = await loadPublicCountries();
  const records = countries.flatMap((country) =>
    country.writers.map((writer) => ({ countryId: country.id, writer }))
  );
  const labels = [
    ...new Set(records.flatMap(({ writer }) => writerNames(writer))),
  ];
  const existingRegistry = await readJson(outputPath, null);
  const existingWriters = existingRegistry?.writers;
  if (
    !existingWriters ||
    typeof existingWriters !== "object" ||
    Array.isArray(existingWriters)
  ) {
    if (applyChanges) {
      throw new Error(
        "Refusing --apply because the existing curated writer registry is unavailable or malformed."
      );
    }
  }
  const identityRemediations = await readJson(identityRemediationPath, null);
  const removedMappings = identityRemediations?.removedMappings;
  if (!Array.isArray(removedMappings)) {
    if (applyChanges) {
      throw new Error(
        "Refusing --apply because the identity remediation registry is unavailable or malformed."
      );
    }
  }

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
  const unresolvedAfterExactLabel = [];
  const checkedAt = new Date().toISOString().slice(0, 10);
  for (const { countryId, writer } of records) {
    const selection = selectIndexedWriterCandidate(
      writer,
      index,
      "exact-label-not-found"
    );
    const candidate = selection.candidate;
    if (!candidate) {
      unresolvedAfterExactLabel.push({
        countryId,
        writer,
        exactLabelReason: selection.reason,
      });
      continue;
    }
    writers[`${countryId}:${writer.id}`] = {
      wikidataId: candidate.qid,
      portraitFilename: candidate.portraitFilename || undefined,
      identityRule: "exact-label-and-birth-year",
      identitySignals: ["human", "exact-label", "birth-year", "literary-role"],
      sourceUrl: `https://www.wikidata.org/wiki/${candidate.qid}`,
      checkedAt,
    };
  }

  const aliases = collectUnresolvedAliasTerms(unresolvedAfterExactLabel);
  const aliasCache = refresh
    ? { version: ALIAS_CACHE_VERSION, aliases: {} }
    : await readJson(aliasCachePath, {
        version: ALIAS_CACHE_VERSION,
        aliases: {},
      });
  if (
    aliasCache.version !== ALIAS_CACHE_VERSION ||
    !aliasCache.aliases ||
    Array.isArray(aliasCache)
  ) {
    aliasCache.version = ALIAS_CACHE_VERSION;
    aliasCache.aliases = {};
  }
  const missingAliases = aliases.filter(
    (alias) => !Object.hasOwn(aliasCache.aliases, alias)
  );
  const aliasBatches = chunks(missingAliases, 12);
  let failedAliasBatches = 0;
  for (
    let batchIndex = 0;
    batchIndex < aliasBatches.length;
    batchIndex += 1
  ) {
    const batch = aliasBatches[batchIndex];
    try {
      const payload = await queryAliases(batch);
      const batchRows = rowsByAlias([payload]);
      for (const alias of batch) {
        aliasCache.aliases[alias] = batchRows.get(alias) || [];
      }
      await writeFile(aliasCachePath, `${JSON.stringify(aliasCache)}\n`, "utf8");
    } catch (error) {
      failedAliasBatches += 1;
      process.stderr.write(
        `\nWikidata alias batch skipped (${error.message}); it will be retried on the next run.\n`
      );
    }
    process.stdout.write(
      `\rWikidata aliases: ${batchIndex + 1}/${aliasBatches.length}`
    );
    if (batchIndex + 1 < aliasBatches.length) await sleep(500);
  }
  if (aliasBatches.length) process.stdout.write("\n");

  const aliasIndex = new Map(Object.entries(aliasCache.aliases));
  const manualReview = [];
  let exactAliasResolved = 0;
  for (const {
    countryId,
    writer,
    exactLabelReason,
  } of unresolvedAfterExactLabel) {
    const selection = selectStrictAliasWriterCandidate(
      writer,
      aliasIndex,
      "exact-alias-not-found"
    );
    const candidate = selection.candidate;
    if (!candidate) {
      manualReview.push({
        countryId,
        writerId: writer.id,
        name: writer.name || writer.fullName,
        birthYear: selection.expectedYear,
        reason: selection.reason,
        exactLabelReason,
      });
      continue;
    }
    writers[`${countryId}:${writer.id}`] = createAliasIdentity(
      candidate,
      selection.expectedYear,
      checkedAt
    );
    exactAliasResolved += 1;
  }

  const eligibleFresh = filterBlockedFreshMappings(
    writers,
    removedMappings || []
  );
  const candidateWriters = addManualIdentityOverrides(eligibleFresh.writers);
  const registryMerge = mergePublishedWriterMappings(
    existingWriters || {},
    candidateWriters
  );
  const recordsByKey = new Map(
    records.map(({ countryId, writer }) => [
      `${countryId}:${writer.id}`,
      { countryId, writer },
    ])
  );
  const conflictManualReview = registryMerge.conflicts.map((conflict) => {
    const record = recordsByKey.get(conflict.key);
    const separatorIndex = conflict.key.indexOf(":");
    return {
      countryId:
        record?.countryId ||
        (separatorIndex >= 0 ? conflict.key.slice(0, separatorIndex) : ""),
      writerId:
        record?.writer.id ||
        (separatorIndex >= 0
          ? conflict.key.slice(separatorIndex + 1)
          : conflict.key),
      name: record?.writer.name || record?.writer.fullName || "",
      reason: "existing-qid-conflict",
      existingWikidataId: conflict.existingWikidataId,
      freshWikidataId: conflict.freshWikidataId,
      resolution: conflict.resolution,
    };
  });
  const blockedFreshManualReview = eligibleFresh.blocked.map((blocked) => {
    const record = recordsByKey.get(blocked.key);
    return {
      countryId: record?.countryId || blocked.key.split(":")[0] || "",
      writerId: record?.writer.id || blocked.key.split(":").slice(1).join(":"),
      name: record?.writer.name || record?.writer.fullName || "",
      reason: "blocked-remediated-qid",
      blockedWikidataId: blocked.wikidataId,
      resolution: blocked.resolution,
    };
  });
  const completeManualReview = [
    ...manualReview,
    ...blockedFreshManualReview,
    ...conflictManualReview,
  ];
  const publishedMappings = Object.keys(registryMerge.writers).length;
  const publishedWithPortrait = Object.values(registryMerge.writers).filter(
    (writer) => writer.portraitFilename
  ).length;

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      writerRecords: records.length,
      uniqueLabels: labels.length,
      freshResolved: Object.keys(writers).length,
      eligibleFreshResolved: Object.keys(eligibleFresh.writers).length,
      exactLabelResolved:
        Object.keys(writers).length - exactAliasResolved,
      exactAliasResolved,
      manualIdentityOverrides: Object.keys(
        CURATED_MANUAL_IDENTITY_OVERRIDES
      ).length,
      candidateMappings: Object.keys(candidateWriters).length,
      freshResolvedWithPortrait: Object.values(writers).filter(
        (writer) => writer.portraitFilename
      ).length,
      newlyAdded: registryMerge.newlyAddedKeys.length,
      preservedExisting: registryMerge.preservedExisting,
      conflicts: registryMerge.conflicts.length,
      evidenceBackedReplacements: registryMerge.evidenceBackedReplacements,
      blockedFreshMappings: eligibleFresh.blocked.length,
      removedExisting: registryMerge.removedExistingKeys.length,
      publishedMappings,
      publishedWithPortrait,
      manualReview: completeManualReview.length,
      cachedLabels: Object.keys(cache.labels).length,
      cachedAliases: Object.keys(aliasCache.aliases).length,
      failedBatches,
      failedAliasBatches,
      manualReviewReasonCounts: Object.fromEntries(
        [...new Set(completeManualReview.map((item) => item.reason))]
          .sort()
          .map((reason) => [
            reason,
            completeManualReview.filter((item) => item.reason === reason).length,
          ])
      ),
    },
    blockedFreshMappings: eligibleFresh.blocked,
    conflicts: registryMerge.conflicts,
    manualReview: completeManualReview,
  };
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeAppliedWriterRegistry({
    applyChanges,
    labels,
    aliases,
    labelCache: cache.labels,
    aliasCache: aliasCache.aliases,
    failedBatches,
    failedAliasBatches,
    targetPath: outputPath,
    payload: { generatedAt: report.generatedAt, writers: registryMerge.writers },
  });
  console.log(JSON.stringify(report.summary, null, 2));
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await main();
}
