# Премиальный автоматический английский перевод

## Production-архитектура

Премиальный EN-контур по умолчанию работает **внутри Cloudflare Worker админки** через binding `AI`. Для основного production-режима `OPENAI_API_KEY` не нужен.

По умолчанию выполняются два независимых серверных прохода:

1. `@cf/google/gemma-4-26b-a4b-it` — полный литературный перевод русского исходника в структурированный английский результат.
2. `@cf/zai-org/glm-4.7-flash` — независимая сверка с русским оригиналом и финальная редактура до естественного литературного английского.

Второй проход включён по умолчанию. Он проверяет полноту, точность, терминологию и стиль, но не имеет права добавлять факты, даты, ссылки, источники или интерпретации, которых нет в исходнике.

OpenAI Responses API сохранён как **явный fallback provider**. Он используется только если `PREMIUM_TRANSLATION_PROVIDER=openai`; в этом режиме нужен server-side `OPENAI_API_KEY`.

## Общие гарантии

- Ручной проверенный EN никогда автоматически не перезаписывается.
- Машинный результат получает source hash и provenance модели.
- Перед записью повторно проверяется версия русского источника там, где возможна конкурентная редактура.
- Защищённые URL, ISBN, DOI, даты, HTML-атрибуты, координаты и другие структурные значения нельзя изменять моделью.
- Reader-facing EN проходит проверку на остаточную кириллицу.
- Полные исходные тексты и секреты провайдеров не записываются в `admin_audit_log`.
- Успехи и ошибки аудируются с фактическим `provider`, translator model и reviewer model.

## Статьи

При публикации русской статьи сервер проверяет английскую версию до публичной сборки.

- Если опубликованный машинный EN уже соответствует текущему `source_content_hash`, новый модельный запрос не выполняется.
- Если EN отсутствует либо машинный EN устарел, выполняются перевод и редакторский проход.
- Если существующий EN принадлежит редактору, автоматический pipeline его не меняет.
- Любое ручное изменение reader-facing EN переводит запись из machine-owned в human-owned.
- Результат проходит JSON-schema, санитаризацию и обычные release-checks.
- Порядок и вложенность HTML должны сохраниться.
- `href`, `src`, `id`, `class`, служебные `data-*` и другие защищённые атрибуты должны остаться неизменными.
- URL в тексте, источниках и библиографии сверяются после финального прохода.
- Годы, ISBN и DOI сверяются с исходником.
- При изменении русского источника во время перевода запись прекращается с conflict, а устаревший EN не сохраняется.

Для опубликованного архива раздел **Premium English** обходит статьи страницами и переводит небольшими пакетами, чтобы длинные материалы не упирались в лимиты Worker.

## Книжный архив

Для `literary_work_translations` машинный EN хранится с `translation_method=machine-translation`.

Автоматический EN создаётся только когда:

- карточка произведения имеет статус `reviewed` или `verified`;
- русская языковая карточка имеет статус `reviewed` или `verified`;
- у русского текста есть `source_urls`;
- нет принятого ручного EN либо существующий EN ранее создан машинным pipeline.

Ручной `reviewed/verified` EN имеет абсолютный приоритет. Машинная запись хранит source hash, provider, модели, request IDs и время генерации в `metadata.premiumTranslation`.

Production-схема дополнительно проверяется RPC `premium_machine_translation_ready()`.

## Биографии писателей

Автоматический перевод разрешён только из `biographyTranslations.ru`, если русский источник:

- `editorial-original`;
- имеет статус `reviewed` или `verified`;
- имеет дату проверки;
- содержит полноценный provenance источников.

Legacy-поля без подтверждённого происхождения не становятся автоматическим источником публикации. Машинная EN-биография сохраняется как `method: machine-translation`, `translatedFromLocale: ru`, `sourceTextRights: project-original` и содержит provider/model provenance.

## Профили стран

Содержательные профили стран переводятся двухпроходным контуром. Английская локализация включает текстовые поля профиля, историю, литературные периоды, движения, факты, места, timeline и chronology.

Количество и порядок структурных элементов сохраняются. Годы timeline/chronology не меняются. Коды стран, координаты, числовые значения и другие нетекстовые данные не входят в переводной payload.

## Системные тексты сайта

Редактор **«Тексты сайта»** автоматически переводит изменённый русский CMS-текст, если английское поле пустое или принадлежит machine pipeline.

Если редактор вручную изменяет EN, поле сразу становится human-owned. Для уже существующих русских CMS-переопределений доступен пакетный backfill в разделе **Premium English**.

Короткие UI-строки переводятся пакетами по строгой схеме: ключи, их порядок и количество нельзя менять.

## Translation Center

Раздел админки **Premium English** показывает:

- активного provider;
- фактическую модель переводчика и модель второго прохода;
- готовность Cloudflare Workers AI binding либо OpenAI server secret для fallback-режима;
- готовность книжной DB-схемы;
- количество опубликованных статей и EN-версий;
- количество проверенных RU/EN книжных карточек;
- число безопасных кандидатов среди биографий и профилей стран;
- число CMS site-copy overrides и машинных EN.

Из центра запускаются небольшие пакеты статей, книг, биографий, стран и site-copy. После фактических изменений создаётся обычный public build request.

## Cloudflare Production

Worker: `probpera-admin`.

В `apps/admin/wrangler.jsonc` production уже содержит:

```json
{
  "ai": { "binding": "AI" },
  "vars": {
    "PREMIUM_TRANSLATION_PROVIDER": "cloudflare"
  }
}
```

Это production-default. Дополнительный API key для Workers AI не требуется: доступ идёт через Cloudflare binding Worker runtime.

Модели можно переопределить server-side переменными:

```text
CLOUDFLARE_TRANSLATION_MODEL=@cf/google/gemma-4-26b-a4b-it
CLOUDFLARE_TRANSLATION_REVIEW_MODEL=@cf/zai-org/glm-4.7-flash
OPENAI_PREMIUM_TRANSLATION_REVIEW=true
```

Operational kill switches, сохранённые для обратной совместимости:

```text
OPENAI_AUTO_TRANSLATE_ARTICLES=true
OPENAI_AUTO_TRANSLATE_LIBRARY=true
OPENAI_AUTO_TRANSLATE_SITE_COPY=true
OPENAI_AUTO_TRANSLATE_PROFILES=true
```

Значение `false` отключает соответствующий автоматический контур независимо от provider.

## OpenAI fallback

Чтобы намеренно переключить production на OpenAI:

```text
PREMIUM_TRANSLATION_PROVIDER=openai
OPENAI_API_KEY=<server secret>
OPENAI_TRANSLATION_MODEL=gpt-5.6-sol
OPENAI_TRANSLATION_REVIEW_MODEL=gpt-5.6-sol
OPENAI_TRANSLATION_REASONING_EFFORT=max
OPENAI_TRANSLATION_REASONING_MODE=pro
OPENAI_TRANSLATION_REVIEW_REASONING_EFFORT=max
OPENAI_TRANSLATION_REVIEW_REASONING_MODE=pro
OPENAI_PREMIUM_TRANSLATION_REVIEW=true
```

`OPENAI_API_KEY` нельзя публиковать с префиксом `NEXT_PUBLIC_` или `VITE_`.

OpenAI fallback не включается автоматически при ошибке Workers AI: это намеренно fail-closed поведение, чтобы production не начал незаметно использовать платного провайдера.

## Аудит

Машинные операции фиксируют фактический provider, translator/reviewer models, request IDs, source hash, доступные usage-метрики и длительность. Полный текст материала и секреты в audit log не сохраняются.

Повторные запросы сокращаются source hash-проверками. Human-owned EN не регенерируется автоматически.
