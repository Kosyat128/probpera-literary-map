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
        ].includes(attribute)
      ) {
        node.removeAttr(attribute);
      }
    }

    if (element.tagName === "img") {
      node.attr("loading", "lazy");
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

function selectArticleContent($) {
  $("#t-header,#t-footer,.t890,.t704,.tolstoycomments-feed").remove();
  const fragments = [];

  $(".ql-editor").each((_, element) => {
    const node = $(element);
    if (normalizeText(node.text()).length >= 80) {
      fragments.push(node.html() || "");
    }
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

const sitemap = await loadSitemap();
const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/gisu)]
  .map((match) => match[1].trim())
  .filter((url) => /\/read\/(?:page-article\/.+|page-words|page-stories)\/\d+$/u.test(url))
  .sort((first, second) => first.localeCompare(second, "ru", { numeric: true }));

console.log(`Found ${urls.length} article pages.`);
const articles = await mapWithConcurrency(urls, 5, (url, index) =>
  crawlArticle(url, index, urls.length)
);
console.log();

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
