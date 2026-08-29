# Stage 5G certification coverage inventory

Initial inventory point: `d473278a7d0617f14b1d50938fda9bab5c464efa` on
`chore/home-stage5g-certification`. The current generated release marker after
the main sync is `c1939a632bc4c3d36649e7c4b2076fcc0711d2c4`. This document is
an evidence map, not a new product claim; the first SHA remains the historical
Stage 5F baseline, while the second is the synchronized artifact source.

The current cumulative interface-copy attestation records both source SHAs and
pins `1,186` interface entries (`keysSha256`
`60b2bb015ee8ad6f6f727a314ee7fe9c02438defb93faea8c550a12f3271f74f`,
`pairsSha256`
`c18d82c71177cb967e61721e4d3285be2241d1ae6a4747c0d1839017a52cad67`)
plus `1,400` private catalogue entries (`keysSha256`
`933287ece7fbbf41edcd5cae84bace76c8b4b80e47ba0789a4f83126cf1bb8b6`,
`contentSha256`
`88285b0ec678388b207fd6a236ad97b4aadaf14f2acb36f8fe8ef3ce89218b57`).

## Repository continuity

Stage 5 is a linear continuation, not a restart:

| Substage | Commit | Existing evidence |
| --- | --- | --- |
| 5A | baseline pinned to `8c240385` | `reports/stage5-baseline/`, `reports/stage5-inventories/` |
| 5B | art direction | `reports/stage5b-art-direction/` |
| 5C | layout and Community | `reports/stage5c-layout-community/` |
| 5D-1 | Complete Shelf frame | `0ed631c5`, `reports/stage5d1-library-frame/` |
| 5D-2 | private collection data | `ceee81cd`, `reports/stage5d2-collection-data/` |
| 5D-3 | virtual shelf | `733929de`, `reports/stage5d3-virtual-shelf/` |
| 5D-4 | inspection/pages | `d7c3eb8a`, `reports/stage5d4-inspection/` |
| 5D-5 | favourites/personal shelves | `e24628f3`; implementation and focused contracts are in source/history |
| 5D-6 | adaptive certification | `dbda3a77`, `reports/stage5d6-certification/` |
| 5E | navigation/motion | `3a30aaf7`, `reports/stage5e-contextual-navigation/` |
| 5F | loading/performance/a11y | `d473278a`, `reports/stage5f-responsive-accessibility/` |

`stage5/integration` is still at `fdd98138`; the later linear commits must be
fast-forwarded only after 5G is green. There is no reason to replay or rewrite
the finished Shelf.

## Requirement-to-evidence map

| Stage 5G requirement | Existing deterministic evidence | Existing browser/report evidence | Remaining 5G evidence |
| --- | --- | --- | --- |
| Header/Hero and Globe architecture stay owner-locked | `src/components/stage5Governance.test.ts`, `headerHeroPresentation.test.ts`, Globe unit/source suites | Stage 5A matrix, Stage 5B, Stage 4 visual package | One final matrix pass; differences are failures, not redesign opportunities |
| Typography, colour, backgrounds and motion | Stage 5 inventories; `stage5b-art-direction.test.mjs`; `uiMotion.test.ts` | Stage 5B captures; 5E report | Record the final reviewer disposition in the 5G roll-up |
| Section order, row alignment and Community geometry | `stage5c-layout-community.test.mjs`, governance landmark order | Stage 5C captures and targeted Playwright | Final 360/768/1440/1920 RU/EN spot matrix; keep same-row landmark delta `<=2px` |
| Contextual navigation, WriterPanel, ArticleReader and exact return | `bookArchiveLocation`, `bookContextNavigation`, `writerPanelAccessibility`, `stage5eScrollOwnership`, ArticleReader source suites | Stage 5E production smoke | Full E2E once after stale source assertions are aligned with the lazy-runtime architecture |
| One logical archive with bounded rendering | `audit-stage5d6-certification` datasets `1/7/12/100/1000/current/10000`; current corpus `9729`, max live set `21`, texture budgets `32/16 + 1 selected` | Stage 5D-3/D-6 browser evidence | No new scale implementation; include fresh audit result in final roll-up |
| Cover identity, text fallback, themes and no audio | `completeShelfTextures`, presentation-profile, scene-theme, approved-presentation and D6 source contracts | Stage 5D-1/D-3/D-6 captures | Final real/fallback cover and theme human review; do not preload all covers |
| Shelf/Catalog, search, filters and 13-item paging | discovery/facet/navigation/control tests; shared search runtime/index tests | Existing archive/search E2E plus D1/D3/D6 captures | Final Shelf and Catalog journeys; current E2E count selectors must address the actual count owner |
| Favourites, manual/smart/editorial shelves and privacy | collection/manager/selector/storage/smart-shelf tests; reader-collection migration and RLS contracts | No complete authenticated browser package is recorded | One final anonymous/local journey plus production-like signed-in/RLS evidence before claiming sync |
| Extraction, open/close, page turns both ways, exact return | inspection session/camera/geometry/texture/editorial-page tests | Stage 5D-4 open/page captures | Final interaction journey at desktop and mobile, including switch-book while inspection is active |
| Responsive, zoom, reduced motion, forced colours and fallback | Stage 5F responsive stylesheet; loading graph; Shelf mobile/detail/quality/state tests | baseline zoom/forced-colour states; Stage 5F smoke | Final 360/768/1440/1920 RU/EN matrix and WebGL-unavailable/Catalog fallback evidence |
| Performance/loading ownership | Stage 5F loading/search/LRU/preload-helper contracts; performance budget audit | Fresh 5F build: initial gzip `215462/307200`, no initial Three/Shelf/full-book/full-search graph | Run the release/performance gate once at the final code head; do not rebuild after evidence-only edits |
| RU/EN completeness | `InterfaceLanguage.test.ts`, `stage5d1InterfaceCoverage.test.ts`, `audit-interface-i18n.mjs` | RU/EN baseline and prior captures | Must be green at final head; 5G initially exposed post-D1 copy missing from the dictionary |
| Owner/content/security locks | Stage 5 governance, content-data lock, RLS/security contracts | Security/RLS reports from earlier stages | Make source/hash tests checkout-portable without weakening hashes; update only genuinely superseded Stage 5 cumulative attestations |

## Minimal missing evidence after 5F

1. Make the one full `release:check` green. The first 5G run exposed two
   categories: CRLF-sensitive source/hash tests and genuinely stale cumulative
   i18n/architecture expectations. SQL, migrations and product behavior must
   not be changed to satisfy a Windows line-ending artifact.
2. Run the complete Playwright suite once on the final production artifact.
   Existing E2E coverage is broad, but the finished 5D Shelf does not yet have
   one consolidated browser journey for all collection, inspection, page-turn,
   fallback and return states.
3. Finish one reviewer matrix at `360`, `768`, `1440`, `1920`, RU and EN,
   including reduced motion, 200% reflow, Shelf, Catalog, search, filters,
   collections, inspection, both page directions and mobile. Reuse the prior
   packages; do not recapture every closed substage.
4. Add the 5G roll-up report with exact head SHA, environment, commands,
   limitations and the required final phrase. A human visual conclusion must
   not be inferred from unit tests.
5. Fast-forward the linear Stage 5 commits into `stage5/integration`, then the
   approved release target, only after the final checks are green.

## Historical failure triage from the first full gate

The following are portability/test-maintenance fixes, not reasons to mutate
production behavior:

- normalize `\r\n?` to `\n` in source-reading tests for premium export, admin
  MFA, social publication, release workflows, atomic article SQL, reviewed RLS
  hotfixes/staff migration and database workflow source;
- compute reviewed SQL SHA-256 after that normalization. The normalized hashes
  match the pinned allowlist (`e148b1...`, `1b03d2...`, `c50cda...`);
- raise the deterministic Stage 5A baseline audit timeout rather than altering
  its pinned artifact when Windows traversal alone exceeds 20 seconds;
- update source assertions for `LiteraryWorldMap`'s composed `setRootNode`,
  Writer work delegation through `openResolvedWriterWork`, asynchronous shared
  cover loading/cancellation, and Shelf query restoration. These are later
  Stage 5 implementations, not regressions to undo.

The true 5G product-certification issue in that first gate was cumulative
English interface coverage. It has since been represented by the current
`STAGE5-FINAL-INTERFACE-COPY` attestation summarized above; the historical D1
fixture and base hashes remain unchanged evidence.

## Exact final commands

The desktop environment needs the bundled Node directory and the installed npm
launcher on `PATH`, because Playwright's preview server invokes `npm`:

```powershell
$env:PATH = 'C:\Users\User\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;C:\Users\User\AppData\Local\Programs\nodejs;' + $env:PATH
Remove-Item Env:PLAYWRIGHT_SUITE -ErrorAction SilentlyContinue
npm run release:check
node node_modules/@playwright/test/cli.js test --config=playwright.config.mjs
git diff --check
```

Do not repeat `release:check` after report-only changes. If the production build
already belongs to the exact final product head, the full E2E command above can
reuse it through Playwright's configured Vite preview.

## Stage 5H / production prerequisites (not a 5G PASS claim)

Production certification starts only after 5G merge and deploy. It requires:

- public and admin deployments tied to exact release SHAs; verify the public
  marker with `EXPECTED_MAIN_SHA=<40-char SHA>` and
  `node scripts/check-deployed-release-head.mjs`;
- `npm run release:smoke:live` against the default HTTPS origins
  `probpera.ru` and `admin.probpera.ru`;
- local domain/SEO artifact gates: `npm run domain:audit` and
  `npm run seo:audit` after `build:domain`;
- production migration/RLS reconciliation evidence, private collection checks,
  cover CORS/WebGL/fallback checks and authenticated journeys;
- service-worker update/cache invalidation, old-JS/new-data recovery, canonical
  HTTP/HTTPS and `www` redirects, robots/sitemap/RSS/static articles/OG,
  security headers and `.well-known/security.txt`;
- a recorded rollback point and rollback drill. These live checks cannot be
  certified from the repository or a local preview.

The 5G roll-up may use `READY FOR OWNER REVIEW` only after the missing local
gates above pass. `PRODUCTION VERIFIED` belongs exclusively to 5H.
