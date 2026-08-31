export const WRITER_BIOGRAPHY_FACT_REVIEW_BATCH57_REVIEWER =
  "Codex independent claim-by-claim factual review, batch 57";

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

const reviewer = WRITER_BIOGRAPHY_FACT_REVIEW_BATCH57_REVIEWER;
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
    key: "vietnam:bao_ninh",
    originalSha256: "c292deef501b7c2b61e4d7b61285ebd5ff6da217cada35ee551768567637fb07",
    reviewedTextRu: "Бао Нинь (род. 1952; настоящее имя - Хоанг Ау Фыонг) - вьетнамский писатель, автор романа «The Sorrow of War» («Печаль войны»). В 1969-1975 годах он проходил военную службу.",
    evidence: [
      e("NXB Trẻ", "https://www.nxbtre.com.vn/en/authors/bao-ninh-4641.html", "Вьетнамское издательство указывает настоящее имя Hoàng Ấu Phương, рождение 18 октября 1952 года в провинции Нгеан, военную службу в 1969-1975 годах и авторство Nỗi buồn chiến tranh (The Sorrow of War)."),
      e("VietnamPlus", "https://en.vietnamplus.vn/vietnamese-novel-about-war-wins-asia-literature-award-2018-post141895.vnp", "Национальное информационное агентство Вьетнама подтверждает настоящее имя Hoàng Ấu Phương, 1952 год рождения, военную службу и авторство The Sorrow of War."),
    ],
    decision: "corrected",
    notes: "Расплывчатая характеристика заменена установленными именем, биографическим опытом и произведением. Сведения Penguin Random House о рождении в Ханое расходятся с биографией вьетнамского издательства NXB Trẻ, которая указывает 18 октября 1952 года и провинцию Нгеан; для профильных данных выбран локальный издательский источник, а неподтверждённые координаты очищены.",
  },
  {
    key: "vietnam:duong_thu_huong",
    originalSha256: "58100c0c24eb7b331a07ad79402096c51cb76cd39755c45a278284ab359ed9e9",
    reviewedTextRu: "Дуонг Тху Хыонг (род. 1947) - вьетнамская писательница, автор романов «Paradise of the Blind» и «Novel Without a Name»; в 2023 году она получила Всемирную премию Чино дель Дука.",
    evidence: [
      e("PEN America", "https://pen.org/profile/duong-thu-huong/", "PEN подтверждает 1947 год рождения, литературную деятельность Дуонг Тху Хыонг и романы Paradise of the Blind и Novel Without a Name."),
      e("Institut de France", "https://www.institutdefrance.fr/actualites/le-prix-mondial-cino-del-duca-2023-remis-a-duong-thu-huong/", "Институт Франции документирует присуждение писательнице Всемирной премии Чино дель Дука 2023 года и её вьетнамскую биографию."),
    ],
    decision: "corrected",
    notes: "Общие темы заменены проверяемыми произведениями и премией; точность даты рождения снижена до подтверждённого года.",
  },
  {
    key: "vietnam:nam_cao",
    originalSha256: "695f84b7343872c3923d7868936e718775c7a3b0fe7b7b81795a16fc43d3b105",
    reviewedTextRu: "Нам Као - псевдоним Чан Хыу Чи (1917-1951), вьетнамского писателя и журналиста. Он написал рассказы «Chí Phèo» и «Lão Hạc», а также роман «Sống mòn».",
    evidence: [
      e("Vietnam Writers Association", "https://vanvn.vn/nha-van-nam-cao-1917-1951-tieu-su-van-hoc/", "Союз писателей Вьетнама приводит настоящее имя Trần Hữu Tri, даты 29 октября 1917 - 30 ноября 1951 и произведения Chí Phèo, Lão Hạc и Sống mòn."),
      e("Bibliothèque nationale de France", "https://data.bnf.fr/en/12057076/nam_cao/", "Авторитетная запись BnF независимо подтверждает псевдоним Нам Као, годы 1917-1951 и литературное авторство."),
    ],
    decision: "corrected",
    notes: "Исправлен ошибочный 1915 год рождения, удалено оценочное ранжирование и добавлены настоящее имя и документированные произведения.",
  },
  {
    key: "vietnam:nguyen_cong_hoan",
    originalSha256: "3d2296603649cb130fd5fc5e6a587ecaa36e0b72e42140de29e73789f16a2a57",
    reviewedTextRu: "Нгуен Конг Хоан (1903-1977) - вьетнамский писатель, автор сборника рассказов «Kép Tư Bền» и романа «Bước đường cùng».",
    evidence: [
      e("Провинция Хынгйен", "https://en.hungyen.gov.vn/nguyen-cong-hoan-1903-1977-c257.html", "Официальная биография провинции подтверждает даты 1903-1977, рождение в Суанкау и авторство Kép Tư Bền и Bước đường cùng."),
      e("Vietnam Writers Association", "https://vanvn.vn/phat-hien-che-phong-cua-vua-bao-dai-ban-khen-nha-van-nguyen-cong-hoan/", "Союз писателей Вьетнама независимо подтверждает дату рождения 6 марта 1903 года и называет среди произведений Нгуен Конг Хоана Bước đường cùng и Kép Tư Bền."),
      e("OpenStreetMap", "https://www.openstreetmap.org/node/13347246643", "Картографическая запись фиксирует положение деревни Суанкау в общине Нгиачу провинции Хынгйен и используется только для исправления координат карточки."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование заменено жанрами и названиями книг; место рождения исправлено с Ханоя на деревню Суанкау в провинции Хынгйен.",
  },
  {
    key: "vietnam:nguyen_du",
    originalSha256: "9504825ed60623f86bd6af9a07bfe348e007d1e0203003fd65c1766917b372a7",
    reviewedTextRu: "Нгуен Зу (год рождения указывается как 1765 или 1766; умер в 1820 году) - вьетнамский поэт, написавший поэму «Truyện Kiều» («Повесть о Киеу») на основе китайского прозаического сюжета.",
    evidence: [
      e("Library of Congress", "https://www.loc.gov/resource/gdcwdl.wdl_14287/?st=gallery", "Библиотека Конгресса датирует жизнь Нгуен Зу 1765-1820 годами и подтверждает его авторство Truyện Kiều, основанной на китайском романе."),
      e("Институт исследований Хан-Ном, Вьетнамская академия общественных наук", "https://hannom.vass.gov.vn/web/tchn/DATA1/0201v.htm", "Академическое исследование документирует расхождение 1765/1766 и объясняет, что точная дата 3 января 1766 года основана на поздней приписке к одной из родословных, надёжность которой вызывает сомнения."),
      e("Правительство Вьетнама", "https://baochinhphu.vn/nguyen-du-thi-hao-nhan-dao-chu-nghia-cua-nhan-loai-102153381.htm", "Правительственный портал указывает рождение в Тханглонге и приводит традиционную дату года Ất Dậu как 3 января 1766 года по григорианскому календарю, отмечая принятую во Вьетнаме датировку от 1765 года; также подтверждены смерть 16 сентября 1820 года и источник сюжета Truyện Kiều."),
    ],
    decision: "corrected",
    notes: "Оценочные превосходные степени удалены, название исправлено и авторство сформулировано точно. Источники расходятся между традиционным 1765 годом и пересчётом предполагаемой лунной даты в 3 января 1766 года; исследование Института Хан-Ном считает позднюю приписку с точным днём недостаточно надёжной, поэтому точный год и день в профиле очищены. Место рождения приведено только к подтверждённому уровню Тханглонга, без неподтверждённой конкретизации квартала.",
  },
  {
    key: "vietnam:vu_trong_phung",
    originalSha256: "3a48784d69a2d2fd8fc30c75d276328b594bc3372855c158ae594ed0f922fab1",
    reviewedTextRu: "Ву Чонг Фунг (1912-1939) - вьетнамский писатель и журналист, автор сатирического романа «Số đỏ» и романа «Giông tố».",
    evidence: [
      e("Провинция Хынгйен", "https://en.hungyen.gov.vn/vu-trong-phung-1912-1939-c266.html", "Официальная биография подтверждает даты 20 октября 1912 - 13 октября 1939, журналистскую и литературную работу и романы Số đỏ и Giông tố."),
      e("Ho Chi Minh City University of Education Journal of Science", "https://journal.hcmue.edu.vn/index.php/hcmuejos/article/view/2356/0", "Рецензируемый университетский журнал независимо подтверждает авторство Ву Чонг Фунга и анализирует его сатирический роман Số đỏ (Dumb Luck)."),
    ],
    decision: "corrected",
    notes: "Оценочное ранжирование заменено датами, профессиями и конкретными произведениями.",
  },
  {
    key: "yemen:abdullah_al_baradouni",
    originalSha256: "a06533b90f0c7fd94f3a99985c620d4bb63e67308684d432325319a4f2a5a3c8",
    reviewedTextRu: "Абдулла аль-Бардуни (родился приблизительно в 1929 или 1930 году; умер в 1999 году) - йеменский поэт и литературный критик, автор сборника «مدينة الغد» («Город завтрашнего дня»).",
    evidence: [
      e("Sultan Bin Ali Al Owais Cultural Foundation", "https://www.alowais.com/wp-content/uploads/2020/05/%D8%B9%D8%A8%D8%AF%D8%A7%D9%84%D9%84%D9%87-%D8%A7%D9%84%D8%A8%D8%B1%D8%AF%D9%88%D9%86%D9%8A-%D8%A7%D9%84%D8%B4%D8%A7%D8%B9%D8%B1-%D8%A7%D9%84%D8%A8%D8%B5%D9%8A%D8%B1-21.pdf", "Исследовательское издание фонда указывает приблизительное рождение между 1929 и 1930 годами и прямо отмечает, что точный год неизвестен."),
      e("Al-Babtain Central Library for Arabic Poetry", "https://albabtainlibrary.org/wp-content/uploads/2020/10/Book-2.pdf", "Библиотечное издание независимо приводит рождение в 1929 году в деревне Аль-Бардуна района Аль-Хада, смерть в 1999 году и перечень поэтических книг, включая The City of Tomorrow."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование заменено занятиями и библиографическим фактом. Исследование фонда Аль-Овайса прямо указывает, что точный год рождения не установлен и оценивается как 1929 или 1930; искусственное 1 января и однозначный год очищены. Число сборников не фиксируется, поскольку справочные источники по-разному считают прижизненные и посмертные издания. Место рождения исправлено на деревню Аль-Бардуна, а прежние координаты Саны удалены как относящиеся к другому месту.",
  },
  {
    key: "yemen:ali_ahmad_bakathir",
    originalSha256: "93da9e51ed21236c81862d2322afc18c15afce36bfbad258485a6906ddee5d97",
    reviewedTextRu: "Али Ахмад Бакасир (1910-1969) - родившийся в Сурабае писатель хадрамаутского происхождения, создававший на арабском языке романы, пьесы и стихи. Среди его произведений - романы «Wa Islamah» и «al-Tha'ir al-Ahmar» («The Red Revolutionary»).",
    evidence: [
      e("Журнал Al Arabi", "https://alarabi.nccal.gov.kw/Home/Article/13881", "Издание Национального совета культуры Кувейта подтверждает рождение Бакасира в Сурабае 21 декабря 1910 года, хадрамаутское происхождение, жизнь в Египте и литературные жанры."),
      e("University of Edinburgh", "https://era.ed.ac.uk/server/api/core/bitstreams/c74f323f-a8f6-4dc0-b6dc-a3960c8d5685/content", "Университетское исследование независимо документирует биографию Бакасира и романы Wa Islamah и al-Tha'ir al-Ahmar."),
    ],
    decision: "corrected",
    notes: "Оценочная формула заменена проверяемыми происхождением, жанрами и произведениями; неподтверждённая «Трагедия Ухуда» удалена из профиля.",
  },
  {
    key: "yemen:habib_abdulrab_sarori",
    originalSha256: "e590724cce946b025eeb3e3873990690ebf1b6c322e6a84ba9ca85de22428ed0",
    reviewedTextRu: "Хабиб Абдул Раб Сарори (род. 1956 в Адене) - йеменский романист, специалист по информатике и профессор Руанского университета. Он написал роман «Suslov's Daughter» («Дочь Суслова»).",
    evidence: [
      e("Banipal", "https://www.banipal.co.uk/contributors/649/habib_abdulrab__sarori/", "Литературный журнал подтверждает рождение в Адене в 1956 году, работу романиста и профессора информатики в Руане и библиографию автора."),
      e("International Prize for Arabic Fiction", "https://archive.arabicfiction.org/ar/node/157", "Официальный профиль премии независимо указывает, что Хабиб Абдулраб Сарори - родившийся в 1956 году йеменский романист и профессор информатики в Руане, и подтверждает авторство «Дочери Суслова»."),
    ],
    decision: "corrected",
    notes: "Неясная «научная проза» заменена документированной академической профессией; ошибочное название «Дочь Сусанны» исправлено. Точный день рождения, приведённый только на личном сайте автора, не подтверждён независимыми источниками и не добавляется в профиль.",
  },
  {
    key: "yemen:mohammed_abdul_wali",
    originalSha256: "3f13a25f67e2760b93c45a710af8913a0524596bbfe0b5804eec8bcb9f3aa8b4",
    reviewedTextRu: "Мухаммад Абдулвали (год рождения указывается как 1939 или 1940; умер в 1973 году) - родившийся в Эфиопии йеменский прозаик и дипломат. Он написал повесть «They Die Strangers» и роман «Sana'a: An Open City».",
    evidence: [
      e("Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark%3A/12148/cb12107281p", "Авторитетная запись BnF указывает рождение 12 ноября 1939 года в Дэбрэ-Бырхане, Эфиопия, смерть в апреле 1973 года и занятия писателя и дипломата."),
      e("University of Texas Press", "https://utpress.utexas.edu/9780292705081/they-die-strangers/", "Университетское издательство подтверждает рождение Абдулвали в Эфиопии в йеменской семье, его литературную биографию и авторство They Die Strangers."),
      e("University of California, Merced", "https://escholarship.org/content/qt3td73577/qt3td73577_noSplash_b59089ce14383b34f14bd53ab77a27a1.pdf", "Университетская диссертация приводит иной год рождения - 1940 - и подтверждает эфиопско-йеменское происхождение, дипломатическую службу и авторство They Die Strangers."),
    ],
    decision: "corrected",
    notes: "Общее утверждение заменено проверяемыми местом рождения, профессией и произведениями. BnF указывает 12 ноября 1939 года, тогда как независимые академические исследования Калифорнийского университета в Мерседе и другие работы приводят 1940 год; точная дата и однозначный год рождения поэтому очищены. Месяц смерти оставлен по каталогу BnF.",
  },
  {
    key: "yemen:wajdi_al_ahdal",
    originalSha256: "f98eb5ca90bbfc6fb4f45f6316ebe0ef98de0b116e9abce4a27c481a3fb23b82",
    reviewedTextRu: "Ваджди аль-Ахдал (род. 1973 в Ходейде) - йеменский романист и драматург. Он написал романы «Mountain Boats», «A Land Without Jasmine» и «A Land of Happy Conspiracies».",
    evidence: [
      e("International Prize for Arabic Fiction", "https://archive.arabicfiction.org/en/Wajdi-al-Ahdal-Nadwa2010", "Официальный профиль премии подтверждает рождение в Ходейде в 1973 году, работу романиста и драматурга и названия Mountain Boats и A Land Without Jasmine."),
      e("Katara Prize for Arabic Novel", "https://kataranovels.com/novelist/%D9%88%D8%AC%D8%AF%D9%8A-%D8%A7%D9%84%D8%A3%D9%87%D8%AF%D9%84/", "Официальный профиль литературной премии независимо подтверждает биографию аль-Ахдала и его романную и драматургическую библиографию."),
    ],
    decision: "corrected",
    notes: "Оценочная характеристика удалена, место рождения конкретизировано, а ошибочное название «Счастливая земля» заменено документированными произведениями; конфликтующая точная дата не утверждается.",
  },
  {
    key: "zambia:dominic_mulaisho",
    originalSha256: "4cf21d58cd9296b9b68e39184d754ad5b9dcde8d95d59a89a6b62685cfdfbbbb",
    reviewedTextRu: "Доминик Мулаишо (1933-2013) - замбийский романист и государственный служащий. Он написал романы «The Tongue of the Dumb» и «The Smoke That Thunders».",
    evidence: [
      e("University of Zambia", "https://dspace.unza.zm/bitstream/handle/123456789/7186/The%20Final%20Copy%20of%20the%20%20Dissertation-Trevor%20Mwansa.pdf", "Университетское исследование приводит годы 1933-2013, государственную и дипломатическую карьеру Мулаишо и анализирует The Tongue of the Dumb."),
      e("Lusaka Times", "https://www.lusakatimes.com/2013/07/02/president-sata-mourns-dominic-mulaisho/", "Современное сообщение подтверждает смерть Мулаишо у себя дома в Лусаке вечером воскресенья, его государственную службу, руководство Банком Замбии и авторство двух романов; публикация датирована 2 июля 2013 года."),
      e("National Assembly of Zambia", "https://www.parliament.gov.zm/node/677", "Парламентская стенограмма от 5 июля 2013 года независимо называет Мулаишо государственным советником и управляющим Банка Замбии и подтверждает авторство The Tongue of the Dumb и The Smoke That Thunders."),
    ],
    decision: "corrected",
    notes: "Интерпретационные и оценочные фразы заменены проверяемыми занятиями, датами и произведениями. Точный день рождения 15 августа не подтверждён независимыми авторитетными источниками, поэтому профиль приведён к установленному 1933 году. Дата смерти в справочниках расходится между 30 июня и 1 июля 2013 года, а современное сообщение говорит о вечере воскресенья 30 июня; профиль безопасно снижен до года без ложного выбора дня.",
  },
  {
    key: "zambia:ellen_banda_aaku",
    originalSha256: "2bdd1fc657180d2c089f537a34b1d3cbf913539a91f8c23d600ea4b808caed6c",
    reviewedTextRu: "Эллен Банда-Ааку (род. 1965 в Великобритании, выросла в Замбии) - замбийская писательница, автор детской книги «Wandi's Little Voice» и романа «Patchwork». Эти книги получили соответственно премию Macmillan для африканских писателей и премию Penguin за африканскую литературу.",
    evidence: [
      e("Bloomsbury", "https://www.bloomsbury.com/UK/author/ellen-bandaaaku/", "Издательская биография указывает рождение в Великобритании в 1965 году, детство в Замбии, книги Wandi's Little Voice и Patchwork и обе литературные премии."),
      e("University of Cape Town", "https://www.news.uct.ac.za/article/-2015-03-26-uct-great-minds-18-of-the-best-local-contemporary-writers", "Университет Кейптауна независимо подтверждает замбийскую принадлежность писательницы, её обучение и авторство Patchwork."),
    ],
    decision: "corrected",
    notes: "Интерпретация тем заменена проверяемыми биографическими данными, произведениями и премиями; точность даты рождения снижена до года. Уокинг как точное место рождения не подтверждён используемыми авторитетными источниками, поэтому в профиле оставлен установленный уровень страны.",
  },
  {
    key: "zimbabwe:charles_mungoshi",
    originalSha256: "f66f72a2a2a50bbf44e16218c459158326ceee4c074536835e2d69d89f9d62db",
    reviewedTextRu: "Чарльз Мунгоши (1947-2019) - зимбабвийский писатель, создававший романы, рассказы и детские книги на английском языке и шона. Среди его романов - «Waiting for the Rain».",
    evidence: [
      e("Bloomsbury", "https://www.bloomsbury.com/UK/author/charles-mungoshi/", "Издательская биография подтверждает даты 2 декабря 1947 - 16 февраля 2019, работу на английском и шона и роман Waiting for the Rain."),
      e("Store norske leksikon", "https://snl.no/Charles_Mungoshi", "Национальная энциклопедия независимо указывает годы жизни, зимбабвийскую принадлежность, два языка и литературные жанры Мунгоши."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование заменено датами, языками, жанрами и произведением.",
  },
  {
    key: "zimbabwe:chenjerai_hove",
    originalSha256: "6c0e79037f826813f1dfda3268ce0f2c9b6fc1f169c9912223eb2193545eb73a",
    reviewedTextRu: "Ченджераи Хове (год рождения в справочниках указан как 1954 или 1956; умер в 2015 году) - зимбабвийский поэт, романист и эссеист. Он написал роман «Bones» («Кости»).",
    evidence: [
      e("Store norske leksikon", "https://snl.no/Chenjerai_Hove", "Национальная энциклопедия указывает 1954-2015 годы, занятия поэта, романиста и эссеиста и роман Bones."),
      e("London School of Economics", "https://eprints.lse.ac.uk/75965/1/Africa%20at%20LSE%20%E2%80%93%20Renowned%20Zimbabwe%20Writer%20Chenjerai%20Hove%20Remembered.pdf", "Университетский некролог указывает иной год рождения - 1956, место Мазвихва, смерть 12 июля 2015 года и литературную деятельность Хове."),
    ],
    decision: "corrected",
    notes: "Исходное описание конкретизировано произведением; конфликт авторитетных источников о годе рождения зафиксирован без ложного выбора одной даты. Координаты очищены: источники подтверждают район Мазвихва, но не точку рождения, а исходная пара обозначала лишь приблизительную область.",
  },
  {
    key: "zimbabwe:doris_lessing",
    originalSha256: "556f28e8bbb357d5ff06942e64d21e2f313700b4707dc81ab97d61a98e84dbc9",
    reviewedTextRu: "Британская писательница, выросшая в Южной Родезии (современное Зимбабве), лауреат Нобелевской премии по литературе 2007 года.",
    evidence: [
      e("Nobel Prize", "https://www.nobelprize.org/prizes/literature/2007/lessing/", "Нобелевский фонд подтверждает рождение Дорис Лессинг 22 октября 1919 года в Керманшахе, переезд семьи в Южную Родезию и премию 2007 года."),
      e("University of East Anglia Archives", "https://archivecollections.uea.ac.uk/dl", "Университетский архив независимо подтверждает британскую литературную биографию, годы 1919-2013 и связь с Южной Родезией."),
    ],
    decision: "unchanged",
    notes: "Описание полностью подтверждено; отдельно исправлены ошибочные координаты места рождения, национальность и отсутствующее место смерти.",
  },
  {
    key: "zimbabwe:peter_godwin",
    originalSha256: "80ffc81e67b47273c47fd625908d4807e2170c6fe1eb103d5e206475aa147995",
    reviewedTextRu: "Питер Годвин (род. 1957) - зимбабвийский писатель и журналист, автор мемуаров «Mukiwa» и «When a Crocodile Eats the Sun», а также документальной книги «The Fear».",
    evidence: [
      e("PEN America", "https://pen.org/profile/peter-godwin/", "PEN характеризует Питера Годвина как родившегося и выросшего в Зимбабве автора, журналиста и бывшего юриста и перечисляет его мемуарные книги."),
      e("Oslo Freedom Forum", "https://oslofreedomforum.com/speaker/peter-godwin/", "Официальная биография форума независимо подтверждает зимбабвийское происхождение, журналистскую работу и книги Mukiwa, When a Crocodile Eats the Sun и The Fear."),
      e("Georgia Political Review, University of Georgia", "https://georgiapoliticalreview.com/exclusive-interview-with-peter-godwin-author/", "Университетское интервью указывает рождение Питера Годвина в Зимбабве в 1957 году и подтверждает его работу юриста, журналиста и автора The Fear."),
    ],
    decision: "corrected",
    notes: "Слишком общее исходное описание конкретизировано проверяемыми названиями книг; неподтверждённая точность дня рождения снижена до 1957 года.",
  },
  {
    key: "zimbabwe:solomon_mutswairo",
    originalSha256: "4812c7ed5fe620a6ab02722284e47fab72fb3163a101f20ca53d34a2fe70f6fe",
    reviewedTextRu: "Соломон Мутсвайро (1924-2005) - зимбабвийский писатель и поэт, автор «Feso», первого опубликованного романа на языке шона. Он также написал текст государственного гимна Зимбабве «Simudzai Mureza wedu WeZimbabwe».",
    evidence: [
      e("Store norske leksikon", "https://snl.no/Zimbabwes_litteratur", "Национальная энциклопедия называет Feso Соломона Мутсвайро первым романом, опубликованным на шона, и описывает его место в зимбабвийской литературе."),
      e("The Herald Zimbabwe", "https://www.heraldonline.co.zw/mutsvairo-quiet-student-who-became-a-guru/", "Биографическая статья подтверждает даты 26 апреля 1924 - ноябрь 2005, авторство Feso и текста государственного гимна Зимбабве."),
      e("Journal of Pan African Studies", "https://www.jpanafrican.org/docs/vol3no4/3.4SolomonMutsvairo.pdf", "Академическая статья указывает рождение Соломона Мутсвайро 26 апреля 1924 года в Заву (в источнике Zuwa), округ Мазове, и подтверждает его литературную деятельность."),
    ],
    decision: "corrected",
    notes: "Неопределённое «первый известный романист» заменено точным библиографическим фактом; добавлено документированное авторство гимна, а точность даты смерти снижена до подтверждённого месяца. Место рождения исправлено на Заву в округе Мазове; координаты Хараре удалены как относящиеся к другому месту.",
  },
  {
    key: "zimbabwe:tsitsi_dangarembga",
    originalSha256: "88d233851bebca9dc6260626c38e071eb9f9bec2691adc656203f7754715608e",
    reviewedTextRu: "Цици Дангарембга (род. 1959) - зимбабвийская писательница, режиссёр и общественный деятель, автор романов «Nervous Conditions», «The Book of Not» и «This Mournable Body».",
    evidence: [
      e("The Booker Prizes", "https://thebookerprizes.com/the-booker-library/authors/tsitsi-dangarembga", "Букеровская библиотека подтверждает рождение в Мутоко в 1959 году, работу писательницы и режиссёра и романы Nervous Conditions, The Book of Not и This Mournable Body; профиль указывает 4 февраля."),
      e("Peace Prize of the German Book Trade", "https://www.friedenspreis-des-deutschen-buchhandels.de/en/alle-preistraeger-seit-1950/2020-2029/tsitsi-dangarembga", "Официальная биография премии независимо подтверждает профессии и место рождения, но указывает 14 февраля 1959 года вместо 4 февраля у Букеровской премии."),
    ],
    decision: "corrected",
    notes: "Слово «современная» заменено устойчивыми биографическими фактами и названиями произведений; конфликт источников между 4 и 14 февраля не позволяет сохранять точный день рождения, поэтому оставлен только 1959 год.",
  },
  {
    key: "zimbabwe:yvonne_vera",
    originalSha256: "eee3d8b3ecd74805aece74998e13d275c55e594cdb1a7f86d896bdeacb44b115",
    reviewedTextRu: "Ивон Вера (1964-2005) - зимбабвийская писательница, создававшая романы и рассказы. Среди её книг - «Under the Tongue», «Butterfly Burning» и «The Stone Virgins».",
    evidence: [
      e("International Literature Festival Berlin", "https://literaturfestival.com/en/authors/yvonne-vera/", "Фестивальная биография подтверждает рождение в Булавайо в 1964 году, смерть в Торонто в 2005 году, сборник рассказов и романы Веры."),
      e("The Guardian", "https://www.theguardian.com/news/2005/apr/27/guardianobituaries.books", "Некролог независимо подтверждает точные даты рождения и смерти Ивон Веры - 19 сентября 1964 года и 7 апреля 2005 года - и её работу писательницы."),
      e("York University Archives", "https://atom.library.yorku.ca/yvonne-vera-fonds", "Архив Йоркского университета подтверждает рождение в Булавайо, литературную деятельность, смерть 7 апреля 2005 года и нахождение Веры в Торонто в последние годы жизни."),
    ],
    decision: "corrected",
    notes: "Ошибочная характеристика как поэтессы и оценочная формула удалены; жанры и произведения приведены по биографическим источникам. Точные даты 19 сентября 1964 года и 7 апреля 2005 года независимо подтверждены некрологом The Guardian и поэтому сохранены; место смерти исправлено на Торонто.",
  },
];

export const writerBiographyFactReviewBatch57: readonly WriterBiographyFactReviewRecord[] = seeds.map(
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
