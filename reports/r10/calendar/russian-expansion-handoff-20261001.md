# Календарная доработка: завершённый локальный пакет

Рабочая копия: `D:\Codex-задачи\2026-09-26\new-chat\work\probpera-r10`.

Дата проверки: 1 октября 2026 года, Москва. Commit и remote operations не выполнялись этим исполнителем. Изменения подготовлены для общего CI и разрешённой пользователем интеграции в main; этот отчёт не объявляет завершение всего новостного проекта или production deployment.

## Итог

- Андрей Платонов: точная дата рождения 28 августа 1899 года, вместо отсутствующей. Президентская библиотека явно указывает 16 (28) августа; Культура.РФ независимо подтверждает современный день.
- Николай Гоголь: день памяти 4 марта 1852 года; прежнее 21 февраля было историческим юлианским днём.
- Борис Пастернак: день рождения 10 февраля 1890 года; прежнее 29 января было историческим юлианским днём.
- Николай Лесков: день рождения 16 февраля 1831 года; прежнее 4 февраля было историческим юлианским днём.

Все четыре изменения относятся только к клонам записей для календаря. Канонические профили, биографии, набор писателей, типы birth/memory, внешний вид и фильтры сохранены. Четыре патча имеют expectedOld/evidence/identity guards, привязку к referenced Wikidata claim IDs и институциональным источникам с SHA256 документов. Повторное применение и откат проверены.

Всего annual events: 2339 → 2340. Календарные поля overlay: 25 → 29. В российском корпусе остаются 53 писателя: точные дни рождения 48 → 49, дни памяти 48. Исторические даты Нестора, Кирилла Туровского, Аввакума и Кантемира сохраняют uncertainty; отсутствующие даты смерти живых Пелевина и Лукьяненко не заполняются.

Исторические 25-field audit reports сохранены байт в байт; их scripts проверяют именно принятый прежний пакет. Отдельный `audit-russian-calendar-expansion-r10.mjs` проверяет актуальные 29 полей и 2340 событий. Восстановлен случайно обновлённый `russian-source-review.json` из HEAD: 6179 байт; все старые source/attestation проверки вновь проходят.

Новая additive governance attestation содержит 27 точных обратных фрагментов на 10 путях и 12 неизменённых foundations. SHA256 canonical JSON новой аттестации: `bc1330bda023dc1fe9172a6275230d51124d92c70475fe643c3e5d8dd9e9bd49`. SHA прежней calendar followup аттестации остаётся `686317fc56832427bf3226d6013bd37c08186164a03ea3f8772a7809f915c2d7`.

## Завершённые проверки

`npx tsc --noEmit`: exit 0.

Focused Vitest: 7 файлов, 74 проверки, все прошли:

```
npx vitest run scripts/lib/reviewed-russian-calendar-expansion.test.mjs scripts/lib/reviewed-calendar-followup.test.mjs scripts/lib/reviewed-calendar-security-followup.test.mjs scripts/lib/reviewed-undici-security-followup.test.mjs src/data/countries/calendarWriterDatePatches.test.ts src/data/countries/writerDatePatches.test.ts scripts/lib/stage5-content-data-lock.test.mjs
```

Все шесть команд exit 0:

```
node scripts/build-russian-calendar-expansion-r10.mjs --check
node scripts/build-russian-calendar-expansion-attestation-r10.mjs --check
node scripts/build-calendar-followup-attestation-r10.mjs --check
node scripts/audit-russian-calendar-r10.mjs --check
node scripts/audit-popular-calendar-r10.mjs --check
node scripts/audit-russian-calendar-expansion-r10.mjs --check
```

Новостные punctuation/profile failures переданы родительскому исполнителю/source agent. Они не входят в утверждение о календарных 74 проверках. Если последующие правки меняют один из уже hash-pinned путей, требуется следующий точный additive projection до этого календарного слоя; старые pins менять нельзя.

## Изменённые календарным исполнителем файлы

```
src/data/countries/calendarWriterDatePatches.ts
src/data/countries/calendarWriterDatePatches.test.ts
src/data/countries/writerDatePatches.test.ts
scripts/lib/reviewed-calendar-followup.mjs
scripts/lib/reviewed-calendar-followup.test.mjs
scripts/lib/reviewed-calendar-security-followup.test.mjs
scripts/lib/reviewed-undici-security-followup.test.mjs
scripts/lib/r10-exact-source-punctuation.test.mjs
scripts/build-calendar-followup-attestation-r10.mjs
scripts/audit-russian-calendar-r10.mjs
scripts/audit-popular-calendar-r10.mjs
```

## Новые файлы

```
src/data/countries/generated/writerDatePatches.r10-russian-expansion.json
scripts/build-russian-calendar-expansion-r10.mjs
scripts/build-russian-calendar-expansion-attestation-r10.mjs
scripts/audit-russian-calendar-expansion-r10.mjs
scripts/lib/reviewed-russian-calendar-expansion.mjs
scripts/lib/reviewed-russian-calendar-expansion.d.mts
scripts/lib/reviewed-russian-calendar-expansion.test.mjs
scripts/governance/russian-calendar-expansion-reviewed-20261001.json
reports/r10/calendar/russian-expansion-source-review-20261001.json
reports/r10/calendar/russian-expansion-coverage-20261001.json
reports/r10/calendar/russian-milestones-research-20261001.md
reports/r10/calendar/russian-expansion-handoff-20261001.md
```

Непубличный research document сохраняет найденные литературные годовщины и ограничения источников. Они не импортированы в календарь, приложение или БД.
