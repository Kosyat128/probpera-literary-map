export const WRITER_BIOGRAPHY_FACT_REVIEW_BATCH49_REVIEWER =
  "Codex independent claim-by-claim factual review, batch 49";

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

const reviewer = WRITER_BIOGRAPHY_FACT_REVIEW_BATCH49_REVIEWER;
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
    key: "south_africa:andre_brink",
    originalSha256: "ac34ee53de30b6363e889ce6e0f47099c251a5c455edbf523ad2eaca59ace28a",
    reviewedTextRu: "Андре Бринк (1935–2015) — южноафриканский романист, драматург, литературный критик и преподаватель. Он выступал против апартеида; среди его произведений — роман «A Dry White Season».",
    evidence: [
      e("South African History Online", "https://sahistory.org.za/people/andre-philippus-brink", "Биографическая справка подтверждает годы 1935–2015, работу Бринка как романиста, драматурга, критика и преподавателя и его выступления против апартеида."),
      e("Rhodes University", "https://www.ru.ac.za/communicationsandadvancement/alumnirelations/latestnews/deceased2015/professorandrebrink/", "Университетский некролог независимо подтверждает литературную и академическую деятельность Бринка, публикации на африкаанс и английском и роман A Dry White Season."),
    ],
    decision: "corrected",
    notes: "Оценочное определение «один из лидеров» заменено проверяемыми занятиями, общественной позицией и произведением.",
  },
  {
    key: "south_africa:breyten_breytenbach",
    originalSha256: "ad75ad4f3d24c8cc155fbcb987d3e96f80ff4509ce8437b1a92f701bb53b1d20",
    reviewedTextRu: "Брейтен Брейтенбах (1939–2024) — южноафриканский поэт, прозаик, художник и противник апартеида, писавший преимущественно на африкаанс. Его книга «The True Confessions of an Albino Terrorist» основана на тюремном опыте.",
    evidence: [
      e("South African History Online", "https://sahistory.org.za/people/breyten-breytenbach", "Справка подтверждает годы 1939–2024, работу Брейтенбаха как поэта, писателя и художника, его письмо на африкаанс и борьбу против апартеида."),
      e("Kelly Writers House, University of Pennsylvania", "https://writing.upenn.edu/wh/about/news/20081211_breytenbach.php", "Университетский литературный центр независимо характеризует Брейтенбаха как писателя, поэта, художника и активиста и связывает The True Confessions of an Albino Terrorist с его заключением."),
    ],
    decision: "corrected",
    notes: "Исходная однофразовая справка расширена проверяемыми занятиями, общественной позицией и конкретной книгой без оценочного ранжирования.",
  },
  {
    key: "south_africa:cj_langenhoven",
    originalSha256: "d827e241a5ea9b80c7cef375b3a602a36e10e518956647c1baffdb884169b33a",
    reviewedTextRu: "Корнелис Якоб Лангенховен (1873–1932) — южноафриканский писатель, журналист и политик, участвовавший в утверждении африкаанс как литературного и официального языка. Он написал текст «Die Stem van Suid-Afrika».",
    evidence: [
      e("Langenhoven Gedenkfonds", "https://cjlangenhoven.co.za/langenhovens-life/", "Официальный мемориальный фонд подтверждает годы жизни, занятия драматурга, поэта, журналиста и политика и кампанию Лангенховена за официальный статус африкаанс."),
      e("Encyclopaedia of South African Theatre, Stellenbosch University", "https://esat.sun.ac.za/index.php/C.J._Langenhoven", "Университетская энциклопедия независимо подтверждает литературную, журналистскую и политическую деятельность и указывает, что Лангенховен написал слова Die Stem van Suid-Afrika."),
    ],
    decision: "corrected",
    notes: "Субъективная формула «один из крупнейших» заменена документированными ролями, языковой деятельностью и произведением.",
  },
  {
    key: "south_africa:damon_galgut",
    originalSha256: "45104fd08f17ad4a63e04dc7d288378148c61fa8320853dc63a3eec0ba0c5d51",
    reviewedTextRu: "Деймон Гэлгут (род. 1963) — южноафриканский романист и драматург. Его роман «The Promise» получил Букеровскую премию 2021 года.",
    evidence: [
      e("The Booker Prizes", "https://thebookerprizes.com/the-booker-library/authors/damon-galgut", "Официальный сайт премии подтверждает 1963 год рождения, южноафриканскую принадлежность и победу The Promise в 2021 году."),
      e("Encyclopaedia of South African Theatre, Stellenbosch University", "https://esat.sun.ac.za/index.php?title=Damon_Galgut", "Университетская энциклопедия независимо подтверждает, что Гэлгут — родившийся в 1963 году южноафриканский романист и драматург, и перечисляет The Promise."),
    ],
    decision: "corrected",
    notes: "Расплывчатое «современный писатель» заменено точными жанрами и названием отмеченного премией романа.",
  },
  {
    key: "south_africa:eskia_mphahlele",
    originalSha256: "1d7f226e0b1856a0ef09b7cf600094cf6951a67681f59a141155ab559c7af1ef",
    reviewedTextRu: "Эскиа Мфалеле (1919–2008) — южноафриканский писатель, педагог и исследователь литературы. Среди его книг — автобиография «Down Second Avenue» и исследование «The African Image».",
    evidence: [
      e("South African History Online", "https://sahistory.org.za/people/eskia-mphahlele", "Справка подтверждает годы 1919–2008, литературную и преподавательскую деятельность Мфалеле и автобиографию Down Second Avenue."),
      e("University of South Africa", "https://www.unisa.ac.za/sites/corporate/default/Unisa-History-and-Memory-Project/Personalities/All-personalities/Es%27kia-Mphahlele", "Университетская биография независимо подтверждает его работу писателем, педагогом и учёным и документирует Down Second Avenue и The African Image."),
    ],
    decision: "corrected",
    notes: "Недоказанное первенство в «африканском гуманизме» заменено подтверждёнными занятиями и книгами.",
  },
  {
    key: "south_africa:herman_charles_bosman",
    originalSha256: "6900bc71e6be6a84479285c70e661f7beaa19f271af8d58e56a2c7afa355f670",
    reviewedTextRu: "Герман Чарльз Босман (1905–1951) — южноафриканский автор рассказов, романист, драматург и журналист. Сборник «Mafeking Road» включает его рассказы об Уме Схалке Лоуренсе.",
    evidence: [
      e("Routledge Encyclopedia of Modernism", "https://www.rem.routledge.com/articles/bosman-herman-charles-1905-1951", "Энциклопедия подтверждает годы жизни, литературную и журналистскую деятельность Босмана и его рассказы об Уме Схалке Лоуренсе."),
      e("Encyclopaedia of South African Theatre, Stellenbosch University", "https://esat.sun.ac.za/index.php/Herman_Charles_Bosman", "Университетская энциклопедия независимо называет Босмана писателем, драматургом и журналистом и указывает, что Mafeking Road вышел в 1947 году."),
    ],
    decision: "corrected",
    notes: "Оценочное определение «мастер рассказа» заменено документированными жанрами, профессией и конкретным сборником.",
  },
  {
    key: "south_africa:ivan_vladislavic",
    originalSha256: "1f926be49aa60347f7869d982c9d9351f223bf2a4c698bcf605bfcc68be87a98",
    reviewedTextRu: "Иван Владиславич (род. 1957) — южноафриканский писатель и редактор, живущий в Йоханнесбурге. Среди его книг — романы «The Restless Supermarket» и «Double Negative».",
    evidence: [
      e("Penguin Random House South Africa", "https://www.penguinrandomhouse.co.za/authors/ivan-vladislavi/", "Издательская биография называет Владиславича романистом, эссеистом и редактором, живущим в Йоханнесбурге, и перечисляет The Restless Supermarket и Double Negative."),
      e("Windham-Campbell Prizes, Yale University", "https://windhamcampbell.org/festival/2015/recipients/vladislavi%C4%87-ivan", "Премиальный центр Йельского университета независимо подтверждает его художественную и редакторскую работу, связь с Южной Африкой и роман Double Negative."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование среди представителей городской прозы заменено проверяемыми занятиями, местом работы и произведениями.",
  },
  {
    key: "south_africa:jm_coetzee",
    originalSha256: "2f44ac29e22fdb6d78433fb6e0f204d5656db58ca0c63d2a5b58c85d332578a6",
    reviewedTextRu: "Лауреат Нобелевской премии по литературе 2003 года.",
    evidence: [
      e("Nobel Prize", "https://www.nobelprize.org/prizes/literature/2003/coetzee/facts/", "Официальная страница Нобелевской премии указывает Дж. М. Кутзее как лауреата по литературе 2003 года."),
      e("University of Cape Town", "https://www.news.uct.ac.za/publications/mondaymonthly/archive/-edition/2003-10-06-edition-29/-article/2003-10-06-coetzee-is-third-uct-nobel-prize-laureate", "Кейптаунский университет независимо подтверждает присуждение Кутзее Нобелевской премии по литературе в 2003 году."),
    ],
    decision: "unchanged",
    notes: "Исходное утверждение точное, нейтральное и полностью подтверждено; изменений не требуется.",
  },
  {
    key: "south_africa:kopano_matlwa",
    originalSha256: "0f86e4922e11d964f80cc810bba6dd061a0f552f8e8323ca7a8847f0f8e10bd7",
    reviewedTextRu: "Копано Матлва Мабасо (род. 1985) — южноафриканская писательница и врач. Её дебютный роман «Coconut» получил European Union Literary Award и позднее совместно выиграл Wole Soyinka Prize for Literature in Africa.",
    evidence: [
      e("University of Cape Town", "https://www.news.uct.ac.za/article/-2017-03-14-blackgirlmagic-for-the-literary-world", "Университетская публикация подтверждает, что Матлва — врач и писательница, и связывает Coconut с European Union Literary Award и Wole Soyinka Prize."),
      e("Hachette UK", "https://www.hachette.co.uk/contributor/kopano-matlwa/", "Издательская биография независимо подтверждает 1985 год рождения, медицинскую профессию, дебютный роман Coconut и полученные им награды."),
    ],
    decision: "corrected",
    notes: "Общее определение «представитель нового поколения» заменено проверяемыми профессиями, романом и премиями.",
  },
  {
    key: "south_africa:mandla_langa",
    originalSha256: "410af5219471b5815b7921111d7bfab0e2d17a8a021b3b93ac1d02658f8a1469",
    reviewedTextRu: "Мандла Ланга (род. 1950) — южноафриканский поэт, романист и автор рассказов. Среди его романов — «The Memory of Stones» и «The Lost Colours of the Chameleon».",
    evidence: [
      e("South African History Online", "https://sahistory.org.za/people/mandla-langa", "Справка подтверждает 1950 год рождения, работу поэта, романиста и редактора и перечисляет The Memory of Stones и The Lost Colours of the Chameleon."),
      e("The Presidency of South Africa", "https://www.thepresidency.gov.za/appointment-new-advisory-council-members", "Президентская служба независимо характеризует Лангу как поэта, автора рассказов и романиста и подтверждает его национальное признание."),
    ],
    decision: "corrected",
    notes: "Журналистская роль в исходнике не сделана центральной: формулировка приведена к подтверждённым литературным жанрам и произведениям. Место рождения очищено из-за внутреннего расхождения в справке SAHO между Стэнгером и Дурбаном.",
  },
  {
    key: "south_africa:marlene_van_niekerk",
    originalSha256: "94f234d17c9b54096aaabb639fddccaf7a8187de525c003b45344f64dec48b00",
    reviewedTextRu: "Марлен ван Никерк (род. 1954) — южноафриканская писательница на африкаанс, также работавшая в университетах. Среди её романов — «Triomf» и «Agaat».",
    evidence: [
      e("Tilburg University", "https://www.tilburguniversity.edu/nl/over/historie-en-academisch-erfgoed/eredoctoraten/marlene-niekerk", "Университетская справка подтверждает 1954 год рождения, письмо на африкаанс, академическую работу и романы Triomf и Agaat."),
      e("The Presidency of South Africa", "https://www.thepresidency.gov.za/sites/default/files/2022-07/National%20Orders%20Booklet%202011_0.pdf", "Официальный наградной буклет независимо перечисляет Triomf, Agaat и Memorandum и описывает литературную и университетскую деятельность ван Никерк."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование удалено; добавлены документированные язык, академическая работа и произведения. Неподтверждённое название «Тристан» в профиле заменено официально перечисленными книгами.",
  },
  {
    key: "south_africa:nadine_gordimer",
    originalSha256: "db1032b6b568b3ed1e1397229c8ede00853480619a4ebaaea8cb9433adbc8ed5",
    reviewedTextRu: "Лауреат Нобелевской премии по литературе 1991 года.",
    evidence: [
      e("Nobel Prize", "https://www.nobelprize.org/prizes/literature/1991/gordimer/facts/", "Официальная страница Нобелевской премии указывает Надин Гордимер как лауреата по литературе 1991 года."),
      e("University of Johannesburg", "https://www.uj.ac.za/library/information-resources/special-collections/online-exhibitions/nadine-gordimer/", "Университетская выставка независимо подтверждает биографию Гордимер и получение Нобелевской премии по литературе в 1991 году."),
    ],
    decision: "unchanged",
    notes: "Исходное утверждение точное, нейтральное и полностью подтверждено; изменений не требуется.",
  },
  {
    key: "south_africa:olive_schreiner",
    originalSha256: "69b3afd297bc7aa846e3ea66b42dc25d2ff7d3f829e80048f81905fdafa4962f",
    reviewedTextRu: "Олив Шрайнер (1855–1920) — южноафриканская писательница, феминистка и общественная деятельница. Её роман «The Story of an African Farm» вышел в 1883 году.",
    evidence: [
      e("South African History Online", "https://sahistory.org.za/people/olive-schreiner", "Справка подтверждает годы жизни, работу писательницы и феминистки, роман 1883 года и рождение в Виттебергене близ Хершела."),
      e("University of Wisconsin–Madison", "https://dept.english.wisc.edu/amcclintock/schreiner.htm", "Университетская биография независимо подтверждает рождение 24 марта 1855 года в миссии Виттеберген и публикацию The Story of an African Farm в 1883 году."),
    ],
    decision: "corrected",
    notes: "Недоказанное первенство в современной литературе заменено подтверждёнными ролями и произведением. Место рождения в профиле исправлено с Винбурга на Виттеберген.",
  },
  {
    key: "south_africa:sindiwe_magona",
    originalSha256: "5843892c1037ffea7f9437d1c4d24b1254713f65294eda9f59375209fabe46a1",
    reviewedTextRu: "Синдиве Магона (род. 1943) — южноафриканская писательница, поэт, драматург и общественная деятельница. Среди её романов — «Mother to Mother» и «Beauty’s Gift».",
    evidence: [
      e("South African History Online", "https://sahistory.org.za/people/sindiwe-magona", "Справка подтверждает рождение в 1943 году в Гунгулулу, занятия писательницы, поэта, драматурга и активистки и литературные достижения Магоны."),
      e("The Presidency of South Africa", "https://www.thepresidency.gov.za/sites/default/files/2022-07/National%20Orders%20Booklet%202011_0.pdf", "Официальный наградной буклет независимо указывает деревню Гунгулу в бывшем Транскее как место рождения и подтверждает достижения Магоны в литературе и драматургии."),
    ],
    decision: "corrected",
    notes: "Тематика исходной справки заменена проверяемыми занятиями и произведениями. Место рождения в профиле исправлено с Умтаты на деревню Гунгулулу.",
  },
  {
    key: "south_africa:sol_plaatje",
    originalSha256: "0eb7da099bdb39b9d2fcafeb5b7eba6635cef3e4b0e89b441d76284833fe02ee",
    reviewedTextRu: "Соломон Плаатье (1876–1932) — южноафриканский писатель, переводчик, журналист и политический деятель. Он написал роман «Mhudi» и книгу «Native Life in South Africa».",
    evidence: [
      e("Department of Basic Education, South Africa", "https://www.education.gov.za/TheDBE/SolPlaatjeHouse/tabid/442/ItemId/1225/Default.aspx", "Государственная образовательная страница подтверждает годы 1876–1932, журналистскую, переводческую и политическую работу Плаатье и его книги."),
      e("Sol Plaatje University", "https://www.spu.ac.za/index.php/sol-plaatje/", "Университет независимо называет Плаатье писателем, переводчиком, журналистом и политиком и связывает с ним Mhudi и Native Life in South Africa."),
    ],
    decision: "corrected",
    notes: "Расплывчатое и оценочное описание заменено документированными занятиями и двумя произведениями.",
  },
  {
    key: "south_africa:zakes_mda",
    originalSha256: "e8c790b920e3b0b22a07d31bce7638cd641d9bcb22713ab171f907c05b414124",
    reviewedTextRu: "Закес Мда (род. 1948) — южноафриканский романист, драматург, поэт и художник. Среди его романов — «Ways of Dying» и «The Heart of Redness».",
    evidence: [
      e("South African History Online", "https://sahistory.org.za/people/zanemvula-kizito-mda", "Справка подтверждает 1948 год рождения, деятельность Мды как романиста, драматурга, поэта и художника и основные произведения."),
      e("Ohio University", "https://www.ohio.edu/cas/ping-institute/humanities-park/writers-storytellers", "Университет независимо подтверждает литературную, драматургическую и художественную работу Мды и романы Ways of Dying и The Heart of Redness."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование среди современных авторов удалено; добавлены документированные занятия и произведения, а ошибочное русское имя «Зукесва Мда» исправлено.",
  },
  {
    key: "south_africa:zoe_wicomb",
    originalSha256: "5c10baeed5e028c239af44c5566ddecd1dc0c73fcfeaa3ac7a26d17132a3658a",
    reviewedTextRu: "Зои Викомб (1948–2025) — южноафриканская писательница и преподавательница, много лет работавшая в Великобритании. Среди её книг — «You Can’t Get Lost in Cape Town» и «David’s Story».",
    evidence: [
      e("University of the Western Cape", "https://www.uwc.ac.za/news-and-announcements/news/remembering-zoe-wicomb", "Университет подтверждает даты 23 ноября 1948 — 13 октября 2025, академическую и литературную деятельность Викомб и перечисляет You Can’t Get Lost in Cape Town и David’s Story."),
      e("SOAS University of London Research Online", "https://soas-repository.worktribe.com/OutputFile/424058", "Академическая публикация независимо указывает, что Викомб родилась и выросла в Бизуотере; ближайшим городом, записанным в свидетельстве, был Ванринсдорп."),
      e("Daily Maverick", "https://www.dailymaverick.co.za/article/2025-10-20-farewell-zoe-wicomb-the-vivid-voyager-who-wrote-sa-into-the-world/", "Независимый некролог подтверждает связь Викомб с Бизуотером и её смерть в Глазго 13 октября 2025 года."),
    ],
    decision: "corrected",
    notes: "Тематическое описание заменено проверяемыми занятиями и книгами; учтена смерть в 2025 году. В профиле исправлены устаревшие годы, дата смерти и ошибочное место рождения Порт-Элизабет.",
  },
  {
    key: "south_korea:bae_su_a",
    originalSha256: "29cadd35ddc5ca8fb94222ec59381e026384a4096e14afa6031e894f56bacf4d",
    reviewedTextRu: "Пэ Су А (род. 1965) — южнокорейская писательница и переводчица с немецкого языка. Среди её книг — «Nowhere to Be Found» и «A Greater Music».",
    evidence: [
      e("Digital Library of Korean Literature, LTI Korea", "https://library.ltikorea.or.kr/writer/200064", "Государственная литературная библиотека подтверждает 1965 год рождения, работу романистки и переводчицы немецкой литературы и книги Nowhere to Be Found и A Greater Music."),
      e("Deep Vellum Publishing", "https://www.deepvellum.org/authors/bae-suah", "Независимый издатель подтверждает биографию Пэ Су А как южнокорейской писательницы и переводчицы и документирует её книги в английском переводе."),
    ],
    decision: "corrected",
    notes: "Оценочная характеристика экспериментальности заменена проверяемыми профессиями, языком переводов и произведениями.",
  },
  {
    key: "south_korea:byun_hyung_jun",
    originalSha256: "34b9818ebf68c0c72948661957933f46f8e84c9d8c08e5cbe5a583d0ade52248",
    reviewedTextRu: "Личность южнокорейского писателя «Пён Хёнджун» (Byun Hyung-jun), которому в профиле приписаны 1962 год рождения и премия Хван Сун-вон, не удалось однозначно установить по проверенным авторитетным литературным каталогам.",
    evidence: [
      e("Library of Congress — поиск каталога", "https://catalog.loc.gov/vwebv/search?searchArg=Byun+Hyung-jun&searchCode=GKEY%5E*&searchType=0&recCount=25", "Поиск по точному латинскому написанию имени не выявляет однозначной авторской записи южнокорейского писателя с заявленными данными."),
      e("Bibliothèque nationale de France — поиск каталога", "https://catalogue.bnf.fr/rechercher.do?motRecherche=Byun+Hyung-jun&critereRecherche=0&depart=0&facetteModifiee=ok", "Независимый поиск по точному имени не даёт авторитетной записи, подтверждающей личность, 1962 год рождения, произведения или премию Хван Сун-вон."),
    ],
    decision: "held",
    notes: "Fail-closed: точное имя, год рождения, произведения и награду не удалось связать с одной подтверждённой писательской личностью; карточка должна оставаться в карантине до появления первичного идентификатора или авторитетной библиографической записи.",
  },
  {
    key: "south_korea:cho_nam_joo",
    originalSha256: "8067882d14c2d56e9674f893fe09f0f6fb0939fbbca2e5086a9307d5a5617870",
    reviewedTextRu: "Чо Нам Джу (род. 1978) — южнокорейская писательница, прежде работавшая телевизионным сценаристом. Её роман «Kim Jiyoung, Born 1982» посвящён гендерному неравенству в современной Корее.",
    evidence: [
      e("Digital Library of Korean Literature, LTI Korea", "https://library.ltikorea.or.kr/writer/200129", "Литературная библиотека подтверждает 1978 год рождения, работу телевизионным сценаристом до литературной карьеры и роман Kim Jiyoung, Born 1982."),
      e("Simon & Schuster UK", "https://www.simonandschuster.co.uk/books/Kim-Jiyoung-Born-1982/Cho-Nam-Joo/9781471184307", "Издатель независимо подтверждает авторство романа, биографию Чо Нам Джу и центральную тему гендерной дискриминации."),
    ],
    decision: "corrected",
    notes: "Общая формула об известности заменена подтверждёнными профессией, произведением и его тематикой.",
  },
  {
    key: "south_korea:choi_in_hun",
    originalSha256: "2dc9258b8abba0f9ef0a9acee30deb0d98ad7c61324b144aaf5bdd08a3e412ad",
    reviewedTextRu: "Чхве Ин Хун (1936–2018) — южнокорейский романист и драматург. Его роман «The Square» (1960) рассматривает идеологическое разделение Корейского полуострова.",
    evidence: [
      e("Digital Library of Korean Literature, LTI Korea", "https://library.ltikorea.or.kr/writer/200258", "Литературная библиотека подтверждает годы жизни, работу романиста и драматурга и публикацию The Square в 1960 году; в описании страницы есть внутреннее расхождение по году рождения, поэтому профильные даты не менялись."),
      e("Korea.net", "https://www.korea.net/NewsFocus/Culture/view?articleId=126139", "Официальный государственный портал независимо указывает 1936 год рождения и описывает The Square как роман об идеологическом расколе Кореи."),
    ],
    decision: "corrected",
    notes: "Оценочное определение «один из главных интеллектуальных авторов» заменено жанрами, датированным произведением и проверяемой тематикой.",
  },
  {
    key: "south_korea:gong_ji_young",
    originalSha256: "39f2ede31fc3f606253fc6378939576958ca6fa40e2c792766b347608cf05f64",
    reviewedTextRu: "Кон Джи Ён (род. 1963) — южнокорейская писательница. Среди её романов — «Our Happy Time» и «The Crucible», затрагивающие смертную казнь и насилие над детьми соответственно.",
    evidence: [
      e("Digital Library of Korean Literature, LTI Korea", "https://library.ltikorea.or.kr/writer/200117", "Литературная библиотека подтверждает 1963 год рождения, профессию романистки и книги Our Happy Time и The Crucible с указанной социальной проблематикой."),
      e("Simon & Schuster", "https://www.simonandschuster.com/authors/Gong-Ji-young/425701207", "Издательская биография независимо подтверждает авторство Кон Джи Ён и её романы Our Happy Time и The Crucible."),
    ],
    decision: "corrected",
    notes: "Расплывчатая характеристика социальной прозы заменена конкретными произведениями и документированной тематикой.",
  },
  {
    key: "south_korea:han_kang",
    originalSha256: "858a7d921639e1f972f6ee19177382a54d04b4ddba04786ca161523ca6506d2e",
    reviewedTextRu: "Хан Ган (род. 1970) — южнокорейская писательница, лауреат Нобелевской премии по литературе 2024 года. Её роман «The Vegetarian» получил Международную Букеровскую премию 2016 года.",
    evidence: [
      e("Nobel Prize", "https://www.nobelprize.org/prizes/literature/2024/han/facts/", "Официальная страница подтверждает 1970 год рождения Хан Ган и присуждение ей Нобелевской премии по литературе 2024 года."),
      e("The Booker Prizes", "https://thebookerprizes.com/the-booker-library/books/the-vegetarian", "Официальный сайт Букеровской премии независимо подтверждает победу The Vegetarian в Международной Букеровской премии 2016 года."),
    ],
    decision: "corrected",
    notes: "Оценочные характеристики и широкое перечисление тем заменены двумя точно подтверждёнными премиальными фактами.",
  },
  {
    key: "south_korea:han_yong_un",
    originalSha256: "442ec782e519ac65c80ba7961b2500bbb9247fde5523a25f5461129dd15ccc24",
    reviewedTextRu: "Хан Ён Ун (1879–1944), известный под псевдонимом Манхэ, — корейский буддийский монах, поэт и участник движения за независимость. Его сборник «Silence of Love» вышел в 1926 году.",
    evidence: [
      e("Encyclopedia of Korean Culture, Academy of Korean Studies", "https://encykorea.aks.ac.kr/Article/E0061853", "Академическая энциклопедия подтверждает годы 1879–1944, место рождения Хонсон, псевдоним Манхэ и роли монаха, поэта и борца за независимость."),
      e("Digital Library of Korean Literature, LTI Korea", "https://library.ltikorea.or.kr/writer/200657", "Литературная библиотека независимо подтверждает происхождение из Хонсона, занятия и публикацию сборника Silence of Love в 1926 году."),
    ],
    decision: "corrected",
    notes: "Исходная характеристика конкретизирована псевдонимом и датированным сборником. Ошибочный Хончхон в профиле заменён подтверждённым Хонсоном.",
  },
  {
    key: "south_korea:ho_gyun",
    originalSha256: "25e96037eee94448b220cce940b5ed8dc3110f0c9eb68c361ccf980dbf2ea000",
    reviewedTextRu: "Хо Гюн (1569–1618) — корейский литератор и мыслитель эпохи Чосон. «Повесть о Хон Гильдоне» традиционно приписывается ему, однако авторство остаётся предметом научной дискуссии.",
    evidence: [
      e("Encyclopedia of Korean Culture, Academy of Korean Studies", "https://encykorea.aks.ac.kr/Article/E0063994", "Академическая энциклопедия приводит традиционную связь «Повести о Хон Гильдоне» с Хо Гюном и описывает историю произведения."),
      e("Korea Citation Index", "https://www.kci.go.kr/kciportal/ci/sereArticleSearch/ciSereArtiView.kci?sereArticleSearchBean.artiId=ART001722029", "Рецензируемая статья «The Genealogy of Discussion on the Authorship of Hong Gildong Jeon» документирует спорность атрибуции и аргументы против отождествления дошедшего текста с произведением Хо Гюна."),
    ],
    decision: "corrected",
    notes: "Категорическая формула об авторстве и «первом корейском романе» смягчена: традиционная атрибуция сохранена, но отражён документированный научный спор.",
  },
  {
    key: "south_korea:hwang_seok_yong",
    originalSha256: "3fa636e33a67b4f5b21ffc28fe266f0175931c6745e08cb2e0b9369991245c0d",
    reviewedTextRu: "Хван Сок Ён (род. 1943) — южнокорейский романист. Среди его книг — «The Guest», «The Old Garden» и «Princess Bari».",
    evidence: [
      e("Digital Library of Korean Literature, LTI Korea", "https://library.ltikorea.or.kr/writer/200290", "Литературная библиотека подтверждает 1943 год рождения, профессию романиста и библиографию Хван Сок Ёна, включая The Guest, The Old Garden и Princess Bari."),
      e("The Booker Prizes", "https://thebookerprizes.com/the-booker-library/authors/hwang-sok-yong", "Официальный премиальный профиль независимо подтверждает биографию автора и перечисляет The Guest, The Old Garden и Princess Bari."),
    ],
    decision: "corrected",
    notes: "Оценочное ранжирование и обобщённая тематика заменены проверяемой профессией и произведениями.",
  },
  {
    key: "south_korea:il_yeon",
    originalSha256: "4a65234816e7e7f78e20e4424c7e56ae5ad5d675a6dc93d6ac671d5dd6ea6b50",
    reviewedTextRu: "Ирён (1206–1289) — корейский буддийский монах эпохи Корё, составитель «Samguk Yusa». Этот свод объединяет исторические предания, мифы и другие сведения о ранней истории Кореи.",
    evidence: [
      e("Korea Heritage Service", "https://www.heritage.go.kr/heri/cul/culSelectDetail.do?ccbaCpno=1111103060200&pageNo=1_1_1_1", "Государственная служба наследия описывает Samguk Yusa как составленный монахом Ирёном памятник, содержащий предания и сведения о ранних корейских государствах."),
      e("UNESCO Memory of the World Committee for Asia and the Pacific", "https://www.mowcapunesco.org/wp-content/uploads/Korea-Samguk-yusa-4.pdf", "Номинационное досье ЮНЕСКО независимо подтверждает даты Ирёна, его буддийский статус и составление Samguk Yusa с историческими и мифологическими материалами."),
    ],
    decision: "corrected",
    notes: "Исправлена передача имени и дефис; оценка «один из важнейших» заменена описанием состава и исторического содержания источника.",
  },
  {
    key: "south_korea:jeong_cheol",
    originalSha256: "3918c7c1a2ba7979e38033e366b2aeec323015b8668accbb9ca6084934790673",
    reviewedTextRu: "Чон Чхоль (1536–1593) — корейский поэт и государственный деятель эпохи Чосон, известный под литературным именем Сонган. Его произведения «Gwandong byeolgok» и «Samiingok» относятся к жанру каса.",
    evidence: [
      e("Digital Library of Korean Literature, LTI Korea", "https://library.ltikorea.or.kr/writer/201040", "Литературная библиотека подтверждает годы жизни, литературное имя Сонган, государственную деятельность и произведения Gwandong byeolgok и Samiingok."),
      e("Encyclopedia of Korean Culture, Academy of Korean Studies", "https://encykorea.aks.ac.kr/Article/E0050998", "Академическая энциклопедия независимо подтверждает биографию Чон Чхоля и относит Gwandong byeolgok и Samiingok к его произведениям в жанре каса."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование среди мастеров поэзии заменено псевдонимом, конкретными произведениями и жанром.",
  },
  {
    key: "south_korea:jeong_yoo_jung",
    originalSha256: "2d51070d6021dd25f39f87695ff684775e83e3065c2c7c3a0088c7e76ae89846",
    reviewedTextRu: "Чон Юджон (род. 1966) — южнокорейская романистка, работающая в жанре психологического триллера. Среди её книг — «Seven Years of Darkness», «The Good Son» и «28».",
    evidence: [
      e("Digital Library of Korean Literature, LTI Korea", "https://library.ltikorea.or.kr/writer/200108", "Литературная библиотека подтверждает 1966 год рождения, работу романистки и книги Seven Years of Darkness, The Good Son и 28."),
      e("Penguin Random House", "https://www.penguinrandomhouse.com/books/604960/seven-years-of-darkness-by-you-jeong-jeong/", "Издатель независимо подтверждает авторство Seven Years of Darkness, биографию Чон Юджон и её работу в области психологического триллера."),
    ],
    decision: "corrected",
    notes: "Оценочное определение известности заменено проверяемым жанром и тремя произведениями; неоднозначно переведённые поля профиля не менялись без доказанного соответствия.",
  },
  {
    key: "south_korea:kim_aeran",
    originalSha256: "72952f7675ab4028ca255394c0f60b0dfac98923a19111196662247030f83fd6",
    reviewedTextRu: "Ким Э Ран (род. 1980) — южнокорейская писательница, автор рассказов и романов. Среди её книг — сборник «Run, Daddy, Run» и роман «My Brilliant Life».",
    evidence: [
      e("Digital Library of Korean Literature, LTI Korea", "https://library.ltikorea.or.kr/writer/200072", "Литературная библиотека подтверждает 1980 год рождения, профессию романистки, сборник Run, Daddy, Run и роман My Brilliant Life."),
      e("Macmillan", "https://us.macmillan.com/books/9781250750563/mybrilliantlife/", "Издательская страница независимо подтверждает авторство и английское название романа My Brilliant Life и биографию Ким Э Ран."),
    ],
    decision: "corrected",
    notes: "Субъективное поколенческое ранжирование заменено жанрами и произведениями. Неидентифицированное название «Моя дорогая мишень» в профиле заменено подтверждённым романом My Brilliant Life.",
  },
  {
    key: "south_korea:kim_hun",
    originalSha256: "2b04bee575dfe98b7d1bf422eb4545a33aa2a250deeadffedf522897ce4313ed",
    reviewedTextRu: "Ким Хун (род. 1948) — южнокорейский романист и журналист. Его исторический роман «Song of the Sword» посвящён адмиралу Ли Сунсину и получил литературную премию Тонъин.",
    evidence: [
      e("Digital Library of Korean Literature, LTI Korea", "https://library.ltikorea.or.kr/originalworks/102716", "Литературная библиотека подтверждает, что Song of the Sword написан Ким Хуном, посвящён адмиралу Ли Сунсину и получил премию Тонъин в 2001 году."),
      e("Shinchosha", "https://www.shinchosha.co.jp/writer/1323/", "Независимый издатель подтверждает рождение Ким Хуна в Сеуле в 1948 году, его длительную журналистскую карьеру и авторство Song of the Sword."),
    ],
    decision: "corrected",
    notes: "Оценочное ранжирование удалено; добавлены документированные профессии, произведение и премия. Дублирующие названия одной премии в профиле сведены к одной нормализованной записи.",
  },
  {
    key: "south_korea:kim_man_jung",
    originalSha256: "9c1595e0d905245202220ef1233984f7ca727acd51ea73726740cb5c5a22d007",
    reviewedTextRu: "Ким Ман Джун (1637–1692) — корейский литератор и государственный деятель эпохи Чосон. Ему принадлежат романы «The Nine Cloud Dream» и «Lady Sa’s Journey to the South».",
    evidence: [
      e("Digital Library of Korean Literature, LTI Korea", "https://library.ltikorea.or.kr/writer/200440", "Литературная библиотека подтверждает годы жизни, литературную и государственную деятельность Ким Ман Джуна и романы The Nine Cloud Dream и Lady Sa’s Journey to the South."),
      e("Encyclopedia of Korean Culture, Academy of Korean Studies", "https://encykorea.aks.ac.kr/Article/E0009082", "Академическая энциклопедия независимо подтверждает биографию и авторство обоих классических романов."),
    ],
    decision: "corrected",
    notes: "Оценка произведения как «одного из крупнейших» заменена подтверждёнными занятиями и названиями двух романов.",
  },
  {
    key: "south_korea:kim_so_wol",
    originalSha256: "35297815ab3ac712fbb95994431f167e04ef3a44e4a8e9a5c09d83ee09ade49e",
    reviewedTextRu: "Ким Соволь (1902–1934; настоящее имя Ким Чонсик) — корейский поэт. Его единственный прижизненный сборник «Azaleas» вышел в 1925 году и использует ритмику народной песни.",
    evidence: [
      e("Encyclopedia of Korean Culture, Academy of Korean Studies", "https://encykorea.aks.ac.kr/Article/E0009535", "Академическая энциклопедия подтверждает годы 1902–1934, настоящее имя Ким Чонсик, поэтическую деятельность и значение сборника «Азалии»."),
      e("Cultural Heritage Administration of Korea", "https://english.cha.go.kr/chaen/search/selectGeneralSearchDetail.do?canAsset=&canceled=&ccebAsno=04700300&ccebCtcd=&ccebKdcd=&ccebPcd1=&enCcebAsdt=&endNum=&mn=EN_02_02&pageIndex=444&region=&sCcebCtcd=31&sCcebKdcd=79&searchWrd=&stCcebAsdt=&startNum=", "Государственная служба культурного наследия независимо подтверждает настоящее имя, даты жизни и публикацию прижизненного сборника Jindallaekkot («Azaleas») в 1925 году, отмечая народную интонацию стихов."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование удалено; добавлены настоящее имя, проверяемый библиографический факт и связь поэтики с народной песней, русское имя приведено к цельному написанию «Ким Соволь».",
  },
  {
    key: "south_korea:kim_young_ha",
    originalSha256: "0d3be479638c06b9ab99726be012c66671cf8f08e8ba0d3a57aa134dd304095e",
    reviewedTextRu: "Ким Ён Ха (род. 1968) — южнокорейский романист. Среди его книг — «I Have the Right to Destroy Myself», «Your Republic Is Calling You» и «Diary of a Murderer».",
    evidence: [
      e("Digital Library of Korean Literature, LTI Korea", "https://library.ltikorea.or.kr/writer/200525.0?currentLanguageCd=CO-LAN-ENG", "Литературная библиотека подтверждает 1968 год рождения, профессию романиста и библиографию Ким Ён Ха."),
      e("British Council Korea", "https://www.britishcouncil.kr/sites/default/files/london-book-fair-2014_0.pdf", "Официальный справочник Британского совета независимо перечисляет I Have the Right to Destroy Myself, Your Republic Is Calling You и Diary of a Murderer и подтверждает биографию автора."),
    ],
    decision: "corrected",
    notes: "Оценочное определение популярности и обобщённая тематика заменены проверяемой профессией и произведениями; неоднозначный русский перевод названия в профиле не менялся.",
  },
  {
    key: "south_korea:ko_un",
    originalSha256: "3e2c241ff527671b8510e8405c8718d05dcd28aab5d70c818c898e94cbaf9771",
    reviewedTextRu: "Ко Ын (род. 1933) — южнокорейский поэт и прозаик. Его многотомный цикл «Ten Thousand Lives» задуман как поэтические портреты встреченных им людей.",
    evidence: [
      e("Poetry Foundation", "https://www.poetryfoundation.org/poets/ko-un-56d207070306a", "Литературный фонд подтверждает 1933 год рождения, работу поэта и прозаика и замысел цикла Ten Thousand Lives как портретов людей из жизни автора."),
      e("Griffin Poetry Prize", "https://griffinpoetryprize.com/lifetime-recognition/2008/", "Официальная страница подтверждает, что в 2008 году Ко Ын получил Lifetime Recognition Award фонда Griffin, а не ежегодную конкурсную премию Griffin Poetry Prize."),
    ],
    decision: "corrected",
    notes: "Оценочная известность и расплывчатое упоминание номинаций заменены проверяемым произведением. В профиле уточнено, что признание Griffin Trust 2008 года было пожизненной наградой, а не конкурсной Griffin Poetry Prize.",
  },
  {
    key: "south_korea:park_kyung_ni",
    originalSha256: "25bf8e9d47e2d2a99ce4e813796df20a727ba5b6f21f24ab9f3178518b1405c8",
    reviewedTextRu: "Пак Кённи (1926–2008) — южнокорейская романистка. Главный её труд — многотомный роман-эпопея «Toji» («Земля»), над которым она работала с 1969 по 1994 год.",
    evidence: [
      e("Digital Library of Korean Literature, LTI Korea", "https://library.ltikorea.or.kr/writer/200092", "Литературная библиотека подтверждает годы жизни, профессию романистки и работу над многотомным Toji с 1969 по 1994 год."),
      e("KBS World", "https://rki.kbs.co.kr/service/contents_view.htm?board_seq=60168&lang=e", "Публичный вещатель независимо подтверждает биографию Пак Кённи и создание эпопеи Toji в течение примерно четверти века."),
    ],
    decision: "corrected",
    notes: "Оценочная формула «одно из важнейших произведений» заменена проверяемыми жанром, структурой и периодом работы над эпопеей.",
  },
  {
    key: "south_korea:park_min_gyu",
    originalSha256: "7cc3aad96f01b9cf4051af28648112e8981b9e1fe6e3151f2976185fd25643cf",
    reviewedTextRu: "Пак Мин Гю (род. 1968) — южнокорейский романист. Среди его книг — «The Sammi Superstars’ Last Fan Club», «Castella» и «Pavane for a Dead Princess».",
    evidence: [
      e("Digital Library of Korean Literature, LTI Korea", "https://library.ltikorea.or.kr/writer/200600", "Литературная библиотека подтверждает 1968 год рождения, профессию романиста и книги The Sammi Superstars’ Last Fan Club, Castella и Pavane for a Dead Princess."),
      e("Dalkey Archive Press", "https://dalkeyarchive.store/products/pavane-for-a-dead-princess", "Независимый издатель подтверждает авторство Пак Мин Гю и официальное английское название романа Pavane for a Dead Princess."),
    ],
    decision: "corrected",
    notes: "Оценочное описание стиля заменено произведениями. Неподтверждённые названия «Самурайские хроники», «Кафка в Корее» и «Смерть супергероя» в профиле заменены документированной библиографией.",
  },
  {
    key: "south_korea:park_wan_suh",
    originalSha256: "0cd0e36f81bcc618b9af5becaa4490b92b4417568d2508d2bd9b746e081320c5",
    reviewedTextRu: "Пак Вансо (1931–2011) — южнокорейская писательница, дебютировавшая романом «The Naked Tree» в 1970 году. Среди её автобиографических книг — «Who Ate Up All the Shinga?».",
    evidence: [
      e("Digital Library of Korean Literature, LTI Korea", "https://library.ltikorea.or.kr/writer/200093", "Литературная библиотека подтверждает годы 1931–2011, дебют The Naked Tree в 1970 году и автобиографический роман Who Ate Up All the Shinga?."),
      e("K-Book, Publication Industry Promotion Agency of Korea", "https://k-book.or.kr/home/eng/M015788298/library/authors/view.do?idx=cb00d1a0008a85e71a41b8741facbffee4db3f2d9d3ea683bf18fe8079f4d43e", "Государственный издательский портал независимо подтверждает биографию Пак Вансо и оба произведения."),
    ],
    decision: "corrected",
    notes: "Оценочная формула о значимости и обобщённая тематика заменены датированным дебютом и конкретным автобиографическим произведением; неоднозначные русские названия в профиле не менялись без каталожного сопоставления.",
  },
  {
    key: "south_korea:shin_kyung_sook",
    originalSha256: "971bd49909b6d39718646f981d39c69ea938d94be972b35907b059df3be49b25",
    reviewedTextRu: "Син Гён Сук (род. 1963) — южнокорейская писательница. Среди её романов — «Please Look After Mom», «The Girl Who Wrote Loneliness» и «The Court Dancer».",
    evidence: [
      e("Digital Library of Korean Literature, LTI Korea", "https://library.ltikorea.or.kr/writer/200532", "Литературная библиотека подтверждает 1963 год рождения, профессию романистки и книги Please Look After Mom, The Girl Who Wrote Loneliness и The Court Dancer."),
      e("Simon & Schuster", "https://www.simonandschuster.com/authors/Kyung-Sook-Shin/172158014", "Издательская биография независимо подтверждает литературную деятельность Син Гён Сук и её основные романы."),
    ],
    decision: "corrected",
    notes: "Оценочная известность и обобщённая тематика заменены проверяемой профессией и произведениями.",
  },
  {
    key: "south_korea:yi_kwangsu",
    originalSha256: "2905e9ffd7ff966b4cfb32ec472f26ab4aff7d91199ef9148c05f4bf7905cf1e",
    reviewedTextRu: "И Квансу (1892–1950) — корейский писатель и журналист, автор романа «The Heartless», одного из ранних произведений современной корейской прозы. Его общественная биография включает участие в движении за независимость и последующее сотрудничество с японскими колониальными властями.",
    evidence: [
      e("Digital Library of Korean Literature, LTI Korea", "https://library.ltikorea.or.kr/writer/200097", "Литературная библиотека подтверждает годы 1892–1950, рождение в Чонджу, роман The Heartless, участие в движении за независимость и позднейшее сотрудничество с японской властью."),
      e("Encyclopedia of Korean Culture, Academy of Korean Studies", "https://encykorea.aks.ac.kr/Article/E0043688", "Академическая энциклопедия независимо указывает Чонджу в Северном Пхёнане как место рождения, журналистскую и литературную работу, The Heartless и коллаборационистскую деятельность позднего периода."),
    ],
    decision: "corrected",
    notes: "Категорическое первенство романа заменено осторожной формулировкой; добавлена существенная и подтверждённая сложность политической биографии. Ошибочный Пхеньян в профиле заменён Чонджу.",
  },
];

export const writerBiographyFactReviewBatch49: readonly WriterBiographyFactReviewRecord[] = seeds.map(
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
