# Матрица источников глобусов

Срез: 1 сентября 2026 года, базовый commit 47771ea8. Все девять runtime-изданий локальны; внешние запросы при просмотре не нужны. Сетевые acquisition-команды существуют только для ручного запуска и проверяют закреплённые размеры/SHA-256.

| ID | Источник | Права | Воспроизводимость | Runtime-профиль | Честный статус совмещения |
|---|---|---|---|---|---|
| behaim-1492 | UB Freiburg, Ravenstein 1908, листы 124-127 | PDM 1.0 | pinned 4-source builder | source-only centroid | NOT PASSED; отсутствующая география не дорисовывается |
| hondius-1615 | Library of Congress 2008627640 | LOC free-use/reuse route | pinned single-source builder | source-only centroid | NOT PASSED; нет independent holdout |
| coronelli-1697 | Stanford fw438kx8748 | PDM 1.0 | pinned single-source builder | source-only centroid | NOT PASSED; нет independent holdout |
| scherer-1700 | UIUC item 17c519d0… | NoC-US | pinned access derivative; preservation master documented separately | source-only centroid | FAIL в pilot; production не деформирован |
| cassini-1790 | Library of Congress 2004626115, a-e | LOC free-use/reuse route | pinned five-source Historical/Adapted Master chain | source-only centroid | NOT PASSED; baked canonical line не равна artwork residual |
| rand-mcnally-1887 | Library of Congress g3201b.ct001417 | LOC free-use/reuse route | pinned source + existing builder + history manifest | standard canonical | пользовательский baseline; hard residual не измерен |
| us-army-general-reference-1943 | M-101 sheet 1057-G, Rumsey scan via Commons | underlying federal map PD-US; scan publication permitted with required Rumsey credit | pinned analytical reprojection | standard canonical | FAIL hard proxy: p95 4 px при цели 2 px |
| nasa-blue-marble | NASA GSFC SVS 3487 | NASA media guidance, credit required | pinned source identity recorded | standard canonical | исторический Gate C не применяется |
| natural-earth-2026 | Natural Earth I + Admin 0 v5.1.2 | public domain | tracked source and deterministic RU/EN builder | standard canonical | каноническое современное издание |

Полные URL, размеры и SHA-256 находятся в source-manifest.json. Пять ранних изданий намеренно не получают флаговую заливку или современный outline: это защита от ложного заявления о точном совмещении.
