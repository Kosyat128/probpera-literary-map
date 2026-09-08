# Owner content clarification and read-only findings

Owner clarification, 2026-09-08: final catalog nearly 10,000 books; English
biographies; possible later original covers of particular English editions.
Exact total must come from the canonical catalog. No bulk crawl, source count,
performance run or editorial acceptance was performed for this note.

- `src/loading/bookArchiveRuntime.ts` loads a shared catalog lazily. The archive
  and facet indexes still construct synchronously; `BookArchiveSection.tsx`
  increases the visible slice by 13 and accumulates rendered cards. Full-volume
  load/search/memory/navigation need measured acceptance. This inspection alone
  establishes neither a performance failure nor support for 10,000 books.
- `src/data/bookQuality.ts` and `src/data/bookLocalization.ts` retain bilingual
  publication and locale-exact selection. A raw catalog count cannot stand in
  for complete, reviewed Base Edition English coverage.
- `src/data/countries/writerBiographyEnglishTranslations.ts` assigns `reviewed`
  to `machine-translation` after two AI passes; editorial post-edit metadata is
  optional. `src/data/writerBiography.ts` uses the profile quality metadata for
  selection. This is insufficient evidence of the required editorial acceptance.
  Keep English content readiness blocked until draft/review/stale publication
  rules and actual editorial evidence are reconciled. The runtime merge does
  not itself compare the current Russian prose with the stored source hash;
  verify the complete build/correction propagation path when addressing this.
- The work/CMS edition model and archive cover selection currently expose one
  cover per work. A distinct English cover requires language-to-specific-edition
  mapping with title/publisher/year/ISBN when known and provenance/rights evidence.
  Preserve one work identity and the canonical catalog. No such mapping was
  implemented by the appearance pass.

These findings remain open work. New device builds are development artifacts;
they do not accept bilingual content, full-catalog capacity or owner editing.
