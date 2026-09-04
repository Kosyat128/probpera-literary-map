# UI/UX-аудит главной страницы

## Паспорт аудита

- Базовый коммит: `329a3dceea85b52450e6d03884930ffb91dc5da5` (`main`).
- Проверенная матрица исходного этапа 0: RU и EN при CSS viewport `360×800`, `768×1024`, `1366×768`, `1440×900`, `1920×1080`.
- Дополнительно на этапе 0 проверялись hover, focus, active, loading, keyboard, mouse, touch-scroll, reduced motion, выбранная страна и три оформления глобуса.
- Этот файл фиксирует результаты уже выполненного аудита. Новый полный аудит вместо него не проводился; добавлены только постоянные ID, связь с текущим UI Foundation PR и статусы.
- P0 на исходном этапе не найдено.
- Исторический visual lock для обеих полос шапки и правой группы: `c547c312c34c285385d7c97971d9d9d608217310` (20.08.2026), до UI Foundation. Текущий PR намеренно восстанавливает оттуда native search, RU/EN, пять social controls, reader control, размеры, радиусы, интервалы и responsive visibility.

## Неприкосновенные ограничения бренда

Не меняются фирменная заставка и её изображение, логотип, общая оранжево-фиолетовая палитра, журнальная концепция, старинный глобус как основной режим, география и визуальные ассеты глобуса.

## Статусы

- `CLOSED` - finding полностью закрыт указанным этапом и имеет source/unit/E2E evidence.
- `PARTIAL` - указанный этап закрыл только явно описанную часть; остаток остаётся в назначенном будущем этапе.
- `OPEN` - finding ещё не закрыт либо намеренно оставлен будущему этапу.

## Findings

| ID | Priority | Area | Проблема | Компоненты / селекторы и затронутые файлы | Target viewport | Planned stage | Status |
|---|---|---|---|---|---|---|---|
| UI-001 | P3 | UI foundation | У кнопок не было общего контракта размеров, радиусов, focus и состояний. | `.primary-action`, `.secondary-action`, globe/atlas controls; `src/index.css`, `src/ui/*` | Все, RU/EN | UI Foundation | **PARTIAL** - семантические токены и primitives сохранены для migrated controls; `.global-search-trigger`, `.reader-button` и RU/EN намеренно возвращены к native historical contract по решению владельца и исключены из дальнейшего redesign. |
| UI-002 | P3 | Visual QA | Не было полной baseline-матрицы главной и интерактивных состояний. | `tests/e2e/*.spec.mjs`, `playwright.config.mjs`, `tests/e2e/ui-foundation.spec.mjs`, `tests/e2e/header-hero-polish.spec.mjs`, `scripts/capture-header-hero-qa.mjs` | 320-1920, RU/EN | Final QA | **PARTIAL** - добавлена отдельная детерминированная матрица Header/Hero: RU 320/360/390/430/768/1024/1280/1366/1440/1920, EN 360/768/1440/1920 и состояния обоих menu. Она также доказывает возврат обеих полос шапки и Hero к исходному визуалу; окончательный `toHaveScreenshot`-baseline всей главной остаётся будущему PR. |
| UI-003 | P3 | Typography | `overflow-wrap:anywhere` может разрывать имена внутри слова. | Заголовки/имена карточек; `src/index.css` | 360, 768, RU/EN | Final QA | **PARTIAL** - самостоятельная задача Typography убрала небезопасный перенос и обрезку в карточках/ридере; проверены RU/EN, 320-1920px и масштаб читателя. Аудит CSS запрещает возврат этих правил. Header/Hero полностью сохранены по решению владельца; это не повторный полный аудит всех состояний сайта. Доказательства: `reports/master-typography-and-card-geometry.md`. |
| UI-004 | P2 | Homepage | Одинаковые KPI повторяются в topline, hero, atlas и каталогах. | Hero/atlas/archive/directory stats; `src/App.tsx`, `src/components/SectionsDirectory.tsx` | Все, особенно 360/768 | Homepage Structure | **OPEN** |
| UI-005 | P3 | Footer navigation | Между белыми пунктами трёх колонок footer было слишком много вертикального воздуха. | `.footer-map section`; `src/index.css` | 768-1920, RU/EN | Header + Hero | **CLOSED** - итоговый responsive row gap уменьшен с 7 до 5 px без изменения текста, колонок, типографики или кнопок. |
| HEADER-001 | P1 | Layout grid | У крупных секций разные левые направляющие из-за нескольких gutters/max-width/padding. | `.brand`, `.hero-editorial h1`, `.atlas-heading`, `.book-archive-heading`, `.article-library-heading`, `.calendar-heading`; `src/index.css` | Все, сильнее 1366-1920, RU/EN | Header + Hero | **OPEN** - унификация была отменена по решению владельца, чтобы обе полосы шапки визуально остались точно как до этапа; finding не закрывается скрытым изменением геометрии. |
| HEADER-002 | P2 | Mobile navigation | Горизонтальная мобильная навигация скрывает scrollbar, не показывает продолжение и не имеет `aria-current`. | `.mobile-nav`; `src/App.tsx`, `src/index.css` | 360, частично 768, RU/EN | Header + Hero | **OPEN** - исходная нижняя полоса восстановлена без визуальных модификаций; улучшение требует отдельного согласования, не меняющего утверждённый вид. |
| HEADER-003 | P2 | Header menus | Mega-menu закрывались только blur/hover-таймером: Escape не возвращал фокус, клик вне меню мог оставить его открытым. | `.articles-menu`, `.sections-menu`; `src/App.tsx`, `src/components/HeaderArticlesMenu.tsx` | 360-1920, RU/EN | Header + Hero | **CLOSED** - добавлены outside-pointer close, Escape с возвратом фокуса на `summary` и более устойчивый hover grace period; внешний вид панели не изменён. |
| HERO-001 | P1 | Hero art direction | На 768 выбирается desktop source, что даёт чрезмерное кадрирование существующей заставки. | `.hero-cover picture`; `src/App.tsx`, `src/index.css` | 768, RU/EN | Header + Hero | **OPEN** - исходный breakpoint 680 px восстановлен по решению владельца вместе с прежним визуалом Hero. |
| HERO-002 | P2 | Hero typography | Перенос hero-title жёстко задан DOM-разрывами и русской структурой; accent line использует `nowrap`. | `.hero-title-lead`, `.hero-title-accent`; `src/App.tsx`, `src/index.css` | 360, 768, RU/EN | Header + Hero | **OPEN** - прежняя типографическая структура восстановлена без визуального изменения. |
| ATLAS-001 | P1 | Search / combobox | Combobox атласа не реализовывал APG keyboard model: не было active index, `aria-activedescendant`, ArrowUp/Down и согласованного Enter. | `#country-search[role="combobox"]`, `#country-results [role="option"]`; `src/App.tsx`, `src/components/AtlasSearchCombobox.tsx`, `src/components/AtlasSearchCombobox.test.tsx` | Все, RU/EN | Immersive Literary Planet | **CLOSED** - единый embedded/immersive combobox имеет стабильные option IDs, active index, `aria-activedescendant`, ArrowUp/Down, Home/End, Enter, Escape и pointer/touch selection. |
| ATLAS-002 | P1 | Contrast / type | Мелкая служебная типографика имела 8-10 px, низкую opacity и местами недостаточный контраст. | `.atlas-filters`, `.atlas-ranking`, `.globe-copy`, `.globe-instruction`, selected-country labels, placeholders, search metadata, `.country-metric`; `src/index.css` | Все, особенно 768-1920 | Immersive Literary Planet / Globe UX Polish / Final QA | **PARTIAL** - основная Atlas microcopy поднята до 12 px и более плотных semantic colors. Остались `.globe-instruction` 10 px и selected-country labels 9-10 px; rendered forced-colors/gradient verification переносится в Stage 4 / Final QA. |
| ATLAS-003 | P1 | Overflow | `overflow-x: clip` маскирует внутреннее переполнение hero/map/cards/footer вместо устранения причины. | `.magazine-app`, `.magazine-hero`, `.atlas-experience-*`, `.world-map-stage`, cards, `#community`, `.site-footer`; `src/App.tsx`, `src/index.css` | 360, RU/EN | Immersive Literary Planet / Final QA | **PARTIAL** - Atlas surface, overlays, panel/sheet и filter row получили `min-width:0`, safe sizing, containment и явный horizontal-scroll allowlist. Общий legacy `overflow-x: clip` и причины вне Atlas остались Final QA/Homepage scope. |
| GLOBE-001 | P1 | Country panel | После выбора страны на mobile панель остаётся далеко ниже viewport, focus не переносится. | `.atlas-country-presentation`, `.atlas-country-sheet-toggle`, `.country-panel`; `src/App.tsx`, `src/atlas/atlasExperienceState.ts`, `src/components/WriterPanel.tsx`, `src/index.css` | 360, 768, RU/EN | Globe UX Polish | **CLOSED** - country context стал overlay bottom sheet с immediate flag/country/writer-count peek и явным «Открыть архив»; реализованы `collapsed/half/expanded`, `inert` collapsed content и focus на видимый toggle/panel для keyboard/search path. Evidence: `atlasExperienceState.test.ts`, `writerPanelAccessibility.test.ts`, responsive + premium globe E2E. |
| GLOBE-002 | P1 | Keyboard | Стрелки вращают глобус, но не формируют keyboard candidate; Enter не может выбрать новую страну без pointer. | `.literary-globe[role="region"]`, `.globe-keyboard-status`; `src/components/LiteraryGlobe.tsx`, `src/components/GlobeViewObserver.tsx`, `src/components/globeKeyboardNavigation.ts` | Все, RU/EN | Globe UX Polish | **CLOSED** - optical centre ray формирует filter-aware candidate, ocean fallback ограничен visible central zone, backside/far исключены, Enter выбирает только active candidate, live region сообщает country/writer count. Evidence: `GlobeViewObserver.test.ts`, `globeKeyboardNavigation.test.ts`, premium keyboard E2E. |
| GLOBE-003 | P1 | Touch | Большой canvas с `touch-action:none` создаёт scroll trap и не имеет явного режима «страница/глобус». | `.literary-globe[data-globe-touch-mode] canvas`, `.globe-touch-activation`; `src/index.css`, `src/components/LiteraryGlobe.tsx`, `src/components/globeTouchActivation.ts`, `src/components/globeInteraction.ts` | 360, 768 touch | Globe UX Polish | **CLOSED** - coarse embedded default использует `pan-y pinch-zoom`, explicit full-control включает `touch-action:none`, доступен возврат/Escape, clean tap отделён от scroll/drag; immersive получает full gestures. Evidence: `globeTouchActivation.test.ts` и CDP touch E2E (page pan, tap, rotate, pinch, exit, immersive). |
| GLOBE-004 | P2 | Performance | После выключения Auto WebGL остаётся в постоянном `frameloop="always"` из-за ambient animation. | `.literary-globe[data-globe-frame-mode]`, auto-rotate control; `src/components/LiteraryGlobe.tsx`, `src/components/globePerformance.ts` | Все, особенно слабый 360/768 | Globe UX Polish | **CLOSED** - frame policy даёт `never` offscreen/hidden, `demand` idle Auto OFF/selected/Nobel/reduced и временный `always` только Auto/flight/settling; static sky/stars/Nobel не удерживают loop. Evidence: `globePerformance.test.ts`, `nobelMarkerPolicy.test.ts`, Auto-Off demand + existing visibility E2E. |
| GLOBE-005 | P2 | State model | Pending и committed оформление визуально смешаны: `aria-pressed` меняется до готовности canvas. | `.globe-style-switch`, `.globe-style-status`; `src/components/LiteraryGlobe.tsx`, `src/components/useGlobeStyleState.ts`, `src/index.css` | Все | Globe UX Polish | **CLOSED** - requested/pending/rendered/failure разделены; `aria-pressed` следует только rendered style, pending сохраняет старую surface и busy/status, race latest-wins, failure-safe retry. Evidence: `useGlobeStyleState.test.ts` и held-texture premium E2E. |
| GLOBE-006 | P2 | Layout stability | Выбранная страна переводит сцену из одной колонки в две и резко ресайзит WebGL. | `.atlas-layout.has-country`, `.atlas-country-presentation`; `src/index.css`, `src/components/LiteraryGlobe.tsx` | 768-1920 | Globe UX Polish | **CLOSED** - desktop drawer и compact sheet являются overlays, layout остаётся одноколоночным, custom renderer resize writer удалён и R3F остаётся единственным sizing owner. Evidence: `globeAccessibility.test.ts`, premium Canvas identity/bounding-box E2E. |
| GLOBE-007 | P2 | Reduced motion | Часть программных переходов использует `behavior:"smooth"` без проверки reduced motion. | Globe camera/scroll/sheet/context transitions; `src/App.tsx`, `src/components/GlobeCameraRig.tsx`, `src/components/globeFocusMath.ts`, `src/index.css` | Все при `prefers-reduced-motion: reduce` | Globe UX Polish | **CLOSED** - reduced camera duration равна 0, Auto disabled/demand, Globe-scope scroll выбирает `auto`, Atlas/panel/sheet transitions отключаются; writer/Random/World используют тот же immediate controller. Evidence: focus-math unit, existing reduced-motion globe E2E и same-Canvas immersion E2E. |
| MOBILE-001 | P1 | Hit targets | Несколько семейств интерактивных элементов имели область меньше 44×44 px. | Header search/language/reader, atlas ranking, book actions, footer/social; `src/index.css`, migrated components | 360-1920, pointer coarse | Final QA | **PARTIAL** - Header/Hero-часть закрыта: search/RU/EN/account и обе CTA имеют минимум 44 px на 320/360/390; foundation и migrated core controls также соблюдают контракт. Оставшиеся legacy card/footer/social families не мигрированы. |
| MOBILE-002 | P2 | Author cards | Карточки авторов с фиксированной высотой 470 px чрезмерно растягивают mobile-страницу. | `.author-showcase` cards; `src/index.css` | 360, 768 | Homepage Structure | **OPEN** |
| A11Y-001 | P1 | Focus | `summary` не входил в общий focus-visible selector и получал слабый UA-outline на тёмной шапке. | `.articles-menu > summary`, `.sections-menu > summary`, `.cms-nav-group > summary`; `src/index.css`, header menus | Все, особенно 1366-1920 | UI Foundation | **CLOSED** - `summary:focus-visible` использует общий контрастный focus token. |
| A11Y-002 | P2 | Loading semantics | Видимые loading-состояния не имеют полного `status`/`aria-live`/`aria-busy` контракта. | `.articles-mega-loading`, `.country-panel.panel-loading`; `src/components/HeaderArticlesMenu.tsx`, `src/App.tsx` | Все | Final QA | **OPEN** |
| A11Y-003 | P2 | Localization | RU/EN имеют различную структуру и отдельные неполностью локализованные labels/title/empty states. | Article library, country panel, header/global/globe labels, `document.title`; `src/App.tsx` и связанные компоненты | Все, RU/EN | Final QA | **OPEN** |
| A11Y-004 | P1 | Accessible name | На узком экране подпись reader control визуально скрывается; доступное имя не было закреплено независимо от CSS. | `.reader-button`; `src/App.tsx`, `src/index.css` | 320-390, RU/EN | Header + Hero | **CLOSED** - `aria-label` всегда содержит имя читателя либо локализованное «Войти», без изменения прежней геометрии кнопки. |
| PERF-001 | P1 | Loading / CLS | Архив сначала пуст и искусственно ждёт; ложное empty-state сменяется крупными секциями и создаёт скачки. | Book/article/sections/calendar/writers/footer; `src/App.tsx`, `src/index.css` | Все, особенно 360/768 и слабый mobile | Homepage Structure | **OPEN** |
| PERF-002 | P1 | Entry graph | Initial preload включает main, Three, book catalog и CSS - около 700.6 KiB gzip. | Entry document; `vite.config.ts`, `src/App.tsx`, `src/data/bookArchive.ts` | Все, критично 360/768 | Homepage Structure | **OPEN** |
| PERF-003 | P1 | Search index | Полный индекс стран, писателей и книг строится синхронно до открытия поиска. | `#country-search`, `.global-search-trigger`; `src/App.tsx` | Все, особенно 360 | Homepage Structure | **OPEN** |
| PERF-004 | P1 | Lazy UX | Первый запуск глобального поиска использует `Suspense fallback={null}` и визуально молчит до загрузки chunk. | `.global-search-trigger`, `.global-search-backdrop`; `src/App.tsx`, `src/components/GlobalSearch.tsx` | Все, особенно 360/768 на медленной сети | Homepage Structure | **OPEN** |
| PERF-005 | P2 | Images | Карточки дублируют один source двумя `<img>` ради blur-backdrop. | `.article-image-backdrop`, `.library-card-image-backdrop`; `src/App.tsx`, `src/components/ArticleLibrarySection.tsx`, `src/index.css` | Все, особенно 360 | Homepage Structure | **OPEN** |
| PERF-006 | P2 | Rendering | Вся длинная страница ниже fold монтируется сразу: RU/360 около 32.1k px и 1451 DOM nodes. | Секции после `.atlas-shell`; `src/App.tsx`, `src/index.css` | 360, 768, RU/EN | Homepage Structure | **OPEN** |
| PERF-007 | P2 | Delivery budget | Production asset budget был занят примерно на 99%; mobile entry включает тяжёлые desktop resources. | Production assets; `scripts/audit-performance-budget.mjs`, build output | Все | Homepage Structure | **OPEN** |
| PERF-008 | P2 | Motion / energy | После стабилизации остаются многочисленные бесконечные декоративные анимации. | Header/social/share/subscribe glint, atlas loader; `src/index.css` | Все normal-motion, сильнее desktop | Final QA | **OPEN** |

## Предлагаемые исправления и автоматические критерии

| ID | Предлагаемое исправление | Критерий автоматической проверки |
|---|---|---|
| UI-001 | Общие semantic size/radius/focus/state tokens и shared primitives. | Unit fixture покрывает default/hover/focus/active/disabled/loading; loading не меняет geometry. |
| UI-002 | Отдельный deterministic visual spec; snapshots обновляются только вручную в review. | 10 base snapshots RU/EN плюс interaction/reduced-motion states; CI не выполняет auto-update. |
| UI-003 | `overflow-wrap:break-word`, корректный `lang`, управляемая hyphenation. | Набор длинных RU/EN имён не overflow и не разрывается до допустимой точки. |
| UI-004 | Оставить один основной KPI block, в секциях - только контекстные числа. | Duplicate-copy assertion и mobile DOM/screenshot budget. |
| UI-005 | Сократить только межстрочный grid gap footer menu, не меняя карту сайта. | Computed `row-gap` каждой из трёх основных колонок = 5 px на desktop; порядок/текст ссылок неизменны. |
| HEADER-001 | Единые `--page-gutter`/`--content-max` и content-wrapper; full-bleed только у фона. | Разница левых landmarks ≤2 px на целевой матрице RU/EN. |
| HEADER-002 | Edge fade/scroll hint, snap и `aria-current` либо компактное доступное меню. | Первый/последний пункт достижимы Tab/swipe; current объявлен; document overflow 0. |
| HEADER-003 | Close-on-outside и Escape с возвратом фокуса, не меняя разметку/стили поверхности. | Enter открывает menu; Escape закрывает и возвращает focus; pointer вне закрывает; панель не выходит за viewport. |
| HERO-001 | Расширить art-direction breakpoint для уже существующего mobile/tablet asset. | На 768 `currentSrc` равен утверждённому варианту; visual diff сохраняет композицию/логотип. |
| HERO-002 | Locale-aware soft breaks и balanced wrapping без изменения текста. | `scrollWidth <= clientWidth`; утверждённые 360/768 RU/EN snapshots. |
| ATLAS-001 | Active index, стабильные option id, `aria-activedescendant`, ArrowUp/Down, Home/End, Enter, Escape. | Полный APG-combobox сценарий; active option совпадает с выбранной страной. |
| ATLAS-002 | Непрозрачные semantic muted tokens и минимум 11-12 px для служебного текста. | Обычный текст ≥4.5:1, крупный ≥3:1 на обеих крайних точках градиента; Axe smoke. |
| ATLAS-003 | `min-width:0`, безопасные pseudo-elements и правильный wrapping; allowlist только осознанному horizontal scroll. | Вне allowlist ни один видимый элемент не выходит за viewport и не имеет `scrollWidth > clientWidth + 1`. |
| GLOBE-001 | Mobile bottom sheet/drawer либо motion-aware scroll+focus к заголовку панели. | После выбора панель пересекает viewport и focus находится внутри/на её начале. |
| GLOBE-002 | Keyboard candidate от центра камеры либо связанный текстовый список; объявление через live-region. | Без pointer: focus → ArrowRight → Enter открывает панель; live-region и panel называют одну страну. |
| GLOBE-003 | До активации `pan-y`, после явной активации `none`; видимый режим и Escape-выход. | Swipe до активации меняет `scrollY`; после - drag меняет камеру; tap выбирает; Escape возвращает scroll. |
| GLOBE-004 | `frameloop="demand"` после idle; ambient ограничить по времени/economical profile/Save-Data. | Auto off → demand; два canvas frame через секунду идентичны; trace без непрерывного WebGL. |
| GLOBE-005 | Разделить pending и committed state, блокировать конкурирующие переключения, добавить status. | Committed `aria-pressed` меняется только после готовности; pending имеет busy/status и не даёт layout shift. |
| GLOBE-006 | Сохранить фиксированную сцену, панель выводить overlay/side sheet. | Центр и диаметр глобуса после выбора остаются в согласованном допуске. |
| GLOBE-007 | Общий motion-aware scroll helper. | При reduce ни один `scrollIntoView`/`scrollTo` не получает smooth. |
| MOBILE-001 | 44px coarse-pointer hitbox без увеличения фирменной графики; миграция оставшихся families поэтапно. | Все enabled button/input/summary/icon-link при coarse pointer ≥44×44 и не перекрываются. |
| MOBILE-002 | Adaptive `aspect-ratio` и ограничение высоты author cards. | На 360 card ≤`min(80vh, 420px)`, контент не обрезан. |
| A11Y-001 | Общий контрастный focus token для `summary`. | После Tab outline не `auto`, indicator contrast ≥3:1, RU/EN snapshot. |
| A11Y-002 | `role=status`, `aria-live` и связанный `aria-busy`. | При задержке accessibility tree содержит именованный status/busy; после load busy снимается. |
| A11Y-003 | Locale-aware title/labels/sort и устойчивые локализованные empty states. | Одинаковый порядок landmarks; EN tree/title без RU copy и наоборот; сортировка текущим `Intl.Collator`. |
| A11Y-004 | Независимое от CSS доступное имя reader control. | Axe без `button-name`; RU/EN accessible name остаётся непустым на 320/360/390. |
| PERF-001 | Loading state и breakpoint/language-aware skeleton с устойчивым intrinsic size; не показывать empty до import. | Нет ложного empty; top landmarks меняется ≤8 px; CLS ≤0.1; hash deep-link точен. |
| PERF-002 | Three около atlas, books около books, search по intent; убрать тяжёлое из entry preload graph. | `dist/index.html` не preload-ит Three/book catalog; initial compressed JS+CSS ≤300 KiB. |
| PERF-003 | Компактный предсобранный индекс или Worker, загрузка по первому focus/open. | 0 builds до открытия, ровно 1 после; mobile TBT ≤200 ms, hydration long task <50 ms. |
| PERF-004 | Preload на hover/focus/idle и немедленный modal shell с busy/status. | При 2 s задержке shell появляется ≤100 ms; после загрузки input получает focus. |
| PERF-005 | Один semantic `<img>`; blur через pseudo/background либо off в economical/mobile. | На 360 в media ≤1 `<img>`; blur >8 px отсутствует в economical mode. |
| PERF-006 | IntersectionObserver mount либо проверенный `content-visibility:auto` + intrinsic size. | До scroll нет ресурсов далёких секций; initial DOM budget; direct hash сразу попадает в target. |
| PERF-007 | Route/initial budgets, responsive variants, исключение неиспользуемых originals из deploy artifact. | Total ≤85% потолка; mobile entry manifest не содержит desktop originals/textures. |
| PERF-008 | Декоративным анимациям один intro cycle либо hover/focus; infinite только активному loader. | После load нет decorative infinite animations; reduce - none/one iteration. |

## Findings, затронутые UI Foundation

### CLOSED

- `A11Y-001` - общий видимый focus для `summary`.

### PARTIAL

- `UI-001` - primitives и общий контракт сохранены для migrated controls; исторические кнопки шапки исключены по прямому решению владельца.
- `UI-002` - добавлены foundation и Header/Hero before/after-матрицы и автоматические geometry/state checks; screenshot-baseline всей главной остаётся Final QA.
- `ATLAS-002` - UI Foundation закрыл только migrated controls; Stage 3 закрыл основную Atlas microcopy, но остаток по `.globe-instruction`, selected-country labels и rendered forced-colors остаётся Stage 4 / Final QA.
- `MOBILE-001` - Header/Hero и migrated core controls приведены к foundation targets; legacy families остаются Final QA.

## Findings, закрытые Header + Hero Polish

### CLOSED

- `HEADER-003` - menus закрываются вне области и по Escape с возвратом фокуса; внешний вид не менялся.
- `A11Y-004` - reader control имеет устойчивое локализованное доступное имя.
- `UI-005` - слегка уменьшен только вертикальный gap белых footer menu items.

### PARTIAL

- `UI-002` - закрыта отдельная Header/Hero visual matrix; full-home snapshot gate остаётся Final QA.
- `MOBILE-001` - foundation targets сохранены; визуальные размеры исходных кнопок Stage 2 намеренно не меняет.
- `UI-001` - shared primitives сохранены, но исторические search/RU-EN/social/login controls являются явным owner-approved исключением.

### OPEN по решению владельца

- `HEADER-001`, `HEADER-002`, `HERO-001`, `HERO-002` - ранее подготовленные визуальные изменения отменены; обе полосы шапки и Hero оставлены точно в прежнем виде.

## Findings, затронутые Immersive Literary Planet

### CLOSED

- `ATLAS-001` - поиск атласа получил единый APG combobox для embedded и immersive presentation.

### PARTIAL

- `ATLAS-002` - основная globe copy, placeholders, search metadata и country metrics подняты до 12 px и более плотных colors. `.globe-instruction` остаётся 10 px, selected-country labels - 9-10 px; rendered forced-colors/gradient verification остаётся Stage 4 / Final QA.
- `ATLAS-003` - контейнеры Atlas и immersive overlays исправлены; глобальный legacy clip и overflow-причины вне Atlas остаются открытыми для Final QA/Homepage Structure.

`GLOBE-001`-`GLOBE-007` сознательно не закрываются этим Stage 3 PR и остаются Stage 4 scope.

### Stage 3 QA evidence

- TypeScript: **PASS - `npm run typecheck`**.
- Targeted reducer/combobox/URL/globe tests: **PASS - 5 files / 32 tests**.
- Full Vitest `--maxWorkers=4`: **PASS - 241 files / 1255 passed + 1 skipped**.
- Stage 3 Playwright current-source suite: **PASS - 9 passed / 9 intentionally skipped in 1.8 min**.
- Existing globe/responsive Playwright regressions: **PASS - 22 / 22 in 2.2 min**.
- Production build: **PASS - 1015 modules**; article/redirect generation: **161 articles / 2097 redirects**; SEO: **5262 ready**; domain: **11319 / 11319**.
- Performance: **PASS - 114,028,640 / 114,819,072 bytes; margin 790,432; 4323 files**.
- Visual evidence: [`reports/stage3-visual-evidence/README.md`](stage3-visual-evidence/README.md), **26 PNG + README**, P0/P1 отсутствуют. Остались P2 swipe-affordance у `.atlas-filters` и P3 визуальное дублирование selected label через collapsed mobile sheet header.
- Reduced motion: browser harness не предоставляет CSS media emulation, поэтому rendered screenshot не заявляется; economical capture является только performance-fallback proxy, а reduced-motion contract покрыт автоматическими state/tests.
- Full-tree `git diff --check`: **PASS - final full-tree run, exit 0; только CRLF notices**.

## Findings, закрытые Premium Globe Exploration

### CLOSED

- `GLOBE-001` - mobile country context стал immediate overlay peek и трёхпозиционным bottom sheet; keyboard/search path фокусирует видимый toggle/panel.
- `GLOBE-002` - реализован optical centre-ray candidate, ограниченный ocean fallback, filter/visibility guards, Enter и RU/EN live region.
- `GLOBE-003` - embedded coarse-pointer default возвращён к page pan, а full globe control включается явно и имеет возврат/Escape.
- `GLOBE-004` - Auto OFF/selected/Nobel/reduced idle используют demand, offscreen/hidden - never; continuous frames ограничены активным runtime source.
- `GLOBE-005` - requested/pending/rendered/failure style lifecycle разделён, `aria-pressed` следует rendered texture, race latest-wins.
- `GLOBE-006` - desktop drawer и compact sheet стали overlays; R3F остаётся единственным sizing owner, Canvas identity/geometry стабильны.
- `GLOBE-007` - camera/scroll/Atlas transition/sheet и связанные writer/Random/World переходы учитывают reduced motion.

### Stage 4 evidence

- Source/unit: camera rig/focus/projection, view observer/keyboard/touch, frame/idle/highlight/style, coordinates/Random/Nobel и writer/accessibility contracts.
- Runtime: `tests/e2e/premium-globe-exploration.spec.mjs` плюс существующие globe runtime и Stage 3 immersion regressions.
- SVG/flags: focused 360×800 and 390×844 QA across all three styles confirms one Canvas, crisp outlines/markers/control SVGs, on-demand-only flags and no duplicate country label/instruction beneath the open mobile sheet.
- Полное описание evidence: [`docs/GLOBE_EXPLORATION_UX.md`](../docs/GLOBE_EXPLORATION_UX.md) и [`reports/stage4-premium-globe-exploration-pr.md`](stage4-premium-globe-exploration-pr.md).
- Финальные численные QA counts, performance measurements и artifact registry зафиксированы в PR report и являются обязательным release-gate evidence; исторический текст findings при этом сохранён.

## OPEN findings по следующим этапам

### Homepage Structure

`UI-004`, `MOBILE-002`, `PERF-001`-`PERF-007`.

### Final QA

`UI-002` (остаток), `UI-003`, `ATLAS-002` (rendered forced-colors/gradient verification), `ATLAS-003` (остаток вне Atlas), `MOBILE-001` (остаток), `A11Y-002`, `A11Y-003`, `PERF-008`.

### Header + Hero (требует нового явного согласования)

`HEADER-001`, `HEADER-002`, `HERO-001`, `HERO-002`.

## Критерии будущих этапов

- Header + Hero: разница левых guides ≤2 px; mobile navigation полностью достижима; 768 использует утверждённый существующий art-directed source; RU/EN не переполняются.
- Immersive Literary Planet: APG combobox закрыт; основная Atlas microcopy исправлена, а остаток `ATLAS-002` явно перенесён в Globe UX Polish / Final QA. Видимый Atlas content не выходит за viewport вне явного horizontal-scroll allowlist; глобальный overflow-остаток проверяется Final QA.
- Globe UX Polish: **CLOSED в Stage 4** - keyboard-only selection, touch scroll/activation, immediate country presentation, committed/pending style lifecycle и demand idle подтверждены source/unit/E2E evidence выше.
- Homepage Structure: CLS ≤0.1; initial compressed JS+CSS ≤300 KiB; нет ложного empty-state; далёкие секции не грузятся до intent; deep links сохраняются.
- Final QA: deterministic visual matrix 5×2 плюс states/reduced motion; target-size/contrast/localization/loading semantics; snapshot updates только осознанным PR.

Автоматический merge всех этапов запрещён.
