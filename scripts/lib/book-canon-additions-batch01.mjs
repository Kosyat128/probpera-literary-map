import { createHash } from "node:crypto";

export const CANON_ADDITION_SCHEMA_VERSION = 1;
export const CANON_ADDITION_HASH_PROFILE =
  "sha256-canonical-json-canon-addition-v1";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const RECORD_KEY = /^[^:\s]+:[^:\s]+:[^:\s]+$/u;
const VERIFIED_TITLE_STATUS = "verified-research";
const WITHHELD_TITLE_STATUS = "withheld";
const RUSSIAN_OFFICIAL_DESCRIPTION_AUTHORITIES = new Set([
  "neb",
  "rsl",
  "ast",
  "azbooka",
]);
const SOURCE_EVIDENCE_CLASSES = new Set([
  "current-registry",
  "proposed-authority",
  "discovery-only",
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

function unique(values) {
  return [...new Set(values)];
}

function duplicates(values) {
  const seen = new Set();
  const repeated = new Set();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated];
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
      !parsed.hostname.includes(".")
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function domainMatches(hostname, domains) {
  const normalizedHost = String(hostname || "").toLocaleLowerCase("en");
  return domains.some((domain) => {
    const normalized = String(domain || "")
      .replace(/^\.+/u, "")
      .toLocaleLowerCase("en");
    return (
      normalized &&
      (normalizedHost === normalized || normalizedHost.endsWith(`.${normalized}`))
    );
  });
}

function normalizeTitle(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015]/gu, "-")
    .replace(/\s+/gu, " ")
    .trim()
    .toLocaleLowerCase("ru");
}

function sentenceCount(value) {
  return (String(value || "").match(/[.!?]+(?=\s|$)/gu) || []).length;
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

export function canonicalCanonAdditionJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function sha256CanonicalCanonAddition(value) {
  return createHash("sha256")
    .update(canonicalCanonAdditionJson(value), "utf8")
    .digest("hex");
}

export function canonAdditionCandidateFingerprint(candidate) {
  if (!isRecord(candidate)) return sha256CanonicalCanonAddition(null);
  const protectedCandidate = { ...candidate };
  delete protectedCandidate.reviewFingerprint;
  return sha256CanonicalCanonAddition(protectedCandidate);
}

export function canonAdditionManifestFingerprint(manifest) {
  if (!isRecord(manifest)) return sha256CanonicalCanonAddition(null);
  const protectedManifest = { ...manifest };
  delete protectedManifest.manifestFingerprint;
  return sha256CanonicalCanonAddition(protectedManifest);
}

export function canonAdditionReportFingerprint(report) {
  if (!isRecord(report)) return sha256CanonicalCanonAddition(null);
  const protectedReport = { ...report };
  delete protectedReport.reportFingerprint;
  return sha256CanonicalCanonAddition(protectedReport);
}

function registryAuthorityMap(registry) {
  return new Map(
    (Array.isArray(registry?.authorities) ? registry.authorities : [])
      .filter(isRecord)
      .map((authority) => [authority.authorityId, authority])
  );
}

function registryItemMap(registry) {
  const result = new Map();
  for (const inventory of Array.isArray(registry?.inventories)
    ? registry.inventories
    : []) {
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

function sourceMap(manifest) {
  return new Map(
    (Array.isArray(manifest?.sources) ? manifest.sources : [])
      .filter(isRecord)
      .map((source) => [source.sourceId, source])
  );
}

function proposedAuthorityMap(manifest) {
  return new Map(
    (Array.isArray(manifest?.proposedAuthorities)
      ? manifest.proposedAuthorities
      : [])
      .filter(isRecord)
      .map((authority) => [authority.authorityId, authority])
  );
}

function sourceReferenceIssues(sourceIds, sources, prefix, options = {}) {
  const issues = [];
  if (!Array.isArray(sourceIds) || sourceIds.length === 0) {
    return [`${prefix} must contain source IDs`];
  }
  for (const duplicate of duplicates(sourceIds)) {
    issues.push(`${prefix} repeats ${duplicate}`);
  }
  const groups = new Set();
  for (const sourceId of sourceIds) {
    const source = sources.get(sourceId);
    if (!source) {
      issues.push(`${prefix} references unknown source ${sourceId}`);
      continue;
    }
    if (options.forbidDiscovery && source.evidenceClass === "discovery-only") {
      issues.push(`${prefix} uses discovery-only source ${sourceId}`);
    }
    groups.add(source.independenceGroup);
  }
  if (options.minimumGroups && groups.size < options.minimumGroups) {
    issues.push(`${prefix} lacks ${options.minimumGroups} independent groups`);
  }
  return issues;
}

function localizedTitleIssues(profile, locale, sources, prefix) {
  const issues = [];
  if (!isRecord(profile)) return [`${prefix} must be an object`];
  if (profile.expressionLanguage !== locale) {
    issues.push(`${prefix}.expressionLanguage must be ${locale}`);
  }
  if (locale === "ru" && profile.market !== "RU") {
    issues.push(`${prefix}.market must be RU`);
  }
  if (locale === "en" && profile.market !== "US") {
    issues.push(`${prefix}.market must be US`);
  }

  if (profile.status === VERIFIED_TITLE_STATUS) {
    if (!exactText(profile.selectedValue)) {
      issues.push(`${prefix}.selectedValue is required`);
    }
    if (!exactText(profile.selectionRule)) {
      issues.push(`${prefix}.selectionRule is required`);
    }
    if (!Array.isArray(profile.evidence) || profile.evidence.length < 2) {
      issues.push(`${prefix}.evidence requires two records`);
      return issues;
    }
    const groups = new Set();
    let nationalTierA = 0;
    for (const [index, evidence] of profile.evidence.entries()) {
      const evidencePrefix = `${prefix}.evidence[${index}]`;
      if (!isRecord(evidence)) {
        issues.push(`${evidencePrefix} must be an object`);
        continue;
      }
      const source = sources.get(evidence.sourceId);
      if (!source) {
        issues.push(`${evidencePrefix} references an unknown source`);
        continue;
      }
      if (source.evidenceClass === "discovery-only") {
        issues.push(`${evidencePrefix} cannot use discovery-only evidence`);
      }
      groups.add(source.independenceGroup);
      if (
        source.authorityTier === "A" &&
        source.sourceKind.includes("national-library")
      ) {
        nationalTierA += 1;
      }
      if (!exactText(evidence.manifestationId, 3)) {
        issues.push(`${evidencePrefix}.manifestationId is required`);
      }
      if (
        normalizeTitle(evidence.catalogTitleExact) !==
        normalizeTitle(profile.selectedValue)
      ) {
        issues.push(`${evidencePrefix}.catalogTitleExact mismatches selection`);
      }
    }
    if (groups.size < 2) {
      issues.push(`${prefix} lacks two independent title authorities`);
    }
    if (nationalTierA < 1) {
      issues.push(`${prefix} lacks a Tier A national-library record`);
    }
  } else if (profile.status === WITHHELD_TITLE_STATUS) {
    if (profile.selectedValue !== null) {
      issues.push(`${prefix}.selectedValue must be null while withheld`);
    }
    if (profile.selectionRule !== null) {
      issues.push(`${prefix}.selectionRule must be null while withheld`);
    }
    if (!exactText(profile.reason, 120)) {
      issues.push(`${prefix}.reason must document the evidence gap`);
    }
    if (
      !Array.isArray(profile.observedManifestations) ||
      profile.observedManifestations.length === 0
    ) {
      issues.push(`${prefix}.observedManifestations must retain discoveries`);
    } else {
      for (const [index, observation] of profile.observedManifestations.entries()) {
        const observationPrefix = `${prefix}.observedManifestations[${index}]`;
        const source = sources.get(observation?.sourceId);
        if (!source) {
          issues.push(`${observationPrefix} references an unknown source`);
        } else if (source.evidenceClass !== "discovery-only") {
          issues.push(`${observationPrefix} must remain discovery-only`);
        }
        if (!exactText(observation?.observedTitleExact)) {
          issues.push(`${observationPrefix}.observedTitleExact is required`);
        }
      }
    }
  } else {
    issues.push(`${prefix}.status is invalid`);
  }
  return issues;
}

function descriptionIssues(
  profile,
  locale,
  sources,
  prefix,
  ruHash,
  ruSourceIds = null
) {
  const issues = [];
  if (!isRecord(profile)) return [`${prefix} must be an object`];
  if (!exactText(profile.text, 140) || profile.text.length > 900) {
    issues.push(`${prefix}.text must contain 140-900 characters`);
  }
  const sentences = sentenceCount(profile.text);
  if (sentences < 2 || sentences > 3) {
    issues.push(`${prefix}.text must contain two or three sentences`);
  }
  const actualHash = createHash("sha256")
    .update(String(profile.text || ""), "utf8")
    .digest("hex");
  if (!SHA256.test(profile.sha256 || "") || profile.sha256 !== actualHash) {
    issues.push(`${prefix}.sha256 is stale`);
  }
  if (profile.rights?.textOrigin !== "project-original") {
    issues.push(`${prefix}.rights.textOrigin must be project-original`);
  }
  if (profile.rights?.copiedSourceText !== false) {
    issues.push(`${prefix}.rights.copiedSourceText must be false`);
  }
  issues.push(
    ...sourceReferenceIssues(profile.sourceIds, sources, `${prefix}.sourceIds`, {
      forbidDiscovery: true,
      minimumGroups: 2,
    })
  );
  if (locale === "ru") {
    if (profile.origin !== "official-source-synthesis") {
      issues.push(`${prefix}.origin must be official-source-synthesis`);
    }
    if (profile.sourceLanguage !== "ru") {
      issues.push(`${prefix}.sourceLanguage must be ru`);
    }
    for (const sourceId of Array.isArray(profile.sourceIds)
      ? profile.sourceIds
      : []) {
      const source = sources.get(sourceId);
      if (
        source &&
        (!RUSSIAN_OFFICIAL_DESCRIPTION_AUTHORITIES.has(source.authorityId) ||
          source.evidenceClass !== "current-registry")
      ) {
        issues.push(
          `${prefix}.sourceIds must use Russian official registered authorities`
        );
      }
    }
    if (
      !Array.isArray(profile.sentenceAttestations) ||
      profile.sentenceAttestations.length !== sentences
    ) {
      issues.push(`${prefix}.sentenceAttestations must cover every sentence`);
    } else {
      for (const [index, attestation] of profile.sentenceAttestations.entries()) {
        const attestationPrefix = `${prefix}.sentenceAttestations[${index}]`;
        if (attestation?.sentence !== index + 1) {
          issues.push(`${attestationPrefix}.sentence must be ${index + 1}`);
        }
        if (
          !Array.isArray(attestation?.sourceIds) ||
          attestation.sourceIds.length === 0
        ) {
          issues.push(`${attestationPrefix}.sourceIds is required`);
          continue;
        }
        for (const sourceId of attestation.sourceIds) {
          if (!profile.sourceIds.includes(sourceId)) {
            issues.push(`${attestationPrefix} uses a source outside provenance`);
          }
          const source = sources.get(sourceId);
          if (
            !source ||
            !RUSSIAN_OFFICIAL_DESCRIPTION_AUTHORITIES.has(source.authorityId) ||
            source.evidenceClass !== "current-registry"
          ) {
            issues.push(`${attestationPrefix} lacks Russian official evidence`);
          }
        }
      }
    }
  } else {
    if (profile.origin !== "human-translation") {
      issues.push(`${prefix}.origin must be human-translation`);
    }
    if (profile.sourceLanguage !== "ru") {
      issues.push(`${prefix}.sourceLanguage must be ru`);
    }
    if (profile.translatedFromLocale !== "ru") {
      issues.push(`${prefix}.translatedFromLocale must be ru`);
    }
    if (profile.translatedFromSourceHash !== ruHash) {
      issues.push(`${prefix}.translatedFromSourceHash must pin the RU text`);
    }
    if (
      !Array.isArray(ruSourceIds) ||
      JSON.stringify(profile.sourceIds) !== JSON.stringify(ruSourceIds)
    ) {
      issues.push(`${prefix}.sourceIds must match the RU source provenance`);
    }
  }
  return issues;
}

function workTitleValues(record) {
  return [
    record?.title,
    record?.originalTitle,
    ...(Array.isArray(record?.alternateTitles) ? record.alternateTitles : []),
    record?.localizedTitles?.ru?.value,
    record?.localizedTitles?.en?.value,
    record?.translations?.ru?.title,
    record?.translations?.en?.title,
  ]
    .map(normalizeTitle)
    .filter(Boolean);
}

export function canonAdditionBatchIssues(
  manifest,
  { canonRegistry = null, archiveRecords = null } = {}
) {
  const issues = [];
  if (!isRecord(manifest)) return ["manifest must be an object"];
  if (manifest.schemaVersion !== CANON_ADDITION_SCHEMA_VERSION) {
    issues.push("schemaVersion must be 1");
  }
  if (!SLUG.test(manifest.packageId || "")) {
    issues.push("packageId must be a stable lowercase slug");
  }
  if (!isIsoCalendarDate(manifest.checkedAt)) {
    issues.push("checkedAt must be an ISO calendar date");
  }
  if (manifest.applicationStatus !== "isolated-research-hold") {
    issues.push("applicationStatus must remain isolated-research-hold");
  }
  if (manifest.publicationEffect !== "none") {
    issues.push("publicationEffect must remain none");
  }
  if (!exactText(manifest.policy, 160)) {
    issues.push("policy must document the fail-closed boundary");
  }
  if (manifest.hashProfile !== CANON_ADDITION_HASH_PROFILE) {
    issues.push("hashProfile is invalid");
  }
  if (manifest.registryVersion !== canonRegistry?.registryVersion) {
    issues.push("registryVersion does not match the checked-in registry");
  }

  const registryAuthorities = registryAuthorityMap(canonRegistry);
  const proposedAuthorities = proposedAuthorityMap(manifest);
  const proposedRows = Array.isArray(manifest.proposedAuthorities)
    ? manifest.proposedAuthorities
    : [];
  if (proposedRows.length !== 2) {
    issues.push("exactly two publisher authorities must remain proposed");
  }
  for (const duplicate of duplicates(
    proposedRows.map((authority) => authority?.authorityId)
  )) {
    issues.push(`duplicate proposed authority ${duplicate}`);
  }
  for (const [index, authority] of proposedRows.entries()) {
    const prefix = `proposedAuthorities[${index}]`;
    if (!isRecord(authority)) {
      issues.push(`${prefix} must be an object`);
      continue;
    }
    if (!SLUG.test(authority.authorityId || "")) {
      issues.push(`${prefix}.authorityId is invalid`);
    }
    if (registryAuthorities.has(authority.authorityId)) {
      issues.push(`${prefix} is already active and must leave this proposal list`);
    }
    if (authority.registrationStatus !== "proposed-not-active") {
      issues.push(`${prefix}.registrationStatus must be proposed-not-active`);
    }
    if (authority.tier !== "B") issues.push(`${prefix}.tier must be B`);
    if (!Array.isArray(authority.domains) || authority.domains.length === 0) {
      issues.push(`${prefix}.domains must be explicit`);
    }
    if (!Array.isArray(authority.allowedRoles)) {
      issues.push(`${prefix}.allowedRoles must be explicit`);
    }
  }

  const sources = sourceMap(manifest);
  const sourceRows = Array.isArray(manifest.sources) ? manifest.sources : [];
  for (const duplicate of duplicates(sourceRows.map((source) => source?.sourceId))) {
    issues.push(`duplicate sourceId ${duplicate}`);
  }
  for (const [index, source] of sourceRows.entries()) {
    const prefix = `sources[${index}]`;
    if (!isRecord(source)) {
      issues.push(`${prefix} must be an object`);
      continue;
    }
    if (!SLUG.test(source.sourceId || "")) {
      issues.push(`${prefix}.sourceId is invalid`);
    }
    if (!SOURCE_EVIDENCE_CLASSES.has(source.evidenceClass)) {
      issues.push(`${prefix}.evidenceClass is invalid`);
    }
    const parsed = parsedHttpsUrl(source.url);
    if (!parsed) issues.push(`${prefix}.url must be HTTPS`);
    if (!exactText(source.recordId, 4)) {
      issues.push(`${prefix}.recordId is required`);
    }
    if (!exactText(source.locator, 8)) {
      issues.push(`${prefix}.locator is required`);
    }
    if (!isIsoCalendarDate(source.retrievedAt)) {
      issues.push(`${prefix}.retrievedAt is invalid`);
    }
    if (!Array.isArray(source.claims) || source.claims.length < 3) {
      issues.push(`${prefix}.claims must contain at least three facts`);
    } else if (source.claims.some((claim) => !exactText(claim, 30))) {
      issues.push(`${prefix}.claims contain weak or padded text`);
    }
    if (!exactText(source.independenceGroup, 3)) {
      issues.push(`${prefix}.independenceGroup is required`);
    }

    if (source.evidenceClass === "current-registry") {
      const authority = registryAuthorities.get(source.authorityId);
      if (!authority) {
        issues.push(`${prefix} references an unknown registry authority`);
      } else {
        if (authority.tier !== source.authorityTier) {
          issues.push(`${prefix}.authorityTier disagrees with registry`);
        }
        if (authority.independenceGroup !== source.independenceGroup) {
          issues.push(`${prefix}.independenceGroup disagrees with registry`);
        }
        if (parsed && !domainMatches(parsed.hostname, authority.domains || [])) {
          issues.push(`${prefix}.url is outside registry authority domains`);
        }
      }
    } else if (source.evidenceClass === "proposed-authority") {
      const authority = proposedAuthorities.get(source.authorityId);
      if (!authority) {
        issues.push(`${prefix} references an unknown proposed authority`);
      } else {
        if (authority.tier !== source.authorityTier) {
          issues.push(`${prefix}.authorityTier disagrees with proposal`);
        }
        if (authority.independenceGroup !== source.independenceGroup) {
          issues.push(`${prefix}.independenceGroup disagrees with proposal`);
        }
        if (parsed && !domainMatches(parsed.hostname, authority.domains || [])) {
          issues.push(`${prefix}.url is outside proposed authority domains`);
        }
      }
    } else {
      if (source.authorityId !== null || source.authorityTier !== null) {
        issues.push(`${prefix} discovery-only authority fields must be null`);
      }
    }
  }

  const registryItems = registryItemMap(canonRegistry);
  const candidates = Array.isArray(manifest.candidates) ? manifest.candidates : [];
  if (candidates.length !== 3) issues.push("candidates must contain exactly three Works");
  for (const duplicate of duplicates(
    candidates.map((candidate) => candidate?.candidateId)
  )) {
    issues.push(`duplicate candidateId ${duplicate}`);
  }

  const archiveTitleIndex = new Map();
  if (Array.isArray(archiveRecords)) {
    for (const record of archiveRecords) {
      for (const title of workTitleValues(record)) {
        const list = archiveTitleIndex.get(title) || [];
        list.push(record);
        archiveTitleIndex.set(title, list);
      }
    }
  }

  for (const [index, candidate] of candidates.entries()) {
    const prefix = `candidates[${index}]`;
    if (!isRecord(candidate)) {
      issues.push(`${prefix} must be an object`);
      continue;
    }
    if (!SLUG.test(candidate.candidateId || "")) {
      issues.push(`${prefix}.candidateId is invalid`);
    }
    if (!RECORD_KEY.test(candidate.suggestedRecordKey || "")) {
      issues.push(`${prefix}.suggestedRecordKey is invalid`);
    }
    const hold = candidate.registryHoldRef;
    const registryItem = registryItems.get(`${hold?.sourceId}:${hold?.itemId}`);
    if (!registryItem) {
      issues.push(`${prefix}.registryHoldRef does not resolve`);
    } else {
      if (registryItem.ordinal !== hold.ordinal) {
        issues.push(`${prefix}.registryHoldRef ordinal is stale`);
      }
      if (registryItem.itemHash !== hold.itemHash) {
        issues.push(`${prefix}.registryHoldRef itemHash is stale`);
      }
      if (
        registryItem.adjudicationStatus !== "held" ||
        registryItem.adjudicatedRecordKey !== null
      ) {
        issues.push(`${prefix}.registryHoldRef is no longer an unmapped hold`);
      }
    }

    if (candidate.work?.entityKind !== "work") {
      issues.push(`${prefix}.work.entityKind must be work`);
    }
    if (!exactText(candidate.work?.originalTitle)) {
      issues.push(`${prefix}.work.originalTitle is required`);
    }
    if (candidate.work?.originalLanguage !== "ru") {
      issues.push(`${prefix}.work.originalLanguage must be ru`);
    }
    if (!exactText(candidate.work?.publicationModel, 80)) {
      issues.push(`${prefix}.work.publicationModel is required`);
    }

    const authorship = candidate.authorship;
    if (!isRecord(authorship)) {
      issues.push(`${prefix}.authorship must be an object`);
    } else {
      const authors = Array.isArray(authorship.authors) ? authorship.authors : [];
      if (authorship.kind === "single" && authors.length !== 1) {
        issues.push(`${prefix}.authorship single must have one author`);
      } else if (authorship.kind === "multiple" && authors.length < 2) {
        issues.push(`${prefix}.authorship multiple must have at least two authors`);
      } else if (!["single", "multiple"].includes(authorship.kind)) {
        issues.push(`${prefix}.authorship.kind is invalid`);
      }
      const authorKeys = authors.map(
        (author) => `${author?.countryId}:${author?.writerId}`
      );
      for (const duplicate of duplicates(authorKeys)) {
        issues.push(`${prefix}.authorship repeats ${duplicate}`);
      }
      authors.forEach((author, authorIndex) => {
        const authorPrefix = `${prefix}.authorship.authors[${authorIndex}]`;
        if (author?.position !== authorIndex + 1) {
          issues.push(`${authorPrefix}.position is invalid`);
        }
        if (!exactText(author?.countryId) || !exactText(author?.writerId)) {
          issues.push(`${authorPrefix} linked IDs are required`);
        }
        if (
          !exactText(author?.creditNames?.ru) ||
          !exactText(author?.creditNames?.en)
        ) {
          issues.push(`${authorPrefix} bilingual credit names are required`);
        }
        if (author?.linkStatus !== "missing-active-writer") {
          issues.push(`${authorPrefix}.linkStatus must remain fail-closed`);
        }
      });
      issues.push(
        ...sourceReferenceIssues(
          authorship.sourceIds,
          sources,
          `${prefix}.authorship.sourceIds`,
          { forbidDiscovery: true, minimumGroups: 2 }
        )
      );
    }

    issues.push(
      ...localizedTitleIssues(
        candidate.localizedTitles?.ru,
        "ru",
        sources,
        `${prefix}.localizedTitles.ru`
      ),
      ...localizedTitleIssues(
        candidate.localizedTitles?.en,
        "en",
        sources,
        `${prefix}.localizedTitles.en`
      )
    );
    issues.push(
      ...descriptionIssues(
        candidate.descriptions?.ru,
        "ru",
        sources,
        `${prefix}.descriptions.ru`,
        null
      ),
      ...descriptionIssues(
        candidate.descriptions?.en,
        "en",
        sources,
        `${prefix}.descriptions.en`,
        candidate.descriptions?.ru?.sha256,
        candidate.descriptions?.ru?.sourceIds
      )
    );

    if (candidate.publicationAssessment?.status !== "hold") {
      issues.push(`${prefix}.publicationAssessment.status must be hold`);
    }
    if (
      !Array.isArray(candidate.publicationAssessment?.holdCodes) ||
      candidate.publicationAssessment.holdCodes.length === 0
    ) {
      issues.push(`${prefix}.publicationAssessment.holdCodes are required`);
    }
    if (!exactText(candidate.publicationAssessment?.nextStep, 100)) {
      issues.push(`${prefix}.publicationAssessment.nextStep is required`);
    }
    if (candidate.canonAssessment?.status !== "hold-no-claim") {
      issues.push(`${prefix}.canonAssessment.status must be hold-no-claim`);
    }
    if (!Array.isArray(candidate.canonAssessment?.holdCodes)) {
      issues.push(`${prefix}.canonAssessment.holdCodes are required`);
    }
    if (
      candidate.reviewFingerprint !== canonAdditionCandidateFingerprint(candidate)
    ) {
      issues.push(`${prefix}.reviewFingerprint is stale`);
    }

    if (Array.isArray(archiveRecords)) {
      const exactMatches = archiveTitleIndex.get(
        normalizeTitle(candidate.work?.originalTitle)
      );
      if (exactMatches?.length) {
        issues.push(`${prefix} is no longer absent from the raw archive`);
      }
    }
  }

  const computedSummary = {
    candidateCount: candidates.length,
    publicationReadyCount: candidates.filter(
      (candidate) => candidate?.publicationAssessment?.status !== "hold"
    ).length,
    publicationHoldCount: candidates.filter(
      (candidate) => candidate?.publicationAssessment?.status === "hold"
    ).length,
    canonClaimCount: candidates.filter(
      (candidate) => candidate?.canonAssessment?.status !== "hold-no-claim"
    ).length,
    verifiedRuTitleCount: candidates.filter(
      (candidate) => candidate?.localizedTitles?.ru?.status === VERIFIED_TITLE_STATUS
    ).length,
    verifiedEnTitleCount: candidates.filter(
      (candidate) => candidate?.localizedTitles?.en?.status === VERIFIED_TITLE_STATUS
    ).length,
    withheldEnTitleCount: candidates.filter(
      (candidate) => candidate?.localizedTitles?.en?.status === WITHHELD_TITLE_STATUS
    ).length,
    multipleAuthorshipCount: candidates.filter(
      (candidate) => candidate?.authorship?.kind === "multiple"
    ).length,
    proposedAuthorityCount: proposedRows.length,
  };
  if (
    canonicalCanonAdditionJson(manifest.summary) !==
    canonicalCanonAdditionJson(computedSummary)
  ) {
    issues.push("summary is stale");
  }
  if (
    manifest.manifestFingerprint !== canonAdditionManifestFingerprint(manifest)
  ) {
    issues.push("manifestFingerprint is stale");
  }
  return unique(issues);
}

export function buildCanonAdditionBatchReport(
  manifest,
  canonRegistry,
  archiveRecords = []
) {
  const inventories = Array.isArray(canonRegistry?.inventories)
    ? canonRegistry.inventories
    : [];
  const inventorySummary = inventories.map((inventory) => {
    const items = Array.isArray(inventory.items) ? inventory.items : [];
    return {
      sourceId: inventory.sourceId,
      itemCount: items.length,
      acceptedCount: items.filter(
        (item) => item.adjudicationStatus === "accepted"
      ).length,
      rejectedCount: items.filter(
        (item) => item.adjudicationStatus === "rejected"
      ).length,
      heldCount: items.filter((item) => item.adjudicationStatus === "held")
        .length,
    };
  });
  const nebInventory = inventories.find(
    (inventory) => inventory.sourceId === manifest.registrySourceId
  );
  const selectedItemIds = new Set(
    manifest.candidates.map((candidate) => candidate.registryHoldRef.itemId)
  );
  const nebHeldNotSelected = (nebInventory?.items || [])
    .filter(
      (item) =>
        item.adjudicationStatus === "held" && !selectedItemIds.has(item.itemId)
    )
    .map((item) => ({
      itemId: item.itemId,
      titleExact: item.titleExact,
      reason:
        item.itemId === "printsessa-turandot"
          ? "non-Russian-origin Work deferred from the Russian-first batch"
          : "duplicate-resolution Work handled by the dedicated duplicate batch",
    }));
  const archiveTitleIndex = new Map();
  for (const record of archiveRecords) {
    for (const title of workTitleValues(record)) {
      archiveTitleIndex.set(title, (archiveTitleIndex.get(title) || 0) + 1);
    }
  }
  const report = {
    schemaVersion: 1,
    reportId: "book-canon-additions-batch01-evidence-report-2026-09-02",
    generatedAt: manifest.checkedAt,
    packageId: manifest.packageId,
    registryVersion: manifest.registryVersion,
    scope: {
      inventoriesInspected: inventorySummary.map((item) => item.sourceId),
      selectionRule:
        "Select only held, exact Work identities from the existing official inventories; prefer Russian-origin NEB omissions with official RU records and a documented EN-market manifestation; make no canon claim.",
      integrationPerformed: "production-research-catalog-only",
      publicationPerformed: false,
    },
    inventorySummary,
    selectedCandidates: manifest.candidates.map((candidate) => ({
      candidateId: candidate.candidateId,
      registryOrdinal: candidate.registryHoldRef.ordinal,
      registryItemId: candidate.registryHoldRef.itemId,
      originalTitle: candidate.work.originalTitle,
      authorshipKind: candidate.authorship.kind,
      ruTitleStatus: candidate.localizedTitles.ru.status,
      enTitleStatus: candidate.localizedTitles.en.status,
      publicationStatus: candidate.publicationAssessment.status,
      publicationHoldCodes: candidate.publicationAssessment.holdCodes,
      canonStatus: candidate.canonAssessment.status,
      rawArchiveExactTitleMatches:
        archiveTitleIndex.get(normalizeTitle(candidate.work.originalTitle)) || 0,
    })),
    nebHeldNotSelected,
    sourceAudit: {
      sourceCount: manifest.sources.length,
      currentRegistrySourceCount: manifest.sources.filter(
        (source) => source.evidenceClass === "current-registry"
      ).length,
      proposedAuthoritySourceCount: manifest.sources.filter(
        (source) => source.evidenceClass === "proposed-authority"
      ).length,
      discoveryOnlySourceCount: manifest.sources.filter(
        (source) => source.evidenceClass === "discovery-only"
      ).length,
      proposedAuthorityIds: manifest.proposedAuthorities.map(
        (authority) => authority.authorityId
      ),
    },
    conclusions: [
      "All three selected NEB Work identities are absent by exact original title from the checked raw archive.",
      "The Twelve Chairs is modeled as one coauthored Work with two mandatory linked author credits; it must never be routed as single authorship.",
      "The exact RU and EN-market title research is complete for The Twelve Chairs and Moscow and Muscovites, but their publisher authorities are not yet active in the registry.",
      "The English title for Лето Господне remains withheld because the observed print-on-demand manifestation lacks an independent national-library record and an authoritative editorial publisher record.",
      "Every Russian description and its English translation are grounded only in Russian official sources; foreign records are limited to English title and Expression evidence.",
      "All candidates are production research drafts excluded from the visitor archive and carry no canonical-classic claim."
    ],
    reportFingerprint: "",
  };
  report.reportFingerprint = canonAdditionReportFingerprint(report);
  return report;
}

export function canonAdditionBatchReportIssues(report, expectedReport) {
  const issues = [];
  if (!isRecord(report)) return ["report must be an object"];
  if (report.reportFingerprint !== canonAdditionReportFingerprint(report)) {
    issues.push("reportFingerprint is stale");
  }
  if (
    canonicalCanonAdditionJson(report) !==
    canonicalCanonAdditionJson(expectedReport)
  ) {
    issues.push("report does not match the evidence package and live fixtures");
  }
  return issues;
}
