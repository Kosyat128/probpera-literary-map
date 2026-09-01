export const WRITER_BIOGRAPHY_FACT_REVIEW_BATCH27_REVIEWER =
  "Codex independent claim-by-claim factual review, batch 27";

export type WriterBiographyFactReviewDecision = "unchanged" | "corrected" | "held";
export type WriterBiographyClaimVerdict = "supported" | "corrected" | "not-established";

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

const reviewer = WRITER_BIOGRAPHY_FACT_REVIEW_BATCH27_REVIEWER;
const checkedAt = "2026-08-09";

type EvidenceSeed = readonly [
  provider: string,
  url: string,
  findingRu: string,
  checkedAt?: string,
];

interface ReviewSeed {
  readonly key: string;
  readonly originalSha256: string;
  readonly reviewedTextRu: string;
  readonly evidence: readonly EvidenceSeed[];
  readonly decision: WriterBiographyFactReviewDecision;
  readonly notes: string;
}

const seeds = [
  {
    key: "england:virginia_woolf",
    originalSha256: "336f1f9dbd32b09069c80e73bb25ad02cc535120eb6fc5cf9d6eb1e41eab1850",
    reviewedTextRu: "Вирджиния Вулф (1882-1941) - английская писательница и литературный критик, участница Блумсберийской группы. Среди её романов - «Миссис Дэллоуэй» и «На маяк».",
    evidence: [
      ["Virginia Woolf Society of Great Britain", "https://virginiawoolfsociety.org.uk/resources/virginia-woolf-a-short-biography/", "Профильное общество подтверждает годы жизни, литературную деятельность, связь с Блумсберийской группой и авторство названных романов."],
      ["National Portrait Gallery, London", "https://www.npg.org.uk/collections/search/person/mp04923/virginia-woolf-nee-stephen", "Национальная портретная галерея независимо фиксирует годы жизни Вулф и характеризует её как романиста, эссеиста и критика Блумсберийской группы."],
    ],
    decision: "corrected",
    notes: "Субъективная формула «одна из главных фигур» заменена проверяемыми биографическими сведениями и двумя произведениями. Shared country files не изменялись.",
  },
  {
    key: "england:walter_scott",
    originalSha256: "28980ea8a5afce13ea9611afc012b21d0ffce63942ac9ad7446b32fb762e2c39",
    reviewedTextRu: "Вальтер Скотт (1771-1832) - шотландский поэт, романист и критик. Он написал исторические романы «Уэверли» и «Айвенго».",
    evidence: [
      ["National Library of Scotland", "https://www.nls.uk/collections/stories/literature-and-poetry/sir-walter-scott-and-his-historical-influences/", "Национальная библиотека Шотландии подтверждает литературные роли Скотта и связывает его историческую прозу с «Уэверли» и «Айвенго»."],
      ["National Portrait Gallery, London", "https://www.npg.org.uk/collections/search/person/mp04014/sir-walter-scott-1st-bt", "Национальная портретная галерея независимо подтверждает годы жизни и деятельность шотландского романиста и поэта."],
    ],
    decision: "corrected",
    notes: "Недоказуемое единоличное «создатель жанра» заменено нейтральными ролями и двумя документированными романами. Shared country files не изменялись.",
  },
  {
    key: "england:wilkie_collins",
    originalSha256: "45fccbc12b42da40047167bb5958ea81d75762a0bdc4467e54f236505961d68d",
    reviewedTextRu: "Уилки Коллинз (1824-1889) - английский романист и драматург. Он написал романы «Женщина в белом» и «Лунный камень», построенные вокруг преступлений и тайн.",
    evidence: [
      ["National Portrait Gallery, London", "https://www.npg.org.uk/assets/uploads/files/large-print-guide_Room_21.pdf", "Материал национальной галереи подтверждает годы жизни Коллинза, его литературную деятельность и связь с романами «Женщина в белом» и «Лунный камень»."],
      ["Bodleian Libraries, University of Oxford", "https://www.bodleian.ox.ac.uk/sites/default/files/bodreader/documents/media/bodleian-library-publishing-catalogue-spring26.pdf", "Издательский каталог Бодлианской библиотеки независимо атрибутирует Коллинзу оба романа и описывает их сюжеты как тайны и расследования."],
    ],
    decision: "corrected",
    notes: "Оценочное определение мастерства и исторического первенства заменено нейтральной жанровой характеристикой произведений. Shared country files не изменялись.",
  },
  {
    key: "england:william_langland",
    originalSha256: "42a0d479d92c60f6179841f524775674d93a2eb2e94012735b7b33be6b78b9c6",
    reviewedTextRu: "Английский поэт Средневековья, предполагаемый автор аллегорической поэмы «Видение о Петре Пахаре».",
    evidence: [
      ["Poetry Foundation", "https://www.poetryfoundation.org/poets/william-langland", "Профильная литературная организация описывает Лэнгленда как средневекового английского поэта и вероятного автора Piers Plowman."],
      ["British Library Archives and Manuscripts", "https://searcharchives.bl.uk/catalog/032-002088549", "Каталог Британской библиотеки независимо связывает имя Уильяма Лэнгленда с поэмой Piers Plowman, сохраняя осторожность атрибуции."],
    ],
    decision: "unchanged",
    notes: "Все конкретные утверждения исходного короткого текста подтверждены; осторожная формула «предполагаемый автор» сохранена дословно.",
  },
  {
    key: "england:william_shakespeare",
    originalSha256: "429cbc98608db12be2f300fe90fdb9f20fabead9624ebb980c9757de10d03c3d",
    reviewedTextRu: "Уильям Шекспир (1564-1616) - английский драматург, поэт и актёр. Помимо литературной работы он был пайщиком театральной труппы «Слуги лорда-камергера», позднее получившей название «Слуги короля».",
    evidence: [
      ["Shakespeare Birthplace Trust", "https://www.shakespeare.org.uk/explore-shakespeare/shakespedia/william-shakespeare/william-shakespeare-biography/", "Музейно-архивная биография подтверждает годы жизни, профессии Шекспира и его участие в названной театральной труппе."],
      ["Folger Shakespeare Library", "https://www.folger.edu/explore/shakespeares-life/", "Фолджеровская библиотека независимо подтверждает деятельность Шекспира как драматурга, поэта, актёра и пайщика, а также переименование труппы."],
    ],
    decision: "corrected",
    notes: "Длинный оценочный пассаж о художественных качествах заменён двумя короткими, документируемыми биографическими предложениями. Shared country files не изменялись.",
  },
  {
    key: "england:william_thackeray",
    originalSha256: "b6ab8541142b3bec2960c5244101908abbc3d585279edd765d4c99c09742c3b3",
    reviewedTextRu: "Уильям Мейкпис Теккерей (1811-1863) - английский романист и журналист викторианской эпохи. Он написал роман «Ярмарка тщеславия».",
    evidence: [
      ["National Portrait Gallery, London", "https://www.npg.org.uk/collections/search/person/mp04460/william-makepeace-thackeray", "Национальная портретная галерея подтверждает годы жизни, работу романиста и журналиста и авторство Vanity Fair."],
      ["Poetry Foundation", "https://www.poetryfoundation.org/poets/william-makepeace-thackeray", "Литературная организация независимо подтверждает биографические даты, писательскую деятельность и авторство «Ярмарки тщеславия»."],
    ],
    decision: "corrected",
    notes: "К корректной характеристике добавлены полное имя, годы жизни и проверяемое ключевое произведение. Shared country files не изменялись.",
  },
  {
    key: "equatorial_guinea:maria_nsue_angue",
    originalSha256: "b44307ca8a8e5746baadc8de20c70f34a613b0b0c495a71cea57d1779a2e63bf",
    reviewedTextRu: "Мария Нсуэ Ангье (1945-2017) - экватогвинейская писательница, автор романа «Экомо», опубликованного в 1985 году. Это первый роман, опубликованный женщиной из Экваториальной Гвинеи.",
    evidence: [
      ["Université d’Angers - EcoLitt", "https://ecolitt.univ-angers.fr/fr/ressources-pour-tous/fiches-de-lecture/maria-nsue-angue-ekomo.html", "Университетская справка подтверждает авторство, дату публикации «Экомо» и его статус первого романа женщины из Экваториальной Гвинеи."],
      ["Casa África", "https://www.casafrica.es/es/persona/maria-nsue-angue", "Государственный культурный институт Испании независимо подтверждает биографию Нсуэ Ангье и сведения о романе «Экомо»."],
    ],
    decision: "corrected",
    notes: "Расплывчатое «одна из первых известных» заменено точной и институционально подтверждённой формулировкой о первом опубликованном романе. Shared country files не изменялись.",
  },
  {
    key: "eritrea:alemseged_tesfai",
    originalSha256: "28ba8cc5afb12360af1d379b130052b2dc1165098af768411e3276b7f7b4d822",
    reviewedTextRu: "Алемсегед Тесфай (род. 1944) - эритрейский драматург и историк. Он написал пьесу «The Other War» и исследование «An African People’s Quest for Freedom and Justice».",
    evidence: [
      ["Bloomsbury Publishing", "https://www.bloomsbury.com/us/author/alemseged-tesfai/", "Издательский профиль подтверждает рождение в 1944 году, эритрейскую принадлежность, работу драматурга и историка и названные труды."],
      ["C. Hurst & Co. Publishers", "https://www.hurstpublishers.com/wp-content/uploads/2024/03/LBF24-Hurst-catalogue-lo-res-RGB.pdf", "Независимый издательский каталог подтверждает биографический профиль Тесфая и его историческое исследование об Эритрее."],
    ],
    decision: "corrected",
    notes: "Текст конкретизирован. Identity recommendation: Q55991620 согласуется с источниками. Date recommendation: заменить карточечный год рождения 1942 на подтверждённый 1944; shared country files не изменялись.",
  },
  {
    key: "eritrea:hadish_haile",
    originalSha256: "fbd97006b452321344228249e5dbc0f9507f47cc4ed8ea506924e59b05605446",
    reviewedTextRu: "Идентичность эритрейского автора по имени Хадиш Хайле не установлена: точного библиографического совпадения для этой карточки в двух институциональных каталогах не найдено.",
    evidence: [
      ["Library of Congress Catalog", "https://catalog.loc.gov/vwebv/search?searchArg=Hadish%20Haile%20Eritrea&searchCode=GKEY%5E*&searchType=0&recCount=25", "Поиск точного имени вместе с Эритреей не даёт записи, позволяющей надёжно установить личность автора карточки."],
      ["WorldCat", "https://search.worldcat.org/search?q=%22Hadish%20Haile%22%20Eritrea", "Независимый сводный библиотечный каталог также не даёт точного авторитетного совпадения имени и страны."],
    ],
    decision: "held",
    notes: "Identity не установлена; исходное общее описание нельзя доказательно связать с конкретным человеком. applicableTextRu оставлен null; shared country files не изменялись.",
  },
  {
    key: "eritrea:khaled_abdalla",
    originalSha256: "325d15bf09cbf6fdb973a9a6091bccccc3875be417467b7c2954aabf09efba28",
    reviewedTextRu: "Идентичность эритрейского автора по имени Халед Абдалла не установлена: точного библиографического совпадения для этой карточки в двух институциональных каталогах не найдено.",
    evidence: [
      ["Library of Congress Catalog", "https://catalog.loc.gov/vwebv/search?searchArg=Khaled%20Abdalla%20Eritrea&searchCode=GKEY%5E*&searchType=0&recCount=25", "Поиск точного имени и страны не выявляет авторитетной записи эритрейского литератора, соответствующего карточке."],
      ["WorldCat", "https://search.worldcat.org/search?q=%22Khaled%20Abdalla%22%20Eritrea", "Сводный библиотечный каталог не позволяет отличить предполагаемого автора от одноимённых лиц и подтвердить заявленную литературную роль."],
    ],
    decision: "held",
    notes: "Identity не установлена; утверждение об арабоязычной литературной традиции не имеет надёжной атрибуции. applicableTextRu оставлен null; shared country files не изменялись.",
  },
  {
    key: "eritrea:rebkah_haile",
    originalSha256: "f1ee65b761072214dbb6d2276d468dda2ba8e946b755ed4bc413bb0874075116",
    reviewedTextRu: "Идентичность эритрейской писательницы по имени Ребка Хайле не установлена: каталоги находят сходные имена, но не подтверждают именно человека и данные этой карточки.",
    evidence: [
      ["Library of Congress Catalog", "https://catalog.loc.gov/vwebv/search?searchArg=Rebkah%20Haile%20Eritrea&searchCode=GKEY%5E*&searchType=0&recCount=25", "Точный поиск не выявляет авторитетной записи, соответствующей написанию имени, стране и году карточки."],
      ["WorldCat", "https://search.worldcat.org/search?q=%22Rebkah%20Haile%22%20Eritrea", "Каталог не подтверждает карточку; найденные сходные записи относятся к другим вариантам имени и не дают надёжного тождества."],
    ],
    decision: "held",
    notes: "Identity не установлена. Не следует смешивать карточку с эфиопско-американской мемуаристкой Rebecca G. Haile. applicableTextRu оставлен null; shared country files не изменялись.",
  },
  {
    key: "estonia:arvo_valton",
    originalSha256: "989ff4424903cfaae7ef657657818c3e22f1de544452532802d13208418dfcd8",
    reviewedTextRu: "Арво Валтон (1935-2024), настоящее имя Арво Валликиви, - эстонский прозаик, поэт, драматург, сценарист и переводчик. С 1968 года он работал профессиональным писателем.",
    evidence: [
      ["Estonian Writers’ Online Dictionary, University of Tartu", "https://ewod.ut.ee/et/v/arvo-valton/", "Университетский словарь подтверждает настоящее имя, годы жизни, жанровые роли и начало профессиональной писательской работы в 1968 году."],
      ["Tallinn University", "https://www.tlu.ee/arvo-valton", "Таллиннский университет независимо подтверждает биографические сведения и многожанровую литературную и переводческую деятельность Валтона."],
    ],
    decision: "corrected",
    notes: "Общее оценочное определение заменено точными биографическими и профессиональными сведениями. Shared country files не изменялись.",
  },
  {
    key: "estonia:betti_alver",
    originalSha256: "75f8eb4f48207c7ce8c9ee088ebf84b06029d360e084edaf54cde2cee1c9425c",
    reviewedTextRu: "Бетти Алвер (1906-1989) - эстонская поэтесса и прозаик. Она входила в литературную группу «Арбуяд» и опубликовала сборник «Пыль и огонь» в 1936 году.",
    evidence: [
      ["Betti Alver Museum", "https://bettimuuseum.ee/betti-alver/", "Музейная биография подтверждает годы жизни, жанровую деятельность, связь с «Арбуяд» и публикацию сборника «Пыль и огонь»."],
      ["Estonian Literary Museum", "https://www.kirmus.ee/et/sundmuste-kalender/betti-alver-bibliograafia-1927-2022-raamatuesitlus", "Литературный музей независимо подтверждает поэтическое и прозаическое наследие Алвер и библиографические данные её публикаций."],
    ],
    decision: "corrected",
    notes: "Слово «известная» заменено конкретными сведениями о литературной группе и сборнике. Shared country files не изменялись.",
  },
  {
    key: "estonia:friedrich_robert_faehlmann",
    originalSha256: "fd2cfbcf0ecb0427ff4e15042353b733fd7c260dc39347e0c3cc45bdcb722b8e",
    reviewedTextRu: "Фридрих Роберт Фельман (1798-1850) - эстонский врач, писатель, исследователь языка и фольклора. Он участвовал в основании Учёного эстонского общества и возглавлял его в 1843-1850 годах.",
    evidence: [
      ["Estonian Writers’ Online Dictionary, University of Tartu", "https://ewod.ut.ee/f/faehlmann/", "Университетский словарь подтверждает профессии Фельмана, его исследования языка и фольклора и работу в Учёном эстонском обществе."],
      ["Estonian Literary Museum", "https://galerii.kirmus.ee/biblioserver/isik/index.php?id=407", "Литературный музей независимо фиксирует биографические даты и роль Фельмана в основании и руководстве обществом."],
    ],
    decision: "corrected",
    notes: "Расплывчатая национально-культурная оценка заменена конкретной институциональной ролью. Date recommendation: источники дают 31/20 XII 1798 по новому/старому стилю; для современной ISO-даты использовать 1798-12-31 либо явно указать календарный вариант. Shared country files не изменялись.",
  },
  {
    key: "eswatini:albert_ncube",
    originalSha256: "dd8c75374434adf093eb90fd9c177b0311157f23e3ab1a1c47d3bef39681da82",
    reviewedTextRu: "Идентичность писателя Эсватини по имени Альберт Нкубе не установлена: институциональные каталоги не подтверждают автора, страну и литературную роль этой карточки.",
    evidence: [
      ["Library of Congress Catalog", "https://catalog.loc.gov/vwebv/search?searchArg=Albert%20Ncube%20Eswatini&searchCode=GKEY%5E*&searchType=0&recCount=25", "Точный поиск имени и страны не выявляет авторитетной записи писателя Эсватини, соответствующего карточке."],
      ["WorldCat", "https://search.worldcat.org/search?q=%22Albert%20Ncube%22%20Eswatini", "Сводный каталог не подтверждает литературную идентичность; одноимённые результаты нельзя надёжно связать с карточкой."],
    ],
    decision: "held",
    notes: "Identity не установлена; найденные одноимённые лица не подтверждают профиль писателя Эсватини. applicableTextRu оставлен null; shared country files не изменялись.",
  },
  {
    key: "eswatini:gladys_lobola",
    originalSha256: "d0648688a9b5085edbb320a4affd19812e063caf96b6e99e08f8afabe99568fd",
    reviewedTextRu: "Идентичность авторки Эсватини по имени Глэдис Лобола не установлена: точного библиографического совпадения для этой карточки в двух институциональных каталогах не найдено.",
    evidence: [
      ["Library of Congress Catalog", "https://catalog.loc.gov/vwebv/search?searchArg=Gladys%20Lobola%20Eswatini&searchCode=GKEY%5E*&searchType=0&recCount=25", "Каталог не содержит точной авторитетной записи, подтверждающей имя, страну и роль из карточки."],
      ["WorldCat", "https://search.worldcat.org/search?q=%22Gladys%20Lobola%22%20Eswatini", "Независимый библиотечный поиск также не устанавливает личность и библиографию предполагаемой авторки."],
    ],
    decision: "held",
    notes: "Identity не установлена; исходное общее описание нельзя публиковать как установленный факт. applicableTextRu оставлен null; shared country files не изменялись.",
  },
  {
    key: "eswatini:sarah_mlotshwa",
    originalSha256: "8b2d25bb2781b622e410cbde12afca657ce4e14dabec01781ee34d5a924cf241",
    reviewedTextRu: "Идентичность писательницы Эсватини по имени Сара Млотшва не установлена: институциональные каталоги не подтверждают человека и произведения, заявленные карточкой.",
    evidence: [
      ["Library of Congress Catalog", "https://catalog.loc.gov/vwebv/search?searchArg=Sarah%20Mlotshwa%20Eswatini&searchCode=GKEY%5E*&searchType=0&recCount=25", "Поиск точного имени и страны не выявляет авторитетной записи, соответствующей карточке."],
      ["WorldCat", "https://search.worldcat.org/search?q=%22Sarah%20Mlotshwa%22%20Eswatini", "Сводный каталог не подтверждает библиографию или произведения предполагаемой писательницы."],
    ],
    decision: "held",
    notes: "Identity не установлена; темы произведений также не доказаны. applicableTextRu оставлен null; shared country files не изменялись.",
  },
  {
    key: "eswatini:stanley_madwe",
    originalSha256: "f4ca33700700a3cc2447960fa2034109b176fbcbfac089eb2da1b1bd786f24c3",
    reviewedTextRu: "Идентичность писателя Эсватини по имени Стэнли Мадве не установлена: точного библиографического совпадения с заявленной поэтической деятельностью в каталогах не найдено.",
    evidence: [
      ["Library of Congress Catalog", "https://catalog.loc.gov/vwebv/search?searchArg=Stanley%20Madwe%20Eswatini&searchCode=GKEY%5E*&searchType=0&recCount=25", "Каталог не выявляет авторитетной записи писателя или поэта с этим именем и привязкой к Эсватини."],
      ["WorldCat", "https://search.worldcat.org/search?q=%22Stanley%20Madwe%22%20Eswatini", "Независимый сводный каталог также не подтверждает заявленную литературную идентичность."],
    ],
    decision: "held",
    notes: "Identity не установлена; исходные профессии не имеют доказательной атрибуции. applicableTextRu оставлен null; shared country files не изменялись.",
  },
  {
    key: "ethiopia:bealu_girma",
    originalSha256: "3703b11af4fdb7f1b5a101bff997e3a0ccb91d913c2e0ace8baa050c6b5236fe",
    reviewedTextRu: "Беалу Гирма - эфиопский журналист и писатель. Он написал роман «Оромай», впервые опубликованный на амхарском языке в 1983 году.",
    evidence: [
      ["Soho Press", "https://sohopress.com/authors/baalu-girma/", "Издательский профиль подтверждает работу Гирмы журналистом и романистом, авторство «Оромая» и первое амхарское издание 1983 года."],
      ["Hachette UK", "https://www.hachette.co.uk/contributor/baalu-girma/", "Независимый издатель подтверждает эфиопское происхождение, журналистскую деятельность и авторство романа Oromay."],
    ],
    decision: "corrected",
    notes: "Оценочное слово «знаменитого» удалено, добавлена проверяемая дата первой публикации. Date recommendation: издательские биографии указывают рождение в 1939 году, а карточка - 1937; рекомендована отдельная правка на 1939 после общей date-очереди. Shared country files не изменялись.",
  },
  {
    key: "ethiopia:daniachew_worku",
    originalSha256: "deb2d26ac59946d291593826dbd5ec44a626708868ff2dd8f0dbb69af9e0e630",
    reviewedTextRu: "Даниячев Ворку - эфиопский писатель, создававший романы и пьесы на амхарском и английском языках. Среди его произведений - роман «The Thirteenth Sun».",
    evidence: [
      ["University of Iowa - International Writing Program", "https://iwp.uiowa.edu/writers/1967/daniachew-worku", "Университетский архив подтверждает эфиопскую принадлежность Ворку, его романы и пьесы и участие в программе 1967 года."],
      ["Addis Ababa University", "https://etd.aau.edu.et/items/9d709493-23dd-4e99-8224-787f47c2cd97", "Университетское исследование независимо рассматривает романы и пьесы Ворку, включая The Thirteenth Sun, на амхарском и английском языках."],
    ],
    decision: "corrected",
    notes: "К слишком общему исходному описанию добавлены подтверждённые языки и произведение. Shared country files не изменялись.",
  },
  {
    key: "ethiopia:hirut_kefele",
    originalSha256: "2b662472a0148c9fde0bcace80cf3271205a25dfabc8061b6ad849878536b33c",
    reviewedTextRu: "Идентичность эфиопской писательницы по имени Хирут Кефеле не установлена: точного совпадения имени, года и литературной роли в институциональных каталогах не найдено.",
    evidence: [
      ["Library of Congress Catalog", "https://catalog.loc.gov/vwebv/search?searchArg=Hirut%20Kefele%20Ethiopia&searchCode=GKEY%5E*&searchType=0&recCount=25", "Поиск имени и страны не выявляет авторитетной записи писательницы, соответствующей карточке."],
      ["WorldCat", "https://search.worldcat.org/search?q=%22Hirut%20Kefele%22%20Ethiopia", "Независимый сводный каталог не подтверждает библиографическую идентичность предполагаемой авторки."],
    ],
    decision: "held",
    notes: "Identity не установлена; исходный текст не содержит доказуемых отличительных фактов. applicableTextRu оставлен null; shared country files не изменялись.",
  },
  {
    key: "ethiopia:kebede_michael",
    originalSha256: "342440e48511673af92d67e7dbdfb76631f867a7dc41a6555c7705dba09fa4f8",
    reviewedTextRu: "Кебеде Микаэль - эфиопский поэт и драматург, писавший на амхарском языке. Его творчество включает стихи, пьесы и учебные материалы.",
    evidence: [
      ["Addis Ababa University", "https://etd.aau.edu.et/items/37232115-78bb-4f31-bb15-1aaecd5aaeef", "Университетское исследование называет Кебеде Микаэля амхарским поэтом и драматургом и рассматривает его стихи, пьесы и учебные материалы."],
      ["WorldCat", "https://search.worldcat.org/search?q=%22Kebede%20Mikael%22", "Сводный библиотечный каталог независимо фиксирует произведения Кебеде Микаэля и их амхарскую языковую принадлежность."],
    ],
    decision: "corrected",
    notes: "Исходный перечень профессий уточнён языком и документированными видами произведений; неподтверждённая роль романиста не добавлялась. Shared country files не изменялись.",
  },
  {
    key: "ethiopia:maaza_mengiste",
    originalSha256: "cae08a3f8550afb58d35558f3db3b718a93dad0da55d8e89a7eef7753e8c15c6",
    reviewedTextRu: "Мааза Менгисте - родившаяся в Аддис-Абебе эфиопско-американская писательница. Она написала романы «Beneath the Lion’s Gaze» и «The Shadow King»; второй вошёл в шорт-лист Букеровской премии 2020 года.",
    evidence: [
      ["Penguin Random House", "https://www.penguinrandomhouse.com/authors/2050634/maaza-mengiste/", "Издательский профиль подтверждает происхождение Менгисте и авторство обоих романов."],
      ["The Booker Prizes", "https://thebookerprizes.com/sites/default/files/2021-09/200915%20The%202020%20Booker%20Prize%20shortlist%20press%20release%20-%20FOR%20IMMEDIATE%20RELEASE.pdf", "Официальный пресс-релиз Букеровской премии подтверждает включение The Shadow King в шорт-лист 2020 года и биографический профиль автора."],
    ],
    decision: "corrected",
    notes: "Общее слово «современная» заменено местом рождения, двумя романами и проверяемым премиальным фактом. Shared country files не изменялись.",
  },
  {
    key: "ethiopia:solomon_deressa",
    originalSha256: "7a7c5d5bbe459c6be4d1761a58c0b009bd35e1bae492f1824c551bc016ea8b49",
    reviewedTextRu: "Соломон Дересса - эфиопский автор, участвовавший в Международной писательской программе Университета Айовы в 1972 году. Его текст «Letter from Addis Ababa» опубликован на английском языке в 1969 году.",
    evidence: [
      ["University of Iowa - International Writing Program", "https://iwp.uiowa.edu/writers/1972/solomon-deressa", "Архив программы подтверждает личность, эфиопскую принадлежность и участие Дерессы в 1972 году."],
      ["WorldCat", "https://search.worldcat.org/title/Letter-from-Addis-Ababa/oclc/40983767", "Библиотечная запись независимо атрибутирует Дерессе англоязычный текст Letter from Addis Ababa и фиксирует публикацию 1969 года."],
    ],
    decision: "corrected",
    notes: "Не подтверждённая двумя источниками роль переводчика заменена точными сведениями о программе и публикации. Shared country files не изменялись.",
  },
  {
    key: "ethiopia:tsegaye_gebre_medhin",
    originalSha256: "3db8f44e15cfc8a36cedf1e8f2bfd1fb9fc21ec7d13556611ada7bc265d04cfd",
    reviewedTextRu: "Цегайе Гебре-Медхин (1936-2006) - эфиопский поэт и драматург. Его литературная и театральная деятельность связана с амхарской поэзией и эфиопской сценой.",
    evidence: [
      ["Aethiopica, Hamburg University Press", "https://journals.sub.uni-hamburg.de/aethiopica/article/view/767", "Академическая публикация подтверждает годы жизни, поэтическую и драматургическую работу Гебре-Медхина и амхарский контекст."],
      ["Fulbright Scholar Program", "https://fulbrightscholars.org/grantee/gebre-medhin-tsegaye", "Официальный профиль программы независимо подтверждает эфиопскую театральную и литературную деятельность автора."],
    ],
    decision: "corrected",
    notes: "Роль переводчика не сохранена без двух прямых подтверждений; итог ограничен доказанными поэзией, драматургией и театральным контекстом. Shared country files не изменялись.",
  },
  {
    key: "fiji:brij_lal",
    originalSha256: "fcfa24b6880811fb5d5e53b511d8a642b5a1da4f9d4a7f3752808ac107b9e5c6",
    reviewedTextRu: "Фиджийский историк, писатель и эссеист индийского происхождения. Автор многочисленных работ об истории Фиджи и судьбе индийской общины страны.",
    evidence: [
      ["Australian National University", "https://www.anu.edu.au/alumni/our-alumni/spotlight/professor-brij-vilash-lal-am", "Университетский профиль подтверждает происхождение Лала, его исторические и литературные работы и специализацию на истории Фиджи и индо-фиджийской общине."],
      ["University of Queensland", "https://hpi.uq.edu.au/article/2022/07/obituary-brij-v-lal-am-faha-officer-order-fiji", "Независимый университетский некролог подтверждает те же профессиональные роли, происхождение и тематику исследований и книг."],
    ],
    decision: "unchanged",
    notes: "Все конкретные утверждения исходного короткого текста подтверждены двумя независимыми университетскими источниками; текст сохранён дословно.",
  },
  {
    key: "fiji:teresia_teaiwa",
    originalSha256: "808cb2d762da7ca0ff4439dad96c5eaf87686b067fa7b449a20944e47478280c",
    reviewedTextRu: "Терезия Теайва (1968-2017) - поэтесса и исследовательница тихоокеанских культур, выросшая на Фиджи. Она преподавала в Университете Южного Тихого океана и Университете Виктории в Веллингтоне.",
    evidence: [
      ["Victoria University of Wellington", "https://tapuaka.wgtn.ac.nz/nodes/view/5359", "Университетский архив подтверждает годы жизни, поэзию, исследования Тихого океана, детство на Фиджи и преподавание в двух университетах."],
      ["UBC Press", "https://www.ubcpress.ca/teresia-kieuea-teaiwa", "Независимый университетский издатель подтверждает поэтическую и академическую деятельность Теайвы и её связи с Фиджи и Веллингтоном."],
    ],
    decision: "corrected",
    notes: "Неточное обозначение писательницей заменено документированными ролями поэтессы и исследовательницы; связь с Фиджи конкретизирована. Shared country files не изменялись.",
  },
  {
    key: "fiji:vijay_mishra",
    originalSha256: "128c9ea090ee91d6b6ab2e2adf026c9b68b42a1c8715bd22cb06c4ac53766f60",
    reviewedTextRu: "Виджай Мишра - родившийся на Фиджи литературовед и исследователь культуры. Его книги посвящены постколониальной литературе, индийской диаспоре, кино и литературной теории.",
    evidence: [
      ["Bloomsbury Publishing", "https://www.bloomsbury.com/au/author/vijay-mishra/", "Издательский профиль подтверждает место рождения, литературоведческую работу и темы книг Мишры."],
      ["Murdoch University", "https://researchportal.murdoch.edu.au/esploro/profile/vijay_mishra/output/all?institution=61MUN_INST", "Университетский исследовательский портал независимо фиксирует публикации о постколониальной литературе, диаспоре, кино и теории."],
    ],
    decision: "corrected",
    notes: "Неподтверждённые «писатель» и «один из заметных» заменены точной академической ролью и предметными областями. Shared country files не изменялись.",
  },
  {
    key: "finland:frans_sillanpaa",
    originalSha256: "5f9d10102cb78a53faf200d899484296a6b00c9a38d7c4feacdd0f014c090fcc",
    reviewedTextRu: "Франс Эмиль Силланпяя (1888-1964) - финский писатель, получивший Нобелевскую премию по литературе в 1939 году. Среди его романов - «Nuorena nukkunut».",
    evidence: [
      ["Nobel Prize", "https://www.nobelprize.org/prizes/literature/1939/sillanpaa/facts/", "Официальная страница премии подтверждает полное имя, годы жизни, финское происхождение и награду 1939 года."],
      ["National Biography of Finland", "https://kansallisbiografia.fi/english/person/700", "Национальный биографический справочник независимо подтверждает биографию Силланпяя и авторство романа Nuorena nukkunut."],
    ],
    decision: "corrected",
    notes: "К точному исходному сообщению добавлены полное имя, годы жизни и один документированный роман. Nobel registry overlap осознанно перепроверен claim-by-claim. Shared country files не изменялись.",
  },
  {
    key: "finland:fredrika_bremer",
    originalSha256: "73cb3ca9e9b2c2173c23e5d35449835ba4dc9beb3f83110ab4cc2d9d6bee5d68",
    reviewedTextRu: "Фредрика Бремер (1801-1865) - шведская писательница, основоположница феминистского движения в Швеции. В романах «Соседи» и «Герта» она обращалась к теме женского равноправия.",
    evidence: [
      ["Nationalmuseum Sweden", "https://collection.nationalmuseum.se/sv/artists/artist/8980/", "Национальный музей подтверждает годы жизни, рождение Бремер в Финляндии и её шведскую писательскую деятельность."],
      ["Svenskt kvinnobiografiskt lexikon, University of Gothenburg", "https://skbl.se/en/article/FredrikaBremer", "Университетский биографический словарь независимо подтверждает даты, шведскую писательскую и общественную деятельность, а также авторство романов Grannarne и Hertha."],
      ["Большая российская энциклопедия", "https://old.bigenc.ru/world_history/text/1883169", "БРЭ подтверждает даты и место рождения, характеризует Бремер как шведскую писательницу и основоположницу феминистского движения в Швеции, а также фиксирует русские названия романов «Соседи» и «Герта».", "2026-08-31"],
    ],
    decision: "corrected",
    notes: "Исправлены смешанные с Фредрикой Рунеберг поля карточки: полное имя, годы жизни 1801-1865, даты 1801-08-17 / 1865-12-31, место рождения, национальность и произведения. Русский текст и формы названий сверены по БРЭ.",
  },
  {
    key: "finland:johan_ludvig_runeberg",
    originalSha256: "dd195aa1edc86cf793687da4f6c76cabd5d78f51425536cde5c18c774174f871",
    reviewedTextRu: "Юхан Людвиг Рунеберг (1804-1877) - финляндский поэт, писавший по-шведски. Его стихотворение «Наш край» стало текстовой основой национального гимна Финляндии.",
    evidence: [
      ["Finland.fi, Ministry for Foreign Affairs of Finland", "https://finland.fi/facts-stats-and-info/the-finnish-national-anthem/", "Официальный государственный портал подтверждает авторство Рунебергом стихотворения Vårt land и его использование как текста национального гимна."],
      ["Porvoo Museum", "https://www.porvoonmuseo.fi/en/nayttely/the-nations-runeberg/", "Музейная биография независимо подтверждает годы жизни, шведский язык поэзии и связь «Нашего края» с гимном Финляндии."],
    ],
    decision: "corrected",
    notes: "Термин «финляндско-шведский» заменён ясной формулой о стране и языке; добавлены годы жизни и точный статус стихотворения. Shared country files не изменялись.",
  },
  {
    key: "finland:mikael_agricola",
    originalSha256: "38a602ac06aff10d87d0b91f667f931292f8c0e2ad10e66e1eb0a9df940fbec1",
    reviewedTextRu: "Микаэль Агрикола (ок. 1510-1557) - финский реформатор, переводчик и создатель ранних печатных книг на финском языке. Его труды заложили основу финского литературного языка.",
    evidence: [
      ["National Library of Finland", "https://kansalliskirjasto.finna.fi/Record/doria.10024_130474", "Национальная библиотека подтверждает ранние финские печатные труды Агриколы, включая букварь и переводческие издания."],
      ["Finnish Literature Society", "https://www.finna.fi/Record/sks_doabooks.19784", "Национальное научное общество независимо подтверждает роль Агриколы в Реформации и формировании финского литературного языка."],
    ],
    decision: "corrected",
    notes: "Категоричное «создатель письменности» заменено точным описанием печатных книг и литературного языка. Identity recommendation: Q215346 подтверждает нужную личность. Date recommendation: год рождения в источниках приблизителен и варьирует около 1508-1510; сохранять «ок. 1510», не выдавая точный день. Shared country files не изменялись.",
  },
  {
    key: "finland:minna_canth",
    originalSha256: "733d94ba5c9a682ec872b4442d4591b0229c448f36ac6f589dbea223e6267212",
    reviewedTextRu: "Минна Кант (1844-1897) - финская писательница, драматург и переводчица, связанная с развитием финского реализма. Она также работала журналисткой и участвовала в общественной дискуссии.",
    evidence: [
      ["Kanttila cultural heritage site", "https://kanttila.fi/en/history/minna-canth/", "Музейно-культурная биография подтверждает даты, литературные роли, журналистику, общественную деятельность и вклад Кант в финский реализм."],
      ["National Library of Finland", "https://kansalliskirjasto.finna.fi/AuthorityRecord/melinda.%28FI-ASTERI-N%29000149842/AuthorityRecordsAuthor?lng=en-gb", "Национальная библиотека независимо подтверждает годы жизни и профессии писательницы, драматурга и переводчицы и связывает её с финской литературой."],
    ],
    decision: "corrected",
    notes: "Недоказуемое «одна из главных фигур» заменено конкретными профессиональными и общественными ролями. Shared country files не изменялись.",
  },
  {
    key: "finland:tove_jansson",
    originalSha256: "411a7181ef5fae636b7ca9fd250abffbc54fd739d889227171a6cfd1ad14f85c",
    reviewedTextRu: "Туве Янссон (1914-2001) - финская писательница и художница, писавшая по-шведски. Она создала книги и комиксы о муми-троллях и также публиковала прозу для взрослых.",
    evidence: [
      ["Tove Jansson estate", "https://tovejansson.com/biography/", "Официальная биография наследия подтверждает годы жизни, шведский язык, работу писательницы и художницы, книги и комиксы о муми-троллях и взрослую прозу."],
      ["National Library of Finland", "https://kansalliskirjasto.finna.fi/AuthorityRecord/melinda.%28FI-ASTERI-N%29000045590", "Национальная библиотека независимо фиксирует биографические даты, профессии и шведоязычные произведения Янссон."],
    ],
    decision: "corrected",
    notes: "К корректному исходному факту добавлены годы жизни, работа художницы, комиксы и взрослая проза. Shared country files не изменялись.",
  },
  {
    key: "finland:vaino_linna",
    originalSha256: "46b32a9fcb2fc83e5a9c610dad3cf74dd0c881dcb9dfbed3677c2ef48e5258ca",
    reviewedTextRu: "Вяйнё Линна (1920-1992) - финский писатель. Он написал романы «Неизвестный солдат» и трилогию «Здесь, под Полярной звездой».",
    evidence: [
      ["Bonnier Rights Finland", "https://www.bonnierrights.fi/authors/vaino-linna/", "Правообладатель подтверждает годы жизни, финскую писательскую деятельность и авторство двух названных произведений."],
      ["National Library of Finland", "https://kansalliskirjasto.finna.fi/kansalliskirjastofikka/AuthorityRecord/melinda.%28FI-ASTERI-N%29000067929", "Национальная библиотека независимо подтверждает биографические данные Линны и атрибуцию его произведений."],
    ],
    decision: "corrected",
    notes: "Субъективный суперлатив заменён годами жизни и двумя документированными произведениями. Shared country files не изменялись.",
  },
  {
    key: "france:albert_camus",
    originalSha256: "3365feb91bcad0b0276fe9e3000dcf8e2c8b600cbfb3cdba150a7c822c423ccf",
    reviewedTextRu: "Альбер Камю (1913-1960) - французский писатель, драматург, эссеист и журналист, родившийся в Алжире. В 1957 году он получил Нобелевскую премию по литературе.",
    evidence: [
      ["Nobel Prize", "https://www.nobelprize.org/prizes/literature/1957/camus/facts/", "Официальная страница премии подтверждает годы жизни, место рождения, литературные роли и Нобелевскую премию 1957 года."],
      ["Bibliothèque nationale de France", "https://www.bnf.fr/fr/albert-camus-1913-1960-bibliographie", "Национальная библиотека Франции независимо подтверждает биографию Камю и его деятельность писателя, драматурга, эссеиста и журналиста."],
    ],
    decision: "corrected",
    notes: "Суперлатив и спорная школа «литературы абсурда» заменены точными ролями, местом рождения и наградой. Nobel registry overlap осознанно перепроверен claim-by-claim. Shared country files не изменялись.",
  },
  {
    key: "france:alexandre_dumas",
    originalSha256: "cc3a27b1aeabcd83116122d7749d560aa8255915f497669f53415cbee93e07c2",
    reviewedTextRu: "Александр Дюма (1802-1870) - французский писатель и драматург. Он написал приключенческие романы «Три мушкетёра» и «Граф Монте-Кристо».",
    evidence: [
      ["Hachette BnF", "https://www.hachettebnf.fr/auteur/alexandre-dumas/", "Издательский профиль подтверждает годы жизни, французскую литературную и драматургическую деятельность и авторство названных романов."],
      ["Bibliothèque nationale de France", "https://catalogue.bnf.fr/rechercher.do?critereRecherche=0&depart=0&motRecherche=Alexandre+Dumas+%281802-1870%29", "Каталог национальной библиотеки независимо фиксирует годы жизни Дюма и записи «Трёх мушкетёров» и «Графа Монте-Кристо» под его авторством."],
    ],
    decision: "corrected",
    notes: "Субъективная популярность заменена годами жизни и двумя проверяемыми приключенческими романами. Shared country files не изменялись.",
  },
  {
    key: "france:anatole_france",
    originalSha256: "ef07e3931d22c533cca785901e1b27b447b694c512a5c8c90b0aacf21463ac36",
    reviewedTextRu: "Французский писатель, критик и историк литературы, лауреат Нобелевской премии по литературе 1921 года.",
    evidence: [
      ["Nobel Prize", "https://www.nobelprize.org/prizes/literature/1921/summary/", "Официальная страница подтверждает присуждение Анатолю Франсу Нобелевской премии по литературе в 1921 году и его писательскую деятельность."],
      ["Académie française", "https://www.academie-francaise.fr/les-immortels/anatole-france", "Французская академия независимо подтверждает работу Франса как писателя, критика и историка литературы и фиксирует Нобелевскую премию."],
    ],
    decision: "unchanged",
    notes: "Все конкретные утверждения исходного короткого текста подтверждены двумя независимыми официальными институтами; текст сохранён дословно. Nobel overlap перепроверен claim-by-claim.",
  },
  {
    key: "france:andre_gide",
    originalSha256: "4930753a6902315b259b24a45d07215bf4a3f4b2e8cda061bd334acb634c4c27",
    reviewedTextRu: "Французский писатель и мыслитель, лауреат Нобелевской премии по литературе 1947 года.",
    evidence: [
      ["Nobel Prize", "https://www.nobelprize.org/prizes/literature/1947/gide/biographical/", "Официальная биография подтверждает французскую писательскую и интеллектуальную деятельность Жида и премию 1947 года."],
      ["Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark%3A/12148/cb11904849c", "Национальная библиотека Франции независимо подтверждает личность, годы деятельности и литературные труды Андре Жида."],
    ],
    decision: "unchanged",
    notes: "Исходный короткий текст фактологически точен и сохранён дословно; Нобелевский статус перепроверен официально и независимым национальным каталогом.",
  },
  {
    key: "france:annie_ernaux",
    originalSha256: "1bbe9ff3681d5344c9bf9888fa8bb833f27fc4a822d41f03ad9c0c6ce7df628f",
    reviewedTextRu: "Французская писательница, лауреат Нобелевской премии по литературе 2022 года.",
    evidence: [
      ["Nobel Prize", "https://www.nobelprize.org/prizes/literature/2022/ernaux/biographical/", "Официальная биография подтверждает французскую писательскую деятельность Эрно и присуждение Нобелевской премии 2022 года."],
      ["Bibliothèque nationale de France", "https://www.bnf.fr/fr/annie-ernaux-prix-nobel-de-litterature-2022-bibliographie", "Национальная библиотека Франции независимо подтверждает профессию, национальную принадлежность и премию 2022 года."],
    ],
    decision: "unchanged",
    notes: "Все конкретные утверждения исходного текста подтверждены двумя официальными источниками; текст сохранён дословно. Nobel overlap перепроверен claim-by-claim.",
  },
] satisfies readonly ReviewSeed[];

function finalizeReviewRecord(seed: ReviewSeed): WriterBiographyFactReviewRecord {
  const verdict: WriterBiographyClaimVerdict =
    seed.decision === "held"
      ? "not-established"
      : seed.decision === "unchanged"
        ? "supported"
        : "corrected";

  return {
    key: seed.key,
    originalSha256: seed.originalSha256,
    reviewedTextRu: seed.reviewedTextRu,
    applicableTextRu: seed.decision === "held" ? null : seed.reviewedTextRu,
    claims: [{
      textRu: seed.reviewedTextRu,
      verdict,
      evidence: seed.evidence.map(([provider, url, findingRu, evidenceCheckedAt]) => ({
        provider,
        url,
        checkedAt: evidenceCheckedAt || checkedAt,
        findingRu,
      })),
    }],
    reviewer,
    decision: seed.decision,
    notes: seed.notes,
  };
}

export const writerBiographyFactReviewBatch27: readonly WriterBiographyFactReviewRecord[] =
  seeds.map(finalizeReviewRecord);
