# S03/S04: независимая граница приёмки foundation

Read-only review, 2026-09-06. Исходники, tests и state не менялись; новые сборки, продуктовые тесты, remote actions и изменения статусов не выполнялись. Проверка immutable archive прошла:194 checksum entries,191 manifest records. Точный HEAD, SHA прочитанных источников и все mapped criteria записаны в companion JSON. Получаемые root результаты cloud/upstream после этого snapshot относятся к отдельной проверке.

S03 и S04 данным отчётом не приняты. S03 остаётся first-open.

## Главный вывод

Требовать полного merchant provider, полного Child Mode, всей системы download/audio или окончательной редакторской полноты до приёмки любой ранней основы создаёт цикл. Master прямо назначает S03 Web/PWA, S04 mobile shell/navigation, S06 globe/native lifecycle, S08 export/manifests, S11 offline/download, S16 child, S20 providers, S21 server entitlement lifecycle. Технические фундаментальные части этих требований реализуются раньше, но поздние реализации и проверки остаются обязательными и OPEN.

Это уже предусмотрено принятой локальной картой: `TRACEABILITY_MAPPING.md:9-10` различает implementationStages/validationStages и отдельные milestones. Глобальный PASSED требует их всех. Проблема не в проверке state, а в слишком общем тексте ранних критериев: notes часто повторяют полный глобальный ID, не называя проверяемую раннюю часть. Нужно конкретизировать раннее обязательство с исполняемыми доказательствами и ссылкой на позднее; нельзя удалять ID или переименовывать незаконченный код в credentials-only blocker.

Настоящие оставшиеся вопросы S03: установка/standalone relaunch PWA, поддерживаемые browser boundaries и точная область enabled-account deletion. Safe-reader processor реализован, но general MOD-030 не завершён: public contributors, staff и неизвестные связи останавливаются на blocked. Контакт поддержки сам по себе не доказывает удаление.

Настоящие оставшиеся вопросы S04: наблюдённая Xcode simulator build и фактическая работа устанавливаемой оболочки, включая native navigation/Back/launch-input/bootstrap boundaries. Android dev APK подтверждён. Пять Chrome host tests используют DOM fixture и injected ports: слово child в названии теста означает дочерний React элемент, а не защищённый Child Mode.

## Binding: точные основания и последовательность

| Источник | Точная цитата |
| --- | --- |
| docs/mobile/requirements/v12/69_STAGE_ACCEPTANCE_MATRIX.csv:5 | `S03,Paid Web/PWA edition,Install/license/offline/SW` и `all mapped internal requirements passed; evidence and atomic commit` |
| docs/mobile/requirements/v12/69_STAGE_ACCEPTANCE_MATRIX.csv:6 | `S04,Mobile shell and native projects,Capacitor; navigation; Android/iOS` и `previous stage complete or parallel-safe documented` |
| docs/mobile/requirements/v12/03_MASTER_EXECUTIVE_PROMPT_V12_RU_EN.txt:564 | `STAGE 3 — Web/PWA paid edition and isolated service worker.` |
| docs/mobile/requirements/v12/03_MASTER_EXECUTIVE_PROMPT_V12_RU_EN.txt:565 | `STAGE 4 — mobile shell, navigation, Capacitor, Android/iOS projects.` |
| docs/mobile/requirements/v12/03_MASTER_EXECUTIVE_PROMPT_V12_RU_EN.txt:567 | `STAGE 6 — canonical globe integration and native lifecycle.` |
| docs/mobile/requirements/v12/03_MASTER_EXECUTIVE_PROMPT_V12_RU_EN.txt:572 | `STAGE 11 — offline storage/download/update/rollback.` |
| docs/mobile/requirements/v12/03_MASTER_EXECUTIVE_PROMPT_V12_RU_EN.txt:577 | `STAGE 16 — child profiles, exact-age policy, Parent Gate, age assurance.` |
| docs/mobile/requirements/v12/03_MASTER_EXECUTIVE_PROMPT_V12_RU_EN.txt:581 | `STAGE 20 — StoreKit/Play Billing/RuStore Pay/Web purchase providers.` |
| docs/mobile/requirements/v12/03_MASTER_EXECUTIVE_PROMPT_V12_RU_EN.txt:582 | `STAGE 21 — server verification, entitlements, restore/refund/revocation.` |
| docs/mobile/requirements/v12/03_MASTER_EXECUTIVE_PROMPT_V12_RU_EN.txt:584 | `STAGE 23 — accessibility/localization/audio/privacy/security.` |
| docs/mobile/requirements/v12/03_MASTER_EXECUTIVE_PROMPT_V12_RU_EN.txt:585 | `STAGE 24 — performance/reliability/device/thermal/low-memory hardening.` |
| docs/mobile/requirements/v12/03_MASTER_EXECUTIVE_PROMPT_V12_RU_EN.txt:598 | `STAGE 37 — complete English UI, native, store, legal and support surfaces.` |
| docs/mobile/requirements/v12/95_STAGE_DOCUMENT_ROUTING.json:27 | `"S03-S10"` loads only18/21/22/23; commerce docs08/09/10/17/16 are routed at39-44; lifecycle/security docs19/20 at46-53. Эти будущие specialist documents в данном review не читались. |
| docs/mobile/TRACEABILITY_MAPPING.md:10 | `Passing an architecture or implementation milestone cannot pass a later integration, device, localization, legal, or exact-release-candidate milestone. Global PASSED requires every milestone to pass with applicable evidence.` |
| scripts/mobile/state.mjs:82 | `if (stage.status === "COMPLETE" && stage.criteria.some(item => item.status !== "PASSED"))` |
| scripts/mobile/state.mjs:113 | `if (!milestones.length || milestones.some(criterion => !allowed.includes(criterion?.status)))` rejects incomplete global implementation/validation. |

Правильное устранение цикла: сохранить все ID/поздние milestones; явно назвать и проверить ранний subset. Неправильное: объявить весь MOD/CHILD/COMMERCE ID завершённым, изменить утверждённые fingerprints, скрыть FAIL или принять этап по этому отчёту.

## S03: все12 текущих критериев

| Критерий | Текущая реальность | Необходимая ранняя приёмка | Обязательная поздняя работа |
| --- | --- | --- | --- |
| S03.acceptance | Пустые evidence/commit references у каждого criterion; есть многочисленные working evidence. | Согласовать точную раннюю область, закрыть её реальные gaps, привязать текущие source/output/commands и атомарный commit. | Не выдавать локальную foundation за release. |
| S03.BIL-019 | Lang/head/canonical/hreflang, route bootstrap и единый provider реализованы. | Привязать raw-HTTP/pre-hydration и runtime metadata тесты к post-upstream candidate. | S36/S40: полная архитектура/RC validation. |
| S03.BIL-075 | /ru/ и /en/ со стабильными reciprocal alternates, noindex. | Проверить реальный built HTTP output, а не только JS. | S36/S40: reviewed indexable discovery. |
| S03.BIL-076 | Self-canonical EN draft; approval не заявлен. | Сохранить честный noindex/draft gate. Не объявлять approved translation. | S36/S40: редакторское утверждение/indexable publication. |
| S03.BIL-077 | Локализованный начальный shell/body/head без JS; same App. | Matching language/body/head до hydration и после переключения. | S36/S40: complete reviewed content и точный RC. |
| S03.BIL-079 | Localized JSON-LD/social/404, excluded sitemap candidates и PWA manifests созданы; public HTTP404 edge binding реализован локально. | Связать domain/edge exact-body/status tests с артефактом. Не требовать запрещённый deploy. | S36/S37/S40: indexable sitemap, полностью reviewed public/RC discovery. |
| S03.COMMERCE-001 | Подписанная access boundary и denial/revocation tests; нет бесплатного production bypass. | Доказать paid-access trust foundation; QA signature не называть настоящей покупкой. | S12/S20: полная Base Edition/платные listings/providers; S25/26/28 release gates. |
| S03.COMMERCE-008 | Real crypto + canonical Supabase SDK/SQL, bridge/session/epoch, recovery и webhook port протестированы. Worker не предоставляет payment verifier и checkout-start. | Ранний scope: проверка подписи/subject/current session/expiry/denial и восстановление canonical identity. | S20 PSP checkout adapter и S21 реальный provider verification/refund/reconcile являются внутренним программированием, не только отсутствующими credentials. |
| S03.CONTENT-007 | Chrome20 проверяет cold offline writer/work/search/favorite/recent/help и whole-generation update/rollback; b006 добавляет saved-proof status. | Настоящий installed relaunch, реальные support boundaries; после новых изменений только обоснованные affected checks. | S08/S11 полные signed packages/migration/download/sync; S15/S16 child/Planetka; S39 полные EN packages. |
| S03.MOD-030 | Request/status/reload receipt, reauth, safe-reader processor с verified Auth deletion есть. Staff/contributors/unknown references блокируются; без disclosure submit отключён. | Либо честно определить safe-reader/request/status foundation с later lifecycle OPEN, либо для безусловного full MOD-030 реализовать все поддерживаемые категории до PASS. | S23/S26 broad enabled-account handling, managed data/backups/support boundary и production policy. Одного support email недостаточно. |
| S03.OMIN-023 | Local builder/audit/API/edge draft подготовлены; deploy запрещён пользователем. | Проверить воспроизводимый локальный staging package и fail-closed inputs. | S21 provider integration; S34 official draft automation. Deployment требует отдельного разрешения, не фиктивного выполнения. |
| S03.PLATFORM-001 | SW/integrity/coexistence/rollback есть. Настоящая OS PWA installation не доказана. | Реальный install → standalone launch → cold offline/relaunch → RU/EN плюс сохранение правдивых browser boundaries. | S11/S24/S25/S39 расширенный offline/device/soak; actual Safari/iOS checks остаются обязательными. |

Точные source-наблюдения:

- server/planet/worker.ts:135: `No provider is configured in this draft. Webhooks therefore return 503.`
- server/planet/api.ts:201: отсутствующий или чужой provider → `payment-provider-unconfigured`; это правильный отказ foundation, а не готовый checkout.
- server/planet/api.ts:259: отсутствие disclosure → `deletion-disclosure-unavailable`.
- server/planet/deletionProcessor.ts:7: `publicContributions: "block"`; SQL:116 блокирует non-reader role, SQL:176 публичные contributions.
- server/planet/deletionProcessor.ts:117-123: HTTP delete не proof; processor повторно читает durable SQL phase и завершает только auth-deleted. Точные динамически найденные строки сохранены в JSON.
- tests/pwa/cross-engine-pwa.spec.mjs:37: `physicalMobileDevice: false, safariVerification: false, nativeInstallationVerified: false`.
- docs/mobile/PWA_BROWSER_BOUNDARIES.md:9: исторические `4 passed, 2 failed, 0 skipped, 0 flaky`; строки16-17 оставляют Safari/macOS и physical iPhone/iPad unverified.
- tests/pwa/controlled-pwa.spec.mjs:22: helper installed() проверяет Service Worker completion. Его название не доказывает OS installation.

Политика и approval не подменяются кодом. 03B:131-133 требует minimum commerce identity с deletion/recovery/privacy/support; 03A:213-215 требует работающее удаление при enabled accounts. Девять согласованных technical RU/EN draft paragraphs и DD-01..DD-06 уже подготовлены в ACCOUNT_DELETION_DISCLOSURE_DRAFT_RU_EN.md:77-82. Owner/legal reviewer принимает конкретные retention/disposition/timeline/controlling-language решения; последствия, требующие кода, реализует агент. Ни срок, ни approval, ни anonymization provider records не выдуманы.

## S04: обязательства ранней оболочки и поздних владельцев реализации

| ID / группа | Текущая основа и ранняя проверка | Что остаётся поздним и обязательным |
| --- | --- | --- |
| S04.acceptance | Нельзя принять по Android APK + web-only iOS sync + DOM fixture. Нужны наблюдённый iOS build и проверяемые shell boundary obligations. | Final release/полный device matrix не включаются глобальным блокером всех ранних действий. |
| CANON-008, PLATFORM-004 | Один bundled canonical App; dev APK реально скомпилирован и независимо проверен. После изменения source нужен соответствующий новый candidate, не переименование старого. | S06/S25/S39: actual globe/native/device parity. |
| PLATFORM-005 | Сейчас checkpoint имеет nativeBuildVerified:false. Получить реальный Xcode simulator build, exact resolved Swift commit, .app identity/payload и xcresult. | Реальный simulator/device запуск и iPad/physical matrix — отдельные проверки S06/S25/S39. |
| PLATFORM-002/003, MOD-037 | dev/googlePlay/ruStore flavors и channel mismatch guard есть; storeVariantBuildsVerified:false. Проверить выбор канала и отрицательные mismatches; не называть debug shell store release. | S20 exclusive real providers/links; S26 release AAB/RuStore artifact; S28/S39/S40 final artifact checks. |
| PLATFORM-006 | Подготовить/проверить archive configuration и точные signing inputs. | Master:116-117 условно требует archive при signing credentials. S26/S34 archive не заменяется unsigned simulator zip. |
| PLATFORM-007, UX-002, SEC-003 | Reused App сам по себе не доказывает native Back/modal-return/launch links. В inspected host/adapters нет appUrlOpen/getLaunchUrl/backButton registration. Проверить installed navigation; реализовать или явно отклонять неподдерживаемый launch input через canonical selectors. | S07 responsive navigation, S08/S11 package validation, S23 security, S24/S25/S39 full device cases. Это отсутствие конкретной integration evidence, не утверждение, что default OS Back обязательно сломан. |
| CHILD-006/007/009, MOD-043 | mountHostApp:38-56 ждёт только locale и затем монтирует App. Нужен проверяемый pre-content policy/route denial contract: unknown/pending/failed/child-required не превращаются молча в adult frame. Не рекламировать отсутствующий child UX. | S05 entry/onboarding, S16 настоящие profiles/PIN/age/data isolation, S20 callback, S25/S39 full no-bypass. Не требуется преждевременно строить второй child store ради таблицы. |
| A11Y-003 | Проверить текущую shell/navigation при large system text, narrow/landscape и accessible statuses на настоящем host. | S07/S23/S25/S39 полный Dynamic Type/VoiceOver/TalkBack. Physical accessibility checks не отменяются. |
| BIL-016/017/018 | Resources/locales/bootstrap/persistence и compiler/APK tests есть. Проверить реальный per-app RU/EN/unsupported fallback на installed host; same provider/state сохраняются. | S36 language-source arbitration/system option; S37 complete reviewed native strings; S39 real device equality. Наличие строк не означает human review. |
| OMIN-009/011 | AccountlessReaderProvider, native backend guards, отсутствие account SDK/push/behavioral analytics поддерживают safe default. Проверить реальный core без account prompt. | S23/S32 final profile/privacy; S39 runtime/bilingual validation. |
| COMMERCE-012, MOD-035/036, PLATFORM-008 | Exact current toolchain/channel boundaries сейчас; реальные Play/RuStore providers отсутствуют. Не вставлять deprecated/mock SDK ради раннего PASS. | S20 provider code — internal; S26/S28/S33/S40 current RC billing/toolchain/signing. Credentials не заменяют adapter implementation. |
| MOD-034 | CI assertion exact Xcode не равен фактическому Xcode build. Реальную проверку должен дать cloud run. | S26/S28/S40 повторная проверка актуальных RC правил. |
| MOD-031/032/033, SEC-006 | Exact minimal manifests/plugins/resource inventory и dev APK inspect есть. Любое реально включённое сейчас sensitive permission требует rationale/denial path сейчас; narration не оправдывает microphone. | S15 audio, S16 child privacy, S23 full inventory, S28/S33/S37/S39/S40 exact production declarations. |
| OMIN-029/031 | Сейчас технические privacy manifests/package/signing inputs. Missing registration не external-only, пока нет точных подготовленных инструкций. | S23/S33 actual archive privacy report/Required Reason API/developer verification; S40 final evidence. Нельзя придумать report отсутствующего archive. |
| PERF-008 | Host listener refcounts/races/cleanup измерены structural tests. Минимальный installed background/resume smoke ещё нужен; snapshot не доказывает pause/restore WebGL. | S06 actual globe lifecycle, S24 50 cycles/thermal/soak/memory, S25/S39 devices. |
| UX-001 | Canonical splash/logo geometry/resources проверены. Снять настоящую launch sequence/safe-area/orientation; generated image не доказательство отсутствия white/black flash. | S05 onboarding/transition, S25/S37/S39 exact localized visual evidence. |

Основания реальных проверок:

- 21_VISUAL_UX_CANON_RU.md:21-28 требует orange splash, отсутствие white/black flash, top-left logo после safe area и real globe after bootstrap.
- 21_VISUAL_UX_CANON_RU.md:121-123: `For each visual stage save reference, implementation screenshot, side-by-side/diff, intentional differences, accessibility report, safe-area report, tap-target report and provenance confirmation.`
- 22_ACCESSIBILITY_LOCALIZATION_AUDIO_RU.md:118-131 сохраняет VoiceOver iPhone/iPad, TalkBack Android, largest text, landscape и core flows; строка133 запрещает P0/P1 core accessibility defects на release.
- 23_PERFORMANCE_RELIABILITY_DEVICE_MATRIX_RU.md:150-152: `Heavy native profiling may run at release checkpoints, not after every tiny change. Store evidence with commit/device/version.` Это не waiver device tests; это место тяжёлых профилей в последовательности.
- 119_BILINGUAL_PRODUCT_LANGUAGE_CONTRACT_RU_EN.md:100-102: `Read persisted/system locale before rendering user content. The orange splash can be language-neutral. No flash of the wrong language is allowed, especially in saved child mode.`

## Runnable next actions

1. **S03 install:** отдельный workspace Chrome profile, только loopback и сохранённый QA artifact/authority. Capability-check experimental CDP `PWA.install({manifestId, installUrlOrBundleUrl})`, затем `PWA.launch({manifestId})`, attach returned targetId, проверить standalone/relaunch/offline core/RU-EN. `PWA.uninstall` только для собственной тестовой manifest identity. Не подменять это `chrome --app`, SW marker или mobile viewport. API проверен по [официальной CDP документации](https://chromedevtools.github.io/devtools-protocol/tot/PWA/); поддержка текущим Chrome ещё не измерена, команды здесь не выполнялись.

2. **S03 changed candidate:** после сохранения старого dist/authority/browser evidence — `node node_modules/@playwright/test/cli.js test --config playwright.pwa.config.mjs`. Этот config сам делает новую QA build; не запускать поверх исторического candidate без сохранения. Cross-engine historical FAIL оставить; добавить независимый transport-aware test при необходимости, не ослабляя старые assertions ради зелёного.

3. **S03 deletion:** определить ранний subset и сохранить late lifecycle OPEN; при изменении supported category handling выполнить `node node_modules/vitest/vitest.mjs run server/planet/api.test.ts server/planet/integration.test.ts server/planet/deletionProcessor.test.ts server/planet/deletionProcessorCli.test.ts scripts/database/literary-planet-reader-deletion.integration.test.mjs --configLoader runner --maxWorkers 1`. Это local fixture/SQL gate, не production migration и не доказательство cross-connection races. Не выполнять processor `--execute` в production.

4. **S04 Xcode:** root получает actual cloud result нового source-only candidate. Команды already prepared в `.github/workflows/mobile-ios-simulator.yml`: `node scripts/mobile/build-native.mjs ios dev`, strict verifier before/after sync/build, exact SPM resolution, generic simulator xcodebuild. Ошибку компиляции исправить; success связать с .app SHA/public bytes/xcresult. `ios-simulator-build.mjs` сам только проверяет evidence и не компилирует.

5. **S04 host boundary:** после bounded Back/deep-link/pre-content changes выполнить `node node_modules/vitest/vitest.mjs run src/host/HostPlatformServices.test.ts src/host/initializeHostPlatform.test.ts src/platform/adapters/android/AndroidPlatformAdapter.test.ts src/platform/adapters/ios/IosPlatformAdapter.test.ts --configLoader runner --maxWorkers 1`; затем настоящий installed smoke. Не использовать injected-port tests как native-device pass.

6. **Installed runtime:** выбрать конкретный изолированный Android emulator/device и iOS simulator, затем `adb install` / `xcrun simctl install` + launch для exact verified artifacts. Не угадывать ID подключённого личного устройства. Проверить App launch/plugins/language/navigation/orientation/one resume/offline shell, передать полные globe/device matrices S06/S23-S25/S39. Android текущий проверенный APK: `.tmp/native-builds/android-dev/fa9dd4a0/app-dev-debug.apk`.

7. **Milestones/evidence:** root привязывает точную раннюю часть, поздний owner stage, commands/source/output к каждому criterion, сохраняя все global requirements OPEN до всех milestones. Затем `node scripts/mobile/verify-requirements.mjs` и `node scripts/mobile/verify-state.mjs`. Этот review не меняет состояние и не является acceptance evidence вместо отсутствующего выполнения.

## Внешнее и внутреннее

Внешнее после готовой конкретной подготовки: legal/rights/retention/disposition approval, merchant/developer account identity, secrets/signing, отдельно разрешённые deploy/real transactions, manual store action. Подготовка текстов, PSP adapters, обработка выбранного account disposition, language/UI fixes, тестовые harness и правильные артефакты остаются работой агента.

Public pages остаются noindex, новый RU/EN copy остаётся draft. 03C:93 разрешает draft, но задаёт publication gates; 119:75 говорит, что missing English Base Edition blocks bilingual release. Это не требование выдумать human approval для локального foundation и не разрешение выпустить непереведённый продукт.

S04 parallel entry разрешён matrix69 и документирован `evidence/S04/parallel-safe-entry.json`. Он не перекрашивает S03 и не отменяет отсутствующую приёмку. Дополнительные устройства и глобальные проверки сохраняются в карте и отчёте как обязательные, а не как отменённые.

Snapshot HEAD: 57e03da63e4a1e62b71806eced81f4a88493aa4b. Проверено покрытие 46 критериев, включая две stage acceptance rows. Точных цитат: 42. SHA исходников: companion JSON.
