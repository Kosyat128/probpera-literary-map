# Каталог литературных персонажей V6

Этот каталог является продуктовым и техническим планом для Codex. Он НЕ
является юридическим заключением и сам по себе не разрешает публикацию
персонажа, имени, перевода, иллюстрации, голоса, 3D-модели, фона или
маркетингового изображения.

Единственный персонаж, который может быть базовым owner-original героем,
- Планетка. Все сторонние персонажи по умолчанию заблокированы до
проверки конкретного произведения, перевода, визуальной версии,
территории, товарных знаков, лицензии и ассетов.

Главная образовательная связь для каждого активного героя:

**герой → произведение → автор → страна → Литературная планета → факт →
короткое задание**.

Статусы:

- `OWNER_ORIGINAL` - собственный персонаж проекта;
- `FOLKLORE_PD_CANDIDATE_AUDIT` - фольклорный кандидат, требуется evidence;
- `CLASSIC_PD_CANDIDATE_AUDIT` - классический кандидат, требуется проверка
  территории, перевода, иллюстраций и товарных знаков;
- `SPECIAL_*` - особая/неоднозначная правовая ситуация;
- `LICENSE_REQUIRED` - production запрещён до лицензии;
- `blocked`/`blocked-until-evidence` - не показывать пользователю и не
  включать в магазин.

## Candidate catalog

| Группа | Приоритет | ID | Персонаж/мир | Источник | Автор/традиция | Возраст-ориентир | Правовой трек | Статус по умолчанию | Ключевое ограничение |
|---|---:|---|---|---|---|---|---|---|---|
| CORE | 0 | `planetka` | Планетка / Planetka | Оригинальный персонаж проекта | Проба пера | 3-17 | `OWNER_ORIGINAL` | `eligible-after-owner-art-review` | Главный guide; не заменяется сторонними героями. |
| RU_FOLKLORE_CLASSIC | 1 | `kolobok` | Колобок | Русская народная сказка «Колобок» | Фольклор | 3-7 | `FOLKLORE_PD_CANDIDATE_AUDIT` | `blocked-until-evidence` | Только оригинальная интерпретация; не копировать мультфильмы/игрушки. |
| RU_FOLKLORE_CLASSIC | 1 | `repka_cast` | Герои «Репки» | Русская народная сказка «Репка» | Фольклор | 3-6 | `FOLKLORE_PD_CANDIDATE_AUDIT` | `blocked-until-evidence` | Оригинальные персонажи по сюжету. |
| RU_FOLKLORE_CLASSIC | 1 | `teremok_cast` | Герои «Теремка» | Русская народная сказка «Теремок» | Фольклор | 3-6 | `FOLKLORE_PD_CANDIDATE_AUDIT` | `blocked-until-evidence` | Оригинальные образы животных. |
| RU_FOLKLORE_CLASSIC | 1 | `ivan_tsarevich` | Иван-царевич | Русские волшебные сказки | Фольклор | 6-12 | `FOLKLORE_PD_CANDIDATE_AUDIT` | `blocked-until-evidence` | Не копировать кино/анимационные версии. |
| RU_FOLKLORE_CLASSIC | 1 | `vasilisa` | Василиса Премудрая | Русские волшебные сказки | Фольклор | 6-12 | `FOLKLORE_PD_CANDIDATE_AUDIT` | `blocked-until-evidence` | Age-safe оригинальная интерпретация. |
| RU_FOLKLORE_CLASSIC | 1 | `frog_princess_ru` | Царевна-лягушка | Русская народная сказка | Фольклор | 5-10 | `FOLKLORE_PD_CANDIDATE_AUDIT` | `blocked-until-evidence` | Без копирования современных иллюстраций. |
| RU_FOLKLORE_CLASSIC | 1 | `baba_yaga` | Баба-яга | Русский фольклор | Фольклор | 5-12 | `FOLKLORE_PD_CANDIDATE_AUDIT` | `blocked-until-evidence` | Мягкий вариант для младших; sensitivity review. |
| RU_FOLKLORE_CLASSIC | 1 | `koschei` | Кощей Бессмертный | Русский фольклор | Фольклор | 7-13 | `FOLKLORE_PD_CANDIDATE_AUDIT` | `blocked-until-evidence` | Не делать пугающим для младших. |
| RU_FOLKLORE_CLASSIC | 1 | `firebird` | Жар-птица | Русские сказки | Фольклор | 5-12 | `FOLKLORE_PD_CANDIDATE_AUDIT` | `blocked-until-evidence` | Оригинальный дизайн. |
| RU_FOLKLORE_CLASSIC | 1 | `morozko` | Морозко | Русская народная сказка | Фольклор | 5-10 | `FOLKLORE_PD_CANDIDATE_AUDIT` | `blocked-until-evidence` | Не копировать фильм. |
| RU_FOLKLORE_CLASSIC | 1 | `snegurochka` | Снегурочка | Фольклор / литературные версии | Фольклор/классика | 5-12 | `SPECIAL_RIGHTS_SOURCE_REVIEW` | `blocked-until-evidence` | Проверить конкретный source track и дизайн. |
| RU_FOLKLORE_CLASSIC | 1 | `emelya` | Емеля | Русская народная сказка | Фольклор | 5-10 | `FOLKLORE_PD_CANDIDATE_AUDIT` | `blocked-until-evidence` | Оригинальный образ. |
| RU_FOLKLORE_CLASSIC | 1 | `sivka_burka` | Сивка-Бурка | Русская народная сказка | Фольклор | 6-11 | `FOLKLORE_PD_CANDIDATE_AUDIT` | `blocked-until-evidence` | Оригинальный образ. |
| RU_FOLKLORE_CLASSIC | 2 | `sadko` | Садко | Новгородская былина | Фольклор | 8-14 | `FOLKLORE_PD_CANDIDATE_AUDIT` | `blocked-until-evidence` | Возрастная адаптация морских эпизодов. |
| RU_FOLKLORE_CLASSIC | 1 | `alyonushka_ivanushka` | Алёнушка и братец Иванушка | Русская народная сказка | Фольклор | 5-10 | `FOLKLORE_PD_CANDIDATE_AUDIT` | `blocked-until-evidence` | Sensitive scenes review. |
| RU_FOLKLORE_CLASSIC | 1 | `masha_bear_folklore` | Маша и Медведь (фольклор) | Русская народная сказка | Фольклор | 3-7 | `SPECIAL_TRADEMARK_ADAPTATION_REVIEW` | `blocked-until-evidence` | Не использовать современный бренд/анимационный дизайн. |
| RU_CLASSIC | 1 | `little_humpbacked_horse` | Конёк-Горбунок | «Конёк-Горбунок» | Пётр Ершов | 6-12 | `CLASSIC_PD_CANDIDATE_AUDIT` | `blocked-until-evidence` | Оригинальная интерпретация; screen designs запрещены без прав. |
| RU_CLASSIC | 1 | `goldfish_pushkin` | Золотая рыбка | «Сказка о рыбаке и рыбке» | Александр Пушкин | 5-10 | `CLASSIC_PD_CANDIDATE_AUDIT` | `blocked-until-evidence` | Связать с автором/страной. |
| RU_CLASSIC | 1 | `learned_cat` | Кот учёный | Пролог к «Руслану и Людмиле» | Александр Пушкин | 5-12 | `CLASSIC_PD_CANDIDATE_AUDIT` | `blocked-until-evidence` | Не копировать известные современные иллюстрации. |
| RU_CLASSIC | 1 | `prince_gvidon` | Князь Гвидон | «Сказка о царе Салтане» | Александр Пушкин | 6-12 | `CLASSIC_PD_CANDIDATE_AUDIT` | `blocked-until-evidence` | Original art. |
| RU_CLASSIC | 1 | `swan_princess` | Царевна Лебедь | «Сказка о царе Салтане» | Александр Пушкин | 6-12 | `CLASSIC_PD_CANDIDATE_AUDIT` | `blocked-until-evidence` | Original art. |
| RU_CLASSIC | 2 | `balda` | Балда | «Сказка о попе и о работнике его Балде» | Александр Пушкин | 7-12 | `CLASSIC_PD_CANDIDATE_AUDIT` | `blocked-until-evidence` | Age/editorial review. |
| RU_CLASSIC | 2 | `ruslan_chernomor` | Руслан и Черномор | «Руслан и Людмила» | Александр Пушкин | 10-15 | `CLASSIC_PD_CANDIDATE_AUDIT` | `blocked-until-evidence` | Сложные эпизоды фильтровать. |
| RU_LICENSED_PRIORITY | 1 | `buratino_world` | Буратино и герои его мира | «Золотой ключик, или Приключения Буратино» | Алексей Толстой | 5-11 | `SPECIAL_RIGHTS_AND_TERRITORY_REVIEW` | `blocked` | Проверить текст, персонажей, иллюстрации, trademarks и территории. |
| RU_LICENSED_PRIORITY | 1 | `neznaika_world` | Незнайка и Цветочный город | Книги о Незнайке | Николай Носов | 5-12 | `LICENSE_REQUIRED` | `blocked` | Только лицензионные assets. |
| RU_LICENSED_PRIORITY | 1 | `cheburashka_world` | Чебурашка и Крокодил Гена | Книги Эдуарда Успенского | Эдуард Успенский | 4-10 | `LICENSE_REQUIRED` | `blocked` | Книжный/экранный дизайн требует отдельных прав. |
| RU_LICENSED_PRIORITY | 1 | `prostokvashino_world` | Дядя Фёдор, Матроскин и Шарик | Книги о Простоквашино | Эдуард Успенский | 5-11 | `LICENSE_REQUIRED` | `blocked` | Не использовать мультфильм без лицензии. |
| RU_LICENSED_PRIORITY | 1 | `chukovsky_world` | Айболит, Мойдодыр и другие герои | Произведения Корнея Чуковского | Корней Чуковский | 3-9 | `LICENSE_OR_SPECIAL_REVIEW` | `blocked` | Проверить тексты/переводы/иллюстрации/территории. |
| RU_LICENSED_PRIORITY | 2 | `emerald_city_world` | Герои Изумрудного города | Цикл «Волшебник Изумрудного города» | Александр Волков | 6-12 | `LICENSE_REQUIRED` | `blocked` | Отдельно от литературной страны Оз. |
| RU_LICENSED_PRIORITY | 2 | `hottabych` | Старик Хоттабыч | «Старик Хоттабыч» | Лазарь Лагин | 8-13 | `LICENSE_REQUIRED` | `blocked` | License required. |
| RU_LICENSED_PRIORITY | 2 | `alisa_selezneva` | Алиса Селезнёва | Цикл об Алисе Селезнёвой | Кир Булычёв | 8-14 | `LICENSE_REQUIRED` | `blocked` | License required; no film designs. |
| RU_LICENSED_PRIORITY | 2 | `domovenok_kuzya` | Домовёнок Кузя | Книги Татьяны Александровой | Татьяна Александрова | 4-9 | `LICENSE_REQUIRED` | `blocked` | License required. |
| RU_LICENSED_PRIORITY | 2 | `kitten_gav` | Котёнок по имени Гав | Рассказы Григория Остера | Григорий Остер | 3-8 | `LICENSE_REQUIRED` | `blocked` | License required. |
| RU_LICENSED_PRIORITY | 2 | `hedgehog_fog` | Ёжик в тумане | Сказка Сергея Козлова | Сергей Козлов | 5-10 | `LICENSE_REQUIRED` | `blocked` | Книжные и анимационные права отдельно. |
| RU_LICENSED_PRIORITY | 2 | `umka` | Умка | Литературный/анимационный источник | Юрий Яковлев и правообладатели | 3-8 | `LICENSE_REQUIRED` | `blocked` | Exact source/version audit. |
| RU_LICENSED_PRIORITY | 1 | `winnie_pooh_ru` | Винни-Пух (русская версия) | Пересказ/перевод и экранные версии | А. А. Милн / Борис Заходер / правообладатели | 4-10 | `COMPLEX_LICENSE_REQUIRED` | `blocked` | Отдельно проверять перевод, книжный и анимационный дизайн. |
| FOREIGN_CLASSIC | 1 | `alice` | Алиса / Alice | Alice’s Adventures in Wonderland | Lewis Carroll | 6-12 | `CLASSIC_PD_CANDIDATE_AUDIT` | `blocked-until-evidence` | Original source-based art; no Disney. |
| FOREIGN_CLASSIC | 1 | `white_rabbit` | Белый Кролик / White Rabbit | Alice’s Adventures in Wonderland | Lewis Carroll | 5-11 | `CLASSIC_PD_CANDIDATE_AUDIT` | `blocked-until-evidence` | No Disney design. |
| FOREIGN_CLASSIC | 1 | `cheshire_cat` | Чеширский Кот / Cheshire Cat | Alice’s Adventures in Wonderland | Lewis Carroll | 6-12 | `CLASSIC_PD_CANDIDATE_AUDIT` | `blocked-until-evidence` | No Disney design/trademark misuse. |
| FOREIGN_CLASSIC | 2 | `mad_hatter` | Безумный Шляпник / Mad Hatter | Alice’s Adventures in Wonderland | Lewis Carroll | 7-13 | `CLASSIC_PD_CANDIDATE_AUDIT` | `blocked-until-evidence` | Original literary interpretation. |
| FOREIGN_CLASSIC | 1 | `pinocchio` | Пиноккио / Pinocchio | Le avventure di Pinocchio | Carlo Collodi | 5-11 | `CLASSIC_PD_CANDIDATE_AUDIT` | `blocked-until-evidence` | No Disney; translation/illustration review. |
| FOREIGN_CLASSIC | 1 | `talking_cricket` | Говорящий Сверчок / Talking Cricket | Le avventure di Pinocchio | Carlo Collodi | 5-11 | `CLASSIC_PD_CANDIDATE_AUDIT` | `blocked-until-evidence` | Не использовать Disney Jiminy Cricket. |
| FOREIGN_FAIRY_TALES | 1 | `little_red_riding_hood` | Красная Шапочка / Little Red Riding Hood | European fairy tale | Фольклор / Перро / Гримм | 4-9 | `SOURCE_VERSION_AUDIT` | `blocked-until-evidence` | Выбрать source version; mild danger. |
| FOREIGN_FAIRY_TALES | 1 | `cinderella` | Золушка / Cinderella | Fairy tale versions | Перро / Гримм / фольклор | 4-10 | `SOURCE_VERSION_AUDIT` | `blocked-until-evidence` | No Disney visual. |
| FOREIGN_FAIRY_TALES | 1 | `snow_white` | Белоснежка / Snow White | Grimm fairy tale | Братья Гримм | 5-10 | `CLASSIC_PD_CANDIDATE_AUDIT` | `blocked-until-evidence` | No Disney; sensitive scenes softened. |
| FOREIGN_FAIRY_TALES | 1 | `puss_in_boots` | Кот в сапогах / Puss in Boots | Le Maître chat | Шарль Перро | 4-10 | `CLASSIC_PD_CANDIDATE_AUDIT` | `blocked-until-evidence` | No modern film/game design. |
| FOREIGN_FAIRY_TALES | 1 | `rapunzel` | Рапунцель / Rapunzel | Grimm fairy tale | Братья Гримм | 5-10 | `CLASSIC_PD_CANDIDATE_AUDIT` | `blocked-until-evidence` | No Disney design. |
| FOREIGN_FAIRY_TALES | 1 | `hansel_gretel` | Гензель и Гретель / Hansel and Gretel | Grimm fairy tale | Братья Гримм | 6-11 | `CLASSIC_PD_CANDIDATE_AUDIT` | `blocked-until-evidence` | Sensitivity review. |
| FOREIGN_FAIRY_TALES | 1 | `bremen_musicians` | Бременские музыканты / Town Musicians of Bremen | Grimm fairy tale | Братья Гримм | 4-10 | `CLASSIC_PD_CANDIDATE_AUDIT` | `blocked-until-evidence` | Не копировать советский мультфильм. |
| FOREIGN_FAIRY_TALES | 2 | `sleeping_beauty` | Спящая красавица / Sleeping Beauty | Fairy tale versions | Перро / Гримм | 5-10 | `SOURCE_VERSION_AUDIT` | `blocked-until-evidence` | No Disney. |
| FOREIGN_FAIRY_TALES | 2 | `frog_prince` | Принц-лягушка / The Frog Prince | Grimm fairy tale | Братья Гримм | 5-10 | `CLASSIC_PD_CANDIDATE_AUDIT` | `blocked-until-evidence` | Original art. |
| ANDERSEN | 1 | `snow_queen` | Снежная королева / The Snow Queen | The Snow Queen | Hans Christian Andersen | 6-12 | `CLASSIC_PD_CANDIDATE_AUDIT` | `blocked-until-evidence` | No modern adaptation design. |
| ANDERSEN | 1 | `gerda_kai` | Герда и Кай / Gerda and Kay | The Snow Queen | Hans Christian Andersen | 6-12 | `CLASSIC_PD_CANDIDATE_AUDIT` | `blocked-until-evidence` | Age-safe summary. |
| ANDERSEN | 1 | `thumbelina` | Дюймовочка / Thumbelina | Thumbelina | Hans Christian Andersen | 4-9 | `CLASSIC_PD_CANDIDATE_AUDIT` | `blocked-until-evidence` | Original art. |
| ANDERSEN | 1 | `ugly_duckling` | Гадкий утёнок / The Ugly Duckling | The Ugly Duckling | Hans Christian Andersen | 4-9 | `CLASSIC_PD_CANDIDATE_AUDIT` | `blocked-until-evidence` | Avoid appearance-shaming framing. |
| ANDERSEN | 2 | `little_mermaid_literary` | Русалочка (литературная версия) / The Little Mermaid | The Little Mermaid | Hans Christian Andersen | 7-13 | `CLASSIC_PD_CANDIDATE_AUDIT` | `blocked-until-evidence` | No Disney; ending sensitivity review. |
| ANDERSEN | 2 | `steadfast_tin_soldier` | Стойкий оловянный солдатик / The Steadfast Tin Soldier | The Steadfast Tin Soldier | Hans Christian Andersen | 7-12 | `CLASSIC_PD_CANDIDATE_AUDIT` | `blocked-until-evidence` | Ending sensitivity review. |
| OZ | 1 | `dorothy_oz` | Дороти / Dorothy Gale | The Wonderful Wizard of Oz | L. Frank Baum | 6-12 | `CLASSIC_PD_TERRITORY_AUDIT` | `blocked-until-evidence` | No MGM design; later Oz works separate. |
| OZ | 1 | `scarecrow_oz` | Страшила / Scarecrow | The Wonderful Wizard of Oz | L. Frank Baum | 6-12 | `CLASSIC_PD_TERRITORY_AUDIT` | `blocked-until-evidence` | No MGM design. |
| OZ | 1 | `tin_woodman_oz` | Железный Дровосек / Tin Woodman | The Wonderful Wizard of Oz | L. Frank Baum | 6-12 | `CLASSIC_PD_TERRITORY_AUDIT` | `blocked-until-evidence` | No MGM design. |
| OZ | 1 | `cowardly_lion_oz` | Трусливый Лев / Cowardly Lion | The Wonderful Wizard of Oz | L. Frank Baum | 6-12 | `CLASSIC_PD_TERRITORY_AUDIT` | `blocked-until-evidence` | No MGM design. |
| JUNGLE_BOOK | 1 | `mowgli` | Маугли / Mowgli | The Jungle Book | Rudyard Kipling | 7-13 | `CLASSIC_PD_TERRITORY_AUDIT` | `blocked-until-evidence` | No Disney/Soviet film design. |
| JUNGLE_BOOK | 1 | `bagheera` | Багира / Bagheera | The Jungle Book | Rudyard Kipling | 7-13 | `CLASSIC_PD_TERRITORY_AUDIT` | `blocked-until-evidence` | Source/translation details matter. |
| JUNGLE_BOOK | 1 | `baloo` | Балу / Baloo | The Jungle Book | Rudyard Kipling | 7-13 | `CLASSIC_PD_TERRITORY_AUDIT` | `blocked-until-evidence` | No Disney. |
| JUNGLE_BOOK | 2 | `akela` | Акела / Akela | The Jungle Book | Rudyard Kipling | 8-13 | `CLASSIC_PD_TERRITORY_AUDIT` | `blocked-until-evidence` | Age/sensitivity review. |
| FOREIGN_CLASSIC | 1 | `mole_wind_willows` | Крот / Mole | The Wind in the Willows | Kenneth Grahame | 6-11 | `CLASSIC_PD_TERRITORY_AUDIT` | `blocked-until-evidence` | Original art. |
| FOREIGN_CLASSIC | 1 | `toad_wind_willows` | Мистер Тоуд / Mr. Toad | The Wind in the Willows | Kenneth Grahame | 7-12 | `CLASSIC_PD_TERRITORY_AUDIT` | `blocked-until-evidence` | Risky driving framed responsibly. |
| FOREIGN_CLASSIC | 1 | `heidi` | Хайди / Heidi | Heidi | Johanna Spyri | 7-12 | `CLASSIC_PD_CANDIDATE_AUDIT` | `blocked-until-evidence` | Translation/illustration review. |
| ADVENTURE_CLASSIC | 1 | `tom_sawyer` | Том Сойер / Tom Sawyer | The Adventures of Tom Sawyer | Mark Twain | 9-14 | `CLASSIC_PD_CANDIDATE_AUDIT` | `blocked-until-evidence` | Episode-level age filtering. |
| ADVENTURE_CLASSIC | 2 | `huckleberry_finn` | Гекльберри Финн / Huckleberry Finn | Adventures of Huckleberry Finn | Mark Twain | 11-16 | `CLASSIC_PD_CANDIDATE_AUDIT` | `blocked-until-evidence` | Sensitive historical language/context review. |
| ADVENTURE_CLASSIC | 1 | `jim_hawkins` | Джим Хокинс / Jim Hawkins | Treasure Island | Robert Louis Stevenson | 9-14 | `CLASSIC_PD_CANDIDATE_AUDIT` | `blocked-until-evidence` | Violence sensitivity review. |
| ADVENTURE_CLASSIC | 1 | `long_john_silver` | Долговязый Джон Сильвер / Long John Silver | Treasure Island | Robert Louis Stevenson | 10-15 | `CLASSIC_PD_CANDIDATE_AUDIT` | `blocked-until-evidence` | No glamorization of violence. |
| ADVENTURE_CLASSIC | 1 | `phileas_fogg` | Филеас Фогг / Phileas Fogg | Around the World in Eighty Days | Jules Verne | 9-15 | `CLASSIC_PD_CANDIDATE_AUDIT` | `blocked-until-evidence` | Historical stereotypes reviewed. |
| ADVENTURE_CLASSIC | 1 | `passepartout` | Паспарту / Passepartout | Around the World in Eighty Days | Jules Verne | 9-15 | `CLASSIC_PD_CANDIDATE_AUDIT` | `blocked-until-evidence` | Historical context review. |
| ADVENTURE_CLASSIC | 2 | `munchausen` | Барон Мюнхгаузен / Baron Munchausen | Narrative traditions / Raspe | Rudolf Erich Raspe and tradition | 8-14 | `SOURCE_VERSION_AUDIT` | `blocked-until-evidence` | Select exact source/translation. |
| ADVENTURE_CLASSIC | 2 | `gulliver` | Гулливер / Lemuel Gulliver | Gulliver’s Travels | Jonathan Swift | 10-16 | `CLASSIC_PD_CANDIDATE_AUDIT` | `blocked-until-evidence` | Use child-approved episodes only. |
| ADVENTURE_CLASSIC | 2 | `robinson_crusoe` | Робинзон Крузо / Robinson Crusoe | Robinson Crusoe | Daniel Defoe | 10-16 | `CLASSIC_PD_CANDIDATE_AUDIT` | `blocked-until-evidence` | Historical/colonial context review. |
| FOREIGN_CLASSIC | 1 | `nils_holgersson` | Нильс Хольгерссон / Nils Holgersson | The Wonderful Adventures of Nils | Selma Lagerlöf | 7-13 | `CLASSIC_PD_TERRITORY_AUDIT` | `blocked-until-evidence` | Translation/illustration review. |
| FOREIGN_CLASSIC | 2 | `anne_shirley` | Энн Ширли / Anne Shirley | Anne of Green Gables | L. M. Montgomery | 9-15 | `CLASSIC_PD_TERRITORY_TRADEMARK_AUDIT` | `blocked-until-evidence` | Territory/trademark review. |
| FOREIGN_CLASSIC | 2 | `black_beauty` | Чёрный Красавчик / Black Beauty | Black Beauty | Anna Sewell | 8-14 | `CLASSIC_PD_CANDIDATE_AUDIT` | `blocked-until-evidence` | Animal welfare sensitivity. |
| FOREIGN_CLASSIC | 2 | `secret_garden_cast` | Герои «Таинственного сада» | The Secret Garden | Frances Hodgson Burnett | 9-14 | `CLASSIC_PD_TERRITORY_AUDIT` | `blocked-until-evidence` | Original art. |
| FOREIGN_SPECIAL | 1 | `peter_rabbit` | Питер Кролик / Peter Rabbit | The Tale of Peter Rabbit | Beatrix Potter | 4-9 | `SPECIAL_TRADEMARK_EDITION_REVIEW` | `blocked` | Не использовать современные licensed illustrations без clearance. |
| FOREIGN_SPECIAL | 1 | `peter_pan_world` | Питер Пэн, Венди и Динь-Динь / Peter Pan, Wendy, Tinker Bell | Peter Pan works | J. M. Barrie | 7-13 | `SPECIAL_STATUTORY_TRADEMARK_REVIEW` | `blocked` | Особый rights review; no Disney. |
| FOREIGN_LICENSED_PRIORITY | 1 | `winnie_pooh_world` | Винни-Пух и друзья / Winnie-the-Pooh | Winnie-the-Pooh works | A. A. Milne / translators / rights holders | 4-10 | `COMPLEX_TERRITORY_VERSION_LICENSE` | `blocked` | Проверять страну, edition, translation, character elements and visual design; no Disney by default. |
| FOREIGN_LICENSED_PRIORITY | 1 | `little_prince_world` | Маленький принц / The Little Prince | Le Petit Prince | Antoine de Saint-Exupéry | 7-15 | `COMPLEX_TERRITORY_LICENSE_REVIEW` | `blocked` | Text, illustrations, trademarks and territory review. |
| FOREIGN_LICENSED_PRIORITY | 1 | `moomin_world` | Муми-тролли / Moomins | Moomin books | Tove Jansson / rights holders | 5-12 | `LICENSE_REQUIRED` | `blocked` | Licensor-supplied assets only. |
| FOREIGN_LICENSED_PRIORITY | 1 | `pippi_world` | Пеппи Длинныйчулок / Pippi Longstocking | Pippi books | Astrid Lindgren / rights holders | 6-12 | `LICENSE_REQUIRED` | `blocked` | License required. |
| FOREIGN_LICENSED_PRIORITY | 1 | `karlsson_world` | Малыш и Карлсон / Karlsson-on-the-Roof | Karlsson books | Astrid Lindgren / rights holders | 6-12 | `LICENSE_REQUIRED` | `blocked` | License required; Russian translation rights separately. |
| FOREIGN_LICENSED_PRIORITY | 1 | `paddington_world` | Медвежонок Паддингтон / Paddington Bear | Paddington books | Michael Bond / rights holders | 5-11 | `LICENSE_REQUIRED` | `blocked` | License/trademark required. |
| FOREIGN_LICENSED_PRIORITY | 1 | `harry_potter_world` | Гарри Поттер и герои мира / Harry Potter | Harry Potter series | J. K. Rowling / rights holders | 9-17 | `LICENSE_REQUIRED` | `blocked` | No production assets or marketing without license. |
| FOREIGN_LICENSED_PRIORITY | 1 | `narnia_world` | Герои Нарнии / The Chronicles of Narnia | The Chronicles of Narnia | C. S. Lewis / rights holders | 8-16 | `LICENSE_REQUIRED` | `blocked` | License required; adaptation designs separate. |
| FOREIGN_LICENSED_PRIORITY | 2 | `roald_dahl_world` | Матильда, Вилли Вонка и другие герои | Works by Roald Dahl | Roald Dahl / rights holders | 7-14 | `LICENSE_REQUIRED` | `blocked` | Character-by-character license and age review. |
| FOREIGN_LICENSED_PRIORITY | 2 | `gruffalo_world` | Груффало / The Gruffalo | The Gruffalo | Julia Donaldson / Axel Scheffler / rights holders | 3-8 | `LICENSE_REQUIRED` | `blocked` | Text and illustration rights. |
| FOREIGN_LICENSED_PRIORITY | 2 | `percy_jackson_world` | Перси Джексон и герои мира / Percy Jackson | Percy Jackson series | Rick Riordan / rights holders | 10-17 | `LICENSE_REQUIRED` | `blocked` | License required. |
| FOREIGN_LICENSED_PRIORITY | 2 | `wimpy_kid_world` | Герои «Дневника слабака» / Diary of a Wimpy Kid | Diary of a Wimpy Kid | Jeff Kinney / rights holders | 9-15 | `LICENSE_REQUIRED` | `blocked` | License required. |
| FOREIGN_LICENSED_PRIORITY | 2 | `dr_seuss_world` | Персонажи Доктора Сьюза / Dr. Seuss characters | Dr. Seuss works | Dr. Seuss Enterprises / rights holders | 4-10 | `LICENSE_REQUIRED` | `blocked` | License required. |
| FOREIGN_LICENSED_PRIORITY | 2 | `curious_george_world` | Любопытный Джордж / Curious George | Curious George books | H. A. Rey / Margret Rey / rights holders | 3-8 | `LICENSE_REQUIRED_OR_TERRITORY_REVIEW` | `blocked` | Rights/trademark review. |
| FOREIGN_LICENSED_PRIORITY | 2 | `frog_toad_world` | Лягушонок и Жаб / Frog and Toad | Frog and Toad books | Arnold Lobel / rights holders | 4-9 | `LICENSE_REQUIRED` | `blocked` | License required. |
| FOREIGN_LICENSED_PRIORITY | 2 | `hungry_caterpillar_world` | Очень голодная гусеница / The Very Hungry Caterpillar | The Very Hungry Caterpillar | Eric Carle / rights holders | 3-7 | `LICENSE_REQUIRED` | `blocked` | Illustration and trademark rights. |

## Обязательное правило публикации

Персонаж попадает в production только при одновременном наличии active rights record, разрешённой территории и платформы, утверждённого ассета, возраста, редакционной карточки, source/provenance и checksum. Candidate list не заменяет такую проверку.

## Визуальные ограничения

- Для классических и фольклорных героев создаётся собственная интерпретация по литературному источнику.
- Нельзя копировать Disney, Союзмультфильм, MGM, современные издательские иллюстрации, игры, игрушки или чужие 3D-модели.
- Нельзя создавать AI-lookalike или клонировать голоса.
- При отсутствии clearance герой отсутствует в production, preview, store и маркетинговых снимках.
