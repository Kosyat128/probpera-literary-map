import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

import { build } from "esbuild";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const cacheDirectory = path.join(projectRoot, "scripts", ".cache");
const bundlePath = path.join(cacheDirectory, "book-database-audit-source.mjs");
const reportDirectory = path.join(projectRoot, "reports");
const currentYear = new Date().getUTCFullYear();

function normalize(value = "") {
  return String(value)
    .normalize("NFKC")
    .toLocaleLowerCase("ru")
    .replace(/ё/gu, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

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

const { archiveBooks: books } = await sourceArchive();
const identityKeys = new Set();
const duplicates = [];
const criticalIssues = [];
const reviewQueue = [];

for (const book of books) {
  const identity = `${book.countryId}:${book.writerId}:${normalize(book.title)}`;
  if (identityKeys.has(identity)) duplicates.push(identity);
  identityKeys.add(identity);

  if (!book.title?.trim()) criticalIssues.push(`${book.id}: отсутствует название`);
  if (!book.writerId || !book.countryId) {
    criticalIssues.push(`${book.id}: потеряна связь с автором или страной`);
  }
  if (
    book.firstPublished !== undefined &&
    (!Number.isInteger(book.firstPublished) || book.firstPublished > currentYear)
  ) {
    criticalIssues.push(`${identity}: некорректный год ${book.firstPublished}`);
  }
  if (book.editorial?.status === "verified") {
    if (!book.sourceUrl) criticalIssues.push(`${identity}: verified без источника`);
    if (!book.description) criticalIssues.push(`${identity}: verified без описания`);
    if (!book.firstPublished) criticalIssues.push(`${identity}: verified без года`);
  }

  const missing = [];
  if (!book.firstPublished) missing.push("год первой публикации");
  if (!book.originalLanguage) missing.push("язык оригинала");
  if (!book.genres?.length) missing.push("жанр");
  if (!book.description) missing.push("редакционное описание");
  if (!book.sourceUrl) missing.push("библиографический источник");
  if (!book.coverUrl) missing.push("обложка или редакционная иллюстрация");
  if (book.editorial?.status !== "verified") missing.push("финальная проверка");
  if (missing.length) {
    reviewQueue.push({
      id: book.id,
      title: book.title,
      writer: book.writerName,
      country: book.countryName,
      status: book.editorial?.status || "draft",
      missing,
    });
  }
}

const statuses = Object.fromEntries(
  ["verified", "reviewed", "draft"].map((status) => [
    status,
    books.filter((book) => (book.editorial?.status || "draft") === status).length,
  ])
);
const coverStatuses = {};
for (const book of books.filter((entry) => entry.coverUrl)) {
  const status = book.coverRights?.status || "unverified";
  coverStatuses[status] = (coverStatuses[status] || 0) + 1;
}

const summary = {
  records: books.length,
  uniqueLinks: identityKeys.size,
  detailedRecords: books.filter((book) => !book.id.startsWith("legacy-")).length,
  legacyRecords: books.filter((book) => book.id.startsWith("legacy-")).length,
  statuses,
  withFirstPublished: books.filter((book) => book.firstPublished).length,
  withOriginalLanguage: books.filter((book) => book.originalLanguage).length,
  withGenres: books.filter((book) => book.genres?.length).length,
  withDescription: books.filter((book) => book.description).length,
  withSource: books.filter((book) => book.sourceUrl).length,
  withCoverArtwork: books.filter((book) => book.coverUrl).length,
  coverStatuses,
  reviewQueue: reviewQueue.length,
  duplicateLinks: duplicates.length,
  criticalIssues: criticalIssues.length,
};

const report = {
  generatedAt: new Date().toISOString(),
  summary,
  criticalIssues,
  duplicateLinks: duplicates,
  editorialQueue: reviewQueue,
  note:
    "Legacy-запись подтверждает только связь названия с автором. Статус verified разрешён лишь при наличии года, описания и библиографического источника.",
};

await mkdir(reportDirectory, { recursive: true });
await writeFile(
  path.join(reportDirectory, "book-database-audit.json"),
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8"
);
await writeFile(
  path.join(reportDirectory, "book-database-audit.md"),
  [
    "# Аудит книжной базы",
    "",
    `Сформирован: ${report.generatedAt}`,
    "",
    "> Legacy-запись подтверждает только связь названия с автором. Проверенной книга считается лишь после библиографической и редакционной проверки.",
    "",
    `- Записей: ${summary.records}; уникальных связей: ${summary.uniqueLinks}`,
    `- Подробных карточек: ${summary.detailedRecords}; кратких legacy-записей: ${summary.legacyRecords}`,
    `- Проверено: ${statuses.verified}; просмотрено: ${statuses.reviewed}; черновиков: ${statuses.draft}`,
    `- С годом первой публикации: ${summary.withFirstPublished}`,
    `- С языком оригинала: ${summary.withOriginalLanguage}`,
    `- С жанром: ${summary.withGenres}`,
    `- С редакционным описанием: ${summary.withDescription}`,
    `- С библиографическим источником: ${summary.withSource}`,
    `- С допустимым оформлением обложки: ${summary.withCoverArtwork}`,
    `- В редакционной очереди: ${summary.reviewQueue}`,
    `- Критических ошибок: ${summary.criticalIssues}`,
    "",
    "## Первые 250 записей редакционной очереди",
    "",
    ...reviewQueue.slice(0, 250).map(
      (book) =>
        `- **${book.title}** — ${book.writer}, ${book.country}; статус: ${book.status}; требуется: ${book.missing.join(", ")}`
    ),
  ].join("\n"),
  "utf8"
);

console.log(JSON.stringify(summary, null, 2));
if (criticalIssues.length || duplicates.length) process.exitCode = 1;
