# Статус реализации глобусов

Текущий inventory: 9 зарегистрированных и 9 доступных изданий. Выбранное военное издание — M-101 1943. Базовый commit: 47771ea8; поверх него находятся сегодняшние runtime/UI исправления и этот non-binary evidence-пакет.

Готово в этом пакете: воспроизводимые builders и pinned configs ранних глобусов, Cassini master/runtime chain, rejected Scherer alignment pilot, Scherer preservation audit, ручные checksum-pinned acquisition-команды, Rand source manifest и актуальные source/final matrices. Production WebP не изменялись, новые бинарные файлы не добавлялись.

Четыре узких evidence-checker:

- historical runtime identity: PASS, 4 издания / 8 WebP;
- historical artwork acceptance: PASS как fail-safe checker, подтверждает NOT PASSED для 5 ранних изданий;
- Cassini runtime chain: PASS, 2 WebP и обе review chains;
- Scherer preservation record: PASS, production неизменён.
- source manifest output identity: PASS, 20 runtime-файлов совпали по размеру и SHA-256.

Не закрыто: hard Gate C для пяти source-only изданий; M-101 proxy p95 остаётся 4 px; Rand остаётся пользовательским legacy baseline без нового независимого residual-набора. Полный E2E и deployment сегодня не повторялись.

Обычный build не получил новых сетевых шагов. Source acquisition и candidate-build запускаются только вручную через явно именованные package targets; candidate-build не меняет tracked production до отдельной проверки и осознанного promotion.

Финальный статический аудит: 22 JSON-файла разобраны без ошибок; 12 globe package-targets указывают на существующие scripts/configs; отменённые source references в globe scope отсутствуют.
