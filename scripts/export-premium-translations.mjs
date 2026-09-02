import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { commitAtomicFileSet } from "./lib/atomic-file-set.mjs";
import {
  requirePublicCmsExportKey,
  resolveCmsExportKeys,
} from "./lib/cms-export-keys.mjs";
import {
  assertStablePublicationHeadWindow,
  publicationHeadMarker,
  publicationMetadata,
} from "./lib/cms-publication-state.mjs";
import { fetchCmsPublicationHead } from "./lib/cms-publication-head.mjs";
import { collectPostgrestPages } from "./lib/postgrest-pagination.mjs";
import { trustedSupabaseOrigin } from "./lib/trusted-server-url.mjs";
import { applyPublishedWriterBiographyOverrides } from "./lib/writer-biography-public-overrides.mjs";
import { normalizePublicWriterBiographyTranslations } from "./lib/writer-biography-public-profile.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicCmsDirectory = path.join(projectRoot, "public", "cms");
const snapshotPath = path.join(publicCmsDirectory, "published-content.json");
const publishedArticlesPath = path.join(
  publicCmsDirectory,
  "published-articles.json"
);
const editorialCatalogPath = path.join(
  projectRoot,
  "apps",
  "admin",
  "catalog-assets",
  "editorial-catalog.json"
);
const countryProfilesModule = path.join(
  projectRoot,
  "src",
  "data",
  "cms",
  "countryProfiles.generated.ts"
);
const writerProfilesModule = path.join(
  projectRoot,
  "src",
  "data",
  "cms",
  "writerProfiles.generated.ts"
);
const literaryWorksModule = path.join(
  projectRoot,
  "src",
  "data",
  "cms",
  "literaryWorks.generated.ts"
);

const rawSupabaseUrl = (
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  ""
).replace(/\/+$/, "");
const supabaseUrl = rawSupabaseUrl ? trustedSupabaseOrigin(rawSupabaseUrl) : "";
const { apiKey, publicKey } = resolveCmsExportKeys(process.env);
const serviceRoleKey = String(
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
).trim();

if (!supabaseUrl || !apiKey) {
  console.log(
    "Premium translation export skipped: public Supabase variables are not configured. Existing CMS snapshot is preserved."
  );
  process.exit(0);
}
const publicSnapshotKey = requirePublicCmsExportKey(publicKey);

const countryTranslationStatuses = new Set(["reviewed", "verified"]);
const countryTranslationMethods = new Set([
  "editorial-original",
  "human-translation",
  "machine-translation",
]);
const workTranslationStatuses = new Set(["reviewed", "verified"]);
const workTranslationMethods = new Set([
  "editorial-original",
  "human-translation",
  "machine-translation",
  "licensed-source",
]);
const workSourceUsages = new Set([
  "structured-data",
  "reference-only",
  "licensed-copy",
]);
const workSourceFields = new Set([
  "identity",
  "authorship",
  "title",
  "original-title",
  "publication-year",
  "language",
  "genre",
  "description",
  "award-criterion",
  "bestseller-evidence",
  "market",
  "period",
  "measurement",
]);
const cyrillicPattern = /\p{Script=Cyrillic}/u;
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/u;
const sha256Pattern = /^[a-f0-9]{64}$/u;
const workLocales = new Set(["ru", "en"]);
const workAuthorityTiers = new Set(["A", "B"]);
const workTitleEvidenceRecordKinds = new Set([
  "national-bibliography",
  "legal-deposit-catalog",
  "publisher-catalog",
  "rights-holder-catalog",
  "author-estate",
  "critical-edition",
]);
const workSourceRecordKinds = new Set([
  ...workTitleEvidenceRecordKinds,
  "authoritative-work-page",
  "article-source",
  "structured-dataset",
]);
const workTitleSelectionRules = new Set([
  "authoritative-uniform-title",
  "earliest-authorized-edition",
  "current-complete-authorized-edition",
  "original-market-title",
]);
const workDescriptionOrigins = new Set([
  "article-adapted",
  "official-source-synthesis",
  "human-translation",
]);
const workDescriptionTransformations = new Set([
  "condensed",
  "deduplicated",
  "spoiler-limited",
  "style-edited",
]);
const workDescriptionTextOrigins = new Set([
  "project-owned-article",
  "project-original",
]);
const workCanonStatuses = new Set([
  "canonical-classic",
  "modern-landmark",
]);
const workCanonEvidenceClasses = new Set([
  "official-curriculum",
  "national-library-heritage-collection",
  "academy-or-literary-institute",
  "scholarly-critical-project",
  "international-heritage-register",
  "work-specific-landmark-award",
]);

function queryString(values) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  });
  return params.toString();
}

const rowIdentity = {
  country_profile_overrides: (row) => row.country_id,
  writer_profile_overrides: (row) => `${row.country_id}:${row.writer_id}`,
  literary_works: (row) => row.id,
  literary_work_translations: (row) => `${row.work_id}:${row.locale}`,
  literary_work_sources: (row) =>
    `${row.work_id}:${row.provider}:${row.source_url}`,
};

async function fetchTableRows(table, query, accessKey, optional = false) {
  return collectPostgrestPages({
    table,
    identity: rowIdentity[table] || ((row) => row.id),
    fetchPage: async ({ from, to, pageIndex }) => {
      const response = await fetch(
        `${supabaseUrl}/rest/v1/${table}?${queryString(query)}`,
        {
          headers: {
            apikey: accessKey,
            Authorization: `Bearer ${accessKey}`,
            Prefer: "count=exact",
            Range: `${from}-${to}`,
          },
        }
      );
      if (response.ok) {
        return {
          rows: await response.json(),
          contentRange: response.headers.get("content-range"),
        };
      }

      const body = await response.text();
      if (
        optional &&
        pageIndex === 0 &&
        response.status === 404 &&
        body.includes("PGRST205")
      ) {
        console.warn(
          `Optional premium translation table ${table} is not provisioned yet; preserving the ordinary public snapshot.`
        );
        return { rows: [], contentRange: "*/0" };
      }
      throw new Error(
        `Premium translation export failed for ${table}: ${response.status} ${body}`
      );
    },
  });
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function stringValue(value, maximum = 10_000) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maximum);
}

function optionalString(value, maximum = 10_000) {
  const normalized = stringValue(value, maximum);
  return normalized || undefined;
}

function safeStringList(value, allowed, maximumItems = 100) {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((item) => {
      const normalized = stringValue(item, 500);
      if (!normalized || (allowed && !allowed.has(normalized))) return [];
      return [normalized];
    })
    .slice(0, maximumItems);
}

function enumStringValue(value, allowed) {
  const normalized = stringValue(value, 120);
  return allowed.has(normalized) ? normalized : "";
}

function httpsUrlValue(value, maximum = 2_000) {
  const normalized = stringValue(value, maximum);
  if (!normalized) return "";
  try {
    return new URL(normalized).protocol === "https:" ? normalized : "";
  } catch {
    return "";
  }
}

function isoDateValue(value) {
  const normalized = stringValue(value, 40);
  if (!isoDatePattern.test(normalized)) return "";
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) &&
    parsed.toISOString().slice(0, 10) === normalized
    ? normalized
    : "";
}

function sha256Value(value) {
  const normalized = stringValue(value, 64);
  return sha256Pattern.test(normalized) ? normalized : "";
}

function safeHttpsUrlList(value, maximumItems = 100) {
  if (!Array.isArray(value) || value.length > maximumItems) return null;
  const urls = value.map((item) => httpsUrlValue(item));
  return urls.some((url) => !url) ? null : urls;
}

function safeEnumList(value, allowed, maximumItems = 100) {
  if (!Array.isArray(value) || value.length > maximumItems) return null;
  const items = value.map((item) => enumStringValue(item, allowed));
  return items.some((item) => !item) ? null : items;
}

function normalizeWorkTitleEvidenceRecord(value) {
  const row = objectValue(value);
  const entityKind = row.entityKind === "manifestation" ? row.entityKind : "";
  const manifestationId = stringValue(row.manifestationId, 300);
  const sourceUrl = httpsUrlValue(row.sourceUrl);
  const provider = stringValue(row.provider, 240);
  const authorityId = stringValue(row.authorityId, 160);
  const authorityTier = enumStringValue(row.authorityTier, workAuthorityTiers);
  const recordKind = enumStringValue(
    row.recordKind,
    workTitleEvidenceRecordKinds
  );
  const recordId = stringValue(row.recordId, 300);
  const catalogTitleExact = stringValue(row.catalogTitleExact, 300);
  const locale = enumStringValue(row.locale, workLocales);
  const market = stringValue(row.market, 80);
  const expressionLanguage = stringValue(row.expressionLanguage, 120);
  const retrievedAt = isoDateValue(row.retrievedAt);
  const checkedAt = isoDateValue(row.checkedAt);
  const checkedBy = stringValue(row.checkedBy, 240);
  let publicationYear;
  if (row.publicationYear !== undefined && row.publicationYear !== null) {
    if (
      !Number.isInteger(row.publicationYear) ||
      row.publicationYear < 1000 ||
      row.publicationYear > new Date().getUTCFullYear() + 1
    ) {
      return null;
    }
    publicationYear = row.publicationYear;
  }
  if (
    !entityKind ||
    !manifestationId ||
    !sourceUrl ||
    !provider ||
    !authorityId ||
    !authorityTier ||
    !recordKind ||
    !recordId ||
    !catalogTitleExact ||
    !locale ||
    !market ||
    !expressionLanguage ||
    !retrievedAt ||
    !checkedAt ||
    !checkedBy
  ) {
    return null;
  }
  return {
    entityKind,
    manifestationId,
    sourceUrl,
    provider,
    authorityId,
    authorityTier,
    recordKind,
    recordId,
    catalogTitleExact,
    locale,
    market,
    expressionLanguage,
    ...(optionalString(row.isbn10, 32)
      ? { isbn10: optionalString(row.isbn10, 32) }
      : {}),
    ...(optionalString(row.isbn13, 32)
      ? { isbn13: optionalString(row.isbn13, 32) }
      : {}),
    ...(optionalString(row.publisher, 240)
      ? { publisher: optionalString(row.publisher, 240) }
      : {}),
    ...(publicationYear !== undefined ? { publicationYear } : {}),
    ...(optionalString(row.translator, 240)
      ? { translator: optionalString(row.translator, 240) }
      : {}),
    ...(optionalString(row.editionStatement, 500)
      ? { editionStatement: optionalString(row.editionStatement, 500) }
      : {}),
    retrievedAt,
    checkedAt,
    checkedBy,
  };
}

function normalizeWorkLocalizedTitle(value, expectedLocale) {
  const row = objectValue(value);
  const entityKind = row.entityKind === "expression" ? row.entityKind : "";
  const expressionId = stringValue(row.expressionId, 300);
  const locale = enumStringValue(row.locale, workLocales);
  const title = stringValue(row.value, 300);
  const expressionLanguage = stringValue(row.expressionLanguage, 120);
  const market = stringValue(row.market, 80);
  const selectionRule = enumStringValue(
    row.selectionRule,
    workTitleSelectionRules
  );
  const evidenceInput = Array.isArray(row.evidence) ? row.evidence : [];
  const evidence = evidenceInput
    .slice(0, 20)
    .map(normalizeWorkTitleEvidenceRecord);
  if (
    !entityKind ||
    !expressionId ||
    locale !== expectedLocale ||
    !title ||
    row.status !== "verified-published" ||
    !expressionLanguage ||
    !market ||
    !selectionRule ||
    evidenceInput.length === 0 ||
    evidenceInput.length > 20 ||
    evidence.some((item) => !item) ||
    evidence.some(
      (item) =>
        item.locale !== locale ||
        item.market !== market ||
        item.expressionLanguage !== expressionLanguage
    )
  ) {
    return null;
  }
  return {
    entityKind,
    expressionId,
    locale,
    value: title,
    status: "verified-published",
    expressionLanguage,
    market,
    selectionRule,
    ...(optionalString(row.selectionNote, 1_000)
      ? { selectionNote: optionalString(row.selectionNote, 1_000) }
      : {}),
    evidence,
  };
}

function normalizeWorkLocalizedTitles(value) {
  const row = objectValue(value);
  const ru = normalizeWorkLocalizedTitle(row.ru, "ru");
  const en = normalizeWorkLocalizedTitle(row.en, "en");
  if (!ru && !en) return undefined;
  return {
    ...(ru ? { ru } : {}),
    ...(en ? { en } : {}),
  };
}

function normalizeWorkDescriptionProvenance(value) {
  const row = objectValue(value);
  const origin = enumStringValue(row.origin, workDescriptionOrigins);
  const sourceLanguage = stringValue(row.sourceLanguage, 120);
  const sourceCountry = stringValue(row.sourceCountry, 120);
  const sourceUrls = safeHttpsUrlList(row.sourceUrls, 100);
  const transformations =
    row.transformations === undefined
      ? undefined
      : safeEnumList(
          row.transformations,
          workDescriptionTransformations,
          20
        );
  const rights = objectValue(row.rights);
  const textOrigin = enumStringValue(
    rights.textOrigin,
    workDescriptionTextOrigins
  );
  const author = stringValue(row.author, 240);
  const createdAt = isoDateValue(row.createdAt);
  const reviewedBy = stringValue(row.reviewedBy, 240);
  const reviewedAt = isoDateValue(row.reviewedAt);
  if (
    !origin ||
    !sourceLanguage ||
    !sourceCountry ||
    !sourceUrls ||
    !sourceUrls.length ||
    transformations === null ||
    !textOrigin ||
    rights.copiedSourceText !== false ||
    !author ||
    !createdAt ||
    !reviewedBy ||
    !reviewedAt
  ) {
    return null;
  }

  let sourceArticle;
  if (row.sourceArticle !== undefined && row.sourceArticle !== null) {
    const article = objectValue(row.sourceArticle);
    sourceArticle = {
      articleId: stringValue(article.articleId, 300),
      url: httpsUrlValue(article.url),
      revisionId: stringValue(article.revisionId, 300),
      sourceHash: sha256Value(article.sourceHash),
      excerptHash: sha256Value(article.excerptHash),
    };
    if (Object.values(sourceArticle).some((item) => !item)) return null;
  }

  let translatedFromLocale;
  if (row.translatedFromLocale !== undefined) {
    translatedFromLocale = enumStringValue(
      row.translatedFromLocale,
      workLocales
    );
    if (!translatedFromLocale) return null;
  }
  let translatedFromSourceHash;
  if (row.translatedFromSourceHash !== undefined) {
    translatedFromSourceHash = sha256Value(row.translatedFromSourceHash);
    if (!translatedFromSourceHash) return null;
  }
  if (origin === "article-adapted" && !sourceArticle) return null;
  if (
    origin === "human-translation" &&
    (!translatedFromLocale || !translatedFromSourceHash)
  ) {
    return null;
  }

  return {
    origin,
    sourceLanguage,
    sourceCountry,
    sourceUrls,
    ...(sourceArticle ? { sourceArticle } : {}),
    ...(transformations !== undefined ? { transformations } : {}),
    ...(translatedFromLocale ? { translatedFromLocale } : {}),
    ...(translatedFromSourceHash ? { translatedFromSourceHash } : {}),
    rights: {
      textOrigin,
      copiedSourceText: false,
    },
    author,
    createdAt,
    reviewedBy,
    reviewedAt,
  };
}

function normalizeWorkCanonEvidence(value) {
  const row = objectValue(value);
  const registrySourceId = stringValue(row.registrySourceId, 300);
  const registryItemOrdinal = row.registryItemOrdinal;
  const evidenceClass = enumStringValue(row.class, workCanonEvidenceClasses);
  const sourceUrl = httpsUrlValue(row.sourceUrl);
  const provider = stringValue(row.provider, 240);
  const authorityId = stringValue(row.authorityId, 160);
  const authorityTier = enumStringValue(row.authorityTier, workAuthorityTiers);
  const itemId = stringValue(row.itemId, 300);
  const assertion = stringValue(row.assertion, 2_000);
  const snapshotAt = isoDateValue(row.snapshotAt);
  if (
    !registrySourceId ||
    !Number.isInteger(registryItemOrdinal) ||
    registryItemOrdinal < 1 ||
    !evidenceClass ||
    !sourceUrl ||
    !provider ||
    !authorityId ||
    !authorityTier ||
    !itemId ||
    !assertion ||
    !snapshotAt
  ) {
    return null;
  }
  return {
    registrySourceId,
    registryItemOrdinal,
    class: evidenceClass,
    sourceUrl,
    provider,
    authorityId,
    authorityTier,
    itemId,
    assertion,
    snapshotAt,
  };
}

function normalizeWorkCanon(value) {
  const row = objectValue(value);
  const status = enumStringValue(row.status, workCanonStatuses);
  const registryVersion = stringValue(row.registryVersion, 160);
  const reviewedAt = isoDateValue(row.reviewedAt);
  const reviewedBy = stringValue(row.reviewedBy, 240);
  const evidenceInput = Array.isArray(row.evidence) ? row.evidence : [];
  const evidence = evidenceInput.slice(0, 50).map(normalizeWorkCanonEvidence);
  if (
    !status ||
    !registryVersion ||
    !reviewedAt ||
    !reviewedBy ||
    evidenceInput.length === 0 ||
    evidenceInput.length > 50 ||
    evidence.some((item) => !item)
  ) {
    return undefined;
  }
  return { status, registryVersion, evidence, reviewedAt, reviewedBy };
}

function normalizeWorkEvidenceMetadata(value) {
  const metadata = objectValue(value);
  const canon = normalizeWorkCanon(metadata.canon);
  const localizedTitles = normalizeWorkLocalizedTitles(
    metadata.localizedTitles
  );
  return {
    ...(canon ? { canon } : {}),
    ...(localizedTitles ? { localizedTitles } : {}),
  };
}

function normalizeWorkSourceEvidenceMetadata(value) {
  const metadata = objectValue(value);
  const authorityId = optionalString(metadata.authorityId, 160);
  const authorityTier = enumStringValue(
    metadata.authorityTier,
    workAuthorityTiers
  );
  const country = optionalString(metadata.country, 120);
  const market = optionalString(metadata.market, 80);
  const language = optionalString(metadata.language, 120);
  const recordKind = enumStringValue(
    metadata.recordKind,
    workSourceRecordKinds
  );
  const recordId = optionalString(metadata.recordId, 300);
  return {
    ...(authorityId ? { authorityId } : {}),
    ...(authorityTier ? { authorityTier } : {}),
    ...(country ? { country } : {}),
    ...(market ? { market } : {}),
    ...(language ? { language } : {}),
    ...(recordKind ? { recordKind } : {}),
    ...(recordId ? { recordId } : {}),
  };
}

function safeTimeline(value) {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((item) => {
      if (typeof item === "string") {
        const description = stringValue(item, 2_000);
        return description ? [description] : [];
      }
      const row = objectValue(item);
      const year =
        typeof row.year === "number"
          ? String(row.year)
          : stringValue(row.year, 80);
      const title = stringValue(row.title, 500);
      const description = stringValue(row.description, 2_000);
      if (!year && !title && !description) return [];
      return [{ year, title, description }];
    })
    .slice(0, 100);
}

function normalizeCountryTranslation(value) {
  const row = objectValue(value);
  if (
    row.locale !== "en" ||
    !countryTranslationStatuses.has(String(row.status)) ||
    !countryTranslationMethods.has(String(row.method)) ||
    !stringValue(row.sourceHash, 128)
  ) {
    return null;
  }

  const sourceFields = objectValue(row.fields);
  const fields = {
    name: optionalString(sourceFields.name, 160),
    region: optionalString(sourceFields.region, 160),
    continent: optionalString(sourceFields.continent, 160),
    officialLanguage: optionalString(sourceFields.officialLanguage, 300),
    capital: optionalString(sourceFields.capital, 200),
    description: optionalString(sourceFields.description, 4_000),
    history: optionalString(sourceFields.history, 8_000),
    historicalNote: optionalString(sourceFields.historicalNote, 4_000),
    literaryPeriods: safeStringList(sourceFields.literaryPeriods, null, 40),
    literaryMovements: safeStringList(
      sourceFields.literaryMovements,
      null,
      40
    ),
    periods: safeStringList(sourceFields.periods, null, 40),
    facts: safeStringList(sourceFields.facts, null, 80),
    literaryPlaces: safeStringList(sourceFields.literaryPlaces, null, 80),
    timeline: safeTimeline(sourceFields.timeline),
    chronology: safeTimeline(sourceFields.chronology),
  };
  const compactFields = Object.fromEntries(
    Object.entries(fields).filter(([, field]) =>
      Array.isArray(field) ? field.length > 0 : Boolean(field)
    )
  );
  if (!Object.keys(compactFields).length) return null;
  if (cyrillicPattern.test(JSON.stringify(compactFields))) return null;

  return {
    locale: "en",
    status: String(row.status),
    method: String(row.method),
    sourceHash: stringValue(row.sourceHash, 128),
    generatedAt: optionalString(row.generatedAt, 80),
    model: optionalString(row.model, 120),
    reviewerModel:
      row.reviewerModel === null
        ? null
        : optionalString(row.reviewerModel, 120),
    fields: compactFields,
  };
}

function normalizeWorkTranslation(row) {
  const locale = row.locale === "ru" || row.locale === "en" ? row.locale : null;
  const title = stringValue(row.title, 300);
  const description = stringValue(row.description, 900);
  const sourceLanguage = stringValue(row.source_language, 80);
  const status = String(row.editorial_status || "");
  const method = String(row.translation_method || "");
  const sourceUrls = safeStringList(row.source_urls, null, 100).filter((url) =>
    /^https:\/\//iu.test(url)
  );
  if (
    !locale ||
    !title ||
    description.length < 140 ||
    !sourceLanguage ||
    !workTranslationStatuses.has(status) ||
    !workTranslationMethods.has(method) ||
    !sourceUrls.length ||
    !stringValue(row.reviewed_at, 40) ||
    (locale === "en" && cyrillicPattern.test(`${title} ${description}`))
  ) {
    return null;
  }
  const metadata = objectValue(row.metadata);
  const titleEvidence = normalizeWorkLocalizedTitle(
    metadata.titleEvidence,
    locale
  );
  const descriptionProvenance = normalizeWorkDescriptionProvenance(
    metadata.descriptionProvenance
  );
  return {
    locale,
    title,
    description,
    sourceLanguage,
    status,
    sourceUrls,
    method,
    reviewedAt: stringValue(row.reviewed_at, 40),
    ...(titleEvidence ? { titleEvidence } : {}),
    ...(descriptionProvenance ? { descriptionProvenance } : {}),
  };
}

function normalizeWorkSource(row) {
  const provider = stringValue(row.provider, 240);
  const url = stringValue(row.source_url, 1_000);
  const fields = safeStringList(row.field_names, workSourceFields, 30);
  const usage = stringValue(row.usage, 80);
  const retrievedAt = stringValue(row.retrieved_at, 40);
  if (
    !provider ||
    !/^https:\/\//iu.test(url) ||
    !fields.length ||
    !workSourceUsages.has(usage) ||
    !retrievedAt
  ) {
    return null;
  }
  const evidence = normalizeWorkSourceEvidenceMetadata(row.metadata);
  return {
    provider,
    url,
    fields,
    license: optionalString(row.license_name, 300),
    usage,
    retrievedAt,
    ...evidence,
  };
}

function asGeneratedModule(variableName, value, comment) {
  return `// Generated by scripts/export-premium-translations.mjs. Do not edit by hand.\n// ${comment}\nexport const ${variableName} = ${JSON.stringify(value, null, 2)} as const;\n`;
}

function publicationHeadFromSnapshot(snapshot) {
  return {
    source: snapshot.publication?.headSource ?? "outbox",
    outboxHighWater: snapshot.publication?.outboxHighWater ?? 0,
    legacyAuditHighWater:
      snapshot.publication?.legacyAuditHighWater ?? 0,
  };
}

function failStaleExport(error) {
  if (error?.code !== "CMS_SNAPSHOT_CHANGED") throw error;
  console.error(error.message);
  process.exit(75);
}

const snapshot = JSON.parse(await fs.readFile(snapshotPath, "utf8"));
const editorialCatalog = JSON.parse(
  await fs.readFile(editorialCatalogPath, "utf8")
);
const editorialWriterFields = new Map(
  (editorialCatalog.countries || []).flatMap((country) =>
    (country.writers || []).map((writer) => [
      `${country.id}:${writer.id}`,
      objectValue(writer.fields),
    ])
  )
);

function normalizeBiographyTranslations(value, context) {
  const catalogFields = editorialWriterFields.get(context.key);
  if (!catalogFields) {
    return normalizePublicWriterBiographyTranslations(value);
  }
  const effectiveFields = {
    ...catalogFields,
    ...objectValue(context.row?.fields),
  };
  const writerName =
    stringValue(effectiveFields.fullName, 300) ||
    stringValue(effectiveFields.name, 300) ||
    stringValue(context.row?.writer_id, 200);
  return normalizePublicWriterBiographyTranslations(value, { writerName });
}
const originalHead = publicationHeadFromSnapshot(snapshot);
let stableHead = originalHead;
if (serviceRoleKey) {
  try {
    stableHead = assertStablePublicationHeadWindow(
      originalHead,
      await fetchCmsPublicationHead({
        supabaseUrl,
        serviceKey: serviceRoleKey,
      })
    );
  } catch (error) {
    failStaleExport(error);
  }
}

const [
  countryOverrides,
  writerOverrides,
  literaryWorks,
  workTranslations,
  workSources,
] = await Promise.all([
  fetchTableRows(
    "country_profile_overrides",
    {
      select: "country_id,fields,updated_at",
      is_enabled: "eq.true",
      order: "country_id.asc",
    },
    apiKey,
    true
  ),
  fetchTableRows(
    "writer_profile_overrides",
    {
      select: "country_id,writer_id,fields,updated_at",
      is_enabled: "eq.true",
      order: "country_id.asc,writer_id.asc",
    },
    apiKey,
    true
  ),
  fetchTableRows(
    "literary_works",
    {
      select: "id,legacy_id,metadata",
      editorial_status: "in.(reviewed,verified)",
      order: "legacy_id.asc,id.asc",
    },
    publicSnapshotKey,
    true
  ),
  fetchTableRows(
    "literary_work_translations",
    {
      select:
        "work_id,locale,title,description,source_language,translation_method,editorial_status,source_urls,reviewed_at,metadata",
      editorial_status: "in.(reviewed,verified)",
      order: "work_id.asc,locale.asc",
    },
    publicSnapshotKey,
    true
  ),
  fetchTableRows(
    "literary_work_sources",
    {
      select:
        "work_id,provider,source_url,field_names,license_name,usage,retrieved_at,metadata",
      order: "work_id.asc,provider.asc,source_url.asc",
    },
    publicSnapshotKey,
    true
  ),
]);

if (serviceRoleKey) {
  try {
    stableHead = assertStablePublicationHeadWindow(
      stableHead,
      await fetchCmsPublicationHead({
        supabaseUrl,
        serviceKey: serviceRoleKey,
      })
    );
  } catch (error) {
    failStaleExport(error);
  }
}

const countryProfileOverrides = {
  ...objectValue(snapshot.countryProfileOverrides),
};
for (const row of countryOverrides) {
  const fields = objectValue(row.fields);
  const translations = objectValue(fields.translations);
  const english = normalizeCountryTranslation(translations.en);
  if (!english) continue;
  const existing = objectValue(countryProfileOverrides[row.country_id]);
  countryProfileOverrides[row.country_id] = {
    ...existing,
    translations: {
      ...objectValue(existing.translations),
      en: english,
    },
  };
}

const writerProfileOverrides = applyPublishedWriterBiographyOverrides({
  snapshotOverrides: snapshot.writerProfileOverrides,
  rows: writerOverrides,
  normalizeBiographyTranslations,
});

const workTranslationsById = new Map();
for (const row of workTranslations) {
  const normalized = normalizeWorkTranslation(row);
  if (!normalized) continue;
  const current = workTranslationsById.get(row.work_id) || {};
  current[normalized.locale] = normalized;
  workTranslationsById.set(row.work_id, current);
}
const workSourcesById = new Map();
for (const row of workSources) {
  const normalized = normalizeWorkSource(row);
  if (!normalized) continue;
  const current = workSourcesById.get(row.work_id) || [];
  current.push(normalized);
  workSourcesById.set(row.work_id, current);
}

const literaryWorksByLegacyId = {
  ...objectValue(snapshot.literaryWorksByLegacyId),
};
for (const work of literaryWorks) {
  const legacyId = stringValue(work.legacy_id, 600);
  const existing = objectValue(literaryWorksByLegacyId[legacyId]);
  if (!legacyId || !Object.keys(existing).length) continue;
  const translations = objectValue(workTranslationsById.get(work.id));
  const sources = workSourcesById.get(work.id) || [];
  const evidence = normalizeWorkEvidenceMetadata(work.metadata);
  const {
    canon: _staleCanon,
    localizedTitles: _staleLocalizedTitles,
    ...baseWork
  } = existing;
  literaryWorksByLegacyId[legacyId] = {
    ...baseWork,
    ...evidence,
    ...(Object.keys(translations).length ? { translations } : {}),
    ...(sources.length ? { sources } : {}),
  };
}

const enrichedSnapshot = {
  ...snapshot,
  countryProfileOverrides,
  writerProfileOverrides,
  literaryWorksByLegacyId,
};
enrichedSnapshot.publication = publicationMetadata(
  enrichedSnapshot,
  stableHead
);

const publishedArticles = JSON.parse(
  await fs.readFile(publishedArticlesPath, "utf8")
);
publishedArticles.publication = enrichedSnapshot.publication;

await commitAtomicFileSet({
  root: projectRoot,
  writes: [
    {
      path: countryProfilesModule,
      content: asGeneratedModule(
        "cmsCountryProfileOverrides",
        countryProfileOverrides,
        "Durable country-profile overrides plus reviewed English localizations."
      ),
    },
    {
      path: writerProfilesModule,
      content: asGeneratedModule(
        "cmsWriterProfileOverrides",
        writerProfileOverrides,
        "Durable writer-profile overrides plus provenance-safe biographies."
      ),
    },
    {
      path: literaryWorksModule,
      content: asGeneratedModule(
        "cmsLiteraryWorksByLegacyId",
        literaryWorksByLegacyId,
        "Published literary works with reviewed Russian and English text plus provenance."
      ),
    },
    {
      path: snapshotPath,
      content: `${JSON.stringify(enrichedSnapshot, null, 2)}\n`,
    },
    {
      path: publishedArticlesPath,
      content: `${JSON.stringify(publishedArticles, null, 2)}\n`,
    },
  ],
});

if (process.env.GITHUB_OUTPUT) {
  await fs.appendFile(
    process.env.GITHUB_OUTPUT,
    [
      `article_count=${enrichedSnapshot.publication.articleCount}`,
      `publication_head_source=${enrichedSnapshot.publication.headSource}`,
      `outbox_high_water=${enrichedSnapshot.publication.outboxHighWater}`,
      `legacy_audit_high_water=${enrichedSnapshot.publication.legacyAuditHighWater}`,
      `publication_queue_marker=${publicationHeadMarker(stableHead)}`,
      `content_sha256=${enrichedSnapshot.publication.contentSha256}`,
      "",
    ].join("\n"),
    "utf8"
  );
}

console.log(
  `Published premium English snapshot ${enrichedSnapshot.publication.contentSha256.slice(0, 12)} at ${publicationHeadMarker(stableHead) || `${stableHead.source}:0`}: ${Object.values(countryProfileOverrides).filter((value) => objectValue(value).translations).length} localized countries, ${Object.values(writerProfileOverrides).filter((value) => objectValue(value).biographyTranslations).length} localized writer profiles and ${Object.values(literaryWorksByLegacyId).filter((value) => objectValue(value).translations).length} bilingual literary works.`
);
