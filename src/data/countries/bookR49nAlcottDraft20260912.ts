import type { Country, WorkProfile, WriterProfile, WorkTranslationProfile, WorkDescriptionProvenanceProfile } from "./types";

type RetainedTranslation = Omit<WorkTranslationProfile, "descriptionProvenance"> & {
  descriptionProvenance?: WorkDescriptionProvenanceProfile & { primarySourceUrls?: string[] };
};
type RetainedWork = Omit<WorkProfile, "translations"> & {
  translations: Partial<Record<"ru" | "en", RetainedTranslation>>;
};

// First narrative (1868), retained from MASTER. The EN national-title gap remains open.
// Book/archive author identity only: no writer biography or new verification.
export const bookR49nAlcottDraft20260912Key = "usa:louisa_may_alcott:little-women";
const retainedWork: RetainedWork = {
  "id": "little-women",
  "title": "Маленькие женщины",
  "authorship": {
    "kind": "single",
    "authors": [
      {
        "countryId": "usa",
        "writerId": "louisa_may_alcott",
        "creditNames": {
          "ru": "Луиза Мэй Олкотт",
          "en": "Louisa May Alcott"
        },
        "attribution": "credited"
      }
    ]
  },
  "originalTitle": "Little Women, or, Meg, Jo, Beth, and Amy",
  "firstPublished": 1868,
  "originalLanguage": "английский",
  "genres": [
    "роман",
    "роман воспитания"
  ],
  "description": "Мег, Джо, Бет и Эми Марч растут рядом с матерью и ждут отца, ушедшего на войну. В первой книге о сёстрах, опубликованной в 1868 году, их разные характеры раскрываются в повседневных заботах и испытаниях: взрослея, девочки учатся справляться с лишениями, поддерживать близких и разбираться в собственных желаниях.",
  "translations": {
    "ru": {
      "locale": "ru",
      "title": "Маленькие женщины",
      "description": "Мег, Джо, Бет и Эми Марч растут рядом с матерью и ждут отца, ушедшего на войну. В первой книге о сёстрах, опубликованной в 1868 году, их разные характеры раскрываются в повседневных заботах и испытаниях: взрослея, девочки учатся справляться с лишениями, поддерживать близких и разбираться в собственных желаниях.",
      "sourceLanguage": "ru",
      "status": "draft",
      "method": "editorial-original",
      "sourceUrls": [
        "https://search.rsl.ru/ru/record/01009956741",
        "https://azbooka.ru/books/malenkie-zhenshchiny-nhmu",
        "https://www.loc.gov/exhibits/books-that-shaped-america/1850-to-1900.html#obj7"
      ],
      "titleEvidence": {
        "entityKind": "expression",
        "expressionId": "usa:louisa_may_alcott:little-women:ru",
        "locale": "ru",
        "value": "Маленькие женщины",
        "status": "verified-published",
        "expressionLanguage": "ru",
        "market": "RU",
        "selectionRule": "authoritative-uniform-title",
        "selectionNote": "Самостоятельная первая книга 1868 года. РГБ описывает издание 2019 года, а издатель — тираж 2026 года того же перевода Ирины Бессмертной и ISBN; даты и объём тиражей не объединяются. «Юные жены» продаются отдельно и в эту карточку не включены.",
        "evidence": [
          {
            "entityKind": "manifestation",
            "manifestationId": "rsl-01009956741",
            "sourceUrl": "https://search.rsl.ru/ru/record/01009956741",
            "provider": "Российская государственная библиотека",
            "authorityId": "rsl",
            "authorityTier": "A",
            "recordKind": "national-bibliography",
            "recordId": "RSL-01009956741",
            "catalogTitleExact": "Маленькие женщины",
            "locale": "ru",
            "market": "RU",
            "expressionLanguage": "ru",
            "isbn13": "9785389162839",
            "publisher": "Азбука : Азбука-Аттикус",
            "publicationYear": 2019,
            "translator": "Ирина Бессмертная",
            "retrievedAt": "2026-09-04",
            "checkedAt": "2026-09-04",
            "checkedBy": "Codex check_release_baseline research agent"
          },
          {
            "entityKind": "manifestation",
            "manifestationId": "isbn-9785389162839-printing-2026",
            "sourceUrl": "https://azbooka.ru/books/malenkie-zhenshchiny-nhmu",
            "provider": "Издательство Азбука",
            "authorityId": "azbooka",
            "authorityTier": "B",
            "recordKind": "publisher-catalog",
            "recordId": "ISBN-9785389162839",
            "catalogTitleExact": "Маленькие женщины",
            "locale": "ru",
            "market": "RU",
            "expressionLanguage": "ru",
            "isbn13": "9785389162839",
            "publisher": "Азбука",
            "publicationYear": 2026,
            "translator": "Ирина Бессмертная",
            "retrievedAt": "2026-09-04",
            "checkedAt": "2026-09-04",
            "checkedBy": "Codex check_release_baseline research agent"
          }
        ]
      },
      "descriptionProvenance": {
        "origin": "official-source-synthesis",
        "sourceLanguage": "ru",
        "sourceCountry": "usa",
        "primarySourceUrls": [
          "https://azbooka.ru/books/malenkie-zhenshchiny-nhmu"
        ],
        "sourceUrls": [
          "https://azbooka.ru/books/malenkie-zhenshchiny-nhmu",
          "https://www.loc.gov/exhibits/books-that-shaped-america/1850-to-1900.html#obj7"
        ],
        "transformations": [
          "condensed",
          "spoiler-limited",
          "style-edited"
        ],
        "rights": {
          "textOrigin": "project-original",
          "copiedSourceText": false
        },
        "author": "Codex check_release_baseline research agent",
        "createdAt": "2026-09-04",
        "reviewedBy": "Codex AI /root (independent review of research-agent draft)",
        "reviewedAt": "2026-09-04"
      }
    },
    "en": {
      "locale": "en",
      "title": "Little Women",
      "description": "While their father serves as a Civil War chaplain, Meg, Jo, Beth, and Amy March share a home with their mother and struggle with limited money and differing ambitions. This first narrative, published in 1868, follows the sisters' early coming of age as family duties, quarrels, friendships, and acts of generosity put their characters to the test.",
      "sourceLanguage": "en",
      "status": "draft",
      "method": "editorial-original",
      "sourceUrls": [
        "https://www.simonandschuster.com/books/Little-Women/Louisa-May-Alcott/The-Little-Women-Collection/9781534462212",
        "https://louisamayalcott.org/louisa-may-alcott",
        "https://www.loc.gov/exhibits/books-that-shaped-america/1850-to-1900.html#obj7"
      ],
      "descriptionProvenance": {
        "origin": "official-source-synthesis",
        "sourceLanguage": "en",
        "sourceCountry": "usa",
        "primarySourceUrls": [
          "https://www.simonandschuster.com/books/Little-Women/Louisa-May-Alcott/The-Little-Women-Collection/9781534462212"
        ],
        "sourceUrls": [
          "https://www.simonandschuster.com/books/Little-Women/Louisa-May-Alcott/The-Little-Women-Collection/9781534462212",
          "https://louisamayalcott.org/louisa-may-alcott"
        ],
        "transformations": [
          "condensed",
          "spoiler-limited",
          "style-edited"
        ],
        "rights": {
          "textOrigin": "project-original",
          "copiedSourceText": false
        },
        "author": "Codex check_release_baseline research agent",
        "createdAt": "2026-09-04",
        "reviewedBy": "Codex AI /root (independent review of research-agent draft)",
        "reviewedAt": "2026-09-04"
      }
    }
  },
  "localizedTitles": {
    "ru": {
      "entityKind": "expression",
      "expressionId": "usa:louisa_may_alcott:little-women:ru",
      "locale": "ru",
      "value": "Маленькие женщины",
      "status": "verified-published",
      "expressionLanguage": "ru",
      "market": "RU",
      "selectionRule": "authoritative-uniform-title",
      "selectionNote": "Самостоятельная первая книга 1868 года. РГБ описывает издание 2019 года, а издатель — тираж 2026 года того же перевода Ирины Бессмертной и ISBN; даты и объём тиражей не объединяются. «Юные жены» продаются отдельно и в эту карточку не включены.",
      "evidence": [
        {
          "entityKind": "manifestation",
          "manifestationId": "rsl-01009956741",
          "sourceUrl": "https://search.rsl.ru/ru/record/01009956741",
          "provider": "Российская государственная библиотека",
          "authorityId": "rsl",
          "authorityTier": "A",
          "recordKind": "national-bibliography",
          "recordId": "RSL-01009956741",
          "catalogTitleExact": "Маленькие женщины",
          "locale": "ru",
          "market": "RU",
          "expressionLanguage": "ru",
          "isbn13": "9785389162839",
          "publisher": "Азбука : Азбука-Аттикус",
          "publicationYear": 2019,
          "translator": "Ирина Бессмертная",
          "retrievedAt": "2026-09-04",
          "checkedAt": "2026-09-04",
          "checkedBy": "Codex check_release_baseline research agent"
        },
        {
          "entityKind": "manifestation",
          "manifestationId": "isbn-9785389162839-printing-2026",
          "sourceUrl": "https://azbooka.ru/books/malenkie-zhenshchiny-nhmu",
          "provider": "Издательство Азбука",
          "authorityId": "azbooka",
          "authorityTier": "B",
          "recordKind": "publisher-catalog",
          "recordId": "ISBN-9785389162839",
          "catalogTitleExact": "Маленькие женщины",
          "locale": "ru",
          "market": "RU",
          "expressionLanguage": "ru",
          "isbn13": "9785389162839",
          "publisher": "Азбука",
          "publicationYear": 2026,
          "translator": "Ирина Бессмертная",
          "retrievedAt": "2026-09-04",
          "checkedAt": "2026-09-04",
          "checkedBy": "Codex check_release_baseline research agent"
        }
      ]
    }
  },
  "sources": [
    {
      "provider": "Российская государственная библиотека",
      "authorityId": "rsl",
      "authorityTier": "A",
      "country": "russia",
      "market": "RU",
      "language": "ru",
      "recordKind": "national-bibliography",
      "recordId": "RSL-01009956741",
      "url": "https://search.rsl.ru/ru/record/01009956741",
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
      "provider": "Издательство Азбука",
      "authorityId": "azbooka",
      "authorityTier": "B",
      "country": "russia",
      "market": "RU",
      "language": "ru",
      "recordKind": "publisher-catalog",
      "recordId": "ISBN-9785389162839",
      "url": "https://azbooka.ru/books/malenkie-zhenshchiny-nhmu",
      "fields": [
        "identity",
        "authorship",
        "title",
        "language",
        "market",
        "publication-year",
        "description"
      ],
      "usage": "reference-only",
      "retrievedAt": "2026-09-04"
    },
    {
      "provider": "Aladdin / Simon & Schuster",
      "authorityId": "simon-schuster-us",
      "authorityTier": "B",
      "country": "usa",
      "market": "US",
      "language": "en",
      "recordKind": "publisher-catalog",
      "recordId": "ISBN-9781534462212",
      "url": "https://www.simonandschuster.com/books/Little-Women/Louisa-May-Alcott/The-Little-Women-Collection/9781534462212",
      "fields": [
        "identity",
        "authorship",
        "title",
        "language",
        "market",
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
      "market": "US",
      "language": "en",
      "recordKind": "authoritative-work-page",
      "recordId": "LOC-EXHIBIT-027.01.00",
      "url": "https://www.loc.gov/exhibits/books-that-shaped-america/1850-to-1900.html#obj7",
      "fields": [
        "identity",
        "authorship",
        "original-title",
        "publication-year",
        "description"
      ],
      "usage": "reference-only",
      "retrievedAt": "2026-09-04"
    },
    {
      "provider": "Louisa May Alcott's Orchard House",
      "authorityId": "louisa-may-alcott-orchard-house",
      "authorityTier": "B",
      "country": "usa",
      "market": "US",
      "language": "en",
      "recordKind": "authoritative-work-page",
      "recordId": "ORCHARD-HOUSE-LOUISA-MAY-ALCOTT",
      "url": "https://louisamayalcott.org/louisa-may-alcott",
      "fields": [
        "identity",
        "authorship",
        "publication-year",
        "description"
      ],
      "usage": "reference-only",
      "retrievedAt": "2026-09-04"
    }
  ],
  "sourceUrl": "https://www.loc.gov/exhibits/books-that-shaped-america/1850-to-1900.html#obj7",
  "editorial": {
    "status": "draft"
  }
};

export function mergeBookR49nAlcottDraft20260912(countries: Country[]): Country[] {
  if (countries.filter(country => country.id === "usa").length !== 1) {
    throw new Error("r49n-alcott-country-cardinality");
  }
  return countries.map(country => {
    if (country.id !== "usa") return country;
    const matches = country.writers.filter(writer => writer.id === "louisa_may_alcott");
    if (matches.length > 1) throw new Error("r49n-alcott-writer-cardinality");
    const previous = matches[0];
    const works = previous?.workDetails || [];
    const matchingWorks = works.filter(work => work.id === retainedWork.id);
    if (matchingWorks.length > 1) throw new Error("r49n-alcott-work-cardinality");
    // An existing authored record is never overwritten by this one-time addition.
    if (matchingWorks.length) return country;
    const writer: WriterProfile = {
      ...previous,
      id: "louisa_may_alcott",
      name: previous?.name || "Луиза Мэй Олкотт",
      country: "usa",
      language: previous?.language || "английский",
      workDetails: [...works, retainedWork],
    };
    return {
      ...country,
      writers: previous
        ? country.writers.map(item => item.id === writer.id ? writer : item)
        : [...country.writers, writer],
    };
  });
}
