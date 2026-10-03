# Literary Planet V12 — приватный native PIN input

Текущие локальные source/build receipts: `2ddf4393ef55f085d6ce4865a1922f4d61f0b066`, предыдущие source/report — `c992fefb0b110cf5d010da87aad2d124eace16ce` / `8b128be307c43df3194bf1f2f48562776d111bcc`. Исторические SHA не являются командой переключения или отката проекта.

Проект: `C:\Users\User\Documents\ChatGPT\Работа по сайту\literary-planet-v12-work` (тот же checkout физически расположен в `D:\CodexProjects\Работа по сайту\literary-planet-v12-work`). Полные1781 captured source rows: fingerprint `cc4746cff5e39d7fff0cdf304d8c5d6a4e7270ce4a7df31ba49354c6604b8e8e`, lock `21c4b839c5771537bbf4aa57a2128c374200c6cd3b2e1674096c3f4b89b4c75e`, tools `fcc3d67e5be269a2253447842fc0c2b54e336954278adf3dab30726b502377a4`.

Интегрированы пять исходных файлов: приватный Android Dialog/keypad, его RU/EN ресурсы и15 авторских instrumentation cases; приватный Swift UIKit keypad. Два ограниченных native ASCII-буфера собирают PIN и подтверждение без entered PIN String/JS/Capacitor payload. Исходные context/calibration identity и абсолютный continuous deadline сохраняются. Реальные UI/cancel/KDF/delivery callbacks удерживают занятую сессию до завершения; потерянный UIKit/Dialog callback не превращается в подтверждение. Исходный primitive reply можно подтвердить только при нулевых workers и освобождённом input slot, атомарно под native lock.

Factories остаются `null`/`nil`, App/plugin/bridge/admission activation отсутствует. Genuine replay-resistant authority, trusted-time/recovery provider и authenticated host settlement ещё не реализованы. Native keypad является приватным механизмом ввода; он не выдаёт Parent Gate permission. Освобождение owned raw buffers не означает стирание UIKit/Android/accessibility/OS памяти.

Фактически выполнены три последовательные подготовки Android/PWA/iOS-web, PASS один раз каждая. Затронутые JVM regressions используют копии50 именно Gradle-compiled текущих Vault classes:24/436 assertions и39/2598 assertions, все пять pre/post checks PASS, failure=null; все три команды exit0/stderr0. Старые driver bytes сохранены; существующий публичный600k Node oracle использован без нового вычисления. Это host-JVM platform-KDF и synthetic session scope, без native UI/OS запуска. Новые15 Android cases: скомпилированы, исполнение NOT_RUN. Новые10 Swift UIKit methods: unregistered, NOT_COMPILED/NOT_RUN. Старые69 codec cases, TSC и browser scopes не повторялись ради отчёта; исходные FAIL/timeout/NOT_RUN сохранены. Новые browser/readiness checker для source2ddf — NOT_RUN.

| Текущий артефакт | Факт и расположение |
|---|---|
| Android dev/debug main | PASS; `.tmp/mobile-release-android-3d040ad9-2e54-43f6-811d-9d2df0213e8e/app-dev-debug.apk`;69745965B; SHA `a432380c71a6293141c44d801aaa5a27787198ac665b3bcc7fceb259bbb9d69e` |
| Android instrumentation | В том же каталоге `app-dev-debug-androidTest.apk`;609083B; SHA `5184b1fe846669169f51935d815aaf63c87c8641c49ba6eedef9300e02918348` |
| PWA | PASS; `.tmp/mobile-release-pwa-12a39bce-6104-4c69-8b00-b3b2721d65d4/pwa-bundle`;1426 files; artifact.json SHA `114c949a26fbc99a259f5e3116f36628413a6479cdb99ea9da9dd14911ca953b` |
| iOS web payload | PASS web payload; `.tmp/mobile-release-ios-bundle-0dda8f01-4209-458e-a88a-2f6b0a01e0dc/native-bundle`;1406 files; artifact.json SHA `b770727515c3cfcb0dd235abbccd2cd02c98ccab78f604ba7a20c7ba08b3a1ce`; отдельные Swift/Xcode/IPA NOT_RUN |

Application ID Android: `ru.probpera.literaryplanet.dev`. Точный preparation/source/binary receipt хранится рядом с APK; новые15 native-input tests не объявляются исполненными на основании Gradle compilation или прежнего OS runner.

Просмотр текущего подготовленного PWA:

```powershell
Set-Location -LiteralPath 'C:\Users\User\Documents\ChatGPT\Работа по сайту\literary-planet-v12-work'
$planetNode = 'C:\Users\User\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
& $planetNode 'node_modules/vite/bin/vite.js' preview --config vite.pwa.config.ts --outDir 'D:/CodexProjects/Работа по сайту/literary-planet-v12-work/.tmp/mobile-release-pwa-12a39bce-6104-4c69-8b00-b3b2721d65d4/pwa-bundle' --host 127.0.0.1 --port 4173 --strictPort
```

URL: `http://127.0.0.1:4173/planet/`. Команда сверена с существующим CLI и точным подготовленным путём, но не запускалась в этой стадии. Она не подтверждает PWA installation/offline/update, новые screenshots или native keypad UI.

Локальный Android preflight без установки:

```powershell
$planetRunId = [guid]::NewGuid().ToString('N')
& $planetNode 'scripts/mobile/native-install-runtime.mjs' --platform android --receipt '.tmp/mobile-release-android-3d040ad9-2e54-43f6-811d-9d2df0213e8e/binary.json' --run-id $planetRunId --out ".tmp/mobile-native-preflight-$planetRunId"
```

Не запускался заново. Preflight читает binary/tool metadata; `installed=false`, итоговый NOT_RUN/exit2 не означает установленный OS PASS. Execute требует собственного eligible booted emulator и точных serial/AVD/runId; reboot и удалённые действия требуют отдельной конкретной авторизации. Текущая сборка уже содержит фактические binary/source проверки; повторная подготовка без нового изменения или причины не нужна.

| Четыре исходных условия | Состояние |
|---|---|
| Установленное приложение/native OS storage/lifecycle | NOT_RUN; шесть прежних owned AVD boot FAIL сохранены, загруженного eligible target нет |
| Выбранный PSP и реальные purchase/refund/restore/reconciliation | BLOCKED_EXTERNAL/NOT_RUN; PSP не выбран, YooKassa остаётся техническим кандидатом |
| RU/EN редакционные/правовые материалы | PENDING; пять точных версий approved=false в едином owner registry |
| Реальные Auth/deletion и отдельно разрешённая среда | NOT_RUN; environment grant отсутствует, remote operations=0; исторические отсутствующие critical before-witness не заменены текущим snapshot |

S03 — IN_PROGRESS,11 OPEN; S16 — IN_PROGRESS,36 OPEN; stageAccepted=false/releaseReady=false. RU/EN, «Книжулик» / «Mr. Booky»,3D controls и один канонический глобус сохраняются.

Единственный registry — `docs/mobile/RELEASE_DECISIONS.json`, SHA `2b1aec64cfa083d3e01eaab50492c533e06e3ecb33b9294394298b237814e922`. Внешние шаги владельца остаются прежними:

| Owner ID | Конкретный вход |
|---|---|
| DEVICE-ANDROID | Собственный eligible booted target и точная область native установки/перезапуска |
| DEVICE-IOS | Совместимый Mac/Xcode и собственный Simulator/device либо отдельно разрешённый CI |
| PSP-DECISION | PSP/merchant sandbox, точные prices/refunds/receipts/channel rules и разрешённые реальные sandbox операции |
| EDITORIAL-LEGAL | Legal entity/contact/jurisdiction/retention/rights, DD-01…DD-06 и human approval точных пяти RU/EN versions |
| AUTH-ENVIRONMENT | Отдельный staging endpoint/project, два обычных test account IDs, email/CAPTCHA/redirect/deletion policy/processor и reviewed migration history/backup |
| REMOTE-GRANT | Отдельный environment/run/expiry grant с точными reads/writes/migrations/account/object IDs/limits/cleanup |
| STORE-SIGNING | Owner signing strategy/channel accounts и отдельные разрешения CI/update/store операций |

Шесть внутренних задач остаются OPEN и принадлежат Codex: protected admission; supported replay-resistant authority/trusted time; native PIN enrollment/verification/recovery; authenticated admitted durable child data ports; clear-before-render App/account/profile/lifecycle wiring; reviewed formats/exact-byte RU/EN child assets и native media integration. Следующий независимый шаг уже начат B-only на обоих платформах: приватные charged attempt-journal planners, с exact full record/revision/coordinates, charged reservation before verification и одноразовым original finalize. Эти новые черновики ещё не интегрированы; pure planning само по себе не записывает попытку и не выдаёт permission. Далее — Android/Swift parity, actual locked write/readback/host settlement и поддерживаемые authority/time/recovery contracts. Это программирование, а не дополнительный owner blocker.

Текущий компактный пакет source/builds будет иметь отдельный actual assembly receipt; этот runbook не объявляет ещё не собранный архив готовым. Его `source-overlay/` содержит полные raw bytes пяти code paths от точного baseline `17843151ab0624b2b17102440d0eeb464381bdcb` к source2ddf: четыре замены и один новый Android test file. `source-overlay-manifest.json` связывает before/after SHA и полные captured fingerprints. В пакете нет Git bundle, полного checkout или standalone source tree. Overlay/восстановление не выполнялись; наличие файлов не подтверждает их применение или Git-history import. Такой overlay предназначен только для отдельной проверенной копии точного178431 baseline, сохраняя текущую разработку.

Исторический1784 packet `literary-planet-native-pin-session-delivery-20261003-d7f0e2bc-a332-4596-a52c-126bb60adfff.zip` остаётся отдельной выдачей source1784, SHA `9b14bd1ad6167da436ce5f1151c5e787cb40d183e317c1f435069a011952e01b`,239667043B. Он не содержит source2ddf. Его собственный raw18 increment требует прежней3c79/a42/fullbaseline6cf30 цепочки; standalone clone/full-history PASS не объявлялись. Старый архив и330 proofs не копировались и не перехэшировались. Deployment/push/merge/publication/store release не выполнялись.
