import { createHash } from "node:crypto";

export const BOOK_EVIDENCE_V2_CONTRACT = "book-evidence-v2";
export const BOOK_EVIDENCE_V2_VALIDATOR =
  "src/data/bookEvidence.ts#bookEvidenceV2Issues";
export const BOOK_EVIDENCE_V2_VALIDATOR_VERSION =
  "book-evidence-v2-validator-v1";
export const BOOK_EVIDENCE_V2_SCHEMA_VERSION =
  "20260902_literary_work_evidence_v2_attestations";
export const BOOK_EVIDENCE_V2_VALIDATOR_SOURCE_FILES = Object.freeze([
  "src/data/bookEvidence.ts",
  "src/data/bookQuality.ts",
]);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : undefined;
}

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function canonicalUtf8Buffer(value) {
  if (!(typeof value === "string" || Buffer.isBuffer(value))) {
    throw new TypeError("UTF-8 source text is required.");
  }
  const sourceText = Buffer.isBuffer(value)
    ? value.toString("utf8")
    : value;
  return Buffer.from(sourceText.replace(/\r\n?/gu, "\n"), "utf8");
}

export function canonicalUtf8ContentSha256(value) {
  return createHash("sha256")
    .update(canonicalUtf8Buffer(value))
    .digest("hex");
}

/**
 * Hashes the complete runtime validator source set with length framing. A
 * dependency edit cannot reuse a proof merely because the exported function
 * name and top-level source file stayed unchanged.
 */
export function evidenceV2ValidatorImplementationSha256(sourcesByPath) {
  if (!(sourcesByPath instanceof Map)) {
    throw new TypeError("Validator source map is required.");
  }
  const digest = createHash("sha256");
  for (const sourcePath of BOOK_EVIDENCE_V2_VALIDATOR_SOURCE_FILES) {
    const rawSource = sourcesByPath.get(sourcePath);
    if (!(typeof rawSource === "string" || Buffer.isBuffer(rawSource))) {
      throw new Error(`Validator source is missing: ${sourcePath}`);
    }
    const sourceBuffer = canonicalUtf8Buffer(rawSource);
    const frame = Buffer.from(
      `${Buffer.byteLength(sourcePath, "utf8")}:${sourcePath}:${sourceBuffer.length}:`,
      "utf8"
    );
    digest.update(frame);
    digest.update(sourceBuffer);
  }
  return digest.digest("hex");
}

function localCalendarDate(value = new Date()) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function selectedTitleEvidence(book, locale) {
  return (
    object(book?.localizedTitles?.[locale]) ||
    object(book?.translations?.[locale]?.titleEvidence)
  );
}

function descriptionHashByLocale(book) {
  return Object.fromEntries(
    ["ru", "en"].flatMap((locale) => {
      const description = book?.translations?.[locale]?.description;
      return typeof description === "string" && description
        ? [[locale, sha256(description)]]
        : [];
    })
  );
}

function attestationReviewIdentity(book) {
  const reviewers = [
    book?.translations?.ru?.descriptionProvenance?.reviewedBy,
    book?.translations?.en?.descriptionProvenance?.reviewedBy,
    book?.canon?.reviewedBy,
  ]
    .map(text)
    .filter(Boolean);
  const reviewer = [...new Set(reviewers)]
    .sort((left, right) => left.localeCompare(right, "en"))
    .join("; ");

  const checkedDates = [
    book?.translations?.ru?.descriptionProvenance?.reviewedAt,
    book?.translations?.en?.descriptionProvenance?.reviewedAt,
    book?.canon?.reviewedAt,
    ...["ru", "en"].flatMap((locale) =>
      (selectedTitleEvidence(book, locale)?.evidence || []).map(
        (record) => record?.checkedAt
      )
    ),
  ]
    .map(text)
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right, "en"));

  return {
    reviewer,
    reviewedAt: checkedDates.at(-1) || "",
  };
}

function operationalEvidenceIssues(book, reviewer, reviewedAt, today) {
  const issues = [];
  if (!selectedTitleEvidence(book, "ru")) {
    issues.push("attestation-missing-ru-title-evidence");
  }
  if (!selectedTitleEvidence(book, "en")) {
    issues.push("attestation-missing-en-title-evidence");
  }
  if (!object(book?.translations?.ru?.descriptionProvenance)) {
    issues.push("attestation-missing-ru-description-provenance");
  }
  if (!object(book?.translations?.en?.descriptionProvenance)) {
    issues.push("attestation-missing-en-description-provenance");
  }
  if (reviewer.length < 2 || reviewer.length > 160) {
    issues.push("attestation-reviewer-invalid");
  }
  if (!ISO_DATE.test(reviewedAt) || reviewedAt > today) {
    issues.push("attestation-review-date-invalid");
  }
  return issues;
}

/**
 * Builds proofs only after the checked-in TypeScript Evidence V2 validator has
 * returned zero issues. No database identifiers or server hashes are invented
 * here; those are bound after the database sync has completed.
 */
export function evidenceV2AttestationCandidatesFromArchive(
  archive,
  {
    canonRegistry,
    canonRegistrySha256,
    issuesForWork,
    validatorSha256,
    today = localCalendarDate(),
  }
) {
  if (!Array.isArray(archive)) throw new TypeError("Archive must be an array.");
  if (typeof issuesForWork !== "function") {
    throw new TypeError("Evidence V2 validator is required.");
  }
  const canonRegistryVersion = text(canonRegistry?.registryVersion);
  const normalizedCanonRegistrySha256 = text(canonRegistrySha256);
  const normalizedValidatorSha256 = text(validatorSha256);
  if (!canonRegistryVersion) {
    throw new Error("Canon registry version is required for V2 attestation.");
  }
  if (!SHA256.test(normalizedCanonRegistrySha256)) {
    throw new Error("Canon registry SHA-256 is required for V2 attestation.");
  }
  if (!SHA256.test(normalizedValidatorSha256)) {
    throw new Error("Validator SHA-256 is required for V2 attestation.");
  }

  const candidates = [];
  const rejected = [];
  for (const book of archive) {
    const recordKey = `${book.countryId}:${book.writerId}:${book.id}`;
    const descriptionSha256ByLocale = descriptionHashByLocale(book);
    const validationIssues = issuesForWork(book, {
      canonRegistry,
      recordKey,
      originCountryIds: [book.countryId],
      descriptionSha256ByLocale,
    });
    if (!Array.isArray(validationIssues)) {
      throw new TypeError(`Evidence validator returned no issue array: ${recordKey}`);
    }
    if (validationIssues.length) {
      rejected.push({ recordKey, issues: [...validationIssues] });
      continue;
    }

    const { reviewer, reviewedAt } = attestationReviewIdentity(book);
    const operationalIssues = operationalEvidenceIssues(
      book,
      reviewer,
      reviewedAt,
      today
    );
    if (operationalIssues.length) {
      rejected.push({ recordKey, issues: operationalIssues });
      continue;
    }

    candidates.push({
      recordKey,
      reviewer,
      reviewedAt,
      evidence: {
        contractVersion: BOOK_EVIDENCE_V2_CONTRACT,
        recordKey,
        validation: {
          validator: BOOK_EVIDENCE_V2_VALIDATOR,
          validatorVersion: BOOK_EVIDENCE_V2_VALIDATOR_VERSION,
          validatorSha256: normalizedValidatorSha256,
          status: "passed",
          issues: [],
          canonRegistryVersion,
          canonRegistrySha256: normalizedCanonRegistrySha256,
          reviewer,
          reviewedAt,
        },
        localizedTitles: {
          ru: selectedTitleEvidence(book, "ru"),
          en: selectedTitleEvidence(book, "en"),
        },
        descriptions: {
          ru: {
            ...book.translations.ru.descriptionProvenance,
            descriptionSha256: descriptionSha256ByLocale.ru,
          },
          en: {
            ...book.translations.en.descriptionProvenance,
            descriptionSha256: descriptionSha256ByLocale.en,
          },
        },
        canon: book.canon ?? null,
      },
    });
  }
  return { candidates, rejected };
}

export function bindEvidenceV2AttestationPayloads(
  candidates,
  workIds,
  contentSha256ByWorkId,
  expectedContentByRecordKey
) {
  return candidates.map((candidate) => {
    const workId = text(workIds.get(candidate.recordKey));
    const expectedContentSha256 = text(contentSha256ByWorkId.get(workId));
    const expectedContent = object(
      expectedContentByRecordKey.get(candidate.recordKey)
    );
    if (!workId) {
      throw new Error(
        `Evidence V2 work ID is unresolved: ${candidate.recordKey}`
      );
    }
    if (!SHA256.test(expectedContentSha256)) {
      throw new Error(
        `Evidence V2 content hash is unresolved: ${candidate.recordKey}`
      );
    }
    if (!expectedContent) {
      throw new Error(
        `Evidence V2 local content projection is unresolved: ${candidate.recordKey}`
      );
    }
    return {
      workId,
      expectedContentSha256,
      expectedContent,
      evidence: candidate.evidence,
      reviewer: candidate.reviewer,
      reviewedAt: candidate.reviewedAt,
    };
  });
}

function postgresCTextOrder(left, right) {
  return Buffer.compare(
    Buffer.from(typeof left === "string" ? left : String(left ?? ""), "utf8"),
    Buffer.from(typeof right === "string" ? right : String(right ?? ""), "utf8")
  );
}

/** Mirrors public.literary_work_evidence_v2_content(uuid) without hashing. */
export function evidenceV2DatabaseContentProjection({
  workRow,
  authorshipKind,
  translationRows = [],
  sourceRows = [],
  externalIdRows = [],
  authorRows = [],
  editionRows = [],
  artworkRows = [],
}) {
  if (!object(workRow)) {
    throw new TypeError("Evidence V2 work row is required.");
  }
  return {
    work: {
      legacyId: workRow.legacy_id,
      countryId: workRow.country_id,
      writerId: workRow.writer_id,
      title: workRow.title,
      slug: workRow.slug,
      originalTitle: workRow.original_title,
      firstPublished: workRow.first_published ?? null,
      originalLanguage: workRow.original_language,
      genres: workRow.genres,
      tags: workRow.tags,
      description: workRow.description,
      sourceUrl: workRow.source_url ?? null,
      editorialStatus: workRow.editorial_status,
      reviewedAt: workRow.reviewed_at ?? null,
      metadata: workRow.metadata,
      authorshipKind: authorshipKind ?? null,
    },
    translations: [...translationRows]
      .sort((left, right) => postgresCTextOrder(left.locale, right.locale))
      .map((row) => ({
        locale: row.locale,
        title: row.title,
        description: row.description,
        sourceLanguage: row.source_language,
        method: row.translation_method,
        status: row.editorial_status,
        sourceUrls: row.source_urls,
        reviewedAt: row.reviewed_at ?? null,
        metadata: row.metadata,
      })),
    sources: [...sourceRows]
      .sort(
        (left, right) =>
          postgresCTextOrder(left.provider, right.provider) ||
          postgresCTextOrder(left.source_url, right.source_url)
      )
      .map((row) => ({
        provider: row.provider,
        url: row.source_url,
        fields: row.field_names,
        license: row.license_name ?? null,
        usage: row.usage,
        retrievedAt: row.retrieved_at,
        metadata: row.metadata,
      })),
    externalIds: [...externalIdRows]
      .sort(
        (left, right) =>
          postgresCTextOrder(left.scheme, right.scheme) ||
          postgresCTextOrder(left.external_id, right.external_id)
      )
      .map((row) => ({
        scheme: row.scheme,
        value: row.external_id,
        sourceUrl: row.source_url,
      })),
    authors: [...authorRows]
      .sort((left, right) => left.position - right.position)
      .map((row) => ({
        position: row.position,
        countryId: row.writer_country_id ?? null,
        writerId: row.writer_id ?? null,
        creditNameRu: row.credit_name_ru ?? null,
        creditNameEn: row.credit_name_en ?? null,
        attribution: row.attribution_status,
        metadata: row.metadata,
      })),
    editions: [...editionRows]
      .sort((left, right) => postgresCTextOrder(left.legacy_id, right.legacy_id))
      .map((row) => ({
        legacyId: row.legacy_id,
        title: row.title,
        isbn10: row.isbn_10 ?? null,
        isbn13: row.isbn_13 ?? null,
        publisher: row.publisher ?? "",
        publicationYear: row.publication_year ?? null,
        language: row.language ?? "",
        format: row.format ?? "",
        pageCount: row.page_count ?? null,
        coverUrl: row.cover_url ?? null,
        coverSourceUrl: row.cover_source_url ?? null,
        coverRightsStatus: row.cover_rights_status ?? "unverified",
        licenseName: row.license_name ?? "",
        licenseUrl: row.license_url ?? null,
        creator: row.creator ?? "",
        rightsHolder: row.rights_holder ?? "",
        rightsCheckedAt: row.rights_checked_at ?? null,
        sourceUrl: row.source_url ?? null,
        isPrimary: row.is_primary ?? false,
        metadata: row.metadata ?? {},
      })),
    artworks: [...artworkRows]
      .sort(
        (left, right) =>
          postgresCTextOrder(
            left.source_archive_sha256,
            right.source_archive_sha256
          ) ||
          postgresCTextOrder(
            left.source_image_sha256,
            right.source_image_sha256
          )
      )
      .map((row) => ({
        coverUrl: row.cover_url,
        thumbnailUrl: row.thumbnail_url,
        coverWidth: row.cover_width,
        coverHeight: row.cover_height,
        thumbnailWidth: row.thumbnail_width,
        thumbnailHeight: row.thumbnail_height,
        rightsStatus: row.rights_status,
        coverSourceUrl: row.cover_source_url,
        rightsCheckedAt: row.rights_checked_at,
        sourceArchiveSha256: row.source_archive_sha256,
        sourceImageSha256: row.source_image_sha256,
        sourceFilename: row.source_filename,
        sourceRelativePath: row.source_relative_path,
        sourceIndex: row.source_index,
        isPrimary: row.is_primary,
        provenance: row.provenance,
      })),
  };
}
