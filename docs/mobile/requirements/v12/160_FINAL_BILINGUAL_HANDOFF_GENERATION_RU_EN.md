# FINAL BILINGUAL HANDOFF GENERATION / ФИНАЛЬНАЯ ПЕРЕДАЧА V12

## 1. One owner folder

Generate one self-contained folder:

```text
artifacts/owner-handoff/
```

It must be usable in Russian, with an English companion for store reviewers,
English-speaking contractors/support and future international operations.

## 2. Required bilingual files

```text
00_READ_ME_FIRST_RU.md
00_READ_ME_FIRST_EN.md
FINAL_OWNER_APPROVAL_RU_EN.html
FINAL_OWNER_APPROVAL_RU_EN.json
ONLY_REMAINING_ACTIONS_RU.md
ONLY_REMAINING_ACTIONS_EN.md
MISSING_INPUTS_RU.md
MISSING_INPUTS_EN.md
STORE_CONSOLE_FIELDS_RU_EN.csv
LANGUAGE_COVERAGE_RU_EN.json
ENGLISH_CONTENT_GATE.json
NAMES_TITLES_EVIDENCE.csv
SEARCH_ALIAS_EVIDENCE.json
LOCALIZED_SCREENSHOT_MANIFEST.csv
LEGAL_DOCUMENT_VERSION_MAP.csv
SUPPORT_LANGUAGE_READINESS.json
OFFLINE_LOCALE_PACKAGES.json
WEB_SEO_HREFLANG_REPORT.json
POST_BUILD_OWNER_GUIDE_RU.txt
POST_BUILD_OWNER_GUIDE_EN.txt
```

## 3. Store folders

Each App Store/Google Play/RuStore folder contains:

- exact English/Russian metadata supported by that store;
- screenshots by locale/device;
- reviewer notes with exact visible labels;
- app/build/content/localization hashes;
- paid model and optional product disclosure;
- privacy/age/target-audience evidence;
- rights evidence summary;
- accountless-first explanation;
- language-switch instructions;
- no-Disney proof.

## 4. English content evidence

The owner sees concise PASS/FAIL totals and sampled previews, not every raw
translation unit. Any failed factual, child, legal, rights or critical UI
unit remains an internal blocker and cannot be waived by a blanket owner
checkbox.

## 5. Approval

The bilingual owner approval page must show Russian and English product
names, paired screenshots, legal document versions, English coverage,
English child/Planetka status, store localization status, territory/support
readiness and exact artifact SHA.

## 6. Fresh-reader test

A Russian-speaking owner and an English-speaking reviewer/tester must each be
able to locate their required package and complete a dry-run without reading
the repository. Findings become blocking handoff issues until fixed.

## 7. Final honesty

The handoff distinguishes:

- internal complete;
- missing owner input;
- missing account/signing/legal/rights;
- draft uploaded;
- ready for manual submission;
- submitted;
- approved;
- released.

No generated document may call the English version complete when a critical
translation is stale, fallback-only or hidden behind Russian text.
