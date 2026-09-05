# CMS typography compatibility

Verified locally on 2026-09-04. No CMS settings were published and no production deployment was performed.

- **33 tests passed across 5 files:** public stylesheet generator, runtime navigation/source contract, admin settings/resolver, admin workflow/source contract and typography audit. Final log: `../.tmp/typography-cms-final-tests.log`.
- **Typography audit: 16 public CSS files, 0 issues.** It checks font families and available weights, dangerous word breaking, clipping of full editorial text, duplicate canonical ownership, token sizes and non-display line heights. The explicitly preserved Header/Hero has narrowly scoped legacy exceptions; article/card/atlas/footer rules remain checked.
- **Admin TypeScript passed:** `npm exec tsc -- --project apps/admin/tsconfig.json --noEmit --incremental false` after workspace dependencies were linked.
- All five CMS layers and four breakpoints remain supported. Tests preserve validated arbitrary sizes including 17, 23, 37 and 61px, uploaded fonts, system-family allowlists and fail-closed invalid settings.
- Published selectors use equal zero specificity and remain outside public default layers. Component/instance heading rules stop at nested component boundaries. Later admin font sources replace earlier sources rather than retaining an obsolete uploaded/system selection.
- Article/page previews and the Studio specimen use the existing 14 local Source font assets. The specimen remains a structural sketch; a live resolved-settings preview was not added.

## Scope and existing limitation

An override wins over defaults on the semantic element it addresses. Inheritance does not overwrite a descendant's own declaration: Chrome verified that a `site/body` setting of 23px Georgia changes `body`, while `.article-copy p` retains its directly declared 16px Source Sans 3. This existing behavior was not expanded into blanket descendant overrides.

Independent review of the CMS diff found no additional high-confidence regression in settings validation, layer ordering, navigation context or font-source replacement. Browser evidence exercises the real generated stylesheet; it does not certify a deployed CMS publication.
