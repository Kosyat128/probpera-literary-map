# Stage 5: homepage polish baseline and governance

This document is the immutable Stage 5A governance checkpoint for the public
homepage. Stage 5A records the current product and protects it; it does not
authorize a visible redesign.

Checkpoint date: `2026-08-24` (`Europe/Moscow`).

## Exact start pins

These values describe the accepted Stage 5 start, not a moving reference to the
latest branch tip.

| Pin | Exact value | Evidence |
| --- | --- | --- |
| `BASE_MAIN_SHA` | `8c24038510324d00086afe05b8de78b0f09ae52e` | Fresh `origin/main` used to seed Stage 5 |
| `STAGE_4_MERGE_SHA` | `b5143112a312efa0b6fa0ef0c83a30b4953e8a8a` | Merge commit of PR [#85](https://github.com/Kosyat128/probpera-literary-map/pull/85) |
| Stage 4 reviewed head | `ebc2b17754140c55a4f75a18d44b63fbe44fdf55` | Head merged by PR #85 |
| `PRODUCTION_RELEASE_SHA` | `8c24038510324d00086afe05b8de78b0f09ae52e` | Pages run [32719497676](https://github.com/Kosyat128/probpera-literary-map/actions/runs/32719497676), successful build and deploy |
| `LATEST_GREEN_QUALITY_RUN` | `32719230391` | [Quality and security](https://github.com/Kosyat128/probpera-literary-map/actions/runs/32719230391), success on `BASE_MAIN_SHA` |
| `LATEST_GREEN_PAGES_RUN` | `32719497676` | [Deploy Vite site to GitHub Pages](https://github.com/Kosyat128/probpera-literary-map/actions/runs/32719497676), success on `BASE_MAIN_SHA` |
| `LATEST_GREEN_DATABASE_VERIFICATION` | `32629239152` | [Reconcile production database](https://github.com/Kosyat128/probpera-literary-map/actions/runs/32629239152), success on `158c330daa235b53cc5d8f45466aaf3c8d56cebf` |
| Final content repair verification | `32719272497` | [Fix Bible article metadata](https://github.com/Kosyat128/probpera-literary-map/actions/runs/32719272497), success on `BASE_MAIN_SHA` |
| Integration seed | `5992b3b53a76446910d8c4ec10d5fc517fb874bb` | `stage5/integration`, direct child of `BASE_MAIN_SHA` |
| Stage 5A branch base | `5992b3b53a76446910d8c4ec10d5fc517fb874bb` | `chore/home-stage5a-visual-baseline` at creation |
| Stage 5A reviewed head | `PENDING_UNTIL_PR_HEAD_IS_FINAL` | Must be filled in the Stage 5A PR description; never infer it from a local working tree |

The latest database reconciliation predates `BASE_MAIN_SHA`. No schema or
migration file changed between its verified head and `BASE_MAIN_SHA`; the later
database-related change was a bounded, one-time article metadata repair, and its
own guarded workflow succeeded on `BASE_MAIN_SHA`. This is evidence for the
start gate, not a claim that database verification has run on every future Stage
5 head.

At the checkpoint, PR #85 was merged, Stage 4 was present in fresh `main`, the
exact `main` head had green Quality and Pages deployment, and the release-blocking
metadata repair was complete. Any later movement of `main` must be evaluated
again before the next substage is cut.

## Absolute owner locks

Unless the owner gives a new explicit decision, Stage 5 must not redesign or
rewrite:

- the topline;
- desktop or mobile Header, logo, navigation, actions, and native search;
- Hero image, typography, composition, and the `Открыть глобус` action;
- the Stage 4 Globe architecture: one Canvas, camera rig, focus, filters,
  coordinates, history, controls, frame-loop policy, mobile sheet, and fallbacks;
- visible article titles, body, headings, quotations, conclusions, captions,
  bibliography, ordering, voice, or style;
- canonical literary data, URLs, sources, rights, and editions;
- the premium RU-to-EN source/review/export/provenance pipeline.

`HEADER-001`, `HEADER-002`, `HERO-001`, and `HERO-002` remain owner-approved
exceptions, not work items for Stage 5. No mass language corrector or prose
auto-linker is allowed. New interface copy must use the existing RU/EN interface
catalog.

During 5A-5C the Book Archive is measurement-and-protection scope only. Its
structural implementation begins in 5D under the separate fidelity contract.

## Phase order and scope boundary

The current order is fixed:

```text
5A visual baseline and governance
-> 5B typography, spacing, colors, and backgrounds
-> 5C cards, Book Month, Community, and section order
-> 5D-1 Shelf foundation and CMS controls
-> 5D-2 collections data, sync, and RLS
-> 5D-3 bounded virtual 3D shelf
-> 5D-4 inspection, cover, and page turning
-> 5D-5 Favorites and shelf UI
-> 5D-6 mobile, performance, accessibility, and fidelity certification
-> 5E contextual navigation and motion
-> 5F site-wide responsive, loading, performance, and accessibility
-> 5G combined certification
-> one final owner review and manual merge to main
-> 5H production verification
```

Stage 6 does not start automatically. Stage 5A itself makes no visible redesign
and stops at a reviewable evidence checkpoint.

After 5C the intended homepage order is:

```text
Article Library
-> Authors
-> Sections
-> Calendar
-> Community
-> Trust
-> Footer
```

All public databases remain reachable by normal homepage scroll. Near-viewport
mounting may reduce initial work, but it must preserve stable wrappers, anchors,
direct hashes, semantic loading states, and the absence of a mandatory "load
archive" click. Editorial Standard remains beside Book Month / Book Fact.

## Autonomous integration policy

1. `stage5/integration` is the only Stage 5 aggregation branch and was seeded
   from the pinned fresh `main`.
2. A single Draft PR targets `stage5/integration -> main`.
3. Every 5A-5G branch is cut from the current integration head and its PR targets
   `stage5/integration`, never `main`.
4. A substage may merge automatically only into `stage5/integration`, after all
   mandatory checks are green and no stop condition exists.
5. Before cutting the next substage, compare current `main` with the pinned base.
   Relevant changes are synchronized into integration and affected gates repeat.
6. After 5G, the combined PR becomes ready for one owner review. Merge into
   `main` is always manual.
7. Stage 5H begins only after that owner merge and production deployment.

Stop the chain for an owner-lock or Stage 4 regression, authorial text change,
translation regression, data loss, a second database/search/history system,
RLS/security/privacy failure, unsafe migration, unsolved performance breach,
broken WebGL/Catalog fallback, replaced site cover, or a genuinely new product
decision. An ordinary failing test is first diagnosed and fixed autonomously.

## Evidence protocol

Every artifact must record the exact tested SHA, viewport, locale, state, browser
or measurement environment, capture time, and command/run. Stale Stage 3 or
Stage 4 numbers may be comparative context only; they are not current Stage 5
limits. Unsupported or unavailable measurements are written as `NOT MEASURED`,
never promoted to `PASS`.

Expected evidence locations:

```text
reports/stage5-baseline/
reports/stage5-inventories/
```

Each directory needs a manifest that separates source facts, automated results,
visual captures, human review, and known limitations. Generated evidence must
not silently update this immutable start-pin table.

### Stage 5A capture matrix

- RU full page: `320`, `360`, `390`, `430`, `768`, `1024`, `1280`,
  `1366x700`, `1366x768`, `1440`, and `1920` widths.
- EN full page: `360`, `768`, `1440`, and `1920` widths.
- Close-ups: Header, Hero, Globe, Book area, Book Archive, Article Library,
  Community, Authors, Sections, Calendar, Trust, Footer, WriterPanel,
  ArticleReader, GlobalSearch, Follow Writer, RU/EN book detail, and reading
  library.
- States: default, hover, focus, active, loading, empty, error, expanded,
  selected, disabled, mobile sheet, reduced motion, 200% zoom, and forced colors
  where supported.
- Inventories: typography, spacing, colors, buttons, backgrounds, motion, card
  families, and section landmarks with selector, computed value, viewport,
  locale, and `KEEP` / `TUNE` / `FIX` decision.

## Measured versus pending at document creation

This table is a historical record of what was known when the document was
created. Its statuses are intentionally not rewritten after capture; the
separate closure below records the completed Stage 5A work.

| Item | Status | Honest interpretation |
| --- | --- | --- |
| Fresh-main, Stage 4 merge, Quality, Pages, production, and integration SHAs | `MEASURED` | Exact immutable pins above |
| Quality browser/mobile/accessibility suite on `BASE_MAIN_SHA` | `MEASURED` | Aggregate workflow success; not a substitute for the Stage 5A visual matrix |
| Production performance-budget step on `BASE_MAIN_SHA` | `MEASURED` | Existing budget passed in Quality and Pages; Stage 5A asset inventory values still pending |
| Production database reconciliation | `MEASURED_WITH_SCOPE_NOTE` | Latest successful schema reconciliation is pinned above; it did not run on the future Stage 5A head |
| Stage 5A screenshots and close-ups | `PENDING_EVIDENCE` | No screenshot PASS is claimed by this document |
| Typography/spacing/color/background/motion/card inventories | `PENDING_EVIDENCE` | Populate under `reports/stage5-inventories/` |
| Final-main dist, JS gzip, CSS, Globe chunks, covers/assets, requests, SW cache, and headroom | `PENDING_MEASUREMENT` | Record measured values; do not reuse stale values |
| Human review at all required viewports/locales/states | `PENDING_REVIEW` | Required before Stage 5A PR integration |
| Stage 5A final head SHA | `PENDING_PR` | Pin only after the PR head is final |

## Stage 5A closure

Stage 5A is complete as a no-redesign measurement and governance checkpoint.
This closure does not claim owner approval, a final PR head, or completion of
any later Stage 5 substage. The Stage 5A PR description, rather than this
baseline document, must pin the final reviewed head SHA.

### Deterministic audit and owner-lock evidence

- `node scripts/audit-stage5-baseline.mjs --check` passed its fail-closed check
  for all 16 generated baseline and inventory files.
- The inventory contains exactly `46 KEEP`, `38 TUNE`, and `6 FIX` decisions.
- The source review contains 144 rows and records all 12 current homepage
  sections in their baseline order.
- Stage 4 is locked by a 20-file fingerprint
  `bdf233f3996f069798908abc42e21f13e620a88c2fe293b3aa633004f7f23f60`.
- Book Archive is locked by a 9-file fingerprint
  `0cc93c1437b7829a9657557b4f26038d2e0d79df41b7791160316c168411cd41`.
- The premium translation and health pipeline is locked by a 44-file
  fingerprint
  `2b4bdaa25e526d7839297330befe68f121539443ba68634e3bf036dbae7afe9f`.
- Header/Hero CSS is locked at 221 matching rules with fingerprint
  `952a62f4118a962af3d47fd7e8f614d864c655e08e86148e95681d034d6a2a96`.

The exact production acceptance source is GitHub Pages workflow run
`32719497676`, artifact `9517505146`, release SHA
`8c24038510324d00086afe05b8de78b0f09ae52e`. Its recursive inventory contains
4383 files / 115067016 bytes and has manifest SHA-256
`5cfcdf9e48c6377398dc62bad7aac89d163bda811a3e5a7d3b3d49a963a58ef8`.
The production performance budget passed, including 115067016 / 115081216
total bytes and 75491850 / 75497472 bytes excluding book covers.

The separate integration-worktree build diagnostic also passed at 4320 files /
114199673 bytes. It is classified
`LOCAL_INTEGRATION_WORKTREE_DIAGNOSTIC_NOT_PRODUCTION_ARTIFACT` and has
`acceptanceEvidence=false`; it is not substituted for the exact Pages
artifact.

### Visual evidence closure

The companion package under `reports/stage5-baseline/visual/` contains exactly
47 decoded WebP files: 15 RU/EN anchor matrices, 19 close-ups, and 13 state
captures. Its `manifest.json` SHA-256 is
`b8075ea056e32832c68633b1722d65a27046749b962de955eae3a56a2834c51f`;
the `checksums.sha256` file SHA-256 is
`d709c72e0c1976df6d09dec307acaac829983d17a18d1af9c49d637b2bf50bd6`.
All 47 rasters decoded successfully. All 15 measured pages had
`scrollWidth == clientWidth`, zero failed images, and all 11 expected anchors.

The visual package was rendered read-only in Chrome `151.0.7922.170` from the
exact official Pages artifact served over loopback. That path was used because
the live hashed assets transiently stalled in the capture environment. A later
independent strict-TLS check and cache-bypassing Range GET for the exact JS and
CSS passed, so the transient event is recorded as resolved rather than hidden.
Across 32 recorded browser sessions, product page errors and HTTP response
errors were zero after the blocked read-only RPC and blocked service-worker
registration messages were classified as capture-harness noise.

### Verification status and honest limitations

Only checks actually run for this closure are claimed: the deterministic
baseline check passed; focused Vitest files
`scripts/audit-stage5-baseline.test.mjs` and
`scripts/lib/stage5-content-data-lock.test.mjs` passed 11/11 tests; TypeScript
`tsc --noEmit` passed; and `git diff --check` passed with only the expected
line-ending warnings. These are local Stage 5A verification results, not a
claim that remote CI has run on an as-yet-unpinned PR head. Workflow run
`32719497676` remains the exact green production evidence for `BASE_MAIN_SHA`.

The initial-request browser network trace and runtime service-worker cache
contents remain `NOT MEASURED`. Error-state content, a visible disabled control,
and authenticated Reading Library content also remain `NOT MEASURED`; the
unauthenticated account gate is captured. Computed inventory values remain
`NOT MEASURED` except for explicitly recorded runtime observations. In
particular, `.global-search-trigger` retains focus in forced colors but lacks a
visible outline or box shadow; this is routed as a Stage 5F `FIX` without
changing the Stage 5A Header owner lock. Human/owner review remains pending by
design: this evidence is ready for that review, not a substitute for it.

## Non-negotiable review rules

- No `.skip`, `.only`, assertion deletion, hidden overflow workaround, content
  deletion, budget raise, or quality reduction to manufacture a pass.
- No Header/Hero pixel drift is accepted implicitly.
- No Stage 4 Canvas or history regression is accepted as homepage polish.
- No result is marked green without an exact command/run and exact head SHA.
- The Stage 5A PR records base/head, evidence, limitations, integration target,
  and confirmation that no automatic merge to `main` occurred.

STAGE 5A VISUAL BASELINE:
READY FOR REVIEW

## Stage 5B closure

Stage 5B is complete as a scoped homepage art-direction checkpoint on base
d9a77efee9ce9348569162a91261ece66210283d. The final immutable branch head is
recorded in the substage PR description after commit creation.

### Implemented contract

- Added one late-loaded, homepage-scoped stylesheet with the approved desktop
  and mobile scales for major, normal, card, body, metadata, kicker, and action
  roles. It contains no global h2, h3, p, or button override.
- Normalized the measured excessive Article Library, Trust, and Calendar
  section spacing and removed the Trust disclosure minimum-height outlier.
  Community, author-card, directory-card, and Book Month geometry remain owned
  by Stage 5C.
- Replaced only the Book Month primary-action outlier with the canonical
  --ui-primary / --ui-primary-hover tokens. Semantic error, warning, success,
  Nobel, and artwork colors are untouched.
- Changed Follow Writer backgrounds only. Its dimensions, typography, motion,
  state logic, and Stage 4 WriterPanel architecture are unchanged.
- Added CSS-only PAPER, LIGHT EDITORIAL, VIOLET, and INK fallback surfaces.
  All editable core fallbacks are guarded by :not(.cms-core-editable), while
  the established CMS !important background contract remains authoritative.
- Added no image pack, font, second data layer, translated prose, or new public
  interface copy. Header/Hero, logo/navigation/actions, Open Globe, Globe
  architecture, Book Archive, article content, source data, URLs, and homepage
  section order are unchanged.

### Verification and visual evidence

- Focused Vitest passed 15/15 across the Stage 5B CSS contract, Stage 5 content
  data lock, and homepage CMS tests.
- TypeScript tsc --noEmit passed. A direct Vite diagnostic build passed with
  1029 transformed modules; its CSS artifact measured 329.51 KB raw / 60.23 KB
  gzip.
- The unchanged production-budget audit passed at 106595396 / 115081216 total
  bytes and 67020230 / 75497472 bytes excluding covers. This was a local
  worktree diagnostic, not a replacement for the remote Pages artifact.
- Targeted Playwright passed 2/2: RU desktop 1440x900 and EN mobile 390x844.
  The tests assert every approved type range and line-height, the reduced
  spacing limits, all four background families, and document overflow without
  .skip, .only, assertion deletion, or overflow masking.
- reports/stage5b-art-direction/visual/ contains 12 compact WebP captures and a
  machine-readable manifest from Chrome 151.0.7922.170. Every capture has zero
  horizontal overflow; page/console errors are zero. Human review found no
  clipping, overlap, title-wrap, contrast, or background-layer regression.

Remote mandatory checks are intentionally not claimed here before the PR exists.
Their exact run results, tested head SHA, integration checkpoint, and merge state
are recorded in the PR. The local EN Article Library capture preserves the
current localized empty state; content readiness is governed separately and was
not modified or inferred by Stage 5B.

STAGE 5B TYPOGRAPHY AND ART DIRECTION:
READY FOR REVIEW
