# Literary Planet Immersion

## Цель этапа

Stage 3 добавляет режим погружения «Литературная планета» к уже существующему атласу. Обычный embedded-режим остаётся полноценным; immersion включается только явным действием или прямым URL.

## Owner visual lock

Stage 3 не меняет:

- обе полосы шапки, их геометрию, правую группу controls и mobile-поведение;
- фирменную Hero-заставку, её изображение, логотип и журнальную композицию;
- оранжево-фиолетовую палитру;
- старинный глобус как основной и исходный визуальный режим;
- три существующих оформления глобуса, географию, маркеры и контентные базы;
- CMS-контракт: произвольный URL Hero CTA не переопределяется.

Исторический visual lock шапки: `c547c312c34c285385d7c97971d9d9d608217310` (20.08.2026). Stage 3 не использует режим погружения как повод для redesign этих зон.

## Архитектура

| Слой | Ответственность |
|---|---|
| `src/atlas/atlasExperienceState.ts` | Чистый reducer и допустимые переходы embedded/immersive, overlays, sheet и quiet mode. |
| `src/atlas/useAtlasExperience.ts` | DOM lifecycle, placeholder, modal semantics, focus, scroll lock, URL/history, motion presets, economical mode и proximity. |
| `src/components/AtlasExperienceChrome.tsx` | Минимальная immersive-панель: identity, search, filters, language и close. |
| `src/components/AtlasSearchCombobox.tsx` | Один APG combobox для embedded и immersive presentation. |
| `src/App.tsx` | Интеграция с текущим Atlas state, Hero CTA, country/writer/filter selection и общим `popstate`. |
| `src/components/LiteraryWorldMap.tsx` | Стабильный root сцены и атомарный writer selection. |
| `src/components/LiteraryGlobe.tsx` | Тот же mounted Canvas, responsive resize и явный presentation mode без identity reset. |
| `src/utils/atlasUrlState.ts` | Независимая сериализация filter/selection/view и app-owned history marker. |

`App.tsx` не владеет деталями modal lifecycle. Он передаёт данные и callbacks в контроллер, а вид рендерится из единого central state.

## One-Canvas contract

Оба режима используют один и тот же React subtree `LiteraryWorldMap -> LiteraryGlobe -> Canvas`.

- нет второго Canvas, fullscreen API, portal, нового route или ручного DOM reparenting;
- presentation меняется через `data-atlas-view` и fixed-геометрию той же surface;
- placeholder удерживает высоту embedded-слота, пока surface занимает viewport;
- камера, style, auto-rotate и selected context не сбрасываются из-за remount;
- `ResizeObserver` берёт layout size, а не animated transformed rectangle, и не запускает лишний resize при неизменном размере.

Финальное runtime-доказательство проверяет и количество `canvas === 1`, и сохранность test-side property на том же DOM node после open/close. Этот contract прошёл в текущем Stage 3 Playwright suite: **9 passed / 9 intentionally skipped in 1.8 min**.

## Entry, transition и exit

### Точки входа

- Embedded CTA «Погрузиться» / «Enter the Literary Planet» открывает immersion.
- Стандартный Hero CTA с точным target `#atlas` открывает immersion. Любой custom CMS URL остаётся обычной ссылкой.
- Header-ссылка на атлас по-прежнему ведёт к embedded-секции.
- URL с `atlasView=immersive` открывает direct entry без имитации перелёта от невидимого embedded rect.

### Choreography

Для embedded/Hero entry surface снимает исходную геометрию и раскрывает непрерывное космическое поле до viewport. Direct URL использует короткий fade. Reverse transition возвращает surface к актуальному slot rect, после чего восстанавливаются placeholder и CSS variables.

Состояния: `idle -> preparing -> entering -> idle -> exiting -> idle`. Повторные и недопустимые events reducer игнорирует; pointer interaction самой сцены на entering/exiting отключено.

## Космическое поле и proximity

Тот же космический DOM-слой присутствует в embedded и immersive presentation. Глубина собрана из лёгких CSS-слоёв: far stars, near stars, ambient halo и сдержанная celestial-atlas engraving. Это не sci-fi HUD и не отдельная WebGL-сцена.

Proximity:

- доступен только для `(hover: hover) and (pointer: fine)`;
- один `requestAnimationFrame` обрабатывает последнее pointer event; в idle нет perpetual RAF;
- записывает только CSS variables и `data-atlas-proximity`;
- обнуляется на drag, pressed buttons и над functional controls;
- отключён для coarse pointer, reduced motion и economical mode;
- не перемещает cursor и не масштабирует actual Canvas.

## Контекст атласа

- Поиск, filter, language, country и writer используют существующее единое состояние.
- Поиск реализует APG combobox: стабильные option IDs, active index, `aria-activedescendant`, `ArrowUp/Down`, `Home/End`, `Enter` и `Escape`.
- Search и filters взаимно исключаются; filter по-прежнему сериализуется в прежнем `atlas=`.
- Desktop country presentation выводится overlay drawer и не меняет grid width сцены.
- На узком viewport та же country panel обёрнута в lightweight bottom sheet с collapsed/expanded states; отдельная sheet library не добавлена.
- Внутренний country/writer selection в immersive заменяет текущую history entry, а не засоряет Back множеством шагов.

## URL и History

Presentation state отделён от content filter:

```text
atlas=all|nobel|rich|portrait|verified
atlasView=immersive
country=<country-id>
writer=<writer-id>
```

- отсутствие `atlasView` означает embedded;
- старое значение `atlas=immersive` не трактуется как presentation mode;
- UI entry делает один `pushState` и ставит namespaced marker `probperaAtlasImmersiveUiEntry` с source `embedded` или `hero`;
- внутренние changes в immersion делают `replaceState` и сохраняют marker;
- close/Escape в app-owned entry вызывает Back; для direct URL или чужой history state только `atlasView` убирается через replace;
- `popstate` немедленно синхронизирует view и selection; Forward может восстановить immersion;
- unrelated query parameters и hash сохраняются.

## Accessibility

При immersion:

- surface получает `role="dialog"`, `aria-modal="true"` и accessible heading;
- соседние ветви DOM получают `inert` и `aria-hidden`; immersive ancestor не inert'ится;
- focus переходит на close control, Tab/Shift+Tab замкнуты внутри surface;
- при exit focus возвращается к реальному opener с fallback на embedded launch/atlas;
- `html` и `body` блокируют scroll с сохранением и точным возвратом scroll position;
- Escape priority: search, затем filters, затем exit;
- loading-состояние country panel имеет `role="status"`/live semantics;
- словесные controls и RU/EN labels используют текущую interface locale.

## Reduced motion, quiet и economical mode

- `prefers-reduced-motion: reduce` убирает entry/exit animation, CSS transitions и proximity; существующий globe controller также отключает auto-rotate.
- После паузы без activity quiet mode приглушает второстепенный chrome, но оставляет close заметным. Pointer, keyboard, wheel и touch будят interface.
- Economical mode учитывает Save-Data, hardware concurrency, device memory, DPR и narrow viewport. Он убирает near cosmic layer, engraving и halo и отключает proximity.
- Новые декоративные слои не добавляют внешних runtime-зависимостей, image requests или отдельный animation loop.

## QA contract

Обязательная матрица: RU и EN на `360×800`, `768×1024`, `1366×768`, `1440×900`, `1920×1080`; отдельно small-height, resize, orientation, reduced motion, 200% zoom и forced colors.

| Доказательство | Статус в документе |
|---|---|
| TypeScript | **PASS — `npm run typecheck`** |
| Targeted reducer/combobox/URL/globe tests | **PASS — 5 files / 32 tests** |
| Full Vitest, `--maxWorkers=4` | **PASS — 241 files / 1255 passed + 1 skipped** |
| Stage 3 Playwright current-source suite и One-Canvas identity | **PASS — 9 passed / 9 intentionally skipped, 1.8 min** |
| Existing globe/responsive Playwright regressions | **PASS — 22 / 22, 2.2 min** |
| Production build | **PASS — 1015 modules** |
| Article / redirect generation | **PASS — 161 articles / 2097 redirects** |
| SEO readiness | **PASS — 5262 ready** |
| Domain validation | **PASS — 11319 / 11319** |
| Performance budget | **PASS — 114,028,640 / 114,819,072 bytes; margin 790,432; 4323 files** |
| RU/EN visual matrix | **PASS — 26 PNG + README; P0/P1 отсутствуют** |
| Full-tree `git diff --check` | **PASS — final full-tree run, exit 0; только CRLF notices** |

Baseline-артефакты хранятся в `reports/stage3-baseline/`. Финальная матрица и manifest: [`reports/stage3-visual-evidence/README.md`](../reports/stage3-visual-evidence/README.md). Все screenshots снимались после stable `data-atlas-transition="idle"`. На 360 px отдельно подтверждён economical fallback; это не подмена reduced-motion capture.

Visual review не обнаружил P0/P1. Остались P2: слабая swipe-подсказка intentional horizontal scroller `.atlas-filters` на 360 px; P3: selected globe label может выглядеть дублированным через полупрозрачный header свёрнутого mobile sheet. Подключённый browser harness не предоставляет CSS media emulation, поэтому rendered `prefers-reduced-motion: reduce` screenshot в evidence не заявляется; соответствующий contract покрыт автоматическими state/tests.

## Audit findings

- `ATLAS-001` — закрыт Stage 3: единый APG combobox и keyboard model.
- `ATLAS-002` — partial: основная служебная типографика получила более плотные semantic colors и размер 12 px, но `.globe-instruction` остаётся 10 px, selected-country labels — 9–10 px. Их корректировка и rendered forced-colors/gradient verification переносятся в Stage 4 / Final QA.
- `ATLAS-003` — partial: Stage 3 добавил `min-width: 0`, safe viewport sizing, contained overlays и явный horizontal-scroll allowlist для filters. Глобальный legacy `overflow-x: clip` и переполнения вне Atlas не изменялись.

Полный ledger: [`reports/ui-ux-audit.md`](../reports/ui-ux-audit.md).

## Stage 4 follow-ups

Stage 3 не закрывает `GLOBE-001`–`GLOBE-007`. В Stage 4 остаются:

- полная keyboard-candidate и Enter-selection модель на самом глобусе;
- явный touch page/globe activation contract;
- demand/idle rendering и финальный runtime performance budget;
- разделение requested/pending/rendered style state;
- полный country focus contract и геометрическая acceptance панели;
- motion-aware программные переходы;
- остаток `ATLAS-002`: `.globe-instruction` и selected-country labels до безопасного размера/контраста;
- любые Stage 4-only возможности, включая journey/breadcrumb UX, если они будут включены в отдельный Stage 4 scope.

Rendered forced-colors/gradient verification остатка `ATLAS-002` остаётся обязательной частью Final QA.

Stage 4 может начинаться только от нового актуального `main`, в который Stage 3 уже влит отдельным PR. Stacked Stage 4 PR поверх неслитого Stage 3 не допускается.

## Review policy

Stage 3 публикуется отдельным PR `feat(atlas): add Literary Planet immersion experience`. Автоматический merge запрещён.
