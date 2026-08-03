import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

import { build } from "esbuild";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const cacheDirectory = path.join(projectRoot, "scripts", ".cache");
const bundlePath = path.join(cacheDirectory, "country-database-audit-source.mjs");
const reportDirectory = path.join(projectRoot, "reports");

function normalized(value = "") {
  return String(value)
    .normalize("NFKC")
    .toLocaleLowerCase("ru")
    .replace(/ё/gu, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function coordinatesOf(country) {
  if (!country.coordinates) return null;
  if (Array.isArray(country.coordinates)) {
    return { lat: country.coordinates[0], lng: country.coordinates[1] };
  }
  return country.coordinates;
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

const source = await sourceArchive();
const countries = source.archiveCountries;
const statistics = source.archiveStatistics;
const editorial = source.countryEditorialAudit;
const criticalIssues = [];
const reviewQueue = [];
const ids = new Set();
const codes = new Set();

for (const country of countries) {
  const code = String(country.code || "").toLocaleLowerCase("en");
  if (!country.id || ids.has(country.id)) {
    criticalIssues.push(`${country.name || "Без названия"}: отсутствует или повторяется id`);
  }
  ids.add(country.id);
  if (!/^[a-z]{2}$/u.test(code) || codes.has(code)) {
    criticalIssues.push(`${country.id}: некорректный или повторяющийся код ${code || "—"}`);
  }
  codes.add(code);

  const coordinates = coordinatesOf(country);
  if (
    coordinates &&
    (Math.abs(coordinates.lat) > 90 || Math.abs(coordinates.lng) > 180)
  ) {
    criticalIssues.push(`${country.id}: координаты вне географического диапазона`);
  }

  const flagPath = path.join(
    projectRoot,
    "public",
    "assets",
    "country-flags",
    `${code}.svg`
  );
  if (!existsSync(flagPath)) {
    criticalIssues.push(`${country.id}: отсутствует локальный SVG-флаг`);
  }

  const missing = [];
  if (!country.capital) missing.push("столица");
  if (!country.description) missing.push("описание");
  if (!country.history && !country.historicalNote) missing.push("литературная история");
  if (!coordinates) missing.push("координаты карточки");
  if (!country.officialLanguage) missing.push("язык");
  if (!(country.literaryPeriods || country.periods)?.length) missing.push("эпохи");
  if (!country.literaryMovements?.length) missing.push("направления");
  if (!(country.timeline || country.chronology)?.length) missing.push("хронология");
  if (!country.facts?.length) missing.push("факты");
  if (!country.literaryPlaces?.length) missing.push("литературные места");

  if (missing.length) {
    reviewQueue.push({
      id: country.id,
      name: country.name,
      missing,
      writers: country.writers.length,
    });
  }
}

const writerRecords = countries.flatMap((country) =>
  country.writers.map((writer) => ({ country, writer }))
);
const writerKeys = new Set();
const duplicateWriterLinks = [];
for (const { country, writer } of writerRecords) {
  const key = writer.wikidataId
    ? `qid:${writer.wikidataId}`
    : `person:${normalized(writer.fullName || writer.name)}:${String(
        writer.birthDate || writer.birth || writer.years || ""
      ).match(/\d{3,4}/u)?.[0] || "—"}`;
  const localKey = `${country.id}:${key}`;
  if (writerKeys.has(localKey)) duplicateWriterLinks.push(localKey);
  writerKeys.add(localKey);
}

const summary = {
  countryCards: countries.length,
  uniqueCountryIds: ids.size,
  uniqueCountryCodes: codes.size,
  cardsWithWriters: countries.filter((country) => country.writers.length > 0).length,
  cardsWithCoordinates: countries.filter((country) => coordinatesOf(country)).length,
  cardsWithDescription: countries.filter((country) => country.description).length,
  cardsWithHistory: countries.filter(
    (country) => country.history || country.historicalNote
  ).length,
  cardsWithCapital: countries.filter((country) => country.capital).length,
  cardsWithTimeline: countries.filter(
    (country) => (country.timeline || country.chronology)?.length
  ).length,
  cardsWithFacts: countries.filter((country) => country.facts?.length).length,
  cardsWithLiteraryPlaces: countries.filter(
    (country) => country.literaryPlaces?.length
  ).length,
  writerRecords: statistics.writerRecords,
  uniqueWriters: statistics.uniqueWriters,
  workRecords: statistics.workRecords,
  uniqueWorks: statistics.uniqueWorks,
  verifiedWriters: editorial.verifiedWriters,
  sourcedWriters: editorial.sourcedWriters,
  expandedBiographies: editorial.expandedBiographies,
  portraitedWriters: editorial.portraitedWriters,
  duplicateWriterLinks: duplicateWriterLinks.length,
  criticalIssues: criticalIssues.length,
  cardsInEditorialQueue: reviewQueue.length,
};

const report = {
  generatedAt: new Date().toISOString(),
  summary,
  criticalIssues,
  duplicateWriterLinks,
  editorialQueue: reviewQueue,
  note:
    "Карточки стран и территорий учитываются как объекты литературного атласа. Структурная корректность не равна фактологической верификации редакцией.",
};

await mkdir(reportDirectory, { recursive: true });
await writeFile(
  path.join(reportDirectory, "country-database-audit.json"),
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8"
);
await writeFile(
  path.join(reportDirectory, "country-database-audit.md"),
  [
    "# Аудит базы стран литературного атласа",
    "",
    `Сформирован: ${report.generatedAt}`,
    "",
    "> Карточки стран и территорий — объекты литературного атласа. Структурная корректность не означает редакционную проверку всех фактов.",
    "",
    `- Карточек: ${summary.countryCards}; уникальных кодов: ${summary.uniqueCountryCodes}`,
    `- С писателями: ${summary.cardsWithWriters}/${summary.countryCards}`,
    `- С координатами: ${summary.cardsWithCoordinates}/${summary.countryCards}`,
    `- С описанием: ${summary.cardsWithDescription}/${summary.countryCards}`,
    `- С литературной историей: ${summary.cardsWithHistory}/${summary.countryCards}`,
    `- Со столицей: ${summary.cardsWithCapital}/${summary.countryCards}`,
    `- С хронологией: ${summary.cardsWithTimeline}/${summary.countryCards}`,
    `- С фактами: ${summary.cardsWithFacts}/${summary.countryCards}`,
    `- С литературными местами: ${summary.cardsWithLiteraryPlaces}/${summary.countryCards}`,
    `- Записей писателей: ${summary.writerRecords}; уникальных людей: ${summary.uniqueWriters}`,
    `- Проверенных писателей с источниками: ${summary.verifiedWriters}`,
    `- Расширенных биографий: ${summary.expandedBiographies}`,
    `- Карточек в очереди наполнения: ${summary.cardsInEditorialQueue}`,
    `- Критических структурных ошибок: ${summary.criticalIssues}`,
    "",
    "## Редакционная очередь стран",
    "",
    ...reviewQueue.flatMap((country) => [
      `- **${country.name}** (${country.id}, авторов: ${country.writers}): ${country.missing.join(", ")}`,
    ]),
  ].join("\n"),
  "utf8"
);

console.log(JSON.stringify(summary, null, 2));
if (criticalIssues.length || duplicateWriterLinks.length) process.exitCode = 1;
