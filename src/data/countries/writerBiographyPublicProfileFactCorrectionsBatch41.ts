import type { WriterProfile } from "./types";

export type WriterPublicProfileFactCorrectionBatch41 = {
  countryId: string;
  writerId: string;
  patch: Partial<WriterProfile>;
  evidence: Array<{ provider: string; url: string; checkedAt: string }>;
  note: string;
};

const checkedAt = "2026-08-14";

function sources(
  provider: string,
  url: string,
  secondProvider: string,
  secondUrl: string
) {
  return [
    { provider, url, checkedAt },
    { provider: secondProvider, url: secondUrl, checkedAt },
  ];
}

export const writerBiographyPublicProfileFactCorrectionsBatch41 = [
  {
    countryId: "myanmar",
    writerId: "min_thu_wun",
    patch: {
      name: "Мин Тувун",
      birthPlace: "Кунджангон, Мьянма",
      coordinates: { lat: 16.4426, lng: 96.0194 },
      works: [],
      genres: ["поэзия", "эссе", "филология", "детская литература"],
    },
    evidence: sources(
      "Chiang Mai University conference proceedings",
      "https://www.burmaconference.com/wp-content/uploads/2025/01/ICBMS4-proceedings-final-J-R.pdf",
      "Ministry of the Office of the President of Myanmar",
      "https://presoffministry.gov.mm/en/article/36739"
    ),
    note: "Имя и место рождения исправлены; координаты перенесены из ошибочного Кьяуксе в Кунджангон, служебное название Poems and Essays удалено, а документированные направления работы добавлены.",
  },
  {
    countryId: "myanmar",
    writerId: "thakin_kodaw_hmaing",
    patch: {
      name: "Такин Кодо Хмайн",
      birthPlace: "деревня Вале, тауншип Шведаун, Мьянма",
      coordinates: { lat: 18.5661, lng: 95.2124 },
      works: [],
      genres: ["поэзия", "драматургия", "журналистика", "политическая публицистика"],
    },
    evidence: sources(
      "Ministry of Information of Myanmar",
      "https://myanmar.gov.mm/documents/20143/2936705/31_Aug_19_gnlm.pdf/c604c5e2-90df-7ba2-ca7c-f5dbbdad7e6c?t=1567229534510",
      "GeoNames",
      "https://www.geonames.org/11154227/shwedaung-township.html"
    ),
    note: "Имя и место рождения исправлены; координаты перенесены из ошибочного Мандалая к тауншипу Шведаун. Неподтверждённое Myo Chit Thu и служебная рубрика удалены, жанры приведены к источникам.",
  },
  {
    countryId: "myanmar",
    writerId: "ma_ma_lay",
    patch: {
      works: ["Not Out of Hate", "A Man Like Him"],
      genres: ["роман", "социальная проза", "редакторская работа"],
    },
    evidence: sources(
      "Ohio University Press",
      "https://www.ohioswallow.com/author/ma-ma-lay/",
      "Cornell University",
      "https://ecommons.cornell.edu/bitstreams/6bbdd02d-da23-4235-bcdf-f87d500c86d1/download"
    ),
    note: "Неподтверждённое Mother заменено двумя каталогизированными романами; редакторская работа и литературные жанры приведены к источникам.",
  },
  {
    countryId: "myanmar",
    writerId: "theippan_maung_wa",
    patch: {
      name: "Тейппан Маун Ва",
      fullName: "U Sein Tin (Theippan Maung Wa)",
      birthDate: "1899",
      deathDate: "1942",
      works: ["Wartime in Burma"],
      genres: ["проза", "дневник"],
    },
    evidence: sources(
      "Ohio University Press",
      "https://www.ohioswallow.com/9780896804715/wartime-in-burma/",
      "J-STAGE",
      "https://www.jstage.jst.go.jp/article/sea1971/1991/20/1991_20_35/_article"
    ),
    note: "Русское имя и псевдоним уточнены; технические даты 1 января сведены к годам, а общая рубрика заменена опубликованным дневником.",
  },
  {
    countryId: "myanmar",
    writerId: "ludu_daw_amar",
    patch: {
      name: "Люду До Амар",
      works: [],
      genres: ["эссе", "журналистика", "редакторская работа", "история культуры"],
    },
    evidence: sources(
      "Cambridge University Press",
      "https://www.cambridge.org/core/books/abs/female-voice-of-myanmar/ludu-daw-amar-the-voice-of-unity/116EF77DC8AB6E5B542F13FC411558A6",
      "Cornell University",
      "https://ecommons.cornell.edu/bitstreams/5dc51a24-1240-4072-beb1-17e1b80d3c8c/download"
    ),
    note: "Русская передача имени и профессиональные области уточнены; служебные названия в works удалены.",
  },
  {
    countryId: "nepal",
    writerId: "bhanubhakta_acharya",
    patch: {
      deathDate: "1868",
      works: ["Bhanubhakta Ramayana"],
      genres: ["поэзия", "эпос", "перевод"],
    },
    evidence: sources(
      "Purbanchal University",
      "https://www.purbanchaluniversity.edu.np/news/detail/pu-s-vc-dr.-thapaliya-extends-warm-wishes-on-bhanu-jayanti-celebration-240713121054",
      "Indian Institute of Technology Kanpur",
      "https://www.nepali.iitk.ac.in/bio"
    ),
    note: "Неподтверждённый точный день смерти сведен к году; перевод и жанры оставлены только в подтверждённой форме.",
  },
  {
    countryId: "nepal",
    writerId: "bp_koirala",
    patch: {
      name: "Бишвешвар Прасад Коирала",
      birthDate: "1914",
      deathDate: "1982",
      works: ["Teen Ghumti", "Sumnima", "Narendra Dai"],
      genres: ["роман", "проза"],
    },
    evidence: sources(
      "Embassy of India in Kathmandu",
      "https://www.indembkathmandu.gov.in/about-b-p-koirala-foundation",
      "Tribhuvan University",
      "https://elibrary.tucl.edu.np/JQ99OgQIizUxyjI9nB0on9OyLkqsGIf4/api/core/bitstreams/5e37fd64-281c-4238-9043-eb9a16194dfa/content"
    ),
    note: "Имя раскрыто; неподтверждённая точность дней рождения и смерти сведена к годам, произведения и жанры приведены к официальному и университетскому источникам.",
  },
  {
    countryId: "nepal",
    writerId: "laxmi_prasad_devkota",
    patch: {
      works: ["Muna Madan", "Shakuntala", "Sulochana"],
      genres: ["поэзия", "эпос", "драматургия", "эссе"],
    },
    evidence: sources(
      "Sanskritik Sansthan, Government of Nepal",
      "https://www.sanskritiksansthan.gov.np/content/628",
      "Tribhuvan University",
      "https://elibrary.tucl.edu.np/JQ99OgQIizUxyjI9nB0on9OyLkqsGIf4/api/core/bitstreams/aa69e41a-1163-4dba-a528-1e6d7b5c555a/content"
    ),
    note: "Оценочные формулы заменены проверенной библиографией; драматургия и эссе добавлены как документированные направления работы.",
  },
  {
    countryId: "nepal",
    writerId: "krishna_dharabasi",
    patch: {
      fullName: "Krishna Prasad Bhattarai (Krishna Dharabasi)",
      birthDate: "",
      works: ["Radha"],
      awards: ["Madan Puraskar за роман Radha"],
      genres: ["роман", "проза"],
    },
    evidence: sources(
      "Madan Puraskar Guthi",
      "https://guthi.madanpuraskar.org/people/krishna-dharabasi/",
      "Tribhuvan University",
      "https://elibrary.tucl.edu.np/bitstreams/f64c1be7-8050-4cf1-a1b6-eaf48f9032c4/download"
    ),
    note: "Добавлено настоящее имя; неподтверждённая техническая дата удалена, произведение и награда заменены официально документированными.",
  },
  {
    countryId: "nepal",
    writerId: "manjushree_thapa",
    patch: {
      birthDate: "1968",
      works: ["The Tutor of History", "Seasons of Flight"],
      genres: ["роман", "эссе", "перевод"],
    },
    evidence: sources(
      "Library of Congress",
      "https://www.loc.gov/acq/overseas-offices/delhi/salrp/manjushreethapa.html",
      "Manjushree Thapa author bibliography",
      "https://manjushreethapa.com/"
    ),
    note: "Дата-сентинел 1 января сведена к году; переводческая работа и книги приведены к источникам.",
  },
  {
    countryId: "nepal",
    writerId: "parijat",
    patch: {
      birthDate: "1937",
      deathDate: "1993",
      works: ["Shirishko Phool"],
      awards: ["Madan Puraskar за роман Shirishko Phool"],
    },
    evidence: sources(
      "Madan Puraskar Guthi",
      "https://guthi.madanpuraskar.org/people/parijat/",
      "University of California Press / eScholarship",
      "https://pub-ucpec2-prd.cdlib.org/ucpressebooks/view?anchor.id=0&brand=eschol&chunk.id=d0e7288&doc.view=content&docId=ft729007x1&toc.depth=1"
    ),
    note: "Спорные точные дни сведены к годам; оригинальное название романа и официальная премия добавлены.",
  },
  {
    countryId: "netherlands",
    writerId: "alexandre_olivier_exquemelin",
    patch: {
      years: "ок. 1645–1707",
      birthDate: "ок. 1645",
      works: ["De Americaensche Zee-Roovers"],
      genres: ["мемуарная проза", "путевая проза", "историческое свидетельство"],
    },
    evidence: sources(
      "Library of Congress",
      "https://www.loc.gov/exhibits/exploring-the-early-americas/interactives/buccaneers-of-america/index.html",
      "Digital Library for Dutch Literature",
      "https://www.dbnl.org/tekst/exqu001amer02_01/exqu001amer02_01_0001.php"
    ),
    note: "Приблизительная дата обозначена явно; библиография и жанры приведены к первому нидерландскому изданию.",
  },
  {
    countryId: "netherlands",
    writerId: "anne_frank",
    patch: {
      deathDate: "1945",
      works: ["Het Achterhuis"],
      genres: ["дневник", "автобиографическая проза"],
    },
    evidence: sources(
      "Anne Frank House",
      "https://www.annefrank.org/en/anne-frank/diary/publication-diary/",
      "UNESCO Memory of the World",
      "https://www.unesco.org/en/memory-world/diaries-anne-frank?hub=701"
    ),
    note: "Искусственно точный день смерти сведён к подтверждённому году; название первого нидерландского издания и жанры уточнены.",
  },
  {
    countryId: "netherlands",
    writerId: "betje_wolff",
    patch: {
      works: ["Historie van mejuffrouw Sara Burgerhart"],
      genres: ["роман", "эпистолярный роман"],
    },
    evidence: sources(
      "Digital Library for Dutch Literature",
      "https://www.dbnl.org/auteurs/auteur.php?id=wolf016",
      "WorldCat",
      "https://search.worldcat.org/search?q=au%3A%22Betje+Wolff%22"
    ),
    note: "Переводная рубрика заменена оригинальным названием совместного эпистолярного романа Вольф и Декен.",
  },
  {
    countryId: "netherlands",
    writerId: "erasmus_rotterdam",
    patch: {
      years: "1466/1467/1469–1536",
      birthDate: "1466/1467/1469",
      works: ["Moriae encomium (Похвала глупости)"],
      genres: ["гуманистическая проза", "филология", "богословие"],
    },
    evidence: sources(
      "Stanford Encyclopedia of Philosophy",
      "https://plato.stanford.edu/entries/erasmus/",
      "Erasmus House museum",
      "https://erasmushouse.museum/wp-content/uploads/2020/06/Dossier_docent-1.pdf"
    ),
    note: "Ложная точность года и дня рождения заменена тремя документированными вариантами; труд и дисциплины приведены к источникам.",
  },
  {
    countryId: "netherlands",
    writerId: "frederik_van_eeden",
    patch: {
      works: ["De kleine Johannes", "Van de koele meren des doods"],
      genres: ["роман", "поэзия", "эссе"],
    },
    evidence: sources(
      "Digital Library for Dutch Literature",
      "https://www.dbnl.org/tekst/bork001schr01_01/bork001schr01_01_0297.php",
      "WorldCat",
      "https://search.worldcat.org/search?q=au%3A%22Frederik+van+Eeden%22"
    ),
    note: "Переводное название заменено оригинальным и добавлен второй подтверждённый роман; жанры уточнены.",
  },
  {
    countryId: "netherlands",
    writerId: "harry_mulisch",
    patch: {
      works: ["De aanslag", "De ontdekking van de hemel"],
      genres: ["роман", "драматургия", "эссе"],
    },
    evidence: sources(
      "Dutch Foundation for Literature",
      "https://www.letterenfonds.nl/en/authors/harry-mulisch",
      "Library of Congress",
      "https://id.loc.gov/authorities/names/n79109076.html"
    ),
    note: "Переводные названия приведены к нидерландским оригиналам, документированные жанры дополнены.",
  },
  {
    countryId: "netherlands",
    writerId: "herman_koch",
    patch: {
      works: ["Het diner", "Zomerhuis met zwembad", "Geachte heer M."],
      genres: ["роман", "проза"],
    },
    evidence: sources(
      "Dutch Foundation for Literature",
      "https://www.letterenfonds.nl/en/authors/herman-koch",
      "WorldCat",
      "https://search.worldcat.org/search?q=au%3A%22Herman+Koch%22"
    ),
    note: "Переводная заглушка заменена тремя оригинальными названиями романов из литературного фонда и каталога.",
  },
  {
    countryId: "netherlands",
    writerId: "joost_van_den_vondel",
    patch: {
      works: ["Gijsbrecht van Aemstel", "Lucifer", "Jeptha"],
      genres: ["поэзия", "драматургия"],
    },
    evidence: sources(
      "Digital Library for Dutch Literature",
      "https://www.dbnl.org/tekst/bork001nede01_01/bork001nede01_01_1391.php",
      "WorldCat",
      "https://search.worldcat.org/search?q=au%3A%22Joost+van+den+Vondel%22"
    ),
    note: "Одна переводная пьеса заменена тремя оригинальными названиями, жанры приведены к литературному справочнику.",
  },
  {
    countryId: "netherlands",
    writerId: "louis_couperus",
    patch: {
      works: ["Eline Vere", "De stille kracht", "Van oude menschen, de dingen, die voorbij gaan"],
      genres: ["роман", "путевая проза"],
    },
    evidence: sources(
      "Dutch Foundation for Literature",
      "https://www.letterenfonds.nl/en/authors/louis-couperus",
      "Digital Library for Dutch Literature",
      "https://www.dbnl.org/tekst/bast002loui01_01/bast002loui01_01.pdf"
    ),
    note: "Переводная заглушка заменена тремя оригинальными романами; путевая проза добавлена как документированный жанр.",
  },
  {
    countryId: "netherlands",
    writerId: "multatuli",
    patch: {
      fullName: "Eduard Douwes Dekker (Multatuli)",
      works: ["Max Havelaar"],
      genres: ["роман", "публицистика", "сатира"],
    },
    evidence: sources(
      "Dutch Foundation for Literature",
      "https://www.letterenfonds.nl/en/authors/multatuli",
      "WorldCat",
      "https://search.worldcat.org/search?q=au%3A%22Multatuli%22"
    ),
    note: "Авторитетная форма настоящего имени соединена с псевдонимом; оригинальное название и жанры уточнены.",
  },
  {
    countryId: "netherlands",
    writerId: "cees_nooteboom",
    patch: {
      years: "1933–2026",
      deathDate: "2026-02-11",
      works: ["Rituelen", "Het volgende verhaal"],
      genres: ["роман", "поэзия", "эссе", "путевая проза"],
    },
    evidence: sources(
      "Dutch Foundation for Literature",
      "https://www.letterenfonds.nl/en/whats-happening/in-memoriam-cees-nooteboom",
      "Akademie der Künste",
      "https://adk.de/presse/pressemitteilungen/pm-akademie-der-kuenste-trauert-um-cees-nooteboom-1933-2026"
    ),
    note: "Добавлена документированная смерть 11 февраля 2026 года; жанры и оригинальные названия книг уточнены.",
  },
  {
    countryId: "new_zealand",
    writerId: "allen_curnow",
    patch: {
      works: ["Early Days Yet", "Continuum: New and Later Poems"],
      genres: ["поэзия", "литературная критика", "редакторская работа"],
    },
    evidence: sources(
      "Read NZ Te Pou Muramura",
      "https://www.read-nz.org/writers-files/writer/curnow-allen",
      "Arts Foundation of New Zealand",
      "https://www.thearts.co.nz/artists/allen-curnow"
    ),
    note: "Общая рубрика Collected Poems заменена конкретным поздним сборником; критика и редакторская работа добавлены по национальным источникам.",
  },
  {
    countryId: "new_zealand",
    writerId: "bill_manhire",
    patch: {
      works: ["Milky Way Bar", "Lifted"],
      genres: ["поэзия", "проза", "редакторская работа"],
    },
    evidence: sources(
      "Read NZ Te Pou Muramura",
      "https://www.read-nz.org/writers-files/writer/manhire-bill",
      "Arts Foundation of New Zealand",
      "https://www.thearts.co.nz/artists/bill-manhire"
    ),
    note: "Неподтверждённое The New Land заменено сборником Lifted; литературные роли приведены к национальным источникам.",
  },
  {
    countryId: "new_zealand",
    writerId: "bruce_mason",
    patch: {
      birthPlace: "Веллингтон, Новая Зеландия",
      coordinates: { lat: -41.2865, lng: 174.7762 },
      works: ["The Pohutukawa Tree", "The End of the Golden Weather"],
      genres: ["драматургия", "актёрское искусство", "театральная критика"],
    },
    evidence: sources(
      "Dictionary of New Zealand Biography",
      "https://teara.govt.nz/en/biographies/5m37/mason-bruce-edward-george",
      "Read NZ Te Pou Muramura",
      "https://www.read-nz.org/writers-files/writer/mason-bruce"
    ),
    note: "Ошибочные Вангануи и координаты исправлены на Веллингтон; роли и пьесы уточнены.",
  },
  {
    countryId: "new_zealand",
    writerId: "c_k_stead",
    patch: {
      name: "Кристиан Карлсон Стед",
      fullName: "Christian Karlson Stead",
      works: ["All Visitors Ashore", "The Death of the Body", "Mansfield"],
      genres: ["поэзия", "роман", "литературная критика"],
    },
    evidence: sources(
      "Read NZ Te Pou Muramura",
      "https://www.read-nz.org/writers-files/writer/stead-c-k-",
      "Arts Foundation of New Zealand",
      "https://www.thearts.co.nz/artists/c-k-stead"
    ),
    note: "Инициалы раскрыты по авторитетной форме имени; произведения и три документированные литературные роли сохранены без оценочных формул.",
  },
  {
    countryId: "new_zealand",
    writerId: "damien_wilkins",
    patch: {
      name: "Дэмиен Уилкинс",
      birthPlace: "Лоуэр-Хатт, Новая Зеландия",
      coordinates: { lat: -41.2127, lng: 174.8997 },
      works: ["The Miserables", "The Veteran Perils", "Max Gate"],
      genres: ["роман", "рассказ", "поэзия"],
    },
    evidence: sources(
      "Read NZ Te Pou Muramura",
      "https://www.read-nz.org/writers-files/writer/wilkins-damien",
      "WorldCat",
      "https://search.worldcat.org/search?q=au%3A%22Damien+Wilkins%22"
    ),
    note: "Исправлены русское имя, место рождения и координаты; ошибочное Dad заменено документированными книгами.",
  },
  {
    countryId: "new_zealand",
    writerId: "eleanor_catton",
    patch: {
      birthPlace: "Лондон, Онтарио, Канада",
      coordinates: { lat: 42.9849, lng: -81.2453 },
      works: ["The Rehearsal", "The Luminaries", "Birnam Wood"],
      awards: ["Букеровская премия за The Luminaries, 2013"],
    },
    evidence: sources(
      "Read NZ Te Pou Muramura",
      "https://www.read-nz.org/writers-files/writer/catton-eleanor/",
      "The Booker Prizes",
      "https://thebookerprizes.com/the-booker-library/authors/eleanor-catton"
    ),
    note: "Британские координаты Лондона заменены на Лондон в Онтарио; книги и премия приведены к оригинальным названиям.",
  },
  {
    countryId: "new_zealand",
    writerId: "elizabeth_knox",
    patch: {
      works: ["The Vintner’s Luck", "Dreamhunter", "Dreamquake"],
      genres: ["роман", "фэнтези", "литература для подростков"],
    },
    evidence: sources(
      "Read NZ Te Pou Muramura",
      "https://www.read-nz.org/writers-files/writer/knox-elizabeth",
      "Arts Foundation of New Zealand",
      "https://www.thearts.co.nz/artists/elizabeth-knox"
    ),
    note: "Название приведено к типографски корректной форме; аудитории и жанры трёх романов уточнены по национальным источникам.",
  },
  {
    countryId: "new_zealand",
    writerId: "fiona_kidman",
    patch: {
      birthPlace: "Хавера, Новая Зеландия",
      coordinates: { lat: -39.5917, lng: 174.2839 },
      works: ["The Book of Secrets", "This Mortal Boy", "Songs from the Violet Café"],
      awards: ["Acorn Foundation Fiction Prize за This Mortal Boy, 2019"],
    },
    evidence: sources(
      "Read NZ Te Pou Muramura",
      "https://www.read-nz.org/writers-files/writer/kidman-fiona",
      "Arts Foundation of New Zealand",
      "https://www.thearts.co.nz/artists/fiona-kidman"
    ),
    note: "Крайстчерч и его координаты заменены на Хаверу; премия записана с критерием и годом.",
  },
  {
    countryId: "new_zealand",
    writerId: "frank_sargeson",
    patch: {
      fullName: "Norris Frank Davey (Frank Sargeson)",
      works: ["That Summer", "The Stories of Frank Sargeson"],
      genres: ["рассказ", "роман", "драматургия"],
    },
    evidence: sources(
      "Dictionary of New Zealand Biography",
      "https://teara.govt.nz/en/biographies/4s5/sargeson-frank/print",
      "Read NZ Te Pou Muramura",
      "https://www.read-nz.org/writers-files/writer/sargeson-frank"
    ),
    note: "Добавлено имя при рождении; общая редакторская подборка заменена установленным сборником и жанрами.",
  },
  {
    countryId: "new_zealand",
    writerId: "james_k_baxter",
    patch: {
      name: "Джеймс Кир Бакстер",
      fullName: "James Keir Baxter",
      works: ["Pig Island Letters", "Jerusalem Sonnets"],
      genres: ["поэзия", "драматургия", "литературная критика"],
    },
    evidence: sources(
      "Dictionary of New Zealand Biography",
      "https://teara.govt.nz/en/biographies/5b14/baxter-james-keir",
      "Read NZ Te Pou Muramura",
      "https://www.read-nz.org/writers-files/writer/baxter-james-k-"
    ),
    note: "Инициалы раскрыты по авторитетной форме; библиография и жанры уточнены.",
  },
  {
    countryId: "new_zealand",
    writerId: "jane_mander",
    patch: {
      birthPlace: "Рамарама, Новая Зеландия",
      coordinates: { lat: -37.148, lng: 174.97 },
      works: ["The Story of a New Zealand River", "Allen Adair"],
      genres: ["роман", "журналистика"],
    },
    evidence: sources(
      "Dictionary of New Zealand Biography",
      "https://teara.govt.nz/en/biographies/4m34/mander-mary-jane",
      "Read NZ Te Pou Muramura",
      "https://www.read-nz.org/writers-files/writer/mander-jane"
    ),
    note: "Онехунга и её координаты заменены на Рамараму; второй роман и жанры уточнены.",
  },
  {
    countryId: "new_zealand",
    writerId: "janet_frame",
    patch: {
      works: ["Owls Do Cry", "Faces in the Water", "An Angel at My Table"],
      genres: ["роман", "рассказ", "поэзия", "автобиографическая проза"],
    },
    evidence: sources(
      "Dictionary of New Zealand Biography",
      "https://teara.govt.nz/en/biographies/6f1/frame-janet-paterson",
      "Read NZ Te Pou Muramura",
      "https://www.read-nz.org/writers-files/writer/frame-janet"
    ),
    note: "Произведения приведены к оригинальным названиям; автобиографическая проза добавлена как документированный жанр.",
  },
  {
    countryId: "new_zealand",
    writerId: "kate_de_goldi",
    patch: {
      works: ["The 10 PM Question", "From the Cutting Room of Barney Kettle"],
      genres: ["проза", "подростковая литература", "детская литература"],
    },
    evidence: sources(
      "Read NZ Te Pou Muramura",
      "https://www.read-nz.org/writers-files/writer/de-goldi-kate",
      "WorldCat",
      "https://search.worldcat.org/search?q=au%3A%22Kate+De+Goldi%22"
    ),
    note: "Два подтверждённых произведения сохранены, аудитории и жанры приведены к национальному профилю и библиотечному каталогу.",
  },
  {
    countryId: "new_zealand",
    writerId: "katherine_mansfield",
    patch: {
      fullName: "Kathleen Mansfield Beauchamp (Katherine Mansfield)",
      works: ["Bliss and Other Stories", "The Garden Party and Other Stories"],
      genres: ["рассказ", "модернизм"],
    },
    evidence: sources(
      "Dictionary of New Zealand Biography",
      "https://teara.govt.nz/en/biographies/3m42/mansfield-katherine",
      "Read NZ Te Pou Muramura",
      "https://www.read-nz.org/writers-files/writer/mansfield-katherine"
    ),
    note: "Авторитетная форма имени дополнена псевдонимом; русские названия отдельных рассказов заменены двумя сборниками.",
  },
] satisfies readonly WriterPublicProfileFactCorrectionBatch41[];
