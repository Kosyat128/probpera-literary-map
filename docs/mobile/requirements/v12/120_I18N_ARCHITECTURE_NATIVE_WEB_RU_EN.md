# I18N ARCHITECTURE FOR WEB, ANDROID AND IOS / АРХИТЕКТУРА ЛОКАЛИЗАЦИИ

## 1. Shared TypeScript layer

Use one type-safe localization package for the React/Three.js application.
If the repository already has a sound i18n system, extend it rather than
replace it. Otherwise implement an ICU MessageFormat-compatible solution
with:

- stable semantic message keys;
- generated TypeScript key types;
- source comments/context;
- plural/select support;
- placeholder type checks;
- HTML/Markdown-safe rich text components;
- catalog compilation;
- locale lazy loading;
- missing-key failure in CI;
- no user-facing hardcoded string scanner.

Do not concatenate translated fragments to build sentences.

## 2. Catalog structure

```text
packages/i18n/
  src/
    locales/ru/
    locales/en/
    glossary/
    generated/
  schemas/
  scripts/
  tests/
```

Recommended domains:

- common;
- navigation;
- globe;
- writers;
- works;
- search;
- child;
- parent;
- planetka;
- customization;
- store;
- downloads;
- account;
- privacy;
- errors;
- admin;
- accessibility.

## 3. Native iOS surfaces

Localize native/system-facing strings with current Xcode localization
mechanisms, including String Catalogs where appropriate:

- app display name;
- permission usage strings, although sensitive permissions should remain
  absent;
- system dialogs;
- share sheets/custom activities;
- widgets/shortcuts if implemented;
- notifications only if a future approved release enables them;
- native error/restore messages;
- Settings bundle entries;
- accessibility labels outside the web layer.

Ensure the app declares Russian and English so users can select a per-app
language in system settings. A system language change and in-app selector
must reconcile deterministically.

## 4. Native Android surfaces

- provide complete default `values/strings.xml` resources;
- provide Russian and English resource sets;
- declare supported locales through current Android/AGP localeConfig
  mechanism;
- include only `ru` and `en` resources from app/dependencies where
  practical;
- expose Android 13+ per-app language settings;
- use localized app label, shortcuts, system dialogs and accessibility;
- test unsupported system locale fallback;
- never omit default resources because it can cause runtime failure.

## 5. Web/PWA

- set `<html lang>` dynamically before content render;
- expose localized title, description, Open Graph and structured metadata;
- use locale-prefixed routes where content is indexable;
- generate `hreflang` alternates and one canonical strategy;
- preserve deep link entity IDs across locales;
- localize PWA install text/shortcuts where supported;
- isolate service-worker caches by locale/content version;
- avoid duplicate crawlable pages with identical language metadata;
- return correct language on server/prerender, not only after hydration.

## 6. Formatting

Use locale-aware APIs for:

- dates and years;
- numbers;
- currencies/prices;
- lists;
- relative time only where needed;
- sorting/collation;
- region/language display names.

Never hardcode comma/decimal separators, month names or currency symbols.
Store price remains the localized price returned by the store SDK.

## 7. Images and 3D assets

Avoid baked user-facing text. Use dynamic localized overlays. Historical
map/globe inscriptions are artifacts and remain original; provide an
accessible localized explanation rather than altering the source object.

When localized image variants are unavoidable:

- same asset ID;
- explicit locale;
- source/rights record;
- dimensions and visual parity;
- no text overflow;
- fallback;
- checksum.

## 8. Security

Translation packages and remote content manifests are signed/checksummed.
Do not execute code from translation files. Escape untrusted markup and
allow only a documented rich-text token set.

## 9. Performance

- load current UI catalog during bootstrap;
- lazy-load heavy literary content by locale;
- deduplicate common images/3D/audio;
- do not download both full languages unless user requests offline access;
- keep a small English/Russian emergency error catalog in the app binary;
- locale switching must not leak old catalog listeners or double-render the
  globe.

## 10. CI commands

Create repository-appropriate equivalents of:

```text
i18n:extract
i18n:types
i18n:lint
i18n:placeholders
i18n:hardcoded
i18n:pseudo
i18n:coverage
i18n:native
i18n:web-seo
i18n:all
```

All commands emit machine-readable evidence and fail closed for release.

## 11. Same-renderer invariant

The Russian/English language switch must preserve the same WebGL/R3F Canvas,
renderer, camera owner and live LiteraryGlobe instance. It may replace text
catalogs and localized content fields, but it must not mount a second globe,
reset camera intent, recreate the selected entity or lose child/purchase state.
