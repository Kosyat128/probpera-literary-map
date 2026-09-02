import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

const SHA256 = /^[0-9a-f]{64}$/u;
const RELEASE_KEY = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{6,159}$/u;
const PRECONDITION_KEYS = Object.freeze([
  "childEditPreservation",
  "cmsLockedPredecessorLegacyIds",
  "cmsLockedUnattestedPredecessorLegacyIds",
  "predecessorLegacyManifestSha256",
  "predecessorPublic",
  "unlockedScopeSha256",
  "unlockedWorks",
]);

export const LITERARY_ARCHIVE_RELEASE_CONTRACT =
  "literary-archive-release-v1";
export const LITERARY_ARCHIVE_CHILD_EDIT_PRESERVATION_SCHEMA =
  "literary-archive-child-edit-preservation-v1";
export const LITERARY_ARCHIVE_RELEASE_BATCH_LIMIT = 100;
export const LITERARY_ARCHIVE_RELEASE_ITEM_LIMIT = 20_000;
export const LITERARY_ARCHIVE_RELEASE_BATCH_BYTES = 7_500_000;

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : undefined;
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function exactLegacyId(value, location = "legacyId") {
  if (
    typeof value !== "string" ||
    value.length < 2 ||
    value.length > 180 ||
    value !== value.trim()
  ) {
    throw new TypeError(
      `${location} must be an exact 2-180 character string without surrounding whitespace.`
    );
  }
  return value;
}

function positiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new TypeError(`${label} must be a positive safe integer.`);
  }
  return value;
}

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function postgresUtcMicrosecondTimestamp(value, location) {
  if (typeof value !== "string") {
    throw new TypeError(`${location} must be an RFC 3339 timestamp.`);
  }
  const match = value.match(
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/u
  );
  if (!match) {
    throw new TypeError(`${location} must be an RFC 3339 timestamp.`);
  }
  const utcSeconds = new Date(`${match[1]}${match[3]}`);
  if (Number.isNaN(utcSeconds.getTime())) {
    throw new TypeError(`${location} must be a valid RFC 3339 timestamp.`);
  }
  return `${utcSeconds.toISOString().slice(0, 19)}.${(match[2] || "").padEnd(6, "0")}Z`;
}

function canonicalJsonValue(value, location = "payload") {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError(`${location} contains a non-finite number.`);
    }
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) {
    return value.map((entry, index) =>
      canonicalJsonValue(entry, `${location}[${index}]`)
    );
  }
  if (!object(value)) {
    throw new TypeError(`${location} is not JSON-serializable.`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${location} must be a plain JSON object.`);
  }
  return Object.fromEntries(
    Object.keys(value)
      .sort((left, right) =>
        Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"))
      )
      .map((key) => [key, canonicalJsonValue(value[key], `${location}.${key}`)])
  );
}

export function canonicalLiteraryArchiveReleasePayload(payload) {
  return JSON.stringify(canonicalJsonValue(payload));
}

export function encodeLiteraryArchiveReleaseItem(payload) {
  if (!object(payload)) {
    throw new TypeError("Atomic release item must be an object.");
  }
  if (
    !Number.isSafeInteger(payload.ordinal) ||
    payload.ordinal < 0 ||
    payload.ordinal >= LITERARY_ARCHIVE_RELEASE_ITEM_LIMIT
  ) {
    throw new TypeError("Atomic release item ordinal is invalid.");
  }
  const legacyId = exactLegacyId(payload.legacyId);
  if (!object(payload.work) || payload.work.legacy_id !== legacyId) {
    throw new Error("Atomic release item has a mismatched work legacy_id.");
  }
  const canonicalPayload = canonicalLiteraryArchiveReleasePayload(payload);
  if (Buffer.byteLength(canonicalPayload, "utf8") > 262_144) {
    throw new RangeError("Atomic release item exceeds the 256 KiB limit.");
  }
  return {
    ordinal: payload.ordinal,
    legacyId,
    canonicalPayload,
    payloadSha256: sha256(canonicalPayload),
  };
}

function targetManifestEntry(envelope) {
  return `${envelope.ordinal}:${Buffer.from(envelope.legacyId, "utf8").toString("hex")}:${envelope.payloadSha256}`;
}

export function literaryArchiveReleaseTargetManifestSha256(items) {
  if (!Array.isArray(items) || items.length < 1) {
    throw new TypeError("Target manifest requires release items.");
  }
  partitionLiteraryArchiveReleaseItems(items);
  const envelopes = items.map(encodeLiteraryArchiveReleaseItem);
  envelopes.forEach((envelope, index) => {
    if (envelope.ordinal !== index) {
      throw new Error("Target manifest ordinals must be contiguous from zero.");
    }
  });
  return sha256(envelopes.map(targetManifestEntry).join("\n"));
}

export function literaryArchiveReleaseBatchManifestSha256(items) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 100) {
    throw new RangeError("Batch manifest requires 1-100 release items.");
  }
  const envelopes = items.map(encodeLiteraryArchiveReleaseItem);
  for (let index = 1; index < envelopes.length; index += 1) {
    if (envelopes[index].ordinal !== envelopes[index - 1].ordinal + 1) {
      throw new Error("Batch manifest ordinals must be contiguous.");
    }
  }
  return sha256(envelopes.map(targetManifestEntry).join("\n"));
}

export function literaryArchiveReleaseLegacyIdManifestSha256(legacyIds) {
  if (!Array.isArray(legacyIds)) {
    throw new TypeError("Legacy-ID manifest requires an array.");
  }
  const normalized = legacyIds.map((legacyId, index) =>
    exactLegacyId(legacyId, `legacyIds[${index}]`)
  );
  if (new Set(normalized).size !== normalized.length) {
    throw new Error("Legacy-ID manifest contains duplicates.");
  }
  normalized.sort((left, right) =>
    Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"))
  );
  return sha256(
    normalized
      .map((legacyId) => Buffer.from(legacyId, "utf8").toString("hex"))
      .join("\n")
  );
}

/**
 * Binds a workflow handoff to the exact logical live target independently of
 * expectedLive timestamps. The DB postflight separately proves that the
 * committed release's staged expectedContent/attestation rows equal live.
 */
export function literaryArchiveReleaseLogicalTargetManifestSha256(items) {
  if (!Array.isArray(items) || items.length < 1) {
    throw new TypeError("Logical live-target manifest requires release items.");
  }
  const normalized = items.map((item, index) => {
    if (!object(item)) {
      throw new TypeError(`Logical live-target item ${index} is invalid.`);
    }
    const legacyId = exactLegacyId(
      item.legacyId,
      `logicalTarget[${index}].legacyId`
    );
    if (!object(item.expectedContent)) {
      throw new TypeError(
        `Logical live-target item ${legacyId} has no expectedContent.`
      );
    }
    if (item.attestation !== null && !object(item.attestation)) {
      throw new TypeError(
        `Logical live-target item ${legacyId} has an invalid attestation.`
      );
    }
    if (
      item.attestation &&
      !isDeepStrictEqual(item.attestation.expectedContent, item.expectedContent)
    ) {
      throw new Error(
        `Logical live-target item ${legacyId} has divergent attestation content.`
      );
    }
    return {
      legacyId,
      expectedContent: item.expectedContent,
      attestation: item.attestation,
    };
  });
  if (new Set(normalized.map((entry) => entry.legacyId)).size !== normalized.length) {
    throw new Error("Logical live-target manifest contains duplicate legacy IDs.");
  }
  normalized.sort((left, right) =>
    Buffer.compare(
      Buffer.from(left.legacyId, "utf8"),
      Buffer.from(right.legacyId, "utf8")
    )
  );
  return sha256(canonicalLiteraryArchiveReleasePayload(normalized));
}

/** Mirrors literary_archive_release_unlocked_scope_sha256() byte-for-byte. */
export function literaryArchiveReleaseUnlockedScopeSha256(works) {
  if (!Array.isArray(works)) {
    throw new TypeError("Unlocked archive scope requires a work array.");
  }
  const normalized = works.map((work, index) => {
    if (!object(work)) {
      throw new TypeError(`Unlocked work ${index} must be an object.`);
    }
    return {
      legacyId: exactLegacyId(work.legacyId, `unlockedWorks[${index}].legacyId`),
      updatedAt: postgresUtcMicrosecondTimestamp(
        work.updatedAt,
        `unlockedWorks[${index}].updatedAt`
      ),
      integritySha256: text(work.integritySha256),
    };
  });
  if (new Set(normalized.map((work) => work.legacyId)).size !== normalized.length) {
    throw new Error("Unlocked archive scope contains duplicate legacy IDs.");
  }
  if (normalized.some((work) => !SHA256.test(work.integritySha256))) {
    throw new Error("Unlocked archive scope contains an invalid integrity SHA-256.");
  }
  normalized.sort((left, right) =>
    Buffer.compare(Buffer.from(left.legacyId, "utf8"), Buffer.from(right.legacyId, "utf8"))
  );
  return sha256(
    normalized
      .map(
        (work) =>
          `${Buffer.from(work.legacyId, "utf8").toString("hex")}:${Buffer.from(work.updatedAt, "utf8").toString("hex")}:${work.integritySha256}`
      )
      .join("\n")
  );
}

/**
 * Builds the exact post-release predecessor-public expectation. The final set
 * must include both predecessor-public works derived from the staged target
 * and every predecessor-public CMS-locked work returned by the precondition
 * RPC, because full replacement deliberately preserves those CMS rows.
 */
export function literaryArchiveReleasePostReleasePredecessorExpectation({
  targetPredecessorLegacyIds,
  preservedCmsLockedPredecessorLegacyIds,
}) {
  if (
    !Array.isArray(targetPredecessorLegacyIds) ||
    !Array.isArray(preservedCmsLockedPredecessorLegacyIds)
  ) {
    throw new TypeError(
      "Target and preserved CMS predecessor legacy-ID arrays are required."
    );
  }
  const combinedLegacyIds = [
    ...targetPredecessorLegacyIds,
    ...preservedCmsLockedPredecessorLegacyIds,
  ];
  return {
    expectedPredecessorPublicCount: combinedLegacyIds.length,
    expectedPredecessorPublicManifestSha256:
      literaryArchiveReleaseLegacyIdManifestSha256(combinedLegacyIds),
  };
}

export function validateLiteraryArchiveChildEditPreservationReceipt(value) {
  const preservation = value;
  if (
    !object(preservation) ||
    !isDeepStrictEqual(Object.keys(preservation).sort(), [
      "auditHighWaterId",
      "evidenceEvents",
      "evidenceSha256",
      "outboxHighWaterId",
      "protectedWorks",
      "schemaVersion",
    ]) ||
    preservation.schemaVersion !==
      LITERARY_ARCHIVE_CHILD_EDIT_PRESERVATION_SCHEMA ||
    !Number.isSafeInteger(preservation.evidenceEvents) ||
    preservation.evidenceEvents < 0 ||
    !Number.isSafeInteger(preservation.protectedWorks) ||
    preservation.protectedWorks < 0 ||
    preservation.protectedWorks > LITERARY_ARCHIVE_RELEASE_ITEM_LIMIT ||
    preservation.protectedWorks > preservation.evidenceEvents ||
    !SHA256.test(preservation.evidenceSha256) ||
    !/^(?:0|[1-9][0-9]*)$/u.test(preservation.auditHighWaterId || "") ||
    !/^(?:0|[1-9][0-9]*)$/u.test(preservation.outboxHighWaterId || "")
  ) {
    throw new Error(
      "Atomic release child-edit preservation receipt is invalid."
    );
  }
  return { ...preservation };
}

export function validateLiteraryArchiveReleasePrecondition(value) {
  if (!object(value)) {
    throw new TypeError("Atomic release precondition receipt is required.");
  }
  const actualKeys = Object.keys(value).sort();
  if (!isDeepStrictEqual(actualKeys, [...PRECONDITION_KEYS])) {
    throw new Error("Atomic release precondition returned an unknown schema.");
  }
  if (
    !Number.isSafeInteger(value.unlockedWorks) ||
    value.unlockedWorks < 0 ||
    value.unlockedWorks > LITERARY_ARCHIVE_RELEASE_ITEM_LIMIT ||
    !Number.isSafeInteger(value.predecessorPublic) ||
    value.predecessorPublic < 0 ||
    value.predecessorPublic > LITERARY_ARCHIVE_RELEASE_ITEM_LIMIT ||
    !SHA256.test(value.unlockedScopeSha256) ||
    !SHA256.test(value.predecessorLegacyManifestSha256) ||
    !Array.isArray(value.cmsLockedPredecessorLegacyIds) ||
    !Array.isArray(value.cmsLockedUnattestedPredecessorLegacyIds)
  ) {
    throw new Error("Atomic release precondition receipt is invalid.");
  }
  const lockedIds = value.cmsLockedPredecessorLegacyIds.map(
    (legacyId, index) =>
      exactLegacyId(
        legacyId,
        `cmsLockedPredecessorLegacyIds[${index}]`
      )
  );
  if (new Set(lockedIds).size !== lockedIds.length) {
    throw new Error("Atomic release precondition contains duplicate CMS IDs.");
  }
  const sortedLockedIds = [...lockedIds].sort((left, right) =>
    Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"))
  );
  if (!isDeepStrictEqual(lockedIds, sortedLockedIds)) {
    throw new Error("Atomic release CMS predecessor IDs are not sorted.");
  }
  if (lockedIds.length > value.predecessorPublic) {
    throw new Error("Atomic release CMS predecessor coverage is impossible.");
  }
  const unattestedLockedIds =
    value.cmsLockedUnattestedPredecessorLegacyIds.map((legacyId, index) =>
      exactLegacyId(
        legacyId,
        `cmsLockedUnattestedPredecessorLegacyIds[${index}]`
      )
    );
  if (new Set(unattestedLockedIds).size !== unattestedLockedIds.length) {
    throw new Error(
      "Atomic release precondition contains duplicate unattested CMS IDs."
    );
  }
  const sortedUnattestedLockedIds = [...unattestedLockedIds].sort(
    (left, right) =>
      Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"))
  );
  if (!isDeepStrictEqual(unattestedLockedIds, sortedUnattestedLockedIds)) {
    throw new Error(
      "Atomic release unattested CMS predecessor IDs are not sorted."
    );
  }
  if (unattestedLockedIds.some((legacyId) => !lockedIds.includes(legacyId))) {
    throw new Error(
      "Atomic release unattested CMS predecessor is not in the locked set."
    );
  }
  const preservation = validateLiteraryArchiveChildEditPreservationReceipt(
    value.childEditPreservation
  );
  return {
    childEditPreservation: { ...preservation },
    unlockedWorks: value.unlockedWorks,
    unlockedScopeSha256: value.unlockedScopeSha256,
    predecessorPublic: value.predecessorPublic,
    predecessorLegacyManifestSha256:
      value.predecessorLegacyManifestSha256,
    cmsLockedPredecessorLegacyIds: lockedIds,
    cmsLockedUnattestedPredecessorLegacyIds: unattestedLockedIds,
  };
}

function postgresBtrim(value) {
  return typeof value === "string" ? value.replace(/^ +| +$/gu, "") : "";
}

function postgresCharacterLength(value) {
  return [...value].length;
}

function postgresSentenceCount(value) {
  return value.match(/[.!?…]+(?=\s|$)/gu)?.length || 0;
}

function containsDatabaseCyrillic(value) {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (
      (codePoint >= 1024 && codePoint <= 1327) ||
      (codePoint >= 7296 && codePoint <= 7311) ||
      (codePoint >= 11744 && codePoint <= 11775) ||
      (codePoint >= 42560 && codePoint <= 42655) ||
      (codePoint >= 65070 && codePoint <= 65071) ||
      (codePoint >= 122928 && codePoint <= 123023)
    ) {
      return true;
    }
  }
  return false;
}

/** Mirrors is_publishable_literary_work_pre_evidence_v2 for staged rows. */
export function isLiteraryArchiveReleasePreEvidencePublishable(item) {
  if (!object(item) || !object(item.work)) return false;
  if (!["reviewed", "verified"].includes(item.work.editorial_status)) {
    return false;
  }
  if (!Array.isArray(item.sources) || item.sources.length < 1) return false;
  if (
    item.sources.some(
      (source) =>
        !object(source) ||
        !postgresBtrim(source.provider) ||
        !/^https:\/\//iu.test(source.source_url || "") ||
        !Array.isArray(source.field_names) ||
        source.field_names.length < 1 ||
        source.retrieved_at === null ||
        source.retrieved_at === undefined
    )
  ) {
    return false;
  }

  const sourceByUrl = new Map(
    item.sources.map((source) => [source.source_url, source])
  );
  const qualifiedLocales = new Set();
  for (const translation of Array.isArray(item.translations)
    ? item.translations
    : []) {
    if (!object(translation) || !["ru", "en"].includes(translation.locale)) {
      continue;
    }
    const description = postgresBtrim(translation.description);
    const declaredUrls = Array.isArray(translation.source_urls)
      ? translation.source_urls
      : [];
    const declaredSourcesValid =
      declaredUrls.length > 0 &&
      declaredUrls.every(
        (url) =>
          typeof url === "string" &&
          /^https:\/\//iu.test(postgresBtrim(url)) &&
          sourceByUrl.has(postgresBtrim(url))
      );
    const licensedSourceValid =
      translation.translation_method !== "licensed-source" ||
      declaredUrls.some((url) => {
        const source = sourceByUrl.get(postgresBtrim(url));
        return (
          source?.usage === "licensed-copy" &&
          Boolean(postgresBtrim(source.license_name))
        );
      });
    const localeTextValid =
      translation.locale === "ru"
        ? /[А-Яа-яЁё]/u.test(description)
        : /[A-Za-z]/u.test(description) &&
          !containsDatabaseCyrillic(
            `${translation.title || ""}${translation.description || ""}`
          );
    if (
      ["reviewed", "verified"].includes(translation.editorial_status) &&
      translation.reviewed_at !== null &&
      translation.reviewed_at !== undefined &&
      Boolean(postgresBtrim(translation.title)) &&
      Boolean(postgresBtrim(translation.source_language)) &&
      postgresCharacterLength(description) >= 140 &&
      postgresCharacterLength(description) <= 900 &&
      postgresSentenceCount(description) >= 2 &&
      postgresSentenceCount(description) <= 3 &&
      localeTextValid &&
      !["Р°", "Рµ", "Рё", "СЃ", "С‚", "вЂ"].some((marker) =>
        description.includes(marker)
      ) &&
      declaredSourcesValid &&
      licensedSourceValid
    ) {
      qualifiedLocales.add(translation.locale);
    }
  }
  return qualifiedLocales.size === 2;
}

/**
 * Logical payload encoded for stage_literary_archive_release_batch:
 * {
 *   ordinal, legacyId,
 *   expectedLive: { exists, updatedAt, integritySha256 },
 *   work, expectedContent,
 *   authors, translations, sources, externalIds, editions, artworks,
 *   attestation: null | { expectedContent, evidence, reviewer, reviewedAt }
 * }
 *
 * stage args wrap it as { ordinal, legacyId, canonicalPayload,
 * payloadSha256 }. PostgreSQL hashes the exact canonicalPayload string,
 * parses it back to jsonb and verifies both identity and structure.
 * Work and child rows use the database snake_case columns. Child work_id and
 * database-generated id fields are intentionally absent; commit binds every
 * row to the preserved/new work UUID by legacyId inside the transaction.
 */
export function partitionLiteraryArchiveReleaseItems(
  items,
  batchSize = LITERARY_ARCHIVE_RELEASE_BATCH_LIMIT
) {
  if (!Array.isArray(items) || items.length < 1) {
    throw new TypeError("Atomic release items must be a non-empty array.");
  }
  if (items.length > LITERARY_ARCHIVE_RELEASE_ITEM_LIMIT) {
    throw new RangeError(
      `Atomic release exceeds ${LITERARY_ARCHIVE_RELEASE_ITEM_LIMIT} items.`
    );
  }
  positiveInteger(batchSize, "Batch size");
  if (batchSize > LITERARY_ARCHIVE_RELEASE_BATCH_LIMIT) {
    throw new RangeError(
      `Atomic release batches may contain at most ${LITERARY_ARCHIVE_RELEASE_BATCH_LIMIT} items.`
    );
  }

  const legacyIds = new Set();
  items.forEach((item, ordinal) => {
    if (!object(item)) {
      throw new TypeError(`Release item ${ordinal} must be an object.`);
    }
    if (item.ordinal !== ordinal) {
      throw new Error(
        `Release ordinals must be contiguous from zero; found ${String(item.ordinal)} at ${ordinal}.`
      );
    }
    const legacyId = exactLegacyId(
      item.legacyId,
      `Release item ${ordinal}.legacyId`
    );
    if (item?.work?.legacy_id !== legacyId) {
      throw new Error(`Release item ${ordinal} has a mismatched legacyId.`);
    }
    if (legacyIds.has(legacyId)) {
      throw new Error(`Duplicate release legacyId: ${legacyId}.`);
    }
    legacyIds.add(legacyId);
    if (!object(item.expectedLive)) {
      throw new TypeError(`Release item ${legacyId} has no live precondition.`);
    }
    if (item.expectedLive.exists) {
      if (
        !text(item.expectedLive.updatedAt) ||
        !SHA256.test(text(item.expectedLive.integritySha256))
      ) {
        throw new Error(
          `Existing release item ${legacyId} requires timestamp and integrity SHA-256.`
        );
      }
    } else if (
      item.expectedLive.exists !== false ||
      item.expectedLive.updatedAt !== null ||
      item.expectedLive.integritySha256 !== null
    ) {
      throw new Error(
        `New release item ${legacyId} must use explicit null live preconditions.`
      );
    }
    for (const field of [
      "authors",
      "translations",
      "sources",
      "externalIds",
      "editions",
      "artworks",
    ]) {
      if (!Array.isArray(item[field])) {
        throw new TypeError(`Release item ${legacyId}.${field} must be an array.`);
      }
    }
    if (!object(item.expectedContent)) {
      throw new TypeError(
        `Release item ${legacyId}.expectedContent must be an object.`
      );
    }
    if (item.attestation !== null && !object(item.attestation)) {
      throw new TypeError(
        `Release item ${legacyId}.attestation must be an object or null.`
      );
    }
    if (
      item.attestation &&
      !isDeepStrictEqual(item.attestation.expectedContent, item.expectedContent)
    ) {
      throw new Error(
        `Release item ${legacyId} has divergent attestation expectedContent.`
      );
    }
  });

  const batches = [];
  let batch = [];
  let serializedBytes = 2;
  for (const releaseItem of items) {
    const envelopeBytes = Buffer.byteLength(
      JSON.stringify(encodeLiteraryArchiveReleaseItem(releaseItem)),
      "utf8"
    );
    const separatorBytes = batch.length ? 1 : 0;
    if (
      batch.length > 0 &&
      (batch.length >= batchSize ||
        serializedBytes + separatorBytes + envelopeBytes >
          LITERARY_ARCHIVE_RELEASE_BATCH_BYTES)
    ) {
      batches.push(batch);
      batch = [];
      serializedBytes = 2;
    }
    batch.push(releaseItem);
    serializedBytes += (batch.length > 1 ? 1 : 0) + envelopeBytes;
  }
  if (batch.length) batches.push(batch);
  return batches;
}

export function literaryArchiveReleaseCreateArgs({
  releaseKey,
  sourceRevision,
  expectedItemCount,
  expectedBatchCount,
  expectedUnlockedWorkCount,
  expectedUnlockedScopeSha256,
  expectedChildEditPreservation,
  expectedTargetManifestSha256,
  expectedPredecessorPublicCount,
  expectedPredecessorPublicManifestSha256,
  enableEvidenceV2,
  metadata = {},
}) {
  const normalizedReleaseKey = text(releaseKey);
  const normalizedSourceRevision = text(sourceRevision);
  if (!RELEASE_KEY.test(normalizedReleaseKey)) {
    throw new TypeError("Atomic release key is invalid.");
  }
  if (
    normalizedSourceRevision.length < 7 ||
    normalizedSourceRevision.length > 160
  ) {
    throw new TypeError("Atomic release source revision is invalid.");
  }
  positiveInteger(expectedItemCount, "Expected item count");
  positiveInteger(expectedBatchCount, "Expected batch count");
  if (
    expectedItemCount > LITERARY_ARCHIVE_RELEASE_ITEM_LIMIT ||
    expectedBatchCount > expectedItemCount ||
    expectedBatchCount <
      Math.ceil(expectedItemCount / LITERARY_ARCHIVE_RELEASE_BATCH_LIMIT)
  ) {
    throw new RangeError("Atomic release item/batch bounds are invalid.");
  }
  if (
    !Number.isSafeInteger(expectedUnlockedWorkCount) ||
    expectedUnlockedWorkCount < 0 ||
    expectedUnlockedWorkCount > LITERARY_ARCHIVE_RELEASE_ITEM_LIMIT ||
    !SHA256.test(text(expectedUnlockedScopeSha256)) ||
    !SHA256.test(text(expectedTargetManifestSha256)) ||
    !Number.isSafeInteger(expectedPredecessorPublicCount) ||
    expectedPredecessorPublicCount < 0 ||
    expectedPredecessorPublicCount > LITERARY_ARCHIVE_RELEASE_ITEM_LIMIT ||
    !SHA256.test(text(expectedPredecessorPublicManifestSha256))
  ) {
    throw new RangeError("Atomic release scope/public manifest is invalid.");
  }
  const childEditPreservation =
    validateLiteraryArchiveChildEditPreservationReceipt(
      expectedChildEditPreservation
    );
  if (typeof enableEvidenceV2 !== "boolean" || !object(metadata)) {
    throw new TypeError("Atomic release gate flag or metadata is invalid.");
  }
  return {
    p_release_key: normalizedReleaseKey,
    p_source_revision: normalizedSourceRevision,
    p_expected_item_count: expectedItemCount,
    p_expected_batch_count: expectedBatchCount,
    p_expected_unlocked_work_count: expectedUnlockedWorkCount,
    p_expected_unlocked_scope_sha256: text(expectedUnlockedScopeSha256),
    p_expected_child_edit_preservation: childEditPreservation,
    p_expected_target_manifest_sha256: text(expectedTargetManifestSha256),
    p_expected_predecessor_public_count: expectedPredecessorPublicCount,
    p_expected_predecessor_public_manifest_sha256: text(
      expectedPredecessorPublicManifestSha256
    ),
    p_enable_evidence_v2: enableEvidenceV2,
    p_metadata: metadata,
  };
}

export function literaryArchiveReleaseStageArgs(
  releaseId,
  batchNumber,
  items
) {
  const normalizedReleaseId = text(releaseId);
  if (!normalizedReleaseId) {
    throw new TypeError("Atomic release ID is required.");
  }
  positiveInteger(batchNumber, "Batch number");
  if (!Array.isArray(items) || items.length < 1 || items.length > 100) {
    throw new RangeError("Atomic release stage batch must contain 1-100 items.");
  }
  const envelopes = items.map(encodeLiteraryArchiveReleaseItem);
  if (
    Buffer.byteLength(JSON.stringify(envelopes), "utf8") >
    LITERARY_ARCHIVE_RELEASE_BATCH_BYTES
  ) {
    throw new RangeError("Atomic release stage batch exceeds its byte limit.");
  }
  return {
    p_release_id: normalizedReleaseId,
    p_batch_number: batchNumber,
    p_items: envelopes,
  };
}

/**
 * Verifies that server receipts cover the exact local batch partition. Both
 * runtimes hash the same UTF-8 manifest-entry strings; the echoed parsed
 * payload must also be deeply equal to the local logical item.
 */
export function verifiedLiteraryArchiveManifestFromReceipts({
  releaseId,
  batches,
  receipts,
}) {
  const normalizedReleaseId = text(releaseId);
  if (!normalizedReleaseId || !Array.isArray(batches) || !Array.isArray(receipts)) {
    throw new TypeError("Release ID, batches and receipts are required.");
  }
  if (batches.length < 1 || receipts.length !== batches.length) {
    throw new Error("Atomic release receipt coverage is incomplete.");
  }

  let expectedItems = 0;
  const seenOrdinals = new Set();
  const localEnvelopes = [];
  for (let index = 0; index < batches.length; index += 1) {
    const batch = batches[index];
    const receipt = receipts[index];
    if (!Array.isArray(batch) || !object(receipt)) {
      throw new TypeError(`Atomic release receipt ${index + 1} is invalid.`);
    }
    const batchEnvelopes = batch.map(encodeLiteraryArchiveReleaseItem);
    if (
      receipt.releaseId !== normalizedReleaseId ||
      receipt.batchNumber !== index + 1 ||
      receipt.itemCount !== batch.length ||
      !SHA256.test(text(receipt.batchSha256)) ||
      !Array.isArray(receipt.items) ||
      receipt.items.length !== batch.length
    ) {
      throw new Error(`Atomic release receipt ${index + 1} does not match its batch.`);
    }
    for (let itemIndex = 0; itemIndex < batch.length; itemIndex += 1) {
      const localItem = batch[itemIndex];
      const localEnvelope = batchEnvelopes[itemIndex];
      const receivedItem = receipt.items[itemIndex];
      if (
        !object(receivedItem) ||
        receivedItem.ordinal !== localItem.ordinal ||
        receivedItem.legacyId !== localItem.legacyId ||
        receivedItem.payloadSha256 !== localEnvelope.payloadSha256 ||
        !isDeepStrictEqual(receivedItem.payload, localItem) ||
        seenOrdinals.has(receivedItem.ordinal)
      ) {
        throw new Error(
          `Atomic release item receipt mismatch in batch ${index + 1}.`
        );
      }
      seenOrdinals.add(receivedItem.ordinal);
      localEnvelopes.push(localEnvelope);
    }
    const expectedBatchSha256 = literaryArchiveReleaseBatchManifestSha256(batch);
    if (receipt.batchSha256 !== expectedBatchSha256) {
      throw new Error(`Atomic release batch SHA mismatch in batch ${index + 1}.`);
    }
    expectedItems += batch.length;
  }

  const finalReceipt = receipts.at(-1);
  const expectedManifestSha256 = sha256(
    localEnvelopes.map(targetManifestEntry).join("\n")
  );
  if (
    finalReceipt.stagedItems !== expectedItems ||
    finalReceipt.stagedBatches !== batches.length ||
    finalReceipt.manifestSha256 !== expectedManifestSha256
  ) {
    throw new Error("Final atomic release manifest receipt is incomplete.");
  }
  return finalReceipt.manifestSha256;
}

export function literaryArchiveReleaseCommitArgs(
  releaseId,
  expectedManifestSha256
) {
  const normalizedReleaseId = text(releaseId);
  const normalizedManifest = text(expectedManifestSha256);
  if (!normalizedReleaseId || !SHA256.test(normalizedManifest)) {
    throw new TypeError("Atomic release ID and manifest SHA-256 are required.");
  }
  return {
    p_release_id: normalizedReleaseId,
    p_expected_manifest_sha256: normalizedManifest,
  };
}

async function atomicReleaseRpc(
  supabase,
  name,
  args,
  { attempts, retryDelayMs, onRetry }
) {
  if (!supabase || typeof supabase.rpc !== "function") {
    throw new TypeError("A Supabase RPC client is required.");
  }
  let failure;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await supabase.rpc(name, args);
      if (!object(response)) {
        failure = new Error("Supabase returned no RPC response envelope.");
      } else if (response.error) {
        failure = new Error(response.error.message || "Unknown RPC error.");
      } else {
        return response.data;
      }
    } catch (error) {
      failure =
        error instanceof Error ? error : new Error(String(error));
    }
    if (attempt < attempts) {
      onRetry(name, attempt, failure);
      if (retryDelayMs > 0) {
        await new Promise((resolve) =>
          setTimeout(resolve, retryDelayMs * attempt)
        );
      }
    }
  }
  throw new Error(
    `Atomic release RPC ${name} failed after ${attempts} attempts: ${failure?.message || "unknown failure"}`,
    { cause: failure }
  );
}

/**
 * The only mutating client workflow for a full archive release. The first RPC
 * is a read-only drift check; every following write targets private staging
 * until commit_literary_archive_release performs the one live transaction.
 */
export async function publishLiteraryArchiveAtomicRelease({
  supabase,
  items,
  expectedPrecondition,
  releaseKey,
  sourceRevision,
  expectedPredecessorPublicCount,
  expectedPredecessorPublicManifestSha256,
  enableEvidenceV2 = false,
  metadata = {},
  logger = () => {},
  rpcAttempts = 3,
  rpcRetryDelayMs = 150,
}) {
  if (
    !Number.isSafeInteger(rpcAttempts) ||
    rpcAttempts < 1 ||
    rpcAttempts > 5 ||
    !Number.isSafeInteger(rpcRetryDelayMs) ||
    rpcRetryDelayMs < 0 ||
    rpcRetryDelayMs > 5_000
  ) {
    throw new RangeError("Atomic release RPC retry policy is invalid.");
  }
  const releaseRpc = (name, args) =>
    atomicReleaseRpc(supabase, name, args, {
      attempts: rpcAttempts,
      retryDelayMs: rpcRetryDelayMs,
      onRetry: (rpcName, attempt, error) =>
        logger(
          `Atomic release RPC ${rpcName} retry ${attempt}/${rpcAttempts - 1}: ${error.message}`
        ),
    });
  const precondition = validateLiteraryArchiveReleasePrecondition(
    expectedPrecondition
  );
  const currentPrecondition = validateLiteraryArchiveReleasePrecondition(
    await releaseRpc(
      "get_literary_archive_release_precondition",
      {}
    )
  );
  if (!isDeepStrictEqual(currentPrecondition, precondition)) {
    throw new Error("Atomic release precondition drifted before create.");
  }

  const batches = partitionLiteraryArchiveReleaseItems(items);
  const targetManifestSha256 =
    literaryArchiveReleaseTargetManifestSha256(items);
  const createArgs = literaryArchiveReleaseCreateArgs({
    releaseKey,
    sourceRevision,
    expectedItemCount: items.length,
    expectedBatchCount: batches.length,
    expectedUnlockedWorkCount: precondition.unlockedWorks,
    expectedUnlockedScopeSha256: precondition.unlockedScopeSha256,
    expectedChildEditPreservation: precondition.childEditPreservation,
    expectedTargetManifestSha256: targetManifestSha256,
    expectedPredecessorPublicCount,
    expectedPredecessorPublicManifestSha256,
    enableEvidenceV2,
    metadata,
  });
  const createReceipt = await releaseRpc(
    "create_literary_archive_release",
    createArgs
  );
  if (
    !object(createReceipt) ||
    !text(createReceipt.releaseId) ||
    createReceipt.releaseKey !== createArgs.p_release_key ||
    createReceipt.sourceRevision !== createArgs.p_source_revision ||
    createReceipt.contractVersion !== LITERARY_ARCHIVE_RELEASE_CONTRACT ||
    !["staging", "committed"].includes(createReceipt.status) ||
    createReceipt.expectedItems !== items.length ||
    createReceipt.expectedBatches !== batches.length ||
    !isDeepStrictEqual(
      createReceipt.expectedChildEditPreservation,
      precondition.childEditPreservation
    ) ||
    createReceipt.expectedTargetManifestSha256 !== targetManifestSha256
  ) {
    throw new Error("Atomic release create receipt is invalid.");
  }
  const releaseId = text(createReceipt.releaseId);
  logger(
    `Atomic release ${releaseId}: create confirmed (${createReceipt.status}).`
  );

  const receipts = [];
  for (let index = 0; index < batches.length; index += 1) {
    const receipt = await releaseRpc(
      "stage_literary_archive_release_batch",
      literaryArchiveReleaseStageArgs(releaseId, index + 1, batches[index])
    );
    receipts.push(receipt);
    logger(
      `Atomic release ${releaseId}: staged batch ${index + 1}/${batches.length}.`
    );
  }
  const verifiedManifestSha256 = verifiedLiteraryArchiveManifestFromReceipts({
    releaseId,
    batches,
    receipts,
  });
  if (verifiedManifestSha256 !== targetManifestSha256) {
    throw new Error("Atomic release server manifest differs from local target.");
  }

  const commitReceipt = await releaseRpc(
    "commit_literary_archive_release",
    literaryArchiveReleaseCommitArgs(releaseId, verifiedManifestSha256)
  );
  if (
    !object(commitReceipt) ||
    commitReceipt.releaseId !== releaseId ||
    commitReceipt.releaseKey !== createArgs.p_release_key ||
    commitReceipt.sourceRevision !== createArgs.p_source_revision ||
    commitReceipt.contractVersion !== LITERARY_ARCHIVE_RELEASE_CONTRACT ||
    commitReceipt.status !== "committed" ||
    commitReceipt.manifestSha256 !== verifiedManifestSha256 ||
    commitReceipt.items !== items.length ||
    commitReceipt.batches !== batches.length ||
    !isDeepStrictEqual(
      commitReceipt.childEditPreservation,
      precondition.childEditPreservation
    ) ||
    typeof commitReceipt.idempotent !== "boolean"
  ) {
    throw new Error("Atomic release commit receipt is invalid.");
  }
  logger(
    `Atomic release ${releaseId}: committed ${items.length} works atomically.`
  );
  return {
    releaseId,
    targetManifestSha256,
    createReceipt,
    stageReceipts: receipts,
    commitReceipt,
  };
}
