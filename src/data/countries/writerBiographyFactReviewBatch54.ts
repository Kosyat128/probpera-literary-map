export const WRITER_BIOGRAPHY_FACT_REVIEW_BATCH54_REVIEWER =
  "Codex independent claim-by-claim factual review, batch 54";

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

const reviewer = WRITER_BIOGRAPHY_FACT_REVIEW_BATCH54_REVIEWER;
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
    key: "ukraine:valerii_shevchuk",
    originalSha256: "ef734a007836cd881df6f81b9dbe99bc1f5413777b59a023b7413214b01c368f",
    reviewedTextRu: "Валерий Шевчук (1939-2025) - украинский писатель, литературовед и исследователь украинской литературы барокко, автор романа-баллады «Дом на горе». Он умер 6 мая 2025 года в Киеве.",
    evidence: [
      e("Львовский национальный университет имени Ивана Франко", "https://lnu.edu.ua/vidiyshov-u-vichnist-pochesnyy-doktor-lvivskoho-universytetu-valeriy-shevchuk/", "Университетский некролог сообщает, что Валерий Шевчук умер 6 мая 2025 года, и называет его писателем, литературоведом, историком и исследователем украинского барокко."),
      e("Internet Encyclopedia of Ukraine, Canadian Institute of Ukrainian Studies", "https://www.encyclopediaofukraine.com/display.asp?linkpath=pages%5CS%5CH%5CShevchukValerii.htm", "Университетская энциклопедия подтверждает даты 20 августа 1939 - 6 мая 2025, смерть в Киеве и роман Dim na hori («Дом на горе»)."),
    ],
    decision: "corrected",
    notes: "Слово «современный» стало фактически неверным после смерти автора; добавлены проверенные занятия, произведение и дата смерти.",
  },
  {
    key: "uruguay:carlos_reyles",
    originalSha256: "658a1fb3ea64d42957c85789f3417b8531e843af7f6857a10f64d98b6b4c359c",
    reviewedTextRu: "Карлос Рейлес (1868-1938) - уругвайский романист и эссеист. Среди его произведений - «Beba», «La raza de Caín» и «El terruño».",
    evidence: [
      e("Национальная библиотека Уругвая", "https://bibliotecadigital.bibna.gub.uy/jspui/bitstream/123456789/1098/6/003-reyles_c.pdf", "Биобиблиографический материал Национальной библиотеки указывает рождение 30 октября 1868 года и перечисляет произведения Beba, La raza de Caín и El terruño."),
      e("Autores.uy", "https://autores.uy/autor/311", "Национальная база уругвайских авторов подтверждает даты жизни Рейлеса и его деятельность в области художественной прозы."),
    ],
    decision: "corrected",
    notes: "Удалено субъективное ранжирование; дата рождения исправлена с 30 марта на 30 октября 1868 года, а неточные названия заменены библиографически подтверждёнными.",
  },
  {
    key: "uruguay:claudia_amenedo",
    originalSha256: "90ab7d9a80d62877ab9a96fe14bd36c2cec3cb2fdfba9c53fce06038aa38628c",
    reviewedTextRu: "Клаудия Аменгуаль (род. 1969, Монтевидео) - уругвайская писательница, переводчица и преподаватель литературы. Её роман «Desde las cenizas» получил премию Сор Хуаны Инес де ла Крус в 2006 году.",
    evidence: [
      e("Министерство образования и культуры Уругвая", "https://www.gub.uy/ministerio-educacion-cultura/sites/ministerio-educacion-cultura/files/2020-07/catalogo-books-from-uruguay-2013_0.pdf", "Официальный каталог называет Claudia Amengual переводчицей и выпускницей литературного факультета, перечисляет её романы и премию за Desde las cenizas."),
      e("Jacksonville University", "https://www.ju.edu/spanish/latinoture/autores/claudia-amengual.php", "Университетская справка подтверждает имя Claudia Amengual, рождение в Монтевидео в 1969 году, образование, преподавание и библиографию."),
    ],
    decision: "corrected",
    notes: "Карточка была повреждена: фамилия, место рождения и названия книг не соответствовали установленной личности. Искусственная дата 01-01 понижена до доказанного года.",
  },
  {
    key: "uruguay:eduardo_galeano",
    originalSha256: "d55fb52b4903b3ad627568a95427d6e8c25e67daf9c3c31082542ce5c8c51182",
    reviewedTextRu: "Эдуардо Галеано (1940-2015) - уругвайский писатель и журналист. Среди его книг - «Las venas abiertas de América Latina», трилогия «Memoria del fuego» и «El libro de los abrazos».",
    evidence: [
      e("Архив Университета Республики, Уругвай", "https://archivosdocumentales.udelar.edu.uy/index.php/actor/browse?page=17&sort=alphabetic&sortDir=desc", "Архивная запись подтверждает рождение Галеано 3 сентября 1940 года, смерть 13 апреля 2015 года и его журналистскую работу."),
      e("Historias Universitarias, Universidad de la República", "https://historiasuniversitarias.edu.uy/biografia/hughes-galeano-eduardo-german-maria/", "Университетская биография подтверждает даты и места жизни, занятие писательством и журналистикой, а также библиографию автора."),
    ],
    decision: "corrected",
    notes: "Субъективные формулы о мировом уровне и известности заменены занятиями и проверяемой библиографией; ошибочное название «Вена истории» удалено.",
  },
  {
    key: "uruguay:emilio_frugoni",
    originalSha256: "092bb47d1f5920ccb2357fbf1d57d9c3407b1284ec676f582b039c0437ae2943",
    reviewedTextRu: "Эмилио Фругони (1880-1969) - уругвайский поэт, эссеист, журналист, юрист и политический деятель. Среди его книг - «Los himnos», «Poemas montevideanos» и «La esfinge roja».",
    evidence: [
      e("Autores.uy", "https://autores.uy/autor/606", "База подтверждает полное имя Emilio Frugoni Queirolo, даты 30 марта 1880 - 28 августа 1969 и занятия поэзией, журналистикой, политикой и социологией."),
      e("Академия литературы при Министерстве образования и культуры Уругвая", "https://www.gub.uy/ministerio-educacion-cultura/academia-nacional-letras/emilio-frugoni", "Официальная академическая справка описывает Фругони как поэта, эссеиста, юриста и политика и приводит его библиографию."),
    ],
    decision: "corrected",
    notes: "Неточная транслитерация фамилии и родовые обозначения произведений заменены установленным именем и названиями книг.",
  },
  {
    key: "uruguay:felisberto_hernandez",
    originalSha256: "ba585876110bd9c0c55f8098f9cdc56f962b035832833df9aabe7de89e5a6357",
    reviewedTextRu: "Фелисберто Эрнандес (1902-1964) - уругвайский писатель и пианист. К его прозе относятся «El caballo perdido», «Nadie encendía las lámparas», «Las hortensias» и «El cocodrilo».",
    evidence: [
      e("Архив Фелисберто Эрнандеса, Национальная библиотека Уругвая", "https://archivofelisbertohernandez.bibna.gub.uy/", "Национальный архив подтверждает годы 1902-1964, работу Эрнандеса как писателя и пианиста и основные этапы публикации его прозы."),
      e("Кабильдо Монтевидео", "https://cabildo.montevideo.gub.uy/sites/cabildo.montevideo.gub.uy/files/articulos/descargas/biografias_escritoras_escritores.pdf", "Официальный биографический сборник перечисляет El caballo perdido, Nadie encendía las lámparas, La casa inundada и El cocodrilo."),
    ],
    decision: "corrected",
    notes: "Оценочное ранжирование и интерпретации заменены документированными занятиями и библиографией; неточное название произведения устранено.",
  },
  {
    key: "uruguay:horacio_quiroga",
    originalSha256: "e5f610f3e46eb1506c4f40ba05e53d61fe53b80294c5a9470542495924b0c41c",
    reviewedTextRu: "Хорасио Кирога (1878-1937) - уругвайский писатель, драматург и поэт, значительную часть жизни проведший в Аргентине. Среди его книг - «Cuentos de amor de locura y de muerte», «Cuentos de la selva» и «Anaconda».",
    evidence: [
      e("Библиотека парламента Уругвая", "https://omeka.parlamento.gub.uy/omeka-s/s/biobibliografias/item/3423", "Парламентская биобиблиография подтверждает даты и места жизни Кироги, его литературные занятия и перечень произведений."),
      e("Министерство образования и культуры Уругвая", "https://www.gub.uy/ministerio-educacion-cultura/sites/ministerio-educacion-cultura/files/2020-07/catalogoliteratura-ij_mec_0.pdf", "Официальный литературный каталог подтверждает уругвайское происхождение Кироги и книги Cuentos de la selva и другие его рассказы."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование, недоказанная формула об основании жанра и психологические обобщения заменены биографией и названиями книг.",
  },
  {
    key: "uruguay:idea_vilarino",
    originalSha256: "a0382d7c9d1b9646046c23ddff4a05de25d75f695ea53ca86e39edbae33a742b",
    reviewedTextRu: "Идеа Вилариньо (1920-2009) - уругвайская поэтесса, эссеистка, литературный критик, переводчица и преподавательница, связанная с «Поколением 45». Среди её книг - «Nocturnos», «Poemas de amor» и «Pobre mundo».",
    evidence: [
      e("Библиотека парламента Уругвая", "https://omeka.parlamento.gub.uy/omeka-s/s/biobibliografias/item/3438", "Биобиблиография подтверждает даты жизни, занятия Вилариньо, её связь с Поколением 45 и названия поэтических книг."),
      e("Министерство образования и культуры Уругвая", "https://www.gub.uy/ministerio-educacion-cultura/politicas-y-gestion/idea-vilarino", "Официальная страница подтверждает деятельность Вилариньо как поэтессы, критика, переводчицы и преподавательницы."),
    ],
    decision: "corrected",
    notes: "Широкое утверждение о культурном влиянии заменено проверяемыми занятиями и принадлежностью к поколению; родовые и неточные названия книг исправлены.",
  },
  {
    key: "uruguay:javier_de_viana",
    originalSha256: "0ee0912291d051e1cb61a99dde85d571cb53bf9219edf727c53dcec404c037fe",
    reviewedTextRu: "Хавьер де Виана (1868-1926) - уругвайский писатель и журналист, изображавший сельскую жизнь и гаучо. Среди его книг - «Campo», «Gaucha» и «Gurí».",
    evidence: [
      e("Академия литературы при Министерстве образования и культуры Уругвая", "https://www.gub.uy/ministerio-educacion-cultura/academia-nacional-letras/sillones-academicos/javier-viana", "Официальная академическая справка подтверждает годы жизни, деятельность писателя и журналиста и его обращение к сельской тематике."),
      e("Autores.uy", "https://autores.uy/autor/668", "Национальная база подтверждает даты Хавьера де Вианы и библиографические названия Campo, Gaucha и Gurí."),
    ],
    decision: "corrected",
    notes: "Убрана недоказанная формула об основании реалистической традиции; названия произведений приведены по библиографии.",
  },
  {
    key: "uruguay:jose_enrique_rodo",
    originalSha256: "7465ea0265040b2e7ed8f1d8840fc32cbaf22ab832146edd812b14594b2a4afb",
    reviewedTextRu: "Хосе Энрике Родо (1871-1917) - уругвайский эссеист, литературный критик, преподаватель и политик. Его книги включают «Ariel», «Motivos de Proteo» и «El mirador de Próspero».",
    evidence: [
      e("Академия литературы при Министерстве образования и культуры Уругвая", "https://www.gub.uy/ministerio-educacion-cultura/academia-nacional-letras/jose-enrique-rodo", "Официальная справка подтверждает даты, преподавательскую и политическую деятельность Родо и его основные книги."),
      e("Библиотека парламента Уругвая", "https://omeka.parlamento.gub.uy/omeka-s/s/biobibliografias/item/3436", "Парламентская биобиблиография приводит произведения Ariel, Motivos de Proteo и El mirador de Próspero."),
    ],
    decision: "corrected",
    notes: "Оценочное ранжирование и широкое утверждение о влиянии заменены фактами; исправлены опечатка в русском имени и смешение Протея с Прометеем.",
  },
  {
    key: "uruguay:juan_carlos_onetti",
    originalSha256: "c8df9a8705be3b909100290207fa5867b9b254454dee340dd0e7dffa722b6b3b",
    reviewedTextRu: "Хуан Карлос Онетти (1909-1994) - уругвайский писатель, автор романов «El pozo», «La vida breve» и «El astillero»; в «La vida breve» впервые появляется вымышленный город Санта-Мария. В 1980 году он получил премию Сервантеса.",
    evidence: [
      e("Министерство культуры Испании", "https://www.cultura.gob.es/premiado/mostrarDetalleAction.do?cache=init&id=1007219&language=es&layout=premiadoFicha&prev_layout=premiadoResultado", "Официальная карточка премии Сервантеса подтверждает годы жизни, роман La vida breve, создание Санта-Марии и награждение в 1980 году."),
      e("Национальная библиотека Уругвая", "https://catalogoarchivoliterario.bibna.gub.uy/index.php/onetti-juan-carlos?sf_culture=es", "Архивное описание подтверждает даты жизни Онетти и состав его литературного фонда."),
    ],
    decision: "corrected",
    notes: "Субъективные оценки и недоказанная формула о влиянии заменены проверяемыми произведениями, литературным пространством Санта-Марии и премией.",
  },
  {
    key: "uruguay:mario_benedetti",
    originalSha256: "f1f7cd2fe1d5dc5f09fe59008f3dc23de4a06c8de8d44aa1bf28e812298c0ecb",
    reviewedTextRu: "Марио Бенедетти (1920-2009) - уругвайский писатель, поэт, журналист и критик, участник «Поколения 45». Среди его книг - «La tregua», «Montevideanos» и «Poemas de la oficina».",
    evidence: [
      e("Национальная администрация государственного образования Уругвая", "https://uruguayeduca.anep.edu.uy/sites/default/files/exelearning/06-2026/14627/biografa_del_autor.html", "Учебный ресурс ANEP подтверждает годы жизни, литературные занятия Бенедетти, принадлежность к Поколению 45 и основные книги."),
      e("Фонд Марио Бенедетти", "https://fundacionmariobenedetti.uy/", "Официальный фонд подтверждает идентичность автора, его литературное наследие и сохранение корпуса произведений."),
    ],
    decision: "corrected",
    notes: "Оценочные формулировки заменены биографическими фактами; названия произведений приведены в проверенной форме.",
  },
  {
    key: "uruguay:mario_levrero",
    originalSha256: "7ec46aff834fa899c507c828c1cb5a950ddde434ef088f14929e3aa5874a5227",
    reviewedTextRu: "Марио Левреро - литературное имя уругвайского писателя Хорхе Марио Варлотты Левреро (1940-2004). Среди его книг - «La ciudad», «El discurso vacío» и посмертно изданная «La novela luminosa».",
    evidence: [
      e("Журнал Национального автономного университета Мексики", "https://www.revistadelauniversidad.mx/articles/72a43c8e-2e35-45e4-ac5c-e5f6b2a79436/un-perfil-de-mario-levrero", "Университетская публикация указывает полное зарегистрированное имя Jorge Mario Varlotta Levrero, годы жизни и литературный псевдоним."),
      e("Autores.uy", "https://autores.uy/autor/652", "Национальная авторская база подтверждает варианты имени, даты жизни и библиографию Левреро."),
    ],
    decision: "corrected",
    notes: "Уточнено полное зарегистрированное имя и убраны субъективные характеристики; произведения приведены в оригинальном написании.",
  },
  {
    key: "uruguay:mauricio_rosencof",
    originalSha256: "99dede03fcb87ff1a93949f9a332def7112887a1ff021baf6c0690e17f26aae4",
    reviewedTextRu: "Маурисио Росенкоф (род. 30 июня 1933 года во Флориде, Уругвай) - уругвайский писатель, драматург, журналист и поэт. После ареста в 1972 году он провёл двенадцать лет в заключении; среди его книг - «Memorias del Calabozo» и «Las cartas que no llegaron».",
    evidence: [
      e("Президентство Уругвая", "https://www.gub.uy/presidencia/comunicacion/noticias/presidente-orsi-asistio-homenaje-junta-departamental-montevideo-mauricio", "Официальная публикация подтверждает дату и место рождения, занятия Росенкофа, арест в 1972 году, двенадцать лет заключения и названия книг."),
      e("Национальный университет Ла-Платы", "https://sedici.unlp.edu.ar/bitstream/handle/10915/162166/Documento_completo.pdf-PDFA.pdf?isAllowed=y&sequence=1", "Университетское исследование подтверждает биографический контекст заключения Росенкофа и книгу Memorias del Calabozo."),
    ],
    decision: "corrected",
    notes: "Исправлено место рождения, очищены недоказанные координаты и заменены оценочные формулировки проверяемыми фактами.",
  },
  {
    key: "uruguay:silvia_lago",
    originalSha256: "bd359d35cdd580c4a51304c9263762687db428f446136ca9520c08cb67a1592b",
    reviewedTextRu: "Сильвия Лаго (род. 20 ноября 1932 года в Монтевидео) - уругвайская писательница, литературный критик и преподавательница; до 2005 года она руководила кафедрой уругвайской и латиноамериканской литературы в Университете Республики. Её книги включают «Trajano», «Detrás del rojo» и «La última razón».",
    evidence: [
      e("Библиотека парламента Уругвая", "https://omeka.parlamento.gub.uy/omeka-s/s/biobibliografias/item/3445", "Парламентская биобиблиография приводит полное имя Sylvia Lago Carzolio, дату и место рождения, академическую карьеру и основные книги."),
      e("Университет Республики", "https://www.colibri.udelar.edu.uy/jspui/bitstream/20.500.12008/9270/1/Panisello%2C%20Claudia.pdf", "Университетский репозиторий подтверждает писательскую и критическую деятельность Сильвии Лаго и контекст её произведений."),
    ],
    decision: "corrected",
    notes: "Исправлена искусственная дата 1 января на документированную дату 20 ноября, уточнено полное имя и убраны недоказанные координаты.",
  },
  {
    key: "usa:andy_weir",
    originalSha256: "2845dc87f4c686ebb548234ef80a565f78afb090406d58dd73edcc8a9080c699",
    reviewedTextRu: "Энди Вейр - американский писатель-фантаст, автор романов «The Martian», «Artemis» и «Project Hail Mary». До литературной карьеры он около двух десятилетий работал программистом.",
    evidence: [
      e("Официальный сайт Энди Вейра", "https://andyweirauthor.com/", "Официальная биография подтверждает карьеру программиста и авторство The Martian, Artemis и Project Hail Mary."),
      e("Penguin Random House", "https://www.penguinrandomhouse.com/authors/184612/andy-weir/", "Издательская карточка подтверждает профессию писателя и библиографию Вейра."),
    ],
    decision: "corrected",
    notes: "Рекламные оценки заменены проверяемыми сведениями об образовании, прежней работе и опубликованных романах.",
  },
  {
    key: "usa:anne_bradstreet",
    originalSha256: "c34451e4df9a401576504a45ccec96f43796ff51976c953b74b0fd15e1273eb6",
    reviewedTextRu: "Энн Брэдстрит (ок. 1612-1672) - родившаяся в Англии поэтесса Массачусетской колонии. Её сборник «The Tenth Muse Lately Sprung Up in America» был издан в Лондоне в 1650 году.",
    evidence: [
      e("Государственный департамент США", "https://www.govinfo.gov/content/pkg/GOVPUB-S20-PURL-gpo2329/pdf/GOVPUB-S20-PURL-gpo2329.pdf", "Правительственное издание указывает приблизительный 1612 год рождения, 1672 год смерти и лондонское издание The Tenth Muse в 1650 году."),
      e("Университет Торонто", "https://rpo.library.utoronto.ca/poets/bradstreet-anne", "Университетская справка датирует рождение примерно 1612-1613 годами, связывает Брэдстрит с Нортгемптонширом и описывает сборник The Tenth Muse."),
    ],
    decision: "corrected",
    notes: "Точность спорного года рождения снижена до приблизительной, а субъективная оценка заменена фактом первой публикации сборника.",
  },
  {
    key: "usa:benjamin_franklin",
    originalSha256: "c04f75b7e26bef2337f920b0b45a68ee7104511eb16f4f6040930f73dcafa440",
    reviewedTextRu: "Бенджамин Франклин (1706-1790) - американский печатник, писатель, учёный, дипломат и государственный деятель. Он издавал «Poor Richard’s Almanack» и входил в Комитет пяти, готовивший Декларацию независимости США.",
    evidence: [
      e("Библиотека Конгресса США", "https://www.loc.gov/collections/benjamin-franklin-papers/articles-and-essays/timeline/", "Хронология Библиотеки Конгресса подтверждает даты жизни, издательскую, научную, дипломатическую и политическую деятельность Франклина и Poor Richard’s Almanack."),
      e("Национальный архив США", "https://www.archives.gov/founding-docs/declaration-history", "Национальный архив перечисляет Франклина среди пяти членов комитета, назначенного для подготовки Декларации независимости."),
    ],
    decision: "corrected",
    notes: "Обобщённое ранжирование заменено конкретными занятиями и документированным участием в подготовке Декларации независимости.",
  },
  {
    key: "usa:blaine_harden",
    originalSha256: "12c4c2dd1f7d8ab1a23b682768aa44f8a875b27d7e4d571f7bb4c81fbaf61040",
    reviewedTextRu: "Блейн Харден - американский журналист и автор документальных книг, написавший «Escape from Camp 14» на основе рассказа северокорейца Син Дон Хёка. В 2015 году Харден сообщил, что Син существенно изменил даты, места и другие части своего рассказа.",
    evidence: [
      e("Официальный сайт Блейна Хардена", "https://blaineharden.com/escape-from-camp-14-reviews/", "Авторская публикация фиксирует признание Син Дон Хёка в изменении важных частей рассказа и уточняет характер исправлений."),
      e("Penguin Random House", "https://www.penguinrandomhouse.com/books/307766/escape-from-camp-14-by-blaine-harden/", "Издательская карточка подтверждает авторство Хардена и то, что книга построена вокруг рассказа Син Дон Хёка."),
    ],
    decision: "corrected",
    notes: "Ключевое позднее уточнение достоверности источника добавлено явно; прежняя безоговорочная передача спорной биографии устранена.",
  },
  {
    key: "usa:blake_crouch",
    originalSha256: "9b97c857c9940b0e60527067778356fba6c2bfff399769692ccf41f53f9f6e34",
    reviewedTextRu: "Блейк Крауч - американский писатель и сценарист, автор романов «Dark Matter», «Recursion», «Upgrade» и трилогии «Wayward Pines». Он создал телевизионную адаптацию «Dark Matter» и выступил её сценаристом и шоураннером.",
    evidence: [
      e("Официальный сайт Блейка Крауча", "https://blakecrouch.com/", "Официальная библиография подтверждает романы Dark Matter, Recursion, Upgrade и серию Wayward Pines."),
      e("Apple TV+ Press", "https://www.apple.com/tv-pr/news/2022/03/apple-tv-announces-dark-matter-series-adaptation-with-joel-edgerton-set-to-star/", "Официальный пресс-релиз Apple подтверждает, что Крауч создал сериал Dark Matter и выступил его сценаристом и шоураннером."),
    ],
    decision: "corrected",
    notes: "Рекламные характеристики заменены проверяемыми названиями книг и ролью автора в телевизионной адаптации.",
  },
  {
    key: "usa:bob_dylan",
    originalSha256: "70b3f9a65ff3b22c1d1e5c4b7e23f0e6f8b9f79f07ed3c63902872148fd94add",
    reviewedTextRu: "Боб Дилан (род. 1941) - американский автор песен, музыкант и писатель. В 2016 году ему присудили Нобелевскую премию по литературе.",
    evidence: [
      e("Нобелевская премия", "https://www.nobelprize.org/nobel_prizes/literature/laureates/2016/bio-bibl.html", "Официальная биобиблиография подтверждает год рождения, занятия Дилана и Нобелевскую премию по литературе 2016 года."),
      e("Библиотека Конгресса США", "https://lcweb2.loc.gov/static/programs/national-recording-preservation-board/documents/Freewheelin-Bob-Dylan_Thomson.pdf", "Материал Национального реестра звукозаписей подтверждает авторскую и исполнительскую деятельность Боба Дилана."),
    ],
    decision: "corrected",
    notes: "Субъективное описание масштаба влияния заменено подтверждёнными занятиями и фактом присуждения Нобелевской премии.",
  },
  {
    key: "usa:chuck_palahniuk",
    originalSha256: "54d829c15320db69b6889cc7a1ea92e1ae0ec8063a2904a6d5a95a974903397c",
    reviewedTextRu: "Чак Паланик (род. 1962) - американский романист и автор документальной прозы. Его книги включают «Fight Club», «Invisible Monsters» и «Choke».",
    evidence: [
      e("Орегонская энциклопедия", "https://www.oregonencyclopedia.org/articles/palahniuk_chuck_1962_/", "Академический ресурс подтверждает имя Chuck Palahniuk, год рождения и романы Fight Club, Invisible Monsters и Choke."),
      e("Penguin Random House", "https://www.penguinrandomhouse.com/authors/23091/chuck-palahniuk/", "Издательская карточка подтверждает профессию автора и библиографию Паланика."),
    ],
    decision: "corrected",
    notes: "Публичное авторское имя отделено от полного имени; оценочные тематические характеристики заменены библиографическими фактами.",
  },
  {
    key: "usa:colson_whitehead",
    originalSha256: "dbcc4448a4da0da72007e1c71fc77388f9cc7c06c0cf30dd0c31d388873c7f0c",
    reviewedTextRu: "Колсон Уайтхед (род. 1969) - американский романист. Он получил Пулитцеровские премии за романы «The Underground Railroad» в 2017 году и «The Nickel Boys» в 2020 году.",
    evidence: [
      e("Пулитцеровская премия", "https://www.pulitzer.org/winners/colson-whitehead", "Официальная карточка подтверждает победы Уайтхеда с The Underground Railroad в 2017 году и The Nickel Boys в 2020 году."),
      e("Фонд Макартуров", "https://www.macfound.org/fellows/class-of-2002/colson-whitehead", "Профиль фонда подтверждает год рождения, профессию романиста и раннюю библиографию Уайтхеда."),
    ],
    decision: "corrected",
    notes: "Оценка положения автора заменена двумя точно атрибутированными наградами и названиями романов.",
  },
  {
    key: "usa:cormac_mccarthy",
    originalSha256: "1ffc5830a87519546c2ef1b8c785e789da377ef465aefb83631781ceb17931c0",
    reviewedTextRu: "Кормак Маккарти (1933-2023) - американский романист и драматург, автор «Blood Meridian», «No Country for Old Men» и «The Road». Роман «The Road» получил Пулитцеровскую премию 2007 года.",
    evidence: [
      e("Пулитцеровская премия", "https://www.pulitzer.org/winners/cormac-mccarthy", "Официальная карточка подтверждает присуждение премии 2007 года роману The Road и авторство Маккарти."),
      e("Университет штата Техас", "https://docs.gato.txst.edu/343597/McCarthy_Cormac-091.pdf", "Архивная справка университета подтверждает годы жизни, занятия романиста и драматурга и перечисленные произведения."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование заменено жанрами, произведениями и документированной Пулитцеровской премией.",
  },
  {
    key: "usa:dan_brown",
    originalSha256: "09e08098b982ec4ca32fc6aa007cc4ee153d33ae4f91f951dc03729c955c0953",
    reviewedTextRu: "Дэн Браун - американский писатель, автор романа «The Da Vinci Code» и цикла о Роберте Лэнгдоне, в который также входят «Angels & Demons», «The Lost Symbol», «Inferno» и «Origin».",
    evidence: [
      e("Официальный сайт Дэна Брауна", "https://danbrown.com/about/", "Официальная биография подтверждает авторство The Da Vinci Code и других романов о Роберте Лэнгдоне."),
      e("Penguin Random House", "https://global.penguinrandomhouse.com/tag/dan-brown/", "Официальный сайт издательской группы подтверждает библиографию Дэна Брауна и состав цикла о Лэнгдоне."),
    ],
    decision: "corrected",
    notes: "Рекламное определение «интеллектуальные триллеры» и оценка известности заменены проверяемой библиографией серии.",
  },
  {
    key: "usa:dan_simmons",
    originalSha256: "3836d6ce71f03eb8e450f34479017e6a40f2f6b48b33fd8f9a4e41acacca7933",
    reviewedTextRu: "Дэн Симмонс (4 апреля 1948 - 21 февраля 2026) - американский писатель, работавший в научной фантастике, хорроре, фэнтези и исторической прозе. Он написал цикл «Hyperion Cantos» и романы «The Terror» и «Song of Kali».",
    evidence: [
      e("Macmillan Publishers", "https://us.macmillan.com/author/dansimmons/", "Официальная карточка издателя указывает годы 1948-2026, жанры и книги Hyperion, The Terror и Song of Kali."),
      e("Penguin Random House", "https://www.penguinrandomhouse.com/authors/28431/dan-simmons/", "Издательская биография независимо подтверждает, что Симмонс умер в 2026 году, и перечисляет его произведения."),
      e("Writers Guild of America", "https://www.wga.org/news-events/news/in-memoriam", "Официальный список In Memoriam Гильдии сценаристов США указывает даты жизни 4 апреля 1948 - 21 февраля 2026 года."),
      e("Dignity Memorial / Ahlberg Funeral Chapel", "https://www.dignitymemorial.com/obituaries/longmont-co/daniel-simmons-12758871", "Семейный некролог похоронного дома независимо подтверждает рождение 4 апреля 1948 года и смерть 21 февраля 2026 года."),
    ],
    decision: "corrected",
    notes: "Даты рождения и смерти уточнены по официальному мемориальному списку Гильдии сценаристов США и семейному некрологу; библиография расширена без оценочных формулировок.",
  },
  {
    key: "usa:daniel_keyes",
    originalSha256: "a0ed033668ecf04ec2208e924954fbdf914b75c6fb4fd472d9dbe3c88e3731da",
    reviewedTextRu: "Дэниел Киз (1927-2014) - американский писатель и преподаватель творческого письма, автор «Flowers for Algernon» и документальной книги «The Minds of Billy Milligan». «Flowers for Algernon» получил премию «Небьюла» как роман.",
    evidence: [
      e("Университет Огайо", "https://media.library.ohio.edu/digital/collection/archives/id/43496/", "Архив университета подтверждает годы жизни, преподавательскую работу Киза и произведения Flowers for Algernon и The Minds of Billy Milligan."),
      e("Science Fiction and Fantasy Writers Association", "https://sfwa.org/2014/06/17/memoriam-daniel-keyes-1927-2014/", "Профессиональная ассоциация подтверждает даты 1927-2014, смерть 15 июня 2014 года и премию «Небьюла» за Flowers for Algernon."),
    ],
    decision: "corrected",
    notes: "Биография дополнена датами жизни и основным художественным произведением; неточное русское переименование документальной книги заменено оригинальным названием.",
  },
  {
    key: "usa:dean_koontz",
    originalSha256: "13921d36c74c5087f49979c155b451632250bee9a1c21a28e40814946c24d12a",
    reviewedTextRu: "Дин Кунц - американский романист, публикующий триллеры, хоррор и фантастическую прозу. Среди его книг - «False Memory», цикл «Odd Thomas» и серия о Джейн Хок.",
    evidence: [
      e("Penguin Random House", "https://www.penguinrandomhouse.com/authors/16127/dean-koontz/", "Издательская биография подтверждает занятия Кунца, его жанры, False Memory и цикл Odd Thomas."),
      e("Simon & Schuster", "https://www.simonandschuster.com/authors/Dean-Koontz/256755223", "Независимый издательский профиль подтверждает профессию романиста и серию книг о Джейн Хок."),
    ],
    decision: "corrected",
    notes: "Убрана общая рекламная характеристика и добавлены проверенные серии произведений в оригинальном написании.",
  },
  {
    key: "usa:dennis_lehane",
    originalSha256: "cfaa0d6a0161eb0e6e02ef67d10b0ff510f3c2aa657600f4bd3c7d907b7861af",
    reviewedTextRu: "Деннис Лихэйн - американский романист и сценарист. Он написал романы «Mystic River», «Shutter Island» и «Gone, Baby, Gone», позднее экранизированные.",
    evidence: [
      e("Официальный сайт Денниса Лихэйна", "https://dennislehane.com/about-dennis/", "Официальная биография подтверждает занятия романиста и сценариста и авторство Mystic River, Shutter Island и Gone, Baby, Gone."),
      e("Бостонский колледж", "https://www.bc.edu/content/bc-web/bcnews/news-archive-2011-to-2015/chronicle/2015/features/for-him--writing-a-matter-of-passion.html", "Университетская публикация подтверждает литературную карьеру Лихэйна и экранизации его романов."),
    ],
    decision: "corrected",
    notes: "Широкая жанровая характеристика заменена проверяемыми произведениями и фактом их экранизации.",
  },
  {
    key: "usa:don_delillo",
    originalSha256: "092618c20b012a611e5a433abbb70c8f848b8b1cc77efc3e539d6a56c56a9615",
    reviewedTextRu: "Дон Делилло (род. 1936) - американский романист, драматург и автор рассказов. «White Noise» получил Национальную книжную премию в 1985 году, а «Libra» и «Underworld» стали её финалистами в 1988 и 1997 годах соответственно.",
    evidence: [
      e("Библиотека Конгресса США", "https://www.loc.gov/programs/poetry-and-literature/prizes/fiction-prize/item/n79059951/don-delillo/", "Официальный профиль подтверждает год рождения, занятия Делилло и его основные романы."),
      e("National Book Foundation", "https://www.nationalbook.org/people/don-delillo/", "Фонд подтверждает победу White Noise в 1985 году и номинации Libra и Underworld."),
    ],
    decision: "corrected",
    notes: "Субъективное определение «ведущий представитель» заменено занятиями и точными сведениями Национальной книжной премии.",
  },
  {
    key: "usa:donna_tartt",
    originalSha256: "825e28658c6e907760bc2b43ec1c8ae326b5f03ca322ad27dfb67b1e2d478025",
    reviewedTextRu: "Донна Тартт - американская романистка, автор книг «The Secret History», «The Little Friend» и «The Goldfinch». «The Goldfinch» получил Пулитцеровскую премию за художественную литературу в 2014 году.",
    evidence: [
      e("Пулитцеровская премия", "https://www.pulitzer.org/winners/donna-tartt", "Официальная карточка подтверждает присуждение Пулитцеровской премии 2014 года роману The Goldfinch."),
      e("Hachette Book Group", "https://www.hachettebookgroup.com/contributor/donna-tartt/?lens=little-brown", "Издательская биография подтверждает авторство The Secret History, The Little Friend и The Goldfinch."),
    ],
    decision: "corrected",
    notes: "Оценка положения в литературе заменена полной проверяемой библиографией романов и точным сведением о награде.",
  },
  {
    key: "usa:douglas_preston_lincoln_child",
    originalSha256: "62faf2a6adebaf96e58dd522adb5cb8d2849282ec2709f54d92682e62b0acadc",
    reviewedTextRu: "Дуглас Престон и Линкольн Чайлд - американские писатели и соавторы серии романов об агенте Пендергасте. «Relic» стал первым романом этой серии.",
    evidence: [
      e("Официальный сайт Престона и Чайлда", "https://www.prestonchild.com/authors/", "Официальные биографии подтверждают личности двух соавторов и их совместную серию об агенте Пендергасте."),
      e("Macmillan Publishers", "https://us.macmillan.com/books/9781250335265/relic/", "Издательская карточка подтверждает совместное авторство Relic и его место как первого романа серии о Пендергасте."),
    ],
    decision: "corrected",
    notes: "Карточка явно описана как совместная, убраны рекламные оценки, а серия и её первая книга названы точно.",
  },
  {
    key: "usa:dr_seuss",
    originalSha256: "f1abdfac9453d9a954b230b0dc0d8bebe2078273e43197b0f4550ebbdb05d510",
    reviewedTextRu: "Теодор Сьюз Гайзель (1904-1991) - американский детский писатель и иллюстратор, публиковавшийся как Dr. Seuss. Он написал и проиллюстрировал «The Cat in the Hat», «Green Eggs and Ham» и «The Lorax».",
    evidence: [
      e("Дартмутский колледж", "https://archives-manuscripts.dartmouth.edu/agents/people/1172", "Архивная запись подтверждает полное имя Theodor Seuss Geisel, годы жизни, псевдоним Dr. Seuss и работу писателя-иллюстратора."),
      e("Библиотека Конгресса США", "https://www.loc.gov/exhibits/america-reads/1950-to-2009.html", "Выставка Библиотеки Конгресса подтверждает авторство и иллюстрирование The Cat in the Hat и других детских книг Dr. Seuss."),
    ],
    decision: "corrected",
    notes: "Псевдоним связан с полным именем автора; оценка популярности заменена датами, занятиями и конкретными книгами.",
  },
  {
    key: "usa:edgar_allan_poe",
    originalSha256: "e660c215e41ac2f3b9baaa9701eda5934ccb099c04f885c40d7dd7192cab4ee2",
    reviewedTextRu: "Эдгар Аллан По (1809-1849) - американский писатель, поэт, редактор и литературный критик. Его рассказ «The Murders in the Rue Morgue» связан с формированием детективной прозы; среди других его произведений - «The Raven» и «The Fall of the House of Usher».",
    evidence: [
      e("Служба национальных парков США", "https://www.nps.gov/people/edgarallanpoe.htm", "Официальная биография подтверждает годы жизни, литературные занятия По и основные произведения."),
      e("Музей Эдгара Аллана По", "https://poemuseum.org/poe-biography/", "Музейная биография подтверждает карьеру редактора и критика и связывает The Murders in the Rue Morgue с возникновением детективного рассказа."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование заменено занятиями и проверяемой ролью конкретного рассказа в истории детективного жанра.",
  },
  {
    key: "usa:edith_wharton",
    originalSha256: "819661409e9b8c85d6b73bcba9e64d179021d8631e00d4b6e9fe6de16aba20b4",
    reviewedTextRu: "Эдит Уортон (1862-1937) - американская романистка и автор рассказов. В 1921 году «The Age of Innocence» принёс ей Пулитцеровскую премию, и она стала первой женщиной - лауреатом этой премии за художественную прозу.",
    evidence: [
      e("Служба национальных парков США", "https://www.nps.gov/places/themount.htm", "Официальная справка подтверждает годы жизни Уортон, её писательскую деятельность и статус первой женщины, получившей Пулитцеровскую премию за художественную прозу."),
      e("The Mount - музей Эдит Уортон", "https://edithwharton.org/edith-wharton-biography/", "Музейная биография подтверждает присуждение премии в 1921 году за The Age of Innocence и основные жанры автора."),
    ],
    decision: "corrected",
    notes: "Общее оценочное описание заменено точным историческим фактом о Пулитцеровской премии и видом литературной деятельности.",
  },
  {
    key: "usa:emily_dickinson",
    originalSha256: "b437f2b4c43f3d405be1cc27a5c8a0026c72502b1f0f0582d42af174c4199f24",
    reviewedTextRu: "Эмили Дикинсон (1830-1886) - американская поэтесса из Амхерста. Она создала около 1800 стихотворений, но при её жизни было опубликовано менее двенадцати.",
    evidence: [
      e("Музей Эмили Дикинсон", "https://www.emilydickinsonmuseum.org/emily-dickinson/poetry/", "Официальный музей указывает около 1800 стихотворений и менее двенадцати опубликованных при жизни текстов."),
      e("Библиотека Гарвардского университета", "https://library.harvard.edu/collections/emily-dickinson-collection", "Университетская коллекция подтверждает годы жизни, связь Дикинсон с Амхерстом и масштаб рукописного поэтического наследия."),
    ],
    decision: "corrected",
    notes: "Оценка литературного значения заменена количественными сведениями о корпусе стихотворений и их прижизненной публикации.",
  },
  {
    key: "usa:ernest_cline",
    originalSha256: "9ae9976d35851df024a7d480de91b2fa3ca0b466871894d6cc01884dcd85b1c2",
    reviewedTextRu: "Эрнест Клайн - американский романист и сценарист, автор романов «Ready Player One», «Armada» и «Ready Player Two». Он также был соавтором сценария экранизации «Ready Player One».",
    evidence: [
      e("Penguin Random House", "https://www.penguinrandomhouse.com/authors/130867/ernest-cline/", "Издательский профиль подтверждает профессию романиста и книги Ready Player One, Armada и Ready Player Two."),
      e("Библиотека Конгресса США", "https://www.loc.gov/static/events/2024-national-book-festival/documents/NBF24-Program.pdf", "Официальная программа Национального книжного фестиваля подтверждает литературную карьеру Клайна и авторство Ready Player One."),
    ],
    decision: "corrected",
    notes: "Рекламная характеристика заменена проверяемой библиографией и подтверждённой работой над сценарием экранизации.",
  },
  {
    key: "usa:ernest_hemingway",
    originalSha256: "88d60a58f4c6fb49750c4bc12d3d04ca9a2b6fa684b24ace559636383ebaacc3",
    reviewedTextRu: "Эрнест Хемингуэй (1899-1961) - американский писатель и журналист, автор «The Sun Also Rises», «A Farewell to Arms» и «The Old Man and the Sea». В 1954 году он получил Нобелевскую премию по литературе.",
    evidence: [
      e("Нобелевская премия", "https://www.nobelprize.org/prizes/literature/1954/hemingway/biographical/", "Официальная биография подтверждает годы жизни, писательскую и журналистскую деятельность и награждение в 1954 году."),
      e("Президентская библиотека и музей Джона Ф. Кеннеди", "https://www.jfklibrary.org/hemingway/works", "Архивная страница подтверждает авторство The Sun Also Rises, A Farewell to Arms и The Old Man and the Sea."),
    ],
    decision: "corrected",
    notes: "Оценка влияния заменена занятиями, тремя произведениями и официально подтверждённой Нобелевской премией.",
  },
  {
    key: "usa:eugene_oneill",
    originalSha256: "6964061b5e9e99aa31e850e82975f1946584bf98ce3be6e217e662cc7fd73a43",
    reviewedTextRu: "Юджин О’Нил (1888-1953) - американский драматург, автор «The Iceman Cometh» и «Long Day’s Journey into Night». Он получил Нобелевскую премию по литературе 1936 года и четыре Пулитцеровские премии за драму.",
    evidence: [
      e("Нобелевская премия", "https://www.nobelprize.org/laureate/608", "Официальная карточка подтверждает годы жизни О’Нила и присуждение Нобелевской премии по литературе 1936 года."),
      e("Служба национальных парков США", "https://www.nps.gov/euon/learn/historyculture/eugene-o-neill-an-introduction.htm", "Официальная биография подтверждает драматургическую деятельность, названия пьес и четыре Пулитцеровские премии."),
    ],
    decision: "corrected",
    notes: "Субъективная оценка места в театре заменена произведениями и точным количеством документированных наград.",
  },
  {
    key: "usa:francis_scott_fitzgerald",
    originalSha256: "f04fbc0f902036fac66bec7cb97bcf5027295014798cf216b2cb41fb1978837e",
    reviewedTextRu: "Фрэнсис Скотт Фицджеральд (1896-1940) - американский романист и автор рассказов, чьё творчество связано с эпохой джаза. Он написал «This Side of Paradise», «The Beautiful and Damned», «The Great Gatsby» и «Tender Is the Night».",
    evidence: [
      e("Библиотека Принстонского университета", "https://static-prod.lib.princeton.edu/sc/aids/fitzadd/", "Архивная опись подтверждает годы жизни, литературную деятельность и корпус рукописей Фицджеральда."),
      e("Библиотека Конгресса США", "https://www.loc.gov/exhibits/america-reads/1900-to-1949.html", "Официальная выставка подтверждает The Great Gatsby, связь Фицджеральда с эпохой джаза и другие романы."),
    ],
    decision: "corrected",
    notes: "Оценка литературного статуса заменена датами, жанрами и проверенной последовательностью четырёх прижизненных романов.",
  },
];

export const writerBiographyFactReviewBatch54: readonly WriterBiographyFactReviewRecord[] = seeds.map(
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
