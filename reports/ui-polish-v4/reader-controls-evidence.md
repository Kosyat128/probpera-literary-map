# R01-R03: reader evidence

Scope: existing ArticleReader, archive CTA, existing reading progress hint. No article documents, authored text, link targets, media sources, API fields or storage formats were replaced. The pre-existing book presentation uses live DOM/CSS columns; it had no page controls, page bounds or page indicator. No canvas or new reader library was introduced.

| Requirement | Confirmed defect and local correction | Evidence |
|---|---|---|
| R01, reader | RU/EN had computed 700; changed to the existing font's 400 weight. Global language state and pressed state retained. | before/reader-measurements.json and after/reader-measurements.json. Final CTA E2E checks computed 400 at 320/390/1440. Header is handled by root. |
| R02 | Small mobile cells (50px) inherited a horizontal flex layout; labels and numbers crowded at 320px. Scoped grid stacks real values above labels, restores regular labels, uses 84px mobile / 96px desktop minimums and tabular numbers. | Same real counts and texts in before/after measurements. CTA E2E checks 320/390/1440 overflow <=1px and labels >=13px. |
| R03 entry | Archive “Читать в новом режиме” only opened the current theme. | The same existing CTA now selects existing global book mode, opens the same article URL and keeps its exact title. CTA E2E. |
| R03 pages | Existing CSS columns formed a long vertical book; no turn controls or bounds. | Native scroll viewport over the same DOM, one/two columns, previous/next, actual page indicator, Home/End/arrows, bounded horizontal swipe. No text scale transforms or canvas. |
| R03 position | Existing progress stored a position hint but did not return it from its hook. | Hook now exposes the existing field. Book stores a text-node/offset anchor in that field and preserves it on fonts, resize, mode changes and reopening. No remote contract changes. |
| F05, reader | The book outline inherited dark text on the brown outside surface; page reflow did not preserve a content anchor. | Outline now uses the existing light paper token; content anchor is preserved at 1440→390, font increase, book→light→book and reopening. Live text/link/image signatures are identical. |
| F09, reader | Reader focus trap selected hidden targets and re-ran when an inline parent callback changed. App remount removed the original archive link. | Visible focus targets, stable close callback, bounded focus restoration to the live link in the originating section. Lightbox Escape returns focus to its image button; reader close returns to the exact CTA and unlocks body scrolling. |

Implementation files: `src/components/ArticleReader.tsx`, `src/components/ArticleLibrarySection.tsx` (CTA only; root also owns its background), `src/editorial/useArticleBookPagination.ts`, `src/editorial/readerFocus.ts`, `src/hooks/useReadingProgress.ts`, `src/styles/article-book-pagination.css`.

The typography audit has one exact exception for the bounded column page height, requiring the book-only selector, the page-height token, column count and `column-fill:auto` in the scoped pagination stylesheet. It still rejects ordinary prose heights, clipping, clamps and an equivalent exception outside that stylesheet. The guard has positive and negative tests; the real reader behavior is checked in Playwright.

Checks completed before the aggregate build:

- `tsc --noEmit`: exit 0 before the final focus helper; root aggregate lint/build will cover the final code.
- `node scripts/audit-typography.mjs`: exit 0, 27 stylesheets, 0 issues.
- `vitest run scripts/audit-typography.test.mjs src/components/ArticleReader.sources.test.ts`: exit 0, 17 tests. The first sandbox invocation could not read an esbuild parent directory; the same test command succeeded with approved escalation.
- `article-book-pagination.spec.mjs`: six paging tests passed in desktop/mobile Chromium on live dev, followed by two CTA/focus/metrics tests passed on the final helper.
- `git diff --check` for owned tracked files: exit 0.

Before evidence: `before/reader-1440-top.png`, `before/reader-1440-metrics.png`, `before/reader-1440-book.png` and equivalent 390px images; `before/reader-measurements.json`. Same article: `/stati/russkiy-yazyk/15-krylatyh-vyrazheniy-prishedshih-k-niz-biblii/`, 14,474 content characters, 1,803 words, 17 sections, 16 illustrations in the real counters. The screenshot capture uses the existing article URL, not a fixture. Interim `dev-after` images precede final focus and metrics refinements and are not final acceptance evidence.

Limits: no physical phone, WebKit or Firefox runtime has been verified here; swipe tests dispatch synthetic touch events in Chromium. Long article body, headings, image/link order and ending are covered. The later additional checks below also cover browser print media and request-only verse/table fixtures; a physical printer and every published poetry/table-heavy template remain unverified. Network-dependent original media availability is not asserted by text/link/image-source identity checks. No production publication or push occurred.

## Final aggregate-build acceptance

The root agent completed the final `build:from-snapshot` successfully. Browser checks below used its frozen local preview at `http://127.0.0.1:4186/probpera-literary-map/`, not the live development server or the public site.

- `reader-final-e2e.log`: all six paging tests passed. The two CTA setups initially failed because the built `/stati/` route is a static SEO archive, whereas Vite development returns the application there.
- The CTA setup was corrected to the actual homepage `/#journal`, where the tested “Читать в новом режиме” control exists. No application code changed. `reader-final-cta-e2e.log`: both tests passed, exit 0, 20.1 seconds. Thus all eight distinct scenarios passed on the final build; the initial setup failures remain disclosed in the first log.
- `capture-reader.mjs after`: exit 0. Final screenshots are `after/reader-{1440,390}-{top,metrics,book}.png`, plus `after/reader-{1440,390}-book-with-controls.png` showing the complete page surface and pager. The latter were added after observing that the viewport-only mobile screenshot cut the bottom controls out of its frame.
- Final measured values: reader language weights 400/400; metric labels 13px/400; desktop cells 96px, mobile cells at least 84px with natural two-line growth; real counters and 14,474 content characters unchanged; live book DOM has transform `none`, two columns at 1440px and one at 390px.
- `audit-interface-i18n.mjs`: exit 0, 1,219 registered phrases / 79 reachable visitor surfaces / 5 existing explicit Russian-only or brand exceptions. `InterfaceLanguage.test.ts`: 7/7 passed. Three new pager translations use the existing dictionary. The governance owner added exact reverse projections; historical data hashes remain unchanged according to that owner's 30 passing governance/accessibility tests.

## Coverage supplied to the root acceptance matrix

These are scoped evidence contributions, not assertions that every whole-site F requirement is complete.

| ID | Проверено этим подзаданием | Что этим не подтверждается |
|---|---|---|
| R01 | Reader RU/EN 400, active state retained, 320/390/1440 computed checks. | Шапка главной проверяется root. |
| R02 | Реальные метаданные, вертикальная сетка, отсутствие переполнения, читаемые значения и подписи. | Доступность удалённого счётчика просмотров; исходный «-» сохранён. |
| R03 | CTA текущей статьи и прежний URL; вперёд/назад, границы, индикатор, быстрые действия; неизменные text/link/image signatures и конец; anchor после resize/font/mode/reopen; keyboard, synthetic swipe, reduced motion. | Физический телефон и другой движок. |
| R06-R13 | Нет отдельной приёмки фонов этим подзаданием. | Все назначения и стыки находятся в evidence root. |
| F01 | Локальная геометрия метаданных и одно-/двухстраничного чтения на сопоставимых кадрах. | Композиция всех семейств сайта. |
| F02 | Не менялась. | Hero этим подзаданием не принимался. |
| F03 | Точный переход по CTA, история назад, возвращение фокуса в исходную секцию; прямой URL статьи. | Все уровни меню и маршрутов. |
| F04 | Рабочий CTA реальной карточки архива, тот же материал и URL. | Полная геометрия семейств карточек. |
| F05 | Длинная статья, заголовки, текст/ссылки/изображения, anchor, читаемое оглавление; расширенные интервалы, route-only стих/таблица, browser print media. | Все опубликованные стихотворные/табличные шаблоны, физический принтер и библиография во всех шаблонах. |
| F06 | Конечный авторский абзац доступен на последней странице. | Общий футер и служебные страницы. |
| F07 | Pager, границы disabled, язык, масштаб текста и понятные aria-label. | Все поля и микроэлементы сайта. |
| F08 | 320/390/1440 геометрия метаданных; mobile Chromium, одна страница, resize и сохранение anchor. | Физические устройства, экранная клавиатура, все мобильные панели. |
| F09 | Reader trap, видимые цели Tab, вложенная lightbox, Escape, возврат к изображению и исходному CTA, scroll unlock. | Остальные модальные семейства. |
| F10 | Возврат к исходному месту входа в архив. | Поиск, сортировки и сохранность выбранных фильтров. |
| F11 | Реальный disabled runtime, отсутствие активных rating/comment controls, сохранение email при переходах, два синтетических клика не отправляют запросы. | Success/error и suppression повторной записи в configured-service integration; реальная отправка не выполнялась. |
| F12 | Неизменные image src/order/count; световой просмотр открывается и закрывается; текст остаётся живым DOM. | Доставка всех оригинальных изображений и вся фоновая система. |
| F13 | Pager пересчитывается по load/error/resize/font events. | Полная матрица сетевых ошибок и загрузки. |
| F14 | Keyboard paging и границы, Tab trap, focus return, font resize, доступные имена; text spacing и клавиатурная прокрутка широкой таблицы. | Физический screen reader и полный инструментальный WCAG audit. |
| F15 | Существующий t/dictionary, три RU/EN pager translations, AST audit и 7 тестов i18n. | Визуальная приёмка всех английских материалов. |
| F16 | Reduced-motion не отключает листание; синхронный scroll исключает конкурирующие page animations. | Все анимации сайта. |
| F17 | Нет bitmap-копий текста, нового canvas, библиотеки или глобального DPR. | Сравнительные CPU/Web Vitals и полевые показатели. |
| F18 | Scoped typography guard, content identity E2E, i18n tests; общий build выполнен root. | Самостоятельная production/release готовность. |
| F19 | Пересчёт по реальной ширине/шрифтам/изображениям, последняя неполная пара имеет честный счётчик. | Все будущие варианты авторского форматирования. |
| F20 | Восемь paging/CTA reader-сценариев, четыре дополнительных сценария на локальной сборке и desktop/mobile before/after. | Все прочие строки QA_MATRIX и production. |

## Additional F05 / F11 / F14 checks

`tests/e2e/reader-extended-accessibility.spec.mjs` adds narrowly scoped scenarios. The first frozen-build run (`reader-extended-accessibility.log`) confirmed two passes:

- The actual article engagement card is `is-pending`, states that the server connection is required, and exposes no rating/comment submission fields or buttons. The actual login form has a disabled submit button. Two synthetic button clicks issue no REST/auth writes; an email using the reserved `.test` domain survives switching between forum and login tabs. All matching network routes were intercepted and blocked. No real message, rating, account or authentication request was submitted.
- On the actual long article, increased letter spacing 0.12em, word spacing 0.16em, line height 1.5 and paragraph margin 2em preserve text and usable book controls at 1440/390px. The last page remains reachable and the reader/header do not gain horizontal overflow.

Existing `community-browser.spec.mjs` already covers disabled login/registration, field semantics, password visibility and draft email preservation between community tabs. `articleEngagementSecurity.source.test.ts` covers the protected RPC-only path. Neither test asserts live success/error responses. In this build, comment/rating success, error-response handling, duplicate-write suppression while a real request is pending and post-success clearing are **not applicable to the disabled runtime UI** and remain **not_verified as configured-service integration**. No mock-connected clone or replacement form was presented as evidence for the real component.

The initial print check found a concrete defect: the inner book text expanded for print, but the outer reader remained fixed with a bounded scrolling surface. Root authorized a local print correction. `article-book-pagination.css` now releases reader/html/body heights and overflow only inside `@media print`, removes interactive chrome, and retains authored content. `useArticleBookPagination.ts` pauses measurement while print media is active and recalculates on return, preserving the reading anchor instead of marking the expanded print article complete.

On the shared dev server, `reader-complex-print-dev.log` confirms that print media has a static reader, visible overflow, automatic columns, hidden pager, complete unchanged article text and preserved anchor after returning to screen. This is browser print-media verification; it is not a physical printer test. The subsequent aggregate build includes this authorized print fix and passes the same scenario, as recorded below.

`reader-complex-dev.log`: request-only complex-content fixture passed at 1440/390px. The real article JSON response is extended only inside Playwright's route handler; no source document or public content file changes. The fixture has three lines separated by two `br` elements, six table headers, eighteen data cells, a caption and an ending marker. Line breaks, table counts and ending survive the renderer; the wide table stays inside the reading column. At 390px the table accepts focus and ArrowRight increases its own horizontal scroll offset. Initial fixture selectors were corrected to supported `id` attributes because the existing sanitizer intentionally removes unknown presentation classes; Vite JSON module imports are excluded from the fetch-only fixture handler. This test does not claim inspection of every published poem or table.

Artifacts for the focused checks are under `reader-complex-print-dev/` and `reader-complex-dev/`. The print test additionally checks that the stored progress percentage and position hint do not change merely by entering and leaving print media. `node scripts/audit-typography.mjs` after the print correction: exit 0, 27 stylesheets, 0 issues.

### Final built-preview confirmation of all four additional scenarios

Root's [owner-final-browser.log](owner-final-browser.log), entries 1-4, records all four tests in `reader-extended-accessibility.spec.mjs` passing on the rebuilt local preview at `http://127.0.0.1:4186/probpera-literary-map/`:

- Disabled community runtime / preserved form text / no writes: passed, 4.3 seconds.
- Actual reader with expanded text spacing: passed, 3.1 seconds.
- Request-only complex table and verse / semantics / keyboard scrolling: passed, 3.0 seconds.
- Print media / full text beyond screen page / unchanged stored progress and anchor: passed, 2.6 seconds.

The combined log also contains a separate background-test failure at entry 5; this report does not claim that the entire combined command passed. These four reader scenarios are complete for their stated local scope and are not repeated merely for the unrelated footer brand CSS change. The footer brand and header language capture has a separate report and final build gate.

## Later complete-batch finding: explicit End during delayed reflow

The later full `final-complete-e2e.log` finished with174passed/31failed/25skipped,38.7minutes. Its mobile text-spacing scenario found a new reader race after the earlier desktop scoped acceptance. The saved trace shows390px page57/count59 before End, page58/count59 immediately afterwards, then page59/count61 after a later reflow. Thus End initially succeeded but the subsequently enlarged document left the reader before its ending. The failure is not dismissed as DPR or a stale selector.

Authorized local correction: `ArticleReader` sends a semantic end request; `useArticleBookPagination` follows that endpoint across subsequent measurement, while ordinary reading still preserves the first visible text anchor. A deliberate page turn/outline target, exit from book mode or a new article clears end intent. Content and storage contracts are unchanged. The text-spacing E2E retains its assertions and adds deterministic height reduction/restoration after End, requiring real page count growth/shrinkage and disabled Next throughout.

This correction is **implemented, final runtime verification pending** the root's new build and targeted rerun. Earlier positive results above are historical scoped evidence, not proof of this later fix. Full causes and test-only base-path/R08 adaptations are recorded in [non-globe-e2e-triage.md](non-globe-e2e-triage.md). No new browser or build was launched by this subtask during the running full batch.
