import { createHash } from "node:crypto";
import { readFile, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { build } from "esbuild";

import {
  isStructuredRussianBiographyText,
  isPublishableRussianBiographyClaim,
  isPublishableRussianBiographyEvidence,
  normalizeStructuredRussianBiographyText,
  structuredRussianBiographyAwardRestatementIssues,
  structuredRussianBiographyFromReview,
  structuredRussianBiographyGenderAgreementPattern,
  structuredRussianBiographyLifespanRestatementIssues,
  structuredRussianBiographyRefinementIssues,
  structuredRussianBiographySentenceCount,
  structuredRussianBiographySourceNarrationPattern,
  structuredRussianBiographyTautologyIssues,
  structuredRussianBiographyTechnicalPattern,
} from "./lib/writer-biography-structured-ru.mjs";

const projectRoot = path.resolve(import.meta.dirname, "..");
const cacheDirectory = path.join(projectRoot, "scripts", ".cache");
const editorialInputPath = path.join(
  projectRoot,
  "reports/writer-biography-russian-editorial-input.json",
);
const editorialRefinementPath = path.join(
  projectRoot,
  "src/data/countries/generated/writerBiographyRussianEditorialRefinements.generated.json",
);
const writeEditorialInput = process.argv.includes("--write-editorial-input");

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function loadBundledModule(entryPoint, label) {
  await mkdir(cacheDirectory, { recursive: true });
  const bundlePath = path.join(
    cacheDirectory,
    `writer-biography-structured-ru-${label}-${process.pid}.mjs`,
  );
  await build({
    absWorkingDir: projectRoot,
    entryPoints: [path.join(projectRoot, entryPoint)],
    bundle: true,
    platform: "node",
    packages: "external",
    format: "esm",
    target: "node22",
    outfile: bundlePath,
    logLevel: "silent",
  });
  try {
    return await import(`${pathToFileURL(bundlePath).href}?v=${Date.now()}`);
  } finally {
    await rm(bundlePath, { force: true });
  }
}

const reviewModule = await loadBundledModule(
  "scripts/writer-biography-review-source.ts",
  "reviews",
);
const countryModule = await loadBundledModule(
  "src/data/countries/index.ts",
  "countries",
);
const editorialOverrides = JSON.parse(
  await readFile(
    path.join(
      projectRoot,
      "src/data/countries/writerBiographyStructuredRuEditorial.json",
    ),
    "utf8",
  ),
);

const records = reviewModule.writerBiographyFactReviews;
const quarantinedKeys = new Set(
  reviewModule.writerBiographyFactReviewQuarantinedKeys,
);
const publicKeys = new Set(
  countryModule.countries.flatMap((country) =>
    country.writers.map((writer) => `${country.id}:${writer.id}`),
  ),
);
const publicWriterByKey = new Map(
  countryModule.countries.flatMap((country) =>
    country.writers.map((writer) => [`${country.id}:${writer.id}`, writer]),
  ),
);
const applicable = records.filter(
  (record) =>
    record.decision !== "held" &&
    !quarantinedKeys.has(record.key) &&
    publicKeys.has(record.key),
);
const reviewedKeys = new Set(applicable.map((record) => record.key));
const outsideFactReviewOverlayKeys = [...publicKeys].filter(
  (key) => !reviewedKeys.has(key),
);
const supplementalVerifiedPublicKeys = outsideFactReviewOverlayKeys.filter(
  (key) =>
    publicWriterByKey.get(key)?.biographyTranslations?.ru?.status ===
    "verified",
);
const publicMissingRecord = outsideFactReviewOverlayKeys.filter(
  (key) => !supplementalVerifiedPublicKeys.includes(key),
);
const supplementalEvidenceByRecord = supplementalVerifiedPublicKeys.map(
  (key) => {
    const sources = publicWriterByKey.get(key)?.editorial?.sources || [];
    const urls = sources.map((source) => source.url);
    return {
      key,
      sources: new Set(urls).size,
      hostnames: new Set(urls.map((url) => new URL(url).hostname.toLowerCase()))
        .size,
      nonHttps: urls.filter((url) => !String(url).startsWith("https://"))
        .length,
      missingPublisher: sources.filter(
        (source) => !String(source.publisher || "").trim(),
      ).length,
    };
  },
);
const sourceEvidence = applicable.flatMap((record) =>
  record.claims.flatMap((claim) => claim.evidence),
);
const evidenceByRecord = applicable.map((record) => {
  const evidence = record.claims.flatMap((claim) => claim.evidence);
  return {
    key: record.key,
    sources: new Set(evidence.map((item) => item.url)).size,
    hostnames: new Set(
      evidence.map((item) => new URL(item.url).hostname.toLowerCase()),
    ).size,
  };
});
const publicationEvidenceByRecord = applicable.map((record) => {
  const evidence = record.claims
    .filter((claim) => new Set(["supported", "corrected"]).has(claim.verdict))
    .flatMap((claim) => claim.evidence);
  return {
    key: record.key,
    sources: new Set(evidence.map((item) => item.url)).size,
    hostnames: new Set(
      evidence.map((item) => new URL(item.url).hostname.toLowerCase()),
    ).size,
  };
});
const preRefinementStructured = applicable.map((record) => ({
  key: record.key,
  reviewedTextRu: normalizeStructuredRussianBiographyText(
    record.applicableTextRu,
  ),
  ...structuredRussianBiographyFromReview(
    record,
    Object.hasOwn(editorialOverrides, record.key)
      ? editorialOverrides[record.key]
      : undefined,
  ),
}));
const recordByKey = new Map(applicable.map((record) => [record.key, record]));
const orphanEditorialKeys = Object.keys(editorialOverrides).filter(
  (key) => !recordByKey.has(key),
);
const curatedSemanticIssues = Object.entries(editorialOverrides)
  .map(([key, text]) => {
    const record = recordByKey.get(key);
    const writer = publicWriterByKey.get(key);
    if (!record || !writer) return { key, issues: ["orphan-curated-key"] };
    const claims = record.claims
      .filter((claim) => new Set(["supported", "corrected"]).has(claim.verdict))
      .map((claim) => ({
        textRu: normalizeStructuredRussianBiographyText(claim.textRu),
        verdict: claim.verdict,
      }));
    const evidence = record.claims
      .filter((claim) => new Set(["supported", "corrected"]).has(claim.verdict))
      .flatMap((claim) => claim.evidence)
      .map((source) => ({
        provider: source.provider,
        url: source.url,
        checkedAt: source.checkedAt,
        findingRu: source.findingRu,
      }));
    const input = {
      key,
      writerName: writer.name || writer.fullName || writer.id,
      reviewedTextRu: normalizeStructuredRussianBiographyText(
        [
          record.applicableTextRu,
          writer.years,
          writer.birthDate || writer.birth,
          writer.deathDate || writer.death,
          ...(Array.isArray(writer.works) ? writer.works : []),
        ]
          .filter(Boolean)
          .join(" "),
      ),
      claims,
      evidence,
      expectedSourceHash: "curated-local",
    };
    return {
      key,
      issues: structuredRussianBiographyRefinementIssues(input, {
        text,
        expectedSourceHash: input.expectedSourceHash,
      }),
    };
  })
  .filter((item) => item.issues.length > 0);
const editorialInputRecords = preRefinementStructured
  .filter(
    (item) =>
      item.derivation !== "reviewed-text" &&
      item.derivation !== "curated-editorial",
  )
  .map((item) => {
    const record = recordByKey.get(item.key);
    const writer = publicWriterByKey.get(item.key);
    const publishableClaims = record.claims.filter(
      (claim) =>
        new Set(["supported", "corrected"]).has(claim.verdict) &&
        isPublishableRussianBiographyClaim(claim.textRu),
    );
    const claims = publishableClaims.map((claim) => ({
      textRu: normalizeStructuredRussianBiographyText(claim.textRu),
      verdict: claim.verdict,
    }));
    const evidence = publishableClaims
      .flatMap((claim) => claim.evidence)
      .filter((source) =>
        isPublishableRussianBiographyEvidence(source.findingRu),
      )
      .map((source) => ({
        provider: normalizeStructuredRussianBiographyText(source.provider),
        url: source.url,
        checkedAt: source.checkedAt,
        findingRu: normalizeStructuredRussianBiographyText(source.findingRu),
      }));
    const hashInput = {
      key: item.key,
      writerName: writer?.name || writer?.fullName || writer?.id,
      reviewedTextRu: item.reviewedTextRu,
      claims,
      evidence,
    };
    return {
      ...hashInput,
      expectedSourceHash: sha256(JSON.stringify(hashInput)),
    };
  });
const editorialInput = {
  version: 1,
  invariants: {
    evidenceFromVerdicts: ["supported", "corrected"],
    notEstablishedClaims: editorialInputRecords.reduce(
      (total, record) =>
        total +
        record.claims.filter((claim) => claim.verdict === "not-established")
          .length,
      0,
    ),
    editorialServiceClaims: editorialInputRecords.reduce(
      (total, record) =>
        total +
        record.claims.filter(
          (claim) => !isPublishableRussianBiographyClaim(claim.textRu),
        ).length,
      0,
    ),
    editorialServiceEvidence: editorialInputRecords.reduce(
      (total, record) =>
        total +
        record.evidence.filter(
          (evidence) =>
            !isPublishableRussianBiographyEvidence(evidence.findingRu),
        ).length,
      0,
    ),
    rawSourcePageTextIncluded: false,
  },
  sourceFingerprint: `sha256:${sha256(JSON.stringify(editorialInputRecords))}`,
  records: editorialInputRecords,
};
const editorialInputContent = stableJson(editorialInput);
if (writeEditorialInput) {
  await mkdir(path.dirname(editorialInputPath), { recursive: true });
  await writeFile(editorialInputPath, editorialInputContent, "utf8");
}
const existingEditorialInput = writeEditorialInput
  ? editorialInputContent
  : await readFile(editorialInputPath, "utf8").catch(() => null);
const editorialInputIsCurrent =
  existingEditorialInput === editorialInputContent;
const refinementOverlay = JSON.parse(
  await readFile(editorialRefinementPath, "utf8").catch(() =>
    JSON.stringify({
      version: 1,
      inputFingerprint: null,
      refinements: {},
    }),
  ),
);
const refinements = refinementOverlay.refinements || {};
const editorialInputByKey = new Map(
  editorialInput.records.map((record) => [record.key, record]),
);
const localOnlyEditorialState =
  editorialInput.records.length === 0 && Object.keys(refinements).length === 0;
const structured = applicable.map((record) => ({
  key: record.key,
  reviewedTextRu: normalizeStructuredRussianBiographyText(
    record.applicableTextRu,
  ),
  ...structuredRussianBiographyFromReview(
    record,
    Object.hasOwn(editorialOverrides, record.key)
      ? editorialOverrides[record.key]
      : undefined,
    refinements[record.key],
    editorialInputByKey.get(record.key),
  ),
}));
const orphanRefinementKeys = Object.keys(refinements).filter(
  (key) => !editorialInputByKey.has(key),
);
const missingRefinementKeys = editorialInput.records
  .filter((record) => !Object.hasOwn(refinements, record.key))
  .map((record) => record.key);
const rejectedRefinements = structured
  .filter((record) => record.derivation === "blocked-editorial-refinement")
  .map((record) => ({
    key: record.key,
    issues: record.refinementIssues,
  }));
const blockedOffset = Number(
  process.argv
    .find((argument) => argument.startsWith("--offset="))
    ?.slice("--offset=".length) || 0,
);
const blockedLimit = Number(
  process.argv
    .find((argument) => argument.startsWith("--limit="))
    ?.slice("--limit=".length) || 25,
);
const duplicateTextGroups = Object.values(
  Object.groupBy(applicable, (record) =>
    record.applicableTextRu.trim().toLocaleLowerCase("ru"),
  ),
).filter((group) => group.length > 1);

const output = {
  records: records.length,
  applicablePublicRecords: applicable.length,
  publicWriters: publicKeys.size,
  outsideFactReviewOverlayKeys,
  supplementalVerifiedPublicKeys,
  publicMissingRecord,
  supplementalEvidence: {
    records: supplementalEvidenceByRecord.reduce(
      (total, record) => total + record.sources,
      0,
    ),
    recordsWithFewerThanTwoUrls: supplementalEvidenceByRecord
      .filter((record) => record.sources < 2)
      .map((record) => record.key),
    recordsWithFewerThanTwoHosts: supplementalEvidenceByRecord
      .filter((record) => record.hostnames < 2)
      .map((record) => record.key),
    recordsWithNonHttpsSources: supplementalEvidenceByRecord
      .filter((record) => record.nonHttps > 0)
      .map((record) => record.key),
    recordsWithMissingPublisher: supplementalEvidenceByRecord
      .filter((record) => record.missingPublisher > 0)
      .map((record) => record.key),
  },
  evidence: {
    records: sourceEvidence.length,
    fields: [
      ...new Set(sourceEvidence.flatMap((item) => Object.keys(item))),
    ].sort(),
    uniqueProviders: new Set(sourceEvidence.map((item) => item.provider)).size,
    uniqueUrls: new Set(sourceEvidence.map((item) => item.url)).size,
    nonHttps: sourceEvidence.filter(
      (item) => !String(item.url).startsWith("https://"),
    ).length,
    missingProvider: sourceEvidence.filter((item) => !item.provider?.trim())
      .length,
    missingCheckedAt: sourceEvidence.filter((item) => !item.checkedAt?.trim())
      .length,
    recordsWithFewerThanTwoUrls: evidenceByRecord
      .filter((record) => record.sources < 2)
      .map((record) => record.key),
    recordsWithFewerThanTwoHosts: evidenceByRecord
      .filter((record) => record.hostnames < 2)
      .map((record) => record.key),
    publicationRecordsWithFewerThanTwoUrls: publicationEvidenceByRecord
      .filter((record) => record.sources < 2)
      .map((record) => record.key),
    publicationRecordsWithFewerThanTwoHosts: publicationEvidenceByRecord
      .filter((record) => record.hostnames < 2)
      .map((record) => record.key),
  },
  textGate: {
    below120: applicable.filter(
      (record) => record.applicableTextRu.trim().length < 120,
    ).length,
    above1600: applicable.filter(
      (record) => record.applicableTextRu.trim().length > 1_600,
    ).length,
    outsideTwoToFourSentences: applicable.filter((record) => {
      const count = structuredRussianBiographySentenceCount(
        record.applicableTextRu,
      );
      return count < 2 || count > 4;
    }).length,
    duplicateGroups: duplicateTextGroups.map((group) =>
      group.map((record) => record.key),
    ),
  },
  editorialInput: {
    records: editorialInput.records.length,
    sourceFingerprint: editorialInput.sourceFingerprint,
    invariants: editorialInput.invariants,
    current: editorialInputIsCurrent,
  },
  editorialRefinements: {
    present: Object.keys(refinements).length,
    inputFingerprintMatches:
      localOnlyEditorialState ||
      refinementOverlay.inputFingerprint === editorialInput.sourceFingerprint,
    missingKeys: missingRefinementKeys,
    orphanKeys: orphanRefinementKeys,
    rejected: rejectedRefinements,
  },
  structuredText: {
    ready: structured.filter((record) =>
      isStructuredRussianBiographyText(record.text),
    ).length,
    blocked: structured
      .filter((record) => !isStructuredRussianBiographyText(record.text))
      .map((record) => record.key),
    derivations: Object.fromEntries(
      Object.entries(
        Object.groupBy(structured, (record) => record.derivation),
      ).map(([key, values]) => [key, values.length]),
    ),
    duplicateGroups: Object.values(
      Object.groupBy(structured, (record) =>
        record.text.toLocaleLowerCase("ru"),
      ),
    )
      .filter((group) => group.length > 1)
      .map((group) => group.map((record) => record.key)),
    sourceNarration: structured
      .filter((record) =>
        structuredRussianBiographySourceNarrationPattern.test(record.text),
      )
      .map((record) => record.key),
    technicalNarration: structured
      .filter((record) =>
        structuredRussianBiographyTechnicalPattern.test(record.text),
      )
      .map((record) => record.key),
    tautology: structured
      .filter(
        (record) =>
          structuredRussianBiographyTautologyIssues(record.text).length > 0,
      )
      .map((record) => record.key),
    awardRestatement: structured
      .filter(
        (record) =>
          structuredRussianBiographyAwardRestatementIssues(record.text).length >
          0,
      )
      .map((record) => record.key),
    lifespanRestatement: structured
      .filter(
        (record) =>
          structuredRussianBiographyLifespanRestatementIssues(record.text)
            .length > 0,
      )
      .map((record) => record.key),
    genderAgreement: structured
      .filter((record) =>
        structuredRussianBiographyGenderAgreementPattern.test(record.text),
      )
      .map((record) => record.key),
    orphanEditorialKeys,
    curatedSemanticIssues,
    ...(process.argv.includes("--samples")
      ? {
          samples: structured
            .filter((record) =>
              process.argv.includes("--claim-samples")
                ? record.derivation === "reviewed-claims"
                : record.derivation !== "reviewed-text",
            )
            .sort(
              (left, right) =>
                left.reviewedTextRu.length - right.reviewedTextRu.length ||
                left.key.localeCompare(right.key, "en"),
            )
            .slice(0, 60),
        }
      : {}),
    ...(process.argv.includes("--blocked-manifest")
      ? {
          blockedManifest: structured
            .filter((record) => !isStructuredRussianBiographyText(record.text))
            .slice(blockedOffset, blockedOffset + blockedLimit)
            .map((blocked) => {
              const record = recordByKey.get(blocked.key);
              const writer = publicWriterByKey.get(blocked.key);
              return {
                key: blocked.key,
                name: writer?.name || writer?.fullName || writer?.id,
                years:
                  writer?.years ||
                  [
                    writer?.birthDate || writer?.birth,
                    writer?.deathDate || writer?.death,
                  ]
                    .filter(Boolean)
                    .join("-"),
                reviewedTextRu: blocked.reviewedTextRu,
                claims: record.claims.map((claim) => ({
                  textRu: claim.textRu,
                  verdict: claim.verdict,
                  findings: claim.evidence.map((evidence) => ({
                    provider: evidence.provider,
                    findingRu: evidence.findingRu,
                  })),
                })),
              };
            }),
        }
      : {}),
  },
};

console.log(JSON.stringify(output, null, 2));

if (
  output.publicMissingRecord.length > 0 ||
  output.supplementalEvidence.recordsWithFewerThanTwoUrls.length > 0 ||
  output.supplementalEvidence.recordsWithFewerThanTwoHosts.length > 0 ||
  output.supplementalEvidence.recordsWithNonHttpsSources.length > 0 ||
  output.supplementalEvidence.recordsWithMissingPublisher.length > 0 ||
  output.evidence.nonHttps > 0 ||
  output.evidence.missingProvider > 0 ||
  output.evidence.missingCheckedAt > 0 ||
  output.evidence.recordsWithFewerThanTwoUrls.length > 0 ||
  output.evidence.recordsWithFewerThanTwoHosts.length > 0 ||
  output.evidence.publicationRecordsWithFewerThanTwoUrls.length > 0 ||
  output.evidence.publicationRecordsWithFewerThanTwoHosts.length > 0 ||
  output.structuredText.blocked.length > 0 ||
  output.structuredText.duplicateGroups.length > 0 ||
  output.structuredText.sourceNarration.length > 0 ||
  output.structuredText.technicalNarration.length > 0 ||
  output.structuredText.tautology.length > 0 ||
  output.structuredText.awardRestatement.length > 0 ||
  output.structuredText.lifespanRestatement.length > 0 ||
  output.structuredText.genderAgreement.length > 0 ||
  output.structuredText.orphanEditorialKeys.length > 0 ||
  output.structuredText.curatedSemanticIssues.length > 0 ||
  output.editorialInput.invariants?.notEstablishedClaims > 0 ||
  output.editorialInput.invariants?.editorialServiceClaims > 0 ||
  output.editorialInput.invariants?.editorialServiceEvidence > 0 ||
  !output.editorialRefinements.inputFingerprintMatches ||
  output.editorialRefinements.missingKeys.length > 0 ||
  output.editorialRefinements.orphanKeys.length > 0 ||
  output.editorialRefinements.rejected.length > 0 ||
  !output.editorialInput.current
) {
  process.exitCode = 1;
}
