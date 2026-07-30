import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "cheerio";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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
  ["/read", "/#journal"],
  ["/read/page-article/page-books", "/?section=book-opinions#journal"],
  ["/read/page-article/page-bookvsmovie", "/?section=screen-adaptations#journal"],
  ["/read/page-article/page-writers-world", "/?section=writers-world#journal"],
  ["/read/page-article/knigniy-gid", "/?section=book-guides#journal"],
  ["/read/page-article/topbooks", "/?section=book-guides#journal"],
  ["/read/page-article/famous_prizes", "/?section=awards#journal"],
  ["/read/page-article/nobel-prize", "/?section=awards#journal"],
  ["/read/page-article/folklore", "/?section=folklore#journal"],
  ["/read/page-words", "/?section=language#journal"],
  ["/read/page-stories", "/?section=author-stories#journal"],
  ["/contacts", "/#about"],
];

const transliteration = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh",
  з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
  п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts",
  ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu",
  я: "ya",
};

const articleSectionSlugs = {
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

function xmlEscape(value = "") {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function shortStableHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).slice(0, 6);
}

function humanSlug(value = "") {
  return value
    .toLocaleLowerCase("ru")
    .split("")
    .map((letter) => transliteration[letter] ?? letter)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 115);
}

function articleSlug(article) {
  if (article.slug && /^[a-z0-9][a-z0-9-]{1,179}$/u.test(article.slug)) {
    return article.slug;
  }
  return `${humanSlug(article.title) || "material"}-${shortStableHash(article.id)}`;
}

function articleSectionSlug(article) {
  return articleSectionSlugs[article.sectionId] || "materialy";
}

function articlePublicPath(article) {
  return `/stati/${articleSectionSlug(article)}/${articleSlug(article)}`;
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

function normalizedPath(value = "") {
  if (!value) return "";
  try {
    return new URL(value, "https://probpera.ru").pathname.replace(/\/+$/, "") || "/";
  } catch {
    return value.split(/[?#]/u)[0].replace(/\/+$/, "") || "/";
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
const catalog = mergeCatalogs(legacyCatalog, cmsSnapshot.articles || []);
const homeDocument = load(baseHtml, { decodeEntities: false });
homeDocument('link[rel="canonical"]').attr("href", `${siteUrl}/`);
homeDocument('link[rel="alternate"][type="application/rss+xml"]').attr("href", `${siteUrl}/rss.xml`);
homeDocument('meta[property="og:image"]').attr("content", `${siteUrl}/og-v3.webp`);
homeDocument("head").append(`<meta property="og:url" content="${siteUrl}/">`);
homeDocument("head").append(
  `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Проба Пера",
    alternateName: "Проба Пера — литературный журнал",
    url: `${siteUrl}/`,
    inLanguage: "ru-RU",
    publisher: {
      "@type": "Organization",
      name: "Проба Пера",
      logo: `${siteUrl}/brand/probpera-logo.png`,
    },
  }).replaceAll("<", "\\u003c")}</script>`
);
await fs.writeFile(path.join(distDirectory, "index.html"), homeDocument.html(), "utf8");

const sitemapEntries = [{ url: `${siteUrl}/`, lastmod: buildDate }];
const redirectRules = [];

for (const [source, destination] of legacyLandingRedirects) {
  const targetUrl = `${siteUrl}${destination}`;
  redirectRules.push({ source, destination, permanent: true });
  await writeRedirectPage(source, targetUrl);
}

for (const article of catalog) {
  const documentPath =
    article.documentPath || `articles/${encodeURIComponent(article.id)}.json`;
  const document = JSON.parse(
    await fs.readFile(
      path.join(publicDirectory, ...documentPath.split("/")),
      "utf8"
    )
  );
  const slug = articleSlug(article);
  const publicPath = articlePublicPath(article);
  const canonicalUrl = article.canonicalUrl || `${siteUrl}${publicPath}/`;
  const $ = load(baseHtml, { decodeEntities: false });
  const description =
    article.seoDescription?.trim() ||
    article.description?.trim() ||
    `Авторский материал литературного журнала «Проба Пера»: ${article.title}`;
  const imageUrl = article.imageUrl || `${siteUrl}/og-v3.webp`;
  const socialTitle = article.ogTitle || article.title;
  const socialDescription = article.ogDescription || description;
  const socialImageUrl = article.ogImageUrl || imageUrl;

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
  $('link[rel="canonical"]').attr("href", canonicalUrl);
  if (article.allowIndexing === false) {
    $('meta[name="robots"]').attr("content", "noindex,follow");
  }
  $("head").append(`<meta property="og:url" content="${canonicalUrl}">`);
  $("head").append(
    `<script type="application/ld+json">${JSON.stringify([
      {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: article.title,
        description,
        image: [imageUrl],
        mainEntityOfPage: canonicalUrl,
        inLanguage: "ru-RU",
        datePublished: article.publishedAt || undefined,
        wordCount: article.wordCount,
        articleSection: article.sectionLabel,
        isPartOf: {
          "@type": "Periodical",
          name: "Проба Пера",
          url: `${siteUrl}/`,
        },
        author: {
          "@type": "Organization",
          name: "Проба Пера",
          url: "https://probpera.ru",
        },
        publisher: {
          "@type": "Organization",
          name: "Проба Пера",
          url: "https://probpera.ru",
          logo: {
            "@type": "ImageObject",
            url: `${siteUrl}/brand/probpera-logo.png`,
          },
        },
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Проба Пера", item: `${siteUrl}/` },
          { "@type": "ListItem", position: 2, name: article.sectionLabel, item: `${siteUrl}/?section=${encodeURIComponent(article.sectionId)}#journal` },
          { "@type": "ListItem", position: 3, name: article.title, item: canonicalUrl },
        ],
      },
    ]).replaceAll("<", "\\u003c")}</script>`
  );

  $("#root").html(`
    <main class="static-article-fallback">
      <a href="${siteBasePath || ""}/#journal">← Журнал «Проба Пера»</a>
      <article>
        <span>${xmlEscape(article.sectionLabel)}</span>
        <h1>${xmlEscape(article.title)}</h1>
        <p>${xmlEscape(description)}</p>
        ${safeArticleHtml(document.contentHtml)}
      </article>
    </main>
  `);

  const targetDirectory = path.join(
    distDirectory,
    "stati",
    articleSectionSlug(article),
    slug
  );
  await fs.mkdir(targetDirectory, { recursive: true });
  await fs.writeFile(path.join(targetDirectory, "index.html"), $.html(), "utf8");

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
  try {
    const legacyUrl = new URL(article.url);
    if (legacyUrl.hostname.endsWith("probpera.ru")) {
      redirectRules.push({
        source: legacyUrl.pathname.replace(/\/+$/, "") || "/",
        destination: publicPath,
        permanent: true,
      });
      await writeRedirectPage(legacyUrl.pathname, canonicalUrl);
    }
  } catch {
    // У материала может не быть старого абсолютного адреса.
  }
  if (article.legacyPath) {
    redirectRules.push({
      source: normalizedPath(article.legacyPath),
      destination: publicPath,
      permanent: true,
    });
    await writeRedirectPage(article.legacyPath, canonicalUrl);
  }
  sitemapEntries.push({ url: canonicalUrl, lastmod: buildDate });
}

for (const page of cmsSnapshot.pages || []) {
  if (!/^[a-z0-9][a-z0-9-]{1,119}$/u.test(page.slug || "")) continue;
  const publicPath = pagePublicPath(page);
  const canonicalUrl = page.canonicalUrl || `${siteUrl}${publicPath}/`;
  const $ = load(baseHtml, { decodeEntities: false });
  const description =
    page.seoDescription?.trim() ||
    page.excerpt?.trim() ||
    `Страница литературного журнала «Проба Пера»: ${page.title}`;
  $("title").text(`${page.seoTitle || page.title} — Проба Пера`);
  $('meta[name="description"]').attr("content", description);
  $('meta[property="og:type"]').attr("content", "website");
  $('meta[property="og:title"]').attr(
    "content",
    page.seoTitle || page.title
  );
  $('meta[property="og:description"]').attr("content", description);
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
  const targetUrl = /^https:\/\//iu.test(redirect.destinationPath)
    ? redirect.destinationPath
    : `${siteUrl}${normalizedPath(redirect.destinationPath)}`;
  redirectRules.push({
    source: normalizedPath(redirect.sourcePath),
    destination: redirect.destinationPath,
    permanent: [301, 308].includes(redirect.statusCode),
  });
  await writeRedirectPage(redirect.sourcePath, targetUrl);
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries
  .map(({ url, lastmod }) => `  <url><loc>${xmlEscape(url)}</loc><lastmod>${lastmod}</lastmod></url>`)
  .join("\n")}
</urlset>
`;
await fs.writeFile(path.join(distDirectory, "sitemap.xml"), sitemap, "utf8");

const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>Проба Пера — литературный журнал</title>
  <link>${siteUrl}/</link>
  <description>Авторские статьи о книгах, писателях и мировой литературе.</description>
  <language>ru</language>
${catalog.slice(0, 40).map((article) => {
  const articleUrl = `${siteUrl}${articlePublicPath(article)}/`;
  return `  <item>
    <title>${xmlEscape(article.title)}</title><link>${articleUrl}</link>
    <guid isPermaLink="true">${articleUrl}</guid>
    <description>${xmlEscape(article.description || "")}</description>
    <category>${xmlEscape(article.sectionLabel)}</category>
  </item>`;
}).join("\n")}
</channel></rss>
`;
await fs.writeFile(path.join(distDirectory, "rss.xml"), rss, "utf8");
await fs.writeFile(
  path.join(distDirectory, "robots.txt"),
  `User-agent: *\nAllow: /\nDisallow: /admin/\nSitemap: ${siteUrl}/sitemap.xml\n`,
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
      background_color: "#17001f",
      theme_color: "#4b087c",
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
      redirectRules.map((redirect) => [
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
    redirectRules.map((redirect) => [
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

const notFoundDocument = load(baseHtml, { decodeEntities: false });
notFoundDocument("title").text("Страница не найдена — Проба Пера");
notFoundDocument('meta[name="description"]').attr(
  "content",
  "Запрошенная страница не найдена. Перейдите к журналу, книжному архиву или литературной карте мира."
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
      <p><a href="${siteBasePath || ""}/#journal">Открыть журнал</a> · <a href="${siteBasePath || ""}/#atlas">Перейти к литературной карте</a></p>
    </article>
  </main>
`);
await fs.writeFile(
  path.join(distDirectory, "404.html"),
  notFoundDocument.html(),
  "utf8"
);

console.log(
  `Built ${catalog.length} article pages, ${(cmsSnapshot.pages || []).length} CMS pages, ${redirectRules.length} redirects, sitemap and RSS for ${siteUrl}.`
);
