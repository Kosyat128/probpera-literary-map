import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

export const DUPLICATE_RESOLUTION_SCHEMA_VERSION = 1;
export const DUPLICATE_RESOLUTION_HASH_PROFILE =
  "sha256-canonical-json-resolution-v1";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const RECORD_KEY = /^[^:\s]+:[^:\s]+:[^:\s]+$/u;
const SOURCE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const TARGET_ID = SOURCE_ID;
const REVIEW_STATUSES = new Set(["accepted", "held"]);
const DECISION_STATUSES = new Set(["merge", "alias", "hold"]);
const ENTITY_KINDS = new Set(["work", "manifestation"]);
const ENDPOINT_KINDS = new Set(["record", "source-title"]);
const WORK_YEAR_STATUSES = new Set(["authority-backed", "withheld"]);
const OPEN_LIBRARY_HOSTNAME = "openlibrary.org";
const OPEN_LIBRARY_WORK_PATH = /^\/works\/(OL\d+W)$/u;
export const REVIEWED_DUPLICATE_RESOLUTION_MERGE_BASIS =
  "canon-reviewed-work-identity-resolution";
export const REVIEWED_DUPLICATE_RESOLUTION_ALIAS_BASIS =
  "canon-reviewed-exact-title-alias";
const SOURCE_KINDS = new Set([
  "national-library-exhibit-record",
  "national-library-bibliographic-record",
  "national-library-work-authority-record",
  "national-library-heritage-record",
  "official-scholarly-document-edition",
  "official-special-collections-catalog",
  "official-special-collections-finding-aid",
  "official-author-site-publication",
  "official-publisher-record",
  "official-scholarly-critical-edition",
  "official-university-author-record",
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

export function targetResolutionFingerprint(target) {
  if (!isRecord(target)) return sha256Canonical(null);
  const protectedTarget = { ...target };
  delete protectedTarget.reviewFingerprint;
  return sha256Canonical(protectedTarget);
}

export function duplicateResolutionManifestFingerprint(manifest) {
  if (!isRecord(manifest)) return sha256Canonical(null);
  const protectedManifest = { ...manifest };
  delete protectedManifest.manifestFingerprint;
  return sha256Canonical(protectedManifest);
}

export async function loadReviewedDuplicateResolutionManifest(filePath) {
  const manifest = JSON.parse(await readFile(filePath, "utf8"));
  if (!SHA256.test(manifest?.manifestFingerprint || "")) {
    throw new Error("duplicate-resolution-manifest-fingerprint-invalid");
  }
  if (
    manifest.manifestFingerprint !==
    duplicateResolutionManifestFingerprint(manifest)
  ) {
    throw new Error("duplicate-resolution-manifest-fingerprint-mismatch");
  }
  return manifest;
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

function observedInputMap(enrichmentManifest) {
  const result = new Map();
  if (!isRecord(enrichmentManifest) || !Array.isArray(enrichmentManifest.records)) {
    return result;
  }
  for (const record of enrichmentManifest.records) {
    if (!isRecord(record) || !exactText(record.recordKey)) continue;
    result.set(record.recordKey, record);
  }
  return result;
}

function endpointIssues({ endpoint, prefix, status, side, sourceIds }) {
  const issues = [];
  if (endpoint === null) {
    if (side !== "to" || status !== "hold") {
      issues.push(`${prefix} may be null only for a hold destination`);
    }
    return issues;
  }
  if (!isRecord(endpoint)) {
    issues.push(`${prefix} must be an object`);
    return issues;
  }
  if (!ENDPOINT_KINDS.has(endpoint.kind)) {
    issues.push(`${prefix}.kind is invalid`);
    return issues;
  }
  if (!exactText(endpoint.value)) {
    issues.push(`${prefix}.value must be exact nonempty text`);
  }
  if (endpoint.kind === "record") {
    if (!RECORD_KEY.test(endpoint.value || "")) {
      issues.push(`${prefix}.value must be a recordKey`);
    }
    if (!SHA256.test(endpoint.observedInputFingerprint || "")) {
      issues.push(`${prefix}.observedInputFingerprint must be sha256`);
    }
    if ("sourceId" in endpoint) {
      issues.push(`${prefix}.sourceId is forbidden for a record endpoint`);
    }
  } else {
    if (side !== "from" || status !== "alias") {
      issues.push(`${prefix} source-title is allowed only as an alias source`);
    }
    if (!exactText(endpoint.sourceId)) {
      issues.push(`${prefix}.sourceId is required for a source-title`);
    } else if (!sourceIds.has(endpoint.sourceId)) {
      issues.push(`${prefix}.sourceId is not among the target sources`);
    }
    if ("observedInputFingerprint" in endpoint) {
      issues.push(
        `${prefix}.observedInputFingerprint is forbidden for a source-title`
      );
    }
  }
  return issues;
}

function summaryCounts(targets) {
  const decisions = { merge: 0, alias: 0, hold: 0 };
  for (const target of targets) {
    for (const decision of target.decisions || []) {
      if (decision.status in decisions) decisions[decision.status] += 1;
    }
  }
  return {
    targetCount: targets.length,
    acceptedTargetCount: targets.filter(
      (target) => target.reviewStatus === "accepted"
    ).length,
    heldTargetCount: targets.filter((target) => target.reviewStatus === "held")
      .length,
    decisionCounts: decisions,
    potentiallyUnblockedCanonHoldCount: targets.filter(
      (target) => target.reviewStatus === "accepted"
    ).length,
  };
}

export function duplicateResolutionIssues(
  manifest,
  { canonRegistry = null, enrichmentManifest = null } = {}
) {
  const issues = [];
  if (!isRecord(manifest)) return ["manifest must be an object"];
  if (!isRecord(canonRegistry)) {
    issues.push("canon-registry-required");
  }

  if (manifest.schemaVersion !== DUPLICATE_RESOLUTION_SCHEMA_VERSION) {
    issues.push("schemaVersion must be 1");
  }
  if (!TARGET_ID.test(manifest.manifestId || "")) {
    issues.push("manifestId must be a stable lowercase slug");
  }
  if (!isIsoCalendarDate(manifest.checkedAt)) {
    issues.push("checkedAt must be an ISO calendar date");
  }
  if (manifest.applicationStatus !== "generator-approved") {
    issues.push("applicationStatus must be generator-approved");
  }
  if (!exactText(manifest.reviewPolicy, 120)) {
    issues.push("reviewPolicy must state the non-executable review boundary");
  }
  if (manifest.hashProfile !== DUPLICATE_RESOLUTION_HASH_PROFILE) {
    issues.push("hashProfile is invalid");
  }
  if (!isRecord(manifest.activation)) {
    issues.push("activation must be an object");
  } else {
    if (manifest.activation.contractVersion !== 1) {
      issues.push("activation.contractVersion must be 1");
    }
    if (
      manifest.activation.consumer !==
      "scripts/build-book-enrichment-manifest.mjs"
    ) {
      issues.push("activation.consumer is invalid");
    }
    if (!Array.isArray(manifest.activation.approvedDecisionIds)) {
      issues.push("activation.approvedDecisionIds must be an array");
    }
    if (!Array.isArray(manifest.activation.excludedDecisionIds)) {
      issues.push("activation.excludedDecisionIds must be an array");
    }
  }

  const sources = Array.isArray(manifest.sourceAuthorities)
    ? manifest.sourceAuthorities
    : [];
  if (sources.length < 2) {
    issues.push("sourceAuthorities must contain at least two sources");
  }
  const sourceIds = sources.map((source) => source?.sourceId);
  for (const duplicate of duplicateValues(sourceIds)) {
    issues.push(`duplicate sourceId ${duplicate}`);
  }
  const sourceById = new Map();
  for (const [index, source] of sources.entries()) {
    const prefix = `sourceAuthorities[${index}]`;
    if (!isRecord(source)) {
      issues.push(`${prefix} must be an object`);
      continue;
    }
    if (!SOURCE_ID.test(source.sourceId || "")) {
      issues.push(`${prefix}.sourceId is invalid`);
    } else {
      sourceById.set(source.sourceId, source);
    }
    if (!exactText(source.authority, 3)) {
      issues.push(`${prefix}.authority is invalid`);
    }
    if (!SOURCE_ID.test(source.independenceGroup || "")) {
      issues.push(`${prefix}.independenceGroup is invalid`);
    }
    if (!SOURCE_KINDS.has(source.sourceKind)) {
      issues.push(`${prefix}.sourceKind is not controlled`);
    }
    const parsed = parsedHttpsUrl(source.url);
    if (!parsed) {
      issues.push(`${prefix}.url must be an immutable HTTPS URL`);
    } else if (parsed.hostname === OPEN_LIBRARY_HOSTNAME) {
      issues.push(`${prefix}.url cannot use Open Library as evidence`);
    }
    if (!exactText(source.recordId, 3)) {
      issues.push(`${prefix}.recordId must be explicit immutable text`);
    }
    if (!Array.isArray(source.claims) || source.claims.length < 3) {
      issues.push(`${prefix}.claims must contain at least three exact facts`);
    } else {
      source.claims.forEach((claim, claimIndex) => {
        if (!exactText(claim, 30)) {
          issues.push(`${prefix}.claims[${claimIndex}] is too weak`);
        }
      });
    }
  }

  const targets = Array.isArray(manifest.targets) ? manifest.targets : [];
  if (targets.length === 0) issues.push("targets must not be empty");
  const targetIds = targets.map((target) => target?.targetId);
  for (const duplicate of duplicateValues(targetIds)) {
    issues.push(`duplicate targetId ${duplicate}`);
  }

  const registryItems = registryItemMap(canonRegistry);
  const observedInputs = observedInputMap(enrichmentManifest);
  const decisionIds = [];
  const decisionStatusById = new Map();
  const decisionTargetReviewStatusById = new Map();
  const mergeSources = [];
  const mergeEdges = new Map();

  for (const [targetIndex, target] of targets.entries()) {
    const prefix = `targets[${targetIndex}]`;
    if (!isRecord(target)) {
      issues.push(`${prefix} must be an object`);
      continue;
    }
    if (!TARGET_ID.test(target.targetId || "")) {
      issues.push(`${prefix}.targetId is invalid`);
    }
    if (!REVIEW_STATUSES.has(target.reviewStatus)) {
      issues.push(`${prefix}.reviewStatus is invalid`);
    }
    if (!isRecord(target.canonicalIdentity)) {
      issues.push(`${prefix}.canonicalIdentity must be an object`);
    } else {
      if (target.canonicalIdentity.entityKind !== "work") {
        issues.push(`${prefix}.canonicalIdentity.entityKind must be work`);
      }
      if (!exactText(target.canonicalIdentity.title, 2)) {
        issues.push(`${prefix}.canonicalIdentity.title is invalid`);
      }
      if (
        !Array.isArray(target.canonicalIdentity.authors) ||
        target.canonicalIdentity.authors.length === 0 ||
        target.canonicalIdentity.authors.some((author) => !exactText(author, 3))
      ) {
        issues.push(`${prefix}.canonicalIdentity.authors is invalid`);
      }
    }

    const targetSourceIds = Array.isArray(target.sourceIds)
      ? target.sourceIds
      : [];
    if (targetSourceIds.length < 2) {
      issues.push(`${prefix}.sourceIds needs at least two official sources`);
    }
    for (const duplicate of duplicateValues(targetSourceIds)) {
      issues.push(`${prefix}.sourceIds duplicates ${duplicate}`);
    }
    const targetSources = targetSourceIds
      .map((sourceId) => sourceById.get(sourceId))
      .filter(Boolean);
    for (const sourceId of targetSourceIds) {
      if (!sourceById.has(sourceId)) {
        issues.push(`${prefix}.sourceIds references unknown ${sourceId}`);
      }
    }
    const independenceGroups = new Set(
      targetSources.map((source) => source.independenceGroup)
    );
    if (independenceGroups.size < 2) {
      issues.push(`${prefix} lacks two independent official evidence groups`);
    }

    if (!isRecord(target.workYearResolution)) {
      issues.push(`${prefix}.workYearResolution must be an object`);
    } else {
      const yearResolution = target.workYearResolution;
      if (!WORK_YEAR_STATUSES.has(yearResolution.status)) {
        issues.push(`${prefix}.workYearResolution.status is invalid`);
      }
      if (
        yearResolution.status === "authority-backed" &&
        (!Number.isInteger(yearResolution.value) ||
          yearResolution.value < 1000 ||
          yearResolution.value > 2100)
      ) {
        issues.push(
          `${prefix}.workYearResolution.value must be an authority-backed year`
        );
      }
      if (
        yearResolution.status === "withheld" &&
        yearResolution.value !== null
      ) {
        issues.push(
          `${prefix}.workYearResolution.value must be null when withheld`
        );
      }
      if (
        !Array.isArray(yearResolution.sourceIds) ||
        yearResolution.sourceIds.length === 0
      ) {
        issues.push(`${prefix}.workYearResolution.sourceIds must not be empty`);
      } else {
        for (const sourceId of yearResolution.sourceIds) {
          if (!targetSourceIds.includes(sourceId)) {
            issues.push(
              `${prefix}.workYearResolution references non-target source ${sourceId}`
            );
          }
        }
        for (const duplicate of duplicateValues(yearResolution.sourceIds)) {
          issues.push(
            `${prefix}.workYearResolution.sourceIds duplicates ${duplicate}`
          );
        }
      }
      if (!exactText(yearResolution.reason, 100)) {
        issues.push(`${prefix}.workYearResolution.reason is too weak`);
      }
    }

    if (!isRecord(target.canonHoldRef)) {
      issues.push(`${prefix}.canonHoldRef must be an object`);
    } else {
      const ref = target.canonHoldRef;
      if (!exactText(ref.sourceId) || !exactText(ref.itemId)) {
        issues.push(`${prefix}.canonHoldRef identity is invalid`);
      }
      if (!SHA256.test(ref.itemHash || "")) {
        issues.push(`${prefix}.canonHoldRef.itemHash must be sha256`);
      }
      if (canonRegistry) {
        const item = registryItems.get(`${ref.sourceId}:${ref.itemId}`);
        if (!item) {
          issues.push(`${prefix}.canonHoldRef is absent from the registry`);
        } else if (item.itemHash !== ref.itemHash) {
          issues.push(`${prefix}.canonHoldRef.itemHash is stale`);
        }
      }
    }

    const decisions = Array.isArray(target.decisions) ? target.decisions : [];
    if (decisions.length === 0) {
      issues.push(`${prefix}.decisions must not be empty`);
    }
    const localSourceIds = new Set(targetSourceIds);
    for (const [decisionIndex, decision] of decisions.entries()) {
      const decisionPrefix = `${prefix}.decisions[${decisionIndex}]`;
      if (!isRecord(decision)) {
        issues.push(`${decisionPrefix} must be an object`);
        continue;
      }
      if (!SOURCE_ID.test(decision.decisionId || "")) {
        issues.push(`${decisionPrefix}.decisionId is invalid`);
      } else {
        decisionIds.push(decision.decisionId);
        decisionStatusById.set(decision.decisionId, decision.status);
        decisionTargetReviewStatusById.set(
          decision.decisionId,
          target.reviewStatus
        );
      }
      if (!DECISION_STATUSES.has(decision.status)) {
        issues.push(`${decisionPrefix}.status is invalid`);
      }
      if (!ENTITY_KINDS.has(decision.entityKind)) {
        issues.push(`${decisionPrefix}.entityKind is invalid`);
      }
      if (decision.status === "hold" && decision.entityKind !== "manifestation") {
        issues.push(`${decisionPrefix} hold must preserve a manifestation`);
      }
      if (
        (decision.status === "merge" || decision.status === "alias") &&
        decision.entityKind !== "work"
      ) {
        issues.push(`${decisionPrefix} merge/alias must resolve a Work`);
      }
      issues.push(
        ...endpointIssues({
          endpoint: decision.from,
          prefix: `${decisionPrefix}.from`,
          status: decision.status,
          side: "from",
          sourceIds: localSourceIds,
        })
      );
      issues.push(
        ...endpointIssues({
          endpoint: decision.to,
          prefix: `${decisionPrefix}.to`,
          status: decision.status,
          side: "to",
          sourceIds: localSourceIds,
        })
      );
      if (!exactText(decision.reason, 100)) {
        issues.push(`${decisionPrefix}.reason must explain the exact disposition`);
      }
      if (
        isRecord(decision.from) &&
        isRecord(decision.to) &&
        decision.from.kind === "record" &&
        decision.to.kind === "record" &&
        decision.from.value === decision.to.value
      ) {
        issues.push(`${decisionPrefix} cannot merge a record into itself`);
      }
      if (decision.status === "merge" && decision.from?.kind === "record") {
        mergeSources.push(decision.from.value);
        if (decision.to?.kind === "record") {
          mergeEdges.set(decision.from.value, decision.to.value);
        }
      }

      if (enrichmentManifest) {
        for (const [side, endpoint] of [
          ["from", decision.from],
          ["to", decision.to],
        ]) {
          if (!isRecord(endpoint) || endpoint.kind !== "record") continue;
          const observed = observedInputs.get(endpoint.value);
          if (!observed) {
            issues.push(`${decisionPrefix}.${side} record is absent from observed input`);
          } else if (
            observed.source?.fingerprint !== endpoint.observedInputFingerprint
          ) {
            issues.push(`${decisionPrefix}.${side} observed fingerprint is stale`);
          }
        }
      }
    }

    if (!exactText(target.reviewReason, 120)) {
      issues.push(`${prefix}.reviewReason is too weak`);
    }
    if (!isIsoCalendarDate(target.checkedAt)) {
      issues.push(`${prefix}.checkedAt must be an ISO calendar date`);
    }
    if (target.checkedAt !== manifest.checkedAt) {
      issues.push(`${prefix}.checkedAt must equal manifest.checkedAt`);
    }
    if (!SHA256.test(target.reviewFingerprint || "")) {
      issues.push(`${prefix}.reviewFingerprint must be sha256`);
    } else if (target.reviewFingerprint !== targetResolutionFingerprint(target)) {
      issues.push(`${prefix}.reviewFingerprint mismatch`);
    }
  }

  for (const duplicate of duplicateValues(decisionIds)) {
    issues.push(`duplicate decisionId ${duplicate}`);
  }
  const approvedDecisionIds = Array.isArray(
    manifest.activation?.approvedDecisionIds
  )
    ? manifest.activation.approvedDecisionIds
    : [];
  const excludedDecisionIds = Array.isArray(
    manifest.activation?.excludedDecisionIds
  )
    ? manifest.activation.excludedDecisionIds
    : [];
  for (const duplicate of duplicateValues(approvedDecisionIds)) {
    issues.push(`activation approved decision duplicated ${duplicate}`);
  }
  for (const duplicate of duplicateValues(excludedDecisionIds)) {
    issues.push(`activation excluded decision duplicated ${duplicate}`);
  }
  const activatedIds = new Set([
    ...approvedDecisionIds,
    ...excludedDecisionIds,
  ]);
  for (const decisionId of decisionIds) {
    if (!activatedIds.has(decisionId)) {
      issues.push(`activation omits decision ${decisionId}`);
    }
  }
  for (const decisionId of activatedIds) {
    if (!decisionStatusById.has(decisionId)) {
      issues.push(`activation references unknown decision ${decisionId}`);
    }
  }
  for (const decisionId of approvedDecisionIds) {
    if (excludedDecisionIds.includes(decisionId)) {
      issues.push(`activation both approves and excludes ${decisionId}`);
    }
    if (decisionStatusById.get(decisionId) === "hold") {
      issues.push(`activation cannot approve hold ${decisionId}`);
    }
    if (decisionTargetReviewStatusById.get(decisionId) !== "accepted") {
      issues.push(
        `activation cannot approve decision from non-accepted target ${decisionId}`
      );
    }
  }
  for (const decisionId of excludedDecisionIds) {
    if (
      decisionStatusById.has(decisionId) &&
      decisionStatusById.get(decisionId) !== "hold"
    ) {
      issues.push(`activation may exclude only hold ${decisionId}`);
    }
  }
  for (const duplicate of duplicateValues(mergeSources)) {
    issues.push(`record is merged more than once: ${duplicate}`);
  }
  for (const start of mergeEdges.keys()) {
    const seen = new Set([start]);
    let current = mergeEdges.get(start);
    while (current && mergeEdges.has(current)) {
      if (seen.has(current)) {
        issues.push(`merge cycle detected at ${start}`);
        break;
      }
      seen.add(current);
      current = mergeEdges.get(current);
    }
  }

  if (!isRecord(manifest.summary)) {
    issues.push("summary must be an object");
  } else {
    const expected = summaryCounts(targets);
    for (const field of [
      "targetCount",
      "acceptedTargetCount",
      "heldTargetCount",
      "potentiallyUnblockedCanonHoldCount",
    ]) {
      if (manifest.summary[field] !== expected[field]) {
        issues.push(`summary.${field} mismatch`);
      }
    }
    for (const status of DECISION_STATUSES) {
      if (manifest.summary.decisionCounts?.[status] !== expected.decisionCounts[status]) {
        issues.push(`summary.decisionCounts.${status} mismatch`);
      }
    }
    if (!exactText(manifest.summary.note, 120)) {
      issues.push("summary.note must state the non-production boundary");
    }
  }

  if (!SHA256.test(manifest.manifestFingerprint || "")) {
    issues.push("manifestFingerprint must be sha256");
  } else if (
    manifest.manifestFingerprint !== duplicateResolutionManifestFingerprint(manifest)
  ) {
    issues.push("manifestFingerprint mismatch");
  }

  return issues;
}

const LOSSLESS_SOURCE_FIELDS = new Set([
  "id",
  "title",
  "authorship",
  "alternateTitles",
  "originalTitle",
  "firstPublished",
  "originalLanguage",
  "genres",
  "tags",
  "description",
  "translations",
  "localizedTitles",
  "canon",
  "sources",
  "externalIds",
  "distinctions",
  "coverUrl",
  "coverThumbnailUrl",
  "coverWidth",
  "coverHeight",
  "coverThumbnailWidth",
  "coverThumbnailHeight",
  "coverSourceUrl",
  "coverRights",
  "sourceUrl",
  "edition",
  "editorial",
]);
const RECORD_CONTEXT_FIELDS = new Set([
  "recordKey",
  "countryId",
  "countryName",
  "writerId",
  "writerName",
  "writer",
  "country",
  "inArchive",
  "shadowOf",
  "externalIdentities",
]);
const LOSSLESS_SCALAR_FIELDS = [
  "authorship",
  "originalLanguage",
  "description",
  "canon",
  "edition",
  "coverUrl",
  "coverThumbnailUrl",
  "coverWidth",
  "coverHeight",
  "coverThumbnailWidth",
  "coverThumbnailHeight",
  "coverSourceUrl",
  "coverRights",
];

export function duplicateResolutionMergeProjectionFingerprint(record) {
  if (!isRecord(record)) return sha256Canonical(null);
  return sha256Canonical(
    Object.fromEntries(
      [...LOSSLESS_SOURCE_FIELDS]
        .filter((field) => Object.hasOwn(record, field))
        .sort((left, right) => left.localeCompare(right, "en"))
        .map((field) => [field, record[field]])
    )
  );
}

function resolutionRecordMap(records) {
  if (records instanceof Map) return new Map(records);
  const result = new Map();
  if (!Array.isArray(records)) return result;
  for (const record of records) {
    if (isRecord(record) && exactText(record.recordKey)) {
      result.set(record.recordKey, record);
    }
  }
  return result;
}

function recordIdentity(recordKey = "") {
  const [countryId = "", writerId = "", ...idParts] = String(recordKey).split(":");
  return { countryId, writerId, id: idParts.join(":") };
}

export function openLibraryIdentityFromUrl(value) {
  const parsed = parsedHttpsUrl(value);
  if (!parsed || parsed.hostname !== OPEN_LIBRARY_HOSTNAME) return "";
  const match = parsed.pathname.match(OPEN_LIBRARY_WORK_PATH);
  return match ? `openlibrary:${match[1]}` : "";
}

function localeMapConflictIssues(source, survivor, field, prefix) {
  const issues = [];
  const sourceMap = isRecord(source?.[field]) ? source[field] : {};
  const survivorMap = isRecord(survivor?.[field]) ? survivor[field] : {};
  for (const locale of Object.keys(sourceMap)) {
    if (
      locale in survivorMap &&
      canonicalJson(sourceMap[locale]) !== canonicalJson(survivorMap[locale])
    ) {
      issues.push(`${prefix} cannot losslessly combine ${field}.${locale}`);
    }
  }
  return issues;
}

function mergeLosslessPreconditionIssues(source, survivor, prefix) {
  const issues = [];
  for (const field of Object.keys(source || {})) {
    if (!LOSSLESS_SOURCE_FIELDS.has(field) && !RECORD_CONTEXT_FIELDS.has(field)) {
      issues.push(`${prefix} has unsupported source field ${field}`);
    }
  }
  for (const field of LOSSLESS_SCALAR_FIELDS) {
    if (
      source?.[field] !== undefined &&
      survivor?.[field] !== undefined &&
      canonicalJson(source[field]) !== canonicalJson(survivor[field])
    ) {
      issues.push(`${prefix} cannot losslessly combine ${field}`);
    }
  }
  issues.push(
    ...localeMapConflictIssues(source, survivor, "translations", prefix),
    ...localeMapConflictIssues(source, survivor, "localizedTitles", prefix)
  );
  if (
    exactText(source?.sourceUrl) &&
    exactText(survivor?.sourceUrl) &&
    source.sourceUrl !== survivor.sourceUrl &&
    !openLibraryIdentityFromUrl(source.sourceUrl)
  ) {
    issues.push(`${prefix} cannot preserve a non-identity sourceUrl conflict`);
  }
  return issues;
}

export function duplicateResolutionApplicationIssues(
  manifest,
  { canonRegistry = null, enrichmentManifest = null, records = null } = {}
) {
  const issues = duplicateResolutionIssues(manifest, {
    canonRegistry,
    enrichmentManifest,
  });
  const recordsByKey = resolutionRecordMap(records);
  if (recordsByKey.size === 0) {
    issues.push("duplicate-resolution application records must not be empty");
    return issues;
  }

  const registryItems = registryItemMap(canonRegistry);
  const mergeSourceKeys = new Set(
    (manifest?.targets || []).flatMap((target) =>
      (target.decisions || [])
        .filter((decision) => decision.status === "merge")
        .map((decision) => decision.from?.value)
        .filter(Boolean)
    )
  );

  for (const [targetIndex, target] of (manifest?.targets || []).entries()) {
    const targetPrefix = `targets[${targetIndex}]`;
    if (target.reviewStatus !== "accepted") continue;
    for (const [decisionIndex, decision] of (target.decisions || []).entries()) {
      const prefix = `${targetPrefix}.decisions[${decisionIndex}]`;
      if (decision.status === "hold") continue;
      if (decision.status === "alias") {
        const registryItem = registryItems.get(
          `${target.canonHoldRef?.sourceId}:${target.canonHoldRef?.itemId}`
        );
        if (
          registryItem?.titleExact &&
          decision.from?.value !== registryItem.titleExact
        ) {
          issues.push(`${prefix} alias must equal the registry titleExact`);
        }
        const aliasTarget = recordsByKey.get(decision.to?.value);
        if (!aliasTarget) {
          issues.push(`${prefix} alias target is absent`);
        } else if (
          decision.to?.mergeProjectionFingerprint !==
          duplicateResolutionMergeProjectionFingerprint(aliasTarget)
        ) {
          issues.push(`${prefix} alias target merge projection is stale`);
        }
        continue;
      }

      const sourceKey = decision.from?.value;
      const survivorKey = decision.to?.value;
      const source = recordsByKey.get(sourceKey);
      const survivor = recordsByKey.get(survivorKey);
      if (!source) issues.push(`${prefix} application source is absent`);
      if (!survivor) issues.push(`${prefix} application survivor is absent`);
      if (!source || !survivor) continue;
      if (
        decision.from?.mergeProjectionFingerprint !==
        duplicateResolutionMergeProjectionFingerprint(source)
      ) {
        issues.push(`${prefix} source merge projection is stale`);
      }
      if (
        decision.to?.mergeProjectionFingerprint !==
        duplicateResolutionMergeProjectionFingerprint(survivor)
      ) {
        issues.push(`${prefix} survivor merge projection is stale`);
      }
      const sourceIdentity = recordIdentity(sourceKey);
      const survivorIdentity = recordIdentity(survivorKey);
      if (source.id !== sourceIdentity.id) {
        issues.push(`${prefix} source id does not match its recordKey`);
      }
      if (survivor.id !== survivorIdentity.id) {
        issues.push(`${prefix} survivor id does not match its recordKey`);
      }
      if (sourceIdentity.writerId !== survivorIdentity.writerId) {
        issues.push(`${prefix} changes the reviewed writer identity`);
      }
      if (mergeSourceKeys.has(survivorKey)) {
        issues.push(`${prefix} survivor cannot be another reviewed merge source`);
      }
      issues.push(
        ...mergeLosslessPreconditionIssues(source, survivor, prefix)
      );
    }
  }
  return issues;
}

export function buildDuplicateResolutionApplication(
  manifest,
  fixtures = {}
) {
  const issues = duplicateResolutionApplicationIssues(manifest, fixtures);
  if (issues.length > 0) {
    throw new Error(
      `duplicate-resolution-application-invalid:${issues.join("|")}`
    );
  }

  const merges = [];
  const aliases = [];
  const heldDecisions = [];
  const approvedDecisionIds = new Set(
    manifest.activation.approvedDecisionIds
  );
  const excludedDecisionIds = new Set(
    manifest.activation.excludedDecisionIds
  );
  for (const target of manifest.targets) {
    if (target.reviewStatus !== "accepted") {
      for (const decision of target.decisions) {
        if (excludedDecisionIds.has(decision.decisionId)) {
          heldDecisions.push({
            targetId: target.targetId,
            decisionId: decision.decisionId,
            recordKey: decision.from.value,
            entityKind: decision.entityKind,
          });
        }
      }
      continue;
    }
    for (const decision of target.decisions) {
      if (excludedDecisionIds.has(decision.decisionId)) {
        heldDecisions.push({
          targetId: target.targetId,
          decisionId: decision.decisionId,
          recordKey: decision.from.value,
          entityKind: decision.entityKind,
        });
        continue;
      }
      if (!approvedDecisionIds.has(decision.decisionId)) continue;
      if (decision.status === "alias") {
        aliases.push({
          recordKey: decision.to.value,
          title: decision.from.value,
          sourceId: decision.from.sourceId,
          basis: REVIEWED_DUPLICATE_RESOLUTION_ALIAS_BASIS,
          aliasContractVersion: 1,
          resolutionId: decision.decisionId,
          resolutionFingerprint: target.reviewFingerprint,
          targetFingerprint: decision.to.observedInputFingerprint,
          targetMergeProjectionFingerprint:
            decision.to.mergeProjectionFingerprint,
          workFirstPublishedStatus: target.workYearResolution.status,
          workFirstPublished: target.workYearResolution.value,
        });
        continue;
      }
      const fromIdentity = recordIdentity(decision.from.value);
      const toIdentity = recordIdentity(decision.to.value);
      merges.push({
        from: decision.from.value,
        into: decision.to.value,
        basis: REVIEWED_DUPLICATE_RESOLUTION_MERGE_BASIS,
        mergeContractVersion: 1,
        preserveWriterRelation:
          fromIdentity.countryId === toIdentity.countryId &&
          fromIdentity.writerId === toIdentity.writerId,
        resolutionId: decision.decisionId,
        resolutionFingerprint: target.reviewFingerprint,
        sourceFingerprint: decision.from.observedInputFingerprint,
        survivorFingerprint: decision.to.observedInputFingerprint,
        sourceMergeProjectionFingerprint:
          decision.from.mergeProjectionFingerprint,
        survivorMergeProjectionFingerprint:
          decision.to.mergeProjectionFingerprint,
        workFirstPublishedStatus: target.workYearResolution.status,
        workFirstPublished: target.workYearResolution.value,
        canonicalTitle: target.canonicalIdentity.title,
      });
    }
  }

  merges.sort((left, right) => left.from.localeCompare(right.from, "en"));
  aliases.sort((left, right) =>
    left.recordKey.localeCompare(right.recordKey, "en") ||
    left.title.localeCompare(right.title, "en")
  );
  heldDecisions.sort((left, right) =>
    left.decisionId.localeCompare(right.decisionId, "en")
  );
  return {
    manifestId: manifest.manifestId,
    manifestFingerprint: manifest.manifestFingerprint,
    merges,
    aliases,
    heldDecisions,
  };
}
