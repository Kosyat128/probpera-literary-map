# AUTOPILOT PROTOCOL V12

## 1. Цель

Codex выполняет долгий проект как устойчивый конвейер, а не как один
огромный ответ. Пользователь один раз загружает ZIP. Дальнейшее состояние
живёт в репозитории.

## 2. Разрешённые без подтверждения действия

- read-only аудит репозитория, истории, PR и CI;
- создание рабочей ветки;
- in-scope код, тесты и документация;
- локальные и CI сборки;
- dry-run migrations;
- schema/migration source changes;
- reproducible content artifacts;
- исправление локальных ошибок;
- атомарные коммиты;
- открытие итогового PR.

## 3. Граница автономности

Не выполнять без владельца:

- merge в main;
- production deployment;
- production DB mutation;
- store submission;
- real-money transaction;
- signing secret;
- merchant credentials;
- принятие договоров;
- публикацию защищённого персонажа без лицензии;
- покупку внешнего сервиса;
- удаление production data.

Это не повод останавливать остальной проект.

## 4. Stage loop

Для каждого criterion:

1. `select` — первый незавершённый внутренний criterion.
2. `inspect` — минимум релевантных файлов/specs.
3. `plan-local` — короткий implementation note.
4. `implement` — законченный vertical slice.
5. `validate-narrow` — узкие tests/typecheck/build.
6. `repair` — исправить до green.
7. `validate-boundary` — regression/parity/security.
8. `evidence` — сохранить logs/screenshot/report.
9. `commit` — atomic commit.
10. `checkpoint` — обновить state/status.
11. `continue` — автоматически выбрать следующий.

## 5. Repair loop

При failing test/build:

- воспроизвести;
- локализовать root cause;
- определить, pre-existing ли failure;
- исправить минимально;
- rerun narrow;
- rerun boundary;
- не отключать test;
- не добавлять blanket skip;
- не менять baseline только ради green.

После трёх действительно разных неудачных подходов:

- записать exact blocker и evidence;
- выделить независимые задачи;
- продолжить их;
- вернуться позже;
- не спрашивать владельца, если проблема решается инженерно.

## 6. State files

- `docs/mobile/AUTOPILOT_STATE.json` — machine-readable truth.
- `docs/mobile/STATUS.md` — readable status.
- `docs/mobile/AUTOPILOT_JOURNAL.md` — append-only stage journal.
- `docs/mobile/NEXT_CODEX_PROMPT.txt` — self-contained resume instruction.
- `docs/mobile/BLOCKERS.md` — internal/external split.

## 7. Internal vs external blocker

Internal:

- build error;
- test failure;
- missing code;
- bad UI;
- performance issue;
- insecure implementation;
- incomplete schema;
- missing documentation.

Codex обязан исправлять.

External:

- developer/store account;
- certificate/signing key;
- merchant credentials;
- production secret;
- legal agreement;
- licensed character asset/right;
- manual store review.

Codex завершает всю preparation и указывает точный owner step.

## 8. Context limit

Перед завершением сессии:

- не оставлять наполовину записанный migration;
- привести working tree к понятному состоянию;
- commit completed work;
- сохранить uncommitted intent отдельным patch, если нужно;
- обновить state;
- записать `resumeFrom`;
- перечислить lastGreenCommands;
- перечислить changed files;
- записать one next action.

## 9. Reporting

Промежуточный отчёт не является паузой. После отчёта продолжать.

Отчёт:

- Stage/criterion;
- commit;
- result;
- tests;
- artifact/evidence;
- next criterion;
- external blockers.

## 10. Stop condition

Остановиться можно только когда:

- все внутренние criteria complete;
- full gates green;
- три platform release matrices заполнены;
- artifacts/checksums готовы;
- final PR открыт;
- внешние steps изолированы;
- FINAL_HANDOFF готов.

Auto-merge запрещён.
