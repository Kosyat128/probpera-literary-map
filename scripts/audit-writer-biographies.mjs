import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

import { build } from "esbuild";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const cacheDirectory = path.join(projectRoot, "scripts", ".cache");
const bundlePath = path.join(cacheDirectory, "writer-biography-audit-source.mjs");
const reportDirectory = path.join(projectRoot, "reports");
const legacyStagingPath = path.join(
  projectRoot,
  "src",
  "data",
  "countries",
  "generated",
  "writers.generated.json"
);

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

function displayName(writer) {
  return writer.name || writer.fullName || writer.id || "Без имени";
}

function duplicateKey(value, normalizeBiographyText) {
  return normalizeBiographyText(value)
    .normalize("NFKC")
    .toLocaleLowerCase("ru")
    .replace(/ё/gu, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function workflowFor(writer, translation, flags, ready, research) {
  const usableResearchDraft = Boolean(research?.present && !research.issues.length);
  const sourceResearchComplete =
    usableResearchDraft ||
    Boolean(translation?.sources?.length && !flags.unsourced);
  const rightsReviewComplete = Boolean(
    usableResearchDraft ||
      (translation?.method &&
        !flags.rightsUnproven &&
        !flags.licensedMetadataMissing &&
        !flags.humanTranslationRightsMissing)
  );
  const editorialDraftComplete = Boolean(
    usableResearchDraft ||
      (translation?.text && !flags.missing && !flags.short && !flags.generic)
  );
  const factCheckComplete = Boolean(
    research?.publishable ||
      (translation && ["reviewed", "verified"].includes(translation.status))
  );
  const languageReviewComplete = ready;

  let state = "ready";
  let nextAction = "No action required unless a source changes.";
  if (!ready) {
    if (!sourceResearchComplete) {
      state = "source-research";
      nextAction =
        "Verify identity and core facts in authoritative sources; record field-level provenance.";
    } else if (!rightsReviewComplete) {
      state = "rights-review";
      nextAction =
        "Record the text-creation method and, where applicable, the exact license or permission.";
    } else if (!editorialDraftComplete) {
      state = "editorial-rewrite";
      nextAction =
        "Write an original, specific Russian biography of 2-4 sentences without copying source prose.";
    } else if (!factCheckComplete) {
      state = "fact-check";
      nextAction =
        "Check every biographical claim against the recorded sources and set reviewed/verified status.";
    } else {
      state = "language-review";
      nextAction =
        "Edit the Russian text for clarity, factual precision and publication-gate compliance.";
    }
  }

  const priority = writer.nobelYear
    ? "P0"
    : (writer.works?.length || writer.workDetails?.length || 0) >= 3
      ? "P1"
      : "P2";

  return {
    state,
    priority,
    completed: {
      sourceResearch: sourceResearchComplete,
      rightsReview: rightsReviewComplete,
      editorialDraft: editorialDraftComplete,
      factCheck: factCheckComplete,
      languageReview: languageReviewComplete,
    },
    nextAction,
  };
}

async function legacyStagingSummary() {
  try {
    const payload = JSON.parse(await readFile(legacyStagingPath, "utf8"));
    const records = Object.values(payload).flatMap((writers) =>
      Array.isArray(writers) ? writers : []
    );
    return {
      records: records.length,
      recordsWithProseFields: records.filter((writer) =>
        Boolean(writer?.bio || writer?.biography || writer?.description)
      ).length,
      publicMergeEnabled: false,
    };
  } catch {
    return { records: 0, recordsWithProseFields: 0, publicMergeEnabled: false };
  }
}

const source = await sourceArchive();
const researchDrafts = source.writerBiographyResearchDrafts || [];
const researchDraftKeyCounts = new Map();
for (const draft of researchDrafts) {
  researchDraftKeyCounts.set(
    draft.key,
    (researchDraftKeyCounts.get(draft.key) || 0) + 1
  );
}
const researchDraftByKey = new Map(
  researchDrafts
    .filter((draft) => researchDraftKeyCounts.get(draft.key) === 1)
    .map((draft) => [draft.key, draft])
);
const researchDraftIssuesByKey = new Map(
  [...researchDraftByKey].map(([key, draft]) => [
    key,
    source.writerBiographyResearchDraftIssues(draft),
  ])
);
const records = source.archiveCountries.flatMap((country) =>
  country.writers.map((writer) => ({
    countryId: country.id,
    countryName: country.name,
    writer,
  }))
);

const duplicateGroups = new Map();
for (const record of records) {
  const text =
    record.writer.biographyTranslations?.ru?.text ||
    source.legacyWriterBiography(record.writer);
  if (!text) continue;
  const key = duplicateKey(text, source.normalizeBiographyText);
  if (!key) continue;
  const group = duplicateGroups.get(key) || [];
  group.push(record);
  duplicateGroups.set(key, group);
}
const repeatedGroups = [...duplicateGroups.entries()].filter(
  ([, group]) => group.length > 1
);
const duplicateRecordKeys = new Set(
  repeatedGroups.flatMap(([, group]) =>
    group.map((record) => `${record.countryId}:${record.writer.id}`)
  )
);

const reviewQueue = records.map((record) => {
  const { writer } = record;
  const ruTranslation = writer.biographyTranslations?.ru;
  const enTranslation = writer.biographyTranslations?.en;
  const legacyText = source.legacyWriterBiography(writer);
  const auditedText = ruTranslation?.text || legacyText;
  const sentenceCount = source.countBiographySentences(auditedText);
  const ruPublicationIssues = source.writerBiographyQualityIssues(
    ruTranslation,
    "ru",
    writer
  );
  const enPublicationIssues = source.writerBiographyQualityIssues(
    enTranslation,
    "en",
    writer
  );
  const sourceIncomplete =
    !ruTranslation?.sources?.length ||
    ruTranslation.sources.some(
      (item) =>
        !item.provider?.trim() ||
        !/^https:\/\//iu.test(item.url || "") ||
        !item.fields?.length ||
        !item.retrievedAt
    );
  const licensedMetadataMissing =
    ruTranslation?.method === "licensed-source" &&
    !ruTranslation.sources.some(
      (item) =>
        item.usage === "licensed-copy" &&
        item.licenseName?.trim() &&
        /^https:\/\//iu.test(item.licenseUrl || "")
    );
  const humanTranslationRightsMissing =
    ruTranslation?.method === "human-translation" &&
    !ruTranslation.sourceTextRights;
  const recordKey = `${record.countryId}:${writer.id}`;
  const researchDraft = researchDraftByKey.get(recordKey) || null;
  const research = {
    present: Boolean(researchDraft),
    status: researchDraft?.status || null,
    author: researchDraft?.author || null,
    researchedAt: researchDraft?.researchedAt || null,
    sourceCount: researchDraft?.sources?.length || 0,
    localeDrafts: researchDraft
      ? Object.keys(researchDraft.translations || {}).sort()
      : [],
    reviewDecision: researchDraft?.review?.decision || null,
    reviewer: researchDraft?.review?.reviewer || null,
    reviewedAt: researchDraft?.review?.reviewedAt || null,
    issues: researchDraftIssuesByKey.get(recordKey) || [],
    publishable: Boolean(
      researchDraft &&
        source.isWriterBiographyResearchDraftPublishable(researchDraft)
    ),
  };
  const flags = {
    missing: !auditedText,
    short: Boolean(auditedText) && (auditedText.length < 120 || sentenceCount < 2),
    overlyLong:
      Boolean(auditedText) && (auditedText.length > 1_600 || sentenceCount > 4),
    generic: Boolean(auditedText) && source.isGenericBiographyText(auditedText),
    duplicate: duplicateRecordKeys.has(recordKey),
    unsourced: sourceIncomplete,
    rightsUnproven: !ruTranslation?.method,
    licensedMetadataMissing,
    humanTranslationRightsMissing,
  };

  const russianReady = Boolean(source.selectWriterBiography(writer, "ru"));
  const workflow = workflowFor(
    writer,
    ruTranslation,
    flags,
    russianReady,
    research
  );
  const sourceCandidates = [
    ...(researchDraft?.sources || []).map((item) => ({
      title: item.title || item.provider,
      provider: item.provider,
      url: item.url,
    })),
    ...(writer.editorial?.sources || []).map((item) => ({
      title: item.title,
      provider: item.publisher || null,
      url: item.url,
    })),
    ...(writer.wikidataId
      ? [
          {
            title: `Wikidata ${writer.wikidataId}`,
            provider: "Wikidata",
            url: `https://www.wikidata.org/wiki/${writer.wikidataId}`,
          },
        ]
      : []),
  ].filter(
    (item, index, items) =>
      item.url && items.findIndex((candidate) => candidate.url === item.url) === index
  );

  return {
    id: writer.id,
    name: displayName(writer),
    countryId: record.countryId,
    countryName: record.countryName,
    russian: {
      ready: russianReady,
      textLength: auditedText.length,
      sentenceCount,
      legacyTextPresent: Boolean(legacyText),
      structuredTranslationPresent: Boolean(ruTranslation),
      method: ruTranslation?.method || null,
      issues: ruPublicationIssues,
    },
    english: {
      ready: Boolean(source.selectWriterBiography(writer, "en")),
      structuredTranslationPresent: Boolean(enTranslation),
      method: enTranslation?.method || null,
      issues: enPublicationIssues,
    },
    flags,
    research,
    workflow,
    sourceCandidates,
  };
});

const staged = await legacyStagingSummary();
const archiveRecordKeys = new Set(
  records.map((record) => `${record.countryId}:${record.writer.id}`)
);
const duplicateResearchDraftKeys = [...researchDraftKeyCounts]
  .filter(([, count]) => count > 1)
  .map(([key]) => key);
const validResearchDrafts = [...researchDraftByKey.values()].filter(
  (draft) => !source.writerBiographyResearchDraftIssues(draft).length
);
const summary = {
  writerRecords: records.length,
  russianReady: reviewQueue.filter((record) => record.russian.ready).length,
  russianWithheld: reviewQueue.filter((record) => !record.russian.ready).length,
  englishReady: reviewQueue.filter((record) => record.english.ready).length,
  englishWithheld: reviewQueue.filter((record) => !record.english.ready).length,
  legacyRussianTextPresent: reviewQueue.filter(
    (record) => record.russian.legacyTextPresent
  ).length,
  structuredRussianBiographyPresent: reviewQueue.filter(
    (record) => record.russian.structuredTranslationPresent
  ).length,
  missingBiography: reviewQueue.filter((record) => record.flags.missing).length,
  shortBiography: reviewQueue.filter((record) => record.flags.short).length,
  overlyLongBiography: reviewQueue.filter((record) => record.flags.overlyLong).length,
  genericBiography: reviewQueue.filter((record) => record.flags.generic).length,
  duplicateBiographyRecords: reviewQueue.filter((record) => record.flags.duplicate)
    .length,
  duplicateBiographyGroups: repeatedGroups.length,
  unsourcedBiography: reviewQueue.filter((record) => record.flags.unsourced).length,
  rightsUnproven: reviewQueue.filter((record) => record.flags.rightsUnproven).length,
  licensedCopyMissingMetadata: reviewQueue.filter(
    (record) => record.flags.licensedMetadataMissing
  ).length,
  humanTranslationRightsMissing: reviewQueue.filter(
    (record) => record.flags.humanTranslationRightsMissing
  ).length,
  researchDrafts: researchDrafts.length,
  validResearchDrafts: validResearchDrafts.length,
  researchDraftsWithRussianAndEnglish: validResearchDrafts.filter(
    (draft) => draft.translations?.ru && draft.translations?.en
  ).length,
  researchDraftsAwaitingIndependentReview: validResearchDrafts.filter(
    (draft) =>
      draft.status === "research" && draft.review?.decision === "pending"
  ).length,
  researchDraftsApprovedForPromotion: validResearchDrafts.filter((draft) =>
    source.isWriterBiographyResearchDraftPublishable(draft)
  ).length,
  duplicateResearchDraftKeys: duplicateResearchDraftKeys.length,
  orphanResearchDrafts: researchDrafts.filter(
    (draft) => !archiveRecordKeys.has(draft.key)
  ).length,
  withheldWithoutResearchDraft: reviewQueue.filter(
    (record) => !record.russian.ready && !record.research.present
  ).length,
  stagingRecords: staged.records,
  stagingRecordsWithLegacyProse: staged.recordsWithProseFields,
};

const queue = reviewQueue.filter((record) => !record.russian.ready);
const workflowStates = Object.fromEntries(
  [
    "source-research",
    "rights-review",
    "editorial-rewrite",
    "fact-check",
    "language-review",
    "ready",
  ].map((state) => [
    state,
    reviewQueue.filter((record) => record.workflow.state === state).length,
  ])
);
const duplicateBiographyGroups = repeatedGroups.map(([key, group]) => ({
  normalizedText: key,
  records: group.map((record) => ({
    id: record.writer.id,
    name: displayName(record.writer),
    countryId: record.countryId,
  })),
}));
const report = {
  generatedAt: new Date().toISOString(),
  summary,
  staging: staged,
  policy: {
    publicRussianRule:
      "Only locale-exact, reviewed/verified biographies with per-text provenance and a lawful creation method are visitor-facing.",
    researchDraftRule:
      "Research drafts remain visitor-hidden until an independent reviewer approves them; the runtime promotion loader rejects invalid and duplicate keys.",
    legalCaution:
      "rightsUnproven means that this repository does not record enough evidence for publication; it is not a legal finding of infringement.",
  },
  duplicateBiographyGroups,
  researchDraftQueue: researchDrafts.map((draft) => ({
    key: draft.key,
    author: draft.author,
    status: draft.status,
    researchedAt: draft.researchedAt,
    locales: Object.keys(draft.translations || {}).sort(),
    facts: draft.facts,
    sourceUrls: (draft.sources || []).map((item) => item.url),
    rights: draft.rights,
    review: draft.review,
    issues:
      researchDraftKeyCounts.get(draft.key) > 1
        ? ["duplicate research key"]
        : source.writerBiographyResearchDraftIssues(draft),
    publishable: source.isWriterBiographyResearchDraftPublishable(draft),
  })),
  reviewQueue: queue,
};

const enrichmentManifest = {
  version: 1,
  generatedAt: report.generatedAt,
  policyDocument: "docs/WRITER_BIOGRAPHY_SOURCES_POLICY_RU.md",
  proseGeneration: "disabled",
  progress: {
    total: summary.writerRecords,
    ready: summary.russianReady,
    remaining: summary.russianWithheld,
    researchDrafts: summary.researchDrafts,
    validResearchDrafts: summary.validResearchDrafts,
    awaitingIndependentReview:
      summary.researchDraftsAwaitingIndependentReview,
    approvedForPromotion: summary.researchDraftsApprovedForPromotion,
    remainingWithoutResearchDraft: summary.withheldWithoutResearchDraft,
    workflowStates,
  },
  stateOrder: [
    "source-research",
    "rights-review",
    "editorial-rewrite",
    "fact-check",
    "language-review",
    "ready",
  ],
  items: queue.map((record) => ({
    key: `${record.countryId}:${record.id}`,
    writerId: record.id,
    name: record.name,
    countryId: record.countryId,
    workflow: record.workflow,
    research: record.research,
    sourceCandidates: record.sourceCandidates,
    audit: {
      legacyTextPresent: record.russian.legacyTextPresent,
      textLength: record.russian.textLength,
      sentenceCount: record.russian.sentenceCount,
      flags: record.flags,
      publicationIssues: record.russian.issues,
    },
  })),
};

await mkdir(reportDirectory, { recursive: true });
await writeFile(
  path.join(reportDirectory, "writer-biography-audit.json"),
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8"
);
await writeFile(
  path.join(reportDirectory, "writer-biography-enrichment-manifest.json"),
  `${JSON.stringify(enrichmentManifest, null, 2)}\n`,
  "utf8"
);

const queuePreview = queue.slice(0, 250);
await writeFile(
  path.join(reportDirectory, "writer-biography-audit.md"),
  [
    "# Аудит качества и происхождения биографий писателей",
    "",
    `Сформирован: ${report.generatedAt}`,
    "",
    "> `rightsUnproven` означает отсутствие достаточной записи о происхождении текста в репозитории, а не юридический вывод о нарушении.",
    "",
    `- Карточек писателей: ${summary.writerRecords}`,
    `- Готовых русских биографий: ${summary.russianReady}`,
    `- Скрыто до проверки (RU): ${summary.russianWithheld}`,
    `- Готовых английских биографий: ${summary.englishReady}`,
    `- Скрыто до проверки (EN): ${summary.englishWithheld}`,
    `- Curated research-черновиков RU+EN: ${summary.researchDraftsWithRussianAndEnglish}`,
    `- Валидных research-черновиков: ${summary.validResearchDrafts}`,
    `- Ожидают независимого QA: ${summary.researchDraftsAwaitingIndependentReview}`,
    `- Одобрено для deterministic promotion: ${summary.researchDraftsApprovedForPromotion}`,
    `- Осталось без research-черновика: ${summary.withheldWithoutResearchDraft}`,
    `- Дубли ключей research: ${summary.duplicateResearchDraftKeys}; отсутствуют в archive: ${summary.orphanResearchDrafts}`,
    `- Старых строк без структурированной provenance: ${summary.rightsUnproven}`,
    `- Коротких: ${summary.shortBiography}; шаблонных/служебных: ${summary.genericBiography}`,
    `- Повторяющихся записей: ${summary.duplicateBiographyRecords} в ${summary.duplicateBiographyGroups} группах`,
    `- Без пригодной provenance: ${summary.unsourcedBiography}`,
    `- Licensed-copy без лицензии/URL: ${summary.licensedCopyMissingMetadata}`,
    `- Старая staging-выгрузка Wikidata: ${summary.stagingRecords}; с prose-полями: ${summary.stagingRecordsWithLegacyProse}; публичное слияние отключено`,
    "",
    "## Измеримый workflow",
    "",
    `- source-research: ${workflowStates["source-research"]}`,
    `- rights-review: ${workflowStates["rights-review"]}`,
    `- editorial-rewrite: ${workflowStates["editorial-rewrite"]}`,
    `- fact-check: ${workflowStates["fact-check"]}`,
    `- language-review: ${workflowStates["language-review"]}`,
    `- ready: ${workflowStates.ready}`,
    "",
    "Research-черновики не считаются опубликованными: `author=Codex editorial draft`, `status=research`, `reviewer=null`. После независимой проверки редактор меняет статус и заполняет reviewer/date/decision; loader добавляет только прошедшую zero-issue локаль и сохраняет уже опубликованные локали.",
    "",
    "Очередь возобновляется по стабильному ключу `countryId:writerId` из `writer-biography-enrichment-manifest.json`. Скрипт не создаёт шаблонную прозу: каждый переход подтверждает отдельный редакционный этап.",
    "",
    "## Очередь русских биографий",
    "",
    `Ниже первые ${queuePreview.length} из ${queue.length}; полная очередь находится в JSON-отчёте.`,
    "",
    ...queuePreview.map((record) => {
      const reasons = [
        ...record.russian.issues,
        ...(record.flags.duplicate ? ["повторяющийся текст"] : []),
      ];
      return `- **${record.name}** (${record.countryId}/${record.id}): ${[
        ...new Set(reasons),
      ].join("; ")}`;
    }),
    "",
    "## Политика",
    "",
    "См. `docs/WRITER_BIOGRAPHY_SOURCES_POLICY_RU.md`.",
  ].join("\n"),
  "utf8"
);

console.log(JSON.stringify(summary, null, 2));
