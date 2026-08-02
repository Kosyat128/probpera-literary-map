import { load } from "cheerio";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const outputDirectory = path.join(projectRoot, "public", "articles");
const catalogPath = path.join(
  projectRoot,
  "src",
  "data",
  "articles",
  "catalog.generated.ts"
);
const sitemapArgument = process.argv.find((argument) =>
  argument.startsWith("--sitemap=")
);
const sitemapPath = sitemapArgument
  ? path.resolve(projectRoot, sitemapArgument.split("=").slice(1).join("="))
  : null;
const directUrlArgument = process.argv.find((argument) =>
  argument.startsWith("--url=")
);
const directUrl = directUrlArgument
  ? directUrlArgument.split("=").slice(1).join("=").trim()
  : null;

const sectionDefinitions = [
  {
    id: "book-opinions",
    label: "Мнение о книге",
    test: (pathname) => pathname.includes("/page-books/"),
  },
  {
    id: "screen-adaptations",
    label: "Книга и экранизация",
    test: (pathname) =>
      pathname.includes("/page-bookvsmovie/") ||
      pathname.includes("/sucsessful-cinema-adaptation/") ||
      pathname.includes("/luchshie-ekranizacii"),
  },
  {
    id: "writers-world",
    label: "Писатели и литературная карта",
    test: (pathname) =>
      pathname.includes("/page-writers-world/") ||
      pathname.includes("/first_profession_writers/") ||
      pathname.includes("/unrecognized-writers/"),
  },
  {
    id: "awards",
    label: "Премии и литературный процесс",
    test: (pathname) =>
      pathname.includes("/nobel-prize/") ||
      pathname.includes("/famous_prizes/"),
  },
  {
    id: "folklore",
    label: "Фольклор и мифология",
    test: (pathname) => pathname.includes("/folklore/"),
  },
  {
    id: "book-guides",
    label: "Книжный гид и подборки",
    test: (pathname) =>
      pathname.includes("/topbook") ||
      pathname.includes("/top-book") ||
      pathname.includes("/luchshie-knigi") ||
      pathname.includes("/luchshie-bestselleri") ||
      pathname.includes("/knigniy-gid/"),
  },
  {
    id: "language",
    label: "Русский язык и выражения",
    test: (pathname) =>
      pathname.includes("/page-words/") ||
      pathname.includes("/krilatie-virageniya/"),
  },
  {
    id: "author-stories",
    label: "Рассказы и эссе",
    test: (pathname) => pathname.includes("/page-stories/"),
  },
  {
    id: "literary-essays",
    label: "О литературе и культуре",
    test: (pathname) =>
      pathname.includes("/different-staff/") ||
      pathname.includes("/page-article/"),
  },
];

function sectionFor(pathname) {
  return (
    sectionDefinitions.find((section) => section.test(pathname)) ||
    sectionDefinitions.at(-1)
  );
}

function articleId(url) {
  return new URL(url).pathname
    .replace(/^\/read\//, "")
    .replace(/^\/+|\/+$/g, "")
    .replace(/[^a-zа-яё0-9]+/giu, "--")
    .replace(/^-+|-+$/g, "")
    .toLocaleLowerCase("ru");
}

function headingId(text, index) {
  const normalized = text
    .trim()
    .toLocaleLowerCase("ru")
    .replace(/[^a-zа-яё0-9]+/giu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return `chapter-${normalized || index + 1}-${index + 1}`;
}

function normalizeText(value) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanContent(html) {
  const $ = load(`<main id="article-import-root">${html}</main>`, null, false);
  const root = $("#article-import-root");

  root.find("script,style,noscript,iframe,form,button,input").remove();
  root.find("*").each((_, element) => {
    const node = $(element);
    const lazySource =
      node.attr("data-original") ||
      node.attr("data-src") ||
      node.attr("data-lazy-rule");
    if (element.tagName === "img" && lazySource && !node.attr("src")) {
      node.attr("src", lazySource);
    }

    for (const attribute of Object.keys(element.attribs || {})) {
      if (
        ![
          "href",
          "src",
          "alt",
          "title",
          "width",
          "height",
          "loading",
          "id",
          "class",
        ].includes(attribute)
      ) {
        node.removeAttr(attribute);
      }
    }

    if (element.tagName === "img") {
      node.attr("loading", "lazy");
    }
    if (node.attr("class")) {
      const safeClasses = (node.attr("class") || "")
        .split(/\s+/u)
        .filter((value) =>
          ["article-media-split", "article-gallery"].includes(value)
        );
      if (safeClasses.length) node.attr("class", safeClasses.join(" "));
      else node.removeAttr("class");
    }
    if (element.tagName === "a") {
      const href = node.attr("href");
      if (href?.startsWith("http://probpera.ru")) {
        node.attr("href", href.replace("http://", "https://"));
      }
    }
  });

  const headings = [];
  root.find("h2,h3").each((index, element) => {
    const heading = $(element);
    const text = normalizeText(heading.text());
    const id = headingId(text, index);
    heading.attr("id", id);
    headings.push({
      id,
      level: Number(element.tagName.slice(1)),
      text,
    });
  });

  return {
    html: root.html()?.trim() || "",
    headings,
    plainText: normalizeText(root.text()),
  };
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function mediaSource($, element) {
  const node = $(element);
  return (
    node.attr("data-original") ||
    node.attr("data-src") ||
    node.attr("data-lazy-rule") ||
    node.attr("src") ||
    ""
  ).trim();
}

function imageFigure(source, caption = "") {
  if (!source) return "";
  const normalizedCaption = normalizeText(caption);
  return `<figure><img src="${escapeHtml(source)}" alt="${escapeHtml(
    normalizedCaption
  )}" loading="lazy">${
    normalizedCaption
      ? `<figcaption>${escapeHtml(normalizedCaption)}</figcaption>`
      : ""
  }</figure>`;
}

function extractRichRecord($, element) {
  const record = $(element);

  if (record.find(".t167").length) {
    const image = record.find(".t167__img").first();
    const source = mediaSource($, image);
    const caption = normalizeText(record.find(".t167__imgdescr").first().text());
    const text = record.find(".t167__text").first().html() || "";
    if (source || normalizeText(record.find(".t167__text").first().text())) {
      return `<section class="article-media-split">${imageFigure(
        source,
        caption
      )}<div>${text}</div></section>`;
    }
  }

  if (record.find(".t-slds").length) {
    const captions = record
      .find(".t-slds__caption .t-slds__descr")
      .map((_, node) => normalizeText($(node).text()))
      .get();
    const seen = new Set();
    const figures = [];
    record.find(".t-slds__item").each((index, slide) => {
      const media = $(slide)
        .find("[data-original],[data-src],img")
        .toArray()
        .map((node) => mediaSource($, node))
        .find((source) => source && !seen.has(source));
      if (!media) return;
      seen.add(media);
      figures.push(imageFigure(media, captions[index] || ""));
    });
    if (figures.length) {
      return `<div class="article-gallery">${figures.join("")}</div>`;
    }
  }

  const seen = new Set();
  const figures = [];
  record.find("img,[data-original],[data-src]").each((_, node) => {
    const source = mediaSource($, node);
    if (!source || seen.has(source)) return;
    seen.add(source);
    const figure = $(node).closest("figure");
    const caption = normalizeText(
      figure.find("figcaption").first().text() ||
        $(node).closest("[class*=imgblock]").find("[class*=imgdescr]").first().text()
    );
    figures.push(imageFigure(source, caption));
  });
  if (figures.length) {
    return figures.length === 1
      ? figures[0]
      : `<div class="article-gallery">${figures.join("")}</div>`;
  }

  return "";
}

function selectArticleContent($) {
  $("#t-header,#t-footer,.t890,.t704,.tolstoycomments-feed").remove();
  const fragments = [];
  let started = false;

  $("#allrecords .t-rec").each((_, element) => {
    const record = $(element);
    const recordText = normalizeText(record.text());
    const editors = record.find(".ql-editor");

    if (started && /^Опубликовано\s*:/iu.test(recordText)) return false;
    if (!started) {
      const isArticleStart = editors
        .toArray()
        .some((editor) => {
          const node = $(editor);
          return (
            normalizeText(node.text()).length >= 80 ||
            node.find("h2,h3,figure,img").length > 0
          );
        });
      if (!isArticleStart) return;
      started = true;
    }

    if (editors.length) {
      editors.each((__, editor) => {
        const node = $(editor);
        if (
          normalizeText(node.text()) ||
          node.find("h2,h3,figure,img").length > 0
        ) {
          fragments.push(node.html() || "");
        }
      });
      return;
    }

    const richRecord = extractRichRecord($, element);
    if (richRecord) fragments.push(richRecord);
  });

  if (!fragments.length) {
    $("#allrecords .t-text").each((_, element) => {
      const node = $(element);
      const text = normalizeText(node.text());
      if (text.length >= 120 && !/подпишитесь на нашу рассылку/i.test(text)) {
        fragments.push(`<p>${node.html() || ""}</p>`);
      }
    });
  }

  return cleanContent(fragments.join("\n"));
}

async function fetchText(url, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent":
            "ProbperaEditorialArchive/1.0 (+https://probpera.ru/contacts)",
        },
      });
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      return await response.text();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
  throw lastError;
}

async function loadSitemap() {
  if (sitemapPath) return readFile(sitemapPath, "utf8");
  return fetchText("https://probpera.ru/sitemap.xml");
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );
  return results;
}

async function crawlArticle(url, index, total) {
  const html = await fetchText(url);
  const $ = load(html);
  const parsedUrl = new URL(url);
  const section = sectionFor(parsedUrl.pathname);
  const content = selectArticleContent($);
  const title = normalizeText(
    $('meta[property="og:title"]').attr("content") || $("title").text()
  );
  const description = normalizeText(
    $('meta[name="description"]').attr("content") ||
      $('meta[property="og:description"]').attr("content") ||
      content.plainText.slice(0, 280)
  );
  const publishedLabel = normalizeText(
    $(".t026__title")
      .filter((_, element) => /опубликовано/i.test($(element).text()))
      .first()
      .text()
  );
  const imageUrl =
    $('meta[property="og:image"]').attr("content")?.trim() || undefined;
  const words = content.plainText.split(/\s+/u).filter(Boolean).length;
  const id = articleId(url);
  const article = {
    id,
    url,
    title,
    description,
    imageUrl,
    sectionId: section.id,
    sectionLabel: section.label,
    publishedLabel,
    readingMinutes: Math.max(1, Math.ceil(words / 190)),
    wordCount: words,
    headings: content.headings,
    contentHtml: content.html,
    plainText: content.plainText,
  };

  await writeFile(
    path.join(outputDirectory, `${id}.json`),
    `${JSON.stringify(article, null, 2)}\n`,
    "utf8"
  );
  process.stdout.write(`\r${index + 1}/${total} ${title.slice(0, 58)}          `);
  return article;
}

function typescriptCatalog(articles) {
  const metadata = articles.map(
    ({
      contentHtml,
      plainText,
      headings,
      ...article
    }) => ({
      ...article,
      headingCount: headings.length,
    })
  );
  return `// Generated by scripts/crawl-probpera.mjs. Do not edit by hand.
export type ArticleCatalogEntry = {
  id: string;
  url: string;
  title: string;
  description: string;
  imageUrl?: string;
  sectionId: string;
  sectionLabel: string;
  publishedLabel: string;
  readingMinutes: number;
  wordCount: number;
  headingCount: number;
};

export const articleCatalog: ArticleCatalogEntry[] = ${JSON.stringify(
    metadata,
    null,
    2
  )};
`;
}

await mkdir(outputDirectory, { recursive: true });
await mkdir(path.dirname(catalogPath), { recursive: true });

const sitemap = directUrl ? "" : await loadSitemap();
const urls = directUrl
  ? [directUrl]
  : [...sitemap.matchAll(/<loc>(.*?)<\/loc>/gisu)]
      .map((match) => match[1].trim())
      .filter((url) =>
        /\/read\/(?:page-article\/.+|page-words|page-stories)\/\d+$/u.test(url)
      )
      .sort((first, second) =>
        first.localeCompare(second, "ru", { numeric: true })
      );

console.log(`Found ${urls.length} article pages.`);
const articles = await mapWithConcurrency(urls, 5, (url, index) =>
  crawlArticle(url, index, urls.length)
);
console.log();

if (directUrl) {
  console.log(`Saved the selected article document without rebuilding the catalog.`);
  process.exit(0);
}

articles.sort((first, second) => {
  const sectionDifference = first.sectionLabel.localeCompare(
    second.sectionLabel,
    "ru"
  );
  return sectionDifference || first.title.localeCompare(second.title, "ru");
});

await writeFile(
  path.join(outputDirectory, "index.json"),
  `${JSON.stringify(
    articles.map(({ contentHtml, plainText, headings, ...article }) => ({
      ...article,
      headingCount: headings.length,
    })),
    null,
    2
  )}\n`,
  "utf8"
);
await writeFile(catalogPath, typescriptCatalog(articles), "utf8");

console.log(
  `Saved ${articles.length} articles to ${path.relative(
    projectRoot,
    outputDirectory
  )}.`
);
