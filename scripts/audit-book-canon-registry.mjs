import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { build } from "esbuild";

import {
  assessRegistryCompletion,
  classifyRegistryItem,
  registryIssues,
} from "./lib/book-canon-registry.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registryPath = path.join(projectRoot, "data", "book-canon-source-registry.json");
const cacheDirectory = path.join(projectRoot, "scripts", ".cache");
const bundlePath = path.join(cacheDirectory, `book-canon-source-${process.pid}.mjs`);
const reportsDirectory = path.join(projectRoot, "reports");
const strict = process.argv.includes("--strict");

async function sourceArchive() {
  await mkdir(cacheDirectory, { recursive: true });
  try {
    await build({
      absWorkingDir: projectRoot,
      entryPoints: [path.join(projectRoot, "scripts", "book-evidence-source.ts")],
      bundle: true,
      platform: "node",
      packages: "external",
      format: "esm",
      target: "node22",
      outfile: bundlePath,
      logLevel: "silent",
    });
    return await import(`${pathToFileURL(bundlePath).href}?v=${Date.now()}`);
  } finally {
    await rm(bundlePath, { force: true });
  }
}

const registry = JSON.parse(await readFile(registryPath, "utf8"));
const structuralIssues = registryIssues(registry);
if (structuralIssues.length > 0) {
  console.error(structuralIssues.join("\n"));
  process.exit(1);
}

const { archiveBooks } = await sourceArchive();
const sourceById = new Map(registry.sources.map((source) => [source.id, source]));
const authorityById = new Map(
  registry.authorities.map((authority) => [authority.authorityId, authority])
);
const adjudications = registry.inventories.flatMap((inventory) => {
  const source = sourceById.get(inventory.sourceId);
  const authority = authorityById.get(source.authorityId);
  return inventory.items.map((item) => ({
    sourceId: inventory.sourceId,
    sourceUrl: source.url,
    sourceClass: source.class,
    sourceScope: source.scope,
    authorityId: authority.authorityId,
    provider: authority.provider,
    authorityTier: authority.tier,
    authorityCountryId: authority.authorityCountryId,
    independenceGroup: authority.independenceGroup,
    ordinal: item.ordinal,
    itemId: item.itemId,
    itemUrl: item.itemUrl,
    itemHash: item.itemHash,
    titleExact: item.titleExact,
    contributorExact: item.contributorExact,
    candidateKind: item.candidateKind,
    entityKind: item.entityKind,
    adjudicationStatus: item.adjudicationStatus,
    adjudicatedRecordKey: item.adjudicatedRecordKey,
    adjudicatedAt: item.adjudicatedAt || null,
    adjudicatedBy: item.adjudicatedBy || null,
    adjudicationReason: item.adjudicationReason || null,
    adjudicationEvidenceUrls: Array.isArray(item.adjudicationEvidenceUrls)
      ? item.adjudicationEvidenceUrls
      : [],
    ...classifyRegistryItem(item, archiveBooks),
  }));
});

const statusCounts = Object.fromEntries(
  [
    ...adjudications.reduce((counts, item) => {
      counts.set(item.status, (counts.get(item.status) || 0) + 1);
      return counts;
    }, new Map()),
  ].sort(([left], [right]) => left.localeCompare(right, "en"))
);
const inventoryStatusCounts = Object.fromEntries(
  [
    ...registry.sources.reduce((counts, source) => {
      counts.set(
        source.inventoryStatus,
        (counts.get(source.inventoryStatus) || 0) + 1
      );
      return counts;
    }, new Map()),
  ].sort(([left], [right]) => left.localeCompare(right, "en"))
);
const snapshotStatusCounts = Object.fromEntries(
  [
    ...registry.sources.reduce((counts, source) => {
      counts.set(
        source.snapshot.snapshotStatus,
        (counts.get(source.snapshot.snapshotStatus) || 0) + 1
      );
      return counts;
    }, new Map()),
  ].sort(([left], [right]) => left.localeCompare(right, "en"))
);
const coverageStatusCounts = Object.fromEntries(
  [
    ...registry.sources.reduce((counts, source) => {
      counts.set(
        source.coverageStatus,
        (counts.get(source.coverageStatus) || 0) + 1
      );
      return counts;
    }, new Map()),
  ].sort(([left], [right]) => left.localeCompare(right, "en"))
);
const adjudicationStatusCounts = Object.fromEntries(
  [
    ...adjudications.reduce((counts, item) => {
      counts.set(
        item.adjudicationStatus,
        (counts.get(item.adjudicationStatus) || 0) + 1
      );
      return counts;
    }, new Map()),
  ].sort(([left], [right]) => left.localeCompare(right, "en"))
);
const sourceReviewOutcomeCounts = Object.fromEntries(
  registry.inventories.map((inventory) => {
    const sourceItems = adjudications.filter(
      (item) => item.sourceId === inventory.sourceId
    );
    return [
      inventory.sourceId,
      Object.fromEntries(
        ["accepted", "rejected", "held", "pending-review"].map((status) => [
          status,
          sourceItems.filter((item) => item.adjudicationStatus === status)
            .length,
        ])
      ),
    ];
  })
);
const sourceCandidateKindCounts = Object.fromEntries(
  registry.inventories.map((inventory) => {
    const sourceItems = adjudications.filter(
      (item) => item.sourceId === inventory.sourceId
    );
    return [
      inventory.sourceId,
      Object.fromEntries(
        [
          ...sourceItems.reduce((counts, item) => {
            counts.set(
              item.candidateKind,
              (counts.get(item.candidateKind) || 0) + 1
            );
            return counts;
          }, new Map()),
        ].sort(([left], [right]) => left.localeCompare(right, "en"))
      ),
    ];
  })
);
const completion = assessRegistryCompletion(registry, adjudications);
const {
  blockingItems,
  ...completionReport
} = completion;
const archiveCountryIds = new Set(archiveBooks.map((book) => book.countryId));
const authorityCountryIds = [
  ...new Set(
    registry.authorities.map((authority) => authority.authorityCountryId)
  ),
].sort((left, right) => left.localeCompare(right, "en"));

const report = {
  schemaVersion: 2,
  registryVersion: registry.registryVersion,
  snapshotDate: registry.snapshotDate,
  completionStatus: registry.completionStatus,
  countryCoverageStatus:
    "not-derived-from-authority-jurisdiction-or-source-list-size",
  summary: {
    archiveWorks: archiveBooks.length,
    archiveCountries: archiveCountryIds.size,
    controlledAuthorities: registry.authorities.length,
    authorityJurisdictions: authorityCountryIds.length,
    sourceLists: registry.sources.length,
    researchSourceLists: registry.sources.filter(
      (source) => source.inventoryStatus === "research"
    ).length,
    transcribedSourceLists: registry.sources.filter(
      (source) => source.inventoryStatus === "transcribed"
    ).length,
    adjudicatedSourceLists: registry.sources.filter(
      (source) => source.inventoryStatus === "adjudicated"
    ).length,
    verifiedContentSnapshotSourceLists: registry.sources.filter(
      (source) => source.snapshot.snapshotStatus === "verified-content-hash"
    ).length,
    unverifiedContentHashSourceLists: registry.sources.filter(
      (source) => source.snapshot.snapshotStatus !== "verified-content-hash"
    ).length,
    sourcesNotCompletionVerified: completion.unverifiedSourceIds.length,
    inventoriedItems: adjudications.length,
    candidateIdentityReviewItems: adjudications.filter(
      (item) => item.status === "candidate-needs-identity-review"
    ).length,
    recordedReviewOutcomeItems: adjudications.filter((item) =>
      ["accepted", "rejected", "held"].includes(item.adjudicationStatus)
    ).length,
    heldAdjudicationItems: adjudications.filter(
      (item) => item.adjudicationStatus === "held"
    ).length,
    blockingCoverageItems: blockingItems.length,
    confirmedWorkSpecificSignals:
      completion.confirmedWorkSpecificSignals,
    worksWithTwoIndependentSignals:
      completion.worksWithMinimumIndependentSignals.length,
    completionClaimed: completion.completionClaimed,
    completionEligible: completion.completionEligible,
    completionClaimValid: completion.completionClaimValid,
    inventoryStatusCounts,
    coverageStatusCounts,
    snapshotStatusCounts,
    adjudicationStatusCounts,
    sourceReviewOutcomeCounts,
    sourceCandidateKindCounts,
    statusCounts,
  },
  coverage: {
    authorityCountryIds,
    note:
      "An authority's jurisdiction is not evidence that the archive country is covered. Country completion is intentionally not calculated from source counts.",
  },
  completion: completionReport,
  authorities: registry.authorities,
  sources: registry.sources,
  adjudications,
};

await mkdir(reportsDirectory, { recursive: true });
await writeFile(
  path.join(reportsDirectory, "book-canon-source-coverage.json"),
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8"
);
await writeFile(
  path.join(reportsDirectory, "book-canon-source-coverage.md"),
  [
    "# Охват официальных источников мирового книжного канона",
    "",
    `Версия реестра: ${report.registryVersion}; дата аудита снимков: ${report.snapshotDate}.`,
    "",
    `- Статус реестра: ${registry.completionStatus}; завершение ${completion.completionClaimed ? "заявлено" : "не заявлено"}.`,
    `- Произведений в архиве: ${report.summary.archiveWorks}; стран в архиве: ${report.summary.archiveCountries}.`,
    `- Контролируемых авторитетов: ${report.summary.controlledAuthorities}; списков источников: ${report.summary.sourceLists}.`,
    `- Транскрибировано списков: ${report.summary.transcribedSourceLists}; списков с завершённой ручной adjudication: ${report.summary.adjudicatedSourceLists}.`,
    `- Проверенных снимков с content SHA-256: ${report.summary.verifiedContentSnapshotSourceLists}.`,
    `- Снимков без проверенного content SHA-256: ${report.summary.unverifiedContentHashSourceLists}.`,
    `- Источников, ещё не прошедших одновременно снимок, инвентаризацию и adjudication: ${report.summary.sourcesNotCompletionVerified}.`,
    `- Транскрибировано позиций: ${report.summary.inventoriedItems}.`,
    `- Кандидатов на ручную проверку идентичности Work: ${report.summary.candidateIdentityReviewItems}.`,
    `- Позиций с записанным ручным решением (accepted/rejected/held): ${report.summary.recordedReviewOutcomeItems}; holds: ${report.summary.heldAdjudicationItems}.`,
    `- Блокирующих позиций покрытия: ${report.summary.blockingCoverageItems}.`,
    `- Подтверждённых Work-специфичных сигналов: ${report.summary.confirmedWorkSpecificSignals}.`,
    `- Work с двумя независимыми сигналами: ${report.summary.worksWithTwoIndependentSignals}.`,
    "",
    "Юрисдикция учреждения не считается охватом страны архива. Метрика «полностью инвентаризированные страны» намеренно удалена.",
    "",
    "## Контролируемые авторитеты",
    "",
    ...registry.authorities.map(
      (authority) =>
        `- **${authority.authorityId}** - provider \`${authority.provider}\`, tier ${authority.tier}, independence group \`${authority.independenceGroup}\`, domains: ${authority.domains.join(", ")}.`
    ),
    "",
    "## Снимки источников",
    "",
    ...registry.sources.map(
      (source) =>
        `- **${source.id}** - inventory \`${source.inventoryStatus}\`; coverage \`${source.coverageStatus}\`; snapshot \`${source.snapshot.snapshotStatus}\`; extraction \`${source.snapshot.extractionMethod}/${source.snapshot.version}\`; content SHA-256: ${source.snapshot.contentSha256 || "не подтверждён"}.`
    ),
    "",
    "## Причины незавершённости",
    "",
    ...(completion.completionBlockingReasons.length > 0
      ? completion.completionBlockingReasons.map((reason) => `- ${reason}`)
      : ["- Нет."]),
    "",
    "## Статусы позиций",
    "",
    ...Object.entries(statusCounts).map(
      ([status, count]) => `- ${status}: ${count}`
    ),
    "",
    "## Решения ручной проверки",
    "",
    ...adjudications
      .filter((item) => item.adjudicationStatus !== "pending-review")
      .map(
        (item) =>
          `- **${item.sourceId}#${item.ordinal}: ${item.titleExact}** - ${item.contributorExact}; class \`${item.candidateKind}:${item.entityKind}\`; decision \`${item.adjudicationStatus}\`; target \`${item.adjudicatedRecordKey || "none"}\`; ${item.adjudicationReason}`
      ),
    "",
    "## Блокирующие позиции покрытия",
    "",
    ...(blockingItems.length > 0
      ? blockingItems.map(
          (item) =>
            `- **${item.titleExact}** - ${item.contributorExact}; ${item.status}; ${item.adjudicationReason || "решение ещё не принято"}; ${item.itemUrl}`
        )
      : ["- Нет."]),
    "",
    "> Автоматическое совпадение автора и названия создаёт только candidate-needs-identity-review. Оно не является принятым сигналом каноничности.",
    "",
    "> itemHash - SHA-256 точных полей записи реестра, включая редакционную классификацию candidateKind/entityKind. Это не хэш HTML источника. При отсутствии сохранённых исходных байтов snapshotStatus остаётся unverified-content-hash.",
    "",
  ].join("\n"),
  "utf8"
);

console.log(JSON.stringify(report.summary, null, 2));

if (!completion.completionClaimValid) {
  console.error("Invalid completion claim: two independent work-specific signals are not established.");
  process.exitCode = 1;
} else if (
  strict &&
  (!completion.completionClaimed || !completion.completionEligible)
) {
  process.exitCode = 1;
}
