export const WRITER_BIOGRAPHY_FACT_REVIEW_BATCH14_REVIEWER =
  "Codex independent claim-by-claim factual review, batch 14";

export type WriterBiographyFactReviewDecision =
  | "unchanged"
  | "corrected"
  | "held";

export type WriterBiographyClaimVerdict =
  | "supported"
  | "corrected"
  | "not-established";

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

const reviewer = WRITER_BIOGRAPHY_FACT_REVIEW_BATCH14_REVIEWER;
const checkedAt = "2026-08-09";

function evidence(
  provider: string,
  url: string,
  findingRu: string,
): WriterBiographyClaimEvidence {
  return { provider, url, checkedAt, findingRu };
}

type ReviewBase = Omit<WriterBiographyFactReviewRecord, "applicableTextRu">;

const writerBiographyFactReviewBatch14Base: readonly ReviewBase[] = [
  {
    key: "botswana:laurie_kubuitsile",
    originalSha256:
      "cb8a8e46b524dffa5f70779bac42a7547cfc2ae771eb773e9afec0b0eec47273",
    reviewedTextRu:
      "Ботсванская писательница, автор художественной прозы для взрослых, подростков и детей. Её исторический роман «The Scattering» впервые вышел в 2016 году.",
    claims: [
      {
        textRu:
          "Лори Кубуитсиле — гражданка Ботсваны, пишущая художественную прозу для взрослых и юных читателей; роман «The Scattering» впервые опубликован в 2016 году.",
        verdict: "corrected",
        evidence: [
          evidence(
            "Botswana Writers Association",
            "https://www.botswanawriters.org/writers/kubuitsile.php",
            "Профиль писательской организации подтверждает гражданство Ботсваны, прозу для взрослых, детей и подростков и первую публикацию The Scattering в 2016 году.",
          ),
          evidence(
            "Namibia Scientific Society",
            "https://www.namscience.com/article/reprint-of-the-scattering",
            "Научное общество Намибии называет Кубуитсиле писательницей из Ботсваны, описывает The Scattering как исторический роман и фиксирует его выход в 2016 году.",
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Исходная формулировка конкретизирована без оценочного ранжирования. Date recommendation: карточка указывает 1963 год, тогда как реестр Botswana Writers Association — 1964-01-15; из-за расхождения с другими публичными биографиями дату нельзя менять автоматически до второй институциональной сверки. Shared country files не изменялись.",
  },
  {
    key: "botswana:moshe_motshegwa",
    originalSha256:
      "166d7eea03bf5b021df90a78733c4566166a2968be6ea3a41e4eaa355c187077",
    reviewedTextRu:
      "Заявленная карточкой идентичность ботсванского поэта Моше Мотшегвы не установлена по доступным авторитетным каталогам.",
    claims: [
      {
        textRu:
          "Не найдено надёжной authority-записи, связывающей имя Моше Мотшегва с заявленной литературной деятельностью в Ботсване.",
        verdict: "not-established",
        evidence: [
          evidence(
            "Library of Congress Online Catalog",
            "https://catalog.loc.gov/vwebv/search?searchArg=Moshe+Motshegwa&searchCode=GKEY%5E*&searchType=0&recCount=25",
            "Поиск по точному имени не выявил authority-записи или библиографического корпуса, совместимого с карточкой.",
          ),
          evidence(
            "WorldCat — OCLC",
            "https://search.worldcat.org/search?q=%22Moshe%20Motshegwa%22%20Botswana",
            "Поиск по имени и стране не выявил изданий, позволяющих установить заявленную идентичность поэта.",
          ),
        ],
      },
    ],
    reviewer,
    decision: "held",
    notes:
      "Held и quarantine recommendation: отсутствие результатов не доказывает несуществование автора, поэтому исходная роль не применяется публично; требуется национальная библиотечная либо издательская authority-запись. Карточечный birthDate 1960 институционально не подтверждён. Shared country files не изменялись.",
  },
  {
    key: "botswana:unity_dow",
    originalSha256:
      "547da682dcd4c11c34c393efc54b936d03b0116b41e3771b532d38d427ce9c2f",
    reviewedTextRu:
      "Ботсванская писательница и юрист, автор романа «Far and Beyon’». Она стала первой женщиной-судьёй Высокого суда Ботсваны.",
    claims: [
      {
        textRu:
          "Юнити Доу — ботсванская писательница и юрист, автор романа Far and Beyon’, ставшая первой женщиной-судьёй Высокого суда страны.",
        verdict: "corrected",
        evidence: [
          evidence(
            "Spinifex Press",
            "https://www.spinifexpress.com.au/unitydow",
            "Издатель называет Доу автором четырёх романов, включая Far and Beyon’, правозащитным юристом и первой женщиной-судьёй Высокого суда Ботсваны.",
          ),
          evidence(
            "United Nations — WomenWatch",
            "https://www.un.org/womenwatch/daw/panel-children/panel-AEK.htm",
            "Профиль ООН подтверждает юридическую и судейскую карьеру Доу, её литературную деятельность и роман Far and Beyond.",
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Расплывчатая тематика заменена конкретной книгой и документированной профессиональной ролью. Рекомендация — сохранить birthDate 1959-04-23: доступные профили не выявили противоречия. Shared country files не изменялись.",
  },
  {
    key: "brazil:carlos_drummond_de_andrade",
    originalSha256:
      "c3fda1525f125e2d0315647ff84d49fe34be5f6f1e0fb700384a67518041cb41",
    reviewedTextRu:
      "Бразильский поэт и хронист XX века, автор сборника «Роза народа» («A Rosa do Povo»).",
    claims: [
      {
        textRu:
          "Карлос Друммонд де Андраде был бразильским поэтом и хронистом XX века и написал сборник A Rosa do Povo.",
        verdict: "corrected",
        evidence: [
          evidence(
            "Instituto Moreira Salles",
            "https://ims.com.br/titular-colecao/carlos-drummond-de-andrade/",
            "Литературный архив IMS подтверждает работу Друммонда как поэта и хрониста и даты жизни 1902–1987.",
          ),
          evidence(
            "Fundação Biblioteca Nacional — BNDigital",
            "https://bndigital.bn.gov.br/carlos-drummond-de-andrade/",
            "Национальная библиотека Бразилии описывает поэтическую и журналистскую деятельность Друммонда и атрибутирует ему A Rosa do Povo, изданную в 1945 году.",
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Субъективный суперлатив заменён проверяемыми литературными ролями и конкретной книгой. Рекомендация — сохранить birthDate 1902-10-31 и deathDate 1987-08-17; identity установлена однозначно. Shared country files не изменялись.",
  },
  {
    key: "brazil:manoel_de_barros",
    originalSha256:
      "722d3a2cbf7f84d943d9312129ec353f87913dd76418910ed618257d3dd12bc4",
    reviewedTextRu:
      "Бразильский поэт XX–XXI веков, автор книг «Хранитель вод» («O guardador das águas») и «Книга ни о чём» («Livro sobre nada»).",
    claims: [
      {
        textRu:
          "Маноэл де Баррос был бразильским поэтом XX–XXI веков и написал O guardador das águas и Livro sobre nada.",
        verdict: "corrected",
        evidence: [
          evidence(
            "Biblioteca Pública do Paraná",
            "https://www.bpp.pr.gov.br/Candido/Pagina/Retrato-de-Um-Artista-Manoel-de-Barros",
            "Государственная библиотека Параны представляет Барроса как поэта и перечисляет O guardador das águas и Livro sobre nada среди его книг.",
          ),
          evidence(
            "Fundação Biblioteca Nacional — autoridade",
            "https://acervo.bn.gov.br/sophia_web/autoridade/detalhe/000631229",
            "Authority-запись Национальной библиотеки Бразилии подтверждает идентичность поэта, годы жизни 1916–2014 и библиографию Livro sobre nada.",
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Оценочное слово снято; добавлены две атрибутированные книги. Рекомендация — сохранить birthDate 1916-12-19 и deathDate 2014-11-13. Shared country files не изменялись.",
  },
  {
    key: "brunei:awang_mohammad_yassin",
    originalSha256:
      "ff6b08807c9b9f8d4568cd4b494c090625dbaaf6fa5e3a59c1c40b648ca62c04",
    reviewedTextRu:
      "Заявленная карточкой идентичность брунейского поэта Аванга Мохаммада Яссина не установлена по доступным авторитетным каталогам.",
    claims: [
      {
        textRu:
          "Доступные библиотечные каталоги не позволяют связать имя Аванг Мохаммад Яссин с заявленной литературной деятельностью в Брунее.",
        verdict: "not-established",
        evidence: [
          evidence(
            "Library of Congress Online Catalog",
            "https://catalog.loc.gov/vwebv/search?searchArg=Awang+Mohammad+Yassin&searchCode=GKEY%5E*&searchType=0&recCount=25",
            "Поиск по точному имени не выявил authority-записи, совместимой с идентичностью брунейского поэта.",
          ),
          evidence(
            "WorldCat — OCLC",
            "https://search.worldcat.org/search?q=%22Awang%20Mohammad%20Yassin%22%20Brunei",
            "Поиск по имени и стране не выявил библиографического корпуса, подтверждающего исходную карточку.",
          ),
        ],
      },
    ],
    reviewer,
    decision: "held",
    notes:
      "Held и quarantine recommendation: требуется национальная authority-запись либо первичный издательский каталог; birthDate 1935 и deathDate 2010 пока не применять как проверенные. Shared country files не изменялись.",
  },
  {
    key: "brunei:masuri_masrun",
    originalSha256:
      "7e2d4182bdb5765e9948e097603ccc2e9cae2194417f2f6b8cf29579a233f0f5",
    reviewedTextRu:
      "Заявленная карточкой идентичность брунейского автора Масури Масруна не установлена; институциональные источники описывают другого автора — сингапурского поэта Масури С. Н.",
    claims: [
      {
        textRu:
          "Имя и даты карточки сходны с Масури С. Н. (Масури Саликуном), которого библиотечные источники относят к Сингапуру, а не к Брунею; идентичность Масури Масруна не подтверждена.",
        verdict: "not-established",
        evidence: [
          evidence(
            "National Library Board Singapore — BiblioAsia",
            "https://biblioasia.nlb.gov.sg/all-sections/book-di-sebalik-tabir-masuri-sn-biographi-dan-karya-pilihan-yang-belum-tersiar/",
            "Национальная библиотека Сингапура представляет Масури С. Н. как сингапурского поэта и литературного деятеля.",
          ),
          evidence(
            "Dewan Bahasa dan Pustaka Malaysia",
            "https://prpm.dbp.gov.my/Cari1?d=243192&keyword=n",
            "Малайзийский языковой и литературный институт идентифицирует Масури С. Н. как сингапурского поэта Масури Саликуна, родившегося 11 июня 1927 года.",
          ),
        ],
      },
    ],
    reviewer,
    decision: "held",
    notes:
      "Held и identity quarantine recommendation: не подменять карточку сингапурским Масури С. Н. и не публиковать даты 1931–2005; нужна отдельная брунейская authority-запись. Shared country files не изменялись.",
  },
  {
    key: "bulgaria:blaga_dimitrova",
    originalSha256:
      "a12c8af811318eb0461b07eaf128f8d78f526f9d4f40a44aae08ed834e1cadc2",
    reviewedTextRu: "Болгарская писательница и поэтесса XX века.",
    claims: [
      {
        textRu:
          "Блага Димитрова была болгарской писательницей и поэтессой XX века.",
        verdict: "supported",
        evidence: [
          evidence(
            "Национальная библиотека Болгарии",
            "https://www.nationallibrary.bg/www/2021/12/26/2-%D1%8F%D0%BD%D1%83%D0%B0%D1%80%D0%B8-%D0%B7%D0%B0%D0%BF%D0%B0%D0%B4%D0%BD%D0%BE-%D1%84%D0%BE%D0%B0%D0%B9%D0%B5-100-%D0%B3-%D0%BE%D1%82-%D1%80%D0%BE%D0%B6%D0%B4%D0%B5%D0%BD%D0%B8%D0%B5%D1%82%D0%BE/",
            "Национальная библиотека называет Димитрову болгарской писательницей и поэтессой и фиксирует годы жизни 1922–2003.",
          ),
          evidence(
            "Болгарское национальное радио — архив",
            "https://archives.bnr.bg/archives/post/13277/blaga-dimitrova",
            "Архив БНР документирует её поэтическое, романное и эссеистическое творчество и точные даты жизни.",
          ),
        ],
      },
    ],
    reviewer,
    decision: "unchanged",
    notes:
      "Исходный короткий текст полностью подтверждён и не содержит неподдержанного ранжирования. Рекомендация — сохранить birthDate 1922-01-02 и deathDate 2003-05-02. Shared country files не изменялись.",
  },
  {
    key: "bulgaria:elin_pelin",
    originalSha256:
      "ea9e38bf6336ad0e6ccc8f2adab3792023dff5a9cd375286b7ece849c154b178",
    reviewedTextRu:
      "Болгарский прозаик, автор рассказов, сказок и произведений для детей.",
    claims: [
      {
        textRu:
          "Елин Пелин был болгарским прозаиком и писал рассказы, сказки и произведения для детей.",
        verdict: "corrected",
        evidence: [
          evidence(
            "Институт литературы Болгарской академии наук",
            "https://bglitdetska.ilit.bas.bg/author/elin-pelin",
            "Профиль БАН документирует прозу, сказки, стихи и книги Елина Пелина для детей.",
          ),
          evidence(
            "Болгарское национальное радио",
            "https://new.bnr.bg/en/post/100163744/elin-pelin-great-narrator-of-country-life",
            "БНР представляет Елина Пелина как болгарского прозаика и автора рассказов и детских произведений.",
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Неопределённые оценочные слова «классик» и «мастер» заменены перечислением документированных жанров. Рекомендация — сохранить birthDate 1877-07-08 и deathDate 1949-12-03. Shared country files не изменялись.",
  },
  {
    key: "bulgaria:geo_milev",
    originalSha256:
      "6ca10de6846ae4a08f1d53d15f594ec05f5c3b1517819ce1a39e4dbb1f990b4d",
    reviewedTextRu:
      "Болгарский поэт, переводчик и представитель модернизма.",
    claims: [
      {
        textRu:
          "Гео Милев был болгарским поэтом и переводчиком, чьё творчество связано с модернизмом и экспрессионизмом.",
        verdict: "supported",
        evidence: [
          evidence(
            "Дом-музей Гео Милева",
            "https://geomilev.com/geo-milev/",
            "Официальный музей называет Милева болгарским поэтом, связывает его с экспрессионизмом и документирует переводческую работу.",
          ),
          evidence(
            "Болгарское национальное радио",
            "https://old-news.bnr.bg/en/post/100289388/intense-literature-death-is-young-dimcho-debelyanov-hristo-smirnenski-geo-milev",
            "БНР характеризует Милева как поэта и переводчика, модерниста и представителя экспрессионизма.",
          ),
        ],
      },
    ],
    reviewer,
    decision: "unchanged",
    notes:
      "Исходная формулировка подтверждена музеем и национальным радио. Рекомендация — сохранить birthDate 1895-01-15; deathDate следует хранить с учётом источниковой неопределённости после 15 мая 1925 года, а не приписывать недоказанный день смерти. Shared country files не изменялись.",
  },
  {
    key: "bulgaria:hristo_botev",
    originalSha256:
      "38cb69ba6408c83fdcd60a31c0f36239d1823dfea66781e3bb22323e0af7fddf",
    reviewedTextRu:
      "Болгарский поэт, публицист и революционер XIX века, участник национально-освободительного движения.",
    claims: [
      {
        textRu:
          "Христо Ботев был болгарским поэтом, публицистом и революционером XIX века и участвовал в национально-освободительном движении.",
        verdict: "corrected",
        evidence: [
          evidence(
            "Институт литературы Болгарской академии наук",
            "https://ilit.bas.bg/bg/poeziyata-na-hristo-botev",
            "Проект БАН рассматривает поэзию Ботева в контексте его революционной деятельности и болгарского национального освобождения.",
          ),
          evidence(
            "Болгарское национальное радио",
            "https://old-news.bnr.bg/en/post/101476265/song-about-hristo-botev",
            "БНР прямо называет Ботева революционером, поэтом, журналистом и издателем и связывает его с борьбой за национальную свободу.",
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Суперлатив и широкое слово «классик» заменены занятиями и исторической ролью. Рекомендация — сохранить birthDate 1848-01-06; точная deathDate требует календарной оговорки старого/нового стиля. Shared country files не изменялись.",
  },
  {
    key: "bulgaria:ivan_vazov",
    originalSha256:
      "9561c55c53dab694c75067d652a58e444ec71439115031b0c366bb450d75d4ae",
    reviewedTextRu:
      "Болгарский поэт, прозаик и драматург, автор романа «Под игом».",
    claims: [
      {
        textRu:
          "Иван Вазов был болгарским поэтом, прозаиком и драматургом и написал роман «Под игом».",
        verdict: "corrected",
        evidence: [
          evidence(
            "Болгарское национальное телевидение",
            "https://bnt.bg/news/bulgaria-marks-100-years-since-the-death-of-famous-writer-ivan-vazov-298495news.html",
            "БНТ документирует поэтическую, прозаическую и драматургическую работу Вазова и его роман Under the Yoke.",
          ),
          evidence(
            "Болгарское национальное радио",
            "https://old-news.bnr.bg/en/post/101306729/first-ever-edition-of-bulgaria-s-most-emblematic-novel-was-in-english",
            "БНР атрибутирует Ивану Вазову роман Under the Yoke и подтверждает его место в болгарской литературе.",
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Почётное прозвище заменено нейтральными литературными ролями; авторство романа сохранено. Рекомендация — сохранить birthDate 1850-07-09 и deathDate 1921-09-22. Shared country files не изменялись.",
  },
  {
    key: "bulgaria:paisius_hilendar",
    originalSha256:
      "05f12490566b47c2dbbd1f0caf2f61234963d8c21c4b4b9dd178baaa545d2cca",
    reviewedTextRu:
      "Болгарский монах и книжник XVIII века, автор «Истории славяноболгарской», завершённой в 1762 году.",
    claims: [
      {
        textRu:
          "Паисий Хилендарский был болгарским монахом и книжником XVIII века и завершил «Историю славяноболгарскую» в 1762 году.",
        verdict: "corrected",
        evidence: [
          evidence(
            "Национальная библиотека Болгарии",
            "https://www.nationallibrary.bg/www/2022/05/03/paisii-hilendarski/",
            "Национальная библиотека описывает монашескую деятельность Паисия и подтверждает завершение «Истории славяноболгарской» в Зографе в 1762 году.",
          ),
          evidence(
            "Болгарское национальное радио",
            "https://old-news.bnr.bg/en/post/101663099/paisii-hilendarski",
            "БНР представляет Паисия как болгарского монаха и автора «Истории славяноболгарской», завершённой в 1762 году.",
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Оценка ключевости заменена датируемым фактом; национальная и монашеская идентичность сохранены. Рекомендация: birthDate 1722 и deathDate 1773 считать приблизительными — Национальная библиотека прямо описывает их как гипотезы. Shared country files не изменялись.",
  },
  {
    key: "burkina_faso:frederic_titinga_pacere",
    originalSha256:
      "9d8cd9e29c3bc6ebddc80cdb0ab5f1bd37d852677728df8a15de7497182a995d",
    reviewedTextRu:
      "Буркинийский поэт, писатель и исследователь традиционной культуры народа моси.",
    claims: [
      {
        textRu:
          "Фредерик Титинга Пасере был буркинийским поэтом, писателем и исследователем традиционной культуры моси.",
        verdict: "supported",
        evidence: [
          evidence(
            "Музей Манега — фонд Пасере",
            "https://manega.net/index.php/le-fondateur-du-musee/",
            "Профиль основателя музея называет Пасере писателем и исследователем культуры и перечисляет его работы об обычаях, обрядах и обществе моси.",
          ),
          evidence(
            "Académie des sciences d’outre-mer",
            "https://www.academieoutremer.fr/academiciens/?aId=125",
            "Академическая биография называет Пасере писателем и поэтом из центрального Мого и приводит его книги о моси, гриотах и говорящих барабанах.",
          ),
        ],
      },
    ],
    reviewer,
    decision: "unchanged",
    notes:
      "Исходный текст подтверждён двумя профильными институциями. Date recommendation: заменить статус живущего автора и добавить deathDate 2024-11-08; дату подтверждают Académie des sciences d’outre-mer и правительственное сообщение Буркина-Фасо. BirthDate 1943-12-31 подтверждён академией. Shared country files не изменялись.",
  },
  {
    key: "burkina_faso:jean_pierre_guingane",
    originalSha256:
      "d9b8416502af2ebf8340959023c5a296ef8a462f1bc37016c6f0c99d0bca70c4",
    reviewedTextRu:
      "Буркинийский драматург, писатель и театральный деятель.",
    claims: [
      {
        textRu:
          "Жан-Пьер Гингане был буркинийским драматургом, автором и театральным деятелем.",
        verdict: "supported",
        evidence: [
          evidence(
            "Bibliothèque nationale de France",
            "https://catalogue.bnf.fr/ark%3A/12148/cb120545344",
            "Authority-запись BnF идентифицирует Гингане как автора из Буркина-Фасо, драматурга, режиссёра и руководителя Théâtre de la Fraternité.",
          ),
          evidence(
            "UNESCO — International Theatre Institute",
            "https://www.unesco.org/creativity/sites/default/files/medias/fichiers/2023/02/1cp_List%20of%20Participants_en_fr.pdf",
            "Официальный список UNESCO фиксирует Жан-Пьера Гингане как представителя Международного института театра и руководителя его африканской региональной структуры.",
          ),
        ],
      },
    ],
    reviewer,
    decision: "unchanged",
    notes:
      "Исходная нейтральная формулировка полностью подтверждена. Рекомендация — сохранить birthDate 1947-07-11 и deathDate 2011-01-24 по BnF. Shared country files не изменялись.",
  },
  {
    key: "burkina_faso:monique_ilboudo",
    originalSha256:
      "8122d31b311d95217cd61af721540b158d9b73e6912144b17f2d449ad4c36074",
    reviewedTextRu:
      "Буркинийская писательница и юрист, автор романа «Le Mal de peau» и эссе «Droit de cité: être femme au Burkina Faso».",
    claims: [
      {
        textRu:
          "Моник Ильбудо — писательница и юрист из Буркина-Фасо, автор романа Le Mal de peau и эссе Droit de cité: être femme au Burkina Faso.",
        verdict: "corrected",
        evidence: [
          evidence(
            "Organisation internationale de la Francophonie",
            "https://www.francophonie.org/les-membres-du-jury-777",
            "Официальный профиль Франкофонии называет Ильбудо женщиной-писателем и университетским преподавателем права и перечисляет обе книги.",
          ),
          evidence(
            "Bibliothèque nationale de France",
            "https://catalogue.bnf.fr/ark%3A/12148/cb12951897p",
            "Authority-запись BnF подтверждает принадлежность к Буркина-Фасо, занятия писательницы и юриста и атрибутирует ей Le Mal de peau.",
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Неопределённая сравнительная формула о первых женщинах-авторах снята; добавлены профессия и две документированные книги. Рекомендация — сохранить годовой birthDate 1959: точный день институционально не установлен. Shared country files не изменялись.",
  },
  {
    key: "burkina_faso:norbert_zongo",
    originalSha256:
      "af898afe84d8a42f9d09a71ceafc1c7de87be3ef98b0e13e219b2cbf3a2473cf",
    reviewedTextRu:
      "Буркинийский журналист и писатель, автор романов «Le Parachutage» и «Rougbêinga».",
    claims: [
      {
        textRu:
          "Норбер Зонго был буркинийским журналистом и писателем и написал романы Le Parachutage и Rougbêinga.",
        verdict: "corrected",
        evidence: [
          evidence(
            "Bibliothèque nationale de France",
            "https://catalogue.bnf.fr/ark%3A/12148/cb121608482",
            "Authority-запись BnF подтверждает буркинийскую идентичность, работу журналиста и авторство Le Parachutage.",
          ),
          evidence(
            "Université Joseph Ki-Zerbo — ProGRES",
            "https://www.progres.ujkz.gov.bf/publications/8653/afficher",
            "Университетская публикация рассматривает Норбера Зонго как буркинийского писателя и атрибутирует ему роман Rougbêinga.",
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Общая формулировка уточнена двумя романами. Рекомендация — сохранить deathDate 1998-12-13; birthDate лучше хранить как приблизительный 1949, поскольку authority BnF отмечает год вопросительным знаком. Shared country files не изменялись.",
  },
  {
    key: "burkina_faso:patrick_ilboudo",
    originalSha256:
      "ad1c78ca0845a142c283736317735759c03a8846829ef4ddb0d667a4073838e9",
    reviewedTextRu:
      "Буркинийский журналист, новеллист и романист Патрик Гомдаого Ильбудо. Его роман «Le Héraut têtu» получил Grand Prix Afrique в 1992 году.",
    claims: [
      {
        textRu:
          "Патрик Гомдаого Ильбудо был буркинийским журналистом, новеллистом и романистом; Le Héraut têtu отмечен Grand Prix Afrique в 1992 году.",
        verdict: "corrected",
        evidence: [
          evidence(
            "Bibliothèque nationale de France",
            "https://catalogue.bnf.fr/ark%3A/12148/cb12119817x",
            "Authority-запись BnF фиксирует полное имя Patrick Gomdaogo Ilboudo, рождение 18 февраля 1951 года и занятия журналиста, новеллиста и романиста.",
          ),
          evidence(
            "Association des écrivains de langue française",
            "https://adelf.info/historique-grand-prix-afrique/",
            "Официальная история премии называет Patrick G. Ilboudo и Le Héraut têtu лауреатами Grand Prix Afrique 1992 года.",
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Identity recommendation: заменить отображаемое «Патрик-Ив Ильбудо» и fullName Patrick-Ilboudo на «Патрик Гомдаого Ильбудо» / Patrick Gomdaogo Ilboudo; заменить birthDate 1959 на 1951-02-18. Card deathDate 1994 требует отдельной институциональной сверки точного дня. Shared country files не изменялись.",
  },
  {
    key: "burundi:christophe_nkezabahizi",
    originalSha256:
      "2b448345ab6506b1b5232f23be4e6ebb3aea756c0e8936e5f5974e772b410376",
    reviewedTextRu:
      "Литературная идентичность Кристофа Нкезабахизи не установлена; авторитетные источники относят это имя к оператору государственного телевидения Бурунди, погибшему в 2015 году.",
    claims: [
      {
        textRu:
          "Доступные авторитетные источники идентифицируют Кристофа Нкезабахизи как телеоператора RTNB, убитого 13 октября 2015 года, а не как писателя.",
        verdict: "not-established",
        evidence: [
          evidence(
            "UNESCO",
            "https://www.unesco.org/en/articles/director-general-condemns-killing-cameraman-christophe-nkezabahizi-burundi",
            "UNESCO называет Нкезабахизи телевизионным оператором в Бурунди и датирует его гибель 13 октября 2015 года.",
          ),
          evidence(
            "Committee to Protect Journalists",
            "https://cpj.org/data/people/christophe-nkezabahizi/",
            "CPJ независимо идентифицирует его как оператора государственной станции RTNB, погибшего 13 октября 2015 года.",
          ),
        ],
      },
    ],
    reviewer,
    decision: "held",
    notes:
      "Held и identity quarantine recommendation: карточка писателя 1955 года рождения не подтверждена и, вероятно, смешивает личность с телеоператором; не применять биографию, даты или портрет до новой литературной authority-записи. Shared country files не изменялись.",
  },
  {
    key: "burundi:gaetan_muschimyimana",
    originalSha256:
      "95b19f4ed370ff153c4142c44e0a0d04a360ac5f8133070ec2f1f18894b9b312",
    reviewedTextRu:
      "Заявленная карточкой идентичность бурундийского писателя Гаэтана Мушимьиманы не установлена по доступным авторитетным каталогам.",
    claims: [
      {
        textRu:
          "Не найдено authority-записи или библиографии, подтверждающей литературную идентичность Гаэтана Мушимьиманы в Бурунди.",
        verdict: "not-established",
        evidence: [
          evidence(
            "Library of Congress Online Catalog",
            "https://catalog.loc.gov/vwebv/search?searchArg=Gaetan+Muschimyimana&searchCode=GKEY%5E*&searchType=0&recCount=25",
            "Поиск по точному имени не выявил authority-записи либо произведений заявленного писателя.",
          ),
          evidence(
            "WorldCat — OCLC",
            "https://search.worldcat.org/search?q=%22Gaetan%20Muschimyimana%22%20Burundi",
            "Поиск по имени и стране не выявил библиографического корпуса, позволяющего установить личность автора.",
          ),
        ],
      },
    ],
    reviewer,
    decision: "held",
    notes:
      "Held и quarantine recommendation: исходную общую биографию нельзя считать фактом без национального каталога, издательской записи или первичного произведения; дат в карточке нет. Shared country files не изменялись.",
  },
];

function finalizeReviewRecord(
  record: ReviewBase,
): WriterBiographyFactReviewRecord {
  return {
    ...record,
    applicableTextRu: record.decision === "held" ? null : record.reviewedTextRu,
  };
}

export const writerBiographyFactReviewBatch14: readonly WriterBiographyFactReviewRecord[] =
  writerBiographyFactReviewBatch14Base.map(finalizeReviewRecord);
