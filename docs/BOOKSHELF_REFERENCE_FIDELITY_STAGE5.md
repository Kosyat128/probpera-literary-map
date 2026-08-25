# Stage 5 BookShelf reference-fidelity contract

This document translates the approved Shelf concept and the Stage 5 written
contract into reviewable constraints. It does not certify an implementation and
does not authorize Book Archive source changes during Stage 5A-5C.

## Exact baseline and reference pins

| Pin | Exact value |
| --- | --- |
| Stage 5 `BASE_MAIN_SHA` | `8c24038510324d00086afe05b8de78b0f09ae52e` |
| Stage 4 merge | `b5143112a312efa0b6fa0ef0c83a30b4953e8a8a` |
| Integration seed | `5992b3b53a76446910d8c4ec10d5fc517fb874bb` |
| Approved concept | [`stage5-reference/STAGE_5_BOOKSHELF_CONCEPT_APPROVED.png`](stage5-reference/STAGE_5_BOOKSHELF_CONCEPT_APPROVED.png) |
| Approved concept SHA-256 | `46727D471384D42919F872D53A15C6047E6023EE02414C1300252E02A5DAD0DF` |
| Approved concept byte size | `2159063` |
| Reference manifest | [`stage5-reference/README.md`](stage5-reference/README.md) |
| Stage 5D certification head | `PENDING_UNTIL_5D6_PR_HEAD_IS_FINAL` |

The image is the primary visual composition reference because the owner-provided
asset is available and its byte identity is pinned. The written constraints in
this document remain authoritative for behavior, accessibility, data ownership,
security, and explicitly rejected layouts.

Interaction references:

- <https://threeui.com/hero/complete-shelf-landing-page>
- <https://github.com/MengTo/complete-shelf>

They are technical and interaction references, not permission to copy source,
HTML, embedded assets, covers, audio, or brand identity. The implementation must
be independent React/R3F code integrated with Probpera's existing systems.

## Owner-locked composition

The approved layout keeps:

- one deep-violet/ink library frame;
- `Полка / Каталог` and an integrated search field in the top rail;
- compact quick filters beside that rail, with advanced collections/filters in
  a menu, panel, or sheet;
- one book-dominant stage with negative space, one large central book, and
  neighbouring books on the active shelf;
- the existing tall detail panel on the right;
- a thin bottom rail with previous/next, `N из M`, Favorite, and Add-to-shelf;
- Probpera orange as the primary interactive accent;
- a modern, stocked, multi-row library behind the active shelf as scene depth,
  not as a second browsable archive.

The following are rejected unless the owner makes a new explicit decision:

- a persistent large left collection sidebar;
- a second app-wide Header inside Book Archive;
- dashboard panels surrounding the scene;
- oversized statistic cards;
- a lounge/showroom layout that displaces the shelf;
- recoloring real covers to force palette uniformity;
- treating background shelf rows as a second data or selection system.

Allowed improvement is quality-only: deeper modern library scenery, more stocked
background rows, better lighting and materials, natural book-color diversity,
responsive framing, and higher safe 3D quality while the approved geometry stays
recognizable. A major layout change is a stop condition.

## Existing system ownership

`BookArchiveSection` remains the controller. Preserve the existing canonical
model and behavior:

- `BookArchiveEntry`, `bookArchiveKey`, queue classification, verified/pending,
  classic/modern, rights, sources, editions, ISBN, and article relations;
- the single book database and current CMS/Supabase publication path;
- current archive counts, search semantics, `selectedBook`, full detail, CMS
  direct-edit capability, comments/ratings, author/country actions, and RU/EN;
- `?book=...#books`, Back/Forward, reading library, and the existing shared
  GlobalSearch index where full-archive scope is needed;
- site-uploaded covers as primary truth and deterministic premium text covers
  only when an image is absent or unsafe.

There must be no second book database, second global search, second history
stack, or unsynchronized shelf-cover registry. User shelf titles are not
automatically translated. Personal shelves are private by default.

The homepage Header/Hero, authorial content, Stage 4 Globe, and premium RU-to-EN
pipeline retain the owner locks recorded in
[`HOMEPAGE_POLISH_STAGE5.md`](HOMEPAGE_POLISH_STAGE5.md).

## Delivery order

Book Archive is measured and protected in 5A-5C. Implementation proceeds only
in this order:

1. **5D-1:** `BookShelfFrame`, Shelf/Catalog modes, integrated DOM search,
   filters, theme contracts, and guarded CMS settings.
2. **5D-2:** Favorites, reading/manual/smart/editorial collection data,
   anonymous-to-account sync, migrations, RLS, and privacy.
3. **5D-3:** continuous browsing and a bounded virtual 3D shelf for the full
   logical archive.
4. **5D-4:** exact extraction, inspection, cover opening/closing, page turning,
   and exact return.
5. **5D-5:** collection switcher, Favorite/Add-to-shelf, management, URL/history,
   empty/missing states, and optimistic UI.
6. **5D-6:** mobile, performance, accessibility, fallback, and strict reference
   certification.

5E may polish contextual Shelf navigation only after 5D is coherent. 5F repeats
site-wide responsive/loading/accessibility gates. 5G performs combined
certification. 5H verifies production only after the final manual owner merge.

## Technical fidelity contract

The independently implemented Shelf must provide:

- continuous wheel, trackpad, keyboard, previous/next, and position browsing;
- deterministic central focus and single-click selection;
- bounded virtualization/recycling: the complete logical result is accessible
  while live meshes, materials, and textures stay bounded;
- extraction from the exact focused pose and the same physical volume in
  inspection;
- bounded orbit/pan/zoom;
- a closed-by-default book with hover crack, click/drag opening, drag closing,
  forward/back page turns, committed settling, and deterministic return;
- separate boards, spine, hinges, shoulders, endpapers, page block, sheets,
  edges, headbands, and optional bookmark;
- separate front/spine/back artwork with no mirrored text;
- PBR cloth, paper, and shelf materials without compromising real cover art;
- explicit state transitions with time-based exact endpoints and interruption
  handling;
- semantic DOM controls/status, reduced motion, narrow responsive layout, and
  zero console errors;
- no audio files, controls, requests, preload, or runtime dependency.

The interaction state machine must have one owner for focus/selection and make
browsing, focusing, extracting, inspecting, opening, page-turning, closing,
returning, and fallback states explicit. Close/Escape/Back cancels transient
gestures and restores collection, filters, focused/selected book, camera, pose,
theme, URL/history, and scroll/page context where reliable.

## Typography and motion pins

Only `BookShelfFrame` may add this font scope:

```css
--shelf-ui-font: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI",
  Helvetica, Arial, sans-serif;
--shelf-editorial-font: "Iowan Old Style", "Baskerville",
  "Times New Roman", serif;
--shelf-ease-out: cubic-bezier(0.2, 0.72, 0.24, 1);
```

Inter must include Cyrillic, use weights 400/500/600, be self-hosted under an
open licence, use `font-display: swap`, and remain lazy/near-viewport so it never
blocks Hero. Proprietary Iowan Old Style must not be bundled without a licence.
UI controls use Inter; book and collection editorial text use the serif stack.

Motion targets:

| Motion | Target |
| --- | --- |
| background/theme | `720 ms` |
| theme-safe UI color | `520 ms` |
| Canvas reveal | `900 ms` |
| control rail opacity / transform | `500 ms` / `700 ms` |
| detail reveal | `620 ms` |
| button hover/press | `180 ms` |
| position marker | `220-260 ms` |
| hover label | about `120 ms` |
| shelf to inspection / return | `920 ms` / `920 ms` |

Capture `0/25/50/75/100%` for focus, extraction, detail, cover, page, return,
and theme transitions. Reduced motion is instant or fade-only without lost
function.

## Cover, environment, and data fidelity

- Real site-uploaded cover artwork is exact and must not be recolored, mirrored,
  replaced, or baked into unrelated geometry.
- Fallback covers are deterministic, stable, readable, and premium; they never
  masquerade as a real edition image.
- Classic, post-war, contemporary/bestseller, and verified children's books may
  use different geometry/material presentation profiles, but profiles never
  change canonical cover identity.
- Children's filters use verified metadata only; visual style cannot classify a
  book as children's literature.
- Per-book backgrounds are mandatory for focused/inspection states. Collection
  background is the base; the selected book supplies a bounded palette/light
  accent.
- Background shelves show naturally diverse books for depth but are not another
  archive, query result, cover registry, or interaction target.

## Responsive, accessibility, and fallback fidelity

Required certification viewports are `1440x900`, `1920x1080`, `768x1024`, and
`390x844`, with the wider Stage 5 RU/EN matrix applied where relevant. Mobile
keeps search, mode, filters, scene, and bottom rail; advanced panels become
bottom sheets while part of the scene remains visible.

The Catalog mode is a first-class accessible fallback, not a degraded data set.
WebGL context loss, renderer/texture failure, reduced motion, Save-Data, low
capability, keyboard-only input, zoom, and screen-reader flows preserve query,
filters, collection, selection, URL, and saved state.

Semantic DOM equivalents are required for current book, previous/next, position,
writer/country/status, open/close, pages, mode, collection, search, filters, and
save actions. Live announcements must be useful and rate-limited.

Quality profiles are `HIGH`, `BALANCED`, and `ECONOMY`. They may bound live book
count, resolution, shadow quality, page segments, environment LOD, cache, and
DPR. They may not reduce logical content, text, accessibility, settled normal
quality, or cover identity. Continuous rendering is allowed only during active
motion; idle and offscreen continuous reasons must return to zero.

## Fidelity evidence and decision rule

Every comparison records exact base/head SHA, concept SHA, viewport, locale,
quality profile, browser/GPU environment, state, capture time, and limitations.
Evidence must cover:

- top and bottom rails, book scale, negative space, central title, right detail,
  circular controls, and approved concept composition;
- HIGH/BALANCED/ECONOMY modern background library depth and stocked rows;
- real and fallback classic, post-war, contemporary, bestseller, children, and
  intentionally mixed shelves;
- search, filters, author/country/genre/children collections, far jumps,
  Favorites, manual/smart/editorial shelves, inspection, crack, open, both page
  directions, close, return, mobile, Catalog, reduced motion, and fallback;
- live logical count versus bounded meshes/draw calls/textures/GPU estimate,
  asset/chunk size, first mount, input latency, idle plateau, and service-worker
  behavior for `1`, `7`, `12`, `100`, `1000`, current full, and `10k` logical
  entries.

Allowed visual differences are Probpera branding, RU/EN localization, real site
data/covers, integrated filters/collections, removed audio, and responsive
adaptation. Geometry drift, a persistent left dashboard, real-cover recoloring,
or replacement of the single canonical systems is a failure or owner stop.

## Measured versus pending at document creation

This table is retained as the historical at-document-creation state. The Stage
5A-only closure below records later evidence without converting future 5C, 5D,
or 5H work into a pass.

| Item | Status | Interpretation |
| --- | --- | --- |
| Approved PNG SHA-256 and byte size | `MEASURED` | Byte identity verified before repository copy |
| Stage 5 base, Stage 4 merge, and integration seed | `MEASURED` | Exact immutable Git pins |
| Approved layout requirements and rejected variants | `OWNER_LOCKED` | Review contract, not an implementation claim |
| Existing-main Quality run | `MEASURED` | Baseline regressions green on `BASE_MAIN_SHA`; no future Shelf fidelity is implied |
| Stage 5A/5C Book Archive baseline captures | `PENDING_EVIDENCE` | Must be captured before structural 5D work |
| 5D state machine, virtualization, inspection, pages, and exact return | `NOT_IMPLEMENTED_OR_CERTIFIED_HERE` | Belongs to 5D-1 through 5D-6 |
| Fidelity matrix at all viewports/locales/profiles | `PENDING_5D6` | No visual PASS claimed by this document |
| Mesh/texture/GPU/latency/idle/service-worker measurements | `PENDING_5D6` | Values must be measured; no budget may be invented or raised |
| RLS, anonymous sync, personal shelf privacy | `PENDING_5D2` | Requires guarded migration and production-like verification |
| Production WebGL/CORS/service-worker/rollback | `PENDING_5H` | Starts only after final owner merge |

## Stage 5A Book Archive closure

Stage 5A measured and protected the existing Book Archive; it did not implement
the approved Shelf. The 9 owner-locked Book Archive files reproduce fingerprint
`0cc93c1437b7829a9657557b4f26038d2e0d79df41b7791160316c168411cd41`,
and the deterministic baseline check passed. No second book database, global
search, history stack, or cover registry was introduced.

The visual package is pinned to GitHub Pages run `32719497676`, official
artifact `9517505146`, and release SHA
`8c24038510324d00086afe05b8de78b0f09ae52e`. Its 47 WebP files include the Book
area, Book Archive, RU detail, EN detail, and unauthenticated Reading Library
gate close-ups, as well as 15 RU/EN homepage anchor matrices. The package
manifest SHA-256 is
`b8075ea056e32832c68633b1722d65a27046749b962de955eae3a56a2834c51f`
and the checksum-file SHA-256 is
`d709c72e0c1976df6d09dec307acaac829983d17a18d1af9c49d637b2bf50bd6`.
The exact production artifact contains 4383 files / 115067016 bytes with
manifest SHA-256
`5cfcdf9e48c6377398dc62bad7aac89d163bda811a3e5a7d3b3d49a963a58ef8`.

Error-state content, a visible disabled Book Archive control, and authenticated
Reading Library content remain `NOT MEASURED`. The Stage 5C post-polish
recapture remains `PENDING_EVIDENCE`. All Shelf state-machine, virtualization,
inspection, page, fidelity, RLS/privacy, and performance certifications remain
`PENDING_5D*`; production WebGL/CORS/service-worker/rollback verification
remains `PENDING_5H`. This Stage 5A closure supplies a reviewable baseline only
and makes no 5D implementation or visual-fidelity PASS claim.

## Integration and approval policy

Each 5D substage is a short-lived branch and PR into `stage5/integration`.
Automatic merge is permitted only into that integration branch after mandatory
checks and absence of stop conditions. The combined Stage 5 PR into `main`
requires one manual owner review/merge. No partial Shelf reaches `main`, Stage 5H
does not start early, and Stage 6 never starts automatically.

Final certification must be able to state truthfully, with linked evidence:

```text
APPROVED CONCEPT LAYOUT DRIFT 0
PERSISTENT LEFT DASHBOARD SIDEBAR 0
SECOND BOOK DATABASE 0
SECOND GLOBAL SEARCH 0
10K LIVE MESHES 0
LIVE MESHES BOUNDED
SITE COVERS PRIMARY
REAL COVER RECOLORING 0
BACKGROUND SHELVES AS SECOND ARCHIVE 0
INTEGRATED DOM SEARCH PASS
EXISTING DETAIL PRESERVED
COVER OPEN/CLOSE-BY-DRAG PASS
PAGES BOTH DIRECTIONS PASS
RETURN JUMP 0
IDLE CONTINUOUS FRAMES 0
AUDIO REQUESTS 0
```

Until those measurements exist, their status is `PENDING`, not `PASS`.
