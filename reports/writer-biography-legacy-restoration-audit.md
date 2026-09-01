# Аудит возврата русских биографий писателей

Сформирован: 2026-09-01T13:44:15.015Z

> Этот отчёт не утверждает, что 1684 публичные карточки фактологически проверены. Автоматический аудит классифицирует риски и provenance; истинность каждого утверждения проверяется только в редакционном workflow.

## Точный остаток

- Карточек: 1684; уникальных `countryId:writerId`: 1684; уникальных `writerId`: 1671.
- Текущий строгий RU-gate проходит 1684; скрыто 0.
- EN-gate проходит 20. Русский legacy-текст не используется как английский fallback.
- Legacy `bio` физически хранится у 1684 карточек.
- Автоматический screen допускает к публичному отображению 0 legacy-текстов, но сам по себе не проверяет их факты и происхождение; явных служебных/шаблонных текстов среди оставшихся публичных карточек: 0.
- Всего RU-текст отображается у 1684 карточек: 1684 gate-passing + 0 legacy. Публичный интерфейс не показывает для legacy маркер статуса.
- Исправлено 55 служебных биографий реальных авторов; 97 сомнительные/дублирующие карточки исключены из публичных массивов до подтверждения личности.
- Ещё 2 карточки с реальными авторами сохранены после исправления чужого ID, ложных дат и связанных полей по библиотечным/университетским источникам.
- Новых статусов `reviewed`/`verified` этот аудит не выставляет: 0.

## Почему нельзя сказать «все проверены»

- 0 из 0 legacy-текстов не имеют даже writer-level source candidate; у 0 такой кандидат есть, но он не является per-text provenance.
- У всех 0 legacy-текстов не записаны способ создания и правовое происхождение. Это отсутствие доказательства в репозитории, а не вывод о нарушении.
- 0 текстов не достигают текущего норматива по длине или числу предложений.
- 0 текст - служебный/шаблонный; 0 содержат редакционные фразы вместо биографии.
- 0 содержат суперлативы вроде «крупнейший» или «один из ведущих», которые требуют отдельного источника или нейтральной переписи.
- Дословные повторы: 0 карточек в 0 группах. Повторяющиеся ID: 26 карточки в 13 группах.
- У 0 карточек есть внутренний общий статус reviewed/verified, хотя сама биография не проходит gate. Этот статус не переносится на legacy-текст и не показывается рядом с описанием.
- 0 legacy-текстов заявляют Нобелевскую премию без структурированного `nobelYear`; это очередь сверки metadata, а не доказанная фактическая ошибка.

## Что реализовано безопасно

`src/data/writerBiographyDisplay.ts` добавляет отдельный display-selector. Он не меняет `selectWriterBiography` и не присваивает legacy-тексту редакционный статус.

Selector подключён к публичным `WriterPanel` и `WriterProfile`.

- Gate-passing биография остаётся `published` со своими sources/status.
- Русский legacy получает только внутреннюю QA-классификацию; публично выводится сам текст без маркера статуса.
- В результате явно записано: fact check - `not-recorded`, provenance - `not-recorded`, rights - `not-recorded`.
- После 55 точечных замен и карантина 97 identity-risk карточек публичных generic/service placeholder осталось 0.
- Английского fallback нет.

> Публичный интерфейс не сообщает статус legacy-текста. Это не делает текст проверенным: общий статус карточки автора не используется как доказательство статуса биографии, а строгий gate остаётся неизменным.

## Контрольная ручная сверка методики

Проверены только отдельные поля двух записей, а не весь корпус: сведения о Редьярде Киплинге сопоставлены с [официальной страницей Nobel Prize Outreach](https://www.nobelprize.org/prizes/literature/1907/kipling/facts/), а сведения о театральной карьере Шекспира - со [страницей Folger Shakespeare Library](https://www.folger.edu/explore/shakespeares-life/). Для Киплинга выбранные поля согласуются с источником. Шекспировская legacy-биография автоматически не promoted: writer-level источник не заменяет per-text provenance и запись способа создания текста.

> Эта выборка из двух записей подтверждает пригодность процесса, но не является проверкой остальных 1682 карточек и не доказывает каждое предложение в двух выбранных текстах.

## Точечные исправления служебных биографий

Для 55 реальных авторов прежняя служебная фраза заменена двумя короткими русскими предложениями. Проверены личность и связь с названным произведением по записанному источнику; это не означает полного независимого fact-check всей жизни автора и не выставляет статус reviewed/verified.

- `australia:gregory_david_roberts` - Грегори Дэвид Робертс - писатель, композитор и художник. Его наиболее известный роман - «Шантарам». Источник: [Hachette UK](https://www.hachette.co.uk/contributor/gregory-david-roberts/).
- `australia:terry_hayes` - Терри Хейс - писатель, сценарист и продюсер. Он написал шпионский роман «Я - Пилигрим». Источник: [Simon & Schuster](https://www.simonandschuster.com/authors/Terry-Hayes/15705144).
- `cyprus:alex_michaelides` - Алекс Михаэлидес - писатель и сценарист. Его дебютный роман - психологический триллер «Безмолвный пациент». Источник: [Library of Congress](https://www.loc.gov/events/2021-national-book-festival/authors/item/n2018066440/alex-michaelides/).
- `dominican_republic:junot_diaz` - Джуно Диас - американский писатель доминиканского происхождения. Роман «Краткая фантастическая жизнь Оскара Вао» принёс ему Пулитцеровскую премию за художественную книгу. Источник: [The Pulitzer Prizes](https://www.pulitzer.org/winners/junot-diaz).
- `england:rafael_sabatini` - Рафаэль Сабатини - писатель итальянского происхождения, создававший историко-приключенческую прозу на английском языке. К его романам относятся «Одиссея капитана Блада» и «Морской ястреб». Источник: [Rafael Sabatini Society](https://www.rafaelsabatini.com/rsbio.html).
- `england:celia_rees` - Селия Рис - британская писательница, автор книг для подростков. Среди её исторических романов - «Пираты». Источник: [Celia Rees](https://www.celiarees.com/about).
- `england:ronald_delderfield` - Рональд Делдерфилд - английский писатель и драматург. Он написал роман «Приключения Бена Ганна», продолжающий историю персонажа «Острова сокровищ». Источник: [Penguin Books](https://www.penguin.co.uk/authors/311033/rf-delderfield).
- `england:ian_mcewan` - Иэн Макьюэн - британский писатель и сценарист. Один из его наиболее известных романов - «Искупление». Источник: [Ian McEwan](https://www.ianmcewan.com/books/atonement.html).
- `england:hilary_mantel` - Хилари Мантел - британская писательница и литературный критик. Её исторический роман «Волчий зал» удостоен Букеровской премии. Источник: [The Booker Prizes](https://thebookerprizes.com/the-booker-library/authors/hilary-mantel).
- `england:joanne_harris` - Джоанн Харрис - британская писательница, работающая в разных жанрах. Она написала роман «Пять четвертинок апельсина». Источник: [Joanne Harris](https://www.joanne-harris.co.uk/about/).
- `england:anthony_burgess` - Энтони Бёрджесс - английский писатель и композитор. Его самый известный роман - антиутопия «Заводной апельсин». Источник: [International Anthony Burgess Foundation](https://www.anthonyburgess.org/about-anthony-burgess/).
- `england:paula_hawkins` - Пола Хокинс - британская писательница, автор психологических триллеров. Широкую известность ей принёс роман «Девушка в поезде». Источник: [Bloomsbury](https://www.bloomsbury.com/uk/author/paula-hawkins/).
- `england:john_marrs` - Джон Маррс - британский писатель, автор психологических триллеров и научно-фантастической прозы. Он написал роман «Пассажиры». Источник: [John Marrs](https://www.johnmarrsauthor.com/about).
- `england:stuart_turton` - Стюарт Тёртон - британский писатель и журналист. Среди его романов - «Семь смертей Эвелины Хардкасл» и «Дьявол и тёмная вода». Источник: [Stuart Turton](https://www.stuturton.com/about).
- `england:diane_setterfield` - Диана Сеттерфилд - британская писательница. Её дебютный роман «Тринадцатая сказка» обращается к традиции готической прозы. Источник: [Diane Setterfield](https://www.dianesetterfield.com/bio/).
- `england:liz_jensen` - Лиз Дженсен - британская писательница и автор сценариев. Она написала роман «Девятая жизнь Луи Дракса». Источник: [Liz Jensen](https://www.lizjensen.com/test/about-liz/).
- `england:agatha_christie` - Агата Кристи - английская писательница и драматург, прославившаяся детективной прозой. К её романам относится «И никого не стало». Источник: [Agatha Christie Limited](https://www.agathachristie.com/about-christie).
- `england:lee_child` - Ли Чайлд - британский писатель, автор серии романов о Джеке Ричере. «Этаж смерти» стал первой книгой этого цикла. Источник: [Macmillan](https://us.macmillan.com/author/leechild).
- `england:frederick_forsyth` - Фредерик Форсайт - британский писатель и журналист, известный политическими триллерами. Его дебютный роман - «День Шакала». Источник: [Frederick Forsyth](https://www.freddieforsyth.com/).
- `england:john_fowles` - Джон Фаулз - английский писатель. Международное признание ему принёс первый опубликованный роман «Коллекционер». Источник: [Penguin Books](https://www.penguin.co.uk/books/355032/the-collector-by-john-fowles/9780099470472).
- `england:alex_garland` - Алекс Гарленд - британский писатель, сценарист и режиссёр. Его дебютный роман - «Пляж». Источник: [Penguin Random House](https://www.penguinrandomhouse.com/authors/227370/alex-garland/).
- `england:john_le_carre` - Джон ле Карре - литературный псевдоним британского писателя Дэвида Корнуэлла, автора шпионских романов. Среди его книг - «Маленькая барабанщица». Источник: [John le Carré](https://johnlecarre.com/biography/).
- `france:franck_thilliez` - Франк Тилье - французский писатель, автор детективов и триллеров. Он написал роман «Головокружение». Источник: [Bibliothèque nationale de France](https://www.bnf.fr/fr/mediatheque/franck-thilliez).
- `italy:emilio_salgari` - Эмилио Сальгари - итальянский писатель, автор приключенческой прозы. К его книгам относится роман «Чёрный корсар». Источник: [Treccani](https://www.treccani.it/enciclopedia/emilio-salgari/).
- `russia:robert_shtilmark` - Роберт Александрович Штильмарк - советский писатель и журналист. Он написал историко-приключенческий роман «Наследник из Калькутты». Источник: [Национальная электронная библиотека](https://rusneb.ru/catalog/000199_000009_003329369/).
- `russia:sergey_lukyanenko` - Сергей Лукьяненко - российский писатель-фантаст. Роман «Лабиринт отражений» положил начало одноимённой трилогии о виртуальной реальности. Источник: [Сергей Лукьяненко](https://lukianenko.ru/biography/).
- `sweden:stieg_larsson` - Стиг Ларссон - шведский писатель и журналист. Он создал трилогию «Миллениум», открывающуюся романом «Девушка с татуировкой дракона». Источник: [Norstedts Agency](https://www.norstedtsagency.se/authors/stieg-larsson/).
- `sweden:lars_kepler` - Ларс Кеплер - общий псевдоним шведских писателей Александры Коэльо Андориль и Александра Андориля. Их первый совместный роман - «Гипнотизёр». Источник: [Lars Kepler](https://larskepler.com/about/).
- `usa:tim_powers` - Тим Пауэрс - американский писатель, работающий в жанрах фантастики и фэнтези. Он написал роман «На странных волнах». Источник: [Penguin Random House](https://www.penguinrandomhouse.com/authors/24419/tim-powers/).
- `usa:howard_pyle` - Говард Пайл - американский художник, иллюстратор и писатель. В «Книге пиратов» собраны его рассказы и иллюстрации о морских разбойниках. Источник: [Delaware Art Museum](https://emuseum.delart.org/people/75/howard-pyle).
- `usa:donna_tartt` - Донна Тартт - американская писательница. Её роман «Щегол» удостоен Пулитцеровской премии за художественную книгу. Источник: [The Pulitzer Prizes](https://www.pulitzer.org/winners/donna-tartt).
- `usa:george_saunders` - Джордж Сондерс - американский писатель и эссеист. Его первый роман «Линкольн в бардо» получил Букеровскую премию. Источник: [The Booker Prizes](https://thebookerprizes.com/the-booker-library/books/lincoln-in-the-bardo).
- `usa:min_jin_lee` - Мин Джин Ли - американская писательница корейского происхождения. Она написала семейную сагу «Патинко», изданную по-русски как «Дорога в тысячу ли». Источник: [Min Jin Lee](https://www.minjinlee.com/about).
- `usa:dan_brown` - Дэн Браун - американский писатель, автор интеллектуальных триллеров. Международную известность ему принёс роман «Код да Винчи». Источник: [Dan Brown](https://danbrown.com/about/).
- `usa:andy_weir` - Энди Вейр - американский писатель-фантаст. Его дебютный роман «Марсианин» сначала публиковался по частям в интернете. Источник: [Andy Weir](https://andyweirauthor.com/).
- `usa:suzanne_collins` - Сьюзен Коллинз - американская писательница и сценарист. Она создала цикл антиутопических романов «Голодные игры». Источник: [Scholastic](https://www.scholastic.com/teachers/teaching-tools/articles/authors/suzanne-collins.html).
- `usa:gillian_flynn` - Гиллиан Флинн - американская писательница и сценарист. Она написала психологический триллер «Исчезнувшая». Источник: [Penguin Random House](https://www.penguinrandomhouse.com/authors/2191849/gillian-flynn/).
- `usa:dennis_lehane` - Деннис Лихэйн - американский писатель и сценарист, автор криминальной прозы. Среди его романов - «Остров проклятых». Источник: [Dennis Lehane](https://dennislehane.com/about-dennis/).
- `usa:thomas_harris` - Томас Харрис - американский писатель, автор триллеров. Его роман «Молчание ягнят» продолжает цикл о Ганнибале Лектере. Источник: [Simon & Schuster](https://www.simonandschuster.com/authors/thomas-harris/1451219).
- `usa:patricia_highsmith` - Патриция Хайсмит - американская писательница, известная психологической криминальной прозой. Она создала персонажа Тома Рипли в романе «Талантливый мистер Рипли». Источник: [Penguin Random House](https://www.penguinrandomhouse.com/authors/12941/patricia-highsmith/).
- `usa:blaine_harden` - Блейн Харден - американский журналист и автор документальных книг. Он написал книгу «Побег из лагеря 14» о северокорейском перебежчике Син Дон Хёке. Источник: [Pan Macmillan](https://www.panmacmillan.com/authors/blaine-harden/escape-from-camp-14/9780330519540).
- `usa:ransom_riggs` - Рэнсом Риггз - американский писатель и режиссёр. Он создал цикл, начавшийся романом «Дом странных детей мисс Перегрин». Источник: [Ransom Riggs](https://www.ransomriggs.com/about).
- `usa:blake_crouch` - Блейк Крауч - американский писатель и сценарист. Он написал научно-фантастический триллер «Тёмная материя». Источник: [Blake Crouch](https://blakecrouch.com/blake/).
- `usa:ernest_cline` - Эрнест Клайн - американский писатель и сценарист. Его дебютный роман - «Первому игроку приготовиться». Источник: [Penguin Random House](https://www.penguinrandomhouse.com/authors/130867/ernest-cline/).
- `usa:james_rollins` - Джеймс Роллинс - литературный псевдоним американского писателя Джеймса Чайковски, автора приключенческих триллеров. Среди его книг - роман «Царство костей». Источник: [James Rollins](https://jamesrollins.com/bio/).
- `usa:n_k_jemisin` - Нора Кейт Джемисин - американская писательница-фантаст. Роман «Пятое время года» открывает её трилогию «Расколотая Земля». Источник: [N. K. Jemisin](https://nkjemisin.com/writing/the-fifth-season/).
- `usa:robert_ludlum` - Роберт Ладлэм - американский писатель, автор шпионских триллеров. Роман «Идентификация Борна» положил начало циклу о Джейсоне Борне. Источник: [Macmillan](https://us.macmillan.com/author/robertludlum/).
- `usa:dan_simmons` - Дэн Симмонс - американский писатель, работающий в жанрах фантастики, фэнтези и хоррора. Он написал исторический роман «Террор». Источник: [Hachette Book Group](https://www.hachettebookgroup.com/contributor/dan-simmons/?lens=hachette-books).
- `usa:daniel_keyes` - Дэниел Киз - американский писатель. Он написал документальный роман «Множественные умы Билли Миллигана», известный в русском переводе как «Таинственная история Билли Миллигана». Источник: [Daniel Keyes](https://www.danielkeyesauthor.com/dksbio.html).
- `usa:mark_danielewski` - Марк Данилевский - американский писатель, экспериментирующий с композицией и оформлением текста. Его дебютный роман - «Дом листьев». Источник: [Mark Z. Danielewski](https://www.markzdanielewski.com/about).
- `usa:douglas_preston_lincoln_child` - Дуглас Престон и Линкольн Чайлд - американские писатели и многолетние соавторы. Их первый совместный роман - «Реликт». Источник: [Preston & Child](https://www.prestonchild.com/).
- `usa:dean_koontz` - Дин Кунц - американский писатель, автор триллеров, фантастики и хоррора. Среди его романов - «Ложная память». Источник: [Dean Koontz](https://www.deankoontz.com/about/about-dean/).
- `usa:michael_connelly` - Майкл Коннелли - американский писатель и журналист, автор криминальных романов. «Пятый свидетель» входит в цикл об адвокате Микки Холлере. Источник: [Michael Connelly](https://www.michaelconnelly.com/writing/thefifthwitness/).
- `usa:john_irving` - Джон Ирвинг - американский писатель и сценарист. Он написал роман «Правила виноделов». Источник: [John Irving](https://john-irving.com/the-cider-house-rules/).
- `usa:tom_clancy` - Том Клэнси - американский писатель, известный военно-политическими триллерами. Его дебютный роман - «Охота за „Красным Октябрём“». Источник: [Tom Clancy](https://tomclancy.com/).

## Исправления личности и метаданных

- `chile:carmen_martin_gaite_chile_relation` → `chile:marta_brunet` - Марта Брунет - чилийская писательница, создавшая в прозе выразительный мир юга Чили и его сельских сообществ. Её первый роман «Montaña adentro» вышел в 1923 году; позднее она также служила культурным представителем Чили за рубежом. Источники: [Memoria Chilena - Biblioteca Nacional de Chile](https://www.memoriachilena.gob.cl/602/w3-article-3600.html), [Universidad de Chile](https://portaluchile.uchile.cl/extension-y-cultura/vicerrectoria-de-extension-y-comunicaciones/martabrunet/biografia).
- `japan:yasunari_kawabata_additional` → `japan:kataoka_teppei` - Катаока Тэппэй - японский писатель, один из участников круга журнала «Бунгэй дзидай» и движения синканкаку-ха. Позднее он обращался к пролетарской, а затем к массовой литературе. Источники: [Shinjuku City Library](https://www.library.shinjuku.tokyo.jp/database/jinbutuyukari/020/post97.html), [Aozora Bunko](https://www.aozora.gr.jp/index_pages/person491.html).

## Карантин сомнительных личностей

Из публичной базы временно исключены 97 записи с неверным/дублирующим ID, явной межстрановой служебной связью или без подтверждённого соответствия личности и произведения. Исходные файлы стран не удалены: записи можно вернуть после документированной сверки.

- `portugal:augusto_abreu` - No authoritative catalog establishes the claimed Portuguese poet and essayist Augusto Abreu with the 1927-2011 dates or attributable bibliography.
- `qatar:ahmad_al_mahmoud` - No authoritative source establishes the claimed male Qatari writer and poet born in 1957; the card risks conflating several different people with similar names.
- `qatar:jamal_fayiz_al_maliki` - Authoritative Qatari sources identify prose writer Jamal Fayiz Khamis Al-Saeed, born in 1964, not the claimed poet Jamal Fayiz Al-Maliky born in 1953; any remap must be explicit.
- `eritrea:hadish_haile` - No institutional authority record or attributable bibliography establishes the claimed Eritrean writer.
- `eritrea:khaled_abdalla` - No institutional catalog establishes the claimed Eritrean literary identity; the name must not be conflated with unrelated people.
- `eritrea:rebkah_haile` - No institutional authority match establishes this card; it must not be conflated with Ethiopian-American memoirist Rebecca G. Haile.
- `eswatini:albert_ncube` - No institutional catalog establishes the claimed Eswatini writer and literary role.
- `eswatini:gladys_lobola` - No institutional catalog establishes the claimed Eswatini author or bibliography.
- `eswatini:sarah_mlotshwa` - No institutional catalog establishes the claimed Eswatini writer or the works and themes attributed to the card.
- `eswatini:stanley_madwe` - No institutional catalog establishes the claimed Eswatini poet or literary role.
- `ethiopia:hirut_kefele` - No institutional authority match establishes the claimed Ethiopian writer, year and literary role.
- `eritrea:sebhat_gebregziabher` - The card conflates Ethiopian writer Sibhat Gebre-Egziabher with Eritrean general and politician Sebhat Ephrem; its name, dates, country, language and work do not establish one literary identity.
- `democratic_republic_of_congo:sylvain_bemba` - Sylvain Bemba was born in Sibiti and belongs to the Republic of the Congo corpus; a corrected public card is published there.
- `democratic_republic_of_congo:tshibumba_kanda_matulu` - Tshibumba Kanda-Matulu is a documented visual artist; History of Zaire is a painting cycle, not a literary work, so the record is not published as a writer.
- `djibouti:abdourahman_h_yama` - The key/fullName and displayed name conflict, and no institutional catalog establishes the claimed Djiboutian literary identity or bibliography.
- `comoros:mahmoud_said_ahmed` - No institutional authority record or attributable bibliography establishes the claimed Comorian writer; the card must not be conflated with similarly named artists, historians or writers.
- `comoros:said_ahmed_mohamed` - The authority identity is the Tanzanian Swahili writer Said Ahmed Mohamed Khamis, now published under Tanzania with corrected dates and birthplace.
- `cape_verde:virgilio_de_lemos` - The record belongs to the Mozambican poet Virgilio de Lemos; a corrected Mozambique card is published instead.
- `central_african_republic:benoit_ndemba` - No authoritative identity or bibliographic work match was established in the checked BnF and IdRef catalogs.
- `chad:felix_tchikaya` - The card likely conflates a supposed Chadian author with the Congolese poet Tchicaya U Tam'si; no separate authority identity was established.
- `burundi:jean_pierre_hatungimana` - No authoritative literary identity or bibliographic work match was established for this card; the unsupported 1963 birth year must not be published.
- `cameroon:emmanuel_dongala` - This is a duplicate of the Republic of the Congo writer Emmanuel Dongala and must not be published as a Cameroon record.
- `cameroon:etienne_goyemide` - This is a duplicate of the Central African Republic writer Etienne Goyemide and must not be published as a Cameroon record.
- `botswana:moshe_motshegwa` - No authoritative literary identity or bibliographic work match was established for this card.
- `brunei:awang_mohammad_yassin` - No authoritative literary identity or bibliographic work match was established for this card.
- `brunei:masuri_masrun` - No authoritative Bruneian literary identity was established; the name must not be conflated with Singaporean poet Masuri S. N.
- `burundi:christophe_nkezabahizi` - Authoritative sources identify a Burundian state-television cameraman, not the literary identity claimed by the card.
- `burundi:gaetan_muschimyimana` - No authoritative literary identity or bibliographic work match was established for this card.
- `bahamas:cyril_bray` - No authoritative catalog match establishes the claimed Bahamian literary identity; the record remains in the internal source archive only.
- `bahamas:wallace_whitfield` - No authoritative catalog match establishes the claimed Bahamian literary identity; available results mix the name with other people.
- `andorra:josep_fonbernat` - No authoritative source establishes the claimed contemporary Andorran author; the similarly named Josep Fontbernat i Verdaguer (1896-1977) is a different person.
- `antigua_and_barbuda:alison_hughes` - Institutional publisher biographies identify a Canadian children's writer from Edmonton, not the claimed Antiguan author and works.
- `argentina:adolfo_perez_zelas` - The id does not identify the displayed Adolfo Bioy Casares duplicate.
- `argentina:alfredo_bryce_echenique` - Peruvian writer duplicated in Argentina with an explicit non-inclusion note.
- `chile:paul_auster_chile_connection` - The id and displayed name disagree; the prose says the record is excluded.
- `uruguay:maria_ester_vazquez` - Argentine writer duplicated in Uruguay with an explicit non-inclusion note.
- `mexico:maria_fernanda_ampuero` - Ecuadorian writer duplicated in Mexico with an explicit non-inclusion note; the Ecuador card is retained.
- `peru:karina_sainz_borgo_peru_relation` - Venezuelan writer stored as an explicit non-inclusion relation in Peru.
- `peru:oscar_malpica` - No authoritative literary identity or work match is recorded.
- `uruguay:juan_jose_moron` - No authoritative literary identity or work match is recorded.
- `uruguay:maria_morena` - The id/name pair is inconsistent and no authoritative literary identity is recorded.
- `venezuela:krishna_viveros` - The id/name pair is inconsistent and no authoritative literary identity is recorded.
- `lesotho:leapo_motsapi` - The Russian and Latin names disagree; no authoritative identity is recorded.
- `macau:lo_i_cheng` - No authoritative literary identity or work match is recorded.
- `micronesia:peter_sigeo` - No authoritative literary identity or work match is recorded.
- `micronesia:marcel_mares` - The Russian and Latin names disagree; no authoritative identity is recorded.
- `papua_new_guinea:kati_thambe` - No authoritative literary identity or named work is recorded.
- `papua_new_guinea:raymond_gat` - The local authority mapping has no supporting life date or literary work in the card.
- `paraguay:susana_galeano` - No authoritative literary identity or named work is recorded.
- `paraguay:maida_victoria_melgar` - No authoritative literary identity or named work is recorded.
- `suriname:clarrisa_lispenard` - No authoritative literary identity or named work is recorded.
- `brunei:ali_haji_ahmad` - No unambiguous Bruneian literary identity is recorded.
- `brunei:haji_muhammad_jaafar` - No authoritative literary identity or named work is recorded.
- `cambodia:mae_khem` - No authoritative literary identity or named work is recorded.
- `cambodia:keo_na` - No authoritative literary identity or named work is recorded.
- `cambodia:kambo_vong` - No authoritative literary identity or named work is recorded.
- `laos:bountheng_thongsavanh` - No authoritative literary identity or named work is recorded.
- `laos:sotheara_soth` - No authoritative literary identity or named work is recorded.
- `laos:douangchandra_souphanouvong` - The Russian name conflicts with the Latin name/id and no authoritative literary identity is recorded.
- `timor_leste:jorge_barretto_xavier` - No authoritative literary identity or named work is recorded.
- `vanuatu:nicolas_tewes` - No authoritative literary identity or named work is recorded.
- `gabon:florentin_moussavou_nzigu` - The exact literary identity, Nzigu name component and attributed bibliography are not established; checked institutional sources instead document a Gabonese public official with a similar name.
- `gabon:juste_auguste_kotto` - No authoritative literary identity or attributable bibliography was established in the checked BnF and WorldCat catalogs.
- `gambia:baaba_jobarteh` - The card appears to conflate names from West African musical traditions; no authoritative literary identity or attributable bibliography was established.
- `grenada:julian_fedon` - Institutional sources identify the historical Julien Fédon who led the 1795-1796 rebellion, not the claimed twentieth-century Grenadian writer; no attributable modern literary identity or bibliography was established.
- `guinea_bissau:antonio_aurelio_gomes` - No authoritative identity record or attributable bibliography establishes the claimed Guinea-Bissauan writer; the card remains in the internal source archive only.
- `guyana:roshni_kempadoo` - The card conflates British-Guyanese visual artist Roshini Kempadoo with Guyanese novelist Oonya Kempadoo; the attributed novels Buxton Spice and Tide Running belong to Oonya Kempadoo.
- `laos:visuth_phommasane` - No independent institutional authority record or attributable bibliography establishes the claimed Lao literary identity; the card remains in the internal source archive only.
- `lesotho:coleman_motsapi` - No authoritative identity record or attributable bibliography establishes the claimed Lesotho writer, dates or literary activity; the card remains in the internal source archive only.
- `lesotho:letuka_molati` - No authoritative identity record or attributable bibliography establishes the claimed Lesotho writer, birth year or literary activity; the card remains in the internal source archive only.
- `liberia:marvin_colley` - No authoritative identity record or attributable bibliography establishes the claimed Liberian writer; the card remains in the internal source archive only.
- `liberia:sylvester_williams` - No authoritative identity record establishes the claimed Liberian poet; the card must not be conflated with Henry Sylvester Williams or other namesakes.
- `liberia:varney_bangura` - No authoritative identity record or attributable bibliography establishes the claimed Liberian writer; country and identity may be conflated with unrelated namesakes.
- `liechtenstein:maria_von_burg` - No authoritative identity record or attributable bibliography establishes the claimed Liechtenstein writer and dates; the card must not be conflated with similarly named people.
- `macau:hou_chio_jan` - No authoritative catalog establishes the claimed Macanese literary identity, date or attributable bibliography.
- `macau:hou_jingming` - No authoritative catalog establishes the claimed Macanese literary identity; the name must not be conflated with unrelated people or Yao Jingming.
- `madagascar:elie_charles_abraham` - No authoritative identity record or attributable bibliography establishes the claimed Malagasy writer and the available secondary dates conflict.
- `madagascar:jean_francois_samlong` - Authoritative profiles identify Jean-François Samlong as a Réunion writer born in Sainte-Marie in 1949, not a Madagascar writer born in 1951.
- `madagascar:nirina_lua` - No authoritative identity record or attributable bibliography establishes the claimed Malagasy poet; the Russian and Latin names also conflict.
- `maldives:amin_jameel` - No authoritative identity record or attributable bibliography establishes the claimed Maldivian writer, exact dates or language scholarship.
- `mauritania:hamed_ould_hamdane` - No authoritative identity record or attributable bibliography establishes the claimed Mauritanian writer, 1957 birth year or literary activity.
- `monaco:jean_baptiste_barla` - Official French museum records identify Jean-Baptiste Barla (1817-1896) as a Nice-born botanist and mycologist, not the claimed Monaco writer.
- `namibia:gabi_stolz` - No unique national-library authority record or attributable work establishes Gabi Stolz as the claimed Namibia-linked German-language writer born in 1956.
- `namibia:gustav_frolich` - German authority records identify Gustav Frölich (1879-1940) as an agricultural scientist, not the claimed Namibia-linked writer; the source card also gives the wrong death year.
- `namibia:ndapewaoshali_shikongo` - A first-party site establishes a Namibian writer using the single name Ndapewoshali, but not the Shikongo surname, 1993 birth year or children's-book identity claimed by this card.
- `nauru:michael_francis` - The generic name, unsupported 1960 birth year and missing bibliography do not establish a unique Nauruan literary identity in the checked national and international library catalogs.
- `new_zealand:steven_baker` - The id and displayed name Steven Baker are conflated with Steven Roger Fischer: the attributed works belong to Fischer, while no authoritative source establishes a matching New Zealand writer named Steven Baker.
- `niger:ibrahim_adam` - No authoritative identity record or attributable bibliography establishes the claimed Nigerien writer, birth year, literary role or works.
- `oman:zahir_al_ghazali` - No authoritative identity record or attributable bibliography establishes the claimed Omani writer; the card must not be conflated with poet Zahir al-Ghafri.
- `panama:demetrio_kalleyas` - No authoritative identity record or attributable bibliography establishes the claimed Panamanian writer; the card must not be conflated with poet Demetrio Korsi.
- `papua_new_guinea:siri_gising` - No authoritative identity record or attributable bibliography establishes the claimed Papua New Guinean writer or the work attributed to the card.
- `saint_vincent_and_the_grenadines:michael_anthony` - Authoritative national-library and university sources identify Michael Anthony as a Trinidad and Tobago writer born in Mayaro, Trinidad; the card must not remain published under Saint Vincent and the Grenadines.
- `seychelles:gladyse_adele` - No authoritative library identity or attributable bibliography establishes the claimed Seychellois writer Gladyse Adele or the asserted 1951 birth year.
- `sierra_leone:augustine_bangura` - No authoritative library identity or attributable bibliography establishes the claimed Sierra Leonean writer and researcher Augustine Bangura or the asserted 1965 birth year.
- `south_korea:byun_hyung_jun` - No authoritative library identity or attributable bibliography establishes the claimed South Korean writer Byun Hyung-jun, the asserted 1962 birth year or the attributed Hwang Sun-won literary prize.
- `south_sudan:atuok_mayen` - No authoritative library identity or attributable bibliography establishes the claimed South Sudanese writer Atuok Mayen, the asserted 1970 birth year or a documented literary work.
- `spain:juan_ruiz` - Libro de buen amor is traditionally attributed to Juan Ruiz, Archpriest of Hita, but the checked institutional sources do not establish an independently documented identity or reliable life dates for the public profile.

## Реалистичный план

Начальная очередь - 0 уникальных legacy `writerId`, минимум 0 партий по 20. До подсчёта реальных людей нужно разрешить cross-country дубли и несовпадающие ID.

1. Разрешить каноническую личность, дубли и межстрановые связи.
2. Проверить по полям даты жизни, языки, национальный контекст и главные произведения.
3. Использовать две независимые authority-family, где это возможно; неопределённость фиксировать, а не угадывать.
4. Сохранить существующий авторский русский текст и вносить только доказуемые фактические и языковые исправления; полностью заменять лишь служебные placeholder-тексты.
5. Провести независимую факт-проверку, русскую вычитку и проверку provenance.
6. Продвинуть запись через неизменённый publication gate reviewed/verified.

Оценка: 0-0 человеко-часов, или 0-0 редакционных дней по 6 продуктивных часов. Команда из четырёх редакторов - ориентировочно 0-0 рабочих недель.

Авторитетные точки входа: [Library of Congress Name Authority](https://id.loc.gov/authorities/names.html), [VIAF/OCLC](https://viaf.org/), [BnF](https://catalogue.bnf.fr/), [Nobel Prize Outreach](https://www.nobelprize.org/prizes/literature/). Они используются по назначению: authority-запись подтверждает identity/имя/даты, но не заменяет источник литературной интерпретации.

Полные очереди и примеры находятся в JSON-версии отчёта.
