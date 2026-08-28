export const WRITER_BIOGRAPHY_FACT_REVIEW_BATCH13_REVIEWER =
  "Codex independent claim-by-claim factual review, batch 13";

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

const reviewer = WRITER_BIOGRAPHY_FACT_REVIEW_BATCH13_REVIEWER;
const checkedAt = "2026-08-09";

type ReviewBase = Omit<WriterBiographyFactReviewRecord, "applicableTextRu">;

const writerBiographyFactReviewBatch13Base = [
  {
    key: "belgium:michel_de_ghelderode",
    originalSha256: "945cfdea7c25a0f542501890c6d2125e5adaa1506c32e602e0f4952ce36b771f",
    reviewedTextRu: "Бельгийский франкоязычный драматург и прозаик, публиковавшийся под именем Мишель де Гельдерод. Среди его произведений - пьеса «Magie rouge».",
    claims: [{
      textRu: "Мишель де Гельдерод был бельгийским франкоязычным драматургом и прозаиком; пьеса «Magie rouge» входит в его библиографию.",
      verdict: "corrected",
      evidence: [
        { provider: "Bibliothèque nationale de France", url: "https://catalogue.bnf.fr/ark:/12148/cb11898885w", checkedAt, findingRu: "Национальная библиотека Франции идентифицирует Мишеля де Гельдерода как бельгийского франкоязычного драматурга и романиста." },
        { provider: "Archives & Musée de la Littérature", url: "https://aml-cfwb.be/expositions/cabinet-michel-de-ghelderode/", checkedAt, findingRu: "Бельгийский литературный архив подтверждает авторскую идентичность, даты жизни и драматургическое наследие Гельдерода, включая Magie rouge." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Исходная корректная роль уточнена указанием на прозу, авторское имя и документированную пьесу; оценочные ранги не добавлялись. Shared country files не изменялись.",
  },
  {
    key: "belize:colville_young",
    originalSha256: "b40fffe6be50b7b10c1e7a37df9a18c05757e00e71f573b362d179ae671f083b",
    reviewedTextRu: "Белизский писатель, музыкант и педагог, занимавший пост генерал-губернатора Белиза в 1993-2021 годах. Автор сборника рассказов «Pataki Full».",
    claims: [{
      textRu: "Колвилл Янг - белизский писатель, музыкант и педагог, бывший генерал-губернатор страны и автор сборника рассказов «Pataki Full».",
      verdict: "corrected",
      evidence: [
        { provider: "Belize National Library Service and Information System", url: "https://www.bnlsis.org/belizeanbiographies", checkedAt, findingRu: "Национальная библиотека Белиза подтверждает литературную, музыкальную и педагогическую деятельность Янга, его государственную должность и включает Pataki Full в список публикаций." },
        { provider: "The University of the West Indies", url: "https://www.mona.uwi.edu/marcom/newsroom/entry/2930", checkedAt, findingRu: "Университетская биография подтверждает работу Янга в образовании, литературе и музыке и его службу генерал-губернатором Белиза." },
        { provider: "Cubola Productions", url: "https://www.cubola.com/books/p/pataki-full", checkedAt, findingRu: "Белизский издатель атрибутирует Колвиллу Янгу сборник рассказов Pataki Full." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Субъективное определение места в культуре заменено профессиями, государственной должностью и конкретной книгой. Shared country files не изменялись.",
  },
  {
    key: "belize:glen_godfrey",
    originalSha256: "f8e4e741a8fe263638e35f7270dd8cf7efff6cd8c28ecfcd0533109f000ec682",
    reviewedTextRu: "Белизский юрист, государственный деятель и писатель Гленн Д. Годфри. Автор романа «The Sinner’s Bossanova»; в 1969 году его радиопьеса победила в белизском конкурсе.",
    claims: [{
      textRu: "Установленный автор карточки - белизский юрист и писатель Гленн Д. Годфри, автор «The Sinner’s Bossanova» и победитель конкурса радиопьес 1969 года.",
      verdict: "corrected",
      evidence: [
        { provider: "Glenn D. Godfrey & Company LLP", url: "https://godfreylaw.net/team/glenn-d-godfrey/", checkedAt, findingRu: "Официальная профессиональная биография подтверждает полное имя Гленн Д. Годфри, его юридическую и государственную карьеру и литературную работу." },
        { provider: "Belize Archives and Records Service", url: "https://archives.gov.bz/british-honduras-newsletter/", checkedAt, findingRu: "Государственный архив сохраняет выпуск British Honduras Newsletter с сообщением о победе Glenn Godfrey в конкурсе радиопьес в 1969 году." },
        { provider: "University of Cincinnati", url: "https://scholar.uc.edu/downloads/rn301260d?locale=en", checkedAt, findingRu: "Университетское литературоведческое издание атрибутирует Гленну Годфри роман The Sinner’s Bossanova." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Identity recommendation: заменить отображаемое Glen Godfrey на Glenn D. Godfrey. Дата рождения 1954-01-01 и прежние общие названия произведений институционально не подтверждены; дату следует удалить либо перепроверить. Shared country files не изменялись.",
  },
  {
    key: "belize:zee_edgell",
    originalSha256: "d9e36128dda5afb6d726b079d61467a0d294651a132969ac94143cb3941d5d51",
    reviewedTextRu: "Белизская писательница и преподавательница. Автор романов «Beka Lamb», «In Times Like These», «The Festival of San Joaquin» и «Time and the River»; «Beka Lamb» получил премию Fawcett Society в 1983 году.",
    claims: [{
      textRu: "Зи Эджелл была белизской писательницей и преподавательницей, автором четырёх названных романов; Beka Lamb получил премию Fawcett Society 1983 года.",
      verdict: "corrected",
      evidence: [
        { provider: "The University of the West Indies Global Campus", url: "https://global.uwi.edu/news/uwi-expresses-condolences-passing-professor-zee-edgell", checkedAt, findingRu: "Университетский некролог подтверждает профессию, преподавательскую работу, полную романную библиографию, премию Beka Lamb и точные даты жизни 21 октября 1940 - 20 декабря 2020." },
        { provider: "Belize National Library Service and Information System", url: "https://www.bnlsis.org/belizeanbiographies", checkedAt, findingRu: "Национальная библиотека Белиза независимо документирует биографию и литературную деятельность Зи Эджелл." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Date recommendation: заменить shared birthDate 1940-01-21 на 1940-10-21 и deathDate 2020-01-01 на 2020-12-20. Оценочное ранжирование снято. Shared country files не изменялись.",
  },
  {
    key: "bhutan:dzongsar_khyentse",
    originalSha256: "ea28c2b7e7af222c3c6e8765d2ca2410fd8784ab3177194eca08c24f7baf4c6a",
    reviewedTextRu: "Родившийся в Бутане буддийский учитель, автор книг и кинорежиссёр, также известный как Кхьенце Норбу. Написал книгу «What Makes You Not a Buddhist» о базовых положениях буддийского учения.",
    claims: [{
      textRu: "Дзонгсар Джамьянг Кхьенце родился в Бутане, известен также как режиссёр Кхьенце Норбу и написал книгу «What Makes You Not a Buddhist» о положениях буддизма.",
      verdict: "corrected",
      evidence: [
        { provider: "Khyentse Foundation", url: "https://khyentsefoundation.org/who-we-are/dzongsar-jamyang-khyentse-rinpoche/", checkedAt, findingRu: "Официальный фонд подтверждает рождение в Бутане, деятельность буддийского учителя, автора и режиссёра под именем Кхьенце Норбу." },
        { provider: "Shambhala Publications", url: "https://www.shambhala.com/what-makes-you-not-a-buddhist.html", checkedAt, findingRu: "Издатель подтверждает авторство книги и описывает её содержание как разъяснение основных положений буддийского учения." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Национальная формула уточнена как место рождения, поскольку источники описывают тибетского буддийского ламу; добавлены документированные имя режиссёра и книга. Shared country files не изменялись.",
  },
  {
    key: "bhutan:kunzang_choden",
    originalSha256: "feb9cdc87e04cba714c710604196f222dd3e66807e9f9c9f667e54b7749a5618",
    reviewedTextRu: "Бутанская писательница, родившаяся в 1952 году в Бумтанге. Её «The Circle of Karma» стал первым англоязычным романом, написанным женщиной из Бутана.",
    claims: [{
      textRu: "Кунзанг Чоден родилась в Бумтанге в 1952 году; The Circle of Karma - первый англоязычный роман, написанный женщиной из Бутана.",
      verdict: "corrected",
      evidence: [
        { provider: "The University of Chicago Press", url: "https://press.uchicago.edu/ucp/books/author/C/K/au16937173.html", checkedAt, findingRu: "Университетское издательство фиксирует место и год рождения, называет Чоден первой бутанской женщиной, написавшей роман на английском, и атрибутирует The Circle of Karma." },
        { provider: "Bhutan Broadcasting Service", url: "https://www.bbs.bt/20149/", checkedAt, findingRu: "Национальная телерадиокомпания Бутана подтверждает авторство The Circle of Karma и другие книги и рассказы Кунзанг Чоден." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Расплывчатое международное признание заменено проверяемыми местом и годом рождения и библиографическим первенством. Shared country files не изменялись.",
  },
  {
    key: "bhutan:pema_lingpa",
    originalSha256: "8dcb4f4983dad0991f403964a3bf256b04cfcec7b8d59035ffbe591a9b83d31f",
    reviewedTextRu: "Бутанский буддийский учитель Пема Лингпа (1450-1521), связанный со школой ньингма, был тертоном - открывателем религиозных «сокровищ» терма. Его наследие включает учения, религиозные тексты и художественные работы.",
    claims: [{
      textRu: "Пема Лингпа был бутанским буддийским учителем школы ньингма и тертоном 1450-1521 годов; его наследие включает тексты, учения и художественные работы.",
      verdict: "corrected",
      evidence: [
        { provider: "University of Cambridge, Mongolia and Inner Asia Studies Unit", url: "https://www.miasu.socanth.cam.ac.uk/projects/padgling", checkedAt, findingRu: "Университетский исследовательский проект подтверждает даты, бутанский контекст, связь Пема Лингпы с ньингма и его наследие как открывателя терма, учителя и художника." },
        { provider: "Himalayan Art Resources", url: "https://www.himalayanart.org/search/set.cfm?setID=6265", checkedAt, findingRu: "Научный ресурс по гималайскому искусству подтверждает биографию Пема Лингпы, его статус тертона и религиозно-художественную деятельность." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Недоказательные формулы «один из величайших» и «поэт» сняты; сохранены подтверждённые религиозная роль, школа, даты и характер наследия. Shared country files не изменялись.",
  },
  {
    key: "bolivia:bartolome_arsans_de_orsua_y_vela",
    originalSha256: "5599580d2426c727997be7713336a8b2656e8e725fcdc3af00de190499457d82",
    reviewedTextRu: "Бартоломе Арсанс де Орсуа-и-Вела (1676-1736) - хронист из Потоси. Его «Historia de la Villa Imperial de Potosí» охватывает события 1545-1735 годов и служит источником по истории колониального Потоси.",
    claims: [{
      textRu: "Бартоломе Арсанс де Орсуа-и-Вела жил в 1676-1736 годах, был хронистом из Потоси и написал историю города, охватывающую 1545-1735 годы.",
      verdict: "corrected",
      evidence: [
        { provider: "Universidad Mayor de San Andrés", url: "https://ojs.umsa.bo/index.php/estudiosbolivianos/article/download/1286/986", checkedAt, findingRu: "Университетское исследование приводит даты 1676-1736, идентифицирует Арсанса как хрониста Потоси и описывает его Historia de la Villa Imperial de Potosí." },
        { provider: "Biblioteca Virtual Miguel de Cervantes", url: "https://www.cervantesvirtual.com/portales/portal_nacional_bolivia/presentacion/", checkedAt, findingRu: "Национальный портал Боливии в библиотеке Сервантеса включает хронику Арсанса в канон документальных источников по колониальному Потоси." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Date recommendation: заменить shared birthDate 1579 на 1676 и deathDate 1636 на 1736. Ранг среди историков и ошибочная привязка к XVII веку сняты. Shared country files не изменялись.",
  },
  {
    key: "bolivia:gaston_suarez",
    originalSha256: "f6b98da8881210fac0b7dce53b8502f869459f19dec318139439b0916642eec0",
    reviewedTextRu: "Боливийский прозаик и драматург. Автор повести о молодом кондоре «Mallko» и пьесы «Vértigo».",
    claims: [{
      textRu: "Гастон Суарес был боливийским прозаиком и драматургом, автором повести «Mallko» и пьесы «Vértigo».",
      verdict: "corrected",
      evidence: [
        { provider: "Academia Boliviana de la Lengua", url: "https://www.academiadelalengua-bo.org/IMG/pdf/anales_20.pdf", checkedAt, findingRu: "Издание Боливийской академии языка подтверждает литературную деятельность Суареса и атрибутирует ему Mallko." },
        { provider: "Parlamento Andino", url: "https://www.parlamentoandino.org/index.php/centro-de-documentacion/noticias/2034-gran-exponente-de-la-literatura-boliviana-gaston-suarez", checkedAt, findingRu: "Межгосударственный культурный материал идентифицирует Суареса как боливийского прозаика и драматурга и документирует Mallko и Vértigo." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Оценочный ранг и неподтверждённая в выбранных источниках роль журналиста заменены двумя литературными ролями и произведениями; прежние названия «Матуне» и «Виктория» не подтверждены. Shared country files не изменялись.",
  },
  {
    key: "bolivia:hilda_mundy",
    originalSha256: "54edf695407cb3efda26391a20f26111f6f128bf127a89616147506403d12ed8",
    reviewedTextRu: "Хильда Мунди - псевдоним боливийской писательницы, поэтессы и журналистки Лауры Вильянуэвы Рокабадо. Её книга «Pirotecnia» (1936) и газетные тексты относятся к боливийскому авангарду периода Чакской войны и послевоенных лет.",
    claims: [{
      textRu: "Хильда Мунди - псевдоним Лауры Вильянуэвы Рокабадо, боливийской писательницы, поэтессы и журналистки; Pirotecnia 1936 года относится к её авангардному наследию.",
      verdict: "corrected",
      evidence: [
        { provider: "Universidad Mayor de San Andrés", url: "https://ojs.umsa.bo/index.php/estudiosbolivianos/article/view/1169", checkedAt, findingRu: "Университетское исследование подтверждает настоящее имя, профессии, даты и место Pirotecnia в боливийском авангарде." },
        { provider: "Vicepresidencia del Estado Plurinacional de Bolivia", url: "https://www.vicepresidencia.gob.bo/IMG/pdf/20250415_catalogo_bbb.pdf", checkedAt, findingRu: "Официальный каталог Biblioteca del Bicentenario de Bolivia фиксирует автора Хильду Мунди и издание её собрания текстов, включая Pirotecnia." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Уточнены настоящее имя, точное название и дата книги; обобщённое «Авангардные тексты» заменено конкретным корпусом. Shared country files не изменялись.",
  },
  {
    key: "bolivia:jesus_lara",
    originalSha256: "29deb6b5b9e3ecd8d442802f8c79b42da4bec127a4598f567224db43c7937d4f",
    reviewedTextRu: "Боливийский писатель и исследователь литературы на языке кечуа. Автор романов «Yanakuna» и «Surumi» и работ о поэзии кечуа.",
    claims: [{
      textRu: "Хесус Лара был боливийским писателем и исследователем литературы кечуа, автором романов Yanakuna и Surumi и научных работ о поэзии кечуа.",
      verdict: "corrected",
      evidence: [
        { provider: "Universidad Mayor de San Andrés", url: "https://ojs.umsa.bo/index.php/estudiosbolivianos/article/download/1178/897/2300", checkedAt, findingRu: "Университетская публикация подтверждает даты, писательскую деятельность Лары и роман Yanakuna." },
        { provider: "Vicepresidencia del Estado Plurinacional de Bolivia", url: "https://www.vicepresidencia.gob.bo/IMG/pdf/20250415_catalogo_bbb.pdf", checkedAt, findingRu: "Официальный каталог боливийской библиотеки документирует Yanakuna и другие книги Хесуса Лары." },
        { provider: "Universidad Mayor de San Andrés, Estudios Bolivianos", url: "https://ojs.umsa.bo/index.php/estudiosbolivianos/article/download/1128/869/2218", checkedAt, findingRu: "Исследование УМСА рассматривает вклад Лары в изучение и публикацию поэзии на языке кечуа." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Сравнительный ранг снят; национальность, литературная работа и исследования кечуа конкретизированы произведениями. Shared country files не изменялись.",
  },
  {
    key: "bolivia:marcelo_quiroga_santa_cruz",
    originalSha256: "1d82c9b6ce72a6289f5176c40238e958dad1d4dc80d3f851fb9eb2b6dfdce009",
    reviewedTextRu: "Боливийский писатель, публицист и политический деятель. Автор романа «Los deshabitados» (1959) и политических текстов.",
    claims: [{
      textRu: "Марсело Кирога Санта-Крус был боливийским писателем, публицистом и политическим деятелем и написал роман Los deshabitados, опубликованный в 1959 году.",
      verdict: "corrected",
      evidence: [
        { provider: "Universidad Mayor de San Andrés, Fuentes Documentales", url: "https://revistasbolivianas.umsa.bo/pdf/fdc/v11n51/v11n51_a10.pdf", checkedAt, findingRu: "Университетское архивное издание подтверждает годы жизни и литературно-политическую деятельность Кироги Санта-Круса." },
        { provider: "Vicepresidencia del Estado Plurinacional de Bolivia", url: "https://www.vicepresidencia.gob.bo/IMG/pdf/migrana-05.pdf", checkedAt, findingRu: "Официальное культурное издание анализирует роман Los deshabitados и фиксирует его публикацию в 1959 году." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Оценочное описание интеллектуальной роли заменено конкретной литературной и политической деятельностью. Прежние названия «Струна ветра», «Отчуждение» и «Три шага к морю» не подтверждены и заменены документированным романом. Shared country files не изменялись.",
  },
  {
    key: "bolivia:nataniel_aguirre",
    originalSha256: "65446e24866d051541d6b94d34cf91b43862abae8fa6e14785984e79a5e3527e",
    reviewedTextRu: "Боливийский писатель и политический деятель XIX века. Автор исторического романа «Juan de la Rosa: memorias del último soldado de la Independencia», посвящённого борьбе за независимость в Верхнем Перу.",
    claims: [{
      textRu: "Натаниэль Агирре был боливийским писателем и политическим деятелем и написал исторический роман Juan de la Rosa о борьбе за независимость в Верхнем Перу.",
      verdict: "corrected",
      evidence: [
        { provider: "Biblioteca Virtual Miguel de Cervantes", url: "https://www.cervantesvirtual.com/obras/autor/aguirre-nataniel-1843-1888-2794/", checkedAt, findingRu: "Авторитетная цифровая библиотека фиксирует биографию Агирре, его политическую деятельность и авторство Juan de la Rosa." },
        { provider: "Vicepresidencia del Estado Plurinacional de Bolivia, Biblioteca y Archivo Histórico", url: "https://bibliotecayarchivo.vicepresidencia.gob.bo/opac_web/?search=k8%2FO&ind=Nataniel+Aguirre", checkedAt, findingRu: "Государственный библиотечный каталог Боливии документирует издания Juan de la Rosa и атрибутирует их Натаниэлю Агирре." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Субъективное ранжирование романа снято; роли историка и дипломата не включены без необходимости, оставлены подтверждённые писательская и политическая деятельность и точное название. Shared country files не изменялись.",
  },
  {
    key: "bolivia:oscar_cerruto",
    originalSha256: "f196efcbf5999d16381339cde9ed80bc957776a17533fe943b640b17f626fd79",
    reviewedTextRu: "Боливийский поэт, прозаик, журналист и дипломат. Автор романа «Aluvión de fuego», сборника рассказов «Cerco de penumbras» и поэтической книги «Patria de sal cautiva».",
    claims: [{
      textRu: "Оскар Серруто был боливийским поэтом, прозаиком, журналистом и дипломатом и написал Aluvión de fuego, Cerco de penumbras и Patria de sal cautiva.",
      verdict: "corrected",
      evidence: [
        { provider: "Library of Congress", url: "https://www.loc.gov/item/n87887414/oscar-cerruto/", checkedAt, findingRu: "Авторитетная запись Библиотеки Конгресса подтверждает национальность, литературные роли, дипломатическую деятельность и три названных произведения." },
        { provider: "University of Oregon, Archivo Óscar Cerruto", url: "https://pages.uoregon.edu/lgarcia/Cerruto/vida.html", checkedAt, findingRu: "Университетский авторский архив подтверждает биографию, произведения и точную дату рождения 13 июня 1912 года." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Date queue recommendation: заменить shared birthDate 1912-10-13 на 1912-06-13. Прежние названия произведений заменены документированной библиографией; оценочная формула снята. Shared country files не изменялись.",
  },
  {
    key: "bolivia:vilma_tapia_anda",
    originalSha256: "2971cf401233e44f5a1bee3f3efaa37be482d4805b0ac7fab117364a5658a492",
    reviewedTextRu: "Боливийская поэтесса и автор прозы Вильма Тапиа Анайя, родившаяся в Ла-Пасе в 1960 году. Среди её книг - «La fiesta de mi boda», «El agua más cercana» и «La hierba es un niño».",
    claims: [{
      textRu: "Вильма Тапиа Анайя - боливийская поэтесса и прозаик, родившаяся в Ла-Пасе в 1960 году, автор трёх названных книг.",
      verdict: "corrected",
      evidence: [
        { provider: "Goethe-Institut Bolivia", url: "https://www.goethe.de/ins/bo/es/kul/kui/bol/aut/vta.html", checkedAt, findingRu: "Институциональная авторская страница подтверждает полное имя Vilma Tapia Anaya, рождение в Ла-Пасе в 1960 году, литературные роли и библиографию." },
        { provider: "Archivo y Biblioteca Nacionales de Bolivia", url: "https://www.archivoybibliotecanacionales.org.bo/images/Contenido/biblioteca/bibliografia-boliviana/BibliografiaBoliviana2006.pdf", checkedAt, findingRu: "Национальная библиография фиксирует Vilma Tapia Anaya (1960-) и её книгу La fiesta de mi boda." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Identity/date recommendation: исправить displayName и key-derived identity с Vilma Tapia Anda на Vilma Tapia Anaya и shared birthDate 1950-10-25 на год 1960 без вымышленного дня и месяца. Роль юриста и прежние произведения не подтверждены выбранными источниками. Shared country files не изменялись.",
  },
  {
    key: "bolivia:yolanda_bedregal",
    originalSha256: "7d7c99f2b0fd379e782280fc089483a873480b042dc4965c303b27dd611d2ac6",
    reviewedTextRu: "Боливийская поэтесса, прозаик и деятель культуры. Автор книг «Naufragio», «Poemar», «Nadir» и романа «Bajo el oscuro sol».",
    claims: [{
      textRu: "Йоланда Бедрегаль была боливийской поэтессой, прозаиком и деятелем культуры и написала Naufragio, Poemar, Nadir и роман Bajo el oscuro sol.",
      verdict: "corrected",
      evidence: [
        { provider: "Library of Congress", url: "https://www.loc.gov/item/93842419/", checkedAt, findingRu: "Запись Библиотеки Конгресса подтверждает боливийскую литературную идентичность Бедрегаль, годы жизни и перечисленные произведения." },
        { provider: "Servicio Estatal de Autonomías de Bolivia", url: "https://upload.wikimedia.org/wikipedia/commons/4/48/Mujeres_en_nuestra_historia.pdf", checkedAt, findingRu: "Официальное государственное издание о женщинах в истории Боливии подтверждает роли Бедрегаль и точную дату рождения 21 сентября 1913 года." },
        { provider: "Universidad Mayor de San Andrés", url: "https://ojs.umsa.bo/index.php/soc_idis_ts/article/view/132/114", checkedAt, findingRu: "Университетское исследование независимо подтверждает биографию 1913-1999 и литературное наследие Бедрегаль." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Date recommendation: заменить shared birthDate 1916-09-21 на 1913-09-21. Сравнительное ранжирование снято, названия книг приведены по библиотечной библиографии. Shared country files не изменялись.",
  },
  {
    key: "bosnia:aleksandar_hemon",
    originalSha256: "96322cf53bf43a5d720410dac1ae646e2ded6159e33f02b665f0d0e64eb8ee05",
    reviewedTextRu: "Боснийско-американский писатель, родившийся в Сараеве и с 1992 года живущий в США. Автор романа «The Lazarus Project» и книг прозы «The Question of Bruno», «Nowhere Man» и «Love and Obstacles».",
    claims: [{
      textRu: "Александар Хемон родился в Сараеве, переехал в США в 1992 году и написал The Lazarus Project, The Question of Bruno, Nowhere Man и Love and Obstacles.",
      verdict: "corrected",
      evidence: [
        { provider: "MacArthur Foundation", url: "https://www.macfound.org/fellows/class-of-2004/aleksandar-hemon", checkedAt, findingRu: "Фонд подтверждает сараевское происхождение, переезд в Чикаго в 1992 году и раннюю англоязычную библиографию Хемона." },
        { provider: "Princeton University", url: "https://research.princeton.edu/news/deaton-hemon-named-great-immigrants-contributions-american-society", checkedAt, findingRu: "Университетская биография подтверждает боснийско-американскую идентичность, место рождения, переезд и книги автора." },
        { provider: "Penguin Random House", url: "https://www.penguinrandomhouse.com/books/292630/the-lazarus-project-by-aleksandar-hemon/", checkedAt, findingRu: "Издатель атрибутирует Хемону роман The Lazarus Project и подтверждает его авторскую биографию." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Краткая исходная формула дополнена проверяемым местом рождения, миграцией и библиографией без оценочных характеристик. Shared country files не изменялись.",
  },
  {
    key: "bosnia:mehmed_beg_kapetanovic",
    originalSha256: "3310191dd2b887149f4bb7daa7b4a7a5b0859c747995b06a52ba4d7ec4431c45",
    reviewedTextRu: "Боснийский писатель, публицист и собиратель устного народного творчества. Составил сборники «Narodno blago» и «Istočno blago».",
    claims: [{
      textRu: "Мехмед-бег Капетанович Любушак был боснийским писателем, публицистом и собирателем фольклора и составил Narodno blago и Istočno blago.",
      verdict: "corrected",
      evidence: [
        { provider: "Akademija nauka i umjetnosti Bosne i Hercegovine", url: "https://bastina.anubih.ba/bitstreams/8a324c15-6395-44c8-a07b-6daa7c61339a/download", checkedAt, findingRu: "Издание Академии наук Боснии и Герцеговины подтверждает биографию, литературную и фольклористическую деятельность и даты жизни Капетановича." },
        { provider: "Hrvatska enciklopedija", url: "https://www.enciklopedija.hr/clanak/kapetanovic-ljubusak-mehmed-beg", checkedAt, findingRu: "Национальная энциклопедия подтверждает роли автора, сборники Narodno blago и Istočno blago и смерть 29 июля 1902 года." },
        { provider: "Univerzitet u Sarajevu, Filozofski fakultet", url: "https://biblioteka.ff.unsa.ba/ezbirke/items/show/27", checkedAt, findingRu: "Университетская цифровая библиотека атрибутирует Капетановичу издание Narodno blago." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Date queue recommendation: сохранить shared deathDate 1902-07-29; значение 1902-07-28 в сравнительной очереди не подтверждается ANUBiH и Hrvatska enciklopedija. Исходная роль дополнена двумя сборниками. Shared country files не изменялись.",
  },
  {
    key: "bosnia:petar_kocic",
    originalSha256: "83f2b8747c9a0445752951792c4cf421600287bde2dbff4aa5e378580ce1d50d",
    reviewedTextRu: "Сербский писатель и общественно-политический деятель, родившийся в Боснии и Герцеговине. Автор сборников «S planine i ispod planine» и сатирической пьесы «Jazavac pred sudom» («Барсук перед судом»).",
    claims: [{
      textRu: "Петар Кочич был сербским писателем и общественно-политическим деятелем из Боснии и написал S planine i ispod planine и сатирическую пьесу Jazavac pred sudom.",
      verdict: "corrected",
      evidence: [
        { provider: "Hrvatska enciklopedija", url: "https://www.enciklopedija.hr/clanak/kocic-petar", checkedAt, findingRu: "Национальная энциклопедия подтверждает происхождение, сербскую литературную идентичность, политическую деятельность и основные произведения Кочича." },
        { provider: "Treccani", url: "https://www.treccani.it/enciclopedia/petar-kocic/", checkedAt, findingRu: "Итальянская национальная энциклопедия независимо подтверждает писательскую и политическую деятельность и атрибутирует S planine i ispod planine и Jazavac pred sudom." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Неопределённая формула «писатель из Боснии» уточнена национальной литературной традицией, общественной ролью и произведениями без ранжирования. Shared country files не изменялись.",
  },
  {
    key: "bosnia:svetozar_corovic",
    originalSha256: "fd4c00947b11cf2902a67004713251bef9f4f20ddc2157b404035b577da19f8d",
    reviewedTextRu: "Сербский писатель из Мостара, работавший в традиции реалистической прозы. Автор романов «Stojan Mutikaša», «Majčina sultanija» и сборника рассказов «U časovima odmora».",
    claims: [{
      textRu: "Светозар Чорович был сербским писателем из Мостара, связанным с реалистической прозой, и написал Stojan Mutikaša, Majčina sultanija и U časovima odmora.",
      verdict: "corrected",
      evidence: [
        { provider: "Hrvatska enciklopedija", url: "https://www.enciklopedija.hr/clanak/corovic-svetozar", checkedAt, findingRu: "Национальная энциклопедия подтверждает сербскую литературную идентичность, рождение в Мостаре, реалистическую поэтику и названные произведения Чоровича." },
        { provider: "Treccani", url: "https://www.treccani.it/enciclopedia/svetozar-corovic/", checkedAt, findingRu: "Итальянская национальная энциклопедия независимо подтверждает биографию, реалистическую традицию и библиографию Чоровича." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Общая исходная роль конкретизирована литературной традицией, местом рождения и тремя документированными произведениями. Shared country files не изменялись.",
  },
] satisfies readonly ReviewBase[];

function finalizeReviewRecord(record: ReviewBase): WriterBiographyFactReviewRecord {
  return {
    ...record,
    applicableTextRu: record.decision === "held" ? null : record.reviewedTextRu,
  };
}

export const writerBiographyFactReviewBatch13: readonly WriterBiographyFactReviewRecord[] =
  writerBiographyFactReviewBatch13Base.map(finalizeReviewRecord);
