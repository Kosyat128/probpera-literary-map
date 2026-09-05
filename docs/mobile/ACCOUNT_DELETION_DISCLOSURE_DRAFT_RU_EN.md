# Account deletion disclosure - RU/EN technical draft

Статус: **DRAFT - не для production**. Оба текста подготовлены с помощью AI по текущему коду S03. Это материал для редакционного, юридического и владельческого рассмотрения, не утверждённая политика. Тексты не установлены в `PLANET_DELETION_DISCLOSURE_JSON`; production policy instance не создан. Никакое требование или Stage этим документом не закрывается.

Область: существующий аккаунт «Пробы Пера» и текущий Web/PWA-процессор удаления обычного читателя. Применение к будущим native-редакциям, сроки хранения, юридические основания и правила платёжных провайдеров здесь не утверждаются. Код и формулировки нужно повторно сопоставить при изменении указанных исходников. Версия пары для рассмотрения: `s03-deletion-technical-draft-1`.

## Русский текст для рассмотрения

```text
Удаление касается вашего существующего аккаунта «Пробы Пера», с которым вы пользуетесь «Литературной планетой». Перед отправкой запроса нужно снова подтвердить вход в этот аккаунт.

Принятый запрос ещё не означает, что аккаунт удалён. После принятия запроса доступ к защищённой Web/PWA-редакции блокируется при проверке на сервере. Ранее подтверждённый доступ без сети может сохраняться до срока, указанного в последнем подтверждении.

Когда обработка завершена, удаляются аккаунт для входа, профиль читателя, сохранённые на сервере избранное, книжные подборки и их содержимое, прогресс чтения, подписки на страны, писателей и разделы, уведомления и записи о просмотрах, прямо связанные с этим аккаунтом. Записи другого пользователя и гостевые просмотры не удаляются только из-за совпадения браузерной сессии.

При обработке также удаляются принадлежащие вам файлы стандартного аватара. Если обнаружен другой связанный файл или его принадлежность не подтверждена, обработка приостанавливается. Часть файлов аватара может быть удалена до завершения удаления самого аккаунта.

Связанные с аккаунтом комментарии, темы, ответы, оценки, жалобы, служебные или редакционные записи требуют отдельного рассмотрения. При наличии таких связей обработка запроса приостанавливается. Эти записи не удаляются автоматически, а удаление аккаунта не считается завершённым. То же относится к данным, для которых ещё не предусмотрена безопасная обработка.

Записи платёжных событий и покупок сохраняются, а их прямая связь с удалённым аккаунтом убирается. В них остаются идентификаторы провайдера, события, операции и продукта, статусы, даты и контрольные хеши. Удаление такой связи не означает анонимизацию: провайдер может сопоставить свои идентификаторы с другими записями. Само удаление аккаунта не выполняет возврат оплаты и не удаляет записи у платёжного провайдера.

Сохраняется запись о запросе: его номер, статус, даты, служебные сведения о ходе обработки и контрольные хеши. Её прямая связь с удалённым аккаунтом также убирается. Номер запроса остаётся номером обращения, поэтому сохраните его для поддержки.

Удаление на сервере не очищает автоматически данные на всех ваших устройствах. Язык, настройки, локальное избранное, недавние материалы и файлы для работы без сети могут оставаться в хранилище браузера. Очистка данных сайта в браузере - отдельное действие.

Статусы «Запрос принят» и «Запрос обрабатывается» означают, что удаление ещё не завершено. Статус «Обработка приостановлена» требует обращения в поддержку. Проверить статус можно после входа в тот же аккаунт. Если войти уже нельзя или статус не удаётся получить, напишите на probperasite@yandex.ru и укажите сохранённый номер запроса. Ошибка входа сама по себе не подтверждает удаление.
```

## English text for review

```text
Deletion applies to your existing Proba Pera account, which you use with Literary Planet. You need to sign in again to confirm that account before sending a request.

An accepted request does not mean that the account has been deleted. Once the request is accepted, access to the protected Web/PWA edition is blocked when checked with the server. Previously verified offline access may remain available until the deadline in the latest verification.

Once processing is complete, we remove the account used for sign-in, your reader profile, server-stored favorites, book collections and their contents, reading progress, subscriptions to countries, writers and sections, notifications, and view records directly linked to that account. Another user's records and guest views are not deleted simply because they share a browser session.

Processing also removes the standard avatar files that belong to you. If another linked file is found or ownership cannot be confirmed, processing is put on hold. Some avatar files may be removed before deletion of the account itself is complete.

Comments, topics, replies, ratings, reports, staff records or editorial records linked to the account require separate review. Requests with these links are put on hold. Those records are not automatically removed, and account deletion is not considered complete. The same applies to data for which a safe handling process is not yet available.

Payment event and purchase records are retained, with their direct link to the deleted account removed. They retain provider, event, transaction and product identifiers, statuses, dates and verification hashes. Removing that link does not make the records anonymous: the provider may match its identifiers to other records. Account deletion itself does not issue a refund or remove the payment provider's records.

The deletion request record is retained, including its number, status, dates, processing details and verification hashes. Its direct link to the deleted account is also removed. The request number remains a reference for your case, so keep it for support.

Server-side deletion does not automatically clear data from all your devices. Your language, settings, local favorites, recently opened items and offline files may remain in browser storage. Clearing the site's browser data is a separate action.

The statuses “Request received” and “Request being processed” mean that deletion is not yet complete. A request that is “On hold” requires contacting support. You can check its status after signing in to the same account. If you can no longer sign in or cannot retrieve the status, email probperasite@yandex.ru with your saved request number. A sign-in error alone does not confirm deletion.
```

## Карта общих смысловых единиц и реализации

Каждый абзац RU соответствует абзацу EN с тем же порядковым номером. Номера DLD нужны для проверки пары и не являются новыми Requirement IDs. Проверка совпадения утверждений ниже - техническая сверка AI, не human translation approval.

| Unit | Общие обязательные факты RU/EN | Источник и текущая граница |
| --- | --- | --- |
| DLD-01 | Существующая единая identity; повторное подтверждение входа | [API](../../server/planet/api.ts): canonical principal, live session и recent authentication proof. [Account page](../../src/pwa/PlanetAccountPage.tsx) использует существующий AuthProvider. Второй аккаунт не создаётся. |
| DLD-02 | Принятие не равно удалению; online access blocked; offline proof имеет собственный срок | [Foundation SQL](../../supabase/migrations/20260905_literary_planet_web_license.sql), `planet_request_account_deletion`: `access_blocked_at`, `session_epoch`, request status. [PWA access runtime](../../src/pwa/PwaLicenseRuntime.ts) проверяет сохранённое подтверждение без сети. Не обещается мгновенный удалённый отзыв офлайн-копии. |
| DLD-03 | Удаление Auth account и связанных private rows; views только по user_id | [Canonical schema](../../supabase/schema.sql), [reader journey](../../supabase/migrations/20260802_reader_journey.sql): `profiles`, `reader_favorites`, `reader_book_collections`, `reader_book_collection_items`, `reader_book_favorites`, `reader_progress`, `reader_subscriptions`, `reader_notifications`. [Processor SQL](../../supabase/migrations/20260906_literary_planet_reader_deletion_processor.sql) удаляет `content_views where user_id=OLD.id` в Auth transaction; `planet_access_state` удаляется FK cascade. [Supabase adapter](../../server/planet/deletionProcessorSupabase.ts) вызывает `auth.admin.deleteUser(subject, false)`. Не утверждается очистка всех управляемых Auth-журналов/резервных копий. |
| DLD-04 | Только принадлежащий subject стандартный avatar; неподдерживаемые файлы блокируют; очистка Storage раньше Auth | [Processor](../../server/planet/deletionProcessor.ts), `isOwnedAvatar`: только `{subject}/avatar.jpg`, `.png`, `.webp` в `avatars`. [SQL](../../supabase/migrations/20260906_literary_planet_reader_deletion_processor.sql) проверяет owner/owner_id, путь и OLD+NEW при UPDATE. [Adapter](../../server/planet/deletionProcessorSupabase.ts) использует Storage API; SQL не удаляет blob напрямую. Удалённый blob не возвращается SQL rollback последующего Auth-вызова. |
| DLD-05 | Public contributions, staff, editorial и unknown data блокируют narrow processor | [SQL](../../supabase/migrations/20260906_literary_planet_reader_deletion_processor.sql), `planet_reader_deletion_blockers`: проверка роли reader, staff membership и identity FK, включая новые/неподдерживаемые связи. Существующие комментарии, forum topics/replies, votes/ratings/reports не стираются этим процессором; чужие ответы и последний owner сохраняются. Будущая обработка blocked-заявок не объявлена реализованной. |
| DLD-06 | Payment events/receipts сохраняются с NULL user_id; correlation остаётся; refund/provider erase не вызываются | [Foundation SQL](../../supabase/migrations/20260905_literary_planet_web_license.sql): `planet_payment_events` и `planet_purchase_receipts`, `ON DELETE SET NULL`. [Processor SQL](../../supabase/migrations/20260906_literary_planet_reader_deletion_processor.sql) сверяет точный набор колонок перед удалением; policy enum - `retain-provider-records-unlinked`. Нет provider refund/delete API в [processor adapter](../../server/planet/deletionProcessorSupabase.ts). |
| DLD-07 | Request ledger остаётся, user_id обнуляется; request number нужно сохранить | [Foundation](../../supabase/migrations/20260905_literary_planet_web_license.sql) и [processor SQL](../../supabase/migrations/20260906_literary_planet_reader_deletion_processor.sql): `planet_deletion_requests` сохраняет receipt/status/evidence и processor facts. UUID пользователя не копируется в новую колонку. Сохранённый номер обращения не объявлен анонимным. |
| DLD-08 | Server deletion не является очисткой всех browser stores | В [CLI/processor](../../server/planet/deletionProcessorCli.ts) нет устройства/браузера и команды очистки его хранилищ. [PWA help](../../src/pwa/PwaHelp.tsx) описывает существующие local settings/favorites/recent/offline stores; это отдельные данные на устройстве. Не заявляется автоматическая очистка remote/native device state. |
| DLD-09 | requested/processing/blocked не completed; status требует того же аккаунта; потеря входа не proof | [Account copy](../../src/pwa/accountCopy.ts), [account page](../../src/pwa/PlanetAccountPage.tsx), [account client](../../src/pwa/accountAccess.ts), [API](../../server/planet/api.ts), `account/deletion-status`. После фактического удаления Auth этот вход недоступен; existing support email и сохранённый request ID - путь обращения, не публичный токен статуса. [SQL](../../supabase/migrations/20260906_literary_planet_reader_deletion_processor.sql) разрешает completed только после guarded Auth removal и записи evidence. |

Точный сохраняемый платёжный набор: `planet_payment_events` - `provider`, `event_id`, `payload_sha256`, `transaction_id`, `user_id=NULL`, `product_id`, `status`, `occurred_at`, `accepted_at`, `receipt_applied`; `planet_purchase_receipts` - `provider`, `transaction_id`, `user_id=NULL`, `product_id`, `status`, `last_occurred_at`, `created_at`, `updated_at`. Это проверенные поля схемы, не утверждение о законном сроке или основании хранения.

В request ledger остаются `request_id`, `status`, `requested_at`, `updated_at`, `completed_at`, `evidence_sha256`, `blocker_codes`, `processor_phase`, `processor_policy_sha256`, `processor_started_at`, `processor_attempts`; `user_id` после Auth removal равен NULL. `processor_lease_token` и `processor_lease_until` очищаются при финализации, но могут присутствовать во время незавершённой обработки. Новая копия account UUID не добавляется.

## Точные решения до production-включения

Готовые тексты не заменяют внешнее рассмотрение. Нельзя подставить фиктивный `reviewEvidenceSha256`, считать наличие SHA подписью проверяющего или включить этот draft автоматически. Владельцу нужны решения по конкретным вариантам и представленным текстам, а не задача написать их с нуля.

| Decision | Что уже подготовлено | Что ещё требуется и кто рассматривает |
| --- | --- | --- |
| DD-01: disposition и retention платежей | Точный набор полей выше; реализован вариант retained + NULL user_id; прямо указана возможность correlation | Владелец и юридический reviewer утверждают применимость этого варианта, основания, сроки либо проверяемые условия окончания хранения, работу с записями самого провайдера и доступ к ним. Ни период, ни правовое основание в коде не заданы. Если выбран иной вариант - требуется отдельная реализация агентом и проверка, а не ручная задача владельцу. |
| DD-02: retention request ledger | Точные поля процесса/хешей, очистка lease при финализации и support receipt описаны | Утвердить срок/критерий удаления ledger и связанных операционных доказательств, доступ поддержки и способ подтверждения результата после удаления identity. Текущий authenticated status API не является публичной проверкой по одному номеру заявки. |
| DD-03: blocked-account handling | Причины и сохранность public/staff/editorial связей описаны без обещания автоматического удаления | Владелец, редакция/модерация и юридический reviewer выбирают обработку каждой категории: что удалять, что сохранять и как разрешать связи. Для staff нужен существующий безопасный порядок передачи полномочий. Срок обработки, ответственный и процесс сообщения результата ещё должны быть утверждены; narrow processor не реализует эти решения за них. |
| DD-04: системная граница удаления | Server rows, avatar API, offline/device boundary и отсутствие provider erase названы | Проверить фактически включённые managed Auth/Storage журналы, резервные копии, support correspondence и внешние сервисы/экспорты; установить их обработку и отразить итог в обеих версиях. Эти внешние данные здесь не объявляются ни полностью удалёнными, ни бессрочно сохраняемыми. |
| DD-05: покупка, доступ и частичная обработка | Online block после запроса; прежний offline proof до своего срока; refund не выполняется; avatar может исчезнуть до Auth removal | Владелец утверждает понятное пользователю поведение покупки/доступа, отдельный маршрут возврата и handling прерванного/blocked запроса. Ни отмена запроса, ни восстановление уже удалённого avatar, ни автоматическое перенесение покупки на новый аккаунт этим кодом не обещаются. |
| DD-06: RU/EN publication package | Девять синхронных абзацев, общие facts и source hashes; обе версии укладываются в существующий plaintext contract | Нужны human RU/EN semantic/editing review и юридическое рассмотрение окончательного содержания, затем владельческое одобрение конкретной версии и evidence. После любых решений выше агент синхронно обновляет обе версии, повторяет проверки и подготавливает конфигурацию; данный документ её не включает. |

Для DD-01-DD-06 не выбрана юрисдикция и не сформулированы правовые выводы. Это список недостающих решений и внешних входных данных, а не юридическая консультация. Тексты не содержат придуманных сроков, гарантий возврата, обещаний очистки backup или утверждений о завершении всех account deletion cases.

## Проверка и доказательства

Техническая семантическая карта и SHA находятся в [account-deletion-disclosure-draft.json](evidence/S03/account-deletion-disclosure-draft.json). Независимая проверка выполнения текущего кода находится в [deletion-processor-independent-review.json](evidence/S03/deletion-processor-independent-review.json). Последний документ проверяет локальные SQL/CLI сценарии, а не утверждает эти тексты или production policy. Новых binding-документов будущих Stage при подготовке не загружалось.
