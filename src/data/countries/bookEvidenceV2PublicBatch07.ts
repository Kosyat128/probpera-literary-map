import { applyBookEvidenceV2PublicBatch04Work } from "./bookEvidenceV2PublicBatch04";
import { applyBookEvidenceV2PublicBatch05Work } from "./bookEvidenceV2PublicBatch05";
import type {
  Country,
  WorkDescriptionProvenanceProfile,
  WorkLocale,
  WorkLocalizedTitleProfile,
  WorkProfile,
  WorkSourceProfile,
  WorkTitleEvidenceProfile,
} from "./types";

const checkedAt = "2026-09-02";
const checkedBy = "Probpera editorial research";

const thibaultsKey = "france:roger_martin_du_gard:the-thibaults";
const historyOfRomeKey = "germany:theodor_mommsen:history-of-rome";
const blackMonkKey = "russia:chekhov:the-black-monk";
const manInCaseKey = "russia:chekhov:the-man-in-a-case";
const ladyWithDogKey = "russia:chekhov:the-lady-with-the-dog";

type TitleEvidenceDraft = Omit<
  WorkTitleEvidenceProfile,
  "entityKind" | "retrievedAt" | "checkedAt" | "checkedBy"
>;

export type BookEvidenceV2PublicBatch07AuthorityDraft = {
  authorityId:
    | "german-national-library"
    | "penguin-random-house-higher-education"
    | "open-road-media";
  provider: string;
  authorityCountryId: "germany" | "usa";
  independenceGroup: string;
  tier: "A" | "B";
  allowedRoles: Array<"title-publisher" | "description-fact">;
  domains: string[];
  markets: string[];
};

export type BookEvidenceV2PublicBatch07Hold = {
  recordKey: typeof thibaultsKey;
  status: "fail-closed";
  code: "complete-multipart-expression-independent-evidence-unresolved";
  candidateTitles: { ru: "Семья Тибо"; en: "The Thibaults" };
  reason: string;
  componentEvidence: Array<{
    locale: WorkLocale;
    authorityId: "loc" | "neb" | "rsl";
    sourceUrl: string;
    recordId: string;
    observedTitle: string;
    scope: string;
    disposition: "required-component" | "insufficient-alone";
  }>;
  resolutionCriteria: string[];
};

function titleEvidence(draft: TitleEvidenceDraft): WorkTitleEvidenceProfile {
  return {
    entityKind: "manifestation",
    ...draft,
    retrievedAt: checkedAt,
    checkedAt,
    checkedBy,
  };
}

function localizedTitle({
  recordKey,
  locale,
  value,
  selectionRule,
  selectionNote,
  evidence,
}: {
  recordKey: string;
  locale: WorkLocale;
  value: string;
  selectionRule: WorkLocalizedTitleProfile["selectionRule"];
  selectionNote: string;
  evidence: WorkTitleEvidenceProfile[];
}): WorkLocalizedTitleProfile {
  return {
    entityKind: "expression",
    expressionId: `${recordKey}:${locale}`,
    locale,
    value,
    status: "verified-published",
    expressionLanguage: locale,
    market: locale === "ru" ? "RU" : "US",
    selectionRule,
    selectionNote,
    evidence,
  };
}

function titleSource(evidence: WorkTitleEvidenceProfile): WorkSourceProfile {
  const containedFields: WorkSourceProfile["fields"] =
    evidence.titleRelation === "contained-work"
      ? ["container-title", "contained-title"]
      : [];
  return {
    provider: evidence.provider,
    authorityId: evidence.authorityId,
    authorityTier: evidence.authorityTier,
    market: evidence.market,
    language: evidence.expressionLanguage,
    recordKind: evidence.recordKind,
    recordId: evidence.recordId,
    url: evidence.sourceUrl,
    fields: [
      "title",
      ...containedFields,
      "publication-year",
      "language",
      "market",
    ],
    usage: "reference-only",
    retrievedAt: evidence.retrievedAt,
  };
}

function canonicalUrl(value: string) {
  try {
    const parsed = new URL(value);
    parsed.hash = "";
    parsed.searchParams.sort();
    if (parsed.pathname !== "/") {
      parsed.pathname = parsed.pathname.replace(/\/+$/u, "");
    }
    return parsed.toString();
  } catch {
    return value;
  }
}

function mergeSources(
  current: WorkSourceProfile[],
  additions: WorkSourceProfile[]
) {
  const byUrl = new Map<string, WorkSourceProfile>();
  for (const source of [...current, ...additions]) {
    const key = canonicalUrl(source.url);
    const existing = byUrl.get(key);
    byUrl.set(
      key,
      existing
        ? {
            ...existing,
            ...source,
            fields: [...new Set([...existing.fields, ...source.fields])],
          }
        : source
    );
  }
  return [...byUrl.values()];
}

function mergeUrls(current: string[] | undefined, additions: string[]) {
  return [...new Set([...(current || []), ...additions])];
}

const locStoriesUrl = "https://lccn.loc.gov/00037894";
const prhStoriesUrl =
  "https://penguinrandomhousehighereducation.com/book/?isbn=9780553381009";

function locStoriesContainedTitle(
  analyticTitleExact: "The Black Monk" | "The Man in a Case"
) {
  return titleEvidence({
    manifestationId: "loc-00037894",
    sourceUrl: locStoriesUrl,
    provider: "Library of Congress",
    authorityId: "loc",
    authorityTier: "A",
    recordKind: "legal-deposit-catalog",
    recordId: "LCCN-00037894",
    titleRelation: "contained-work",
    catalogTitleExact: "Stories",
    analyticTitleExact,
    containerTitleExact: "Stories",
    containedInField: "table-of-contents",
    locale: "en",
    market: "US",
    expressionLanguage: "en",
    isbn10: "0553381008",
    isbn13: "9780553381009",
    publisher: "Bantam Books",
    publicationYear: 2000,
    translator: "Richard Pevear and Larissa Volokhonsky",
  });
}

function prhStoriesContainedTitle(
  analyticTitleExact: "The Black Monk" | "The Man in a Case"
) {
  return titleEvidence({
    manifestationId: "isbn-9780553381009",
    sourceUrl: prhStoriesUrl,
    provider: "Penguin Random House Higher Education",
    authorityId: "penguin-random-house-higher-education",
    authorityTier: "B",
    recordKind: "publisher-catalog",
    recordId: "ISBN-9780553381009",
    titleRelation: "contained-work",
    catalogTitleExact: "Selected Stories of Anton Chekhov",
    analyticTitleExact,
    containerTitleExact: "Selected Stories of Anton Chekhov",
    containedInField: "table-of-contents",
    locale: "en",
    market: "US",
    expressionLanguage: "en",
    isbn10: "0553381008",
    isbn13: "9780553381009",
    publisher: "Modern Library",
    publicationYear: 2000,
    translator: "Richard Pevear and Larissa Volokhonsky",
  });
}

const chekhovEnTitleEvidence: Record<
  string,
  WorkLocalizedTitleProfile
> = {
  [blackMonkKey]: localizedTitle({
    recordKey: blackMonkKey,
    locale: "en",
    value: "The Black Monk",
    selectionRule: "current-complete-authorized-edition",
    selectionNote:
      "The exact story title is linked analytically to the same US collection by the Library of Congress record and the independent official publisher table of contents.",
    evidence: [
      locStoriesContainedTitle("The Black Monk"),
      prhStoriesContainedTitle("The Black Monk"),
    ],
  }),
  [manInCaseKey]: localizedTitle({
    recordKey: manInCaseKey,
    locale: "en",
    value: "The Man in a Case",
    selectionRule: "current-complete-authorized-edition",
    selectionNote:
      "The exact story title is linked analytically to the same US collection by the Library of Congress record and the independent official publisher table of contents.",
    evidence: [
      locStoriesContainedTitle("The Man in a Case"),
      prhStoriesContainedTitle("The Man in a Case"),
    ],
  }),
  [ladyWithDogKey]: localizedTitle({
    recordKey: ladyWithDogKey,
    locale: "en",
    value: "The Lady with the Dog",
    selectionRule: "current-complete-authorized-edition",
    selectionNote:
      "The exact US title is supported by a Library of Congress contents note and an independent principal-title record from the official publisher.",
    evidence: [
      titleEvidence({
        manifestationId: "loc-84006121",
        sourceUrl: "https://lccn.loc.gov/84006121",
        provider: "Library of Congress",
        authorityId: "loc",
        authorityTier: "A",
        recordKind: "legal-deposit-catalog",
        recordId: "LCCN-84006121",
        titleRelation: "contained-work",
        catalogTitleExact: "The lady with the dog and other stories",
        analyticTitleExact: "The lady with the dog",
        containerTitleExact: "The lady with the dog and other stories",
        containedInField: "contents-note",
        locale: "en",
        market: "US",
        expressionLanguage: "en",
        isbn10: "0880010509",
        isbn13: "9780880010504",
        publisher: "Ecco Press",
        publicationYear: 1984,
      }),
      titleEvidence({
        manifestationId: "isbn-9781504034616",
        sourceUrl:
          "https://openroadmedia.com/ebook/the-lady-with-the-dog/9781504034616",
        provider: "Open Road Media",
        authorityId: "open-road-media",
        authorityTier: "B",
        recordKind: "publisher-catalog",
        recordId: "ISBN-9781504034616",
        catalogTitleExact: "The Lady with the Dog",
        locale: "en",
        market: "US",
        expressionLanguage: "en",
        isbn13: "9781504034616",
        publisher: "Open Road Media",
        publicationYear: 2016,
      }),
    ],
  }),
};

const mommsenDescription = {
  ru: "Моммзен прослеживает развитие Рима от ранней Италии до падения республики, объединяя политическую историю, право, экономику и анализ источников. Научная аргументация сочетается с выразительным повествованием и ясными оценками исторических деятелей и институтов.",
  en: "Mommsen traces Rome from early Italy to the fall of the Republic, combining political history with law, economics and close analysis of sources. Scholarly argument is joined to forceful narrative and sharply drawn judgments of historical figures and institutions.",
  ruSha256:
    "3d6750821070d6ec0c3bfd79d005c6a4c8c88860336c3e02d048f428e71b0212",
};

const mommsenDescriptionSources: WorkSourceProfile[] = [
  {
    provider: "Deutsche Nationalbibliothek",
    authorityId: "german-national-library",
    authorityTier: "A",
    country: "germany",
    language: "de",
    recordKind: "authoritative-work-page",
    recordId: "DNB-1238863817-34",
    url: "https://d-nb.info/1238863817/34",
    fields: [
      "identity",
      "authorship",
      "original-title",
      "publication-year",
      "description",
    ],
    usage: "reference-only",
    retrievedAt: checkedAt,
  },
  {
    provider: "Nobel Prize Outreach",
    authorityId: "nobel-prize-outreach",
    authorityTier: "B",
    country: "sweden",
    language: "en",
    recordKind: "authoritative-work-page",
    recordId: "NOBEL-1902-MOMMSEN-FACTS",
    url: "https://www.nobelprize.org/prizes/literature/1902/mommsen/facts/",
    fields: [
      "identity",
      "authorship",
      "original-title",
      "publication-year",
      "description",
      "award-criterion",
    ],
    usage: "reference-only",
    retrievedAt: checkedAt,
  },
];

const mommsenRuTitleEvidence = localizedTitle({
  recordKey: historyOfRomeKey,
  locale: "ru",
  value: "Римская история",
  selectionRule: "authoritative-uniform-title",
  selectionNote:
    "The exact Russian title is the MARC 245 title of the complete 1858-1861 two-part translation on the official NEB and RSL national-catalog surfaces; later abridged Chechulin compendia are excluded.",
  evidence: [
    titleEvidence({
      manifestationId: "neb-000199-000009-003506955",
      sourceUrl: "https://rusneb.ru/catalog/000199_000009_003506955/",
      provider: "Национальная электронная библиотека",
      authorityId: "neb",
      authorityTier: "A",
      recordKind: "national-bibliography",
      recordId: "NEB-000199_000009_003506955",
      catalogTitleExact: "Римская история",
      locale: "ru",
      market: "RU",
      expressionLanguage: "ru",
      publisher: "Университетская типография",
      publicationYear: 1858,
      translator: "С. Д. Шестаков",
      editionStatement: "Многотомное издание 1858-1861 годов, части 1-2",
    }),
    titleEvidence({
      manifestationId: "rsl-01003506955",
      sourceUrl: "https://search.rsl.ru/ru/record/01003506955",
      provider: "Российская государственная библиотека",
      authorityId: "rsl",
      authorityTier: "A",
      recordKind: "national-bibliography",
      recordId: "RSL-01003506955",
      catalogTitleExact: "Римская история",
      locale: "ru",
      market: "RU",
      expressionLanguage: "ru",
      publisher: "Университетская типография",
      publicationYear: 1858,
      translator: "С. Д. Шестаков",
      editionStatement: "Многотомное издание 1858-1861 годов, части 1-2",
    }),
  ],
});

const mommsenEnTitleEvidence = localizedTitle({
  recordKey: historyOfRomeKey,
  locale: "en",
  value: "The History of Rome",
  selectionRule: "current-complete-authorized-edition",
  selectionNote:
    "The exact English title is supported by the Library of Congress record and Routledge's complete 2,774-page publisher edition.",
  evidence: [
    titleEvidence({
      manifestationId: "loc-08001455",
      sourceUrl: "https://lccn.loc.gov/08001455",
      provider: "Library of Congress",
      authorityId: "loc",
      authorityTier: "A",
      recordKind: "legal-deposit-catalog",
      recordId: "LCCN-08001455",
      catalogTitleExact: "The History of Rome",
      locale: "en",
      market: "US",
      expressionLanguage: "en",
      publisher: "C. Scribner & Co.",
      publicationYear: 1870,
    }),
    titleEvidence({
      manifestationId: "isbn-9780415149532",
      sourceUrl:
        "https://www.routledge.com/The-History-of-Rome/Mommsen/p/book/9780415149532",
      provider: "Routledge",
      authorityId: "routledge",
      authorityTier: "B",
      recordKind: "publisher-catalog",
      recordId: "ISBN-9780415149532",
      catalogTitleExact: "The History of Rome",
      locale: "en",
      market: "US",
      expressionLanguage: "en",
      isbn13: "9780415149532",
      publisher: "Routledge",
      publicationYear: 1996,
    }),
  ],
});

function mommsenDescriptionProvenance(
  locale: WorkLocale
): WorkDescriptionProvenanceProfile {
  const sourceUrls = mommsenDescriptionSources.map((source) => source.url);
  if (locale === "ru") {
    return {
      origin: "official-source-synthesis",
      sourceLanguage: "de",
      sourceCountry: "germany",
      sourceUrls,
      transformations: [
        "condensed",
        "deduplicated",
        "spoiler-limited",
        "style-edited",
      ],
      rights: { textOrigin: "project-original", copiedSourceText: false },
      author: "Probpera editorial synthesis",
      createdAt: checkedAt,
      reviewedBy: "Codex bibliographic fact review",
      reviewedAt: checkedAt,
    };
  }
  return {
    origin: "human-translation",
    sourceLanguage: "ru",
    sourceCountry: "germany",
    sourceUrls,
    transformations: ["style-edited"],
    translatedFromLocale: "ru",
    translatedFromSourceHash: mommsenDescription.ruSha256,
    rights: { textOrigin: "project-original", copiedSourceText: false },
    author: "Probpera bilingual editorial translation",
    createdAt: checkedAt,
    reviewedBy: "Codex bilingual consistency review",
    reviewedAt: checkedAt,
  };
}

export const bookEvidenceV2PublicBatch07Holds = Object.freeze<
  BookEvidenceV2PublicBatch07Hold[]
>([
  {
    recordKey: thibaultsKey,
    status: "fail-closed",
    code: "complete-multipart-expression-independent-evidence-unresolved",
    candidateTitles: { ru: "Семья Тибо", en: "The Thibaults" },
    reason:
      "The complete English expression is demonstrably split across two Library of Congress manifestations: The Thibaults contains parts I-VI and Summer, 1914 contains part VII plus the part VIII Epilogue. Those two records are jointly exhaustive but belong to one authority; neither one alone is the complete cycle, and an independent official record for the same composite expression has not been established. The reviewed Russian records likewise describe a single volume or a pre-Epilogue edition rather than independently proving the complete eight-part cycle.",
    componentEvidence: [
      {
        locale: "en",
        authorityId: "loc",
        sourceUrl: "https://lccn.loc.gov/39027260",
        recordId: "LCCN-39027260",
        observedTitle: "The Thibaults",
        scope: "Viking Press, 1939; explicitly includes parts I-VI.",
        disposition: "required-component",
      },
      {
        locale: "en",
        authorityId: "loc",
        sourceUrl: "https://lccn.loc.gov/41051575",
        recordId: "LCCN-41051575",
        observedTitle: "Summer, 1914",
        scope:
          "Viking Press, 1941; explicitly comprises L'Été 1914 (part VII) and Epilogue (part VIII).",
        disposition: "required-component",
      },
      {
        locale: "ru",
        authorityId: "neb",
        sourceUrl: "https://rusneb.ru/catalog/000199_000009_007943769/",
        recordId: "NEB-000199_000009_007943769",
        observedTitle: "Семья Тибо",
        scope: "1987 edition, volume 1 only.",
        disposition: "insufficient-alone",
      },
      {
        locale: "ru",
        authorityId: "rsl",
        sourceUrl: "https://search.rsl.ru/ru/record/01005121213",
        recordId: "RSL-01005121213",
        observedTitle: "Семья Тибо",
        scope:
          "Two-volume 1936 edition predating publication of the cycle's Epilogue.",
        disposition: "insufficient-alone",
      },
    ],
    resolutionCriteria: [
      "Add an explicit multipart-expression contract that requires exhaustive, non-overlapping part coverage and never treats either component manifestation as the whole cycle.",
      "Obtain an independent official national-catalog, publisher, or rights-holder record for both English components (or for a complete set such as The World of the Thibaults).",
      "Obtain two independent official records for a post-Epilogue complete Russian set and verify its volume-to-part coverage before restoring RU and EN verified-published title evidence.",
    ],
  },
]);

export const bookEvidenceV2PublicBatch07AuthorityDrafts = Object.freeze<
  BookEvidenceV2PublicBatch07AuthorityDraft[]
>([
  {
    authorityId: "german-national-library",
    provider: "deutsche-nationalbibliothek",
    authorityCountryId: "germany",
    independenceGroup: "deutsche-nationalbibliothek",
    tier: "A",
    allowedRoles: ["description-fact"],
    domains: ["d-nb.info"],
    markets: [],
  },
  {
    authorityId: "penguin-random-house-higher-education",
    provider: "penguin-random-house-higher-education",
    authorityCountryId: "usa",
    independenceGroup: "penguin-random-house-group",
    tier: "B",
    allowedRoles: ["title-publisher"],
    domains: ["penguinrandomhousehighereducation.com"],
    markets: ["US"],
  },
  {
    authorityId: "open-road-media",
    provider: "open-road-media",
    authorityCountryId: "usa",
    independenceGroup: "open-road-media",
    tier: "B",
    allowedRoles: ["title-publisher"],
    domains: ["openroadmedia.com"],
    markets: ["US"],
  },
]);

export const bookEvidenceV2PublicBatch07RequiredAuthorityIds = Object.freeze([
  "german-national-library",
  "loc",
  "neb",
  "nobel-prize-outreach",
  "open-road-media",
  "penguin-random-house-higher-education",
  "routledge",
  "rsl",
]);

export const bookEvidenceV2PublicBatch07ResolvedRecordKeys = Object.freeze([
  historyOfRomeKey,
  blackMonkKey,
  manInCaseKey,
  ladyWithDogKey,
]);

export const bookEvidenceV2PublicBatch07RecordKeys = Object.freeze([
  thibaultsKey,
  ...bookEvidenceV2PublicBatch07ResolvedRecordKeys,
]);

const targetRecordKeys = new Set(bookEvidenceV2PublicBatch07RecordKeys);

function applyChekhovResolution(
  work: WorkProfile,
  enTitleEvidence: WorkLocalizedTitleProfile
) {
  const ru = work.translations?.ru;
  const en = work.translations?.en;
  const ruTitleEvidence = work.localizedTitles?.ru || ru?.titleEvidence;
  if (
    !ru ||
    !en ||
    !ruTitleEvidence ||
    !ru.descriptionProvenance ||
    !en.descriptionProvenance
  ) {
    throw new Error(
      `book-evidence-v2-public-batch-07-chekhov-baseline-missing:${work.id}`
    );
  }
  const evidenceUrls = enTitleEvidence.evidence.map(
    (evidence) => evidence.sourceUrl
  );
  return {
    ...work,
    translations: {
      ...work.translations,
      ru: { ...ru, status: "verified" as const, reviewedAt: checkedAt },
      en: {
        ...en,
        title: enTitleEvidence.value,
        status: "verified" as const,
        reviewedAt: checkedAt,
        sourceUrls: mergeUrls(en.sourceUrls, evidenceUrls),
        titleEvidence: enTitleEvidence,
      },
    },
    localizedTitles: {
      ...work.localizedTitles,
      ru: ruTitleEvidence,
      en: enTitleEvidence,
    },
    sources: mergeSources(
      work.sources || [],
      enTitleEvidence.evidence.map(titleSource)
    ),
    editorial: { status: "verified" as const, reviewedAt: checkedAt },
  };
}

function applyMommsenResolution(work: WorkProfile) {
  const ruDescriptionUrls = mommsenDescriptionSources.map(
    (source) => source.url
  );
  const ruTitleUrls = mommsenRuTitleEvidence.evidence.map(
    (evidence) => evidence.sourceUrl
  );
  const enTitleUrls = mommsenEnTitleEvidence.evidence.map(
    (evidence) => evidence.sourceUrl
  );
  const base = { ...work };
  delete base.canon;
  const rejectedHeldSourceUrls = new Set([
    canonicalUrl("https://search.rsl.ru/ru/record/01003909568"),
    canonicalUrl("https://eksmo.ru/amp/book/istoriya-rima-ITD1265309/"),
  ]);
  const retainedSources = (base.sources || []).filter(
    (source) => !rejectedHeldSourceUrls.has(canonicalUrl(source.url))
  );
  return {
    ...base,
    title: "Римская история",
    description: mommsenDescription.ru,
    translations: {
      ...base.translations,
      ru: {
        ...(base.translations?.ru || {}),
        locale: "ru" as const,
        title: "Римская история",
        description: mommsenDescription.ru,
        sourceLanguage: "ru",
        status: "verified" as const,
        sourceUrls: [...ruTitleUrls, ...ruDescriptionUrls],
        method: "editorial-original" as const,
        reviewedAt: checkedAt,
        titleEvidence: mommsenRuTitleEvidence,
        descriptionProvenance: mommsenDescriptionProvenance("ru"),
      },
      en: {
        ...(base.translations?.en || {}),
        locale: "en" as const,
        title: "The History of Rome",
        description: mommsenDescription.en,
        sourceLanguage: "ru",
        status: "verified" as const,
        sourceUrls: [...enTitleUrls, ...ruDescriptionUrls],
        method: "human-translation" as const,
        reviewedAt: checkedAt,
        titleEvidence: mommsenEnTitleEvidence,
        descriptionProvenance: mommsenDescriptionProvenance("en"),
      },
    },
    localizedTitles: {
      ...base.localizedTitles,
      ru: mommsenRuTitleEvidence,
      en: mommsenEnTitleEvidence,
    },
    sources: mergeSources(retainedSources, [
      ...mommsenDescriptionSources,
      ...mommsenRuTitleEvidence.evidence.map(titleSource),
      ...mommsenEnTitleEvidence.evidence.map(titleSource),
    ]),
    editorial: { status: "verified" as const, reviewedAt: checkedAt },
  };
}

function quarantineHold(work: WorkProfile, hold: BookEvidenceV2PublicBatch07Hold) {
  const base = { ...work };
  delete base.canon;
  const ru = base.translations?.ru;
  const en = base.translations?.en;
  return {
    ...base,
    translations: {
      ...base.translations,
      ...(ru ? { ru: { ...ru, status: "draft" as const } } : {}),
      ...(en ? { en: { ...en, status: "draft" as const } } : {}),
    },
    editorial: { status: "draft" as const, reviewedAt: checkedAt },
    evidenceV2Hold: hold,
  };
}

/**
 * Closes four assigned records and quarantines the unresolved multipart cycle.
 * The predecessor overlays are re-applied only for assigned records, making
 * this function standalone and deterministic without touching the registry.
 */
export function applyBookEvidenceV2PublicBatch07Work(
  countryId: string,
  writerId: string,
  work: WorkProfile
): WorkProfile {
  const recordKey = `${countryId}:${writerId}:${work.id}`;
  if (!targetRecordKeys.has(recordKey)) return work;

  if (recordKey === thibaultsKey || recordKey === historyOfRomeKey) {
    const baseline = applyBookEvidenceV2PublicBatch04Work(
      countryId,
      writerId,
      work
    );
    if (recordKey === historyOfRomeKey) {
      return applyMommsenResolution(baseline);
    }
    return quarantineHold(baseline, bookEvidenceV2PublicBatch07Holds[0]);
  }

  const baseline = applyBookEvidenceV2PublicBatch05Work(
    countryId,
    writerId,
    work
  );
  const evidence = chekhovEnTitleEvidence[recordKey];
  if (!evidence) {
    throw new Error(`book-evidence-v2-public-batch-07-overlay-missing:${recordKey}`);
  }
  return applyChekhovResolution(baseline, evidence);
}

/** Applies the exact five-record batch immutably and enforces cardinality. */
export function applyBookEvidenceV2PublicBatch07(
  countries: Country[]
): Country[] {
  const seen = new Map<string, number>(
    bookEvidenceV2PublicBatch07RecordKeys.map((recordKey) => [recordKey, 0])
  );
  const result = countries.map((country) => ({
    ...country,
    writers: country.writers.map((writer) => ({
      ...writer,
      workDetails: writer.workDetails?.map((work) => {
        const recordKey = `${country.id}:${writer.id}:${work.id}`;
        if (!targetRecordKeys.has(recordKey)) return work;
        seen.set(recordKey, (seen.get(recordKey) || 0) + 1);
        return applyBookEvidenceV2PublicBatch07Work(
          country.id,
          writer.id,
          work
        );
      }),
    })),
  }));

  const cardinalityErrors = [...seen.entries()].filter(
    ([, count]) => count !== 1
  );
  if (cardinalityErrors.length > 0) {
    throw new Error(
      `book-evidence-v2-public-batch-07-target-cardinality:${cardinalityErrors
        .map(([recordKey, count]) => `${recordKey}=${count}`)
        .join(",")}`
    );
  }
  return result;
}
