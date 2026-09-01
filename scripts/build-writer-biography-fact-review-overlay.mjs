import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { build } from "esbuild";

import {
  isStructuredRussianBiographyText,
  structuredRussianBiographyFromReview,
} from "./lib/writer-biography-structured-ru.mjs";
import { writerBiographySentenceCount } from "./lib/writer-biography-english-qa.mjs";
import {
  curatedWorkTitleEvidenceAliases,
  extractExplicitWorkTitles,
  invalidCuratedWorkTitleEvidenceAliases,
  reviewSupportedWorkTitles,
} from "./lib/writer-biography-work-titles.mjs";
import {
  applyCataloguedRussianPublicationTitles,
  russianPublicationTitleApplicationIssues,
  russianPublicationTitleEntriesForKey,
  writerBiographyRussianPublicationTitles,
} from "./lib/writer-biography-russian-publication-titles.mjs";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const cacheDirectory = path.join(projectRoot, "scripts", ".cache");
const bundlePath = path.join(
  cacheDirectory,
  `writer-biography-review-source-${process.pid}.mjs`,
);
const runtimePath = path.join(
  projectRoot,
  "src",
  "data",
  "countries",
  "generated",
  "writerBiographyFactReviewCorrections.generated.json",
);
const clientRuntimePath = path.join(
  projectRoot,
  "src",
  "data",
  "countries",
  "generated",
  "writerBiographyFactReviewRuntime.generated.json",
);
const rollupPath = path.join(
  projectRoot,
  "reports",
  "writer-biography-fact-review-rollup.json",
);
const markdownPath = path.join(
  projectRoot,
  "reports",
  "writer-biography-fact-review-rollup.md",
);
const russianPublicationTitleAuditPath = path.join(
  projectRoot,
  "reports",
  "writer-biography-russian-publication-title-audit.json",
);
const structuredRussianEditorialPath = path.join(
  projectRoot,
  "src/data/countries/writerBiographyStructuredRuEditorial.json",
);
const structuredRussianEditorialInputPath = path.join(
  projectRoot,
  "reports/writer-biography-russian-editorial-input.json",
);
const structuredRussianEditorialRefinementPath = path.join(
  projectRoot,
  "src/data/countries/generated/writerBiographyRussianEditorialRefinements.generated.json",
);
const writeMode = process.argv.includes("--write");
const russianBiographyReviewedAt = "2026-08-31";
const russianInstitutionalHosts = new Set([
  "bigenc.ru",
  "prlib.ru",
  "nlr.ru",
  "rsl.ru",
  "rusneb.ru",
  "ras.ru",
  "ruslang.ru",
  "pushkinskijdom.ru",
  "culture.ru",
  "goslitmuz.ru",
  "bulgakovmuseum.ru",
  "md.spb.ru",
  "museum-esenin.ru",
  "museumpushkin.ru",
  "pravenc.ru",
  "pushkinmuseum.ru",
  "kraslib.ru",
  "sholokhov.ru",
  "solzhenitsyn.ru",
  "tolstoymuseum.ru",
  "dommuseum.ru",
  "turgenevmus.ru",
  "chekhovmuseum.com",
]);

async function loadReviews() {
  await mkdir(cacheDirectory, { recursive: true });
  await build({
    absWorkingDir: projectRoot,
    entryPoints: [
      path.join(projectRoot, "scripts", "writer-biography-review-source.ts"),
    ],
    bundle: true,
    platform: "node",
    packages: "external",
    format: "esm",
    target: "node22",
    outfile: bundlePath,
    logLevel: "silent",
  });
  try {
    const module = await import(
      `${pathToFileURL(bundlePath).href}?v=${Date.now()}`
    );
    return {
      records: module.writerBiographyFactReviews,
      quarantinedKeys: new Set(
        module.writerBiographyFactReviewQuarantinedKeys || [],
      ),
    };
  } finally {
    await rm(bundlePath, { force: true });
  }
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function buildClientRuntime(runtime) {
  const structuredEntries = Object.entries(
    runtime.structuredRussianBiographies,
  );
  const structuredKeys = new Set(structuredEntries.map(([key]) => key));
  const corrections = Object.fromEntries(
    Object.entries(runtime.corrections).filter(
      ([key]) => !structuredKeys.has(key),
    ),
  );
  const russianBiographies = Object.fromEntries(
    Object.entries(runtime.russianBiographies).filter(
      ([key]) => !structuredKeys.has(key),
    ),
  );

  for (const [key, russianPublication] of Object.entries(
    runtime.russianBiographies,
  )) {
    const structuredPublication = runtime.structuredRussianBiographies[key];
    if (!structuredPublication) continue;
    if (
      structuredPublication.sources.length !== 1 ||
      JSON.stringify(structuredPublication.sources[0]) !==
        JSON.stringify(russianPublication.source)
    ) {
      throw new Error(
        `${key}: compact client runtime cannot replace mismatched Russian publication data`,
      );
    }
  }

  const reviewers = [
    ...new Set(
      structuredEntries.map(([, publication]) => publication.reviewer),
    ),
  ].sort((left, right) => left.localeCompare(right, "en"));
  const dates = [
    ...new Set(
      structuredEntries.flatMap(([, publication]) => [
        publication.reviewedAt,
        ...publication.sources.map((source) => source.retrievedAt),
      ]),
    ),
  ].sort();
  const providers = [
    ...new Set(
      structuredEntries.flatMap(([, publication]) =>
        publication.sources.map((source) => source.provider),
      ),
    ),
  ].sort((left, right) => left.localeCompare(right, "en"));

  const sourceIndexes = new Map();
  const sources = [];
  const sourceIndex = (source) => {
    const tuple = [
      providers.indexOf(source.provider),
      source.url,
      dates.indexOf(source.retrievedAt),
      source.fields,
    ];
    const identity = JSON.stringify(tuple);
    const existing = sourceIndexes.get(identity);
    if (existing !== undefined) return existing;
    const index = sources.length;
    sources.push(tuple);
    sourceIndexes.set(identity, index);
    return index;
  };

  const biographies = Object.fromEntries(
    structuredEntries.map(([key, publication]) => {
      const sourceHash = publication.sourceHash.replace(/^sha256:/u, "");
      if (!/^[a-f0-9]{64}$/u.test(sourceHash)) {
        throw new Error(`${key}: invalid structured Russian source hash`);
      }
      const encoded = [
        publication.text,
        publication.works,
        dates.indexOf(publication.reviewedAt),
        reviewers.indexOf(publication.reviewer),
        sourceHash,
        publication.sources.map(sourceIndex),
      ];
      if (
        publication.translatorModel ||
        publication.reviewerModel ||
        publication.generatedAt
      ) {
        encoded.push(
          publication.translatorModel || null,
          publication.reviewerModel || null,
          publication.generatedAt || null,
        );
      }
      return [key, encoded];
    }),
  );

  return {
    version: 1,
    reviewVersion: runtime.version,
    reviewedCount: runtime.reviewedCount,
    correctedCount: runtime.correctedCount,
    publishedCorrectionCount: runtime.publishedCorrectionCount,
    publishedRussianBiographyCount: runtime.publishedRussianBiographyCount,
    publishedStructuredRussianBiographyCount:
      runtime.publishedStructuredRussianBiographyCount,
    publishedStructuredWorkTitleCount:
      runtime.publishedStructuredWorkTitleCount,
    corrections,
    russianBiographies,
    reviewers,
    dates,
    providers,
    sources,
    biographies,
  };
}

function isRussianInstitutionalEvidence(evidence) {
  const hostname = new URL(evidence.url).hostname.toLowerCase();
  if (hostname === "old.bigenc.ru") return false;
  return [...russianInstitutionalHosts].some(
    (allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`),
  );
}

function russianInstitutionalEvidence(record) {
  return record.claims
    .filter((claim) => new Set(["supported", "corrected"]).has(claim.verdict))
    .flatMap((claim) => claim.evidence)
    .find(isRussianInstitutionalEvidence);
}

function structuredRussianPublicationEvidence(record) {
  const evidence = record.claims
    .filter((claim) => new Set(["supported", "corrected"]).has(claim.verdict))
    .flatMap((claim) => claim.evidence);
  const sourcesByUrl = new Map();
  for (const source of evidence) {
    const fields = Array.isArray(source.fields)
      ? source.fields
      : ["biography-facts"];
    const existing = sourcesByUrl.get(source.url);
    sourcesByUrl.set(source.url, {
      ...source,
      fields: [...new Set([...(existing?.fields || []), ...fields])].sort(),
    });
  }
  return [...sourcesByUrl.values()];
}

function structuredRussianPublicationWorks(record, text) {
  return reviewSupportedWorkTitles(record, extractExplicitWorkTitles(text));
}

function classifyLatinTitle(value) {
  const title = String(value || "").trim();
  if (!/\p{Script=Latin}/u.test(title)) return "cyrillic-or-other";
  const withoutRomanNumerals = title.replace(
    /(?<![\p{L}\p{N}])[IVXLCDM]+(?![\p{L}\p{N}])/gu,
    "",
  );
  if (!/\p{Script=Latin}/u.test(withoutRomanNumerals)) {
    return "roman-numeral-only";
  }
  const withoutParentheticalOriginal = withoutRomanNumerals.replace(
    /\([^()]*\)/gu,
    "",
  );
  if (
    /\p{Script=Cyrillic}/u.test(title) &&
    !/\p{Script=Latin}/u.test(withoutParentheticalOriginal)
  ) {
    return "russian-first-with-parenthetical-original";
  }
  return "unresolved-latin";
}

function buildRussianPublicationTitleAudit(runtime) {
  const unresolvedStructuredWorks = [];
  let romanNumeralOnlyStructuredWorks = 0;
  let russianFirstParentheticalOriginalWorks = 0;
  let latinQuotedFragments = 0;
  let latinQuotedFragmentsRequiringClassification = 0;
  let russianFirstParentheticalOriginalConstructions = 0;

  for (const [key, publication] of Object.entries(
    runtime.structuredRussianBiographies,
  )) {
    for (const title of publication.works) {
      const classification = classifyLatinTitle(title);
      if (classification === "unresolved-latin") {
        unresolvedStructuredWorks.push({ key, title });
      } else if (classification === "roman-numeral-only") {
        romanNumeralOnlyStructuredWorks += 1;
      } else if (
        classification === "russian-first-with-parenthetical-original"
      ) {
        russianFirstParentheticalOriginalWorks += 1;
      }
    }
    for (const match of publication.text.matchAll(/«([^»]{2,160})»/gu)) {
      if (!/\p{Script=Latin}/u.test(match[1])) continue;
      latinQuotedFragments += 1;
      if (classifyLatinTitle(match[1]) === "unresolved-latin") {
        latinQuotedFragmentsRequiringClassification += 1;
      }
    }
    russianFirstParentheticalOriginalConstructions += [
      ...publication.text.matchAll(
        /«[^»]*\p{Script=Cyrillic}[^»]*»\s*\([^)]*\p{Script=Latin}[^)]*\)/gu,
      ),
    ].length;
  }

  unresolvedStructuredWorks.sort(
    (left, right) =>
      left.key.localeCompare(right.key, "en") ||
      left.title.localeCompare(right.title, "ru"),
  );
  return {
    version: 1,
    deterministic: true,
    sourceFingerprint: runtime.sourceFingerprint,
    summary: {
      attestedMappings: writerBiographyRussianPublicationTitles.length,
      attestedQuotedOccurrences: writerBiographyRussianPublicationTitles.reduce(
        (sum, entry) => sum + entry.expectedOccurrences,
        0,
      ),
      structuredWorkTitles: runtime.publishedStructuredWorkTitleCount,
      unresolvedLatinStructuredWorks: unresolvedStructuredWorks.length,
      russianFirstParentheticalOriginalWorks,
      romanNumeralOnlyStructuredWorks,
      latinQuotedFragments,
      latinQuotedFragmentsRequiringClassification,
      russianFirstParentheticalOriginalConstructions,
    },
    unresolvedStructuredWorks,
  };
}

function localizeRussianPublicationTitles(record) {
  const entries = russianPublicationTitleEntriesForKey(record.key);
  if (entries.length === 0) return { record, entries };
  if (
    record.decision === "held" ||
    typeof record.applicableTextRu !== "string"
  ) {
    throw new Error(
      `${record.key}: Russian-edition title attestation requires publishable reviewed text`,
    );
  }
  const applicableTextRu = applyCataloguedRussianPublicationTitles(
    record.key,
    record.applicableTextRu,
  );
  return {
    entries,
    record: {
      ...record,
      reviewedTextRu: applyCataloguedRussianPublicationTitles(
        record.key,
        record.reviewedTextRu,
      ),
      applicableTextRu,
      claims: [
        ...record.claims,
        ...entries.map((entry) => ({
          textRu: `Российское издание «${entry.displayTitleRu}» соответствует произведению ${entry.sourceTitleExact}.`,
          verdict: "supported",
          evidence: [entry.evidence],
        })),
      ],
    },
  };
}

function validateRecord(record, index) {
  const label = `review[${index}]`;
  if (!record || typeof record !== "object") {
    throw new Error(`${label}: object expected`);
  }
  if (
    // One legacy Madagascar id contains an embedded soft hyphen. Preserve the
    // exact source key here so the review overlay can address the existing
    // record without silently renaming a public identity in a fact-review job.
    !/^[\p{Ll}\p{Lo}\p{M}\p{N}_\u00ad-]+:[\p{Ll}\p{Lo}\p{M}\p{N}_\u00ad-]+$/u.test(
      record.key || "",
    )
  ) {
    throw new Error(`${label}: invalid key ${JSON.stringify(record.key)}`);
  }
  if (!/^[a-f0-9]{64}$/u.test(record.originalSha256 || "")) {
    throw new Error(`${record.key}: invalid original SHA-256`);
  }
  if (!new Set(["unchanged", "corrected", "held"]).has(record.decision)) {
    throw new Error(`${record.key}: invalid decision`);
  }
  if (record.decision === "held") {
    if (record.applicableTextRu !== null) {
      throw new Error(`${record.key}: held review must not be applicable`);
    }
  } else if (
    typeof record.applicableTextRu !== "string" ||
    !/[А-Яа-яЁё]/u.test(record.applicableTextRu)
  ) {
    throw new Error(`${record.key}: applicable Russian text is required`);
  }
  if (!Array.isArray(record.claims) || record.claims.length === 0) {
    throw new Error(`${record.key}: claim evidence is required`);
  }
  for (const claim of record.claims) {
    if (!Array.isArray(claim.evidence) || claim.evidence.length === 0) {
      throw new Error(`${record.key}: every claim needs evidence`);
    }
    for (const evidence of claim.evidence) {
      if (!/^https:\/\//u.test(evidence.url || "")) {
        throw new Error(`${record.key}: HTTPS evidence URL required`);
      }
    }
  }
}

function buildOutputs(
  records,
  quarantinedKeys,
  editorialOverrides,
  editorialInput,
  refinementOverlay,
) {
  records.forEach(validateRecord);
  const sorted = [...records].sort((left, right) =>
    left.key.localeCompare(right.key, "en"),
  );
  const keys = sorted.map((record) => record.key);
  if (new Set(keys).size !== keys.length) {
    throw new Error("Duplicate writer biography review key");
  }
  const invalidWorkTitleEvidenceAliases =
    invalidCuratedWorkTitleEvidenceAliases(sorted);
  if (invalidWorkTitleEvidenceAliases.length > 0) {
    throw new Error(
      `Curated work-title evidence alias mismatch: ${invalidWorkTitleEvidenceAliases
        .map((alias) => `${alias.key}:${alias.russianTitle}`)
        .join(", ")}`,
    );
  }

  const decisionCounts = { unchanged: 0, corrected: 0, held: 0 };
  const corrections = {};
  const russianBiographies = {};
  const structuredRussianBiographies = {};
  const workTitleReviewExceptions = [];
  const workTitleEvidenceAliases = [];
  const appliedRussianPublicationTitles = [];
  const editorialInputByKey = new Map(
    editorialInput.records.map((record) => [record.key, record]),
  );
  const refinements = refinementOverlay.refinements || {};
  const localOnlyEditorialState =
    editorialInput.records.length === 0 &&
    Object.keys(refinements).length === 0;
  if (
    !localOnlyEditorialState &&
    refinementOverlay.inputFingerprint !== editorialInput.sourceFingerprint
  ) {
    throw new Error(
      "Russian editorial refinement input fingerprint does not match the audited manifest",
    );
  }
  const missingRefinementKeys = editorialInput.records
    .filter((record) => !Object.hasOwn(refinements, record.key))
    .map((record) => record.key);
  const orphanRefinementKeys = Object.keys(refinements).filter(
    (key) => !editorialInputByKey.has(key),
  );
  if (missingRefinementKeys.length > 0 || orphanRefinementKeys.length > 0) {
    throw new Error(
      `Russian editorial refinement coverage mismatch: ${missingRefinementKeys.length} missing, ${orphanRefinementKeys.length} orphan`,
    );
  }
  const excludedQuarantinedCorrectionKeys = [];
  for (const record of sorted) {
    const localized = localizeRussianPublicationTitles(record);
    const publicationRecord = localized.record;
    const selectedEditorialText = Object.hasOwn(editorialOverrides, record.key)
      ? editorialOverrides[record.key]
      : undefined;
    const sourceTextBeforeTitleLocalization =
      selectedEditorialText === undefined
        ? record.applicableTextRu
        : selectedEditorialText;
    const localizedEditorialText =
      selectedEditorialText === undefined
        ? undefined
        : applyCataloguedRussianPublicationTitles(
            record.key,
            selectedEditorialText,
          );
    decisionCounts[record.decision] += 1;
    if (record.decision === "corrected") {
      if (quarantinedKeys.has(record.key)) {
        excludedQuarantinedCorrectionKeys.push(record.key);
      } else {
        corrections[record.key] = publicationRecord.applicableTextRu;
      }
    }
    let structuredPublication = null;
    if (record.decision !== "held" && !quarantinedKeys.has(record.key)) {
      const result = structuredRussianBiographyFromReview(
        publicationRecord,
        localizedEditorialText,
        refinements[record.key],
        editorialInputByKey.get(record.key),
      );
      const titleApplicationIssues = russianPublicationTitleApplicationIssues(
        record.key,
        sourceTextBeforeTitleLocalization,
        result.text,
      );
      if (titleApplicationIssues.length > 0) {
        throw new Error(
          `${record.key}: Russian-edition title application failed (${titleApplicationIssues.join(
            ", ",
          )})`,
        );
      }
      appliedRussianPublicationTitles.push(...localized.entries);
      if (!isStructuredRussianBiographyText(result.text)) {
        throw new Error(
          `${record.key}: structured Russian biography is blocked (${result.derivation}${
            result.refinementIssues?.length
              ? `: ${result.refinementIssues.join(", ")}`
              : ""
          })`,
        );
      }
      const sources = structuredRussianPublicationEvidence(publicationRecord);
      const hostnames = new Set(
        sources.map((source) => new URL(source.url).hostname.toLowerCase()),
      );
      if (sources.length < 2 || hostnames.size < 2) {
        throw new Error(
          `${record.key}: structured Russian biography requires two independent fact-check sources`,
        );
      }
      const primaryRussianSource = record.key.startsWith("russia:")
        ? russianInstitutionalEvidence(publicationRecord)
        : null;
      const publicSources = record.key.startsWith("russia:")
        ? [primaryRussianSource].filter(Boolean)
        : sources;
      if (
        record.key.startsWith("russia:") &&
        (publicSources.length !== 1 ||
          !sources.some((source) => source.url === primaryRussianSource?.url))
      ) {
        throw new Error(
          `${record.key}: supported authoritative Russian-language institutional source is required`,
        );
      }
      const reviewedWorks = structuredRussianPublicationWorks(
        publicationRecord,
        result.text,
      );
      const supportedWorks = [
        ...new Set([
          ...reviewedWorks.supported,
          ...localized.entries.map((entry) => entry.displayTitleRu),
        ]),
      ].sort((left, right) => left.localeCompare(right, "ru"));
      workTitleReviewExceptions.push(
        ...reviewedWorks.unsupported.map((title) => ({
          key: record.key,
          title,
          reason: "no-title-specific-supported-claim-evidence",
        })),
      );
      workTitleEvidenceAliases.push(...reviewedWorks.curatedEvidenceAliases);
      structuredPublication = {
        text: result.text,
        works: supportedWorks,
        reviewedAt: sources
          .map((source) => source.checkedAt)
          .sort()
          .at(-1),
        reviewer:
          result.derivation === "two-pass-editorial-refinement"
            ? `Двухпроходная редактура Workers AI; факты проверены: ${record.reviewer}`
            : result.derivation === "curated-editorial"
              ? `Редакционная обработка Codex; факты проверены: ${record.reviewer}`
              : record.reviewer,
        factualReviewer: record.reviewer,
        sourceHash: `sha256:${sha256(result.text)}`,
        sourceTextRights: "project-original",
        derivation: result.derivation,
        ...(result.derivation === "two-pass-editorial-refinement"
          ? {
              translatorModel: refinements[record.key].translatorModel,
              reviewerModel: refinements[record.key].reviewerModel,
              generatedAt: refinements[record.key].generatedAt,
            }
          : {}),
        sources: publicSources.map((source) => ({
          provider: source.provider,
          url: source.url,
          retrievedAt: source.checkedAt,
          fields: source.fields || ["biography-facts"],
        })),
      };
      structuredRussianBiographies[record.key] = structuredPublication;
    }
    if (
      record.key.startsWith("russia:") &&
      record.decision !== "held" &&
      !quarantinedKeys.has(record.key)
    ) {
      const text = structuredPublication.text;
      const sentenceCount = writerBiographySentenceCount(text);
      if (sentenceCount < 2 || sentenceCount > 4) {
        throw new Error(
          `${record.key}: publishable Russian biography must contain 2-4 sentences`,
        );
      }
      if (text.length < 120 || text.length > 1_600) {
        throw new Error(
          `${record.key}: publishable Russian biography must contain 120-1600 characters`,
        );
      }
      const source = structuredPublication.sources[0];
      if (!source) {
        throw new Error(
          `${record.key}: supported authoritative Russian-language institutional source is required`,
        );
      }
      russianBiographies[record.key] = {
        text,
        reviewedAt: russianBiographyReviewedAt,
        source: {
          provider: source.provider,
          url: source.url,
          retrievedAt: source.retrievedAt,
          fields: source.fields,
        },
      };
    }
  }
  const appliedRussianPublicationTitleIdentities = new Set(
    appliedRussianPublicationTitles.map(
      (entry) => `${entry.key}\u0000${entry.sourceTitleExact}`,
    ),
  );
  if (
    appliedRussianPublicationTitles.length !==
      writerBiographyRussianPublicationTitles.length ||
    appliedRussianPublicationTitleIdentities.size !==
      writerBiographyRussianPublicationTitles.length
  ) {
    throw new Error("Russian-edition title attestation usage mismatch");
  }
  const usedWorkTitleEvidenceAliasIdentities = new Set(
    workTitleEvidenceAliases.map(
      (alias) => `${alias.key}\u0000${alias.russianTitle}`,
    ),
  );
  const unusedWorkTitleEvidenceAliases = curatedWorkTitleEvidenceAliases.filter(
    (alias) =>
      !usedWorkTitleEvidenceAliasIdentities.has(
        `${alias.key}\u0000${alias.russianTitle}`,
      ),
  );
  if (
    unusedWorkTitleEvidenceAliases.length > 0 ||
    usedWorkTitleEvidenceAliasIdentities.size !==
      workTitleEvidenceAliases.length
  ) {
    throw new Error(
      `Curated work-title evidence alias usage mismatch: ${unusedWorkTitleEvidenceAliases
        .map((alias) => `${alias.key}:${alias.russianTitle}`)
        .join(", ")}`,
    );
  }
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        records: sorted.map((record) => [
          record.key,
          record.originalSha256,
          record.decision,
          record.applicableTextRu,
        ]),
        excludedQuarantinedCorrectionKeys,
        russianBiographies,
        structuredRussianBiographies,
        workTitleEvidenceAliases,
        writerBiographyRussianPublicationTitles,
      }),
      "utf8",
    )
    .digest("hex");

  const runtime = {
    version: 7,
    reviewedCount: sorted.length,
    correctedCount: decisionCounts.corrected,
    publishedCorrectionCount: Object.keys(corrections).length,
    publishedRussianBiographyCount: Object.keys(russianBiographies).length,
    publishedStructuredRussianBiographyCount: Object.keys(
      structuredRussianBiographies,
    ).length,
    publishedStructuredWorkTitleCount: Object.values(
      structuredRussianBiographies,
    ).reduce((count, publication) => count + publication.works.length, 0),
    sourceFingerprint: `sha256:${fingerprint}`,
    corrections,
    russianBiographies,
    structuredRussianBiographies,
  };
  const russianPublicationTitleAudit =
    buildRussianPublicationTitleAudit(runtime);
  const rollup = {
    version: 7,
    deterministic: true,
    sourceFingerprint: runtime.sourceFingerprint,
    summary: {
      records: sorted.length,
      ...decisionCounts,
    },
    publication: {
      corrections: runtime.publishedCorrectionCount,
      russianBiographies: runtime.publishedRussianBiographyCount,
      structuredRussianBiographies:
        runtime.publishedStructuredRussianBiographyCount,
      structuredWorkTitles: runtime.publishedStructuredWorkTitleCount,
      excludedQuarantinedCorrectionKeys,
    },
    workTitleReviewExceptions,
    workTitleEvidenceAliases,
    russianPublicationTitles: writerBiographyRussianPublicationTitles,
    russianPublicationTitleAudit: russianPublicationTitleAudit.summary,
    reviewedKeys: keys,
  };
  const markdown = [
    "# Проверка русских биографий писателей",
    "",
    `- Проверено карточек: **${sorted.length}**`,
    `- Без изменения текста: **${decisionCounts.unchanged}**`,
    `- Исправлено: **${decisionCounts.corrected}**`,
    `- Удержано: **${decisionCounts.held}**`,
    `- Опубликовано исправлений: **${runtime.publishedCorrectionCount}**`,
    `- Опубликовано проверенных биографий российских авторов: **${runtime.publishedRussianBiographyCount}**`,
    `- Опубликовано строгих русских биографий всего: **${runtime.publishedStructuredRussianBiographyCount}**`,
    `- Опубликовано title-specific названий произведений: **${runtime.publishedStructuredWorkTitleCount}**`,
    `- Подтверждено точечных соответствий названий с точной привязкой к источнику: **${workTitleEvidenceAliases.length}**`,
    `- Локализовано названий по карточкам русских изданий: **${writerBiographyRussianPublicationTitles.length}**`,
    `- Осталось латинских structured-названий для точной библиографической сверки: **${russianPublicationTitleAudit.summary.unresolvedLatinStructuredWorks}**`,
    `- Сохранено корректных конструкций «русское название» (Original): **${russianPublicationTitleAudit.summary.russianFirstParentheticalOriginalConstructions}**`,
    `- Удержано до title-specific сверки: **${workTitleReviewExceptions.length}**`,
    `- Исключено карантинных ключей: **${excludedQuarantinedCorrectionKeys.length}**`,
    `- Отпечаток: \`${runtime.sourceFingerprint}\``,
    "",
    "Полные доказательства находятся в изолированных отчётах партий. Публичная сборка получает только компактный слой профессионально отредактированного русского текста и конкретные HTTPS-ссылки, использованные для проверки фактов.",
    "",
    ...(workTitleReviewExceptions.length
      ? [
          "## Очередь title-specific сверки",
          "",
          "Эти названия не попадают в structured `works`: их нормализованная форма не встречается в supported/corrected claim или его evidence finding.",
          "",
          "| Ключ | Название | Причина |",
          "| --- | --- | --- |",
          ...workTitleReviewExceptions.map(
            (item) =>
              `| \`${item.key}\` | ${item.title.replace(/\|/gu, "\\|")} | \`${item.reason}\` |`,
          ),
          "",
        ]
      : []),
  ].join("\n");

  return { runtime, rollup, markdown, russianPublicationTitleAudit };
}

async function verifyOrWrite(filePath, content) {
  if (writeMode) {
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, content, "utf8");
    return;
  }
  const current = await readFile(filePath, "utf8").catch(() => null);
  if (current !== content) {
    throw new Error(
      `${path.relative(projectRoot, filePath)} is stale; run npm run writers:biographies:reviews:build`,
    );
  }
}

const { records, quarantinedKeys } = await loadReviews();
const [editorialOverrides, editorialInput, refinementOverlay] =
  await Promise.all(
    [
      structuredRussianEditorialPath,
      structuredRussianEditorialInputPath,
      structuredRussianEditorialRefinementPath,
    ].map(async (filePath) =>
      JSON.parse(
        await readFile(filePath, "utf8").catch(() =>
          JSON.stringify({
            records: [],
            refinements: {},
            inputFingerprint: null,
          }),
        ),
      ),
    ),
  );
const { runtime, rollup, markdown, russianPublicationTitleAudit } =
  buildOutputs(
    records,
    quarantinedKeys,
    editorialOverrides,
    editorialInput,
    refinementOverlay,
  );
const clientRuntime = buildClientRuntime(runtime);
await verifyOrWrite(runtimePath, stableJson(runtime));
await verifyOrWrite(clientRuntimePath, stableJson(clientRuntime));
await verifyOrWrite(rollupPath, stableJson(rollup));
await verifyOrWrite(markdownPath, markdown);
await verifyOrWrite(
  russianPublicationTitleAuditPath,
  stableJson(russianPublicationTitleAudit),
);

console.log(
  JSON.stringify(
    {
      mode: writeMode ? "write" : "check",
      ...rollup.summary,
      corrections: Object.keys(runtime.corrections).length,
      russianBiographies: Object.keys(runtime.russianBiographies).length,
      structuredRussianBiographies: Object.keys(
        runtime.structuredRussianBiographies,
      ).length,
      structuredWorkTitles: runtime.publishedStructuredWorkTitleCount,
      clientRuntimeBytes: Buffer.byteLength(stableJson(clientRuntime)),
      workTitleReviewExceptions: rollup.workTitleReviewExceptions.length,
      attestedRussianPublicationTitles:
        russianPublicationTitleAudit.summary.attestedMappings,
      unresolvedLatinStructuredWorks:
        russianPublicationTitleAudit.summary.unresolvedLatinStructuredWorks,
      sourceFingerprint: runtime.sourceFingerprint,
    },
    null,
    2,
  ),
);
