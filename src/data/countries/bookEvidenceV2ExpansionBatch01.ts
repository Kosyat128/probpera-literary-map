import type {
  Country,
  WorkDescriptionProvenanceProfile,
  WorkLocalizedTitleProfile,
  WorkProfile,
  WorkSourceProfile,
  WorkTitleEvidenceProfile,
} from "./types";

const checkedAt = "2026-09-02";
const checkedBy = "Probpera editorial research";
const recordKey = "usa:francis_scott_fitzgerald:the-great-gatsby";

type TitleEvidenceDraft = Omit<
  WorkTitleEvidenceProfile,
  "entityKind" | "retrievedAt" | "checkedAt" | "checkedBy"
>;

function titleEvidence(draft: TitleEvidenceDraft): WorkTitleEvidenceProfile {
  return {
    entityKind: "manifestation",
    ...draft,
    retrievedAt: checkedAt,
    checkedAt,
    checkedBy,
  };
}

function localizedTitle(
  locale: "ru" | "en",
  value: string,
  selectionRule: WorkLocalizedTitleProfile["selectionRule"],
  selectionNote: string,
  evidence: WorkTitleEvidenceProfile[]
): WorkLocalizedTitleProfile {
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

const ruTitle = localizedTitle(
  "ru",
  "Великий Гэтсби",
  "authoritative-uniform-title",
  "Название подтверждено национальной библиографической записью первого русского издания 1965 года в переводе Е. Д. Калашниковой и самостоятельным каталогом действующего российского издателя.",
  [
    titleEvidence({
      manifestationId: "neb-000200-000018-rc-4910930",
      sourceUrl:
        "https://rusneb.ru/catalog/000200_000018_rc_4910930/",
      provider: "Национальная электронная библиотека",
      authorityId: "neb",
      authorityTier: "A",
      recordKind: "national-bibliography",
      recordId: "NEB-000200_000018_rc_4910930",
      catalogTitleExact: "Великий Гэтсби",
      locale: "ru",
      market: "RU",
      expressionLanguage: "ru",
      publisher: "Художественная литература",
      publicationYear: 1965,
      translator: "Е. Д. Калашникова",
    }),
    titleEvidence({
      manifestationId: "isbn-9785170923045",
      sourceUrl: "https://ast.ru/book/velikiy-getsbi-715812/",
      provider: "Издательство АСТ",
      authorityId: "ast",
      authorityTier: "B",
      recordKind: "publisher-catalog",
      recordId: "ISBN-9785170923045",
      catalogTitleExact: "Великий Гэтсби",
      locale: "ru",
      market: "RU",
      expressionLanguage: "ru",
      isbn13: "9785170923045",
      publisher: "АСТ",
    }),
  ]
);

const enTitle = localizedTitle(
  "en",
  "The Great Gatsby",
  "current-complete-authorized-edition",
  "The Library of Congress record and the official Scribner publisher page identify the same complete, estate-authorized US edition and its exact English title.",
  [
    titleEvidence({
      manifestationId: "loc-96016596",
      sourceUrl: "https://lccn.loc.gov/96016596",
      provider: "Library of Congress",
      authorityId: "loc",
      authorityTier: "A",
      recordKind: "legal-deposit-catalog",
      recordId: "LCCN-96016596",
      catalogTitleExact: "The great Gatsby",
      locale: "en",
      market: "US",
      expressionLanguage: "en",
      isbn10: "0684830426",
      isbn13: "9780684830421",
      publisher: "Scribner",
      publicationYear: 1996,
      editionStatement: "Scribner Classics, authorized text",
    }),
    titleEvidence({
      manifestationId: "isbn-9780684830421",
      sourceUrl:
        "https://www.simonandschuster.com/books/The-Great-Gatsby/F-Scott-Fitzgerald/9780684830421",
      provider: "Scribner / Simon & Schuster",
      authorityId: "simon-schuster-us",
      authorityTier: "B",
      recordKind: "publisher-catalog",
      recordId: "ISBN-9780684830421",
      catalogTitleExact: "The Great Gatsby",
      locale: "en",
      market: "US",
      expressionLanguage: "en",
      isbn13: "9780684830421",
      publisher: "Scribner",
      publicationYear: 1996,
      editionStatement: "The Only Authorized Edition",
    }),
  ]
);

const description = {
  ru: "Роман, рассказанный Ником Каррауэем, разворачивается летом 1922 года на Лонг-Айленде и сосредоточен на загадочном миллионере Джее Гэтсби, который стремится вернуть любовь Дейзи Бьюкенен. Через столкновение «старых» и «новых» денег Фицджеральд исследует классовое неравенство, самообман и разрушительную сторону американской мечты на фоне эпохи джаза.",
  en: "Narrated by Nick Carraway and set on Long Island in the summer of 1922, the novel centers on the mysterious millionaire Jay Gatsby and his attempt to recover his love for Daisy Buchanan. Through the collision of old and new money, Fitzgerald examines class division, self-deception, and the destructive side of the American Dream against the backdrop of the Jazz Age.",
  ruSha256:
    "b3e8e9d1211d92c64aca48485471f000d041812fbdf334550de1a9c5e5ef2c75",
};

const locDescriptionUrl =
  "https://www.loc.gov/exhibits/america-reads/1900-to-1949.html#obj016";
const publisherUrl =
  "https://www.simonandschuster.com/books/The-Great-Gatsby/F-Scott-Fitzgerald/9780684830421";

const descriptionSources: WorkSourceProfile[] = [
  {
    provider: "Library of Congress",
    authorityId: "loc",
    authorityTier: "A",
    country: "usa",
    language: "en",
    recordKind: "authoritative-work-page",
    recordId: "LOC-AMERICA-READS-016",
    url: locDescriptionUrl,
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
    provider: "Scribner / Simon & Schuster",
    authorityId: "simon-schuster-us",
    authorityTier: "B",
    country: "usa",
    market: "US",
    language: "en",
    recordKind: "publisher-catalog",
    recordId: "ISBN-9780684830421",
    url: publisherUrl,
    fields: [
      "identity",
      "authorship",
      "title",
      "publication-year",
      "language",
      "description",
      "market",
    ],
    usage: "reference-only",
    retrievedAt: checkedAt,
  },
];

function titleSource(evidence: WorkTitleEvidenceProfile): WorkSourceProfile {
  return {
    provider: evidence.provider,
    authorityId: evidence.authorityId,
    authorityTier: evidence.authorityTier,
    market: evidence.market,
    language: evidence.expressionLanguage,
    recordKind: evidence.recordKind,
    recordId: evidence.recordId,
    url: evidence.sourceUrl,
    fields: ["title", "publication-year", "language", "market"],
    usage: "reference-only",
    retrievedAt: evidence.retrievedAt,
  };
}

function canonicalUrl(value: string) {
  const parsed = new URL(value);
  parsed.hash = "";
  parsed.searchParams.sort();
  if (parsed.pathname !== "/") {
    parsed.pathname = parsed.pathname.replace(/\/+$/u, "");
  }
  return parsed.toString();
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

function descriptionProvenance(
  locale: "ru" | "en"
): WorkDescriptionProvenanceProfile {
  const sourceUrls = [locDescriptionUrl, publisherUrl];
  if (locale === "ru") {
    return {
      origin: "official-source-synthesis",
      sourceLanguage: "en",
      sourceCountry: "usa",
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
    sourceCountry: "usa",
    sourceUrls,
    transformations: ["style-edited"],
    translatedFromLocale: "ru",
    translatedFromSourceHash: description.ruSha256,
    rights: { textOrigin: "project-original", copiedSourceText: false },
    author: "Probpera bilingual editorial translation",
    createdAt: checkedAt,
    reviewedBy: "Codex bilingual consistency review",
    reviewedAt: checkedAt,
  };
}

/** First strict expansion beyond the predecessor public set. */
export function applyBookEvidenceV2ExpansionBatch01Work(
  countryId: string,
  writerId: string,
  work: WorkProfile
): WorkProfile {
  if (`${countryId}:${writerId}:${work.id}` !== recordKey) return work;

  const ruTitleUrls = ruTitle.evidence.map((item) => item.sourceUrl);
  const enTitleUrls = enTitle.evidence.map((item) => item.sourceUrl);
  const descriptionUrls = descriptionSources.map((item) => item.url);
  const base = { ...work };
  delete base.canon;

  return {
    ...base,
    title: ruTitle.value,
    originalTitle: "The Great Gatsby",
    firstPublished: 1925,
    originalLanguage: "английский",
    description: description.ru,
    translations: {
      ...base.translations,
      ru: {
        locale: "ru",
        title: ruTitle.value,
        description: description.ru,
        sourceLanguage: "en",
        status: "verified",
        sourceUrls: [...ruTitleUrls, ...descriptionUrls],
        method: "editorial-original",
        reviewedAt: checkedAt,
        titleEvidence: ruTitle,
        descriptionProvenance: descriptionProvenance("ru"),
      },
      en: {
        locale: "en",
        title: enTitle.value,
        description: description.en,
        sourceLanguage: "ru",
        status: "verified",
        sourceUrls: [...enTitleUrls, ...descriptionUrls],
        method: "human-translation",
        reviewedAt: checkedAt,
        titleEvidence: enTitle,
        descriptionProvenance: descriptionProvenance("en"),
      },
    },
    localizedTitles: { ...base.localizedTitles, ru: ruTitle, en: enTitle },
    sources: mergeSources(base.sources || [], [
      ...ruTitle.evidence.map(titleSource),
      ...enTitle.evidence.map(titleSource),
      ...descriptionSources,
    ]),
    sourceUrl: locDescriptionUrl,
    editorial: { status: "verified", reviewedAt: checkedAt },
  };
}

export function applyBookEvidenceV2ExpansionBatch01(
  countries: Country[]
): Country[] {
  let matches = 0;
  const result = countries.map((country) => ({
    ...country,
    writers: country.writers.map((writer) => ({
      ...writer,
      workDetails: writer.workDetails?.map((work) => {
        if (`${country.id}:${writer.id}:${work.id}` !== recordKey) return work;
        matches += 1;
        return applyBookEvidenceV2ExpansionBatch01Work(
          country.id,
          writer.id,
          work
        );
      }),
    })),
  }));
  if (matches !== 1) {
    throw new Error(
      `book-evidence-v2-expansion-batch-01-target-cardinality:${matches}`
    );
  }
  return result;
}

export const bookEvidenceV2ExpansionBatch01RecordKeys = Object.freeze([
  recordKey,
]);

