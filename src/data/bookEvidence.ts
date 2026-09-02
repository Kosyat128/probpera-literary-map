import type {
  WorkCanonicalityEvidenceProfile,
  WorkDescriptionProvenanceProfile,
  WorkLocale,
  WorkProfile,
  WorkSourceProfile,
  WorkTitleEvidenceProfile,
} from "./countries/types";
import { bookPublicationIssues } from "./bookQuality";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const REQUIRED_REGISTRY_VERSION = "world-canon-2026-09-v2";
const ENGLISH_MARKETS = new Set(["AU", "CA", "GB", "IE", "IN", "NZ", "SG", "US", "ZA"]);
const TITLE_SELECTION_RULES = new Set([
  "authoritative-uniform-title",
  "earliest-authorized-edition",
  "current-complete-authorized-edition",
  "original-market-title",
]);
const TITLE_RECORD_KINDS = new Set([
  "national-bibliography",
  "legal-deposit-catalog",
  "publisher-catalog",
  "rights-holder-catalog",
  "author-estate",
  "critical-edition",
]);
const NATIONAL_RECORD_KINDS = new Set([
  "national-bibliography",
  "legal-deposit-catalog",
]);
const DESCRIPTION_ORIGINS = new Set([
  "article-adapted",
  "official-source-synthesis",
  "human-translation",
]);
const DESCRIPTION_TRANSFORMATIONS = new Set([
  "condensed",
  "deduplicated",
  "spoiler-limited",
  "style-edited",
]);
const CANON_STATUSES = new Set(["canonical-classic", "modern-landmark"]);
const CANON_CLASSES = new Set([
  "official-curriculum",
  "national-library-heritage-collection",
  "academy-or-literary-institute",
  "scholarly-critical-project",
  "international-heritage-register",
  "work-specific-landmark-award",
]);
const CANON_REGISTRY_WORK_ENTITY_PAIRS = new Set([
  "work:work",
  "work-cycle:aggregate-work",
  "coauthored-work:work",
]);

type RegistryAuthority = {
  authorityId?: unknown;
  independenceGroup?: unknown;
  tier?: unknown;
  domains?: unknown;
  allowedRoles?: unknown;
  markets?: unknown;
  authorityCountryId?: unknown;
};
type RegistrySource = {
  id?: unknown;
  authorityId?: unknown;
  class?: unknown;
  inventoryStatus?: unknown;
  coverageStatus?: unknown;
  snapshot?: unknown;
};
type RegistryItem = {
  ordinal?: unknown;
  itemId?: unknown;
  titleExact?: unknown;
  candidateKind?: unknown;
  entityKind?: unknown;
  adjudicationStatus?: unknown;
  adjudicatedRecordKey?: unknown;
};
type RegistryInventory = { sourceId?: unknown; items?: unknown };
type CanonRegistryContext = {
  registryVersion?: unknown;
  authorities?: unknown;
  sources?: unknown;
  inventories?: unknown;
};

export type BookEvidenceV2Context = {
  canonRegistry?: CanonRegistryContext;
  recordKey?: string;
  originCountryIds?: string[];
  descriptionSha256ByLocale?: Partial<Record<WorkLocale, string>>;
};

function safeString(value: unknown) {
  return typeof value === "string" ? value : "";
}
function safeArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
function safeStrings(value: unknown): string[] {
  return safeArray(value).filter(
    (item): item is string => typeof item === "string"
  );
}
function unique(values: string[]) {
  return [...new Set(values)];
}
function isIsoCalendarDate(value: unknown) {
  const text = safeString(value);
  if (!ISO_DATE.test(text)) return false;
  const parsed = new Date(`${text}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.valueOf()) &&
    parsed.toISOString().slice(0, 10) === text
  );
}
function parsedHttpsUrl(value: unknown) {
  try {
    const parsed = new URL(safeString(value));
    if (
      parsed.protocol !== "https:" ||
      !parsed.hostname.includes(".") ||
      parsed.username ||
      parsed.password
    ) {
      return undefined;
    }
    return parsed;
  } catch {
    return undefined;
  }
}
function canonicalUrl(value: unknown) {
  const parsed = parsedHttpsUrl(value);
  if (!parsed) return "";
  parsed.hash = "";
  parsed.searchParams.sort();
  parsed.hostname = parsed.hostname.toLocaleLowerCase("en");
  if (parsed.pathname !== "/") {
    parsed.pathname = parsed.pathname.replace(/\/+$/u, "");
  }
  return parsed.toString();
}
function normalizeTitle(value: unknown) {
  return safeString(value)
    .normalize("NFKC")
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015]/gu, "-")
    .replace(/\s+/gu, " ")
    .trim()
    .toLocaleLowerCase("ru");
}
function normalizeAuthorityId(value: unknown) {
  return safeString(value).normalize("NFKC").trim().toLocaleLowerCase("en");
}
function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right, "en"))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}
function titleMarketMatches(locale: WorkLocale, market: unknown) {
  const normalized = safeString(market).toLocaleUpperCase("en");
  return locale === "ru" ? normalized === "RU" : ENGLISH_MARKETS.has(normalized);
}
function registryAuthorities(context?: BookEvidenceV2Context) {
  return safeArray(context?.canonRegistry?.authorities).filter(
    (item): item is RegistryAuthority =>
      Boolean(item && typeof item === "object")
  );
}
function registryAuthority(
  context: BookEvidenceV2Context | undefined,
  authorityId: unknown
) {
  const normalized = normalizeAuthorityId(authorityId);
  return registryAuthorities(context).find(
    (authority) => normalizeAuthorityId(authority.authorityId) === normalized
  );
}
function authorityIssues(
  authorityId: unknown,
  sourceUrl: unknown,
  declaredTier: unknown,
  requiredRole: string,
  market: unknown,
  context: BookEvidenceV2Context | undefined,
  prefix: string
) {
  const issues: string[] = [];
  const authority = registryAuthority(context, authorityId);
  if (!authority) return [`${prefix}-authority-not-registered`];
  const domains = safeStrings(authority.domains).map((domain) =>
    domain.replace(/^\.+/u, "").toLocaleLowerCase("en")
  );
  const hostname =
    parsedHttpsUrl(sourceUrl)?.hostname.toLocaleLowerCase("en") || "";
  if (
    domains.length === 0 ||
    !domains.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
    )
  ) {
    issues.push(`${prefix}-authority-domain-mismatch`);
  }
  if (!safeStrings(authority.allowedRoles).includes(requiredRole)) {
    issues.push(`${prefix}-authority-role-not-allowed`);
  }
  if (
    declaredTier !== authority.tier ||
    !["A", "B"].includes(safeString(authority.tier))
  ) {
    issues.push(`${prefix}-authority-tier-mismatch`);
  }
  const markets = safeStrings(authority.markets).map((value) =>
    value.toLocaleUpperCase("en")
  );
  const normalizedMarket = safeString(market).toLocaleUpperCase("en");
  if (
    normalizedMarket &&
    markets.length > 0 &&
    !markets.includes(normalizedMarket)
  ) {
    issues.push(`${prefix}-authority-market-mismatch`);
  }
  if (!safeString(authority.independenceGroup).trim()) {
    issues.push(`${prefix}-authority-independence-group-required`);
  }
  return issues;
}
function authorityRoleForTitleRecord(recordKind: unknown) {
  if (NATIONAL_RECORD_KINDS.has(safeString(recordKind))) {
    return "title-national-record";
  }
  if (recordKind === "publisher-catalog") return "title-publisher";
  if (recordKind === "rights-holder-catalog") return "title-rights-holder";
  if (recordKind === "author-estate") return "title-author-estate";
  return "title-critical-edition";
}
function localizedTitleProfiles(work: WorkProfile, locale: WorkLocale) {
  return {
    workLevel: work.localizedTitles?.[locale],
    translationLevel: work.translations?.[locale]?.titleEvidence,
  };
}
function selectedLocalizedTitle(work: WorkProfile, locale: WorkLocale) {
  const profiles = localizedTitleProfiles(work, locale);
  return profiles.workLevel || profiles.translationLevel;
}
function structuredSourceMap(work: WorkProfile) {
  const map = new Map<string, WorkSourceProfile>();
  for (const rawSource of safeArray(work.sources)) {
    if (!rawSource || typeof rawSource !== "object") continue;
    const source = rawSource as WorkSourceProfile;
    const url = canonicalUrl(source.url);
    if (url) map.set(url, source);
  }
  return map;
}
function structuredSourceMarket(source: WorkSourceProfile) {
  return safeString(source.market || source.country).toLocaleUpperCase("en");
}

export function localizedBookTitleEvidenceIssues(
  work: WorkProfile,
  locale: WorkLocale,
  context?: BookEvidenceV2Context
) {
  const issues: string[] = [];
  const translation = work.translations?.[locale];
  const profiles = localizedTitleProfiles(work, locale);
  const profile = selectedLocalizedTitle(work, locale);
  if (!translation) return [`missing-${locale}-translation`];
  if (!profile) return [`missing-${locale}-published-title-evidence`];
  if (
    profiles.workLevel &&
    profiles.translationLevel &&
    stableSerialize(profiles.workLevel) !==
      stableSerialize(profiles.translationLevel)
  ) {
    issues.push(`${locale}-title-evidence-storage-conflict`);
  }

  const displayTitle = normalizeTitle(translation.title);
  if (!displayTitle) issues.push(`${locale}-display-title-required`);
  if (profile.entityKind !== "expression") {
    issues.push(`${locale}-title-expression-entity-kind-required`);
  }
  if (!safeString(profile.expressionId).trim()) {
    issues.push(`${locale}-title-expression-id-required`);
  }
  if (profile.locale !== locale) issues.push(`${locale}-title-locale-mismatch`);
  if (normalizeTitle(profile.value) !== displayTitle) {
    issues.push(`${locale}-title-evidence-does-not-match-display-title`);
  }
  if (profile.status !== "verified-published") {
    issues.push(`${locale}-title-is-not-verified-published`);
  }
  if (!safeString(profile.expressionLanguage).trim()) {
    issues.push(`${locale}-title-expression-language-required`);
  }
  if (!titleMarketMatches(locale, profile.market)) {
    issues.push(
      `${locale}-title-market-invalid:${safeString(profile.market) || "missing"}`
    );
  }
  if (!TITLE_SELECTION_RULES.has(safeString(profile.selectionRule))) {
    issues.push(`${locale}-title-selection-rule-invalid`);
  }

  const evidenceRecords = safeArray(profile.evidence);
  if (evidenceRecords.length < 2) {
    issues.push(`${locale}-title-two-independent-records-required`);
  }
  const sources = structuredSourceMap(work);
  const translationSourceUrls = new Set(
    safeStrings(translation.sourceUrls).map(canonicalUrl).filter(Boolean)
  );
  const authorityGroups = new Set<string>();
  const evidenceUrls = new Set<string>();
  let hasRegisteredTierA = false;
  let hasRegisteredNationalRecord = false;

  for (const [index, rawEvidence] of evidenceRecords.entries()) {
    const prefix = `${locale}-title-evidence-${index + 1}`;
    if (!rawEvidence || typeof rawEvidence !== "object") {
      issues.push(`${prefix}-malformed`);
      continue;
    }
    const evidence = rawEvidence as WorkTitleEvidenceProfile;
    const evidenceUrl = canonicalUrl(evidence.sourceUrl);
    if (!evidenceUrl) issues.push(`${prefix}-https-required`);
    else evidenceUrls.add(evidenceUrl);
    if (evidence.entityKind !== "manifestation") {
      issues.push(`${prefix}-manifestation-entity-kind-required`);
    }
    if (!safeString(evidence.manifestationId).trim()) {
      issues.push(`${prefix}-manifestation-id-required`);
    }
    if (!safeString(evidence.provider).trim()) {
      issues.push(`${prefix}-provider-required`);
    }
    const authorityId = normalizeAuthorityId(evidence.authorityId);
    if (!authorityId) issues.push(`${prefix}-authority-id-required`);
    if (!["A", "B"].includes(safeString(evidence.authorityTier))) {
      issues.push(`${prefix}-authority-tier-invalid`);
    }
    if (!TITLE_RECORD_KINDS.has(safeString(evidence.recordKind))) {
      issues.push(`${prefix}-record-kind-invalid`);
    }
    issues.push(
      ...authorityIssues(
        evidence.authorityId,
        evidence.sourceUrl,
        evidence.authorityTier,
        authorityRoleForTitleRecord(evidence.recordKind),
        evidence.market,
        context,
        prefix
      )
    );
    const authority = registryAuthority(context, evidence.authorityId);
    const independenceGroup = normalizeAuthorityId(
      authority?.independenceGroup
    );
    if (independenceGroup) authorityGroups.add(independenceGroup);
    if (authority?.tier === "A") hasRegisteredTierA = true;
    if (
      authority?.tier === "A" &&
      NATIONAL_RECORD_KINDS.has(safeString(evidence.recordKind)) &&
      safeStrings(authority.allowedRoles).includes("title-national-record")
    ) {
      hasRegisteredNationalRecord = true;
    }
    if (!safeString(evidence.recordId).trim()) {
      issues.push(`${prefix}-record-id-required`);
    }
    if (evidence.locale !== locale) issues.push(`${prefix}-locale-mismatch`);
    if (evidence.market !== profile.market) {
      issues.push(`${prefix}-market-mismatch`);
    }
    if (evidence.expressionLanguage !== profile.expressionLanguage) {
      issues.push(`${prefix}-expression-language-mismatch`);
    }
    const titleRelation = safeString(
      evidence.titleRelation || "principal"
    ).trim();
    if (!["principal", "contained-work"].includes(titleRelation)) {
      issues.push(`${prefix}-title-relation-invalid`);
    } else if (titleRelation === "contained-work") {
      if (normalizeTitle(evidence.analyticTitleExact) !== displayTitle) {
        issues.push(`${prefix}-exact-analytic-title-mismatch`);
      }
      if (!safeString(evidence.containerTitleExact).trim()) {
        issues.push(`${prefix}-container-title-required`);
      } else if (
        normalizeTitle(evidence.catalogTitleExact) !==
        normalizeTitle(evidence.containerTitleExact)
      ) {
        issues.push(`${prefix}-exact-container-title-mismatch`);
      }
      if (
        !["contents-note", "table-of-contents"].includes(
          safeString(evidence.containedInField)
        )
      ) {
        issues.push(`${prefix}-contained-in-field-invalid`);
      }
    } else {
      if (normalizeTitle(evidence.catalogTitleExact) !== displayTitle) {
        issues.push(`${prefix}-exact-catalog-title-mismatch`);
      }
      if (
        evidence.analyticTitleExact !== undefined ||
        evidence.containerTitleExact !== undefined ||
        evidence.containedInField !== undefined
      ) {
        issues.push(`${prefix}-unexpected-contained-work-metadata`);
      }
    }
    if (!isIsoCalendarDate(evidence.retrievedAt)) {
      issues.push(`${prefix}-retrieved-at-invalid`);
    }
    if (!isIsoCalendarDate(evidence.checkedAt)) {
      issues.push(`${prefix}-checked-at-invalid`);
    }
    if (!safeString(evidence.checkedBy).trim()) {
      issues.push(`${prefix}-checked-by-required`);
    }
    if (
      evidence.publicationYear !== undefined &&
      (!Number.isInteger(evidence.publicationYear) ||
        evidence.publicationYear < 1000 ||
        evidence.publicationYear > new Date().getUTCFullYear() + 1)
    ) {
      issues.push(`${prefix}-publication-year-invalid`);
    }
    if (!translationSourceUrls.has(evidenceUrl)) {
      issues.push(`${prefix}-url-not-declared-by-translation`);
    }
    const structuredSource = sources.get(evidenceUrl);
    if (
      !structuredSource ||
      !safeStrings(structuredSource.fields).includes("title")
    ) {
      issues.push(`${prefix}-structured-title-source-required`);
    } else {
      if (
        normalizeAuthorityId(structuredSource.authorityId) !== authorityId
      ) {
        issues.push(`${prefix}-structured-authority-mismatch`);
      }
      if (structuredSource.recordId !== evidence.recordId) {
        issues.push(`${prefix}-structured-record-id-mismatch`);
      }
      if (
        structuredSourceMarket(structuredSource) !==
        safeString(evidence.market).toLocaleUpperCase("en")
      ) {
        issues.push(`${prefix}-structured-market-mismatch`);
      }
      if (structuredSource.language !== evidence.expressionLanguage) {
        issues.push(`${prefix}-structured-language-mismatch`);
      }
      if (structuredSource.recordKind !== evidence.recordKind) {
        issues.push(`${prefix}-structured-record-kind-mismatch`);
      }
      if (titleRelation === "contained-work") {
        if (
          !safeStrings(structuredSource.fields).includes("container-title")
        ) {
          issues.push(`${prefix}-structured-container-title-required`);
        }
        if (
          !safeStrings(structuredSource.fields).includes("contained-title")
        ) {
          issues.push(`${prefix}-structured-contained-title-required`);
        }
      }
    }
  }

  if (evidenceUrls.size < 2) {
    issues.push(`${locale}-title-two-distinct-record-urls-required`);
  }
  if (authorityGroups.size < 2) {
    issues.push(`${locale}-title-two-independent-authorities-required`);
  }
  if (!hasRegisteredTierA) {
    issues.push(`${locale}-title-tier-a-source-required`);
  }
  if (!hasRegisteredNationalRecord) {
    issues.push(`${locale}-title-national-bibliography-required`);
  }
  return unique(issues);
}

function editorialIdentityIssues(
  provenance: WorkDescriptionProvenanceProfile,
  locale: WorkLocale
) {
  const issues: string[] = [];
  const author = safeString(provenance.author).trim();
  const reviewer = safeString(provenance.reviewedBy).trim();
  if (!author) issues.push(`${locale}-description-author-required`);
  if (!reviewer) issues.push(`${locale}-description-reviewer-required`);
  if (
    author &&
    reviewer &&
    author.toLocaleLowerCase("ru") === reviewer.toLocaleLowerCase("ru")
  ) {
    issues.push(`${locale}-description-independent-review-required`);
  }
  if (!isIsoCalendarDate(provenance.createdAt)) {
    issues.push(`${locale}-description-created-at-invalid`);
  }
  if (!isIsoCalendarDate(provenance.reviewedAt)) {
    issues.push(`${locale}-description-reviewed-at-invalid`);
  }
  return issues;
}
function descriptionFactSources(
  work: WorkProfile,
  provenanceUrls: Set<string>
) {
  return [...structuredSourceMap(work).entries()]
    .filter(
      ([url, source]) =>
        provenanceUrls.has(url) &&
        safeStrings(source.fields).includes("description")
    )
    .map(([, source]) => source);
}

function independentDescriptionFactIssues(
  work: WorkProfile,
  provenanceUrls: Set<string>,
  expectedOrigins: string[],
  context: BookEvidenceV2Context | undefined,
  locale: WorkLocale,
  originLabel: "article" | "synthesis"
) {
  const issues: string[] = [];
  const factSources = descriptionFactSources(work, provenanceUrls).filter(
    (source) => source.recordKind !== "article-source"
  );
  if (factSources.length < 2) {
    issues.push(`${locale}-description-${originLabel}-two-fact-sources-required`);
  }
  const independenceGroups = new Set<string>();
  for (const [index, source] of factSources.entries()) {
    const prefix = `${locale}-description-fact-source-${index + 1}`;
    issues.push(
      ...authorityIssues(
        source.authorityId,
        source.url,
        source.authorityTier,
        "description-fact",
        source.market,
        context,
        prefix
      )
    );
    const authority = registryAuthority(context, source.authorityId);
    const group = normalizeAuthorityId(authority?.independenceGroup);
    if (group) independenceGroups.add(group);
  }
  if (independenceGroups.size < 2) {
    issues.push(`${locale}-description-two-independent-authorities-required`);
  }
  if (
    !factSources.some((source) =>
      expectedOrigins.includes(
        safeString(
          registryAuthority(context, source.authorityId)?.authorityCountryId
        ).toLocaleUpperCase("en")
      )
    )
  ) {
    issues.push(`${locale}-description-origin-country-authority-required`);
  }
  return issues;
}

export function bookDescriptionProvenanceIssues(
  work: WorkProfile,
  locale: WorkLocale,
  context?: BookEvidenceV2Context
) {
  const translation = work.translations?.[locale];
  const provenance = translation?.descriptionProvenance;
  if (!translation) return [`missing-${locale}-translation`];
  if (!provenance || typeof provenance !== "object") {
    return [`missing-${locale}-description-provenance`];
  }

  const issues = editorialIdentityIssues(provenance, locale);
  const origin = safeString(provenance.origin);
  if (!DESCRIPTION_ORIGINS.has(origin)) {
    issues.push(`${locale}-description-origin-invalid`);
  }
  const transformations = safeStrings(provenance.transformations);
  if (
    safeArray(provenance.transformations).length !== transformations.length ||
    transformations.some((value) => !DESCRIPTION_TRANSFORMATIONS.has(value))
  ) {
    issues.push(`${locale}-description-transformations-invalid`);
  }
  const declaredTranslationUrls = new Set(
    safeStrings(translation.sourceUrls).map(canonicalUrl).filter(Boolean)
  );
  const structuredUrls = new Set(structuredSourceMap(work).keys());
  const provenanceSourceUrls = safeStrings(provenance.sourceUrls);
  const canonicalProvenanceUrls = provenanceSourceUrls.map(canonicalUrl);
  const distinctProvenanceUrls = new Set(
    canonicalProvenanceUrls.filter(Boolean)
  );
  if (!safeString(provenance.sourceLanguage).trim()) {
    issues.push(`${locale}-description-source-language-required`);
  }
  const sourceCountry = safeString(
    provenance.sourceCountry
  ).toLocaleUpperCase("en");
  if (!sourceCountry) {
    issues.push(`${locale}-description-source-country-required`);
  }
  const expectedOrigins = safeStrings(context?.originCountryIds).map((value) =>
    value.toLocaleUpperCase("en")
  );
  if (expectedOrigins.length === 0) {
    issues.push(`${locale}-description-origin-country-context-required`);
  } else if (!expectedOrigins.includes(sourceCountry)) {
    issues.push(
      `${locale}-description-source-country-does-not-match-work-origin`
    );
  }
  if (provenanceSourceUrls.length === 0) {
    issues.push(`${locale}-description-source-required`);
  }
  if (
    distinctProvenanceUrls.size !== provenanceSourceUrls.length ||
    canonicalProvenanceUrls.some((url) => !url)
  ) {
    issues.push(`${locale}-description-source-urls-invalid-or-duplicate`);
  }
  for (const sourceUrl of distinctProvenanceUrls) {
    if (!declaredTranslationUrls.has(sourceUrl)) {
      issues.push(`${locale}-description-source-not-declared-by-translation`);
    }
    if (!structuredUrls.has(sourceUrl)) {
      issues.push(`${locale}-description-structured-source-required`);
    }
  }
  if (!provenance.rights || provenance.rights.copiedSourceText !== false) {
    issues.push(`${locale}-description-copied-source-text-forbidden`);
  }

  if (origin === "article-adapted") {
    const article = provenance.sourceArticle;
    if (!article || typeof article !== "object") {
      issues.push(`${locale}-description-article-provenance-required`);
    } else {
      if (
        !safeString(article.articleId).trim() ||
        !safeString(article.revisionId).trim()
      ) {
        issues.push(`${locale}-description-article-identity-required`);
      }
      if (!canonicalUrl(article.url)) {
        issues.push(`${locale}-description-article-url-invalid`);
      }
      if (!SHA256.test(safeString(article.sourceHash))) {
        issues.push(`${locale}-description-article-source-hash-invalid`);
      }
      if (!SHA256.test(safeString(article.excerptHash))) {
        issues.push(`${locale}-description-article-excerpt-hash-invalid`);
      }
      if (!distinctProvenanceUrls.has(canonicalUrl(article.url))) {
        issues.push(`${locale}-description-article-url-not-declared`);
      }
      const source = structuredSourceMap(work).get(canonicalUrl(article.url));
      if (!source || source.recordKind !== "article-source") {
        issues.push(
          `${locale}-description-article-structured-source-required`
        );
      } else {
        issues.push(
          ...authorityIssues(
            source.authorityId,
            source.url,
            source.authorityTier,
            "project-article",
            source.market,
            context,
            `${locale}-description-article`
          )
        );
      }
    }
    for (const required of ["condensed", "spoiler-limited", "style-edited"]) {
      if (!transformations.includes(required)) {
        issues.push(`${locale}-description-article-${required}-required`);
      }
    }
    if (provenance.rights?.textOrigin !== "project-owned-article") {
      issues.push(`${locale}-description-article-rights-required`);
    }
    if (translation.method !== "editorial-original") {
      issues.push(`${locale}-description-article-method-invalid`);
    }
    issues.push(
      ...independentDescriptionFactIssues(
        work,
        distinctProvenanceUrls,
        expectedOrigins,
        context,
        locale,
        "article"
      )
    );
  }

  if (origin === "official-source-synthesis") {
    issues.push(
      ...independentDescriptionFactIssues(
        work,
        distinctProvenanceUrls,
        expectedOrigins,
        context,
        locale,
        "synthesis"
      )
    );
    if (provenance.rights?.textOrigin !== "project-original") {
      issues.push(`${locale}-description-project-original-required`);
    }
    if (translation.method !== "editorial-original") {
      issues.push(`${locale}-description-synthesis-method-invalid`);
    }
  }

  if (origin === "human-translation") {
    const sourceLocale = provenance.translatedFromLocale;
    const expectedHash = safeString(provenance.translatedFromSourceHash);
    if (!sourceLocale || !expectedHash) {
      issues.push(`${locale}-description-translation-link-required`);
    } else if (!SHA256.test(expectedHash)) {
      issues.push(`${locale}-description-translation-source-hash-invalid`);
    }
    if (
      sourceLocale === locale ||
      !["ru", "en"].includes(safeString(sourceLocale))
    ) {
      issues.push(
        `${locale}-description-translation-source-locale-invalid`
      );
    }
    if (sourceLocale && !work.translations?.[sourceLocale]) {
      issues.push(`${locale}-description-translation-source-missing`);
    }
    const actualHash = sourceLocale
      ? safeString(context?.descriptionSha256ByLocale?.[sourceLocale])
      : "";
    if (!actualHash) {
      issues.push(
        `${locale}-description-translation-hash-context-required`
      );
    } else if (actualHash !== expectedHash) {
      issues.push(
        `${locale}-description-translation-source-hash-mismatch`
      );
    }
    if (provenance.rights?.textOrigin !== "project-original") {
      issues.push(`${locale}-description-translation-rights-invalid`);
    }
    if (translation.method !== "human-translation") {
      issues.push(`${locale}-description-translation-method-invalid`);
    }
  }
  return unique(issues);
}

function workTitleCandidates(work: WorkProfile) {
  return unique(
    [
      work.title,
      work.originalTitle,
      work.translations?.ru?.title,
      work.translations?.en?.title,
      work.localizedTitles?.ru?.value,
      work.localizedTitles?.en?.value,
    ]
      .map(normalizeTitle)
      .filter(Boolean)
  );
}
function registrySources(context?: BookEvidenceV2Context) {
  return safeArray(context?.canonRegistry?.sources).filter(
    (item): item is RegistrySource =>
      Boolean(item && typeof item === "object")
  );
}
function registryInventories(context?: BookEvidenceV2Context) {
  return safeArray(context?.canonRegistry?.inventories).filter(
    (item): item is RegistryInventory =>
      Boolean(item && typeof item === "object")
  );
}
function canonicalityEvidenceIssues(
  work: WorkProfile,
  rawEvidence: unknown,
  index: number,
  context?: BookEvidenceV2Context
) {
  const prefix = `canon-evidence-${index + 1}`;
  const issues: string[] = [];
  if (!rawEvidence || typeof rawEvidence !== "object") {
    return [`${prefix}-malformed`];
  }
  const evidence = rawEvidence as WorkCanonicalityEvidenceProfile;
  if (!canonicalUrl(evidence.sourceUrl)) {
    issues.push(`${prefix}-https-required`);
  }
  if (!safeString(evidence.provider).trim()) {
    issues.push(`${prefix}-provider-required`);
  }
  if (!normalizeAuthorityId(evidence.authorityId)) {
    issues.push(`${prefix}-authority-id-required`);
  }
  if (!["A", "B"].includes(safeString(evidence.authorityTier))) {
    issues.push(`${prefix}-authority-tier-invalid`);
  }
  if (!CANON_CLASSES.has(safeString(evidence.class))) {
    issues.push(`${prefix}-class-invalid`);
  }
  if (!safeString(evidence.itemId).trim()) {
    issues.push(`${prefix}-item-id-required`);
  }
  if (!safeString(evidence.assertion).trim()) {
    issues.push(`${prefix}-assertion-required`);
  }
  if (!isIsoCalendarDate(evidence.snapshotAt)) {
    issues.push(`${prefix}-snapshot-at-invalid`);
  }
  if (!safeString(evidence.registrySourceId).trim()) {
    issues.push(`${prefix}-registry-source-id-required`);
  }
  if (
    !Number.isInteger(evidence.registryItemOrdinal) ||
    evidence.registryItemOrdinal < 1
  ) {
    issues.push(`${prefix}-registry-item-ordinal-invalid`);
  }

  const source = registrySources(context).find(
    (candidate) => candidate.id === evidence.registrySourceId
  );
  if (!source) {
    issues.push(`${prefix}-registry-source-not-found`);
    return issues;
  }
  if (source.inventoryStatus !== "adjudicated") {
    issues.push(`${prefix}-registry-source-not-adjudicated`);
  }
  if (source.coverageStatus !== "adjudicated") {
    issues.push(`${prefix}-registry-coverage-not-adjudicated`);
  }
  const snapshot =
    source.snapshot && typeof source.snapshot === "object"
      ? (source.snapshot as Record<string, unknown>)
      : undefined;
  if (
    snapshot?.snapshotStatus !== "verified-content-hash" ||
    !SHA256.test(safeString(snapshot?.contentSha256))
  ) {
    issues.push(`${prefix}-registry-snapshot-not-content-verified`);
  }
  if (
    normalizeAuthorityId(source.authorityId) !==
    normalizeAuthorityId(evidence.authorityId)
  ) {
    issues.push(`${prefix}-registry-authority-mismatch`);
  }
  if (source.class !== evidence.class) {
    issues.push(`${prefix}-registry-class-mismatch`);
  }
  issues.push(
    ...authorityIssues(
      evidence.authorityId,
      evidence.sourceUrl,
      evidence.authorityTier,
      "canon-selection",
      undefined,
      context,
      prefix
    )
  );
  const inventory = registryInventories(context).find(
    (candidate) => candidate.sourceId === evidence.registrySourceId
  );
  const item = safeArray(inventory?.items)
    .filter(
      (candidate): candidate is RegistryItem =>
        Boolean(candidate && typeof candidate === "object")
    )
    .find((candidate) => candidate.ordinal === evidence.registryItemOrdinal);
  if (!item) {
    issues.push(`${prefix}-registry-item-not-found`);
    return issues;
  }
  if (item.itemId !== evidence.itemId) {
    issues.push(`${prefix}-registry-item-id-mismatch`);
  }
  if (
    !CANON_REGISTRY_WORK_ENTITY_PAIRS.has(
      `${safeString(item.candidateKind)}:${safeString(item.entityKind)}`
    )
  ) {
    issues.push(`${prefix}-registry-item-is-not-work`);
  }
  if (item.adjudicationStatus !== "accepted") {
    issues.push(`${prefix}-registry-item-not-accepted`);
  }
  if (!context?.recordKey || item.adjudicatedRecordKey !== context.recordKey) {
    issues.push(`${prefix}-registry-record-key-mismatch`);
  }
  if (!workTitleCandidates(work).includes(normalizeTitle(item.titleExact))) {
    issues.push(`${prefix}-registry-title-mismatch`);
  }
  return issues;
}

export function bookCanonEvidenceIssues(
  work: WorkProfile,
  context?: BookEvidenceV2Context
) {
  const canon = work.canon;
  // Canonicality is a positive editorial claim, not a prerequisite for a
  // bibliographically sound book card. Ordinary works may be published after
  // their identity, localized editions and descriptions have passed the same
  // evidence gate. If a card claims canonical/landmark status, that additional
  // claim is validated strictly against the controlled canon registry.
  if (canon === undefined) return [];
  if (!canon || typeof canon !== "object") return ["malformed-work-canon-claim"];
  const evidenceRecords = safeArray(canon.evidence);
  const issues = evidenceRecords.flatMap((evidence, index) =>
    canonicalityEvidenceIssues(work, evidence, index, context)
  );
  if (!context?.canonRegistry) issues.push("canon-registry-context-required");
  const contextVersion = safeString(context?.canonRegistry?.registryVersion);
  if (contextVersion !== REQUIRED_REGISTRY_VERSION) {
    issues.push("canon-registry-context-version-invalid");
  }
  if (safeString(canon.registryVersion) !== contextVersion) {
    issues.push("canon-registry-version-mismatch");
  }
  if (!CANON_STATUSES.has(safeString(canon.status))) {
    issues.push("canon-status-invalid");
  }
  const independenceGroups = new Set<string>();
  const evidenceUrls = new Set<string>();
  const sourceIds = new Set<string>();
  let hasTierA = false;
  for (const rawEvidence of evidenceRecords) {
    if (!rawEvidence || typeof rawEvidence !== "object") continue;
    const evidence = rawEvidence as WorkCanonicalityEvidenceProfile;
    const sourceUrl = canonicalUrl(evidence.sourceUrl);
    if (sourceUrl) evidenceUrls.add(sourceUrl);
    if (safeString(evidence.registrySourceId)) {
      sourceIds.add(evidence.registrySourceId);
    }
    const authority = registryAuthority(context, evidence.authorityId);
    const group = normalizeAuthorityId(authority?.independenceGroup);
    if (group) independenceGroups.add(group);
    if (authority?.tier === "A") hasTierA = true;
  }
  if (evidenceRecords.length < 2) {
    issues.push("canon-two-work-specific-signals-required");
  }
  if (independenceGroups.size < 2) {
    issues.push("canon-two-independent-authorities-required");
  }
  if (sourceIds.size < 2) {
    issues.push("canon-two-registry-sources-required");
  }
  if (evidenceUrls.size < 2) {
    issues.push("canon-two-distinct-source-urls-required");
  }
  if (!hasTierA) issues.push("canon-tier-a-evidence-required");
  if (
    canon.status === "canonical-classic" &&
    evidenceRecords.length > 0 &&
    evidenceRecords.every(
      (rawEvidence) =>
        Boolean(rawEvidence && typeof rawEvidence === "object") &&
        (rawEvidence as WorkCanonicalityEvidenceProfile).class ===
          "work-specific-landmark-award"
    )
  ) {
    issues.push("classic-status-cannot-rest-only-on-awards");
  }
  if (!safeString(canon.reviewedBy).trim()) {
    issues.push("canon-reviewer-required");
  }
  if (!isIsoCalendarDate(canon.reviewedAt)) {
    issues.push("canon-reviewed-at-invalid");
  }
  return unique(issues);
}

function legacyPublicationIssueCodes(work: WorkProfile) {
  try {
    return bookPublicationIssues(work).map((issue) => `publication:${issue}`);
  } catch {
    return ["publication:malformed-work-payload"];
  }
}

/**
 * Future atomic publication contract. It is intentionally fail-closed: the
 * caller supplies the checked-in authority/canon registry, canonical key,
 * reviewed origin jurisdictions and actual source-description hashes.
 */
export function bookEvidenceV2Issues(
  work: WorkProfile,
  context?: BookEvidenceV2Context
) {
  return unique([
    ...legacyPublicationIssueCodes(work),
    ...bookCanonEvidenceIssues(work, context),
    ...localizedBookTitleEvidenceIssues(work, "ru", context),
    ...localizedBookTitleEvidenceIssues(work, "en", context),
    ...bookDescriptionProvenanceIssues(work, "ru", context),
    ...bookDescriptionProvenanceIssues(work, "en", context),
  ]);
}
export function isBookEvidenceV2Ready(
  work: WorkProfile,
  context?: BookEvidenceV2Context
) {
  return bookEvidenceV2Issues(work, context).length === 0;
}
export const requiredBookCanonRegistryVersion = REQUIRED_REGISTRY_VERSION;
