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

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicCmsDirectory = path.join(projectRoot, "public", "cms");
const snapshotPath = path.join(publicCmsDirectory, "published-content.json");
const publishedArticlesPath = path.join(
  publicCmsDirectory,
  "published-articles.json"
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

const supabaseUrl = (
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  ""
).replace(/\/+$/, "");
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
const biographyStatuses = new Set(["reviewed", "verified"]);
const biographyMethods = new Set([
  "editorial-original",
  "human-translation",
  "machine-translation",
  "licensed-source",
]);
const biographyRights = new Set([
  "project-original",
  "public-domain",
  "licensed",
  "permission",
]);
const biographySourceUsages = new Set([
  "structured-data",
  "fact-check",
  "licensed-copy",
]);
const biographySourceFields = new Set([
  "identity",
  "life-dates",
  "biography-facts",
  "awards",
  "works",
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

function normalizeBiographySource(value) {
  const row = objectValue(value);
  const provider = stringValue(row.provider, 240);
  const url = stringValue(row.url, 1_000);
  const fields = safeStringList(row.fields, biographySourceFields, 20);
  const usage = stringValue(row.usage, 80);
  const retrievedAt = stringValue(row.retrievedAt, 40);
  if (
    !provider ||
    !/^https:\/\//iu.test(url) ||
    !fields.length ||
    !biographySourceUsages.has(usage) ||
    !retrievedAt
  ) {
    return null;
  }
  return {
    provider,
    url,
    fields,
    usage,
    retrievedAt,
    author: optionalString(row.author, 300),
    title: optionalString(row.title, 500),
    licenseName: optionalString(row.licenseName, 300),
    licenseUrl: /^https:\/\//iu.test(stringValue(row.licenseUrl, 1_000))
      ? stringValue(row.licenseUrl, 1_000)
      : undefined,
  };
}

function normalizeBiographyProfile(value, locale) {
  const row = objectValue(value);
  const text = stringValue(row.text, 1_600);
  const sourceLanguage = stringValue(row.sourceLanguage, 80);
  const status = String(row.status || "");
  const method = String(row.method || "");
  const sources = Array.isArray(row.sources)
    ? row.sources.flatMap((source) => {
        const normalized = normalizeBiographySource(source);
        return normalized ? [normalized] : [];
      })
    : [];
  if (
    row.locale !== locale ||
    !text ||
    !sourceLanguage ||
    !biographyStatuses.has(status) ||
    !biographyMethods.has(method) ||
    !sources.length ||
    (locale === "en" && cyrillicPattern.test(text))
  ) {
    return null;
  }

  const translatedFromLocale =
    row.translatedFromLocale === "ru" || row.translatedFromLocale === "en"
      ? row.translatedFromLocale
      : undefined;
  const sourceTextRights = biographyRights.has(String(row.sourceTextRights))
    ? String(row.sourceTextRights)
    : undefined;
  const sourceMeta = objectValue(row.translationMeta);
  const translationMeta = Object.fromEntries(
    Object.entries({
      model: optionalString(sourceMeta.model, 120),
      reviewerModel: optionalString(sourceMeta.reviewerModel, 120),
      sourceHash: optionalString(sourceMeta.sourceHash, 128),
      generatedAt: optionalString(sourceMeta.generatedAt, 80),
    }).filter(([, item]) => item !== undefined)
  );

  return {
    locale,
    text,
    sourceLanguage,
    status,
    method,
    reviewedAt: optionalString(row.reviewedAt, 40),
    reviewer: optionalString(row.reviewer, 300),
    translatedFromLocale,
    sourceTextRights,
    sources,
    ...(Object.keys(translationMeta).length ? { translationMeta } : {}),
  };
}

function normalizeBiographyTranslations(value) {
  const row = objectValue(value);
  const ru = normalizeBiographyProfile(row.ru, "ru");
  const en = normalizeBiographyProfile(row.en, "en");
  return {
    ...(ru ? { ru } : {}),
    ...(en ? { en } : {}),
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
  return {
    locale,
    title,
    description,
    sourceLanguage,
    status,
    sourceUrls,
    method,
    reviewedAt: stringValue(row.reviewed_at, 40),
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
  return {
    provider,
    url,
    fields,
    license: optionalString(row.license_name, 300),
    usage,
    retrievedAt,
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
      select: "id,legacy_id",
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
        "work_id,locale,title,description,source_language,translation_method,editorial_status,source_urls,reviewed_at",
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
        "work_id,provider,source_url,field_names,license_name,usage,retrieved_at",
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

const writerProfileOverrides = {
  ...objectValue(snapshot.writerProfileOverrides),
};
for (const row of writerOverrides) {
  const fields = objectValue(row.fields);
  const biographyTranslations = normalizeBiographyTranslations(
    fields.biographyTranslations
  );
  if (!Object.keys(biographyTranslations).length) continue;
  const key = `${row.country_id}:${row.writer_id}`;
  const existing = objectValue(writerProfileOverrides[key]);
  writerProfileOverrides[key] = {
    ...existing,
    biographyTranslations,
  };
}

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
  literaryWorksByLegacyId[legacyId] = {
    ...existing,
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
