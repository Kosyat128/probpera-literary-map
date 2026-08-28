export const WRITER_BIOGRAPHY_FACT_REVIEW_BATCH06_REVIEWER =
  "Codex independent claim-by-claim factual review, batch 06";

export type WriterBiographyFactReviewDecision =
  | "unchanged"
  | "corrected"
  | "held";

export type WriterBiographyClaimVerdict =
  | "supported"
  | "corrected"
  | "not-established";

export interface WriterBiographyClaimEvidence {
  readonly provider: string;
  readonly url: string;
  readonly checkedAt: string;
  readonly findingRu: string;
}

export interface WriterBiographyFactReviewClaim {
  readonly textRu: string;
  readonly verdict: WriterBiographyClaimVerdict;
  readonly evidence: readonly WriterBiographyClaimEvidence[];
}

export interface WriterBiographyFactReviewRecord {
  readonly key: string;
  readonly originalSha256: string;
  readonly reviewedTextRu: string;
  readonly applicableTextRu: string | null;
  readonly claims: readonly WriterBiographyFactReviewClaim[];
  readonly reviewer: string;
  readonly decision: WriterBiographyFactReviewDecision;
  readonly notes: string;
}

const reviewer = WRITER_BIOGRAPHY_FACT_REVIEW_BATCH06_REVIEWER;
const checkedAt = "2026-08-09";

function evidence(
  provider: string,
  url: string,
  findingRu: string
): WriterBiographyClaimEvidence {
  return { provider, url, checkedAt, findingRu };
}

const writerBiographyFactReviewBatch06Base: readonly Omit<
  WriterBiographyFactReviewRecord,
  "applicableTextRu"
>[] = [
  {
    key: "brazil:paulo_coelho",
    originalSha256:
      "a1365c462dd37d09c7f031cca5320efc8d049b5c562589285aaab18a5ef4aebf",
    reviewedTextRu:
      "Бразильский писатель, член Бразильской академии литературы, автор романа «Алхимик».",
    claims: [
      {
        textRu:
          "Недоказанная сравнительная формула о читаемости заменена проверяемыми сведениями: Пауло Коэльо - бразильский писатель, член Бразильской академии литературы и автор романа «Алхимик».",
        verdict: "corrected",
        evidence: [
          evidence(
            "Бразильская академия литературы",
            "https://www.academia.org.br/academicos/paulo-coelho/biografia",
            "Официальная биография подтверждает рождение Коэльо в Рио-де-Жанейро 24 августа 1947 года, избрание в академию в 2002 году и публикацию романа O Alquimista в 1988 году."
          ),
          evidence(
            "Организация Объединённых Наций",
            "https://www.un.org/en/messengers-peace/paulo-coelho",
            "Профиль Посланника мира ООН называет Коэльо бразильским писателем и перечисляет The Alchemist среди его книг."
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Суперлатив «один из самых читаемых авторов мира» снят как не имеющий двух независимых институциональных подтверждений. Identity audit: Q12881 соответствует Пауло Коэльо; дата рождения 1947-08-24 согласуется с официальной биографией академии. Shared country files не изменялись.",
  },
  {
    key: "bulgaria:peyo_yavorov",
    originalSha256:
      "8cdff6925de68e23809f1a4e622ff32f4843ee0f5881949c2a7660ec236217f2",
    reviewedTextRu:
      "Болгарский поэт и драматург, один из основоположников символизма в болгарской поэзии.",
    claims: [
      {
        textRu:
          "Оценка «один из крупнейших» заменена документированной ролью Пейо Яворова как поэта, драматурга и одного из основоположников болгарского поэтического символизма.",
        verdict: "corrected",
        evidence: [
          evidence(
            "Болгарское национальное радио",
            "https://old-news.bnr.bg/ru/post/100188008/literaturne-stranic-peio-yavorov-osnovopolojnik-simvolizma-v-bolgarskoi-pozii?page_1_3=5",
            "Русскоязычный материал БНР прямо называет Яворова основоположником символизма в болгарской поэзии."
          ),
          evidence(
            "Институт литературы Болгарской академии наук",
            "https://ilit.bas.bg/bg/140-godini-ot-rozhdenieto-na-peio-k-yavorov",
            "Академический обзор подтверждает поэтические книги Яворова и две его пьесы, то есть поэтическую и драматургическую деятельность."
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Calendar-model queue: birthDate 1878-01-01 хранит дату по старому стилю. Архив БНР прямо указывает 1 января 1878 года (старый стиль), а БНР отмечает годовщину 13 января. Рекомендация для ISO-даты по григорианскому календарю - 1878-01-13; deathDate 1914-10-29 оставить. Shared country files не изменялись.",
  },
  {
    key: "bulgaria:yordan_yovkov",
    originalSha256:
      "79427e1b4d3c7828d220cf4f74a775f455a6b8df5c6ea1183068289f1e705dee",
    reviewedTextRu:
      "Болгарский писатель и драматург, автор восьми циклов рассказов, повестей, романов и трёх пьес.",
    claims: [
      {
        textRu:
          "Субъективная оценка масштаба заменена документированными жанрами и составом наследия Йордана Йовкова.",
        verdict: "corrected",
        evidence: [
          evidence(
            "Региональный исторический музей Добрича",
            "https://www.dobrichmuseum.bg/yordan-yovkov-pisatel/",
            "Музейный профиль называет Йовкова болгарским писателем и перечисляет восемь циклов рассказов, повести, романы и три драмы."
          ),
          evidence(
            "Муниципалитет Добрича",
            "https://www.dobrich.bg/en/museums/the-house-of-yordan-yovkov-and-yordan-yovkov-museum/",
            "Официальная страница дома-музея подтверждает его работу в прозе и особую связь с жанром рассказа."
          ),
          evidence(
            "Издательство Болгарской академии наук",
            "https://press.bas.bg/en/books-103/show-104%28569%29",
            "Академическое издательство представляет исследование жизни и творчества Йовкова как болгарского автора прозы и драматургии."
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Суперлатив снят; сохранены конкретные жанры и количественные сведения музейного профиля. Identity audit: Q527920 относится к Йордану Йовкову; годы 1880-1937 согласуются с институциональными источниками. Shared country files не изменялись.",
  },
  {
    key: "cambodia:kram_ngoy",
    originalSha256:
      "ae1cf2f973c82eaec6521ec98f04bb98242d2807af249d76f210fdddd1ee27a0",
    reviewedTextRu:
      "Камбоджийский поэт и музыкант, исполнявший стихи под аккомпанемент однострунного инструмента ксе-диев; его дидактическая поэма «Венок новых наставлений» была издана Буддийским институтом в Пномпене.",
    claims: [
      {
        textRu:
          "Сравнительная оценка заменена установленными сведениями о Краме (Кроме) Нгое: он был камбоджийским поэтом и музыкантом, выступал с ксе-диев, а его дидактическую поэму издал Буддийский институт.",
        verdict: "corrected",
        evidence: [
          evidence(
            "Cité internationale universitaire de Paris",
            "https://www.ciup.fr/en/chaises/prendre-position-maison-du-cambodge/",
            "Институциональная биография описывает Krom Ngoy (1865-1936) как кхмерского поэта и музыканта, мастера однострунного инструмента kse diev."
          ),
          evidence(
            "De Gruyter Brill / University of Hawaiʻi Press",
            "https://www.degruyterbrill.com/document/doi/10.1515/9780824896843-004/pdf?licenseType=free",
            "Академическое введение сообщает, что Буддийский институт опубликовал произведение Крома Нгоя A Garland of New Advice."
          ),
          evidence(
            "Out of the Shadows of Angkor",
            "https://www.outoftheshadowsofangkor.com/contributors",
            "Академический проект антологии University of Hawaiʻi Press включает Крома Нгоя в корпус классических камбоджийских авторов."
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Identity registry gap: публичный ключ использует романизацию Kram Ngoy, тогда как институциональные источники дают Krom Ngoy; годы 1865-1936 и литературно-музыкальная роль совпадают. Кандидат Q4929923 следует добавить только после отдельного registry review; Wikidata использовалась лишь как corroboration. Shared country files не изменялись.",
  },
  {
    key: "cambodia:rim_kin",
    originalSha256:
      "f653a3a70f04eaa96a9e90636c51dfd44d3eb0aa4f78b690176ae056eed2f06f",
    reviewedTextRu: "Один из основателей современного кхмерского романа.",
    claims: [
      {
        textRu:
          "Рим Кин обоснованно назван одним из основателей современного кхмерского романа.",
        verdict: "supported",
        evidence: [
          evidence(
            "Национальная библиотека Франции",
            "https://catalogue.bnf.fr/ark%3A/12148/cb12285967d",
            "Авторитетная запись подтверждает авторство романа Sūphāt, написанного в 1938 году и опубликованного в 1942 году, а также членство среди основателей Ассоциации кхмерских писателей."
          ),
          evidence(
            "Emory University",
            "https://etd.library.emory.edu/downloads/3j333346p?locale=en",
            "Академическое исследование рассматривает Sophat как ранний современный кхмерский прозаический роман и документирует роль Рима Кина в формировании современной литературной институции."
          ),
        ],
      },
    ],
    reviewer,
    decision: "unchanged",
    notes:
      "Structured triage queue: карточка хранит только годы 1911 и 1959. BnF даёт birthDate 1911-11-08 и deathDate 1959-01-27; рекомендация - обогатить даты этими значениями после отдельного review. Identity audit: Q4919402 соответствует Риму Кину. Shared country files не изменялись.",
  },
  {
    key: "cameroon:mongo_beti",
    originalSha256:
      "660c7ab02ac57e8ffbb7c8290c0a99926f4b90c22b649a77cce97a2a326a4fdb",
    reviewedTextRu:
      "Камерунский франкоязычный писатель и эссеист Александр Бийиди-Авала, публиковавшийся под именами Монго Бети и Эза Бото.",
    claims: [
      {
        textRu:
          "Суперлатив заменён установленной идентичностью: Александр Бийиди-Авала - камерунский франкоязычный писатель и эссеист, использовавший имена Монго Бети и Эза Бото.",
        verdict: "corrected",
        evidence: [
          evidence(
            "University of Western Australia / Mongo Beti archive",
            "https://mongobeti.arts.uwa.edu.au/mongobeti.htm",
            "Университетский архив приводит имя Alexandre Biyidi Awala, псевдонимы Eza Boto и Mongo Beti, биографию и библиографию писателя."
          ),
          evidence(
            "African Studies Centre Leiden",
            "https://www.ascleiden.nl/content/webdossiers/mongo-beti",
            "Академический веб-досье подтверждает камерунскую и франкоязычную литературную идентичность Монго Бети и его основные публикации."
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Identity audit: Q248047 соответствует Монго Бети. Дата смерти 2001-10-07 сохранена: её прямо приводит архив University of Western Australia и подтверждает мемориальный выпуск общества друзей писателя; распространённое вторичное 8 октября не использовалось. Shared country files не изменялись.",
  },
  {
    key: "canada:alice_munro",
    originalSha256:
      "4654f41aa935017b82b4d4d13f5b786768455f39776175bfd5f84ae04bc5a8b8",
    reviewedTextRu:
      "Канадская писательница, мастер современного рассказа. Лауреат Нобелевской премии по литературе 2013 года. Её прозу отличают глубокий психологизм и внимание к повседневной жизни.",
    claims: [
      {
        textRu:
          "Элис Манро - канадская писательница и мастер современного рассказа, лауреат Нобелевской премии по литературе 2013 года; её рассказы исследуют повседневную жизнь, отношения и нравственные конфликты.",
        verdict: "supported",
        evidence: [
          evidence(
            "Нобелевский фонд",
            "https://www.nobelprize.org/prizes/literature/2013/munro/facts/",
            "Официальная страница премии называет Манро канадской писательницей, фиксирует награду 2013 года и характеризует её как мастера современного рассказа; также отмечает повседневные события и отношения в её прозе."
          ),
          evidence(
            "Правительство Канады",
            "https://www.canada.ca/en/women-gender-equality/commemorations-celebrations/women-impact/arts/alice-munro.html",
            "Государственный профиль подтверждает её работу в жанре рассказа, Нобелевскую премию и внимание к эмоциональной сложности повседневной жизни."
          ),
        ],
      },
    ],
    reviewer,
    decision: "unchanged",
    notes:
      "Все смысловые элементы исходного текста имеют прямую институциональную опору. Identity audit: Q234819 соответствует Элис Манро; даты 1931-07-10 и 2024-05-13 согласуются с официальной страницей Нобелевского фонда. Shared country files не изменялись.",
  },
  {
    key: "canada:anne_carson",
    originalSha256:
      "aa8cb9c54a8368877c5d3f5996391677e24771afc8d12370987665a2bb38fcd8",
    reviewedTextRu:
      "Канадская поэтесса, эссеистка, переводчица и исследовательница античной литературы, лауреат премии Принцессы Астурийской 2020 года.",
    claims: [
      {
        textRu:
          "Недоказанная оценка оригинальности заменена проверяемыми ролями Энн Карсон и присуждением ей премии Принцессы Астурийской 2020 года.",
        verdict: "corrected",
        evidence: [
          evidence(
            "Фонд Принцессы Астурийской",
            "https://www.fpa.es/es/premios-princesa-de-asturias/premiados/2020-anne-carson/?texto=trayectoria",
            "Официальный профиль лауреата подтверждает канадскую принадлежность, работу в поэзии, эссеистике, переводе и классической филологии, а также премию 2020 года."
          ),
          evidence(
            "MacArthur Foundation",
            "https://www.macfound.org/fellows/class-of-2000/anne-carson",
            "Профиль фонда называет Карсон исследовательницей античности, поэтессой, эссеисткой, автором и переводчицей."
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Суперлатив «одна из самых оригинальных» снят; мужская форма «переводчик» заменена нормативной формой «переводчица». Identity audit: Q2633699 соответствует Энн Карсон; год рождения 1950 подтверждён институциональными профилями. Shared country files не изменялись.",
  },
  {
    key: "canada:lucy_maud_montgomery",
    originalSha256:
      "07f42a61ca592ade5f0d5c66528e3a03684d0e394485535fe600d934757e6dc6",
    reviewedTextRu:
      "Канадская писательница, автор романа «Энн из Зелёных крыш» (Anne of Green Gables) и его продолжений; всего опубликовала двадцать романов, а также сотни рассказов и стихотворений.",
    claims: [
      {
        textRu:
          "Оценка популярности заменена документированными сведениями: Люси Мод Монтгомери написала Anne of Green Gables, продолжения романа и в общей сложности двадцать романов, а также сотни рассказов и стихотворений.",
        verdict: "corrected",
        evidence: [
          evidence(
            "Parks Canada",
            "https://parks.canada.ca/lhn-nhs/pe/greengables/culture/montgomery",
            "Государственный исторический ресурс подтверждает публикацию Anne of Green Gables в 1908 году, продолжения и корпус из двадцати романов, сотен рассказов и стихотворений."
          ),
          evidence(
            "L. M. Montgomery Institute, University of Prince Edward Island",
            "https://lmmontgomery.ca/publications/",
            "Университетский институт перечисляет Anne of Green Gables и ещё девятнадцать романов, а также многочисленные рассказы и стихи."
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Суперлатив о популярности снят; сохранена связь с циклом об Энн и добавлен проверяемый объём публикаций. Identity audit: Q273034 соответствует Люси Мод Монтгомери; даты 1874-11-30 и 1942-04-24 подтверждаются Parks Canada. Shared country files не изменялись.",
  },
  {
    key: "canada:margaret_atwood",
    originalSha256:
      "fe685ff938331f848aa04800285a3c15ace8493d9afd71c4b58253d5b7dcfd16",
    reviewedTextRu:
      "Канадская писательница, поэтесса и литературный критик, дважды лауреат Букеровской премии - за романы «Слепой убийца» и «Заветы».",
    claims: [
      {
        textRu:
          "Сравнительная оценка и обобщённый перечень тем заменены проверяемыми ролями Маргарет Этвуд и двумя Букеровскими премиями - за The Blind Assassin и The Testaments.",
        verdict: "corrected",
        evidence: [
          evidence(
            "Правительство Канады",
            "https://www.canada.ca/en/women-gender-equality/commemorations-celebrations/women-impact/arts/margaret-atwood.html",
            "Государственный профиль подтверждает работу Этвуд как романистки, поэтессы, литературного критика и эссеистки."
          ),
          evidence(
            "The Booker Prizes",
            "https://thebookerprizes.com/the-booker-library/authors/margaret-atwood",
            "Официальный профиль премии фиксирует победы The Blind Assassin в 2000 году и The Testaments в 2019 году."
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Суперлатив «одна из крупнейших фигур» снят; широкая тематическая интерпретация заменена двумя конкретными наградами. Identity audit: Q183492 соответствует Маргарет Этвуд; дата рождения 1939-11-18 подтверждается государственным профилем. Shared country files не изменялись.",
  },
  {
    key: "canada:michael_ondaatje",
    originalSha256:
      "a540a02c68e4a2dd05c0daed511ace18d15b9596a3c1a6ba732e555fb575f2e7",
    reviewedTextRu:
      "Канадский писатель и поэт, родившийся на Шри-Ланке и живущий в Канаде с 1962 года. Его роман «Английский пациент» получил Букеровскую премию 1992 года.",
    claims: [
      {
        textRu:
          "Суперлатив снят, а расплывчатая хронология уточнена: Майкл Ондатже родился на Шри-Ланке, переехал в Канаду в 1962 году и является писателем и поэтом.",
        verdict: "corrected",
        evidence: [
          evidence(
            "Griffin Poetry Prize",
            "https://griffinpoetryprize.com/trustees/",
            "Профиль попечителя на сайте премии называет Ондатже романистом и поэтом, родившимся на Шри-Ланке и переехавшим в Канаду в 1962 году."
          ),
          evidence(
            "The Booker Prizes",
            "https://thebookerprizes.com/the-booker-library/authors/michael-ondaatje",
            "Официальный профиль подтверждает шри-ланкийское происхождение, канадскую жизнь и литературную деятельность Ондатже."
          ),
        ],
      },
      {
        textRu:
          "Роман «Английский пациент» получил Букеровскую премию 1992 года.",
        verdict: "supported",
        evidence: [
          evidence(
            "The Booker Prizes",
            "https://thebookerprizes.com/the-booker-library/authors/michael-ondaatje",
            "Профиль премии связывает The English Patient с победой в 1992 году."
          ),
          evidence(
            "Penguin Random House Canada",
            "https://www.penguinrandomhouse.ca/authors/22801/michael-ondaatje",
            "Издательская биография подтверждает авторство The English Patient и Букеровскую премию 1992 года."
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Формула «один из ведущих» удалена; «с 1960-х годов» уточнено до 1962 года. Identity audit: Q313593 соответствует Майклу Ондатже; дата рождения 1943-09-12 согласуется с профилями премии и издателя. Shared country files не изменялись.",
  },
  {
    key: "canada:mordecai_richler",
    originalSha256:
      "279ab7b7bce2c5b598785136703581cd7b1f1850cea95e887943724eb4ca1384",
    reviewedTextRu:
      "Канадский романист, эссеист, журналист и сценарист, родившийся в Монреале; автор романов «Ученичество Дадди Кравица» и «Версия Барни».",
    claims: [
      {
        textRu:
          "Сравнительная оценка и широкая тематическая формула заменены проверяемыми ролями Мордехая Рихлера, местом рождения и двумя романами.",
        verdict: "corrected",
        evidence: [
          evidence(
            "McGill University",
            "https://www.mcgill.ca/newsroom/node/14941",
            "Университетский профиль подтверждает монреальское происхождение и деятельность Рихлера как автора, эссеиста и сценариста."
          ),
          evidence(
            "Penguin Random House Canada",
            "https://www.penguinrandomhouse.ca/authors/25498/mordecai-richler",
            "Издательская биография фиксирует рождение в Монреале, журналистскую и писательскую работу и перечисляет The Apprenticeship of Duddy Kravitz и Barney's Version."
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Суперлатив «один из наиболее значительных» снят; тематическая интерпретация заменена конкретными жанрами и книгами. Identity audit: Q452282 соответствует Мордехаю Рихлеру; даты 1931-01-27 и 2001-07-03 подтверждаются издательским профилем. Shared country files не изменялись.",
  },
  {
    key: "canada:northrop_frye",
    originalSha256:
      "f14c3f71f19f9fd3cc9b5239dcff5cdc6f6e8ae514cef75602a44ea908d0e90e",
    reviewedTextRu:
      "Канадский литературовед и литературный критик, автор книг «Анатомия критики» (Anatomy of Criticism) и The Great Code.",
    claims: [
      {
        textRu:
          "Оценка влияния заменена проверяемыми сведениями: Нортроп Фрай был канадским литературоведом и критиком, автором Anatomy of Criticism и The Great Code.",
        verdict: "corrected",
        evidence: [
          evidence(
            "Parks Canada",
            "https://www.canada.ca/en/parks-canada/news/2018/12/northrop-frye1912-1991.html",
            "Официальная историческая справка называет Фрая литературным теоретиком и критиком и перечисляет Anatomy of Criticism и The Great Code."
          ),
          evidence(
            "E. J. Pratt Library, Victoria University in the University of Toronto",
            "https://library.vicu.utoronto.ca/exhibitions/nfrye100/biography.html",
            "Биографическая выставка библиотеки документирует академическую карьеру Фрая и обе книги в составе его библиографии."
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Суперлатив о влиянии и недоказанное обобщение о гуманитарных науках заменены конкретными трудами. Identity audit: Q354256 соответствует Нортропу Фраю; даты 1912-07-14 и 1991-01-23 согласуются с университетской биографией. Shared country files не изменялись.",
  },
  {
    key: "canada:robertson_davies",
    originalSha256:
      "ab726acac8b08a4aff0762f294a4f4f61ca3b00d6b3807e28abd0166e7a1c5c0",
    reviewedTextRu:
      "Канадский романист, драматург, журналист и профессор литературы, основатель и первый руководитель Мэсси-колледжа; автор одиннадцати романов.",
    claims: [
      {
        textRu:
          "Сравнительная и интерпретационная оценки заменены документированными занятиями Робертсона Дэвиса, его ролью в Мэсси-колледже и количеством романов.",
        verdict: "corrected",
        evidence: [
          evidence(
            "Thomas Fisher Rare Book Library, University of Toronto",
            "https://discoverarchives.library.utoronto.ca/index.php/davies-robertson-2",
            "Архивная биография перечисляет работу Дэвиса как романиста, драматурга, редактора, журналиста и преподавателя, сообщает об одиннадцати романах и руководстве Мэсси-колледжем."
          ),
          evidence(
            "Massey College",
            "https://masseycollege.ca/library/history-overview/",
            "Официальная история библиотеки называет Дэвиса канадским романистом и основателем - первым руководителем колледжа."
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Суперлатив и субъективная характеристика прозы сняты; сохранены конкретные профессиональные роли. Identity audit: Q545375 соответствует Робертсону Дэвису; даты 1913-08-28 и 1995-12-02 подтверждаются университетским архивом. Shared country files не изменялись.",
  },
  {
    key: "canada:rohinton_mistry",
    originalSha256:
      "8318e6a5aac88d10d11830053edcb3e79fbca68d6bc82a19056151ca517e54fc",
    reviewedTextRu:
      "Канадский писатель, родившийся в Бомбее и переехавший в Канаду в 1975 году. Все три его романа входили в шорт-лист Букеровской премии.",
    claims: [
      {
        textRu:
          "Сравнительная оценка и широкое тематическое обобщение заменены биографическим фактом и уникальным для автора результатом: все три романа Рохинтона Мистри были в шорт-листе Букеровской премии.",
        verdict: "corrected",
        evidence: [
          evidence(
            "University of Toronto Alumni",
            "https://alumni.utoronto.ca/news/featured-alumni/rohinton-mistry",
            "Университетский профиль подтверждает рождение Мистри в Бомбее в 1952 году, переезд в Канаду в 1975 году и включение всех его романов в шорт-лист Букеровской премии."
          ),
          evidence(
            "The Booker Prizes",
            "https://thebookerprizes.com/the-booker-library/authors/rohinton-mistry",
            "Официальный профиль премии сообщает, что Мистри приехал в Канаду в 1975 году и что все три его романа были номинированы в шорт-лист."
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Суперлатив снят; формула об «индийском происхождении» уточнена местом рождения и годом переезда. Identity audit: Q732338 соответствует Рохинтону Мистри; дата рождения 1952-07-03 согласуется с университетским профилем. Shared country files не изменялись.",
  },
  {
    key: "cape_verde:armenio_vieira",
    originalSha256:
      "bd3313099b3bfca1549b9300f683d81403377fcde2dd9704f8f103e5cc844857",
    reviewedTextRu:
      "Кабо-вердианский поэт, лауреат Премии Камоэнса 2009 года.",
    claims: [
      {
        textRu:
          "Армениу Виейра - кабо-вердианский поэт и лауреат Премии Камоэнса 2009 года.",
        verdict: "supported",
        evidence: [
          evidence(
            "Camões - Instituto da Cooperação e da Língua",
            "https://www.instituto-camoes.pt/sobre/comunicacao/noticias/italia-lancamento-da-edicao-italiana-no-inferno-de-armenio-vieira-premio-camoes-2009",
            "Официальная страница института называет Армениу Виейру кабо-вердианским автором 1941 года рождения и лауреатом Премии Камоэнса 2009 года."
          ),
          evidence(
            "Институт международного португальского языка (CPLP)",
            "https://iilp.cplp.org/2021/10/15/premio-camoes-armenio-vieira-homenageado-na-praia/",
            "Институциональная справка называет Виейру поэтом, журналистом и эссеистом и подтверждает Премию Камоэнса 2009 года."
          ),
        ],
      },
    ],
    reviewer,
    decision: "unchanged",
    notes:
      "Исходный краткий текст полностью подтверждён двумя институциональными источниками и не содержит суперлатива. Identity audit: Q2604164 соответствует Армениу Виейре; оба источника подтверждают год рождения 1941. Shared country files не изменялись.",
  },
  {
    key: "cape_verde:baltasar_lopes",
    originalSha256:
      "bc590b42f857e396e924f315437d98b175716b3721f4b43647b9e4e5aeecf2a8",
    reviewedTextRu:
      "Писатель, филолог и один из основателей литературного движения Claridade.",
    claims: [
      {
        textRu:
          "Балтазар Лопеш да Силва был кабо-вердианским писателем и филологом и входил в число основателей движения и журнала Claridade.",
        verdict: "supported",
        evidence: [
          evidence(
            "Национальная библиотека Португалии",
            "https://www.bnportugal.gov.pt/agenda/evento-lopes.html",
            "Библиотечная биография документирует литературную, преподавательскую и филологическую деятельность Балтазара Лопеша и его участие в Claridade."
          ),
          evidence(
            "Министерство образования Кабо-Верде",
            "https://minedu.gov.cv/media/manuais/2020/10/19/Programa_de_Portugu%C3%AAs_-_Area_Human%C3%ADstica.pdf",
            "Официальная учебная программа называет Балтазара Лопеша, Жоржи Барбозу и Мануэла Лопеша основателями Claridade и связывает с ним роман Chiquinho и исследования креольского языка."
          ),
        ],
      },
    ],
    reviewer,
    decision: "unchanged",
    notes:
      "Identity registry gap: полного mapping для ключа нет. Национальная библиотека Португалии подтверждает имя Baltasar Lopes (da Silva), даты 1907-04-23 и 1989-05-28 и литературно-филологическую деятельность; кандидат Q548846 следует добавить после отдельного registry review. Shared country files не изменялись.",
  },
  {
    key: "cape_verde:eugenio_tavares",
    originalSha256:
      "d5e903f475a9b484894d415596d7cc63e00d58784e302eac096dde81d7ce5d7b",
    reviewedTextRu:
      "Кабо-вердианский поэт, журналист и композитор, автор многочисленных морн и участник становления романтической традиции этого жанра.",
    claims: [
      {
        textRu:
          "Сравнительная оценка заменена документированными занятиями Эужениу Тавареша и его вкладом в развитие романтической морны.",
        verdict: "corrected",
        evidence: [
          evidence(
            "Министерство образования Кабо-Верде",
            "https://minedu.gov.cv/media/manuais/2020/10/07/Caderno_Experimental_Hist%C3%B3ria_e_Geografia_de_Cabo_Verde_6%C2%BA_Ano.pdf",
            "Официальный учебник называет Тавареша поэтом, интеллектуалом, журналистом и композитором, сообщает о написанных им известных морнах и романтическом характере, который он придал жанру."
          ),
          evidence(
            "UNESCO World Heritage Centre",
            "https://whc.unesco.org/fr/listesindicatives/6099/",
            "Досье объекта на предварительном списке ЮНЕСКО характеризует Тавареша как журналиста, композитора, поэта и драматурга и отмечает его вклад в популяризацию морны."
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Суперлатив снят; литературно-музыкальная роль изложена через конкретные занятия и вклад в жанр. Identity audit: Q1355682 соответствует Эужениу Таварешу; официальные источники подтверждают годы 1867-1930. Shared country files не изменялись.",
  },
  {
    key: "cape_verde:germano_almeida",
    originalSha256:
      "c2e84c7e00c0cee0d50221ff1140e0309dc63c1b203ce320c6f6bcc056b53b12",
    reviewedTextRu:
      "Кабо-вердианский писатель и юрист, лауреат Премии Камоэнса 2018 года.",
    claims: [
      {
        textRu:
          "Оценка известности заменена проверяемыми сведениями: Жерману Алмейда - кабо-вердианский писатель и юрист, получивший Премию Камоэнса в 2018 году.",
        verdict: "corrected",
        evidence: [
          evidence(
            "Camões - Instituto da Cooperação e da Língua",
            "https://www.instituto-camoes.pt/sobre/comunicacao/noticias/germano-almeida-premio-camoes-2018",
            "Официальное сообщение называет Жерману Алмейду кабо-вердианским писателем и лауреатом Премии Камоэнса 2018 года."
          ),
          evidence(
            "Direção-Geral do Livro, dos Arquivos e das Bibliotecas",
            "https://dglab.gov.pt/%E2%80%8Bgermano-almeida-vencedor-30a-edicao-premio-camoes/",
            "Государственное книжно-архивное ведомство подтверждает победу Алмейды в 30-м присуждении Премии Камоэнса и приводит его библиографию."
          ),
          evidence(
            "Camões - Instituto da Cooperação e da Língua",
            "https://www.instituto-camoes.pt/sobre/comunicacao/noticias/camoes-da-que-falar-com-germano-almeida",
            "Институциональный материал характеризует Алмейду как адвоката, ставшего писателем, и перечисляет произведения его литературной карьеры."
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Суперлатив «один из самых известных» снят; добавлены профессия и точная награда. Identity audit: Q580332 соответствует Жерману Алмейде; год рождения 1945 подтверждён институциональными материалами. Shared country files не изменялись.",
  },
  {
    key: "cape_verde:jorge_barbosa",
    originalSha256:
      "83b1c44c37cdac8b9a11ea3c1cc663eafe61d88b017a6241d68ba4becaa21070",
    reviewedTextRu:
      "Кабо-вердианский поэт, сооснователь литературного журнала Claridade; его сборник «Архипелаг» (Arquipélago) вышел в 1935 году.",
    claims: [
      {
        textRu:
          "Широкая формула об основании всей современной литературы уточнена: Жоржи Барбоза был поэтом и сооснователем журнала Claridade, а сборник Arquipélago опубликовал в 1935 году.",
        verdict: "corrected",
        evidence: [
          evidence(
            "Министерство образования Кабо-Верде",
            "https://minedu.gov.cv/media/manuais/2020/10/07/Caderno_Experimental_Hist%C3%B3ria_e_Geografia_de_Cabo_Verde_6%C2%BA_Ano.pdf",
            "Официальный учебник называет Балтазара Лопеша, Жоржи Барбозу и Мануэла Лопеша основателями журнала Claridade."
          ),
          evidence(
            "Министерство образования Кабо-Верде",
            "https://minedu.gov.cv/media/manuais/2020/10/07/Manual_HGCV_5_VDigital.pdf",
            "Другой государственный учебник называет Барбозу поэтом 1902-1971 годов и связывает с ним книги Arquipélago и Ambiente."
          ),
          evidence(
            "Rádio e Televisão Cabo-verdiana",
            "https://www.rtc.cv/noticia/noticia-details/poeta-jorge-vera-cruz-barbosa-e-homenageado-hoje-precisamente-na-data-do-seu-nascimento-13226",
            "Национальная телерадиокомпания называет Барбозу поэтом и одним из лиц литературного движения Claridade."
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Date discrepancy queue: карточка содержит birthDate 1902-05-22, а Wikidata - 1902-05-25. RTC Cabo Verde прямо отмечает рождение 22 мая; исследование Universidade NOVA de Lisboa, подготовленное при поддержке семьи, также даёт 1902-05-22. Рекомендация - сохранить 1902-05-22 и deathDate 1971-01-06. Shared country files не изменялись.",
  },
];

function finalizeReviewRecord(
  record: Omit<WriterBiographyFactReviewRecord, "applicableTextRu">
): WriterBiographyFactReviewRecord {
  return {
    ...record,
    applicableTextRu:
      record.decision === "held" ? null : record.reviewedTextRu,
  };
}

export const writerBiographyFactReviewBatch06: readonly WriterBiographyFactReviewRecord[] =
  writerBiographyFactReviewBatch06Base.map(finalizeReviewRecord);
