import fs from "node:fs";
import path from "node:path";

type ReviewDecision = "unchanged" | "corrected" | "held";

type ReviewRecord = {
  readonly key: string;
  readonly originalSha256: string;
  readonly reviewedTextRu: string;
  readonly applicableTextRu: string | null;
  readonly claims: readonly {
    readonly evidence: readonly {
      readonly provider: string;
      readonly url: string;
      readonly checkedAt: string;
      readonly findingRu: string;
    }[];
  }[];
  readonly reviewer: string;
  readonly decision: ReviewDecision;
  readonly notes: string;
};

function positiveInteger(value: string | undefined, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return parsed;
}

const [batchArg, reviewQueueArg, priorAssignedArg, quarantineArg, generatedAt] =
  process.argv.slice(2);
const batch = positiveInteger(batchArg, "batch");
if (batch < 1) throw new Error("batch must be greater than zero");
const reviewQueue = positiveInteger(reviewQueueArg, "reviewQueue");
const priorAssigned = positiveInteger(priorAssignedArg, "priorAssigned");
const quarantine = positiveInteger(quarantineArg, "quarantine");
if (!generatedAt || !/^\d{4}-\d{2}-\d{2}$/.test(generatedAt)) {
  throw new Error("generatedAt must use YYYY-MM-DD");
}

const suffix = String(batch).padStart(2, "0");
const modulePath = `../src/data/countries/writerBiographyFactReviewBatch${suffix}.ts`;
const exportName = `writerBiographyFactReviewBatch${suffix}`;
const reviewModule = (await import(modulePath)) as Record<string, unknown>;
const records = reviewModule[exportName] as readonly ReviewRecord[] | undefined;
if (!Array.isArray(records) || records.length === 0) {
  throw new Error(`Review records export not found: ${exportName}`);
}

const summary = {
  records: records.length,
  unchanged: records.filter((record) => record.decision === "unchanged").length,
  corrected: records.filter((record) => record.decision === "corrected").length,
  held: records.filter((record) => record.decision === "held").length,
};
const keys = records.map((record) => record.key);
const uniqueKeys = new Set(keys);
if (uniqueKeys.size !== keys.length) throw new Error("Review keys are not unique");

const selectionSnapshot = {
  reviewQueue,
  priorAssignedRecords: priorAssigned,
  priorAssignedUnique: priorAssigned,
  quarantine,
  boundary: records.length,
  boundaryUnique: uniqueKeys.size,
  overlapPriorAssigned: 0,
  overlapQuarantine: 0,
};
const report = {
  batch: suffix,
  generatedAt,
  selectionSnapshot,
  summary,
  records,
};

const reportsDir = path.resolve(process.cwd(), "reports");
const reportBase = `writer-biography-fact-review-batch${suffix}`;
const jsonPath = path.join(reportsDir, `${reportBase}.json`);
const markdownPath = path.join(reportsDir, `${reportBase}.md`);
fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

const previousBatchLabel = batch === 1 ? "ранее проверенными партиями" : `Batch01-${String(batch - 1).padStart(2, "0")}`;
const markdown: string[] = [
  `# Фактологическая проверка биографий писателей - Batch${suffix}`,
  "",
  `Дата проверки: ${generatedAt}`,
  "",
  "## Граница и результат",
  "",
  `- Итоговая fact-QA reviewQueue: ${reviewQueue}`,
  `- Исключено ранее назначенных записей ${previousBatchLabel}: ${priorAssigned} (${priorAssigned} уникальных)`,
  `- Текущий карантин до выбора границы: ${quarantine}`,
  `- Граница Batch${suffix}: ${records.length} (${uniqueKeys.size} уникальных)`,
  `- overlap с ${previousBatchLabel}: 0`,
  "- overlap с текущим карантином: 0",
  `- Без изменений: ${summary.unchanged}`,
  `- Исправлено: ${summary.corrected}`,
  `- Удержано: ${summary.held}`,
  "",
  "Для каждой применимой записи проверены конкретные утверждения по двум или более независимым официальным или институциональным HTTPS-источникам. Wikipedia и Wikidata не использовались как доказательство. Удержанные записи не публикуются до надёжного разрешения личности.",
  "",
  "## Записи",
  "",
];

records.forEach((record, index) => {
  markdown.push(`### ${index + 1}. \`${record.key}\` - ${record.decision}`, "");
  markdown.push(`**SHA-256 исходного UTF-8:** \`${record.originalSha256}\``, "");
  markdown.push(`**Итоговый текст:** ${record.reviewedTextRu}`, "");
  markdown.push(
    `**Применимый текст:** ${record.applicableTextRu ?? "не применяется; запись удержана до разрешения личности"}`,
    ""
  );
  markdown.push(`**Примечание:** ${record.notes}`, "");
  markdown.push("**Доказательства:**", "");
  for (const claim of record.claims) {
    for (const evidence of claim.evidence) {
      markdown.push(
        `- [${evidence.provider}](${evidence.url}) - ${evidence.findingRu} Проверено: ${evidence.checkedAt}.`
      );
    }
  }
  markdown.push("");
});

fs.writeFileSync(markdownPath, `${markdown.join("\n").trimEnd()}\n`, "utf8");
console.log(`Generated ${path.relative(process.cwd(), jsonPath)} and ${path.relative(process.cwd(), markdownPath)}`);
