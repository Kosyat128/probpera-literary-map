# Literary Planet V12 — пакет продолжения приватного native partition

Исходный код этого пакета: `a42c36b35fafc0d83bb18ed0d1b66f94ace9f42d`. Рабочий проект: `C:\Users\User\Documents\ChatGPT\Работа по сайту\literary-planet-v12-work`; физический путь того же checkout в сохранённых журналах — `D:\CodexProjects\Работа по сайту\literary-planet-v12-work`. Последний предшествующий отчёт: `301f33d058b3c66afc029d510ca99ee4898c95be`, его исходный код — `3b0e0f83fbeb1eee514f4ddbd305a6897ca7c647`. Эти SHA обозначают входы и цепочку доставки; переключать на них или откатывать текущую разработку не требуется.

Добавлен приватный четырёхцелевой partition-адаптер `src/child/childNativeData.ts` и целевые тесты. Он проверяет полный scope/namespace, issued capability, native generation/nonce, CAS, checksum и отдельное чтение сохранённого результата; ограничивает очередь, байты и время, очищает transferred buffers и отзывает локальные capabilities при lifecycle changes. Его `partitions.readPartition/comparePartition` намеренно имеют отдельный контракт: `mayPublish` ограничивает локальную выдачу, но не является native commit authority. Функциональный native transport ещё не предоставлен. Для admitted `ChildScopedDataPort` остаётся необходим подлинный host-current binding под native durable commit lock. Partition не даёт PIN, child mode, profile/package/review/rights authority; App/plugin/child activation отсутствуют.

21 новый целевой случай прошёл. Исходные execution-журналы сохраняют свои фактические source/worktree-привязки; точные два файла зафиксированы в текущем исходном checkpoint. Для текущего чистого source прошли TypeScript и подготовка Android, PWA и iOS Web bundle; проверено сохранение 6 820 прежних входов без изменения или пропажи. Scoped source export/import прошли. Три актуальные проверки готовности фактически выполнены и вернули exit code `2`, `releaseReady=false`: обязательные gates остаются открыты. Непроведённые широкие tests/runtime gates не повышаются до PASS по этим узким наблюдениям.

S03 остаётся IN_PROGRESS с 11 OPEN, S16 — IN_PROGRESS с 36 OPEN. Сохраняются равноправные RU/EN, «Книжулик» / «Mr. Booky», существующие 3D-анимации и управление, один канонический глобус. Исторические FAIL, skipped, timeout и NOT_RUN остаются с исходными именами и байтами.

## Четыре исходных условия

| Условие | Статус | Фактическая граница |
|---|---|---|
| Изолированная установка и native OS-хранилище | NOT_RUN | Main/test Android APK собраны; гостевая загрузка/установка/native runtime не доказаны. Шесть собственных AVD-попыток ранее завершились FAIL и сохранены. SDK, fixture и source review не подтверждают установленное приложение, OS Preferences/secret storage, новый процесс, перезагрузку или lifecycle. |
| Выбранный PSP, интеграция и реальные операции | BLOCKED_EXTERNAL | Пользователь сообщил: PSP ещё не выбран. Локальный YooKassa sandbox-кандидат остаётся технической подготовкой. Реальные purchase/refund/restore/reconciliation — NOT_RUN. |
| Редакционные и правовые RU/EN материалы | PENDING | Пять exact-version RU/EN review-записей остаются PENDING, approved=false. Автоматические проверки не заменяют человеческие решения по фактам, правам и публикации. |
| Настроенный Auth/удаление и отдельное разрешение среды | NOT_RUN | Реальные Auth и durable deletion не выполнены; environment-specific remote grant — BLOCKED_EXTERNAL. Старые локальные наблюдения сохраняют свою source-witness квалификацию. Удалённых операций — 0. |

Точная актуальная подборка readiness лежит в `.tmp/mobile-release-native-bridge-check-5f4a28fd-447b-43e9-b1f1-780e1019f3b8`: `readiness-input-{android,pwa,ios}.json`, `readiness-{android,pwa,ios}.json` и отдельные execution/stdout/stderr. Предшествующее `docs/mobile/evidence/S03/release-continuation-20261003/four-original-conditions.json` относится к source `3b0…`; его байты и прежние статусы сохранены, а не переименованы в результаты нового source.

## Доступные локальные артефакты

Ниже пути относительно указанного checkout. Каждый `preparation.json` привязан к source `a42c36b35fafc0d83bb18ed0d1b66f94ace9f42d`, raw source fingerprint `10b74367e3597e3d8326caab47682b2d95dd4f292b0e7f7a676e7f0cc1956181`, lock SHA256 `21c4b839c5771537bbf4aa57a2128c374200c6cd3b2e1674096c3f4b89b4c75e` и tool fingerprint `fcc3d67e5be269a2253447842fc0c2b54e336954278adf3dab30726b502377a4`.

| Артефакт | Точный каталог и файл | Что подтверждено |
|---|---|---|
| Android dev main APK | `.tmp/mobile-release-android-a76cf754-7fcf-4f4f-80b8-e1af569585e4/app-dev-debug.apk` | Сборка, metadata, source, debug certificate, alignment. SHA256 `435fb75dbcd9a6c0d5a5a4dda302ffed49dc672a61caa744a60f09fe1fff3c83`. Установка — NOT_RUN. |
| Android instrumentation APK | В том же каталоге `app-dev-debug-androidTest.apk` | Скомпилирован. SHA256 `e1aaf7b1489cf159b0b3d7779b5c5b17f256947ca81e96942cb669302b09cdd7`. Instrumentation OS execution — NOT_RUN. |
| Android входы и журналы | В том же каталоге `binary.json`, `preparation.json`, `native-bundle` и сохранённые stdout/stderr | Receipt binds main/test APK, source inputs, embedded Web artifact и actual debug certificate; production signing отсутствует. |
| PWA | `.tmp/mobile-release-pwa-96b76b28-0ccc-4c8a-b622-60795bed9d22/pwa-bundle` | Подготовлен текущий bundle. Один актуальный запуск проверил два локальных HTTP endpoint; полная install/offline/update матрица — NOT_RUN. |
| iOS Web/native bundle | `.tmp/mobile-release-ios-bundle-492d3f00-58f4-4b50-9afc-7d3f4b346391/native-bundle` | Подготовлен Web bundle для native shell. IPA, Xcode/Swift compile, подпись и installed iOS — NOT_RUN; Mac/Xcode нужен отдельно. |

## Локальный запуск и CLI

PowerShell, из существующего checkout:

```powershell
Set-Location -LiteralPath 'C:\Users\User\Documents\ChatGPT\Работа по сайту\literary-planet-v12-work'
$planetNode = 'C:\Users\User\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
& $planetNode 'node_modules/vite/bin/vite.js' preview --config vite.pwa.config.ts --outDir 'D:/CodexProjects/Работа по сайту/literary-planet-v12-work/.tmp/mobile-release-pwa-96b76b28-0ccc-4c8a-b622-60795bed9d22/pwa-bundle' --host 127.0.0.1 --port 4173 --strictPort
```

Открыть `http://127.0.0.1:4173/planet/`. Точная команда один раз проверена для нового артефакта: `.tmp/mobile-release-preview-33f7f84e-3010-4b74-b4bb-fa34036846d0/result.json` имеет PASS для `/planet/` и `/planet/manifest.webmanifest`, current source binding, remoteServiceRequests=0; собственный preview-процесс остановлен. Это проверка команды, entry и manifest. Установка PWA, offline/update, снимки, native OS и продуктовая приёмка этим не подтверждаются.

Подготовленная команда Android preflight для текущего receipt; **для этого нового receipt она NOT_RUN**:

```powershell
$planetPreflightRun = [guid]::NewGuid().ToString('N')
& $planetNode 'scripts/mobile/native-install-runtime.mjs' --platform android --receipt '.tmp/mobile-release-android-a76cf754-7fcf-4f4f-80b8-e1af569585e4/binary.json' --run-id $planetPreflightRun --out ".tmp/mobile-native-preflight-$planetPreflightRun"
```

`--receipt` принимает существующий contained project-relative файл, `--out` — новый собственный каталог в `.tmp`; абсолютный receipt из старого примера использовать не следует. Без `--execute` runner не перечисляет устройства, не устанавливает и не запускает приложение. Он всё же читает реальные локальные APK/metadata и вызывает локальные tool metadata/signature команды. Этот новый прогон не требуется для переименования исторической preflight-проверки: новая preparation уже содержит актуальные binary/source/certificate/alignment проверки. Предыдущий native-preflight source `3b0…` остаётся историческим.

Формат native report: `schemaVersion=1`, `kind=literary-planet-native-install-runtime`, `platform`, `channel=dev`, `runId` (32 lowerhex), `status`, `installed`, `hardwareProtectionTested`, `identity`, `checks`, `commands`, `captures`, `cleanup`, `releaseReady=false`. Preflight без установки сохраняет `status=NOT_RUN`, `installed=false`, `hardwareProtectionTested=false`, `installed-runtime:NOT_RUN`; CLI возвращает `2`. `exact-binary-preflight:PASS` внутри такого отчёта не является OS PASS.

Существующий execute-runner разрешает только fresh owned Android emulator с точным `--serial emulator-N`, `--avd-name LiteraryPlanet-V12-<тот же 32hex runId>` и, при необходимости, отдельным чётным `--adb-server-port` 1024–65534. Target identity, отсутствие прежней установки, offline state и область cleanup проверяются до действий. Физический target требует отдельной точной процедуры; подставлять произвольное устройство в этот runner нельзя. `--execute` и `--reboot-owned-target` здесь не запускались и не подразумевают новое разрешение на установку/перезагрузку.

Private `PlanetChildDataStoreRuntimeTest` имеет восемь фаз: `write`, `read`, `atomic`, `retire`, `corrupt`, `missing-key`, `missing-cipher`, `clear`. Offline command guard знает точную class/phase/32hex форму, однако основной native runtime runner этот четвёртый класс не вызывает. Произвольный CLI child-флаг не добавляет проверку. Direct native fixtures используют synthetic scope; выполнить их можно только отдельным bounded owned-target планом с exact binaries, phase/nonce, offline gate и run-scoped cleanup. Android/iOS native child data execution остаётся NOT_RUN.

Три текущих readiness-checker уже исполнены. Следующая команда — пример для нового относящегося к gates изменения, а не инструкция повторить пройденные проверки:

```powershell
$planetReadinessRun = [guid]::NewGuid().ToString('N')
& $planetNode 'scripts/mobile/release-readiness.mjs' --evidence '.tmp/mobile-release-native-bridge-check-5f4a28fd-447b-43e9-b1f1-780e1019f3b8/readiness-input-android.json' --report ".tmp/release-check-$planetReadinessRun-android.json"
```

PWA/iOS используют соответствующий actual input той же подборки. С открытыми gates ожидается exit code `2` и `releaseReady=false`. Новый source требует заново подготовленной exact-source выборки; старые receipt не переименовывают. Только после новых изменений сборки воспроизводят существующей командой `& $planetNode 'scripts/mobile/prepare-local-release.mjs' android`, `pwa` либо `ios-bundle`; каждый прогон сохраняет собственные реальные входы и журналы.

## Восстановление source и цепочка пакетов

Текущий export: `.tmp/mobile-release-source-native-bridge-4a8cbd29-76d7-499b-a823-b8c4bb214976/source-export.json`. В нём сохранены incremental Git bundle, `reviewed-increment.patch`, `source-graph.json`, `source-files.zip` и `source-files-manifest.json`. Raw closure включает 1 977 файлов: 1 767 captured source inputs и 210 reviewed supplements. Это выбранная полная raw closure данного scope, а не обещание полного repository history или всех сторонних зависимостей.

Текущий bundle требует исходный `3b0e0f83fbeb1eee514f4ddbd305a6897ca7c647`; между ним и source `a42…` идут предшествующий report `301f…` и новый source checkpoint. Предыдущий export `.tmp/mobile-release-source-continuation-254b6332-1bf7-43ab-93a8-871b87c4682f/source-export.json` и его импорт сохранены без изменения. Вся incremental цепочка требует уже существующую полную baseline `6cf30bff556be65eeaa64b46bb1f52218b9084ed` с нужными объектами. `standaloneFreshClone=false`, `fullHistoryIntegrity=NOT_RUN`.

Scoped импорт действительно выполнен в `.tmp/mobile-release-source-native-bridge-import-5e87d461-6c38-47d0-81af-f9c1891eb7be/result.json`: локальная цепочка и raw closure прошли, исходные refs не изменены, releaseReady=false. Повторное восстановление проводят только в новом isolated checkout/import directory после сверки manifest/hash/prerequisite; действующее рабочее дерево и незакоммиченные изменения не перезаписывают. Raw snapshot нужен для смешанных окончаний строк: 1 151 inherited Git-conversion mismatch относится к представлению Git, при этом raw snapshot mismatches=0. Глобальную Git-конфигурацию и исходные журналы не меняют; conversion-правило конкретной проверки хранится в её доказательствах.

Предыдущий пакет source `3b0…` / report `301f…` остаётся неизменным указателем: `D:\CodexData\.codex\visualizations\2026\10\02\01a0fd35-3865-7973-8f4c-0c7a0148df47\release-completion\literary-planet-release-continuation-20261003-cae44e12-b333-4848-a3cd-4d7d4af16579.zip`, 440 869 265 байт, SHA256 `59c6f8082ba302382b7f25aa0d16885f739b11b998bc63ccf299041a35b11505`. Он не содержит новый adapter source `a42…`; этот инкремент и текущие артефакты доставляются отдельно. Итоговые digest нового архива берут из его фактического PACKET_MANIFEST/assembly receipt, не из текста этого runbook.

## Семь конкретных входов владельца

IDs единого `docs/mobile/RELEASE_DECISIONS.json` не изменены. Секретные значения в чат не присылать.

| ID | Оставшееся действие владельца |
|---|---|
| DEVICE-ANDROID | Предоставить реально загруженный собственный eligible isolated Android target и точную область проверки. Установленный SDK не закрывает сохранённые шесть boot FAIL. |
| DEVICE-IOS | Предоставить совместимый Mac/Xcode и собственный Simulator/device либо отдельно разрешённую точную CI-среду для compile/install/OS проверок. |
| PSP-DECISION | Выбрать или отклонить YooKassa-кандидат; согласовать merchant, цены, refunds/receipts, регион и channel rules, предоставить sandbox реквизиты защищённо. Реальные операции требуют отдельного разрешения. |
| EDITORIAL-LEGAL | Предоставить решения DD-01…DD-06, entity/contact/jurisdiction/retention/rights и человеческое RU/EN approval точных пяти версий. Агент синхронизирует программные drafts; публикация разрешается отдельно. |
| AUTH-ENVIRONMENT | Указать конкретный separate staging endpoint/project, два обычных test-account IDs, email/CAPTCHA/redirect настройки, reviewed deletion policy/processor, migration history и backup. |
| REMOTE-GRANT | Отдельно назвать endpoint/project/environment/run или срок, разрешённые reads/writes/migrations/fixture deletions, точные аккаунты/объекты, limits и cleanup. Наличие `.env` не является разрешением. |
| STORE-SIGNING | Указать канал и developer accounts, предоставить доступ к существующей защищённой signing strategy; store/CI/update/publish действия разрешить отдельно для конкретной операции. |

## Шесть задач реализации Codex

Эти programming gaps остаются самостоятельной работой агента; они не передаются владельцу как требование написать код.

| Задача OPEN | Следующее конкретное продолжение |
|---|---|
| Protected child admission | Подлинный native authority provider для `childProtectedState.ts` / `childStartup.ts`; synthetic fixtures и caller booleans не дают допуска. |
| Native authority / trusted time | Поддерживаемая replay-resistant checkpoint/epoch гарантия и restart-continuity/time provider с фактической OS проверкой; источник времени JS и standard encryption недостаточны. |
| Native PIN enrollment/verification/recovery | Protected input, durable попытки/CAS, recovery и отзыв Parent Gate capability в `parentPinVerification.ts` / `parentGate.ts`; завершить ошибки и отказ. |
| Admitted durable child data ports | Соединить private Java/Swift store и нынешний private TS partition adapter через actual constructor-owned native transport; подлинный host-current binding должен участвовать в durable native commit lock. Затем выполнить installed storage/lifecycle proof. `ChildScopedDataPort` и callback transaction/control-key backend пока не реализованы этим adapter. |
| Clear-before-render / lifecycle / routes | Sealed App startup, отзыв контекстов и очистка видимых ссылок до render при Back/background/restart/account/profile changes; child content остаётся закрытым до настоящего допуска. |
| Reviewed child media rendering | Завершить требуемые форматы, independently reviewed exact-byte RU/EN материалы и native/App/lifecycle renderer integration; scoped codec/presenter и muted synthetic audio не являются content approval. |

Ни deployment, ни push/merge, ни публикация/магазинный выпуск этим пакетом не разрешаются. Независимая локальная реализация продолжается при отсутствующих внешних входах; приёмка S03/S16 и releaseReady остаются открытыми.
