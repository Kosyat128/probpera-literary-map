import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "cheerio";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDirectory = path.join(projectRoot, "dist");
const articleDirectory = path.join(projectRoot, "public", "articles");
const siteOrigin = "https://kosyat128.github.io";
const siteBasePath = "/probpera-literary-map";
const siteUrl = `${siteOrigin}${siteBasePath}`;

function xmlEscape(value = "") {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function safeArticleHtml(contentHtml = "") {
  const $ = load(`<main id="article-source">${contentHtml}</main>`, {
    decodeEntities: false,
  });
  $("script,style,iframe,object,embed,form,input,button,textarea,select,link,meta")
    .remove();
  $("#article-source *").each((_index, element) => {
    const attributes = Object.keys(element.attribs || {});
    for (const attribute of attributes) {
      if (
        attribute.startsWith("on") ||
        !["alt", "height", "href", "id", "loading", "src", "title", "width"].includes(
          attribute
        )
      ) {
        $(element).removeAttr(attribute);
      }
    }

    for (const attribute of ["href", "src"]) {
      const value = $(element).attr(attribute);
      if (
        value &&
        !/^(https?:\/\/|\/|#)/i.test(value.trim())
      ) {
        $(element).removeAttr(attribute);
      }
    }
  });
  return $("#article-source").html() || "";
}

const baseHtml = await fs.readFile(path.join(distDirectory, "index.html"), "utf8");
const catalog = JSON.parse(
  await fs.readFile(path.join(articleDirectory, "index.json"), "utf8")
);

for (const article of catalog) {
  const document = JSON.parse(
    await fs.readFile(path.join(articleDirectory, `${article.id}.json`), "utf8")
  );
  const canonicalUrl = `${siteUrl}/articles/${encodeURIComponent(article.id)}/`;
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
  $("head").append(
    `<meta property="og:url" content="${canonicalUrl}">`
  );
  $("head").append(
    `<script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: article.title,
      description,
      image: imageUrl,
      mainEntityOfPage: canonicalUrl,
      isPartOf: {
        "@type": "Periodical",
        name: "Проба Пера",
        url: siteUrl,
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
    }).replaceAll("<", "\\u003c")}</script>`
  );

  $("#root").html(`
    <main class="static-article-fallback">
      <a href="${siteBasePath}/#journal">← Журнал «Проба Пера»</a>
      <article>
        <span>${xmlEscape(article.sectionLabel)}</span>
        <h1>${xmlEscape(article.title)}</h1>
        <p>${xmlEscape(description)}</p>
        ${safeArticleHtml(document.contentHtml)}
      </article>
    </main>
  `);

  const targetDirectory = path.join(distDirectory, "articles", article.id);
  await fs.mkdir(targetDirectory, { recursive: true });
  await fs.writeFile(path.join(targetDirectory, "index.html"), $.html(), "utf8");
}

const sitemapEntries = [
  `${siteUrl}/`,
  ...catalog.map(
    (article) => `${siteUrl}/articles/${encodeURIComponent(article.id)}/`
  ),
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries
  .map(
    (url) => `  <url><loc>${xmlEscape(url)}</loc><lastmod>2026-07-27</lastmod></url>`
  )
  .join("\n")}
</urlset>
`;
await fs.writeFile(path.join(distDirectory, "sitemap.xml"), sitemap, "utf8");

const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Проба Пера — литературный журнал</title>
    <link>${siteUrl}/</link>
    <description>Авторские статьи о книгах, писателях и мировой литературе.</description>
    <language>ru</language>
${catalog
  .slice(0, 40)
  .map((article) => {
    const articleUrl = `${siteUrl}/articles/${encodeURIComponent(article.id)}/`;
    return `    <item>
      <title>${xmlEscape(article.title)}</title>
      <link>${articleUrl}</link>
      <guid>${articleUrl}</guid>
      <description>${xmlEscape(article.description || "")}</description>
      <category>${xmlEscape(article.sectionLabel)}</category>
    </item>`;
  })
  .join("\n")}
  </channel>
</rss>
`;
await fs.writeFile(path.join(distDirectory, "rss.xml"), rss, "utf8");
await fs.writeFile(
  path.join(distDirectory, "robots.txt"),
  `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`,
  "utf8"
);

console.log(`Built ${catalog.length} indexable article pages, sitemap and RSS.`);
