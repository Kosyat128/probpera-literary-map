# Политика обогащения книжного каталога

Карантин и публикационный gate — временная защита, а не конечный результат. Цель очереди — проверить каждую непубличную карточку, объединить доказанные дубли, удалить только детерминированный мусор и подготовить оригинальные редакционные аннотации на русском и английском языках.

## Текущий охват

- В исходном архиве 9 998 карточек.
- 9 739 карточек имеют статус `draft`.
- Ещё 248 карточек имеют статус `reviewed` или `verified`, но не проходят полный двуязычный publication gate.
- Manifest покрывает 9 990 target ID: 9 987 непубличных карточек архива и 3 raw-ID, скрытых текущей дедупликацией.
- Сырые файлы импорта не изменяются. Проверенные результаты формируются отдельно в `src/data/countries/generated/books.reviewed.json`, а безопасные reject/merge-решения — в `src/data/countries/generated/books.enrichment-actions.json`.
- Текущий canonical archive содержит 9 712 карточек после применения 242 reject и 44 archive-merge; ещё 3 merge относятся к raw-shadow ID, уже скрытым архивной дедупликацией. Forensic raw count остаётся 9 998.
- Первая независимо проверенная партия продвинула 20 двуязычных карточек: все 20 проходят publication gate. В разделе «Проверенные» теперь 31 карточка; в видимой редакционной очереди остаётся 9 681 canonical-карточка.

Точные изменяемые числа и решения по каждой записи находятся в `reports/book-corpus-classification.json`, `reports/book-corpus-classification.md` и `data/book-enrichment-manifest.json`.

## Статусы

- `research` — данных недостаточно; запись остаётся в редакционной очереди и не публикуется.
- `ready` — обе локали, факты, источники, права и независимая редакционная проверка прошли все проверки; запись попадает в generated reviewed overlay.
- `merge` — доказанный same-writer alias или raw-shadow объединяется с указанной canonical-карточкой. Cross-writer совпадение внешнего ID не считается доказательством авторства.
- `reject` — только высокоуверенный неканонический импорт: учебное пособие, study guide, издательский комплект или маркер конкретного издания вместо произведения.

`requestedStatus` из batch-файла не повышает статус. Любая ошибка возвращает запись в `research`.

## Требования к RU и EN аннотациям

Для `ready` обязательны обе локали:

- 2–3 законченных предложения и 140–900 знаков на каждую локаль;
- конкретное описание произведения без шаблонной похвалы и без текста-заглушки;
- метод `editorial-original`;
- автор текста, дата создания, другой человек в роли проверяющего и ISO-дата проверки;
- права `textOrigin: project-original` и `copiedSourceText: false`.

Русская аннотация является оригинальным авторским текстом проекта. Английская версия также проходит самостоятельную редакционную проверку; русский текст не подменяется машинным переводом при отсутствии EN.

## Факты, источники и права

Для `ready` требуются проверки `identity`, `authorship`, `publication-year` и `original-language`, а также минимум две независимые authority-family. URL каждой fact check должен быть HTTPS и присутствовать среди объявленных источников, а значение факта не может быть пустым.

- Wikidata используется как CC0 structured data для идентичности, года и языка, но не как готовая аннотация.
- Wikipedia, Wikidata и Wikimedia относятся к одной authority-family `wikimedia`.
- Wikipedia/Wikimedia prose допускается только с page title, revision ID/URL, attribution, authors/history URL и совместимой лицензией CC BY-SA.
- Google Books допускается как reference-only metadata; массовое копирование descriptions запрещено.
- `licensed-copy` требует явно указанной лицензии.
- `reference-only` означает, что источник проверяет факты, а его формулировки не копируются.

## Возобновляемые batch-файлы

Редактор хранит проверенный контент в `data/book-enrichment-curated-batch-*.json`. Минимальная структура записи:

```json
{
  "recordKey": "country:writer:canonical-work-id",
  "requestedStatus": "ready",
  "canonical": {
    "titleRu": "Название",
    "titleEn": "Title",
    "originalTitle": "Original title",
    "firstPublished": 1900,
    "originalLanguage": "язык",
    "genres": ["жанр"]
  },
  "annotationRu": {
    "text": "Оригинальные 2–3 предложения.",
    "method": "editorial-original",
    "author": "Редактор",
    "createdAt": "2026-08-08",
    "reviewedBy": "Другой редактор",
    "reviewedAt": "2026-08-08"
  },
  "annotationEn": {
    "text": "Original two or three sentences.",
    "method": "editorial-original",
    "author": "Editor",
    "createdAt": "2026-08-08",
    "reviewedBy": "Another editor",
    "reviewedAt": "2026-08-08"
  },
  "factChecks": [],
  "sources": [],
  "rights": {
    "textOrigin": "project-original",
    "copiedSourceText": false
  }
}
```

Канонический `recordKey` выбирается до публикации. Проверенный набор RU/EN/original titles позволяет pipeline связать точные OL-алиасы с canonical ID, не создавая публичный дубль.

Cross-writer связь никогда не исправляется по одному совпавшему внешнему ID. Для доказанной ошибочной привязки batch должен содержать отдельный `confirmedMerges` с точным `fromRecordKey`, тем же объявленным Open Library/Wikidata identity, отношением `same-work-wrong-writer-assignment`, пояснением и минимум двумя объявленными evidence URL из разных authority-family. Без этой независимо проверенной декларации обе записи остаются в `research`.

## Команды и release gate

```text
npm run books:enrichment:build
npm run books:enrichment:check
npm run books:audit
```

Генератор детерминирован и идемпотентен. `--check` падает, если manifest, отчёты или reviewed promotion устарели. `books:audit` включает эту проверку и targeted-тесты; `release:check` уже вызывает `books:audit`.
