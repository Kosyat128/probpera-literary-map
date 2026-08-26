# Миграции, импорт и восстановление

## Порядок применения Supabase

1. `supabase/schema.sql`
2. `supabase/migrations/20260727_community_safety.sql`
3. `supabase/migrations/20260728_cms_foundation.sql`
4. `supabase/migrations/20260728_reader_favorites.sql`
5. `supabase/migrations/20260730_literary_archive.sql`
6. `supabase/migrations/20260730_page_revision_history.sql`
7. `supabase/migrations/20260730_staff_management.sql`
8. `supabase/migrations/20260801_reader_profiles_and_forum_votes.sql`
9. `supabase/migrations/20260801_forum_reports.sql`
10. `supabase/migrations/20260802_client_errors.sql`
11. `supabase/migrations/20260802_editor_templates.sql`
12. `supabase/migrations/20260802_reader_journey.sql`
13. `supabase/migrations/20260803_public_article_view_counts.sql`
14. `supabase/migrations/20260804_content_analytics.sql`
15. `supabase/migrations/20260808_article_translations.sql`
16. `supabase/migrations/20260808_book_translations_and_import_staging.sql`
17. `supabase/migrations/20260812_homepage_block_revisions.sql`
18. `supabase/migrations/20260812_writer_and_work_revisions.sql`
19. `supabase/migrations/20260813_editorial_database_admin.sql`
20. `supabase/migrations/20260813_homepage_atomic_move.sql`
21. `supabase/migrations/20260813_tags_updated_at.sql`
22. `supabase/migrations/20260813_unified_revision_history.sql`
23. `supabase/migrations/20260814_publication_outbox_and_schema_health.sql`
24. `supabase/migrations/20260820_homepage_book_month_editorial_choice.sql`
25. `supabase/migrations/20260820_literary_work_cover_artworks.sql`
26. `supabase/migrations/20260822_staff_editorial_read_rls.sql`

Восьмая миграция добавляет безопасное редактирование профиля, загрузку
аватаров, любимые страны и писателей, репутацию и оценки тем форума. Она также
закрывает изменение служебной роли через публичный профиль и запрещает прямой
обход ограничений гостевых комментариев.
Девятая миграция добавляет встроенные жалобы на темы и ответы и отдельную
редакционную очередь их обработки без сторонних сервисов.
Десятая добавляет безопасный журнал клиентских ошибок и экран здоровья сайта.
Одиннадцатая переносит личные и общие шаблоны редактора из браузера в БД.
Двенадцатая добавляет статусы личной библиотеки, синхронизацию прогресса
чтения и подписки на страны, писателей и разделы.
Тринадцатая добавляет безопасный публичный счётчик просмотров статей.
Четырнадцатая добавляет агрегированную статистику переходов и чтения для
редакционной панели без передачи посетителям служебных данных.

Миграции 15-18 добавляют переводы статей и произведений, источники и внешние
идентификаторы книг, очередь импорта и восстановимые редакционные ревизии
главной страницы, писателей и произведений. Миграции 19-22 расширяют
редакторскую базу, атомарно меняют порядок блоков главной, защищают теги от
параллельной перезаписи и объединяют историю ревизий. Миграция 23 добавляет
транзакционный публикационный outbox, диагностический RPC и проверку версии
схемы для экрана здоровья админки. Миграция 24 атомарно заменяет устаревшую
системную подпись блока книги месяца на «Выбор редакции», не затрагивая
пользовательский текст.
Миграция 25 добавляет отдельное work-level хранилище редакционных обложек,
не приписывает иллюстрациям издательские ISBN, сохраняет неизменяемый
archive/image provenance и включает 21-й публикационный outbox-триггер.
Миграция 26 делает staff-only чтение черновиков статей, переводов и скрытых
метаданных медиатеки частью канонического ledger и добавляет отдельную
health-проверку всех трёх политик.

Перед каждой серией изменений обязательны четыре последовательных шага:

1. Запустить GitHub Actions workflow `Encrypted Supabase backup` и получить
   успешный зашифрованный артефакт.
2. Дождаться успешного изолированного `pg_restore --exit-on-error`, который
   выполняется тем же workflow и не затрагивает production.
3. Применить ещё не применённые миграции строго в порядке имени файла.
4. Открыть `/health` в админке и подтвердить текущую схему
   `20260822_staff_editorial_read_rls`, наличие всех 21 outbox-триггеров,
   трёх staff-only политик чтения и отсутствие ошибок очереди публикации.

Workflow требует GitHub Secrets `SUPABASE_DB_URL` и
`BACKUP_ENCRYPTION_KEY`. Нельзя подменять `SUPABASE_DB_URL` публичным URL API,
а ключ шифрования нельзя хранить в репозитории или логах Actions.

Для согласования уже работающей production-базы используйте только ручной
workflow `Reconcile production database` по инструкции
`docs/PRODUCTION_DATABASE_RECONCILIATION_RU.md`. Он сначала создаёт и
восстанавливает зашифрованную копию, проверяет весь план на изолированной базе
и лишь затем выполняет одну production-транзакцию.

## Импорт статей

Безопасная проверка:

```text
npm run content:import:cms
```

Применение выполняется только после проверки отчёта:

```text
node scripts/import-articles-to-supabase.mjs --apply
```

Тексты и заголовки не переписываются. Старый адрес сохраняется, новый
человекочитаемый адрес и редирект создаются отдельно.

## Литературная база

`src/data/countries` остаётся главным источником. Автоматически импортированные
писатели не публикуются как проверенные: редакция подтверждает имя, полное ФИО,
страну, годы, биографию, произведения, источники и права на портрет.

Синхронизация книжного архива сначала запускается без записи:

```text
npm run books:sync
```

Для batch обложек 20 августа сначала выполняется локальный dry-run, затем
read-only preflight всех обязательных таблиц и schema-health RPC, и только
после успешного согласования миграций - точечная синхронизация 41 canonical
work target (17 из них добавлены этим статическим batch) и 43 artwork-записей:

```text
npm run books:sync:covers-20260820
npm run books:sync:covers-20260820:preflight
npm run books:sync:covers-20260820:apply
```

## Восстановление

Перед каждым изменением статьи или постоянной страницы база сохраняет снимок.
Восстановление выполняется из соответствующего редактора. Удаление материалов
мягкое; окончательное физическое удаление требует отдельной процедуры и
резервной копии.
