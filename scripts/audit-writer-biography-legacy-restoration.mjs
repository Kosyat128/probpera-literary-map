import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { build } from "esbuild";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const cacheDirectory = path.join(projectRoot, "scripts", ".cache");
const bundlePath = path.join(
  cacheDirectory,
  "writer-biography-legacy-restoration-source.mjs"
);
const reportDirectory = path.join(projectRoot, "reports");
const factQaReportPath = path.join(
  reportDirectory,
  "writer-biography-fact-qa.json"
);
const stagingPath = path.join(
  projectRoot,
  "src",
  "data",
  "countries",
  "generated",
  "writers.generated.json"
);

const operationalPattern =
  /(?:не включается|не входит .* базу|готовится|проходит редакционную проверку|повторное литературное направление|книжн(?:ом|ый) архив)/iu;
const superlativePattern =
  /(?:од(?:ин|на) из (?:крупнейших|ведущих|известнейших|наиболее|самых)|ведущ(?:ий|ая)|крупнейш(?:ий|ая)|величайш(?:ий|ая)|наиболее (?:известн|значим)|сам(?:ый|ая) (?:известн|значим|влиятельн))/iu;

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

function writerName(writer) {
  return writer.name || writer.fullName || writer.id || "Без имени";
}

function recordKey(record) {
  return `${record.countryId}:${record.writer.id}`;
}

function normalizedIdentity(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("ru")
    .replace(/ё/gu, "е")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}

function groupRepeated(records, selector) {
  const groups = new Map();
  for (const record of records) {
    const key = selector(record);
    if (!key) continue;
    const group = groups.get(key) || [];
    group.push(record);
    groups.set(key, group);
  }
  return [...groups.entries()].filter(([, group]) => group.length > 1);
}

function brief(record) {
  return {
    key: recordKey(record),
    id: record.writer.id,
    name: writerName(record.writer),
    countryId: record.countryId,
  };
}

function lengthBand(length) {
  if (length < 40) return "0-39";
  if (length < 80) return "40-79";
  if (length < 120) return "80-119";
  if (length < 250) return "120-249";
  if (length < 500) return "250-499";
  return "500+";
}

async function stagingSummary(publicRecords) {
  const payload = JSON.parse(await readFile(stagingPath, "utf8"));
  const records = Object.entries(payload).flatMap(([countryId, writers]) =>
    (Array.isArray(writers) ? writers : []).map((writer) => ({
      countryId,
      writer,
    }))
  );
  const stagingByName = new Map();
  for (const record of records) {
    const key = normalizedIdentity(
      record.writer.fullName || record.writer.name || ""
    );
    const group = stagingByName.get(key) || [];
    group.push(record);
    stagingByName.set(key, group);
  }
  const exactNameMatches = publicRecords.filter((record) =>
    stagingByName.has(normalizedIdentity(writerName(record.writer)))
  );
  const uniqueExactNameMatches = publicRecords.filter(
    (record) =>
      stagingByName.get(normalizedIdentity(writerName(record.writer)))?.length ===
      1
  );
  const authorityCoverage = Object.fromEntries(
    ["viaf", "isni", "lccn", "bnf", "nla"].map((authority) => [
      authority,
      records.filter((record) => record.writer.authorityIds?.[authority]).length,
    ])
  );

  return {
    records: records.length,
    recordsWithLegacyProse: records.filter((record) =>
      Boolean(
        record.writer.bio ||
          record.writer.biography ||
          record.writer.description
      )
    ).length,
    recordsWithWikidataId: records.filter((record) => record.writer.wikidataId)
      .length,
    authorityCoverage,
    publicRecordsWithExactNormalizedNameMatch: exactNameMatches.length,
    publicRecordsWithUniqueExactNormalizedNameMatch: uniqueExactNameMatches.length,
    publicRuntimeMergeEnabled: false,
    warning:
      "The staging file is a candidate index only. Public cards have no Wikidata IDs, exact-name coverage is low, and a name match must not be promoted as identity proof.",
  };
}

const source = await sourceArchive();
const records = source.archiveCountries.flatMap((country) =>
  country.writers.map((writer) => ({
    countryId: country.id,
    countryName: country.name,
    writer,
    legacyText: source.legacyWriterBiography(writer),
  }))
);
const gatePassingRussian = records.filter((record) =>
  source.selectWriterBiography(record.writer, "ru")
);
const gatePassingEnglish = records.filter((record) =>
  source.selectWriterBiography(record.writer, "en")
);
const legacyWithheld = records.filter(
  (record) => !source.selectWriterBiography(record.writer, "ru")
);
const knownGeneric = legacyWithheld.filter((record) =>
  source.isGenericBiographyText(record.legacyText)
);
const qualityScreenedLegacy = legacyWithheld.filter(
  (record) => !source.isGenericBiographyText(record.legacyText)
);
const exactBiographyGroups = groupRepeated(
  records,
  (record) =>
    source
      .normalizeBiographyText(record.legacyText)
      .normalize("NFKC")
      .toLocaleLowerCase("ru")
      .replace(/ё/gu, "е")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim()
);
const repeatedWriterIdGroups = groupRepeated(
  records,
  (record) => record.writer.id
);
const repeatedNameGroups = groupRepeated(records, (record) =>
  normalizedIdentity(writerName(record.writer))
);
const sameNameDifferentIdGroups = repeatedNameGroups.filter(
  ([, group]) => new Set(group.map((record) => record.writer.id)).size > 1
);
const operationalRecords = legacyWithheld.filter((record) =>
  operationalPattern.test(record.legacyText)
);
const superlativeRecords = legacyWithheld.filter((record) =>
  superlativePattern.test(record.legacyText)
);
const nobelClaimWithoutStructuredYear = legacyWithheld.filter(
  (record) =>
    /Нобелевск/iu.test(record.legacyText) && !record.writer.nobelYear
);
const legacyWithWriterLevelSources = legacyWithheld.filter(
  (record) => record.writer.editorial?.sources?.length
);
const writerStatusBiographyMismatch = legacyWithheld.filter((record) =>
  ["reviewed", "verified"].includes(record.writer.editorial?.status || "")
);
const nonIsoBirthDates = records.filter(
  (record) =>
    record.writer.birthDate &&
    !/^\d{4}-\d{2}-\d{2}$/u.test(record.writer.birthDate)
);
const nonIsoDeathDates = records.filter(
  (record) =>
    record.writer.deathDate &&
    !/^\d{4}-\d{2}-\d{2}$/u.test(record.writer.deathDate)
);
const lengthBands = Object.fromEntries(
  ["0-39", "40-79", "80-119", "120-249", "250-499", "500+"].map(
    (band) => [
      band,
      records.filter((record) => lengthBand(record.legacyText.length) === band)
        .length,
    ]
  )
);
const sentenceCounts = Object.fromEntries(
  [0, 1, 2, 3, 4, "5+"].map((count) => [
    String(count),
    records.filter((record) => {
      const actual = source.countBiographySentences(record.legacyText);
      return count === "5+" ? actual >= 5 : actual === count;
    }).length,
  ])
);
const distinctLegacyWriterIds = new Set(
  legacyWithheld.map((record) => record.writer.id)
).size;
const staging = await stagingSummary(records);
const factQaReport = JSON.parse(await readFile(factQaReportPath, "utf8"));
const legacyCorrections = source.writerBiographyLegacyCorrections;
const quarantinedIdentities = source.quarantinedWriterIdentities;
const identityCorrections = source.writerIdentityCorrections;

const summary = {
  writerCardRecords: records.length,
  distinctCountryWriterKeys: new Set(records.map(recordKey)).size,
  distinctWriterIds: new Set(records.map((record) => record.writer.id)).size,
  distinctNormalizedDisplayNames: new Set(
    records.map((record) => normalizedIdentity(writerName(record.writer)))
  ).size,
  legacyRussianTextPresent: records.filter((record) => record.legacyText).length,
  gatePassingRussian: gatePassingRussian.length,
  gatePassingEnglish: gatePassingEnglish.length,
  russianWithheldByStrictGate: legacyWithheld.length,
  distinctWithheldWriterIds: distinctLegacyWriterIds,
  qualityScreenedLegacyDisplayCandidates: qualityScreenedLegacy.length,
  knownGenericLegacyBlockedFromDisplay: knownGeneric.length,
  restoredInPublicWriterViewsFromLegacy: qualityScreenedLegacy.length,
  stillWithheldInPublicWriterViews: knownGeneric.length,
  possibleRussianDisplayTotalWithoutWeakeningGate:
    gatePassingRussian.length + qualityScreenedLegacy.length,
  factCheckedByThisAutomatedAudit: 0,
  serviceBiographyCorrectionsWithRecordedEvidence: legacyCorrections.length,
  identityRiskRecordsQuarantined: quarantinedIdentities.length,
  identityRecordsRepairedFromAuthoritativeSources:
    identityCorrections.length,
  newlyPromotedToReviewedOrVerified: 0,
  legacyMigrationClosed:
    records.length > 0 &&
    gatePassingRussian.length === records.length &&
    legacyWithheld.length === 0,
  safeToDescribeLegacyMigrationAsComplete:
    records.length > 0 &&
    gatePassingRussian.length === records.length &&
    legacyWithheld.length === 0,
  safeToDescribeAsAllFactChecked: false,
  safeToDescribeAsAllFactCheckedFromThisAuditAlone: false,
};

const report = {
  version: 3,
  generatedAt: new Date().toISOString(),
  scope: {
    booksTouched: false,
    strictPublicationGateChanged: false,
    purpose:
      `Closure audit for legacy Russian biography fallback and strict RU publication coverage across ${records.length} public cards. It does not independently verify every prose claim.`,
  },
  summary,
  relatedFactQa: {
    report: "reports/writer-biography-fact-qa.json",
    sourceFingerprint: factQaReport.sourceFingerprint,
    writerCards: factQaReport.summary?.writerCards ?? null,
    biographiesPresent: factQaReport.summary?.biographiesPresent ?? null,
    concreteContradictionIssues:
      factQaReport.summary?.concreteContradictionIssues ?? null,
    calendarOrSourceDiscrepancyIssues:
      factQaReport.summary?.calendarOrSourceDiscrepancyIssues ?? null,
    recordsNeedingHumanClaimSources:
      factQaReport.summary?.recordsNeedingHumanClaimSources ?? null,
    boundary: factQaReport.scope?.statement ?? null,
    safeConclusion: factQaReport.automationBoundary?.safeConclusion ?? null,
  },
  provenance: {
    structuredRussianBiographyRecords: gatePassingRussian.length,
    gatePassingRussianWithNamedReviewer: gatePassingRussian.filter(
      (record) => record.writer.biographyTranslations?.ru?.reviewer
    ).length,
    gatePassingRussianWithoutNamedReviewer: gatePassingRussian.filter(
      (record) => !record.writer.biographyTranslations?.ru?.reviewer
    ).length,
    legacyOnlyWithPerTextProvenance: 0,
    legacyOnlyWithWriterLevelSourceCandidates:
      legacyWithWriterLevelSources.length,
    legacyOnlyWithoutAnyWriterLevelSourceCandidate:
      legacyWithheld.length - legacyWithWriterLevelSources.length,
    legacyOnlyWithRecordedCreationMethod: 0,
    rightsStatus:
      legacyWithheld.length === 0
        ? "Not applicable to the current public corpus: no biography is withheld behind the legacy-only fallback."
        : "Unproven for every withheld legacy text. This means the repository lacks a sufficient record; it is not a legal finding of infringement.",
    staging,
  },
  automatedQualitySignals: {
    legacyTextLengthBands: lengthBands,
    legacySentenceCounts: sentenceCounts,
    belowCurrentLengthOrSentenceGate: legacyWithheld.filter((record) => {
      const sentences = source.countBiographySentences(record.legacyText);
      return record.legacyText.length < 120 || sentences < 2;
    }).length,
    genericOrServiceTextRecords: knownGeneric.length,
    operationalCopyRecords: operationalRecords.length,
    exactDuplicateBiographyGroups: exactBiographyGroups.length,
    exactDuplicateBiographyRecords: exactBiographyGroups.flatMap(
      ([, group]) => group
    ).length,
    repeatedWriterIdGroups: repeatedWriterIdGroups.length,
    repeatedWriterIdRecords: repeatedWriterIdGroups.flatMap(([, group]) => group)
      .length,
    sameNormalizedNameDifferentIdGroups: sameNameDifferentIdGroups.length,
    unsupportedSuperlativeCandidates: superlativeRecords.length,
    nobelClaimWithoutStructuredNobelYear: nobelClaimWithoutStructuredYear.length,
    nonIsoBirthDateFields: nonIsoBirthDates.length,
    nonIsoDeathDateFields: nonIsoDeathDates.length,
    reviewedOrVerifiedWriterStatusButBiographyWithheld:
      writerStatusBiographyMismatch.length,
    mojibakeMarkerRecords: records.filter((record) =>
      ["Р°", "Рµ", "Рё", "СЃ", "С‚", "вЂ"].some((marker) =>
        record.legacyText.includes(marker)
      )
    ).length,
    embeddedUrlRecords: records.filter((record) =>
      /https?:\/\//iu.test(record.legacyText)
    ).length,
    caution:
      "Signals are triage flags, not proof that a statement is false or true. Absence of a flag is not a fact check.",
  },
  highRiskQueues: {
    knownGenericOrServiceText: knownGeneric.map((record) => ({
      ...brief(record),
      text: record.legacyText,
    })),
    exactDuplicateBiographyGroups: exactBiographyGroups.map(([text, group]) => ({
      normalizedText: text,
      records: group.map(brief),
    })),
    repeatedWriterIdGroups: repeatedWriterIdGroups.map(([id, group]) => ({
      writerId: id,
      records: group.map(brief),
    })),
    sameNormalizedNameDifferentIdGroups: sameNameDifferentIdGroups.map(
      ([name, group]) => ({
        normalizedName: name,
        records: group.map(brief),
      })
    ),
    writerStatusBiographyMismatch: writerStatusBiographyMismatch.map((record) => ({
      ...brief(record),
      cardStatus: record.writer.editorial?.status,
      writerLevelSourceUrls:
        record.writer.editorial?.sources?.map((item) => item.url) || [],
    })),
    superlativeSample: superlativeRecords.slice(0, 50).map((record) => ({
      ...brief(record),
      text: record.legacyText,
    })),
    nobelMetadataMismatchSample: nobelClaimWithoutStructuredYear
      .slice(0, 50)
      .map((record) => ({
        ...brief(record),
        text: record.legacyText,
      })),
  },
  displayPolicy: {
    mechanism: "src/data/writerBiographyDisplay.ts",
    strictSelector: "src/data/writerBiography.ts#selectWriterBiography",
    integratedPublicViews: [
      "src/components/WriterPanel.tsx",
      "src/components/WriterProfile.tsx",
    ],
    gatePassingBehavior:
      "Published locale-exact translation remains first choice and keeps its recorded status and sources.",
    currentLegacyRecordsDisplayed: qualityScreenedLegacy.length,
    legacyBehavior:
      legacyWithheld.length === 0
        ? "Dormant safety fallback only: every current public card passes the strict RU gate, so no legacy-only biography is displayed."
        : "Russian-only, non-generic legacy text is internally classified for QA with factCheck/provenance/rights all explicitly not recorded. Public views render the prose without any status marker.",
    englishFallback: false,
    knownGenericDisplayed: false,
    verifiedBadgeReuseForLegacy: false,
    publicLegacyStatusMarker: false,
    legalCaution:
      "Public rendering does not establish copyright provenance or factual correctness. The internal QA classification is not a reviewed/verified status and is never promoted automatically.",
  },
  legacyCuration: {
    publicStatusMarker: false,
    statusPromotion: false,
    corrections: legacyCorrections.map((item) => ({
      key: `${item.countryId}:${item.writerId}`,
      text: item.text,
      evidence: item.evidence,
      reviewBoundary:
        "Identity and named-work association checked for replacing a service placeholder; not a complete independent review of every possible biographical fact.",
    })),
    identityCorrections: identityCorrections.map((item) => ({
      originalKey: `${item.countryId}:${item.writerId}`,
      publicKey: `${item.countryId}:${item.replacement.id}`,
      text: item.replacement.bio,
      evidence: item.evidence,
      note: item.note,
    })),
    quarantined: quarantinedIdentities.map((item) => ({
      key: `${item.countryId}:${item.writerId}`,
      reason: item.reason,
      note: item.note,
    })),
    rule:
      "Service prose was replaced only where a real identity and named work could be tied to a recorded authoritative/official source. Ambiguous, duplicate, cross-country service and unsupported identities were removed from public country arrays pending evidence.",
  },
  manualFieldSpotChecks: {
    checkedAt: "2026-08-09",
    recordsSampled: 2,
    corpusWideVerification: false,
    items: [
      {
        key: "england:rudyard_kipling",
        fieldsChecked: [
          "identity",
          "life-dates",
          "language",
          "British India context",
        ],
        result:
          "The sampled structured biography is consistent with the official Nobel Prize facts page for these fields.",
        sourceUrl:
          "https://www.nobelprize.org/prizes/literature/1907/kipling/facts/",
        promotionDecision: "already passes the existing publication gate",
      },
      {
        key: "england:william_shakespeare",
        fieldsChecked: [
          "Stratford and London connection",
          "actor",
          "playwright",
          "acting-company partner",
        ],
        result:
          "The selected career claims are supported by the Folger Shakespeare Library life page.",
        sourceUrl: "https://www.folger.edu/explore/shakespeares-life/",
        promotionDecision:
          "not promoted: the legacy prose still lacks per-text creation method and provenance metadata",
      },
    ],
    warning:
      "Historical method sample only. Current corpus-wide contradiction triage is tracked separately in reports/writer-biography-fact-qa.json; neither report alone is a claim-by-claim factual certification.",
  },
  researchPlan: {
    initialWorkItems: distinctLegacyWriterIds,
    batchSize: 20,
    estimatedBatches: Math.ceil(distinctLegacyWriterIds / 20),
    stages: [
      "Разрешить каноническую личность, дубли и межстрановые связи",
      "Проверить по полям даты жизни, языки, национальный контекст и главные произведения",
      "Использовать две независимые authority-family, где это возможно; неопределённость фиксировать, а не угадывать",
      "Сохранить существующий авторский русский текст и вносить только доказуемые фактические и языковые исправления; полностью заменять лишь служебные placeholder-тексты",
      "Провести независимую факт-проверку, русскую вычитку и проверку provenance",
      "Продвинуть запись через неизменённый publication gate reviewed/verified",
    ],
    authoritativeStartingPoints: [
      {
        purpose: "identity, authorized names and life dates",
        provider: "Library of Congress Name Authority File",
        url: "https://id.loc.gov/authorities/names.html",
      },
      {
        purpose: "cross-library identity reconciliation",
        provider: "VIAF (OCLC)",
        url: "https://viaf.org/",
      },
      {
        purpose: "identity and bibliographic records",
        provider: "Bibliothèque nationale de France",
        url: "https://catalogue.bnf.fr/",
      },
      {
        purpose: "literature prize, dates, language, works and award context",
        provider: "Nobel Prize Outreach",
        url: "https://www.nobelprize.org/prizes/literature/",
      },
    ],
    sourceRule:
      "Authority records establish identity and dates, not literary interpretation. National libraries, literary museums, estates, academies and official prize archives are selected claim by claim. Source prose is not copied.",
    effortEstimate: {
      personHours:
        distinctLegacyWriterIds === 0
          ? { minimum: 0, maximum: 0 }
          : { minimum: 1450, maximum: 2100 },
      sixHourEditorDays:
        distinctLegacyWriterIds === 0
          ? { minimum: 0, maximum: 0 }
          : { minimum: 242, maximum: 350 },
      fourPersonFiveDayWeeks:
        distinctLegacyWriterIds === 0
          ? { minimum: 0, maximum: 0 }
          : { minimum: 13, maximum: 18 },
      includedWork:
        "Identity resolution, claim-by-claim source checking, minimal factual/Russian-language corrections, independent review and provenance entry.",
      excludedWork:
        "New English translations, portrait rights, books and unresolved legal consultation.",
    },
  },
};

await mkdir(reportDirectory, { recursive: true });
await writeFile(
  path.join(reportDirectory, "writer-biography-legacy-restoration-audit.json"),
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8"
);

const markdown = [
  "# Аудит возврата русских биографий писателей",
  "",
  `Сформирован: ${report.generatedAt}`,
  "",
  `> Этот отчёт не утверждает, что ${summary.writerCardRecords} публичные карточки фактологически проверены. Автоматический аудит классифицирует риски и provenance; истинность каждого утверждения проверяется только в редакционном workflow.`,
  "",
  "## Точный остаток",
  "",
  `- Карточек: ${summary.writerCardRecords}; уникальных \`countryId:writerId\`: ${summary.distinctCountryWriterKeys}; уникальных \`writerId\`: ${summary.distinctWriterIds}.`,
  `- Текущий строгий RU-gate проходит ${summary.gatePassingRussian}; скрыто ${summary.russianWithheldByStrictGate}.`,
  `- EN-gate проходит ${summary.gatePassingEnglish}. Русский legacy-текст не используется как английский fallback.`,
  `- Legacy \`bio\` физически хранится у ${summary.legacyRussianTextPresent} карточек.`,
  `- Автоматический screen допускает к публичному отображению ${summary.qualityScreenedLegacyDisplayCandidates} legacy-текстов, но сам по себе не проверяет их факты и происхождение; явных служебных/шаблонных текстов среди оставшихся публичных карточек: ${summary.knownGenericLegacyBlockedFromDisplay}.`,
  `- Всего RU-текст отображается у ${summary.possibleRussianDisplayTotalWithoutWeakeningGate} карточек: ${summary.gatePassingRussian} gate-passing + ${summary.qualityScreenedLegacyDisplayCandidates} legacy. Публичный интерфейс не показывает для legacy маркер статуса.`,
  `- Исправлено ${summary.serviceBiographyCorrectionsWithRecordedEvidence} служебных биографий реальных авторов; ${summary.identityRiskRecordsQuarantined} сомнительные/дублирующие карточки исключены из публичных массивов до подтверждения личности.`,
  `- Ещё ${summary.identityRecordsRepairedFromAuthoritativeSources} карточки с реальными авторами сохранены после исправления чужого ID, ложных дат и связанных полей по библиотечным/университетским источникам.`,
  "- Новых статусов `reviewed`/`verified` этот аудит не выставляет: 0.",
  "",
  "## Почему нельзя сказать «все проверены»",
  "",
  `- ${report.provenance.legacyOnlyWithoutAnyWriterLevelSourceCandidate} из ${summary.russianWithheldByStrictGate} legacy-текстов не имеют даже writer-level source candidate; у ${report.provenance.legacyOnlyWithWriterLevelSourceCandidates} такой кандидат есть, но он не является per-text provenance.`,
  `- У всех ${summary.russianWithheldByStrictGate} legacy-текстов не записаны способ создания и правовое происхождение. Это отсутствие доказательства в репозитории, а не вывод о нарушении.`,
  `- ${report.automatedQualitySignals.belowCurrentLengthOrSentenceGate} текстов не достигают текущего норматива по длине или числу предложений.`,
  `- ${report.automatedQualitySignals.genericOrServiceTextRecords} текст - служебный/шаблонный; ${report.automatedQualitySignals.operationalCopyRecords} содержат редакционные фразы вместо биографии.`,
  `- ${report.automatedQualitySignals.unsupportedSuperlativeCandidates} содержат суперлативы вроде «крупнейший» или «один из ведущих», которые требуют отдельного источника или нейтральной переписи.`,
  `- Дословные повторы: ${report.automatedQualitySignals.exactDuplicateBiographyRecords} карточек в ${report.automatedQualitySignals.exactDuplicateBiographyGroups} группах. Повторяющиеся ID: ${report.automatedQualitySignals.repeatedWriterIdRecords} карточки в ${report.automatedQualitySignals.repeatedWriterIdGroups} группах.`,
  `- У ${report.automatedQualitySignals.reviewedOrVerifiedWriterStatusButBiographyWithheld} карточек есть внутренний общий статус reviewed/verified, хотя сама биография не проходит gate. Этот статус не переносится на legacy-текст и не показывается рядом с описанием.`,
  `- ${report.automatedQualitySignals.nobelClaimWithoutStructuredNobelYear} legacy-текстов заявляют Нобелевскую премию без структурированного \`nobelYear\`; это очередь сверки metadata, а не доказанная фактическая ошибка.`,
  "",
  "## Что реализовано безопасно",
  "",
  "`src/data/writerBiographyDisplay.ts` добавляет отдельный display-selector. Он не меняет `selectWriterBiography` и не присваивает legacy-тексту редакционный статус.",
  "",
  "Selector подключён к публичным `WriterPanel` и `WriterProfile`.",
  "",
  "- Gate-passing биография остаётся `published` со своими sources/status.",
  "- Русский legacy получает только внутреннюю QA-классификацию; публично выводится сам текст без маркера статуса.",
  "- В результате явно записано: fact check - `not-recorded`, provenance - `not-recorded`, rights - `not-recorded`.",
  `- После ${summary.serviceBiographyCorrectionsWithRecordedEvidence} точечных замен и карантина ${summary.identityRiskRecordsQuarantined} identity-risk карточек публичных generic/service placeholder осталось ${summary.knownGenericLegacyBlockedFromDisplay}.`,
  "- Английского fallback нет.",
  "",
  "> Публичный интерфейс не сообщает статус legacy-текста. Это не делает текст проверенным: общий статус карточки автора не используется как доказательство статуса биографии, а строгий gate остаётся неизменным.",
  "",
  "## Контрольная ручная сверка методики",
  "",
  "Проверены только отдельные поля двух записей, а не весь корпус: сведения о Редьярде Киплинге сопоставлены с [официальной страницей Nobel Prize Outreach](https://www.nobelprize.org/prizes/literature/1907/kipling/facts/), а сведения о театральной карьере Шекспира - со [страницей Folger Shakespeare Library](https://www.folger.edu/explore/shakespeares-life/). Для Киплинга выбранные поля согласуются с источником. Шекспировская legacy-биография автоматически не promoted: writer-level источник не заменяет per-text provenance и запись способа создания текста.",
  "",
  `> Эта выборка из двух записей подтверждает пригодность процесса, но не является проверкой остальных ${Math.max(summary.writerCardRecords - 2, 0)} карточек и не доказывает каждое предложение в двух выбранных текстах.`,
  "",
  "## Точечные исправления служебных биографий",
  "",
  `Для ${legacyCorrections.length} реальных авторов прежняя служебная фраза заменена двумя короткими русскими предложениями. Проверены личность и связь с названным произведением по записанному источнику; это не означает полного независимого fact-check всей жизни автора и не выставляет статус reviewed/verified.`,
  "",
  ...legacyCorrections.map(
    (item) =>
      `- \`${item.countryId}:${item.writerId}\` - ${item.text} Источник: [${item.evidence[0].provider}](${item.evidence[0].url}).`
  ),
  "",
  "## Исправления личности и метаданных",
  "",
  ...identityCorrections.map(
    (item) =>
      `- \`${item.countryId}:${item.writerId}\` → \`${item.countryId}:${item.replacement.id}\` - ${item.replacement.bio} Источники: ${item.evidence.map((sourceItem) => `[${sourceItem.provider}](${sourceItem.url})`).join(", ")}.`
  ),
  "",
  "## Карантин сомнительных личностей",
  "",
  `Из публичной базы временно исключены ${quarantinedIdentities.length} записи с неверным/дублирующим ID, явной межстрановой служебной связью или без подтверждённого соответствия личности и произведения. Исходные файлы стран не удалены: записи можно вернуть после документированной сверки.`,
  "",
  ...quarantinedIdentities.map(
    (item) => `- \`${item.countryId}:${item.writerId}\` - ${item.note}`
  ),
  "",
  "## Реалистичный план",
  "",
  `Начальная очередь - ${report.researchPlan.initialWorkItems} уникальных legacy \`writerId\`, минимум ${report.researchPlan.estimatedBatches} партий по ${report.researchPlan.batchSize}. До подсчёта реальных людей нужно разрешить cross-country дубли и несовпадающие ID.`,
  "",
  ...report.researchPlan.stages.map((stage, index) => `${index + 1}. ${stage}.`),
  "",
  `Оценка: ${report.researchPlan.effortEstimate.personHours.minimum}-${report.researchPlan.effortEstimate.personHours.maximum} человеко-часов, или ${report.researchPlan.effortEstimate.sixHourEditorDays.minimum}-${report.researchPlan.effortEstimate.sixHourEditorDays.maximum} редакционных дней по 6 продуктивных часов. Команда из четырёх редакторов - ориентировочно ${report.researchPlan.effortEstimate.fourPersonFiveDayWeeks.minimum}-${report.researchPlan.effortEstimate.fourPersonFiveDayWeeks.maximum} рабочих недель.`,
  "",
  "Авторитетные точки входа: [Library of Congress Name Authority](https://id.loc.gov/authorities/names.html), [VIAF/OCLC](https://viaf.org/), [BnF](https://catalogue.bnf.fr/), [Nobel Prize Outreach](https://www.nobelprize.org/prizes/literature/). Они используются по назначению: authority-запись подтверждает identity/имя/даты, но не заменяет источник литературной интерпретации.",
  "",
  "Полные очереди и примеры находятся в JSON-версии отчёта.",
  "",
].join("\n");

await writeFile(
  path.join(reportDirectory, "writer-biography-legacy-restoration-audit.md"),
  markdown,
  "utf8"
);

console.log(JSON.stringify(summary, null, 2));
