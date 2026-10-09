# R3 FINAL: выводы дополнительной проверки

Задание уточнено на том же main 63ce311, подтверждённом повторным GitHub read. Новое чтение охватывает 14 конкретных файлов/фрагментов, а не всю историю репозитория. Авторизованное исполнение и production DB — NOT_RUN.

| ID | Что установлено | Следующее действие | Ограничение |
|---|---|---|---|
| R3E01 | Batch проверяет только status=published до helper, хотя helper сравнивает source_content_hash и ownership. | M07 | Не установлено, сколько реальных переводов устарело; side-effects и production-схема не испытаны. |
| R3E02 | Лимит MAX_ARTICLE_TRANSLATIONS зависит от translated; conflict увеличивает failed, но не translated и не останавливает loop. | M07 | Это условие управляющего потока, не измерение фактического числа внешних вызовов/расходов. |
| R3E03 | Resume читает cursor и вызывает batch; SQL сохраняет service-role-only claim/complete и обозначает staff sync. OFFSET сортирован по updated_at. | M07 | Устойчивость обхода при конкуренции требует DB-испытания. Нет утверждения об отсутствии всех остальных workers. |
| R3E04 | Обработчик получает status и создаёт новый requestPublicBuild без терминального guard. | M04 | Внешние дополнительные ограничения не испытаны; это не утверждение об обходе авторизации. |
| R3E05 | PGRST202 и часть missing-function ошибок переводят вызов в compatibility queue; mark-dispatched/audit результат после dispatch не проверяется. | M04 | Underlying row-trigger может защитить исходную запись. Проверить эффективную схему; не удалять fallback вслепую. |
| R3E06 | Выборка/рендер используют cover_external_url, не загружают managed cover по cover_media_id; часть query errors не выделена. | M05 | Не утверждается, что все обложки в текущих данных отсутствуют; нужен fixture с managed-only cover. |
| R3E07 | API limit60+alt-only; client не передаёт page/cursor, не имеет навигации; не-массив assets превращается в []. | M11, M23 | Это ограничение окна вставки, не всей медиатеки и не потеря файлов. |
| R3E08 | Локальный safeNextPath + concatenation с adminSiteUrl; работа с code через exchangeCodeForSession. | M01, M23 | Open redirect не доказан. Нужны нормализация/basePath/token-leak и replay тесты, без выдуманного CVE. |
| R3E09 | getUser → updateUser(password) → signOut; generic errors. | M01 | Фактические provider recency/MFA/recovery настройки и обновление токенов не проверены. |
| R3E10 | Проверки доступа нужны у выдачи данных и действий; RLS/привилегии/assurance должны соответствовать реальной конфигурации. | M01, M18, M23 | Официальная latest документация не доказывает версию зависимостей проекта. |
| R3E11 | SQL create_seo_redirect_guarded returns uuid, action передаёт data.id в requestRedirectBuild. | M13, M04 | На соответствующем контракте data.id у строки undefined; runtime production не испытан. Trigger-event может сохранить underlying publication. |
| R3E12 | Прямой read pages.content_html; notFound при отсутствии data без отдельной обработки query error. | M19, M02 | После реализации рабочего draft preview нужно связать с выбранной редакцией; это не доказательство потери нынешнего содержимого. |

## Что нельзя делать из этих выводов

Не объявлять production взломанным по отсутствующему локальному guard; не считать все EN устаревшими; не считать managed cover дефектом всех карточек; не называть tool error отключением сайта. Не удалять рабочие outbox triggers/SQL locks/ownership checks. Не выполнять массовое исправление текста, переводов, URL или пунктуации.

## Самые важные адресные исправления

Согласовать scalar UUID в SEO action и следующий publication RPC; проверять свежесть EN по исходнику; считать внешние попытки отдельно от успехов; завершить окно вставки media; связать preview с точной редакцией и managed-cover resolver. Остальные auth/cache/resume требования проверяются независимо по указанным уровням.
