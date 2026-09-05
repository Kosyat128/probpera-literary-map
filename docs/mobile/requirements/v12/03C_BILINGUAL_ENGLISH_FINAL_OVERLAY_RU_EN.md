# V12 BILINGUAL ENGLISH FINAL OVERLAY / ДВУЯЗЫЧНЫЙ ФИНАЛЬНЫЙ КОНТРАКТ
# HIGHEST PRIORITY AFTER 03B / ВЫСШИЙ ПРИОРИТЕТ ПОСЛЕ 03B

## 1. Final release identity / Идентичность выпуска

V12 extends every V11/V12 owner-minimal, moderation, child-safety,
commerce, rights and site-canon rule with mandatory production-quality
Russian and English support.

Обязательные языки первого публичного выпуска:

```text
ru — Русский
 en — English
```

Release profile:

```text
SAFE_PAID_BILINGUAL_V1
```

This profile is the previous safe paid profile plus a complete English
application, content, store, legal, support and reviewer surface.

## 2. Product names / Названия

Russian:

```text
App name: Литературная планета
Brand/subtitle: Проба пера
Guide character: Планетка
```

English:

```text
App name: Literary Planet
Brand/subtitle: Proba Pera
Guide character: Planetka
```

`Proba Pera` is the stable English brand form. Do not randomly alternate
between “Trial of the Pen”, “First Attempt”, “Pen Test” or other literal
translations. An explanatory translation may appear in About, but not as
another official brand identity.

## 3. Runtime locale behavior / Поведение языка

- Source/editorial locale: `ru`.
- Required release locales: `ru`, `en`.
- Unsupported system locale fallback: `en`.
- On devices with Russian as preferred language, start in Russian.
- On other devices, start in English.
- Always provide a visible language selector in onboarding and Settings.
- A language change preserves the same globe, camera, country, writer,
  work, child profile, purchase state, download and route.
- Language switching must never recreate a second globe or reset Canvas.
- The chosen app language is stored locally before first content render,
  preventing Russian/English flash.
- Child mode remains child mode after language changes.
- Parent may lock a child profile language; language selection never
  bypasses age or Parent Gate policy.
- Language and sales territory are separate concepts.

## 4. Complete English scope / Полный английский контур

English is not limited to buttons. Before V12 bilingual release, English
must cover:

- all critical and noncritical UI;
- onboarding, errors, empty/offline states and accessibility labels;
- native system-facing strings on Android and iOS;
- Base Edition writer profiles, biographies, countries, works and facts;
- child biographies, journeys, quizzes and Planetka dialogue;
- Starter Set, skins, stands, backgrounds and optional product;
- search aliases, sorting and transliteration;
- offline packages and downloaded manifests;
- store metadata and exact-build screenshots;
- privacy, terms, support and account deletion;
- reviewer instructions and moderation dossiers;
- admin/CMS translation workflow;
- owner handoff and post-build guide.

An untranslated Base Edition entity may not silently appear in Russian in
an English screen. Publication is blocked or the entity is explicitly
unavailable in English until approved. V12 release requires 100% Base
Edition English coverage.

## 5. No low-quality machine translation / Запрет сырого машинного перевода

Codex may generate a draft, but production publication requires:

1. source hash and immutable factual source;
2. glossary and translation-memory pass;
3. named-entity/title verification;
4. placeholder/markup/citation parity;
5. independent semantic review pass;
6. back-translation or structured meaning-diff check;
7. child reading-level and sensitivity check where applicable;
8. rights check for translated quotations/titles/audio;
9. locale preview and layout test;
10. approved publication state.

Raw automated translation, hallucinated English book titles, invented
writer aliases, translated URLs, changed dates or lost citations are P0
release blockers.

## 6. English names and titles / Имена и названия

- Use an established English writer name from authoritative library,
  publisher or reference sources when available.
- Preserve native/original name separately.
- Search includes Russian, English, native-script and verified
  transliteration aliases without creating duplicate writer records.
- Use a documented published English work title when verified.
- If no established English title exists, show the original title plus a
  clearly marked transliteration or descriptive translation; never present
  a guessed translation as an official edition title.
- A public-domain source text does not automatically make a modern English
  translation, cover or audiobook public domain.
- Quotations use a rights-cleared English translation or are paraphrased as
  summaries; do not fabricate a canonical quotation.

## 7. Platform localization / Локализация платформ

Apple:

- app binary supports Russian and English;
- use String Catalogs/native localized resources for system surfaces;
- support per-app language behavior provided by iOS/iPadOS;
- localize App Store metadata and exact-build screenshots for English and
  Russian;
- if a new app record is created, English (U.S.) is the recommended primary
  metadata fallback with Russian localization; if an existing record has a
  different primary language, do not change it without a migration review.

Google Play / Android:

- support Android per-app language preferences for `ru` and `en`;
- include only declared locales in the production bundle;
- provide complete default resources so unsupported device locales cannot
  crash the app;
- use English (United States) default store listing and Russian translation
  for a new global listing, unless the owner approves another existing
  configuration;
- custom store listings require their own manually supplied translations;
  do not rely on automated store translation.

RuStore:

- Russian storefront remains the primary submission surface;
- the app must offer Russian and English selection;
- moderation instructions are Russian with an English backup;
- no mixed-language screen or English-only legal dead end.

Web/PWA:

- localized routes and metadata;
- `lang`, `hreflang`, canonical and locale alternates;
- no duplicate-content loops;
- browser/system locale negotiation plus explicit switch;
- locale-specific offline caches and manifests;
- English fallback for unsupported locales.

## 8. Store and legal truth / Магазины и право

Create separate approved materials for:

```text
en-US
ru-RU / ru
```

Do not publish a localized listing until its binary language, content,
legal text, support path and screenshots are equally ready.

Legal documents define which language controls in case of discrepancy.
The controlling-language clause is an owner/legal decision, not an
automatic translation decision.

## 9. English child experience / Детский режим на английском

Planetka English dialogue is adapted, not mechanically translated. It
must be:

- clear international English;
- age-banded;
- culturally neutral where possible;
- free from commercial pressure;
- source-verified;
- subtitle-complete;
- reviewed for pronunciation and voice rights;
- available offline for the included child pack.

Do not use celebrity or character voice cloning. Do not record or upload a
child’s voice.

## 10. Mandatory bilingual stages / Обязательные этапы

```text
S36 — Internationalization foundation and language switching
S37 — Complete English UI, native, store, legal and support surfaces
S38 — English literary content, names, titles, search and CMS workflow
S39 — English child mode, Planetka, audio, offline and bilingual QA
S40 — Bilingual release dossiers, screenshots, owner approval and handoff
```

FINAL HANDOFF is forbidden before S40.

## 11. Bilingual definition of done / Критерий завершения

- Russian and English core UI coverage = 100%.
- Base Edition English content coverage = 100%.
- Store/reviewer/legal/support English coverage = 100%.
- No raw keys, placeholder English, accidental Cyrillic UI or mixed screen.
- All placeholders, plurals, dates, numbers, currencies and links pass.
- Language switching preserves semantic app state.
- English search finds writers and works by English, Russian, native and
  transliterated forms.
- English child mode has no adult or untranslated leak.
- English exact-RC screenshots exist.
- English owner/reviewer instructions exist.
- Bilingual owner approval and post-build guides exist.
- No internal translation TODO is reclassified as owner work.

Store approval cannot be guaranteed. V12 must eliminate all known internal
localization, content, review-access, rights, privacy and technical
blockers before owner submission.

## 12. Final quality strengthening / Финальное усиление

The following are also binding:

- 151 — English style, international en-US base and controlled en-GB overlay;
- 152 — bilingual Web/PWA SEO, canonical, hreflang and stale-index control;
- 153 — synchronized legal texts and controlling-language decision;
- 154 — AI/MT draft governance, provider privacy and human approval;
- 155 — bilingual support, security emails and future notification rules;
- 156 — artifact-bound bilingual release evidence schema;
- 157 — evidence hierarchy for names, titles, quotations and places;
- 158 — weighted translation quality scorecard;
- 159 — per-store locale field matrix;
- 160 — final bilingual owner/reviewer handoff generation.

Bilingual readiness is not established merely by two locale files. It
requires content, child safety, stores, legal/support, web discovery,
offline, search, native surfaces, accessibility, evidence and operations to
match the same exact release candidate.

## 13. Owner-minimal bilingual rule

The owner must never receive a task such as “translate the remaining text”,
“choose an English title without evidence”, “prepare English screenshots”,
“write English review notes” or “fix hreflang”. These are internal Codex /
editorial workflow requirements. The owner only approves concise completed
artifacts and legal/rights decisions.

## 14. Machine-readable and no-return strengthening

Also binding:

- 161 — fail-closed bilingual release-evidence example;
- 162 — translation-assistance provider registry schema;
- 163 — synchronized localized legal document schema;
- 164 — signed/versioned locale package schema;
- 165 — bilingual factual/translation correction workflow;
- 166 — bilingual commands and CI contract;
- 168 — final bilingual no-return contract.

S40 must validate the example/schema pair and prove that content corrections,
legal changes and source edits propagate staleness to every affected English
catalog, search index, offline package, screenshot claim and store dossier.
