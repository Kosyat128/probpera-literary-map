import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

function fail(message) {
  throw new Error(message);
}

function parseBatch(value) {
  const batch = Number(value);
  if (!Number.isInteger(batch) || batch < 1 || batch > 99) {
    fail("batch must be an integer between 1 and 99");
  }
  return batch;
}

function readRecords(inputPath) {
  const parsed = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const records = Array.isArray(parsed) ? parsed : parsed.records;
  if (!Array.isArray(records)) fail(`Research payload is not an array: ${inputPath}`);
  return records;
}

function sha256(value) {
  return createHash("sha256").update(Buffer.from(value, "utf8")).digest("hex");
}

function q(value) {
  return JSON.stringify(value);
}

function renderReviewModule(batch, checkedAt, records) {
  const suffix = String(batch).padStart(2, "0");
  const lines = [
    `export const WRITER_BIOGRAPHY_FACT_REVIEW_BATCH${suffix}_REVIEWER =`,
    `  "Codex independent claim-by-claim factual review, batch ${batch}";`,
    "",
    'export type WriterBiographyFactReviewDecision = "unchanged" | "corrected" | "held";',
    'export type WriterBiographyClaimVerdict = "supported" | "corrected" | "not-established";',
    "",
    "export interface WriterBiographyClaimEvidence {",
    "  readonly provider: string;",
    "  readonly url: string;",
    "  readonly checkedAt: string;",
    "  readonly findingRu: string;",
    "}",
    "",
    "export interface WriterBiographyFactReviewClaim {",
    "  readonly textRu: string;",
    "  readonly verdict: WriterBiographyClaimVerdict;",
    "  readonly evidence: readonly WriterBiographyClaimEvidence[];",
    "}",
    "",
    "export interface WriterBiographyFactReviewRecord {",
    "  readonly key: string;",
    "  readonly originalSha256: string;",
    "  readonly reviewedTextRu: string;",
    "  readonly applicableTextRu: string | null;",
    "  readonly claims: readonly WriterBiographyFactReviewClaim[];",
    "  readonly reviewer: string;",
    "  readonly decision: WriterBiographyFactReviewDecision;",
    "  readonly notes: string;",
    "}",
    "",
    `const reviewer = WRITER_BIOGRAPHY_FACT_REVIEW_BATCH${suffix}_REVIEWER;`,
    `const checkedAt = ${q(checkedAt)};`,
    "",
    "type EvidenceSeed = readonly [provider: string, url: string, findingRu: string];",
    "",
    "interface ReviewSeed {",
    "  readonly key: string;",
    "  readonly originalSha256: string;",
    "  readonly reviewedTextRu: string;",
    "  readonly evidence: readonly EvidenceSeed[];",
    "  readonly decision: WriterBiographyFactReviewDecision;",
    "  readonly notes: string;",
    "}",
    "",
    "function e(provider: string, url: string, findingRu: string): EvidenceSeed {",
    "  return [provider, url, findingRu];",
    "}",
    "",
    "const seeds: readonly ReviewSeed[] = [",
  ];

  for (const record of records) {
    lines.push("  {");
    lines.push(`    key: ${q(record.key)},`);
    lines.push(`    originalSha256: ${q(record.originalSha256)},`);
    lines.push(`    reviewedTextRu: ${q(record.reviewedTextRu)},`);
    lines.push("    evidence: [");
    for (const evidence of record.evidence) {
      lines.push(
        `      e(${q(evidence.provider)}, ${q(evidence.url)}, ${q(evidence.findingRu)}),`
      );
    }
    lines.push("    ],");
    lines.push(`    decision: ${q(record.decision)},`);
    lines.push(`    notes: ${q(record.notes)},`);
    lines.push("  },");
  }

  lines.push(
    "];",
    "",
    `export const writerBiographyFactReviewBatch${suffix}: readonly WriterBiographyFactReviewRecord[] = seeds.map(`,
    "  (seed) => {",
    "    const verdict: WriterBiographyClaimVerdict =",
    '      seed.decision === "held"',
    '        ? "not-established"',
    '        : seed.decision === "unchanged"',
    '          ? "supported"',
    '          : "corrected";',
    "    return {",
    "      key: seed.key,",
    "      originalSha256: seed.originalSha256,",
    "      reviewedTextRu: seed.reviewedTextRu,",
    '      applicableTextRu: seed.decision === "held" ? null : seed.reviewedTextRu,',
    "      claims: [",
    "        {",
    "          textRu: seed.reviewedTextRu,",
    "          verdict,",
    "          evidence: seed.evidence.map(([provider, url, findingRu]) => ({",
    "            provider,",
    "            url,",
    "            checkedAt,",
    "            findingRu,",
    "          })),",
    "        },",
    "      ],",
    "      reviewer,",
    "      decision: seed.decision,",
    "      notes: seed.notes,",
    "    };",
    "  }",
    ");",
    ""
  );
  return lines.join("\n");
}

function renderProfileCorrections(batch, checkedAt, records) {
  const suffix = String(batch).padStart(2, "0");
  const corrected = records.filter(
    (record) =>
      record.profileCorrections &&
      typeof record.profileCorrections === "object" &&
      Object.keys(record.profileCorrections).length > 0
  );
  const lines = [
    'import type { WriterProfile } from "./types";',
    "",
    `export type WriterPublicProfileFactCorrectionBatch${suffix} = {`,
    "  countryId: string;",
    "  writerId: string;",
    "  patch: Partial<WriterProfile>;",
    "  evidence: Array<{ provider: string; url: string; checkedAt: string }>;",
    "  note: string;",
    "};",
    "",
    `const checkedAt = ${q(checkedAt)};`,
    "",
    "function sources(",
    "  ...items: ReadonlyArray<readonly [provider: string, url: string]>",
    ") {",
    "  return items.map(([provider, url]) => ({ provider, url, checkedAt }));",
    "}",
    "",
    "function correction(",
    "  countryId: string,",
    "  writerId: string,",
    "  patch: Partial<WriterProfile>,",
    "  evidence: ReturnType<typeof sources>,",
    "  note: string",
    `): WriterPublicProfileFactCorrectionBatch${suffix} {`,
    "  return { countryId, writerId, patch, evidence, note };",
    "}",
    "",
    `export const writerBiographyPublicProfileFactCorrectionsBatch${suffix} = [`,
  ];

  for (const record of corrected) {
    const [countryId, writerId] = record.key.split(":");
    lines.push("  correction(");
    lines.push(`    ${q(countryId)},`);
    lines.push(`    ${q(writerId)},`);
    lines.push(`    ${JSON.stringify(record.profileCorrections, null, 2).replaceAll("\n", "\n    ")},`);
    lines.push("    sources(");
    for (const evidence of record.evidence) {
      lines.push(`      [${q(evidence.provider)}, ${q(evidence.url)}],`);
    }
    lines.push("    ),");
    lines.push(`    ${q(record.notes)}`);
    lines.push("  ),");
  }

  lines.push(
    `] satisfies readonly WriterPublicProfileFactCorrectionBatch${suffix}[];`,
    ""
  );
  return lines.join("\n");
}

function renderTestModule(batch, checkedAt) {
  const suffix = String(batch).padStart(2, "0");
  return [
    'import { defineWriterBiographyFactReviewBatchTests } from "./writerBiographyFactReviewBatch.generated-test-support";',
    "import {",
    `  WRITER_BIOGRAPHY_FACT_REVIEW_BATCH${suffix}_REVIEWER,`,
    `  writerBiographyFactReviewBatch${suffix},`,
    `} from "./writerBiographyFactReviewBatch${suffix}";`,
    `import { writerBiographyPublicProfileFactCorrectionsBatch${suffix} } from "./writerBiographyPublicProfileFactCorrectionsBatch${suffix}";`,
    "",
    "defineWriterBiographyFactReviewBatchTests({",
    `  batch: ${batch},`,
    `  generatedAt: ${q(checkedAt)},`,
    `  reviewer: WRITER_BIOGRAPHY_FACT_REVIEW_BATCH${suffix}_REVIEWER,`,
    `  records: writerBiographyFactReviewBatch${suffix},`,
    `  profileCorrections: writerBiographyPublicProfileFactCorrectionsBatch${suffix},`,
    "});",
    "",
  ].join("\n");
}

const [batchArg, checkedAt, ...inputArgs] = process.argv.slice(2);
const batch = parseBatch(batchArg);
if (!checkedAt || !/^\d{4}-\d{2}-\d{2}$/.test(checkedAt)) {
  fail("checkedAt must use YYYY-MM-DD");
}
if (inputArgs.length === 0) fail("at least one research JSON path is required");

const records = inputArgs.flatMap((inputPath) => readRecords(path.resolve(inputPath)));
if (records.length === 0) fail("research payload has no records");
const keys = records.map((record) => record.key);
if (new Set(keys).size !== keys.length) fail("research keys are not unique");

const factQa = JSON.parse(
  fs.readFileSync(path.resolve("reports/writer-biography-fact-qa.json"), "utf8")
);
const qaHashes = new Map(
  factQa.records.map((record) => [record.key, record.biography?.sha256])
);
const subjectiveSuperlative =
  /(?:крупнейш|величайш|сам(?:ый|ая|ое|ые|ых)|наиболее|великий|ведущ|важнейш|главнейш|известнейш|одн(?:а|о|им|их)?\s+из\s+(?:главн|ведущ|важнейш|заметн))/iu;

for (const record of records) {
  if (!record || typeof record !== "object") fail("research record must be an object");
  if (typeof record.key !== "string" || !record.key.includes(":")) fail("invalid key");
  if (!/^[a-f0-9]{64}$/.test(record.originalSha256)) fail(`invalid SHA: ${record.key}`);
  if (qaHashes.get(record.key) !== record.originalSha256) fail(`QA SHA mismatch: ${record.key}`);
  if (!['unchanged', 'corrected', 'held'].includes(record.decision)) fail(`invalid decision: ${record.key}`);
  if (typeof record.reviewedTextRu !== "string" || record.reviewedTextRu.trim().length <= 35) {
    fail(`reviewed text is too short: ${record.key}`);
  }
  const sentenceCount = record.reviewedTextRu.match(/[.!?…]+(?=\s+[А-ЯЁ]|$)/gu)?.length ?? 0;
  if (sentenceCount < 1 || sentenceCount > 2) fail(`reviewed text must have 1-2 sentences: ${record.key}`);
  if (subjectiveSuperlative.test(record.reviewedTextRu)) fail(`subjective language: ${record.key}`);
  if (typeof record.notes !== "string" || record.notes.trim() === "") fail(`missing notes: ${record.key}`);
  if (!Array.isArray(record.evidence) || record.evidence.length < 2) fail(`insufficient evidence: ${record.key}`);
  const hostnames = new Set();
  for (const evidence of record.evidence) {
    const parsed = new URL(evidence.url);
    if (parsed.protocol !== "https:") fail(`non-HTTPS evidence: ${record.key}`);
    if (/(^|\.)(?:wikipedia|wikidata)\.org$/i.test(parsed.hostname)) fail(`blocked evidence: ${record.key}`);
    if (!/[А-Яа-яЁё]/u.test(evidence.findingRu ?? "")) fail(`non-Russian finding: ${record.key}`);
    hostnames.add(parsed.hostname);
  }
  if (hostnames.size < 2) fail(`evidence domains are not independent: ${record.key}`);
  const reviewedHash = sha256(record.reviewedTextRu);
  if (record.decision === "unchanged" && reviewedHash !== record.originalSha256) {
    fail(`unchanged text differs from source: ${record.key}`);
  }
  if (record.decision === "corrected" && reviewedHash === record.originalSha256) {
    fail(`corrected text equals source: ${record.key}`);
  }
}

const suffix = String(batch).padStart(2, "0");
const countriesDir = path.resolve("src/data/countries");
const reviewPath = path.join(countriesDir, `writerBiographyFactReviewBatch${suffix}.ts`);
const correctionsPath = path.join(
  countriesDir,
  `writerBiographyPublicProfileFactCorrectionsBatch${suffix}.ts`
);
const testPath = path.join(
  countriesDir,
  `writerBiographyFactReviewBatch${suffix}.test.ts`
);
fs.writeFileSync(reviewPath, renderReviewModule(batch, checkedAt, records), "utf8");
fs.writeFileSync(correctionsPath, renderProfileCorrections(batch, checkedAt, records), "utf8");
if (!fs.existsSync(testPath)) {
  fs.writeFileSync(testPath, renderTestModule(batch, checkedAt), "utf8");
}
console.log(
  `Generated ${path.relative(process.cwd(), reviewPath)}, ${path.relative(process.cwd(), correctionsPath)} and ${path.relative(process.cwd(), testPath)} (${records.length} records)`
);
