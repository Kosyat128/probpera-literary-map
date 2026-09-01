const RSL = "Российская государственная библиотека";
const NEB = "Национальная электронная библиотека";
const NLR = "Российская национальная библиотека";
const AST = "Издательство АСТ";
const PHANTOM_PRESS = "Издательство Фантом Пресс";
const AZBOOKA = "Издательская группа «Азбука-Аттикус»";
const EKSMO = "Издательство Эксмо";
const SINDBAD = "Издательство «Синдбад»";
const SAMOKAT = "Издательство «Самокат»";

function attestation(
  key,
  sourceTitleExact,
  catalogTitleRu,
  recordUrl,
  options = {},
) {
  const displayTitleRu = options.displayTitleRu || catalogTitleRu;
  const authority = options.authority || RSL;
  const attestationType =
    options.attestationType ||
    (new Set([RSL, NEB, NLR]).has(authority)
      ? "translated-edition-record"
      : "official-publisher-edition");
  return {
    key,
    sourceTitleExact,
    catalogTitleRu,
    displayTitleRu,
    status: "russian-edition-attested",
    authority,
    recordUrl,
    verifiedAt: "2026-09-01",
    expectedOccurrences: options.expectedOccurrences || 1,
    attestationType,
    ...(options.evidenceAlias ? { evidenceAlias: options.evidenceAlias } : {}),
    ...(displayTitleRu !== catalogTitleRu
      ? { displayNormalization: options.displayNormalization || "е-to-ё" }
      : {}),
    evidence: {
      provider: authority,
      url: recordUrl,
      checkedAt: "2026-09-01",
      findingRu: options.evidenceAlias
        ? `${authority} подтверждает российское издание под названием «${catalogTitleRu}»; оригинал в карточке приведён как «${options.evidenceAlias}», а в биографии сохранено точное написание «${sourceTitleExact}».`
        : `${authority} подтверждает российское издание произведения ${sourceTitleExact} под названием «${catalogTitleRu}».`,
      fields: ["works"],
    },
  };
}

const cataloguedRussianPublicationTitles = [
  attestation(
    "afghanistan:khaled_hosseini",
    "The Kite Runner",
    "Бегущий за ветром",
    "https://search.rsl.ru/ru/record/01008135815",
  ),
  attestation(
    "afghanistan:khaled_hosseini",
    "A Thousand Splendid Suns",
    "Тысяча сияющих солнц",
    "https://search.rsl.ru/ru/record/01008164205",
  ),
  attestation(
    "afghanistan:khaled_hosseini",
    "And the Mountains Echoed",
    "И эхо летит по горам",
    "https://phantom-press.ru/product/chosseyni-chaled_i-eho-letit-po-goram/",
    { authority: PHANTOM_PRESS },
  ),
  attestation(
    "colombia:gabriel_garcia_marquez",
    "Cien años de soledad",
    "Сто лет одиночества",
    "https://search.rsl.ru/ru/record/01002460339",
  ),
  attestation(
    "england:charles_dickens",
    "Oliver Twist",
    "Приключения Оливера Твиста",
    "https://search.rsl.ru/ru/record/01007925844",
  ),
  attestation(
    "england:charles_dickens",
    "Great Expectations",
    "Большие надежды",
    "https://search.rsl.ru/ru/record/01004965142",
  ),
  attestation(
    "england:charles_dickens",
    "A Christmas Carol",
    "Рождественская песнь в прозе",
    "https://search.rsl.ru/ru/record/01004859845",
  ),
  attestation(
    "england:charlotte_bronte",
    "Jane Eyre",
    "Джейн Эйр",
    "https://search.rsl.ru/ru/record/01009388331",
  ),
  attestation(
    "england:daniel_defoe",
    "Robinson Crusoe",
    "Робинзон Крузо",
    "https://search.rsl.ru/ru/record/01005467841",
  ),
  attestation(
    "england:daniel_defoe",
    "Moll Flanders",
    "Молль Флендерс",
    "https://search.rsl.ru/ru/record/01002150619",
  ),
  attestation(
    "england:oscar_wilde",
    "The Picture of Dorian Gray",
    "Портрет Дориана Грея",
    "https://search.rsl.ru/ru/record/01009895599",
  ),
  attestation(
    "england:oscar_wilde",
    "The Importance of Being Earnest",
    "Как важно быть серьезным",
    "https://search.rsl.ru/ru/record/01005716508",
    { displayTitleRu: "Как важно быть серьёзным" },
  ),
  attestation(
    "england:robert_louis_stevenson",
    "Treasure Island",
    "Остров сокровищ",
    "https://search.rsl.ru/ru/record/01000641569",
  ),
  attestation(
    "england:robert_louis_stevenson",
    "Kidnapped",
    "Похищенный",
    "https://search.rsl.ru/ru/record/01004940847",
  ),
  attestation(
    "england:robert_louis_stevenson",
    "Strange Case of Dr Jekyll and Mr Hyde",
    "Странная история доктора Джекила и мистера Хайда",
    "https://search.rsl.ru/ru/record/01004626540",
  ),
  attestation(
    "spain:carlos_ruiz_zafon",
    "La sombra del viento",
    "Тень ветра",
    "https://search.rsl.ru/ru/record/01009466661",
  ),
  attestation(
    "spain:carlos_ruiz_zafon",
    "El juego del ángel",
    "Игра ангела",
    "https://search.rsl.ru/ru/record/01008044790",
  ),
  attestation(
    "spain:carlos_ruiz_zafon",
    "El prisionero del cielo",
    "Узник Неба",
    "https://ast.ru/book/uznik-neba-134054/",
    { authority: AST },
  ),
  attestation(
    "usa:andy_weir",
    "The Martian",
    "Марсианин",
    "https://search.rsl.ru/ru/record/01009814922",
  ),
  attestation(
    "usa:andy_weir",
    "Artemis",
    "Артемида",
    "https://ast.ru/book/artemida-831751/",
    { authority: AST },
  ),
  attestation(
    "usa:andy_weir",
    "Project Hail Mary",
    "Проект «Аве Мария»",
    "https://ast.ru/book/proekt-ave-mariya-856798/",
    {
      authority: AST,
      displayTitleRu: "Проект „Аве Мария“",
      displayNormalization: "nested-quotes",
    },
  ),
  attestation(
    "usa:dan_simmons",
    "Hyperion Cantos",
    "Песни Гипериона",
    "https://ast.ru/cycle/pesni-giperiona/",
    { authority: AST },
  ),
  attestation(
    "usa:dan_simmons",
    "The Terror",
    "Террор",
    "https://search.rsl.ru/ru/record/01004834579",
  ),
  attestation(
    "usa:dan_simmons",
    "Song of Kali",
    "Песнь Кали",
    "https://ast.ru/book/pesn-kali-886535/",
    { authority: AST },
  ),
  attestation(
    "usa:daniel_keyes",
    "Flowers for Algernon",
    "Цветы для Элджернона",
    "https://search.rsl.ru/ru/record/01005403940",
    { expectedOccurrences: 2 },
  ),
  attestation(
    "usa:daniel_keyes",
    "The Minds of Billy Milligan",
    "Таинственная история Билли Миллигана",
    "https://search.rsl.ru/ru/record/01008874024",
  ),
  attestation(
    "usa:donna_tartt",
    "The Secret History",
    "Тайная история",
    "https://search.rsl.ru/ru/record/01007861694",
  ),
  attestation(
    "usa:donna_tartt",
    "The Little Friend",
    "Маленький друг",
    "https://ast.ru/book/malenkiy-drug-701162/",
    { authority: AST },
  ),
  attestation(
    "usa:donna_tartt",
    "The Goldfinch",
    "Щегол",
    "https://ast.ru/book/shchegol-155650/",
    { authority: AST, expectedOccurrences: 2 },
  ),
  attestation(
    "usa:ernest_hemingway",
    "The Sun Also Rises",
    "Фиеста (И восходит солнце)",
    "https://search.rsl.ru/ru/record/01002392937",
  ),
  attestation(
    "usa:ernest_hemingway",
    "A Farewell to Arms",
    "Прощай, оружие!",
    "https://search.rsl.ru/ru/record/01002392937",
  ),
  attestation(
    "usa:ernest_hemingway",
    "The Old Man and the Sea",
    "Старик и море",
    "https://search.rsl.ru/ru/record/01004876860",
  ),
  attestation(
    "usa:francis_scott_fitzgerald",
    "This Side of Paradise",
    "По эту сторону рая",
    "https://search.rsl.ru/ru/record/01001698229",
  ),
  attestation(
    "usa:francis_scott_fitzgerald",
    "The Beautiful and Damned",
    "Прекрасные и проклятые",
    "https://search.rsl.ru/ru/record/01008730196",
  ),
  attestation(
    "usa:francis_scott_fitzgerald",
    "The Great Gatsby",
    "Великий Гэтсби",
    "https://search.rsl.ru/ru/record/01008931049",
  ),
  attestation(
    "usa:francis_scott_fitzgerald",
    "Tender Is the Night",
    "Ночь нежна",
    "https://search.rsl.ru/ru/record/01004348768",
  ),
  attestation(
    "usa:edgar_allan_poe",
    "The Murders in the Rue Morgue",
    "Убийство на улице Морг",
    "https://search.rsl.ru/ru/record/01001603014",
  ),
  attestation(
    "usa:edgar_allan_poe",
    "The Raven",
    "Ворон",
    "https://search.rsl.ru/ru/record/01008240101",
    { attestationType: "original-title-linked" },
  ),
  attestation(
    "usa:edgar_allan_poe",
    "The Fall of the House of Usher",
    "Падение дома Ашеров",
    "https://search.rsl.ru/ru/record/01006749040",
  ),
  attestation(
    "usa:eugene_oneill",
    "Long Day’s Journey into Night",
    "Долгое путешествие в ночь",
    "https://rusneb.ru/catalog/000199_000009_006851950/",
    { authority: NEB },
  ),
  attestation(
    "usa:jack_kerouac",
    "On the Road",
    "На дороге",
    "https://ast.ru/book/na-doroge-854348/",
    { authority: AST },
  ),
  attestation(
    "usa:tony_morrison",
    "The Bluest Eye",
    "Самые голубые глаза",
    "https://eksmo.ru/amp/book/samye-golubye-glaza-ITD1059086/",
    { authority: EKSMO },
  ),
  attestation(
    "usa:cormac_mccarthy",
    "Blood Meridian",
    "Кровавый меридиан, или Закатный багрянец на западе",
    "https://azbooka.ru/books/krovavyy-meridian-ili-zakatnyy-bagryanets-na-zapade",
    { authority: AZBOOKA },
  ),
  attestation(
    "usa:cormac_mccarthy",
    "No Country for Old Men",
    "Старикам тут не место",
    "https://search.rsl.ru/ru/record/01004339536",
  ),
  attestation(
    "usa:cormac_mccarthy",
    "The Road",
    "Дорога",
    "https://azbooka.ru/books/doroga-olvr",
    { authority: AZBOOKA, expectedOccurrences: 2 },
  ),
  attestation(
    "usa:don_delillo",
    "White Noise",
    "Белый шум",
    "https://nlr.ru/nlr_visit/dep/artupload/media/db/qa3/NA44657.pdf",
    { authority: NLR },
  ),
  attestation(
    "usa:don_delillo",
    "Libra",
    "Весы",
    "https://search.rsl.ru/ru/record/01002709309",
  ),
  attestation(
    "usa:colson_whitehead",
    "The Underground Railroad",
    "Подземная железная дорога",
    "https://ast.ru/book/podzemnaya-zheleznaya-doroga-827293/",
    { authority: AST },
  ),
  attestation(
    "usa:colson_whitehead",
    "The Nickel Boys",
    "Мальчишки из «Никеля»",
    "https://sindbadbooks.ru/index.php?path=25&product_id=349&route=product%2Fproduct",
    {
      authority: SINDBAD,
      displayTitleRu: "Мальчишки из „Никеля“",
      displayNormalization: "nested-quotes",
    },
  ),
  attestation(
    "usa:chuck_palahniuk",
    "Fight Club",
    "Бойцовский клуб",
    "https://ast.ru/book/boytsovskiy-klub-863988/",
    { authority: AST },
  ),
  attestation(
    "usa:chuck_palahniuk",
    "Invisible Monsters",
    "Невидимки",
    "https://search.rsl.ru/ru/record/01006501978",
  ),
  attestation(
    "usa:chuck_palahniuk",
    "Choke",
    "Удушье",
    "https://ast.ru/book/udushe-858530/",
    { authority: AST },
  ),
  attestation(
    "usa:dan_brown",
    "The Da Vinci Code",
    "Код да Винчи",
    "https://ast.ru/book/kod-da-vinchi-825779/",
    { authority: AST },
  ),
  attestation(
    "usa:dan_brown",
    "Angels & Demons",
    "Ангелы и демоны",
    "https://ast.ru/book/angely-i-demony-136260/",
    { authority: AST },
  ),
  attestation(
    "usa:dan_brown",
    "The Lost Symbol",
    "Утраченный символ",
    "https://ast.ru/book/utrachennyy-simvol-861268/",
    { authority: AST },
  ),
  attestation(
    "usa:dan_brown",
    "Inferno",
    "Инферно",
    "https://ast.ru/book/inferno-125755/",
    { authority: AST },
  ),
  attestation(
    "usa:dan_brown",
    "Origin",
    "Происхождение",
    "https://ast.ru/book/proiskhozhdenie-869805/",
    { authority: AST },
  ),
  attestation(
    "usa:dennis_lehane",
    "Mystic River",
    "Таинственная река",
    "https://azbooka.ru/books/tainstvennaya-reka",
    { authority: AZBOOKA },
  ),
  attestation(
    "usa:dennis_lehane",
    "Shutter Island",
    "Остров проклятых",
    "https://azbooka.ru/books/ostrov-proklyatykh-uiae",
    { authority: AZBOOKA },
  ),
  attestation(
    "usa:dennis_lehane",
    "Gone, Baby, Gone",
    "Прощай, детка, прощай",
    "https://azbooka.ru/books/proshchay-detka-proshchay-spke",
    { authority: AZBOOKA },
  ),
  attestation(
    "usa:ernest_cline",
    "Ready Player One",
    "Первому игроку приготовиться",
    "https://ast.ru/book/pervomu-igroku-prigotovitsya-837562/",
    { authority: AST, expectedOccurrences: 2 },
  ),
  attestation(
    "usa:ernest_cline",
    "Armada",
    "Армада",
    "https://ast.ru/book/armada-719302/",
    { authority: AST },
  ),
  attestation(
    "usa:ernest_cline",
    "Ready Player Two",
    "Второму игроку приготовиться",
    "https://ast.ru/book/vtoromu-igroku-prigotovitsya-866706/",
    { authority: AST },
  ),
  attestation(
    "usa:blake_crouch",
    "Dark Matter",
    "Темная материя",
    "https://eksmo.ru/amp/book/temnaya-materiya-ITD959546/",
    { authority: EKSMO, expectedOccurrences: 2 },
  ),
  attestation(
    "usa:blake_crouch",
    "Recursion",
    "Возвращение",
    "https://eksmo.ru/amp/book/vozvrashchenie-ITD1045825/",
    { authority: EKSMO },
  ),
  attestation(
    "usa:blake_crouch",
    "Wayward Pines",
    "Сосны",
    "https://eksmo.ru/cicle/sosny-ID474/",
    { authority: EKSMO },
  ),
  attestation(
    "colombia:gabriel_garcia_marquez",
    "El amor en los tiempos del cólera",
    "Любовь во время чумы",
    "https://search.rsl.ru/ru/record/01000965138",
  ),
  attestation(
    "mexico:juan_rulfo",
    "El Llano en llamas",
    "Равнина в огне",
    "https://ast.ru/book/pedro-paramo-ravnina-v-ogne-031235/",
    { authority: AST },
  ),
  attestation(
    "mexico:juan_rulfo",
    "Pedro Páramo",
    "Педро Парамо",
    "https://ast.ru/book/pedro-paramo-ravnina-v-ogne-031235/",
    { authority: AST },
  ),
  attestation(
    "chile:isabel_allende",
    "La casa de los espíritus",
    "Дом духов",
    "https://azbooka.ru/books/dom-dukhov",
    { authority: AZBOOKA },
  ),
  attestation(
    "chile:isabel_allende",
    "De amor y de sombra",
    "Любовь и тьма",
    "https://azbooka.ru/books/lyubov-i-tma-bez-supera-ac98",
    { authority: AZBOOKA },
  ),
  attestation(
    "chile:isabel_allende",
    "Eva Luna",
    "Ева Луна",
    "https://azbooka.ru/books/eva-lyna",
    { authority: AZBOOKA },
  ),
  attestation(
    "norway:henrik_ibsen",
    "Et dukkehjem",
    "Кукольный дом",
    "https://search.rsl.ru/ru/record/01004914972",
    { attestationType: "translated-edition-contents" },
  ),
  attestation(
    "norway:henrik_ibsen",
    "Gengangere",
    "Привидения",
    "https://search.rsl.ru/ru/record/01004914972",
    { attestationType: "translated-edition-contents" },
  ),
  attestation(
    "norway:henrik_ibsen",
    "Hedda Gabler",
    "Гедда Габлер",
    "https://search.rsl.ru/ru/record/01004914972",
    { attestationType: "translated-edition-contents" },
  ),
  attestation(
    "norway:henrik_ibsen",
    "Peer Gynt",
    "Пер Гюнт",
    "https://search.rsl.ru/ru/record/01004914972",
    { attestationType: "translated-edition-contents" },
  ),
  attestation(
    "norway:knut_hamsun",
    "Sult",
    "Голод",
    "https://search.rsl.ru/ru/record/01008800922",
    { attestationType: "original-title-linked" },
  ),
  attestation(
    "norway:knut_hamsun",
    "Pan",
    "Пан",
    "https://search.rsl.ru/ru/record/01008800922",
    { attestationType: "original-title-linked" },
  ),
  attestation(
    "norway:sigrid_undset",
    "Kristin Lavransdatter",
    "Кристин, дочь Лавранса",
    "https://search.rsl.ru/ru/record/01009614590",
  ),
  attestation(
    "spain:federico_garcia_lorca",
    "Romancero gitano",
    "Цыганское романсеро",
    "https://search.rsl.ru/ru/record/01001417992",
  ),
  attestation(
    "spain:federico_garcia_lorca",
    "Bodas de sangre",
    "Кровавая свадьба",
    "https://search.rsl.ru/ru/record/01001394316",
    { attestationType: "translated-edition-contents" },
  ),
  attestation(
    "spain:federico_garcia_lorca",
    "Yerma",
    "Йерма",
    "https://search.rsl.ru/ru/record/01001394316",
    { attestationType: "translated-edition-contents" },
  ),
  attestation(
    "portugal:jose_saramago",
    "Memorial do Convento",
    "Воспоминания о монастыре",
    "https://eksmo.ru/book/vospominaniya-o-monastyre-ITD1375851/",
    { authority: EKSMO, attestationType: "original-title-linked" },
  ),
  attestation(
    "portugal:jose_saramago",
    "O Evangelho segundo Jesus Cristo",
    "Евангелие от Иисуса",
    "https://search.rsl.ru/ru/record/01002158456",
    { attestationType: "original-title-linked" },
  ),
  attestation(
    "portugal:jose_saramago",
    "Ensaio sobre a Cegueira",
    "Слепота",
    "https://search.rsl.ru/ru/record/01004088075",
    { attestationType: "original-title-linked" },
  ),
  attestation(
    "sweden:stieg_larsson",
    "Män som hatar kvinnor",
    "Девушка с татуировкой дракона",
    "https://eksmo.ru/book/devushka-s-tatuirovkoy-drakona-ITD1235447/",
    {
      authority: EKSMO,
      evidenceAlias: "Man som hatar kvinnor",
    },
  ),
  attestation(
    "england:david_mitchell",
    "Cloud Atlas",
    "Облачный атлас",
    "https://azbooka.ru/books/oblachnyy-atlas",
    { authority: AZBOOKA },
  ),
  attestation(
    "england:anne_bronte",
    "Agnes Grey",
    "Агнес Грей",
    "https://ast.ru/book/agnes-grey-883788/",
    { authority: AST },
  ),
  attestation(
    "england:anne_bronte",
    "The Tenant of Wildfell Hall",
    "Незнакомка из Уайлдфелл-Холла",
    "https://ast.ru/book/neznakomka-iz-uayldfell-kholla-870567/",
    { authority: AST },
  ),
  attestation(
    "england:emily_bronte",
    "Wuthering Heights",
    "Грозовой перевал",
    "https://search.rsl.ru/ru/record/01009545262",
    {
      attestationType: "original-title-linked",
      evidenceAlias: "Wuthering heights",
    },
  ),
  attestation(
    "england:arthur_conan_doyle",
    "A Study in Scarlet",
    "Этюд в багровых тонах",
    "https://ast.ru/book/etyud-v-bagrovykh-tonakh-721517/",
    { authority: AST },
  ),
  attestation(
    "england:chaucer",
    "The Canterbury Tales",
    "Кентерберийские рассказы",
    "https://ast.ru/book/kenterberiyskie-rasskazy-880594/",
    { authority: AST },
  ),
  attestation(
    "england:hilary_mantel",
    "Wolf Hall",
    "Вулфхолл",
    "https://ast.ru/book/vulfkholl-151003/",
    { authority: AST },
  ),
  attestation(
    "england:hilary_mantel",
    "Bring Up the Bodies",
    "Внесите тела",
    "https://ast.ru/book/vnesite-tela-123853/",
    { authority: AST },
  ),
  attestation(
    "england:roald_dahl",
    "Charlie and the Chocolate Factory",
    "Чарли и шоколадная фабрика",
    "https://samokatbook.ru/book/charli-i-shokoladnaya-fabrika/",
    { authority: SAMOKAT },
  ),
  attestation(
    "england:roald_dahl",
    "Matilda",
    "Матильда",
    "https://samokatbook.ru/book/matilda/",
    { authority: SAMOKAT },
  ),
  attestation(
    "england:thomas_hardy",
    "Tess of the d’Urbervilles",
    "Тэсс из рода д'Эрбервиллей",
    "https://ast.ru/book/tess-iz-roda-d-erbervilley-826602/",
    { authority: AST },
  ),
  attestation(
    "england:rudyard_kipling",
    "The Jungle Book",
    "Книга джунглей",
    "https://search.rsl.ru/ru/record/01004627125",
  ),
  attestation(
    "south_korea:han_kang",
    "The Vegetarian",
    "Вегетарианка",
    "https://ast.ru/book/vegetarianka-829094/",
    { authority: AST },
  ),
  attestation(
    "turkey:elif_shafak",
    "The Bastard of Istanbul",
    "Стамбульский бастард",
    "https://azbooka.ru/books/stambulskiy-bastard",
    { authority: AZBOOKA },
  ),
  attestation(
    "turkey:elif_shafak",
    "The Forty Rules of Love",
    "Сорок правил любви",
    "https://azbooka.ru/books/sorok-pravil-lyubvi",
    { authority: AZBOOKA },
  ),
  attestation(
    "jamaica:marlon_james",
    "A Brief History of Seven Killings",
    "Краткая история семи убийств",
    "https://eksmo.ru/amp/book/kratkaya-istoriya-semi-ubiystv-ITD825374/",
    { authority: EKSMO },
  ),
  attestation(
    "usa:dean_koontz",
    "Odd Thomas",
    "Странный Томас",
    "https://eksmo.ru/book/strannyy-tomas-ITD234708/",
    { authority: EKSMO },
  ),
  attestation(
    "israel:david_grossman",
    "A Horse Walks Into a Bar",
    "Как-то лошадь входит в бар",
    "https://eksmo.ru/book/kak-to-loshad-vkhodit-v-bar-ITD1415819/",
    {
      authority: EKSMO,
      evidenceAlias: "A Horse Walks into a Bar",
    },
  ),
  attestation(
    "south_africa:damon_galgut",
    "The Promise",
    "Обещание",
    "https://eksmo.ru/book/obeshchanie-ITD1362261/",
    { authority: EKSMO },
  ),
  attestation(
    "rwanda:scholastique_mukasonga",
    "Notre-Dame du Nil",
    "Богоматерь Нильская",
    "https://eksmo.ru/book/bogomater-nilskaya-ITD1250971/",
    { authority: EKSMO },
  ),
  attestation(
    "spain:arturo_perez_reverte",
    "El club Dumas",
    "Клуб Дюма, или Тень Ришелье",
    "https://eksmo.ru/book/klub-dyuma-ili-ten-rishele-ITD305427/",
    {
      authority: EKSMO,
      evidenceAlias: "El Club Dumas",
    },
  ),
  attestation(
    "spain:arturo_perez_reverte",
    "La carta esférica",
    "Карта небесной сферы, или Тайный меридиан",
    "https://eksmo.ru/book/karta-nebesnoy-sfery-ili-taynyy-meridian-ITD633798/",
    {
      authority: EKSMO,
      evidenceAlias: "LA CARTA ESFÉRICA",
    },
  ),
  attestation(
    "uruguay:eduardo_galeano",
    "Las venas abiertas de América Latina",
    "Вскрытые вены Латинской Америки: Пять веков разграбления",
    "https://azbooka.ru/books/vskrytye-veny-latinskoy-ameriki-pyat-vekov-razgrableniya",
    { authority: AZBOOKA },
  ),
];

function entryIdentity(entry) {
  return `${entry.key}\u0000${entry.sourceTitleExact}`;
}

function validateEntry(entry, index) {
  const label = `cataloguedRussianPublicationTitles[${index}]`;
  if (
    !/^[\p{Ll}\p{Lo}\p{M}\p{N}_\u00ad-]+:[\p{Ll}\p{Lo}\p{M}\p{N}_\u00ad-]+$/u.test(
      entry?.key || "",
    )
  ) {
    throw new Error(`${label}: invalid writer key`);
  }
  if (
    !/\p{Script=Latin}/u.test(entry.sourceTitleExact || "") ||
    !/\p{Script=Cyrillic}/u.test(entry.catalogTitleRu || "") ||
    !/\p{Script=Cyrillic}/u.test(entry.displayTitleRu || "") ||
    entry.sourceTitleExact === entry.displayTitleRu ||
    entry.status !== "russian-edition-attested" ||
    !new Set([
      "translated-edition-record",
      "translated-edition-contents",
      "original-title-linked",
      "official-publisher-edition",
    ]).has(entry.attestationType) ||
    !Number.isInteger(entry.expectedOccurrences) ||
    entry.expectedOccurrences < 1
  ) {
    throw new Error(
      `${label}: an original title and a distinct Russian title are required`,
    );
  }
  if (
    entry.evidenceAlias !== undefined &&
    (!/\p{Script=Latin}/u.test(entry.evidenceAlias) ||
      entry.evidenceAlias === entry.sourceTitleExact)
  ) {
    throw new Error(`${label}: invalid evidence alias`);
  }
  if (
    !new Set([
      RSL,
      NEB,
      NLR,
      AST,
      PHANTOM_PRESS,
      AZBOOKA,
      EKSMO,
      SINDBAD,
      SAMOKAT,
    ]).has(entry.evidence?.provider) ||
    !(
      /^https:\/\/search\.rsl\.ru\/ru\/record\/\d+$/u.test(
        entry.evidence?.url || "",
      ) ||
      /^https:\/\/(?:ast\.ru|phantom-press\.ru|samokatbook\.ru)\/.+/u.test(
        entry.evidence?.url || "",
      ) ||
      /^https:\/\/(?:rusneb\.ru\/catalog|azbooka\.ru\/books|eksmo\.ru\/(?:amp\/)?(?:book|cicle)|sindbadbooks\.ru\/index\.php).+/u.test(
        entry.evidence?.url || "",
      ) ||
      /^https:\/\/nlr\.ru\/.+\.pdf$/u.test(entry.evidence?.url || "")
    ) ||
    !/^\d{4}-\d{2}-\d{2}$/u.test(entry.evidence?.checkedAt || "") ||
    !String(entry.evidence?.findingRu || "").includes(entry.catalogTitleRu) ||
    JSON.stringify(entry.evidence?.fields) !== JSON.stringify(["works"])
  ) {
    throw new Error(`${label}: exact Russian-edition evidence is required`);
  }
  const normalizedDisplayAllowed =
    (entry.displayNormalization === "е-to-ё" &&
      entry.catalogTitleRu.replace(/ё/gu, "е") ===
        entry.displayTitleRu.replace(/ё/gu, "е")) ||
    (entry.displayNormalization === "nested-quotes" &&
      entry.catalogTitleRu.replace(/«/gu, "„").replace(/»/gu, "“") ===
        entry.displayTitleRu);
  if (
    entry.catalogTitleRu !== entry.displayTitleRu &&
    !normalizedDisplayAllowed
  ) {
    throw new Error(`${label}: unsupported display-title normalization`);
  }
}

const identities = new Set();
for (const [index, entry] of cataloguedRussianPublicationTitles.entries()) {
  validateEntry(entry, index);
  const identity = entryIdentity(entry);
  if (identities.has(identity)) {
    throw new Error(
      `Duplicate catalogued Russian publication title: ${identity}`,
    );
  }
  identities.add(identity);
  Object.freeze(entry.evidence);
  Object.freeze(entry);
}

export const writerBiographyRussianPublicationTitles = Object.freeze(
  cataloguedRussianPublicationTitles,
);

export function russianPublicationTitleEntriesForKey(key) {
  return writerBiographyRussianPublicationTitles.filter(
    (entry) => entry.key === key,
  );
}

export function applyCataloguedRussianPublicationTitles(key, value) {
  let text = String(value || "");
  for (const entry of russianPublicationTitleEntriesForKey(key)) {
    text = text.replaceAll(
      `«${entry.sourceTitleExact}»`,
      `«${entry.displayTitleRu}»`,
    );
  }
  return text;
}

export function russianPublicationTitleApplicationIssues(key, before, after) {
  const issues = [];
  for (const entry of russianPublicationTitleEntriesForKey(key)) {
    const originalToken = `«${entry.sourceTitleExact}»`;
    const russianToken = `«${entry.displayTitleRu}»`;
    const occurrences = String(before || "").split(originalToken).length - 1;
    if (occurrences !== entry.expectedOccurrences) {
      issues.push(
        `${entry.sourceTitleExact}: expected ${entry.expectedOccurrences} quoted occurrence(s), found ${occurrences}`,
      );
    }
    if (String(after || "").includes(originalToken)) {
      issues.push(`${entry.sourceTitleExact}: original quoted title remains`);
    }
    if (!String(after || "").includes(russianToken)) {
      issues.push(
        `${entry.sourceTitleExact}: catalogued Russian title is absent`,
      );
    }
  }
  return issues;
}
