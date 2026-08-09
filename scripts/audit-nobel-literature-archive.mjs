import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { build } from "esbuild";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cacheDirectory = path.join(projectRoot, "scripts", ".cache");
const bundlePath = path.join(cacheDirectory, "nobel-archive-source.mjs");
const reportDirectory = path.join(projectRoot, "reports");
const jsonPath = path.join(reportDirectory, "nobel-literature-archive-qa.json");
const markdownPath = path.join(reportDirectory, "nobel-literature-archive-qa.md");
const checkOnly = process.argv.includes("--check");
const NOBEL_SIGNAL = /нобел|nobel/iu;

async function sourceArchive() {
  await mkdir(cacheDirectory, { recursive: true });
  await build({
    absWorkingDir: projectRoot,
    entryPoints: [path.join(projectRoot, "scripts", "nobel-archive-source.ts")],
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

function biographyNobelYears(text) {
  const sentences = String(text || "").match(/[^.!?…]+[.!?…]?/gu) || [];
  return [
    ...new Set(
      sentences
        .filter((sentence) => NOBEL_SIGNAL.test(sentence))
        .flatMap((sentence) =>
          [...sentence.matchAll(/\b(?:19|20)\d{2}\b/gu)].map((match) =>
            Number(match[0])
          )
        )
    ),
  ].sort((a, b) => a - b);
}

function stableHash(value) {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function escapeCell(value) {
  return String(value ?? "").replace(/\|/gu, "\\|").replace(/\r?\n/gu, " ");
}

async function readOrEmpty(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

async function writeOrCheck(filePath, content) {
  const current = await readOrEmpty(filePath);
  if (current === content) return false;
  if (checkOnly) {
    throw new Error(`Stale deterministic report: ${path.relative(projectRoot, filePath)}`);
  }
  await writeFile(filePath, content, "utf8");
  return true;
}

const source = await sourceArchive();
const official = source.officialNobelLiteratureSnapshot;
const officialById = new Map(
  official.laureates.map((record) => [Number(record.id), record])
);
const cardByKey = new Map(source.nobelAuditCards.map((card) => [card.key, card]));
const mappingEntries = Object.entries(
  source.localNobelLiteratureWriterKeysByLaureateId
).map(([laureateId, writerKeys]) => ({
  laureateId: Number(laureateId),
  writerKeys: [...writerKeys],
}));
const mappedKeys = mappingEntries.flatMap(({ laureateId, writerKeys }) =>
  writerKeys.map((writerKey) => ({ laureateId, writerKey }))
);
const mappingKeyCounts = new Map();
for (const { writerKey } of mappedKeys) {
  mappingKeyCounts.set(writerKey, (mappingKeyCounts.get(writerKey) || 0) + 1);
}

const blockingIssues = [];
for (const officialRecord of official.laureates) {
  if (!source.localNobelLiteratureWriterKeysByLaureateId[officialRecord.id]) {
    blockingIssues.push({
      code: "official-laureate-unmapped",
      laureateId: officialRecord.id,
      value: officialRecord.name,
    });
  }
}
for (const { laureateId, writerKey } of mappedKeys) {
  const record = officialById.get(laureateId);
  const card = cardByKey.get(writerKey);
  if (!record) {
    blockingIssues.push({ code: "mapping-not-in-official-snapshot", laureateId, writerKey });
    continue;
  }
  if (!card) {
    blockingIssues.push({ code: "mapped-local-card-missing", laureateId, writerKey });
    continue;
  }
  const award = card.writer.nobelAward;
  for (const [field, actual, expected] of [
    ["nobelYear", card.writer.nobelYear, record.year],
    ["nobelAward.year", award?.year, record.year],
    ["nobelAward.laureateId", award?.laureateId, record.id],
    ["nobelAward.portion", award?.portion, record.portion],
    ["nobelAward.category", award?.category, "literature"],
  ]) {
    if (actual !== expected) {
      blockingIssues.push({
        code: "structured-metadata-mismatch",
        laureateId,
        writerKey,
        field,
        actual: actual ?? null,
        expected,
      });
    }
  }
  if (
    !Array.isArray(award?.sources) ||
    award.sources.length < 2 ||
    award.sources.some(
      ({ url }) => !/^https:\/\/(?:api\.|www\.)?nobelprize\.org\//u.test(url)
    )
  ) {
    blockingIssues.push({ code: "official-award-sources-missing", laureateId, writerKey });
  }
  const canonicalAward = `Нобелевская премия по литературе ${record.year} года`;
  if (card.writer.nobelPrize !== canonicalAward) {
    blockingIssues.push({
      code: "canonical-nobel-prize-label-missing",
      laureateId,
      writerKey,
      actual: card.writer.nobelPrize ?? null,
      expected: canonicalAward,
    });
  }
  const nobelAwardLabels = (card.writer.awards || []).filter((label) =>
    NOBEL_SIGNAL.test(label)
  );
  if (!nobelAwardLabels.some((label) => label.includes(String(record.year)))) {
    blockingIssues.push({
      code: "awards-list-missing-official-year",
      laureateId,
      writerKey,
      expected: record.year,
    });
  }
  const contradictoryAwardYears = nobelAwardLabels.flatMap((label) =>
    [...label.matchAll(/\b(?:19|20)\d{2}\b/gu)]
      .map((match) => Number(match[0]))
      .filter((year) => year !== record.year)
  );
  if (contradictoryAwardYears.length) {
    blockingIssues.push({
      code: "awards-list-year-mismatch",
      laureateId,
      writerKey,
      actual: [...new Set(contradictoryAwardYears)],
      expected: record.year,
    });
  }
  if (!(card.writer.tags || []).includes("Нобелевская премия")) {
    blockingIssues.push({ code: "nobel-tag-missing", laureateId, writerKey });
  }
}
for (const [writerKey, count] of mappingKeyCounts) {
  if (count !== 1) {
    blockingIssues.push({ code: "local-key-mapped-more-than-once", writerKey, count });
  }
}

const registeredKeySet = new Set(mappedKeys.map(({ writerKey }) => writerKey));
const biographyMentionCards = source.nobelAuditCards
  .filter((card) => NOBEL_SIGNAL.test(card.biography))
  .map((card) => ({
    key: card.key,
    name: card.writer.name || card.writer.fullName || card.writer.id,
    years: biographyNobelYears(card.biography),
    officialYear: card.writer.nobelAward?.year || null,
  }))
  .sort((a, b) => a.key.localeCompare(b.key, "en"));
const unregisteredBiographyMentions = biographyMentionCards.filter(
  (card) => !registeredKeySet.has(card.key)
);
for (const card of unregisteredBiographyMentions) {
  blockingIssues.push({ code: "unregistered-biography-nobel-mention", writerKey: card.key });
}
const biographyYearContradictions = biographyMentionCards.filter(
  ({ years, officialYear }) =>
    years.length > 0 && years.some((year) => year !== officialYear)
);
for (const card of biographyYearContradictions) {
  blockingIssues.push({
    code: "biography-nobel-year-mismatch",
    writerKey: card.key,
    actual: card.years,
    expected: card.officialYear,
  });
}

const structuredNobelSignalKeys = source.nobelAuditCards
  .filter(
    (card) =>
      card.writer.nobelAward ||
      card.writer.nobelYear ||
      card.writer.nobel ||
      card.writer.isNobel ||
      card.writer.nobelPrize ||
      (card.writer.awards || []).some((award) => NOBEL_SIGNAL.test(award))
  )
  .map((card) => card.key)
  .sort((a, b) => a.localeCompare(b, "en"));
const unregisteredStructuredSignals = structuredNobelSignalKeys.filter(
  (writerKey) => !registeredKeySet.has(writerKey)
);
for (const writerKey of unregisteredStructuredSignals) {
  blockingIssues.push({ code: "unregistered-structured-nobel-signal", writerKey });
}

const unresolvedFormerGaps = source.previouslyUnstructuredNobelWriterKeys.filter(
  (writerKey) => {
    const writer = cardByKey.get(writerKey)?.writer;
    return !writer?.nobelYear || !writer?.nobelAward?.laureateId;
  }
);
for (const writerKey of unresolvedFormerGaps) {
  blockingIssues.push({ code: "former-structured-gap-unresolved", writerKey });
}

const archiveWithoutOfficialIdentity = source.nobelArchiveLaureates.filter(
  (entry) => !entry.laureateId
);
for (const entry of archiveWithoutOfficialIdentity) {
  blockingIssues.push({
    code: "production-archive-used-legacy-fallback",
    writerKey: entry.key,
    year: entry.year,
  });
}
if (source.nobelArchiveLaureates.length !== 122) {
  blockingIssues.push({
    code: "archive-unique-count-mismatch",
    actual: source.nobelArchiveLaureates.length,
    expected: 122,
  });
}
if (new Set(source.nobelArchiveLaureates.map((entry) => entry.laureateId)).size !== 122) {
  blockingIssues.push({ code: "archive-official-id-deduplication-mismatch" });
}

const expectedSpecialStatuses = new Map([
  [604, "posthumous"],
  [629, "accepted-then-forced-to-decline"],
  [637, "declined"],
]);
for (const [laureateId, expected] of expectedSpecialStatuses) {
  for (const writerKey of source.localNobelLiteratureWriterKeysByLaureateId[laureateId]) {
    const actual = cardByKey.get(writerKey)?.writer.nobelAward?.specialStatus;
    if (actual !== expected) {
      blockingIssues.push({
        code: "special-status-mismatch",
        laureateId,
        writerKey,
        actual: actual ?? null,
        expected,
      });
    }
  }
}

const duplicatePeople = mappingEntries
  .filter(({ writerKeys }) => writerKeys.length > 1)
  .map(({ laureateId, writerKeys }) => ({
    laureateId,
    name: officialById.get(laureateId)?.name,
    writerKeys,
  }));
const biographyClaimsWithoutYear = biographyMentionCards.filter(
  ({ years }) => years.length === 0
);
const report = {
  version: 1,
  deterministic: true,
  sourceFingerprint: `sha256:${stableHash({
    official,
    mappingEntries,
    cards: mappedKeys.map(({ laureateId, writerKey }) => ({
      laureateId,
      writerKey,
      writer: cardByKey.get(writerKey)?.writer,
      biography: cardByKey.get(writerKey)?.biography,
    })),
  })}`,
  officialSource: {
    retrievedAt: official.retrievedAt,
    throughYear: official.throughYear,
    apiUrl: official.officialApiUrl,
    developerDocumentation: official.officialDeveloperDocumentation,
  },
  scope: {
    biographyTextChanged: false,
    editorialStatusesChanged: false,
    articlesChanged: false,
    productionArchiveRequiresStructuredMetadata: true,
  },
  summary: {
    officialLaureates: official.laureates.length,
    officialAwardYears: new Set(official.laureates.map(({ year }) => year)).size,
    localCardRepresentations: mappedKeys.length,
    uniqueStructuredOfficialIds: new Set(
      mappedKeys.map(({ laureateId }) => laureateId)
    ).size,
    duplicatePeopleWithCountryCards: duplicatePeople.length,
    biographyNobelMentions: biographyMentionCards.length,
    biographyClaimsWithExplicitYear: biographyMentionCards.filter(
      ({ years }) => years.length > 0
    ).length,
    biographyClaimsWithoutExplicitYear: biographyClaimsWithoutYear.length,
    biographyYearContradictions: biographyYearContradictions.length,
    officialCardsWithoutBiographyMention:
      mappedKeys.length - biographyMentionCards.length,
    previouslyUnstructuredCards: source.previouslyUnstructuredNobelWriterKeys.length,
    previouslyUnstructuredCardsResolved:
      source.previouslyUnstructuredNobelWriterKeys.length - unresolvedFormerGaps.length,
    productionArchiveEntriesUsingProseFallback: archiveWithoutOfficialIdentity.length,
    unregisteredBiographyMentions: unregisteredBiographyMentions.length,
    unregisteredStructuredSignals: unregisteredStructuredSignals.length,
    blockingIssues: blockingIssues.length,
  },
  sharedAwards: official.laureates
    .filter(({ portion }) => portion === "1/2")
    .map(({ id, name, year, portion }) => ({ id, name, year, portion })),
  specialCases: [...expectedSpecialStatuses].map(([laureateId, status]) => ({
    laureateId,
    name: officialById.get(laureateId)?.name,
    status,
    writerKeys: source.localNobelLiteratureWriterKeysByLaureateId[laureateId],
  })),
  duplicatePeople,
  biographyClaimsWithoutYear,
  unresolvedFormerGaps,
  unregisteredBiographyMentions,
  unregisteredStructuredSignals,
  blockingIssues,
};

const markdown = [
  "# QA архива Нобелевской премии по литературе",
  "",
  `Официальный источник: [Nobel Prize API](${report.officialSource.apiUrl}), snapshot от ${report.officialSource.retrievedAt}.`,
  "",
  "> Реестр проверяет структурированные поля награды; он не переписывает биографии и не выводит статус карточки из упоминания в тексте.",
  "",
  "## Итог",
  "",
  `- Официальных лауреатов 1901–${report.officialSource.throughYear}: ${report.summary.officialLaureates}; лет вручения: ${report.summary.officialAwardYears}.`,
  `- Локальных карточек: ${report.summary.localCardRepresentations}; уникальных official laureate ID: ${report.summary.uniqueStructuredOfficialIds}.`,
  `- Прежних пробелов \`nobelYear\`/award metadata закрыто: ${report.summary.previouslyUnstructuredCardsResolved} из ${report.summary.previouslyUnstructuredCards}.`,
  `- Bio с упоминанием Nobel: ${report.summary.biographyNobelMentions}; с явным годом: ${report.summary.biographyClaimsWithExplicitYear}; без года: ${report.summary.biographyClaimsWithoutExplicitYear}; неверных годов: ${report.summary.biographyYearContradictions}.`,
  `- Официальных карточек без Nobel в bio: ${report.summary.officialCardsWithoutBiographyMention}. Это допустимо: архив использует metadata.`,
  `- Production-записей, которым понадобился prose fallback: ${report.summary.productionArchiveEntriesUsingProseFallback}.`,
  `- Ложных/непривязанных bio-упоминаний: ${report.summary.unregisteredBiographyMentions}; непривязанных structured signals: ${report.summary.unregisteredStructuredSignals}.`,
  `- Блокирующих ошибок: ${report.summary.blockingIssues}.`,
  "",
  "## Дубли одной личности по странам",
  "",
  "| Official ID | Лауреат | Локальные карточки |",
  "| --- | --- | --- |",
  ...duplicatePeople.map(
    (item) =>
      `| ${item.laureateId} | ${escapeCell(item.name)} | ${item.writerKeys
        .map((key) => `\`${escapeCell(key)}\``)
        .join(", ")} |`
  ),
  "",
  "## Bio-утверждения без явного года",
  "",
  "| Ключ | Лауреат | Подтверждённый год |",
  "| --- | --- | --- |",
  ...biographyClaimsWithoutYear.map(
    (item) =>
      `| \`${escapeCell(item.key)}\` | ${escapeCell(item.name)} | ${item.officialYear} |`
  ),
  "",
  "## Особые случаи",
  "",
  ...report.specialCases.map(
    (item) =>
      `- ${item.name} (${item.laureateId}): \`${item.status}\` — ${item.writerKeys
        .map((key) => `\`${key}\``)
        .join(", ")}.`
  ),
  "",
  "Четыре совместных премии представлены восемью official records с `portion=1/2`: 1904, 1917, 1966 и 1974.",
  "",
].join("\n");

await mkdir(reportDirectory, { recursive: true });
const changed = await Promise.all([
  writeOrCheck(jsonPath, `${JSON.stringify(report, null, 2)}\n`),
  writeOrCheck(markdownPath, markdown),
]);

console.log(
  JSON.stringify(
    {
      ...report.summary,
      reportsChanged: changed.some(Boolean),
      checkOnly,
    },
    null,
    2
  )
);

if (blockingIssues.length) {
  throw new Error(`Nobel literature archive QA failed with ${blockingIssues.length} issue(s)`);
}
