import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "cheerio";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDirectory = path.join(projectRoot, "dist");
const articleDirectory = path.join(projectRoot, "public", "articles");
const siteOrigin = (process.env.PUBLIC_SITE_ORIGIN || "https://kosyat128.github.io").replace(/\/+$/, "");
const configuredBase = process.env.PUBLIC_SITE_BASE_PATH ?? "/probpera-literary-map";
const siteBasePath =
  configuredBase === "/" ? "" : `/${configuredBase.replace(/^\/+|\/+$/g, "")}`;
const siteUrl = `${siteOrigin}${siteBasePath}`;
const buildDate = new Date().toISOString().slice(0, 10);

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
  return `${humanSlug(article.title) || "material"}-${shortStableHash(article.id)}`;
}

function articleSectionSlug(article) {
  return articleSectionSlugs[article.sectionId] || "materialy";
}

function articlePublicPath(article) {
  return `/stati/${articleSectionSlug(article)}/${articleSlug(article)}`;
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

const baseHtml = await fs.readFile(path.join(distDirectory, "index.html"), "utf8");
const catalog = JSON.parse(await fs.readFile(path.join(articleDirectory, "index.json"), "utf8"));
const homeDocument = load(baseHtml, { decodeEntities: false });
homeDocument('link[rel="canonical"]').attr("href", `${siteUrl}/`);
homeDocument('link[rel="alternate"][type="application/rss+xml"]').attr("href", `${siteUrl}/rss.xml`);
homeDocument('meta[property="og:image"],meta[name="twitter:image"]').attr("content", `${siteUrl}/og-v3.webp`);
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

for (const article of catalog) {
  const document = JSON.parse(
    await fs.readFile(path.join(articleDirectory, `${article.id}.json`), "utf8")
  );
  const slug = articleSlug(article);
  const publicPath = articlePublicPath(article);
  const canonicalUrl = `${siteUrl}${publicPath}/`;
  const $ = load(baseHtml, { decodeEntities: false });
  const description =
    article.description?.trim() ||
    `Авторский материал литературного журнала «Проба Пера»: ${article.title}`;
  const imageUrl = article.imageUrl || `${siteUrl}/og-v3.webp`;

  $("title").text(`${article.title} — Проба Пера`);
  $('meta[name="description"]').attr("content", description);
  $('meta[property="og:type"]').attr("content", "article");
  $('meta[property="og:title"]').attr("content", article.title);
  $('meta[property="og:description"]').attr("content", description);
  $('meta[property="og:image"]').attr("content", imageUrl);
  $('meta[name="twitter:title"]').attr("content", article.title);
  $('meta[name="twitter:description"]').attr("content", description);
  $('meta[name="twitter:image"]').attr("content", imageUrl);
  $('link[rel="canonical"]').attr("href", canonicalUrl);
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
    }
  } catch {
    // У материала может не быть старого абсолютного адреса.
  }
  sitemapEntries.push({ url: canonicalUrl, lastmod: buildDate });
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
  path.join(distDirectory, "redirects.generated.json"),
  JSON.stringify(redirectRules, null, 2),
  "utf8"
);

console.log(
  `Built ${catalog.length} article pages with human-readable URLs, ${redirectRules.length} redirects, sitemap and RSS for ${siteUrl}.`
);
