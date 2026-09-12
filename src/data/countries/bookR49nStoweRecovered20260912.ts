import type { Country, WorkProfile, WriterProfile, WorkTranslationProfile, WorkDescriptionProvenanceProfile } from "./types";

type RetainedTranslation = Omit<WorkTranslationProfile, "descriptionProvenance"> & {
  descriptionProvenance?: WorkDescriptionProvenanceProfile & { primarySourceUrls?: string[] };
};
type RetainedWork = Omit<WorkProfile, "translations"> & {
  translations: Partial<Record<"ru" | "en", RetainedTranslation>>;
};

// Exact retained Work from R49N and the independently reviewed 2026-09-04
// source profile. Full hashes and scope: reports/book-r49n-retained-profile-recovery-20260912.json.
// Apply to bookArchiveCountries only; this does not publish a writer biography.
export const bookR49nStoweRecovered20260912Key = "usa:harriet_beecher_stowe:uncle-toms-cabin";

const retainedWork: RetainedWork = {
  "id": "uncle-toms-cabin",
  "title": "Хижина дяди Тома",
  "authorship": {
    "kind": "single",
    "authors": [
      {
        "countryId": "usa",
        "writerId": "harriet_beecher_stowe",
        "creditNames": {
          "ru": "Гарриет Бичер-Стоу",
          "en": "Harriet Beecher Stowe"
        },
        "attribution": "credited"
      }
    ]
  },
  "originalTitle": "Uncle Tom's Cabin; or, Life Among the Lowly",
  "firstPublished": 1852,
  "originalLanguage": "английский",
  "genres": [
    "роман",
    "социальный роман"
  ],
  "description": "Когда у мистера Шелби возникают денежные трудности, порабощённого Тома продают работорговцу, и его жизнь начинает зависеть от сменяющихся хозяев. Через испытания героя, сохраняющего веру в человеческую доброту, роман показывает жестокость рабства и раскол американского общества в отношении этой системы.",
  "translations": {
    "ru": {
      "locale": "ru",
      "title": "Хижина дяди Тома",
      "description": "Когда у мистера Шелби возникают денежные трудности, порабощённого Тома продают работорговцу, и его жизнь начинает зависеть от сменяющихся хозяев. Через испытания героя, сохраняющего веру в человеческую доброту, роман показывает жестокость рабства и раскол американского общества в отношении этой системы.",
      "sourceLanguage": "ru",
      "status": "verified",
      "reviewedAt": "2026-09-04",
      "sourceUrls": [
        "https://search.rsl.ru/ru/record/01002380533",
        "https://ast.ru/book/khizhina-dyadi-toma-852431/",
        "https://eksmo.ru/book/khizhina-dyadi-toma-ITD1299502/",
        "https://www.nps.gov/people/harriet-beecher-stowe.htm",
        "https://www.penguinrandomhouse.com/books/301441/uncle-toms-cabin-by-harriet-beecher-stowe/"
      ],
      "method": "editorial-original",
      "titleEvidence": {
        "entityKind": "expression",
        "expressionId": "usa:harriet_beecher_stowe:uncle-toms-cabin:ru",
        "locale": "ru",
        "value": "Хижина дяди Тома",
        "status": "verified-published",
        "expressionLanguage": "ru",
        "market": "RU",
        "selectionRule": "authoritative-uniform-title",
        "selectionNote": "Русское заглавие независимо подтверждено РГБ и АСТ. Это разные издания; совпадение перевода не заявляется. Издание РГБ 2003 года также содержит отдельное эссе; общие переводческие сведения всего тома не приписываются роману.",
        "evidence": [
          {
            "entityKind": "manifestation",
            "manifestationId": "rsl-01002380533",
            "sourceUrl": "https://search.rsl.ru/ru/record/01002380533",
            "provider": "Российская государственная библиотека",
            "authorityId": "rsl",
            "authorityTier": "A",
            "recordKind": "national-bibliography",
            "recordId": "RSL-01002380533",
            "catalogTitleExact": "Хижина дяди Тома",
            "locale": "ru",
            "market": "RU",
            "expressionLanguage": "ru",
            "isbn10": "5699044248",
            "publisher": "Эксмо",
            "publicationYear": 2003,
            "retrievedAt": "2026-09-04",
            "checkedAt": "2026-09-04",
            "checkedBy": "Codex recover_catalog_plan research agent"
          },
          {
            "entityKind": "manifestation",
            "manifestationId": "isbn-9785171269272",
            "sourceUrl": "https://ast.ru/book/khizhina-dyadi-toma-852431/",
            "provider": "Издательство АСТ",
            "authorityId": "ast",
            "authorityTier": "B",
            "recordKind": "publisher-catalog",
            "recordId": "ISBN-9785171269272",
            "catalogTitleExact": "Хижина дяди Тома",
            "locale": "ru",
            "market": "RU",
            "expressionLanguage": "ru",
            "isbn13": "9785171269272",
            "publisher": "АСТ",
            "retrievedAt": "2026-09-04",
            "checkedAt": "2026-09-04",
            "checkedBy": "Codex recover_catalog_plan research agent"
          }
        ]
      },
      "descriptionProvenance": {
        "origin": "official-source-synthesis",
        "sourceLanguage": "ru",
        "sourceCountry": "usa",
        "sourceUrls": [
          "https://eksmo.ru/book/khizhina-dyadi-toma-ITD1299502/",
          "https://www.nps.gov/people/harriet-beecher-stowe.htm",
          "https://www.penguinrandomhouse.com/books/301441/uncle-toms-cabin-by-harriet-beecher-stowe/"
        ],
        "primarySourceUrls": [
          "https://eksmo.ru/book/khizhina-dyadi-toma-ITD1299502/"
        ],
        "transformations": [
          "condensed",
          "deduplicated",
          "spoiler-limited",
          "style-edited"
        ],
        "rights": {
          "textOrigin": "project-original",
          "copiedSourceText": false
        },
        "author": "Codex recover_catalog_plan research agent",
        "createdAt": "2026-09-04",
        "reviewedBy": "Codex root independent AI source and editorial review",
        "reviewedAt": "2026-09-04"
      }
    },
    "en": {
      "locale": "en",
      "title": "Uncle Tom's Cabin",
      "description": "Sold to a slave trader and sent to the American South, Tom passes from one owner to another, enduring the brutality of slavery. Through his ordeals and his continued faith, the novel examines a system that separates families and forces people to confront its moral consequences.",
      "sourceLanguage": "en",
      "status": "verified",
      "reviewedAt": "2026-09-04",
      "sourceUrls": [
        "https://catalogue.nli.ie/Record/vtls000157656/StaffViewMARC",
        "https://www.penguin.co.uk/books/373025/uncle-toms-cabin-by-stoweharriet-beecher/9781857152067",
        "https://www.nps.gov/people/harriet-beecher-stowe.htm",
        "https://www.penguinrandomhouse.com/books/301441/uncle-toms-cabin-by-harriet-beecher-stowe/"
      ],
      "method": "editorial-original",
      "titleEvidence": {
        "entityKind": "expression",
        "expressionId": "usa:harriet_beecher_stowe:uncle-toms-cabin:en",
        "locale": "en",
        "value": "Uncle Tom's Cabin",
        "status": "verified-published",
        "expressionLanguage": "en",
        "market": "GB",
        "selectionRule": "authoritative-uniform-title",
        "selectionNote": "The National Library of Ireland records the London J. Cassell edition of 1852; the independent UK publisher records the Everyman edition of 1995. NLI MARC 245$a is \"Uncle Tom's cabin /\" followed by the responsibility statement in 245$c: the terminal slash is an ISBD responsibility separator, not part of the title proper or an omitted subtitle. Both manifestations attest the same short English title in the GB publication market; no same-edition claim is made.",
        "evidence": [
          {
            "entityKind": "manifestation",
            "manifestationId": "nli-vtls000157656",
            "sourceUrl": "https://catalogue.nli.ie/Record/vtls000157656/StaffViewMARC",
            "provider": "National Library of Ireland",
            "authorityId": "national-library-of-ireland",
            "authorityTier": "A",
            "recordKind": "national-bibliography",
            "recordId": "NLI-vtls000157656",
            "catalogTitleExact": "Uncle Tom's cabin",
            "locale": "en",
            "market": "GB",
            "expressionLanguage": "en",
            "publisher": "J. Cassell",
            "publicationYear": 1852,
            "retrievedAt": "2026-09-04",
            "checkedAt": "2026-09-04",
            "checkedBy": "Codex recover_catalog_plan research agent"
          },
          {
            "entityKind": "manifestation",
            "manifestationId": "isbn-9781857152067",
            "sourceUrl": "https://www.penguin.co.uk/books/373025/uncle-toms-cabin-by-stoweharriet-beecher/9781857152067",
            "provider": "Everyman / Penguin Books UK",
            "authorityId": "penguin-uk",
            "authorityTier": "B",
            "recordKind": "publisher-catalog",
            "recordId": "ISBN-9781857152067",
            "catalogTitleExact": "Uncle Tom's Cabin",
            "locale": "en",
            "market": "GB",
            "expressionLanguage": "en",
            "isbn13": "9781857152067",
            "publisher": "Everyman",
            "publicationYear": 1995,
            "retrievedAt": "2026-09-04",
            "checkedAt": "2026-09-04",
            "checkedBy": "Codex recover_catalog_plan research agent"
          }
        ]
      },
      "descriptionProvenance": {
        "origin": "official-source-synthesis",
        "sourceLanguage": "en",
        "sourceCountry": "usa",
        "sourceUrls": [
          "https://www.nps.gov/people/harriet-beecher-stowe.htm",
          "https://www.penguinrandomhouse.com/books/301441/uncle-toms-cabin-by-harriet-beecher-stowe/"
        ],
        "primarySourceUrls": [
          "https://www.nps.gov/people/harriet-beecher-stowe.htm",
          "https://www.penguinrandomhouse.com/books/301441/uncle-toms-cabin-by-harriet-beecher-stowe/"
        ],
        "transformations": [
          "condensed",
          "deduplicated",
          "spoiler-limited",
          "style-edited"
        ],
        "rights": {
          "textOrigin": "project-original",
          "copiedSourceText": false
        },
        "author": "Codex recover_catalog_plan research agent",
        "createdAt": "2026-09-04",
        "reviewedBy": "Codex root independent AI source and editorial review",
        "reviewedAt": "2026-09-04"
      }
    }
  },
  "localizedTitles": {
    "ru": {
      "entityKind": "expression",
      "expressionId": "usa:harriet_beecher_stowe:uncle-toms-cabin:ru",
      "locale": "ru",
      "value": "Хижина дяди Тома",
      "status": "verified-published",
      "expressionLanguage": "ru",
      "market": "RU",
      "selectionRule": "authoritative-uniform-title",
      "selectionNote": "Русское заглавие независимо подтверждено РГБ и АСТ. Это разные издания; совпадение перевода не заявляется. Издание РГБ 2003 года также содержит отдельное эссе; общие переводческие сведения всего тома не приписываются роману.",
      "evidence": [
        {
          "entityKind": "manifestation",
          "manifestationId": "rsl-01002380533",
          "sourceUrl": "https://search.rsl.ru/ru/record/01002380533",
          "provider": "Российская государственная библиотека",
          "authorityId": "rsl",
          "authorityTier": "A",
          "recordKind": "national-bibliography",
          "recordId": "RSL-01002380533",
          "catalogTitleExact": "Хижина дяди Тома",
          "locale": "ru",
          "market": "RU",
          "expressionLanguage": "ru",
          "isbn10": "5699044248",
          "publisher": "Эксмо",
          "publicationYear": 2003,
          "retrievedAt": "2026-09-04",
          "checkedAt": "2026-09-04",
          "checkedBy": "Codex recover_catalog_plan research agent"
        },
        {
          "entityKind": "manifestation",
          "manifestationId": "isbn-9785171269272",
          "sourceUrl": "https://ast.ru/book/khizhina-dyadi-toma-852431/",
          "provider": "Издательство АСТ",
          "authorityId": "ast",
          "authorityTier": "B",
          "recordKind": "publisher-catalog",
          "recordId": "ISBN-9785171269272",
          "catalogTitleExact": "Хижина дяди Тома",
          "locale": "ru",
          "market": "RU",
          "expressionLanguage": "ru",
          "isbn13": "9785171269272",
          "publisher": "АСТ",
          "retrievedAt": "2026-09-04",
          "checkedAt": "2026-09-04",
          "checkedBy": "Codex recover_catalog_plan research agent"
        }
      ]
    },
    "en": {
      "entityKind": "expression",
      "expressionId": "usa:harriet_beecher_stowe:uncle-toms-cabin:en",
      "locale": "en",
      "value": "Uncle Tom's Cabin",
      "status": "verified-published",
      "expressionLanguage": "en",
      "market": "GB",
      "selectionRule": "authoritative-uniform-title",
      "selectionNote": "The National Library of Ireland records the London J. Cassell edition of 1852; the independent UK publisher records the Everyman edition of 1995. NLI MARC 245$a is \"Uncle Tom's cabin /\" followed by the responsibility statement in 245$c: the terminal slash is an ISBD responsibility separator, not part of the title proper or an omitted subtitle. Both manifestations attest the same short English title in the GB publication market; no same-edition claim is made.",
      "evidence": [
        {
          "entityKind": "manifestation",
          "manifestationId": "nli-vtls000157656",
          "sourceUrl": "https://catalogue.nli.ie/Record/vtls000157656/StaffViewMARC",
          "provider": "National Library of Ireland",
          "authorityId": "national-library-of-ireland",
          "authorityTier": "A",
          "recordKind": "national-bibliography",
          "recordId": "NLI-vtls000157656",
          "catalogTitleExact": "Uncle Tom's cabin",
          "locale": "en",
          "market": "GB",
          "expressionLanguage": "en",
          "publisher": "J. Cassell",
          "publicationYear": 1852,
          "retrievedAt": "2026-09-04",
          "checkedAt": "2026-09-04",
          "checkedBy": "Codex recover_catalog_plan research agent"
        },
        {
          "entityKind": "manifestation",
          "manifestationId": "isbn-9781857152067",
          "sourceUrl": "https://www.penguin.co.uk/books/373025/uncle-toms-cabin-by-stoweharriet-beecher/9781857152067",
          "provider": "Everyman / Penguin Books UK",
          "authorityId": "penguin-uk",
          "authorityTier": "B",
          "recordKind": "publisher-catalog",
          "recordId": "ISBN-9781857152067",
          "catalogTitleExact": "Uncle Tom's Cabin",
          "locale": "en",
          "market": "GB",
          "expressionLanguage": "en",
          "isbn13": "9781857152067",
          "publisher": "Everyman",
          "publicationYear": 1995,
          "retrievedAt": "2026-09-04",
          "checkedAt": "2026-09-04",
          "checkedBy": "Codex recover_catalog_plan research agent"
        }
      ]
    }
  },
  "sources": [
    {
      "provider": "Российская государственная библиотека",
      "authorityId": "rsl",
      "authorityTier": "A",
      "market": "RU",
      "language": "ru",
      "recordKind": "national-bibliography",
      "recordId": "RSL-01002380533",
      "url": "https://search.rsl.ru/ru/record/01002380533",
      "fields": [
        "identity",
        "authorship",
        "title",
        "language",
        "market",
        "publication-year"
      ],
      "usage": "reference-only",
      "retrievedAt": "2026-09-04"
    },
    {
      "provider": "Издательство АСТ",
      "authorityId": "ast",
      "authorityTier": "B",
      "market": "RU",
      "language": "ru",
      "recordKind": "publisher-catalog",
      "recordId": "ISBN-9785171269272",
      "url": "https://ast.ru/book/khizhina-dyadi-toma-852431/",
      "fields": [
        "identity",
        "authorship",
        "title",
        "language",
        "market"
      ],
      "usage": "reference-only",
      "retrievedAt": "2026-09-04"
    },
    {
      "provider": "National Library of Ireland",
      "authorityId": "national-library-of-ireland",
      "authorityTier": "A",
      "market": "GB",
      "language": "en",
      "recordKind": "national-bibliography",
      "recordId": "NLI-vtls000157656",
      "url": "https://catalogue.nli.ie/Record/vtls000157656/StaffViewMARC",
      "fields": [
        "identity",
        "authorship",
        "title",
        "language",
        "market",
        "publication-year"
      ],
      "usage": "reference-only",
      "retrievedAt": "2026-09-04"
    },
    {
      "provider": "Everyman / Penguin Books UK",
      "authorityId": "penguin-uk",
      "authorityTier": "B",
      "market": "GB",
      "language": "en",
      "recordKind": "publisher-catalog",
      "recordId": "ISBN-9781857152067",
      "url": "https://www.penguin.co.uk/books/373025/uncle-toms-cabin-by-stoweharriet-beecher/9781857152067",
      "fields": [
        "identity",
        "authorship",
        "title",
        "language",
        "market",
        "publication-year"
      ],
      "usage": "reference-only",
      "retrievedAt": "2026-09-04"
    },
    {
      "provider": "Издательство Эксмо",
      "authorityId": "eksmo",
      "authorityTier": "B",
      "country": "russia",
      "market": "RU",
      "language": "ru",
      "recordKind": "publisher-catalog",
      "recordId": "ISBN-9785041738754",
      "url": "https://eksmo.ru/book/khizhina-dyadi-toma-ITD1299502/",
      "fields": [
        "identity",
        "authorship",
        "title",
        "language",
        "description"
      ],
      "usage": "reference-only",
      "retrievedAt": "2026-09-04"
    },
    {
      "provider": "Signet / Penguin Random House",
      "authorityId": "penguin-random-house",
      "authorityTier": "B",
      "country": "usa",
      "market": "US",
      "language": "en",
      "recordKind": "publisher-catalog",
      "recordId": "ISBN-9780451530806",
      "url": "https://www.penguinrandomhouse.com/books/301441/uncle-toms-cabin-by-harriet-beecher-stowe/",
      "fields": [
        "identity",
        "authorship",
        "title",
        "language",
        "publication-year",
        "description"
      ],
      "usage": "reference-only",
      "retrievedAt": "2026-09-04"
    },
    {
      "provider": "National Park Service",
      "authorityId": "us-national-park-service",
      "authorityTier": "B",
      "country": "usa",
      "market": "US",
      "language": "en",
      "recordKind": "authoritative-work-page",
      "recordId": "NPS-HARRIET-BEECHER-STOWE",
      "url": "https://www.nps.gov/people/harriet-beecher-stowe.htm",
      "fields": [
        "identity",
        "authorship",
        "publication-year",
        "description"
      ],
      "usage": "reference-only",
      "retrievedAt": "2026-09-04"
    },
    {
      "provider": "Library of Congress",
      "authorityId": "loc",
      "authorityTier": "A",
      "country": "usa",
      "language": "en",
      "recordKind": "authoritative-work-page",
      "recordId": "LOC-EXHIBIT-021.00.00",
      "url": "https://www.loc.gov/exhibits/books-that-shaped-america/1850-to-1900.html#obj2",
      "fields": [
        "identity",
        "authorship",
        "original-title",
        "publication-year"
      ],
      "usage": "reference-only",
      "retrievedAt": "2026-09-04"
    }
  ],
  "sourceUrl": "https://www.loc.gov/exhibits/books-that-shaped-america/1850-to-1900.html#obj2",
  "editorial": {
    "status": "verified",
    "reviewedAt": "2026-09-04"
  }
};

export function mergeBookR49nStoweRecovered20260912(countries: Country[]): Country[] {
  if (countries.filter(country => country.id === "usa").length !== 1) {
    throw new Error("r49n-stowe-country-cardinality");
  }
  return countries.map(country => {
    if (country.id !== "usa") return country;
    const matches = country.writers.filter(writer => writer.id === "harriet_beecher_stowe");
    if (matches.length > 1) throw new Error("r49n-stowe-writer-cardinality");
    const previous = matches[0];
    const works = previous?.workDetails || [];
    const matchingWorks = works.filter(work => work.id === retainedWork.id);
    if (matchingWorks.length > 1) throw new Error("r49n-stowe-work-cardinality");
    const writer: WriterProfile = {
      ...previous,
      id: "harriet_beecher_stowe",
      name: previous?.name || "Гарриет Бичер-Стоу",
      country: "usa",
      language: previous?.language || "английский",
      workDetails: matchingWorks.length
        ? works.map(work => work.id === retainedWork.id ? { ...work, ...retainedWork } : work)
        : [...works, retainedWork],
    };
    return {
      ...country,
      writers: previous
        ? country.writers.map(item => item.id === writer.id ? writer : item)
        : [...country.writers, writer],
    };
  });
}
