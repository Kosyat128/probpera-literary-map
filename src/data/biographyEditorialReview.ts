import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";

import type {
  WriterBiographyTranslationProfile,
  WriterProfile,
} from "./countries/types";

/** Separate from the historical generated/public biography sourceHash formats. */
export const WRITER_BIOGRAPHY_REVIEW_HASH_CONTRACT =
  "writer-biography-review-v1" as const;

type ReviewableTranslation = WriterBiographyTranslationProfile & {
  editorialReview?: unknown;
};

const hashPattern = /^[a-f0-9]{64}$/u;
const decisions = new Set(["approved", "rejected", "withdrawn"]);

function isLocale(value: unknown): value is "ru" | "en" {
  return value === "ru" || value === "en";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** JSON keys are sorted recursively; array order and every text byte matter. */
function canonicalJson(value: unknown, ancestors = new Set<object>()): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return JSON.stringify(value);
  }
  if (!value || typeof value !== "object" || ancestors.has(value)) {
    throw new TypeError("Biography review hashes require acyclic JSON data");
  }
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return `[${Array.from(value, (item) => canonicalJson(item, ancestors)).join(",")}]`;
    }
    if (!isRecord(value)) {
      throw new TypeError("Biography review hashes require plain JSON objects");
    }
    return `{${Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key], ancestors)}`)
      .join(",")}}`;
  } finally {
    ancestors.delete(value);
  }
}

function hash(value: unknown): string {
  return bytesToHex(sha256(utf8ToBytes(canonicalJson(value))));
}

function contentFields(translation: ReviewableTranslation) {
  return {
    locale: translation.locale,
    text: translation.text,
    sourceLanguage: translation.sourceLanguage,
    method: translation.method,
    translatedFromLocale: translation.translatedFromLocale,
    sourceTextRights: translation.sourceTextRights,
    sources: translation.sources,
    translationMeta: translation.translationMeta,
  };
}

/** Hashes an existing source profile; never falls back to legacy bio fields. */
export function writerBiographyReviewSourceHash(
  writer: WriterProfile | undefined,
  sourceLocale: unknown
): string | null {
  if (
    !writer ||
    !isLocale(sourceLocale) ||
    typeof writer.id !== "string" ||
    !writer.id.trim()
  ) {
    return null;
  }
  const source = writer.biographyTranslations?.[sourceLocale];
  if (
    !source ||
    source.locale !== sourceLocale ||
    typeof source.text !== "string" ||
    !source.text.trim()
  ) {
    return null;
  }
  try {
    return hash({
      hashContract: WRITER_BIOGRAPHY_REVIEW_HASH_CONTRACT,
      kind: "source",
      writer: {
        id: writer.id,
        name: String(writer.fullName || writer.name || writer.id).trim(),
      },
      sourceLocale,
      profile: {
        ...contentFields(source),
        status: source.status,
        reviewedAt: source.reviewedAt,
        reviewer: source.reviewer,
        editorialReview: (source as ReviewableTranslation).editorialReview,
      },
    });
  } catch {
    return null;
  }
}

/** Approval fields are excluded so supplying a review cannot change its hash. */
export function writerBiographyReviewTargetHash(
  translation: ReviewableTranslation
): string {
  return hash({
    hashContract: WRITER_BIOGRAPHY_REVIEW_HASH_CONTRACT,
    kind: "target",
    profile: contentFields(translation),
  });
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  if (year === 0) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
}

function isReviewer(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 240 &&
    value === value.trim() &&
    !/[\u0000-\u001f\u007f]/u.test(value)
  );
}

function isEvidenceRef(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 1_000) return false;
  if (/^editorial-review:[a-z0-9][a-z0-9._:-]{0,199}$/iu.test(value)) return true;
  if (/\s|[\u0000-\u001f\u007f]/u.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

function isHash(value: unknown): value is string {
  return typeof value === "string" && hashPattern.test(value);
}

/**
 * Checks a separately supplied human review, not the truth of its attestation.
 * Existing content/source quality gates still apply. No approval is generated.
 * Stable issue codes allow runtime, CMS and correction tools to share a gate.
 */
export function writerBiographyEditorialReviewIssues(
  translation: ReviewableTranslation,
  writer: WriterProfile | undefined
): string[] {
  const issues: string[] = [];
  const sourceLocale = translation.translatedFromLocale;
  const sourceHash =
    isLocale(translation.locale) && sourceLocale !== translation.locale
      ? writerBiographyReviewSourceHash(writer, sourceLocale)
      : null;
  const review = translation.editorialReview;

  if (review === undefined || review === null) {
    issues.push("missing-review");
  } else if (!isRecord(review)) {
    issues.push("invalid-review");
  } else {
    if (review.decision === "rejected" || review.decision === "withdrawn") {
      issues.push("not-approved");
    }
    if (
      review.schemaVersion !== 1 ||
      review.hashContract !== WRITER_BIOGRAPHY_REVIEW_HASH_CONTRACT ||
      typeof review.decision !== "string" ||
      !decisions.has(review.decision) ||
      review.reviewerType !== "human" ||
      !isReviewer(review.reviewer) ||
      !isIsoDate(review.reviewedAt) ||
      !isEvidenceRef(review.evidenceRef) ||
      !isHash(review.sourceHash) ||
      !isHash(review.targetHash) ||
      review.reviewer !== translation.reviewer ||
      review.reviewedAt !== translation.reviewedAt
    ) {
      issues.push("invalid-review");
    }
    if (sourceHash && isHash(review.sourceHash) && review.sourceHash !== sourceHash) {
      issues.push("source-changed");
    }
    if (isHash(review.targetHash)) {
      try {
        if (review.targetHash !== writerBiographyReviewTargetHash(translation)) {
          issues.push("target-changed");
        }
      } catch {
        if (!issues.includes("invalid-review")) issues.push("invalid-review");
      }
    }
  }
  if (!sourceHash) issues.push("missing-source");
  return issues;
}
