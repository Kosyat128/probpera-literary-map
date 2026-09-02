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
  sourceLanguage: "ru" | "es";
  sourceCountry: "russia" | "spain";
  sources: DescriptionSource[];
};

type BatchOverlay = {
  recordKey: string;
  ruTitle: string;
  enTitle: string;
  description: ReviewedDescription;
  ruTitleEvidence: WorkLocalizedTitleProfile;
  enTitleEvidence?: WorkLocalizedTitleProfile;
};

export type BookEvidenceV2PublicBatch05Hold = {
  recordKey: string;
  status: "fail-closed";
  locale: "en";
  code: "en-exact-national-record-unresolved";
  candidateTitle: string;
  reason: string;
  reviewedCatalogs: Array<{
    authorityId: string;
    url: string;
    finding: string;
  }>;
  rejectedAggregateTitles: string[];
  resolutionCriteria: string[];
};

export type BookEvidenceV2PublicBatch05AuthorityDraft = {
  authorityId: string;
  provider: string;
  authorityCountryId: "russia" | "spain" | "usa";
  independenceGroup: string;
  tier: "A" | "B";
  allowedRoles: Array<
    "title-critical-edition" | "title-publisher" | "description-fact"
  >;
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
  evidence,
}: {
  recordKey: string;
  locale: WorkLocale;
  value: string;
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
    selectionRule: "current-complete-authorized-edition",
    selectionNote:
      locale === "ru"
        ? "Точное русское заглавие подтверждено записью национального каталога и независимой официальной издательской либо академической записью."
        : "The exact English title is supported by a Library of Congress record and an independent official publisher record.",
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
  country: "russia" | "spain";
  language: "ru" | "es";
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
    fields: ["identity", "authorship", "original-title", "description"],
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
      sourceCountry: description.sourceCountry,
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
    sourceCountry: description.sourceCountry,
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

function rslEvidence({
  record,
  title,
  isbn13,
  publisher,
  publicationYear,
  translator,
}: {
  record: string;
  title: string;
  isbn13?: string;
  publisher?: string;
  publicationYear?: number;
  translator?: string;
}) {
  return titleEvidence({
    manifestationId: `rsl-${record.replace(/^0+/u, "")}`,
    sourceUrl: `https://search.rsl.ru/ru/record/${record}`,
    provider: "Российская государственная библиотека",
    authorityId: "rsl",
    authorityTier: "A",
    recordKind: "national-bibliography",
    recordId: `RSL-${record}`,
    catalogTitleExact: title,
    locale: "ru",
    market: "RU",
    expressionLanguage: "ru",
    isbn13,
    publisher,
    publicationYear,
    translator,
  });
}

function publisherRuEvidence({
  manifestationId,
  url,
  provider,
  authorityId,
  recordId,
  title,
  isbn13,
  publisher,
  publicationYear,
  translator,
}: {
  manifestationId: string;
  url: string;
  provider: string;
  authorityId: "ast" | "azbooka" | "eksmo";
  recordId: string;
  title: string;
  isbn13?: string;
  publisher: string;
  publicationYear?: number;
  translator?: string;
}) {
  return titleEvidence({
    manifestationId,
    sourceUrl: url,
    provider,
    authorityId,
    authorityTier: "B",
    recordKind: "publisher-catalog",
    recordId,
    catalogTitleExact: title,
    locale: "ru",
    market: "RU",
    expressionLanguage: "ru",
    isbn13,
    publisher,
    publicationYear,
    translator,
  });
}

function locEvidence({
  lccn,
  title,
  isbn13,
  publisher,
  publicationYear,
}: {
  lccn: string;
  title: string;
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

const crimeKey = "russia:dostoevsky:crime-and-punishment";
const warKey = "russia:tolstoy:war-and-peace";
const duelKey = "russia:chekhov:the-duel";
const blackMonkKey = "russia:chekhov:the-black-monk";
const uncleVanyaKey = "russia:chekhov:uncle-vanya";
const manInCaseKey = "russia:chekhov:the-man-in-a-case";
const ladyWithDogKey = "russia:chekhov:the-lady-with-the-dog";
const donQuixoteKey =
  "spain:miguel_de_cervantes:openlibrary-works-ol15272537w";

const dostoevskyMuseumCrime = descriptionSource({
  provider: "Литературно-мемориальный музей Ф. М. Достоевского",
  authorityId: "dostoevsky-museum-spb",
  country: "russia",
  language: "ru",
  recordId: "exhibition-pereryt-vse-voprosy-v-etom-romane",
  url: "https://www.md.spb.ru/muzej/vystavki/pereryt_vse_voprosy_v_etom_romane/",
});
const astCrime = descriptionSource({
  provider: "Издательство АСТ",
  authorityId: "ast",
  country: "russia",
  language: "ru",
  recordId: "ISBN-9785171563202",
  url: "https://ast.ru/book/prestuplenie-i-nakazanie-872869/",
});
const tolstoyMuseumWar = descriptionSource({
  provider: "Государственный музей Л. Н. Толстого",
  authorityId: "tolstoy-museum",
  country: "russia",
  language: "ru",
  recordId: "creativity-fiction-1071",
  url: "https://tolstoy.ru/creativity/fiction/1071/",
});
const azbookaWar = descriptionSource({
  provider: "Азбука-Аттикус",
  authorityId: "azbooka",
  country: "russia",
  language: "ru",
  recordId: "ISBN-9785389062566",
  url: "https://azbooka.ru/books/voyna-i-mir-oqzy",
});

function febSource(recordId: string, url: string) {
  return descriptionSource({
    provider: "Фундаментальная электронная библиотека",
    authorityId: "feb-web",
    country: "russia",
    language: "ru",
    recordId,
    url,
  });
}

function chekhovMuseumSource(recordId: string, url: string) {
  return descriptionSource({
    provider: "Музей-заповедник А. П. Чехова «Мелихово»",
    authorityId: "chekhov-museum-melikhovo",
    country: "russia",
    language: "ru",
    recordId,
    url,
  });
}

const febDuel = febSource(
  "chekhov-pss-volume-7-pages-353-455",
  "https://feb-web.ru/feb/chekhov/texts/sp0/sp7/sp7-353-.htm?cmd=p"
);
const museumDuel = chekhovMuseumSource(
  "theater-archive-1708",
  "https://chekhovmuseum.com/theater/archive/1708"
);
const febBlackMonk = febSource(
  "chekhov-pss-volume-8-pages-226-257",
  "https://feb-web.ru/feb/chekhov/texts/sp0/sp8/sp8-226-.htm?cmd=p"
);
const museumBlackMonk = chekhovMuseumSource(
  "theater-repertoire-366",
  "https://chekhovmuseum.com/theater/repertoire/366"
);
const febUncleVanya = febSource(
  "chekhov-pss-volume-13-pages-61-116",
  "https://feb-web.ru/feb/chekhov/texts/sp0/spd/spd-061-.htm?cmd=p"
);
const museumUncleVanya = chekhovMuseumSource(
  "theater-repertoire-381",
  "https://chekhovmuseum.com/theater/repertoire/381"
);
const febManInCase = febSource(
  "chekhov-pss-volume-10-pages-42-54",
  "https://feb-web.ru/feb/chekhov/texts/sp0/spa/spa-042-.htm?cmd=p"
);
const museumManInCase = chekhovMuseumSource(
  "almanac-1999-futlyar-kryzhovnik-i-lyubov",
  "https://api.chekhovmuseum.com/upload/iblock/485/rnam3ggpfv8mh6h1bzutetwqdptcv0rf/ALMANAH_1999_g..pdf"
);
const febLadyWithDog = febSource(
  "chekhov-pss-volume-10-pages-128-143",
  "https://feb-web.ru/feb/chekhov/texts/sp0/spa/spa-128-.htm?cmd=p"
);
const museumLadyWithDog = chekhovMuseumSource(
  "festival-melikhovo-4702-4847",
  "https://chekhovmuseum.com/festivals/melikhovo/other-years/4702/4847"
);
const bneDonQuixote = descriptionSource({
  provider: "Biblioteca Nacional de España",
  authorityId: "bne",
  authorityTier: "A",
  country: "spain",
  language: "es",
  recordId: "colecciones-cervantes-ingenioso-hidalgo-don-quixote-mancha",
  url: "https://www.bne.es/es/colecciones/cervantes/ingenioso-hidalgo-don-quixote-mancha",
});
const institutoCervantesDonQuixote = descriptionSource({
  provider: "Instituto Cervantes, Centro Virtual Cervantes",
  authorityId: "instituto-cervantes",
  country: "spain",
  language: "es",
  recordId: "ele-canon-secuencias-didacticas-5",
  url: "https://cvc.cervantes.es/ensenanza/biblioteca_ele/ele_canon/secuencias_didacticas_5.htm",
});

const overlays: Record<string, BatchOverlay> = {
  [crimeKey]: {
    recordKey: crimeKey,
    ruTitle: "Преступление и наказание",
    enTitle: "Crime and Punishment",
    description: {
      ru: "Петербургский студент Родион Раскольников совершает убийство, пытаясь проверить теорию о праве «необыкновенного» человека переступить нравственный закон. Следствие Порфирия Петровича, мучительное чувство вины и близость Сони Мармеладовой превращают сюжет преступления в исследование самообмана, ответственности и возможности внутреннего возрождения.",
      en: "Rodion Raskolnikov, a student in Saint Petersburg, commits murder in an attempt to test his theory that an “extraordinary” person may transgress moral law. Porfiry Petrovich’s investigation, Raskolnikov’s tormenting guilt, and his bond with Sonya Marmeladova turn the crime story into an examination of self-deception, responsibility, and the possibility of inner renewal.",
      ruSha256:
        "f2fb84727fb2f3cdd6a43926fe3ff68df28cfe986c47456bd102dab35cbb4575",
      sourceLanguage: "ru",
      sourceCountry: "russia",
      sources: [dostoevskyMuseumCrime, astCrime],
    },
    ruTitleEvidence: localizedTitle({
      recordKey: crimeKey,
      locale: "ru",
      value: "Преступление и наказание",
      evidence: [
        rslEvidence({
          record: "01009468476",
          title: "Преступление и наказание",
          isbn13: "9785171059033",
          publisher: "АСТ",
          publicationYear: 2018,
        }),
        publisherRuEvidence({
          manifestationId: "isbn-9785171563202",
          url: "https://ast.ru/book/prestuplenie-i-nakazanie-872869/",
          provider: "Издательство АСТ",
          authorityId: "ast",
          recordId: "ISBN-9785171563202",
          title: "Преступление и наказание",
          isbn13: "9785171563202",
          publisher: "АСТ",
        }),
      ],
    }),
    enTitleEvidence: localizedTitle({
      recordKey: crimeKey,
      locale: "en",
      value: "Crime and Punishment",
      evidence: [
        locEvidence({
          lccn: "2014033003",
          title: "Crime and Punishment",
          isbn13: "9780143107637",
          publisher: "Penguin Books",
          publicationYear: 2015,
        }),
        prhEvidence({
          workId: "318117",
          slug: "crime-and-punishment-by-fyodor-dostoyevsky-translated-with-an-introduction-and-notes-by-oliver-ready-cover-by-zohar-lazar",
          title: "Crime and Punishment",
          isbn13: "9780143107637",
          publisher: "Penguin Classics",
          publicationYear: 2015,
        }),
      ],
    }),
  },
  [warKey]: {
    recordKey: warKey,
    ruTitle: "Война и мир",
    enTitle: "War and Peace",
    description: {
      ru: "На фоне войн России с Наполеоном роман соединяет судьбы Ростовых, Болконских и Безухова с масштабной картиной дворянского общества начала XIX века. Семейная хроника, батальные эпизоды и философские отступления образуют размышление о любви, взрослении, свободе воли и действии исторических сил.",
      en: "Against the background of Russia’s wars with Napoleon, the novel interweaves the lives of the Rostovs, the Bolkonskys, and Pierre Bezukhov with a sweeping portrait of aristocratic society in the early nineteenth century. Its family chronicle, battle scenes, and philosophical digressions form a meditation on love, coming of age, free will, and the workings of historical forces.",
      ruSha256:
        "d455c12c5398d5c368149321423f8d01386ce6809a6ed835d9c859cc0864064f",
      sourceLanguage: "ru",
      sourceCountry: "russia",
      sources: [tolstoyMuseumWar, azbookaWar],
    },
    ruTitleEvidence: localizedTitle({
      recordKey: warKey,
      locale: "ru",
      value: "Война и мир",
      evidence: [
        rslEvidence({
          record: "01004742850",
          title: "Война и мир",
          isbn13: "9785699353019",
          publisher: "Эксмо",
          publicationYear: 2009,
        }),
        publisherRuEvidence({
          manifestationId: "isbn-9785389062566",
          url: "https://azbooka.ru/books/voyna-i-mir-oqzy",
          provider: "Азбука-Аттикус",
          authorityId: "azbooka",
          recordId: "ISBN-9785389062566",
          title: "Война и мир",
          isbn13: "9785389062566",
          publisher: "Азбука",
          publicationYear: 2013,
        }),
      ],
    }),
    enTitleEvidence: localizedTitle({
      recordKey: warKey,
      locale: "en",
      value: "War and Peace",
      evidence: [
        locEvidence({
          lccn: "93038836",
          title: "War and Peace",
          isbn13: "9780679600848",
          publisher: "Modern Library",
          publicationYear: 1994,
        }),
        prhEvidence({
          workId: "179305",
          slug: "war-and-peace-by-leo-tolstoy",
          title: "War and Peace",
          isbn13: "9780375760648",
          publisher: "Modern Library",
          publicationYear: 2002,
        }),
      ],
    }),
  },
  [duelKey]: {
    recordKey: duelKey,
    ruTitle: "Дуэль",
    enTitle: "The Duel",
    description: {
      ru: "В приморском кавказском городе чиновник Лаевский мечтает покинуть Надежду Фёдоровну и начать жизнь заново, а зоолог фон Корен видит в его безволии нравственную опасность. Их противостояние приводит к дуэли, через которую Чехов исследует ответственность, предубеждение и возможность человека измениться.",
      en: "In a seaside town in the Caucasus, the civil servant Laevsky dreams of leaving Nadezhda Fyodorovna and beginning anew, while the zoologist Von Koren regards his weakness of will as a moral danger. Their antagonism leads to a duel through which Chekhov examines responsibility, prejudice, and a person’s capacity to change.",
      ruSha256:
        "756d9b78de6a05347d79a1583d66059f747f662103ecf5f9d2c1ab497feb5867",
      sourceLanguage: "ru",
      sourceCountry: "russia",
      sources: [febDuel, museumDuel],
    },
    ruTitleEvidence: localizedTitle({
      recordKey: duelKey,
      locale: "ru",
      value: "Дуэль",
      evidence: [
        rslEvidence({
          record: "01007876412",
          title: "Дуэль",
          isbn13: "9785699779352",
          publisher: "Эксмо",
          publicationYear: 2015,
        }),
        publisherRuEvidence({
          manifestationId: "isbn-9785699779352",
          url: "https://eksmo.ru/book/duel-ITD589222/",
          provider: "Эксмо",
          authorityId: "eksmo",
          recordId: "ISBN-9785699779352",
          title: "Дуэль",
          isbn13: "9785699779352",
          publisher: "Эксмо",
          publicationYear: 2015,
        }),
      ],
    }),
    enTitleEvidence: localizedTitle({
      recordKey: duelKey,
      locale: "en",
      value: "The Duel",
      evidence: [
        locEvidence({
          lccn: "2003051031",
          title: "The Duel",
          isbn13: "9780812970081",
          publisher: "Modern Library",
          publicationYear: 2003,
        }),
        prhEvidence({
          workId: "26691",
          slug: "the-duel-by-anton-chekhov/9780812970081",
          title: "The Duel",
          isbn13: "9780812970081",
          publisher: "Modern Library",
          publicationYear: 2003,
        }),
      ],
    }),
  },
  [blackMonkKey]: {
    recordKey: blackMonkKey,
    ruTitle: "Черный монах",
    enTitle: "The Black Monk",
    description: {
      ru: "Учёный Андрей Коврин приезжает в усадьбу Егора Песоцкого и начинает видеть чёрного монаха, уверяющего его в гениальности и особом предназначении. Видение подпитывает гордость героя, а попытка близких вернуть его к обычной жизни связывает тему творческой исключительности с болезнью и разрушением отношений.",
      en: "The scholar Andrey Kovrin visits Yegor Pesotsky’s estate and begins to see a black monk who assures him of his genius and special destiny. The vision feeds Kovrin’s pride, while his family’s attempt to restore him to ordinary life links his belief in artistic exceptionalism with illness and the destruction of relationships.",
      ruSha256:
        "22c8c4796c6bf9dcd0d24d49d414a39d3ffb51b284b3c461370d10cfba8a63c9",
      sourceLanguage: "ru",
      sourceCountry: "russia",
      sources: [febBlackMonk, museumBlackMonk],
    },
    ruTitleEvidence: localizedTitle({
      recordKey: blackMonkKey,
      locale: "ru",
      value: "Черный монах",
      evidence: [
        titleEvidence({
          manifestationId: "neb-art-085110fe-be68-4554-91bf-453a8196b1da",
          sourceUrl:
            "https://rusneb.ru/catalog/010000_000060_ART-085110fe-be68-4554-91bf-453a8196b1da/",
          provider: "Национальная электронная библиотека",
          authorityId: "neb",
          authorityTier: "A",
          recordKind: "national-bibliography",
          recordId:
            "NEB-010000_000060_ART-085110fe-be68-4554-91bf-453a8196b1da",
          catalogTitleExact: "Черный монах",
          locale: "ru",
          market: "RU",
          expressionLanguage: "ru",
        }),
        publisherRuEvidence({
          manifestationId: "isbn-9785171583934",
          url: "https://ast.ru/book/chernyy-monakh-875027/",
          provider: "Издательство АСТ",
          authorityId: "ast",
          recordId: "ISBN-9785171583934",
          title: "Черный монах",
          isbn13: "9785171583934",
          publisher: "АСТ",
        }),
      ],
    }),
  },
  [uncleVanyaKey]: {
    recordKey: uncleVanyaKey,
    ruTitle: "Дядя Ваня",
    enTitle: "Uncle Vanya",
    description: {
      ru: "Войницкий и Соня много лет ведут хозяйство в имении профессора Серебрякова, но его приезд с молодой женой обнажает безответную любовь, усталость и ощущение напрасно прожитой жизни. Бытовой конфликт вокруг усадьбы становится драмой о несбывшихся возможностях, труде и стойкости, с которой герои возвращаются к повседневным обязанностям.",
      en: "Voinitsky and Sonya have managed Professor Serebryakov’s estate for many years, but his arrival with his young wife exposes unrequited love, exhaustion, and the sense of a life wasted. A domestic conflict over the estate becomes a drama of unrealized possibilities, work, and the endurance with which the characters return to their daily duties.",
      ruSha256:
        "1989b47afb305ea161ffa6cd6b6b250f5383c97f290d5c42692564201b4e46a9",
      sourceLanguage: "ru",
      sourceCountry: "russia",
      sources: [febUncleVanya, museumUncleVanya],
    },
    ruTitleEvidence: localizedTitle({
      recordKey: uncleVanyaKey,
      locale: "ru",
      value: "Дядя Ваня",
      evidence: [
        rslEvidence({
          record: "01004740311",
          title: "Дядя Ваня",
          publicationYear: 1902,
        }),
        titleEvidence({
          manifestationId: "feb-chekhov-pss-v13-1978",
          sourceUrl:
            "https://feb-web.ru/feb/chekhov/texts/sp0/spd/spd-061-.htm?cmd=p",
          provider: "Фундаментальная электронная библиотека",
          authorityId: "feb-web",
          authorityTier: "B",
          recordKind: "critical-edition",
          recordId: "CHEKHOV-PSS-V13-1978-PP61-116",
          catalogTitleExact: "Дядя Ваня",
          locale: "ru",
          market: "RU",
          expressionLanguage: "ru",
          publisher: "Наука",
          publicationYear: 1978,
          editionStatement:
            "Полное собрание сочинений и писем в 30 томах, том 13",
        }),
      ],
    }),
    enTitleEvidence: localizedTitle({
      recordKey: uncleVanyaKey,
      locale: "en",
      value: "Uncle Vanya",
      evidence: [
        locEvidence({
          lccn: "88021455",
          title: "Uncle Vanya",
          isbn13: "9780802131515",
          publisher: "Grove Press",
          publicationYear: 1989,
        }),
        titleEvidence({
          manifestationId: "isbn-9780802131515",
          sourceUrl: "https://groveatlantic.com/book/uncle-vanya/",
          provider: "Grove Atlantic",
          authorityId: "grove-atlantic",
          authorityTier: "B",
          recordKind: "publisher-catalog",
          recordId: "ISBN-9780802131515",
          catalogTitleExact: "Uncle Vanya",
          locale: "en",
          market: "US",
          expressionLanguage: "en",
          isbn13: "9780802131515",
          publisher: "Grove Press",
          publicationYear: 1989,
        }),
      ],
    }),
  },
  [manInCaseKey]: {
    recordKey: manInCaseKey,
    ruTitle: "Человек в футляре",
    enTitle: "The Man in a Case",
    description: {
      ru: "Учитель Беликов стремится оградить себя от жизни правилами, запретами и буквальными футлярами, а его тревожная осторожность постепенно подчиняет целый провинциальный город. Рассказ показывает, как личный страх перед свободой превращается в общественный способ существования и продолжает действовать после смерти его носителя.",
      en: "The schoolteacher Belikov seeks to shield himself from life with rules, prohibitions, and protective coverings, while his anxious caution gradually subjects an entire provincial town to its influence. The story shows how a private fear of freedom becomes a collective way of life and continues to operate after the death of the person who embodied it.",
      ruSha256:
        "ca16d114d0b66233d127be4feb35ed2aea5526120d6716cc761cb06d0ca22a0d",
      sourceLanguage: "ru",
      sourceCountry: "russia",
      sources: [febManInCase, museumManInCase],
    },
    ruTitleEvidence: localizedTitle({
      recordKey: manInCaseKey,
      locale: "ru",
      value: "Человек в футляре",
      evidence: [
        rslEvidence({
          record: "01008819706",
          title: "Человек в футляре",
          isbn13: "9785699918614",
          publisher: "Эксмо",
          publicationYear: 2016,
        }),
        publisherRuEvidence({
          manifestationId: "isbn-9785699918614",
          url: "https://eksmo.ru/book/chelovek-v-futlyare-ITD827502/",
          provider: "Эксмо",
          authorityId: "eksmo",
          recordId: "ISBN-9785699918614",
          title: "Человек в футляре",
          isbn13: "9785699918614",
          publisher: "Эксмо",
          publicationYear: 2016,
        }),
      ],
    }),
  },
  [ladyWithDogKey]: {
    recordKey: ladyWithDogKey,
    ruTitle: "Дама с собачкой",
    enTitle: "The Lady with the Dog",
    description: {
      ru: "Курортное знакомство москвича Дмитрия Гурова и Анны Сергеевны в Ялте перерастает в чувство, которое не укладывается в их семейную и общественную жизнь. Чехов переносит внимание с тайного романа на внутреннее пробуждение героев и оставляет их перед трудным, ещё не найденным решением.",
      en: "A holiday acquaintance between the Muscovite Dmitry Gurov and Anna Sergeyevna in Yalta develops into a love that cannot be accommodated within their family and social lives. Chekhov shifts attention from the clandestine affair to the characters’ inner awakening and leaves them facing a difficult solution they have yet to find.",
      ruSha256:
        "9ba9862a3122eeadebf669463111513c7de8c2198b21c322bc49d265472f4809",
      sourceLanguage: "ru",
      sourceCountry: "russia",
      sources: [febLadyWithDog, museumLadyWithDog],
    },
    ruTitleEvidence: localizedTitle({
      recordKey: ladyWithDogKey,
      locale: "ru",
      value: "Дама с собачкой",
      evidence: [
        rslEvidence({
          record: "01008896511",
          title: "Дама с собачкой",
          isbn13: "9785170918775",
          publisher: "АСТ",
          publicationYear: 2017,
        }),
        publisherRuEvidence({
          manifestationId: "isbn-9785171473068",
          url: "https://ast.ru/book/dama-s-sobachkoy-863459/",
          provider: "Издательство АСТ",
          authorityId: "ast",
          recordId: "ISBN-9785171473068",
          title: "Дама с собачкой",
          isbn13: "9785171473068",
          publisher: "АСТ",
        }),
      ],
    }),
  },
  [donQuixoteKey]: {
    recordKey: donQuixoteKey,
    ruTitle: "Дон Кихот",
    enTitle: "Don Quixote",
    description: {
      ru: "Начитавшийся рыцарских романов ламанчский идальго принимает имя Дон Кихот и отправляется восстанавливать справедливость вместе с рассудительным оруженосцем Санчо Пансой. Комические столкновения книжного идеала с повседневной действительностью складываются в многослойное размышление о чтении, воображении, свободе и человеческом достоинстве.",
      en: "After reading too many romances of chivalry, a gentleman from La Mancha takes the name Don Quixote and sets out to restore justice with his practical squire, Sancho Panza. The comic collisions between a literary ideal and everyday reality become a multilayered meditation on reading, imagination, freedom, and human dignity.",
      ruSha256:
        "5a9c851a7b3ef910d9d96d306d10dcc71ff2fe01aca373697c8f31a398bf780b",
      sourceLanguage: "es",
      sourceCountry: "spain",
      sources: [bneDonQuixote, institutoCervantesDonQuixote],
    },
    ruTitleEvidence: localizedTitle({
      recordKey: donQuixoteKey,
      locale: "ru",
      value: "Дон Кихот",
      evidence: [
        rslEvidence({
          record: "01006520846",
          title: "Дон Кихот",
          isbn13: "9785367013108",
          publisher: "Амфора",
          publicationYear: 2013,
          translator: "Б. М. Энгельгардт",
        }),
        publisherRuEvidence({
          manifestationId: "isbn-9785171707491",
          url: "https://ast.ru/book/don-kikhot-886530/",
          provider: "Издательство АСТ",
          authorityId: "ast",
          recordId: "ISBN-9785171707491",
          title: "Дон Кихот",
          isbn13: "9785171707491",
          publisher: "АСТ",
          translator: "Борис Энгельгардт",
        }),
      ],
    }),
    enTitleEvidence: localizedTitle({
      recordKey: donQuixoteKey,
      locale: "en",
      value: "Don Quixote",
      evidence: [
        locEvidence({
          lccn: "2012533105",
          title: "Don Quixote",
          isbn13: "9780451532299",
          publisher: "Signet Classic",
          publicationYear: 2013,
        }),
        prhEvidence({
          workId: "286572",
          slug: "don-quixote-by-miguel-de-cervantes-saavedra-translated-with-notes-by-john-rutherford-introduction-by-roberto-gonzalez-echevarria",
          title: "Don Quixote",
          isbn13: "9780142437230",
          publisher: "Penguin Classics",
          publicationYear: 2003,
        }),
      ],
    }),
  },
};

function heldEnTitle(
  recordKey: string,
  candidateTitle: string,
  rejectedAggregateTitles: string[]
): BookEvidenceV2PublicBatch05Hold {
  return {
    recordKey,
    status: "fail-closed",
    locale: "en",
    code: "en-exact-national-record-unresolved",
    candidateTitle,
    reason:
      "The reviewed national and publisher catalogs did not yield two independent manifestation records whose catalog title exactly matches the standalone English display title. Aggregate collection titles are not treated as evidence for a standalone manifestation.",
    reviewedCatalogs: [
      {
        authorityId: "loc",
        url: "https://catalog.loc.gov/",
        finding: "No adjudicated exact-title standalone manifestation was established.",
      },
      {
        authorityId: "penguin-random-house",
        url: "https://www.penguinrandomhouse.com/books/",
        finding: "Reviewed publisher results were absent or aggregate collections.",
      },
    ],
    rejectedAggregateTitles,
    resolutionCriteria: [
      `Locate a direct stable Tier A national or legal-deposit record whose principal manifestation title is exactly “${candidateTitle}”.`,
      "Verify the record language, market, publisher, year, and identifiers from the record itself rather than from a search snippet.",
      "Match it with an independent official publisher or rights-holder record carrying the same exact standalone title before adding verified-published EN evidence.",
    ],
  };
}

export const bookEvidenceV2PublicBatch05Holds = Object.freeze([
  heldEnTitle(blackMonkKey, "The Black Monk", [
    "The Black Monk, and Other Stories",
  ]),
  heldEnTitle(manInCaseKey, "The Man in a Case", [
    "Selected Stories of Anton Chekhov",
  ]),
  heldEnTitle(ladyWithDogKey, "The Lady with the Dog", [
    "The Lady with the Dog and Other Stories",
    "The Lady with the Little Dog and Other Stories",
  ]),
]);

export const bookEvidenceV2PublicBatch05AuthorityDrafts = Object.freeze<
  BookEvidenceV2PublicBatch05AuthorityDraft[]
>([
  {
    authorityId: "feb-web",
    provider: "fundamental-electronic-library-russian-literature-and-folklore",
    authorityCountryId: "russia",
    independenceGroup:
      "fundamental-electronic-library-russian-literature-and-folklore",
    tier: "B",
    allowedRoles: ["title-critical-edition", "description-fact"],
    domains: ["feb-web.ru"],
    markets: ["RU"],
  },
  {
    authorityId: "dostoevsky-museum-spb",
    provider: "dostoevsky-museum-saint-petersburg",
    authorityCountryId: "russia",
    independenceGroup: "dostoevsky-museum-saint-petersburg",
    tier: "B",
    allowedRoles: ["description-fact"],
    domains: ["md.spb.ru"],
    markets: [],
  },
  {
    authorityId: "tolstoy-museum",
    provider: "state-museum-of-leo-tolstoy",
    authorityCountryId: "russia",
    independenceGroup: "state-museum-of-leo-tolstoy",
    tier: "B",
    allowedRoles: ["description-fact"],
    domains: ["tolstoy.ru"],
    markets: [],
  },
  {
    authorityId: "chekhov-museum-melikhovo",
    provider: "chekhov-museum-reserve-melikhovo",
    authorityCountryId: "russia",
    independenceGroup: "chekhov-museum-reserve-melikhovo",
    tier: "B",
    allowedRoles: ["description-fact"],
    domains: ["chekhovmuseum.com"],
    markets: [],
  },
  {
    authorityId: "bne",
    provider: "biblioteca-nacional-de-espana",
    authorityCountryId: "spain",
    independenceGroup: "biblioteca-nacional-de-espana",
    tier: "A",
    allowedRoles: ["description-fact"],
    domains: ["bne.es"],
    markets: [],
  },
  {
    authorityId: "instituto-cervantes",
    provider: "instituto-cervantes",
    authorityCountryId: "spain",
    independenceGroup: "instituto-cervantes",
    tier: "B",
    allowedRoles: ["description-fact"],
    domains: ["cervantes.es"],
    markets: [],
  },
  {
    authorityId: "grove-atlantic",
    provider: "grove-atlantic-publishing",
    authorityCountryId: "usa",
    independenceGroup: "grove-atlantic-publishing",
    tier: "B",
    allowedRoles: ["title-publisher"],
    domains: ["groveatlantic.com"],
    markets: ["US"],
  },
]);

export const bookEvidenceV2PublicBatch05RequiredAuthorityIds = Object.freeze([
  "ast",
  "azbooka",
  "bne",
  "chekhov-museum-melikhovo",
  "dostoevsky-museum-spb",
  "eksmo",
  "feb-web",
  "grove-atlantic",
  "instituto-cervantes",
  "loc",
  "neb",
  "penguin-random-house",
  "rsl",
  "tolstoy-museum",
]);

export const bookEvidenceV2PublicBatch05ResolvedRecordKeys = Object.freeze(
  Object.values(overlays)
    .filter((overlay) => overlay.enTitleEvidence)
    .map((overlay) => overlay.recordKey)
);

export const bookEvidenceV2PublicBatch05RecordKeys = Object.freeze(
  Object.keys(overlays)
);

function withoutCanon(work: WorkProfile) {
  const copy = { ...work };
  delete copy.canon;
  return copy;
}

function withoutEnLocalizedTitle(
  localizedTitles: WorkProfile["localizedTitles"]
) {
  const copy = { ...(localizedTitles || {}) };
  delete copy.en;
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
  const titleUrls = titleEvidenceProfile?.evidence.map(
    (evidence) => evidence.sourceUrl
  );
  const descriptionUrls = overlay.description.sources.map(
    (source) => source.url
  );
  return {
    ...existing,
    locale,
    title: locale === "ru" ? overlay.ruTitle : overlay.enTitle,
    description: overlay.description[locale],
    sourceLanguage: locale,
    status: verified ? ("verified" as const) : ("reviewed" as const),
    sourceUrls: [...new Set([...(titleUrls || []), ...descriptionUrls])],
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
  const verified = Boolean(overlay.enTitleEvidence);
  const base = withoutCanon(work);
  const evidence = [
    ...overlay.ruTitleEvidence.evidence,
    ...(overlay.enTitleEvidence?.evidence || []),
  ];
  const localizedTitles = overlay.enTitleEvidence
    ? {
        ...base.localizedTitles,
        ru: overlay.ruTitleEvidence,
        en: overlay.enTitleEvidence,
      }
    : {
        ...withoutEnLocalizedTitle(base.localizedTitles),
        ru: overlay.ruTitleEvidence,
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
      ...overlay.description.sources,
      ...evidence.map(titleSource),
    ]),
    editorial: {
      status: verified ? "verified" : "reviewed",
      reviewedAt: checkedAt,
    },
  };
}

/** Applies one batch overlay after canonical candidate merging. */
export function applyBookEvidenceV2PublicBatch05Work(
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
export function applyBookEvidenceV2PublicBatch05(
  countries: Country[]
): Country[] {
  const seen = new Map<string, number>(
    bookEvidenceV2PublicBatch05RecordKeys.map((recordKey) => [recordKey, 0])
  );
  const result = countries.map((country) => ({
    ...country,
    writers: country.writers.map((writer) => ({
      ...writer,
      workDetails: writer.workDetails?.map((work) => {
        const recordKey = `${country.id}:${writer.id}:${work.id}`;
        if (!overlays[recordKey]) return work;
        seen.set(recordKey, (seen.get(recordKey) || 0) + 1);
        return applyBookEvidenceV2PublicBatch05Work(
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
      `book-evidence-v2-public-batch-05-target-cardinality:${cardinalityErrors
        .map(([recordKey, count]) => `${recordKey}=${count}`)
        .join(",")}`
    );
  }
  return result;
}
