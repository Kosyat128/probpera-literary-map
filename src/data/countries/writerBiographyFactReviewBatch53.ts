export const WRITER_BIOGRAPHY_FACT_REVIEW_BATCH53_REVIEWER =
  "Codex independent claim-by-claim factual review, batch 53";

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

const reviewer = WRITER_BIOGRAPHY_FACT_REVIEW_BATCH53_REVIEWER;
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
    key: "tunisia:aboul_qacem_echebbi",
    originalSha256: "4f07fd238868e81ce89c184451bbc039035aa9888d22633cc9c8be4b13839879",
    reviewedTextRu: "Абу-ль-Касем аш-Шабби (1909-1934) - тунисский арабоязычный поэт. Его сборник «Aghānī al-ḥayāh» («Песни жизни») был издан посмертно.",
    evidence: [
      e("Национальная библиотека Туниса", "https://kitab.bnt.nat.tn/ar/autorite/67", "Авторитетная запись указывает годы 1909-1934, называет аш-Шабби тунисским поэтом и включает «Aghānī al-ḥayāh» в перечень его произведений."),
      e("Большая российская энциклопедия", "https://old.bigenc.ru/literature/text/4689505", "Энциклопедия приводит даты 24 февраля 1909 - 9 октября 1934 и характеризует аш-Шабби как тунисского арабского поэта."),
    ],
    decision: "corrected",
    notes: "Оценочное ранжирование удалено; оставлены подтверждённые годы жизни, род занятий и сборник.",
  },
  {
    key: "tunisia:ali_douagi",
    originalSha256: "0b9f0bd51872e4aa292f0704caa334a33a13f0e8a3f805d682717ec480ab6d14",
    reviewedTextRu: "Али Дуаги (1909-1949) - тунисский писатель и журналист, связанный с литературной группой «Под стенами» (Taht Essour). Среди его книг - «Sahirtu minhu al-layālī» и «Jawla bayna ḥānāt al-Baḥr al-Mutawassiṭ».",
    evidence: [
      e("Национальная библиотека Туниса", "https://kitab.bnt.nat.tn/ar/autorite/92", "Авторитетная запись сообщает даты 4 января 1909 - 27 мая 1949, занятия писателя и журналиста, участие в Taht Essour и названия произведений."),
      e("Тунисская академия наук, литературы и искусств «Бейт аль-Хикма»", "https://www.beitalhikma.tn/wp-content/uploads/2023/03/Publications-2011-2015.pdf", "Каталог академии документирует издание произведений Али Дуаги и его место в развитии современной тунисской новеллы."),
    ],
    decision: "corrected",
    notes: "Исправлена дата смерти: 27 мая, а не 27 ноября 1949 года; неточное русское название произведения заменено оригинальными заглавиями.",
  },
  {
    key: "tunisia:bechir_khraief",
    originalSha256: "07a2d8549a4eab54c5c230988d4a76850c1319464c7386d9dc7111dc126a1bd4",
    reviewedTextRu: "Башир Хреф (1917-1983) - тунисский романист, писавший по-арабски. К его произведениям относятся «Al-Digla fī ʿarājīnihā» и «Barg el-Lil».",
    evidence: [
      e("Национальная библиотека Франции", "https://catalogue.bnf.fr/ark:/12148/cb34964193s", "Авторитетная запись фиксирует форму имени Béchir Khraïef, годы 1917-1983 и библиографическое авторство книги «Al Degla fi arajiniha»."),
      e("Open Book Publishers", "https://books.openbookpublishers.com/10.11647/obp.0254.pdf", "Академическое издание называет Хрефа тунисским писателем 1917-1983 годов жизни и рассматривает его роман «Barg el-Lil»."),
    ],
    decision: "corrected",
    notes: "Исходные месяц и день рождения и смерти не подтверждаются выбранными авторитетными источниками и были заменены доказанными годами; «Ад-Дукана» не подтверждена как его произведение.",
  },
  {
    key: "tunisia:habib_selmi",
    originalSha256: "13b33bef518f330bca1649d143c1e4ef1a7fe498e828543d7609f2570caf8ec5",
    reviewedTextRu: "Хабиб Селми - тунисский романист, родившийся в 1951 году и живущий во Франции. Его роман «The Scents of Marie-Claire» вошёл в короткий список Международной премии по арабской прозе.",
    evidence: [
      e("International Prize for Arabic Fiction", "https://archive.arabicfiction.org/ar/node/1782", "Официальный архив премии сообщает, что Селми родился в 1951 году в Тунисе, живёт в Париже, и фиксирует номинацию «The Scents of Marie-Claire»."),
      e("American University in Cairo Press", "https://aucpress.com/9789774167409/", "Университетское издательство независимо называет Селми тунисским романистом 1951 года рождения и автором «The Scents of Marie-Claire»."),
    ],
    decision: "corrected",
    notes: "Оценка известности удалена; искусственная дата 1 января сокращена до подтверждённого года, а название произведения уточнено.",
  },
  {
    key: "tunisia:mahmoud_messadi",
    originalSha256: "209a42cb39951f6e1c2c559761579d27ab03d92be4ed013d7e3d8f308f73a60d",
    reviewedTextRu: "Махмуд Мессади (1911-2004) - тунисский арабоязычный писатель, драматург и государственный деятель. Среди его произведений - роман «Al-Sudd» («Плотина»).",
    evidence: [
      e("Институт арабского мира", "https://www.imarabe.org/sites/default/files/import_imarabe/files/documents/mahmoud_messadi_bibliographie_bibliotheque_institut_du_monde_arabe1.pdf", "Библиография библиотеки Института арабского мира фиксирует годы 1911-2004 и корпус произведений Махмуда Мессади."),
      e("Турецкая религиозная энциклопедия TDV", "https://islamansiklopedisi.org.tr/mesadi", "Энциклопедическая статья указывает рождение 28 января 1911 года, смерть в 2004 году, общественную деятельность и произведение «es-Südd» («Al-Sudd»)."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование удалено; добавлены проверяемые занятия и оригинальное название произведения.",
  },
  {
    key: "turkey:ahmet_hamdi_tanpinar",
    originalSha256: "56060c767a8a6ae66ccaa3611f494f74e9ab3acdd7111888931f496bb6593ed2",
    reviewedTextRu: "Ахмет Хамди Танпынар (1901-1962) - турецкий поэт, романист, эссеист и литературовед. Он написал роман «Saatleri Ayarlama Enstitüsü» («Институт настройки часов»).",
    evidence: [
      e("Турецкая религиозная энциклопедия TDV", "https://islamansiklopedisi.org.tr/tanpinar-ahmet-hamdi", "Статья указывает рождение 23 июня 1901 года, смерть 23 января 1962 года и литературную деятельность Танпынара."),
      e("Министерство культуры и туризма Турции", "https://www.ktb.gov.tr/EN-119827/tanpinar-ahmet-hamdi.html", "Официальная биография подтверждает дату рождения, перечисляет жанры и «Saatleri Ayarlama Enstitüsü», но датирует смерть 24 января 1962 года."),
    ],
    decision: "corrected",
    notes: "Оценочное ранжирование удалено. Авторитетные турецкие источники расходятся в точном дне смерти (23 или 24 января 1962 года), поэтому профиль ограничен годом.",
  },
  {
    key: "turkey:elif_shafak",
    originalSha256: "dfb98e9036ee4266b795d679f25224416e01fa23469de5e772163c01adef4047",
    reviewedTextRu: "Элиф Шафак - турецко-британская писательница, автор романов «The Bastard of Istanbul» и «The Forty Rules of Love», в которых затрагиваются темы культуры, истории и идентичности.",
    evidence: [
      e("The Booker Prizes", "https://thebookerprizes.com/the-booker-library/authors/elif-shafak", "Официальный профиль премии характеризует Шафак как турецко-британскую писательницу и перечисляет её романы."),
      e("Penguin Books", "https://www.penguin.co.uk/authors/32695/elif-shafak", "Издательский профиль независимо подтверждает авторство «The Bastard of Istanbul» и «The Forty Rules of Love»."),
    ],
    decision: "corrected",
    notes: "Смысл исходной нейтральной формулировки подтверждён; добавлены проверяемые названия двух романов без оценок.",
  },
  {
    key: "turkey:fuzuli",
    originalSha256: "27f3732221462bc8ae2b2dafab5283a4d6803ac75eb0f6226b5fe073b8258e91",
    reviewedTextRu: "Мухаммед ибн Сулейман Физули - поэт XVI века, живший на территории современного Ирака и писавший на азербайджанском тюркском, персидском и арабском языках. Ему принадлежат поэма «Leylî vü Mecnun» и диваны на трёх языках.",
    evidence: [
      e("Encyclopaedia Iranica", "https://www.iranicaonline.org/articles/fozuli/", "Академическая энциклопедия датирует жизнь приблизительно 1480-1556 годами, помещает поэта в Ираке и указывает его тюркские, персидские и арабские сочинения."),
      e("Турецкая религиозная энциклопедия TDV", "https://islamansiklopedisi.org.tr/fuzuli", "Статья называет его Мехмедом, сыном Сулеймана, подчёркивает неизвестность точных рождения и места рождения и подтверждает смерть в 963 году хиджры (1556)."),
      e("Большая российская энциклопедия", "https://bigenc.ru/wiki/%D0%A4%D0%B8%D0%B7%D1%83%D0%BB%D0%B8", "Русская академическая энциклопедия использует форму «Физули», также приводит вариант «Фузули», называет его азербайджанским поэтом и перечисляет три дивана."),
    ],
    decision: "corrected",
    notes: "Исправлены транслитерация и односторонняя привязка к Турции. Источники существенно расходятся в годе рождения, а точные 1 января 1483 и 1 января 1556 неисторичны; сохранён только надёжный год смерти.",
  },
  {
    key: "turkey:halide_edib",
    originalSha256: "2dbbca622bb4797fca25e771940fbba297353ec03e481f68c83358f44c2f8eb6",
    reviewedTextRu: "Халиде Эдиб Адывар (1884-1964) - турецкая писательница, публицистка и общественная деятельница. Она написала романы «Ateşten Gömlek» и «Sinekli Bakkal».",
    evidence: [
      e("Турецкая религиозная энциклопедия TDV", "https://islamansiklopedisi.org.tr/adivar-halide-edip", "Энциклопедия описывает писательскую и общественную деятельность Халиде Эдиб, датирует её жизнь 1884-1964 годами и перечисляет произведения."),
      e("Министерство культуры и туризма Турции", "https://www.ktb.gov.tr/EN-118055/adivar-halide-edip.html", "Официальная биография подтверждает 1884 год рождения, смерть 9 января 1964 года и романы «Ateşten Gömlek» и «Sinekli Bakkal»."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование удалено; день рождения 11 июня не подтверждён выбранными авторитетными источниками, поэтому оставлен только год.",
  },
  {
    key: "turkey:namik_kemal",
    originalSha256: "20762aab97b6f80ff871d0d6724f121b7c74036d87eeb138e6f7e83fa6f40f58",
    reviewedTextRu: "Намык Кемаль (1840-1888) - османский поэт, прозаик, драматург и публицист периода Танзимата. Он написал роман «İntibah» и пьесу «Vatan Yahut Silistre».",
    evidence: [
      e("Турецкая религиозная энциклопедия TDV", "https://islamansiklopedisi.org.tr/namik-kemal", "Энциклопедия приводит даты 21 декабря 1840 - 2 декабря 1888 и описывает литературную и публицистическую деятельность Намыка Кемаля."),
      e("Министерство культуры и туризма Турции", "https://www.ktb.gov.tr/EN-119434/namik-kemal.html", "Официальная биография независимо подтверждает даты и произведения «İntibah» и «Vatan Yahut Silistre»."),
    ],
    decision: "corrected",
    notes: "Широкое утверждение об «основателе» заменено конкретными историческим контекстом, занятиями и произведениями.",
  },
  {
    key: "turkey:nazim_hikmet",
    originalSha256: "57c835462b57ada6911827cbffa81416703e574c1b1d12f811bfdd37adf77fbe",
    reviewedTextRu: "Назым Хикмет (1902-1963) - турецкий поэт, драматург и прозаик. Среди его произведений - поэтический цикл «Memleketimden İnsan Manzaraları» («Человеческие пейзажи моей страны»).",
    evidence: [
      e("Министерство культуры и туризма Турции", "https://www.ktb.gov.tr/EN-119439/nazim-hikmet.html", "Официальная биография указывает даты 15 января 1902 - 3 июня 1963, жанры творчества и основные произведения Назыма Хикмета."),
      e("Фонд культуры и искусства Назыма Хикмета", "https://www.nazimhikmet.org.tr/nazim-hikmet/yasam-oykusu/", "Биографический архив фонда независимо подтверждает даты жизни и литературную деятельность поэта."),
    ],
    decision: "corrected",
    notes: "Оценочные эпитеты удалены; оставлены подтверждённые даты, литературные занятия и произведение.",
  },
  {
    key: "turkey:orhan_pamuk",
    originalSha256: "409d4983e6cfab9611737dc31cc9ff5d6a0a8ff02b4cca5955a4d26ba76499d9",
    reviewedTextRu: "Орхан Памук - турецкий писатель, удостоенный Нобелевской премии по литературе 2006 года. Среди его романов - «Меня зовут Красный», «Снег» и «Музей невинности».",
    evidence: [
      e("Нобелевский фонд", "https://www.nobelprize.org/prizes/literature/2006/pamuk/facts/", "Официальная страница премии указывает дату рождения 7 июня 1952 года и присуждение Орхану Памуку Нобелевской премии по литературе 2006 года."),
      e("Официальный сайт Орхана Памука", "https://www.orhanpamuk.net/", "Официальная библиография писателя подтверждает авторство романов «My Name Is Red», «Snow» и «The Museum of Innocence»."),
    ],
    decision: "corrected",
    notes: "Исходное утверждение полностью подтверждено; добавлены проверяемые названия произведений без оценочных формулировок.",
  },
  {
    key: "turkey:yunus_emre",
    originalSha256: "fd1a9704dbdd11e2f313a3f4b0ac2c732da8b90ea11b581944aa1bd4f7137075",
    reviewedTextRu: "Юнус Эмре - анатолийский суфийский поэт, обычно датируемый приблизительно 1240-1320 годами. С его именем связаны «Divan» и дидактическая поэма «Risâletü’n-Nushiyye».",
    evidence: [
      e("Турецкая религиозная энциклопедия TDV", "https://islamansiklopedisi.org.tr/yunus-emre", "Энциклопедия подчёркивает легендарность биографических сведений и обосновывает ориентировочные годы около 1240-1320."),
      e("Энциклопедия тюркского мира", "https://turkdunyasiansiklopedisi.gov.tr/detay/485/Yunus-Emre--", "Государственная энциклопедия рассматривает Юнуса Эмре как анатолийского суфийского поэта и связывает с ним «Divan» и «Risâletü’n-Nushiyye»."),
    ],
    decision: "corrected",
    notes: "Убраны оценочное ранжирование и ложная точность 1238-01-01/1328-01-01; даты жизни в источниках реконструируются приблизительно.",
  },
  {
    key: "turkmenistan:aman_kekilov",
    originalSha256: "1b0a3b526cde9e84b88e1c8328f8816a479aa26c71c5ff3dd6fecfb51afd6840",
    reviewedTextRu: "Аман Кекилов (1912-1974) - туркменский поэт, прозаик и литературовед. Он написал стихотворный роман «Söýgi» и труд «Edebiýat teoriýasy».",
    evidence: [
      e("Официальный портал города Аркадаг", "https://arkadag-shaheri.gov.tm/about-city/famous-personalities/1", "Официальная биографическая страница подтверждает годы 1912-1974, занятия поэта и учёного и перечисляет произведения Кекилова."),
      e("Национальная энциклопедия Узбекистана", "https://qomus.info/oz/encyclopedia/k/kekilov/", "Энциклопедическая статья независимо приводит даты 9 мая 1912 - 13 декабря 1974 и называет «Söýgi» среди его основных произведений."),
    ],
    decision: "corrected",
    notes: "Исправлены обе календарные даты и заменено родовое обозначение «поэтические сборники» на документированные названия произведений.",
  },
  {
    key: "turkmenistan:atajan_tagan",
    originalSha256: "c0d29f6fddacf33ca32a69e1869f8cb49255d0827f0d5fd8ec50d47bb3f30cd7",
    reviewedTextRu: "Атаджан Таган (15 мая 1940 - 21 декабря 2025) - туркменский писатель и драматург. Он написал романы «Keseki» и «Saragt galasy».",
    evidence: [
      e("Министерство культуры и туризма Турции", "https://ekitap.ktb.gov.tr/Eklenti/11832%2Catacantaganpdf.pdf?0=", "Официальное литературное издание приводит 1940 год рождения Атаджана Тагана и рассматривает его произведения, включая «Saragt galasy»."),
      e("Государственное информационное агентство Туркменистана", "https://turkmenistan.gov.tm/tk/habar/51232/atajan-taganyn-keseki-romanynyn-fransuz-nesirinin-jiltinin-dizayny-ses-bermek-arkaly-kesgitlener", "Государственный портал подтверждает авторство романа «Keseki» и статус Атаджана Тагана как туркменского писателя."),
      e("Zaman Türkmenistan", "https://zamanturkmenistan.com.tm/turkmen-edebiyatynyn-meshur-yazyjysy-atajan-tagan-aradan-cykdy/", "Некролог сообщает даты 15 мая 1940 - 21 декабря 2025 и перечисляет произведения «Keseki», «Lal perişde» и «Gowşut han»."),
    ],
    decision: "corrected",
    notes: "Исправлен год рождения 1951 на 1940, удалена искусственная дата 1 января и учтена смерть писателя в декабре 2025 года; родовое «современная проза» заменено названиями книг.",
  },
  {
    key: "turkmenistan:berdy_kerbabayev",
    originalSha256: "13606ae003c306eff5f56f3565da28cc94b47cd1d4fdd0b38c443f9639feb9d5",
    reviewedTextRu: "Берди Кербабаев (15 марта 1894 - 23 июля 1974) - туркменский писатель, поэт и переводчик. Среди его произведений - «Aýgytly ädim», «Nebitdag» и «Aýsoltan».",
    evidence: [
      e("Министерство культуры Туркменистана", "https://medeniyet.gov.tm/app/tk/art-world/16", "Официальная биография приводит даты 15 марта 1894 - 23 июля 1974 и произведения «Aýgytly ädim», «Nebitdag», «Aýsoltan»."),
      e("Государственное информационное агентство Туркменистана", "https://turkmenistan.gov.tm/en/post/83045/", "Государственный материал к 130-летию подтверждает литературную деятельность и основные произведения Берди Кербабаева."),
    ],
    decision: "corrected",
    notes: "Оценочная формулировка заменена фактами; 3 марта в исходном профиле - дата старого стиля, для современного поля указано 15 марта по григорианскому календарю.",
  },
  {
    key: "turkmenistan:chary_ashyrov",
    originalSha256: "91f716c0d06f81b5f2f37112444b1ef023306e722616fd4f0eb5e4df0fc3752c",
    reviewedTextRu: "Чары Ашыров (1910-2003) - туркменский писатель и драматург. К его произведениям относятся «Yzçy», «Ekizler», «Garry serdar» и «Göreş».",
    evidence: [
      e("Министерство культуры Туркменистана", "https://medeniyet.gov.tm/app/tk/art-world/169", "Официальная страница приводит годы 1910-2003, литературные занятия и произведения «Yzçy», «Ekizler», «Garry serdar», «Göreş»."),
      e("Центрально-Европейский университет", "https://www.etd.ceu.edu/2016/babayeva_maya.pdf", "Университетское исследование независимо рассматривает Чары Ашырова и его вклад в туркменскую литературу XX века."),
    ],
    decision: "corrected",
    notes: "Искусственные даты 1 января сокращены до подтверждённых годов; родовое обозначение произведений заменено конкретными названиями.",
  },
  {
    key: "turkmenistan:dowletmammet_azady",
    originalSha256: "6aa8c7270311e8d3012907fe9bd110c0ba7f211dbe71587a85080224518fdfad",
    reviewedTextRu: "Довлетмамед Азади - туркменский поэт и учёный XVIII века, отец Махтумкули. Его дидактическая поэма известна под названием «Wagzy-Azat»; источники расходятся между 1695 и 1700 годами рождения, тогда как год смерти 1760 подтверждается.",
    evidence: [
      e("Энциклопедия турецкой литературы имени Ахмета Ясави", "https://teis.yesevi.edu.tr/%2Bmadde-detay/azadi-dovletmemmet", "Университетская энциклопедия приводит годы 1700-1760, называет Азади поэтом и учёным и фиксирует произведение «Vagz-ı Azad»."),
      e("Академия наук Туркменистана", "https://science.gov.tm/storage/files/journals/104.pdf", "Академическое издание использует иную датировку 1695-1760, подтверждая невозможность указывать точный год рождения без оговорки."),
    ],
    decision: "corrected",
    notes: "Ложная точность 1 января удалена; из-за конфликта 1695/1700 поле рождения очищено, а название произведения уточнено.",
  },
  {
    key: "turkmenistan:kemine",
    originalSha256: "b72d9509037b09931d3885881c75f5b6359aff15929349e6cda849df324e6bea",
    reviewedTextRu: "Мехметвели Кемине (около 1770-1840) - туркменский поэт, известный сатирическими стихами и устными анекдотами. Точные дни его рождения и смерти источниками не установлены.",
    evidence: [
      e("Энциклопедия турецкой литературы имени Ахмета Ясави", "https://teis.yesevi.edu.tr/%20madde-detay/kemine", "Университетская энциклопедия называет настоящее имя Мехметвели, приводит годы около 1770-1840 и описывает стихи и анекдоты Кемине."),
      e("Турецкое лингвистическое общество", "https://erdem.gov.tr/eng/full-text-pdf/407/tur", "Академическая статья государственного научного журнала независимо рассматривает Кемине как классического туркменского поэта-сатирика."),
    ],
    decision: "corrected",
    notes: "Искусственные даты 1 января удалены; «Сатирические стихи» признано жанровым описанием, а не названием произведения.",
  },
  {
    key: "turkmenistan:kerim_kurbannepesov",
    originalSha256: "f791610e47a99bb10996cad4eb3b7a7036634f48e49a2e5ea641ad1ec995c9fa",
    reviewedTextRu: "Керим Курбаннепесов (18 октября 1929 - 1 сентября 1988) - туркменский поэт и редактор. Среди его книг - «Güýjümiň gözbaşy», «Taýmaz baba» и «Oýlanma baýry».",
    evidence: [
      e("Министерство культуры Туркменистана", "https://medeniyet.gov.tm/app/tk/posts/92", "Официальная биография указывает даты 18 октября 1929 - 1 сентября 1988, работу поэта и редактора и названия его книг."),
      e("Государственное информационное агентство Туркменистана", "https://www.turkmenistan.gov.tm/ru/post/54023/", "Государственный материал независимо подтверждает годы жизни, литературную деятельность и произведения Курбаннепесова."),
    ],
    decision: "corrected",
    notes: "Искусственные даты 1 января заменены точными подтверждёнными датами; родовое «поэтические сборники» заменено названиями книг.",
  },
  {
    key: "turkmenistan:magtymguly_pyragy",
    originalSha256: "713161a5dbf50c50919b5547db1afcd05474a19b6634a0929bd2f06855985475",
    reviewedTextRu: "Махтумкули Фраги - туркменский поэт и мыслитель XVIII века, обычно датируемый приблизительно 1724-1807 годами. Его поэзия сохранилась в рукописных списках, поэтому «Избранная лирика» обозначает позднейший тип издания, а не авторское название книги.",
    evidence: [
      e("Государственная миграционная служба Туркменистана", "https://migration.gov.tm/pages/magtymguly", "Официальная биографическая страница прямо указывает приблизительные годы жизни 1724-1807 и называет Фраги туркменским поэтом и мыслителем."),
      e("Museum Studies Abroad", "https://museumstudiesabroad.org/magtymguly-pyragy-nation/", "Академический музейный проект отмечает, что точные даты жизни оспариваются и обычно ограничиваются диапазоном не ранее 1724 и не позднее 1807 года."),
    ],
    decision: "corrected",
    notes: "Оценочное ранжирование и искусственные даты 1 января удалены; годы жизни оставлены приблизительными, а не являющееся авторским заглавием поле works очищено.",
  },
  {
    key: "turkmenistan:mollanepes",
    originalSha256: "2ceabd1f097475446d5f88d991b0f15a8822c4fbcd4d9eace996d989fc57da3e",
    reviewedTextRu: "Молланепес - туркменский поэт XIX века, автор дастана «Zöhre-Tahyr». Год рождения обычно указывают приблизительно как 1810-й, а в источниках год смерти расходится между 1862-м и примерно 1875-м.",
    evidence: [
      e("Энциклопедия турецкой литературы имени Ахмета Ясави", "https://teis.yesevi.edu.tr/madde-detay/mollanepes", "Университетская статья приводит традиционные годы 1810-1862, описывает Молланепеса как туркменского поэта и подтверждает «Zöhre-Tahyr»."),
      e("Большая российская энциклопедия", "https://bigenc.ru/c/mollanepes-c968f7", "Академическая энциклопедия указывает рождение около 1810 года и отмечает альтернативные сведения о смерти приблизительно в 1875 году вместо 1862-го."),
    ],
    decision: "corrected",
    notes: "Оценка масштаба и ложная точность 1 января удалены; конфликтующий год смерти очищен по принципу fail-closed, название дастана дано в оригинальной форме.",
  },
  {
    key: "uae:ahmad_rashid_thani",
    originalSha256: "a0b5a9e379a257927e284e384cbd32f1d86da40c44e748fe5e7a3c4f09032e78",
    reviewedTextRu: "Ахмад Рашид Тани - эмиратский поэт, драматург и исследователь культурного наследия, умерший 20 февраля 2012 года. Среди его книг - поэтический сборник «A Wave at the Door».",
    evidence: [
      e("Центр арабского языка Абу-Даби", "https://alc.ae/media/news/abu-dhabi-arabic-language-centre-s-esdarat-releases-new-edition-of-the-late-emirati-poet-ahmed-rashid-thani-s-a-wave-at-the-door/", "Официальный материал называет Тани эмиратским поэтом 1962-2012 годов жизни и подтверждает книгу «A Wave at the Door»."),
      e("Департамент культуры и туризма Абу-Даби - Энциклопедия поэзии", "https://poetry.dct.gov.ae/poets/3185-", "Официальная энциклопедия датирует его жизнь 1963-2012 годами, указывает смерть 20 февраля и перечисляет поэтические и исследовательские работы."),
    ],
    decision: "corrected",
    notes: "Исправлен ошибочный 2019 год смерти. Два официальных культурных источника расходятся в годе рождения (1962/1963), поэтому поле очищено.",
  },
  {
    key: "uae:habib_al_sayegh",
    originalSha256: "27a5952a38c7f4a94869c800cf4480afac19ca864b860a9859cd98095008c28d",
    reviewedTextRu: "Хабиб Юсеф ас-Сайег (8 февраля 1955 - 20 августа 2019) - эмиратский поэт, журналист и деятель писательских организаций. Он издал поэтические сборники, включая «Qaṣāʾid ʿalā baḥr al-baḥr» и «Kasr fī al-wazn».",
    evidence: [
      e("Департамент культуры и туризма Абу-Даби - Энциклопедия поэзии", "https://poetry.dct.gov.ae/poets/3219-", "Официальная энциклопедия указывает рождение 8 февраля 1955 года и перечисляет сборники Хабиба ас-Сайега."),
      e("Информационное агентство ОАЭ WAM", "https://www.wam.ae/en/article/hszr902i-emirati-poet-writer-habib-sayegh-dies", "Государственное агентство подтверждает, что эмиратский поэт и писатель 1955 года рождения умер 20 августа 2019 года, и сообщает о его профессиональных ролях."),
    ],
    decision: "corrected",
    notes: "Оценочная характеристика удалена; уточнены русская передача фамилии, дата рождения и конкретные названия сборников.",
  },
  {
    key: "uae:mohammed_al_murr",
    originalSha256: "a9713ce728894139c18b3cca15c1eb44b3024358d0f1e6a0b6640a8024b652e4",
    reviewedTextRu: "Мохаммед Ахмед аль-Мурр, родившийся в Дубае в 1955 году, - эмиратский автор коротких рассказов. Его сборники выходили на английском языке под названиями «Dubai Tales» и «The Wink of the Mona Lisa».",
    evidence: [
      e("Emirates Airline Festival of Literature", "https://emirateslitfest.com/services/hemohammedalmurr/", "Официальный профиль фестиваля сообщает рождение в Дубае в 1955 году, специализацию на коротком рассказе и английские сборники «Dubai Tales» и «The Wink of the Mona Lisa»."),
      e("Министерство культуры ОАЭ", "https://moc.gov.ae/en/initiative/order-creative-and-culture/", "Государственная страница награды подтверждает литературную и культурную деятельность Мохаммеда Ахмеда аль-Мурра."),
    ],
    decision: "corrected",
    notes: "Недоказанное упоминание романов убрано: авторитетные профили характеризуют аль-Мурра прежде всего как автора коротких рассказов; родовое поле works заменено названиями книг.",
  },
  {
    key: "uae:ousha_al_suwaidi",
    originalSha256: "f16c6f743efe1f7d0cdd9564f25e3045424ea8232eff4ab11b9e9cfac69e4a0a",
    reviewedTextRu: "Оша бинт Халифа аль-Сувайди (1920-2018), известная как Fatat Al Arab, - эмиратская поэтесса, писавшая в традиции набати. Она умерла 27 июля 2018 года.",
    evidence: [
      e("Фонд Оши бинт Халифа аль-Сувайди", "https://ousha.ae/biography-en.html", "Официальная биография фонда указывает 1920 год рождения, 2018 год смерти, псевдоним Fatat Al Arab и работу в традиции набати."),
      e("Информационное агентство ОАЭ WAM", "https://www.wam.ae/en/article/hszr7agn-emirates-writers-union-mourns-death-poet-ousha", "Государственное агентство сообщило о смерти Оши 27 июля 2018 года и подтвердило её вклад в поэзию набати."),
    ],
    decision: "corrected",
    notes: "Оценочное ранжирование удалено; «Набати-поэзия» перенесена в описание как жанр и удалена из списка названий произведений.",
  },
  {
    key: "uae:sultan_al_owais",
    originalSha256: "c930cea69977b28a6782a6d2ef3d7da9b810a99fde460fbf05c84126c174c2b9",
    reviewedTextRu: "Султан бин Али аль-Овайс (1925-2000) - эмиратский поэт и меценат, учредивший литературную премию своего имени. Его поэтические книги включают «Mirrors of the Gulf» и собрание «Diwan Sultan Al Owais».",
    evidence: [
      e("Фонд Султана бин Али аль-Овайса", "https://www.alowais.com/en/owaismemory1/", "Официальная биография сообщает годы 1925-2000, смерть 4 января, учреждение премии и книги «Mirrors of the Gulf» и «Diwan Sultan Al Owais»."),
      e("UNESCO", "https://articles.unesco.org/sites/default/files/medias/fichiers/2025/09/Program%20of%20the%20Sultan%20Al%20Owais%20Seminar.pdf", "Материал UNESCO подтверждает, что Султан бин Али аль-Овайс был поэтом и культурным деятелем 1925-2000 годов жизни."),
    ],
    decision: "corrected",
    notes: "Расплывчатая оценка заменена проверяемыми фактами; имя дополнено, родовое название произведений заменено библиографическими заглавиями.",
  },
  {
    key: "uganda:byron_kawadwa",
    originalSha256: "244dc3e274151f3b6d7ae5e63df1fd7c661c26abba3527b254f973e5c0094776",
    reviewedTextRu: "Байрон Кавадва - угандийский драматург, актёр и театральный режиссёр, возглавлявший Национальный культурный центр; в 1977 году он был убит сотрудниками силового аппарата режима Иди Амина. Его пьеса «Oluyimba lwa Wankoko» представляла Уганду на FESTAC 1977.",
    evidence: [
      e("AfricaBib / African Studies Centre Leiden", "https://www.africabib.org/rec.php?RID=330185349", "Академическая библиография статьи Сэма Касуле указывает годы 1937-1977, должности драматурга, актёра и режиссёра и пьесу «Oluyimba lwa Wankoko»."),
      e("Университет Макерере", "https://dissertations.mak.ac.ug/bitstream/handle/20.500.12281/20009/Agaba-CHUSS-SLPA.pdf?isAllowed=y&sequence=3", "Университетское исследование описывает Кавадву как 37-летнего драматурга и режиссёра, создавшего музыкальный театр на языке луганда, что конфликтует с 1937 годом рождения."),
    ],
    decision: "corrected",
    notes: "Исправлена транслитерация фамилии и добавлено произведение. Год рождения очищен: академическая статья даёт 1937, тогда как университетская работа называет его 37-летним в 1977 году.",
  },
  {
    key: "uganda:jennifer_nansubuga_makumbi",
    originalSha256: "acba685be56bdc3ddad9c64523ae981cf1f04298b2e51b3daf61a07a36595404",
    reviewedTextRu: "Дженнифер Нансубуга Макумби - угандийская писательница, живущая в Великобритании. Она написала романы «Kintu» и «The First Woman» и сборник рассказов «Manchester Happened».",
    evidence: [
      e("Windham-Campbell Prizes, Yale University", "https://windhamcampbell.org/recipients/makumbi-jennifer-nansubuga", "Официальный профиль премии называет Макумби угандийской романисткой и автором рассказов, живущей в Манчестере, и подтверждает роман «Kintu»."),
      e("Commonwealth Foundation", "https://commonwealthfoundation.com/commonwealth-short-story-prize-archives/short-story-prize-2024/", "Профиль фонда перечисляет «Kintu», «The First Woman» и «Manchester Happened», а также профессиональную биографию писательницы."),
    ],
    decision: "corrected",
    notes: "Убрано оценочное ранжирование и исправлена русская транслитерация. Надёжные институциональные профили не подтверждают 1967 год рождения, поэтому поле очищено.",
  },
  {
    key: "uganda:mary_karooro_okurut",
    originalSha256: "2c6c59fcf7d73eaf238b1ced0c97ade7e7b58da0bc29672547b543655c61a7d4",
    reviewedTextRu: "Мэри Кароро Окурут (1954-2025) - угандийская писательница, преподавательница и государственная деятельница. Она написала романы «The Invisible Weevil» и «The Official Wife» и пьесу «The Curse of the Sacred Cow».",
    evidence: [
      e("Фонд Университета Макерере", "https://endowment.mak.ac.ug/pages/mary-karooro-okurut-a-trailblazer-in-the-mak-hall-of-fame/", "Университетский некролог подтверждает её смерть, преподавание в Макерере и авторство «The Invisible Weevil», «The Official Wife», «The Curse of the Sacred Cow»."),
      e("Uganda Broadcasting Corporation", "https://ubc.go.ug/2025/08/12/a-legacy-woven-in-light-mary-karooro-okurut-goes-to-the-lord1954-2025/", "Государственная телерадиокомпания сообщает годы 1954-2025, точную дату смерти 11 августа 2025 года и её работу писательницы и преподавательницы."),
    ],
    decision: "corrected",
    notes: "Учтена смерть 11 августа 2025 года и дополнен перечень произведений. Авторитетные и профильные источники расходятся в точном дне рождения, поэтому сохранён только 1954 год.",
  },
  {
    key: "uganda:moses_isegawa",
    originalSha256: "917723c60dfcbf41ae92418198029ecbf634a971f2b9fc2ad59ff94ed430b53c",
    reviewedTextRu: "Мозес Исегава, родившийся в Кампале в 1963 году, - угандийский писатель, получивший также нидерландское гражданство. Он написал романы «Abyssinian Chronicles» и «Snakepit».",
    evidence: [
      e("Pan Macmillan", "https://www.panmacmillan.com/authors/moses-isegawa/2069", "Издательский профиль сообщает, что Исегава родился в Кампале в 1963 году, получил нидерландское гражданство и написал «Abyssinian Chronicles» и «Snakepit»."),
      e("Penguin Random House", "https://www.penguinrandomhouse.com/authors/14129/moses-isegawa/", "Независимый издательский профиль подтверждает угандийское происхождение, переезд в Нидерланды и авторство «Abyssinian Chronicles»."),
    ],
    decision: "corrected",
    notes: "Исправлена русская транслитерация фамилии; общая формулировка заменена подтверждёнными биографическими сведениями и оригинальными названиями романов.",
  },
  {
    key: "uganda:okot_pbitek",
    originalSha256: "a16dde105faec318d4b97728688f88230b2e2f823f2e2f3eb8b2a5c9bdd2da45",
    reviewedTextRu: "Окот п’Битек (1931-1982) - угандийский поэт, фольклорист и культурный исследователь. Он написал поэмы «Song of Lawino» и «Song of Ocol».",
    evidence: [
      e("Store norske leksikon", "https://snl.no/Okot_p%27Bitek", "Научная энциклопедия приводит дату рождения 7 июня 1931 года, смерть 20 июля 1982 года и произведения «Song of Lawino» и «Song of Ocol»."),
      e("Большая российская энциклопедия", "https://old.bigenc.ru/literature/text/1872059", "Академическая энциклопедия характеризует п’Битека как угандийского поэта, фольклориста и критика, но указывает смерть 19 июля 1982 года."),
    ],
    decision: "corrected",
    notes: "Оценочное ранжирование удалено. Источники расходятся между 19 и 20 июля 1982 года, поэтому точный день смерти в профиле заменён надёжным годом.",
  },
  {
    key: "uganda:robert_serumaga",
    originalSha256: "8586142ea50c6ff4f785fcbeb598dea1ca0d47bed465af80508e2b3859ab9dec",
    reviewedTextRu: "Роберт Серумага (1939-1980) - угандийский драматург, прозаик, актёр и театральный режиссёр. Он написал пьесы «The Elephants» и «Majangwa» и роман «Return to the Shadows».",
    evidence: [
      e("Store norske leksikon", "https://snl.no/Robert_Serumaga", "Научная энциклопедия указывает годы 1939-1980, занятия писателя, актёра и театрального руководителя и произведения «The Elephants» и «Return to Shadows»."),
      e("Cambridge University Press", "https://www.cambridge.org/core/books/abs/african-theatre-16-six-plays-from-east-west-africa/notions-of-indigeneity-ugandas-robert-serumaga/9361504658F3DFD52B8F3B71671449DD", "Академическое издание подтверждает смерть Серумаги в 1980 году и авторство «Majangwa», «Renga Moi» и «Amayirikiti»."),
    ],
    decision: "corrected",
    notes: "Широкое утверждение об «основателе традиции» заменено проверяемыми профессиями и произведениями.",
  },
  {
    key: "uganda:timothy_wangusa",
    originalSha256: "867b3423fd33802a51c2835c17c4560f927c6886996d559bb0bef08f9a89f171",
    reviewedTextRu: "Тимоти Вангуса (род. 20 мая 1942) - угандийский поэт, романист и литературовед, преподававший в Университете Макерере. Он написал роман «Upon This Mountain» и поэтические сборники «Salutations» и «A Pattern of Dust».",
    evidence: [
      e("Университет Макерере", "https://news.mak.ac.ug/2022/07/makerere-university-celebrates-prof-timothy-wangusa80/", "Официальный материал указывает рождение 20 мая 1942 года, называет Вангусу поэтом, романистом и преподавателем и перечисляет его книги."),
      e("Cambridge University Press", "https://www.cambridge.org/core/books/history-of-modern-uganda/refractions/13EDE93689F6810E801FB3A5BAC3EEC3", "Академическая история Уганды независимо рассматривает роман «Upon This Mountain» и сборники «Salutations» и «A Pattern of Dust»."),
    ],
    decision: "corrected",
    notes: "Исправлена ошибочная фамилия «Ваньяра», уточнена дата рождения и удалено не принадлежащее автору произведение «Узник совести».",
  },
  {
    key: "ukraine:hryhorii_skovoroda",
    originalSha256: "4c401bd62bbc11d38c1269023c8ff44299ed8b17aedd7f79ec07c60a0ab7e075",
    reviewedTextRu: "Григорий Сковорода (3 декабря 1722 - 9 ноября 1794) - украинский философ, поэт, педагог и переводчик. Он создал сборники «Сад божественных песен» и «Басни Харьковские».",
    evidence: [
      e("Национальная библиотека Украины имени В. И. Вернадского", "https://www.nbuv.gov.ua/node/6047", "Национальная библиотека указывает даты 3 декабря 1722 - 9 ноября 1794 и поясняет дату рождения 22 ноября по старому стилю."),
      e("Internet Encyclopedia of Ukraine, Canadian Institute of Ukrainian Studies", "https://www.encyclopediaofukraine.com/pages%5CS%5CK%5CSkovorodaHryhorii.htm", "Академическая энциклопедия независимо подтверждает даты, профессии и сборники «Garden of Divine Songs» и «Kharkiv Fables»."),
    ],
    decision: "corrected",
    notes: "Расплывчатое утверждение об «основоположнике» заменено конкретными занятиями и произведениями. Даты приведены по новому стилю: 22 ноября и 29 октября по старому стилю соответственно.",
  },
  {
    key: "ukraine:ivan_franko",
    originalSha256: "4220ecfca0c2eba76783b3eb1341d9621dfd4c1124b29778926dbd21d97c060c",
    reviewedTextRu: "Иван Франко (27 августа 1856 - 28 мая 1916) - украинский писатель, поэт, переводчик, исследователь и общественный деятель. Среди его произведений - повесть «Захар Беркут», поэма «Моисей» и сборник «Мой Измарагд».",
    evidence: [
      e("Internet Encyclopedia of Ukraine, Canadian Institute of Ukrainian Studies", "https://www.encyclopediaofukraine.com/display.asp?linkpath=pages%5CF%5CR%5CFrankoIvan.htm", "Академическая энциклопедия приводит даты 27 августа 1856 - 28 мая 1916 и описывает Франко как писателя, учёного, публициста и общественного деятеля."),
      e("Хорватская энциклопедия", "https://www.enciklopedija.hr/clanak/franko-ivan", "Национальная энциклопедия независимо подтверждает даты и произведения «Захар Беркут», «Мой Измарагд» и «Моисей»."),
    ],
    decision: "corrected",
    notes: "Субъективная оценка масштаба заменена подтверждёнными профессиями и произведениями; даты профиля верны.",
  },
  {
    key: "ukraine:ivan_kotliarevsky",
    originalSha256: "2f890c40e439b199a38c3703b8d553cd8d33feea6797a257b5ee81b48aad5e49",
    reviewedTextRu: "Иван Котляревский (9 сентября 1769 - 10 ноября 1838) - украинский поэт и драматург. Он написал бурлескную поэму «Энеида» и пьесы «Наталка Полтавка» и «Москаль-чародей».",
    evidence: [
      e("Internet Encyclopedia of Ukraine, Canadian Institute of Ukrainian Studies", "https://www.encyclopediaofukraine.com/display.asp?linkpath=pages%5CK%5CO%5CKotliarevskyIvan.htm", "Академическая энциклопедия указывает даты 9 сентября 1769 - 10 ноября 1838 и характеризует Котляревского как поэта и драматурга."),
      e("Украинский институт национальной памяти", "https://old.uinp.gov.ua/publication/kotlyarevskii-ivan-petrovich", "Официальная статья приводит обе календарные формы дат и подтверждает авторство «Энеиды», «Наталки Полтавки» и «Москаля-чародея»."),
    ],
    decision: "corrected",
    notes: "Историографическое определение «один из основателей» заменено конкретными жанрами и произведениями. Даты профиля уже даны по новому стилю; старый стиль - 29 августа и 29 октября.",
  },
  {
    key: "ukraine:lesya_ukrainka",
    originalSha256: "70eec7d062425a197bacc662366a14693158853e1517bdae6a192655d33295f3",
    reviewedTextRu: "Леся Украинка - литературный псевдоним Ларисы Косач-Квитки (25 февраля 1871 - 1 августа 1913), украинской поэтессы, драматурга, переводчицы и фольклористки. Она написала драму-феерию «Лесная песня».",
    evidence: [
      e("Национальная библиотека Украины имени В. И. Вернадского", "https://www.nbuv.gov.ua/node/5452", "Национальная библиотека приводит настоящее имя, обе календарные формы дат 13/25 февраля 1871 и 19 июля/1 августа 1913 и литературные занятия."),
      e("Internet Encyclopedia of Ukraine, Canadian Institute of Ukrainian Studies", "https://www.encyclopediaofukraine.com/display.asp?linkpath=pages%5CU%5CK%5CUkrainkaLesia.htm", "Академическая энциклопедия независимо подтверждает даты, псевдоним Ларисы Косач-Квитки и драму «Lisova pisnia» («Лесная песня»)."),
    ],
    decision: "corrected",
    notes: "Оценочное ранжирование заменено настоящим именем, профессиями и произведением. Даты профиля верны по новому стилю; старый стиль - 13 февраля и 19 июля.",
  },
  {
    key: "ukraine:mykhailo_kotsiubynsky",
    originalSha256: "66ce944a8efa6cdf8b117dfdf60e2ed5e94ab9dca8896160dd56d8e10b740c45",
    reviewedTextRu: "Михаил Коцюбинский (17 сентября 1864 - 25 апреля 1913) - украинский прозаик и общественный деятель. Он написал повесть «Тени забытых предков» и новеллу «Intermezzo».",
    evidence: [
      e("Национальная библиотека Украины имени В. И. Вернадского", "https://www.nbuv.gov.ua/node/1900", "Национальная библиотека указывает даты 17 сентября 1864 - 25 апреля 1913 и характеризует Коцюбинского как украинского писателя."),
      e("Черниговский литературно-мемориальный музей-заповедник М. М. Коцюбинского", "https://kotsubinsky.org/index/0-8", "Официальный музей подтверждает писательскую деятельность и называет среди произведений «Intermezzo» и «Тени забытых предков»."),
    ],
    decision: "corrected",
    notes: "Оценочные слова «классик» и «мастер» заменены проверяемыми жанрами и произведениями; даты профиля подтверждены.",
  },
  {
    key: "ukraine:taras_shevchenko",
    originalSha256: "34c5c287eb266a5bc0ffe1261b7e08508e7dbbaa415bcc4ded34283d8c9d7fcf",
    reviewedTextRu: "Тарас Шевченко (9 марта 1814 - 10 марта 1861) - украинский поэт, прозаик и художник. Его первый сборник стихотворений «Кобзарь» вышел в Санкт-Петербурге в 1840 году.",
    evidence: [
      e("Национальная библиотека Украины имени В. И. Вернадского", "https://www.nbuv.gov.ua/node/1879", "Национальная библиотека приводит обе календарные формы дат 25 февраля/9 марта 1814 и 26 февраля/10 марта 1861 и сообщает об издании «Кобзаря»."),
      e("Библиотека Конгресса США", "https://www.loc.gov/item/2021666579/", "Каталог Библиотеки Конгресса подтверждает годы 1814-1861, занятия украинского писателя и художника и публикацию первого «Кобзаря» в 1840 году."),
    ],
    decision: "corrected",
    notes: "Оценочный эпитет удалён; добавлены проверяемые занятия и дата первого издания. Профиль использует новый стиль, соответствующий 25 февраля и 26 февраля по старому стилю.",
  },
];

export const writerBiographyFactReviewBatch53: readonly WriterBiographyFactReviewRecord[] = seeds.map(
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
