import { createHash } from "node:crypto";

export const LOC_HELD_REVIEW_SCHEMA_VERSION = 1;
export const LOC_HELD_REVIEW_SOURCE_ID =
  "loc-books-that-shaped-america-2012";
export const LOC_HELD_REVIEW_HASH_PROFILE =
  "sha256-canonical-json-loc-held-review-v1";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const RECORD_KEY = /^[^:\s]+:[^:\s]+:[^:\s]+$/u;
const REVIEW_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const DECISION_STATUSES = new Set([
  "accepted-mapping",
  "draft-addition",
  "hold",
]);
const ALLOWED_RU_AUTHORITY_HOSTS = new Set([
  "ast.ru",
  "azbooka.ru",
  "eksmo.ru",
  "rusneb.ru",
  "search.rsl.ru",
]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactText(value, minimumLength = 1) {
  return (
    typeof value === "string" &&
    value.length >= minimumLength &&
    value === value.trim()
  );
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalize(value[key])])
  );
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function sha256Canonical(value) {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

export function locHeldReviewBatchFingerprint(batch) {
  if (!isRecord(batch)) return sha256Canonical(null);
  const protectedBatch = { ...batch };
  delete protectedBatch.batchFingerprint;
  return sha256Canonical(protectedBatch);
}

function isIsoCalendarDate(value) {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.valueOf()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function parsedHttpsUrl(value) {
  if (!exactText(value)) return null;
  try {
    const parsed = new URL(value);
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      !parsed.hostname
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function registryItemMap(registry) {
  const result = new Map();
  if (!isRecord(registry) || !Array.isArray(registry.inventories)) return result;
  for (const inventory of registry.inventories) {
    if (!isRecord(inventory) || !Array.isArray(inventory.items)) continue;
    for (const item of inventory.items) {
      if (!isRecord(item)) continue;
      result.set(`${inventory.sourceId}:${item.itemId}`, {
        sourceId: inventory.sourceId,
        ...item,
      });
    }
  }
  return result;
}

function archiveRecordKey(record) {
  return `${record.countryId}:${record.writerId}:${record.id}`;
}

function archiveRecordMap(records) {
  const result = new Map();
  for (const record of records || []) {
    if (!isRecord(record)) continue;
    result.set(archiveRecordKey(record), record);
  }
  return result;
}

function matchingWriterKeys(countries, keyProbes, nameProbes) {
  const expectedKeys = new Set(keyProbes || []);
  const expectedNames = new Set((nameProbes || []).map(normalizedExact));
  const result = [];
  for (const country of countries || []) {
    if (!isRecord(country) || !Array.isArray(country.writers)) continue;
    for (const writer of country.writers) {
      if (!isRecord(writer) || !exactText(writer.id)) continue;
      const key = `${country.id}:${writer.id}`;
      const names = [writer.name, writer.fullName]
        .filter(exactText)
        .map(normalizedExact);
      if (
        expectedKeys.has(key) ||
        names.some((name) => expectedNames.has(name))
      ) {
        result.push(key);
      }
    }
  }
  return [...new Set(result)].sort();
}

function archiveTitles(record) {
  const titles = [record.title, record.originalTitle];
  if (Array.isArray(record.alternateTitles)) titles.push(...record.alternateTitles);
  if (isRecord(record.localizedTitles)) {
    for (const localized of Object.values(record.localizedTitles)) {
      if (isRecord(localized)) titles.push(localized.value);
    }
  }
  return titles.filter(exactText);
}

function normalizedExact(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("ru")
    .replace(/[’‘`]/gu, "'")
    .replace(/\s+/gu, " ")
    .trim();
}

function matchingArchiveKeys(records, probes) {
  const expected = new Set((probes || []).map(normalizedExact));
  if (expected.has("")) expected.delete("");
  return (records || [])
    .filter((record) =>
      archiveTitles(record).some((title) => expected.has(normalizedExact(title)))
    )
    .map(archiveRecordKey)
    .sort();
}

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

function sentenceCount(value) {
  if (!exactText(value)) return 0;
  return (value.match(/[.!?](?=\s|$)/gu) || []).length;
}

function summaryFor(reviews) {
  const counts = {
    acceptedMappingCount: 0,
    draftAdditionCount: 0,
    holdCount: 0,
  };
  for (const review of reviews) {
    if (review?.decision?.status === "accepted-mapping") {
      counts.acceptedMappingCount += 1;
    } else if (review?.decision?.status === "draft-addition") {
      counts.draftAdditionCount += 1;
    } else if (review?.decision?.status === "hold") {
      counts.holdCount += 1;
    }
  }
  return {
    reviewCount: reviews.length,
    ...counts,
    productionActionCount: 0,
    canonClaimCount: 0,
  };
}

export function locHeldReviewIssues(
  batch,
  { canonRegistry = null, archiveRecords = [], archiveCountries = [] } = {}
) {
  const issues = [];
  if (!isRecord(batch)) return ["batch must be an object"];

  if (batch.schemaVersion !== LOC_HELD_REVIEW_SCHEMA_VERSION) {
    issues.push("schemaVersion must be 1");
  }
  if (!REVIEW_ID.test(batch.batchId || "")) {
    issues.push("batchId must be a stable lowercase slug");
  }
  if (!isIsoCalendarDate(batch.checkedAt)) {
    issues.push("checkedAt must be an ISO calendar date");
  }
  if (batch.applicationStatus !== "research-only") {
    issues.push("applicationStatus must remain research-only");
  }
  if (batch.sourceId !== LOC_HELD_REVIEW_SOURCE_ID) {
    issues.push("sourceId is invalid");
  }
  if (batch.hashProfile !== LOC_HELD_REVIEW_HASH_PROFILE) {
    issues.push("hashProfile is invalid");
  }
  if (!exactText(batch.reviewPolicy, 140)) {
    issues.push("reviewPolicy must state the fail-closed non-production boundary");
  }
  if (!Array.isArray(batch.reviews) || batch.reviews.length < 1 || batch.reviews.length > 10) {
    issues.push("reviews must contain between one and ten records");
  }
  if (!SHA256.test(batch.batchFingerprint || "")) {
    issues.push("batchFingerprint must be sha256");
  } else if (batch.batchFingerprint !== locHeldReviewBatchFingerprint(batch)) {
    issues.push("batchFingerprint is stale");
  }

  const reviews = Array.isArray(batch.reviews) ? batch.reviews : [];
  const duplicateReviewIds = duplicateValues(reviews.map((review) => review?.reviewId));
  if (duplicateReviewIds.length) {
    issues.push(`duplicate reviewId values: ${duplicateReviewIds.join(", ")}`);
  }
  const duplicateItemIds = duplicateValues(
    reviews.map((review) => review?.canonHoldRef?.itemId)
  );
  if (duplicateItemIds.length) {
    issues.push(`duplicate canon item values: ${duplicateItemIds.join(", ")}`);
  }

  const registryItems = registryItemMap(canonRegistry);
  const recordsByKey = archiveRecordMap(archiveRecords);
  reviews.forEach((review, index) => {
    const prefix = `reviews[${index}]`;
    if (!isRecord(review)) {
      issues.push(`${prefix} must be an object`);
      return;
    }
    if (!REVIEW_ID.test(review.reviewId || "")) {
      issues.push(`${prefix}.reviewId is invalid`);
    }

    const ref = review.canonHoldRef;
    if (!isRecord(ref)) {
      issues.push(`${prefix}.canonHoldRef must be an object`);
    } else {
      const registryItem = registryItems.get(`${ref.sourceId}:${ref.itemId}`);
      if (ref.sourceId !== batch.sourceId) {
        issues.push(`${prefix}.canonHoldRef.sourceId is invalid`);
      }
      if (!registryItem) {
        issues.push(`${prefix}.canonHoldRef does not resolve`);
      } else {
        for (const field of ["ordinal", "itemHash"]) {
          if (ref[field] !== registryItem[field]) {
            issues.push(`${prefix}.canonHoldRef.${field} is stale`);
          }
        }
        if (
          registryItem.candidateKind !== "work" ||
          registryItem.entityKind !== "work" ||
          registryItem.adjudicationStatus !== "held"
        ) {
          issues.push(`${prefix}.canonHoldRef must reference a held Work candidate`);
        }
        if (review.locIdentity?.titleExact !== registryItem.titleExact) {
          issues.push(`${prefix}.locIdentity.titleExact differs from the registry`);
        }
        if (review.locIdentity?.creatorExact !== registryItem.contributorExact) {
          issues.push(`${prefix}.locIdentity.creatorExact differs from the registry`);
        }
        if (review.locIdentity?.itemUrl !== registryItem.itemUrl) {
          issues.push(`${prefix}.locIdentity.itemUrl differs from the registry`);
        }
      }
    }

    const locIdentity = review.locIdentity;
    if (!isRecord(locIdentity)) {
      issues.push(`${prefix}.locIdentity must be an object`);
    } else {
      if (locIdentity.entityKind !== "work") {
        issues.push(`${prefix}.locIdentity.entityKind must be work`);
      }
      if (!Number.isInteger(locIdentity.workFirstPublishedYear)) {
        issues.push(`${prefix}.locIdentity.workFirstPublishedYear must be an integer`);
      }
      const itemUrl = parsedHttpsUrl(locIdentity.itemUrl);
      if (!itemUrl || !/(^|\.)loc\.gov$/u.test(itemUrl.hostname)) {
        issues.push(`${prefix}.locIdentity.itemUrl must be an official LoC URL`);
      }
      if (!Array.isArray(locIdentity.sources) || locIdentity.sources.length < 1) {
        issues.push(`${prefix}.locIdentity.sources must not be empty`);
      } else {
        for (const [sourceIndex, source] of locIdentity.sources.entries()) {
          const url = parsedHttpsUrl(source?.url);
          if (!url || !/(^|\.)loc\.gov$/u.test(url.hostname)) {
            issues.push(`${prefix}.locIdentity.sources[${sourceIndex}] must use loc.gov`);
          }
          if (!exactText(source?.findingRu, 40)) {
            issues.push(`${prefix}.locIdentity.sources[${sourceIndex}].findingRu is too short`);
          }
        }
      }
      const manifestation = locIdentity.displayedManifestation;
      if (!isRecord(manifestation) || !Number.isInteger(manifestation.year)) {
        issues.push(`${prefix}.locIdentity.displayedManifestation is incomplete`);
      }
    }

    const ruTitle = review.ruTitle;
    if (!isRecord(ruTitle) || !exactText(ruTitle.recommendedExact)) {
      issues.push(`${prefix}.ruTitle is incomplete`);
    } else if (!isRecord(ruTitle.evidence)) {
      issues.push(`${prefix}.ruTitle.evidence must be an object`);
    } else {
      const evidence = ruTitle.evidence;
      const url = parsedHttpsUrl(evidence.url);
      if (!url || !ALLOWED_RU_AUTHORITY_HOSTS.has(url.hostname)) {
        issues.push(`${prefix}.ruTitle.evidence must use an approved official source`);
      }
      if (evidence.catalogTitleExact !== ruTitle.recommendedExact) {
        issues.push(`${prefix}.ruTitle must preserve the exact evidence title`);
      }
      if (!exactText(evidence.authorExact)) {
        issues.push(`${prefix}.ruTitle.evidence.authorExact is required`);
      }
      if (!isIsoCalendarDate(evidence.checkedAt)) {
        issues.push(`${prefix}.ruTitle.evidence.checkedAt is invalid`);
      }
    }

    const descriptionSentences = sentenceCount(review.descriptionDraftRu);
    if (descriptionSentences < 2 || descriptionSentences > 3) {
      issues.push(`${prefix}.descriptionDraftRu must contain two or three sentences`);
    }
    if (
      !Array.isArray(review.descriptionSourceUrls) ||
      review.descriptionSourceUrls.length < 1 ||
      review.descriptionSourceUrls.some((value) => {
        const url = parsedHttpsUrl(value);
        return !url || !/(^|\.)loc\.gov$/u.test(url.hostname);
      })
    ) {
      issues.push(`${prefix}.descriptionSourceUrls must contain only official LoC URLs`);
    }

    const archiveReview = review.archiveReview;
    if (!isRecord(archiveReview)) {
      issues.push(`${prefix}.archiveReview must be an object`);
    } else {
      if (archiveReview.method !== "runtime-raw-exact-title-and-writer-scan-v1") {
        issues.push(`${prefix}.archiveReview.method is invalid`);
      }
      if (!Array.isArray(archiveReview.titleProbes) || !archiveReview.titleProbes.length) {
        issues.push(`${prefix}.archiveReview.titleProbes must not be empty`);
      }
      const liveTitleMatches = matchingArchiveKeys(
        archiveRecords,
        archiveReview.titleProbes
      );
      if (
        canonicalJson(liveTitleMatches) !==
        canonicalJson((archiveReview.exactTitleMatchRecordKeys || []).slice().sort())
      ) {
        issues.push(`${prefix}.archiveReview exact-title result is stale`);
      }
      const liveWriterMatches = matchingWriterKeys(
        archiveCountries,
        archiveReview.writerKeyProbes,
        archiveReview.writerNameProbes
      );
      if (
        !Array.isArray(archiveReview.writerKeyProbes) ||
        !archiveReview.writerKeyProbes.length ||
        !Array.isArray(archiveReview.writerNameProbes) ||
        !archiveReview.writerNameProbes.length
      ) {
        issues.push(`${prefix}.archiveReview writer probes must not be empty`);
      }
      if (
        canonicalJson(liveWriterMatches) !==
        canonicalJson((archiveReview.writerMatchKeys || []).slice().sort())
      ) {
        issues.push(`${prefix}.archiveReview writer result is stale`);
      }
    }

    const decision = review.decision;
    if (!isRecord(decision) || !DECISION_STATUSES.has(decision.status)) {
      issues.push(`${prefix}.decision.status is invalid`);
      return;
    }
    if (!exactText(decision.reasonRu, 80)) {
      issues.push(`${prefix}.decision.reasonRu is too short`);
    }
    if (decision.status === "accepted-mapping") {
      if (!RECORD_KEY.test(decision.recordKey || "")) {
        issues.push(`${prefix}.decision.recordKey is invalid`);
      }
      const target = recordsByKey.get(decision.recordKey);
      if (!target) {
        issues.push(`${prefix}.decision.recordKey does not resolve`);
      } else {
        for (const [field, expected] of Object.entries(
          decision.expectedArchiveFields || {}
        )) {
          if (target[field] !== expected) {
            issues.push(`${prefix}.decision.expectedArchiveFields.${field} is stale`);
          }
        }
      }
      if (decision.sourceTitleAliasExact !== locIdentity?.titleExact) {
        issues.push(`${prefix}.decision.sourceTitleAliasExact must preserve the LoC title`);
      }
    } else if (decision.status === "draft-addition") {
      if ((archiveReview?.exactTitleMatchRecordKeys || []).length !== 0) {
        issues.push(`${prefix}.draft-addition cannot hide an exact title match`);
      }
      if ((archiveReview?.writerMatchKeys || []).length !== 0) {
        issues.push(`${prefix}.draft-addition requires a separate writer-identity review`);
      }
      if (
        !Array.isArray(decision.requiredBeforeIntegration) ||
        decision.requiredBeforeIntegration.length < 3
      ) {
        issues.push(`${prefix}.draft-addition integration requirements are incomplete`);
      }
      if ("recordKey" in decision || "productionAction" in decision) {
        issues.push(`${prefix}.draft-addition cannot define an executable action`);
      }
    }
  });

  if (canonicalJson(batch.summary) !== canonicalJson(summaryFor(reviews))) {
    issues.push("summary is stale");
  }

  return issues;
}
