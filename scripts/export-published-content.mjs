import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "cheerio";
import { applyEditorialPublicationFix } from "./editorial-publication-fixes.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicCmsDirectory = path.join(projectRoot, "public", "cms");
const publicCmsArticlesDirectory = path.join(publicCmsDirectory, "articles");
const articleCatalogModule = path.join(
  projectRoot,
  "src",
  "data",
  "articles",
  "cms.generated.ts"
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

const supabaseUrl = (
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  ""
).replace(/\/+$/, "");
const apiKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "";
const siteOrigin = (
  process.env.PUBLIC_SITE_URL ||
  process.env.VITE_PUBLIC_SITE_URL ||
  "https://probpera.ru"
).replace(/\/+$/, "");

if (!supabaseUrl || !apiKey) {
  console.log(
    "CMS export skipped: public Supabase variables are not configured. Existing CMS snapshot is preserved."
  );
  process.exit(0);
}

const categoryRouteSlugs = {
  "book-opinions": "mnenie-o-knige",
  "screen-adaptations": "kniga-i-ekranizatsiya",
  "writers-world": "pisateli-mira",
  "book-guides": "knizhnyy-gid",
  awards: "literaturnye-premii",
  folklore: "folklor-i-mifologiya",
  language: "russkiy-yazyk",
  "literary-essays": "o-literature",
  "author-stories": "literaturnye-istorii",
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

async function fetchRows(table, query) {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/${table}?${queryString(query)}`,
    {
      headers: {
          apikey: apiKey,
          Authorization: `Bearer ${apiKey}`,
      },
    }
  );
  if (!response.ok) {
    throw new Error(
      `CMS export failed for ${table}: ${response.status} ${await response.text()}`
    );
  }
  return response.json();
}

async function fetchOptionalRows(table, query) {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/${table}?${queryString(query)}`,
    {
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
      },
    }
  );
  if (response.ok) return response.json();

  const body = await response.text();
  if (response.status === 404 && body.includes("PGRST205")) {
    console.warn(
      `Optional CMS table ${table} is not provisioned yet; preserving an empty public snapshot.`
    );
    return [];
  }
  throw new Error(
    `CMS export failed for ${table}: ${response.status} ${body}`
  );
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

function prepareArticleDocument(contentHtml, articleTitle = "") {
  const $ = load(`<main id="cms-article-root">${contentHtml || ""}</main>`, {
    decodeEntities: false,
  });

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
        sectionTitle
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

function articleSectionSlug(categorySlug) {
  return categoryRouteSlugs[categorySlug || ""] || "materialy";
}

function articlePublicPath(slug, categorySlug) {
  return `/stati/${articleSectionSlug(categorySlug)}/${slug}`;
}

function mediaById(mediaLookup, id) {
  return id ? mediaLookup.get(id) || null : null;
}

function normalizeSettings(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asGeneratedModule(variableName, value, comment) {
  return `// Generated by scripts/export-published-content.mjs. Do not edit by hand.
// ${comment}
export const ${variableName} = ${JSON.stringify(value, null, 2)} as const;
`;
}

const [
  rawArticles,
  mediaAssets,
  rawHomepageBlocks,
  rawBanners,
  rawMenus,
  rawNavigationItems,
  rawPages,
  rawRedirects,
  rawLiteraryWorks,
  rawBookEditions,
] = await Promise.all([
  fetchRows("articles", {
    select:
      "id,legacy_id,title,subtitle,excerpt,content_html,cover_media_id,cover_external_url,cover_alt,slug,legacy_path,published_at,featured,show_on_homepage,pinned,sources,bibliography,seo_title,seo_description,seo_keywords,canonical_url,og_title,og_description,og_media_id,allow_indexing,categories(name,slug)",
    status: "eq.published",
    deleted_at: "is.null",
    order: "pinned.desc,featured.desc,published_at.desc",
  }),
  fetchRows("media_assets", {
    select:
      "id,bucket,object_path,alt_text,caption,creator,source_url,license_name,license_url,focus_x,focus_y",
    deleted_at: "is.null",
  }),
  fetchRows("homepage_blocks", {
    select:
      "id,block_type,title,settings,display_order,background_style,background_media_id,updated_at",
    is_enabled: "eq.true",
    order: "display_order.asc",
  }),
  fetchRows("banners", {
    select:
      "id,name,title,description,target_url,button_text,desktop_media_id,tablet_media_id,mobile_media_id,page_patterns,display_order,starts_at,ends_at",
    is_active: "eq.true",
    order: "display_order.asc",
  }),
  fetchRows("navigation_menus", {
    select: "id,name,location",
    order: "location.asc",
  }),
  fetchRows("navigation_items", {
    select:
      "id,menu_id,parent_id,label,href,open_in_new_tab,display_order",
    is_visible: "eq.true",
    order: "display_order.asc",
  }),
  fetchRows("pages", {
    select:
      "id,title,slug,excerpt,content_html,seo_title,seo_description,canonical_url,allow_indexing,updated_at",
    status: "eq.published",
    deleted_at: "is.null",
    order: "updated_at.desc",
  }),
  fetchRows("redirects", {
    select: "source_path,destination_path,status_code",
    is_active: "eq.true",
    order: "source_path.asc",
  }),
  fetchOptionalRows("literary_works", {
    select: "id,legacy_id,editorial_status",
    editorial_status: "in.(reviewed,verified)",
    order: "legacy_id.asc",
  }),
  fetchOptionalRows("book_editions", {
    select:
      "id,work_id,title,isbn_10,isbn_13,publisher,publication_year,language,cover_url,cover_source_url,cover_rights_status,license_name,license_url,creator,rights_holder,rights_checked_at,source_url,is_primary,updated_at",
    cover_url: "not.is.null",
    cover_source_url: "not.is.null",
    rights_checked_at: "not.is.null",
    cover_rights_status: "in.(public-domain,licensed,permission,external-preview)",
    order: "is_primary.desc,updated_at.desc",
  }),
]);

const mediaLookup = new Map(mediaAssets.map((media) => [media.id, media]));
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
  const ogImageUrl = storageUrl(mediaById(mediaLookup, article.og_media_id)) || imageUrl;
  const id = `cms-${article.id}`;
  const publicPath = articlePublicPath(slug, sectionId);
  const canonicalUrl = `${siteOrigin}${publicPath}/`;
  const legacyPath = article.legacy_path || null;
  const description =
    article.excerpt ||
    article.subtitle ||
    document.plainText.slice(0, 320);
  const entry = {
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
    imageAlt: imageAltLooksTechnical(article.cover_alt || coverMedia?.alt_text)
      ? `Иллюстрация к статье «${article.title}»`
      : article.cover_alt || coverMedia?.alt_text || "",
    sectionId,
    sectionLabel,
    publishedLabel: publicationLabel(article.published_at),
    publishedAt: article.published_at,
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
  };
  articleDocuments.push({
    path: path.join(publicCmsArticlesDirectory, `${id}.json`),
    payload: {
      ...entry,
      ...document,
      sources: article.sources || [],
      bibliography: article.bibliography || [],
    },
  });
  return entry;
});

const homepageBlocks = rawHomepageBlocks.map((block) => ({
  id: block.id,
  type: block.block_type,
  title: block.title,
  settings: normalizeSettings(block.settings),
  displayOrder: block.display_order,
  backgroundStyle: block.background_style,
  backgroundImageUrl: storageUrl(
    mediaById(mediaLookup, block.background_media_id)
  ),
  updatedAt: block.updated_at,
}));

const banners = rawBanners.map((banner) => ({
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
  desktopImageUrl: storageUrl(mediaById(mediaLookup, banner.desktop_media_id)),
  tabletImageUrl: storageUrl(mediaById(mediaLookup, banner.tablet_media_id)),
  mobileImageUrl: storageUrl(mediaById(mediaLookup, banner.mobile_media_id)),
}));

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

const redirects = rawRedirects.map((redirect) => ({
  sourcePath: redirect.source_path,
  destinationPath: redirect.destination_path,
  statusCode: redirect.status_code,
}));

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

const generatedAt = new Date().toISOString();
const siteContent = {
  generatedAt,
  homepageBlocks,
  banners,
  navigationMenus,
  pages,
  redirects,
  bookEditionsByWorkId,
};
const snapshot = {
  version: 1,
  generatedAt,
  source: "Supabase CMS",
  articles,
  ...siteContent,
};

await fs.mkdir(publicCmsArticlesDirectory, { recursive: true });
await fs.mkdir(path.dirname(articleCatalogModule), { recursive: true });
await fs.mkdir(path.dirname(siteContentModule), { recursive: true });

await Promise.all([
  ...articleDocuments.map(({ path: outputPath, payload }) =>
    fs.writeFile(outputPath, JSON.stringify(payload, null, 2), "utf8")
  ),
  fs.writeFile(
    path.join(publicCmsDirectory, "published-content.json"),
    JSON.stringify(snapshot, null, 2),
    "utf8"
  ),
  fs.writeFile(
    path.join(publicCmsDirectory, "published-articles.json"),
    JSON.stringify({ generatedAt, source: "Supabase CMS", articles }, null, 2),
    "utf8"
  ),
  fs.writeFile(
    path.join(publicCmsDirectory, "book-editions.json"),
    JSON.stringify(
      { generatedAt, editions: bookEditionsByWorkId },
      null,
      2
    ),
    "utf8"
  ),
  fs.writeFile(
    articleCatalogModule,
    asGeneratedModule(
      "cmsArticleCatalog",
      articles,
      "Public article metadata exported through read-only RLS policies."
    ),
    "utf8"
  ),
  fs.writeFile(
    siteContentModule,
    asGeneratedModule(
      "cmsSiteContent",
      siteContent,
      "Public homepage, navigation and page metadata exported through read-only RLS policies."
    ),
    "utf8"
  ),
  fs.writeFile(
    bookEditionsModule,
    asGeneratedModule(
      "cmsBookEditionsByWorkId",
      bookEditionsByWorkId,
      "Verified exact-edition covers exported from the normalized library."
    ),
    "utf8"
  ),
]);

console.log(
  `Exported ${articles.length} articles, ${homepageBlocks.length} homepage blocks, ${banners.length} banners, ${pages.length} pages, ${navigationMenus.length} menus and ${Object.keys(bookEditionsByWorkId).length} exact book covers from CMS.`
);
