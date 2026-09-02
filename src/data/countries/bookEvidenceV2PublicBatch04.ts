import type {
  WorkDescriptionProvenanceProfile,
  WorkLocale,
  WorkLocalizedTitleProfile,
  WorkProfile,
  WorkSourceProfile,
  WorkTitleEvidenceProfile,
} from "./types";

const checkedAt = "2026-09-02";
const checkedBy = "Probpera editorial research";

type OriginCountryId = "france" | "germany" | "norway" | "poland";
type OriginLanguage = "fr" | "de" | "no" | "pl";

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
  originCountryId: OriginCountryId;
  originLanguage: OriginLanguage;
  ru: string;
  en: string;
  ruSha256: string;
  sources: DescriptionSource[];
};

type ResolvedOverlay = {
  status: "resolved";
  recordKey: string;
  ruTitle: string;
  enTitle: string;
  description: ReviewedDescription;
  ruTitleEvidence: WorkLocalizedTitleProfile;
  enTitleEvidence: WorkLocalizedTitleProfile;
};

export type BookEvidenceV2PublicBatch04Hold = {
  recordKey: string;
  status: "fail-closed";
  code: "work-expression-scope-unresolved";
  reason: string;
  resolutionCriteria: string[];
  evidence: {
    ru: WorkTitleEvidenceProfile[];
    en: WorkTitleEvidenceProfile[];
  };
};

export type BookEvidenceV2PublicBatch04AuthorityDraft = {
  authorityId: string;
  provider: string;
  authorityCountryId:
    | "france"
    | "germany"
    | "norway"
    | "poland"
    | "england";
  independenceGroup: string;
  tier: "A" | "B";
  allowedRoles: Array<"description-fact" | "title-publisher">;
  domains: string[];
  markets: string[];
};

const lesMiserablesKey = "france:victor_hugo:les-miserables";
const madameBovaryKey = "france:flaubert:madame-bovary";
const littlePrinceKey =
  "france:saint_exupery:openlibrary-works-ol10263w";
const thibaultsKey = "france:roger_martin_du_gard:the-thibaults";
const historyOfRomeKey = "germany:theodor_mommsen:history-of-rome";
const buddenbrooksKey = "germany:thomas_mann:buddenbrooks-editorial";
const growthOfTheSoilKey = "norway:knut_hamsun:growth-of-the-soil";
const peasantsKey = "poland:wladyslaw_reymont:the-peasants";

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
  market,
  selectionNote,
  evidence,
}: {
  recordKey: string;
  locale: WorkLocale;
  value: string;
  market: "RU" | "US";
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
    selectionRule: "current-complete-authorized-edition",
    selectionNote,
    evidence,
  };
}

function descriptionSource({
  provider,
  authorityId,
  authorityTier = "B",
  country,
  language,
  recordId,
  url,
}: {
  provider: string;
  authorityId: string;
  authorityTier?: "A" | "B";
  country: OriginCountryId;
  language: OriginLanguage;
  recordId: string;
  url: string;
}): DescriptionSource {
  return {
    provider,
    authorityId,
    authorityTier,
    country,
    language,
    recordKind: "authoritative-work-page",
    recordId,
    url,
    fields: [
      "identity",
      "authorship",
      "original-title",
      "publication-year",
      "description",
    ],
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
      sourceLanguage: description.originLanguage,
      sourceCountry: description.originCountryId,
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
    sourceCountry: description.originCountryId,
    sourceUrls,
    transformations: ["style-edited"],
    translatedFromLocale: "ru",
    translatedFromSourceHash: description.ruSha256,
    rights: {
      textOrigin: "project-original",
      copiedSourceText: false,
    },
    author: "Probpera human translation",
    createdAt: checkedAt,
    reviewedBy: "Codex bilingual editorial review",
    reviewedAt: checkedAt,
  };
}

function locEvidence({
  lccn,
  title,
  isbn10,
  isbn13,
  publisher,
  publicationYear,
  translator,
}: {
  lccn: string;
  title: string;
  isbn10?: string;
  isbn13?: string;
  publisher: string;
  publicationYear: number;
  translator?: string;
}) {
  return titleEvidence({
    manifestationId: `lccn-${lccn}`,
    sourceUrl: `https://www.loc.gov/item/${lccn}/`,
    provider: "Library of Congress",
    authorityId: "loc",
    authorityTier: "A",
    recordKind: "national-bibliography",
    recordId: `LCCN-${lccn}`,
    catalogTitleExact: title,
    locale: "en",
    market: "US",
    expressionLanguage: "en",
    isbn10,
    isbn13,
    publisher,
    publicationYear,
    translator,
  });
}

function prhEvidence({
  workId,
  slug,
  title,
  isbn13,
  publisher,
  publicationYear,
  translator,
}: {
  workId: string;
  slug: string;
  title: string;
  isbn13: string;
  publisher: string;
  publicationYear: number;
  translator?: string;
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
    translator,
  });
}

const maisonsVictorHugoLesMiserables = descriptionSource({
  provider: "Maisons de Victor Hugo - Paris Musées",
  authorityId: "maisons-victor-hugo",
  country: "france",
  language: "fr",
  recordId: "DPMISERABLES-REAU-2022",
  url: "https://www.maisonsvictorhugo.paris.fr/sites/default/files/files/2022-08/dpmiserablesReau.pdf",
});
const bnfLesMiserables = descriptionSource({
  provider: "Bibliothèque nationale de France",
  authorityId: "bnf",
  authorityTier: "A",
  country: "france",
  language: "fr",
  recordId: "BNF-SALLE-OVALE-LES-MISERABLES-SALCH",
  url: "https://salleovale.bnf.fr/fr/selections-thematiques/les-miserables-salch-dapres-loeuvre-de-victor-hugo",
});
const rouenMadameBovary = descriptionSource({
  provider: "Université de Rouen - Centre Flaubert",
  authorityId: "university-rouen-flaubert",
  country: "france",
  language: "fr",
  recordId: "ROUEN-FLAUBERT-HISTORIQUE-PROJET-BOVARY",
  url: "https://flaubert.univ-rouen.fr/media/documents/Historique_du_projet_Bovary.pdf",
});
const bnfMadameBovary = descriptionSource({
  provider: "Bibliothèque nationale de France",
  authorityId: "bnf",
  authorityTier: "A",
  country: "france",
  language: "fr",
  recordId: "BNF-ESSENTIELS-CORPUS-TEXTES-THEATRE",
  url: "https://cdn.essentiels.bnf.fr/uploads/media/attachment/20221208202010000000_corpus_textes_theatre.pdf",
});
const officialLittlePrince = descriptionSource({
  provider: "Le Petit Prince - official work site",
  authorityId: "little-prince-official",
  country: "france",
  language: "fr",
  recordId: "LE-PETIT-PRINCE-OEUVRE",
  url: "https://www.lepetitprince.com/loeuvre/",
});
const bnfLittlePrince = descriptionSource({
  provider: "Bibliothèque nationale de France - CNLJ",
  authorityId: "bnf",
  authorityTier: "A",
  country: "france",
  language: "fr",
  recordId: "BNF-CNLJ-107861",
  url: "https://cnlj.bnf.fr/en/node/107861",
});
const buddenbrookhausBuddenbrooks = descriptionSource({
  provider: "Buddenbrookhaus - Lübeck Museums",
  authorityId: "buddenbrookhaus",
  country: "germany",
  language: "de",
  recordId: "BUDDENBROOKHAUS-DER-ROMAN",
  url: "https://buddenbrookhaus.de/der-roman",
});
const goetheBuddenbrooks = descriptionSource({
  provider: "Goethe-Institut",
  authorityId: "goethe-institut",
  country: "germany",
  language: "de",
  recordId: "GOETHE-TMA-SRO",
  url: "https://www.goethe.de/ins/pl/de/kul/lit/tma/sro.html",
});
const hamsunCentreGrowth = descriptionSource({
  provider: "Hamsunsenteret",
  authorityId: "hamsun-centre",
  country: "norway",
  language: "no",
  recordId: "HAMSUNSENTERET-MARKENS-GRODE",
  url: "https://www.hamsunsenteret.no/artikler/markens-grde",
});
const gyldendalGrowth = descriptionSource({
  provider: "Gyldendal Norsk Forlag",
  authorityId: "gyldendal-norway",
  country: "norway",
  language: "no",
  recordId: "ISBN-9788205558380",
  url: "https://www.gyldendal.no/skjonnlitteratur/romaner/markens-grode-9788205558380",
});
const polishNationalLibraryPeasants = descriptionSource({
  provider: "Biblioteka Narodowa",
  authorityId: "polish-national-library",
  authorityTier: "A",
  country: "poland",
  language: "pl",
  recordId: "BN-1924-NOBEL-REYMONT",
  url: "https://www.bn.org.pl/aktualnosci/703-13-listopada-1924---nobel-dla-wladyslawa-reymonta.html",
});
const culturePlPeasants = descriptionSource({
  provider: "Culture.pl - Adam Mickiewicz Institute",
  authorityId: "culture-pl",
  country: "poland",
  language: "pl",
  recordId: "CULTURE-PL-REYMONT-CHLOPI",
  url: "https://culture.pl/pl/dzielo/wladyslaw-reymont-chlopi",
});

const lesMiserablesRuEvidence = [
  titleEvidence({
    manifestationId: "neb-000199-000009-005580722",
    sourceUrl: "https://rusneb.ru/catalog/000199_000009_005580722/",
    provider: "Национальная электронная библиотека",
    authorityId: "neb",
    authorityTier: "A",
    recordKind: "national-bibliography",
    recordId: "NEB-000199_000009_005580722",
    catalogTitleExact: "Отверженные",
    locale: "ru",
    market: "RU",
    expressionLanguage: "ru",
    publisher: "Гослитиздат",
    publicationYear: 1948,
    editionStatement: "Роман в двух томах",
  }),
  titleEvidence({
    manifestationId: "isbn-9785389067875",
    sourceUrl: "https://azbooka.ru/books/otverzhennye-zc7c",
    provider: "Азбука-Аттикус / Азбука",
    authorityId: "azbooka",
    authorityTier: "B",
    recordKind: "publisher-catalog",
    recordId: "ISBN-9785389067875",
    catalogTitleExact: "Отверженные",
    locale: "ru",
    market: "RU",
    expressionLanguage: "ru",
    isbn13: "9785389067875",
    publisher: "Азбука",
    publicationYear: 2026,
  }),
];

const madameBovaryRuEvidence = [
  titleEvidence({
    manifestationId: "rsl-01002963717",
    sourceUrl: "https://search.rsl.ru/ru/record/01002963717",
    provider: "Российская государственная библиотека",
    authorityId: "rsl",
    authorityTier: "A",
    recordKind: "national-bibliography",
    recordId: "RSL-01002963717",
    catalogTitleExact: "Госпожа Бовари",
    locale: "ru",
    market: "RU",
    expressionLanguage: "ru",
    isbn10: "5170186614",
    publisher: "АСТ : Хранитель",
    publicationYear: 2006,
    translator: "Н. М. Любимов",
  }),
  titleEvidence({
    manifestationId: "isbn-9785171005870",
    sourceUrl: "https://ast.ru/book/gospozha-bovari-827028/",
    provider: "АСТ",
    authorityId: "ast",
    authorityTier: "B",
    recordKind: "publisher-catalog",
    recordId: "ISBN-9785171005870",
    catalogTitleExact: "Госпожа Бовари",
    locale: "ru",
    market: "RU",
    expressionLanguage: "ru",
    isbn13: "9785171005870",
    publisher: "АСТ",
    translator: "Николай Михайлович Любимов",
  }),
];

const littlePrinceRuEvidence = [
  titleEvidence({
    manifestationId: "neb-000199-000009-010093402",
    sourceUrl: "https://rusneb.ru/catalog/000199_000009_010093402/",
    provider: "Национальная электронная библиотека",
    authorityId: "neb",
    authorityTier: "A",
    recordKind: "national-bibliography",
    recordId: "NEB-000199_000009_010093402",
    catalogTitleExact: "Маленький принц",
    locale: "ru",
    market: "RU",
    expressionLanguage: "ru",
    isbn13: "9785699929061",
    publisher: "#эксмодетство",
    publicationYear: 2019,
    translator: "Нора Галь",
  }),
  titleEvidence({
    manifestationId: "isbn-9785699912261",
    sourceUrl: "https://eksmo.ru/book/malenkiy-prints-ITD825132/",
    provider: "Эксмо",
    authorityId: "eksmo",
    authorityTier: "B",
    recordKind: "publisher-catalog",
    recordId: "ISBN-9785699912261",
    catalogTitleExact: "Маленький принц",
    locale: "ru",
    market: "RU",
    expressionLanguage: "ru",
    isbn13: "9785699912261",
    publisher: "Эксмо",
    publicationYear: 2016,
  }),
];

const buddenbrooksRuEvidence = [
  titleEvidence({
    manifestationId: "rsl-01004928099",
    sourceUrl: "https://search.rsl.ru/ru/record/01004928099",
    provider: "Российская государственная библиотека",
    authorityId: "rsl",
    authorityTier: "A",
    recordKind: "national-bibliography",
    recordId: "RSL-01004928099",
    catalogTitleExact: "Будденброки",
    locale: "ru",
    market: "RU",
    expressionLanguage: "ru",
    isbn13: "9785170593736",
    publisher: "АСТ",
    publicationYear: 2010,
    translator: "Н. Ман",
  }),
  titleEvidence({
    manifestationId: "isbn-9785171050696",
    sourceUrl: "https://ast.ru/book/buddenbroki-831822/",
    provider: "АСТ",
    authorityId: "ast",
    authorityTier: "B",
    recordKind: "publisher-catalog",
    recordId: "ISBN-9785171050696",
    catalogTitleExact: "Будденброки",
    locale: "ru",
    market: "RU",
    expressionLanguage: "ru",
    isbn13: "9785171050696",
    publisher: "АСТ",
    translator: "Наталия Ман",
  }),
];

const growthOfTheSoilRuEvidence = [
  titleEvidence({
    manifestationId: "rsl-01009595368",
    sourceUrl: "https://search.rsl.ru/ru/record/01009595368",
    provider: "Российская государственная библиотека",
    authorityId: "rsl",
    authorityTier: "A",
    recordKind: "national-bibliography",
    recordId: "RSL-01009595368",
    catalogTitleExact: "Плоды земли",
    locale: "ru",
    market: "RU",
    expressionLanguage: "ru",
    isbn13: "9785171072933",
    publisher: "АСТ",
    publicationYear: 2018,
    translator: "Н. Федорова",
  }),
  titleEvidence({
    manifestationId: "isbn-9785171457662",
    sourceUrl: "https://ast.ru/book/plody-zemli-861832/",
    provider: "АСТ",
    authorityId: "ast",
    authorityTier: "B",
    recordKind: "publisher-catalog",
    recordId: "ISBN-9785171457662",
    catalogTitleExact: "Плоды земли",
    locale: "ru",
    market: "RU",
    expressionLanguage: "ru",
    isbn13: "9785171457662",
    publisher: "АСТ",
    translator: "Нина Николаевна Федорова",
  }),
];

const peasantsRuEvidence = [
  titleEvidence({
    manifestationId: "neb-000199-000009-005144848",
    sourceUrl: "https://rusneb.ru/catalog/000199_000009_005144848/",
    provider: "Национальная электронная библиотека",
    authorityId: "neb",
    authorityTier: "A",
    recordKind: "national-bibliography",
    recordId: "NEB-000199_000009_005144848",
    catalogTitleExact: "Мужики",
    locale: "ru",
    market: "RU",
    expressionLanguage: "ru",
    publisher: "Художественная литература",
    publicationYear: 1935,
    translator: "М. Троповская",
    editionStatement: "Том 2, части 3-4",
  }),
  titleEvidence({
    manifestationId: "rsl-01001049384",
    sourceUrl: "https://search.rsl.ru/ru/record/01001049384",
    provider: "Российская государственная библиотека",
    authorityId: "rsl",
    authorityTier: "A",
    recordKind: "national-bibliography",
    recordId: "RSL-01001049384",
    catalogTitleExact: "Мужики",
    locale: "ru",
    market: "RU",
    expressionLanguage: "ru",
    publisher: "Художественная литература",
    publicationYear: 1981,
    translator: "М. Абкина",
    editionStatement: "Том 1",
  }),
];

const thibaultsRuEvidence = [
  titleEvidence({
    manifestationId: "neb-000199-000009-007943769",
    sourceUrl: "https://rusneb.ru/catalog/000199_000009_007943769/",
    provider: "Национальная электронная библиотека",
    authorityId: "neb",
    authorityTier: "A",
    recordKind: "national-bibliography",
    recordId: "NEB-000199_000009_007943769",
    catalogTitleExact: "Семья Тибо",
    locale: "ru",
    market: "RU",
    expressionLanguage: "ru",
    publicationYear: 1987,
    editionStatement: "Том 1",
  }),
  titleEvidence({
    manifestationId: "rsl-01005121213",
    sourceUrl: "https://search.rsl.ru/ru/record/01005121213",
    provider: "Российская государственная библиотека",
    authorityId: "rsl",
    authorityTier: "A",
    recordKind: "national-bibliography",
    recordId: "RSL-01005121213",
    catalogTitleExact: "Семья Тибо",
    locale: "ru",
    market: "RU",
    expressionLanguage: "ru",
    publicationYear: 1936,
  }),
];

const thibaultsEnEvidence = [
  locEvidence({
    lccn: "26021458",
    title: "The Thibaults",
    publisher: "Boni & Liveright",
    publicationYear: 1926,
  }),
  locEvidence({
    lccn: "39027260",
    title: "The Thibaults",
    publisher: "Viking Press",
    publicationYear: 1939,
  }),
];

const historyOfRomeRuEvidence = [
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
    publicationYear: 1858,
    translator: "С. Д. Шестаков",
    editionStatement: "Многотомное издание 1858-1861 годов",
  }),
  titleEvidence({
    manifestationId: "rsl-01003909568",
    sourceUrl: "https://search.rsl.ru/ru/record/01003909568",
    provider: "Российская государственная библиотека",
    authorityId: "rsl",
    authorityTier: "A",
    recordKind: "national-bibliography",
    recordId: "RSL-01003909568",
    catalogTitleExact: "Римская история Ф. Моммсена",
    locale: "ru",
    market: "RU",
    expressionLanguage: "ru",
    publicationYear: 1887,
    translator: "В. Н. Неведомский",
  }),
  titleEvidence({
    manifestationId: "isbn-9785041679996",
    sourceUrl: "https://eksmo.ru/amp/book/istoriya-rima-ITD1265309/",
    provider: "Эксмо",
    authorityId: "eksmo",
    authorityTier: "B",
    recordKind: "publisher-catalog",
    recordId: "ISBN-9785041679996",
    catalogTitleExact: "История Рима",
    locale: "ru",
    market: "RU",
    expressionLanguage: "ru",
    isbn13: "9785041679996",
    publisher: "Эксмо",
    editionStatement: "Сокращённая версия (компендиум) Н. Д. Чечулина",
  }),
];

const historyOfRomeEnEvidence = [
  locEvidence({
    lccn: "08001455",
    title: "The History of Rome",
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
];

export const bookEvidenceV2PublicBatch04Holds = Object.freeze<
  BookEvidenceV2PublicBatch04Hold[]
>([
  {
    recordKey: thibaultsKey,
    status: "fail-closed",
    code: "work-expression-scope-unresolved",
    reason:
      "Карточка заявляет полный восьмичастный цикл Les Thibault, тогда как найденные англоязычные записи с заглавием The Thibaults описывают неполные выражения: ранний частичный перевод и издание только частей I-VI. Приравнивать их к полному циклу нельзя.",
    resolutionCriteria: [
      "Зафиксировать, представляет ли карточка весь восьмичастный цикл Les Thibault или отдельное англоязычное выражение первых шести частей.",
      "Для полного цикла установить записи англоязычных манифестаций Summer 1914 и Epilogue либо разделить Work и частичные Expressions.",
      "После определения границ получить независимые национальную и издательскую записи одного и того же полного англоязычного выражения.",
    ],
    evidence: {
      ru: thibaultsRuEvidence,
      en: thibaultsEnEvidence,
    },
  },
  {
    recordKey: historyOfRomeKey,
    status: "fail-closed",
    code: "work-expression-scope-unresolved",
    reason:
      "Текущее A History of Rome не подтверждено найденными англоязычными манифестациями, а русские записи относятся к разным заглавиям и объёмам - полным многотомным переводам и явно сокращённому компендиуму. Без границы Work/Expression выбирать единое рыночное заглавие нельзя.",
    resolutionCriteria: [
      "Определить, должна ли карточка представлять полный многотомный труд Römische Geschichte или конкретное сокращённое выражение.",
      "Для выбранного объёма связать русскую и английскую манифестации с одной и той же Work/Expression-моделью, исключив компендиум из доказательств полного труда.",
      "Только после разрешения объёма выбрать точные RU и EN заглавия по двум независимым манифестациям каждого рынка.",
    ],
    evidence: {
      ru: historyOfRomeRuEvidence,
      en: historyOfRomeEnEvidence,
    },
  },
]);

export const bookEvidenceV2PublicBatch04AuthorityDrafts = Object.freeze<
  BookEvidenceV2PublicBatch04AuthorityDraft[]
>([
  {
    authorityId: "maisons-victor-hugo",
    provider: "maisons-victor-hugo-paris-musees",
    authorityCountryId: "france",
    independenceGroup: "paris-musees-maisons-victor-hugo",
    tier: "B",
    allowedRoles: ["description-fact"],
    domains: ["maisonsvictorhugo.paris.fr"],
    markets: [],
  },
  {
    authorityId: "university-rouen-flaubert",
    provider: "university-of-rouen-centre-flaubert",
    authorityCountryId: "france",
    independenceGroup: "university-of-rouen",
    tier: "B",
    allowedRoles: ["description-fact"],
    domains: ["univ-rouen.fr"],
    markets: [],
  },
  {
    authorityId: "little-prince-official",
    provider: "le-petit-prince-official",
    authorityCountryId: "france",
    independenceGroup: "saint-exupery-estate-pomase",
    tier: "B",
    allowedRoles: ["description-fact"],
    domains: ["lepetitprince.com"],
    markets: [],
  },
  {
    authorityId: "buddenbrookhaus",
    provider: "buddenbrookhaus-luebeck-museums",
    authorityCountryId: "germany",
    independenceGroup: "luebeck-museums-buddenbrookhaus",
    tier: "B",
    allowedRoles: ["description-fact"],
    domains: ["buddenbrookhaus.de"],
    markets: [],
  },
  {
    authorityId: "goethe-institut",
    provider: "goethe-institut",
    authorityCountryId: "germany",
    independenceGroup: "goethe-institut",
    tier: "B",
    allowedRoles: ["description-fact"],
    domains: ["goethe.de"],
    markets: [],
  },
  {
    authorityId: "hamsun-centre",
    provider: "hamsun-centre",
    authorityCountryId: "norway",
    independenceGroup: "nordland-museum-hamsun-centre",
    tier: "B",
    allowedRoles: ["description-fact"],
    domains: ["hamsunsenteret.no"],
    markets: [],
  },
  {
    authorityId: "gyldendal-norway",
    provider: "gyldendal-norway",
    authorityCountryId: "norway",
    independenceGroup: "gyldendal-norway",
    tier: "B",
    allowedRoles: ["description-fact"],
    domains: ["gyldendal.no"],
    markets: [],
  },
  {
    authorityId: "polish-national-library",
    provider: "polish-national-library",
    authorityCountryId: "poland",
    independenceGroup: "polish-national-library",
    tier: "A",
    allowedRoles: ["description-fact"],
    domains: ["bn.org.pl"],
    markets: [],
  },
  {
    authorityId: "culture-pl",
    provider: "adam-mickiewicz-institute-culture-pl",
    authorityCountryId: "poland",
    independenceGroup: "adam-mickiewicz-institute",
    tier: "B",
    allowedRoles: ["description-fact"],
    domains: ["culture.pl"],
    markets: [],
  },
  {
    authorityId: "routledge",
    provider: "routledge-taylor-francis",
    authorityCountryId: "england",
    independenceGroup: "taylor-and-francis",
    tier: "B",
    allowedRoles: ["title-publisher"],
    domains: ["routledge.com"],
    markets: ["US", "GB"],
  },
]);

export const bookEvidenceV2PublicBatch04RequiredAuthorityIds = Object.freeze([
  "ast",
  "azbooka",
  "bnf",
  "buddenbrookhaus",
  "culture-pl",
  "eksmo",
  "goethe-institut",
  "gyldendal-norway",
  "hamsun-centre",
  "little-prince-official",
  "loc",
  "maisons-victor-hugo",
  "neb",
  "penguin-random-house",
  "polish-national-library",
  "routledge",
  "rsl",
  "university-rouen-flaubert",
]);

const resolvedOverlays: Record<string, ResolvedOverlay> = {
  [lesMiserablesKey]: {
    status: "resolved",
    recordKey: lesMiserablesKey,
    ruTitle: "Отверженные",
    enTitle: "Les Misérables",
    description: {
      originCountryId: "france",
      originLanguage: "fr",
      ru: "Бывший каторжник Жан Вальжан пытается начать новую жизнь после жестокого срока за кражу хлеба, но полицейский инспектор Жавер не прекращает преследование; судьба Вальжана соединяется с Фантиной, её дочерью Козеттой и парижским восстанием 1832 года. Роман связывает личное нравственное преображение с исследованием бедности, несправедливости, закона, милосердия и возможности искупления.",
      en: "Former convict Jean Valjean tries to build a new life after serving a brutal sentence for stealing bread, but police inspector Javert never abandons the pursuit; Valjean’s fate becomes entwined with Fantine, her daughter Cosette, and the Paris uprising of 1832. The novel connects individual moral transformation with an examination of poverty, injustice, law, mercy, and the possibility of redemption.",
      ruSha256:
        "c8574dd94fa4226eef55c961e718293b81faf6277bef980a01ea7007b36569ad",
      sources: [maisonsVictorHugoLesMiserables, bnfLesMiserables],
    },
    ruTitleEvidence: localizedTitle({
      recordKey: lesMiserablesKey,
      locale: "ru",
      value: "Отверженные",
      market: "RU",
      selectionNote:
        "Основное русское заглавие подтверждено полной двухтомной записью НЭБ и независимой текущей карточкой издательства «Азбука».",
      evidence: lesMiserablesRuEvidence,
    }),
    enTitleEvidence: localizedTitle({
      recordKey: lesMiserablesKey,
      locale: "en",
      value: "Les Misérables",
      market: "US",
      selectionNote:
        "The exact US-market title is supported by a Library of Congress record and an independent Modern Library publisher record.",
      evidence: [
        locEvidence({
          lccn: "2014050268",
          title: "Les Misérables",
          isbn13: "9781626864641",
          publisher: "Canterbury Classics",
          publicationYear: 2015,
        }),
        prhEvidence({
          workId: "84269",
          slug: "les-miserables-by-victor-hugo",
          title: "Les Misérables",
          isbn13: "9780679643333",
          publisher: "Modern Library",
          publicationYear: 2008,
          translator: "Julie Rose",
        }),
      ],
    }),
  },
  [madameBovaryKey]: {
    status: "resolved",
    recordKey: madameBovaryKey,
    ruTitle: "Госпожа Бовари",
    enTitle: "Madame Bovary",
    description: {
      originCountryId: "france",
      originLanguage: "fr",
      ru: "Эмма Бовари, воспитанная на романтических книгах, обнаруживает, что брак с провинциальным врачом Шарлем не соответствует её мечтам о страсти и блеске; поиски иной жизни в любви и светских иллюзиях лишь углубляют её разочарование. Флобер строит трагедию героини на столкновении литературно окрашенного желания с будничной реальностью французской провинции и показывает, как воображаемый идеал подменяет для Эммы собственный опыт.",
      en: "Raised on romantic books, Emma Bovary discovers that marriage to Charles, a provincial doctor, does not match her dreams of passion and splendour; her search for another life in love and social fantasy only deepens her disappointment. Flaubert builds his heroine’s tragedy on the collision between literary desire and the everyday reality of provincial France, showing how an imagined ideal displaces Emma’s own experience.",
      ruSha256:
        "14b68442da4a95d6c25fd80eece63f2d9a2c5a06fbfb4e353df39d18c50fc794",
      sources: [rouenMadameBovary, bnfMadameBovary],
    },
    ruTitleEvidence: localizedTitle({
      recordKey: madameBovaryKey,
      locale: "ru",
      value: "Госпожа Бовари",
      market: "RU",
      selectionNote:
        "Заглавие подтверждено отдельной записью РГБ 2006 года и независимой карточкой другого издания АСТ.",
      evidence: madameBovaryRuEvidence,
    }),
    enTitleEvidence: localizedTitle({
      recordKey: madameBovaryKey,
      locale: "en",
      value: "Madame Bovary",
      market: "US",
      selectionNote:
        "The exact US-market title is supported by a Library of Congress record and an independent Penguin Classics publisher record.",
      evidence: [
        locEvidence({
          lccn: "58001892",
          title: "Madame Bovary",
          publisher: "Modern Library",
          publicationYear: 1957,
        }),
        prhEvidence({
          workId: "286336",
          slug: "madame-bovary-by-gustave-flaubert",
          title: "Madame Bovary",
          isbn13: "9780141394671",
          publisher: "Penguin Classics",
          publicationYear: 2015,
          translator: "Geoffrey Wall",
        }),
      ],
    }),
  },
  [littlePrinceKey]: {
    status: "resolved",
    recordKey: littlePrinceKey,
    ruTitle: "Маленький принц",
    enTitle: "The Little Prince",
    description: {
      originCountryId: "france",
      originLanguage: "fr",
      ru: "Лётчик, потерпевший аварию в Сахаре, встречает мальчика с астероида B 612, который рассказывает о своей Розе, путешествии по другим планетам и встречах на Земле. Через дружбу Маленького принца с Лисом и его заботу о Розе философская сказка говорит об ответственности, привязанности и способности видеть ценность, скрытую от поверхностного взгляда.",
      en: "An aviator stranded after a crash in the Sahara meets a boy from asteroid B 612, who tells him about his Rose, his journey across other planets, and his encounters on Earth. Through the Little Prince’s friendship with the Fox and his care for the Rose, the philosophical tale explores responsibility, attachment, and the ability to perceive value hidden from a superficial gaze.",
      ruSha256:
        "c25b5a983a6242b71fa05d20b982ac92e5d3edc7121dea7884a3cd0a2c82da3f",
      sources: [officialLittlePrince, bnfLittlePrince],
    },
    ruTitleEvidence: localizedTitle({
      recordKey: littlePrinceKey,
      locale: "ru",
      value: "Маленький принц",
      market: "RU",
      selectionNote:
        "Заглавие подтверждено записью НЭБ и независимой карточкой другой манифестации издательства «Эксмо».",
      evidence: littlePrinceRuEvidence,
    }),
    enTitleEvidence: localizedTitle({
      recordKey: littlePrinceKey,
      locale: "en",
      value: "The Little Prince",
      market: "US",
      selectionNote:
        "The exact US-market title is supported by a Library of Congress record and an independent Everyman’s Library publisher record.",
      evidence: [
        locEvidence({
          lccn: "99050439",
          title: "The Little Prince",
          isbn10: "0156012197",
          publisher: "Harcourt",
          publicationYear: 2000,
          translator: "Richard Howard",
        }),
        prhEvidence({
          workId: "639583",
          slug:
            "the-little-prince-by-antoine-de-saint-exupery-translated-by-richard-howard",
          title: "The Little Prince",
          isbn13: "9781101908280",
          publisher: "Everyman’s Library",
          publicationYear: 2020,
          translator: "Richard Howard",
        }),
      ],
    }),
  },
  [buddenbrooksKey]: {
    status: "resolved",
    recordKey: buddenbrooksKey,
    ruTitle: "Будденброки",
    enTitle: "Buddenbrooks",
    description: {
      originCountryId: "germany",
      originLanguage: "de",
      ru: "Роман прослеживает судьбу четырёх поколений состоятельной любекской купеческой семьи, чьи деловые традиции и общественный авторитет постепенно утрачивают прочность. История Томаса, Тони, Кристиана и Ганно раскрывает напряжение между семейным долгом, коммерческим успехом, личным желанием и художественной чувствительностью.",
      en: "The novel follows four generations of a prosperous Lübeck merchant family as its commercial traditions and social standing gradually lose their solidity. The stories of Thomas, Tony, Christian, and Hanno reveal the tension between family duty, business success, personal desire, and artistic sensibility.",
      ruSha256:
        "fa0875f5ee0e7a880e3525d3f13ceedf65e1f18eed82916f00c63be0d9cbe1dc",
      sources: [buddenbrookhausBuddenbrooks, goetheBuddenbrooks],
    },
    ruTitleEvidence: localizedTitle({
      recordKey: buddenbrooksKey,
      locale: "ru",
      value: "Будденброки",
      market: "RU",
      selectionNote:
        "Заглавие подтверждено записью РГБ и независимой карточкой другой манифестации издательства АСТ.",
      evidence: buddenbrooksRuEvidence,
    }),
    enTitleEvidence: localizedTitle({
      recordKey: buddenbrooksKey,
      locale: "en",
      value: "Buddenbrooks",
      market: "US",
      selectionNote:
        "The exact US-market title is supported by a Library of Congress record and an independent Everyman’s Library publisher record.",
      evidence: [
        locEvidence({
          lccn: "93043499",
          title: "Buddenbrooks",
          isbn10: "0679752609",
          isbn13: "9780679752608",
          publisher: "Vintage",
          publicationYear: 1994,
          translator: "John E. Woods",
        }),
        prhEvidence({
          workId: "107272",
          slug:
            "buddenbrooks-by-thomas-mann-translated-by-john-edwards-introduction-by-t-j-reed/9780679417378",
          title: "Buddenbrooks",
          isbn13: "9780679417378",
          publisher: "Everyman’s Library",
          publicationYear: 1994,
          translator: "John E. Woods",
        }),
      ],
    }),
  },
  [growthOfTheSoilKey]: {
    status: "resolved",
    recordKey: growthOfTheSoilKey,
    ruTitle: "Плоды земли",
    enTitle: "Growth of the Soil",
    description: {
      originCountryId: "norway",
      originLanguage: "no",
      ru: "Исак приходит на необжитую землю в северной Норвегии, расчищает её и вместе с Ингер превращает примитивное жилище в хозяйство Селланро, вокруг которого со временем возникает поселение. Развитие фермы и вторжение новых технологий позволяют роману сопоставить созидательный труд и укоренённость с изменениями, которые несут городская жизнь, промышленность и модернизация.",
      en: "Isak comes to unsettled land in northern Norway, clears it, and with Inger transforms a primitive dwelling into the farm of Sellanraa, around which a settlement gradually emerges. The farm’s growth and the arrival of new technologies allow the novel to contrast creative labour and rootedness with the changes brought by urban life, industry, and modernisation.",
      ruSha256:
        "1d614a45f4483433505e0521c67cce7745730ce42006bd73704f09682a471f14",
      sources: [hamsunCentreGrowth, gyldendalGrowth],
    },
    ruTitleEvidence: localizedTitle({
      recordKey: growthOfTheSoilKey,
      locale: "ru",
      value: "Плоды земли",
      market: "RU",
      selectionNote:
        "«Плоды земли» подтверждено записью РГБ и независимой карточкой другой манифестации АСТ; прежнее «Соки земли» не используется как рыночное заглавие карточки.",
      evidence: growthOfTheSoilRuEvidence,
    }),
    enTitleEvidence: localizedTitle({
      recordKey: growthOfTheSoilKey,
      locale: "en",
      value: "Growth of the Soil",
      market: "US",
      selectionNote:
        "The exact US-market title is supported by a Library of Congress record and an independent Penguin Classics publisher record.",
      evidence: [
        locEvidence({
          lccn: "21003287",
          title: "Growth of the Soil",
          publisher: "A. A. Knopf",
          publicationYear: 1921,
          translator: "W. W. Worster",
        }),
        prhEvidence({
          workId: "294436",
          slug: "growth-of-the-soil-by-knut-hamsun",
          title: "Growth of the Soil",
          isbn13: "9780143105107",
          publisher: "Penguin Classics",
          publicationYear: 2007,
          translator: "Sverre Lyngstad",
        }),
      ],
    }),
  },
  [peasantsKey]: {
    status: "resolved",
    recordKey: peasantsKey,
    ruTitle: "Мужики",
    enTitle: "The Peasants",
    description: {
      originCountryId: "poland",
      originLanguage: "pl",
      ru: "Действие четырёхчастного романа охватывает смену времён года в деревне Липце и сосредоточено на семье Борынов: женитьба состоятельного Мацея Борыны на молодой Ягне обостряет его конфликт с сыном Антеком и втягивает всю общину. Через сельские труды, праздники, обряды и коллективные решения Реймонт показывает, как земля, природный цикл и власть деревенского сообщества определяют частные судьбы.",
      en: "Set across the changing seasons in the village of Lipce, the four-part novel centres on the Boryna family: wealthy Maciej Boryna’s marriage to the young Jagna intensifies his conflict with his son Antek and draws in the entire community. Through farm work, festivals, rituals, and collective decisions, Reymont shows how land, the natural cycle, and the authority of the village shape individual destinies.",
      ruSha256:
        "4d4f3296617956536f41b3b0013f917a82d5438bd55d8f1853ddcbc0a79dda63",
      sources: [polishNationalLibraryPeasants, culturePlPeasants],
    },
    ruTitleEvidence: localizedTitle({
      recordKey: peasantsKey,
      locale: "ru",
      value: "Мужики",
      market: "RU",
      selectionNote:
        "Основное заглавие цикла подтверждено двумя независимыми национальными библиотечными записями разных русских манифестаций и томов.",
      evidence: peasantsRuEvidence,
    }),
    enTitleEvidence: localizedTitle({
      recordKey: peasantsKey,
      locale: "en",
      value: "The Peasants",
      market: "US",
      selectionNote:
        "The exact US-market title is supported by a Library of Congress four-volume record and an independent Penguin Classics publisher record.",
      evidence: [
        locEvidence({
          lccn: "24028889",
          title: "The Peasants",
          publisher: "Alfred A. Knopf",
          publicationYear: 1924,
          translator: "Michael Henry Dziewicki",
        }),
        prhEvidence({
          workId: "780705",
          slug:
            "the-peasants-by-wladyslaw-reymont-translated-by-anna-zaranko-introduction-by-ryszard-koziolek",
          title: "The Peasants",
          isbn13: "9780241524244",
          publisher: "Penguin Classics",
          publicationYear: 2025,
          translator: "Anna Zaranko",
        }),
      ],
    }),
  },
};

export const bookEvidenceV2PublicBatch04ResolvedRecordKeys = Object.freeze(
  Object.keys(resolvedOverlays)
);

export const bookEvidenceV2PublicBatch04RecordKeys = Object.freeze([
  ...bookEvidenceV2PublicBatch04ResolvedRecordKeys,
  ...bookEvidenceV2PublicBatch04Holds.map((hold) => hold.recordKey),
]);

const holdByRecordKey = new Map(
  bookEvidenceV2PublicBatch04Holds.map((hold) => [hold.recordKey, hold])
);

function withoutCanon(work: WorkProfile) {
  const copy = { ...work };
  delete copy.canon;
  return copy;
}

function withoutLocalizedTitleEvidence(
  localizedTitles: WorkProfile["localizedTitles"]
) {
  const copy = { ...(localizedTitles || {}) };
  delete copy.ru;
  delete copy.en;
  return copy;
}

function resolvedTranslation(
  work: WorkProfile,
  overlay: ResolvedOverlay,
  locale: WorkLocale
) {
  const existing = { ...(work.translations?.[locale] || {}) };
  const titleProfile =
    locale === "ru" ? overlay.ruTitleEvidence : overlay.enTitleEvidence;
  const title = locale === "ru" ? overlay.ruTitle : overlay.enTitle;
  const description = overlay.description[locale];
  return {
    ...existing,
    locale,
    title,
    description,
    sourceLanguage: "ru",
    status: "verified" as const,
    sourceUrls: [
      ...new Set([
        ...titleProfile.evidence.map((evidence) => evidence.sourceUrl),
        ...overlay.description.sources.map((source) => source.url),
      ]),
    ],
    method:
      locale === "ru"
        ? ("editorial-original" as const)
        : ("human-translation" as const),
    reviewedAt: checkedAt,
    titleEvidence: titleProfile,
    descriptionProvenance: descriptionProvenance(locale, overlay.description),
  };
}

function applyResolvedOverlay(
  work: WorkProfile,
  overlay: ResolvedOverlay
): WorkProfile {
  const base = withoutCanon(work);
  const titleEvidenceSources = [
    ...overlay.ruTitleEvidence.evidence,
    ...overlay.enTitleEvidence.evidence,
  ].map(titleSource);
  return {
    ...base,
    title: overlay.ruTitle,
    description: overlay.description.ru,
    translations: {
      ...base.translations,
      ru: resolvedTranslation(base, overlay, "ru"),
      en: resolvedTranslation(base, overlay, "en"),
    },
    localizedTitles: {
      ...base.localizedTitles,
      ru: overlay.ruTitleEvidence,
      en: overlay.enTitleEvidence,
    },
    sources: mergeSources(base.sources || [], [
      ...titleEvidenceSources,
      ...overlay.description.sources,
    ]),
    editorial: {
      status: "verified",
      reviewedAt: checkedAt,
    },
  };
}

function stripTranslationTitleEvidence(
  translation: NonNullable<WorkProfile["translations"]>[WorkLocale]
) {
  if (!translation) return undefined;
  const copy = { ...translation, status: "reviewed" as const };
  delete copy.titleEvidence;
  return copy;
}

function applyHold(work: WorkProfile, hold: BookEvidenceV2PublicBatch04Hold) {
  const base = withoutCanon(work);
  const translations = { ...(base.translations || {}) };
  const ru = stripTranslationTitleEvidence(translations.ru);
  const en = stripTranslationTitleEvidence(translations.en);
  if (ru) translations.ru = ru;
  if (en) translations.en = en;
  return {
    ...base,
    translations,
    localizedTitles: withoutLocalizedTitleEvidence(base.localizedTitles),
    sources: mergeSources(
      base.sources || [],
      [...hold.evidence.ru, ...hold.evidence.en].map(titleSource)
    ),
    editorial: {
      status: "reviewed" as const,
      reviewedAt: checkedAt,
    },
  };
}

/**
 * Applies this reviewed-only batch after canonical Work merging. The function
 * intentionally emits no canon signal and does not mutate the shared registry.
 */
export function applyBookEvidenceV2PublicBatch04Work(
  countryId: string,
  writerId: string,
  work: WorkProfile
): WorkProfile {
  const recordKey = `${countryId}:${writerId}:${work.id}`;
  const overlay = resolvedOverlays[recordKey];
  if (overlay) return applyResolvedOverlay(work, overlay);
  const hold = holdByRecordKey.get(recordKey);
  return hold ? applyHold(work, hold) : work;
}

/** Backward-compatible short alias for direct Work-level tests and tooling. */
export const applyBookEvidenceV2PublicBatch04 =
  applyBookEvidenceV2PublicBatch04Work;
