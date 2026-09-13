import type { WorkProfile, WorkSourceProfile, WorkTranslationProfile, WorkDescriptionProvenanceProfile } from "./types";

// Reuses exact R49N MASTER texts and historical AI review metadata.
// Primary-language basis is retained without changing the shared evidence gate.
// Source master SHA256: f441344f6b4367684c8f5ec39f746f12c079ff05e5130b3183e06bab7c359674
// Historical proof snapshot: 94f8c6caecb3703e5a0d5ea7ecc90e155b1c10c2.
// This module is an additive candidate; wiring and publication are separate.
type ReviewedTranslation = Omit<WorkTranslationProfile, "descriptionProvenance"> & {
  descriptionProvenance?: WorkDescriptionProvenanceProfile & { primarySourceUrls?: string[] };
};
type ReviewedProfile = Pick<WorkProfile,
  "firstPublished" | "originalTitle" | "originalLanguage" | "description" |
  "localizedTitles" | "sources" | "editorial"
> & { translations: Partial<Record<"ru" | "en", ReviewedTranslation>> };

const reviewedProfiles: Record<string, ReviewedProfile> = {
  "france:jules_verne:the-mysterious-island-editorial": {
    "firstPublished": 1874,
    "originalTitle": "L’Île mystérieuse",
    "originalLanguage": "French",
    "description": "Во время Гражданской войны в США пятеро северян бегут из плена на воздушном шаре, но буря выбрасывает их на необитаемый остров. Оставшись почти без привычных средств к существованию, они устраивают жизнь заново, опираясь на знания, изобретательность и мужество.",
    "localizedTitles": {
      "ru": {
        "entityKind": "expression",
        "expressionId": "france:jules_verne:the-mysterious-island-editorial:ru",
        "locale": "ru",
        "value": "Таинственный остров",
        "status": "verified-published",
        "expressionLanguage": "Russian",
        "market": "RU",
        "selectionRule": "current-complete-authorized-edition",
        "selectionNote": "Published work title established by actual national record and independent official publisher. Edition dates, subtitles, catalog punctuation and website format labels are distinguished from the selected title. No spelling, author identity or edition match inferred from a search pointer.",
        "evidence": [
          {
            "entityKind": "manifestation",
            "manifestationId": "rsl-01008555566",
            "sourceUrl": "https://search.rsl.ru/ru/record/01008555566",
            "provider": "russian-state-library",
            "authorityId": "rsl",
            "authorityTier": "A",
            "recordKind": "national-bibliography",
            "recordId": "01008555566",
            "catalogTitleExact": "Таинственный остров",
            "locale": "ru",
            "market": "RU",
            "expressionLanguage": "Russian",
            "publisher": "Азбука",
            "publicationYear": 2016,
            "isbn13": "9785389068049",
            "editionStatement": "Actual indexed Russian national novel,637[1]pages,translation Marko Vovchok from French,printed2016.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)"
          },
          {
            "entityKind": "manifestation",
            "manifestationId": "eksmo-ISBN-9785041009908",
            "sourceUrl": "https://eksmo.ru/book/tainstvennyy-ostrov-ITD953417/",
            "provider": "eksmo-publishing",
            "authorityId": "eksmo",
            "authorityTier": "B",
            "recordKind": "publisher-catalog",
            "recordId": "ISBN-9785041009908",
            "catalogTitleExact": "Таинственный остров",
            "locale": "ru",
            "market": "RU",
            "expressionLanguage": "Russian",
            "publisher": "Эксмо",
            "publicationYear": 2019,
            "isbn13": "9785041009908",
            "editionStatement": "Actual publisher Russian heading,640pages,2019-01-18. Its incorrectly Russian original-language-title field is not adopted as the French original title.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)"
          }
        ]
      },
      "en": {
        "entityKind": "expression",
        "expressionId": "france:jules_verne:the-mysterious-island-editorial:en",
        "locale": "en",
        "value": "The Mysterious Island",
        "status": "verified-published",
        "expressionLanguage": "English",
        "market": "US",
        "selectionRule": "current-complete-authorized-edition",
        "selectionNote": "Published work title established by actual national record and independent official publisher. Edition dates, subtitles, catalog punctuation and website format labels are distinguished from the selected title. No spelling, author identity or edition match inferred from a search pointer.",
        "evidence": [
          {
            "entityKind": "manifestation",
            "manifestationId": "loc-LCCN-2001026939",
            "sourceUrl": "https://lccn.loc.gov/2001026939/marcxml",
            "provider": "library-of-congress",
            "authorityId": "loc",
            "authorityTier": "A",
            "recordKind": "national-bibliography",
            "recordId": "LCCN-2001026939",
            "catalogTitleExact": "The Mysterious Island",
            "locale": "en",
            "market": "US",
            "expressionLanguage": "English",
            "publisher": "Wesleyan University Press",
            "publicationYear": 2001,
            "isbn13": "9780819564757",
            "editionStatement": "Full MARC245 The mysterious island /;041 eng from fre;240 Ile mystérieuse. English;MiddletownConnecticut2001,li676pages,translator Sidney Kravitz,editor Arthur B.Evans,critical materials William Butcher. Publisher spelling Uniiversity in MARC is an obvious catalog typo normalized in institution name only.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)"
          },
          {
            "entityKind": "manifestation",
            "manifestationId": "penguin-random-house-ISBN-9780451529411",
            "sourceUrl": "https://www.penguinrandomhouse.com/books/292932/the-mysterious-island-by-jules-verne/",
            "provider": "penguin-random-house",
            "authorityId": "penguin-random-house",
            "authorityTier": "B",
            "recordKind": "publisher-catalog",
            "recordId": "ISBN-9780451529411",
            "catalogTitleExact": "The Mysterious Island",
            "locale": "en",
            "market": "US",
            "expressionLanguage": "English",
            "publisher": "Signet",
            "publicationYear": 2004,
            "isbn13": "9780451529411",
            "editionStatement": "Own heading/product2004-07-06,624pages, introduction Bruce Sterling,afterword Isaac Asimov. Different US translation/edition from Wesleyan national record; same novel title.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)"
          }
        ]
      }
    },
    "translations": {
      "ru": {
        "locale": "ru",
        "title": "Таинственный остров",
        "description": "Во время Гражданской войны в США пятеро северян бегут из плена на воздушном шаре, но буря выбрасывает их на необитаемый остров. Оставшись почти без привычных средств к существованию, они устраивают жизнь заново, опираясь на знания, изобретательность и мужество.",
        "sourceLanguage": "ru",
        "status": "reviewed",
        "sourceUrls": [
          "https://eksmo.ru/book/tainstvennyy-ostrov-ITD953417/",
          "https://www.penguinrandomhouse.com/books/292932/the-mysterious-island-by-jules-verne/",
          "https://jules-verne.net/l-oeuvre/les-voyages-extraordinaires/1874-1875-1-l-ile-mysterieuse/",
          "https://search.rsl.ru/ru/record/01008555566"
        ],
        "method": "editorial-original",
        "reviewedAt": "2026-09-05",
        "descriptionProvenance": {
          "origin": "official-source-synthesis",
          "sourceLanguage": "ru",
          "sourceCountry": "france",
          "sourceUrls": [
            "https://eksmo.ru/book/tainstvennyy-ostrov-ITD953417/",
            "https://www.penguinrandomhouse.com/books/292932/the-mysterious-island-by-jules-verne/",
            "https://jules-verne.net/l-oeuvre/les-voyages-extraordinaires/1874-1875-1-l-ile-mysterieuse/"
          ],
          "primarySourceUrls": [
            "https://eksmo.ru/book/tainstvennyy-ostrov-ITD953417/"
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
          "author": "Codex AI / review_ru_public_gaps",
          "createdAt": "2026-09-05",
          "reviewedBy": "Codex AI /root (independent review)",
          "reviewedAt": "2026-09-05"
        },
        "titleEvidence": {
          "entityKind": "expression",
          "expressionId": "france:jules_verne:the-mysterious-island-editorial:ru",
          "locale": "ru",
          "value": "Таинственный остров",
          "status": "verified-published",
          "expressionLanguage": "Russian",
          "market": "RU",
          "selectionRule": "current-complete-authorized-edition",
          "selectionNote": "Published work title established by actual national record and independent official publisher. Edition dates, subtitles, catalog punctuation and website format labels are distinguished from the selected title. No spelling, author identity or edition match inferred from a search pointer.",
          "evidence": [
            {
              "entityKind": "manifestation",
              "manifestationId": "rsl-01008555566",
              "sourceUrl": "https://search.rsl.ru/ru/record/01008555566",
              "provider": "russian-state-library",
              "authorityId": "rsl",
              "authorityTier": "A",
              "recordKind": "national-bibliography",
              "recordId": "01008555566",
              "catalogTitleExact": "Таинственный остров",
              "locale": "ru",
              "market": "RU",
              "expressionLanguage": "Russian",
              "publisher": "Азбука",
              "publicationYear": 2016,
              "isbn13": "9785389068049",
              "editionStatement": "Actual indexed Russian national novel,637[1]pages,translation Marko Vovchok from French,printed2016.",
              "retrievedAt": "2026-09-05",
              "checkedAt": "2026-09-05",
              "checkedBy": "Codex AI /root (bibliographic source review)"
            },
            {
              "entityKind": "manifestation",
              "manifestationId": "eksmo-ISBN-9785041009908",
              "sourceUrl": "https://eksmo.ru/book/tainstvennyy-ostrov-ITD953417/",
              "provider": "eksmo-publishing",
              "authorityId": "eksmo",
              "authorityTier": "B",
              "recordKind": "publisher-catalog",
              "recordId": "ISBN-9785041009908",
              "catalogTitleExact": "Таинственный остров",
              "locale": "ru",
              "market": "RU",
              "expressionLanguage": "Russian",
              "publisher": "Эксмо",
              "publicationYear": 2019,
              "isbn13": "9785041009908",
              "editionStatement": "Actual publisher Russian heading,640pages,2019-01-18. Its incorrectly Russian original-language-title field is not adopted as the French original title.",
              "retrievedAt": "2026-09-05",
              "checkedAt": "2026-09-05",
              "checkedBy": "Codex AI /root (bibliographic source review)"
            }
          ]
        }
      },
      "en": {
        "locale": "en",
        "title": "The Mysterious Island",
        "description": "Five Union prisoners escape from Richmond in a balloon, only to be carried by a violent storm to an uncharted island. With little beyond courage and ingenuity to sustain them, they face life far from civilization and the uncertainty of ever returning to it.",
        "sourceLanguage": "en",
        "status": "reviewed",
        "sourceUrls": [
          "https://www.penguinrandomhouse.com/books/292932/the-mysterious-island-by-jules-verne/",
          "https://eksmo.ru/book/tainstvennyy-ostrov-ITD953417/",
          "https://jules-verne.net/l-oeuvre/les-voyages-extraordinaires/1874-1875-1-l-ile-mysterieuse/",
          "https://lccn.loc.gov/2001026939/marcxml"
        ],
        "method": "editorial-original",
        "reviewedAt": "2026-09-05",
        "descriptionProvenance": {
          "origin": "official-source-synthesis",
          "sourceLanguage": "en",
          "sourceCountry": "france",
          "sourceUrls": [
            "https://eksmo.ru/book/tainstvennyy-ostrov-ITD953417/",
            "https://www.penguinrandomhouse.com/books/292932/the-mysterious-island-by-jules-verne/",
            "https://jules-verne.net/l-oeuvre/les-voyages-extraordinaires/1874-1875-1-l-ile-mysterieuse/"
          ],
          "primarySourceUrls": [
            "https://www.penguinrandomhouse.com/books/292932/the-mysterious-island-by-jules-verne/"
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
          "author": "Codex AI / review_ru_public_gaps",
          "createdAt": "2026-09-05",
          "reviewedBy": "Codex AI /root (independent review)",
          "reviewedAt": "2026-09-05"
        },
        "titleEvidence": {
          "entityKind": "expression",
          "expressionId": "france:jules_verne:the-mysterious-island-editorial:en",
          "locale": "en",
          "value": "The Mysterious Island",
          "status": "verified-published",
          "expressionLanguage": "English",
          "market": "US",
          "selectionRule": "current-complete-authorized-edition",
          "selectionNote": "Published work title established by actual national record and independent official publisher. Edition dates, subtitles, catalog punctuation and website format labels are distinguished from the selected title. No spelling, author identity or edition match inferred from a search pointer.",
          "evidence": [
            {
              "entityKind": "manifestation",
              "manifestationId": "loc-LCCN-2001026939",
              "sourceUrl": "https://lccn.loc.gov/2001026939/marcxml",
              "provider": "library-of-congress",
              "authorityId": "loc",
              "authorityTier": "A",
              "recordKind": "national-bibliography",
              "recordId": "LCCN-2001026939",
              "catalogTitleExact": "The Mysterious Island",
              "locale": "en",
              "market": "US",
              "expressionLanguage": "English",
              "publisher": "Wesleyan University Press",
              "publicationYear": 2001,
              "isbn13": "9780819564757",
              "editionStatement": "Full MARC245 The mysterious island /;041 eng from fre;240 Ile mystérieuse. English;MiddletownConnecticut2001,li676pages,translator Sidney Kravitz,editor Arthur B.Evans,critical materials William Butcher. Publisher spelling Uniiversity in MARC is an obvious catalog typo normalized in institution name only.",
              "retrievedAt": "2026-09-05",
              "checkedAt": "2026-09-05",
              "checkedBy": "Codex AI /root (bibliographic source review)"
            },
            {
              "entityKind": "manifestation",
              "manifestationId": "penguin-random-house-ISBN-9780451529411",
              "sourceUrl": "https://www.penguinrandomhouse.com/books/292932/the-mysterious-island-by-jules-verne/",
              "provider": "penguin-random-house",
              "authorityId": "penguin-random-house",
              "authorityTier": "B",
              "recordKind": "publisher-catalog",
              "recordId": "ISBN-9780451529411",
              "catalogTitleExact": "The Mysterious Island",
              "locale": "en",
              "market": "US",
              "expressionLanguage": "English",
              "publisher": "Signet",
              "publicationYear": 2004,
              "isbn13": "9780451529411",
              "editionStatement": "Own heading/product2004-07-06,624pages, introduction Bruce Sterling,afterword Isaac Asimov. Different US translation/edition from Wesleyan national record; same novel title.",
              "retrievedAt": "2026-09-05",
              "checkedAt": "2026-09-05",
              "checkedBy": "Codex AI /root (bibliographic source review)"
            }
          ]
        }
      }
    },
    "sources": [
      {
        "provider": "eksmo-publishing",
        "authorityId": "eksmo",
        "authorityTier": "B",
        "country": "russia",
        "language": "Russian",
        "recordKind": "publisher-catalog",
        "recordId": "ISBN-9785041009908",
        "url": "https://eksmo.ru/book/tainstvennyy-ostrov-ITD953417/",
        "fields": [
          "identity",
          "authorship",
          "description",
          "title",
          "language",
          "market"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05",
        "market": "RU"
      },
      {
        "provider": "penguin-random-house",
        "authorityId": "penguin-random-house",
        "authorityTier": "B",
        "country": "usa",
        "language": "English",
        "recordKind": "publisher-catalog",
        "recordId": "ISBN-9780451529411",
        "url": "https://www.penguinrandomhouse.com/books/292932/the-mysterious-island-by-jules-verne/",
        "fields": [
          "identity",
          "authorship",
          "description",
          "title",
          "language",
          "market"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05",
        "market": "US"
      },
      {
        "provider": "centre-international-jules-verne",
        "authorityId": "centre-international-jules-verne",
        "authorityTier": "B",
        "country": "france",
        "language": "fr",
        "market": "FR",
        "recordKind": "authoritative-work-page",
        "url": "https://jules-verne.net/l-oeuvre/les-voyages-extraordinaires/1874-1875-1-l-ile-mysterieuse/",
        "fields": [
          "identity",
          "authorship",
          "description",
          "publication-year",
          "genre",
          "original-title"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "russian-state-library",
        "authorityId": "rsl",
        "authorityTier": "A",
        "recordId": "01008555566",
        "recordKind": "national-bibliography",
        "url": "https://search.rsl.ru/ru/record/01008555566",
        "language": "Russian",
        "market": "RU",
        "fields": [
          "identity",
          "authorship",
          "title",
          "language",
          "market",
          "genre"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "library-of-congress",
        "authorityId": "loc",
        "authorityTier": "A",
        "recordId": "LCCN-2001026939",
        "recordKind": "national-bibliography",
        "url": "https://lccn.loc.gov/2001026939/marcxml",
        "language": "English",
        "market": "US",
        "fields": [
          "identity",
          "authorship",
          "title",
          "language",
          "market"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      }
    ],
    "editorial": {
      "status": "reviewed",
      "reviewedAt": "2026-09-05"
    }
  },
  "france:jules_verne:openlibrary-works-ol1099513w": {
    "firstPublished": 1864,
    "originalTitle": "Voyage au centre de la Terre",
    "originalLanguage": "French",
    "description": "Профессор Отто Лиденброк и его племянник Аксель расшифровывают старинную рукопись, в которой указан путь в глубины Земли. Спуск в кратер исландского вулкана открывает для них неведомый мир, где научное любопытство оборачивается встречей с опасностями, которых они не могли предвидеть.",
    "localizedTitles": {
      "ru": {
        "entityKind": "expression",
        "expressionId": "france:jules_verne:openlibrary-works-ol1099513w:ru",
        "locale": "ru",
        "value": "Путешествие к центру Земли",
        "status": "verified-published",
        "expressionLanguage": "Russian",
        "market": "RU",
        "selectionRule": "current-complete-authorized-edition",
        "selectionNote": "Published work title established by actual national record and independent official publisher. Edition dates, subtitles, catalog punctuation and website format labels are distinguished from the selected title. No spelling, author identity or edition match inferred from a search pointer.",
        "evidence": [
          {
            "entityKind": "manifestation",
            "manifestationId": "rsl-01004655552",
            "sourceUrl": "https://search.rsl.ru/ru/record/01004655552",
            "provider": "russian-state-library",
            "authorityId": "rsl",
            "authorityTier": "A",
            "recordKind": "national-bibliography",
            "recordId": "01004655552",
            "catalogTitleExact": "Путешествие к центру Земли",
            "locale": "ru",
            "market": "RU",
            "expressionLanguage": "Russian",
            "publisher": "АСТ; Полиграфиздат",
            "publicationYear": 2010,
            "isbn13": "9785170649068",
            "editionStatement": "Actual indexed Russian national record:284,[3]pages, translation N.A.Egorov from French.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)"
          },
          {
            "entityKind": "manifestation",
            "manifestationId": "ast-ISBN-9785170992683",
            "sourceUrl": "https://ast.ru/book/puteshestvie-k-tsentru-zemli-725471/",
            "provider": "ast-publishing",
            "authorityId": "ast",
            "authorityTier": "B",
            "recordKind": "publisher-catalog",
            "recordId": "ISBN-9785170992683",
            "catalogTitleExact": "Путешествие к центру Земли",
            "locale": "ru",
            "market": "RU",
            "expressionLanguage": "Russian",
            "publisher": "АСТ",
            "isbn13": "9785170992683",
            "editionStatement": "Actual indexed own heading and product ISBN,288pages; not the separate publisher page with a film-like synopsis.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)"
          }
        ]
      },
      "en": {
        "entityKind": "expression",
        "expressionId": "france:jules_verne:openlibrary-works-ol1099513w:en",
        "locale": "en",
        "value": "Journey to the Centre of the Earth",
        "status": "verified-published",
        "expressionLanguage": "English",
        "market": "US",
        "selectionRule": "current-complete-authorized-edition",
        "selectionNote": "Published work title established by actual national record and independent official publisher. Edition dates, subtitles, catalog punctuation and website format labels are distinguished from the selected title. No spelling, author identity or edition match inferred from a search pointer.",
        "evidence": [
          {
            "entityKind": "manifestation",
            "manifestationId": "loc-LCCN-2003059947",
            "sourceUrl": "https://lccn.loc.gov/2003059947/marcxml",
            "provider": "library-of-congress",
            "authorityId": "loc",
            "authorityTier": "A",
            "recordKind": "national-bibliography",
            "recordId": "LCCN-2003059947",
            "catalogTitleExact": "Journey to the Centre of the Earth",
            "locale": "en",
            "market": "US",
            "expressionLanguage": "English",
            "publisher": "Modern Library",
            "publicationYear": 2003,
            "isbn13": "9780812970098",
            "editionStatement": "MARC245$a Journey to the centre of the earth /;041 English from French;240 original French title;New York2003,Modern Library paperback, xv195[3]pages, introduction David Brin.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)"
          },
          {
            "entityKind": "manifestation",
            "manifestationId": "penguin-random-house-ISBN-9780812970098",
            "sourceUrl": "https://www.penguinrandomhouse.com/books/183632/journey-to-the-centre-of-the-earth-by-jules-verne/",
            "provider": "penguin-random-house",
            "authorityId": "penguin-random-house",
            "authorityTier": "B",
            "recordKind": "publisher-catalog",
            "recordId": "ISBN-9780812970098",
            "catalogTitleExact": "Journey to the Centre of the Earth",
            "locale": "en",
            "market": "US",
            "expressionLanguage": "English",
            "publisher": "Modern Library",
            "publicationYear": 2003,
            "isbn13": "9780812970098",
            "editionStatement": "Own heading and product:2003-12-09,224pages. Publisher and catalog pagination differ; no fabricated reconciliation.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)"
          }
        ]
      }
    },
    "translations": {
      "ru": {
        "locale": "ru",
        "title": "Путешествие к центру Земли",
        "description": "Профессор Отто Лиденброк и его племянник Аксель расшифровывают старинную рукопись, в которой указан путь в глубины Земли. Спуск в кратер исландского вулкана открывает для них неведомый мир, где научное любопытство оборачивается встречей с опасностями, которых они не могли предвидеть.",
        "sourceLanguage": "ru",
        "status": "reviewed",
        "sourceUrls": [
          "https://azbooka.ru/books/pyteshestvie-k-tsentry-zemli-vokryg-sveta-v-vosemdesyat-dney",
          "https://www.penguinrandomhouse.com/books/832262/journey-to-the-centre-of-the-earth-by-jules-verne/",
          "https://jules-verne.net/l-oeuvre/les-voyages-extraordinaires/1864-voyage-au-centre-de-la-terre/",
          "https://search.rsl.ru/ru/record/01004655552",
          "https://ast.ru/book/puteshestvie-k-tsentru-zemli-725471/"
        ],
        "method": "editorial-original",
        "reviewedAt": "2026-09-05",
        "descriptionProvenance": {
          "origin": "official-source-synthesis",
          "sourceLanguage": "ru",
          "sourceCountry": "france",
          "sourceUrls": [
            "https://azbooka.ru/books/pyteshestvie-k-tsentry-zemli-vokryg-sveta-v-vosemdesyat-dney",
            "https://www.penguinrandomhouse.com/books/832262/journey-to-the-centre-of-the-earth-by-jules-verne/",
            "https://jules-verne.net/l-oeuvre/les-voyages-extraordinaires/1864-voyage-au-centre-de-la-terre/"
          ],
          "primarySourceUrls": [
            "https://azbooka.ru/books/pyteshestvie-k-tsentry-zemli-vokryg-sveta-v-vosemdesyat-dney"
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
          "author": "Codex AI / review_ru_public_gaps",
          "createdAt": "2026-09-05",
          "reviewedBy": "Codex AI /root (independent review)",
          "reviewedAt": "2026-09-05"
        },
        "titleEvidence": {
          "entityKind": "expression",
          "expressionId": "france:jules_verne:openlibrary-works-ol1099513w:ru",
          "locale": "ru",
          "value": "Путешествие к центру Земли",
          "status": "verified-published",
          "expressionLanguage": "Russian",
          "market": "RU",
          "selectionRule": "current-complete-authorized-edition",
          "selectionNote": "Published work title established by actual national record and independent official publisher. Edition dates, subtitles, catalog punctuation and website format labels are distinguished from the selected title. No spelling, author identity or edition match inferred from a search pointer.",
          "evidence": [
            {
              "entityKind": "manifestation",
              "manifestationId": "rsl-01004655552",
              "sourceUrl": "https://search.rsl.ru/ru/record/01004655552",
              "provider": "russian-state-library",
              "authorityId": "rsl",
              "authorityTier": "A",
              "recordKind": "national-bibliography",
              "recordId": "01004655552",
              "catalogTitleExact": "Путешествие к центру Земли",
              "locale": "ru",
              "market": "RU",
              "expressionLanguage": "Russian",
              "publisher": "АСТ; Полиграфиздат",
              "publicationYear": 2010,
              "isbn13": "9785170649068",
              "editionStatement": "Actual indexed Russian national record:284,[3]pages, translation N.A.Egorov from French.",
              "retrievedAt": "2026-09-05",
              "checkedAt": "2026-09-05",
              "checkedBy": "Codex AI /root (bibliographic source review)"
            },
            {
              "entityKind": "manifestation",
              "manifestationId": "ast-ISBN-9785170992683",
              "sourceUrl": "https://ast.ru/book/puteshestvie-k-tsentru-zemli-725471/",
              "provider": "ast-publishing",
              "authorityId": "ast",
              "authorityTier": "B",
              "recordKind": "publisher-catalog",
              "recordId": "ISBN-9785170992683",
              "catalogTitleExact": "Путешествие к центру Земли",
              "locale": "ru",
              "market": "RU",
              "expressionLanguage": "Russian",
              "publisher": "АСТ",
              "isbn13": "9785170992683",
              "editionStatement": "Actual indexed own heading and product ISBN,288pages; not the separate publisher page with a film-like synopsis.",
              "retrievedAt": "2026-09-05",
              "checkedAt": "2026-09-05",
              "checkedBy": "Codex AI /root (bibliographic source review)"
            }
          ]
        }
      },
      "en": {
        "locale": "en",
        "title": "Journey to the Centre of the Earth",
        "description": "A coded message sends Professor Lidenbrock, his nephew Axel and their guide Hans in search of a passage to the Earth's core. Their descent leads through underground seas and landscapes inhabited by prehistoric creatures, turning a scientific expedition into a perilous journey through an unknown world.",
        "sourceLanguage": "en",
        "status": "reviewed",
        "sourceUrls": [
          "https://www.penguinrandomhouse.com/books/832262/journey-to-the-centre-of-the-earth-by-jules-verne/",
          "https://azbooka.ru/books/pyteshestvie-k-tsentry-zemli-vokryg-sveta-v-vosemdesyat-dney",
          "https://jules-verne.net/l-oeuvre/les-voyages-extraordinaires/1864-voyage-au-centre-de-la-terre/",
          "https://lccn.loc.gov/2003059947/marcxml",
          "https://www.penguinrandomhouse.com/books/183632/journey-to-the-centre-of-the-earth-by-jules-verne/"
        ],
        "method": "editorial-original",
        "reviewedAt": "2026-09-05",
        "descriptionProvenance": {
          "origin": "official-source-synthesis",
          "sourceLanguage": "en",
          "sourceCountry": "france",
          "sourceUrls": [
            "https://azbooka.ru/books/pyteshestvie-k-tsentry-zemli-vokryg-sveta-v-vosemdesyat-dney",
            "https://www.penguinrandomhouse.com/books/832262/journey-to-the-centre-of-the-earth-by-jules-verne/",
            "https://jules-verne.net/l-oeuvre/les-voyages-extraordinaires/1864-voyage-au-centre-de-la-terre/"
          ],
          "primarySourceUrls": [
            "https://www.penguinrandomhouse.com/books/832262/journey-to-the-centre-of-the-earth-by-jules-verne/"
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
          "author": "Codex AI / review_ru_public_gaps",
          "createdAt": "2026-09-05",
          "reviewedBy": "Codex AI /root (independent review)",
          "reviewedAt": "2026-09-05"
        },
        "titleEvidence": {
          "entityKind": "expression",
          "expressionId": "france:jules_verne:openlibrary-works-ol1099513w:en",
          "locale": "en",
          "value": "Journey to the Centre of the Earth",
          "status": "verified-published",
          "expressionLanguage": "English",
          "market": "US",
          "selectionRule": "current-complete-authorized-edition",
          "selectionNote": "Published work title established by actual national record and independent official publisher. Edition dates, subtitles, catalog punctuation and website format labels are distinguished from the selected title. No spelling, author identity or edition match inferred from a search pointer.",
          "evidence": [
            {
              "entityKind": "manifestation",
              "manifestationId": "loc-LCCN-2003059947",
              "sourceUrl": "https://lccn.loc.gov/2003059947/marcxml",
              "provider": "library-of-congress",
              "authorityId": "loc",
              "authorityTier": "A",
              "recordKind": "national-bibliography",
              "recordId": "LCCN-2003059947",
              "catalogTitleExact": "Journey to the Centre of the Earth",
              "locale": "en",
              "market": "US",
              "expressionLanguage": "English",
              "publisher": "Modern Library",
              "publicationYear": 2003,
              "isbn13": "9780812970098",
              "editionStatement": "MARC245$a Journey to the centre of the earth /;041 English from French;240 original French title;New York2003,Modern Library paperback, xv195[3]pages, introduction David Brin.",
              "retrievedAt": "2026-09-05",
              "checkedAt": "2026-09-05",
              "checkedBy": "Codex AI /root (bibliographic source review)"
            },
            {
              "entityKind": "manifestation",
              "manifestationId": "penguin-random-house-ISBN-9780812970098",
              "sourceUrl": "https://www.penguinrandomhouse.com/books/183632/journey-to-the-centre-of-the-earth-by-jules-verne/",
              "provider": "penguin-random-house",
              "authorityId": "penguin-random-house",
              "authorityTier": "B",
              "recordKind": "publisher-catalog",
              "recordId": "ISBN-9780812970098",
              "catalogTitleExact": "Journey to the Centre of the Earth",
              "locale": "en",
              "market": "US",
              "expressionLanguage": "English",
              "publisher": "Modern Library",
              "publicationYear": 2003,
              "isbn13": "9780812970098",
              "editionStatement": "Own heading and product:2003-12-09,224pages. Publisher and catalog pagination differ; no fabricated reconciliation.",
              "retrievedAt": "2026-09-05",
              "checkedAt": "2026-09-05",
              "checkedBy": "Codex AI /root (bibliographic source review)"
            }
          ]
        }
      }
    },
    "sources": [
      {
        "provider": "azbooka-atticus",
        "authorityId": "azbooka",
        "authorityTier": "B",
        "country": "russia",
        "language": "ru",
        "recordKind": "publisher-catalog",
        "recordId": "ISBN-9785389315822",
        "url": "https://azbooka.ru/books/pyteshestvie-k-tsentry-zemli-vokryg-sveta-v-vosemdesyat-dney",
        "fields": [
          "identity",
          "authorship",
          "description"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "penguin-random-house",
        "authorityId": "penguin-random-house",
        "authorityTier": "B",
        "country": "usa",
        "language": "en",
        "recordKind": "publisher-catalog",
        "recordId": "ISBN-9788175994058",
        "url": "https://www.penguinrandomhouse.com/books/832262/journey-to-the-centre-of-the-earth-by-jules-verne/",
        "fields": [
          "identity",
          "authorship",
          "description"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "centre-international-jules-verne",
        "authorityId": "centre-international-jules-verne",
        "authorityTier": "B",
        "country": "france",
        "language": "fr",
        "market": "FR",
        "recordKind": "authoritative-work-page",
        "url": "https://jules-verne.net/l-oeuvre/les-voyages-extraordinaires/1864-voyage-au-centre-de-la-terre/",
        "fields": [
          "identity",
          "authorship",
          "description",
          "publication-year",
          "genre",
          "original-title"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "russian-state-library",
        "authorityId": "rsl",
        "authorityTier": "A",
        "recordId": "01004655552",
        "recordKind": "national-bibliography",
        "url": "https://search.rsl.ru/ru/record/01004655552",
        "language": "Russian",
        "market": "RU",
        "fields": [
          "identity",
          "authorship",
          "title",
          "language",
          "market",
          "genre"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "ast-publishing",
        "authorityId": "ast",
        "authorityTier": "B",
        "recordId": "ISBN-9785170992683",
        "recordKind": "publisher-catalog",
        "url": "https://ast.ru/book/puteshestvie-k-tsentru-zemli-725471/",
        "language": "Russian",
        "market": "RU",
        "fields": [
          "identity",
          "authorship",
          "title",
          "language",
          "market"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "library-of-congress",
        "authorityId": "loc",
        "authorityTier": "A",
        "recordId": "LCCN-2003059947",
        "recordKind": "national-bibliography",
        "url": "https://lccn.loc.gov/2003059947/marcxml",
        "language": "English",
        "market": "US",
        "fields": [
          "identity",
          "authorship",
          "title",
          "language",
          "market"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "penguin-random-house",
        "authorityId": "penguin-random-house",
        "authorityTier": "B",
        "recordId": "ISBN-9780812970098",
        "recordKind": "publisher-catalog",
        "url": "https://www.penguinrandomhouse.com/books/183632/journey-to-the-centre-of-the-earth-by-jules-verne/",
        "language": "English",
        "market": "US",
        "fields": [
          "identity",
          "authorship",
          "title",
          "language",
          "market"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      }
    ],
    "editorial": {
      "status": "reviewed",
      "reviewedAt": "2026-09-05"
    }
  },
  "france:jules_verne:openlibrary-works-ol1100007w": {
    "firstPublished": 1872,
    "originalTitle": "Le Tour du monde en quatre-vingts jours",
    "originalLanguage": "French",
    "description": "Лондонский джентльмен Филеас Фогг заключает необычное пари и вместе со слугой Жаном Паспарту отправляется в кругосветное путешествие, на которое отведено восемьдесят дней. Пока они пересекают страны и континенты, за ними следует сыщик Фикс, превращая и без того стремительную поездку в историю преследования.",
    "localizedTitles": {
      "ru": {
        "entityKind": "expression",
        "expressionId": "france:jules_verne:openlibrary-works-ol1100007w:ru",
        "locale": "ru",
        "value": "Вокруг света в восемьдесят дней",
        "status": "verified-published",
        "expressionLanguage": "Russian",
        "market": "RU",
        "selectionRule": "current-complete-authorized-edition",
        "selectionNote": "Published work title established by actual national record and independent official publisher. Edition dates, subtitles, catalog punctuation and website format labels are distinguished from the selected title. No spelling, author identity or edition match inferred from a search pointer.",
        "evidence": [
          {
            "entityKind": "manifestation",
            "manifestationId": "rsl-01008020923",
            "sourceUrl": "https://search.rsl.ru/ru/record/01008020923",
            "provider": "russian-state-library",
            "authorityId": "rsl",
            "authorityTier": "A",
            "recordKind": "national-bibliography",
            "recordId": "01008020923",
            "catalogTitleExact": "Вокруг света в восемьдесят дней",
            "locale": "ru",
            "market": "RU",
            "expressionLanguage": "Russian",
            "publisher": "Азбука",
            "publicationYear": 2015,
            "isbn13": "9785389103009",
            "editionStatement": "Actual indexed Russian national record: novel, translation N.Gabinsky from French,283[1]pages.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)"
          },
          {
            "entityKind": "manifestation",
            "manifestationId": "azbooka-ISBN-9785389068292",
            "sourceUrl": "https://azbooka.ru/books/vokrug-sveta-v-vosemdesyat-dney-tulu",
            "provider": "azbooka-atticus",
            "authorityId": "azbooka",
            "authorityTier": "B",
            "recordKind": "publisher-catalog",
            "recordId": "ISBN-9785389068292",
            "catalogTitleExact": "Вокруг света в восемьдесят дней",
            "locale": "ru",
            "market": "RU",
            "expressionLanguage": "Russian",
            "publisher": "Азбука",
            "publicationYear": 2014,
            "isbn13": "9785389068292",
            "editionStatement": "Actual publisher book title,2014,288pages; archive is website stock category, not a word in the published title.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)"
          }
        ]
      },
      "en": {
        "entityKind": "expression",
        "expressionId": "france:jules_verne:openlibrary-works-ol1100007w:en",
        "locale": "en",
        "value": "Around the World in Eighty Days",
        "status": "verified-published",
        "expressionLanguage": "English",
        "market": "US",
        "selectionRule": "current-complete-authorized-edition",
        "selectionNote": "Published work title established by actual national record and independent official publisher. Edition dates, subtitles, catalog punctuation and website format labels are distinguished from the selected title. No spelling, author identity or edition match inferred from a search pointer.",
        "evidence": [
          {
            "entityKind": "manifestation",
            "manifestationId": "loc-LCCN-2007281190",
            "sourceUrl": "https://lccn.loc.gov/2007281190/marcxml",
            "provider": "library-of-congress",
            "authorityId": "loc",
            "authorityTier": "A",
            "recordKind": "national-bibliography",
            "recordId": "LCCN-2007281190",
            "catalogTitleExact": "Around the World in Eighty Days",
            "locale": "en",
            "market": "US",
            "expressionLanguage": "English",
            "publisher": "Pocket Books",
            "publicationYear": 2007,
            "isbn13": "9781416534723",
            "editionStatement": "MARC245$a Around the world in eighty days /;041 eng from fre;New York2007,Pocket paperback,267pages, supplementary materials Heather Wilkinson.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)"
          },
          {
            "entityKind": "manifestation",
            "manifestationId": "simon-schuster-us-ISBN-9781416534723",
            "sourceUrl": "https://www.simonandschuster.com/books/Around-the-World-in-Eighty-Days/Jules-Verne/Enriched-Classics/9781416534723",
            "provider": "simon-and-schuster-us",
            "authorityId": "simon-schuster-us",
            "authorityTier": "B",
            "recordKind": "publisher-catalog",
            "recordId": "ISBN-9781416534723",
            "catalogTitleExact": "Around the World in Eighty Days",
            "locale": "en",
            "market": "US",
            "expressionLanguage": "English",
            "publisher": "Simon & Schuster",
            "publicationYear": 2007,
            "isbn13": "9781416534723",
            "editionStatement": "Actual own heading,2007-05-01,288pages. Catalog imprint Pocket Books and publisher group label kept separately; pagination difference retained. Source mentions1873 book publication, not first serial1872.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)"
          }
        ]
      }
    },
    "translations": {
      "ru": {
        "locale": "ru",
        "title": "Вокруг света в восемьдесят дней",
        "description": "Лондонский джентльмен Филеас Фогг заключает необычное пари и вместе со слугой Жаном Паспарту отправляется в кругосветное путешествие, на которое отведено восемьдесят дней. Пока они пересекают страны и континенты, за ними следует сыщик Фикс, превращая и без того стремительную поездку в историю преследования.",
        "sourceLanguage": "ru",
        "status": "reviewed",
        "sourceUrls": [
          "https://azbooka.ru/books/pyteshestvie-k-tsentry-zemli-vokryg-sveta-v-vosemdesyat-dney",
          "https://www.penguinrandomhouse.com/books/832259/around-the-world-in-eighty-days-by-jules-verne/",
          "https://jules-verne.net/l-oeuvre/les-voyages-extraordinaires/1872-1873-1-le-tour-du-monde-en-quatre-vingts-jours/",
          "https://search.rsl.ru/ru/record/01008020923",
          "https://azbooka.ru/books/vokrug-sveta-v-vosemdesyat-dney-tulu"
        ],
        "method": "editorial-original",
        "reviewedAt": "2026-09-05",
        "descriptionProvenance": {
          "origin": "official-source-synthesis",
          "sourceLanguage": "ru",
          "sourceCountry": "france",
          "sourceUrls": [
            "https://azbooka.ru/books/pyteshestvie-k-tsentry-zemli-vokryg-sveta-v-vosemdesyat-dney",
            "https://www.penguinrandomhouse.com/books/832259/around-the-world-in-eighty-days-by-jules-verne/",
            "https://jules-verne.net/l-oeuvre/les-voyages-extraordinaires/1872-1873-1-le-tour-du-monde-en-quatre-vingts-jours/"
          ],
          "primarySourceUrls": [
            "https://azbooka.ru/books/pyteshestvie-k-tsentry-zemli-vokryg-sveta-v-vosemdesyat-dney"
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
          "author": "Codex AI / review_ru_public_gaps",
          "createdAt": "2026-09-05",
          "reviewedBy": "Codex AI /root (independent review)",
          "reviewedAt": "2026-09-05"
        },
        "titleEvidence": {
          "entityKind": "expression",
          "expressionId": "france:jules_verne:openlibrary-works-ol1100007w:ru",
          "locale": "ru",
          "value": "Вокруг света в восемьдесят дней",
          "status": "verified-published",
          "expressionLanguage": "Russian",
          "market": "RU",
          "selectionRule": "current-complete-authorized-edition",
          "selectionNote": "Published work title established by actual national record and independent official publisher. Edition dates, subtitles, catalog punctuation and website format labels are distinguished from the selected title. No spelling, author identity or edition match inferred from a search pointer.",
          "evidence": [
            {
              "entityKind": "manifestation",
              "manifestationId": "rsl-01008020923",
              "sourceUrl": "https://search.rsl.ru/ru/record/01008020923",
              "provider": "russian-state-library",
              "authorityId": "rsl",
              "authorityTier": "A",
              "recordKind": "national-bibliography",
              "recordId": "01008020923",
              "catalogTitleExact": "Вокруг света в восемьдесят дней",
              "locale": "ru",
              "market": "RU",
              "expressionLanguage": "Russian",
              "publisher": "Азбука",
              "publicationYear": 2015,
              "isbn13": "9785389103009",
              "editionStatement": "Actual indexed Russian national record: novel, translation N.Gabinsky from French,283[1]pages.",
              "retrievedAt": "2026-09-05",
              "checkedAt": "2026-09-05",
              "checkedBy": "Codex AI /root (bibliographic source review)"
            },
            {
              "entityKind": "manifestation",
              "manifestationId": "azbooka-ISBN-9785389068292",
              "sourceUrl": "https://azbooka.ru/books/vokrug-sveta-v-vosemdesyat-dney-tulu",
              "provider": "azbooka-atticus",
              "authorityId": "azbooka",
              "authorityTier": "B",
              "recordKind": "publisher-catalog",
              "recordId": "ISBN-9785389068292",
              "catalogTitleExact": "Вокруг света в восемьдесят дней",
              "locale": "ru",
              "market": "RU",
              "expressionLanguage": "Russian",
              "publisher": "Азбука",
              "publicationYear": 2014,
              "isbn13": "9785389068292",
              "editionStatement": "Actual publisher book title,2014,288pages; archive is website stock category, not a word in the published title.",
              "retrievedAt": "2026-09-05",
              "checkedAt": "2026-09-05",
              "checkedBy": "Codex AI /root (bibliographic source review)"
            }
          ]
        }
      },
      "en": {
        "locale": "en",
        "title": "Around the World in Eighty Days",
        "description": "Phileas Fogg and his French valet Passepartout set out to circle the globe in eighty days and win a wager. Travelling by railway, steamship and even elephant, they face unexpected detours and encounters in an adventure that mixes a race against time with humour and romance.",
        "sourceLanguage": "en",
        "status": "reviewed",
        "sourceUrls": [
          "https://www.penguinrandomhouse.com/books/832259/around-the-world-in-eighty-days-by-jules-verne/",
          "https://azbooka.ru/books/pyteshestvie-k-tsentry-zemli-vokryg-sveta-v-vosemdesyat-dney",
          "https://jules-verne.net/l-oeuvre/les-voyages-extraordinaires/1872-1873-1-le-tour-du-monde-en-quatre-vingts-jours/",
          "https://lccn.loc.gov/2007281190/marcxml",
          "https://www.simonandschuster.com/books/Around-the-World-in-Eighty-Days/Jules-Verne/Enriched-Classics/9781416534723"
        ],
        "method": "editorial-original",
        "reviewedAt": "2026-09-05",
        "descriptionProvenance": {
          "origin": "official-source-synthesis",
          "sourceLanguage": "en",
          "sourceCountry": "france",
          "sourceUrls": [
            "https://azbooka.ru/books/pyteshestvie-k-tsentry-zemli-vokryg-sveta-v-vosemdesyat-dney",
            "https://www.penguinrandomhouse.com/books/832259/around-the-world-in-eighty-days-by-jules-verne/",
            "https://jules-verne.net/l-oeuvre/les-voyages-extraordinaires/1872-1873-1-le-tour-du-monde-en-quatre-vingts-jours/"
          ],
          "primarySourceUrls": [
            "https://www.penguinrandomhouse.com/books/832259/around-the-world-in-eighty-days-by-jules-verne/"
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
          "author": "Codex AI / review_ru_public_gaps",
          "createdAt": "2026-09-05",
          "reviewedBy": "Codex AI /root (independent review)",
          "reviewedAt": "2026-09-05"
        },
        "titleEvidence": {
          "entityKind": "expression",
          "expressionId": "france:jules_verne:openlibrary-works-ol1100007w:en",
          "locale": "en",
          "value": "Around the World in Eighty Days",
          "status": "verified-published",
          "expressionLanguage": "English",
          "market": "US",
          "selectionRule": "current-complete-authorized-edition",
          "selectionNote": "Published work title established by actual national record and independent official publisher. Edition dates, subtitles, catalog punctuation and website format labels are distinguished from the selected title. No spelling, author identity or edition match inferred from a search pointer.",
          "evidence": [
            {
              "entityKind": "manifestation",
              "manifestationId": "loc-LCCN-2007281190",
              "sourceUrl": "https://lccn.loc.gov/2007281190/marcxml",
              "provider": "library-of-congress",
              "authorityId": "loc",
              "authorityTier": "A",
              "recordKind": "national-bibliography",
              "recordId": "LCCN-2007281190",
              "catalogTitleExact": "Around the World in Eighty Days",
              "locale": "en",
              "market": "US",
              "expressionLanguage": "English",
              "publisher": "Pocket Books",
              "publicationYear": 2007,
              "isbn13": "9781416534723",
              "editionStatement": "MARC245$a Around the world in eighty days /;041 eng from fre;New York2007,Pocket paperback,267pages, supplementary materials Heather Wilkinson.",
              "retrievedAt": "2026-09-05",
              "checkedAt": "2026-09-05",
              "checkedBy": "Codex AI /root (bibliographic source review)"
            },
            {
              "entityKind": "manifestation",
              "manifestationId": "simon-schuster-us-ISBN-9781416534723",
              "sourceUrl": "https://www.simonandschuster.com/books/Around-the-World-in-Eighty-Days/Jules-Verne/Enriched-Classics/9781416534723",
              "provider": "simon-and-schuster-us",
              "authorityId": "simon-schuster-us",
              "authorityTier": "B",
              "recordKind": "publisher-catalog",
              "recordId": "ISBN-9781416534723",
              "catalogTitleExact": "Around the World in Eighty Days",
              "locale": "en",
              "market": "US",
              "expressionLanguage": "English",
              "publisher": "Simon & Schuster",
              "publicationYear": 2007,
              "isbn13": "9781416534723",
              "editionStatement": "Actual own heading,2007-05-01,288pages. Catalog imprint Pocket Books and publisher group label kept separately; pagination difference retained. Source mentions1873 book publication, not first serial1872.",
              "retrievedAt": "2026-09-05",
              "checkedAt": "2026-09-05",
              "checkedBy": "Codex AI /root (bibliographic source review)"
            }
          ]
        }
      }
    },
    "sources": [
      {
        "provider": "azbooka-atticus",
        "authorityId": "azbooka",
        "authorityTier": "B",
        "country": "russia",
        "language": "ru",
        "recordKind": "publisher-catalog",
        "recordId": "ISBN-9785389315822",
        "url": "https://azbooka.ru/books/pyteshestvie-k-tsentry-zemli-vokryg-sveta-v-vosemdesyat-dney",
        "fields": [
          "identity",
          "authorship",
          "description"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "penguin-random-house",
        "authorityId": "penguin-random-house",
        "authorityTier": "B",
        "country": "usa",
        "language": "en",
        "recordKind": "publisher-catalog",
        "recordId": "ISBN-9788175993938",
        "url": "https://www.penguinrandomhouse.com/books/832259/around-the-world-in-eighty-days-by-jules-verne/",
        "fields": [
          "identity",
          "authorship",
          "description"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "centre-international-jules-verne",
        "authorityId": "centre-international-jules-verne",
        "authorityTier": "B",
        "country": "france",
        "language": "fr",
        "market": "FR",
        "recordKind": "authoritative-work-page",
        "url": "https://jules-verne.net/l-oeuvre/les-voyages-extraordinaires/1872-1873-1-le-tour-du-monde-en-quatre-vingts-jours/",
        "fields": [
          "identity",
          "authorship",
          "description",
          "publication-year",
          "genre",
          "original-title"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "russian-state-library",
        "authorityId": "rsl",
        "authorityTier": "A",
        "recordId": "01008020923",
        "recordKind": "national-bibliography",
        "url": "https://search.rsl.ru/ru/record/01008020923",
        "language": "Russian",
        "market": "RU",
        "fields": [
          "identity",
          "authorship",
          "title",
          "language",
          "market",
          "genre"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "azbooka-atticus",
        "authorityId": "azbooka",
        "authorityTier": "B",
        "recordId": "ISBN-9785389068292",
        "recordKind": "publisher-catalog",
        "url": "https://azbooka.ru/books/vokrug-sveta-v-vosemdesyat-dney-tulu",
        "language": "Russian",
        "market": "RU",
        "fields": [
          "identity",
          "authorship",
          "title",
          "language",
          "market"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "library-of-congress",
        "authorityId": "loc",
        "authorityTier": "A",
        "recordId": "LCCN-2007281190",
        "recordKind": "national-bibliography",
        "url": "https://lccn.loc.gov/2007281190/marcxml",
        "language": "English",
        "market": "US",
        "fields": [
          "identity",
          "authorship",
          "title",
          "language",
          "market"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "simon-and-schuster-us",
        "authorityId": "simon-schuster-us",
        "authorityTier": "B",
        "recordId": "ISBN-9781416534723",
        "recordKind": "publisher-catalog",
        "url": "https://www.simonandschuster.com/books/Around-the-World-in-Eighty-Days/Jules-Verne/Enriched-Classics/9781416534723",
        "language": "English",
        "market": "US",
        "fields": [
          "identity",
          "authorship",
          "title",
          "language",
          "market"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      }
    ],
    "editorial": {
      "status": "reviewed",
      "reviewedAt": "2026-09-05"
    }
  },
  "france:jules_verne:openlibrary-works-ol1099280w": {
    "firstPublished": 1869,
    "originalTitle": "Vingt mille lieues sous les mers",
    "originalLanguage": "French",
    "description": "Профессор Пьер Аронакс, его слуга Консель и гарпунёр Нед Ленд отправляются на поиски загадочного морского существа и оказываются на подводной лодке «Наутилус». Вместе с её командиром, капитаном Немо, они исследуют океанские просторы, но прошлое их таинственного спутника остаётся загадкой.",
    "localizedTitles": {
      "ru": {
        "entityKind": "expression",
        "expressionId": "france:jules_verne:openlibrary-works-ol1099280w:ru",
        "locale": "ru",
        "value": "Двадцать тысяч лье под водой",
        "status": "verified-published",
        "expressionLanguage": "Russian",
        "market": "RU",
        "selectionRule": "current-complete-authorized-edition",
        "selectionNote": "Published work title established by actual national record and independent official publisher. Edition dates, subtitles, catalog punctuation and website format labels are distinguished from the selected title. No spelling, author identity or edition match inferred from a search pointer.",
        "evidence": [
          {
            "entityKind": "manifestation",
            "manifestationId": "rsl-01004334748",
            "sourceUrl": "https://search.rsl.ru/ru/record/01004334748",
            "provider": "russian-state-library",
            "authorityId": "rsl",
            "authorityTier": "A",
            "recordKind": "national-bibliography",
            "recordId": "01004334748",
            "catalogTitleExact": "Двадцать тысяч лье под водой",
            "locale": "ru",
            "market": "RU",
            "expressionLanguage": "Russian",
            "publisher": "АСТ",
            "publicationYear": 2009,
            "isbn13": "9785170581894",
            "editionStatement": "Actual indexed national Russian novel,476[1]pages; translation N.G.Yakovleva and E.F.Korsh from French.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)"
          },
          {
            "entityKind": "manifestation",
            "manifestationId": "ast-ISBN-9785171125455",
            "sourceUrl": "https://ast.ru/book/dvadtsat-tysyach-le-pod-vodoy-840711/",
            "provider": "ast-publishing",
            "authorityId": "ast",
            "authorityTier": "B",
            "recordKind": "publisher-catalog",
            "recordId": "ISBN-9785171125455",
            "catalogTitleExact": "Двадцать тысяч лье под водой",
            "locale": "ru",
            "market": "RU",
            "expressionLanguage": "Russian",
            "publisher": "АСТ",
            "isbn13": "9785171125455",
            "editionStatement": "Actual publisher Russian title and ISBN in the previously read source dossier; English-language primary basis remains the separate Penguin UK edition.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)"
          }
        ]
      },
      "en": {
        "entityKind": "expression",
        "expressionId": "france:jules_verne:openlibrary-works-ol1099280w:en",
        "locale": "en",
        "value": "Twenty Thousand Leagues Under the Sea",
        "status": "verified-published",
        "expressionLanguage": "English",
        "market": "US",
        "selectionRule": "current-complete-authorized-edition",
        "selectionNote": "Published work title established by actual national record and independent official publisher. Edition dates, subtitles, catalog punctuation and website format labels are distinguished from the selected title. No spelling, author identity or edition match inferred from a search pointer.",
        "evidence": [
          {
            "entityKind": "manifestation",
            "manifestationId": "loc-LCCN-25021265",
            "sourceUrl": "https://lccn.loc.gov/25021265/marcxml",
            "provider": "library-of-congress",
            "authorityId": "loc",
            "authorityTier": "A",
            "recordKind": "national-bibliography",
            "recordId": "LCCN-25021265",
            "catalogTitleExact": "Twenty Thousand Leagues Under the Sea",
            "locale": "en",
            "market": "US",
            "expressionLanguage": "English",
            "publisher": "C. Scribner’s Sons",
            "publicationYear": 1925,
            "editionStatement": "Full MARC245$a Twenty thousand leagues under the sea,;041 eng from fre;240 Vingt mille lieues sous les mers. English;New York1925,vii pages2leaves3–407pages,illustrations W.J.Aylward. Terminal ISBD comma omitted from title.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)"
          },
          {
            "entityKind": "manifestation",
            "manifestationId": "penguin-random-house-ISBN-9780141394930",
            "sourceUrl": "https://www.penguinrandomhouse.com/books/531358/twenty-thousand-leagues-under-the-sea-by-jules-verne-translated-with-an-introduction-and-notes-by-david-coward/",
            "provider": "penguin-random-house",
            "authorityId": "penguin-random-house",
            "authorityTier": "B",
            "recordKind": "publisher-catalog",
            "recordId": "ISBN-9780141394930",
            "catalogTitleExact": "Twenty Thousand Leagues Under the Sea",
            "locale": "en",
            "market": "US",
            "expressionLanguage": "English",
            "publisher": "Penguin Classics",
            "publicationYear": 2018,
            "isbn13": "9780141394930",
            "editionStatement": "Actual paperback product2018-08-14,528pages,new translation David Coward; distinct2017 hardcover not confused with this ISBN.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)"
          }
        ]
      }
    },
    "translations": {
      "ru": {
        "locale": "ru",
        "title": "Двадцать тысяч лье под водой",
        "description": "Профессор Пьер Аронакс, его слуга Консель и гарпунёр Нед Ленд отправляются на поиски загадочного морского существа и оказываются на подводной лодке «Наутилус». Вместе с её командиром, капитаном Немо, они исследуют океанские просторы, но прошлое их таинственного спутника остаётся загадкой.",
        "sourceLanguage": "ru",
        "status": "reviewed",
        "sourceUrls": [
          "https://ast.ru/book/dvadtsat-tysyach-le-pod-vodoy-840711/",
          "https://ast.ru/book/dvadtsat-tysyach-le-pod-vodoy-718086/",
          "https://www.penguin.co.uk/books/259451/twenty-thousand-leagues-under-the-sea-by-jules-verne/9780241198773",
          "https://jules-verne.net/l-oeuvre/les-voyages-extraordinaires/1869-1870-vingt-mille-lieues-sous-les-mers/",
          "https://search.rsl.ru/ru/record/01004334748"
        ],
        "method": "editorial-original",
        "reviewedAt": "2026-09-05",
        "descriptionProvenance": {
          "origin": "official-source-synthesis",
          "sourceLanguage": "ru",
          "sourceCountry": "france",
          "sourceUrls": [
            "https://ast.ru/book/dvadtsat-tysyach-le-pod-vodoy-840711/",
            "https://ast.ru/book/dvadtsat-tysyach-le-pod-vodoy-718086/",
            "https://www.penguin.co.uk/books/259451/twenty-thousand-leagues-under-the-sea-by-jules-verne/9780241198773",
            "https://jules-verne.net/l-oeuvre/les-voyages-extraordinaires/1869-1870-vingt-mille-lieues-sous-les-mers/"
          ],
          "primarySourceUrls": [
            "https://ast.ru/book/dvadtsat-tysyach-le-pod-vodoy-840711/",
            "https://ast.ru/book/dvadtsat-tysyach-le-pod-vodoy-718086/"
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
          "author": "Codex AI / review_ru_public_gaps",
          "createdAt": "2026-09-05",
          "reviewedBy": "Codex AI /root (independent review)",
          "reviewedAt": "2026-09-05"
        },
        "titleEvidence": {
          "entityKind": "expression",
          "expressionId": "france:jules_verne:openlibrary-works-ol1099280w:ru",
          "locale": "ru",
          "value": "Двадцать тысяч лье под водой",
          "status": "verified-published",
          "expressionLanguage": "Russian",
          "market": "RU",
          "selectionRule": "current-complete-authorized-edition",
          "selectionNote": "Published work title established by actual national record and independent official publisher. Edition dates, subtitles, catalog punctuation and website format labels are distinguished from the selected title. No spelling, author identity or edition match inferred from a search pointer.",
          "evidence": [
            {
              "entityKind": "manifestation",
              "manifestationId": "rsl-01004334748",
              "sourceUrl": "https://search.rsl.ru/ru/record/01004334748",
              "provider": "russian-state-library",
              "authorityId": "rsl",
              "authorityTier": "A",
              "recordKind": "national-bibliography",
              "recordId": "01004334748",
              "catalogTitleExact": "Двадцать тысяч лье под водой",
              "locale": "ru",
              "market": "RU",
              "expressionLanguage": "Russian",
              "publisher": "АСТ",
              "publicationYear": 2009,
              "isbn13": "9785170581894",
              "editionStatement": "Actual indexed national Russian novel,476[1]pages; translation N.G.Yakovleva and E.F.Korsh from French.",
              "retrievedAt": "2026-09-05",
              "checkedAt": "2026-09-05",
              "checkedBy": "Codex AI /root (bibliographic source review)"
            },
            {
              "entityKind": "manifestation",
              "manifestationId": "ast-ISBN-9785171125455",
              "sourceUrl": "https://ast.ru/book/dvadtsat-tysyach-le-pod-vodoy-840711/",
              "provider": "ast-publishing",
              "authorityId": "ast",
              "authorityTier": "B",
              "recordKind": "publisher-catalog",
              "recordId": "ISBN-9785171125455",
              "catalogTitleExact": "Двадцать тысяч лье под водой",
              "locale": "ru",
              "market": "RU",
              "expressionLanguage": "Russian",
              "publisher": "АСТ",
              "isbn13": "9785171125455",
              "editionStatement": "Actual publisher Russian title and ISBN in the previously read source dossier; English-language primary basis remains the separate Penguin UK edition.",
              "retrievedAt": "2026-09-05",
              "checkedAt": "2026-09-05",
              "checkedBy": "Codex AI /root (bibliographic source review)"
            }
          ]
        }
      },
      "en": {
        "locale": "en",
        "title": "Twenty Thousand Leagues Under the Sea",
        "description": "Three men travel beneath the oceans aboard the Nautilus, the extraordinary submarine commanded by Captain Nemo. Encounters with lost Atlantis and underwater dangers reveal the possibilities of science, while Nemo's thirst for revenge casts a darker shadow over the voyage.",
        "sourceLanguage": "en",
        "status": "reviewed",
        "sourceUrls": [
          "https://www.penguin.co.uk/books/259451/twenty-thousand-leagues-under-the-sea-by-jules-verne/9780241198773",
          "https://ast.ru/book/dvadtsat-tysyach-le-pod-vodoy-840711/",
          "https://ast.ru/book/dvadtsat-tysyach-le-pod-vodoy-718086/",
          "https://jules-verne.net/l-oeuvre/les-voyages-extraordinaires/1869-1870-vingt-mille-lieues-sous-les-mers/",
          "https://lccn.loc.gov/25021265/marcxml",
          "https://www.penguinrandomhouse.com/books/531358/twenty-thousand-leagues-under-the-sea-by-jules-verne-translated-with-an-introduction-and-notes-by-david-coward/"
        ],
        "method": "editorial-original",
        "reviewedAt": "2026-09-05",
        "descriptionProvenance": {
          "origin": "official-source-synthesis",
          "sourceLanguage": "en",
          "sourceCountry": "france",
          "sourceUrls": [
            "https://ast.ru/book/dvadtsat-tysyach-le-pod-vodoy-840711/",
            "https://ast.ru/book/dvadtsat-tysyach-le-pod-vodoy-718086/",
            "https://www.penguin.co.uk/books/259451/twenty-thousand-leagues-under-the-sea-by-jules-verne/9780241198773",
            "https://jules-verne.net/l-oeuvre/les-voyages-extraordinaires/1869-1870-vingt-mille-lieues-sous-les-mers/"
          ],
          "primarySourceUrls": [
            "https://www.penguin.co.uk/books/259451/twenty-thousand-leagues-under-the-sea-by-jules-verne/9780241198773"
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
          "author": "Codex AI / review_ru_public_gaps",
          "createdAt": "2026-09-05",
          "reviewedBy": "Codex AI /root (independent review)",
          "reviewedAt": "2026-09-05"
        },
        "titleEvidence": {
          "entityKind": "expression",
          "expressionId": "france:jules_verne:openlibrary-works-ol1099280w:en",
          "locale": "en",
          "value": "Twenty Thousand Leagues Under the Sea",
          "status": "verified-published",
          "expressionLanguage": "English",
          "market": "US",
          "selectionRule": "current-complete-authorized-edition",
          "selectionNote": "Published work title established by actual national record and independent official publisher. Edition dates, subtitles, catalog punctuation and website format labels are distinguished from the selected title. No spelling, author identity or edition match inferred from a search pointer.",
          "evidence": [
            {
              "entityKind": "manifestation",
              "manifestationId": "loc-LCCN-25021265",
              "sourceUrl": "https://lccn.loc.gov/25021265/marcxml",
              "provider": "library-of-congress",
              "authorityId": "loc",
              "authorityTier": "A",
              "recordKind": "national-bibliography",
              "recordId": "LCCN-25021265",
              "catalogTitleExact": "Twenty Thousand Leagues Under the Sea",
              "locale": "en",
              "market": "US",
              "expressionLanguage": "English",
              "publisher": "C. Scribner’s Sons",
              "publicationYear": 1925,
              "editionStatement": "Full MARC245$a Twenty thousand leagues under the sea,;041 eng from fre;240 Vingt mille lieues sous les mers. English;New York1925,vii pages2leaves3–407pages,illustrations W.J.Aylward. Terminal ISBD comma omitted from title.",
              "retrievedAt": "2026-09-05",
              "checkedAt": "2026-09-05",
              "checkedBy": "Codex AI /root (bibliographic source review)"
            },
            {
              "entityKind": "manifestation",
              "manifestationId": "penguin-random-house-ISBN-9780141394930",
              "sourceUrl": "https://www.penguinrandomhouse.com/books/531358/twenty-thousand-leagues-under-the-sea-by-jules-verne-translated-with-an-introduction-and-notes-by-david-coward/",
              "provider": "penguin-random-house",
              "authorityId": "penguin-random-house",
              "authorityTier": "B",
              "recordKind": "publisher-catalog",
              "recordId": "ISBN-9780141394930",
              "catalogTitleExact": "Twenty Thousand Leagues Under the Sea",
              "locale": "en",
              "market": "US",
              "expressionLanguage": "English",
              "publisher": "Penguin Classics",
              "publicationYear": 2018,
              "isbn13": "9780141394930",
              "editionStatement": "Actual paperback product2018-08-14,528pages,new translation David Coward; distinct2017 hardcover not confused with this ISBN.",
              "retrievedAt": "2026-09-05",
              "checkedAt": "2026-09-05",
              "checkedBy": "Codex AI /root (bibliographic source review)"
            }
          ]
        }
      }
    },
    "sources": [
      {
        "provider": "ast-publishing",
        "authorityId": "ast",
        "authorityTier": "B",
        "country": "russia",
        "language": "Russian",
        "recordKind": "publisher-catalog",
        "recordId": "ISBN-9785171125455",
        "url": "https://ast.ru/book/dvadtsat-tysyach-le-pod-vodoy-840711/",
        "fields": [
          "identity",
          "authorship",
          "description",
          "title",
          "language",
          "market"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05",
        "market": "RU"
      },
      {
        "provider": "ast-publishing",
        "authorityId": "ast",
        "authorityTier": "B",
        "country": "russia",
        "language": "ru",
        "recordKind": "publisher-catalog",
        "recordId": "ISBN-9785170930494",
        "url": "https://ast.ru/book/dvadtsat-tysyach-le-pod-vodoy-718086/",
        "fields": [
          "identity",
          "authorship",
          "description"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "penguin-books-uk",
        "authorityId": "penguin-uk",
        "authorityTier": "B",
        "country": "england",
        "language": "en",
        "recordKind": "publisher-catalog",
        "recordId": "ISBN-9780241198773",
        "url": "https://www.penguin.co.uk/books/259451/twenty-thousand-leagues-under-the-sea-by-jules-verne/9780241198773",
        "fields": [
          "identity",
          "authorship",
          "description"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "centre-international-jules-verne",
        "authorityId": "centre-international-jules-verne",
        "authorityTier": "B",
        "country": "france",
        "language": "fr",
        "market": "FR",
        "recordKind": "authoritative-work-page",
        "url": "https://jules-verne.net/l-oeuvre/les-voyages-extraordinaires/1869-1870-vingt-mille-lieues-sous-les-mers/",
        "fields": [
          "identity",
          "authorship",
          "description",
          "publication-year",
          "genre",
          "original-title"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "russian-state-library",
        "authorityId": "rsl",
        "authorityTier": "A",
        "recordId": "01004334748",
        "recordKind": "national-bibliography",
        "url": "https://search.rsl.ru/ru/record/01004334748",
        "language": "Russian",
        "market": "RU",
        "fields": [
          "identity",
          "authorship",
          "title",
          "language",
          "market",
          "genre"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "library-of-congress",
        "authorityId": "loc",
        "authorityTier": "A",
        "recordId": "LCCN-25021265",
        "recordKind": "national-bibliography",
        "url": "https://lccn.loc.gov/25021265/marcxml",
        "language": "English",
        "market": "US",
        "fields": [
          "identity",
          "authorship",
          "title",
          "language",
          "market"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "penguin-random-house",
        "authorityId": "penguin-random-house",
        "authorityTier": "B",
        "recordId": "ISBN-9780141394930",
        "recordKind": "publisher-catalog",
        "url": "https://www.penguinrandomhouse.com/books/531358/twenty-thousand-leagues-under-the-sea-by-jules-verne-translated-with-an-introduction-and-notes-by-david-coward/",
        "language": "English",
        "market": "US",
        "fields": [
          "identity",
          "authorship",
          "title",
          "language",
          "market"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      }
    ],
    "editorial": {
      "status": "reviewed",
      "reviewedAt": "2026-09-05"
    }
  },
  "france:jules_verne:openlibrary-works-ol1099479w": {
    "firstPublished": 1865,
    "originalTitle": "De la Terre à la Lune",
    "originalLanguage": "French",
    "description": "После Гражданской войны в США председатель балтиморского «Пушечного клуба» Импи Барбикен замышляет создать орудие, способное отправить снаряд к Луне. Предложение путешественника Мишеля Ардана меняет характер затеи: теперь нужно подготовить полёт, в котором будут участвовать люди.",
    "localizedTitles": {
      "ru": {
        "entityKind": "expression",
        "expressionId": "france:jules_verne:openlibrary-works-ol1099479w:ru",
        "locale": "ru",
        "value": "С Земли на Луну",
        "status": "verified-published",
        "expressionLanguage": "Russian",
        "market": "RU",
        "selectionRule": "current-complete-authorized-edition",
        "selectionNote": "The first novel is identified independently from Around the Moon; published title evidence does not claim equivalent translations across editions.",
        "evidence": [
          {
            "entityKind": "manifestation",
            "manifestationId": "rsl-01001000857",
            "sourceUrl": "https://search.rsl.ru/ru/record/01001000857",
            "provider": "russian-state-library",
            "authorityId": "rsl",
            "authorityTier": "A",
            "recordKind": "national-bibliography",
            "recordId": "01001000857",
            "catalogTitleExact": "Собрание сочинений",
            "locale": "ru",
            "market": "RU",
            "expressionLanguage": "Russian",
            "publisher": "Современ. писатель",
            "publicationYear": 1992,
            "editionStatement": "Actual indexed RSL Состав section:volume1 Пять недель на воздушном шаре; С Земли на Луну; Вокруг Луны: романы,1992,491pages. This is the catalog contents section, not a claimed MARC505; the selected work is separate from its sequel.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)",
            "titleRelation": "contained-work",
            "analyticTitleExact": "С Земли на Луну",
            "containerTitleExact": "Собрание сочинений",
            "containedInField": "contents-note"
          },
          {
            "entityKind": "manifestation",
            "manifestationId": "ast-ISBN-9785171568153",
            "sourceUrl": "https://ast.ru/book/s-zemli-na-lunu-vokrug-luny-873380/",
            "provider": "ast-publishing",
            "authorityId": "ast",
            "authorityTier": "B",
            "recordKind": "publisher-catalog",
            "recordId": "ISBN-9785171568153",
            "catalogTitleExact": "С Земли на Луну. Вокруг Луны",
            "locale": "ru",
            "market": "RU",
            "expressionLanguage": "Russian",
            "publisher": "АСТ",
            "isbn13": "9785171568153",
            "editionStatement": "Actual publisher heading lists both named works and own annotation explicitly identifies the volume as a dilogy,480pages. This publisher contents statement establishes the first named novel; it is not presented as a physical table of contents or evidence that the two novels are one work.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)",
            "titleRelation": "contained-work",
            "analyticTitleExact": "С Земли на Луну",
            "containerTitleExact": "С Земли на Луну. Вокруг Луны",
            "containedInField": "contents-note"
          }
        ]
      },
      "en": {
        "entityKind": "expression",
        "expressionId": "france:jules_verne:openlibrary-works-ol1099479w:en",
        "locale": "en",
        "value": "From the Earth to the Moon",
        "status": "verified-published",
        "expressionLanguage": "English",
        "market": "US",
        "selectionRule": "current-complete-authorized-edition",
        "selectionNote": "The first novel is identified independently from Around the Moon; published title evidence does not claim equivalent translations across editions.",
        "evidence": [
          {
            "entityKind": "manifestation",
            "manifestationId": "loc-LCCN-76026161",
            "sourceUrl": "https://lccn.loc.gov/76026161/marcxml",
            "provider": "library-of-congress",
            "authorityId": "loc",
            "authorityTier": "A",
            "recordKind": "national-bibliography",
            "recordId": "LCCN-76026161",
            "catalogTitleExact": "From the Earth to the Moon",
            "locale": "en",
            "market": "US",
            "expressionLanguage": "English",
            "publisher": "Aeonian Press",
            "publicationYear": 1976,
            "isbn13": "9780884119012",
            "editionStatement": "Full primary MARC245$a From the earth to the moon =;245$b The Baltimore gun club;041 English from French;240 De la terre à la lune. English;442pages13leaves,MattituckNY1976. A reprint of1874 Edward Roth freely translated edition. Used only to attest published work title and identity, not claimed textually equivalent to the modern complete Miller translation.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)"
          },
          {
            "entityKind": "manifestation",
            "manifestationId": "penguin-random-house-ISBN-9780262553865",
            "sourceUrl": "https://www.penguinrandomhouse.com/books/814346/from-the-earth-to-the-moon-by-jules-verne-edited-by-anastasia-klimchynskaya-translated-by-walter-james-miller/9780262553865/",
            "provider": "penguin-random-house",
            "authorityId": "penguin-random-house",
            "authorityTier": "B",
            "recordKind": "publisher-catalog",
            "recordId": "ISBN-9780262553865",
            "catalogTitleExact": "From the Earth to the Moon",
            "locale": "en",
            "market": "US",
            "expressionLanguage": "English",
            "publisher": "The MIT Press",
            "publicationYear": 2026,
            "isbn13": "9780262553865",
            "editionStatement": "Actual standalone publisher product2026-06-30,334pages; Walter James Miller translation,edited Anastasia Klimchynskaya; own annotation explicitly complete and unabridged. Published before check date2026-09-05.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)"
          }
        ]
      }
    },
    "translations": {
      "ru": {
        "locale": "ru",
        "title": "С Земли на Луну",
        "description": "После Гражданской войны в США председатель балтиморского «Пушечного клуба» Импи Барбикен замышляет создать орудие, способное отправить снаряд к Луне. Предложение путешественника Мишеля Ардана меняет характер затеи: теперь нужно подготовить полёт, в котором будут участвовать люди.",
        "sourceLanguage": "ru",
        "status": "reviewed",
        "sourceUrls": [
          "https://ast.ru/book/s-zemli-na-lunu-vokrug-luny-873380/",
          "https://www.simonandschuster.com/books/From-the-Earth-to-the-Moon-and-Around-the-Moon/Jules-Verne/The-Jules-Verne-Collection/9781665934244",
          "https://jules-verne.net/l-oeuvre/les-voyages-extraordinaires/1865-de-la-terre-a-la-lune/",
          "https://search.rsl.ru/ru/record/01001000857"
        ],
        "method": "editorial-original",
        "reviewedAt": "2026-09-05",
        "descriptionProvenance": {
          "origin": "official-source-synthesis",
          "sourceLanguage": "ru",
          "sourceCountry": "france",
          "sourceUrls": [
            "https://ast.ru/book/s-zemli-na-lunu-vokrug-luny-873380/",
            "https://www.simonandschuster.com/books/From-the-Earth-to-the-Moon-and-Around-the-Moon/Jules-Verne/The-Jules-Verne-Collection/9781665934244",
            "https://jules-verne.net/l-oeuvre/les-voyages-extraordinaires/1865-de-la-terre-a-la-lune/"
          ],
          "primarySourceUrls": [
            "https://ast.ru/book/s-zemli-na-lunu-vokrug-luny-873380/"
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
          "author": "Codex AI / review_ru_public_gaps",
          "createdAt": "2026-09-05",
          "reviewedBy": "Codex AI /root (independent review)",
          "reviewedAt": "2026-09-05"
        },
        "titleEvidence": {
          "entityKind": "expression",
          "expressionId": "france:jules_verne:openlibrary-works-ol1099479w:ru",
          "locale": "ru",
          "value": "С Земли на Луну",
          "status": "verified-published",
          "expressionLanguage": "Russian",
          "market": "RU",
          "selectionRule": "current-complete-authorized-edition",
          "selectionNote": "The first novel is identified independently from Around the Moon; published title evidence does not claim equivalent translations across editions.",
          "evidence": [
            {
              "entityKind": "manifestation",
              "manifestationId": "rsl-01001000857",
              "sourceUrl": "https://search.rsl.ru/ru/record/01001000857",
              "provider": "russian-state-library",
              "authorityId": "rsl",
              "authorityTier": "A",
              "recordKind": "national-bibliography",
              "recordId": "01001000857",
              "catalogTitleExact": "Собрание сочинений",
              "locale": "ru",
              "market": "RU",
              "expressionLanguage": "Russian",
              "publisher": "Современ. писатель",
              "publicationYear": 1992,
              "editionStatement": "Actual indexed RSL Состав section:volume1 Пять недель на воздушном шаре; С Земли на Луну; Вокруг Луны: романы,1992,491pages. This is the catalog contents section, not a claimed MARC505; the selected work is separate from its sequel.",
              "retrievedAt": "2026-09-05",
              "checkedAt": "2026-09-05",
              "checkedBy": "Codex AI /root (bibliographic source review)",
              "titleRelation": "contained-work",
              "analyticTitleExact": "С Земли на Луну",
              "containerTitleExact": "Собрание сочинений",
              "containedInField": "contents-note"
            },
            {
              "entityKind": "manifestation",
              "manifestationId": "ast-ISBN-9785171568153",
              "sourceUrl": "https://ast.ru/book/s-zemli-na-lunu-vokrug-luny-873380/",
              "provider": "ast-publishing",
              "authorityId": "ast",
              "authorityTier": "B",
              "recordKind": "publisher-catalog",
              "recordId": "ISBN-9785171568153",
              "catalogTitleExact": "С Земли на Луну. Вокруг Луны",
              "locale": "ru",
              "market": "RU",
              "expressionLanguage": "Russian",
              "publisher": "АСТ",
              "isbn13": "9785171568153",
              "editionStatement": "Actual publisher heading lists both named works and own annotation explicitly identifies the volume as a dilogy,480pages. This publisher contents statement establishes the first named novel; it is not presented as a physical table of contents or evidence that the two novels are one work.",
              "retrievedAt": "2026-09-05",
              "checkedAt": "2026-09-05",
              "checkedBy": "Codex AI /root (bibliographic source review)",
              "titleRelation": "contained-work",
              "analyticTitleExact": "С Земли на Луну",
              "containerTitleExact": "С Земли на Луну. Вокруг Луны",
              "containedInField": "contents-note"
            }
          ]
        }
      },
      "en": {
        "locale": "en",
        "title": "From the Earth to the Moon",
        "description": "After the American Civil War, the Baltimore Gun Club seeks a new use for its expertise, and President Barbicane proposes a cannon capable of sending a passenger to the Moon. The project brings a succession of engineering problems, from choosing the construction site to keeping a human being alive inside the projectile.",
        "sourceLanguage": "en",
        "status": "reviewed",
        "sourceUrls": [
          "https://www.simonandschuster.com/books/From-the-Earth-to-the-Moon-and-Around-the-Moon/Jules-Verne/The-Jules-Verne-Collection/9781665934244",
          "https://ast.ru/book/s-zemli-na-lunu-vokrug-luny-873380/",
          "https://jules-verne.net/l-oeuvre/les-voyages-extraordinaires/1865-de-la-terre-a-la-lune/",
          "https://lccn.loc.gov/76026161/marcxml",
          "https://www.penguinrandomhouse.com/books/814346/from-the-earth-to-the-moon-by-jules-verne-edited-by-anastasia-klimchynskaya-translated-by-walter-james-miller/9780262553865/"
        ],
        "method": "editorial-original",
        "reviewedAt": "2026-09-05",
        "descriptionProvenance": {
          "origin": "official-source-synthesis",
          "sourceLanguage": "en",
          "sourceCountry": "france",
          "sourceUrls": [
            "https://ast.ru/book/s-zemli-na-lunu-vokrug-luny-873380/",
            "https://www.simonandschuster.com/books/From-the-Earth-to-the-Moon-and-Around-the-Moon/Jules-Verne/The-Jules-Verne-Collection/9781665934244",
            "https://jules-verne.net/l-oeuvre/les-voyages-extraordinaires/1865-de-la-terre-a-la-lune/"
          ],
          "primarySourceUrls": [
            "https://www.simonandschuster.com/books/From-the-Earth-to-the-Moon-and-Around-the-Moon/Jules-Verne/The-Jules-Verne-Collection/9781665934244"
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
          "author": "Codex AI / review_ru_public_gaps",
          "createdAt": "2026-09-05",
          "reviewedBy": "Codex AI /root (independent review)",
          "reviewedAt": "2026-09-05"
        },
        "titleEvidence": {
          "entityKind": "expression",
          "expressionId": "france:jules_verne:openlibrary-works-ol1099479w:en",
          "locale": "en",
          "value": "From the Earth to the Moon",
          "status": "verified-published",
          "expressionLanguage": "English",
          "market": "US",
          "selectionRule": "current-complete-authorized-edition",
          "selectionNote": "The first novel is identified independently from Around the Moon; published title evidence does not claim equivalent translations across editions.",
          "evidence": [
            {
              "entityKind": "manifestation",
              "manifestationId": "loc-LCCN-76026161",
              "sourceUrl": "https://lccn.loc.gov/76026161/marcxml",
              "provider": "library-of-congress",
              "authorityId": "loc",
              "authorityTier": "A",
              "recordKind": "national-bibliography",
              "recordId": "LCCN-76026161",
              "catalogTitleExact": "From the Earth to the Moon",
              "locale": "en",
              "market": "US",
              "expressionLanguage": "English",
              "publisher": "Aeonian Press",
              "publicationYear": 1976,
              "isbn13": "9780884119012",
              "editionStatement": "Full primary MARC245$a From the earth to the moon =;245$b The Baltimore gun club;041 English from French;240 De la terre à la lune. English;442pages13leaves,MattituckNY1976. A reprint of1874 Edward Roth freely translated edition. Used only to attest published work title and identity, not claimed textually equivalent to the modern complete Miller translation.",
              "retrievedAt": "2026-09-05",
              "checkedAt": "2026-09-05",
              "checkedBy": "Codex AI /root (bibliographic source review)"
            },
            {
              "entityKind": "manifestation",
              "manifestationId": "penguin-random-house-ISBN-9780262553865",
              "sourceUrl": "https://www.penguinrandomhouse.com/books/814346/from-the-earth-to-the-moon-by-jules-verne-edited-by-anastasia-klimchynskaya-translated-by-walter-james-miller/9780262553865/",
              "provider": "penguin-random-house",
              "authorityId": "penguin-random-house",
              "authorityTier": "B",
              "recordKind": "publisher-catalog",
              "recordId": "ISBN-9780262553865",
              "catalogTitleExact": "From the Earth to the Moon",
              "locale": "en",
              "market": "US",
              "expressionLanguage": "English",
              "publisher": "The MIT Press",
              "publicationYear": 2026,
              "isbn13": "9780262553865",
              "editionStatement": "Actual standalone publisher product2026-06-30,334pages; Walter James Miller translation,edited Anastasia Klimchynskaya; own annotation explicitly complete and unabridged. Published before check date2026-09-05.",
              "retrievedAt": "2026-09-05",
              "checkedAt": "2026-09-05",
              "checkedBy": "Codex AI /root (bibliographic source review)"
            }
          ]
        }
      }
    },
    "sources": [
      {
        "provider": "ast-publishing",
        "authorityId": "ast",
        "authorityTier": "B",
        "country": "russia",
        "language": "Russian",
        "recordKind": "publisher-catalog",
        "recordId": "ISBN-9785171568153",
        "url": "https://ast.ru/book/s-zemli-na-lunu-vokrug-luny-873380/",
        "fields": [
          "identity",
          "authorship",
          "description",
          "title",
          "language",
          "market",
          "container-title",
          "contained-title"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05",
        "market": "RU"
      },
      {
        "provider": "simon-and-schuster-us",
        "authorityId": "simon-schuster-us",
        "authorityTier": "B",
        "country": "usa",
        "language": "en",
        "recordKind": "publisher-catalog",
        "recordId": "ISBN-9781665934244",
        "url": "https://www.simonandschuster.com/books/From-the-Earth-to-the-Moon-and-Around-the-Moon/Jules-Verne/The-Jules-Verne-Collection/9781665934244",
        "fields": [
          "identity",
          "authorship",
          "description"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "centre-international-jules-verne",
        "authorityId": "centre-international-jules-verne",
        "authorityTier": "B",
        "country": "france",
        "language": "fr",
        "market": "FR",
        "recordKind": "authoritative-work-page",
        "url": "https://jules-verne.net/l-oeuvre/les-voyages-extraordinaires/1865-de-la-terre-a-la-lune/",
        "fields": [
          "identity",
          "authorship",
          "description",
          "publication-year",
          "genre",
          "original-title"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "russian-state-library",
        "authorityId": "rsl",
        "authorityTier": "A",
        "recordId": "01001000857",
        "recordKind": "national-bibliography",
        "url": "https://search.rsl.ru/ru/record/01001000857",
        "language": "Russian",
        "market": "RU",
        "fields": [
          "identity",
          "authorship",
          "title",
          "language",
          "market",
          "container-title",
          "contained-title",
          "genre"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "library-of-congress",
        "authorityId": "loc",
        "authorityTier": "A",
        "recordId": "LCCN-76026161",
        "recordKind": "national-bibliography",
        "url": "https://lccn.loc.gov/76026161/marcxml",
        "language": "English",
        "market": "US",
        "fields": [
          "identity",
          "authorship",
          "title",
          "language",
          "market"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "penguin-random-house",
        "authorityId": "penguin-random-house",
        "authorityTier": "B",
        "recordId": "ISBN-9780262553865",
        "recordKind": "publisher-catalog",
        "url": "https://www.penguinrandomhouse.com/books/814346/from-the-earth-to-the-moon-by-jules-verne-edited-by-anastasia-klimchynskaya-translated-by-walter-james-miller/9780262553865/",
        "language": "English",
        "market": "US",
        "fields": [
          "identity",
          "authorship",
          "title",
          "language",
          "market"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      }
    ],
    "editorial": {
      "status": "reviewed",
      "reviewedAt": "2026-09-05"
    }
  },
  "france:jules_verne:openlibrary-works-ol1099630w": {
    "firstPublished": 1904,
    "originalTitle": "Maître du monde",
    "originalLanguage": "French",
    "description": "Загадочные происшествия на американских дорогах, в небе и на воде заставляют инспектора Джона Строка начать расследование. Его поиски ведут к человеку, называющему себя Властелином мира, и к необыкновенной машине, соединяющей возможности автомобиля, корабля, подводной лодки и летательного аппарата.",
    "localizedTitles": {
      "ru": {
        "entityKind": "expression",
        "expressionId": "france:jules_verne:openlibrary-works-ol1099630w:ru",
        "locale": "ru",
        "value": "Властелин мира",
        "status": "verified-published",
        "expressionLanguage": "Russian",
        "market": "RU",
        "selectionRule": "current-complete-authorized-edition",
        "selectionNote": "The novel is identified as a distinct contained work by actual catalog contents and official publisher, not equated to Robur the Conqueror, a film or comic adaptation.",
        "evidence": [
          {
            "entityKind": "manifestation",
            "manifestationId": "rsl-01001000857",
            "sourceUrl": "https://search.rsl.ru/ru/record/01001000857",
            "provider": "russian-state-library",
            "authorityId": "rsl",
            "authorityTier": "A",
            "recordKind": "national-bibliography",
            "recordId": "01001000857",
            "catalogTitleExact": "Собрание сочинений",
            "locale": "ru",
            "market": "RU",
            "expressionLanguage": "Russian",
            "publisher": "Современ. писатель",
            "publicationYear": 1993,
            "editionStatement": "Actual indexed RSL Состав section:volume6 Властелин мира; Плавучий остров; Флаг Родины: романы,1993,527pages,volumeISBN5-265-02869-2. Catalog contents section explicitly identifies this whole novel; no alleged MARC505 or unseen child record.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)",
            "titleRelation": "contained-work",
            "analyticTitleExact": "Властелин мира",
            "containerTitleExact": "Собрание сочинений",
            "containedInField": "contents-note"
          },
          {
            "entityKind": "manifestation",
            "manifestationId": "ast-ISBN-9785170668298",
            "sourceUrl": "https://ast.ru/book/robur-zavoevatel-vlastelin-mira-036411/",
            "provider": "ast-publishing",
            "authorityId": "ast",
            "authorityTier": "B",
            "recordKind": "publisher-catalog",
            "recordId": "ISBN-9785170668298",
            "catalogTitleExact": "Робур-Завоеватель. Властелин мира",
            "locale": "ru",
            "market": "RU",
            "expressionLanguage": "Russian",
            "publisher": "АСТ",
            "isbn13": "9785170668298",
            "editionStatement": "Actual indexed publisher title and own explicit contents statement names two novels: Робур-Завоеватель and Властелин мира;416pages. The statement attests the contained title, not a photographed table of contents. Older published AST edition used for title evidence; upcoming Azbooka volume is not claimed as an already published manifestation.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)",
            "titleRelation": "contained-work",
            "analyticTitleExact": "Властелин мира",
            "containerTitleExact": "Робур-Завоеватель. Властелин мира",
            "containedInField": "contents-note"
          }
        ]
      },
      "en": {
        "entityKind": "expression",
        "expressionId": "france:jules_verne:openlibrary-works-ol1099630w:en",
        "locale": "en",
        "value": "The Master of the World",
        "status": "verified-published",
        "expressionLanguage": "English",
        "market": "US",
        "selectionRule": "current-complete-authorized-edition",
        "selectionNote": "The novel is identified as a distinct contained work by actual catalog contents and official publisher, not equated to Robur the Conqueror, a film or comic adaptation.",
        "evidence": [
          {
            "entityKind": "manifestation",
            "manifestationId": "loc-LCCN-14001405",
            "sourceUrl": "https://lccn.loc.gov/14001405/marcxml",
            "provider": "library-of-congress",
            "authorityId": "loc",
            "authorityTier": "A",
            "recordKind": "national-bibliography",
            "recordId": "LCCN-14001405",
            "catalogTitleExact": "Works of Jules Verne",
            "locale": "en",
            "market": "US",
            "expressionLanguage": "English",
            "publisher": "V. Parke and Company",
            "publicationYear": 1911,
            "editionStatement": "Complete primary MARC actually read: continuation of the contents is in MARC500, not505: volume14 Robur the conqueror. The master of the world. The sphinx of ice. New York1911,15-volume set edited Charles F.Horne. The separately named whole novel is distinguished from its companion works.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)",
            "titleRelation": "contained-work",
            "analyticTitleExact": "The Master of the World",
            "containerTitleExact": "Works of Jules Verne",
            "containedInField": "contents-note"
          },
          {
            "entityKind": "manifestation",
            "manifestationId": "simon-schuster-us-ISBN-9780857756909",
            "sourceUrl": "https://www.simonandschuster.com/books/The-Master-of-the-World/Jules-Verne/Essential-Gothic-SF-Dark-Fantasy/9780857756909",
            "provider": "simon-and-schuster-us",
            "authorityId": "simon-schuster-us",
            "authorityTier": "B",
            "recordKind": "publisher-catalog",
            "recordId": "ISBN-9780857756909",
            "catalogTitleExact": "The Master of the World",
            "locale": "en",
            "market": "US",
            "expressionLanguage": "English",
            "publisher": "Flame Tree 451",
            "publicationYear": 2013,
            "isbn13": "9780857756909",
            "editionStatement": "Actual US official distributor/publisher product:2013-08-01,160pages,The Master of the World. The own synopsis names Strock,Robur,Terror and land/sea/air modes. UK-origin imprint is not misrepresented as Simon & Schuster-owned.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)"
          }
        ]
      }
    },
    "translations": {
      "ru": {
        "locale": "ru",
        "title": "Властелин мира",
        "description": "Загадочные происшествия на американских дорогах, в небе и на воде заставляют инспектора Джона Строка начать расследование. Его поиски ведут к человеку, называющему себя Властелином мира, и к необыкновенной машине, соединяющей возможности автомобиля, корабля, подводной лодки и летательного аппарата.",
        "sourceLanguage": "ru",
        "status": "reviewed",
        "sourceUrls": [
          "https://azbooka.ru/books/plavychiy-ostrov-robyr-zavoevatel-vlastelin-mira-s-ill",
          "https://www.simonandschuster.com/books/The-Master-of-the-World/Jules-Verne/Essential-Gothic-SF-Dark-Fantasy/9780857756909",
          "https://jules-verne.net/exposer-l-oeuvre/les-expositions-pedagogiques/les-machines-de-jules-verne/",
          "https://search.rsl.ru/ru/record/01001000857",
          "https://ast.ru/book/robur-zavoevatel-vlastelin-mira-036411/"
        ],
        "method": "editorial-original",
        "reviewedAt": "2026-09-05",
        "descriptionProvenance": {
          "origin": "official-source-synthesis",
          "sourceLanguage": "ru",
          "sourceCountry": "france",
          "sourceUrls": [
            "https://azbooka.ru/books/plavychiy-ostrov-robyr-zavoevatel-vlastelin-mira-s-ill",
            "https://www.simonandschuster.com/books/The-Master-of-the-World/Jules-Verne/Essential-Gothic-SF-Dark-Fantasy/9780857756909",
            "https://jules-verne.net/exposer-l-oeuvre/les-expositions-pedagogiques/les-machines-de-jules-verne/"
          ],
          "primarySourceUrls": [
            "https://azbooka.ru/books/plavychiy-ostrov-robyr-zavoevatel-vlastelin-mira-s-ill"
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
          "author": "Codex AI / review_ru_public_gaps",
          "createdAt": "2026-09-05",
          "reviewedBy": "Codex AI /root (independent review)",
          "reviewedAt": "2026-09-05"
        },
        "titleEvidence": {
          "entityKind": "expression",
          "expressionId": "france:jules_verne:openlibrary-works-ol1099630w:ru",
          "locale": "ru",
          "value": "Властелин мира",
          "status": "verified-published",
          "expressionLanguage": "Russian",
          "market": "RU",
          "selectionRule": "current-complete-authorized-edition",
          "selectionNote": "The novel is identified as a distinct contained work by actual catalog contents and official publisher, not equated to Robur the Conqueror, a film or comic adaptation.",
          "evidence": [
            {
              "entityKind": "manifestation",
              "manifestationId": "rsl-01001000857",
              "sourceUrl": "https://search.rsl.ru/ru/record/01001000857",
              "provider": "russian-state-library",
              "authorityId": "rsl",
              "authorityTier": "A",
              "recordKind": "national-bibliography",
              "recordId": "01001000857",
              "catalogTitleExact": "Собрание сочинений",
              "locale": "ru",
              "market": "RU",
              "expressionLanguage": "Russian",
              "publisher": "Современ. писатель",
              "publicationYear": 1993,
              "editionStatement": "Actual indexed RSL Состав section:volume6 Властелин мира; Плавучий остров; Флаг Родины: романы,1993,527pages,volumeISBN5-265-02869-2. Catalog contents section explicitly identifies this whole novel; no alleged MARC505 or unseen child record.",
              "retrievedAt": "2026-09-05",
              "checkedAt": "2026-09-05",
              "checkedBy": "Codex AI /root (bibliographic source review)",
              "titleRelation": "contained-work",
              "analyticTitleExact": "Властелин мира",
              "containerTitleExact": "Собрание сочинений",
              "containedInField": "contents-note"
            },
            {
              "entityKind": "manifestation",
              "manifestationId": "ast-ISBN-9785170668298",
              "sourceUrl": "https://ast.ru/book/robur-zavoevatel-vlastelin-mira-036411/",
              "provider": "ast-publishing",
              "authorityId": "ast",
              "authorityTier": "B",
              "recordKind": "publisher-catalog",
              "recordId": "ISBN-9785170668298",
              "catalogTitleExact": "Робур-Завоеватель. Властелин мира",
              "locale": "ru",
              "market": "RU",
              "expressionLanguage": "Russian",
              "publisher": "АСТ",
              "isbn13": "9785170668298",
              "editionStatement": "Actual indexed publisher title and own explicit contents statement names two novels: Робур-Завоеватель and Властелин мира;416pages. The statement attests the contained title, not a photographed table of contents. Older published AST edition used for title evidence; upcoming Azbooka volume is not claimed as an already published manifestation.",
              "retrievedAt": "2026-09-05",
              "checkedAt": "2026-09-05",
              "checkedBy": "Codex AI /root (bibliographic source review)",
              "titleRelation": "contained-work",
              "analyticTitleExact": "Властелин мира",
              "containerTitleExact": "Робур-Завоеватель. Властелин мира",
              "containedInField": "contents-note"
            }
          ]
        }
      },
      "en": {
        "locale": "en",
        "title": "The Master of the World",
        "description": "A series of mysterious incidents across America leads detective John Strock to investigate vehicles of extraordinary speed. His search uncovers Robur and the Terror, a machine capable of travelling by land, sea and air, whose inventor's ambitions make it a threat Strock is determined to confront.",
        "sourceLanguage": "en",
        "status": "reviewed",
        "sourceUrls": [
          "https://www.simonandschuster.com/books/The-Master-of-the-World/Jules-Verne/Essential-Gothic-SF-Dark-Fantasy/9780857756909",
          "https://azbooka.ru/books/plavychiy-ostrov-robyr-zavoevatel-vlastelin-mira-s-ill",
          "https://jules-verne.net/exposer-l-oeuvre/les-expositions-pedagogiques/les-machines-de-jules-verne/",
          "https://lccn.loc.gov/14001405/marcxml"
        ],
        "method": "editorial-original",
        "reviewedAt": "2026-09-05",
        "descriptionProvenance": {
          "origin": "official-source-synthesis",
          "sourceLanguage": "en",
          "sourceCountry": "france",
          "sourceUrls": [
            "https://azbooka.ru/books/plavychiy-ostrov-robyr-zavoevatel-vlastelin-mira-s-ill",
            "https://www.simonandschuster.com/books/The-Master-of-the-World/Jules-Verne/Essential-Gothic-SF-Dark-Fantasy/9780857756909",
            "https://jules-verne.net/exposer-l-oeuvre/les-expositions-pedagogiques/les-machines-de-jules-verne/"
          ],
          "primarySourceUrls": [
            "https://www.simonandschuster.com/books/The-Master-of-the-World/Jules-Verne/Essential-Gothic-SF-Dark-Fantasy/9780857756909"
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
          "author": "Codex AI / review_ru_public_gaps",
          "createdAt": "2026-09-05",
          "reviewedBy": "Codex AI /root (independent review)",
          "reviewedAt": "2026-09-05"
        },
        "titleEvidence": {
          "entityKind": "expression",
          "expressionId": "france:jules_verne:openlibrary-works-ol1099630w:en",
          "locale": "en",
          "value": "The Master of the World",
          "status": "verified-published",
          "expressionLanguage": "English",
          "market": "US",
          "selectionRule": "current-complete-authorized-edition",
          "selectionNote": "The novel is identified as a distinct contained work by actual catalog contents and official publisher, not equated to Robur the Conqueror, a film or comic adaptation.",
          "evidence": [
            {
              "entityKind": "manifestation",
              "manifestationId": "loc-LCCN-14001405",
              "sourceUrl": "https://lccn.loc.gov/14001405/marcxml",
              "provider": "library-of-congress",
              "authorityId": "loc",
              "authorityTier": "A",
              "recordKind": "national-bibliography",
              "recordId": "LCCN-14001405",
              "catalogTitleExact": "Works of Jules Verne",
              "locale": "en",
              "market": "US",
              "expressionLanguage": "English",
              "publisher": "V. Parke and Company",
              "publicationYear": 1911,
              "editionStatement": "Complete primary MARC actually read: continuation of the contents is in MARC500, not505: volume14 Robur the conqueror. The master of the world. The sphinx of ice. New York1911,15-volume set edited Charles F.Horne. The separately named whole novel is distinguished from its companion works.",
              "retrievedAt": "2026-09-05",
              "checkedAt": "2026-09-05",
              "checkedBy": "Codex AI /root (bibliographic source review)",
              "titleRelation": "contained-work",
              "analyticTitleExact": "The Master of the World",
              "containerTitleExact": "Works of Jules Verne",
              "containedInField": "contents-note"
            },
            {
              "entityKind": "manifestation",
              "manifestationId": "simon-schuster-us-ISBN-9780857756909",
              "sourceUrl": "https://www.simonandschuster.com/books/The-Master-of-the-World/Jules-Verne/Essential-Gothic-SF-Dark-Fantasy/9780857756909",
              "provider": "simon-and-schuster-us",
              "authorityId": "simon-schuster-us",
              "authorityTier": "B",
              "recordKind": "publisher-catalog",
              "recordId": "ISBN-9780857756909",
              "catalogTitleExact": "The Master of the World",
              "locale": "en",
              "market": "US",
              "expressionLanguage": "English",
              "publisher": "Flame Tree 451",
              "publicationYear": 2013,
              "isbn13": "9780857756909",
              "editionStatement": "Actual US official distributor/publisher product:2013-08-01,160pages,The Master of the World. The own synopsis names Strock,Robur,Terror and land/sea/air modes. UK-origin imprint is not misrepresented as Simon & Schuster-owned.",
              "retrievedAt": "2026-09-05",
              "checkedAt": "2026-09-05",
              "checkedBy": "Codex AI /root (bibliographic source review)"
            }
          ]
        }
      }
    },
    "sources": [
      {
        "provider": "azbooka-atticus",
        "authorityId": "azbooka",
        "authorityTier": "B",
        "country": "russia",
        "language": "ru",
        "recordKind": "publisher-catalog",
        "recordId": "ISBN-9785389335806",
        "url": "https://azbooka.ru/books/plavychiy-ostrov-robyr-zavoevatel-vlastelin-mira-s-ill",
        "fields": [
          "identity",
          "authorship",
          "description"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "simon-and-schuster-us",
        "authorityId": "simon-schuster-us",
        "authorityTier": "B",
        "country": "usa",
        "language": "English",
        "recordKind": "publisher-catalog",
        "recordId": "ISBN-9780857756909",
        "url": "https://www.simonandschuster.com/books/The-Master-of-the-World/Jules-Verne/Essential-Gothic-SF-Dark-Fantasy/9780857756909",
        "fields": [
          "identity",
          "authorship",
          "description",
          "title",
          "language",
          "market"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05",
        "market": "US"
      },
      {
        "provider": "centre-international-jules-verne",
        "authorityId": "centre-international-jules-verne",
        "authorityTier": "B",
        "country": "france",
        "language": "fr",
        "market": "FR",
        "recordKind": "authoritative-work-page",
        "url": "https://jules-verne.net/exposer-l-oeuvre/les-expositions-pedagogiques/les-machines-de-jules-verne/",
        "fields": [
          "identity",
          "authorship",
          "description"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "russian-state-library",
        "authorityId": "rsl",
        "authorityTier": "A",
        "recordId": "01001000857",
        "recordKind": "national-bibliography",
        "url": "https://search.rsl.ru/ru/record/01001000857",
        "language": "Russian",
        "market": "RU",
        "fields": [
          "identity",
          "authorship",
          "title",
          "language",
          "market",
          "container-title",
          "contained-title"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "ast-publishing",
        "authorityId": "ast",
        "authorityTier": "B",
        "recordId": "ISBN-9785170668298",
        "recordKind": "publisher-catalog",
        "url": "https://ast.ru/book/robur-zavoevatel-vlastelin-mira-036411/",
        "language": "Russian",
        "market": "RU",
        "fields": [
          "identity",
          "authorship",
          "title",
          "language",
          "market",
          "container-title",
          "contained-title"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "library-of-congress",
        "authorityId": "loc",
        "authorityTier": "A",
        "recordId": "LCCN-14001405",
        "recordKind": "national-bibliography",
        "url": "https://lccn.loc.gov/14001405/marcxml",
        "language": "English",
        "market": "US",
        "fields": [
          "identity",
          "authorship",
          "title",
          "language",
          "market",
          "container-title",
          "contained-title"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "bibliotheque-nationale-de-france",
        "authorityId": "bnf",
        "authorityTier": "A",
        "country": "france",
        "language": "French",
        "market": "FR",
        "recordKind": "national-bibliography",
        "recordId": "FRBNF18001962",
        "url": "https://catalogue.bnf.fr/ark%3A/12148/cb18001962j",
        "fields": [
          "identity",
          "authorship",
          "publication-year",
          "genre",
          "original-title",
          "language"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "bibliotheque-nationale-de-france",
        "authorityId": "bnf",
        "authorityTier": "A",
        "country": "france",
        "language": "French",
        "market": "FR",
        "recordKind": "national-bibliography",
        "recordId": "FRBNF43690366",
        "url": "https://catalogue.bnf.fr/ark%3A/12148/cb43690366j",
        "fields": [
          "identity",
          "authorship",
          "publication-year",
          "original-title"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      }
    ],
    "editorial": {
      "status": "reviewed",
      "reviewedAt": "2026-09-05"
    }
  },
  "france:jules_verne:openlibrary-works-ol1099364w": {
    "firstPublished": 1865,
    "originalTitle": "Les Enfants du capitaine Grant",
    "originalLanguage": "French",
    "description": "Найденная лордом Гленарваном и его женой бутылка с полуразмытой запиской даёт надежду разыскать пропавшего капитана Гранта. На яхте «Дункан» в опасный путь отправляются его дети Роберт и Мери, учёный Паганель и другие участники поисков.",
    "localizedTitles": {
      "ru": {
        "entityKind": "expression",
        "expressionId": "france:jules_verne:openlibrary-works-ol1099364w:ru",
        "locale": "ru",
        "value": "Дети капитана Гранта",
        "status": "verified-published",
        "expressionLanguage": "Russian",
        "market": "RU",
        "selectionRule": "current-complete-authorized-edition",
        "selectionNote": "Published work title established by actual national record and independent official publisher. Edition dates, subtitles, catalog punctuation and website format labels are distinguished from the selected title. No spelling, author identity or edition match inferred from a search pointer.",
        "evidence": [
          {
            "entityKind": "manifestation",
            "manifestationId": "rsl-01008514258",
            "sourceUrl": "https://search.rsl.ru/ru/record/01008514258",
            "provider": "russian-state-library",
            "authorityId": "rsl",
            "authorityTier": "A",
            "recordKind": "national-bibliography",
            "recordId": "01008514258",
            "catalogTitleExact": "Дети капитана Гранта",
            "locale": "ru",
            "market": "RU",
            "expressionLanguage": "Russian",
            "publisher": "АСТ",
            "publicationYear": 2016,
            "isbn13": "9785170929146",
            "editionStatement": "Actual indexed national Russian novel,638pages,translation A.Beketova from French.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)"
          },
          {
            "entityKind": "manifestation",
            "manifestationId": "ast-AST-834206",
            "sourceUrl": "https://ast.ru/book/deti-kapitana-granta-834206/",
            "provider": "ast-publishing",
            "authorityId": "ast",
            "authorityTier": "B",
            "recordKind": "publisher-catalog",
            "recordId": "AST-834206",
            "catalogTitleExact": "Дети капитана Гранта",
            "locale": "ru",
            "market": "RU",
            "expressionLanguage": "Russian",
            "publisher": "АСТ",
            "editionStatement": "Actual indexed publisher heading identifies standalone novel Дети капитана Гранта; publisher synopsis describes Glenarvans and damaged message. Record identifier AST834206 is retained; no unseen ISBN or date invented.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)"
          }
        ]
      },
      "en": {
        "entityKind": "expression",
        "expressionId": "france:jules_verne:openlibrary-works-ol1099364w:en",
        "locale": "en",
        "value": "In Search of the Castaways",
        "status": "verified-published",
        "expressionLanguage": "English",
        "market": "US",
        "selectionRule": "current-complete-authorized-edition",
        "selectionNote": "Published work title established by actual national record and independent official publisher. Edition dates, subtitles, catalog punctuation and website format labels are distinguished from the selected title. No spelling, author identity or edition match inferred from a search pointer.",
        "evidence": [
          {
            "entityKind": "manifestation",
            "manifestationId": "loc-LCCN-14001405",
            "sourceUrl": "https://lccn.loc.gov/14001405/marcxml",
            "provider": "library-of-congress",
            "authorityId": "loc",
            "authorityTier": "A",
            "recordKind": "national-bibliography",
            "recordId": "LCCN-14001405",
            "catalogTitleExact": "Works of Jules Verne",
            "locale": "en",
            "market": "US",
            "expressionLanguage": "English",
            "publisher": "V. Parke and Company",
            "publicationYear": 1911,
            "editionStatement": "Full primary MARC505 actually read: volume4 contains In search of the castaways: South America, Australia, New Zealand. All three geographical parts identify the whole novel, unlike isolated South America editions. Set title Works of Jules Verne,edited Charles F.Horne,15volumes,New York1911.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)",
            "titleRelation": "contained-work",
            "analyticTitleExact": "In Search of the Castaways",
            "containerTitleExact": "Works of Jules Verne",
            "containedInField": "contents-note"
          },
          {
            "entityKind": "manifestation",
            "manifestationId": "simon-schuster-us-ISBN-9781665934350",
            "sourceUrl": "https://www.simonandschuster.com/books/In-Search-of-the-Castaways/Jules-Verne/The-Jules-Verne-Collection/9781665934350",
            "provider": "simon-and-schuster-us",
            "authorityId": "simon-schuster-us",
            "authorityTier": "B",
            "recordKind": "publisher-catalog",
            "recordId": "ISBN-9781665934350",
            "catalogTitleExact": "In Search of the Castaways",
            "locale": "en",
            "market": "US",
            "expressionLanguage": "English",
            "publisher": "Aladdin",
            "publicationYear": 2024,
            "isbn13": "9781665934350",
            "editionStatement": "Actual own heading,2024-04-23,656pages. Publisher sample chapterI independently read previously; no film adaptation or abridged episode substituted.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)"
          }
        ]
      }
    },
    "translations": {
      "ru": {
        "locale": "ru",
        "title": "Дети капитана Гранта",
        "description": "Найденная лордом Гленарваном и его женой бутылка с полуразмытой запиской даёт надежду разыскать пропавшего капитана Гранта. На яхте «Дункан» в опасный путь отправляются его дети Роберт и Мери, учёный Паганель и другие участники поисков.",
        "sourceLanguage": "ru",
        "status": "reviewed",
        "sourceUrls": [
          "https://ast.ru/book/deti-kapitana-granta-834206/",
          "https://ast.ru/book/deti-kapitana-granta-013140/",
          "https://www.simonandschuster.com/books/In-Search-of-the-Castaways/Jules-Verne/The-Jules-Verne-Collection/9781665934350",
          "https://jules-verne.net/l-oeuvre/les-voyages-extraordinaires/1865-1867-les-enfants-du-capitaine-grant/",
          "https://search.rsl.ru/ru/record/01008514258"
        ],
        "method": "editorial-original",
        "reviewedAt": "2026-09-05",
        "descriptionProvenance": {
          "origin": "official-source-synthesis",
          "sourceLanguage": "ru",
          "sourceCountry": "france",
          "sourceUrls": [
            "https://ast.ru/book/deti-kapitana-granta-834206/",
            "https://ast.ru/book/deti-kapitana-granta-013140/",
            "https://www.simonandschuster.com/books/In-Search-of-the-Castaways/Jules-Verne/The-Jules-Verne-Collection/9781665934350",
            "https://jules-verne.net/l-oeuvre/les-voyages-extraordinaires/1865-1867-les-enfants-du-capitaine-grant/"
          ],
          "primarySourceUrls": [
            "https://ast.ru/book/deti-kapitana-granta-834206/",
            "https://ast.ru/book/deti-kapitana-granta-013140/"
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
          "author": "Codex AI / review_ru_public_gaps",
          "createdAt": "2026-09-05",
          "reviewedBy": "Codex AI /root (independent review)",
          "reviewedAt": "2026-09-05"
        },
        "titleEvidence": {
          "entityKind": "expression",
          "expressionId": "france:jules_verne:openlibrary-works-ol1099364w:ru",
          "locale": "ru",
          "value": "Дети капитана Гранта",
          "status": "verified-published",
          "expressionLanguage": "Russian",
          "market": "RU",
          "selectionRule": "current-complete-authorized-edition",
          "selectionNote": "Published work title established by actual national record and independent official publisher. Edition dates, subtitles, catalog punctuation and website format labels are distinguished from the selected title. No spelling, author identity or edition match inferred from a search pointer.",
          "evidence": [
            {
              "entityKind": "manifestation",
              "manifestationId": "rsl-01008514258",
              "sourceUrl": "https://search.rsl.ru/ru/record/01008514258",
              "provider": "russian-state-library",
              "authorityId": "rsl",
              "authorityTier": "A",
              "recordKind": "national-bibliography",
              "recordId": "01008514258",
              "catalogTitleExact": "Дети капитана Гранта",
              "locale": "ru",
              "market": "RU",
              "expressionLanguage": "Russian",
              "publisher": "АСТ",
              "publicationYear": 2016,
              "isbn13": "9785170929146",
              "editionStatement": "Actual indexed national Russian novel,638pages,translation A.Beketova from French.",
              "retrievedAt": "2026-09-05",
              "checkedAt": "2026-09-05",
              "checkedBy": "Codex AI /root (bibliographic source review)"
            },
            {
              "entityKind": "manifestation",
              "manifestationId": "ast-AST-834206",
              "sourceUrl": "https://ast.ru/book/deti-kapitana-granta-834206/",
              "provider": "ast-publishing",
              "authorityId": "ast",
              "authorityTier": "B",
              "recordKind": "publisher-catalog",
              "recordId": "AST-834206",
              "catalogTitleExact": "Дети капитана Гранта",
              "locale": "ru",
              "market": "RU",
              "expressionLanguage": "Russian",
              "publisher": "АСТ",
              "editionStatement": "Actual indexed publisher heading identifies standalone novel Дети капитана Гранта; publisher synopsis describes Glenarvans and damaged message. Record identifier AST834206 is retained; no unseen ISBN or date invented.",
              "retrievedAt": "2026-09-05",
              "checkedAt": "2026-09-05",
              "checkedBy": "Codex AI /root (bibliographic source review)"
            }
          ]
        }
      },
      "en": {
        "locale": "en",
        "title": "In Search of the Castaways",
        "description": "A damaged message found inside a shark gives Lord and Lady Glenarvan hope of rescuing Captain Grant and his shipwrecked crew, but leaves them without a usable longitude. Joined by Grant's children, Mary and Robert, they set out aboard the Duncan on a search that may take them around the world.",
        "sourceLanguage": "en",
        "status": "reviewed",
        "sourceUrls": [
          "https://www.simonandschuster.com/books/In-Search-of-the-Castaways/Jules-Verne/The-Jules-Verne-Collection/9781665934350",
          "https://ast.ru/book/deti-kapitana-granta-834206/",
          "https://ast.ru/book/deti-kapitana-granta-013140/",
          "https://jules-verne.net/l-oeuvre/les-voyages-extraordinaires/1865-1867-les-enfants-du-capitaine-grant/",
          "https://lccn.loc.gov/14001405/marcxml"
        ],
        "method": "editorial-original",
        "reviewedAt": "2026-09-05",
        "descriptionProvenance": {
          "origin": "official-source-synthesis",
          "sourceLanguage": "en",
          "sourceCountry": "france",
          "sourceUrls": [
            "https://ast.ru/book/deti-kapitana-granta-834206/",
            "https://ast.ru/book/deti-kapitana-granta-013140/",
            "https://www.simonandschuster.com/books/In-Search-of-the-Castaways/Jules-Verne/The-Jules-Verne-Collection/9781665934350",
            "https://jules-verne.net/l-oeuvre/les-voyages-extraordinaires/1865-1867-les-enfants-du-capitaine-grant/"
          ],
          "primarySourceUrls": [
            "https://www.simonandschuster.com/books/In-Search-of-the-Castaways/Jules-Verne/The-Jules-Verne-Collection/9781665934350"
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
          "author": "Codex AI / review_ru_public_gaps",
          "createdAt": "2026-09-05",
          "reviewedBy": "Codex AI /root (independent review)",
          "reviewedAt": "2026-09-05"
        },
        "titleEvidence": {
          "entityKind": "expression",
          "expressionId": "france:jules_verne:openlibrary-works-ol1099364w:en",
          "locale": "en",
          "value": "In Search of the Castaways",
          "status": "verified-published",
          "expressionLanguage": "English",
          "market": "US",
          "selectionRule": "current-complete-authorized-edition",
          "selectionNote": "Published work title established by actual national record and independent official publisher. Edition dates, subtitles, catalog punctuation and website format labels are distinguished from the selected title. No spelling, author identity or edition match inferred from a search pointer.",
          "evidence": [
            {
              "entityKind": "manifestation",
              "manifestationId": "loc-LCCN-14001405",
              "sourceUrl": "https://lccn.loc.gov/14001405/marcxml",
              "provider": "library-of-congress",
              "authorityId": "loc",
              "authorityTier": "A",
              "recordKind": "national-bibliography",
              "recordId": "LCCN-14001405",
              "catalogTitleExact": "Works of Jules Verne",
              "locale": "en",
              "market": "US",
              "expressionLanguage": "English",
              "publisher": "V. Parke and Company",
              "publicationYear": 1911,
              "editionStatement": "Full primary MARC505 actually read: volume4 contains In search of the castaways: South America, Australia, New Zealand. All three geographical parts identify the whole novel, unlike isolated South America editions. Set title Works of Jules Verne,edited Charles F.Horne,15volumes,New York1911.",
              "retrievedAt": "2026-09-05",
              "checkedAt": "2026-09-05",
              "checkedBy": "Codex AI /root (bibliographic source review)",
              "titleRelation": "contained-work",
              "analyticTitleExact": "In Search of the Castaways",
              "containerTitleExact": "Works of Jules Verne",
              "containedInField": "contents-note"
            },
            {
              "entityKind": "manifestation",
              "manifestationId": "simon-schuster-us-ISBN-9781665934350",
              "sourceUrl": "https://www.simonandschuster.com/books/In-Search-of-the-Castaways/Jules-Verne/The-Jules-Verne-Collection/9781665934350",
              "provider": "simon-and-schuster-us",
              "authorityId": "simon-schuster-us",
              "authorityTier": "B",
              "recordKind": "publisher-catalog",
              "recordId": "ISBN-9781665934350",
              "catalogTitleExact": "In Search of the Castaways",
              "locale": "en",
              "market": "US",
              "expressionLanguage": "English",
              "publisher": "Aladdin",
              "publicationYear": 2024,
              "isbn13": "9781665934350",
              "editionStatement": "Actual own heading,2024-04-23,656pages. Publisher sample chapterI independently read previously; no film adaptation or abridged episode substituted.",
              "retrievedAt": "2026-09-05",
              "checkedAt": "2026-09-05",
              "checkedBy": "Codex AI /root (bibliographic source review)"
            }
          ]
        }
      }
    },
    "sources": [
      {
        "provider": "ast-publishing",
        "authorityId": "ast",
        "authorityTier": "B",
        "country": "russia",
        "language": "Russian",
        "recordKind": "publisher-catalog",
        "recordId": "AST-834206",
        "url": "https://ast.ru/book/deti-kapitana-granta-834206/",
        "fields": [
          "identity",
          "authorship",
          "description",
          "title",
          "language",
          "market"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05",
        "market": "RU"
      },
      {
        "provider": "ast-publishing",
        "authorityId": "ast",
        "authorityTier": "B",
        "country": "russia",
        "language": "ru",
        "recordKind": "publisher-catalog",
        "recordId": "ISBN-9785170555659",
        "url": "https://ast.ru/book/deti-kapitana-granta-013140/",
        "fields": [
          "identity",
          "authorship",
          "description"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "simon-and-schuster-us",
        "authorityId": "simon-schuster-us",
        "authorityTier": "B",
        "country": "usa",
        "language": "English",
        "recordKind": "publisher-catalog",
        "recordId": "ISBN-9781665934350",
        "url": "https://www.simonandschuster.com/books/In-Search-of-the-Castaways/Jules-Verne/The-Jules-Verne-Collection/9781665934350",
        "fields": [
          "identity",
          "authorship",
          "description",
          "title",
          "language",
          "market"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05",
        "market": "US"
      },
      {
        "provider": "centre-international-jules-verne",
        "authorityId": "centre-international-jules-verne",
        "authorityTier": "B",
        "country": "france",
        "language": "fr",
        "market": "FR",
        "recordKind": "authoritative-work-page",
        "url": "https://jules-verne.net/l-oeuvre/les-voyages-extraordinaires/1865-1867-les-enfants-du-capitaine-grant/",
        "fields": [
          "identity",
          "authorship",
          "description",
          "publication-year",
          "genre",
          "original-title"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "russian-state-library",
        "authorityId": "rsl",
        "authorityTier": "A",
        "recordId": "01008514258",
        "recordKind": "national-bibliography",
        "url": "https://search.rsl.ru/ru/record/01008514258",
        "language": "Russian",
        "market": "RU",
        "fields": [
          "identity",
          "authorship",
          "title",
          "language",
          "market",
          "genre"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "library-of-congress",
        "authorityId": "loc",
        "authorityTier": "A",
        "recordId": "LCCN-14001405",
        "recordKind": "national-bibliography",
        "url": "https://lccn.loc.gov/14001405/marcxml",
        "language": "English",
        "market": "US",
        "fields": [
          "identity",
          "authorship",
          "title",
          "language",
          "market",
          "container-title",
          "contained-title"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "bibliotheque-nationale-de-france",
        "authorityId": "bnf",
        "authorityTier": "A",
        "country": "france",
        "language": "en",
        "market": "FR",
        "recordKind": "national-bibliography",
        "recordId": "FRBNF17991632",
        "url": "https://data.bnf.fr/en/ark%3A/12148/cb179916322.pdf",
        "fields": [
          "identity",
          "authorship",
          "publication-year",
          "genre",
          "original-title",
          "language"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      }
    ],
    "editorial": {
      "status": "reviewed",
      "reviewedAt": "2026-09-05"
    }
  },
  "russia:turgenev:article-series-men9bv": {
    "firstPublished": 1867,
    "originalTitle": "Дым",
    "originalLanguage": "русский",
    "description": "В Баден-Бадене Григорий Литвинов ждёт свою невесту Татьяну, но встреча с прежней возлюбленной Ириной нарушает его планы. Теперь Ирина замужем, и вновь вспыхнувшее чувство ставит героя перед выбором между страстью и обязательствами. Личная история разворачивается среди русских аристократов и политических спорщиков, чьи разговоры Тургенев изображает сатирически.",
    "localizedTitles": {
      "ru": {
        "entityKind": "expression",
        "expressionId": "russia:turgenev:article-series-men9bv:ru",
        "locale": "ru",
        "value": "Дым",
        "status": "verified-published",
        "expressionLanguage": "Russian",
        "market": "RU",
        "selectionRule": "original-market-title",
        "selectionNote": "Название русского оригинала совпадает в каталоге НЭБ/РГБ и официальной карточке АСТ. Издание братьев Салаевых имеет выходной год 1868; первая журнальная публикация романа состоялась в 1867 году. Книга АСТ также содержит две повести, но ее основное заглавие — «Дым». Год этого издания АСТ не установлен и не заполнен.",
        "evidence": [
          {
            "manifestationId": "neb-000199_000009_003582019",
            "sourceUrl": "https://rusneb.ru/catalog/000199_000009_003582019/",
            "provider": "Национальная электронная библиотека / Российская государственная библиотека",
            "authorityId": "neb",
            "authorityTier": "A",
            "recordKind": "national-bibliography",
            "recordId": "000199_000009_003582019",
            "catalogTitleExact": "Дым",
            "locale": "ru",
            "market": "RU",
            "expressionLanguage": "Russian",
            "publisher": "бр. Салаевы",
            "publicationYear": 1868,
            "entityKind": "manifestation",
            "retrievedAt": "2026-09-04",
            "checkedAt": "2026-09-04",
            "checkedBy": "Codex AI / research_white_guard (independent bibliographic review)"
          },
          {
            "manifestationId": "isbn-9785171506582",
            "sourceUrl": "https://ast.ru/book/dym-866974/",
            "provider": "Издательство АСТ",
            "authorityId": "ast",
            "authorityTier": "B",
            "recordKind": "publisher-catalog",
            "recordId": "866974",
            "catalogTitleExact": "Дым",
            "locale": "ru",
            "market": "RU",
            "expressionLanguage": "Russian",
            "isbn13": "9785171506582",
            "publisher": "АСТ / Neoclassic",
            "entityKind": "manifestation",
            "retrievedAt": "2026-09-04",
            "checkedAt": "2026-09-04",
            "checkedBy": "Codex AI / research_white_guard (independent bibliographic review)"
          }
        ]
      },
      "en": {
        "entityKind": "expression",
        "expressionId": "russia:turgenev:article-series-men9bv:en",
        "locale": "en",
        "value": "Smoke",
        "status": "verified-published",
        "expressionLanguage": "English",
        "market": "US",
        "selectionRule": "current-complete-authorized-edition",
        "selectionNote": "Smoke is the NYRB title and the separately displayed main title in the NLI record. NLI displays ‘Smoke :’ followed by the separate subtitle ‘a Russian novel /’; the trailing colon is the catalogue separator. No MARC field is asserted: the full indexed primary catalogue display was read, while direct retrieval failed. The 1873 New York translation by William F. West uses the author's French version; the 2026 NYRB edition is Donald Rayfield's translation from Russian. These are distinct English editions, not a claim about the earliest English translation.",
        "evidence": [
          {
            "manifestationId": "nli-vtls000462765",
            "sourceUrl": "https://catalogue.nli.ie/Record/vtls000462765",
            "provider": "National Library of Ireland",
            "authorityId": "national-library-of-ireland",
            "authorityTier": "A",
            "recordKind": "national-bibliography",
            "recordId": "vtls000462765",
            "catalogTitleExact": "Smoke",
            "locale": "en",
            "market": "US",
            "expressionLanguage": "English",
            "publisher": "H. Holt",
            "publicationYear": 1873,
            "translator": "William F. West",
            "editionStatement": "New York; title display: Smoke : a Russian novel /; translated from the author's French version; Leisure hour series; 291 pages.",
            "entityKind": "manifestation",
            "retrievedAt": "2026-09-04",
            "checkedAt": "2026-09-04",
            "checkedBy": "Codex AI / research_white_guard (independent bibliographic review)"
          },
          {
            "manifestationId": "isbn-9798896230441",
            "sourceUrl": "https://www.nyrb.com/products/smoke-1",
            "provider": "New York Review Books",
            "authorityId": "nyrb",
            "authorityTier": "B",
            "recordKind": "publisher-catalog",
            "recordId": "9798896230441",
            "catalogTitleExact": "Smoke",
            "locale": "en",
            "market": "US",
            "expressionLanguage": "English",
            "isbn13": "9798896230441",
            "publisher": "New York Review Books",
            "publicationYear": 2026,
            "translator": "Donald Rayfield",
            "editionStatement": "NYRB Classics; published 2026-07-14; translated from Russian; 208 pages.",
            "entityKind": "manifestation",
            "retrievedAt": "2026-09-04",
            "checkedAt": "2026-09-04",
            "checkedBy": "Codex AI / research_white_guard (independent bibliographic review)"
          }
        ]
      }
    },
    "translations": {
      "ru": {
        "locale": "ru",
        "title": "Дым",
        "description": "В Баден-Бадене Григорий Литвинов ждёт свою невесту Татьяну, но встреча с прежней возлюбленной Ириной нарушает его планы. Теперь Ирина замужем, и вновь вспыхнувшее чувство ставит героя перед выбором между страстью и обязательствами. Личная история разворачивается среди русских аристократов и политических спорщиков, чьи разговоры Тургенев изображает сатирически.",
        "sourceLanguage": "ru",
        "status": "reviewed",
        "sourceUrls": [
          "https://rvb.ru/turgenev/01text/vol_07/01text/0191-02.htm",
          "https://rvb.ru/turgenev/02comm/0191.htm",
          "https://probpera.ru/stati/knizhnyy-gid/sem-nepopulyarnyh-shedevrov-velikih-pisateley-o-kotoryh-i-vy-navernyaka-ne-slyshali-chast-5/",
          "https://www.nyrb.com/products/smoke-1",
          "https://rusneb.ru/catalog/000199_000009_003582019/",
          "https://ast.ru/book/dym-866974/"
        ],
        "method": "editorial-original",
        "reviewedAt": "2026-09-04",
        "descriptionProvenance": {
          "origin": "article-adapted",
          "sourceLanguage": "ru",
          "sourceCountry": "russia",
          "sourceUrls": [
            "https://rvb.ru/turgenev/01text/vol_07/01text/0191-02.htm",
            "https://rvb.ru/turgenev/02comm/0191.htm",
            "https://probpera.ru/stati/knizhnyy-gid/sem-nepopulyarnyh-shedevrov-velikih-pisateley-o-kotoryh-i-vy-navernyaka-ne-slyshali-chast-5/",
            "https://www.nyrb.com/products/smoke-1"
          ],
          "primarySourceUrls": [
            "https://rvb.ru/turgenev/01text/vol_07/01text/0191-02.htm",
            "https://rvb.ru/turgenev/02comm/0191.htm"
          ],
          "sourceArticle": {
            "articleId": "cms-db3ab5d8-4d2f-41a3-8369-8fab1df44d86",
            "url": "https://probpera.ru/stati/knizhnyy-gid/sem-nepopulyarnyh-shedevrov-velikih-pisateley-o-kotoryh-i-vy-navernyaka-ne-slyshali-chast-5/",
            "revisionId": "f2edb7f23f41408feb091ff540dbf5c8a8ee9bd42972469126f861fd2eb46e77",
            "sourceHash": "307595117fb2295ffb9c28599ba808cad7083248837d66f04dafa0755e353577",
            "excerptHash": "6a8ccf6a4f882b8f2262b66a1457199cf744f95fd045a6621eba7f08080b6991"
          },
          "transformations": [
            "condensed",
            "deduplicated",
            "spoiler-limited",
            "style-edited"
          ],
          "rights": {
            "textOrigin": "project-owned-article",
            "copiedSourceText": false
          },
          "author": "Codex AI / root and check_release",
          "createdAt": "2026-09-04",
          "reviewedBy": "Codex AI / research_white_guard (independent review)",
          "reviewedAt": "2026-09-04"
        },
        "titleEvidence": {
          "entityKind": "expression",
          "expressionId": "russia:turgenev:article-series-men9bv:ru",
          "locale": "ru",
          "value": "Дым",
          "status": "verified-published",
          "expressionLanguage": "Russian",
          "market": "RU",
          "selectionRule": "original-market-title",
          "selectionNote": "Название русского оригинала совпадает в каталоге НЭБ/РГБ и официальной карточке АСТ. Издание братьев Салаевых имеет выходной год 1868; первая журнальная публикация романа состоялась в 1867 году. Книга АСТ также содержит две повести, но ее основное заглавие — «Дым». Год этого издания АСТ не установлен и не заполнен.",
          "evidence": [
            {
              "manifestationId": "neb-000199_000009_003582019",
              "sourceUrl": "https://rusneb.ru/catalog/000199_000009_003582019/",
              "provider": "Национальная электронная библиотека / Российская государственная библиотека",
              "authorityId": "neb",
              "authorityTier": "A",
              "recordKind": "national-bibliography",
              "recordId": "000199_000009_003582019",
              "catalogTitleExact": "Дым",
              "locale": "ru",
              "market": "RU",
              "expressionLanguage": "Russian",
              "publisher": "бр. Салаевы",
              "publicationYear": 1868,
              "entityKind": "manifestation",
              "retrievedAt": "2026-09-04",
              "checkedAt": "2026-09-04",
              "checkedBy": "Codex AI / research_white_guard (independent bibliographic review)"
            },
            {
              "manifestationId": "isbn-9785171506582",
              "sourceUrl": "https://ast.ru/book/dym-866974/",
              "provider": "Издательство АСТ",
              "authorityId": "ast",
              "authorityTier": "B",
              "recordKind": "publisher-catalog",
              "recordId": "866974",
              "catalogTitleExact": "Дым",
              "locale": "ru",
              "market": "RU",
              "expressionLanguage": "Russian",
              "isbn13": "9785171506582",
              "publisher": "АСТ / Neoclassic",
              "entityKind": "manifestation",
              "retrievedAt": "2026-09-04",
              "checkedAt": "2026-09-04",
              "checkedBy": "Codex AI / research_white_guard (independent bibliographic review)"
            }
          ]
        }
      },
      "en": {
        "locale": "en",
        "title": "Smoke",
        "description": "In Baden-Baden, Grigory Litvinov is waiting for his fiancée Tatiana when he encounters Irina, the woman he once loved. She is now married, and their renewed attraction puts his plans for marriage in jeopardy. Their private story unfolds among the Russian aristocrats and political enthusiasts at the resort, whose conversations Turgenev portrays satirically.",
        "sourceLanguage": "en",
        "status": "reviewed",
        "sourceUrls": [
          "https://www.nyrb.com/products/smoke-1",
          "https://probpera.ru/stati/knizhnyy-gid/sem-nepopulyarnyh-shedevrov-velikih-pisateley-o-kotoryh-i-vy-navernyaka-ne-slyshali-chast-5/",
          "https://rvb.ru/turgenev/01text/vol_07/01text/0191-02.htm",
          "https://rvb.ru/turgenev/02comm/0191.htm",
          "https://catalogue.nli.ie/Record/vtls000462765"
        ],
        "method": "editorial-original",
        "reviewedAt": "2026-09-04",
        "descriptionProvenance": {
          "origin": "official-source-synthesis",
          "sourceLanguage": "en",
          "sourceCountry": "russia",
          "sourceUrls": [
            "https://www.nyrb.com/products/smoke-1",
            "https://probpera.ru/stati/knizhnyy-gid/sem-nepopulyarnyh-shedevrov-velikih-pisateley-o-kotoryh-i-vy-navernyaka-ne-slyshali-chast-5/",
            "https://rvb.ru/turgenev/01text/vol_07/01text/0191-02.htm",
            "https://rvb.ru/turgenev/02comm/0191.htm"
          ],
          "primarySourceUrls": [
            "https://www.nyrb.com/products/smoke-1"
          ],
          "translatedFromLocale": "ru",
          "translatedFromSourceHash": "e708813c30867d2799d794ac9af083481715dadb6e8c7cc0c6ee761393ee81c7",
          "rights": {
            "textOrigin": "project-original",
            "copiedSourceText": false
          },
          "author": "Codex AI / root and check_release",
          "createdAt": "2026-09-04",
          "reviewedBy": "Codex AI / research_white_guard (independent review)",
          "reviewedAt": "2026-09-04"
        },
        "titleEvidence": {
          "entityKind": "expression",
          "expressionId": "russia:turgenev:article-series-men9bv:en",
          "locale": "en",
          "value": "Smoke",
          "status": "verified-published",
          "expressionLanguage": "English",
          "market": "US",
          "selectionRule": "current-complete-authorized-edition",
          "selectionNote": "Smoke is the NYRB title and the separately displayed main title in the NLI record. NLI displays ‘Smoke :’ followed by the separate subtitle ‘a Russian novel /’; the trailing colon is the catalogue separator. No MARC field is asserted: the full indexed primary catalogue display was read, while direct retrieval failed. The 1873 New York translation by William F. West uses the author's French version; the 2026 NYRB edition is Donald Rayfield's translation from Russian. These are distinct English editions, not a claim about the earliest English translation.",
          "evidence": [
            {
              "manifestationId": "nli-vtls000462765",
              "sourceUrl": "https://catalogue.nli.ie/Record/vtls000462765",
              "provider": "National Library of Ireland",
              "authorityId": "national-library-of-ireland",
              "authorityTier": "A",
              "recordKind": "national-bibliography",
              "recordId": "vtls000462765",
              "catalogTitleExact": "Smoke",
              "locale": "en",
              "market": "US",
              "expressionLanguage": "English",
              "publisher": "H. Holt",
              "publicationYear": 1873,
              "translator": "William F. West",
              "editionStatement": "New York; title display: Smoke : a Russian novel /; translated from the author's French version; Leisure hour series; 291 pages.",
              "entityKind": "manifestation",
              "retrievedAt": "2026-09-04",
              "checkedAt": "2026-09-04",
              "checkedBy": "Codex AI / research_white_guard (independent bibliographic review)"
            },
            {
              "manifestationId": "isbn-9798896230441",
              "sourceUrl": "https://www.nyrb.com/products/smoke-1",
              "provider": "New York Review Books",
              "authorityId": "nyrb",
              "authorityTier": "B",
              "recordKind": "publisher-catalog",
              "recordId": "9798896230441",
              "catalogTitleExact": "Smoke",
              "locale": "en",
              "market": "US",
              "expressionLanguage": "English",
              "isbn13": "9798896230441",
              "publisher": "New York Review Books",
              "publicationYear": 2026,
              "translator": "Donald Rayfield",
              "editionStatement": "NYRB Classics; published 2026-07-14; translated from Russian; 208 pages.",
              "entityKind": "manifestation",
              "retrievedAt": "2026-09-04",
              "checkedAt": "2026-09-04",
              "checkedBy": "Codex AI / research_white_guard (independent bibliographic review)"
            }
          ]
        }
      }
    },
    "sources": [
      {
        "provider": "Проба Пера",
        "authorityId": "probpera-editorial",
        "authorityTier": "B",
        "country": "russia",
        "language": "Russian",
        "recordKind": "article-source",
        "recordId": "cms-db3ab5d8-4d2f-41a3-8369-8fab1df44d86",
        "url": "https://probpera.ru/stati/knizhnyy-gid/sem-nepopulyarnyh-shedevrov-velikih-pisateley-o-kotoryh-i-vy-navernyaka-ne-slyshali-chast-5/",
        "fields": [
          "identity",
          "title",
          "description"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-02"
      },
      {
        "provider": "Русская виртуальная библиотека / И. С. Тургенев, Полное собрание сочинений, Наука, 1981, том 7, глава II",
        "authorityId": "rvb",
        "authorityTier": "B",
        "country": "russia",
        "language": "Russian",
        "recordKind": "authoritative-work-page",
        "recordId": "RVB-TURGENEV-0191-02",
        "url": "https://rvb.ru/turgenev/01text/vol_07/01text/0191-02.htm",
        "fields": [
          "identity",
          "authorship",
          "title",
          "description"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-04"
      },
      {
        "provider": "Русская виртуальная библиотека / Е. И. Кийко, комментарий к роману «Дым»",
        "authorityId": "rvb",
        "authorityTier": "B",
        "country": "russia",
        "language": "Russian",
        "recordKind": "authoritative-work-page",
        "recordId": "RVB-TURGENEV-COMMENT-0191",
        "url": "https://rvb.ru/turgenev/02comm/0191.htm",
        "fields": [
          "identity",
          "authorship",
          "title",
          "description",
          "publication-year"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-04"
      },
      {
        "provider": "New York Review Books",
        "authorityId": "nyrb",
        "authorityTier": "B",
        "country": "usa",
        "language": "English",
        "recordKind": "publisher-catalog",
        "recordId": "9798896230441",
        "url": "https://www.nyrb.com/products/smoke-1",
        "fields": [
          "identity",
          "authorship",
          "title",
          "description",
          "publication-year",
          "language",
          "market"
        ],
        "market": "US",
        "usage": "reference-only",
        "retrievedAt": "2026-09-04"
      },
      {
        "provider": "Национальная электронная библиотека / Российская государственная библиотека",
        "authorityId": "neb",
        "authorityTier": "A",
        "market": "RU",
        "language": "Russian",
        "recordKind": "national-bibliography",
        "recordId": "000199_000009_003582019",
        "url": "https://rusneb.ru/catalog/000199_000009_003582019/",
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
        "provider": "Издательство АСТ",
        "authorityId": "ast",
        "authorityTier": "B",
        "market": "RU",
        "language": "Russian",
        "recordKind": "publisher-catalog",
        "recordId": "866974",
        "url": "https://ast.ru/book/dym-866974/",
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
        "market": "US",
        "language": "English",
        "recordKind": "national-bibliography",
        "recordId": "vtls000462765",
        "url": "https://catalogue.nli.ie/Record/vtls000462765",
        "fields": [
          "identity",
          "authorship",
          "title",
          "language",
          "market"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-04"
      }
    ],
    "editorial": {
      "status": "reviewed",
      "reviewedAt": "2026-09-04"
    }
  },
  "russia:buninin:the-village": {
    "firstPublished": 1910,
    "originalTitle": "Деревня",
    "originalLanguage": "русский",
    "description": "В повести о русской деревне начала XX века Бунин сопоставляет судьбы братьев Красовых: зажиточного хозяина Тихона и крестьянина-самоучки Кузьмы. На фоне революции 1905 года их жизнь и повседневные столкновения складываются в суровую картину бедности, насилия и невежества.",
    "localizedTitles": {
      "ru": {
        "entityKind": "expression",
        "expressionId": "russia:buninin:the-village:ru",
        "locale": "ru",
        "value": "Деревня",
        "status": "verified-published",
        "expressionLanguage": "Russian",
        "market": "RU",
        "selectionRule": "original-market-title",
        "selectionNote": "Заглавие полного произведения установлено через аналитическое оглавление РГБ и отдельную электронную книгу Эксмо. 1977 и 2020 — годы изданий, не первая публикация повести.",
        "evidence": [
          {
            "entityKind": "manifestation",
            "manifestationId": "rsl-01007660859-derevnya-contained",
            "sourceUrl": "https://search.rsl.ru/ru/record/01007660859",
            "provider": "Российская государственная библиотека",
            "authorityId": "rsl",
            "authorityTier": "A",
            "recordKind": "national-bibliography",
            "recordId": "01007660859",
            "catalogTitleExact": "Деревня",
            "titleRelation": "contained-work",
            "analyticTitleExact": "Деревня",
            "containerTitleExact": "Деревня",
            "containedInField": "contents-note",
            "locale": "ru",
            "market": "RU",
            "expressionLanguage": "Russian",
            "publisher": "Мордов. кн. изд-во",
            "publicationYear": 1977,
            "editionStatement": "Саранск; 164 с.; повесть и рассказы. MARC 245$a: Деревня; 505$t: Деревня, Антоновские яблоки, Мелитон, Захар Воробьев, Косцы. Язык: Русский. Полный индексированный первичный MARC прочитан; прямое открытие не удалось. Сборник не отождествляется с одним произведением.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)"
          },
          {
            "entityKind": "manifestation",
            "manifestationId": "isbn-9785041469092",
            "sourceUrl": "https://eksmo.ru/ebook/derevnya-ITD1109532/",
            "provider": "Эксмо",
            "authorityId": "eksmo",
            "authorityTier": "B",
            "recordKind": "publisher-catalog",
            "recordId": "ISBN-9785041469092",
            "catalogTitleExact": "Деревня",
            "locale": "ru",
            "market": "RU",
            "expressionLanguage": "Russian",
            "isbn13": "9785041469092",
            "publisher": "Эксмо",
            "publicationYear": 2020,
            "editionStatement": "Электронная книга; дата выхода в карточке: 30.09.2020.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)"
          }
        ]
      },
      "en": {
        "entityKind": "expression",
        "expressionId": "russia:buninin:the-village:en",
        "locale": "en",
        "value": "The Village",
        "status": "verified-published",
        "expressionLanguage": "English",
        "market": "US",
        "selectionRule": "current-complete-authorized-edition",
        "selectionNote": "LoC records the US Knopf edition of Hapgood’s translation; Project Gutenberg publishes the same English work title in its US digital edition. Gutenberg reproduces a different, British 1923 print manifestation. The previous GB Alma evidence is retained as a synopsis source, not relabelled US. The generated Gutenberg catalogue summary is not used as factual evidence.",
        "evidence": [
          {
            "entityKind": "manifestation",
            "manifestationId": "loc-lccn-23009538",
            "sourceUrl": "https://lccn.loc.gov/23009538/marcxml",
            "provider": "Library of Congress",
            "authorityId": "loc",
            "authorityTier": "A",
            "recordKind": "national-bibliography",
            "recordId": "LCCN-23009538",
            "catalogTitleExact": "The village",
            "locale": "en",
            "market": "US",
            "expressionLanguage": "English",
            "publisher": "A. A. Knopf",
            "publicationYear": 1923,
            "translator": "Isabel F. Hapgood",
            "editionStatement": "New York; 291 pages; MARC 245$a is The village; and the terminal semicolon precedes the separately encoded responsibility statement in 245$c. Authorized translation from Russian; no numbered edition or ISBN is asserted.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)"
          },
          {
            "entityKind": "manifestation",
            "manifestationId": "project-gutenberg-59981",
            "sourceUrl": "https://www.gutenberg.org/ebooks/59981",
            "provider": "Project Gutenberg",
            "authorityId": "project-gutenberg",
            "authorityTier": "B",
            "recordKind": "publisher-catalog",
            "recordId": "59981",
            "catalogTitleExact": "The Village",
            "locale": "en",
            "market": "US",
            "expressionLanguage": "English",
            "publisher": "Project Gutenberg",
            "publicationYear": 2019,
            "translator": "Isabel Florence Hapgood",
            "editionStatement": "Electronic edition released 25 July 2019; public domain in the USA. The reproduced print title page is London: Martin Secker (Ltd.), 1923. The US digital publication is a separate manifestation from both that British print edition and the Knopf edition catalogued by LoC; no ISBN asserted.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)"
          }
        ]
      }
    },
    "translations": {
      "ru": {
        "locale": "ru",
        "title": "Деревня",
        "description": "В повести о русской деревне начала XX века Бунин сопоставляет судьбы братьев Красовых: зажиточного хозяина Тихона и крестьянина-самоучки Кузьмы. На фоне революции 1905 года их жизнь и повседневные столкновения складываются в суровую картину бедности, насилия и невежества.",
        "sourceLanguage": "ru",
        "status": "reviewed",
        "sourceUrls": [
          "https://ar.culture.ru/ru/subject/derevnya",
          "https://feb-web.ru/feb/ivl/vl8/vl8-0542.htm?cmd=p",
          "https://probpera.ru/stati/knizhnyy-gid/sem-nepopulyarnyh-shedevrov-velikih-pisateley-o-kotoryh-i-vy-navernyaka-ne-slyshali-chast-3/",
          "https://www.bloomsbury.com/uk/village-9781847492838/",
          "https://search.rsl.ru/ru/record/01007660859",
          "https://eksmo.ru/ebook/derevnya-ITD1109532/"
        ],
        "method": "editorial-original",
        "reviewedAt": "2026-09-04",
        "descriptionProvenance": {
          "origin": "article-adapted",
          "sourceLanguage": "ru",
          "sourceCountry": "russia",
          "sourceUrls": [
            "https://ar.culture.ru/ru/subject/derevnya",
            "https://feb-web.ru/feb/ivl/vl8/vl8-0542.htm?cmd=p",
            "https://probpera.ru/stati/knizhnyy-gid/sem-nepopulyarnyh-shedevrov-velikih-pisateley-o-kotoryh-i-vy-navernyaka-ne-slyshali-chast-3/",
            "https://www.bloomsbury.com/uk/village-9781847492838/"
          ],
          "primarySourceUrls": [
            "https://ar.culture.ru/ru/subject/derevnya",
            "https://feb-web.ru/feb/ivl/vl8/vl8-0542.htm?cmd=p"
          ],
          "sourceArticle": {
            "articleId": "cms-192bc665-3461-422c-adee-d25fb394385c",
            "url": "https://probpera.ru/stati/knizhnyy-gid/sem-nepopulyarnyh-shedevrov-velikih-pisateley-o-kotoryh-i-vy-navernyaka-ne-slyshali-chast-3/",
            "revisionId": "cb0b5dc674ae32dffec4dab9e48cf647be050900b36956429e8071afcf648624",
            "sourceHash": "9f7abf1d7c150b8555c2b8860ef3f3d80908ae27a9725249529e1178b05048b8",
            "excerptHash": "8714c0e30ca323f13fdf1d3bdd03f1cd696f0efcb0987ee8fad7854f5149c93e"
          },
          "transformations": [
            "condensed",
            "deduplicated",
            "spoiler-limited",
            "style-edited"
          ],
          "rights": {
            "textOrigin": "project-owned-article",
            "copiedSourceText": false
          },
          "author": "Codex AI / root and check_release",
          "createdAt": "2026-09-04",
          "reviewedBy": "Codex AI / research_white_guard (independent review)",
          "reviewedAt": "2026-09-04"
        },
        "titleEvidence": {
          "entityKind": "expression",
          "expressionId": "russia:buninin:the-village:ru",
          "locale": "ru",
          "value": "Деревня",
          "status": "verified-published",
          "expressionLanguage": "Russian",
          "market": "RU",
          "selectionRule": "original-market-title",
          "selectionNote": "Заглавие полного произведения установлено через аналитическое оглавление РГБ и отдельную электронную книгу Эксмо. 1977 и 2020 — годы изданий, не первая публикация повести.",
          "evidence": [
            {
              "entityKind": "manifestation",
              "manifestationId": "rsl-01007660859-derevnya-contained",
              "sourceUrl": "https://search.rsl.ru/ru/record/01007660859",
              "provider": "Российская государственная библиотека",
              "authorityId": "rsl",
              "authorityTier": "A",
              "recordKind": "national-bibliography",
              "recordId": "01007660859",
              "catalogTitleExact": "Деревня",
              "titleRelation": "contained-work",
              "analyticTitleExact": "Деревня",
              "containerTitleExact": "Деревня",
              "containedInField": "contents-note",
              "locale": "ru",
              "market": "RU",
              "expressionLanguage": "Russian",
              "publisher": "Мордов. кн. изд-во",
              "publicationYear": 1977,
              "editionStatement": "Саранск; 164 с.; повесть и рассказы. MARC 245$a: Деревня; 505$t: Деревня, Антоновские яблоки, Мелитон, Захар Воробьев, Косцы. Язык: Русский. Полный индексированный первичный MARC прочитан; прямое открытие не удалось. Сборник не отождествляется с одним произведением.",
              "retrievedAt": "2026-09-05",
              "checkedAt": "2026-09-05",
              "checkedBy": "Codex AI /root (bibliographic source review)"
            },
            {
              "entityKind": "manifestation",
              "manifestationId": "isbn-9785041469092",
              "sourceUrl": "https://eksmo.ru/ebook/derevnya-ITD1109532/",
              "provider": "Эксмо",
              "authorityId": "eksmo",
              "authorityTier": "B",
              "recordKind": "publisher-catalog",
              "recordId": "ISBN-9785041469092",
              "catalogTitleExact": "Деревня",
              "locale": "ru",
              "market": "RU",
              "expressionLanguage": "Russian",
              "isbn13": "9785041469092",
              "publisher": "Эксмо",
              "publicationYear": 2020,
              "editionStatement": "Электронная книга; дата выхода в карточке: 30.09.2020.",
              "retrievedAt": "2026-09-05",
              "checkedAt": "2026-09-05",
              "checkedBy": "Codex AI /root (bibliographic source review)"
            }
          ]
        }
      },
      "en": {
        "locale": "en",
        "title": "The Village",
        "description": "Set in rural Russia in the early twentieth century, The Village follows the contrasting lives of the Krasov brothers: Tikhon, a prosperous landowner, and Kuzma, a self-educated peasant. Against the background of the 1905 Revolution, their experiences and everyday conflicts form a stark portrait of poverty, violence and ignorance.",
        "sourceLanguage": "en",
        "status": "reviewed",
        "sourceUrls": [
          "https://www.bloomsbury.com/uk/village-9781847492838/",
          "https://probpera.ru/stati/knizhnyy-gid/sem-nepopulyarnyh-shedevrov-velikih-pisateley-o-kotoryh-i-vy-navernyaka-ne-slyshali-chast-3/",
          "https://ar.culture.ru/ru/subject/derevnya",
          "https://feb-web.ru/feb/ivl/vl8/vl8-0542.htm?cmd=p",
          "https://lccn.loc.gov/23009538/marcxml",
          "https://www.gutenberg.org/ebooks/59981"
        ],
        "method": "editorial-original",
        "reviewedAt": "2026-09-04",
        "descriptionProvenance": {
          "origin": "official-source-synthesis",
          "sourceLanguage": "en",
          "sourceCountry": "russia",
          "sourceUrls": [
            "https://www.bloomsbury.com/uk/village-9781847492838/",
            "https://probpera.ru/stati/knizhnyy-gid/sem-nepopulyarnyh-shedevrov-velikih-pisateley-o-kotoryh-i-vy-navernyaka-ne-slyshali-chast-3/",
            "https://ar.culture.ru/ru/subject/derevnya",
            "https://feb-web.ru/feb/ivl/vl8/vl8-0542.htm?cmd=p"
          ],
          "primarySourceUrls": [
            "https://www.bloomsbury.com/uk/village-9781847492838/"
          ],
          "translatedFromLocale": "ru",
          "translatedFromSourceHash": "189b37a2babc75d34112f0520a224de53f00445f7624d3e40b981cf9a4f5dc7a",
          "rights": {
            "textOrigin": "project-original",
            "copiedSourceText": false
          },
          "author": "Codex AI / root and check_release",
          "createdAt": "2026-09-04",
          "reviewedBy": "Codex AI / research_white_guard (independent review)",
          "reviewedAt": "2026-09-04"
        },
        "titleEvidence": {
          "entityKind": "expression",
          "expressionId": "russia:buninin:the-village:en",
          "locale": "en",
          "value": "The Village",
          "status": "verified-published",
          "expressionLanguage": "English",
          "market": "US",
          "selectionRule": "current-complete-authorized-edition",
          "selectionNote": "LoC records the US Knopf edition of Hapgood’s translation; Project Gutenberg publishes the same English work title in its US digital edition. Gutenberg reproduces a different, British 1923 print manifestation. The previous GB Alma evidence is retained as a synopsis source, not relabelled US. The generated Gutenberg catalogue summary is not used as factual evidence.",
          "evidence": [
            {
              "entityKind": "manifestation",
              "manifestationId": "loc-lccn-23009538",
              "sourceUrl": "https://lccn.loc.gov/23009538/marcxml",
              "provider": "Library of Congress",
              "authorityId": "loc",
              "authorityTier": "A",
              "recordKind": "national-bibliography",
              "recordId": "LCCN-23009538",
              "catalogTitleExact": "The village",
              "locale": "en",
              "market": "US",
              "expressionLanguage": "English",
              "publisher": "A. A. Knopf",
              "publicationYear": 1923,
              "translator": "Isabel F. Hapgood",
              "editionStatement": "New York; 291 pages; MARC 245$a is The village; and the terminal semicolon precedes the separately encoded responsibility statement in 245$c. Authorized translation from Russian; no numbered edition or ISBN is asserted.",
              "retrievedAt": "2026-09-05",
              "checkedAt": "2026-09-05",
              "checkedBy": "Codex AI /root (bibliographic source review)"
            },
            {
              "entityKind": "manifestation",
              "manifestationId": "project-gutenberg-59981",
              "sourceUrl": "https://www.gutenberg.org/ebooks/59981",
              "provider": "Project Gutenberg",
              "authorityId": "project-gutenberg",
              "authorityTier": "B",
              "recordKind": "publisher-catalog",
              "recordId": "59981",
              "catalogTitleExact": "The Village",
              "locale": "en",
              "market": "US",
              "expressionLanguage": "English",
              "publisher": "Project Gutenberg",
              "publicationYear": 2019,
              "translator": "Isabel Florence Hapgood",
              "editionStatement": "Electronic edition released 25 July 2019; public domain in the USA. The reproduced print title page is London: Martin Secker (Ltd.), 1923. The US digital publication is a separate manifestation from both that British print edition and the Knopf edition catalogued by LoC; no ISBN asserted.",
              "retrievedAt": "2026-09-05",
              "checkedAt": "2026-09-05",
              "checkedBy": "Codex AI /root (bibliographic source review)"
            }
          ]
        }
      }
    },
    "sources": [
      {
        "provider": "Проба Пера",
        "authorityId": "probpera-editorial",
        "authorityTier": "B",
        "country": "russia",
        "language": "Russian",
        "recordKind": "article-source",
        "recordId": "cms-192bc665-3461-422c-adee-d25fb394385c",
        "url": "https://probpera.ru/stati/knizhnyy-gid/sem-nepopulyarnyh-shedevrov-velikih-pisateley-o-kotoryh-i-vy-navernyaka-ne-slyshali-chast-3/",
        "fields": [
          "identity",
          "title",
          "description"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-02"
      },
      {
        "provider": "Президентская библиотека имени Б. Н. Ельцина",
        "authorityId": "presidential-library-ru",
        "authorityTier": "A",
        "country": "russia",
        "market": "RU",
        "language": "Russian",
        "recordKind": "authoritative-work-page",
        "recordId": "PRLIB-800603",
        "url": "https://www.prlib.ru/item/800603",
        "fields": [
          "identity",
          "authorship",
          "title",
          "publication-year",
          "language",
          "market"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-02"
      },
      {
        "provider": "Российская государственная библиотека",
        "authorityId": "rsl",
        "authorityTier": "A",
        "country": "russia",
        "market": "RU",
        "language": "Russian",
        "recordKind": "national-bibliography",
        "recordId": "RSL-01003796448",
        "url": "https://search.rsl.ru/ru/record/01003796448",
        "fields": [
          "identity",
          "authorship",
          "title",
          "publication-year",
          "language",
          "market"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-02"
      },
      {
        "provider": "ИМЛИ РАН - академическая хроника И. А. Бунина",
        "authorityId": "imli-ran-bunin",
        "authorityTier": "A",
        "country": "russia",
        "language": "Russian",
        "recordKind": "authoritative-work-page",
        "recordId": "BUNIN-CHRONICLE-1910",
        "url": "https://ivbunin.ru/index.php/biografiya/khronika",
        "fields": [
          "identity",
          "authorship",
          "publication-year",
          "description"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-02"
      },
      {
        "provider": "Nobel Prize Outreach",
        "authorityId": "nobel-prize",
        "authorityTier": "A",
        "country": "sweden",
        "language": "English",
        "recordKind": "authoritative-work-page",
        "recordId": "NOBEL-LITERATURE-1933-BUNIN-FACTS",
        "url": "https://www.nobelprize.org/prizes/literature/1933/bunin/facts/",
        "fields": [
          "identity",
          "title",
          "publication-year",
          "description"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-02"
      },
      {
        "provider": "Library of Congress",
        "authorityId": "loc",
        "authorityTier": "A",
        "country": "usa",
        "market": "US",
        "language": "English",
        "recordKind": "national-bibliography",
        "recordId": "LCCN-23009538",
        "url": "https://lccn.loc.gov/23009538/marcxml",
        "fields": [
          "identity",
          "authorship",
          "title",
          "publication-year",
          "language",
          "market"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "Литературно-мемориальный музей И. А. Бунина / ARTEFACT",
        "authorityId": "bunin-museum-yelets",
        "authorityTier": "B",
        "country": "russia",
        "language": "Russian",
        "recordKind": "authoritative-work-page",
        "recordId": "ARTEFACT-BUNIN-DEREVNYA",
        "url": "https://ar.culture.ru/ru/subject/derevnya",
        "fields": [
          "identity",
          "authorship",
          "title",
          "description",
          "publication-year",
          "genre"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-04"
      },
      {
        "provider": "ФЭБ / В. А. Келдыш, История всемирной литературы, том 8",
        "authorityId": "feb-web",
        "authorityTier": "B",
        "country": "russia",
        "language": "Russian",
        "recordKind": "authoritative-work-page",
        "recordId": "FEB-IVL-V8-0542",
        "url": "https://feb-web.ru/feb/ivl/vl8/vl8-0542.htm?cmd=p",
        "fields": [
          "identity",
          "authorship",
          "title",
          "description"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-04"
      },
      {
        "provider": "Alma Books / Bloomsbury",
        "authorityId": "alma-books",
        "authorityTier": "B",
        "country": "united-kingdom",
        "language": "English",
        "recordKind": "authoritative-work-page",
        "recordId": "9781847492838",
        "url": "https://www.bloomsbury.com/uk/village-9781847492838/",
        "fields": [
          "identity",
          "authorship",
          "title",
          "description"
        ],
        "market": "GB",
        "usage": "reference-only",
        "retrievedAt": "2026-09-04"
      },
      {
        "provider": "Российская государственная библиотека",
        "authorityId": "rsl",
        "authorityTier": "A",
        "recordId": "01007660859",
        "recordKind": "national-bibliography",
        "url": "https://search.rsl.ru/ru/record/01007660859",
        "language": "Russian",
        "market": "RU",
        "fields": [
          "identity",
          "authorship",
          "title",
          "language",
          "market",
          "container-title",
          "contained-title"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "Эксмо",
        "authorityId": "eksmo",
        "authorityTier": "B",
        "recordId": "ISBN-9785041469092",
        "recordKind": "publisher-catalog",
        "url": "https://eksmo.ru/ebook/derevnya-ITD1109532/",
        "language": "Russian",
        "market": "RU",
        "fields": [
          "identity",
          "authorship",
          "title",
          "language",
          "market"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "Project Gutenberg",
        "authorityId": "project-gutenberg",
        "authorityTier": "B",
        "recordId": "59981",
        "recordKind": "publisher-catalog",
        "url": "https://www.gutenberg.org/ebooks/59981",
        "language": "English",
        "market": "US",
        "fields": [
          "identity",
          "authorship",
          "title",
          "language",
          "market"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      }
    ],
    "editorial": {
      "status": "reviewed",
      "reviewedAt": "2026-09-05"
    }
  },
  "russia:tolstoy:article-series-zqpjjm": {
    "firstPublished": 1911,
    "originalTitle": "После бала",
    "originalLanguage": "Russian",
    "description": "Иван Васильевич вспоминает бал, на котором его влюблённость в Вареньку окрашивает всё происходящее ощущением счастья и гармонии. Увиденная следующим утром сцена телесного наказания заставляет его иначе взглянуть на отца девушки, общественный порядок и собственное будущее.",
    "localizedTitles": {
      "ru": {
        "entityKind": "expression",
        "expressionId": "russia:tolstoy:article-series-zqpjjm:ru",
        "locale": "ru",
        "value": "После бала",
        "status": "verified-published",
        "expressionLanguage": "Russian",
        "market": "RU",
        "selectionRule": "original-market-title",
        "selectionNote": "Exact Russian printed title retained; the national contents entry and independent Russian publisher/critical edition identify this work inside their separately named collections.",
        "evidence": [
          {
            "entityKind": "manifestation",
            "manifestationId": "rsl-tolstoy-1992-v34-после-бала",
            "sourceUrl": "https://search.rsl.ru/ru/record/01009702526",
            "provider": "rsl",
            "authorityId": "rsl",
            "authorityTier": "A",
            "recordKind": "national-bibliography",
            "recordId": "01009702526:volume-34:После бала",
            "titleRelation": "contained-work",
            "catalogTitleExact": "Полное собрание сочинений [Текст]",
            "analyticTitleExact": "После бала",
            "containerTitleExact": "Полное собрание сочинений [Текст]",
            "containedInField": "contents-note",
            "locale": "ru",
            "market": "RU",
            "expressionLanguage": "Russian",
            "publicationYear": 1992,
            "publisher": "Изд. центр \"Терра\"",
            "editionStatement": "Т. 34; переиздание 1992 года. Аналитическое заглавие из состава тома в национальной записи; годы создания и год первоначального академического издания не подменяют 1992.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (independent bibliographic review)"
          },
          {
            "entityKind": "manifestation",
            "manifestationId": "ast-posle-bala-033103-после-бала",
            "sourceUrl": "https://ast.ru/book/posle-bala-033103/",
            "provider": "ast",
            "authorityId": "ast",
            "authorityTier": "B",
            "recordKind": "publisher-catalog",
            "recordId": "ISBN-9785170622368:После бала",
            "titleRelation": "contained-work",
            "catalogTitleExact": "После бала",
            "analyticTitleExact": "После бала",
            "containerTitleExact": "После бала",
            "containedInField": "contents-note",
            "locale": "ru",
            "market": "RU",
            "expressionLanguage": "Russian",
            "publisher": "АСТ",
            "isbn13": "9785170622368",
            "editionStatement": "Русская классика; 352 страницы. Состав прямо назван в аннотации. Язык книги дополнительно подтверждён русской записью РГБ 01004573408 того же ISBN; дата нынешнего экземпляра АСТ не заявляется.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (independent bibliographic review)"
          }
        ]
      },
      "en": {
        "entityKind": "expression",
        "expressionId": "russia:tolstoy:article-series-zqpjjm:en",
        "locale": "en",
        "value": "After the Dance",
        "status": "verified-published",
        "expressionLanguage": "English",
        "market": "US",
        "selectionRule": "current-complete-authorized-edition",
        "selectionNote": "The exact title is independently attested by a US/transatlantic national catalog manifestation and a US digital edition; collections and translations are not treated as identical whole editions.",
        "evidence": [
          {
            "entityKind": "manifestation",
            "manifestationId": "loc-tolstoy-1911-after-the-dance",
            "sourceUrl": "https://lccn.loc.gov/12000327/marcxml",
            "provider": "loc",
            "authorityId": "loc",
            "authorityTier": "A",
            "recordKind": "national-bibliography",
            "recordId": "12000327:After the dance",
            "titleRelation": "contained-work",
            "catalogTitleExact": "The forged coupon, and other stories and dramas,",
            "analyticTitleExact": "After the dance",
            "containerTitleExact": "The forged coupon, and other stories and dramas,",
            "containedInField": "contents-note",
            "locale": "en",
            "market": "US",
            "expressionLanguage": "English",
            "publicationYear": 1911,
            "publisher": "T. Nelson and sons",
            "editionStatement": "London, New York [etc.], c1911; 429 p.; editor C. T. Hagberg Wright. Exact story entry from MARC 505; no unrecorded translator is assigned.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (independent bibliographic review)"
          },
          {
            "entityKind": "manifestation",
            "manifestationId": "pg-243-after-the-dance",
            "sourceUrl": "https://www.gutenberg.org/ebooks/243",
            "provider": "project-gutenberg",
            "authorityId": "project-gutenberg",
            "authorityTier": "B",
            "recordKind": "publisher-catalog",
            "recordId": "PG-243:After the dance",
            "titleRelation": "contained-work",
            "catalogTitleExact": "The forged coupon, and other stories",
            "analyticTitleExact": "After the dance",
            "containerTitleExact": "The forged coupon, and other stories",
            "containedInField": "table-of-contents",
            "locale": "en",
            "market": "US",
            "expressionLanguage": "English",
            "publicationYear": 2006,
            "publisher": "Project Gutenberg",
            "editionStatement": "US ebook 243, released 2006-03-15. Its contents differ from the 1911 collection as a whole; only the explicitly shared contained story is equated.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (independent bibliographic review)"
          }
        ]
      }
    },
    "translations": {
      "ru": {
        "locale": "ru",
        "title": "После бала",
        "description": "Иван Васильевич вспоминает бал, на котором его влюблённость в Вареньку окрашивает всё происходящее ощущением счастья и гармонии. Увиденная следующим утром сцена телесного наказания заставляет его иначе взглянуть на отца девушки, общественный порядок и собственное будущее.",
        "sourceLanguage": "ru",
        "status": "reviewed",
        "sourceUrls": [
          "https://tolstoy.ru/online/90/34/",
          "https://probpera.ru/stati/o-literature/sem-maloizvestnyh-rasskazov-imenityh-pisateley-kotorye-sleduet-prochitat-kazhdomu-l-n-tolstoy/",
          "https://www.gutenberg.org/files/243/243-h/243-h.htm",
          "https://search.rsl.ru/ru/record/01009702526",
          "https://ast.ru/book/posle-bala-033103/",
          "https://www.penguin.co.uk/books/35513/the-death-of-ivan-ilyich-and-other-stories-by-leo-tolstoy-intro--anthony-briggs-edited-and-trans-by--anthony-briggs-edited-and-trans-by--ronald-wilks-edited-and-trans-by-david-mcduff/9780140449617"
        ],
        "method": "editorial-original",
        "reviewedAt": "2026-09-05",
        "descriptionProvenance": {
          "origin": "article-adapted",
          "sourceLanguage": "ru",
          "sourceCountry": "russia",
          "sourceUrls": [
            "https://tolstoy.ru/online/90/34/",
            "https://probpera.ru/stati/o-literature/sem-maloizvestnyh-rasskazov-imenityh-pisateley-kotorye-sleduet-prochitat-kazhdomu-l-n-tolstoy/",
            "https://www.penguin.co.uk/books/35513/the-death-of-ivan-ilyich-and-other-stories-by-leo-tolstoy-intro--anthony-briggs-edited-and-trans-by--anthony-briggs-edited-and-trans-by--ronald-wilks-edited-and-trans-by-david-mcduff/9780140449617"
          ],
          "sourceArticle": {
            "articleId": "cms-766846e2-a653-465e-a4b4-ce327a22696f",
            "url": "https://probpera.ru/stati/o-literature/sem-maloizvestnyh-rasskazov-imenityh-pisateley-kotorye-sleduet-prochitat-kazhdomu-l-n-tolstoy/",
            "revisionId": "5a3574570e446af11c1ee561fe315372fafd1ffa7dd75717b75938c7a49264d2",
            "sourceHash": "b82906459f57f1bfc156f9be1d4853f01927c91f751df0d3880ee16852155d16",
            "excerptHash": "17db52ebc99f90eaa479674d7cf599726acac96bafe8dfa07d4239e4ed7b798c"
          },
          "transformations": [
            "condensed",
            "deduplicated",
            "spoiler-limited",
            "style-edited"
          ],
          "rights": {
            "textOrigin": "project-owned-article",
            "copiedSourceText": false
          },
          "author": "Редакция «Пробы Пера»",
          "createdAt": "2026-09-02",
          "reviewedBy": "Codex AI /root (independent review)",
          "reviewedAt": "2026-09-05",
          "primarySourceUrls": [
            "https://tolstoy.ru/online/90/34/"
          ]
        },
        "titleEvidence": {
          "entityKind": "expression",
          "expressionId": "russia:tolstoy:article-series-zqpjjm:ru",
          "locale": "ru",
          "value": "После бала",
          "status": "verified-published",
          "expressionLanguage": "Russian",
          "market": "RU",
          "selectionRule": "original-market-title",
          "selectionNote": "Exact Russian printed title retained; the national contents entry and independent Russian publisher/critical edition identify this work inside their separately named collections.",
          "evidence": [
            {
              "entityKind": "manifestation",
              "manifestationId": "rsl-tolstoy-1992-v34-после-бала",
              "sourceUrl": "https://search.rsl.ru/ru/record/01009702526",
              "provider": "rsl",
              "authorityId": "rsl",
              "authorityTier": "A",
              "recordKind": "national-bibliography",
              "recordId": "01009702526:volume-34:После бала",
              "titleRelation": "contained-work",
              "catalogTitleExact": "Полное собрание сочинений [Текст]",
              "analyticTitleExact": "После бала",
              "containerTitleExact": "Полное собрание сочинений [Текст]",
              "containedInField": "contents-note",
              "locale": "ru",
              "market": "RU",
              "expressionLanguage": "Russian",
              "publicationYear": 1992,
              "publisher": "Изд. центр \"Терра\"",
              "editionStatement": "Т. 34; переиздание 1992 года. Аналитическое заглавие из состава тома в национальной записи; годы создания и год первоначального академического издания не подменяют 1992.",
              "retrievedAt": "2026-09-05",
              "checkedAt": "2026-09-05",
              "checkedBy": "Codex AI /root (independent bibliographic review)"
            },
            {
              "entityKind": "manifestation",
              "manifestationId": "ast-posle-bala-033103-после-бала",
              "sourceUrl": "https://ast.ru/book/posle-bala-033103/",
              "provider": "ast",
              "authorityId": "ast",
              "authorityTier": "B",
              "recordKind": "publisher-catalog",
              "recordId": "ISBN-9785170622368:После бала",
              "titleRelation": "contained-work",
              "catalogTitleExact": "После бала",
              "analyticTitleExact": "После бала",
              "containerTitleExact": "После бала",
              "containedInField": "contents-note",
              "locale": "ru",
              "market": "RU",
              "expressionLanguage": "Russian",
              "publisher": "АСТ",
              "isbn13": "9785170622368",
              "editionStatement": "Русская классика; 352 страницы. Состав прямо назван в аннотации. Язык книги дополнительно подтверждён русской записью РГБ 01004573408 того же ISBN; дата нынешнего экземпляра АСТ не заявляется.",
              "retrievedAt": "2026-09-05",
              "checkedAt": "2026-09-05",
              "checkedBy": "Codex AI /root (independent bibliographic review)"
            }
          ]
        }
      },
      "en": {
        "locale": "en",
        "title": "After the Dance",
        "description": "Ivan Vasilyevich recalls a ball at which his love for Varenka fills everything with a sense of happiness and harmony. A scene of corporal punishment that he witnesses the following morning makes him see the young woman's father, the social order, and his own future differently.",
        "sourceLanguage": "en",
        "status": "reviewed",
        "sourceUrls": [
          "https://www.gutenberg.org/files/243/243-h/243-h.htm",
          "https://probpera.ru/stati/o-literature/sem-maloizvestnyh-rasskazov-imenityh-pisateley-kotorye-sleduet-prochitat-kazhdomu-l-n-tolstoy/",
          "https://tolstoy.ru/online/90/34/",
          "https://lccn.loc.gov/12000327/marcxml",
          "https://www.gutenberg.org/ebooks/243",
          "https://www.penguin.co.uk/books/35513/the-death-of-ivan-ilyich-and-other-stories-by-leo-tolstoy-intro--anthony-briggs-edited-and-trans-by--anthony-briggs-edited-and-trans-by--ronald-wilks-edited-and-trans-by-david-mcduff/9780140449617"
        ],
        "method": "editorial-original",
        "reviewedAt": "2026-09-05",
        "descriptionProvenance": {
          "origin": "official-source-synthesis",
          "sourceLanguage": "en",
          "sourceCountry": "russia",
          "sourceUrls": [
            "https://probpera.ru/stati/o-literature/sem-maloizvestnyh-rasskazov-imenityh-pisateley-kotorye-sleduet-prochitat-kazhdomu-l-n-tolstoy/",
            "https://tolstoy.ru/online/90/34/",
            "https://www.penguin.co.uk/books/35513/the-death-of-ivan-ilyich-and-other-stories-by-leo-tolstoy-intro--anthony-briggs-edited-and-trans-by--anthony-briggs-edited-and-trans-by--ronald-wilks-edited-and-trans-by-david-mcduff/9780140449617"
          ],
          "translatedFromLocale": "ru",
          "translatedFromSourceHash": "48b5d6007f80fee70ce647d29ab0686c77b3cfdf167577585d01fff6305cf48b",
          "rights": {
            "textOrigin": "project-original",
            "copiedSourceText": false
          },
          "author": "Редакция «Пробы Пера»",
          "createdAt": "2026-09-02",
          "reviewedBy": "Codex AI /root (independent review)",
          "reviewedAt": "2026-09-05",
          "primarySourceUrls": [
            "https://www.penguin.co.uk/books/35513/the-death-of-ivan-ilyich-and-other-stories-by-leo-tolstoy-intro--anthony-briggs-edited-and-trans-by--anthony-briggs-edited-and-trans-by--ronald-wilks-edited-and-trans-by-david-mcduff/9780140449617"
          ]
        },
        "titleEvidence": {
          "entityKind": "expression",
          "expressionId": "russia:tolstoy:article-series-zqpjjm:en",
          "locale": "en",
          "value": "After the Dance",
          "status": "verified-published",
          "expressionLanguage": "English",
          "market": "US",
          "selectionRule": "current-complete-authorized-edition",
          "selectionNote": "The exact title is independently attested by a US/transatlantic national catalog manifestation and a US digital edition; collections and translations are not treated as identical whole editions.",
          "evidence": [
            {
              "entityKind": "manifestation",
              "manifestationId": "loc-tolstoy-1911-after-the-dance",
              "sourceUrl": "https://lccn.loc.gov/12000327/marcxml",
              "provider": "loc",
              "authorityId": "loc",
              "authorityTier": "A",
              "recordKind": "national-bibliography",
              "recordId": "12000327:After the dance",
              "titleRelation": "contained-work",
              "catalogTitleExact": "The forged coupon, and other stories and dramas,",
              "analyticTitleExact": "After the dance",
              "containerTitleExact": "The forged coupon, and other stories and dramas,",
              "containedInField": "contents-note",
              "locale": "en",
              "market": "US",
              "expressionLanguage": "English",
              "publicationYear": 1911,
              "publisher": "T. Nelson and sons",
              "editionStatement": "London, New York [etc.], c1911; 429 p.; editor C. T. Hagberg Wright. Exact story entry from MARC 505; no unrecorded translator is assigned.",
              "retrievedAt": "2026-09-05",
              "checkedAt": "2026-09-05",
              "checkedBy": "Codex AI /root (independent bibliographic review)"
            },
            {
              "entityKind": "manifestation",
              "manifestationId": "pg-243-after-the-dance",
              "sourceUrl": "https://www.gutenberg.org/ebooks/243",
              "provider": "project-gutenberg",
              "authorityId": "project-gutenberg",
              "authorityTier": "B",
              "recordKind": "publisher-catalog",
              "recordId": "PG-243:After the dance",
              "titleRelation": "contained-work",
              "catalogTitleExact": "The forged coupon, and other stories",
              "analyticTitleExact": "After the dance",
              "containerTitleExact": "The forged coupon, and other stories",
              "containedInField": "table-of-contents",
              "locale": "en",
              "market": "US",
              "expressionLanguage": "English",
              "publicationYear": 2006,
              "publisher": "Project Gutenberg",
              "editionStatement": "US ebook 243, released 2006-03-15. Its contents differ from the 1911 collection as a whole; only the explicitly shared contained story is equated.",
              "retrievedAt": "2026-09-05",
              "checkedAt": "2026-09-05",
              "checkedBy": "Codex AI /root (independent bibliographic review)"
            }
          ]
        }
      }
    },
    "sources": [
      {
        "provider": "Проба Пера",
        "authorityId": "probpera-editorial",
        "authorityTier": "B",
        "country": "russia",
        "language": "Russian",
        "recordKind": "article-source",
        "recordId": "cms-766846e2-a653-465e-a4b4-ce327a22696f",
        "url": "https://probpera.ru/stati/o-literature/sem-maloizvestnyh-rasskazov-imenityh-pisateley-kotorye-sleduet-prochitat-kazhdomu-l-n-tolstoy/",
        "fields": [
          "identity",
          "title",
          "description"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-02"
      },
      {
        "provider": "Государственный музей Л. Н. Толстого / музей-усадьба «Ясная Поляна»",
        "authorityId": "tolstoy-museum",
        "authorityTier": "B",
        "country": "russia",
        "language": "Russian",
        "market": "RU",
        "recordKind": "authoritative-work-page",
        "recordId": "TOLSTOY-COLLECTED-WORKS-VOLUME-34-AFTER-THE-BALL",
        "url": "https://tolstoy.ru/online/90/34/",
        "fields": [
          "identity",
          "authorship",
          "original-title",
          "publication-year",
          "language",
          "title",
          "description"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-02"
      },
      {
        "provider": "Project Gutenberg / published English literary text",
        "authorityId": "project-gutenberg",
        "authorityTier": "B",
        "country": "usa",
        "market": "US",
        "language": "English",
        "recordKind": "authoritative-work-page",
        "recordId": "PG-243-PRIMARY-TEXT",
        "url": "https://www.gutenberg.org/files/243/243-h/243-h.htm",
        "fields": [
          "identity",
          "authorship"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "rsl",
        "authorityId": "rsl",
        "authorityTier": "A",
        "recordId": "01009702526:volume-34:После бала",
        "recordKind": "national-bibliography",
        "url": "https://search.rsl.ru/ru/record/01009702526",
        "language": "Russian",
        "market": "RU",
        "fields": [
          "identity",
          "authorship",
          "title",
          "language",
          "market",
          "container-title",
          "contained-title"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "ast",
        "authorityId": "ast",
        "authorityTier": "B",
        "recordId": "ISBN-9785170622368:После бала",
        "recordKind": "publisher-catalog",
        "url": "https://ast.ru/book/posle-bala-033103/",
        "language": "Russian",
        "market": "RU",
        "fields": [
          "identity",
          "authorship",
          "title",
          "language",
          "market",
          "container-title",
          "contained-title"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "loc",
        "authorityId": "loc",
        "authorityTier": "A",
        "recordId": "12000327:After the dance",
        "recordKind": "national-bibliography",
        "url": "https://lccn.loc.gov/12000327/marcxml",
        "language": "English",
        "market": "US",
        "fields": [
          "identity",
          "authorship",
          "title",
          "language",
          "market",
          "container-title",
          "contained-title"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "project-gutenberg",
        "authorityId": "project-gutenberg",
        "authorityTier": "B",
        "recordId": "PG-243:After the dance",
        "recordKind": "publisher-catalog",
        "url": "https://www.gutenberg.org/ebooks/243",
        "language": "English",
        "market": "US",
        "fields": [
          "identity",
          "authorship",
          "title",
          "language",
          "market",
          "container-title",
          "contained-title"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "penguin-books-uk",
        "authorityId": "penguin-uk",
        "authorityTier": "B",
        "country": "england",
        "market": "GB",
        "language": "English",
        "recordKind": "publisher-catalog",
        "recordId": "ISBN-9780140449617",
        "url": "https://www.penguin.co.uk/books/35513/the-death-of-ivan-ilyich-and-other-stories-by-leo-tolstoy-intro--anthony-briggs-edited-and-trans-by--anthony-briggs-edited-and-trans-by--ronald-wilks-edited-and-trans-by-david-mcduff/9780140449617",
        "fields": [
          "identity",
          "authorship",
          "description"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-12"
      }
    ],
    "editorial": {
      "status": "reviewed",
      "reviewedAt": "2026-09-05"
    }
  },
  "usa:jack_london:article-catalog-1hfivd6": {
    "firstPublished": 1908,
    "originalTitle": "The Iron Heel",
    "originalLanguage": "English",
    "description": "Воображаемая Америка начала XX века оказывается под властью олигархии, подавляющей инакомыслие силой. Эвис Эвергард, жена одного из руководителей сопротивления, оставляет рассказ о борьбе против этого порядка. Её рукопись, прочитанная историком далёкого будущего, соединяет личное свидетельство с картиной общественного насилия.",
    "localizedTitles": {
      "ru": {
        "entityKind": "expression",
        "expressionId": "usa:jack_london:article-catalog-1hfivd6:ru",
        "locale": "ru",
        "value": "Железная пята",
        "status": "verified-published",
        "expressionLanguage": "Russian",
        "market": "RU",
        "selectionRule": "current-complete-authorized-edition",
        "selectionNote": "Russian title independently checked against the national bibliography and a distinct Russian publisher. Historical translation metadata is not equated with the current publisher manifestation.",
        "evidence": [
          {
            "entityKind": "manifestation",
            "manifestationId": "rsl-01009213700",
            "sourceUrl": "https://search.rsl.ru/ru/record/01009213700",
            "provider": "Российская государственная библиотека",
            "authorityId": "rsl",
            "authorityTier": "A",
            "recordKind": "national-bibliography",
            "recordId": "01009213700",
            "catalogTitleExact": "Железная пята",
            "locale": "ru",
            "market": "RU",
            "expressionLanguage": "Russian",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (independent bibliographic review)",
            "publisher": "Гос. изд-во",
            "publicationYear": 1927,
            "translator": "Е. Бройдо",
            "editionStatement": "Москва; Ленинград; 372 с.; 13х10 см. MARC 245$a: Железная пята; 041$a rus, $h eng; 044$a ru; 500 identifies the original as Jack London. The iron heel. Full indexed primary MARC read."
          },
          {
            "entityKind": "manifestation",
            "manifestationId": "eksmo-ITD1421733",
            "sourceUrl": "https://eksmo.ru/book/zheleznaya-pyata-ITD1421733/",
            "provider": "Эксмо",
            "authorityId": "eksmo",
            "authorityTier": "B",
            "recordKind": "publisher-catalog",
            "recordId": "ITD1421733",
            "catalogTitleExact": "Железная пята",
            "locale": "ru",
            "market": "RU",
            "expressionLanguage": "Russian",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (independent bibliographic review)",
            "publisher": "Эксмо",
            "editionStatement": "Official Russian publisher work/product page already read in the source dossier. No publication year or translator is inferred from an undated product page."
          }
        ]
      },
      "en": {
        "entityKind": "expression",
        "expressionId": "usa:jack_london:article-catalog-1hfivd6:en",
        "locale": "en",
        "value": "The Iron Heel",
        "status": "verified-published",
        "expressionLanguage": "English",
        "market": "US",
        "selectionRule": "original-market-title",
        "selectionNote": "English title checked against the original US print manifestation and a distinct Gutenberg US digital edition. Catalog title capitalization is normalized for display; terminal ISBD separators are not title content.",
        "evidence": [
          {
            "entityKind": "manifestation",
            "manifestationId": "loc-lccn-08006034",
            "sourceUrl": "https://lccn.loc.gov/08006034/marcxml",
            "provider": "Library of Congress",
            "authorityId": "loc",
            "authorityTier": "A",
            "recordKind": "national-bibliography",
            "recordId": "LCCN-08006034",
            "catalogTitleExact": "The iron heel",
            "locale": "en",
            "market": "US",
            "expressionLanguage": "English",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (independent bibliographic review)",
            "publisher": "The Macmillan Company",
            "publicationYear": 1908,
            "editionStatement": "New York; London. MARC 260$c: 1908, c1907. The copyright year 1907 is not substituted for the 1908 publication; MARC 500 explicitly says Published February, 1908. MARC terminal ISBD punctuation is excluded from the work-title value, retained verbatim in the source check."
          },
          {
            "entityKind": "manifestation",
            "manifestationId": "project-gutenberg-1164",
            "sourceUrl": "https://www.gutenberg.org/ebooks/1164",
            "provider": "Project Gutenberg",
            "authorityId": "project-gutenberg",
            "authorityTier": "B",
            "recordKind": "publisher-catalog",
            "recordId": "1164",
            "catalogTitleExact": "The iron heel",
            "locale": "en",
            "market": "US",
            "expressionLanguage": "English",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (independent bibliographic review)",
            "publisher": "Project Gutenberg",
            "publicationYear": 2006,
            "editionStatement": "US digital edition; official catalog Release Date 2006-05-03; Language English; Copyright Public domain in the USA. This digital manifestation is separate from any reproduced print edition. No claim that its print source is this LoC manifestation, nor that it is a US print edition. Generated catalog summaries are not factual synopsis evidence."
          }
        ]
      }
    },
    "translations": {
      "ru": {
        "locale": "ru",
        "title": "Железная пята",
        "description": "Воображаемая Америка начала XX века оказывается под властью олигархии, подавляющей инакомыслие силой. Эвис Эвергард, жена одного из руководителей сопротивления, оставляет рассказ о борьбе против этого порядка. Её рукопись, прочитанная историком далёкого будущего, соединяет личное свидетельство с картиной общественного насилия.",
        "sourceLanguage": "ru",
        "status": "reviewed",
        "sourceUrls": [
          "https://eksmo.ru/book/zheleznaya-pyata-ITD1421733/",
          "https://www.gutenberg.org/files/1164/1164-h/1164-h.htm",
          "https://search.rsl.ru/ru/record/01009213700",
          "https://www.penguinrandomhouse.com/books/296408/the-iron-heel-by-jack-london-edited-with-an-introduction-by-jonathan-auerbach-notes-by-jordan-schugar/"
        ],
        "method": "editorial-original",
        "reviewedAt": "2026-09-05",
        "descriptionProvenance": {
          "origin": "official-source-synthesis",
          "sourceLanguage": "ru",
          "sourceCountry": "usa",
          "sourceUrls": [
            "https://eksmo.ru/book/zheleznaya-pyata-ITD1421733/",
            "https://www.penguinrandomhouse.com/books/296408/the-iron-heel-by-jack-london-edited-with-an-introduction-by-jonathan-auerbach-notes-by-jordan-schugar/"
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
          "author": "Codex AI / london_bilingual_batch",
          "createdAt": "2026-09-05",
          "reviewedBy": "Codex AI / review_ru_public_gaps",
          "reviewedAt": "2026-09-05",
          "primarySourceUrls": [
            "https://eksmo.ru/book/zheleznaya-pyata-ITD1421733/"
          ]
        },
        "titleEvidence": {
          "entityKind": "expression",
          "expressionId": "usa:jack_london:article-catalog-1hfivd6:ru",
          "locale": "ru",
          "value": "Железная пята",
          "status": "verified-published",
          "expressionLanguage": "Russian",
          "market": "RU",
          "selectionRule": "current-complete-authorized-edition",
          "selectionNote": "Russian title independently checked against the national bibliography and a distinct Russian publisher. Historical translation metadata is not equated with the current publisher manifestation.",
          "evidence": [
            {
              "entityKind": "manifestation",
              "manifestationId": "rsl-01009213700",
              "sourceUrl": "https://search.rsl.ru/ru/record/01009213700",
              "provider": "Российская государственная библиотека",
              "authorityId": "rsl",
              "authorityTier": "A",
              "recordKind": "national-bibliography",
              "recordId": "01009213700",
              "catalogTitleExact": "Железная пята",
              "locale": "ru",
              "market": "RU",
              "expressionLanguage": "Russian",
              "retrievedAt": "2026-09-05",
              "checkedAt": "2026-09-05",
              "checkedBy": "Codex AI /root (independent bibliographic review)",
              "publisher": "Гос. изд-во",
              "publicationYear": 1927,
              "translator": "Е. Бройдо",
              "editionStatement": "Москва; Ленинград; 372 с.; 13х10 см. MARC 245$a: Железная пята; 041$a rus, $h eng; 044$a ru; 500 identifies the original as Jack London. The iron heel. Full indexed primary MARC read."
            },
            {
              "entityKind": "manifestation",
              "manifestationId": "eksmo-ITD1421733",
              "sourceUrl": "https://eksmo.ru/book/zheleznaya-pyata-ITD1421733/",
              "provider": "Эксмо",
              "authorityId": "eksmo",
              "authorityTier": "B",
              "recordKind": "publisher-catalog",
              "recordId": "ITD1421733",
              "catalogTitleExact": "Железная пята",
              "locale": "ru",
              "market": "RU",
              "expressionLanguage": "Russian",
              "retrievedAt": "2026-09-05",
              "checkedAt": "2026-09-05",
              "checkedBy": "Codex AI /root (independent bibliographic review)",
              "publisher": "Эксмо",
              "editionStatement": "Official Russian publisher work/product page already read in the source dossier. No publication year or translator is inferred from an undated product page."
            }
          ]
        }
      },
      "en": {
        "locale": "en",
        "title": "The Iron Heel",
        "description": "Avis Everhard records the rise of an oligarchy that crushes opposition in an imagined early-twentieth-century America. Her account follows the revolutionary struggle in which she and her husband take part. Presented with commentary from a historian centuries later, her manuscript sets an intimate testimony against the workings of organized repression.",
        "sourceLanguage": "en",
        "status": "reviewed",
        "sourceUrls": [
          "https://www.gutenberg.org/files/1164/1164-h/1164-h.htm",
          "https://eksmo.ru/book/zheleznaya-pyata-ITD1421733/",
          "https://lccn.loc.gov/08006034/marcxml",
          "https://www.gutenberg.org/ebooks/1164",
          "https://www.penguinrandomhouse.com/books/296408/the-iron-heel-by-jack-london-edited-with-an-introduction-by-jonathan-auerbach-notes-by-jordan-schugar/"
        ],
        "method": "editorial-original",
        "reviewedAt": "2026-09-05",
        "descriptionProvenance": {
          "origin": "official-source-synthesis",
          "sourceLanguage": "en",
          "sourceCountry": "usa",
          "sourceUrls": [
            "https://eksmo.ru/book/zheleznaya-pyata-ITD1421733/",
            "https://www.penguinrandomhouse.com/books/296408/the-iron-heel-by-jack-london-edited-with-an-introduction-by-jonathan-auerbach-notes-by-jordan-schugar/"
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
          "author": "Codex AI / london_bilingual_batch",
          "createdAt": "2026-09-05",
          "reviewedBy": "Codex AI / review_ru_public_gaps",
          "reviewedAt": "2026-09-05",
          "primarySourceUrls": [
            "https://www.penguinrandomhouse.com/books/296408/the-iron-heel-by-jack-london-edited-with-an-introduction-by-jonathan-auerbach-notes-by-jordan-schugar/"
          ]
        },
        "titleEvidence": {
          "entityKind": "expression",
          "expressionId": "usa:jack_london:article-catalog-1hfivd6:en",
          "locale": "en",
          "value": "The Iron Heel",
          "status": "verified-published",
          "expressionLanguage": "English",
          "market": "US",
          "selectionRule": "original-market-title",
          "selectionNote": "English title checked against the original US print manifestation and a distinct Gutenberg US digital edition. Catalog title capitalization is normalized for display; terminal ISBD separators are not title content.",
          "evidence": [
            {
              "entityKind": "manifestation",
              "manifestationId": "loc-lccn-08006034",
              "sourceUrl": "https://lccn.loc.gov/08006034/marcxml",
              "provider": "Library of Congress",
              "authorityId": "loc",
              "authorityTier": "A",
              "recordKind": "national-bibliography",
              "recordId": "LCCN-08006034",
              "catalogTitleExact": "The iron heel",
              "locale": "en",
              "market": "US",
              "expressionLanguage": "English",
              "retrievedAt": "2026-09-05",
              "checkedAt": "2026-09-05",
              "checkedBy": "Codex AI /root (independent bibliographic review)",
              "publisher": "The Macmillan Company",
              "publicationYear": 1908,
              "editionStatement": "New York; London. MARC 260$c: 1908, c1907. The copyright year 1907 is not substituted for the 1908 publication; MARC 500 explicitly says Published February, 1908. MARC terminal ISBD punctuation is excluded from the work-title value, retained verbatim in the source check."
            },
            {
              "entityKind": "manifestation",
              "manifestationId": "project-gutenberg-1164",
              "sourceUrl": "https://www.gutenberg.org/ebooks/1164",
              "provider": "Project Gutenberg",
              "authorityId": "project-gutenberg",
              "authorityTier": "B",
              "recordKind": "publisher-catalog",
              "recordId": "1164",
              "catalogTitleExact": "The iron heel",
              "locale": "en",
              "market": "US",
              "expressionLanguage": "English",
              "retrievedAt": "2026-09-05",
              "checkedAt": "2026-09-05",
              "checkedBy": "Codex AI /root (independent bibliographic review)",
              "publisher": "Project Gutenberg",
              "publicationYear": 2006,
              "editionStatement": "US digital edition; official catalog Release Date 2006-05-03; Language English; Copyright Public domain in the USA. This digital manifestation is separate from any reproduced print edition. No claim that its print source is this LoC manifestation, nor that it is a US print edition. Generated catalog summaries are not factual synopsis evidence."
            }
          ]
        }
      }
    },
    "sources": [
      {
        "provider": "Эксмо",
        "authorityId": "eksmo",
        "authorityTier": "B",
        "country": "russia",
        "language": "Russian",
        "recordKind": "publisher-catalog",
        "recordId": "ITD1421733",
        "url": "https://eksmo.ru/book/zheleznaya-pyata-ITD1421733/",
        "fields": [
          "identity",
          "authorship",
          "description",
          "title",
          "language",
          "market"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05",
        "market": "RU"
      },
      {
        "provider": "project-gutenberg",
        "authorityId": "project-gutenberg",
        "authorityTier": "B",
        "country": "usa",
        "language": "en",
        "recordKind": "authoritative-work-page",
        "recordId": "gutenberg-1164",
        "url": "https://www.gutenberg.org/files/1164/1164-h/1164-h.htm",
        "fields": [
          "identity",
          "authorship"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "Российская государственная библиотека",
        "authorityId": "rsl",
        "authorityTier": "A",
        "recordId": "01009213700",
        "recordKind": "national-bibliography",
        "url": "https://search.rsl.ru/ru/record/01009213700",
        "language": "Russian",
        "market": "RU",
        "fields": [
          "identity",
          "authorship",
          "title",
          "language",
          "market",
          "original-title",
          "genre"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "Library of Congress",
        "authorityId": "loc",
        "authorityTier": "A",
        "recordId": "LCCN-08006034",
        "recordKind": "national-bibliography",
        "url": "https://lccn.loc.gov/08006034/marcxml",
        "language": "English",
        "market": "US",
        "fields": [
          "identity",
          "authorship",
          "title",
          "language",
          "market",
          "original-title",
          "publication-year"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "Project Gutenberg",
        "authorityId": "project-gutenberg",
        "authorityTier": "B",
        "recordId": "1164",
        "recordKind": "publisher-catalog",
        "url": "https://www.gutenberg.org/ebooks/1164",
        "language": "English",
        "market": "US",
        "fields": [
          "identity",
          "authorship",
          "title",
          "language",
          "market"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "penguin-random-house",
        "authorityId": "penguin-random-house",
        "authorityTier": "B",
        "country": "usa",
        "market": "US",
        "language": "English",
        "recordKind": "publisher-catalog",
        "recordId": "PRH-296408",
        "url": "https://www.penguinrandomhouse.com/books/296408/the-iron-heel-by-jack-london-edited-with-an-introduction-by-jonathan-auerbach-notes-by-jordan-schugar/",
        "fields": [
          "identity",
          "authorship",
          "description"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-12"
      }
    ],
    "editorial": {
      "status": "reviewed",
      "reviewedAt": "2026-09-05"
    }
  },
  "usa:jack_london:article-catalog-2s2iy7": {
    "firstPublished": 1913,
    "originalTitle": "The Valley of the Moon",
    "originalLanguage": "English",
    "description": "Молодые супруги Билл и Саксон Робертс, столкнувшись с нуждой и чередой личных потрясений, отправляются искать место для новой жизни. Странствуя вдвоём, они пытаются найти землю, где смогут построить собственный дом и сохранить общее будущее, которое оказалось под угрозой.",
    "localizedTitles": {
      "ru": {
        "entityKind": "expression",
        "expressionId": "usa:jack_london:article-catalog-2s2iy7:ru",
        "locale": "ru",
        "value": "Лунная долина",
        "status": "verified-published",
        "expressionLanguage": "Russian",
        "market": "RU",
        "selectionRule": "current-complete-authorized-edition",
        "selectionNote": "Russian title independently checked against the national bibliography and a distinct Russian publisher. Historical translation metadata is not equated with the current publisher manifestation.",
        "evidence": [
          {
            "entityKind": "manifestation",
            "manifestationId": "rsl-01009115650",
            "sourceUrl": "https://search.rsl.ru/ru/record/01009115650",
            "provider": "Российская государственная библиотека",
            "authorityId": "rsl",
            "authorityTier": "A",
            "recordKind": "national-bibliography",
            "recordId": "01009115650",
            "catalogTitleExact": "Лунная долина",
            "locale": "ru",
            "market": "RU",
            "expressionLanguage": "Russian",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (independent bibliographic review)",
            "publisher": "Книжный угол",
            "publicationYear": 1924,
            "translator": "З. А. Рогозиной [!] [Рагозиной] (responsibility statement as catalogued)",
            "editionStatement": "Ленинград; Москва; 319 с.; 17 см. MARC 245$a: Лунная долина; 041$a rus, $h eng; 044$a ru; 534$t The valley of the moon. Catalogued translator spelling and correction are retained; completeness of this historical translation is not independently certified."
          },
          {
            "entityKind": "manifestation",
            "manifestationId": "azbooka-ISBN-9785389221826",
            "sourceUrl": "https://azbooka.ru/books/lynnaya-dolina",
            "provider": "Азбука",
            "authorityId": "azbooka",
            "authorityTier": "B",
            "recordKind": "publisher-catalog",
            "recordId": "ISBN-9785389221826",
            "catalogTitleExact": "Лунная долина",
            "locale": "ru",
            "market": "RU",
            "expressionLanguage": "Russian",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (independent bibliographic review)",
            "publisher": "Азбука",
            "isbn13": "9785389221826",
            "publicationYear": 2022,
            "translator": "Лидия Бродская; Вера Станевич",
            "editionStatement": "576 с.; exact official publisher bibliographic block read in the existing source dossier."
          }
        ]
      },
      "en": {
        "entityKind": "expression",
        "expressionId": "usa:jack_london:article-catalog-2s2iy7:en",
        "locale": "en",
        "value": "The Valley of the Moon",
        "status": "verified-published",
        "expressionLanguage": "English",
        "market": "US",
        "selectionRule": "original-market-title",
        "selectionNote": "English title checked against the original US print manifestation and a distinct Gutenberg US digital edition. Catalog title capitalization is normalized for display; terminal ISBD separators are not title content.",
        "evidence": [
          {
            "entityKind": "manifestation",
            "manifestationId": "loc-lccn-13022812",
            "sourceUrl": "https://lccn.loc.gov/13022812/marcxml",
            "provider": "Library of Congress",
            "authorityId": "loc",
            "authorityTier": "A",
            "recordKind": "national-bibliography",
            "recordId": "LCCN-13022812",
            "catalogTitleExact": "The valley of the moon",
            "locale": "en",
            "market": "US",
            "expressionLanguage": "English",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (independent bibliographic review)",
            "publisher": "The Macmillan company",
            "publicationYear": 1913,
            "editionStatement": "New York, 1913. MARC 300: 4 p. l., 3-530 p.; color frontispiece; 20 cm. The existence of this 1913 edition contradicts a blanket assertion that the book first appeared in 1914, but this report does not settle all serial/book chronology. MARC terminal ISBD punctuation is excluded from the work-title value, retained verbatim in the source check."
          },
          {
            "entityKind": "manifestation",
            "manifestationId": "project-gutenberg-1449",
            "sourceUrl": "https://www.gutenberg.org/ebooks/1449",
            "provider": "Project Gutenberg",
            "authorityId": "project-gutenberg",
            "authorityTier": "B",
            "recordKind": "publisher-catalog",
            "recordId": "1449",
            "catalogTitleExact": "The Valley of the Moon",
            "locale": "en",
            "market": "US",
            "expressionLanguage": "English",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (independent bibliographic review)",
            "publisher": "Project Gutenberg",
            "publicationYear": 1998,
            "editionStatement": "US digital edition; official catalog Release Date 1998-09-01; Language English; Copyright Public domain in the USA. This digital manifestation is separate from any reproduced print edition. No claim that its print source is this LoC manifestation, nor that it is a US print edition. Generated catalog summaries are not factual synopsis evidence."
          }
        ]
      }
    },
    "translations": {
      "ru": {
        "locale": "ru",
        "title": "Лунная долина",
        "description": "Молодые супруги Билл и Саксон Робертс, столкнувшись с нуждой и чередой личных потрясений, отправляются искать место для новой жизни. Странствуя вдвоём, они пытаются найти землю, где смогут построить собственный дом и сохранить общее будущее, которое оказалось под угрозой.",
        "sourceLanguage": "ru",
        "status": "reviewed",
        "sourceUrls": [
          "https://azbooka.ru/books/lynnaya-dolina",
          "https://www.gutenberg.org/files/1449/1449-h/1449-h.htm",
          "https://search.rsl.ru/ru/record/01009115650",
          "https://www.simonandschuster.com/books/The-Valley-of-the-Moon/Jack-London/9781633551619"
        ],
        "method": "editorial-original",
        "reviewedAt": "2026-09-05",
        "descriptionProvenance": {
          "origin": "official-source-synthesis",
          "sourceLanguage": "ru",
          "sourceCountry": "usa",
          "sourceUrls": [
            "https://azbooka.ru/books/lynnaya-dolina",
            "https://www.simonandschuster.com/books/The-Valley-of-the-Moon/Jack-London/9781633551619"
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
          "author": "Codex AI / london_bilingual_batch",
          "createdAt": "2026-09-05",
          "reviewedBy": "Codex AI / review_ru_public_gaps",
          "reviewedAt": "2026-09-05",
          "primarySourceUrls": [
            "https://azbooka.ru/books/lynnaya-dolina"
          ]
        },
        "titleEvidence": {
          "entityKind": "expression",
          "expressionId": "usa:jack_london:article-catalog-2s2iy7:ru",
          "locale": "ru",
          "value": "Лунная долина",
          "status": "verified-published",
          "expressionLanguage": "Russian",
          "market": "RU",
          "selectionRule": "current-complete-authorized-edition",
          "selectionNote": "Russian title independently checked against the national bibliography and a distinct Russian publisher. Historical translation metadata is not equated with the current publisher manifestation.",
          "evidence": [
            {
              "entityKind": "manifestation",
              "manifestationId": "rsl-01009115650",
              "sourceUrl": "https://search.rsl.ru/ru/record/01009115650",
              "provider": "Российская государственная библиотека",
              "authorityId": "rsl",
              "authorityTier": "A",
              "recordKind": "national-bibliography",
              "recordId": "01009115650",
              "catalogTitleExact": "Лунная долина",
              "locale": "ru",
              "market": "RU",
              "expressionLanguage": "Russian",
              "retrievedAt": "2026-09-05",
              "checkedAt": "2026-09-05",
              "checkedBy": "Codex AI /root (independent bibliographic review)",
              "publisher": "Книжный угол",
              "publicationYear": 1924,
              "translator": "З. А. Рогозиной [!] [Рагозиной] (responsibility statement as catalogued)",
              "editionStatement": "Ленинград; Москва; 319 с.; 17 см. MARC 245$a: Лунная долина; 041$a rus, $h eng; 044$a ru; 534$t The valley of the moon. Catalogued translator spelling and correction are retained; completeness of this historical translation is not independently certified."
            },
            {
              "entityKind": "manifestation",
              "manifestationId": "azbooka-ISBN-9785389221826",
              "sourceUrl": "https://azbooka.ru/books/lynnaya-dolina",
              "provider": "Азбука",
              "authorityId": "azbooka",
              "authorityTier": "B",
              "recordKind": "publisher-catalog",
              "recordId": "ISBN-9785389221826",
              "catalogTitleExact": "Лунная долина",
              "locale": "ru",
              "market": "RU",
              "expressionLanguage": "Russian",
              "retrievedAt": "2026-09-05",
              "checkedAt": "2026-09-05",
              "checkedBy": "Codex AI /root (independent bibliographic review)",
              "publisher": "Азбука",
              "isbn13": "9785389221826",
              "publicationYear": 2022,
              "translator": "Лидия Бродская; Вера Станевич",
              "editionStatement": "576 с.; exact official publisher bibliographic block read in the existing source dossier."
            }
          ]
        }
      },
      "en": {
        "locale": "en",
        "title": "The Valley of the Moon",
        "description": "Poverty and labor conflict threaten the life Billy and Saxon Roberts have begun together. They leave Oakland in search of a place where they can establish a home away from the city. Their journey becomes an attempt to recover a shared future beyond the pressures that have put their marriage at risk.",
        "sourceLanguage": "en",
        "status": "reviewed",
        "sourceUrls": [
          "https://www.gutenberg.org/files/1449/1449-h/1449-h.htm",
          "https://azbooka.ru/books/lynnaya-dolina",
          "https://lccn.loc.gov/13022812/marcxml",
          "https://www.gutenberg.org/ebooks/1449",
          "https://www.simonandschuster.com/books/The-Valley-of-the-Moon/Jack-London/9781633551619"
        ],
        "method": "editorial-original",
        "reviewedAt": "2026-09-05",
        "descriptionProvenance": {
          "origin": "official-source-synthesis",
          "sourceLanguage": "en",
          "sourceCountry": "usa",
          "sourceUrls": [
            "https://azbooka.ru/books/lynnaya-dolina",
            "https://www.simonandschuster.com/books/The-Valley-of-the-Moon/Jack-London/9781633551619"
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
          "author": "Codex AI / london_bilingual_batch",
          "createdAt": "2026-09-05",
          "reviewedBy": "Codex AI / review_ru_public_gaps",
          "reviewedAt": "2026-09-05",
          "primarySourceUrls": [
            "https://www.simonandschuster.com/books/The-Valley-of-the-Moon/Jack-London/9781633551619"
          ]
        },
        "titleEvidence": {
          "entityKind": "expression",
          "expressionId": "usa:jack_london:article-catalog-2s2iy7:en",
          "locale": "en",
          "value": "The Valley of the Moon",
          "status": "verified-published",
          "expressionLanguage": "English",
          "market": "US",
          "selectionRule": "original-market-title",
          "selectionNote": "English title checked against the original US print manifestation and a distinct Gutenberg US digital edition. Catalog title capitalization is normalized for display; terminal ISBD separators are not title content.",
          "evidence": [
            {
              "entityKind": "manifestation",
              "manifestationId": "loc-lccn-13022812",
              "sourceUrl": "https://lccn.loc.gov/13022812/marcxml",
              "provider": "Library of Congress",
              "authorityId": "loc",
              "authorityTier": "A",
              "recordKind": "national-bibliography",
              "recordId": "LCCN-13022812",
              "catalogTitleExact": "The valley of the moon",
              "locale": "en",
              "market": "US",
              "expressionLanguage": "English",
              "retrievedAt": "2026-09-05",
              "checkedAt": "2026-09-05",
              "checkedBy": "Codex AI /root (independent bibliographic review)",
              "publisher": "The Macmillan company",
              "publicationYear": 1913,
              "editionStatement": "New York, 1913. MARC 300: 4 p. l., 3-530 p.; color frontispiece; 20 cm. The existence of this 1913 edition contradicts a blanket assertion that the book first appeared in 1914, but this report does not settle all serial/book chronology. MARC terminal ISBD punctuation is excluded from the work-title value, retained verbatim in the source check."
            },
            {
              "entityKind": "manifestation",
              "manifestationId": "project-gutenberg-1449",
              "sourceUrl": "https://www.gutenberg.org/ebooks/1449",
              "provider": "Project Gutenberg",
              "authorityId": "project-gutenberg",
              "authorityTier": "B",
              "recordKind": "publisher-catalog",
              "recordId": "1449",
              "catalogTitleExact": "The Valley of the Moon",
              "locale": "en",
              "market": "US",
              "expressionLanguage": "English",
              "retrievedAt": "2026-09-05",
              "checkedAt": "2026-09-05",
              "checkedBy": "Codex AI /root (independent bibliographic review)",
              "publisher": "Project Gutenberg",
              "publicationYear": 1998,
              "editionStatement": "US digital edition; official catalog Release Date 1998-09-01; Language English; Copyright Public domain in the USA. This digital manifestation is separate from any reproduced print edition. No claim that its print source is this LoC manifestation, nor that it is a US print edition. Generated catalog summaries are not factual synopsis evidence."
            }
          ]
        }
      }
    },
    "sources": [
      {
        "provider": "Азбука",
        "authorityId": "azbooka",
        "authorityTier": "B",
        "country": "russia",
        "language": "Russian",
        "recordKind": "publisher-catalog",
        "recordId": "ISBN-9785389221826",
        "url": "https://azbooka.ru/books/lynnaya-dolina",
        "fields": [
          "identity",
          "authorship",
          "description",
          "title",
          "language",
          "market"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05",
        "market": "RU"
      },
      {
        "provider": "project-gutenberg",
        "authorityId": "project-gutenberg",
        "authorityTier": "B",
        "country": "usa",
        "language": "en",
        "recordKind": "authoritative-work-page",
        "recordId": "gutenberg-1449",
        "url": "https://www.gutenberg.org/files/1449/1449-h/1449-h.htm",
        "fields": [
          "identity",
          "authorship"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "Российская государственная библиотека",
        "authorityId": "rsl",
        "authorityTier": "A",
        "recordId": "01009115650",
        "recordKind": "national-bibliography",
        "url": "https://search.rsl.ru/ru/record/01009115650",
        "language": "Russian",
        "market": "RU",
        "fields": [
          "identity",
          "authorship",
          "title",
          "language",
          "market",
          "original-title",
          "genre"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "Library of Congress",
        "authorityId": "loc",
        "authorityTier": "A",
        "recordId": "LCCN-13022812",
        "recordKind": "national-bibliography",
        "url": "https://lccn.loc.gov/13022812/marcxml",
        "language": "English",
        "market": "US",
        "fields": [
          "identity",
          "authorship",
          "title",
          "language",
          "market",
          "original-title",
          "publication-year"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "Project Gutenberg",
        "authorityId": "project-gutenberg",
        "authorityTier": "B",
        "recordId": "1449",
        "recordKind": "publisher-catalog",
        "url": "https://www.gutenberg.org/ebooks/1449",
        "language": "English",
        "market": "US",
        "fields": [
          "identity",
          "authorship",
          "title",
          "language",
          "market"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "simon-and-schuster-us",
        "authorityId": "simon-schuster-us",
        "authorityTier": "B",
        "country": "usa",
        "market": "US",
        "language": "English",
        "recordKind": "publisher-catalog",
        "recordId": "ISBN-9781633551619",
        "url": "https://www.simonandschuster.com/books/The-Valley-of-the-Moon/Jack-London/9781633551619",
        "fields": [
          "identity",
          "authorship",
          "description"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-12"
      }
    ],
    "editorial": {
      "status": "reviewed",
      "reviewedAt": "2026-09-05"
    }
  }
};

export const bookR49nExistingReviewed20260912RecordKeys = Object.keys(reviewedProfiles);

function replaceReviewedSources(current: WorkSourceProfile[], reviewed: WorkSourceProfile[]) {
  const byUrl = new Map<string, WorkSourceProfile>();
  for (const source of [...current, ...reviewed]) {
    const key = source.url.trim();
    // A removed description role must not return through a field union.
    byUrl.set(key, { ...byUrl.get(key), ...source, fields: [...source.fields] });
  }
  return [...byUrl.values()];
}

export function applyBookR49nExistingReviewed20260912Work(
  countryId: string, writerId: string, work: WorkProfile
): WorkProfile {
  const reviewed = reviewedProfiles[`${countryId}:${writerId}:${work.id}`];
  if (!reviewed) return work;
  const translations = { ...work.translations };
  for (const locale of ["ru", "en"] as const) {
    const translation = reviewed.translations[locale];
    if (!translation) continue;
    translations[locale] = {
      ...work.translations?.[locale], ...translation,
      sourceUrls: [...new Set([...(work.translations?.[locale]?.sourceUrls || []), ...translation.sourceUrls])],
      titleEvidence: reviewed.localizedTitles?.[locale],
    };
  }
  return {
    ...work, ...reviewed, translations,
    localizedTitles: { ...work.localizedTitles, ...reviewed.localizedTitles },
    sources: replaceReviewedSources(work.sources || [], reviewed.sources || []),
  };
}
