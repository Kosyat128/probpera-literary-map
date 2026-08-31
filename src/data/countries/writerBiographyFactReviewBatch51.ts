export const WRITER_BIOGRAPHY_FACT_REVIEW_BATCH51_REVIEWER =
  "Codex independent claim-by-claim factual review, batch 51";

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

const reviewer = WRITER_BIOGRAPHY_FACT_REVIEW_BATCH51_REVIEWER;
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
    key: "sri_lanka:ediriweera_sarachchandra",
    originalSha256: "ff825993bf61fa130a08e76752a215f3dc37469ac00f2569d999e496e7e958f6",
    reviewedTextRu: "Эдиривира Сараччандра (1914-1996) - шри-ланкийский драматург, романист и литературный критик, преподававший в Университете Цейлона в Перадении. Среди его пьес - «Maname» и «Sinhabahu».",
    evidence: [
      e("University of Peradeniya", "https://site.pdn.ac.lk/halls/EdiriweeraSarachchandraHall/", "Университет подтверждает годы 1914-1996, работу Сараччандры в Перадении и его роль драматурга, романиста и критика."),
      e("University of the Visual and Performing Arts, Sri Lanka", "https://vpa.ac.lk/wp-content/uploads/2021/05/JCDSKAR-20-Vol01-No-01.pdf", "Университетское издание рассматривает Сараччандру как ведущего сингальского драматурга и подтверждает пьесы Maname и Sinhabahu."),
    ],
    decision: "corrected",
    notes: "Оценочное утверждение о значимости заменено проверяемыми занятиями, университетской работой и названиями пьес.",
  },
  {
    key: "sri_lanka:martin_wickramasinghe",
    originalSha256: "cc3d268d10966b0f2093d3483a6818b56cda142cda6e49b1f90dc90961ef41ad",
    reviewedTextRu: "Мартин Викрамасингхе (1890-1976) - шри-ланкийский романист, автор рассказов и литературный критик. Среди его книг - «Gamperaliya», «Madol Doowa» и «Yuganthaya».",
    evidence: [
      e("Martin Wickramasinghe Trust", "https://martinwickramasinghe.com/", "Официальный фонд подтверждает годы жизни, литературные занятия Викрамасингхе и библиографию, включая Gamperaliya, Madol Doowa и Yuganthaya."),
      e("Ministry of Education, Sri Lanka", "https://www.e-thaksalawa.moe.gov.lk/moodle/pluginfile.php/395835/mod_resource/content/2/Binder1.pdf%20grade%2010.pdf", "Государственный учебный материал называет Викрамасингхе шри-ланкийским писателем и рассматривает его прозаические произведения."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование и широкое утверждение об основании прозы заменены документированными жанрами и произведениями.",
  },
  {
    key: "sri_lanka:michael_ondaatje",
    originalSha256: "5bdd0604a8c9ca27ad572e9631042af8366fdbaa288c794932d1693c672d91d6",
    reviewedTextRu: "Майкл Ондатже (род. 1943) - канадский писатель и поэт, родившийся в Коломбо на Цейлоне. Его роман «Английский пациент» получил Букеровскую премию в 1992 году.",
    evidence: [
      e("The Booker Prizes", "https://thebookerprizes.com/the-booker-library/authors/michael-ondaatje", "Официальный архив Букеровской премии подтверждает рождение в Коломбо в 1943 году и победу The English Patient в 1992 году."),
      e("University of Toronto", "https://alumni.utoronto.ca/news/featured-alumni/michael-ondaatje", "Университет называет Ондатже канадским писателем и поэтом, родившимся на Шри-Ланке, и подтверждает его связь с университетом."),
    ],
    decision: "corrected",
    notes: "Оценочное место в мировой литературе заменено гражданско-биографическим фактом и точно датированной премией.",
  },
  {
    key: "sri_lanka:romesh_gunesekera",
    originalSha256: "b641884ec884402d19a8e979daef0aecb8f456b7a9bea82c8e83af3cf3fc062a",
    reviewedTextRu: "Ромеш Гунесекера (род. 1954) - родившийся в Шри-Ланке британский романист и автор рассказов. Его роман «Reef» вошёл в короткий список Букеровской премии 1994 года.",
    evidence: [
      e("The Booker Prizes", "https://thebookerprizes.com/the-booker-library/authors/romesh-gunesekera", "Официальный архив подтверждает 1954 год рождения на Шри-Ланке, занятия романиста и попадание Reef в короткий список 1994 года."),
      e("South Asian Britain, University of Bristol", "https://southasianbritain.org/people/romesh-gunesekera/", "Университетский исследовательский проект подтверждает рождение Гунесекеры в Коломбо в 1954 году, переезд в Британию и его литературную деятельность."),
    ],
    decision: "corrected",
    notes: "Оценочная заметность заменена гражданско-биографической формулировкой и проверяемым результатом премии; искусственная дата 1 января сокращена до года.",
  },
  {
    key: "sri_lanka:shobasakthi",
    originalSha256: "a5728a3cd9ca82f5cd44fcdd50f34af68496d1fbd247765f83e5bcf61b1b1e48",
    reviewedTextRu: "Шобашакти - псевдоним родившегося в Шри-Ланке в 1967 году тамильского писателя Антонитасана Джесутасана. Он написал романы «Gorilla» и «Traitor».",
    evidence: [
      e("Musée national des arts asiatiques - Guimet", "https://www.guimet.fr/sites/default/files/2026-06/cp_9e-prix_emile-guimet-de-litterature-asiatique.pdf", "Материал национального музея идентифицирует Шобашакти как Антонитасана Джесутасана, родившегося на Шри-Ланке в 1967 году, и называет его писателем."),
      e("University of Alberta - Canadian Review of Comparative Literature", "https://journals.library.ualberta.ca/crcl/index.php/crcl/article/download/29970/21629", "Академическая статья независимо связывает псевдоним Shobasakthi с Antonythasan Jesuthasan и рассматривает романы Gorilla и Traitor."),
    ],
    decision: "corrected",
    notes: "Установлено настоящее имя; неверные 1964 год и искусственная дата 1 января исправлены на подтверждённый 1967 год.",
  },
  {
    key: "sudan:abdelaziz_baraka_sakin",
    originalSha256: "51905ad15571fe340c91cdcd4216f8d35dc3a43a88aedbe8995fb555f8f101e9",
    reviewedTextRu: "Абдельазиз Барака Сакин (род. 1963) - суданский романист и автор рассказов, родившийся в Кассале. Среди его книг - «The Jungo» и «The Messiah of Darfur».",
    evidence: [
      e("University of Notre Dame", "https://litofexile.nd.edu/events/2022/11/18/to-exorcise-the-fear-of-war-abdelaziz-baraka-sakin-in-conversation-with-sinan-antoon/", "Университетская программа подтверждает рождение Сакина в Кассале в 1963 году и называет The Jungo и The Messiah of Darfur."),
      e("Institut du monde arabe", "https://www.imarabe.org/fr/agenda/litterature-et-poesie/heure-avec-abdelaziz-baraka-sakin-en-direct-sur-facebook", "Государственный институт представляет Абдельазиза Барака Сакина как суданского романиста и автора рассказов и подтверждает его основные книги."),
    ],
    decision: "corrected",
    notes: "Общая формулировка заменена подтверждёнными местом и годом рождения, жанрами и произведениями; исправлена русская передача имени.",
  },
  {
    key: "sudan:al_saddiq_al_raddi",
    originalSha256: "be068de793e9631f57765d783f7e933659684dac7fa19154754ad33b9cbeef38",
    reviewedTextRu: "Аль-Саддик аль-Радди (род. 1969) - суданский поэт, пишущий на арабском языке. Среди его сборников - «Songs of Solitude» и «The Sultan's Labyrinth».",
    evidence: [
      e("Poetry Translation Centre", "https://www.poetrytranslation.org/poet/al-saddiq-al-raddi/", "Литературная некоммерческая организация подтверждает 1969 год рождения в Судане, арабский язык и сборники поэта."),
      e("British Council Sudan", "https://sudan.britishcouncil.org/en/poetry-preservation-exploring-east-african-narratives", "Официальная программа Британского совета независимо включает Аль-Саддика аль-Радди в круг суданских и восточноафриканских поэтов, чьи тексты используются в образовательном проекте о поэзии."),
    ],
    decision: "corrected",
    notes: "Субъективная заметность заменена языком, жанром и документированными названиями сборников.",
  },
  {
    key: "sudan:hammour_ziada",
    originalSha256: "7e5b024ecb2174aa5a0cd5b3d3cd13ffaf92c41e7afa312cab9bb70cf6a60c09",
    reviewedTextRu: "Хаммур Зияда (род. 1977) - суданский романист и журналист. Его роман «The Longing of the Dervish» получил медаль Нагиба Махфуза в 2014 году и вошёл в короткий список Международной премии арабской прозы.",
    evidence: [
      e("American University in Cairo Press", "https://aucpress.com/author/hammour-ziada/", "Университетское издательство подтверждает 1977 год рождения, занятия журналиста и романиста и медаль Нагиба Махфуза за The Longing of the Dervish."),
      e("International Prize for Arabic Fiction", "https://archive.arabicfiction.org/ar/Hammour-Ziada-nadwa2016", "Официальный архив премии подтверждает суданское происхождение, 1977 год рождения и попадание романа в короткий список; указан Хартум, что расходится с Umm Durman у AUC Press."),
    ],
    decision: "corrected",
    notes: "Добавлены проверяемые произведение и премиальные факты; место рождения очищено, поскольку авторитетные источники расходятся между Хартумом и Омдурманом.",
  },
  {
    key: "sudan:mohammed_al_fayturi",
    originalSha256: "b8e8976c3cc85dd7a5b92897f8a2888f9560d9815f554cab3fd450326bb77e6a",
    reviewedTextRu: "Мухаммед аль-Фейтури - суданский поэт, писавший на арабском языке и умерший в 2015 году. К его сборникам относятся «Песни Африки» и «Вспомни меня, Африка».",
    evidence: [
      e("Al Arabi, National Council for Culture, Arts and Letters of Kuwait", "https://alarabi.nccal.gov.kw/Home/Article/19193", "Государственный культурный журнал называет аль-Фейтури суданским арабоязычным поэтом, приводит 1936-2015 годы и перечисляет африканские сборники."),
      e("Université d'Alger 2 - ASJP", "https://asjp.cerist.dz/en/downArticle/20/18/1/286668", "Академическая публикация независимо подтверждает суданского поэта, арабский язык, годы 1936-2015 и африканскую тематику его книг."),
      e("Al Arabi, National Council for Culture, Arts and Letters of Kuwait", "https://alarabi.nccal.gov.kw/Home/Article/17027", "Другая публикация того же государственного журнала указывает 1930 год рождения и смерть 24 апреля 2015 года; это фиксирует неразрешённое расхождение с 1936 годом."),
    ],
    decision: "corrected",
    notes: "Оценочное ранжирование заменено произведениями; точная дата рождения и диапазон лет очищены, поскольку институциональные источники расходятся между 1930 и 1936 годами.",
  },
  {
    key: "sudan:taj_el_sir",
    originalSha256: "66f6dd3e40e010824e81acf9d17d6d8efda33cf9664209ea3b1ee8753f0e1248",
    reviewedTextRu: "Амир Тадж ас-Сир (род. 1960) - суданский романист и врач. Его роман «Охотник за личинками» вошёл в короткий список Международной премии арабской прозы 2011 года.",
    evidence: [
      e("International Prize for Arabic Fiction", "https://archive.arabicfiction.org/ar/amir-tag-elsir", "Официальный архив подтверждает имя Amir Tag Elsir, рождение в Судане в 1960 году, работу врачом и романистом, а также короткий список The Grub Hunter."),
      e("University of Rochester - Three Percent", "https://www.rochester.edu/College/translation/threepercent/2010/12/09/2011-arab-booker-shortlist/", "Университетский литературный проект независимо подтверждает суданского автора Amir Taj Al-Sir и участие Hunter of Chrysalises в коротком списке 2011 года."),
    ],
    decision: "corrected",
    notes: "Карточка идентифицирована как профиль Amir Taj al-Sir: исправлены имя и год рождения 1965→1960; неподтверждённое произведение «Реки и деревья» не перенесено.",
  },
  {
    key: "sudan:tayeb_salih",
    originalSha256: "62aef2fa76557c8de2a22798d950abc2d81e6dcc582486abb91050489f8538c6",
    reviewedTextRu: "Ат-Тайиб Салих (1929-2009) - суданский романист, автор романа «Сезон миграции на Север» и рассказа «The Doum Tree of Wad Hamid». Он также работал в Би-би-си и ЮНЕСКО.",
    evidence: [
      e("Loyola University Maryland", "https://www.loyola.edu/department/language-learning-center/resources/black-history-month.html", "Университет подтверждает годы 1929-2009, суданское происхождение и Season of Migration to the North; местом рождения назван Кармаколь."),
      e("University of Texas at Austin", "https://www.laits.utexas.edu/doherty/salih.html", "Университетский ресурс независимо приводит годы жизни и работу в BBC и UNESCO, но местом рождения называет Мерави, что не позволяет сохранить Кармаколь как бесспорное поле профиля."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование заменено произведениями и местами работы; точный день рождения сокращён до года, а место рождения очищено из-за расхождения Кармаколь/Мерави в университетских источниках.",
  },
  {
    key: "suriname:albert_helman",
    originalSha256: "0b8b1862d7682f74701eb757cf66dad3ff0b0eaf0681ec5e471a4e13cd10e4de",
    reviewedTextRu: "Альберт Хелман - псевдоним суринамского писателя Лу Лихтвелда (1903-1996), который также работал журналистом, композитором и политиком. Его первый роман вышел в 1926 году.",
    evidence: [
      e("Digitale Bibliotheek voor de Nederlandse Letteren", "https://www.dbnl.org/tekst/_oso001199601_01/_oso001199601_01_0021.php", "Академическая цифровая библиотека подтверждает псевдоним Альберт Хелман, настоящее имя Lou Lichtveld, годы 1903-1996 и его разносторонние занятия."),
      e("Literatuurmuseum", "https://literatuurmuseum.nl/nl/ontdek-online/literatuurlab/online-exposities/schrijversgalerij/schrijvers/albert-helman/albert-helman", "Национальный литературный музей подтверждает суринамское происхождение, псевдоним, годы жизни и выход первого романа в 1926 году."),
    ],
    decision: "corrected",
    notes: "Оценочные и интерпретационные утверждения заменены настоящим именем, занятиями и датой дебютного романа.",
  },
  {
    key: "suriname:cynthia_mccleod",
    originalSha256: "07100acd622e536f2ad53f91f1378452130cd0a1841c230586a5477771b9a495",
    reviewedTextRu: "Синтия Маклауд (род. 1936) - суринамская писательница и исследовательница истории рабства и колониального Суринама. Её дебютный исторический роман «Hoe duur was de suiker?» вышел в 1987 году.",
    evidence: [
      e("Digitale Bibliotheek voor de Nederlandse Letteren", "https://www.dbnl.org/tekst/bork001schr01_01/bork001schr01_01_0739.php", "Академическая цифровая библиотека подтверждает рождение 4 октября 1936 года в Парамарибо, литературную деятельность и дебют Hoe duur was de suiker? в 1987 году."),
      e("Elisabeth Samson House Foundation", "https://www.elisabethsamsonhuis.org/over-de-stichting/", "Официальный фонд документирует исторические исследования Синтии Маклауд о рабстве и колониальном Суринаме и её литературную работу."),
    ],
    decision: "corrected",
    notes: "Субъективная известность заменена направлением исследований и датированным дебютным романом; русская передача фамилии уточнена в тексте.",
  },
  {
    key: "suriname:dobru",
    originalSha256: "50e33697fc1da6b9d870a01b21a8cd7654b939b7a54a4ebe136068fac45cbed1",
    reviewedTextRu: "Добру - псевдоним суринамского поэта и общественного деятеля Робина Эвалда Равелеса (1935-1983). Он писал на сранан-тонго и нидерландском и создал стихотворение «Wan Bon».",
    evidence: [
      e("Literatuurmuseum", "https://literatuurmuseum.nl/nl/ontdek-online/literatuurlab/online-exposities/surinaamse-schrijvers/de-weg-naar-een-onafhankelijke-literatuur", "Национальный литературный музей идентифицирует Добру как Робина Равелеса, суринамского поэта и общественного деятеля, и связывает его с Wan Bon."),
      e("Digitale Bibliotheek voor de Nederlandse Letteren", "https://www.dbnl.org/arch/kris001leze10_01/pag/kris001leze10_01.pdf", "Академический учебный материал подтверждает годы 1935-1983, псевдоним Dobru, имя Robin Ewald Raveles и использование сранан-тонго и нидерландского."),
    ],
    decision: "corrected",
    notes: "Субъективная значимость заменена именем, языками и произведением; ошибочные точные даты сокращены до подтверждённых годов.",
  },
  {
    key: "sweden:astrid_lindgren",
    originalSha256: "456da1305a2437d87ac3d4bc21083f65448de0bc4a093516881bd0884293e1c0",
    reviewedTextRu: "Астрид Линдгрен (1907-2002) - шведская писательница, автор книг для детей. Среди её произведений - «Пеппи Длинныйчулок», «Мио, мой Мио» и «Братья Львиное Сердце».",
    evidence: [
      e("Astrid Lindgren Company", "https://www.astridlindgren.com/gb/about-astrid-lindgren/milestones", "Официальный правообладатель подтверждает годы жизни Линдгрен, её литературную работу и хронологию книг, включая Pippi Longstocking и Mio, My Son."),
      e("Nationalmuseum Sweden", "https://collection.nationalmuseum.se/sv/artists/artist/6660/", "Шведский национальный музей подтверждает даты 14 ноября 1907 - 28 января 2002 и идентифицирует Линдгрен как шведскую писательницу."),
    ],
    decision: "corrected",
    notes: "Рекламная формулировка «всемирно известная» заменена датами и конкретными произведениями.",
  },
  {
    key: "sweden:august_strindberg",
    originalSha256: "25fe8ebf92f327c40d531c6d4d35d00cacf470e1c14f2a9e9e3e35fc0675a872",
    reviewedTextRu: "Август Стриндберг (1849-1912) - шведский писатель и драматург, также работавший в живописи, фотографии и театре. Среди его пьес - «Фрёкен Жюли» и «Игра снов».",
    evidence: [
      e("Svenskt Biografiskt Lexikon, Riksarkivet", "https://sok.riksarkivet.se/sbl/Presentation.aspx?forceOrdinarySite=true&id=34518", "Национальный биографический словарь подтверждает даты, занятия писателя и драматурга, художественные опыты и основные произведения Стриндберга."),
      e("Swedish Academy", "https://www.svenskaakademien.se/press/strindberg-175", "Шведская академия подтверждает годы 1849-1912 и литературное наследие Стриндберга, включая его драматургию."),
    ],
    decision: "corrected",
    notes: "Непроверяемые слова «великий» и «один из основателей» заменены документированными видами деятельности и пьесами.",
  },
  {
    key: "sweden:carl_michael_bellman",
    originalSha256: "38a778ac0cae02512d6596061c26ddcf5274134ea18b8c98545b2d9ab4e1ee54",
    reviewedTextRu: "Карл Микаэль Бельман (1740-1795) - шведский поэт, певец и автор песен. Два его цикла озаглавлены «Послания Фредмана» и «Песни Фредмана».",
    evidence: [
      e("Svenskt Biografiskt Lexikon, Riksarkivet", "https://sok.riksarkivet.se/sbl/Presentation.aspx?id=18441", "Национальный биографический словарь подтверждает даты 1740-1795, занятия поэта и певца и циклы Fredmans epistlar и Fredmans sånger."),
      e("Litteraturbanken", "https://litteraturbanken.se/ljudochbild/forfattare/bellmancm/", "Шведская академическая литературная библиотека независимо представляет Бельмана как поэта и автора песен и документирует его произведения."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование заменено занятиями и названиями двух циклов; имя приведено к принятой передаче в проверенном тексте.",
  },
  {
    key: "sweden:erik_axel_karlfeldt",
    originalSha256: "d9813bf3747076174ca89f073d5a69c636722824165023077586b4377615c337",
    reviewedTextRu: "Эрик Аксель Карлфельдт (1864-1931) - шведский поэт и многолетний постоянный секретарь Шведской академии. Нобелевская премия по литературе 1931 года была присуждена ему посмертно.",
    evidence: [
      e("Nobel Prize", "https://www.nobelprize.org/prizes/literature/1931/karlfeldt/facts/", "Официальный Нобелевский архив подтверждает даты, шведское гражданство, занятие поэта и посмертное присуждение премии 1931 года."),
      e("Swedish Academy", "https://www.svenskaakademien.se/svenska-akademien/de-aderton/stol-nr-11-erik-axel-karlfeldt", "Шведская академия подтверждает членство Карлфельдта и его работу постоянным секретарём в 1913-1931 годах."),
    ],
    decision: "corrected",
    notes: "Интерпретационные характеристики поэзии заменены должностью и проверяемым особым статусом Нобелевской премии.",
  },
  {
    key: "sweden:esaias_tegner",
    originalSha256: "a4b56bd9ef23b434401076193f495bc7ba30ad0c7c7db39028fdce3d8daaeaa3",
    reviewedTextRu: "Эсайас Тегнер (1782-1846) - шведский поэт, профессор Лундского университета и епископ Векшё. Его цикл «Сага о Фритьофе» вышел в 1825 году.",
    evidence: [
      e("Litteraturbanken", "https://litteraturbanken.se/ljudochbild/forfattare/tegnere/", "Литературная библиотека подтверждает годы жизни, профессорскую и епископскую деятельность Тегнера и публикацию Frithiofs saga в 1825 году."),
      e("Swedish Academy", "https://www.svenskaakademien.se/svenska-akademien/ledamotsregister/esaias-tegn%C3%A9r", "Шведская академия указывает рождение в Kyrkerud в приходе By, годы 1782-1846, избрание в Академию и литературную деятельность."),
    ],
    decision: "corrected",
    notes: "Широкая классификация «эпохи романтизма» заменена должностями и датированным произведением; место рождения уточнено с ошибочного Кюркхульта на Кюркеруд.",
  },
  {
    key: "sweden:eyvind_johnson",
    originalSha256: "464c1755efed3cb24a24f31cdc0f97b8ddba3660f10a80cefb1fd715bc57a555",
    reviewedTextRu: "Эйвинд Юнсон (1900-1976) - шведский романист и автор рассказов. Он разделил Нобелевскую премию по литературе 1974 года с Харри Мартинсоном; среди его книг - цикл «Romanen om Olof».",
    evidence: [
      e("Nobel Prize", "https://www.nobelprize.org/prizes/literature/1974/johnson/facts/", "Официальный Нобелевский архив подтверждает даты Юнсона, занятие писателя, премию 1974 года и основные произведения."),
      e("Swedish Academy", "https://www.svenskaakademien.se/svenska-akademien/akademiens-arkiv/digitala-utstallningar/johnson-martinsonutstallning/eyvind-johnson", "Цифровая выставка Академии документирует биографию Юнсона, цикл Romanen om Olof и совместное присуждение премии с Мартинсоном."),
    ],
    decision: "corrected",
    notes: "Объёмный интерпретационный текст сокращён до проверяемых жанров, произведения и совместного присуждения премии.",
  },
  {
    key: "sweden:gunnar_ekelof",
    originalSha256: "68b503d68f225027ac2d6c3ba43bf7681a1ee55012207750cb1a8d6bfe3df071",
    reviewedTextRu: "Гуннар Экелёф (1907-1968) - шведский поэт, переводчик и литературный критик. Его дебютный сборник «sent på jorden» вышел в 1932 году.",
    evidence: [
      e("Litteraturbanken", "https://litteraturbanken.se/%C3%B6vers%C3%A4ttarlexikon/artiklar/Gunnar_Ekel%C3%B6f", "Шведская академическая литературная библиотека подтверждает годы 1907-1968, занятия поэта, переводчика и критика и дебют sent på jorden в 1932 году."),
      e("Swedish Academy", "https://www.svenskaakademien.se/press/gunnar-ekelof-samlade-dikter-i-iv", "Шведская академия подтверждает годы жизни Экелёфа и документирует корпус его поэзии в академическом собрании сочинений."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование заменено видами деятельности и датой дебютного сборника; русская передача фамилии уточнена.",
  },
  {
    key: "sweden:harry_martinson",
    originalSha256: "c1ea1b5f8a6f6690f58462ab9b8e1d6e62edf3703ffe09536d2283c5883bb064",
    reviewedTextRu: "Харри Мартинсон (1904-1978) - шведский поэт и прозаик, в юности работавший моряком. Он написал поэму «Aniara» и в 1974 году разделил Нобелевскую премию по литературе с Эйвиндом Юнсоном.",
    evidence: [
      e("Nobel Prize", "https://www.nobelprize.org/prizes/literature/1974/martinson/facts/", "Официальный архив подтверждает даты, занятия поэта и романиста, морскую работу в молодости, Aniara и премию 1974 года."),
      e("Swedish Academy", "https://www.svenskaakademien.se/svenska-akademien/akademiens-arkiv/digitala-utstallningar/johnson-martinsonutstallning/harry-martinson", "Выставка Академии независимо документирует биографию Мартинсона, поэму Aniara и совместное награждение с Юнсоном."),
    ],
    decision: "corrected",
    notes: "Интерпретация поэмы заменена биографическим фактом, авторством и точной формой совместного присуждения премии.",
  },
  {
    key: "sweden:henning_mankell",
    originalSha256: "1d879982b8206b044aa1c8c5a89d801e696190dd6113ca4b70cd151d5284aa70",
    reviewedTextRu: "Хеннинг Манкелль (1948-2015) - шведский писатель и драматург. Он написал цикл детективных книг о комиссаре Курте Валландере.",
    evidence: [
      e("Swedish Film Institute", "https://www.filminstitutet.se/sv/nyheter/2015/mankell/", "Шведский институт кино подтверждает годы 1948-2015, занятия писателя и драматурга и экранизации книг о Валландере."),
      e("African Studies Centre Leiden", "https://www.ascleiden.nl/news/henning-mankell-1948-2015-africa", "Университетский исследовательский центр независимо подтверждает годы жизни и литературно-театральную деятельность Манкелля, включая цикл о Валландере."),
    ],
    decision: "corrected",
    notes: "Формулировка уточнена датами и жанром цикла; русское написание фамилии приведено к принятому варианту.",
  },
  {
    key: "sweden:hjalmar_soderberg",
    originalSha256: "00dceb147bddd877bfe93fe98b05121e592d8140756d3ea34551047042e9dc0d",
    reviewedTextRu: "Яльмар Сёдерберг (1869-1941) - шведский романист, драматург, критик и переводчик. Среди его книг - «Доктор Глас» и «Серьёзная игра».",
    evidence: [
      e("Svenskt Biografiskt Lexikon, Riksarkivet", "https://sok.riksarkivet.se/sbl/artikel/35168", "Национальный биографический словарь подтверждает годы 1869-1941 и занятия Сёдерберга как писателя, драматурга и критика, а также его основные романы."),
      e("Litteraturbanken", "https://litteraturbanken.se/%C3%B6vers%C3%A4ttarlexikon/artiklar/Hjalmar_S%C3%B6derberg", "Академическая литературная библиотека независимо подтверждает даты, работу критика и переводчика и библиографию Сёдерберга."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование заменено занятиями и произведениями; исправлена русская передача имени.",
  },
  {
    key: "sweden:kerstin_ekman",
    originalSha256: "e1ac9b21d67e6c776ca2977bbc68f587f9f17202c5e31559fe9af408a7afaa49",
    reviewedTextRu: "Керстин Экман (род. 1933) - шведская писательница, дебютировавшая в 1959 году с детективным романом. Её роман «События у воды» получил Литературную премию Северного совета в 1994 году.",
    evidence: [
      e("Nordic Council", "https://www.norden.org/en/nominee/1994-kerstin-ekman-sweden-handelser-vid-vatten", "Официальная страница Совета подтверждает шведское авторство и премию 1994 года за Händelser vid vatten."),
      e("Swedish Arts Council", "https://www.kulturradet.se/globalassets/start/swedish-literature-exchange/swedish-bookshelf/swedish-contemporary-fiction/swedish-contemporary-fiction-2022_tg.pdf", "Государственный литературный обзор подтверждает 1933 год рождения, дебют Экман в 1959 году как автора детективов и её последующую романную прозу."),
      e("Albert Bonniers Förlag", "https://www.albertbonniersforlag.se/forfattare/5378/kerstin-ekman/", "Официальное издательство указывает, что Экман родилась в 1933 году в Рисинге, Эстергётланд, и дебютировала как автор детективов в 1959 году."),
    ],
    decision: "corrected",
    notes: "Общая характеристика заменена датированным дебютом и премией; ошибочное место рождения Фалун исправлено на подтверждённое Рисинге.",
  },
  {
    key: "sweden:lars_kepler",
    originalSha256: "fc1b2a4cd30087fcee2777fb03ad48e3045eb52abd6ffe71855a0e8572c156f9",
    reviewedTextRu: "Ларс Кеплер - общий псевдоним шведских писателей Александры Коэлью Андориль и Александера Андориля. Их первый совместный роман под этим именем - «Гипнотизёр», опубликованный в 2009 году.",
    evidence: [
      e("Lars Kepler official site", "https://larskepler.com/about/", "Официальная биография подтверждает, что Lars Kepler - псевдоним Александры Коэлью Андориль и Александера Андориля, и описывает создание The Hypnotist."),
      e("Albert Bonniers Förlag", "https://www.albertbonniersforlag.se/forfattare/5350/alexandra-coelho-ahndoril/", "Шведское издательство независимо подтверждает, что Александра Коэлью Андориль пишет триллеры вместе с Александером Андорилем под псевдонимом Lars Kepler."),
    ],
    decision: "corrected",
    notes: "Факт исходного текста сохранён, но уточнены транслитерация имён и год публикации первого совместного романа.",
  },
  {
    key: "sweden:nelly_sachs",
    originalSha256: "8edbb17743697ed8c978332ac593e9c489671039dc7bb681b653c0f7bd890a16",
    reviewedTextRu: "Нелли Закс (1891-1970) - немецкоязычная поэтесса и драматург, бежавшая из нацистской Германии в Швецию в 1940 году. В 1966 году она разделила Нобелевскую премию по литературе с Шмуэлем Йосефом Агноном.",
    evidence: [
      e("Nobel Prize", "https://www.nobelprize.org/prizes/literature/1966/sachs/facts/", "Официальный Нобелевский архив подтверждает даты, немецко-шведскую биографию Закс, бегство в 1940 году и разделённую премию 1966 года."),
      e("Swedish Academy", "https://www.svenskaakademien.se/svenska-akademien/sammankomster/hogtidssammankomsten/2010/direktorstalet", "Шведская академия независимо документирует приезд Нелли Закс в Швецию и её место в истории Нобелевской премии."),
    ],
    decision: "corrected",
    notes: "Исходные факты сохранены в более точной форме с годом бегства и указанием второго лауреата; имя сокращено до принятого русского варианта.",
  },
  {
    key: "sweden:par_lagerkvist",
    originalSha256: "3968282dd1822815b2f2fe5d474b6f529682cc6677ac0bac2cfaa42986aea843",
    reviewedTextRu: "Пер Фабиан Лагерквист (1891-1974) - шведский поэт, драматург и прозаик. В 1951 году он получил Нобелевскую премию по литературе; среди его романов - «Карлик» и «Варавва».",
    evidence: [
      e("Nobel Prize", "https://www.nobelprize.org/prizes/literature/1951/lagerkvist/facts/", "Официальный архив подтверждает даты, полное имя Pär Fabian Lagerkvist, литературные занятия, премию 1951 года и романы The Dwarf и Barabbas."),
      e("Swedish Academy", "https://www.svenskaakademien.se/nobelpriset/nobelpristagare-i-litteratur?gsid=68d0ea7e-e4d8-4dcf-b2c9-39b63b4b73ca", "Шведская академия независимо включает Пера Лагерквиста в официальный перечень лауреатов за 1951 год."),
    ],
    decision: "corrected",
    notes: "Краткая исходная справка дополнена проверяемыми жанрами, полным именем и двумя произведениями.",
  },
  {
    key: "sweden:selma_lagerlof",
    originalSha256: "c48594d15ae3ea233d171cfb3373adf5b3ce5e7f84713395ae436a0bebb211f8",
    reviewedTextRu: "Сельма Лагерлёф (1858-1940) - шведская писательница, автор «Саги о Йёсте Берлинге» и «Чудесного путешествия Нильса». В 1909 году она стала первой женщиной - лауреатом Нобелевской премии по литературе.",
    evidence: [
      e("Nobel Prize", "https://www.nobelprize.org/prizes/literature/1909/lagerlof/facts/", "Официальный архив подтверждает даты, шведское гражданство, премию 1909 года и статус первой женщины-лауреата, а также основные книги."),
      e("Litteraturbanken", "https://litteraturbanken.se/skolan/alla-prosaforfattare/", "Шведская академическая литературная библиотека независимо документирует биографию Лагерлёф и произведения Gösta Berlings saga и Nils Holgerssons underbara resa."),
    ],
    decision: "corrected",
    notes: "Верный исходный факт дополнен датами и двумя произведениями без оценочных формулировок.",
  },
  {
    key: "sweden:stieg_larsson",
    originalSha256: "c1bacfa8cc2583839047bf8e51ea302b160027d1c7870f9ce18cdc190b438a70",
    reviewedTextRu: "Стиг Ларссон (1954-2004) - шведский журналист и писатель. Он написал три романа цикла «Миллениум»; первый из них по-шведски называется «Män som hatar kvinnor».",
    evidence: [
      e("Stieg Larsson Foundation", "https://www.stieglarssonfoundation.se/who-was-stieg-larsson/who-was-stieg-larsson/", "Официальный фонд подтверждает даты 15 августа 1954 - 9 ноября 2004, журналистскую работу и три завершённых романа Millennium."),
      e("LIBRIS, National Library of Sweden", "https://libris.kb.se/bib/18267333", "Национальный библиотечный каталог подтверждает авторство Ларссона и шведское заглавие первого романа Män som hatar kvinnor."),
    ],
    decision: "corrected",
    notes: "Добавлены отсутствовавшие даты и уточнено, что популярное русское название первого романа не является буквальным переводом шведского заглавия.",
  },
  {
    key: "sweden:tomas_transtromer",
    originalSha256: "22a7a5b1e2a4d23933dd6eda9c29061a21952c98146083b667b54be6b3fd2b43",
    reviewedTextRu: "Тумас Транстрёмер (1931-2015) - шведский поэт и психолог, автор сборника «17 стихотворений». Он получил Нобелевскую премию по литературе в 2011 году.",
    evidence: [
      e("Nobel Prize", "https://www.nobelprize.org/prizes/literature/2011/transtromer/facts/", "Официальный архив подтверждает даты, занятия поэта и психолога, сборник 17 Poems и премию 2011 года."),
      e("Nordic Council", "https://www.norden.org/sv/nominee/1990-tomas-transtromer-sverige-levande-och-doda", "Официальный ресурс Северного совета независимо подтверждает шведскую поэтическую деятельность Транстрёмера и его библиографию."),
    ],
    decision: "corrected",
    notes: "Исходное описание приведено к нейтральной форме с профессией, дебютным сборником и точным годом премии.",
  },
  {
    key: "sweden:verner_von_heidenstam",
    originalSha256: "0ff2e8f03e32c1009322456c297db5fde27d30619a53ecfba9490c75952659ca",
    reviewedTextRu: "Вернер фон Хейденстам (1859-1940) - шведский поэт и прозаик, автор сборника «Паломничество и годы странствий» и цикла «Каролинцы». В 1916 году он получил Нобелевскую премию по литературе.",
    evidence: [
      e("Nobel Prize", "https://www.nobelprize.org/prizes/literature/1916/heidenstam/facts/", "Официальный архив подтверждает даты, занятие поэта и премию 1916 года, а также основные произведения Хейденстама."),
      e("Swedish Academy", "https://www.svenskaakademien.se/svenska-akademien/de-aderton/stol-nr-8-verner-von-heidenstam", "Шведская академия независимо подтверждает литературную деятельность, членство и библиографию Вернера фон Хейденстама."),
    ],
    decision: "corrected",
    notes: "Интерпретация национального неоромантизма заменена произведениями и премией; в тексте использована краткая общеупотребительная форма имени.",
  },
  {
    key: "switzerland:carl_spitteler",
    originalSha256: "e98f81166ca29eb74850601b3eddaebc6836a684f520554eb269c81356fd193b",
    reviewedTextRu: "Карл Шпиттелер (1845-1924) - швейцарский поэт, прозаик и журналист, писавший по-немецки. Нобелевская премия 1919 года была присуждена ему с особым упоминанием эпоса «Олимпийская весна».",
    evidence: [
      e("Nobel Prize", "https://www.nobelprize.org/prizes/literature/1919/spitteler/facts/", "Официальный архив подтверждает даты, швейцарское гражданство, литературные занятия, премию и упоминание Olympian Spring в мотивации."),
      e("Swiss National Library", "https://www.nb.admin.ch/en/carl-spitteler-in-the-sla", "Швейцарская национальная библиотека подтверждает немецкоязычное творчество Шпиттелера, годы жизни и хранение его литературного архива."),
    ],
    decision: "corrected",
    notes: "Интерпретационные оценки мифологических произведений заменены языком, занятиями и точной премиальной формулировкой.",
  },
  {
    key: "switzerland:conrad_ferdinand_meyer",
    originalSha256: "947a400a5ce05d617a181ecb5a524ed058d7f8ea9822482cd769c53fcecf1269",
    reviewedTextRu: "Конрад Фердинанд Майер (1825-1898) - швейцарский поэт и прозаик, родившийся в Цюрихе. Он писал исторические новеллы и создал роман «Юрг Енач».",
    evidence: [
      e("Deutsche Biographie", "https://www.deutsche-biographie.de/gnd118581775.html", "Академическая национальная биографическая база подтверждает даты, рождение в Цюрихе, швейцарскую принадлежность и литературные занятия Майера."),
      e("Zentralbibliothek Zürich", "https://zop.zb.uzh.ch/items/774e42fd-68f9-4944-95b4-66ceb54a98a4", "Цюрихская центральная библиотека документирует автора, его историческую прозу и роман Jürg Jenatsch."),
    ],
    decision: "corrected",
    notes: "Краткое исходное описание дополнено датами, местом рождения, жанром и конкретным романом.",
  },
  {
    key: "switzerland:friedrich_durrenmatt",
    originalSha256: "5e8020055237e1cbffdad05aa3d72b3eaf3891c8302ae3b393542c7d65b01124",
    reviewedTextRu: "Фридрих Дюрренматт (1921-1990) - швейцарский драматург, прозаик и художник. Он написал пьесы «Визит старой дамы» и «Физики».",
    evidence: [
      e("Centre Dürrenmatt Neuchâtel", "https://www.cdn.ch/de/biografie", "Официальный музейный центр подтверждает даты, занятия писателя и художника и хронологию пьес Der Besuch der alten Dame и Die Physiker."),
      e("Swiss National Library - Swiss Literary Archives", "https://ead.nb.admin.ch/html/fd_0.html", "Швейцарский литературный архив независимо подтверждает биографические даты, драматургию, прозу и художественное наследие Дюрренматта."),
    ],
    decision: "corrected",
    notes: "Расплывчатая характеристика «интеллектуальная проза» заменена видами деятельности и двумя пьесами.",
  },
  {
    key: "switzerland:gottfried_keller",
    originalSha256: "1f0587fa365c301d11352947ce38df9fcc7091b694a3afb33a5aff41b9c89344",
    reviewedTextRu: "Готфрид Келлер (1819-1890) - швейцарский писатель и поэт, занимавший должность государственного секретаря кантона Цюрих. Среди его произведений - роман «Зелёный Генрих» и цикл «Люди из Зельдвилы».",
    evidence: [
      e("Zentralbibliothek Zürich", "https://www.zb.uzh.ch/en/zuerich/gottfried-keller-bibliographie", "Цюрихская центральная библиотека подтверждает годы жизни и библиографию Келлера, включая Der grüne Heinrich и Die Leute von Seldwyla."),
      e("University of Zurich", "https://www.news.uzh.ch/en/articles/2019/Keller.html", "Университет Цюриха независимо подтверждает литературную деятельность Келлера и его службу первым государственным секретарём кантона."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование заменено должностью и конкретными произведениями.",
  },
  {
    key: "switzerland:hermann_hesse",
    originalSha256: "276613d5efcbf27b0c413506348fd5e54426fe4596765038e127426f87b7ff82",
    reviewedTextRu: "Герман Гессе (1877-1962) - немецкоязычный писатель, живший в Швейцарии и получивший Нобелевскую премию по литературе в 1946 году. Среди его романов - «Степной волк», «Сиддхартха» и «Игра в бисер».",
    evidence: [
      e("Nobel Prize", "https://www.nobelprize.org/prizes/literature/1946/hesse/facts/", "Официальный архив подтверждает даты, немецкое место рождения, швейцарскую связь, премию 1946 года и основные романы Гессе."),
      e("Museo Hermann Hesse Montagnola", "https://www.en.hessemontagnola.ch/1931-1962", "Официальный музей документирует жизнь Гессе в Монтаньоле, его швейцарский период и публикацию Das Glasperlenspiel."),
    ],
    decision: "corrected",
    notes: "Исходная справка уточнена языком, местом жизни и тремя документированными романами без упрощения сложной гражданской биографии.",
  },
  {
    key: "switzerland:johann_kaspar_lavater",
    originalSha256: "4f53825928b1a8cb426a57a601c14071f87c0d33eda38bcbf1500043a6eadac1",
    reviewedTextRu: "Иоганн Каспар Лафатер (1741-1801) - швейцарский реформатский пастор, писатель и богослов. Его четырёхтомные «Физиогномические фрагменты» были изданы в 1775-1778 годах.",
    evidence: [
      e("University of Zurich - Lavater Edition", "https://www.lavater.uzh.ch/de.html", "Университетский исследовательский проект подтверждает годы жизни, богословскую и литературную деятельность Лафатера и его корпус текстов."),
      e("Deutsche Biographie", "https://www.deutsche-biographie.de/gnd118570293.html", "Академическая национальная биографическая база независимо подтверждает годы жизни, пасторскую и писательскую деятельность Лафатера и выход четырёх частей Physiognomische Fragmente в 1775-1778 годах."),
    ],
    decision: "corrected",
    notes: "Неопределённое слово «мыслитель» заменено документированными занятиями и точным названием многотомного труда.",
  },
  {
    key: "switzerland:max_frisch",
    originalSha256: "5e3efdd21ea3759bc328e490d49a9e6344db69c1174d65b70df8dc0cd287f7d1",
    reviewedTextRu: "Макс Фриш (1911-1991) - швейцарский писатель, драматург и архитектор. Среди его произведений - романы «Штиллер» и «Homo Faber», а также пьеса «Андорра».",
    evidence: [
      e("ETH Library", "https://library.ethz.ch/en/collections-and-archives/short-portraits/max-frisch-1911-1991.html", "Библиотека ETH подтверждает даты, образование и работу архитектора, литературную деятельность и основные произведения Фриша."),
      e("Deutsche Biographie", "https://www.deutsche-biographie.de/gnd118536109.html?language=de", "Академическая национальная биографическая база независимо подтверждает швейцарскую принадлежность, даты и занятия писателя, драматурга и архитектора."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование заменено профессиями и конкретными произведениями.",
  },
  {
    key: "switzerland:robert_walser",
    originalSha256: "dda1e5058a6368250eb1deaf29ad44c9db2a89d2e9a3e4d64b21556fa2972382",
    reviewedTextRu: "Роберт Вальзер (1878-1956) - швейцарский писатель, автор романов «Семейство Таннер», «Помощник» и «Якоб фон Гунтен». Его ранние стихотворения были опубликованы в 1898 году.",
    evidence: [
      e("Robert Walser Center", "https://www.robertwalser.ch/en/rw", "Официальный исследовательский центр подтверждает годы 1878-1956, публикацию первых стихов в 1898 году и романы Geschwister Tanner, Der Gehülfe и Jakob von Gunten."),
      e("Deutsche Biographie", "https://www.deutsche-biographie.de/gnd118628860.html", "Академическая национальная биографическая база независимо подтверждает даты, швейцарскую принадлежность и литературную деятельность Вальзера."),
    ],
    decision: "corrected",
    notes: "Непроверяемое широкое утверждение о влиянии заменено датами публикации и конкретными произведениями.",
  },
];

export const writerBiographyFactReviewBatch51: readonly WriterBiographyFactReviewRecord[] = seeds.map(
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
