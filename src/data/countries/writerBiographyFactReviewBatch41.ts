export const WRITER_BIOGRAPHY_FACT_REVIEW_BATCH41_REVIEWER =
  "Codex independent claim-by-claim factual review, batch 41";

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

const reviewer = WRITER_BIOGRAPHY_FACT_REVIEW_BATCH41_REVIEWER;
const checkedAt = "2026-08-14";

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

const seeds = [
  {
    key: "myanmar:ludu_daw_amar",
    originalSha256: "eab1c14ceaea7ab26ee4b86e7628a79fd0ef8479f8c1b517a5cb4efdb26295fc",
    reviewedTextRu: "Люду До Амар (1915-2008) - бирманская писательница, журналистка и редактор. Вместе с Люду У Хла она выпускала в Мандалае газету Ludu и писала о культуре Мьянмы.",
    evidence: [
      e("Cambridge University Press", "https://www.cambridge.org/core/books/abs/female-voice-of-myanmar/ludu-daw-amar-the-voice-of-unity/116EF77DC8AB6E5B542F13FC411558A6", "Университетское издание подтверждает идентичность, редакционную работу и культурную публицистику Люду До Амар."),
      e("Cornell University", "https://ecommons.cornell.edu/bitstreams/5dc51a24-1240-4072-beb1-17e1b80d3c8c/download", "Исследование Корнеллского университета документирует писательскую и газетную деятельность Амар и У Хла в Мандалае."),
    ],
    decision: "corrected",
    notes: "Оценочная формула о влиянии заменена документированными профессиями и редакционной работой.",
  },
  {
    key: "myanmar:ma_ma_lay",
    originalSha256: "1465c9a2cf857c0ef7971c5f6f67453fb1aa0a988beb08407324be69363614db",
    reviewedTextRu: "Ма Ма Лэй (1917-1982) - бирманская писательница и редактор. Она написала романы «Not Out of Hate» и «A Man Like Him».",
    evidence: [
      e("Ohio University Press", "https://www.ohioswallow.com/author/ma-ma-lay/", "Университетское издательство приводит авторскую идентичность Ма Ма Лэй и библиографию её книг."),
      e("Cornell University", "https://ecommons.cornell.edu/bitstreams/6bbdd02d-da23-4235-bcdf-f87d500c86d1/download", "Исследование Корнеллского университета подтверждает её литературную и редакционную деятельность и название A Man Like Him."),
    ],
    decision: "corrected",
    notes: "Обобщённая характеристика заменена датами, профессиями и двумя установленными произведениями.",
  },
  {
    key: "myanmar:min_thu_wun",
    originalSha256: "7d16069e1028a16f4ea55a1fb590dc23a09faec9f7f190eec15241bddf85a4ae",
    reviewedTextRu: "Мин Тувун (1909-2004) - бирманский поэт, эссеист и исследователь языка. Он участвовал в литературном движении Khit San и с 1931 года писал стихи для детей.",
    evidence: [
      e("Chiang Mai University conference proceedings", "https://www.burmaconference.com/wp-content/uploads/2025/01/ICBMS4-proceedings-final-J-R.pdf", "Университетский сборник содержит биографию Мин Тувуна, дату рождения, профессии и связь с Khit San."),
      e("Ministry of the Office of the President of Myanmar", "https://presoffministry.gov.mm/en/article/36739", "Официальный материал Мьянмы подтверждает статус поэта и начало публикации детских стихов в 1931 году."),
      e("Myanmar Digital News", "https://www.mdn.gov.mm/en/kungyangon-flourishes-after-old-thakhut-river-expansion", "Официальное издание Министерства информации Мьянмы независимо называет Кунджангон местом рождения поэта Мин Тувуна."),
    ],
    decision: "corrected",
    notes: "Суперлатив заменён проверяемыми ролями, литературным движением и датированным направлением работы.",
  },
  {
    key: "myanmar:thakin_kodaw_hmaing",
    originalSha256: "c2b70d1f3a136804dbd73d0c0fd41487abaed3b8cb82294edf996be99df5eceb",
    reviewedTextRu: "Такин Кодо Хмайн (1876-1964) - бирманский поэт, драматург, журналист и участник антиколониального движения. Он публиковал политические и литературные тексты под несколькими псевдонимами.",
    evidence: [
      e("Northern Illinois University, Center for Burma Studies", "https://www.niu.edu/burma/publications/journal/2015/abstracts-19-1.shtml", "Университетский Центр исследований Бирмы подтверждает литературную и политическую деятельность Такина Кодо Хмайна."),
      e("Ministry of Information of Myanmar", "https://myanmar.gov.mm/documents/20143/2936705/31_Aug_19_gnlm.pdf/c604c5e2-90df-7ba2-ca7c-f5dbbdad7e6c?t=1567229534510", "Официальное издание Мьянмы подтверждает точные даты жизни, деревню Вале, журналистскую работу, псевдоним и антиколониальную деятельность автора."),
    ],
    decision: "corrected",
    notes: "Оценочная формула заменена профессиями, псевдонимами и исторически установленной деятельностью.",
  },
  {
    key: "myanmar:theippan_maung_wa",
    originalSha256: "99be52cac0a1e51a47d9e1a6435561107b2923d881aab37f5d2fce940fc690cc",
    reviewedTextRu: "Тейппан Маун Ва (1899-1942), псевдоним У Сейн Тина, - бирманский прозаик и автор дневников. Его военный дневник опубликован на английском языке под названием «Wartime in Burma».",
    evidence: [
      e("Ohio University Press", "https://www.ohioswallow.com/9780896804715/wartime-in-burma/", "Университетское издательство подтверждает псевдоним, писательскую деятельность и публикацию военного дневника."),
      e("J-STAGE", "https://www.jstage.jst.go.jp/article/sea1971/1991/20/1991_20_35/_article", "Рецензируемая университетская публикация документирует автора и его место в бирманской прозе периода Khit San."),
    ],
    decision: "corrected",
    notes: "Общая характеристика заменена установленным именем, жанром и конкретным изданием дневника.",
  },
  {
    key: "namibia:gabi_stolz",
    originalSha256: "43808a51403a75f4372594eca58d99861473f890630dd5bb330b910c9a6c5402",
    reviewedTextRu: "Личность «Gabi Stolz» как намибийской немецкоязычной писательницы 1956 года рождения не установлена по авторитетным библиотечным каталогам.",
    evidence: [
      e("German National Library", "https://portal.dnb.de/opac/simpleSearch?query=%22Gabi+Stolz%22", "Каталог Немецкой национальной библиотеки не даёт однозначной авторской записи, совпадающей со всеми данными карточки."),
      e("WorldCat", "https://search.worldcat.org/search?q=%22Gabi+Stolz%22", "Международный библиотечный каталог не позволяет связать имя, год рождения и намибийскую литературную деятельность в одну личность."),
    ],
    decision: "held",
    notes: "Профиль помещён в карантин: имя не связано с уникальной авторской идентичностью и опубликованными произведениями.",
  },
  {
    key: "namibia:gustav_frolich",
    originalSha256: "8ded9267ca112932e3e46fa1881e730a7080488109fcdf178a3b50f54f2a6c0a",
    reviewedTextRu: "Карточка «Gustav Frölich» смешивает данные: авторитетные справочники описывают одноимённого немецкого аграрного учёного 1879-1940, а не намибийского писателя.",
    evidence: [
      e("Deutsche Biographie", "https://www.deutsche-biographie.de/sfz17761.html", "Национальный биографический справочник идентифицирует Густава Фрёлиха как немецкого специалиста по животноводству 1879-1940."),
      e("Deutsche Digitale Bibliothek", "https://www.deutsche-digitale-bibliothek.de/person/gnd/119512270", "Немецкая цифровая библиотека подтверждает профессиональную область и авторитетную запись, не соответствующую литературной карточке Намибии."),
    ],
    decision: "held",
    notes: "Профиль помещён в карантин из-за междоменного смешения личности, неверного года смерти и неподтверждённой связи с Намибией.",
  },
  {
    key: "namibia:ndapewaoshali_shikongo",
    originalSha256: "f42bfdd5fc514e88209280c4be9d75ba77575f20059c998e4bc9b5f85aed50ae",
    reviewedTextRu: "Личность «Ndapewaoshali Shikongo» не установлена: найденный авторский ресурс использует имя Ndapewoshali без фамилии и не подтверждает год рождения и детские книги из карточки.",
    evidence: [
      e("Ndapewoshali Writes", "https://ndapewoshaliwrites.com/author/ndapewoshalia/", "Первичный авторский ресурс описывает поэзию и публицистику Ndapewoshali, но не подтверждает фамилию Shikongo, год рождения или детские книги."),
      e("WorldCat", "https://search.worldcat.org/search?q=%22Ndapewaoshali+Shikongo%22", "Международный библиотечный каталог не содержит однозначной записи, связывающей точное имя карточки с заявленными биографическими данными."),
    ],
    decision: "held",
    notes: "Профиль помещён в карантин: возможная реальная авторка не может быть безошибочно отождествлена с этой карточкой.",
  },
  {
    key: "nauru:michael_francis",
    originalSha256: "5c62774aa5f9a945e98f309e9fcae0ddd22d814871b563f9d58c146a745d4de8",
    reviewedTextRu: "Личность «Michael Francis» как науруанского писателя 1960 года рождения не установлена: имя не связано с произведением или уникальной библиотечной записью.",
    evidence: [
      e("National Library of Australia", "https://catalogue.nla.gov.au/catalog?search_field=all_fields&q=%22Michael+Francis%22+Nauru", "Поиск Национальной библиотеки Австралии не устанавливает автора из Науру с биографическими признаками данной карточки."),
      e("WorldCat", "https://search.worldcat.org/search?q=%22Michael+Francis%22+Nauru", "Международный библиотечный каталог не связывает общее имя с науруанским авторством, годом рождения и конкретной книгой."),
    ],
    decision: "held",
    notes: "Профиль помещён в карантин: слишком общее имя и отсутствие произведений не позволяют установить личность.",
  },
  {
    key: "nepal:bhanubhakta_acharya",
    originalSha256: "4a0fe4fe345aeca5af7184a7ac3a3226990c4490cb6b03d092679e3d66fd0f01",
    reviewedTextRu: "Бханубхакта Ачарья (1814-1868) - непальский поэт и переводчик. Он создал непальскую стихотворную версию «Рамаяны».",
    evidence: [
      e("Purbanchal University", "https://www.purbanchaluniversity.edu.np/news/detail/pu-s-vc-dr.-thapaliya-extends-warm-wishes-on-bhanu-jayanti-celebration-240713121054", "Университет подтверждает дату рождения, профессию поэта и перевод Рамаяны на непальский язык."),
      e("Indian Institute of Technology Kanpur", "https://www.nepali.iitk.ac.in/bio", "Институциональный архив непальской литературы подтверждает годы жизни, происхождение и переводческую работу Бханубхакты."),
    ],
    decision: "corrected",
    notes: "Почётное ранжирование и широкая причинная оценка заменены профессией и конкретной переводческой работой.",
  },
  {
    key: "nepal:bp_koirala",
    originalSha256: "dfcc964e5684f6ccf36cdb74943b15a4be749c68835bcc5a5c8feb48d7d3de60",
    reviewedTextRu: "Бишвешвар Прасад Коирала (ум. 1982) - непальский прозаик и политический деятель. Среди его романов - «Teen Ghumti», «Sumnima» и «Narendra Dai».",
    evidence: [
      e("Embassy of India in Kathmandu", "https://www.indembkathmandu.gov.in/about-b-p-koirala-foundation", "Официальная страница фонда подтверждает литературную и политическую деятельность Б. П. Коиралы и год смерти."),
      e("Tribhuvan University", "https://elibrary.tucl.edu.np/JQ99OgQIizUxyjI9nB0on9OyLkqsGIf4/api/core/bitstreams/5e37fd64-281c-4238-9043-eb9a16194dfa/content", "Университетское исследование называет Коиралу прозаиком и перечисляет Teen Ghumti, Sumnima и Narendra Dai."),
    ],
    decision: "corrected",
    notes: "Непроверяемая формула об основательстве направления заменена ролями и документированной библиографией.",
  },
  {
    key: "nepal:krishna_dharabasi",
    originalSha256: "abea639016166642d7d07e4f3760b0350fae62f4c478b6e93f94590881bcf79b",
    reviewedTextRu: "Кришна Дхарабаси - литературный псевдоним непальского писателя Кришны Прасада Бхаттарая. Его роман «Radha» удостоен премии Madan Puraskar.",
    evidence: [
      e("Madan Puraskar Guthi", "https://guthi.madanpuraskar.org/people/krishna-dharabasi/", "Официальная страница премии подтверждает настоящее имя, псевдоним, роман Radha и присуждение Madan Puraskar."),
      e("Tribhuvan University", "https://elibrary.tucl.edu.np/bitstreams/f64c1be7-8050-4cf1-a1b6-eaf48f9032c4/download", "Университетское исследование подтверждает авторскую идентичность Дхарабаси, роман Radha и его премиальную историю."),
    ],
    decision: "corrected",
    notes: "Техническая дата и оценочное тематическое обобщение заменены настоящим именем, книгой и официальной премией.",
  },
  {
    key: "nepal:laxmi_prasad_devkota",
    originalSha256: "1a73ec2ae3c76ce4097e2934e21fc4d63552cb3afcff138fd09850a6a8a8f5c1",
    reviewedTextRu: "Лакшми Прасад Девкота - непальский поэт, драматург и эссеист. Он написал поэмы «Muna Madan», «Shakuntala» и «Sulochana».",
    evidence: [
      e("Sanskritik Sansthan, Government of Nepal", "https://www.sanskritiksansthan.gov.np/content/628", "Официальное учреждение культуры Непала подтверждает авторство Девкоты и поэмы Muna Madan."),
      e("Tribhuvan University", "https://elibrary.tucl.edu.np/JQ99OgQIizUxyjI9nB0on9OyLkqsGIf4/api/core/bitstreams/aa69e41a-1163-4dba-a528-1e6d7b5c555a/content", "Университетское исследование подтверждает поэзию, драматургию, эссеистику и произведения Muna Madan, Shakuntala и Sulochana."),
    ],
    decision: "corrected",
    notes: "Суперлатив и общее влияние заменены жанрами и тремя конкретными произведениями.",
  },
  {
    key: "nepal:manjushree_thapa",
    originalSha256: "c6e48486ee02c251ad402cb80e4bfbf5c53693285cc51f932212edee19b5a68b",
    reviewedTextRu: "Манджушри Тхапа (род. 1968 в Катманду) - непальская писательница и переводчица, работающая на английском языке. Она написала романы «The Tutor of History» и «Seasons of Flight».",
    evidence: [
      e("Library of Congress", "https://www.loc.gov/acq/overseas-offices/delhi/salrp/manjushreethapa.html", "Библиотека Конгресса подтверждает год и место рождения, писательскую и переводческую работу и The Tutor of History."),
      e("Manjushree Thapa author bibliography", "https://manjushreethapa.com/", "Первичная авторская библиография подтверждает англоязычные книги The Tutor of History и Seasons of Flight."),
    ],
    decision: "corrected",
    notes: "Неопределённая современная характеристика заменена датой, местом, ролями и двумя названиями книг.",
  },
  {
    key: "nepal:parijat",
    originalSha256: "a817ab975013863e1e8a549a2fda75dcb78bd254178f422c3fb7a94d52f8a967",
    reviewedTextRu: "Париджат (Бишну Кумари Вайба; 1937-1993) - непальская писательница и поэтесса. Её роман «Shirishko Phool» получил премию Madan Puraskar.",
    evidence: [
      e("Madan Puraskar Guthi", "https://guthi.madanpuraskar.org/people/parijat/", "Официальная страница премии подтверждает настоящее имя, годы жизни, роман Shirishko Phool и награду."),
      e("University of California Press / eScholarship", "https://pub-ucpec2-prd.cdlib.org/ucpressebooks/view?anchor.id=0&brand=eschol&chunk.id=d0e7288&doc.view=content&docId=ft729007x1&toc.depth=1", "Университетское издание подтверждает авторскую идентичность, роман и присуждение Madan Puraskar."),
    ],
    decision: "corrected",
    notes: "Ранжирование заменено настоящим именем, установленным романом и официальной премией.",
  },
  {
    key: "netherlands:alexandre_olivier_exquemelin",
    originalSha256: "dcfb0952e77af29213f5f9f8c714ebec55a7660b65814a51d0707da2336048c0",
    reviewedTextRu: "Александр Оливье Эксквемелин (ок. 1645-1707) - хирург и автор свидетельства о карибских буканьерах. Его книга «De Americaensche Zee-Roovers» впервые издана в Амстердаме в 1678 году.",
    evidence: [
      e("Library of Congress", "https://www.loc.gov/exhibits/exploring-the-early-americas/interactives/buccaneers-of-america/index.html", "Выставка Библиотеки Конгресса подтверждает годы, профессию хирурга, авторство и амстердамское издание 1678 года."),
      e("Digital Library for Dutch Literature", "https://www.dbnl.org/tekst/exqu001amer02_01/exqu001amer02_01_0001.php", "Цифровая библиотека нидерландской литературы подтверждает Эксквемелина и нидерландский оригинал De Americaensche Zee-Roovers."),
    ],
    decision: "corrected",
    notes: "Оценка исторической значимости заменена профессией, предметом книги и точными выходными данными первого издания.",
  },
  {
    key: "netherlands:anne_frank",
    originalSha256: "bc0e447d6019cfd2b4b48f2ddf844de2c5c8c9c746b058957d52c683a04422e3",
    reviewedTextRu: "Анна Франк (1929-1945) вела дневник на нидерландском языке во время укрытия в оккупированном Амстердаме. Первое книжное издание «Het Achterhuis» вышло в 1947 году.",
    evidence: [
      e("Anne Frank House", "https://www.annefrank.org/en/anne-frank/diary/publication-diary/", "Музей Анны Франк документирует происхождение рукописей и первое нидерландское издание Het Achterhuis в 1947 году."),
      e("UNESCO Memory of the World", "https://www.unesco.org/en/memory-world/diaries-anne-frank?hub=701", "ЮНЕСКО подтверждает идентичность дневников и описание двух лет жизни Анны Франк в укрытии во время войны."),
    ],
    decision: "corrected",
    notes: "Ранжирование известности заменено языком, обстоятельствами создания и библиографией первого издания.",
  },
  {
    key: "netherlands:betje_wolff",
    originalSha256: "9ea693e6877928a37f1ca49fc86bdc8a8f0050a1388d468e7b5d2ca0339ef993",
    reviewedTextRu: "Бетье Вольф (1738-1804) - нидерландская писательница. Совместно с Агье Декен она написала эпистолярный роман «Historie van mejuffrouw Sara Burgerhart» (1782).",
    evidence: [
      e("Digital Library for Dutch Literature", "https://www.dbnl.org/auteurs/auteur.php?id=wolf016", "Национальная литературная библиотека подтверждает авторскую идентичность Вольф и совместную работу над Sara Burgerhart."),
      e("WorldCat", "https://search.worldcat.org/search?q=au%3A%22Betje+Wolff%22", "Международный библиотечный каталог подтверждает годы жизни и библиографическую связь Вольф, Декен и романа 1782 года."),
    ],
    decision: "corrected",
    notes: "Общая характеристика заменена датами, соавторством, жанром и точным названием романа.",
  },
  {
    key: "netherlands:cees_nooteboom",
    originalSha256: "8cb19f6f5da249d6bf8ec7973f5c2daedfd638ad769189da697db2ae6978bf3e",
    reviewedTextRu: "Сейс Нотебоом (1933-2026) - нидерландский прозаик, поэт, эссеист и автор путевой прозы. Среди его книг - романы «Rituelen» и «Het volgende verhaal».",
    evidence: [
      e("Dutch Foundation for Literature", "https://www.letterenfonds.nl/en/whats-happening/in-memoriam-cees-nooteboom", "Официальный фонд подтверждает годы жизни, жанры и книги Rituelen и Het volgende verhaal."),
      e("Akademie der Künste", "https://adk.de/presse/pressemitteilungen/pm-akademie-der-kuenste-trauert-um-cees-nooteboom-1933-2026", "Берлинская Академия искусств независимо подтверждает смерть в 2026 году и литературную биографию Нотебоома."),
    ],
    decision: "corrected",
    notes: "Исправлен ранее открытый год жизни; краткая заглушка дополнена жанрами и двумя произведениями.",
  },
  {
    key: "netherlands:erasmus_rotterdam",
    originalSha256: "9194abfa49885ba1d9879d31c7bc9269eda95d42ed3fd5512df0a4c29e561402",
    reviewedTextRu: "Эразм Роттердамский (год рождения точно не установлен: 1466, 1467 или 1469; умер в 1536 году) - нидерландский гуманист, филолог и богослов. Он написал «Похвалу глупости» и подготовил печатное греко-латинское издание Нового Завета 1516 года.",
    evidence: [
      e("Stanford Encyclopedia of Philosophy", "https://plato.stanford.edu/entries/erasmus/", "Университетская энциклопедия приводит 1469-1536, гуманистическую и филологическую деятельность, Praise of Folly и издание греческого Нового Завета 1516 года."),
      e("Erasmus House museum", "https://erasmushouse.museum/wp-content/uploads/2020/06/Dossier_docent-1.pdf", "Музейный образовательный материал прямо фиксирует неопределённость года рождения между 1466, 1467 и 1469 годами и подтверждает публикацию Praise of Folly."),
    ],
    decision: "corrected",
    notes: "Общая формула влияния заменена дисциплинами, книгой и датированным филологическим изданием.",
  },
  {
    key: "netherlands:frederik_van_eeden",
    originalSha256: "ed08f381945791dad911a31ccb1b08de3657a253cc267afb4055f082b9dc83f8",
    reviewedTextRu: "Фредерик ван Эден (1860-1932) - нидерландский писатель, врач и психиатр. Он написал «De kleine Johannes» и роман «Van de koele meren des doods».",
    evidence: [
      e("Digital Library for Dutch Literature", "https://www.dbnl.org/tekst/bork001schr01_01/bork001schr01_01_0297.php", "Литературная библиотека подтверждает годы, профессии и книгу De kleine Johannes."),
      e("WorldCat", "https://search.worldcat.org/search?q=au%3A%22Frederik+van+Eeden%22", "Международный каталог подтверждает авторскую идентичность и библиографию двух названных произведений."),
    ],
    decision: "corrected",
    notes: "Краткая оценочная запись заменена медицинской и литературной профессиями и оригинальными названиями книг.",
  },
  {
    key: "netherlands:harry_mulisch",
    originalSha256: "4cd8916e5c13da1247105c05cb74b1030b8569ae4612a12bcbb111022cdead7e",
    reviewedTextRu: "Гарри Мулиш (1927-2010) - нидерландский романист, драматург и эссеист. Он написал романы «De aanslag» и «De ontdekking van de hemel».",
    evidence: [
      e("Dutch Foundation for Literature", "https://www.letterenfonds.nl/en/authors/harry-mulisch", "Официальный литературный фонд подтверждает годы, жанры и оригинальные названия романов Мулиша."),
      e("Library of Congress", "https://id.loc.gov/authorities/names/n79109076.html", "Авторитетная запись Библиотеки Конгресса подтверждает идентичность и библиографию Гарри Мулиша."),
    ],
    decision: "corrected",
    notes: "Ранжирование и неформальная группировка заменены жанрами и двумя документированными романами.",
  },
  {
    key: "netherlands:herman_koch",
    originalSha256: "a11647ec30ee6d662fbb4452d04ec6e66619b8a3616b89d7ba7a221ce9505757",
    reviewedTextRu: "Херман Кох (род. 1953) - нидерландский писатель. Он написал романы «Het diner», «Zomerhuis met zwembad» и «Geachte heer M.».",
    evidence: [
      e("Dutch Foundation for Literature", "https://www.letterenfonds.nl/en/authors/herman-koch", "Официальный фонд подтверждает год рождения, профессию и библиографию романов Коха."),
      e("WorldCat", "https://search.worldcat.org/search?q=au%3A%22Herman+Koch%22", "Международный библиотечный каталог независимо подтверждает авторскую идентичность и перечисленные произведения."),
    ],
    decision: "corrected",
    notes: "Маркетинговая формула о бестселлере заменена тремя оригинальными названиями романов.",
  },
  {
    key: "netherlands:joost_van_den_vondel",
    originalSha256: "99fc78f9b2f10e3f71a8e8608d77ed98cbcbea017ad7f25f1ead1cfa82c71853",
    reviewedTextRu: "Йост ван ден Вондел (1587-1679) - нидерландский поэт и драматург. Он написал пьесы «Gijsbrecht van Aemstel», «Lucifer» и «Jeptha».",
    evidence: [
      e("Digital Library for Dutch Literature", "https://www.dbnl.org/tekst/bork001nede01_01/bork001nede01_01_1391.php", "Национальная литературная библиотека подтверждает годы, жанры и драматургическое наследие Вондела."),
      e("WorldCat", "https://search.worldcat.org/search?q=au%3A%22Joost+van+den+Vondel%22", "Международный библиотечный каталог подтверждает авторскую идентичность и библиографию трёх пьес."),
    ],
    decision: "corrected",
    notes: "Почётная метафора и ранжирование заменены жанрами и тремя оригинальными названиями пьес.",
  },
  {
    key: "netherlands:louis_couperus",
    originalSha256: "a60cdc9f24bc9a0754ece1a16bda8b7f3eb88102dc83522d024921779831283e",
    reviewedTextRu: "Луи Куперус (1863-1923) - нидерландский романист и автор путевой прозы. Он написал романы «Eline Vere», «De stille kracht» и «Van oude menschen, de dingen, die voorbij gaan».",
    evidence: [
      e("Dutch Foundation for Literature", "https://www.letterenfonds.nl/en/authors/louis-couperus", "Официальный литературный фонд подтверждает годы, жанры и романы Куперуса."),
      e("Digital Library for Dutch Literature", "https://www.dbnl.org/tekst/bast002loui01_01/bast002loui01_01.pdf", "Национальная литературная библиотека документирует биографию и библиографию Луи Куперуса."),
    ],
    decision: "corrected",
    notes: "Ранжирование заменено жанрами и тремя установленными оригинальными названиями романов.",
  },
  {
    key: "netherlands:multatuli",
    originalSha256: "88324182e8750ef1450d82ad25cde50b39047594be2873803232c525604f5726",
    reviewedTextRu: "Мультатули - псевдоним нидерландского писателя Эдуарда Доувеса Деккера (1820-1887). В 1860 году он опубликовал роман «Max Havelaar» о колониальном управлении в Нидерландской Ост-Индии.",
    evidence: [
      e("Dutch Foundation for Literature", "https://www.letterenfonds.nl/en/authors/multatuli", "Официальный литературный фонд подтверждает настоящее имя, годы, псевдоним, книгу и год её издания."),
      e("WorldCat", "https://search.worldcat.org/search?q=au%3A%22Multatuli%22", "Международный библиотечный каталог подтверждает авторитетную идентичность Деккера и библиографию Max Havelaar."),
    ],
    decision: "corrected",
    notes: "Оценка значимости заменена настоящим именем, точным годом издания и документированным предметом романа.",
  },
  {
    key: "new_zealand:allen_curnow",
    originalSha256: "ab87d406e4eaf528035f541e9525bf5f3258729c706ceda88d23d1c0715b1334",
    reviewedTextRu: "Аллен Карноу (1911-2001) - новозеландский поэт, литературный критик и редактор антологий. Среди его книг - «Early Days Yet» и «Continuum: New and Later Poems».",
    evidence: [
      e("Read NZ Te Pou Muramura", "https://www.read-nz.org/writers-files/writer/curnow-allen", "Национальная читательская организация подтверждает годы, роли и библиографию Аллена Карноу."),
      e("Arts Foundation of New Zealand", "https://www.thearts.co.nz/artists/allen-curnow", "Национальный фонд искусств независимо подтверждает поэтическую карьеру и основные сборники Карноу."),
    ],
    decision: "corrected",
    notes: "Ранжирование заменено профессиями и двумя названиями поэтических книг.",
  },
  {
    key: "new_zealand:bill_manhire",
    originalSha256: "60cb922fe90d1a507abbd80bfb2f1a5ef96bf7bb1c9d9817970030332481c843",
    reviewedTextRu: "Билл Манхайр (род. 1946) - новозеландский поэт, прозаик и редактор. Он основал программу творческого письма в Университете Виктории в Веллингтоне и написал сборники «Milky Way Bar» и «Lifted».",
    evidence: [
      e("Read NZ Te Pou Muramura", "https://www.read-nz.org/writers-files/writer/manhire-bill", "Национальная организация подтверждает год рождения, жанры, преподавательскую работу и библиографию Манхайра."),
      e("Arts Foundation of New Zealand", "https://www.thearts.co.nz/artists/bill-manhire", "Национальный фонд искусств подтверждает основание программы творческого письма и названия поэтических книг."),
    ],
    decision: "corrected",
    notes: "Оценочное ранжирование заменено ролями, университетским проектом и двумя сборниками.",
  },
  {
    key: "new_zealand:bruce_mason",
    originalSha256: "b0954d5f92e0d684a0dcc7fb5c128a808730be11a8d99121a0659a765c481684",
    reviewedTextRu: "Брюс Мейсон (1921-1982) - новозеландский драматург, актёр и театральный критик, родившийся в Веллингтоне. Он написал пьесы «The Pohutukawa Tree» и «The End of the Golden Weather».",
    evidence: [
      e("Dictionary of New Zealand Biography", "https://teara.govt.nz/en/biographies/5m37/mason-bruce-edward-george", "Национальный биографический словарь подтверждает годы, Веллингтон, театральные роли и пьесы Мейсона."),
      e("Read NZ Te Pou Muramura", "https://www.read-nz.org/writers-files/writer/mason-bruce", "Национальная читательская организация независимо подтверждает биографию и библиографию драматурга."),
    ],
    decision: "corrected",
    notes: "Исправлено место рождения; оценочная формула заменена театральными ролями и двумя пьесами.",
  },
  {
    key: "new_zealand:c_k_stead",
    originalSha256: "56e591c620e12d6ef771266ff4b16a8e31a90329585fd0d7721ae1d3e4eb1045",
    reviewedTextRu: "Кристиан Карлсон Стед (род. 1932) - новозеландский поэт, романист и литературный критик. Он написал романы «All Visitors Ashore» и «The Death of the Body», а также книгу «Mansfield».",
    evidence: [
      e("Read NZ Te Pou Muramura", "https://www.read-nz.org/writers-files/writer/stead-c-k-", "Национальная организация подтверждает год рождения, литературные роли и библиографию К. К. Стеда."),
      e("WorldCat", "https://search.worldcat.org/search?q=au%3A%22C.+K.+Stead%22", "Международный библиотечный каталог подтверждает авторскую идентичность и три названные книги."),
    ],
    decision: "corrected",
    notes: "Оценка значимости заменена профессиями и тремя библиографически установленными книгами.",
  },
  {
    key: "new_zealand:damien_wilkins",
    originalSha256: "64f79d8ed1356855f719f0909a4e23c7a2aa7ad966b38962be4c2feacce400b0",
    reviewedTextRu: "Дэмиен Уилкинс (род. 1963 в Лоуэр-Хатте) - новозеландский романист, автор рассказов и поэт. Среди его книг - «The Miserables», «The Veteran Perils» и «Max Gate».",
    evidence: [
      e("Read NZ Te Pou Muramura", "https://www.read-nz.org/writers-files/writer/wilkins-damien", "Национальная организация подтверждает год и место рождения, жанры и библиографию Дэмиена Уилкинса."),
      e("WorldCat", "https://search.worldcat.org/search?q=au%3A%22Damien+Wilkins%22", "Международный библиотечный каталог подтверждает авторскую идентичность и три названные книги."),
    ],
    decision: "corrected",
    notes: "Исправлено место рождения; ранжирование заменено жанрами и тремя книгами.",
  },
  {
    key: "new_zealand:eleanor_catton",
    originalSha256: "befdd61fe74e2feb96ecb7e9b56174e17effe10db9b6d79b2854df21a2ff355c",
    reviewedTextRu: "Элеанор Каттон (род. 1985 в Лондоне, Онтарио) - новозеландская писательница и сценаристка. Её роман «The Luminaries» получил Букеровскую премию 2013 года.",
    evidence: [
      e("Read NZ Te Pou Muramura", "https://www.read-nz.org/writers-files/writer/catton-eleanor/", "Национальная организация подтверждает канадское рождение, профессии, роман и Букеровскую премию."),
      e("The Booker Prizes", "https://thebookerprizes.com/the-booker-library/authors/eleanor-catton", "Официальный архив премии подтверждает авторскую идентичность и победу The Luminaries в 2013 году."),
    ],
    decision: "corrected",
    notes: "Уточнено канадское место рождения и исправлены координаты; рекламная формула заменена профессиями и официальной наградой.",
  },
  {
    key: "new_zealand:elizabeth_knox",
    originalSha256: "90c40c744d636bf8e3564bf9f5504d3b9ea1f8bcda94001a8efcfad440dbe308",
    reviewedTextRu: "Элизабет Нокс (род. 1959) - новозеландская писательница, автор книг для взрослых и подростков. Она написала романы «The Vintner’s Luck», «Dreamhunter» и «Dreamquake».",
    evidence: [
      e("Read NZ Te Pou Muramura", "https://www.read-nz.org/writers-files/writer/knox-elizabeth", "Национальная организация подтверждает год рождения, аудитории и библиографию Элизабет Нокс."),
      e("Arts Foundation of New Zealand", "https://www.thearts.co.nz/artists/elizabeth-knox", "Национальный фонд искусств независимо подтверждает писательскую карьеру и названные романы."),
    ],
    decision: "corrected",
    notes: "Ранжирование заменено аудиториями и тремя проверяемыми названиями романов.",
  },
  {
    key: "new_zealand:fiona_kidman",
    originalSha256: "c4de60bc4dff3cc3b9054af4ea575b086bfa850a288d601b230b88f1614fc189",
    reviewedTextRu: "Фиона Кидман (род. 1940 в Хавере) - новозеландская писательница, поэтесса и редактор. Её роман «This Mortal Boy» получил премию Acorn Foundation Fiction Prize в 2019 году.",
    evidence: [
      e("Read NZ Te Pou Muramura", "https://www.read-nz.org/writers-files/writer/kidman-fiona", "Национальная организация подтверждает год и место рождения, роли, роман и премию 2019 года."),
      e("Arts Foundation of New Zealand", "https://www.thearts.co.nz/artists/fiona-kidman", "Национальный фонд искусств независимо подтверждает литературную биографию и награды Фионы Кидман."),
    ],
    decision: "corrected",
    notes: "Исправлено место рождения; оценочная формула заменена профессиями, романом и датированной наградой.",
  },
  {
    key: "new_zealand:frank_sargeson",
    originalSha256: "43e041e849b61655f5508641f7b552c2b178ce37e5654161ada9d63aacc53cf7",
    reviewedTextRu: "Фрэнк Сарджесон (1903-1982), урождённый Норрис Фрэнк Дэйви, - новозеландский автор рассказов, романист и драматург. Среди его книг - «That Summer» и «The Stories of Frank Sargeson».",
    evidence: [
      e("Dictionary of New Zealand Biography", "https://teara.govt.nz/en/biographies/4s5/sargeson-frank/print", "Национальный биографический словарь подтверждает настоящее имя, годы, жанры и библиографию Сарджесона."),
      e("Read NZ Te Pou Muramura", "https://www.read-nz.org/writers-files/writer/sargeson-frank", "Национальная читательская организация независимо подтверждает литературные роли и названные книги."),
    ],
    decision: "corrected",
    notes: "Широкая оценка влияния заменена настоящим именем, жанрами и двумя книгами.",
  },
  {
    key: "new_zealand:james_k_baxter",
    originalSha256: "9921eb11fac9b45a8aa6ee10e7c2cfb8328e4b521269cfe4abadc157479a5359",
    reviewedTextRu: "Джеймс Кир Бакстер (1926-1972) - новозеландский поэт, драматург и литературный критик. Среди его книг - «Pig Island Letters» и «Jerusalem Sonnets».",
    evidence: [
      e("Dictionary of New Zealand Biography", "https://teara.govt.nz/en/biographies/5b14/baxter-james-keir", "Национальный биографический словарь подтверждает годы, жанры и библиографию Джеймса К. Бакстера."),
      e("Read NZ Te Pou Muramura", "https://www.read-nz.org/writers-files/writer/baxter-james-k-", "Национальная читательская организация независимо подтверждает литературные роли и сборники поэта."),
    ],
    decision: "corrected",
    notes: "Оценочное ранжирование заменено жанрами и двумя конкретными сборниками.",
  },
  {
    key: "new_zealand:jane_mander",
    originalSha256: "7599a3e29e23292b66b7ed4a76ac9bacf5f7603d8bb5d42f9d0d0ec5e4137cb0",
    reviewedTextRu: "Джейн Мандер (1877-1949), родившаяся в Рамараме, - новозеландская писательница и журналистка. Она написала романы «The Story of a New Zealand River» и «Allen Adair».",
    evidence: [
      e("Dictionary of New Zealand Biography", "https://teara.govt.nz/en/biographies/4m34/mander-mary-jane", "Национальный биографический словарь подтверждает годы, Рамараму, профессии и романы Джейн Мандер."),
      e("Read NZ Te Pou Muramura", "https://www.read-nz.org/writers-files/writer/mander-jane", "Национальная читательская организация независимо подтверждает биографию и библиографию писательницы."),
    ],
    decision: "corrected",
    notes: "Исправлено место рождения; общая формула заменена профессиями и двумя романами.",
  },
  {
    key: "new_zealand:janet_frame",
    originalSha256: "0d910399413639b7fec1654fb30fb47d42046974c1b2caddb01ef6b2bb0fac76",
    reviewedTextRu: "Джанет Фрейм (1924-2004) - новозеландская писательница, поэтесса и автор автобиографической прозы. Она написала романы «Owls Do Cry» и «Faces in the Water», а также книгу «An Angel at My Table».",
    evidence: [
      e("Dictionary of New Zealand Biography", "https://teara.govt.nz/en/biographies/6f1/frame-janet-paterson", "Национальный биографический словарь подтверждает годы, жанры и основные книги Джанет Фрейм."),
      e("Read NZ Te Pou Muramura", "https://www.read-nz.org/writers-files/writer/frame-janet", "Национальная читательская организация независимо подтверждает литературную биографию и библиографию Фрейм."),
    ],
    decision: "corrected",
    notes: "Оценочная формула заменена жанрами и тремя библиографически установленными книгами.",
  },
  {
    key: "new_zealand:kate_de_goldi",
    originalSha256: "c1b4a068d6f542546d5a4dd6d62026c86e5d674202f4af6d19562cfa4a344852",
    reviewedTextRu: "Кейт Де Голди (род. 1959) - новозеландская писательница, автор прозы для взрослых, подростков и детей. Она написала «The 10 PM Question» и «From the Cutting Room of Barney Kettle».",
    evidence: [
      e("Read NZ Te Pou Muramura", "https://www.read-nz.org/writers-files/writer/de-goldi-kate", "Национальная организация подтверждает год рождения, аудитории и библиографию Кейт Де Голди."),
      e("WorldCat", "https://search.worldcat.org/search?q=au%3A%22Kate+De+Goldi%22", "Международный библиотечный каталог подтверждает авторскую идентичность и два названных произведения."),
    ],
    decision: "corrected",
    notes: "Общая характеристика уточнена аудиториями и двумя конкретными книгами.",
  },
  {
    key: "new_zealand:katherine_mansfield",
    originalSha256: "038b9ed4431590925a7aeed32101cdc2f923915d567ac92822eb29f30a7c3396",
    reviewedTextRu: "Кэтрин Мэнсфилд (1888-1923), урождённая Кэтлин Бошан, - новозеландская писательница, работавшая преимущественно в жанре рассказа. Среди её книг - «Bliss and Other Stories» и «The Garden Party and Other Stories».",
    evidence: [
      e("Dictionary of New Zealand Biography", "https://teara.govt.nz/en/biographies/3m42/mansfield-katherine", "Национальный биографический словарь подтверждает настоящее имя, годы, жанр и библиографию Мэнсфилд."),
      e("Read NZ Te Pou Muramura", "https://www.read-nz.org/writers-files/writer/mansfield-katherine", "Национальная читательская организация независимо подтверждает биографию и названные сборники рассказов."),
    ],
    decision: "corrected",
    notes: "Ранжирование заменено настоящим именем, жанром и двумя оригинальными названиями сборников.",
  },
] as const satisfies readonly ReviewSeed[];

export const writerBiographyFactReviewBatch41: readonly WriterBiographyFactReviewRecord[] =
  seeds.map((seed) => ({
    key: seed.key,
    originalSha256: seed.originalSha256,
    reviewedTextRu: seed.reviewedTextRu,
    applicableTextRu: seed.decision === "held" ? null : seed.reviewedTextRu,
    claims: [
      {
        textRu: seed.reviewedTextRu,
        verdict: seed.decision === "held" ? "not-established" : "corrected",
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
  }));
