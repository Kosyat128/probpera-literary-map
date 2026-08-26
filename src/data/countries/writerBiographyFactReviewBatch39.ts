export const WRITER_BIOGRAPHY_FACT_REVIEW_BATCH39_REVIEWER =
  "Codex independent claim-by-claim factual review, batch 39";

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

const reviewer = WRITER_BIOGRAPHY_FACT_REVIEW_BATCH39_REVIEWER;
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

const seeds = [
  {
    key: "mali:modibo_sounkalo_keita",
    originalSha256: "7380de82ba16a305ce4988dae17fa9e3ffcd9ffab31403fff1b25427ff0cadc3",
    reviewedTextRu: "Модибо Сункало Кейта (род. 1948) - малийский журналист и писатель, публиковавшийся по-французски. Среди его книг - роман «L’Archer bassari» и сборник рассказов «L’Orphelin». ",
    evidence: [
      ["Institut français de Mauritanie", "https://mediatheque-ifm.org/index.php?id=16975&lvl=author_see", "Библиотечный каталог подтверждает авторскую форму имени, 1948 год рождения и издания Кейты."],
      ["Persée", "https://www.persee.fr/doc/cea_0008-0055_1983_num_23_92_2244_t1_0514_0000_1", "Академический библиографический обзор атрибутирует Модибо Сункало Кейте роман L’Archer bassari."],
    ],
    decision: "corrected",
    notes: "Краткая заглушка дополнена годом рождения, языком публикаций и двумя документированными книгами; неподтверждённый год смерти не публикуется.",
  },
  {
    key: "mali:yambo_ouologuem",
    originalSha256: "7207559eb84ff83cd932d107b5ebe692c3cf457d2a06fb5020dd315bf2fd10ea",
    reviewedTextRu: "Ямбо Уологем (1940-2017) - малийский франкоязычный писатель. Его роман «Le Devoir de violence» получил премию Ренодо в 1968 году.",
    evidence: [
      ["Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark%3A/12148/cb455136207", "Авторитетная запись подтверждает годы 1940-2017, малийскую авторскую идентичность и роман Le Devoir de violence."],
      ["WorldCat", "https://search.worldcat.org/search?q=au%3A%22Ouologuem%2C+Yambo%22", "Библиотечный каталог подтверждает авторство романа и его связь с премией Ренодо 1968 года."],
    ],
    decision: "corrected",
    notes: "Неточная первенствующая формула заменена языком, конкретным романом и проверяемой премией.",
  },
  {
    key: "malta:anton_manuel_caruana",
    originalSha256: "7c7519c8fc3f6a9bc4373c8098a952676b8d89f2177a70a6c0b8c0e6eaffa434",
    reviewedTextRu: "Антонио Эмануэле Каруана (1839-1907) - мальтийский писатель, археолог и исследователь мальтийского языка. Он написал роман «Ineż Farruġ» и составил «Vocabolario della lingua maltese».",
    evidence: [
      ["University of Malta Library", "https://www.um.edu.mt/library/oar/handle/123456789/50140", "Университетский репозиторий идентифицирует Antonio Emanuele Caruana, годы 1839-1907 и его филологические труды."],
      ["National Library of Malta", "https://nla.gov.mt/wp-content/uploads/2024/03/LRC-Malta-catalogue-20.03.24.pdf", "Каталог национальной библиотеки фиксирует роман Ineż Farruġ и словарь мальтийского языка Каруаны."],
    ],
    decision: "corrected",
    notes: "Имя и годы нормализованы по мальтийским каталогам; оценочная формула заменена ролями и библиографией.",
  },
  {
    key: "malta:dun_karm_psaila",
    originalSha256: "d4555d0157e998da376733095a22d18bec5fd8d91c8cd19e67b839b383450044",
    reviewedTextRu: "Дун Карм Псайла (1871-1961) - мальтийский священник, поэт и лексикограф. Его стихотворение «L-Innu Malti» стало текстом государственного гимна Мальты, а к его книгам относится «Il-Jien u lil hinn Minnu».",
    evidence: [
      ["University of Malta Library", "https://www.um.edu.mt/library/oar/handle/123456789/54450", "Университетская запись подтверждает годы, литературную и священническую деятельность Дун Карма."],
      ["Heritage Malta", "https://heritagemalta.mt/news/heritage-malta-commemorates-dun-karm-psaila-with-an-exhibition-marking-150-years-since-his-birth/", "Национальное агентство наследия подтверждает авторство текста L-Innu Malti и поэтическое наследие Псайлы."],
    ],
    decision: "corrected",
    notes: "Справка дополнена священнической и лексикографической работой и конкретным поэтическим произведением.",
  },
  {
    key: "malta:manwel_dimech",
    originalSha256: "33791bba4fffab0e87f33e6c45204a3e599c31b1e2d954a3f4a0c3e9946d7690",
    reviewedTextRu: "Манвел Димех (1860-1921) - мальтийский писатель, журналист и общественный реформатор. Он издавал газету «Il-Bandiera tal-Maltin» и публиковал оставшийся незавершённым роман «Ivan u Prascovia».",
    evidence: [
      ["University of Malta Library", "https://www.um.edu.mt/library/oar/bitstream/123456789/40018/1/Manwel%20Dimech.pdf", "Университетская биография подтверждает годы, журналистскую и реформаторскую деятельность и роман Ivan u Prascovia."],
      ["WorldCat", "https://search.worldcat.org/search?q=au%3A%22Dimech%2C+Manwel%22", "Каталог подтверждает авторскую идентичность и библиографию Манвела Димеха."],
    ],
    decision: "corrected",
    notes: "Абстрактное определение заменено конкретными журналистской работой и романом.",
  },
  {
    key: "malta:oliver_friggieri",
    originalSha256: "fc07b3a553b4fd1bf21dd96eee728e6926afbe07d4bfe56d5f30619c86c7c969",
    reviewedTextRu: "Оливер Фриджери (1947-2020) - мальтийский писатель, поэт, критик и профессор литературы Мальтийского университета. Он писал на мальтийском языке; среди его романов - «Fil-Parlament ma Jikbrux Fjuri» и «L-Istramb».",
    evidence: [
      ["University of Malta", "https://www.um.edu.mt/newspoint/news/2020/11/tributes-oliver-friggieri", "Университетский некролог подтверждает даты, профессорскую, литературную и критическую деятельность Фриджери."],
      ["WorldCat", "https://search.worldcat.org/search?q=au%3A%22Friggieri%2C+Oliver%22", "Каталог подтверждает авторскую идентичность и издания Fil-Parlament ma Jikbrux Fjuri и L-Istramb."],
    ],
    decision: "corrected",
    notes: "Ошибочная русская фамилия и суперлатив исправлены; добавлены университетская роль, язык и произведения.",
  },
  {
    key: "malta:ruzar_briffa",
    originalSha256: "86da5b25d59d889c1372f904cb5729e628b68eb3ec3deda152e367b15a04298b",
    reviewedTextRu: "Ружар Бриффа (1906-1963) - мальтийский поэт и врач-дерматолог, родившийся в Валлетте. Он участвовал в создании университетского Общества мальтийского языка, а медицинский опыт отражался в его лирике.",
    evidence: [
      ["University of Malta Library", "https://www.um.edu.mt/library/oar/bitstream/123456789/42290/1/Ruzar%20Briffa.pdf", "Университетский портрет подтверждает годы, рождение в Валлетте, поэзию и врачебную работу Бриффы."],
      ["WorldCat", "https://search.worldcat.org/search?q=au%3A%22Briffa%2C+Ruzar%22", "Библиотечный каталог подтверждает авторскую идентичность, годы жизни и поэтические издания Ружара Бриффы."],
    ],
    decision: "corrected",
    notes: "Суперлатив заменён подтверждёнными профессиями, местом рождения и литературно-организационной работой.",
  },
  {
    key: "marshall_islands:kathy_jetnil_kijiner",
    originalSha256: "a3fa7511a6b8b2591878b3df6c4ed070f34721e25314c9d1e80985ee99bfcf75",
    reviewedTextRu: "Кэти Джетнил-Киджинер (род. 1989) - поэтесса и климатическая активистка с Маршалловых Островов, пишущая по-английски. Её сборник «Iep Jāltok: Poems from a Marshallese Daughter» и стихотворение «Dear Matafele Peinem» посвящены семье, культурной памяти и угрозе повышения уровня моря.",
    evidence: [
      ["Kathy Jetñil-Kijiner - официальный сайт", "https://www.kathyjetnilkijiner.com/", "Официальный профиль подтверждает имя, происхождение, поэтическую и климатическую деятельность и произведения."],
      ["University of Hawaiʻi", "https://hawaii.edu/cpis/alumni-and-friends/alumni-spotlight/kathy-jetnil-kijiner-2/", "Университетский профиль подтверждает образование, маршалльскую идентичность и сборник Iep Jāltok."],
    ],
    decision: "corrected",
    notes: "Русская передача фамилии исправлена; три предложения и суперлатив заменены двумя предметными предложениями без технической даты 1 января.",
  },
  {
    key: "mauritania:ahmedou_ould_abdel_kader",
    originalSha256: "5a345410cba3234256631c8152b09a00af1311e2aa512cdb0c0077d5b4d0131c",
    reviewedTextRu: "Ахмеду ульд Абдель Кадер (род. 1941) - мавританский арабоязычный поэт и прозаик, родившийся в Бутилимите. Он публиковал романы «الأسماء المتغيرة» и «القبر المجهول».",
    evidence: [
      ["Союз мавританских писателей", "https://oudaba.mr/?q=taxonomy%2Fterm%2F1031", "Профессиональная организация подтверждает имя, 1941 год рождения, литературные роли и библиографию автора."],
      ["Al Jazeera Encyclopedia", "https://www.aljazeera.net/encyclopedia/2014/10/23/%D8%A3%D8%AD%D9%85%D8%AF-%D9%88%D9%84%D8%AF-%D8%B9%D8%A8%D8%AF-%D8%A7%D9%84%D9%82%D8%A7%D8%AF%D8%B1", "Биографическая справка подтверждает рождение в Бутилимите и перечисляет романы арабоязычного автора."],
    ],
    decision: "corrected",
    notes: "Общая строка дополнена местом рождения и двумя документированными романами.",
  },
  {
    key: "mauritania:hamed_ould_hamdane",
    originalSha256: "75a38c89b3803452b9f4ea8f45988afc03d18a882e66c6f4870b38e4b7c886eb",
    reviewedTextRu: "Авторитетные каталоги не устанавливают мавританского литератора Hamed Ould Hamdane с приписанными карточкой 1957 годом рождения и литературной деятельностью. До появления однозначной национальной или библиотечной записи профиль не публикуется.",
    evidence: [
      ["WorldCat", "https://search.worldcat.org/search?q=%22Hamed+Ould+Hamdane%22", "Поиск точной формы имени не обнаруживает однозначной авторской записи с заявленными датой, страной и произведениями."],
      ["Библиотека Конгресса США", "https://id.loc.gov/search/?q=%22Hamed%20Ould%20Hamdane%22", "Авторитетный файл не устанавливает заявленную литературную личность и её библиографию."],
    ],
    decision: "held",
    notes: "Личность и библиография не установлены независимо; запись помещена в карантин без попытки угадать иную транслитерацию.",
  },
  {
    key: "mauritania:mokhtar_ould_hamidoun",
    originalSha256: "e089a9f4b585218952ef2bc95e78fd2c22861627d7af4a9fc70dfc5dbecdd879",
    reviewedTextRu: "Мохтар ульд Хамидун (1898-1993) - мавританский учёный, поэт и исследователь истории и культуры страны, писавший по-арабски и по-французски. Он подготовил труд «Précis sur la Mauritanie» и собирал материалы для энциклопедии «Hayat Muritaniyya».",
    evidence: [
      ["Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark%3A/12148/cb12228801p", "Авторитетная запись подтверждает имя, 1898 год рождения, языки, научные роли и библиографию Хамидуна."],
      ["CNRS / Annuaire de l’Afrique du Nord", "https://cinumedpub.mmsh.fr/aan/Pdf/AAN-1999-38_08.pdf", "Академическое исследование подтверждает годы 1898-1993 и работу над историко-культурным корпусом Мавритании."],
    ],
    decision: "corrected",
    notes: "Заглушка дополнена языками, исследовательскими направлениями и двумя атрибутированными трудами.",
  },
  {
    key: "mauritania:moussa_ould_ebnou",
    originalSha256: "32568b3df26cc8e74e7c371140a11eef7117b12bffdb34447af4b6ac297cca45",
    reviewedTextRu: "Мусса ульд Эбну (род. 1956) - мавританский романист и философ, родившийся в Бутилимите и пишущий по-французски и по-арабски. Он издавал собственные переводы романов «L’Amour impossible» и «Le Barzakh» на арабский язык.",
    evidence: [
      ["Moussa Ould Ebnou - официальный сайт", "https://moussaebnou.net/pages/about", "Официальная биография подтверждает дату и место рождения, философскую карьеру, двуязычие и романы."],
      ["SOAS University of London Repository", "https://soas-repository.worktribe.com/OutputFile/362884", "Университетское исследование рассматривает франко-арабское самопереводчество романов L’Amour impossible и Le Barzakh."],
    ],
    decision: "corrected",
    notes: "Суперлатив заменён местом рождения, языками и документированной практикой самоперевода.",
  },
  {
    key: "mauritius:ananda_devi",
    originalSha256: "a3c353142d795286e5a706013bf5282b19ffb31b1660347ef2a43416ff6d0fcd",
    reviewedTextRu: "Ананда Деви (род. 1957) - маврикийская франкоязычная писательница, поэтесса и переводчица. Среди её романов - «Ève de ses décombres» и «Le Sari vert».",
    evidence: [
      ["Académie française", "https://www.academie-francaise.fr/sites/academie-francaise.fr/files/palmares_2014_0.pdf", "Премиальный список Французской академии подтверждает авторскую идентичность Ананды Деви и роман Ève de ses décombres."],
      ["WorldCat", "https://search.worldcat.org/search?q=au%3A%22Devi%2C+Ananda%22", "Каталог подтверждает 1957 год, маврикийское происхождение и издания Ève de ses décombres и Le Sari vert."],
    ],
    decision: "corrected",
    notes: "Однострочная заглушка дополнена жанрами и двумя проверенными романами.",
  },
  {
    key: "mauritius:edouard_maunick",
    originalSha256: "4e37adcc335b101b8e09e04268634ad16344ec3e3b85ae5ea3e2c63a53d17cf2",
    reviewedTextRu: "Эдуар Моник (1931-2021) - маврикийский франкоязычный поэт, журналист и дипломат. В его библиографии представлены сборники «Ces oiseaux du sang» и «Fusillez-moi» и поэма «Mandéla mort et vif».",
    evidence: [
      ["Académie française", "https://www.academie-francaise.fr/actualites/m-edouard-maunick", "Французская академия подтверждает годы, маврикийское происхождение, поэтическую и дипломатическую деятельность Моника."],
      ["Bibliothèque nationale de France", "https://catalogue.bnf.fr/rechercher.do?motRecherche=Edouard+Maunick&critereRecherche=0&depart=0&facetteModifiee=ok", "Национальный каталог подтверждает авторскую идентичность и перечисленные поэтические издания."],
    ],
    decision: "corrected",
    notes: "Общая формула заменена профессиями и тремя конкретными произведениями.",
  },
  {
    key: "mauritius:jmg_le_clezio",
    originalSha256: "bd2f56b5b81566923d3a1e1a4f0c18ae06e1ca2f5d59105d406480cc7f71d4b1",
    reviewedTextRu: "Жан-Мари Гюстав Леклезио (род. 1940) - французский писатель из семьи маврикийского происхождения, автор романов, рассказов и эссе. В 2008 году он получил Нобелевскую премию по литературе; среди его книг - «Désert» и «Le Chercheur d’or».",
    evidence: [
      ["The Nobel Prize", "https://www.nobelprize.org/prizes/literature/2008/clezio/biographical/", "Официальная биография подтверждает дату рождения, маврикийское семейное происхождение и литературную карьеру Леклезио."],
      ["Bibliothèque nationale de France", "https://catalogue.bnf.fr/rechercher.do?motRecherche=J.+M.+G.+Le+Clezio&critereRecherche=0&depart=0&facetteModifiee=ok", "Каталог подтверждает авторскую идентичность и издания Désert и Le Chercheur d’or."],
    ],
    decision: "corrected",
    notes: "Расплывчатая культурная связь заменена точным семейным происхождением, жанрами, премией и книгами.",
  },
  {
    key: "mauritius:khal_torabully",
    originalSha256: "0eee284970d354cf29a0430630512ed6f35d5bb0d7f4d959052922080f7ae5e0",
    reviewedTextRu: "Хал Торабулли (род. 1956) - маврикийский поэт, эссеист и режиссёр, родившийся в Порт-Луи и пишущий по-французски. В книге «Cale d’étoiles - Coolitude» он сформулировал концепцию кулитюда, связанную с памятью наёмных работников индийского происхождения.",
    evidence: [
      ["Bennington College", "https://www.bennington.edu/events/n%C3%A9gritude-coolitude-visionary-poetry-of-khal-torabully", "Университетский профиль подтверждает происхождение, поэтическую деятельность и разработку концепции coolitude."],
      ["Boston University - AGNI", "https://agnionline.bu.edu/about/our-people/authors/khal-torabully/", "Литературный журнал университета подтверждает 1956 год, место рождения, жанры и книгу Cale d’étoiles - Coolitude."],
    ],
    decision: "corrected",
    notes: "Заглушка дополнена местом рождения, языком, жанрами и проверяемой литературно-культурной концепцией.",
  },
  {
    key: "mauritius:malcolm_de_chazal",
    originalSha256: "4b95af460b8c1682bfdfc83ceda3029a147c1573c62eb5e8801d3af9ed9e2853",
    reviewedTextRu: "Малькольм де Шазаль (1902-1981) - маврикийский франкоязычный писатель, поэт и художник. Его афористическая книга «Sens-plastique» вышла в 1947 году, а «Petrusmok» соединяет мифологию, историю и воображаемую географию Маврикия.",
    evidence: [
      ["Prime Minister’s Office of Mauritius", "https://pmo.govmu.org/CabinetDecision/2002/Cabinet-Decisions-taken-on-05-December-2002.aspx", "Правительственное сообщение подтверждает национальное культурное значение и столетие со дня рождения де Шазаля."],
      ["Bibliothèque nationale de France", "https://catalogue.bnf.fr/rechercher.do?index=AUT3&numNotice=11917345&typeNotice=p", "Авторитетный каталог подтверждает годы, авторскую идентичность и книги Sens-plastique и Petrusmok."],
    ],
    decision: "corrected",
    notes: "Суперлатив заменён языком, художественной ролью и характеристикой двух книг.",
  },
  {
    key: "mauritius:nathacha_appanah",
    originalSha256: "07d1047c5c9c728179833843644fdd748871c0eed004ac4c757d557a04d6114c",
    reviewedTextRu: "Наташа Аппана (род. 1973) - писательница и журналистка, родившаяся на Маврикии и пишущая по-французски. Её романы «Le Dernier Frère» и «Tropique de la violence» обращаются к истории перемещения людей, сиротству и насилию.",
    evidence: [
      ["Éditions Gallimard", "https://www.gallimard.fr/auteurs/nathacha-appanah", "Издательский профиль подтверждает маврикийское происхождение, литературную деятельность и библиографию Аппана."],
      ["Bibliothèque nationale de France", "https://catalogue.bnf.fr/rechercher.do?motRecherche=Nathacha+Appanah&critereRecherche=0&depart=0&facetteModifiee=ok", "Национальный каталог подтверждает авторскую идентичность и романы Le Dernier Frère и Tropique de la violence."],
    ],
    decision: "corrected",
    notes: "Неопределённая современная характеристика заменена местом рождения, языком, профессиями, романами и тематикой.",
  },
  {
    key: "mexico:alfonso_reyes",
    originalSha256: "978d3148a47006bc487c0bff86b1d126d1ed3e5fa894b855737041a0392d664f",
    reviewedTextRu: "Альфонсо Рейес (1889-1959) - мексиканский эссеист, поэт, переводчик и дипломат. В книгах «Visión de Anáhuac», «Ifigenia cruel» и «El deslinde» он работал с историей Мексики, античной традицией и теорией литературы.",
    evidence: [
      ["Enciclopedia de la Literatura en México", "https://www.elem.mx/autor/datos/914", "Национальная литературная энциклопедия подтверждает даты, роли и библиографию Альфонсо Рейеса."],
      ["Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark%3A/12148/cb12058725p", "Авторитетная запись подтверждает авторскую идентичность, годы и перечисленные произведения."],
    ],
    decision: "corrected",
    notes: "Суперлатив заменён жанрами и тремя произведениями с конкретными интеллектуальными направлениями.",
  },
  {
    key: "mexico:alvaro_enrigue",
    originalSha256: "5616a7237525fffd6a14fd6ab60733a4184e48b80f686feff3e1429fa83b0825",
    reviewedTextRu: "Альваро Энриге (род. 1969) - мексиканский романист, рассказчик и эссеист. Он написал книги «La muerte de un instalador», «Hipotermia» и «Muerte súbita», соединяющие исторический материал с экспериментальным повествованием.",
    evidence: [
      ["Enciclopedia de la Literatura en México", "https://www.elem.mx/autor/datos/1502", "Национальная литературная энциклопедия подтверждает дату рождения, жанры и библиографию Энриге."],
      ["WorldCat", "https://search.worldcat.org/search?q=au%3A%22Enrigue%2C+Alvaro%22", "Каталог подтверждает авторскую идентичность и издания трёх названных книг."],
    ],
    decision: "corrected",
    notes: "Расплывчатая характеристика заменена жанрами и оригинальными названиями трёх книг.",
  },
  {
    key: "mexico:amparo_davila",
    originalSha256: "1089d04883127e9877025afbd8b11023a14078588a20703a0fca6e1c73e14faa",
    reviewedTextRu: "Ампаро Давила (1928-2020) - мексиканская поэтесса и автор рассказов, в которых повседневная реальность переходит в тревожное и фантастическое. Её сборники включают «Tiempo destrozado», «Música concreta» и «Árboles petrificados».",
    evidence: [
      ["Enciclopedia de la Literatura en México", "https://www.elem.mx/autor/datos/284", "Национальная литературная энциклопедия подтверждает даты, жанры и библиографию Ампаро Давилы."],
      ["WorldCat", "https://search.worldcat.org/search?q=au%3A%22Davila%2C+Amparo%22", "Каталог подтверждает авторскую идентичность и три сборника рассказов."],
    ],
    decision: "corrected",
    notes: "Общая строка уточнена поэтической работой и оригинальными названиями трёх сборников.",
  },
  {
    key: "mexico:carlos_de_siguenza",
    originalSha256: "ccacb8a0691d75bcd0cd1f9d3357595e6caa1b7c3e376186ee6a5ee830c48aca",
    reviewedTextRu: "Карлос де Сигуэнса-и-Гонгора (1645-1700) - новоиспанский писатель, историк, математик и астроном. Он написал повествование «Infortunios de Alonso Ramírez», поэму «Primavera indiana» и научную полемику «Libra astronómica y filosófica».",
    evidence: [
      ["Enciclopedia de la Literatura en México", "https://www.elem.mx/autor/datos/3772", "Национальная литературная энциклопедия подтверждает даты, роли и библиографию Сигуэнсы-и-Гонгоры."],
      ["WorldCat", "https://search.worldcat.org/search?q=au%3A%22Siguenza+y+Gongora%2C+Carlos+de%22", "Каталог подтверждает авторскую идентичность и издания перечисленных произведений."],
    ],
    decision: "corrected",
    notes: "Историографическая оценка заменена точными ролями и тремя произведениями разных жанров.",
  },
  {
    key: "mexico:carlos_fuentes",
    originalSha256: "805d6319764eb22dabda0fecf63703c2b419643de36e20ec7a6721b8f9f2fbc2",
    reviewedTextRu: "Карлос Фуэнтес (1928-2012) - мексиканский романист, эссеист и дипломат, связанный с латиноамериканским литературным бумом. В романах «La región más transparente», «La muerte de Artemio Cruz» и «Terra Nostra» он исследовал историю и политическую культуру Мексики.",
    evidence: [
      ["Enciclopedia de la Literatura en México", "https://www.elem.mx/autor/datos/1162", "Национальная литературная энциклопедия подтверждает даты, жанры, дипломатическую деятельность и библиографию Фуэнтеса."],
      ["El Colegio Nacional", "https://colnal.mx/integrantes/carlos-fuentes/", "Официальный профиль Коллегии подтверждает карьеру и основные романы Карлоса Фуэнтеса."],
    ],
    decision: "corrected",
    notes: "Общая справка конкретизирована тремя романами и точной связью с литературным бумом.",
  },
  {
    key: "mexico:cristina_rivera_garza",
    originalSha256: "bba2d55567e5a6ab83bfe933a3d993623bc3799ea48865dce4780fc4d2b3666b",
    reviewedTextRu: "Кристина Ривера Гарса (род. 1964) - мексиканская писательница, историк и профессор, работающая в прозе, поэзии и эссеистике. Её книга «El invencible verano de Liliana» получила Пулитцеровскую премию 2024 года в категории мемуаров или автобиографии; среди романов автора - «Nadie me verá llorar».",
    evidence: [
      ["Enciclopedia de la Literatura en México", "https://www.elem.mx/autor/datos/929", "Национальная литературная энциклопедия подтверждает дату рождения, академическую карьеру, жанры и библиографию Риверы Гарсы."],
      ["The Pulitzer Prizes", "https://www.pulitzer.org/winners/cristina-rivera-garza", "Официальная страница премии подтверждает награду 2024 года за El invencible verano de Liliana и точную категорию."],
    ],
    decision: "corrected",
    notes: "Суперлатив заменён жанрами, академической ролью, конкретным романом и точно названной Пулитцеровской премией.",
  },
  {
    key: "mexico:elena_garro",
    originalSha256: "916a1479c6e5c977aafe56e532a36fd65de0e2c387be687b48d813ab1bbb57cd",
    reviewedTextRu: "Элена Гарро (1916-1998) - мексиканская писательница, драматург, журналистка и сценаристка. Её роман «Los recuerdos del porvenir», пьеса «Un hogar sólido» и сборник «La semana de colores» используют нелинейное время, память и фантастические элементы.",
    evidence: [
      ["Enciclopedia de la Literatura en México", "https://www.elem.mx/autor/datos/421", "Национальная литературная энциклопедия подтверждает даты, жанры и библиографию Элены Гарро."],
      ["WorldCat", "https://search.worldcat.org/search?q=au%3A%22Garro%2C+Elena%22", "Каталог подтверждает авторскую идентичность и издания трёх названных произведений."],
    ],
    decision: "corrected",
    notes: "Спорная ярлыковая формула о предшественнице магического реализма заменена жанрами, произведениями и наблюдаемыми приёмами.",
  },
  {
    key: "mexico:elena_poniatowska",
    originalSha256: "a26ac6de8fac7f9cb53b7f4f3e1d12d158a5d0763358d351a6d026fcfe9d6750",
    reviewedTextRu: "Элена Понятовская (род. 1932) - мексиканская писательница и журналистка, родившаяся в Париже. Она создала документальную книгу «La noche de Tlatelolco» и романы «Hasta no verte Jesús mío» и «Querido Diego, te abraza Quiela»; в 2013 году получила премию Сервантеса.",
    evidence: [
      ["Enciclopedia de la Literatura en México", "https://www.elem.mx/autor/datos/866", "Национальная литературная энциклопедия подтверждает дату и место рождения, журналистскую деятельность и библиографию Понятовской."],
      ["Instituto Cervantes", "https://www.cervantes.es/sobre_instituto_cervantes/prensa/2013/noticias/premio-cervantes-2013.htm", "Официальное сообщение подтверждает присуждение Элене Понятовской премии Сервантеса 2013 года."],
    ],
    decision: "corrected",
    notes: "Обобщённая социальная характеристика дополнена тремя книгами и точно датированной премией.",
  },
  {
    key: "mexico:fernanda_melchor",
    originalSha256: "e986a02f6dc832b549fc8ba35ca74dbbae1e331831cc8955a7b35f1e75d9d257",
    reviewedTextRu: "Фернанда Мельчор (род. 1982) - мексиканская писательница и журналистка из штата Веракрус. Она написала хроники «Aquí no es Miami» и романы «Temporada de huracanes» и «Páradais», посвящённые насилию и социальному неравенству.",
    evidence: [
      ["Enciclopedia de la Literatura en México", "https://www.elem.mx/autor/datos/4045", "Национальная литературная энциклопедия подтверждает 1982 год, происхождение, журналистскую работу и библиографию Мельчор."],
      ["WorldCat", "https://search.worldcat.org/search?q=au%3A%22Melchor%2C+Fernanda%22", "Каталог подтверждает авторскую идентичность и издания Aquí no es Miami, Temporada de huracanes и Páradais."],
    ],
    decision: "corrected",
    notes: "Суперлатив удалён, технический день рождения не повторяется, а библиография приведена к оригинальным названиям без дубля.",
  },
  {
    key: "mexico:guadalupe_nettel",
    originalSha256: "f2f2803146ec5d0e4a3f27a4ec4b279915d4dbe462626e84481e9fe6dd11901e",
    reviewedTextRu: "Гуадалупе Неттель (род. 1973) - мексиканская писательница и эссеистка, автор романов и рассказов. Среди её книг - «El cuerpo en que nací», «Después del invierno» и сборник «El matrimonio de los peces rojos».",
    evidence: [
      ["Enciclopedia de la Literatura en México", "https://www.elem.mx/autor/datos/3962", "Национальная литературная энциклопедия подтверждает дату рождения 27 мая 1973 года, жанры и библиографию Неттель."],
      ["WorldCat", "https://search.worldcat.org/search?q=au%3A%22Nettel%2C+Guadalupe%22", "Каталог подтверждает авторскую идентичность и издания трёх названных книг."],
    ],
    decision: "corrected",
    notes: "Психологическая оценка заменена жанрами и библиографией; профильная дата исправляется с 2 на 27 мая.",
  },
  {
    key: "mexico:ignacio_manuel_altamirano",
    originalSha256: "7e1fcca2586f144d84620d25072640be4aa0841df3d0a3ae89d4405e5abc6dfb",
    reviewedTextRu: "Игнасио Мануэль Альтамирано (1834-1893) - мексиканский писатель, журналист, педагог, политик и дипломат, писавший по-испански. Его романы «Clemencia», «La Navidad en las montañas» и «El Zarco» участвовали в формировании национальной литературы республиканской Мексики.",
    evidence: [
      ["Enciclopedia de la Literatura en México", "https://www.elem.mx/autor/datos/1211", "Национальная литературная энциклопедия подтверждает даты, общественные роли и библиографию Альтамирано."],
      ["WorldCat", "https://search.worldcat.org/search?q=au%3A%22Altamirano%2C+Ignacio+Manuel%22", "Каталог подтверждает авторскую идентичность и издания Clemencia, La Navidad en las montañas и El Zarco."],
    ],
    decision: "corrected",
    notes: "Первенствующая оценка заменена полным набором ролей и тремя романами.",
  },
  {
    key: "mexico:javier_velasco",
    originalSha256: "efdfd1781b20f798a4120cabb1e622cae222a534ec65318e365e9dd46f09f317",
    reviewedTextRu: "Хавьер Веласко (род. 1958) - мексиканский прозаик, хронист и журналист, родившийся в Мехико. Его роман «Diablo guardián» получил премию Alfaguara в 2003 году; он также написал «Luna llena en las rocas» и «Puedo explicarlo todo».",
    evidence: [
      ["Enciclopedia de la Literatura en México", "https://www.elem.mx/autor/datos/1996", "Национальная литературная энциклопедия подтверждает имя Xavier Velasco, дату 7 ноября 1958 года, роли, книги и премию Alfaguara."],
      ["Penguin Random House", "https://www.penguinlibros.com/mx/literatura-contemporanea/312371-libro-diablo-guardian-9786073821162", "Официальная страница издателя подтверждает авторство Diablo guardián и премию Alfaguara 2003 года."],
    ],
    decision: "corrected",
    notes: "Год рождения 1964 и идентификатор Javier исправляются по национальной энциклопедии на профиль Xavier Velasco, 1958; добавлены книги и премия.",
  },
  {
    key: "mexico:jorge_volpi",
    originalSha256: "f6be77dc451eddf576f57cf5f668ff27e974d80bde8eb7935e968ba523a3d2af",
    reviewedTextRu: "Хорхе Вольпи (род. 1968) - мексиканский романист, эссеист и участник литературной группы Crack. Он написал романы «En busca de Klingsor», «El fin de la locura» и документальный роман «Una novela criminal».",
    evidence: [
      ["Enciclopedia de la Literatura en México", "https://www.elem.mx/autor/datos/1142", "Национальная литературная энциклопедия подтверждает дату рождения, жанры, участие в группе Crack и библиографию Вольпи."],
      ["WorldCat", "https://search.worldcat.org/search?q=au%3A%22Volpi%2C+Jorge%22", "Каталог подтверждает авторскую идентичность и издания трёх названных романов."],
    ],
    decision: "corrected",
    notes: "Декларация об обновлении литературы заменена проверяемой групповой принадлежностью и тремя произведениями.",
  },
  {
    key: "mexico:jose_emilio_pacheco",
    originalSha256: "6cc17b693c6de7b9c6a35db4496240230e740fd261eb4c08a1090689f213e6cc",
    reviewedTextRu: "Хосе Эмилио Пачеко (1939-2014) - мексиканский поэт, прозаик, эссеист и переводчик. В его библиографии представлены роман «Las batallas en el desierto», сборник рассказов «El principio del placer» и книга стихов «No me preguntes cómo pasa el tiempo».",
    evidence: [
      ["Enciclopedia de la Literatura en México", "https://www.elem.mx/autor/datos/806", "Национальная литературная энциклопедия подтверждает даты, жанры и библиографию Пачеко."],
      ["WorldCat", "https://search.worldcat.org/search?q=au%3A%22Pacheco%2C+Jose+Emilio%22", "Каталог подтверждает авторскую идентичность и издания трёх названных книг."],
    ],
    decision: "corrected",
    notes: "Суперлатив и тематическое обобщение заменены жанрами и конкретной библиографией.",
  },
  {
    key: "mexico:jose_joaquin_fernandez_de_lizardi",
    originalSha256: "30320395cb1aae6089c54e5a276418231649c85531324d8eed0fd1e7fb4be332",
    reviewedTextRu: "Хосе Хоакин Фернандес де Лисарди (1776-1827) - новоиспанский и мексиканский писатель, журналист и издатель. Он выпускал газету «El Pensador Mexicano» и написал романы «El Periquillo Sarniento» и «La Quijotita y su prima».",
    evidence: [
      ["Enciclopedia de la Literatura en México", "https://www.elem.mx/autor/datos/3002", "Национальная литературная энциклопедия подтверждает даты, журналистскую деятельность и библиографию Лисарди."],
      ["WorldCat", "https://search.worldcat.org/search?q=au%3A%22Fernandez+de+Lizardi%2C+Jose+Joaquin%22", "Каталог подтверждает авторскую идентичность и издания El Periquillo Sarniento и La Quijotita y su prima."],
    ],
    decision: "corrected",
    notes: "Ошибочный русский заголовок и первенствующая оценка заменены оригинальными названиями газеты и двух романов.",
  },
  {
    key: "mexico:jose_vasconcelos",
    originalSha256: "375b145be032f7483a9c2b6d78b3d8f7d418e30239f4895bf3424f9a9f0e2ded",
    reviewedTextRu: "Хосе Васконселос (1882-1959) - мексиканский философ, эссеист, педагог и государственный деятель, возглавлявший Секретариат народного образования. Он написал эссе «La raza cósmica» и автобиографические книги «Ulises criollo» и «La tormenta».",
    evidence: [
      ["Enciclopedia de la Literatura en México", "https://www.elem.mx/autor/datos/1110", "Национальная литературная энциклопедия подтверждает дату рождения 27 февраля 1882 года, роли и библиографию Васконселоса."],
      ["El Colegio Nacional", "https://colnal.mx/wp-content/uploads/2020/04/Listado-de-integrantes-Colnal-2020-Todos-los-integrantes.pdf", "Официальный справочник подтверждает годы жизни, государственную, образовательную и литературную деятельность Васконселоса."],
    ],
    decision: "corrected",
    notes: "Профильная дата рождения исправляется на 27 февраля; абстрактное влияние заменено должностью и тремя книгами.",
  },
  {
    key: "mexico:juan_rulfo",
    originalSha256: "a335c30792fa4ce223e0fc9c4a1bc326d4cdc92a81238a431a33cb3933107359",
    reviewedTextRu: "Хуан Рульфо (1917-1986) - мексиканский писатель, сценарист и фотограф. Его художественная проза включает сборник рассказов «El Llano en llamas» и роман «Pedro Páramo», построенный на фрагментарных голосах жителей Комалы.",
    evidence: [
      ["Enciclopedia de la Literatura en México", "https://www.elem.mx/autor/datos/970", "Национальная литературная энциклопедия подтверждает даты, роли и библиографию Хуана Рульфо."],
      ["WorldCat", "https://search.worldcat.org/search?q=au%3A%22Rulfo%2C+Juan%22", "Каталог подтверждает авторскую идентичность и издания El Llano en llamas и Pedro Páramo."],
    ],
    decision: "corrected",
    notes: "Суперлатив и недоказуемая степень влияния заменены жанрами, двумя книгами и проверяемой формой повествования.",
  },
  {
    key: "mexico:laura_esquivel",
    originalSha256: "f875bea63f51c1c8b66b407c8d2c6c8a7cb7f96dd5e00c536537c501b6512967",
    reviewedTextRu: "Лаура Эскивель (род. 1950) - мексиканская писательница и сценаристка. Она написала романы «Como agua para chocolate», «La ley del amor» и «Malinche»; первый из них строит семейное повествование вокруг рецептов и приготовления пищи.",
    evidence: [
      ["Enciclopedia de la Literatura en México", "https://www.elem.mx/autor/datos/1538", "Национальная литературная энциклопедия подтверждает дату рождения, роли и библиографию Лауры Эскивель."],
      ["WorldCat", "https://search.worldcat.org/search?q=au%3A%22Esquivel%2C+Laura%22", "Каталог подтверждает авторскую идентичность и издания Como agua para chocolate, La ley del amor и Malinche."],
    ],
    decision: "corrected",
    notes: "Рекламная формула мировой известности заменена оригинальными названиями и проверяемой особенностью дебютного романа.",
  },
  {
    key: "mexico:manuel_gutierrez_najera",
    originalSha256: "5f17aa87fa6d02b93624df0841e4c19e9abb8bc52c8810e33c8ff4ef7d867603",
    reviewedTextRu: "Мануэль Гутьеррес Нахера (1859-1895) - мексиканский поэт, эссеист и журналист, публиковавшийся под несколькими псевдонимами. Его произведения включают поэму «La duquesa Job», рассказ «La novela del tranvía» и сборник «Cuentos frágiles».",
    evidence: [
      ["Enciclopedia de la Literatura en México", "https://www.elem.mx/autor/datos/3044", "Национальная литературная энциклопедия подтверждает даты, псевдонимы, жанры и библиографию Гутьерреса Нахеры."],
      ["WorldCat", "https://search.worldcat.org/search?q=au%3A%22Gutierrez+Najera%2C+Manuel%22", "Каталог подтверждает авторскую идентичность и издания названных произведений."],
    ],
    decision: "corrected",
    notes: "Роль предшественника заменена псевдонимной практикой, жанрами и оригинальными названиями трёх произведений.",
  },
  {
    key: "mexico:mariano_azuela",
    originalSha256: "9cdb42abce3602c12b748557e2601c863182ada2204fe7fa88d2a5bcc6b62e7a",
    reviewedTextRu: "Мариано Асуэла (1873-1952) - мексиканский врач и писатель, участвовавший в Мексиканской революции. Он написал романы «Los de abajo», «Mala yerba» и «Los caciques», в которых изображал вооружённый конфликт и сельское общество.",
    evidence: [
      ["Enciclopedia de la Literatura en México", "https://www.elem.mx/autor/datos/91", "Национальная литературная энциклопедия подтверждает даты, медицинскую и литературную деятельность и библиографию Асуэлы."],
      ["El Colegio Nacional", "https://colnal.mx/integrantes/mariano-azuela/", "Официальный профиль подтверждает участие в революционных событиях и романы Los de abajo, Mala yerba и Los caciques."],
    ],
    decision: "corrected",
    notes: "Первенствующая оценка и ранжирование романа заменены биографическим контекстом, тремя оригинальными названиями и тематикой.",
  },
  {
    key: "mexico:octavio_paz",
    originalSha256: "018d68f0b02cc1bd947ab6c5540aba3882023f38fa3d562a6f9d71c67a56e593",
    reviewedTextRu: "Октавио Пас (1914-1998) - мексиканский поэт, эссеист и дипломат, лауреат Нобелевской премии по литературе 1990 года. Среди его книг - эссе «El laberinto de la soledad» и «El arco y la lira» и поэма «Piedra de sol».",
    evidence: [
      ["The Nobel Prize", "https://www.nobelprize.org/prizes/literature/1990/paz/biographical/", "Официальная биография подтверждает даты, мексиканскую литературную и дипломатическую деятельность и премию 1990 года."],
      ["Enciclopedia de la Literatura en México", "https://www.elem.mx/autor/datos/810", "Национальная литературная энциклопедия подтверждает жанры и библиографию Октавио Паса."],
    ],
    decision: "corrected",
    notes: "Суперлатив удалён; справка дополнена точными жанрами и тремя произведениями.",
  },
  {
    key: "mexico:sergio_pitol",
    originalSha256: "c3e23f4c78ca71d40f936c55f62c9a7b4508c554ccbbe91a16d7150a41d46b29",
    reviewedTextRu: "Серхио Питоль (1933-2018) - мексиканский писатель, переводчик и дипломат, получивший премию Сервантеса в 2005 году. Он написал книги «El desfile del amor», «La vida conyugal» и «El arte de la fuga».",
    evidence: [
      ["Instituto Cervantes", "https://www.cervantes.es/bibliotecas_documentacion_espanol/biografias/sofia_sergio_pitol.htm", "Официальная биография подтверждает даты, литературную, переводческую и дипломатическую деятельность и премию Сервантеса."],
      ["Centro Virtual Cervantes", "https://cvc.cervantes.es/artes/ciudades_patrimonio/puebla/personalidades/pitol.htm", "Справочник Института Сервантеса подтверждает библиографию, включая El desfile del amor, La vida conyugal и El arte de la fuga."],
    ],
    decision: "corrected",
    notes: "Суперлатив заменён премией и оригинальными названиями трёх книг.",
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
    reviewedTextRu: seed.reviewedTextRu.trim(),
    applicableTextRu: seed.decision === "held" ? null : seed.reviewedTextRu.trim(),
    claims: [{
      textRu: seed.reviewedTextRu.trim(),
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

export const writerBiographyFactReviewBatch39: readonly WriterBiographyFactReviewRecord[] =
  seeds.map(finalizeReviewRecord);
