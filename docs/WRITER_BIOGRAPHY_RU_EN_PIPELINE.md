# Полный RU/EN-контур биографий

## Текущий выпуск: английский перевод отложен

В текущем выпуске публикуется полностью проверенный русский слой из 1684 биографий. Массовый английский перевод явно отложен: generated EN overlay остаётся пустым, а `OPENAI_AUTO_TRANSLATE_PROFILES` выключен и в production-конфигурации, и в локальном примере окружения. В базе сохраняются только 20 ранее подготовленных и отдельно проверенных редакционных английских биографий; русский текст не используется как скрытый fallback для английской локали.

Безопасный release gate текущего режима не выполняет сетевых или AI-запросов:

```powershell
npm run writers:biographies:english:paused:check
```

Полная команда `npm run writers:biographies:english:check` сохранена для будущего возобновления перевода и намеренно не входит в текущий release/deploy gate.

Контур состоит из двух последовательных операций:

1. 203 заранее отобранные русские записи проходят локальную редактуру по SHA-привязанному манифесту. Отвергнутые и служебные утверждения не входят в allow-list; локальный publication gate проверяет факты, стиль и полное покрытие.
2. Только после прохождения строгого русского publication gate все 1684 публичные русские биографии переводятся на английский и независимо проверяются второй моделью.

Русский выпуск полностью подготовлен локально: 1356 записей используют проверенный исходный текст, ещё 316 имеют каноническую редакционную версию, включая 203 локально доработанные записи из SHA-привязанного манифеста. RU claims/evidence не передавались внешнему AI-сервису, поэтому для русского слоя нет внешних request IDs, usage или модельной provenance. Возобновляемый checkpoint и модельная audit-provenance относятся только к отдельному английскому переводу; audit фиксирует полный порядок фактических вызовов (`translation → review` либо `translation → repair → review`) с request IDs и usage каждого pass. Публичные RU/EN overlay содержат финальный текст, source hash, даты и применимую provenance; release gate сверяет публичные и audit-артефакты запись к записи. Секреты в файлы не записываются.

## Локальные проверки без внешней передачи

```powershell
node scripts/generate-writer-biography-russian-editorial-refinements.mjs --source-check
npx wrangler deploy --dry-run --config scripts/wrangler.writer-biography-english.jsonc
npx wrangler types scripts/workers/writer-biography-english-worker-env.d.ts --config scripts/wrangler.writer-biography-english.jsonc --include-runtime=false --env-interface=WriterBiographyEnglishWorkerEnv --check
npx vitest run scripts/lib/writer-biography-english-qa.test.mjs scripts/lib/writer-biography-russian-editorial-contract.test.mjs
```

RU controller с Workers AI сохранён как отдельный, fail-closed инструмент для возможной будущей переработки. Текущий выпуск использует локальную редактуру 203 записей и не отправляет их claims/evidence внешнему AI-сервису.

## Разовый внешний EN-запуск после явного согласия

Сначала в отдельном терминале запускается только временный preview с Workers AI binding:

```powershell
npx wrangler dev --remote --port 8791 --config scripts/wrangler.writer-biography-english.jsonc
```

Флаг `--confirm-cloudflare-public-data-transfer` передаётся вручную только после явного согласия пользователя на передачу 1684 публичных русских биографий во внешний Cloudflare Workers AI и расходование Workers AI usage. Он намеренно не записан в `package.json`; это согласие не распространяется на RU claims/evidence.

После подключения проверенного RU overlay и успешного `--source-check` для 1684 записей выполняются контрольная выборка и полный английский проход:

```powershell
node scripts/generate-writer-biography-english-translations.mjs --source-check
node scripts/generate-writer-biography-english-translations.mjs --sample=10 --endpoint=http://127.0.0.1:8791 --confirm-cloudflare-public-data-transfer
npm run writers:biographies:english:translate -- --endpoint=http://127.0.0.1:8791 --concurrency=8 --confirm-cloudflare-public-data-transfer
npm run writers:biographies:english:check
```

Любая запись с изменившимся source hash, неполной модельной provenance/audit metadata, изменённым числом, потерянным названием, остаточной кириллицей, source narration, повтором либо несоответствием длины/числа предложений остаётся заблокированной. Совпадающие после нормализации биографии также блокируются с перечислением конфликтующих ключей; при возобновлении более поздняя checkpoint-запись инвалидируется и переводится заново. Итоговый overlay записывается только при полном результате без ошибок.
