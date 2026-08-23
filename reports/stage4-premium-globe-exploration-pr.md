# feat(globe): complete premium Literary Planet exploration

> Stage 4 implementation is complete in source. Frozen V11 visual evidence and the final post-CI-fix targeted, performance and local E2E evidence are recorded below. One pre-existing Windows-only CRLF unit failure requires confirmation by green Linux CI before merge. Automatic merge is forbidden.

## 1. Summary

- Replaces competing camera writes with one cancellable, spherical, optical-inset-aware `GlobeCameraRig`.
- Makes country exploration responsive through R3F event UV, cached focus metrics, separate candidate/hover/selected states and a bounded mip-free highlight texture.
- Adds real keyboard candidate selection, embedded touch page-pan/full-control modes and demand idle rendering.
- Keeps the Canvas stable while presenting desktop overlays and a collapsed/half/expanded mobile country sheet.
- Completes Nobel clustering, explicit writer focus, dynamic coordinates, breadcrumbs and filter-aware Random Literary Journey.
- Preserves one Canvas, Stage 3 immersion/history/focus/scroll contracts and full settled visual quality.
- Keeps `10+ авторов` as a filter and exposes `Крупнейшие архивы` as a separate compact popover action.

## 2. Exact main / Stage 3 SHA

| Ref | SHA |
|---|---|
| Base `origin/main` | `6e4380582ecc47cd82eb428148fb6a90fdcc3d70` |
| Merged Stage 3 PR | `#83` |
| Stage 3 merge commit | `546fb441e9929a54de5dd87b1f63e133871af8df` |
| Stage 3 implementation head | `e9e9d11b1fdbb8fd48bd3d7c86c8c5a60db744a7` |
| Stage 4 head | Pinned by the PR/CI after the final documentation commit; a commit cannot truthfully embed its own SHA. |

## 3. Owner locks

Scope stays inside Literary Planet/Globe. Topline, desktop/mobile Header, Hero/image/typography, main logo geometry and approved Header/Hero layout are not redesigned. Orange/violet palette, journal/museum character, Antique default, antique frame, whales, geography and existing surface assets remain intact. `HEADER-001`, `HEADER-002`, `HERO-001`, `HERO-002` stay OPEN.

Style keys and labels remain `antique → Старинный`, `earth → Современный`, `modern → Классический`. No Mapbox/Cesium/Deck.gl/GSAP/Framer Motion/gesture/clustering/3D-text dependency was added.

## 4. Stage 3 compatibility

The existing `AtlasExperience` surface still owns embedded/immersive presentation, gravity, cosmos, direct/Hero entry, reverse exit, URL/history/Back/Forward, focus trap, `inert`, scroll lock, safe areas and quiet/economical mode. Stage 4 passes `mode` into the same `LiteraryWorldMap → LiteraryGlobe` subtree; it does not create a new route, portal or fullscreen engine.

Existing Stage 3 identity/history suites remain present and the Stage 4 runtime suite marks and rechecks the same Canvas during keyboard, Random, panel, Nobel, writer and rapid-target scenarios.

## 5. Performance baseline

The implementation addresses the measured work categories rather than lowering normal visual quality: duplicate surface raycast, dynamic highlight mipmaps/uploads, mass flag preload, synchronous focus-metric work, perpetual idle frames and duplicate renderer sizing.

Final post-CI-fix measurements: production artifact `114,079,331 / 114,819,072` bytes (headroom `739,741`); excluding book covers `74,504,165 / 75,497,472` (headroom `993,307`); `4323` production files. Runtime probes recorded passive texture uploads `0`, offscreen frames `0` and an Auto OFF frame-counter plateau. Retina DPR `1.5` retained the full 4096×2048 texture tier; compact mobile selected the dedicated 2048×1024 tier.

## 6. Camera architecture

`GlobeCameraRig.tsx` is the only imperative owner of camera position, OrbitControls target, zoom/rotate commands, programmatic flights and settle detection. Camera frame data stays in refs/Three objects; React receives semantic `phase` and `source` only.

Strong intent/source types distinguish `home`, `country-focus`, `country-refocus`, `writer-focus`, `random-focus`, manual/command, auto and projection. New intent tokens supersede old flights instead of queueing them.

## 7. Globe centre / Home model

`globeFocusMath.ts` separates `GLOBE_CENTER = (0,0,0)` from `HOME_ORBIT_TARGET = (0,-0.2,0)` and `HOME_CAMERA_POSITION = (0,0.08,4.9)`. Country/writer geography targets the real sphere centre; Home alone uses the artistic target.

## 8. Spherical trajectory

Direction follows antipodal-safe spherical interpolation; radius and OrbitControls target interpolate separately with restrained cubic ease-out. Exact opposite directions use a deterministic orthogonal axis. `camera.up=(0,1,0)` prevents roll accumulation.

Implemented duration formula:

- desktop: `320–830 ms` near-to-extreme;
- mobile: `280–580 ms`;
- reduced motion: `0 ms`;
- safe radius: minimum `2.25`, maximum country-focus clamp `4.45`.

Unit tests sample near/far/exact-opposite paths, ensure finite normalized direction and verify every sampled radius stays outside the globe.

## 9. Focus metrics

`createGlobeAtlas` caches `CountryFocusMetrics` by country ID. Metrics use unwrapped antimeridian-safe rings, weighted spherical direction, angular extent and principal polygons; tiny remote territories are excluded from the primary envelope. Reviewed fallback coordinates cover Natural Earth omissions/microstates.

Prewarm is deferred until after the ready frame, input-aware and cancellable; heavy polygons are not recomputed on click.

## 10. Optical framing

`ViewInsets` are `top/right/bottom/left`. Selected-country layouts use right insets of 445 px embedded / 470 px immersive on desktop and a 154 px bottom inset on compact layouts. `applyPerspectiveViewInsets` changes projection without modifying camera position or geographic coordinates. The same insets feed the centre-ray reticle, keeping keyboard/coordinate hit testing aligned with the visible free area.

## 11. Cancellation

OrbitControls `onStart`, wheel/drag/touch/pinch through controls, keyboard commands and visible zoom/reset controls synchronously invalidate the active flight token. A cancelled flight cannot settle or resume later. Home is a newest intent. Hidden/offscreen cancels active motion; unmount cleans motion and projection offset. Resize updates projection without restarting an intent.

E2E covers manual drag during a far flight with a 1.7 s no-late-snap window, and rapid Japan → Brazil → high-latitude Iceland through viewport resize with only the last intent settling.

## 12. Pointer optimisation

Surface hover/click uses `ThreeEvent.uv → atlas.countryAtUv`; there is no second manual surface Raycaster. One RAF coalesces pointer-move events, and the updater exits when the effective country ID is unchanged. Manual raycasting remains only for optical centre/view-coordinate tasks.

## 13. Highlight optimisation

Dynamic highlight is `1024×512`, anisotropy `1`, `generateMipmaps=false`, `LinearFilter` min/mag, and redraws only when candidate/hover/selected IDs change. Static map and relief retain mipmaps, `LinearMipmapLinearFilter`, anisotropy `8` and their existing high-quality dimensions/settings.

Candidate, hover and selected outlines are distinct and selected suppresses conflicting lower-priority effects.

## 14. Flag preload

The former bulk queue is absent. A country flag is requested low-priority only while that country is candidate/hovered/selected and redraws only if it is still relevant after decode. Focus metrics, not flags, are prewarmed; optional work pauses for input, camera activity and offscreen state and checks `isInputPending`.

## 15. Country states

Implemented priority is `idle < candidate < hover < selected`. Candidate uses a cool visible outline; hover uses crisp warm orange/bronze; selected uses stronger ivory/gold without neon. R3F pointer gestures distinguish tap from drag. Microstates retain reviewed fallback coordinates, a small visible marker and a larger transparent hit target.

Country context card shows flag, localized country and writer count. Backside marker interaction is rejected in marker layers.

## 16. Keyboard

Arrow commands rotate the globe and activate a real filter-aware candidate. The optical centre hit wins; over ocean the nearest visible selectable country within `π/5` is used. Far/backside candidates are rejected and stable ID breaks ties. Enter selects only an active candidate. A polite RU/EN live region names country, writer count and Enter action.

Unit and E2E evidence cover centre hit, ocean fallback, visibility/filter thresholds, ARIA copy, Arrow → candidate → Enter, matching URL/presentation and stable Canvas.

## 17. Touch

Embedded coarse-pointer default is `page-pan` with disabled OrbitControls and `touch-action: pan-y pinch-zoom`. A clean tap can select; scroll/drag is rejected by the shared gesture tolerance. Explicit «Управлять глобусом» enables `touch-action:none`, one-finger rotate and two-finger globe zoom. «Вернуться к прокрутке» and Escape exit that mode. Immersive coarse-pointer mode enables full gestures directly; offscreen state becomes suspended/passive.

Mobile E2E dispatches real CDP touch sequences for vertical page scroll/no selection, clean tap, horizontal rotate, pinch radius change, activation exit and immersive rotate.

## 18. Auto

User-requested Auto is independent from temporary pause reasons: reduced motion, hidden document, offscreen, selection, hover, interaction and camera flight. Explicit Auto Off never self-enables. Country/Nobel hover pauses Auto; the status/label exposes the reason.

## 19. Frame loop

| Runtime state | Mode / evidence |
|---|---|
| Offscreen/hidden embedded | `never` |
| Idle, Auto OFF | `demand` |
| Auto ON, no pause reason | `always` |
| Camera flight | temporary `always` |
| Damping/manual settle | temporary `always` until actual threshold/safety ceiling |
| Selected settled | `demand` |
| Nobel idle | `demand`; markers never request a pulse loop |
| Reduced motion settled | `demand` |

Starfield/sky/Nobel are deliberately absent from continuous-frame reasons. R3F owns renderer sizing; custom `gl.setSize`/duplicate resize synchronizer is absent.

## 20. Style lifecycle

`useGlobeStyleState` models `requested`, `pending`, `rendered` and failure independently. `aria-pressed` and the active visual class follow rendered style only. Pending keeps the old texture, sets busy/live status and has stable button geometry. Failure preserves the valid surface and provides retry. Request IDs make rapid A→B→C and locale races latest-wins; persistence runs only after successful current render.

Held-texture E2E verifies Antique remains committed while Earth is pending and flips only after the texture is actually rendered.

## 21. Desktop panel

Embedded desktop and immersive context are absolutely positioned overlay drawers. `.atlas-layout.has-country` stays one column and the R3F Canvas remains the same size/identity within the E2E tolerance. Camera projection receives the drawer inset so the country appears in the free left area.

## 22. Mobile peek / sheet

Country selection immediately creates a compact overlay peek with flag, country, writer count and «Открыть архив». The reducer implements `collapsed → half → expanded → collapsed`; collapsed content is `aria-hidden` and `inert`. Full-control exit remains visible above every sheet height. Search/keyboard presentation focuses the visible toggle/panel; pointer manipulation keeps direct focus while the peek remains visible.

The same three-state sheet contract is exercised in embedded and immersive views without replacing/resizing the Canvas.

## 23. Breadcrumbs

`WriterPanel` exposes `Мир › Страна › Writer`. World clears writer/country/Nobel context, sends `home` and updates URL. Country clears writer while preserving country and returns focus to the country presentation. Close context is separate from World.

## 24. Microstates

Countries absent from the Natural Earth surface use reviewed coordinate fallbacks. Candidate/hover/selected states are supported, visible geometry stays restrained and an independent transparent hit sphere makes small states usable. Camera focus clamps microstates at the safe minimum rather than flying through the sphere.

## 25. Nobel

`NobelMarkerLayer` and `nobelMarkerPolicy` provide:

- far country-level marker/cluster with count and year range;
- near individual markers with `3.05/3.35` radius hysteresis;
- selected-writer peel-out;
- deterministic spherical displacement of coincident display positions without source-data mutation;
- finite 160/220 ms event emphasis and no perpetual pulse/frame request;
- localized tooltip and accessible laureate index;
- explicit, separate «Статья о лауреате» action.

Unit tests cover stable IDs/order, dateline proximity, one far marker per country, coincident points, accessible rows, invalid/duplicate data and reduced motion. E2E verifies selection never follows the article link implicitly.

## 26. Writer spatial context

Writer selection updates panel/URL but does not create a writer flight. Validated coordinates expose explicit «Показать на глобусе»; App validates them again, collapses compact sheet, sends `writer-focus` and shows exactly one selected-writer marker while preserving country. Missing coordinates render a neutral unavailable message and no action/marker.

## 27. Dynamic coordinates

Static Moscow/location copy is replaced by context priority: explicit writer → selected country → hover country → optical view centre. `GlobeViewObserver` samples at a bounded minimum 80 ms interval and forces an exact sample after settle. DMS formatting carries rounded `60′`, clamps poles/antimeridian and emits `35°41′ N · 139°41′ E`-style output.

## 28. Random Journey

The secondary immersive action uses `chooseRandomLiteraryDestination`, a pure deterministic helper. It draws only from the current filter, avoids the current country and last three session destinations where possible, then reuses the same `random-focus` camera, URL and country context. There is no roulette animation.

Filters do not rebuild the Atlas. `10+ авторов` remains a semantic filter. `Крупнейшие архивы` is a separate popover listing five largest archives and does not overwrite the active filter.

## 29. Accessibility

The globe region exposes shortcuts and a filter-aware candidate live region. Style/loading/error/auto states have semantic busy/status/alert output. Mobile collapsed content is inert; sheet toggle and touch-control actions are explicit. Nobel has a DOM list path independent of Canvas. Writer action availability depends on validated data. WebGL loading failure offers retry and the textual country index remains available.

RU/EN labels are routed through interface language helpers; state is confirmed through DOM attributes/ARIA rather than color alone.

## 30. Reduced motion

Camera duration becomes zero, Auto is disabled, idle is demand, Atlas entry/exit and panel/sheet animations/transitions are removed, and programmatic Globe-scope scrolling selects `auto` rather than `smooth`. Writer/Random/World use the same immediate controller. Touch direct manipulation remains available.

Evidence includes camera timing unit tests, reduced-motion auto/frame E2E and same-Canvas immediate immersion enter/exit E2E.

## 31. Economical / adaptive quality

Existing economical/Save-Data policy is preserved and reduces decorative particle count, upper DPR/geometry profile and animation while keeping map surface, relief, atmosphere, selection and museum presentation. No interaction-time adaptive DPR/hysteresis was added because the implementation first removes unnecessary work; therefore there is no resolution flashing or delayed quality restore.

## 32. Quality preservation

Normal mode keeps configured DPR, high-detail sphere, static texture mipmaps/anisotropy, relief, atmosphere, material detail, antique frame and existing surface assets. Speed comes from eliminating redundant work: UV reuse, ID-gated highlight redraw, mip-free bounded dynamic texture, on-demand flags, cached/idle focus metrics, demand frame loop and one renderer sizing owner.

## 33. Premium performance & responsiveness — before / after

| Metric | Before | After | Method / evidence |
|---|---:|---:|---|
| Atlas creation / first ready / interactive | Comparable timed Stage 3 trace not available | No timing sampled in the frozen V11 docs pass; one Canvas and ready state verified across the visual matrix | targeted contracts + 16-state visual registry; no numeric claim invented |
| First hover / country switch / selection cue | Comparable timed Stage 3 trace not available | No timing sampled in the frozen V11 docs pass; visible state transitions inspected without error | targeted contracts + visual registry; no numeric claim invented |
| Camera start + near/medium/far/opposite | Competing imperative writes | one controller; desktop `320–830 ms`, mobile `280–580 ms`, reduced motion `0 ms` | source timing contract + targeted unit aggregate |
| Cancellation / rapid latest target | competing writes / late-snap risk | token supersession and manual cancellation contracts implemented | targeted units + premium E2E `22/22` + full E2E `0` failures |
| Pointer surface raycasts | duplicate path | R3F event UV; no second surface Raycaster | source/unit contract |
| Highlight upload / mipmaps | dynamic mipmap work | ID-gated `1024×512`, no mipmaps | source/unit contract |
| Flag requests before interaction | eager/bulk risk | no idle bulk requests | resource E2E |
| Auto OFF idle | perpetual frames | `demand` | policy unit + E2E |
| Resize / Canvas count | competing resize risk | one R3F owner / one Canvas | source + identity E2E |
| Mobile/Retina texture runtime | single quality statement unavailable | mobile 2048×1024 tier; Retina DPR `1.5` full 4096×2048 tier; economical flag did not replace normal inspected quality | runtime probe + visual registry |
| Production artifact / main JS / CSS / globe chunk | Stage 3 artifact audit `114,028,640` bytes | `114,079,331 / 114,819,072` total; main `629,468`, CSS `324,296`, globe `92,507` bytes | final post-CI-fix build + performance audit |

Final post-CI-fix performance details:

- total: `114,079,331 / 114,819,072` bytes; headroom `739,741`;
- excluding book covers: `74,504,165 / 75,497,472` bytes; headroom `993,307`;
- production file count: `4323`;
- passive texture uploads: `0`; offscreen frames: `0`; Auto OFF: frame-counter plateau;
- main JS `index-CakQm7Rv.js`: `629,468` bytes, SHA-256 `5efa0c417538cd1c9ae440394b010860530922dfed2edbe209e305927c6625be`;
- CSS `index-Cvad-RPW.css`: `324,296` bytes, SHA-256 `2317e1bb6354395808e7fe4570783a50232ddac0950b4d75b3675620fcb343ef`;
- globe chunk `LiteraryWorldMap-D8Tss8bM.js`: `92,507` bytes, SHA-256 `f321edf85e8e51fde2b426b741c27cc5f31c83aea162f3cc179afefaaa8005f7`.

Focused SVG/flag QA: 360×800 and 390×844 across antique/earth/modern retained exactly one Canvas and one rendered style; Japan outlines, markers and control SVGs stayed crisp; the mobile sheet no longer exposed duplicate country labels/instructions. Clean selection requested only `jp.svg`; deliberate hover added only `kp.svg`; all `204/204` local flag SVG assets responded successfully; browser warnings/errors `0`.

## 34. Tests

| Проверка | Evidence in tree | Final result |
|---|---|---|
| TypeScript / lint | project scripts | **PASS — public `tsc` and admin `tsc`; interface catalog 1130 entries; i18n 916 phrases / 55 surfaces / 5 approved exceptions** |
| Camera/focus/projection | `GlobeCameraRig`, focus math, projection tests | **PASS — included in targeted aggregate: 19 files / 121 tests** |
| Keyboard/touch/view | observer, keyboard and activation tests | **PASS — included in targeted aggregate: 19 files / 121 tests** |
| Performance/highlight/style | performance, atlas, highlight and style tests | **PASS — included in targeted aggregate: 19 files / 121 tests** |
| Nobel/writer/coordinates/Random | dedicated unit/accessibility tests | **PASS — included in targeted aggregate: 19 files / 121 tests** |
| Full Vitest | `npm test -- --maxWorkers=2` | **LOCAL WINDOWS LIMITATION — 258 files passed / 2 skipped / 1 failed; 1362 tests passed / 2 skipped / 1 failed.** Sole failure: pre-existing CRLF-sensitive `scripts/database/atomic-article-bundle.test.mjs`; tracked migration/test unchanged; green Linux CI required before merge. |
| Premium E2E | `tests/e2e/premium-globe-exploration.spec.mjs` | **PASS — 22/22** |
| Existing globe/Stage 3 regressions | globe-runtime, responsive, immersion suites | **PASS — 31 passed / 9 intentional skips** |
| Full E2E | Playwright full suite | **PASS — 126 passed / 18 intentional skips / 0 failed; 2 workers; 6.4 min** |
| Globe assets | `npm run assets:globe:qa` | **PASS — full 4096×2048 and mobile 2048×1024 texture tiers for antique/earth/modern RU/EN assets** |
| Performance | `npm run performance:audit` | **PASS — 114,079,331 / 114,819,072 bytes, headroom 739,741; excluding covers 74,504,165 / 75,497,472, headroom 993,307; 4323 files** |
| Domain/build/SEO | `npm run build:domain`, domain/SEO audits | **PASS — domain 11319/11319; SEO 5262 ready; 161 pages; 2097 redirects; sitemap 172 URLs; visual runtime console errors 0.** The aggregate Windows release check retains only the documented CRLF-sensitive Vitest failure; Linux CI is required before merge. |
| Diff hygiene | full-tree `git diff --check` | **PASS — final working tree, exit 0; cached-tree verification is repeated immediately before commit.** |

No Stage 4 test uses `.only`; the premium suite contains no `.skip`. Existing viewport-specific skips remain intentional in pre-existing Stage 3 suites and are not introduced to hide Stage 4 coverage. Assertions and performance ceilings are not weakened.

The Quality workflow now uses the Playwright and axe versions frozen by `package-lock.json` instead of downgrading them inline, and its overall job ceiling is `30` minutes so the expanded 144-case browser matrix and failure diagnostics can finish. Worker count, per-test timeout, retries and assertions are unchanged.

The single local Vitest failure is not a Stage 4 regression: on Windows, `scripts/database/atomic-article-bundle.test.mjs` compares CRLF-sensitive fixture text. The tracked migration and test were not changed by Stage 4. This exception is documented, not waived; green Linux CI remains a mandatory merge gate.

## 35. Audit

Source ledger: [`reports/ui-ux-audit.md`](ui-ux-audit.md).

| ID | Status | Source/unit/E2E evidence |
|---|---|---|
| `GLOBE-001` | **CLOSED** | compact overlay peek, focusable toggle/panel, three-state mobile presentation and responsive E2E |
| `GLOBE-002` | **CLOSED** | centre-ray/filter-aware candidate, ocean fallback, Arrow/Enter/live region unit + E2E |
| `GLOBE-003` | **CLOSED** | passive page-pan, explicit control/Escape, tap guard and real touch E2E |
| `GLOBE-004` | **CLOSED** | frame/Auto policy unit, static layers excluded, Auto-Off demand E2E |
| `GLOBE-005` | **CLOSED** | requested/pending/rendered reducer, race/failure unit and held-texture E2E |
| `GLOBE-006` | **CLOSED** | overlay layout, one sizing owner, stable Canvas geometry/identity E2E |
| `GLOBE-007` | **CLOSED** | zero-duration camera, motion-aware CSS/scroll and reduced-motion runtime E2E |

### Audit findings addressed

Closed: `GLOBE-001`, `GLOBE-002`, `GLOBE-003`, `GLOBE-004`, `GLOBE-005`, `GLOBE-006`, `GLOBE-007`.

Owner-locked and intentionally untouched: `HEADER-001`, `HEADER-002`, `HERO-001`, `HERO-002`.

## 36. Visual / motion evidence

Required matrix: `320×800`, `360×800`, `390×844`, `430×932`, `768×1024`, `1024×768`, `1280×800`, `1366×700`, `1366×768`, `1440×900`, `1920×1080`; representative RU/EN; Старинный/Современный/Классический; near/medium/far/opposite/high-latitude/microstate; cancel/latest-wins/Home/writer/Random; keyboard/touch/sheet; reduced motion/forced colors/200% zoom/weak mobile.

- Visual registry: **PASS — 16 PNG covering all 11 required viewports**, RU/EN, embedded/immersive and all three public styles; [`reports/stage4-visual-evidence/README.md`](stage4-visual-evidence/README.md), SHA-256 `2e6659e1122ebc8b5b2a9f60630d73d7951410f755f4f569b2e440aa0ece8a90`; remaining P0/P1 `0`; console errors `0`.
- Motion/touch registry: runtime probes PASS with passive uploads `0`, offscreen frames `0` and Auto OFF plateau; premium E2E `22/22`, full E2E `126 passed / 18 intentional skips / 0 failed`, regression subset `31 passed / 9 intentional skips`.
- Owner-lock comparison: no separate pixel-baseline series was produced in this V11 pass; owner-locked Header/Hero remained visibly present across the 16 captures and still require human PR diff review.

## 37. Future Atlas Expansion

Not included: historical literary timeline, writer travel routes, literary cities, places of novel action, historical borders, worldwide book layer, heatmaps, large author network and era reconstruction.

## One-Canvas report

| Scenario | Implemented result | Evidence |
|---|---|---|
| Embedded | one Canvas | source contract + Stage 3 E2E |
| Immersive | same Canvas | Stage 3 identity E2E |
| Exit | same Canvas on return | Stage 3 identity E2E |
| Rapid exploration | one Canvas; newest camera token wins | premium E2E |
| Random Journey | same Canvas/controller | premium E2E |
| Writer focus | same Canvas/controller; one explicit marker | premium E2E |

## Exact acceptance source

Implementation and evidence contract: [`docs/GLOBE_EXPLORATION_UX.md`](../docs/GLOBE_EXPLORATION_UX.md).

## Review and release policy

- Separate Stage 4 PR.
- Automatic merge is forbidden.
- Merge only after final green CI and human review.
- Stage 5 and Future Atlas Expansion do not start automatically.

Readiness target (assert after green Linux CI confirms the CRLF-sensitive full Vitest gate and human review approves the PR):

`STAGE 4 PREMIUM GLOBE EXPLORATION: READY FOR REVIEW`
