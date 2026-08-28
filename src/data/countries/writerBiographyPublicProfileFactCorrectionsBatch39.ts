import type { WriterProfile } from "./types";

export type WriterPublicProfileFactCorrectionBatch39 = {
  countryId: string;
  writerId: string;
  patch: Partial<WriterProfile>;
  evidence: Array<{
    provider: string;
    url: string;
    checkedAt: string;
  }>;
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

export const writerBiographyPublicProfileFactCorrectionsBatch39 = [
  {
    countryId: "mali",
    writerId: "modibo_sounkalo_keita",
    patch: {
      years: "1948-",
      deathDate: "",
      works: ["L’Archer bassari", "L’Orphelin"],
      genres: ["роман", "рассказ"],
    },
    evidence: sources(
      "Institut français de Mauritanie",
      "https://mediatheque-ifm.org/index.php?id=16975&lvl=author_see",
      "Persée",
      "https://www.persee.fr/doc/cea_0008-0055_1983_num_23_92_2244_t1_0514_0000_1"
    ),
    note: "Неподтверждённый 2021 год смерти удалён; библиография и жанры заменены каталогизированными данными.",
  },
  {
    countryId: "mali",
    writerId: "yambo_ouologuem",
    patch: {
      birthDate: "1940",
      deathDate: "2017",
      works: ["Le Devoir de violence"],
      awards: ["Премия Ренодо, 1968"],
    },
    evidence: sources(
      "Bibliothèque nationale de France",
      "https://catalogue.bnf.fr/ark%3A/12148/cb455136207",
      "WorldCat",
      "https://search.worldcat.org/search?q=au%3A%22Ouologuem%2C+Yambo%22"
    ),
    note: "Неподтверждённые точные дни сведены к годам; название романа и год премии приведены к источникам.",
  },
  {
    countryId: "malta",
    writerId: "anton_manuel_caruana",
    patch: {
      name: "Антонио Эмануэле Каруана",
      fullName: "Antonio Emanuele Caruana",
      years: "1839-1907",
      birthDate: "1839",
      deathDate: "1907",
      works: ["Ineż Farruġ", "Vocabolario della lingua maltese"],
      genres: ["роман", "филология", "исторические исследования"],
    },
    evidence: sources(
      "University of Malta Library",
      "https://www.um.edu.mt/library/oar/handle/123456789/50140",
      "National Library of Malta",
      "https://nla.gov.mt/wp-content/uploads/2024/03/LRC-Malta-catalogue-20.03.24.pdf"
    ),
    note: "Имя, годы, произведения и жанры нормализованы по мальтийским национальным каталогам.",
  },
  {
    countryId: "malta",
    writerId: "dun_karm_psaila",
    patch: {
      works: ["L-Innu Malti", "Il-Jien u lil hinn Minnu", "Foglie d’Alloro"],
      genres: ["поэзия", "лексикография"],
    },
    evidence: sources(
      "University of Malta Library",
      "https://www.um.edu.mt/library/oar/handle/123456789/54450",
      "Heritage Malta",
      "https://heritagemalta.mt/news/heritage-malta-commemorates-dun-karm-psaila-with-an-exhibition-marking-150-years-since-his-birth/"
    ),
    note: "Служебные названия заменены конкретными произведениями; лексикографическая работа отражена в жанрах.",
  },
  {
    countryId: "malta",
    writerId: "manwel_dimech",
    patch: {
      name: "Манвел Димех",
      works: ["Il-Bandiera tal-Maltin", "Ivan u Prascovia"],
      genres: ["роман", "эссе", "публицистика"],
    },
    evidence: sources(
      "University of Malta Library",
      "https://www.um.edu.mt/library/oar/bitstream/123456789/40018/1/Manwel%20Dimech.pdf",
      "WorldCat",
      "https://search.worldcat.org/search?q=au%3A%22Dimech%2C+Manwel%22"
    ),
    note: "Имя и библиография приведены к мальтийской форме и документированным публикациям.",
  },
  {
    countryId: "malta",
    writerId: "oliver_friggieri",
    patch: {
      name: "Оливер Фриджери",
      works: ["Fil-Parlament ma Jikbrux Fjuri", "L-Istramb", "Fjuri li ma Jinxfux"],
      genres: ["роман", "поэзия", "литературная критика"],
    },
    evidence: sources(
      "University of Malta",
      "https://www.um.edu.mt/newspoint/news/2020/11/tributes-oliver-friggieri",
      "WorldCat",
      "https://search.worldcat.org/search?q=au%3A%22Friggieri%2C+Oliver%22"
    ),
    note: "Ошибочная фамилия «Фридрих» исправлена; служебная библиография заменена произведениями.",
  },
  {
    countryId: "malta",
    writerId: "ruzar_briffa",
    patch: {
      birthDate: "1906-01-16",
      birthPlace: "Валлетта, Мальта",
      works: ["Il-Ġmiel", "Quo Vadis?", "Lil Malta"],
      genres: ["поэзия"],
    },
    evidence: sources(
      "University of Malta Library",
      "https://www.um.edu.mt/library/oar/bitstream/123456789/42290/1/Ruzar%20Briffa.pdf",
      "WorldCat",
      "https://search.worldcat.org/search?q=au%3A%22Briffa%2C+Ruzar%22"
    ),
    note: "Дата и место рождения исправлены на 16 января и Валлетту; служебная позиция заменена стихотворениями.",
  },
  {
    countryId: "marshall_islands",
    writerId: "kathy_jetnil_kijiner",
    patch: {
      name: "Кэти Джетнил-Киджинер",
      fullName: "Kathy Jetñil-Kijiner",
      birthDate: "1989",
      works: ["Iep Jāltok: Poems from a Marshallese Daughter", "Dear Matafele Peinem"],
      genres: ["поэзия", "устное исполнение", "эссе"],
    },
    evidence: sources(
      "Kathy Jetñil-Kijiner - официальный сайт",
      "https://www.kathyjetnilkijiner.com/",
      "University of Hawaiʻi",
      "https://hawaii.edu/cpis/alumni-and-friends/alumni-spotlight/kathy-jetnil-kijiner-2/"
    ),
    note: "Русская форма фамилии и полное имя исправлены; техническая дата 1 января удалена, библиография уточнена.",
  },
  {
    countryId: "mauritania",
    writerId: "ahmedou_ould_abdel_kader",
    patch: {
      birthPlace: "Бутилимит, Мавритания",
      works: ["الأسماء المتغيرة", "القبر المجهول", "العيون الشاخصة"],
      genres: ["поэзия", "роман"],
    },
    evidence: sources(
      "Союз мавританских писателей",
      "https://oudaba.mr/?q=taxonomy%2Fterm%2F1031",
      "Al Jazeera Encyclopedia",
      "https://www.aljazeera.net/encyclopedia/2014/10/23/%D8%A3%D8%AD%D9%85%D8%AF-%D9%88%D9%84%D8%AF-%D8%B9%D8%A8%D8%AF-%D8%A7%D9%84%D9%82%D8%A7%D8%AF%D8%B1"
    ),
    note: "Место рождения, романная библиография и жанры уточнены по арабоязычным источникам.",
  },
  {
    countryId: "mauritania",
    writerId: "mokhtar_ould_hamidoun",
    patch: {
      works: ["Précis sur la Mauritanie", "Hayat Muritaniyya"],
      genres: ["поэзия", "история", "культурология"],
      language: "арабский, французский",
    },
    evidence: sources(
      "Bibliothèque nationale de France",
      "https://catalogue.bnf.fr/ark%3A/12148/cb12228801p",
      "CNRS / Annuaire de l’Afrique du Nord",
      "https://cinumedpub.mmsh.fr/aan/Pdf/AAN-1999-38_08.pdf"
    ),
    note: "Пустая библиография дополнена двумя трудами, а язык и исследовательские жанры уточнены.",
  },
  {
    countryId: "mauritania",
    writerId: "moussa_ould_ebnou",
    patch: {
      name: "Мусса ульд Эбну",
      birthDate: "1956-12-31",
      birthPlace: "Бутилимит, Мавритания",
      language: "французский, арабский",
      works: ["L’Amour impossible", "Le Barzakh"],
    },
    evidence: sources(
      "Moussa Ould Ebnou - официальный сайт",
      "https://moussaebnou.net/pages/about",
      "SOAS University of London Repository",
      "https://soas-repository.worktribe.com/OutputFile/362884"
    ),
    note: "Имя, полная дата и место рождения, двуязычие и порядок библиографии уточнены.",
  },
  {
    countryId: "mauritius",
    writerId: "ananda_devi",
    patch: {
      works: ["Ève de ses décombres", "Le Sari vert"],
      genres: ["роман", "поэзия", "перевод"],
    },
    evidence: sources(
      "Académie française",
      "https://www.academie-francaise.fr/sites/academie-francaise.fr/files/palmares_2014_0.pdf",
      "WorldCat",
      "https://search.worldcat.org/search?q=au%3A%22Devi%2C+Ananda%22"
    ),
    note: "Диакритика названия восстановлена; поэтическая и переводческая работа отражены в жанрах.",
  },
  {
    countryId: "mauritius",
    writerId: "edouard_maunick",
    patch: {
      works: ["Ces oiseaux du sang", "Fusillez-moi", "Mandéla mort et vif"],
      genres: ["поэзия", "эссе"],
    },
    evidence: sources(
      "Académie française",
      "https://www.academie-francaise.fr/actualites/m-edouard-maunick",
      "Bibliothèque nationale de France",
      "https://catalogue.bnf.fr/rechercher.do?motRecherche=Edouard+Maunick&critereRecherche=0&depart=0&facetteModifiee=ok"
    ),
    note: "Пустая библиография заменена тремя каталогизированными поэтическими книгами.",
  },
  {
    countryId: "mauritius",
    writerId: "jmg_le_clezio",
    patch: {
      name: "Жан-Мари Гюстав Леклезио",
      works: ["Désert", "Le Chercheur d’or", "Révolutions"],
      genres: ["роман", "рассказ", "эссе"],
    },
    evidence: sources(
      "The Nobel Prize",
      "https://www.nobelprize.org/prizes/literature/2008/clezio/biographical/",
      "Bibliothèque nationale de France",
      "https://catalogue.bnf.fr/rechercher.do?motRecherche=J.+M.+G.+Le+Clezio&critereRecherche=0&depart=0&facetteModifiee=ok"
    ),
    note: "Русская форма фамилии, оригинальные названия и жанры приведены к нобелевской и библиотечной записям.",
  },
  {
    countryId: "mauritius",
    writerId: "khal_torabully",
    patch: {
      name: "Хал Торабулли",
      birthPlace: "Порт-Луи, Маврикий",
      works: ["Cale d’étoiles - Coolitude", "Chair corail, fragments coolies", "Mes Afriques, mes ivoires"],
      genres: ["поэзия", "эссе", "кино"],
    },
    evidence: sources(
      "Bennington College",
      "https://www.bennington.edu/events/n%C3%A9gritude-coolitude-visionary-poetry-of-khal-torabully",
      "Boston University - AGNI",
      "https://agnionline.bu.edu/about/our-people/authors/khal-torabully/"
    ),
    note: "Русская форма имени, место рождения, библиография и режиссёрская работа уточнены.",
  },
  {
    countryId: "mauritius",
    writerId: "malcolm_de_chazal",
    patch: {
      works: ["Sens-plastique", "Petrusmok"],
      genres: ["поэзия", "афоризм", "эссе"],
    },
    evidence: sources(
      "Prime Minister’s Office of Mauritius",
      "https://pmo.govmu.org/CabinetDecision/2002/Cabinet-Decisions-taken-on-05-December-2002.aspx",
      "Bibliothèque nationale de France",
      "https://catalogue.bnf.fr/rechercher.do?index=AUT3&numNotice=11917345&typeNotice=p"
    ),
    note: "Название Sens-plastique и жанровый состав нормализованы по каталогам.",
  },
  {
    countryId: "mauritius",
    writerId: "nathacha_appanah",
    patch: {
      works: ["Le Dernier Frère", "Tropique de la violence", "Rien ne t’appartient"],
      genres: ["роман", "журналистика"],
    },
    evidence: sources(
      "Éditions Gallimard",
      "https://www.gallimard.fr/auteurs/nathacha-appanah",
      "Bibliothèque nationale de France",
      "https://catalogue.bnf.fr/rechercher.do?motRecherche=Nathacha+Appanah&critereRecherche=0&depart=0&facetteModifiee=ok"
    ),
    note: "Библиография дополнена третьим романом, журналистская работа отражена в жанрах.",
  },
  {
    countryId: "mexico",
    writerId: "alfonso_reyes",
    patch: {
      works: ["Visión de Anáhuac", "Ifigenia cruel", "El deslinde"],
      genres: ["эссе", "поэзия", "перевод", "литературная критика"],
    },
    evidence: sources(
      "Enciclopedia de la Literatura en México",
      "https://www.elem.mx/autor/datos/914",
      "Bibliothèque nationale de France",
      "https://catalogue.bnf.fr/ark%3A/12148/cb12058725p"
    ),
    note: "Неточные служебные позиции заменены оригинальными названиями; жанры расширены.",
  },
  {
    countryId: "mexico",
    writerId: "alvaro_enrigue",
    patch: {
      works: ["La muerte de un instalador", "Hipotermia", "Muerte súbita"],
      genres: ["роман", "рассказ", "эссе"],
    },
    evidence: sources(
      "Enciclopedia de la Literatura en México",
      "https://www.elem.mx/autor/datos/1502",
      "WorldCat",
      "https://search.worldcat.org/search?q=au%3A%22Enrigue%2C+Alvaro%22"
    ),
    note: "Переводные и неточные позиции заменены оригинальными названиями трёх книг.",
  },
  {
    countryId: "mexico",
    writerId: "amparo_davila",
    patch: {
      works: ["Tiempo destrozado", "Música concreta", "Árboles petrificados"],
      genres: ["рассказ", "поэзия", "фантастическая проза"],
    },
    evidence: sources(
      "Enciclopedia de la Literatura en México",
      "https://www.elem.mx/autor/datos/284",
      "WorldCat",
      "https://search.worldcat.org/search?q=au%3A%22Davila%2C+Amparo%22"
    ),
    note: "Ошибочные переводы названий заменены точными оригиналами; поэзия добавлена в жанры.",
  },
  {
    countryId: "mexico",
    writerId: "carlos_de_siguenza",
    patch: {
      works: ["Infortunios de Alonso Ramírez", "Primavera indiana", "Libra astronómica y filosófica"],
      genres: ["повествование", "поэзия", "история", "научная проза"],
    },
    evidence: sources(
      "Enciclopedia de la Literatura en México",
      "https://www.elem.mx/autor/datos/3772",
      "WorldCat",
      "https://search.worldcat.org/search?q=au%3A%22Siguenza+y+Gongora%2C+Carlos+de%22"
    ),
    note: "Библиография и жанры приведены к трём атрибутированным произведениям.",
  },
  {
    countryId: "mexico",
    writerId: "carlos_fuentes",
    patch: {
      works: ["La región más transparente", "La muerte de Artemio Cruz", "Terra Nostra", "Aura"],
      genres: ["роман", "эссе", "рассказ"],
    },
    evidence: sources(
      "Enciclopedia de la Literatura en México",
      "https://www.elem.mx/autor/datos/1162",
      "El Colegio Nacional",
      "https://colnal.mx/integrantes/carlos-fuentes/"
    ),
    note: "Библиография переведена на точные оригинальные названия и включает ключевые романы.",
  },
  {
    countryId: "mexico",
    writerId: "cristina_rivera_garza",
    patch: {
      works: ["Nadie me verá llorar", "La cresta de Ilión", "El invencible verano de Liliana"],
      genres: ["роман", "поэзия", "эссе", "мемуары"],
      awards: ["Пулитцеровская премия за мемуары или автобиографию, 2024"],
    },
    evidence: sources(
      "Enciclopedia de la Literatura en México",
      "https://www.elem.mx/autor/datos/929",
      "The Pulitzer Prizes",
      "https://www.pulitzer.org/winners/cristina-rivera-garza"
    ),
    note: "Недостоверные названия заменены книгами автора; Пулитцеровская премия добавлена с точной категорией.",
  },
  {
    countryId: "mexico",
    writerId: "elena_garro",
    patch: {
      works: ["Los recuerdos del porvenir", "Un hogar sólido", "La semana de colores"],
      genres: ["роман", "драма", "рассказ", "сценарий"],
    },
    evidence: sources(
      "Enciclopedia de la Literatura en México",
      "https://www.elem.mx/autor/datos/421",
      "WorldCat",
      "https://search.worldcat.org/search?q=au%3A%22Garro%2C+Elena%22"
    ),
    note: "Неточные русские названия заменены оригинальными; сценарная работа отражена в жанрах.",
  },
  {
    countryId: "mexico",
    writerId: "elena_poniatowska",
    patch: {
      name: "Элена Понятовская",
      works: ["La noche de Tlatelolco", "Hasta no verte Jesús mío", "Querido Diego, te abraza Quiela"],
      awards: ["Премия Сервантеса, 2013"],
    },
    evidence: sources(
      "Enciclopedia de la Literatura en México",
      "https://www.elem.mx/autor/datos/866",
      "Instituto Cervantes",
      "https://www.cervantes.es/sobre_instituto_cervantes/prensa/2013/noticias/premio-cervantes-2013.htm"
    ),
    note: "Имя и три названия исправлены; премия приведена к единому редакционному формату.",
  },
  {
    countryId: "mexico",
    writerId: "fernanda_melchor",
    patch: {
      birthDate: "1982",
      works: ["Aquí no es Miami", "Temporada de huracanes", "Páradais"],
      genres: ["хроника", "роман", "журналистика"],
    },
    evidence: sources(
      "Enciclopedia de la Literatura en México",
      "https://www.elem.mx/autor/datos/4045",
      "WorldCat",
      "https://search.worldcat.org/search?q=au%3A%22Melchor%2C+Fernanda%22"
    ),
    note: "Неподтверждённый день рождения удалён; дубль и ложная позиция заменены тремя книгами.",
  },
  {
    countryId: "mexico",
    writerId: "guadalupe_nettel",
    patch: {
      name: "Гуадалупе Неттель",
      birthDate: "1973-05-27",
      works: ["El cuerpo en que nací", "Después del invierno", "El matrimonio de los peces rojos"],
      genres: ["роман", "рассказ", "эссе"],
    },
    evidence: sources(
      "Enciclopedia de la Literatura en México",
      "https://www.elem.mx/autor/datos/3962",
      "WorldCat",
      "https://search.worldcat.org/search?q=au%3A%22Nettel%2C+Guadalupe%22"
    ),
    note: "Дата рождения исправлена со 2 на 27 мая; имя, произведения и жанры нормализованы.",
  },
  {
    countryId: "mexico",
    writerId: "ignacio_manuel_altamirano",
    patch: {
      works: ["Clemencia", "La Navidad en las montañas", "El Zarco"],
      genres: ["роман", "рассказ", "эссе", "журналистика"],
    },
    evidence: sources(
      "Enciclopedia de la Literatura en México",
      "https://www.elem.mx/autor/datos/1211",
      "WorldCat",
      "https://search.worldcat.org/search?q=au%3A%22Altamirano%2C+Ignacio+Manuel%22"
    ),
    note: "Библиография приведена к оригинальным названиям, журналистика добавлена в жанры.",
  },
  {
    countryId: "mexico",
    writerId: "javier_velasco",
    patch: {
      name: "Хавьер Веласко",
      fullName: "Xavier Velasco",
      years: "1958-",
      birthDate: "1958-11-07",
      works: ["Diablo guardián", "Luna llena en las rocas", "Puedo explicarlo todo"],
      genres: ["роман", "хроника", "эссе"],
      awards: ["Премия Alfaguara, 2003"],
    },
    evidence: sources(
      "Enciclopedia de la Literatura en México",
      "https://www.elem.mx/autor/datos/1996",
      "Penguin Random House",
      "https://www.penguinlibros.com/mx/literatura-contemporanea/312371-libro-diablo-guardian-9786073821162"
    ),
    note: "Профиль исправлен с Javier, 1964 на Xavier Velasco, 7 ноября 1958; библиография и премия уточнены.",
  },
  {
    countryId: "mexico",
    writerId: "jorge_volpi",
    patch: {
      works: ["En busca de Klingsor", "El fin de la locura", "Una novela criminal"],
      genres: ["роман", "эссе", "документальная проза"],
    },
    evidence: sources(
      "Enciclopedia de la Literatura en México",
      "https://www.elem.mx/autor/datos/1142",
      "WorldCat",
      "https://search.worldcat.org/search?q=au%3A%22Volpi%2C+Jorge%22"
    ),
    note: "Неточные служебные названия заменены тремя оригинальными романами.",
  },
  {
    countryId: "mexico",
    writerId: "jose_emilio_pacheco",
    patch: {
      works: ["Las batallas en el desierto", "El principio del placer", "No me preguntes cómo pasa el tiempo"],
      genres: ["поэзия", "роман", "рассказ", "эссе", "перевод"],
    },
    evidence: sources(
      "Enciclopedia de la Literatura en México",
      "https://www.elem.mx/autor/datos/806",
      "WorldCat",
      "https://search.worldcat.org/search?q=au%3A%22Pacheco%2C+Jose+Emilio%22"
    ),
    note: "Библиография приведена к оригинальным названиям; переводческая работа добавлена в жанры.",
  },
  {
    countryId: "mexico",
    writerId: "jose_joaquin_fernandez_de_lizardi",
    patch: {
      works: ["El Periquillo Sarniento", "La Quijotita y su prima", "El Pensador Mexicano"],
      genres: ["роман", "журналистика", "сатира"],
    },
    evidence: sources(
      "Enciclopedia de la Literatura en México",
      "https://www.elem.mx/autor/datos/3002",
      "WorldCat",
      "https://search.worldcat.org/search?q=au%3A%22Fernandez+de+Lizardi%2C+Jose+Joaquin%22"
    ),
    note: "Ошибочный заголовок «Хромой попугай» и служебная позиция заменены оригинальными названиями.",
  },
  {
    countryId: "mexico",
    writerId: "jose_vasconcelos",
    patch: {
      birthDate: "1882-02-27",
      works: ["La raza cósmica", "Ulises criollo", "La tormenta"],
      genres: ["философия", "эссе", "мемуары"],
    },
    evidence: sources(
      "Enciclopedia de la Literatura en México",
      "https://www.elem.mx/autor/datos/1110",
      "El Colegio Nacional",
      "https://colnal.mx/wp-content/uploads/2020/04/Listado-de-integrantes-Colnal-2020-Todos-los-integrantes.pdf"
    ),
    note: "Дата рождения исправлена на 27 февраля; ошибочная позиция «Боливаризм» заменена автобиографией La tormenta.",
  },
  {
    countryId: "mexico",
    writerId: "juan_rulfo",
    patch: {
      works: ["El Llano en llamas", "Pedro Páramo"],
      genres: ["роман", "рассказ", "сценарий"],
    },
    evidence: sources(
      "Enciclopedia de la Literatura en México",
      "https://www.elem.mx/autor/datos/970",
      "WorldCat",
      "https://search.worldcat.org/search?q=au%3A%22Rulfo%2C+Juan%22"
    ),
    note: "Оригинальные названия и сценарная работа нормализованы; спорная жанровая метка удалена.",
  },
  {
    countryId: "mexico",
    writerId: "laura_esquivel",
    patch: {
      works: ["Como agua para chocolate", "La ley del amor", "Malinche"],
      genres: ["роман", "сценарий"],
    },
    evidence: sources(
      "Enciclopedia de la Literatura en México",
      "https://www.elem.mx/autor/datos/1538",
      "WorldCat",
      "https://search.worldcat.org/search?q=au%3A%22Esquivel%2C+Laura%22"
    ),
    note: "Ложное название «Малиновое сердце» заменено романом Malinche; жанры сведены к подтверждённым ролям.",
  },
  {
    countryId: "mexico",
    writerId: "manuel_gutierrez_najera",
    patch: {
      works: ["La duquesa Job", "La novela del tranvía", "Cuentos frágiles"],
      genres: ["поэзия", "рассказ", "эссе", "журналистика"],
    },
    evidence: sources(
      "Enciclopedia de la Literatura en México",
      "https://www.elem.mx/autor/datos/3044",
      "WorldCat",
      "https://search.worldcat.org/search?q=au%3A%22Gutierrez+Najera%2C+Manuel%22"
    ),
    note: "Ошибка «Иова» исправлена; библиография и жанры дополнены оригинальными названиями.",
  },
  {
    countryId: "mexico",
    writerId: "mariano_azuela",
    patch: {
      works: ["Los de abajo", "Mala yerba", "Los caciques"],
      genres: ["роман", "рассказ"],
    },
    evidence: sources(
      "Enciclopedia de la Literatura en México",
      "https://www.elem.mx/autor/datos/91",
      "El Colegio Nacional",
      "https://colnal.mx/integrantes/mariano-azuela/"
    ),
    note: "Неточные русские названия заменены тремя атрибутированными романами.",
  },
  {
    countryId: "mexico",
    writerId: "octavio_paz",
    patch: {
      works: ["El laberinto de la soledad", "Piedra de sol", "El arco y la lira"],
      genres: ["поэзия", "эссе", "перевод"],
    },
    evidence: sources(
      "The Nobel Prize",
      "https://www.nobelprize.org/prizes/literature/1990/paz/biographical/",
      "Enciclopedia de la Literatura en México",
      "https://www.elem.mx/autor/datos/810"
    ),
    note: "Неустановленная позиция «Бдение у воды» удалена; произведения приведены к оригинальным названиям.",
  },
  {
    countryId: "mexico",
    writerId: "sergio_pitol",
    patch: {
      works: ["El desfile del amor", "La vida conyugal", "El arte de la fuga"],
      genres: ["роман", "рассказ", "эссе", "перевод"],
      awards: ["Премия Сервантеса, 2005"],
    },
    evidence: sources(
      "Instituto Cervantes",
      "https://www.cervantes.es/bibliotecas_documentacion_espanol/biografias/sofia_sergio_pitol.htm",
      "Centro Virtual Cervantes",
      "https://cvc.cervantes.es/artes/ciudades_patrimonio/puebla/personalidades/pitol.htm"
    ),
    note: "Неточные переводы названий заменены оригиналами; переводческая работа и премия уточнены.",
  },
] satisfies readonly WriterPublicProfileFactCorrectionBatch39[];
