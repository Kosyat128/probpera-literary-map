import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mergePublishedArticleCatalog } from "./lib/article-catalog-merge.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const publicDirectory = path.join(projectRoot, "public");
const legacyArticleDirectory = path.join(publicDirectory, "articles");
const cmsDirectory = path.join(publicDirectory, "cms");
const reportDirectory = path.join(projectRoot, "reports");
const currentYear = new Date().getUTCFullYear();

const rules = [
  {
    id: "exclusive-typo",
    category: "Орфография",
    severity: "high",
    pattern: /(?<!\p{L})эсклюзив\p{L}*/giu,
    suggestion: "Проверить написание: «эксклюзив…».",
  },
  {
    id: "laureate-typo",
    category: "Орфография",
    severity: "high",
    pattern: /(?<!\p{L})лаурет\p{L}*/giu,
    suggestion: "Проверить написание: «лауреат…».",
  },
  {
    id: "modern-typo",
    category: "Орфография",
    severity: "high",
    pattern: /(?<!\p{L})соременн\p{L}*/giu,
    suggestion: "Проверить написание: «современн…».",
  },
  {
    id: "comment-typo",
    category: "Орфография",
    severity: "high",
    pattern: /(?<!\p{L})коментар\p{L}*/giu,
    suggestion: "Проверить написание: «комментар…».",
  },
  {
    id: "biography-typo",
    category: "Орфография",
    severity: "high",
    pattern: /(?<!\p{L})боиграф\p{L}*/giu,
    suggestion: "Проверить написание: «биограф…».",
  },
  {
    id: "fresh-typo",
    category: "Орфография",
    severity: "high",
    pattern: /(?<!\p{L})свежые(?!\p{L})/giu,
    suggestion: "Исправить на «свежие».",
  },
  {
    id: "published-split",
    category: "Орфография",
    severity: "high",
    pattern: /(?<!\p{L})опубликанна\s+я(?!\p{L})/giu,
    suggestion: "Вероятная опечатка; проверить исходную фразу.",
  },
  {
    id: "about-autobiographical",
    category: "Управление",
    severity: "high",
    pattern: /(?<!\p{L})о\s+автобиографичности(?!\p{L})/giu,
    suggestion: "Исправить на «об автобиографичности».",
  },
  {
    id: "unusual-style",
    category: "Согласование",
    severity: "high",
    pattern: /(?<!\p{L})необычный\s+стил(?!\p{L})/giu,
    suggestion: "Исправить на «необычный стиль».",
  },
  {
    id: "facts-which",
    category: "Согласование",
    severity: "high",
    pattern: /(?<!\p{L})фактами,\s+который(?!\p{L})/giu,
    suggestion: "Вероятно: «фактами, которые…».",
  },
  {
    id: "becomes-description",
    category: "Согласование",
    severity: "high",
    pattern: /(?<!\p{L})становится\s+в\s+итоге\s+описание(?!\p{L})/giu,
    suggestion: "Нарушено согласование; вероятно: «становится описанием».",
  },
  {
    id: "main-threat",
    category: "Управление",
    severity: "high",
    pattern: /(?<!\p{L})главной\s+грозой\s+общественному\s+порядку(?!\p{L})/giu,
    suggestion: "Вероятно: «главной угрозой общественному порядку».",
  },
  {
    id: "book-of-course",
    category: "Пунктуация",
    severity: "medium",
    pattern: /(?<!\p{L})Книга\s+конечно\s+же(?!\p{L})/gu,
    suggestion: "Вводное сочетание следует обособить: «Книга, конечно же, …».",
  },
  {
    id: "literary-adjective-typo",
    category: "Орфография",
    severity: "high",
    pattern: /(?<!\p{L})литературныя(?!\p{L})/giu,
    suggestion: "Исправить окончание прилагательного: «литературная».",
  },
  {
    id: "geneva-case",
    category: "Согласование",
    severity: "high",
    pattern: /(?<!\p{L})в\s+Женева(?!\p{L})/gu,
    suggestion: "После предлога требуется форма «в Женеве».",
  },
  {
    id: "truth-spelling",
    category: "Орфография",
    severity: "medium",
    pattern: /(?<!\p{L})по\s+истине(?!\p{L})/giu,
    suggestion: "Наречие пишется слитно: «поистине».",
  },
  {
    id: "space-before-punctuation",
    category: "Типографика",
    severity: "medium",
    pattern: /\s+[,:;!?](?=\s|$)/gu,
    suggestion: "Убрать пробел перед знаком препинания.",
  },
  {
    id: "spaced-hyphen",
    category: "Типографика",
    severity: "low",
    pattern: /(?<=\p{L}|\d)\s-\s(?=\p{L}|\d|«)/gu,
    suggestion: "Проверить замену дефиса на тире: « - ».",
    maxPerArticle: 6,
  },
  {
    id: "double-space",
    category: "Типографика",
    severity: "low",
    pattern: /[^\n][ \t]{2,}[^\n]/gu,
    suggestion: "Убрать лишний пробел.",
    maxPerArticle: 3,
  },
];

function excerpt(text, index, length) {
  const start = Math.max(0, index - 95);
  const end = Math.min(text.length, index + length + 95);
  return `${start > 0 ? "…" : ""}${text
    .slice(start, end)
    .replace(/\s+/g, " ")
    .trim()}${end < text.length ? "…" : ""}`;
}

function futureYearFindings(article) {
  const findings = [];
  const pattern = /\((1[6-9]\d{2}|20\d{2})\s*[-]\s*(20\d{2})\)/gu;
  for (const match of article.plainText.matchAll(pattern)) {
    const deathYear = Number(match[2]);
    if (deathYear <= currentYear) continue;
    const isHunterThompsonTypo =
      deathYear === 2055 &&
      /Хантер[а]?\s+(?:Стоктон\s+)?Томпсон/iu.test(
        `${article.title} ${article.plainText.slice(
          Math.max(0, match.index - 80),
          match.index + match[0].length + 80
        )}`
      );
    findings.push({
      ruleId: "future-death-year",
      category: "Факт",
      severity: "critical",
      match: match[0],
      suggestion: isHunterThompsonTypo
        ? "Исправить дату смерти Хантера С. Томпсона на 2005 год и сверить источник."
        : `Дата смерти ${deathYear} находится в будущем; проверить биографические данные.`,
      index: match.index,
      excerpt: excerpt(article.plainText, match.index, match[0].length),
    });
  }
  return findings;
}

function brokenLinkFindings(article) {
  const findings = [];
  const hrefPattern = /href="([^"]+)"/giu;
  for (const match of article.contentHtml.matchAll(hrefPattern)) {
    const url = match[1];
    if (
      url === "https://google.com" ||
      /dzen\.ru\/probaperra\b/iu.test(url) ||
      /vk\.com\/probbaperra\b/iu.test(url)
    ) {
      findings.push({
        ruleId: "known-broken-or-inconsistent-link",
        category: "Ссылка",
        severity: "high",
        match: url,
        suggestion:
          "Проверить адрес. Канонические страницы проекта: vk.com/probperaru и dzen.ru/probpera.ru.",
        index: 0,
        excerpt: url,
      });
    }
  }
  return findings;
}

function englishTranslationFindings(article) {
  const translation = article.translations?.en;
  if (!translation) {
    return [
      {
        ruleId: "missing-approved-english-translation",
        category: "Локализация",
        severity: "high",
        match: "translations.en",
        suggestion:
          "Подготовить, проверить и утвердить английскую версию заголовка, описания и полного текста.",
        index: 0,
        excerpt: "Английская версия не опубликована.",
      },
    ];
  }

  const findings = [];
  const status = String(translation.translationStatus || "");
  if (!new Set(["approved", "published"]).has(status)) {
    findings.push({
      ruleId: "english-translation-not-approved",
      category: "Локализация",
      severity: "high",
      match: status || "missing status",
      suggestion: "Английская версия должна пройти редакционное утверждение.",
      index: 0,
      excerpt: `Статус перевода: ${status || "не указан"}.`,
    });
  }

  const plainText = String(translation.plainText || "").replace(/\s+/gu, " ").trim();
  if (!String(translation.title || "").trim() || !plainText) {
    findings.push({
      ruleId: "incomplete-english-translation",
      category: "Локализация",
      severity: "high",
      match: "empty required field",
      suggestion: "Заполнить английский заголовок и полный текст статьи.",
      index: 0,
      excerpt: "Обязательное английское поле пусто.",
    });
    return findings;
  }

  const letters = plainText.match(/\p{L}/gu)?.length || 0;
  const cyrillic = plainText.match(/[А-Яа-яЁё]/gu)?.length || 0;
  if (letters && cyrillic / letters > 0.02) {
    findings.push({
      ruleId: "untranslated-cyrillic-fragment",
      category: "Локализация",
      severity: "high",
      match: `${Math.round((cyrillic / letters) * 100)}% Cyrillic`,
      suggestion:
        "Проверить английскую версию: в ней остался значительный русский фрагмент.",
      index: 0,
      excerpt: plainText.slice(0, 220),
    });
  }

  const sourceWords = Number(article.wordCount || 0);
  const translatedWords = Number(translation.wordCount || 0);
  const lengthRatio = sourceWords ? translatedWords / sourceWords : 1;
  if (sourceWords >= 100 && (lengthRatio < 0.55 || lengthRatio > 1.8)) {
    findings.push({
      ruleId: "english-translation-length-mismatch",
      category: "Локализация",
      severity: "medium",
      match: `${translatedWords}/${sourceWords} words`,
      suggestion:
        "Сверить полноту английской версии с русским оригиналом: объём заметно отличается.",
      index: 0,
      excerpt: `RU: ${sourceWords}; EN: ${translatedWords}.`,
    });
  }
  return findings;
}

function normalizedPath(value = "") {
  try {
    return new URL(String(value), "https://probpera.ru").pathname.replace(/\/+$/u, "") || "/";
  } catch {
    return String(value).split(/[?#]/u)[0].replace(/\/+$/u, "") || "/";
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function loadPublishedArticles() {
  const legacyCatalog = await readJson(
    path.join(legacyArticleDirectory, "index.json")
  );
  const legacyArticles = await Promise.all(
    legacyCatalog.map(async (entry) => ({
      ...(await readJson(path.join(legacyArticleDirectory, `${entry.id}.json`))),
      auditSource: "legacy",
    }))
  );

  let cmsEntries = [];
  let withdrawnLegacyArticles = [];
  try {
    const snapshot = await readJson(path.join(cmsDirectory, "published-content.json"));
    cmsEntries = Array.isArray(snapshot.articles) ? snapshot.articles : [];
    withdrawnLegacyArticles = snapshot.withdrawnLegacyArticles;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  const cmsArticles = await Promise.all(
    cmsEntries.map(async (entry) => {
      const relativeDocumentPath =
        entry.documentPath || `cms/articles/${entry.id}.json`;
      return {
        ...(await readJson(path.join(publicDirectory, relativeDocumentPath))),
        auditSource: "cms",
      };
    })
  );
  return mergePublishedArticleCatalog(
    legacyArticles,
    cmsArticles,
    withdrawnLegacyArticles
  );
}

async function main() {
  const articles = await loadPublishedArticles();
  const findings = [];
  const articleStats = [];

  for (const article of articles) {
    const articleFindings = [];

    for (const rule of rules) {
      let count = 0;
      for (const match of article.plainText.matchAll(rule.pattern)) {
        if (count >= (rule.maxPerArticle || 20)) break;
        const finding = {
          articleId: article.id,
          title: article.title,
          url: article.url,
          ruleId: rule.id,
          category: rule.category,
          severity: rule.severity,
          match: match[0],
          suggestion: rule.suggestion,
          index: match.index,
          excerpt: excerpt(article.plainText, match.index, match[0].length),
        };
        articleFindings.push(finding);
        count += 1;
      }
    }

    articleFindings.push(
      ...futureYearFindings(article).map((finding) => ({
        articleId: article.id,
        title: article.title,
        url: article.url,
        ...finding,
      })),
      ...brokenLinkFindings(article).map((finding) => ({
        articleId: article.id,
        title: article.title,
        url: article.url,
        ...finding,
      })),
      ...englishTranslationFindings(article).map((finding) => ({
        articleId: article.id,
        title: article.title,
        url: article.url,
        ...finding,
      }))
    );

    findings.push(...articleFindings);
    articleStats.push({
      id: article.id,
      title: article.title,
      url: article.url,
      source: article.auditSource,
      englishTranslationStatus:
        article.translations?.en?.translationStatus || "missing",
      wordCount: article.wordCount,
      issues: articleFindings.length,
      critical: articleFindings.filter((item) => item.severity === "critical").length,
      high: articleFindings.filter((item) => item.severity === "high").length,
    });
  }

  const counts = (key) =>
    findings.reduce((result, finding) => {
      result[finding[key]] = (result[finding[key]] || 0) + 1;
      return result;
    }, {});

  const report = {
    generatedAt: new Date().toISOString(),
    note:
      "Автоматический аудит формирует редакционную очередь, но не изменяет авторский текст. Каждая правка требует человеческого подтверждения.",
    summary: {
      articles: articles.length,
      totalWords: articles.reduce(
        (sum, article) => sum + Number(article.wordCount || 0),
        0
      ),
      bySource: {
        cms: articles.filter((article) => article.auditSource === "cms").length,
        legacy: articles.filter((article) => article.auditSource === "legacy").length,
      },
      englishTranslations: {
        released: articles.filter((article) =>
          ["approved", "published"].includes(
            article.translations?.en?.translationStatus
          )
        ).length,
        missing: articles.filter((article) => !article.translations?.en).length,
      },
      findings: findings.length,
      affectedArticles: new Set(findings.map((finding) => finding.articleId)).size,
      bySeverity: counts("severity"),
      byCategory: counts("category"),
    },
    articles: articleStats.sort(
      (first, second) =>
        second.critical - first.critical ||
        second.high - first.high ||
        second.issues - first.issues
    ),
    findings,
  };

  await mkdir(reportDirectory, { recursive: true });
  await writeFile(
    path.join(reportDirectory, "editorial-audit.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8"
  );

  const lines = [
    "# Редакционный аудит публикаций «Проба Пера»",
    "",
    `Сформирован: ${report.generatedAt}`,
    "",
    "> Автоматический аудит не изменяет авторский текст. Каждая правка подтверждается редактором вручную.",
    "",
    "## Сводка",
    "",
    `- Материалов: ${report.summary.articles}`,
    `- Слов: ${report.summary.totalWords.toLocaleString("ru-RU")}`,
    `- Предварительных находок: ${report.summary.findings}`,
    `- Материалов в очереди: ${report.summary.affectedArticles}`,
    `- Критических: ${report.summary.bySeverity.critical || 0}`,
    `- Высокого приоритета: ${report.summary.bySeverity.high || 0}`,
    `- Среднего приоритета: ${report.summary.bySeverity.medium || 0}`,
    `- Типографических замечаний: ${report.summary.bySeverity.low || 0}`,
    "",
    "## Сначала проверить",
    "",
  ];

  for (const item of report.articles.filter((article) => article.issues > 0).slice(0, 40)) {
    lines.push(
      `### ${item.title}`,
      "",
      `Оригинал: ${item.url}`,
      "",
      `Находок: ${item.issues}; критических: ${item.critical}; высокого приоритета: ${item.high}.`,
      ""
    );
    findings
      .filter((finding) => finding.articleId === item.id)
      .slice(0, 12)
      .forEach((finding) => {
        lines.push(
          `- **${finding.severity} · ${finding.category}:** ${finding.suggestion}`,
          `  - Фрагмент: «${finding.excerpt}»`
        );
      });
    lines.push("");
  }

  await writeFile(
    path.join(reportDirectory, "editorial-audit.md"),
    `${lines.join("\n")}\n`,
    "utf8"
  );

  console.log(
    `Audited ${report.summary.articles} articles and ${report.summary.totalWords} words.`
  );
  console.log(
    `Found ${report.summary.findings} review items in ${report.summary.affectedArticles} articles.`
  );
  console.log(`Reports saved to ${reportDirectory}.`);
}

await main();
