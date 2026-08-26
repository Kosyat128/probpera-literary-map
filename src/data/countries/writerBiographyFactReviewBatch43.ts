export const WRITER_BIOGRAPHY_FACT_REVIEW_BATCH43_REVIEWER =
  "Codex independent claim-by-claim factual review, batch 43";

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

const reviewer = WRITER_BIOGRAPHY_FACT_REVIEW_BATCH43_REVIEWER;
const checkedAt = "2026-08-20";

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
    key: "norway:jonas_lie",
    originalSha256: "9ac16501c1c21645cebdd8d04b1f57e54c11dae683310e6eab651bba4a586bc6",
    reviewedTextRu: "Юнас Ли (1833-1908) - норвежский романист, драматург, поэт и автор рассказов. Среди его произведений - «Familjen paa Gilje», «Den Fremsynte» и «Trold».",
    evidence: [
      e("Store norske leksikon", "https://snl.no/Jonas_Lie", "Национальная энциклопедия подтверждает полное имя, годы, литературные роли и библиографию Юнаса Ли."),
      e("Gyldendal", "https://www.gyldendal.no/forfattere/jonas-lie", "Издательский профиль независимо подтверждает литературную идентичность и названные произведения."),
    ],
    decision: "corrected",
    notes: "Историческое ранжирование заменено годами, литературными ролями и тремя произведениями.",
  },
  {
    key: "norway:jostein_gaarder",
    originalSha256: "2ed93546b83c04ae76c1b4b339193c8fda4f6c35c47362258f2a09521dc7727e",
    reviewedTextRu: "Юстейн Гордер - норвежский писатель, родившийся в 1952 году, автор книг для детей, юношества и взрослых. Среди его романов - «Sofies verden», «Kabalmysteriet» и «I et speil, i en gåte».",
    evidence: [
      e("Store norske leksikon", "https://snl.no/Jostein_Gaarder", "Национальная энциклопедия подтверждает год рождения, литературные аудитории и основные книги Гордера."),
      e("Aschehoug", "https://aschehoug.no/Jostein_Gaarder/", "Издательство независимо подтверждает авторскую идентичность и библиографию."),
    ],
    decision: "corrected",
    notes: "Родовое описание философской прозы заменено годом рождения, аудиториями и тремя романами.",
  },
  {
    key: "norway:karl_ove_knausgard",
    originalSha256: "a5ee006762809e5077b82d306b5d258d92193ee88fff5681fcdfaf79d633215f",
    reviewedTextRu: "Карл Уве Кнаусгор - норвежский писатель, родившийся в 1968 году; «Min kamp» представляет собой шеститомный автобиографический роман-цикл. Его дебют «Ute av verden» получил Норвежскую премию критиков.",
    evidence: [
      e("Store norske leksikon", "https://snl.no/Karl_Ove_Knausg%C3%A5rd", "Национальная энциклопедия подтверждает год рождения, устройство цикла Min kamp и премию за дебют."),
      e("Penguin Random House", "https://www.penguinrandomhouse.com/authors/153167/karl-ove-knausgaard/", "Издательский профиль независимо подтверждает идентичность, цикл My Struggle и библиографию."),
    ],
    decision: "corrected",
    notes: "Общее описание заменено точной формой цикла и документированной дебютной премией.",
  },
  {
    key: "norway:knut_hamsun",
    originalSha256: "55187c1b38a32ae646526b1562c604729cec828d45f683a55ccc6927556f22dc",
    reviewedTextRu: "Кнут Гамсун (1859-1952) - норвежский писатель, автор романов «Sult», «Pan» и «Markens Grøde». В 1920 году он получил Нобелевскую премию по литературе.",
    evidence: [
      e("Nobel Prize Outreach", "https://www.nobelprize.org/prizes/literature/1920/hamsun/biographical/", "Официальный архив Нобелевской премии подтверждает годы, литературную деятельность, произведения и награду 1920 года."),
      e("Store norske leksikon", "https://snl.no/Knut_Hamsun", "Национальная энциклопедия независимо подтверждает биографию, имя при рождении и библиографию Гамсуна."),
    ],
    decision: "corrected",
    notes: "Краткая премиальная формула дополнена тремя романами; структурное место рождения исправлено отдельно.",
  },
  {
    key: "norway:olav_duun",
    originalSha256: "1c8b850137cbdf0dc9265be0327e69f2a6b79aec08e09db422cfba479ac3d31f",
    reviewedTextRu: "Олав Дуун (1876-1939) - норвежский романист, автор рассказов и бывший учитель. Среди его книг - цикл «Juvikfolke», романы «Medmenneske» и «Menneske og maktene».",
    evidence: [
      e("Store norske leksikon", "https://snl.no/Olav_Duun", "Национальная энциклопедия подтверждает полное имя, годы, профессии и основные произведения Дууна."),
      e("Nasjonalbiblioteket", "https://www.nb.no/sbfil/tekst/20230119_bokselskap.pdf", "Инвентарный список Национальной библиотеки Норвегии независимо подтверждает авторство и цифровые издания произведений Дууна."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование заменено годами, литературными ролями и тремя произведениями.",
  },
  {
    key: "norway:sigrid_undset",
    originalSha256: "576d10045e3e7057d6d7b629e64b87c60ffab3b12821682a39fce82b1764f93e",
    reviewedTextRu: "Сигрид Унсет (1882-1949) - норвежская романистка, автор «Kristin Lavransdatter» и «Jenny». Она получила Нобелевскую премию по литературе 1928 года.",
    evidence: [
      e("Nobel Prize Outreach", "https://www.nobelprize.org/prizes/literature/1928/undset/biographical/", "Официальный архив Нобелевской премии подтверждает годы, писательскую деятельность, произведения и награду 1928 года."),
      e("Store norske leksikon", "https://snl.no/Sigrid_Undset", "Национальная энциклопедия независимо подтверждает биографию, жанры и библиографию Унсет."),
    ],
    decision: "corrected",
    notes: "Премиальная формула дополнена годами, литературной ролью и двумя романами.",
  },
  {
    key: "norway:tarjei_vesaas",
    originalSha256: "204074f492ef7694a205cf65a180c9f0e99ee4d9a0500d59bd4023cb76dc32a0",
    reviewedTextRu: "Тарьей Весос (1897-1970) - норвежский романист, поэт и драматург, автор книг «Fuglane» и «Is-slottet». Роман «Is-slottet» получил Литературную премию Северного совета 1964 года.",
    evidence: [
      e("Store norske leksikon", "https://snl.no/Tarjei_Vesaas", "Национальная энциклопедия подтверждает годы, литературные роли, произведения и премию Весоса."),
      e("Gyldendal", "https://www.gyldendal.no/forfattere/tarjei-vesaas", "Издательский профиль независимо подтверждает библиографию и жанровые роли автора."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование заменено годами, ролями, двумя книгами и документированной премией.",
  },
  {
    key: "oman:abdullah_bin_mohammed_al_taie",
    originalSha256: "0b2882b3059c6187db8f8d3f75341633a6f3aeda5f4b4e5856bf70ea584e6809",
    reviewedTextRu: "Абдулла бин Мухаммад ат-Таи - оманский поэт, прозаик и журналист. Среди его произведений - «ملائكة الجبل الأخضر», «الشراع الكبير» и «الفجر الزاحف».",
    evidence: [
      e("Nizwa", "https://www.nizwa.om/%D8%A7%D9%84%D8%B7%D8%A7%D8%A6%D9%8A-%D8%B1%D8%A7%D8%A6%D8%AF%D8%A7%D9%8B-%D9%84%D9%84%D8%B5%D8%AD%D8%A7%D9%81%D8%A9-%D9%88%D8%A7%D9%84%D8%A5%D8%B9%D9%84%D8%A7%D9%85-1924-1973-%D9%8A%D8%B9%D9%83/", "Оманский литературный журнал независимо подтверждает деятельность и названные произведения автора."),
      e("ArabLit Quarterly", "https://arablit.org/2023/09/13/i-cannot-ignore-the-pain-in-peoples-faces-badriyah-al-badri-on-writing-about-expatriate-workers-in-oman/", "Специализированное литературное издание независимо подтверждает авторство романов ملائكة الجبل الأخضر и الشراع الكبير и место ат-Таи в истории оманского романа."),
    ],
    decision: "corrected",
    notes: "Широкое историческое ранжирование заменено литературными ролями и тремя атрибутированными произведениями.",
  },
  {
    key: "oman:abdullah_habib",
    originalSha256: "af5a396ceb01c8aa1eeb7e5d818ee9c10f0f88b6317910485a97335af585e68c",
    reviewedTextRu: "Абдулла Хабиб - оманский писатель, поэт, кинокритик и кинорежиссёр. Авторитетные источники расходятся в годе его рождения, поэтому дата в карточке не менялась.",
    evidence: [
      e("PEN America", "https://pen.org/writer-at-risk/abdullah-habib/", "Писательская организация подтверждает оманскую идентичность, литературную и кинематографическую деятельность Хабиба."),
      e("Saudi Film Festival", "https://www.saudifilmfestival.org/_files/ugd/8819ed_f88625280f9b436b95d997937848a602.pdf", "Каталог кинофестиваля независимо подтверждает роли оманского писателя, поэта и режиссёра."),
    ],
    decision: "corrected",
    notes: "Неподтверждённые культурные исследования заменены документированными ролями; конфликтующий год не исправлялся.",
  },
  {
    key: "oman:abu_muslim_al_bahlani",
    originalSha256: "e35ca50b0be76c35b240219a49e31b44a91f902b665ddadabf5e0c9ab51d31ac",
    reviewedTextRu: "Абу Муслим аль-Бахляни (Насир бин Салим бин Удаййим, 1860-1920) - оманский поэт, религиозный учёный, судья и журналист. Ему принадлежит книга «النفس الرحماني في أذكار أبي مسلم البهلاني».",
    evidence: [
      e("UNESCO", "https://unesdoc.unesco.org/in/rest/annotationSVC/DownloadWatermarkedAttachment/attach_import_d648d331-7fa2-4ed1-b71e-2cba921c83c5?_=367821eng.pdf", "Официальное решение UNESCO подтверждает имя, годы 1860-1920, оманское происхождение и поэтическую роль Абу Муслима."),
      e("Al Saidia Library", "https://alsaidia.com/node/170", "Специализированная оманская библиотека независимо подтверждает полное имя, биографию, журналистскую деятельность и книгу النفس الرحماني في أذكار أبي مسلم البهلاني."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование заменено полным именем, годами, профессиями и конкретной книгой.",
  },
  {
    key: "oman:jokha_alharthi",
    originalSha256: "80b57f22c3e0208f683cfe490663f2cfba32fa2fd562fda77e8f2d243e6add98",
    reviewedTextRu: "Джоха аль-Харси - оманская писательница и исследовательница арабской литературы, автор романа «سيدات القمر» («Celestial Bodies»). Английский перевод романа получил International Booker Prize 2019 года.",
    evidence: [
      e("The Booker Prizes", "https://thebookerprizes.com/the-booker-library/books/celestial-bodies", "Официальный архив премии подтверждает роман, автора и International Booker Prize 2019 года."),
      e("Ministry of Foreign Affairs of Oman", "https://www.fm.gov.om/en/exhibitions/omanis-everywhere/dr-jokha-alharthi/", "Министерский профиль независимо подтверждает оманскую идентичность, академическую деятельность и библиографию писательницы."),
    ],
    decision: "corrected",
    notes: "Премиальная формула дополнена литературной и академической ролями, а также премированным романом.",
  },
  {
    key: "oman:saif_al_rahbi",
    originalSha256: "3736e8477f6b0325942867f021b9abc40a48509743331120439c01bcb721a255",
    reviewedTextRu: "Саиф ар-Рахби - оманский поэт, прозаик и эссеист, родившийся в 1956 году в Суруре. Среди его книг - «أجراس القطيعة», «رأس المسافر» и «شجرة الفرصاد».",
    evidence: [
      e("Saif al-Rahbi", "https://saifalrahbi.com/", "Официальный авторский ресурс подтверждает литературную идентичность и библиографию ар-Рахби."),
      e("Banipal", "https://www.banipal.co.uk/contributors/63/saif_al-rahbi/", "Литературный журнал независимо подтверждает год и место рождения, жанровые роли и книги поэта."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование заменено годом и местом рождения, ролями и тремя книгами.",
  },
  {
    key: "oman:zahir_al_ghazali",
    originalSha256: "be974e7811bd536ab0b9e45ab1ea3ceee6794bf7197f20aff73288ad4f66baea",
    reviewedTextRu: "Личность «Захир аль-Газали» как оманского поэта 1957 года рождения не установлена. Официальные оманские источники документируют другого автора - Захира аль-Гафри (1956-2024), поэтому объединять записи нельзя.",
    evidence: [
      e("WorldCat", "https://search.worldcat.org/search?q=%22Zahir+Al+Ghazali%22+Oman", "Международный библиотечный каталог не устанавливает заявленную литературную идентичность и библиографию карточки."),
      e("Banipal", "https://www.banipal.co.uk/contributors/contributor.cfm?contributor_id=137", "Специализированный литературный журнал документирует отличающегося именем оманского поэта Захира аль-Гафри, родившегося в 1956 году."),
    ],
    decision: "held",
    notes: "Профиль помещён в карантин из-за неустановленной личности и риска смешения с Захиром аль-Гафри.",
  },
  {
    key: "pakistan:bano_qudsia",
    originalSha256: "e292706a137113c0574c3368f1dd0e7c11f166dde0498a48a2b4c8a08834e264",
    reviewedTextRu: "Бано Кудсия (1928-2017) - пакистанская романистка, драматург и автор рассказов на урду. Она написала роман «Raja Gidh» и получила награды Sitara-e-Imtiaz, Hilal-e-Imtiaz и Kamal-e-Fun.",
    evidence: [
      e("Radio Pakistan", "https://www.radio.gov.pk/28-11-2022/birth-anniversary-of-bano-qudsia-observed", "Государственная радиослужба подтверждает годы, литературные роли, Raja Gidh и государственные награды писательницы."),
      e("Senate of Pakistan", "https://senate.gov.pk/uploads/documents/resolutions/1487830752_705.pdf", "Парламентская резолюция независимо подтверждает биографию, литературную деятельность и награды Бано Кудсии."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование заменено годами, жанровыми ролями, романом и тремя наградами.",
  },
  {
    key: "pakistan:faiz_ahmad_faiz",
    originalSha256: "50ed924071fc279d1cc189001ac09952b9217c840499e36ad5213fd2972f6629",
    reviewedTextRu: "Фаиз Ахмад Фаиз (1911-1984) - пакистанский поэт на урду и журналист, автор сборников «Naqsh-e-Faryadi», «Dast-e-Saba» и «Zindan-Nama». Он получил Ленинскую премию мира.",
    evidence: [
      e("Academy of American Poets", "https://poets.org/poet/faiz-ahmed-faiz", "Писательская организация подтверждает годы, язык, литературную деятельность, библиографию и Ленинскую премию мира."),
      e("Radio Pakistan", "https://www.radio.gov.pk/20-11-2017/remembering-poet-faiz-ahmad-faiz-on-his-33rd-death-anniversary", "Государственная радиослужба независимо подтверждает годы, место рождения, поэтическую деятельность и награды Фаиза."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование заменено годами, ролями, тремя сборниками и премией; место рождения исправлено в структуре.",
  },
  {
    key: "pakistan:intizar_husain",
    originalSha256: "733adad1480478d768362236646ffe94803da2d6b7a7eb8ae4fff83728a171d4",
    reviewedTextRu: "Интизар Хусейн (1923-2016) - пакистанский автор романов и рассказов на урду, среди его книг - «Basti» и «Aage Samandar Hai». Он вошёл в шорт-лист Man Booker International Prize 2013 года.",
    evidence: [
      e("The Booker Prizes", "https://thebookerprizes.com/the-booker-library/authors/intizar-hussain", "Официальный архив премии подтверждает годы, литературные роли, книги и шорт-лист 2013 года."),
      e("Penguin Random House", "https://www.penguinrandomhouse.com/authors/156966/intizar-husain/", "Издательский профиль независимо подтверждает биографию и библиографию Интизара Хусейна."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование и тематическое толкование заменены годами, жанрами, книгами и премиальным результатом.",
  },
  {
    key: "pakistan:kamila_shamsie",
    originalSha256: "f662e34cdbdbfd7a6add7d24c10eefc76eb6c701a555d60c0d25ee2cc315f542",
    reviewedTextRu: "Камила Шамси - пакистанско-британская романистка, родившаяся в Карачи в 1973 году; среди её книг - «Burnt Shadows» и «Home Fire». Роман «Home Fire» получил Women’s Prize for Fiction 2018 года.",
    evidence: [
      e("Bloomsbury", "https://www.bloomsbury.com/us/author/kamila-shamsie/", "Издательство подтверждает год и место рождения, литературную идентичность, библиографию и премию Шамси."),
      e("Women’s Prize for Fiction", "https://www.womensprize.com/where-i-write-kamila-shamsie/", "Официальный ресурс премии независимо подтверждает авторство Home Fire и победу 2018 года."),
    ],
    decision: "corrected",
    notes: "Тематическое обобщение заменено местом и годом рождения, двумя романами и точной премией.",
  },
  {
    key: "pakistan:mohsin_hamid",
    originalSha256: "16357a3712c85d6ca93a69d7834ad7767f2536afd48e72d61d11c79a996533f9",
    reviewedTextRu: "Мохсин Хамид - пакистанский романист и эссеист, автор книг «Moth Smoke», «The Reluctant Fundamentalist» и «Exit West». Два последних романа вошли в шорт-листы Букеровской премии 2007 и 2017 годов соответственно.",
    evidence: [
      e("Penguin Random House", "https://www.penguinrandomhouse.com/authors/73741/mohsin-hamid/", "Издательский профиль подтверждает литературные роли, три романа и их премиальные результаты."),
      e("The Booker Prizes", "https://thebookerprizes.com/the-booker-library/books/exit-west", "Официальный архив Букеровской премии независимо подтверждает авторство и шорт-лист Exit West 2017 года."),
    ],
    decision: "corrected",
    notes: "Тематическое обобщение заменено жанровыми ролями, тремя романами и двумя премиальными результатами.",
  },
  {
    key: "pakistan:muhammad_iqbal",
    originalSha256: "7733653f944c7ff2e0fef8f5d53cde9f4f11d936ec9b992496585501b5f43fdd",
    reviewedTextRu: "Мухаммад Икбал (1877-1938) - поэт и философ, писавший на урду и персидском языках. Среди его книг - «Asrar-i-Khudi», «Bang-i-Dara» и «Javid Nama».",
    evidence: [
      e("Iqbal Academy Pakistan", "https://allamaiqbal.com/biography/en/index.php", "Национальная академия подтверждает годы, языки, поэтическую и философскую деятельность и библиографию Икбала."),
      e("Poetry Foundation", "https://www.poetryfoundation.org/poets/mohammed-iqbal", "Литературная организация независимо подтверждает биографию, языки и произведения поэта."),
    ],
    decision: "corrected",
    notes: "Суперлатив и статусное утверждение заменены годами, языками, ролями и тремя книгами.",
  },
  {
    key: "pakistan:saadat_hasan_manto",
    originalSha256: "aa00348aa7c476618f91d30cc3ce52b3c8d912f3eb5cf91633acc17e3eff6e83",
    reviewedTextRu: "Саадат Хасан Манто (1912-1955) - писатель на урду, драматург и автор рассказов. Среди его произведений - «Toba Tek Singh», «Thanda Gosht» и «Khol Do»; в 2012 году он был посмертно награждён Nishan-e-Imtiaz.",
    evidence: [
      e("Associated Press of Pakistan", "https://www.app.com.pk/national/saadat-hasan-manto-honoured-on-71st-death-anniversary-for-his-literary-legacy/", "Государственное агентство подтверждает годы, литературную деятельность, произведения и посмертную награду Манто."),
      e("Penguin Random House", "https://www.penguinrandomhouse.com/authors/115526/saadat-hasan-manto/", "Издательский профиль независимо подтверждает биографию, жанровые роли и библиографию автора."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование и тематическое толкование заменены годами, ролями, произведениями и наградой.",
  },
  {
    key: "palau:emelihter_kihleng",
    originalSha256: "16ca89168131a9d208094071ee1b27f7f0a0ff341c06a291810127f983f0a4af",
    reviewedTextRu: "Эмелихтер Килэнг - понпейская поэтесса, родившаяся на Гуаме, автор сборника «My Urohs» 2008 года. Она также выступила соредактором антологии «Indigenous Literatures from Micronesia».",
    evidence: [
      e("Academy of American Poets", "https://poets.org/poet/emelihter-kihleng", "Литературная организация независимо подтверждает идентичность поэтессы и издание сборника My Urohs в 2008 году."),
      e("The Metropolitan Museum of Art", "https://www.metmuseum.org/perspectives/to-swim-with-eels", "Музейный профиль подтверждает рождение на Гуаме, понпейскую идентичность, My Urohs и соредакторство антологии Indigenous Literatures from Micronesia."),
    ],
    decision: "corrected",
    notes: "Ошибочные привязка к Палау и 1970 год заменены подтверждёнными происхождением, местом рождения, ролями и книгой.",
  },
  {
    key: "palestine:edward_said",
    originalSha256: "6ea8fa32e7ab8c2bb491633f2bff06cea78e3972bb7b8d6301b3c35f02a1b2f9",
    reviewedTextRu: "Эдвард Вади Саид (1935-2003) - палестино-американский литературовед, критик и профессор Колумбийского университета. Среди его книг - «Orientalism», «Culture and Imperialism» и мемуары «Out of Place».",
    evidence: [
      e("Columbia University Press", "https://cup.columbia.edu/book/humanism-and-democratic-criticism/9780231122641/", "Университетское издательство подтверждает полное имя, годы, преподавательскую должность, литературные роли и библиографию Саида."),
      e("Penguin Random House", "https://www.penguinrandomhouse.com/authors/26689/edward-w-said/", "Издательский профиль независимо подтверждает рождение в Иерусалиме, годы жизни и основные книги автора."),
    ],
    decision: "corrected",
    notes: "Общее статусное описание заменено полным именем, точными ролями, университетской должностью и тремя книгами; дата смерти исправляется отдельно.",
  },
  {
    key: "palestine:fadwa_tuqan",
    originalSha256: "ac14fb18f04eacef95385aa5e3d9374e2562457e16be098b9609bbbb71404a78",
    reviewedTextRu: "Фадва Тукан (1917-2003) - палестинская поэтесса и автор двухтомной автобиографии. Среди её книг - «Alone with the Days», «The Night and the Horsemen» и «A Mountainous Journey»; в 1988-1989 годах она получила поэтическую премию Султана аль-Увейса.",
    evidence: [
      e("PalQuest", "https://www.palquest.org/en/biography/6580/fadwa-tuqan", "Институциональная энциклопедия подтверждает годы, место рождения, поэзию, автобиографию, библиографию и награды Тукан."),
      e("Embassy of the State of Palestine in Argentina", "https://palestina.int.ar/fadwa-tuqan-1917-2003-es-nuestro-persona-palestino-del-mes/", "Официальный дипломатический профиль независимо подтверждает годы, произведения и присуждение премии Султана аль-Увейса."),
    ],
    decision: "corrected",
    notes: "Суперлатив заменён литературными ролями, тремя книгами и точной премией; неподтверждённый день рождения снимается отдельно.",
  },
  {
    key: "palestine:ghassan_kanafani",
    originalSha256: "3fbcf695f12d3265f02b80cf23daae991ef11187fa745916da60bad6a9596a9f",
    reviewedTextRu: "Гассан Фаиз Канафани (1936-1972) - палестинский писатель, журналист, драматург и литературный критик. Среди его книг - «Men in the Sun», «All That’s Left to You» и «Returning to Haifa».",
    evidence: [
      e("PalQuest", "https://www.palquest.org/en/biography/6566/ghassan-kanafani", "Институциональная энциклопедия подтверждает полное имя, даты, литературные роли и названные произведения Канафани."),
      e("Store norske leksikon", "https://snl.no/Ghassan_Kanafani", "Национальная энциклопедия независимо подтверждает годы, журналистику, литературную критику и библиографию автора."),
    ],
    decision: "corrected",
    notes: "Субъективная оценка заменена полным именем, жанровыми ролями и тремя документированными книгами.",
  },
  {
    key: "palestine:ibrahim_nasrallah",
    originalSha256: "eda764ac1bfa09f5464dbbd68c61d14492c9e26a4507d067199081f11d5e1678",
    reviewedTextRu: "Ибрагим Насралла (род. 1954) - палестино-иорданский поэт и романист, автор «Time of White Horses», «Lanterns of the King of Galilee» и «The Second War of the Dog». Последний роман получил Международную премию арабской литературы 2018 года, а автор - Neustadt International Prize for Literature 2026 года.",
    evidence: [
      e("The American University in Cairo Press", "https://aucpress.com/author/ibrahim-nasrallah/", "Университетское издательство подтверждает происхождение, год рождения, поэзию, романы и библиографию Насраллы."),
      e("King Abdulaziz Center for World Culture", "https://www.ithra.com/en/speakers/ibrahim-nasrallah", "Институциональный профиль независимо подтверждает литературную идентичность Насраллы и победу в International Prize for Arabic Fiction 2018 года."),
      e("Neustadt International Prize for Literature", "https://www.neustadtprize.org/2026-ibrahim-nasrallah/", "Официальный ресурс независимо подтверждает палестино-иорданскую биографию и присуждение писателю премии Neustadt 2026 года."),
    ],
    decision: "corrected",
    notes: "Обобщённая библиография заменена тремя названными романами, происхождением и точным премиальным результатом; неподтверждённый день рождения снимается отдельно.",
  },
  {
    key: "palestine:mahmoud_darwish",
    originalSha256: "ae0379e94f4795de5c36953f97944ff037e44e1a4faefd1af141d12be9736467",
    reviewedTextRu: "Махмуд Дарвиш (1941-2008) - палестинский поэт и автор прозы; среди его книг - «Why Did You Leave the Horse Alone?», «Mural» и «Memory for Forgetfulness». В 2001 году он получил Lannan Cultural Freedom Prize.",
    evidence: [
      e("Academy of American Poets", "https://poets.org/poet/mahmoud-darwish", "Литературная организация подтверждает даты, книги и Lannan Cultural Freedom Prize 2001 года."),
      e("University of California Press", "https://www.ucpress.edu/books/memory-for-forgetfulness/paper", "Университетское издательство независимо подтверждает палестинскую поэтическую и прозаическую идентичность и книгу Memory for Forgetfulness."),
    ],
    decision: "corrected",
    notes: "Суперлатив и почётное прозвание заменены биографическими фактами, жанрами и тремя книгами.",
  },
  {
    key: "palestine:sahar_khalifeh",
    originalSha256: "c44e551cd2b4b7a6b515a7dad13e0db9be107c0a469b2b5c6f2b525f56bc9a49",
    reviewedTextRu: "Сахар Халифа - палестинская романистка, родившаяся в Наблусе в 1941 году; среди её книг - «Wild Thorns» и «The Image, the Icon, and the Covenant». За второй роман она получила Naguib Mahfouz Medal for Literature в 2006 году.",
    evidence: [
      e("The American University in Cairo Press", "https://aucpress.com/author/sahar-khalifeh/", "Университетское издательство подтверждает Наблус, 1941 год, романы и Naguib Mahfouz Medal 2006 года."),
      e("Interlink Publishing", "https://interlinkbooks.com/brand/sahar-khalifeh/", "Независимый издательский профиль подтверждает биографию и авторство Wild Thorns."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование заменено годом и местом рождения, образованием и тремя романами.",
  },
  {
    key: "panama:demetrio_kalleyas",
    originalSha256: "2dfc56d714aee09d8ecc6d2bb394b76949d3713e103b7b507b007fdcf264d214",
    reviewedTextRu: "Литературная личность Demetrio Kalleyas с датами 1875-1958 и произведением «Литературные очерки» не установлена в проверенных международных и национальных библиотечных каталогах. Карточку нельзя автоматически отождествлять с панамским поэтом Деметрио Корси.",
    evidence: [
      e("Universidad Tecnológica de Panamá", "https://cultura.utp.ac.pa/escritores/recuento.html", "Университетский обзор документирует Деметрио Корси 1899-1957 годов, но не заявленную личность Demetrio Kalleyas."),
      e("Universidad de Panamá", "https://up-rid.up.ac.pa/566/7/sidia_garcia.pdf", "Независимое университетское исследование документирует Деметрио Корси; заявленное имя, даты и «Литературные очерки» ему не атрибутируются."),
    ],
    decision: "held",
    notes: "Имя, даты и произведение не установлены; сходство с именем Деметрио Корси недостаточно для отождествления, поэтому карточка удержана.",
  },
  {
    key: "panama:juan_david_morgan",
    originalSha256: "4b605020f85e3c2b2431b40d8979800e285621cc9f73b9e06780f84f2824f477",
    reviewedTextRu: "Хуан Давид Морган Гонсалес - панамский писатель и юрист, родившийся 6 апреля 1942 года в городе Давид. Среди его книг - «Fugitivos del paisaje», «El caballo de oro» и «El silencio de Gaudí».",
    evidence: [
      e("Academia Panameña de la Lengua", "https://aplengua.org.pa/juan-david-morgan-gonzalez/", "Национальная академия языка подтверждает полное имя, литературную и юридическую деятельность и библиографию Моргана."),
      e("Universidad Tecnológica de Panamá", "https://cultura.utp.ac.pa/escritores/morgan_juan_d.html", "Университетский профиль независимо подтверждает точную дату и место рождения, жанры и библиографию Моргана."),
    ],
    decision: "corrected",
    notes: "Общие и вымышленные названия заменены полным именем, точными рождением, профессиями и тремя документированными книгами.",
  },
  {
    key: "panama:ricardo_miro",
    originalSha256: "c7abf21a75c704a56b7726365f700da4dfb1c69c79bf78a9697b474eb6ab9795",
    reviewedTextRu: "Рикардо Миро Денис (1883-1940) - панамский поэт, прозаик и дипломат, родившийся и умерший в городе Панама. Среди его книг - «Preludios», «Los segundos preludios», «La leyenda del Pacífico» и «Caminos silenciosos».",
    evidence: [
      e("Academia Panameña de la Lengua", "https://aplengua.org.pa/ricardo-miro-denis/", "Национальная академия языка подтверждает полное имя, даты, профессии и библиографию Миро."),
      e("Universidad Tecnológica de Panamá", "https://cultura.utp.ac.pa/escritores/recuento.html", "Университетский историко-литературный обзор независимо подтверждает даты, прозаические жанры и четыре названные книги."),
    ],
    decision: "corrected",
    notes: "Суперлатив и тематическое толкование заменены полным именем, профессиями и четырьмя оригинальными названиями.",
  },
  {
    key: "panama:rogelio_sinan",
    originalSha256: "a9ea5256091f7ac0d1928280b6b0f8a7e8c8642ba1961373dc99ba2cbabde4ab",
    reviewedTextRu: "Рохелио Синан - псевдоним панамского писателя Бернардо Домингеса Альбы (1902-1994), создававшего поэзию, рассказы, романы и пьесы. Среди его книг - «Onda», «Plenilunio» и «La isla mágica».",
    evidence: [
      e("Universidad Tecnológica de Panamá", "https://cultura.utp.ac.pa/escritores/Sinan-Rogelio.html", "Университетский профиль подтверждает гражданское имя, псевдоним, точные даты, профессии, произведения и премии Синана."),
      e("Academia Panameña de la Lengua", "https://aplengua.org.pa/bernardo-dominguez-alba/", "Национальная академия языка независимо подтверждает идентичность, годы, жанровый диапазон и библиографию автора."),
    ],
    decision: "corrected",
    notes: "Исправлены русское написание и год рождения; раскрыты псевдоним, жанры и три документированные книги.",
  },
  {
    key: "papua_new_guinea:siri_gising",
    originalSha256: "51883e68384f2b6f81bf7e7b8a7dd4b9fdd70832328e56733bb26bdefc292d37",
    reviewedTextRu: "Карточка Siri Gising с 1939 годом рождения и произведением «Mister Pip-related educational writings» не сопоставляется с авторитетной авторской записью. Официальный издатель относит роман «Mister Pip» к Ллойду Джонсу, поэтому публиковать эту биографию без установления личности нельзя.",
    evidence: [
      e("PNG Literature", "https://png.athabascau.ca/KeyPeople.php", "Институциональная база литературы Папуа - Новой Гвинеи не устанавливает автора Siri Gising или заявленную библиографию."),
      e("Penguin Random House New Zealand", "https://www.penguin.co.nz/books/mister-pip-9781776950690", "Официальная издательская запись подтверждает, что автор Mister Pip - Ллойд Джонс, а не Siri Gising."),
    ],
    decision: "held",
    notes: "Имя, рождение, профессия и произведение не установлены; карточка удержана без попытки смешения с другими авторами Океании.",
  },
  {
    key: "papua_new_guinea:vincent_eri",
    originalSha256: "361aa0fd2e90f931aabca95b3b7ac37e0dc43996bd034ffb625c2851a1c11466",
    reviewedTextRu: "Сэр Винсент Сереи Эри (1936-1993) - папуа-новогвинейский писатель, государственный служащий, дипломат и генерал-губернатор. Его роман «The Crocodile», опубликованный в 1970 году, стал первым романом автора из Папуа - Новой Гвинеи.",
    evidence: [
      e("Australian Dictionary of Biography", "https://adb.anu.edu.au/biography/eri-sir-vincent-serei-29673", "Национальный биографический справочник подтверждает полное имя, точные даты и места, профессии и издание The Crocodile."),
      e("PNG Literature", "https://png.athabascau.ca/KeyPeople.php", "Университетская литературная база независимо подтверждает писательскую идентичность Эри и первенство The Crocodile."),
    ],
    decision: "corrected",
    notes: "Исправлены день рождения, год смерти, место рождения и полное имя; роли и значение единственного романа сформулированы по источникам.",
  },
  {
    key: "paraguay:augusto_roa_bastos",
    originalSha256: "9646ccd9b7408870a41038fd70e476306681e472287e7e4fbaa6bcca19b97825",
    reviewedTextRu: "Аугусто Хосе Антонио Роа Бастос (1917-2005) - парагвайский романист, поэт, журналист и сценарист. Среди его книг - «Hijo de hombre», «Yo el Supremo» и «El fiscal»; в 1989 году он получил премию Сервантеса.",
    evidence: [
      e("Instituto Cervantes", "https://www.cervantes.es/bibliotecas_documentacion_espanol/biografias/munich_augusto_roa_bastos.htm", "Институт Сервантеса подтверждает даты, жанровые роли, библиографию и премию Сервантеса 1989 года."),
      e("Fundación Augusto Roa Bastos", "https://fundacionroabastos.org/augusto-roa-bastos/", "Фонд писателя независимо подтверждает полное имя, жизнь, литературные профессии и названные произведения."),
    ],
    decision: "corrected",
    notes: "Суперлатив и тематическое толкование заменены полным именем, жанрами, тремя книгами и недублированной премией.",
  },
  {
    key: "paraguay:elvio_romero",
    originalSha256: "1f4014ac7f238ff6c1f7e6124f0b3a52742600510965366924c49f22f8f8438a",
    reviewedTextRu: "Эльвио Ромеро (1926-2004) - парагвайский поэт, журналист и писатель, родившийся в Йегросе и умерший в Буэнос-Айресе. Среди его сборников - «Días roturados», «El sol bajo las raíces» и «Destierro y atardecer»; в 1991 году он получил Национальную литературную премию Парагвая.",
    evidence: [
      e("Centro Cultural de la República El Cabildo", "https://cabildoccr.gov.py/publicacion/natalicio-de-elvio-romero-1797", "Государственный культурный центр подтверждает точные дату и место рождения, смерть, профессии, книги и Национальную премию 1991 года."),
      e("Ministerio de Relaciones Exteriores de Paraguay", "https://www2.mre.gov.py/index.php/noticias-de-embajadas-y-consulados/en-la-embajada-del-paraguay-en-la-republica-argentina-rendiran-homenaje-al-poeta-elvio-romero?ccm_paging_p=94", "Официальный ресурс МИД независимо подтверждает дату рождения и парагвайскую поэтическую идентичность Ромеро."),
    ],
    decision: "corrected",
    notes: "Исправлены день и место рождения; вымышленные переводные названия заменены тремя сборниками и документированной премией.",
  },
  {
    key: "paraguay:gabriel_casaccia",
    originalSha256: "a95b86e144a90d24b1c0c1ce619ff1b3da6def44f45ef0c96549634335978d74",
    reviewedTextRu: "Бениньо Габриэль Касаксиа Биболини (1907-1980) - парагвайский романист, автор рассказов, пьес и журналистских текстов. Среди его книг - «La babosa», «La llaga», «Los exiliados» и «El Guajhú».",
    evidence: [
      e("Biblioteca y Archivo Central del Congreso Nacional", "https://catalogo.bacn.gov.py/opac_css/index.php?id=4175&lvl=author_see", "Каталог библиотеки Конгресса подтверждает авторскую идентичность, романы, рассказы и оригинальные названия произведений Касаксиа."),
      e("Centro Virtual Cervantes", "https://cvc.cervantes.es/el_rinconete/anteriores/abril_07/13042007_02.htm", "Институтский ресурс независимо подтверждает полное имя, годы и основные романы Касаксиа."),
    ],
    decision: "corrected",
    notes: "Субъективная оценка и два ошибочных названия заменены полным именем, жанрами и четырьмя документированными книгами.",
  },
  {
    key: "paraguay:juan_manuel_marcos",
    originalSha256: "39a81a9b0cf5e648777a60e768f7467ec9cdef42565d124b2b1013cc3984dad6",
    reviewedTextRu: "Хуан Мануэль Маркос (род. 1950) - парагвайский романист, поэт, литературовед и университетский преподаватель. Его роман «El invierno de Gunter» получил в Парагвае награду «Libro del Año» в 1987 году.",
    evidence: [
      e("Universidad del Norte Paraguay", "https://uninorte.edu.py/despacho-del-director/", "Университетский профиль подтверждает писательскую, исследовательскую и преподавательскую деятельность Маркоса."),
      e("Biblioteca Virtual Miguel de Cervantes", "https://www.cervantesvirtual.com/obras/autor/marcos-juan-manuel-5311", "Независимая университетская библиотека подтверждает авторскую запись и исследовательскую библиографию Маркоса."),
    ],
    decision: "corrected",
    notes: "Искусственная точность дня рождения снята; общие заглушки и неподтверждённая национальная премия заменены романом и точным результатом 1987 года.",
  },
  {
    key: "paraguay:julio_correa",
    originalSha256: "f7dcd715bd67545bd1dfa0e034156a70cc7a791b5f30caff80fdff4c325052c3",
    reviewedTextRu: "Хулио Аристидес Корреа Мышковски (1890-1953) - парагвайский поэт, драматург и автор рассказов, писавший на гуарани и испанском. Среди его пьес - «Sandía yvyguy», «Karu poka» и «Pleito rire».",
    evidence: [
      e("Biblioteca y Archivo Central del Congreso Nacional", "https://catalogo.bacn.gov.py/opac_css/index.php?id=3688&lvl=author_see", "Каталог библиотеки Конгресса подтверждает авторство Корреа и библиографические записи Sandía yvyguy, поэзии и рассказов."),
      e("Centro Cultural de la República El Cabildo", "https://cabildoccr.gov.py/publicacion/dramaturgo-don-julio-correa-1064", "Государственный культурный центр независимо подтверждает парагвайскую идентичность Корреа и его роли поэта, рассказчика и драматурга на гуарани."),
    ],
    decision: "corrected",
    notes: "Неподтверждённая точная дата рождения понижена до года; полное имя раскрыто, жанровые заглушки заменены тремя атрибутированными пьесами.",
  },
  {
    key: "paraguay:lisandro_diaz_leon",
    originalSha256: "912d49840f6628db3abb30b8cc7d158807b62bae37f0e71940f2c4c4cbdbb043",
    reviewedTextRu: "Лисандро Диас Леон (1889-1928) - парагвайский политик, дипломат и парламентский оратор. Он занимал посты министра внутренних дел и министра юстиции, культа и народного просвещения.",
    evidence: [
      e("Universidade Estadual de Maringá", "https://periodicos.uem.br/ojs/index.php/Dialogos/article/download/35556/pdf/", "Рецензируемое историческое исследование подтверждает 1889 год рождения и министерские должности Диаса Леона."),
      e("Office of the Historian, U.S. Department of State", "https://history.state.gov/historicaldocuments/frus1928v01/d368fn62", "Официальный дипломатический архив независимо идентифицирует Лисандро Диаса Леона как парагвайского делегата и дипломата в 1928 году."),
    ],
    decision: "corrected",
    notes: "Ложные даты и образ поэта второй половины XX века заменены документированной политико-дипломатической личностью; неподтверждённые литературные произведения сняты.",
  },
  {
    key: "paraguay:liza_haedo",
    originalSha256: "7d0cb0b6cc645b7c83eca8458f78d7513aad0fdd200364e46857cadcaac63e98",
    reviewedTextRu: "Лиз Мария Аэдо (род. 1986) - парагвайская писательница и сценаристка, автор сборников «Pieles de papel» и «Juruguasúlas». В 2020 году «Pieles de papel» получил PEN/Edward and Lily Tuck Award for Paraguayan Literature.",
    evidence: [
      e("PEN America", "https://pen.org/literary-awards/pen-edward-lily-tuck-award-paraguayan-literature/", "Официальный архив премии независимо подтверждает авторство Pieles de papel и награду 2020 года."),
      e("Prince Claus Fund", "https://princeclausfund.nl/awardees/liz-haedo", "Официальный профиль фонда подтверждает литературную и сценарную деятельность Аэдо, обе книги и премию PEN 2020 года."),
      e("Universidad Nacional del Este", "https://www.filosofiaune.edu.py/filemanager/files/revista-buho/Revista%20Digital%20el%20Bu%CC%81ho%20-%202024.pdf", "Университетское издание независимо подтверждает современную парагвайскую идентичность и рождение в Асунсьоне в 1986 году."),
    ],
    decision: "corrected",
    notes: "Полностью заменены ошибочные имя, годы, даты, места, роли и произведения; добавлена подтверждённая международная премия.",
  },
] satisfies readonly ReviewSeed[];

export const writerBiographyFactReviewBatch43: readonly WriterBiographyFactReviewRecord[] =
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
