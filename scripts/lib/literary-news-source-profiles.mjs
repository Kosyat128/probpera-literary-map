/** Code-owned destinations, promoted only after recorded bounded HTTP, runtime parser and item-detail probes. */
export const R10_SOURCE_PROFILES = [
{
  "id": "prh",
  "name": "Penguin Random House",
  "url": "https://global.penguinrandomhouse.com/feed/",
  "format": "rss",
  "language": "en-US",
  "region": "north-america",
  "sourceFamilyId": "penguin-random-house",
  "countryCodes": [
  "US"
],
  "coverageCountryCodes": [
  "US"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://global.penguinrandomhouse.com"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://global.penguinrandomhouse.com/announcements/celebrating-our-2026-national-book-award-longlisters/"
],
  "verifiedAt": "2026-09-26T17:27:26.341Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/", ""),
  "keywordPattern": new RegExp("(?:book|author|writ(?:er|ing)|literar|literat|poet|poes|novel|fiction|publish|translat|library|librar|archive|heritage|manuscript|exhibition|award|prize|festival|reading|pen |p[eé]n|книг|литерат|поэт|писател|изда(?:т|н)|перевод|библиот|преми|фестивал|чтен|наслед|рукопис|выстав|автор|роман|читател|livr[eo]|auteur|litt[eé]r|biblioth|[eé]di(?:t|c)|libro|autor|letr|bibliot|premio|feria|lectur|buch|b[üu]cher|schrift|verlag|lesung|buchpreis|boek|schrijver|uitgev|b[oö]cker|litter|f[oö]rfatt|forlag|kirj|raamat|knih|knji[žz]|knjig|libri|βιβλ|كتاب|مكتب|شعر|نشر|图书|圖書|文学|文學|書|本|출판|도서|문학|buku|penerbit)", "iu"),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "repository:scripts/lib/literary-news-sources.mjs",
  "organisation": "Penguin Random House",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Penguin Random House",
  "status": "organisation_country"
},
  "sourceClass": "existing",
  "evidenceReport": "reports/r10/sources/prh.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "nobel",
  "name": "NobelPrize.org",
  "url": "https://www.nobelprize.org/press-release/",
  "format": "html",
  "language": "en-US",
  "region": "europe",
  "sourceFamilyId": "nobel",
  "countryCodes": [
  "SE"
],
  "coverageCountryCodes": [
  "SE"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://www.nobelprize.org"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://www.nobelprize.org/press-release/the-2026-nobel-prize-announcements/"
],
  "verifiedAt": "2026-09-26T17:27:26.152Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/press-release\\/[^/]+\\/?$", ""),
  "pagination": {
  "allowedPathPattern": new RegExp("^\\/press-release\\/page\\/[1-9][0-9]{0,3}\\/$", ""),
  "nextSelector": "link[rel~=next][href]"
},
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "repository:scripts/lib/literary-news-sources.mjs",
  "organisation": "NobelPrize.org",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "NobelPrize.org",
  "status": "organisation_country"
},
  "sourceClass": "existing",
  "evidenceReport": "reports/r10/sources/nobel.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "german-book-prize",
  "name": "Deutscher Buchpreis",
  "url": "https://www.deutscher-buchpreis.de/news/",
  "format": "html",
  "language": "de",
  "region": "europe",
  "sourceFamilyId": "german-book-prize",
  "countryCodes": [
  "DE"
],
  "coverageCountryCodes": [
  "DE"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://www.deutscher-buchpreis.de"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://www.deutscher-buchpreis.de/news/eintrag/die-buchpreisbloggerinnen-2026/"
],
  "verifiedAt": "2026-09-26T17:27:27.062Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/news\\/eintrag\\/[^/]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "repository:scripts/lib/literary-news-sources.mjs",
  "organisation": "Deutscher Buchpreis",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Deutscher Buchpreis",
  "status": "organisation_country"
},
  "sourceClass": "existing",
  "evidenceReport": "reports/r10/sources/german-book-prize.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "frankfurt-book-fair",
  "name": "Frankfurter Buchmesse",
  "url": "https://www.buchmesse.de/en/press/press-releases",
  "format": "html",
  "language": "en",
  "region": "europe",
  "sourceFamilyId": "frankfurt-book-fair",
  "countryCodes": [
  "DE"
],
  "coverageCountryCodes": [
  "DE"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://www.buchmesse.de"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://www.buchmesse.de/en/press/press-releases/2026-09-24-book-screen-day-2026"
],
  "verifiedAt": "2026-09-26T17:27:26.558Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/en\\/press\\/press-releases\\/[^/]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "repository:scripts/lib/literary-news-sources.mjs",
  "organisation": "Frankfurter Buchmesse",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Frankfurter Buchmesse",
  "status": "organisation_country"
},
  "sourceClass": "existing",
  "evidenceReport": "reports/r10/sources/frankfurt-book-fair.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "gothenburg-book-fair",
  "name": "Bokmässan",
  "url": "https://bokmassan.se/hem/om-bokmassan/nyheter/",
  "format": "html",
  "language": "sv-SE",
  "region": "europe",
  "sourceFamilyId": "gothenburg-book-fair",
  "countryCodes": [
  "SE"
],
  "coverageCountryCodes": [
  "SE"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://bokmassan.se"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://bokmassan.se/2026/09/katarina-wennstam-tilldelas-crimetime-award-arets-hederspris-2026/"
],
  "verifiedAt": "2026-09-26T17:27:26.662Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/\\d{4}\\/\\d{2}\\/[^/]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "repository:scripts/lib/literary-news-sources.mjs",
  "organisation": "Bokmässan",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Bokmässan",
  "status": "organisation_country"
},
  "sourceClass": "existing",
  "evidenceReport": "reports/r10/sources/gothenburg-book-fair.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "british-library",
  "name": "British Library",
  "url": "https://www.bl.uk/about/press/releases",
  "format": "html",
  "language": "en",
  "region": "europe",
  "sourceFamilyId": "british-library",
  "countryCodes": [
  "GB"
],
  "coverageCountryCodes": [
  "GB"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://www.bl.uk"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://www.bl.uk/about/press/releases/british-library-announces-2026-food-season-awards-winners"
],
  "verifiedAt": "2026-09-26T17:27:27.645Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/about\\/press\\/releases\\/[^/]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "repository:scripts/lib/literary-news-sources.mjs",
  "organisation": "British Library",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "British Library",
  "status": "organisation_country"
},
  "sourceClass": "existing",
  "evidenceReport": "reports/r10/sources/british-library.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "bnf",
  "name": "Bibliothèque nationale de France",
  "url": "https://www.bnf.fr/fr/agenda",
  "format": "html",
  "language": "fr",
  "region": "europe",
  "sourceFamilyId": "bnf",
  "countryCodes": [
  "FR"
],
  "coverageCountryCodes": [
  "FR"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://www.bnf.fr"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://www.bnf.fr/fr/agenda/les-mercredis-de-loulipo"
],
  "verifiedAt": "2026-09-26T17:33:24.840Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/fr\\/agenda\\/[^/]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "repository:scripts/lib/literary-news-sources.mjs",
  "organisation": "Bibliothèque nationale de France",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Bibliothèque nationale de France",
  "status": "organisation_country"
},
  "sourceClass": "existing",
  "evidenceReport": "reports/r10/sources/bnf.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "goslitmuz",
  "name": "Гослитмузей / State Literary Museum",
  "url": "https://goslitmuz.ru/news/",
  "format": "html",
  "language": "ru",
  "region": "europe",
  "sourceFamilyId": "goslitmuz",
  "countryCodes": [
  "RU"
],
  "coverageCountryCodes": [
  "RU"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://goslitmuz.ru"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://goslitmuz.ru/news/gmirli/22413/"
],
  "verifiedAt": "2026-09-26T17:33:24.525Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/news\\/[^/]+\\/\\d+\\/?$", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "repository:scripts/lib/literary-news-sources.mjs",
  "organisation": "Гослитмузей / State Literary Museum",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Гослитмузей / State Literary Museum",
  "status": "organisation_country"
},
  "sourceClass": "existing",
  "evidenceReport": "reports/r10/sources/goslitmuz.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "yasnaya-polyana",
  "name": "Ясная Поляна / Yasnaya Polyana",
  "url": "https://ypmuseum.ru/events",
  "format": "html",
  "language": "ru",
  "region": "europe",
  "sourceFamilyId": "yasnaya-polyana",
  "countryCodes": [
  "RU"
],
  "coverageCountryCodes": [
  "RU"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://ypmuseum.ru"
],
  "parserVersion": "r10-source-profile-1",
  "articleContainer": ".slide",
  "titleSelector": ".event-title",
  "exampleArticleUrls": [
  "https://ypmuseum.ru/event/2004"
],
  "verifiedAt": "2026-09-26T17:33:24.701Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/event\\/\\d+\\/?$", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "repository:scripts/lib/literary-news-sources.mjs",
  "organisation": "Ясная Поляна / Yasnaya Polyana",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Ясная Поляна / Yasnaya Polyana",
  "status": "organisation_country"
},
  "sourceClass": "existing",
  "evidenceReport": "reports/r10/sources/yasnaya-polyana.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "national-book-foundation",
  "name": "National Book Foundation",
  "url": "https://www.nationalbook.org/all-story/",
  "format": "html",
  "language": "en-US",
  "region": "north-america",
  "sourceFamilyId": "national-book-foundation",
  "countryCodes": [
  "US"
],
  "coverageCountryCodes": [
  "US"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://www.nationalbook.org"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://www.nationalbook.org/longlist-for-the-2026-national-book-award-for-translated-literature/"
],
  "verifiedAt": "2026-09-26T17:27:28.702Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/(?!all-story\\/|national-book-awards\\/|other-prizes-honors\\/|lifetime-achievement\\/|programs\\/|public-programs\\/|events-calendar\\/|adventure\\/|donor-advised-funds\\/|leave-a-literary-legacy\\/|strategic-plan-|bridge-to-|donor-privacy-policy\\/|mission-history\\/|foundation-board-of-directors\\/|make-a-stock-donation\\/|contact\\/|about\\/|privacy-policy\\/|adventure-)[a-z0-9][a-z0-9-]+\\/?$", ""),
  "keywordPattern": new RegExp("announc|award|honore|literary|championing books", "iu"),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "repository:scripts/lib/literary-news-sources.mjs",
  "organisation": "National Book Foundation",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "National Book Foundation",
  "status": "organisation_country"
},
  "sourceClass": "existing",
  "evidenceReport": "reports/r10/sources/national-book-foundation.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "brooklyn-book-festival",
  "name": "Brooklyn Book Festival",
  "url": "https://brooklynbookfestival.org/event_type/festival-day/",
  "format": "html",
  "language": "en-US",
  "region": "north-america",
  "sourceFamilyId": "brooklyn-book-festival",
  "countryCodes": [
  "US"
],
  "coverageCountryCodes": [
  "US"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://brooklynbookfestival.org"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://brooklynbookfestival.org/event/2026-bobi-honoree-amitav-ghosh-in-conversation-with-nathaniel-rich/"
],
  "verifiedAt": "2026-09-26T17:33:26.921Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/event\\/[^/]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "repository:scripts/lib/literary-news-sources.mjs",
  "organisation": "Brooklyn Book Festival",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Brooklyn Book Festival",
  "status": "organisation_country"
},
  "sourceClass": "existing",
  "evidenceReport": "reports/r10/sources/brooklyn-book-festival.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "prh-library",
  "name": "Penguin Random House Library",
  "url": "https://penguinrandomhouselibrary.com/feed/",
  "format": "rss",
  "language": "en",
  "region": "north-america",
  "sourceFamilyId": "penguin-random-house",
  "countryCodes": [
  "US"
],
  "coverageCountryCodes": [
  "US"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://penguinrandomhouselibrary.com"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://penguinrandomhouselibrary.com/2026/09/25/simply-read-more-help-patrons-find-their-audiobook-even-more-fall-2026-must-listens/"
],
  "verifiedAt": "2026-09-26T17:27:29.872Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/", ""),
  "keywordPattern": new RegExp("(?:book|author|writ(?:er|ing)|literar|literat|poet|poes|novel|fiction|publish|translat|library|librar|archive|heritage|manuscript|exhibition|award|prize|festival|reading|pen |p[eé]n|книг|литерат|поэт|писател|изда(?:т|н)|перевод|библиот|преми|фестивал|чтен|наслед|рукопис|выстав|автор|роман|читател|livr[eo]|auteur|litt[eé]r|biblioth|[eé]di(?:t|c)|libro|autor|letr|bibliot|premio|feria|lectur|buch|b[üu]cher|schrift|verlag|lesung|buchpreis|boek|schrijver|uitgev|b[oö]cker|litter|f[oö]rfatt|forlag|kirj|raamat|knih|knji[žz]|knjig|libri|βιβλ|كتاب|مكتب|شعر|نشر|图书|圖書|文学|文學|書|本|출판|도서|문학|buku|penerbit)", "iu"),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "repository:scripts/lib/literary-news-sources.mjs",
  "organisation": "Penguin Random House Library",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Penguin Random House Library",
  "status": "organisation_country"
},
  "sourceClass": "existing",
  "evidenceReport": "reports/r10/sources/prh-library.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "pen-america",
  "name": "PEN America",
  "url": "https://pen.org/feed/",
  "format": "rss",
  "language": "en",
  "region": "north-america",
  "sourceFamilyId": "pen-america",
  "countryCodes": [
  "US"
],
  "coverageCountryCodes": [
  "US"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://pen.org"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://pen.org/florida-600-banned-books/"
],
  "verifiedAt": "2026-09-26T17:27:29.197Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/", ""),
  "keywordPattern": new RegExp("(?:book|author|writ(?:er|ing)|literar|literat|poet|poes|novel|fiction|publish|translat|library|librar|archive|heritage|manuscript|exhibition|award|prize|festival|reading|pen |p[eé]n|книг|литерат|поэт|писател|изда(?:т|н)|перевод|библиот|преми|фестивал|чтен|наслед|рукопис|выстав|автор|роман|читател|livr[eo]|auteur|litt[eé]r|biblioth|[eé]di(?:t|c)|libro|autor|letr|bibliot|premio|feria|lectur|buch|b[üu]cher|schrift|verlag|lesung|buchpreis|boek|schrijver|uitgev|b[oö]cker|litter|f[oö]rfatt|forlag|kirj|raamat|knih|knji[žz]|knjig|libri|βιβλ|كتاب|مكتب|شعر|نشر|图书|圖書|文学|文學|書|本|출판|도서|문학|buku|penerbit)", "iu"),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "repository:scripts/lib/literary-news-sources.mjs",
  "organisation": "PEN America",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "PEN America",
  "status": "organisation_country"
},
  "sourceClass": "existing",
  "evidenceReport": "reports/r10/sources/pen-america.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "literary-arts",
  "name": "Literary Arts",
  "url": "https://literary-arts.org/feed/",
  "format": "rss",
  "language": "en",
  "region": "north-america",
  "sourceFamilyId": "literary-arts",
  "countryCodes": [
  "US"
],
  "coverageCountryCodes": [
  "US"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://literary-arts.org"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://literary-arts.org/2026/03/2025-portland-book-festival-audiobook/"
],
  "verifiedAt": "2026-09-26T17:27:30.785Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/", ""),
  "keywordPattern": new RegExp("(?:book|author|writ(?:er|ing)|literar|literat|poet|poes|novel|fiction|publish|translat|library|librar|archive|heritage|manuscript|exhibition|award|prize|festival|reading|pen |p[eé]n|книг|литерат|поэт|писател|изда(?:т|н)|перевод|библиот|преми|фестивал|чтен|наслед|рукопис|выстав|автор|роман|читател|livr[eo]|auteur|litt[eé]r|biblioth|[eé]di(?:t|c)|libro|autor|letr|bibliot|premio|feria|lectur|buch|b[üu]cher|schrift|verlag|lesung|buchpreis|boek|schrijver|uitgev|b[oö]cker|litter|f[oö]rfatt|forlag|kirj|raamat|knih|knji[žz]|knjig|libri|βιβλ|كتاب|مكتب|شعر|نشر|图书|圖書|文学|文學|書|本|출판|도서|문학|buku|penerbit)", "iu"),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "repository:scripts/lib/literary-news-sources.mjs",
  "organisation": "Literary Arts",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Literary Arts",
  "status": "organisation_country"
},
  "sourceClass": "existing",
  "evidenceReport": "reports/r10/sources/literary-arts.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "aaww",
  "name": "Asian American Writers’ Workshop",
  "url": "https://aaww.org/feed/",
  "format": "rss",
  "language": "en",
  "region": "north-america",
  "sourceFamilyId": "aaww",
  "countryCodes": [
  "US"
],
  "coverageCountryCodes": [
  "US"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://aaww.org"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://aaww.org/into-the-ocean/"
],
  "verifiedAt": "2026-09-26T17:27:32.554Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "repository:scripts/lib/literary-news-sources.mjs",
  "organisation": "Asian American Writers’ Workshop",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Asian American Writers’ Workshop",
  "status": "organisation_country"
},
  "sourceClass": "existing",
  "evidenceReport": "reports/r10/sources/aaww.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "ubud-writers-readers-festival",
  "name": "Ubud Writers & Readers Festival",
  "url": "https://ubudwritersfestival.com/news",
  "format": "html",
  "language": "en",
  "region": "asia",
  "sourceFamilyId": "ubud-writers-readers-festival",
  "countryCodes": [
  "ID"
],
  "coverageCountryCodes": [
  "ID"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://ubudwritersfestival.com",
  "https://www.ubudwritersfestival.com"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://ubudwritersfestival.com/news/ubud-writers-and-readers-festival-reveals-main-program-2025-four-days-of-conversations-from-booker-prize-winners-to-emerging-voices"
],
  "verifiedAt": "2026-09-26T17:27:33.149Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/news\\/[^/?#]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "repository:scripts/lib/literary-news-sources.mjs",
  "organisation": "Ubud Writers & Readers Festival",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Ubud Writers & Readers Festival",
  "status": "organisation_country"
},
  "sourceClass": "existing",
  "evidenceReport": "reports/r10/sources/ubud-writers-readers-festival.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "shanghai-childrens-book-fair",
  "name": "Shanghai International Children’s Book Fair",
  "url": "https://www.ccbookfair.com/en/index/news-center/news",
  "format": "html",
  "language": "en",
  "region": "asia",
  "sourceFamilyId": "shanghai-childrens-book-fair",
  "countryCodes": [
  "CN"
],
  "coverageCountryCodes": [
  "CN"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://ccbookfair.com",
  "https://www.ccbookfair.com"
],
  "parserVersion": "r10-source-profile-1",
  "articleContainer": ".card-item",
  "titleSelector": "h3.title",
  "exampleArticleUrls": [
  "https://www.ccbookfair.com/en/index/news-center/news/detail!ccbf2026-opencall"
],
  "verifiedAt": "2026-09-26T17:27:33.952Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/en\\/index\\/news-center\\/news\\/detail(?:!|%21)[^/?#]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "repository:scripts/lib/literary-news-sources.mjs",
  "organisation": "Shanghai International Children’s Book Fair",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Shanghai International Children’s Book Fair",
  "status": "organisation_country"
},
  "sourceClass": "existing",
  "evidenceReport": "reports/r10/sources/shanghai-childrens-book-fair.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "ake-arts-book-festival",
  "name": "Aké Arts & Book Festival",
  "url": "https://akefestival.org/feed/",
  "format": "rss",
  "language": "en",
  "region": "africa",
  "sourceFamilyId": "ake-arts-book-festival",
  "countryCodes": [
  "NG"
],
  "coverageCountryCodes": [
  "NG"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://akefestival.org"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://akefestival.org/ake-festivals-book-chats-are-second-to-none/"
],
  "verifiedAt": "2026-09-26T17:27:37.434Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/", ""),
  "keywordPattern": new RegExp("(?:book|author|writ(?:er|ing)|literar|literat|poet|poes|novel|fiction|publish|translat|library|librar|archive|heritage|manuscript|exhibition|award|prize|festival|reading|pen |p[eé]n|книг|литерат|поэт|писател|изда(?:т|н)|перевод|библиот|преми|фестивал|чтен|наслед|рукопис|выстав|автор|роман|читател|livr[eo]|auteur|litt[eé]r|biblioth|[eé]di(?:t|c)|libro|autor|letr|bibliot|premio|feria|lectur|buch|b[üu]cher|schrift|verlag|lesung|buchpreis|boek|schrijver|uitgev|b[oö]cker|litter|f[oö]rfatt|forlag|kirj|raamat|knih|knji[žz]|knjig|libri|βιβλ|كتاب|مكتب|شعر|نشر|图书|圖書|文学|文學|書|本|출판|도서|문학|buku|penerbit)", "iu"),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "repository:scripts/lib/literary-news-sources.mjs",
  "organisation": "Aké Arts & Book Festival",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Aké Arts & Book Festival",
  "status": "organisation_country"
},
  "sourceClass": "existing",
  "evidenceReport": "reports/r10/sources/ake-arts-book-festival.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "kenya-publishers-association",
  "name": "Kenya Publishers Association",
  "url": "https://kenyapublishers.org/category/news/feed/",
  "format": "rss",
  "language": "en",
  "region": "africa",
  "sourceFamilyId": "kenya-publishers-association",
  "countryCodes": [
  "KE"
],
  "coverageCountryCodes": [
  "KE"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://kenyapublishers.org"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://kenyapublishers.org/2026/05/06/meru-regional-book-fair-2026/"
],
  "verifiedAt": "2026-09-26T17:27:39.178Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/", ""),
  "keywordPattern": new RegExp("(?:book|author|writ(?:er|ing)|literar|literat|poet|poes|novel|fiction|publish|translat|library|librar|archive|heritage|manuscript|exhibition|award|prize|festival|reading|pen |p[eé]n|книг|литерат|поэт|писател|изда(?:т|н)|перевод|библиот|преми|фестивал|чтен|наслед|рукопис|выстав|автор|роман|читател|livr[eo]|auteur|litt[eé]r|biblioth|[eé]di(?:t|c)|libro|autor|letr|bibliot|premio|feria|lectur|buch|b[üu]cher|schrift|verlag|lesung|buchpreis|boek|schrijver|uitgev|b[oö]cker|litter|f[oö]rfatt|forlag|kirj|raamat|knih|knji[žz]|knjig|libri|βιβλ|كتاب|مكتب|شعر|نشر|图书|圖書|文学|文學|書|本|출판|도서|문학|buku|penerbit)", "iu"),
  "countryEvidence": {
  "method": "official_membership_directory",
  "url": "repository:scripts/lib/literary-news-sources.mjs",
  "organisation": "Kenya Publishers Association",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Kenya Publishers AssociationPO Box 4276700100-GPO NairobiKenyawww.kenyapublishers.org",
  "status": "organisation_country"
},
  "sourceClass": "existing",
  "evidenceReport": "reports/r10/sources/kenya-publishers-association.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "fil-guadalajara",
  "name": "FIL Guadalajara",
  "url": "https://fil.com.mx/prensa/recientes.asp?ids=1",
  "format": "html",
  "language": "es",
  "region": "latin-america",
  "sourceFamilyId": "fil-guadalajara",
  "countryCodes": [
  "MX"
],
  "coverageCountryCodes": [
  "MX"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://fil.com.mx",
  "https://www.fil.com.mx"
],
  "parserVersion": "r10-source-profile-1",
  "encoding": "windows-1252",
  "exampleArticleUrls": [
  "https://fil.com.mx/prensa/boletin.asp?id=3342&ids=1"
],
  "verifiedAt": "2026-09-27T14:10:04.549Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-27. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/prensa\\/boletin\\.asp$", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "repository:scripts/lib/literary-news-sources.mjs",
  "organisation": "FIL Guadalajara",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "FIL Guadalajara",
  "status": "organisation_country"
},
  "sourceClass": "existing",
  "evidenceReport": "reports/r10/sources/fil-guadalajara.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "brisbane-writers-festival",
  "name": "Brisbane Writers Festival",
  "url": "https://bwf.org.au/news/articles",
  "format": "html",
  "language": "en",
  "region": "oceania",
  "sourceFamilyId": "brisbane-writers-festival",
  "countryCodes": [
  "AU"
],
  "coverageCountryCodes": [
  "AU"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://bwf.org.au"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://bwf.org.au/news/articles/read-the-winning-entries-of-the-2025-microfiction-competition"
],
  "verifiedAt": "2026-09-26T17:27:40.214Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/news\\/articles\\/[^/?#]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "repository:scripts/lib/literary-news-sources.mjs",
  "organisation": "Brisbane Writers Festival",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Brisbane Writers Festival",
  "status": "organisation_country"
},
  "sourceClass": "existing",
  "evidenceReport": "reports/r10/sources/brisbane-writers-festival.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "nz-children-young-adults-book-awards",
  "name": "New Zealand Book Awards Trust - Children and Young Adults",
  "url": "https://www.nzbookawards.nz/new-zealand-book-awards-for-children-and-young-adults/news/",
  "format": "html",
  "language": "en",
  "region": "oceania",
  "sourceFamilyId": "nz-children-young-adults-book-awards",
  "countryCodes": [
  "NZ"
],
  "coverageCountryCodes": [
  "NZ"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://www.nzbookawards.nz"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://www.nzbookawards.nz/new-zealand-book-awards-for-children-and-young-adults/news/emerging-voices-recognised-alongside-established-writers-in-2026-childrens-book-awards-shortlist/53438?pageNum=1"
],
  "verifiedAt": "2026-09-26T17:27:42.108Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/new-zealand-book-awards-for-children-and-young-adults\\/news\\/[^/?#]+\\/[0-9]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "repository:scripts/lib/literary-news-sources.mjs",
  "organisation": "New Zealand Book Awards Trust - Children and Young Adults",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "New Zealand Book Awards Trust - Children and Young Adults",
  "status": "organisation_country"
},
  "sourceClass": "existing",
  "evidenceReport": "reports/r10/sources/nz-children-young-adults-book-awards.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "word-christchurch",
  "name": "WORD Christchurch",
  "url": "https://wordchristchurch.co.nz/news",
  "format": "html",
  "language": "en",
  "region": "oceania",
  "sourceFamilyId": "word-christchurch",
  "countryCodes": [
  "NZ"
],
  "coverageCountryCodes": [
  "NZ"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://wordchristchurch.co.nz"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://wordchristchurch.co.nz/news/2026-launch-gallery"
],
  "verifiedAt": "2026-09-26T17:27:42.327Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/news\\/[^/?#]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "repository:scripts/lib/literary-news-sources.mjs",
  "organisation": "WORD Christchurch",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "WORD Christchurch",
  "status": "organisation_country"
},
  "sourceClass": "existing",
  "evidenceReport": "reports/r10/sources/word-christchurch.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "federacioneditores-org",
  "name": "FGEE",
  "url": "https://federacioneditores.org/feed/",
  "format": "rss",
  "language": "es",
  "region": "europe",
  "sourceFamilyId": "federacioneditores-org",
  "countryCodes": [
  "ES"
],
  "coverageCountryCodes": [
  "ES"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://federacioneditores.org"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://federacioneditores.org/liber-2025-debate-la-sostenibilidad-del-sector-del-libro-en-un-contexto-de-innovacion-tecnologica/"
],
  "verifiedAt": "2026-09-26T17:27:48.392Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/", ""),
  "keywordPattern": new RegExp("(?:book|author|writ(?:er|ing)|literar|literat|poet|poes|novel|fiction|publish|translat|library|librar|archive|heritage|manuscript|exhibition|award|prize|festival|reading|pen |p[eé]n|книг|литерат|поэт|писател|изда(?:т|н)|перевод|библиот|преми|фестивал|чтен|наслед|рукопис|выстав|автор|роман|читател|livr[eo]|auteur|litt[eé]r|biblioth|[eé]di(?:t|c)|libro|autor|letr|bibliot|premio|feria|lectur|buch|b[üu]cher|schrift|verlag|lesung|buchpreis|boek|schrijver|uitgev|b[oö]cker|litter|f[oö]rfatt|forlag|kirj|raamat|knih|knji[žz]|knjig|libri|βιβλ|كتاب|مكتب|شعر|نشر|图书|圖書|文学|文學|書|本|출판|도서|문학|buku|penerbit)", "iu"),
  "countryEvidence": {
  "method": "official_membership_directory",
  "url": "https://internationalpublishers.org/about/",
  "organisation": "FGEE",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Federación de Gremios de Editores de EspañaCea Bermúdez 44 2° Dcha28003 MadridSpainwww.federacioneditores.org",
  "status": "organisation_country"
},
  "sourceClass": "publishing-association",
  "evidenceReport": "reports/r10/sources/federacioneditores-org.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "mabopa-com-my",
  "name": "Malaysian Book Publishers Association (MABOPA)",
  "url": "https://www.mabopa.com.my/feed/",
  "format": "rss",
  "language": "en-GB",
  "region": "asia",
  "sourceFamilyId": "mabopa-com-my",
  "countryCodes": [
  "MY"
],
  "coverageCountryCodes": [
  "MY"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://www.mabopa.com.my"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://www.mabopa.com.my/2020/05/03/world_book_day_-_international_publishers_authors_and_booksellers_statement/"
],
  "verifiedAt": "2026-09-26T17:27:47.985Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/", ""),
  "keywordPattern": new RegExp("(?:book|author|writ(?:er|ing)|literar|literat|poet|poes|novel|fiction|publish|translat|library|librar|archive|heritage|manuscript|exhibition|award|prize|festival|reading|pen |p[eé]n|книг|литерат|поэт|писател|изда(?:т|н)|перевод|библиот|преми|фестивал|чтен|наслед|рукопис|выстав|автор|роман|читател|livr[eo]|auteur|litt[eé]r|biblioth|[eé]di(?:t|c)|libro|autor|letr|bibliot|premio|feria|lectur|buch|b[üu]cher|schrift|verlag|lesung|buchpreis|boek|schrijver|uitgev|b[oö]cker|litter|f[oö]rfatt|forlag|kirj|raamat|knih|knji[žz]|knjig|libri|βιβλ|كتاب|مكتب|شعر|نشر|图书|圖書|文学|文學|書|本|출판|도서|문학|buku|penerbit)", "iu"),
  "countryEvidence": {
  "method": "official_membership_directory",
  "url": "https://internationalpublishers.org/about/",
  "organisation": "Malaysian Book Publishers Association (MABOPA)",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "President of the Malaysian Book Publishers Association (MABOPA) and ASEAN Book Publishers Association (ABPA).",
  "status": "organisation_country"
},
  "sourceClass": "publishing-association",
  "evidenceReport": "reports/r10/sources/mabopa-com-my.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "aseanbookpublishers-org",
  "name": "ASEAN Book Publishers Association (ABPA)",
  "url": "https://aseanbookpublishers.org/feed/",
  "format": "rss",
  "language": "en-US",
  "region": "asia",
  "sourceFamilyId": "aseanbookpublishers-org",
  "countryCodes": [
  "MY"
],
  "coverageCountryCodes": [
  "MY"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://aseanbookpublishers.org"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://aseanbookpublishers.org/singapore-book-bazaar/"
],
  "verifiedAt": "2026-09-26T17:27:49.148Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/", ""),
  "keywordPattern": new RegExp("(?:book|author|writ(?:er|ing)|literar|literat|poet|poes|novel|fiction|publish|translat|library|librar|archive|heritage|manuscript|exhibition|award|prize|festival|reading|pen |p[eé]n|книг|литерат|поэт|писател|изда(?:т|н)|перевод|библиот|преми|фестивал|чтен|наслед|рукопис|выстав|автор|роман|читател|livr[eo]|auteur|litt[eé]r|biblioth|[eé]di(?:t|c)|libro|autor|letr|bibliot|premio|feria|lectur|buch|b[üu]cher|schrift|verlag|lesung|buchpreis|boek|schrijver|uitgev|b[oö]cker|litter|f[oö]rfatt|forlag|kirj|raamat|knih|knji[žz]|knjig|libri|βιβλ|كتاب|مكتب|شعر|نشر|图书|圖書|文学|文學|書|本|출판|도서|문학|buku|penerbit)", "iu"),
  "countryEvidence": {
  "method": "official_membership_directory",
  "url": "https://internationalpublishers.org/about/",
  "organisation": "ASEAN Book Publishers Association (ABPA)",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "President of the Malaysian Book Publishers Association (MABOPA) and ASEAN Book Publishers Association (ABPA).",
  "status": "organisation_country"
},
  "sourceClass": "publishing-association",
  "evidenceReport": "reports/r10/sources/aseanbookpublishers-org.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "anel-qc-ca",
  "name": "ANEL",
  "url": "https://www.anel.qc.ca/",
  "format": "html",
  "language": "fr-CA",
  "region": "north-america",
  "sourceFamilyId": "anel-qc-ca",
  "countryCodes": [
  "CA"
],
  "coverageCountryCodes": [
  "CA"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://www.anel.qc.ca"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://www.anel.qc.ca/dossiers-et-enjeux/innovation-technologie/commercialiser-des-livres-numeriques-accessibles-en-europe-en-2025/"
],
  "verifiedAt": "2026-09-26T17:27:49.584Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/dossiers-et-enjeux\\/[^/]+\\/?$|^\\/[^/]{12,}\\/?$|^\\/dossiers-et-enjeux\\/projets\\/[^/]+\\/?$|^\\/dossiers-et-enjeux\\/projets\\/strongprix-litteraires-des-enseignant-e-s-de-francais-2024-strong\\/[^/]+\\/?$|^\\/dossiers-et-enjeux\\/innovation-technologie\\/[^/]+\\/?$|^\\/dossiers-et-enjeux\\/droit-dauteur\\/[^/]+\\/?$", ""),
  "keywordPattern": new RegExp("(?:book|author|writ(?:er|ing)|literar|literat|poet|poes|novel|fiction|publish|translat|library|librar|archive|heritage|manuscript|exhibition|award|prize|festival|reading|pen |p[eé]n|книг|литерат|поэт|писател|изда(?:т|н)|перевод|библиот|преми|фестивал|чтен|наслед|рукопис|выстав|автор|роман|читател|livr[eo]|auteur|litt[eé]r|biblioth|[eé]di(?:t|c)|libro|autor|letr|bibliot|premio|feria|lectur|buch|b[üu]cher|schrift|verlag|lesung|buchpreis|boek|schrijver|uitgev|b[oö]cker|litter|f[oö]rfatt|forlag|kirj|raamat|knih|knji[žz]|knjig|libri|βιβλ|كتاب|مكتب|شعر|نشر|图书|圖書|文学|文學|書|本|출판|도서|문학|buku|penerbit)", "iu"),
  "countryEvidence": {
  "method": "official_membership_directory",
  "url": "https://internationalpublishers.org/about/",
  "organisation": "ANEL",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Association Nationale des Editeurs de Livres2514 Boulevard Rosemont. Montréal H1Y1K4. Québecwww.anel.qc.ca Assn. of Canadian Publishers – 174 Spadina Avenue. Suite 306. Toronto ON M5T 2C2.www.publishe",
  "status": "organisation_country"
},
  "sourceClass": "publishing-association",
  "evidenceReport": "reports/r10/sources/anel-qc-ca.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "kiwi-verlag-de",
  "name": "Kiepenheuer & Witsch",
  "url": "https://www.kiwi-verlag.de/",
  "format": "html",
  "language": "de",
  "region": "europe",
  "sourceFamilyId": "kiwi-verlag-de",
  "countryCodes": [
  "DE"
],
  "coverageCountryCodes": [
  "DE"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://www.kiwi-verlag.de"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://www.kiwi-verlag.de/magazin/ausgezeichnet/shida-bazyar-erhaelt-den-wilhelm-raabe-literaturpreis-2026"
],
  "verifiedAt": "2026-09-26T17:27:49.323Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/[^/]{12,}\\/?$|^\\/buch\\/[^/]+\\/?$|^\\/buch\\/literatur-unterhaltung\\/[^/]+\\/?$|^\\/verlag\\/[^/]+\\/?$|^\\/magazin\\/ausgezeichnet\\/[^/]+\\/?$", ""),
  "keywordPattern": new RegExp("(?:book|author|writ(?:er|ing)|literar|literat|poet|poes|novel|fiction|publish|translat|library|librar|archive|heritage|manuscript|exhibition|award|prize|festival|reading|pen |p[eé]n|книг|литерат|поэт|писател|изда(?:т|н)|перевод|библиот|преми|фестивал|чтен|наслед|рукопис|выстав|автор|роман|читател|livr[eo]|auteur|litt[eé]r|biblioth|[eé]di(?:t|c)|libro|autor|letr|bibliot|premio|feria|lectur|buch|b[üu]cher|schrift|verlag|lesung|buchpreis|boek|schrijver|uitgev|b[oö]cker|litter|f[oö]rfatt|forlag|kirj|raamat|knih|knji[žz]|knjig|libri|βιβλ|كتاب|مكتب|شعر|نشر|图书|圖書|文学|文學|書|本|출판|도서|문학|buku|penerbit)", "iu"),
  "countryEvidence": {
  "method": "official_membership_directory",
  "url": "https://internationalpublishers.org/about/",
  "organisation": "Kiepenheuer & Witsch",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Deputy publisher and a member of the management board of Kiepenheuer & Witsch.",
  "status": "organisation_country"
},
  "sourceClass": "publishing-association",
  "evidenceReport": "reports/r10/sources/kiwi-verlag-de.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "press-princeton-edu",
  "name": "Princeton University Press",
  "url": "https://press.princeton.edu/",
  "format": "html",
  "language": "en",
  "region": "north-america",
  "sourceFamilyId": "press-princeton-edu",
  "countryCodes": [
  "US"
],
  "coverageCountryCodes": [
  "US"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://press.princeton.edu"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://press.princeton.edu/news/bartz-v-anthropic"
],
  "verifiedAt": "2026-09-26T17:27:49.783Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/books\\/hardcover\\/9780691284439\\/[^/]+\\/?$|^\\/imprints\\/[^/]+\\/?$|^\\/ideas\\/[^/]+\\/?$|^\\/our-authors\\/[^/]+\\/?$|^\\/[^/]{12,}\\/?$|^\\/news\\/.+", ""),
  "countryEvidence": {
  "method": "official_membership_directory",
  "url": "https://internationalpublishers.org/about/",
  "organisation": "Princeton University Press",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Director of Princeton University Press.",
  "status": "organisation_country"
},
  "sourceClass": "publishing-association",
  "evidenceReport": "reports/r10/sources/press-princeton-edu.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "turkyaybir-org-tr",
  "name": "Turkish Publishers Association",
  "url": "https://turkyaybir.org.tr/feed/",
  "format": "rss",
  "language": "tr-TR",
  "region": "europe",
  "sourceFamilyId": "turkyaybir-org-tr",
  "countryCodes": [
  "TR"
],
  "coverageCountryCodes": [
  "TR"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://turkyaybir.org.tr"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://turkyaybir.org.tr/2025-yili-turkiye-kitap-pazari-raporu/"
],
  "verifiedAt": "2026-09-26T17:27:55.924Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/", ""),
  "countryEvidence": {
  "method": "official_membership_directory",
  "url": "https://internationalpublishers.org/about/",
  "organisation": "Turkish Publishers Association",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Turkish Publishers Associationİnonu Caddesi Opera Palas Apt 55 D.234437 Gümüssuyu- Beyoğlu / İstanbulTurkeywww.turkyaybir.org.tr",
  "status": "organisation_country"
},
  "sourceClass": "publishing-association",
  "evidenceReport": "reports/r10/sources/turkyaybir-org-tr.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "sne-fr",
  "name": "Syndicat National de l’Edition",
  "url": "https://www.sne.fr/",
  "format": "html",
  "language": "fr-FR",
  "region": "europe",
  "sourceFamilyId": "sne-fr",
  "countryCodes": [
  "FR"
],
  "coverageCountryCodes": [
  "FR"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://www.sne.fr"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://www.sne.fr/actu/ledition-en-perspective-le-rapport-dactivite-du-syndicat-national-de-ledition-2025-2026-est-disponible/"
],
  "verifiedAt": "2026-09-26T17:27:51.430Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/[^/]{12,}\\/?$|^\\/actu\\/[^/]+\\/?$|^\\/evenement_sne\\/[^/]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_membership_directory",
  "url": "https://internationalpublishers.org/about/",
  "organisation": "Syndicat National de l’Edition",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Syndicat National de l’Edition115, boulevard Saint-Germain75006 ParisFrance www.sne.fr",
  "status": "organisation_country"
},
  "sourceClass": "publishing-association",
  "evidenceReport": "reports/r10/sources/sne-fr.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "publishers-org",
  "name": "Association of American Publishers",
  "url": "https://publishers.org/feed/",
  "format": "rss",
  "language": "en-US",
  "region": "north-america",
  "sourceFamilyId": "publishers-org",
  "countryCodes": [
  "US"
],
  "coverageCountryCodes": [
  "US"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://publishers.org"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://publishers.org/a-conversation-with-kimberly-kay-hoang-author-of-the-2023-prose-awards-r-r-hawkins-award-winner-spiderweb-capitalism-how-global-elites-exploit-frontier-markets/"
],
  "verifiedAt": "2026-09-26T17:27:53.459Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/", ""),
  "countryEvidence": {
  "method": "official_membership_directory",
  "url": "https://internationalpublishers.org/about/",
  "organisation": "Association of American Publishers",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Association of American Publishers 455 Massachusetts Ave. Suite 70020001 Washington DC www.publishers.org",
  "status": "organisation_country"
},
  "sourceClass": "publishing-association",
  "evidenceReport": "reports/r10/sources/publishers-org.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "publishers-org-uk",
  "name": "Publishers Association",
  "url": "https://www.publishers.org.uk/feed/",
  "format": "rss",
  "language": "en-GB",
  "region": "europe",
  "sourceFamilyId": "publishers-org-uk",
  "countryCodes": [
  "GB"
],
  "coverageCountryCodes": [
  "GB"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://www.publishers.org.uk"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://www.publishers.org.uk/publishers-association-industry-insights-publishing-in-2025/"
],
  "verifiedAt": "2026-09-26T17:27:54.250Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/", ""),
  "countryEvidence": {
  "method": "official_membership_directory",
  "url": "https://internationalpublishers.org/about/",
  "organisation": "Publishers Association",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Catriona MacLeod Stevenson, General Counsel and Deputy CEO of the Publishers Association",
  "status": "organisation_country"
},
  "sourceClass": "publishing-association",
  "evidenceReport": "reports/r10/sources/publishers-org-uk.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "apnetafrica-org",
  "name": "African Publishers Network (APNET)",
  "url": "https://apnetafrica.org/feed/",
  "format": "rss",
  "language": "en-US",
  "region": "africa",
  "sourceFamilyId": "apnetafrica-org",
  "countryCodes": [
  "GH"
],
  "coverageCountryCodes": [
  "GH"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://apnetafrica.org"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://apnetafrica.org/jill-says-mattis-nailed-it-in-his-resignation-letter/"
],
  "verifiedAt": "2026-09-26T17:27:54.628Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/", ""),
  "countryEvidence": {
  "method": "official_membership_directory",
  "url": "https://internationalpublishers.org/about/",
  "organisation": "African Publishers Network (APNET)",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "African Publishers Network (APNET)",
  "status": "organisation_country"
},
  "sourceClass": "publishing-association",
  "evidenceReport": "reports/r10/sources/apnetafrica-org.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "bolognachildrensbookfair-com",
  "name": "Bologna Children’s Book Fair",
  "url": "https://www.bolognachildrensbookfair.com/home/878.html",
  "format": "html",
  "language": "it",
  "region": "europe",
  "sourceFamilyId": "bolognachildrensbookfair-com",
  "countryCodes": [
  "IT"
],
  "coverageCountryCodes": [
  "IT"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://www.bolognachildrensbookfair.com"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://www.bolognachildrensbookfair.com/premi/bolognaragazzi-crossmedia-awards/10693.html"
],
  "verifiedAt": "2026-09-26T17:27:56.761Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/focus-on\\/centro-traduttori\\/world-directory-of-childrens-book-translators\\/[^/]+\\/?$|^\\/eventi\\/eventi-bolognabookplus\\/[^/]+\\/?$|^\\/mostre\\/illustrations-and-books-on-the-move\\/[^/]+\\/?$|^\\/mostre\\/the-braw-amazing-bookshelf\\/[^/]+\\/?$|^\\/premi\\/bolognaragazzi-awards\\/[^/]+\\/?$|^\\/premi\\/bolognaragazzi-crossmedia-awards\\/[^/]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_membership_directory",
  "url": "https://internationalpublishers.org/about/",
  "organisation": "Bologna Children’s Book Fair",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Bologna Children’s Book Fair",
  "status": "organisation_country"
},
  "sourceClass": "publishing-association",
  "evidenceReport": "reports/r10/sources/bolognachildrensbookfair-com.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "universitypressplc-com",
  "name": "University Press Plc, Ibadan",
  "url": "https://universitypressplc.com/feed/",
  "format": "rss",
  "language": "en-US",
  "region": "africa",
  "sourceFamilyId": "universitypressplc-com",
  "countryCodes": [
  "NG"
],
  "coverageCountryCodes": [
  "NG"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://universitypressplc.com"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://universitypressplc.com/2025/12/12/university-press-plc-wins-prestigious-sectoral-leadership-award-at-the-pearl-2025-awards/"
],
  "verifiedAt": "2026-09-26T17:28:00.248Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/", ""),
  "countryEvidence": {
  "method": "official_membership_directory",
  "url": "https://internationalpublishers.org/about/",
  "organisation": "University Press Plc, Ibadan",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Managing Director and CEO of the University Press Plc, Ibadan.",
  "status": "organisation_country"
},
  "sourceClass": "publishing-association",
  "evidenceReport": "reports/r10/sources/universitypressplc-com.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "publishers-ca",
  "name": "Association Nationale des Editeurs de Livres",
  "url": "https://publishers.ca/feed/",
  "format": "rss",
  "language": "en-CA",
  "region": "north-america",
  "sourceFamilyId": "publishers-ca",
  "countryCodes": [
  "CA"
],
  "coverageCountryCodes": [
  "CA"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://publishers.ca"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://publishers.ca/acp-awards-notice-2026/"
],
  "verifiedAt": "2026-09-26T17:28:05.007Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/", ""),
  "countryEvidence": {
  "method": "official_membership_directory",
  "url": "https://internationalpublishers.org/about/",
  "organisation": "Association Nationale des Editeurs de Livres",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Association Nationale des Editeurs de Livres2514 Boulevard Rosemont. Montréal H1Y1K4. Québecwww.anel.qc.ca Assn. of Canadian Publishers – 174 Spadina Avenue. Suite 306. Toronto ON M5T 2C2.www.publishe",
  "status": "organisation_country"
},
  "sourceClass": "publishing-association",
  "evidenceReport": "reports/r10/sources/publishers-ca.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "pubcouncil-ca",
  "name": "Association Nationale des Editeurs de Livres",
  "url": "https://pubcouncil.ca/feed/",
  "format": "rss",
  "language": "en-US",
  "region": "north-america",
  "sourceFamilyId": "pubcouncil-ca",
  "countryCodes": [
  "CA"
],
  "coverageCountryCodes": [
  "CA"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://pubcouncil.ca"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://pubcouncil.ca/canadian-publishing-industry-condemns-implementation-of-alberta-book-ban/"
],
  "verifiedAt": "2026-09-26T17:28:05.086Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/", ""),
  "countryEvidence": {
  "method": "official_membership_directory",
  "url": "https://internationalpublishers.org/about/",
  "organisation": "Association Nationale des Editeurs de Livres",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Association Nationale des Editeurs de Livres2514 Boulevard Rosemont. Montréal H1Y1K4. Québecwww.anel.qc.ca Assn. of Canadian Publishers – 174 Spadina Avenue. Suite 306. Toronto ON M5T 2C2.www.publishe",
  "status": "organisation_country"
},
  "sourceClass": "publishing-association",
  "evidenceReport": "reports/r10/sources/pubcouncil-ca.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "camlibro-com-co",
  "name": "Cámara Colombiana del LibroCalle",
  "url": "https://camlibro.com.co/feed/",
  "format": "rss",
  "language": "es-CO",
  "region": "latin-america",
  "sourceFamilyId": "camlibro-com-co",
  "countryCodes": [
  "CO"
],
  "coverageCountryCodes": [
  "CO"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://camlibro.com.co"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://camlibro.com.co/sharjah-emirato-de-los-emiratos-arabes-unidos-sera-invitado-de-honor-de-la-filbo-2027/"
],
  "verifiedAt": "2026-09-26T17:28:09.166Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/", ""),
  "countryEvidence": {
  "method": "official_membership_directory",
  "url": "https://internationalpublishers.org/about/",
  "organisation": "Cámara Colombiana del LibroCalle",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Cámara Colombiana del LibroCalle 35 n°5A-05Bogotá D.C.Colombiawww.camlibro.com.co",
  "status": "organisation_country"
},
  "sourceClass": "publishing-association",
  "evidenceReport": "reports/r10/sources/camlibro-com-co.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "shbsh-al",
  "name": "Association of Albanian Publishers",
  "url": "https://shbsh.al/wp2/feed/",
  "format": "rss",
  "language": "en-US",
  "region": "europe",
  "sourceFamilyId": "shbsh-al",
  "countryCodes": [
  "AL"
],
  "coverageCountryCodes": [
  "AL"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://shbsh.al"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://shbsh.al/wp2/2020/11/03/ne-vigjilje-te-panairit-te-23-te-librit/"
],
  "verifiedAt": "2026-09-26T17:28:13.287Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/", ""),
  "countryEvidence": {
  "method": "official_membership_directory",
  "url": "https://internationalpublishers.org/about/",
  "organisation": "Association of Albanian Publishers",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Association of Albanian Publishers",
  "status": "organisation_country"
},
  "sourceClass": "publishing-association",
  "evidenceReport": "reports/r10/sources/shbsh-al.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "publishers-org-nz",
  "name": "Publishers Association of New ZealandPO Box",
  "url": "https://publishers.org.nz/feed/",
  "format": "rss",
  "language": "en-US",
  "region": "oceania",
  "sourceFamilyId": "publishers-org-nz",
  "countryCodes": [
  "NZ"
],
  "coverageCountryCodes": [
  "NZ"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://publishers.org.nz"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://publishers.org.nz/poetry-community-powers-national-poetry-day-2026/"
],
  "verifiedAt": "2026-09-26T17:28:18.450Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/", ""),
  "countryEvidence": {
  "method": "official_membership_directory",
  "url": "https://internationalpublishers.org/about/",
  "organisation": "Publishers Association of New ZealandPO Box",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Publishers Association of New ZealandPO Box 102006North Shore 0745AucklandNew Zealandwww.publishers.org.nz",
  "status": "organisation_country"
},
  "sourceClass": "publishing-association",
  "evidenceReport": "reports/r10/sources/publishers-org-nz.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "ikapi-org",
  "name": "Ikatan Penerbit IndonesiaJL Kalipasir",
  "url": "https://www.ikapi.org/feed/",
  "format": "rss",
  "language": "id-ID",
  "region": "asia",
  "sourceFamilyId": "ikapi-org",
  "countryCodes": [
  "ID"
],
  "coverageCountryCodes": [
  "ID"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://www.ikapi.org"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://www.ikapi.org/2026/08/15/usulan-penerima-ikapi-awards-2026-telah-dibuka/"
],
  "verifiedAt": "2026-09-26T17:28:15.259Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/", ""),
  "countryEvidence": {
  "method": "official_membership_directory",
  "url": "https://internationalpublishers.org/about/",
  "organisation": "Ikatan Penerbit IndonesiaJL Kalipasir",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Ikatan Penerbit IndonesiaJL Kalipasir 32Pengarengan10330 akarta PusatIndonesiawww.ikapi.org",
  "status": "organisation_country"
},
  "sourceClass": "publishing-association",
  "evidenceReport": "reports/r10/sources/ikapi-org.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "pubat-or-th",
  "name": "Publishers &. Booksellers Association of Thailand",
  "url": "https://pubat.or.th/feed/",
  "format": "rss",
  "language": "en-US",
  "region": "asia",
  "sourceFamilyId": "pubat-or-th",
  "countryCodes": [
  "TH"
],
  "coverageCountryCodes": [
  "TH"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://pubat.or.th"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://pubat.or.th/100-annual-book-and-cover-design-2026/"
],
  "verifiedAt": "2026-09-26T17:28:25.027Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/", ""),
  "countryEvidence": {
  "method": "official_membership_directory",
  "url": "https://internationalpublishers.org/about/",
  "organisation": "Publishers &. Booksellers Association of Thailand",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Publishers &. Booksellers Association of Thailand83/159 Moo 6Ngam Wong Wan RoadThung Song Hong- Lak Si10210 BangkokThailandwww.pubat.or.th",
  "status": "organisation_country"
},
  "sourceClass": "publishing-association",
  "evidenceReport": "reports/r10/sources/pubat-or-th.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "pac-org-cn",
  "name": "Publishers Association of ChinaNo.",
  "url": "https://www.pac.org.cn/",
  "format": "html",
  "language": "zh",
  "region": "asia",
  "sourceFamilyId": "pac-org-cn",
  "countryCodes": [
  "CN"
],
  "coverageCountryCodes": [
  "CN"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://www.pac.org.cn"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://www.pac.org.cn/special/2026beijingtushudinghuohui.html"
],
  "verifiedAt": "2026-09-26T17:28:26.084Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/yaowensudi\\/[^/]+\\/?$|^\\/hangyedongtai\\/[^/]+\\/?$|^\\/xiehuidongtai\\/[^/]+\\/?$|^\\/tongzhi\\/[^/]+\\/?$|^\\/zhongyaojiaoliu\\/[^/]+\\/?$|^\\/special\\/[^/]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_membership_directory",
  "url": "https://internationalpublishers.org/about/",
  "organisation": "Publishers Association of ChinaNo.",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Publishers Association of ChinaNo.22 Meishuguan East StreetBeijingChinawww.pac.org.cn",
  "status": "organisation_country"
},
  "sourceClass": "publishing-association",
  "evidenceReport": "reports/r10/sources/pac-org-cn.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "bookunion-ru",
  "name": "bookunion.ru/",
  "url": "https://bookunion.ru/",
  "format": "html",
  "language": "ru",
  "region": "europe",
  "sourceFamilyId": "bookunion-ru",
  "countryCodes": [
  "RU"
],
  "coverageCountryCodes": [
  "RU"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://bookunion.ru"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://bookunion.ru/news/otraslevaia-konferentsiia-knizhnyi-rynok-rossii-2026-kliuchevye-itogi-vyzovy-i-tochki-rosta/"
],
  "verifiedAt": "2026-09-26T17:28:25.628Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/[^/]{12,}\\/?$|^\\/news\\/.+", ""),
  "countryEvidence": {
  "method": "official_membership_directory",
  "url": "https://internationalpublishers.org/about/",
  "organisation": "bookunion.ru/",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Russian Book UnionOktyabr’skaya Ulitsa. 4к2127018. MoscowRussiabookunion.ru/",
  "status": "organisation_country"
},
  "sourceClass": "publishing-association",
  "evidenceReport": "reports/r10/sources/bookunion-ru.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "publishers-fi",
  "name": "Finnish Book Publishers AssociationUnioninkatu",
  "url": "https://kustantajat.fi/feed",
  "format": "rss",
  "language": "fi",
  "region": "europe",
  "sourceFamilyId": "publishers-fi",
  "countryCodes": [
  "FI"
],
  "coverageCountryCodes": [
  "FI"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://kustantajat.fi"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://kustantajat.fi/kustantajien-neljannesvuositilasto-painetun-kirjan-myynti-hienoisessa-laskussa-digissa-selvaa-kasvua"
],
  "verifiedAt": "2026-09-26T17:28:32.099Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/", ""),
  "countryEvidence": {
  "method": "official_membership_directory",
  "url": "https://internationalpublishers.org/about/",
  "organisation": "Finnish Book Publishers AssociationUnioninkatu",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Finnish Book Publishers AssociationUnioninkatu 11FI-00130 HelsinkiFinlandwww.publishers.fi",
  "status": "organisation_country"
},
  "sourceClass": "publishing-association",
  "evidenceReport": "reports/r10/sources/publishers-fi.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "publishingireland-com",
  "name": "Irish Book Publishers’ Association",
  "url": "https://www.publishingireland.com/news/",
  "format": "html",
  "language": "en-GB",
  "region": "europe",
  "sourceFamilyId": "publishingireland-com",
  "countryCodes": [
  "IE"
],
  "coverageCountryCodes": [
  "IE"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://www.publishingireland.com"
],
  "parserVersion": "r10-source-profile-1",
  "linkSelector": "a[href]:not(nav a):not(header a):not(footer a)",
  "exampleArticleUrls": [
  "https://www.publishingireland.com/little-beetle-press-launches-new-international-literary-and-creative-festival/"
],
  "verifiedAt": "2026-09-27T14:07:15.822Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-27. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/[^/]{12,}\\/?$|^\\/publication_category\\/[^/]+\\/?$|^\\/\\/[^/]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_membership_directory",
  "url": "https://internationalpublishers.org/about/",
  "organisation": "Irish Book Publishers’ Association",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Irish Book Publishers’ Association25 Denzille LaneDublin 2Irelandwww.publishingireland.com",
  "status": "organisation_country"
},
  "sourceClass": "publishing-association",
  "evidenceReport": "reports/r10/sources/publishingireland-com.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "apel-pt",
  "name": "Associaçáo Portuguesa de Editores e LivreirosAv. dos Estados Unidos da América",
  "url": "https://apel.pt/feed/",
  "format": "rss",
  "language": "pt-PT",
  "region": "europe",
  "sourceFamilyId": "apel-pt",
  "countryCodes": [
  "PT"
],
  "coverageCountryCodes": [
  "PT"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://apel.pt"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://apel.pt/2026/09/11/festa-do-livro-em-belem-2026/"
],
  "verifiedAt": "2026-09-26T17:28:37.484Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/", ""),
  "countryEvidence": {
  "method": "official_membership_directory",
  "url": "https://internationalpublishers.org/about/",
  "organisation": "Associaçáo Portuguesa de Editores e LivreirosAv. dos Estados Unidos da América",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Associaçáo Portuguesa de Editores e LivreirosAv. dos Estados Unidos da América1700-167 LisbonPortugalwww.apel.pt",
  "status": "organisation_country"
},
  "sourceClass": "publishing-association",
  "evidenceReport": "reports/r10/sources/apel-pt.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "egyptianpublishers-org",
  "name": "Egyptian Publishers Association",
  "url": "https://www.egyptianpublishers.org/feed/",
  "format": "rss",
  "language": "ar",
  "region": "africa",
  "sourceFamilyId": "egyptianpublishers-org",
  "countryCodes": [
  "EG"
],
  "coverageCountryCodes": [
  "EG"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://www.egyptianpublishers.org"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://www.egyptianpublishers.org/%d8%a7%d9%81%d8%aa%d8%aa%d8%a7%d8%ad-%d9%85%d8%b9%d8%b1%d8%b6-%d8%b3%d9%88%d9%87%d8%a7%d8%ac-%d8%a7%d9%84%d8%a3%d9%88%d9%84-%d9%84%d9%84%d9%83%d8%aa%d8%a7%d8%a8/"
],
  "verifiedAt": "2026-09-26T17:28:39.866Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/", ""),
  "countryEvidence": {
  "method": "official_membership_directory",
  "url": "https://internationalpublishers.org/about/",
  "organisation": "Egyptian Publishers Association",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Egyptian Publishers Association92 El Tahrir StreetSaridar Building- Dokki, 2nd FloorCairoEgyptwww.egyptianpublishers.org",
  "status": "organisation_country"
},
  "sourceClass": "publishing-association",
  "evidenceReport": "reports/r10/sources/egyptianpublishers-org.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "adeb-be",
  "name": "Association des Editeurs Belges (ADEB)Avenue. R. Vandendriessche",
  "url": "https://www.adeb.be/",
  "format": "html",
  "language": "fr",
  "region": "europe",
  "sourceFamilyId": "adeb-be",
  "countryCodes": [
  "BE"
],
  "coverageCountryCodes": [
  "BE"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://www.adeb.be"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://www.adeb.be/fr/infos/presse/turbulences-dans-l-ecosysteme-du-livre"
],
  "verifiedAt": "2026-09-26T17:28:49.412Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/fr\\/adeb\\/[^/]+\\/?$|^\\/fr\\/[^/]+\\/?$|^\\/fr\\/infos\\/presse\\/[^/]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_membership_directory",
  "url": "https://internationalpublishers.org/about/",
  "organisation": "Association des Editeurs Belges (ADEB)Avenue. R. Vandendriessche",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Association des Editeurs Belges (ADEB)Avenue. R. Vandendriessche 18, Boîte 191150 Bruxelles, Belgium adeb.be",
  "status": "organisation_country"
},
  "sourceClass": "publishing-association",
  "evidenceReport": "reports/r10/sources/adeb-be.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "cul-com-uy",
  "name": "cul.com.uy/",
  "url": "https://cul.com.uy/feed/",
  "format": "rss",
  "language": "es",
  "region": "latin-america",
  "sourceFamilyId": "cul-com-uy",
  "countryCodes": [
  "UY"
],
  "coverageCountryCodes": [
  "UY"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://cul.com.uy"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://cul.com.uy/jurado-de-los-premios-bartolome-hidalgo-2026/"
],
  "verifiedAt": "2026-09-26T17:28:57.591Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/", ""),
  "countryEvidence": {
  "method": "official_membership_directory",
  "url": "https://internationalpublishers.org/about/",
  "organisation": "cul.com.uy/",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Cámara Uruguaya de Libro (CUL) Colón 1476, ap. 102 C.P. 11000 Montevideo Uruguay cul.com.uy/",
  "status": "organisation_country"
},
  "sourceClass": "publishing-association",
  "evidenceReport": "reports/r10/sources/cul-com-uy.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "kbr-be",
  "name": "Royal Library of Belgium",
  "url": "https://www.kbr.be/en/news/",
  "format": "html",
  "language": "en-US",
  "region": "europe",
  "sourceFamilyId": "kbr-be",
  "countryCodes": [
  "BE"
],
  "coverageCountryCodes": [
  "BE"
],
  "topics": [
  "heritage",
  "discoveries",
  "festivals",
  "releases"
],
  "articleOrigins": [
  "https://www.kbr.be"
],
  "parserVersion": "r10-source-profile-1",
  "linkSelector": "a[href]:not(nav a):not(header a):not(footer a)",
  "exampleArticleUrls": [
  "https://www.kbr.be/en/reopening-kbr-museum-may-23-2025/"
],
  "verifiedAt": "2026-09-27T14:07:20.608Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-27. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/en\\/collections\\/[^/]+\\/?$|^\\/en\\/agenda\\/[^/]+\\/?$|^\\/en\\/agenda\\/self\\x2dguided\\x2dworkshop\\x2dwriting\\x2dwith\\x2da\\x2dquill\\x2dpainting\\x2dwith\\x2dpigments\\x2d7\\/[^/]+\\/?$|^\\/[^/]{12,}\\/?$|^\\/en\\/locatie\\/[^/]+\\/?$|^\\/en\\/[^/]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_national_library_directory",
  "url": "https://www.cenl.org/library/koninklijke-bibliotheek-van-belgie-bibliotheque-royale-de-belgique/",
  "organisation": "Royal Library of Belgium",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Koninklijke Bibliotheek van België / Royal Library of Belgium",
  "status": "organisation_country"
},
  "sourceClass": "library",
  "evidenceReport": "reports/r10/sources/kbr-be.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "nub-ba",
  "name": "National and University Library of Bosnia and Herzegovina",
  "url": "https://nub.ba/novosti",
  "format": "html",
  "language": "bs",
  "region": "europe",
  "sourceFamilyId": "nub-ba",
  "countryCodes": [
  "BA"
],
  "coverageCountryCodes": [
  "BA"
],
  "topics": [
  "heritage",
  "discoveries",
  "festivals",
  "releases"
],
  "articleOrigins": [
  "https://nub.ba"
],
  "parserVersion": "r10-source-profile-1",
  "linkSelector": "a[href]:not(nav a):not(header a):not(footer a)",
  "exampleArticleUrls": [
  "https://nub.ba/o-knjizevnosti-sjecanju-i-identitetu-odrzana-promocija-romana-sandro-elvedina-nezirovica"
],
  "verifiedAt": "2026-09-29T20:33:40.592Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-29. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/[^/]{12,}\\/?$", ""),
  "countryEvidence": {
  "method": "official_national_library_directory",
  "url": "https://www.cenl.org/library/nacionalna-i-univerzitetska-biblioteka/",
  "organisation": "National and University Library of Bosnia and Herzegovina",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Nacionalna i univerzitetska biblioteka / National and University Library of Bosnia and Herzegovina",
  "status": "organisation_country"
},
  "sourceClass": "library",
  "evidenceReport": "reports/r10/sources/nub-ba.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "nkp-cz",
  "name": "National Library of the Czech Republic",
  "url": "https://www.nkp.cz/",
  "format": "html",
  "language": "cs",
  "region": "europe",
  "sourceFamilyId": "nkp-cz",
  "countryCodes": [
  "CZ"
],
  "coverageCountryCodes": [
  "CZ"
],
  "topics": [
  "heritage",
  "discoveries",
  "festivals",
  "releases"
],
  "articleOrigins": [
  "https://www.nkp.cz"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://www.nkp.cz/o-knihovne/aktuality/cena-rudolfa-medka-pro-rok-2026"
],
  "verifiedAt": "2026-09-26T17:29:06.145Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/o-knihovne\\/[^/]+\\/?$|^\\/o-knihovne\\/organizacni-struktura\\/[^/]+\\/?$|^\\/sluzby\\/[^/]+\\/?$|^\\/[^/]{12,}\\/?$|^\\/o-knihovne\\/aktuality\\/[^/]+\\/?$|^\\/stitky\\/[^/]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_national_library_directory",
  "url": "https://www.cenl.org/library/national-library-of-the-czech-republic-narodni-knihovna-ceske-republiky/",
  "organisation": "National Library of the Czech Republic",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Národní knihovna České republiky / National Library of the Czech Republic",
  "status": "organisation_country"
},
  "sourceClass": "library",
  "evidenceReport": "reports/r10/sources/nkp-cz.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "oszk-hu",
  "name": "National Library of Hungary",
  "url": "https://oszk.hu/en",
  "format": "html",
  "language": "en",
  "region": "europe",
  "sourceFamilyId": "oszk-hu",
  "countryCodes": [
  "HU"
],
  "coverageCountryCodes": [
  "HU"
],
  "topics": [
  "heritage",
  "discoveries",
  "festivals",
  "releases"
],
  "articleOrigins": [
  "https://oszk.hu"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://oszk.hu/en/news/azerbaijani-book-corner-opened-national-library-foreign-literature_260324"
],
  "verifiedAt": "2026-09-26T17:29:09.168Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/en\\/[^/]+\\/?$|^\\/en\\/news\\/.+|^\\/[^/]{12,}\\/?$", ""),
  "countryEvidence": {
  "method": "official_national_library_directory",
  "url": "https://www.cenl.org/library/national-library-of-hungary-orszagos-szechenyi-konyvtar-oszk/",
  "organisation": "National Library of Hungary",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Országos Széchényi Könyvtár (OSZK) / National Library of Hungary",
  "status": "organisation_country"
},
  "sourceClass": "library",
  "evidenceReport": "reports/r10/sources/oszk-hu.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "nli-ie",
  "name": "National Library of Ireland",
  "url": "https://www.nli.ie/",
  "format": "html",
  "language": "en",
  "region": "europe",
  "sourceFamilyId": "nli-ie",
  "countryCodes": [
  "IE"
],
  "coverageCountryCodes": [
  "IE"
],
  "topics": [
  "heritage",
  "discoveries",
  "festivals",
  "releases"
],
  "articleOrigins": [
  "https://www.nli.ie"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://www.nli.ie/news-stories/news/next-chapter-reimagining-national-library-begins"
],
  "verifiedAt": "2026-09-26T17:29:10.658Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/[^/]{12,}\\/?$|^\\/learn\\/[^/]+\\/?$|^\\/collections\\/our-collections\\/[^/]+\\/?$|^\\/collections\\/using-our-collections\\/[^/]+\\/?$|^\\/news-stories\\/news\\/[^/]+\\/?$|^\\/exhibitions-events\\/[^/]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_national_library_directory",
  "url": "https://www.cenl.org/library/national-library-of-ireland/",
  "organisation": "National Library of Ireland",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Leabharlann Náisiúnta na hÉireann / National Library of Ireland",
  "status": "organisation_country"
},
  "sourceClass": "library",
  "evidenceReport": "reports/r10/sources/nli-ie.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "landesbibliothek-li",
  "name": "National Library of Liechtenstein",
  "url": "https://www.landesbibliothek.li/feed/",
  "format": "rss",
  "language": "de",
  "region": "europe",
  "sourceFamilyId": "landesbibliothek-li",
  "countryCodes": [
  "LI"
],
  "coverageCountryCodes": [
  "LI"
],
  "topics": [
  "heritage",
  "discoveries",
  "festivals",
  "releases"
],
  "articleOrigins": [
  "https://www.landesbibliothek.li"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://www.landesbibliothek.li/die-bibliothek-kennenlernen-spontan-kurz-und-knackig-2/"
],
  "verifiedAt": "2026-09-26T17:29:11.958Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/", ""),
  "countryEvidence": {
  "method": "official_national_library_directory",
  "url": "https://www.cenl.org/library/national-library-of-liechtenstein/",
  "organisation": "National Library of Liechtenstein",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Liechtensteinische Landesbibliothek / National Library of Liechtenstein",
  "status": "organisation_country"
},
  "sourceClass": "library",
  "evidenceReport": "reports/r10/sources/landesbibliothek-li.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "lnb-lt",
  "name": "Martynas Mazvydas National Library of Lithuania",
  "url": "https://www.lnb.lt/?format=feed&type=rss",
  "format": "rss",
  "language": "lt",
  "region": "europe",
  "sourceFamilyId": "lnb-lt",
  "countryCodes": [
  "LT"
],
  "coverageCountryCodes": [
  "LT"
],
  "topics": [
  "heritage",
  "discoveries",
  "festivals",
  "releases"
],
  "articleOrigins": [
  "https://www.lnb.lt"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://www.lnb.lt/naujienos/15114-nordic-libraries-together-2026-ka-parsivezame-is-oslo"
],
  "verifiedAt": "2026-09-26T17:29:12.568Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/", ""),
  "countryEvidence": {
  "method": "official_national_library_directory",
  "url": "https://www.cenl.org/library/martynas-mazvydas-national-library-of-lithuania/",
  "organisation": "Martynas Mazvydas National Library of Lithuania",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Lietuvos nacionalinė Martyno Mažvydo biblioteka / Martynas Mazvydas National Library of Lithuania",
  "status": "organisation_country"
},
  "sourceClass": "library",
  "evidenceReport": "reports/r10/sources/lnb-lt.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "bnl-public-lu",
  "name": "National Library of Luxembourg",
  "url": "https://bnl.public.lu/fr.html",
  "format": "html",
  "language": "fr",
  "region": "europe",
  "sourceFamilyId": "bnl-public-lu",
  "countryCodes": [
  "LU"
],
  "coverageCountryCodes": [
  "LU"
],
  "topics": [
  "heritage",
  "discoveries",
  "festivals",
  "releases"
],
  "articleOrigins": [
  "https://bnl.public.lu"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://bnl.public.lu/fr/a-la-une/agenda/2026/paix-inachevee.html"
],
  "verifiedAt": "2026-09-26T17:29:13.149Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/fr\\/fonds\\/[^/]+\\/?$|^\\/fr\\/offres-numeriques\\/[^/]+\\/?$|^\\/fr\\/infrastructures\\/[^/]+\\/?$|^\\/fr\\/a-la-une\\/agenda\\/2026\\/[^/]+\\/?$|^\\/fr\\/services\\/[^/]+\\/?$|^\\/fr\\/support\\/aide-contact\\/[^/]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_national_library_directory",
  "url": "https://www.cenl.org/library/national-library-of-luxembourg/",
  "organisation": "National Library of Luxembourg",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Bibliothèque nationale du Luxembourg / National Library of Luxembourg",
  "status": "organisation_country"
},
  "sourceClass": "library",
  "evidenceReport": "reports/r10/sources/bnl-public-lu.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "bnrm-md",
  "name": "National Library of the Republic of Moldova",
  "url": "https://www.bnrm.md/?feed=rss2",
  "format": "rss",
  "language": "ro-RO",
  "region": "europe",
  "sourceFamilyId": "bnrm-md",
  "countryCodes": [
  "MD"
],
  "coverageCountryCodes": [
  "MD"
],
  "topics": [
  "heritage",
  "discoveries",
  "festivals",
  "releases"
],
  "articleOrigins": [
  "https://www.bnrm.md"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://www.bnrm.md/?p=7522"
],
  "verifiedAt": "2026-09-26T17:29:13.765Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/", ""),
  "countryEvidence": {
  "method": "official_national_library_directory",
  "url": "https://www.cenl.org/library/national-library-of-the-republic-of-moldova-biblioteca-nationala-a-republicii-moldova/",
  "organisation": "National Library of the Republic of Moldova",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Biblioteca Natională a Republicii Moldova / National Library of the Republic of Moldova",
  "status": "organisation_country"
},
  "sourceClass": "library",
  "evidenceReport": "reports/r10/sources/bnrm-md.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "nb-cg-me",
  "name": "National Library of Montenegro “Djurdje Crnojevic”",
  "url": "https://www.nb-cg.me/en",
  "format": "html",
  "language": "en",
  "region": "europe",
  "sourceFamilyId": "nb-cg-me",
  "countryCodes": [
  "ME"
],
  "coverageCountryCodes": [
  "ME"
],
  "topics": [
  "heritage",
  "discoveries",
  "festivals",
  "releases"
],
  "articleOrigins": [
  "https://www.nb-cg.me"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://www.nb-cg.me/en/events/1093-notice-to-authors-and-contributors-of-bibliografski-vjesnik-bibibliographic-herald"
],
  "verifiedAt": "2026-09-26T17:29:13.534Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/en\\/about-us\\/[^/]+\\/?$|^\\/en\\/catalogues\\/[^/]+\\/?$|^\\/en\\/collections\\/[^/]+\\/?$|^\\/en\\/our-publications\\/[^/]+\\/?$|^\\/en\\/events\\/.+|^\\/en\\/[^/]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_national_library_directory",
  "url": "https://www.cenl.org/library/national-library-of-montenegro-djurdje-crnojevic-cetinje-naciocalna-biblioteka-crne-gore-djurdje-crnojevic-cetinje/",
  "organisation": "National Library of Montenegro “Djurdje Crnojevic”",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Nacionalna biblioteka Crne Gore „Đurđe Crnojević“/ National Library of Montenegro “Djurdje Crnojevic”",
  "status": "organisation_country"
},
  "sourceClass": "library",
  "evidenceReport": "reports/r10/sources/nb-cg-me.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "bn-org-pl",
  "name": "National Library of Poland",
  "url": "https://www.bn.org.pl/",
  "format": "html",
  "language": "pl",
  "region": "europe",
  "sourceFamilyId": "bn-org-pl",
  "countryCodes": [
  "PL"
],
  "coverageCountryCodes": [
  "PL"
],
  "topics": [
  "heritage",
  "discoveries",
  "festivals",
  "releases"
],
  "articleOrigins": [
  "https://www.bn.org.pl"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://www.bn.org.pl/aktualnosci/6238-pierwsza-edycja-festiwalu-morze-literatury-za-nami.html"
],
  "verifiedAt": "2026-09-26T17:29:14.741Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/o-nas\\/[^/]+\\/?$|^\\/[^/]{12,}\\/?$|^\\/dla-bibliotekarzy\\/[^/]+\\/?$|^\\/aktualnosci\\/.+", ""),
  "countryEvidence": {
  "method": "official_national_library_directory",
  "url": "https://www.cenl.org/library/national-library-of-poland-biblioteka-narodowa/",
  "organisation": "National Library of Poland",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Biblioteka Narodowa / National Library of Poland",
  "status": "organisation_country"
},
  "sourceClass": "library",
  "evidenceReport": "reports/r10/sources/bn-org-pl.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "nb-rs",
  "name": "National Library of Serbia",
  "url": "https://nb.rs/feed/",
  "format": "rss",
  "language": "sr-RS",
  "region": "europe",
  "sourceFamilyId": "nb-rs",
  "countryCodes": [
  "RS"
],
  "coverageCountryCodes": [
  "RS"
],
  "topics": [
  "heritage",
  "discoveries",
  "festivals",
  "releases"
],
  "articleOrigins": [
  "https://nb.rs"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://nb.rs/godisnji-medjunarodni-sastanak-isbn-agencija-15-i-16-septembar-2026/"
],
  "verifiedAt": "2026-09-26T17:29:18.627Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/", ""),
  "countryEvidence": {
  "method": "official_national_library_directory",
  "url": "https://www.cenl.org/library/national-library-of-serbia/",
  "organisation": "National Library of Serbia",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Народна библиотека Србије / National Library of Serbia",
  "status": "organisation_country"
},
  "sourceClass": "library",
  "evidenceReport": "reports/r10/sources/nb-rs.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "snk-sk",
  "name": "Slovak National Library",
  "url": "https://snk.sk/en/",
  "format": "html",
  "language": "en-US",
  "region": "europe",
  "sourceFamilyId": "snk-sk",
  "countryCodes": [
  "SK"
],
  "coverageCountryCodes": [
  "SK"
],
  "topics": [
  "heritage",
  "discoveries",
  "festivals",
  "releases"
],
  "articleOrigins": [
  "https://snk.sk"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://snk.sk/en/novinky/bibliograficke-dni-2026"
],
  "verifiedAt": "2026-09-26T17:29:17.137Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/en\\/[^/]+\\/?$|^\\/en\\/novinky\\/.+", ""),
  "countryEvidence": {
  "method": "official_national_library_directory",
  "url": "https://www.cenl.org/library/slovak-national-library-slovenska-narodna-kni/",
  "organisation": "Slovak National Library",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Slovenská národná knižnica / Slovak National Library",
  "status": "organisation_country"
},
  "sourceClass": "library",
  "evidenceReport": "reports/r10/sources/snk-sk.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "kb-se",
  "name": "National Library of Sweden",
  "url": "https://www.kb.se/",
  "format": "html",
  "language": "sv",
  "region": "europe",
  "sourceFamilyId": "kb-se",
  "countryCodes": [
  "SE"
],
  "coverageCountryCodes": [
  "SE"
],
  "topics": [
  "heritage",
  "discoveries",
  "festivals",
  "releases"
],
  "articleOrigins": [
  "https://www.kb.se"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://www.kb.se/om-oss/nyheter/nyhetsarkiv/2026-09-17-unik-samling-tidskrifter-blir-nu-allmant-tillganglig.html"
],
  "verifiedAt": "2026-09-26T17:29:18.026Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/\\/[^/]+\\/?$|^\\/om-oss\\/nyheter\\/nyhetsarkiv\\/[^/]+\\/?$|^\\/om-oss\\/evenemang\\/evenemang\\/[^/]+\\/?$|^\\/for-bibliotekssektorn\\/[^/]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_national_library_directory",
  "url": "https://www.cenl.org/library/national-library-of-sweden-kungliga-biblioteket/",
  "organisation": "National Library of Sweden",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Kungliga Biblioteket / National Library of Sweden",
  "status": "organisation_country"
},
  "sourceClass": "library",
  "evidenceReport": "reports/r10/sources/kb-se.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "nbuv-gov-ua",
  "name": "Vernadsky National Library of Ukraine",
  "url": "https://nbuv.gov.ua/rss.xml",
  "format": "rss",
  "language": "uk",
  "region": "europe",
  "sourceFamilyId": "nbuv-gov-ua",
  "countryCodes": [
  "UA"
],
  "coverageCountryCodes": [
  "UA"
],
  "topics": [
  "heritage",
  "discoveries",
  "festivals",
  "releases"
],
  "articleOrigins": [
  "https://nbuv.gov.ua"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://nbuv.gov.ua/node/7320"
],
  "verifiedAt": "2026-09-26T17:29:19.516Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/", ""),
  "countryEvidence": {
  "method": "official_national_library_directory",
  "url": "https://www.cenl.org/library/v-vernadsky-national-library-of-ukraine/",
  "organisation": "Vernadsky National Library of Ukraine",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Національна бібліотека України імені В. І. Вернадського / Vernadsky National Library of Ukraine",
  "status": "organisation_country"
},
  "sourceClass": "library",
  "evidenceReport": "reports/r10/sources/nbuv-gov-ua.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "pen-international-org",
  "name": "PEN International",
  "url": "https://www.pen-international.org/",
  "format": "html",
  "language": "en-GB",
  "region": "europe",
  "sourceFamilyId": "pen-international-org",
  "countryCodes": [
  "GB"
],
  "coverageCountryCodes": [
  "GB"
],
  "topics": [
  "publishing",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://www.pen-international.org"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://www.pen-international.org/news/china-hong-kong-jimmy-lais-arbitrary-detention-raised-at-united-nations-2026"
],
  "verifiedAt": "2026-09-26T17:29:21.792Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/[^/]{12,}\\/?$|^\\/news\\/.+", ""),
  "countryEvidence": {
  "method": "official_PEN_centre_directory",
  "url": "https://pen.org/the-pen-world/",
  "organisation": "PEN International",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "PEN International",
  "status": "organisation_country"
},
  "sourceClass": "writers-association",
  "evidenceReport": "reports/r10/sources/pen-international-org.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "penclubedobrasil-org-br",
  "name": "Pen Clube do Brasil",
  "url": "https://penclubedobrasil.org.br/feed/",
  "format": "rss",
  "language": "pt-BR",
  "region": "latin-america",
  "sourceFamilyId": "penclubedobrasil-org-br",
  "countryCodes": [
  "BR"
],
  "coverageCountryCodes": [
  "BR"
],
  "topics": [
  "publishing",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://penclubedobrasil.org.br"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://penclubedobrasil.org.br/oscar-de-alencar-araripe-lanca-novo-livro-dia-28-03-2025-na-livraria-da-travessa-ipanema/"
],
  "verifiedAt": "2026-09-26T17:29:24.135Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/", ""),
  "countryEvidence": {
  "method": "official_PEN_centre_directory",
  "url": "https://pen.org/the-pen-world/",
  "organisation": "Pen Clube do Brasil",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Pen Clube do Brasil",
  "status": "organisation_country"
},
  "sourceClass": "writers-association",
  "evidenceReport": "reports/r10/sources/penclubedobrasil-org-br.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "penbelarus-org",
  "name": "Belarusian PEN",
  "url": "https://penbelarus.org/en/",
  "format": "html",
  "language": "en-US",
  "region": "europe",
  "sourceFamilyId": "penbelarus-org",
  "countryCodes": [],
  "coverageCountryCodes": [
  "BY"
],
  "topics": [
  "publishing",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://penbelarus.org"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://penbelarus.org/en/2026/03/04/belaruski-pen-pryznany-ekstremisczkim-farmavannem.html"
],
  "verifiedAt": "2026-09-26T17:29:23.958Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/en\\/2026\\/03\\/04\\/[^/]+\\/?$|^\\/en\\/[^/]+\\/?$|^\\/en\\/2026\\/07\\/31\\/[^/]+\\/?$|^\\/en\\/2026\\/09\\/17\\/[^/]+\\/?$|^\\/en\\/2026\\/03\\/03\\/[^/]+\\/?$|^\\/en\\/2026\\/09\\/16\\/[^/]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_PEN_centre_directory",
  "url": "https://pen.org/the-pen-world/",
  "organisation": "Belarusian PEN",
  "statement": "Literary constituency is recorded as coverage only; no office-country claim is made.",
  "excerpt": "Belarusian PEN",
  "status": "office_country_unconfirmed"
},
  "sourceClass": "writers-association",
  "evidenceReport": "reports/r10/sources/penbelarus-org.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "penbih-ba",
  "name": "Bosnian PEN",
  "url": "https://penbih.ba/feed/",
  "format": "rss",
  "language": "bs-BA",
  "region": "europe",
  "sourceFamilyId": "penbih-ba",
  "countryCodes": [
  "BA"
],
  "coverageCountryCodes": [
  "BA"
],
  "topics": [
  "publishing",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://penbih.ba"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://penbih.ba/2026/09/izlozba-adnadina-jasarevica-8-9-2026/"
],
  "verifiedAt": "2026-09-26T17:29:28.065Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/", ""),
  "countryEvidence": {
  "method": "official_PEN_centre_directory",
  "url": "https://pen.org/the-pen-world/",
  "organisation": "Bosnian PEN",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Bosnian PEN",
  "status": "organisation_country"
},
  "sourceClass": "writers-association",
  "evidenceReport": "reports/r10/sources/penbih-ba.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "pencatala-cat",
  "name": "PEN Catalan",
  "url": "https://www.pencatala.cat/",
  "format": "html",
  "language": "ca",
  "region": "europe",
  "sourceFamilyId": "pencatala-cat",
  "countryCodes": [
  "ES"
],
  "coverageCountryCodes": [
  "ES"
],
  "topics": [
  "publishing",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://www.pencatala.cat"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://www.pencatala.cat/noticia/prova-de-vida-ja-marius-serra-escriu-a-temesgen-ghebreyesus/"
],
  "verifiedAt": "2026-09-26T17:29:29.649Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/programes\\/[^/]+\\/?$|^\\/[^/]{12,}\\/?$|^\\/programes\\/traduccio\\/[^/]+\\/?$|^\\/noticia\\/[^/]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_PEN_centre_directory",
  "url": "https://pen.org/the-pen-world/",
  "organisation": "PEN Catalan",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "PEN Catalan",
  "status": "organisation_country"
},
  "sourceClass": "writers-association",
  "evidenceReport": "reports/r10/sources/pencatala-cat.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "pen-dk",
  "name": "Danish PEN",
  "url": "https://danskpen.dk/feed/",
  "format": "rss",
  "language": "da-DK",
  "region": "europe",
  "sourceFamilyId": "pen-dk",
  "countryCodes": [
  "DK"
],
  "coverageCountryCodes": [
  "DK"
],
  "topics": [
  "publishing",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://danskpen.dk"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://danskpen.dk/aabningsarrangement-forbudteboeger-er-bogens-frihed-truet/"
],
  "verifiedAt": "2026-09-26T17:29:30.327Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/", ""),
  "countryEvidence": {
  "method": "official_PEN_centre_directory",
  "url": "https://pen.org/the-pen-world/",
  "organisation": "Danish PEN",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Danish PEN",
  "status": "organisation_country"
},
  "sourceClass": "writers-association",
  "evidenceReport": "reports/r10/sources/pen-dk.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "englishpen-org",
  "name": "English PEN",
  "url": "https://www.englishpen.org/news/",
  "format": "html",
  "language": "en-GB",
  "region": "europe",
  "sourceFamilyId": "englishpen-org",
  "countryCodes": [
  "GB"
],
  "coverageCountryCodes": [
  "GB"
],
  "topics": [
  "publishing",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://www.englishpen.org"
],
  "parserVersion": "r10-source-profile-1",
  "linkSelector": "a[href]:not(nav a):not(header a):not(footer a)",
  "exampleArticleUrls": [
  "https://www.englishpen.org/posts/news/jacqueline-rose-awarded-pen-pinter-prize-2026/"
],
  "verifiedAt": "2026-09-29T20:33:55.876Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-29. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/posts\\/news\\/[^/]+\\/?$|^\\/posts\\/events\\/[^/]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_PEN_centre_directory",
  "url": "https://pen.org/the-pen-world/",
  "organisation": "English PEN",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "English PEN",
  "status": "organisation_country"
},
  "sourceClass": "writers-association",
  "evidenceReport": "reports/r10/sources/englishpen-org.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "pen-deutschland-de",
  "name": "PEN Germany",
  "url": "https://pen-deutschland.de/feed/",
  "format": "rss",
  "language": "de",
  "region": "europe",
  "sourceFamilyId": "pen-deutschland-de",
  "countryCodes": [
  "DE"
],
  "coverageCountryCodes": [
  "DE"
],
  "topics": [
  "publishing",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://pen-deutschland.de"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://pen-deutschland.de/jose-ruben-zamora-marroquin-erhaelt-hermann-kesten-preis-2026-des-pen-deutschland/"
],
  "verifiedAt": "2026-09-26T17:29:33.133Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/", ""),
  "countryEvidence": {
  "method": "official_PEN_centre_directory",
  "url": "https://pen.org/the-pen-world/",
  "organisation": "PEN Germany",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "PEN Germany",
  "status": "organisation_country"
},
  "sourceClass": "writers-association",
  "evidenceReport": "reports/r10/sources/pen-deutschland-de.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "irishpen-com",
  "name": "Irish PEN",
  "url": "https://irishpen.com/",
  "format": "html",
  "language": "en-US",
  "region": "europe",
  "sourceFamilyId": "irishpen-com",
  "countryCodes": [
  "IE"
],
  "coverageCountryCodes": [
  "IE"
],
  "topics": [
  "publishing",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://irishpen.com"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://irishpen.com/2026/09/16/festival-of-italian-and-irish-literature-in-ireland-25-to-26-september-2026/"
],
  "verifiedAt": "2026-09-26T17:29:33.351Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/[^/]{12,}\\/?$|^\\/become-a-member\\/[^/]+\\/?$|^\\/\\d{4}\\/\\d{2}\\/(?:\\d{2}\\/)?[^/]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_PEN_centre_directory",
  "url": "https://pen.org/the-pen-world/",
  "organisation": "Irish PEN",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Irish PEN",
  "status": "organisation_country"
},
  "sourceClass": "writers-association",
  "evidenceReport": "reports/r10/sources/irishpen-com.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "pen-kurd-org",
  "name": "Kurdish PEN",
  "url": "https://pen-kurd.com/feed/",
  "format": "rss",
  "language": "en-US",
  "region": "europe",
  "sourceFamilyId": "pen-kurd-org",
  "countryCodes": [],
  "coverageCountryCodes": [
  "DE"
],
  "topics": [
  "publishing",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://pen-kurd.com"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://pen-kurd.com/pen-international-calls-for-an-end-to-book-bans-on-world-book-day-2025/"
],
  "verifiedAt": "2026-09-26T17:29:32.551Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/", ""),
  "countryEvidence": {
  "method": "official_PEN_centre_directory",
  "url": "https://pen.org/the-pen-world/",
  "organisation": "Kurdish PEN",
  "statement": "Literary constituency is recorded as coverage only; no office-country claim is made.",
  "excerpt": "Kurdish PEN",
  "status": "office_country_unconfirmed"
},
  "sourceClass": "writers-association",
  "evidenceReport": "reports/r10/sources/pen-kurd-org.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "norskpen-no",
  "name": "Norwegian PEN",
  "url": "https://norskpen.no/feed/",
  "format": "rss",
  "language": "nb-NO",
  "region": "europe",
  "sourceFamilyId": "norskpen-no",
  "countryCodes": [
  "NO"
],
  "coverageCountryCodes": [
  "NO"
],
  "topics": [
  "publishing",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://norskpen.no"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://norskpen.no/nyheter/2026-apent-for-nominasjoner/"
],
  "verifiedAt": "2026-09-26T17:29:40.420Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/", ""),
  "countryEvidence": {
  "method": "official_PEN_centre_directory",
  "url": "https://pen.org/the-pen-world/",
  "organisation": "Norwegian PEN",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Norwegian PEN",
  "status": "organisation_country"
},
  "sourceClass": "writers-association",
  "evidenceReport": "reports/r10/sources/norskpen-no.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "penclub-com-pl",
  "name": "Polish PEN",
  "url": "https://penclub.com.pl/feed/",
  "format": "rss",
  "language": "pl-PL",
  "region": "europe",
  "sourceFamilyId": "penclub-com-pl",
  "countryCodes": [
  "PL"
],
  "coverageCountryCodes": [
  "PL"
],
  "topics": [
  "publishing",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://penclub.com.pl"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://penclub.com.pl/2026/09/14/literatura-zakazana-na-festiwalu-lublin-miasto-literatury/"
],
  "verifiedAt": "2026-09-26T17:29:36.397Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/", ""),
  "countryEvidence": {
  "method": "official_PEN_centre_directory",
  "url": "https://pen.org/the-pen-world/",
  "organisation": "Polish PEN",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Polish PEN",
  "status": "organisation_country"
},
  "sourceClass": "writers-association",
  "evidenceReport": "reports/r10/sources/penclub-com-pl.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "scottishpen-org",
  "name": "PEN Scotland",
  "url": "https://scottishpen.org/",
  "format": "html",
  "language": "en-US",
  "region": "europe",
  "sourceFamilyId": "scottishpen-org",
  "countryCodes": [
  "GB"
],
  "coverageCountryCodes": [
  "GB"
],
  "topics": [
  "publishing",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://scottishpen.org"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://scottishpen.org/scottish-poets-respond-to-israels-genocide-in-gaza/"
],
  "verifiedAt": "2026-09-26T17:29:37.052Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/[^/]{12,}\\/?$|^\\/campaign\\/[^/]+\\/?$|^\\/\\/[^/]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_PEN_centre_directory",
  "url": "https://pen.org/the-pen-world/",
  "organisation": "PEN Scotland",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "PEN Scotland",
  "status": "organisation_country"
},
  "sourceClass": "writers-association",
  "evidenceReport": "reports/r10/sources/scottishpen-org.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "penslovenia-zdruzenje-si",
  "name": "PEN Slovenia",
  "url": "https://www.penslovenia-zdruzenje.si/",
  "format": "html",
  "language": "sl",
  "region": "europe",
  "sourceFamilyId": "penslovenia-zdruzenje-si",
  "countryCodes": [
  "SI"
],
  "coverageCountryCodes": [
  "SI"
],
  "topics": [
  "publishing",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://www.penslovenia-zdruzenje.si"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://www.penslovenia-zdruzenje.si/mediji-o-mladem-pen-u"
],
  "verifiedAt": "2026-09-26T17:29:37.211Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/[^/]{12,}\\/?$|^\\/pen\\/[^/]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_PEN_centre_directory",
  "url": "https://pen.org/the-pen-world/",
  "organisation": "PEN Slovenia",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "PEN Slovenia",
  "status": "organisation_country"
},
  "sourceClass": "writers-association",
  "evidenceReport": "reports/r10/sources/penslovenia-zdruzenje-si.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "pen-org-au",
  "name": "Sydney PEN",
  "url": "https://pen.org.au/feed/",
  "format": "rss",
  "language": "en-AU",
  "region": "oceania",
  "sourceFamilyId": "pen-org-au",
  "countryCodes": [
  "AU"
],
  "coverageCountryCodes": [
  "AU"
],
  "topics": [
  "publishing",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://pen.org.au"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://pen.org.au/poet-ali-asadollahi-arrested-in-iran-during-protests/"
],
  "verifiedAt": "2026-09-26T17:29:37.759Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/", ""),
  "countryEvidence": {
  "method": "official_PEN_centre_directory",
  "url": "https://pen.org/the-pen-world/",
  "organisation": "Sydney PEN",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Sydney PEN",
  "status": "organisation_country"
},
  "sourceClass": "writers-association",
  "evidenceReport": "reports/r10/sources/pen-org-au.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "god-literatury",
  "name": "Год литературы",
  "url": "https://godliteratury.ru/",
  "format": "html",
  "language": "ru",
  "region": "europe",
  "sourceFamilyId": "god-literatury",
  "countryCodes": [
  "RU"
],
  "coverageCountryCodes": [
  "RU"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://godliteratury.ru"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://godliteratury.ru/articles/2026/09/23/opublikovan-korotkij-spisok-bukerovskoj-premii-2026-goda"
],
  "verifiedAt": "2026-09-26T17:29:38.382Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/gl-projects\\/[^/]+\\/?$|^\\/articles\\/.+", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "archive:source_probe_notes.json",
  "organisation": "Год литературы",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Год литературы",
  "status": "organisation_country"
},
  "sourceClass": "media",
  "evidenceReport": "reports/r10/sources/god-literatury.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "publishers-weekly",
  "name": "Publishers Weekly",
  "url": "https://www.publishersweekly.com/pw/by-topic/industry-news/index.html",
  "format": "html",
  "language": "en",
  "region": "north-america",
  "sourceFamilyId": "publishers-weekly",
  "countryCodes": [
  "US"
],
  "coverageCountryCodes": [
  "US"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://www.publishersweekly.com"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://www.publishersweekly.com/pw/by-topic/industry-news/publisher-news/article/101236-2026-national-book-award-longlists-announced.html"
],
  "verifiedAt": "2026-09-26T17:29:40.374Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/pw\\/by-topic\\/industry-news\\/financial-reporting\\/article\\/[^/]+\\/?$|^\\/pw\\/by-topic\\/industry-news\\/publisher-news\\/article\\/[^/]+\\/?$|^\\/pw\\/by-topic\\/industry-news\\/bookselling\\/article\\/[^/]+\\/?$|^\\/pw\\/by-topic\\/industry-news\\/book-deals\\/article\\/[^/]+\\/?$|^\\/pw\\/by-topic\\/industry-news\\/religion\\/article\\/[^/]+\\/?$|^\\/pw\\/by-topic\\/industry-news\\/tip-sheet\\/article\\/[^/]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "archive:source_probe_notes.json",
  "organisation": "Publishers Weekly",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Publishers Weekly",
  "status": "organisation_country"
},
  "sourceClass": "trade",
  "evidenceReport": "reports/r10/sources/publishers-weekly.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "publishing-perspectives",
  "name": "Publishing Perspectives",
  "url": "https://publishingperspectives.com/feed/",
  "format": "rss",
  "language": "en-US",
  "region": "north-america",
  "sourceFamilyId": "publishing-perspectives",
  "countryCodes": [
  "US"
],
  "coverageCountryCodes": [
  "US"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://publishingperspectives.com"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://publishingperspectives.com/2026/09/from-hilarious-to-the-discomfiting-the-u-k-s-booker-prize-announces-the-2026-shortlist/"
],
  "verifiedAt": "2026-09-26T17:29:40.363Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "archive:source_probe_notes.json",
  "organisation": "Publishing Perspectives",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Publishing Perspectives",
  "status": "organisation_country"
},
  "sourceClass": "trade",
  "evidenceReport": "reports/r10/sources/publishing-perspectives.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "ast",
  "name": "АСТ",
  "url": "https://ast.ru/news/",
  "format": "html",
  "language": "ru-RU",
  "region": "europe",
  "sourceFamilyId": "eksmo-ast",
  "countryCodes": [
  "RU"
],
  "coverageCountryCodes": [
  "RU"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://ast.ru"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://ast.ru/news/evropeyskiy-den-yazykov-2026/"
],
  "verifiedAt": "2026-09-26T17:29:41.539Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/news\\/.+|^\\/authors\\/[^/]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "archive:source_probe_notes.json",
  "organisation": "АСТ",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "АСТ",
  "status": "organisation_country"
},
  "sourceClass": "publisher",
  "evidenceReport": "reports/r10/sources/ast.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "ad-marginem",
  "name": "Ad Marginem",
  "url": "https://admarginem.ru/feed/",
  "format": "rss",
  "language": "ru-RU",
  "region": "europe",
  "sourceFamilyId": "ad-marginem",
  "countryCodes": [
  "RU"
],
  "coverageCountryCodes": [
  "RU"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://admarginem.ru"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://admarginem.ru/2026/07/31/yazyk-kak-mesto-vstrechi/"
],
  "verifiedAt": "2026-09-26T17:29:41.910Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "archive:source_probe_notes.json",
  "organisation": "Ad Marginem",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Ad Marginem",
  "status": "organisation_country"
},
  "sourceClass": "publisher",
  "evidenceReport": "reports/r10/sources/ad-marginem.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "samokat",
  "name": "Самокат",
  "url": "https://samokatbook.ru/",
  "format": "html",
  "language": "ru",
  "region": "europe",
  "sourceFamilyId": "samokat",
  "countryCodes": [
  "RU"
],
  "coverageCountryCodes": [
  "RU"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://samokatbook.ru"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://samokatbook.ru/news/bukvy-i-znaki-festival-lyubvi-k-knigam-i-rodnomu-gorodu-v-vyborge/"
],
  "verifiedAt": "2026-09-26T17:29:41.564Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/[^/]{12,}\\/?$|^\\/news\\/.+|^\\/meropriyatiya\\/v-moskve\\/[^/]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "archive:source_probe_notes.json",
  "organisation": "Самокат",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Самокат",
  "status": "organisation_country"
},
  "sourceClass": "publisher",
  "evidenceReport": "reports/r10/sources/samokat.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "ndl-japan",
  "name": "National Diet Library",
  "url": "https://www.ndl.go.jp/en/news/news_index",
  "format": "html",
  "language": "en",
  "region": "asia",
  "sourceFamilyId": "ndl-japan",
  "countryCodes": [
  "JP"
],
  "coverageCountryCodes": [
  "JP"
],
  "topics": [
  "heritage",
  "discoveries",
  "festivals",
  "releases"
],
  "articleOrigins": [
  "https://www.ndl.go.jp"
],
  "parserVersion": "r10-source-profile-1",
  "linkSelector": "a[href]:not(nav a):not(header a):not(footer a)",
  "exampleArticleUrls": [
  "https://www.ndl.go.jp/en/news/fy2025/260317_02"
],
  "verifiedAt": "2026-09-26T17:29:47.733Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/[^/]{12,}\\/?$|^\\/en\\/[^/]+\\/?$|^\\/en\\/news\\/.+", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "https://www.ndl.go.jp/en/news/news_index",
  "organisation": "National Diet Library",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "National Diet Library",
  "status": "organisation_country"
},
  "sourceClass": "library",
  "evidenceReport": "reports/r10/sources/ndl-japan.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "bn-chile",
  "name": "Biblioteca Nacional de Chile",
  "url": "https://www.bibliotecanacional.gob.cl/noticias",
  "format": "html",
  "language": "es",
  "region": "latin-america",
  "sourceFamilyId": "bn-chile",
  "countryCodes": [
  "CL"
],
  "coverageCountryCodes": [
  "CL"
],
  "topics": [
  "heritage",
  "discoveries",
  "festivals",
  "releases"
],
  "articleOrigins": [
  "https://www.bibliotecanacional.gob.cl"
],
  "parserVersion": "r10-source-profile-1",
  "linkSelector": "a[href]:not(nav a):not(header a):not(footer a)",
  "exampleArticleUrls": [
  "https://www.bibliotecanacional.gob.cl/noticias/bibliotecas-nacionales-de-chile-peru-y-argentina-crearan-repositorio-digital-dedicado-jose"
],
  "verifiedAt": "2026-09-26T17:29:46.801Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/[^/]{12,}\\/?$|^\\/bajo-la-lupa\\/[^/]+\\/?$|^\\/noticias\\/.+", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "https://www.bibliotecanacional.gob.cl/noticias",
  "organisation": "Biblioteca Nacional de Chile",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Biblioteca Nacional de Chile",
  "status": "organisation_country"
},
  "sourceClass": "library",
  "evidenceReport": "reports/r10/sources/bn-chile.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "bn-peru",
  "name": "Biblioteca Nacional del Perú",
  "url": "https://www.gob.pe/institucion/bnp/noticias",
  "format": "html",
  "language": "es-PE",
  "region": "latin-america",
  "sourceFamilyId": "bn-peru",
  "countryCodes": [
  "PE"
],
  "coverageCountryCodes": [
  "PE"
],
  "topics": [
  "heritage",
  "discoveries",
  "festivals",
  "releases"
],
  "articleOrigins": [
  "https://www.gob.pe"
],
  "parserVersion": "r10-source-profile-1",
  "linkSelector": "a[href]:not(nav a):not(header a):not(footer a)",
  "exampleArticleUrls": [
  "https://www.gob.pe/institucion/bnp/noticias/1437512-reconocimiento-jorge-basadre-grohmann-2026-la-bnp-distinguio-a-quienes-transforman-sus-comunidades-a-traves-de-las-bibliotecas"
],
  "verifiedAt": "2026-09-26T17:29:48.003Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/institucion\\/bnp\\/tema\\/[^/]+\\/?$|^\\/institucion\\/bnp\\/pages\\/[^/]+\\/?$|^\\/institucion\\/bnp\\/colecciones\\/[^/]+\\/?$|^\\/[^/]{12,}\\/?$|^\\/institucion\\/bnp\\/noticias\\/[^/]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "https://www.gob.pe/institucion/bnp/noticias",
  "organisation": "Biblioteca Nacional del Perú",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Biblioteca Nacional del Perú",
  "status": "organisation_country"
},
  "sourceClass": "library",
  "evidenceReport": "reports/r10/sources/bn-peru.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "brittle-paper",
  "name": "Brittle Paper",
  "url": "https://brittlepaper.com/feed/",
  "format": "rss",
  "language": "en-US",
  "region": "north-america",
  "sourceFamilyId": "brittle-paper",
  "countryCodes": [],
  "coverageCountryCodes": [
  "NG",
  "ZA",
  "KE",
  "GH"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://brittlepaper.com"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://brittlepaper.com/2026/09/18-year-old-nigerian-american-poet-daniel-umemezie-becomes-the-us-2026-national-youth-poet-laureate/"
],
  "verifiedAt": "2026-09-26T17:29:48.521Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "https://brittlepaper.com/",
  "organisation": "Brittle Paper",
  "statement": "Literary constituency is recorded as coverage only; no office-country claim is made.",
  "excerpt": "Brittle Paper",
  "status": "office_country_unconfirmed"
},
  "sourceClass": "literary-media",
  "evidenceReport": "reports/r10/sources/brittle-paper.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "asymptote",
  "name": "Asymptote",
  "url": "https://www.asymptotejournal.com/blog/feed/",
  "format": "rss",
  "language": "en",
  "region": "asia",
  "sourceFamilyId": "asymptote",
  "countryCodes": [
  "SG"
],
  "coverageCountryCodes": [],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://www.asymptotejournal.com"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://www.asymptotejournal.com/blog/2026/09/14/whats-new-in-translation-september-2026/"
],
  "verifiedAt": "2026-09-26T17:29:49.656Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "https://www.asymptotejournal.com/about/",
  "organisation": "Asymptote",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Asymptote is incorporated in Singapore.",
  "status": "organisation_country"
},
  "sourceClass": "literary-media",
  "evidenceReport": "reports/r10/sources/asymptote.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "bakwa-magazine",
  "name": "Bakwa Magazine",
  "url": "https://bakwamagazine.com/feed/",
  "format": "rss",
  "language": "en-GB",
  "region": "africa",
  "sourceFamilyId": "bakwa-magazine",
  "countryCodes": [
  "CM"
],
  "coverageCountryCodes": [
  "CM"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://bakwamagazine.com"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://bakwamagazine.com/featured-content/on-territoriality-and-african-literature/"
],
  "verifiedAt": "2026-09-26T17:29:51.561Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "https://bakwamagazine.com/news/",
  "organisation": "Bakwa Magazine",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Bakwa Magazine",
  "status": "organisation_country"
},
  "sourceClass": "literary-media",
  "evidenceReport": "reports/r10/sources/bakwa-magazine.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "cassava-republic",
  "name": "Cassava Republic Press",
  "url": "https://cassavarepublic.biz/feed/",
  "format": "rss",
  "language": "en-US",
  "region": "africa",
  "sourceFamilyId": "cassava-republic",
  "countryCodes": [
  "NG"
],
  "coverageCountryCodes": [
  "NG",
  "GB"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://cassavarepublic.biz"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://cassavarepublic.biz/the-mercy-step-is-shortlisted-for-the-womens-prize-for-fiction/"
],
  "verifiedAt": "2026-09-26T17:30:00.094Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "https://cassavarepublic.biz/blog-2/",
  "organisation": "Cassava Republic Press",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Cassava Republic Press",
  "status": "organisation_country"
},
  "sourceClass": "publisher",
  "evidenceReport": "reports/r10/sources/cassava-republic.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "modjaji",
  "name": "Modjaji Books",
  "url": "https://modjajibooks.co.za/feed/",
  "format": "rss",
  "language": "en-GB",
  "region": "africa",
  "sourceFamilyId": "modjaji",
  "countryCodes": [
  "ZA"
],
  "coverageCountryCodes": [
  "ZA"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://modjajibooks.co.za"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://modjajibooks.co.za/modjaji-books-launches-a-call-for-our-woordeloos-anthology-celebrating-southern-african-women-poets/"
],
  "verifiedAt": "2026-09-26T17:29:59.720Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "https://modjajibooks.co.za/topics/imprint-africa/",
  "organisation": "Modjaji Books",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Modjaji Books",
  "status": "organisation_country"
},
  "sourceClass": "publisher",
  "evidenceReport": "reports/r10/sources/modjaji.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "doek",
  "name": "Doek!",
  "url": "https://doeklitmag.com/feed/",
  "format": "rss",
  "language": "en-GB",
  "region": "africa",
  "sourceFamilyId": "doek",
  "countryCodes": [
    "NA"
  ],
  "coverageCountryCodes": [
    "NA"
  ],
  "topics": [
    "publishing",
    "releases",
    "awards",
    "festivals"
  ],
  "articleOrigins": [
    "https://doeklitmag.com"
  ],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
    "https://doeklitmag.com/that-sweet-faraway-place-where-dreams-are-made/"
  ],
  "verifiedAt": "2026-09-29T20:34:06.614Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-29. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "countryEvidence": {
    "method": "official_organisation_identity",
    "url": "https://doeklitmag.com/",
    "organisation": "Doek!",
    "statement": "Organisation country is distinct from the country of each covered event.",
    "excerpt": "Doek!",
    "status": "organisation_country"
  },
  "sourceClass": "literary-media",
  "evidenceReport": "reports/r10/sources/doek.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "taipei-book-fair",
  "name": "Taipei International Book Exhibition",
  "url": "https://www.tibe.org.tw/",
  "format": "html",
  "language": "zh-Hant",
  "region": "asia",
  "sourceFamilyId": "taipei-book-fair",
  "countryCodes": [
  "TW"
],
  "coverageCountryCodes": [
  "TW"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://www.tibe.org.tw"
],
  "parserVersion": "r10-source-profile-1",
  "linkSelector": "a[href]:not(nav a):not(header a):not(footer a)",
  "exampleArticleUrls": [
  "https://www.tibe.org.tw/tw/news_detail/19/1919"
],
  "verifiedAt": "2026-09-26T17:31:45.202Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/tw\\/download\\/[^/]+\\/?$|^\\/tw\\/news_detail\\/19\\/[^/]+\\/?$|^\\/tw\\/news_detail\\/6\\/[^/]+\\/?$|^\\/tw\\/news_detail\\/7\\/[^/]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "https://www.tibe.org.tw/",
  "organisation": "Taipei International Book Exhibition",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Taipei International Book Exhibition",
  "status": "organisation_country"
},
  "sourceClass": "festival",
  "evidenceReport": "reports/r10/sources/taipei-book-fair.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 21600
},
{
  "id": "seoul-book-fair",
  "name": "Seoul International Book Fair",
  "url": "https://sibf.or.kr/en/",
  "format": "html",
  "language": "ko",
  "region": "asia",
  "sourceFamilyId": "seoul-book-fair",
  "countryCodes": [
  "KR"
],
  "coverageCountryCodes": [
  "KR"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://sibf.or.kr"
],
  "parserVersion": "r10-source-profile-1",
  "linkSelector": "a[href]:not(nav a):not(header a):not(footer a)",
  "exampleArticleUrls": [
  "https://sibf.or.kr/en/page/13?gbn=3&year=2026"
],
  "verifiedAt": "2026-09-26T17:31:49.665Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/en\\/page\\/[^/]+\\/?$|^\\/en\\/62_en\\/[^/]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "https://sibf.or.kr/en/",
  "organisation": "Seoul International Book Fair",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Seoul International Book Fair",
  "status": "organisation_country"
},
  "sourceClass": "festival",
  "evidenceReport": "reports/r10/sources/seoul-book-fair.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 21600
},
{
  "id": "femrite",
  "name": "FEMRITE",
  "url": "https://femrite.org/feed/",
  "format": "rss",
  "language": "en-US",
  "region": "africa",
  "sourceFamilyId": "femrite",
  "countryCodes": [
  "UG"
],
  "coverageCountryCodes": [
  "UG"
],
  "topics": [
  "publishing",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://femrite.org"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://femrite.org/2025/10/24/her-humility-carried-more-power-than-her-authority/"
],
  "verifiedAt": "2026-09-26T17:31:54.454Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "https://femrite.org/",
  "organisation": "FEMRITE",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "FEMRITE",
  "status": "organisation_country"
},
  "sourceClass": "writers-association",
  "evidenceReport": "reports/r10/sources/femrite.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "amabooks",
  "name": "amaBooks",
  "url": "https://amabooksbyo.blogspot.com/feeds/posts/default",
  "format": "atom",
  "language": "en",
  "region": "africa",
  "sourceFamilyId": "amabooks",
  "countryCodes": [
  "ZW"
],
  "coverageCountryCodes": [
  "ZW"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://amabooksbyo.blogspot.com"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://amabooksbyo.blogspot.com/2026/03/interview-with-university-of-georgia.html"
],
  "verifiedAt": "2026-09-26T17:31:54.226Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "https://amabooksbyo.blogspot.com/",
  "organisation": "amaBooks",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "amaBooks",
  "status": "organisation_country"
},
  "sourceClass": "publisher",
  "evidenceReport": "reports/r10/sources/amabooks.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "loatad",
  "name": "Library of Africa and the African Diaspora",
  "url": "https://loatad.org/feed/",
  "format": "rss",
  "language": "en-US",
  "region": "africa",
  "sourceFamilyId": "loatad",
  "countryCodes": [
  "GH"
],
  "coverageCountryCodes": [
  "GH"
],
  "topics": [
  "heritage",
  "discoveries",
  "festivals",
  "releases"
],
  "articleOrigins": [
  "https://loatad.org"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://loatad.org/2025/12/10/apply-to-the-2026-west-africa-road-residency/"
],
  "verifiedAt": "2026-09-26T17:31:57.542Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "https://loatad.org/",
  "organisation": "Library of Africa and the African Diaspora",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Library of Africa and the African Diaspora",
  "status": "organisation_country"
},
  "sourceClass": "library",
  "evidenceReport": "reports/r10/sources/loatad.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "jalada",
  "name": "Jalada Africa",
  "url": "https://jaladaafrica.org/feed/",
  "format": "rss",
  "language": "en-US",
  "region": "africa",
  "sourceFamilyId": "jalada",
  "countryCodes": [
  "KE"
],
  "coverageCountryCodes": [
  "KE"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://jaladaafrica.org"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://jaladaafrica.org/2025/05/29/jalada-africa-joins-the-world-to-mourn-ngugi-wa-thiongo-1938-2025/"
],
  "verifiedAt": "2026-09-26T17:31:57.611Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "https://jaladaafrica.org/",
  "organisation": "Jalada Africa",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Jalada Africa",
  "status": "organisation_country"
},
  "sourceClass": "literary-media",
  "evidenceReport": "reports/r10/sources/jalada.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "actualitte",
  "name": "ActuaLitté",
  "url": "https://actualitte.com/rss-main.rss",
  "format": "rss",
  "language": "fr",
  "region": "europe",
  "sourceFamilyId": "actualitte",
  "countryCodes": [
  "FR"
],
  "coverageCountryCodes": [
  "FR"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://actualitte.com"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://actualitte.com/article/134130/prix-litteraires/booker-prize-2026-ils-ne-sont-plus-que-6-en-lice"
],
  "verifiedAt": "2026-09-26T17:32:08.365Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "https://actualitte.com/",
  "organisation": "ActuaLitté",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "ActuaLitté",
  "status": "organisation_country"
},
  "sourceClass": "literary-media",
  "evidenceReport": "reports/r10/sources/actualitte.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "livres-hebdo",
  "name": "Livres Hebdo",
  "url": "https://www.livreshebdo.fr/prix-litteraires#Actualite",
  "format": "html",
  "language": "fr",
  "region": "europe",
  "sourceFamilyId": "livres-hebdo",
  "countryCodes": [
  "FR"
],
  "coverageCountryCodes": [
  "FR"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://www.livreshebdo.fr"
],
  "parserVersion": "r10-source-profile-1",
  "linkSelector": "a[href]:not(nav a):not(header a):not(footer a)",
  "exampleArticleUrls": [
  "https://www.livreshebdo.fr/article/les-finalistes-du-prix-litteraire-des-musiciens-2026"
],
  "verifiedAt": "2026-09-26T17:32:04.052Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/tag_menu\\/[^/]+\\/?$|^\\/article\\/[^/]+\\/?$|^\\/livres\\/[^/]+\\/?$|^\\/auteur\\/[^/]+\\/?$|^\\/page\\/[^/]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "https://www.livreshebdo.fr/",
  "organisation": "Livres Hebdo",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Livres Hebdo",
  "status": "organisation_country"
},
  "sourceClass": "literary-media",
  "evidenceReport": "reports/r10/sources/livres-hebdo.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "dosdoce",
  "name": "Dosdoce",
  "url": "https://www.dosdoce.com/feed/",
  "format": "rss",
  "language": "es",
  "region": "europe",
  "sourceFamilyId": "dosdoce",
  "countryCodes": [
  "ES"
],
  "coverageCountryCodes": [
  "ES"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://www.dosdoce.com"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://www.dosdoce.com/2026/09/23/el-85-de-los-productores-de-audiolibros-usan-ia-pero-los-ahorros-de-costos-reales-estan-muy-por-debajo-de-la-exageracion-de-la-industria/"
],
  "verifiedAt": "2026-09-26T17:32:03.140Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "https://www.dosdoce.com/",
  "organisation": "Dosdoce",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Dosdoce",
  "status": "organisation_country"
},
  "sourceClass": "literary-media",
  "evidenceReport": "reports/r10/sources/dosdoce.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "el-boomeran",
  "name": "El Boomeran(g)",
  "url": "https://www.elboomeran.com/feed/",
  "format": "rss",
  "language": "es",
  "region": "europe",
  "sourceFamilyId": "el-boomeran",
  "countryCodes": [
  "ES"
],
  "coverageCountryCodes": [
  "ES"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://www.elboomeran.com"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://www.elboomeran.com/neruda-y-asturias-manteles-largos/"
],
  "verifiedAt": "2026-09-26T17:32:08.622Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "https://www.elboomeran.com/",
  "organisation": "El Boomeran(g)",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "El Boomeran(g)",
  "status": "organisation_country"
},
  "sourceClass": "literary-media",
  "evidenceReport": "reports/r10/sources/el-boomeran.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "il-libraio",
  "name": "Il Libraio",
  "url": "https://www.illibraio.it/feed/",
  "format": "rss",
  "language": "it",
  "region": "europe",
  "sourceFamilyId": "il-libraio",
  "countryCodes": [
  "IT"
],
  "coverageCountryCodes": [
  "IT"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://www.illibraio.it"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://www.illibraio.it/news/editoria/festival-letterari-2026-1484967/"
],
  "verifiedAt": "2026-09-26T17:32:06.224Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "https://www.illibraio.it/",
  "organisation": "Il Libraio",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Il Libraio",
  "status": "organisation_country"
},
  "sourceClass": "literary-media",
  "evidenceReport": "reports/r10/sources/il-libraio.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "salone-libro-torino",
  "name": "Salone Internazionale del Libro di Torino",
  "url": "https://www.salonelibro.it/news/tutte-news.html",
  "format": "html",
  "language": "it",
  "region": "europe",
  "sourceFamilyId": "salone-libro-torino",
  "countryCodes": [
  "IT"
],
  "coverageCountryCodes": [
  "IT"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://www.salonelibro.it"
],
  "parserVersion": "r10-source-profile-1",
  "linkSelector": "a[href]:not(nav a):not(header a):not(footer a)",
  "exampleArticleUrls": [
  "https://www.salonelibro.it/news/tutte-news/call-hangar-del-libro-2025.html"
],
  "verifiedAt": "2026-09-26T17:32:10.079Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/news\\/.+", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "https://www.salonelibro.it/",
  "organisation": "Salone Internazionale del Libro di Torino",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Salone Internazionale del Libro di Torino",
  "status": "organisation_country"
},
  "sourceClass": "festival",
  "evidenceReport": "reports/r10/sources/salone-libro-torino.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 21600
},
{
  "id": "eterna-cadencia",
  "name": "Eterna Cadencia",
  "url": "https://eternacadencia.com.ar/",
  "format": "html",
  "language": "es",
  "region": "latin-america",
  "sourceFamilyId": "eterna-cadencia",
  "countryCodes": [
  "AR"
],
  "coverageCountryCodes": [
  "AR"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://eternacadencia.com.ar"
],
  "parserVersion": "r10-source-profile-1",
  "linkSelector": "a[href]:not(nav a):not(header a):not(footer a)",
  "exampleArticleUrls": [
  "https://eternacadencia.com.ar/blog/virginia-woolf-editora"
],
  "verifiedAt": "2026-09-26T17:32:12.063Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/blog\\/.+|^\\/p\\/-iquest-por-que-son-tan-lindos-los-caballos-\\/159178\\/[^/]+\\/?$|^\\/p\\/al-norte-la-montana-al-sur-el-lago-al-oeste-el-camino-al-este-el-rio\\/190434\\/[^/]+\\/?$|^\\/p\\/la-casa-de-las-almas\\/129933\\/[^/]+\\/?$|^\\/p\\/modernidad-explosiva\\/177699\\/[^/]+\\/?$|^\\/p\\/hacia-donde-se-pone-el-sol\\/175882\\/[^/]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "https://eternacadencia.com.ar/",
  "organisation": "Eterna Cadencia",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Eterna Cadencia",
  "status": "organisation_country"
},
  "sourceClass": "publisher",
  "evidenceReport": "reports/r10/sources/eterna-cadencia.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "lom",
  "name": "LOM Ediciones",
  "url": "https://lom.cl/",
  "format": "html",
  "language": "es",
  "region": "latin-america",
  "sourceFamilyId": "lom",
  "countryCodes": [
  "CL"
],
  "coverageCountryCodes": [
  "CL"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://lom.cl"
],
  "parserVersion": "r10-source-profile-1",
  "linkSelector": "a[href]:not(nav a):not(header a):not(footer a)",
  "exampleArticleUrls": [
  "https://lom.cl/blogs/blog/hay-palabras-que-son-llamado"
],
  "verifiedAt": "2026-09-26T17:32:11.562Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/blogs\\/agenda\\/[^/]+\\/?$|^\\/blogs\\/blog\\/[^/]+\\/?$|^\\/pages\\/[^/]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "https://lom.cl/",
  "organisation": "LOM Ediciones",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "LOM Ediciones",
  "status": "organisation_country"
},
  "sourceClass": "publisher",
  "evidenceReport": "reports/r10/sources/lom.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "literary-hub",
  "name": "Literary Hub",
  "url": "https://lithub.com/",
  "format": "html",
  "language": "en",
  "region": "north-america",
  "sourceFamilyId": "literary-hub",
  "countryCodes": [
  "US"
],
  "coverageCountryCodes": [
  "US"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://lithub.com"
],
  "parserVersion": "r10-source-profile-1",
  "linkSelector": "a[href]:not(nav a):not(header a):not(footer a)",
  "exampleArticleUrls": [
  "https://lithub.com/heres-the-longlist-for-the-2026-national-book-award-for-fiction/"
],
  "verifiedAt": "2026-09-26T17:32:12.706Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/[^/]{12,}\\/?$", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "https://lithub.com/",
  "organisation": "Literary Hub",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Literary Hub",
  "status": "organisation_country"
},
  "sourceClass": "literary-media",
  "evidenceReport": "reports/r10/sources/literary-hub.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "electric-literature",
  "name": "Electric Literature",
  "url": "https://electricliterature.com/feed/",
  "format": "rss",
  "language": "en-US",
  "region": "north-america",
  "sourceFamilyId": "electric-literature",
  "countryCodes": [
  "US"
],
  "coverageCountryCodes": [
  "US"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://electricliterature.com"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://electricliterature.com/7-experimental-books-that-reimagine-how-trauma-is-told/"
],
  "verifiedAt": "2026-09-26T17:32:15.199Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "https://electricliterature.com/",
  "organisation": "Electric Literature",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Electric Literature",
  "status": "organisation_country"
},
  "sourceClass": "literary-media",
  "evidenceReport": "reports/r10/sources/electric-literature.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "words-without-borders",
  "name": "Words Without Borders",
  "url": "https://wordswithoutborders.org/",
  "format": "html",
  "language": "en",
  "region": "north-america",
  "sourceFamilyId": "words-without-borders",
  "countryCodes": [
  "US"
],
  "coverageCountryCodes": [
  "US"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://wordswithoutborders.org"
],
  "parserVersion": "r10-source-profile-1",
  "linkSelector": "a[href]:not(nav a):not(header a):not(footer a)",
  "exampleArticleUrls": [
  "https://wordswithoutborders.org/read/article/2026-09/world-kid-lit-month-2026-9-new-books-to-read-now/"
],
  "verifiedAt": "2026-09-26T17:32:13.738Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/read\\/type\\/[^/]+\\/?$|^\\/events\\/.+|^\\/read\\/article\\/2026-09\\/[^/]+\\/?$|^\\/read\\/article\\/2019-11\\/[^/]+\\/?$|^\\/read\\/article\\/2004-11\\/[^/]+\\/?$|^\\/read\\/collection\\/[^/]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "https://wordswithoutborders.org/",
  "organisation": "Words Without Borders",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Words Without Borders",
  "status": "organisation_country"
},
  "sourceClass": "literary-media",
  "evidenceReport": "reports/r10/sources/words-without-borders.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "commonwealth-foundation",
  "name": "Commonwealth Foundation",
  "url": "https://commonwealthfoundation.com/feed/",
  "format": "rss",
  "language": "en-GB",
  "region": "europe",
  "sourceFamilyId": "commonwealth-foundation",
  "countryCodes": [
  "GB"
],
  "coverageCountryCodes": [
  "GB"
],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://commonwealthfoundation.com"
],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
  "https://commonwealthfoundation.com/cwprize-longlist-2026/"
],
  "verifiedAt": "2026-09-26T17:32:14.719Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-26. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "https://commonwealthfoundation.com/",
  "organisation": "Commonwealth Foundation",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Commonwealth Foundation",
  "status": "organisation_country"
},
  "sourceClass": "literary-institution",
  "evidenceReport": "reports/r10/sources/commonwealth-foundation.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "the-rumpus",
  "name": "The Rumpus",
  "url": "https://therumpus.net/sections/news/",
  "format": "html",
  "language": "en-US",
  "region": "global",
  "sourceFamilyId": "the-rumpus",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://therumpus.net"
],
  "parserVersion": "r10-source-profile-1",
  "linkSelector": "a[href]:not(nav a):not(header a):not(footer a)",
  "exampleArticleUrls": [
  "https://therumpus.net/2026/09/29/the-october-rumpus-book-club-american-hagwon-with-min-jin-lee/"
],
  "verifiedAt": "2026-09-29T20:39:18.543Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-29. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/\\d{4}\\/\\d{2}\\/(?:\\d{2}\\/)?[^/]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "https://therumpus.net/",
  "organisation": "The Rumpus",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "The Rumpus",
  "status": "organisation_country"
},
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/the-rumpus.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "ploughshares",
  "name": "Ploughshares",
  "url": "https://pshares.org/feed/",
  "format": "rss",
  "language": "en-US",
  "region": "global",
  "sourceFamilyId": "ploughshares",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
    "publishing",
    "releases",
    "awards",
    "festivals"
  ],
  "articleOrigins": [
    "https://pshares.org"
  ],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
    "https://pshares.org/ps/tommy-orange-an-introduction-to-the-best-short-stories-2026/"
  ],
  "verifiedAt": "2026-09-29T20:39:18.612Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-29. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "countryEvidence": {
    "method": "official_organisation_identity",
    "url": "https://pshares.org/blog/",
    "organisation": "Ploughshares",
    "statement": "Organisation country is distinct from the country of each covered event.",
    "excerpt": "Ploughshares",
    "status": "organisation_country"
  },
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/ploughshares.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "kenyon-review",
  "name": "The Kenyon Review",
  "url": "https://kenyonreview.org/feed/",
  "format": "rss",
  "language": "en-US",
  "region": "global",
  "sourceFamilyId": "kenyon-review",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
    "publishing",
    "releases",
    "awards",
    "festivals"
  ],
  "articleOrigins": [
    "https://kenyonreview.org"
  ],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
    "https://kenyonreview.org/2019/10/poetry-for-people-who-hate-poetry-october-2/"
  ],
  "verifiedAt": "2026-09-29T20:39:19.185Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-29. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "countryEvidence": {
    "method": "official_organisation_identity",
    "url": "https://kenyonreview.org/",
    "organisation": "The Kenyon Review",
    "statement": "Organisation country is distinct from the country of each covered event.",
    "excerpt": "The Kenyon Review",
    "status": "organisation_country"
  },
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/kenyon-review.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "national-book-review",
  "name": "The National Book Review",
  "url": "https://www.thenationalbookreview.com/",
  "format": "html",
  "language": "en-US",
  "region": "global",
  "sourceFamilyId": "national-book-review",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://www.thenationalbookreview.com"
],
  "parserVersion": "r10-source-profile-1",
  "linkSelector": "a[href]:not(nav a):not(header a):not(footer a)",
  "exampleArticleUrls": [
  "https://www.thenationalbookreview.com/features/2026/9/23/hot-five-a-thrilling-new-book-from-scott-turow-a-cbs-anchors-memoir-and-more"
],
  "verifiedAt": "2026-09-29T20:41:40.793Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-29. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/features\\/2026\\/9\\/23\\/[^/]+\\/?$|^\\/features\\/2026\\/2\\/3\\/[^/]+\\/?$|^\\/features\\/2025\\/12\\/31\\/[^/]+\\/?$|^\\/features\\/2025\\/11\\/26\\/[^/]+\\/?$|^\\/features\\/2025\\/10\\/27\\/[^/]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "https://www.thenationalbookreview.com/",
  "organisation": "The National Book Review",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "The National Book Review",
  "status": "organisation_country"
},
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/national-book-review.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "writers-mosaic",
  "name": "WritersMosaic",
  "url": "https://writersmosaic.org.uk/",
  "format": "html",
  "language": "en-US",
  "region": "global",
  "sourceFamilyId": "writers-mosaic",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://writersmosaic.org.uk"
],
  "parserVersion": "r10-source-profile-1",
  "linkSelector": "a[href]:not(nav a):not(header a):not(footer a)",
  "exampleArticleUrls": [
  "https://writersmosaic.org.uk/my-hit-list/meredith-davis-cultural-highlights/"
],
  "verifiedAt": "2026-09-29T20:39:28.368Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-29. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/my\\x2dhit\\x2dlist\\/[^/]+\\/?$|^\\/close\\x2dup\\/[^/]+\\/?$|^\\/content\\x2dcategories\\/[^/]+\\/?$|^\\/content\\/[^/]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "https://writersmosaic.org.uk/",
  "organisation": "WritersMosaic",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "WritersMosaic",
  "status": "organisation_country"
},
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/writers-mosaic.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "books-ireland",
  "name": "Books Ireland",
  "url": "https://booksirelandmagazine.com/feed/",
  "format": "rss",
  "language": "en-GB",
  "region": "global",
  "sourceFamilyId": "books-ireland",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
    "publishing",
    "releases",
    "awards",
    "festivals"
  ],
  "articleOrigins": [
    "https://booksirelandmagazine.com"
  ],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
    "https://booksirelandmagazine.com/fiction-editing-masterclass-with-author-niamh-mulvey/"
  ],
  "verifiedAt": "2026-09-29T20:39:25.579Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-29. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "countryEvidence": {
    "method": "official_organisation_identity",
    "url": "https://booksirelandmagazine.com/",
    "organisation": "Books Ireland",
    "statement": "Organisation country is distinct from the country of each covered event.",
    "excerpt": "Books Ireland",
    "status": "organisation_country"
  },
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/books-ireland.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "publishing-scotland",
  "name": "Publishing Scotland",
  "url": "https://www.publishingscotland.org/feed/",
  "format": "rss",
  "language": "en-GB",
  "region": "global",
  "sourceFamilyId": "publishing-scotland",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
    "publishing",
    "releases",
    "awards",
    "festivals"
  ],
  "articleOrigins": [
    "https://www.publishingscotland.org"
  ],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
    "https://www.publishingscotland.org/2026/09/the-gaelic-literature-awards-2026-winners-announced/"
  ],
  "verifiedAt": "2026-09-29T20:39:24.642Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-29. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "countryEvidence": {
    "method": "official_organisation_identity",
    "url": "https://www.publishingscotland.org/",
    "organisation": "Publishing Scotland",
    "statement": "Organisation country is distinct from the country of each covered event.",
    "excerpt": "Publishing Scotland",
    "status": "organisation_country"
  },
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/publishing-scotland.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "scottish-book-trust",
  "name": "Scottish Book Trust",
  "url": "https://www.scottishbooktrust.com/about/latest-news/",
  "format": "html",
  "language": "en-GB",
  "region": "global",
  "sourceFamilyId": "scottish-book-trust",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://www.scottishbooktrust.com"
],
  "parserVersion": "r10-source-profile-1",
  "linkSelector": "a[href]:not(nav a):not(header a):not(footer a)",
  "exampleArticleUrls": [
  "https://www.scottishbooktrust.com/news/50-word-fiction-winners-august-2026-young-writers/"
],
  "verifiedAt": "2026-09-29T20:39:27.169Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-29. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/news\\/.+", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "https://www.scottishbooktrust.com/",
  "organisation": "Scottish Book Trust",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Scottish Book Trust",
  "status": "organisation_country"
},
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/scottish-book-trust.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "new-writing-north",
  "name": "New Writing North",
  "url": "https://newwritingnorth.com/feed/",
  "format": "rss",
  "language": "en",
  "region": "global",
  "sourceFamilyId": "new-writing-north",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
    "publishing",
    "releases",
    "awards",
    "festivals"
  ],
  "articleOrigins": [
    "https://newwritingnorth.com"
  ],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
    "https://newwritingnorth.com/durham-book-festival-2026/"
  ],
  "verifiedAt": "2026-09-29T20:39:26.927Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-29. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "countryEvidence": {
    "method": "official_organisation_identity",
    "url": "https://newwritingnorth.com/",
    "organisation": "New Writing North",
    "statement": "Organisation country is distinct from the country of each covered event.",
    "excerpt": "New Writing North",
    "status": "organisation_country"
  },
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/new-writing-north.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "national-centre-writing",
  "name": "National Centre for Writing",
  "url": "https://nationalcentreforwriting.org.uk/",
  "format": "html",
  "language": "en-US",
  "region": "global",
  "sourceFamilyId": "national-centre-writing",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://nationalcentreforwriting.org.uk"
],
  "parserVersion": "r10-source-profile-1",
  "linkSelector": "a[href]:not(nav a):not(header a):not(footer a)",
  "exampleArticleUrls": [
  "https://nationalcentreforwriting.org.uk/events/on-tour-with-bad-betty-press-2026/"
],
  "verifiedAt": "2026-09-29T20:39:28.971Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-29. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/events\\/.+|^\\/programmes\\/[^/]+\\/?$|^\\/get\\x2dinvolved\\/[^/]+\\/?$|^\\/[^/]{12,}\\/?$", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "https://nationalcentreforwriting.org.uk/",
  "organisation": "National Centre for Writing",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "National Centre for Writing",
  "status": "organisation_country"
},
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/national-centre-writing.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "literature-wales",
  "name": "Literature Wales",
  "url": "https://www.literaturewales.org/news/",
  "format": "html",
  "language": "en-US",
  "region": "global",
  "sourceFamilyId": "literature-wales",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://www.literaturewales.org"
],
  "parserVersion": "r10-source-profile-1",
  "linkSelector": "a[href]:not(nav a):not(header a):not(footer a)",
  "exampleArticleUrls": [
  "https://www.literaturewales.org/lw-news/applications-for-wales-book-of-the-year-2027-now-open/"
],
  "verifiedAt": "2026-09-29T20:39:29.952Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-29. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/lw\\x2dnews\\/[^/]+\\/?$|^\\/[^/]{12,}\\/?$|^\\/what\\x2dcan\\x2dliterature\\x2dwales\\x2ddo\\x2dfor\\x2dyou\\/[^/]+\\/?$|^\\/our\\x2dprojects\\/[^/]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "https://www.literaturewales.org/",
  "organisation": "Literature Wales",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Literature Wales",
  "status": "organisation_country"
},
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/literature-wales.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "books-from-scotland",
  "name": "Books from Scotland",
  "url": "https://booksfromscotland.com/",
  "format": "html",
  "language": "en-US",
  "region": "global",
  "sourceFamilyId": "books-from-scotland",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://booksfromscotland.com"
],
  "parserVersion": "r10-source-profile-1",
  "linkSelector": "a[href]:not(nav a):not(header a):not(footer a)",
  "exampleArticleUrls": [
  "https://booksfromscotland.com/2026/07/the-book-according-to-lin-anderson/"
],
  "verifiedAt": "2026-09-29T20:41:40.557Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-29. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/\\d{4}\\/\\d{2}\\/(?:\\d{2}\\/)?[^/]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "https://booksfromscotland.com/",
  "organisation": "Books from Scotland",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Books from Scotland",
  "status": "organisation_country"
},
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/books-from-scotland.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "prochtenie",
  "name": "Прочтение",
  "url": "https://prochtenie.org/news",
  "format": "html",
  "language": "ru",
  "region": "global",
  "sourceFamilyId": "prochtenie",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://prochtenie.org"
],
  "parserVersion": "r10-source-profile-1",
  "linkSelector": "a[href]:not(nav a):not(header a):not(footer a)",
  "exampleArticleUrls": [
  "https://prochtenie.org/news/31455"
],
  "verifiedAt": "2026-09-29T20:39:30.207Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-29. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/news\\/.+", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "https://prochtenie.org/",
  "organisation": "Прочтение",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Прочтение",
  "status": "organisation_country"
},
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/prochtenie.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "literaturnaya-gazeta",
  "name": "Литературная газета",
  "url": "https://lgz.ru/news/",
  "format": "html",
  "language": "ru",
  "region": "global",
  "sourceFamilyId": "literaturnaya-gazeta",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://lgz.ru"
],
  "parserVersion": "r10-source-profile-1",
  "linkSelector": "a[href]:not(nav a):not(header a):not(footer a)",
  "exampleArticleUrls": [
  "https://lgz.ru/news/premiya-solzheniczyna-u-otroshenko/"
],
  "verifiedAt": "2026-09-29T20:39:31.496Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-29. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/news\\/.+", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "https://lgz.ru/",
  "organisation": "Литературная газета",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Литературная газета",
  "status": "organisation_country"
},
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/literaturnaya-gazeta.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "literaturnaya-rossiya",
  "name": "Литературная Россия",
  "url": "https://litrossia.ru/feed/",
  "format": "rss",
  "language": "en",
  "region": "global",
  "sourceFamilyId": "literaturnaya-rossiya",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
    "publishing",
    "releases",
    "awards",
    "festivals"
  ],
  "articleOrigins": [
    "https://litrossia.ru"
  ],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
    "https://litrossia.ru/item/zhizn-poeta-bez-prikras/"
  ],
  "verifiedAt": "2026-09-29T20:39:31.388Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-29. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "countryEvidence": {
    "method": "official_organisation_identity",
    "url": "https://litrossia.ru/",
    "organisation": "Литературная Россия",
    "statement": "Organisation country is distinct from the country of each covered event.",
    "excerpt": "Литературная Россия",
    "status": "organisation_country"
  },
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/literaturnaya-rossiya.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "books-publishing-au",
  "name": "Books+Publishing",
  "url": "https://www.booksandpublishing.com.au/category/news/local-news/",
  "format": "html",
  "language": "en-AU",
  "region": "global",
  "sourceFamilyId": "books-publishing-au",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://www.booksandpublishing.com.au"
],
  "parserVersion": "r10-source-profile-1",
  "linkSelector": "a[href]:not(nav a):not(header a):not(footer a)",
  "exampleArticleUrls": [
  "https://www.booksandpublishing.com.au/articles/2026/09/28/341315/panz-book-design-awards-2026-winners/"
],
  "verifiedAt": "2026-09-29T20:39:38.588Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-29. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/articles\\/.+", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "https://www.booksandpublishing.com.au/",
  "organisation": "Books+Publishing",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Books+Publishing",
  "status": "organisation_country"
},
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/books-publishing-au.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "buchmarkt",
  "name": "BuchMarkt",
  "url": "https://buchmarkt.de/feed/",
  "format": "rss",
  "language": "de",
  "region": "global",
  "sourceFamilyId": "buchmarkt",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
    "publishing",
    "releases",
    "awards",
    "festivals"
  ],
  "articleOrigins": [
    "https://buchmarkt.de"
  ],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
    "https://buchmarkt.de/2026/09/28/ebuch-bringt-neues-magazin-hallo-2027-heraus/"
  ],
  "verifiedAt": "2026-09-29T20:41:42.627Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-29. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "countryEvidence": {
    "method": "official_organisation_identity",
    "url": "https://buchmarkt.de/",
    "organisation": "BuchMarkt",
    "statement": "Organisation country is distinct from the country of each covered event.",
    "excerpt": "BuchMarkt",
    "status": "organisation_country"
  },
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/buchmarkt.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "literaturcafe",
  "name": "literaturcafe.de",
  "url": "https://www.literaturcafe.de/feed/podcast/",
  "format": "rss",
  "language": "de",
  "region": "global",
  "sourceFamilyId": "literaturcafe",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
    "publishing",
    "releases",
    "awards",
    "festivals"
  ],
  "articleOrigins": [
    "https://www.literaturcafe.de"
  ],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
    "https://www.literaturcafe.de/bachmannpreis-podcast-2026-3-buchtipps-vor-dem-doppeljubilaeum-kavouras-piekar-und-sebauer/"
  ],
  "verifiedAt": "2026-09-29T20:39:37.971Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-29. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "countryEvidence": {
    "method": "official_organisation_identity",
    "url": "https://www.literaturcafe.de/",
    "organisation": "literaturcafe.de",
    "statement": "Organisation country is distinct from the country of each covered event.",
    "excerpt": "literaturcafe.de",
    "status": "organisation_country"
  },
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/literaturcafe.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "boersenblatt",
  "name": "Börsenblatt",
  "url": "https://www.boersenblatt.net/thema/alle-news-aus-der-buchbranche",
  "format": "html",
  "language": "de",
  "region": "global",
  "sourceFamilyId": "boersenblatt",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://www.boersenblatt.net"
],
  "parserVersion": "r10-source-profile-1",
  "linkSelector": "a[href]:not(nav a):not(header a):not(footer a)",
  "exampleArticleUrls": [
  "https://www.boersenblatt.net/news/boersenverein/vorlesewettbewerb-2026/27-deutschlands-bestes-vorlesetalent-gesucht-442525"
],
  "verifiedAt": "2026-09-29T20:39:36.943Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-29. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/news\\/.+|^\\/home\\/[^/]+\\/?$|^\\/thema\\/[^/]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "https://www.boersenblatt.net/",
  "organisation": "Börsenblatt",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Börsenblatt",
  "status": "organisation_country"
},
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/boersenblatt.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "buchkultur",
  "name": "Buchkultur",
  "url": "https://www.buchkultur.net/feed/",
  "format": "rss",
  "language": "de",
  "region": "global",
  "sourceFamilyId": "buchkultur",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
    "publishing",
    "releases",
    "awards",
    "festivals"
  ],
  "articleOrigins": [
    "https://www.buchkultur.net"
  ],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
    "https://www.buchkultur.net/ganz-wien-packt-das-lesefieber/"
  ],
  "verifiedAt": "2026-09-29T20:39:42.306Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-29. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "countryEvidence": {
    "method": "official_organisation_identity",
    "url": "https://www.buchkultur.net/",
    "organisation": "Buchkultur",
    "statement": "Organisation country is distinct from the country of each covered event.",
    "excerpt": "Buchkultur",
    "status": "organisation_country"
  },
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/buchkultur.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "minima-moralia",
  "name": "minima&moralia",
  "url": "https://minimaetmoralia.it/feed/",
  "format": "rss",
  "language": "it-IT",
  "region": "global",
  "sourceFamilyId": "minima-moralia",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
    "publishing",
    "releases",
    "awards",
    "festivals"
  ],
  "articleOrigins": [
    "https://minimaetmoralia.it"
  ],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
    "https://minimaetmoralia.it/interviste/diventare-se-stessi-contro-cio-che-abbiamo-ereditato-intervista-a-douglas-stuart/"
  ],
  "verifiedAt": "2026-09-29T20:39:42.544Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-29. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "countryEvidence": {
    "method": "official_organisation_identity",
    "url": "https://www.minimaetmoralia.it/",
    "organisation": "minima&moralia",
    "statement": "Organisation country is distinct from the country of each covered event.",
    "excerpt": "minima&moralia",
    "status": "organisation_country"
  },
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/minima-moralia.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "sololibri",
  "name": "SoloLibri",
  "url": "https://www.sololibri.net/spip.php?page=backend",
  "format": "rss",
  "language": "it",
  "region": "global",
  "sourceFamilyId": "sololibri",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
    "publishing",
    "releases",
    "awards",
    "festivals"
  ],
  "articleOrigins": [
    "https://www.sololibri.net"
  ],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
    "https://www.sololibri.net/Lo-Sbilico-finalista-Premio-Campiello-2026.html"
  ],
  "verifiedAt": "2026-09-29T20:39:41.470Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-29. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "countryEvidence": {
    "method": "official_organisation_identity",
    "url": "https://www.sololibri.net/",
    "organisation": "SoloLibri",
    "statement": "Organisation country is distinct from the country of each covered event.",
    "excerpt": "SoloLibri",
    "status": "organisation_country"
  },
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/sololibri.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "letture-org",
  "name": "Letture.org",
  "url": "https://www.letture.org/feed",
  "format": "rss",
  "language": "it-IT",
  "region": "global",
  "sourceFamilyId": "letture-org",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
    "publishing",
    "releases",
    "awards",
    "festivals"
  ],
  "articleOrigins": [
    "https://www.letture.org"
  ],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
    "https://www.letture.org/nella-mente-di-un-intellettuale-medievale-brunetto-latini-e-il-suo-mondo-gianluca-briguglia"
  ],
  "verifiedAt": "2026-09-29T20:39:42.953Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-29. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "countryEvidence": {
    "method": "official_organisation_identity",
    "url": "https://www.letture.org/",
    "organisation": "Letture.org",
    "statement": "Organisation country is distinct from the country of each covered event.",
    "excerpt": "Letture.org",
    "status": "organisation_country"
  },
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/letture-org.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "zenda-libros",
  "name": "Zenda",
  "url": "https://www.zendalibros.com/feed/",
  "format": "rss",
  "language": "es",
  "region": "global",
  "sourceFamilyId": "zenda-libros",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
    "publishing",
    "releases",
    "awards",
    "festivals"
  ],
  "articleOrigins": [
    "https://www.zendalibros.com"
  ],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
    "https://www.zendalibros.com/juan-jose-millas-ganador-del-xvii-premio-jose-luis-sampedro-2026/"
  ],
  "verifiedAt": "2026-09-29T20:39:43.943Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-29. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "countryEvidence": {
    "method": "official_organisation_identity",
    "url": "https://www.zendalibros.com/",
    "organisation": "Zenda",
    "statement": "Organisation country is distinct from the country of each covered event.",
    "excerpt": "Zenda",
    "status": "organisation_country"
  },
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/zenda-libros.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "estandarte",
  "name": "Estandarte",
  "url": "https://www.estandarte.com/noticias",
  "format": "html",
  "language": "es",
  "region": "global",
  "sourceFamilyId": "estandarte",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://www.estandarte.com"
],
  "parserVersion": "r10-source-profile-1",
  "linkSelector": "a[href]:not(nav a):not(header a):not(footer a)",
  "exampleArticleUrls": [
  "https://www.estandarte.com/noticias/autores/santa-teresa-libros-en-los-quinientos-anos-de-su-nacimiento_3026.html"
],
  "verifiedAt": "2026-09-29T20:39:44.102Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-29. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/noticias\\/.+", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "https://www.estandarte.com/",
  "organisation": "Estandarte",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Estandarte",
  "status": "organisation_country"
},
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/estandarte.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "placer-lectura",
  "name": "El Placer de la Lectura",
  "url": "https://elplacerdelalectura.com/feed",
  "format": "rss",
  "language": "es",
  "region": "global",
  "sourceFamilyId": "placer-lectura",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
    "publishing",
    "releases",
    "awards",
    "festivals"
  ],
  "articleOrigins": [
    "https://elplacerdelalectura.com"
  ],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
    "https://elplacerdelalectura.com/2026/09/julia-navarro-recomienda-la-ultima-novela-historica-de-lorenzo-silva-es-un-libro-total-es-una-biografia-una-novela-un-libro-de-historia-y-un-ensayo-2.html"
  ],
  "verifiedAt": "2026-09-29T20:39:44.772Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-29. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "countryEvidence": {
    "method": "official_organisation_identity",
    "url": "https://elplacerdelalectura.com/",
    "organisation": "El Placer de la Lectura",
    "statement": "Organisation country is distinct from the country of each covered event.",
    "excerpt": "El Placer de la Lectura",
    "status": "organisation_country"
  },
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/placer-lectura.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "en-attendant-nadeau",
  "name": "En attendant Nadeau",
  "url": "https://www.en-attendant-nadeau.fr/feed/",
  "format": "rss",
  "language": "fr-FR",
  "region": "global",
  "sourceFamilyId": "en-attendant-nadeau",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
    "publishing",
    "releases",
    "awards",
    "festivals"
  ],
  "articleOrigins": [
    "https://www.en-attendant-nadeau.fr"
  ],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
    "https://www.en-attendant-nadeau.fr/2026/09/02/une-fiction-a-la-hauteur-du-present-noham-selcer/"
  ],
  "verifiedAt": "2026-09-29T20:39:48.791Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-29. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "countryEvidence": {
    "method": "official_organisation_identity",
    "url": "https://www.en-attendant-nadeau.fr/",
    "organisation": "En attendant Nadeau",
    "statement": "Organisation country is distinct from the country of each covered event.",
    "excerpt": "En attendant Nadeau",
    "status": "organisation_country"
  },
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/en-attendant-nadeau.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "le-litteraire",
  "name": "Le Litteraire",
  "url": "https://www.lelitteraire.com/feed/",
  "format": "rss",
  "language": "fr-FR",
  "region": "global",
  "sourceFamilyId": "le-litteraire",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
    "publishing",
    "releases",
    "awards",
    "festivals"
  ],
  "articleOrigins": [
    "https://www.lelitteraire.com"
  ],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
    "https://www.lelitteraire.com/jean-pierre-otte-sinfonia-la-delivrante/"
  ],
  "verifiedAt": "2026-09-29T20:39:45.773Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-29. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "countryEvidence": {
    "method": "official_organisation_identity",
    "url": "https://www.lelitteraire.com/",
    "organisation": "Le Litteraire",
    "statement": "Organisation country is distinct from the country of each covered event.",
    "excerpt": "Le Litteraire",
    "status": "organisation_country"
  },
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/le-litteraire.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "recours-poeme",
  "name": "Recours au Poème",
  "url": "https://www.recoursaupoeme.fr/feed/",
  "format": "rss",
  "language": "fr-FR",
  "region": "global",
  "sourceFamilyId": "recours-poeme",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
    "publishing",
    "releases",
    "awards",
    "festivals"
  ],
  "articleOrigins": [
    "https://www.recoursaupoeme.fr"
  ],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
    "https://www.recoursaupoeme.fr/lotir-le-ciel-a-9-rien-du-pire-disabelle-levesque-ou-lexperience-du-vol-arriere-2/"
  ],
  "verifiedAt": "2026-09-29T20:39:46.174Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-29. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "countryEvidence": {
    "method": "official_organisation_identity",
    "url": "https://www.recoursaupoeme.fr/",
    "organisation": "Recours au Poème",
    "statement": "Organisation country is distinct from the country of each covered event.",
    "excerpt": "Recours au Poème",
    "status": "organisation_country"
  },
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/recours-poeme.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "short-story-day-africa",
  "name": "Short Story Day Africa",
  "url": "https://shortstorydayafrica.org/?feed=rss2",
  "format": "rss",
  "language": "en-US",
  "region": "global",
  "sourceFamilyId": "short-story-day-africa",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
    "publishing",
    "releases",
    "awards",
    "festivals"
  ],
  "articleOrigins": [
    "https://shortstorydayafrica.org"
  ],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
    "https://shortstorydayafrica.org/?p=14"
  ],
  "verifiedAt": "2026-09-29T20:39:56.638Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-29. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "countryEvidence": {
    "method": "official_organisation_identity",
    "url": "https://shortstorydayafrica.org/",
    "organisation": "Short Story Day Africa",
    "statement": "Organisation country is distinct from the country of each covered event.",
    "excerpt": "Short Story Day Africa",
    "status": "organisation_country"
  },
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/short-story-day-africa.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "poets-writers",
  "name": "Poets & Writers",
  "url": "https://www.pw.org/",
  "format": "html",
  "language": "en",
  "region": "global",
  "sourceFamilyId": "poets-writers",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://www.pw.org"
],
  "parserVersion": "r10-source-profile-1",
  "linkSelector": "a[href]:not(nav a):not(header a):not(footer a)",
  "exampleArticleUrls": [
  "https://www.pw.org/content/the_new_nonfiction_2026"
],
  "verifiedAt": "2026-09-29T20:42:42.287Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-29. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/content\\/[^/]+\\/?$|^\\/[^/]{12,}\\/?$", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "https://www.pw.org/",
  "organisation": "Poets & Writers",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Poets & Writers",
  "status": "organisation_country"
},
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/poets-writers.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "poets-org",
  "name": "Academy of American Poets",
  "url": "https://poets.org/",
  "format": "html",
  "language": "en",
  "region": "global",
  "sourceFamilyId": "poets-org",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://poets.org"
],
  "parserVersion": "r10-source-profile-1",
  "linkSelector": "a[href]:not(nav a):not(header a):not(footer a)",
  "exampleArticleUrls": [
  "https://poets.org/september-2026-poem-day-guest-editor-maya-c-popa"
],
  "verifiedAt": "2026-09-29T20:42:42.295Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-09-29. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/[^/]{12,}\\/?$|^\\/academy\\x2damerican\\x2dpoets\\/[^/]+\\/?$|^\\/node\\/[^/]+\\/?$|^\\/poem\\/[^/]+\\/?$|^\\/poet\\/[^/]+\\/?$|^\\/index\\x252ephp\\/poem\\/[^/]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "https://poets.org/",
  "organisation": "Academy of American Poets",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Academy of American Poets",
  "status": "organisation_country"
},
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/poets-org.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "pik-org-pl",
  "name": "Polish Chamber of Books (PIK)",
  "url": "https://pik.org.pl/feed/",
  "format": "rss",
  "language": "pl-PL",
  "region": "europe",
  "sourceFamilyId": "pik-org-pl",
  "countryCodes": [
    "PL"
  ],
  "coverageCountryCodes": [
    "PL"
  ],
  "topics": [
    "publishing",
    "releases",
    "awards",
    "festivals"
  ],
  "articleOrigins": [
    "https://pik.org.pl"
  ],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
    "https://pik.org.pl/2026/10/01/program-dla-branzy-na-miedzynarodowych-targach-ksiazki-w-krakowie/"
  ],
  "verifiedAt": "2026-10-01T20:43:52.173Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "countryEvidence": {
    "method": "official_membership_directory",
    "url": "https://internationalpublishers.org/about/",
    "organisation": "Polish Chamber of Books (PIK)ul. Oleandrów",
    "statement": "Organisation country is distinct from the country of each covered event.",
    "excerpt": "Polish Chamber of Books (PIK)ul. Oleandrów 8, 00-629 Warsaw Poland www.pik.org.pl",
    "status": "organisation_country"
  },
  "sourceClass": "publishing-association",
  "evidenceReport": "reports/r10/sources/reprobe-20261001/pik-org-pl.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "millikitabxana-az",
  "name": "National Library of Azerbaijan",
  "url": "https://www.millikitabxana.az/en/news",
  "format": "html",
  "language": "en",
  "region": "europe",
  "sourceFamilyId": "millikitabxana-az",
  "countryCodes": [
  "AZ"
],
  "coverageCountryCodes": [
  "AZ"
],
  "topics": [
  "heritage",
  "discoveries",
  "festivals",
  "releases"
],
  "articleOrigins": [
  "https://www.millikitabxana.az"
],
  "parserVersion": "r10-source-profile-1",
  "linkSelector": "a[href]:not(nav a):not(header a):not(footer a)",
  "exampleArticleUrls": [
  "https://www.millikitabxana.az/en/news/umumdunya-kitab-ve-muelliflik-huququ-gunu-2026"
],
  "verifiedAt": "2026-10-01T20:43:49.301Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/en\\/news\\/.+", ""),
  "countryEvidence": {
  "method": "official_national_library_directory",
  "url": "https://www.cenl.org/library/national-library-of-azerbaijan-m-f-axundov-adina-azerbaycan-milli-kitabxana/",
  "organisation": "National Library of Azerbaijan",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Azerbaycan Milli Kitabxana / National Library of Azerbaijan",
  "status": "organisation_country"
},
  "sourceClass": "library",
  "evidenceReport": "reports/r10/sources/reprobe-20261001/millikitabxana-az.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "nationallibrary-bg",
  "name": "St.St. Cyril and Methodius National Library",
  "url": "https://www.nationallibrary.bg/www/feed/",
  "format": "rss",
  "language": "bg-BG",
  "region": "europe",
  "sourceFamilyId": "nationallibrary-bg",
  "countryCodes": [
    "BG"
  ],
  "coverageCountryCodes": [
    "BG"
  ],
  "topics": [
    "heritage",
    "discoveries",
    "festivals",
    "releases"
  ],
  "articleOrigins": [
    "https://www.nationallibrary.bg"
  ],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
    "https://www.nationallibrary.bg/www/2026/09/29/%d0%bd%d0%b0%d1%86%d0%b8%d0%be%d0%bd%d0%b0%d0%bb%d0%bd%d0%b0%d1%82%d0%b0-%d0%b1%d0%b8%d0%b1%d0%bb%d0%b8%d0%be%d1%82%d0%b5%d0%ba%d0%b0-%d0%be%d1%82%d0%ba%d1%80%d0%b8-%d0%bb%d0%b8%d1%82%d0%b5%d1%80-4/"
  ],
  "verifiedAt": "2026-10-01T20:43:54.151Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "countryEvidence": {
    "method": "official_national_library_directory",
    "url": "https://www.cenl.org/library/national-library-of-bulgaria-st-st-cyrill-and-methodius-national-library/",
    "organisation": "St.St. Cyril and Methodius National Library",
    "statement": "Organisation country is distinct from the country of each covered event.",
    "excerpt": "Национална библиотека „Св. cв. Кирил и Методий / St.St. Cyril and Methodius National Library",
    "status": "organisation_country"
  },
  "sourceClass": "library",
  "evidenceReport": "reports/r10/sources/reprobe-20261001/nationallibrary-bg.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "chicago-review-books",
  "name": "Chicago Review of Books",
  "url": "https://chireviewofbooks.com/feed/",
  "format": "rss",
  "language": "en-US",
  "region": "global",
  "sourceFamilyId": "chicago-review-books",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
    "publishing",
    "releases",
    "awards",
    "festivals"
  ],
  "articleOrigins": [
    "https://chireviewofbooks.com"
  ],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
    "https://chireviewofbooks.com/2026/10/01/announcing-the-2026-chicago-review-of-books-awards-shortlist/"
  ],
  "verifiedAt": "2026-10-01T20:56:28.009Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "countryEvidence": {
    "method": "official_organisation_identity",
    "url": "https://chireviewofbooks.com/",
    "organisation": "Chicago Review of Books",
    "statement": "Organisation country is distinct from the country of each covered event.",
    "excerpt": "Chicago Review of Books",
    "status": "organisation_country"
  },
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/reprobe-20261001/chicago-review-books.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "archipelago-books",
  "name": "Archipelago Books",
  "url": "https://archipelagobooks.org/feed/",
  "format": "rss",
  "language": "en-US",
  "region": "north-america",
  "sourceFamilyId": "archipelago-books",
  "countryCodes": [
    "US"
  ],
  "coverageCountryCodes": [],
  "topics": [
    "publishing",
    "releases",
    "awards",
    "festivals"
  ],
  "articleOrigins": [
    "https://archipelagobooks.org"
  ],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
    "https://archipelagobooks.org/2025/04/mira-rosenthal-receives-the-2025-found-in-translation-award/"
  ],
  "verifiedAt": "2026-10-01T20:47:53.200Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "countryEvidence": {
    "method": "official_contact_address",
    "url": "https://archipelagobooks.org/",
    "organisation": "Archipelago Books",
    "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
    "excerpt": "Archipelago Books & Elsewhere Editions The Old American Can Factory 232 Third Street #A111 Brooklyn, NY 11215 [email protected] Illustrations created by artist Gracey Zhang ExploreAbout News Books Events Support My Account Latest Catalog ConnectSign",
    "status": "organisation_country",
    "scope": "footer",
    "responseSha256": "f087a1a4b3941314bd9a57ef284b06c57652fcdbe8047dabd8e0fe8ad57f66f0",
    "accessedAt": "2026-10-01T21:03:58.984Z"
  },
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/archipelago-books.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "acantilado",
  "name": "Acantilado",
  "url": "https://www.acantilado.es/feed/",
  "format": "rss",
  "language": "es",
  "region": "europe",
  "sourceFamilyId": "acantilado",
  "countryCodes": [
    "ES"
  ],
  "coverageCountryCodes": [],
  "topics": [
    "publishing",
    "releases",
    "awards",
    "festivals"
  ],
  "articleOrigins": [
    "https://www.acantilado.es"
  ],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
    "https://www.acantilado.es/jose-maria-mico-premio-internacional-alfonso-reyes-2026/"
  ],
  "verifiedAt": "2026-10-01T20:47:51.410Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "countryEvidence": {
    "method": "official_contact_address",
    "url": "https://www.acantilado.es/contacto/",
    "organisation": "Acantilado",
    "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
    "excerpt": "Contacto Muntaner, 462 E-08006 Barcelona Tel.: (+34) 934 144 906 correo@acantilado.es En Acantilado no se aceptan ni valoran manuscritos no solicitados. Distribución Distribución Si lo desea",
    "status": "organisation_country",
    "scope": "official_contact_page",
    "responseSha256": "59bf8ff79cf3175fa4fc8d4e414ffacab4ccd18879b429251a967a999e0d41e0",
    "accessedAt": "2026-10-01T21:03:59.184Z"
  },
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/acantilado.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "biblioasis",
  "name": "Biblioasis",
  "url": "https://www.biblioasis.com/feed/",
  "format": "rss",
  "language": "en-US",
  "region": "north-america",
  "sourceFamilyId": "biblioasis",
  "countryCodes": [
    "CA"
  ],
  "coverageCountryCodes": [],
  "topics": [
    "publishing",
    "releases",
    "awards",
    "festivals"
  ],
  "articleOrigins": [
    "https://www.biblioasis.com"
  ],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
    "https://www.biblioasis.com/on-book-banning-and-on-oil-finalists-for-the-2026-writers-trust-shaughnessy-cohen-prize/"
  ],
  "verifiedAt": "2026-10-01T20:47:52.945Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "countryEvidence": {
    "method": "official_contact_address",
    "url": "https://www.biblioasis.com/contact/",
    "organisation": "Biblioasis",
    "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
    "excerpt": "ContactYou are here: Home1 / Contact Biblioasis Bookstore is located at: 1520 Wyandotte Street East Windsor, ON N9A 3L2 Tel: 519-968-2206 Email: bookstore@biblioasis.com biblioasisbookshop.com Biblioasis Publishing (Office Only) is located at: 1686 Ottawa S",
    "status": "organisation_country",
    "scope": "official_contact_page",
    "responseSha256": "2e9126b980c2753cdeef2ef11e1a20ef85883244a9c6fe25099f4bdfd3f33756",
    "accessedAt": "2026-10-01T21:04:02.681Z"
  },
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/biblioasis.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "serpents-tail",
  "name": "Serpent’s Tail",
  "url": "https://serpentstail.com/feed/",
  "format": "rss",
  "language": "en-GB",
  "region": "europe",
  "sourceFamilyId": "serpents-tail",
  "countryCodes": [
    "GB"
  ],
  "coverageCountryCodes": [],
  "topics": [
    "publishing",
    "releases",
    "awards",
    "festivals"
  ],
  "articleOrigins": [
    "https://serpentstail.com"
  ],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
    "https://serpentstail.com/2025/11/20/lush-by-rochelle-dowden-lord-shortlisted-for-the-2025-debut-fiction-nero-book-award/"
  ],
  "verifiedAt": "2026-10-01T20:47:53.523Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "countryEvidence": {
    "method": "official_contact_address",
    "url": "https://serpentstail.com/",
    "organisation": "Serpent’s Tail",
    "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
    "excerpt": "h x Basket 0 © 2026 Profile Books Limited Serpent's Tail, an imprint of Profile Books 29 Cloth Fair London EC1A 7JQ Email: [email protected] Phone: + 44 20 7841 6300 Registered in England & Wales under No. 3120147 VAT Number 674 9638 76 About Serpent’s Tai",
    "status": "organisation_country",
    "scope": "footer",
    "responseSha256": "0b49c55d8779957266ed9299b8f8076d32548d37d90f11eb06fdeeb9e8d7d683",
    "accessedAt": "2026-10-01T21:03:59.348Z"
  },
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/serpents-tail.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "fitzcarraldo",
  "name": "Fitzcarraldo Editions",
  "url": "https://fitzcarraldoeditions.com/news/",
  "format": "html",
  "language": "en-US",
  "region": "global",
  "sourceFamilyId": "fitzcarraldo",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://fitzcarraldoeditions.com"
],
  "parserVersion": "r10-source-profile-1",
  "linkSelector": "a[href]:not(nav a):not(header a):not(footer a)",
  "exampleArticleUrls": [
  "https://fitzcarraldoeditions.com/2026/06/independent-bookshop-week-2026-at-lala-books-camberwell/"
],
  "verifiedAt": "2026-10-01T20:47:53.212Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/\\d{4}\\/\\d{2}\\/(?:\\d{2}\\/)?[^/]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "https://fitzcarraldoeditions.com/",
  "organisation": "Fitzcarraldo Editions",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Fitzcarraldo Editions",
  "status": "office_country_unconfirmed"
},
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/fitzcarraldo.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "virago",
  "name": "Virago",
  "url": "https://www.virago.co.uk/category/virago-news/",
  "format": "html",
  "language": "en-US",
  "region": "europe",
  "sourceFamilyId": "hachette-livre",
  "countryCodes": [
  "GB"
],
  "coverageCountryCodes": [],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://www.virago.co.uk"
],
  "parserVersion": "r10-source-profile-1",
  "linkSelector": "a[href]:not(nav a):not(header a):not(footer a)",
  "exampleArticleUrls": [
  "https://www.virago.co.uk/virago-news/2026/08/26/five-australian-classics/"
],
  "verifiedAt": "2026-10-01T20:56:32.294Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/virago\\x2dnews\\/2026\\/08\\/26\\/[^/]+\\/?$|^\\/virago\\x2dnews\\/2026\\/07\\/14\\/[^/]+\\/?$|^\\/virago\\x2dnews\\/2026\\/06\\/25\\/[^/]+\\/?$|^\\/virago\\x2dnews\\/2026\\/05\\/31\\/[^/]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_contact_address",
  "url": "https://www.virago.co.uk/imprint/lbbg/virago/page/about-virago/virago-company-information/",
  "organisation": "Virago",
  "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
  "excerpt": "ollows: Little, Brown Book Group Limited Registered address: Carmelite House 50 Victoria Embankment LONDON EC4Y 0DZ United Kingdom Registration number: 2304585 VAT number: 205505305 Telephone Number: +44 (0)20 3122 7000 Email: info@littlebrown.co.uk Hachet",
  "status": "organisation_country",
  "scope": "official_contact_page",
  "responseSha256": "0bfa8e8216a60b5e3ae6d13fe843702ba8522a822c0ff35ad035e9c2bc0437b4",
  "accessedAt": "2026-10-01T21:04:00.074Z"
},
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/virago.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "hachette-book-group",
  "name": "Hachette Book Group",
  "url": "https://www.hachettebookgroup.com/feed/",
  "format": "rss",
  "language": "en-US",
  "region": "north-america",
  "sourceFamilyId": "hachette-livre",
  "countryCodes": [
    "US"
  ],
  "coverageCountryCodes": [],
  "topics": [
    "publishing",
    "releases",
    "awards",
    "festivals"
  ],
  "articleOrigins": [
    "https://www.hachettebookgroup.com"
  ],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
    "https://www.hachettebookgroup.com/raising-readers/hachette-book-group-named-finalist-in-ragans-2026-zenith-awards-for-raising-readers-social-impact-campaign/"
  ],
  "verifiedAt": "2026-10-01T20:56:34.007Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "countryEvidence": {
    "method": "official_contact_address",
    "url": "https://www.hachettebookgroup.com/",
    "organisation": "Hachette Book Group",
    "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
    "excerpt": "Footer Hachette Book Group is a leading book publisher based in New York and a division of Hachette Livre, the third-largest publisher in the world. Social Media Facebook Twitter Instagram YouTube Tiktok Linkedin Pinterest",
    "status": "organisation_country",
    "scope": "footer",
    "responseSha256": "1b9606682370a30dc179b18610ff1163710171c07284dbf80d7a40b5931c031d",
    "accessedAt": "2026-10-01T21:04:00.939Z"
  },
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/hachette-book-group.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "harpercollins-india",
  "name": "HarperCollins India",
  "url": "https://harpercollins.co.in/feed/",
  "format": "rss",
  "language": "en-US",
  "region": "asia",
  "sourceFamilyId": "harpercollins-india",
  "countryCodes": [
    "IN"
  ],
  "coverageCountryCodes": [],
  "topics": [
    "publishing",
    "releases",
    "awards",
    "festivals"
  ],
  "articleOrigins": [
    "https://harpercollins.co.in"
  ],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
    "https://harpercollins.co.in/blog/top-nutrition-and-wellbeing-books-for-indian-readers/"
  ],
  "verifiedAt": "2026-10-01T20:48:03.416Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "countryEvidence": {
    "method": "official_contact_address",
    "url": "https://harpercollins.co.in/contact-us/",
    "organisation": "HarperCollins India",
    "statement": "Organisation office country confirmed from its own contact address, independently of article or event geography.",
    "excerpt": "Address4th Floor, Cyber City, Building No 10,Tower A, Gurugram, Haryana 122002, IndiaPhone+91 12448-94800 Download QR ExploreBooksFirst chapterAuthorsaudiobooksblogsVideosAbout usAbout usteamimprintscataloguescontact usOur ContributorsHarper broadcastblogpress",
    "status": "organisation_country",
    "scope": "official_contact_page",
    "responseSha256": "b8243a56b67aac05b11754eb829fe9fd16c1adc078a22d9d9475817534381d90",
    "accessedAt": "2026-10-01T21:16:16.930Z"
  },
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/harpercollins-india.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "nyrb",
  "name": "New York Review Books",
  "url": "https://www.nyrb.com/blogs/nyrb-news",
  "format": "html",
  "language": "en",
  "region": "north-america",
  "sourceFamilyId": "nyrb",
  "countryCodes": [
  "US"
],
  "coverageCountryCodes": [],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://www.nyrb.com"
],
  "parserVersion": "r10-source-profile-1",
  "linkSelector": "a[href]:not(nav a):not(header a):not(footer a)",
  "exampleArticleUrls": [
  "https://www.nyrb.com/blogs/nyrb-news/2026-pen-translation-prize-winner-minna-zallman-proctors-translation-of-the-leucothea-dialogues"
],
  "verifiedAt": "2026-10-01T20:47:56.105Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/blogs\\/nyrb\\x2dnews\\/[^/]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_contact_address",
  "url": "https://www.nyrb.com/pages/contact-us",
  "organisation": "New York Review Books",
  "statement": "Organisation office country confirmed from its own contact address, independently of article or event geography.",
  "excerpt": "New York Review Books207 East 32nd StNew York, NY 10016-6305Tel 212 757-8070Fax 212 333-5374 Book OrdersTel 646 215-2500Fax 212 333-5374 Please visit our Frequently Asked Questions page for answers to common queries. Examination and Desk Copy Requests: Our boo",
  "status": "organisation_country",
  "scope": "official_contact_page",
  "responseSha256": "2292a97a4240a32d788c67ca2b6ae21017d349e26a810412fb45029e16302b02",
  "accessedAt": "2026-10-01T21:16:11.489Z"
},
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/nyrb.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "coffee-house-press",
  "name": "Coffee House Press",
  "url": "https://coffeehousepress.org/blogs/news",
  "format": "html",
  "language": "en",
  "region": "global",
  "sourceFamilyId": "coffee-house-press",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://coffeehousepress.org"
],
  "parserVersion": "r10-source-profile-1",
  "linkSelector": "a[href]:not(nav a):not(header a):not(footer a)",
  "exampleArticleUrls": [
  "https://coffeehousepress.org/blogs/news/brian-evenson-named-a-finalist-for-the-2025-world-fantasy-awards"
],
  "verifiedAt": "2026-10-01T20:47:58.021Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/blogs\\/news\\/[^/]+\\/?$|^\\/collections\\/[^/]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "https://coffeehousepress.org/",
  "organisation": "Coffee House Press",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Coffee House Press",
  "status": "office_country_unconfirmed"
},
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/coffee-house-press.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "europa-editions",
  "name": "Europa Editions",
  "url": "https://www.europaeditions.com/news",
  "format": "html",
  "language": "en",
  "region": "north-america",
  "sourceFamilyId": "europa-editions",
  "countryCodes": [
  "US"
],
  "coverageCountryCodes": [],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://www.europaeditions.com"
],
  "parserVersion": "r10-source-profile-1",
  "linkSelector": "a[href]:not(nav a):not(header a):not(footer a)",
  "exampleArticleUrls": [
  "https://www.europaeditions.com/news/2674/passengers-longlisted-for-the-national-book-award"
],
  "verifiedAt": "2026-10-01T20:48:00.959Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/news\\/.+", ""),
  "countryEvidence": {
  "method": "official_contact_address",
  "url": "https://www.europaeditions.com/",
  "organisation": "Europa Editions",
  "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
  "excerpt": "us Contact us Our authors Latest titles Follow us © Europa Editions 27 Union Square West, Suite 302 New York, N.Y. 10003 | info@europaeditions.com | privacy | cookie | credits",
  "status": "organisation_country",
  "scope": "footer",
  "responseSha256": "1e2c75d718c4e94a02794a3140eed8d7e30675dde2137e6e109207e1902ee364",
  "accessedAt": "2026-10-01T21:04:02.298Z"
},
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/europa-editions.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "saraband",
  "name": "Saraband",
  "url": "https://saraband.net/feed/",
  "format": "rss",
  "language": "en-GB",
  "region": "global",
  "sourceFamilyId": "saraband",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
    "publishing",
    "releases",
    "awards",
    "festivals"
  ],
  "articleOrigins": [
    "https://saraband.net"
  ],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
    "https://saraband.net/2026/03/04/debut-author-rozie-kellys-kingfisher-longlisted-for-the-womens-prize-for-fiction-2026/"
  ],
  "verifiedAt": "2026-10-01T20:48:04.445Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "countryEvidence": {
    "method": "official_organisation_identity",
    "url": "https://saraband.net/",
    "organisation": "Saraband",
    "statement": "Organisation country is distinct from the country of each covered event.",
    "excerpt": "Saraband",
    "status": "office_country_unconfirmed"
  },
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/saraband.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "comma-press",
  "name": "Comma Press",
  "url": "https://commapress.co.uk/",
  "format": "html",
  "language": "en",
  "region": "global",
  "sourceFamilyId": "comma-press",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://commapress.co.uk"
],
  "parserVersion": "r10-source-profile-1",
  "linkSelector": "a[href]:not(nav a):not(header a):not(footer a)",
  "exampleArticleUrls": [
  "https://commapress.co.uk/news/comma-press-opens-dinesh-allirajah-prize-2027-submissions"
],
  "verifiedAt": "2026-10-01T20:48:04.864Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/news\\/.+|^\\/events\\/.+|^\\/series\\/[^/]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "https://commapress.co.uk/",
  "organisation": "Comma Press",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Comma Press",
  "status": "office_country_unconfirmed"
},
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/comma-press.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "editions-verdier",
  "name": "Editions Verdier",
  "url": "https://editions-verdier.fr/feed/",
  "format": "rss",
  "language": "fr-FR",
  "region": "europe",
  "sourceFamilyId": "editions-verdier",
  "countryCodes": [
    "FR"
  ],
  "coverageCountryCodes": [],
  "topics": [
    "publishing",
    "releases",
    "awards",
    "festivals"
  ],
  "articleOrigins": [
    "https://editions-verdier.fr"
  ],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
    "https://editions-verdier.fr/2026/09/21/la-croix-18-septembre-2026-par-isaure-hiace/"
  ],
  "verifiedAt": "2026-10-01T20:48:06.696Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "countryEvidence": {
    "method": "official_contact_address",
    "url": "https://editions-verdier.fr/informations-generales/",
    "organisation": "Editions Verdier",
    "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
    "excerpt": "er (1945-2009), Colette Olive et Michèle Planel. Contacts Siège social : 11220 LagrassePermanence à Paris : 82, boulevard de Ménilmontant - 75020 Paris(33) 01 43 79 20 45contact[at]editions-verdier.fr GérancePierre Audoux, Mathilde Azzopardi, Émilie Thoma",
    "status": "organisation_country",
    "scope": "official_contact_page",
    "responseSha256": "3d64b08f564f25678b3d1abe44365b13fd94093c6998da8f3e0e08a1a1189620",
    "accessedAt": "2026-10-01T21:04:03.411Z"
  },
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/editions-verdier.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "editions-metailie",
  "name": "Editions Métailié",
  "url": "https://editions-metailie.com/feed/",
  "format": "rss",
  "language": "fr-FR",
  "region": "europe",
  "sourceFamilyId": "editions-metailie",
  "countryCodes": [
    "FR"
  ],
  "coverageCountryCodes": [],
  "topics": [
    "publishing",
    "releases",
    "awards",
    "festivals"
  ],
  "articleOrigins": [
    "https://editions-metailie.com"
  ],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
    "https://editions-metailie.com/chronique/lhumanite/"
  ],
  "verifiedAt": "2026-10-01T20:48:05.542Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "countryEvidence": {
    "method": "official_contact_address",
    "url": "https://editions-metailie.com/",
    "organisation": "Editions Métailié",
    "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
    "excerpt": "ombie Ecosse Pologne Mozambique Amérique Latine Allemagne Belgique Brésil Nicaragua Angleterre Cuba France Espagne Italie Chili Irlande Portugal Pérou Angola Uruguay Éditions Métailié 20 rue des Grands Augustins 75006 PARIS 01 56 81 02 45 Suivez-nous sur ©",
    "status": "organisation_country",
    "scope": "footer",
    "responseSha256": "aa262648ccde352befafa52b3ce992df1e1e4e7505274e8d1229966fea1b61eb",
    "accessedAt": "2026-10-01T21:04:03.156Z"
  },
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/editions-metailie.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "quidam-editeur",
  "name": "Quidam Editeur",
  "url": "https://www.quidamediteur.com/actus",
  "format": "html",
  "language": "fr",
  "region": "global",
  "sourceFamilyId": "quidam-editeur",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://www.quidamediteur.com"
],
  "parserVersion": "r10-source-profile-1",
  "linkSelector": "a[href]:not(nav a):not(header a):not(footer a)",
  "exampleArticleUrls": [
  "https://www.quidamediteur.com/actus/lili"
],
  "verifiedAt": "2026-10-01T20:48:07.183Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/actus\\/[^/]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "https://www.quidamediteur.com/contact",
  "organisation": "Quidam Editeur",
  "status": "office_country_unconfirmed",
  "statement": "Observed country names describe distribution, publishing coverage or a brand rather than an independently confirmed organisation office address."
},
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/quidam-editeur.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "anagrama",
  "name": "Anagrama",
  "url": "https://www.anagrama-ed.es/",
  "format": "html",
  "language": "es",
  "region": "europe",
  "sourceFamilyId": "anagrama",
  "countryCodes": [
  "ES"
],
  "coverageCountryCodes": [],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://www.anagrama-ed.es"
],
  "parserVersion": "r10-source-profile-1",
  "linkSelector": "a[href]:not(nav a):not(header a):not(footer a)",
  "exampleArticleUrls": [
  "https://www.anagrama-ed.es/noticias/general/trece-tachas-halladas-detras-de-una-novela-1694"
],
  "verifiedAt": "2026-10-01T20:48:07.656Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/noticias\\/.+|^\\/libro\\/panorama\\x2dde\\x2dnarrativas\\/\\x2dque\\x2dsoy\\x2dun\\x2dciervo\\x2d\\/9788433951144\\/[^/]+\\/?$|^\\/libro\\/compactos\\/el\\x2ddesfile\\x2ddel\\x2damor\\/9788433950871\\/[^/]+\\/?$|^\\/radio\\x2danagrama\\/tema\\x2dlibre\\/[^/]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_contact_address",
  "url": "https://www.anagrama-ed.es/",
  "organisation": "Anagrama",
  "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
  "excerpt": "Pau Claris, 172. 08037 Barcelona. Editorial fundada por Jorge Herralde Grau en 1969. En nuestro catálogo figuran más de 4.500 títulos, donde se pueden encontrar muchos de los autores",
  "status": "organisation_country",
  "scope": "footer",
  "responseSha256": "d91a3c880422ed2bad5d025532db6e2b9ec1c28abbde947e47372e0d93496c8e",
  "accessedAt": "2026-10-01T21:04:03.677Z"
},
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/anagrama.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "libros-asteroide",
  "name": "Libros del Asteroide",
  "url": "https://librosdelasteroide.com/",
  "format": "html",
  "language": "es",
  "region": "europe",
  "sourceFamilyId": "libros-asteroide",
  "countryCodes": [
  "ES"
],
  "coverageCountryCodes": [],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://librosdelasteroide.com"
],
  "parserVersion": "r10-source-profile-1",
  "linkSelector": "a[href]:not(nav a):not(header a):not(footer a)",
  "exampleArticleUrls": [
  "https://librosdelasteroide.com/actualidad-asteroide/440/tierra-la-nueva-novela-de-maggie-ofarrell-llegara-a-librerias-el-1-de-febrero-de-2027"
],
  "verifiedAt": "2026-10-01T20:48:08.447Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/actualidad\\x2dasteroide\\/440\\/[^/]+\\/?$|^\\/actualidad\\x2dasteroide\\/425\\/[^/]+\\/?$|^\\/actualidad\\x2dasteroide\\/442\\/[^/]+\\/?$|^\\/[^/]{12,}\\/?$|^\\/actualidad\\x2dasteroide\\/438\\/[^/]+\\/?$|^\\/paseos\\/77\\/[^/]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_contact_address",
  "url": "https://librosdelasteroide.com/",
  "organisation": "Libros del Asteroide",
  "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
  "excerpt": "Contacto C/ Santaló 11, 3º 1ª 08021 Barcelona, España +34 93 280 25 24 Contexto de editores Libros del Asteroide es miembro de Contexto de Editores Más información Distribución Consulta aquí nues",
  "status": "organisation_country",
  "scope": "footer",
  "responseSha256": "4c6532058d9d9ff78bbde2f7507e796b6efb875c9a5b759e8e252ac7be0a4e80",
  "accessedAt": "2026-10-01T21:04:04.178Z"
},
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/libros-asteroide.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "impedimenta",
  "name": "Impedimenta",
  "url": "https://impedimenta.es/feed",
  "format": "rss",
  "language": "es",
  "region": "europe",
  "sourceFamilyId": "impedimenta",
  "countryCodes": [
    "ES"
  ],
  "coverageCountryCodes": [],
  "topics": [
    "publishing",
    "releases",
    "awards",
    "festivals"
  ],
  "articleOrigins": [
    "https://impedimenta.es"
  ],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
    "https://impedimenta.es/archivos/38218"
  ],
  "verifiedAt": "2026-10-01T20:48:10.505Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "countryEvidence": {
    "method": "official_contact_address",
    "url": "https://impedimenta.es/",
    "organisation": "Impedimenta",
    "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
    "excerpt": " electrónico He leído y acepto la Política de privacidad REGISTRO Juan Álvarez Mendizábal, 27 28008 Madrid, España +34 915 401 988edicion@impedimenta.es Nosotros Aviso legal y Privacidad Política de Cookies Catálogo Distribuidores Foreign rights SeguirSegu",
    "status": "organisation_country",
    "scope": "footer",
    "responseSha256": "46481ba3e4aabefe3504e413444184d04478bc63b83b638f51da31332d5e0cda",
    "accessedAt": "2026-10-01T21:04:04.855Z"
  },
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/impedimenta.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "nordica-libros",
  "name": "Nórdica Libros",
  "url": "https://nordicalibros.com/feed/",
  "format": "rss",
  "language": "es",
  "region": "europe",
  "sourceFamilyId": "nordica-libros",
  "countryCodes": [
    "ES"
  ],
  "coverageCountryCodes": [],
  "topics": [
    "publishing",
    "releases",
    "awards",
    "festivals"
  ],
  "articleOrigins": [
    "https://nordicalibros.com"
  ],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
    "https://nordicalibros.com/las-tres-recomendaciones-para-la-feria-del-libro-de-madrid/"
  ],
  "verifiedAt": "2026-10-01T20:48:22.035Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "countryEvidence": {
    "method": "official_contact_address",
    "url": "https://nordicalibros.com/contacto/",
    "organisation": "Nórdica Libros",
    "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
    "excerpt": "ares a los anteriormente contratados por el destinatario. Dirección Doctor Blanco Soler, 26. 28054. Madrid Teléfono +34 917 055 057 Email info@nordicalibros.com",
    "status": "organisation_country",
    "scope": "official_contact_page",
    "responseSha256": "6b805be86d2efda94999cfacf2b7f8e6b960455d5ee94a87422ada5298f4932d",
    "accessedAt": "2026-10-01T21:04:06.623Z"
  },
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/nordica-libros.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "aufbau",
  "name": "Aufbau",
  "url": "https://www.aufbau-verlage.de/pressemitteilungen",
  "format": "html",
  "language": "de",
  "region": "europe",
  "sourceFamilyId": "aufbau",
  "countryCodes": [
  "DE"
],
  "coverageCountryCodes": [],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://www.aufbau-verlage.de"
],
  "parserVersion": "r10-source-profile-1",
  "linkSelector": "a[href]:not(nav a):not(header a):not(footer a)",
  "exampleArticleUrls": [
  "https://www.aufbau-verlage.de/aufbau-audio/deutscher-hoerbuchpreis-2026-0"
],
  "verifiedAt": "2026-10-01T20:48:12.799Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/aufbau\\x2daudio\\/[^/]+\\/?$|^\\/more\\/[^/]+\\/?$|^\\/[^/]{12,}\\/?$", ""),
  "countryEvidence": {
  "method": "official_contact_address",
  "url": "https://www.aufbau-verlage.de/impressum",
  "organisation": "Aufbau",
  "statement": "Organisation office country confirmed from its own contact address, independently of article or event geography.",
  "excerpt": "Aufbau Verlage GmbH & Co. KG Prinzenstraße 85 10969 Berlin Telefon +49(0) 30 28394 -0 Fax +49(0) 30 28394 -100 E-Mail: info[at]aufbau-verlage.de Registergericht: Amtsgericht Charlottenburg Registernummer: HRA 40423 B USt.Ident.Nr: DE 261725915 Persönlich hafte",
  "status": "organisation_country",
  "scope": "official_contact_page",
  "responseSha256": "f3eef1dfbaf333d2c160ff17e7b4c01503773c97c44bfbb9256535e5786fbe0b",
  "accessedAt": "2026-10-01T21:16:10.388Z"
},
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/aufbau.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "klett-cotta",
  "name": "Klett-Cotta",
  "url": "https://www.klett-cotta.de/aktuelles/news-c-106",
  "format": "html",
  "language": "de",
  "region": "europe",
  "sourceFamilyId": "klett-cotta",
  "countryCodes": [
  "DE"
],
  "coverageCountryCodes": [],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://www.klett-cotta.de"
],
  "parserVersion": "r10-source-profile-1",
  "linkSelector": "a[href]:not(nav a):not(header a):not(footer a)",
  "exampleArticleUrls": [
  "https://www.klett-cotta.de/beitrag/georg-buechner-preis-2025-fuer-ursula-krechel-b-342"
],
  "verifiedAt": "2026-10-01T20:48:16.016Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/beitrag\\/[^/]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_contact_address",
  "url": "https://www.klett-cotta.de/service/kontakt-c-105",
  "organisation": "Klett-Cotta",
  "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
  "excerpt": "Kontakt - Klett-Cotta-Verlag (J. G. Cotta’sche Buchhandlung Nachfolger GmbH)Rotebühlstraße 77 70178 Stuttgart Telefon 0711/6672-0 Fax: 0711/6672-2030 info@klett-cotta.de Abteilungen, Informationen und Ansprechpartner Für Leser:innen E-Mail: info@klett-cotta.d",
  "status": "organisation_country",
  "scope": "official_contact_page",
  "responseSha256": "9b2d856fc164cee94f4dcc1b6e15f0e70d4386617bdbe908e7bdd64092f19996",
  "accessedAt": "2026-10-01T21:04:04.814Z"
},
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/klett-cotta.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "minimum-fax",
  "name": "Minimum Fax",
  "url": "https://www.minimumfax.com/#",
  "format": "html",
  "language": "it-IT",
  "region": "europe",
  "sourceFamilyId": "minimum-fax",
  "countryCodes": [
  "IT"
],
  "coverageCountryCodes": [],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://www.minimumfax.com"
],
  "parserVersion": "r10-source-profile-1",
  "linkSelector": "a[href]:not(nav a):not(header a):not(footer a)",
  "exampleArticleUrls": [
  "https://www.minimumfax.com/event/giuseppe-de-marzo-a-roma-2026-10-08-2130"
],
  "verifiedAt": "2026-10-01T20:48:18.656Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/event\\/.+", ""),
  "countryEvidence": {
  "method": "official_contact_address",
  "url": "https://www.minimumfax.com/",
  "organisation": "Minimum Fax",
  "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
  "excerpt": "Denominazione sociale: MINIMUM FAX S.R.L. Sede legale: ROMA (RM) VIALE DELLA BELLA VILLA, 1 (ALTEZZA VIA CASILINA 939) - CAP 00172 Numero e sede di iscrizione al registro imprese: RM-1997-155274 DEL 25/02/1997",
  "status": "organisation_country",
  "scope": "footer",
  "responseSha256": "8f3cb102688b53a8f40adcc565773dd3d32f2e7eb6fab7e1ad426a1bad45854e",
  "accessedAt": "2026-10-01T21:04:05.185Z"
},
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/minimum-fax.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "iperborea",
  "name": "Iperborea",
  "url": "https://iperborea.com/news/",
  "format": "html",
  "language": "it",
  "region": "europe",
  "sourceFamilyId": "iperborea",
  "countryCodes": [
  "IT"
],
  "coverageCountryCodes": [],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://iperborea.com"
],
  "parserVersion": "r10-source-profile-1",
  "linkSelector": "a[href]:not(nav a):not(header a):not(footer a)",
  "exampleArticleUrls": [
  "https://iperborea.com/news/992/premio-orbil-2026-a-lotte-pelomatto/"
],
  "verifiedAt": "2026-10-01T20:48:17.797Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/news\\/.+", ""),
  "countryEvidence": {
  "method": "official_contact_address",
  "url": "https://iperborea.com/",
  "organisation": "Iperborea",
  "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
  "excerpt": "IPERBOREA SRL Via Gian Battista Vico, 16/A 20123 Milano - P.IVA IT08968860158 Cap. Soc. € 46.000,00 iperborea@pec.it Privacy Policy Cookie Policy Sitemap Chi siamo Paesi Titoli Autori News Eventi Contatti ",
  "status": "organisation_country",
  "scope": "footer",
  "responseSha256": "51beab132d83eaeb79f6fd4c0f079a3c724b83479caed301049bf951513ab159",
  "accessedAt": "2026-10-01T21:04:06.240Z"
},
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/iperborea.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "nottetempo",
  "name": "Nottetempo",
  "url": "https://www.edizioninottetempo.it/",
  "format": "html",
  "language": "it",
  "region": "global",
  "sourceFamilyId": "nottetempo",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://www.edizioninottetempo.it"
],
  "parserVersion": "r10-source-profile-1",
  "linkSelector": "a[href]:not(nav a):not(header a):not(footer a)",
  "exampleArticleUrls": [
  "https://www.edizioninottetempo.it/it/newspost/nottetempo-a-pi-libri-pi-liberi-2025"
],
  "verifiedAt": "2026-10-01T20:48:20.651Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/it\\/newspost\\/[^/]+\\/?$|^\\/it\\/[^/]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "https://www.edizioninottetempo.it/",
  "organisation": "Nottetempo",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Nottetempo",
  "status": "office_country_unconfirmed"
},
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/nottetempo.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "bookhug",
  "name": "Book*hug Press",
  "url": "https://bookhugpress.ca/feed/",
  "format": "rss",
  "language": "en-US",
  "region": "north-america",
  "sourceFamilyId": "bookhug",
  "countryCodes": [
    "CA"
  ],
  "coverageCountryCodes": [],
  "topics": [
    "publishing",
    "releases",
    "awards",
    "festivals"
  ],
  "articleOrigins": [
    "https://bookhugpress.ca"
  ],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
    "https://bookhugpress.ca/bookhug-wrapped-2025-authors-edition/"
  ],
  "verifiedAt": "2026-10-01T20:48:32.357Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "countryEvidence": {
    "method": "official_contact_address",
    "url": "https://bookhugpress.ca/contact-bookhugpress/",
    "organisation": "Book*hug Press",
    "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
    "excerpt": "Contact Us and Masthead Contact Information Address Book*hug Press 401 Richmond St. West Suite 251 Toronto, ON M5V 3A8, Canada Masthead Jay Millar, Co-publisher Hazel Millar, Co-publisher Reid Millar, Sales and Marketing Manager Britt Landry, Managing Edit",
    "status": "organisation_country",
    "scope": "official_contact_page",
    "responseSha256": "31845775946e6ad65ea25b934302507e817b36fd494338b6830f9f5907fe2fa0",
    "accessedAt": "2026-10-01T21:04:14.059Z"
  },
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/bookhug.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "arsenal-pulp",
  "name": "Arsenal Pulp Press",
  "url": "https://arsenalpulp.com/News",
  "format": "html",
  "language": "en",
  "region": "north-america",
  "sourceFamilyId": "arsenal-pulp",
  "countryCodes": [
  "CA"
],
  "coverageCountryCodes": [],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://arsenalpulp.com"
],
  "parserVersion": "r10-source-profile-1",
  "linkSelector": "a[href]:not(nav a):not(header a):not(footer a)",
  "exampleArticleUrls": [
  "https://arsenalpulp.com/News/2026/BC-and-Yukon-Book-Prize-winners-Amber-Dawn-Lea-Taranto-and-L.E.-Fox"
],
  "verifiedAt": "2026-10-01T20:48:23.679Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/News\\/.+", ""),
  "countryEvidence": {
  "method": "official_contact_address",
  "url": "https://arsenalpulp.com/About-Arsenal-Pulp-Press/Contact",
  "organisation": "Arsenal Pulp Press",
  "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
  "excerpt": "Arsenal Pulp Press #202 - 211 East Georgia Street Vancouver, BC, V6A 1Z6Canada phone 604.687.4233fax 604.687.4283Follow us on FacebookFollow us on Twitter: @ArsenalpulpFollow us on Instagram: @arsenalpulp Gene",
  "status": "organisation_country",
  "scope": "official_contact_page",
  "responseSha256": "2cb9f01ce6dcd18e04b6ded0c9e5e295e6436904f57fcb7f35896070490c7c97",
  "accessedAt": "2026-10-01T21:04:07.347Z"
},
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/arsenal-pulp.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "scribe-publications",
  "name": "Scribe Publications",
  "url": "https://scribepublications.com.au/news",
  "format": "html",
  "language": "en",
  "region": "oceania",
  "sourceFamilyId": "scribe-publications",
  "countryCodes": [
  "AU"
],
  "coverageCountryCodes": [],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://scribepublications.com.au"
],
  "parserVersion": "r10-source-profile-1",
  "linkSelector": "a[href]:not(nav a):not(header a):not(footer a)",
  "exampleArticleUrls": [
  "https://scribepublications.com.au/news/night-of-a-thousand-hells-is-longlisted-for-the-2026-translated-literature-national-book-award"
],
  "verifiedAt": "2026-10-01T20:48:28.910Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/news\\/.+", ""),
  "countryEvidence": {
  "method": "official_contact_address",
  "url": "https://scribepublications.com.au/contact",
  "organisation": "Scribe Publications",
  "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
  "excerpt": "ContactScribe Publications18-20 Edward Street Brunswick 3056 Victoria, Australia Tel: ‭+61 3 9388 8780‬info@scribepub.com.auVisit Scribe UK or USScribe UKScribe USScribe PublicationsIf you’re looking for information on how to get ",
  "status": "organisation_country",
  "scope": "official_contact_page",
  "responseSha256": "06a6dfcea41fa5ad5d064b09496ef3a8dbe8691dfe868a64399cd828e8bced7d",
  "accessedAt": "2026-10-01T21:04:07.656Z"
},
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/scribe-publications.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "uqp",
  "name": "University of Queensland Press",
  "url": "https://www.uqp.com.au/",
  "format": "html",
  "language": "en",
  "region": "oceania",
  "sourceFamilyId": "uqp",
  "countryCodes": [
  "AU"
],
  "coverageCountryCodes": [],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://www.uqp.com.au"
],
  "parserVersion": "r10-source-profile-1",
  "linkSelector": "a[href]:not(nav a):not(header a):not(footer a)",
  "exampleArticleUrls": [
  "https://www.uqp.com.au/blog/uqp-authors-shortlisted-for-the-2026-south-australian-literary-awards"
],
  "verifiedAt": "2026-10-01T20:48:32.632Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/blog\\/.+", ""),
  "countryEvidence": {
  "method": "official_contact_address",
  "url": "https://www.uqp.com.au/",
  "organisation": "University of Queensland Press",
  "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
  "excerpt": "n back to top Phone: +61 7 3365 7244 Fax: +61 7 3365 7579 Email: reception@uqp.com.au University of Queensland Press PO Box 6042 St Lucia, QLD 4067 Australia © The University of Queensland 2026 Privacy & Terms of use website by Inkahoots Acknowledgement of Tra",
  "status": "organisation_country",
  "scope": "footer",
  "responseSha256": "7dbc40ee7fbf001db01b40fdde25d8eeb66a5e3c4871eeb8b186ec848dcb2e50",
  "accessedAt": "2026-10-01T21:04:11.558Z"
},
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/uqp.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "fremantle-press",
  "name": "Fremantle Press",
  "url": "https://fremantlepress.com.au/feed/",
  "format": "rss",
  "language": "en-AU",
  "region": "oceania",
  "sourceFamilyId": "fremantle-press",
  "countryCodes": [
    "AU"
  ],
  "coverageCountryCodes": [],
  "topics": [
    "publishing",
    "releases",
    "awards",
    "festivals"
  ],
  "articleOrigins": [
    "https://fremantlepress.com.au"
  ],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
    "https://fremantlepress.com.au/2026/09/23/names-of-a-hare-one-leap-closer-to-the-2026-hnsa-award-for-adult-fiction/"
  ],
  "verifiedAt": "2026-10-01T20:48:40.440Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "countryEvidence": {
    "method": "official_contact_address",
    "url": "https://fremantlepress.com.au/contact-us/",
    "organisation": "Fremantle Press",
    "statement": "Organisation office country confirmed from its own contact address, independently of article or event geography.",
    "excerpt": "Postal address:Fremantle Press1/10 Parry StreetFremantle WA 6160 Street address:1/10 Parry StreetFremantle WA 6160 T+61 (0)8 9430 6331E admin@fremantlepress.com.auABN 78 910 098 021 Custom publishingVisit our custom publishing page Foreign rights, sales and di",
    "status": "organisation_country",
    "scope": "official_contact_page",
    "responseSha256": "9577a142ef26e5773bc985fedd85085a763aaad1666c19da6f84b67b545b925f",
    "accessedAt": "2026-10-01T21:16:22.236Z"
  },
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/fremantle-press.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "spinifex-press",
  "name": "Spinifex Press",
  "url": "https://www.spinifexpress.com.au/",
  "format": "html",
  "language": "en-GB",
  "region": "global",
  "sourceFamilyId": "spinifex-press",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://www.spinifexpress.com.au"
],
  "parserVersion": "r10-source-profile-1",
  "linkSelector": "a[href]:not(nav a):not(header a):not(footer a)",
  "exampleArticleUrls": [
  "https://www.spinifexpress.com.au/events/over-the-rainbow-online-book-launch-with-sall-grover"
],
  "verifiedAt": "2026-10-01T20:48:33.750Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/events\\/.+|^\\/ebook\\x2dstore\\/p\\/[^/]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "https://www.spinifexpress.com.au/",
  "organisation": "Spinifex Press",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Spinifex Press",
  "status": "office_country_unconfirmed"
},
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/spinifex-press.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "czechlit",
  "name": "Czech Literary Centre",
  "url": "https://www.czechlit.cz/en/feed/",
  "format": "rss",
  "language": "en-GB",
  "region": "global",
  "sourceFamilyId": "czechlit",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
    "publishing",
    "releases",
    "awards",
    "festivals"
  ],
  "articleOrigins": [
    "https://www.czechlit.cz"
  ],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
    "https://www.czechlit.cz/en/results-support-for-foreign-translations-of-czech-literature/"
  ],
  "verifiedAt": "2026-10-01T20:48:34.128Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "countryEvidence": {
    "method": "official_organisation_identity",
    "url": "https://www.czechlit.cz/en/",
    "organisation": "Czech Literary Centre",
    "statement": "Organisation country is distinct from the country of each covered event.",
    "excerpt": "Czech Literary Centre",
    "status": "office_country_unconfirmed"
  },
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/czechlit.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "wsoy",
  "name": "WSOY",
  "url": "https://www.wsoy.fi/",
  "format": "html",
  "language": "fi",
  "region": "europe",
  "sourceFamilyId": "wsoy",
  "countryCodes": [
  "FI"
],
  "coverageCountryCodes": [],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://www.wsoy.fi"
],
  "parserVersion": "r10-source-profile-1",
  "linkSelector": "a[href]:not(nav a):not(header a):not(footer a)",
  "exampleArticleUrls": [
  "https://www.wsoy.fi/artikkelit/wsoyn-syksyn-2026-kirjat-on-julkistettu/"
],
  "verifiedAt": "2026-10-01T20:48:38.679Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/artikkelit\\/[^/]+\\/?$|^\\/kirjat\\/[^/]+\\/?$|^\\/tekija\\/[^/]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_contact_address",
  "url": "https://www.wsoy.fi/",
  "organisation": "WSOY",
  "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
  "excerpt": "Käyntiosoite Lönnrotinkatu 18 A00120 Helsinki Postiosoite PL 125900101 Helsinki Puhelinvaihde 010 5060 200 Tietosuoja ja rekisteriselosteEvästeetBriefly in English Lönnrotinkatu 18 A00120 Helsink",
  "status": "organisation_country",
  "scope": "footer",
  "responseSha256": "ec21be8157d0a5623c34d91b12bbcf7157d562b5a43249ebbdcd1a4c10aa9b31",
  "accessedAt": "2026-10-01T21:04:11.874Z"
},
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/wsoy.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "ordfront",
  "name": "Ordfront",
  "url": "https://ordfrontforlag.se/feed/podcast/ordfronten/",
  "format": "rss",
  "language": "sv-SE",
  "region": "europe",
  "sourceFamilyId": "ordfront",
  "countryCodes": [
    "SE"
  ],
  "coverageCountryCodes": [],
  "topics": [
    "publishing",
    "releases",
    "awards",
    "festivals"
  ],
  "articleOrigins": [
    "https://ordfrontforlag.se"
  ],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
    "https://ordfrontforlag.se/podcast/kvinnor-skulle-inte-ens-ga-ut-pa-stan-ensamma-an-mindre-resa/"
  ],
  "verifiedAt": "2026-10-01T20:48:39.638Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "countryEvidence": {
    "method": "official_contact_address",
    "url": "https://ordfrontforlag.se/",
    "organisation": "Ordfront",
    "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
    "excerpt": "Genvägar Press Manus Vi som jobbar här Om oss Kontakta oss Besöksadress: Stortorget 1 111 29 Stockholm Fakturaadress: Ordfront förlag c/o Förlagsekonomi Skönviksvägen 238 122 42 Enskede faktura.5567980957@forlagsekonomi.se Följ oss FacebookInstagramTwi",
    "status": "organisation_country",
    "scope": "footer",
    "responseSha256": "1a2e1f2bc7b75380d557b08fca1a794d0cf27a20111c70d2ec39044ce25531c7",
    "accessedAt": "2026-10-01T21:04:12.091Z"
  },
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/ordfront.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "ikaros",
  "name": "Ikaros",
  "url": "https://ikarosbooks.gr/el/",
  "format": "html",
  "language": "el",
  "region": "europe",
  "sourceFamilyId": "ikaros",
  "countryCodes": [
  "GR"
],
  "coverageCountryCodes": [],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://ikarosbooks.gr"
],
  "parserVersion": "r10-source-profile-1",
  "linkSelector": "a[href]:not(nav a):not(header a):not(footer a)",
  "exampleArticleUrls": [
  "https://ikarosbooks.gr/el/news/prosekheis-ekdoseis-septembrios-dekembrios-2026/"
],
  "verifiedAt": "2026-10-01T20:48:40.662Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/el\\/news\\/.+|^\\/el\\/events\\/.+", ""),
  "countryEvidence": {
  "method": "official_contact_address",
  "url": "https://ikarosbooks.gr/el/contact/",
  "organisation": "Ikaros",
  "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
  "excerpt": "άθεσή σας για την καλύτερη δυνατή εξυπηρέτηση. Βιβλιοπωλείο, Παραγγελίες Βουλής 4, Σύνταγμα 105 62, Αθήνα Τηλ: 210 3225152 fax: 211 2687003 Email: orders@ikarosbooks.gr Εκδόσεις, Λογιστήριο, Ατελιέ Βουλής 35, Σύνταγμα 105 57, Αθήνα Τηλ: 216 7005964 Email:",
  "status": "organisation_country",
  "scope": "official_contact_page",
  "responseSha256": "971bcba3a5150da6dba9b1f49063e253cfcfe98a65bc2899746fac79c0bf35bf",
  "accessedAt": "2026-10-01T21:04:13.065Z"
},
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/ikaros.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "adarna",
  "name": "Adarna House",
  "url": "https://adarna.com.ph/",
  "format": "html",
  "language": "en",
  "region": "asia",
  "sourceFamilyId": "adarna",
  "countryCodes": [
  "PH"
],
  "coverageCountryCodes": [],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://adarna.com.ph"
],
  "parserVersion": "r10-source-profile-1",
  "linkSelector": "a[href]:not(nav a):not(header a):not(footer a)",
  "exampleArticleUrls": [
  "https://adarna.com.ph/blogs/kuwentong-adarna/adarna-house-goes-to-frankfurt-book-fair-2025"
],
  "verifiedAt": "2026-10-01T20:48:43.690Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/blogs\\/kuwentong\\x2dadarna\\/[^/]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_contact_address",
  "url": "https://adarna.com.ph/",
  "organisation": "Adarna House",
  "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
  "excerpt": "babasang Filipino. Visit us109 Scout Fernandez corner Scout Torillo Streets, Barangay Sacred Heart, Quezon City, 1103 Open hoursMon - Fri · 8:00 AM - 5:00 PM Get in touch kaibigan@adarna.com.ph © 2026 Adarna House, Inc. All rights reserved. PayPal",
  "status": "organisation_country",
  "scope": "footer",
  "responseSha256": "c97a2289217e966cc296687cdc83ff2f39f47fe70e3a960b03ea2d78dc8e598a",
  "accessedAt": "2026-10-01T21:04:12.559Z"
},
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/adarna.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "women-prize",
  "name": "Women’s Prize for Fiction",
  "url": "https://womensprize.com/",
  "format": "html",
  "language": "en-US",
  "region": "global",
  "sourceFamilyId": "women-prize",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://womensprize.com"
],
  "parserVersion": "r10-source-profile-1",
  "linkSelector": "a[href]:not(nav a):not(header a):not(footer a)",
  "exampleArticleUrls": [
  "https://womensprize.com/event/write-like-a-reader-with-daisy-buchanan/"
],
  "verifiedAt": "2026-10-01T20:48:47.365Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/event\\/.+|^\\/[^/]{12,}\\/?$", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "https://womensprize.com/",
  "organisation": "Women’s Prize for Fiction",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Women’s Prize for Fiction",
  "status": "office_country_unconfirmed"
},
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/women-prize.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "booker-new-media",
  "name": "The Bookseller",
  "url": "https://www.thebookseller.com/Syndication/DF.cfm?f=7&ft=10",
  "format": "rss",
  "language": "en",
  "region": "global",
  "sourceFamilyId": "booker-new-media",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
    "publishing",
    "releases",
    "awards",
    "festivals"
  ],
  "articleOrigins": [
    "https://www.thebookseller.com"
  ],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
    "https://www.thebookseller.com/news/baillie-gifford-prize-for-non-fiction-reveals-2026-shortlist"
  ],
  "verifiedAt": "2026-10-01T20:48:48.056Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "countryEvidence": {
    "method": "official_organisation_identity",
    "url": "https://www.thebookseller.com/news",
    "organisation": "The Bookseller",
    "statement": "Organisation country is distinct from the country of each covered event.",
    "excerpt": "The Bookseller",
    "status": "office_country_unconfirmed"
  },
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/booker-new-media.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "bookbrunch",
  "name": "BookBrunch",
  "url": "https://www.bookbrunch.co.uk/#",
  "format": "html",
  "language": "en",
  "region": "global",
  "sourceFamilyId": "bookbrunch",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://www.bookbrunch.co.uk"
],
  "parserVersion": "r10-source-profile-1",
  "linkSelector": "a[href]:not(nav a):not(header a):not(footer a)",
  "exampleArticleUrls": [
  "https://www.bookbrunch.co.uk/page/article-detail/baillie-gifford-prize-announces-eclectic-charismatic-2026-shortlist"
],
  "verifiedAt": "2026-10-01T20:48:49.621Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/page\\/article\\x2ddetail\\/[^/]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "https://www.bookbrunch.co.uk/",
  "organisation": "BookBrunch",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "BookBrunch",
  "status": "office_country_unconfirmed"
},
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/bookbrunch.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "big-book-award",
  "name": "Большая книга",
  "url": "https://bigbook.ru/novosti",
  "format": "html",
  "language": "ru-RU",
  "region": "global",
  "sourceFamilyId": "big-book-award",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://bigbook.ru"
],
  "parserVersion": "r10-source-profile-1",
  "linkSelector": "a[href]:not(nav a):not(header a):not(footer a)",
  "exampleArticleUrls": [
  "https://bigbook.ru/novosti/natsionalnaya-literaturnaya-premiya-bolshaya-kniga-obyavila-spisok-finalistov-xxi-sezona"
],
  "verifiedAt": "2026-10-01T20:48:51.447Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/novosti\\/.+|^\\/eksperty\\/[^/]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "https://bigbook.ru/",
  "organisation": "Большая книга",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "Большая книга",
  "status": "office_country_unconfirmed"
},
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/big-book-award.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "yasnaya-polyana-award",
  "name": "Премия Ясная Поляна",
  "url": "https://www.yppremia.ru/news",
  "format": "html",
  "language": "ru",
  "region": "europe",
  "sourceFamilyId": "yasnaya-polyana-award",
  "countryCodes": [
  "RU"
],
  "coverageCountryCodes": [],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://www.yppremia.ru"
],
  "parserVersion": "r10-source-profile-1",
  "linkSelector": "a[href]:not(nav a):not(header a):not(footer a)",
  "exampleArticleUrls": [
  "https://www.yppremia.ru/news/besplatny-dostup-k-knigam-finalistov-2026"
],
  "verifiedAt": "2026-10-01T20:48:49.034Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/news\\/.+", ""),
  "countryEvidence": {
  "method": "official_contact_address",
  "url": "https://www.yppremia.ru/contacts",
  "organisation": "Премия Ясная Поляна",
  "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
  "excerpt": "ращаться к координатору литературной премии «Ясная Поляна»: E-mail yppremia@yandex.ru адрес 119034, Россия, Москва, ул. Льва Толстого, д. 21 Музей-усадьба Л.Н. Толстого «Хамовники» (с пометкой «Литературная премия «Ясная Поляна») подписатьсяна нашу рассылк",
  "status": "organisation_country",
  "scope": "official_contact_page",
  "responseSha256": "2ba681b79ccbb809a7d46add53a838f1f8356e2654a7c23b93c1719c1c261404",
  "accessedAt": "2026-10-01T21:04:14.542Z"
},
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/yasnaya-polyana-award.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "voprosy-literatury",
  "name": "Вопросы литературы",
  "url": "https://voplit.ru/category/events/",
  "format": "html",
  "language": "ru-RU",
  "region": "europe",
  "sourceFamilyId": "voprosy-literatury",
  "countryCodes": [
  "RU"
],
  "coverageCountryCodes": [],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://voplit.ru"
],
  "parserVersion": "r10-source-profile-1",
  "linkSelector": "a[href]:not(nav a):not(header a):not(footer a)",
  "exampleArticleUrls": [
  "https://voplit.ru/2023/12/28/legkaya-kavaleriya-uchrezhdaet-ezhegodnuyu-premiyu-tri-bogatyrya/"
],
  "verifiedAt": "2026-10-01T20:48:50.927Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/\\d{4}\\/\\d{2}\\/(?:\\d{2}\\/)?[^/]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_contact_address",
  "url": "https://voplit.ru/about/contacts/",
  "organisation": "Вопросы литературы",
  "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
  "excerpt": "вости Юр. информация Контакты Адрес и время работы Юридический и почтовый адрес редакции:125375, г. Москва, Большой Гнездниковский пер., дом 10. Редакция работает с понедельника по пятницу с 10 до 20 часов; дни приема: понедельник, среда и пятница с 10 до ",
  "status": "organisation_country",
  "scope": "official_contact_page",
  "responseSha256": "7882772630b6989fcf03785c7fd21a7d3227ba8187599cb92f5d7d43c1b7d91c",
  "accessedAt": "2026-10-01T21:04:14.707Z"
},
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/voprosy-literatury.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "duke-press-blog",
  "name": "Duke University Press",
  "url": "https://dukeupress.wordpress.com/feed/",
  "format": "rss",
  "language": "en",
  "region": "global",
  "sourceFamilyId": "duke-press-blog",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
    "publishing",
    "releases",
    "awards",
    "festivals"
  ],
  "articleOrigins": [
    "https://dukeupress.wordpress.com"
  ],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
    "https://dukeupress.wordpress.com/2026/10/01/new-books-in-october-12/"
  ],
  "verifiedAt": "2026-10-01T20:56:30.257Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "countryEvidence": {
    "method": "official_organisation_identity",
    "url": "https://dukeupress.wordpress.com/",
    "organisation": "Duke University Press",
    "statement": "Organisation country is distinct from the country of each covered event.",
    "excerpt": "Duke University Press",
    "status": "office_country_unconfirmed"
  },
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/duke-press-blog.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "cambridge-press-blog",
  "name": "Cambridge University Press",
  "url": "https://cambridgeblog.org/",
  "format": "html",
  "language": "en-US",
  "region": "global",
  "sourceFamilyId": "cambridge-press-blog",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://cambridgeblog.org"
],
  "parserVersion": "r10-source-profile-1",
  "linkSelector": "a[href]:not(nav a):not(header a):not(footer a)",
  "exampleArticleUrls": [
  "https://cambridgeblog.org/2026/08/providence-evil-and-salvation/"
],
  "verifiedAt": "2026-10-01T20:51:40.195Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/\\d{4}\\/\\d{2}\\/(?:\\d{2}\\/)?[^/]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "https://cambridgeblog.org/",
  "organisation": "Cambridge University Press",
  "status": "office_country_unconfirmed",
  "statement": "Observed country names describe distribution, publishing coverage or a brand rather than an independently confirmed organisation office address."
},
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/cambridge-press-blog.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "liverpool-press-blog",
  "name": "Liverpool University Press",
  "url": "https://liverpooluniversitypress.blog/feed/",
  "format": "rss",
  "language": "en",
  "region": "global",
  "sourceFamilyId": "liverpool-press-blog",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
    "publishing",
    "releases",
    "awards",
    "festivals"
  ],
  "articleOrigins": [
    "https://liverpooluniversitypress.blog"
  ],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
    "https://liverpooluniversitypress.blog/2026/10/01/announcing-our-2027-pavilion-poetry-collections/"
  ],
  "verifiedAt": "2026-10-01T20:56:30.240Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "countryEvidence": {
    "method": "official_organisation_identity",
    "url": "https://liverpooluniversitypress.blog/",
    "organisation": "Liverpool University Press",
    "statement": "Organisation country is distinct from the country of each covered event.",
    "excerpt": "Liverpool University Press",
    "status": "office_country_unconfirmed"
  },
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/liverpool-press-blog.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "unc-press-blog",
  "name": "University of North Carolina Press",
  "url": "https://uncpressblog.com/feed/",
  "format": "rss",
  "language": "en-US",
  "region": "global",
  "sourceFamilyId": "unc-press-blog",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
    "publishing",
    "releases",
    "awards",
    "festivals"
  ],
  "articleOrigins": [
    "https://uncpressblog.com"
  ],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
    "https://uncpressblog.com/2026/09/25/qa-with-juan-mora-author-of-latinx-encounters/"
  ],
  "verifiedAt": "2026-10-01T20:51:44.766Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "countryEvidence": {
    "method": "official_organisation_identity",
    "url": "https://uncpressblog.com/",
    "organisation": "University of North Carolina Press",
    "statement": "Organisation country is distinct from the country of each covered event.",
    "excerpt": "University of North Carolina Press",
    "status": "office_country_unconfirmed"
  },
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/unc-press-blog.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "syracuse-press",
  "name": "Syracuse University Press",
  "url": "https://press.syr.edu/feed/",
  "format": "rss",
  "language": "en-US",
  "region": "north-america",
  "sourceFamilyId": "syracuse-press",
  "countryCodes": [
    "US"
  ],
  "coverageCountryCodes": [],
  "topics": [
    "publishing",
    "releases",
    "awards",
    "festivals"
  ],
  "articleOrigins": [
    "https://press.syr.edu"
  ],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
    "https://press.syr.edu/the-book-of-disappearance-is-longlisted-for-the-2025-international-booker-prize/"
  ],
  "verifiedAt": "2026-10-01T20:51:43.941Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "countryEvidence": {
    "method": "official_contact_address",
    "url": "https://press.syr.edu/",
    "organisation": "Syracuse University Press",
    "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
    "excerpt": "X Facebook YouTube LinkedIn Instagram Bluesky Syracuse University Press 621 Skytop Road, Suite 110 map this locationGoogle map location Syracuse, New York 13244-5290 supress@syr.edu For book orders, conta",
    "status": "organisation_country",
    "scope": "footer",
    "responseSha256": "551109115475a34cee415e15d733adb23de86c57008e6e18c914eb2e05c82b83",
    "accessedAt": "2026-10-01T21:04:16.229Z"
  },
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/syracuse-press.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "virginia-press",
  "name": "University of Virginia Press",
  "url": "https://www.upress.virginia.edu/",
  "format": "html",
  "language": "en",
  "region": "north-america",
  "sourceFamilyId": "virginia-press",
  "countryCodes": [
  "US"
],
  "coverageCountryCodes": [],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://www.upress.virginia.edu"
],
  "parserVersion": "r10-source-profile-1",
  "linkSelector": "a[href]:not(nav a):not(header a):not(footer a)",
  "exampleArticleUrls": [
  "https://www.upress.virginia.edu/news/uva-press-announces-new-series-dis-place-ment-migration-and-social-justice/"
],
  "verifiedAt": "2026-10-01T20:51:45.085Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/news\\/.+|^\\/author\\x2dcorner\\/[^/]+\\/?$|^\\/[^/]{12,}\\/?$|^\\/title\\/[^/]+\\/?$|^\\/exhibits\\/[^/]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_contact_address",
  "url": "https://www.upress.virginia.edu/",
  "organisation": "University of Virginia Press",
  "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
  "excerpt": "PressCareer OpportunitiesWalker Cowen Memorial PrizePrivacy PolicyContact UsP.O. Box 400318 (Postal)Charlottesville, VA 22904-4318210 Sprigg Lane (Courier)Charlottesville, VA 22903-2417434 924-3468 (main)1-800-831-3406 (toll-free)434 982-2655 (fax)General Inquiries",
  "status": "organisation_country",
  "scope": "footer",
  "responseSha256": "720a62133d0c1924a0f4e89f9ffe96b5a830faad8c6571c847f5bcd6b352f321",
  "accessedAt": "2026-10-01T21:04:15.804Z"
},
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/virginia-press.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "toronto-press",
  "name": "University of Toronto Press",
  "url": "https://utorontopress.com/feed/",
  "format": "rss",
  "language": "en-US",
  "region": "global",
  "sourceFamilyId": "toronto-press",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
    "publishing",
    "releases",
    "awards",
    "festivals"
  ],
  "articleOrigins": [
    "https://utorontopress.com"
  ],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
    "https://utorontopress.com/awards-2026/"
  ],
  "verifiedAt": "2026-10-01T20:51:46.113Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "countryEvidence": {
    "method": "official_organisation_identity",
    "url": "https://utorontopress.com/",
    "organisation": "University of Toronto Press",
    "statement": "Organisation country is distinct from the country of each covered event.",
    "excerpt": "University of Toronto Press",
    "status": "office_country_unconfirmed"
  },
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/toronto-press.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "world-literature-today",
  "name": "World Literature Today",
  "url": "https://worldliteraturetoday.org/weekly",
  "format": "html",
  "language": "en",
  "region": "global",
  "sourceFamilyId": "world-literature-today",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://worldliteraturetoday.org"
],
  "parserVersion": "r10-source-profile-1",
  "linkSelector": "a[href]:not(nav a):not(header a):not(footer a)",
  "exampleArticleUrls": [
  "https://worldliteraturetoday.org/blog/news-and-events/elizabeth-acevedo-wins-nsk-neustadt-prize-childrens-and-young-adult-literature"
],
  "verifiedAt": "2026-10-01T20:51:49.506Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/blog\\/.+", ""),
  "countryEvidence": {
  "method": "official_organisation_identity",
  "url": "https://www.worldliteraturetoday.org/",
  "organisation": "World Literature Today",
  "statement": "Organisation country is distinct from the country of each covered event.",
  "excerpt": "World Literature Today",
  "status": "office_country_unconfirmed"
},
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/world-literature-today.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "prototype-publishing",
  "name": "Prototype",
  "url": "https://prototypepublishing.co.uk/feed/",
  "format": "rss",
  "language": "en-GB",
  "region": "europe",
  "sourceFamilyId": "prototype-publishing",
  "countryCodes": [
    "GB"
  ],
  "coverageCountryCodes": [],
  "topics": [
    "publishing",
    "releases",
    "awards",
    "festivals"
  ],
  "articleOrigins": [
    "https://prototypepublishing.co.uk"
  ],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
    "https://prototypepublishing.co.uk/2026/04/13/free-verse-poetry-book-magazine-fair-2026/"
  ],
  "verifiedAt": "2026-10-01T20:51:55.511Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "countryEvidence": {
    "method": "official_contact_address",
    "url": "https://prototypepublishing.co.uk/about/contact/",
    "organisation": "Prototype",
    "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
    "excerpt": "ge, otherwise, you can find us here: Email: admin[at]prototypepublishing.co.uk Post: 71 Oriel Road, London E9 5SG, UK Contact form Your Name (we need this) Your Email (we need this too) What are you contacting us about? Your Message <div class=\"grecaptcha-",
    "status": "organisation_country",
    "scope": "official_contact_page",
    "responseSha256": "66667636c1a399f374a420338975eecb44339df87313f54534d1158eddba07dd",
    "accessedAt": "2026-10-01T21:04:17.202Z"
  },
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/prototype-publishing.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "guernica-magazine",
  "name": "Guernica",
  "url": "https://www.guernicamag.com/feed/",
  "format": "rss",
  "language": "en-US",
  "region": "global",
  "sourceFamilyId": "guernica-magazine",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
    "publishing",
    "releases",
    "awards",
    "festivals"
  ],
  "articleOrigins": [
    "https://www.guernicamag.com"
  ],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
    "https://www.guernicamag.com/places-of-memory/"
  ],
  "verifiedAt": "2026-10-01T20:51:51.141Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "countryEvidence": {
    "method": "official_organisation_identity",
    "url": "https://www.guernicamag.com/",
    "organisation": "Guernica",
    "statement": "Organisation country is distinct from the country of each covered event.",
    "excerpt": "Guernica",
    "status": "office_country_unconfirmed"
  },
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/guernica-magazine.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "cleveland-review-books",
  "name": "Cleveland Review of Books",
  "url": "https://clereviewofbooks.com/feed/",
  "format": "rss",
  "language": "en-US",
  "region": "global",
  "sourceFamilyId": "cleveland-review-books",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
    "publishing",
    "releases",
    "awards",
    "festivals"
  ],
  "articleOrigins": [
    "https://clereviewofbooks.com"
  ],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
    "https://clereviewofbooks.com/on-sean-thor-conroes-the-walk-book/"
  ],
  "verifiedAt": "2026-10-01T20:56:40.559Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "countryEvidence": {
    "method": "official_organisation_identity",
    "url": "https://www.clereviewofbooks.com/",
    "organisation": "Cleveland Review of Books",
    "statement": "Organisation country is distinct from the country of each covered event.",
    "excerpt": "Cleveland Review of Books",
    "status": "office_country_unconfirmed"
  },
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/cleveland-review-books.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "public-books",
  "name": "Public Books",
  "url": "https://www.publicbooks.org/feed/",
  "format": "rss",
  "language": "en-US",
  "region": "global",
  "sourceFamilyId": "public-books",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
    "publishing",
    "releases",
    "awards",
    "festivals"
  ],
  "articleOrigins": [
    "https://www.publicbooks.org"
  ],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
    "https://www.publicbooks.org/the-poetics-of-social-forms-remembering-fredric-jameson-1934-2024/"
  ],
  "verifiedAt": "2026-10-01T20:51:52.731Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "countryEvidence": {
    "method": "official_organisation_identity",
    "url": "https://www.publicbooks.org/",
    "organisation": "Public Books",
    "statement": "Organisation country is distinct from the country of each covered event.",
    "excerpt": "Public Books",
    "status": "office_country_unconfirmed"
  },
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/public-books.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "revista-letras-libres",
  "name": "Letras Libres",
  "url": "https://letraslibres.com/feed/",
  "format": "rss",
  "language": "es",
  "region": "global",
  "sourceFamilyId": "revista-letras-libres",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
    "publishing",
    "releases",
    "awards",
    "festivals"
  ],
  "articleOrigins": [
    "https://letraslibres.com"
  ],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
    "https://letraslibres.com/literatura/manuel-vilas-la-literatura-es-el-gran-idioma-comun-que-borra-todas-las-fronteras/01/10/2026/"
  ],
  "verifiedAt": "2026-10-01T20:52:02.365Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "countryEvidence": {
    "method": "official_organisation_identity",
    "url": "https://letraslibres.com/",
    "organisation": "Letras Libres",
    "status": "office_country_unconfirmed",
    "statement": "Observed country names describe distribution, publishing coverage or a brand rather than an independently confirmed organisation office address."
  },
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/revista-letras-libres.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "revista-mercatto",
  "name": "Mercurio",
  "url": "https://www.revistamercurio.es/feed/",
  "format": "rss",
  "language": "es",
  "region": "global",
  "sourceFamilyId": "revista-mercatto",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
    "publishing",
    "releases",
    "awards",
    "festivals"
  ],
  "articleOrigins": [
    "https://www.revistamercurio.es"
  ],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
    "https://www.revistamercurio.es/2026/10/01/libros-de-la-semana-211/"
  ],
  "verifiedAt": "2026-10-01T20:51:56.907Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "countryEvidence": {
    "method": "official_organisation_identity",
    "url": "https://revistamercurio.es/",
    "organisation": "Mercurio",
    "statement": "Organisation country is distinct from the country of each covered event.",
    "excerpt": "Mercurio",
    "status": "office_country_unconfirmed"
  },
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/revista-mercatto.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "cultura-romania",
  "name": "Cultura",
  "url": "https://revistacultura.ro/feed/",
  "format": "rss",
  "language": "ro-RO",
  "region": "global",
  "sourceFamilyId": "cultura-romania",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
    "publishing",
    "releases",
    "awards",
    "festivals"
  ],
  "articleOrigins": [
    "https://revistacultura.ro"
  ],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
    "https://revistacultura.ro/imagini-lipova-inainte-si-dupa-mara-lui-slavici/"
  ],
  "verifiedAt": "2026-10-01T20:51:57.836Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "countryEvidence": {
    "method": "official_organisation_identity",
    "url": "https://revistacultura.ro/",
    "organisation": "Cultura",
    "statement": "Organisation country is distinct from the country of each covered event.",
    "excerpt": "Cultura",
    "status": "office_country_unconfirmed"
  },
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/cultura-romania.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "liternet-bulgaria",
  "name": "LiterNet",
  "url": "https://liternet.bg/publisher/rss",
  "format": "rss",
  "language": "bg",
  "region": "global",
  "sourceFamilyId": "liternet-bulgaria",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
    "publishing",
    "releases",
    "awards",
    "festivals"
  ],
  "articleOrigins": [
    "https://liternet.bg"
  ],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
    "https://liternet.bg/publish11/p_antov/ivanisha.htm"
  ],
  "verifiedAt": "2026-10-01T20:51:58.749Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "countryEvidence": {
    "method": "official_organisation_identity",
    "url": "https://liternet.bg/",
    "organisation": "LiterNet",
    "status": "office_country_unconfirmed",
    "statement": "Observed country names describe distribution, publishing coverage or a brand rather than an independently confirmed organisation office address."
  },
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/liternet-bulgaria.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "litlogos",
  "name": "Literaturhaus Switzerland",
  "url": "https://literaturhaus.ch/feed/",
  "format": "rss",
  "language": "de-CH",
  "region": "europe",
  "sourceFamilyId": "litlogos",
  "countryCodes": [
    "CH"
  ],
  "coverageCountryCodes": [],
  "topics": [
    "publishing",
    "releases",
    "awards",
    "festivals"
  ],
  "articleOrigins": [
    "https://literaturhaus.ch"
  ],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
    "https://literaturhaus.ch/saisoneroeffnung-2026-2027/"
  ],
  "verifiedAt": "2026-10-01T20:52:02.548Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "countryEvidence": {
    "method": "official_contact_address",
    "url": "https://literaturhaus.ch/impressum/",
    "organisation": "Literaturhaus Switzerland",
    "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
    "excerpt": "Impressum Redaktion Museumsgesellschaft und Literaturhaus Zürich, Limmatquai 62, 8001 Zürich, SchweizTelefon +41 44 254 50 08info@literaturhaus.chNicola Steiner, Isabelle Vonlanthen, Sandra Gubler Design und Progra",
    "status": "organisation_country",
    "scope": "official_contact_page",
    "responseSha256": "e701a2116b419e66a1c84ff55832698d03afe223704f81bf747ef76dd8beedc5",
    "accessedAt": "2026-10-01T21:04:19.499Z"
  },
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/litlogos.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "literaturhaus-salzburg",
  "name": "Literaturhaus Salzburg",
  "url": "https://www.literaturhaus-salzburg.at/feed/",
  "format": "rss",
  "language": "de",
  "region": "europe",
  "sourceFamilyId": "literaturhaus-salzburg",
  "countryCodes": [
    "AT"
  ],
  "coverageCountryCodes": [],
  "topics": [
    "publishing",
    "releases",
    "awards",
    "festivals"
  ],
  "articleOrigins": [
    "https://www.literaturhaus-salzburg.at"
  ],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
    "https://www.literaturhaus-salzburg.at/haus-kulturprogramm-salzburg/news-wissenswertes/salzburger-jugend-literaturwettbewerb/"
  ],
  "verifiedAt": "2026-10-01T20:52:00.634Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "countryEvidence": {
    "method": "official_contact_address",
    "url": "https://www.literaturhaus-salzburg.at/",
    "organisation": "Literaturhaus Salzburg",
    "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
    "excerpt": "Newsletter Presse Kontakt Impressum LITERATURHAUS SALZBURGStrubergasse 23, H.C. Artmann-PlatzA-5020 Salzburg Telefon: +43 662 422 411Fax: +43 662 422 411-13E-Mail: info@literaturhaus-salzburg.at Instagram Fac",
    "status": "organisation_country",
    "scope": "footer",
    "responseSha256": "4874072bb02d40db30b1799817d5e2ee943cf25c7fdffe53590fb28f2329352e",
    "accessedAt": "2026-10-01T21:04:19.552Z"
  },
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/literaturhaus-salzburg.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "literaturhaus-stuttgart",
  "name": "Literaturhaus Stuttgart",
  "url": "https://www.literaturhaus-stuttgart.de/feed.xml",
  "format": "rss",
  "language": "de-DE",
  "region": "europe",
  "sourceFamilyId": "literaturhaus-stuttgart",
  "countryCodes": [
    "DE"
  ],
  "coverageCountryCodes": [],
  "topics": [
    "publishing",
    "releases",
    "awards",
    "festivals"
  ],
  "articleOrigins": [
    "https://www.literaturhaus-stuttgart.de"
  ],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
    "https://www.literaturhaus-stuttgart.de/event/6853.html"
  ],
  "verifiedAt": "2026-10-01T20:52:02.734Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "countryEvidence": {
    "method": "official_contact_address",
    "url": "https://www.literaturhaus-stuttgart.de/",
    "organisation": "Literaturhaus Stuttgart",
    "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
    "excerpt": "Literaturhaus Stuttgart Breitscheidstraße 4 70174 Stuttgart Fon (0711) 22 02 17 - 3 Fax (0711) 22 02 17 - 48 info@literaturhaus-stuttgart.de Barrierefreiheit Kontakt Anfahrt",
    "status": "organisation_country",
    "scope": "footer",
    "responseSha256": "6a1d362326172ecd132828e061d589f97007ed8db4d9198ff02cc4c1a47d20c7",
    "accessedAt": "2026-10-01T21:04:19.806Z"
  },
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/literaturhaus-stuttgart.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "literature-finland",
  "name": "FILI",
  "url": "https://fili.fi/feed/",
  "format": "rss",
  "language": "fi",
  "region": "europe",
  "sourceFamilyId": "literature-finland",
  "countryCodes": [
    "FI"
  ],
  "coverageCountryCodes": [],
  "topics": [
    "publishing",
    "releases",
    "awards",
    "festivals"
  ],
  "articleOrigins": [
    "https://fili.fi"
  ],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
    "https://fili.fi/filin-fellowship-ohjelma-vuonna-2026/"
  ],
  "verifiedAt": "2026-10-01T20:52:03.315Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "countryEvidence": {
    "method": "official_contact_address",
    "url": "https://fili.fi/",
    "organisation": "FILI",
    "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
    "excerpt": "nen kääntäjäpalkinto 100 kääntäjääJulkaisutFILIn kirjanostotFILI PodcastFILIn kirjavideotBooks from Finland -lehden arkistoFILIMeistäYhteys­tiedotMedialleLogopankkiFILI, Hallituskatu 2 B 00170 Helsinki *protected email*Saavutetta­vuusselosteTietosuojaselost",
    "status": "organisation_country",
    "scope": "footer",
    "responseSha256": "5244bc71eac7006f20bc2c136ad7eb18a08cfd8f2cf9cc7b01c01785ce96477c",
    "accessedAt": "2026-10-01T21:04:19.838Z"
  },
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/literature-finland.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "irish-literature",
  "name": "Literature Ireland",
  "url": "https://www.literatureireland.com/",
  "format": "html",
  "language": "en-GB",
  "region": "europe",
  "sourceFamilyId": "irish-literature",
  "countryCodes": [
  "IE"
],
  "coverageCountryCodes": [],
  "topics": [
  "publishing",
  "releases",
  "awards",
  "festivals"
],
  "articleOrigins": [
  "https://www.literatureireland.com"
],
  "parserVersion": "r10-source-profile-1",
  "linkSelector": "a[href]:not(nav a):not(header a):not(footer a)",
  "exampleArticleUrls": [
  "https://www.literatureireland.com/latest/ireland-at-the-frankfurt-book-fair-2026/"
],
  "verifiedAt": "2026-10-01T20:52:04.870Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "linkPattern": new RegExp("^\\/latest\\/[^/]+\\/?$", ""),
  "countryEvidence": {
  "method": "official_contact_address",
  "url": "https://www.literatureireland.com/",
  "organisation": "Literature Ireland",
  "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
  "excerpt": "Trinity Centre for Literary and Cultural Translation 36 Fenian Street Trinity College Dublin Dublin D02 CH22 Ireland Cookies & privacy notice Policies & legal notes Download brand assets Contact details Make a donation Sign up to our newslett",
  "status": "organisation_country",
  "scope": "footer",
  "responseSha256": "d1456f05b9458536d5990640983cf72147627ca7d0ac40f18f4d08c65f3fdff5",
  "accessedAt": "2026-10-01T21:04:20.232Z"
},
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/irish-literature.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "ireland-book-awards",
  "name": "An Post Irish Book Awards",
  "url": "https://www.irishbookawards.ie/feed/",
  "format": "rss",
  "language": "en-GB",
  "region": "global",
  "sourceFamilyId": "ireland-book-awards",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
    "publishing",
    "releases",
    "awards",
    "festivals"
  ],
  "articleOrigins": [
    "https://www.irishbookawards.ie"
  ],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
    "https://www.irishbookawards.ie/squeeze-in-a-read-this-february-25th-for-ireland-reads-day/"
  ],
  "verifiedAt": "2026-10-01T20:52:16.909Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "countryEvidence": {
    "method": "official_organisation_identity",
    "url": "https://www.irishbookawards.ie/",
    "organisation": "An Post Irish Book Awards",
    "statement": "Organisation country is distinct from the country of each covered event.",
    "excerpt": "An Post Irish Book Awards",
    "status": "office_country_unconfirmed"
  },
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/ireland-book-awards.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "stella-prize",
  "name": "Stella Prize",
  "url": "https://stella.org.au/feed/",
  "format": "rss",
  "language": "en-AU",
  "region": "oceania",
  "sourceFamilyId": "stella-prize",
  "countryCodes": [
    "AU"
  ],
  "coverageCountryCodes": [],
  "topics": [
    "publishing",
    "releases",
    "awards",
    "festivals"
  ],
  "articleOrigins": [
    "https://stella.org.au"
  ],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
    "https://stella.org.au/2026/09/book-of-the-month-pink-mountain-on-locust-island-september-2026/"
  ],
  "verifiedAt": "2026-10-01T20:52:10.631Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "countryEvidence": {
    "method": "official_registration_identity",
    "url": "https://stella.org.au/",
    "organisation": "Stella Prize",
    "statement": "The organisation declares its Australian Registered Body Number in its own legal footer; event geography is separate.",
    "excerpt": "o@stella.org.au ARBN: 657 317 283 Stella acknowledges the Traditional Owners of the land throughout Australia and recognises their continuing connection to land, waters, community, and culture.We pay our respect to Elders past and present and, through them, t",
    "status": "organisation_country",
    "scope": "official_footer",
    "responseSha256": "236ea8f57512f65e9a76abd308de2a68c5679eb247d37a30aa28a796a40948fa",
    "accessedAt": "2026-10-01T21:04:21.922Z"
  },
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/stella-prize.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "hakara",
  "name": "Hakara",
  "url": "https://hakara.in/feed/",
  "format": "rss",
  "language": "mr-IN",
  "region": "global",
  "sourceFamilyId": "hakara",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
    "publishing",
    "releases",
    "awards",
    "festivals"
  ],
  "articleOrigins": [
    "https://hakara.in"
  ],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
    "https://hakara.in/ten-poems-bedarkar-gummuluri/"
  ],
  "verifiedAt": "2026-10-01T20:52:17.477Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "countryEvidence": {
    "method": "official_organisation_identity",
    "url": "https://www.hakara.in/",
    "organisation": "Hakara",
    "statement": "Organisation country is distinct from the country of each covered event.",
    "excerpt": "Hakara",
    "status": "office_country_unconfirmed"
  },
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/hakara.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
},
{
  "id": "karavan-press",
  "name": "Karavan Press",
  "url": "https://karavanpress.com/feed/",
  "format": "rss",
  "language": "en",
  "region": "global",
  "sourceFamilyId": "karavan-press",
  "countryCodes": [],
  "coverageCountryCodes": [],
  "topics": [
    "publishing",
    "releases",
    "awards",
    "festivals"
  ],
  "articleOrigins": [
    "https://karavanpress.com"
  ],
  "parserVersion": "r10-source-profile-1",
  "exampleArticleUrls": [
    "https://karavanpress.com/2026/09/22/melissa-a-volker-at-the-muizenberg-literary-heritage-festival-26-september-2026/"
  ],
  "verifiedAt": "2026-10-01T20:56:32.785Z",
  "collectionNote": "Runtime parser and a real literary item fetched on 2026-10-01. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.",
  "countryEvidence": {
    "method": "official_organisation_identity",
    "url": "https://karavanpress.com/",
    "organisation": "Karavan Press",
    "statement": "Organisation country is distinct from the country of each covered event.",
    "excerpt": "Karavan Press",
    "status": "office_country_unconfirmed"
  },
  "sourceClass": "literary-news",
  "evidenceReport": "reports/r10/sources/karavan-press.json",
  "autoPublication": false,
  "profileScope": "Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.",
  "refreshIntervalSeconds": 7200
}
];

export const R10_SOURCE_GEOGRAPHY = {
  "booker": {
    "sourceFamilyId": "booker",
    "countryCodes": [
      "GB"
    ],
    "coverageCountryCodes": [
      "GB"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "repository:scripts/lib/literary-news-sources.mjs",
      "organisation": "The Booker Prizes",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "The Booker Prizes",
      "status": "organisation_country"
    }
  },
  "prh": {
    "sourceFamilyId": "penguin-random-house",
    "countryCodes": [
      "US"
    ],
    "coverageCountryCodes": [
      "US"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "repository:scripts/lib/literary-news-sources.mjs",
      "organisation": "Penguin Random House",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Penguin Random House",
      "status": "organisation_country"
    }
  },
  "nobel": {
    "sourceFamilyId": "nobel",
    "countryCodes": [
      "SE"
    ],
    "coverageCountryCodes": [
      "SE"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "repository:scripts/lib/literary-news-sources.mjs",
      "organisation": "NobelPrize.org",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "NobelPrize.org",
      "status": "organisation_country"
    }
  },
  "german-book-prize": {
    "sourceFamilyId": "german-book-prize",
    "countryCodes": [
      "DE"
    ],
    "coverageCountryCodes": [
      "DE"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "repository:scripts/lib/literary-news-sources.mjs",
      "organisation": "Deutscher Buchpreis",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Deutscher Buchpreis",
      "status": "organisation_country"
    }
  },
  "frankfurt-book-fair": {
    "sourceFamilyId": "frankfurt-book-fair",
    "countryCodes": [
      "DE"
    ],
    "coverageCountryCodes": [
      "DE"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "repository:scripts/lib/literary-news-sources.mjs",
      "organisation": "Frankfurter Buchmesse",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Frankfurter Buchmesse",
      "status": "organisation_country"
    }
  },
  "gothenburg-book-fair": {
    "sourceFamilyId": "gothenburg-book-fair",
    "countryCodes": [
      "SE"
    ],
    "coverageCountryCodes": [
      "SE"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "repository:scripts/lib/literary-news-sources.mjs",
      "organisation": "Bokmässan",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Bokmässan",
      "status": "organisation_country"
    }
  },
  "british-library": {
    "sourceFamilyId": "british-library",
    "countryCodes": [
      "GB"
    ],
    "coverageCountryCodes": [
      "GB"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "repository:scripts/lib/literary-news-sources.mjs",
      "organisation": "British Library",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "British Library",
      "status": "organisation_country"
    }
  },
  "bnf": {
    "sourceFamilyId": "bnf",
    "countryCodes": [
      "FR"
    ],
    "coverageCountryCodes": [
      "FR"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "repository:scripts/lib/literary-news-sources.mjs",
      "organisation": "Bibliothèque nationale de France",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Bibliothèque nationale de France",
      "status": "organisation_country"
    }
  },
  "goslitmuz": {
    "sourceFamilyId": "goslitmuz",
    "countryCodes": [
      "RU"
    ],
    "coverageCountryCodes": [
      "RU"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "repository:scripts/lib/literary-news-sources.mjs",
      "organisation": "Гослитмузей / State Literary Museum",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Гослитмузей / State Literary Museum",
      "status": "organisation_country"
    }
  },
  "yasnaya-polyana": {
    "sourceFamilyId": "yasnaya-polyana",
    "countryCodes": [
      "RU"
    ],
    "coverageCountryCodes": [
      "RU"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "repository:scripts/lib/literary-news-sources.mjs",
      "organisation": "Ясная Поляна / Yasnaya Polyana",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Ясная Поляна / Yasnaya Polyana",
      "status": "organisation_country"
    }
  },
  "national-book-foundation": {
    "sourceFamilyId": "national-book-foundation",
    "countryCodes": [
      "US"
    ],
    "coverageCountryCodes": [
      "US"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "repository:scripts/lib/literary-news-sources.mjs",
      "organisation": "National Book Foundation",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "National Book Foundation",
      "status": "organisation_country"
    }
  },
  "giller": {
    "sourceFamilyId": "giller",
    "countryCodes": [
      "CA"
    ],
    "coverageCountryCodes": [
      "CA"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "repository:scripts/lib/literary-news-sources.mjs",
      "organisation": "Giller Prize",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Giller Prize",
      "status": "organisation_country"
    }
  },
  "brooklyn-book-festival": {
    "sourceFamilyId": "brooklyn-book-festival",
    "countryCodes": [
      "US"
    ],
    "coverageCountryCodes": [
      "US"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "repository:scripts/lib/literary-news-sources.mjs",
      "organisation": "Brooklyn Book Festival",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Brooklyn Book Festival",
      "status": "organisation_country"
    }
  },
  "prh-library": {
    "sourceFamilyId": "penguin-random-house",
    "countryCodes": [
      "US"
    ],
    "coverageCountryCodes": [
      "US"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "repository:scripts/lib/literary-news-sources.mjs",
      "organisation": "Penguin Random House Library",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Penguin Random House Library",
      "status": "organisation_country"
    }
  },
  "loc-bookmarked": {
    "sourceFamilyId": "loc-bookmarked",
    "countryCodes": [
      "US"
    ],
    "coverageCountryCodes": [
      "US"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "repository:scripts/lib/literary-news-sources.mjs",
      "organisation": "Library of Congress · Bookmarked",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Library of Congress · Bookmarked",
      "status": "organisation_country"
    }
  },
  "pen-america": {
    "sourceFamilyId": "pen-america",
    "countryCodes": [
      "US"
    ],
    "coverageCountryCodes": [
      "US"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "repository:scripts/lib/literary-news-sources.mjs",
      "organisation": "PEN America",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "PEN America",
      "status": "organisation_country"
    }
  },
  "literary-arts": {
    "sourceFamilyId": "literary-arts",
    "countryCodes": [
      "US"
    ],
    "coverageCountryCodes": [
      "US"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "repository:scripts/lib/literary-news-sources.mjs",
      "organisation": "Literary Arts",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Literary Arts",
      "status": "organisation_country"
    }
  },
  "aaww": {
    "sourceFamilyId": "aaww",
    "countryCodes": [
      "US"
    ],
    "coverageCountryCodes": [
      "US"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "repository:scripts/lib/literary-news-sources.mjs",
      "organisation": "Asian American Writers’ Workshop",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Asian American Writers’ Workshop",
      "status": "organisation_country"
    }
  },
  "kent-literary-research": {
    "sourceFamilyId": "kent-literary-research",
    "countryCodes": [
      "GB"
    ],
    "coverageCountryCodes": [
      "GB"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "repository:scripts/lib/literary-news-sources.mjs",
      "organisation": "University of Kent - literary research",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "University of Kent - literary research",
      "status": "organisation_country"
    }
  },
  "netflix-book-adaptations": {
    "sourceFamilyId": "netflix-book-adaptations",
    "countryCodes": [
      "US"
    ],
    "coverageCountryCodes": [
      "US"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "repository:scripts/lib/literary-news-sources.mjs",
      "organisation": "Netflix Tudum - Book adaptations",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Netflix Tudum - Book adaptations",
      "status": "organisation_country"
    }
  },
  "ubud-writers-readers-festival": {
    "sourceFamilyId": "ubud-writers-readers-festival",
    "countryCodes": [
      "ID"
    ],
    "coverageCountryCodes": [
      "ID"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "repository:scripts/lib/literary-news-sources.mjs",
      "organisation": "Ubud Writers & Readers Festival",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Ubud Writers & Readers Festival",
      "status": "organisation_country"
    }
  },
  "shanghai-childrens-book-fair": {
    "sourceFamilyId": "shanghai-childrens-book-fair",
    "countryCodes": [
      "CN"
    ],
    "coverageCountryCodes": [
      "CN"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "repository:scripts/lib/literary-news-sources.mjs",
      "organisation": "Shanghai International Children’s Book Fair",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Shanghai International Children’s Book Fair",
      "status": "organisation_country"
    }
  },
  "ake-arts-book-festival": {
    "sourceFamilyId": "ake-arts-book-festival",
    "countryCodes": [
      "NG"
    ],
    "coverageCountryCodes": [
      "NG"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "repository:scripts/lib/literary-news-sources.mjs",
      "organisation": "Aké Arts & Book Festival",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Aké Arts & Book Festival",
      "status": "organisation_country"
    }
  },
  "kenya-publishers-association": {
    "sourceFamilyId": "kenya-publishers-association",
    "countryCodes": [
      "KE"
    ],
    "coverageCountryCodes": [
      "KE"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "repository:scripts/lib/literary-news-sources.mjs",
      "organisation": "Kenya Publishers Association",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Kenya Publishers AssociationPO Box 4276700100-GPO NairobiKenyawww.kenyapublishers.org",
      "status": "organisation_country"
    }
  },
  "fil-guadalajara": {
    "sourceFamilyId": "fil-guadalajara",
    "countryCodes": [
      "MX"
    ],
    "coverageCountryCodes": [
      "MX"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "repository:scripts/lib/literary-news-sources.mjs",
      "organisation": "FIL Guadalajara",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "FIL Guadalajara",
      "status": "organisation_country"
    }
  },
  "hay-festival-queretaro": {
    "sourceFamilyId": "hay-festival-queretaro",
    "countryCodes": [
      "GB"
    ],
    "coverageCountryCodes": [
      "MX"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "repository:scripts/lib/literary-news-sources.mjs",
      "organisation": "Hay Festival Querétaro",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Hay Festival Querétaro",
      "status": "organisation_country"
    }
  },
  "brisbane-writers-festival": {
    "sourceFamilyId": "brisbane-writers-festival",
    "countryCodes": [
      "AU"
    ],
    "coverageCountryCodes": [
      "AU"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "repository:scripts/lib/literary-news-sources.mjs",
      "organisation": "Brisbane Writers Festival",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Brisbane Writers Festival",
      "status": "organisation_country"
    }
  },
  "nz-children-young-adults-book-awards": {
    "sourceFamilyId": "nz-children-young-adults-book-awards",
    "countryCodes": [
      "NZ"
    ],
    "coverageCountryCodes": [
      "NZ"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "repository:scripts/lib/literary-news-sources.mjs",
      "organisation": "New Zealand Book Awards Trust - Children and Young Adults",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "New Zealand Book Awards Trust - Children and Young Adults",
      "status": "organisation_country"
    }
  },
  "word-christchurch": {
    "sourceFamilyId": "word-christchurch",
    "countryCodes": [
      "NZ"
    ],
    "coverageCountryCodes": [
      "NZ"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "repository:scripts/lib/literary-news-sources.mjs",
      "organisation": "WORD Christchurch",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "WORD Christchurch",
      "status": "organisation_country"
    }
  },
  "intelekti-ge": {
    "sourceFamilyId": "intelekti-ge",
    "countryCodes": [
      "GE"
    ],
    "coverageCountryCodes": [
      "GE"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Intelekti Publishing",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "President of the IPA from 1 January 2025. Head of International Relations of Intelekti Publishing.",
      "status": "organisation_country"
    }
  },
  "hoeplieditore-it": {
    "sourceFamilyId": "hoeplieditore-it",
    "countryCodes": [
      "IT"
    ],
    "coverageCountryCodes": [
      "IT"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Hoepli Publishing House",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Vice President of IPA from 1 January 2025. Vice President of Hoepli Publishing House.",
      "status": "organisation_country"
    }
  },
  "acenaventures-wordpress-com": {
    "sourceFamilyId": "acenaventures-wordpress-com",
    "countryCodes": [
      "NG"
    ],
    "coverageCountryCodes": [
      "NG"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Acena Publishers Nigeria Limited",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Group Managing Director of Acena Publishers Nigeria Limited.",
      "status": "organisation_country"
    }
  },
  "gummerus-fi": {
    "sourceFamilyId": "gummerus-fi",
    "countryCodes": [
      "FI"
    ],
    "coverageCountryCodes": [
      "FI"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Gummerus Publishers",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "CEO of Gummerus Publishers.",
      "status": "organisation_country"
    }
  },
  "unswpress-com": {
    "sourceFamilyId": "unswpress-com",
    "countryCodes": [
      "AU"
    ],
    "coverageCountryCodes": [
      "AU"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "UNSW Press",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Vice-President of Academic Relations for Latin America at Elsevier.",
      "status": "organisation_country"
    }
  },
  "penguinrandomhousegrupoeditorial-com": {
    "sourceFamilyId": "penguin-random-house",
    "countryCodes": [
      "ES"
    ],
    "coverageCountryCodes": [
      "ES"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Penguin Random House Grupo Editorial, Mexico",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Director General of Penguin Random House Grupo Editorial, Mexico.",
      "status": "organisation_country"
    }
  },
  "federacioneditores-org": {
    "sourceFamilyId": "federacioneditores-org",
    "countryCodes": [
      "ES"
    ],
    "coverageCountryCodes": [
      "ES"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "FGEE",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Federación de Gremios de Editores de EspañaCea Bermúdez 44 2° Dcha28003 MadridSpainwww.federacioneditores.org",
      "status": "organisation_country"
    }
  },
  "mabopa-com-my": {
    "sourceFamilyId": "mabopa-com-my",
    "countryCodes": [
      "MY"
    ],
    "coverageCountryCodes": [
      "MY"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Malaysian Book Publishers Association (MABOPA)",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "President of the Malaysian Book Publishers Association (MABOPA) and ASEAN Book Publishers Association (ABPA).",
      "status": "organisation_country"
    }
  },
  "aseanbookpublishers-org": {
    "sourceFamilyId": "aseanbookpublishers-org",
    "countryCodes": [
      "MY"
    ],
    "coverageCountryCodes": [
      "MY"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "ASEAN Book Publishers Association (ABPA)",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "President of the Malaysian Book Publishers Association (MABOPA) and ASEAN Book Publishers Association (ABPA).",
      "status": "organisation_country"
    }
  },
  "anel-qc-ca": {
    "sourceFamilyId": "anel-qc-ca",
    "countryCodes": [
      "CA"
    ],
    "coverageCountryCodes": [
      "CA"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "ANEL",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Association Nationale des Editeurs de Livres2514 Boulevard Rosemont. Montréal H1Y1K4. Québecwww.anel.qc.ca Assn. of Canadian Publishers – 174 Spadina Avenue. Suite 306. Toronto ON M5T 2C2.www.publishe",
      "status": "organisation_country"
    }
  },
  "kiwi-verlag-de": {
    "sourceFamilyId": "kiwi-verlag-de",
    "countryCodes": [
      "DE"
    ],
    "coverageCountryCodes": [
      "DE"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Kiepenheuer & Witsch",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Deputy publisher and a member of the management board of Kiepenheuer & Witsch.",
      "status": "organisation_country"
    }
  },
  "press-princeton-edu": {
    "sourceFamilyId": "press-princeton-edu",
    "countryCodes": [
      "US"
    ],
    "coverageCountryCodes": [
      "US"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Princeton University Press",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Director of Princeton University Press.",
      "status": "organisation_country"
    }
  },
  "turkyaybir-org-tr": {
    "sourceFamilyId": "turkyaybir-org-tr",
    "countryCodes": [
      "TR"
    ],
    "coverageCountryCodes": [
      "TR"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Turkish Publishers Association",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Turkish Publishers Associationİnonu Caddesi Opera Palas Apt 55 D.234437 Gümüssuyu- Beyoğlu / İstanbulTurkeywww.turkyaybir.org.tr",
      "status": "organisation_country"
    }
  },
  "sne-fr": {
    "sourceFamilyId": "sne-fr",
    "countryCodes": [
      "FR"
    ],
    "coverageCountryCodes": [
      "FR"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Syndicat National de l’Edition",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Syndicat National de l’Edition115, boulevard Saint-Germain75006 ParisFrance www.sne.fr",
      "status": "organisation_country"
    }
  },
  "portoeditora-com": {
    "sourceFamilyId": "portoeditora-com",
    "countryCodes": [
      "PT"
    ],
    "coverageCountryCodes": [
      "PT"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Grupo Porto Editora",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Management Team Member, Grupo Porto Editora.",
      "status": "organisation_country"
    }
  },
  "group-sagepub-com": {
    "sourceFamilyId": "group-sagepub-com",
    "countryCodes": [
      "GB"
    ],
    "coverageCountryCodes": [
      "GB"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Sage Publishing",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "EVP Learning and UK Executive Lead at Sage Publishing.",
      "status": "organisation_country"
    }
  },
  "jbpa-or-jp": {
    "sourceFamilyId": "jbpa-or-jp",
    "countryCodes": [
      "JP"
    ],
    "coverageCountryCodes": [
      "JP"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Japan Book Publishers Association",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Japan Book Publishers Association6 Fukuro-machiShinjuku-ku162-0828 TokyoJapanwww.jbpa.or.jp",
      "status": "organisation_country"
    }
  },
  "bildungsmedien-de": {
    "sourceFamilyId": "bildungsmedien-de",
    "countryCodes": [
      "DE"
    ],
    "coverageCountryCodes": [
      "DE"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Verband Bildungsmedien",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Managing Director of the Verband Bildungsmedien.",
      "status": "organisation_country"
    }
  },
  "boersenverein-de": {
    "sourceFamilyId": "boersenverein-de",
    "countryCodes": [
      "DE"
    ],
    "coverageCountryCodes": [
      "DE"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Börsenverein des Deutschen Buchhandels",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Börsenverein des Deutschen BuchhandelsBraubachstraße 1660311 Frankfurt am MainGermanywww.boersenverein.de",
      "status": "organisation_country"
    }
  },
  "publishers-org": {
    "sourceFamilyId": "publishers-org",
    "countryCodes": [
      "US"
    ],
    "coverageCountryCodes": [
      "US"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Association of American Publishers",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Association of American Publishers 455 Massachusetts Ave. Suite 70020001 Washington DC www.publishers.org",
      "status": "organisation_country"
    }
  },
  "publishers-org-uk": {
    "sourceFamilyId": "publishers-org-uk",
    "countryCodes": [
      "GB"
    ],
    "coverageCountryCodes": [
      "GB"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Publishers Association",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Catriona MacLeod Stevenson, General Counsel and Deputy CEO of the Publishers Association",
      "status": "organisation_country"
    }
  },
  "apnetafrica-org": {
    "sourceFamilyId": "apnetafrica-org",
    "countryCodes": [
      "GH"
    ],
    "coverageCountryCodes": [
      "GH"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "African Publishers Network (APNET)",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "African Publishers Network (APNET)",
      "status": "organisation_country"
    }
  },
  "afrilivres-net": {
    "sourceFamilyId": "afrilivres-net",
    "countryCodes": [
      "BJ"
    ],
    "coverageCountryCodes": [
      "BJ"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Afrilivres",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Afrilivres",
      "status": "organisation_country"
    }
  },
  "arab-pa-org": {
    "sourceFamilyId": "arab-pa-org",
    "countryCodes": [
      "LB"
    ],
    "coverageCountryCodes": [
      "LB"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Arab Publishers Association (APA)",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Arab Publishers Association (APA)",
      "status": "organisation_country"
    }
  },
  "eulac-org": {
    "sourceFamilyId": "eulac-org",
    "countryCodes": [
      "CO"
    ],
    "coverageCountryCodes": [
      "CO"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Asociación de Editoriales Universitarias de América Latina y el Caribe (EULAC)",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Asociación de Editoriales Universitarias de América Latina y el Caribe (EULAC)",
      "status": "organisation_country"
    }
  },
  "eepg-org": {
    "sourceFamilyId": "eepg-org",
    "countryCodes": [
      "DE"
    ],
    "coverageCountryCodes": [
      "DE"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "European Educational Publishers Group (EEPG)",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "European Educational Publishers Group (EEPG)",
      "status": "organisation_country"
    }
  },
  "gieditores-org": {
    "sourceFamilyId": "gieditores-org",
    "countryCodes": [
      "ES"
    ],
    "coverageCountryCodes": [
      "ES"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Grupo Ibero-Americano de Editores (GIE)",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Grupo Ibero-Americano de Editores (GIE)",
      "status": "organisation_country"
    }
  },
  "bolognachildrensbookfair-com": {
    "sourceFamilyId": "bolognachildrensbookfair-com",
    "countryCodes": [
      "IT"
    ],
    "coverageCountryCodes": [
      "IT"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Bologna Children’s Book Fair",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Bologna Children’s Book Fair",
      "status": "organisation_country"
    }
  },
  "fibut-is": {
    "sourceFamilyId": "fibut-is",
    "countryCodes": [
      "IS"
    ],
    "coverageCountryCodes": [
      "IS"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Icelandic Publishers Association",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Icelandic Publishers AssociationBaronsstig 5101 ReykjavikIcelandwww.fibut.is",
      "status": "organisation_country"
    }
  },
  "universitypressplc-com": {
    "sourceFamilyId": "universitypressplc-com",
    "countryCodes": [
      "NG"
    ],
    "coverageCountryCodes": [
      "NG"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "University Press Plc, Ibadan",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Managing Director and CEO of the University Press Plc, Ibadan.",
      "status": "organisation_country"
    }
  },
  "aie-it": {
    "sourceFamilyId": "aie-it",
    "countryCodes": [
      "IT"
    ],
    "coverageCountryCodes": [
      "IT"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "AIE",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Associazione Italiana EditoriCorso di Porta Romana 10820122 MilanoItalywww.aie.it",
      "status": "organisation_country"
    }
  },
  "dkagencies-com": {
    "sourceFamilyId": "dkagencies-com",
    "countryCodes": [
      "IN"
    ],
    "coverageCountryCodes": [
      "IN"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "DK Agencies",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "DK Agencies.",
      "status": "organisation_country"
    }
  },
  "lojagirassolbrasil-com-br": {
    "sourceFamilyId": "lojagirassolbrasil-com-br",
    "countryCodes": [
      "BR"
    ],
    "coverageCountryCodes": [
      "BR"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Grupo Girassol Brazil",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Managing Director of Grupo Girassol Brazil.",
      "status": "organisation_country"
    }
  },
  "editores-org-ar": {
    "sourceFamilyId": "editores-org-ar",
    "countryCodes": [
      "AR"
    ],
    "coverageCountryCodes": [
      "AR"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Cámara Argentina del LibroAv. Belgrano",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Cámara Argentina del LibroAv. Belgrano 1580 – Piso 4°C1093AAQ Buenos AiresArgentinawww.editores.org.ar",
      "status": "organisation_country"
    }
  },
  "publishers-ca": {
    "sourceFamilyId": "publishers-ca",
    "countryCodes": [
      "CA"
    ],
    "coverageCountryCodes": [
      "CA"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Association Nationale des Editeurs de Livres",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Association Nationale des Editeurs de Livres2514 Boulevard Rosemont. Montréal H1Y1K4. Québecwww.anel.qc.ca Assn. of Canadian Publishers – 174 Spadina Avenue. Suite 306. Toronto ON M5T 2C2.www.publishe",
      "status": "organisation_country"
    }
  },
  "pubcouncil-ca": {
    "sourceFamilyId": "pubcouncil-ca",
    "countryCodes": [
      "CA"
    ],
    "coverageCountryCodes": [
      "CA"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Association Nationale des Editeurs de Livres",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Association Nationale des Editeurs de Livres2514 Boulevard Rosemont. Montréal H1Y1K4. Québecwww.anel.qc.ca Assn. of Canadian Publishers – 174 Spadina Avenue. Suite 306. Toronto ON M5T 2C2.www.publishe",
      "status": "organisation_country"
    }
  },
  "cpl-org-pe": {
    "sourceFamilyId": "cpl-org-pe",
    "countryCodes": [
      "PE"
    ],
    "coverageCountryCodes": [
      "PE"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Càmara Peruana del LibroAv. Cuba",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Càmara Peruana del LibroAv. Cuba 427Jesús MaríaApartado 10253Lima 11Perúwww.cpl.org.pe",
      "status": "organisation_country"
    }
  },
  "camlibro-com-co": {
    "sourceFamilyId": "camlibro-com-co",
    "countryCodes": [
      "CO"
    ],
    "coverageCountryCodes": [
      "CO"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Cámara Colombiana del LibroCalle",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Cámara Colombiana del LibroCalle 35 n°5A-05Bogotá D.C.Colombiawww.camlibro.com.co",
      "status": "organisation_country"
    }
  },
  "cavelibro-org": {
    "sourceFamilyId": "cavelibro-org",
    "countryCodes": [
      "VE"
    ],
    "coverageCountryCodes": [
      "VE"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Cámara Venezolana del LibroAvda Andrés BelloCentro Andrés BelloTorre Oeste- Piso",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Cámara Venezolana del LibroAvda Andrés BelloCentro Andrés BelloTorre Oeste- Piso 11- Oficina 112-01050 CaracasVenezuelawww.cavelibro.org",
      "status": "organisation_country"
    }
  },
  "abk-bg": {
    "sourceFamilyId": "abk-bg",
    "countryCodes": [
      "BG"
    ],
    "coverageCountryCodes": [
      "BG"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Bulgarian Book Association",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Bulgarian Book Association64 Vitosha Blvd., floor 2, ap. 41463 SofiaBulgariawww.abk.bg/",
      "status": "organisation_country"
    }
  },
  "shbsh-al": {
    "sourceFamilyId": "shbsh-al",
    "countryCodes": [
      "AL"
    ],
    "coverageCountryCodes": [
      "AL"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Association of Albanian Publishers",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Association of Albanian Publishers",
      "status": "organisation_country"
    }
  },
  "bookindustryja-com": {
    "sourceFamilyId": "bookindustryja-com",
    "countryCodes": [
      "JM"
    ],
    "coverageCountryCodes": [
      "JM"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Book Industry Association of Jamaica",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Book Industry Association of Jamaica (BIAJ)c/o Kingston Bookshop Limited74 King Street,Kingston, Jamaica bookindustryja.com",
      "status": "organisation_country"
    }
  },
  "as-editeurs-org": {
    "sourceFamilyId": "as-editeurs-org",
    "countryCodes": [
      "SN"
    ],
    "coverageCountryCodes": [
      "SN"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Association Sénégalaise des Editeurs",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Association Sénégalaise des Editeurs10 Rue Amadou Assane NdoyeDakarSenegal as-editeurs.org",
      "status": "organisation_country"
    }
  },
  "caniem-com": {
    "sourceFamilyId": "caniem-com",
    "countryCodes": [
      "MX"
    ],
    "coverageCountryCodes": [
      "MX"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Cámara Nacional de la Industria EditorialHolanda No.",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Cámara Nacional de la Industria EditorialHolanda No.13Col. San Diego – ChurubuscoCP 04120Delegación Coyoacán- México D.F.Mexicowww.caniem.com",
      "status": "organisation_country"
    }
  },
  "publishers-asn-au": {
    "sourceFamilyId": "publishers-asn-au",
    "countryCodes": [
      "AU"
    ],
    "coverageCountryCodes": [
      "AU"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Australian Publishers Association Ltd",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Australian Publishers Association Ltd60/89 Jones StreetUltimo- NSW 2007Australiawww.publishers.asn.au",
      "status": "organisation_country"
    }
  },
  "publishers-org-nz": {
    "sourceFamilyId": "publishers-org-nz",
    "countryCodes": [
      "NZ"
    ],
    "coverageCountryCodes": [
      "NZ"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Publishers Association of New ZealandPO Box",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Publishers Association of New ZealandPO Box 102006North Shore 0745AucklandNew Zealandwww.publishers.org.nz",
      "status": "organisation_country"
    }
  },
  "ikapi-org": {
    "sourceFamilyId": "ikapi-org",
    "countryCodes": [
      "ID"
    ],
    "coverageCountryCodes": [
      "ID"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Ikatan Penerbit IndonesiaJL Kalipasir",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Ikatan Penerbit IndonesiaJL Kalipasir 32Pengarengan10330 akarta PusatIndonesiawww.ikapi.org",
      "status": "organisation_country"
    }
  },
  "pepa-com-ph": {
    "sourceFamilyId": "pepa-com-ph",
    "countryCodes": [
      "PH"
    ],
    "coverageCountryCodes": [
      "PH"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Philippine Educational Publishers’ Association",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Philippine Educational Publishers’ Association84P Florentino StreetSta- Mesa HeightsQuezon CityPhilippineswww.pepa.com.ph",
      "status": "organisation_country"
    }
  },
  "pubat-or-th": {
    "sourceFamilyId": "pubat-or-th",
    "countryCodes": [
      "TH"
    ],
    "coverageCountryCodes": [
      "TH"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Publishers &. Booksellers Association of Thailand",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Publishers &. Booksellers Association of Thailand83/159 Moo 6Ngam Wong Wan RoadThung Song Hong- Lak Si10210 BangkokThailandwww.pubat.or.th",
      "status": "organisation_country"
    }
  },
  "bookpublishers-lk": {
    "sourceFamilyId": "bookpublishers-lk",
    "countryCodes": [
      "LK"
    ],
    "coverageCountryCodes": [
      "LK"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Sri Lanka Book Publishers Association",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Sri Lanka Book Publishers Association53 Maligakanda RdColombo 10Sri Lankawww.bookpublishers.lk",
      "status": "organisation_country"
    }
  },
  "fiponline-org": {
    "sourceFamilyId": "fiponline-org",
    "countryCodes": [
      "IN"
    ],
    "coverageCountryCodes": [
      "IN"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Federation of Indian Publishers",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Federation of Indian Publishers18/1C- Institutional AreaAruna Asaf Ali Marg- Near JNU110067 New DelhiIndiahttps://www.fiponline.org",
      "status": "organisation_country"
    }
  },
  "pac-org-cn": {
    "sourceFamilyId": "pac-org-cn",
    "countryCodes": [
      "CN"
    ],
    "coverageCountryCodes": [
      "CN"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Publishers Association of ChinaNo.",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Publishers Association of ChinaNo.22 Meishuguan East StreetBeijingChinawww.pac.org.cn",
      "status": "organisation_country"
    }
  },
  "bookunion-ru": {
    "sourceFamilyId": "bookunion-ru",
    "countryCodes": [
      "RU"
    ],
    "coverageCountryCodes": [
      "RU"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "bookunion.ru/",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Russian Book UnionOktyabr’skaya Ulitsa. 4к2127018. MoscowRussiabookunion.ru/",
      "status": "organisation_country"
    }
  },
  "bapus-org": {
    "sourceFamilyId": "bapus-org",
    "countryCodes": [
      "BD"
    ],
    "coverageCountryCodes": [
      "BD"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Bangladesh Publishers & Book-sellers Association (BAPUS)",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Bangladesh Publishers & Book-sellers Association (BAPUS)3 Liakat Avenue, Jonson Road, Bangla Bazar-Dhaka-1100Bangladeshwww.bapus.org",
      "status": "organisation_country"
    }
  },
  "forlaggare-se": {
    "sourceFamilyId": "forlaggare-se",
    "countryCodes": [
      "SE"
    ],
    "coverageCountryCodes": [
      "SE"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Svenska FörläggareföreningenDrottninggatan",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Svenska FörläggareföreningenDrottninggatan 9711360 StockholmSwedenwww.forlaggare.se",
      "status": "organisation_country"
    }
  },
  "publishers-fi": {
    "sourceFamilyId": "publishers-fi",
    "countryCodes": [
      "FI"
    ],
    "coverageCountryCodes": [
      "FI"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Finnish Book Publishers AssociationUnioninkatu",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Finnish Book Publishers AssociationUnioninkatu 11FI-00130 HelsinkiFinlandwww.publishers.fi",
      "status": "organisation_country"
    }
  },
  "forleggerforeningen-no": {
    "sourceFamilyId": "forleggerforeningen-no",
    "countryCodes": [
      "NO"
    ],
    "coverageCountryCodes": [
      "NO"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Norske ForleggerforeningØvre Vollgate",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Norske ForleggerforeningØvre Vollgate 15N-0158 OsloNorwaywww.forleggerforeningen.no",
      "status": "organisation_country"
    }
  },
  "upba-org-ua": {
    "sourceFamilyId": "upba-org-ua",
    "countryCodes": [
      "UA"
    ],
    "coverageCountryCodes": [
      "UA"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Ukrainian Publishers &. Booksellers Association",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Ukrainian Publishers &. Booksellers Association4- Triokhsvyatytelska str.- of.526Kyiv 01001Ukrainewww.upba.org.ua",
      "status": "organisation_country"
    }
  },
  "unionjp-com": {
    "sourceFamilyId": "unionjp-com",
    "countryCodes": [
      "JO"
    ],
    "coverageCountryCodes": [
      "JO"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Union of Jordanian PublishersSport CityP.O. Box:",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Union of Jordanian PublishersSport CityP.O. Box: 184060Amman 11118Jordanwww.unionjp.com",
      "status": "organisation_country"
    }
  },
  "epa-org-ae": {
    "sourceFamilyId": "epa-org-ae",
    "countryCodes": [
      "AE"
    ],
    "coverageCountryCodes": [
      "AE"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Emirates Publishers AssociationPO Box",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Emirates Publishers AssociationPO Box 5424Shj Al Qasba – Block D 1st FloorSharjahUnited Arab Emirateswww.epa.org.ae",
      "status": "organisation_country"
    }
  },
  "publishingireland-com": {
    "sourceFamilyId": "publishingireland-com",
    "countryCodes": [
      "IE"
    ],
    "coverageCountryCodes": [
      "IE"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Irish Book Publishers’ Association",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Irish Book Publishers’ Association25 Denzille LaneDublin 2Irelandwww.publishingireland.com",
      "status": "organisation_country"
    }
  },
  "apel-pt": {
    "sourceFamilyId": "apel-pt",
    "countryCodes": [
      "PT"
    ],
    "coverageCountryCodes": [
      "PT"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Associaçáo Portuguesa de Editores e LivreirosAv. dos Estados Unidos da América",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Associaçáo Portuguesa de Editores e LivreirosAv. dos Estados Unidos da América1700-167 LisbonPortugalwww.apel.pt",
      "status": "organisation_country"
    }
  },
  "asdel-ch": {
    "sourceFamilyId": "asdel-ch",
    "countryCodes": [
      "CH"
    ],
    "coverageCountryCodes": [
      "CH"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Association Suisse des Diffuseurs, Editeurs et Libraires",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Association Suisse des Diffuseurs, Editeurs et Libraires18, avenue de la Garecase postale 5291001 LausanneSwitzerlandwww.asdel.ch Schweizerischer Buchhändler und Verleger-VerbandLimmatstrasse 111Postf",
      "status": "organisation_country"
    }
  },
  "swissbooks-ch": {
    "sourceFamilyId": "swissbooks-ch",
    "countryCodes": [
      "CH"
    ],
    "coverageCountryCodes": [
      "CH"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Association Suisse des Diffuseurs, Editeurs et Libraires",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Association Suisse des Diffuseurs, Editeurs et Libraires18, avenue de la Garecase postale 5291001 LausanneSwitzerlandwww.asdel.ch Schweizerischer Buchhändler und Verleger-VerbandLimmatstrasse 111Postf",
      "status": "organisation_country"
    }
  },
  "gzs-si": {
    "sourceFamilyId": "gzs-si",
    "countryCodes": [
      "SI"
    ],
    "coverageCountryCodes": [
      "SI"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Association of Slovenian PublishersKersnikova",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Association of Slovenian PublishersKersnikova 2SI-1000LjubljanaSloveniawww.gzs.si",
      "status": "organisation_country"
    }
  },
  "uik-ba": {
    "sourceFamilyId": "uik-ba",
    "countryCodes": [
      "BA"
    ],
    "coverageCountryCodes": [
      "BA"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Association of Publishers & Booksellers of Bosnia HerzegovinaMarsala Tita",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Association of Publishers & Booksellers of Bosnia HerzegovinaMarsala Tita 9A71000 SarajevoBosnia Herzegovinawww.uik.ba",
      "status": "organisation_country"
    }
  },
  "mkke-hu": {
    "sourceFamilyId": "mkke-hu",
    "countryCodes": [
      "HU"
    ],
    "coverageCountryCodes": [
      "HU"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Hungarian Publishers and Booksellers AssociationKertész u.",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Hungarian Publishers and Booksellers AssociationKertész u.41 1/4Pf 1301367 BudapestHungarywww.mkke.hu",
      "status": "organisation_country"
    }
  },
  "enelvi-org": {
    "sourceFamilyId": "enelvi-org",
    "countryCodes": [
      "GR"
    ],
    "coverageCountryCodes": [
      "GR"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Association of Greek Publishers and Booksellers",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Association of Greek Publishers and Booksellers9 Zalogou Street10678 AthensGreecewww.enelvi.org",
      "status": "organisation_country"
    }
  },
  "nigerianpublishers-org": {
    "sourceFamilyId": "nigerianpublishers-org",
    "countryCodes": [
      "NG"
    ],
    "coverageCountryCodes": [
      "NG"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Nigerian Publishers AssociationQuarter",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Nigerian Publishers AssociationQuarter 673 Jericho GRAGPO Box 2541IbadanNigeriawww.nigerianpublishers.org",
      "status": "organisation_country"
    }
  },
  "egyptianpublishers-org": {
    "sourceFamilyId": "egyptianpublishers-org",
    "countryCodes": [
      "EG"
    ],
    "coverageCountryCodes": [
      "EG"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Egyptian Publishers Association",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Egyptian Publishers Association92 El Tahrir StreetSaridar Building- Dokki, 2nd FloorCairoEgyptwww.egyptianpublishers.org",
      "status": "organisation_country"
    }
  },
  "publishsa-co-za": {
    "sourceFamilyId": "publishsa-co-za",
    "countryCodes": [
      "ZA"
    ],
    "coverageCountryCodes": [
      "ZA"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Publishers Association of South AfricaPO Box",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Publishers Association of South AfricaPO Box 18223Wynberg7824 Cape TownSouth Africawww.publishsa.co.za",
      "status": "organisation_country"
    }
  },
  "gpba-en": {
    "sourceFamilyId": "gpba-en",
    "countryCodes": [
      "GE"
    ],
    "coverageCountryCodes": [
      "GE"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Georgian Publishers and Booksellers Association",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Georgian Publishers and Booksellers Association33a Pekini St.2nd Entrance, Room 20160 TbilisiGeorgiawww.gpba.en",
      "status": "organisation_country"
    }
  },
  "publishersunionlb-com": {
    "sourceFamilyId": "publishersunionlb-com",
    "countryCodes": [
      "LB"
    ],
    "coverageCountryCodes": [
      "LB"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Syndicate of Publishers Union of LebanonBeir HassanAl Chadi Building, first floorPO Box",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Syndicate of Publishers Union of LebanonBeir HassanAl Chadi Building, first floorPO Box 8843BeirutLebanonwww.publishersunionlb.com",
      "status": "organisation_country"
    }
  },
  "tbpai-co-il": {
    "sourceFamilyId": "tbpai-co-il",
    "countryCodes": [
      "IL"
    ],
    "coverageCountryCodes": [
      "IL"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Book Publishers Association of IsraelPO Box",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Book Publishers Association of IsraelPO Box 20123Tel-Aviv 61201Israelwww.tbpai.co.il",
      "status": "organisation_country"
    }
  },
  "capali-com-pa": {
    "sourceFamilyId": "capali-com-pa",
    "countryCodes": [
      "PA"
    ],
    "coverageCountryCodes": [
      "PA"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Panamanian Book Chamber",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Panamanian Book Chamber Panamanian Book Chamber",
      "status": "organisation_country"
    }
  },
  "singaporebookpublishers-sg": {
    "sourceFamilyId": "singaporebookpublishers-sg",
    "countryCodes": [
      "SG"
    ],
    "coverageCountryCodes": [
      "SG"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Singapore Book Publishers",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Singapore Book Publishers Singapore Book Publishers",
      "status": "organisation_country"
    }
  },
  "bookpublishers-am": {
    "sourceFamilyId": "bookpublishers-am",
    "countryCodes": [
      "AM"
    ],
    "coverageCountryCodes": [
      "AM"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "National Publishers Association of Armenia",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "National Publishers Association of Armenia",
      "status": "organisation_country"
    }
  },
  "kpa21-or-kr": {
    "sourceFamilyId": "kpa21-or-kr",
    "countryCodes": [
      "KR"
    ],
    "coverageCountryCodes": [
      "KR"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Korean Publishers Association",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Korean Publishers Association105-2, Sagan-dongJongno-guSeoul 110-190Koreawww.kpa21.or.kr",
      "status": "organisation_country"
    }
  },
  "biott-org": {
    "sourceFamilyId": "biott-org",
    "countryCodes": [
      "TT"
    ],
    "coverageCountryCodes": [
      "TT"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Book Industry Organisation of Trinidad and Tobago",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Book Industry Organisation of Trinidad and Tobago7a Macoya Industrial EstateMacoya Trinidadbiott.org",
      "status": "organisation_country"
    }
  },
  "adeb-be": {
    "sourceFamilyId": "adeb-be",
    "countryCodes": [
      "BE"
    ],
    "coverageCountryCodes": [
      "BE"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Association des Editeurs Belges (ADEB)Avenue. R. Vandendriessche",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Association des Editeurs Belges (ADEB)Avenue. R. Vandendriessche 18, Boîte 191150 Bruxelles, Belgium adeb.be",
      "status": "organisation_country"
    }
  },
  "boek-be": {
    "sourceFamilyId": "boek-be",
    "countryCodes": [
      "BE"
    ],
    "coverageCountryCodes": [
      "BE"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Flemish Publishers AssociationHet Huis van het BoekTe Boelaerlei",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Flemish Publishers AssociationHet Huis van het BoekTe Boelaerlei 372140 Antwerpen, Belgium boek.be",
      "status": "organisation_country"
    }
  },
  "mediafederatie-nl": {
    "sourceFamilyId": "mediafederatie-nl",
    "countryCodes": [
      "NL"
    ],
    "coverageCountryCodes": [
      "NL"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "De MediafederatieHogehilweg",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "De MediafederatieHogehilweg 61100 CC AmsterdamThe Netherlands mediafederatie.nl",
      "status": "organisation_country"
    }
  },
  "cul-com-uy": {
    "sourceFamilyId": "cul-com-uy",
    "countryCodes": [
      "UY"
    ],
    "coverageCountryCodes": [
      "UY"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "cul.com.uy/",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Cámara Uruguaya de Libro (CUL) Colón 1476, ap. 102 C.P. 11000 Montevideo Uruguay cul.com.uy/",
      "status": "organisation_country"
    }
  },
  "libroscr-com": {
    "sourceFamilyId": "libroscr-com",
    "countryCodes": [
      "CR"
    ],
    "coverageCountryCodes": [
      "CR"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Cámara Costarricense del Libro (CCdL)Holland House, Barrio EscalanteSan JoséCosta Ricahttp://libroscr.com",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Cámara Costarricense del Libro (CCdL)Holland House, Barrio EscalanteSan JoséCosta Ricahttp://libroscr.com",
      "status": "organisation_country"
    }
  },
  "pik-org-pl": {
    "sourceFamilyId": "pik-org-pl",
    "countryCodes": [
      "PL"
    ],
    "coverageCountryCodes": [
      "PL"
    ],
    "countryEvidence": {
      "method": "official_membership_directory",
      "url": "https://internationalpublishers.org/about/",
      "organisation": "Polish Chamber of Books (PIK)ul. Oleandrów",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Polish Chamber of Books (PIK)ul. Oleandrów 8, 00-629 Warsaw Poland www.pik.org.pl",
      "status": "organisation_country"
    }
  },
  "bksh-al": {
    "sourceFamilyId": "bksh-al",
    "countryCodes": [
      "AL"
    ],
    "coverageCountryCodes": [
      "AL"
    ],
    "countryEvidence": {
      "method": "official_national_library_directory",
      "url": "https://www.cenl.org/library/national-library-of-albania-biblioteka-kombetare/",
      "organisation": "National Library of Albania",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Biblioteka Kombëtare e Shqipërisë / National Library of Albania",
      "status": "organisation_country"
    }
  },
  "nla-am": {
    "sourceFamilyId": "nla-am",
    "countryCodes": [
      "AM"
    ],
    "coverageCountryCodes": [
      "AM"
    ],
    "countryEvidence": {
      "method": "official_national_library_directory",
      "url": "https://www.cenl.org/library/national-library-of-armenia/",
      "organisation": "National Library of Armenia",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Հայաստանի Ազգային Գրադարան / National Library of Armenia",
      "status": "organisation_country"
    }
  },
  "onb-ac-at": {
    "sourceFamilyId": "onb-ac-at",
    "countryCodes": [
      "AT"
    ],
    "coverageCountryCodes": [
      "AT"
    ],
    "countryEvidence": {
      "method": "official_national_library_directory",
      "url": "https://www.cenl.org/library/national-library-of-austria-osterreichische-nationalbibliothek/",
      "organisation": "Austrian National Library",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Österreichische Nationalbibliothek / Austrian National Library",
      "status": "organisation_country"
    }
  },
  "millikitabxana-az": {
    "sourceFamilyId": "millikitabxana-az",
    "countryCodes": [
      "AZ"
    ],
    "coverageCountryCodes": [
      "AZ"
    ],
    "countryEvidence": {
      "method": "official_national_library_directory",
      "url": "https://www.cenl.org/library/national-library-of-azerbaijan-m-f-axundov-adina-azerbaycan-milli-kitabxana/",
      "organisation": "National Library of Azerbaijan",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Azerbaycan Milli Kitabxana / National Library of Azerbaijan",
      "status": "organisation_country"
    }
  },
  "kbr-be": {
    "sourceFamilyId": "kbr-be",
    "countryCodes": [
      "BE"
    ],
    "coverageCountryCodes": [
      "BE"
    ],
    "countryEvidence": {
      "method": "official_national_library_directory",
      "url": "https://www.cenl.org/library/koninklijke-bibliotheek-van-belgie-bibliotheque-royale-de-belgique/",
      "organisation": "Royal Library of Belgium",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Koninklijke Bibliotheek van België / Royal Library of Belgium",
      "status": "organisation_country"
    }
  },
  "nub-ba": {
    "sourceFamilyId": "nub-ba",
    "countryCodes": [
      "BA"
    ],
    "coverageCountryCodes": [
      "BA"
    ],
    "countryEvidence": {
      "method": "official_national_library_directory",
      "url": "https://www.cenl.org/library/nacionalna-i-univerzitetska-biblioteka/",
      "organisation": "National and University Library of Bosnia and Herzegovina",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Nacionalna i univerzitetska biblioteka / National and University Library of Bosnia and Herzegovina",
      "status": "organisation_country"
    }
  },
  "nationallibrary-bg": {
    "sourceFamilyId": "nationallibrary-bg",
    "countryCodes": [
      "BG"
    ],
    "coverageCountryCodes": [
      "BG"
    ],
    "countryEvidence": {
      "method": "official_national_library_directory",
      "url": "https://www.cenl.org/library/national-library-of-bulgaria-st-st-cyrill-and-methodius-national-library/",
      "organisation": "St.St. Cyril and Methodius National Library",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Национална библиотека „Св. cв. Кирил и Методий / St.St. Cyril and Methodius National Library",
      "status": "organisation_country"
    }
  },
  "nsk-hr": {
    "sourceFamilyId": "nsk-hr",
    "countryCodes": [
      "HR"
    ],
    "coverageCountryCodes": [
      "HR"
    ],
    "countryEvidence": {
      "method": "official_national_library_directory",
      "url": "https://www.cenl.org/library/national-and-university-library-in-zagreb/",
      "organisation": "National and University Library in Zagreb",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Nacionalna i sveučilišna knjižnica u Zagrebu / National and University Library in Zagreb",
      "status": "organisation_country"
    }
  },
  "cypruslibrary-gov-cy": {
    "sourceFamilyId": "cypruslibrary-gov-cy",
    "countryCodes": [
      "CY"
    ],
    "coverageCountryCodes": [
      "CY"
    ],
    "countryEvidence": {
      "method": "official_national_library_directory",
      "url": "https://www.cenl.org/library/cyprus-library/",
      "organisation": "Cyprus Library",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Κυπριακή Βιβλιοθήκη / Cyprus Library",
      "status": "organisation_country"
    }
  },
  "nkp-cz": {
    "sourceFamilyId": "nkp-cz",
    "countryCodes": [
      "CZ"
    ],
    "coverageCountryCodes": [
      "CZ"
    ],
    "countryEvidence": {
      "method": "official_national_library_directory",
      "url": "https://www.cenl.org/library/national-library-of-the-czech-republic-narodni-knihovna-ceske-republiky/",
      "organisation": "National Library of the Czech Republic",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Národní knihovna České republiky / National Library of the Czech Republic",
      "status": "organisation_country"
    }
  },
  "kb-dk": {
    "sourceFamilyId": "kb-dk",
    "countryCodes": [
      "DK"
    ],
    "coverageCountryCodes": [
      "DK"
    ],
    "countryEvidence": {
      "method": "official_national_library_directory",
      "url": "https://www.cenl.org/library/national-library-of-denmark-det-kongelige-bibliotek/",
      "organisation": "Royal Danish Library",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Det Kongelige Bibliotek / Royal Danish Library",
      "status": "organisation_country"
    }
  },
  "rara-ee": {
    "sourceFamilyId": "rara-ee",
    "countryCodes": [
      "EE"
    ],
    "coverageCountryCodes": [
      "EE"
    ],
    "countryEvidence": {
      "method": "official_national_library_directory",
      "url": "https://www.cenl.org/library/national-library-of-estonia-eesti-rahvusraamatukogu/",
      "organisation": "National Library of Estonia",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Eesti Rahvusraamatukogu / National Library of Estonia",
      "status": "organisation_country"
    }
  },
  "kansalliskirjasto-fi": {
    "sourceFamilyId": "kansalliskirjasto-fi",
    "countryCodes": [
      "FI"
    ],
    "coverageCountryCodes": [
      "FI"
    ],
    "countryEvidence": {
      "method": "official_national_library_directory",
      "url": "https://www.cenl.org/library/the-national-library-of-finland-kansalliskirjasto/",
      "organisation": "The National Library of Finland",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Kansalliskirjasto / The National Library of Finland",
      "status": "organisation_country"
    }
  },
  "nplg-gov-ge": {
    "sourceFamilyId": "nplg-gov-ge",
    "countryCodes": [
      "GE"
    ],
    "coverageCountryCodes": [
      "GE"
    ],
    "countryEvidence": {
      "method": "official_national_library_directory",
      "url": "https://www.cenl.org/library/national-library-of-georgia/",
      "organisation": "National Library of Georgia",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "სსიპ ილია ჭავჭავაძის სახელობის საქართველოს ეროვნული ბიბლიოთეკა / National Library of Georgia",
      "status": "organisation_country"
    }
  },
  "dnb-de": {
    "sourceFamilyId": "dnb-de",
    "countryCodes": [
      "DE"
    ],
    "coverageCountryCodes": [
      "DE"
    ],
    "countryEvidence": {
      "method": "official_national_library_directory",
      "url": "https://www.cenl.org/library/deutsche-nationalbibliothek-german-national-library/",
      "organisation": "German National Library",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Deutsche Nationalbibliothek / German National Library",
      "status": "organisation_country"
    }
  },
  "nlg-gr": {
    "sourceFamilyId": "nlg-gr",
    "countryCodes": [
      "GR"
    ],
    "coverageCountryCodes": [
      "GR"
    ],
    "countryEvidence": {
      "method": "official_national_library_directory",
      "url": "https://www.cenl.org/library/national-library-of-greece/",
      "organisation": "National Library of Greece",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Εθνική Βιβλιοθήκη της Ελλάδος / National Library of Greece",
      "status": "organisation_country"
    }
  },
  "oszk-hu": {
    "sourceFamilyId": "oszk-hu",
    "countryCodes": [
      "HU"
    ],
    "coverageCountryCodes": [
      "HU"
    ],
    "countryEvidence": {
      "method": "official_national_library_directory",
      "url": "https://www.cenl.org/library/national-library-of-hungary-orszagos-szechenyi-konyvtar-oszk/",
      "organisation": "National Library of Hungary",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Országos Széchényi Könyvtár (OSZK) / National Library of Hungary",
      "status": "organisation_country"
    }
  },
  "landsbokasafn-is": {
    "sourceFamilyId": "landsbokasafn-is",
    "countryCodes": [
      "IS"
    ],
    "coverageCountryCodes": [
      "IS"
    ],
    "countryEvidence": {
      "method": "official_national_library_directory",
      "url": "https://www.cenl.org/library/national-university-library-of-iceland/",
      "organisation": "National and University Library of Iceland",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Landsbókasafn Íslands – Háskólabókasafn / National and University Library of Iceland",
      "status": "organisation_country"
    }
  },
  "nli-ie": {
    "sourceFamilyId": "nli-ie",
    "countryCodes": [
      "IE"
    ],
    "coverageCountryCodes": [
      "IE"
    ],
    "countryEvidence": {
      "method": "official_national_library_directory",
      "url": "https://www.cenl.org/library/national-library-of-ireland/",
      "organisation": "National Library of Ireland",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Leabharlann Náisiúnta na hÉireann / National Library of Ireland",
      "status": "organisation_country"
    }
  },
  "bncf-firenze-sbn-it": {
    "sourceFamilyId": "bncf-firenze-sbn-it",
    "countryCodes": [
      "IT"
    ],
    "coverageCountryCodes": [
      "IT"
    ],
    "countryEvidence": {
      "method": "official_national_library_directory",
      "url": "https://www.cenl.org/library/the-central-national-library-of-florence/",
      "organisation": "The Central National Library of Florence",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Biblioteca Nazionale Centrale di Firenze / The Central National Library of Florence",
      "status": "organisation_country"
    }
  },
  "bncrm-beniculturali-it": {
    "sourceFamilyId": "bncrm-beniculturali-it",
    "countryCodes": [
      "IT"
    ],
    "coverageCountryCodes": [
      "IT"
    ],
    "countryEvidence": {
      "method": "official_national_library_directory",
      "url": "https://www.cenl.org/library/the-central-national-library-of-rome/",
      "organisation": "National Central Library of Rome",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Biblioteca nazionale centrale di Roma / National Central Library of Rome",
      "status": "organisation_country"
    }
  },
  "lnb-lv": {
    "sourceFamilyId": "lnb-lv",
    "countryCodes": [
      "LV"
    ],
    "coverageCountryCodes": [
      "LV"
    ],
    "countryEvidence": {
      "method": "official_national_library_directory",
      "url": "https://www.cenl.org/library/national-library-of-latvia/",
      "organisation": "National Library of Latvia",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Latvijas Nacionālā bibliotēka / National Library of Latvia",
      "status": "organisation_country"
    }
  },
  "landesbibliothek-li": {
    "sourceFamilyId": "landesbibliothek-li",
    "countryCodes": [
      "LI"
    ],
    "coverageCountryCodes": [
      "LI"
    ],
    "countryEvidence": {
      "method": "official_national_library_directory",
      "url": "https://www.cenl.org/library/national-library-of-liechtenstein/",
      "organisation": "National Library of Liechtenstein",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Liechtensteinische Landesbibliothek / National Library of Liechtenstein",
      "status": "organisation_country"
    }
  },
  "lnb-lt": {
    "sourceFamilyId": "lnb-lt",
    "countryCodes": [
      "LT"
    ],
    "coverageCountryCodes": [
      "LT"
    ],
    "countryEvidence": {
      "method": "official_national_library_directory",
      "url": "https://www.cenl.org/library/martynas-mazvydas-national-library-of-lithuania/",
      "organisation": "Martynas Mazvydas National Library of Lithuania",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Lietuvos nacionalinė Martyno Mažvydo biblioteka / Martynas Mazvydas National Library of Lithuania",
      "status": "organisation_country"
    }
  },
  "bnl-public-lu": {
    "sourceFamilyId": "bnl-public-lu",
    "countryCodes": [
      "LU"
    ],
    "coverageCountryCodes": [
      "LU"
    ],
    "countryEvidence": {
      "method": "official_national_library_directory",
      "url": "https://www.cenl.org/library/national-library-of-luxembourg/",
      "organisation": "National Library of Luxembourg",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Bibliothèque nationale du Luxembourg / National Library of Luxembourg",
      "status": "organisation_country"
    }
  },
  "maltalibraries-gov-mt": {
    "sourceFamilyId": "maltalibraries-gov-mt",
    "countryCodes": [
      "MT"
    ],
    "coverageCountryCodes": [
      "MT"
    ],
    "countryEvidence": {
      "method": "official_national_library_directory",
      "url": "https://www.cenl.org/library/malta-libraries-the-national-library-of-malta/",
      "organisation": "Malta Libraries – The National Library of Malta",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Bibljoteka Nazzjonali ta’ Malta / Malta Libraries – The National Library of Malta",
      "status": "organisation_country"
    }
  },
  "bnrm-md": {
    "sourceFamilyId": "bnrm-md",
    "countryCodes": [
      "MD"
    ],
    "coverageCountryCodes": [
      "MD"
    ],
    "countryEvidence": {
      "method": "official_national_library_directory",
      "url": "https://www.cenl.org/library/national-library-of-the-republic-of-moldova-biblioteca-nationala-a-republicii-moldova/",
      "organisation": "National Library of the Republic of Moldova",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Biblioteca Natională a Republicii Moldova / National Library of the Republic of Moldova",
      "status": "organisation_country"
    }
  },
  "nb-cg-me": {
    "sourceFamilyId": "nb-cg-me",
    "countryCodes": [
      "ME"
    ],
    "coverageCountryCodes": [
      "ME"
    ],
    "countryEvidence": {
      "method": "official_national_library_directory",
      "url": "https://www.cenl.org/library/national-library-of-montenegro-djurdje-crnojevic-cetinje-naciocalna-biblioteka-crne-gore-djurdje-crnojevic-cetinje/",
      "organisation": "National Library of Montenegro “Djurdje Crnojevic”",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Nacionalna biblioteka Crne Gore „Đurđe Crnojević“/ National Library of Montenegro “Djurdje Crnojevic”",
      "status": "organisation_country"
    }
  },
  "kb-nl": {
    "sourceFamilyId": "kb-nl",
    "countryCodes": [
      "NL"
    ],
    "coverageCountryCodes": [
      "NL"
    ],
    "countryEvidence": {
      "method": "official_national_library_directory",
      "url": "https://www.cenl.org/library/koninklijke-bibliotheek/",
      "organisation": "KB national library",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "KB nationale bibliotheek / KB national library",
      "status": "organisation_country"
    }
  },
  "nb-no": {
    "sourceFamilyId": "nb-no",
    "countryCodes": [
      "NO"
    ],
    "coverageCountryCodes": [
      "NO"
    ],
    "countryEvidence": {
      "method": "official_national_library_directory",
      "url": "https://www.cenl.org/library/national-library-of-norway-nasjonalbiblioteket/",
      "organisation": "National Library of Norway",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Nasjonalbiblioteket / National Library of Norway",
      "status": "organisation_country"
    }
  },
  "bn-org-pl": {
    "sourceFamilyId": "bn-org-pl",
    "countryCodes": [
      "PL"
    ],
    "coverageCountryCodes": [
      "PL"
    ],
    "countryEvidence": {
      "method": "official_national_library_directory",
      "url": "https://www.cenl.org/library/national-library-of-poland-biblioteka-narodowa/",
      "organisation": "National Library of Poland",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Biblioteka Narodowa / National Library of Poland",
      "status": "organisation_country"
    }
  },
  "bnportugal-gov-pt": {
    "sourceFamilyId": "bnportugal-gov-pt",
    "countryCodes": [
      "PT"
    ],
    "coverageCountryCodes": [
      "PT"
    ],
    "countryEvidence": {
      "method": "official_national_library_directory",
      "url": "https://www.cenl.org/library/national-library-of-portugal/",
      "organisation": "National Library of Portugal",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Biblioteca Nacional de Portugal (BNP) / National Library of Portugal",
      "status": "organisation_country"
    }
  },
  "bibnat-ro": {
    "sourceFamilyId": "bibnat-ro",
    "countryCodes": [
      "RO"
    ],
    "coverageCountryCodes": [
      "RO"
    ],
    "countryEvidence": {
      "method": "official_national_library_directory",
      "url": "https://www.cenl.org/library/national-library-of-romania/",
      "organisation": "National Library of Romania",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Biblioteca Naţională a României / National Library of Romania",
      "status": "organisation_country"
    }
  },
  "nb-rs": {
    "sourceFamilyId": "nb-rs",
    "countryCodes": [
      "RS"
    ],
    "coverageCountryCodes": [
      "RS"
    ],
    "countryEvidence": {
      "method": "official_national_library_directory",
      "url": "https://www.cenl.org/library/national-library-of-serbia/",
      "organisation": "National Library of Serbia",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Народна библиотека Србије / National Library of Serbia",
      "status": "organisation_country"
    }
  },
  "snk-sk": {
    "sourceFamilyId": "snk-sk",
    "countryCodes": [
      "SK"
    ],
    "coverageCountryCodes": [
      "SK"
    ],
    "countryEvidence": {
      "method": "official_national_library_directory",
      "url": "https://www.cenl.org/library/slovak-national-library-slovenska-narodna-kni/",
      "organisation": "Slovak National Library",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Slovenská národná knižnica / Slovak National Library",
      "status": "organisation_country"
    }
  },
  "nuk-uni-lj-si": {
    "sourceFamilyId": "nuk-uni-lj-si",
    "countryCodes": [
      "SI"
    ],
    "coverageCountryCodes": [
      "SI"
    ],
    "countryEvidence": {
      "method": "official_national_library_directory",
      "url": "https://www.cenl.org/library/national-and-university-library-of-slovenia/",
      "organisation": "National and University Library of Slovenia",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Narodna in univerzitetna knjižnica (NUK) / National and University Library of Slovenia",
      "status": "organisation_country"
    }
  },
  "bne-es": {
    "sourceFamilyId": "bne-es",
    "countryCodes": [
      "ES"
    ],
    "coverageCountryCodes": [
      "ES"
    ],
    "countryEvidence": {
      "method": "official_national_library_directory",
      "url": "https://www.cenl.org/library/national-library-of-spain/",
      "organisation": "National Library of Spain",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Biblioteca Nacional de España / National Library of Spain",
      "status": "organisation_country"
    }
  },
  "kb-se": {
    "sourceFamilyId": "kb-se",
    "countryCodes": [
      "SE"
    ],
    "coverageCountryCodes": [
      "SE"
    ],
    "countryEvidence": {
      "method": "official_national_library_directory",
      "url": "https://www.cenl.org/library/national-library-of-sweden-kungliga-biblioteket/",
      "organisation": "National Library of Sweden",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Kungliga Biblioteket / National Library of Sweden",
      "status": "organisation_country"
    }
  },
  "nb-admin-ch": {
    "sourceFamilyId": "nb-admin-ch",
    "countryCodes": [
      "CH"
    ],
    "coverageCountryCodes": [
      "CH"
    ],
    "countryEvidence": {
      "method": "official_national_library_directory",
      "url": "https://www.cenl.org/library/swiss-national-library-schweizerische-nationalbibliothek/",
      "organisation": "Swiss National Library",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Schweizerische Nationalbibliothek / Swiss National Library",
      "status": "organisation_country"
    }
  },
  "mkutup-gov-tr": {
    "sourceFamilyId": "mkutup-gov-tr",
    "countryCodes": [
      "TR"
    ],
    "coverageCountryCodes": [
      "TR"
    ],
    "countryEvidence": {
      "method": "official_national_library_directory",
      "url": "https://www.cenl.org/library/national-library-of-turkiye/",
      "organisation": "National Library of Türkiye",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Türkiye Millî Kütüphane / National Library of Türkiye",
      "status": "organisation_country"
    }
  },
  "nbuv-gov-ua": {
    "sourceFamilyId": "nbuv-gov-ua",
    "countryCodes": [
      "UA"
    ],
    "coverageCountryCodes": [
      "UA"
    ],
    "countryEvidence": {
      "method": "official_national_library_directory",
      "url": "https://www.cenl.org/library/v-vernadsky-national-library-of-ukraine/",
      "organisation": "Vernadsky National Library of Ukraine",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Національна бібліотека України імені В. І. Вернадського / Vernadsky National Library of Ukraine",
      "status": "organisation_country"
    }
  },
  "nls-uk": {
    "sourceFamilyId": "nls-uk",
    "countryCodes": [
      "GB"
    ],
    "coverageCountryCodes": [
      "GB"
    ],
    "countryEvidence": {
      "method": "official_national_library_directory",
      "url": "https://www.cenl.org/library/leabharlann-naiseanta-na-h-alba-national-library-of-scotland/",
      "organisation": "National Library of Scotland",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Leabharlann Nàiseanta na h-Alba / National Library of Scotland",
      "status": "organisation_country"
    }
  },
  "library-wales": {
    "sourceFamilyId": "library-wales",
    "countryCodes": [
      "GB"
    ],
    "coverageCountryCodes": [
      "GB"
    ],
    "countryEvidence": {
      "method": "official_national_library_directory",
      "url": "https://www.cenl.org/library/llyfrgell-genedlaethol-cymru-national-library-of-wales/",
      "organisation": "National Library of Wales",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Llyfrgell Genedlaethol Cymru / National Library of Wales",
      "status": "organisation_country"
    }
  },
  "vaticanlibrary-va": {
    "sourceFamilyId": "vaticanlibrary-va",
    "countryCodes": [
      "VA"
    ],
    "coverageCountryCodes": [
      "VA"
    ],
    "countryEvidence": {
      "method": "official_national_library_directory",
      "url": "https://www.cenl.org/library/the-vatican-library-biblioteca-apostolica-vaticana/",
      "organisation": "The Vatican Library",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Biblioteca Apostolica Vaticana / The Vatican Library",
      "status": "organisation_country"
    }
  },
  "pen-international-org": {
    "sourceFamilyId": "pen-international-org",
    "countryCodes": [
      "GB"
    ],
    "coverageCountryCodes": [
      "GB"
    ],
    "countryEvidence": {
      "method": "official_PEN_centre_directory",
      "url": "https://pen.org/the-pen-world/",
      "organisation": "PEN International",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "PEN International",
      "status": "organisation_country"
    }
  },
  "penclubedobrasil-org-br": {
    "sourceFamilyId": "penclubedobrasil-org-br",
    "countryCodes": [
      "BR"
    ],
    "coverageCountryCodes": [
      "BR"
    ],
    "countryEvidence": {
      "method": "official_PEN_centre_directory",
      "url": "https://pen.org/the-pen-world/",
      "organisation": "Pen Clube do Brasil",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Pen Clube do Brasil",
      "status": "organisation_country"
    }
  },
  "euskalpen-eus": {
    "sourceFamilyId": "euskalpen-eus",
    "countryCodes": [
      "ES"
    ],
    "coverageCountryCodes": [
      "ES"
    ],
    "countryEvidence": {
      "method": "official_PEN_centre_directory",
      "url": "https://pen.org/the-pen-world/",
      "organisation": "Basque PEN",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Basque PEN",
      "status": "organisation_country"
    }
  },
  "penbelarus-org": {
    "sourceFamilyId": "penbelarus-org",
    "countryCodes": [],
    "coverageCountryCodes": [
      "BY"
    ],
    "countryEvidence": {
      "method": "official_PEN_centre_directory",
      "url": "https://pen.org/the-pen-world/",
      "organisation": "Belarusian PEN",
      "statement": "Literary constituency is recorded as coverage only; no office-country claim is made.",
      "excerpt": "Belarusian PEN",
      "status": "office_country_unconfirmed"
    }
  },
  "penbih-ba": {
    "sourceFamilyId": "penbih-ba",
    "countryCodes": [
      "BA"
    ],
    "coverageCountryCodes": [
      "BA"
    ],
    "countryEvidence": {
      "method": "official_PEN_centre_directory",
      "url": "https://pen.org/the-pen-world/",
      "organisation": "Bosnian PEN",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Bosnian PEN",
      "status": "organisation_country"
    }
  },
  "pencanada-ca": {
    "sourceFamilyId": "pencanada-ca",
    "countryCodes": [
      "CA"
    ],
    "coverageCountryCodes": [
      "CA"
    ],
    "countryEvidence": {
      "method": "official_PEN_centre_directory",
      "url": "https://pen.org/the-pen-world/",
      "organisation": "PEN Canada",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "PEN Canada",
      "status": "organisation_country"
    }
  },
  "pencatala-cat": {
    "sourceFamilyId": "pencatala-cat",
    "countryCodes": [
      "ES"
    ],
    "coverageCountryCodes": [
      "ES"
    ],
    "countryEvidence": {
      "method": "official_PEN_centre_directory",
      "url": "https://pen.org/the-pen-world/",
      "organisation": "PEN Catalan",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "PEN Catalan",
      "status": "organisation_country"
    }
  },
  "chinesepen-org": {
    "sourceFamilyId": "chinesepen-org",
    "countryCodes": [
      "CN"
    ],
    "coverageCountryCodes": [
      "CN"
    ],
    "countryEvidence": {
      "method": "official_PEN_centre_directory",
      "url": "https://pen.org/the-pen-world/",
      "organisation": "PEN China",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "PEN China",
      "status": "organisation_country"
    }
  },
  "pen-dk": {
    "sourceFamilyId": "pen-dk",
    "countryCodes": [
      "DK"
    ],
    "coverageCountryCodes": [
      "DK"
    ],
    "countryEvidence": {
      "method": "official_PEN_centre_directory",
      "url": "https://pen.org/the-pen-world/",
      "organisation": "Danish PEN",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Danish PEN",
      "status": "organisation_country"
    }
  },
  "englishpen-org": {
    "sourceFamilyId": "englishpen-org",
    "countryCodes": [
      "GB"
    ],
    "coverageCountryCodes": [
      "GB"
    ],
    "countryEvidence": {
      "method": "official_PEN_centre_directory",
      "url": "https://pen.org/the-pen-world/",
      "organisation": "English PEN",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "English PEN",
      "status": "organisation_country"
    }
  },
  "pengalicia-gal": {
    "sourceFamilyId": "pengalicia-gal",
    "countryCodes": [
      "ES"
    ],
    "coverageCountryCodes": [
      "ES"
    ],
    "countryEvidence": {
      "method": "official_PEN_centre_directory",
      "url": "https://pen.org/the-pen-world/",
      "organisation": "PEN Galicia",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "PEN Galicia",
      "status": "organisation_country"
    }
  },
  "pen-deutschland-de": {
    "sourceFamilyId": "pen-deutschland-de",
    "countryCodes": [
      "DE"
    ],
    "coverageCountryCodes": [
      "DE"
    ],
    "countryEvidence": {
      "method": "official_PEN_centre_directory",
      "url": "https://pen.org/the-pen-world/",
      "organisation": "PEN Germany",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "PEN Germany",
      "status": "organisation_country"
    }
  },
  "irishpen-com": {
    "sourceFamilyId": "irishpen-com",
    "countryCodes": [
      "IE"
    ],
    "coverageCountryCodes": [
      "IE"
    ],
    "countryEvidence": {
      "method": "official_PEN_centre_directory",
      "url": "https://pen.org/the-pen-world/",
      "organisation": "Irish PEN",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Irish PEN",
      "status": "organisation_country"
    }
  },
  "pen-kurd-org": {
    "sourceFamilyId": "pen-kurd-org",
    "countryCodes": [],
    "coverageCountryCodes": [
      "DE"
    ],
    "countryEvidence": {
      "method": "official_PEN_centre_directory",
      "url": "https://pen.org/the-pen-world/",
      "organisation": "Kurdish PEN",
      "statement": "Literary constituency is recorded as coverage only; no office-country claim is made.",
      "excerpt": "Kurdish PEN",
      "status": "office_country_unconfirmed"
    }
  },
  "norskpen-no": {
    "sourceFamilyId": "norskpen-no",
    "countryCodes": [
      "NO"
    ],
    "coverageCountryCodes": [
      "NO"
    ],
    "countryEvidence": {
      "method": "official_PEN_centre_directory",
      "url": "https://pen.org/the-pen-world/",
      "organisation": "Norwegian PEN",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Norwegian PEN",
      "status": "organisation_country"
    }
  },
  "philippinepen-ph": {
    "sourceFamilyId": "philippinepen-ph",
    "countryCodes": [
      "PH"
    ],
    "coverageCountryCodes": [
      "PH"
    ],
    "countryEvidence": {
      "method": "official_PEN_centre_directory",
      "url": "https://pen.org/the-pen-world/",
      "organisation": "Philippine PEN",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Philippine PEN",
      "status": "organisation_country"
    }
  },
  "penclub-com-pl": {
    "sourceFamilyId": "penclub-com-pl",
    "countryCodes": [
      "PL"
    ],
    "coverageCountryCodes": [
      "PL"
    ],
    "countryEvidence": {
      "method": "official_PEN_centre_directory",
      "url": "https://pen.org/the-pen-world/",
      "organisation": "Polish PEN",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Polish PEN",
      "status": "organisation_country"
    }
  },
  "penromania-org": {
    "sourceFamilyId": "penromania-org",
    "countryCodes": [
      "RO"
    ],
    "coverageCountryCodes": [
      "RO"
    ],
    "countryEvidence": {
      "method": "official_PEN_centre_directory",
      "url": "https://pen.org/the-pen-world/",
      "organisation": "PEN Romania",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "PEN Romania",
      "status": "organisation_country"
    }
  },
  "penrussia-org": {
    "sourceFamilyId": "penrussia-org",
    "countryCodes": [
      "RU"
    ],
    "coverageCountryCodes": [
      "RU"
    ],
    "countryEvidence": {
      "method": "official_PEN_centre_directory",
      "url": "https://pen.org/the-pen-world/",
      "organisation": "PEN Russia",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "PEN Russia",
      "status": "organisation_country"
    }
  },
  "scottishpen-org": {
    "sourceFamilyId": "scottishpen-org",
    "countryCodes": [
      "GB"
    ],
    "coverageCountryCodes": [
      "GB"
    ],
    "countryEvidence": {
      "method": "official_PEN_centre_directory",
      "url": "https://pen.org/the-pen-world/",
      "organisation": "PEN Scotland",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "PEN Scotland",
      "status": "organisation_country"
    }
  },
  "penslovenia-zdruzenje-si": {
    "sourceFamilyId": "penslovenia-zdruzenje-si",
    "countryCodes": [
      "SI"
    ],
    "coverageCountryCodes": [
      "SI"
    ],
    "countryEvidence": {
      "method": "official_PEN_centre_directory",
      "url": "https://pen.org/the-pen-world/",
      "organisation": "PEN Slovenia",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "PEN Slovenia",
      "status": "organisation_country"
    }
  },
  "pensweden-org": {
    "sourceFamilyId": "pensweden-org",
    "countryCodes": [
      "SE"
    ],
    "coverageCountryCodes": [
      "SE"
    ],
    "countryEvidence": {
      "method": "official_PEN_centre_directory",
      "url": "https://pen.org/the-pen-world/",
      "organisation": "Swedish PEN",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Swedish PEN",
      "status": "organisation_country"
    }
  },
  "pen-dschweiz-ch": {
    "sourceFamilyId": "pen-dschweiz-ch",
    "countryCodes": [
      "CH"
    ],
    "coverageCountryCodes": [
      "CH"
    ],
    "countryEvidence": {
      "method": "official_PEN_centre_directory",
      "url": "https://pen.org/the-pen-world/",
      "organisation": "Swiss German PEN",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Swiss German PEN",
      "status": "organisation_country"
    }
  },
  "pen-org-au": {
    "sourceFamilyId": "pen-org-au",
    "countryCodes": [
      "AU"
    ],
    "coverageCountryCodes": [
      "AU"
    ],
    "countryEvidence": {
      "method": "official_PEN_centre_directory",
      "url": "https://pen.org/the-pen-world/",
      "organisation": "Sydney PEN",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Sydney PEN",
      "status": "organisation_country"
    }
  },
  "god-literatury": {
    "sourceFamilyId": "god-literatury",
    "countryCodes": [
      "RU"
    ],
    "coverageCountryCodes": [
      "RU"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "archive:source_probe_notes.json",
      "organisation": "Год литературы",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Год литературы",
      "status": "organisation_country"
    }
  },
  "rsl": {
    "sourceFamilyId": "rsl",
    "countryCodes": [
      "RU"
    ],
    "coverageCountryCodes": [
      "RU"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "archive:source_probe_notes.json",
      "organisation": "Российская государственная библиотека",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Российская государственная библиотека",
      "status": "organisation_country"
    }
  },
  "culture": {
    "sourceFamilyId": "culture",
    "countryCodes": [
      "RU"
    ],
    "coverageCountryCodes": [
      "RU"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "archive:source_probe_notes.json",
      "organisation": "Культура.РФ",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Культура.РФ",
      "status": "organisation_country"
    }
  },
  "publishers-weekly": {
    "sourceFamilyId": "publishers-weekly",
    "countryCodes": [
      "US"
    ],
    "coverageCountryCodes": [
      "US"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "archive:source_probe_notes.json",
      "organisation": "Publishers Weekly",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Publishers Weekly",
      "status": "organisation_country"
    }
  },
  "publishing-perspectives": {
    "sourceFamilyId": "publishing-perspectives",
    "countryCodes": [
      "US"
    ],
    "coverageCountryCodes": [
      "US"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "archive:source_probe_notes.json",
      "organisation": "Publishing Perspectives",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Publishing Perspectives",
      "status": "organisation_country"
    }
  },
  "eksmo": {
    "sourceFamilyId": "eksmo-ast",
    "countryCodes": [
      "RU"
    ],
    "coverageCountryCodes": [
      "RU"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "archive:source_probe_notes.json",
      "organisation": "Эксмо",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Эксмо",
      "status": "organisation_country"
    }
  },
  "ast": {
    "sourceFamilyId": "eksmo-ast",
    "countryCodes": [
      "RU"
    ],
    "coverageCountryCodes": [
      "RU"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "archive:source_probe_notes.json",
      "organisation": "АСТ",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "АСТ",
      "status": "organisation_country"
    }
  },
  "litres": {
    "sourceFamilyId": "litres",
    "countryCodes": [
      "RU"
    ],
    "coverageCountryCodes": [
      "RU"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "archive:source_probe_notes.json",
      "organisation": "Литрес Журнал",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Литрес Журнал",
      "status": "organisation_country"
    }
  },
  "ad-marginem": {
    "sourceFamilyId": "ad-marginem",
    "countryCodes": [
      "RU"
    ],
    "coverageCountryCodes": [
      "RU"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "archive:source_probe_notes.json",
      "organisation": "Ad Marginem",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Ad Marginem",
      "status": "organisation_country"
    }
  },
  "nlo": {
    "sourceFamilyId": "nlo",
    "countryCodes": [
      "RU"
    ],
    "coverageCountryCodes": [
      "RU"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "archive:source_probe_notes.json",
      "organisation": "Новое литературное обозрение / НЛО Медиа",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Новое литературное обозрение / НЛО Медиа",
      "status": "organisation_country"
    }
  },
  "samokat": {
    "sourceFamilyId": "samokat",
    "countryCodes": [
      "RU"
    ],
    "coverageCountryCodes": [
      "RU"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "archive:source_probe_notes.json",
      "organisation": "Самокат",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Самокат",
      "status": "organisation_country"
    }
  },
  "edinburgh": {
    "sourceFamilyId": "edinburgh",
    "countryCodes": [
      "GB"
    ],
    "coverageCountryCodes": [
      "GB"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "archive:source_probe_notes.json",
      "organisation": "Edinburgh International Book Festival",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Edinburgh International Book Festival",
      "status": "organisation_country"
    }
  },
  "literaturhaus": {
    "sourceFamilyId": "literaturhaus",
    "countryCodes": [
      "DE"
    ],
    "coverageCountryCodes": [
      "DE"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "archive:source_probe_notes.json",
      "organisation": "Literaturhaus.de",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Literaturhaus.de",
      "status": "organisation_country"
    }
  },
  "ndl-japan": {
    "sourceFamilyId": "ndl-japan",
    "countryCodes": [
      "JP"
    ],
    "coverageCountryCodes": [
      "JP"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.ndl.go.jp/en/news/news_index",
      "organisation": "National Diet Library",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "National Diet Library",
      "status": "organisation_country"
    }
  },
  "bn-argentina": {
    "sourceFamilyId": "bn-argentina",
    "countryCodes": [
      "AR"
    ],
    "coverageCountryCodes": [
      "AR"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.bn.gob.ar/noticias",
      "organisation": "Biblioteca Nacional Mariano Moreno",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Biblioteca Nacional Mariano Moreno",
      "status": "organisation_country"
    }
  },
  "bn-brasil": {
    "sourceFamilyId": "bn-brasil",
    "countryCodes": [
      "BR"
    ],
    "coverageCountryCodes": [
      "BR"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.gov.br/bn/pt-br/central-de-conteudos/noticias",
      "organisation": "Fundação Biblioteca Nacional",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Fundação Biblioteca Nacional",
      "status": "organisation_country"
    }
  },
  "bn-chile": {
    "sourceFamilyId": "bn-chile",
    "countryCodes": [
      "CL"
    ],
    "coverageCountryCodes": [
      "CL"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.bibliotecanacional.gob.cl/noticias",
      "organisation": "Biblioteca Nacional de Chile",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Biblioteca Nacional de Chile",
      "status": "organisation_country"
    }
  },
  "bn-peru": {
    "sourceFamilyId": "bn-peru",
    "countryCodes": [
      "PE"
    ],
    "coverageCountryCodes": [
      "PE"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.gob.pe/institucion/bnp/noticias",
      "organisation": "Biblioteca Nacional del Perú",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Biblioteca Nacional del Perú",
      "status": "organisation_country"
    }
  },
  "bn-colombia": {
    "sourceFamilyId": "bn-colombia",
    "countryCodes": [
      "CO"
    ],
    "coverageCountryCodes": [
      "CO"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.bibliotecanacional.gov.co/es-co/actividades/noticias/Paginas/Todas-las-noticias-RNBP.aspx",
      "organisation": "Biblioteca Nacional de Colombia",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Biblioteca Nacional de Colombia",
      "status": "organisation_country"
    }
  },
  "brittle-paper": {
    "sourceFamilyId": "brittle-paper",
    "countryCodes": [],
    "coverageCountryCodes": [
      "NG",
      "ZA",
      "KE",
      "GH"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://brittlepaper.com/",
      "organisation": "Brittle Paper",
      "statement": "Literary constituency is recorded as coverage only; no office-country claim is made.",
      "excerpt": "Brittle Paper",
      "status": "office_country_unconfirmed"
    }
  },
  "asymptote": {
    "sourceFamilyId": "asymptote",
    "countryCodes": [
      "SG"
    ],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.asymptotejournal.com/about/",
      "organisation": "Asymptote",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Asymptote is incorporated in Singapore.",
      "status": "organisation_country"
    }
  },
  "huza-press": {
    "sourceFamilyId": "huza-press",
    "countryCodes": [
      "RW"
    ],
    "coverageCountryCodes": [
      "RW"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://huza.press/",
      "organisation": "Huza Press",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Huza Press",
      "status": "organisation_country"
    }
  },
  "bakwa-magazine": {
    "sourceFamilyId": "bakwa-magazine",
    "countryCodes": [
      "CM"
    ],
    "coverageCountryCodes": [
      "CM"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://bakwamagazine.com/news/",
      "organisation": "Bakwa Magazine",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Bakwa Magazine",
      "status": "organisation_country"
    }
  },
  "sahitya-akademi": {
    "sourceFamilyId": "sahitya-akademi",
    "countryCodes": [
      "IN"
    ],
    "coverageCountryCodes": [
      "IN"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.sahitya-akademi.gov.in/",
      "organisation": "Sahitya Akademi",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Sahitya Akademi",
      "status": "organisation_country"
    }
  },
  "lti-korea": {
    "sourceFamilyId": "lti-korea",
    "countryCodes": [
      "KR"
    ],
    "coverageCountryCodes": [
      "KR"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.ltikorea.or.kr/kr/board/press/boardList.do",
      "organisation": "Literature Translation Institute of Korea",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Literature Translation Institute of Korea",
      "status": "organisation_country"
    }
  },
  "cassava-republic": {
    "sourceFamilyId": "cassava-republic",
    "countryCodes": [
      "NG"
    ],
    "coverageCountryCodes": [
      "NG",
      "GB"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://cassavarepublic.biz/blog-2/",
      "organisation": "Cassava Republic Press",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Cassava Republic Press",
      "status": "organisation_country"
    }
  },
  "jacana": {
    "sourceFamilyId": "jacana",
    "countryCodes": [
      "ZA"
    ],
    "coverageCountryCodes": [
      "ZA"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://jacana.co.za/",
      "organisation": "Jacana Media",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Jacana Media",
      "status": "organisation_country"
    }
  },
  "modjaji": {
    "sourceFamilyId": "modjaji",
    "countryCodes": [
      "ZA"
    ],
    "coverageCountryCodes": [
      "ZA"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://modjajibooks.co.za/topics/imprint-africa/",
      "organisation": "Modjaji Books",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Modjaji Books",
      "status": "organisation_country"
    }
  },
  "doek": {
    "sourceFamilyId": "doek",
    "countryCodes": [
      "NA"
    ],
    "coverageCountryCodes": [
      "NA"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://doeklitmag.com/",
      "organisation": "Doek!",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Doek!",
      "status": "organisation_country"
    }
  },
  "karachi-literature-festival": {
    "sourceFamilyId": "karachi-literature-festival",
    "countryCodes": [
      "PK"
    ],
    "coverageCountryCodes": [
      "PK"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.karachiliteraturefestival.com/",
      "organisation": "Karachi Literature Festival",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Karachi Literature Festival",
      "status": "organisation_country"
    }
  },
  "galle-literary-festival": {
    "sourceFamilyId": "galle-literary-festival",
    "countryCodes": [
      "LK"
    ],
    "coverageCountryCodes": [
      "LK"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://galleliteraryfestival.com/",
      "organisation": "Galle Literary Festival",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Galle Literary Festival",
      "status": "organisation_country"
    }
  },
  "taipei-book-fair": {
    "sourceFamilyId": "taipei-book-fair",
    "countryCodes": [
      "TW"
    ],
    "coverageCountryCodes": [
      "TW"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.tibe.org.tw/",
      "organisation": "Taipei International Book Exhibition",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Taipei International Book Exhibition",
      "status": "organisation_country"
    }
  },
  "nhanam": {
    "sourceFamilyId": "nhanam",
    "countryCodes": [
      "VN"
    ],
    "coverageCountryCodes": [
      "VN"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://nhanam.vn/",
      "organisation": "Nhã Nam",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Nhã Nam",
      "status": "organisation_country"
    }
  },
  "qatar-national-library": {
    "sourceFamilyId": "qatar-national-library",
    "countryCodes": [
      "QA"
    ],
    "coverageCountryCodes": [
      "QA"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.qnl.qa/en",
      "organisation": "Qatar National Library",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Qatar National Library",
      "status": "organisation_country"
    }
  },
  "abu-dhabi-arabic-centre": {
    "sourceFamilyId": "abu-dhabi-arabic-centre",
    "countryCodes": [
      "AE"
    ],
    "coverageCountryCodes": [
      "AE"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://alc.ae/en/",
      "organisation": "Abu Dhabi Arabic Language Centre",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Abu Dhabi Arabic Language Centre",
      "status": "organisation_country"
    }
  },
  "antares": {
    "sourceFamilyId": "antares",
    "countryCodes": [
      "AM"
    ],
    "coverageCountryCodes": [
      "AM"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://antares.am/",
      "organisation": "Antares",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Antares",
      "status": "organisation_country"
    }
  },
  "seoul-book-fair": {
    "sourceFamilyId": "seoul-book-fair",
    "countryCodes": [
      "KR"
    ],
    "coverageCountryCodes": [
      "KR"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://sibf.or.kr/en/",
      "organisation": "Seoul International Book Fair",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Seoul International Book Fair",
      "status": "organisation_country"
    }
  },
  "jaipur-literature-festival": {
    "sourceFamilyId": "jaipur-literature-festival",
    "countryCodes": [
      "IN"
    ],
    "coverageCountryCodes": [
      "IN"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://jaipurliteraturefestival.org/",
      "organisation": "Jaipur Literature Festival",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Jaipur Literature Festival",
      "status": "organisation_country"
    }
  },
  "dhaka-lit-fest": {
    "sourceFamilyId": "dhaka-lit-fest",
    "countryCodes": [
      "BD"
    ],
    "coverageCountryCodes": [
      "BD"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.dhakalitfest.com/",
      "organisation": "Dhaka Lit Fest",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Dhaka Lit Fest",
      "status": "organisation_country"
    }
  },
  "nepal-literature-festival": {
    "sourceFamilyId": "nepal-literature-festival",
    "countryCodes": [
      "NP"
    ],
    "coverageCountryCodes": [
      "NP"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://nepalliteraturefestival.com/",
      "organisation": "Nepal Literature Festival",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Nepal Literature Festival",
      "status": "organisation_country"
    }
  },
  "femrite": {
    "sourceFamilyId": "femrite",
    "countryCodes": [
      "UG"
    ],
    "coverageCountryCodes": [
      "UG"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://femrite.org/",
      "organisation": "FEMRITE",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "FEMRITE",
      "status": "organisation_country"
    }
  },
  "amabooks": {
    "sourceFamilyId": "amabooks",
    "countryCodes": [
      "ZW"
    ],
    "coverageCountryCodes": [
      "ZW"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://amabooksbyo.blogspot.com/",
      "organisation": "amaBooks",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "amaBooks",
      "status": "organisation_country"
    }
  },
  "loatad": {
    "sourceFamilyId": "loatad",
    "countryCodes": [
      "GH"
    ],
    "coverageCountryCodes": [
      "GH"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://loatad.org/",
      "organisation": "Library of Africa and the African Diaspora",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Library of Africa and the African Diaspora",
      "status": "organisation_country"
    }
  },
  "jalada": {
    "sourceFamilyId": "jalada",
    "countryCodes": [
      "KE"
    ],
    "coverageCountryCodes": [
      "KE"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://jaladaafrica.org/",
      "organisation": "Jalada Africa",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Jalada Africa",
      "status": "organisation_country"
    }
  },
  "rnb": {
    "sourceFamilyId": "rnb",
    "countryCodes": [
      "RU"
    ],
    "coverageCountryCodes": [
      "RU"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://nlr.ru/",
      "organisation": "Российская национальная библиотека",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Российская национальная библиотека",
      "status": "organisation_country"
    }
  },
  "rosman": {
    "sourceFamilyId": "rosman",
    "countryCodes": [
      "RU"
    ],
    "coverageCountryCodes": [
      "RU"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://rosman.ru/",
      "organisation": "Росмэн",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Росмэн",
      "status": "organisation_country"
    }
  },
  "azbooka": {
    "sourceFamilyId": "azbooka",
    "countryCodes": [
      "RU"
    ],
    "coverageCountryCodes": [
      "RU"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://azbooka.ru/",
      "organisation": "Азбука-Аттикус",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Азбука-Аттикус",
      "status": "organisation_country"
    }
  },
  "alpina": {
    "sourceFamilyId": "alpina",
    "countryCodes": [
      "RU"
    ],
    "coverageCountryCodes": [
      "RU"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://alpinabook.ru/",
      "organisation": "Альпина Паблишер",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Альпина Паблишер",
      "status": "organisation_country"
    }
  },
  "mif": {
    "sourceFamilyId": "mif",
    "countryCodes": [
      "RU"
    ],
    "coverageCountryCodes": [
      "RU"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.mann-ivanov-ferber.ru/",
      "organisation": "МИФ",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "МИФ",
      "status": "organisation_country"
    }
  },
  "polyandria": {
    "sourceFamilyId": "polyandria",
    "countryCodes": [
      "RU"
    ],
    "coverageCountryCodes": [
      "RU"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://polyandria.ru/",
      "organisation": "Поляндрия",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Поляндрия",
      "status": "organisation_country"
    }
  },
  "individuum": {
    "sourceFamilyId": "individuum",
    "countryCodes": [
      "RU"
    ],
    "coverageCountryCodes": [
      "RU"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://individuum.ru/",
      "organisation": "Individuum",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Individuum",
      "status": "organisation_country"
    }
  },
  "corpus": {
    "sourceFamilyId": "eksmo-ast",
    "countryCodes": [
      "RU"
    ],
    "coverageCountryCodes": [
      "RU"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.corpus.ru/",
      "organisation": "Corpus",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Corpus",
      "status": "organisation_country"
    }
  },
  "actualitte": {
    "sourceFamilyId": "actualitte",
    "countryCodes": [
      "FR"
    ],
    "coverageCountryCodes": [
      "FR"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://actualitte.com/",
      "organisation": "ActuaLitté",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "ActuaLitté",
      "status": "organisation_country"
    }
  },
  "livres-hebdo": {
    "sourceFamilyId": "livres-hebdo",
    "countryCodes": [
      "FR"
    ],
    "coverageCountryCodes": [
      "FR"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.livreshebdo.fr/",
      "organisation": "Livres Hebdo",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Livres Hebdo",
      "status": "organisation_country"
    }
  },
  "dosdoce": {
    "sourceFamilyId": "dosdoce",
    "countryCodes": [
      "ES"
    ],
    "coverageCountryCodes": [
      "ES"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.dosdoce.com/",
      "organisation": "Dosdoce",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Dosdoce",
      "status": "organisation_country"
    }
  },
  "el-boomeran": {
    "sourceFamilyId": "el-boomeran",
    "countryCodes": [
      "ES"
    ],
    "coverageCountryCodes": [
      "ES"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.elboomeran.com/",
      "organisation": "El Boomeran(g)",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "El Boomeran(g)",
      "status": "organisation_country"
    }
  },
  "il-libraio": {
    "sourceFamilyId": "il-libraio",
    "countryCodes": [
      "IT"
    ],
    "coverageCountryCodes": [
      "IT"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.illibraio.it/",
      "organisation": "Il Libraio",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Il Libraio",
      "status": "organisation_country"
    }
  },
  "premio-strega": {
    "sourceFamilyId": "premio-strega",
    "countryCodes": [
      "IT"
    ],
    "coverageCountryCodes": [
      "IT"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://premiostrega.it/",
      "organisation": "Premio Strega",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Premio Strega",
      "status": "organisation_country"
    }
  },
  "salone-libro-torino": {
    "sourceFamilyId": "salone-libro-torino",
    "countryCodes": [
      "IT"
    ],
    "coverageCountryCodes": [
      "IT"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.salonelibro.it/",
      "organisation": "Salone Internazionale del Libro di Torino",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Salone Internazionale del Libro di Torino",
      "status": "organisation_country"
    }
  },
  "leya": {
    "sourceFamilyId": "leya",
    "countryCodes": [
      "PT"
    ],
    "coverageCountryCodes": [
      "PT"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.leya.com/",
      "organisation": "LeYa",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "LeYa",
      "status": "organisation_country"
    }
  },
  "companhia-das-letras": {
    "sourceFamilyId": "companhia-das-letras",
    "countryCodes": [
      "BR"
    ],
    "coverageCountryCodes": [
      "BR"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.companhiadasletras.com.br/",
      "organisation": "Companhia das Letras",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Companhia das Letras",
      "status": "organisation_country"
    }
  },
  "eterna-cadencia": {
    "sourceFamilyId": "eterna-cadencia",
    "countryCodes": [
      "AR"
    ],
    "coverageCountryCodes": [
      "AR"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://eternacadencia.com.ar/",
      "organisation": "Eterna Cadencia",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Eterna Cadencia",
      "status": "organisation_country"
    }
  },
  "lom": {
    "sourceFamilyId": "lom",
    "countryCodes": [
      "CL"
    ],
    "coverageCountryCodes": [
      "CL"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://lom.cl/",
      "organisation": "LOM Ediciones",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "LOM Ediciones",
      "status": "organisation_country"
    }
  },
  "fondo-cultura-economica": {
    "sourceFamilyId": "fondo-cultura-economica",
    "countryCodes": [
      "MX"
    ],
    "coverageCountryCodes": [
      "MX"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.fondodeculturaeconomica.com/",
      "organisation": "Fondo de Cultura Económica",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Fondo de Cultura Económica",
      "status": "organisation_country"
    }
  },
  "literary-hub": {
    "sourceFamilyId": "literary-hub",
    "countryCodes": [
      "US"
    ],
    "coverageCountryCodes": [
      "US"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://lithub.com/",
      "organisation": "Literary Hub",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Literary Hub",
      "status": "organisation_country"
    }
  },
  "electric-literature": {
    "sourceFamilyId": "electric-literature",
    "countryCodes": [
      "US"
    ],
    "coverageCountryCodes": [
      "US"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://electricliterature.com/",
      "organisation": "Electric Literature",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Electric Literature",
      "status": "organisation_country"
    }
  },
  "words-without-borders": {
    "sourceFamilyId": "words-without-borders",
    "countryCodes": [
      "US"
    ],
    "coverageCountryCodes": [
      "US"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://wordswithoutborders.org/",
      "organisation": "Words Without Borders",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Words Without Borders",
      "status": "organisation_country"
    }
  },
  "commonwealth-foundation": {
    "sourceFamilyId": "commonwealth-foundation",
    "countryCodes": [
      "GB"
    ],
    "coverageCountryCodes": [
      "GB"
    ],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://commonwealthfoundation.com/",
      "organisation": "Commonwealth Foundation",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Commonwealth Foundation",
      "status": "organisation_country"
    }
  },
  "reactor": {
    "sourceFamilyId": "reactor",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://reactormag.com/",
      "organisation": "Reactor",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Reactor",
      "status": "organisation_country"
    }
  },
  "book-riot": {
    "sourceFamilyId": "book-riot",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://bookriot.com/",
      "organisation": "Book Riot",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Book Riot",
      "status": "organisation_country"
    }
  },
  "the-rumpus": {
    "sourceFamilyId": "the-rumpus",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://therumpus.net/",
      "organisation": "The Rumpus",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "The Rumpus",
      "status": "organisation_country"
    }
  },
  "the-millions": {
    "sourceFamilyId": "the-millions",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://themillions.com/",
      "organisation": "The Millions",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "The Millions",
      "status": "organisation_country"
    }
  },
  "los-angeles-review-books": {
    "sourceFamilyId": "los-angeles-review-books",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://lareviewofbooks.org/",
      "organisation": "Los Angeles Review of Books",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Los Angeles Review of Books",
      "status": "organisation_country"
    }
  },
  "paris-review": {
    "sourceFamilyId": "paris-review",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.theparisreview.org/blog/",
      "organisation": "The Paris Review",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "The Paris Review",
      "status": "organisation_country"
    }
  },
  "ploughshares": {
    "sourceFamilyId": "ploughshares",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://pshares.org/blog/",
      "organisation": "Ploughshares",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Ploughshares",
      "status": "organisation_country"
    }
  },
  "kenyon-review": {
    "sourceFamilyId": "kenyon-review",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://kenyonreview.org/",
      "organisation": "The Kenyon Review",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "The Kenyon Review",
      "status": "organisation_country"
    }
  },
  "chicago-review-books": {
    "sourceFamilyId": "chicago-review-books",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://chireviewofbooks.com/",
      "organisation": "Chicago Review of Books",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Chicago Review of Books",
      "status": "organisation_country"
    }
  },
  "bookpage": {
    "sourceFamilyId": "bookpage",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.bookpage.com/",
      "organisation": "BookPage",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "BookPage",
      "status": "organisation_country"
    }
  },
  "national-book-review": {
    "sourceFamilyId": "national-book-review",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.thenationalbookreview.com/",
      "organisation": "The National Book Review",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "The National Book Review",
      "status": "organisation_country"
    }
  },
  "five-books": {
    "sourceFamilyId": "five-books",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://fivebooks.com/",
      "organisation": "Five Books",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Five Books",
      "status": "organisation_country"
    }
  },
  "granta": {
    "sourceFamilyId": "granta",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://granta.com/",
      "organisation": "Granta",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Granta",
      "status": "organisation_country"
    }
  },
  "writers-mosaic": {
    "sourceFamilyId": "writers-mosaic",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://writersmosaic.org.uk/",
      "organisation": "WritersMosaic",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "WritersMosaic",
      "status": "organisation_country"
    }
  },
  "books-ireland": {
    "sourceFamilyId": "books-ireland",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://booksirelandmagazine.com/",
      "organisation": "Books Ireland",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Books Ireland",
      "status": "organisation_country"
    }
  },
  "publishing-scotland": {
    "sourceFamilyId": "publishing-scotland",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.publishingscotland.org/",
      "organisation": "Publishing Scotland",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Publishing Scotland",
      "status": "organisation_country"
    }
  },
  "scottish-book-trust": {
    "sourceFamilyId": "scottish-book-trust",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.scottishbooktrust.com/",
      "organisation": "Scottish Book Trust",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Scottish Book Trust",
      "status": "organisation_country"
    }
  },
  "new-writing-north": {
    "sourceFamilyId": "new-writing-north",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://newwritingnorth.com/",
      "organisation": "New Writing North",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "New Writing North",
      "status": "organisation_country"
    }
  },
  "national-centre-writing": {
    "sourceFamilyId": "national-centre-writing",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://nationalcentreforwriting.org.uk/",
      "organisation": "National Centre for Writing",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "National Centre for Writing",
      "status": "organisation_country"
    }
  },
  "literature-wales": {
    "sourceFamilyId": "literature-wales",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.literaturewales.org/",
      "organisation": "Literature Wales",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Literature Wales",
      "status": "organisation_country"
    }
  },
  "books-from-scotland": {
    "sourceFamilyId": "books-from-scotland",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://booksfromscotland.com/",
      "organisation": "Books from Scotland",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Books from Scotland",
      "status": "organisation_country"
    }
  },
  "gorky-media": {
    "sourceFamilyId": "gorky-media",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://gorky.media/",
      "organisation": "Горький",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Горький",
      "status": "organisation_country"
    }
  },
  "prochtenie": {
    "sourceFamilyId": "prochtenie",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://prochtenie.org/",
      "organisation": "Прочтение",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Прочтение",
      "status": "organisation_country"
    }
  },
  "literaturnaya-gazeta": {
    "sourceFamilyId": "literaturnaya-gazeta",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://lgz.ru/",
      "organisation": "Литературная газета",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Литературная газета",
      "status": "organisation_country"
    }
  },
  "literaturnaya-rossiya": {
    "sourceFamilyId": "literaturnaya-rossiya",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://litrossia.ru/",
      "organisation": "Литературная Россия",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Литературная Россия",
      "status": "organisation_country"
    }
  },
  "polka-academy": {
    "sourceFamilyId": "polka-academy",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://polka.academy/",
      "organisation": "Полка",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Полка",
      "status": "organisation_country"
    }
  },
  "sydney-review-books": {
    "sourceFamilyId": "sydney-review-books",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://sydneyreviewofbooks.com/",
      "organisation": "Sydney Review of Books",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Sydney Review of Books",
      "status": "organisation_country"
    }
  },
  "australian-book-review": {
    "sourceFamilyId": "australian-book-review",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.australianbookreview.com.au/",
      "organisation": "Australian Book Review",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Australian Book Review",
      "status": "organisation_country"
    }
  },
  "books-publishing-au": {
    "sourceFamilyId": "books-publishing-au",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.booksandpublishing.com.au/",
      "organisation": "Books+Publishing",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Books+Publishing",
      "status": "organisation_country"
    }
  },
  "literaturkritik": {
    "sourceFamilyId": "literaturkritik",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://literaturkritik.de/",
      "organisation": "literaturkritik.de",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "literaturkritik.de",
      "status": "organisation_country"
    }
  },
  "buchmarkt": {
    "sourceFamilyId": "buchmarkt",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://buchmarkt.de/",
      "organisation": "BuchMarkt",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "BuchMarkt",
      "status": "organisation_country"
    }
  },
  "literaturcafe": {
    "sourceFamilyId": "literaturcafe",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.literaturcafe.de/",
      "organisation": "literaturcafe.de",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "literaturcafe.de",
      "status": "organisation_country"
    }
  },
  "boersenblatt": {
    "sourceFamilyId": "boersenblatt",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.boersenblatt.net/",
      "organisation": "Börsenblatt",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Börsenblatt",
      "status": "organisation_country"
    }
  },
  "buchkultur": {
    "sourceFamilyId": "buchkultur",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.buchkultur.net/",
      "organisation": "Buchkultur",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Buchkultur",
      "status": "organisation_country"
    }
  },
  "litprom": {
    "sourceFamilyId": "litprom",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.litprom.de/",
      "organisation": "Litprom",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Litprom",
      "status": "organisation_country"
    }
  },
  "literaturhaus-at": {
    "sourceFamilyId": "literaturhaus-at",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.literaturhaus.at/",
      "organisation": "Literaturhaus Wien",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Literaturhaus Wien",
      "status": "organisation_country"
    }
  },
  "minima-moralia": {
    "sourceFamilyId": "minima-moralia",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.minimaetmoralia.it/",
      "organisation": "minima&moralia",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "minima&moralia",
      "status": "organisation_country"
    }
  },
  "doppiozero": {
    "sourceFamilyId": "doppiozero",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.doppiozero.com/",
      "organisation": "Doppiozero",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Doppiozero",
      "status": "organisation_country"
    }
  },
  "sololibri": {
    "sourceFamilyId": "sololibri",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.sololibri.net/",
      "organisation": "SoloLibri",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "SoloLibri",
      "status": "organisation_country"
    }
  },
  "letture-org": {
    "sourceFamilyId": "letture-org",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.letture.org/",
      "organisation": "Letture.org",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Letture.org",
      "status": "organisation_country"
    }
  },
  "zenda-libros": {
    "sourceFamilyId": "zenda-libros",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.zendalibros.com/",
      "organisation": "Zenda",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Zenda",
      "status": "organisation_country"
    }
  },
  "librerantes": {
    "sourceFamilyId": "librerantes",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.librerantes.com/",
      "organisation": "Librerantes",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Librerantes",
      "status": "organisation_country"
    }
  },
  "estandarte": {
    "sourceFamilyId": "estandarte",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.estandarte.com/",
      "organisation": "Estandarte",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Estandarte",
      "status": "organisation_country"
    }
  },
  "placer-lectura": {
    "sourceFamilyId": "placer-lectura",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://elplacerdelalectura.com/",
      "organisation": "El Placer de la Lectura",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "El Placer de la Lectura",
      "status": "organisation_country"
    }
  },
  "en-attendant-nadeau": {
    "sourceFamilyId": "en-attendant-nadeau",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.en-attendant-nadeau.fr/",
      "organisation": "En attendant Nadeau",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "En attendant Nadeau",
      "status": "organisation_country"
    }
  },
  "diacritik": {
    "sourceFamilyId": "diacritik",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://diacritik.com/",
      "organisation": "Diacritik",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Diacritik",
      "status": "organisation_country"
    }
  },
  "le-litteraire": {
    "sourceFamilyId": "le-litteraire",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.lelitteraire.com/",
      "organisation": "Le Litteraire",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Le Litteraire",
      "status": "organisation_country"
    }
  },
  "recours-poeme": {
    "sourceFamilyId": "recours-poeme",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.recoursaupoeme.fr/",
      "organisation": "Recours au Poème",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Recours au Poème",
      "status": "organisation_country"
    }
  },
  "literandra": {
    "sourceFamilyId": "literandra",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://literandra.com/",
      "organisation": "Literandra",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Literandra",
      "status": "organisation_country"
    }
  },
  "afrocritik": {
    "sourceFamilyId": "afrocritik",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.afrocritik.com/",
      "organisation": "Afrocritik",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Afrocritik",
      "status": "organisation_country"
    }
  },
  "open-book-festival": {
    "sourceFamilyId": "open-book-festival",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://openbookfestival.co.za/",
      "organisation": "Open Book Festival",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Open Book Festival",
      "status": "organisation_country"
    }
  },
  "short-story-day-africa": {
    "sourceFamilyId": "short-story-day-africa",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://shortstorydayafrica.org/",
      "organisation": "Short Story Day Africa",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Short Story Day Africa",
      "status": "organisation_country"
    }
  },
  "poets-writers": {
    "sourceFamilyId": "poets-writers",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.pw.org/",
      "organisation": "Poets & Writers",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Poets & Writers",
      "status": "organisation_country"
    }
  },
  "poetry-society-uk": {
    "sourceFamilyId": "poetry-society-uk",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://poetrysociety.org.uk/",
      "organisation": "The Poetry Society",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "The Poetry Society",
      "status": "organisation_country"
    }
  },
  "poetry-ireland": {
    "sourceFamilyId": "poetry-ireland",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.poetryireland.ie/",
      "organisation": "Poetry Ireland",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Poetry Ireland",
      "status": "organisation_country"
    }
  },
  "poets-org": {
    "sourceFamilyId": "poets-org",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://poets.org/",
      "organisation": "Academy of American Poets",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Academy of American Poets",
      "status": "organisation_country"
    }
  },
  "and-other-stories": {
    "sourceFamilyId": "and-other-stories",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.andotherstories.org/",
      "organisation": "And Other Stories",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "And Other Stories",
      "status": "office_country_unconfirmed"
    }
  },
  "archipelago-books": {
    "sourceFamilyId": "archipelago-books",
    "countryCodes": [
      "US"
    ],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_contact_address",
      "url": "https://archipelagobooks.org/",
      "organisation": "Archipelago Books",
      "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
      "excerpt": "Archipelago Books & Elsewhere Editions The Old American Can Factory 232 Third Street #A111 Brooklyn, NY 11215 [email protected] Illustrations created by artist Gracey Zhang ExploreAbout News Books Events Support My Account Latest Catalog ConnectSign",
      "status": "organisation_country",
      "scope": "footer",
      "responseSha256": "f087a1a4b3941314bd9a57ef284b06c57652fcdbe8047dabd8e0fe8ad57f66f0",
      "accessedAt": "2026-10-01T21:03:58.984Z"
    }
  },
  "acantilado": {
    "sourceFamilyId": "acantilado",
    "countryCodes": [
      "ES"
    ],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_contact_address",
      "url": "https://www.acantilado.es/contacto/",
      "organisation": "Acantilado",
      "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
      "excerpt": "Contacto Muntaner, 462 E-08006 Barcelona Tel.: (+34) 934 144 906 correo@acantilado.es En Acantilado no se aceptan ni valoran manuscritos no solicitados. Distribución Distribución Si lo desea",
      "status": "organisation_country",
      "scope": "official_contact_page",
      "responseSha256": "59bf8ff79cf3175fa4fc8d4e414ffacab4ccd18879b429251a967a999e0d41e0",
      "accessedAt": "2026-10-01T21:03:59.184Z"
    }
  },
  "biblioasis": {
    "sourceFamilyId": "biblioasis",
    "countryCodes": [
      "CA"
    ],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_contact_address",
      "url": "https://www.biblioasis.com/contact/",
      "organisation": "Biblioasis",
      "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
      "excerpt": "ContactYou are here: Home1 / Contact Biblioasis Bookstore is located at: 1520 Wyandotte Street East Windsor, ON N9A 3L2 Tel: 519-968-2206 Email: bookstore@biblioasis.com biblioasisbookshop.com Biblioasis Publishing (Office Only) is located at: 1686 Ottawa S",
      "status": "organisation_country",
      "scope": "official_contact_page",
      "responseSha256": "2e9126b980c2753cdeef2ef11e1a20ef85883244a9c6fe25099f4bdfd3f33756",
      "accessedAt": "2026-10-01T21:04:02.681Z"
    }
  },
  "faber": {
    "sourceFamilyId": "faber",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.faber.co.uk/",
      "organisation": "Faber & Faber",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Faber & Faber",
      "status": "office_country_unconfirmed"
    }
  },
  "canongate": {
    "sourceFamilyId": "canongate",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://canongate.co.uk/",
      "organisation": "Canongate",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Canongate",
      "status": "office_country_unconfirmed"
    }
  },
  "serpents-tail": {
    "sourceFamilyId": "serpents-tail",
    "countryCodes": [
      "GB"
    ],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_contact_address",
      "url": "https://serpentstail.com/",
      "organisation": "Serpent’s Tail",
      "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
      "excerpt": "h x Basket 0 © 2026 Profile Books Limited Serpent's Tail, an imprint of Profile Books 29 Cloth Fair London EC1A 7JQ Email: [email protected] Phone: + 44 20 7841 6300 Registered in England & Wales under No. 3120147 VAT Number 674 9638 76 About Serpent’s Tai",
      "status": "organisation_country",
      "scope": "footer",
      "responseSha256": "0b49c55d8779957266ed9299b8f8076d32548d37d90f11eb06fdeeb9e8d7d683",
      "accessedAt": "2026-10-01T21:03:59.348Z"
    }
  },
  "fitzcarraldo": {
    "sourceFamilyId": "fitzcarraldo",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://fitzcarraldoeditions.com/",
      "organisation": "Fitzcarraldo Editions",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Fitzcarraldo Editions",
      "status": "office_country_unconfirmed"
    }
  },
  "virago": {
    "sourceFamilyId": "hachette-livre",
    "countryCodes": [
      "GB"
    ],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_contact_address",
      "url": "https://www.virago.co.uk/imprint/lbbg/virago/page/about-virago/virago-company-information/",
      "organisation": "Virago",
      "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
      "excerpt": "ollows: Little, Brown Book Group Limited Registered address: Carmelite House 50 Victoria Embankment LONDON EC4Y 0DZ United Kingdom Registration number: 2304585 VAT number: 205505305 Telephone Number: +44 (0)20 3122 7000 Email: info@littlebrown.co.uk Hachet",
      "status": "organisation_country",
      "scope": "official_contact_page",
      "responseSha256": "0bfa8e8216a60b5e3ae6d13fe843702ba8522a822c0ff35ad035e9c2bc0437b4",
      "accessedAt": "2026-10-01T21:04:00.074Z"
    }
  },
  "john-murray": {
    "sourceFamilyId": "john-murray",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.johnmurraypress.co.uk/",
      "organisation": "John Murray",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "John Murray",
      "status": "office_country_unconfirmed"
    }
  },
  "hachette-book-group": {
    "sourceFamilyId": "hachette-livre",
    "countryCodes": [
      "US"
    ],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_contact_address",
      "url": "https://www.hachettebookgroup.com/",
      "organisation": "Hachette Book Group",
      "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
      "excerpt": "Footer Hachette Book Group is a leading book publisher based in New York and a division of Hachette Livre, the third-largest publisher in the world. Social Media Facebook Twitter Instagram YouTube Tiktok Linkedin Pinterest",
      "status": "organisation_country",
      "scope": "footer",
      "responseSha256": "1b9606682370a30dc179b18610ff1163710171c07284dbf80d7a40b5931c031d",
      "accessedAt": "2026-10-01T21:04:00.939Z"
    }
  },
  "tor-publishing": {
    "sourceFamilyId": "tor-publishing",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://torpublishinggroup.com/",
      "organisation": "Tor Publishing Group",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Tor Publishing Group",
      "status": "office_country_unconfirmed"
    }
  },
  "harpercollins-india": {
    "sourceFamilyId": "harpercollins-india",
    "countryCodes": [
      "IN"
    ],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_contact_address",
      "url": "https://harpercollins.co.in/contact-us/",
      "organisation": "HarperCollins India",
      "statement": "Organisation office country confirmed from its own contact address, independently of article or event geography.",
      "excerpt": "Address4th Floor, Cyber City, Building No 10,Tower A, Gurugram, Haryana 122002, IndiaPhone+91 12448-94800 Download QR ExploreBooksFirst chapterAuthorsaudiobooksblogsVideosAbout usAbout usteamimprintscataloguescontact usOur ContributorsHarper broadcastblogpress",
      "status": "organisation_country",
      "scope": "official_contact_page",
      "responseSha256": "b8243a56b67aac05b11754eb829fe9fd16c1adc078a22d9d9475817534381d90",
      "accessedAt": "2026-10-01T21:16:16.930Z"
    }
  },
  "penguin-india": {
    "sourceFamilyId": "penguin-india",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.penguin.co.in/",
      "organisation": "Penguin India",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Penguin India",
      "status": "office_country_unconfirmed"
    }
  },
  "juggernaut-books": {
    "sourceFamilyId": "juggernaut-books",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.juggernaut.in/",
      "organisation": "Juggernaut Books",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Juggernaut Books",
      "status": "office_country_unconfirmed"
    }
  },
  "knopf-doubleday": {
    "sourceFamilyId": "knopf-doubleday",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://knopfdoubleday.com/",
      "organisation": "Knopf Doubleday",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Knopf Doubleday",
      "status": "office_country_unconfirmed"
    }
  },
  "nyrb": {
    "sourceFamilyId": "nyrb",
    "countryCodes": [
      "US"
    ],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_contact_address",
      "url": "https://www.nyrb.com/pages/contact-us",
      "organisation": "New York Review Books",
      "statement": "Organisation office country confirmed from its own contact address, independently of article or event geography.",
      "excerpt": "New York Review Books207 East 32nd StNew York, NY 10016-6305Tel 212 757-8070Fax 212 333-5374 Book OrdersTel 646 215-2500Fax 212 333-5374 Please visit our Frequently Asked Questions page for answers to common queries. Examination and Desk Copy Requests: Our boo",
      "status": "organisation_country",
      "scope": "official_contact_page",
      "responseSha256": "2292a97a4240a32d788c67ca2b6ae21017d349e26a810412fb45029e16302b02",
      "accessedAt": "2026-10-01T21:16:11.489Z"
    }
  },
  "new-directions": {
    "sourceFamilyId": "new-directions",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.ndbooks.com/",
      "organisation": "New Directions",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "New Directions",
      "status": "office_country_unconfirmed"
    }
  },
  "graywolf-press": {
    "sourceFamilyId": "graywolf-press",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.graywolfpress.org/",
      "organisation": "Graywolf Press",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Graywolf Press",
      "status": "office_country_unconfirmed"
    }
  },
  "coffee-house-press": {
    "sourceFamilyId": "coffee-house-press",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://coffeehousepress.org/",
      "organisation": "Coffee House Press",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Coffee House Press",
      "status": "office_country_unconfirmed"
    }
  },
  "milkweed-editions": {
    "sourceFamilyId": "milkweed-editions",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://milkweed.org/",
      "organisation": "Milkweed Editions",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Milkweed Editions",
      "status": "office_country_unconfirmed"
    }
  },
  "tin-house": {
    "sourceFamilyId": "tin-house",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://tinhouse.com/",
      "organisation": "Tin House",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Tin House",
      "status": "office_country_unconfirmed"
    }
  },
  "melville-house": {
    "sourceFamilyId": "melville-house",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.mhpbooks.com/",
      "organisation": "Melville House",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Melville House",
      "status": "office_country_unconfirmed"
    }
  },
  "europa-editions": {
    "sourceFamilyId": "europa-editions",
    "countryCodes": [
      "US"
    ],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_contact_address",
      "url": "https://www.europaeditions.com/",
      "organisation": "Europa Editions",
      "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
      "excerpt": "us Contact us Our authors Latest titles Follow us © Europa Editions 27 Union Square West, Suite 302 New York, N.Y. 10003 | info@europaeditions.com | privacy | cookie | credits",
      "status": "organisation_country",
      "scope": "footer",
      "responseSha256": "1e2c75d718c4e94a02794a3140eed8d7e30675dde2137e6e109207e1902ee364",
      "accessedAt": "2026-10-01T21:04:02.298Z"
    }
  },
  "restless-books": {
    "sourceFamilyId": "restless-books",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://restlessbooks.org/",
      "organisation": "Restless Books",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Restless Books",
      "status": "office_country_unconfirmed"
    }
  },
  "pushkin-press": {
    "sourceFamilyId": "pushkin-press",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://pushkinpress.com/",
      "organisation": "Pushkin Press",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Pushkin Press",
      "status": "office_country_unconfirmed"
    }
  },
  "peirene-press": {
    "sourceFamilyId": "peirene-press",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.peirenepress.com/",
      "organisation": "Peirene Press",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Peirene Press",
      "status": "office_country_unconfirmed"
    }
  },
  "galley-beggar": {
    "sourceFamilyId": "galley-beggar",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.galleybeggar.co.uk/",
      "organisation": "Galley Beggar Press",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Galley Beggar Press",
      "status": "office_country_unconfirmed"
    }
  },
  "saraband": {
    "sourceFamilyId": "saraband",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://saraband.net/",
      "organisation": "Saraband",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Saraband",
      "status": "office_country_unconfirmed"
    }
  },
  "salt-publishing": {
    "sourceFamilyId": "salt-publishing",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.saltpublishing.com/",
      "organisation": "Salt Publishing",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Salt Publishing",
      "status": "office_country_unconfirmed"
    }
  },
  "comma-press": {
    "sourceFamilyId": "comma-press",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://commapress.co.uk/",
      "organisation": "Comma Press",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Comma Press",
      "status": "office_country_unconfirmed"
    }
  },
  "editions-verdier": {
    "sourceFamilyId": "editions-verdier",
    "countryCodes": [
      "FR"
    ],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_contact_address",
      "url": "https://editions-verdier.fr/informations-generales/",
      "organisation": "Editions Verdier",
      "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
      "excerpt": "er (1945-2009), Colette Olive et Michèle Planel. Contacts Siège social : 11220 LagrassePermanence à Paris : 82, boulevard de Ménilmontant - 75020 Paris(33) 01 43 79 20 45contact[at]editions-verdier.fr GérancePierre Audoux, Mathilde Azzopardi, Émilie Thoma",
      "status": "organisation_country",
      "scope": "official_contact_page",
      "responseSha256": "3d64b08f564f25678b3d1abe44365b13fd94093c6998da8f3e0e08a1a1189620",
      "accessedAt": "2026-10-01T21:04:03.411Z"
    }
  },
  "editions-metailie": {
    "sourceFamilyId": "editions-metailie",
    "countryCodes": [
      "FR"
    ],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_contact_address",
      "url": "https://editions-metailie.com/",
      "organisation": "Editions Métailié",
      "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
      "excerpt": "ombie Ecosse Pologne Mozambique Amérique Latine Allemagne Belgique Brésil Nicaragua Angleterre Cuba France Espagne Italie Chili Irlande Portugal Pérou Angola Uruguay Éditions Métailié 20 rue des Grands Augustins 75006 PARIS 01 56 81 02 45 Suivez-nous sur ©",
      "status": "organisation_country",
      "scope": "footer",
      "responseSha256": "aa262648ccde352befafa52b3ce992df1e1e4e7505274e8d1229966fea1b61eb",
      "accessedAt": "2026-10-01T21:04:03.156Z"
    }
  },
  "zulma": {
    "sourceFamilyId": "zulma",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.zulma.fr/",
      "organisation": "Zulma",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Zulma",
      "status": "office_country_unconfirmed"
    }
  },
  "le-tripode": {
    "sourceFamilyId": "le-tripode",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://le-tripode.net/",
      "organisation": "Le Tripode",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Le Tripode",
      "status": "office_country_unconfirmed"
    }
  },
  "quidam-editeur": {
    "sourceFamilyId": "quidam-editeur",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.quidamediteur.com/contact",
      "organisation": "Quidam Editeur",
      "status": "office_country_unconfirmed",
      "statement": "Observed country names describe distribution, publishing coverage or a brand rather than an independently confirmed organisation office address."
    }
  },
  "finitude": {
    "sourceFamilyId": "finitude",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.finitude.fr/",
      "organisation": "Finitude",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Finitude",
      "status": "office_country_unconfirmed"
    }
  },
  "anagrama": {
    "sourceFamilyId": "anagrama",
    "countryCodes": [
      "ES"
    ],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_contact_address",
      "url": "https://www.anagrama-ed.es/",
      "organisation": "Anagrama",
      "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
      "excerpt": "Pau Claris, 172. 08037 Barcelona. Editorial fundada por Jorge Herralde Grau en 1969. En nuestro catálogo figuran más de 4.500 títulos, donde se pueden encontrar muchos de los autores",
      "status": "organisation_country",
      "scope": "footer",
      "responseSha256": "d91a3c880422ed2bad5d025532db6e2b9ec1c28abbde947e47372e0d93496c8e",
      "accessedAt": "2026-10-01T21:04:03.677Z"
    }
  },
  "libros-asteroide": {
    "sourceFamilyId": "libros-asteroide",
    "countryCodes": [
      "ES"
    ],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_contact_address",
      "url": "https://librosdelasteroide.com/",
      "organisation": "Libros del Asteroide",
      "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
      "excerpt": "Contacto C/ Santaló 11, 3º 1ª 08021 Barcelona, España +34 93 280 25 24 Contexto de editores Libros del Asteroide es miembro de Contexto de Editores Más información Distribución Consulta aquí nues",
      "status": "organisation_country",
      "scope": "footer",
      "responseSha256": "4c6532058d9d9ff78bbde2f7507e796b6efb875c9a5b759e8e252ac7be0a4e80",
      "accessedAt": "2026-10-01T21:04:04.178Z"
    }
  },
  "impedimenta": {
    "sourceFamilyId": "impedimenta",
    "countryCodes": [
      "ES"
    ],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_contact_address",
      "url": "https://impedimenta.es/",
      "organisation": "Impedimenta",
      "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
      "excerpt": " electrónico He leído y acepto la Política de privacidad REGISTRO Juan Álvarez Mendizábal, 27 28008 Madrid, España +34 915 401 988edicion@impedimenta.es Nosotros Aviso legal y Privacidad Política de Cookies Catálogo Distribuidores Foreign rights SeguirSegu",
      "status": "organisation_country",
      "scope": "footer",
      "responseSha256": "46481ba3e4aabefe3504e413444184d04478bc63b83b638f51da31332d5e0cda",
      "accessedAt": "2026-10-01T21:04:04.855Z"
    }
  },
  "paginas-espuma": {
    "sourceFamilyId": "paginas-espuma",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://paginasdeespuma.com/",
      "organisation": "Páginas de Espuma",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Páginas de Espuma",
      "status": "office_country_unconfirmed"
    }
  },
  "nordica-libros": {
    "sourceFamilyId": "nordica-libros",
    "countryCodes": [
      "ES"
    ],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_contact_address",
      "url": "https://nordicalibros.com/contacto/",
      "organisation": "Nórdica Libros",
      "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
      "excerpt": "ares a los anteriormente contratados por el destinatario. Dirección Doctor Blanco Soler, 26. 28054. Madrid Teléfono +34 917 055 057 Email info@nordicalibros.com",
      "status": "organisation_country",
      "scope": "official_contact_page",
      "responseSha256": "6b805be86d2efda94999cfacf2b7f8e6b960455d5ee94a87422ada5298f4932d",
      "accessedAt": "2026-10-01T21:04:06.623Z"
    }
  },
  "sexto-piso": {
    "sourceFamilyId": "sexto-piso",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://sextopiso.es/",
      "organisation": "Sexto Piso",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Sexto Piso",
      "status": "office_country_unconfirmed"
    }
  },
  "suhrkamp": {
    "sourceFamilyId": "suhrkamp",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.suhrkamp.de/",
      "organisation": "Suhrkamp",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Suhrkamp",
      "status": "office_country_unconfirmed"
    }
  },
  "hanser": {
    "sourceFamilyId": "hanser",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.hanser-literaturverlage.de/",
      "organisation": "Hanser",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Hanser",
      "status": "office_country_unconfirmed"
    }
  },
  "aufbau": {
    "sourceFamilyId": "aufbau",
    "countryCodes": [
      "DE"
    ],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_contact_address",
      "url": "https://www.aufbau-verlage.de/impressum",
      "organisation": "Aufbau",
      "statement": "Organisation office country confirmed from its own contact address, independently of article or event geography.",
      "excerpt": "Aufbau Verlage GmbH & Co. KG Prinzenstraße 85 10969 Berlin Telefon +49(0) 30 28394 -0 Fax +49(0) 30 28394 -100 E-Mail: info[at]aufbau-verlage.de Registergericht: Amtsgericht Charlottenburg Registernummer: HRA 40423 B USt.Ident.Nr: DE 261725915 Persönlich hafte",
      "status": "organisation_country",
      "scope": "official_contact_page",
      "responseSha256": "f3eef1dfbaf333d2c160ff17e7b4c01503773c97c44bfbb9256535e5786fbe0b",
      "accessedAt": "2026-10-01T21:16:10.388Z"
    }
  },
  "wagenbach": {
    "sourceFamilyId": "wagenbach",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.wagenbach.de/",
      "organisation": "Wagenbach",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Wagenbach",
      "status": "office_country_unconfirmed"
    }
  },
  "wallstein": {
    "sourceFamilyId": "wallstein",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.wallstein-verlag.de/",
      "organisation": "Wallstein",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Wallstein",
      "status": "office_country_unconfirmed"
    }
  },
  "klett-cotta": {
    "sourceFamilyId": "klett-cotta",
    "countryCodes": [
      "DE"
    ],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_contact_address",
      "url": "https://www.klett-cotta.de/service/kontakt-c-105",
      "organisation": "Klett-Cotta",
      "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
      "excerpt": "Kontakt - Klett-Cotta-Verlag (J. G. Cotta’sche Buchhandlung Nachfolger GmbH)Rotebühlstraße 77 70178 Stuttgart Telefon 0711/6672-0 Fax: 0711/6672-2030 info@klett-cotta.de Abteilungen, Informationen und Ansprechpartner Für Leser:innen E-Mail: info@klett-cotta.d",
      "status": "organisation_country",
      "scope": "official_contact_page",
      "responseSha256": "9b2d856fc164cee94f4dcc1b6e15f0e70d4386617bdbe908e7bdd64092f19996",
      "accessedAt": "2026-10-01T21:04:04.814Z"
    }
  },
  "edizioni-sur": {
    "sourceFamilyId": "edizioni-sur",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.edizionisur.it/",
      "organisation": "Edizioni Sur",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Edizioni Sur",
      "status": "office_country_unconfirmed"
    }
  },
  "minimum-fax": {
    "sourceFamilyId": "minimum-fax",
    "countryCodes": [
      "IT"
    ],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_contact_address",
      "url": "https://www.minimumfax.com/",
      "organisation": "Minimum Fax",
      "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
      "excerpt": "Denominazione sociale: MINIMUM FAX S.R.L. Sede legale: ROMA (RM) VIALE DELLA BELLA VILLA, 1 (ALTEZZA VIA CASILINA 939) - CAP 00172 Numero e sede di iscrizione al registro imprese: RM-1997-155274 DEL 25/02/1997",
      "status": "organisation_country",
      "scope": "footer",
      "responseSha256": "8f3cb102688b53a8f40adcc565773dd3d32f2e7eb6fab7e1ad426a1bad45854e",
      "accessedAt": "2026-10-01T21:04:05.185Z"
    }
  },
  "iperborea": {
    "sourceFamilyId": "iperborea",
    "countryCodes": [
      "IT"
    ],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_contact_address",
      "url": "https://iperborea.com/",
      "organisation": "Iperborea",
      "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
      "excerpt": "IPERBOREA SRL Via Gian Battista Vico, 16/A 20123 Milano - P.IVA IT08968860158 Cap. Soc. € 46.000,00 iperborea@pec.it Privacy Policy Cookie Policy Sitemap Chi siamo Paesi Titoli Autori News Eventi Contatti ",
      "status": "organisation_country",
      "scope": "footer",
      "responseSha256": "51beab132d83eaeb79f6fd4c0f079a3c724b83479caed301049bf951513ab159",
      "accessedAt": "2026-10-01T21:04:06.240Z"
    }
  },
  "nottetempo": {
    "sourceFamilyId": "nottetempo",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.edizioninottetempo.it/",
      "organisation": "Nottetempo",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Nottetempo",
      "status": "office_country_unconfirmed"
    }
  },
  "cossee": {
    "sourceFamilyId": "cossee",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.cossee.com/",
      "organisation": "Cossee",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Cossee",
      "status": "office_country_unconfirmed"
    }
  },
  "van-oorschot": {
    "sourceFamilyId": "van-oorschot",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.vanoorschot.nl/",
      "organisation": "Van Oorschot",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Van Oorschot",
      "status": "office_country_unconfirmed"
    }
  },
  "atlas-contact": {
    "sourceFamilyId": "atlas-contact",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.atlascontact.nl/",
      "organisation": "Atlas Contact",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Atlas Contact",
      "status": "office_country_unconfirmed"
    }
  },
  "querido": {
    "sourceFamilyId": "querido",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.querido.nl/",
      "organisation": "Querido",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Querido",
      "status": "office_country_unconfirmed"
    }
  },
  "uitgeverij-vrijdag": {
    "sourceFamilyId": "uitgeverij-vrijdag",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.uitgeverijvrijdag.be/",
      "organisation": "Uitgeverij Vrijdag",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Uitgeverij Vrijdag",
      "status": "office_country_unconfirmed"
    }
  },
  "relogio-dagua": {
    "sourceFamilyId": "relogio-dagua",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://relogiodagua.pt/",
      "organisation": "Relógio d’Água",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Relógio d’Água",
      "status": "office_country_unconfirmed"
    }
  },
  "bookhug": {
    "sourceFamilyId": "bookhug",
    "countryCodes": [
      "CA"
    ],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_contact_address",
      "url": "https://bookhugpress.ca/contact-bookhugpress/",
      "organisation": "Book*hug Press",
      "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
      "excerpt": "Contact Us and Masthead Contact Information Address Book*hug Press 401 Richmond St. West Suite 251 Toronto, ON M5V 3A8, Canada Masthead Jay Millar, Co-publisher Hazel Millar, Co-publisher Reid Millar, Sales and Marketing Manager Britt Landry, Managing Edit",
      "status": "organisation_country",
      "scope": "official_contact_page",
      "responseSha256": "31845775946e6ad65ea25b934302507e817b36fd494338b6830f9f5907fe2fa0",
      "accessedAt": "2026-10-01T21:04:14.059Z"
    }
  },
  "arsenal-pulp": {
    "sourceFamilyId": "arsenal-pulp",
    "countryCodes": [
      "CA"
    ],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_contact_address",
      "url": "https://arsenalpulp.com/About-Arsenal-Pulp-Press/Contact",
      "organisation": "Arsenal Pulp Press",
      "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
      "excerpt": "Arsenal Pulp Press #202 - 211 East Georgia Street Vancouver, BC, V6A 1Z6Canada phone 604.687.4233fax 604.687.4283Follow us on FacebookFollow us on Twitter: @ArsenalpulpFollow us on Instagram: @arsenalpulp Gene",
      "status": "organisation_country",
      "scope": "official_contact_page",
      "responseSha256": "2cb9f01ce6dcd18e04b6ded0c9e5e295e6436904f57fcb7f35896070490c7c97",
      "accessedAt": "2026-10-01T21:04:07.347Z"
    }
  },
  "text-publishing": {
    "sourceFamilyId": "text-publishing",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.textpublishing.com.au/",
      "organisation": "Text Publishing",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Text Publishing",
      "status": "office_country_unconfirmed"
    }
  },
  "scribe-publications": {
    "sourceFamilyId": "scribe-publications",
    "countryCodes": [
      "AU"
    ],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_contact_address",
      "url": "https://scribepublications.com.au/contact",
      "organisation": "Scribe Publications",
      "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
      "excerpt": "ContactScribe Publications18-20 Edward Street Brunswick 3056 Victoria, Australia Tel: ‭+61 3 9388 8780‬info@scribepub.com.auVisit Scribe UK or USScribe UKScribe USScribe PublicationsIf you’re looking for information on how to get ",
      "status": "organisation_country",
      "scope": "official_contact_page",
      "responseSha256": "06a6dfcea41fa5ad5d064b09496ef3a8dbe8691dfe868a64399cd828e8bced7d",
      "accessedAt": "2026-10-01T21:04:07.656Z"
    }
  },
  "uqp": {
    "sourceFamilyId": "uqp",
    "countryCodes": [
      "AU"
    ],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_contact_address",
      "url": "https://www.uqp.com.au/",
      "organisation": "University of Queensland Press",
      "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
      "excerpt": "n back to top Phone: +61 7 3365 7244 Fax: +61 7 3365 7579 Email: reception@uqp.com.au University of Queensland Press PO Box 6042 St Lucia, QLD 4067 Australia © The University of Queensland 2026 Privacy & Terms of use website by Inkahoots Acknowledgement of Tra",
      "status": "organisation_country",
      "scope": "footer",
      "responseSha256": "7dbc40ee7fbf001db01b40fdde25d8eeb66a5e3c4871eeb8b186ec848dcb2e50",
      "accessedAt": "2026-10-01T21:04:11.558Z"
    }
  },
  "fremantle-press": {
    "sourceFamilyId": "fremantle-press",
    "countryCodes": [
      "AU"
    ],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_contact_address",
      "url": "https://fremantlepress.com.au/contact-us/",
      "organisation": "Fremantle Press",
      "statement": "Organisation office country confirmed from its own contact address, independently of article or event geography.",
      "excerpt": "Postal address:Fremantle Press1/10 Parry StreetFremantle WA 6160 Street address:1/10 Parry StreetFremantle WA 6160 T+61 (0)8 9430 6331E admin@fremantlepress.com.auABN 78 910 098 021 Custom publishingVisit our custom publishing page Foreign rights, sales and di",
      "status": "organisation_country",
      "scope": "official_contact_page",
      "responseSha256": "9577a142ef26e5773bc985fedd85085a763aaad1666c19da6f84b67b545b925f",
      "accessedAt": "2026-10-01T21:16:22.236Z"
    }
  },
  "spinifex-press": {
    "sourceFamilyId": "spinifex-press",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.spinifexpress.com.au/",
      "organisation": "Spinifex Press",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Spinifex Press",
      "status": "office_country_unconfirmed"
    }
  },
  "czechlit": {
    "sourceFamilyId": "czechlit",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.czechlit.cz/en/",
      "organisation": "Czech Literary Centre",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Czech Literary Centre",
      "status": "office_country_unconfirmed"
    }
  },
  "litcentrum": {
    "sourceFamilyId": "litcentrum",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.litcentrum.sk/",
      "organisation": "Slovak Literary Centre",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Slovak Literary Centre",
      "status": "office_country_unconfirmed"
    }
  },
  "vbz": {
    "sourceFamilyId": "vbz",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.vbz.hr/",
      "organisation": "V.B.Z.",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "V.B.Z.",
      "status": "office_country_unconfirmed"
    }
  },
  "laguna": {
    "sourceFamilyId": "laguna",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.laguna.rs/",
      "organisation": "Laguna",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Laguna",
      "status": "office_country_unconfirmed"
    }
  },
  "polirom-blog": {
    "sourceFamilyId": "polirom-blog",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://blog.polirom.ro/",
      "organisation": "Polirom",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Polirom",
      "status": "office_country_unconfirmed"
    }
  },
  "colibri": {
    "sourceFamilyId": "colibri",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.colibri.bg/",
      "organisation": "Colibri",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Colibri",
      "status": "office_country_unconfirmed"
    }
  },
  "otava": {
    "sourceFamilyId": "otava",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://otava.fi/",
      "organisation": "Otava",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Otava",
      "status": "office_country_unconfirmed"
    }
  },
  "wsoy": {
    "sourceFamilyId": "wsoy",
    "countryCodes": [
      "FI"
    ],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_contact_address",
      "url": "https://www.wsoy.fi/",
      "organisation": "WSOY",
      "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
      "excerpt": "Käyntiosoite Lönnrotinkatu 18 A00120 Helsinki Postiosoite PL 125900101 Helsinki Puhelinvaihde 010 5060 200 Tietosuoja ja rekisteriselosteEvästeetBriefly in English Lönnrotinkatu 18 A00120 Helsink",
      "status": "organisation_country",
      "scope": "footer",
      "responseSha256": "ec21be8157d0a5623c34d91b12bbcf7157d562b5a43249ebbdcd1a4c10aa9b31",
      "accessedAt": "2026-10-01T21:04:11.874Z"
    }
  },
  "ordfront": {
    "sourceFamilyId": "ordfront",
    "countryCodes": [
      "SE"
    ],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_contact_address",
      "url": "https://ordfrontforlag.se/",
      "organisation": "Ordfront",
      "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
      "excerpt": "Genvägar Press Manus Vi som jobbar här Om oss Kontakta oss Besöksadress: Stortorget 1 111 29 Stockholm Fakturaadress: Ordfront förlag c/o Förlagsekonomi Skönviksvägen 238 122 42 Enskede faktura.5567980957@forlagsekonomi.se Följ oss FacebookInstagramTwi",
      "status": "organisation_country",
      "scope": "footer",
      "responseSha256": "1a2e1f2bc7b75380d557b08fca1a794d0cf27a20111c70d2ec39044ce25531c7",
      "accessedAt": "2026-10-01T21:04:12.091Z"
    }
  },
  "ikaros": {
    "sourceFamilyId": "ikaros",
    "countryCodes": [
      "GR"
    ],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_contact_address",
      "url": "https://ikarosbooks.gr/el/contact/",
      "organisation": "Ikaros",
      "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
      "excerpt": "άθεσή σας για την καλύτερη δυνατή εξυπηρέτηση. Βιβλιοπωλείο, Παραγγελίες Βουλής 4, Σύνταγμα 105 62, Αθήνα Τηλ: 210 3225152 fax: 211 2687003 Email: orders@ikarosbooks.gr Εκδόσεις, Λογιστήριο, Ατελιέ Βουλής 35, Σύνταγμα 105 57, Αθήνα Τηλ: 216 7005964 Email:",
      "status": "organisation_country",
      "scope": "official_contact_page",
      "responseSha256": "971bcba3a5150da6dba9b1f49063e253cfcfe98a65bc2899746fac79c0bf35bf",
      "accessedAt": "2026-10-01T21:04:13.065Z"
    }
  },
  "metis-kitap": {
    "sourceFamilyId": "metis-kitap",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.metiskitap.com/",
      "organisation": "Metis Kitap",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Metis Kitap",
      "status": "office_country_unconfirmed"
    }
  },
  "hong-kong-literary-festival": {
    "sourceFamilyId": "hong-kong-literary-festival",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.festival.org.hk/",
      "organisation": "Hong Kong International Literary Festival",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Hong Kong International Literary Festival",
      "status": "office_country_unconfirmed"
    }
  },
  "openbook-taiwan": {
    "sourceFamilyId": "openbook-taiwan",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.openbook.org.tw/",
      "organisation": "Openbook",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Openbook",
      "status": "office_country_unconfirmed"
    }
  },
  "gramedia-blog": {
    "sourceFamilyId": "gramedia-blog",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.gramedia.com/blog/",
      "organisation": "Gramedia",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Gramedia",
      "status": "office_country_unconfirmed"
    }
  },
  "mizan": {
    "sourceFamilyId": "mizan",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://mizan.com/",
      "organisation": "Mizan",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Mizan",
      "status": "office_country_unconfirmed"
    }
  },
  "adarna": {
    "sourceFamilyId": "adarna",
    "countryCodes": [
      "PH"
    ],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_contact_address",
      "url": "https://adarna.com.ph/",
      "organisation": "Adarna House",
      "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
      "excerpt": "babasang Filipino. Visit us109 Scout Fernandez corner Scout Torillo Streets, Barangay Sacred Heart, Quezon City, 1103 Open hoursMon - Fri · 8:00 AM - 5:00 PM Get in touch kaibigan@adarna.com.ph © 2026 Adarna House, Inc. All rights reserved. PayPal",
      "status": "organisation_country",
      "scope": "footer",
      "responseSha256": "c97a2289217e966cc296687cdc83ff2f39f47fe70e3a960b03ea2d78dc8e598a",
      "accessedAt": "2026-10-01T21:04:12.559Z"
    }
  },
  "ateneo-press": {
    "sourceFamilyId": "ateneo-press",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://unipress.ateneo.edu/",
      "organisation": "Ateneo de Manila University Press",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Ateneo de Manila University Press",
      "status": "office_country_unconfirmed"
    }
  },
  "anvil-publishing": {
    "sourceFamilyId": "anvil-publishing",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.anvilpublishing.com/",
      "organisation": "Anvil Publishing",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Anvil Publishing",
      "status": "office_country_unconfirmed"
    }
  },
  "women-prize": {
    "sourceFamilyId": "women-prize",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://womensprize.com/",
      "organisation": "Women’s Prize for Fiction",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Women’s Prize for Fiction",
      "status": "office_country_unconfirmed"
    }
  },
  "dublin-literary-award": {
    "sourceFamilyId": "dublin-literary-award",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://dublinliteraryaward.ie/",
      "organisation": "Dublin Literary Award",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Dublin Literary Award",
      "status": "office_country_unconfirmed"
    }
  },
  "tsa-prize": {
    "sourceFamilyId": "tsa-prize",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://societyofauthors.org/",
      "organisation": "The Society of Authors",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "The Society of Authors",
      "status": "office_country_unconfirmed"
    }
  },
  "booker-new-media": {
    "sourceFamilyId": "booker-new-media",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.thebookseller.com/news",
      "organisation": "The Bookseller",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "The Bookseller",
      "status": "office_country_unconfirmed"
    }
  },
  "literary-review": {
    "sourceFamilyId": "literary-review",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://literaryreview.co.uk/",
      "organisation": "Literary Review",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Literary Review",
      "status": "office_country_unconfirmed"
    }
  },
  "bookbrunch": {
    "sourceFamilyId": "bookbrunch",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.bookbrunch.co.uk/",
      "organisation": "BookBrunch",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "BookBrunch",
      "status": "office_country_unconfirmed"
    }
  },
  "russian-pen": {
    "sourceFamilyId": "russian-pen",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://ruspen.ru/",
      "organisation": "Русский ПЕН-центр",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Русский ПЕН-центр",
      "status": "office_country_unconfirmed"
    }
  },
  "big-book-award": {
    "sourceFamilyId": "big-book-award",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://bigbook.ru/",
      "organisation": "Большая книга",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Большая книга",
      "status": "office_country_unconfirmed"
    }
  },
  "yasnaya-polyana-award": {
    "sourceFamilyId": "yasnaya-polyana-award",
    "countryCodes": [
      "RU"
    ],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_contact_address",
      "url": "https://www.yppremia.ru/contacts",
      "organisation": "Премия Ясная Поляна",
      "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
      "excerpt": "ращаться к координатору литературной премии «Ясная Поляна»: E-mail yppremia@yandex.ru адрес 119034, Россия, Москва, ул. Льва Толстого, д. 21 Музей-усадьба Л.Н. Толстого «Хамовники» (с пометкой «Литературная премия «Ясная Поляна») подписатьсяна нашу рассылк",
      "status": "organisation_country",
      "scope": "official_contact_page",
      "responseSha256": "2ba681b79ccbb809a7d46add53a838f1f8356e2654a7c23b93c1719c1c261404",
      "accessedAt": "2026-10-01T21:04:14.542Z"
    }
  },
  "prosodia": {
    "sourceFamilyId": "prosodia",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://prosodia.ru/",
      "organisation": "Prosodia",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Prosodia",
      "status": "office_country_unconfirmed"
    }
  },
  "voprosy-literatury": {
    "sourceFamilyId": "voprosy-literatury",
    "countryCodes": [
      "RU"
    ],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_contact_address",
      "url": "https://voplit.ru/about/contacts/",
      "organisation": "Вопросы литературы",
      "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
      "excerpt": "вости Юр. информация Контакты Адрес и время работы Юридический и почтовый адрес редакции:125375, г. Москва, Большой Гнездниковский пер., дом 10. Редакция работает с понедельника по пятницу с 10 до 20 часов; дни приема: понедельник, среда и пятница с 10 до ",
      "status": "organisation_country",
      "scope": "official_contact_page",
      "responseSha256": "7882772630b6989fcf03785c7fd21a7d3227ba8187599cb92f5d7d43c1b7d91c",
      "accessedAt": "2026-10-01T21:04:14.707Z"
    }
  },
  "zvezda-journal": {
    "sourceFamilyId": "zvezda-journal",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://zvezdaspb.ru/",
      "organisation": "Звезда",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Звезда",
      "status": "office_country_unconfirmed"
    }
  },
  "uc-press": {
    "sourceFamilyId": "uc-press",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.ucpress.edu/blog/",
      "organisation": "University of California Press",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "University of California Press",
      "status": "office_country_unconfirmed"
    }
  },
  "mit-press": {
    "sourceFamilyId": "mit-press",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://mitpress.mit.edu/blog/",
      "organisation": "MIT Press",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "MIT Press",
      "status": "office_country_unconfirmed"
    }
  },
  "yale-press": {
    "sourceFamilyId": "yale-press",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://yalebooks.yale.edu/",
      "organisation": "Yale University Press",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Yale University Press",
      "status": "office_country_unconfirmed"
    }
  },
  "harvard-press-blog": {
    "sourceFamilyId": "harvard-press-blog",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://blog.hup.harvard.edu/",
      "organisation": "Harvard University Press",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Harvard University Press",
      "status": "office_country_unconfirmed"
    }
  },
  "duke-press-blog": {
    "sourceFamilyId": "duke-press-blog",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://dukeupress.wordpress.com/",
      "organisation": "Duke University Press",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Duke University Press",
      "status": "office_country_unconfirmed"
    }
  },
  "columbia-press-blog": {
    "sourceFamilyId": "columbia-press-blog",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://cupblog.org/",
      "organisation": "Columbia University Press",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Columbia University Press",
      "status": "office_country_unconfirmed"
    }
  },
  "oxford-press-blog": {
    "sourceFamilyId": "oxford-press-blog",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://blog.oup.com/",
      "organisation": "Oxford University Press",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Oxford University Press",
      "status": "office_country_unconfirmed"
    }
  },
  "cambridge-press-blog": {
    "sourceFamilyId": "cambridge-press-blog",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://cambridgeblog.org/",
      "organisation": "Cambridge University Press",
      "status": "office_country_unconfirmed",
      "statement": "Observed country names describe distribution, publishing coverage or a brand rather than an independently confirmed organisation office address."
    }
  },
  "manchester-press": {
    "sourceFamilyId": "manchester-press",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://manchesteruniversitypress.co.uk/",
      "organisation": "Manchester University Press",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Manchester University Press",
      "status": "office_country_unconfirmed"
    }
  },
  "edinburgh-press-blog": {
    "sourceFamilyId": "edinburgh-press-blog",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://euppublishingblog.com/",
      "organisation": "Edinburgh University Press",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Edinburgh University Press",
      "status": "office_country_unconfirmed"
    }
  },
  "liverpool-press-blog": {
    "sourceFamilyId": "liverpool-press-blog",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://liverpooluniversitypress.blog/",
      "organisation": "Liverpool University Press",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Liverpool University Press",
      "status": "office_country_unconfirmed"
    }
  },
  "bristol-press": {
    "sourceFamilyId": "bristol-press",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://bristoluniversitypress.co.uk/",
      "organisation": "Bristol University Press",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Bristol University Press",
      "status": "office_country_unconfirmed"
    }
  },
  "minnesota-press": {
    "sourceFamilyId": "minnesota-press",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.upress.umn.edu/",
      "organisation": "University of Minnesota Press",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "University of Minnesota Press",
      "status": "office_country_unconfirmed"
    }
  },
  "unc-press-blog": {
    "sourceFamilyId": "unc-press-blog",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://uncpressblog.com/",
      "organisation": "University of North Carolina Press",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "University of North Carolina Press",
      "status": "office_country_unconfirmed"
    }
  },
  "nebraska-press": {
    "sourceFamilyId": "nebraska-press",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.nebraskapress.unl.edu/",
      "organisation": "University of Nebraska Press",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "University of Nebraska Press",
      "status": "office_country_unconfirmed"
    }
  },
  "notre-dame-press": {
    "sourceFamilyId": "notre-dame-press",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://undpress.nd.edu/",
      "organisation": "University of Notre Dame Press",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "University of Notre Dame Press",
      "status": "office_country_unconfirmed"
    }
  },
  "syracuse-press": {
    "sourceFamilyId": "syracuse-press",
    "countryCodes": [
      "US"
    ],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_contact_address",
      "url": "https://press.syr.edu/",
      "organisation": "Syracuse University Press",
      "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
      "excerpt": "X Facebook YouTube LinkedIn Instagram Bluesky Syracuse University Press 621 Skytop Road, Suite 110 map this locationGoogle map location Syracuse, New York 13244-5290 supress@syr.edu For book orders, conta",
      "status": "organisation_country",
      "scope": "footer",
      "responseSha256": "551109115475a34cee415e15d733adb23de86c57008e6e18c914eb2e05c82b83",
      "accessedAt": "2026-10-01T21:04:16.229Z"
    }
  },
  "indiana-press": {
    "sourceFamilyId": "indiana-press",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://iupress.org/",
      "organisation": "Indiana University Press",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Indiana University Press",
      "status": "office_country_unconfirmed"
    }
  },
  "iowa-press": {
    "sourceFamilyId": "iowa-press",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://uipress.uiowa.edu/",
      "organisation": "University of Iowa Press",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "University of Iowa Press",
      "status": "office_country_unconfirmed"
    }
  },
  "virginia-press": {
    "sourceFamilyId": "virginia-press",
    "countryCodes": [
      "US"
    ],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_contact_address",
      "url": "https://www.upress.virginia.edu/",
      "organisation": "University of Virginia Press",
      "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
      "excerpt": "PressCareer OpportunitiesWalker Cowen Memorial PrizePrivacy PolicyContact UsP.O. Box 400318 (Postal)Charlottesville, VA 22904-4318210 Sprigg Lane (Courier)Charlottesville, VA 22903-2417434 924-3468 (main)1-800-831-3406 (toll-free)434 982-2655 (fax)General Inquiries",
      "status": "organisation_country",
      "scope": "footer",
      "responseSha256": "720a62133d0c1924a0f4e89f9ffe96b5a830faad8c6571c847f5bcd6b352f321",
      "accessedAt": "2026-10-01T21:04:15.804Z"
    }
  },
  "penn-state-press": {
    "sourceFamilyId": "penn-state-press",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.psupress.org/",
      "organisation": "Penn State University Press",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Penn State University Press",
      "status": "office_country_unconfirmed"
    }
  },
  "fordham-press": {
    "sourceFamilyId": "fordham-press",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://fordhampress.com/",
      "organisation": "Fordham University Press",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Fordham University Press",
      "status": "office_country_unconfirmed"
    }
  },
  "chicago-press": {
    "sourceFamilyId": "chicago-press",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://press.uchicago.edu/",
      "organisation": "University of Chicago Press",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "University of Chicago Press",
      "status": "office_country_unconfirmed"
    }
  },
  "toronto-press": {
    "sourceFamilyId": "toronto-press",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://utorontopress.com/",
      "organisation": "University of Toronto Press",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "University of Toronto Press",
      "status": "office_country_unconfirmed"
    }
  },
  "ubc-press": {
    "sourceFamilyId": "ubc-press",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.ubcpress.ca/",
      "organisation": "UBC Press",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "UBC Press",
      "status": "office_country_unconfirmed"
    }
  },
  "mcgill-queens-press": {
    "sourceFamilyId": "mcgill-queens-press",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.mqup.ca/",
      "organisation": "McGill-Queen’s University Press",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "McGill-Queen’s University Press",
      "status": "office_country_unconfirmed"
    }
  },
  "peter-owen": {
    "sourceFamilyId": "peter-owen",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.peterowen.com/",
      "organisation": "Peter Owen",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Peter Owen",
      "status": "office_country_unconfirmed"
    }
  },
  "dedalus-books": {
    "sourceFamilyId": "dedalus-books",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.dedalusbooks.com/",
      "organisation": "Dedalus Books",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Dedalus Books",
      "status": "office_country_unconfirmed"
    }
  },
  "valancourt": {
    "sourceFamilyId": "valancourt",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.valancourtbooks.com/",
      "organisation": "Valancourt Books",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Valancourt Books",
      "status": "office_country_unconfirmed"
    }
  },
  "world-literature-today": {
    "sourceFamilyId": "world-literature-today",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.worldliteraturetoday.org/",
      "organisation": "World Literature Today",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "World Literature Today",
      "status": "office_country_unconfirmed"
    }
  },
  "literary-translation-uk": {
    "sourceFamilyId": "literary-translation-uk",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.bclt.org.uk/",
      "organisation": "Literary Translation at the British Centre",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Literary Translation at the British Centre",
      "status": "office_country_unconfirmed"
    }
  },
  "charco-press": {
    "sourceFamilyId": "charco-press",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://charcopress.com/",
      "organisation": "Charco Press",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Charco Press",
      "status": "office_country_unconfirmed"
    }
  },
  "prototype-publishing": {
    "sourceFamilyId": "prototype-publishing",
    "countryCodes": [
      "GB"
    ],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_contact_address",
      "url": "https://prototypepublishing.co.uk/about/contact/",
      "organisation": "Prototype",
      "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
      "excerpt": "ge, otherwise, you can find us here: Email: admin[at]prototypepublishing.co.uk Post: 71 Oriel Road, London E9 5SG, UK Contact form Your Name (we need this) Your Email (we need this too) What are you contacting us about? Your Message <div class=\"grecaptcha-",
      "status": "organisation_country",
      "scope": "official_contact_page",
      "responseSha256": "66667636c1a399f374a420338975eecb44339df87313f54534d1158eddba07dd",
      "accessedAt": "2026-10-01T21:04:17.202Z"
    }
  },
  "tilted-axis": {
    "sourceFamilyId": "tilted-axis",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.tiltedaxispress.com/",
      "organisation": "Tilted Axis Press",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Tilted Axis Press",
      "status": "office_country_unconfirmed"
    }
  },
  "guernica-magazine": {
    "sourceFamilyId": "guernica-magazine",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.guernicamag.com/",
      "organisation": "Guernica",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Guernica",
      "status": "office_country_unconfirmed"
    }
  },
  "asap-journal": {
    "sourceFamilyId": "asap-journal",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://asapjournal.com/",
      "organisation": "ASAP/Journal",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "ASAP/Journal",
      "status": "office_country_unconfirmed"
    }
  },
  "cleveland-review-books": {
    "sourceFamilyId": "cleveland-review-books",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.clereviewofbooks.com/",
      "organisation": "Cleveland Review of Books",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Cleveland Review of Books",
      "status": "office_country_unconfirmed"
    }
  },
  "public-books": {
    "sourceFamilyId": "public-books",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.publicbooks.org/",
      "organisation": "Public Books",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Public Books",
      "status": "office_country_unconfirmed"
    }
  },
  "bookforum": {
    "sourceFamilyId": "bookforum",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.bookforum.com/",
      "organisation": "Bookforum",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Bookforum",
      "status": "office_country_unconfirmed"
    }
  },
  "revista-letras-libres": {
    "sourceFamilyId": "revista-letras-libres",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://letraslibres.com/",
      "organisation": "Letras Libres",
      "status": "office_country_unconfirmed",
      "statement": "Observed country names describe distribution, publishing coverage or a brand rather than an independently confirmed organisation office address."
    }
  },
  "revista-mercatto": {
    "sourceFamilyId": "revista-mercatto",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://revistamercurio.es/",
      "organisation": "Mercurio",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Mercurio",
      "status": "office_country_unconfirmed"
    }
  },
  "jot-down-books": {
    "sourceFamilyId": "jot-down-books",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.jotdown.es/",
      "organisation": "Jot Down Cultural Magazine",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Jot Down Cultural Magazine",
      "status": "office_country_unconfirmed"
    }
  },
  "page-libraires": {
    "sourceFamilyId": "page-libraires",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.pagedeslibraires.fr/",
      "organisation": "PAGE des libraires",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "PAGE des libraires",
      "status": "office_country_unconfirmed"
    }
  },
  "remue-net": {
    "sourceFamilyId": "remue-net",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://remue.net/",
      "organisation": "Remue.net",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Remue.net",
      "status": "office_country_unconfirmed"
    }
  },
  "revue-litteraire": {
    "sourceFamilyId": "revue-litteraire",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.lanrf.fr/",
      "organisation": "La Nouvelle Revue Française",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "La Nouvelle Revue Française",
      "status": "office_country_unconfirmed"
    }
  },
  "revue-respiro": {
    "sourceFamilyId": "revue-respiro",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.respiro.org/",
      "organisation": "Respiro",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Respiro",
      "status": "office_country_unconfirmed"
    }
  },
  "cultura-romania": {
    "sourceFamilyId": "cultura-romania",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://revistacultura.ro/",
      "organisation": "Cultura",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Cultura",
      "status": "office_country_unconfirmed"
    }
  },
  "observator-cultural": {
    "sourceFamilyId": "observator-cultural",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.observatorcultural.ro/",
      "organisation": "Observator cultural",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Observator cultural",
      "status": "office_country_unconfirmed"
    }
  },
  "liternet-bulgaria": {
    "sourceFamilyId": "liternet-bulgaria",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://liternet.bg/",
      "organisation": "LiterNet",
      "status": "office_country_unconfirmed",
      "statement": "Observed country names describe distribution, publishing coverage or a brand rather than an independently confirmed organisation office address."
    }
  },
  "litlogos": {
    "sourceFamilyId": "litlogos",
    "countryCodes": [
      "CH"
    ],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_contact_address",
      "url": "https://literaturhaus.ch/impressum/",
      "organisation": "Literaturhaus Switzerland",
      "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
      "excerpt": "Impressum Redaktion Museumsgesellschaft und Literaturhaus Zürich, Limmatquai 62, 8001 Zürich, SchweizTelefon +41 44 254 50 08info@literaturhaus.chNicola Steiner, Isabelle Vonlanthen, Sandra Gubler Design und Progra",
      "status": "organisation_country",
      "scope": "official_contact_page",
      "responseSha256": "e701a2116b419e66a1c84ff55832698d03afe223704f81bf747ef76dd8beedc5",
      "accessedAt": "2026-10-01T21:04:19.499Z"
    }
  },
  "literaturhaus-basel": {
    "sourceFamilyId": "literaturhaus-basel",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.literaturhaus-basel.ch/",
      "organisation": "Literaturhaus Basel",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Literaturhaus Basel",
      "status": "office_country_unconfirmed"
    }
  },
  "literaturhaus-salzburg": {
    "sourceFamilyId": "literaturhaus-salzburg",
    "countryCodes": [
      "AT"
    ],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_contact_address",
      "url": "https://www.literaturhaus-salzburg.at/",
      "organisation": "Literaturhaus Salzburg",
      "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
      "excerpt": "Newsletter Presse Kontakt Impressum LITERATURHAUS SALZBURGStrubergasse 23, H.C. Artmann-PlatzA-5020 Salzburg Telefon: +43 662 422 411Fax: +43 662 422 411-13E-Mail: info@literaturhaus-salzburg.at Instagram Fac",
      "status": "organisation_country",
      "scope": "footer",
      "responseSha256": "4874072bb02d40db30b1799817d5e2ee943cf25c7fdffe53590fb28f2329352e",
      "accessedAt": "2026-10-01T21:04:19.552Z"
    }
  },
  "literaturhaus-berlin": {
    "sourceFamilyId": "literaturhaus-berlin",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.literaturhaus-berlin.de/",
      "organisation": "Literaturhaus Berlin",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Literaturhaus Berlin",
      "status": "office_country_unconfirmed"
    }
  },
  "literaturhaus-hamburg": {
    "sourceFamilyId": "literaturhaus-hamburg",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.literaturhaus-hamburg.de/",
      "organisation": "Literaturhaus Hamburg",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Literaturhaus Hamburg",
      "status": "office_country_unconfirmed"
    }
  },
  "literaturhaus-stuttgart": {
    "sourceFamilyId": "literaturhaus-stuttgart",
    "countryCodes": [
      "DE"
    ],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_contact_address",
      "url": "https://www.literaturhaus-stuttgart.de/",
      "organisation": "Literaturhaus Stuttgart",
      "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
      "excerpt": "Literaturhaus Stuttgart Breitscheidstraße 4 70174 Stuttgart Fon (0711) 22 02 17 - 3 Fax (0711) 22 02 17 - 48 info@literaturhaus-stuttgart.de Barrierefreiheit Kontakt Anfahrt",
      "status": "organisation_country",
      "scope": "footer",
      "responseSha256": "6a1d362326172ecd132828e061d589f97007ed8db4d9198ff02cc4c1a47d20c7",
      "accessedAt": "2026-10-01T21:04:19.806Z"
    }
  },
  "letterenfonds": {
    "sourceFamilyId": "letterenfonds",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.letterenfonds.nl/",
      "organisation": "Dutch Foundation for Literature",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Dutch Foundation for Literature",
      "status": "office_country_unconfirmed"
    }
  },
  "flanders-literature": {
    "sourceFamilyId": "flanders-literature",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.flandersliterature.be/",
      "organisation": "Flanders Literature",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Flanders Literature",
      "status": "office_country_unconfirmed"
    }
  },
  "literature-finland": {
    "sourceFamilyId": "literature-finland",
    "countryCodes": [
      "FI"
    ],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_contact_address",
      "url": "https://fili.fi/",
      "organisation": "FILI",
      "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
      "excerpt": "nen kääntäjäpalkinto 100 kääntäjääJulkaisutFILIn kirjanostotFILI PodcastFILIn kirjavideotBooks from Finland -lehden arkistoFILIMeistäYhteys­tiedotMedialleLogopankkiFILI, Hallituskatu 2 B 00170 Helsinki *protected email*Saavutetta­vuusselosteTietosuojaselost",
      "status": "organisation_country",
      "scope": "footer",
      "responseSha256": "5244bc71eac7006f20bc2c136ad7eb18a08cfd8f2cf9cc7b01c01785ce96477c",
      "accessedAt": "2026-10-01T21:04:19.838Z"
    }
  },
  "norla": {
    "sourceFamilyId": "norla",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://norla.no/en",
      "organisation": "NORLA",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "NORLA",
      "status": "office_country_unconfirmed"
    }
  },
  "swedish-literature": {
    "sourceFamilyId": "swedish-literature",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.kulturradet.se/",
      "organisation": "Swedish Arts Council",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Swedish Arts Council",
      "status": "office_country_unconfirmed"
    }
  },
  "irish-literature": {
    "sourceFamilyId": "irish-literature",
    "countryCodes": [
      "IE"
    ],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_contact_address",
      "url": "https://www.literatureireland.com/",
      "organisation": "Literature Ireland",
      "statement": "Organisation country confirmed from its own footer or contact address; independent of article/event geography.",
      "excerpt": "Trinity Centre for Literary and Cultural Translation 36 Fenian Street Trinity College Dublin Dublin D02 CH22 Ireland Cookies & privacy notice Policies & legal notes Download brand assets Contact details Make a donation Sign up to our newslett",
      "status": "organisation_country",
      "scope": "footer",
      "responseSha256": "d1456f05b9458536d5990640983cf72147627ca7d0ac40f18f4d08c65f3fdff5",
      "accessedAt": "2026-10-01T21:04:20.232Z"
    }
  },
  "ireland-book-awards": {
    "sourceFamilyId": "ireland-book-awards",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.irishbookawards.ie/",
      "organisation": "An Post Irish Book Awards",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "An Post Irish Book Awards",
      "status": "office_country_unconfirmed"
    }
  },
  "miles-franklin": {
    "sourceFamilyId": "miles-franklin",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.milesfranklin.com.au/",
      "organisation": "Miles Franklin Literary Award",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Miles Franklin Literary Award",
      "status": "office_country_unconfirmed"
    }
  },
  "stella-prize": {
    "sourceFamilyId": "stella-prize",
    "countryCodes": [
      "AU"
    ],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_registration_identity",
      "url": "https://stella.org.au/",
      "organisation": "Stella Prize",
      "statement": "The organisation declares its Australian Registered Body Number in its own legal footer; event geography is separate.",
      "excerpt": "o@stella.org.au ARBN: 657 317 283 Stella acknowledges the Traditional Owners of the land throughout Australia and recognises their continuing connection to land, waters, community, and culture.We pay our respect to Elders past and present and, through them, t",
      "status": "organisation_country",
      "scope": "official_footer",
      "responseSha256": "236ea8f57512f65e9a76abd308de2a68c5679eb247d37a30aa28a796a40948fa",
      "accessedAt": "2026-10-01T21:04:21.922Z"
    }
  },
  "hakara": {
    "sourceFamilyId": "hakara",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.hakara.in/",
      "organisation": "Hakara",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Hakara",
      "status": "office_country_unconfirmed"
    }
  },
  "jimsaan": {
    "sourceFamilyId": "jimsaan",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://jimsaan.com/",
      "organisation": "Jimsaan",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Jimsaan",
      "status": "office_country_unconfirmed"
    }
  },
  "editions-elyzad": {
    "sourceFamilyId": "editions-elyzad",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://elyzad.com/",
      "organisation": "Elyzad",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Elyzad",
      "status": "office_country_unconfirmed"
    }
  },
  "editions-fennec": {
    "sourceFamilyId": "editions-fennec",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.editionslefennec.com/",
      "organisation": "Le Fennec",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Le Fennec",
      "status": "office_country_unconfirmed"
    }
  },
  "barzakh": {
    "sourceFamilyId": "barzakh",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.editions-barzakh.com/",
      "organisation": "Barzakh",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Barzakh",
      "status": "office_country_unconfirmed"
    }
  },
  "moran-publishers": {
    "sourceFamilyId": "moran-publishers",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://moranpublishers.com/",
      "organisation": "Moran Publishers",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Moran Publishers",
      "status": "office_country_unconfirmed"
    }
  },
  "kwela-books": {
    "sourceFamilyId": "kwela-books",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://www.kwela.com/",
      "organisation": "Kwela Books",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Kwela Books",
      "status": "office_country_unconfirmed"
    }
  },
  "karavan-press": {
    "sourceFamilyId": "karavan-press",
    "countryCodes": [],
    "coverageCountryCodes": [],
    "countryEvidence": {
      "method": "official_organisation_identity",
      "url": "https://karavanpress.com/",
      "organisation": "Karavan Press",
      "statement": "Organisation country is distinct from the country of each covered event.",
      "excerpt": "Karavan Press",
      "status": "office_country_unconfirmed"
    }
  }
};
