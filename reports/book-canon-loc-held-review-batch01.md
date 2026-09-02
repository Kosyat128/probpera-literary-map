# LoC held Work identity review - batch 01

Проверено: 2026-09-02. Источник отбора - выставка Библиотеки Конгресса США [Books That Shaped America](https://www.loc.gov/exhibits/books-that-shaped-america/exhibititems.html). Batch имеет статус `research-only`: он не создаёт canon claims, не меняет основную базу и не содержит production actions.

## Метод

Для каждой из десяти held-записей `candidateKind=work` вручную сверены полное заглавие, автор, год первого издания и граница Work/Manifestation на официальной странице LoC. Русское заглавие принято только при наличии точной записи РГБ, НЭБ/РНБ либо официального российского издателя. Затем выполнен полный exact-title и writer-identity scan текущего `archiveRawBooks` и массива стран/писателей; близкое упоминание внутри сборника не считалось отдельной карточкой произведения.

## Результаты

| Ordinal | Work и год | Точное русское заглавие | Текущий архив | Решение |
| ---: | --- | --- | --- | --- |
| 20 | *Uncle Tom’s Cabin; or, Life Among the Lowly.* - Harriet Beecher Stowe, 1852 | «Хижина дяди Тома» - [РГБ 01002380533](https://search.rsl.ru/ru/record/01002380533) | Нет Work и профиля автора | `draft-addition` |
| 26 | *Little Women, or, Meg, Jo, Beth, and Amy.* - Louisa May Alcott, 1868 | «Маленькие женщины» - [РГБ 01009956741](https://search.rsl.ru/ru/record/01009956741); исторический полный вариант - [РГБ 01003693490](https://search.rsl.ru/ru/record/01003693490) | Нет Work и профиля автора | `draft-addition` |
| 35 | *The Wonderful Wizard of Oz.* - L. Frank Baum, 1900 | «Удивительный волшебник из Страны Оз» - [РГБ 01007658629](https://search.rsl.ru/ru/record/01007658629) | Нет Work и профиля автора | `draft-addition` |
| 40 | *The Jungle.* - Upton Sinclair, 1906 | «Джунгли» - [НЭБ / запись РНБ](https://rusneb.ru/catalog/000200_000018_v19_rc_2097738/) | Нет Work и профиля автора | `draft-addition` |
| 52 | *Gone With the Wind.* - Margaret Mitchell, 1936 | «Унесенные ветром» - [РГБ 01009814002](https://search.rsl.ru/ru/record/01009814002) | Нет Work и профиля автора | `draft-addition` |
| 73 | *Charlotte’s Web.* - E. B. White, 1952 | «Паутина Шарлотты» - [официальная карточка АСТ, ISBN 978-5-17-067618-7](https://ast.ru/book/pautina-sharlotty-031216/) | Нет Work и профиля автора | `draft-addition` |
| 76 | *Atlas Shrugged.* - Ayn Rand, 1957 | «Атлант расправил плечи» - [РГБ 01004953161](https://search.rsl.ru/ru/record/01004953161) | Нет Work и профиля автора | `draft-addition` |
| 83 | *Silent Spring.* - Rachel Carson, 1962 | «Безмолвная весна» - [НЭБ / запись ВГБИЛ](https://rusneb.ru/catalog/000201_000010_BJVVV989750/) | Нет Work и профиля автора | `draft-addition` |
| 89 | *In Cold Blood: A True Account of a Multiple Murder and Its Consequences.* - Truman Capote, 1966 | «Хладнокровное убийство» - [официальная карточка «Азбуки», ISBN 978-5-389-18181-6](https://azbooka.ru/books/khladnokrovnoe-ubiystvo-peea) | Нет Work и профиля автора | `draft-addition` |
| 94 | *Beloved: A Novel.* - Toni Morrison, 1987 | «Возлюбленная» - [официальная карточка «Эксмо», ISBN 978-5-04-114157-8](https://eksmo.ru/amp/book/vozlyublennaya-ITD1109970/) | Единственная карточка `usa:tony_morrison:beloved` | `accepted-mapping` |

## Проверенные фактические основания описаний

- [Uncle Tom’s Cabin, LoC](https://www.loc.gov/exhibits/books-that-shaped-america/1850-to-1900.html#obj2): сериализация 1851-1852 годов, книжное издание 1852 года, антирабовладельческий контекст.
- [Little Women, LoC](https://www.loc.gov/exhibits/books-that-shaped-america/1850-to-1900.html#obj7): первое издание 1868 года, автобиографическая основа, ранний успех и продолжения.
- [The Wonderful Wizard of Oz, LoC](https://www.loc.gov/exhibits/books-that-shaped-america/1900-to-1950.html#obj0): издание 1900 года, американская детская фантазия и продолжение цикла самим Баумом.
- [The Jungle, LoC](https://www.loc.gov/exhibits/books-that-shaped-america/1900-to-1950.html#obj5): расследовательский характер романа и связь его резонанса с федеральным пищевым законодательством 1906 года.
- [Gone With the Wind, LoC](https://www.loc.gov/exhibits/books-that-shaped-america/1900-to-1950.html#obj18): действие на Юге США во время Гражданской войны, награды и необходимость нейтрально отражать критику изображения рабства.
- [Charlotte’s Web, LoC](https://www.loc.gov/exhibits/books-that-shaped-america/1950-to-2000.html#obj2): история паучихи, спасающей поросёнка, и трактовка смерти как естественной части жизни.
- [Atlas Shrugged, LoC](https://www.loc.gov/exhibits/books-that-shaped-america/1950-to-2000.html#obj5): ближайшее будущее, кризис институтов и влияние на либертарианскую мысль.
- [Silent Spring, LoC](https://www.loc.gov/exhibits/books-that-shaped-america/1950-to-2000.html#obj12): влияние пестицидов на природу и человека и роль книги в развитии экологического движения.
- [In Cold Blood, LoC](https://www.loc.gov/exhibits/books-that-shaped-america/1950-to-2000.html#obj18): исследование убийства в Канзасе, участие Харпер Ли и форма документального романа.
- [Beloved, LoC](https://www.loc.gov/exhibits/books-that-shaped-america/1950-to-2000.html#obj23): послевоенная история бывшей рабыни, издание 1987 года и Пулитцеровская премия 1988 года.

## Work/Expression/Manifestation и обнаруженные расхождения

- `The Jungle` - один Work 1906 года. Экспозиция LoC показывает книжный экземпляр 1945 года; этот год нельзя переносить в `firstPublished`.
- Русское издание `Atlas Shrugged` в трёх частях - одна Manifestation одного Work, а не три произведения.
- Двухтомные русские издания `Gone With the Wind` и первое двухтомное издание `Uncle Tom’s Cabin` не создают дополнительные Work.
- «Волшебник Изумрудного города» Александра Волкова - самостоятельная адаптация, а не русское заглавие или Expression книги Баума.
- Полная формула LoC `Beloved: A Novel.` и архивное `Beloved` относятся к одному роману 1987 года; безопасный результат - alias к существующей карточке, без создания второго Work.
- Сохранённый registry URL для `Gone With the Wind` оканчивается на `#obj17`, тогда как текущая живая страница LoC использует `#obj18`. Item hash и исходная транскрипция не переписаны; в batch отдельно сохранён работающий официальный URL.
- Страница LoC 2012 года сохраняет для Тони Моррисон историческую помету `b. 1931`. Она не используется как актуальный биографический факт; batch проверяет только авторство, заглавие и год произведения.

## Потенциально безопасная интеграция

Единственное готовое identity-решение - сопоставить точное выставочное заглавие `Beloved: A Novel.` с `usa:tony_morrison:beloved` и хранить его как проверенный английский alias. Даже оно должно пройти отдельный generator-approved review и не даёт второго независимого canon signal автоматически.

Остальные девять записей безопасны только как закрытые `draft-addition`: сначала нужны проверенные профили авторов, Work-level Evidence V2, точная модель русского Expression, редакторская проверка двух предложений описания и отдельная проверка прав изображения. До выполнения этих условий batch намеренно не формирует карточки, публичные статусы или действия релиза.
