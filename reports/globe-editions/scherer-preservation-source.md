# Scherer 1700: authoritative preservation source

Проверено 31 августа 2026 года. Итог: официальный источник выше 3000 × 2000 найден и закреплён, но production-текстура намеренно не заменена.

## Что найдено

Карточка UIUC для *Typus Totius Orbis Terraquei…* имеет стабильный item UUID `17c519d0-8bdc-0137-6dac-02d0d7bfd6e4-9`, Map ID `afm0003392`, репозиторий Rare Book & Manuscript Library и статус **No Copyright – United States / public domain**: [карточка](https://digital.library.illinois.edu/items/17c519d0-8bdc-0137-6dac-02d0d7bfd6e4-9), [машинная JSON-запись](https://digital.library.illinois.edu/items/17c519d0-8bdc-0137-6dac-02d0d7bfd6e4-9.json), [rights statement](https://rightsstatements.org/page/NoC-US/1.0/).

У UIUC есть два разных уровня изображения:

- access binary `e0f792e0-8be8-0137-6dac-02d0d7bfd6e4-0`: публичный IIIF `3000 × 2000`; именно он остаётся текущим production input ([info.json](https://images.digital.library.illinois.edu/iiif/2/e0f792e0-8be8-0137-6dac-02d0d7bfd6e4-0/info.json));
- preservation master `e14fe7f0-8be8-0137-6dac-02d0d7bfd6e4-8`: TIFF `448 825 264` байта, `10 147 × 7 371`, 16 bit/sample, RGB, без сжатия, 600 dpi, `page_count=2` ([binary JSON](https://digital.library.illinois.edu/binaries/e14fe7f0-8be8-0137-6dac-02d0d7bfd6e4-8.json), [IIIF info.json](https://images.digital.library.illinois.edu/iiif/2/e14fe7f0-8be8-0137-6dac-02d0d7bfd6e4-8/info.json), [стабильный download route](https://digital.library.illinois.edu/binaries/e14fe7f0-8be8-0137-6dac-02d0d7bfd6e4-8/object)).

Следовательно, `3000 × 2000` — предел текущего access binary, а не предел оцифровки UIUC. Preservation master подтверждён официальными binary- и IIIF-метаданными.

## Минимальная проверка получения

Одиночный запрос официального 5K-производного `.../full/5074,/0/default.jpg` вернул HTTP 500 `Java heap space`. Малые IIIF region-запросы к тому же preservation binary проходят. Из 20 регионов собран один локальный QA-кандидат `5074 × 3686`:

- путь: `scripts/.cache/globe-editions/historical-runtime/source-candidates/scherer-1700-uiuc-preservation-5074.jpg`;
- размер: `5 804 534` байта;
- SHA-256: `1843BAB357743690188279D616F1A9364714D3A27752DDB60E7E02AF919EEFEE`;
- статус: ignored cache, `runtimeEligible=false`, geometry registration не запускалась;
- визуальная проверка: карта целиком и цветовая мишень видимы; ответ HTML/WAF в изображение не попал.

Точный рецепт закреплён в `scripts/globe-editions/scherer-preservation-source.json`: исходная сетка `2048 × 2048`, 5 × 4 region-запроса, 2:1 уменьшение внутренних тайлов, край `978 × 614`, компоновка row-major на белом RGB-холсте `5074 × 3686`, JPEG quality 98, 4:4:4, sharp 0.35.3. WAF-токен и короткоживущий signed S3 URL не сохраняются.

Raw TIFF не скачан: 448,8 МБ противоречат заданному ограничению на размер, а публичные метаданные не публикуют checksum оригинала. Карточка предлагает `Original File (TIFF)`, стабильный `/object` route выдаёт временный подписанный URL после browser/WAF session. Для получения без неоправданного объёма подготовлен, но не отправлен запрос на `digitalcollections@lists.illinois.edu`: попросить SHA-256 оригинала, подтвердить нужную TIFF-страницу и предоставить стабильный 5K derivative. Текст запроса находится в JSON-конфиге.

OAI-ID вида `oai:digital.library.illinois.edu:<item UUID>` встречается у внешних harvesters UIUC, но публичный OAI-PMH endpoint для этой записи не удалось подтвердить. Поэтому authoritative machine route здесь — официальный item JSON, а OAI-шаблон помечен только как неподтверждённый candidate, не как источник бинарных параметров.

## Почему нельзя заменить production автоматически

Preservation capture имеет другое кадрирование и включает цветовую шкалу; TIFF сообщает две страницы. Текущие gore-точки измерены в системе координат `3000 × 2000`, поэтому простое масштабирование координат не доказывает совпадение геометрии. Перед заменой требуются выбор страницы и crop, новые точки вершин/экватора/широт, source-to-canonical registration и проверка residual/seam/coastline overlay. До этого production snapshot остаётся неизменным:

- `public/textures/scherer-1700.webp`: `4096 × 2048`, SHA-256 `B844CC59C075E03873C137DAA761431DDB1F9F97676FAC1C33B0EC28679CFF64`;
- `public/textures/scherer-1700-mobile.webp`: `2048 × 1024`, SHA-256 `573B03CAD23A9C626B13BE4169B3089F6281A1E75049CB92D081E5EE1A7E6035`.

## Дополнительные глобусы для сверки

Высокое разрешение само по себе не делает копию взаимозаменяемой:

- [Wikimedia Commons / RareMaps](https://commons.wikimedia.org/wiki/File:Heinrich_Scherer,_Typus_Totius_Orbis_Terraquei_Geographice_Delineatus,_Et_Ad_Usum_Globo_Materiali_Superinducendus.jpg): `8407 × 5274`, SHA-256 `3D6BD4442305E803198E629C84B6C111865182B0E0B4E513118A76850CC65EF8`; другая физическая копия, иная ручная раскраска и crop, только comparison reference;
- официальный MDZ/BSB volume [bsb11212284](https://www.digitale-sammlungen.de/en/details/bsb11212284), [IIIF manifest](https://api.digitale-sammlungen.de/iiif/presentation/v2/bsb11212284/manifest): разворот разделён на scans 332 и 333, другая/неокрашенная копия, права `NoC-NC`; только geometry reference.

Эти три локальных reference-файла также закреплены размерами и SHA-256 в конфиге, но ни один не объявлен production-eligible.

## Целевая проверка

Запускается только один узкий checker, без build и E2E:

```powershell
node scripts/check-scherer-preservation-source.mjs --require-cache
```

Он проверяет идентификаторы и метаданные preservation master, что production по-прежнему ссылается на access binary `3000 × 2000`, неизменность desktop/mobile texture hash, а при `--require-cache` — размеры и SHA-256 четырёх локальных QA/reference-файлов.
