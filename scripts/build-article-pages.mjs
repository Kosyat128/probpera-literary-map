import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "cheerio";
import {
  articlePublicPath,
  articleRouteSlug,
  articleSectionArchivePath,
  articleSectionSlug,
  articleSectionSlugs,
  normalizeArticlePublicMetadata,
  normalizedPath,
} from "./lib/article-route-policy.mjs";
import {
  dzenCoverForArticle,
  positionDzenLeadIllustration,
} from "./lib/article-publication-images.mjs";
import { applyEditorialPublicationFix } from "./editorial-publication-fixes.mjs";

const projectRoot = process.env.ARTICLE_BUILD_PROJECT_ROOT
  ? path.resolve(process.env.ARTICLE_BUILD_PROJECT_ROOT)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDirectory = path.join(projectRoot, "dist");
const publicDirectory = path.join(projectRoot, "public");
const articleDirectory = path.join(projectRoot, "public", "articles");
const siteOrigin = (process.env.PUBLIC_SITE_ORIGIN || "https://kosyat128.github.io").replace(/\/+$/, "");
const configuredBase = process.env.PUBLIC_SITE_BASE_PATH ?? "/probpera-literary-map";
const siteBasePath =
  configuredBase === "/" ? "" : `/${configuredBase.replace(/^\/+|\/+$/g, "")}`;
const siteUrl = `${siteOrigin}${siteBasePath}`;
const siteRootPath = `${siteBasePath || ""}/`;
const buildDate = new Date().toISOString().slice(0, 10);
const legacyLandingRedirects = [
  ["/read", "/stati/"],
  ["/read/page-article/page-books", "/stati/mnenie-o-knige/"],
  ["/read/page-article/page-bookvsmovie", "/stati/kniga-i-ekranizatsiya/"],
  ["/read/page-article/page-writers-world", "/stati/pisateli-mira/"],
  ["/read/page-article/knigniy-gid", "/stati/knizhnyy-gid/"],
  ["/read/page-article/topbooks", "/stati/knizhnyy-gid/"],
  ["/read/page-article/famous_prizes", "/stati/literaturnye-premii/"],
  ["/read/page-article/nobel-prize", "/stati/literaturnye-premii/"],
  ["/read/page-article/folklore", "/stati/folklor-i-mifologiya/"],
  ["/read/page-words", "/stati/russkiy-yazyk/"],
  ["/read/page-stories", "/stati/literaturnye-istorii/"],
  ["/contacts", "/#about"],
];

const sectionEditorialDescriptions = Object.freeze({
  "book-opinions":
    "Редакционные мнения о классических и современных книгах: история создания, контекст, особенности текста и впечатления после чтения.",
  "screen-adaptations":
    "Сравнения литературных произведений и их экранизаций: сюжетные изменения, режиссёрские решения и сохранение авторского замысла.",
  "writers-world":
    "Биографии и творческие маршруты писателей разных стран, литературные традиции и авторы, повлиявшие на мировую культуру.",
  "book-guides":
    "Тематические подборки и книжные маршруты по классике и современной литературе с редакционными пояснениями.",
  awards:
    "История литературных премий, правила отбора, важные лауреаты и книги, отмеченные международными и национальными наградами.",
  folklore:
    "Материалы о фольклоре, мифологических образах, сказочных персонажах и их месте в литературной традиции разных народов.",
  language:
    "Статьи о русском языке, происхождении слов и выражений, словарном запасе и точном употреблении литературной речи.",
  "literary-essays":
    "Редакционные эссе о литературе, чтении, культурной памяти и роли книг в жизни человека и общества.",
  "author-stories":
    "Литературные истории и авторские тексты журнала «Проба Пера» о чтении, творчестве и личном опыте.",
});

function xmlEscape(value = "") {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function cdata(value = "") {
  return `<![CDATA[${String(value).replaceAll("]]>", "]]]]><![CDATA[>")}]]>`;
}

function conciseMetaDescription(value, fallback, maxLength = 200) {
  const normalize = (text) =>
    String(text || "")
      .replace(/<[^>]*>/gu, " ")
      .replace(/\s+/gu, " ")
      .trim();
  const normalizedValue = normalize(value);
  const normalizedFallback = normalize(fallback);
  const description =
    normalizedValue.length >= 40
      ? normalizedValue
      : normalize(`${normalizedValue} ${normalizedFallback}`) || normalizedFallback;

  if (description.length <= maxLength) return description;

  const candidate = description.slice(0, maxLength - 1).trimEnd();
  const sentenceEnd = Math.max(
    candidate.lastIndexOf(". "),
    candidate.lastIndexOf("! "),
    candidate.lastIndexOf("? ")
  );
  if (sentenceEnd >= 90) return candidate.slice(0, sentenceEnd + 1);

  const wordEnd = candidate.lastIndexOf(" ");
  const clipped = (wordEnd >= 90 ? candidate.slice(0, wordEnd) : candidate)
    .replace(/[,:;–—-]+$/u, "")
    .trimEnd();
  return `${clipped}…`;
}

function metadataIdentity(value = "") {
  return String(value)
    .toLocaleLowerCase("ru")
    .replaceAll("ё", "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function uniqueMetaDescription({
  preferred,
  title,
  visibleText,
  fallback,
  usedDescriptions,
}) {
  const candidates = [
    conciseMetaDescription(preferred, fallback),
    conciseMetaDescription(`${title}. ${visibleText}`, fallback),
    conciseMetaDescription(
      `Материал литературного журнала «Проба Пера»: ${title}. ${visibleText}`,
      fallback
    ),
  ];
  const selected =
    candidates.find((candidate) => !usedDescriptions.has(metadataIdentity(candidate))) ||
    conciseMetaDescription(`${title}. ${fallback}`, fallback);
  usedDescriptions.add(metadataIdentity(selected));
  return selected;
}

const russianMonthNumbers = new Map([
  ["января", 1], ["январь", 1],
  ["февраля", 2], ["февраль", 2],
  ["марта", 3], ["март", 3],
  ["апреля", 4], ["апрель", 4],
  ["мая", 5], ["май", 5],
  ["июня", 6], ["июнь", 6],
  ["июля", 7], ["июль", 7],
  ["августа", 8], ["август", 8],
  ["сентября", 9], ["сентябрь", 9],
  ["октября", 10], ["октябрь", 10],
  ["ноября", 11], ["ноябрь", 11],
  ["декабря", 12], ["декабрь", 12],
]);

function dateOnly(value) {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : "";
}

function dateFromPublicationLabel(value = "") {
  const normalized = String(value).toLocaleLowerCase("ru").replaceAll("ё", "е");
  const russian = normalized.match(
    /(?:опубликовано\s*:\s*)?(\d{1,2})\s+([а-я]+)\s+(\d{4})/u
  );
  if (russian) {
    const month = russianMonthNumbers.get(russian[2]);
    const day = Number.parseInt(russian[1], 10);
    const year = Number.parseInt(russian[3], 10);
    if (month && day >= 1 && day <= 31 && year >= 1990 && year <= 2200) {
      return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  const english = normalized.match(
    /(?:published\s*:\s*)?(\d{1,2})\s+([a-z]+)\s+(\d{4})/u
  );
  return english ? dateOnly(`${english[1]} ${english[2]} ${english[3]} UTC`) : "";
}

function articlePublishedDate(article) {
  return dateOnly(article.publishedAt) || dateFromPublicationLabel(article.publishedLabel);
}

function articleModifiedDate(article) {
  return dateOnly(article.updatedAt) || articlePublishedDate(article);
}

function sitemapEntryXml({ url, lastmod }) {
  const modified = lastmod ? `<lastmod>${lastmod}</lastmod>` : "";
  return `  <url><loc>${xmlEscape(url)}</loc>${modified}</url>`;
}

function pagePublicPath(page) {
  return `/stranitsy/${page.slug}`;
}

function safeArticleHtml(contentHtml = "") {
  const $ = load(`<main id="article-source">${contentHtml}</main>`, {
    decodeEntities: false,
  });
  $("script,style,iframe,object,embed,form,input,button,textarea,select,link,meta").remove();
  $("#article-source *").each((_index, element) => {
    const attributes = Object.keys(element.attribs || {});
    for (const attribute of attributes) {
      if (
        attribute.startsWith("on") ||
        !["alt", "height", "href", "id", "loading", "src", "title", "width"].includes(attribute)
      ) {
        $(element).removeAttr(attribute);
      }
    }
    for (const attribute of ["href", "src"]) {
      const value = $(element).attr(attribute);
      if (value && !/^(https?:\/\/|\/|#)/i.test(value.trim())) {
        $(element).removeAttr(attribute);
      }
    }
  });
  return $("#article-source").html() || "";
}

function canonicalizeInternalArticleLinks(contentHtml, canonicalByLegacyPath) {
  const $ = load(`<main id="canonical-article-source">${contentHtml}</main>`, {
    decodeEntities: false,
  });
  $("#canonical-article-source a[href]").each((_index, element) => {
    const href = $(element).attr("href")?.trim() || "";
    if (!href || href.startsWith("#")) return;
    let parsed;
    try {
      parsed = new URL(href, `${siteUrl}/`);
    } catch {
      return;
    }
    if (
      parsed.origin !== siteOrigin &&
      !["probpera.ru", "www.probpera.ru"].includes(parsed.hostname)
    ) {
      return;
    }
    const canonicalUrl = canonicalByLegacyPath.get(normalizedPath(parsed.pathname));
    if (!canonicalUrl) return;
    $(element).attr("href", `${canonicalUrl}${parsed.hash || ""}`);
  });
  return $("#canonical-article-source").html() || "";
}

function loadStaticDocument(html) {
  const $ = load(html, { decodeEntities: false });
  $('meta[property="og:url"]').remove();
  $('script[type="application/ld+json"]').remove();
  return $;
}

function redirectHtml(targetUrl) {
  return `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="robots" content="noindex,follow">
<link rel="canonical" href="${targetUrl}"><meta http-equiv="refresh" content="0;url=${targetUrl}">
<title>Материал переехал — Проба Пера</title></head>
<body><p>Материал переехал: <a href="${targetUrl}">открыть постоянный адрес</a>.</p>
<script>location.replace(${JSON.stringify(targetUrl)});</script></body></html>`;
}

async function readJsonIfExists(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
}

function mergeCatalogs(legacyArticles, cmsArticles) {
  const replacedIds = new Set(
    cmsArticles.map((article) => article.legacyId).filter(Boolean)
  );
  const replacedPaths = new Set(
    cmsArticles.map((article) => normalizedPath(article.legacyPath)).filter(Boolean)
  );
  return [
    ...cmsArticles,
    ...legacyArticles.filter(
      (article) =>
        !replacedIds.has(article.id) &&
        !replacedPaths.has(normalizedPath(article.url))
    ),
  ];
}

async function writeRedirectPage(sourcePath, targetUrl) {
  const normalized = normalizedPath(sourcePath);
  const segments = normalized
    .split("/")
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment));
  if (segments.some((segment) => segment === "." || segment === "..")) return;

  const finalSegment = segments.at(-1) || "";
  if (/\.[a-z0-9]{1,8}$/iu.test(finalSegment)) {
    const outputPath = path.join(distDirectory, ...segments);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, redirectHtml(targetUrl), "utf8");
    return;
  }

  const outputDirectory = path.join(distDirectory, ...segments);
  await fs.mkdir(outputDirectory, { recursive: true });
  await fs.writeFile(
    path.join(outputDirectory, "index.html"),
    redirectHtml(targetUrl),
    "utf8"
  );
}

const baseHtml = await fs.readFile(path.join(distDirectory, "index.html"), "utf8");
const legacyCatalog = JSON.parse(
  await fs.readFile(path.join(articleDirectory, "index.json"), "utf8")
);
const cmsSnapshot = await readJsonIfExists(
  path.join(publicDirectory, "cms", "published-content.json"),
  { articles: [], pages: [], redirects: [] }
);
const catalog = mergeCatalogs(legacyCatalog, cmsSnapshot.articles || []).map(
  applyEditorialPublicationFix
);
const canonicalArticlePaths = new Set(
  catalog.map((article) => normalizedPath(articlePublicPath(article)))
);
const canonicalByLegacyPath = new Map();
for (const article of catalog) {
  const canonicalUrl =
    article.canonicalUrl || `${siteUrl}${articlePublicPath(article)}/`;
  for (const candidate of [article.url, article.legacyPath]) {
    const candidatePath = normalizedPath(candidate);
    if (candidatePath) canonicalByLegacyPath.set(candidatePath, canonicalUrl);
  }
}
const cloudAtlasCanonical = canonicalByLegacyPath.get(
  "/read/page-article/page-books/7"
);
if (cloudAtlasCanonical) {
  canonicalByLegacyPath.set("/read/page-books/7", cloudAtlasCanonical);
}
const routeSlugOwners = new Map();
for (const article of catalog) {
  const slug = articleRouteSlug(article);
  const owners = routeSlugOwners.get(slug) || new Set();
  owners.add(article.id);
  routeSlugOwners.set(slug, owners);
}
const indexableCatalog = catalog.filter(
  (article) => article.allowIndexing !== false
);
const articlesBySection = new Map();
for (const article of indexableCatalog) {
  const sectionArticles = articlesBySection.get(article.sectionId) || [];
  sectionArticles.push(article);
  articlesBySection.set(article.sectionId, sectionArticles);
}
const archiveSections = Object.keys(articleSectionSlugs)
  .map((sectionId) => ({
    id: sectionId,
    slug: articleSectionSlug(sectionId),
    label:
      articlesBySection.get(sectionId)?.[0]?.sectionLabel ||
      sectionId,
    articles: articlesBySection.get(sectionId) || [],
  }))
  .filter((section) => section.articles.length > 0);
const homeDocument = loadStaticDocument(baseHtml);
homeDocument('link[rel="canonical"]').attr("href", `${siteUrl}/`);
homeDocument('link[rel="alternate"][type="application/rss+xml"]').attr("href", `${siteUrl}/rss.xml`);
homeDocument('meta[property="og:image"]').attr("content", `${siteUrl}/og-v3.webp`);
homeDocument('meta[name="twitter:image"]').attr("content", `${siteUrl}/og-v3.webp`);
homeDocument("head").append(`<meta property="og:url" content="${siteUrl}/">`);
homeDocument("head").append(
  `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: "Проба Пера",
        url: `${siteUrl}/`,
        logo: {
          "@id": `${siteUrl}/#logo`,
        },
      },
      {
        "@type": "ImageObject",
        "@id": `${siteUrl}/#logo`,
        url: `${siteUrl}/brand/probpera-logo.png`,
        contentUrl: `${siteUrl}/brand/probpera-logo.png`,
        width: 500,
        height: 500,
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        name: "Проба Пера",
        alternateName: "Проба Пера — литературный журнал",
        url: `${siteUrl}/`,
        inLanguage: "ru-RU",
        publisher: { "@id": `${siteUrl}/#organization` },
      },
      {
        "@type": "Periodical",
        "@id": `${siteUrl}/#periodical`,
        name: "Проба Пера",
        url: `${siteUrl}/stati/`,
        inLanguage: "ru-RU",
        publisher: { "@id": `${siteUrl}/#organization` },
      },
    ],
  }).replaceAll("<", "\\u003c")}</script>`
);
const latestIndexableArticles = indexableCatalog.slice(0, 12);
homeDocument("#root").html(`
  <main class="static-article-fallback static-home-fallback" data-static-seo>
    <article>
      <span>Литературный журнал и энциклопедия</span>
      <h1>Проба Пера — статьи о книгах, писателях и мировой литературе</h1>
      <p>Авторский литературный журнал, книжный архив, биографии писателей и интерактивная энциклопедия стран собраны в одном редакционном пространстве.</p>
      <nav aria-label="Основные разделы">
        <a href="${siteBasePath || ""}/stati/">Читать журнал</a>
        <a href="${siteBasePath || ""}/#atlas">Открыть литературную карту мира</a>
        <a href="${siteBasePath || ""}/#books">Перейти к книжному архиву</a>
      </nav>
      <nav aria-label="Рубрики журнала">
        <ul>
          ${archiveSections.map((section) => `
            <li><a href="${siteBasePath || ""}${articleSectionArchivePath(section.id)}/">${xmlEscape(section.label)}</a> — ${section.articles.length}</li>
          `).join("\n")}
        </ul>
      </nav>
      <section aria-labelledby="latest-publications-static">
        <h2 id="latest-publications-static">Новые публикации</h2>
        <ul>
          ${latestIndexableArticles.map((article) => {
            const href = article.canonicalUrl || `${siteUrl}${articlePublicPath(article)}/`;
            return `<li><a href="${xmlEscape(href)}">${xmlEscape(article.title)}</a></li>`;
          }).join("\n")}
        </ul>
      </section>
    </article>
  </main>
`);
await fs.writeFile(path.join(distDirectory, "index.html"), homeDocument.html(), "utf8");

const sitemapEntries = [{ url: `${siteUrl}/`, lastmod: buildDate }];
const redirectRules = [];
const rssEntries = [];
let staticSectionAliases = 0;
const usedMetaDescriptions = new Set([
  metadataIdentity(
    homeDocument('meta[name="description"]').attr("content") || ""
  ),
]);

function latestArchiveDate(articles) {
  return articles
    .map(articleModifiedDate)
    .filter(Boolean)
    .sort()
    .at(-1) || buildDate;
}

async function writeArticleArchivePage(section = null) {
  const archiveArticles = section?.articles || indexableCatalog;
  const archivePath = articleSectionArchivePath(section?.id);
  const canonicalUrl = `${siteUrl}${archivePath}/`;
  const label = section?.label || "Все публикации";
  const title = section
    ? `${label} — статьи литературного журнала`
    : "Все статьи литературного журнала";
  const preferredDescription = section
    ? sectionEditorialDescriptions[section.id]
    : "Полный архив литературного журнала «Проба Пера»: статьи о книгах, писателях, экранизациях, премиях, фольклоре, культуре и русском языке.";
  const description = uniqueMetaDescription({
    preferred: preferredDescription,
    title,
    visibleText: archiveArticles.slice(0, 4).map((article) => article.title).join(". "),
    fallback: `Редакционный архив «Проба Пера»: ${label}`,
    usedDescriptions: usedMetaDescriptions,
  });
  const $ = loadStaticDocument(baseHtml);
  $("title").text(`${title} — Проба Пера`);
  $('meta[name="description"]').attr("content", description);
  $('meta[property="og:type"]').attr("content", "website");
  $('meta[property="og:title"]').attr("content", title);
  $('meta[property="og:description"]').attr("content", description);
  $('meta[property="og:image"]').attr("content", `${siteUrl}/og-v3.webp`);
  $('meta[property="og:image:alt"]').attr(
    "content",
    `Литературный журнал «Проба Пера»: ${label}`
  );
  $('meta[name="twitter:title"]').attr("content", title);
  $('meta[name="twitter:description"]').attr("content", description);
  $('meta[name="twitter:image"]').attr("content", `${siteUrl}/og-v3.webp`);
  $('meta[name="twitter:image:alt"]').attr(
    "content",
    `Литературный журнал «Проба Пера»: ${label}`
  );
  $('link[rel="canonical"]').attr("href", canonicalUrl);
  $("head").append(`<meta property="og:url" content="${canonicalUrl}">`);
  $("head").append(
    `<script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          "@id": `${siteUrl}/#organization`,
          name: "Проба Пера",
          url: `${siteUrl}/`,
          logo: { "@id": `${siteUrl}/#logo` },
        },
        {
          "@type": "WebSite",
          "@id": `${siteUrl}/#website`,
          name: "Проба Пера",
          alternateName: "Проба Пера — литературный журнал",
          url: `${siteUrl}/`,
          inLanguage: "ru-RU",
          publisher: { "@id": `${siteUrl}/#organization` },
        },
        {
          "@type": "CollectionPage",
          "@id": canonicalUrl,
          url: canonicalUrl,
          name: title,
          description,
          inLanguage: "ru-RU",
          isPartOf: { "@id": `${siteUrl}/#website` },
          breadcrumb: { "@id": `${canonicalUrl}#breadcrumb` },
          mainEntity: { "@id": `${canonicalUrl}#articles` },
        },
        {
          "@type": "ItemList",
          "@id": `${canonicalUrl}#articles`,
          name: label,
          numberOfItems: archiveArticles.length,
          itemListElement: archiveArticles.map((article, index) => ({
            "@type": "ListItem",
            position: index + 1,
            url:
              article.canonicalUrl ||
              `${siteUrl}${articlePublicPath(article)}/`,
          })),
        },
        {
          "@type": "BreadcrumbList",
          "@id": `${canonicalUrl}#breadcrumb`,
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "Проба Пера",
              item: `${siteUrl}/`,
            },
            {
              "@type": "ListItem",
              position: 2,
              name: section ? "Журнал" : label,
              item: `${siteUrl}${articleSectionArchivePath()}/`,
            },
            ...(section
              ? [
                  {
                    "@type": "ListItem",
                    position: 3,
                    name: label,
                    item: canonicalUrl,
                  },
                ]
              : []),
          ],
        },
      ],
    }).replaceAll("<", "\\u003c")}</script>`
  );
  $('script[type="module"],link[rel="modulepreload"]').remove();
  $("#root").html(`
    <main class="static-article-fallback static-home-fallback" data-static-seo>
      <article>
        <nav aria-label="Хлебные крошки">
          <a href="${siteBasePath || ""}/">Проба Пера</a>
          ${section ? ` · <a href="${siteBasePath || ""}/stati/">Журнал</a>` : ""}
        </nav>
        <span>Литературный журнал</span>
        <h1>${xmlEscape(title)}</h1>
        <p>${xmlEscape(description)}</p>
        <nav aria-label="Рубрики журнала">
          <ul>
            <li><a href="${siteBasePath || ""}/stati/">Все публикации</a> — ${indexableCatalog.length}</li>
            ${archiveSections.map((item) => `
              <li><a href="${siteBasePath || ""}${articleSectionArchivePath(item.id)}/">${xmlEscape(item.label)}</a> — ${item.articles.length}</li>
            `).join("\n")}
          </ul>
        </nav>
        <section aria-labelledby="archive-publications">
          <h2 id="archive-publications">${xmlEscape(label)}</h2>
          <ol>
            ${archiveArticles.map((article) => {
              const href =
                article.canonicalUrl || `${siteUrl}${articlePublicPath(article)}/`;
              return `<li>
                <a href="${xmlEscape(href)}">${xmlEscape(article.title)}</a>
              </li>`;
            }).join("\n")}
          </ol>
        </section>
        <p><a href="${siteBasePath || ""}/#journal">Открыть интерактивную витрину журнала</a></p>
      </article>
    </main>
  `);
  const targetDirectory = path.join(
    distDirectory,
    ...archivePath.split("/").filter(Boolean)
  );
  await fs.mkdir(targetDirectory, { recursive: true });
  await fs.writeFile(path.join(targetDirectory, "index.html"), $.html(), "utf8");
  sitemapEntries.push({
    url: canonicalUrl,
    lastmod: latestArchiveDate(archiveArticles),
  });
}

await writeArticleArchivePage();
for (const section of archiveSections) {
  await writeArticleArchivePage(section);
}

for (const [source, destination] of legacyLandingRedirects) {
  const targetUrl = `${siteUrl}${destination}`;
  redirectRules.push({ source, destination, permanent: true });
  await writeRedirectPage(source, targetUrl);
}

for (const rawArticle of catalog) {
  const article = normalizeArticlePublicMetadata(rawArticle);
  const documentPath =
    article.documentPath || `articles/${encodeURIComponent(article.id)}.json`;
  const document = applyEditorialPublicationFix(JSON.parse(
    await fs.readFile(
      path.join(publicDirectory, ...documentPath.split("/")),
      "utf8"
    )
  ));
  const slug = articleRouteSlug(article);
  const publicPath = articlePublicPath(article);
  const canonicalUrl = article.canonicalUrl || `${siteUrl}${publicPath}/`;
  const $ = loadStaticDocument(baseHtml);
  $('link[rel="modulepreload"]').filter((_index, element) =>
    !/react-vendor/u.test($(element).attr("href") || "")
  ).remove();
  const descriptionFallback =
    `Авторский материал литературного журнала «Проба Пера»: ${article.title}`;
  const preferredDescription = article.seoDescription || article.description;
  const description = uniqueMetaDescription({
    preferred: preferredDescription,
    title: article.title,
    visibleText: document.plainText || "",
    fallback: descriptionFallback,
    usedDescriptions: usedMetaDescriptions,
  });
  const imageUrl = article.imageUrl || `${siteUrl}/og-v3.webp`;
  const socialTitle = article.ogTitle || article.title;
  const socialDescription =
    !article.ogDescription ||
    metadataIdentity(article.ogDescription) === metadataIdentity(preferredDescription)
      ? description
      : conciseMetaDescription(article.ogDescription, description);
  const socialImageUrl = article.ogImageUrl || imageUrl;
  const publishedDate = articlePublishedDate(article);
  const modifiedDate = articleModifiedDate(article);
  const safePublicBody = canonicalizeInternalArticleLinks(
    safeArticleHtml(document.contentHtml),
    canonicalByLegacyPath
  );
  const dzenCover = dzenCoverForArticle({
    title: article.title,
    // Select before the RSS sanitizer removes editorial classes/ARIA that
    // identify decorative or hidden media. The chosen URL is still required
    // to be a safe HTTPS image by dzenCoverForArticle.
    content_html: document.contentHtml,
    cover_external_url: article.dzenImageUrl || socialImageUrl,
    cover_alt: article.dzenImageAlt || article.imageAlt,
  });

  rssEntries.push({
    ...article,
    articleUrl: canonicalUrl,
    description,
    imageUrl: dzenCover?.url,
    imageAlt: dzenCover?.alt || article.imageAlt,
    contentHtml: positionDzenLeadIllustration(safePublicBody, dzenCover),
  });

  $("title").text(`${article.seoTitle || article.title} — Проба Пера`);
  $('meta[name="description"]').attr("content", description);
  if (article.seoKeywords?.length) {
    $("head").append(
      `<meta name="keywords" content="${xmlEscape(article.seoKeywords.join(", "))}">`
    );
  }
  $('meta[property="og:type"]').attr("content", "article");
  $('meta[property="og:title"]').attr("content", socialTitle);
  $('meta[property="og:description"]').attr("content", socialDescription);
  $('meta[property="og:image"]').attr("content", socialImageUrl);
  $('meta[property="og:image:alt"]').attr(
    "content",
    article.imageAlt || article.title
  );
  $('meta[name="twitter:title"]').attr("content", socialTitle);
  $('meta[name="twitter:description"]').attr("content", socialDescription);
  $('meta[name="twitter:image"]').attr("content", socialImageUrl);
  $('meta[name="twitter:image:alt"]').attr(
    "content",
    article.imageAlt || article.title
  );
  $('link[rel="canonical"]').attr("href", canonicalUrl);
  if (article.allowIndexing === false) {
    $('meta[name="robots"]').attr("content", "noindex,follow");
  }
  $("head").append(`<meta property="og:url" content="${canonicalUrl}">`);
  if (publishedDate) {
    $("head").append(
      `<meta property="article:published_time" content="${publishedDate}">`
    );
  }
  if (modifiedDate) {
    $("head").append(
      `<meta property="article:modified_time" content="${modifiedDate}">`
    );
  }
  $("head").append(
    `<meta property="article:section" content="${xmlEscape(article.sectionLabel)}">`
  );
  const sectionArchiveUrl =
    `${siteUrl}${articleSectionArchivePath(article.sectionId)}/`;
  const relatedArticles = [
    ...(articlesBySection.get(article.sectionId) || []),
    ...indexableCatalog,
  ]
    .filter((candidate, index, candidates) =>
      candidate.id !== article.id &&
      candidates.findIndex((item) => item.id === candidate.id) === index
    )
    .slice(0, 3);
  $("head").append(
    `<script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          "@id": `${siteUrl}/#organization`,
          name: "Проба Пера",
          url: `${siteUrl}/`,
          logo: {
            "@type": "ImageObject",
            url: `${siteUrl}/brand/probpera-logo.png`,
            width: 500,
            height: 500,
          },
        },
        {
          "@type": "WebPage",
          "@id": canonicalUrl,
          url: canonicalUrl,
          name: article.title,
          inLanguage: "ru-RU",
          breadcrumb: { "@id": `${canonicalUrl}#breadcrumb` },
          primaryImageOfPage: { "@id": `${canonicalUrl}#primaryimage` },
          mainEntity: { "@id": `${canonicalUrl}#article` },
        },
        {
          "@type": "Article",
          "@id": `${canonicalUrl}#article`,
          headline: article.title,
          description,
          image: [{ "@id": `${canonicalUrl}#primaryimage` }],
          mainEntityOfPage: { "@id": canonicalUrl },
          inLanguage: "ru-RU",
          datePublished: article.publishedAt || publishedDate || undefined,
          dateModified: article.updatedAt || modifiedDate || undefined,
          wordCount: article.wordCount,
          articleSection: article.sectionLabel,
          author: { "@id": `${siteUrl}/#organization` },
          publisher: { "@id": `${siteUrl}/#organization` },
        },
        {
          "@type": "ImageObject",
          "@id": `${canonicalUrl}#primaryimage`,
          url: imageUrl,
        },
        {
          "@type": "BreadcrumbList",
          "@id": `${canonicalUrl}#breadcrumb`,
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Проба Пера", item: `${siteUrl}/` },
            { "@type": "ListItem", position: 2, name: "Журнал", item: `${siteUrl}${articleSectionArchivePath()}/` },
            { "@type": "ListItem", position: 3, name: article.sectionLabel, item: sectionArchiveUrl },
            { "@type": "ListItem", position: 4, name: article.title, item: canonicalUrl },
          ],
        },
      ],
    }).replaceAll("<", "\\u003c")}</script>`
  );

  $("#root").html(`
    <main class="static-article-fallback">
      <nav aria-label="Хлебные крошки">
        <a href="${siteBasePath || ""}/">Проба Пера</a> ·
        <a href="${siteBasePath || ""}/stati/">Журнал</a> ·
        <a href="${siteBasePath || ""}${articleSectionArchivePath(article.sectionId)}/">${xmlEscape(article.sectionLabel)}</a>
      </nav>
      <article>
        <span>${xmlEscape(article.sectionLabel)}</span>
        <h1>${xmlEscape(article.title)}</h1>
        <p>${xmlEscape(description)}</p>
        ${safePublicBody}
      </article>
      <nav aria-label="Читайте также">
        <h2>Читайте также</h2>
        <ul>
          ${relatedArticles.map((candidate) => {
            const href =
              candidate.canonicalUrl ||
              `${siteUrl}${articlePublicPath(candidate)}/`;
            return `<li><a href="${xmlEscape(href)}">${xmlEscape(candidate.title)}</a></li>`;
          }).join("\n")}
        </ul>
      </nav>
    </main>
  `);

  const englishTranslation = article.translations?.en;
  const englishDocument = document.translations?.en;
  const englishIsReleased =
    englishTranslation &&
    englishDocument &&
    ["approved", "published"].includes(englishTranslation.translationStatus) &&
    String(englishTranslation.title || "").trim() &&
    String(englishDocument.contentHtml || "").trim() &&
    !/[\u0400-\u052f]/u.test(
      [
        englishTranslation.title,
        englishTranslation.description,
        englishDocument.contentHtml,
        englishDocument.plainText,
      ].join(" ")
    );

  const englishRouteArticle = englishIsReleased
    ? {
        ...article,
        title: englishTranslation.title,
        slug: englishTranslation.slug,
      }
    : null;
  const englishSlug = englishRouteArticle
    ? articleRouteSlug(englishRouteArticle)
    : "";
  const englishPublicPath = englishRouteArticle
    ? articlePublicPath(englishRouteArticle)
    : "";
  const englishRouteUrl = englishPublicPath
    ? `${siteUrl}${englishPublicPath}/`
    : "";
  const englishCanonicalUrl = englishRouteUrl
    ? englishTranslation.canonicalUrl || englishRouteUrl
    : "";

  if (englishRouteUrl && englishSlug !== slug) {
    $("head").append(
      `<link rel="alternate" hreflang="ru" href="${canonicalUrl}">`
    );
    $("head").append(
      `<link rel="alternate" hreflang="en" href="${englishCanonicalUrl}">`
    );
    $("head").append(
      `<link rel="alternate" hreflang="x-default" href="${canonicalUrl}">`
    );
  }

  const targetDirectory = path.join(
    distDirectory,
    "stati",
    articleSectionSlug(article),
    slug
  );
  await fs.mkdir(targetDirectory, { recursive: true });
  await fs.writeFile(path.join(targetDirectory, "index.html"), $.html(), "utf8");

  if (routeSlugOwners.get(slug)?.size === 1) {
    for (const sectionSlug of Object.values(articleSectionSlugs)) {
      const aliasPath = `/stati/${sectionSlug}/${slug}`;
      if (
        normalizedPath(aliasPath) === normalizedPath(publicPath) ||
        canonicalArticlePaths.has(normalizedPath(aliasPath))
      ) {
        continue;
      }
      redirectRules.push({
        source: aliasPath,
        destination: publicPath,
        permanent: true,
        server: false,
        reason: "section-alias",
      });
      await writeRedirectPage(aliasPath, canonicalUrl);
      staticSectionAliases += 1;
    }
  }

  if (englishIsReleased) {
    if (englishSlug !== slug) {
      const englishPreferredDescription =
        englishTranslation.seoDescription ||
        englishTranslation.description ||
        englishDocument.plainText;
      const englishDescription = uniqueMetaDescription({
        preferred: englishPreferredDescription,
        title: englishTranslation.title,
        visibleText: englishDocument.plainText || "",
        fallback:
          `An original PROBA PERA literary journal article: ${englishTranslation.title}`,
        usedDescriptions: usedMetaDescriptions,
      });
      const englishImageUrl = article.imageUrl || `${siteUrl}/og-v3.webp`;
      const englishSocialTitle =
        englishTranslation.ogTitle ||
        englishTranslation.seoTitle ||
        englishTranslation.title;
      const englishSocialDescription =
        !englishTranslation.ogDescription ||
        metadataIdentity(englishTranslation.ogDescription) ===
          metadataIdentity(englishPreferredDescription)
          ? englishDescription
          : conciseMetaDescription(
              englishTranslation.ogDescription,
              englishDescription
            );
      const englishDocumentPage = loadStaticDocument(baseHtml);

      englishDocumentPage("html")
        .attr("lang", "en")
        .attr("data-route-language", "en");
      englishDocumentPage("title").text(
        `${englishTranslation.seoTitle || englishTranslation.title} — PROBA PERA`
      );
      englishDocumentPage('meta[name="description"]').attr(
        "content",
        englishDescription
      );
      englishDocumentPage('meta[property="og:type"]').attr("content", "article");
      englishDocumentPage('meta[property="og:title"]').attr(
        "content",
        englishSocialTitle
      );
      englishDocumentPage('meta[property="og:description"]').attr(
        "content",
        englishSocialDescription
      );
      englishDocumentPage('meta[property="og:image"]').attr(
        "content",
        article.ogImageUrl || englishImageUrl
      );
      englishDocumentPage('meta[property="og:image:alt"]').attr(
        "content",
        englishTranslation.imageAlt || englishTranslation.title
      );
      englishDocumentPage('meta[property="og:locale"]').attr(
        "content",
        "en_US"
      );
      englishDocumentPage('meta[name="twitter:title"]').attr(
        "content",
        englishSocialTitle
      );
      englishDocumentPage('meta[name="twitter:description"]').attr(
        "content",
        englishSocialDescription
      );
      englishDocumentPage('meta[name="twitter:image"]').attr(
        "content",
        article.ogImageUrl || englishImageUrl
      );
      englishDocumentPage('meta[name="twitter:image:alt"]').attr(
        "content",
        englishTranslation.imageAlt || englishTranslation.title
      );
      englishDocumentPage('link[rel="canonical"]').attr(
        "href",
        englishCanonicalUrl
      );
      englishDocumentPage("head").append(
        `<meta property="og:url" content="${englishCanonicalUrl}">`
      );
      englishDocumentPage("head").append(
        `<link rel="alternate" hreflang="ru" href="${canonicalUrl}">`
      );
      englishDocumentPage("head").append(
        `<link rel="alternate" hreflang="en" href="${englishCanonicalUrl}">`
      );
      englishDocumentPage("head").append(
        `<link rel="alternate" hreflang="x-default" href="${canonicalUrl}">`
      );
      if (englishTranslation.seoKeywords?.length) {
        englishDocumentPage("head").append(
          `<meta name="keywords" content="${xmlEscape(
            englishTranslation.seoKeywords.join(", ")
          )}">`
        );
      }
      if (article.allowIndexing === false) {
        englishDocumentPage('meta[name="robots"]').attr(
          "content",
          "noindex,follow"
        );
      }
      englishDocumentPage("head").append(
        `<script type="application/ld+json">${JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: englishTranslation.title,
          description: englishDescription,
          image: [englishImageUrl],
          mainEntityOfPage: englishCanonicalUrl,
          inLanguage: "en",
          datePublished: englishTranslation.publishedAt || article.publishedAt || undefined,
          dateModified:
            englishTranslation.updatedAt ||
            englishTranslation.translationPublishedAt ||
            englishTranslation.approvedAt ||
            englishTranslation.publishedAt ||
            article.publishedAt ||
            undefined,
          wordCount: englishTranslation.wordCount,
          articleSection: englishTranslation.sectionLabel,
          isPartOf: {
            "@type": "Periodical",
            name: "PROBA PERA",
            url: `${siteUrl}/`,
          },
        }).replaceAll("<", "\\u003c")}</script>`
      );
      englishDocumentPage("#root").html(`
        <main class="static-article-fallback">
          <a href="${siteBasePath || ""}/#journal">← PROBA PERA journal</a>
          <article>
            <span>${xmlEscape(englishTranslation.sectionLabel || "Article")}</span>
            <h1>${xmlEscape(englishTranslation.title)}</h1>
            <p>${xmlEscape(englishDescription)}</p>
            ${safeArticleHtml(englishDocument.contentHtml)}
          </article>
        </main>
      `);

      const englishTargetDirectory = path.join(
        distDirectory,
        "stati",
        articleSectionSlug(englishRouteArticle),
        englishSlug
      );
      await fs.mkdir(englishTargetDirectory, { recursive: true });
      await fs.writeFile(
        path.join(englishTargetDirectory, "index.html"),
        englishDocumentPage.html(),
        "utf8"
      );

      if (
        article.allowIndexing !== false &&
        normalizedPath(englishCanonicalUrl) === normalizedPath(englishPublicPath)
      ) {
        sitemapEntries.push({
          url: englishRouteUrl,
          lastmod: dateOnly(
            englishTranslation.updatedAt ||
            englishTranslation.translationPublishedAt ||
            englishTranslation.approvedAt ||
            englishTranslation.publishedAt ||
            article.publishedAt
          ),
        });
      }
    }
  }

  const oldStaticDirectory = path.join(distDirectory, "articles", article.id);
  await fs.mkdir(oldStaticDirectory, { recursive: true });
  await fs.writeFile(
    path.join(oldStaticDirectory, "index.html"),
    redirectHtml(canonicalUrl),
    "utf8"
  );
  redirectRules.push({
    source: `/articles/${article.id}`,
    destination: publicPath,
    permanent: true,
  });
  if (article.legacyId) {
    const legacyStaticDirectory = path.join(
      distDirectory,
      "articles",
      article.legacyId
    );
    await fs.mkdir(legacyStaticDirectory, { recursive: true });
    await fs.writeFile(
      path.join(legacyStaticDirectory, "index.html"),
      redirectHtml(canonicalUrl),
      "utf8"
    );
    redirectRules.push({
      source: `/articles/${article.legacyId}`,
      destination: publicPath,
      permanent: true,
    });
  }
  redirectRules.push({
    source: `/articles/${slug}`,
    destination: publicPath,
    permanent: true,
  });
  if (article.sourceSlug && article.sourceSlug !== slug) {
    const previousPublicPath = `/stati/${articleSectionSlug(article)}/${article.sourceSlug}`;
    redirectRules.push({
      source: previousPublicPath,
      destination: publicPath,
      permanent: true,
    });
    await writeRedirectPage(previousPublicPath, canonicalUrl);
  }
  try {
    const legacyUrl = new URL(article.url);
    const legacySource = legacyUrl.pathname.replace(/\/+$/, "") || "/";
    if (
      legacyUrl.hostname.endsWith("probpera.ru") &&
      normalizedPath(legacySource) !== normalizedPath(publicPath)
    ) {
      redirectRules.push({
        source: legacySource,
        destination: publicPath,
        permanent: true,
      });
      await writeRedirectPage(legacySource, canonicalUrl);
    }
  } catch {
    // У материала может не быть старого абсолютного адреса.
  }
  if (
    article.legacyPath &&
    normalizedPath(article.legacyPath) !== normalizedPath(publicPath)
  ) {
    redirectRules.push({
      source: normalizedPath(article.legacyPath),
      destination: publicPath,
      permanent: true,
    });
    await writeRedirectPage(article.legacyPath, canonicalUrl);
  }
  if (article.allowIndexing !== false) {
    sitemapEntries.push({ url: canonicalUrl, lastmod: modifiedDate });
  }
}

for (const page of cmsSnapshot.pages || []) {
  if (!/^[a-z0-9][a-z0-9-]{1,119}$/u.test(page.slug || "")) continue;
  const publicPath = pagePublicPath(page);
  const canonicalUrl = page.canonicalUrl || `${siteUrl}${publicPath}/`;
  const $ = loadStaticDocument(baseHtml);
  const pageDescriptionFallback =
    `Страница литературного журнала «Проба Пера»: ${page.title}`;
  const description = uniqueMetaDescription({
    preferred: page.seoDescription || page.excerpt,
    title: page.title,
    visibleText: page.contentText || page.excerpt || "",
    fallback: pageDescriptionFallback,
    usedDescriptions: usedMetaDescriptions,
  });
  const pageImageUrl =
    page.ogImageUrl || page.imageUrl || `${siteUrl}/og-v3.webp`;
  const pageImageAlt = page.imageAlt || page.title;
  $("title").text(`${page.seoTitle || page.title} — Проба Пера`);
  $('meta[name="description"]').attr("content", description);
  $('meta[property="og:type"]').attr("content", "website");
  $('meta[property="og:title"]').attr(
    "content",
    page.seoTitle || page.title
  );
  $('meta[property="og:description"]').attr("content", description);
  $('meta[property="og:image"]').attr("content", pageImageUrl);
  $('meta[property="og:image:alt"]').attr("content", pageImageAlt);
  $('meta[name="twitter:title"]').attr(
    "content",
    page.seoTitle || page.title
  );
  $('meta[name="twitter:description"]').attr("content", description);
  $('meta[name="twitter:image"]').attr("content", pageImageUrl);
  $('meta[name="twitter:image:alt"]').attr("content", pageImageAlt);
  $('link[rel="canonical"]').attr("href", canonicalUrl);
  $("head").append(`<meta property="og:url" content="${canonicalUrl}">`);
  if (page.allowIndexing === false) {
    $('meta[name="robots"]').attr("content", "noindex,follow");
  }
  $("head").append(
    `<script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: page.title,
      description,
      url: canonicalUrl,
      inLanguage: "ru-RU",
      isPartOf: {
        "@type": "WebSite",
        name: "Проба Пера",
        url: `${siteUrl}/`,
      },
      dateModified: page.updatedAt || undefined,
    }).replaceAll("<", "\\u003c")}</script>`
  );
  $("#root").html(`
    <main class="static-article-fallback">
      <a href="${siteBasePath || ""}/">← На главную</a>
      <article>
        <span>Проба Пера</span>
        <h1>${xmlEscape(page.title)}</h1>
        ${page.excerpt ? `<p>${xmlEscape(page.excerpt)}</p>` : ""}
        ${safeArticleHtml(page.contentHtml)}
      </article>
    </main>
  `);
  const targetDirectory = path.join(
    distDirectory,
    "stranitsy",
    page.slug
  );
  await fs.mkdir(targetDirectory, { recursive: true });
  await fs.writeFile(path.join(targetDirectory, "index.html"), $.html(), "utf8");
  if (page.allowIndexing !== false) {
    sitemapEntries.push({
      url: canonicalUrl,
      lastmod: (page.updatedAt || buildDate).slice(0, 10),
    });
  }
}

for (const redirect of cmsSnapshot.redirects || []) {
  const sourcePath = normalizedPath(redirect.sourcePath);
  const destinationPath = normalizedPath(redirect.destinationPath);
  if (sourcePath === destinationPath) continue;
  const targetUrl = /^https:\/\//iu.test(redirect.destinationPath)
    ? redirect.destinationPath
    : `${siteUrl}${normalizedPath(redirect.destinationPath)}`;
  redirectRules.push({
    source: sourcePath,
    destination: redirect.destinationPath,
    permanent: [301, 308].includes(redirect.statusCode),
  });
  await writeRedirectPage(redirect.sourcePath, targetUrl);
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries
  .map(sitemapEntryXml)
  .join("\n")}
</urlset>
`;
await fs.writeFile(path.join(distDirectory, "sitemap.xml"), sitemap, "utf8");

const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:media="http://search.yahoo.com/mrss/"><channel>
  <title>Проба Пера — литературный журнал</title>
  <link>${siteUrl}/</link>
  <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml" />
  <description>Авторские статьи о книгах, писателях и мировой литературе.</description>
  <language>ru</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${rssEntries.slice(0, 40).map((article) => {
  const publishedAt = article.publishedAt
    ? new Date(article.publishedAt).toUTCString()
    : new Date().toUTCString();
  const contentHtml = article.contentHtml;
  return `  <item>
    <title>${xmlEscape(article.title)}</title><link>${article.articleUrl}</link>
    <guid isPermaLink="true">${article.articleUrl}</guid>
    <pubDate>${publishedAt}</pubDate>
    <description>${xmlEscape(article.description || "")}</description>
    <content:encoded>${cdata(contentHtml)}</content:encoded>
    ${article.imageUrl ? `<media:content url="${xmlEscape(article.imageUrl)}" medium="image" />` : ""}
    <category>${xmlEscape(article.sectionLabel)}</category>
  </item>`;
}).join("\n")}
</channel></rss>
`;
await fs.writeFile(path.join(distDirectory, "rss.xml"), rss, "utf8");
await fs.writeFile(
  path.join(distDirectory, "robots.txt"),
  `User-agent: *\nAllow: /\nDisallow: /admin/\nClean-param: utm_source&utm_medium&utm_campaign&utm_content&utm_term&yclid&gclid&fbclid\nSitemap: ${siteUrl}/sitemap.xml\n`,
  "utf8"
);
await fs.writeFile(
  path.join(distDirectory, "site.webmanifest"),
  JSON.stringify(
    {
      name: "Проба Пера — литературный журнал",
      short_name: "Проба Пера",
      description:
        "Статьи о книгах, литературная энциклопедия мира и интерактивный 3D-глобус.",
      lang: "ru-RU",
      id: siteRootPath,
      start_url: siteRootPath,
      scope: siteRootPath,
      display: "standalone",
      orientation: "any",
      background_color: "#17001f",
      theme_color: "#4b087c",
      categories: ["books", "education", "magazines"],
      shortcuts: [
        {
          name: "Литературная планета",
          short_name: "Планета",
          url: `${siteRootPath}#atlas`,
        },
        {
          name: "Статьи журнала",
          short_name: "Статьи",
          url: `${siteBasePath || ""}/stati/`,
        },
        {
          name: "Литературный календарь",
          short_name: "Календарь",
          url: `${siteRootPath}#calendar`,
        },
      ],
      icons: [
        {
          src: `${siteBasePath || ""}/brand/probpera-logo.png`,
          sizes: "500x500",
          type: "image/png",
          purpose: "any maskable",
        },
      ],
    },
    null,
    2
  ),
  "utf8"
);
await fs.writeFile(
  path.join(distDirectory, "redirects.generated.json"),
  JSON.stringify(
    [...new Map(
      redirectRules.filter(
        (redirect) =>
          normalizedPath(redirect.source) !== normalizedPath(redirect.destination)
      ).map((redirect) => [
        `${redirect.source}:${redirect.destination}`,
        redirect,
      ])
    ).values()],
    null,
    2
  ),
  "utf8"
);
const uniqueServerRedirects = [
  ...new Map(
    redirectRules.filter(
      (redirect) =>
        redirect.server !== false &&
        normalizedPath(redirect.source) !== normalizedPath(redirect.destination)
    ).map((redirect) => [
      normalizedPath(redirect.source),
      {
        source: normalizedPath(redirect.source),
        destination: redirect.destination,
      },
    ])
  ).values(),
];
await fs.writeFile(
  path.join(distDirectory, "_redirects"),
  `${uniqueServerRedirects
    .map(({ source, destination }) => `${source} ${destination} 301`)
    .join("\n")}\n`,
  "utf8"
);
await fs.writeFile(
  path.join(distDirectory, "_headers"),
  `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
  Cross-Origin-Opener-Policy: same-origin
  Strict-Transport-Security: max-age=31536000
  Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors https://admin.probpera.ru; form-action 'self'; script-src 'self' https://mc.yandex.ru https://yastatic.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://mc.yandex.ru https://mc.yandex.az https://mc.yandex.by https://mc.yandex.co.il https://mc.yandex.com https://mc.yandex.com.am https://mc.yandex.com.ge https://mc.yandex.com.tr https://mc.yandex.ee https://mc.yandex.fr https://mc.yandex.kg https://mc.yandex.kz https://mc.yandex.lt https://mc.yandex.lv https://mc.yandex.md https://mc.yandex.tj https://mc.yandex.tm https://mc.yandex.uz; media-src 'self' blob: https:; worker-src 'self' blob:; upgrade-insecure-requests

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/textures/*
  Cache-Control: public, max-age=31536000, immutable

/brand/*
  Cache-Control: public, max-age=2592000

/.well-known/security.txt
  Content-Type: text/plain; charset=utf-8
  X-Content-Type-Options: nosniff
  Cache-Control: public, max-age=86400
`,
  "utf8"
);

const notFoundDocument = loadStaticDocument(baseHtml);
notFoundDocument("title").text("Страница не найдена — Проба Пера");
notFoundDocument('meta[name="description"]').attr(
  "content",
  "Запрошенная страница не найдена. Перейдите к журналу, книжному архиву или «Литературной планете»."
);
notFoundDocument('meta[name="robots"]').attr("content", "noindex,follow");
notFoundDocument('link[rel="canonical"]').attr("href", `${siteUrl}/`);
notFoundDocument('script[type="module"]').remove();
notFoundDocument("#root").html(`
  <main class="static-article-fallback">
    <article>
      <span>Ошибка 404</span>
      <h1>Эта страница не найдена</h1>
      <p>Возможно, адрес изменился при обновлении журнала. Все прежние статьи сохранены и получили постоянные адреса.</p>
      <p><a href="${siteBasePath || ""}/stati/">Открыть журнал</a> · <a href="${siteBasePath || ""}/#atlas">Перейти к «Литературной планете»</a></p>
    </article>
  </main>
`);
await fs.writeFile(
  path.join(distDirectory, "404.html"),
  notFoundDocument.html(),
  "utf8"
);

console.log(
  `Built ${catalog.length} article pages, ${(cmsSnapshot.pages || []).length} CMS pages, ${redirectRules.length} redirects (${staticSectionAliases} portable section aliases), sitemap and RSS for ${siteUrl}.`
);
