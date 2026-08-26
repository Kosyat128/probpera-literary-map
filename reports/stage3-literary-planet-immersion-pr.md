# feat(atlas): add Literary Planet immersion experience

## Summary

- Добавляет явно запускаемый immersive-режим «Литературная планета» поверх существующего атласа.
- Сохраняет embedded как полноценный и исходный режим.
- Не меняет owner-locked шапку, Hero, логотип, палитру, журнальную концепцию и старинный глобус как основной style.

## Architecture

Lifecycle вынесен из `App.tsx` в pure reducer `atlasExperienceState.ts` и DOM/controller hook `useAtlasExperience.ts`. Chrome и APG combobox - отдельные components. URL serialization остаётся в `atlasUrlState.ts`.

## One-Canvas strategy

Embedded и immersive используют один mounted `LiteraryWorldMap -> LiteraryGlobe -> Canvas`. Тот же surface меняет layout presentation; placeholder сохраняет document flow. Нет duplicate Canvas, fullscreen API, portal, route, remount key или ручного reparenting.

## Same-mounted-Canvas verification

Source contract закреплён в component tests. Runtime Stage 3 Playwright проверяет `canvas count = 1`, помечает Canvas test-side property и подтверждает тот же DOM node после open/close. Текущий Playwright-прогон: **PASS - 9 tests passed, 9 intentionally skipped, 1.8 min**.

## Embedded behaviour

Embedded search, filters, ranking, country index, globe controls и country selection остаются рабочими. Header link ведёт к embedded atlas. Immersion не включается от scroll, hash navigation или country click.

## Gravitational proximity

Fine-pointer proximity рассчитывается один раз за frame и передаёт силу/координаты в CSS variables. Он не меняет cursor, actual Canvas geometry и не имеет perpetual RAF. Drag, functional controls, reduced motion, coarse pointer и economical mode имеют приоритет.

Reducer/controller, URL, combobox и globe contracts прошли targeted-прогон: **PASS - 5 files / 32 tests**. Текущий Stage 3 Playwright-прогон взаимодействий также завершён: **9 passed / 9 intentionally skipped**. Отдельный ручной RAF trace не заявляется как выполненный.

## Continuous cosmic field

Один DOM cosmic field живёт на той же surface до, во время и после immersion. Переход меняет его глубину и opacity, а не заменяет фон на другой.

## Celestial-atlas decoration

Сдержанная CSS engraving поддерживает образ старинного небесного атласа. Это декоративный, `pointer-events: none` слой, не sci-fi HUD и не новая image/WebGL dependency.

## Embedded → immersive choreography

Embedded CTA фиксирует origin rect, удерживает slot placeholder и раскрывает surface до `100dvw × 100dvh`. Во время entering сцена не принимает pointer interaction.

## Hero → immersive choreography

Только стандартный Hero target `#atlas` запускает immersion с source `hero`. Custom CMS URL не перехватывается.

## Direct URL choreography

`atlasView=immersive` на initial load или Forward использует source `url` и короткий fade preset. Не имитируется animation от невидимой Hero/embedded точки.

## Exit/reverse transition

Close и Escape запускают reverse до снятия modal state. Surface не скрывается через `display:none` в начале exit. Scroll lock, inert и focus trap снимаются cleanup'ом; focus возвращается к opener/fallback.

## Context preservation

Country, writer, filter, language, globe style, auto state и camera не сбрасываются при open/close, потому что сцена не remount'ится и presentation state отделён от content state.

## URL state

- Существующий `atlas=` остаётся filter parameter.
- Новый presentation parameter: `atlasView=immersive`.
- `country` и `writer` сохраняют прежний смысл.
- Unrelated query/hash не удаляются.

## History / Back / Forward

UI entry создаёт один app-owned history step с marker/source. Внутренние selection/filter updates в immersive используют replace. Close в app-owned step делает Back; direct URL close - replace. `popstate` синхронизирует state немедленно.

URL/history contract входит в успешно пройденные targeted 5 files / 32 tests и Stage 3 Playwright current-source suite: **9 passed / 9 intentionally skipped in 1.8 min**.

## Search/filter reuse

Один Atlas search/filter state рендерится в embedded и immersive presentation. Search теперь следует APG combobox model: active index, stable IDs, `aria-activedescendant`, arrows, Home/End, Enter и Escape.

## Country drawer

На desktop существующая country panel показывается как overlay drawer. Она не переводит сцену в двухколоночную grid и не добавляет deep drawer redesign.

## Mobile sheet

На viewport до 980 px та же panel становится bottom sheet с native collapsed/expanded state и safe-area padding. Новая sheet dependency не добавлена.

## Accessibility

- immersive surface: `role=dialog`, `aria-modal=true`, heading;
- background siblings: recursive `inert` + `aria-hidden`, но не immersive ancestor;
- initial focus, focus trap, restore focus;
- scroll lock с точным возвратом scroll position;
- Escape priority: search → filters → exit;
- APG combobox и live/status semantics для loading country content;
- locale-aware RU/EN labels.

## Reduced motion

Reduce убирает entry/exit animation, proximity и CSS motion. Existing globe auto-rotate отключается его текущим reduced-motion contract.

## Economical mode

На Save-Data/low hardware/narrow/high-DPR conditions отключаются proximity, near stars, engraving и ambient halo. Новые слои - CSS, без heavy dependencies и image requests.

## Performance

- Нет второй 3D-сцены и новой runtime-библиотеки.
- Proximity RAF существует только между pointer events и отменяется в cleanup.
- Resize observer deduplicates unchanged dimensions.
- CSS decoration понижается в economical/reduced configurations.

Production build завершён на **1015 modules**. Performance audit: **114,028,640 / 114,819,072 bytes**, запас **790,432 bytes**, **4323 files**. На 360 px подтверждён economical mode без document-level overflow; это rendered performance-fallback, а не подмена reduced-motion проверки.

## Tests

| Проверка | Результат |
|---|---|
| `npm run typecheck` | **PASS** |
| Targeted reducer/combobox/URL/globe tests | **PASS - 5 files / 32 tests** |
| Full Vitest, `--maxWorkers=4` | **PASS - 241 files / 1255 passed + 1 skipped** |
| Stage 3 Playwright current-source suite | **PASS - 9 passed / 9 intentionally skipped, 1.8 min** |
| Existing globe/responsive Playwright regressions | **PASS - 22 / 22, 2.2 min** |
| Production build | **PASS - 1015 modules** |
| Article and redirect generation | **PASS - 161 articles / 2097 redirects** |
| SEO readiness | **PASS - 5262 ready** |
| Domain validation | **PASS - 11319 / 11319** |
| Performance audit | **PASS - 114,028,640 / 114,819,072 bytes; margin 790,432; 4323 files** |
| `git diff --check` | **PASS - final full-tree run, exit 0; только CRLF notices** |
| Visual evidence | **PASS - 26 PNG + README; P0/P1 отсутствуют** |

Финальная визуальная матрица сохранена в [`reports/stage3-visual-evidence/`](stage3-visual-evidence/): **26 PNG + README**. Она включает RU/EN на 360, 768, 1366, 1440 и 1920 px, embedded/immersive idle и representative search, filters, country drawer, mobile sheet и economical states. Все capture сделаны после `data-atlas-transition="idle"`; P0/P1 не найдено.

Остатки: P2 - у `.atlas-filters` на 360 px слишком деликатная подсказка горизонтального swipe; P3 - selected globe label может визуально дублироваться через полупрозрачный header свёрнутого mobile sheet. Browser harness не поддерживает CSS media emulation, поэтому rendered reduced-motion screenshot честно не заявляется; economical capture оставлен только как performance-fallback proxy. Baseline: `reports/stage3-baseline/`.

## Audit findings addressed

### CLOSED

- `ATLAS-001` - APG keyboard combobox реализован и переиспользован в обоих presentation modes.

### PARTIAL

- `ATLAS-002` - основная Atlas microcopy поднята до 12 px и более плотных semantic colors. Остались `.globe-instruction` 10 px и selected-country labels 9-10 px; rendered forced-colors/gradient verification переносится в Stage 4 / Final QA.
- `ATLAS-003` - Atlas surface, overlays, panel/sheet и filter overflow получили явные containment rules. Общий legacy `overflow-x: clip` и overflow вне Atlas остаются Final QA/Homepage scope.

`GLOBE-001`-`GLOBE-007` остаются **OPEN** для Stage 4. Stage 3 overlay/sheet shell не подменяет полную Stage 4 acceptance этих findings.

## Before/after

- Before desktop embedded idle: `reports/stage3-baseline/before-desktop-embedded-idle-1440x900.png`.
- Before desktop selected country: `reports/stage3-baseline/before-desktop-selected-country-1440x900.png`.
- Before mobile: отдельный достоверный initial mobile baseline отсутствует; он не заменён искусственным after-capture.
- After matrix and manifest: [`reports/stage3-visual-evidence/README.md`](stage3-visual-evidence/README.md), 26 PNG.

## Stage 4 follow-ups

- `GLOBE-001`: полный country focus/visibility contract.
- `GLOBE-002`: keyboard candidate и Enter selection на глобусе.
- `GLOBE-003`: явный touch page/globe activation contract.
- `GLOBE-004`: demand/idle rendering без ambient perpetual frames.
- `GLOBE-005`: requested/pending/rendered style state.
- `GLOBE-006`: финальная geometry/overlay acceptance при selected country.
- `GLOBE-007`: единый motion-aware программный navigation helper.

Stage 4 должен начаться от fresh `main` только после merge этого Stage 3 PR. Stacked PR не делается.

## Review policy

- Scope: только Stage 3 Literary Planet Immersion.
- Automatic merge: **запрещён**.
- Stage 4 code в этом PR: **отсутствует**.
- Stage 4 начинается только от fresh `main` после merge отдельного Stage 3 PR; stacked PR запрещён.
- Финальный full-tree `git diff --check`: **PASS - exit 0; только CRLF notices**.
