import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const catalogPath = path.join(rootDir, "public", "articles", "index.json");
const reportDir = path.join(rootDir, "reports");
const catalog = JSON.parse(await fs.readFile(catalogPath, "utf8"));

const issues = [];
const normalizedTitles = new Map();
const images = new Map();

function addIssue(article, severity, type, note) {
  issues.push({
    articleId: article.id,
    title: article.title,
    section: article.sectionLabel,
    severity,
    type,
    note,
  });
}

for (const article of catalog) {
  const title = String(article.title || "").trim();
  const normalizedTitle = title
    .toLocaleLowerCase("ru")
    .replace(/[«»"'.,:;!?()[\]{}]/g, "")
    .replace(/\s+/g, " ");

  if (!title || title.length < 2) {
    addIssue(article, "critical", "title", "Заголовок отсутствует или слишком короткий.");
  }
  if (/\s{2,}|\s+[,:;!?]/.test(title)) {
    addIssue(article, "high", "title", "В заголовке нарушены пробелы перед знаком препинания.");
  }
  if (/Р[А-Яа-я]|С[А-Яа-я]/.test(title) && /[ЃЌЋЏђѓћџ]/.test(title)) {
    addIssue(article, "critical", "encoding", "Возможна ошибка кодировки UTF-8.");
  }
  if (/\bvs\b/i.test(title)) {
    addIssue(article, "style", "title", "Для русского интерфейса предпочтительно «и экранизация».");
  }
  if (/["]/.test(title)) {
    addIssue(article, "style", "title", "Проверить замену прямых кавычек на русские «ёлочки».");
  }

  const sameTitles = normalizedTitles.get(normalizedTitle) || [];
  sameTitles.push(article.id);
  normalizedTitles.set(normalizedTitle, sameTitles);

  if (!article.imageUrl) {
    addIssue(article, "review", "image", "У статьи отсутствует редакционная иллюстрация.");
  } else {
    if (!/^https:\/\//i.test(article.imageUrl)) {
      addIssue(article, "high", "image", "Иллюстрация загружается не по HTTPS.");
    }
    const sameImages = images.get(article.imageUrl) || [];
    sameImages.push({
      id: article.id,
      section: article.sectionId,
      title: article.title,
    });
    images.set(article.imageUrl, sameImages);
  }
}

for (const [title, ids] of normalizedTitles) {
  if (title && ids.length > 1) {
    for (const articleId of ids) {
      const article = catalog.find((item) => item.id === articleId);
      addIssue(
        article,
        "review",
        "duplicate-title",
        `Одинаковый нормализованный заголовок у ${ids.length} материалов.`
      );
    }
  }
}

for (const [, entries] of images) {
  const sections = new Set(entries.map((entry) => entry.section));
  if (entries.length > 1 && sections.size > 1) {
    for (const entry of entries) {
      const article = catalog.find((item) => item.id === entry.id);
      addIssue(
        article,
        "review",
        "duplicate-image",
        "Одна иллюстрация используется в нескольких разных рубриках."
      );
    }
  }
}

const counts = issues.reduce(
  (result, issue) => {
    result[issue.severity] = (result[issue.severity] || 0) + 1;
    return result;
  },
  {}
);

const report = {
  generatedAt: new Date().toISOString(),
  articleCount: catalog.length,
  counts,
  issues,
};

await fs.mkdir(reportDir, { recursive: true });
await fs.writeFile(
  path.join(reportDir, "section-media-audit.json"),
  `${JSON.stringify(report, null, 2)}\n`
);

const markdown = [
  "# Проверка заголовков и иллюстраций",
  "",
  `Материалов: ${catalog.length}.`,
  `Критических: ${counts.critical || 0}.`,
  `Высоких: ${counts.high || 0}.`,
  `Стилистических: ${counts.style || 0}.`,
  `На ручную проверку: ${counts.review || 0}.`,
  ...(issues.length
    ? [
        "",
        ...issues.map(
          (issue) =>
            `- **${issue.severity} · ${issue.type}** — ${issue.title} (${issue.articleId}): ${issue.note}`
        ),
      ]
    : []),
];
await fs.writeFile(
  path.join(reportDir, "section-media-audit.md"),
  `${markdown.join("\n")}\n`
);

console.log(
  `Section media audit: ${catalog.length} articles, ${counts.critical || 0} critical, ${counts.high || 0} high, ${counts.style || 0} style, ${counts.review || 0} review.`
);

if ((counts.critical || 0) + (counts.high || 0) > 0) {
  process.exitCode = 1;
}
