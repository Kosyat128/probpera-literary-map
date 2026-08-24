# Premium Globe Exploration UX

## Статус и границы

Этот документ фиксирует фактическую реализацию Stage 4 и её проверяемые контракты. Он не подменяет финальный QA и не разрешает automatic merge.

| Поле | Значение |
|---|---|
| Stage | `4 — Premium Globe Exploration UX` |
| Branch | `codex/premium-globe-exploration` |
| Base `main` | `6e4380582ecc47cd82eb428148fb6a90fdcc3d70` |
| Merged Stage 3 | `546fb441e9929a54de5dd87b1f63e133871af8df` (PR #83) |
| Implementation | **COMPLETE IN SOURCE** |
| Final QA | **LOCAL FINAL QA COMPLETE WITH ONE KNOWN PLATFORM LIMITATION:** public/admin TypeScript PASS; targeted Stage 4 units `19 files / 121 tests` PASS; premium E2E `22/22` PASS; full E2E `126 passed / 18 intentional skips / 0 failed`; final post-CI-fix performance and frozen V11 visual registries PASS. Full Vitest has one pre-existing Windows-only CRLF failure described below; green Linux CI is required before merge. |
| Merge | Только ручной merge после review; automatic merge запрещён |
| Next stage | Stage 5 и Future Atlas Expansion автоматически не начинать |

Stage 4 ограничен Литературной планетой и глобусом. Topline, desktop/mobile Header, Hero, Hero image, Hero typography, logo и исторически утверждённая геометрия Header/Hero остаются owner-locked. Findings `HEADER-001`, `HEADER-002`, `HERO-001`, `HERO-002` этим этапом не закрываются.

Сохранены orange/violet palette, museum/journal character, `antique` как фирменный default, antique frame, whales, существующая география и surface assets. Internal keys и публичная семантика не изменены:

- `antique → Старинный`;
- `earth → Современный`;
- `modern → Классический`.

Новые тяжёлые 3D, camera, gesture или animation libraries не добавлены.

## One-Canvas и совместимость со Stage 3

`LiteraryWorldMap` по-прежнему монтирует ровно один `LiteraryGlobe`, а `LiteraryGlobe.tsx` содержит ровно один R3F `<Canvas>`. Presentation переключается через `mode`, `data-atlas-view` и существующую Stage 3 surface; отдельные embedded/immersive/mobile engines, portal, fullscreen route и reparent Canvas не добавлены.

Один Canvas обслуживает:

- `embedded → immersive → embedded`;
- последовательный выбор стран и смену фильтра;
- Random Literary Journey;
- country/writer focus;
- Nobel context.

Filter и country selection меняют данные взаимодействия и highlight, но не пересоздают Canvas. `createGlobeAtlas` зависит от полного `atlasCountries`, поэтому фильтрация selectable collection не перестраивает Atlas. Country panel и mobile sheet являются overlays; поздний CSS-контракт оставляет `.atlas-layout.has-country` одноколоночным, а desktop presentation позиционирует абсолютно.

Сохраняются Stage 3 gravity/cosmos, direct и Hero entry, reverse exit, Back/Forward и `atlasView`, focus trap, `inert`, scroll lock, safe areas, quiet/economical mode. URL хранит semantic `atlas`, `atlasView`, `country`, `writer`; raw camera state в URL не записывается.

Evidence:

- `src/components/LiteraryWorldMap.tsx` и `src/components/LiteraryGlobe.tsx`;
- `src/atlas/useAtlasExperience.ts`;
- `src/components/globeAccessibility.test.ts` — single R3F Canvas owner;
- `tests/e2e/literary-planet-immersion.spec.mjs` — same-Canvas enter/exit/history;
- `tests/e2e/premium-globe-exploration.spec.mjs` — Canvas identity при keyboard, Random, panel, Nobel, writer и rapid selection.

## Единый camera controller

`GlobeCameraRig` — единственный imperative owner позиции камеры, `OrbitControls.target`, zoom/rotate commands и programmatic flights. React хранит semantic phase/source; frame position, quaternion, target, flight token и settling samples живут в refs/Three objects.

Поддержаны semantic intents:

- `home`;
- `country-focus`;
- `country-refocus`;
- `writer-focus`;
- `random-focus`;
- manual/command cancellation, visibility/offscreen cancellation и superseding.

`GLOBE_CENTER = (0, 0, 0)` отделён от `HOME_ORBIT_TARGET = (0, -0.2, 0)`. Home имеет отдельные position/target; geography никогда не подменяется художественным offset.

### Траектория, timing и безопасность

Direction интерполируется `stableSphericalDirection`, radius — отдельно. Для exact-opposite используется детерминированная ортогональная ось; прямой XYZ chord lerp не применяется. Каждый sample ограничен `GLOBE_SAFE_CAMERA_RADIUS = 2.25`, максимальный country focus — `4.45`; `camera.up` возвращается к `(0, 1, 0)`, roll не накапливается.

| Сценарий | Реализованный timing contract |
|---|---|
| Desktop near → extreme | `320–830 ms`, distance-aware cubic ease-out |
| Mobile near → extreme | `280–580 ms` |
| Reduced motion | `0 ms`, final sample применяется сразу |
| Manual cancellation | синхронное обнуление flight token на OrbitControls `onStart`/command |
| Rapid targets | новый intent отменяет прежний; queue отсутствует |
| Settle | actual position/target/quaternion threshold: 3 stable frames, safety ceiling 1500 ms |

Pointer drag/wheel/touch/pinch, keyboard rotate/zoom/Home и visible zoom/reset controls проходят через единственного owner и отменяют активный flight. Скрытие/offscreen отключает controls и cancels flight; cleanup отменяет flight и очищает projection offset. Resize обновляет projection/insets без restart intent.

Evidence: `GlobeCameraRig.tsx`, `globeFocusMath.ts`, `GlobeCameraRig.test.tsx`, `globeFocusMath.test.ts`, а также E2E manual-cancel и rapid/latest-wins-through-resize.

## Country focus и optical framing

`createGlobeAtlas` кэширует `CountryFocusMetrics` по country ID. Метрики строятся по principal geometry, antimeridian-safe unwrapped rings и area-weighted spherical direction; маленькие удалённые территории не раздувают основной framing. Для отсутствующей Natural Earth geometry используются проверенные microstate fallbacks.

Focus radius учитывает vertical/horizontal FOV и свободную UI-область. `ViewInsets` имеют `top/right/bottom/left`:

- desktop embedded panel: `right: 445`;
- desktop immersive drawer: `right: 470`;
- compact sheet: `bottom: 154`.

`applyPerspectiveViewInsets` смещает projection, не lat/lng и не camera target. `GlobeViewObserver` использует тот же optical reticle для centre ray, keyboard candidate и coordinates, поэтому projection и hit testing согласованы.

Unit evidence охватывает large/microstate clamps, high-distance/opposite path, high-latitude-safe polar clamps, antimeridian geometry, удалённую территорию, optical insets и UV raycast.

## Pointer, states и highlight pipeline

Surface pointer interaction использует уже вычисленный R3F `ThreeEvent.uv → atlas.countryAtUv`; второго manual surface `Raycaster` нет. Один requestAnimationFrame только coalesces pointer-move samples; React/texture update выполняется лишь при смене effective country ID. Manual raycast сохранён для non-pointer centre-ray задач.

Priority состояний:

```text
idle < keyboard candidate < hover < selected
```

Candidate имеет холодный контур, hover — warm orange/bronze, selected — restrained ivory/gold. Selected подавляет конфликтующий hover/candidate outline. Microstates используют маленький видимый marker и отдельную увеличенную прозрачную hit geometry.

Static map/relief textures сохраняют mipmaps, `LinearMipmapLinearFilter` и anisotropy `8`. Dynamic highlight ограничен `1024×512`, имеет anisotropy `1`, `generateMipmaps=false` и Linear min/mag filters. Flag SVG загружается low-priority только для фактически candidate/hovered/selected country; mass preload отсутствует.

Evidence: `globeAtlas.ts`, `globeHighlightUpdate.test.ts`, `globeAtlasPerformance.test.ts`, `globeFilterStability.test.ts`.

## Keyboard

Стрелки создают manual rotate command и активируют реальный keyboard candidate. `GlobeViewObserver` сначала проверяет country под optical centre ray; над океаном `selectGlobeKeyboardCandidate` выбирает ближайшую visible/selectable страну не дальше `π/5`. Backside, far и отфильтрованные страны исключаются. `Enter` выбирает только активный candidate; stale hover не используется.

Скрытый polite live region сообщает RU/EN country name, writer count и действие Enter. `+`, `-`, `Home` и стрелки являются manual commands и отменяют programmatic camera.

Evidence: `globeKeyboardNavigation.ts`, `GlobeViewObserver.tsx`, соответствующие unit tests и E2E `keyboard candidate selects the optical-centre country without replacing Canvas`.

## Touch

Для embedded coarse pointer default policy — `page-pan`, controls disabled, `touch-action: pan-y pinch-zoom`. Чистый tap по surface по-прежнему может выбрать страну, а drag/scroll отсеивается общим distance-aware gesture detector.

Явная кнопка «Управлять глобусом» включает `globe-control`/`touch-action:none`, one-finger rotate и two-finger globe zoom. «Вернуться к прокрутке» всегда доступно; Escape сначала выключает embedded full-control. Immersive coarse-pointer view получает full gestures сразу. Offscreen возвращает passive/suspended policy.

Evidence: `globeTouchActivation.ts`, `globeInteraction.ts`, unit tests и mobile E2E с реальными CDP touch sequences: vertical page pan/no select, clean tap, horizontal rotate, pinch, activation exit и immersive drag.

## Auto, frame loop и background work

Requested Auto state отделён от temporary pause reasons: reduced motion, hidden document, offscreen, selection, country/Nobel hover, interaction и camera flight. Explicit Auto Off не меняется временной логикой.

| Runtime state | Реализованный mode |
|---|---|
| Hidden/offscreen embedded | `never` |
| Idle, Auto OFF | `demand` |
| Auto ON без pause reason | `always` |
| Camera flight / active settling | временно `always` |
| Selected settled | `demand` |
| Nobel idle | `demand` |
| Reduced-motion settled | `demand` |

Static sky, stars и Nobel markers не входят в причины continuous loop. Focus metrics prewarm начинается только после ready frame, обрабатывает максимум 2 item за idle callback, проверяет `isInputPending`, pause'ится на pointer/touch/wheel/keyboard/camera/offscreen и имеет Safari fallback ровно по одному item через 72 ms. Все scheduled handles cancellable.

R3F остаётся единственным владельцем renderer sizing; ручного `gl.setSize`/duplicate resize sync нет.

Evidence: `globePerformance.ts`, `globePerformance.test.ts`, `globeAtlasPerformance.test.ts`, `globeAccessibility.test.ts`, E2E Auto-Off/demand и offscreen regressions.

## Style lifecycle

`useGlobeStyleState` разделяет `requestedStyle`, `pendingStyle` и `renderedStyle`. Active class и `aria-pressed` зависят только от rendered style; pending держит прежнюю surface и сообщает `aria-busy`/polite status. Failure сохраняет последнюю валидную texture и даёт retry. Request ID делает rapid `A → B → C` latest-wins; stale resolve/reject и stale locale load не коммитятся. Hover/focus/pointerdown может preload style до click.

Evidence: `useGlobeStyleState.ts`, `useGlobeStyleState.test.ts`, `globeAtlas.ts` и E2E `style buttons commit only the texture that actually rendered`.

## Country presentation и breadcrumbs

Desktop embedded и immersive country context — overlay drawer над стабильной сценой. При compact layout selection немедленно показывает bottom-sheet peek с flag, country, writer count и явным «Открыть архив». State machine поддерживает `collapsed → half → expanded → collapsed`; collapsed content получает `aria-hidden` и `inert`, panel scroll остаётся внутри content.

Keyboard/search presentation переносит focus на видимый sheet toggle или `.country-panel`; reduced-motion выбирает `behavior:auto`. Pointer selection сохраняет direct-manipulation focus, но peek остаётся виден поверх globe. Close context и World различны.

Breadcrumbs реализуют `Мир › Страна › Writer`:

- World очищает writer/country/Nobel context, отправляет camera `home` и обновляет URL;
- Country очищает writer, сохраняет country и возвращает focus в country presentation;
- обычный writer switch не запускает writer flight.

Evidence: `atlasExperienceState.ts`, `App.tsx`, `WriterPanel.tsx`, state/accessibility tests и E2E responsive presentation/three-state sheet/Canvas geometry.

## Nobel layer

`NobelMarkerLayer` использует deterministic `buildNobelMarkerPlan`:

- far view — максимум один country-level marker/cluster, selected writer выделяется отдельно;
- near view — individual markers;
- zoom hysteresis `3.05/3.35` предотвращает churn;
- coincident coordinates разводятся presentation-only spherical offsets без изменения source data;
- cluster показывает count/year range;
- backside targets не интерактивны;
- hover/reveal/selected emphasis конечный (`160/220 ms`), pulse loop отсутствует.

DOM `<details>` предоставляет полный keyboard-accessible laureate index. Writer selection и отдельная ссылка «Статья о лауреате» не смешаны.

Evidence: `nobelMarkerPolicy.ts`, `NobelMarkerLayer.tsx`, `nobelMarkerPolicy.test.ts`, `globeAccessibility.test.ts` и Nobel E2E.

## Writer spatial context

Выбор писателя обновляет panel/URL, но сам не двигает camera. Только явное «Показать на глобусе» валидирует coordinates повторно в App, collapse'ит mobile sheet и отправляет `writer-focus`. На globe появляется один marker выбранного writer, country context сохраняется. При отсутствии валидных coordinates action не рендерится и показано нейтральное сообщение; copy не называет точку местом рождения.

Evidence: `WriterPanel.tsx`, `App.tsx`, `writerPanelAccessibility.test.ts` и writer E2E (still until explicit action, one marker, unavailable fallback).

## Dynamic coordinates

Статичная локация удалена. Readout разрешает контекст в порядке:

```text
explicit writer focus → selected country → hover country → view centre
```

View centre приходит из actual optical centre ray. Sampling ограничен минимум 80 ms (`10–12 Hz`), а settle принудительно публикует финальный sample. DMS formatter переносит округлённые `60′` в следующий градус, ограничивает poles/antimeridian и выдаёт формат `35°41′ N · 139°41′ E`.

Evidence: `globeCoordinates.ts`, `GlobeViewObserver.tsx` и их unit tests.

## Random Literary Journey и filters

`chooseRandomLiteraryDestination` — pure deterministic helper. Он работает только по текущей filtered collection, исключает current country и последние 3 session destinations, ослабляя history только для маленького набора. Result использует обычный `random-focus`, обновляет URL и открывает тот же country context без roulette animation.

Семантика фильтров сохраняется; `10+ авторов` остаётся отдельным filter. `Крупнейшие архивы` — отдельная кнопка, открывающая компактный список пяти крупнейших архивов и не меняющая активный filter сама по себе. Invalidated selection очищается, сохранив camera без бессмысленного reset.

Evidence: `globeDiscovery.ts`, `globeDiscovery.test.ts`, `App.tsx` и Random/filter E2E.

## Reduced motion, accessibility и quality

- Camera duration при reduce равна нулю; Auto disabled; idle остаётся demand.
- Atlas entry/exit, panel/sheet и UI transitions отключены CSS contract.
- Все programmatic `scrollIntoView` в Globe scope выбирают `auto` при reduce.
- Canvas region объявляет shortcuts; keyboard candidate/style/loading/status имеют live semantics.
- Touch activation и core controls имеют 44 px target; country sheet content корректно inert в collapsed state.
- WebGL fallback оставляет textual country index и retry state.
- Economical mode уменьшает только decorative density/upper DPR/geometry profile, сохраняя surface, relief, atmosphere, selection и museum character.
- Normal settled quality сохраняет configured DPR, mipmapped map/relief, material detail и atmosphere; interaction-time DPR flashing не вводилось.

Forced-colors и 200% zoom опираются на DOM states (`aria-pressed`, `aria-expanded`, status, visible controls), а не только на цвет/Canvas.

## Audit closure

| Finding | Status | Existing evidence |
|---|---|---|
| `GLOBE-001` | **CLOSED** | overlay mobile peek, focused search/keyboard presentation, three-state sheet; responsive E2E |
| `GLOBE-002` | **CLOSED** | centre-ray/filter-aware candidate, ocean fallback, live region, Arrow/Enter unit + E2E |
| `GLOBE-003` | **CLOSED** | page-pan default, explicit full-control/Escape, gesture tap guard; touch unit + CDP E2E |
| `GLOBE-004` | **CLOSED** | `never/demand/always` policy, static layers excluded, Auto-Off E2E |
| `GLOBE-005` | **CLOSED** | requested/pending/rendered reducer, latest-wins/failure-safe unit + held-texture E2E |
| `GLOBE-006` | **CLOSED** | overlay CSS, one R3F sizing owner, Canvas bounding-box/identity E2E |
| `GLOBE-007` | **CLOSED** | zero-duration camera, motion-aware scroll/CSS, reduced-motion unit + runtime/immersion E2E |

Ledger source: [`reports/ui-ux-audit.md`](../reports/ui-ux-audit.md).

## Automated evidence registry

Реализация покрыта следующими существующими suites:

- camera/controller/focus/projection: `GlobeCameraRig.test.tsx`, `globeFocusMath.test.ts`, `globeProjection.test.ts`;
- view/keyboard/touch: `GlobeViewObserver.test.ts`, `globeKeyboardNavigation.test.ts`, `globeTouchActivation.test.ts`;
- performance/highlight/style: `globePerformance.test.ts`, `globeAtlasPerformance.test.ts`, `globeHighlightUpdate.test.ts`, `useGlobeStyleState.test.ts`;
- context/discovery/Nobel: `globeCoordinates.test.ts`, `globeDiscovery.test.ts`, `nobelMarkerPolicy.test.ts`, writer/accessibility tests;
- runtime: `tests/e2e/premium-globe-exploration.spec.mjs`, existing `globe-runtime.spec.mjs`, `responsive-reader-globe.spec.mjs`, `literary-planet-immersion.spec.mjs`.

Final run registry:

| Gate | Final result |
|---|---|
| TypeScript / lint | **PASS — public `tsc` and admin `tsc`; interface catalog 1130 entries; i18n 916 phrases / 55 surfaces / 5 approved exceptions** |
| Targeted Stage 4 unit/component | **PASS — 19 files / 121 tests** |
| Full unit/component | **LOCAL WINDOWS LIMITATION — 258 files passed / 2 skipped / 1 failed; 1362 tests passed / 2 skipped / 1 failed.** The sole failure is the pre-existing CRLF-sensitive `scripts/database/atomic-article-bundle.test.mjs`; the tracked migration/test is unchanged. Green Linux CI is required before merge. |
| Premium + regression E2E | **PASS — premium 22/22; full suite 126 passed / 18 intentional skips / 0 failed, 2 workers, 6.4 min; regression subset 31 passed / 9 intentional skips** |
| Globe asset QA | **PASS — full textures 4096×2048 and mobile textures 2048×1024 for the antique/earth/modern RU/EN set** |
| Production/domain/release gates | **Build/domain/SEO subgates PASS — domain 11319/11319; SEO 5262 ready; 161 pages; 2097 redirects; sitemap 172 URLs; visual runtime console errors 0.** The aggregate Windows release check retains only the documented CRLF-sensitive Vitest failure; Linux CI is required before merge. |
| Performance/artifact budget | **PASS — 114,079,331 / 114,819,072 bytes, headroom 739,741; excluding covers 74,504,165 / 75,497,472, headroom 993,307; 4323 files** |
| Full-tree `git diff --check` | **PASS — final working tree, exit 0; cached-tree verification is repeated immediately before commit.** |
| Head SHA | The final PR head is pinned by the PR/CI after the documentation commit; a commit cannot truthfully embed its own SHA. |

CI fidelity: the Quality workflow installs the browser binary for the Playwright version already frozen by `package-lock.json`; it no longer performs an inline package downgrade. The overall job ceiling is `30` minutes for the expanded 144-case browser matrix, while worker count, per-test timeout, retries and assertions remain unchanged.

## Visual, motion и performance evidence

Required visual/motion matrix остаётся: `320×800`, `360×800`, `390×844`, `430×932`, `768×1024`, `1024×768`, `1280×800`, `1366×700`, `1366×768`, `1440×900`, `1920×1080`; representative RU/EN; три styles; near/medium/far/opposite/high-latitude/microstate; cancel/latest-wins/Home/writer/Random; compact sheet; reduced motion, forced colors, 200% zoom и weak-mobile/economical profile.

- Visual evidence: **PASS — 16 PNG, all 11 required viewports**, RU/EN, embedded/immersive, all three public styles and selected-country/filter/archive/writer/Nobel/brush states. Registry: [`reports/stage4-visual-evidence/README.md`](../reports/stage4-visual-evidence/README.md), SHA-256 `2e6659e1122ebc8b5b2a9f60630d73d7951410f755f4f569b2e440aa0ece8a90`; remaining P0/P1: `0`; console errors: `0`.
- SVG/flag focused evidence: **PASS — 360×800 and 390×844, antique/earth/modern**; exactly one Canvas and one rendered style, crisp Japan outline/marker/control SVGs, mobile country-sheet duplication absent, and on-demand flags limited to the selected/hovered countries (`jp.svg`, then `kp.svg` on deliberate hover). All `204/204` local flag SVG assets respond successfully; console warnings/errors: `0`.
- Motion/runtime evidence: passive texture uploads `0`, offscreen frames `0`, Auto OFF frame counter plateau; premium E2E `22/22`, full E2E `126 passed / 18 intentional skips / 0 failed`, regression subset `31 passed / 9 intentional skips`.
- Premium performance: total artifact `114,079,331 / 114,819,072` bytes (headroom `739,741`), excluding covers `74,504,165 / 75,497,472` (headroom `993,307`), `4323` files. Retina DPR `1.5` retained the full 4096×2048 tier; compact mobile used the dedicated 2048×1024 tier.
- Final post-CI-fix build artifacts: main JS `index-CakQm7Rv.js`, `629,468` bytes, SHA-256 `5efa0c417538cd1c9ae440394b010860530922dfed2edbe209e305927c6625be`; CSS `index-Cvad-RPW.css`, `324,296` bytes, SHA-256 `2317e1bb6354395808e7fe4570783a50232ddac0950b4d75b3675620fcb343ef`; globe chunk `LiteraryWorldMap-D8Tss8bM.js`, `92,507` bytes, SHA-256 `f321edf85e8e51fde2b426b741c27cc5f31c83aea162f3cc179afefaaa8005f7`.

## Вне scope и review policy

Не входят historical literary timeline, writer travel routes, literary cities, novel-action places, historical borders, worldwide book layer, heatmaps, large author network и era reconstruction. Это будущий отдельный Atlas Expansion.

Stage 4 создаётся отдельным PR. Merge — только ручной после зелёного CI и review. Stage 5 автоматически не начинается.
