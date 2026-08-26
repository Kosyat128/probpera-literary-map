# Stage 5D-1 Library Frame Architecture

Status: ready for review on `feat/books-stage5d1-frame-architecture`.

## Locked contracts

- `BookArchiveSection` owns query, complete filter state, sort, filtered and visible collections, focus, selection, mode, active collection, related articles, saved state, URL/history and CMS integration.
- Shelf Canvas accepts presentation data and callbacks only; one lazily loaded `frameloop="demand"` Canvas is mounted through the scene inside `#books`.
- Typing remaps the filtered collection and focus; opening detail and writing history require an explicit action.
- Unsupported WebGL, render errors and `webglcontextlost` switch safely to Catalog.
- The controller passes the complete filtered collection to the scene DTO. DOM catalog pagination and the 36-item Canvas working set are independent projections.
- Audio is absent from the complete 5D-1 implementation surface.
- Approved concept: `docs/stage5-reference/STAGE_5_BOOKSHELF_CONCEPT_APPROVED.png`.
- Approved concept SHA-256: `46727D471384D42919F872D53A15C6047E6023EE02414C1300252E02A5DAD0DF`.

## Automated evidence

Focused architecture contract:

```text
vitest run scripts/lib/stage5d1-library-frame.test.mjs
```

Supporting focused suites:

```text
vitest run src/books/bookArchiveFacets.test.ts src/books/bookShelfState.test.ts src/search/globalSearchIndex.test.ts scripts/lib/book-scene-theme-manifest.test.mjs scripts/lib/stage5d1-library-frame.test.mjs
```

The architecture suite verifies controller ownership, one demand Canvas, focus/open/history separation, failure fallback, full/paged/capped collection boundaries, the no-audio lock and the approved concept hash.

## Facet benchmark

Dataset: deterministic synthetic index of 10,000 archive records. Index construction is intentionally measured separately from repeated filter/search queries.

| Target | Result | Status |
| --- | ---: | --- |
| Desktop query p95 `<50 ms` | `4.322 ms` | PASS |
## Certification snapshot

- Complete focused implementation suite: 14 files, 87 tests passed.
- Final architecture, governance and localization rerun: 3 files, 14 tests passed.
- Fail-closed content/data locks: 10 tests passed.
- TypeScript `--noEmit`: passed.
- Public production build: passed; 1,043 modules transformed, 161 article pages and 2,097 redirects generated.
- The lazy WebGL scene produces separate primary and retry chunks, so retry does not reuse a cached rejected import.
- Admin production build: passed.
- Interface inventory: 208 Stage 5D-1 strings covered; 206 translated and two language-neutral date symbols retained identically.
- Browser affected-case matrix: 48/48 passed across desktop and mobile.
- Final scene-label smoke: 7/7 passed in Russian and English.
- Axe: zero violations in Russian desktop, English desktop and Russian mobile checks.
- Browser console, page, request and HTTP errors: zero.

Browser artifacts and machine-readable results are stored in `reports/stage5d1-library-frame/browser/`.

## Fail-closed governance evidence

- Historical Stage 4 and premium-pipeline raw evidence fingerprints remain unchanged.
- The 149 Stage 5D-1 interface additions are pinned by an exact sorted fixture, source/English pair hashes and entry counts.
- The pre-existing 916 interface translations and 1,130 admin catalog entries are independently projected and hashed.
- Code outside the `englishInterfaceText` initializer is pinned by an AST projection hash.
- Stage 4 and premium stable-path projections exclude only the two attested additive localization surfaces.
- The final nine-file book archive owner surface is pinned to its current semantic fingerprint.

The final content-lock run passed all 10 tests.

| Worst measured desktop workload | `9.268 ms` | PASS |
| One-time index build p95 | `657.434 ms` | INFORMATIONAL |
| Balanced mobile query p95 `<100 ms` | `NOT MEASURED` | NOT MEASURED |

The desktop numbers are produced by `node scripts/benchmark-stage5d1-book-facets.mjs`; balanced-mobile hardware was not available and is explicitly not inferred.

## Review marker

```text
STAGE 5D-1 LIBRARY FRAME ARCHITECTURE:
READY FOR REVIEW
```
