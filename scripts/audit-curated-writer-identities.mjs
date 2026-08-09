import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createServer } from "vite";

import {
  auditWriterIdentityRecord,
  summarizeWriterIdentityAudit,
} from "./lib/writer-identity-audit.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const generatedDirectory = path.join(
  projectRoot,
  "src",
  "data",
  "countries",
  "generated"
);
const registryPath = path.join(
  generatedDirectory,
  "curatedWriterQids.generated.json"
);
const snapshotPath = path.join(generatedDirectory, "writerFacts.wikidata.json");
const remediationPath = path.join(
  generatedDirectory,
  "writerIdentityRemediations.generated.json"
);
const portraitManifestPath = path.join(
  generatedDirectory,
  "writerPortraits.generated.json"
);
const reportJsonPath = path.join(
  projectRoot,
  "reports",
  "curated-writer-identity-audit.json"
);
const reportMarkdownPath = path.join(
  projectRoot,
  "reports",
  "curated-writer-identity-audit.md"
);

async function loadBookArchiveCountries() {
  const vite = await createServer({
    root: projectRoot,
    appType: "custom",
    logLevel: "error",
    server: { middlewareMode: true },
  });
  try {
    const module = await vite.ssrLoadModule("/src/data/countries/index.ts");
    return module.bookArchiveCountries;
  } finally {
    await vite.close();
  }
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sourceFingerprint(...values) {
  const hash = createHash("sha256");
  for (const value of values) hash.update(stableJson(value), "utf8");
  return `sha256:${hash.digest("hex")}`;
}

function markdownCell(value) {
  return String(value ?? "")
    .replace(/\|/gu, "\\|")
    .replace(/\s+/gu, " ")
    .trim();
}

function buildMarkdown(report) {
  const { summary } = report;
  const lines = [
    "# Аудит соответствий писателей и Wikidata",
    "",
    `- Проверено старых соответствий: **${summary.legacyMappingsAudited}**.`,
    `- Активных соответствий после исправлений: **${summary.activeMappingsAfterRemediation}** (${summary.uniqueActiveQids} уникальных QID).`,
    `- Исправлено однозначных QID: **${summary.repairedMappings}**; удалено ложных соответствий без безопасной замены: **${summary.removedFalseMappings}**.`,
    `- Подтверждённых ложных соответствий из известного набора осталось: **${summary.knownFalseMappingsStillActive}**.`,
    `- Структурно подтверждены: **${summary.classificationCounts.corroborated || 0}**; требуют ручной проверки: **${summary.classificationCounts["review-required"] || 0}**; заблокированы: **${summary.classificationCounts.blocked || 0}**.`,
    `- Из runtime исключено устаревших привязок портретов: **${summary.stalePortraitKeys}**; из них реально присутствуют в старом manifest: **${summary.stalePortraitManifestEntries}**.`,
    "",
    "Wikidata используется как структурированный слой сверки (CC0), а не как источник готового редакционного текста. Конфликт даты сам по себе не исправляет карточку автоматически: он остаётся в очереди до проверки по библиотечному, архивному, издательскому или иному авторитетному источнику.",
    "",
    "## Исправленные соответствия",
    "",
    "| Карточка | Старый QID | Новый QID | Основание |",
    "| --- | --- | --- | --- |",
    ...report.remediations.repairedMappings.map(
      (item) =>
        `| \`${item.key}\` | [${item.oldQid}](https://www.wikidata.org/wiki/${item.oldQid}) | [${item.newQid}](https://www.wikidata.org/wiki/${item.newQid}) | ${markdownCell(item.reason)} |`
    ),
    "",
    "## Удалённые ложные соответствия",
    "",
    "| Карточка | Ложный QID | Основание |",
    "| --- | --- | --- |",
    ...report.remediations.removedMappings.map(
      (item) =>
        `| \`${item.key}\` | [${item.oldQid}](https://www.wikidata.org/wiki/${item.oldQid}) | ${markdownCell(item.reason)} |`
    ),
    "",
    "## Очередь ручной проверки",
    "",
    "| Карточка | QID | Метки | Описание | Сигналы |",
    "| --- | --- | --- | --- | --- |",
    ...report.reviewQueue.map((item) => {
      const labels = Object.values(item.labels || {}).join(" / ");
      const descriptions = Object.values(item.descriptions || {}).join(" / ");
      return `| \`${item.key}\` | [${item.qid}](${item.sourceUrl}) | ${markdownCell(labels)} | ${markdownCell(descriptions)} | ${item.issues.join(", ")} |`;
    }),
    "",
  ];
  return `${lines.join("\n")}\n`;
}

function knownFalseMappingsStillActive(registry, remediations) {
  return remediations.removedMappings.filter(
    (item) => registry.writers[item.key]?.wikidataId === item.oldQid
  );
}

function assertRemediationState(registry, remediations) {
  const expectedActiveCount =
    remediations.legacyMappingCount - remediations.removedMappings.length;
  if (Object.keys(registry.writers).length !== expectedActiveCount) {
    throw new Error(
      `Curated registry count mismatch: expected ${expectedActiveCount}, received ${Object.keys(registry.writers).length}`
    );
  }
  for (const item of remediations.repairedMappings) {
    if (registry.writers[item.key]?.wikidataId !== item.newQid) {
      throw new Error(`Repaired mapping is stale: ${item.key} -> ${item.newQid}`);
    }
  }
  for (const item of remediations.removedMappings) {
    if (registry.writers[item.key]) {
      throw new Error(`False mapping is still active: ${item.key}`);
    }
  }
}

async function buildReport() {
  const [registry, snapshot, remediations, portraitManifest, countries] =
    await Promise.all([
      readFile(registryPath, "utf8").then(JSON.parse),
      readFile(snapshotPath, "utf8").then(JSON.parse),
      readFile(remediationPath, "utf8").then(JSON.parse),
      readFile(portraitManifestPath, "utf8").then(JSON.parse),
      loadBookArchiveCountries(),
    ]);
  assertRemediationState(registry, remediations);

  const writerByKey = new Map(
    countries.flatMap((country) =>
      country.writers.map((writer) => [`${country.id}:${writer.id}`, writer])
    )
  );
  const entityByQid = new Map(
    (snapshot.entities || []).map((entity) => [entity.qid, entity])
  );
  const records = Object.entries(registry.writers)
    .sort(([first], [second]) => first.localeCompare(second, "en"))
    .map(([key, mapping]) =>
      auditWriterIdentityRecord({
        key,
        mapping,
        writer: writerByKey.get(key),
        entity: entityByQid.get(mapping.wikidataId),
      })
    );
  const knownFalseActive = knownFalseMappingsStillActive(
    registry,
    remediations
  );
  const activeSummary = summarizeWriterIdentityAudit(records);
  const stalePortraitManifestEntries = remediations.stalePortraitKeys.filter(
    (key) => portraitManifest.writers[key]
  );
  const uniqueActiveQids = new Set(
    Object.values(registry.writers).map((mapping) => mapping.wikidataId)
  );

  return {
    version: 1,
    deterministic: true,
    generatedAt: snapshot.retrievedAt,
    sourceFingerprint: sourceFingerprint(registry, snapshot, remediations),
    scope: {
      corpus: "legacy curated writer-key to Wikidata-QID registry",
      legacyMappingsAudited: remediations.legacyMappingCount,
      articlesChanged: false,
      booksChanged: false,
      writerProseChanged: false,
      statement:
        "The audit validates identity metadata only. It does not rewrite writer biographies or certify unresolved date conflicts.",
    },
    summary: {
      legacyMappingsAudited: remediations.legacyMappingCount,
      activeMappingsAfterRemediation: Object.keys(registry.writers).length,
      uniqueActiveQids: uniqueActiveQids.size,
      snapshotEntities: snapshot.entities?.length || 0,
      repairedMappings: remediations.repairedMappings.length,
      removedFalseMappings: remediations.removedMappings.length,
      knownFalseMappingsStillActive: knownFalseActive.length,
      stalePortraitKeys: remediations.stalePortraitKeys.length,
      stalePortraitManifestEntries: stalePortraitManifestEntries.length,
      ...activeSummary,
    },
    structuredSource: {
      name: snapshot.source?.name,
      endpoint: snapshot.source?.endpoint,
      license: snapshot.source?.license,
      licenseUrl: snapshot.source?.licenseUrl,
      retrievedAt: snapshot.retrievedAt,
      qidSetSha256: snapshot.source?.qidSetSha256,
      labelLanguages: snapshot.source?.labelLanguages || [],
      descriptionLanguages: snapshot.source?.descriptionLanguages || [],
      properties: snapshot.source?.properties || [],
    },
    remediations: {
      repairedMappings: remediations.repairedMappings,
      removedMappings: remediations.removedMappings,
      stalePortraitKeys: remediations.stalePortraitKeys,
      stalePortraitManifestEntries,
    },
    knownFalseMappingsStillActive: knownFalseActive,
    reviewQueue: records.filter(
      (record) => record.classification !== "corroborated"
    ),
    records,
  };
}

async function main() {
  const check = process.argv.includes("--check");
  const report = await buildReport();
  const json = stableJson(report);
  const markdown = buildMarkdown(report);
  if (check) {
    const [currentJson, currentMarkdown] = await Promise.all([
      readFile(reportJsonPath, "utf8"),
      readFile(reportMarkdownPath, "utf8"),
    ]);
    if (currentJson !== json || currentMarkdown !== markdown) {
      throw new Error("Curated writer identity audit reports are stale");
    }
  } else {
    await mkdir(path.dirname(reportJsonPath), { recursive: true });
    await Promise.all([
      writeFile(reportJsonPath, json, "utf8"),
      writeFile(reportMarkdownPath, markdown, "utf8"),
    ]);
  }
  console.log(JSON.stringify(report.summary, null, 2));
}

await main();
