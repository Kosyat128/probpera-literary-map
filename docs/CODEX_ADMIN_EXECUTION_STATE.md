# Codex Admin Execution State

Phase 4 production baseline: `ff9f4853684208f37ac9deba8e14f4944f1fef51`

Current completion branch: `codex/admin-stage5-10-completion`

Last updated: `2026-09-01`

## Состояние реализации

- [x] Phase 5 - Site Studio: типизированный реестр компонентов, дизайн-токены,
  адаптивные состояния, наборы изменений, атомарные релизы и откат; публичный
  runtime/export; Direct Edit v2; безопасная загрузка растровых изображений.
- [x] Phase 6 - Data Studio: единый маршрут, канонические справочники стран и
  писателей, validated FK, ручной приоритет, SELECT-only/FORCE RLS, атомарные
  операции с изданиями и CAS/audit/outbox.
- [x] Phase 7 - Translation Operations: реальный provider self-test со строгой
  JSON-схемой, cooldown/lease и сроком 24 часа; безопасные коды ошибок; durable
  jobs/items/attempts и ограниченное продолжение по сохранённому курсору.
- [x] Phase 8 - Site Copy, SEO, комментарии, аналитика и операции: атомарные RPC,
  запрет обхода прямым DML, защита редиректов, агрегированная DB-аналитика и CSV,
  backup Storage manifest с SHA-256, restore verification и operational markers.
- [x] Phase 9 - единый типизированный реестр модулей для sidebar и command
  palette; все операторские маршруты покрыты и проверены.
- [x] Phase 10 - fail-closed schema health, закрытый словарь статусов, редактирование
  без вывода сырых PostgREST/provider ошибок, граница клиентских секретов,
  документация и матрица CMS-покрытия.

## Инварианты релиза

- Production migration plan содержит ровно 29 рассмотренных миграций с
  нормализованными SHA-256 и завершается
  `20260901_zzzzzz_admin_completion_health`.
- Итоговый health RPC наследует все прежние проверки и дополнительно закрывает
  Site/Data/Translation Studio, Direct Edit v2, last-owner, mutation guards,
  analytics и operational observability.
- Сверка БД выполняется только из exact `main`, после зашифрованной резервной
  копии и изолированной restore-проверки; несовпадение SHA, ledger или health
  останавливает применение.
- Клиентские chunks проверяются после production/OpenNext build; серверные
  secrets и их значения в `.next/static` запрещены.
- Глобус и книжная полка остаются `ownerLocked`: Site Studio не меняет их
  геометрию и интерактивные алгоритмы.

## Проверки текущего блока

- Admin TypeScript (`tsc --noEmit` и Cloudflare tsconfig): успешно.
- Финальный объединённый focused suite: **34 файла, 154/154 теста**.
- Production migration planner/schema-health suite: **21/21 тест**.
- Дополнительные профильные прогоны фаз до финального набора: Data Studio
  **11/11**, mutation guards **10/10**, Translation Operations **47/47**.
- `git diff --check`: ошибок нет; сообщения о будущей CRLF-нормализации на
  Windows не являются ошибками содержимого.
- Локальный OpenNext build на Windows остановлен известной junction-проблемой
  окружения (`node_modules` разрешается в другой диск). Кодовая проверка и
  typecheck зелёные; авторитетная production-сборка выполняется в чистом Linux CI
  из lockfile, без повторного локального прогона той же сломанной команды.

## Документация оператора

- [Матрица покрытия CMS](./CMS_COVERAGE_RU.md)
- [Data Studio](./ADMIN_DATA_STUDIO_RU.md)
- [Site Studio](./ADMIN_SITE_STUDIO_RU.md)
- [Translation Operations](./ADMIN_TRANSLATION_RU.md)
- [Восстановление редакционной работы](./ADMIN_RECOVERY_RUNBOOK_RU.md)
- [Backup, restore и operational checks](./ADMIN_OPERATIONS_RUNBOOK_RU.md)

## Граница текущего релиза

В этот блок не входят незавершённые изменения соседней задачи по глобусу:
`src/index.css`, `src/components/globeFilterStability.test.ts` и
`tests/e2e/literary-planet-immersion.spec.mjs`. Они не должны попадать в коммиты
админки. Dirty-файл `apps/admin/catalog-assets/editorial-catalog.json` также не
включается без отдельного подтверждённого содержательного изменения каталога.
