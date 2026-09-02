import {
  applyBookEvidenceV2PublicBatch02Work,
  bookEvidenceV2PublicBatch02Holds,
} from "./bookEvidenceV2PublicBatch02";
import {
  applyBookEvidenceV2PublicBatch03Work,
  bookEvidenceV2PublicBatch03Holds,
} from "./bookEvidenceV2PublicBatch03";
import { withoutUndefinedTitleEvidenceOptions } from "./bookEvidenceV2TitleEvidence";
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
  sourceCountry: "canada" | "england";
  sources: DescriptionSource[];
};

type FullOverlay = {
  recordKey: string;
  ruTitle: string;
  enTitle: string;
  description: ReviewedDescription;
  ruTitleEvidence: WorkLocalizedTitleProfile;
  enTitleEvidence: WorkLocalizedTitleProfile;
};

type RuResolution = {
  recordKey: string;
  ruTitle: string;
  ruTitleEvidence: WorkLocalizedTitleProfile;
};

export type BookEvidenceV2PublicHolds01AuthorityDraft = {
  authorityId: "nlr";
  provider: "russian-national-library";
  authorityCountryId: "russia";
  independenceGroup: "russian-national-library";
  tier: "A";
  allowedRoles: ["title-national-record"];
  domains: ["primo.nlr.ru"];
  markets: ["RU"];
};

export type BookEvidenceV2PublicHolds01Hold = {
  recordKey: string;
  status: "fail-closed";
  locale: WorkLocale;
  code: string;
  reason: string;
  checkedPaths: string[];
  resolutionCriteria: string[];
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
  country,
  recordId,
  url,
}: {
  provider: string;
  authorityId: string;
  authorityTier?: "A" | "B";
  country: string;
  recordId: string;
  url: string;
}): DescriptionSource {
  return {
    provider,
    authorityId,
    authorityTier,
    country,
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
      sourceCountry: description.sourceCountry,
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
    sourceCountry: description.sourceCountry,
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

function nlrUrl(docId: string) {
  return `https://primo.nlr.ru/primo-explore/fulldisplay?docid=${docId}&context=L&vid=07NLR_VU1&lang=ru_RU`;
}

function nlrEvidence({
  sourceRecordId,
  docId,
  title,
  isbn13,
  publisher,
  publicationYear,
  translator,
  editionStatement,
}: {
  sourceRecordId: string;
  docId: string;
  title: string;
  isbn13?: string;
  publisher: string;
  publicationYear: number;
  translator?: string;
  editionStatement?: string;
}) {
  return titleEvidence({
    manifestationId: `nlr-${sourceRecordId}`,
    sourceUrl: nlrUrl(docId),
    provider: "Российская национальная библиотека",
    authorityId: "nlr",
    authorityTier: "A",
    recordKind: "national-bibliography",
    recordId: `NLR-${sourceRecordId}`,
    catalogTitleExact: title,
    locale: "ru",
    market: "RU",
    expressionLanguage: "ru",
    isbn13,
    publisher,
    publicationYear,
    translator,
    editionStatement,
  });
}

function findBatch02AnnRslEvidence() {
  const evidence = bookEvidenceV2PublicBatch02Holds
    .find((hold) => hold.recordKey === annVeronicaKey)
    ?.manifestationEvidence.find((item) => item.authorityId === "rsl");
  if (!evidence) {
    throw new Error("book-evidence-v2-public-holds-01-ann-rsl-missing");
  }
  return evidence;
}

function findBatch03PublisherEvidence(recordKey: string) {
  const evidence = bookEvidenceV2PublicBatch03Holds
    .find((hold) => hold.recordKey === recordKey)
    ?.publisherEvidence.find((item) => item.authorityId === "azbooka");
  if (!evidence) {
    throw new Error(
      `book-evidence-v2-public-holds-01-publisher-missing:${recordKey}`
    );
  }
  return evidence;
}

const lifeOfPiKey = "canada:yann_martel:life-of-pi";
const sleeperKey = "england:h_g_wells:when-the-sleeper-wakes";
const annVeronicaKey = "england:h_g_wells:ann-veronica";
const ghostwrittenKey = "england:david_mitchell:ghostwritten";
const number9DreamKey = "england:david_mitchell:number9dream";
const boneClocksKey = "england:david_mitchell:the-bone-clocks";
const sladeHouseKey = "england:david_mitchell:slade-house";

const lifeCanongate = descriptionSource({
  provider: "Canongate Books",
  authorityId: "canongate",
  country: "england",
  recordId: "ISBN-9781786891686",
  url: "https://canongate.co.uk/books/318-life-of-pi/",
});
const lifeYannMartel = descriptionSource({
  provider: "Yann Martel official website",
  authorityId: "yann-martel-official",
  country: "canada",
  recordId: "life-of-pi",
  url: "https://www.yannmartel.com/books/life-of-pi",
});
const sleeperBroadview = descriptionSource({
  provider: "Broadview Press",
  authorityId: "broadview-press",
  country: "canada",
  recordId: "ISBN-9781554813520",
  url: "https://broadviewpress.com/product/when-the-sleeper-wakes/",
});
const sleeperOxford = descriptionSource({
  provider: "University of Oxford Research Archive",
  authorityId: "university-of-oxford",
  country: "england",
  recordId: "ORA-uuid-f17390d8-6d28-41e3-8be6-a075ea0db593",
  url: "https://ora.ox.ac.uk/objects/uuid%3Af17390d8-6d28-41e3-8be6-a075ea0db593",
});

const fullOverlays: Record<string, FullOverlay> = {
  [lifeOfPiKey]: {
    recordKey: lifeOfPiKey,
    ruTitle: "Жизнь Пи",
    enTitle: "Life of Pi",
    description: {
      ru: "После гибели грузового судна шестнадцатилетний Пи Патель остаётся в спасательной шлюпке посреди Тихого океана вместе с несколькими животными, среди которых - бенгальский тигр. Его борьба за выживание в открытом море соединяет приключенческий сюжет с размышлением о вере и силе повествования.",
      en: "After a cargo ship sinks, sixteen-year-old Pi Patel is left in a lifeboat in the Pacific with several animals, including a Bengal tiger. His struggle for survival on the open sea combines an adventure plot with a meditation on faith and the power of storytelling.",
      ruSha256:
        "e3ff21ce209a8d19b5f3d432d3b03aa6057edfc83ddad0cbffb0c7ac680c5bad",
      sourceCountry: "canada",
      sources: [lifeCanongate, lifeYannMartel],
    },
    ruTitleEvidence: localizedTitle({
      recordKey: lifeOfPiKey,
      locale: "ru",
      value: "Жизнь Пи",
      market: "RU",
      selectionRule: "current-complete-authorized-edition",
      selectionNote:
        "Точное заглавие и ISBN 978-5-699-36934-8 совпадают в записи РНБ и официальной карточке Эксмо; обе записи относятся к русскому печатному изданию 2009 года.",
      evidence: [
        nlrEvidence({
          sourceRecordId: "001399951",
          docId: "07NLR_LMS001399951",
          title: "Жизнь Пи",
          isbn13: "9785699369348",
          publisher: "Домино ; Эксмо",
          publicationYear: 2009,
          translator: "И. Алчеев ; А. Блейз",
        }),
        titleEvidence({
          manifestationId: "isbn-9785699369348-eksmo",
          sourceUrl: "https://eksmo.ru/book/zhizn-pi-430151008/",
          provider: "Эксмо",
          authorityId: "eksmo",
          authorityTier: "B",
          recordKind: "publisher-catalog",
          recordId: "ISBN-9785699369348",
          catalogTitleExact: "Жизнь Пи",
          locale: "ru",
          market: "RU",
          expressionLanguage: "ru",
          isbn13: "9785699369348",
          publisher: "Эксмо",
          publicationYear: 2009,
        }),
      ],
    }),
    enTitleEvidence: localizedTitle({
      recordKey: lifeOfPiKey,
      locale: "en",
      value: "Life of Pi",
      market: "US",
      selectionRule: "current-complete-authorized-edition",
      selectionNote:
        "The Library of Congress first-US-edition record and HarperCollins' current official product record independently retain the exact title and the same hardcover ISBN 9780151008117.",
      evidence: [
        titleEvidence({
          manifestationId: "loc-2001039737",
          sourceUrl: "https://lccn.loc.gov/2001039737",
          provider: "Library of Congress",
          authorityId: "loc",
          authorityTier: "A",
          recordKind: "national-bibliography",
          recordId: "LOC-2001039737",
          catalogTitleExact: "Life of Pi",
          locale: "en",
          market: "US",
          expressionLanguage: "en",
          isbn10: "0151008116",
          isbn13: "9780151008117",
          publisher: "Harcourt",
          publicationYear: 2001,
          editionStatement: "First U.S. edition",
        }),
        titleEvidence({
          manifestationId: "isbn-9780151008117-harpercollins",
          sourceUrl:
            "https://www.harpercollins.com/products/life-of-pi-yann-martel.js",
          provider: "HarperCollins US",
          authorityId: "harpercollins-us",
          authorityTier: "B",
          recordKind: "publisher-catalog",
          recordId: "ISBN-9780151008117",
          catalogTitleExact: "Life of Pi",
          locale: "en",
          market: "US",
          expressionLanguage: "en",
          isbn13: "9780151008117",
          publisher: "Mariner Books Classics / HarperCollins",
        }),
      ],
    }),
  },
  [sleeperKey]: {
    recordKey: sleeperKey,
    ruTitle: "Когда спящий проснется",
    enTitle: "When the Sleeper Wakes",
    description: {
      ru: "Грэм впадает в длительный сон и просыпается через двести лет в преобразившемся мире, где накопившееся состояние сделало его номинальным хозяином половины мира. Его пробуждение запускает борьбу за власть в футуристическом Лондоне, а обещание освобождения сталкивается с новой формой политического контроля.",
      en: "Graham falls into a prolonged sleep and wakes two hundred years later in a transformed world, where his accumulated fortune has made him the nominal master of half the world. His awakening sets off a struggle for power in a futuristic London, where the promise of liberation collides with a new form of political control.",
      ruSha256:
        "7d82f06d6b9d86e1e765d8316d27dfe8649b5bea91ca549cfc0c8182445b8aa3",
      sourceCountry: "england",
      sources: [sleeperBroadview, sleeperOxford],
    },
    ruTitleEvidence: localizedTitle({
      recordKey: sleeperKey,
      locale: "ru",
      value: "Когда спящий проснется",
      market: "RU",
      selectionRule: "earliest-authorized-edition",
      selectionNote:
        "НЭБ/РГБ и РНБ независимо фиксируют заглавие «Когда спящий проснется» и перевод Екатерины Прейс в издании 1909 года, предшествующем авторской переработке 1910 года; форма с «ё» не подставляется редакционно.",
      evidence: [
        titleEvidence({
          manifestationId: "neb-003995369-original-1909",
          sourceUrl:
            "https://rusneb.ru/catalog/000199_000009_003995369/",
          provider: "Национальная электронная библиотека / РГБ",
          authorityId: "neb",
          authorityTier: "A",
          recordKind: "national-bibliography",
          recordId: "NEB-003995369",
          catalogTitleExact: "Когда спящий проснется",
          locale: "ru",
          market: "RU",
          expressionLanguage: "ru",
          publisher: "Шиповник",
          publicationYear: 1909,
          translator: "Екатерина Прейс",
          editionStatement: "На обложке дата: 1908",
        }),
        nlrEvidence({
          sourceRecordId: "005263873",
          docId: "07NLR_LMS005263873",
          title: "Когда спящий проснется",
          publisher: "Шиповник",
          publicationYear: 1909,
          translator: "Екатерина Прейс",
          editionStatement: "Собрание сочинений, том 2",
        }),
      ],
    }),
    enTitleEvidence: localizedTitle({
      recordKey: sleeperKey,
      locale: "en",
      value: "When the Sleeper Wakes",
      market: "US",
      selectionRule: "earliest-authorized-edition",
      selectionNote:
        "The 1899 Library of Congress manifestation and Project Gutenberg ebook 775 identify the original text as When the Sleeper Wakes; the later revised title The Sleeper Awakes is deliberately excluded.",
      evidence: [
        titleEvidence({
          manifestationId: "loc-99002363-original-1899",
          sourceUrl: "https://lccn.loc.gov/99002363",
          provider: "Library of Congress",
          authorityId: "loc",
          authorityTier: "A",
          recordKind: "national-bibliography",
          recordId: "LOC-99002363",
          catalogTitleExact: "When the Sleeper Wakes",
          locale: "en",
          market: "US",
          expressionLanguage: "en",
          publisher: "Harper & Brothers",
          publicationYear: 1899,
          editionStatement: "New York and London edition; OCLC 2338373",
        }),
        titleEvidence({
          manifestationId: "project-gutenberg-ebook-775",
          sourceUrl: "https://www.gutenberg.org/ebooks/775",
          provider: "Project Gutenberg",
          authorityId: "project-gutenberg",
          authorityTier: "B",
          recordKind: "publisher-catalog",
          recordId: "PG-EBOOK-775",
          catalogTitleExact: "When the Sleeper Wakes",
          locale: "en",
          market: "US",
          expressionLanguage: "en",
          publisher: "Project Gutenberg",
          publicationYear: 1997,
          editionStatement: "Public-domain ebook preserving the original title",
        }),
      ],
    }),
  },
};

const ruResolutions: Record<string, RuResolution> = {
  [annVeronicaKey]: {
    recordKey: annVeronicaKey,
    ruTitle: "Анна-Вероника",
    ruTitleEvidence: localizedTitle({
      recordKey: annVeronicaKey,
      locale: "ru",
      value: "Анна-Вероника",
      market: "RU",
      selectionRule: "authoritative-uniform-title",
      selectionNote:
        "Дефис выбран не редакционно: независимые записи РГБ и РНБ одинаково фиксируют точное составное заглавие «Анна-Вероника» в девятом томе полного собрания сочинений 1964 года. Бесдефисная форма отдельного издания T8 относится к другой манифестации и не подменяет выбранную форму заглавия.",
      evidence: [
        findBatch02AnnRslEvidence(),
        nlrEvidence({
          sourceRecordId: "008943004:volume-9:ann-veronica",
          docId: "07NLR_LMS008943004",
          title: "Анна-Вероника",
          publisher: "Правда",
          publicationYear: 1964,
          editionStatement: "Собрание сочинений, том 9",
        }),
      ],
    }),
  },
  [ghostwrittenKey]: {
    recordKey: ghostwrittenKey,
    ruTitle: "Литературный призрак",
    ruTitleEvidence: localizedTitle({
      recordKey: ghostwrittenKey,
      locale: "ru",
      value: "Литературный призрак",
      market: "RU",
      selectionRule: "current-complete-authorized-edition",
      selectionNote:
        "РНБ и официальный каталог Азбуки-Аттикус совпадают по заглавию, ISBN 978-5-389-16330-0 и переводчику. РНБ датирует манифестацию 2021 годом, а издательская архивная карточка - 2022 годом; это расхождение сохранено в отдельных записях и не сглажено.",
      evidence: [
        nlrEvidence({
          sourceRecordId: "012693539",
          docId: "07NLR_LMS012693539",
          title: "Литературный призрак",
          isbn13: "9785389163300",
          publisher: "Иностранка",
          publicationYear: 2021,
          translator: "Ирина Климовицкая",
        }),
        findBatch03PublisherEvidence(ghostwrittenKey),
      ],
    }),
  },
  [number9DreamKey]: {
    recordKey: number9DreamKey,
    ruTitle: "Сон № 9",
    ruTitleEvidence: localizedTitle({
      recordKey: number9DreamKey,
      locale: "ru",
      value: "Сон № 9",
      market: "RU",
      selectionRule: "current-complete-authorized-edition",
      selectionNote:
        "Точное заглавие, ISBN 978-5-389-21680-8, 2022 год и переводчик Мария Нуянзина совпадают в записи РНБ и официальной карточке Азбуки.",
      evidence: [
        nlrEvidence({
          sourceRecordId: "016217605",
          docId: "07NLR_LMS016217605",
          title: "Сон № 9",
          isbn13: "9785389216808",
          publisher: "Азбука : Азбука-Аттикус",
          publicationYear: 2022,
          translator: "Мария Нуянзина",
        }),
        findBatch03PublisherEvidence(number9DreamKey),
      ],
    }),
  },
  [boneClocksKey]: {
    recordKey: boneClocksKey,
    ruTitle: "Костяные часы",
    ruTitleEvidence: localizedTitle({
      recordKey: boneClocksKey,
      locale: "ru",
      value: "Костяные часы",
      market: "RU",
      selectionRule: "current-complete-authorized-edition",
      selectionNote:
        "РНБ и официальный каталог Азбуки-Аттикус совпадают по заглавию, ISBN 978-5-389-16277-8 и переводчику. Каталожная формула РНБ «2020 [т. е. 2019]» и издательский год 2022 сохранены раздельно; в числовом поле РНБ указан исправленный год 2019.",
      evidence: [
        nlrEvidence({
          sourceRecordId: "012189625",
          docId: "07NLR_LMS012189625",
          title: "Костяные часы",
          isbn13: "9785389162778",
          publisher: "Иностранка : Азбука-Аттикус",
          publicationYear: 2019,
          translator: "Александра Питчер",
          editionStatement: "Каталожная дата РНБ: 2020 [т. е. 2019]",
        }),
        findBatch03PublisherEvidence(boneClocksKey),
      ],
    }),
  },
  [sladeHouseKey]: {
    recordKey: sladeHouseKey,
    ruTitle: "Голодный дом",
    ruTitleEvidence: localizedTitle({
      recordKey: sladeHouseKey,
      locale: "ru",
      value: "Голодный дом",
      market: "RU",
      selectionRule: "current-complete-authorized-edition",
      selectionNote:
        "РНБ и официальный каталог Азбуки совпадают по заглавию, ISBN 978-5-389-13712-7 и переводчику. Национальная запись фиксирует 2017 год, издательская архивная карточка - 2023 год; годы оставлены при соответствующих манифестациях.",
      evidence: [
        nlrEvidence({
          sourceRecordId: "011542908",
          docId: "07NLR_LMS011542908",
          title: "Голодный дом",
          isbn13: "9785389137127",
          publisher: "Азбука : Азбука-Аттикус",
          publicationYear: 2017,
          translator: "Александра Питчер",
        }),
        findBatch03PublisherEvidence(sladeHouseKey),
      ],
    }),
  },
};

export const bookEvidenceV2PublicHolds01AuthorityDrafts = Object.freeze<
  BookEvidenceV2PublicHolds01AuthorityDraft[]
>([
  {
    authorityId: "nlr",
    provider: "russian-national-library",
    authorityCountryId: "russia",
    independenceGroup: "russian-national-library",
    tier: "A",
    allowedRoles: ["title-national-record"],
    domains: ["primo.nlr.ru"],
    markets: ["RU"],
  },
]);

export const bookEvidenceV2PublicHolds01RequiredAuthorityIds = Object.freeze([
  "azbooka",
  "booker-prize-foundation",
  "british-library",
  "broadview-press",
  "cambridge-university-press",
  "canongate",
  "david-mitchell-official",
  "eksmo",
  "harpercollins-us",
  "hodder-stoughton",
  "loc",
  "neb",
  "nlr",
  "orion-books",
  "penguin-random-house",
  "project-gutenberg",
  "rsl",
  "university-of-kent",
  "university-of-oxford",
  "yann-martel-official",
]);

export const bookEvidenceV2PublicHolds01RecordKeys = Object.freeze([
  lifeOfPiKey,
  sleeperKey,
  annVeronicaKey,
  ghostwrittenKey,
  number9DreamKey,
  boneClocksKey,
  sladeHouseKey,
]);

export const bookEvidenceV2PublicHolds01ResolvedRecordKeys =
  bookEvidenceV2PublicHolds01RecordKeys;

export const bookEvidenceV2PublicHolds01Holds = Object.freeze<
  BookEvidenceV2PublicHolds01Hold[]
>([]);

const targetRecordKeys = new Set(bookEvidenceV2PublicHolds01RecordKeys);

function fullTranslation(
  work: WorkProfile,
  overlay: FullOverlay,
  locale: WorkLocale
) {
  const existing = work.translations?.[locale] || {};
  const titleEvidenceProfile =
    locale === "ru" ? overlay.ruTitleEvidence : overlay.enTitleEvidence;
  const title = locale === "ru" ? overlay.ruTitle : overlay.enTitle;
  const description = overlay.description[locale];
  return {
    ...existing,
    locale,
    title,
    description,
    sourceLanguage: locale,
    status: "verified" as const,
    sourceUrls: [
      ...titleEvidenceProfile.evidence.map((evidence) => evidence.sourceUrl),
      ...overlay.description.sources.map((source) => source.url),
    ],
    method:
      locale === "ru"
        ? ("editorial-original" as const)
        : ("human-translation" as const),
    reviewedAt: checkedAt,
    titleEvidence: titleEvidenceProfile,
    descriptionProvenance: descriptionProvenance(locale, overlay.description),
  };
}

function applyFullOverlay(work: WorkProfile, overlay: FullOverlay) {
  const titleSources = [
    ...overlay.ruTitleEvidence.evidence,
    ...overlay.enTitleEvidence.evidence,
  ].map(titleSource);
  return {
    ...work,
    title: overlay.ruTitle,
    description: overlay.description.ru,
    translations: {
      ...work.translations,
      ru: fullTranslation(work, overlay, "ru"),
      en: fullTranslation(work, overlay, "en"),
    },
    localizedTitles: {
      ...work.localizedTitles,
      ru: overlay.ruTitleEvidence,
      en: overlay.enTitleEvidence,
    },
    sources: mergeSources(work.sources || [], [
      ...overlay.description.sources,
      ...titleSources,
    ]),
    editorial: {
      status: "verified" as const,
      reviewedAt: checkedAt,
    },
  };
}

function applyRuResolution(work: WorkProfile, resolution: RuResolution) {
  const ru = work.translations?.ru;
  const en = work.translations?.en;
  if (!ru?.descriptionProvenance || !en?.descriptionProvenance) {
    throw new Error(
      `book-evidence-v2-public-holds-01-description-baseline-missing:${resolution.recordKey}`
    );
  }
  const ruDescriptionUrls = ru.descriptionProvenance.sourceUrls;
  return {
    ...work,
    title: resolution.ruTitle,
    translations: {
      ...work.translations,
      ru: {
        ...ru,
        title: resolution.ruTitle,
        status: "verified" as const,
        reviewedAt: checkedAt,
        sourceUrls: [
          ...resolution.ruTitleEvidence.evidence.map(
            (evidence) => evidence.sourceUrl
          ),
          ...ruDescriptionUrls,
        ],
        titleEvidence: resolution.ruTitleEvidence,
      },
      en: {
        ...en,
        status: "verified" as const,
        reviewedAt: checkedAt,
      },
    },
    localizedTitles: {
      ...work.localizedTitles,
      ru: resolution.ruTitleEvidence,
    },
    sources: mergeSources(
      work.sources || [],
      resolution.ruTitleEvidence.evidence.map(titleSource)
    ),
    editorial: {
      status: "verified" as const,
      reviewedAt: checkedAt,
    },
  };
}

/**
 * Resolves the seven assigned fail-closed public cards at Work level. The two
 * predecessor batches are applied only for assigned records so this function
 * remains standalone, immutable, and identity-preserving for every other Work.
 */
export function applyBookEvidenceV2PublicHolds01Work(
  countryId: string,
  writerId: string,
  work: WorkProfile
): WorkProfile {
  const recordKey = `${countryId}:${writerId}:${work.id}`;
  if (!targetRecordKeys.has(recordKey)) return work;

  const baseline03 = applyBookEvidenceV2PublicBatch03Work(
    countryId,
    writerId,
    applyBookEvidenceV2PublicBatch02Work(countryId, writerId, work)
  );
  const fullOverlay = fullOverlays[recordKey];
  if (fullOverlay) return applyFullOverlay(baseline03, fullOverlay);

  const resolution = ruResolutions[recordKey];
  if (!resolution) {
    throw new Error(
      `book-evidence-v2-public-holds-01-overlay-missing:${recordKey}`
    );
  }
  return applyRuResolution(baseline03, resolution);
}
