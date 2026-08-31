export const WRITER_BIOGRAPHY_FACT_REVIEW_BATCH50_REVIEWER =
  "Codex independent claim-by-claim factual review, batch 50";

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

const reviewer = WRITER_BIOGRAPHY_FACT_REVIEW_BATCH50_REVIEWER;
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
    key: "south_korea:yi_sang",
    originalSha256: "6626387f2e991413ed874850c246bf7a8a209a147034060b6aaf0974acc7841e",
    reviewedTextRu: "Ли Сан - литературный псевдоним Ким Хэ Гёна (1910-1937), корейского поэта и прозаика, получившего архитектурное образование и работавшего чертёжником. Он написал рассказ «Крылья» и цикл стихотворений «Птичий глаз» (Ogamdo).",
    evidence: [
      e("Literature Translation Institute of Korea", "https://library.ltikorea.or.kr/writer/200095", "Государственный институт подтверждает настоящее имя, даты 23 сентября 1910 - 17 апреля 1937, архитектурное образование, работу чертёжником и произведения Wings и Crow's-Eye View."),
      e("Академия корееведения - Энциклопедия корейской культуры", "https://encykorea.aks.ac.kr/Article/E0044568", "Академическая энциклопедия независимо называет Ли Сана поэтом и прозаиком, указывает настоящее имя Ким Хэ Гён, годы 1910-1937, обучение архитектуре и работу в архитектурном отделе."),
    ],
    decision: "corrected",
    notes: "Оценочное ранжирование заменено проверяемыми именем, занятиями и произведениями; слово «архитектор» уточнено как образование и ранняя работа.",
  },
  {
    key: "south_sudan:atuok_mayen",
    originalSha256: "fe52d96cd72d76d2ff2c396bf3486b9128f77f1dbab68d4f644160a813f9e9a3",
    reviewedTextRu: "Личность писателя «Атуок Мейен» (Atuok Mayen), которому в профиле приписан 1970 год рождения и южносуданское происхождение, не удалось однозначно установить по проверенным авторитетным каталогам.",
    evidence: [
      e("Library of Congress - поиск каталога", "https://catalog.loc.gov/vwebv/search?searchArg=Atuok+Mayen&searchCode=GKEY%5E*&searchType=0&recCount=25", "Поиск по точному латинскому написанию имени не выявляет однозначной авторской записи южносуданского писателя."),
      e("Bibliothèque nationale de France - поиск каталога", "https://catalogue.bnf.fr/rechercher.do?motRecherche=Atuok+Mayen&critereRecherche=0&depart=0&facetteModifiee=ok", "Поиск по точному имени не даёт авторитетной записи, подтверждающей заявленные личность, происхождение или год рождения."),
    ],
    decision: "held",
    notes: "Fail-closed: нет надёжной авторской записи, произведения или институциональной биографии, позволяющих подтвердить личность и исходное утверждение.",
  },
  {
    key: "south_sudan:taban_lo_liyong",
    originalSha256: "159c37540316bf162101f043bf57974d41336c669eb754a66a09311c2a11539e",
    reviewedTextRu: "Табан Ло Лийонг (родился в 1939 году в южной части тогдашнего Судана) - поэт, прозаик, эссеист и университетский преподаватель. Среди его книг - «The Last Word» и сборник рассказов «Fixions and Other Stories».",
    evidence: [
      e("University of Iowa International Writing Program", "https://iwp.uiowa.edu/writers/1988/taban-lo-liyong", "Университетская программа подтверждает авторство Табана Ло Лийонга, его связь с Суданом и участие в программе писателей."),
      e("Store norske leksikon", "https://snl.no/Taban_Lo_Liyong", "Национальная энциклопедия указывает 1939 год рождения, занятия поэта, эссеиста, прозаика и профессора, а также книги The Last Word и Fixions and Other Stories."),
    ],
    decision: "corrected",
    notes: "Субъективная заметность заменена документированными жанрами, преподавательской работой и изданиями.",
  },
  {
    key: "spain:alfonso_x_el_sabio",
    originalSha256: "fc8e50fe878b1fb22b7d1e9522cfcaf77e7c513858edee1153d9a0a9cab3f2d2",
    reviewedTextRu: "Альфонсо X Мудрый (1221-1284) правил Кастилией и Леоном с 1252 года и руководил обширной придворной программой создания книг на кастильском и галисийско-португальском языках. С этой программой связаны «Cantigas de Santa María», «Siete Partidas» и «General estoria».",
    evidence: [
      e("Biblioteca Nacional de España", "https://www.bne.es/es/agenda-eventos-actividades/exposicion-libros-rey-sabio-viii-centenario-del-nacimiento-alfonso-x", "BNE подтверждает годы 1221-1284, королевский статус, придворное производство книг и называет Cantigas de Santa María, Grande e general estoria и Siete Partidas."),
      e("Biblioteca Virtual Miguel de Cervantes", "https://cervantesvirtual.com/portales/alfonso_x_el_sabio/autor_biografia/", "Академический портал подтверждает наследование объединённых королевств в 1252 году и культурно-книжную деятельность Альфонсо X."),
    ],
    decision: "corrected",
    notes: "Неопределённая оценка влияния заменена конкретным описанием покровительства и коллективной книжной программы; личное авторство не преувеличено.",
  },
  {
    key: "spain:antonio_machado",
    originalSha256: "b92f3d319d97fae0bd18b25104ec437dcfb48299cf4634e3158b217513a449c8",
    reviewedTextRu: "Антонио Мачадо (1875-1939) - испанский поэт, прозаик и драматург, связанный с поколением 1898 года. Он написал «Soledades, galerías y otros poemas», «Campos de Castilla» и прозаический цикл «Juan de Mairena».",
    evidence: [
      e("Biblioteca Nacional de España", "https://datos.bne.es/persona/XX991518.html", "Авторитетная запись BNE подтверждает годы 1875-1939, занятия поэта, писателя и драматурга, связь с поколением 98 года и перечисленные произведения."),
      e("Biblioteca Virtual Miguel de Cervantes", "https://www.cervantesvirtual.com/portales/antonio_machado/biografia/", "Академическая биография независимо документирует жизнь, литературную и преподавательскую работу Мачадо."),
    ],
    decision: "corrected",
    notes: "Оценочное «один из крупнейших» заменено жанрами, литературной группой и произведениями.",
  },
  {
    key: "spain:arturo_perez_reverte",
    originalSha256: "05892cafeb1941621e16cf01cd068271de1e90818dab6ea916b602463174e943",
    reviewedTextRu: "Артуро Перес-Реверте (родился в 1951 году) - испанский писатель и бывший военный корреспондент. Он автор романов «El club Dumas», «La carta esférica» и цикла о капитане Алатристе.",
    evidence: [
      e("Biblioteca Nacional de España", "https://datos.bne.es/resource/XX955194", "BNE подтверждает 1951 год рождения, занятия писателя и военного корреспондента и авторство El club Dumas, La carta esférica и книг о капитане Алатристе."),
      e("Real Academia Española", "https://www.rae.es/academico/arturo-perez-reverte", "Официальная страница академика подтверждает биографию Переса-Реверте, его многолетнюю журналистскую работу и литературную деятельность."),
    ],
    decision: "corrected",
    notes: "Исходная характеристика была фактически верна, но текст конкретизирован проверяемой журналистской специализацией и названиями произведений.",
  },
  {
    key: "spain:benito_jeronimo_feijoo",
    originalSha256: "eaa9e6a6ace2e35c744d87c3d87a3004085d0d535d676a7be5eb91d70ae41da5",
    reviewedTextRu: "Бенито Херонимо Фейхоо (1676-1764) - испанский бенедиктинец, профессор богословия и автор просветительских эссе. Его основные многотомные собрания - «Teatro crítico universal» и «Cartas eruditas y curiosas».",
    evidence: [
      e("Biblioteca Virtual Miguel de Cervantes", "https://www.cervantesvirtual.com/portales/benito_jeronimo_feijoo/autor_biografia/", "Академическая биография подтверждает даты 8 октября 1676 - 26 сентября 1764, принадлежность к бенедиктинцам, преподавание и издания Teatro crítico universal и Cartas eruditas y curiosas."),
      e("Universidad de Oviedo - Instituto Feijoo", "https://www.unioviedo.es/IFESXVIII_digital/wp-content/uploads/2024/11/2014_Trea_Lidiando-con-sombras.pdf", "Университетское издание независимо приводит хронологию Фейхоо и подтверждает названия двух главных собраний эссе."),
    ],
    decision: "corrected",
    notes: "Оценочное ранжирование заменено монашеским и академическим статусом и точными названиями основных трудов.",
  },
  {
    key: "spain:benito_perez_galdos",
    originalSha256: "0d50f830fc5d077161a71f0e5250ae7a4026eb08dff58bbf2eda7adf6288a9cd",
    reviewedTextRu: "Бенито Перес Гальдос (1843-1920) - испанский романист, драматург и журналист. Он написал цикл «Episodios nacionales», а также романы «Doña Perfecta» и «Fortunata y Jacinta».",
    evidence: [
      e("Biblioteca Nacional de España", "https://www.bne.es/autores/perez-galdos-benito", "BNE подтверждает даты 10 мая 1843 - 4 января 1920, работу романиста и драматурга и публикацию Episodios nacionales, Doña Perfecta и Fortunata y Jacinta."),
      e("Biblioteca Virtual Miguel de Cervantes", "https://www.cervantesvirtual.com/portales/benito_perez_galdos/inicio/", "Академический портал независимо документирует литературную карьеру Гальдоса и его связь с испанским реализмом."),
    ],
    decision: "corrected",
    notes: "Субъективное место в иерархии реализма заменено документированными занятиями и произведениями.",
  },
  {
    key: "spain:calderon_de_la_barca",
    originalSha256: "e45597efd6f3fbc736d37ea981a12e7e523ab2988b4f7c6b709cdc74c6ae5942",
    reviewedTextRu: "Педро Кальдерон де ла Барка (1600-1681) - испанский драматург и поэт Золотого века, позднее принявший священный сан. Среди его пьес - «La vida es sueño», «El alcalde de Zalamea» и «El médico de su honra».",
    evidence: [
      e("Biblioteca Virtual Miguel de Cervantes", "https://www.cervantesvirtual.com/portales/calderon_de_la_barca/autor_calderon_epoca/", "Академическая биография подтверждает рождение 17 января 1600 года, литературную, военную и церковную составляющие биографии Кальдерона."),
      e("Biblioteca Nacional de España", "https://datos.bne.es/persona/XX870107.html", "Каталог BNE независимо идентифицирует Кальдерона как автора и документирует издания его драматических произведений, включая El alcalde de Zalamea."),
    ],
    decision: "corrected",
    notes: "Оценочная формула заменена занятиями, историческим контекстом и проверяемыми пьесами.",
  },
  {
    key: "spain:camilo_jose_cela",
    originalSha256: "ff5c582b897a49b62c0c80fb736664a573c37c438a3201f82ba9165e7d740188",
    reviewedTextRu: "Камило Хосе Села (1916-2002) - испанский прозаик, эссеист и редактор, получивший Нобелевскую премию по литературе в 1989 году. К его романам относятся «La familia de Pascual Duarte» и «La colmena».",
    evidence: [
      e("Nobel Prize", "https://www.nobelprize.org/prizes/literature/1989/cela/facts/", "Нобелевский фонд подтверждает даты жизни, премию 1989 года, литературные жанры и романы La familia de Pascual Duarte и La colmena."),
      e("Biblioteca Nacional de España", "https://datos.bne.es/resource/XX829232", "BNE независимо подтверждает годы 1916-2002, занятия писателя, журналиста и редактора и каталогизирует названные романы."),
    ],
    decision: "corrected",
    notes: "Нобелевский факт сохранён, субъективное ранжирование удалено; добавлены жанры и произведения.",
  },
  {
    key: "spain:carlos_ruiz_zafon",
    originalSha256: "e1e017bf51fdf23c61122ee865422fd525dee729dd8133aa2998f7501f7dfc72",
    reviewedTextRu: "Карлос Руис Сафон (1964-2020) - испанский писатель, автор романов «La sombra del viento», «El juego del ángel» и «El prisionero del cielo».",
    evidence: [
      e("Biblioteca Nacional de España", "https://www.bne.es/es/noticias/0619-fallece-ruiz-zafon", "BNE подтверждает даты 25 сентября 1964 - 19 июня 2020, литературную деятельность и известность романа La sombra del viento."),
      e("Официальный сайт Карлоса Руиса Сафона", "https://www.carlosruizzafon.com/es/carlos-ruiz-zafon.php?idioma=es", "Официальная библиография автора подтверждает его биографические сведения и издание названных романов."),
    ],
    decision: "corrected",
    notes: "Маркетинговое определение «международный бестселлер» заменено проверяемыми датами, профессией и названиями произведений.",
  },
  {
    key: "spain:carmen_laforet",
    originalSha256: "110b31fdbf90418f835ea97d023afad91ff3ec0cbe93a6af9e19c482eb61dccc",
    reviewedTextRu: "Кармен Лафорет (1921-2004) - испанская писательница. Её первый роман «Nada» получил первую премию Надаля; позднее она опубликовала роман «La isla y los demonios».",
    evidence: [
      e("Biblioteca Nacional de España", "https://www.bne.es/es/autores/laforet-carmen", "BNE подтверждает годы жизни Лафорет, её литературную деятельность, роман Nada и получение первой премии Надаля."),
      e("Indiana University Libraries", "https://collections.libraries.indiana.edu/iulibraries/s/iberoamericancentennials/page/carmenlaforet", "Университетская библиотека независимо приводит даты 1921-2004 и библиографию, включая Nada и La isla y los demonios."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование заменено биографическими датами, первым романом, премией и вторым подтверждённым произведением.",
  },
  {
    key: "spain:emilia_pardo_bazan",
    originalSha256: "39036879ad58531bd5f69772c28f082d6f4b9716e62717fba2b8e0a061eb803d",
    reviewedTextRu: "Эмилия Пардо Басан (1851-1921) - испанская писательница, литературный критик и автор исследований о натурализме. Среди её романов - «Los pazos de Ulloa», «La madre naturaleza» и «La Tribuna».",
    evidence: [
      e("Biblioteca Virtual Miguel de Cervantes", "https://www.cervantesvirtual.com/portales/pardo_bazan/autora_biografia/", "Академическая биография подтверждает даты жизни, литературную и критическую работу Пардо Басан и её связь с обсуждением натурализма."),
      e("Biblioteca Nacional de España", "https://www.bne.es/es/autores/pardo-bazan-emilia", "BNE независимо идентифицирует писательницу и каталогизирует романы Los pazos de Ulloa, La madre naturaleza и La Tribuna."),
    ],
    decision: "corrected",
    notes: "Оценочная формула удалена; ошибочное название «Трибунал» исправлено на «La Tribuna», остальные названия приведены в оригинале.",
  },
  {
    key: "spain:federico_garcia_lorca",
    originalSha256: "133412b9e6c20547c8f73f7fe4e73233f7801a34514d83aa01820b505330522b",
    reviewedTextRu: "Федерико Гарсиа Лорка (1898-1936) - испанский поэт и драматург поколения 1927 года. Он написал «Romancero gitano», «Bodas de sangre», «Yerma» и «La casa de Bernarda Alba».",
    evidence: [
      e("Biblioteca Nacional de España", "https://www.bne.es/es/autores/garcia-lorca-federico", "BNE подтверждает годы 1898-1936, занятия поэта и драматурга и каталогизирует основные произведения Лорки."),
      e("Centro Federico García Lorca", "https://www.centrofedericogarcialorca.es/es/fgl", "Официальный центр документирует биографию, связь с поколением 27 года и литературное наследие Лорки; гибель относится к августу 1936 года."),
    ],
    decision: "corrected",
    notes: "Субъективная известность заменена литературной группой и произведениями; точный день гибели не утверждается, поскольку институциональные источники расходятся между 18 и 19 августа.",
  },
  {
    key: "spain:francisco_de_quevedo",
    originalSha256: "f1ad688bdaf27c75eb523a6c4f4f93721a7b3ef0adee8bf8d9cb50c032a4c43f",
    reviewedTextRu: "Франсиско де Кеведо (1580-1645) - испанский поэт и прозаик Золотого века, писавший сатирические и нравственно-философские тексты. К его произведениям относятся «Historia de la vida del Buscón» и цикл «Sueños y discursos».",
    evidence: [
      e("Biblioteca Virtual Miguel de Cervantes", "https://www.cervantesvirtual.com/portales/francisco_de_quevedo/vida_y_obra/", "Академический портал подтверждает даты жизни, поэтическую и прозаическую деятельность Кеведо и основные сатирические произведения."),
      e("Biblioteca Nacional de España", "https://datos.bne.es/persona/XX838045.html", "Авторитетная запись BNE независимо подтверждает личность и годы жизни и каталогизирует Historia de la vida del Buscón и Sueños y discursos."),
    ],
    decision: "corrected",
    notes: "Жанровая характеристика конкретизирована, а неточные русские обозначения произведений заменены устойчивыми оригинальными названиями.",
  },
  {
    key: "spain:garcilaso_de_la_vega",
    originalSha256: "fb3bb42b1458d62234e974191f3e41a206b33aa78b2687d831ed50b55eea7772",
    reviewedTextRu: "Гарсиласо де ла Вега (родился около 1501 года, умер в 1536 году) - испанский поэт и военный эпохи Возрождения. Его сохранившееся поэтическое наследие включает сонеты, эклоги и элегии.",
    evidence: [
      e("Biblioteca Virtual Miguel de Cervantes", "https://www.cervantesvirtual.com/portales/garcilaso_de_la_vega/obra/obras-de-garcilaso-de-la-vega/", "Академический портал документирует корпус произведений Гарсиласо, включая сонеты, эклоги и элегии, и биографический контекст XVI века."),
      e("Biblioteca Nacional de España", "https://datos.bne.es/persona/XX1030234.html", "BNE указывает приблизительный год рождения около 1501, смерть в 1536 году и идентифицирует Гарсиласо как поэта и военного."),
    ],
    decision: "corrected",
    notes: "Недоказанная точность года рождения снята: авторитетные справочные записи датируют рождение приблизительно 1501 годом; оценка влияния удалена.",
  },
  {
    key: "spain:gustavo_adolfo_becquer",
    originalSha256: "30807e58c6159f8ac71e475f1ceb2b314884cfb7d49801922dd5fab39c8d9784",
    reviewedTextRu: "Густаво Адольфо Беккер (1836-1870) - испанский поэт и прозаик, чьи тексты связаны с поздним романтизмом. Его основные сборники известны как «Rimas» и «Leyendas».",
    evidence: [
      e("Biblioteca Virtual Miguel de Cervantes", "https://www.cervantesvirtual.com/portales/gustavo_adolfo_becquer/autor_biografia/", "Академическая биография подтверждает даты 1836-1870, занятия поэта и прозаика и публикационную историю Rimas и Leyendas."),
      e("Biblioteca Nacional de España", "https://datos.bne.es/persona/XX1719659.html", "BNE независимо подтверждает биографические даты и каталогизирует Rimas и Leyendas как произведения Беккера."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование удалено; сохранены проверяемая литературная принадлежность и точные названия сборников.",
  },
  {
    key: "spain:jacinto_benavente",
    originalSha256: "e797d72442ddbcdac1544a8c06adc9f7c2979139572b4ec5c0b58474903ea74e",
    reviewedTextRu: "Хасинто Бенавенте-и-Мартинес (1866-1954) - испанский драматург, получивший Нобелевскую премию по литературе в 1922 году. Среди его пьес - «Los intereses creados», «La malquerida» и «La noche del sábado».",
    evidence: [
      e("Nobel Prize", "https://www.nobelprize.org/prizes/literature/1922/benavente/facts/", "Нобелевский фонд подтверждает даты жизни, профессию драматурга и премию по литературе 1922 года."),
      e("Biblioteca Nacional de España", "https://datos.bne.es/persona/XX835237", "BNE независимо подтверждает личность и годы жизни и каталогизирует пьесы Los intereses creados, La malquerida и La noche del sábado."),
    ],
    decision: "corrected",
    notes: "Интерпретационные оценки заменены премией и произведениями; неподтверждённое название «Злорадство» удалено из профиля.",
  },
  {
    key: "spain:javier_marias",
    originalSha256: "2029c4e1f00679ca296f0e01764fa4ff825e54bc94ffebfcc5bd665474f01111",
    reviewedTextRu: "Хавьер Мариас (1951-2022) - испанский писатель, переводчик и член Королевской академии испанского языка. Он автор романов «Corazón tan blanco», «Todas las almas» и трилогии «Tu rostro mañana».",
    evidence: [
      e("Biblioteca Nacional de España", "https://datos.bne.es/resource/XX1720979", "BNE подтверждает даты 20 сентября 1951 - 11 сентября 2022, занятия писателя и переводчика и библиографию романов."),
      e("Real Academia Española", "https://www.rae.es/academico/javier-marias", "Официальная страница RAE подтверждает членство Мариаса в академии, биографические даты и литературную деятельность."),
    ],
    decision: "corrected",
    notes: "Субъективная известность заменена академическим статусом и проверяемыми произведениями.",
  },
  {
    key: "spain:jorge_manrique",
    originalSha256: "82bd29590e7fedd8c4981680f7dc4ca101dc998910cafd777bdea8458cd0afb0",
    reviewedTextRu: "Хорхе Манрике (около 1440-1479) - кастильский поэт и военный. К его сохранившимся произведениям относится элегия «Coplas por la muerte de su padre».",
    evidence: [
      e("Biblioteca Virtual Miguel de Cervantes", "https://www.cervantesvirtual.com/portales/jorge_manrique/autor_biografia/", "Академическая биография датирует рождение приблизительно 1440 годом, смерть 1479 годом и подтверждает литературную и военную деятельность Манрике."),
      e("Biblioteca Nacional de España", "https://datos.bne.es/persona/XX1021804.html", "BNE независимо идентифицирует Манрике, приводит приблизительные годы жизни и каталогизирует Coplas por la muerte de su padre."),
    ],
    decision: "corrected",
    notes: "Субъективное место в иерархии поэзии заменено занятиями и конкретным произведением; в биографии используется надёжно установленный год смерти без лишней точности.",
  },
  {
    key: "spain:jose_de_espronceda",
    originalSha256: "74e133d8f29ae884b05c26a277964ca627ea1894bcb4983144b4944eca93e718",
    reviewedTextRu: "Хосе де Эспронседа (1808-1842) - испанский поэт и прозаик эпохи романтизма. Он написал поэму «El estudiante de Salamanca», стихотворение «Canción del pirata» и незавершённую поэму «El diablo mundo».",
    evidence: [
      e("Biblioteca Virtual Miguel de Cervantes", "https://cervantesvirtual.com/portales/jose_de_espronceda/autor_biografia/", "Академическая биография подтверждает даты 1808-1842, связь с романтизмом и литературную деятельность Эспронседы."),
      e("Biblioteca Nacional de España", "https://www.bne.es/export/sites/BNWEB1/es/Actividades/Exposiciones/Exposiciones/Exposiciones2009/docs_espronceda/folletoespronceda.pdf", "Материалы выставки BNE документируют биографию и произведения El estudiante de Salamanca, Canción del pirata и незавершённый El diablo mundo."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование удалено; добавлены жанры и точные оригинальные названия произведений, незавершённость El diablo mundo обозначена.",
  },
  {
    key: "spain:jose_echegaray",
    originalSha256: "e974383f913252d2efa0da7849580c5701b4329a62351d27503c038f209cda56",
    reviewedTextRu: "Хосе Эчегарай-и-Эйсагирре (1832-1916) - испанский драматург, математик, инженер и политический деятель. В 1904 году он разделил Нобелевскую премию по литературе с Фредериком Мистралем; среди его пьес - «El gran Galeoto» и «O locura o santidad».",
    evidence: [
      e("Biblioteca Nacional de España", "https://www.bne.es/es/autores/echegaray-jose", "BNE подтверждает даты 19 апреля 1832 - 14 сентября 1916, научную, инженерную, политическую и драматургическую деятельность Эчегарая."),
      e("Nobel Prize", "https://www.nobelprize.org/prizes/literature/1904/echegaray/facts/", "Нобелевский фонд подтверждает премию по литературе 1904 года, разделённую Эчегараем с Фредериком Мистралем, и перечисляет его занятия и пьесы."),
    ],
    decision: "corrected",
    notes: "Интерпретация драматургии заменена документированными профессиями, совместной Нобелевской премией и произведениями; дата смерти 14 сентября сохранена по испанской национальной записи.",
  },
  {
    key: "spain:jose_ortega_y_gasset",
    originalSha256: "d39f75efebfc934db3d97b990c99e39a8dee03cd17624d90c6149f4a2af9493c",
    reviewedTextRu: "Хосе Ортега-и-Гассет (1883-1955) - испанский философ, эссеист и профессор метафизики. Он написал «Meditaciones del Quijote», «La deshumanización del arte» и «La rebelión de las masas».",
    evidence: [
      e("Fundación José Ortega y Gasset-Gregorio Marañón", "https://ortegaygasset.edu/legados/jose-ortega-y-gasset/", "Официальный фонд подтверждает даты 1883-1955, философскую и преподавательскую деятельность и основные этапы биографии Ортеги."),
      e("Biblioteca Nacional de España", "https://datos.bne.es/persona/XX947193.html", "BNE независимо подтверждает личность и годы жизни и каталогизирует Meditaciones del Quijote, La deshumanización del arte и La rebelión de las masas."),
    ],
    decision: "corrected",
    notes: "Субъективное общеевропейское ранжирование заменено профессией и конкретными трудами.",
  },
  {
    key: "spain:juan_de_la_cruz",
    originalSha256: "88c154c8c856ffac0e41dec8038710c7dc8ad8deac7d50140d39bbc0d06888cc",
    reviewedTextRu: "Хуан де ла Крус (1542-1591) - испанский кармелит, поэт и автор мистических трактатов. Ему принадлежат «Noche oscura», «Cántico espiritual» и «Subida del Monte Carmelo».",
    evidence: [
      e("Biblioteca Virtual Miguel de Cervantes", "https://www.cervantesvirtual.com/portales/san_juan_de_la_cruz/autor_biografia/", "Академическая биография подтверждает рождение в 1542 году, смерть 14 декабря 1591 года, принадлежность к кармелитам и литературную деятельность."),
      e("Biblioteca Nacional de España - каталог", "https://catalogo.bne.es/discovery/search?query=any,contains,Juan%20de%20la%20Cruz&tab=LibraryCatalog&search_scope=MyInstitution&vid=34BNE_INST:CATALOGO", "Национальный каталог независимо идентифицирует автора и фиксирует издания Noche oscura, Cántico espiritual и Subida del Monte Carmelo."),
    ],
    decision: "corrected",
    notes: "Оценочное ранжирование снято; точный день рождения не подтверждён ранним документом и заменён надёжно установленным годом.",
  },
  {
    key: "spain:juan_marse",
    originalSha256: "1574903094e407f6aac01088d4f83ab06c6f70be8cf647c576e3abad80070249",
    reviewedTextRu: "Хуан Марсе (1933-2020) - испанский романист, родившийся в Барселоне. Он написал «Últimas tardes con Teresa» и «El amante bilingüe» и получил премию Сервантеса в 2008 году.",
    evidence: [
      e("Instituto Cervantes", "https://www.cervantes.es/bibliotecas_documentacion_espanol/biografias/marse_juan.htm", "Институт Сервантеса подтверждает даты жизни, барселонское происхождение, романы Últimas tardes con Teresa и El amante bilingüe и премию Сервантеса 2008 года."),
      e("Biblioteca Nacional de España", "https://datos.bne.es/persona/XX1719464.html", "BNE независимо подтверждает биографические даты Марсе и каталогизирует названные романы."),
    ],
    decision: "corrected",
    notes: "Широкое определение литературной принадлежности заменено местом рождения, жанром, произведениями и премией; неверный русский вариант второго названия исправлен.",
  },
  {
    key: "spain:juan_ramon_jimenez",
    originalSha256: "bb6109ac3c6560957fa6eb25a48a773390dc6b5ce85b9910db2241c4d428c7d7",
    reviewedTextRu: "Хуан Рамон Хименес (1881-1958) - испанский поэт и автор лирической прозы «Platero y yo». В 1956 году он получил Нобелевскую премию по литературе.",
    evidence: [
      e("Instituto Cervantes", "https://www.cervantes.es/bibliotecas_documentacion_espanol/biografias/nueva_delhi_juan_ramon_jimenez.htm?authuser=0", "Институт Сервантеса приводит дату рождения 23 декабря 1881 года, смерть 29 мая 1958 года и литературную биографию Хименеса."),
      e("Nobel Prize", "https://www.nobelprize.org/prizes/literature/1956/jimenez/facts/", "Нобелевский фонд подтверждает премию по литературе 1956 года и авторство Platero y yo."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование удалено; дата рождения 23 декабря сохранена по испанской биографической записи, несмотря на встречающееся в нобелевской карточке расхождение на один день.",
  },
  {
    key: "spain:juan_ruiz",
    originalSha256: "30a0139db8cb21404187a89d8576ceb67235b4fe3fdfca8bee8652c840b2990e",
    reviewedTextRu: "«Libro de buen amor» традиционно связывают с именем Хуана Руиса, архипресвитера из Иты, однако надёжных внешних сведений о его личности и датах жизни не сохранилось.",
    evidence: [
      e("Biblioteca Virtual Miguel de Cervantes", "https://www.cervantesvirtual.com/portales/arcipreste_de_hita/autor_biografia/", "Академический портал прямо отмечает скудость и спорность биографических сведений и связывает имя Хуана Руиса с Libro de buen amor главным образом по самому тексту."),
      e("Biblioteca Nacional de España - каталог", "https://catalogo.bne.es/discovery/search?query=any,contains,Juan%20Ruiz%20Arcipreste%20de%20Hita&tab=LibraryCatalog&search_scope=MyInstitution&vid=34BNE_INST:CATALOGO", "Национальный каталог отражает традиционную авторскую атрибуцию и издания Libro de buen amor, но не предоставляет документированных точных дат жизни."),
    ],
    decision: "held",
    notes: "Fail-closed: текстовое имя и традиционная атрибуция допустимы только с оговоркой; приблизительные 1283 и 1350 годы не имеют достаточного документального основания и сняты.",
  },
  {
    key: "spain:leopoldo_alas_clarin",
    originalSha256: "38ad5513396cdde1b30c4e1728b7d8f8a0afdcbe61c867fc5f8e46ebfb23e922",
    reviewedTextRu: "Леопольдо Алас «Кларин» (1852-1901) - испанский писатель, литературный критик и университетский профессор. Он автор романов «La Regenta» и «Su único hijo», а также сборника «Cuentos morales».",
    evidence: [
      e("Biblioteca Virtual Miguel de Cervantes", "https://www.cervantesvirtual.com/portales/leopoldo_alas_clarin/autor_biografia/", "Академическая биография подтверждает даты 1852-1901, преподавание, критику и литературное творчество Кларина."),
      e("Biblioteca Nacional de España - каталог", "https://catalogo.bne.es/discovery/search?query=any,contains,Leopoldo%20Alas%20Clarin&tab=LibraryCatalog&search_scope=MyInstitution&vid=34BNE_INST:CATALOGO", "BNE независимо идентифицирует автора и каталогизирует La Regenta, Su único hijo и Cuentos morales."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование заменено профессиями и конкретными библиографическими позициями.",
  },
  {
    key: "spain:lope_de_vega",
    originalSha256: "254ad4a2bed664feb19a346a75a0277d005dacf807f4d6c0ba83d84b89da6a2f",
    reviewedTextRu: "Лопе де Вега (1562-1635) - испанский драматург и поэт Золотого века. Среди надёжно атрибутируемых ему пьес - «Fuenteovejuna», «El perro del hortelano» и «El caballero de Olmedo».",
    evidence: [
      e("Biblioteca Virtual Miguel de Cervantes", "https://cervantesvirtual.com/portales/lope_de_vega/autor_biobibliografia/", "Академическая биобиблиография подтверждает даты жизни, занятия драматурга и поэта и корпус пьес Лопе де Веги."),
      e("Biblioteca Nacional de España - каталог", "https://catalogo.bne.es/discovery/search?query=any,contains,Lope%20de%20Vega&tab=LibraryCatalog&search_scope=MyInstitution&vid=34BNE_INST:CATALOGO", "Национальный каталог документирует издания Fuenteovejuna, El perro del hortelano и El caballero de Olmedo; атрибуция La Estrella de Sevilla в научной традиции не считается бесспорной."),
    ],
    decision: "corrected",
    notes: "Гиперболы удалены; «La Estrella de Sevilla» исключена из профиля из-за спорной атрибуции, а перечень заменён бесспорными пьесами.",
  },
  {
    key: "spain:luis_de_gongora",
    originalSha256: "c55f4447d712af2e14269d56bd2d898d35c37ea136b7d3e0d6886e6e49b61e82",
    reviewedTextRu: "Луис де Гонгора (1561-1627) - испанский поэт барокко, чья поэтика связана с культизмом. Его основные произведения включают «Fábula de Polifemo y Galatea», «Soledades» и сонеты.",
    evidence: [
      e("Biblioteca Virtual Miguel de Cervantes", "https://cervantesvirtual.com/portales/luis_de_gongora/autor_biografia/", "Академическая биография подтверждает даты 1561-1627, барочную поэтику Гонгоры и его связь с культизмом."),
      e("Biblioteca Nacional de España - каталог", "https://catalogo.bne.es/discovery/search?query=any,contains,Luis%20de%20Gongora&tab=LibraryCatalog&search_scope=MyInstitution&vid=34BNE_INST:CATALOGO", "Национальный каталог документирует Fábula de Polifemo y Galatea, Soledades и собрания сонетов Гонгоры."),
    ],
    decision: "corrected",
    notes: "Недоказанная формула единоличного «создателя» направления заменена проверяемой связью с культизмом; неопределённые «Оды» заменены точными категориями и названиями.",
  },
  {
    key: "spain:mariano_jose_de_larra",
    originalSha256: "16e4178806ee3a343073175457d63809a4329e64fce6332c32b857b6535203df",
    reviewedTextRu: "Мариано Хосе де Ларра (1809-1837) - испанский журналист, эссеист и драматург, публиковавшийся под псевдонимами, включая «Fígaro». Среди его сатирических статей - «El castellano viejo» и «Vuelva usted mañana».",
    evidence: [
      e("Biblioteca Virtual Miguel de Cervantes", "https://www.cervantesvirtual.com/portales/mariano_jose_de_larra/autor_biografia/", "Академическая биография подтверждает даты 1809-1837, журналистскую, эссеистическую и драматургическую работу Ларры и использование псевдонима Fígaro."),
      e("Biblioteca Nacional de España - каталог", "https://catalogo.bne.es/discovery/search?query=any,contains,Mariano%20Jose%20de%20Larra&tab=LibraryCatalog&search_scope=MyInstitution&vid=34BNE_INST:CATALOGO", "Национальный каталог независимо идентифицирует автора и документирует статьи El castellano viejo и Vuelva usted mañana."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование заменено жанрами, псевдонимом и конкретными статьями; расплывчатое «Статьи Фигаро» заменено библиографическими названиями.",
  },
  {
    key: "spain:miguel_de_cervantes",
    originalSha256: "53445a7653da8c00343f85845d66c9c66fb2b8ca815505a75609214c42237d32",
    reviewedTextRu: "Мигель де Сервантес Сааведра был крещён 9 октября 1547 года; точная дата его рождения не установлена, а умер он 22 апреля 1616 года. Он автор романа «El ingenioso hidalgo don Quijote de la Mancha», сборника «Novelas ejemplares» и романа «Los trabajos de Persiles y Sigismunda».",
    evidence: [
      e("Biblioteca Nacional de España", "https://cervantes.bne.es/ficheros/exposicion/ESTUDIOS/01_Una_vida_tras_la_sombra_de_un_mito.pdf", "Исследование BNE подтверждает запись о крещении 9 октября 1547 года и объясняет, что 29 сентября - традиционное предположение, а не установленная запись о рождении."),
      e("Biblioteca Virtual Miguel de Cervantes", "https://www.cervantesvirtual.com/research/aniversario-cclxii-de-la-muerte-de-miguel-de-cervantes-saavedra-libro-compuesto-para-honrar-la-memoria-del-principe-de-los-ingenios-espanoles/003210b6-82b2-11df-acc7-002185ce6064.pdf", "Академическое издание независимо приводит крещение 9 октября, вероятностный характер даты 29 сентября, смерть 22 апреля 1616 года и основные произведения."),
    ],
    decision: "corrected",
    notes: "Оценочное «величайший» удалено; 29 сентября не является документированной датой рождения, а выводится из даты крещения и дня святого Михаила, поэтому в профиле оставлен только 1547 год.",
  },
  {
    key: "spain:miguel_de_unamuno",
    originalSha256: "b9acbd576bd4a9c0cf836a3a15775cd0b08a1fe4b54875d6cbe56379255e6505",
    reviewedTextRu: "Мигель де Унамуно (1864-1936) - испанский писатель, философ и профессор, связанный с поколением 1898 года. Он написал «Niebla», «Abel Sánchez» и «San Manuel Bueno, mártir».",
    evidence: [
      e("Biblioteca Nacional de España", "https://www.bne.es/es/autores/unamuno-miguel", "BNE подтверждает даты 29 сентября 1864 - 31 декабря 1936, занятия писателя и философа и библиографию Унамуно."),
      e("Biblioteca Virtual Miguel de Cervantes", "https://cervantesvirtual.com/portales/miguel_de_unamuno/autor_biografia/", "Академическая биография независимо документирует профессорскую работу, связь с поколением 98 года и основные произведения."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование и интерпретация тем заменены профессиями, литературной группой и произведениями.",
  },
  {
    key: "spain:miguel_delibes",
    originalSha256: "66842a9797cbb3b2f0eeb071d34ddbd422ffd7657935b2b8448fd265501a39a9",
    reviewedTextRu: "Мигель Делибес (1920-2010) - испанский романист, журналист и член Королевской академии испанского языка. Он написал «El camino», «Cinco horas con Mario» и «Los santos inocentes» и получил премию Сервантеса в 1993 году.",
    evidence: [
      e("Fundación Miguel Delibes", "https://fundacionmigueldelibes.es/biografia/", "Официальный фонд подтверждает даты жизни, журналистскую и литературную работу, членство в RAE и библиографию Делибеса."),
      e("Instituto Cervantes", "https://www.cervantes.es/bibliotecas_documentacion_espanol/biografias/delibes_miguel.htm", "Институт Сервантеса независимо подтверждает премию Сервантеса 1993 года и романы El camino, Cinco horas con Mario и Los santos inocentes."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование заменено профессиями, членством в RAE, произведениями и документированной премией.",
  },
  {
    key: "spain:pío_baroja",
    originalSha256: "7089ba183b1ed499cae45e31c123e12f083aa68ac734dcc22aea39b4a9b76b0e",
    reviewedTextRu: "Пио Бароха (1872-1956) - испанский романист, связанный с поколением 1898 года. Среди его романов - «El árbol de la ciencia», «Zalacaín el aventurero» и «Las inquietudes de Shanti Andía».",
    evidence: [
      e("Biblioteca Nacional de España", "https://datos.bne.es/resource/XX842743", "BNE подтверждает даты 1872-1956, профессию писателя и каталогизирует El árbol de la ciencia, Zalacaín el aventurero и Las inquietudes de Shanti Andía."),
      e("Biblioteca Virtual Miguel de Cervantes", "https://www.cervantesvirtual.com/portales/pio_baroja/autor_biografia/", "Академическая биография независимо документирует принадлежность Барохи к поколению 98 года и его романное творчество."),
    ],
    decision: "corrected",
    notes: "Субъективная оценка заменена литературной принадлежностью; недостоверные или неточные названия «Лабиринт приключений» и «Зелёная площадь» удалены.",
  },
  {
    key: "spain:rafael_alberti",
    originalSha256: "be64cf0b411d198687b7678169d6997c68e699c6420c367fce1b7a7d74b6e6a8",
    reviewedTextRu: "Рафаэль Альберти (1902-1999) - испанский поэт и драматург поколения 1927 года. Он написал «Marinero en tierra» и «Sobre los ángeles», а также мемуарную книгу «La arboleda perdida»; в 1983 году получил премию Сервантеса.",
    evidence: [
      e("Instituto Cervantes", "https://www.cervantes.es/bibliotecas_documentacion_espanol/biografias/alberti_rafael.htm", "Институт Сервантеса подтверждает даты жизни, связь с поколением 27 года, произведения и премию Сервантеса 1983 года."),
      e("Biblioteca Nacional de España", "https://datos.bne.es/persona/XX1719975.html", "BNE независимо подтверждает личность и каталогизирует Marinero en tierra, Sobre los ángeles и La arboleda perdida."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование снято; ошибочные названия «О человеке и ангеле» и «Потерянная голубка» заменены оригиналами Sobre los ángeles и La arboleda perdida.",
  },
  {
    key: "spain:ramon_del_valle_inclan",
    originalSha256: "3dff925788922bb26b3678431373a70875ca9e23e9899144b9b0aafead12d483",
    reviewedTextRu: "Рамон Мария дель Валье-Инклан (1866-1936) - испанский прозаик и драматург, связанный с модернизмом. В пьесе «Luces de bohemia» он сформулировал эстетику эсперпенто; к его произведениям также относятся цикл «Sonatas» и роман «Tirano Banderas».",
    evidence: [
      e("Biblioteca Nacional de España", "https://www.bne.es/es/autores/valle-inclan-ramon", "BNE подтверждает даты 28 октября 1866 - 5 января 1936, литературную деятельность и произведения Валье-Инклана."),
      e("Cátedra Valle-Inclán - Biblioteca Virtual Miguel de Cervantes", "https://www.cervantesvirtual.com/portales/catedra_valle_inclan/vida_ramon_valle/", "Академическая кафедра независимо документирует биографию, модернистский контекст и разработку эстетики эсперпенто в Luces de bohemia."),
    ],
    decision: "corrected",
    notes: "Оценочная формула заменена конкретной ролью Luces de bohemia в оформлении эсперпенто и точными названиями произведений.",
  },
  {
    key: "spain:teresa_de_avila",
    originalSha256: "65208af639fcdc2aa1337b95262088c249e953859ec043d24223dc4516bce220",
    reviewedTextRu: "Тереса Авильская (1515-1582) - испанская кармелитка, писательница и автор мистических произведений «Libro de la vida», «Camino de perfección» и «Las moradas». Она умерла в ночь 4 октября 1582 года в Альба-де-Тормес; при календарной реформе в Испании следующим гражданским днём стало 15 октября.",
    evidence: [
      e("Biblioteca Nacional de España", "https://www.bne.es/es/autores/teresa-jesus-santa", "BNE подтверждает даты 28 марта 1515 - 4 октября 1582, принадлежность к кармелитам и авторство основных произведений."),
      e("Biblioteca Virtual Miguel de Cervantes", "https://www.cervantesvirtual.com/portales/santa_teresa_de_jesus/autor_biografia/", "Академическая биография независимо описывает жизнь и труды Тересы и поясняет, что после 4 октября 1582 года при реформе календаря наступило 15 октября."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование удалено; дата смерти 4 октября сохранена и снабжена необходимым пояснением о переходе с юлианского на григорианский календарь.",
  },
  {
    key: "spain:vicente_aleixandre",
    originalSha256: "2f7e86ce82ff98d351ad7ade0de91abd62d3e6e48942f8f3d98d69f19f56c4ad",
    reviewedTextRu: "Висенте Алейксандре (1898-1984) - испанский поэт, один из участников литературного объединения, известного как «Поколение двадцать седьмого года». В 1977 году он получил Нобелевскую премию по литературе.",
    evidence: [
      e("Nobel Prize", "https://www.nobelprize.org/prizes/literature/1977/aleixandre/facts/", "Нобелевский фонд подтверждает даты 1898-1984 и премию по литературе 1977 года."),
      e("Biblioteca Nacional de España", "https://datos.bne.es/persona/XX1719402.html", "BNE независимо подтверждает биографические даты, занятие поэта и связь Алейксандре с поколением 27 года."),
    ],
    decision: "corrected",
    notes: "Факты исходного утверждения подтверждены; формулировка унифицирована и дополнена проверенными годами жизни.",
  },
  {
    key: "sri_lanka:anne_ranasinghe",
    originalSha256: "51bbe0efa85d459c6b8b9c824982e99f5bdfa9b61cb4f204eda73eeb234b33ce",
    reviewedTextRu: "Анн Ранасингхе (урождённая Аннелизе Кац; 1925-2016) родилась в Эссене, покинула нацистскую Германию и позднее стала англоязычной поэтессой Шри-Ланки. Её поэзия обращается к памяти о Холокосте и опыту жизни на Шри-Ланке; среди сборников - «And the Sun That Sucks the Earth to Dry», «Against Eternity and Darkness» и «Not Even Shadows».",
    evidence: [
      e("Library of Congress", "https://www.loc.gov/acq/overseas-offices/delhi/salrp/anneranasinghe.html", "Библиотека Конгресса подтверждает имя при рождении Anneliese Katz, даты 1925-2016, рождение в Эссене, бегство из Германии, жизнь на Шри-Ланке и основные книги."),
      e("New Ceylon Writing", "https://newceylonwriting.com/wp-content/uploads/2020/03/ncw6final9jan2017lite-edited-on-4-march-2020.pdf", "Литературное издание Шри-Ланки независимо документирует биографию Ранасингхе, темы Холокоста и страны проживания и библиографию сборников."),
    ],
    decision: "corrected",
    notes: "Субъективная заметность удалена; биографический контекст конкретизирован, а два неподтверждённых названия в профиле заменены документированными сборниками.",
  },
];

export const writerBiographyFactReviewBatch50: readonly WriterBiographyFactReviewRecord[] = seeds.map(
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
