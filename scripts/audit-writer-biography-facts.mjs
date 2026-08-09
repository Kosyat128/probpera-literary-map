import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { build } from "esbuild";

import { buildWriterBiographyFactQaReport } from "./lib/writer-biography-fact-qa.mjs";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const cacheDirectory = path.join(projectRoot, "scripts", ".cache");
const bundlePath = path.join(cacheDirectory, "writer-biography-fact-qa-source.mjs");
const stagingPath = path.join(
  projectRoot,
  "src",
  "data",
  "countries",
  "generated",
  "writers.generated.json"
);
const curatedQidsPath = path.join(
  projectRoot,
  "src",
  "data",
  "countries",
  "generated",
  "curatedWriterQids.generated.json"
);
const wikidataSnapshotPath = path.join(
  projectRoot,
  "src",
  "data",
  "countries",
  "generated",
  "writerFacts.wikidata.json"
);
const reportDirectory = path.join(projectRoot, "reports");
const jsonPath = path.join(reportDirectory, "writer-biography-fact-qa.json");
const markdownPath = path.join(reportDirectory, "writer-biography-fact-qa.md");
const checkOnly = process.argv.includes("--check");

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

function escapeCell(value) {
  return String(value ?? "")
    .replace(/\|/gu, "\\|")
    .replace(/\r?\n/gu, " ");
}

function issueRows(records, severities) {
  return records.flatMap((record) =>
    record.issues
      .filter((item) => severities.includes(item.severity))
      .map((item) =>
        `| \`${escapeCell(record.key)}\` | ${escapeCell(record.name)} | \`${escapeCell(
          item.field
        )}\` | \`${escapeCell(item.code)}\` | ${escapeCell(
          JSON.stringify(item.values)
        )} | ${escapeCell(item.safeFixCandidate || "Только ручная сверка")} |`
      )
  );
}

function markdownReport(report) {
  const { summary } = report;
  const contradictions = issueRows(report.contradictionQueue, [
    "contradiction",
    "high-confidence-source-conflict",
  ]);
  const calendarDifferences = issueRows(report.calendarOrSourceDiscrepancyQueue, [
    "calendar-or-source-discrepancy",
  ]);
  const manualResolutions = report.manualResolutionQueue.map(
    (item) =>
      `| \`${escapeCell(item.key)}\` | \`${escapeCell(item.field)}\` | \`${escapeCell(
        item.cardValue
      )}\` | \`${escapeCell(item.observedStagingValue)}\` | ${escapeCell(
        item.decision
      )} | ${escapeCell(
        item.sources.map((source) => `${source.title}: ${source.url}`).join("; ")
      )} |`
  );
  const wikidataDateDiscrepancies = report.wikidataDateDiscrepancyQueue.map(
    (item) =>
      `| \`${escapeCell(item.key)}\` | ${escapeCell(item.name)} | \`${escapeCell(
        item.qid
      )}\` | ${escapeCell(`${item.classificationCode}: ${item.classification}`)} | \`${escapeCell(item.field)}\` | \`${escapeCell(
        item.cardValue
      )}\` | ${escapeCell(
        item.bestRankClaims
          .map(
            (claim) =>
              `${claim.value} (${claim.precision}, ${claim.calendarId || "calendar?"}, ${
                claim.rank
              }, refs:${claim.referenceCount})`
          )
          .join("; ")
      )} | ${escapeCell(item.sourceUrl)} |`
  );
  const badQidRows = report.badQidIdentityQueue.map(
    (item) =>
      `| \`${escapeCell(item.key)}\` | ${escapeCell(item.name)} | \`${escapeCell(
        item.qid
      )}\` | ${escapeCell(JSON.stringify(item.entityLabels))} | ${escapeCell(
        String(item.cardBirthYear ?? "—")
      )} | ${escapeCell(JSON.stringify(item.wikidataBirthYears))} | ${escapeCell(
        item.portraitIdentityRisk ? "да" : "нет"
      )} |`
  );
  const metadataGaps = report.metadataGapQueue.map(
    (item) =>
      `| \`${escapeCell(item.key)}\` | ${escapeCell(item.name)} | \`${escapeCell(
        item.field
      )}\` | \`${escapeCell(item.code)}\` | ${escapeCell(
        JSON.stringify(item.values)
      )} | ${escapeCell(item.safeFixCandidate || "Только ручная сверка")} |`
  );
  const claimCounts = Object.entries(summary.claimTypeCounts).map(
    ([type, count]) => `- \`${type}\`: ${count}`
  );

  return [
    "# QA фактов в коротких русских биографиях писателей",
    "",
    `Источник данных: \`${report.sourceFingerprint}\`. Отчёт детерминирован: в нём нет текущей даты и при неизменных входных файлах он воспроизводится побайтно.`,
    "",
    "> Этот аудит не маркирует карточки, не меняет тексты и не утверждает, что весь корпус фактологически проверен. Он выполняет полную автоматическую инвентаризацию, находит внутренние противоречия и строит очередь ручной сверки.",
    "",
    "## Покрытие",
    "",
    `- Карточек и русских bio проверено алгоритмом: ${summary.writerCards}; bio присутствует: ${summary.biographiesPresent}.`,
    `- Надёжных identity-match с локальным staging: ${summary.reliableStagingIdentityMatches}.`,
    `- Из них source-confirmed structured cross-check: ${summary.sourceConfirmedStructuredCrossChecks} (${summary.sourceConfirmedCoveragePercent}%).`,
    `- Offline Wikidata snapshot содержит candidate QID для ${summary.wikidataSnapshotCandidateRecords} карточек, но label+birth-year identity corroborated только у ${summary.wikidataIdentityCorroboratedRecords} (${summary.wikidataStructuredTriageCoveragePercent}% корпуса); identity-discrepant: ${summary.wikidataIdentityDiscrepantRecords}, требуют дополнительной identity-проверки: ${summary.wikidataIdentityReviewRequiredRecords}.`,
    `- Сопоставлено полей дат со snapshot: ${summary.wikidataDateFieldsCompared}; exact Gregorian: ${summary.wikidataExactGregorianDateMatches}; совместимы при общей precision: ${summary.wikidataSharedPrecisionMatches}; несовместимых строк после curated resolutions: ${summary.wikidataUnresolvedDateDiscrepancies}. Из них ${summary.wikidataLikelyBadQidOrIdentityDateRows} сначала требуют identity repair, а ${summary.wikidataModernReferencedDateContradictions} — современные referenced-противоречия для проверки по авторитетному источнику.`,
    `- Ручных source-resolution с сохранёнными доказательствами: ${summary.manualResolutionEntries} в ${summary.manuallyResolvedRecords} карточках.`,
    `- Карточек с high-confidence противоречиями: ${summary.recordsWithConcreteContradictions}; отдельных противоречий: ${summary.concreteContradictionIssues}.`,
    `- Отдельно допустимые календарные/precision/source расхождения: ${summary.calendarOrSourceDiscrepancyRecords} карточек, ${summary.calendarOrSourceDiscrepancyIssues} полей.`,
    `- Metadata gaps (это не доказанные ошибки): ${summary.metadataGapIssues}.`,
    `- Bio, где хотя бы один тип утверждений всё ещё требует выбранного человеком источника: ${summary.recordsNeedingHumanClaimSources}.`,
    "- Статусов `reviewed`/`verified`, UI-плашек и текстов изменено: 0.",
    "",
    "## Типы утверждений во всём корпусе",
    "",
    ...claimCounts,
    "",
    "## High-confidence противоречия",
    "",
    "Сюда попадают только внутренние конфликты (например, bio/years/nobelYear против структурированного поля) и расхождения **года** с source-confirmed staging при надёжном identity-match. Wikidata candidate-расхождения сюда намеренно не включаются до отдельной label+birth-year identity validation; поэтому ноль в этой таблице не означает отсутствия snapshot-очереди ниже. Значения не исправляются автоматически.",
    "",
    "| Ключ | Писатель | Поле | Код | Значения | Безопасный кандидат исправления |",
    "| --- | --- | --- | --- | --- | --- |",
    ...(contradictions.length
      ? contradictions
      : ["| — | — | — | — | Не найдено | Исправление не требуется |"]),
    "",
    "## Календарные и source-precision расхождения",
    "",
    "Эти записи совпадают по году, но расходятся по месяцу или дню. Причиной может быть старый/новый стиль, неполная точность источника или ошибка данных. Они не считаются доказанной ошибкой текста.",
    "",
    "| Ключ | Писатель | Поле | Код | Значения | Безопасный кандидат исправления |",
    "| --- | --- | --- | --- | --- | --- |",
    ...(calendarDifferences.length
      ? calendarDifferences
      : ["| — | — | — | — | Не найдено | Исправление не требуется |"]),
    "",
    "## Разрешённые расхождения с более сильным источником",
    "",
    "Эти записи не считаются ошибками карточки: указанное значение вручную сопоставлено с более прямым или авторитетным источником. Решение ограничено конкретным полем и не означает полной проверки bio.",
    "",
    "| Ключ | Поле | Значение карточки | Staging | Решение | Источники |",
    "| --- | --- | --- | --- | --- | --- |",
    ...(manualResolutions.length
      ? manualResolutions
      : ["| — | — | — | — | Не найдено | — |"]),
    "",
    "## Offline Wikidata snapshot: структурированная очередь сверки",
    "",
    `Snapshot \`${report.wikidataStructuredSnapshot.qidSetSha256 || "без fingerprint"}\` содержит ${report.wikidataStructuredSnapshot.snapshotReturnedEntities} сущностей и даёт ${report.wikidataStructuredSnapshot.publicCardsWithSnapshotEntity} candidate-сопоставлений, но identity corroborated только у ${report.wikidataStructuredSnapshot.identityCorroboratedPublicCards}. Сравнение сохраняет RU/EN labels, rank, precision, calendar model и наличие ссылок. Совпадение с Wikidata не означает, что русский текст проверен; расхождение не исправляется автоматически.`,
    "",
    "| Ключ | Писатель | QID | Класс | Поле | Карточка | Лучшие Wikidata claims | Источник |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...(wikidataDateDiscrepancies.length
      ? wikidataDateDiscrepancies
      : ["| — | — | — | — | — | — | Неразрешённых расхождений нет | — |"]),
    "",
    "### QID identity discrepancies",
    "",
    "Эти QID нельзя использовать для исправления дат или изображений: RU/EN label и/или birth year противоречат карточке. Портрет, пришедший только через такой QID, должен быть изолирован до ремонта mapping.",
    "",
    "| Ключ | Писатель | QID | Labels | Год карточки | Годы Wikidata | Риск портрета |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...(badQidRows.length
      ? badQidRows
      : ["| — | — | — | — | — | — | Высокоуверенных identity discrepancies нет |"]),
    "",
    "## Пробелы metadata: не доказанные ошибки",
    "",
    "Здесь утверждение в bio не противоречит известному факту, но ему не соответствует локальное структурированное поле. Это отдельная очередь проверки; отсутствие metadata само по себе не опровергает текст.",
    "",
    "| Ключ | Писатель | Поле | Код | Значения | Безопасный кандидат исправления |",
    "| --- | --- | --- | --- | --- | --- |",
    ...(metadataGaps.length
      ? metadataGaps
      : ["| — | — | — | — | Не найдено | Исправление не требуется |"]),
    "",
    "## Что реально автоматизируется",
    "",
    "Полностью автоматизируются: обход всех карточек, выделение типов утверждений, проверка внутренней согласованности dates/years/nobelYear/works и сравнение структурированных дат там, где личность надёжно сопоставлена с source-confirmed staging.",
    "",
    "Не автоматизируются без ложной уверенности: истинность оценок вроде «крупнейший», темы и влияние, полнота списка произведений, выбор между конфликтующими датами и подтверждение каждой фразы. Для этого нужны claim-level источники и редактор. Полная машинная проверка текста: 0 карточек; полная машинная **триаж-проверка**: весь текущий корпус.",
    "",
    "Полная стабильная очередь находится в `writer-biography-fact-qa.json`; каждый элемент содержит hash bio, типы утверждений, evidence, issues и приоритет, но не меняет публикационный статус.",
    "",
  ].join("\n");
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

const [source, stagingPayload, curatedQidPayload, wikidataSnapshot] = await Promise.all([
  sourceArchive(),
  readFile(stagingPath, "utf8").then(JSON.parse),
  readFile(curatedQidsPath, "utf8").then(JSON.parse),
  readFile(wikidataSnapshotPath, "utf8").then(JSON.parse),
]);
const publicRecords = source.archiveCountries.flatMap((country) =>
  country.writers.map((writer) => ({
    countryId: country.id,
    countryName: country.name,
    writer,
  }))
);
const report = buildWriterBiographyFactQaReport({
  publicRecords,
  stagingPayload,
  curatedQids: curatedQidPayload.writers || {},
  wikidataSnapshot,
  biographySelector: source.legacyWriterBiography,
});
const json = `${JSON.stringify(report, null, 2)}\n`;
const markdown = markdownReport(report);

await mkdir(reportDirectory, { recursive: true });
const changed = await Promise.all([
  writeOrCheck(jsonPath, json),
  writeOrCheck(markdownPath, markdown),
]);

console.log(
  JSON.stringify(
    {
      ...report.summary,
      deterministic: report.deterministic,
      sourceFingerprint: report.sourceFingerprint,
      reportsChanged: changed.some(Boolean),
      checkOnly,
    },
    null,
    2
  )
);
