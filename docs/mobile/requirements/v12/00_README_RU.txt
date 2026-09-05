ФИНАЛЬНЫЙ ПАКЕТ V12 BILINGUAL OWNER-MINIMAL AUTOPILOT
«ЛИТЕРАТУРНАЯ ПЛАНЕТА — ПРОБА ПЕРА» / LITERARY PLANET — PROBA PERA

V12 заменяет все предыдущие V3–V11. Загружайте в Codex только итоговый
архив V12, не смешивая его со старыми промтами.

КАНОНИЧЕСКАЯ ОСНОВА
Существующая «Литературная планета» сайта probpera.ru и актуальный main
репозитория Kosyat128/probpera-literary-map.

ПЛАТФОРМЫ
- Web/PWA;
- Android Google Play;
- Android RuStore;
- iOS/iPadOS App Store.

ОБЯЗАТЕЛЬНЫЕ ЯЗЫКИ ПЕРВОГО ВЫПУСКА
- Русский — `ru`;
- English — `en`.

Русское название: «Литературная планета» / «Проба пера» / «Планетка».
English name: `Literary Planet` / `Proba Pera` / `Planetka`.

КОММЕРЧЕСКАЯ МОДЕЛЬ
`PAID_UPFRONT_WITH_OPTIONAL_NON_CONSUMABLES`

ПРОФИЛЬ ПЕРВОГО ВЫПУСКА
`SAFE_PAID_BILINGUAL_V1`

В базовую цену входят живой глобус, основной литературный архив, Starter
Set, Child Mode, Parent Center, Планетка/Planetka и offline essentials.
Подписки, рекламы, внутренней валюты и лутбоксов нет. Optional IAP не
обязательны. Disney/Pixar и другие защищённые материалы отсутствуют без
точной лицензии.

ЧТО ДОБАВЛЕНО И УСИЛЕНО В V12
- 100% обязательная русская и английская Base Edition;
- type-safe i18n, ICU plurals, placeholders, native resources and per-app
  language on iOS/Android;
- переключение языка без пересоздания глобуса и сброса состояния;
- verified English writer names, work-title strategies, quotations and
  transliteration aliases;
- cross-script search по RU/EN/native/transliteration с одинаковыми IDs;
- English Child Mode, Planetka, offline, errors, transcripts and audio rules;
- Translation Memory, glossary, source hashes, stale propagation, semantic
  review and editorial correction workflow;
- запрет сырого AI/MT-перевода и provider privacy/rights governance;
- синхронные RU/EN Privacy, Terms, refund, deletion, child and support texts;
- controlling-language and legal version gates;
- App Store, Google Play, RuStore and Web/PWA locale-specific metadata,
  screenshots and reviewer dossiers;
- Web `/ru/` and `/en/`, SSR, canonical, hreflang, sitemaps, structured data
  and stale-page noindex;
- exact-RC bilingual screenshots and artifact-bound evidence;
- bilingual owner approval and Russian/English post-build guides;
- machine-readable schemas for translation units, providers, legal docs,
  locale packages, search aliases, metrics and release evidence;
- S36–S40 bilingual stages;
- BIL-001–BIL-107 requirements;
- final no-return contract: у владельца нет задач по переводу или коду.

МАСШТАБ
- 342 трассируемых требования;
- 107 bilingual requirements;
- 41 этап S00–S40;
- 88 областей release readiness;
- 36 bilingual tests plus existing platform/device/moderation matrices;
- 2 обязательных языка;
- 0 programming/translation tasks for owner.

КАК ЗАПУСТИТЬ
1. Откройте репозиторий в Codex.
2. Загрузите один ZIP V12.
3. Вставьте `01_START_ONCE_RU.txt` либо `136_START_ONCE_EN.txt`.
4. Codex проверит MANIFEST/SHA256 и выполнит S00–S40.
5. При лимите используйте `02_RESUME_AUTOPILOT_RU.txt` либо
   `137_RESUME_AUTOPILOT_EN.txt`.

ПОРЯДОК ПЕРВОГО ЧТЕНИЯ
1. MANIFEST.json
2. 03_MASTER_EXECUTIVE_PROMPT_V12_RU_EN.txt
3. 03A_MODERATION_READY_EXECUTION_OVERLAY_RU.md
4. 03B_OWNER_MINIMAL_FINAL_OVERLAY_RU.md
5. 03C_BILINGUAL_ENGLISH_FINAL_OVERLAY_RU_EN.md
6. 68_REQUIREMENT_ID_INDEX.csv
7. 69_STAGE_ACCEPTANCE_MATRIX.csv
8. 89_CODEX_CONTEXT_ORCHESTRATION_RU.md
9. 95_STAGE_DOCUMENT_ROUTING.json

После этого Codex читает только документы текущего Stage. Единый master
TXT — резервный self-contained вариант, а не файл для повторного чтения в
каждой сессии.

ЧТО ОСТАЁТСЯ ВЛАДЕЛЬЦУ
- developer/merchant/legal accounts;
- tax/banking/trader verification;
- production secrets/signing;
- один owner-release-inputs.json;
- утверждение legal/rights/prices/territories/age/privacy/RU+EN visuals;
- manual Submit/Release;
- ответы модераторам;
- ручной merge PR.

Владельцу не должно требоваться переводить, программировать, собирать
AAB/IPA, вручную писать metadata, создавать English content, настраивать
hreflang или самостоятельно снимать screenshots.

ОТДЕЛЬНЫЕ ИНСТРУКЦИИ ПОСЛЕ СБОРКИ
- `ПОСЛЕ_ПОЛНОЙ_СБОРКИ_ПРИЛОЖЕНИЯ_V12_RU.txt`;
- `134_AFTER_FULL_BUILD_APPLICATION_OWNER_ACTIONS_EN.txt`.

ПРОВЕРКА
- MANIFEST.json
- SHA256SUMS.txt
- PACKAGE_VALIDATION_REPORT.json
- V12_FINAL_BUILD_REPORT.json
