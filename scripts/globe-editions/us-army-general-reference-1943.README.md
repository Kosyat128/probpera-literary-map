# General Reference Map No. 1 (1943)

Этот источник используется для исторического скина глобуса `us-army-general-reference-1943`.

## Источник

- Лист: *General Reference Map No. 1*, Manual M-101, *Atlas of World Maps*, ноябрь 1943 года, 1057-G.
- Подготовлен American Geographical Society для Department of State.
- Издан U.S. Army Service Forces; типография A. Hoen & Co., Inc.
- Оригинал: <https://commons.wikimedia.org/wiki/File:General_Reference_Map_1.jpg>
- Прямая загрузка: <https://upload.wikimedia.org/wikipedia/commons/3/34/General_Reference_Map_1.jpg>
- Статус на Commons: `PD-USGov-Military`.
- Зафиксированный SHA-256: `60cd9e6057f9cb334cf93c9d1394c76754aca7297f7709836bc8dee13deeb6a1`.

Исходный JPEG хранится только в игнорируемом каталоге `scripts/.cache/`. Параметры приобретения, права, контрольная сумма, размеры и ручные точки калибровки находятся в `us-army-general-reference-1943.source.json`.

## Метод

На листе напечатана прерывистая равновеликая синусоидальная проекция из трёх секций. Скрипт аналитически переводит каждую точку целевой равнопромежуточной проекции обратно в нужную секцию с отдельными центральными меридианами для северной и южной половин. Небольшая поправка учитывает наклон и деформацию отсканированной страницы.

Полярные области не дорисовываются: все пиксели до ±90° берутся из напечатанных окрестностей вершин секций. Современная география используется только в QA-превью, но не попадает в WebP.

## Сборка

```powershell
python scripts/build-us-army-general-reference-1943.py
```

Если проверенного файла нет в кэше, разрешён единичный запуск с `--download`: загрузка будет принята только при точном совпадении SHA-256, размера и разрешения.

Результат:

- `public/textures/us-army-general-reference-1943.webp` — 4096×2048;
- `public/textures/us-army-general-reference-1943-mobile.webp` — 2048×1024;
- `reports/globe-editions/us-army-general-reference-1943/` — manifest, численные метрики и визуальные QA-превью.

Runtime должен применять `STANDARD_GLOBE_OVERLAY_PROFILE`: полный SVG-контур стран, заливка/обводка выбранной страны и связанный интерфейс выбора остаются отдельным слоем и не растрируются в историческую текстуру.
