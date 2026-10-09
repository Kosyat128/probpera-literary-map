# Основания R3 FINAL

Ниже новые R3 выводы с проверенными путями/символами, затем сохранённые основания R1/R2. Исходный SHA закреплён; применённая production-схема и авторизованный UI не проверены. Исходник — не доказательство развёртывания.

## R3E01. Опубликованный EN преждевременно считается current

Класс: SOURCE_CONFIRMED. Модули: M07.

Batch проверяет только status=published до helper, хотя helper сравнивает source_content_hash и ownership.

Ограничение: Не установлено, сколько реальных переводов устарело; side-effects и production-схема не испытаны.

Источник S11: apps/admin/app/(dashboard)/translations/article-actions.ts; lines 1–290 (complete returned file).
https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/app/(dashboard)/translations/article-actions.ts

Источник S12: apps/admin/lib/auto-translate-published-article-premium.ts; lines 1–265; remainder not re-read.
https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/lib/auto-translate-published-article-premium.ts

## R3E02. Успехи и дорогие попытки имеют разный предел

Класс: SOURCE_CONFIRMED. Модули: M07.

Лимит MAX_ARTICLE_TRANSLATIONS зависит от translated; conflict увеличивает failed, но не translated и не останавливает loop.

Ограничение: Это условие управляющего потока, не измерение фактического числа внешних вызовов/расходов.

Источник S11: apps/admin/app/(dashboard)/translations/article-actions.ts; lines 1–290 (complete returned file).
https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/app/(dashboard)/translations/article-actions.ts

## R3E03. Resume — staff bounded scan, не подтверждённый фоновый worker

Класс: EXISTING_CONTRACT. Модули: M07.

Resume читает cursor и вызывает batch; SQL сохраняет service-role-only claim/complete и обозначает staff sync. OFFSET сортирован по updated_at.

Ограничение: Устойчивость обхода при конкуренции требует DB-испытания. Нет утверждения об отсутствии всех остальных workers.

Источник S07: apps/admin/app/(dashboard)/translations/resume-action.ts; full.
https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/app/(dashboard)/translations/resume-action.ts

Источник S08: supabase/migrations/20260901_zz_translation_operations_runtime.sql; lines 300–690.
https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/supabase/migrations/20260901_zz_translation_operations_runtime.sql

Источник S11: apps/admin/app/(dashboard)/translations/article-actions.ts; lines 1–290 (complete returned file).
https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/app/(dashboard)/translations/article-actions.ts

## R3E04. Retry не проверяет deployed в самом обработчике

Класс: SOURCE_CONFIRMED. Модули: M04.

Обработчик получает status и создаёт новый requestPublicBuild без терминального guard.

Ограничение: Внешние дополнительные ограничения не испытаны; это не утверждение об обходе авторизации.

Источник S09: apps/admin/app/(dashboard)/publication/actions.ts; full.
https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/app/(dashboard)/publication/actions.ts

## R3E05. Publication имеет legacy fallback и проверку outbox ID

Класс: EXISTING_CONTRACT. Модули: M04.

PGRST202 и часть missing-function ошибок переводят вызов в compatibility queue; mark-dispatched/audit результат после dispatch не проверяется.

Ограничение: Underlying row-trigger может защитить исходную запись. Проверить эффективную схему; не удалять fallback вслепую.

Источник S14: apps/admin/lib/publication.ts; lines 1–290 (complete returned file).
https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/lib/publication.ts

## R3E06. Предпросмотр статьи ориентирован на внешнюю обложку

Класс: SOURCE_CONFIRMED. Модули: M05.

Выборка/рендер используют cover_external_url, не загружают managed cover по cover_media_id; часть query errors не выделена.

Ограничение: Не утверждается, что все обложки в текущих данных отсутствуют; нужен fixture с managed-only cover.

Источник S05: apps/admin/app/(dashboard)/articles/[id]/preview/page.tsx; full.
https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/app/(dashboard)/articles/[id]/preview/page.tsx

## R3E07. Окно вставки ограничено первыми 60 и permissive DTO

Класс: SOURCE_CONFIRMED. Модули: M11, M23.

API limit60+alt-only; client не передаёт page/cursor, не имеет навигации; не-массив assets превращается в [].

Ограничение: Это ограничение окна вставки, не всей медиатеки и не потеря файлов.

Источник S03: apps/admin/app/api/media/assets/route.ts; full.
https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/app/api/media/assets/route.ts

Источник S04: apps/admin/components/EditorMediaDialog.tsx; lines 1–290 (complete returned component).
https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/components/EditorMediaDialog.tsx

## R3E08. Собственный callback continuation

Класс: REQUIRES_EXECUTION. Модули: M01, M23.

Локальный safeNextPath + concatenation с adminSiteUrl; работа с code через exchangeCodeForSession.

Ограничение: Open redirect не доказан. Нужны нормализация/basePath/token-leak и replay тесты, без выдуманного CVE.

Источник S01: apps/admin/app/auth/callback/route.ts; full.
https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/app/auth/callback/route.ts

## R3E09. Восстановление пароля использует текущего provider user

Класс: EXISTING_CONTRACT. Модули: M01.

getUser → updateUser(password) → signOut; generic errors.

Ограничение: Фактические provider recency/MFA/recovery настройки и обновление токенов не проверены.

Источник S02: apps/admin/app/(auth)/reset-password/actions.ts; full.
https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/app/(auth)/reset-password/actions.ts

## R3E10. Официальные security контракты

Класс: OFFICIAL_GUIDANCE. Модули: M01, M18, M23.

Проверки доступа нужны у выдачи данных и действий; RLS/привилегии/assurance должны соответствовать реальной конфигурации.

Ограничение: Официальная latest документация не доказывает версию зависимостей проекта.

Источник DOC01: Data access layer, server actions and route handlers authorization; официальная документация.
https://nextjs.org/docs/app/guides/authentication

Источник DOC02: RLS, views, security definer and least privilege; официальная документация.
https://supabase.com/docs/guides/database/postgres/row-level-security

Источник DOC03: MFA enforcement depends on checked assurance and server/data boundaries; официальная документация.
https://supabase.com/docs/guides/auth/auth-mfa

## R3E11. create redirect: scalar UUID против data.id

Класс: CROSS_FILE_CONFIRMED. Модули: M13, M04.

SQL create_seo_redirect_guarded returns uuid, action передаёт data.id в requestRedirectBuild.

Ограничение: На соответствующем контракте data.id у строки undefined; runtime production не испытан. Trigger-event может сохранить underlying publication.

Источник S06: apps/admin/app/(dashboard)/seo/actions.ts; lines 1–310 (complete returned file).
https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/app/(dashboard)/seo/actions.ts

Источник S13: supabase/migrations/20260901_zzz_admin_mutation_guards.sql; lines 1–305; remainder not re-read.
https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/supabase/migrations/20260901_zzz_admin_mutation_guards.sql

Источник S14: apps/admin/lib/publication.ts; lines 1–290 (complete returned file).
https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/lib/publication.ts

## R3E12. Page preview читает canonical row

Класс: SOURCE_CONFIRMED. Модули: M19, M02.

Прямой read pages.content_html; notFound при отсутствии data без отдельной обработки query error.

Ограничение: После реализации рабочего draft preview нужно связать с выбранной редакцией; это не доказательство потери нынешнего содержимого.

Источник S10: apps/admin/app/(dashboard)/pages/[id]/preview/page.tsx; full.
https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/app/(dashboard)/pages/[id]/preview/page.tsx


---

# Наследованные основания R1/R2

Это исторический source review из предыдущего пакета, не новый runtime-аудит R3. Их ID оставлены для ссылок модулей.

# ОСНОВАНИЯ И ГРАНИЦЫ ДОКАЗАННОСТИ — ADMIN R2 FINAL

Проверка исходников: 23 сентября 2026 года. Источники — подключённый GitHub и официальная документация. В подготовке R1 не выполнялись изменения приложения или его тесты. R2 сохраняет этот baseline; дополнительно изучены перечисленные ниже обработчики/схемы и выполнены отдельные изолированные JavaScript-воспроизведения. Миграции, application tests, push и deploy в этой подготовке не выполнялись.

Ниже точные пути проверенного снимка. При переходе в Codex сначала сверить актуальный HEAD. Документы и прежние отчёты не имеют приоритета над проверенным текущим кодом и действующими инструкциями пользователя.

## E01. Проверенный исходный снимок

main = 63ce3112846e3e49f4b15d1cb64b3c29cb98af70, дата коммита 2026-09-14. Снимок проверен 2026-09-23. Нельзя считать его версией локального Codex или production без отдельной сверки.

Источник: `https://github.com/Kosyat128/probpera-literary-map/commit/63ce3112846e3e49f4b15d1cb64b3c29cb98af70`

## E02. Общий auth/MFA gate

В auth.ts ошибка assurance записывается как checkError при пустом required=false; requireStaff проверяет required, но не checkError. Это установленная особенность кода, не доказательство эксплуатации в production.

Источник: `https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/lib/auth.ts`
Источник: `https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/lib/admin-mfa-policy.ts`
Источник: `https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/app/(dashboard)/layout.tsx`

## E03. Открытая работа по DB MFA

PR #87 открыт, draft, не merged. Описание сохраняет opt-in MFA и отдельно предупреждает о review migration allowlist. Перед любым использованием сверить актуальный diff и текущие политики.

Источник: `https://github.com/Kosyat128/probpera-literary-map/pull/87`

## E04. safeCount и обзор

safeCount возвращает result?.count || 0. Dashboard использует точные подсчёты и статические подписи готовности; определение KPI требуется уточнить.

Источник: `https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/lib/format.ts`
Источник: `https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/app/(dashboard)/dashboard/page.tsx`

## E05. Загрузка редактора и команды

Редактор получает связанные данные и подставляет пустые массивы при отсутствии data; if (!article) вызывает notFound. Settings не разбирает ошибку staff query отдельно. Нужна проверка ошибок, а не объявление фактической потери данных.

Источник: `https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/app/(dashboard)/articles/[id]/page.tsx`
Источник: `https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/app/(dashboard)/settings/page.tsx`

## E06. Экран здоровья

Health оценивает часть признаков независимо от runtime self-test переводов, имеет markers и общий алгоритм их свежести. Фактические production markers не прочитаны.

Источник: `https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/app/(dashboard)/health/page.tsx`

## E07. Существующий переводческий процесс

Translations читает provider self-test и operations status; страница заявляет защиту ручных EN. Требуется сквозная проверка сохранности во всех маршрутах, не новая параллельная подсистема.

Источник: `https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/app/(dashboard)/translations/page.tsx`

## E08. Существующий publication outbox

Publication page показывает requested/dispatched/deployed/failed, число попыток и deployment run. Нельзя предлагать создание второй очереди как будто первой нет.

Источник: `https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/app/(dashboard)/publication/page.tsx`

## E09. Восстановление из истории

History page предлагает восстановить и сразу опубликовать. Action обновляет целевую запись, отдельно пишет аудит и вызывает requestPublicBuild; primary edition использует компенсацию. Это не готовая модель восстановления в draft.

Источник: `https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/app/(dashboard)/history/page.tsx`
Источник: `https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/app/(dashboard)/history/actions.ts`

## E10. Каталоги и Data Studio

В library есть серверная пагинация и самостоятельный work picker; основной title-поиск не включает все выбранные поля. Data Studio имеет ссылки в смежные workspace. Их целостность требует runtime-проверки.

Источник: `https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/app/(dashboard)/library/page.tsx`
Источник: `https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/app/(dashboard)/data-studio/page.tsx`

## E11. Каталог досье и live delivery

Список досье ограничен limit(50) без полного поиска/страниц. Dossier actions используют save_book_dossier, версии и live no-store delivery без public build.

Источник: `https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/app/(dashboard)/library/dossiers/page.tsx`
Источник: `https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/app/(dashboard)/library/dossiers/actions.ts`

## E12. Форма досье

В BookDossierEditor есть raw JSON для структуры/источников/прав. Dirty опирается на record и raw; network action не обёрнут локальной общей обработкой ошибки. Поведение нового draft и поздних ответов требует воспроизводящих тестов.

Источник: `https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/app/(dashboard)/library/dossiers/BookDossierEditor.tsx`

## E13. Новости: read-only очередь

Страница литературных новостей инструктирует редактировать reviewed.json через GitHub. Загрузчик читает held/source-state snapshots из ADMIN_CATALOGS KV. Редакционное хранилище нельзя создавать вторым независимым master.

Источник: `https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/app/(dashboard)/literary-news/page.tsx`
Источник: `https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/lib/literary-news-queue.ts`

## E14. Медиа уже реализованы

В Media Studio есть lifecycle, usage RPC, replacement, bulk metadata и роли. Uploader обрабатывает до 20 файлов и общие метаданные. Полнота графа использования и runtime-результаты не проверены.

Источник: `https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/app/(dashboard)/media/page.tsx`
Источник: `https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/components/MediaUploader.tsx`

## E15. Навигация и command palette

Есть общий module registry, sidebar и Ctrl+K. Palette ищет записи реестра и управляет Escape/фокусом ввода; это не поиск содержания. Полноценное modal focus behavior надо проверить/довести.

Источник: `https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/lib/admin-module-registry.ts`
Источник: `https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/components/AdminShell.tsx`
Источник: `https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/components/AdminCommandPalette.tsx`

## E16. SEO

SEO page читает missing CMS fields, показывает preview до 12 статей и управляет redirects. Публичный HTML/вычисленный canonical в этой проверке не проверяется.

Источник: `https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/app/(dashboard)/seo/page.tsx`

## E17. Аналитика

Есть get_admin_analytics_report и CSV; ссылка Метрики содержит period=month. Текущие реальные показатели не прочитаны.

Источник: `https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/app/(dashboard)/analytics/page.tsx`

## E18. Комментарии и команда

Индивидуальная comment action выбирает hidden→published, иначе→hidden; для pending отдельное одобрение не показано. Team и history используют user ID.

Источник: `https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/app/(dashboard)/comments/page.tsx`
Источник: `https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/app/(dashboard)/settings/page.tsx`
Источник: `https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/app/(dashboard)/history/page.tsx`

## E19. Site Studio

Существуют разделы components/tokens/fonts/releases, режимы управления/просмотра и обозначенные защитные границы глобуса/полки. Runtime-атомарность всех сценариев не доказана этой подготовкой.

Источник: `https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/app/(dashboard)/site-studio/page.tsx`

## E20. Deployment, scripts и каталоги

deploy-admin использует preseeded catalog SHA и отдельную сборку Worker. Package scripts содержат экспорт/генерацию, тесты и аудиты; команды требуют анализа побочных действий перед запуском.

Источник: `https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/.github/workflows/deploy-admin.yml`
Источник: `https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/package.json`
Источник: `https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/next.config.ts`

## E21. Время

Общий formatDate не задаёт timeZone. News queue formatter отдельно задаёт UTC и различает date-only. Нельзя объявлять всё отображение времени сломанным или менять уже сохранённые instants.

Источник: `https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/lib/format.ts`
Источник: `https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/lib/literary-news-queue.ts`

## Что нельзя утверждать по этой проверке

Не установлены: версия реально развёрнутого Worker; перечень применённых production миграций; значения реальных KPI; успешность backup/restore; полное покрытие RLS всех административных операций; фактическая скорость интерфейса; завершение авторизованных E2E; полнота media graph. Эти вопросы остаются проверками, а не готовыми выводами.

Ограничение списка 50 досье не означает удаление остальных записей. Наличие ошибки MFA в общем gate не доказывает, что production можно обойти через все маршруты. Наличие 12 count-запросов не доказывает причину медленной работы. Пустой CMS canonical override не доказывает отсутствие canonical в итоговом HTML. Открытый PR не означает, что его изменение применено.

## Принятые проектные решения

Использовать текущую CMS и специализированные workflow. Объединять представление статусов, а не менять live-доставку досье на Pages. Дорабатывать существующий outbox, историю, поиск и media lifecycle. Для новостей выбрать один master с предпочтением существующего Supabase при отсутствии более новой реализации. Разрешить восстановление в draft там, где есть подходящий workflow; не называть немедленный restore «черновиком». Ошибки должны блокировать опасные действия, а не всю независимую работу. Политику добровольного enrollment MFA не менять в обязательную.

Доработки проверок и интерфейса не разрешают массовую редактуру контента, замену источников, автоодобрение прав и запуск платных задач. Все предложенные размеры fixtures, относительный performance threshold и наборы экранов — критерии этого задания, а не измеренные показатели текущего сайта.

## Официальная документация, проверенная при подготовке

D01. Supabase MFA: правила проверяются также на backend/API/БД; есть opt-in-политика для verified-факторов. Использовать текущую совместимую реализацию, не копировать пример restrictive-политики на все таблицы без анализа читательского доступа.
`https://supabase.com/docs/guides/auth/auth-mfa`

D02. Next.js authentication: server actions и route handlers требуют самостоятельной авторизации; одного скрытого layout/UI недостаточно. Документацию сопоставлять с версиями проекта и Cloudflare/OpenNext, а не автоматически мигрировать runtime.
`https://nextjs.org/docs/app/guides/authentication`

D03. WAI-ARIA modal dialog: управление входным фокусом, Tab/Shift+Tab, Escape, возврат фокуса и модальность должны соответствовать объявленным ролям.
`https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/`

D04. Cloudflare KV: eventual consistency; KV не подходит как единственный источник атомарного конкурентного изменения/lock. Использовать версии snapshot и транзакционную БД для редакционных записей.
`https://developers.cloudflare.com/kv/concepts/how-kv-works/`

D05. Google Search Central canonical: проверять способ объявления канонического адреса и итоговую страницу; не делать вывод из одного поля внутренней CMS. Это не обещание выбора canonical поисковиком или ранжирования.
`https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls`

D06. Playwright authentication: состояние аутентификации может содержать чувствительные cookies/headers. Тестовые сессии не коммитить и не публиковать.
`https://playwright.dev/docs/auth`


# Углублённые основания R2

SOURCE_CONFIRMED означает установленное поведение в указанном исходнике. SOURCE_CROSS_FILE_INFERENCE — логический вывод из нескольких файлов, ещё не браузерное воспроизведение. Результат не доказывает развёртывание этой версии. Миграции изучены как код, не как effective production schema. Усечённые файлы имеют явно указанную область чтения.

## R2E01. Новая страница: непустой HTML и пустой JSON

Класс: `SOURCE_CROSS_FILE_INFERENCE`. Область: В pages/actions изучены create/save и начало status-flow; PageEditor: строки 1–260 и 450–610.

Установлено: createPageAction записывает построенный HTML одновременно с пустым JSON doc; useEditor предпочитает content_json через ||. Из этого следует риск пустого визуального начального документа и последующего перезаписывания. Реальная потеря существующей страницы не проверена.

Действие: Согласовать безопасные представления, legacy-режим и явную рабочую редакцию (M19).

Источник: `https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/app/(dashboard)/pages/actions.ts`

Источник: `https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/components/PageEditor.tsx`

## R2E02. Dirty снимается при отправке до server receipt

Класс: `SOURCE_CONFIRMED`. Область: Строки 450–610, onSubmit.

Установлено: persistLocalCopy() вызывается, а затем сразу setIsDirty(false), до ответа savePageAction; отрицательный возврат локального сохранения не используется. Успешность серверной записи из этого не следует.

Действие: Разделить submit, pending и подтверждение принятой локальной версии (M20).

Источник: `https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/components/PageEditor.tsx`

## R2E03. Query saved используется в автоматической очистке recovery

Класс: `SOURCE_CROSS_FILE_INFERENCE`. Область: Редактор страницы 1–180 и полный RecoveryController.

Установлено: Boolean(query.saved) передаётся как savedAfterSubmit, после чего контроллер читает pending receipt и удаляет exact autosave. Связь с соответствующим canonical commit в этом пути не установлена. Точность удаления не доказывает, что удаляемый текст сохранён в основной редакции.

Действие: Критическая автоочистка опирается на проверенный canonical receipt, а не URL; сохранить отдельный явный discard (M20).

Источник: `https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/app/(dashboard)/pages/[id]/page.tsx`

Источник: `https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/components/editor/RecoveryController.tsx`

## R2E04. Семантика ошибок recovery и существующая защита точного удаления

Класс: `SOURCE_CONFIRMED`. Область: Оба файла прочитаны полностью.

Установлено: {ok:false} при загрузке может игнорироваться; undefined от необязательного fallback трактуется не как false и может дать local. В то же время server load/delete уже ограничены actor_id, entity/scope либо exact session/sequence/hash.

Действие: Исправить отображение ошибок и scope клиентского состояния, не ослабляя серверную защиту (M20).

Источник: `https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/components/editor/RecoveryController.tsx`

Источник: `https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/app/(dashboard)/editor-autosave/actions.ts`

## R2E05. Рубрики/теги: прямые мутации и отдельный аудит

Класс: `SOURCE_CONFIRMED`. Область: Файл прочитан полностью.

Установлено: Изменение slug и удаление выполняются прямыми update/delete с expected_updated_at. Ответ insert в auditAndRequestBuild не разбирается. По самому action нельзя заключить, что нет DB-триггеров или зависимостей.

Действие: Impact preview, транзакционные dependency-проверки, достоверный audit outcome; сохранить outbox (M21).

Источник: `https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/app/(dashboard)/categories/actions.ts`

## R2E06. Базовая схема связей taxonomy

Класс: `SOURCE_CONFIRMED_BASE_SCHEMA_ONLY`. Область: Строки 1–220. Это базовая миграция, не подтверждение итоговой production-схемы.

Установлено: articles.category_id имеет ON DELETE SET NULL, article_tags.tag_id — ON DELETE CASCADE. Поэтому редакционное последствие удаления нужно проверять по актуальным FK и зависимостям, не только по наличию SQL error.

Действие: Проверить эффективную схему и запретить неосознанный разрыв связей/каскад (M21).

Источник: `https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/supabase/migrations/20260728_cms_foundation.sql`

## R2E07. Запись меню: self-parent gate и CAS уже есть

Класс: `SOURCE_CONFIRMED_HANDLER_SCOPE`. Область: Файл прочитан полностью; полная совокупность DB constraints не запускалась.

Установлено: Есть safeHref, self-parent и expected_updated_at; полного обхода предков и same-menu проверки в action нет. Audit insert обрабатывается отдельно без проверки результата.

Действие: Доказать инварианты дерева в БД/сервере и безопасное удаление ветки; не снимать существующие guards (M22).

Источник: `https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/app/(dashboard)/menus/actions.ts`

## R2E08. Невалидная область баннера может стать главной страницей

Класс: `SOURCE_CONFIRMED`. Область: Файл прочитан полностью.

Установлено: pagePatterns фильтрует строки без / и обрезает до 50; пустой результат заменяется ["/"]. Ошибочный непустой ввод не отличён от пустого нового выбора. startsAt/endsAt проходят строковую проверку длины, не полную семантическую проверку интервала в action.

Действие: Построчная валидация без молчаливых исправлений, preview охвата, время по явной зоне (M22).

Источник: `https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/app/(dashboard)/banners/actions.ts`

## R2E09. Публичные menu/banner guards уже существуют

Класс: `SOURCE_CONFIRMED_EXISTING_PROTECTION`. Область: Файл прочитан полностью.

Установлено: buildCmsNavigationForest обрабатывает циклы/сирот; cmsPagePatternMatches задаёт grammar и границы; cmsBannerIsActiveAt отвергает невалидные даты и исключает конец интервала.

Действие: Не заявлять отсутствие renderer-защиты. Согласовать write/preview с existing runtime и сохранить fallback (M22).

Источник: `https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/src/cms/siteChromeRuntime.ts`

## R2E10. Media upload: ранний multipart, проверенный файл и раздельная регистрация

Класс: `SOURCE_CONFIRMED_BOUNDARY_REQUIRES_RUNTIME_TEST`. Область: Файл прочитан полностью; общие edge-лимиты/cookie-CSRF конфигурация не испытаны.

Установлено: request.formData вне основного try и до File.size gate. Есть MIME/container/dimensions/pixel/SHA проверки. Storage upload и media_assets insert отдельные; результат компенсирующего remove не анализируется. Явная проверка Origin в этом handler не обнаружена, что не является доказательством production-exploit.

Действие: Тест фактической HTTP-защиты, лимита тела и saga/retry без порчи файла (M23).

Источник: `https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/app/api/media/upload/route.ts`

## R2E11. Font upload: content-addressed объект намеренно сохраняется

Класс: `SOURCE_CONFIRMED_EXISTING_PROTECTION`. Область: Файл прочитан полностью.

Установлено: Доступ owner/admin, запрещены удалённые шрифты, есть валидация файла. При регистрации с конфликтом общий объект не удаляется: это явно защищает другой concurrent request. Предусмотрен staged cleanup.

Действие: Сохранить защиту shared object; проверить границу запроса/очистку, не применять к шрифтам простую image-компенсацию (M23).

Источник: `https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/app/api/site-fonts/upload/route.ts`

## R2E12. Перевод site-copy до сохранения исходной правки

Класс: `SOURCE_CONFIRMED`. Область: Файл прочитан полностью.

Установлено: autoTranslateChangedRows вызывается до save_site_copy_block и может throw при проблеме runtime/provider. Уже есть защита manual EN, sourceHash и CAS.

Действие: Обеспечить сохранность рабочего RU/EN до внешнего запроса и совместимость bilingual release; не менять модели/флаги (M24).

Источник: `https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/app/(dashboard)/site-copy/actions.ts`

## R2E13. Site Studio: RPC-управление и runtime parsing времени

Класс: `SOURCE_CONFIRMED_HANDLER_SCOPE`. Область: Файл прочитан полностью; rollback RPC нужно сверить отдельно.

Установлено: Релизы управляются через существующие owner/admin RPC и версии. scheduledAt использует new Date(candidate).toISOString; смысл naive time зависит от среды. Форма rollback отправляет releaseId, но это не доказывает отсутствие проверки в SQL.

Действие: Единый контракт зоны и проверка фактического version-guard rollback; не строить новую студию (M16/M22/M24).

Источник: `https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/app/(dashboard)/site-studio/releases/actions.ts`

## R2E14. Очередь новостей — снимок обнаружения, не master решений

Класс: `SOURCE_CONFIRMED`. Область: Queue helper перепроверен на R1; страница изучена в исходном аудите, в R2 используется как baseline с тем же main SHA.

Установлено: KV-очередь имеет held validation, лимиты и source-state; показ/обнаружение не означает подтверждённую публичную карточку.

Действие: M10/M25 обслуживают существующую повестку, сохраняют решения независимо от смены временного snapshot.

Источник: `https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/lib/literary-news-queue.ts`

Источник: `https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/app/(dashboard)/literary-news/page.tsx`

## R2E15. Социальный worker в просмотренном пути работает со статьями

Класс: `SOURCE_CONFIRMED_PARTIAL_FILE`. Область: Строки 1–220, конфигурация и формирование article social text; остальная реализация не прочитана полностью в R2.

Установлено: Default required platform — dzen; vk отфильтровывается, если нет отдельного enable-флага; текст формируется из article. Это не доказывает реализованную Telegram/VK-доставку повестки.

Действие: Typed source/destination adapter, preview, receipt и unknown outcome; реальные отправки выключены в проверке (M25).

Источник: `https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/scripts/publish-social-content.mjs`

## R2E16. Transactional outbox уже предусмотрен для 20 таблиц

Класс: `SOURCE_CONFIRMED_EXISTING_PROTECTION`. Область: Строки 1–390 прочитаны. Применение этой и последующих миграций в production не проверено.

Установлено: After-mutation triggers создают durable событие в транзакции записи. Trigger event и explicit request намеренно сосуществуют. Миграция запрещает слияние pending по entity с переиспользованием ID из-за гонки high-water/export.

Действие: Поправка предварительного вывода: отдельный action-вызов requestPublicBuild не доказывает потерю очереди. Проверять effective trigger coverage и сохранять append-only semantics (M04).

Источник: `https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/supabase/migrations/20260814_publication_outbox_and_schema_health.sql`

## R2E17. Fast dispatch и фиксация его результата — разные действия

Класс: `SOURCE_CONFIRMED`. Область: Файл прочитан полностью.

Установлено: Fallback к audit-очереди разрешён только для подтверждённого missing RPC. Ошибки mark_public_build_dispatched и дополнительного audit insert после внешнего запуска не используются для итогового started.

Действие: Сохранить узкий fallback, отображать известный внешний и неподтверждённый внутренний исходы, reconciliation без слепого повторного запуска (M04).

Источник: `https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/apps/admin/lib/publication.ts`

## R2E18. Согласованный обычный/Premium snapshot уже защищён повтором

Класс: `SOURCE_CONFIRMED_EXISTING_PROTECTION`. Область: Файл прочитан полностью.

Установлено: Обычный exporter не публикует промежуточный GitHub output; Premium выполняется следом; при коде 75 оба прохода повторяются ограниченно; после исчерпания попыток прежний snapshot сохраняется.

Действие: Сохранить и испытать существующий механизм вместо замены exporter (M04/M18).

Источник: `https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/scripts/export-stable-published-content.mjs`

## R2E19. Dossier V2: backend-gates сильнее простой формы

Класс: `SOURCE_CONFIRMED_EXISTING_PROTECTION`. Область: Прочитаны schema/proof sections и строки 210–конец; часть середины первой выдачи была усечена. Утверждения относятся к видимым проверкам.

Установлено: Есть шесть последовательных human review, checksum/projection/rights checks, запрет full-text/quote/media и articleReuse без source approvals. Public RPC no-store отдаёт разрешённую проекцию с ограниченным validUntil.

Действие: Не обходить gates ради удобства досье; тестировать expiry/spoilers/варианты и явно показывать неподдерживаемые пути (M09).

Источник: `https://github.com/Kosyat128/probpera-literary-map/blob/63ce3112846e3e49f4b15d1cb64b3c29cb98af70/supabase/migrations/20260905_book_dossiers_v2.sql`

## R2E20. Повторная проверка main

23 сентября 2026 года подключённый GitHub снова вернул main = 63ce3112846e3e49f4b15d1cb64b3c29cb98af70. Автор/committer-дата коммита — 14 сентября 2026 года. Это не проверка локальных незакоммиченных изменений Codex или фактически развёрнутого Worker.

Источник: `https://api.github.com/repos/Kosyat128/probpera-literary-map/branches/main`

## R2E21. Первичные технические источники

Документация использована для контрактов безопасности и тестирования, не для вывода о конкретном production-состоянии проекта. Версии runtime и библиотек берутся из самого репозитория.

Supabase MFA: `https://supabase.com/docs/guides/auth/auth-mfa` — UI второго фактора не заменяет backend/RLS enforcement.
Next.js data security: `https://nextjs.org/docs/app/guides/data-security` — проверка чувствительных операций и данных у их серверной границы.
OWASP CSRF: `https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html` — защита cookie-auth мутаций, origin/proxy и дополнительные меры.
OWASP File Upload: `https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html` — несколько независимых ограничений загрузки вместо доверия MIME/имени.
Cloudflare KV: `https://developers.cloudflare.com/kv/concepts/how-kv-works/` — модель согласованности не превращает KV в транзакционную блокировку.
PostgreSQL isolation: `https://www.postgresql.org/docs/current/transaction-iso.html` — проверки конкурентных инвариантов в транзакциях; это не запрос обновить PostgreSQL проекта.
Playwright authentication: `https://playwright.dev/docs/auth` — изоляция тестового auth-state, который нельзя коммитить как обычный fixture.

## Исправления формулировок предшествующего аудита

1. Отдельный вызов requestPublicBuild в action не означает отсутствие durable записи: SQL уже содержит outbox triggers. Остаются проверка эффективной схемы, аудит и обработка fast-dispatch receipts.
2. Публичное меню уже защищено от циклов; доработка — write-side инварианты и операции с поддеревом, не удаление runtime-защиты.
3. Наличие public URL не доказывает ни права на картинку, ни её приватность в черновике.
4. Ограниченная выборка досье доказывает ограничение интерфейса, не потерю старых данных.
5. Количество блоков и сценариев — объём задания, не степень выполненности приложения.
