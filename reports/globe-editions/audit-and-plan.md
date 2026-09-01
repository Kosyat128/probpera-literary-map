# Аудит и план: издания глобуса

## Текущий результат

На базе commit 47771ea8 зарегистрированы и доступны девять изданий, включая M-101 1943. Сегодня уже выполненные runtime/UI/texture-изменения не пересобирались повторно. Этот пакет добавляет только отсутствовавшие воспроизводимые источники, builders, hard-gate evidence и актуальные отчёты.

Проверена точная идентичность существующих WebP для Behaim, Hondius, Coronelli, Scherer и Cassini с ранее произведёнными sidecar-записями. Бинарные assets не копировались и не изменялись. Для Rand McNally добавлен machine-readable source manifest с цепочкой commit abcf1ef9 → 675bd01d → 5b1f4da9.

## Что добавлено сегодня

- офлайн candidate-builder и checksum checker для Behaim, Hondius, Coronelli и Scherer; candidate-build не меняет tracked production до отдельной проверки;
- ручной checksum-pinned source acquisition для этих четырёх изданий;
- Cassini Historical/Adapted Master builders, ручной source acquisition, runtime checker, focused tests и полная tracked sidecar-chain;
- Scherer preservation-source audit без загрузки 448.8 MB TIFF;
- воспроизводимый rejected artwork/vector pilot и hard acceptance checker;
- source manifest, source matrix, final A-D comparison и implementation status для всех девяти изданий;
- отдельные package targets; `build:from-snapshot` и globe asset chain остаются без сетевой зависимости. Полный `npm run build` отдельно включает существующий CMS export.

## Границы доказанного

Нулевая ошибка между каноническим SVG и линией, построенной из того же канонического mask, не доказывает совмещение исторической гравюры. Поэтому Gate C остаётся NOT PASSED для Behaim, Hondius, Coronelli, Scherer и Cassini. Scherer имеет явный FAIL pilot. M-101 имеет текущий proxy p95 4 px при целевом p95 2 px и также не получает ложный hard PASS. Rand остаётся принятым визуальным baseline без нового независимого residual-набора.

Текущий GeoJSON отличается от байтов build-era версии одним знаком пунктуации в NAME_RU для PNG; parsed feature geometry не изменилась. Ported reports фиксируют это отдельно и не утверждают новый rebuild.

## Остаток, не выполнявшийся повторно

Полный E2E-набор и deployment сегодня не запускались. Для строгого закрытия Gate C нужны независимые fit/holdout landmarks, source-specific reviewed land masks и protected-content review каждого исторического издания; это новая исследовательская работа, а не безопасный перенос уже готовых материалов.

Текущая безопасная эксплуатация: пять ранних глобусов используют source-only centroid selection, остальные - standard canonical overlay. Изменять этот fail-safe до прохождения hard Gate C нельзя.
