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

function pushUniqueImage(images, seen, value, baseUrl) {
  const normalized = normalizeUrl(value, baseUrl);
  if (!normalized || seen.has(normalized)) return;
  seen.add(normalized);
  images.push(normalized);
}

function dedupeSequence(values) {
  const seen = new Set();
  return values.filter((value) => {
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function normalizeHeading(value) {
  return titleTokens(value).join(" ");
}

function headingsFromNode($, node) {
  return node
    .find("h2,h3")
    .map((_, heading) => normalizeText($(heading).text()))
    .get()
    .filter(Boolean);
}

function extractLegacyStructure($, baseUrl) {
  $("#t-header,#t-footer,.t890,.t704,.tolstoycomments-feed").remove();
  const images = [];
  const headings = [];
  let sideLayouts = 0;
  let galleries = 0;
  let started = false;

  $("#allrecords .t-rec").each((_, element) => {
    const record = $(element);
    const recordText = normalizeText(record.text());
    const editors = record.find(".ql-editor");

    if (started && /^Опубликовано\s*:/iu.test(recordText)) return false;
    if (!started) {
      const isArticleStart = editors.toArray().some((editor) => {
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
          !normalizeText(node.text()) &&
          node.find("h2,h3,figure,img").length === 0
        ) {
          return;
        }
        headings.push(...headingsFromNode($, node));
        node.find("img,[data-original],[data-src]").each((___, image) => {
          const source = normalizeUrl(mediaSource($, image), baseUrl);
          if (source) images.push(source);
        });
      });
      return;
    }

    if (record.find(".t167").length) {
      sideLayouts += 1;
      const image = record.find(".t167__img").first();
      const source = normalizeUrl(mediaSource($, image), baseUrl);
      if (source) images.push(source);
      headings.push(
        ...headingsFromNode($, record.find(".t167__text").first())
      );
      return;
    }

    if (record.find(".t-slds").length) {
      galleries += 1;
      const seen = new Set();
      record.find(".t-slds__item").each((__, slide) => {
        const source = $(slide)
          .find("[data-original],[data-src],img")
          .toArray()
          .map((node) => mediaSource($, node))
          .find((value) => {
            const normalized = normalizeUrl(value, baseUrl);
            return normalized && !seen.has(normalized);
          });
        if (source) pushUniqueImage(images, seen, source, baseUrl);
      });
      return;
    }

    const seen = new Set();
    record.find("img,[data-original],[data-src]").each((__, image) => {
      pushUniqueImage(images, seen, mediaSource($, image), baseUrl);
    });
    if (seen.size > 1) galleries += 1;
  });

  return {
    images: dedupeSequence(images),
    headings,
    sideLayouts,
    galleries,
  };
}

function extractCurrentStructure(html, baseUrl) {
  const $ = load(`<main id="audit-root">${html || ""}</main>`, null, false);
  return {
    images: dedupeSequence(
      imageUrlsFromHtml($("#audit-root").html() || "", baseUrl)
    ),
    headings: headingsFromNode($, $("#audit-root")),
    sideLayouts: $("#audit-root .article-media-split").length,
    galleries: $("#audit-root .article-gallery").length,
  };
}

function imageUrlsFromHtml(html, baseUrl) {
  const $ = load(`<main id="audit-root">${html || ""}</main>`, null, false);
  return $("#audit-root img")
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
    .filter(Boolean);
}

function occurrenceDifference(expected, actual) {
  const remaining = new Map();
  actual.forEach((value) => {
    remaining.set(value, (remaining.get(value) || 0) + 1);
  });

  return expected.filter((value) => {
    const count = remaining.get(value) || 0;
    if (count <= 0) return true;
    remaining.set(value, count - 1);
    return false;
  });
}

function orderedListsMatch(first, second) {
  return (
    first.length === second.length &&
    first.every((value, index) => value === second[index])
  );
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
      inlineOrderMatches: false,
      oldHeadingCount: 0,
      currentHeadingCount: 0,
      headingOrderMatches: false,
      missingHeadings: [],
      unexpectedHeadings: [],
      oldSideLayoutCount: 0,
      currentSideLayoutCount: 0,
      oldGalleryCount: 0,
      currentGalleryCount: 0,
      titleExactMatches: false,
      missingInlineImages: [],
      unexpectedInlineImages: [],
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
      const oldStructure = extractLegacyStructure($, article.url);
      const currentStructure = extractCurrentStructure(
        currentArticle.contentHtml,
        article.url
      );
      const oldInline = oldStructure.images;
      const currentInline = currentStructure.images;

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
      result.inlineOrderMatches = orderedListsMatch(oldInline, currentInline);
      result.missingInlineImages = occurrenceDifference(oldInline, currentInline);
      result.unexpectedInlineImages = occurrenceDifference(currentInline, oldInline);
      const oldHeadingKeys = oldStructure.headings.map(normalizeHeading);
      const currentHeadingKeys = currentStructure.headings.map(normalizeHeading);
      result.oldHeadingCount = oldHeadingKeys.length;
      result.currentHeadingCount = currentHeadingKeys.length;
      result.headingOrderMatches = orderedListsMatch(
        oldHeadingKeys,
        currentHeadingKeys
      );
      result.missingHeadings = occurrenceDifference(
        oldHeadingKeys,
        currentHeadingKeys
      );
      result.unexpectedHeadings = occurrenceDifference(
        currentHeadingKeys,
        oldHeadingKeys
      );
      result.oldSideLayoutCount = oldStructure.sideLayouts;
      result.currentSideLayoutCount = currentStructure.sideLayouts;
      result.oldGalleryCount = oldStructure.galleries;
      result.currentGalleryCount = currentStructure.galleries;

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
      if (result.unexpectedInlineImages.length) {
        result.notes.push("unexpected-inline-images");
      }
      if (!result.inlineOrderMatches) {
        result.notes.push("inline-image-order-mismatch");
      }
      if (result.missingHeadings.length) result.notes.push("missing-headings");
      if (result.unexpectedHeadings.length) {
        result.notes.push("unexpected-headings");
      }
      if (!result.headingOrderMatches) {
        result.notes.push("heading-order-mismatch");
      }
      if (result.oldSideLayoutCount !== result.currentSideLayoutCount) {
        result.notes.push("side-layout-count-mismatch");
      }
      if (result.oldGalleryCount !== result.currentGalleryCount) {
        result.notes.push("gallery-count-mismatch");
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

const failedImageUrls = [
  ...new Set(
    articleChecks.flatMap((article) =>
      article.unavailableImages.map((item) => item.url)
    )
  ),
];

if (failedImageUrls.length) {
  const recoveredImageUrls = new Set();
  await mapWithConcurrency(failedImageUrls, 2, async (imageUrl, index) => {
    await new Promise((resolve) => setTimeout(resolve, 350 + (index % 2) * 250));
    try {
      const response = await fetchWithRetry(
        imageUrl,
        { headers: { range: "bytes=0-0" } },
        4
      );
      await response.body?.cancel();
      recoveredImageUrls.add(imageUrl);
    } catch {
      // The original failure remains in the report.
    }
  });
  articleChecks.forEach((article) => {
    article.unavailableImages = article.unavailableImages.filter(
      (item) => !recoveredImageUrls.has(item.url)
    );
    if (!article.unavailableImages.length) {
      article.notes = article.notes.filter(
        (note) => note !== "unavailable-current-images"
      );
      article.status = article.notes.length ? "review" : "ok";
    }
  });
}

const totals = articleChecks.reduce(
  (summary, article) => {
    summary[article.status] += 1;
    if (!article.titleMatches) summary.titleMismatches += 1;
    if (!article.titleExactMatches && article.titleMatches) {
      summary.editorialTitleDifferences += 1;
    }
    if (!article.heroMatches) summary.heroMismatches += 1;
    summary.oldInlineImages += article.oldInlineCount;
    summary.currentInlineImages += article.currentInlineCount;
    summary.missingInlineImages += article.missingInlineImages.length;
    summary.unexpectedInlineImages += article.unexpectedInlineImages.length;
    if (!article.inlineOrderMatches) summary.inlineOrderMismatches += 1;
    summary.oldHeadings += article.oldHeadingCount;
    summary.currentHeadings += article.currentHeadingCount;
    summary.missingHeadings += article.missingHeadings.length;
    summary.unexpectedHeadings += article.unexpectedHeadings.length;
    if (!article.headingOrderMatches) summary.headingOrderMismatches += 1;
    summary.oldSideLayouts += article.oldSideLayoutCount;
    summary.currentSideLayouts += article.currentSideLayoutCount;
    summary.oldGalleries += article.oldGalleryCount;
    summary.currentGalleries += article.currentGalleryCount;
    if (article.oldSideLayoutCount !== article.currentSideLayoutCount) {
      summary.sideLayoutMismatches += 1;
    }
    if (article.oldGalleryCount !== article.currentGalleryCount) {
      summary.galleryMismatches += 1;
    }
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
    oldInlineImages: 0,
    currentInlineImages: 0,
    missingInlineImages: 0,
    unexpectedInlineImages: 0,
    inlineOrderMismatches: 0,
    oldHeadings: 0,
    currentHeadings: 0,
    missingHeadings: 0,
    unexpectedHeadings: 0,
    headingOrderMismatches: 0,
    oldSideLayouts: 0,
    currentSideLayouts: 0,
    sideLayoutMismatches: 0,
    oldGalleries: 0,
    currentGalleries: 0,
    galleryMismatches: 0,
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
  `Изображений внутри старых текстов: ${totals.oldInlineImages}.`,
  `Изображений внутри новых текстов: ${totals.currentInlineImages}.`,
  `Не перенесённых изображений внутри текста: ${totals.missingInlineImages}.`,
  `Лишних изображений внутри текста: ${totals.unexpectedInlineImages}.`,
  `Материалов с нарушенным порядком изображений: ${totals.inlineOrderMismatches}.`,
  `Глав в старых статьях: ${totals.oldHeadings}.`,
  `Глав в новых статьях: ${totals.currentHeadings}.`,
  `Не перенесённых глав: ${totals.missingHeadings}.`,
  `Лишних глав: ${totals.unexpectedHeadings}.`,
  `Материалов с нарушенным порядком глав: ${totals.headingOrderMismatches}.`,
  `Боковых фотоблоков: ${totals.oldSideLayouts} → ${totals.currentSideLayouts}.`,
  `Материалов с расхождением боковых фотоблоков: ${totals.sideLayoutMismatches}.`,
  `Галерей: ${totals.oldGalleries} → ${totals.currentGalleries}.`,
  `Материалов с расхождением галерей: ${totals.galleryMismatches}.`,
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
  totals.unexpectedInlineImages ||
  totals.inlineOrderMismatches ||
  totals.missingHeadings ||
  totals.unexpectedHeadings ||
  totals.headingOrderMismatches ||
  totals.sideLayoutMismatches ||
  totals.galleryMismatches ||
  totals.unavailableImages
) {
  process.exitCode = 1;
}
