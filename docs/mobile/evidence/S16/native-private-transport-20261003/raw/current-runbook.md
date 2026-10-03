# Literary Planet V12 — приватный native transport

Точный исходный код: `3c79db7c6d299032a357781861a919f454981daf`. Его родитель — отчёт `da9b1b4a30ff029470bfa1371de71e10ab66b531`, предыдущий исходный код — `a42c36b35fafc0d83bb18ed0d1b66f94ace9f42d`. Исторические SHA описывают цепочку; текущую разработку не переключают и не откатывают. Проект: `C:\Users\User\Documents\ChatGPT\Работа по сайту\literary-planet-v12-work`; физический путь того же checkout — `D:\CodexProjects\Работа по сайту\literary-planet-v12-work`. Ниже `.tmp/...` указаны относительно этого проекта.

Реализованы приватные TypeScript/Java/Swift transport-границы для четырёхцелевого native partition: constructor-owned RPC, native lease/generation/nonce, bounded canonical Base64, CAS/readback, отмена реальной native работы и close ACK после фактической очистки. Один data job удерживает native capacity до завершения; cancel ACK не означает завершение записи. Lifetime ограничен 2 048 data jobs и 4 097 wire IDs с отдельным terminal close. Transport не зарегистрирован в App/plugin. Protected admission, PIN, authenticated host-current binding и `ChildScopedDataPort` этим контрактом не предоставлены; child activation отсутствует.

51 целевой unit-case фактически прошёл при HEAD `da9…` и 11 незакоммиченных файлах: 30 synthetic RPC/TS случаев и 21 случай runner fixture plan. Десять файлов совпали с текущим source побайтно; один type-only import исправлен с одинаковым emitted JavaScript. Повторного unit-прогона и буквального выполнения на HEAD `3c79…` не было. Первый TypeScript FAIL сохранён; исправленный TypeScript PASS выполнен при `da9…` с 11 dirty-файлами, чьи 1 774 captured input байта точно совпадают с текущим source. Это source qualification, а не установленный native OS runtime.

Текущие Android A2, PWA и iOS Web preparation прошли. Android A1 завершился FAIL из-за `dist-native/artifact.json` ENOENT при пересечении общей выходной директории; его журнал сохранён отдельно, A2 выполнен после устранения этого пересечения. Сохранены 6 820 защищённых входов: changed=0, missing=0. Scoped source export/import прошли. Три текущих readiness-checker фактически вернули exit code `2`: Android имеет 3 PASS/12 pending gates, PWA — 2 PASS/9 pending, iOS — 2 PASS/13 pending. `releaseReady=false`; непроведённые широкие проверки не повышаются до PASS.

S03 остаётся IN_PROGRESS с 11 OPEN, S16 — IN_PROGRESS с 36 OPEN. Равноправные RU/EN, «Книжулик» / «Mr. Booky», существующие 3D-анимации и управление, один канонический глобус сохранены. Исторические FAIL, skipped, timeout и NOT_RUN остаются с исходными именами и байтами.

| Четыре исходных условия | Фактический статус |
|---|---|
| Изолированная установка и native OS-хранилище | NOT_RUN. Main/test Android APK собраны; installed app, новый процесс, reboot, Preferences/secret storage/lifecycle не доказаны. Шесть собственных AVD boot-попыток FAIL сохранены. SDK и synthetic fixtures не заменяют OS proof. |
| Выбранный PSP и реальные платежи/возвраты | BLOCKED_EXTERNAL. Пользователь сообщил: PSP ещё не выбран. YooKassa остаётся техническим кандидатом; реальные purchase/refund/restore/reconciliation — NOT_RUN. |
| Редакционные и правовые RU/EN материалы | PENDING. Пять exact-version review-записей остаются PENDING, approved=false; нужны человеческие решения по фактам, правам и публикации. |
| Настроенный Auth/удаление и отдельное разрешение среды | NOT_RUN; environment-specific remote grant — BLOCKED_EXTERNAL. Реальный Auth/durable deletion и remote QA не выполнены. Старые локальные наблюдения сохраняют свою source-witness квалификацию; remote actions=0. |

Текущие exact-source gate inputs/results/execution/stdout/stderr находятся в `.tmp/mobile-release-native-transport-check-e2fbf7ba-7d89-4192-bc8a-dba9527b3b54`. Старые proof families не переименованы в результаты `3c79…`; текущий raw snapshot не восстанавливает четыре отсутствующих исторических critical SQL witnesses.

| Доступный артефакт | Точное расположение и граница проверки |
|---|---|
| Android dev main APK | `.tmp/mobile-release-android-fc0d5289-08cb-4502-903f-b4204b1c1333/app-dev-debug.apk`, 69 639 301 байт, SHA256 `457e01d003b00783634993cb33d45cb18c1a40518f6db66bbdfc66463854a38d`. Debug application ID `ru.probpera.literaryplanet.dev`; установка — NOT_RUN. |
| Android instrumentation APK | В том же каталоге `app-dev-debug-androidTest.apk`, 589 387 байт, SHA256 `ced69dee1bffd1d9f349bf84e043cb37f6f68a9dede57171a8cbeeac2a622753`. Скомпилирован; instrumentation OS execution — NOT_RUN. `binary.json` связывает обе APK, source inputs, Web artifact и actual debug certificate. |
| PWA | `.tmp/mobile-release-pwa-c06bdfa5-7949-41da-ab41-96dc35e3eaba/pwa-bundle`. Текущий bundle подготовлен; полная install/offline/update матрица — NOT_RUN. |
| iOS Web/native payload | `.tmp/mobile-release-ios-bundle-5bc9731e-3410-4eac-9203-3134624a07c6/native-bundle`. Это Web payload для native shell. IPA, Swift/Xcode compile, signing и installed iOS — NOT_RUN. |

Все три preparation привязаны к source `3c79…`, source fingerprint `50c293a35914eba783212b992d9350ae6b4ee16581b27cc9a987ac78c2648948`, lock SHA256 `21c4b839c5771537bbf4aa57a2128c374200c6cd3b2e1674096c3f4b89b4c75e` и tools fingerprint `fcc3d67e5be269a2253447842fc0c2b54e336954278adf3dab30726b502377a4`.

Команда локальной выдачи уже подготовленного PWA; новый bundle не пересобирается:

```powershell
Set-Location -LiteralPath 'C:\Users\User\Documents\ChatGPT\Работа по сайту\literary-planet-v12-work'
$planetNode = 'C:\Users\User\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
& $planetNode 'node_modules/vite/bin/vite.js' preview --config vite.pwa.config.ts --outDir 'D:/CodexProjects/Работа по сайту/literary-planet-v12-work/.tmp/mobile-release-pwa-c06bdfa5-7949-41da-ab41-96dc35e3eaba/pwa-bundle' --host 127.0.0.1 --port 4173 --strictPort
```

Открыть `http://127.0.0.1:4173/planet/`. Эта команда описана по текущим CLI и bundle; в рамках подготовки данного runbook она не запускалась. Исторический HTTP smoke для другого source не является проверкой нового bundle. Vite preview не подтверждает PWA installation, offline/update, RU/EN UI matrix или native OS.

Android preflight для существующего receipt без установки; новый прогон здесь NOT_RUN:

```powershell
$planetPreflightRun = [guid]::NewGuid().ToString('N')
& $planetNode 'scripts/mobile/native-install-runtime.mjs' --platform android --receipt '.tmp/mobile-release-android-fc0d5289-08cb-4502-903f-b4204b1c1333/binary.json' --run-id $planetPreflightRun --out ".tmp/mobile-native-preflight-$planetPreflightRun"
```

Без `--execute` runner не перечисляет устройства и не устанавливает/запускает приложение, но читает APK/receipt и выполняет локальные tool metadata/signature команды. Такой report сохраняет installed=false, hardwareProtectionTested=false, status=NOT_RUN и exit code `2`; внутренний exact-binary-preflight PASS не является OS PASS. Preparation уже содержит актуальные binary/source/certificate/alignment проверки, повторять их без новой причины не требуется.

Execute-синтаксис действующего runner: `--platform android --receipt <contained project-relative binary.json> --out <fresh .tmp directory> --run-id <32lowerhex> --serial emulator-N --avd-name LiteraryPlanet-V12-<тот же runId> --execute`. При отдельном server используется `--adb-server-port <чётный порт 1024–65534>`; system-restart шаг отдельно требует `--reboot-owned-target`. `--target` и произвольного child-флага в CLI нет. Для выполнения нужен реально загруженный fresh owned eligible emulator, exact target identity, отсутствие прежней установки, offline gate и run-scoped cleanup. Физическое устройство требует отдельной точной процедуры. Команда execute/reboot здесь не выполнялась.

Текущий runner уже вызывает четвёртый `PlanetChildDataStoreRuntimeTest`: `write`, `read`, `atomic`, `retire`, `corrupt`, `missing-key`, `missing-cipher`, `clear`, а также пятый `PlanetChildDataTransportRuntimeTest` с фазой `wire`. Сценарии имеют отдельные run-derived namespaces, cleanup и offline gate. iOS XCTest выбирает соответствующие классы/фазы с очищенными fixture environment keys. Эти новые вызовы подготовлены в source/main/test binaries; installed execution всех child/native fixtures остаётся NOT_RUN. Synthetic partition fixtures не допускают child mode.

Scoped export: `.tmp/mobile-release-source-native-transport-cca2cca9-4f37-46cc-91e2-516c08617138/source-export.json`; import: `.tmp/mobile-release-source-native-transport-import-1daf869e-8c78-46aa-8787-2f4c00379bdc/result.json`. Инкремент содержит один отчёт `da9…` с 92 путями и один source `3c79…` с 11 путями; bundle prerequisite — `a42…`. Raw closure включает 2 072 файла: 1 774 captured source inputs и 298 reviewed supplements. Восстановление требует полной baseline `6cf30bff556be65eeaa64b46bb1f52218b9084ed`, предыдущего source `a42…` и всей его verified prerequisite chain; `standaloneFreshClone=false`, `fullHistoryIntegrity=NOT_RUN`. Import PASS относится к incremental payload и connectivity с read-only prerequisite pool, а не ко всему историческому object store.

`source-files.zip` обязателен для точных raw байтов и смешанных окончаний строк; raw mismatches=0, inherited Git-conversion mismatches=1 151. Git bundle и patch не заменяют raw snapshot. Восстановление проводят в новой isolated копии после проверки SHA/manifest/prerequisite; рабочий checkout и его изменения не перезаписывают, глобальную Git-конфигурацию и старые журналы не меняют. В portable addendum новые source/artifacts/proofs лежат отдельно; старый архив не копируется и не хешируется повторно.

Неизменяемый prerequisite packet: `D:\CodexData\.codex\visualizations\2026\10\02\01a0fd35-3865-7973-8f4c-0c7a0148df47\release-completion\literary-planet-native-bridge-delivery-20261003-20488c73-26fa-4f64-a262-6bd8698f4907.zip`, 444 846 269 байт, SHA256 `1e56fdab62e9fe24e371301aa4d56da74ebe7abd5070c6ff8da31caf90fd4ff1`. Digest нового addendum берут из его фактического assembly receipt, когда сборка пакета завершена.

Семь owner IDs в `docs/mobile/RELEASE_DECISIONS.json` не изменены. Нужны конкретные внешние входы; секретные значения в чат не присылать.

| Owner ID | Оставшееся действие владельца |
|---|---|
| DEVICE-ANDROID | Реально загруженный собственный eligible isolated Android target и точная область проверки; SDK не закрывает шесть boot FAIL. |
| DEVICE-IOS | Совместимые Mac/Xcode и собственный Simulator/device либо отдельное разрешение точной CI-среды для compile/install/OS проверки. |
| PSP-DECISION | Выбрать/отклонить PSP-кандидат, согласовать merchant, цены/refunds/receipts/регион/channel rules, предоставить sandbox доступ защищённо. Реальные операции разрешаются отдельно. |
| EDITORIAL-LEGAL | Решения DD-01…DD-06, entity/contact/jurisdiction/retention/rights и человеческое RU/EN approval точных пяти версий; публикация разрешается отдельно. |
| AUTH-ENVIRONMENT | Конкретные separate staging endpoint/project, два обычных test-account IDs, email/CAPTCHA/redirect настройки, reviewed deletion policy/processor, migration history и backup. |
| REMOTE-GRANT | Отдельное разрешение endpoint/project/environment/run или срока, reads/writes/migrations/fixture deletions, exact accounts/objects, limits и cleanup; наличие `.env` не даёт разрешения. |
| STORE-SIGNING | Канал/developer accounts и доступ к защищённой signing strategy; store/CI/update/publish действия разрешаются отдельно для конкретной операции. |

Шесть programming gaps остаются работой Codex; владельцу не передаётся написание кода.

| Задача OPEN | Следующее продолжение реализации |
|---|---|
| Protected child admission | Подлинный native authority provider для `childProtectedState.ts` / `childStartup.ts`; synthetic fixtures и caller booleans не дают допуска. |
| Native authority / trusted time | Поддерживаемая replay-resistant checkpoint/epoch гарантия, restart continuity и trusted-time provider с фактической OS проверкой; JS clock и ordinary encryption недостаточны. |
| Native PIN enrollment/verification/recovery | Protected input, durable попытки/CAS, recovery и отзыв Parent Gate capability в `parentPinVerification.ts` / `parentGate.ts`; ошибки и отказ. |
| Admitted durable child data ports | Приватный TS/Java/Swift transport реализован. Далее — actual host dispatcher/integration и подлинный host-current binding под durable native commit lock, затем admitted `ChildScopedDataPort` и installed storage/lifecycle proof. Callback control-key transaction backend этим transport не реализован. |
| Clear-before-render / lifecycle / routes | Sealed App startup, отзыв контекстов/видимых ссылок до render при Back/background/restart/account/profile changes; child content закрыт до настоящего допуска. |
| Reviewed child media rendering | Недостающие форматы, independently reviewed exact-byte RU/EN материалы и native/App/lifecycle renderer integration; codec/presenter и muted synthetic audio не заменяют content approval. |

Deployment, push/merge, публикация и store release не разрешены. Независимая локальная реализация продолжается при отсутствующих внешних входах; приёмка S03/S16 остаётся открытой.
