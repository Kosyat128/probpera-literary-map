# Literary Planet V12 — текущая локальная выдача

Исходный коммит: `17843151ab0624b2b17102440d0eeb464381bdcb`. Предыдущие исходники/отчёт: `245c86700e6acc01e8723f8656104c2371e03b4c` / `9f45dc94b993a4ec5da4a5ebc2eacaff19d64363`. Исторические SHA описывают происхождение; существующий рабочий проект не переключают и не откатывают.

Проект: `C:\Users\User\Documents\ChatGPT\Работа по сайту\literary-planet-v12-work`; физический путь того же checkout — `D:\CodexProjects\Работа по сайту\literary-planet-v12-work`. Все `.tmp/...` ниже относятся к этому проекту. Source fingerprint: `1c4bead7fae5cb3b3d9695c12520cb94865c9e91ec0831a2aef8d08677c99afe`; lock SHA256: `21c4b839c5771537bbf4aa57a2128c374200c6cd3b2e1674096c3f4b89b4c75e`; tools fingerprint: `fcc3d67e5be269a2253447842fc0c2b54e336954278adf3dab30726b502377a4`.

В Android/Swift реализованы приватные механизмы владения PIN-сессией: полный канонический expected/next record, исходная session identity, PIN-only CAS, один абсолютный deadline, отзыв/отмена, ожидание действительной работы и передачи ответа. Попытки сбрасываются по времени begin-снимка; поздние проверки используют текущий sample. Изменённые callback-буферы отвергаются. Потеря результата закрывает доступ и удерживает занятую сессию; очистка чувствительных байтов не выдаёт разрешение и не подтверждает доставку.

Фактический root JVM-прогон замороженного полного Java-кандидата: 39 сценариев, 2598 наблюдённых assertions, PASS; компиляция и все семь pre/post проверок PASS. Он выполнен перед интеграцией при HEAD `9f45…`/source `245c…`; исполненные Java-байты точно соответствуют текущему source. IO, authority, clock и transport settlement в этом прогоне имитируются. Vault не создавался, установленная OS не проверялась. Swift получил review исходного кода; его compiler/XCTest — NOT_RUN. Production factories остаются `null`/`nil`: genuine checkpoint/host/time authority, PIN input/KDF/calibration, recovery и bridge provider ещё не реализованы. Детский режим не активирован.

Три текущие подготовки выполнены последовательно один раз, PASS, полные1780 source input и tool/lock binding сохранены. Старые TSC/unit/browser результаты остаются с исходными SHA и границами; их не объявляют новыми проверками всей сборки. Прежние FAIL, timeout и NOT_RUN сохранены.

| Четыре исходных условия | Фактическое состояние |
|---|---|
| Установленное приложение и native OS storage/lifecycle | NOT_RUN. Android main/test APK доступны. Собственного загруженного test target нет; шесть прежних AVD boot FAIL сохранены. |
| Выбранный PSP и реальные purchase/refund/restore/reconciliation | BLOCKED_EXTERNAL / NOT_RUN. PSP ещё не выбран. Технический YooKassa-кандидат не является решением владельца. |
| RU/EN редакционные и правовые материалы | PENDING. Пять точных версий в едином `docs/mobile/RELEASE_DECISIONS.json` имеют approved=false. |
| Реальные Auth/deletion и отдельно разрешённая среда | NOT_RUN; отдельный environment grant отсутствует. Remote operations=0. Четыре отсутствующих исторических critical before-witness не заменяются текущим snapshot. |

S03.acceptance — IN_PROGRESS,11 OPEN; S16 — IN_PROGRESS,36 OPEN; releaseReady=false. RU/EN, «Книжулик» / «Mr. Booky», существующие3D controls и один канонический глобус сохранены.

| Доступный артефакт | Расположение и SHA256 |
|---|---|
| Android dev/debug app | `.tmp/mobile-release-android-1ae7ea27-74e4-4aac-a716-7e850abc0205/app-dev-debug.apk`;69639405 B; `5b33499916e524d82e0b9de85b6ea8d419f573b592a9fcf63fc336dd0277297b` |
| Android instrumentation | В том же каталоге `app-dev-debug-androidTest.apk`;595682 B; `b9c2c1878c52e17cad0958b2ac9ff83f3cefe0adce741d09ecb747b17fd34a8d` |
| PWA | `.tmp/mobile-release-pwa-9fbfc487-9737-48cb-a847-5a27750a1ba6/pwa-bundle`; artifact.json SHA `475f3146826605ce6cff4b889bc4af7a3dcafa1c9dbda897faa856edc82bba45` |
| iOS web payload | `.tmp/mobile-release-ios-bundle-18527a21-8acb-4f5a-b6ea-91d5e7f80adc/native-bundle`; artifact.json SHA `bcc4a66fb86f3d8ea6fa5a90d6cfbffd190ed4acac6d3e7bfe68adeff8b10fac` |

Android application ID `ru.probpera.literaryplanet.dev`; main/test APK, certificate, alignment, source inputs и web payload связаны в `binary.json` той же подготовки. iOS web payload не является IPA или Swift/Xcode сборкой.

Для просмотра уже собранного PWA:

```powershell
Set-Location -LiteralPath 'C:\Users\User\Documents\ChatGPT\Работа по сайту\literary-planet-v12-work'
$planetNode = 'C:\Users\User\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
& $planetNode 'node_modules/vite/bin/vite.js' preview --config vite.pwa.config.ts --outDir 'D:/CodexProjects/Работа по сайту/literary-planet-v12-work/.tmp/mobile-release-pwa-9fbfc487-9737-48cb-a847-5a27750a1ba6/pwa-bundle' --host 127.0.0.1 --port 4173 --strictPort
```

Открыть `http://127.0.0.1:4173/planet/`. Команда проверена по существующим CLI/артефактам, но не выполнялась в этой стадии. Browser installation/offline/update и новая полная UI-матрица — NOT_RUN; прежний scoped browser proof не подменяет эти проверки.

Повторная локальная подготовка при новом изменении или конкретной причине:

```powershell
& $planetNode 'scripts/mobile/prepare-local-release.mjs' android
& $planetNode 'scripts/mobile/prepare-local-release.mjs' pwa
& $planetNode 'scripts/mobile/prepare-local-release.mjs' ios-bundle
```

Android и iOS подготовки запускать последовательно: общий `dist-native` уже вызывал сохранённый прежний FAIL. Подготовительные команды не подтверждают release readiness.

Android preflight, без установки и перечисления устройств:

```powershell
$planetRunId = [guid]::NewGuid().ToString('N')
& $planetNode 'scripts/mobile/native-install-runtime.mjs' --platform android --receipt '.tmp/mobile-release-android-1ae7ea27-74e4-4aac-a716-7e850abc0205/binary.json' --run-id $planetRunId --out ".tmp/mobile-native-preflight-$planetRunId"
```

Preflight читает локальные APK/receipt и запускает tool metadata/signature команды; network=0, installed=false. Ожидаемое итоговое NOT_RUN/exit2 не является FAIL binary verification и не является установленным OS PASS. Этот новый preflight не запускался: actual preparation уже содержит binary/source/certificate/alignment проверки.

Execute предназначен только для свежего собственного eligible emulator с точными runId/AVD/serial и отсутствующей прежней установкой: к команде добавляют `--serial emulator-N --avd-name LiteraryPlanet-V12-<тот же runId> --execute`. При private ADB server — `--adb-server-port <чётный порт1024–65534>`; reboot гостевой OS отдельно требует `--reboot-owned-target`. На чужом устройстве такую команду не выполняют. Native runner включает девять структурных protected-envelope fixture cases; они остаются synthetic даже при установленном запуске. Новые39 session JVM cases являются B-only и в OS runner не зарегистрированы.

Удалённое разрешение проверяется полностью офлайн:

```powershell
& $planetNode 'scripts/mobile/remote-preflight.mjs' --plan '<конкретный request.json>' --authorization '<отдельный owner-grant.json>'
```

Оба файла должны совпасть по endpoint, projectId, sandbox/staging environment, runId, schemaFingerprint, operations, testAccountIds и сроку notBefore/expiresAt. Отсутствующее или несовпадающее разрешение даёт BLOCKED_EXTERNAL/exit2, networkRequests=0,mutations=0. Это сравнение разрешения; оно не запускает Auth/платежи/миграции. Live/provider секреты в grant, отчёт и чат не помещают. Payment sandbox требует выбранного провайдера и совпадающих testMode/shopId/product/catalogVersion/amountMinor/currency. Migration-apply дополнительно требует backupReference и точные migrationHashes; cleanup — сохранённые exact owned object IDs.

Единственный owner registry остаётся `docs/mobile/RELEASE_DECISIONS.json`; ниже только указатель на внешние входы:

| Owner ID | Конкретный внешний шаг и подтверждение |
|---|---|
| DEVICE-ANDROID | Предоставить собственный реально загруженный isolated target и точную область установки/перезапуска; закрывается actual native-install-runtime receipt с совпадающими APK/target/runId/storage/lifecycle evidence. |
| DEVICE-IOS | Предоставить совместимые Mac/Xcode и собственный Simulator/device либо конкретный разрешённый CI; закрывается actual compile/XCTest/install/runtime receipt. |
| PSP-DECISION | Выбрать PSP и merchant sandbox, цены/refunds/receipts/регион/channel policy; protected credential setup вне чата. Отдельно разрешить точные purchase/refund/restore/reconciliation операции; нужны их реальные обезличенные receipts. |
| EDITORIAL-LEGAL | Утвердить DD-01…DD-06, legal entity/contact/jurisdiction/retention/rights и точные RU/EN версии account-service-copy,password-recovery-copy,auth-errors-copy,sandbox-payment-copy,account-deletion-disclosure. Закрывается человеческим exact-version approval; публикация отдельно. |
| AUTH-ENVIRONMENT | Указать separate staging endpoint/project, два обычных test account IDs, email/CAPTCHA/redirect настройки и reviewed deletion policy/processor; migration history+backup. Секреты устанавливаются защищённо. Закрывается actual Auth/deletion QA после отдельного grant. |
| REMOTE-GRANT | Дать отдельное разрешение конкретной среды/endpoint/project/run/срока, reads/writes/migrations, exact account/object IDs, limits и cleanup. Наличие `.env` не разрешает remote операции. |
| STORE-SIGNING | Указать channel/developer accounts и защищённую signing strategy; сборка/CI/update/store операции разрешаются по отдельности. Debug APK не закрывает signing/store submission. |

Шесть внутренних задач OPEN остаются работой Codex: genuine protected admission; поддерживаемая replay-resistant authority/trusted time; native PIN input/KDF/calibration/verification/recovery provider; authenticated host-current и admitted durable child ports; clear-before-render App routes/lifecycle/account/profile wiring; документированные media formats и exact-byte reviewed RU/EN assets/native integration. Новый приватный session core закрывает часть механики, а не эти задачи целиком.

Текущий delivery содержит самостоятельные подготовленные артефакты и добавочный source increment. Source restoration требует проверенного3c79 export/import и его прежней a42/fullbaseline6cf30 цепочки; это не standalone clone. Новый raw overlay содержит18 изменённых code paths, сохраняет mixed EOL и накладывается только на новую isolated копию проверенного baseline. Git bundle/diff не заменяют raw overlay. Старые444/376MB архивы в новый пакет не копируются; их SHA/происхождение берут из сохранённых actual assembly receipts. Прежний3c79 base ZIP проверяется до его correction overlay. PACKET_MANIFEST/RESULTS и текущий source-export/import-verification задают точные имена, SHA и порядок восстановления.

Ни текущий checkout, ни прежние исходные журналы не перезаписываются при восстановлении. Global Git config не меняется. Deployment,push,merge,publish и store release не выполнены и не разрешены.
