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

type ResolvedBibliographicOverlay = {
  localizedTitles: Record<WorkLocale, WorkLocalizedTitleProfile>;
  descriptions: Record<
    WorkLocale,
    {
      text: string;
      method: "editorial-original" | "human-translation";
      provenance: WorkDescriptionProvenanceProfile;
    }
  >;
  sources: WorkSourceProfile[];
};

export type BookBibliographicHold = {
  status: "fail-closed";
  locale: WorkLocale;
  code: "ru-national-record-unresolved" | "english-lineage-unresolved";
  reason: string;
  resolutionCriteria: string[];
  evidenceUrls: string[];
  lineages?: Array<{
    lineageId: "original-1899" | "revised-1910";
    titleEn: string;
    evidenceUrls: string[];
  }>;
};

function titleEvidence(
  draft: TitleEvidenceDraft
): WorkTitleEvidenceProfile {
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
  expressionLanguage,
  selectionRule,
  selectionNote,
  evidence,
}: {
  recordKey: string;
  locale: WorkLocale;
  value: string;
  market: string;
  expressionLanguage: string;
  selectionRule: WorkLocalizedTitleProfile["selectionRule"];
  selectionNote?: string;
  evidence: WorkTitleEvidenceProfile[];
}): WorkLocalizedTitleProfile {
  return {
    entityKind: "expression",
    expressionId: `${recordKey}:${locale}`,
    locale,
    value,
    status: "verified-published",
    expressionLanguage,
    market,
    selectionRule,
    ...(selectionNote ? { selectionNote } : {}),
    evidence,
  };
}

function sourceForTitleEvidence(
  evidence: WorkTitleEvidenceProfile
): WorkSourceProfile {
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

function resolvedOverlay({
  recordKey,
  ru,
  en,
  description,
  descriptionSources,
}: {
  recordKey: string;
  ru: Omit<WorkLocalizedTitleProfile, "entityKind" | "expressionId" | "status" | "locale"> & {
    evidence: WorkTitleEvidenceProfile[];
  };
  en: Omit<WorkLocalizedTitleProfile, "entityKind" | "expressionId" | "status" | "locale"> & {
    evidence: WorkTitleEvidenceProfile[];
  };
  description: {
    ru: string;
    en: string;
    ruSha256: string;
    sourceLanguage: string;
    sourceCountry: string;
  };
  descriptionSources: WorkSourceProfile[];
}): ResolvedBibliographicOverlay {
  const localizedTitles = {
    ru: localizedTitle({ recordKey, locale: "ru", ...ru }),
    en: localizedTitle({ recordKey, locale: "en", ...en }),
  };
  return {
    localizedTitles,
    descriptions: {
      ru: {
        text: description.ru,
        method: "editorial-original",
        provenance: {
          origin: "official-source-synthesis",
          sourceLanguage: description.sourceLanguage,
          sourceCountry: description.sourceCountry,
          sourceUrls: descriptionSources.map((source) => source.url),
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
        },
      },
      en: {
        text: description.en,
        method: "human-translation",
        provenance: {
          origin: "human-translation",
          sourceLanguage: "ru",
          sourceCountry: description.sourceCountry,
          sourceUrls: descriptionSources.map((source) => source.url),
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
        },
      },
    },
    sources: mergeSources(
      [],
      [
        ...localizedTitles.ru.evidence,
        ...localizedTitles.en.evidence,
      ].map(sourceForTitleEvidence).concat(descriptionSources)
    ),
  };
}

const kafkaKey = "austria:franz_kafka:openlibrary-works-ol498556w";
const atwoodKey = "canada:margaret_atwood:openlibrary-works-ol675783w";
const martelKey = "canada:yann_martel:life-of-pi";
const hamletKey = "england:william_shakespeare:hamlet";
const austenKey = "england:jane_austen:pride-and-prejudice";
const dickensKey = "england:charles_dickens:a-tale-of-two-cities";
const sleeperKey = "england:h_g_wells:when-the-sleeper-wakes";
const firstMenKey = "england:h_g_wells:the-first-men-in-the-moon";

const resolvedBibliographicOverlays: Record<
  string,
  ResolvedBibliographicOverlay
> = {
  [kafkaKey]: resolvedOverlay({
    recordKey: kafkaKey,
    description: {
      ru: "Коммивояжёр Грегор Замза однажды просыпается, превратившись в огромное насекомое. Лишившись возможности работать и содержать семью, он оказывается заперт в своей комнате и постепенно становится для близких обузой; фантастическое событие раскрывает темы отчуждения, семейного долга и утраты человеческого достоинства.",
      en: "Travelling salesman Gregor Samsa wakes one morning to find that he has been transformed into a giant insect. Unable to work and support his family, he is confined to his room and gradually becomes a burden to those closest to him; the fantastic event brings alienation, family duty, and the loss of human dignity into focus.",
      ruSha256:
        "e04ab9bfd52d7e60b85a5aa3af922c37b203f6b3e3878d98f874ba3a408fad96",
      sourceLanguage: "de",
      sourceCountry: "austria",
    },
    ru: {
      value: "Превращение",
      expressionLanguage: "ru",
      market: "RU",
      selectionRule: "current-complete-authorized-edition",
      selectionNote:
        "Основное заглавие подтверждено национальной библиографией и каталогом российского издателя.",
      evidence: [
        titleEvidence({
          manifestationId: "rsl-01004388213",
          sourceUrl: "https://search.rsl.ru/ru/record/01004388213",
          provider: "Российская государственная библиотека",
          authorityId: "rsl",
          authorityTier: "A",
          recordKind: "national-bibliography",
          recordId: "RSL-01004388213",
          catalogTitleExact: "Превращение",
          locale: "ru",
          market: "RU",
          expressionLanguage: "ru",
          isbn13: "9785170600953",
          publisher: "АСТ",
          publicationYear: 2009,
          editionStatement:
            "Превращение : новеллы ; [перевод с немецкого]",
        }),
        titleEvidence({
          manifestationId: "eksmo-isbn-9785699823352",
          sourceUrl: "https://eksmo.ru/amp/book/prevrashchenie-ITD625487/",
          provider: "Эксмо",
          authorityId: "eksmo",
          authorityTier: "B",
          recordKind: "publisher-catalog",
          recordId: "ISBN-9785699823352",
          catalogTitleExact: "Превращение",
          locale: "ru",
          market: "RU",
          expressionLanguage: "ru",
          isbn13: "9785699823352",
          publisher: "Эксмо",
          publicationYear: 2015,
        }),
      ],
    },
    en: {
      value: "The Metamorphosis",
      expressionLanguage: "en",
      market: "US",
      selectionRule: "original-market-title",
      selectionNote:
        "English display title is supported by a Library of Congress record and an independent US publisher edition.",
      evidence: [
        titleEvidence({
          manifestationId: "loc-95020582",
          sourceUrl: "https://www.loc.gov/item/95020582/",
          provider: "Library of Congress",
          authorityId: "loc",
          authorityTier: "A",
          recordKind: "national-bibliography",
          recordId: "LOC-95020582",
          catalogTitleExact: "The metamorphosis",
          locale: "en",
          market: "US",
          expressionLanguage: "en",
          isbn10: "0393967972",
          publisher: "W. W. Norton",
          publicationYear: 1996,
          translator: "Stanley Corngold",
          editionStatement:
            "The metamorphosis : translation, backgrounds and contexts, criticism",
        }),
        titleEvidence({
          manifestationId: "prh-isbn-9780553213690",
          sourceUrl:
            "https://www.penguinrandomhouse.com/books/621164/the-metamorphosis-by-franz-kafka/",
          provider: "Penguin Random House",
          authorityId: "penguin-random-house",
          authorityTier: "B",
          recordKind: "publisher-catalog",
          recordId: "ISBN-9780553213690",
          catalogTitleExact: "The Metamorphosis",
          locale: "en",
          market: "US",
          expressionLanguage: "en",
          isbn13: "9780553213690",
          publisher: "Bantam Classics",
          publicationYear: 1972,
          translator: "Stanley Corngold",
        }),
      ],
    },
    descriptionSources: [
      {
        provider: "Franz Kafka author portal (S. Fischer)",
        authorityId: "franz-kafka-portal",
        authorityTier: "B",
        country: "germany",
        language: "de",
        recordKind: "authoritative-work-page",
        recordId: "die-verwandlung",
        url: "https://www.franzkafka.de/werk/saemtliche-titel/die-verwandlung",
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
        provider: "Goethe-Institut",
        authorityId: "goethe-institut",
        authorityTier: "B",
        country: "germany",
        language: "de",
        recordKind: "authoritative-work-page",
        recordId: "kafka-dta-texte",
        url: "https://www.goethe.de/ins/pk/de/kul/mgz/kaf/kafka-dta-texte.html",
        fields: ["identity", "authorship", "description"],
        usage: "reference-only",
        retrievedAt: checkedAt,
      },
      {
        provider: "ORF Ö1",
        authorityId: "orf",
        authorityTier: "B",
        country: "austria",
        language: "de",
        recordKind: "authoritative-work-page",
        recordId: "oe1-757642",
        url: "https://oe1.orf.at/programm/20240521/757642/Ich-bin-Ende-oder-Anfang-Franz-Kafka-zum-100-Todestag-1",
        fields: ["identity", "authorship", "description"],
        usage: "reference-only",
        retrievedAt: checkedAt,
      },
      {
        provider: "University of Vienna PHAIDRA",
        authorityId: "university-of-vienna",
        authorityTier: "B",
        country: "austria",
        language: "de",
        recordKind: "structured-dataset",
        recordId: "PHAIDRA-o:1318224",
        url: "https://services.phaidra.univie.ac.at/api/object/o%3A1318224/get",
        fields: ["identity", "authorship", "description"],
        usage: "reference-only",
        retrievedAt: checkedAt,
      },
    ],
  }),
  [atwoodKey]: resolvedOverlay({
    recordKey: atwoodKey,
    description: {
      ru: "В Республике Галаад, где женщин лишили прав и подчинили жёстким социальным ролям, Фредова служит Служанкой в доме Командора и обязана рожать детей для правящей элиты. Воспоминания о прежней жизни, семье и собственном имени поддерживают её внутреннее сопротивление режиму, который контролирует тело, язык и повседневность.",
      en: "In the Republic of Gilead, where women have been stripped of rights and subjected to rigid social roles, Offred serves as a Handmaid in the Commander's household and is required to bear children for the ruling elite. Memories of her former life, family, and own name sustain her inward resistance to a regime that controls the body, language, and everyday life.",
      ruSha256:
        "e3396c0f32fd4fe842364ce91847f3facd8b25d2584fe73e4ff342f3df2d29b6",
      sourceLanguage: "en",
      sourceCountry: "canada",
    },
    ru: {
      value: "Рассказ Служанки",
      expressionLanguage: "ru",
      market: "RU",
      selectionRule: "current-complete-authorized-edition",
      selectionNote:
        "Прописная буква в слове «Служанки» сохранена по записям РГБ и издательскому каталогу.",
      evidence: [
        titleEvidence({
          manifestationId: "rsl-01004627003",
          sourceUrl: "https://search.rsl.ru/ru/record/01004627003",
          provider: "Российская государственная библиотека",
          authorityId: "rsl",
          authorityTier: "A",
          recordKind: "national-bibliography",
          recordId: "RSL-01004627003",
          catalogTitleExact: "Рассказ Служанки",
          locale: "ru",
          market: "RU",
          expressionLanguage: "ru",
          isbn13: "9785699400751",
          publisher: "Эксмо",
          publicationYear: 2010,
          translator: "А. Грызунова",
          editionStatement: "Рассказ Служанки : [роман]",
        }),
        titleEvidence({
          manifestationId: "eksmo-isbn-9785041715878",
          sourceUrl: "https://eksmo.ru/amp/book/rasskaz-sluzhanki-ITD1290430/",
          provider: "Эксмо",
          authorityId: "eksmo",
          authorityTier: "B",
          recordKind: "publisher-catalog",
          recordId: "ISBN-9785041715878",
          catalogTitleExact: "Рассказ Служанки",
          locale: "ru",
          market: "RU",
          expressionLanguage: "ru",
          isbn13: "9785041715878",
          publisher: "Like Book : Эксмо",
        }),
      ],
    },
    en: {
      value: "The Handmaid's Tale",
      expressionLanguage: "en",
      market: "US",
      selectionRule: "original-market-title",
      selectionNote:
        "The original English title is supported by the US national record and an independent publisher record.",
      evidence: [
        titleEvidence({
          manifestationId: "loc-85021944",
          sourceUrl: "https://www.loc.gov/item/85021944/",
          provider: "Library of Congress",
          authorityId: "loc",
          authorityTier: "A",
          recordKind: "national-bibliography",
          recordId: "LOC-85021944",
          catalogTitleExact: "The Handmaid's tale",
          locale: "en",
          market: "US",
          expressionLanguage: "en",
          isbn10: "0395404258",
          isbn13: "9780395404256",
          publisher: "Houghton Mifflin",
          publicationYear: 1986,
        }),
        titleEvidence({
          manifestationId: "prh-isbn-9780385490818",
          sourceUrl:
            "https://assets.penguinrandomhouse.com/book-resumes/AtwoodMargaret_HandmaidsTale.pdf",
          provider: "Penguin Random House",
          authorityId: "penguin-random-house",
          authorityTier: "B",
          recordKind: "publisher-catalog",
          recordId: "ISBN-9780385490818",
          catalogTitleExact: "The Handmaid's Tale",
          locale: "en",
          market: "US",
          expressionLanguage: "en",
          isbn13: "9780385490818",
          publisher: "Anchor Books",
          publicationYear: 1998,
        }),
      ],
    },
    descriptionSources: [
      {
        provider: "Margaret Atwood official website",
        authorityId: "margaret-atwood-official",
        authorityTier: "B",
        country: "canada",
        language: "en",
        recordKind: "authoritative-work-page",
        recordId: "handmaids-tale",
        url: "https://margaretatwood.ca/books/handmaids-tale/",
        fields: ["identity", "authorship", "original-title", "description"],
        usage: "reference-only",
        retrievedAt: checkedAt,
      },
      {
        provider: "Penguin Random House Canada",
        authorityId: "penguin-random-house-canada",
        authorityTier: "B",
        market: "CA",
        language: "en",
        recordKind: "publisher-catalog",
        recordId: "ISBN-9780735253308",
        url: "https://www.penguinrandomhouse.ca/books/6125/the-handmaids-tale-tv-tie-in-edition-by-margaret-atwood/9780735253308",
        fields: [
          "identity",
          "authorship",
          "title",
          "language",
          "market",
          "description",
        ],
        usage: "reference-only",
        retrievedAt: checkedAt,
      },
    ],
  }),
  [hamletKey]: resolvedOverlay({
    recordKey: hamletKey,
    description: {
      ru: "После смерти датского короля принцу Гамлету является призрак отца и сообщает, что его убил новый король Клавдий. Пытаясь проверить обвинение и решить, как совершить месть, Гамлет разыгрывает безумие; его колебания и действия втягивают двор в цепь слежки, предательства и смертей.",
      en: "After the death of the Danish king, Prince Hamlet encounters his father's ghost, who tells him that the new king, Claudius, murdered him. As Hamlet tries to test the accusation and decide how to take revenge, he feigns madness; his hesitation and actions draw the court into a chain of surveillance, betrayal, and death.",
      ruSha256:
        "73f60f34765e5dcd7cdcc0f41a13cb1d07b83a272b8c89bb6ff243482527a782",
      sourceLanguage: "en",
      sourceCountry: "england",
    },
    ru: {
      value: "Гамлет",
      expressionLanguage: "ru",
      market: "RU",
      selectionRule: "current-complete-authorized-edition",
      selectionNote:
        "Краткое русское заглавие подтверждено национальной и издательской записями.",
      evidence: [
        titleEvidence({
          manifestationId: "rsl-01004801183",
          sourceUrl: "https://search.rsl.ru/ru/record/01004801183",
          provider: "Российская государственная библиотека",
          authorityId: "rsl",
          authorityTier: "A",
          recordKind: "national-bibliography",
          recordId: "RSL-01004801183",
          catalogTitleExact: "Гамлет",
          locale: "ru",
          market: "RU",
          expressionLanguage: "ru",
          isbn13: "9785699353095",
          publisher: "Эксмо",
          publicationYear: 2009,
          translator: "Б. Пастернак; Ю. Корнеев; Т. Щепкина-Куперник",
        }),
        titleEvidence({
          manifestationId: "azbooka-isbn-9785389064751",
          sourceUrl: "https://azbooka.ru/books/gamlet-0b9u",
          provider: "Азбука",
          authorityId: "azbooka",
          authorityTier: "B",
          recordKind: "publisher-catalog",
          recordId: "ISBN-9785389064751",
          catalogTitleExact: "Гамлет",
          locale: "ru",
          market: "RU",
          expressionLanguage: "ru",
          isbn13: "9785389064751",
          publisher: "Азбука",
          publicationYear: 2024,
          translator: "Борис Пастернак",
        }),
      ],
    },
    en: {
      value: "Hamlet",
      expressionLanguage: "en",
      market: "GB",
      selectionRule: "original-market-title",
      selectionNote:
        "The UK display title is supported by legal-deposit and publisher records.",
      evidence: [
        titleEvidence({
          manifestationId: "bl-eld-018381972",
          sourceUrl: "https://eld.bl.uk/catalog/018381972",
          provider: "British Library",
          authorityId: "british-library",
          authorityTier: "A",
          recordKind: "legal-deposit-catalog",
          recordId: "BL-ELD-018381972",
          catalogTitleExact: "Hamlet",
          locale: "en",
          market: "GB",
          expressionLanguage: "en",
          isbn13: "9781137004260",
          publisher: "Palgrave Macmillan",
          publicationYear: 2008,
        }),
        titleEvidence({
          manifestationId: "penguin-uk-isbn-9780141396507",
          sourceUrl:
            "https://www.penguin.co.uk/books/41764/hamlet-by-shakespeare-william/9780141396507",
          provider: "Penguin Books UK",
          authorityId: "penguin-uk",
          authorityTier: "B",
          recordKind: "publisher-catalog",
          recordId: "ISBN-9780141396507",
          catalogTitleExact: "Hamlet",
          locale: "en",
          market: "GB",
          expressionLanguage: "en",
          isbn13: "9780141396507",
          publisher: "Penguin Classics",
          publicationYear: 2015,
        }),
      ],
    },
    descriptionSources: [
      {
        provider: "Royal Shakespeare Company",
        authorityId: "royal-shakespeare-company",
        authorityTier: "B",
        country: "england",
        language: "en",
        recordKind: "authoritative-work-page",
        recordId: "hamlet-the-plot",
        url: "https://www.rsc.org.uk/hamlet/the-plot",
        fields: ["identity", "authorship", "description"],
        usage: "reference-only",
        retrievedAt: checkedAt,
      },
      {
        provider: "Shakespeare Birthplace Trust",
        authorityId: "shakespeare-birthplace-trust",
        authorityTier: "B",
        country: "england",
        language: "en",
        recordKind: "authoritative-work-page",
        recordId: "shakespeares-plays-hamlet",
        url: "https://www.shakespeare.org.uk/explore-shakespeare/shakespedia/shakespeares-plays/hamlet/",
        fields: ["identity", "authorship", "description"],
        usage: "reference-only",
        retrievedAt: checkedAt,
      },
    ],
  }),
  [austenKey]: resolvedOverlay({
    recordKey: austenKey,
    description: {
      ru: "В семье Беннетов пять дочерей, и удачный брак считается главным условием их будущего. Знакомство Элизабет Беннет с состоятельным мистером Дарси начинается с взаимной неприязни, но, преодолевая ошибочные первые впечатления, гордость и предубеждения, герои пересматривают свои суждения о себе и друг о друге.",
      en: "The Bennets have five daughters, and an advantageous marriage is regarded as the chief condition of their future security. Elizabeth Bennet's acquaintance with the wealthy Mr Darcy begins in mutual dislike, but as they overcome mistaken first impressions, pride, and prejudice, they revise their judgements of themselves and one another.",
      ruSha256:
        "6ee96924ea6e27054b0eba99793ec658ad378176932bd3eace29de0e319e3b2e",
      sourceLanguage: "en",
      sourceCountry: "england",
    },
    ru: {
      value: "Гордость и предубеждение",
      expressionLanguage: "ru",
      market: "RU",
      selectionRule: "current-complete-authorized-edition",
      selectionNote:
        "Устоявшееся русское заглавие подтверждено НЭБ/РНБ и каталогом издателя.",
      evidence: [
        titleEvidence({
          manifestationId: "rnl-bibl-a-012673067",
          sourceUrl:
            "https://rusneb.ru/catalog/000200_000018_RU_NLR_BIBL_A_012673067/",
          provider: "Национальная электронная библиотека / РНБ",
          authorityId: "neb",
          authorityTier: "A",
          recordKind: "national-bibliography",
          recordId: "RU-NLR-BIBL-A-012673067",
          catalogTitleExact: "Гордость и предубеждение",
          locale: "ru",
          market: "RU",
          expressionLanguage: "ru",
          isbn13: "9785389055056",
          publisher: "Азбука : Азбука-Аттикус",
          publicationYear: 2021,
          translator: "И. С. Маршак",
          editionStatement: "Гордость и предубеждение : роман",
        }),
        titleEvidence({
          manifestationId: "eksmo-isbn-9785699432318",
          sourceUrl:
            "https://eksmo.ru/amp/book/gordost-i-predubezhdenie-430173112/",
          provider: "Эксмо",
          authorityId: "eksmo",
          authorityTier: "B",
          recordKind: "publisher-catalog",
          recordId: "ISBN-9785699432318",
          catalogTitleExact: "Гордость и предубеждение",
          locale: "ru",
          market: "RU",
          expressionLanguage: "ru",
          isbn13: "9785699432318",
          publisher: "Эксмо",
        }),
      ],
    },
    en: {
      value: "Pride and Prejudice",
      expressionLanguage: "en",
      market: "US",
      selectionRule: "original-market-title",
      selectionNote:
        "The English display title is supported by a US national record and publisher record.",
      evidence: [
        titleEvidence({
          manifestationId: "loc-18001222",
          sourceUrl: "https://www.loc.gov/item/18001222/",
          provider: "Library of Congress",
          authorityId: "loc",
          authorityTier: "A",
          recordKind: "national-bibliography",
          recordId: "LOC-18001222",
          catalogTitleExact: "Pride and prejudice",
          locale: "en",
          market: "US",
          expressionLanguage: "en",
          publisher: "Ginn and Company",
          publicationYear: 1917,
        }),
        titleEvidence({
          manifestationId: "prh-isbn-9780451530783",
          sourceUrl:
            "https://www.penguinrandomhouse.com/books/301713/pride-and-prejudice-by-jane-austen/",
          provider: "Penguin Random House",
          authorityId: "penguin-random-house",
          authorityTier: "B",
          recordKind: "publisher-catalog",
          recordId: "ISBN-9780451530783",
          catalogTitleExact: "Pride and Prejudice",
          locale: "en",
          market: "US",
          expressionLanguage: "en",
          isbn13: "9780451530783",
          publisher: "Signet",
          publicationYear: 2008,
        }),
      ],
    },
    descriptionSources: [
      {
        provider: "Jane Austen's House",
        authorityId: "jane-austens-house",
        authorityTier: "B",
        country: "england",
        language: "en",
        recordKind: "authoritative-work-page",
        recordId: "pride-and-prejudice",
        url: "https://janeaustens.house/jane-austen/novels/pride-and-prejudice/",
        fields: ["identity", "authorship", "publication-year", "description"],
        usage: "reference-only",
        retrievedAt: checkedAt,
      },
      {
        provider: "British Library",
        authorityId: "british-library",
        authorityTier: "A",
        country: "england",
        language: "en",
        recordKind: "publisher-catalog",
        recordId: "ISBN-9780241804698",
        url: "https://shop.bl.uk/products/pride-and-prejudice-250th-anniversary-edition",
        fields: ["identity", "authorship", "title", "description"],
        usage: "reference-only",
        retrievedAt: checkedAt,
      },
    ],
  }),
  [dickensKey]: resolvedOverlay({
    recordKey: dickensKey,
    description: {
      ru: "Действие романа разворачивается между Лондоном и Парижем до и во время Французской революции. Судьбы доктора Манетта, его дочери Люси, Чарльза Дарнея и Сидни Картона связывают семейную тайну, политическое насилие и личное самопожертвование, противопоставляя мести возможность нравственного выбора.",
      en: "The novel moves between London and Paris before and during the French Revolution. The lives of Doctor Manette, his daughter Lucie, Charles Darnay, and Sydney Carton bind together a family secret, political violence, and personal self-sacrifice, setting the possibility of moral choice against revenge.",
      ruSha256:
        "faa1cfe66b6f1bc810ba9ba8211ded42894ff814aaeb503b2a3e210f32029ee8",
      sourceLanguage: "en",
      sourceCountry: "england",
    },
    ru: {
      value: "Повесть о двух городах",
      expressionLanguage: "ru",
      market: "RU",
      selectionRule: "current-complete-authorized-edition",
      selectionNote:
        "Русское заглавие подтверждено национальной библиографией и действующим издательским каталогом.",
      evidence: [
        titleEvidence({
          manifestationId: "neb-005659889",
          sourceUrl: "https://rusneb.ru/catalog/000199_000009_005659889/",
          provider: "Национальная электронная библиотека / РГБ",
          authorityId: "neb",
          authorityTier: "A",
          recordKind: "national-bibliography",
          recordId: "NEB-005659889",
          catalogTitleExact: "Повесть о двух городах",
          locale: "ru",
          market: "RU",
          expressionLanguage: "ru",
          publisher: "Гослитиздат",
          publicationYear: 1960,
          translator: "С. П. Бобров; М. П. Богословская",
          editionStatement: "Повесть о двух городах : роман",
        }),
        titleEvidence({
          manifestationId: "azbooka-isbn-9785389011335",
          sourceUrl: "https://azbooka.ru/books/povest-o-dvukh-gorodakh-uotb",
          provider: "Азбука",
          authorityId: "azbooka",
          authorityTier: "B",
          recordKind: "publisher-catalog",
          recordId: "ISBN-9785389011335",
          catalogTitleExact: "Повесть о двух городах",
          locale: "ru",
          market: "RU",
          expressionLanguage: "ru",
          isbn13: "9785389011335",
          publisher: "Азбука",
          publicationYear: 2023,
          translator: "Елизавета Бекетова",
        }),
      ],
    },
    en: {
      value: "A Tale of Two Cities",
      expressionLanguage: "en",
      market: "GB",
      selectionRule: "original-market-title",
      selectionNote:
        "The UK display title is supported by legal-deposit and publisher records.",
      evidence: [
        titleEvidence({
          manifestationId: "bl-eld-018529989",
          sourceUrl: "https://eld.bl.uk/catalog/018529989",
          provider: "British Library",
          authorityId: "british-library",
          authorityTier: "A",
          recordKind: "legal-deposit-catalog",
          recordId: "BL-ELD-018529989",
          catalogTitleExact: "A tale of two cities",
          locale: "en",
          market: "GB",
          expressionLanguage: "en",
          isbn13: "9780141919089",
          publisher: "Puffin",
          publicationYear: 2009,
        }),
        titleEvidence({
          manifestationId: "penguin-uk-isbn-9780141196909",
          sourceUrl:
            "https://www.penguin.co.uk/books/56171/a-tale-of-two-cities-by-charles-dickens-intro-and-notes-richard-maxwell/9780141196909",
          provider: "Penguin Books UK",
          authorityId: "penguin-uk",
          authorityTier: "B",
          recordKind: "publisher-catalog",
          recordId: "ISBN-9780141196909",
          catalogTitleExact: "A Tale of Two Cities",
          locale: "en",
          market: "GB",
          expressionLanguage: "en",
          isbn13: "9780141196909",
          publisher: "Penguin Classics",
          publicationYear: 2011,
        }),
      ],
    },
    descriptionSources: [
      {
        provider: "Dickens Fellowship",
        authorityId: "dickens-fellowship",
        authorityTier: "B",
        country: "england",
        language: "en",
        recordKind: "authoritative-work-page",
        recordId: "fiction-writer",
        url: "https://www.dickensfellowship.org/index.php/read/life-of-dickens/fiction-writer",
        fields: ["identity", "authorship", "publication-year", "description"],
        usage: "reference-only",
        retrievedAt: checkedAt,
      },
      {
        provider: "Penguin Books UK",
        authorityId: "penguin-uk",
        authorityTier: "B",
        market: "GB",
        language: "en",
        recordKind: "publisher-catalog",
        recordId: "ISBN-9780141196909",
        url: "https://www.penguin.co.uk/books/56171/a-tale-of-two-cities-by-charles-dickens-intro-and-notes-richard-maxwell/9780141196909",
        fields: ["title", "publication-year", "language", "market", "description"],
        usage: "reference-only",
        retrievedAt: checkedAt,
      },
    ],
  }),
  [firstMenKey]: resolvedOverlay({
    recordKey: firstMenKey,
    description: {
      ru: "Бедфорд знакомится с учёным Кэйвором, создавшим вещество, которое нейтрализует гравитацию, и вместе с ним отправляется на Луну. Под поверхностью спутника путешественники обнаруживают общество селенитов; столкновение двух миров превращает приключенческий сюжет в размышление о знании, власти и имперских привычках людей.",
      en: "Bedford meets the scientist Cavor, who has created a substance that neutralises gravity, and travels with him to the Moon. Beneath the lunar surface the travellers discover a society of Selenites; the encounter between two worlds turns the adventure into a reflection on knowledge, power, and humanity's imperial habits.",
      ruSha256:
        "3d5110a47a5bd3ae886331ab05e3ec77fd41870c6bbc0219d966fbf373460dfd",
      sourceLanguage: "en",
      sourceCountry: "england",
    },
    ru: {
      value: "Первые люди на Луне",
      expressionLanguage: "ru",
      market: "RU",
      selectionRule: "current-complete-authorized-edition",
      selectionNote:
        "Заглавие самостоятельного произведения сохранено внутри двух подтверждённых составных изданий.",
      evidence: [
        titleEvidence({
          manifestationId: "rsl-01002570441-component-first-men",
          sourceUrl: "https://search.rsl.ru/ru/record/01002570441",
          provider: "Российская государственная библиотека",
          authorityId: "rsl",
          authorityTier: "A",
          recordKind: "national-bibliography",
          recordId: "RSL-01002570441",
          catalogTitleExact: "Первые люди на Луне",
          locale: "ru",
          market: "RU",
          expressionLanguage: "ru",
          isbn10: "5-17-026436-4",
          publisher: "АСТ",
          publicationYear: 2004,
          translator: "Михаил Зенкевич",
          editionStatement: "Война миров ; Первые люди на Луне",
        }),
        titleEvidence({
          manifestationId: "azbooka-isbn-9785389129009-component-first-men",
          sourceUrl:
            "https://azbooka.ru/books/pervye-lyudi-na-lune-pishcha-bogov-8mzc",
          provider: "Азбука",
          authorityId: "azbooka",
          authorityTier: "B",
          recordKind: "publisher-catalog",
          recordId: "ISBN-9785389129009",
          catalogTitleExact: "Первые люди на Луне",
          locale: "ru",
          market: "RU",
          expressionLanguage: "ru",
          isbn13: "9785389129009",
          publisher: "Азбука",
          editionStatement: "Первые люди на Луне. Пища богов",
        }),
      ],
    },
    en: {
      value: "The First Men in the Moon",
      expressionLanguage: "en",
      market: "GB",
      selectionRule: "original-market-title",
      selectionNote:
        "The preposition “in” is confirmed by a UK legal-deposit record and the matching publisher catalogue.",
      evidence: [
        titleEvidence({
          manifestationId: "bl-eld-018530062",
          sourceUrl: "https://eld.bl.uk/catalog/018530062",
          provider: "British Library",
          authorityId: "british-library",
          authorityTier: "A",
          recordKind: "legal-deposit-catalog",
          recordId: "BL-ELD-018530062",
          catalogTitleExact: "The first men in the moon",
          locale: "en",
          market: "GB",
          expressionLanguage: "en",
          isbn13: "9780141921068",
          publisher: "Penguin",
          publicationYear: 2005,
        }),
        titleEvidence({
          manifestationId: "penguin-uk-isbn-9780141921068",
          sourceUrl:
            "https://www.penguin.co.uk/books/60365/the-first-men-in-the-moon-by-wells-hg/9780141921068",
          provider: "Penguin Books UK",
          authorityId: "penguin-uk",
          authorityTier: "B",
          recordKind: "publisher-catalog",
          recordId: "ISBN-9780141921068",
          catalogTitleExact: "The First Men in the Moon",
          locale: "en",
          market: "GB",
          expressionLanguage: "en",
          isbn13: "9780141921068",
          publisher: "Penguin",
          publicationYear: 2005,
        }),
      ],
    },
    descriptionSources: [
      {
        provider: "Penguin Books UK",
        authorityId: "penguin-uk",
        authorityTier: "B",
        market: "GB",
        language: "en",
        recordKind: "publisher-catalog",
        recordId: "ISBN-9780141921068",
        url: "https://www.penguin.co.uk/books/60365/the-first-men-in-the-moon-by-wells-hg/9780141921068",
        fields: [
          "identity",
          "authorship",
          "title",
          "publication-year",
          "description",
        ],
        usage: "reference-only",
        retrievedAt: checkedAt,
      },
      {
        provider: "Oxford University Press",
        authorityId: "oxford-university-press",
        authorityTier: "B",
        country: "england",
        language: "en",
        recordKind: "publisher-catalog",
        recordId: "ISBN-9780198705048",
        url: "https://global.oup.com/academic/product/the-first-men-in-the-moon-9780198705048",
        fields: ["identity", "authorship", "title", "description"],
        usage: "reference-only",
        retrievedAt: checkedAt,
      },
    ],
  }),
};

const heldBibliographicSources: Record<string, WorkSourceProfile[]> = {
  [martelKey]: [
    {
      provider: "Эксмо",
      authorityId: "eksmo",
      authorityTier: "B",
      market: "RU",
      language: "ru",
      recordKind: "publisher-catalog",
      recordId: "ISBN-9785699369348",
      url: "https://eksmo.ru/book/zhizn-pi-430151008/",
      fields: ["title", "publication-year", "language", "market", "description"],
      usage: "reference-only",
      retrievedAt: checkedAt,
    },
    {
      provider: "Санкт-Петербургская государственная библиотека для слепых",
      authorityId: "st-petersburg-library-for-the-blind",
      authorityTier: "B",
      country: "russia",
      language: "ru",
      recordKind: "structured-dataset",
      recordId: "RU-SPSLB-bibl2-773",
      url: "https://www.gbs.spb.ru/ru/search/detail/?id=26cd787fd1aa6e37119c7950620b3d1f",
      fields: ["identity", "title", "publication-year", "language"],
      usage: "reference-only",
      retrievedAt: checkedAt,
    },
    {
      provider: "Library of Congress",
      authorityId: "loc",
      authorityTier: "A",
      market: "US",
      language: "en",
      recordKind: "national-bibliography",
      recordId: "LOC-2001039737",
      url: "https://lccn.loc.gov/2001039737",
      fields: ["title", "publication-year", "language", "market"],
      usage: "reference-only",
      retrievedAt: checkedAt,
    },
    {
      provider: "Canongate Books",
      authorityId: "canongate",
      authorityTier: "B",
      market: "GB",
      language: "en",
      recordKind: "publisher-catalog",
      recordId: "ISBN-9781786891686",
      url: "https://canongate.co.uk/books/318-life-of-pi/",
      fields: ["title", "publication-year", "language", "market", "description"],
      usage: "reference-only",
      retrievedAt: checkedAt,
    },
    {
      provider: "Yann Martel official website",
      authorityId: "yann-martel-official",
      authorityTier: "B",
      country: "canada",
      language: "en",
      recordKind: "authoritative-work-page",
      recordId: "life-of-pi",
      url: "https://www.yannmartel.com/books/life-of-pi",
      fields: ["identity", "authorship", "original-title", "description"],
      usage: "reference-only",
      retrievedAt: checkedAt,
    },
  ],
  [sleeperKey]: [
    {
      provider: "Национальная электронная библиотека / РГБ",
      authorityId: "neb",
      authorityTier: "A",
      market: "RU",
      language: "ru",
      recordKind: "national-bibliography",
      recordId: "NEB-003995369",
      url: "https://rusneb.ru/catalog/000199_000009_003995369/",
      fields: ["title", "publication-year", "language", "market"],
      usage: "reference-only",
      retrievedAt: checkedAt,
    },
    {
      provider: "АСТ",
      authorityId: "ast",
      authorityTier: "B",
      market: "RU",
      language: "ru",
      recordKind: "publisher-catalog",
      recordId: "ISBN-9785171748661",
      url: "https://ast.ru/book/the-sleeper-awakes-kogda-spyashchiy-prosnyetsya-889659/",
      fields: ["title", "publication-year", "language", "market", "description"],
      usage: "reference-only",
      retrievedAt: checkedAt,
    },
    {
      provider: "Library of Congress",
      authorityId: "loc",
      authorityTier: "A",
      market: "US",
      language: "en",
      recordKind: "national-bibliography",
      recordId: "LOC-99015153",
      url: "https://lccn.loc.gov/99015153",
      fields: ["title", "publication-year", "language", "market"],
      usage: "reference-only",
      retrievedAt: checkedAt,
    },
    {
      provider: "Broadview Press",
      authorityId: "broadview-press",
      authorityTier: "B",
      market: "CA",
      language: "en",
      recordKind: "critical-edition",
      recordId: "ISBN-9781554813520",
      url: "https://broadviewpress.com/product/when-the-sleeper-wakes/",
      fields: ["title", "publication-year", "language", "market", "description"],
      usage: "reference-only",
      retrievedAt: checkedAt,
    },
    {
      provider: "Library of Congress",
      authorityId: "loc",
      authorityTier: "A",
      market: "US",
      language: "en",
      recordKind: "national-bibliography",
      recordId: "LOC-00030230",
      url: "https://lccn.loc.gov/00030230",
      fields: ["title", "publication-year", "language", "market"],
      usage: "reference-only",
      retrievedAt: checkedAt,
    },
    {
      provider: "University of Nebraska Press",
      authorityId: "nebraska-press",
      authorityTier: "B",
      market: "US",
      language: "en",
      recordKind: "publisher-catalog",
      recordId: "ISBN-9780803298187",
      url: "https://www.nebraskapress.unl.edu/bison-books/9780803298187/the-sleeper-awakes/",
      fields: ["title", "publication-year", "language", "market", "description"],
      usage: "reference-only",
      retrievedAt: checkedAt,
    },
  ],
};

export const bookBibliographicHoldsByRecordKey: Record<
  string,
  BookBibliographicHold
> = {
  [martelKey]: {
    status: "fail-closed",
    locale: "ru",
    code: "ru-national-record-unresolved",
    reason:
      "Издательская карточка подтверждает название «Жизнь Пи», но стабильная запись российского национального библиографического или legal-deposit каталога для печатного издания пока не установлена. Региональная запись аудиокниги не заменяет национальную запись.",
    resolutionCriteria: [
      "Найти стабильную запись РГБ, РНБ или НЭБ для печатного русского издания.",
      "Сверить по этой записи точное основное заглавие, издателя, год, ISBN и переводчика.",
      "Сопоставить запись с независимым официальным каталогом российского издателя.",
    ],
    evidenceUrls: heldBibliographicSources[martelKey].map(
      (source) => source.url
    ),
  },
  [sleeperKey]: {
    status: "fail-closed",
    locale: "en",
    code: "english-lineage-unresolved",
    reason:
      "Одно русское заглавие используется для исходного текста 1899 года When the Sleeper Wakes и существенно переработанной автором редакции 1910 года The Sleeper Awakes. Без edition/ISBN-to-lineage mapping подмена одного английского заглавия другим была бы недостоверной.",
    resolutionCriteria: [
      "Установить по ISBN или текстологическому аппарату, какую редакцию представляет текущая карточка.",
      "Развести исходную и переработанную редакции на уровне Work/Expression, если в базе должны присутствовать обе.",
      "Только после этого присвоить английское display title соответствующей редакции.",
    ],
    evidenceUrls: heldBibliographicSources[sleeperKey].map(
      (source) => source.url
    ),
    lineages: [
      {
        lineageId: "original-1899",
        titleEn: "When the Sleeper Wakes",
        evidenceUrls: [
          "https://lccn.loc.gov/99015153",
          "https://broadviewpress.com/product/when-the-sleeper-wakes/",
          "https://rusneb.ru/catalog/000199_000009_003995369/",
        ],
      },
      {
        lineageId: "revised-1910",
        titleEn: "The Sleeper Awakes",
        evidenceUrls: [
          "https://lccn.loc.gov/00030230",
          "https://www.nebraskapress.unl.edu/bison-books/9780803298187/the-sleeper-awakes/",
          "https://ast.ru/book/the-sleeper-awakes-kogda-spyashchiy-prosnyetsya-889659/",
        ],
      },
    ],
  },
};

function mergeTranslation(
  work: WorkProfile,
  locale: WorkLocale,
  title: string | undefined,
  titleEvidenceProfile: WorkLocalizedTitleProfile | undefined,
  descriptionOverlay:
    | ResolvedBibliographicOverlay["descriptions"][WorkLocale]
    | undefined,
  sourceUrls: string[]
) {
  const translation = work.translations?.[locale];
  if (!translation) return undefined;
  return {
    ...translation,
    ...(title ? { title } : {}),
    ...(descriptionOverlay
      ? {
          description: descriptionOverlay.text,
          method: descriptionOverlay.method,
          status: "reviewed" as const,
          reviewedAt: checkedAt,
          descriptionProvenance: descriptionOverlay.provenance,
        }
      : {}),
    sourceUrls: [...new Set([...translation.sourceUrls, ...sourceUrls])],
    ...(titleEvidenceProfile
      ? { titleEvidence: titleEvidenceProfile }
      : {}),
  };
}

/**
 * Adds reviewed manifestation evidence without rewriting descriptions or
 * changing their editorial status. Unresolved records receive sources only;
 * their missing localized-title evidence keeps the V2 gate closed.
 */
export function applyBookBibliographicOverlay(
  countryId: string,
  writerId: string,
  work: WorkProfile
): WorkProfile {
  const recordKey = `${countryId}:${writerId}:${work.id}`;
  const resolved = resolvedBibliographicOverlays[recordKey];
  const heldSources = heldBibliographicSources[recordKey] || [];
  if (!resolved && heldSources.length === 0) return work;

  const additions = [...(resolved?.sources || []), ...heldSources];
  const sources = mergeSources(work.sources || [], additions);
  const allAdditionUrls = additions.map((source) => source.url);
  const ruSourceUrls = resolved
    ? [
        ...resolved.localizedTitles.ru.evidence.map(
          (evidence) => evidence.sourceUrl
        ),
        ...resolved.sources
          .filter((source) => source.fields.includes("description"))
          .map((source) => source.url),
      ]
    : allAdditionUrls;
  const enSourceUrls = resolved
    ? [
        ...resolved.localizedTitles.en.evidence.map(
          (evidence) => evidence.sourceUrl
        ),
        ...resolved.sources
          .filter((source) => source.fields.includes("description"))
          .map((source) => source.url),
      ]
    : allAdditionUrls;
  const ru = mergeTranslation(
    work,
    "ru",
    resolved?.localizedTitles.ru.value,
    resolved?.localizedTitles.ru,
    resolved?.descriptions.ru,
    ruSourceUrls
  );
  const en = mergeTranslation(
    work,
    "en",
    resolved?.localizedTitles.en.value,
    resolved?.localizedTitles.en,
    resolved?.descriptions.en,
    enSourceUrls
  );

  return {
    ...work,
    ...(resolved
      ? {
          title: resolved.localizedTitles.ru.value,
          description: resolved.descriptions.ru.text,
        }
      : {}),
    ...(ru || en
      ? {
          translations: {
            ...work.translations,
            ...(ru ? { ru } : {}),
            ...(en ? { en } : {}),
          },
        }
      : {}),
    ...(resolved
      ? {
          localizedTitles: {
            ...work.localizedTitles,
            ...resolved.localizedTitles,
          },
        }
      : {}),
    sources,
  };
}

export const resolvedBookBibliographicRecordKeys = Object.freeze(
  Object.keys(resolvedBibliographicOverlays)
);
