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
  heldRuEvidence?: WorkTitleEvidenceProfile[];
};

type AuthorityRole = "title-publisher" | "description-fact";

export type BookEvidenceV2PublicBatch02AuthorityDraft = {
  authorityId: string;
  provider: string;
  authorityCountryId: "england" | "russia" | "usa";
  independenceGroup: string;
  tier: "B";
  allowedRoles: AuthorityRole[];
  domains: string[];
  markets: string[];
};

export type BookEvidenceV2PublicBatch02Hold = {
  recordKey: string;
  status: "fail-closed";
  locale: "ru";
  code: "ru-title-orthography-conflict";
  candidateTitles: readonly ["Анна-Вероника", "Анна Вероника"];
  reason: string;
  resolutionCriteria: string[];
  manifestationEvidence: WorkTitleEvidenceProfile[];
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
}: {
  provider: string;
  authorityId: string;
  authorityTier?: "A" | "B";
  recordId: string;
  url: string;
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

const foodKey = "england:h_g_wells:the-food-of-the-gods";
const worldSetFreeKey = "england:h_g_wells:the-world-set-free";
const menLikeGodsKey = "england:h_g_wells:men-like-gods";
const annVeronicaKey = "england:h_g_wells:ann-veronica";
const mrPollyKey = "england:h_g_wells:the-history-of-mr-polly";
const braveNewWorldKey =
  "england:aldous_huxley:brave-new-world-editorial";
const lordOfTheRingsKey =
  "england:j_r_r_tolkien:openlibrary-works-ol27448w";
const hobbitKey = "england:j_r_r_tolkien:the-hobbit";

const orionWells = descriptionSource({
  provider: "Orion Books",
  authorityId: "orion-books",
  recordId: "contributor-h-g-wells",
  url: "https://www.orionbooks.co.uk/contributor/h-g-wells/",
});
const orionFood = descriptionSource({
  provider: "Orion Books",
  authorityId: "orion-books",
  recordId: "ISBN-9781473218017",
  url: "https://www.orionbooks.co.uk/titles/h-g-wells/the-food-of-the-gods/9781473218017/",
});
const cambridgeFood = descriptionSource({
  provider: "Cambridge University Press",
  authorityId: "cambridge-university-press",
  recordId: "DOI-10.1017-CHOL9780521846257.024",
  url: "https://www.cambridge.org/core/books/cambridge-history-of-victorian-literature/science-and-literature/FC886E5A7D36603F1BACCCDF81F24063",
});
const cambridgeWorldState = descriptionSource({
  provider: "Cambridge University Press",
  authorityId: "cambridge-university-press",
  recordId: "DOI-10.2307-2008885",
  url: "https://www.cambridge.org/core/journals/world-politics/article/abs/h-g-wells-british-patriot-in-search-of-a-world-state/8853FBEF94E2968D9E3CD62D09B3E328",
});
const manchesterWellsFutures = descriptionSource({
  provider: "The University of Manchester",
  authorityId: "university-of-manchester",
  recordId: "h-g-wells-earthly-and-post-terrestrial-futures",
  url: "https://research.manchester.ac.uk/en/publications/hg-wells-earthly-and-post-terrestrial-futures/",
});
const cambridgeEdwardianWells = descriptionSource({
  provider: "Cambridge University Press",
  authorityId: "cambridge-university-press",
  recordId: "DOI-10.1017-CBO9780511553646.004",
  url: "https://www.cambridge.org/core/books/abs/h-g-wells/edwardian-achievement-ii-tonobungay-ann-veronica-the-history-of-mr-polly/D5B6D76B6178CF9940A54BA0E9822D7A",
});
const penguinMrPolly = descriptionSource({
  provider: "Penguin Books UK",
  authorityId: "penguin-uk",
  recordId: "ISBN-9780141441078",
  url: "https://www.penguin.co.uk/books/60364/the-history-of-mr-polly-by-wells-hg/9780141441078",
});
const penguinBraveNewWorld = descriptionSource({
  provider: "Penguin Books UK",
  authorityId: "penguin-uk",
  recordId: "ISBN-9780099518471",
  url: "https://www.penguin.co.uk/books/357838/brave-new-world-by-huxley-aldous/9780099518471",
});
const cambridgeBraveNewWorld = descriptionSource({
  provider: "Cambridge University Press",
  authorityId: "cambridge-university-press",
  recordId: "DOI-10.1017-9781009263504.009",
  url: "https://www.cambridge.org/core/books/literature-science-and-public-policy/modern-synthesis/2AC5D7DB999F1C671A29CEA753E29F6C",
});
const tolkienEstateLordOfTheRings = descriptionSource({
  provider: "The Tolkien Estate",
  authorityId: "tolkien-estate",
  recordId: "writing-the-lord-of-the-rings",
  url: "https://www.tolkienestate.com/writing/the-lord-of-the-rings/",
});
const oxfordLordOfTheRings = descriptionSource({
  provider: "University of Oxford",
  authorityId: "university-of-oxford",
  recordId: "english-faculty-lord-of-the-rings-teaching-pack",
  url: "https://media.podcasts.ox.ac.uk/engfac/fantasy_lit/LordoftheRingsTeachingPack.pdf",
});
const tolkienEstateHobbit = descriptionSource({
  provider: "The Tolkien Estate",
  authorityId: "tolkien-estate",
  recordId: "john-d-rateliff-the-hobbit",
  url: "https://www.tolkienestate.com/writing/john-d-rateliff-the-hobbit/",
});
const collinsHobbit = descriptionSource({
  provider: "Collins / HarperCollins Publishers Ltd",
  authorityId: "harpercollins-uk",
  recordId: "ISBN-9780007458424",
  url: "https://collins.co.uk/products/9780007458424",
});

const rslAnnVeronica = titleEvidence({
  manifestationId: "rsl-01005609943-volume-9-ann-veronica",
  sourceUrl: "https://search.rsl.ru/ru/record/01005609943",
  provider: "Российская государственная библиотека",
  authorityId: "rsl",
  authorityTier: "A",
  recordKind: "national-bibliography",
  recordId: "RSL-01005609943:volume-9:ann-veronica",
  catalogTitleExact: "Анна-Вероника",
  locale: "ru",
  market: "RU",
  expressionLanguage: "ru",
  publisher: "Правда",
  publicationYear: 1964,
});
const rugramAnnVeronica = titleEvidence({
  manifestationId: "rugram-9785521082353-ann-veronica",
  sourceUrl:
    "https://rugram-shop.ru/publisher/56778-t8-rugram/?%3FPAGEN_1=118&CODE=t8-rugram&ID=56778&PAGEN_1=171",
  provider: "T8 RUGRAM",
  authorityId: "rugram-t8",
  authorityTier: "B",
  recordKind: "publisher-catalog",
  recordId: "T8-RUGRAM-ANN-VERONICA-A-MODERN-LOVE-STORY",
  catalogTitleExact: "Анна Вероника",
  locale: "ru",
  market: "RU",
  expressionLanguage: "ru",
  publisher: "T8 RUGRAM",
});

export const bookEvidenceV2PublicBatch02Holds = Object.freeze<
  BookEvidenceV2PublicBatch02Hold[]
>([
  {
    recordKey: annVeronicaKey,
    status: "fail-closed",
    locale: "ru",
    code: "ru-title-orthography-conflict",
    candidateTitles: ["Анна-Вероника", "Анна Вероника"],
    reason:
      "Запись РГБ фиксирует заглавие «Анна-Вероника», а официальный каталог T8 RUGRAM - «Анна Вероника». Дефис является частью точной издательской формы; автоматически приравнивать эти две манифестации нельзя.",
    resolutionCriteria: [
      "Найти независимую официальную карточку российского издателя с точным заглавием «Анна-Вероника» и сопоставимыми ISBN, годом, языком и переводчиком с национальной записью РГБ; либо найти прямую запись РГБ, РНБ или НЭБ для манифестации T8 RUGRAM с точным заглавием «Анна Вероника».",
      "Проверить заглавие по самой библиографической записи или титульному листу манифестации, не по поисковому сниппету и не путём нормализации пунктуации.",
      "Только после совпадения двух независимых записей, включая Tier A, выбрать одну published-form и добавить RU verified-published evidence.",
    ],
    manifestationEvidence: [rslAnnVeronica, rugramAnnVeronica],
  },
]);

export const bookEvidenceV2PublicBatch02AuthorityDrafts = Object.freeze<
  BookEvidenceV2PublicBatch02AuthorityDraft[]
>([
  {
    authorityId: "yurait",
    provider: "yurait-publishing",
    authorityCountryId: "russia",
    independenceGroup: "yurait-publishing",
    tier: "B",
    allowedRoles: ["title-publisher"],
    domains: ["urait.ru"],
    markets: ["RU"],
  },
  {
    authorityId: "rugram-t8",
    provider: "t8-rugram-publishing",
    authorityCountryId: "russia",
    independenceGroup: "t8-rugram-publishing",
    tier: "B",
    allowedRoles: ["title-publisher"],
    domains: ["rugram-shop.ru"],
    markets: ["RU"],
  },
  {
    authorityId: "project-gutenberg",
    provider: "project-gutenberg",
    authorityCountryId: "usa",
    independenceGroup: "project-gutenberg",
    tier: "B",
    allowedRoles: ["title-publisher"],
    domains: ["gutenberg.org"],
    markets: ["US"],
  },
  {
    authorityId: "standard-ebooks",
    provider: "standard-ebooks",
    authorityCountryId: "usa",
    independenceGroup: "standard-ebooks",
    tier: "B",
    allowedRoles: ["title-publisher"],
    domains: ["standardebooks.org"],
    markets: ["US"],
  },
  {
    authorityId: "mit-press",
    provider: "mit-press",
    authorityCountryId: "usa",
    independenceGroup: "mit-press",
    tier: "B",
    allowedRoles: ["title-publisher"],
    domains: ["mitpress.mit.edu"],
    markets: ["US"],
  },
  {
    authorityId: "dover-publications",
    provider: "dover-publications",
    authorityCountryId: "usa",
    independenceGroup: "dover-publications",
    tier: "B",
    allowedRoles: ["title-publisher"],
    domains: ["doverpublications.com"],
    markets: ["US"],
  },
  {
    authorityId: "harpercollins-us",
    provider: "harpercollins-us",
    authorityCountryId: "usa",
    independenceGroup: "harpercollins-publishing-group",
    tier: "B",
    allowedRoles: ["title-publisher"],
    domains: ["harperacademic.com", "harpercollins.com"],
    markets: ["US"],
  },
  {
    authorityId: "orion-books",
    provider: "orion-books-hachette-uk",
    authorityCountryId: "england",
    independenceGroup: "hachette-uk-publishing-group",
    tier: "B",
    allowedRoles: ["title-publisher", "description-fact"],
    domains: ["orionbooks.co.uk"],
    markets: ["GB"],
  },
  {
    authorityId: "cambridge-university-press",
    provider: "cambridge-university-press",
    authorityCountryId: "england",
    independenceGroup: "cambridge-university-press",
    tier: "B",
    allowedRoles: ["description-fact"],
    domains: ["cambridge.org"],
    markets: [],
  },
  {
    authorityId: "university-of-manchester",
    provider: "university-of-manchester",
    authorityCountryId: "england",
    independenceGroup: "university-of-manchester",
    tier: "B",
    allowedRoles: ["description-fact"],
    domains: ["manchester.ac.uk"],
    markets: [],
  },
  {
    authorityId: "university-of-oxford",
    provider: "university-of-oxford",
    authorityCountryId: "england",
    independenceGroup: "university-of-oxford",
    tier: "B",
    allowedRoles: ["description-fact"],
    domains: ["ox.ac.uk"],
    markets: [],
  },
  {
    authorityId: "tolkien-estate",
    provider: "tolkien-estate",
    authorityCountryId: "england",
    independenceGroup: "tolkien-estate",
    tier: "B",
    allowedRoles: ["description-fact"],
    domains: ["tolkienestate.com"],
    markets: [],
  },
  {
    authorityId: "harpercollins-uk",
    provider: "harpercollins-uk",
    authorityCountryId: "england",
    independenceGroup: "harpercollins-publishing-group",
    tier: "B",
    allowedRoles: ["description-fact"],
    domains: ["collins.co.uk", "harpercollins.co.uk"],
    markets: [],
  },
]);

export const bookEvidenceV2PublicBatch02RequiredAuthorityIds = Object.freeze([
  "ast",
  "british-library",
  "cambridge-university-press",
  "dover-publications",
  "harpercollins-uk",
  "harpercollins-us",
  "loc",
  "mit-press",
  "orion-books",
  "penguin-random-house",
  "penguin-uk",
  "project-gutenberg",
  "rsl",
  "rugram-t8",
  "standard-ebooks",
  "tolkien-estate",
  "university-of-manchester",
  "university-of-oxford",
  "yurait",
]);

const overlays: Record<string, BatchOverlay> = {
  [foodKey]: {
    recordKey: foodKey,
    ruTitle: "Пища богов",
    enTitle: "The Food of the Gods and How It Came to Earth",
    description: {
      ru: "Двое учёных создают пищевую добавку, которая ускоряет рост растений, животных и людей, однако вещество выходит за пределы эксперимента и нарушает привычный порядок. История поколения великанов превращает научную гипотезу в сатиру о безответственном вмешательстве и страхе общества перед новым масштабом жизни.",
      en: "Two scientists create a food additive that accelerates the growth of plants, animals, and people, but the substance escapes the bounds of the experiment and disrupts the established order. The story of a generation of giants turns a scientific hypothesis into a satire on irresponsible intervention and society's fear of a new scale of life.",
      ruSha256:
        "e225d9e844ea1d95f768717a41aa39848b806f653b5a01070601b3d9c8d76829",
      sources: [orionFood, cambridgeFood],
    },
    ruTitleEvidence: localizedTitle({
      recordKey: foodKey,
      locale: "ru",
      value: "Пища богов",
      market: "RU",
      selectionRule: "current-complete-authorized-edition",
      selectionNote:
        "Точное заглавие подтверждено записью тома 3 собрания сочинений в РГБ и отдельной официальной карточкой издания АСТ.",
      evidence: [
        titleEvidence({
          manifestationId: "rsl-01005609943-volume-3-food-of-the-gods",
          sourceUrl: "https://search.rsl.ru/ru/record/01005609943",
          provider: "Российская государственная библиотека",
          authorityId: "rsl",
          authorityTier: "A",
          recordKind: "national-bibliography",
          recordId: "RSL-01005609943:volume-3:food-of-the-gods",
          catalogTitleExact: "Пища богов",
          locale: "ru",
          market: "RU",
          expressionLanguage: "ru",
          publisher: "Правда",
          publicationYear: 1964,
        }),
        titleEvidence({
          manifestationId: "isbn-9785170599684",
          sourceUrl: "https://ast.ru/book/pishcha-bogov-031876/",
          provider: "Издательство АСТ",
          authorityId: "ast",
          authorityTier: "B",
          recordKind: "publisher-catalog",
          recordId: "ISBN-9785170599684",
          catalogTitleExact: "Пища богов",
          locale: "ru",
          market: "RU",
          expressionLanguage: "ru",
          isbn13: "9785170599684",
          publisher: "АСТ",
        }),
      ],
    }),
    enTitleEvidence: localizedTitle({
      recordKey: foodKey,
      locale: "en",
      value: "The Food of the Gods and How It Came to Earth",
      market: "US",
      selectionRule: "current-complete-authorized-edition",
      selectionNote:
        "The unabbreviated title is recorded independently by the Library of Congress NLS catalogue and Project Gutenberg's published e-book record.",
      evidence: [
        titleEvidence({
          manifestationId: "loc-nls-db09589",
          sourceUrl:
            "https://www.loc.gov/nls/new-materials/collections-connections/april-2025-collections-connections/",
          provider: "Library of Congress, National Library Service",
          authorityId: "loc",
          authorityTier: "A",
          recordKind: "national-bibliography",
          recordId: "NLS-DB09589",
          catalogTitleExact:
            "The Food of the Gods and How It Came to Earth",
          locale: "en",
          market: "US",
          expressionLanguage: "en",
        }),
        titleEvidence({
          manifestationId: "project-gutenberg-ebook-11696",
          sourceUrl: "https://www.gutenberg.org/ebooks/11696",
          provider: "Project Gutenberg",
          authorityId: "project-gutenberg",
          authorityTier: "B",
          recordKind: "publisher-catalog",
          recordId: "PG-EBOOK-11696",
          catalogTitleExact:
            "The Food of the Gods and How It Came to Earth",
          locale: "en",
          market: "US",
          expressionLanguage: "en",
          publisher: "Project Gutenberg",
          publicationYear: 2004,
        }),
      ],
    }),
  },
  [worldSetFreeKey]: {
    recordKey: worldSetFreeKey,
    ruTitle: "Освобожденный мир",
    enTitle: "The World Set Free",
    description: {
      ru: "Высвобождение атомной энергии сначала обещает человечеству изобилие, а затем приводит к мировой войне с долго действующими атомными бомбами и разрушением городов. Пережитая катастрофа вынуждает государства отказаться от части суверенитета ради мирового управления, связывая технический прогресс с вопросом о том, кто способен удержать его разрушительную силу.",
      en: "The release of atomic energy first promises abundance to humanity and then leads to a world war fought with long-lasting atomic bombs that destroy cities. The catastrophe forces states to surrender part of their sovereignty to a world government, linking technological progress to the question of who can restrain its destructive power.",
      ruSha256:
        "6cd95d23d33d420b7dc82a185724ea150d55efb51f563966e7ff6af3e2a784dc",
      sources: [orionWells, cambridgeWorldState],
    },
    ruTitleEvidence: localizedTitle({
      recordKey: worldSetFreeKey,
      locale: "ru",
      value: "Освобожденный мир",
      market: "RU",
      selectionRule: "current-complete-authorized-edition",
      selectionNote:
        "Форма без «ё» дословно совпадает в записи тома 4 РГБ и в официальной карточке современного издания АСТ; редакционная нормализация не применялась.",
      evidence: [
        titleEvidence({
          manifestationId: "rsl-01005609943-volume-4-world-set-free",
          sourceUrl: "https://search.rsl.ru/ru/record/01005609943",
          provider: "Российская государственная библиотека",
          authorityId: "rsl",
          authorityTier: "A",
          recordKind: "national-bibliography",
          recordId: "RSL-01005609943:volume-4:world-set-free",
          catalogTitleExact: "Освобожденный мир",
          locale: "ru",
          market: "RU",
          expressionLanguage: "ru",
          publisher: "Правда",
          publicationYear: 1964,
        }),
        titleEvidence({
          manifestationId: "isbn-9785171544805",
          sourceUrl:
            "https://ast.ru/book/osvobozhdennyy-mir-870934/",
          provider: "Издательство АСТ",
          authorityId: "ast",
          authorityTier: "B",
          recordKind: "publisher-catalog",
          recordId: "ISBN-9785171544805",
          catalogTitleExact: "Освобожденный мир",
          locale: "ru",
          market: "RU",
          expressionLanguage: "ru",
          isbn13: "9785171544805",
          publisher: "АСТ",
          translator: "Татьяна Озерская",
        }),
      ],
    }),
    enTitleEvidence: localizedTitle({
      recordKey: worldSetFreeKey,
      locale: "en",
      value: "The World Set Free",
      market: "US",
      selectionRule: "current-complete-authorized-edition",
      selectionNote:
        "The Library of Congress record and the matching MIT Press manifestation independently carry the same title and ISBN-linked edition identity.",
      evidence: [
        titleEvidence({
          manifestationId: "isbn-9780262543361-loc",
          sourceUrl: "https://lccn.loc.gov/2021010586",
          provider: "Library of Congress",
          authorityId: "loc",
          authorityTier: "A",
          recordKind: "national-bibliography",
          recordId: "LCCN-2021010586",
          catalogTitleExact: "The World Set Free",
          locale: "en",
          market: "US",
          expressionLanguage: "en",
          isbn13: "9780262543361",
          publisher: "MIT Press",
          publicationYear: 2022,
        }),
        titleEvidence({
          manifestationId: "isbn-9780262543361-mit-press",
          sourceUrl:
            "https://mitpress.mit.edu/9780262543361/the-world-set-free/",
          provider: "MIT Press",
          authorityId: "mit-press",
          authorityTier: "B",
          recordKind: "publisher-catalog",
          recordId: "ISBN-9780262543361",
          catalogTitleExact: "The World Set Free",
          locale: "en",
          market: "US",
          expressionLanguage: "en",
          isbn13: "9780262543361",
          publisher: "MIT Press",
          publicationYear: 2022,
        }),
      ],
    }),
  },
  [menLikeGodsKey]: {
    recordKey: menLikeGodsKey,
    ruTitle: "Люди как боги",
    enTitle: "Men Like Gods",
    description: {
      ru: "Журналист мистер Барнстейпл и несколько случайных спутников переносятся в параллельную Утопию, где наука и общество развивались без привычных земных институтов. Столкновение с прибывшими людьми раскрывает не только устройство этого мира, но и стремление землян подчинить непохожую цивилизацию собственной политической воле.",
      en: "The journalist Mr. Barnstaple and several accidental companions are transported to the parallel world of Utopia, where science and society have developed without familiar earthly institutions. Their arrival reveals not only how this world works but also the Earthlings' urge to subject a different civilization to their own political will.",
      ruSha256:
        "956056f1ea6ee1973936eb26160681b13ae1b767e282da7e3747e29242d736ed",
      sources: [orionWells, manchesterWellsFutures],
    },
    ruTitleEvidence: localizedTitle({
      recordKey: menLikeGodsKey,
      locale: "ru",
      value: "Люди как боги",
      market: "RU",
      selectionRule: "current-complete-authorized-edition",
      selectionNote:
        "Заглавие совпадает в национальной записи тома 5 и в независимой ISBN-карточке АСТ.",
      evidence: [
        titleEvidence({
          manifestationId: "rsl-01005609943-volume-5-men-like-gods",
          sourceUrl: "https://search.rsl.ru/ru/record/01005609943",
          provider: "Российская государственная библиотека",
          authorityId: "rsl",
          authorityTier: "A",
          recordKind: "national-bibliography",
          recordId: "RSL-01005609943:volume-5:men-like-gods",
          catalogTitleExact: "Люди как боги",
          locale: "ru",
          market: "RU",
          expressionLanguage: "ru",
          publisher: "Правда",
          publicationYear: 1964,
        }),
        titleEvidence({
          manifestationId: "isbn-9785171577506",
          sourceUrl: "https://ast.ru/book/lyudi-kak-bogi-874380/",
          provider: "Издательство АСТ",
          authorityId: "ast",
          authorityTier: "B",
          recordKind: "publisher-catalog",
          recordId: "ISBN-9785171577506",
          catalogTitleExact: "Люди как боги",
          locale: "ru",
          market: "RU",
          expressionLanguage: "ru",
          isbn13: "9785171577506",
          publisher: "АСТ",
          translator: "Сергей Рюмин",
        }),
      ],
    }),
    enTitleEvidence: localizedTitle({
      recordKey: menLikeGodsKey,
      locale: "en",
      value: "Men Like Gods",
      market: "US",
      selectionRule: "current-complete-authorized-edition",
      selectionNote:
        "The Library of Congress and Dover records independently identify the same 2016 manifestation and exact title.",
      evidence: [
        titleEvidence({
          manifestationId: "isbn-9780486808369-loc",
          sourceUrl: "https://lccn.loc.gov/2016018746",
          provider: "Library of Congress",
          authorityId: "loc",
          authorityTier: "A",
          recordKind: "national-bibliography",
          recordId: "LCCN-2016018746",
          catalogTitleExact: "Men Like Gods",
          locale: "en",
          market: "US",
          expressionLanguage: "en",
          isbn13: "9780486808369",
          publisher: "Dover Publications",
          publicationYear: 2016,
        }),
        titleEvidence({
          manifestationId: "isbn-9780486808369-dover",
          sourceUrl:
            "https://www.doverpublications.com/retailers/pdfs/2022/DoverThriftFictionBacklist2022.pdf",
          provider: "Dover Publications",
          authorityId: "dover-publications",
          authorityTier: "B",
          recordKind: "publisher-catalog",
          recordId: "ISBN-9780486808369",
          catalogTitleExact: "Men Like Gods",
          locale: "en",
          market: "US",
          expressionLanguage: "en",
          isbn13: "9780486808369",
          publisher: "Dover Publications",
          publicationYear: 2016,
        }),
      ],
    }),
  },
  [annVeronicaKey]: {
    recordKey: annVeronicaKey,
    ruTitle: "Анна-Вероника",
    enTitle: "Ann Veronica",
    description: {
      ru: "Анна Вероника Стэнли покидает отцовский дом и переезжает в Лондон, решив самостоятельно учиться, работать и распоряжаться собственной жизнью. Её столкновение с финансовой зависимостью, научной средой и движением суфражисток связывает личное взросление с вопросами женского образования, труда и политической свободы.",
      en: "Ann Veronica Stanley leaves her father's home and moves to London, determined to study, work, and direct her own life. Her encounters with financial dependence, the scientific community, and the suffrage movement connect her personal growth with questions of women's education, employment, and political freedom.",
      ruSha256:
        "aacc49f02f37aec74ba23d58ec7ed09d58f6f803f864fe37b0f77c52631359b0",
      sources: [orionWells, cambridgeEdwardianWells],
    },
    heldRuEvidence: [rslAnnVeronica, rugramAnnVeronica],
    enTitleEvidence: localizedTitle({
      recordKey: annVeronicaKey,
      locale: "en",
      value: "Ann Veronica",
      market: "GB",
      selectionRule: "current-complete-authorized-edition",
      selectionNote:
        "The exact title is present in the British Library electronic legal-deposit catalogue and Orion's official H. G. Wells catalogue.",
      evidence: [
        titleEvidence({
          manifestationId: "bl-eld-2005-ann-veronica",
          sourceUrl:
            "https://eld.bl.uk/?f%5Ball_names_ssim%5D%5B%5D=Wells%2C+H.+G+%28Herbert+George%29%2C+1866-1946&f%5Bdate_range_year_itsim%5D%5B%5D=2005&f%5Bsetspec_ssi%5D%5B%5D=ldebook&per_page=50&sort=title",
          provider: "British Library Electronic Legal Deposit Catalogue",
          authorityId: "british-library",
          authorityTier: "A",
          recordKind: "legal-deposit-catalog",
          recordId: "BL-ELD-2005-ANN-VERONICA",
          catalogTitleExact: "Ann Veronica",
          locale: "en",
          market: "GB",
          expressionLanguage: "en",
          publisher: "Penguin",
          publicationYear: 2005,
        }),
        titleEvidence({
          manifestationId: "isbn-9781474602440-orion",
          sourceUrl:
            "https://www.orionbooks.co.uk/titles/h-g-wells/ann-veronica/9781474602440/",
          provider: "Orion Books",
          authorityId: "orion-books",
          authorityTier: "B",
          recordKind: "publisher-catalog",
          recordId: "ISBN-9781474602440",
          catalogTitleExact: "Ann Veronica",
          locale: "en",
          market: "GB",
          expressionLanguage: "en",
          isbn13: "9781474602440",
          publisher: "Weidenfeld & Nicolson / Orion Books",
          publicationYear: 2017,
        }),
      ],
    }),
  },
  [mrPollyKey]: {
    recordKey: mrPollyKey,
    ruTitle: "История мистера Полли",
    enTitle: "The History of Mr. Polly",
    description: {
      ru: "Плохо образованный приказчик Альфред Полли становится владельцем убыточной лавки и оказывается связан несчастливым браком и профессией, выбранной почти случайно. Его неудачная попытка покончить с прежней жизнью оборачивается неожиданным побегом и возможностью заново определить себя; комический роман исследует цену социальной несвободы и личного выбора.",
      en: "Poorly educated shop assistant Alfred Polly becomes the owner of an unprofitable shop and finds himself bound by an unhappy marriage and a profession chosen almost by accident. His failed attempt to end his former life turns into an unexpected escape and a chance to redefine himself; the comic novel explores the cost of social constraint and personal choice.",
      ruSha256:
        "0d1c7df3ab0fb986570fee9881de9e4bc400cb3846fbecbbda993cec972c73f6",
      sources: [penguinMrPolly, cambridgeEdwardianWells],
    },
    ruTitleEvidence: localizedTitle({
      recordKey: mrPollyKey,
      locale: "ru",
      value: "История мистера Полли",
      market: "RU",
      selectionRule: "current-complete-authorized-edition",
      selectionNote:
        "Заглавие произведения дословно зафиксировано в составе тома 9 РГБ и в перечне произведений официального двуязычного издания «Юрайт».",
      evidence: [
        titleEvidence({
          manifestationId: "rsl-01005609943-volume-9-mr-polly",
          sourceUrl: "https://search.rsl.ru/ru/record/01005609943",
          provider: "Российская государственная библиотека",
          authorityId: "rsl",
          authorityTier: "A",
          recordKind: "national-bibliography",
          recordId: "RSL-01005609943:volume-9:mr-polly",
          catalogTitleExact: "История мистера Полли",
          locale: "ru",
          market: "RU",
          expressionLanguage: "ru",
          publisher: "Правда",
          publicationYear: 1964,
        }),
        titleEvidence({
          manifestationId: "isbn-9785534058741-mr-polly-constituent",
          sourceUrl:
            "https://urait.ru/book/kipps-the-history-of-mr-polly-kipps-istoriya-mistera-polli-455088",
          provider: "Издательство Юрайт",
          authorityId: "yurait",
          authorityTier: "B",
          recordKind: "publisher-catalog",
          recordId: "URAIT-455088:constituent-mr-polly-ru",
          catalogTitleExact: "История мистера Полли",
          locale: "ru",
          market: "RU",
          expressionLanguage: "ru",
          isbn13: "9785534058741",
          publisher: "Юрайт",
          publicationYear: 2020,
        }),
      ],
    }),
    enTitleEvidence: localizedTitle({
      recordKey: mrPollyKey,
      locale: "en",
      value: "The History of Mr. Polly",
      market: "US",
      selectionRule: "current-complete-authorized-edition",
      selectionNote:
        "The Library of Congress bibliographic record and Standard Ebooks' edition catalogue independently retain the period in “Mr.”.",
      evidence: [
        titleEvidence({
          manifestationId: "lccn-10000737",
          sourceUrl: "https://lccn.loc.gov/10000737",
          provider: "Library of Congress",
          authorityId: "loc",
          authorityTier: "A",
          recordKind: "national-bibliography",
          recordId: "LCCN-10000737",
          catalogTitleExact: "The History of Mr. Polly",
          locale: "en",
          market: "US",
          expressionLanguage: "en",
          publisher: "Duffield and Company",
          publicationYear: 1910,
        }),
        titleEvidence({
          manifestationId: "standard-ebooks-h-g-wells-mr-polly",
          sourceUrl:
            "https://standardebooks.org/ebooks/h-g-wells/the-history-of-mr-polly",
          provider: "Standard Ebooks",
          authorityId: "standard-ebooks",
          authorityTier: "B",
          recordKind: "publisher-catalog",
          recordId: "SE-H-G-WELLS-THE-HISTORY-OF-MR-POLLY",
          catalogTitleExact: "The History of Mr. Polly",
          locale: "en",
          market: "US",
          expressionLanguage: "en",
          publisher: "Standard Ebooks",
        }),
      ],
    }),
  },
  [braveNewWorldKey]: {
    recordKey: braveNewWorldKey,
    ruTitle: "О дивный новый мир",
    enTitle: "Brave New World",
    description: {
      ru: "В Мировом Государстве людей выращивают и распределяют по кастам, с детства приучая к потреблению, покорности и химически поддерживаемому довольству. Появление Джона, выросшего за пределами этой системы, обнажает цену устойчивости, из которой исключены семья, история, искусство, свободный выбор и право на страдание.",
      en: "In the World State, people are grown and assigned to castes, conditioned from childhood for consumption, obedience, and chemically sustained contentment. The arrival of John, who was raised outside this system, exposes the price of stability from which family, history, art, free choice, and the right to suffer have been excluded.",
      ruSha256:
        "35d57eab0aeb9e5cebce27e4fce144aee92026ee2268e04ee2ed9ba0d07db9d1",
      sources: [penguinBraveNewWorld, cambridgeBraveNewWorld],
    },
    ruTitleEvidence: localizedTitle({
      recordKey: braveNewWorldKey,
      locale: "ru",
      value: "О дивный новый мир",
      market: "RU",
      selectionRule: "current-complete-authorized-edition",
      selectionNote:
        "Точное русское заглавие подтверждено отдельной ISBN-записью РГБ и независимой официальной карточкой АСТ.",
      evidence: [
        titleEvidence({
          manifestationId: "isbn-9785171035969-rsl",
          sourceUrl: "https://search.rsl.ru/ru/record/01008877330",
          provider: "Российская государственная библиотека",
          authorityId: "rsl",
          authorityTier: "A",
          recordKind: "national-bibliography",
          recordId: "RSL-01008877330",
          catalogTitleExact: "О дивный новый мир",
          locale: "ru",
          market: "RU",
          expressionLanguage: "ru",
          isbn13: "9785171035969",
          publisher: "АСТ",
          publicationYear: 2017,
          translator: "О. Сорока",
        }),
        titleEvidence({
          manifestationId: "isbn-9785170800858-ast",
          sourceUrl: "https://ast.ru/book/o-divnyy-novyy-mir-130381/",
          provider: "Издательство АСТ",
          authorityId: "ast",
          authorityTier: "B",
          recordKind: "publisher-catalog",
          recordId: "ISBN-9785170800858",
          catalogTitleExact: "О дивный новый мир",
          locale: "ru",
          market: "RU",
          expressionLanguage: "ru",
          isbn13: "9785170800858",
          publisher: "АСТ",
          translator: "Осия Сорока",
        }),
      ],
    }),
    enTitleEvidence: localizedTitle({
      recordKey: braveNewWorldKey,
      locale: "en",
      value: "Brave New World",
      market: "US",
      selectionRule: "current-complete-authorized-edition",
      selectionNote:
        "The Library of Congress NLS record and Harper Academic's ISBN catalogue independently use the exact title.",
      evidence: [
        titleEvidence({
          manifestationId: "loc-nls-br11922-db47108",
          sourceUrl:
            "https://www.loc.gov/nls/new-materials/braille-book-review/braille-book-review-november-december-2018/",
          provider: "Library of Congress, National Library Service",
          authorityId: "loc",
          authorityTier: "A",
          recordKind: "national-bibliography",
          recordId: "NLS-BR11922-DB47108",
          catalogTitleExact: "Brave New World",
          locale: "en",
          market: "US",
          expressionLanguage: "en",
        }),
        titleEvidence({
          manifestationId: "isbn-9780061767647-harper",
          sourceUrl:
            "https://www.harperacademic.com/book/9780061767647/brave-new-world/",
          provider: "Harper Academic / HarperCollins",
          authorityId: "harpercollins-us",
          authorityTier: "B",
          recordKind: "publisher-catalog",
          recordId: "ISBN-9780061767647",
          catalogTitleExact: "Brave New World",
          locale: "en",
          market: "US",
          expressionLanguage: "en",
          isbn13: "9780061767647",
          publisher: "Harper Perennial",
          publicationYear: 2010,
        }),
      ],
    }),
  },
  [lordOfTheRingsKey]: {
    recordKey: lordOfTheRingsKey,
    ruTitle: "Властелин колец",
    enTitle: "The Lord of the Rings",
    description: {
      ru: "Фродо получает Кольцо Всевластия и отправляется из Шира к Роковой горе, чтобы уничтожить его прежде, чем Саурон сможет подчинить Средиземье. После распада Братства личное бремя героя соединяется с войной свободных народов, а исход похода зависит не только от силы, но и от дружбы, верности и милосердия.",
      en: "Frodo inherits the One Ring and travels from the Shire to Mount Doom to destroy it before Sauron can subjugate Middle-earth. After the Fellowship breaks apart, the hero's personal burden converges with the war of the free peoples, and the outcome of the quest depends not only on strength but also on friendship, loyalty, and mercy.",
      ruSha256:
        "ffe6606c654645c0f10abf6d259dbca6892d593eaedc0d35f1f13c221486a721",
      sources: [tolkienEstateLordOfTheRings, oxfordLordOfTheRings],
    },
    ruTitleEvidence: localizedTitle({
      recordKey: lordOfTheRingsKey,
      locale: "ru",
      value: "Властелин колец",
      market: "RU",
      selectionRule: "current-complete-authorized-edition",
      selectionNote:
        "Полное издание под этим заглавием подтверждено национальной записью РГБ и независимой ISBN-карточкой АСТ.",
      evidence: [
        titleEvidence({
          manifestationId: "rsl-01009727656",
          sourceUrl: "https://search.rsl.ru/ru/record/01009727656",
          provider: "Российская государственная библиотека",
          authorityId: "rsl",
          authorityTier: "A",
          recordKind: "national-bibliography",
          recordId: "RSL-01009727656",
          catalogTitleExact: "Властелин колец",
          locale: "ru",
          market: "RU",
          expressionLanguage: "ru",
          publicationYear: 2018,
        }),
        titleEvidence({
          manifestationId: "isbn-9785170927913-ast",
          sourceUrl: "https://ast.ru/book/vlastelin-kolets-717323/",
          provider: "Издательство АСТ",
          authorityId: "ast",
          authorityTier: "B",
          recordKind: "publisher-catalog",
          recordId: "ISBN-9785170927913",
          catalogTitleExact: "Властелин колец",
          locale: "ru",
          market: "RU",
          expressionLanguage: "ru",
          isbn13: "9785170927913",
          publisher: "АСТ",
          translator: "В. Каррик, М. Каменкович",
        }),
      ],
    }),
    enTitleEvidence: localizedTitle({
      recordKey: lordOfTheRingsKey,
      locale: "en",
      value: "The Lord of the Rings",
      market: "US",
      selectionRule: "current-complete-authorized-edition",
      selectionNote:
        "The complete-work title is independently recorded by the Library of Congress and HarperCollins' official catalogue.",
      evidence: [
        titleEvidence({
          manifestationId: "isbn-9780618260584-loc",
          sourceUrl: "https://lccn.loc.gov/2002726623",
          provider: "Library of Congress",
          authorityId: "loc",
          authorityTier: "A",
          recordKind: "national-bibliography",
          recordId: "LCCN-2002726623",
          catalogTitleExact: "The Lord of the Rings",
          locale: "en",
          market: "US",
          expressionLanguage: "en",
          isbn10: "0618260587",
          publisher: "Houghton Mifflin",
          publicationYear: 2002,
        }),
        titleEvidence({
          manifestationId: "harpercollins-the-lord-of-the-rings",
          sourceUrl:
            "https://www.harpercollins.com/products/the-lord-of-the-rings-jrr-tolkien",
          provider: "HarperCollins",
          authorityId: "harpercollins-us",
          authorityTier: "B",
          recordKind: "publisher-catalog",
          recordId: "HC-THE-LORD-OF-THE-RINGS-JRR-TOLKIEN",
          catalogTitleExact: "The Lord of the Rings",
          locale: "en",
          market: "US",
          expressionLanguage: "en",
          publisher: "HarperCollins",
        }),
      ],
    }),
  },
  [hobbitKey]: {
    recordKey: hobbitKey,
    ruTitle: "Хоббит, или Туда и обратно",
    enTitle: "The Hobbit: Or, There and Back Again",
    description: {
      ru: "Домосед Бильбо Бэггинс присоединяется к Гэндальфу и тринадцати гномам, которые хотят вернуть сокровища, захваченные драконом Смаугом. Испытания в пути обнаруживают в нём находчивость, мужество и способность к милосердию, превращая сказочное приключение в историю внутреннего взросления.",
      en: "Home-loving Bilbo Baggins joins Gandalf and thirteen dwarves who seek to recover treasure seized by the dragon Smaug. The trials of the journey reveal his resourcefulness, courage, and capacity for mercy, turning a fairy-tale adventure into a story of inner growth.",
      ruSha256:
        "6b07eefbd97e3c081c0ec02f85e31787bc60b523210166ffd28e0471b6ebd234",
      sources: [tolkienEstateHobbit, collinsHobbit],
    },
    ruTitleEvidence: localizedTitle({
      recordKey: hobbitKey,
      locale: "ru",
      value: "Хоббит, или Туда и обратно",
      market: "RU",
      selectionRule: "current-complete-authorized-edition",
      selectionNote:
        "Заглавие с запятой подтверждено отдельной записью РГБ и официальной карточкой опубликованного издания АСТ.",
      evidence: [
        titleEvidence({
          manifestationId: "isbn-5353011813-rsl",
          sourceUrl: "https://search.rsl.ru/ru/record/01002354159",
          provider: "Российская государственная библиотека",
          authorityId: "rsl",
          authorityTier: "A",
          recordKind: "national-bibliography",
          recordId: "RSL-01002354159",
          catalogTitleExact: "Хоббит, или Туда и обратно",
          locale: "ru",
          market: "RU",
          expressionLanguage: "ru",
          isbn10: "5353011813",
          publisher: "Росмэн",
          publicationYear: 2003,
          translator: "И. Тогоева",
        }),
        titleEvidence({
          manifestationId: "isbn-5170267096-ast",
          sourceUrl:
            "https://ast.ru/book/khobbit-ili-tuda-i-obratno-078282/",
          provider: "Издательство АСТ",
          authorityId: "ast",
          authorityTier: "B",
          recordKind: "publisher-catalog",
          recordId: "ISBN-5170267096",
          catalogTitleExact: "Хоббит, или Туда и обратно",
          locale: "ru",
          market: "RU",
          expressionLanguage: "ru",
          isbn10: "5170267096",
          publisher: "АСТ",
        }),
      ],
    }),
    enTitleEvidence: localizedTitle({
      recordKey: hobbitKey,
      locale: "en",
      value: "The Hobbit: Or, There and Back Again",
      market: "US",
      selectionRule: "current-complete-authorized-edition",
      selectionNote:
        "The colon-form title is independently present in Library of Congress NLS record DB11497 and Penguin Random House's official Book Resumes catalogue.",
      evidence: [
        titleEvidence({
          manifestationId: "loc-nls-db11497",
          sourceUrl:
            "https://www.loc.gov/nls/new-materials/collections-connections/april-2025-collections-connections/",
          provider: "Library of Congress, National Library Service",
          authorityId: "loc",
          authorityTier: "A",
          recordKind: "national-bibliography",
          recordId: "NLS-DB11497",
          catalogTitleExact: "The Hobbit: Or, There and Back Again",
          locale: "en",
          market: "US",
          expressionLanguage: "en",
          publicationYear: 1978,
        }),
        titleEvidence({
          manifestationId: "prh-book-resume-the-hobbit",
          sourceUrl: "https://www.penguinrandomhouse.com/book-resumes",
          provider: "Penguin Random House",
          authorityId: "penguin-random-house",
          authorityTier: "B",
          recordKind: "publisher-catalog",
          recordId: "PRH-BOOK-RESUME-THE-HOBBIT",
          catalogTitleExact: "The Hobbit: Or, There and Back Again",
          locale: "en",
          market: "US",
          expressionLanguage: "en",
          publisher: "Penguin Random House",
        }),
      ],
    }),
  },
};

export const bookEvidenceV2PublicBatch02ResolvedRecordKeys = Object.freeze(
  Object.values(overlays)
    .filter((overlay) => overlay.ruTitleEvidence)
    .map((overlay) => overlay.recordKey)
);

export const bookEvidenceV2PublicBatch02RecordKeys = Object.freeze(
  Object.keys(overlays)
);

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
    : (overlay.heldRuEvidence || []).map((evidence) => evidence.sourceUrl);
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
  const titleEvidenceSources = [
    ...(overlay.ruTitleEvidence?.evidence || []),
    ...overlay.enTitleEvidence.evidence,
    ...(overlay.heldRuEvidence || []),
  ].map(titleSource);
  const localizedTitles = overlay.ruTitleEvidence
    ? {
        ...work.localizedTitles,
        ru: overlay.ruTitleEvidence,
        en: overlay.enTitleEvidence,
      }
    : {
        ...withoutRuLocalizedTitle(work.localizedTitles),
        en: overlay.enTitleEvidence,
      };

  return {
    ...work,
    title: overlay.ruTitle,
    description: overlay.description.ru,
    translations: {
      ...work.translations,
      ru: translationFor(work, overlay, "ru", verified),
      en: translationFor(work, overlay, "en", verified),
    },
    localizedTitles,
    // Description records are merged first so a URL that is also publisher
    // title evidence retains the stricter manifestation metadata.
    sources: mergeSources(work.sources || [], [
      ...overlay.description.sources,
      ...titleEvidenceSources,
    ]),
    editorial: {
      status: verified ? "verified" : "reviewed",
      reviewedAt: checkedAt,
    },
  };
}

/** Applies the batch after archive candidate merging, including reviewed-only Works. */
export function applyBookEvidenceV2PublicBatch02Work(
  countryId: string,
  writerId: string,
  work: WorkProfile
): WorkProfile {
  const overlay = overlays[`${countryId}:${writerId}:${work.id}`];
  return overlay ? applyOverlay(work, overlay) : work;
}

/**
 * Applies this evidence overlay immutably. This module deliberately does not
 * mutate the shared authority registry, wire itself into the archive, assert
 * canonicality, commit, or publish anything.
 */
export function applyBookEvidenceV2PublicBatch02(
  countries: Country[]
): Country[] {
  const seen = new Map<string, number>(
    bookEvidenceV2PublicBatch02RecordKeys.map((recordKey) => [recordKey, 0])
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
        return applyBookEvidenceV2PublicBatch02Work(
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
      `book-evidence-v2-public-batch-02-target-cardinality:${cardinalityErrors
        .map(([recordKey, count]) => `${recordKey}=${count}`)
        .join(",")}`
    );
  }
  return result;
}
