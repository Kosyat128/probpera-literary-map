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
  sourceLanguage: string;
  originCountryId: "switzerland" | "usa";
  sources: DescriptionSource[];
};

type BatchOverlay = {
  recordKey: string;
  ruTitle: string;
  enTitle: string;
  description: ReviewedDescription;
  ruTitleEvidence?: WorkLocalizedTitleProfile;
  enTitleEvidence?: WorkLocalizedTitleProfile;
  heldTitleEvidence?: Partial<
    Record<WorkLocale, WorkTitleEvidenceProfile[]>
  >;
};

export type BookEvidenceV2PublicBatch06HoldEvidence = {
  provider: string;
  url: string;
  recordId: string;
  observedTitle: string;
  evidenceKind:
    | "manifestation-record"
    | "publisher-distributor-record"
    | "work-name-reference"
    | "translation-history-reference";
  authorityId?: string;
  isbn13?: string;
  note: string;
};

export type BookEvidenceV2PublicBatch06Hold = {
  recordKey: string;
  status: "fail-closed";
  locale: WorkLocale;
  code:
    | "ru-national-record-unresolved"
    | "en-complete-manifestation-unresolved"
    | "en-title-record-conflict"
    | "ru-title-punctuation-conflict";
  candidateTitles: string[];
  reason: string;
  resolutionCriteria: string[];
  evidence: BookEvidenceV2PublicBatch06HoldEvidence[];
};

export type BookEvidenceV2PublicBatch06AuthorityDraft = {
  authorityId: string;
  provider: string;
  authorityCountryId: "sweden" | "switzerland" | "usa";
  independenceGroup: string;
  tier: "A" | "B";
  allowedRoles: Array<"title-publisher" | "description-fact">;
  domains: string[];
  markets: string[];
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

function descriptionSource({
  provider,
  authorityId,
  authorityTier,
  authorityCountryId,
  language,
  recordId,
  url,
}: {
  provider: string;
  authorityId: string;
  authorityTier: "A" | "B";
  authorityCountryId: string;
  language: string;
  recordId: string;
  url: string;
}): DescriptionSource {
  return {
    provider,
    authorityId,
    authorityTier,
    country: authorityCountryId,
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
      sourceLanguage: description.sourceLanguage,
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
    author: "Probpera bilingual editorial translation",
    createdAt: checkedAt,
    reviewedBy: "Codex bilingual consistency review",
    reviewedAt: checkedAt,
  };
}

const spittelerKey = "switzerland:carl_spitteler:olympian-spring";
const mobyDickKey = "usa:herman_melville:moby-dick";
const oldManKey = "usa:ernest_hemingway:the-old-man-and-the-sea";
const fahrenheitKey = "usa:ray_bradbury:fahrenheit-451-editorial";
const catcherKey =
  "usa:jerome_david_salinger:the-catcher-in-the-rye-editorial";
const mockingbirdKey =
  "usa:harper_lee:to-kill-a-mockingbird-editorial";
const lolitaKey = "usa:vladimir_nabokov:lolita-editorial";
const hungerGamesKey = "usa:suzanne_collins:the-hunger-games";

const swissSpitteler = descriptionSource({
  provider: "Swiss National Library / Swiss Literary Archives",
  authorityId: "swiss-national-library",
  authorityTier: "A",
  authorityCountryId: "switzerland",
  language: "de",
  recordId: "SLA-Carl-Spitteler",
  url: "https://www.nb.admin.ch/de/carl-spitteler-im-sla",
});
const nobelSpitteler = descriptionSource({
  provider: "Nobel Prize Outreach",
  authorityId: "nobel-prize-outreach",
  authorityTier: "B",
  authorityCountryId: "sweden",
  language: "en",
  recordId: "literature-1919-spitteler-facts",
  url: "https://www.nobelprize.org/prizes/literature/1919/spitteler/facts/",
});
const locMobyDescription = descriptionSource({
  provider: "Library of Congress, NLS",
  authorityId: "loc",
  authorityTier: "A",
  authorityCountryId: "usa",
  language: "en",
  recordId: "NLS-best-american-fiction-early-period-moby-dick",
  url: "https://www.loc.gov/nls/new-materials/book-lists/best-american-fiction-early-period/",
});
const prhMobyDescription = descriptionSource({
  provider: "Penguin Random House",
  authorityId: "penguin-random-house",
  authorityTier: "B",
  authorityCountryId: "usa",
  language: "en",
  recordId: "PRH-832154-moby-dick-or-the-whale",
  url: "https://www.penguinrandomhouse.com/books/832154/moby-dick-or-the-whale-by-herman-melville/",
});
const locOldManDescription = descriptionSource({
  provider: "Library of Congress, NLS",
  authorityId: "loc",
  authorityTier: "A",
  authorityCountryId: "usa",
  language: "en",
  recordId: "NLS-DB10319",
  url: "https://www.loc.gov/nls/new-materials/collections-connections/june-2025-collections-connections/",
});
const simonOldManDescription = descriptionSource({
  provider: "Simon & Schuster / Scribner",
  authorityId: "simon-schuster-us",
  authorityTier: "B",
  authorityCountryId: "usa",
  language: "en",
  recordId: "ISBN-9780684801223",
  url: "https://www.simonandschuster.com/books/Old-Man-and-the-Sea/Ernest-Hemingway/9780684801223",
});
const locDystopiaDescriptions = descriptionSource({
  provider: "Library of Congress, NLS",
  authorityId: "loc",
  authorityTier: "A",
  authorityCountryId: "usa",
  language: "en",
  recordId: "NLS-braille-book-review-2018-dystopian-fiction",
  url: "https://www.loc.gov/nls/new-materials/braille-book-review/braille-book-review-november-december-2018/",
});
const simonFahrenheitDescription = descriptionSource({
  provider: "Simon & Schuster",
  authorityId: "simon-schuster-us",
  authorityTier: "B",
  authorityCountryId: "usa",
  language: "en",
  recordId: "ISBN-9781451673319",
  url: "https://www.simonandschuster.com/books/Fahrenheit-451/Ray-Bradbury/9781451673319",
});
const locCatcherDescription = descriptionSource({
  provider: "Library of Congress",
  authorityId: "loc",
  authorityTier: "A",
  authorityCountryId: "usa",
  language: "en",
  recordId: "LOC-America-Reads-030",
  url: "https://www.loc.gov/exhibits/america-reads/1950-to-2009.html#obj030",
});
const hachetteCatcherDescription = descriptionSource({
  provider: "Hachette Book Group / Little, Brown and Company",
  authorityId: "hachette-book-group-us",
  authorityTier: "B",
  authorityCountryId: "usa",
  language: "en",
  recordId: "ISBN-9780316769532",
  url: "https://www.hachettebookgroup.com/titles/j-d-salinger/9780316769532/9780316769532/",
});
const locOverseasDescriptions = descriptionSource({
  provider: "Library of Congress, NLS",
  authorityId: "loc",
  authorityTier: "A",
  authorityCountryId: "usa",
  language: "en",
  recordId: "NLS-overseas-outlook-2025-minibibliography",
  url: "https://www.loc.gov/nls/news-and-updates/overseas-outlook-newsletter/overseas-outlook-june-december-2025/",
});
const mockingbirdOfficialDescription = descriptionSource({
  provider: "Harper Lee official work site",
  authorityId: "harper-lee-official",
  authorityTier: "B",
  authorityCountryId: "usa",
  language: "en",
  recordId: "the-book",
  url: "https://www.tokillamockingbird.com/the-book",
});
const prhLolitaDescription = descriptionSource({
  provider: "Penguin Random House",
  authorityId: "penguin-random-house",
  authorityTier: "B",
  authorityCountryId: "usa",
  language: "en",
  recordId: "PRH-119445-lolita-readers-guide",
  url: "https://www.penguinrandomhouse.com/books/119445/lolita-by-vladimir-nabokov/9780679723165/readers-guide/",
});
const scholasticHungerDescription = descriptionSource({
  provider: "Scholastic Press",
  authorityId: "scholastic-us",
  authorityTier: "B",
  authorityCountryId: "usa",
  language: "en",
  recordId: "press-release-the-hunger-games",
  url: "https://www.scholastic.com/newsroom/all-news/press-release/the-hunger-games-by-suzanne-collins.html",
});

const oldManEnEvidence = [
  titleEvidence({
    manifestationId: "loc-lccn-52011935",
    sourceUrl: "https://lccn.loc.gov/52011935",
    provider: "Library of Congress",
    authorityId: "loc",
    authorityTier: "A",
    recordKind: "national-bibliography",
    recordId: "LOC-52011935",
    catalogTitleExact: "The old man and the sea",
    locale: "en",
    market: "US",
    expressionLanguage: "en",
    isbn10: "0684102455",
    publisher: "Charles Scribner's Sons",
    publicationYear: 1952,
  }),
  titleEvidence({
    manifestationId: "isbn-9781476787855",
    sourceUrl:
      "https://www.simonandschuster.com/books/The-Old-Man-and-the-Sea/Ernest-Hemingway/Hemingway-Library-Edition/9781476787855",
    provider: "Simon & Schuster / Scribner",
    authorityId: "simon-schuster-us",
    authorityTier: "B",
    recordKind: "publisher-catalog",
    recordId: "ISBN-9781476787855",
    catalogTitleExact: "The Old Man and the Sea",
    locale: "en",
    market: "US",
    expressionLanguage: "en",
    isbn13: "9781476787855",
    publisher: "Scribner",
    publicationYear: 2022,
    editionStatement: "The Hemingway Library Edition",
  }),
];

const mockingbirdRuEvidence = [
  titleEvidence({
    manifestationId: "isbn-9785170336036",
    sourceUrl: "https://search.rsl.ru/ru/record/01004342482",
    provider: "Российская государственная библиотека",
    authorityId: "rsl",
    authorityTier: "A",
    recordKind: "national-bibliography",
    recordId: "RSL-01004342482",
    catalogTitleExact: "Убить пересмешника…",
    locale: "ru",
    market: "RU",
    expressionLanguage: "ru",
    isbn13: "9785170336036",
    publisher: "АСТ",
    publicationYear: 2009,
    translator: "Нора Галь, Раиса Облонская",
  }),
  titleEvidence({
    manifestationId: "isbn-9785170904112",
    sourceUrl: "https://ast.ru/book/ubit-peresmeshnika-710014/",
    provider: "АСТ",
    authorityId: "ast",
    authorityTier: "B",
    recordKind: "publisher-catalog",
    recordId: "ISBN-9785170904112",
    catalogTitleExact: "Убить пересмешника…",
    locale: "ru",
    market: "RU",
    expressionLanguage: "ru",
    isbn13: "9785170904112",
    publisher: "АСТ",
    publicationYear: 2018,
    translator: "Нора Галь, Раиса Облонская",
    editionStatement: "Серия «Эксклюзивная классика»",
  }),
];

export const bookEvidenceV2PublicBatch06AuthorityDrafts = Object.freeze<
  BookEvidenceV2PublicBatch06AuthorityDraft[]
>([
  {
    authorityId: "swiss-national-library",
    provider: "swiss-national-library",
    authorityCountryId: "switzerland",
    independenceGroup: "swiss-national-library",
    tier: "A",
    allowedRoles: ["description-fact"],
    domains: ["nb.admin.ch", "ead.nb.admin.ch"],
    markets: [],
  },
  {
    authorityId: "nobel-prize-outreach",
    provider: "nobel-prize-outreach",
    authorityCountryId: "sweden",
    independenceGroup: "nobel-foundation",
    tier: "B",
    allowedRoles: ["description-fact"],
    domains: ["nobelprize.org"],
    markets: [],
  },
  {
    authorityId: "simon-schuster-us",
    provider: "simon-and-schuster-us",
    authorityCountryId: "usa",
    independenceGroup: "simon-and-schuster-publishing-group",
    tier: "B",
    allowedRoles: ["title-publisher", "description-fact"],
    domains: ["simonandschuster.com"],
    markets: ["US"],
  },
  {
    authorityId: "hachette-book-group-us",
    provider: "hachette-book-group-us",
    authorityCountryId: "usa",
    independenceGroup: "hachette-book-group-us",
    tier: "B",
    allowedRoles: ["title-publisher", "description-fact"],
    domains: ["hachettebookgroup.com"],
    markets: ["US"],
  },
  {
    authorityId: "harper-lee-official",
    provider: "harper-lee-official-work-site",
    authorityCountryId: "usa",
    independenceGroup: "harpercollins-publishing-group",
    tier: "B",
    allowedRoles: ["title-publisher", "description-fact"],
    domains: ["tokillamockingbird.com"],
    markets: ["US"],
  },
  {
    authorityId: "scholastic-us",
    provider: "scholastic-press-us",
    authorityCountryId: "usa",
    independenceGroup: "scholastic-publishing-group",
    tier: "B",
    allowedRoles: ["title-publisher", "description-fact"],
    domains: ["scholastic.com"],
    markets: ["US"],
  },
]);

export const bookEvidenceV2PublicBatch06RequiredAuthorityIds = Object.freeze([
  "ast",
  "azbooka",
  "eksmo",
  "hachette-book-group-us",
  "harper-lee-official",
  "loc",
  "neb",
  "nobel-prize-outreach",
  "penguin-random-house",
  "project-gutenberg",
  "rsl",
  "scholastic-us",
  "simon-schuster-us",
  "swiss-national-library",
]);

export const bookEvidenceV2PublicBatch06Holds = Object.freeze<
  BookEvidenceV2PublicBatch06Hold[]
>([
  {
    recordKey: spittelerKey,
    status: "fail-closed",
    locale: "ru",
    code: "ru-national-record-unresolved",
    candidateTitles: ["Олимпийская весна"],
    reason:
      "Русское название обнаружено в карточке цифрового распространителя, однако стабильная запись РГБ, РНБ или НЭБ для полного русского издания с установленными выходными данными не найдена.",
    resolutionCriteria: [
      "Найти прямую стабильную запись РГБ, РНБ или НЭБ на полную русскую манифестацию.",
      "Сверить точное основное заглавие, полноту текста, издателя или правообладателя, год, язык выражения и переводчика.",
      "Подтвердить ту же форму названия независимой официальной издательской или правообладательской карточкой.",
    ],
    evidence: [
      {
        provider: "Books.ru / ЛитРес",
        url: "https://www.books.ru/books/olimpiiskaya-vesna-5050640/",
        recordId: "BOOKS-5050640",
        observedTitle: "Олимпийская весна",
        evidenceKind: "publisher-distributor-record",
        note:
          "Карточка подтверждает употребление русского названия, но не заменяет национальную или legal-deposit запись и не даёт достаточных данных для строгой сверки полной манифестации.",
      },
    ],
  },
  {
    recordKey: spittelerKey,
    status: "fail-closed",
    locale: "en",
    code: "en-complete-manifestation-unresolved",
    candidateTitles: ["Olympian Spring"],
    reason:
      "Форма Olympian Spring подтверждена как англоязычное справочное название произведения, но два независимых каталожных свидетельства полного английского перевода не установлены; историческое английское введение прямо описывает иной текст как единственную тогда переведённую книгу Шпиттелера.",
    resolutionCriteria: [
      "Найти запись национальной библиотеки англоязычного рынка на полный английский перевод, а не на фрагменты, критическую статью или английскую глоссу немецкого заглавия.",
      "Сверить переводчика, издателя, год, полноту текста и устойчивый идентификатор манифестации.",
      "Подтвердить точное заглавие второй независимой карточкой издателя или правообладателя того же полного перевода.",
    ],
    evidence: [
      {
        provider: "Nobel Prize Outreach",
        url: "https://www.nobelprize.org/prizes/literature/1919/spitteler/facts/",
        recordId: "literature-1919-spitteler-facts",
        observedTitle: "Olympian Spring",
        evidenceKind: "work-name-reference",
        authorityId: "nobel-prize-outreach",
        note:
          "Авторитетная английская форма названия и характеристика произведения; это не каталожная запись английской манифестации.",
      },
      {
        provider: "Wikisource transcription of Laughing Truths (1927)",
        url: "https://en.wikisource.org/wiki/Laughing_Truths/Introduction",
        recordId: "Laughing-Truths-Introduction-1927",
        observedTitle: "Der Olympische Frühling or Olympian Spring",
        evidenceKind: "translation-history-reference",
        note:
          "Историческое введение употребляет английскую глоссу и сообщает, что к тому времени на английский была переведена другая книга; оно не свидетельствует о полном переводе эпоса.",
      },
    ],
  },
]);

const overlays: Record<string, BatchOverlay> = {
  [spittelerKey]: {
    recordKey: spittelerKey,
    ruTitle: "Олимпийская весна",
    enTitle: "Olympian Spring",
    description: {
      ru: "В монументальном стихотворном эпосе античные боги восходят на Олимп, а мифологическое действие соединяет фантастические, религиозные и натуралистические образы. Шпиттелер превращает борьбу божественных сил и судьбы в аллегорию человеческой свободы, надежды и разочарования.",
      en: "In this monumental verse epic, the ancient gods ascend to Olympus, while the mythological action brings together fantastic, religious, and naturalistic imagery. Spitteler turns the struggle between divine powers and fate into an allegory of human freedom, hope, and disillusionment.",
      ruSha256:
        "d07be858c3289211af3f4cd7124af55a03c689986d53528177c815462255ccbc",
      sourceLanguage: "de",
      originCountryId: "switzerland",
      sources: [swissSpitteler, nobelSpitteler],
    },
  },
  [mobyDickKey]: {
    recordKey: mobyDickKey,
    ruTitle: "Моби Дик, или Белый Кит",
    enTitle: "Moby-Dick; or, The Whale",
    description: {
      ru: "Рассказчик Измаил поступает на китобойное судно «Пекод», где капитан Ахав подчиняет плавание навязчивой погоне за белым китом Моби Диком. Морское приключение, сведения о китобойном промысле и философские отступления складываются в исследование одержимости, судьбы и пределов человеческой власти над природой.",
      en: "Narrator Ishmael joins the whaling ship Pequod, whose captain, Ahab, subordinates the voyage to his obsessive pursuit of the white whale Moby Dick. Maritime adventure, whaling lore, and philosophical digressions combine into an inquiry into obsession, fate, and the limits of human power over nature.",
      ruSha256:
        "7e186ffd702ad7de20e2be9a8ebdad95bb2133ce40681bc7f4f2beabddc5a68a",
      sourceLanguage: "en",
      originCountryId: "usa",
      sources: [locMobyDescription, prhMobyDescription],
    },
    ruTitleEvidence: localizedTitle({
      recordKey: mobyDickKey,
      locale: "ru",
      value: "Моби Дик, или Белый Кит",
      selectionRule: "current-complete-authorized-edition",
      selectionNote:
        "Точная форма с прописными словами «Белый Кит» подтверждена отдельной записью РГБ и независимой современной карточкой издательства «Азбука».",
      evidence: [
        titleEvidence({
          manifestationId: "isbn-5699134182",
          sourceUrl: "https://search.rsl.ru/ru/record/01002765718",
          provider: "Российская государственная библиотека",
          authorityId: "rsl",
          authorityTier: "A",
          recordKind: "national-bibliography",
          recordId: "RSL-01002765718",
          catalogTitleExact: "Моби Дик, или Белый Кит",
          locale: "ru",
          market: "RU",
          expressionLanguage: "ru",
          isbn10: "5699134182",
          publisher: "Эксмо",
          publicationYear: 2005,
          translator: "Инна Бернштейн",
        }),
        titleEvidence({
          manifestationId: "isbn-9785389198234",
          sourceUrl: "https://azbooka.ru/books/mobi-dik-ili-belyy-kit",
          provider: "Азбука-Аттикус / Азбука",
          authorityId: "azbooka",
          authorityTier: "B",
          recordKind: "publisher-catalog",
          recordId: "ISBN-9785389198234",
          catalogTitleExact: "Моби Дик, или Белый Кит",
          locale: "ru",
          market: "RU",
          expressionLanguage: "ru",
          isbn13: "9785389198234",
          publisher: "Азбука",
          publicationYear: 2021,
          translator: "Инна Бернштейн",
        }),
      ],
    }),
    enTitleEvidence: localizedTitle({
      recordKey: mobyDickKey,
      locale: "en",
      value: "Moby-Dick; or, The Whale",
      selectionRule: "original-market-title",
      selectionNote:
        "Полное заглавие первого американского издания подтверждено предметной записью Library of Congress и независимой электронной манифестацией Project Gutenberg, основанной на первом US-издании.",
      evidence: [
        titleEvidence({
          manifestationId: "loc-america-reads-006",
          sourceUrl:
            "https://www.loc.gov/exhibits/america-reads/1750-to-1899.html#obj006",
          provider: "Library of Congress",
          authorityId: "loc",
          authorityTier: "A",
          recordKind: "national-bibliography",
          recordId: "LOC-America-Reads-006",
          catalogTitleExact: "Moby-Dick; or, The Whale",
          locale: "en",
          market: "US",
          expressionLanguage: "en",
          publisher: "Harper & Brothers",
          publicationYear: 1851,
        }),
        titleEvidence({
          manifestationId: "gutenberg-ebook-15",
          sourceUrl: "https://www.gutenberg.org/ebooks/15",
          provider: "Project Gutenberg",
          authorityId: "project-gutenberg",
          authorityTier: "B",
          recordKind: "publisher-catalog",
          recordId: "GUTENBERG-15",
          catalogTitleExact: "Moby-Dick; or, The Whale",
          locale: "en",
          market: "US",
          expressionLanguage: "en",
          publisher: "Project Gutenberg",
          publicationYear: 2001,
          editionStatement: "eBook #15; based on the first American edition",
        }),
      ],
    }),
  },
  [oldManKey]: {
    recordKey: oldManKey,
    ruTitle: "Старик и море",
    enTitle: "The Old Man and the Sea",
    description: {
      ru: "После долгой полосы неудач старый кубинский рыбак Сантьяго выходит один в море и вступает в многодневную борьбу с огромным марлином. Испытание превращает лаконичную повесть в размышление о стойкости и достоинстве человека, чья внутренняя победа не отменяется внешней утратой.",
      en: "After a long run of bad luck, the old Cuban fisherman Santiago sails out alone and enters a days-long struggle with a giant marlin. The ordeal turns the spare novella into a meditation on human endurance and dignity, suggesting that inner victory is not erased by outward loss.",
      ruSha256:
        "1fe3e74bac8b77db2161ca5e8db0e69acba50f95f5cd216515096eff90afebf2",
      sourceLanguage: "en",
      originCountryId: "usa",
      sources: [locOldManDescription, simonOldManDescription],
    },
    ruTitleEvidence: localizedTitle({
      recordKey: oldManKey,
      locale: "ru",
      value: "Старик и море",
      selectionRule: "current-complete-authorized-edition",
      selectionNote:
        "Точное заглавие самостоятельной манифестации РГБ совпадает с заглавием произведения внутри независимого официального сборника АСТ.",
      evidence: [
        titleEvidence({
          manifestationId: "isbn-5352000745",
          sourceUrl: "https://search.rsl.ru/ru/record/01000737180",
          provider: "Российская государственная библиотека",
          authorityId: "rsl",
          authorityTier: "A",
          recordKind: "national-bibliography",
          recordId: "RSL-01000737180",
          catalogTitleExact: "Старик и море",
          locale: "ru",
          market: "RU",
          expressionLanguage: "ru",
          isbn10: "5352000745",
          publisher: "Азбука-классика",
          publicationYear: 2001,
        }),
        titleEvidence({
          manifestationId: "isbn-9785170751112-component-starik-i-more",
          sourceUrl: "https://ast.ru/book/starik-i-more-rasskazy-041071/",
          provider: "АСТ",
          authorityId: "ast",
          authorityTier: "B",
          recordKind: "publisher-catalog",
          recordId: "ISBN-9785170751112:component-starik-i-more",
          catalogTitleExact: "Старик и море",
          locale: "ru",
          market: "RU",
          expressionLanguage: "ru",
          isbn13: "9785170751112",
          publisher: "АСТ",
          publicationYear: 2012,
          editionStatement: "Компонент издания «Старик и море. Рассказы»",
        }),
      ],
    }),
    enTitleEvidence: localizedTitle({
      recordKey: oldManKey,
      locale: "en",
      value: "The Old Man and the Sea",
      selectionRule: "original-market-title",
      selectionNote:
        "Полное заглавие с начальным артиклем подтверждено библиографической записью Library of Congress LCCN 52011935 и независимой точной карточкой Scribner Hemingway Library Edition.",
      evidence: oldManEnEvidence,
    }),
  },
  [fahrenheitKey]: {
    recordKey: fahrenheitKey,
    ruTitle: "451° по Фаренгейту",
    enTitle: "Fahrenheit 451",
    description: {
      ru: "Пожарный Гай Монтэг служит обществу, где книги запрещены и подлежат сожжению, но постепенно начинает сомневаться в своей работе и становится беглецом. Его пробуждение раскрывает антиутопию о цензуре, подавлении самостоятельной мысли и способности литературы сохранять человеческий опыт.",
      en: "Fireman Guy Montag serves a society where books are outlawed and burned, but he gradually begins to question his work and becomes a fugitive. His awakening unfolds a dystopia about censorship, the suppression of independent thought, and literature’s power to preserve human experience.",
      ruSha256:
        "0519608f5d460064610f54423dee7b9cff0f1515b4a05757ccfd459ce193e4dd",
      sourceLanguage: "en",
      originCountryId: "usa",
      sources: [locDystopiaDescriptions, simonFahrenheitDescription],
    },
    ruTitleEvidence: localizedTitle({
      recordKey: fahrenheitKey,
      locale: "ru",
      value: "451° по Фаренгейту",
      selectionRule: "current-complete-authorized-edition",
      selectionNote:
        "Знак градуса и точная словесная форма совпадают в независимых записях РГБ и НЭБ; издательские страницы с апострофом не использованы.",
      evidence: [
        titleEvidence({
          manifestationId: "isbn-9785699923816",
          sourceUrl: "https://search.rsl.ru/ru/record/01009444458",
          provider: "Российская государственная библиотека",
          authorityId: "rsl",
          authorityTier: "A",
          recordKind: "national-bibliography",
          recordId: "RSL-01009444458",
          catalogTitleExact: "451° по Фаренгейту",
          locale: "ru",
          market: "RU",
          expressionLanguage: "ru",
          isbn13: "9785699923816",
          publisher: "Эксмо",
          publicationYear: 2017,
          translator: "Татьяна Шинкарь",
        }),
        titleEvidence({
          manifestationId: "isbn-9785699936670",
          sourceUrl:
            "https://rusneb.ru/catalog/000200_000018_RU_NLR_BIBL_A_012164760/",
          provider: "Национальная электронная библиотека / РНБ",
          authorityId: "neb",
          authorityTier: "A",
          recordKind: "legal-deposit-catalog",
          recordId: "NEB-RU_NLR_BIBL_A_012164760",
          catalogTitleExact: "451° по Фаренгейту",
          locale: "ru",
          market: "RU",
          expressionLanguage: "ru",
          isbn13: "9785699936670",
          publisher: "Эксмо",
          publicationYear: 2019,
          translator: "Татьяна Шинкарь",
        }),
      ],
    }),
    enTitleEvidence: localizedTitle({
      recordKey: fahrenheitKey,
      locale: "en",
      value: "Fahrenheit 451",
      selectionRule: "original-market-title",
      selectionNote:
        "Точное US-заглавие подтверждено библиографической записью первого издания Library of Congress и независимой карточкой Simon & Schuster.",
      evidence: [
        titleEvidence({
          manifestationId: "loc-lccn-53011280",
          sourceUrl: "https://lccn.loc.gov/53011280",
          provider: "Library of Congress",
          authorityId: "loc",
          authorityTier: "A",
          recordKind: "national-bibliography",
          recordId: "LOC-53011280",
          catalogTitleExact: "Fahrenheit 451",
          locale: "en",
          market: "US",
          expressionLanguage: "en",
          publisher: "Ballantine Books",
          publicationYear: 1953,
          editionStatement: "First edition",
        }),
        titleEvidence({
          manifestationId: "isbn-9781451673319",
          sourceUrl:
            "https://www.simonandschuster.com/books/Fahrenheit-451/Ray-Bradbury/9781451673319",
          provider: "Simon & Schuster",
          authorityId: "simon-schuster-us",
          authorityTier: "B",
          recordKind: "publisher-catalog",
          recordId: "ISBN-9781451673319",
          catalogTitleExact: "Fahrenheit 451",
          locale: "en",
          market: "US",
          expressionLanguage: "en",
          isbn13: "9781451673319",
          publisher: "Simon & Schuster",
          publicationYear: 2012,
        }),
      ],
    }),
  },
  [catcherKey]: {
    recordKey: catcherKey,
    ruTitle: "Над пропастью во ржи",
    enTitle: "The Catcher in the Rye",
    description: {
      ru: "После исключения из школы шестнадцатилетний Холден Колфилд три дня бродит по Нью-Йорку, откладывая возвращение домой и отвергая «фальшь» взрослого мира. За его резким голосом раскрываются одиночество, растерянность и тревога перед взрослением.",
      en: "After being expelled from school, sixteen-year-old Holden Caulfield wanders New York City for three days, putting off his return home and rejecting the “phoniness” of the adult world. Behind his cutting voice lie loneliness, confusion, and anxiety about growing up.",
      ruSha256:
        "0c16365d61a9bce569aba19f19d18527775511cc736bc390be141fc74a363a1d",
      sourceLanguage: "en",
      originCountryId: "usa",
      sources: [locCatcherDescription, hachetteCatcherDescription],
    },
    ruTitleEvidence: localizedTitle({
      recordKey: catcherKey,
      locale: "ru",
      value: "Над пропастью во ржи",
      selectionRule: "current-complete-authorized-edition",
      selectionNote:
        "Точное русское заглавие совпадает в записи НЭБ и независимой карточке Эксмо; перевод Риты Райт-Ковалевой указан на обеих сторонах сверки.",
      evidence: [
        titleEvidence({
          manifestationId: "isbn-9785699741674",
          sourceUrl:
            "https://rusneb.ru/catalog/000199_000009_007876644/",
          provider: "Национальная электронная библиотека / РГБ",
          authorityId: "neb",
          authorityTier: "A",
          recordKind: "legal-deposit-catalog",
          recordId: "NEB-007876644",
          catalogTitleExact: "Над пропастью во ржи",
          locale: "ru",
          market: "RU",
          expressionLanguage: "ru",
          isbn13: "9785699741674",
          publisher: "Эксмо",
          publicationYear: 2015,
          translator: "Рита Райт-Ковалева",
        }),
        titleEvidence({
          manifestationId: "isbn-9785040988402",
          sourceUrl:
            "https://eksmo.ru/book/nad-propastyu-vo-rzhi-ITD936146/",
          provider: "Эксмо",
          authorityId: "eksmo",
          authorityTier: "B",
          recordKind: "publisher-catalog",
          recordId: "ISBN-9785040988402",
          catalogTitleExact: "Над пропастью во ржи",
          locale: "ru",
          market: "RU",
          expressionLanguage: "ru",
          isbn13: "9785040988402",
          publisher: "Эксмо",
          publicationYear: 2018,
          translator: "Рита Райт-Ковалева",
        }),
      ],
    }),
    enTitleEvidence: localizedTitle({
      recordKey: catcherKey,
      locale: "en",
      value: "The Catcher in the Rye",
      selectionRule: "original-market-title",
      selectionNote:
        "Точное заглавие подтверждено библиографической записью первого издания Library of Congress и независимой официальной карточкой Little, Brown.",
      evidence: [
        titleEvidence({
          manifestationId: "loc-lccn-51004713",
          sourceUrl: "https://lccn.loc.gov/51004713",
          provider: "Library of Congress",
          authorityId: "loc",
          authorityTier: "A",
          recordKind: "national-bibliography",
          recordId: "LOC-51004713",
          catalogTitleExact: "The Catcher in the Rye",
          locale: "en",
          market: "US",
          expressionLanguage: "en",
          publisher: "Little, Brown and Company",
          publicationYear: 1951,
          editionStatement: "First edition",
        }),
        titleEvidence({
          manifestationId: "isbn-9780316769532",
          sourceUrl:
            "https://www.hachettebookgroup.com/titles/j-d-salinger/9780316769532/9780316769532/",
          provider: "Hachette Book Group / Little, Brown and Company",
          authorityId: "hachette-book-group-us",
          authorityTier: "B",
          recordKind: "publisher-catalog",
          recordId: "ISBN-9780316769532",
          catalogTitleExact: "The Catcher in the Rye",
          locale: "en",
          market: "US",
          expressionLanguage: "en",
          isbn13: "9780316769532",
          publisher: "Little, Brown and Company",
          publicationYear: 1951,
        }),
      ],
    }),
  },
  [mockingbirdKey]: {
    recordKey: mockingbirdKey,
    ruTitle: "Убить пересмешника…",
    enTitle: "To Kill a Mockingbird",
    description: {
      ru: "В небольшом алабамском городе Скаут и Джем Финч взрослеют, наблюдая, как их отец Аттикус защищает чернокожего мужчину, несправедливо обвинённого в изнасиловании белой женщины. Детская перспектива связывает судебную историю с исследованием расовых предрассудков, нравственной смелости и того, как общество судит непохожих.",
      en: "In a small Alabama town, Scout and Jem Finch come of age while watching their father, Atticus, defend a Black man unjustly accused of raping a white woman. The children’s perspective links the courtroom story to an examination of racial prejudice, moral courage, and the way society judges those it treats as different.",
      ruSha256:
        "1eaa9c0ec31782852fa56b90770b6cb9ca78269fa3f08519909b8dec271bb883",
      sourceLanguage: "en",
      originCountryId: "usa",
      sources: [locOverseasDescriptions, mockingbirdOfficialDescription],
    },
    ruTitleEvidence: localizedTitle({
      recordKey: mockingbirdKey,
      locale: "ru",
      value: "Убить пересмешника…",
      selectionRule: "current-complete-authorized-edition",
      selectionNote:
        "Конечное многоточие является частью опубликованного заглавия: его сохраняют запись РГБ и независимая официальная карточка АСТ серии «Эксклюзивная классика».",
      evidence: mockingbirdRuEvidence,
    }),
    enTitleEvidence: localizedTitle({
      recordKey: mockingbirdKey,
      locale: "en",
      value: "To Kill a Mockingbird",
      selectionRule: "original-market-title",
      selectionNote:
        "Точное американское заглавие подтверждено библиографической записью первого издания Library of Congress и независимой карточкой официального сайта произведения с HarperCollins ISBN.",
      evidence: [
        titleEvidence({
          manifestationId: "loc-lccn-60007847",
          sourceUrl: "https://lccn.loc.gov/60007847",
          provider: "Library of Congress",
          authorityId: "loc",
          authorityTier: "A",
          recordKind: "national-bibliography",
          recordId: "LOC-60007847",
          catalogTitleExact: "To Kill a Mockingbird",
          locale: "en",
          market: "US",
          expressionLanguage: "en",
          publisher: "J. B. Lippincott Company",
          publicationYear: 1960,
          editionStatement: "First edition",
        }),
        titleEvidence({
          manifestationId: "isbn-9780060935467",
          sourceUrl: "https://www.tokillamockingbird.com/the-book",
          provider: "Harper Lee official work site / HarperCollins",
          authorityId: "harper-lee-official",
          authorityTier: "B",
          recordKind: "publisher-catalog",
          recordId: "ISBN-9780060935467",
          catalogTitleExact: "To Kill a Mockingbird",
          locale: "en",
          market: "US",
          expressionLanguage: "en",
          isbn13: "9780060935467",
          publisher: "Harper Perennial Modern Classics",
          publicationYear: 2006,
        }),
      ],
    }),
  },
  [lolitaKey]: {
    recordKey: lolitaKey,
    ruTitle: "Лолита",
    enTitle: "Lolita",
    description: {
      ru: "Заключённый в ожидании суда Гумберт Гумберт пытается придать литературный блеск рассказу о своей одержимости Долорес Гейз, её похищении и сексуальном насилии над ней. Ненадёжность его исповеди заставляет отделять манипуляцию рассказчика от почти стёртой им личности ребёнка.",
      en: "Imprisoned and awaiting trial, Humbert Humbert tries to lend literary brilliance to his account of his obsession with Dolores Haze, her kidnapping, and his sexual abuse of her. The unreliability of his confession forces the reader to separate the narrator’s manipulation from the child’s identity, which he almost erases.",
      ruSha256:
        "6da1ff2406a248cb84cee8f1bc90572ab586556a6cad6bafdf0e0eed41bb16ba",
      sourceLanguage: "en",
      originCountryId: "usa",
      sources: [locOverseasDescriptions, prhLolitaDescription],
    },
    ruTitleEvidence: localizedTitle({
      recordKey: lolitaKey,
      locale: "ru",
      value: "Лолита",
      selectionRule: "current-complete-authorized-edition",
      selectionNote:
        "Авторский русский перевод под точным заглавием подтверждён отдельной записью РГБ и независимой современной карточкой «Азбуки».",
      evidence: [
        titleEvidence({
          manifestationId: "isbn-9785395000163",
          sourceUrl: "https://search.rsl.ru/ru/record/01004135210",
          provider: "Российская государственная библиотека",
          authorityId: "rsl",
          authorityTier: "A",
          recordKind: "national-bibliography",
          recordId: "RSL-01004135210",
          catalogTitleExact: "Лолита",
          locale: "ru",
          market: "RU",
          expressionLanguage: "ru",
          isbn13: "9785395000163",
          publisher: "Азбука-классика",
          publicationYear: 2008,
          translator: "Владимир Набоков",
        }),
        titleEvidence({
          manifestationId: "isbn-9785389085794",
          sourceUrl: "https://azbooka.ru/books/lolita-x1zq",
          provider: "Азбука-Аттикус / Азбука",
          authorityId: "azbooka",
          authorityTier: "B",
          recordKind: "publisher-catalog",
          recordId: "ISBN-9785389085794",
          catalogTitleExact: "Лолита",
          locale: "ru",
          market: "RU",
          expressionLanguage: "ru",
          isbn13: "9785389085794",
          publisher: "Азбука",
          publicationYear: 2017,
          translator: "Владимир Набоков",
        }),
      ],
    }),
    enTitleEvidence: localizedTitle({
      recordKey: lolitaKey,
      locale: "en",
      value: "Lolita",
      selectionRule: "original-market-title",
      selectionNote:
        "Точное английское заглавие подтверждено библиографической записью первого американского издания Library of Congress и независимой US-карточкой Vintage / Penguin Random House.",
      evidence: [
        titleEvidence({
          manifestationId: "loc-lccn-58010755",
          sourceUrl: "https://lccn.loc.gov/58010755",
          provider: "Library of Congress",
          authorityId: "loc",
          authorityTier: "A",
          recordKind: "national-bibliography",
          recordId: "LOC-58010755",
          catalogTitleExact: "Lolita",
          locale: "en",
          market: "US",
          expressionLanguage: "en",
          publisher: "G. P. Putnam's Sons",
          publicationYear: 1958,
          editionStatement: "First American edition",
        }),
        titleEvidence({
          manifestationId: "isbn-9780679723165",
          sourceUrl:
            "https://www.penguinrandomhouse.com/books/119445/lolita-by-vladimir-nabokov-introduction-by-martin-amis/9780679723165/",
          provider: "Penguin Random House / Vintage",
          authorityId: "penguin-random-house",
          authorityTier: "B",
          recordKind: "publisher-catalog",
          recordId: "ISBN-9780679723165",
          catalogTitleExact: "Lolita",
          locale: "en",
          market: "US",
          expressionLanguage: "en",
          isbn13: "9780679723165",
          publisher: "Vintage",
          publicationYear: 1989,
        }),
      ],
    }),
  },
  [hungerGamesKey]: {
    recordKey: hungerGamesKey,
    ruTitle: "Голодные игры",
    enTitle: "The Hunger Games",
    description: {
      ru: "В государстве Панем шестнадцатилетние Китнисс Эвердин и Пит Мелларк представляют Дистрикт 12 в ежегодном телевизионном состязании, где подростков заставляют сражаться насмерть. Борьба за выживание ставит Китнисс перед выбором между правилами Капитолия, человечностью и привязанностью к Питу.",
      en: "In the nation of Panem, sixteen-year-olds Katniss Everdeen and Peeta Mellark represent District 12 in an annual televised contest that forces teenagers to fight to the death. The struggle for survival confronts Katniss with a choice between the Capitol’s rules, her humanity, and her attachment to Peeta.",
      ruSha256:
        "1b16f78533937b47865c17c3b12c6ec52ab46ee3356b8b9db09036cbb3b8538c",
      sourceLanguage: "en",
      originCountryId: "usa",
      sources: [locDystopiaDescriptions, scholasticHungerDescription],
    },
    ruTitleEvidence: localizedTitle({
      recordKey: hungerGamesKey,
      locale: "ru",
      value: "Голодные игры",
      selectionRule: "current-complete-authorized-edition",
      selectionNote:
        "Точное название и ISBN российской манифестации совпадают в записи НЭБ и независимой официальной карточке АСТ.",
      evidence: [
        titleEvidence({
          manifestationId: "isbn-9785171011079-neb",
          sourceUrl:
            "https://rusneb.ru/catalog/000199_000009_008778044/",
          provider: "Национальная электронная библиотека / РГБ",
          authorityId: "neb",
          authorityTier: "A",
          recordKind: "legal-deposit-catalog",
          recordId: "NEB-008778044",
          catalogTitleExact: "Голодные игры",
          locale: "ru",
          market: "RU",
          expressionLanguage: "ru",
          isbn13: "9785171011079",
          publisher: "АСТ",
          publicationYear: 2017,
          translator: "Алексей Шипулин",
        }),
        titleEvidence({
          manifestationId: "isbn-9785171011079-ast",
          sourceUrl: "https://ast.ru/book/golodnye-igry-827584/",
          provider: "АСТ",
          authorityId: "ast",
          authorityTier: "B",
          recordKind: "publisher-catalog",
          recordId: "ISBN-9785171011079",
          catalogTitleExact: "Голодные игры",
          locale: "ru",
          market: "RU",
          expressionLanguage: "ru",
          isbn13: "9785171011079",
          publisher: "АСТ",
          publicationYear: 2017,
          translator: "Алексей Шипулин",
        }),
      ],
    }),
    enTitleEvidence: localizedTitle({
      recordKey: hungerGamesKey,
      locale: "en",
      value: "The Hunger Games",
      selectionRule: "original-market-title",
      selectionNote:
        "Точное US-заглавие подтверждено библиографической записью первого издания Library of Congress и независимой карточкой Scholastic Press.",
      evidence: [
        titleEvidence({
          manifestationId: "loc-lccn-2007039987",
          sourceUrl: "https://lccn.loc.gov/2007039987",
          provider: "Library of Congress",
          authorityId: "loc",
          authorityTier: "A",
          recordKind: "national-bibliography",
          recordId: "LOC-2007039987",
          catalogTitleExact: "The Hunger Games",
          locale: "en",
          market: "US",
          expressionLanguage: "en",
          isbn10: "0439023483",
          isbn13: "9780439023481",
          publisher: "Scholastic Press",
          publicationYear: 2008,
          editionStatement: "First edition",
        }),
        titleEvidence({
          manifestationId: "isbn-9780439023481",
          sourceUrl:
            "https://www.scholastic.com/newsroom/all-news/press-release/the-hunger-games-by-suzanne-collins.html",
          provider: "Scholastic Press",
          authorityId: "scholastic-us",
          authorityTier: "B",
          recordKind: "publisher-catalog",
          recordId: "ISBN-9780439023481",
          catalogTitleExact: "The Hunger Games",
          locale: "en",
          market: "US",
          expressionLanguage: "en",
          isbn10: "0439023483",
          isbn13: "9780439023481",
          publisher: "Scholastic Press",
          publicationYear: 2008,
        }),
      ],
    }),
  },
};

export const bookEvidenceV2PublicBatch06RecordKeys = Object.freeze(
  Object.keys(overlays)
);

export const bookEvidenceV2PublicBatch06ResolvedRecordKeys = Object.freeze(
  Object.values(overlays)
    .filter((overlay) => overlay.ruTitleEvidence && overlay.enTitleEvidence)
    .map((overlay) => overlay.recordKey)
);

function withoutCanon(work: WorkProfile) {
  const copy = { ...work };
  delete copy.canon;
  return copy;
}

function localizedTitlesFor(work: WorkProfile, overlay: BatchOverlay) {
  const result = { ...(work.localizedTitles || {}) };
  for (const locale of ["ru", "en"] as WorkLocale[]) {
    const profile =
      locale === "ru" ? overlay.ruTitleEvidence : overlay.enTitleEvidence;
    if (profile) result[locale] = profile;
    else delete result[locale];
  }
  return result;
}

function translationFor(
  work: WorkProfile,
  overlay: BatchOverlay,
  locale: WorkLocale,
  cardVerified: boolean
) {
  const existing = { ...(work.translations?.[locale] || {}) };
  delete existing.titleEvidence;
  const titleEvidenceProfile =
    locale === "ru" ? overlay.ruTitleEvidence : overlay.enTitleEvidence;
  const title = locale === "ru" ? overlay.ruTitle : overlay.enTitle;
  const titleUrls = titleEvidenceProfile
    ? titleEvidenceProfile.evidence.map((evidence) => evidence.sourceUrl)
    : (overlay.heldTitleEvidence?.[locale] || []).map(
        (evidence) => evidence.sourceUrl
      );
  const descriptionUrls = overlay.description.sources.map(
    (source) => source.url
  );
  return {
    ...existing,
    locale,
    title,
    description: overlay.description[locale],
    sourceLanguage: locale,
    status: cardVerified ? ("verified" as const) : ("reviewed" as const),
    sourceUrls: [...new Set([...titleUrls, ...descriptionUrls])],
    method:
      locale === "ru"
        ? ("editorial-original" as const)
        : ("human-translation" as const),
    reviewedAt: checkedAt,
    ...(titleEvidenceProfile ? { titleEvidence: titleEvidenceProfile } : {}),
    descriptionProvenance: descriptionProvenance(locale, overlay.description),
  };
}

function applyOverlay(work: WorkProfile, overlay: BatchOverlay): WorkProfile {
  const cardVerified = Boolean(
    overlay.ruTitleEvidence && overlay.enTitleEvidence
  );
  const base = withoutCanon(work);
  const heldEvidence = Object.values(overlay.heldTitleEvidence || {}).flat();
  const titleEvidenceSources = [
    ...(overlay.ruTitleEvidence?.evidence || []),
    ...(overlay.enTitleEvidence?.evidence || []),
    ...heldEvidence,
  ].map(titleSource);

  return {
    ...base,
    title: overlay.ruTitle,
    description: overlay.description.ru,
    translations: {
      ...base.translations,
      ru: translationFor(base, overlay, "ru", cardVerified),
      en: translationFor(base, overlay, "en", cardVerified),
    },
    localizedTitles: localizedTitlesFor(base, overlay),
    // When one authoritative page serves both roles, keep the manifestation
    // record identity while merging the description field into that source.
    sources: mergeSources(base.sources || [], [
      ...overlay.description.sources,
      ...titleEvidenceSources,
    ]),
    editorial: {
      status: cardVerified ? "verified" : "reviewed",
      reviewedAt: checkedAt,
    },
  };
}

export function applyBookEvidenceV2PublicBatch06Work(
  countryId: string,
  writerId: string,
  work: WorkProfile
): WorkProfile {
  const overlay = overlays[`${countryId}:${writerId}:${work.id}`];
  return overlay ? applyOverlay(work, overlay) : work;
}

/** Applies this self-contained audit immutably; registry/archive wiring is external. */
export function applyBookEvidenceV2PublicBatch06(
  countries: Country[]
): Country[] {
  const seen = new Map<string, number>(
    bookEvidenceV2PublicBatch06RecordKeys.map((recordKey) => [recordKey, 0])
  );
  const result = countries.map((country) => ({
    ...country,
    writers: country.writers.map((writer) => ({
      ...writer,
      workDetails: writer.workDetails?.map((work) => {
        const recordKey = `${country.id}:${writer.id}:${work.id}`;
        if (!overlays[recordKey]) return work;
        seen.set(recordKey, (seen.get(recordKey) || 0) + 1);
        return applyBookEvidenceV2PublicBatch06Work(
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
      `book-evidence-v2-public-batch-06-target-cardinality:${cardinalityErrors
        .map(([recordKey, count]) => `${recordKey}=${count}`)
        .join(",")}`
    );
  }
  return result;
}
