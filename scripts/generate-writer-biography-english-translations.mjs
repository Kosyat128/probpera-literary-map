import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { build } from "esbuild";

import {
  writerBiographyCheckpointAuditFromWorkerPayload,
  writerBiographyDuplicateEnglishGroups,
  writerBiographyEditorialPostEditIssues,
  writerBiographyEnglishQaIssues,
  writerBiographyPublicEnglishTranslationAuditRecord,
  writerBiographyPublicEnglishTranslationRecord,
  writerBiographyTranslationAuditIssues,
} from "./lib/writer-biography-english-qa.mjs";
import {
  writerBiographyEnglishSourceFingerprint as sourceFingerprint,
  writerBiographyEnglishSourceHash as sourceHash,
  writerBiographyRussianSourceIssues as russianSourceIssues,
} from "./lib/writer-biography-english-source-contract.mjs";
import {
  RUSSIAN_EDITORIAL_REVIEWER_MODEL,
  RUSSIAN_EDITORIAL_TRANSLATOR_MODEL,
} from "./lib/writer-biography-russian-editorial-contract.mjs";

const EXPECTED_WRITER_COUNT = 1_684;
const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const cacheDirectory = path.join(projectRoot, "scripts", ".cache");
const sourceBundlePath = path.join(
  cacheDirectory,
  `writer-biography-english-source-${process.pid}.mjs`
);
const checkpointPath = path.join(
  cacheDirectory,
  "writer-biography-english.checkpoint.json"
);
const overlayPath = path.join(
  projectRoot,
  "src",
  "data",
  "countries",
  "generated",
  "writerBiographyEnglishTranslations.generated.json"
);
const reportPath = path.join(
  projectRoot,
  "reports",
  "writer-biography-english-translation-qa.json"
);

function argumentValue(name) {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(
    prefix.length
  );
}

function integerArgument(name, fallback, minimum, maximum) {
  const raw = argumentValue(name);
  if (raw === undefined) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`--${name} must be an integer from ${minimum} to ${maximum}`);
  }
  return value;
}

const checkMode = process.argv.includes("--check");
const checkpointCheckMode = process.argv.includes("--checkpoint-check");
const sourceCheckMode = process.argv.includes("--source-check");
const writeMode = process.argv.includes("--write");
const endpoint = String(argumentValue("endpoint") || "").replace(/\/$/u, "");
const concurrency = integerArgument("concurrency", 6, 1, 10);
const sampleSize = integerArgument("sample", 0, 0, 100);
const limit = integerArgument("limit", 0, 0, EXPECTED_WRITER_COUNT);
const maxAttempts = integerArgument("attempts", 3, 1, 5);
const transferConfirmed = process.argv.includes(
  "--confirm-cloudflare-public-data-transfer"
);

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function loadSourceRecords() {
  await mkdir(cacheDirectory, { recursive: true });
  await build({
    absWorkingDir: projectRoot,
    entryPoints: [
      path.join(projectRoot, "scripts", "writer-biography-english-source.ts"),
    ],
    bundle: true,
    platform: "node",
    packages: "external",
    format: "esm",
    target: "node22",
    outfile: sourceBundlePath,
    logLevel: "silent",
  });
  try {
    const loaded = await import(
      `${pathToFileURL(sourceBundlePath).href}?v=${Date.now()}`
    );
    const records = loaded.writerBiographyEnglishSource;
    if (!Array.isArray(records)) throw new Error("Invalid biography source bundle");
    return records;
  } finally {
    await rm(sourceBundlePath, { force: true });
  }
}

function normalizedSourceRecords(records) {
  if (records.length !== EXPECTED_WRITER_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_WRITER_COUNT} public writers, received ${records.length}`
    );
  }
  const keys = new Set();
  return records
    .map((record) => {
      if (!record || typeof record !== "object" || !record.key) {
        throw new Error("Biography source contains an invalid record");
      }
      if (keys.has(record.key)) {
        throw new Error(`Duplicate biography key: ${record.key}`);
      }
      keys.add(record.key);
      const issues = russianSourceIssues(record);
      if (issues.length) {
        throw new Error(`${record.key}: ${issues.join(", ")}`);
      }
      return { ...record, sourceHash: sourceHash(record) };
    })
    .sort((left, right) => left.key.localeCompare(right.key, "en"));
}

async function readJsonOr(valuePath, fallback) {
  try {
    return JSON.parse(await readFile(valuePath, "utf8"));
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return fallback;
    }
    throw error;
  }
}

function emptyCheckpoint() {
  return { version: 1, updatedAt: null, translations: {}, failures: {} };
}

async function writeCheckpoint(checkpoint) {
  await mkdir(path.dirname(checkpointPath), { recursive: true });
  checkpoint.updatedAt = new Date().toISOString();
  await writeFile(checkpointPath, stableJson(checkpoint), "utf8");
}

function checkpointTranslationIssues(record, candidate) {
  const issues = [];
  if (!candidate || typeof candidate !== "object") {
    return ["missing-translation"];
  }
  if (candidate.sourceHash !== record.sourceHash) {
    issues.push("stale-source-hash");
  }
  if (candidate.translatorModel !== RUSSIAN_EDITORIAL_TRANSLATOR_MODEL) {
    issues.push("unexpected-translator-model");
  }
  if (candidate.reviewerModel !== RUSSIAN_EDITORIAL_REVIEWER_MODEL) {
    issues.push("unexpected-reviewer-model");
  }
  if (!candidate.generatedAt) issues.push("missing-generated-at");
  if (!candidate.reviewedAt) issues.push("missing-reviewed-at");
  issues.push(
    ...writerBiographyEditorialPostEditIssues(candidate.editorialPostEdit)
  );
  if (
    candidate.editorialPostEdit &&
    !Number.isNaN(Date.parse(candidate.generatedAt)) &&
    !Number.isNaN(Date.parse(candidate.editorialPostEdit.editedAt)) &&
    Date.parse(candidate.editorialPostEdit.editedAt) <
      Date.parse(candidate.generatedAt)
  ) {
    issues.push("editorial-post-edit-predates-generation");
  }
  issues.push(...writerBiographyTranslationAuditIssues(candidate));
  if (
    !Array.isArray(candidate.passes) ||
    !new Set([2, 3]).has(candidate.passes.length) ||
    candidate.passes[0]?.model !== RUSSIAN_EDITORIAL_TRANSLATOR_MODEL ||
    candidate.passes
      .slice(1)
      .some((pass) => pass?.model !== RUSSIAN_EDITORIAL_REVIEWER_MODEL)
  ) {
    issues.push("unexpected-pass-model-sequence");
  }
  issues.push(
    ...writerBiographyEnglishQaIssues({
      sourceText: record.russian.text,
      englishText: candidate.text,
      writerName: record.writerName,
    })
  );
  return [...new Set(issues)];
}

function validCheckpointTranslation(record, candidate) {
  return checkpointTranslationIssues(record, candidate).length === 0;
}

function invalidateDuplicateCheckpointTranslations(records, checkpoint) {
  const validTranslations = {};
  for (const record of records) {
    const candidate = checkpoint.translations[record.key];
    if (validCheckpointTranslation(record, candidate)) {
      validTranslations[record.key] = candidate;
    }
  }
  const invalidated = [];
  for (const keys of writerBiographyDuplicateEnglishGroups(
    records,
    validTranslations
  )) {
    for (const key of keys.slice(1)) {
      delete checkpoint.translations[key];
      delete checkpoint.failures[key];
      invalidated.push({ key, duplicateOf: keys[0] });
    }
  }
  return invalidated;
}

function spreadSample(records, size) {
  if (size <= 0 || size >= records.length) return records;
  if (size === 1) return [records[0]];
  return Array.from({ length: size }, (_, index) =>
    records[Math.floor((index * (records.length - 1)) / (size - 1))]
  );
}

function selectedRecords(records) {
  if (sampleSize > 0) return spreadSample(records, sampleSize);
  if (limit > 0) return records.slice(0, limit);
  return records;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function requestTranslation(record) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      key: record.key,
      writerName: record.writerName,
      text: record.russian.text,
    }),
    signal: AbortSignal.timeout(360_000),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && payload.error
        ? String(payload.error)
        : `HTTP ${response.status}`;
    throw new Error(message.slice(0, 800));
  }
  if (!payload || typeof payload !== "object" || payload.key !== record.key) {
    throw new Error("Translation worker returned an invalid record identity");
  }
  const text = String(payload.value?.text || "").replace(/\s+/gu, " ").trim();
  const issues = writerBiographyEnglishQaIssues({
    sourceText: record.russian.text,
    englishText: text,
    writerName: record.writerName,
  });
  if (issues.length) throw new Error(`postflight QA: ${issues.join(", ")}`);
  if (!payload.translatorModel || !payload.reviewerModel) {
    throw new Error("Two-pass model provenance is incomplete");
  }
  const generatedAt = new Date().toISOString();
  const translation = {
    text,
    sourceHash: record.sourceHash,
    generatedAt,
    reviewedAt: generatedAt.slice(0, 10),
    translatorModel: String(payload.translatorModel),
    reviewerModel: String(payload.reviewerModel),
    ...writerBiographyCheckpointAuditFromWorkerPayload(payload),
  };
  if (!validCheckpointTranslation(record, translation)) {
    throw new Error(
      `Translation checkpoint validation failed: ${checkpointTranslationIssues(
        record,
        translation
      ).join(", ")}`
    );
  }
  return translation;
}

async function translateSelected(records, checkpoint) {
  let endpointUrl;
  try {
    endpointUrl = new URL(endpoint);
  } catch {
    throw new Error("A local preview --endpoint=http://127.0.0.1:PORT is required");
  }
  if (
    !new Set(["127.0.0.1", "localhost", "::1"]).has(endpointUrl.hostname) ||
    !new Set(["http:", "https:"]).has(endpointUrl.protocol)
  ) {
    throw new Error("Translation endpoint must be a local Wrangler preview proxy");
  }
  if (!transferConfirmed) {
    throw new Error(
      "Cloudflare data-transfer confirmation flag is required after informed user consent"
    );
  }
  let writeQueue = Promise.resolve();
  const persist = () => {
    writeQueue = writeQueue.then(() => writeCheckpoint(checkpoint));
    return writeQueue;
  };

  let cursor = 0;
  let completed = 0;
  const failures = [];
  const workers = Array.from(
    { length: Math.min(concurrency, records.length) },
    async () => {
      while (cursor < records.length) {
        const record = records[cursor++];
        if (validCheckpointTranslation(record, checkpoint.translations[record.key])) {
          completed += 1;
          continue;
        }

        let lastError = null;
        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
          try {
            const translation = await requestTranslation(record);
            checkpoint.translations[record.key] = translation;
            delete checkpoint.failures[record.key];
            completed += 1;
            await persist();
            process.stdout.write(
              `[${completed}/${records.length}] ${record.key} reviewed\n`
            );
            lastError = null;
            break;
          } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            if (attempt < maxAttempts) await delay(1_000 * 2 ** (attempt - 1));
          }
        }
        if (lastError) {
          const failure = {
            key: record.key,
            sourceHash: record.sourceHash,
            error: lastError.message.slice(0, 1_000),
            failedAt: new Date().toISOString(),
          };
          checkpoint.failures[record.key] = failure;
          failures.push(failure);
          await persist();
          process.stderr.write(`[failed] ${record.key}: ${failure.error}\n`);
        }
      }
    }
  );
  await Promise.all(workers);
  await writeQueue;
  return failures;
}

async function repairNewDuplicateTranslations(records, checkpoint) {
  const invalidated = invalidateDuplicateCheckpointTranslations(
    records,
    checkpoint
  );
  if (invalidated.length === 0) return [];

  await writeCheckpoint(checkpoint);
  for (const item of invalidated) {
    process.stderr.write(
      `[retry] ${item.key}: duplicated ${item.duplicateOf} after generation\n`
    );
  }
  const byKey = new Map(records.map((record) => [record.key, record]));
  const retries = invalidated
    .map((item) => byKey.get(item.key))
    .filter(Boolean);
  const failures = await translateSelected(retries, checkpoint);
  if (failures.length) return failures;

  const repeated = invalidateDuplicateCheckpointTranslations(
    records,
    checkpoint
  );
  if (repeated.length === 0) return [];

  const failedAt = new Date().toISOString();
  const duplicateFailures = repeated.map((item) => {
    const record = byKey.get(item.key);
    const failure = {
      key: item.key,
      sourceHash: record?.sourceHash || "",
      error: `normalized English duplicate of ${item.duplicateOf} after deterministic retry`,
      failedAt,
    };
    checkpoint.failures[item.key] = failure;
    process.stderr.write(`[failed] ${item.key}: ${failure.error}\n`);
    return failure;
  });
  await writeCheckpoint(checkpoint);
  return duplicateFailures;
}

function validateOverlay(records, overlay) {
  const issues = [];
  const translations =
    overlay && typeof overlay === "object" && overlay.translations
      ? overlay.translations
      : {};
  if (overlay?.version !== 1) issues.push("overlay-version-mismatch");
  if (overlay?.translatedCount !== EXPECTED_WRITER_COUNT) {
    issues.push("overlay-count-mismatch");
  }
  if (overlay?.sourceFingerprint !== sourceFingerprint(records)) {
    issues.push("overlay-source-fingerprint-mismatch");
  }
  if (overlay?.method !== "machine-translation") {
    issues.push("overlay-method-mismatch");
  }
  if (overlay?.translatedFromLocale !== "ru") {
    issues.push("overlay-source-locale-mismatch");
  }
  if (overlay?.sourceTextRights !== "project-original") {
    issues.push("overlay-source-rights-mismatch");
  }
  for (const record of records) {
    const translation = translations[record.key];
    if (!translation) {
      issues.push(`${record.key}:missing-translation`);
      continue;
    }
    if (translation.sourceHash !== record.sourceHash) {
      issues.push(`${record.key}:stale-source-hash`);
    }
    if (
      translation.model !== RUSSIAN_EDITORIAL_TRANSLATOR_MODEL ||
      translation.reviewerModel !== RUSSIAN_EDITORIAL_REVIEWER_MODEL
    ) {
      issues.push(`${record.key}:missing-two-pass-provenance`);
    }
    if (!translation.generatedAt || !translation.reviewedAt) {
      issues.push(`${record.key}:missing-review-timestamp`);
    }
    for (const field of [
      "editorialPostEdit",
      "pass1Text",
      "translatorRequestId",
      "reviewerRequestId",
      "usage",
      "passes",
    ]) {
      if (Object.hasOwn(translation, field)) {
        issues.push(`${record.key}:public-overlay-contains-${field}`);
      }
    }
    const publicPostEditFields = [
      "editorialPostEditedAt",
      "editorialPostEditor",
      "editorialPostEditReasonCodes",
    ];
    const publicPostEditFieldCount = publicPostEditFields.filter((field) =>
      Object.hasOwn(translation, field)
    ).length;
    if (
      publicPostEditFieldCount > 0 &&
      publicPostEditFieldCount !== publicPostEditFields.length
    ) {
      issues.push(`${record.key}:incomplete-editorial-post-edit-provenance`);
    } else if (publicPostEditFieldCount === publicPostEditFields.length) {
      for (const issue of writerBiographyEditorialPostEditIssues({
        editedAt: translation.editorialPostEditedAt,
        editor: translation.editorialPostEditor,
        reasonCodes: translation.editorialPostEditReasonCodes,
      })) {
        issues.push(`${record.key}:${issue}`);
      }
    }
    for (const issue of writerBiographyEnglishQaIssues({
      sourceText: record.russian.text,
      englishText: translation.text,
      writerName: record.writerName,
    })) {
      issues.push(`${record.key}:${issue}`);
    }
  }
  for (const key of Object.keys(translations)) {
    if (!records.some((record) => record.key === key)) {
      issues.push(`${key}:orphan-translation`);
    }
  }
  for (const keys of writerBiographyDuplicateEnglishGroups(
    records,
    translations
  )) {
    issues.push(`duplicate-normalized-english:${keys.join(",")}`);
  }
  return issues;
}

function buildOverlay(records, checkpoint) {
  const translations = {};
  for (const record of records) {
    const translation = checkpoint.translations[record.key];
    if (!validCheckpointTranslation(record, translation)) {
      throw new Error(`${record.key}: no current QA-passing translation`);
    }
    translations[record.key] =
      writerBiographyPublicEnglishTranslationRecord(translation);
  }
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    sourceFingerprint: sourceFingerprint(records),
    translatedCount: records.length,
    method: "machine-translation",
    translatedFromLocale: "ru",
    sourceTextRights: "project-original",
    translations,
  };
}

function buildReport(records, overlay, checkpoint, issues) {
  const models = {};
  const auditRecords = {};
  for (const translation of Object.values(overlay?.translations || {})) {
    const pair = `${translation.model || "missing"} -> ${
      translation.reviewerModel || "missing"
    }`;
    models[pair] = (models[pair] || 0) + 1;
  }
  for (const record of records) {
    const checkpointRecord = checkpoint.translations[record.key];
    if (!validCheckpointTranslation(record, checkpointRecord)) {
      throw new Error(`${record.key}: missing current audited translation`);
    }
    auditRecords[record.key] =
      writerBiographyPublicEnglishTranslationAuditRecord(checkpointRecord);
  }
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    sourceCount: records.length,
    translatedCount: Object.keys(overlay?.translations || {}).length,
    qaIssueCount: issues.length,
    sourceFingerprint: sourceFingerprint(records),
    method: overlay?.method || null,
    translatedFromLocale: overlay?.translatedFromLocale || null,
    sourceTextRights: overlay?.sourceTextRights || null,
    modelPairs: models,
    statusCounts: { reviewed: records.length },
    provenanceCounts: {
      machineTranslation: records.length,
      translatedFromRu: records.length,
      projectOriginalSourceText: records.length,
      editorialPostEdited: Object.values(overlay?.translations || {}).filter(
        (translation) => translation.editorialPostEditedAt
      ).length,
    },
    issues,
    records: auditRecords,
  };
}

function validateReport(records, overlay, report) {
  const issues = [];
  if (!report || report.version !== 1) issues.push("report-version-mismatch");
  if (report?.sourceCount !== EXPECTED_WRITER_COUNT) {
    issues.push("report-source-count-mismatch");
  }
  if (report?.translatedCount !== EXPECTED_WRITER_COUNT) {
    issues.push("report-translation-count-mismatch");
  }
  if (report?.sourceFingerprint !== sourceFingerprint(records)) {
    issues.push("report-source-fingerprint-mismatch");
  }
  if (
    report?.method !== "machine-translation" ||
    report?.translatedFromLocale !== "ru" ||
    report?.sourceTextRights !== "project-original"
  ) {
    issues.push("report-provenance-mismatch");
  }
  if (!report?.generatedAt) issues.push("report-generated-at-missing");
  if (
    report?.qaIssueCount !== 0 ||
    !Array.isArray(report?.issues) ||
    report.issues.length !== 0
  ) {
    issues.push("report-declares-qa-issues");
  }
  const expectedPair = `${RUSSIAN_EDITORIAL_TRANSLATOR_MODEL} -> ${RUSSIAN_EDITORIAL_REVIEWER_MODEL}`;
  if (
    !report?.modelPairs ||
    Object.keys(report.modelPairs).length !== 1 ||
    report.modelPairs[expectedPair] !== EXPECTED_WRITER_COUNT
  ) {
    issues.push("report-model-pair-count-mismatch");
  }
  if (
    report?.statusCounts?.reviewed !== EXPECTED_WRITER_COUNT ||
    Object.keys(report?.statusCounts || {}).length !== 1
  ) {
    issues.push("report-status-count-mismatch");
  }
  if (
    report?.provenanceCounts?.machineTranslation !== EXPECTED_WRITER_COUNT ||
    report?.provenanceCounts?.translatedFromRu !== EXPECTED_WRITER_COUNT ||
    report?.provenanceCounts?.projectOriginalSourceText !==
      EXPECTED_WRITER_COUNT ||
    report?.provenanceCounts?.editorialPostEdited !==
      Object.values(overlay?.translations || {}).filter(
        (translation) => translation.editorialPostEditedAt
      ).length
  ) {
    issues.push("report-provenance-count-mismatch");
  }

  for (const record of records) {
    const audit = report?.records?.[record.key];
    const published = overlay?.translations?.[record.key];
    if (!audit || typeof audit !== "object") {
      issues.push(`${record.key}:missing-audit-record`);
      continue;
    }
    if (
      audit.sourceHash !== record.sourceHash ||
      audit.sourceHash !== published?.sourceHash ||
      audit.generatedAt !== published?.generatedAt ||
      audit.reviewedAt !== published?.reviewedAt ||
      audit.translatorModel !== published?.model ||
      audit.reviewerModel !== published?.reviewerModel
    ) {
      issues.push(`${record.key}:public-audit-mismatch`);
    }
    const auditPostEdit = audit.editorialPostEdit;
    if (
      (auditPostEdit?.editedAt || null) !==
        (published?.editorialPostEditedAt || null) ||
      (auditPostEdit?.editor || null) !==
        (published?.editorialPostEditor || null) ||
      JSON.stringify(auditPostEdit?.reasonCodes || []) !==
        JSON.stringify(published?.editorialPostEditReasonCodes || [])
    ) {
      issues.push(`${record.key}:editorial-post-edit-public-audit-mismatch`);
    }
    for (const issue of writerBiographyEditorialPostEditIssues(auditPostEdit)) {
      issues.push(`${record.key}:${issue}`);
    }
    for (const field of [
      "translatorRequestId",
      "reviewerRequestId",
      "usage",
    ]) {
      if (Object.hasOwn(audit, field)) {
        issues.push(`${record.key}:public-report-contains-${field}`);
      }
    }
    if (
      audit.passes?.some((pass) =>
        Object.keys(pass || {}).some(
          (field) => !new Set(["phase", "model"]).has(field)
        )
      )
    ) {
      issues.push(`${record.key}:public-report-contains-private-pass-audit`);
    }
    if (
      !new Set([2, 3]).has(audit.passes?.length) ||
      audit.passes?.[0]?.phase !== "translation" ||
      audit.passes?.at(-1)?.phase !== "review" ||
      audit.passes
        ?.slice(1, -1)
        .some((pass) => pass?.phase !== "repair") ||
      audit.passes?.[0]?.model !== RUSSIAN_EDITORIAL_TRANSLATOR_MODEL ||
      audit.passes
        ?.slice(1)
        .some((pass) => pass?.model !== RUSSIAN_EDITORIAL_REVIEWER_MODEL)
    ) {
      issues.push(`${record.key}:audit-pass-model-sequence-mismatch`);
    }
  }
  for (const key of Object.keys(report?.records || {})) {
    if (!records.some((record) => record.key === key)) {
      issues.push(`${key}:orphan-audit-record`);
    }
  }
  return issues;
}

const sourceRecords = normalizedSourceRecords(await loadSourceRecords());

if (sourceCheckMode) {
  process.stdout.write(
    `Verified English translation source: ${sourceRecords.length}/${EXPECTED_WRITER_COUNT} strict Russian biographies (${sourceFingerprint(sourceRecords)}).\n`
  );
} else if (checkpointCheckMode) {
  const checkpoint = await readJsonOr(checkpointPath, emptyCheckpoint());
  const issues = [];
  if (checkpoint.version !== 1) issues.push("checkpoint-version-mismatch");
  const recordsByKey = new Map(
    sourceRecords.map((record) => [record.key, record])
  );
  const translations = checkpoint.translations || {};
  for (const [key, candidate] of Object.entries(translations)) {
    const record = recordsByKey.get(key);
    if (!record) {
      issues.push(`${key}:orphan-translation`);
      continue;
    }
    for (const issue of checkpointTranslationIssues(record, candidate)) {
      issues.push(`${key}:${issue}`);
    }
  }
  for (const keys of writerBiographyDuplicateEnglishGroups(
    sourceRecords,
    translations
  )) {
    issues.push(`duplicate-normalized-english:${keys.join(",")}`);
  }
  if (issues.length) {
    throw new Error(
      `English biography checkpoint failed QA (${issues.length}): ${issues
        .slice(0, 20)
        .join("; ")}`
    );
  }
  const failureCount = Object.keys(checkpoint.failures || {}).length;
  process.stdout.write(
    `Verified ${Object.keys(translations).length} current QA-passing checkpoint translations; ${failureCount} recorded failures; no translation requests were made.\n`
  );
} else if (checkMode) {
  const overlay = await readJsonOr(overlayPath, null);
  const report = await readJsonOr(reportPath, null);
  const issues = [
    ...validateOverlay(sourceRecords, overlay),
    ...validateReport(sourceRecords, overlay, report),
  ];
  if (issues.length) {
    throw new Error(
      `English biography overlay failed QA (${issues.length}): ${issues
        .slice(0, 20)
        .join("; ")}`
    );
  }
  process.stdout.write(
    `Verified ${sourceRecords.length}/${EXPECTED_WRITER_COUNT} two-pass English biographies (${overlay.sourceFingerprint}).\n`
  );
} else {
  const checkpoint = await readJsonOr(checkpointPath, emptyCheckpoint());
  if (checkpoint.version !== 1) {
    throw new Error("Unsupported English biography checkpoint version");
  }
  checkpoint.translations ||= {};
  checkpoint.failures ||= {};
  if (sampleSize === 0 && limit === 0) {
    const invalidated = invalidateDuplicateCheckpointTranslations(
      sourceRecords,
      checkpoint
    );
    if (invalidated.length) {
      await writeCheckpoint(checkpoint);
      for (const item of invalidated) {
        process.stderr.write(
          `[retry] ${item.key}: duplicated ${item.duplicateOf} in checkpoint\n`
        );
      }
    }
  }
  const selection = selectedRecords(sourceRecords);
  const failures = await translateSelected(selection, checkpoint);
  if (failures.length === 0 && sampleSize === 0 && limit === 0) {
    failures.push(
      ...(await repairNewDuplicateTranslations(sourceRecords, checkpoint))
    );
  }
  const currentCount = sourceRecords.filter((record) =>
    validCheckpointTranslation(record, checkpoint.translations[record.key])
  ).length;
  process.stdout.write(
    `Checkpoint contains ${currentCount}/${EXPECTED_WRITER_COUNT} current QA-passing translations; this run had ${failures.length} failures.\n`
  );

  if (failures.length) process.exitCode = 1;
  if (writeMode && sampleSize === 0 && limit === 0 && failures.length === 0) {
    const overlay = buildOverlay(sourceRecords, checkpoint);
    const issues = validateOverlay(sourceRecords, overlay);
    if (issues.length) {
      throw new Error(`Generated overlay failed QA: ${issues.slice(0, 20).join("; ")}`);
    }
    const report = buildReport(sourceRecords, overlay, checkpoint, issues);
    const reportIssues = validateReport(sourceRecords, overlay, report);
    if (reportIssues.length) {
      throw new Error(
        `Generated English audit failed QA: ${reportIssues
          .slice(0, 20)
          .join("; ")}`
      );
    }
    await mkdir(path.dirname(overlayPath), { recursive: true });
    await mkdir(path.dirname(reportPath), { recursive: true });
    await writeFile(overlayPath, stableJson(overlay), "utf8");
    await writeFile(reportPath, stableJson(report), "utf8");
    process.stdout.write(`Wrote ${overlayPath} and ${reportPath}.\n`);
  }
}
