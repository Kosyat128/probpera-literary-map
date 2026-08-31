export const WRITER_BIOGRAPHY_FACT_REVIEW_BATCH52_REVIEWER =
  "Codex independent claim-by-claim factual review, batch 52";

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

const reviewer = WRITER_BIOGRAPHY_FACT_REVIEW_BATCH52_REVIEWER;
const checkedAt = "2026-08-30";

type EvidenceSeed = readonly [provider: string, url: string, findingRu: string];

interface ReviewSeed {
  readonly key: string;
  readonly originalSha256: string;
  readonly reviewedTextRu: string;
  readonly evidence: readonly EvidenceSeed[];
  readonly decision: WriterBiographyFactReviewDecision;
  readonly notes: string;
}

function e(provider: string, url: string, findingRu: string): EvidenceSeed {
  return [provider, url, findingRu];
}

const seeds: readonly ReviewSeed[] = [
  {
    key: "syria:abu_al_ala_al_maarri",
    originalSha256: "5c751f11ca7276317a8824f615ecb65fb467cf6a00f8b9fc707191f8b401da3d",
    reviewedTextRu: "Абу аль-Ала аль-Маарри (973-1057) - арабский поэт и прозаик из Мааррат-ан-Нумана. Среди его произведений - «Послание о прощении» и поэтический сборник «Лузумият».",
    evidence: [
      e("Academy of American Poets", "https://poets.org/poet/al-maarri", "Биография подтверждает годы 973-1057, происхождение из Мааррат-ан-Нумана, поэтическое и прозаическое наследие автора."),
      e("Brill", "https://brill.com/display/book/9789004499287/BP000001.pdf", "Академическое введение к «Посланию о прощении» идентифицирует аль-Маарри и связывает с ним это произведение и «Лузумият»."),
    ],
    decision: "corrected",
    notes: "Заменена оценочная характеристика нейтральной справкой; даты оставлены в годовой точности, без пересчёта дат хиджры в вымышленные дни.",
  },
  {
    key: "syria:hanna_mina",
    originalSha256: "18a37ef0e09fe6a88eb97b54b4a5c3089c9d0b59c95ccd1181dedbb8d1cc18a7",
    reviewedTextRu: "Ханна Мина (1924-2018) - сирийский романист, родившийся в Латакии. Он написал романы «Blue Lamps» и «The Sail and the Storm».",
    evidence: [
      e("Banipal", "https://www.banipal.co.uk/contributors/1215/hanna-mina-1924%E2%80%932018/", "Профиль приводит даты 9 марта 1924 - 21 августа 2018 года, место рождения Латакию и прямо называет романы Blue Lamps (1954) и The Sail and the Storm (1966)."),
      e("Larousse", "https://www.larousse.fr/encyclopedie/litterature/Hanna_Mina/175358", "Литературная энциклопедия независимо подтверждает, что Мина - сирийский писатель, родившийся в Латакии в 1924 году и умерший в 2018 году, и перечисляет соответствующие романы 1954 и 1966 годов."),
    ],
    decision: "corrected",
    notes: "Оценочная формула об «основателе» романа исключена. Исходное русское название «Конец одного человека» не подтверждается как точное название произведения Мины; в профиль внесены два независимо документированных романа.",
  },
  {
    key: "syria:nizar_qabbani",
    originalSha256: "9beabbbff939476ab7d425636b51c9b82869ec7c99b60fef2ca4d7a78f398e4a",
    reviewedTextRu: "Низар Каббани (1923-1998) - сирийский поэт и бывший дипломат, родившийся в Дамаске. В его поэзии любовная лирика сочеталась с общественно-политическими темами.",
    evidence: [
      e("Treccani", "https://www.treccani.it/enciclopedia/nizar-qabbani/", "Энциклопедия подтверждает годы жизни, Дамаск, дипломатическую службу и развитие любовной и политической тематики."),
      e("Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark%3A/12148/cb12117818s", "Авторитетная запись BnF подтверждает идентичность, варианты имени и годы жизни Низара Каббани."),
    ],
    decision: "corrected",
    notes: "Вместо ранжирующей формулы дана проверяемая справка о профессиях, происхождении и тематике.",
  },
  {
    key: "syria:salim_barakat",
    originalSha256: "d1a2858c197298751728bc3ed6a1517122a542ba86e848dbee336abf64597fb5",
    reviewedTextRu: "Салим Баракат (род. 1951) - курдско-сирийский поэт и романист, пишущий на арабском языке. Он родился в Камышлы и позднее жил в Бейруте, на Кипре и в Швеции.",
    evidence: [
      e("Banipal", "https://www.banipal.co.uk/contributors/118/Salim%20Barakat/", "Профиль сообщает, что арабоязычный курдский автор родился в 1951 году в Камышлы, и описывает его последующие места жительства."),
      e("Poetry Foundation", "https://www.poetryfoundation.org/poets/salim-barakat", "Биографическая справка подтверждает Камышлы, 1951 год, курдско-сирийскую принадлежность и работу в поэзии и прозе."),
    ],
    decision: "corrected",
    notes: "Исправлено место рождения: источники называют Камышлы, а не Кобани; русское написание имени унифицировано с текстом карточки.",
  },
  {
    key: "syria:zakaria_tamer",
    originalSha256: "e746c6dc1ac7bfda5c7bf6ba56c410300d3dcd3319b04b34d618317a8c03f320",
    reviewedTextRu: "Закария Тамер (род. 1931) - сирийский автор короткой прозы и детской литературы, родившийся в Дамаске. Его сборник «Тигры на десятый день» вышел в 1978 году.",
    evidence: [
      e("Banipal", "https://www.banipal.co.uk/contributors/189/zakaria-tamer/", "Профиль подтверждает Дамаск, 1931 год, рассказы для взрослых и детей и библиографию автора."),
      e("Routledge Encyclopedia of Modernism", "https://www.rem.routledge.com/articles/tamir-zakariyya-1931", "Энциклопедическая статья подтверждает идентичность сирийского рассказчика и сведения о сборнике «Тигры на десятый день»."),
    ],
    decision: "corrected",
    notes: "Снята оценка «крупнейший»; жанры и издание названного сборника подтверждены независимо.",
  },
  {
    key: "taiwan:lai_he",
    originalSha256: "943134a96e8ecd7c8c5db11e0a31462beab9d7c4d4ae2ea728b7e3334b5ebf75",
    reviewedTextRu: "Лай Хэ (1894-1943) - тайваньский врач, поэт и прозаик, связанный со становлением новой тайваньской литературы. Он родился в Чжанхуа и писал в период японского правления на Тайване.",
    evidence: [
      e("Ministry of Culture, Taiwan", "https://www.moc.gov.tw/en/News_Content2.aspx?n=481&s=17486", "Министерство культуры подтверждает годы жизни, медицинскую профессию, Чжанхуа и роль Лай Хэ в новой литературе Тайваня."),
      e("University of North Texas Digital Library", "https://digital.library.unt.edu/ark%3A/67531/metadc1248416/m2/1/high_res_d/LU-DISSERTATION-2018.pdf", "Университетское исследование независимо характеризует Лай Хэ как фигуру ранней новой тайваньской литературы и рассматривает его творчество в колониальном контексте."),
    ],
    decision: "corrected",
    notes: "Обобщение конкретизировано профессией, местом рождения и историко-литературным контекстом.",
  },
  {
    key: "taiwan:li_ang",
    originalSha256: "52ba66e9d5058009bc2cdcafe72c710a11bb33abb852905557e7486c1df7cf04",
    reviewedTextRu: "Ли Ан (род. 1952; настоящее имя Ши Шудуань) - тайваньская писательница из Лугана. Её повесть «Жена мясника» исследует гендерные отношения и насилие в патриархальном обществе.",
    evidence: [
      e("Massachusetts Institute of Technology", "https://web.mit.edu/ccw/li-ang/biography.shtml", "MIT подтверждает настоящее имя, рождение 7 апреля 1952 года в Лугане и сведения о «Жене мясника»."),
      e("National Chung Hsing University", "https://taiwan.nchu.edu.tw/content.php?a=%E9%A7%90%E6%A0%A1%E4%BD%9C%E5%AE%B6&b=%E7%B3%BB%E6%89%80%E6%88%90%E5%93%A1&c=ut&id=50d652d4-bc15-4b9d-9b54-f4e52c8fd393", "Университетская справка независимо подтверждает имя, дату и место рождения писательницы и её литературную деятельность."),
    ],
    decision: "corrected",
    notes: "Заменено ошибочное название произведения в профиле; дата 7 апреля подтверждается институциональными биографиями и оставлена.",
  },
  {
    key: "taiwan:pai_hsien_yung",
    originalSha256: "e5d626b78e08c22025123774d19464352fdff61a04e7c016140523ca015954fc",
    reviewedTextRu: "Бай Сянъюн (род. 1937) - китайскоязычный прозаик, родившийся в Гуйлине и связанный с литературой Тайваня. Он преподавал в Калифорнийском университете в Санта-Барбаре; среди его произведений - «Тайбэйцы» и «Хрустальные мальчики».",
    evidence: [
      e("University of California, Santa Barbara", "https://www.eastasian.ucsb.edu/people/emeritus/kenneth-hsien-yung-pai/", "Профиль почётного профессора подтверждает преподавание Бай Сянъюна в UCSB и его литературную работу."),
      e("Chinese University of Hong Kong", "https://www.cpr.cuhk.edu.hk/resources/press/pdf/4d5a2312c72bd.pdf", "Университетская биографическая справка подтверждает рождение в Гуйлине в 1937 году и основные произведения автора."),
    ],
    decision: "corrected",
    notes: "Убрана ранжирующая оценка и исправлены названия произведений в профиле.",
  },
  {
    key: "taiwan:wang_wenxing",
    originalSha256: "ba07d0320b95295bc330cc2613fc38252ce19aa22041cd87cec6304082921ea9",
    reviewedTextRu: "Ван Вэньсин (1939-2023) - тайваньский писатель-модернист и преподаватель, родившийся в Фучжоу. Он был одним из основателей журнала «Современная литература» и автором романа «Семейная катастрофа».",
    evidence: [
      e("National Culture and Arts Foundation", "https://www.ncafroc.org.tw/artist_detail.html?id=1264", "Фонд указывает дату рождения 4 ноября 1939 года, Фучжоу, преподавание и литературные сведения."),
      e("National Taiwan University Library", "https://www.lib.ntu.edu.tw/events/2024_WangWenHsing/", "Университетская библиотека независимо приводит 4 ноября 1939 года и описывает журнал и роман Ван Вэньсина."),
    ],
    decision: "corrected",
    notes: "Исправлена дата рождения: две тайваньские институции указывают 4 ноября 1939 года, а не 24 марта.",
  },
  {
    key: "taiwan:wu_ming_yi",
    originalSha256: "6194de5a6f6d8cd81f9267077dfcbaca3509cd0a4ea2baf6412f95845219964c",
    reviewedTextRu: "У Минъи (род. 1971) - тайваньский романист и преподаватель литературы. Среди его книг - «Человек с фасеточными глазами» и «Похищенный велосипед».",
    evidence: [
      e("Books from Taiwan", "https://booksfromtaiwan.moc.gov.tw/authors_info.php?id=68", "Портал Министерства культуры Тайваня называет У Минъи писателем и профессором, указывает, что он преподаёт литературу в Национальном университете Дунхуа, и связывает с ним роман The Stolen Bicycle."),
      e("National Dong Hwa University", "https://sys.ndhu.edu.tw/RD/TeacherTreasury/TList.aspx?tcher=10129", "Университетская карточка независимо подтверждает принадлежность Wu, Ming-Yi к кафедре синофонной литературы Национального университета Дунхуа."),
      e("Penguin Random House", "https://www.penguinrandomhouse.com/books/221242/the-man-with-the-compound-eyes-by-wu-ming-yi/", "Страница издателя подтверждает рождение автора на Тайване в 1971 году, преподавание литературы и авторство книги The Man with the Compound Eyes."),
    ],
    decision: "corrected",
    notes: "Привязанная ко времени общая формула заменена проверяемыми сведениями о профессии и книгах; оценочные характеристики и ранжирование не используются.",
  },
  {
    key: "taiwan:zhong_lihe",
    originalSha256: "9665b8de4866ff2f0603776b57fee9644823db5f8423a7b269e2fc9f18006e1c",
    reviewedTextRu: "Чжун Ли-хэ (1915-1960) - тайваньский писатель хакка, чья проза связана с сельской жизнью и историей Тайваня. В его память в Мэйно действует литературный мемориальный музей.",
    evidence: [
      e("Ministry of Culture, Taiwan", "https://www.moc.gov.tw/en/News_Content2.aspx?n=506&s=18407&sms=10737", "Министерство культуры описывает мемориальный музей Чжун Ли-хэ в Мэйно и место автора в литературе хакка."),
      e("National Central Library, Taiwan", "https://manu.ncl.edu.tw/nclmanuscripth/author/AQ/170602/auth_life.html", "Национальная библиотека приводит даты 15 декабря 1915 - 4 августа 1960 и характеризует автора как писателя хакка, обращавшегося к сельской жизни."),
      e("Chinese University of Hong Kong", "https://www.cuhk.edu.hk/renditions/authors/zhonglh.html", "Университетская литературная база независимо подтверждает годы 1915-1960 и роль Чжун Ли-хэ в развитии сельской прозы Тайваня."),
    ],
    decision: "corrected",
    notes: "Оценочное слово «классик» заменено проверяемой характеристикой литературного контекста и музея. Исправлена дата рождения: национальные библиотечные записи указывают 15 декабря 1915 года, а не 6 ноября.",
  },
  {
    key: "tajikistan:abulqasim_lahuti",
    originalSha256: "b6db3bf6789c218d2bc6a56488fbcf41d58ae035cec71c81e30db9d8601d7dfe",
    reviewedTextRu: "Абулькасим Лахути (1887-1957) - персоязычный поэт и политический деятель, родившийся в Керманшахе. После эмиграции в СССР он участвовал в литературной жизни Таджикистана и писал на персидском языке.",
    evidence: [
      e("Encyclopaedia Iranica", "https://www.iranicaonline.org/articles/lahuti-abul-qasem/", "Статья указывает рождение 12 октября 1887 года в Керманшахе, смерть 16 марта 1957 года и эмиграцию в СССР."),
      e("UNESCO Silk Roads Programme", "https://en.unesco.org/silkroad/sites/default/files/knowledge-bank-article/vol_VI%20silk%20road_literature%20in%20persian%20and%20other%20indo%20iranian%20languages.pdf", "Академический обзор UNESCO рассматривает Лахути в истории персидской и таджикской литературы XX века."),
    ],
    decision: "corrected",
    notes: "Исправлена дата рождения с 12 декабря на 12 октября 1887 года; национально-литературная атрибуция сформулирована без упрощения биографии эмигранта.",
  },
  {
    key: "tajikistan:bozor_sobir",
    originalSha256: "617c08b6d987a3c4b640ffb709b5f6000f96b72ceb2bc10d9dd2879d0c308484",
    reviewedTextRu: "Бозор Собир (1938-2018) - таджикский поэт и бывший депутат, родившийся в селе Суфиён Файзабадского района. Он умер в Сиэтле 1 мая 2018 года.",
    evidence: [
      e("Radio Free Europe/Radio Liberty", "https://www.rferl.org/a/tajikistan-bozor-sobir-poet-former-opposition-figure-dies-at-79/29204740.html", "RFE/RL подтверждает профессию, парламентскую деятельность и смерть поэта в Сиэтле в 2018 году."),
      e("Asia-Plus", "https://asiaplustj.info/en/news/tajikistan/society/20180501/tajik-prominent-poet-bozor-sobir-dies", "Asia-Plus указывает 20 ноября 1938 года, село Суфиён Файзабадского района и смерть 1 мая 2018 года."),
    ],
    decision: "corrected",
    notes: "Нейтрализована оценка; уточнены место рождения и место смерти по независимым новостным биографиям.",
  },
  {
    key: "tajikistan:fazliddin_muhammadiev",
    originalSha256: "e7bc12f2498e503c3035b1099580fb4219d6c634fca98fc0f78d871853230aa7",
    reviewedTextRu: "Фазлиддин Мухаммадиев (1928-1986) - таджикский прозаик и журналист, родившийся в Самарканде. Он писал рассказы, повести и романы на таджикском языке.",
    evidence: [
      e("Encyclopaedia Iranica", "https://www.iranicaonline.org/articles/muhammadiev-fazliddin/", "Статья подтверждает рождение 15 июня 1928 года в Самарканде, смерть 6 октября 1986 года в Душанбе и литературную карьеру."),
      e("National Library of Tajikistan", "https://kmt.tj/95-soli-navisandai-hal-ii-tojikiston-fazliddin-muhammadiev/", "Национальная библиотека подтверждает годы жизни, работу в таджикской прозе и основные этапы биографии."),
    ],
    decision: "corrected",
    notes: "Вместо оценочной характеристики перечислены подтверждённые профессии и жанры; профильные даты согласуются с источниками.",
  },
  {
    key: "tajikistan:mirzo_tursunzoda",
    originalSha256: "b3aa02c5764298222a965fcf17a3f90d2bfc9064b23404ff669ab403b939c90d",
    reviewedTextRu: "Мирзо Турсунзаде (1911-1977) - таджикский поэт и общественный деятель, родившийся в Каратаге. Он возглавлял Союз писателей Таджикистана и был первым председателем республиканского Комитета защиты мира.",
    evidence: [
      e("National Library of Tajikistan", "https://kmt.tj/ru/russkij-mirzo-tursun-zade-dostojnyj-syn-tadzhikskogo-naroda/", "Национальная библиотека подтверждает годы жизни, Каратаг, поэтическую деятельность и руководящие должности."),
      e("Tajik National University", "https://fmi.tnu.tj/ru/mirzo-tursunzade/", "Университетская статья независимо подтверждает биографию и общественную деятельность Турсунзаде."),
    ],
    decision: "corrected",
    notes: "Ранжирующая оценка заменена фактами о литературной и общественной деятельности.",
  },
  {
    key: "tajikistan:muhammadjon_shakuri",
    originalSha256: "fc3c272d3bd9e874e0068e4e3fc7f91c63c431ed0f5f2e613a99d811d052d1d4",
    reviewedTextRu: "Мухаммаджон Шакури (1925-2012) - таджикский филолог, литературовед и исследователь языка, родившийся в Бухаре. Он работал в Институте языка и литературы Академии наук Таджикистана.",
    evidence: [
      e("Encyclopaedia Iranica", "https://www.iranicaonline.org/articles/shokurov-mohammadjan/", "Iranica указывает февраль 1925 года, Бухару, смерть 16 сентября 2012 года и работу в Академии наук."),
      e("National Library of Tajikistan", "https://old.kmt.tj/node/829", "Национальная библиотека подтверждает личность, бухарское происхождение, филологическую и литературоведческую деятельность; год рождения на её страницах передаётся непоследовательно."),
    ],
    decision: "corrected",
    notes: "В источниках встречается расхождение 1925/1926; текст использует дату академической Iranica и не усиливает точность далее месяца, уже указанного в профиле.",
  },
  {
    key: "tajikistan:rudaki",
    originalSha256: "7eeaa2f1e85ee89cf90be4a5657cdcec7bf0aded7082d8f33c9e5f7189e61fde",
    reviewedTextRu: "Рудаки (около 858-941) - персидский поэт эпохи Саманидов, значительная часть жизни которого была связана с их двором в Бухаре. Сохранилась лишь часть приписываемого ему поэтического наследия.",
    evidence: [
      e("Encyclopaedia Iranica", "https://www.iranicaonline.org/articles/rudaki/", "Iranica датирует рождение приблизительно 243/858 годом, смерть 329/941 годом и описывает службу при дворе Саманидов."),
      e("United Nations", "https://www.un.org/sg/en/content/sg/speeches/2008-06-18/remarks-commemoration-ceremony-1150th-anniversary-birth-rudaki", "Материал ООН подтверждает приблизительную хронологию и место Рудаки в персидско-таджикской литературной традиции."),
    ],
    decision: "corrected",
    notes: "Искусственные даты 1 января удалены: источники дают приблизительный год рождения и год смерти, без дня и месяца.",
  },
  {
    key: "tajikistan:sadriddin_ayni",
    originalSha256: "c26c90517fb9f83c3f4541280db4a1da6f6fc0a1451035425aafc5193c8472d9",
    reviewedTextRu: "Садриддин Айни (1878-1954) - таджикский писатель, историк и филолог, писавший на таджикском и узбекском языках. Он был первым президентом Академии наук Таджикской ССР.",
    evidence: [
      e("Encyclopaedia Iranica", "https://www.iranicaonline.org/articles/ayni-sadr-al-din/", "Статья подтверждает годы жизни, литературную, историческую и филологическую работу Айни на таджикском и узбекском."),
      e("Ministry of Foreign Affairs of Tajikistan", "https://mfa.tj/tg/main/view/6696/sadriddin-aini", "Официальная биография подтверждает даты жизни и роль Айни в науке, литературе и культурной истории Таджикистана."),
    ],
    decision: "corrected",
    notes: "Формула «основоположник» заменена более конкретными, институционально подтверждаемыми фактами.",
  },
  {
    key: "tajikistan:sattor_tursun",
    originalSha256: "1cb3fac77e5f08fe41acc97e1c57647f5df992c9575e8f6dc8bbc409aa261ab4",
    reviewedTextRu: "Саттор Турсун (1946-2023) - таджикский прозаик и драматург, родившийся в Байсунском районе. Он умер в Душанбе 5 июня 2023 года.",
    evidence: [
      e("Radio Free Europe/Radio Liberty", "https://www.azattyqasia.org/a/32446425.html", "Сообщение подтверждает смерть Саттора Турсуна вечером 5 июня 2023 года, возраст и литературную деятельность."),
      e("Khovar National Information Agency", "https://khovar.tj/rus/2026/02/pomnit-i-chtit-ego-budut-vsegda/", "Официальное агентство приводит годы 1946-2023, Байсунский район и характеризует автора как прозаика и драматурга."),
    ],
    decision: "corrected",
    notes: "Карточка ошибочно представляла автора живым; добавлены год и дата смерти, а общее место рождения уточнено.",
  },
  {
    key: "tajikistan:timur_zulfikarov",
    originalSha256: "b7e56ddb6f989fcd7e36aa07d5ff86bf03387fe070c5331a8af08bf049b7fd04",
    reviewedTextRu: "Тимур Зульфикаров (род. 1936) - русскоязычный поэт и прозаик, родившийся в Душанбе. Его творчество включает поэзию, романы и эссе.",
    evidence: [
      e("National Library of Tajikistan", "https://kmt.tj/oshnoy-bo-osori-temur-zulfi-orov/", "Национальная библиотека подтверждает рождение в Душанбе в 1936 году и русскоязычное поэтическое и прозаическое творчество."),
      e("Al-Farabi Kazakh National University", "https://elibrary.kaznu.kz/wp-content/uploads/2021/06/vestnik-kaznu.-seriya-filologicheskaya_2017-165-1.pdf", "Филологическое исследование университета рассматривает поэзию и прозу Тимура Зульфикарова и подтверждает его литературную идентичность."),
    ],
    decision: "corrected",
    notes: "Общее описание конкретизировано местом рождения, языком и жанрами; спорных точных дат не добавлено.",
  },
  {
    key: "tanzania:abdulrazak_gurnah",
    originalSha256: "fe0639e630bc14c9b5506a77bb05d66f40a8eaa0b369564d69540dcb5668077f",
    reviewedTextRu: "Абдулразак Гурна (род. 1948) - писатель, родившийся на Занзибаре и пишущий на английском языке. В 2021 году он получил Нобелевскую премию по литературе; среди его романов - «Рай» и «Дезертирство».",
    evidence: [
      e("Nobel Prize Outreach", "https://www.nobelprize.org/prizes/literature/2021/bio-bibliography/", "Официальная биобиблиография подтверждает рождение на Занзибаре в 1948 году, английский язык, романы и Нобелевскую премию 2021 года."),
      e("University of Kent", "https://www.kent.ac.uk/english/people/200/gurnah-abdulraz", "Университетский профиль подтверждает занзибарское происхождение, 1948 год, академическую карьеру и библиографию Гурны."),
    ],
    decision: "corrected",
    notes: "Оставлен подтверждённый год рождения без неподтверждённой источниками дня-месяца; гражданская и культурная биография сформулирована без сведения автора к одной стране.",
  },
  {
    key: "tanzania:ebrahim_hussein",
    originalSha256: "43daa45239cf02df6e8c8b9f981ea7611bf307914a5166a0a6be13045ca9e276",
    reviewedTextRu: "Эбрахим Хусейн (род. 1943) - танзанийский драматург и исследователь театра, пишущий на суахили. Его пьесы, включая «Kinjeketile», изучаются в контексте современного восточноафриканского театра.",
    evidence: [
      e("Kenyatta University", "https://ir-library.ku.ac.ke/server/api/core/bitstreams/d9135aa8-b42b-4959-92c5-886618310943/content", "Университетская диссертация указывает рождение в Линди в 1943 году и рассматривает биографию и драматургию Эбрахима Хусейна."),
      e("African Union Library", "https://library.au.int/ebrahim-hussein-th%C3%A9%C3%A2tre-swahili-et-nationalisme-tanzanien-26", "Каталог библиотеки Африканского союза, напротив, называет местом рождения Килву; тем самым подтверждает географическое расхождение и необходимость очистить поле."),
      e("White Rose eTheses, University of Leeds", "https://etheses.whiterose.ac.uk/id/eprint/26094/1/289801.pdf", "Университетское исследование рассматривает Хусейна и «Kinjeketile» в истории современного танзанийского и суахилийского театра."),
    ],
    decision: "corrected",
    notes: "Исправлено русское имя и удалено искусственное 1 января: надёжные источники подтверждают только 1943 год. Место рождения не утверждается: биографические источники расходятся между Линди и Килвой, поэтому поле очищено.",
  },
  {
    key: "tanzania:euphrase_kezilahabi",
    originalSha256: "0906bcef9c047504ac5c3a2a16ad28dc078e9c5a649ce7be6803c2e4d17ec0d4",
    reviewedTextRu: "Эфрас Кезилахаби (1944-2020) - танзанийский поэт, романист и литературовед, писавший на суахили. Он преподавал африканскую литературу в Университете Ботсваны.",
    evidence: [
      e("Poetry Translation Centre", "https://www.poetrytranslation.org/poet/euphrase-kezilahabi/", "Профиль подтверждает годы 1944-2020, танзанийское происхождение, суахилийскую поэзию, прозу и академическую деятельность."),
      e("University of Bayreuth", "https://www.afrikanistik.uni-bayreuth.de/en/Fol03---Team/Fol01---Former-Staff/Roberto-Gaudioso/index.php", "Университетская страница исследовательского проекта подтверждает Кезилахаби как поэта, романиста и учёного и его связь с Университетом Ботсваны."),
    ],
    decision: "corrected",
    notes: "Снята оценка «один из крупнейших»; русское имя приведено к закрепившейся форме «Эфрас Кезилахаби», добавлены проверяемые профессии и место работы.",
  },
  {
    key: "tanzania:muhammed_said_abdulla",
    originalSha256: "65419c13d1575a84ca7445356a9dfb455e0561ce6cebbd95a1b9e94d25b66818",
    reviewedTextRu: "Мухаммед Саид Абдулла (1918-1991) - занзибарский журналист и писатель, создававший детективную прозу на суахили. Его роман «Mzimu wa Watu wa Kale» положил начало циклу о сыщике Мса.",
    evidence: [
      e("Université de Lorraine", "https://ecritures.univ-lorraine.fr/sites/default/files/users/documents/livres/lmc_afr_06_livre_entier.pdf", "Академический обзор подтверждает биографию занзибарского автора и его роль в развитии детективного романа на суахили."),
      e("Open University of Tanzania", "https://repository.out.ac.tz/2912/1/TASNIFU%20YA%20RAHMA%20MOHAMED%20SAID.pdf", "Университетская работа приводит годы 1918-1991 и анализирует книги Абдуллы, включая цикл о детективе Мса."),
    ],
    decision: "corrected",
    notes: "Точная дата смерти 1 марта не получила согласованного подтверждения, поэтому сохранён только год 1991; в академических материалах встречается также ошибочный 1992 год.",
  },
  {
    key: "tanzania:said_ahmed_mohamed",
    originalSha256: "4ac204fa5a9b92e94bc63c74eb0c55d1c1f8618b9c732fa22737814c7059d01d",
    reviewedTextRu: "Саид Ахмед Мохамед (род. 1947) - занзибарский писатель и исследователь суахилийской литературы. Он писал романы, пьесы и стихи на суахили и преподавал литературу африканских языков в Байройтском университете.",
    evidence: [
      e("University of Bayreuth", "https://www.afrikanistik.uni-bayreuth.de/en/Fol03---Team/Fol01---Former-Staff/Prof_Dr_Said-Khamis/index.php", "Университетский профиль подтверждает академическую должность Саида А. Мохамеда/Хамиса и его работу с литературой на африканских языках."),
      e("University of Dodoma", "https://repository.udom.ac.tz/server/api/core/bitstreams/aa7a9a90-7ebe-4953-85d9-bff37d4fa929/content", "Академическая работа приводит рождение 12 декабря 1947 года на Занзибаре, образование и литературную деятельность автора."),
    ],
    decision: "corrected",
    notes: "Сведения исходной биографии сведены к независимо подтверждённым фактам; точная дата рождения сохранена как подтверждённая академической публикацией.",
  },
  {
    key: "tanzania:shaaban_robert",
    originalSha256: "c9164711a02e09fb51e68928e1fdaa816d3fe3502493a787bf44f04cf9612b1c",
    reviewedTextRu: "Шаабан Роберт (1909-1962) - танзанийский поэт, прозаик и эссеист, писавший на суахили. Его произведения включают автобиографическую прозу, стихи и утопический роман «Kusadikika».",
    evidence: [
      e("University of Kansas Libraries", "https://exhibits.lib.ku.edu/exhibits/show/swahili/swahililiterature/shaabanrobert", "Университетская выставка подтверждает роль Роберта в суахилийской литературе, жанры и основные произведения."),
      e("Store norske leksikon", "https://snl.no/Shaaban_Robert", "Норвежская энциклопедия подтверждает даты 1 января 1909 - 20 июня 1962 и работу поэта и писателя на суахили."),
    ],
    decision: "corrected",
    notes: "Оценочное слово «классик» заменено жанровой справкой; дата 1 января в данном случае подтверждается справочными источниками и не очищалась автоматически.",
  },
  {
    key: "thailand:chart_korbjitti",
    originalSha256: "bb171a55ceb11f253d744acd88ed66bda8abaca1882fa860deb5886719596c5f",
    reviewedTextRu: "Чарт Корбджитти (род. 1954) - тайский романист из провинции Самутсакхон. Его романы «Приговор» и «Время» были отмечены премией S.E.A. Write, а в 2004 году он получил звание национального художника Таиланда в области литературы.",
    evidence: [
      e("Words Without Borders", "https://wordswithoutborders.org/contributors/view/chart-korbjitti/", "Профиль подтверждает 1954 год, происхождение из Самутсакхона, романы и две премии S.E.A. Write, а также звание 2004 года."),
      e("Asphalte éditions", "https://asphalte-editions.com/gens/chart-korbjitti/", "Издательская биография независимо подтверждает тайского романиста, 1954 год и его основные произведения."),
    ],
    decision: "corrected",
    notes: "Ранжирующая оценка заменена конкретными произведениями и наградами; англоязычные названия в профиле переведены.",
  },
  {
    key: "thailand:kukrit_pramoj",
    originalSha256: "34c89fb6af666a83e620cb23e529013e78cc30b9d8b1ccdd7dd22cfa0afef86f",
    reviewedTextRu: "Кукрит Прамой (1911-1995) - тайский писатель, журналист и политик, занимавший пост премьер-министра Таиланда в 1975-1976 годах. Среди его романов - «Четыре царствования» и «Много жизней».",
    evidence: [
      e("Fukuoka Prize", "https://fukuoka-prize.org/en/laureates/detail/24036b38-8b85-450c-8c06-1ff885c6f6b5", "Официальная страница премии подтверждает годы жизни, писательскую и политическую деятельность Кукрита Прамоя."),
      e("L’Asiathèque", "https://www.asiatheque.com/en/contributor/kukrit-pramoj", "Издательская справка подтверждает биографию автора и романы «Four Reigns» и «Many Lives»."),
    ],
    decision: "corrected",
    notes: "Убрано субъективное ранжирование романа; литературная и политическая деятельность подтверждены институциональной премией и издателем.",
  },
  {
    key: "thailand:kulap_saipradit",
    originalSha256: "6d4fa743230a4f65899ae99295829c7d25bf1c69d09d8aab73e652e87a1b7b70",
    reviewedTextRu: "Кулап Сайпрадит (1905-1974), публиковавшийся под именем Сибурапа, - тайский писатель и журналист. Он написал роман «За картиной» (Khang Lang Phap).",
    evidence: [
      e("Suan Sunandha Rajabhat University Library", "https://library.ssru.ac.th/en/news/view/s31036501", "Университетская библиотека указывает рождение 31 марта 1905 года, псевдоним Сибурапа и журналистско-литературную деятельность."),
      e("University of Hamburg", "https://www.aai.uni-hamburg.de/en/soa/studium/fuer-studieninteressierte/schwerpunkte/schwerpunkt-thaiistik/thaiistik/seminare-thai/seminar-8--novel.html", "Университетский материал подтверждает автора, даты и роман «Behind the Painting» в истории тайской литературы."),
    ],
    decision: "corrected",
    notes: "Разведены настоящее имя и псевдоним; сохранён 1905 год, подтверждаемый тайской библиотекой и университетским источником, вопреки встречающемуся 1906 году.",
  },
  {
    key: "thailand:pira_sudham",
    originalSha256: "6e6f4850071fe3655b8576adf93863efb539c67ea8a7a29e6adaa0db73735ed2",
    reviewedTextRu: "Пира Судхам (род. 1942) - тайский писатель, создающий прозу на английском языке. Он родился в деревне Напо провинции Бурирам; сельская жизнь северо-востока Таиланда стала одной из тем его книг.",
    evidence: [
      e("Éditions Picquier", "https://www.editions-picquier.com/auteur/pira-sudham/", "Издательская биография указывает рождение в 1942 году в Напо, Бурирам, и англоязычную прозу о северо-востоке Таиланда."),
      e("British Club Bangkok", "https://www.britishclubbangkok.org/wp-content/uploads/2021/10/05-1989.pdf", "Архивная публикация независимо подтверждает происхождение Пиры Судхама, 1942 год и его англоязычную литературную деятельность."),
    ],
    decision: "corrected",
    notes: "Искусственное 1 января заменено подтверждённым годом; место рождения уточнено с региона Исан до деревни и провинции.",
  },
  {
    key: "thailand:prabda_yoon",
    originalSha256: "c3e0553994dd857648e2f06816e0430b7e62a880bc7c70cf10395b4f0a2c0b35",
    reviewedTextRu: "Прабда Юн (род. 1973) - тайский писатель, переводчик, дизайнер и кинематографист. Его сборник рассказов «The Sad Part Was» получил премию S.E.A. Write в 2002 году.",
    evidence: [
      e("Fukuoka Prize", "https://fukuoka-prize.org/files/download/en/LaureatesI18n/laureate_blocks/32a7752b-f153-478e-aa08-386649fec1d5/value01/value05", "Официальный профиль премии подтверждает рождение в 1973 году, многопрофильную творческую работу и S.E.A. Write 2002 года."),
      e("Tilted Axis Press", "https://www.tiltedaxispress.com/prabda-yoon", "Издательская биография подтверждает деятельность писателя, переводчика, дизайнера и режиссёра и его библиографию."),
    ],
    decision: "corrected",
    notes: "Субъективная оценка заменена профессиями, произведением и датированной наградой.",
  },
  {
    key: "thailand:saneh_sangsuk",
    originalSha256: "5177fc3f2cae72bea5535632872c523ca90e71613672637f3c508adda8c5637c",
    reviewedTextRu: "Санэ Сангсук (род. 1957), также публикующийся под именем Дан-Аран Сэнгтхонг, - тайский прозаик из провинции Пхетчабури. Его произведения включают «Venom» и «The Understory»; в 2018 году он был признан национальным художником Таиланда в области литературы.",
    evidence: [
      e("Department of Cultural Promotion, Thailand", "https://book.culture.go.th/artist/artist2561/files/downloads/01%E0%B8%A8%E0%B8%B4%E0%B8%A5%E0%B8%9B%E0%B8%B4%E0%B8%99%E0%B9%81%E0%B8%AB%E0%B9%88%E0%B8%87%E0%B8%8A%E0%B8%B2%E0%B8%95%E0%B8%B4%202561%20S%20.pdf", "Официальная книга о национальных художниках подтверждает имя, псевдоним, произведения и присвоение литературного звания в 2018 году."),
      e("Éditions Jentayu", "https://editions-jentayu.fr/saneh-sangsuk/", "Издательская справка подтверждает рождение в 1957 году в провинции Пхетчабури и литературную идентичность автора."),
    ],
    decision: "corrected",
    notes: "Точный день рождения очищен как неподтверждённый использованными источниками; добавлены псевдоним, провинция и официальное звание.",
  },
  {
    key: "timor_leste:fernando_sylvan",
    originalSha256: "4bcff058281c3fa67d3ec919b669e00aaddd05854276806335d7472dfac2aa06",
    reviewedTextRu: "Фернанду Силван (1917-1993) - поэт, эссеист и исследователь, родившийся в Дили и писавший на португальском языке. Он умер в Кашкайше 25 декабря 1993 года.",
    evidence: [
      e("Instituto Camões", "https://cvc.instituto-camoes.pt/oceanoculturas/eng/09.html", "Институт Камоэнса указывает 26 августа 1917 года в Дили - 25 декабря 1993 года в Кашкайше и описывает поэтическую и исследовательскую работу."),
      e("Oxford Academic", "https://academic.oup.com/liverpool-scholarship-online/book/17417/chapter/174913494", "Академическая глава подтверждает Фернанду Силвана как важного португалоязычного тиморского поэта и культурного деятеля XX века."),
    ],
    decision: "corrected",
    notes: "Исправлена дата смерти с 21 на 25 декабря 1993 года; национальная атрибуция оставлена через место рождения и язык.",
  },
  {
    key: "timor_leste:francisco_borja_da_costa",
    originalSha256: "36841a7ef4dca1b2a692849c0669ee5960390478c1493927ad2c056af972995d",
    reviewedTextRu: "Франсишку Боржа да Кошта (1946-1975) - тиморский поэт и журналист, автор текста национального гимна «Pátria». Он родился в Фату-Белаке и был убит в Дили 7 декабря 1975 года.",
    evidence: [
      e("Government of Timor-Leste", "https://timor-leste.gov.tl/?lang=en&p=10810&print=1", "Правительственная биография указывает рождение 14 октября 1946 года в Фату-Белаке, авторство гимна и гибель утром 7 декабря 1975 года."),
      e("Ministry of Justice of Timor-Leste", "https://www.mj.gov.tl/jornal/public/docs/2014/serie_1/SERIE_I_NO_36.pdf", "Официальная газета подтверждает государственное признание Франсишку Боржа да Кошты и связывает его с текстом гимна и событиями 7 декабря 1975 года."),
    ],
    decision: "corrected",
    notes: "Исправлено место рождения: официальный источник называет Фату-Белак, а не Дили; дата смерти 7 декабря сохранена вопреки распространённой ошибке 8 декабря.",
  },
  {
    key: "timor_leste:luis_cardoso",
    originalSha256: "03e7f5149b6bfd93c30032d436e7a570fe2f8de05ef299f0ee823f0c4bbd5cd3",
    reviewedTextRu: "Луиш Кардозу (род. 1958) - писатель из Восточного Тимора, создающий романы на португальском языке. Он родился в Кайлако, муниципалитет Бобонару, и позднее жил в Португалии.",
    evidence: [
      e("Tatoli", "https://pt.tatoli.tl/2023/08/18/o-meu-pais-tem-uma-literatura-oral-extraordinaria-luis-cardoso-condecorado-com-colar-da-ordem-de-timor-leste/", "Национальное агентство подтверждает 1958 год, Кайлако в Бобонару, португалоязычную литературную деятельность и последующую жизнь в Португалии."),
      e("And Other Stories", "https://www.andotherstories.org/authors/luis-cardoso/", "Издательская биография независимо указывает рождение в Кайлако в 1958 году и романы автора; точный день не приводит."),
    ],
    decision: "corrected",
    notes: "Источники расходятся между 6, 7 и 8 декабря, поэтому дата очищена до 1958 года; место рождения исправлено с Кайколи на Кайлако.",
  },
  {
    key: "tonga:epeli_hauofa",
    originalSha256: "9bf4acc77459070853709a20735357205629b464ec4d8b418ca8d2ca654070a6",
    reviewedTextRu: "Эпели Хауʻофа (1939-2009) - писатель и антрополог тонганского происхождения, родившийся в Папуа - Новой Гвинее. Он преподавал в Южнотихоокеанском университете и основал там Центр искусств и культуры Океании.",
    evidence: [
      e("University of the South Pacific", "https://www.usp.ac.fj/news/remembering-the-legacy-of-the-late-epeli-hauofa/", "Университет подтверждает работу Хауʻофы, основание Центра искусств и культуры Океании и его писательскую и антропологическую деятельность."),
      e("University of New England", "https://rune.une.edu.au/web/handle/1959.11/7688", "Университетский некролог подтверждает годы 1939-2009, тонганское происхождение, рождение в Папуа - Новой Гвинее и академическую карьеру."),
    ],
    decision: "corrected",
    notes: "Убрано оценочное ранжирование и очищен неподтверждённый точный день рождения; исправлена типографика имени и географического названия.",
  },
  {
    key: "trinidad_and_tobago:earl_lovelace",
    originalSha256: "71ca8c01be9d0420d929d2bb68462ed369c5213e7828d047562c09a2af4004f0",
    reviewedTextRu: "Эрл Лавлейс (род. 1935) - тринидадский романист и драматург, родившийся в Токо. Среди его произведений - романы «Дракон не может танцевать» и «Соль».",
    evidence: [
      e("University of the West Indies Press", "https://www.uwipress.com/9789766406899/earl-lovelace/", "Университетское издательство подтверждает полное имя Earl Wilbert Lovelace, рождение в Токо в 1935 году и основные романы."),
      e("Black Plays Archive", "https://www.blackplaysarchive.org.uk/playwrights/earl-lovelace/", "Архив драматургии подтверждает тринидадское происхождение, работу как романиста и драматурга и библиографию Лавлейса."),
    ],
    decision: "corrected",
    notes: "Снято субъективное ранжирование; уточнены полное имя и место рождения, а неподтверждённое русское название второго произведения заменено.",
  },
  {
    key: "trinidad_and_tobago:samuel_selvon",
    originalSha256: "6a6b2a7b539458cae1a34d1fbce284ae5d7cc3a4608dc1925c9ab2b350f28fea",
    reviewedTextRu: "Сэм Селвон (1923-1994) - тринидадский писатель, чья проза связана с карибской миграцией в Великобританию. Он родился в Сан-Фернандо и умер 16 апреля 1994 года во время поездки в Тринидад.",
    evidence: [
      e("University of the West Indies", "https://www.uwi.edu/vcinstallation/programme.pdf", "Официальная университетская программа указывает годы 1923-1994 и дату смерти 16 апреля 1994 года, а также биографию и произведения Селвона."),
      e("Routledge Encyclopedia of Modernism", "https://www.rem.routledge.com/articles/selvon-samuel-1923-1994-1", "Энциклопедическая статья подтверждает полное имя, Сан-Фернандо, миграцию в Великобританию и литературную карьеру Сэма Селвона."),
    ],
    decision: "corrected",
    notes: "Исправлены дата и место смерти: не 15 апреля в Калгари, а 16 апреля 1994 года в Пиарко; добавлено полное имя.",
  },
  {
    key: "trinidad_and_tobago:vs_naipaul",
    originalSha256: "c9440f38d360bc5588aa605a3fe5d141b8395525637fdda7b036424faaf2de77",
    reviewedTextRu: "Видиадхар Сураджпрасад Найпол (1932-2018) - британский прозаик и эссеист, родившийся в Тринидаде. В 2001 году он получил Нобелевскую премию по литературе; среди его главных романов - «Дом для мистера Бисваса».",
    evidence: [
      e("Nobel Prize Outreach", "https://www.nobelprize.org/laureate/747?from=NobelPress.org", "Официальная запись подтверждает полное имя, рождение 17 августа 1932 года в Чагуанасе, смерть 11 августа 2018 года в Лондоне и премию 2001 года."),
      e("The Booker Prizes", "https://thebookerprizes.com/the-booker-library/authors/vs-naipaul", "Официальный архив Букеровской премии подтверждает тринидадское происхождение, литературную карьеру и победу «In a Free State» в 1971 году."),
    ],
    decision: "corrected",
    notes: "Оценочное ранжирование заменено происхождением, жанрами и официально подтверждёнными наградами; заполнено полное имя.",
  },
  {
    key: "tunisia:abdelwahab_meddeb",
    originalSha256: "0bdcee5a056fda59774707ff4d9de8c690594caf5d55d1699c86037f70f17e7f",
    reviewedTextRu: "Абдельвахаб Меддеб (1946-2014) - родившийся в Тунисе франкоязычный писатель, поэт и эссеист, который также создавал радиопередачи. Он умер в Париже 5 ноября 2014 года.",
    evidence: [
      e("Le Monde", "https://www.lemonde.fr/disparitions/article/2014/11/06/mort-de-l-essayiste-et-romancier-abdelwahab-meddeb-1946-2014_4519799_3382.html", "Некролог сообщает, что писатель и эссеист умер в среду 5 ноября 2014 года, и подтверждает его тунисское происхождение и франкоязычное творчество."),
      e("Institut du monde arabe", "https://www.imarabe.org/fr/agenda/festivals/hommage-abdelwahab-meddeb", "Институт арабского мира подтверждает личность, годы 1946-2014 и работу Меддеба как писателя, поэта, эссеиста и радиоведущего."),
    ],
    decision: "corrected",
    notes: "Дата смерти 5 ноября подтверждена современным сообщением Le Monde и сохранена; распространённая дата 6 ноября относится к ошибочной вторичной передаче.",
  },
];

export const writerBiographyFactReviewBatch52: readonly WriterBiographyFactReviewRecord[] = seeds.map(
  (seed) => {
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
      claims: [
        {
          textRu: seed.reviewedTextRu,
          verdict,
          evidence: seed.evidence.map(([provider, url, findingRu]) => ({
            provider,
            url,
            checkedAt,
            findingRu,
          })),
        },
      ],
      reviewer,
      decision: seed.decision,
      notes: seed.notes,
    };
  }
);
