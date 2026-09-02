# Безопасное согласование production-базы

Workflow `Reconcile production database` предназначен только для ручного
согласования production-схемы после обязательной резервной копии. Он не
запускается по `push`, расписанию или pull request и не должен использоваться
для повседневного редактирования данных.

## Однократная настройка GitHub

1. В `Settings → Environments` создать environment `production` и назначить
   required reviewers. Само поле `environment: production` в workflow не
   заменяет настройку обязательного подтверждения в интерфейсе GitHub.
2. Добавить GitHub Actions secrets:
   - `SUPABASE_DB_URL` - PostgreSQL URL именно production-проекта;
   - `VITE_SUPABASE_URL` - публичный API URL того же Supabase-проекта;
   - `BACKUP_ENCRYPTION_KEY` - отдельная случайная фраза длиной не менее
     32 символов.
3. Не передавать значения secrets в issue, pull request, чат, логи или файлы
   репозитория.

Workflow сверяет оба адреса с независимым, закреплённым в репозитории production
project reference `sjqejjmwpzfsczxdghvw`: API host должен совпасть точно, а
database URL должен быть direct endpoint этого проекта либо Supabase pooler с
пользователем `postgres.<project-ref>`. Многоадресные connection URI запрещены,
имя базы обязано быть ровно `postgres`, а query-параметры могут содержать только
`sslmode=require` или `sslmode=verify-full`; переопределения host/user/database
не принимаются. Дополнительно workflow требует TLS, базу
`postgres`, primary-инстанс и наличие
таблицы `public.articles`. Несовпадение останавливает запуск до резервного
копирования и любых изменений.

## Ручной запуск

Запускать workflow можно только из ветки `main`. Требуются два поля:

- `expected_main_sha` - полный 40-символьный SHA выбранного commit в `main`;
- `confirmation` - точная строка `RECONCILE PRODUCTION DATABASE`.

После environment approval workflow последовательно:

1. проверяет SHA, точное подтверждение, secrets и production identity;
2. создаёт custom-format `pg_dump` закреплённым образом
   `public.ecr.aws/supabase/postgres:17.6.1.136`;
3. шифрует копию AES-256-CBC/PBKDF2 и проверяет расшифровку побайтно;
4. до любых production-изменений загружает зашифрованную копию, её SHA-256,
   manifest и редактированный отчёт в GitHub Artifact; сбой загрузки
   останавливает job;
5. восстанавливает копию в изолированный PostgreSQL-контейнер;
6. на восстановленной копии одной транзакцией применяет строго 31
   проверенную миграцию от `20260808_article_translations` до
   `20260902_zz_article_working_drafts_health`;
7. проверяет ledger, 21 outbox-триггер, наличие work-level artwork, индексы,
   покрытие переводов, staff-only политики чтения, приватные рабочие черновики
   опубликованных статей и RPC `get_editorial_schema_health()`;
8. повторно сверяет SHA актуальной вершины `main`, чтобы не применить
   устаревший план после более нового deploy;
9. только после успешного restore drill применяет тот же план одной
   транзакцией к production; любая ошибка приводит к rollback;
10. повторно проверяет production и загружает финальный редактированный отчёт
    без секретов отдельным артефактом.

План строится по фиксированному списку SHA-256 миграций. Изменение
исторического SQL, собственные `BEGIN/COMMIT`, опасный DDL, неповторяемая
политика или несовпадение существующего ledger останавливают workflow до
production mutation.

Текущий точный health-контракт после согласования:

- версия `20260902_zz_article_working_drafts_health`;
- 31 запись в `probpera_schema_migrations`;
- все 21 публикационный триггер;
- staff-only чтение `articles`, `article_translations` и `media_assets`;
- таблица `article_working_drafts` с FORCE RLS, единственной staff-only
  SELECT-политикой, закрытым прямым DML, проверяемыми лимитами 5 MiB для
  русской и английской payload-оболочки и CAS-RPC сохранения/удаления;
- RLS-граница публикации: редактор может создавать и менять только
  `draft`/`review`, а публичные и запланированные строки доступны для записи
  только владельцу и администратору;
- та же RLS-граница действует для `article_translations`: редактор работает
  только с непубличным родителем и статусами `draft`/`review` (`stale` только
  при обновлении), без возможности выставить `approved`/`published`/`archived`;
- privileged release существующей статьи проходит через атомарный CAS рабочего
  черновика; версия `0` подтверждает отсутствие черновика, положительная версия
  обязана точно совпасть, а старый bundle RPC fail-closed блокируется guard-trigger;
- активный trigger, транзакционно удаляющий рабочий черновик после успешного
  перехода в `published`, `scheduled`, `hidden` или `archived`;
- актуальные outbox, история ревизий, переводы произведений, редакционные
  обложки и CMS-переопределения;
- отсутствие невалидных индексов.

## Если запуск остановился

Не запускать SQL вручную и не повторять workflow вслепую. Сначала проверить
`Step summary` и артефакт текущего запуска. Зашифрованная копия хранится
90 дней; ключ шифрования в артефакт не входит. Если ошибка произошла до
production-транзакции, база не менялась. Если ошибка произошла внутри неё,
`psql --single-transaction` и `ON_ERROR_STOP` выполняют rollback.

Ежедневный workflow `Encrypted Supabase backup` использует тот же общий
скрипт dump/шифрования/изолированного restore drill, поэтому проверка
восстановления не расходится с процедурой согласования.

## Атомарная публикация полного книжного архива

Полный архив публикуется внутри guarded workflow `Reconcile production
database` для того же SHA и только после успешной миграции и проверки
Evidence V2/atomic-release схемы. В environment `production` дополнительно
нужен secret `SUPABASE_SERVICE_ROLE_KEY`; его значение, как и
`VITE_SUPABASE_URL`, не выводится в лог.

После schema verification workflow проверяет закреплённый production API,
устанавливает lockfile-зависимости, выполняет read-only preflight полного
архива и повторно сверяет вершину `main`. Затем ровно один вызов `--apply`
загружает приватные bounded batches и меняет live-таблицы только одним
DB-side commit. Частичная публикация batch обложек запрещена. Ошибка до commit
оставляет прежний архив, а ошибка после ответа commit может оставить только
полностью зафиксированный атомарный результат.

Перед первым destructive commit миграция отдельно восстанавливает историческую
принадлежность ручных правок дочерних строк по двум production-журналам:
`admin_audit_log` и транзакционному `public_build_outbox`. Для переводов,
источников, внешних идентификаторов, изданий и artwork родительское произведение
получает `is_cms_locked = true` и полностью исключается из static replacement.
Событие с неоднозначным или отсутствующим `work_id`, а также явный CMS-маркер
без журналируемого события останавливает миграцию; отсутствие доказательств не
трактуется как отсутствие правок. `service_role`-синхронизации не считаются
ручными. Новые staff-правки атомарно добавляют запись в приватный append-only
ledger тем же child trigger, который ставит lock.

Read-only postflight принимает redacted receipt именно этого commit и одним
service-role RPC на согласованном снимке сверяет с приватным staged target весь
unlocked archive: work-поля, authorship, RU/EN translations, sources, external
IDs, editions, artworks, receipt исторических child-edit locks и точный набор
Evidence V2 attestations. Затем отдельно
проверяется сохранённый контракт пакета обложек 20.08.2026:

- ровно 43 artwork-строки с архивным SHA-256
  `0ad2a8f1c49573d51418bea2acf023a36b87db6e767b75dc869aa92f59b05cd3`;
- ровно 41 различное произведение и точный набор всех 43
  SHA-256 исходных изображений;
- раскладку 31 primary и 12 secondary artwork;
- наличие всех 41 ключа произведений, а у 17 новых
  произведений - одновременно переводы `ru` + `en` и не менее одного
  зафиксированного источника.

Любое несовпадение останавливает job. В лог выводятся только
итоговые счётчики: содержимое записей, URL и ключи не печатаются.
