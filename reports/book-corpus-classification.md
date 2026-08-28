# Классификация книжного корпуса

Сформировано: 2026-08-26T00:00:00.000Z

> Quarantine и публикационный gate - временная защита. Цель manifest: довести каждую каноническую карточку до оригинальных, проверенных RU/EN-аннотаций без копирования неизвестно лицензированного текста.

## Точный объём

- Всего карточек в архиве: 10015.
- Draft-карточек в редакционной очереди: 9739.
- Reviewed/verified-карточек, которые не проходят полный publication gate: 248.
- Всего непубличных карточек, требующих обогащения: 9987.
- Raw draft ID, включая скрытые текущей дедупликацией: 9742.
- Всего target ID в manifest (draft + непубличные editorial): 9990.
- Скрытых raw-дублей: 3.

## Автоматическая классификация target ID

- reject: 242.
- merge: 47.
- ready (полный RU+EN-контроль): 20.
- research: 9681.
- Осталось канонических research-записей: 9681.

## Исходное качество всех непубличных карточек

- Open Library imports: 6567.
- Legacy title-only: 3127.
- Curated draft: 45.
- Reviewed/verified, ещё не прошедшие publication gate: 248.
- С годом первой публикации: 6550.
- С языком оригинала: 52.
- Со structured provenance: 0.
- С RU/EN translations: 0.
- С существующим description: 249; готовых аннотаций среди них: 0.

## Безопасно применённые решения

- Open Library edition ID (OL…M вместо work OL…W), оставленных в research до canonical resolution: 28.
- Всего raw-групп повторного использования одного внешнего work ID: 119.
- Raw-записей в этих группах: 618.
- После deterministic reject остаётся конфликтных групп: 97 (385 записей).
- Cross-writer групп, оставленных в research до проверки авторства: 97 (385 записей).
- Same-writer external-ID merge: 0.
- Точных alias-merge в уже проверенные публичные canonical works: 7.
- Reviewed external-identity merge у того же автора: 14.
- Явных independently reviewed исправлений неверной writer-связи: 1.

## Правила текста и прав

- `ready` требует оригинальные редакционные RU и EN аннотации: по 2-3 предложения, 140-900 знаков, автор и проверяющий.
- Требуются минимум два независимых HTTPS-источника и отдельные fact checks identity/authorship/year/language.
- Wikidata используется как CC0 structured data, но не как готовая аннотация.
- Wikipedia/Wikimedia prose требует page/revision/attribution/authors URL и совместимую CC BY-SA лицензию.
- Google Books descriptions не копируются и не сохраняются массово.

Подробные решения по каждому raw ID находятся в `data/book-enrichment-manifest.json`.
