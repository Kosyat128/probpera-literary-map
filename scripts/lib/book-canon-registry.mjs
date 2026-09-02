import { createHash } from "node:crypto";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const DOMAIN = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/u;
const ISO_MARKET = /^[A-Z]{2}$/u;
const RECORD_KEY = /^[^:\s]+:[^:\s]+:[^:\s]+$/u;

export const REGISTRY_VERSION = "world-canon-2026-09-v2";
export const ITEM_HASH_PROFILE = "sha256-exact-registry-fields-v1";

const AUTHORITY_TIERS = new Set(["A", "B"]);
const AUTHORITY_ROLES = new Set([
  "canon-selection",
  "title-national-record",
  "title-publisher",
  "title-rights-holder",
  "title-author-estate",
  "title-critical-edition",
  "description-fact",
  "project-article",
]);
const SOURCE_CLASSES = new Set([
  "official-curriculum",
  "national-library-heritage-collection",
  "academy-or-literary-institute",
  "scholarly-critical-project",
  "international-heritage-register",
  "work-specific-landmark-award",
]);
const SOURCE_SCOPES = new Set([
  "global-curated-collection",
  "national-influence-collection",
]);
const INVENTORY_STATUSES = new Set([
  "research",
  "transcribed",
  "adjudicated",
]);
const COVERAGE_STATUSES = new Set(["in-progress", "adjudicated"]);
const SNAPSHOT_STATUSES = new Set([
  "unverified-content-hash",
  "verified-content-hash",
]);
const EXTRACTION_METHODS = new Set([
  "manual-transcription",
  "dom-link-extraction",
  "api-export",
]);
const COMPLETION_STATUSES = new Set(["in-progress", "verified-complete"]);
const ADJUDICATION_STATUSES = new Set([
  "pending-review",
  "accepted",
  "rejected",
  "held",
]);
const CANDIDATE_KINDS = new Set([
  "unclassified",
  "work",
  "work-cycle",
  "coauthored-work",
  "anonymous-work",
  "collective-work",
  "edition-aggregate",
  "editorial-aggregate",
  "edition-manifestation-artifact",
  "exhibit-companion",
  "ambiguous-multiwork-edition",
]);
const ENTITY_KINDS = new Set([
  "unresolved",
  "work",
  "aggregate-work",
  "manifestation",
  "exhibit-object",
  "ambiguous-manifestation",
]);
const CANDIDATE_ENTITY_KINDS = new Map([
  ["unclassified", "unresolved"],
  ["work", "work"],
  ["work-cycle", "aggregate-work"],
  ["coauthored-work", "work"],
  ["anonymous-work", "work"],
  ["collective-work", "work"],
  ["edition-aggregate", "manifestation"],
  ["editorial-aggregate", "aggregate-work"],
  ["edition-manifestation-artifact", "manifestation"],
  ["exhibit-companion", "exhibit-object"],
  ["ambiguous-multiwork-edition", "ambiguous-manifestation"],
]);
const PERSON_QUALIFIERS = new Set([
  "отец",
  "сын",
  "старший",
  "младший",
  "pere",
  "père",
  "fils",
  "senior",
  "junior",
  "sr",
  "jr",
]);
const PERSON_QUALIFIER_GROUPS = new Map([
  ["отец", "senior"],
  ["старший", "senior"],
  ["pere", "senior"],
  ["père", "senior"],
  ["senior", "senior"],
  ["sr", "senior"],
  ["сын", "junior"],
  ["младший", "junior"],
  ["fils", "junior"],
  ["junior", "junior"],
  ["jr", "junior"],
]);
const NON_BLOCKING_STATUSES = new Set([
  "confirmed-work-specific-signal",
  "reviewed-not-work-specific-signal",
]);
const ACCEPTED_SIGNAL_ENTITY_PAIRS = new Set([
  "work:work",
  "work-cycle:aggregate-work",
  "coauthored-work:work",
]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isExactText(value) {
  return typeof value === "string" && value.length > 0 && value === value.trim();
}

function isExactSlug(value) {
  return isExactText(value) && SLUG.test(value);
}

function isExactSha256(value) {
  return typeof value === "string" && SHA256.test(value);
}

export function isIsoCalendarDate(value) {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  if (value.startsWith("0000-")) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.valueOf()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function parsedHttpsUrl(value) {
  if (typeof value !== "string" || value !== value.trim()) return null;
  try {
    const parsed = new URL(value);
    if (
      parsed.protocol !== "https:" ||
      !parsed.hostname ||
      parsed.username ||
      parsed.password
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function hostMatchesDomains(hostname, domains) {
  const host = String(hostname || "").toLocaleLowerCase("en");
  return domains.some(
    (domain) => host === domain || host.endsWith(`.${domain}`)
  );
}

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return duplicates;
}

function sameSet(left, right) {
  return left.size === right.size && [...left].every((value) => right.has(value));
}

export function normalizeRegistryText(value = "") {
  const source = typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
  return source
    .normalize("NFKC")
    .toLocaleLowerCase("ru")
    .replace(/ё/gu, "е")
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015]/gu, "-")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function nameSignature(value) {
  const tokens = normalizeRegistryText(value)
    .split(" ")
    .filter(Boolean);
  return {
    core: new Set(
      tokens.filter(
        (token) => token.length > 1 && !PERSON_QUALIFIERS.has(token)
      )
    ),
    qualifiers: new Set(
      tokens
        .filter((token) => PERSON_QUALIFIERS.has(token))
        .map((token) => PERSON_QUALIFIER_GROUPS.get(token) || token)
    ),
  };
}

export function contributorMatchesWriter(contributor, writerName) {
  const expected = nameSignature(contributor);
  const actual = nameSignature(writerName);
  if (expected.core.size < 2 || actual.core.size < 2) return false;
  if (!sameSet(expected.qualifiers, actual.qualifiers)) return false;
  return [...expected.core].every((token) => actual.core.has(token));
}

export function registryItemHash(sourceId, item) {
  const exactFields = {
    hashProfile: ITEM_HASH_PROFILE,
    sourceId: typeof sourceId === "string" ? sourceId : "",
    ordinal: Number.isInteger(item?.ordinal) ? item.ordinal : null,
    itemId: typeof item?.itemId === "string" ? item.itemId : "",
    itemUrl: typeof item?.itemUrl === "string" ? item.itemUrl : "",
    titleExact: typeof item?.titleExact === "string" ? item.titleExact : "",
    contributorExact:
      typeof item?.contributorExact === "string" ? item.contributorExact : "",
    candidateKind:
      typeof item?.candidateKind === "string" ? item.candidateKind : "",
    entityKind: typeof item?.entityKind === "string" ? item.entityKind : "",
  };
  return createHash("sha256").update(JSON.stringify(exactFields), "utf8").digest("hex");
}

function arrayFieldIssues({
  value,
  prefix,
  allowedValues,
  itemPattern,
  requireNonempty = true,
}) {
  const issues = [];
  if (!Array.isArray(value)) return [`${prefix}-array-required`];
  if (requireNonempty && value.length === 0) issues.push(`${prefix}-nonempty-required`);
  const exactValues = value.filter((entry) => typeof entry === "string");
  if (exactValues.length !== value.length) issues.push(`${prefix}-string-values-required`);
  for (const entry of exactValues) {
    if (entry !== entry.trim() || !entry) issues.push(`${prefix}-value-invalid`);
    if (allowedValues && !allowedValues.has(entry)) {
      issues.push(`${prefix}-value-not-allowed:${entry || "missing"}`);
    }
    if (itemPattern && !itemPattern.test(entry)) {
      issues.push(`${prefix}-value-invalid:${entry || "missing"}`);
    }
  }
  if (duplicateValues(exactValues).size > 0) issues.push(`${prefix}-values-duplicate`);
  return issues;
}

export function registryIssues(registry) {
  const issues = [];
  if (!isRecord(registry)) issues.push("registry-object-required");
  if (registry?.schemaVersion !== 2) issues.push("schema-version-must-be-2");
  if (registry?.registryVersion !== REGISTRY_VERSION) {
    issues.push("registry-version-must-be-world-canon-2026-09-v2");
  }
  if (!isIsoCalendarDate(registry?.snapshotDate)) {
    issues.push("snapshot-date-invalid");
  }
  if (!text(registry?.completionRule)) issues.push("completion-rule-required");
  if (!COMPLETION_STATUSES.has(registry?.completionStatus)) {
    issues.push("completion-status-invalid");
  }
  if (registry?.minimumIndependentWorkSignals !== 2) {
    issues.push("minimum-independent-work-signals-must-be-2");
  }
  if (registry?.itemHashProfile !== ITEM_HASH_PROFILE) {
    issues.push("item-hash-profile-invalid");
  }
  if (!isExactText(registry?.itemHashRule)) {
    issues.push("item-hash-rule-required");
  }

  const authorities = Array.isArray(registry?.authorities)
    ? registry.authorities
    : [];
  if (!Array.isArray(registry?.authorities)) issues.push("authorities-array-required");
  if (authorities.length === 0) issues.push("authorities-nonempty-required");
  const authorityById = new Map();
  const domainGroups = [];
  for (const [index, authority] of authorities.entries()) {
    const prefix = `authority-${index + 1}`;
    if (!isRecord(authority)) issues.push(`${prefix}-object-required`);
    const authorityId = text(authority?.authorityId);
    if (!isExactSlug(authority?.authorityId)) {
      issues.push(`${prefix}-authority-id-invalid`);
    }
    if (authorityById.has(authorityId)) issues.push(`${prefix}-authority-id-duplicate`);
    if (authorityId) authorityById.set(authorityId, authority);
    if (!isExactSlug(authority?.provider)) {
      issues.push(`${prefix}-provider-invalid`);
    }
    if (!isExactSlug(authority?.authorityCountryId)) {
      issues.push(`${prefix}-authority-country-id-invalid`);
    }
    if (!isExactSlug(authority?.independenceGroup)) {
      issues.push(`${prefix}-independence-group-invalid`);
    }
    if (!AUTHORITY_TIERS.has(authority?.tier)) {
      issues.push(`${prefix}-tier-invalid`);
    }
    issues.push(
      ...arrayFieldIssues({
        value: authority?.allowedRoles,
        prefix: `${prefix}-allowed-roles`,
        allowedValues: AUTHORITY_ROLES,
      }),
      ...arrayFieldIssues({
        value: authority?.domains,
        prefix: `${prefix}-domains`,
        itemPattern: DOMAIN,
      }),
      ...arrayFieldIssues({
        value: authority?.markets,
        prefix: `${prefix}-markets`,
        itemPattern: ISO_MARKET,
        requireNonempty: false,
      })
    );
    const authorityRoles = Array.isArray(authority?.allowedRoles)
      ? authority.allowedRoles
      : [];
    const authorityMarkets = Array.isArray(authority?.markets)
      ? authority.markets
      : [];
    if (
      authorityRoles.some((role) => String(role).startsWith("title-")) &&
      authorityMarkets.length === 0
    ) {
      issues.push(`${prefix}-markets-required-for-title-role`);
    }
    for (const domain of Array.isArray(authority?.domains) ? authority.domains : []) {
      if (typeof domain !== "string") continue;
      const normalizedDomain = domain.toLocaleLowerCase("en");
      const currentGroup = text(authority?.independenceGroup);
      const collision = domainGroups.find(
        ({ domain: priorDomain, group: priorGroup }) =>
          priorGroup !== currentGroup &&
          (normalizedDomain === priorDomain ||
            normalizedDomain.endsWith(`.${priorDomain}`) ||
            priorDomain.endsWith(`.${normalizedDomain}`))
      );
      if (collision) {
        issues.push(`${prefix}-domain-crosses-independence-groups:${normalizedDomain}`);
      }
      if (normalizedDomain) {
        domainGroups.push({ domain: normalizedDomain, group: currentGroup });
      }
    }
  }

  const sources = Array.isArray(registry?.sources) ? registry.sources : [];
  if (!Array.isArray(registry?.sources)) issues.push("sources-array-required");
  if (sources.length === 0) issues.push("sources-nonempty-required");
  const sourceById = new Map();
  const sourceUrls = new Set();
  for (const [index, source] of sources.entries()) {
    const prefix = `source-${index + 1}`;
    if (!isRecord(source)) issues.push(`${prefix}-object-required`);
    const id = text(source?.id);
    if (!isExactSlug(source?.id)) issues.push(`${prefix}-id-invalid`);
    if (sourceById.has(id)) issues.push(`${prefix}-id-duplicate`);
    if (id) sourceById.set(id, source);

    const authorityId = text(source?.authorityId);
    if (!isExactSlug(source?.authorityId)) {
      issues.push(`${prefix}-authority-id-invalid`);
    }
    const authority = authorityById.get(authorityId);
    if (!authority) issues.push(`${prefix}-authority-id-unknown`);
    if (
      authority &&
      (!Array.isArray(authority.allowedRoles) ||
        !authority.allowedRoles.includes("canon-selection"))
    ) {
      issues.push(`${prefix}-authority-canon-selection-role-required`);
    }
    if (Object.hasOwn(source || {}, "independenceGroup")) {
      issues.push(`${prefix}-independence-group-must-come-from-authority-registry`);
    }
    const selfDeclaredAuthorityFields = [
      "provider",
      "authorityTier",
      "tier",
      "authorityCountryId",
      "countryId",
      "domains",
      "markets",
      "allowedRoles",
    ];
    if (
      selfDeclaredAuthorityFields.some((field) =>
        Object.hasOwn(source || {}, field)
      )
    ) {
      issues.push(`${prefix}-authority-fields-must-not-be-self-declared`);
    }

    const parsedUrl = parsedHttpsUrl(source?.url);
    if (!parsedUrl) {
      issues.push(`${prefix}-https-url-invalid`);
    } else {
      if (sourceUrls.has(parsedUrl.href)) issues.push(`${prefix}-url-duplicate`);
      sourceUrls.add(parsedUrl.href);
      const domains = Array.isArray(authority?.domains) ? authority.domains : [];
      if (!hostMatchesDomains(parsedUrl.hostname, domains)) {
        issues.push(`${prefix}-url-host-not-authorized`);
      }
    }
    if (!SOURCE_CLASSES.has(source?.class)) issues.push(`${prefix}-class-invalid`);
    if (!SOURCE_SCOPES.has(source?.scope)) issues.push(`${prefix}-scope-invalid`);
    if (!INVENTORY_STATUSES.has(source?.inventoryStatus)) {
      issues.push(`${prefix}-inventory-status-invalid`);
    }
    if (!COVERAGE_STATUSES.has(source?.coverageStatus)) {
      issues.push(`${prefix}-coverage-status-invalid`);
    }
    if (
      source?.inventoryStatus === "adjudicated" &&
      source?.coverageStatus !== "adjudicated"
    ) {
      issues.push(`${prefix}-adjudicated-inventory-requires-adjudicated-coverage`);
    }
    if (
      source?.coverageStatus === "adjudicated" &&
      source?.inventoryStatus !== "adjudicated"
    ) {
      issues.push(`${prefix}-adjudicated-coverage-requires-adjudicated-inventory`);
    }
    if (
      !Number.isInteger(source?.declaredItemCount) ||
      source.declaredItemCount < 1
    ) {
      issues.push(`${prefix}-declared-item-count-invalid`);
    }

    const snapshot = source?.snapshot;
    if (!isRecord(snapshot)) issues.push(`${prefix}-snapshot-object-required`);
    if (!isIsoCalendarDate(snapshot?.capturedAt)) {
      issues.push(`${prefix}-snapshot-captured-at-invalid`);
    } else if (
      isIsoCalendarDate(registry?.snapshotDate) &&
      snapshot.capturedAt > registry.snapshotDate
    ) {
      issues.push(`${prefix}-snapshot-after-registry-date`);
    }
    if (!SNAPSHOT_STATUSES.has(snapshot?.snapshotStatus)) {
      issues.push(`${prefix}-snapshot-status-invalid`);
    }
    if (!EXTRACTION_METHODS.has(snapshot?.extractionMethod)) {
      issues.push(`${prefix}-extraction-method-invalid`);
    }
    if (!isExactSlug(snapshot?.version)) {
      issues.push(`${prefix}-snapshot-version-invalid`);
    }
    if (snapshot?.snapshotStatus === "verified-content-hash") {
      if (!isExactSha256(snapshot?.contentSha256)) {
        issues.push(`${prefix}-content-sha256-required`);
      }
    } else if (
      snapshot?.snapshotStatus === "unverified-content-hash" &&
      snapshot?.contentSha256 !== null
    ) {
      issues.push(`${prefix}-unverified-content-sha256-must-be-null`);
    }
  }

  const inventories = Array.isArray(registry?.inventories)
    ? registry.inventories
    : [];
  if (!Array.isArray(registry?.inventories)) issues.push("inventories-array-required");
  if (inventories.length === 0) issues.push("inventories-nonempty-required");
  const inventorySourceIds = new Set();
  for (const [inventoryIndex, inventory] of inventories.entries()) {
    const prefix = `inventory-${inventoryIndex + 1}`;
    if (!isRecord(inventory)) issues.push(`${prefix}-object-required`);
    const sourceId = text(inventory?.sourceId);
    if (!isExactSlug(inventory?.sourceId)) {
      issues.push(`${prefix}-source-id-invalid`);
    }
    const source = sourceById.get(sourceId);
    if (!source) issues.push(`${prefix}-unknown-source`);
    if (inventorySourceIds.has(sourceId)) issues.push(`${prefix}-source-duplicate`);
    if (sourceId) inventorySourceIds.add(sourceId);

    const items = Array.isArray(inventory?.items) ? inventory.items : [];
    if (!Array.isArray(inventory?.items)) issues.push(`${prefix}-items-array-required`);
    if (items.length === 0) issues.push(`${prefix}-items-nonempty-required`);
    if (
      source &&
      ["transcribed", "adjudicated"].includes(source.inventoryStatus) &&
      items.length !== source.declaredItemCount
    ) {
      issues.push(`${prefix}-declared-count-mismatch`);
    }

    const ordinals = new Set();
    const itemIds = new Set();
    const authority = authorityById.get(text(source?.authorityId));
    for (const [itemIndex, item] of items.entries()) {
      const itemPrefix = `${prefix}-item-${itemIndex + 1}`;
      if (!isRecord(item)) issues.push(`${itemPrefix}-object-required`);
      if (!Number.isInteger(item?.ordinal) || item.ordinal < 1) {
        issues.push(`${itemPrefix}-ordinal-invalid`);
      }
      if (ordinals.has(item?.ordinal)) issues.push(`${itemPrefix}-ordinal-duplicate`);
      ordinals.add(item?.ordinal);

      const itemId = text(item?.itemId);
      if (!isExactSlug(item?.itemId)) issues.push(`${itemPrefix}-item-id-invalid`);
      if (itemIds.has(itemId)) issues.push(`${itemPrefix}-item-id-duplicate`);
      itemIds.add(itemId);

      const parsedItemUrl = parsedHttpsUrl(item?.itemUrl);
      if (!parsedItemUrl) {
        issues.push(`${itemPrefix}-item-url-invalid`);
      } else {
        const domains = Array.isArray(authority?.domains) ? authority.domains : [];
        if (!hostMatchesDomains(parsedItemUrl.hostname, domains)) {
          issues.push(`${itemPrefix}-item-url-host-not-authorized`);
        }
      }
      if (!isExactText(item?.titleExact)) issues.push(`${itemPrefix}-title-required`);
      if (
        typeof item?.contributorExact !== "string" ||
        item.contributorExact !== item.contributorExact.trim()
      ) {
        issues.push(`${itemPrefix}-contributor-exact-string-required`);
      }
      if (!CANDIDATE_KINDS.has(item?.candidateKind)) {
        issues.push(`${itemPrefix}-candidate-kind-invalid`);
      }
      if (!ENTITY_KINDS.has(item?.entityKind)) {
        issues.push(`${itemPrefix}-entity-kind-invalid`);
      } else if (
        CANDIDATE_ENTITY_KINDS.has(item?.candidateKind) &&
        CANDIDATE_ENTITY_KINDS.get(item.candidateKind) !== item.entityKind
      ) {
        issues.push(`${itemPrefix}-candidate-entity-kind-mismatch`);
      }
      if (!ADJUDICATION_STATUSES.has(item?.adjudicationStatus)) {
        issues.push(`${itemPrefix}-adjudication-status-invalid`);
      }
      if (
        source?.inventoryStatus === "research" &&
        ["accepted", "rejected", "held"].includes(item?.adjudicationStatus)
      ) {
        issues.push(`${itemPrefix}-adjudication-requires-transcribed-source`);
      }
      if (["accepted", "rejected", "held"].includes(item?.adjudicationStatus)) {
        if (!isIsoCalendarDate(item?.adjudicatedAt)) {
          issues.push(`${itemPrefix}-adjudicated-at-invalid`);
        } else if (
          isIsoCalendarDate(registry?.snapshotDate) &&
          item.adjudicatedAt > registry.snapshotDate
        ) {
          issues.push(`${itemPrefix}-adjudicated-after-registry-date`);
        }
        if (!isExactText(item?.adjudicatedBy)) {
          issues.push(`${itemPrefix}-adjudicated-by-required`);
        }
        if (
          !isExactText(item?.adjudicationReason) ||
          item.adjudicationReason.length < 20
        ) {
          issues.push(`${itemPrefix}-adjudication-reason-required`);
        }
        const evidenceUrls = Array.isArray(item?.adjudicationEvidenceUrls)
          ? item.adjudicationEvidenceUrls
          : [];
        if (!Array.isArray(item?.adjudicationEvidenceUrls)) {
          issues.push(`${itemPrefix}-adjudication-evidence-urls-array-required`);
        } else if (evidenceUrls.length === 0) {
          issues.push(`${itemPrefix}-adjudication-evidence-url-required`);
        }
        if (duplicateValues(evidenceUrls).size > 0) {
          issues.push(`${itemPrefix}-adjudication-evidence-urls-duplicate`);
        }
        for (const evidenceUrl of evidenceUrls) {
          if (!parsedHttpsUrl(evidenceUrl)) {
            issues.push(`${itemPrefix}-adjudication-evidence-url-invalid`);
          }
        }
      }
      if (item?.adjudicationStatus === "accepted") {
        if (
          !ACCEPTED_SIGNAL_ENTITY_PAIRS.has(
            `${item?.candidateKind || ""}:${item?.entityKind || ""}`
          )
        ) {
          issues.push(`${itemPrefix}-accepted-signal-must-identify-work`);
        }
        if (
          typeof item?.adjudicatedRecordKey !== "string" ||
          !RECORD_KEY.test(item.adjudicatedRecordKey)
        ) {
          issues.push(`${itemPrefix}-adjudicated-record-key-invalid`);
        }
      } else if (
        ADJUDICATION_STATUSES.has(item?.adjudicationStatus) &&
        item?.adjudicatedRecordKey !== null
      ) {
        issues.push(`${itemPrefix}-unaccepted-record-key-must-be-null`);
      }
      if (!isExactSha256(item?.itemHash)) {
        issues.push(`${itemPrefix}-item-hash-invalid`);
      } else if (sourceId && item.itemHash !== registryItemHash(sourceId, item)) {
        issues.push(`${itemPrefix}-item-hash-mismatch`);
      }
    }
    if (
      source &&
      ["transcribed", "adjudicated"].includes(source.inventoryStatus) &&
      items.some((item, index) => item?.ordinal !== index + 1)
    ) {
      issues.push(`${prefix}-ordinals-not-contiguous`);
    }
  }

  for (const source of sources) {
    if (
      isRecord(source) &&
      ["transcribed", "adjudicated"].includes(source.inventoryStatus) &&
      !inventorySourceIds.has(text(source.id))
    ) {
      issues.push(`source-${text(source.id) || "missing"}-inventory-required`);
    }
    if (isRecord(source) && source.inventoryStatus === "adjudicated") {
      const inventory = inventories.find(
        (candidate) => text(candidate?.sourceId) === text(source.id)
      );
      const items = Array.isArray(inventory?.items) ? inventory.items : [];
      if (
        items.some(
          (item) =>
            !["accepted", "rejected"].includes(item?.adjudicationStatus)
        )
      ) {
        issues.push(`source-${text(source.id) || "missing"}-adjudication-incomplete`);
      }
    }
  }
  return [...new Set(issues)];
}

function bookTitleCandidates(book) {
  return [
    book?.title,
    book?.originalTitle,
    book?.translations?.ru?.title,
    book?.localizedTitles?.ru?.value,
  ]
    .map(normalizeRegistryText)
    .filter(Boolean);
}

function matchSummary(book) {
  return {
    recordKey: `${book?.countryId || ""}:${book?.writerId || ""}:${book?.id || ""}`,
    title: book?.translations?.ru?.title || book?.title || "",
    writer: book?.writerName || "",
  };
}

export function classifyRegistryItem(item, books) {
  if (!isRecord(item)) return { status: "blocking-invalid-registry-item", matches: [] };
  if (item.adjudicationStatus === "rejected") {
    return { status: "reviewed-not-work-specific-signal", matches: [] };
  }
  if (item.adjudicationStatus === "held") {
    return { status: "blocking-adjudication-hold", matches: [] };
  }
  if (item.candidateKind === "unclassified") {
    return { status: "blocking-unclassified-candidate", matches: [] };
  }
  if (item.candidateKind === "edition-aggregate") {
    return { status: "blocking-manifestation-aggregate", matches: [] };
  }
  if (item.candidateKind === "editorial-aggregate") {
    return { status: "blocking-editorial-aggregate", matches: [] };
  }
  if (item.candidateKind === "edition-manifestation-artifact") {
    return { status: "blocking-manifestation-artifact", matches: [] };
  }
  if (item.candidateKind === "exhibit-companion") {
    return { status: "blocking-exhibit-companion", matches: [] };
  }
  if (item.candidateKind === "ambiguous-multiwork-edition") {
    return { status: "blocking-ambiguous-manifestation", matches: [] };
  }
  if (
    item.candidateKind === "coauthored-work" &&
    item.adjudicationStatus !== "accepted"
  ) {
    return { status: "model-blocked-coauthored-work", matches: [] };
  }
  if (item.candidateKind === "anonymous-work") {
    return { status: "model-blocked-anonymous-work", matches: [] };
  }
  if (item.candidateKind === "collective-work") {
    return { status: "model-blocked-collective-work", matches: [] };
  }
  if (!CANDIDATE_KINDS.has(item.candidateKind)) {
    return { status: "blocking-invalid-candidate-kind", matches: [] };
  }

  const archive = Array.isArray(books) ? books.filter(isRecord) : [];
  const titleKey = normalizeRegistryText(item.titleExact);
  if (!titleKey || !text(item.contributorExact)) {
    return { status: "blocking-incomplete-identity", matches: [] };
  }
  const sameTitle = archive.filter((book) =>
    bookTitleCandidates(book).includes(titleKey)
  );
  if (item.adjudicationStatus === "accepted") {
    const adjudicatedTarget = archive.find(
      (book) => matchSummary(book).recordKey === item.adjudicatedRecordKey
    );
    if (!adjudicatedTarget) {
      return { status: "blocking-adjudicated-record-key-mismatch", matches: [] };
    }
    if (!bookTitleCandidates(adjudicatedTarget).includes(titleKey)) {
      return {
        status: "blocking-adjudicated-title-mismatch",
        matches: [matchSummary(adjudicatedTarget)],
      };
    }
    if (item.candidateKind === "coauthored-work") {
      const authorship = adjudicatedTarget.authorship;
      const authors = Array.isArray(authorship?.authors)
        ? authorship.authors
        : [];
      const contributorNames = String(item.contributorExact || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      const reviewedCredits = authors
        .map((author) => text(author?.creditNames?.ru))
        .filter(Boolean);
      const unmatchedCredits = [...reviewedCredits];
      const everyContributorIsCredited =
        contributorNames.length >= 2 &&
        contributorNames.length === reviewedCredits.length &&
        contributorNames.every((contributor) => {
          const creditIndex = unmatchedCredits.findIndex((credit) =>
            contributorMatchesWriter(contributor, credit)
          );
          if (creditIndex < 0) return false;
          unmatchedCredits.splice(creditIndex, 1);
          return true;
        }) &&
        unmatchedCredits.length === 0;
      const linkedAuthorKeys = authors.map(
        (author) => `${text(author?.countryId)}:${text(author?.writerId)}`
      );
      const everyCreditIsDistinctAndLinked =
        linkedAuthorKeys.every(
          (key) => !key.startsWith(":") && !key.endsWith(":")
        ) &&
        new Set(linkedAuthorKeys).size === linkedAuthorKeys.length;
      if (
        authorship?.kind !== "multiple" ||
        !everyContributorIsCredited ||
        !everyCreditIsDistinctAndLinked
      ) {
        return {
          status: "blocking-adjudicated-coauthorship-mismatch",
          matches: [matchSummary(adjudicatedTarget)],
        };
      }
    }
    return {
      status: "confirmed-work-specific-signal",
      matches: [matchSummary(adjudicatedTarget)],
    };
  }
  const sameIdentity = sameTitle.filter((book) =>
    contributorMatchesWriter(item.contributorExact, book.writerName)
  );
  const matches = sameIdentity.map(matchSummary);
  if (matches.length === 1) {
    return { status: "candidate-needs-identity-review", matches };
  }
  if (matches.length > 1) {
    return { status: "unresolved-duplicate-identity", matches };
  }
  if (sameTitle.length > 0) {
    return {
      status: "unresolved-title-author-conflict",
      matches: sameTitle.map(matchSummary),
    };
  }
  return { status: "unresolved-no-exact-identity", matches: [] };
}

export function isBlockingRegistryStatus(status) {
  return !NON_BLOCKING_STATUSES.has(status);
}

export function setDifference(expected, observed) {
  const observedSet = observed instanceof Set ? observed : new Set(observed || []);
  return [...(expected instanceof Set ? expected : new Set(expected || []))].filter(
    (value) => !observedSet.has(value)
  );
}

export function assessRegistryCompletion(registry, adjudications) {
  const sources = Array.isArray(registry?.sources) ? registry.sources : [];
  const inventories = Array.isArray(registry?.inventories)
    ? registry.inventories
    : [];
  const records = Array.isArray(adjudications) ? adjudications : [];
  const authorityById = new Map(
    (Array.isArray(registry?.authorities) ? registry.authorities : [])
      .filter(isRecord)
      .map((authority) => [text(authority.authorityId), authority])
  );
  const sourceById = new Map(
    sources
      .filter(isRecord)
      .map((source) => [text(source.id), source])
  );
  const sourceIds = new Set(sources.map((source) => text(source?.id)).filter(Boolean));
  const requiredInventorySourceIds = new Set(
    sources
      .filter((source) => source?.inventoryStatus !== "research")
      .map((source) => text(source?.id))
      .filter(Boolean)
  );
  const inventoriedSourceIds = new Set(
    inventories.map((inventory) => text(inventory?.sourceId)).filter(Boolean)
  );
  const verifiedSourceIds = new Set(
    sources
      .filter(
        (source) =>
          source?.inventoryStatus === "adjudicated" &&
          source?.coverageStatus === "adjudicated" &&
          source?.snapshot?.snapshotStatus === "verified-content-hash" &&
          SHA256.test(text(source?.snapshot?.contentSha256))
      )
      .map((source) => text(source?.id))
      .filter(Boolean)
  );
  const missingRequiredInventorySourceIds = setDifference(
    requiredInventorySourceIds,
    inventoriedSourceIds
  );
  const unverifiedSourceIds = setDifference(sourceIds, verifiedSourceIds);
  const researchSourceIds = sources
    .filter((source) => source?.inventoryStatus === "research")
    .map((source) => text(source?.id))
    .filter(Boolean);
  const blockingItems = records.filter((record) =>
    isBlockingRegistryStatus(record?.status)
  );
  const confirmedSignals = records.filter(
    (record) => record?.status === "confirmed-work-specific-signal"
  );
  const controlledIndependenceGroup = (record) => {
    const source = sourceById.get(text(record?.sourceId));
    const authority = authorityById.get(text(source?.authorityId));
    return text(authority?.independenceGroup);
  };
  const invalidConfirmedSignals = confirmedSignals.filter((record) => {
    const controlledGroup = controlledIndependenceGroup(record);
    return (
      !controlledGroup ||
      (text(record?.independenceGroup) &&
        text(record.independenceGroup) !== controlledGroup) ||
      !Array.isArray(record?.matches) ||
      record.matches.length !== 1 ||
      !text(record.matches[0]?.recordKey)
    );
  });
  const invalidConfirmedSignalSet = new Set(invalidConfirmedSignals);
  const independenceGroupsByWork = new Map();
  for (const record of confirmedSignals) {
    if (invalidConfirmedSignalSet.has(record)) continue;
    const recordKey = text(record.matches[0].recordKey);
    const groups = independenceGroupsByWork.get(recordKey) || new Set();
    groups.add(controlledIndependenceGroup(record));
    independenceGroupsByWork.set(recordKey, groups);
  }
  const minimumSignals = 2;
  const workSignalCounts = Object.fromEntries(
    [...independenceGroupsByWork.entries()]
      .map(([recordKey, groups]) => [recordKey, groups.size])
      .sort(([left], [right]) => left.localeCompare(right, "en"))
  );
  const worksWithMinimumIndependentSignals = Object.entries(workSignalCounts)
    .filter(([, count]) => count >= minimumSignals)
    .map(([recordKey]) => recordKey);

  const reasons = [];
  if (blockingItems.length > 0) reasons.push("blocking-coverage-items-remain");
  if (missingRequiredInventorySourceIds.length > 0) {
    reasons.push("required-source-inventories-missing");
  }
  if (researchSourceIds.length > 0) reasons.push("research-source-lists-remain");
  if (unverifiedSourceIds.length > 0) {
    reasons.push("source-content-snapshots-unverified");
  }
  if (invalidConfirmedSignals.length > 0) {
    reasons.push("confirmed-signals-missing-controlled-identity");
  }
  if (independenceGroupsByWork.size === 0) {
    reasons.push("no-confirmed-work-specific-signals");
  } else if (
    worksWithMinimumIndependentSignals.length !== independenceGroupsByWork.size
  ) {
    reasons.push("works-with-fewer-than-two-independent-signals");
  }

  const completionEligible = reasons.length === 0;
  const completionClaimed = registry?.completionStatus === "verified-complete";
  const completionClaimValid = !completionClaimed || completionEligible;
  if (!completionClaimValid) reasons.push("completion-claim-without-eligibility");

  return {
    minimumIndependentWorkSignals: minimumSignals,
    completionClaimed,
    completionEligible,
    completionClaimValid,
    completionBlockingReasons: [...new Set(reasons)],
    blockingItems,
    confirmedWorkSpecificSignals: confirmedSignals.length,
    invalidConfirmedSignals: invalidConfirmedSignals.length,
    workSignalCounts,
    worksWithMinimumIndependentSignals,
    missingRequiredInventorySourceIds,
    researchSourceIds,
    unverifiedSourceIds,
  };
}
