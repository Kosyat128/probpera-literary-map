import type { WorkProfile, WorkSourceProfile } from "./types";

// Reviewed individually against primary publisher annotations. Input hashes,
// historical title evidence and the AI review scope are recorded in
// reports/book-r49n-dickens-reviewed-20260912.json. This is not human approval.
type ReviewedProfile = Pick<WorkProfile,
  "firstPublished" | "originalTitle" | "originalLanguage" | "description" |
  "localizedTitles" | "translations" | "sources" | "editorial"
>;

const reviewedProfiles: Record<string, ReviewedProfile> = {
  "england:charles_dickens:great-expectations": {
    "firstPublished": 1860,
    "originalTitle": "Great Expectations",
    "originalLanguage": "English",
    "description": "Таинственный покровитель открывает юному Пипу, выросшему в семье кузнеца, путь в высшее общество. Мечтая стать джентльменом и добиться любви Эстеллы, он пытается понять, кому обязан своим новым положением и чего стоят его большие надежды.",
    "localizedTitles": {
      "ru": {
        "entityKind": "expression",
        "expressionId": "england:charles_dickens:great-expectations:ru",
        "locale": "ru",
        "value": "Большие надежды",
        "status": "verified-published",
        "expressionLanguage": "Russian",
        "market": "RU",
        "selectionRule": "current-complete-authorized-edition",
        "selectionNote": "National catalog and independent same-market publisher establish the published title. Edition years do not replace original publication chronology; adaptation/abridgement records encountered in research were excluded.",
        "evidence": [
          {
            "entityKind": "manifestation",
            "manifestationId": "rsl-01007942153",
            "sourceUrl": "https://search.rsl.ru/ru/record/01007942153",
            "provider": "russian-state-library",
            "authorityId": "rsl",
            "authorityTier": "A",
            "recordKind": "national-bibliography",
            "recordId": "01007942153",
            "catalogTitleExact": "Большие надежды",
            "locale": "ru",
            "market": "RU",
            "expressionLanguage": "Russian",
            "publisher": "АСТ",
            "publicationYear": 2015,
            "editionStatement": "Full indexed primary MARC read: 245$a Большие надежды, 245$b [роман]; 041$a rus/$h eng; 260 Moscow AST cop.2015; 543 pages. Date is that manifestation, not the first novel publication.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)",
            "isbn13": "9785170695010",
            "translator": "М. Лорие"
          },
          {
            "entityKind": "manifestation",
            "manifestationId": "ast-ISBN-9785170963348",
            "sourceUrl": "https://ast.ru/book/bolshie-nadezhdy-722160/",
            "provider": "ast-publishing",
            "authorityId": "ast",
            "authorityTier": "B",
            "recordKind": "publisher-catalog",
            "recordId": "ISBN-9785170963348",
            "catalogTitleExact": "Большие надежды",
            "locale": "ru",
            "market": "RU",
            "expressionLanguage": "Russian",
            "publisher": "АСТ",
            "editionStatement": "Official publisher title and translator; 608 pages. This is an independent title corroboration, not substituted for the earlier Eksmo primary synopsis source.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)",
            "isbn13": "9785170963348",
            "translator": "Мария Федоровна Лорие"
          }
        ]
      },
      "en": {
        "entityKind": "expression",
        "expressionId": "england:charles_dickens:great-expectations:en",
        "locale": "en",
        "value": "Great Expectations",
        "status": "verified-published",
        "expressionLanguage": "English",
        "market": "US",
        "selectionRule": "current-complete-authorized-edition",
        "selectionNote": "National catalog and independent same-market publisher establish the published title. Edition years do not replace original publication chronology; adaptation/abridgement records encountered in research were excluded.",
        "evidence": [
          {
            "entityKind": "manifestation",
            "manifestationId": "loc-LCCN-72177918",
            "sourceUrl": "https://lccn.loc.gov/72177918/marcxml",
            "provider": "library-of-congress",
            "authorityId": "loc",
            "authorityTier": "A",
            "recordKind": "national-bibliography",
            "recordId": "LCCN-72177918",
            "catalogTitleExact": "Great expectations",
            "locale": "en",
            "market": "US",
            "expressionLanguage": "English",
            "publisher": "Holt, Rinehart, Winston",
            "publicationYear": 1972,
            "editionStatement": "Full primary MARCXML read: 245$a Great expectations. (terminal ISBD period omitted from the work-title value); 250 2d ed.; 260 New York [1972]; xvi,470 pages; 008 English. Introduction by Earle Davis; no abridgement or adaptation identified in this record.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)",
            "isbn13": "9780030779008"
          },
          {
            "entityKind": "manifestation",
            "manifestationId": "penguin-random-house-ISBN-9780451531186",
            "sourceUrl": "https://www.penguinrandomhouse.com/books/326623/great-expectations-by-charles-dickens/",
            "provider": "penguin-random-house",
            "authorityId": "penguin-random-house",
            "authorityTier": "B",
            "recordKind": "publisher-catalog",
            "recordId": "ISBN-9780451531186",
            "catalogTitleExact": "Great Expectations",
            "locale": "en",
            "market": "US",
            "expressionLanguage": "English",
            "publisher": "Signet",
            "publicationYear": 2009,
            "editionStatement": "Publisher product details: 2009-02-03, Signet, 528 pages.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)",
            "isbn13": "9780451531186"
          }
        ]
      }
    },
    "translations": {
      "ru": {
        "locale": "ru",
        "title": "Большие надежды",
        "description": "Таинственный покровитель открывает юному Пипу, выросшему в семье кузнеца, путь в высшее общество. Мечтая стать джентльменом и добиться любви Эстеллы, он пытается понять, кому обязан своим новым положением и чего стоят его большие надежды.",
        "sourceLanguage": "ru",
        "status": "reviewed",
        "sourceUrls": [
          "https://eksmo.ru/amp/book/bolshie-nadezhdy-ITD1176840/",
          "https://www.penguinrandomhouse.com/books/326623/great-expectations-by-charles-dickens/",
          "https://www.penguin.co.uk/books/395982/great-expectations-by-dickens-charles/9780099511571",
          "https://search.rsl.ru/ru/record/01007942153",
          "https://ast.ru/book/bolshie-nadezhdy-722160/",
          "https://eksmo.ru/book/bolshie-nadezhdy-ITD1329579/"
        ],
        "method": "editorial-original",
        "reviewedAt": "2026-09-12",
        "descriptionProvenance": {
          "origin": "official-source-synthesis",
          "sourceLanguage": "ru",
          "sourceCountry": "england",
          "sourceUrls": [
            "https://eksmo.ru/amp/book/bolshie-nadezhdy-ITD1176840/",
            "https://www.penguinrandomhouse.com/books/326623/great-expectations-by-charles-dickens/",
            "https://www.penguin.co.uk/books/395982/great-expectations-by-dickens-charles/9780099511571",
            "https://eksmo.ru/book/bolshie-nadezhdy-ITD1329579/"
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
          "reviewedBy": "Codex AI /root/article_counts (independent editorial review)",
          "reviewedAt": "2026-09-12"
        }
      },
      "en": {
        "locale": "en",
        "title": "Great Expectations",
        "description": "An unknown benefactor gives the orphan Pip the means to become a gentleman, bringing the life he has dreamed of since meeting Estella within reach. In London, his pursuit of status and her love draws him away from the people and values he once cherished, until the truth about his patron unsettles his ambitions.",
        "sourceLanguage": "en",
        "status": "reviewed",
        "sourceUrls": [
          "https://www.penguinrandomhouse.com/books/326623/great-expectations-by-charles-dickens/",
          "https://eksmo.ru/amp/book/bolshie-nadezhdy-ITD1176840/",
          "https://www.penguin.co.uk/books/395982/great-expectations-by-dickens-charles/9780099511571",
          "https://lccn.loc.gov/72177918/marcxml"
        ],
        "method": "editorial-original",
        "reviewedAt": "2026-09-12",
        "descriptionProvenance": {
          "origin": "official-source-synthesis",
          "sourceLanguage": "en",
          "sourceCountry": "england",
          "sourceUrls": [
            "https://eksmo.ru/amp/book/bolshie-nadezhdy-ITD1176840/",
            "https://www.penguinrandomhouse.com/books/326623/great-expectations-by-charles-dickens/",
            "https://www.penguin.co.uk/books/395982/great-expectations-by-dickens-charles/9780099511571"
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
          "reviewedBy": "Codex AI /root/article_counts (independent editorial review)",
          "reviewedAt": "2026-09-12"
        }
      }
    },
    "sources": [
      {
        "provider": "eksmo-publishing",
        "authorityId": "eksmo",
        "authorityTier": "B",
        "country": "russia",
        "language": "ru",
        "recordKind": "publisher-catalog",
        "recordId": "ISBN-9785041229917",
        "url": "https://eksmo.ru/amp/book/bolshie-nadezhdy-ITD1176840/",
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
        "language": "English",
        "recordKind": "publisher-catalog",
        "recordId": "ISBN-9780451531186",
        "url": "https://www.penguinrandomhouse.com/books/326623/great-expectations-by-charles-dickens/",
        "fields": [
          "identity",
          "authorship",
          "description",
          "title",
          "language",
          "market",
          "publication-year"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05",
        "market": "US"
      },
      {
        "provider": "penguin-books-uk",
        "authorityId": "penguin-uk",
        "authorityTier": "B",
        "country": "england",
        "language": "en",
        "market": "GB",
        "recordKind": "publisher-catalog",
        "recordId": "ISBN-9780099511571",
        "url": "https://www.penguin.co.uk/books/395982/great-expectations-by-dickens-charles/9780099511571",
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
        "recordId": "01007942153",
        "recordKind": "national-bibliography",
        "url": "https://search.rsl.ru/ru/record/01007942153",
        "language": "Russian",
        "market": "RU",
        "fields": [
          "identity",
          "authorship",
          "title",
          "language",
          "market",
          "original-title"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "ast-publishing",
        "authorityId": "ast",
        "authorityTier": "B",
        "recordId": "ISBN-9785170963348",
        "recordKind": "publisher-catalog",
        "url": "https://ast.ru/book/bolshie-nadezhdy-722160/",
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
        "recordId": "LCCN-72177918",
        "recordKind": "national-bibliography",
        "url": "https://lccn.loc.gov/72177918/marcxml",
        "language": "English",
        "market": "US",
        "fields": [
          "identity",
          "authorship",
          "title",
          "language",
          "market",
          "original-title"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "eksmo-publishing",
        "authorityId": "eksmo",
        "authorityTier": "B",
        "country": "russia",
        "market": "RU",
        "language": "ru",
        "recordKind": "publisher-catalog",
        "url": "https://eksmo.ru/book/bolshie-nadezhdy-ITD1329579/",
        "fields": [
          "identity",
          "authorship",
          "description"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-12"
      },
      {
        "provider": "penguin-random-house",
        "authorityId": "penguin-random-house",
        "country": "usa",
        "language": "en",
        "recordKind": "authoritative-work-page",
        "url": "https://www.penguinrandomhouse.com/books/326623/great-expectations-by-charles-dickens/9780451531186/readers-guide/",
        "fields": [
          "publication-year"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-12"
      }
    ],
    "editorial": {
      "status": "reviewed",
      "reviewedAt": "2026-09-12"
    }
  },
  "england:charles_dickens:oliver-twist-editorial": {
    "firstPublished": 1837,
    "originalTitle": "Oliver Twist",
    "originalLanguage": "English",
    "description": "Маленький сирота Оливер Твист вырастает в приюте, а затем попадает в шайку, где его пытаются научить воровству. Его злоключения раскрывают мир трущоб, в котором детская беззащитность сталкивается с нищетой и преступностью.",
    "localizedTitles": {
      "ru": {
        "entityKind": "expression",
        "expressionId": "england:charles_dickens:oliver-twist-editorial:ru",
        "locale": "ru",
        "value": "Приключения Оливера Твиста",
        "status": "verified-published",
        "expressionLanguage": "Russian",
        "market": "RU",
        "selectionRule": "current-complete-authorized-edition",
        "selectionNote": "National catalog and independent same-market publisher establish the published title. Edition years do not replace original publication chronology; adaptation/abridgement records encountered in research were excluded.",
        "evidence": [
          {
            "entityKind": "manifestation",
            "manifestationId": "rsl-01001632194",
            "sourceUrl": "https://search.rsl.ru/ru/record/01001632194",
            "provider": "russian-state-library",
            "authorityId": "rsl",
            "authorityTier": "A",
            "recordKind": "national-bibliography",
            "recordId": "01001632194",
            "catalogTitleExact": "Приключения Оливера Твиста",
            "locale": "ru",
            "market": "RU",
            "expressionLanguage": "Russian",
            "publisher": "Сов. Россия",
            "publicationYear": 1992,
            "editionStatement": "National record bibliographic description: Moscow, 427,[1] pages; Russian language; translation from English by A. V. Krivtsova, notes E. Lann, illustrations D. Cruikshank. Indexed primary catalog description and MARC 260/300/700 read; direct opening failed. No claim that an unseen MARC 245 or complete book text was read.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)",
            "translator": "А. В. Кривцова"
          },
          {
            "entityKind": "manifestation",
            "manifestationId": "azbooka-ISBN-9785389051508",
            "sourceUrl": "https://azbooka.ru/books/priklyucheniya-olivera-tvista-oomn",
            "provider": "azbooka-atticus",
            "authorityId": "azbooka",
            "authorityTier": "B",
            "recordKind": "publisher-catalog",
            "recordId": "ISBN-9785389051508",
            "catalogTitleExact": "Приключения Оливера Твиста",
            "locale": "ru",
            "market": "RU",
            "expressionLanguage": "Russian",
            "publisher": "Азбука",
            "editionStatement": "Publisher heading and ISBN; 512 pages. Parenthetical мягкая обложка describes format and is excluded from the work title.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)",
            "isbn13": "9785389051508"
          }
        ]
      },
      "en": {
        "entityKind": "expression",
        "expressionId": "england:charles_dickens:oliver-twist-editorial:en",
        "locale": "en",
        "value": "Oliver Twist",
        "status": "verified-published",
        "expressionLanguage": "English",
        "market": "US",
        "selectionRule": "authoritative-uniform-title",
        "selectionNote": "National catalog and independent same-market publisher establish the published title. Edition years do not replace original publication chronology; adaptation/abridgement records encountered in research were excluded.",
        "evidence": [
          {
            "entityKind": "manifestation",
            "manifestationId": "loc-LCCN-2004026593",
            "sourceUrl": "https://lccn.loc.gov/2004026593/marcxml",
            "provider": "library-of-congress",
            "authorityId": "loc",
            "authorityTier": "A",
            "recordKind": "national-bibliography",
            "recordId": "LCCN-2004026593",
            "catalogTitleExact": "Oliver Twist",
            "locale": "en",
            "market": "US",
            "expressionLanguage": "English",
            "publisher": "Signet Classics",
            "publicationYear": 2005,
            "editionStatement": "Actual complete MARCXML read: uniform title MARC 240$a Oliver Twist. MARC 245$a is Oliver Twist, or, the Parish boy's progress /; it is not represented as the short 245 title. MARC 008 language eng; New York 2005, xiii,496 pages. The selected short title is the explicit authoritative uniform title and the publisher title.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)",
            "isbn13": "9780451529718"
          },
          {
            "entityKind": "manifestation",
            "manifestationId": "penguin-random-house-ISBN-9780451529718",
            "sourceUrl": "https://www.penguinrandomhouse.com/books/295088/oliver-twist-by-charles-dickens/",
            "provider": "penguin-random-house",
            "authorityId": "penguin-random-house",
            "authorityTier": "B",
            "recordKind": "publisher-catalog",
            "recordId": "ISBN-9780451529718",
            "catalogTitleExact": "Oliver Twist",
            "locale": "en",
            "market": "US",
            "expressionLanguage": "English",
            "publisher": "Signet",
            "editionStatement": "Official publisher title and matching ISBN; edition year is established in the corresponding national record.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)",
            "isbn13": "9780451529718"
          }
        ]
      }
    },
    "translations": {
      "ru": {
        "locale": "ru",
        "title": "Приключения Оливера Твиста",
        "description": "Маленький сирота Оливер Твист вырастает в приюте, а затем попадает в шайку, где его пытаются научить воровству. Его злоключения раскрывают мир трущоб, в котором детская беззащитность сталкивается с нищетой и преступностью.",
        "sourceLanguage": "ru",
        "status": "reviewed",
        "sourceUrls": [
          "https://azbooka.ru/books/priklyucheniya-olivera-tvista-oomn",
          "https://www.penguinrandomhouse.com/books/295088/oliver-twist-by-charles-dickens/",
          "https://www.penguin.co.uk/books/55733/oliver-twist-by-dickens-charles/9780141192499",
          "https://search.rsl.ru/ru/record/01001632194"
        ],
        "method": "editorial-original",
        "reviewedAt": "2026-09-12",
        "descriptionProvenance": {
          "origin": "official-source-synthesis",
          "sourceLanguage": "ru",
          "sourceCountry": "england",
          "sourceUrls": [
            "https://azbooka.ru/books/priklyucheniya-olivera-tvista-oomn",
            "https://www.penguinrandomhouse.com/books/295088/oliver-twist-by-charles-dickens/",
            "https://www.penguin.co.uk/books/55733/oliver-twist-by-dickens-charles/9780141192499"
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
          "reviewedBy": "Codex AI /root/article_counts (independent editorial review)",
          "reviewedAt": "2026-09-12"
        }
      },
      "en": {
        "locale": "en",
        "title": "Oliver Twist",
        "description": "Raised in a workhouse, the orphan Oliver Twist runs away to London and encounters a criminal world that includes Fagin and the violent Bill Sikes. Dickens combines the suspense of a detective story with a protest against the conditions surrounding a vulnerable child.",
        "sourceLanguage": "en",
        "status": "reviewed",
        "sourceUrls": [
          "https://www.penguinrandomhouse.com/books/295088/oliver-twist-by-charles-dickens/",
          "https://azbooka.ru/books/priklyucheniya-olivera-tvista-oomn",
          "https://www.penguin.co.uk/books/55733/oliver-twist-by-dickens-charles/9780141192499",
          "https://lccn.loc.gov/2004026593/marcxml"
        ],
        "method": "editorial-original",
        "reviewedAt": "2026-09-12",
        "descriptionProvenance": {
          "origin": "official-source-synthesis",
          "sourceLanguage": "en",
          "sourceCountry": "england",
          "sourceUrls": [
            "https://azbooka.ru/books/priklyucheniya-olivera-tvista-oomn",
            "https://www.penguinrandomhouse.com/books/295088/oliver-twist-by-charles-dickens/",
            "https://www.penguin.co.uk/books/55733/oliver-twist-by-dickens-charles/9780141192499"
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
          "reviewedBy": "Codex AI /root/article_counts (independent editorial review)",
          "reviewedAt": "2026-09-12"
        }
      }
    },
    "sources": [
      {
        "provider": "azbooka-atticus",
        "authorityId": "azbooka",
        "authorityTier": "B",
        "country": "russia",
        "language": "Russian",
        "recordKind": "publisher-catalog",
        "recordId": "ISBN-9785389051508",
        "url": "https://azbooka.ru/books/priklyucheniya-olivera-tvista-oomn",
        "fields": [
          "identity",
          "authorship",
          "description",
          "title",
          "language",
          "market",
          "original-title",
          "genre"
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
        "recordId": "ISBN-9780451529718",
        "url": "https://www.penguinrandomhouse.com/books/295088/oliver-twist-by-charles-dickens/",
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
        "provider": "penguin-books-uk",
        "authorityId": "penguin-uk",
        "authorityTier": "B",
        "country": "england",
        "language": "en",
        "market": "GB",
        "recordKind": "publisher-catalog",
        "recordId": "ISBN-9780141192499",
        "url": "https://www.penguin.co.uk/books/55733/oliver-twist-by-dickens-charles/9780141192499",
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
        "recordId": "01001632194",
        "recordKind": "national-bibliography",
        "url": "https://search.rsl.ru/ru/record/01001632194",
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
        "recordId": "LCCN-2004026593",
        "recordKind": "national-bibliography",
        "url": "https://lccn.loc.gov/2004026593/marcxml",
        "language": "English",
        "market": "US",
        "fields": [
          "identity",
          "authorship",
          "title",
          "language",
          "market",
          "original-title"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "Charles Dickens Museum",
        "recordKind": "authoritative-work-page",
        "recordId": "AA2",
        "url": "https://www.collections.dickensmuseum.com/object-aa2",
        "language": "English",
        "market": "GB",
        "fields": [
          "identity",
          "authorship",
          "publication-year"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      }
    ],
    "editorial": {
      "status": "reviewed",
      "reviewedAt": "2026-09-12"
    }
  },
  "england:charles_dickens:david-copperfield-editorial": {
    "firstPublished": 1849,
    "originalTitle": "David Copperfield",
    "originalLanguage": "English",
    "description": "Дэвид Копперфилд с детства сталкивается с жестокостью учителей, корыстью фабрикантов и равнодушием окружающего мира. Противостоять этим испытаниям ему помогают доброта, внутренняя стойкость и талант писателя, открывающий возможность иной жизни.",
    "localizedTitles": {
      "ru": {
        "entityKind": "expression",
        "expressionId": "england:charles_dickens:david-copperfield-editorial:ru",
        "locale": "ru",
        "value": "Дэвид Копперфилд",
        "status": "verified-published",
        "expressionLanguage": "Russian",
        "market": "RU",
        "selectionRule": "current-complete-authorized-edition",
        "selectionNote": "Actual national catalog and independent publisher establish this published title spelling. Different print editions and first-publication chronology are recorded separately.",
        "evidence": [
          {
            "entityKind": "manifestation",
            "manifestationId": "rsl-01004736221",
            "sourceUrl": "https://search.rsl.ru/ru/record/01004736221",
            "provider": "russian-state-library",
            "authorityId": "rsl",
            "authorityTier": "A",
            "recordKind": "national-bibliography",
            "recordId": "01004736221",
            "catalogTitleExact": "Дэвид Копперфилд",
            "locale": "ru",
            "market": "RU",
            "expressionLanguage": "Russian",
            "publisher": "Эксмо",
            "publicationYear": 2010,
            "editionStatement": "Indexed original national bibliographic description: Russian novel translated from English by A.Krivtsova/E.Lann; Moscow2010;924,[2] pages. The title spelling without a soft sign is actually published; it is not silently equated to the Azbooka spelling.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)",
            "isbn13": "9785699435456",
            "translator": "А. Кривцова, Е. Ланн"
          },
          {
            "entityKind": "manifestation",
            "manifestationId": "eksmo-ISBN-9785040966011",
            "sourceUrl": "https://eksmo.ru/book/devid-kopperfild-ITD918457/",
            "provider": "eksmo-publishing",
            "authorityId": "eksmo",
            "authorityTier": "B",
            "recordKind": "publisher-catalog",
            "recordId": "ISBN-9785040966011",
            "catalogTitleExact": "Дэвид Копперфилд",
            "locale": "ru",
            "market": "RU",
            "expressionLanguage": "Russian",
            "publisher": "Эксмо",
            "publicationYear": 2018,
            "editionStatement": "Own publisher title, ISBN,896 pages,2018-08-01 actually read. The same Russian title spelling as the RSL record is selected; the existing Azbooka primary synopsis source remains unchanged.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)",
            "isbn13": "9785040966011"
          }
        ]
      },
      "en": {
        "entityKind": "expression",
        "expressionId": "england:charles_dickens:david-copperfield-editorial:en",
        "locale": "en",
        "value": "David Copperfield",
        "status": "verified-published",
        "expressionLanguage": "English",
        "market": "US",
        "selectionRule": "current-complete-authorized-edition",
        "selectionNote": "Actual national catalog and independent publisher establish this published title spelling. Different print editions and first-publication chronology are recorded separately.",
        "evidence": [
          {
            "entityKind": "manifestation",
            "manifestationId": "loc-LCCN-00064587",
            "sourceUrl": "https://lccn.loc.gov/00064587/marcxml",
            "provider": "library-of-congress",
            "authorityId": "loc",
            "authorityTier": "A",
            "recordKind": "national-bibliography",
            "recordId": "LCCN-00064587",
            "catalogTitleExact": "David Copperfield",
            "locale": "en",
            "market": "US",
            "expressionLanguage": "English",
            "publisher": "Modern Library",
            "publicationYear": 2000,
            "editionStatement": "Complete primary MARCXML read:245$a David Copperfield /;2502000 Modern Library pbk.ed.;260New York2000;300xxi,861 pages;008English. Introduction David Gates, notes Nitin Govil. Terminal ISBD slash omitted. This full novel replaces the rejected Jackson simplified children's edition79014169.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)",
            "isbn13": "9780679783411"
          },
          {
            "entityKind": "manifestation",
            "manifestationId": "penguin-random-house-ISBN-9780451530042",
            "sourceUrl": "https://www.penguinrandomhouse.com/books/297629/david-copperfield-by-charles-dickens/",
            "provider": "penguin-random-house",
            "authorityId": "penguin-random-house",
            "authorityTier": "B",
            "recordKind": "publisher-catalog",
            "recordId": "ISBN-9780451530042",
            "catalogTitleExact": "David Copperfield",
            "locale": "en",
            "market": "US",
            "expressionLanguage": "English",
            "publisher": "Signet",
            "publicationYear": 2006,
            "editionStatement": "Own publisher title/product details:2006-02-07,928 pages.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)",
            "isbn13": "9780451530042"
          }
        ]
      }
    },
    "translations": {
      "ru": {
        "locale": "ru",
        "title": "Дэвид Копперфилд",
        "description": "Дэвид Копперфилд с детства сталкивается с жестокостью учителей, корыстью фабрикантов и равнодушием окружающего мира. Противостоять этим испытаниям ему помогают доброта, внутренняя стойкость и талант писателя, открывающий возможность иной жизни.",
        "sourceLanguage": "ru",
        "status": "reviewed",
        "sourceUrls": [
          "https://azbooka.ru/books/devid-kopperfild-tftk",
          "https://www.penguinrandomhouse.com/books/297629/david-copperfield-by-charles-dickens/",
          "https://www.penguin.co.uk/books/256481/david-copperfield-by-dickens-charles/9780141394640",
          "https://search.rsl.ru/ru/record/01004736221",
          "https://eksmo.ru/book/devid-kopperfild-ITD918457/"
        ],
        "method": "editorial-original",
        "reviewedAt": "2026-09-12",
        "descriptionProvenance": {
          "origin": "official-source-synthesis",
          "sourceLanguage": "ru",
          "sourceCountry": "england",
          "sourceUrls": [
            "https://azbooka.ru/books/devid-kopperfild-tftk",
            "https://www.penguinrandomhouse.com/books/297629/david-copperfield-by-charles-dickens/",
            "https://www.penguin.co.uk/books/256481/david-copperfield-by-dickens-charles/9780141394640"
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
          "reviewedBy": "Codex AI /root/article_counts (independent editorial review)",
          "reviewedAt": "2026-09-12"
        }
      },
      "en": {
        "locale": "en",
        "title": "David Copperfield",
        "description": "David Copperfield grows up amid poverty and unhappiness, searching through successive adventures for a place in the world. The account of his childhood and youth follows the discovery of a vocation that will make him a successful writer.",
        "sourceLanguage": "en",
        "status": "reviewed",
        "sourceUrls": [
          "https://www.penguinrandomhouse.com/books/297629/david-copperfield-by-charles-dickens/",
          "https://azbooka.ru/books/devid-kopperfild-tftk",
          "https://www.penguin.co.uk/books/256481/david-copperfield-by-dickens-charles/9780141394640",
          "https://lccn.loc.gov/00064587/marcxml"
        ],
        "method": "editorial-original",
        "reviewedAt": "2026-09-12",
        "descriptionProvenance": {
          "origin": "official-source-synthesis",
          "sourceLanguage": "en",
          "sourceCountry": "england",
          "sourceUrls": [
            "https://azbooka.ru/books/devid-kopperfild-tftk",
            "https://www.penguinrandomhouse.com/books/297629/david-copperfield-by-charles-dickens/",
            "https://www.penguin.co.uk/books/256481/david-copperfield-by-dickens-charles/9780141394640"
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
          "reviewedBy": "Codex AI /root/article_counts (independent editorial review)",
          "reviewedAt": "2026-09-12"
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
        "recordId": "ISBN-9785389043527",
        "url": "https://azbooka.ru/books/devid-kopperfild-tftk",
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
        "language": "English",
        "recordKind": "publisher-catalog",
        "recordId": "ISBN-9780451530042",
        "url": "https://www.penguinrandomhouse.com/books/297629/david-copperfield-by-charles-dickens/",
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
        "provider": "penguin-books-uk",
        "authorityId": "penguin-uk",
        "authorityTier": "B",
        "country": "england",
        "language": "en",
        "market": "GB",
        "recordKind": "publisher-catalog",
        "recordId": "ISBN-9780141394640",
        "url": "https://www.penguin.co.uk/books/256481/david-copperfield-by-dickens-charles/9780141394640",
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
        "recordId": "01004736221",
        "recordKind": "national-bibliography",
        "url": "https://search.rsl.ru/ru/record/01004736221",
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
        "provider": "eksmo-publishing",
        "authorityId": "eksmo",
        "authorityTier": "B",
        "recordId": "ISBN-9785040966011",
        "recordKind": "publisher-catalog",
        "url": "https://eksmo.ru/book/devid-kopperfild-ITD918457/",
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
        "recordId": "LCCN-00064587",
        "recordKind": "national-bibliography",
        "url": "https://lccn.loc.gov/00064587/marcxml",
        "language": "English",
        "market": "US",
        "fields": [
          "identity",
          "authorship",
          "title",
          "language",
          "market",
          "original-title"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "ast-publishing",
        "authorityId": "ast",
        "authorityTier": "B",
        "country": "russia",
        "language": "Russian",
        "market": "RU",
        "recordKind": "publisher-catalog",
        "url": "https://ast.ru/book/devid-kopperfild-831611/",
        "fields": [
          "identity",
          "authorship",
          "publication-year",
          "genre"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "Charles Dickens Museum",
        "country": "england",
        "language": "en",
        "recordKind": "authoritative-work-page",
        "url": "https://www.collections.dickensmuseum.com/object--lib-6126",
        "fields": [
          "publication-year"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-12"
      }
    ],
    "editorial": {
      "status": "reviewed",
      "reviewedAt": "2026-09-12"
    }
  },
  "england:charles_dickens:article-series-1tdjfsi": {
    "firstPublished": 1864,
    "originalTitle": "Our Mutual Friend",
    "originalLanguage": "English",
    "description": "Наследника богатого лондонского подрядчика Джона Гармона объявляют погибшим, а Белла Уилфер, девушка из бедной семьи, мечтает о выгодном замужестве. Подмены личности, маскировка и разоблачения превращают их историю в запутанную интригу, за которой встают вопросы о подлинном лице человека и свободе его выбора.",
    "localizedTitles": {
      "ru": {
        "entityKind": "expression",
        "expressionId": "england:charles_dickens:article-series-1tdjfsi:ru",
        "locale": "ru",
        "value": "Наш общий друг",
        "status": "verified-published",
        "expressionLanguage": "Russian",
        "market": "RU",
        "selectionRule": "current-complete-authorized-edition",
        "selectionNote": "Individually catalogued novel and independent same-market publisher identify the published title. Manifestation dates and serial chronology remain separate.",
        "evidence": [
          {
            "entityKind": "manifestation",
            "manifestationId": "rsl-01008299295",
            "sourceUrl": "https://search.rsl.ru/ru/record/01008299295",
            "provider": "russian-state-library",
            "authorityId": "rsl",
            "authorityTier": "A",
            "recordKind": "national-bibliography",
            "recordId": "01008299295",
            "catalogTitleExact": "Наш общий друг",
            "locale": "ru",
            "market": "RU",
            "expressionLanguage": "Russian",
            "publisher": "П. П. Сойкин",
            "editionStatement": "Actual indexed MARC:245$a Наш общий друг;245$n Т.10;245$c Пер.Н.Ауэрбах;041$a rus/$h eng;300814,II pages;773 identifies Dickens collected works, Saint Petersburg,P.P.Soykin,[19--]. This individually catalogued volume contains the novel, not the entire collected works. No precise publication year inferred from [19--]; no invented contents field.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)",
            "translator": "Н. Ауэрбах"
          },
          {
            "entityKind": "manifestation",
            "manifestationId": "azbooka-ISBN-9785389191457",
            "sourceUrl": "https://azbooka.ru/books/nash-obshchiy-drug",
            "provider": "azbooka-atticus",
            "authorityId": "azbooka",
            "authorityTier": "B",
            "recordKind": "publisher-catalog",
            "recordId": "ISBN-9785389191457",
            "catalogTitleExact": "Наш общий друг",
            "locale": "ru",
            "market": "RU",
            "expressionLanguage": "Russian",
            "publisher": "Азбука",
            "editionStatement": "Own publisher heading, ISBN and translator actually read. Original publication range1864–1865 appears in the own annotation.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)",
            "isbn13": "9785389191457",
            "translator": "Нина Дарузес"
          }
        ]
      },
      "en": {
        "entityKind": "expression",
        "expressionId": "england:charles_dickens:article-series-1tdjfsi:en",
        "locale": "en",
        "value": "Our Mutual Friend",
        "status": "verified-published",
        "expressionLanguage": "English",
        "market": "US",
        "selectionRule": "current-complete-authorized-edition",
        "selectionNote": "Individually catalogued novel and independent same-market publisher identify the published title. Manifestation dates and serial chronology remain separate.",
        "evidence": [
          {
            "entityKind": "manifestation",
            "manifestationId": "loc-LCCN-06026332",
            "sourceUrl": "https://lccn.loc.gov/06026332/marcxml",
            "provider": "library-of-congress",
            "authorityId": "loc",
            "authorityTier": "A",
            "recordKind": "national-bibliography",
            "recordId": "LCCN-06026332",
            "catalogTitleExact": "Our mutual friend",
            "locale": "en",
            "market": "US",
            "expressionLanguage": "English",
            "publisher": "Harper & Brothers",
            "publicationYear": 1865,
            "editionStatement": "Full primary MARCXML:245$a Our mutual friend.;245$c By Charles Dickens.;260New York,Harper & Brothers,1865;300350 illustrated pages,24cm;008English. Terminal ISBD period excluded from the title value.1865 is this US manifestation, not substituted for the1864 serial start.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)"
          },
          {
            "entityKind": "manifestation",
            "manifestationId": "penguin-random-house-ISBN-9780140434972",
            "sourceUrl": "https://www.penguinrandomhouse.com/books/260144/our-mutual-friend-by-charles-dickens/",
            "provider": "penguin-random-house",
            "authorityId": "penguin-random-house",
            "authorityTier": "B",
            "recordKind": "publisher-catalog",
            "recordId": "ISBN-9780140434972",
            "catalogTitleExact": "Our Mutual Friend",
            "locale": "en",
            "market": "US",
            "expressionLanguage": "English",
            "publisher": "Penguin Classics",
            "publicationYear": 1998,
            "editionStatement": "Official publisher heading and product details:1998-02-01,928 pages.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)",
            "isbn13": "9780140434972"
          }
        ]
      }
    },
    "translations": {
      "ru": {
        "locale": "ru",
        "title": "Наш общий друг",
        "description": "Наследника богатого лондонского подрядчика Джона Гармона объявляют погибшим, а Белла Уилфер, девушка из бедной семьи, мечтает о выгодном замужестве. Подмены личности, маскировка и разоблачения превращают их историю в запутанную интригу, за которой встают вопросы о подлинном лице человека и свободе его выбора.",
        "sourceLanguage": "ru",
        "status": "reviewed",
        "sourceUrls": [
          "https://azbooka.ru/books/nash-obshchiy-drug",
          "https://www.penguinrandomhouse.com/books/260144/our-mutual-friend-by-charles-dickens/",
          "https://www.penguin.co.uk/books/34295/our-mutual-friend-by-dickens-charles/9780141920290",
          "https://search.rsl.ru/ru/record/01008299295"
        ],
        "method": "editorial-original",
        "reviewedAt": "2026-09-12",
        "descriptionProvenance": {
          "origin": "official-source-synthesis",
          "sourceLanguage": "ru",
          "sourceCountry": "england",
          "sourceUrls": [
            "https://azbooka.ru/books/nash-obshchiy-drug",
            "https://www.penguinrandomhouse.com/books/260144/our-mutual-friend-by-charles-dickens/",
            "https://www.penguin.co.uk/books/34295/our-mutual-friend-by-dickens-charles/9780141920290"
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
          "reviewedBy": "Codex AI /root/article_counts (independent editorial review)",
          "reviewedAt": "2026-09-12"
        }
      },
      "en": {
        "locale": "en",
        "title": "Our Mutual Friend",
        "description": "When a body recovered from the Thames is taken for that of John Harmon, his expected inheritance passes to the kindly dustman Boffin. Around this reversal, Dickens brings together Bella Wilfer, ambitious social climbers and the inhabitants of a darker London in a satire of Victorian society.",
        "sourceLanguage": "en",
        "status": "reviewed",
        "sourceUrls": [
          "https://www.penguinrandomhouse.com/books/260144/our-mutual-friend-by-charles-dickens/",
          "https://azbooka.ru/books/nash-obshchiy-drug",
          "https://www.penguin.co.uk/books/34295/our-mutual-friend-by-dickens-charles/9780141920290",
          "https://lccn.loc.gov/06026332/marcxml"
        ],
        "method": "editorial-original",
        "reviewedAt": "2026-09-12",
        "descriptionProvenance": {
          "origin": "official-source-synthesis",
          "sourceLanguage": "en",
          "sourceCountry": "england",
          "sourceUrls": [
            "https://azbooka.ru/books/nash-obshchiy-drug",
            "https://www.penguinrandomhouse.com/books/260144/our-mutual-friend-by-charles-dickens/",
            "https://www.penguin.co.uk/books/34295/our-mutual-friend-by-dickens-charles/9780141920290"
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
          "reviewedBy": "Codex AI /root/article_counts (independent editorial review)",
          "reviewedAt": "2026-09-12"
        }
      }
    },
    "sources": [
      {
        "provider": "azbooka-atticus",
        "authorityId": "azbooka",
        "authorityTier": "B",
        "country": "russia",
        "language": "Russian",
        "recordKind": "publisher-catalog",
        "recordId": "ISBN-9785389191457",
        "url": "https://azbooka.ru/books/nash-obshchiy-drug",
        "fields": [
          "identity",
          "authorship",
          "description",
          "title",
          "language",
          "market",
          "publication-year",
          "genre"
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
        "recordId": "ISBN-9780140434972",
        "url": "https://www.penguinrandomhouse.com/books/260144/our-mutual-friend-by-charles-dickens/",
        "fields": [
          "identity",
          "authorship",
          "description",
          "title",
          "language",
          "market",
          "original-title"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05",
        "market": "US"
      },
      {
        "provider": "penguin-books-uk",
        "authorityId": "penguin-uk",
        "authorityTier": "B",
        "country": "england",
        "language": "en",
        "market": "GB",
        "recordKind": "publisher-catalog",
        "recordId": "ISBN-9780141920290",
        "url": "https://www.penguin.co.uk/books/34295/our-mutual-friend-by-dickens-charles/9780141920290",
        "fields": [
          "identity",
          "authorship",
          "description",
          "publication-year"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "russian-state-library",
        "authorityId": "rsl",
        "authorityTier": "A",
        "recordId": "01008299295",
        "recordKind": "national-bibliography",
        "url": "https://search.rsl.ru/ru/record/01008299295",
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
        "recordId": "LCCN-06026332",
        "recordKind": "national-bibliography",
        "url": "https://lccn.loc.gov/06026332/marcxml",
        "language": "English",
        "market": "US",
        "fields": [
          "identity",
          "authorship",
          "title",
          "language",
          "market",
          "original-title"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      }
    ],
    "editorial": {
      "status": "reviewed",
      "reviewedAt": "2026-09-12"
    }
  },
  "england:charles_dickens:openlibrary-works-ol32466w": {
    "firstPublished": 1843,
    "originalTitle": "A Christmas Carol",
    "originalLanguage": "English",
    "description": "Скупой и нелюдимый Скрудж встречается со святочными духами, которые помогают ему увидеть возможность иной жизни. Его преображение превращает рождественскую историю в притчу о том, как равнодушие к окружающим уступает место доброте и готовности помогать людям.",
    "localizedTitles": {
      "ru": {
        "entityKind": "expression",
        "expressionId": "england:charles_dickens:openlibrary-works-ol32466w:ru",
        "locale": "ru",
        "value": "Рождественская песнь",
        "status": "verified-published",
        "expressionLanguage": "Russian",
        "market": "RU",
        "selectionRule": "current-complete-authorized-edition",
        "selectionNote": "Actual national record and official publisher identify the selected published title. Full story/novel is distinguished from shortened adaptations and surrounding collected works.",
        "evidence": [
          {
            "entityKind": "manifestation",
            "manifestationId": "rsl-01008053672",
            "sourceUrl": "https://search.rsl.ru/ru/record/01008053672",
            "provider": "russian-state-library",
            "authorityId": "rsl",
            "authorityTier": "A",
            "recordKind": "national-bibliography",
            "recordId": "01008053672",
            "catalogTitleExact": "Рождественская песнь",
            "locale": "ru",
            "market": "RU",
            "expressionLanguage": "Russian",
            "publisher": "Эксмо",
            "publicationYear": 2015,
            "isbn13": "9785699784561",
            "editionStatement": "Actual indexed national Russian record:translation T.A.Ozerskaya from English,Libico Maraja illustrations,150[2]pages,Moscow2015. Published short title selected consistently with official publisher.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)",
            "translator": "Т. А. Озерская"
          },
          {
            "entityKind": "manifestation",
            "manifestationId": "eksmo-ISBN-9785699784561",
            "sourceUrl": "https://eksmo.ru/book/rozhdestvenskaya-pesn-il-marayya-ITD592448/",
            "provider": "eksmo-publishing",
            "authorityId": "eksmo",
            "authorityTier": "B",
            "recordKind": "publisher-catalog",
            "recordId": "ISBN-9785699784561",
            "catalogTitleExact": "Рождественская песнь",
            "locale": "ru",
            "market": "RU",
            "expressionLanguage": "Russian",
            "publisher": "Эксмодетство",
            "publicationYear": 2015,
            "isbn13": "9785699784561",
            "editionStatement": "Own publisher title,translator TatyanaAlekseevnaOzerskaya,ISBN,152pages,2015-10-09. Original-language title field A Christmas Carol. Illustration marketing is not treated as a synopsis.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)",
            "translator": "Т. А. Озерская"
          }
        ]
      },
      "en": {
        "entityKind": "expression",
        "expressionId": "england:charles_dickens:openlibrary-works-ol32466w:en",
        "locale": "en",
        "value": "A Christmas Carol",
        "status": "verified-published",
        "expressionLanguage": "English",
        "market": "US",
        "selectionRule": "current-complete-authorized-edition",
        "selectionNote": "Actual national record and official publisher identify the selected published title. Full story/novel is distinguished from shortened adaptations and surrounding collected works.",
        "evidence": [
          {
            "entityKind": "manifestation",
            "manifestationId": "loc-LCCN-47037729",
            "sourceUrl": "https://lccn.loc.gov/47037729/marcxml",
            "provider": "library-of-congress",
            "authorityId": "loc",
            "authorityTier": "A",
            "recordKind": "national-bibliography",
            "recordId": "LCCN-47037729",
            "catalogTitleExact": "A Christmas Carol",
            "locale": "en",
            "market": "US",
            "expressionLanguage": "English",
            "publisher": "Hodder and Stoughton",
            "publicationYear": 1911,
            "editionStatement": "Full primary MARC245 A Christmas carol / by Charles Dickens;008English;New YorkHodderandStoughton1911,116pageswithmountedcolourplates,illustratorA.C.Michael. Same national work is independently presented by LoC Read.gov as a complete digitized book.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)"
          },
          {
            "entityKind": "manifestation",
            "manifestationId": "penguin-random-house-ISBN-9780141324524",
            "sourceUrl": "https://www.penguinrandomhouse.com/books/322498/a-christmas-carol-by-charles-dickens/9780141324524/",
            "provider": "penguin-random-house",
            "authorityId": "penguin-random-house",
            "authorityTier": "B",
            "recordKind": "publisher-catalog",
            "recordId": "ISBN-9780141324524",
            "catalogTitleExact": "A Christmas Carol",
            "locale": "en",
            "market": "US",
            "expressionLanguage": "English",
            "publisher": "Puffin Books",
            "publicationYear": 2008,
            "isbn13": "9780141324524",
            "editionStatement": "Actual own heading and product:2008-09-11,160pages. Own author chronology dates A Christmas Carol1843.",
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
        "title": "Рождественская песнь",
        "description": "Скупой и нелюдимый Скрудж встречается со святочными духами, которые помогают ему увидеть возможность иной жизни. Его преображение превращает рождественскую историю в притчу о том, как равнодушие к окружающим уступает место доброте и готовности помогать людям.",
        "sourceLanguage": "ru",
        "status": "reviewed",
        "sourceUrls": [
          "https://azbooka.ru/books/rozhdestvenskie-povesti",
          "https://azbooka.ru/books/rozhdestvenskaya-yelka",
          "https://www.penguinrandomhouse.com/books/322498/a-christmas-carol-by-charles-dickens/9780141324524/",
          "https://www.penguin.co.uk/books/184003/a-christmas-carol-by-charles-dickens/9780141973920",
          "https://search.rsl.ru/ru/record/01008053672",
          "https://eksmo.ru/book/rozhdestvenskaya-pesn-il-marayya-ITD592448/"
        ],
        "method": "editorial-original",
        "reviewedAt": "2026-09-12",
        "descriptionProvenance": {
          "origin": "official-source-synthesis",
          "sourceLanguage": "ru",
          "sourceCountry": "england",
          "sourceUrls": [
            "https://azbooka.ru/books/rozhdestvenskie-povesti",
            "https://azbooka.ru/books/rozhdestvenskaya-yelka",
            "https://www.penguinrandomhouse.com/books/322498/a-christmas-carol-by-charles-dickens/9780141324524/",
            "https://www.penguin.co.uk/books/184003/a-christmas-carol-by-charles-dickens/9780141973920"
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
          "reviewedBy": "Codex AI /root/article_counts (independent editorial review)",
          "reviewedAt": "2026-09-12"
        }
      },
      "en": {
        "locale": "en",
        "title": "A Christmas Carol",
        "description": "On Christmas Eve, the bitter and friendless Ebenezer Scrooge is taken on a frightening journey by three ghosts. Their visions of his past, present and future expose the consequences of his conduct and lead him toward a new affection for the people around him.",
        "sourceLanguage": "en",
        "status": "reviewed",
        "sourceUrls": [
          "https://www.penguinrandomhouse.com/books/322498/a-christmas-carol-by-charles-dickens/9780141324524/",
          "https://azbooka.ru/books/rozhdestvenskie-povesti",
          "https://azbooka.ru/books/rozhdestvenskaya-yelka",
          "https://www.penguin.co.uk/books/184003/a-christmas-carol-by-charles-dickens/9780141973920",
          "https://lccn.loc.gov/47037729/marcxml"
        ],
        "method": "editorial-original",
        "reviewedAt": "2026-09-12",
        "descriptionProvenance": {
          "origin": "official-source-synthesis",
          "sourceLanguage": "en",
          "sourceCountry": "england",
          "sourceUrls": [
            "https://azbooka.ru/books/rozhdestvenskie-povesti",
            "https://azbooka.ru/books/rozhdestvenskaya-yelka",
            "https://www.penguinrandomhouse.com/books/322498/a-christmas-carol-by-charles-dickens/9780141324524/",
            "https://www.penguin.co.uk/books/184003/a-christmas-carol-by-charles-dickens/9780141973920"
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
          "reviewedBy": "Codex AI /root/article_counts (independent editorial review)",
          "reviewedAt": "2026-09-12"
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
        "recordId": "ISBN-9785389218406",
        "url": "https://azbooka.ru/books/rozhdestvenskie-povesti",
        "fields": [
          "identity",
          "authorship",
          "description"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "azbooka-atticus",
        "authorityId": "azbooka",
        "authorityTier": "B",
        "country": "russia",
        "language": "ru",
        "recordKind": "publisher-catalog",
        "recordId": "ISBN-9785389170568",
        "url": "https://azbooka.ru/books/rozhdestvenskaya-yelka",
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
        "language": "English",
        "recordKind": "publisher-catalog",
        "recordId": "ISBN-9780141324524",
        "url": "https://www.penguinrandomhouse.com/books/322498/a-christmas-carol-by-charles-dickens/9780141324524/",
        "fields": [
          "identity",
          "authorship",
          "description",
          "title",
          "language",
          "market",
          "publication-year"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05",
        "market": "US"
      },
      {
        "provider": "penguin-books-uk",
        "authorityId": "penguin-uk",
        "authorityTier": "B",
        "country": "england",
        "language": "en",
        "market": "GB",
        "recordKind": "publisher-catalog",
        "recordId": "ISBN-9780141973920",
        "url": "https://www.penguin.co.uk/books/184003/a-christmas-carol-by-charles-dickens/9780141973920",
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
        "recordId": "01008053672",
        "recordKind": "national-bibliography",
        "url": "https://search.rsl.ru/ru/record/01008053672",
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
        "provider": "eksmo-publishing",
        "authorityId": "eksmo",
        "authorityTier": "B",
        "recordId": "ISBN-9785699784561",
        "recordKind": "publisher-catalog",
        "url": "https://eksmo.ru/book/rozhdestvenskaya-pesn-il-marayya-ITD592448/",
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
        "recordId": "LCCN-47037729",
        "recordKind": "national-bibliography",
        "url": "https://lccn.loc.gov/47037729/marcxml",
        "language": "English",
        "market": "US",
        "fields": [
          "identity",
          "authorship",
          "title",
          "language",
          "market",
          "original-title"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "russian-state-library",
        "authorityId": "rsl",
        "authorityTier": "A",
        "country": "russia",
        "language": "Russian",
        "market": "RU",
        "recordKind": "national-bibliography",
        "recordId": "01009499349",
        "url": "https://search.rsl.ru/ru/record/01009499349",
        "fields": [
          "identity",
          "authorship",
          "genre"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      }
    ],
    "editorial": {
      "status": "reviewed",
      "reviewedAt": "2026-09-12"
    }
  },
  "england:charles_dickens:openlibrary-works-ol8193387w": {
    "firstPublished": 1854,
    "originalTitle": "Hard Times",
    "originalLanguage": "English",
    "description": "В промышленном Кокстауне Томас Грэдграйнд воспитывает детей в поклонении фактам и расчёту, не оставляя места чувствам. Когда жизнь его повзрослевших сына и дочери оказывается под угрозой разрушения, поддержку семье приносит Сесси, дочь бродячего циркача.",
    "localizedTitles": {
      "ru": {
        "entityKind": "expression",
        "expressionId": "england:charles_dickens:openlibrary-works-ol8193387w:ru",
        "locale": "ru",
        "value": "Тяжелые времена",
        "status": "verified-published",
        "expressionLanguage": "Russian",
        "market": "RU",
        "selectionRule": "current-complete-authorized-edition",
        "selectionNote": "National catalog and independent same-market publisher establish the published title. Edition years do not replace original publication chronology; adaptation/abridgement records encountered in research were excluded.",
        "evidence": [
          {
            "entityKind": "manifestation",
            "manifestationId": "rsl-01005789065",
            "sourceUrl": "https://search.rsl.ru/ru/record/01005789065",
            "provider": "russian-state-library",
            "authorityId": "rsl",
            "authorityTier": "A",
            "recordKind": "national-bibliography",
            "recordId": "01005789065",
            "catalogTitleExact": "Тяжелые времена",
            "locale": "ru",
            "market": "RU",
            "expressionLanguage": "Russian",
            "publisher": "Кн. изд-во",
            "publicationYear": 1954,
            "editionStatement": "Full indexed primary MARC read: 245$a Тяжелые времена, 245$b Роман; 041 rus; 260 Kostroma 1954; 304 illustrated pages. This is the standalone novel, not the rejected 1891 abridged Pavlenkov translation.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)"
          },
          {
            "entityKind": "manifestation",
            "manifestationId": "ast-ISBN-9785171542870",
            "sourceUrl": "https://ast.ru/book/tyazhelye-vremena-870745/",
            "provider": "ast-publishing",
            "authorityId": "ast",
            "authorityTier": "B",
            "recordKind": "publisher-catalog",
            "recordId": "ISBN-9785171542870",
            "catalogTitleExact": "Тяжелые времена",
            "locale": "ru",
            "market": "RU",
            "expressionLanguage": "Russian",
            "publisher": "АСТ",
            "editionStatement": "Publisher title and ISBN actually read in indexed primary catalog; translation by Vera Toper, 416 pages.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)",
            "isbn13": "9785171542870",
            "translator": "Вера Максимовна Топер"
          }
        ]
      },
      "en": {
        "entityKind": "expression",
        "expressionId": "england:charles_dickens:openlibrary-works-ol8193387w:en",
        "locale": "en",
        "value": "Hard Times",
        "status": "verified-published",
        "expressionLanguage": "English",
        "market": "US",
        "selectionRule": "current-complete-authorized-edition",
        "selectionNote": "National catalog and independent same-market publisher establish the published title. Edition years do not replace original publication chronology; adaptation/abridgement records encountered in research were excluded.",
        "evidence": [
          {
            "entityKind": "manifestation",
            "manifestationId": "loc-LCCN-06026454",
            "sourceUrl": "https://www.loc.gov/resource/gdcmassbookdig.hardtimes00dick_2/?q=children%27s+books&sp=2&st=slideshow",
            "provider": "library-of-congress",
            "authorityId": "loc",
            "authorityTier": "A",
            "recordKind": "national-bibliography",
            "recordId": "LCCN-06026454",
            "catalogTitleExact": "Hard times",
            "locale": "en",
            "market": "US",
            "expressionLanguage": "English",
            "publisher": "T. L. McElrath & co.",
            "publicationYear": 1854,
            "editionStatement": "Indexed original Library of Congress About this Item read: title Hard times. (terminal ISBD period omitted); Charles Dickens; New York 1854; 1 p.l.,108 pages,24cm; LCCN06026454. No abridgement or adaptation declared. English title/text; the separate related-items carousel is excluded. Direct item/MARC access failed; no claim that MARCXML or every scanned page was read.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)"
          },
          {
            "entityKind": "manifestation",
            "manifestationId": "penguin-random-house-ISBN-9780451530998",
            "sourceUrl": "https://www.penguinrandomhouse.com/books/326690/hard-times-by-charles-dickens/",
            "provider": "penguin-random-house",
            "authorityId": "penguin-random-house",
            "authorityTier": "B",
            "recordKind": "publisher-catalog",
            "recordId": "ISBN-9780451530998",
            "catalogTitleExact": "Hard Times",
            "locale": "en",
            "market": "US",
            "expressionLanguage": "English",
            "publisher": "Signet",
            "publicationYear": 2008,
            "editionStatement": "Publisher product details: 2008-07-01, Signet, 336 pages.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)",
            "isbn13": "9780451530998"
          }
        ]
      }
    },
    "translations": {
      "ru": {
        "locale": "ru",
        "title": "Тяжелые времена",
        "description": "В промышленном Кокстауне Томас Грэдграйнд воспитывает детей в поклонении фактам и расчёту, не оставляя места чувствам. Когда жизнь его повзрослевших сына и дочери оказывается под угрозой разрушения, поддержку семье приносит Сесси, дочь бродячего циркача.",
        "sourceLanguage": "ru",
        "status": "reviewed",
        "sourceUrls": [
          "https://ast.ru/book/tyazhelye-vremena-870745/",
          "https://www.penguinrandomhouse.com/books/326690/hard-times-by-charles-dickens/",
          "https://www.penguin.co.uk/books/56169/hard-times-by-dickens-charles/9780141920061",
          "https://search.rsl.ru/ru/record/01005789065",
          "https://azbooka.ru/books/tyazhelye-vremena-6v3v"
        ],
        "method": "editorial-original",
        "reviewedAt": "2026-09-12",
        "descriptionProvenance": {
          "origin": "official-source-synthesis",
          "sourceLanguage": "ru",
          "sourceCountry": "england",
          "sourceUrls": [
            "https://ast.ru/book/tyazhelye-vremena-870745/",
            "https://www.penguinrandomhouse.com/books/326690/hard-times-by-charles-dickens/",
            "https://www.penguin.co.uk/books/56169/hard-times-by-dickens-charles/9780141920061",
            "https://azbooka.ru/books/tyazhelye-vremena-6v3v"
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
          "reviewedBy": "Codex AI /root/article_counts (independent editorial review)",
          "reviewedAt": "2026-09-12"
        }
      },
      "en": {
        "locale": "en",
        "title": "Hard Times",
        "description": "In the industrial town of Coketown, Thomas Gradgrind builds his teaching around facts, statistics and obedience, suppressing curiosity and feeling. The damage this philosophy does to his own family turns a story of education into a sharp examination of a society governed by calculation.",
        "sourceLanguage": "en",
        "status": "reviewed",
        "sourceUrls": [
          "https://www.penguinrandomhouse.com/books/326690/hard-times-by-charles-dickens/",
          "https://ast.ru/book/tyazhelye-vremena-870745/",
          "https://www.penguin.co.uk/books/56169/hard-times-by-dickens-charles/9780141920061",
          "https://www.loc.gov/resource/gdcmassbookdig.hardtimes00dick_2/?q=children%27s+books&sp=2&st=slideshow"
        ],
        "method": "editorial-original",
        "reviewedAt": "2026-09-12",
        "descriptionProvenance": {
          "origin": "official-source-synthesis",
          "sourceLanguage": "en",
          "sourceCountry": "england",
          "sourceUrls": [
            "https://ast.ru/book/tyazhelye-vremena-870745/",
            "https://www.penguinrandomhouse.com/books/326690/hard-times-by-charles-dickens/",
            "https://www.penguin.co.uk/books/56169/hard-times-by-dickens-charles/9780141920061"
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
          "reviewedBy": "Codex AI /root/article_counts (independent editorial review)",
          "reviewedAt": "2026-09-12"
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
        "recordId": "ISBN-9785171542870",
        "url": "https://ast.ru/book/tyazhelye-vremena-870745/",
        "fields": [
          "identity",
          "authorship",
          "description",
          "title",
          "language",
          "market",
          "genre"
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
        "recordId": "ISBN-9780451530998",
        "url": "https://www.penguinrandomhouse.com/books/326690/hard-times-by-charles-dickens/",
        "fields": [
          "identity",
          "authorship",
          "description",
          "title",
          "language",
          "market",
          "original-title",
          "publication-year"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05",
        "market": "US"
      },
      {
        "provider": "penguin-books-uk",
        "authorityId": "penguin-uk",
        "authorityTier": "B",
        "country": "england",
        "language": "en",
        "market": "GB",
        "recordKind": "publisher-catalog",
        "recordId": "ISBN-9780141920061",
        "url": "https://www.penguin.co.uk/books/56169/hard-times-by-dickens-charles/9780141920061",
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
        "recordId": "01005789065",
        "recordKind": "national-bibliography",
        "url": "https://search.rsl.ru/ru/record/01005789065",
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
        "recordId": "LCCN-06026454",
        "recordKind": "national-bibliography",
        "url": "https://www.loc.gov/resource/gdcmassbookdig.hardtimes00dick_2/?q=children%27s+books&sp=2&st=slideshow",
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
        "provider": "azbooka-atticus",
        "authorityId": "azbooka",
        "authorityTier": "B",
        "country": "russia",
        "market": "RU",
        "language": "ru",
        "recordKind": "publisher-catalog",
        "url": "https://azbooka.ru/books/tyazhelye-vremena-6v3v",
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
      "reviewedAt": "2026-09-12"
    }
  },
  "england:charles_dickens:openlibrary-works-ol14868510w": {
    "firstPublished": 1852,
    "originalTitle": "Bleak House",
    "originalLanguage": "English",
    "description": "Сирота Эстер Саммерсон оказывается под опекой мистера Джарндиса и поселяется в его поместье, связанном с запутанной судебной тяжбой. Среди новых знакомых, личных драм и криминальных интриг она приближается к семейной тайне, которая касается её самой.",
    "localizedTitles": {
      "ru": {
        "entityKind": "expression",
        "expressionId": "england:charles_dickens:openlibrary-works-ol14868510w:ru",
        "locale": "ru",
        "value": "Холодный дом",
        "status": "verified-published",
        "expressionLanguage": "Russian",
        "market": "RU",
        "selectionRule": "current-complete-authorized-edition",
        "selectionNote": "Individually catalogued novel and independent same-market publisher identify the published title. Manifestation dates and serial chronology remain separate.",
        "evidence": [
          {
            "entityKind": "manifestation",
            "manifestationId": "rsl-01005876059",
            "sourceUrl": "https://search.rsl.ru/ru/record/01005876059",
            "provider": "russian-state-library",
            "authorityId": "rsl",
            "authorityTier": "A",
            "recordKind": "national-bibliography",
            "recordId": "01005876059",
            "catalogTitleExact": "Холодный дом",
            "locale": "ru",
            "market": "RU",
            "expressionLanguage": "Russian",
            "publisher": "Гослитиздат",
            "publicationYear": 1955,
            "editionStatement": "Actual indexed national bibliographic description: Moscow,1955,856 pages and1 plate; Russian language, translated from English by M.Klyagina-Kondratyeva; introduction R.Pomerantseva, illustrations G.Filippovsky. No claim of reading unseen complete MARC or every book page.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)",
            "translator": "М. Клягина-Кондратьева"
          },
          {
            "entityKind": "manifestation",
            "manifestationId": "azbooka-ISBN-9785389183193",
            "sourceUrl": "https://azbooka.ru/books/kholodnyy-dom",
            "provider": "azbooka-atticus",
            "authorityId": "azbooka",
            "authorityTier": "B",
            "recordKind": "publisher-catalog",
            "recordId": "ISBN-9785389183193",
            "catalogTitleExact": "Холодный дом",
            "locale": "ru",
            "market": "RU",
            "expressionLanguage": "Russian",
            "publisher": "Азбука",
            "editionStatement": "Actual publisher heading, translator and ISBN; own annotation calls it a novel and dates it1852–1853.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)",
            "isbn13": "9785389183193",
            "translator": "Мелитина Клягина-Кондратьева"
          }
        ]
      },
      "en": {
        "entityKind": "expression",
        "expressionId": "england:charles_dickens:openlibrary-works-ol14868510w:en",
        "locale": "en",
        "value": "Bleak House",
        "status": "verified-published",
        "expressionLanguage": "English",
        "market": "US",
        "selectionRule": "current-complete-authorized-edition",
        "selectionNote": "Individually catalogued novel and independent same-market publisher identify the published title. Manifestation dates and serial chronology remain separate.",
        "evidence": [
          {
            "entityKind": "manifestation",
            "manifestationId": "loc-LCCN-04015298",
            "sourceUrl": "https://lccn.loc.gov/04015298/marcxml",
            "provider": "library-of-congress",
            "authorityId": "loc",
            "authorityTier": "A",
            "recordKind": "national-bibliography",
            "recordId": "LCCN-04015298",
            "catalogTitleExact": "Bleak house",
            "locale": "en",
            "market": "US",
            "expressionLanguage": "English",
            "publisher": "Macmillan and co.",
            "publicationYear": 1895,
            "editionStatement": "Full primary MARCXML:245$a Bleak house, (terminal ISBD comma omitted);260New York;London,1895;300xxxiv,[2],815 pages;008English.245$c explicitly identifies a reprint of the author-corrected1869 edition;500notes facsimile first-edition title pages,London1853. US co-publication supported by New York imprint. None of these dates is substituted for the1852 serial start.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)"
          },
          {
            "entityKind": "manifestation",
            "manifestationId": "penguin-random-house-ISBN-9780679405689",
            "sourceUrl": "https://www.penguinrandomhouse.com/books/40432/bleak-house-by-charles-dickens-introduction-by-barbara-hardy/",
            "provider": "penguin-random-house",
            "authorityId": "penguin-random-house",
            "authorityTier": "B",
            "recordKind": "publisher-catalog",
            "recordId": "ISBN-9780679405689",
            "catalogTitleExact": "Bleak House",
            "locale": "en",
            "market": "US",
            "expressionLanguage": "English",
            "publisher": "Everyman’s Library",
            "publicationYear": 1991,
            "editionStatement": "Actual publisher product details:1991-10-15,1032 pages; introduction Barbara Hardy.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)",
            "isbn13": "9780679405689"
          }
        ]
      }
    },
    "translations": {
      "ru": {
        "locale": "ru",
        "title": "Холодный дом",
        "description": "Сирота Эстер Саммерсон оказывается под опекой мистера Джарндиса и поселяется в его поместье, связанном с запутанной судебной тяжбой. Среди новых знакомых, личных драм и криминальных интриг она приближается к семейной тайне, которая касается её самой.",
        "sourceLanguage": "ru",
        "status": "reviewed",
        "sourceUrls": [
          "https://azbooka.ru/books/kholodnyy-dom",
          "https://www.penguinrandomhouse.com/books/40432/bleak-house-by-charles-dickens-introduction-by-barbara-hardy/",
          "https://www.penguin.co.uk/books/372827/bleak-house-by-dickenscharles/9781857150087",
          "https://search.rsl.ru/ru/record/01005876059"
        ],
        "method": "editorial-original",
        "reviewedAt": "2026-09-12",
        "descriptionProvenance": {
          "origin": "official-source-synthesis",
          "sourceLanguage": "ru",
          "sourceCountry": "england",
          "sourceUrls": [
            "https://azbooka.ru/books/kholodnyy-dom",
            "https://www.penguinrandomhouse.com/books/40432/bleak-house-by-charles-dickens-introduction-by-barbara-hardy/",
            "https://www.penguin.co.uk/books/372827/bleak-house-by-dickenscharles/9781857150087"
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
          "reviewedBy": "Codex AI /root/article_counts (independent editorial review)",
          "reviewedAt": "2026-09-12"
        }
      },
      "en": {
        "locale": "en",
        "title": "Bleak House",
        "description": "The seemingly endless case of Jarndyce and Jarndyce entangles successive generations in hopes of an inheritance, while Esther Summerson watches its human cost. Beyond the lawyers' arguments, mysteries of lost children, blackmail and murder expose a London whose injustices reach far outside the courtroom.",
        "sourceLanguage": "en",
        "status": "reviewed",
        "sourceUrls": [
          "https://www.penguinrandomhouse.com/books/40432/bleak-house-by-charles-dickens-introduction-by-barbara-hardy/",
          "https://azbooka.ru/books/kholodnyy-dom",
          "https://www.penguin.co.uk/books/372827/bleak-house-by-dickenscharles/9781857150087",
          "https://lccn.loc.gov/04015298/marcxml"
        ],
        "method": "editorial-original",
        "reviewedAt": "2026-09-12",
        "descriptionProvenance": {
          "origin": "official-source-synthesis",
          "sourceLanguage": "en",
          "sourceCountry": "england",
          "sourceUrls": [
            "https://azbooka.ru/books/kholodnyy-dom",
            "https://www.penguinrandomhouse.com/books/40432/bleak-house-by-charles-dickens-introduction-by-barbara-hardy/",
            "https://www.penguin.co.uk/books/372827/bleak-house-by-dickenscharles/9781857150087"
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
          "reviewedBy": "Codex AI /root/article_counts (independent editorial review)",
          "reviewedAt": "2026-09-12"
        }
      }
    },
    "sources": [
      {
        "provider": "azbooka-atticus",
        "authorityId": "azbooka",
        "authorityTier": "B",
        "country": "russia",
        "language": "Russian",
        "recordKind": "publisher-catalog",
        "recordId": "ISBN-9785389183193",
        "url": "https://azbooka.ru/books/kholodnyy-dom",
        "fields": [
          "identity",
          "authorship",
          "description",
          "title",
          "language",
          "market",
          "publication-year",
          "genre"
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
        "recordId": "ISBN-9780679405689",
        "url": "https://www.penguinrandomhouse.com/books/40432/bleak-house-by-charles-dickens-introduction-by-barbara-hardy/",
        "fields": [
          "identity",
          "authorship",
          "description",
          "title",
          "language",
          "market",
          "original-title"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05",
        "market": "US"
      },
      {
        "provider": "penguin-books-uk",
        "authorityId": "penguin-uk",
        "authorityTier": "B",
        "country": "england",
        "language": "en",
        "market": "GB",
        "recordKind": "publisher-catalog",
        "recordId": "ISBN-9781857150087",
        "url": "https://www.penguin.co.uk/books/372827/bleak-house-by-dickenscharles/9781857150087",
        "fields": [
          "identity",
          "authorship",
          "description",
          "publication-year"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "russian-state-library",
        "authorityId": "rsl",
        "authorityTier": "A",
        "recordId": "01005876059",
        "recordKind": "national-bibliography",
        "url": "https://search.rsl.ru/ru/record/01005876059",
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
        "recordId": "LCCN-04015298",
        "recordKind": "national-bibliography",
        "url": "https://lccn.loc.gov/04015298/marcxml",
        "language": "English",
        "market": "US",
        "fields": [
          "identity",
          "authorship",
          "title",
          "language",
          "market",
          "original-title"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      }
    ],
    "editorial": {
      "status": "reviewed",
      "reviewedAt": "2026-09-12"
    }
  },
  "england:charles_dickens:openlibrary-works-ol14869167w": {
    "firstPublished": 1840,
    "originalTitle": "The Old Curiosity Shop",
    "originalLanguage": "English",
    "description": "Маленькую Нелл и её деда, увлечённого карточной игрой, преследует жестокий ростовщик Квилп. В этой истории о столкновении добра и зла бытовая реальность соседствует с готическими тайнами и гротескными, почти сказочными образами.",
    "localizedTitles": {
      "ru": {
        "entityKind": "expression",
        "expressionId": "england:charles_dickens:openlibrary-works-ol14869167w:ru",
        "locale": "ru",
        "value": "Лавка древностей",
        "status": "verified-published",
        "expressionLanguage": "Russian",
        "market": "RU",
        "selectionRule": "current-complete-authorized-edition",
        "selectionNote": "Actual national record and official publisher identify the selected published title. Full story/novel is distinguished from shortened adaptations and surrounding collected works.",
        "evidence": [
          {
            "entityKind": "manifestation",
            "manifestationId": "rsl-01005592950",
            "sourceUrl": "https://search.rsl.ru/ru/record/01005592950",
            "provider": "russian-state-library",
            "authorityId": "rsl",
            "authorityTier": "A",
            "recordKind": "national-bibliography",
            "recordId": "01005592950",
            "catalogTitleExact": "Собрание сочинений",
            "locale": "ru",
            "market": "RU",
            "expressionLanguage": "Russian",
            "publisher": "Гослитиздат",
            "publicationYear": 1958,
            "editionStatement": "Actual indexed RSL Состав section for30-volume set:volume7 Лавка древностей,роман,translationN.Volzhina,commentsYu.Kagarlitsky,illustrationsPhizandG.Cattermole,1958,647pages. This is the catalog contents note, not an alleged MARC505 or separately opened child record.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)",
            "titleRelation": "contained-work",
            "analyticTitleExact": "Лавка древностей",
            "containerTitleExact": "Собрание сочинений",
            "containedInField": "contents-note",
            "translator": "Н. Волжина"
          },
          {
            "entityKind": "manifestation",
            "manifestationId": "eksmo-ISBN-9785041645458",
            "sourceUrl": "https://eksmo.ru/book/lavka-drevnostey-ITD1259885/",
            "provider": "eksmo-publishing",
            "authorityId": "eksmo",
            "authorityTier": "B",
            "recordKind": "publisher-catalog",
            "recordId": "ISBN-9785041645458",
            "catalogTitleExact": "Лавка древностей",
            "locale": "ru",
            "market": "RU",
            "expressionLanguage": "Russian",
            "publisher": "Эксмо",
            "publicationYear": 2023,
            "isbn13": "9785041645458",
            "editionStatement": "Actual own publisher heading and product:2023-07-06,672pages; annotation explicitly identifies the novel,Nell,grandfatherandQuilp.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)"
          }
        ]
      },
      "en": {
        "entityKind": "expression",
        "expressionId": "england:charles_dickens:openlibrary-works-ol14869167w:en",
        "locale": "en",
        "value": "The Old Curiosity Shop",
        "status": "verified-published",
        "expressionLanguage": "English",
        "market": "US",
        "selectionRule": "current-complete-authorized-edition",
        "selectionNote": "Actual national record and official publisher identify the selected published title. Full story/novel is distinguished from shortened adaptations and surrounding collected works.",
        "evidence": [
          {
            "entityKind": "manifestation",
            "manifestationId": "loc-LCCN-2003043537",
            "sourceUrl": "https://lccn.loc.gov/2003043537/marcxml",
            "provider": "library-of-congress",
            "authorityId": "loc",
            "authorityTier": "A",
            "recordKind": "national-bibliography",
            "recordId": "LCCN-2003043537",
            "catalogTitleExact": "The Old Curiosity Shop",
            "locale": "en",
            "market": "US",
            "expressionLanguage": "English",
            "publisher": "Dover Publications",
            "publicationYear": 2003,
            "isbn13": "9780486426792",
            "editionStatement": "Full primary MARC245 The old curiosity shop / Charles Dickens;008English;MineolaNewYorkDover2003,iv452pages. Actual national record replaces inaccessible discovery pointers41005029/2001271862/95075208.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)"
          },
          {
            "entityKind": "manifestation",
            "manifestationId": "penguin-random-house-ISBN-9780679443735",
            "sourceUrl": "https://www.penguinrandomhouse.com/books/40471/the-old-curiosity-shop-by-charles-dickens-introduction-by-peter-washington/",
            "provider": "penguin-random-house",
            "authorityId": "penguin-random-house",
            "authorityTier": "B",
            "recordKind": "publisher-catalog",
            "recordId": "ISBN-9780679443735",
            "catalogTitleExact": "The Old Curiosity Shop",
            "locale": "en",
            "market": "US",
            "expressionLanguage": "English",
            "publisher": "Everyman’s Library",
            "publicationYear": 1995,
            "isbn13": "9780679443735",
            "editionStatement": "Previously actually read own publisher title/product:1995-08-01,624pages. Own author chronology gives first serial1840–1841; imported1800 is rejected.",
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
        "title": "Лавка древностей",
        "description": "Маленькую Нелл и её деда, увлечённого карточной игрой, преследует жестокий ростовщик Квилп. В этой истории о столкновении добра и зла бытовая реальность соседствует с готическими тайнами и гротескными, почти сказочными образами.",
        "sourceLanguage": "ru",
        "status": "reviewed",
        "sourceUrls": [
          "https://eksmo.ru/book/lavka-drevnostey-ITD1259885/",
          "https://www.penguinrandomhouse.com/books/40471/the-old-curiosity-shop-by-charles-dickens-introduction-by-peter-washington/",
          "https://www.penguin.co.uk/books/406700/the-old-curiosity-shop-by-dickens-charles/9781448128419",
          "https://search.rsl.ru/ru/record/01005592950"
        ],
        "method": "editorial-original",
        "reviewedAt": "2026-09-12",
        "descriptionProvenance": {
          "origin": "official-source-synthesis",
          "sourceLanguage": "ru",
          "sourceCountry": "england",
          "sourceUrls": [
            "https://eksmo.ru/book/lavka-drevnostey-ITD1259885/",
            "https://www.penguinrandomhouse.com/books/40471/the-old-curiosity-shop-by-charles-dickens-introduction-by-peter-washington/",
            "https://www.penguin.co.uk/books/406700/the-old-curiosity-shop-by-dickens-charles/9781448128419"
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
          "reviewedBy": "Codex AI /root/article_counts (independent editorial review)",
          "reviewedAt": "2026-09-12"
        }
      },
      "en": {
        "locale": "en",
        "title": "The Old Curiosity Shop",
        "description": "Little Nell and her ailing grandfather face persecution by the cruel Quilp, whose malice makes their already precarious lives increasingly dangerous. Around their harrowing story, Dickens creates an exuberant company of comic and grotesque characters, bringing moments of humour into a world of suffering.",
        "sourceLanguage": "en",
        "status": "reviewed",
        "sourceUrls": [
          "https://www.penguinrandomhouse.com/books/40471/the-old-curiosity-shop-by-charles-dickens-introduction-by-peter-washington/",
          "https://eksmo.ru/book/lavka-drevnostey-ITD1259885/",
          "https://www.penguin.co.uk/books/406700/the-old-curiosity-shop-by-dickens-charles/9781448128419",
          "https://lccn.loc.gov/2003043537/marcxml"
        ],
        "method": "editorial-original",
        "reviewedAt": "2026-09-12",
        "descriptionProvenance": {
          "origin": "official-source-synthesis",
          "sourceLanguage": "en",
          "sourceCountry": "england",
          "sourceUrls": [
            "https://eksmo.ru/book/lavka-drevnostey-ITD1259885/",
            "https://www.penguinrandomhouse.com/books/40471/the-old-curiosity-shop-by-charles-dickens-introduction-by-peter-washington/",
            "https://www.penguin.co.uk/books/406700/the-old-curiosity-shop-by-dickens-charles/9781448128419"
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
          "reviewedBy": "Codex AI /root/article_counts (independent editorial review)",
          "reviewedAt": "2026-09-12"
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
        "recordId": "ISBN-9785041645458",
        "url": "https://eksmo.ru/book/lavka-drevnostey-ITD1259885/",
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
        "recordId": "ISBN-9780679443735",
        "url": "https://www.penguinrandomhouse.com/books/40471/the-old-curiosity-shop-by-charles-dickens-introduction-by-peter-washington/",
        "fields": [
          "identity",
          "authorship",
          "description",
          "title",
          "language",
          "market",
          "publication-year"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05",
        "market": "US"
      },
      {
        "provider": "penguin-books-uk",
        "authorityId": "penguin-uk",
        "authorityTier": "B",
        "country": "england",
        "language": "en",
        "market": "GB",
        "recordKind": "publisher-catalog",
        "recordId": "ISBN-9781448128419",
        "url": "https://www.penguin.co.uk/books/406700/the-old-curiosity-shop-by-dickens-charles/9781448128419",
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
        "recordId": "01005592950",
        "recordKind": "national-bibliography",
        "url": "https://search.rsl.ru/ru/record/01005592950",
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
        "recordId": "LCCN-2003043537",
        "recordKind": "national-bibliography",
        "url": "https://lccn.loc.gov/2003043537/marcxml",
        "language": "English",
        "market": "US",
        "fields": [
          "identity",
          "authorship",
          "title",
          "language",
          "market",
          "original-title"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "Charles Dickens Museum",
        "country": "england",
        "language": "en",
        "recordKind": "authoritative-work-page",
        "url": "https://dickensmuseum.com/blogs/charles-dickens-museum/112183174-a-hidden-tribute-to-shakespeare",
        "fields": [
          "publication-year"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-12"
      }
    ],
    "editorial": {
      "status": "reviewed",
      "reviewedAt": "2026-09-12"
    }
  },
  "england:charles_dickens:openlibrary-works-ol13114895w": {
    "firstPublished": 1838,
    "originalTitle": "Nicholas Nickleby",
    "originalLanguage": "English",
    "description": "После смерти отца Николас Никльби по воле богатого дяди становится учителем в йоркширской школе для мальчиков. Столкнувшись с жестоким обращением с воспитанниками, он покидает школу вместе со Смайком, отказываясь принять порядки, превращающие детство в мучение.",
    "localizedTitles": {
      "ru": {
        "entityKind": "expression",
        "expressionId": "england:charles_dickens:openlibrary-works-ol13114895w:ru",
        "locale": "ru",
        "value": "Жизнь и приключения Николаса Никльби",
        "status": "verified-published",
        "expressionLanguage": "Russian",
        "market": "RU",
        "selectionRule": "current-complete-authorized-edition",
        "selectionNote": "Actual national catalog and independent publisher establish this published title spelling. Different print editions and first-publication chronology are recorded separately.",
        "evidence": [
          {
            "entityKind": "manifestation",
            "manifestationId": "rsl-01005000738",
            "sourceUrl": "https://search.rsl.ru/ru/record/01005000738",
            "provider": "russian-state-library",
            "authorityId": "rsl",
            "authorityTier": "A",
            "recordKind": "national-bibliography",
            "recordId": "01005000738",
            "catalogTitleExact": "Жизнь и приключения Николаса Никльби",
            "locale": "ru",
            "market": "RU",
            "expressionLanguage": "Russian",
            "publisher": "АСТ; Астрель",
            "publicationYear": 2011,
            "editionStatement": "Indexed primary bibliographic description and displayed MARC260/300 read: Russian novel, translation A.V.Krivtsova; Moscow2011;923,[1] pages. Published title has Никльби; the matching AST edition is selected.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)",
            "isbn13": "9785170727957",
            "translator": "А. В. Кривцова"
          },
          {
            "entityKind": "manifestation",
            "manifestationId": "ast-ISBN-9785170727957",
            "sourceUrl": "https://ast.ru/book/zhizn-i-priklyucheniya-nikolasa-niklbi-015562/",
            "provider": "ast-publishing",
            "authorityId": "ast",
            "authorityTier": "B",
            "recordKind": "publisher-catalog",
            "recordId": "ISBN-9785170727957",
            "catalogTitleExact": "Жизнь и приключения Николаса Никльби",
            "locale": "ru",
            "market": "RU",
            "expressionLanguage": "Russian",
            "publisher": "АСТ",
            "editionStatement": "Actual publisher heading and ISBN match the national manifestation; publisher reports928 pages versus catalog923,[1]. Physical page-count discrepancy is retained in this note, not used to invent a different edition. Both records identify the same published title.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)",
            "isbn13": "9785170727957"
          }
        ]
      },
      "en": {
        "entityKind": "expression",
        "expressionId": "england:charles_dickens:openlibrary-works-ol13114895w:en",
        "locale": "en",
        "value": "Nicholas Nickleby",
        "status": "verified-published",
        "expressionLanguage": "English",
        "market": "US",
        "selectionRule": "current-complete-authorized-edition",
        "selectionNote": "Actual national catalog and independent publisher establish this published title spelling. Different print editions and first-publication chronology are recorded separately.",
        "evidence": [
          {
            "entityKind": "manifestation",
            "manifestationId": "loc-LCCN-2003269677",
            "sourceUrl": "https://lccn.loc.gov/2003269677/marcxml",
            "provider": "library-of-congress",
            "authorityId": "loc",
            "authorityTier": "A",
            "recordKind": "national-bibliography",
            "recordId": "LCCN-2003269677",
            "catalogTitleExact": "Nicholas Nickleby",
            "locale": "en",
            "market": "US",
            "expressionLanguage": "English",
            "publisher": "Penguin Books",
            "publicationYear": 2002,
            "editionStatement": "Complete primary MARCXML read:245$a Nicholas Nickleby /;260New York2002;300xvi,799 pages;008English/reprint1839. Mark Ford notes; Douglas McGrath introduction. Terminal ISBD slash omitted.1839 refers to the source book edition, not the serial start.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)",
            "isbn13": "9780142002759"
          },
          {
            "entityKind": "manifestation",
            "manifestationId": "penguin-random-house-ISBN-9780679423072",
            "sourceUrl": "https://www.penguinrandomhouse.com/books/40454/nicholas-nickleby-by-charles-dickens-introduction-by-john-carey/",
            "provider": "penguin-random-house",
            "authorityId": "penguin-random-house",
            "authorityTier": "B",
            "recordKind": "publisher-catalog",
            "recordId": "ISBN-9780679423072",
            "catalogTitleExact": "Nicholas Nickleby",
            "locale": "en",
            "market": "US",
            "expressionLanguage": "English",
            "publisher": "Everyman’s Library",
            "publicationYear": 1993,
            "editionStatement": "Own publisher title/product details:1993-10-26,914 pages. The separately displayed audio release1982 is excluded.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)",
            "isbn13": "9780679423072"
          }
        ]
      }
    },
    "translations": {
      "ru": {
        "locale": "ru",
        "title": "Жизнь и приключения Николаса Никльби",
        "description": "После смерти отца Николас Никльби по воле богатого дяди становится учителем в йоркширской школе для мальчиков. Столкнувшись с жестоким обращением с воспитанниками, он покидает школу вместе со Смайком, отказываясь принять порядки, превращающие детство в мучение.",
        "sourceLanguage": "ru",
        "status": "reviewed",
        "sourceUrls": [
          "https://azbooka.ru/books/zhizn-i-priklyucheniya-nikolasa-niklbi",
          "https://www.penguinrandomhouse.com/books/40454/nicholas-nickleby-by-charles-dickens-introduction-by-john-carey/",
          "https://www.penguin.co.uk/books/34302/nicholas-nickleby-by-dickens-charles/9780141920221",
          "https://search.rsl.ru/ru/record/01005000738",
          "https://ast.ru/book/zhizn-i-priklyucheniya-nikolasa-niklbi-015562/"
        ],
        "method": "editorial-original",
        "reviewedAt": "2026-09-12",
        "descriptionProvenance": {
          "origin": "official-source-synthesis",
          "sourceLanguage": "ru",
          "sourceCountry": "england",
          "sourceUrls": [
            "https://azbooka.ru/books/zhizn-i-priklyucheniya-nikolasa-niklbi",
            "https://www.penguinrandomhouse.com/books/40454/nicholas-nickleby-by-charles-dickens-introduction-by-john-carey/",
            "https://www.penguin.co.uk/books/34302/nicholas-nickleby-by-dickens-charles/9780141920221"
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
          "reviewedBy": "Codex AI /root/article_counts (independent editorial review)",
          "reviewedAt": "2026-09-12"
        }
      },
      "en": {
        "locale": "en",
        "title": "Nicholas Nickleby",
        "description": "After his father's death leaves the family penniless, Nicholas Nickleby turns to Uncle Ralph for help, only to find an enemy determined to persecute him. Work at a brutal boys' school and adventures with a theatrical family carry Nicholas through a world in which generosity struggles against exploitation.",
        "sourceLanguage": "en",
        "status": "reviewed",
        "sourceUrls": [
          "https://www.penguinrandomhouse.com/books/40454/nicholas-nickleby-by-charles-dickens-introduction-by-john-carey/",
          "https://azbooka.ru/books/zhizn-i-priklyucheniya-nikolasa-niklbi",
          "https://www.penguin.co.uk/books/34302/nicholas-nickleby-by-dickens-charles/9780141920221",
          "https://lccn.loc.gov/2003269677/marcxml"
        ],
        "method": "editorial-original",
        "reviewedAt": "2026-09-12",
        "descriptionProvenance": {
          "origin": "official-source-synthesis",
          "sourceLanguage": "en",
          "sourceCountry": "england",
          "sourceUrls": [
            "https://azbooka.ru/books/zhizn-i-priklyucheniya-nikolasa-niklbi",
            "https://www.penguinrandomhouse.com/books/40454/nicholas-nickleby-by-charles-dickens-introduction-by-john-carey/",
            "https://www.penguin.co.uk/books/34302/nicholas-nickleby-by-dickens-charles/9780141920221"
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
          "reviewedBy": "Codex AI /root/article_counts (independent editorial review)",
          "reviewedAt": "2026-09-12"
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
        "recordId": "ISBN-9785389201842",
        "url": "https://azbooka.ru/books/zhizn-i-priklyucheniya-nikolasa-niklbi",
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
        "language": "English",
        "recordKind": "publisher-catalog",
        "recordId": "ISBN-9780679423072",
        "url": "https://www.penguinrandomhouse.com/books/40454/nicholas-nickleby-by-charles-dickens-introduction-by-john-carey/",
        "fields": [
          "identity",
          "authorship",
          "description",
          "title",
          "language",
          "market",
          "publication-year"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05",
        "market": "US"
      },
      {
        "provider": "penguin-books-uk",
        "authorityId": "penguin-uk",
        "authorityTier": "B",
        "country": "england",
        "language": "en",
        "market": "GB",
        "recordKind": "publisher-catalog",
        "recordId": "ISBN-9780141920221",
        "url": "https://www.penguin.co.uk/books/34302/nicholas-nickleby-by-dickens-charles/9780141920221",
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
        "recordId": "01005000738",
        "recordKind": "national-bibliography",
        "url": "https://search.rsl.ru/ru/record/01005000738",
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
        "recordId": "ISBN-9785170727957",
        "recordKind": "publisher-catalog",
        "url": "https://ast.ru/book/zhizn-i-priklyucheniya-nikolasa-niklbi-015562/",
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
        "recordId": "LCCN-2003269677",
        "recordKind": "national-bibliography",
        "url": "https://lccn.loc.gov/2003269677/marcxml",
        "language": "English",
        "market": "US",
        "fields": [
          "identity",
          "authorship",
          "title",
          "language",
          "market",
          "original-title"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "Charles Dickens Museum",
        "country": "england",
        "language": "en",
        "recordKind": "authoritative-work-page",
        "url": "https://dickensmuseum.com/blogs/explore/nicholas-nickleby-manuscript",
        "fields": [
          "publication-year"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-12"
      }
    ],
    "editorial": {
      "status": "reviewed",
      "reviewedAt": "2026-09-12"
    }
  },
  "england:charles_dickens:openlibrary-works-ol8300174w": {
    "firstPublished": 1841,
    "originalTitle": "Barnaby Rudge",
    "originalLanguage": "English",
    "description": "Во время антикатолического мятежа в Лондоне 1780 года простодушный Барнеби Радж оказывается втянут в массовое насилие. Религиозная вражда переплетается с историей влюблённых из враждующих семей и тайной давних убийств, связывающей настоящее героев с их прошлым.",
    "localizedTitles": {
      "ru": {
        "entityKind": "expression",
        "expressionId": "england:charles_dickens:openlibrary-works-ol8300174w:ru",
        "locale": "ru",
        "value": "Барнеби Радж",
        "status": "verified-published",
        "expressionLanguage": "Russian",
        "market": "RU",
        "selectionRule": "current-complete-authorized-edition",
        "selectionNote": "Actual national catalog and independent publisher establish this published title spelling. Different print editions and first-publication chronology are recorded separately.",
        "evidence": [
          {
            "entityKind": "manifestation",
            "manifestationId": "rsl-01005592950",
            "sourceUrl": "https://search.rsl.ru/ru/record/01005592950",
            "provider": "russian-state-library",
            "authorityId": "rsl",
            "authorityTier": "A",
            "recordKind": "national-bibliography",
            "recordId": "01005592950",
            "catalogTitleExact": "Собрание сочинений",
            "locale": "ru",
            "market": "RU",
            "expressionLanguage": "Russian",
            "publisher": "Гослитиздат",
            "publicationYear": 1958,
            "editionStatement": "Actual indexed primary catalog Состав section, volume8: Барнеби Радж; Роман; translation M.E.Abkina; commentary Yu.Kagarlitsky;1958,767 pages. This is the catalog's explicit contents note for the30-volume set1957–1963, not an alleged MARC505 or a separately opened child record. Only the named novel in volume8 is identified; the full collected works are not equated with one novel.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)",
            "titleRelation": "contained-work",
            "analyticTitleExact": "Барнеби Радж",
            "containerTitleExact": "Собрание сочинений",
            "containedInField": "contents-note",
            "translator": "М. Е. Абкина"
          },
          {
            "entityKind": "manifestation",
            "manifestationId": "azbooka-ISBN-9785389097254",
            "sourceUrl": "https://azbooka.ru/books/barnebi-radzh-hevz",
            "provider": "azbooka-atticus",
            "authorityId": "azbooka",
            "authorityTier": "B",
            "recordKind": "publisher-catalog",
            "recordId": "ISBN-9785389097254",
            "catalogTitleExact": "Барнеби Радж",
            "locale": "ru",
            "market": "RU",
            "expressionLanguage": "Russian",
            "publisher": "Азбука",
            "publicationYear": 2015,
            "editionStatement": "Actual publisher heading, ISBN,2015 and768 pages; own annotation dates the novel1841.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)",
            "isbn13": "9785389097254"
          }
        ]
      },
      "en": {
        "entityKind": "expression",
        "expressionId": "england:charles_dickens:openlibrary-works-ol8300174w:en",
        "locale": "en",
        "value": "Barnaby Rudge",
        "status": "verified-published",
        "expressionLanguage": "English",
        "market": "US",
        "selectionRule": "current-complete-authorized-edition",
        "selectionNote": "Actual national catalog and independent publisher establish this published title spelling. Different print editions and first-publication chronology are recorded separately.",
        "evidence": [
          {
            "entityKind": "manifestation",
            "manifestationId": "loc-LCCN-15020304",
            "sourceUrl": "https://lccn.loc.gov/15020304/marcxml",
            "provider": "library-of-congress",
            "authorityId": "loc",
            "authorityTier": "A",
            "recordKind": "national-bibliography",
            "recordId": "LCCN-15020304",
            "catalogTitleExact": "Barnaby Rudge",
            "locale": "en",
            "market": "US",
            "expressionLanguage": "English",
            "publisher": "Hurd and Houghton",
            "publicationYear": 1871,
            "editionStatement": "Complete primary MARCXML:245$a Barnaby Rudge.;260New York1871;3004volumes in1,18cm;008English. These are bound parts of the named novel, not four different works. Terminal ISBD period omitted.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)"
          },
          {
            "entityKind": "manifestation",
            "manifestationId": "penguin-random-house-ISBN-9780140437287",
            "sourceUrl": "https://www.penguinrandomhouse.com/books/286307/barnaby-rudge-by-charles-dickens/",
            "provider": "penguin-random-house",
            "authorityId": "penguin-random-house",
            "authorityTier": "B",
            "recordKind": "publisher-catalog",
            "recordId": "ISBN-9780140437287",
            "catalogTitleExact": "Barnaby Rudge",
            "locale": "en",
            "market": "US",
            "expressionLanguage": "English",
            "publisher": "Penguin Classics",
            "publicationYear": 2003,
            "editionStatement": "Own publisher title/product details:2003-04-29,768 pages; description explicitly based on the one-volume publication, with original illustrations and later preface appendices.",
            "retrievedAt": "2026-09-05",
            "checkedAt": "2026-09-05",
            "checkedBy": "Codex AI /root (bibliographic source review)",
            "isbn13": "9780140437287"
          }
        ]
      }
    },
    "translations": {
      "ru": {
        "locale": "ru",
        "title": "Барнеби Радж",
        "description": "Во время антикатолического мятежа в Лондоне 1780 года простодушный Барнеби Радж оказывается втянут в массовое насилие. Религиозная вражда переплетается с историей влюблённых из враждующих семей и тайной давних убийств, связывающей настоящее героев с их прошлым.",
        "sourceLanguage": "ru",
        "status": "reviewed",
        "sourceUrls": [
          "https://azbooka.ru/books/barnebi-radzh-hevz",
          "https://www.penguinrandomhouse.com/books/286307/barnaby-rudge-by-charles-dickens/",
          "https://www.penguin.co.uk/books/34458/barnaby-rudge-by-ed-john-bowen-charles-dickens/9780141903897",
          "https://search.rsl.ru/ru/record/01005592950"
        ],
        "method": "editorial-original",
        "reviewedAt": "2026-09-12",
        "descriptionProvenance": {
          "origin": "official-source-synthesis",
          "sourceLanguage": "ru",
          "sourceCountry": "england",
          "sourceUrls": [
            "https://azbooka.ru/books/barnebi-radzh-hevz",
            "https://www.penguinrandomhouse.com/books/286307/barnaby-rudge-by-charles-dickens/",
            "https://www.penguin.co.uk/books/34458/barnaby-rudge-by-ed-john-bowen-charles-dickens/9780141903897"
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
          "reviewedBy": "Codex AI /root/article_counts (independent editorial review)",
          "reviewedAt": "2026-09-12"
        }
      },
      "en": {
        "locale": "en",
        "title": "Barnaby Rudge",
        "description": "An old murder mystery and the troubled past of Barnaby Rudge become entangled with the Gordon Riots of 1780, as London descends into mob violence. Conflicts between families and between Protestants and Catholics give this historical novel the menace and suspense of a Gothic melodrama.",
        "sourceLanguage": "en",
        "status": "reviewed",
        "sourceUrls": [
          "https://www.penguinrandomhouse.com/books/286307/barnaby-rudge-by-charles-dickens/",
          "https://azbooka.ru/books/barnebi-radzh-hevz",
          "https://www.penguin.co.uk/books/34458/barnaby-rudge-by-ed-john-bowen-charles-dickens/9780141903897",
          "https://lccn.loc.gov/15020304/marcxml"
        ],
        "method": "editorial-original",
        "reviewedAt": "2026-09-12",
        "descriptionProvenance": {
          "origin": "official-source-synthesis",
          "sourceLanguage": "en",
          "sourceCountry": "england",
          "sourceUrls": [
            "https://azbooka.ru/books/barnebi-radzh-hevz",
            "https://www.penguinrandomhouse.com/books/286307/barnaby-rudge-by-charles-dickens/",
            "https://www.penguin.co.uk/books/34458/barnaby-rudge-by-ed-john-bowen-charles-dickens/9780141903897"
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
          "reviewedBy": "Codex AI /root/article_counts (independent editorial review)",
          "reviewedAt": "2026-09-12"
        }
      }
    },
    "sources": [
      {
        "provider": "azbooka-atticus",
        "authorityId": "azbooka",
        "authorityTier": "B",
        "country": "russia",
        "language": "Russian",
        "recordKind": "publisher-catalog",
        "recordId": "ISBN-9785389097254",
        "url": "https://azbooka.ru/books/barnebi-radzh-hevz",
        "fields": [
          "identity",
          "authorship",
          "description",
          "title",
          "language",
          "market",
          "publication-year"
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
        "recordId": "ISBN-9780140437287",
        "url": "https://www.penguinrandomhouse.com/books/286307/barnaby-rudge-by-charles-dickens/",
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
        "provider": "penguin-books-uk",
        "authorityId": "penguin-uk",
        "authorityTier": "B",
        "country": "england",
        "language": "en",
        "market": "GB",
        "recordKind": "publisher-catalog",
        "recordId": "ISBN-9780141903897",
        "url": "https://www.penguin.co.uk/books/34458/barnaby-rudge-by-ed-john-bowen-charles-dickens/9780141903897",
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
        "recordId": "01005592950",
        "recordKind": "national-bibliography",
        "url": "https://search.rsl.ru/ru/record/01005592950",
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
        "recordId": "LCCN-15020304",
        "recordKind": "national-bibliography",
        "url": "https://lccn.loc.gov/15020304/marcxml",
        "language": "English",
        "market": "US",
        "fields": [
          "identity",
          "authorship",
          "title",
          "language",
          "market",
          "original-title"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-05"
      },
      {
        "provider": "british-library",
        "authorityId": "british-library",
        "country": "england",
        "language": "en",
        "recordKind": "authoritative-work-page",
        "url": "https://searcharchives.bl.uk/?q=040-000001309&sort=hierarchy",
        "fields": [
          "publication-year"
        ],
        "usage": "reference-only",
        "retrievedAt": "2026-09-12"
      }
    ],
    "editorial": {
      "status": "reviewed",
      "reviewedAt": "2026-09-12"
    }
  }
};

export const bookR49nDickensReviewed20260912RecordKeys = Object.keys(reviewedProfiles);

function mergeSources(current: WorkSourceProfile[], additions: WorkSourceProfile[]) {
  const byUrl = new Map<string, WorkSourceProfile>();
  for (const source of [...current, ...additions]) {
    const key = source.url.trim();
    const existing = byUrl.get(key);
    byUrl.set(key, existing ? {
      ...existing, ...source,
      fields: [...new Set([...existing.fields, ...source.fields])],
    } : source);
  }
  return [...byUrl.values()];
}

export function applyBookR49nDickensReviewed20260912Work(
  countryId: string, writerId: string, work: WorkProfile
): WorkProfile {
  const reviewed = reviewedProfiles[`${countryId}:${writerId}:${work.id}`];
  if (!reviewed) return work;
  const translations = { ...work.translations };
  for (const locale of ["ru", "en"] as const) {
    const translation = reviewed.translations?.[locale];
    if (!translation) continue;
    translations[locale] = {
      ...work.translations?.[locale], ...translation,
      sourceUrls: [...new Set([...(work.translations?.[locale]?.sourceUrls || []), ...translation.sourceUrls])],
      titleEvidence: reviewed.localizedTitles?.[locale],
    };
  }
  // Only the reviewed bibliographic/text fields are copied. In particular the
  // caller's identity, cover rights, editions, genres and source route survive.
  return {
    ...work, ...reviewed, translations,
    localizedTitles: { ...work.localizedTitles, ...reviewed.localizedTitles },
    sources: mergeSources(work.sources || [], reviewed.sources || []),
  };
}
