# BILINGUAL WEB/PWA SEO AND DISCOVERY / SEO ДЛЯ RU/EN V12

## 1. URL architecture

Use stable locale routes for indexable content:

```text
/ru/...
/en/...
```

Entity IDs remain language-neutral. Human-readable slugs may be localized,
but aliases redirect to one canonical locale URL without losing the entity.
Do not create two independent content records.

## 2. Language annotations

For every equivalent public page generate:

- correct `<html lang>`;
- self-canonical URL;
- reciprocal `hreflang="ru"` and `hreflang="en"`;
- `x-default` only for a real neutral language chooser/default route;
- localized sitemap entries;
- language-consistent Open Graph/Twitter/structured data.

Do not canonicalize every English page to Russian; that would erase the
English search surface. Do not mark translated pages as duplicates when they
are genuine localized equivalents.

## 3. Rendering and negotiation

Search crawlers and users must receive the correct language in server render
or prerendered output, not only after hydration. Avoid forced IP redirects.
A neutral root may negotiate once and expose a visible language switch.
Preserve user choice and deep links.

## 4. Metadata

Localize:

- title and description;
- breadcrumbs;
- writer/work/country structured data where applicable;
- image alt text and captions;
- social cards;
- 404/410 pages;
- PWA name, short name and shortcuts where platform support permits.

Facts, dates and entity relationships remain identical across languages.

## 5. Indexability and translation status

Only `APPROVED/PUBLISHED` English pages are indexable. Draft, stale,
rights-blocked or incomplete translations use non-indexable preview routes.
Do not publish thin placeholder English pages merely to increase URL count.

## 6. Internal linking

- Link within the active locale where an approved page exists.
- Keep language switch as the equivalent entity/page, not the home page.
- English search results never open a Russian-only critical route without an
  explicit localized availability message.
- Optional packs hidden in English are absent from English navigation and
  structured data.

## 7. Performance

Share images/3D common assets, but isolate text/search/offline locale
packages. Prevent duplicate downloads after switching. Track Core Web
Vitals per locale without child behavioral profiling.

## 8. Discovery QA

Test:

- canonical/hreflang reciprocity;
- sitemap coverage;
- status codes and redirects;
- localized metadata/body match;
- no mixed-language title/snippet;
- no duplicate entity IDs;
- stable search aliases;
- social card language;
- crawl without JavaScript where supported;
- PWA offline routes for both languages.

## 9. Release blocker

Missing reciprocal hreflang, English metadata over Russian content, forced
IP redirect, stale translation indexing, false localized facts, broken
locale switch, duplicate canonical strategy or English page without support/
legal readiness blocks public English web rollout.
