# Продолжение работы с GitHub — 9 октября 2026

Продолжать в ветке `codex/literary-planet-v12-bilingual-final-autopilot` репозитория [Kosyat128/probpera-literary-map](https://github.com/Kosyat128/probpera-literary-map). Сначала целиком прочитать этот файл, `AGENTS.md`, сохранённый `docs/mobile/NEXT_CODEX_PROMPT.txt` и [исходный CODEX prompt](handoff/20261009-native-diagnostic-work-in-progress/CODEX_PROMPT.original.md).

**Правило моделей:** вся 3D работа и сложные задачи, включая native lifecycle/storage, безопасность и асинхронные гонки, — GPT-6 Astra / ultra. Обычная разработка, проверки и исправления — GPT-6.1 SOL / ultra. Правило в начале `AGENTS.md` сохраняет силу.

## Контрольная точка

При начале подготовки передачи рабочее дерево было чистым, HEAD — `0c8d758da4b56c5a34dd32c9db7180ddac58c7c3`. Это исходная контрольная точка перед коммитом передачи; свежий HEAD ветки нужно получить с GitHub. Продуктовый исходник последних доказательств — `e8ac3c03e8aa142e219cb03e46e75757910c82dd`; 1958 common source rows, fingerprint `220f3d9e58530e3f072674d77628428c6bdc1344bea106a374b3827eac62c128`. Документы и архив черновиков не меняют идентичность этих доказательств.

Исходная машина: логический каталог `C:\Users\User\Documents\ChatGPT\Работа по сайту\literary-planet-v12-work`, физический Git root `D:\CodexProjects\Работа по сайту\literary-planet-v12-work`. На другом компьютере выбрать свой короткий путь; эти абсолютные пути не являются требованиями к установке.

Состояние находится в `docs/mobile/AUTOPILOT_STATE.json`; текущий формальный этап — `S03`, первый незавершённый критерий — `S03.acceptance`. Записанный `headSha=e8ac…` — идентичность продуктового снимка, а не новый HEAD передачи. Не сбрасывать ветку к старому SHA и не переписывать историю, статусы или исходные FAIL.

## Что уже проверено и что перенесено

Актуальная запись: [S27 adult diagnostics result](evidence/S27/adult-diagnostics-local-20261009/result.json), статус `PARTIAL_WEB_CORE_LOCAL_EVIDENCE_NATIVE_SAVE_NOT_IMPLEMENTED`.

- Для web/core прошли 20 новых целевых случаев, TypeScript и raw AST; 71 старый native случай пропущен. Статическое наблюдение канонического глобуса не является проверкой его runtime.
- В смонтированной RU/EN fixture реальных panel/hook/controller получены четыре точные browser download и два снимка, просмотренных корневым агентом. Native capability и часть наблюдений были синтетическими; полное App и глобус не монтировались, реального Auth, установленной ОС и человеческой приёмки нет.
- Android PID 3244 завершился естественно с кодом 0; main/test Java compile tasks имели состояние `UP_TO_DATE`. PWA PID 13680 / 0 подтверждает только сохранённую текущую целостность: 1427 файлов, 77 798 542 байта. Исходный compile PID 23420 имеет неизвестный exit, preparation 0 B сохранён. Эти квалификации не означают новую компиляцию или проверку установленного приложения.
- Новый продуктовый ZIP не создавался из-за пробела native реализации. Прежние пакеты сохраняют свои исходные SHA и область проверки.

[Каталог передачи](handoff/20261009-native-diagnostic-work-in-progress/) содержит manifest фактически перенесённых файлов: ZIP десяти Android/iOS candidate files, исходный `CODEX_PROMPT.original.md`, выбранные текущие QA/UI/process/build metadata и два PNG. Сверять состав и SHA с manifest; отсутствие файла в нём означает, что его перенос не подтверждён.

Большие APK/PWA и прежний ZIP около 137 MB **не включены в GitHub**. Их можно восстановить из нужной идентичности исходников по сохранённому рецепту, проверив инструменты новой машины; это будет новая сборка со своей квалификацией. Старые абсолютные пути `D:\CodexData\…`, SDK, browser profiles и остальное игнорируемое `.tmp` не переносятся одним Git clone. Недоступная старая локальная ссылка не означает нового успешного доказательства и не разрешает менять её статус.

## Следующая работа

Продолжить то же требование 26 §3 / S27: реализовать настоящий локальный Android/iOS OS save/export для одобренного взрослым redacted diagnostic JSON. Текущий продукт использует `Blob` / `a.download`; native сохранение в этом снимке **отсутствует**. Это незавершённая программная работа Codex.

Исходные предложения находились в игнорируемом `.tmp/native-diagnostic-transport-candidates-a1/`; переносимые копии и manifest — в `docs/mobile/handoff/20261009-native-diagnostic-work-in-progress/`. Android/iOS кандидаты: **NOT_APPLIED / NOT_COMPILED / NOT_TESTED**. TS bridge/session/controller и UI кандидаты отсутствуют; их интеграция не завершена. [Сохранённый контракт следующего шага](handoff/20261009-native-diagnostic-work-in-progress/NATIVE_NEXT_CONTRACT.md) содержит согласованные design interfaces и границы владельцев, без утверждения о реализации. Архив сохранён для продолжения, к продукту он не подключён.

Сначала GPT-6 Astra / ultra должен проверить manifest и source pins, независимо проверить и закончить кандидаты:

1. Android: кандидат вызывает `DocumentsContract.deleteDocument` для произвольного `contentUri` без доказанного владения destination; отмена может удалить файл, в который приложение ещё не писало. Заменить это поведение cleanup только доказанно принадлежащих приложению private ресурсов. Не удалять произвольный OS destination.
2. iOS: кандидат содержит неограниченный цикл ожидания detach. Реализовать ограниченное joined lifecycle завершение и проверить cancellation/cleanup.
3. Завершить отсутствующие TS bridge/session/controller и RU/EN UI пути, согласовав реальный native wire и исходный save handle.

До исправления и независимой проверки не применять черновики автоматически и не запускать их вспомогательные скрипты без чтения. Сохранить текущую native adult authority, явное согласие в момент действия, точный preview и исходные JSON bytes, предел 16 384 **UTF-8 bytes**, имя `literary-planet-diagnostics.json`, одноразовую OS picker custody, асинхронные `saved/cancelled/error` receipts, cleanup и private child export. Проверить только затронутые пути; после связного исправления обновить сборки и один внутренний пакет. Не повторять неизменённую успешную QA и не создавать новый отчётный D-stage.

Четыре внешних условия остаются открытыми и исторически `HISTORICAL_NOT_RECHECKED_UNVERIFIED`:

1. Установленная native ОС/OS-хранилище — `NOT_RUN`; подходящий device/VM/iOS стенд не подтверждён.
2. PSP — `UNSELECTED`; реальные платежи, возвраты и сверка — `NOT_RUN`.
3. RU/EN editorial/legal/voice — требуется человеческое одобрение.
4. Auth, удаление и разрешённая remote среда — `NOT_RUN`; настроенная среда и отдельное разрешение не подтверждены.

`releaseReady=false`, `criteriaClosed=0`, `formalTransitions=0`. Разрешение сохранить работу в GitHub относится к этой передаче в ветке `codex/`; оно не даёт разрешения на merge, deploy, production DB, store submission/release или внешнюю проверку продукта.

## На другом компьютере

В новом пустом коротком каталоге выполнить:

```powershell
git clone --config core.autocrlf=false --branch codex/literary-planet-v12-bilingual-final-autopilot https://github.com/Kosyat128/probpera-literary-map.git literary-planet-v12-work
Set-Location literary-planet-v12-work
git status --short --branch
git rev-parse --show-toplevel
git rev-parse HEAD
```

Для существующего checkout сначала сохранить его локальные изменения, проверить remote/branch и обновиться обычным fast-forward. Не применять `reset --hard`, force push и глобальные изменения Git config.

Прочитать `AGENTS.md`, этот документ, `docs/mobile/AUTOPILOT_STATE.json`, `STATUS.md`, `DECISIONS.md`, `BLOCKERS.md`, `NEXT_CODEX_PROMPT.txt` и manifest передачи. Перед продолжением продуктовой разработки выполнить маршрутизацию неизменяемых требований. Исторический валидатор требует `core.autocrlf=true` в своих дочерних Git процессах; блок ниже добавляет настройку только через process environment и восстанавливает все затронутые `GIT_CONFIG_*` значения в `finally`. Глобальная и локальная Git config не меняются, уже существующие process settings сохраняются:

```powershell
$cfgCountBefore = [Environment]::GetEnvironmentVariable('GIT_CONFIG_COUNT', 'Process')
$cfgIndex = if ([string]::IsNullOrEmpty($cfgCountBefore)) { 0 } else { [int]$cfgCountBefore }
$cfgNames = @('GIT_CONFIG_COUNT', "GIT_CONFIG_KEY_$cfgIndex", "GIT_CONFIG_VALUE_$cfgIndex")
$cfgBefore = @{}
foreach ($name in $cfgNames) { $cfgBefore[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
try {
    [Environment]::SetEnvironmentVariable("GIT_CONFIG_KEY_$cfgIndex", 'core.autocrlf', 'Process')
    [Environment]::SetEnvironmentVariable("GIT_CONFIG_VALUE_$cfgIndex", 'true', 'Process')
    [Environment]::SetEnvironmentVariable('GIT_CONFIG_COUNT', [string]($cfgIndex + 1), 'Process')
    node scripts/mobile/verify-requirements.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Requirements verification failed' }
    node scripts/mobile/stage-context.mjs S03
    if ($LASTEXITCODE -ne 0) { throw 'Stage routing failed' }
} finally {
    foreach ($name in $cfgNames) { [Environment]::SetEnvironmentVariable($name, $cfgBefore[$name], 'Process') }
}
```

Затем прочитать общие инварианты, документы активного этапа и pending action требование `docs/mobile/requirements/v12/26_SUPPORT_ANALYTICS_INCIDENTS_RU.md`. Не изменять `docs/mobile/requirements/v12/` и не запускать полный продуктовый QA/build только ради передачи.

`package.json` требует Node **24.x**, npm **11.x** (`packageManager: npm@11.17.0`). На новой машине проверить версии. Зависимости устанавливать по `package-lock.json` командой `npm ci` только когда они отсутствуют или требуют восстановления; до запуска прочитать lifecycle scripts пакетов/workspaces и lockfile. Для локального просмотра:

```powershell
npm run dev -- --host 127.0.0.1
```

Открыть `/planet/` на фактическом локальном URL Vite. Для Android требуется JDK 21 и подходящий SDK; проверить реальные версии и пути новой машины по сохранённому native рецепту, не копировать старые абсолютные `.tmp/native-tools` настройки вслепую. iOS compile/runtime требует Mac с Xcode и подходящей целью.

Исторические проверки S00–S02 чувствительны к raw CRLF и использовали `core.autocrlf=true`; scoped commit может использовать `git -c core.autocrlf=false`. Это разные области применения: не менять глобальный Git config, не нормализовать старые артефакты и не выдавать изменение переводов строк за продуктовую правку. При checksum расхождении сначала сверить raw bytes с исходной квалификацией.
