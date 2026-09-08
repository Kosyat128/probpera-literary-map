# Текущая локальная приёмка UI polish V4

Status: **LOCAL_QA_PASSED_WITH_DOCUMENTED_LIMITS**. Срез: 2026-09-08T05:59:58.675Z.

Исходники: 9d483cf13525dbfe5d320e07eaf251692913d62bea7de214ba451aac0e560280, candidate 2026-09-08T05:26:33.821Z. Точное совпадение текущих файлов: true.

| Проверка | Фактический результат |
| --- | --- |
| Сборка | Domain=0, DomainBudget=0, Preview=0, Finished=2026-09-08T05:27:22.224Z |
| Lint | ExitCode=0, Finished=2026-09-08T05:22:59.5510400Z; reused: прежний TypeScript lint и текущий CSS audit (owner-revision-css-rebuild.log, 2026-09-08T05:27:22.213Z); новый полный lint не заявляется |
| Unit | Исторический полный Vitest: files 529 passed / 1 failed / 3 skipped; tests 3109 passed / 2 failed / 4 skipped. Последний governance: 24 passed / 0 failed / 0 skipped, artifact modified=2026-09-08T05:23:07.215Z; reused: единственная CSS-дельта вне allowedPaths, новый прогон не заявляется. Две ошибки закрыты точечным governance-прогоном; полный набор повторно не запускался. |
| E2E | Базовый целевой прогон: 65 passed / 5 failed / 8 skipped / 0 flaky. Addendum 1: 2 passed / 3 failed / 1 skipped / 0 flaky; source/base/prior context=true, actual execution=true. Addendum 2: 4 passed / 0 failed / 0 skipped / 0 flaky; source/base/prior context=true, actual execution=true. Закрыто базовых падений 5/5; осталось текущих выполненных ошибок 0. Исходных падений закрыто 31/31. Точечное закрытие подтверждено; базовый прогон сохраняет фактические ошибки, нового полного зелёного прогона не заявляется. |
| Фоны и кадры | Просмотрены 12 границ / 13 областей на 1440/390, capture 2026-09-08T05:28:37.997Z, reviewer root mobile; reader_controls desktop. |
| Защищённые материалы | Последний датированный срез 2026-09-08T04:16:48.839Z: 1451 paths, сохранность=true. Это не повторный аудит с новым timestamp. |
| Ресурсы | Runtime 284052 bytes; две производные на диске 346588 bytes. Одна alpha переиспользуется с CSS-цветом, белая производная сохранена отдельно. |

R04: logical shelf frozen; dev functions=true, order=true. [Кадры до/после](shelf-logical/review.html). R05: внутреннее прокручивание списка поиска и фокус=true; compiled-статус указан в E2E отдельно.

Открытые условия: нет в проверенном локальном объёме.

## Ограничения

- F11: локальная отключённая форма проверена без реальных записей. Live success/error, pending duplicate suppression и очистка после отправки not_verified; disabled success actions not_applicable.
- Safari/WebKit, Firefox, физические устройства, экранная клавиатура, физический screen reader и принтер not_verified.
- Полевые p75 LCP/INP/CLS, production HTTP404, все внешние медиа и все сложные опубликованные материалы not_verified.
- Skipped учитываются отдельно. Исторический полный набор и точечное закрытие ошибок не объединяются в выдуманный новый полный прогон.
- Ничего не публикуется в production этим helper. Локальная приёмка не является разрешением на публикацию.

## Источники

- [candidate-source.json](candidate-source.json): 2026-09-08T05:26:33.824Z
- [owner-revision-build-results.json](owner-revision-build-results.json): 2026-09-08T05:47:20.819Z
- [owner-final-lint-status.json](owner-final-lint-status.json): 2026-09-08T05:22:59.567Z
- [owner-final-e2e-result.json](owner-final-e2e-result.json): 2026-09-08T05:40:37.096Z
- [owner-final-e2e-status.json](owner-final-e2e-status.json): 2026-09-08T05:40:37.117Z
- [owner-final-e2e-addendum-result.json](owner-final-e2e-addendum-result.json): 2026-09-08T05:45:38.512Z
- [owner-final-e2e-addendum-status.json](owner-final-e2e-addendum-status.json): 2026-09-08T05:45:38.540Z
- [owner-final-e2e-addendum.log](owner-final-e2e-addendum.log): 2026-09-08T05:45:38.509Z
- [owner-final-e2e-addenda.json](owner-final-e2e-addenda.json): 2026-09-08T05:54:09.105Z
- [owner-revision-e2e-plan.json](owner-revision-e2e-plan.json): 2026-09-08T05:31:04.326Z
- [final-complete-unit.log](final-complete-unit.log): 2026-09-08T03:21:06.317Z
- [owner-final-governance.log](owner-final-governance.log): 2026-09-08T05:23:07.215Z
- [final-complete-e2e.log](final-complete-e2e.log): 2026-09-08T04:03:00.006Z
- [benchmark/protected-content-check.json](benchmark/protected-content-check.json): 2026-09-08T04:16:48.842Z
- [after/measurements.json](after/measurements.json): 2026-09-08T05:29:37.101Z
- [benchmark/final-seam-review.json](benchmark/final-seam-review.json): 2026-09-08T05:58:20.862Z
- [benchmark/benchmark-result.json](benchmark/benchmark-result.json): 2026-09-08T05:59:16.075Z
- [shelf-logical/result.json](shelf-logical/result.json): 2026-09-08T04:30:46.374Z
- [shelf-logical/layout-result.json](shelf-logical/layout-result.json): 2026-09-08T04:33:49.447Z
- [search-reveal-atlas-anchor-fixed/results.json](search-reveal-atlas-anchor-fixed/results.json): 2026-09-08T04:38:25.208Z
- [owner-revision-check-reuse.json](owner-revision-check-reuse.json): 2026-09-08T05:29:29.293Z
- [../../scripts/governance/ui-polish-v4-controls-20260908.json](../../scripts/governance/ui-polish-v4-controls-20260908.json): 2026-09-08T04:39:19.999Z
