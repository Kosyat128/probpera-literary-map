import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  writerBiographyDuplicateRussianGroups,
  writerBiographyRussianEditorialQaIssues,
} from "./lib/writer-biography-english-qa.mjs";
import {
  RUSSIAN_EDITORIAL_REVIEWER_MODEL,
  RUSSIAN_EDITORIAL_TRANSLATOR_MODEL,
  russianEditorialAllowedContext,
  russianEditorialRefinementProvenanceIssues,
  russianEditorialSourcePayload,
} from "./lib/writer-biography-russian-editorial-contract.mjs";
import { trustedLoopbackOrigin } from "./lib/trusted-server-url.mjs";

const EXPECTED_REFINEMENT_COUNT = 0;

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const inputPath = path.join(
  projectRoot,
  "reports",
  "writer-biography-russian-editorial-input.json"
);
const outputPath = path.join(
  projectRoot,
  "src",
  "data",
  "countries",
  "generated",
  "writerBiographyRussianEditorialRefinements.generated.json"
);
const checkpointPath = path.join(
  projectRoot,
  "scripts",
  ".cache",
  "writer-biography-russian-editorial.checkpoint.json"
);
const reportPath = path.join(
  projectRoot,
  "reports",
  "writer-biography-russian-editorial-audit.json"
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
const sourceCheckMode = process.argv.includes("--source-check");
const writeMode = process.argv.includes("--write");
const transferConfirmed = process.argv.includes(
  "--confirm-cloudflare-public-data-transfer"
);
const endpointArgument = String(argumentValue("endpoint") || "").replace(/\/$/u, "");
const endpoint = endpointArgument ? trustedLoopbackOrigin(endpointArgument) : "";
const concurrency = integerArgument("concurrency", 4, 1, 8);
const sampleSize = integerArgument("sample", 0, 0, 100);
const maxAttempts = integerArgument("attempts", 3, 1, 5);

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function expectedSourceHash(record) {
  return sha256(JSON.stringify(russianEditorialSourcePayload(record)));
}

async function readJson(valuePath) {
  return JSON.parse(await readFile(valuePath, "utf8"));
}

async function readOptionalJson(valuePath) {
  try {
    return await readJson(valuePath);
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function readCheckpoint() {
  try {
    return await readJson(checkpointPath);
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return { version: 1, updatedAt: null, refinements: {}, failures: {} };
    }
    throw error;
  }
}

function validateInput(input) {
  if (!input || typeof input !== "object" || input.version !== 1) {
    throw new Error("Invalid Russian editorial input version");
  }
  if (!input.sourceFingerprint || !Array.isArray(input.records)) {
    throw new Error("Russian editorial input is incomplete");
  }
  if (input.records.length !== EXPECTED_REFINEMENT_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_REFINEMENT_COUNT} Russian editorial records, received ${input.records.length}`
    );
  }
  const actualFingerprint = `sha256:${sha256(JSON.stringify(input.records))}`;
  if (input.sourceFingerprint !== actualFingerprint) {
    throw new Error("Russian editorial input fingerprint mismatch");
  }
  if (
    JSON.stringify(input.invariants?.evidenceFromVerdicts) !==
      JSON.stringify(["supported", "corrected"]) ||
    input.invariants?.notEstablishedClaims !== 0 ||
    input.invariants?.editorialServiceClaims !== 0 ||
    input.invariants?.editorialServiceEvidence !== 0 ||
    input.invariants?.rawSourcePageTextIncluded !== false
  ) {
    throw new Error("Russian editorial input safety invariants are not satisfied");
  }
  const keys = new Set();
  for (const record of input.records) {
    if (
      !record ||
      typeof record.key !== "string" ||
      typeof record.writerName !== "string" ||
      !record.writerName.trim() ||
      typeof record.reviewedTextRu !== "string" ||
      !Array.isArray(record.claims) ||
      !Array.isArray(record.evidence)
    ) {
      throw new Error("Russian editorial input contains an invalid record");
    }
    if (keys.has(record.key)) throw new Error(`Duplicate key: ${record.key}`);
    keys.add(record.key);
    const actualHash = expectedSourceHash(record);
    if (record.expectedSourceHash !== actualHash) {
      throw new Error(`${record.key}: expectedSourceHash mismatch`);
    }
    for (const claim of record.claims) {
      if (
        !claim ||
        !claim.textRu ||
        !new Set(["supported", "corrected"]).has(claim.verdict)
      ) {
        throw new Error(`${record.key}: invalid reviewed claim`);
      }
    }
    for (const evidence of record.evidence) {
      if (
        !evidence ||
        !evidence.provider ||
        !/^https:\/\//iu.test(evidence.url || "") ||
        !evidence.checkedAt ||
        !evidence.findingRu
      ) {
        throw new Error(`${record.key}: invalid evidence`);
      }
    }
  }
  return input.records.slice().sort((left, right) =>
    left.key.localeCompare(right.key, "en")
  );
}

function publicRefinementIssues(record, refinement) {
  const issues = [];
  if (!refinement || typeof refinement !== "object") return ["missing-refinement"];
  if (refinement.expectedSourceHash !== record.expectedSourceHash) {
    issues.push("stale-source-hash");
  }
  issues.push(...russianEditorialRefinementProvenanceIssues(refinement));
  if (!refinement.generatedAt || !refinement.reviewedAt) {
    issues.push("missing-review-timestamp");
  }
  return [
    ...issues,
    ...writerBiographyRussianEditorialQaIssues({
      sourceText: record.reviewedTextRu,
      allowedContext: russianEditorialAllowedContext(record),
      writerName: record.writerName,
      russianText: refinement.text,
    }),
  ];
}

function checkpointRefinementIssues(record, refinement) {
  const issues = publicRefinementIssues(record, refinement);
  if (!refinement?.pass1Text) issues.push("missing-pass1-audit-text");
  if (!Object.hasOwn(refinement || {}, "translatorRequestId")) {
    issues.push("missing-translator-request-id-field");
  }
  if (!Object.hasOwn(refinement || {}, "reviewerRequestId")) {
    issues.push("missing-reviewer-request-id-field");
  }
  if (!refinement?.usage || typeof refinement.usage !== "object") {
    issues.push("missing-usage-audit");
  } else {
    for (const field of [
      "inputTokens",
      "outputTokens",
      "reviewInputTokens",
      "reviewOutputTokens",
    ]) {
      if (!Object.hasOwn(refinement.usage, field)) {
        issues.push(`missing-usage-${field}`);
      }
    }
  }
  return issues;
}

function invalidateDuplicateCheckpointRefinements(records, checkpoint) {
  const validRefinements = {};
  for (const record of records) {
    const candidate = checkpoint.refinements[record.key];
    if (checkpointRefinementIssues(record, candidate).length === 0) {
      validRefinements[record.key] = candidate;
    }
  }
  const invalidated = [];
  for (const keys of writerBiographyDuplicateRussianGroups(
    records,
    validRefinements
  )) {
    for (const key of keys.slice(1)) {
      delete checkpoint.refinements[key];
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

function validateLocalEndpoint() {
  let value;
  try {
    value = new URL(endpoint);
  } catch {
    throw new Error("A local preview --endpoint=http://127.0.0.1:PORT is required");
  }
  if (
    !new Set(["127.0.0.1", "localhost", "::1"]).has(value.hostname) ||
    !new Set(["http:", "https:"]).has(value.protocol)
  ) {
    throw new Error("Editorial endpoint must be a local Wrangler preview proxy");
  }
  if (!transferConfirmed) {
    throw new Error(
      "Cloudflare data-transfer confirmation flag is required after informed user consent"
    );
  }
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function requestRefinement(record) {
  const response = await fetch(`${endpoint}/ru`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(record),
    signal: AbortSignal.timeout(360_000),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && payload.error
        ? String(payload.error)
        : `HTTP ${response.status}`;
    throw new Error(message.slice(0, 1_000));
  }
  if (!payload || typeof payload !== "object" || payload.key !== record.key) {
    throw new Error("Editorial worker returned an invalid identity");
  }
  if (payload.expectedSourceHash !== record.expectedSourceHash) {
    throw new Error("Editorial worker returned a stale source SHA");
  }
  const generatedAt = new Date().toISOString();
  const refinement = {
    text: String(payload.value?.text || "").replace(/\s+/gu, " ").trim(),
    expectedSourceHash: record.expectedSourceHash,
    pass1Text: String(payload.pass1Text || "").replace(/\s+/gu, " ").trim(),
    reviewedAt: generatedAt.slice(0, 10),
    reviewerModel: String(payload.reviewerModel || ""),
    generatedAt,
    translatorModel: String(payload.translatorModel || ""),
    translatorRequestId: payload.translatorRequestId || null,
    reviewerRequestId: payload.reviewerRequestId || null,
    usage: {
      inputTokens: payload.inputTokens ?? null,
      outputTokens: payload.outputTokens ?? null,
      reviewInputTokens: payload.reviewInputTokens ?? null,
      reviewOutputTokens: payload.reviewOutputTokens ?? null,
    },
  };
  const issues = checkpointRefinementIssues(record, refinement);
  if (issues.length) throw new Error(`postflight QA: ${issues.join(", ")}`);
  return refinement;
}

async function processRecords(records, checkpoint) {
  validateLocalEndpoint();
  let cursor = 0;
  let completed = 0;
  let writeQueue = Promise.resolve();
  const failures = [];
  const persist = () => {
    writeQueue = writeQueue.then(async () => {
      checkpoint.updatedAt = new Date().toISOString();
      await mkdir(path.dirname(checkpointPath), { recursive: true });
      await writeFile(checkpointPath, stableJson(checkpoint), "utf8");
    });
    return writeQueue;
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, records.length) }, async () => {
      while (cursor < records.length) {
        const record = records[cursor++];
        if (
          checkpointRefinementIssues(record, checkpoint.refinements[record.key])
            .length === 0
        ) {
          completed += 1;
          continue;
        }
        let lastError = null;
        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
          try {
            checkpoint.refinements[record.key] = await requestRefinement(record);
            delete checkpoint.failures[record.key];
            await persist();
            completed += 1;
            process.stdout.write(
              `[${completed}/${records.length}] ${record.key} Russian review passed\n`
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
            expectedSourceHash: record.expectedSourceHash,
            error: lastError.message.slice(0, 1_000),
            failedAt: new Date().toISOString(),
          };
          checkpoint.failures[record.key] = failure;
          failures.push(failure);
          await persist();
          process.stderr.write(`[failed] ${record.key}: ${failure.error}\n`);
        }
      }
    })
  );
  await writeQueue;
  return failures;
}

function buildOutput(input, records, checkpoint) {
  const refinements = {};
  for (const record of records) {
    const checkpointRecord = checkpoint.refinements[record.key];
    const issues = checkpointRefinementIssues(record, checkpointRecord);
    if (issues.length) {
      throw new Error(`${record.key}: ${issues.join(", ")}`);
    }
    refinements[record.key] = {
      text: checkpointRecord.text,
      expectedSourceHash: checkpointRecord.expectedSourceHash,
      reviewedAt: checkpointRecord.reviewedAt,
      reviewerModel: checkpointRecord.reviewerModel,
      translatorModel: checkpointRecord.translatorModel,
      generatedAt: checkpointRecord.generatedAt,
    };
  }
  const firstRefinement = Object.values(refinements)[0];
  return {
    version: 1,
    inputFingerprint: input.sourceFingerprint,
    translatorModel:
      firstRefinement?.translatorModel || RUSSIAN_EDITORIAL_TRANSLATOR_MODEL,
    reviewerModel:
      firstRefinement?.reviewerModel || RUSSIAN_EDITORIAL_REVIEWER_MODEL,
    refinementCount: records.length,
    refinements,
  };
}

function outputIssues(input, records, output) {
  const issues = [];
  if (!output || output.version !== 1) issues.push("output-version-mismatch");
  if (output?.inputFingerprint !== input.sourceFingerprint) {
    issues.push("input-fingerprint-mismatch");
  }
  if (output?.refinementCount !== records.length) {
    issues.push("refinement-count-mismatch");
  }
  if (output?.translatorModel !== RUSSIAN_EDITORIAL_TRANSLATOR_MODEL) {
    issues.push("output-translator-model-mismatch");
  }
  if (output?.reviewerModel !== RUSSIAN_EDITORIAL_REVIEWER_MODEL) {
    issues.push("output-reviewer-model-mismatch");
  }
  for (const record of records) {
    const refinement = output?.refinements?.[record.key];
    for (const issue of publicRefinementIssues(record, refinement)) {
      issues.push(`${record.key}:${issue}`);
    }
    for (const field of [
      "pass1Text",
      "translatorRequestId",
      "reviewerRequestId",
      "usage",
    ]) {
      if (Object.hasOwn(refinement || {}, field)) {
        issues.push(`${record.key}:public-overlay-contains-${field}`);
      }
    }
  }
  for (const key of Object.keys(output?.refinements || {})) {
    if (!records.some((record) => record.key === key)) {
      issues.push(`${key}:orphan-refinement`);
    }
  }
  for (const keys of writerBiographyDuplicateRussianGroups(
    records,
    output?.refinements || {}
  )) {
    issues.push(`duplicate-normalized-russian:${keys.join(",")}`);
  }
  return issues;
}

function buildAuditReport(input, records, checkpoint, outputIssuesList) {
  const recordsByKey = {};
  for (const record of records) {
    const checkpointRecord = checkpoint.refinements[record.key];
    const issues = checkpointRefinementIssues(record, checkpointRecord);
    if (issues.length) {
      throw new Error(`${record.key}: ${issues.join(", ")}`);
    }
    recordsByKey[record.key] = {
      expectedSourceHash: checkpointRecord.expectedSourceHash,
      finalText: checkpointRecord.text,
      pass1Text: checkpointRecord.pass1Text,
      generatedAt: checkpointRecord.generatedAt,
      reviewedAt: checkpointRecord.reviewedAt,
      translatorModel: checkpointRecord.translatorModel,
      reviewerModel: checkpointRecord.reviewerModel,
      translatorRequestId: checkpointRecord.translatorRequestId,
      reviewerRequestId: checkpointRecord.reviewerRequestId,
      usage: checkpointRecord.usage,
    };
  }
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    inputFingerprint: input.sourceFingerprint,
    candidateCount: records.length,
    publishedRefinementCount: records.length,
    issueCount: outputIssuesList.length,
    translatorModel: RUSSIAN_EDITORIAL_TRANSLATOR_MODEL,
    reviewerModel: RUSSIAN_EDITORIAL_REVIEWER_MODEL,
    issues: outputIssuesList,
    records: recordsByKey,
  };
}

function auditReportIssues(input, records, report, output) {
  const issues = [];
  if (!report || report.version !== 1) issues.push("audit-version-mismatch");
  if (report?.inputFingerprint !== input.sourceFingerprint) {
    issues.push("audit-input-fingerprint-mismatch");
  }
  if (report?.candidateCount !== records.length) {
    issues.push("audit-candidate-count-mismatch");
  }
  if (report?.publishedRefinementCount !== records.length) {
    issues.push("audit-published-count-mismatch");
  }
  if (report?.translatorModel !== RUSSIAN_EDITORIAL_TRANSLATOR_MODEL) {
    issues.push("audit-translator-model-mismatch");
  }
  if (report?.reviewerModel !== RUSSIAN_EDITORIAL_REVIEWER_MODEL) {
    issues.push("audit-reviewer-model-mismatch");
  }
  if (!report?.generatedAt) issues.push("audit-generated-at-missing");
  if (report?.issueCount !== 0 || !Array.isArray(report?.issues) || report.issues.length) {
    issues.push("audit-declares-qa-issues");
  }
  for (const record of records) {
    const auditRecord = report?.records?.[record.key];
    for (const issue of checkpointRefinementIssues(
      record,
      auditRecord ? { ...auditRecord, text: auditRecord.finalText } : auditRecord
    )) {
      issues.push(`${record.key}:${issue}`);
    }
    const publicRecord = output?.refinements?.[record.key];
    if (
      auditRecord &&
      publicRecord &&
      (auditRecord.finalText !== publicRecord.text ||
        auditRecord.expectedSourceHash !== publicRecord.expectedSourceHash ||
        auditRecord.generatedAt !== publicRecord.generatedAt ||
        auditRecord.reviewedAt !== publicRecord.reviewedAt ||
        auditRecord.translatorModel !== publicRecord.translatorModel ||
        auditRecord.reviewerModel !== publicRecord.reviewerModel)
    ) {
      issues.push(`${record.key}:public-audit-mismatch`);
    }
  }
  for (const key of Object.keys(report?.records || {})) {
    if (!records.some((record) => record.key === key)) {
      issues.push(`${key}:orphan-audit-record`);
    }
  }
  return issues;
}

const input = await readJson(inputPath);
const records = validateInput(input);

if (sourceCheckMode) {
  process.stdout.write(
    `Verified Russian editorial input: ${records.length} SHA-pinned records (${input.sourceFingerprint}).\n`
  );
} else if (checkMode) {
  if (records.length === 0) {
    const [staleOutput, staleAuditReport] = await Promise.all([
      readOptionalJson(outputPath),
      readOptionalJson(reportPath),
    ]);
    if (staleOutput || staleAuditReport) {
      throw new Error(
        "Russian editorial refinements are locally complete, but stale external-refinement artifacts remain"
      );
    }
    process.stdout.write(
      "Verified local-only Russian editorial state: 0 external refinements.\n"
    );
  } else {
    const output = await readJson(outputPath);
    const auditReport = await readJson(reportPath);
    const issues = [
      ...outputIssues(input, records, output),
      ...auditReportIssues(input, records, auditReport, output),
    ];
    if (issues.length) {
      throw new Error(
        `Russian editorial refinements failed QA (${issues.length}): ${issues
          .slice(0, 20)
          .join("; ")}`
      );
    }
    process.stdout.write(
      `Verified ${records.length} Russian two-pass editorial refinements.\n`
    );
  }
} else {
  if (records.length === 0 && writeMode) {
    throw new Error(
      "Russian editorial refinements are locally complete; no external output should be written"
    );
  }
  const checkpoint = await readCheckpoint();
  if (checkpoint.version !== 1) throw new Error("Unsupported checkpoint version");
  checkpoint.refinements ||= {};
  checkpoint.failures ||= {};
  if (sampleSize === 0) {
    const invalidated = invalidateDuplicateCheckpointRefinements(
      records,
      checkpoint
    );
    if (invalidated.length) {
      await mkdir(path.dirname(checkpointPath), { recursive: true });
      checkpoint.updatedAt = new Date().toISOString();
      await writeFile(checkpointPath, stableJson(checkpoint), "utf8");
      for (const item of invalidated) {
        process.stderr.write(
          `[retry] ${item.key}: duplicated ${item.duplicateOf} in Russian checkpoint\n`
        );
      }
    }
  }
  const selection = spreadSample(records, sampleSize);
  const failures = await processRecords(selection, checkpoint);
  const current = records.filter(
    (record) =>
      checkpointRefinementIssues(record, checkpoint.refinements[record.key])
        .length === 0
  ).length;
  process.stdout.write(
    `Checkpoint contains ${current}/${records.length} current Russian refinements; this run had ${failures.length} failures.\n`
  );
  if (failures.length) process.exitCode = 1;
  if (writeMode && sampleSize === 0 && failures.length === 0) {
    const output = buildOutput(input, records, checkpoint);
    const issues = outputIssues(input, records, output);
    if (issues.length) throw new Error(issues.slice(0, 20).join("; "));
    await mkdir(path.dirname(outputPath), { recursive: true });
    await mkdir(path.dirname(reportPath), { recursive: true });
    await writeFile(outputPath, stableJson(output), "utf8");
    await writeFile(
      reportPath,
      stableJson(buildAuditReport(input, records, checkpoint, issues)),
      "utf8"
    );
    process.stdout.write(`Wrote ${outputPath} and ${reportPath}.\n`);
  }
}
