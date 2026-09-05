# I18N ACCESSIBILITY, LAYOUT AND QA / ТЕСТЫ ЛОКАЛИЗАЦИИ

## 1. Coverage gates

Required release coverage:

- Russian UI: 100%;
- English UI: 100%;
- native system strings: 100%;
- Base Edition English content: 100%;
- child content: 100%;
- Planetka text/transcripts: 100%;
- store/reviewer/legal/support: 100%;
- accessibility labels: 100%;
- error/offline states: 100%.

No denominator may exclude hidden but reachable routes.

## 2. Static checks

- hardcoded user text scanner;
- missing/unused key scanner;
- duplicate/conflicting keys;
- placeholder type/count parity;
- ICU syntax and plural categories;
- markup/link/citation parity;
- terminology/glossary lint;
- suspicious untranslated Cyrillic in English UI;
- suspicious raw English placeholder in Russian UI;
- accidental machine comments/TODO;
- locale tag validation;
- URL/slug/canonical validation;
- App Store/Google/RuStore metadata length validation.

Proper names may legitimately contain Cyrillic; whitelist by data field, not
by disabling the scanner globally.

## 3. Pseudolocalization

Add pseudo locales for development:

- expanded Latin strings;
- accented English;
- optional RTL mirror test for future architecture.

Pseudo locales never ship as selectable production languages.

## 4. Layout matrix

Test Russian and English at:

- 320, 360, 390, 430 CSS px;
- tablets/iPad split layouts;
- portrait/landscape;
- 100%, 150%, 200% text scaling;
- long writer/work names;
- store price extremes;
- accessibility font settings;
- keyboard navigation;
- VoiceOver/TalkBack.

No truncation may hide a purchase, privacy, age or Parent Gate meaning.

## 5. Runtime tests

For each locale:

- clean install;
- first-run locale negotiation;
- manual switch on every major route;
- app restart;
- saved child restart;
- offline start;
- globe interaction;
- search in both scripts;
- deep links;
- purchase, pending, cancel and restore;
- account deletion if enabled;
- errors and backend outage;
- background/foreground;
- WebGL context recovery;
- downloads and content updates.

## 6. Visual regression

Capture deterministic screenshots for every critical state in Russian and
English. Compare layout, missing fonts, clipping, wrong asset and language
mix. Baselines are tied to exact build/content/catalog hashes.

## 7. Fonts

- embedded/web fonts support Cyrillic and Latin glyphs;
- no missing glyph/tofu;
- consistent metrics;
- bold/italic coverage;
- license permits app/web embedding;
- system fallback preserves readability;
- do not distribute font files outside licensed product artifacts.

## 8. Search tests

Test aliases, transliteration, diacritics, punctuation, apostrophes,
hyphens, initials, surname order and same-name collisions. Child index
policy is tested after alias resolution.

## 9. Native/store tests

- iOS per-app language;
- Android per-app language;
- localized app label;
- share/system/native screens;
- Apple/Google localized metadata API dry-run;
- localized exact-build screenshots;
- RuStore Russian moderation plus English in-app selection;
- review notes match actual button labels.

## 10. Release blocker

Any critical missing key, mixed-language screen, wrong factual title,
English child leak, unlocalized legal/purchase text, broken locale switch or
store/binary language mismatch blocks release.
