# Сохранённый контракт native diagnostics — 9 октября 2026

Статус: **SOURCE_ONLY_DESIGN / NOT_IMPLEMENTED / NOT_TESTED**. Это зафиксированный контракт для продолжения S27, требование 26 §3. Он не означает приёмки Android/iOS кандидатов и не заменяет их независимую проверку. Продуктовая база — `e8ac3c03e8aa142e219cb03e46e75757910c82dd`.

Выполнять сначала исправления из `GITHUB_CONTINUE_20261009_RU.md`: Android arbitrary destination deletion и неограниченное iOS detach ожидание. TS/controller/UI кандидатов в архиве нет.

## Общие interfaces

Предлагаемый общий модуль — `src/support/supportDiagnosticExport.ts`. Сохранённые формы:

| Имя | Поля / поведение |
| --- | --- |
| `Offer` | `json`, `isCurrent()` |
| `Receipt` | `requestId`, `outcome: saved \| cancelled \| error`, `bytes`, `sha256` |
| `Snapshot` | `phase: idle \| saving \| complete \| unavailable`, `receipt` |
| `IDLE` | Общий исходный snapshot в фазе `idle` |
| Transport | Явный выбор `browser` или `nativeTransport` |
| `nativeTransport` | `subscribe`, `getSnapshot`, `save`, `cancel` |

Конкретные TypeScript объявления и строгие native receipt validation ещё нужно реализовать; эта запись не фиксирует выдуманную успешную квитанцию.

Соединение владельцев:

- Session предоставляет `createExportOffer`.
- Hook предоставляет `exportTransport`.
- `SupportDiagnosticsPanel` требует явный transport; `App` передаёт prop.
- Controller имеет optional методы `saveAdultDiagnostics(offer)`, `cancelAdultDiagnostics()`, `getDiagnosticSaveSnapshot`; используется его существующий subscribe.

`Offer.isCurrent()` проверяет согласие и актуальность session preview revision. Эта проверка отдельно от preflight действующей native adult authority: наличие согласия или browser preview не создаёт native полномочий.

## Custody и lifecycle

Controller владеет outcome независимо от размонтирования App. Ожидаемый picker seal должен очистить preview, сохранив переданную OS picker custody. Такое очищение/размонтирование само по себе не должно отменять принятый save.

Явная отмена обязана дождаться joined cleanup. Удерживается исходный save handle, исходные lease/deadline и одноразовость. Нельзя молча продлевать lease, выполнять implicit renewal/readmission или повторно создавать взрослые полномочия. Cleanup и terminal receipt должны относиться к точному исходному запросу.

Для native пути нет fallback к `Blob` / anchor download. Browser и native transport выбираются явно. Сохранение использует одобренные точные JSON bytes, максимум 16 384 UTF-8 bytes, фиксированное имя `literary-planet-diagnostics.json`, актуальную adult authority, явное согласие в момент действия и `saved/cancelled/error` receipt. Private child export остаётся отдельным владельцем.

## Native wire

`saveAdultDiagnostics` request:

```text
version: 2
requestId
contextToken
generation
json
```

Save response имеет `status: diagnostic-save` и `receipt` формы выше; response identity проверяется строго.

`cancelAdultDiagnostics` request:

```text
version: 2
requestId
contextToken
generation
targetRequestId
```

Отмена адресуется исходному pending save; подтверждение не должно опережать завершение его cleanup.

## Границы исполнителей

**GPT-6 Astra / ultra:** native authority и lifecycle, Android/iOS исходники и known defects, общие contracts, TS bridge/session/controller, транспорт и соединение prop в App. Здесь требуется глубокая проверка гонок, one-use custody, cancellation и receipt validation.

**GPT-6.1 SOL / ultra:** panel presentation, ClosedView, RU/EN status copy и относящиеся к ним целевые проверки после фиксации контракта Astra. Routine UI не меняет authority и native lifecycle.

После завершённого связного исправления и независимой проверки применять только принятые исходники, проверять затронутые пути и обновить сборки/внутренний пакет один раз. Старые QA и текущая передача не являются доказательством этой ещё отсутствующей реализации. Формальные статусы, внешние условия и `releaseReady=false` сохраняются.
