import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "cheerio";
import { applyEditorialPublicationFix } from "./editorial-publication-fixes.mjs";
import {
  articleSectionSlug,
  normalizeArticlePublicMetadata,
  normalizeConfirmedArticleHeading,
} from "./lib/article-route-policy.mjs";
import {
  requirePublicCmsExportKey,
  resolveCmsExportKeys,
} from "./lib/cms-export-keys.mjs";
import { staleManagedCmsArticleSnapshotNames } from "./lib/cms-article-snapshot-files.mjs";
import { collectPostgrestPages } from "./lib/postgrest-pagination.mjs";
import { dzenCoverForArticle } from "./lib/article-publication-images.mjs";
import { extractSiteCopyFromHomepageBlocks } from "./site-copy-overrides.mjs";
import { commitAtomicFileSet } from "./lib/atomic-file-set.mjs";
import { normalizeShortHyphensDeep } from "./lib/short-hyphens.mjs";
import {
  assertPublishedFontBytes,
  normalizePublishedTypography,
  publicFontMetadata,
} from "./lib/site-typography-publication.mjs";
import {
  articleIdSet,
  assertCandidateCanReplaceBaseline,
  assertStablePublicationHeadWindow,
  cmsSourceArticleId,
  publicationHeadMarker,
  publicationMetadata,
} from "./lib/cms-publication-state.mjs";
import { fetchCmsPublicationHead } from "./lib/cms-publication-head.mjs";
import {
  buildLegacyArticleWithdrawals,
  partitionRedirectsByWithdrawnDestination,
} from "./lib/cms-legacy-withdrawals.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicCmsDirectory = path.join(projectRoot, "public", "cms");
const publicCmsArticlesDirectory = path.join(publicCmsDirectory, "articles");
const publicCmsFontsDirectory = path.join(publicCmsDirectory, "fonts");
const articleCatalogModule = path.join(
  projectRoot,
  "src",
  "data",
  "articles",
  "cms.generated.ts"
);
const articleWithdrawalsModule = path.join(
  projectRoot,
  "src",
  "data",
  "articles",
  "cms-withdrawals.generated.ts"
);
const siteContentModule = path.join(
  projectRoot,
  "src",
  "data",
  "cms",
  "site.generated.ts"
);
const bookEditionsModule = path.join(
  projectRoot,
  "src",
  "data",
  "cms",
  "bookEditions.generated.ts"
);
const writerProfilesModule = path.join(
  projectRoot,
  "src",
  "data",
  "cms",
  "writerProfiles.generated.ts"
);
const countryProfilesModule = path.join(
  projectRoot,
  "src",
  "data",
  "cms",
  "countryProfiles.generated.ts"
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
const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const requireStableSnapshot = process.env.CMS_EXPORT_REQUIRE_STABLE === "true";
const publicationBaselineUrl = String(
  process.env.CMS_PUBLICATION_BASELINE_URL || ""
).trim();
const siteOrigin = (
  process.env.PUBLIC_SITE_URL ||
  process.env.VITE_PUBLIC_SITE_URL ||
  "https://probpera.ru"
).replace(/\/+$/, "");

if (!supabaseUrl || !apiKey) {
  if (requireStableSnapshot) {
    throw new Error(
      "Stable CMS export requires SUPABASE_URL and a configured export key."
    );
  }
  console.log(
    "CMS export skipped: public Supabase variables are not configured. Existing CMS snapshot is preserved."
  );
  process.exit(0);
}
if (requireStableSnapshot && !serviceRoleKey) {
  throw new Error(
    "Stable CMS export requires SUPABASE_SERVICE_ROLE_KEY for the publication outbox and withdrawal guard."
  );
}
const publicSnapshotKey = requirePublicCmsExportKey(publicKey);

const categoryEnglishLabels = {
  "book-opinions": "Book reviews",
  "screen-adaptations": "Books and screen adaptations",
  "writers-world": "Writers of the world",
  "book-guides": "Book guides",
  awards: "Literary awards",
  folklore: "Folklore and mythology",
  language: "Language",
  "literary-essays": "Literature and culture",
  "author-stories": "Literary stories",
  miscellaneous: "Miscellaneous",
};

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
  articles: (row) => row.id,
  article_translations: (row) => `${row.article_id}:${row.locale}`,
  media_assets: (row) => row.id,
  homepage_blocks: (row) => row.id,
  banners: (row) => row.id,
  navigation_menus: (row) => row.id,
  navigation_items: (row) => row.id,
  pages: (row) => row.id,
  redirects: (row) => row.source_path,
  country_profile_overrides: (row) => row.country_id,
  writer_profile_overrides: (row) => `${row.country_id}:${row.writer_id}`,
  literary_works: (row) => row.id,
  book_editions: (row) => row.id,
  font_assets: (row) => row.id,
  site_typography_overrides: (row) =>
    `${row.layer}:${row.target_key}:${row.semantic_scope}:${row.breakpoint}`,
};

async function fetchTableRows(table, query, accessKey, optional) {
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
      if (optional && pageIndex === 0 && response.status === 404 && body.includes("PGRST205")) {
        console.warn(
          `Optional CMS table ${table} is not provisioned yet; preserving an empty public snapshot.`
        );
        return { rows: [], contentRange: "*/0" };
      }
      throw new Error(`CMS export failed for ${table}: ${response.status} ${body}`);
    },
  });
}

async function fetchRows(table, query) {
  return fetchTableRows(table, query, apiKey, false);
}

async function fetchOptionalRows(table, query, accessKey = apiKey) {
  return fetchTableRows(table, query, accessKey, true);
}

async function fetchPublishedTypographyInputs() {
  if (serviceRoleKey) {
    const [overrides, fonts] = await Promise.all([
      fetchOptionalRows("site_typography_overrides", {
        select:
          "layer,target_key,semantic_scope,breakpoint,published_settings,published_at,updated_at",
        published_settings: "not.is.null",
        order: "layer.asc,target_key.asc,semantic_scope.asc,breakpoint.asc",
      }, serviceRoleKey),
      fetchOptionalRows("font_assets", {
        select:
          "id,family_name,source_type,format,font_style,is_variable,weight_min,weight_max,sha256_hex,storage_bucket,object_path,byte_size,deleted_at",
        deleted_at: "is.null",
        order: "id.asc",
      }, serviceRoleKey),
    ]);
    return { overrides, fonts };
  }

  const response = await fetch(
    `${supabaseUrl}/rest/v1/rpc/get_published_site_typography`,
    {
      headers: {
        apikey: publicSnapshotKey,
        Authorization: `Bearer ${publicSnapshotKey}`,
      },
    }
  );
  if (!response.ok) {
    const body = await response.text();
    if (response.status === 404 && /(?:PGRST202|get_published_site_typography)/iu.test(body)) {
      return { overrides: [], fonts: [] };
    }
    throw new Error(
      `CMS typography export failed: ${response.status} ${body}`
    );
  }
  const snapshot = await response.json();
  const fonts = Array.isArray(snapshot?.fonts) ? snapshot.fonts : [];
  if (fonts.length) {
    throw new Error(
      "Published self-hosted fonts require SUPABASE_SERVICE_ROLE_KEY so the exporter can verify and copy private font bytes."
    );
  }
  return {
    overrides: Array.isArray(snapshot?.overrides) ? snapshot.overrides : [],
    fonts: [],
  };
}

async function readJsonIfExists(target) {
  try {
    return JSON.parse(await fs.readFile(target, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function publicationBaseline() {
  if (!publicationBaselineUrl) {
    return readJsonIfExists(path.join(publicCmsDirectory, "published-content.json"));
  }
  const url = new URL(publicationBaselineUrl);
  url.searchParams.set(
    "publication_guard",
    `${process.env.GITHUB_RUN_ID || "local"}-${
      process.env.GITHUB_RUN_ATTEMPT || "1"
    }-${Date.now()}`
  );
  const response = await fetch(url, {
    cache: "no-store",
    headers: { "cache-control": "no-cache" },
  });
  if (!response.ok) {
    throw new Error(
      `Deployed CMS publication baseline failed: ${response.status} ${response.statusText}`
    );
  }
  const value = await response.json();
  if (!value || !Array.isArray(value.articles)) {
    throw new Error("Deployed CMS publication baseline is not a valid snapshot.");
  }
  return value;
}

async function authoritativeArticleStates(sourceIds) {
  const states = new Map(sourceIds.map((id) => [id, null]));
  if (!sourceIds.length) return states;
  if (!serviceRoleKey) {
    return new Map();
  }
  const rows = await fetchTableRows(
    "articles",
    {
      select: "id,status,deleted_at",
      id: `in.(${sourceIds.join(",")})`,
      order: "id.asc",
    },
    serviceRoleKey,
    false
  );
  rows.forEach((row) => states.set(row.id, row));
  return states;
}

function failUnstableExport(error) {
  if (error?.code !== "CMS_SNAPSHOT_CHANGED") throw error;
  console.error(error.message);
  process.exit(75);
}

function relationValue(value) {
  return Array.isArray(value) ? value[0] || null : value || null;
}

function storageUrl(media) {
  if (!media?.bucket || !media?.object_path) return "";
  return `${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(
    media.bucket
  )}/${media.object_path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
}

function privateStorageUrl(bucket, objectPath) {
  return `${supabaseUrl}/storage/v1/object/authenticated/${encodeURIComponent(
    bucket
  )}/${String(objectPath)
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
}

async function downloadPublishedFont(font) {
  if (!serviceRoleKey) {
    throw new Error("Published self-hosted fonts require the service-role export key.");
  }
  const response = await fetch(privateStorageUrl(font.bucket, font.objectPath), {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });
  if (!response.ok) {
    throw new Error(
      `Published font download failed for ${font.id}: ${response.status}.`
    );
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  return assertPublishedFontBytes(font, bytes);
}

function headingSlug(value) {
  return value
    .toLocaleLowerCase("ru")
    .replace(/ё/gu, "е")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 72);
}

function shortStableHash(value = "") {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).slice(0, 6);
}

function publicArticleSlug(article) {
  const sourceSlug = String(article.slug || "").trim();
  if (article.legacy_id) {
    const technicalSuffix = `-${shortStableHash(String(article.legacy_id))}`;
    if (sourceSlug.endsWith(technicalSuffix)) {
      return sourceSlug.slice(0, -technicalSuffix.length);
    }
  }
  return sourceSlug.replace(/-kopiya-[a-z0-9]{5}$/u, "-kopiya");
}

function imageAltLooksTechnical(value = "") {
  const normalized = String(value).replace(/\s+/gu, " ").trim();
  return (
    !normalized ||
    /^[a-f0-9]{8}(?:[\s-][a-f0-9]{4}){3}[\s-][a-f0-9]{12}$/iu.test(
      normalized
    ) ||
    /^(?:img|image|photo|upload)[-_\s]*\d+/iu.test(normalized)
  );
}

function prepareArticleDocument(contentHtml, articleTitle = "", locale = "ru") {
  const $ = load(`<main id="cms-article-root">${contentHtml || ""}</main>`, {
    decodeEntities: false,
  });

  $("#cms-article-root h2, #cms-article-root h3, #cms-article-root h4").each(
    (_index, element) => {
      const heading = $(element);
      const sourceText = heading.text().replace(/\s+/gu, " ").trim();
      const text = normalizeConfirmedArticleHeading(sourceText);
      if (text !== sourceText) heading.text(text);
    }
  );

  $("#cms-article-root h2, #cms-article-root h3, #cms-article-root h4, #cms-article-root p").each(
    (_index, element) => {
      const text = $(element).text().replace(/\u00a0/gu, " ").trim();
      if (!text && $(element).find("img").length === 0) $(element).remove();
    }
  );

  $("#cms-article-root p").each((_index, element) => {
    const current = $(element);
    const next = current.next("p");
    if (!next.length) return;
    const leftText = current.text().trim();
    const rightText = next.text().trim();
    const shortBrokenWord = leftText.match(/^([\p{L}]{1,4})$/u)?.[1];
    if (
      shortBrokenWord &&
      /^[\p{Ll}]/u.test(rightText) &&
      !/[.!?…:;»)]$/u.test(leftText)
    ) {
      current.html(`${current.html() || ""}${next.html() || ""}`);
      next.remove();
    }
  });

  const usedIds = new Set();
  const headings = [];

  $("#cms-article-root h2, #cms-article-root h3, #cms-article-root h4").each(
    (index, element) => {
      const text = $(element).text().replace(/\s+/gu, " ").trim();
      if (!text) return;
      const baseId =
        $(element).attr("id") || headingSlug(text) || `section-${index + 1}`;
      let id = baseId;
      let suffix = 2;
      while (usedIds.has(id)) {
        id = `${baseId}-${suffix}`;
        suffix += 1;
      }
      usedIds.add(id);
      $(element).attr("id", id);
      headings.push({
        id,
        level: Number(element.tagName.slice(1)),
        text,
      });
    }
  );

  $("#cms-article-root img").each((index, element) => {
    const image = $(element);
    const currentAlt = image.attr("alt") || "";
    if (imageAltLooksTechnical(currentAlt)) {
      const sectionTitle = image
        .prevAll("h2, h3, h4")
        .first()
        .text()
        .replace(/\s+/gu, " ")
        .trim();
      image.attr(
        "alt",
        locale === "en"
          ? sectionTitle
            ? `Illustration for the section "${sectionTitle}"`
            : `Illustration ${index + 1} for the article "${articleTitle}"`
          : sectionTitle
            ? `Иллюстрация к разделу «${sectionTitle}»`
            : `Иллюстрация ${index + 1} к статье «${articleTitle}»`
      );
    }
    if (!image.attr("loading")) image.attr("loading", "lazy");
  });

  const plainText = $("#cms-article-root")
    .text()
    .replace(/\s+/gu, " ")
    .trim();
  return {
    contentHtml: $("#cms-article-root").html() || "",
    plainText,
    headings,
  };
}

function publicationLabel(value) {
  const date = value ? new Date(value) : new Date();
  const formatted = new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Moscow",
  })
    .format(date)
    .replace(/\s+г\.$/u, "");
  return `Опубликовано: ${formatted}`;
}

function englishPublicationLabel(value) {
  const date = value ? new Date(value) : new Date();
  const formatted = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Moscow",
  }).format(date);
  return `Published: ${formatted}`;
}

function articlePublicPath(slug, categorySlug) {
  return `/stati/${articleSectionSlug(categorySlug)}/${slug}`;
}

function mediaById(mediaLookup, id) {
  return id ? mediaLookup.get(id) || null : null;
}

function mediaFocus(media) {
  if (!media) return {};
  const focusX =
    media.focus_x === null || media.focus_x === undefined || media.focus_x === ""
      ? Number.NaN
      : Number(media.focus_x);
  const focusY =
    media.focus_y === null || media.focus_y === undefined || media.focus_y === ""
      ? Number.NaN
      : Number(media.focus_y);
  return {
    ...(Number.isFinite(focusX) ? { focusX: Math.min(1, Math.max(0, focusX)) } : {}),
    ...(Number.isFinite(focusY) ? { focusY: Math.min(1, Math.max(0, focusY)) } : {}),
  };
}

function normalizeSettings(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

const writerOverrideFields = new Set([
  "name",
  "fullName",
  "birth",
  "death",
  "years",
  "birthDate",
  "deathDate",
  "birthPlace",
  "deathPlace",
  "bio",
  "country",
  "movement",
  "literaryEra",
  "works",
  "awards",
  "genres",
  "languages",
  "language",
  "nationality",
  "tags",
  "category",
  "biography",
  "description",
  "places",
  "relatedWriters",
  "articleUrl",
]);

const countryOverrideFields = new Set([
  "name",
  "code",
  "flag",
  "coordinates",
  "region",
  "continent",
  "officialLanguage",
  "literaryPeriods",
  "literaryMovements",
  "periods",
  "capital",
  "description",
  "history",
  "historicalNote",
  "facts",
  "literaryPlaces",
  "timeline",
  "chronology",
  "nobel",
  "places",
  "influence",
]);

function safeCountryOverrideValue(key, value) {
  if (!countryOverrideFields.has(key)) return false;
  if (["nobel", "places", "influence"].includes(key)) {
    return value === null || (typeof value === "number" && Number.isFinite(value));
  }
  if (key === "coordinates") {
    return (
      value === null ||
      (Array.isArray(value) &&
        value.length === 2 &&
        value.every((item) => typeof item === "number" && Number.isFinite(item))) ||
      (value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        typeof value.lat === "number" &&
        Number.isFinite(value.lat) &&
        typeof value.lng === "number" &&
        Number.isFinite(value.lng))
    );
  }
  if (["timeline", "chronology"].includes(key)) {
    return (
      Array.isArray(value) &&
      value.every(
        (item) =>
          typeof item === "string" ||
          (item && typeof item === "object" && !Array.isArray(item))
      )
    );
  }
  if (Array.isArray(value)) {
    return value.every((item) => typeof item === "string");
  }
  return typeof value === "string";
}

function normalizeCountryOverrideFields(value) {
  const source = normalizeSettings(value);
  return Object.fromEntries(
    Object.entries(source).filter(([key, fieldValue]) =>
      safeCountryOverrideValue(key, fieldValue)
    )
  );
}

function normalizeWriterOverrideFields(value) {
  const source = normalizeSettings(value);
  return Object.fromEntries(
    Object.entries(source).filter(([key, fieldValue]) => {
      if (!writerOverrideFields.has(key)) return false;
      if (Array.isArray(fieldValue)) {
        return fieldValue.every((item) => typeof item === "string");
      }
      return typeof fieldValue === "string";
    })
  );
}

function asGeneratedModule(variableName, value, comment) {
  return `// Generated by scripts/export-published-content.mjs. Do not edit by hand.
// ${comment}
export const ${variableName} = ${JSON.stringify(value, null, 2)} as const;
`;
}

const exportPublicationHeadStart = serviceRoleKey
  ? await fetchCmsPublicationHead({ supabaseUrl, serviceKey: serviceRoleKey })
  : { source: "outbox", outboxHighWater: "0", legacyAuditHighWater: "0" };

const [
  rawArticles,
  rawArticleTranslations,
  mediaAssets,
  rawHomepageBlocks,
  rawBanners,
  rawMenus,
  rawNavigationItems,
  rawPages,
  rawRedirects,
  rawCountryProfileOverrides,
  rawWriterProfileOverrides,
  rawLiteraryWorks,
  rawBookEditions,
  rawTypographyInputs,
] = await Promise.all([
  fetchRows("articles", {
    select:
      "id,legacy_id,title,subtitle,excerpt,content_html,cover_media_id,cover_external_url,cover_alt,slug,legacy_path,published_at,updated_at,featured,show_on_homepage,pinned,sources,bibliography,seo_title,seo_description,seo_keywords,canonical_url,og_title,og_description,og_media_id,allow_indexing,categories(name,slug)",
    status: "eq.published",
    deleted_at: "is.null",
    order: "pinned.desc,featured.desc,published_at.desc,id.asc",
  }),
  fetchOptionalRows("article_translations", {
    select:
      "article_id,locale,title,subtitle,excerpt,content_html,cover_alt,slug,sources,bibliography,seo_title,seo_description,seo_keywords,canonical_url,og_title,og_description,status,source_content_hash,source_article_updated_at,approved_at,published_at,updated_at",
    locale: "eq.en",
    status: "in.(approved,published)",
    deleted_at: "is.null",
    order: "updated_at.desc,article_id.asc,locale.asc",
  }),
  fetchRows("media_assets", {
    select:
      "id,bucket,object_path,alt_text,caption,creator,source_url,license_name,license_url,focus_x,focus_y",
    deleted_at: "is.null",
    order: "id.asc",
  }),
  fetchRows("homepage_blocks", {
    select:
      "id,block_type,title,settings,display_order,background_style,background_media_id,updated_at",
    is_enabled: "eq.true",
    order: "display_order.asc,id.asc",
  }),
  fetchRows("banners", {
    select:
      "id,name,title,description,target_url,button_text,desktop_media_id,tablet_media_id,mobile_media_id,page_patterns,display_order,starts_at,ends_at",
    is_active: "eq.true",
    order: "display_order.asc,id.asc",
  }),
  fetchRows("navigation_menus", {
    select: "id,name,location",
    order: "location.asc,id.asc",
  }),
  fetchRows("navigation_items", {
    select:
      "id,menu_id,parent_id,label,href,open_in_new_tab,display_order",
    is_visible: "eq.true",
    order: "display_order.asc,id.asc",
  }),
  fetchRows("pages", {
    select:
      "id,title,slug,excerpt,content_html,seo_title,seo_description,canonical_url,allow_indexing,updated_at",
    status: "eq.published",
    deleted_at: "is.null",
    order: "updated_at.desc,id.asc",
  }),
  fetchRows("redirects", {
    select: "source_path,destination_path,status_code",
    is_active: "eq.true",
    order: "source_path.asc",
  }),
  fetchOptionalRows("country_profile_overrides", {
    select: "country_id,fields,updated_at",
    is_enabled: "eq.true",
    order: "country_id.asc",
  }),
  fetchOptionalRows("writer_profile_overrides", {
    select: "country_id,writer_id,fields,updated_at",
    is_enabled: "eq.true",
    order: "country_id.asc,writer_id.asc",
  }),
  fetchOptionalRows("literary_works", {
    select:
      "id,legacy_id,country_id,writer_id,title,original_title,first_published,original_language,genres,tags,description,source_url,editorial_status,reviewed_at,updated_at",
    editorial_status: "in.(reviewed,verified)",
    order: "legacy_id.asc,id.asc",
  }, publicSnapshotKey),
  fetchOptionalRows("book_editions", {
    select:
      "id,work_id,title,isbn_10,isbn_13,publisher,publication_year,language,cover_url,cover_source_url,cover_rights_status,license_name,license_url,creator,rights_holder,rights_checked_at,source_url,is_primary,updated_at",
    cover_url: "not.is.null",
    cover_source_url: "not.is.null",
    rights_checked_at: "not.is.null",
    cover_rights_status: "in.(public-domain,licensed,permission,external-preview)",
    order: "is_primary.desc,updated_at.desc,id.asc",
  }, publicSnapshotKey),
  fetchPublishedTypographyInputs(),
]);

const rawTypographyOverrides = rawTypographyInputs.overrides;
const rawFontAssets = rawTypographyInputs.fonts;

const normalizedTypography = normalizePublishedTypography(
  rawTypographyOverrides,
  rawFontAssets
);
const downloadedTypographyFonts = await Promise.all(
  normalizedTypography.fonts.map(async (font) => ({
    font,
    bytes: await downloadPublishedFont(font),
  }))
);
const typography = {
  fonts: normalizedTypography.fonts.map(publicFontMetadata),
  overrides: normalizedTypography.overrides,
};

const mediaLookup = new Map(mediaAssets.map((media) => [media.id, media]));
const englishTranslationByArticleId = new Map();
rawArticleTranslations.forEach((translation) => {
  if (
    !englishTranslationByArticleId.has(translation.article_id) &&
    String(translation.title || "").trim() &&
    String(translation.content_html || "").trim()
  ) {
    englishTranslationByArticleId.set(translation.article_id, translation);
  }
});
const articleDocuments = [];

const articles = rawArticles.map((rawArticle) => {
  const article = applyEditorialPublicationFix(rawArticle);
  const category = relationValue(article.categories);
  const sectionId = category?.slug || "literary-essays";
  const sectionLabel = category?.name || "Материалы";
  const sourceSlug = article.slug;
  const slug = publicArticleSlug(article);
  const document = prepareArticleDocument(article.content_html, article.title);
  const wordCount = document.plainText
    ? document.plainText.split(/\s+/gu).length
    : 0;
  const coverMedia = mediaById(mediaLookup, article.cover_media_id);
  const imageUrl = article.cover_external_url || storageUrl(coverMedia) || undefined;
  const imageFocus = article.cover_external_url ? {} : mediaFocus(coverMedia);
  const ogImageUrl = storageUrl(mediaById(mediaLookup, article.og_media_id)) || imageUrl;
  const imageAlt = imageAltLooksTechnical(article.cover_alt || coverMedia?.alt_text)
    ? `Иллюстрация к статье «${article.title}»`
    : article.cover_alt || coverMedia?.alt_text || "";
  const dzenCover = dzenCoverForArticle({
    title: article.title,
    content_html: document.contentHtml,
    cover_external_url: imageUrl,
    cover_alt: imageAlt,
  });
  const id = `cms-${article.id}`;
  const publicPath = articlePublicPath(slug, sectionId);
  const canonicalUrl = `${siteOrigin}${publicPath}/`;
  const legacyPath = article.legacy_path || null;
  const description =
    article.excerpt ||
    article.subtitle ||
    document.plainText.slice(0, 320);
  const englishTranslation = englishTranslationByArticleId.get(article.id);
  const englishDocument = englishTranslation
    ? prepareArticleDocument(
        englishTranslation.content_html,
        englishTranslation.title,
        "en"
      )
    : null;
  const englishWordCount = englishDocument?.plainText
    ? englishDocument.plainText.split(/\s+/gu).length
    : 0;
  const englishDescription = englishTranslation
    ? englishTranslation.excerpt ||
      englishTranslation.subtitle ||
      englishDocument?.plainText.slice(0, 320) ||
      ""
    : "";
  const englishEntry = englishTranslation
    ? {
        locale: "en",
        title: englishTranslation.title,
        description: englishDescription,
        imageAlt: imageAltLooksTechnical(englishTranslation.cover_alt)
          ? `Illustration for the article "${englishTranslation.title}"`
          : englishTranslation.cover_alt,
        sectionLabel: categoryEnglishLabels[sectionId] || "Article",
        publishedLabel: englishPublicationLabel(article.published_at),
        publishedAt: article.published_at,
        updatedAt: englishTranslation.updated_at,
        readingMinutes: Math.max(1, Math.ceil(englishWordCount / 180)),
        wordCount: englishWordCount,
        headingCount: englishDocument?.headings.length || 0,
        slug: englishTranslation.slug,
        seoTitle: englishTranslation.seo_title || englishTranslation.title,
        seoDescription:
          englishTranslation.seo_description || englishDescription,
        seoKeywords: englishTranslation.seo_keywords || [],
        canonicalUrl: englishTranslation.canonical_url || null,
        ogTitle:
          englishTranslation.og_title ||
          englishTranslation.seo_title ||
          englishTranslation.title,
        ogDescription:
          englishTranslation.og_description ||
          englishTranslation.seo_description ||
          englishDescription,
        translationStatus: englishTranslation.status,
        sourceContentHash: englishTranslation.source_content_hash || null,
        sourceArticleUpdatedAt:
          englishTranslation.source_article_updated_at || null,
        approvedAt: englishTranslation.approved_at || null,
        translationPublishedAt: englishTranslation.published_at || null,
      }
    : null;
  const entry = normalizeArticlePublicMetadata({
    id,
    source: "cms",
    legacyId: article.legacy_id || null,
    legacyPath,
    url: canonicalUrl,
    canonicalUrl,
    slug,
    sourceSlug: sourceSlug !== slug ? sourceSlug : undefined,
    title: article.title,
    description,
    imageUrl,
    imageFocusX: imageFocus.focusX,
    imageFocusY: imageFocus.focusY,
    imageAlt,
    dzenImageUrl: dzenCover?.url,
    dzenImageAlt: dzenCover?.alt,
    sectionId,
    sectionLabel,
    publishedLabel: publicationLabel(article.published_at),
    publishedAt: article.published_at,
    updatedAt: article.updated_at,
    readingMinutes: Math.max(1, Math.ceil(wordCount / 180)),
    wordCount,
    headingCount: document.headings.length,
    documentPath: `cms/articles/${id}.json`,
    featured: Boolean(article.featured),
    showOnHomepage: Boolean(article.show_on_homepage),
    pinned: Boolean(article.pinned),
    seoTitle: article.seo_title || article.title,
    seoDescription: article.seo_description || description,
    seoKeywords: article.seo_keywords || [],
    ogTitle: article.og_title || article.seo_title || article.title,
    ogDescription:
      article.og_description || article.seo_description || description,
    ogImageUrl,
    allowIndexing: article.allow_indexing !== false,
    translations: englishEntry ? { en: englishEntry } : undefined,
  });
  articleDocuments.push({
    path: path.join(publicCmsArticlesDirectory, `${id}.json`),
    payload: {
      ...entry,
      ...document,
      sources: article.sources || [],
      bibliography: article.bibliography || [],
      translations:
        englishEntry && englishDocument
          ? {
              en: {
                ...englishEntry,
                ...englishDocument,
                sources: englishTranslation.sources || [],
                bibliography: englishTranslation.bibliography || [],
              },
            }
          : undefined,
    },
  });
  return entry;
});

const {
  homepageBlocks: publicHomepageBlocks,
  siteCopy,
} = extractSiteCopyFromHomepageBlocks(rawHomepageBlocks);

const homepageBlocks = publicHomepageBlocks.map((block) => {
  const backgroundMedia = mediaById(mediaLookup, block.background_media_id);
  return ({
  id: block.id,
  type: block.block_type,
  title: block.title,
  settings: normalizeSettings(block.settings),
  displayOrder: block.display_order,
  backgroundStyle: block.background_style,
  backgroundMediaId: block.background_media_id,
  backgroundImageUrl: storageUrl(backgroundMedia),
  backgroundFocusX: mediaFocus(backgroundMedia).focusX,
  backgroundFocusY: mediaFocus(backgroundMedia).focusY,
  updatedAt: block.updated_at,
  });
});

const banners = rawBanners.map((banner) => {
  const desktopMedia = mediaById(mediaLookup, banner.desktop_media_id);
  const tabletMedia = mediaById(mediaLookup, banner.tablet_media_id);
  const mobileMedia = mediaById(mediaLookup, banner.mobile_media_id);
  return ({
  id: banner.id,
  name: banner.name,
  title: banner.title,
  description: banner.description,
  targetUrl: banner.target_url,
  buttonText: banner.button_text,
  pagePatterns: banner.page_patterns || ["/"],
  displayOrder: banner.display_order,
  startsAt: banner.starts_at,
  endsAt: banner.ends_at,
  desktopMediaId: banner.desktop_media_id,
  tabletMediaId: banner.tablet_media_id,
  mobileMediaId: banner.mobile_media_id,
  desktopImageUrl: storageUrl(desktopMedia),
  tabletImageUrl: storageUrl(tabletMedia),
  mobileImageUrl: storageUrl(mobileMedia),
  desktopFocusX: mediaFocus(desktopMedia).focusX,
  desktopFocusY: mediaFocus(desktopMedia).focusY,
  tabletFocusX: mediaFocus(tabletMedia).focusX,
  tabletFocusY: mediaFocus(tabletMedia).focusY,
  mobileFocusX: mediaFocus(mobileMedia).focusX,
  mobileFocusY: mediaFocus(mobileMedia).focusY,
  });
});

const navigationMenus = rawMenus.map((menu) => ({
  id: menu.id,
  name: menu.name,
  location: menu.location,
  items: rawNavigationItems
    .filter((item) => item.menu_id === menu.id)
    .map((item) => ({
      id: item.id,
      parentId: item.parent_id,
      label: item.label,
      href: item.href,
      openInNewTab: Boolean(item.open_in_new_tab),
      displayOrder: item.display_order,
    })),
}));

const pages = rawPages.map((page) => ({
  id: page.id,
  title: page.title,
  slug: page.slug,
  excerpt: page.excerpt,
  contentHtml: page.content_html,
  seoTitle: page.seo_title || page.title,
  seoDescription: page.seo_description || page.excerpt,
  canonicalUrl:
    page.canonical_url || `${siteOrigin}/stranitsy/${page.slug}/`,
  allowIndexing: page.allow_indexing !== false,
  updatedAt: page.updated_at,
}));

const allRedirects = rawRedirects.map((redirect) => ({
  sourcePath: redirect.source_path,
  destinationPath: redirect.destination_path,
  statusCode: redirect.status_code,
}));

const writerProfileOverrides = Object.fromEntries(
  rawWriterProfileOverrides.map((override) => [
    `${override.country_id}:${override.writer_id}`,
    normalizeWriterOverrideFields(override.fields),
  ])
);

const countryProfileOverrides = Object.fromEntries(
  rawCountryProfileOverrides.map((override) => [
    override.country_id,
    normalizeCountryOverrideFields(override.fields),
  ])
);

const literaryWorksByLegacyId = Object.fromEntries(
  rawLiteraryWorks.flatMap((work) => {
    const prefix = `${work.country_id}:${work.writer_id}:`;
    if (!String(work.legacy_id || "").startsWith(prefix)) return [];
    return [
      [
        work.legacy_id,
        {
          legacyId: work.legacy_id,
          countryId: work.country_id,
          writerId: work.writer_id,
          localId: work.legacy_id.slice(prefix.length),
          title: work.title,
          originalTitle: work.original_title || undefined,
          firstPublished: work.first_published ?? undefined,
          originalLanguage: work.original_language || undefined,
          genres: Array.isArray(work.genres) ? work.genres : [],
          tags: Array.isArray(work.tags) ? work.tags : [],
          description: work.description || undefined,
          sourceUrl: work.source_url || undefined,
          editorialStatus: work.editorial_status,
          reviewedAt: work.reviewed_at || undefined,
        },
      ],
    ];
  })
);

const workLegacyIds = new Map(
  rawLiteraryWorks.map((work) => [work.id, work.legacy_id])
);
const bookEditionsByWorkId = {};
for (const edition of rawBookEditions) {
  const legacyWorkId = workLegacyIds.get(edition.work_id);
  if (!legacyWorkId || bookEditionsByWorkId[legacyWorkId]) continue;
  bookEditionsByWorkId[legacyWorkId] = {
    title: edition.title || "",
    isbn10: edition.isbn_10 || null,
    isbn13: edition.isbn_13 || null,
    publisher: edition.publisher || "",
    publicationYear: edition.publication_year || null,
    language: edition.language || "",
    coverUrl: edition.cover_url,
    coverSourceUrl: edition.cover_source_url,
    coverRightsStatus: edition.cover_rights_status,
    licenseName: edition.license_name || "",
    licenseUrl: edition.license_url || null,
    creator: edition.creator || "",
    rightsHolder: edition.rights_holder || "",
    rightsCheckedAt: edition.rights_checked_at,
    sourceUrl: edition.source_url || edition.cover_source_url,
  };
}

const exportPublicationHeadAfterRead = serviceRoleKey
  ? await fetchCmsPublicationHead({ supabaseUrl, serviceKey: serviceRoleKey })
  : exportPublicationHeadStart;
let stablePublicationHead;
try {
  stablePublicationHead = assertStablePublicationHeadWindow(
    exportPublicationHeadStart,
    exportPublicationHeadAfterRead
  );
} catch (error) {
  failUnstableExport(error);
}

const generatedAt = new Date().toISOString();
for (const exportedContent of [
  articleDocuments,
  articles,
  homepageBlocks,
  siteCopy,
  banners,
  navigationMenus,
  pages,
  countryProfileOverrides,
  writerProfileOverrides,
  literaryWorksByLegacyId,
  bookEditionsByWorkId,
  typography,
]) {
  normalizeShortHyphensDeep(exportedContent);
}
const siteContentBase = {
  generatedAt,
  homepageBlocks,
  siteCopy,
  banners,
  navigationMenus,
  pages,
  bookEditionsByWorkId,
  typography,
};
const snapshotBaseContent = {
  version: 1,
  generatedAt,
  source: "Supabase CMS",
  articles,
  countryProfileOverrides,
  writerProfileOverrides,
  literaryWorksByLegacyId,
};

const baseline = await publicationBaseline();
const candidateIds = articleIdSet(articles, "candidate snapshot");
const baselineIds = baseline?.articles
  ? articleIdSet(baseline.articles, "deployed baseline")
  : new Set();
const removedSourceIds = [...baselineIds]
  .filter((id) => !candidateIds.has(id))
  .map(cmsSourceArticleId);
const withdrawalStates = await authoritativeArticleStates(removedSourceIds);
const removedIds = [...baselineIds]
  .filter((id) => !candidateIds.has(id))
  .sort();
const withdrawnLegacyArticles = buildLegacyArticleWithdrawals({
  candidateArticles: articles,
  baseline,
  removedIds,
});
const redirectPartition = partitionRedirectsByWithdrawnDestination(
  allRedirects,
  withdrawnLegacyArticles
);
const redirects = redirectPartition.allowed;
const siteContent = {
  ...siteContentBase,
  redirects,
};
const snapshotContent = {
  ...snapshotBaseContent,
  ...siteContent,
  withdrawnLegacyArticles,
};
const snapshot = {
  ...snapshotContent,
  publication: publicationMetadata(snapshotContent, stablePublicationHead),
};
const replacement = assertCandidateCanReplaceBaseline({
  candidate: snapshot,
  baseline,
  authoritativeStates: withdrawalStates,
});
if (redirectPartition.blocked.length) {
  console.warn(
    `Excluded ${redirectPartition.blocked.length} redirect(s) targeting withdrawn article canonicals.`
  );
}

if (serviceRoleKey) {
  try {
    stablePublicationHead = assertStablePublicationHeadWindow(
      stablePublicationHead,
      await fetchCmsPublicationHead({ supabaseUrl, serviceKey: serviceRoleKey })
    );
  } catch (error) {
    failUnstableExport(error);
  }
}

const expectedArticleDocumentNames = articleDocuments.map(({ path: outputPath }) =>
  path.basename(outputPath)
);
let existingArticleDocumentNames = [];
try {
  existingArticleDocumentNames = await fs.readdir(publicCmsArticlesDirectory);
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}
const staleArticleDocumentNames = staleManagedCmsArticleSnapshotNames(
  existingArticleDocumentNames,
  expectedArticleDocumentNames
);
let existingFontDocumentNames = [];
try {
  existingFontDocumentNames = await fs.readdir(publicCmsFontsDirectory);
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}
const expectedFontDocumentNames = new Set(
  normalizedTypography.fonts.map((font) => path.basename(font.publicPath))
);
const staleFontDocumentNames = existingFontDocumentNames.filter(
  (name) => /^[0-9a-f]{64}\.woff2?$/u.test(name) && !expectedFontDocumentNames.has(name)
);

// Generated article documents, secondary indexes and TypeScript catalogs are
// staged first. The canonical published-content manifest is promoted last and
// acts as the snapshot commit point. Any failed promotion restores all prior
// destinations, including intentionally withdrawn article documents.
await commitAtomicFileSet({
  root: projectRoot,
  writes: [
    ...downloadedTypographyFonts.map(({ font, bytes }) => ({
      path: path.join(projectRoot, "public", font.publicPath),
      content: bytes,
    })),
    ...articleDocuments.map(({ path: outputPath, payload }) => ({
      path: outputPath,
      content: `${JSON.stringify(payload, null, 2)}\n`,
    })),
    {
      path: path.join(publicCmsDirectory, "published-articles.json"),
      content: `${JSON.stringify(
        {
          generatedAt,
          source: "Supabase CMS",
          publication: snapshot.publication,
          articles,
          withdrawnLegacyArticles,
        },
        null,
        2
      )}\n`,
    },
    {
      path: path.join(publicCmsDirectory, "book-editions.json"),
      content: `${JSON.stringify(
        { generatedAt, editions: bookEditionsByWorkId },
        null,
        2
      )}\n`,
    },
    {
      path: articleCatalogModule,
      content: asGeneratedModule(
        "cmsArticleCatalog",
        articles,
        "Public article metadata exported through read-only RLS policies."
      ),
    },
    {
      path: articleWithdrawalsModule,
      content: asGeneratedModule(
        "cmsWithdrawnLegacyArticles",
        withdrawnLegacyArticles,
        "Verified CMS withdrawals that suppress retired static article fallbacks."
      ),
    },
    {
      path: siteContentModule,
      content: asGeneratedModule(
        "cmsSiteContent",
        siteContent,
        "Public homepage, navigation and page metadata exported through read-only RLS policies."
      ),
    },
    {
      path: bookEditionsModule,
      content: asGeneratedModule(
        "cmsBookEditionsByWorkId",
        bookEditionsByWorkId,
        "Verified exact-edition covers exported from the normalized library."
      ),
    },
    {
      path: countryProfilesModule,
      content: asGeneratedModule(
        "cmsCountryProfileOverrides",
        countryProfileOverrides,
        "Durable country-profile overrides saved from the editorial database."
      ),
    },
    {
      path: writerProfilesModule,
      content: asGeneratedModule(
        "cmsWriterProfileOverrides",
        writerProfileOverrides,
        "Durable writer-profile overrides saved from the visual CMS."
      ),
    },
    {
      path: literaryWorksModule,
      content: asGeneratedModule(
        "cmsLiteraryWorksByLegacyId",
        literaryWorksByLegacyId,
        "Published literary-work records saved in the normalized CMS library."
      ),
    },
    {
      path: path.join(publicCmsDirectory, "published-content.json"),
      content: `${JSON.stringify(snapshot, null, 2)}\n`,
    },
  ],
  deletes: [
    ...staleArticleDocumentNames.map((name) =>
      path.join(publicCmsArticlesDirectory, name)
    ),
    ...staleFontDocumentNames.map((name) =>
      path.join(publicCmsFontsDirectory, name)
    ),
  ],
});

if (process.env.GITHUB_OUTPUT) {
  await fs.appendFile(
    process.env.GITHUB_OUTPUT,
    [
      `article_count=${snapshot.publication.articleCount}`,
      `publication_head_source=${snapshot.publication.headSource}`,
      `outbox_high_water=${snapshot.publication.outboxHighWater}`,
      `legacy_audit_high_water=${snapshot.publication.legacyAuditHighWater}`,
      `publication_queue_marker=${publicationHeadMarker(stablePublicationHead)}`,
      `content_sha256=${snapshot.publication.contentSha256}`,
      "",
    ].join("\n"),
    "utf8"
  );
}

console.log(
  `Exported stable CMS snapshot ${snapshot.publication.contentSha256.slice(0, 12)} at publication head ${publicationHeadMarker(stablePublicationHead) || `${stablePublicationHead.source}:0`}: ${articles.length} articles, ${homepageBlocks.length} homepage blocks, ${Object.keys(siteCopy.ru).length + Object.keys(siteCopy.en).length} site-copy overrides, ${Object.keys(countryProfileOverrides).length} country overrides, ${Object.keys(writerProfileOverrides).length} writer overrides, ${Object.keys(literaryWorksByLegacyId).length} literary works, ${banners.length} banners, ${pages.length} pages, ${navigationMenus.length} menus, ${Object.keys(bookEditionsByWorkId).length} exact book covers and ${typography.fonts.length} self-hosted fonts; ${replacement.removedIds.length} authoritative withdrawal(s), ${staleArticleDocumentNames.length} stale article snapshot(s) and ${staleFontDocumentNames.length} stale font file(s) removed.`
);
