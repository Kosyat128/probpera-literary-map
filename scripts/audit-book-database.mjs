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

const {
  archiveBooks: books,
  archiveRawBooks: rawBooks,
  bookPublicationIssues,
  isPublicBook,
} = await sourceArchive();
const identityKeys = new Set();
const duplicates = [];
const criticalIssues = [];
const reviewQueue = [];
const translationIssues = [];
const externalIdOwners = new Map();
const strictTranslations = process.argv.includes("--strict-translations");

function registerExternalId(key, book, identity) {
  if (!key) return;
  if (!externalIdOwners.has(key)) externalIdOwners.set(key, new Map());
  externalIdOwners.get(key).set(identity, {
    identity,
    title: book.title,
    writer: book.writerName,
    country: book.countryName,
    status: book.editorial?.status || "draft",
  });
}

for (const book of books) {
  const identity = `${book.countryId}:${book.writerId}:${normalize(book.title)}`;
  if (identityKeys.has(identity)) duplicates.push(identity);
  identityKeys.add(identity);

  for (const externalId of book.externalIds || []) {
    registerExternalId(
      `${externalId.scheme}:${String(externalId.value).trim().toLocaleUpperCase("en")}`,
      book,
      identity
    );
  }
  const openLibraryId = `${book.id || ""} ${book.sourceUrl || ""}`
    .toLocaleUpperCase("en")
    .match(/OL\d+W/u)?.[0];
  if (openLibraryId) registerExternalId(`openlibrary:${openLibraryId}`, book, identity);

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

  if (["reviewed", "verified"].includes(book.editorial?.status || "")) {
    const issues = bookPublicationIssues(book);
    if (issues.length) {
      translationIssues.push({
        id: book.id,
        identity,
        title: book.title,
        writer: book.writerName,
        country: book.countryName,
        status: book.editorial?.status,
        issues,
      });
    }
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

const externalIdDuplicates = [...externalIdOwners.entries()]
  .filter(([, owners]) => owners.size > 1)
  .map(([externalId, owners]) => ({
    externalId,
    works: [...owners.values()],
  }));
const publishableExternalIdDuplicates = externalIdDuplicates.filter((duplicate) =>
  duplicate.works.some((work) => work.status !== "draft")
);
const quarantinedExternalIdDuplicates = externalIdDuplicates.filter((duplicate) =>
  duplicate.works.every((work) => work.status === "draft")
);
for (const duplicate of externalIdDuplicates) {
  if (duplicate.works.some((work) => work.status !== "draft")) {
    criticalIssues.push(
      `${duplicate.externalId}: внешний идентификатор назначен ${duplicate.works.length} произведениям, включая reviewed/verified`
    );
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
  rawSourceRecords: rawBooks.length,
  canonicalRecords: books.length,
  removedBySafeActions: rawBooks.length - books.length,
  publicRecords: books.filter(isPublicBook).length,
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
  bilingualReady: books.filter(isPublicBook).length,
  reviewedWithTranslationIssues: translationIssues.length,
  globalExternalIdDuplicates: externalIdDuplicates.length,
  publishableExternalIdDuplicates: publishableExternalIdDuplicates.length,
  quarantinedExternalIdDuplicates: quarantinedExternalIdDuplicates.length,
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
  globalExternalIdDuplicates: externalIdDuplicates,
  reviewedTranslationIssues: translationIssues,
  editorialQueue: reviewQueue,
  note:
    "Raw source count remains forensic and recoverable. Canonical count applies deterministic reject/merge actions. Source-identity conflicts counted only among drafts are quarantined and are not exported as syncable external IDs. Legacy-запись подтверждает только связь названия с автором.",
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
    `- Raw source-записей (forensic, без удаления): ${summary.rawSourceRecords}`,
    `- Canonical-записей после safe reject/merge: ${summary.canonicalRecords}; исключено/объединено: ${summary.removedBySafeActions}`,
    `- Публичных карточек после полного RU/EN gate: ${summary.publicRecords}`,
    `- Уникальных canonical-связей: ${summary.uniqueLinks}`,
    `- Подробных карточек: ${summary.detailedRecords}; кратких legacy-записей: ${summary.legacyRecords}`,
    `- Проверено: ${statuses.verified}; просмотрено: ${statuses.reviewed}; черновиков: ${statuses.draft}`,
    `- С годом первой публикации: ${summary.withFirstPublished}`,
    `- С языком оригинала: ${summary.withOriginalLanguage}`,
    `- С жанром: ${summary.withGenres}`,
    `- С редакционным описанием: ${summary.withDescription}`,
    `- С библиографическим источником: ${summary.withSource}`,
    `- С допустимым оформлением обложки: ${summary.withCoverArtwork}`,
    `- Готово к публичной RU/EN-публикации: ${summary.bilingualReady}`,
    `- Проверенных карточек с проблемами RU/EN или provenance: ${summary.reviewedWithTranslationIssues}`,
    `- Глобальных конфликтов внешних идентификаторов: ${summary.globalExternalIdDuplicates}`,
    `- Из них затрагивают publishable-записи: ${summary.publishableExternalIdDuplicates}; изолированы среди черновиков: ${summary.quarantinedExternalIdDuplicates}`,
    `- В редакционной очереди: ${summary.reviewQueue}`,
    `- Критических ошибок: ${summary.criticalIssues}`,
    "",
    "## Проверенные карточки, не прошедшие RU/EN-контроль",
    "",
    ...translationIssues.slice(0, 250).map(
      (book) =>
        `- **${book.title}** — ${book.writer}, ${book.country}; ${book.issues.join(", ")}`
    ),
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
if (
  criticalIssues.length ||
  duplicates.length ||
  (strictTranslations && translationIssues.length)
) {
  process.exitCode = 1;
}
