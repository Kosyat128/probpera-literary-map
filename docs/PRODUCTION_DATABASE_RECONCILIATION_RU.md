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
   - `SUPABASE_DB_URL` — PostgreSQL URL именно production-проекта;
   - `VITE_SUPABASE_URL` — публичный API URL того же Supabase-проекта;
   - `BACKUP_ENCRYPTION_KEY` — отдельная случайная фраза длиной не менее
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

- `expected_main_sha` — полный 40-символьный SHA выбранного commit в `main`;
- `confirmation` — точная строка `RECONCILE PRODUCTION DATABASE`.

После environment approval workflow последовательно:

1. проверяет SHA, точное подтверждение, secrets и production identity;
2. создаёт custom-format `pg_dump` закреплённым образом
   `public.ecr.aws/supabase/postgres:17.6.1.136`;
3. шифрует копию AES-256-CBC/PBKDF2 и проверяет расшифровку побайтно;
4. до любых production-изменений загружает зашифрованную копию, её SHA-256,
   manifest и редактированный отчёт в GitHub Artifact; сбой загрузки
   останавливает job;
5. восстанавливает копию в изолированный PostgreSQL-контейнер;
6. на восстановленной копии одной транзакцией применяет строго одиннадцать
   проверенных миграций от `20260808_article_translations` до
   `20260820_literary_work_cover_artworks`;
7. проверяет ledger, 21 outbox-триггер, наличие work-level artwork, индексы, покрытие переводов и
   staff-only RPC `get_editorial_schema_health()`;
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

## Если запуск остановился

Не запускать SQL вручную и не повторять workflow вслепую. Сначала проверить
`Step summary` и артефакт текущего запуска. Зашифрованная копия хранится
90 дней; ключ шифрования в артефакт не входит. Если ошибка произошла до
production-транзакции, база не менялась. Если ошибка произошла внутри неё,
`psql --single-transaction` и `ON_ERROR_STOP` выполняют rollback.

Ежедневный workflow `Encrypted Supabase backup` использует тот же общий
скрипт dump/шифрования/изолированного restore drill, поэтому проверка
восстановления не расходится с процедурой согласования.

## Применение пакета обложек и произведений от 20.08.2026

Пакет данных запускается только после зелёного `Reconcile production
database` для того же SHA: таблица
`literary_work_cover_artworks` и актуальный schema-health RPC должны
уже существовать. В environment `production` дополнительно нужен
secret `SUPABASE_SERVICE_ROLE_KEY`; его значение, как и
`VITE_SUPABASE_URL`, не выводится в лог.

Вручную запускается workflow `Sync book cover batch 2026-08-20` из
ветки `main`. Поля запуска:

- `expected_main_sha` — точный текущий 40-символьный SHA `main`
  строчными шестнадцатеричными знаками;
- `confirmation` — точная строка
  `SYNC BOOK COVER BATCH 20260820`.

Workflow закрепляет checkout на указанном SHA, собирает точный
контракт пакета в dry-run, выполняет только чтением префлайт
схемы, CMS-lock и уже загруженных primary-обложек, затем
непосредственно перед первой записью повторно сверяет удалённую
вершину `main`. Upsert повторяем: одинаковый пакет не создаёт
дубли. Финальная service-role проверка требует одновременно:

- ровно 43 artwork-строки с архивным SHA-256
  `0ad2a8f1c49573d51418bea2acf023a36b87db6e767b75dc869aa92f59b05cd3`;
- ровно 41 различное произведение и точный набор всех 43
  SHA-256 исходных изображений;
- раскладку 31 primary и 12 secondary artwork;
- наличие всех 41 ключа произведений, а у 17 новых
  произведений — одновременно переводы `ru` + `en` и не менее одного
  зафиксированного источника.

Любое несовпадение останавливает job. В лог выводятся только
итоговые счётчики: содержимое записей, URL и ключи не печатаются.
