import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

import { build } from "esbuild";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const cacheDirectory = path.join(projectRoot, "scripts", ".cache");
const bundlePath = path.join(cacheDirectory, "editorial-language-source.mjs");
const reportDirectory = path.join(projectRoot, "reports");

async function sourceArchive() {
  await mkdir(cacheDirectory, { recursive: true });
  await build({
    absWorkingDir: projectRoot,
    entryPoints: [path.join(projectRoot, "scripts", "archive-source.ts")],
    bundle: true,
    platform: "node",
    packages: "external",
    format: "esm",
    target: "node22",
    outfile: bundlePath,
    logLevel: "silent",
  });
  return import(`${pathToFileURL(bundlePath).href}?v=${Date.now()}`);
}

function textDefects(value) {
  const text = String(value || "");
  const defects = [];
  if (!text) return defects;
  if (/\uFFFD|\u0000/gu.test(text)) defects.push("повреждённая кодировка");
  if (/\s+[,:;!?](?=\s|$)/gu.test(text)) defects.push("пробел перед знаком препинания");
  if (/[!?.,;:]{3,}/gu.test(text)) defects.push("повторяющиеся знаки препинания");
  if (/&(?:nbsp|quot|amp|lt|gt);/giu.test(text)) defects.push("необработанная HTML-сущность");
  if (text !== text.trim()) defects.push("пробел в начале или конце поля");
  return defects;
}

function validIsoDate(value) {
  if (!value) return true;
  const normalized = String(value).trim();
  // В исторической базе допустимы год, приблизительная дата и обозначение
  // века. Строго проверяем только значения, которые заявлены как ISO-дата.
  if (!/^\d{4}-/u.test(normalized)) return true;
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/u);
  if (!match) return false;
  const month = Number(match[2]);
  const day = Number(match[3]);
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

function addTextIssues(queue, identity, field, value, severity = "review") {
  for (const defect of textDefects(value)) {
    queue.push({ identity, field, issue: defect, severity });
  }
}

const { archiveCountries: countries, archiveBooks: books } = await sourceArchive();
const issues = [];

for (const country of countries) {
  addTextIssues(issues, `country:${country.id}`, "name", country.name, "critical");
  addTextIssues(issues, `country:${country.id}`, "description", country.description);
  addTextIssues(issues, `country:${country.id}`, "history", country.history || country.historicalNote);

  for (const writer of country.writers) {
    const identity = `writer:${country.id}:${writer.id}`;
    const name = String(writer.fullName || writer.name || "").trim();
    const biography = String(writer.biography || writer.bio || writer.description || "").trim();
    const status = writer.editorial?.status || "draft";

    if (!name) {
      issues.push({ identity, field: "name", issue: "отсутствует имя", severity: "critical" });
    } else if (/\d|https?:\/\//iu.test(name)) {
      issues.push({ identity, field: "name", issue: "недопустимые символы в имени", severity: "critical" });
    }
    addTextIssues(issues, identity, "name", name, "critical");
    addTextIssues(issues, identity, "biography", biography);
    for (const title of writer.works || []) addTextIssues(issues, identity, "work", title);

    if (!validIsoDate(writer.birthDate)) {
      issues.push({ identity, field: "birthDate", issue: `некорректная дата ${writer.birthDate}`, severity: "critical" });
    }
    if (!validIsoDate(writer.deathDate)) {
      issues.push({ identity, field: "deathDate", issue: `некорректная дата ${writer.deathDate}`, severity: "critical" });
    }

    if (status === "verified") {
      if (biography.length < 180) {
        issues.push({ identity, field: "biography", issue: "проверенная биография короче 180 знаков", severity: "review" });
      }
      if (!(writer.editorial?.sources || []).length) {
        issues.push({ identity, field: "sources", issue: "проверенная карточка без источников", severity: "critical" });
      }
      if (!(writer.works || writer.workDetails || []).length) {
        issues.push({ identity, field: "works", issue: "проверенная карточка без произведений", severity: "review" });
      }
    }
  }
}

for (const book of books) {
  const identity = `book:${book.countryId}:${book.writerId}:${book.id}`;
  const description = String(book.description || "").trim();
  const status = book.editorial?.status || "draft";
  addTextIssues(issues, identity, "title", book.title, "critical");
  addTextIssues(issues, identity, "description", description);
  if (status === "verified" && description.length < 120) {
    issues.push({ identity, field: "description", issue: "проверенная аннотация короче 120 знаков", severity: "review" });
  }
}

const critical = issues.filter((issue) => issue.severity === "critical");
const review = issues.filter((issue) => issue.severity === "review");
const summary = {
  countryCards: countries.length,
  writerRecords: countries.reduce((sum, country) => sum + country.writers.length, 0),
  bookRecords: books.length,
  findings: issues.length,
  critical: critical.length,
  review: review.length,
};

const report = {
  generatedAt: new Date().toISOString(),
  summary,
  critical,
  review,
  note:
    "Автоматическая проверка обнаруживает формальные дефекты и формирует очередь. Фактологический статус verified назначается только после сверки с указанными источниками.",
};

await mkdir(reportDirectory, { recursive: true });
await writeFile(
  path.join(reportDirectory, "editorial-language-audit.json"),
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8"
);
await writeFile(
  path.join(reportDirectory, "editorial-language-audit.md"),
  [
    "# Языковой аудит энциклопедии",
    "",
    `Сформирован: ${report.generatedAt}`,
    "",
    `- Стран: ${summary.countryCards}`,
    `- Записей писателей: ${summary.writerRecords}`,
    `- Записей книг: ${summary.bookRecords}`,
    `- Критических дефектов: ${summary.critical}`,
    `- Замечаний для редакционной проверки: ${summary.review}`,
    "",
    "## Критические дефекты",
    "",
    ...(critical.length
      ? critical.map((issue) => `- **${issue.identity}** · ${issue.field}: ${issue.issue}`)
      : ["Критических формальных дефектов не обнаружено."]),
    "",
    "## Редакционная очередь",
    "",
    ...review.slice(0, 500).map(
      (issue) => `- **${issue.identity}** · ${issue.field}: ${issue.issue}`
    ),
  ].join("\n"),
  "utf8"
);

console.log(JSON.stringify(summary, null, 2));
if (critical.length) process.exitCode = 1;
