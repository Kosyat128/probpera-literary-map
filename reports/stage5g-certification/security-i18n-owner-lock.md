# Stage 5G - security, i18n, owner-lock and accessibility evidence

Historical audit source commit: `d473278a7d0617f14b1d50938fda9bab5c464efa` on `chore/home-stage5g-certification`. Current generated main-sync marker: `c1939a632bc4c3d36649e7c4b2076fcc0711d2c4`.

Scope: static/source certification only. No production code, generated content, database, build artifact or remote environment was changed by this audit. Live HTTP, Docker/Postgres integration and full build/test are intentionally outside this evidence slice.

## Historical result at the Stage 5F baseline

**FAIL - certification gaps remain.** The narrow batch completed with **15/21 test files passing** and **114/122 tests passing**. The Community configuration audit passed. The interface-language audit failed with exactly **109 missing dictionary keys**.

## Commands and results

- `node scripts/audit-community-config.mjs` - **PASS**: `Сообщество и редакционная система: структура проверена.`
- `node scripts/audit-interface-i18n.mjs` - **FAIL**: 109 unique static `t(...)` phrases are absent from the interface dictionary; complete inventory below.
- One Vitest invocation over 21 security/RLS/i18n/owner-lock/reference/accessibility contract files - **FAIL**: 15 files and 114 tests passed; 6 files and 8 tests failed.

The passing contract files were:

- `scripts/cloudflare/configure-edge-security.test.mjs`
- `scripts/database/editorial-rls-contract.test.mjs`
- `scripts/database/reader-book-collections-migration.test.mjs`
- `src/cms-security.test.ts`
- `src/cms/editorialPersistence.test.ts`
- `src/cms/directEditRevision.test.ts`
- `src/community/articleEngagementSecurity.source.test.ts`
- `src/components/stage5Governance.test.ts`
- `src/components/headerHeroPresentation.test.ts`
- `src/styles/stage5fResponsiveAccessibility.test.ts`
- `src/components/stage5fMediaOwnership.test.ts`
- `scripts/lib/stage5c-layout-community.test.mjs`
- `src/components/bookShelfApprovedPresentation.test.ts`
- `src/components/BookShelfFrame.test.tsx`
- `src/components/BookShelfControls.test.tsx`

This proves the current AST owner locks for Header/Hero, Stage 4 single-Canvas ownership, current Stage 5 landmark order, canonical Book Archive controller and URL ownership, approved Bookshelf presentation contract, edge-security source contract, editorial/private-table RLS contracts, collection RLS contract, media ownership, focus/reduced-motion/forced-colors CSS contract and core shelf ARIA contracts all remain intact.

## Eight failing tests, classified

### Product blocker

1. `src/i18n/InterfaceLanguage.test.ts` - two failures: the registry completeness test and raw Cyrillic visitor-interface audit both expose the same 109 missing dictionary keys.
2. `src/i18n/stage5d1InterfaceCoverage.test.ts` - fixed inventory assertion is stale (`componentPhrases.size`: expected 150, current 215), and the missing translations prevent RU/EN certification.

### Portable-test blockers; reviewed source semantics remain intact

3. `scripts/database/article-rls-hotfix.test.mjs` - two SHA assertions fail only because the checked-out SQL files are `i/lf w/crlf`. All policy assertions pass (`to authenticated`, `public.is_staff()`, no `to anon`, no `using (true)`). Expected LF hashes are `e148b1f35cc49e1ed1eeb3bd116b625bfcd1784e7c32f6ee3baacc3f345cc82b` and `1b03d20025d5bc8bc8ec6ab1bf38f1d92fb8892650c6f466d39aa528d3b2abf8`; CRLF worktree hashes are `019668183a7eb2439119c015a1c1b74f3f9387012359e2e3a2d17fbf033a8a43` and `e59b24785e4e162086dcd912f2c3c7a325ae232855a1ef58d42e3a0ff1e4e8db`.
4. `scripts/release-hardening.source.test.mjs` - one LF-only substring assertion fails against `.github/workflows/deploy-pages.yml` checked out as `i/lf w/crlf`; the surrounding authorization assertions pass and there is exactly one `actions: write` grant.
5. `src/components/globeAccessibility.test.ts` - one stale source assertion expects literal `ref={rootRef}`. Current `LiteraryWorldMap` intentionally uses `ref={setRootNode}`; `setRootNode` forwards the same node to `rootRef` and also owns near-viewport activation. The accessible root and single Canvas ownership are retained.
6. `src/components/writerPanelAccessibility.test.ts` - one stale source assertion searches for `openBook(book, returnFocus)` inside `openWriterWork`. Current flow delegates to `openResolvedWriterWork`, where the exact call remains and immersive exit/focus restoration is preserved.

## Historical 109 missing interface dictionary keys

Keys are grouped by their first source file. A key used in multiple files appears once and includes its cross-file locations where relevant.

### `src/components/BookArchiveSection.tsx` - 60

- `Читаю сейчас`
- `Куратор: редакция «Пробы пера» · проверенные произведения`
- `Классика архива`
- `Куратор: редакция «Пробы пера» · проверенная классика архива`
- `Архив`
- `Редакционные полки`
- `Мои полки`
- `Новая полка` - lines 3082, 3874
- `Не удалось создать личную полку`
- `Периоды`
- `Только сохранённые книги`
- `Поиск временно недоступен` - also `GlobalSearch.tsx:259`
- `Книги на полке сохранены без изменений.`
- `Повторить поиск` - also `GlobalSearch.tsx:266`
- `Подсказки всего книжного архива`
- `Результаты поиска по всему книжному архиву`
- `Результаты поиска по текущей полке`
- `Открыты сведения о книге`
- `Состояние книжной полки`
- `Весь книжный архив`
- `Пока нет полок`
- `Подборка обновляется`
- `Пока пусто`
- `Настроить полку` - also `BookCollectionManagerSheet.tsx:305`
- `Качество`
- `Качество трёхмерной полки`
- `Некоторые книги больше недоступны в архиве`
- `Удалить ссылку`
- `Редакционная ссылка недоступна`
- `Свернуть сведения о книге`
- `Развернуть сведения о книге`
- `Сведения о книге`
- `Показать полностью`
- `Свернуть`
- `Навигация по редакционным страницам`
- `Предыдущая страница`
- `Следующая страница`
- `Управлять полками` - lines 4220, 4626, 4631
- `Добавить на полку` - lines 4221, 4627, 4632, 5218
- `В избранном`
- `В избранное`
- `Эта полка ждёт первую книгу` - lines 4463, 4667
- `Откройте весь архив, найдите произведение и добавьте его на эту полку.` - lines 4469, 4672
- `Попробуйте другое название, автора, страну или сбросьте фильтры.`
- `Выбрать книгу из архива`
- `Вернуться ко всему архиву`
- `Открыть весь архив`
- `Первая книга`
- `Позиция на книжной полке`
- `Последняя книга`
- `Личная библиотека` - also `BookCollectionManagerSheet.tsx:304`
- `Отметьте полки, на которых должна находиться книга.`
- `Доступные полки`
- `Создайте первую личную полку для этой книги.`
- `Умные и редакционные полки обновляются автоматически.`
- `Новая личная полка`
- `Например, Русская классика`
- `Создать и добавить`
- `Введите корректное название длиной до 120 символов.`
- `Не удалось сохранить изменение. Попробуйте ещё раз.` - also `BookCollectionManagerSheet.tsx:230`

### `src/components/BookCollectionManagerSheet.tsx` - 34

- `Проверьте название и настройки полки.`
- `Закрыть настройки полки`
- `Оформление и порядок этой полки видны только вам.`
- `Название`
- `Описание`
- `(необязательно)`
- `Знак полки`
- `Фон полки`
- `Подстраивать оформление под выбранную книгу`
- `Интенсивность оформления`
- `Сохранение…`
- `Сохранить настройки`
- `Книги на полке`
- `Книга недоступна в текущем архиве`
- `Автор не указан`
- `Переместить` - lines 485, 494, 503, 512
- `в начало`
- `В начало`
- `выше`
- `Выше`
- `ниже`
- `Ниже`
- `в конец`
- `В конец`
- `Убрать`
- `с полки`
- `Убрать с полки`
- `На этой полке пока нет книг.`
- `Состав умной полки формируется автоматически по сохранённым фильтрам.`
- `Удалить полку` - lines 562, 567
- `Книги останутся в архиве.`
- `Отмена`
- `Удаление…`
- `Удалить окончательно`

### `src/components/GlobalSearch.tsx` - 2

- `Не удалось подключить редакционный архив. Попробуйте ещё раз.`
- `Редакционный архив временно недоступен`

### `src/components/LiteraryWorldMap.tsx` - 3

- `Литературную планету не удалось открыть`
- `Глобус загрузится при приближении`
- `Повторить загрузку` - also `DeferredHomepageArchives.tsx:156,287,392`

### `src/loading/DeferredHomepageArchives.tsx` - 10

- `Книжный архив временно недоступен`
- `Книжный архив загрузится при приближении`
- `Место полки уже зарезервировано, поэтому страница не сдвинется.`
- `Авторский архив временно недоступен`
- `Журнал загрузится при приближении`
- `Место журнала зарезервировано до его открытия.`
- `Архив не удалось подключить`
- `Подключаем единый поиск…`
- `Проверьте соединение и повторите загрузку.`
- `Готовим страны, авторов, книги и публикации.`

## Historical certification disposition

- Security/RLS semantics in the selected static contracts: **PASS**, subject to making byte-hash checks line-ending independent or enforcing LF checkout.
- Header/Hero and Stage 4/Stage 5 owner locks: **PASS**.
- Approved Bookshelf reference and accessibility contracts selected for this slice: **PASS**.
- Full RU/EN interface coverage: **FAIL** until all 109 keys have reviewed English translations and both i18n audits pass.
- Source-contract portability/current-architecture alignment: **FAIL** until the four stale/CRLF-sensitive expectations are corrected without weakening their underlying guarantees.

## Current synchronized attestation

The historical failure counts above must not be read as the current main-sync
state. `STAGE5-FINAL-INTERFACE-COPY` now pins:

- source Stage 5F SHA: `d473278a7d0617f14b1d50938fda9bab5c464efa`;
- source main-sync SHA: `c1939a632bc4c3d36649e7c4b2076fcc0711d2c4`;
- interface registry: `1,186` entries, keys SHA-256
  `60b2bb015ee8ad6f6f727a314ee7fe9c02438defb93faea8c550a12f3271f74f`,
  pairs SHA-256
  `c18d82c71177cb967e61721e4d3285be2241d1ae6a4747c0d1839017a52cad67`;
- private interface catalogue: `1,400` entries, keys SHA-256
  `933287ece7fbbf41edcd5cae84bace76c8b4b80e47ba0789a4f83126cf1bb8b6`,
  content SHA-256
  `88285b0ec678388b207fd6a236ad97b4aadaf14f2acb36f8fe8ef3ce89218b57`.

This supersedes the old dictionary-count gap only. Final security and release
PASS claims still belong to their respective final gates, not to this narrow
historical evidence slice.
