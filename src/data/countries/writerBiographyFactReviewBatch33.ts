export const WRITER_BIOGRAPHY_FACT_REVIEW_BATCH33_REVIEWER =
  "Codex independent claim-by-claim factual review, batch 33";

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

const reviewer = WRITER_BIOGRAPHY_FACT_REVIEW_BATCH33_REVIEWER;
const checkedAt = "2026-08-11";

type EvidenceSeed = readonly [provider: string, url: string, findingRu: string];

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
    key: "iran:forugh_farrokhzad",
    originalSha256: "3064751843571654fd514b13fab1802a5d2bc3a020020363c49500777dc69b85",
    reviewedTextRu: "Форуг Фаррохзад - иранская поэтесса и кинорежиссёр, одна из ключевых фигур обновления персидской поэзии XX века. В сборниках «Другое рождение» и «Поверим в начало холодного сезона» её личная лирика соединяет свободную форму с разговором о женском опыте и художественной свободе.",
    evidence: [
      ["Encyclopaedia Iranica", "https://www.iranicaonline.org/articles/farrokzad-forug-zaman/", "Специализированная энциклопедия называет Фаррохзад поэтессой и кинорежиссёром, приводит 1935 год рождения по иранскому календарю, смерть в Тегеране в 1967 году и фиксирует сборники Another Birth и Let Us Believe in the Beginning of the Cold Season."],
      ["Poetry Foundation", "https://www.poetryfoundation.org/poets/forugh-farrokhzad", "Литературный профиль указывает годы 1934-1967, характеризует Фаррохзад как поэтессу и кинорежиссёра и перечисляет сборники Captive, The Wall, Rebellion и Another Birth."],
      ["Le Monde", "https://www.lemonde.fr/culture/article/2024/12/22/forough-farrokhzad-1934-1967-incarner-la-lumiere-sur-france-culture-la-voix-d-une-poetesse-iranienne-surgie-du-fond-de-la-nuit_6462402_3246.html", "Редакционный материал указывает годы 1934-1967 и дату смерти 13 февраля 1967 года, показывая расхождение с датировкой Iranica."],
    ],
    decision: "corrected",
    notes: "Текущие works подтверждаются. Авторитетные источники расходятся по году рождения (1934/1935) и дню смерти (13/14 февраля), поэтому точные birthDate и deathDate нельзя сохранять как бесспорные; место смерти - Тегеран.",
  },
  {
    key: "iran:hafez",
    originalSha256: "0f20a07c07695b8e619c009c1cc7a4000c708ea0df9d0fca65911481a8540a02",
    reviewedTextRu: "Хафиз Ширази - персидский лирический поэт, чьи газели составили основу его «Дивана» и оказали длительное влияние на персидскую литературную культуру. Достоверных сведений о его жизни немного; исследователи обычно относят её примерно к 1315-1390 годам и связывают с Ширазом.",
    evidence: [
      ["Encyclopaedia Iranica", "https://www.iranicaonline.org/articles/hafez/", "Iranica характеризует Хафиза как знаменитого персидского лирического поэта из Шираза и датирует его жизнь приблизительно 1315-1390 годами."],
      ["Encyclopaedia Iranica - Life and Times", "https://www.iranicaonline.org/articles/hafez-ii/", "Биографическая статья подчёркивает крайнюю скудость надёжных сведений о жизни Хафиза и ненадёжность поздних анекдотов, связывая его рождение и смерть с Ширазом."],
      ["Poetry Foundation", "https://www.poetryfoundation.org/poets/hafez", "Профиль приводит полное имя Khwāja Šamsu d-Dīn Muḥammad Hāfez-e Šīrāzī, годы около 1310-1390 и определяет газель как центральную форму его поэзии."],
    ],
    decision: "corrected",
    notes: "Текущие даты 1315-01-01 и 1390-01-01 являются искусственной точностью для приблизительно датированной биографии. «Диван Хафиза» подтверждён; полное имя стоит добавить в латинской нормализованной форме.",
  },
  {
    key: "iran:mahmoud_dowlatabadi",
    originalSha256: "037f9af18a0993c6c0c9214382db9c22be7e0499f67422ec1efa63b36abd3d95",
    reviewedTextRu: "Махмуд Доулатабади - иранский прозаик, в романах которого деревенская жизнь и социальные перемены показаны через судьбы крестьянских семей. Его основные произведения - многотомный «Kelidar», «Missing Soluch» и «The Colonel».",
    evidence: [
      ["International Literature Festival Berlin", "https://literaturfestival.com/en/authors/mahmud-doulatabadi/", "Фестивальный профиль сообщает, что писатель родился в 1940 году в Доулатабаде, Хорасан, и называет романы Kelidar, Soluch’s Empty Place и The Colonel."],
      ["Haus Publishing", "https://www.hauspublishing.com/authors/mahmoud-dowlatabadi/", "Издательский профиль подтверждает 1940 год рождения в сельской местности Ирана и выделяет Missing Soluch и десятитомный Kelidar."],
      ["Lex.dk", "https://lex.dk/Mahmud_Dowlat%C3%A2b%C3%A2di", "Датская национальная энциклопедия приводит дату 1 августа 1940 года, место Доулатабад на северо-востоке Ирана и рассматривает Kelidar и Missing Soluch как центральные произведения."],
    ],
    decision: "corrected",
    notes: "Текущая точная birthDate поддержана национальной энциклопедией. BirthPlace следует уточнить до Хорасана, а works расширить каноническими романами вместо единственного названия.",
  },
  {
    key: "iran:omar_khayyam",
    originalSha256: "8cb6aa9fd3116f9113879173b7123065e11949f85931753c5eb1a0e4ec45b2f6",
    reviewedTextRu: "Омар Хайям - персидский математик, астроном, философ и поэт, связанный с Нишапуром и научной культурой сельджукского времени. Ему традиционно приписывают множество рубаи, однако авторство значительной части этого корпуса остаётся спорным, как и точные даты его жизни.",
    evidence: [
      ["Encyclopaedia Iranica", "https://www.iranicaonline.org/articles/khayyam-omar/khayyam-omar-i-life/", "Iranica объясняет, что дата 18 мая 1048 года выведена современными исследователями из гороскопа, датировка смерти зависит от неоднозначных рукописных свидетельств, а атрибуция многих рубаи остаётся спорной."],
      ["MacTutor History of Mathematics, University of St Andrews", "https://mathshistory.st-andrews.ac.uk/Biographies/Khayyam/", "Университетская биография приводит традиционные даты 18 мая 1048 - 4 декабря 1131, рождение в Нишапуре и характеризует Хайяма как математика, астронома и поэта."],
      ["Poetry Foundation", "https://www.poetryfoundation.org/poets/omar-khayaam", "Литературный профиль указывает годы 1048-1131 и отмечает, что лишь часть приписываемого Хайяму корпуса четверостиший можно считать надёжно его произведениями."],
    ],
    decision: "corrected",
    notes: "Текущие точные birthDate и deathDate существуют как традиционная реконструкция, но Iranica прямо показывает их неопределённость. BirthPlace следует исторически обозначить как Нишапур в Хорасане, а works снабдить оговоркой об атрибуции.",
  },
  {
    key: "iran:saadi_shirazi",
    originalSha256: "d7784fb97f29979e66c4ac7df73977d9e315d584cfcb760ece83d57e09cb8f2e",
    reviewedTextRu: "Саади Ширази - персидский поэт и прозаик, автор дидактической поэмы «Бустан» и собрания притч, стихов и наставлений «Гулистан». Надёжных сведений о его биографии немного; обычно его жизнь датируют приблизительно 1210-1291/1292 годами и связывают с Ширазом.",
    evidence: [
      ["Encyclopaedia Iranica", "https://www.iranicaonline.org/articles/sadi-sirazi/", "Iranica указывает приблизительное рождение в Ширазе около 1210 года, смерть там же в 1291 или 1292 году и датирует завершение Bustan 1257-м, а Golestan - 1258 годом."],
      ["Library of Congress", "https://blogs.loc.gov/international-collections/2021/01/sa%CA%BBdi-and-his-mystical-humanist-literature-at-the-library-of-congress/", "Материал Библиотеки Конгресса связывает Саади с Ширазом, приводит приблизительные годы 1210-1291 и рассматривает Gulistan и Bustan как его главные книги."],
      ["The Metropolitan Museum of Art", "https://www.metmuseum.org/art/collection/search/446557", "Музейная карточка рукописи Bustan датирует автора приблизительно 1213-1291 годами и связывает произведение с Саади из Шираза."],
    ],
    decision: "corrected",
    notes: "Текущие works верны. Даты 1210-01-01 и 1292-01-01 создают ложную точность: год рождения приблизителен, а источники расходятся между 1291 и 1292 годами смерти.",
  },
  {
    key: "iran:sadegh_hedayat",
    originalSha256: "05c997ea5fa56dd931e4f55563a7eb155b8257042740fafb3e9db4095816a97b",
    reviewedTextRu: "Садек Хедаят - иранский прозаик и переводчик, чьи рассказы и повесть «Слепая сова» сыграли заметную роль в становлении современной персидской прозы. Он родился в Тегеране в 1903 году и умер в Париже в 1951 году.",
    evidence: [
      ["Encyclopaedia Iranica", "https://www.iranicaonline.org/articles/hedayat-sadeq/", "Iranica приводит даты 17 февраля 1903 - 9 апреля 1951, места Тегеран и Париж и характеризует Хедаята как влиятельного автора современной персидской прозы."],
      ["Encyclopaedia Iranica - Fiction", "https://www.iranicaonline.org/articles/hedayat-sadeq-i/", "Статья о прозе подтверждает центральное место The Blind Owl в творчестве Хедаята и сообщает о его смерти в Париже 9 апреля 1951 года."],
      ["Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark%3A/12148/cb120669834", "Авторитетная запись BnF подтверждает имя, рождение 17 февраля 1903 года в Тегеране и смерть в Париже в апреле 1951 года; каталог указывает 10 апреля, на один день позже Iranica."],
    ],
    decision: "corrected",
    notes: "Текущая дата рождения подтверждена. Для deathDate сохранена дата 1951-04-09 по профильной Iranica; однодневное расхождение с каталогом BnF явно отмечено. Необходимо добавить отсутствующее deathPlace.",
  },
  {
    key: "iran:shahrnush_parsipur",
    originalSha256: "e9ada09964d007de1a61a265acd9b390842f1e74fb11ca75861814eb9de57e29",
    reviewedTextRu: "Шахрнуш Парсипур - иранская писательница и мемуаристка, в чьих книгах женский опыт соединяется с политической историей, мифом и элементами магического реализма. Среди её основных произведений - «Женщины без мужчин», «Touba and the Meaning of Night» и тюремные мемуары «Kissing the Sword».",
    evidence: [
      ["Feminist Press", "https://feministpress.org/blogs/news/remembering-iranian-author-and-activist-shahrnush-parsipur-1946-2026", "Издательский некролог указывает годы 1946-2026 и выделяет Women Without Men, Touba and the Meaning of Night и Kissing the Sword."],
      ["Stanford University", "https://events.stanford.edu/event/shahrnush-parsipur-in-memoriam", "Мемориальная страница Стэнфорда подтверждает рождение в Тегеране в 1946 году, смерть в 2026 году и значение её прозы для литературы об иранских женщинах."],
      ["The Guardian", "https://www.theguardian.com/books/2026/jul/24/shahrnush-parsipur-obituary", "Некролог указывает точную дату рождения 17 февраля 1946 года в Тегеране и смерть 3 июля 2026 года, а также рассматривает основные романы и мемуары."],
    ],
    decision: "corrected",
    notes: "Текущая запись устарела: после смерти писательницы в 2026 году нужно закрыть years и заполнить deathDate. BirthDate и birthPlace подтверждены; works следует расширить тремя аттестованными книгами.",
  },
  {
    key: "iran:simin_daneshvar",
    originalSha256: "f1fc0fa1b3ada4c4f9e3abf9a598670b17aabfc9bb78279f6d5257e5337f72c6",
    reviewedTextRu: "Симин Данешвар - иранская писательница, литературовед и переводчица; её «Савушун» считается первым романом на персидском языке, опубликованным иранской женщиной. Роман обращён к жизни Шираза в годы Второй мировой войны и британской оккупации юга Ирана.",
    evidence: [
      ["Encyclopaedia Iranica", "https://www.iranicaonline.org/articles/suvashun/", "Iranica приводит годы 1921-2012, места Шираз и Тегеран и определяет Savushun как первый персидский роман, опубликованный иранской писательницей."],
      ["The Guardian", "https://www.theguardian.com/world/2012/mar/22/simin-daneshvar", "Некролог подтверждает даты 28 апреля 1921 - 8 марта 2012, рождение в Ширазе, смерть в Тегеране и центральное место Savushun в её наследии."],
      ["Library of Congress", "https://www.loc.gov/exhibits/thousand-years-of-the-persian-book/women-writers.html", "Выставка Библиотеки Конгресса называет Данешвар писательницей, исследовательницей и переводчицей и характеризует Savushun как первый роман на персидском языке, написанный женщиной."],
    ],
    decision: "corrected",
    notes: "Текущие имя, точные даты, birthPlace и произведение подтверждены. Требуется только добавить подтверждённое место смерти - Тегеран; формулировку о первенстве следует делать конкретной, без общего суперлатива.",
  },
  {
    key: "iraq:abd_al_wahhab_al_bayati",
    originalSha256: "a2b386ae81d73c92f403817675fcb6a442d1120b66129f04ecb785d5627f3f5b",
    reviewedTextRu: "Абдель Ваххаб аль-Баяти - иракский поэт, один из участников обновления арабской поэзии и развития свободного стиха в середине XX века. Темы изгнания, политической несвободы и мифа проходят через сборники «Разбитые кувшины» и «Любовь, смерть и изгнание».",
    evidence: [
      ["Encyclopédie Larousse", "https://www.larousse.fr/encyclopedie/litterature/Abd_al-Wahhab_al-_Bayyati/171331", "Larousse указывает годы 1926-1999, рождение в Багдаде, смерть в Дамаске и роль аль-Баяти в современной арабской поэзии."],
      ["The Independent", "https://www.independent.co.uk/arts-entertainment/obituary-abdel-wahab-albayati-1111634.html", "Некролог подтверждает смерть в Дамаске 3 августа 1999 года, участие в движении свободного стиха и книги The Broken Jugs и Love, Death & Exile."],
      ["Sultan Bin Ali Al Owais Cultural Foundation", "https://www.alowais.com/en/abdul-wahhab-al-bayati/", "Официальный профиль лауреата подтверждает рождение в Ираке в 1926 году и перечисляет Smashed Pitchers, Poetry in Exile и другие сборники."],
    ],
    decision: "corrected",
    notes: "Текущие точные даты совместимы с биографическими источниками; место смерти нужно добавить. Generic work «Диван стихов» следует заменить конкретными аттестованными сборниками.",
  },
  {
    key: "iraq:abu_nuwas",
    originalSha256: "2822215e2423fb619ecf5c464adcd4f2827a0a47e123add4fc707ac65abf5471",
    reviewedTextRu: "Абу Нувас (аль-Хасан ибн Хани аль-Хаками) - арабоязычный поэт раннеаббасидской эпохи, родившийся в Ахвазе и связавший зрелую жизнь с Багдадом. Его «Диван» известен прежде всего стихами о вине, любви, удовольствии и религиозном обращении, однако корпус дошёл в позднейшей редакции.",
    evidence: [
      ["The British Museum", "https://www.britishmuseum.org/collection/term/BIOG238337", "Музейная биографическая запись приводит годы 756-814, рождение в Ахвазе и последующую жизнь в Багдаде."],
      ["Poetry Foundation", "https://www.poetryfoundation.org/poets/abu-nuwas", "Профиль датирует рождение приблизительно 760 годом на юго-западе Персии, смерть - около 814 года в Багдаде, и описывает «Диван» примерно из 1500 произведений, особенно винную поэзию."],
      ["New York University Press", "https://nyupress.org/author/abu-nuwas/", "Университетское издательство указывает рождение в Ахвазе около 756-758 годов и смерть в Багдаде между 813 и 815 годами."],
    ],
    decision: "corrected",
    notes: "Источники дают интервалы, а не бесспорные годы: текущие birthDate «756» и deathDate «814» следует убрать как точные поля. BirthPlace и «Диван Абу Нуваса» поддержаны; добавляются полное имя и место смерти.",
  },
  {
    key: "iraq:al_mutanabbi",
    originalSha256: "56fc74ac224cbd3a01eb2345c1e6042c6f7d00629d5d40283b5ca0f6aaa8fda3",
    reviewedTextRu: "Аль-Мутанабби (Абу-т-Тайиб Ахмад ибн аль-Хусайн) - арабский поэт X века, чьи придворная лирика, панегирики и афористические строки собраны в «Диване». Он родился в Куфе в 915 или 916 году, служил при дворах Алеппо и других городов и погиб в 965 году на пути в Ирак.",
    evidence: [
      ["Library of Congress", "https://www.loc.gov/item/2021666172", "Библиотечная запись приводит полное имя Abū al-Ṭayyib Aḥmad ibn al-Ḥusayn, годы 915 или 916-965 и атрибутирует ему «Диван» с комментарием."],
      ["Treccani", "https://www.treccani.it/enciclopedia/al-mutanabbi/", "Итальянская энциклопедия указывает настоящее имя Aḥmad ibn al-Ḥusain, рождение в Куфе в 915 году, смерть в 965 году и деятельность придворного поэта, в том числе в Алеппо."],
    ],
    decision: "corrected",
    notes: "DeathDate «965» и «Диван Аль-Мутанабби» поддержаны, но текущая birthDate «915» скрывает засвидетельствованную вариантность 915/916. Полное имя следует добавить, а точный год рождения вынести только в years.",
  },
  {
    key: "iraq:badr_shakir_al_sayyab",
    originalSha256: "a4ed1efbba7e590e042eb27bd46e4ee2b3fdeffbd3f44d66805becde327145d8",
    reviewedTextRu: "Бадр Шакир ас-Сайяб - иракский поэт и участник движения за обновление арабского стиха в середине XX века. В сборнике «Песнь дождя» он соединил свободный стих, месопотамские образы и опыт политических потрясений современного Ирака.",
    evidence: [
      ["Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark%3A/12148/cb122972090", "Авторитетная запись BnF подтверждает имя и даты 24 декабря 1926 - 24 декабря 1964."],
      ["Encyclopædia Universalis", "https://www.universalis.fr/encyclopedie/badr-shakir-as-sayyab/", "Энциклопедия указывает годы 1926-1964, рождение в Джейкуре близ Басры и рассматривает «Песнь дождя» в контексте обновления арабской поэзии."],
      ["Cambridge University Press", "https://www.cambridge.org/core/journals/international-journal-of-middle-east-studies/article/abs/badr-shakir-alsayyab-and-the-free-verse-movement/BE36EDE3207A246796E77B752EBBC842", "Научная статья исследует роль ас-Сайяба в движении арабского свободного стиха и подтверждает центральность этой реформы для оценки его творчества."],
    ],
    decision: "corrected",
    notes: "Текущие точные birthDate и deathDate подтверждены BnF, а «Песнь дождя» - литературной энциклопедией. BirthPlace следует уточнить как Джейкур близ Басры и добавить deathPlace Кувейт.",
  },
  {
    key: "iraq:fuad_al_takarli",
    originalSha256: "941c012cf038a6b8e8d2e0b97fd149188f46d10fb5277f4709c12552ce3c27a7",
    reviewedTextRu: "Фуад ат-Тикерли - иракский прозаик и юрист, один из пионеров современной иракской художественной прозы. В романе «The Long Way Back» он показывает несколько поколений багдадской семьи на фоне политического насилия и переворота 1963 года.",
    evidence: [
      ["The American University in Cairo Press", "https://aucpress.com/9781617971914/the-long-way-back/", "Университетское издательство сообщает, что ат-Тикерли родился в Багдаде, окончил юридический факультет в 1949 году, работал судьёй и написал The Long Way Back."],
      ["Banipal", "https://www.banipal.co.uk/contributors/187/fuad-al-takarli/", "Профиль указывает рождение в Багдаде в 1927 году, смерть 11 февраля 2008 года в Аммане, роль пионера иракской прозы и роман The Long Way Back."],
      ["Sultan Bin Ali Al Owais Cultural Foundation", "https://www.alowais.com/en/fuad-al-takarli/", "Официальный профиль лауреата подтверждает рождение в Багдаде в 1927 году, его работу судьёй и вклад в иракский рассказ и роман."],
    ],
    decision: "corrected",
    notes: "Выбранные независимые источники подтверждают только год рождения, поэтому текущую birthDate 1927-08-22 следует сократить до 1927. DeathDate подтверждена, добавляется Амман; текущее название «Дальний берег» не соответствует аттестованному The Long Way Back.",
  },
  {
    key: "iraq:nazik_al_malaika",
    originalSha256: "6c04e560d5fc6ab146156c864fc9d6367d140d018076bda1ca981654db42c4ba",
    reviewedTextRu: "Назик аль-Малаика - иракская поэтесса и литературный критик, одна из пионеров свободного стиха в арабской поэзии. Её поэма «Холера» и сборники «Возлюбленная ночи» и «Осколки и пепел» стали важными текстами арабского модернизма.",
    evidence: [
      ["The Guardian", "https://www.theguardian.com/news/2007/aug/06/guardianobituaries.poetry", "Некролог подтверждает даты 23 августа 1923 - 20 июня 2007, рождение в Багдаде, смерть в Каире и роль аль-Малаики в арабском свободном стихе; перечислены The Lover of the Night и Splinters and Ashes."],
      ["Encyclopædia Universalis", "https://www.universalis.fr/encyclopedie/nazik-al-mala-ika/", "Энциклопедия приводит годы 1923-2007, связывает поэтессу с Багдадом и рассматривает «Холеру» и «Осколки и пепел» как ключевые тексты реформы арабского стиха."],
      ["University of Diyala", "https://basicedu.uodiyala.edu.iq/uploads/DHAMYA5/%D8%B5%D9%88%D8%B1%20%D8%A7%D9%84%D8%AA%D8%AF%D8%B1%D9%8A%D8%B3%D9%8A%20%D8%A7%D9%84%D9%83%D9%84%D9%8A%D8%A9/%D9%82%D8%B3%D9%85%20%D8%A7%D9%84%D8%AD%D8%A7%D8%B3%D8%A8%D8%A7%D8%AA/%D8%A7%D9%86%D9%83%D9%84%D9%8A%D8%B2%D9%8A/Nazik%20Al-%20Malaika%20Perusals%20and%20Translations.pdf", "Университетское исследование подтверждает годы 1923-2007, происхождение из багдадской литературной семьи и вклад в развитие современной арабской поэзии."],
    ],
    decision: "corrected",
    notes: "Текущие точные даты и birthPlace подтверждены. Название «Любовь к тебе» не соответствует основной библиографии: заменить на «Возлюбленная ночи», «Осколки и пепел» и «Холера»; добавить место смерти Каир.",
  },
  {
    key: "ireland:bram_stoker",
    originalSha256: "03dbddd2b02d4ad47cf7f2b5b12118328e6380bac21d9c0922aadf7b9d9531f8",
    reviewedTextRu: "Брэм Стокер (1847-1912) - ирландский писатель и театральный администратор. Его готический роман «Дракула» был опубликован в 1897 году.",
    evidence: [
      ["Trinity College Dublin, Trinity Writers", "https://www.tcd.ie/trinitywriters/writers/bram-stoker/", "Подтверждает годы жизни, рождение 8 ноября 1847 года в Клонтарфе близ Дублина, работу в театре и публикацию «Дракулы» в мае 1897 года."],
      ["Penguin UK", "https://www.penguin.co.uk/books/55632/dracula-by-stoker-bram/9780141910932", "Подтверждает полное имя Abraham Bram Stoker, годы 1847-1912, работу театральным управляющим и авторство романа «Дракула»."],
      ["Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark%3A/12148/cb314099016", "Библиографическая запись связывает Брэма Стокера (1847-1912) с романом Dracula."],
    ],
    decision: "corrected",
    notes: "Исходная формулировка фактически верна, но оценочное слово «знаменитого» заменено датируемым библиографическим фактом.",
  },
  {
    key: "ireland:edna_obrien",
    originalSha256: "1dfbaf8c098e36b829fa659bd5ae2e570179ae3dab93e48cfb326d02e21db619",
    reviewedTextRu: "Эдна О’Брайен (1930-2024) - ирландская писательница, автор романов, рассказов, пьес и документальной прозы. Её дебютный роман «Деревенские девушки» (1960) открыл одноимённую трилогию и был запрещён ирландской цензурой.",
    evidence: [
      ["National Library of Ireland", "https://catalogue.nli.ie/Collection/vtls000795892?recordID=vtls000893527", "Описывает О’Брайен как романистку, автора рассказов, биографа, поэтессу и драматурга; подтверждает рождение в Туамгрэни в 1930 году и публикацию The Country Girls в 1960 году."],
      ["Faber", "https://www.faber.co.uk/author/edna-obrien/", "Подтверждает корпус художественной и документальной прозы, трилогию The Country Girls и смерть писательницы в июле 2024 года."],
      ["President of Ireland", "https://president.ie/en/media-library/news-releases/statement-by-president-michael-d-higgins-on-the-death-of-edna-obrien", "Официальное заявление подтверждает ирландскую писательскую идентичность и то, что ранние книги О’Брайен подвергались запрету в Ирландии."],
    ],
    decision: "corrected",
    notes: "Суперлатив исходной биографии заменён проверяемыми сведениями. Выбранные источники подтверждают 1930-2024, но не оба точных календарных дня из текущей карточки.",
  },
  {
    key: "ireland:flann_obrien",
    originalSha256: "de9d97df6efbd5b7d8bb25d98919b4039ea4c938000ef2aabfddca9f5e0a1eca",
    reviewedTextRu: "Фланн О’Брайен - псевдоним ирландского писателя и сатирика Брайана О’Нолана (1911-1966), также публиковавшего газетную колонку под именем Майлз на Гопалин. Среди его романов - «The Third Policeman» и «At Swim-Two-Birds».",
    evidence: [
      ["Penguin Random House", "https://www.penguinrandomhouse.com/authors/78342/flann-obrien/", "Указывает, что Flann O’Brien - псевдоним Брайана О’Нолана, ирландского романиста и политического комментатора, родившегося в 1911 году в графстве Тирон; приводит его романы."],
      ["Harry Ransom Center, University of Texas at Austin", "https://research.hrc.utexas.edu/fasearch/pdf/00102.pdf", "Архивная опись идентифицирует Flann O’Brien как Brian O’Nolan (1911-1966) и документирует его литературную и журналистскую деятельность."],
      ["Treccani", "https://www.treccani.it/enciclopedia/flann-o-brien/", "Подтверждает псевдонимы Flann O’Brien и Myles na gCopaleen, имя Brian O’Nolan, связь со Страбейном и сатирическую колонку в The Irish Times."],
    ],
    decision: "corrected",
    notes: "Краткая исходная характеристика не раскрывала псевдоним и библиографию. Точные дни рождения и смерти текущей карточки выбранными независимыми профилями не подтверждены полностью.",
  },
  {
    key: "ireland:george_bernard_shaw",
    originalSha256: "2ee1bba0b679a996987a2c83f898f5e3332440f5e0c2cd5719a1a53466ccf0b2",
    reviewedTextRu: "Ирландский драматург, лауреат Нобелевской премии по литературе 1925 года.",
    evidence: [
      ["Nobel Prize", "https://www.nobelprize.org/prizes/literature/1925/shaw/facts/", "Подтверждает рождение 26 июля 1856 года в Дублине, смерть 2 ноября 1950 года в Эйот-Сент-Лоренсе, профессию драматурга, пьесу Pygmalion и Нобелевскую премию 1925 года."],
      ["National Trust", "https://www.nationaltrust.org.uk/visit/essex-bedfordshire-hertfordshire/shaws-corner/history-of-shaws-corner", "Описывает Шоу как ирландского драматурга и общественного деятеля, подтверждает дату рождения, пьесу «Пигмалион» и смерть 2 ноября 1950 года."],
    ],
    decision: "unchanged",
    notes: "Исходный текст краток, нейтрален и полностью подтверждён двумя независимыми институциональными источниками.",
  },
  {
    key: "ireland:iris_murdoch",
    originalSha256: "cd854c9d012937eafdf5ef1730c8f520c458c158be229c3e1df73419d47a3b56",
    reviewedTextRu: "Айрис Мёрдок (1919-1999) - ирландско-британская писательница и философ. «Под сетью» (1954) был её первым романом; среди последующих книг - «Чёрный принц» и удостоенный Букеровской премии роман «Море, море».",
    evidence: [
      ["Somerville College, University of Oxford", "https://www.some.ox.ac.uk/eminent/iris-murdoch/", "Подтверждает годы 1919-1999, рождение в Дублине, работу философа и романиста, дебют Under the Net в 1954 году и Букеровскую премию за The Sea, The Sea."],
      ["Kingston University Archives", "https://adlib.kingston.ac.uk/Details/archive/110013590", "Архивная запись подтверждает рождение в Дублине 15 июля 1919 года, занятия литературой и философией, первый роман Under the Net и смерть в 1999 году."],
      ["Penguin UK", "https://www.penguin.co.uk/books/355293/the-black-prince-by-iris-murdoch/9780099589259", "Подтверждает авторство романа The Black Prince, дублинское происхождение, годы 1919-1999 и философскую деятельность Мёрдок."],
    ],
    decision: "corrected",
    notes: "Темы исходного текста правдоподобны, но заменены компактной проверяемой библиографической справкой. Источники расходятся в подсчёте романов, поэтому количество не указывается.",
  },
  {
    key: "ireland:james_joyce",
    originalSha256: "fd3b6bf8d70602dfcd951b1e5b016b1cb6f48918e214af68c5ddd4aab5102119",
    reviewedTextRu: "Джеймс Джойс (1882-1941) - ирландский писатель, автор сборника «Дублинцы» и романов «Портрет художника в юности» и «Улисс». Его проза связана с развитием англоязычного модернизма.",
    evidence: [
      ["University College Dublin", "https://alumni.ucd.ie/magazine/2021/by-the-book/", "Подтверждает полное имя James Augustine Aloysius Joyce, годы 1882-1941, выпуск из UCD, отъезд из Ирландии в 1904 году и публикацию Ulysses в 1922 году."],
      ["Poetry Foundation", "https://www.poetryfoundation.org/poets/james-joyce/", "Подтверждает годы жизни, дублинское происхождение и библиографию: Dubliners (1914), A Portrait of the Artist as a Young Man (1916), Ulysses (1922) и Finnegans Wake (1939)."],
      ["National Library of Ireland", "https://catalogue.nli.ie/Record/vtls000362784/StaffViewMARC", "Каталожная запись связывает Джойса (1882-1941) с Dubliners, A Portrait of the Artist as a Young Man, Ulysses и Finnegans Wake."],
    ],
    decision: "corrected",
    notes: "Оценочный суперлатив заменён именами произведений и нейтральной литературно-исторической характеристикой.",
  },
  {
    key: "ireland:jonathan_swift",
    originalSha256: "5887596b3c7a5dfe0598f479adac2e660cf7fd84ddd5b575b2bb1c8c7f7fefd2",
    reviewedTextRu: "Джонатан Свифт (1667-1745) - ирландский писатель-сатирик и священнослужитель, с 1713 года декан собора Святого Патрика в Дублине. Среди его произведений - «Сказка бочки» и «Путешествия Гулливера».",
    evidence: [
      ["Trinity College Dublin, Trinity Writers", "https://www.tcd.ie/trinitywriters/writers/jonathan-swift/", "Подтверждает годы 1667-1745, рождение и смерть в Дублине, служение деканом собора Святого Патрика и публикации A Tale of a Tub (1704) и Gulliver’s Travels (1726)."],
      ["Poetry Foundation", "https://www.poetryfoundation.org/poets/jonathan-swift", "Описывает Свифта как англо-ирландского поэта, сатирика, эссеиста и памфлетиста, родившегося в Дублине и служившего деканом собора Святого Патрика; подтверждает основные произведения."],
      ["Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark%3A/12148/cb119258220", "Authority-запись подтверждает годы жизни, Дублин как место рождения и смерти, занятия сатирой, эссеистикой, поэзией и церковное служение; библиография включает Gulliver’s Travels."],
    ],
    decision: "corrected",
    notes: "Суперлатив исходной справки заменён должностью и произведениями. В authority-источниках встречается календарное расхождение между старым и новым стилем для даты рождения; поэтому день не вынесен в биографию.",
  },
  {
    key: "ireland:oscar_wilde",
    originalSha256: "93a3d9ff50a2e22fe31d14aff0f8458ba65c89780469003b5a34ff12fc7a2679",
    reviewedTextRu: "Оскар Уайльд (1854-1900) - ирландский писатель, драматург, поэт и эссеист, связанный с эстетическим движением конца XIX века. Среди его произведений - роман «Портрет Дориана Грея» и комедия «Как важно быть серьёзным».",
    evidence: [
      ["Trinity College Dublin, Oscar Wilde Centre", "https://www.tcd.ie/owc/history/oscar-wilde/", "Подтверждает полное имя Oscar Fingal O’Flahertie Wills Wilde, занятия поэзией, драматургией, прозой и эссеистикой и авторство The Picture of Dorian Gray и The Importance of Being Earnest."],
      ["Poetry Foundation", "https://www.poetryfoundation.org/poets/oscar-wilde", "Подтверждает годы 1854-1900, связь с эстетическим движением и основные произведения Уайльда."],
      ["Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark%3A/12148/cb11929190h", "Authority-запись подтверждает рождение 16 октября 1854 года в Дублине и смерть 30 ноября 1900 года в Париже, а также литературные роли Уайльда."],
    ],
    decision: "corrected",
    notes: "Суперлатив «один из крупнейших» заменён описанием направления и проверенной библиографией.",
  },
  {
    key: "ireland:samuel_beckett",
    originalSha256: "c4ebcad78a6c9705297506e1b18285d01a1b04e188ad65bbbb1a21e19cbf4df9",
    reviewedTextRu: "Ирландский драматург и писатель, лауреат Нобелевской премии по литературе 1969 года.",
    evidence: [
      ["Nobel Prize", "https://www.nobelprize.org/prizes/literature/1969/beckett/biographical/", "Подтверждает ирландское происхождение, рождение в Дублине в 1906 году, литературную работу на английском и французском языках, Нобелевскую премию 1969 года и смерть 22 декабря 1989 года в Париже."],
      ["University of Reading Special Collections", "https://collections.reading.ac.uk/special-collections/collections/samuel-beckett-writer/", "Описывает Беккета как двуязычного писателя, подтверждает пьесу Waiting for Godot, прозаическую трилогию и Нобелевскую премию 1969 года."],
      ["University of Reading", "https://archive.reading.ac.uk/news-events/2006/January/pr243.html", "Подтверждает рождение 13 апреля 1906 года в Дублине, авторство Waiting for Godot и Нобелевскую премию 1969 года."],
    ],
    decision: "unchanged",
    notes: "Исходная формулировка нейтральна и полностью подтверждается источниками.",
  },
  {
    key: "ireland:seamus_heaney",
    originalSha256: "ee30fbaa024ba7798515c4da3d3ef96535a5e74ce18aafcfad8030a3e6fa69db",
    reviewedTextRu: "Ирландский поэт, лауреат Нобелевской премии по литературе 1995 года.",
    evidence: [
      ["Nobel Prize", "https://www.nobelprize.org/prizes/literature/1995/heaney/biographical/", "Подтверждает рождение в апреле 1939 года в графстве Дерри, деятельность поэта, Нобелевскую премию 1995 года и смерть 30 августа 2013 года."],
      ["Poetry Foundation", "https://www.poetryfoundation.org/poets/seamus-heaney", "Подтверждает годы 1939-2013, происхождение из графства Дерри, первый сборник Death of a Naturalist (1966) и Нобелевскую премию 1995 года."],
      ["Emory University", "https://www.emory.edu/news/Releases/seamus1064430623.html", "Подтверждает рождение в графстве Дерри в 1939 году, авторство Death of a Naturalist и статус нобелевского лауреата."],
    ],
    decision: "unchanged",
    notes: "Исходная биография кратка, нейтральна и подтверждена. Точный день рождения и текущая локализация «Беллагай» требуют более аккуратной authority-проверки: источники связывают детство с Моссбоном и Каслдоусоном в графстве Дерри.",
  },
  {
    key: "ireland:w_b_yeats",
    originalSha256: "eabe6de6b167d464e2dbee43dbfefd736971ec102e4631040b0d9b47c5aad28a",
    reviewedTextRu: "Уильям Батлер Йейтс (1865-1939) - ирландский поэт и драматург, участник Ирландского литературного возрождения и лауреат Нобелевской премии по литературе 1923 года. Среди его книг - «Кельтские сумерки» и «Башня».",
    evidence: [
      ["Nobel Prize", "https://www.nobelprize.org/prizes/literature/1923/yeats/facts/", "Подтверждает рождение 13 июня 1865 года в Дублине, смерть 28 января 1939 года в Рокбрюн-Кап-Мартене, занятия поэзией и Нобелевскую премию 1923 года."],
      ["Nobel Prize, bibliography", "https://www.nobelprize.org/prizes/literature/1923/yeats/bibliography/", "Библиография подтверждает The Celtic Twilight (1893) и The Tower (1928)."],
      ["National Library of Ireland", "https://www.nli.ie/1916/exhibition/en/content/stagesetters/culture/yeats/", "Подтверждает годы 1865-1939, рождение в Дублине и роль Йейтса в Ирландском литературном возрождении."],
    ],
    decision: "corrected",
    notes: "Оценочное слово «великий» заменено проверяемыми сведениями о литературном движении, премии и книгах.",
  },
  {
    key: "israel:ab_yehoshua",
    originalSha256: "46b7036ef36c1940fbb66f20bad3f340d6d886806963ede3f88b725a45893c96",
    reviewedTextRu: "Авраам Йехошуа (1936-2022) - израильский писатель, автор романов, рассказов, пьес и эссе на иврите. Среди его книг - «Любовник» и «Господин Мани»; он также преподавал литературу в Хайфском университете.",
    evidence: [
      ["Institute for the Translation of Hebrew Literature", "https://www.ithl.org.il/writer/abraham-b-yehoshua/", "Подтверждает годы 1936-2022, рождение в Иерусалиме, литературную работу на иврите, преподавание в Хайфском университете и библиографию, включая The Lover и Mr. Mani."],
      ["Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark%3A/12148/cb375261606", "Каталожная запись идентифицирует А. Б. Йехошуа (1936-2022) как израильского автора прозы на иврите."],
    ],
    decision: "corrected",
    notes: "Суперлатив заменён жанрами, языком, преподавательской работой и проверенными названиями книг. Выбранные страницы подтверждают годы, но не оба точных календарных дня текущей карточки.",
  },
  {
    key: "israel:amos_oz",
    originalSha256: "7fb28bc02797f9d3b9440761e01bd8e1bc42a99d8b5890ef086864504b364a50",
    reviewedTextRu: "Амос Оз (1939-2018; при рождении Амос Клаузнер) - израильский писатель и эссеист, писавший на иврите. Среди его книг - «Мой Михаэль» и «Повесть о любви и тьме»; в 1998 году он получил Государственную премию Израиля по литературе.",
    evidence: [
      ["Institute for the Translation of Hebrew Literature", "https://www.ithl.org.il/writer/amos-oz/", "Подтверждает рождение в Иерусалиме, работу романиста и эссеиста на иврите, книги My Michael и A Tale of Love and Darkness и Государственную премию Израиля 1998 года."],
      ["Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark%3A/12148/cb11918326h", "Authority-запись подтверждает имя при рождении Amos Klausner, рождение 4 мая 1939 года в Иерусалиме, смерть 28 декабря 2018 года в Тель-Авиве и занятия прозой и эссеистикой."],
    ],
    decision: "corrected",
    notes: "Суперлатив заменён проверяемыми биографическими и библиографическими фактами. В заголовке профиля ITHL указан ошибочный 2019 год смерти; точная authority-запись BnF и текущая карточка согласованно дают 2018 год, поэтому опечатка ITHL не переносится.",
  },
  {
    key: "israel:david_grossman",
    originalSha256: "963a2762c9e3657877fb9bab52b543b17132f0d2b847aa86333235d8fa60156b",
    reviewedTextRu: "Давид Гроссман (род. 1954) - израильский писатель, автор романов, рассказов, пьес, книг для детей и документальной прозы. Среди его книг - «See Under: Love» и «To the End of the Land»; роман «A Horse Walks Into a Bar» получил Международную Букеровскую премию 2017 года.",
    evidence: [
      ["Institute for the Translation of Hebrew Literature", "https://www.ithl.org.il/writer/david-grossman/", "Подтверждает рождение в Иерусалиме в 1954 году, работу в разных литературных жанрах, библиографию «See Under: Love» и «To the End of the Land», а также награду за «A Horse Walks Into a Bar»."],
      ["The Booker Prizes", "https://thebookerprizes.com/the-booker-library/authors/david-grossman", "Представляет Гроссмана как израильского писателя и подтверждает Международную Букеровскую премию 2017 года за «A Horse Walks Into a Bar»."],
    ],
    decision: "corrected",
    notes: "Исходная характеристика верна, но слишком обща. Необычное русское название «См. статью „Любовь“» соответствует роману «See Under: Love», однако пунктуацию и официальное название конкретного русского издания следует проверять по выходным данным, а не исправлять как интерфейсный артефакт.",
  },
  {
    key: "israel:etgar_keret",
    originalSha256: "c4d11d8ad4d02980889de8f6f3cc2b81ed9856b6e96b178f4c68d10f569d3d54",
    reviewedTextRu: "Этгар Керет (род. 1967) - израильский писатель и сценарист, работающий преимущественно с короткой прозой. Среди его книг - сборники «Suddenly, a Knock on the Door» и «The Bus Driver Who Wanted to Be God».",
    evidence: [
      ["Institute for the Translation of Hebrew Literature", "https://www.ithl.org.il/writer/etgar-keret/", "Подтверждает рождение в Рамат-Гане в 1967 году, литературную и кинематографическую работу автора, преобладание короткой прозы и книгу «Suddenly, a Knock on the Door»."],
      ["Macmillan", "https://academic.macmillan.com/author/etgarkeret/", "Указывает Рамат-Ган как место рождения и перечисляет сборники «Suddenly, a Knock on the Door» и «The Bus Driver Who Wanted to Be God»."],
    ],
    decision: "corrected",
    notes: "Название «Трубочист» не удалось уверенно сопоставить с отдельной книгой Керета в выбранных авторитетных библиографиях; его нельзя сохранять или переназначать без дополнительной идентификации.",
  },
  {
    key: "israel:orly_castel_bloom",
    originalSha256: "d8889b7d850d8e954d931c9e680a49ce532f2b15dba986206caf62093163261d",
    reviewedTextRu: "Орли Кастель-Блум (род. 1960) - израильская писательница, автор романов, рассказов и книг для детей на иврите. Среди её произведений - роман «Dolly City».",
    evidence: [
      ["Institute for the Translation of Hebrew Literature", "https://www.ithl.org.il/writer/orly-castel-bloom/", "Подтверждает рождение в Тель-Авиве в 1960 году, работу в жанрах романа, рассказа и детской литературы и авторство «Dolly City»."],
      ["Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark%3A/12148/cb12330999z", "Authority-запись идентифицирует Орли Кастель-Блум как родившуюся в Тель-Авиве в 1960 году израильскую романистку, пишущую на иврите, и связывает её с «Dolly City»."],
    ],
    decision: "corrected",
    notes: "Оценочная принадлежность к «представителям современной прозы» заменена проверяемыми жанровыми и библиографическими сведениями.",
  },
  {
    key: "israel:s_y_agnon",
    originalSha256: "415282c00d3464eeefcd4b7cc39baa2d03b5c32b057434e80cf9af64f18006ec",
    reviewedTextRu: "Израильский писатель на иврите, Нобелевский лауреат по литературе 1966 года.",
    evidence: [
      ["Nobel Prize", "https://www.nobelprize.org/prizes/literature/1966/agnon/facts/", "Подтверждает израильскую принадлежность, иврит как язык творчества, годы 1888-1970 и Нобелевскую премию по литературе 1966 года."],
      ["Institute for the Translation of Hebrew Literature", "https://www.ithl.org.il/writer/shmuel-yosef-agnon/", "Подтверждает имя Шмуэль Йосеф Агнон, исходную фамилию Чачкес, годы жизни, письмо на иврите и Нобелевскую премию 1966 года."],
      ["Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark%3A/12148/cb118881863", "Authority-запись подтверждает имя при рождении Шмуэль Йосеф Чачкес, Бучач как место рождения и Реховот как место смерти; указывает 26 июля 1888 года."],
      ["Hebrew University of Jerusalem", "https://masterjewishprogram.huji.ac.il/blog/sy-agnon-importance-being-where-our-history-was-written", "Университетский материал обсуждает биографию Агнона и указывает 26 июля 1888 года, обращая внимание на историю с датой рождения писателя."],
    ],
    decision: "unchanged",
    notes: "Исходная биография кратка, нейтральна и полностью подтверждается. Точный день рождения расходится в авторитетных источниках: Nobel Prize указывает 17 июля, BnF и материал Еврейского университета - 26 июля; год 1888 не вызывает разногласий.",
  },
  {
    key: "israel:zeruya_shalev",
    originalSha256: "dd881485c785bc6cbee07c3618fa4ea1af5d095d166f38657550a5e2bfbd8173",
    reviewedTextRu: "Цруя Шалев (род. 1959) - израильская писательница и литературный редактор. Среди её романов - «Love Life», «Husband and Wife» и «Thera».",
    evidence: [
      ["Institute for the Translation of Hebrew Literature", "https://www.ithl.org.il/writer/zeruya-shalev/", "Подтверждает рождение в кибуце Кинерет, работу литературным редактором и библиографию, включающую «Love Life», «Husband and Wife» и «Thera»."],
      ["Piper Verlag", "https://www.piper.de/autoren/zeruya-shalev-4888", "Указывает 1959 год и кибуц на берегу Галилейского моря как место рождения, а также подтверждает основные романы писательницы."],
    ],
    decision: "corrected",
    notes: "Выбранные независимые профили подтверждают только год рождения. Текущую дату 1959-04-13 нельзя считать проверенной; в справочных материалах встречается иной месяц, поэтому её следует снять до прямой authority-проверки.",
  },
  {
    key: "italy:alberto_moravia",
    originalSha256: "3df59e9e0744cfad2a2409a7f9c932e328fb080115e2c8d3a6eed45e41238040",
    reviewedTextRu: "Альберто Моравиа (1907-1990; настоящее имя Альберто Пинкерле) - итальянский писатель, эссеист и журналист. Среди его романов - «Равнодушные», «Римлянка» и «Чочара».",
    evidence: [
      ["Treccani", "https://www.treccani.it/enciclopedia/alberto-moravia/", "Подтверждает псевдоним Альберто Пинкерле, рождение и смерть в Риме в 1907 и 1990 годах, литературную и журналистскую деятельность и романы «Gli indifferenti», «La romana» и «La ciociara»."],
      ["Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark%3A/12148/cb119167384", "Authority-запись подтверждает точные даты и Рим как место рождения и смерти, настоящее имя Альберто Пинкерле и занятия романиста, эссеиста и журналиста."],
    ],
    decision: "corrected",
    notes: "Оценочный суперлатив заменён конкретными сведениями о псевдониме, занятиях и произведениях.",
  },
  {
    key: "italy:alessandro_baricco",
    originalSha256: "920172c72432cfb5482e344d4008c6cfc79418f4bb313fb6fa4fc750fb90f3c9",
    reviewedTextRu: "Алессандро Барикко (род. 1958) - итальянский писатель, драматург, эссеист и музыкальный критик. Среди его книг - «Море-океан», «Шёлк» и «Такая история».",
    evidence: [
      ["Treccani", "https://www.treccani.it/enciclopedia/alessandro-baricco/", "Подтверждает рождение в Турине в 1958 году, литературную и музыкально-критическую деятельность и книги «Oceano mare», «Seta» и «Questa storia»."],
      ["Feltrinelli", "https://alessandrobaricco.feltrinellieditore.it/lautore/", "Авторский профиль издательства подтверждает Турин, 1958 год, занятия литературой и музыкой и библиографию автора."],
    ],
    decision: "corrected",
    notes: "Формулировка «один из наиболее известных» удалена как оценочная; её заменяют жанры деятельности и проверенные названия книг.",
  },
  {
    key: "italy:alessandro_manzoni",
    originalSha256: "cec48a81631287db0d809aaf88c72ff4084299c33dfa1dfaa515aabaa145102a",
    reviewedTextRu: "Алессандро Мандзони (1785-1873) - итальянский писатель, поэт и драматург, чья работа над языком романа «Обручённые» повлияла на формирование общенациональной литературной нормы. Среди его произведений также «Священные гимны» и «История позорного столба».",
    evidence: [
      ["Treccani", "https://www.treccani.it/enciclopedia/alessandro-manzoni_%28Enciclopedia-dell%27Italiano%29/", "Подтверждает годы жизни, работу Мандзони над языком «Обручённых», значение этой работы для итальянской языковой нормы, а также «Inni sacri» и «Storia della colonna infame»."],
      ["Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark%3A/12148/cb11914342s", "Authority-запись подтверждает точные даты, Милан как место рождения и смерти и занятия романиста, драматурга и поэта."],
    ],
    decision: "corrected",
    notes: "Пункт «История итальянской революции» не является точным названием подтверждённого произведения: возможно смешение с незавершённым сравнительным эссе о Французской революции 1789 года и Итальянской революции 1859 года. В основную библиографию без уточнения его не переносить.",
  },
  {
    key: "italy:andrea_camilleri",
    originalSha256: "4ca73569c60a0030b42dda6a107b0b14282de755eef1213d1dfa7da6ac88e5f8",
    reviewedTextRu: "Андреа Камиллери (1925-2019) - итальянский писатель, сценарист и театральный деятель, создатель цикла о комиссаре Монтальбано. В цикл входят романы «Форма воды», «Собака из терракоты» и «Голос скрипки».",
    evidence: [
      ["Treccani", "https://www.treccani.it/enciclopedia/andrea-camilleri_%28Enciclopedia-Italiana%29/", "Подтверждает рождение 6 сентября 1925 года в Порто-Эмпедокле, литературную, сценарную и театральную деятельность и цикл о комиссаре Монтальбано."],
      ["Sellerio", "https://www.sellerio.it/upload/assets/files/876%2Cit%2C14067/15122-att.pdf", "Издательский материал подтверждает годы 1925-2019, Порто-Эмпедокле и Рим, а также обширный цикл произведений о Монтальбано."],
    ],
    decision: "corrected",
    notes: "Оценочное слово «популярной» удалено; характеристика заменена жанровыми сведениями и проверенной привязкой трёх романов к циклу.",
  },
  {
    key: "italy:baldassare_castiglione",
    originalSha256: "4b552fb3eaa00dd4dfeb683d69ab417046fbe68035de042efb0bfb76a7b86311",
    reviewedTextRu: "Бальдассаре Кастильоне (1478-1529) - итальянский писатель и дипломат эпохи Возрождения. Его диалог «Книга о придворном», напечатанный в Венеции в 1528 году, посвящён нормам поведения и образования придворного.",
    evidence: [
      ["Treccani", "https://www.treccani.it/enciclopedia/baldassarre-castiglione_%28Enciclopedia-dell%27Italiano%29/", "Подтверждает рождение 6 декабря 1478 года в Казатико, дипломатическую деятельность, смерть в Толедо в феврале 1529 года и публикацию «Il libro del cortegiano» в Венеции в 1528 году."],
      ["Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark%3A/12148/cb123195492", "Authority-запись подтверждает годы 1478-1529, Казатико, Толедо, авторство «Il libro del cortegiano» и занятия писателя, философа и поэта; указывает 7 февраля как день смерти."],
    ],
    decision: "corrected",
    notes: "Текущая дата смерти 1529-02-02 не подтверждается. Авторитетные источники расходятся между 7 и 8 февраля 1529 года, поэтому точный день нельзя устанавливать без дополнительной сверки первичных документов.",
  },
  {
    key: "italy:carlo_goldoni",
    originalSha256: "911d32fd379684f5f9a86f6db770e2eb5efcd707e3e5f49fc32c7031aed6b430",
    reviewedTextRu: "Карло Гольдони (1707-1793) - итальянский драматург, чья работа была связана с реформой итальянского комического театра. Среди его пьес - «Слуга двух господ», «Трактирщица» и «Кьоджинские перепалки».",
    evidence: [
      ["Treccani", "https://www.treccani.it/enciclopedia/carlo-goldoni/", "Подтверждает годы и места жизни, работу Гольдони над реформой комедии и авторство «Il servitore di due padroni» и «La locandiera»."],
      ["Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark%3A/12148/cb11905320h", "Authority-запись подтверждает рождение 25 февраля 1707 года в Венеции, смерть 6 февраля 1793 года в Париже и занятие драматурга."],
    ],
    decision: "corrected",
    notes: "Оценочный суперлатив заменён проверяемой характеристикой театральной реформы и конкретными пьесами.",
  },
  {
    key: "italy:cesare_beccaria",
    originalSha256: "dfa9f1f324e18f1e646aa16da3e20d2db64a57cdcdc0b347351dc2ef108e722f",
    reviewedTextRu: "Чезаре Беккариа (1738-1794) - итальянский юрист и экономист эпохи Просвещения. В трактате «О преступлениях и наказаниях» (1764) он выступил против пыток и смертной казни и за соразмерность наказания преступлению.",
    evidence: [
      ["Treccani", "https://www.treccani.it/enciclopedia/cesare-beccaria/", "Подтверждает годы жизни, занятия юриста и экономиста, принадлежность к Просвещению и содержание трактата «Dei delitti e delle pene», впервые изданного в 1764 году."],
      ["Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark%3A/12148/cb11890868c", "Authority-запись подтверждает точные даты, Милан как место рождения и смерти, занятия юриста, криминолога и философа и авторство «Dei delitti e delle pene»."],
    ],
    decision: "corrected",
    notes: "Расплывчатое и оценочное определение «автор важнейших трудов» заменено названием единственного произведения из карточки и проверяемыми положениями трактата.",
  },
  {
    key: "italy:cesare_pavese",
    originalSha256: "372130bd2748a33e5dba818a46d59a9bb58ab970571caf4ca0c43c36e0a83a10",
    reviewedTextRu: "Чезаре Павезе (1908-1950) - итальянский писатель, поэт, переводчик и редактор. Среди его произведений - «Товарищ», «Дом на холме» и «Луна и костры»; он также переводил на итальянский язык англоязычную прозу.",
    evidence: [
      ["Treccani", "https://www.treccani.it/enciclopedia/cesare-pavese/", "Подтверждает рождение в Санто-Стефано-Бельбо в 1908 году, смерть в Турине в 1950 году, работу писателя и переводчика англоязычной литературы и книги «Il compagno» и «La luna e i falò»."],
      ["Fondazione Cesare Pavese", "https://fondazionecesarepavese.it/cesare-pavese-vita-opere/", "Фонд подтверждает рождение 9 сентября 1908 года в Санто-Стефано-Бельбо, основные этапы литературной работы и связь «La luna e i falò» с родными местами писателя."],
    ],
    decision: "corrected",
    notes: "Оценочная формула «один из наиболее значительных» и жёсткая классификация как представителя неореализма заменены проверяемыми занятиями и библиографией.",
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
      evidence: seed.evidence.map(([provider, url, findingRu]) => ({
        provider,
        url,
        checkedAt,
        findingRu,
      })),
    }],
    reviewer,
    decision: seed.decision,
    notes: seed.notes,
  };
}

export const writerBiographyFactReviewBatch33: readonly WriterBiographyFactReviewRecord[] =
  seeds.map(finalizeReviewRecord);
