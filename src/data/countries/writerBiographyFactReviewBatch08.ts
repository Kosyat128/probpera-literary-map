export const WRITER_BIOGRAPHY_FACT_REVIEW_BATCH08_REVIEWER =
  "Codex independent claim-by-claim factual review, batch 08";

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

const checkedAt = "2026-08-09";
const reviewer = WRITER_BIOGRAPHY_FACT_REVIEW_BATCH08_REVIEWER;

type EvidenceTuple = readonly [
  provider: string,
  url: string,
  findingRu: string,
];

const evidenceByAuthor = {
  cabreraInfante: [
    ["Институт Сервантеса", "https://www.cervantes.es/bibliotecas_documentacion_espanol/biografias/varsovia_guillermo_cabrera_infante.htm", "Биография подтверждает кубинское происхождение, работу писателем, журналистом, кинокритиком и сценаристом и жанровый состав книг."],
    ["Министерство культуры Испании", "https://www.cultura.gob.es/premiado/mostrarDetalleAction.do?id=1007214&language=es&layout=premioMiguelCervantesLibro&prev_layout=premioMiguelCervantesLibro", "Официальный реестр фиксирует присуждение Гильермо Кабрере Инфанте премии Сервантеса за 1997 год."],
  ],
  marti: [
    ["ЮНЕСКО, программа «Память мира»", "https://www.unesco.org/en/memory-world/lac/jose-marti-perez-fonds-1866-1895", "ЮНЕСКО описывает поэтическую, публицистическую и освободительную деятельность Марти и фиксирует состав и регистрацию его архива."],
    ["Институт Сервантеса", "https://cultura.cervantes.es/recife/es/Vida-y-obra-de-Jos%C3%A9-Marti/177555", "Публикация подтверждает поэтическую и эссеистическую работу Марти и его участие в борьбе за независимость Кубы."],
  ],
  padura: [
    ["Фонд принцессы Астурийской", "https://www.fpa.es/es/premios-princesa-de-asturias/premiados/2015-leonardo-padura/?texto=trayectoria", "Официальная страница называет Падуру кубинским романистом и журналистом, лауреатом литературной премии 2015 года, и описывает цикл о Марио Конде."],
    ["Институт Сервантеса", "https://www.cervantes.es/bibliotecas_documentacion_espanol/creadores/padura_leonardo.htm", "Авторская справка подтверждает писательскую и журналистскую деятельность Падуры и библиографию детективных романов о Марио Конде."],
  ],
  arenas: [
    ["Библиотеки Пенсильванского университета", "https://findingaids.library.upenn.edu/records/PRIN_MUDD_C0232", "Архивная опись фонда Рейнальдо Аренаса фиксирует его поэзию, романы, рассказы, пьесы и автобиографические материалы."],
    ["Библиотеки Университета Нотр-Дам", "https://rarebooks.library.nd.edu/collections/latin_american/caribbean/arenas.html", "Университетская коллекция подтверждает кубинскую идентичность Аренаса и жанровый состав его литературного наследия."],
  ],
  montis: [
    ["Официальный архив Костаса Монтиса", "https://www.costasmontis.com/biography.html", "Архив наследия подтверждает работу Монтиса в поэзии, прозе и театре."],
    ["Библиотека Кипрского университета", "https://lekythos.library.ucy.ac.cy/archive/item/174854?lang=en", "Авторитетная запись определяет Монтиса как кипрского поэта и литератора и документирует его произведения."],
  ],
  michaelides: [
    ["Библиотека Кипрского университета", "https://lekythos.library.ucy.ac.cy/archive/item/186108?lang=en", "Запись подтверждает поэтическую работу Михаилидиса, использование кипрского диалекта, димотики и кафаревусы и смерть 18 декабря 1917 года."],
    ["Правительственный портал Кипра «Кипр 1821»", "https://kypros1821.gov.cy/logotechnia/vasili-michailidi-9-iouliou-1821/", "Государственный портал атрибутирует Михаилидису поэму «9 июля 1821 года в Никосии на Кипре»."],
  ],
  nemcova: [
    ["Музей Божены Немцовой", "https://www.muzeumbn.cz/bozena-nemcova/", "Официальный музей документирует жизнь и литературное наследие Немцовой, включая роман «Бабушка»."],
    ["Национальная библиотека Чешской Республики", "https://kramerius.nkp.cz/kramerius/MShowMonograph.do?id=16288", "Цифровой каталог подтверждает авторство Немцовой и библиографическую запись «Бабушки»."],
  ],
  seifert: [
    ["Нобелевская премия", "https://www.nobelprize.org/prizes/literature/1984/press-release/", "Официальный пресс-релиз подтверждает журналистскую работу Сейферта, путь от авангарда к лирике памяти, любви и Праги и мотивировку награды 1984 года."],
    ["Чешский литературный центр CzechLit", "https://www.czechlit.cz/en/three-czech-books-to-be-published-in-filipino/", "Литературный центр независимо подтверждает, что Сейферт был чешским поэтом - лауреатом Нобелевской премии."],
  ],
  capek: [
    ["Мемориал Карела Чапека", "https://karelcapek.cz/en/life-and-creation/karel-capek", "Официальный мемориальный портал подтверждает работу Чапека как чешского писателя, драматурга и журналиста."],
    ["Чешский литературный центр CzechLit", "https://www.czechlit.cz/cz/kniha/r-u-r-cz/", "Страница пьесы «R.U.R.» фиксирует появление в ней слова «robot»."],
  ],
  macha: [
    ["Чешский литературный центр CzechLit", "https://www.czechlit.cz/en/de_post/karel-hynek-macha-mai/", "Литературный центр атрибутирует Карелу Гинеку Махе поэму «Май»."],
    ["Национальный музей Чехии", "https://www.nm.cz/en/periodicals/amnphl/57-1-2/karel-hynek-macha-and-czech-music", "Национальный музей рассматривает Маху как чешского поэта и документирует место поэмы «Май» в его наследии."],
  ],
  kundera: [
    ["Моравская земская библиотека", "https://www.mzk.cz/en/premises/other/milan-kundera-library", "Библиотека наследия перечисляет романы, эссе, пьесы и раннюю поэзию Кундеры."],
    ["Национальная библиотека Франции", "https://www.bnf.fr/fr/milan-kundera-1929-2023-bibliographie", "Национальная библиотека определяет Кундеру как франко-чешского писателя и подтверждает переход к книгам на французском языке."],
  ],
  mudimbe: [
    ["Университет Дьюка", "https://trinity.duke.edu/news/literature-professor-valentin-yves-mudimbe-passes-away", "Университет подтверждает полное имя, работу философом, романистом, поэтом и исследователем, содержание «The Invention of Africa» и смерть 21 апреля 2025 года."],
    ["Кембриджский университет, журнал Africa", "https://www.cambridge.org/core/journals/africa/article/life-and-work-of-vy-mudimbe-8-december-194121-april-2025/E7E89FC89E5B6CDAF870EA8B54A0D5E0", "Академический некролог независимо подтверждает идентичность Валантена-Ива Мудимбе, даты жизни и направления его работы."],
  ],
  oehlenschlager: [
    ["Датская национальная энциклопедия Lex", "https://lex.dk/Adam_Oehlenschl%C3%A4ger", "Статья подтверждает работу Эленшлегера как поэта и драматурга и роль ранних произведений в датском романтизме."],
    ["Королевская библиотека Дании", "https://tekster.kb.dk/text/adl-authors-oehlens-p-root.pdf", "Национальная библиотечная статья независимо документирует жанры и романтический период творчества Эленшлегера."],
  ],
  rifbjerg: [
    ["Датская академия", "https://www.danskeakademi.dk/medlem/klaus-rifbjerg/", "Академическая справка документирует работу Рифбьерга в поэзии, прозе, драматургии и кино."],
    ["Датская национальная энциклопедия Lex", "https://lex.dk/Klaus_Rifbjerg", "Энциклопедия независимо подтверждает писательские роли Рифбьерга и жанровый диапазон его произведений."],
  ],
  holberg: [
    ["Фонд премии Хольберга", "https://holbergprize.org/ludvig-holberg/", "Биография определяет Хольберга как датско-норвежского автора Просвещения и перечисляет драматические, исторические и эссеистические труды."],
    ["Королевская библиотека Дании", "https://www.kb.dk/en/inspiration/danish-drama-everyone/anna-lawaetz-beginning-danish-drama", "Национальная библиотека подтверждает роль Хольберга в датской драме и авторство его комедий."],
  ],
  waberi: [
    ["Университет Джорджа Вашингтона", "https://rgss.columbian.gwu.edu/abdourahman-waberi", "Профиль подтверждает имя Абдурахмана Вабери, джибутийское происхождение и работу франкоязычным писателем, поэтом и эссеистом."],
    ["Издательство Чикагского университета", "https://press.uchicago.edu/ucp/books/author/W/A/au12361013.html", "Университетское издательство подтверждает идентичность Вабери и его работу в художественной прозе, документальной литературе и поэзии."],
  ],
  rhys: [
    ["Британская библиотека", "https://searcharchives.bl.uk/catalog/032-002000011", "Архивная опись подтверждает настоящее имя Жан Рис, работу романисткой и авторство романов и рассказов, включая «Широкое Саргассово море»."],
    ["Национальная портретная галерея Великобритании", "https://www.npg.org.uk/collections/search/person/mp67021/jean-rhys-ella-gwendoline-rees-williams", "Национальная институция подтверждает рождение писательницы в Вест-Индии и связь романа с персонажами «Джейн Эйр»."],
  ],
  allfrey: [
    ["Издательство Ратгерского университета", "https://www.rutgersuniversitypress.org/the-orchid-house/9780813523323", "Издательство подтверждает доминикское происхождение Олфри, её работу романисткой и поэтессой и авторство «The Orchid House»."],
    ["Библиотека Университета Вест-Индии", "https://archivespace.sta.uwi.edu/repositories/2/archival_objects/9851", "Архивная запись подтверждает занятие Олфри поста федерального министра труда и социальных дел Вест-Индской федерации."],
  ],
  bosch: [
    ["Фонд Хуана Боша", "https://juanbosch.org/biografia/", "Биография наследия подтверждает писательскую, историческую и политическую деятельность Боша и его президентство в 1963 году."],
    ["Национальная библиотека Педро Энрикеса Уреньи", "https://catalogored.bnphu.gob.do/cgi-bin/koha/opac-authoritiesdetail.pl?authid=1", "Авторитетная запись подтверждает полное имя Хуана Эмилио Боша Гавиньо, даты жизни, президентство и библиографию, включая «La Mañosa»."],
  ],
  delCabral: [
    ["Автономный университет Санто-Доминго", "https://uasd.edu.do/escuela-filosofia-uasd-organiza-conferencia-en-honor-a-manuel-del-cabral/", "Справка подтверждает работу дель Кабраля писателем, поэтом, прозаиком и дипломатом и тематический диапазон его поэзии."],
    ["Технологический институт Санто-Доминго", "https://revistas.intec.edu.do/index.php/ciso/article/view/1309", "Академическая статья независимо документирует социальную и философскую проблематику поэзии дель Кабраля."],
  ],
} as const satisfies Record<string, readonly EvidenceTuple[]>;

type ReviewInput = {
  readonly key: string;
  readonly originalSha256: string;
  readonly reviewedTextRu: string;
  readonly sourceKey: keyof typeof evidenceByAuthor;
  readonly claims: readonly {
    readonly textRu: string;
    readonly verdict: WriterBiographyClaimVerdict;
  }[];
  readonly decision: WriterBiographyFactReviewDecision;
  readonly notes: string;
};

const inputs: readonly ReviewInput[] = [
  {
    key: "cuba:guillermo_cabrera_infante",
    originalSha256: "513ee74110c5398756e3579630276f43c116d887573fe2e3c0423d120c26315e",
    reviewedTextRu: "Кубинский писатель, журналист, кинокритик и сценарист, лауреат премии Сервантеса 1997 года. Его книги включают романы, рассказы и эссе о кино.",
    sourceKey: "cabreraInfante",
    claims: [
      { textRu: "Гильермо Кабрера Инфанте был кубинским писателем, журналистом, кинокритиком и сценаристом и получил премию Сервантеса за 1997 год.", verdict: "corrected" },
      { textRu: "Его книги включают романы, рассказы и эссе о кино.", verdict: "supported" },
    ],
    decision: "corrected",
    notes: "Суперлатив и общий пересказ стиля заменены профессиональными ролями, официальной наградой и проверяемым жанровым диапазоном.",
  },
  {
    key: "cuba:jose_marti",
    originalSha256: "c8e9a9ccdb8ba592dfa5160d6682c1349494950c9c8378f29065a2077a2a19b2",
    reviewedTextRu: "Кубинский поэт, эссеист, публицист и деятель движения за независимость Кубы. Его архив, включающий рукописи, письма и журналистские материалы, внесён в реестр программы ЮНЕСКО «Память мира».",
    sourceKey: "marti",
    claims: [
      { textRu: "Хосе Марти был кубинским поэтом, эссеистом, публицистом и деятелем движения за независимость.", verdict: "corrected" },
      { textRu: "Архив Марти с рукописями, письмами и журналистскими материалами внесён в реестр ЮНЕСКО «Память мира».", verdict: "supported" },
    ],
    decision: "corrected",
    notes: "Широкие оценки масштаба и влияния заменены документированными ролями и статусом архива.",
  },
  {
    key: "cuba:leonardo_padura",
    originalSha256: "2ff78528dee9edeec315bab76efcd012a6c0c335a3a977cf6aca50f03218d705",
    reviewedTextRu: "Кубинский писатель и журналист, лауреат премии принцессы Астурийской по литературе 2015 года. Автор серии детективных романов о Марио Конде.",
    sourceKey: "padura",
    claims: [
      { textRu: "Леонардо Падура - кубинский писатель и журналист, лауреат премии принцессы Астурийской по литературе 2015 года.", verdict: "corrected" },
      { textRu: "Падура - автор серии детективных романов о Марио Конде.", verdict: "supported" },
    ],
    decision: "corrected",
    notes: "Недоказанный рейтинг известности заменён официальной премией; факт о цикле Марио Конде сохранён и подтверждён.",
  },
  {
    key: "cuba:reynaldo_arenas",
    originalSha256: "d8ed73f76510c857ae51ac229575b88ee09c690c17a43039bc1c2a426060a4bb",
    reviewedTextRu: "Кубинский поэт, романист и драматург. Его наследие включает романы, рассказы, пьесы, поэзию и автобиографическую прозу.",
    sourceKey: "arenas",
    claims: [
      { textRu: "Рейнальдо Аренас был кубинским поэтом, романистом и драматургом.", verdict: "corrected" },
      { textRu: "Его наследие включает романы, рассказы, пьесы, поэзию и автобиографическую прозу.", verdict: "supported" },
    ],
    decision: "corrected",
    notes: "Рейтинг известности и обобщённая тематическая интерпретация заменены архивно подтверждёнными жанрами.",
  },
  {
    key: "cyprus:kostas_montis",
    originalSha256: "0da975489cc890e667a55e8dd296d5b42ddba97c6cc4d0ceddcc6280d2d2fd52",
    reviewedTextRu: "Кипрский поэт и прозаик, автор стихотворных сборников, рассказов и театральных текстов.",
    sourceKey: "montis",
    claims: [{ textRu: "Костас Монтис был кипрским поэтом и прозаиком, писавшим стихи, рассказы и театральные тексты.", verdict: "corrected" }],
    decision: "corrected",
    notes: "Сравнительный суперлатив заменён профессиональными ролями и подтверждёнными жанрами.",
  },
  {
    key: "cyprus:vasilis_michaelides",
    originalSha256: "38709e7bbd6b6508a3fe85644926acbd86eb4ce5fa9873964e8a44d4c9a29fc2",
    reviewedTextRu: "Кипрский поэт, писавший на кипрском диалекте, димотике и кафаревусе. Автор поэмы «9 июля 1821 года в Никосии на Кипре».",
    sourceKey: "michaelides",
    claims: [
      { textRu: "Василис Михаилидис был кипрским поэтом и писал на кипрском диалекте, димотике и кафаревусе.", verdict: "corrected" },
      { textRu: "Михаилидис - автор поэмы «9 июля 1821 года в Никосии на Кипре».", verdict: "supported" },
    ],
    decision: "corrected",
    notes: "Недоказанные титул и формула об основании литературы заменены языками и произведением. Рекомендация: заменить deathDate 1917-12-08 на подтверждённую Кипрским университетом 1917-12-18; общий файл не изменён.",
  },
  {
    key: "czechia:bozena_nemcova",
    originalSha256: "6855a69727166a78b0305e39610cd05a6c08417589621d9cddaced014c8ad979",
    reviewedTextRu: "Чешская писательница, автор романа «Бабушка».",
    sourceKey: "nemcova",
    claims: [{ textRu: "Божена Немцова была чешской писательницей и автором романа «Бабушка».", verdict: "corrected" }],
    decision: "corrected",
    notes: "Формула об основании современной прозы заменена профессиональной ролью и конкретным произведением.",
  },
  {
    key: "czechia:jaroslav_seifert",
    originalSha256: "1e2f044f73e9f661981e1df7a6af50a84fc6af83c4e68d36e0e7f14a6196d6b3",
    reviewedTextRu: "Чешский поэт и журналист, прошедший путь от авангарда 1920-х годов к прозрачной лирике памяти, любви и родного города. Нобелевская премия 1984 года отметила свежесть, чувственность и изобретательность его поэзии.",
    sourceKey: "seifert",
    claims: [
      { textRu: "Ярослав Сейферт был чешским поэтом и журналистом; его поэтика развивалась от авангарда к лирике памяти, любви и Праги.", verdict: "supported" },
      { textRu: "Сейферт получил Нобелевскую премию по литературе 1984 года с указанной в тексте мотивировкой.", verdict: "supported" },
    ],
    decision: "unchanged",
    notes: "Текст сохранён дословно. Пересечение с Нобелевским реестром намеренное: структурные award/year не заменяют claim-by-claim проверку биографии; Nobel Prize дополнен независимым CzechLit.",
  },
  {
    key: "czechia:karel_capek",
    originalSha256: "a4edd4290ef4c54a9f51c9d1f833ded104d761ec5305b7f6155c4f5a32564bfc",
    reviewedTextRu: "Чешский писатель, драматург и журналист. В пьесе «R.U.R.» впервые появилось слово «робот».",
    sourceKey: "capek",
    claims: [
      { textRu: "Карел Чапек был чешским писателем, драматургом и журналистом.", verdict: "corrected" },
      { textRu: "В пьесе Чапека «R.U.R.» впервые появилось слово «робот».", verdict: "supported" },
    ],
    decision: "corrected",
    notes: "Суперлатив заменён профессиональными ролями и проверяемым литературно-языковым фактом.",
  },
  {
    key: "czechia:karel_hynek_macha",
    originalSha256: "a105a69651d4968c552903266fde534a1041b4c8af906631f2616c1ae425e78d",
    reviewedTextRu: "Чешский поэт, автор лироэпической поэмы «Май».",
    sourceKey: "macha",
    claims: [{ textRu: "Карел Гинек Маха был чешским поэтом и автором лироэпической поэмы «Май».", verdict: "corrected" }],
    decision: "corrected",
    notes: "Абсолютный суперлатив заменён профессиональной ролью и конкретным произведением.",
  },
  {
    key: "czechia:milan_kundera",
    originalSha256: "802cb24ec29abd2bd822ca1c443e0df3edbcf4ed162a9a1a130a32e1bcefc444",
    reviewedTextRu: "Чешско-французский романист, эссеист и драматург. Писал сначала по-чешски, а позднее по-французски.",
    sourceKey: "kundera",
    claims: [
      { textRu: "Милан Кундера был чешско-французским романистом, эссеистом и драматургом.", verdict: "corrected" },
      { textRu: "Кундера писал сначала по-чешски, а позднее по-французски.", verdict: "supported" },
    ],
    decision: "corrected",
    notes: "Сравнительная оценка масштаба заменена жанрами и документированным переходом между языками творчества.",
  },
  {
    key: "democratic_republic_of_congo:v_y_mudimbe",
    originalSha256: "022a3323ebac7980f3c702f0786b18212b5f2885ddcfba3e791a08e8608653be",
    reviewedTextRu: "Конголезский философ, романист, поэт и исследователь. Автор книги «The Invention of Africa» о способах производства знания об Африке.",
    sourceKey: "mudimbe",
    claims: [
      { textRu: "Валантен-Ив Мудимбе был конголезским философом, романистом, поэтом и исследователем.", verdict: "corrected" },
      { textRu: "Мудимбе - автор книги «The Invention of Africa» о способах производства знания об Африке.", verdict: "supported" },
    ],
    decision: "corrected",
    notes: "Суперлатив заменён ролями и книгой. Рекомендация: заменить displayName «Венцеслас Мудимбе» на «Валантен-Ив Мудимбе», а deathDate 2021 на 2025-04-21; общий файл не изменён.",
  },
  {
    key: "denmark:adam_oehlenschlager",
    originalSha256: "26a72e458764f535beeed80deedd3d92262052b99b0020b47c950dc25ee628e6",
    reviewedTextRu: "Датский поэт и драматург, чьи ранние произведения связаны со становлением романтизма в датской литературе.",
    sourceKey: "oehlenschlager",
    claims: [{ textRu: "Адам Эленшлегер был датским поэтом и драматургом; его ранние произведения связаны со становлением датского романтизма.", verdict: "corrected" }],
    decision: "corrected",
    notes: "Категоричная формула «один из основателей» уточнена до документированной роли ранних произведений.",
  },
  {
    key: "denmark:klaus_rifbjerg",
    originalSha256: "adc15cfc4709591dbea36208c9eb1b353ebb88f4b05ee52a8df6480662d1a0ca",
    reviewedTextRu: "Датский писатель, поэт, драматург и сценарист. Его произведения охватывают романы, поэзию, рассказы, пьесы и киносценарии.",
    sourceKey: "rifbjerg",
    claims: [
      { textRu: "Клаус Рифбьерг был датским писателем, поэтом, драматургом и сценаристом.", verdict: "corrected" },
      { textRu: "Его произведения включают романы, поэзию, рассказы, пьесы и киносценарии.", verdict: "supported" },
    ],
    decision: "corrected",
    notes: "Недоказанный рейтинг заменён профессиональными ролями и жанровым диапазоном.",
  },
  {
    key: "denmark:ludvig_holberg",
    originalSha256: "069653d68459bea0a25a19786d5214e5aa211dd88c8e1fc8f712c2033ef6d673",
    reviewedTextRu: "Датско-норвежский драматург, историк и эссеист эпохи Просвещения. Автор комедий «Йеппе с горы» и «Эразм Монтанус».",
    sourceKey: "holberg",
    claims: [
      { textRu: "Людвиг Хольберг был датско-норвежским драматургом, историком и эссеистом эпохи Просвещения.", verdict: "corrected" },
      { textRu: "Хольберг - автор комедий «Йеппе с горы» и «Эразм Монтанус».", verdict: "supported" },
    ],
    decision: "corrected",
    notes: "Формула об основании драматургии и суперлатив заменены ролями, эпохой и конкретными произведениями.",
  },
  {
    key: "djibouti:abdourahman_waberi",
    originalSha256: "538c3a2aabd3a7a88d922bea168dbfc49b6594d91a4d429c03614966c014d1f5",
    reviewedTextRu: "Джибутийский франкоязычный писатель, поэт и эссеист. Его произведения включают художественную прозу, документальные тексты и поэзию.",
    sourceKey: "waberi",
    claims: [
      { textRu: "Абдурахман Вабери - джибутийский франкоязычный писатель, поэт и эссеист.", verdict: "corrected" },
      { textRu: "Произведения Вабери включают художественную прозу, документальные тексты и поэзию.", verdict: "supported" },
    ],
    decision: "corrected",
    notes: "Суперлатив заменён ролями и жанрами. Рекомендация: заменить ошибочное displayName «Абдурахман Али Варсама» на «Абдурахман Али Вабери»; общий файл не изменён.",
  },
  {
    key: "dominica:jean_rhys",
    originalSha256: "b4328a96567f54d76177390acea5f5890ab30088e540527cd5d262dd5fdfe158",
    reviewedTextRu: "Родившаяся на Доминике англоязычная писательница, автор романов и рассказов. В «Широком Саргассовом море» переосмыслила историю персонажей «Джейн Эйр» Шарлотты Бронте.",
    sourceKey: "rhys",
    claims: [
      { textRu: "Жан Рис родилась на Доминике и писала по-английски романы и рассказы.", verdict: "corrected" },
      { textRu: "В «Широком Саргассовом море» Рис переосмыслила историю персонажей «Джейн Эйр» Шарлотты Бронте.", verdict: "supported" },
    ],
    decision: "corrected",
    notes: "Суперлатив снят; происхождение, язык, жанры и связь романа с «Джейн Эйр» подтверждены национальными институциями.",
  },
  {
    key: "dominica:phyllis_shand_allfrey",
    originalSha256: "ad4119dd128ba3d829e433cb174fa9367a17bf03c3ed132dbc719343da82d639",
    reviewedTextRu: "Доминикская писательница, поэтесса и политическая деятельница. Автор романа «The Orchid House»; занимала пост федерального министра труда и социальных дел Вест-Индской федерации.",
    sourceKey: "allfrey",
    claims: [
      { textRu: "Филлис Шанд Олфри была доминикской писательницей, поэтессой и политической деятельницей.", verdict: "corrected" },
      { textRu: "Олфри - автор романа «The Orchid House» и бывший федеральный министр труда и социальных дел Вест-Индской федерации.", verdict: "supported" },
    ],
    decision: "corrected",
    notes: "Обобщения заменены книгой и должностью. Рекомендация: недопустимое deathDate 1986-02-31 заменить на точность года «1986»; точный день институционально не установлен, кандидат 1986-02-04 пока не применять. Общий файл не изменён.",
  },
  {
    key: "dominican_republic:juan_bosch",
    originalSha256: "bf88dea0bf0a978eeb30a753b5236bbb11af060080ed3d76669214b2edb09ede",
    reviewedTextRu: "Доминиканский писатель, историк и политический деятель, президент Доминиканской Республики в 1963 году. Автор рассказов, романа «La Mañosa» и историко-политических эссе.",
    sourceKey: "bosch",
    claims: [
      { textRu: "Хуан Бош был доминиканским писателем, историком и политическим деятелем и президентом страны в 1963 году.", verdict: "corrected" },
      { textRu: "Бош писал рассказы, роман «La Mañosa» и историко-политические эссе.", verdict: "supported" },
    ],
    decision: "corrected",
    notes: "Суперлатив заменён ролями, президентством и жанрами. Национальная авторитетная запись подтверждает, что «Хуан Бош» и «Хуан Эмилио Бош Гавиньо» - одна личность; исправление ключа не требуется.",
  },
  {
    key: "dominican_republic:manuel_del_cabral",
    originalSha256: "842721359db99bf1f6d8c28a30a95f162c6aee1c1ccd5278d5cda9e7089fc31c",
    reviewedTextRu: "Доминиканский писатель, поэт, прозаик и дипломат. Его поэзия обращается к политическим, социальным, любовным и метафизическим темам.",
    sourceKey: "delCabral",
    claims: [
      { textRu: "Мануэль дель Кабраль был доминиканским писателем, поэтом, прозаиком и дипломатом.", verdict: "corrected" },
      { textRu: "Поэзия дель Кабраля обращается к политическим, социальным, любовным и метафизическим темам.", verdict: "supported" },
    ],
    decision: "corrected",
    notes: "Недоказанный рейтинг заменён профессиональными ролями; тематический диапазон уточнён по университетским источникам.",
  },
];

function finalizeReviewRecord(input: ReviewInput): WriterBiographyFactReviewRecord {
  const evidence = evidenceByAuthor[input.sourceKey].map(
    ([provider, url, findingRu]) => ({ provider, url, checkedAt, findingRu })
  );
  return {
    key: input.key,
    originalSha256: input.originalSha256,
    reviewedTextRu: input.reviewedTextRu,
    applicableTextRu:
      input.decision === "held" ? null : input.reviewedTextRu,
    claims: input.claims.map((claim) => ({ ...claim, evidence })),
    reviewer,
    decision: input.decision,
    notes: input.notes,
  };
}

export const writerBiographyFactReviewBatch08: readonly WriterBiographyFactReviewRecord[] =
  inputs.map(finalizeReviewRecord);
