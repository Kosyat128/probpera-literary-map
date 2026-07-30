import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { load } from "cheerio";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const articlesDir = path.join(rootDir, "public", "articles");
const reportDir = path.join(rootDir, "reports");
const catalog = JSON.parse(
  await fs.readFile(path.join(articlesDir, "index.json"), "utf8")
);

function normalizeText(value = "") {
  return String(value)
    .normalize("NFKC")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleTokens(value = "") {
  return normalizeText(value)
    .toLocaleLowerCase("ru")
    .replace(/\bvs\b/giu, " и ")
    .replace(/[«»„“”"'’`—–-]+/gu, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(/\s+/u)
    .filter(Boolean);
}

function titlesAreEditoriallyEquivalent(first, second) {
  const firstTokens = titleTokens(first);
  const secondTokens = titleTokens(second);
  if (firstTokens.join(" ") === secondTokens.join(" ")) return true;
  if (!firstTokens.length || !secondTokens.length) return false;

  const firstSet = new Set(firstTokens);
  const secondSet = new Set(secondTokens);
  const shared = [...firstSet].filter((token) => secondSet.has(token)).length;
  const shorterSize = Math.min(firstSet.size, secondSet.size);
  return shorterSize >= 4 && shared / shorterSize >= 0.9;
}

function normalizeUrl(value, baseUrl) {
  if (!value || /^data:/i.test(value)) return "";
  try {
    const result = new URL(value, baseUrl);
    result.hash = "";
    return result.href.replace(/^http:/i, "https:");
  } catch {
    return "";
  }
}

function extractArticleFragment($) {
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
      if (
        text.length >= 120 &&
        !/подпишитесь на нашу рассылку/i.test(text)
      ) {
        fragments.push(`<p>${node.html() || ""}</p>`);
      }
    });
  }

  return fragments.join("\n");
}

function imageUrlsFromHtml(html, baseUrl) {
  const $ = load(`<main id="audit-root">${html || ""}</main>`, null, false);
  return [
    ...new Set(
      $("#audit-root img")
        .map((_, element) => {
          const node = $(element);
          return normalizeUrl(
            node.attr("data-original") ||
              node.attr("data-src") ||
              node.attr("data-lazy-rule") ||
              node.attr("src"),
            baseUrl
          );
        })
        .get()
        .filter(Boolean)
    ),
  ];
}

async function fetchWithRetry(url, options = {}, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          "user-agent":
            "ProbperaEditorialArchiveAudit/1.0 (+https://probpera.ru/)",
          ...(options.headers || {}),
        },
        signal: AbortSignal.timeout(25_000),
      });
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 450));
      }
    }
  }
  throw lastError;
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

const articleChecks = await mapWithConcurrency(
  catalog,
  5,
  async (article, index) => {
    const result = {
      id: article.id,
      url: article.url,
      title: article.title,
      status: "ok",
      titleMatches: false,
      heroMatches: false,
      oldInlineCount: 0,
      currentInlineCount: 0,
      titleExactMatches: false,
      missingInlineImages: [],
      unavailableImages: [],
      notes: [],
    };

    try {
      const [oldResponse, currentArticle] = await Promise.all([
        fetchWithRetry(article.url),
        fs
          .readFile(path.join(articlesDir, `${article.id}.json`), "utf8")
          .then(JSON.parse),
      ]);
      const oldHtml = await oldResponse.text();
      const $ = load(oldHtml);
      const oldTitle = normalizeText(
        $('meta[property="og:title"]').attr("content") || $("title").text()
      );
      const oldHero = normalizeUrl(
        $('meta[property="og:image"]').attr("content"),
        article.url
      );
      const currentHero = normalizeUrl(article.imageUrl, article.url);
      const oldInline = imageUrlsFromHtml(extractArticleFragment($), article.url);
      const currentInline = imageUrlsFromHtml(
        currentArticle.contentHtml,
        article.url
      );

      result.oldTitle = oldTitle;
      result.oldHero = oldHero;
      result.currentHero = currentHero;
      result.titleExactMatches = oldTitle === normalizeText(article.title);
      result.titleMatches = titlesAreEditoriallyEquivalent(
        oldTitle,
        article.title
      );
      result.heroMatches = oldHero === currentHero;
      result.oldInlineCount = oldInline.length;
      result.currentInlineCount = currentInline.length;
      result.missingInlineImages = oldInline.filter(
        (imageUrl) => !currentInline.includes(imageUrl)
      );

      const urlsToCheck = [
        ...new Set([currentHero, ...currentInline].filter(Boolean)),
      ];
      const checks = await mapWithConcurrency(urlsToCheck, 3, async (imageUrl) => {
        try {
          const response = await fetchWithRetry(
            imageUrl,
            {
              headers: { range: "bytes=0-0" },
            },
            2
          );
          await response.body?.cancel();
          return null;
        } catch (error) {
          return {
            url: imageUrl,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      });
      result.unavailableImages = checks.filter(Boolean);

      if (!result.titleMatches) result.notes.push("title-mismatch");
      if (!result.heroMatches) result.notes.push("hero-mismatch");
      if (result.missingInlineImages.length) {
        result.notes.push("missing-inline-images");
      }
      if (result.unavailableImages.length) {
        result.notes.push("unavailable-current-images");
      }
      if (result.notes.length) result.status = "review";
    } catch (error) {
      result.status = "error";
      result.notes.push(
        error instanceof Error ? error.message : String(error)
      );
    }

    process.stdout.write(
      `\rLegacy media audit: ${index + 1}/${catalog.length}          `
    );
    return result;
  }
);

process.stdout.write("\n");

const totals = articleChecks.reduce(
  (summary, article) => {
    summary[article.status] += 1;
    if (!article.titleMatches) summary.titleMismatches += 1;
    if (!article.titleExactMatches && article.titleMatches) {
      summary.editorialTitleDifferences += 1;
    }
    if (!article.heroMatches) summary.heroMismatches += 1;
    summary.missingInlineImages += article.missingInlineImages.length;
    summary.unavailableImages += article.unavailableImages.length;
    return summary;
  },
  {
    ok: 0,
    review: 0,
    error: 0,
    titleMismatches: 0,
    editorialTitleDifferences: 0,
    heroMismatches: 0,
    missingInlineImages: 0,
    unavailableImages: 0,
  }
);

const report = {
  generatedAt: new Date().toISOString(),
  source: "https://probpera.ru/",
  articleCount: catalog.length,
  totals,
  articles: articleChecks,
};

await fs.mkdir(reportDir, { recursive: true });
await fs.writeFile(
  path.join(reportDir, "legacy-article-media-audit.json"),
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8"
);

const reviewArticles = articleChecks.filter(
  (article) => article.status !== "ok"
);
const markdown = [
  "# Проверка переноса статей и изображений",
  "",
  `Проверено материалов: ${catalog.length}.`,
  `Полностью совпадают: ${totals.ok}.`,
  `Требуют проверки: ${totals.review}.`,
  `Не удалось проверить: ${totals.error}.`,
  `Несовпадений заголовков: ${totals.titleMismatches}.`,
  `Редакционных различий в пунктуации и формулировке: ${totals.editorialTitleDifferences}.`,
  `Несовпадений главных изображений: ${totals.heroMismatches}.`,
  `Не перенесённых изображений внутри текста: ${totals.missingInlineImages}.`,
  `Недоступных текущих изображений: ${totals.unavailableImages}.`,
  ...(reviewArticles.length
    ? [
        "",
        "## Материалы, требующие внимания",
        "",
        ...reviewArticles.map(
          (article) =>
            `- **${article.title}** (${article.id}): ${article.notes.join(", ")}`
        ),
      ]
    : []),
];

await fs.writeFile(
  path.join(reportDir, "legacy-article-media-audit.md"),
  `${markdown.join("\n")}\n`,
  "utf8"
);

console.log(
  `Legacy media audit complete: ${totals.ok} ok, ${totals.review} review, ${totals.error} errors.`
);

if (
  totals.error ||
  totals.titleMismatches ||
  totals.heroMismatches ||
  totals.missingInlineImages ||
  totals.unavailableImages
) {
  process.exitCode = 1;
}
