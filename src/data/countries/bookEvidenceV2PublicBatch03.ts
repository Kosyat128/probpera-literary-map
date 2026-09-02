import { withoutUndefinedTitleEvidenceOptions } from "./bookEvidenceV2TitleEvidence";
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

type TitleEvidenceDraft = Omit<
  WorkTitleEvidenceProfile,
  "entityKind" | "retrievedAt" | "checkedAt" | "checkedBy"
>;

type DescriptionSource = WorkSourceProfile & {
  authorityId: string;
  authorityTier: "A" | "B";
  recordKind: "authoritative-work-page";
};

type ReviewedDescription = {
  ru: string;
  en: string;
  ruSha256: string;
  sources: DescriptionSource[];
};

type BatchOverlay = {
  recordKey: string;
  ruTitle: string;
  enTitle: string;
  description: ReviewedDescription;
  enTitleEvidence: WorkLocalizedTitleProfile;
  ruTitleEvidence?: WorkLocalizedTitleProfile;
  heldRuPublisherEvidence?: WorkTitleEvidenceProfile[];
};

export type BookEvidenceV2PublicBatch03Hold = {
  recordKey: string;
  status: "fail-closed";
  locale: "ru";
  code: "ru-national-record-unresolved";
  candidateTitle: string;
  reason: string;
  resolutionCriteria: string[];
  publisherEvidence: WorkTitleEvidenceProfile[];
};

export type BookEvidenceV2PublicBatch03AuthorityDraft = {
  authorityId: string;
  provider: string;
  authorityCountryId: "england";
  independenceGroup: string;
  tier: "B";
  allowedRoles: ["description-fact"];
  domains: string[];
  markets: string[];
};

function titleEvidence(draft: TitleEvidenceDraft): WorkTitleEvidenceProfile {
  return {
    entityKind: "manifestation",
    ...withoutUndefinedTitleEvidenceOptions(draft),
    retrievedAt: checkedAt,
    checkedAt,
    checkedBy,
  };
}

function localizedTitle({
  recordKey,
  locale,
  value,
  market,
  selectionRule,
  selectionNote,
  evidence,
}: {
  recordKey: string;
  locale: WorkLocale;
  value: string;
  market: string;
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
    market,
    selectionRule,
    selectionNote,
    evidence,
  };
}

function descriptionSource({
  provider,
  authorityId,
  authorityTier = "B",
  recordId,
  url,
  fields = [
    "identity",
    "authorship",
    "original-title",
    "publication-year",
    "description",
  ],
}: {
  provider: string;
  authorityId: string;
  authorityTier?: "A" | "B";
  recordId: string;
  url: string;
  fields?: WorkSourceProfile["fields"];
}): DescriptionSource {
  return {
    provider,
    authorityId,
    authorityTier,
    country: "england",
    language: "en",
    recordKind: "authoritative-work-page",
    recordId,
    url,
    fields,
    usage: "reference-only",
    retrievedAt: checkedAt,
  };
}

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

function descriptionProvenance(
  locale: WorkLocale,
  description: ReviewedDescription
): WorkDescriptionProvenanceProfile {
  const sourceUrls = description.sources.map((source) => source.url);
  if (locale === "ru") {
    return {
      origin: "official-source-synthesis",
      sourceLanguage: "en",
      sourceCountry: "england",
      sourceUrls,
      transformations: [
        "condensed",
        "deduplicated",
        "spoiler-limited",
        "style-edited",
      ],
      rights: {
        textOrigin: "project-original",
        copiedSourceText: false,
      },
      author: "Probpera editorial synthesis",
      createdAt: checkedAt,
      reviewedBy: "Codex bibliographic fact review",
      reviewedAt: checkedAt,
    };
  }
  return {
    origin: "human-translation",
    sourceLanguage: "ru",
    sourceCountry: "england",
    sourceUrls,
    transformations: ["style-edited"],
    translatedFromLocale: "ru",
    translatedFromSourceHash: description.ruSha256,
    rights: {
      textOrigin: "project-original",
      copiedSourceText: false,
    },
    author: "Probpera bilingual editorial translation",
    createdAt: checkedAt,
    reviewedBy: "Codex bilingual consistency review",
    reviewedAt: checkedAt,
  };
}

const animalFarmKey = "england:george_orwell:animal-farm-editorial";
const nineteenEightyFourKey =
  "england:george_orwell:nineteen-eighty-four";
const forsyteSagaKey = "england:john_galsworthy:the-forsyte-saga";
const ghostwrittenKey = "england:david_mitchell:ghostwritten";
const number9DreamKey = "england:david_mitchell:number9dream";
const thousandAutumnsKey =
  "england:david_mitchell:the-thousand-autumns-of-jacob-de-zoet";
const boneClocksKey = "england:david_mitchell:the-bone-clocks";
const sladeHouseKey = "england:david_mitchell:slade-house";

const orwellAnimalFarm = descriptionSource({
  provider: "The Orwell Foundation",
  authorityId: "orwell-foundation",
  recordId: "books-by-orwell-animal-farm",
  url: "https://www.orwellfoundation.com/the-orwell-foundation/orwell/books-by-orwell/animal-farm/",
});
const penguinAnimalFarm = descriptionSource({
  provider: "Penguin Books UK",
  authorityId: "penguin-uk",
  recordId: "ISBN-9780241341667",
  url: "https://www.penguin.co.uk/books/57033/animal-farm-by-orwell-george/9780241341667",
});
const orwellNineteenEightyFour = descriptionSource({
  provider: "The Orwell Foundation",
  authorityId: "orwell-foundation",
  recordId: "books-by-orwell-nineteen-eighty-four",
  url: "https://www.orwellfoundation.com/the-orwell-foundation/orwell/books-by-orwell/nineteen-eighty-four/",
});
const penguinOrwellGuide = descriptionSource({
  provider: "Penguin Books UK",
  authorityId: "penguin-uk",
  recordId: "george-orwell-reading-guide-books-order",
  url: "https://www.penguin.co.uk/discover/articles/george-orwell-reading-guide-books-order",
});
const penguinForsyte = descriptionSource({
  provider: "Penguin Books UK",
  authorityId: "penguin-uk",
  recordId: "ISBN-9780141184180",
  url: "https://www.penguin.co.uk/books/57173/the-forsyte-saga-by-john-galsworthy/9780141184180",
});
const britishLibraryGalsworthy = descriptionSource({
  provider: "British Library",
  authorityId: "british-library",
  authorityTier: "A",
  recordId: "press-release-2024-11-27-galsworthy-archive",
  url: "https://www.bl.uk/about/press/releases/british-library-acquires-elizabeth-barrett-browning-letters-and-john-galsworthy-archive",
});
const hachetteGhostwritten = descriptionSource({
  provider: "Hodder & Stoughton / Hachette UK",
  authorityId: "hodder-stoughton",
  recordId: "ISBN-9780340739754",
  url: "https://www.hachette.co.uk/titles/david-mitchell-6/ghostwritten/9780340739754/",
});
const kentGhostwritten = descriptionSource({
  provider: "University of Kent, School of English",
  authorityId: "university-of-kent",
  recordId: "english-news-2013-10-14-david-mitchell",
  url: "https://blogs.kent.ac.uk/english-news/2013/10/14/the-school-of-english-welcomes-alumnus-david-mitchell-back-to-kent/",
});
const hodderNumber9Dream = descriptionSource({
  provider: "Hodder & Stoughton",
  authorityId: "hodder-stoughton",
  recordId: "ISBN-9781529338836",
  url: "https://www.hodder.co.uk/titles/david-mitchell-6/number9dream/9781529338836/",
});
const bookerNumber9Dream = descriptionSource({
  provider: "Booker Prize Foundation",
  authorityId: "booker-prize-foundation",
  recordId: "booker-library-number9dream",
  url: "https://thebookerprizes.com/the-booker-library/books/number9dream",
});
const hodderThousandAutumns = descriptionSource({
  provider: "Hodder & Stoughton",
  authorityId: "hodder-stoughton",
  recordId: "ISBN-9780340921586",
  url: "https://www.hodder.co.uk/titles/david-mitchell-6/the-thousand-autumns-of-jacob-de-zoet/9780340921586/",
});
const bookerThousandAutumns = descriptionSource({
  provider: "Booker Prize Foundation",
  authorityId: "booker-prize-foundation",
  recordId: "booker-library-the-thousand-autumns-of-jacob-de-zoet",
  url: "https://thebookerprizes.com/the-booker-library/books/the-thousand-autumns-of-jacob-de-zoet",
});
const hodderBoneClocks = descriptionSource({
  provider: "Hodder & Stoughton",
  authorityId: "hodder-stoughton",
  recordId: "ISBN-9780340921623",
  url: "https://www.hodder.co.uk/titles/david-mitchell-6/the-bone-clocks/9780340921623/",
});
const bookerBoneClocks = descriptionSource({
  provider: "Booker Prize Foundation",
  authorityId: "booker-prize-foundation",
  recordId: "booker-library-the-bone-clocks",
  url: "https://thebookerprizes.com/the-booker-library/books/the-bone-clocks",
});
const hodderSladeHouse = descriptionSource({
  provider: "Hodder & Stoughton",
  authorityId: "hodder-stoughton",
  recordId: "ISBN-9781473616707",
  url: "https://www.hodder.co.uk/titles/david-mitchell-6/slade-house/9781473616707/",
});
const mitchellOfficialSladeHouse = descriptionSource({
  provider: "David Mitchell official books site",
  authorityId: "david-mitchell-official",
  recordId: "books-slade-house",
  url: "https://davidmitchellbooks.com/books",
});

function locEvidence({
  lccn,
  title,
  isbn10,
  isbn13,
  publisher,
  publicationYear,
}: {
  lccn: string;
  title: string;
  isbn10?: string;
  isbn13?: string;
  publisher: string;
  publicationYear: number;
}) {
  return titleEvidence({
    manifestationId: `loc-${lccn}`,
    sourceUrl: `https://lccn.loc.gov/${lccn}`,
    provider: "Library of Congress",
    authorityId: "loc",
    authorityTier: "A",
    recordKind: "national-bibliography",
    recordId: `LOC-${lccn}`,
    catalogTitleExact: title,
    locale: "en",
    market: "US",
    expressionLanguage: "en",
    isbn10,
    isbn13,
    publisher,
    publicationYear,
  });
}

function prhEvidence({
  workId,
  slug,
  title,
  isbn13,
  publisher,
  publicationYear,
}: {
  workId: string;
  slug: string;
  title: string;
  isbn13: string;
  publisher: string;
  publicationYear: number;
}) {
  return titleEvidence({
    manifestationId: `isbn-${isbn13}`,
    sourceUrl: `https://www.penguinrandomhouse.com/books/${workId}/${slug}/`,
    provider: "Penguin Random House",
    authorityId: "penguin-random-house",
    authorityTier: "B",
    recordKind: "publisher-catalog",
    recordId: `ISBN-${isbn13}`,
    catalogTitleExact: title,
    locale: "en",
    market: "US",
    expressionLanguage: "en",
    isbn13,
    publisher,
    publicationYear,
  });
}

const heldRuPublisherEvidence: Record<string, WorkTitleEvidenceProfile[]> = {
  [ghostwrittenKey]: [
    titleEvidence({
      manifestationId: "isbn-9785389163300",
      sourceUrl: "https://azbooka.ru/books/literaturnyy-prizrak",
      provider: "Азбука-Аттикус / Иностранка",
      authorityId: "azbooka",
      authorityTier: "B",
      recordKind: "publisher-catalog",
      recordId: "ISBN-9785389163300",
      catalogTitleExact: "Литературный призрак",
      locale: "ru",
      market: "RU",
      expressionLanguage: "ru",
      isbn13: "9785389163300",
      publisher: "Иностранка",
      publicationYear: 2022,
      translator: "Ирина Климовицкая",
    }),
    titleEvidence({
      manifestationId: "isbn-9785699897438",
      sourceUrl:
        "https://eksmo.ru/amp/book/literaturnyy-prizrak-ITD814760/",
      provider: "Эксмо",
      authorityId: "eksmo",
      authorityTier: "B",
      recordKind: "publisher-catalog",
      recordId: "ISBN-9785699897438",
      catalogTitleExact: "Литературный призрак",
      locale: "ru",
      market: "RU",
      expressionLanguage: "ru",
      isbn13: "9785699897438",
      publisher: "Эксмо",
      publicationYear: 2016,
    }),
  ],
  [number9DreamKey]: [
    titleEvidence({
      manifestationId: "isbn-9785389216808",
      sourceUrl: "https://azbooka.ru/books/son-9",
      provider: "Азбука-Аттикус / Азбука",
      authorityId: "azbooka",
      authorityTier: "B",
      recordKind: "publisher-catalog",
      recordId: "ISBN-9785389216808",
      catalogTitleExact: "Сон № 9",
      locale: "ru",
      market: "RU",
      expressionLanguage: "ru",
      isbn13: "9785389216808",
      publisher: "Азбука",
      publicationYear: 2022,
      translator: "Мария Нуянзина",
    }),
    titleEvidence({
      manifestationId: "isbn-9785699969623",
      sourceUrl: "https://eksmo.ru/amp/book/son-9-ITD855531/",
      provider: "Эксмо / Like Book",
      authorityId: "eksmo",
      authorityTier: "B",
      recordKind: "publisher-catalog",
      recordId: "ISBN-9785699969623",
      catalogTitleExact: "Сон № 9",
      locale: "ru",
      market: "RU",
      expressionLanguage: "ru",
      isbn13: "9785699969623",
      publisher: "Like Book",
      publicationYear: 2017,
    }),
  ],
  [boneClocksKey]: [
    titleEvidence({
      manifestationId: "isbn-9785389162778",
      sourceUrl: "https://azbooka.ru/books/kostyanye-chasy-tqez",
      provider: "Азбука-Аттикус / Иностранка",
      authorityId: "azbooka",
      authorityTier: "B",
      recordKind: "publisher-catalog",
      recordId: "ISBN-9785389162778",
      catalogTitleExact: "Костяные часы",
      locale: "ru",
      market: "RU",
      expressionLanguage: "ru",
      isbn13: "9785389162778",
      publisher: "Иностранка",
      publicationYear: 2022,
      translator: "Александра Питчер",
    }),
  ],
  [sladeHouseKey]: [
    titleEvidence({
      manifestationId: "isbn-9785389137127",
      sourceUrl: "https://azbooka.ru/books/golodnyy-dom-yush",
      provider: "Азбука-Аттикус / Азбука",
      authorityId: "azbooka",
      authorityTier: "B",
      recordKind: "publisher-catalog",
      recordId: "ISBN-9785389137127",
      catalogTitleExact: "Голодный дом",
      locale: "ru",
      market: "RU",
      expressionLanguage: "ru",
      isbn13: "9785389137127",
      publisher: "Азбука",
      publicationYear: 2023,
      translator: "Александра Питчер",
    }),
  ],
};

function heldRuTitle(
  recordKey: string,
  candidateTitle: string
): BookEvidenceV2PublicBatch03Hold {
  return {
    recordKey,
    status: "fail-closed",
    locale: "ru",
    code: "ru-national-record-unresolved",
    candidateTitle,
    reason:
      "Точное русское заглавие подтверждено официальным российским издателем, но прямая стабильная запись РГБ, РНБ или НЭБ для русской печатной манифестации не установлена. Издательские карточки одной или нескольких групп не заменяют национальную или legal-deposit запись Tier A.",
    resolutionCriteria: [
      `Найти прямую стабильную запись РГБ, РНБ или НЭБ, где основное заглавие русской печатной манифестации указано точно как «${candidateTitle}».`,
      "Сверить в национальной записи ISBN, издателя, год, язык выражения и переводчика; не использовать поисковый сниппет или региональный каталог вместо самой записи.",
      "Сопоставить национальную запись с независимой официальной карточкой российского издателя и только затем добавить verified-published RU title evidence.",
    ],
    publisherEvidence: heldRuPublisherEvidence[recordKey],
  };
}

export const bookEvidenceV2PublicBatch03Holds = Object.freeze([
  heldRuTitle(ghostwrittenKey, "Литературный призрак"),
  heldRuTitle(number9DreamKey, "Сон № 9"),
  heldRuTitle(boneClocksKey, "Костяные часы"),
  heldRuTitle(sladeHouseKey, "Голодный дом"),
]);

export const bookEvidenceV2PublicBatch03AuthorityDrafts = Object.freeze<
  BookEvidenceV2PublicBatch03AuthorityDraft[]
>([
  {
    authorityId: "orwell-foundation",
    provider: "orwell-foundation",
    authorityCountryId: "england",
    independenceGroup: "orwell-foundation",
    tier: "B",
    allowedRoles: ["description-fact"],
    domains: ["orwellfoundation.com"],
    markets: [],
  },
  {
    authorityId: "hodder-stoughton",
    provider: "hodder-and-stoughton-hachette-uk",
    authorityCountryId: "england",
    independenceGroup: "hachette-uk-publishing-group",
    tier: "B",
    allowedRoles: ["description-fact"],
    domains: ["hodder.co.uk", "hachette.co.uk"],
    markets: [],
  },
  {
    authorityId: "booker-prize-foundation",
    provider: "booker-prize-foundation",
    authorityCountryId: "england",
    independenceGroup: "booker-prize-foundation",
    tier: "B",
    allowedRoles: ["description-fact"],
    domains: ["thebookerprizes.com"],
    markets: [],
  },
  {
    authorityId: "university-of-kent",
    provider: "university-of-kent",
    authorityCountryId: "england",
    independenceGroup: "university-of-kent",
    tier: "B",
    allowedRoles: ["description-fact"],
    domains: ["kent.ac.uk"],
    markets: [],
  },
  {
    authorityId: "david-mitchell-official",
    provider: "david-mitchell-official-books-site",
    authorityCountryId: "england",
    independenceGroup: "david-mitchell-official",
    tier: "B",
    allowedRoles: ["description-fact"],
    domains: ["davidmitchellbooks.com"],
    markets: [],
  },
]);

export const bookEvidenceV2PublicBatch03RequiredAuthorityIds = Object.freeze([
  "ast",
  "azbooka",
  "booker-prize-foundation",
  "british-library",
  "david-mitchell-official",
  "eksmo",
  "hodder-stoughton",
  "loc",
  "orwell-foundation",
  "penguin-random-house",
  "penguin-uk",
  "rsl",
  "university-of-kent",
]);

const overlays: Record<string, BatchOverlay> = {
  [animalFarmKey]: {
    recordKey: animalFarmKey,
    ruTitle: "Скотный двор",
    enTitle: "Animal Farm",
    description: {
      ru: "После изгнания фермера Джонса животные фермы пытаются построить общество свободы и равенства, но власть постепенно переходит к свиньям во главе с Наполеоном. Революционные обещания превращаются в новый режим принуждения, поэтому повесть становится политической аллегорией перерождения освободительного проекта в тиранию.",
      en: "After driving out the farmer Mr Jones, the animals of the farm try to build a society of freedom and equality, but power gradually passes to the pigs led by Napoleon. The promises of the revolution turn into a new regime of coercion, making the novella a political allegory of an emancipatory project degenerating into tyranny.",
      ruSha256:
        "8048aa5312ca66d14082be604f4828e32e4011df254f5f906fa9e74115a1358e",
      sources: [orwellAnimalFarm, penguinAnimalFarm],
    },
    ruTitleEvidence: localizedTitle({
      recordKey: animalFarmKey,
      locale: "ru",
      value: "Скотный двор",
      market: "RU",
      selectionRule: "current-complete-authorized-edition",
      selectionNote:
        "Основное заглавие подтверждено записью РГБ и независимой карточкой АСТ; сведения относятся к двум опубликованным манифестациям.",
      evidence: [
        titleEvidence({
          manifestationId: "isbn-9785170681839",
          sourceUrl: "https://search.rsl.ru/ru/record/01004940163",
          provider: "Российская государственная библиотека",
          authorityId: "rsl",
          authorityTier: "A",
          recordKind: "national-bibliography",
          recordId: "RSL-01004940163",
          catalogTitleExact: "Скотный двор",
          locale: "ru",
          market: "RU",
          expressionLanguage: "ru",
          isbn13: "9785170681839",
          publisher: "АСТ : Астрель",
          publicationYear: 2010,
          translator: "Л. Беспалова и др.",
          editionStatement: "Скотный двор ; Эссе : сборник",
        }),
        titleEvidence({
          manifestationId: "isbn-9785171217693",
          sourceUrl: "https://ast.ru/book/skotnyy-dvor-850255/",
          provider: "АСТ",
          authorityId: "ast",
          authorityTier: "B",
          recordKind: "publisher-catalog",
          recordId: "ISBN-9785171217693",
          catalogTitleExact: "Скотный двор",
          locale: "ru",
          market: "RU",
          expressionLanguage: "ru",
          isbn13: "9785171217693",
          publisher: "АСТ",
        }),
      ],
    }),
    enTitleEvidence: localizedTitle({
      recordKey: animalFarmKey,
      locale: "en",
      value: "Animal Farm",
      market: "US",
      selectionRule: "current-complete-authorized-edition",
      selectionNote:
        "The exact English title is supported by a Library of Congress manifestation record and an independent US publisher record.",
      evidence: [
        locEvidence({
          lccn: "92054299",
          title: "Animal farm",
          isbn10: "0679420398",
          isbn13: "9780679420392",
          publisher: "Alfred A. Knopf",
          publicationYear: 1993,
        }),
        prhEvidence({
          workId: "327220",
          slug: "animal-farm-by-george-orwell-with-a-foreword-by-ann-patchett-and-a-new-introduction-by-tea-obreht/9780452284241",
          title: "Animal Farm",
          isbn13: "9780452284241",
          publisher: "Berkley",
          publicationYear: 2003,
        }),
      ],
    }),
  },
  [nineteenEightyFourKey]: {
    recordKey: nineteenEightyFourKey,
    ruTitle: "1984",
    enTitle: "1984",
    description: {
      ru: "Уинстон Смит служит в Министерстве правды, где переписывает прошлое в соответствии с текущей линией Партии, хотя внутренне отвергает её власть. Его попытка сохранить личную память, чувство и самостоятельное суждение разворачивается в мире тотальной слежки, идеологического языка и систематического насилия.",
      en: "Winston Smith works at the Ministry of Truth, where he rewrites the past to match the Party’s current line, even though he inwardly rejects its rule. His attempt to preserve personal memory, feeling, and independent judgment unfolds in a world of total surveillance, ideological language, and systematic violence.",
      ruSha256:
        "d296e9c26635a9d85551958f5b4c9bd347bc1c78a3e41161047c7c100b66add8",
      sources: [orwellNineteenEightyFour, penguinOrwellGuide],
    },
    ruTitleEvidence: localizedTitle({
      recordKey: nineteenEightyFourKey,
      locale: "ru",
      value: "1984",
      market: "RU",
      selectionRule: "current-complete-authorized-edition",
      selectionNote:
        "Цифровое основное заглавие 1984 совпадает в записи РГБ и официальной карточке АСТ; словесная форма в РГБ является параллельным заглавием.",
      evidence: [
        titleEvidence({
          manifestationId: "isbn-9785170801152",
          sourceUrl: "https://search.rsl.ru/ru/record/01006717528",
          provider: "Российская государственная библиотека",
          authorityId: "rsl",
          authorityTier: "A",
          recordKind: "national-bibliography",
          recordId: "RSL-01006717528",
          catalogTitleExact: "1984",
          locale: "ru",
          market: "RU",
          expressionLanguage: "ru",
          isbn13: "9785170801152",
          publisher: "АСТ",
          publicationYear: 2014,
          translator: "В. Голышев",
          editionStatement: "1984 = Тысяча девятьсот восемьдесят четыре",
        }),
        titleEvidence({
          manifestationId: "isbn-9785170801152",
          sourceUrl: "https://ast.ru/book/1984-130417/",
          provider: "АСТ",
          authorityId: "ast",
          authorityTier: "B",
          recordKind: "publisher-catalog",
          recordId: "ISBN-9785170801152",
          catalogTitleExact: "1984",
          locale: "ru",
          market: "RU",
          expressionLanguage: "ru",
          isbn13: "9785170801152",
          publisher: "АСТ",
          publicationYear: 2014,
        }),
      ],
    }),
    enTitleEvidence: localizedTitle({
      recordKey: nineteenEightyFourKey,
      locale: "en",
      value: "1984",
      market: "US",
      selectionRule: "current-complete-authorized-edition",
      selectionNote:
        "The numeric US-market title is supported by a Library of Congress record and an independent Berkley publisher record.",
      evidence: [
        locEvidence({
          lccn: "2002282045",
          title: "1984",
          isbn10: "0030565073",
          publisher: "Holt, Rinehart and Winston",
          publicationYear: 2002,
        }),
        prhEvidence({
          workId: "326569",
          slug: "1984-by-george-orwell-with-a-foreword-by-thomas-pynchon",
          title: "1984",
          isbn13: "9780452284234",
          publisher: "Berkley",
          publicationYear: 2003,
        }),
      ],
    }),
  },
  [forsyteSagaKey]: {
    recordKey: forsyteSagaKey,
    ruTitle: "Сага о Форсайтах",
    enTitle: "The Forsyte Saga",
    description: {
      ru: "Цикл прослеживает судьбы состоятельной семьи Форсайтов на рубеже XIX и XX веков, когда её культ собственности и общественной респектабельности сталкивается с меняющимися нравами. В центре семейного разлома находится брак Сомса и Ирэн: конфликт между притязанием на обладание и личной свободой отражается на двух поколениях.",
      en: "The cycle follows the fortunes of the wealthy Forsyte family at the turn of the twentieth century, as its cult of property and social respectability confronts changing values. At the center of the family rupture is the marriage of Soames and Irene: the conflict between possessive claims and personal freedom reverberates through two generations.",
      ruSha256:
        "c71165b6bf8250c55e5d7785a811cb983dae2ba0db066cf897ce1b970a3f4246",
      sources: [penguinForsyte, britishLibraryGalsworthy],
    },
    ruTitleEvidence: localizedTitle({
      recordKey: forsyteSagaKey,
      locale: "ru",
      value: "Сага о Форсайтах",
      market: "RU",
      selectionRule: "current-complete-authorized-edition",
      selectionNote:
        "Основное русское заглавие подтверждено записью РГБ и независимой современной карточкой АСТ.",
      evidence: [
        titleEvidence({
          manifestationId: "isbn-9785946430432",
          sourceUrl: "https://search.rsl.ru/ru/record/01003419581",
          provider: "Российская государственная библиотека",
          authorityId: "rsl",
          authorityTier: "A",
          recordKind: "national-bibliography",
          recordId: "RSL-01003419581",
          catalogTitleExact: "Сага о Форсайтах",
          locale: "ru",
          market: "RU",
          expressionLanguage: "ru",
          isbn13: "9785946430432",
          publisher: "АСТ : Пушкинская библиотека",
          publicationYear: 2007,
          translator: "под общей редакцией М. Ф. Лорие",
        }),
        titleEvidence({
          manifestationId: "isbn-9785171272852",
          sourceUrl: "https://ast.ru/book/saga-o-forsaytakh-852774/",
          provider: "АСТ",
          authorityId: "ast",
          authorityTier: "B",
          recordKind: "publisher-catalog",
          recordId: "ISBN-9785171272852",
          catalogTitleExact: "Сага о Форсайтах",
          locale: "ru",
          market: "RU",
          expressionLanguage: "ru",
          isbn13: "9785171272852",
          publisher: "АСТ",
        }),
      ],
    }),
    enTitleEvidence: localizedTitle({
      recordKey: forsyteSagaKey,
      locale: "en",
      value: "The Forsyte Saga",
      market: "GB",
      selectionRule: "original-market-title",
      selectionNote:
        "The British-market title is supported by the British Library electronic legal-deposit record and the matching Penguin UK edition record.",
      evidence: [
        titleEvidence({
          manifestationId: "isbn-9780141907963",
          sourceUrl: "https://eld.bl.uk/catalog/018529627",
          provider: "British Library Electronic Legal Deposit Catalogue",
          authorityId: "british-library",
          authorityTier: "A",
          recordKind: "legal-deposit-catalog",
          recordId: "BL-ELD-018529627",
          catalogTitleExact: "The Forsyte Saga",
          locale: "en",
          market: "GB",
          expressionLanguage: "en",
          isbn13: "9780141907963",
          publisher: "Penguin",
          publicationYear: 2001,
          editionStatement: "Volume 1",
        }),
        titleEvidence({
          manifestationId: "isbn-9780141907963",
          sourceUrl:
            "https://www.penguin.co.uk/books/57173/the-forsyte-saga-by-john-galsworthy/9780141907963",
          provider: "Penguin Books UK",
          authorityId: "penguin-uk",
          authorityTier: "B",
          recordKind: "publisher-catalog",
          recordId: "ISBN-9780141907963",
          catalogTitleExact: "The Forsyte Saga",
          locale: "en",
          market: "GB",
          expressionLanguage: "en",
          isbn13: "9780141907963",
          publisher: "Penguin",
          publicationYear: 2001,
        }),
      ],
    }),
  },
  [ghostwrittenKey]: {
    recordKey: ghostwrittenKey,
    ruTitle: "Литературный призрак",
    enTitle: "Ghostwritten",
    description: {
      ru: "Дебютный роман Митчелла объединяет несколько взаимосвязанных повествований, проходящих через города и окраины Азии, Европы и Северной Америки; среди героев - участник секты, любитель джаза, физик и ночной радиоведущий. Их истории связывает цепь встреч и последствий, в которой граница между случайностью, причинностью и невидимым вмешательством остаётся подвижной. Книга вышла в 1999 году и получила премию Джона Ллевеллина Риса.",
      en: "Mitchell’s debut novel brings together several interconnected narratives that move through cities and remote places in Asia, Europe, and North America; its characters include a cult member, a jazz enthusiast, a physicist, and a late-night radio host. Their stories are connected by a chain of encounters and consequences in which the boundary between chance, causality, and unseen intervention remains fluid. Published in 1999, the book won the John Llewellyn Rhys Prize.",
      ruSha256:
        "ba5779ab9c77a60bfa218e6e50772ca45ea830b1a852b380fa33f08f648c6eae",
      sources: [hachetteGhostwritten, kentGhostwritten],
    },
    heldRuPublisherEvidence: heldRuPublisherEvidence[ghostwrittenKey],
    enTitleEvidence: localizedTitle({
      recordKey: ghostwrittenKey,
      locale: "en",
      value: "Ghostwritten",
      market: "US",
      selectionRule: "current-complete-authorized-edition",
      selectionNote:
        "The exact English title is supported by a Library of Congress record and an independent Vintage publisher record.",
      evidence: [
        locEvidence({
          lccn: "99044063",
          title: "Ghostwritten",
          isbn10: "0679463046",
          publisher: "Random House",
          publicationYear: 2000,
        }),
        prhEvidence({
          workId: "115431",
          slug: "ghostwritten-by-david-mitchell",
          title: "Ghostwritten",
          isbn13: "9780375724503",
          publisher: "Vintage",
          publicationYear: 2001,
        }),
      ],
    }),
  },
  [number9DreamKey]: {
    recordKey: number9DreamKey,
    ruTitle: "Сон № 9",
    enTitle: "Number9Dream",
    description: {
      ru: "Накануне двадцатилетия Эйдзи Миякэ приезжает в Токио, чтобы разыскать отца, которого никогда не видел. Поиск втягивает его в городское подполье и размывает границу между явью и сновидением; путь к ответу оказывается связан с первой любовью, детскими травмами и потребностью обрести принадлежность.",
      en: "As his twentieth birthday approaches, Eiji Miyake comes to Tokyo to find the father he has never met. The search draws him into the city’s underworld and blurs the boundary between waking life and dreams; the path toward an answer becomes bound up with first love, childhood trauma, and the need to belong.",
      ruSha256:
        "5fd2ebcd553a3f5247fe7bb8d4e2d794097ef451448b0d16063c4b16a190a52a",
      sources: [hodderNumber9Dream, bookerNumber9Dream],
    },
    heldRuPublisherEvidence: heldRuPublisherEvidence[number9DreamKey],
    enTitleEvidence: localizedTitle({
      recordKey: number9DreamKey,
      locale: "en",
      value: "Number9Dream",
      market: "US",
      selectionRule: "current-complete-authorized-edition",
      selectionNote:
        "The compact US title form is supported by a Library of Congress manifestation and an independent Random House publisher record.",
      evidence: [
        locEvidence({
          lccn: "2001041910",
          title: "Number9dream",
          isbn10: "0375507264",
          publisher: "Random House",
          publicationYear: 2001,
        }),
        prhEvidence({
          workId: "115432",
          slug: "number9dream-by-david-mitchell",
          title: "Number9Dream",
          isbn13: "9780812966923",
          publisher: "Random House Trade Paperbacks",
          publicationYear: 2003,
        }),
      ],
    }),
  },
  [thousandAutumnsKey]: {
    recordKey: thousandAutumnsKey,
    ruTitle: "Тысяча осеней Якоба де Зута",
    enTitle: "The Thousand Autumns of Jacob de Zoet",
    description: {
      ru: "В 1799 году молодой голландский клерк Якоб де Зут прибывает на искусственный остров Дэдзима в гавани Нагасаки - строго контролируемую точку контакта Японии с европейцами. Его служба среди купцов, переводчиков и чиновников превращается в испытание честности, когда торговые интересы, запретные чувства и борьба за власть связывают личный выбор с конфликтом культур.",
      en: "In 1799, the young Dutch clerk Jacob de Zoet arrives on the artificial island of Dejima in Nagasaki harbor, a tightly controlled point of contact between Japan and Europeans. His service among merchants, interpreters, and officials becomes a test of integrity as commercial interests, forbidden feelings, and struggles for power tie personal choice to a clash of cultures.",
      ruSha256:
        "d537a9e800fa51e75c45053cf4b408ad68388cb6efb75c130e17bcf004f4954a",
      sources: [hodderThousandAutumns, bookerThousandAutumns],
    },
    ruTitleEvidence: localizedTitle({
      recordKey: thousandAutumnsKey,
      locale: "ru",
      value: "Тысяча осеней Якоба де Зута",
      market: "RU",
      selectionRule: "current-complete-authorized-edition",
      selectionNote:
        "Основное русское заглавие и манифестация ISBN 978-5-389-11622-1 совпадают в записи РГБ и карточке издательской группы Азбука-Аттикус.",
      evidence: [
        titleEvidence({
          manifestationId: "isbn-9785389116221",
          sourceUrl: "https://search.rsl.ru/ru/record/01009372861",
          provider: "Российская государственная библиотека",
          authorityId: "rsl",
          authorityTier: "A",
          recordKind: "national-bibliography",
          recordId: "RSL-01009372861",
          catalogTitleExact: "Тысяча осеней Якоба де Зута",
          locale: "ru",
          market: "RU",
          expressionLanguage: "ru",
          isbn13: "9785389116221",
          publisher: "Иностранка",
          publicationYear: 2017,
          translator: "Майя Лахути",
        }),
        titleEvidence({
          manifestationId: "isbn-9785389116221",
          sourceUrl:
            "https://azbooka.ru/books/tysyacha-oseney-yakoba-de-zuta-1rfa",
          provider: "Азбука-Аттикус / Иностранка",
          authorityId: "azbooka",
          authorityTier: "B",
          recordKind: "publisher-catalog",
          recordId: "ISBN-9785389116221",
          catalogTitleExact: "Тысяча осеней Якоба де Зута",
          locale: "ru",
          market: "RU",
          expressionLanguage: "ru",
          isbn13: "9785389116221",
          publisher: "Иностранка",
          publicationYear: 2017,
          translator: "Майя Лахути",
        }),
      ],
    }),
    enTitleEvidence: localizedTitle({
      recordKey: thousandAutumnsKey,
      locale: "en",
      value: "The Thousand Autumns of Jacob de Zoet",
      market: "US",
      selectionRule: "current-complete-authorized-edition",
      selectionNote:
        "The exact English title is supported by a Library of Congress manifestation and the matching Random House publisher record.",
      evidence: [
        locEvidence({
          lccn: "2011389222",
          title: "The Thousand Autumns of Jacob de Zoet",
          isbn10: "0812976363",
          isbn13: "9780812976366",
          publisher: "Random House Trade Paperbacks",
          publicationYear: 2011,
        }),
        prhEvidence({
          workId: "115434",
          slug: "the-thousand-autumns-of-jacob-de-zoet-by-david-mitchell",
          title: "The Thousand Autumns of Jacob de Zoet",
          isbn13: "9780812976366",
          publisher: "Random House Trade Paperbacks",
          publicationYear: 2011,
        }),
      ],
    }),
  },
  [boneClocksKey]: {
    recordKey: boneClocksKey,
    ruTitle: "Костяные часы",
    enTitle: "The Bone Clocks",
    description: {
      ru: "После ссоры с матерью пятнадцатилетняя Холли Сайкс уходит из дома и невольно оказывается связана с тайным противостоянием людей, чьи возможности нарушают привычные законы реальности. Роман проводит Холли через шесть десятилетий: последствия ранней встречи возвращаются в её семейной истории и в опасном будущем.",
      en: "After an argument with her mother, fifteen-year-old Holly Sykes leaves home and unwittingly becomes connected to a hidden conflict involving people whose abilities defy ordinary reality. The novel follows Holly across six decades, as the consequences of that early encounter return in her family’s history and in a dangerous future.",
      ruSha256:
        "ce4f5250f68dc5958cb61943f5fe43f1c1716eafb76beb2104be49e673adad5c",
      sources: [hodderBoneClocks, bookerBoneClocks],
    },
    heldRuPublisherEvidence: heldRuPublisherEvidence[boneClocksKey],
    enTitleEvidence: localizedTitle({
      recordKey: boneClocksKey,
      locale: "en",
      value: "The Bone Clocks",
      market: "US",
      selectionRule: "current-complete-authorized-edition",
      selectionNote:
        "The exact English title is supported by a Library of Congress record and an independent Random House publisher record.",
      evidence: [
        locEvidence({
          lccn: "2014036965",
          title: "The Bone Clocks",
          isbn13: "9781410476012",
          publisher: "Thorndike Press",
          publicationYear: 2015,
        }),
        prhEvidence({
          workId: "208717",
          slug: "the-bone-clocks-by-david-mitchell",
          title: "The Bone Clocks",
          isbn13: "9780812976823",
          publisher: "Random House Trade Paperbacks",
          publicationYear: 2015,
        }),
      ],
    }),
  },
  [sladeHouseKey]: {
    recordKey: sladeHouseKey,
    ruTitle: "Голодный дом",
    enTitle: "Slade House",
    description: {
      ru: "В неприметном переулке дверь без ручки время от времени открывает путь в дом, который не подчиняется обычному пространству. Начиная с 1979 года, каждые девять лет его обитатели заманивают нового гостя; пять связанных эпизодов постепенно раскрывают устройство ловушки и мотивы хозяев.",
      en: "In an unremarkable alley, a handleless door sometimes opens onto a house that does not obey ordinary space. Beginning in 1979, its residents lure in a new guest every nine years; five connected episodes gradually reveal how the trap works and what its owners want.",
      ruSha256:
        "61f7f44e1218b8c61bf60125b98f126f2a910cf59554f661e0b9ba1c422b9dca",
      sources: [hodderSladeHouse, mitchellOfficialSladeHouse],
    },
    heldRuPublisherEvidence: heldRuPublisherEvidence[sladeHouseKey],
    enTitleEvidence: localizedTitle({
      recordKey: sladeHouseKey,
      locale: "en",
      value: "Slade House",
      market: "US",
      selectionRule: "current-complete-authorized-edition",
      selectionNote:
        "The exact English title is supported by a Library of Congress record and an independent Random House publisher record.",
      evidence: [
        locEvidence({
          lccn: "2015019630",
          title: "Slade House",
          isbn10: "0812998685",
          isbn13: "9780812998689",
          publisher: "Random House",
          publicationYear: 2015,
        }),
        prhEvidence({
          workId: "252856",
          slug: "slade-house-by-david-mitchell",
          title: "Slade House",
          isbn13: "9780812988079",
          publisher: "Random House Trade Paperbacks",
          publicationYear: 2016,
        }),
      ],
    }),
  },
};

export const bookEvidenceV2PublicBatch03ResolvedRecordKeys = Object.freeze(
  Object.values(overlays)
    .filter((overlay) => overlay.ruTitleEvidence)
    .map((overlay) => overlay.recordKey)
);

export const bookEvidenceV2PublicBatch03RecordKeys = Object.freeze(
  Object.keys(overlays)
);

function withoutCanon(work: WorkProfile) {
  const copy = { ...work };
  delete copy.canon;
  return copy;
}

function withoutRuLocalizedTitle(
  localizedTitles: WorkProfile["localizedTitles"]
) {
  const copy = { ...(localizedTitles || {}) };
  delete copy.ru;
  return copy;
}

function translationFor(
  work: WorkProfile,
  overlay: BatchOverlay,
  locale: WorkLocale,
  verified: boolean
) {
  const existing = { ...(work.translations?.[locale] || {}) };
  delete existing.titleEvidence;
  const titleEvidenceProfile =
    locale === "ru" ? overlay.ruTitleEvidence : overlay.enTitleEvidence;
  const description = overlay.description[locale];
  const title = locale === "ru" ? overlay.ruTitle : overlay.enTitle;
  const titleUrls = titleEvidenceProfile
    ? titleEvidenceProfile.evidence.map((evidence) => evidence.sourceUrl)
    : (overlay.heldRuPublisherEvidence || []).map(
        (evidence) => evidence.sourceUrl
      );
  const descriptionUrls = overlay.description.sources.map(
    (source) => source.url
  );
  return {
    ...existing,
    locale,
    title,
    description,
    sourceLanguage: locale,
    status: verified ? ("verified" as const) : ("reviewed" as const),
    sourceUrls: [...new Set([...titleUrls, ...descriptionUrls])],
    method:
      locale === "ru"
        ? ("editorial-original" as const)
        : ("human-translation" as const),
    reviewedAt: checkedAt,
    ...(titleEvidenceProfile
      ? { titleEvidence: titleEvidenceProfile }
      : {}),
    descriptionProvenance: descriptionProvenance(locale, overlay.description),
  };
}

function applyOverlay(work: WorkProfile, overlay: BatchOverlay): WorkProfile {
  const verified = Boolean(overlay.ruTitleEvidence);
  const base = withoutCanon(work);
  const titleEvidenceSources = [
    ...(overlay.ruTitleEvidence?.evidence || []),
    ...overlay.enTitleEvidence.evidence,
    ...(overlay.heldRuPublisherEvidence || []),
  ].map(titleSource);
  const localizedTitles = overlay.ruTitleEvidence
    ? {
        ...base.localizedTitles,
        ru: overlay.ruTitleEvidence,
        en: overlay.enTitleEvidence,
      }
    : {
        ...withoutRuLocalizedTitle(base.localizedTitles),
        en: overlay.enTitleEvidence,
      };

  return {
    ...base,
    title: overlay.ruTitle,
    description: overlay.description.ru,
    translations: {
      ...base.translations,
      ru: translationFor(base, overlay, "ru", verified),
      en: translationFor(base, overlay, "en", verified),
    },
    localizedTitles,
    sources: mergeSources(base.sources || [], [
      ...titleEvidenceSources,
      ...overlay.description.sources,
    ]),
    editorial: {
      status: verified ? "verified" : "reviewed",
      reviewedAt: checkedAt,
    },
  };
}

/** Applies the batch after canonical candidate merging, including reviewed-only Works. */
export function applyBookEvidenceV2PublicBatch03Work(
  countryId: string,
  writerId: string,
  work: WorkProfile
): WorkProfile {
  const overlay = overlays[`${countryId}:${writerId}:${work.id}`];
  return overlay ? applyOverlay(work, overlay) : work;
}

/**
 * Applies this self-contained evidence batch immutably. It is deliberately not
 * wired into the shared registry or public archive by this module.
 */
export function applyBookEvidenceV2PublicBatch03(
  countries: Country[]
): Country[] {
  const seen = new Map<string, number>(
    bookEvidenceV2PublicBatch03RecordKeys.map((recordKey) => [recordKey, 0])
  );
  const result = countries.map((country) => ({
    ...country,
    writers: country.writers.map((writer) => ({
      ...writer,
      workDetails: writer.workDetails?.map((work) => {
        const recordKey = `${country.id}:${writer.id}:${work.id}`;
        const overlay = overlays[recordKey];
        if (!overlay) return work;
        seen.set(recordKey, (seen.get(recordKey) || 0) + 1);
        return applyBookEvidenceV2PublicBatch03Work(
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
      `book-evidence-v2-public-batch-03-target-cardinality:${cardinalityErrors
        .map(([recordKey, count]) => `${recordKey}=${count}`)
        .join(",")}`
    );
  }
  return result;
}
