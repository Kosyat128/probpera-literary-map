import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { build } from "esbuild";

import {
  archiveBookTitleKey,
  automaticRejectReasons,
  automaticResearchReasons,
  curatedRecordIssues,
  enrichmentPolicy,
  extractOpenLibraryId,
  normalizeBookIdentity,
} from "./lib/book-enrichment-policy.mjs";
import { reviewedPayload } from "./lib/book-enrichment-promotion.mjs";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const cacheDirectory = path.join(projectRoot, "scripts", ".cache");
const sourceBundlePath = path.join(
  cacheDirectory,
  `book-enrichment-source-${process.pid}.mjs`
);
const manifestPath = path.join(
  projectRoot,
  "data",
  "book-enrichment-manifest.json"
);
const classificationJsonPath = path.join(
  projectRoot,
  "reports",
  "book-corpus-classification.json"
);
const classificationMarkdownPath = path.join(
  projectRoot,
  "reports",
  "book-corpus-classification.md"
);
const generatedBooksPath = path.join(
  projectRoot,
  "src",
  "data",
  "countries",
  "generated",
  "books.generated.json"
);
const reviewedBooksPath = path.join(
  projectRoot,
  "src",
  "data",
  "countries",
  "generated",
  "books.reviewed.json"
);
const enrichmentActionsPath = path.join(
  projectRoot,
  "src",
  "data",
  "countries",
  "generated",
  "books.enrichment-actions.json"
);
const dataDirectory = path.join(projectRoot, "data");
const shouldWrite = process.argv.includes("--write");
const shouldCheck = process.argv.includes("--check");
const requestedDate = process.argv
  .find((argument) => argument.startsWith("--date="))
  ?.slice("--date=".length);
const runDate = requestedDate || new Date().toISOString().slice(0, 10);

function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right, "en"))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function fingerprint(value) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function recordKey(record) {
  return `${record.countryId}:${record.writerId}:${record.id}`;
}

function uniqueStrings(values) {
  return [
    ...new Set(
      values
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    ),
  ];
}

function sourceKind(record, rawGeneratedKeys) {
  const key = recordKey(record);
  if (record.shadowOf) return "generated-shadow";
  if (record.id.startsWith("legacy-")) return "legacy-title-only";
  if (rawGeneratedKeys.has(key)) return "generated-openlibrary";
  if ((record.editorial?.status || "draft") !== "draft") {
    return "editorial-nonpublic";
  }
  return "curated-draft";
}

function sourceUrls(record) {
  return uniqueStrings([
    record.sourceUrl,
    ...(record.sources || []).map((source) => source.url),
    ...(record.externalIds || []).map((externalId) => externalId.sourceUrl),
  ]);
}

function externalIdentities(record) {
  const identities = (record.externalIds || []).map(
    (externalId) =>
      `${String(externalId.scheme || "other").toLocaleLowerCase("en")}:${String(
        externalId.value || ""
      )
        .trim()
        .toLocaleUpperCase("en")}`
  );
  const openLibraryId = extractOpenLibraryId(record);
  if (openLibraryId) identities.push(`openlibrary:${openLibraryId}`);
  return uniqueStrings(identities);
}

function externalIdentityFromUrl(url = "") {
  const text = String(url);
  const openLibraryId = text.toLocaleUpperCase("en").match(/OL\d+W/u)?.[0];
  if (openLibraryId && /openlibrary\.org/iu.test(text)) {
    return `openlibrary:${openLibraryId}`;
  }
  const wikidataId = text.toLocaleUpperCase("en").match(/Q\d+/u)?.[0];
  if (wikidataId && /wikidata\.org/iu.test(text)) {
    return `wikidata:${wikidataId}`;
  }
  return "";
}

function curatedExternalIdentities(record = {}) {
  return uniqueStrings([
    ...(record.externalIdentities || []),
    ...(record.sources || []).map((source) =>
      externalIdentityFromUrl(source.url)
    ),
  ]);
}

function observedProvenance(record, observedAt) {
  const sources = (record.sources || []).map((source) => ({
    provider: source.provider,
    url: source.url,
    usage: source.usage,
    fields: source.fields,
    license: source.license || null,
    retrievedAt: source.retrievedAt,
    textReuse:
      source.usage === "licensed-copy" ? "license-review-required" : "none",
  }));
  const knownUrls = new Set(sources.map((source) => source.url));

  for (const url of sourceUrls(record)) {
    if (knownUrls.has(url) || !/^https:\/\//iu.test(url)) continue;
    if (/wikidata\.org/iu.test(url)) {
      sources.push({
        provider: "Wikidata",
        url,
        usage: "structured-data",
        fields: ["identity", "title", "publication-year", "language"],
        license: "CC0 1.0",
        retrievedAt: observedAt,
        textReuse: "none",
      });
    } else if (/openlibrary\.org/iu.test(url)) {
      sources.push({
        provider: "Open Library",
        url,
        usage: "reference-only",
        fields: ["identity", "title", "publication-year"],
        license: null,
        retrievedAt: observedAt,
        textReuse: "none",
      });
    } else if (/probpera\.ru/iu.test(url)) {
      sources.push({
        provider: "Проба Пера",
        url,
        usage: "reference-only",
        fields: ["identity", "title"],
        license: null,
        retrievedAt: observedAt,
        textReuse: "none",
      });
    } else {
      sources.push({
        provider: new URL(url).hostname,
        url,
        usage: "reference-only",
        fields: ["identity", "title"],
        license: null,
        retrievedAt: observedAt,
        textReuse: "none",
      });
    }
  }
  return sources;
}

async function loadArchiveSource() {
  await mkdir(cacheDirectory, { recursive: true });
  try {
    await build({
      absWorkingDir: projectRoot,
      entryPoints: [path.join(projectRoot, "scripts", "archive-source.ts")],
      bundle: true,
      platform: "node",
      packages: "external",
      format: "esm",
      target: "node22",
      outfile: sourceBundlePath,
      logLevel: "silent",
    });
    return await import(
      `${pathToFileURL(sourceBundlePath).href}?v=${Date.now()}`
    );
  } finally {
    await rm(sourceBundlePath, { force: true });
  }
}

async function readJsonIfPresent(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
}

async function loadCuratedBatches() {
  await mkdir(dataDirectory, { recursive: true });
  const filenames = (await readdir(dataDirectory))
    .filter((filename) => /^book-enrichment-curated-batch-.+\.json$/u.test(filename))
    .sort((left, right) => left.localeCompare(right, "en"));
  const records = new Map();
  const conflicts = [];

  for (const filename of filenames) {
    const batch = JSON.parse(
      await readFile(path.join(dataDirectory, filename), "utf8")
    );
    if (batch.schemaVersion !== enrichmentPolicy.schemaVersion) {
      throw new Error(
        `${filename}: unsupported schemaVersion ${batch.schemaVersion}`
      );
    }
    for (const record of batch.records || []) {
      if (!record.recordKey) {
        throw new Error(`${filename}: curated record has no recordKey`);
      }
      if (!["research", "ready"].includes(record.requestedStatus)) {
        throw new Error(
          `${filename}: ${record.recordKey} has invalid requestedStatus ${record.requestedStatus}`
        );
      }
      if (records.has(record.recordKey)) {
        conflicts.push({
          recordKey: record.recordKey,
          previousBatch: records.get(record.recordKey).__batch,
          nextBatch: filename,
        });
      }
      records.set(record.recordKey, { ...record, __batch: filename });
    }
  }
  return { records, filenames, conflicts };
}

function aliasesForCanonical(record) {
  return uniqueStrings([
    record.title,
    record.originalTitle,
    ...(record.alternateTitles || []),
    ...Object.values(record.translations || {}).map(
      (translation) => translation?.title
    ),
  ]).map(normalizeBookIdentity);
}

function canonicalAliasMap(archiveBooks, isPublicBook) {
  const aliases = new Map();
  for (const record of archiveBooks.filter(isPublicBook)) {
    const writerKey = `${record.countryId}:${record.writerId}`;
    for (const alias of aliasesForCanonical(record)) {
      const key = `${writerKey}:${alias}`;
      if (!aliases.has(key)) aliases.set(key, new Map());
      aliases.get(key).set(recordKey(record), record);
    }
  }
  return aliases;
}

function initialCuration(record) {
  const title = String(record.title || "").trim();
  const isRussianTitle = /[А-Яа-яЁё]/u.test(title);
  const isEnglishTitle = /[A-Za-z]/u.test(title);
  return {
    canonical: {
      titleRu: isRussianTitle ? title : null,
      titleEn: isEnglishTitle ? title : null,
      originalTitle: record.originalTitle || (isEnglishTitle ? title : null),
      firstPublished: Number.isInteger(record.firstPublished)
        ? record.firstPublished
        : null,
      originalLanguage: record.originalLanguage || null,
      genres: record.genres || [],
    },
    annotationRu: null,
    annotationEn: null,
    factChecks: [],
    sources: [],
    rights: {
      textOrigin: "project-original",
      copiedSourceText: false,
      notes:
        "Required annotation must be independently written from cited facts; source prose is not imported.",
    },
    editorialNotes: "",
    acceptedSourceFingerprint: null,
    batch: null,
  };
}

function sanitizedCuratedRecord(
  record,
  currentFingerprint,
  existingCurationRef
) {
  if (!record) return null;
  const {
    __batch,
    recordKey: _recordKey,
    requestedStatus: _requestedStatus,
    sourceFingerprint: declaredSourceFingerprint,
    ...curation
  } = record;
  return {
    ...curation,
    acceptedSourceFingerprint:
      declaredSourceFingerprint ||
      existingCurationRef?.acceptedSourceFingerprint ||
      currentFingerprint,
    batch: __batch,
  };
}

function chooseExternalCanonical(records) {
  return [...records].sort((left, right) => {
    const leftPenalty = automaticResearchReasons(left).length;
    const rightPenalty = automaticResearchReasons(right).length;
    return (
      Number(Boolean(right.inArchive)) - Number(Boolean(left.inArchive)) ||
      leftPenalty - rightPenalty ||
      recordKey(left).localeCompare(recordKey(right), "en")
    );
  })[0];
}

function countBy(values, selector) {
  const counts = {};
  for (const value of values) {
    const key = selector(value);
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(counts).sort(([left], [right]) =>
      left.localeCompare(right, "en")
    )
  );
}

function reportMarkdown(report) {
  const summary = report.summary;
  return [
    "# Классификация книжного корпуса",
    "",
    `Сформировано: ${report.generatedAt}`,
    "",
    "> Quarantine и публикационный gate — временная защита. Цель manifest: довести каждую каноническую карточку до оригинальных, проверенных RU/EN-аннотаций без копирования неизвестно лицензированного текста.",
    "",
    "## Точный объём",
    "",
    `- Всего карточек в архиве: ${summary.archiveRecords}.`,
    `- Draft-карточек в редакционной очереди: ${summary.archiveDraftCards}.`,
    `- Reviewed/verified-карточек, которые не проходят полный publication gate: ${summary.archiveNonPublicEditorialCards}.`,
    `- Всего непубличных карточек, требующих обогащения: ${summary.archiveNonPublicCards}.`,
    `- Raw draft ID, включая скрытые текущей дедупликацией: ${summary.rawDraftIds}.`,
    `- Всего target ID в manifest (draft + непубличные editorial): ${summary.rawTargetIds}.`,
    `- Скрытых raw-дублей: ${summary.shadowRawIds}.`,
    "",
    "## Автоматическая классификация target ID",
    "",
    `- reject: ${summary.statuses.reject}.`,
    `- merge: ${summary.statuses.merge}.`,
    `- ready (полный RU+EN-контроль): ${summary.statuses.ready}.`,
    `- research: ${summary.statuses.research}.`,
    `- Осталось канонических research-записей: ${summary.remainingCanonicalResearch}.`,
    "",
    "## Исходное качество всех непубличных карточек",
    "",
    `- Open Library imports: ${summary.sourceKinds["generated-openlibrary"] || 0}.`,
    `- Legacy title-only: ${summary.sourceKinds["legacy-title-only"] || 0}.`,
    `- Curated draft: ${summary.sourceKinds["curated-draft"] || 0}.`,
    `- Reviewed/verified, ещё не прошедшие publication gate: ${summary.sourceKinds["editorial-nonpublic"] || 0}.`,
    `- С годом первой публикации: ${summary.fields.firstPublished}.`,
    `- С языком оригинала: ${summary.fields.originalLanguage}.`,
    `- Со structured provenance: ${summary.fields.structuredProvenance}.`,
    `- С RU/EN translations: ${summary.fields.translations}.`,
    `- С существующим description: ${summary.fields.description}; готовых аннотаций среди них: ${summary.fields.usableDescription}.`,
    "",
    "## Безопасно применённые решения",
    "",
    `- Open Library edition ID (OL…M вместо work OL…W), оставленных в research до canonical resolution: ${summary.invalidOpenLibraryWorkIds}.`,
    `- Всего raw-групп повторного использования одного внешнего work ID: ${summary.rawExternalDuplicateGroups}.`,
    `- Raw-записей в этих группах: ${summary.rawExternalDuplicateMembers}.`,
    `- После deterministic reject остаётся конфликтных групп: ${summary.unresolvedExternalDuplicateGroups} (${summary.unresolvedExternalDuplicateMembers} записей).`,
    `- Cross-writer групп, оставленных в research до проверки авторства: ${summary.crossWriterAuthorshipConflictGroups} (${summary.crossWriterAuthorshipConflictMembers} записей).`,
    `- Same-writer external-ID merge: ${summary.externalMergeActions}.`,
    `- Точных alias-merge в уже проверенные публичные canonical works: ${summary.verifiedAliasMerges}.`,
    `- Reviewed external-identity merge у того же автора: ${summary.curatedReviewedIdentityMerges}.`,
    `- Явных independently reviewed исправлений неверной writer-связи: ${summary.curatedCrossWriterCorrections}.`,
    "",
    "## Правила текста и прав",
    "",
    "- `ready` требует оригинальные редакционные RU и EN аннотации: по 2–3 предложения, 140–900 знаков, автор и проверяющий.",
    "- Требуются минимум два независимых HTTPS-источника и отдельные fact checks identity/authorship/year/language.",
    "- Wikidata используется как CC0 structured data, но не как готовая аннотация.",
    "- Wikipedia/Wikimedia prose требует page/revision/attribution/authors URL и совместимую CC BY-SA лицензию.",
    "- Google Books descriptions не копируются и не сохраняются массово.",
    "",
    "Подробные решения по каждому raw ID находятся в `data/book-enrichment-manifest.json`.",
    "",
  ].join("\n");
}

const [
  { archiveRawBooks, isPublicBook },
  generatedPayload,
  existingManifest,
  batches,
] = await Promise.all([
    loadArchiveSource(),
    readJsonIfPresent(generatedBooksPath, { works: {} }),
    readJsonIfPresent(manifestPath, null),
    loadCuratedBatches(),
  ]);

if (batches.conflicts.length) {
  throw new Error(
    `Curated batches contain duplicate recordKeys: ${JSON.stringify(
      batches.conflicts.slice(0, 10)
    )}`
  );
}

if (!Array.isArray(archiveRawBooks)) {
  throw new Error(
    "archive-source.ts must export archiveRawBooks without reviewed overlays"
  );
}
const sourceArchiveBooks = archiveRawBooks;
const archiveDrafts = sourceArchiveBooks.filter(
  (record) => (record.editorial?.status || "draft") === "draft"
);
const archiveNonPublic = sourceArchiveBooks.filter(
  (record) => !isPublicBook(record)
);
const archiveNonPublicEditorial = archiveNonPublic.filter(
  (record) => (record.editorial?.status || "draft") !== "draft"
);
const archiveByKey = new Map(
  sourceArchiveBooks.map((record) => [recordKey(record), record])
);
const archiveByWriterAndTitle = new Map();
for (const record of sourceArchiveBooks) {
  const key = `${record.countryId}:${record.writerId}:${archiveBookTitleKey(
    record.title
  )}`;
  if (!archiveByWriterAndTitle.has(key)) archiveByWriterAndTitle.set(key, []);
  archiveByWriterAndTitle.get(key).push(record);
}

const rawGenerated = [];
for (const [writerKey, records] of Object.entries(generatedPayload.works || {})) {
  const [countryId, writerId] = writerKey.split(":");
  for (const record of records) {
    rawGenerated.push({ ...record, countryId, writerId });
  }
}
const rawGeneratedKeys = new Set(rawGenerated.map(recordKey));
const generatedSourceDate = String(generatedPayload.generatedAt || runDate).slice(
  0,
  10
);

const targetRecords = archiveNonPublic.map((record) => ({
  ...record,
  inArchive: true,
}));
const shadowRecords = [];
for (const record of rawGenerated) {
  const key = recordKey(record);
  if (archiveByKey.has(key)) continue;
  const sameTitle =
    archiveByWriterAndTitle.get(
      `${record.countryId}:${record.writerId}:${archiveBookTitleKey(record.title)}`
    ) || [];
  const target = sameTitle
    .slice()
    .sort((left, right) => recordKey(left).localeCompare(recordKey(right), "en"))[0];
  const writerRecord = sourceArchiveBooks.find(
    (candidate) =>
      candidate.countryId === record.countryId &&
      candidate.writerId === record.writerId
  );
  const shadow = {
    ...record,
    writerName: writerRecord?.writerName || record.writerId,
    countryName: writerRecord?.countryName || record.countryId,
    writer: writerRecord?.writer || null,
    country: writerRecord?.country || null,
    inArchive: false,
    shadowOf: target ? recordKey(target) : null,
  };
  shadowRecords.push(shadow);
  targetRecords.push(shadow);
}

targetRecords.sort((left, right) =>
  recordKey(left).localeCompare(recordKey(right), "en")
);

const sourceSnapshots = new Map();
for (const record of targetRecords) {
  const key = recordKey(record);
  const snapshot = {
    recordKey: key,
    archiveCard: Boolean(record.inArchive),
    sourceKind: sourceKind(record, rawGeneratedKeys),
    countryId: record.countryId,
    countryName: record.countryName || null,
    writerId: record.writerId,
    writerName: record.writerName || null,
    sourceId: record.id,
    title: record.title,
    originalTitle: record.originalTitle || null,
    alternateTitles: record.alternateTitles || [],
    firstPublished: record.firstPublished || null,
    originalLanguage: record.originalLanguage || null,
    genres: record.genres || [],
    tags: record.tags || [],
    sourceUrls: sourceUrls(record),
    externalIdentities: externalIdentities(record),
    observedProvenance: observedProvenance(
      record,
      String(record.editorial?.reviewedAt || generatedSourceDate).slice(0, 10)
    ),
  };
  snapshot.sourceFingerprint = fingerprint(snapshot);
  sourceSnapshots.set(key, snapshot);
}

const rejectReasonsByKey = new Map(
  targetRecords.map((record) => [recordKey(record), automaticRejectReasons(record)])
);
// Promotion output must never affect the classification input. Only verified
// works from the raw/base archive may act as pre-existing canonical aliases.
const publicAliases = canonicalAliasMap(sourceArchiveBooks, isPublicBook);
const verifiedAliasTargetByKey = new Map();
for (const record of targetRecords) {
  const key = `${record.countryId}:${record.writerId}:${normalizeBookIdentity(
    record.title
  )}`;
  const matches = [...(publicAliases.get(key)?.keys() || [])].filter(
    (candidateKey) => candidateKey !== recordKey(record)
  );
  if (matches.length === 1) {
    verifiedAliasTargetByKey.set(recordKey(record), matches[0]);
  }
}

function isEditorialCanonicalCandidate(record) {
  const status = record.editorial?.status || "draft";
  return (
    record.inArchive &&
    !rawGeneratedKeys.has(recordKey(record)) &&
    !record.id.startsWith("legacy-") &&
    (status === "reviewed" ||
      status === "verified" ||
      record.coverRights?.status === "editorial-original")
  );
}

function addCandidateTarget(targetsByKey, memberKey, targetKey) {
  if (memberKey === targetKey) return;
  if (!targetsByKey.has(memberKey)) targetsByKey.set(memberKey, new Set());
  targetsByKey.get(memberKey).add(targetKey);
}

// Resolve exact same-writer aliases to an existing editorial canonical card.
// Ambiguous aliases are deliberately left in research.
const nonPublicAliasMembers = new Map();
for (const record of targetRecords.filter((candidate) => candidate.inArchive)) {
  const writerKey = `${record.countryId}:${record.writerId}`;
  for (const alias of aliasesForCanonical(record)) {
    if (!alias) continue;
    const aliasKey = `${writerKey}:${alias}`;
    if (!nonPublicAliasMembers.has(aliasKey)) {
      nonPublicAliasMembers.set(aliasKey, new Map());
    }
    nonPublicAliasMembers.get(aliasKey).set(recordKey(record), record);
  }
}
const editorialAliasTargetsByKey = new Map();
const editorialAliasConflictsByKey = new Map();
for (const [aliasKey, membersByKey] of nonPublicAliasMembers) {
  if (membersByKey.size < 2) continue;
  const members = [...membersByKey.values()];
  const canonicalCandidates = members.filter(isEditorialCanonicalCandidate);
  if (canonicalCandidates.length !== 1) {
    if (canonicalCandidates.length > 1) {
      for (const member of members) {
        const key = recordKey(member);
        if (!editorialAliasConflictsByKey.has(key)) {
          editorialAliasConflictsByKey.set(key, []);
        }
        editorialAliasConflictsByKey.get(key).push(aliasKey);
      }
    }
    continue;
  }
  const targetKey = recordKey(canonicalCandidates[0]);
  for (const member of members) {
    addCandidateTarget(editorialAliasTargetsByKey, recordKey(member), targetKey);
  }
}

// A zero-issue curated record may establish same-writer aliases through its
// checked titles or external work identities. Cross-writer relationships stay
// blocked unless the independent QA record declares the exact source relation.
const targetRecordByKey = new Map(
  targetRecords.map((record) => [recordKey(record), record])
);
const curatedAliasTargetsByKey = new Map();
const curatedIdentityTargetsByKey = new Map();
const curatedExplicitCrossWriterTargetsByKey = new Map();
const curatedCrossWriterConflictsByCanonicalKey = new Map();
const curatedCrossWriterConflictsByCandidateKey = new Map();
const curatedRelationIssuesByCanonicalKey = new Map();
for (const [canonicalKey, batch] of batches.records) {
  const canonicalRecord = targetRecordByKey.get(canonicalKey);
  const currentSource = sourceSnapshots.get(canonicalKey);
  if (
    !canonicalRecord ||
    !currentSource ||
    batch.requestedStatus !== "ready" ||
    curatedRecordIssues(batch).length > 0 ||
    (batch.sourceFingerprint &&
      batch.sourceFingerprint !== currentSource.sourceFingerprint)
  ) {
    continue;
  }
  const checkedAliases = new Set(
    uniqueStrings([
      batch.canonical?.titleRu,
      batch.canonical?.titleEn,
      batch.canonical?.originalTitle,
    ]).map(normalizeBookIdentity)
  );
  const checkedExternalIdentities = new Set(curatedExternalIdentities(batch));
  const confirmedMerges = new Map(
    (batch.confirmedMerges || []).map((merge) => [merge.fromRecordKey, merge])
  );
  const consumedConfirmedMerges = new Set();
  for (const candidate of targetRecords) {
    const candidateKey = recordKey(candidate);
    if (candidateKey === canonicalKey) continue;
    const sameWriter =
      candidate.countryId === canonicalRecord.countryId &&
      candidate.writerId === canonicalRecord.writerId;
    const sharedExternalIdentities = externalIdentities(candidate).filter(
      (identity) => checkedExternalIdentities.has(identity)
    );

    if (sharedExternalIdentities.length > 0) {
      if (sameWriter) {
        addCandidateTarget(
          curatedIdentityTargetsByKey,
          candidateKey,
          canonicalKey
        );
      } else {
        const confirmedMerge = confirmedMerges.get(candidateKey);
        if (
          confirmedMerge &&
          sharedExternalIdentities.includes(confirmedMerge.externalIdentity)
        ) {
          addCandidateTarget(
            curatedExplicitCrossWriterTargetsByKey,
            candidateKey,
            canonicalKey
          );
          consumedConfirmedMerges.add(candidateKey);
        } else {
          if (!curatedCrossWriterConflictsByCanonicalKey.has(canonicalKey)) {
            curatedCrossWriterConflictsByCanonicalKey.set(canonicalKey, []);
          }
          curatedCrossWriterConflictsByCanonicalKey.get(canonicalKey).push({
            recordKey: candidateKey,
            externalIdentities: sharedExternalIdentities,
          });
          if (!curatedCrossWriterConflictsByCandidateKey.has(candidateKey)) {
            curatedCrossWriterConflictsByCandidateKey.set(candidateKey, []);
          }
          curatedCrossWriterConflictsByCandidateKey.get(candidateKey).push({
            canonicalKey,
            externalIdentities: sharedExternalIdentities,
          });
        }
      }
    }

    if (
      !sameWriter
    ) {
      continue;
    }
    if (
      aliasesForCanonical(candidate).some((alias) => checkedAliases.has(alias))
    ) {
      addCandidateTarget(
        curatedAliasTargetsByKey,
        candidateKey,
        canonicalKey
      );
    }
  }
  for (const merge of batch.confirmedMerges || []) {
    if (!targetRecordByKey.has(merge.fromRecordKey)) {
      if (!curatedRelationIssuesByCanonicalKey.has(canonicalKey)) {
        curatedRelationIssuesByCanonicalKey.set(canonicalKey, []);
      }
      curatedRelationIssuesByCanonicalKey
        .get(canonicalKey)
        .push(`confirmed-merge-source-not-found:${merge.fromRecordKey}`);
    } else if (!consumedConfirmedMerges.has(merge.fromRecordKey)) {
      if (!curatedRelationIssuesByCanonicalKey.has(canonicalKey)) {
        curatedRelationIssuesByCanonicalKey.set(canonicalKey, []);
      }
      curatedRelationIssuesByCanonicalKey
        .get(canonicalKey)
        .push(`confirmed-merge-identity-mismatch:${merge.fromRecordKey}`);
    }
  }
}

const rawExternalGroups = new Map();
for (const record of targetRecords) {
  const key = recordKey(record);
  for (const externalIdentity of externalIdentities(record)) {
    if (!rawExternalGroups.has(externalIdentity)) {
      rawExternalGroups.set(externalIdentity, new Map());
    }
    rawExternalGroups.get(externalIdentity).set(key, record);
  }
}
const rawDuplicateExternalGroups = [...rawExternalGroups.entries()]
  .filter(([, members]) => members.size > 1)
  .map(([externalIdentity, members]) => ({
    externalIdentity,
    members: [...members.values()],
  }))
  .sort((left, right) =>
    left.externalIdentity.localeCompare(right.externalIdentity, "en")
  );

const externalGroups = new Map();
for (const record of targetRecords) {
  const key = recordKey(record);
  if (rejectReasonsByKey.get(key)?.length) continue;
  for (const externalIdentity of externalIdentities(record)) {
    if (!externalGroups.has(externalIdentity)) {
      externalGroups.set(externalIdentity, new Map());
    }
    externalGroups.get(externalIdentity).set(key, record);
  }
}
const duplicateExternalGroups = [...externalGroups.entries()]
  .filter(([, members]) => members.size > 1)
  .map(([externalIdentity, members]) => ({
    externalIdentity,
    members: [...members.values()],
  }))
  .sort((left, right) =>
    left.externalIdentity.localeCompare(right.externalIdentity, "en")
  );
const externalMergeTargetByKey = new Map();
const externalAuthorshipConflictsByKey = new Map();
for (const group of duplicateExternalGroups) {
  const writerKeys = new Set(
    group.members.map((record) => `${record.countryId}:${record.writerId}`)
  );
  if (writerKeys.size > 1) {
    for (const member of group.members) {
      const key = recordKey(member);
      if (!externalAuthorshipConflictsByKey.has(key)) {
        externalAuthorshipConflictsByKey.set(key, []);
      }
      externalAuthorshipConflictsByKey
        .get(key)
        .push(group.externalIdentity);
    }
    continue;
  }
  const verifiedTargets = uniqueStrings(
    group.members
      .map((record) => verifiedAliasTargetByKey.get(recordKey(record)))
      .filter(Boolean)
  );
  const targetKey =
    verifiedTargets.length === 1
      ? verifiedTargets[0]
      : recordKey(chooseExternalCanonical(group.members));
  for (const member of group.members) {
    if (recordKey(member) !== targetKey) {
      externalMergeTargetByKey.set(recordKey(member), {
        targetKey,
        externalIdentity: group.externalIdentity,
      });
    }
  }
}

const existingByKey = new Map(
  (existingManifest?.records || []).map((record) => [record.recordKey, record])
);
const manifestRecords = [];
const safeRejectActions = [];
const safeMergeActions = [];
const readyCurations = [];

for (const record of targetRecords) {
  const key = recordKey(record);
  const source = sourceSnapshots.get(key);
  const rejectReasons = rejectReasonsByKey.get(key) || [];
  const batch = batches.records.get(key);
  const existing = existingByKey.get(key);
  const batchCuration = sanitizedCuratedRecord(
    batch,
    source.sourceFingerprint,
    existing?.curationRef
  );
  const effectiveCuration = batchCuration || initialCuration(record);
  const sourceChanged = Boolean(
    effectiveCuration.acceptedSourceFingerprint &&
      effectiveCuration.acceptedSourceFingerprint !== source.sourceFingerprint
  );
  const curationIssues = batchCuration
    ? curatedRecordIssues(effectiveCuration)
    : ["curation-required"];
  if (sourceChanged) curationIssues.push("source-record-changed-recheck-required");
  for (const conflict of
    curatedCrossWriterConflictsByCanonicalKey.get(key) || []) {
    curationIssues.push(
      `curated-external-id-cross-writer-conflict:${conflict.recordKey}`
    );
  }
  curationIssues.push(...(curatedRelationIssuesByCanonicalKey.get(key) || []));

  let status = "research";
  let confidence = "review-required";
  let mergeInto = null;
  let decisionBasis = "incomplete-legal-quality-record";
  const reasonCodes = automaticResearchReasons(record);
  for (const externalIdentity of externalAuthorshipConflictsByKey.get(key) || []) {
    reasonCodes.push(
      "cross-writer-external-id-authorship-conflict",
      `external-identity:${externalIdentity}`
    );
  }
  for (const aliasKey of editorialAliasConflictsByKey.get(key) || []) {
    reasonCodes.push(
      "same-writer-editorial-alias-conflict",
      `alias:${aliasKey}`
    );
  }
  for (const conflict of
    curatedCrossWriterConflictsByCandidateKey.get(key) || []) {
    reasonCodes.push(
      "curated-external-id-cross-writer-conflict",
      `canonical:${conflict.canonicalKey}`,
      ...conflict.externalIdentities.map(
        (identity) => `external-identity:${identity}`
      )
    );
  }

  if (rejectReasons.length) {
    status = "reject";
    confidence = "high";
    decisionBasis = "deterministic-non-canonical-import";
    reasonCodes.unshift(...rejectReasons);
    safeRejectActions.push({ recordKey: key, reasonCodes: rejectReasons });
  } else if (record.shadowOf) {
    status = "merge";
    confidence = "high";
    mergeInto = record.shadowOf;
    decisionBasis = "same-writer-exact-normalized-title-shadow";
    reasonCodes.unshift("raw-record-hidden-by-current-title-deduplication");
  } else if (verifiedAliasTargetByKey.has(key)) {
    status = "merge";
    confidence = "high";
    mergeInto = verifiedAliasTargetByKey.get(key);
    decisionBasis = "same-writer-exact-verified-title-alias";
    reasonCodes.unshift("duplicates-publishable-verified-canonical-work");
  } else if (curatedIdentityTargetsByKey.get(key)?.size === 1) {
    status = "merge";
    confidence = "editorially-verified";
    mergeInto = [...curatedIdentityTargetsByKey.get(key)][0];
    decisionBasis = "curated-reviewed-same-writer-external-identity";
    reasonCodes.unshift("duplicates-curated-reviewed-external-work-identity");
  } else if (curatedExplicitCrossWriterTargetsByKey.get(key)?.size === 1) {
    status = "merge";
    confidence = "editorially-verified";
    mergeInto = [...curatedExplicitCrossWriterTargetsByKey.get(key)][0];
    decisionBasis = "curated-reviewed-cross-writer-authorship-correction";
    reasonCodes.unshift("curated-reviewed-wrong-writer-relation-correction");
  } else if (curatedAliasTargetsByKey.get(key)?.size === 1) {
    status = "merge";
    confidence = "high";
    mergeInto = [...curatedAliasTargetsByKey.get(key)][0];
    decisionBasis = "curated-reviewed-same-writer-title-alias";
    reasonCodes.unshift("duplicates-curated-reviewed-canonical-work");
  } else if (editorialAliasTargetsByKey.get(key)?.size === 1) {
    status = "merge";
    confidence = "high";
    mergeInto = [...editorialAliasTargetsByKey.get(key)][0];
    decisionBasis = "same-writer-exact-editorial-title-alias";
    reasonCodes.unshift("duplicates-existing-editorial-canonical-work");
  } else if (externalMergeTargetByKey.has(key)) {
    const merge = externalMergeTargetByKey.get(key);
    status = "merge";
    confidence = "high";
    mergeInto = merge.targetKey;
    decisionBasis = "identical-external-work-identifier";
    reasonCodes.unshift(
      "duplicate-external-work-identity",
      `external-identity:${merge.externalIdentity}`
    );
  } else if (
    curationIssues.length === 0 &&
    batch?.requestedStatus === "ready"
  ) {
    status = "ready";
    confidence = "editorially-verified";
    decisionBasis = "complete-bilingual-legal-quality-record";
  } else {
    if (curationIssues.length === 0) {
      reasonCodes.push("curated-record-awaiting-ready-request");
    }
    reasonCodes.push(...curationIssues);
  }

  if (status === "merge") {
    const action = {
      from: key,
      into: mergeInto,
      basis: decisionBasis,
      preserveWriterRelation:
        decisionBasis !==
        "curated-reviewed-cross-writer-authorship-correction",
    };
    safeMergeActions.push(action);
  }
  if (status === "ready") {
    readyCurations.push({
      sourceRecord: {
        ...record,
        externalIdentities: source.externalIdentities,
      },
      curatedRecord: effectiveCuration,
    });
  }

  const primaryExternalIdentity = source.externalIdentities[0] || null;
  const compactSource = {
    kind: source.sourceKind,
    title: source.title,
    ...(source.archiveCard ? {} : { archiveCard: false }),
    ...(primaryExternalIdentity
      ? { externalIdentity: primaryExternalIdentity }
      : source.sourceUrls[0]
        ? { sourceUrl: source.sourceUrls[0] }
        : {}),
    fingerprint: source.sourceFingerprint,
  };
  manifestRecords.push({
    recordKey: key,
    source: compactSource,
    status,
    reasons: uniqueStrings(reasonCodes),
    ...(status === "research"
      ? {}
      : { confidence, basis: decisionBasis }),
    ...(mergeInto ? { mergeInto } : {}),
    ...(batchCuration
      ? {
          curationRef: {
            batch: batch.__batch,
            batchDigest: fingerprint(
              Object.fromEntries(
                Object.entries(batch).filter(([field]) => field !== "__batch")
              )
            ),
            acceptedSourceFingerprint:
              effectiveCuration.acceptedSourceFingerprint,
          },
          quality: {
            publicReady: status === "ready",
            issues: uniqueStrings(curationIssues),
          },
        }
      : {}),
    ...(sourceChanged ? { sourceChanged: true } : {}),
  });
}

const datasetFingerprint = fingerprint(
  manifestRecords.map((record) => [
    record.recordKey,
    record.source.fingerprint,
    record.status,
    record.mergeInto || null,
    record.curationRef?.batchDigest || null,
  ])
);
const generatedAt =
  existingManifest?.datasetFingerprint === datasetFingerprint
    ? existingManifest.generatedAt
    : `${runDate}T00:00:00.000Z`;
const statuses = countBy(manifestRecords, (record) => record.status);
for (const status of enrichmentPolicy.statuses) statuses[status] ||= 0;
const archiveManifestRecords = manifestRecords.filter(
  (record) => record.source.archiveCard !== false
);
const archiveStatuses = countBy(
  archiveManifestRecords,
  (record) => record.status
);
for (const status of enrichmentPolicy.statuses) archiveStatuses[status] ||= 0;

const summary = {
  archiveRecords: sourceArchiveBooks.length,
  archiveDraftCards: archiveDrafts.length,
  archiveNonPublicEditorialCards: archiveNonPublicEditorial.length,
  archiveNonPublicCards: archiveNonPublic.length,
  rawDraftIds: archiveDrafts.length + shadowRecords.length,
  rawNonPublicEditorialIds: archiveNonPublicEditorial.length,
  rawTargetIds: manifestRecords.length,
  shadowRawIds: shadowRecords.length,
  statuses,
  archiveStatuses,
  remainingCanonicalResearch: statuses.research,
  remainingArchiveResearch: archiveStatuses.research,
  safeProcessedTargetIds: statuses.reject + statuses.merge + statuses.ready,
  sourceKinds: countBy(manifestRecords, (record) => record.source.kind),
  archiveTargetSourceKinds: countBy(
    archiveManifestRecords,
    (record) => record.source.kind
  ),
  archiveDraftSourceKinds: countBy(
    archiveDrafts,
    (record) => sourceKind(record, rawGeneratedKeys)
  ),
  fields: {
    firstPublished: archiveNonPublic.filter((record) => record.firstPublished).length,
    originalLanguage: archiveNonPublic.filter((record) => record.originalLanguage)
      .length,
    genres: archiveNonPublic.filter((record) => record.genres?.length).length,
    description: archiveNonPublic.filter((record) => record.description).length,
    usableDescription: 0,
    sourceUrl: archiveNonPublic.filter((record) => record.sourceUrl).length,
    structuredProvenance: archiveNonPublic.filter((record) => record.sources?.length)
      .length,
    translations: archiveNonPublic.filter((record) => record.translations).length,
    coverArtwork: archiveNonPublic.filter((record) => record.coverUrl).length,
  },
  invalidOpenLibraryWorkIds: manifestRecords.filter((record) =>
    record.reasons.includes(
      "invalid-openlibrary-work-id-needs-canonical-resolution"
    )
  ).length,
  rawExternalDuplicateGroups: rawDuplicateExternalGroups.length,
  rawExternalDuplicateMembers: rawDuplicateExternalGroups.reduce(
    (total, group) => total + group.members.length,
    0
  ),
  unresolvedExternalDuplicateGroups: duplicateExternalGroups.length,
  unresolvedExternalDuplicateMembers: duplicateExternalGroups.reduce(
    (total, group) => total + group.members.length,
    0
  ),
  externalMergeActions: safeMergeActions.filter(
    (action) => action.basis === "identical-external-work-identifier"
  ).length,
  crossWriterAuthorshipConflictGroups: duplicateExternalGroups.filter(
    (group) =>
      new Set(
        group.members.map(
          (record) => `${record.countryId}:${record.writerId}`
        )
      ).size > 1
  ).length,
  crossWriterAuthorshipConflictMembers: new Set(
    [...externalAuthorshipConflictsByKey.keys()]
  ).size,
  verifiedAliasMerges: safeMergeActions.filter(
    (action) => action.basis === "same-writer-exact-verified-title-alias"
  ).length,
  editorialCanonicalAliasMerges: safeMergeActions.filter(
    (action) => action.basis === "same-writer-exact-editorial-title-alias"
  ).length,
  curatedReviewedAliasMerges: safeMergeActions.filter(
    (action) => action.basis === "curated-reviewed-same-writer-title-alias"
  ).length,
  curatedReviewedIdentityMerges: safeMergeActions.filter(
    (action) =>
      action.basis === "curated-reviewed-same-writer-external-identity"
  ).length,
  curatedCrossWriterCorrections: safeMergeActions.filter(
    (action) =>
      action.basis ===
      "curated-reviewed-cross-writer-authorship-correction"
  ).length,
  curatedUndeclaredCrossWriterConflicts: [
    ...curatedCrossWriterConflictsByCanonicalKey.values(),
  ].reduce((total, conflicts) => total + conflicts.length, 0),
  shadowMerges: safeMergeActions.filter(
    (action) => action.basis === "same-writer-exact-normalized-title-shadow"
  ).length,
  curatedBatches: batches.filenames,
};

const manifest = {
  schemaVersion: enrichmentPolicy.schemaVersion,
  generatedAt,
  datasetFingerprint,
  target: {
    archiveDraftCards: archiveDrafts.length,
    archiveNonPublicEditorialCards: archiveNonPublicEditorial.length,
    archiveNonPublicCards: archiveNonPublic.length,
    rawDraftIds: archiveDrafts.length + shadowRecords.length,
    rawTargetIds: manifestRecords.length,
    goal:
      "Every canonical work has editor-original, reviewed RU and EN annotations with verified facts, provenance and text-rights metadata.",
  },
  policy: enrichmentPolicy,
  nextActionByStatus: {
    research: "curate-bilingual",
    ready: "promote-reviewed",
    merge: "merge-safe",
    reject: "exclude-safe",
  },
  summary,
  safeActions: {
    note:
      "Actions are applied by the generated canonical-archive overlay. Raw source files remain recoverable; cross-writer merges require an explicit independently reviewed authorship correction in a curated batch.",
    rejects: safeRejectActions,
    merges: safeMergeActions,
  },
  records: manifestRecords,
};
const promotedReviewedBooks = reviewedPayload({
  manifest,
  readyRecords: readyCurations,
});
const enrichmentActions = {
  generatedAt: manifest.generatedAt,
  sourceManifestFingerprint: manifest.datasetFingerprint,
  source: "Deterministic reject/merge decisions from book enrichment manifest",
  rejects: manifest.safeActions.rejects,
  merges: manifest.safeActions.merges,
};

const classificationReport = {
  generatedAt,
  datasetFingerprint,
  summary,
  rejectReasons: countBy(
    safeRejectActions.flatMap((action) =>
      action.reasonCodes.map((reason) => ({ reason }))
    ),
    (entry) => entry.reason
  ),
  mergeBases: countBy(safeMergeActions, (action) => action.basis),
  externalDuplicateGroups: duplicateExternalGroups.map((group) => ({
    externalIdentity: group.externalIdentity,
    members: group.members.map((record) => ({
      recordKey: recordKey(record),
      title: record.title,
      writer: record.writerName,
      country: record.countryName,
    })),
  })),
  rawExternalDuplicateGroups: rawDuplicateExternalGroups.map((group) => ({
    externalIdentity: group.externalIdentity,
    members: group.members.map((record) => ({
      recordKey: recordKey(record),
      title: record.title,
      writer: record.writerName,
      country: record.countryName,
      automaticReject: Boolean(
        rejectReasonsByKey.get(recordKey(record))?.length
      ),
    })),
  })),
  verifiedAliasMerges: safeMergeActions.filter(
    (action) => action.basis === "same-writer-exact-verified-title-alias"
  ),
  shadowRawRecords: shadowRecords.map((record) => ({
    recordKey: recordKey(record),
    title: record.title,
    mergeInto: record.shadowOf,
  })),
  curatedBatchConflicts: batches.conflicts,
};

function stringifyManifest(value) {
  const { records, ...header } = value;
  const headerText = JSON.stringify(header, null, 2);
  return `${headerText.slice(0, -2)},\n  "records": [\n${records
    .map((record) => `    ${JSON.stringify(record)}`)
    .join(",\n")}\n  ]\n}\n`;
}

const manifestText = stringifyManifest(manifest);
const reviewedBooksText = `${JSON.stringify(promotedReviewedBooks, null, 2)}\n`;
const enrichmentActionsText = `${JSON.stringify(enrichmentActions, null, 2)}\n`;
const reportText = `${JSON.stringify(classificationReport, null, 2)}\n`;
const markdownText = reportMarkdown(classificationReport);

if (shouldCheck) {
  const [
    existingManifestText,
    existingReportText,
    existingMarkdownText,
    existingReviewedBooksText,
    existingEnrichmentActionsText,
  ] =
    await Promise.all([
      readFile(manifestPath, "utf8").catch(() => ""),
      readFile(classificationJsonPath, "utf8").catch(() => ""),
      readFile(classificationMarkdownPath, "utf8").catch(() => ""),
      readFile(reviewedBooksPath, "utf8").catch(() => ""),
      readFile(enrichmentActionsPath, "utf8").catch(() => ""),
    ]);
  if (
    existingManifestText !== manifestText ||
    existingReportText !== reportText ||
    existingMarkdownText !== markdownText ||
    existingReviewedBooksText !== reviewedBooksText ||
    existingEnrichmentActionsText !== enrichmentActionsText
  ) {
    console.error(
      "Book enrichment manifest is stale. Run: node scripts/build-book-enrichment-manifest.mjs --write"
    );
    process.exitCode = 1;
  }
}

if (shouldWrite) {
  await Promise.all([
    mkdir(path.dirname(manifestPath), { recursive: true }),
    mkdir(path.dirname(classificationJsonPath), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(manifestPath, manifestText, "utf8"),
    writeFile(classificationJsonPath, reportText, "utf8"),
    writeFile(classificationMarkdownPath, markdownText, "utf8"),
    writeFile(reviewedBooksPath, reviewedBooksText, "utf8"),
    writeFile(enrichmentActionsPath, enrichmentActionsText, "utf8"),
  ]);
}

console.log(JSON.stringify(summary, null, 2));
if (!shouldWrite && !shouldCheck) {
  console.log(
    "Dry run only. Add --write to update the manifest and classification reports."
  );
}
