import type { Country, WorkProfile, WriterProfile } from "./types";
import { articleCatalogWriters } from "./articleCatalogBooks";

const reviewedAt = "2026-08-01";

function articleWork(
  id: string,
  title: string,
  articleUrl: string,
  details: Omit<WorkProfile, "id" | "title" | "sourceUrl" | "editorial"> = {}
): WorkProfile {
  return {
    id,
    title,
    ...details,
    sourceUrl: articleUrl,
    editorial: { status: "reviewed", reviewedAt },
  };
}

const articleReferencedWriters: Record<string, WriterProfile[]> = {
  netherlands: [
    {
      id: "alexandre_olivier_exquemelin",
      name: "Александер Оливье Эксквемелин",
      fullName: "Alexandre Olivier Exquemelin",
      years: "ок. 1645 — после 1707",
      portrait: "",
      bio: "Врач, путешественник и автор одного из важнейших свидетельств о карибском пиратстве XVII века. Биографические сведения об Эксквемелине фрагментарны, а ранние издания его книги заметно расходятся между собой, поэтому спорные детали редакция обозначает отдельно.",
      works: ["Пираты Америки"],
      workDetails: [
        articleWork(
          "buccaneers-of-america",
          "Пираты Америки",
          "https://probpera.ru/read/page-article/page-books/2",
          {
            originalTitle: "De Americaensche Zee-Roovers",
            firstPublished: 1678,
            originalLanguage: "нидерландский",
            genres: ["документальная проза", "мемуары"],
            tags: ["пиратство", "Карибское море", "XVII век"],
            description: "Рассказ участника и очевидца о флибустьерах Карибского моря; один из основных письменных источников по истории пиратства XVII века.",
          }
        ),
      ],
      genres: ["документальная проза", "мемуары"],
      language: "нидерландский",
      nationality: "франко-нидерландский автор",
      tags: ["XVII век", "морская литература"],
      articleUrl: "https://probpera.ru/read/page-article/page-books/2",
    },
  ],
  canada: [
    {
      id: "chris_hadfield",
      name: "Крис Остин Хэдфилд",
      fullName: "Chris Austin Hadfield",
      years: "1959–",
      birthDate: "1959-08-29",
      birthPlace: "Сарния, Онтарио, Канада",
      portrait: "",
      bio: "Канадский астронавт, инженер, лётчик-испытатель и автор научно-популярных книг. В своих книгах Хэдфилд соединяет личный опыт космических полётов с практическим разговором о дисциплине, риске и работе в команде.",
      works: ["Руководство астронавта по жизни на Земле"],
      workDetails: [
        articleWork(
          "an-astronauts-guide-to-life-on-earth",
          "Руководство астронавта по жизни на Земле",
          "https://probpera.ru/read/page-article/page-books/3",
          {
            originalTitle: "An Astronaut's Guide to Life on Earth",
            firstPublished: 2013,
            originalLanguage: "английский",
            genres: ["мемуары", "научно-популярная литература"],
            tags: ["космос", "профессия", "самодисциплина"],
            description: "Автобиографическая книга о подготовке астронавта, полётах и привычках мышления, которые помогают работать в условиях высокой ответственности.",
          }
        ),
      ],
      genres: ["мемуары", "научно-популярная литература"],
      language: "английский",
      nationality: "канадец",
      tags: ["XXI век", "космос"],
      articleUrl: "https://probpera.ru/read/page-article/page-books/3",
    },
  ],
  england: [
    {
      id: "daniel_defoe",
      workDetails: [
        articleWork(
          "a-general-history-of-the-pyrates",
          "Всеобщая история пиратства",
          "https://probpera.ru/read/page-article/page-books/4",
          {
            originalTitle: "A General History of the Pyrates",
            firstPublished: 1724,
            originalLanguage: "английский",
            genres: ["документальная проза", "история"],
            tags: ["пиратство", "морская история", "атрибуция"],
            description: "Сборник биографий пиратов XVIII века, опубликованный под именем капитана Чарльза Джонсона. Атрибуция Даниелю Дефо остаётся предметом научной дискуссии.",
          }
        ),
      ],
    },
    {
      id: "h_g_wells",
      workDetails: [
        articleWork(
          "the-war-in-the-air",
          "Война в воздухе",
          "https://probpera.ru/read/page-article/page-books/21",
          {
            originalTitle: "The War in the Air",
            firstPublished: 1908,
            originalLanguage: "английский",
            genres: ["научная фантастика", "роман"],
            tags: ["авиация", "война", "технологии"],
            description: "Предупреждающий роман о воздушной войне и хрупкости индустриальной цивилизации.",
          }
        ),
      ],
    },
    {
      id: "j_r_r_tolkien",
      workDetails: [
        articleWork(
          "letters-from-father-christmas",
          "Письма Рождественского деда",
          "https://probpera.ru/read/page-article/page-books/15",
          {
            originalTitle: "The Father Christmas Letters",
            firstPublished: 1976,
            originalLanguage: "английский",
            genres: ["письма", "детская литература"],
            tags: ["Рождество", "семья", "иллюстрации"],
            description: "Посмертно изданная подборка писем и рисунков, которые Толкин много лет создавал для своих детей от имени Рождественского Деда.",
          }
        ),
      ],
    },
    {
      id: "david_mitchell",
      name: "Дэвид Стивен Митчелл",
      fullName: "David Stephen Mitchell",
      years: "1969–",
      birthDate: "1969-01-12",
      birthPlace: "Саутпорт, Англия",
      portrait: "",
      bio: "Британский писатель, чьи романы соединяют разные эпохи, жанры и повествовательные голоса. Его проза исследует память, взаимозависимость людей и повторяющиеся формы власти.",
      works: ["Облачный атлас", "Под знаком чёрного лебедя", "Утопия — Авеню"],
      workDetails: [
        articleWork(
          "cloud-atlas",
          "Облачный атлас",
          "https://probpera.ru/read/page-article/page-books/7",
          {
            originalTitle: "Cloud Atlas",
            firstPublished: 2004,
            originalLanguage: "английский",
            genres: ["роман", "постмодернизм"],
            tags: ["время", "взаимосвязь", "шесть историй"],
            description: "Композиционно сложный роман из шести связанных историй, разворачивающихся в разных эпохах и литературных жанрах.",
          }
        ),
        articleWork(
          "black-swan-green",
          "Под знаком чёрного лебедя",
          "https://probpera.ru/read/page-article/page-books/14",
          {
            originalTitle: "Black Swan Green",
            firstPublished: 2006,
            originalLanguage: "английский",
            genres: ["роман взросления"],
            tags: ["подросток", "Англия", "1980-е"],
            description: "Роман взросления о тринадцатилетнем Джейсоне Тейлоре и одном переломном годе его жизни в английской провинции.",
          }
        ),
        articleWork(
          "utopia-avenue",
          "Утопия — Авеню",
          "https://probpera.ru/read/page-article/page-books/18",
          {
            originalTitle: "Utopia Avenue",
            firstPublished: 2020,
            originalLanguage: "английский",
            genres: ["роман", "музыкальная проза"],
            tags: ["Лондон", "1960-е", "рок-музыка"],
            description: "Роман о вымышленной британской группе и культурной среде конца 1960-х годов.",
          }
        ),
      ],
      genres: ["роман", "постмодернизм"],
      language: "английский",
      nationality: "британец",
      tags: ["XXI век", "современная литература"],
      articleUrl: "https://probpera.ru/read/page-article/page-books/7",
    },
  ],
  france: [
    {
      id: "henri_barbusse",
      name: "Анри Барбюс",
      fullName: "Henri Barbusse",
      years: "1873–1935",
      birthDate: "1873-05-17",
      deathDate: "1935-08-30",
      birthPlace: "Аньер-сюр-Сен, Франция",
      portrait: "",
      bio: "Французский писатель и журналист, участник Первой мировой войны. Его роман «Огонь» основан на фронтовом опыте и стал одним из наиболее известных антивоенных произведений своего времени.",
      works: ["Огонь"],
      workDetails: [
        articleWork("under-fire", "Огонь", "https://probpera.ru/read/page-article/page-books/12", {
          originalTitle: "Le Feu",
          firstPublished: 1916,
          originalLanguage: "французский",
          genres: ["военный роман", "документальная проза"],
          tags: ["Первая мировая война", "фронт", "антивоенная проза"],
          description: "Фронтовой роман, построенный на наблюдениях автора во время службы во французской армии.",
        }),
      ],
      genres: ["роман", "публицистика"],
      language: "французский",
      nationality: "француз",
      tags: ["XX век", "антивоенная литература"],
      articleUrl: "https://probpera.ru/read/page-article/page-books/12",
    },
    {
      id: "laurent_gounelle",
      name: "Лоран Гунель",
      fullName: "Laurent Gounelle",
      years: "1966–",
      birthDate: "1966-08-10",
      birthPlace: "Л’Э-ле-Роз, Франция",
      portrait: "",
      bio: "Французский писатель, работающий на границе художественной и популярной психологической прозы. Его романы строятся вокруг нравственного выбора и пересмотра привычного образа жизни.",
      works: ["Бог путешествует инкогнито"],
      workDetails: [
        articleWork(
          "god-travels-incognito",
          "Бог путешествует инкогнито",
          "https://probpera.ru/read/page-article/page-books/23",
          {
            originalTitle: "Dieu voyage toujours incognito",
            firstPublished: 2010,
            originalLanguage: "французский",
            genres: ["роман", "психологическая проза"],
            tags: ["выбор", "перемены", "самопознание"],
            description: "Роман о человеке, который получает шанс изменить свою жизнь, но должен заново определить границы доверия и личной ответственности.",
          }
        ),
      ],
      genres: ["роман", "психологическая проза"],
      language: "французский",
      nationality: "француз",
      tags: ["XXI век", "современная литература"],
      articleUrl: "https://probpera.ru/read/page-article/page-books/23",
    },
  ],
  russia: [
    {
      id: "sergey_ivanovich_ozhegov",
      name: "Сергей Иванович Ожегов",
      fullName: "Сергей Иванович Ожегов",
      years: "1900–1964",
      birthDate: "1900-09-22",
      deathDate: "1964-12-15",
      birthPlace: "Кувшиново, Тверская губерния, Российская империя",
      deathPlace: "Москва, СССР",
      portrait: "",
      bio: "Советский лингвист, лексикограф и исследователь культуры русской речи. Сергей Иванович Ожегов участвовал в подготовке академических словарей, а его однотомный «Словарь русского языка» стал одним из самых известных нормативных справочников XX века и продолжает переиздаваться с научными дополнениями.",
      works: ["Словарь русского языка", "Толковый словарь русского языка"],
      workDetails: [
        articleWork(
          "dictionary-of-the-russian-language",
          "Толковый словарь русского языка",
          "https://probpera.ru/read/page-article/page-books/6",
          {
            firstPublished: 1949,
            originalLanguage: "русский",
            genres: ["словарь", "справочная литература"],
            tags: ["русский язык", "лексикография", "норма"],
            description: "Нормативный однотомный словарь, созданный для широкого круга читателей и ставший важной частью отечественной лексикографической традиции.",
          }
        ),
      ],
      genres: ["лексикография", "языкознание"],
      language: "русский",
      nationality: "русский",
      tags: ["XX век", "русский язык"],
      articleUrl: "https://probpera.ru/read/page-article/page-books/6",
    },
  ],
  usa: [
    {
      id: "jack_london",
      workDetails: [
        articleWork(
          "the-assassination-bureau-ltd",
          "Бюро заказных убийств",
          "https://probpera.ru/read/page-article/page-books/1",
          {
            originalTitle: "The Assassination Bureau, Ltd",
            firstPublished: 1963,
            originalLanguage: "английский",
            genres: ["приключенческий роман", "сатира"],
            tags: ["незавершённый роман", "Роберт Л. Фиш"],
            description: "Незавершённый роман Джека Лондона, который после смерти писателя был завершён Робертом Л. Фишем и опубликован в 1963 году.",
          }
        ),
      ],
    },
    {
      id: "francis_scott_fitzgerald",
      workDetails: [
        articleWork(
          "the-offshore-pirate",
          "Прибрежный пират",
          "https://probpera.ru/read/page-article/page-books/5",
          {
            originalTitle: "The Offshore Pirate",
            firstPublished: 1920,
            originalLanguage: "английский",
            genres: ["рассказ", "романтическая проза"],
            tags: ["эпоха джаза", "приключение"],
            description: "Ранний рассказ Фицджеральда о приключении, игре социальных ролей и романтической иллюзии.",
          }
        ),
      ],
    },
    {
      id: "stephen_king",
      workDetails: [
        articleWork("1408", "1408", "https://probpera.ru/read/page-article/page-bookvsmovie/5", {
          firstPublished: 1999,
          originalLanguage: "английский",
          genres: ["рассказ", "хоррор"],
          tags: ["отель", "сверхъестественное", "экранизация"],
          description: "Рассказ о писателе, который исследует номер отеля с дурной репутацией и сталкивается с необъяснимым опытом.",
        }),
      ],
    },
    {
      id: "richard_matheson",
      name: "Ричард Бёртон Матесон",
      fullName: "Richard Burton Matheson",
      years: "1926–2013",
      birthDate: "1926-02-20",
      deathDate: "2013-06-23",
      birthPlace: "Аллендейл, Нью-Джерси, США",
      portrait: "",
      bio: "Американский писатель и сценарист, оказавший заметное влияние на фантастику, хоррор и популярную культуру второй половины XX века.",
      works: ["Я — легенда", "Куда приводят мечты"],
      workDetails: [
        articleWork("i-am-legend", "Я — легенда", "https://probpera.ru/read/page-article/page-bookvsmovie/4", {
          originalTitle: "I Am Legend",
          firstPublished: 1954,
          originalLanguage: "английский",
          genres: ["научная фантастика", "хоррор"],
          tags: ["эпидемия", "одиночество", "постапокалипсис"],
          description: "Роман о последнем человеке в мире, изменённом эпидемией, и о пересмотре границы между нормой и чудовищностью.",
        }),
        articleWork(
          "what-dreams-may-come",
          "Куда приводят мечты",
          "https://probpera.ru/read/page-article/page-books/19",
          {
            originalTitle: "What Dreams May Come",
            firstPublished: 1978,
            originalLanguage: "английский",
            genres: ["роман", "философская фантастика"],
            tags: ["любовь", "смерть", "загробный мир"],
            description: "Философско-фантастический роман о любви, утрате и попытке сохранить человеческую связь за пределами смерти.",
          }
        ),
      ],
      genres: ["фантастика", "хоррор"],
      language: "английский",
      nationality: "американец",
      tags: ["XX век", "жанровая литература"],
      articleUrl: "https://probpera.ru/read/page-article/page-books/19",
    },
    {
      id: "hunter_s_thompson",
      name: "Хантер Стоктон Томпсон",
      fullName: "Hunter Stockton Thompson",
      years: "1937–2005",
      birthDate: "1937-07-18",
      deathDate: "2005-02-20",
      birthPlace: "Луисвилл, Кентукки, США",
      portrait: "",
      bio: "Американский журналист и писатель, один из создателей гонзо-журналистики. Его книги соединяют репортаж, автобиографическую прозу, сатиру и намеренно субъективный взгляд рассказчика.",
      works: ["Ангелы ада", "Страх и ненависть в Лас-Вегасе"],
      workDetails: [
        articleWork("hells-angels", "Ангелы ада", "https://probpera.ru/read/page-article/page-books/22", {
          originalTitle: "Hell's Angels",
          firstPublished: 1967,
          originalLanguage: "английский",
          genres: ["репортаж", "документальная проза"],
          tags: ["мотоклуб", "гонзо", "Америка"],
          description: "Документальная книга, выросшая из наблюдений Томпсона за калифорнийским мотоклубом и медийным образом контркультуры.",
        }),
        articleWork(
          "fear-and-loathing-in-las-vegas",
          "Страх и ненависть в Лас-Вегасе",
          "https://probpera.ru/read/page-article/page-bookvsmovie/11",
          {
            originalTitle: "Fear and Loathing in Las Vegas",
            firstPublished: 1971,
            originalLanguage: "английский",
            genres: ["роман", "гонзо-журналистика"],
            tags: ["контркультура", "Лас-Вегас", "экранизация"],
            description: "Сатирическое путешествие по Америке начала 1970-х, рассказанное языком гонзо-журналистики.",
          }
        ),
      ],
      genres: ["публицистика", "гонзо-журналистика"],
      language: "английский",
      nationality: "американец",
      tags: ["XX век", "контркультура"],
      articleUrl: "https://probpera.ru/read/page-article/page-books/22",
    },
    {
      id: "mario_puzo",
      name: "Марио Джанлуиджи Пьюзо",
      fullName: "Mario Gianluigi Puzo",
      years: "1920–1999",
      birthDate: "1920-10-15",
      deathDate: "1999-07-02",
      birthPlace: "Нью-Йорк, США",
      portrait: "",
      bio: "Американский писатель и сценарист итальянского происхождения. Пьюзо исследовал темы семьи, власти, преступления и социальной мобильности в американской культуре XX века.",
      works: ["Шесть могил на пути в Мюнхен"],
      workDetails: [
        articleWork(
          "six-graves-to-munich",
          "Шесть могил на пути в Мюнхен",
          "https://probpera.ru/read/page-article/page-books/13",
          {
            originalTitle: "Six Graves to Munich",
            firstPublished: 1967,
            originalLanguage: "английский",
            genres: ["триллер", "роман"],
            tags: ["месть", "послевоенная Европа"],
            description: "Триллер о человеке, который после войны разыскивает виновных в своих мучениях; первоначально роман был опубликован под псевдонимом Марио Клери.",
          }
        ),
      ],
      genres: ["роман", "триллер"],
      language: "английский",
      nationality: "американец",
      tags: ["XX век", "американская проза"],
      articleUrl: "https://probpera.ru/read/page-article/page-books/13",
    },
    {
      id: "michael_crichton",
      name: "Джон Майкл Крайтон",
      fullName: "John Michael Crichton",
      years: "1942–2008",
      birthDate: "1942-10-23",
      deathDate: "2008-11-04",
      birthPlace: "Чикаго, США",
      portrait: "",
      bio: "Американский писатель, сценарист и режиссёр, известный технотриллерами, в которых научная гипотеза становится основой напряжённого сюжета.",
      works: ["Парк юрского периода"],
      workDetails: [
        articleWork("jurassic-park", "Парк юрского периода", "https://probpera.ru/read/page-article/page-bookvsmovie/9", {
          originalTitle: "Jurassic Park",
          firstPublished: 1990,
          originalLanguage: "английский",
          genres: ["научная фантастика", "технотриллер"],
          tags: ["генетика", "динозавры", "экранизация"],
          description: "Технотриллер о тематическом парке с клонированными динозаврами и последствиях попытки превратить сложную живую систему в управляемый аттракцион.",
        }),
      ],
      genres: ["технотриллер", "научная фантастика"],
      language: "английский",
      nationality: "американец",
      tags: ["XX век", "жанровая литература"],
      articleUrl: "https://probpera.ru/read/page-article/page-bookvsmovie/9",
    },
    {
      id: "chuck_palahniuk",
      name: "Чарльз Майкл Паланик",
      fullName: "Charles Michael Palahniuk",
      years: "1962–",
      birthDate: "1962-02-21",
      birthPlace: "Паско, штат Вашингтон, США",
      portrait: "",
      bio: "Американский писатель, работающий с сатирой, трансгрессивной прозой и темами отчуждения в современной массовой культуре.",
      works: ["Бойцовский клуб"],
      workDetails: [
        articleWork("fight-club", "Бойцовский клуб", "https://probpera.ru/read/page-article/page-bookvsmovie/6", {
          originalTitle: "Fight Club",
          firstPublished: 1996,
          originalLanguage: "английский",
          genres: ["роман", "трансгрессивная проза"],
          tags: ["идентичность", "потребление", "экранизация"],
          description: "Сатирический роман об отчуждении, потребительской культуре и разрушительных способах поиска идентичности.",
        }),
      ],
      genres: ["роман", "сатира"],
      language: "английский",
      nationality: "американец",
      tags: ["XX век", "современная литература"],
      articleUrl: "https://probpera.ru/read/page-article/page-bookvsmovie/6",
    },
    {
      id: "dr_seuss",
      name: "Теодор Сьюз Гайзель",
      fullName: "Theodor Seuss Geisel",
      years: "1904–1991",
      birthDate: "1904-03-02",
      deathDate: "1991-09-24",
      birthPlace: "Спрингфилд, Массачусетс, США",
      portrait: "",
      bio: "Американский детский писатель и художник, публиковавшийся под именем Доктор Сьюз. Его книги узнаваемы по ритмической прозе, языковой игре и выразительным авторским иллюстрациям.",
      works: ["Как Гринч украл Рождество"],
      workDetails: [
        articleWork(
          "how-the-grinch-stole-christmas",
          "Гринч — похититель Рождества",
          "https://probpera.ru/read/page-article/page-bookvsmovie/7",
          {
            originalTitle: "How the Grinch Stole Christmas!",
            firstPublished: 1957,
            originalLanguage: "английский",
            genres: ["детская литература", "стихотворная сказка"],
            tags: ["Рождество", "сатира", "экранизация"],
            description: "Ритмическая сказка о Гринче, который пытается лишить жителей Ктограда Рождества, но обнаруживает, что праздник не сводится к вещам.",
          }
        ),
      ],
      genres: ["детская литература", "поэзия"],
      language: "английский",
      nationality: "американец",
      tags: ["XX век", "детская классика"],
      articleUrl: "https://probpera.ru/read/page-article/page-bookvsmovie/7",
    },
    {
      id: "winston_groom",
      name: "Уинстон Фрэнсис Грум",
      fullName: "Winston Francis Groom",
      years: "1943–2020",
      birthDate: "1943-03-23",
      deathDate: "2020-09-17",
      birthPlace: "Вашингтон, США",
      portrait: "",
      bio: "Американский писатель и журналист, автор романов и документальных книг об истории США и военных конфликтах.",
      works: ["Форрест Гамп"],
      workDetails: [
        articleWork("forrest-gump", "Форрест Гамп", "https://probpera.ru/read/page-article/page-bookvsmovie/12", {
          originalTitle: "Forrest Gump",
          firstPublished: 1986,
          originalLanguage: "английский",
          genres: ["роман", "сатирическая проза"],
          tags: ["Америка", "история", "экранизация"],
          description: "Сатирический роман, в котором наивный рассказчик оказывается участником и свидетелем заметных событий американской истории второй половины XX века.",
        }),
      ],
      genres: ["роман", "документальная проза"],
      language: "английский",
      nationality: "американец",
      tags: ["XX век", "американская литература"],
      articleUrl: "https://probpera.ru/read/page-article/page-bookvsmovie/12",
    },
  ],
};

type ArticleSeriesEntry = readonly [
  title: string,
  articleUrl: string,
  form?: "Роман" | "Повесть" | "Рассказ" | "Пьеса" | "Проза",
];

function stableArticleWorkId(title: string, articleUrl: string) {
  const source = `${title}|${articleUrl}`;
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `article-series-${(hash >>> 0).toString(36)}`;
}

function seriesWork([title, articleUrl, form = "Проза"]: ArticleSeriesEntry) {
  return articleWork(stableArticleWorkId(title, articleUrl), title, articleUrl, {
    genres: [form.toLocaleLowerCase("ru")],
    tags: ["редакционная подборка", "упоминается в статье"],
    description: `Произведение включено в редакционную подборку «Пробы Пера». Карточка связана с полной статьёй, её иллюстрациями и обсуждением.`,
  });
}

function seriesWriter(
  id: string,
  entries: ArticleSeriesEntry[],
  details: Partial<WriterProfile> = {}
): WriterProfile {
  const workDetails = entries.map(seriesWork);
  return {
    id,
    ...details,
    works: workDetails.map((work) => work.title),
    workDetails,
    articles: [...new Set(entries.map(([, articleUrl]) => articleUrl))],
  };
}

const topBooks = (part: number) =>
  `https://probpera.ru/read/page-article/topbooks/${part}`;
const topStories = (part: number) =>
  `https://probpera.ru/read/page-article/topstories/${part}`;

const articleSeriesWriters: Record<string, WriterProfile[]> = {
  argentina: [
    seriesWriter("jorge_luis_borges", [
      ["Сад, где ветвятся дорожки", topStories(7), "Рассказ"],
      ["Юг", topStories(7), "Рассказ"],
      ["Бессмертный", topStories(7), "Рассказ"],
      ["Дом Астерия", topStories(7), "Рассказ"],
      ["Тайное чудо", topStories(7), "Рассказ"],
      ["Пьер Менар, автор Дон Кихота", topStories(7), "Рассказ"],
      ["Круги руин", topStories(7), "Рассказ"],
    ]),
  ],
  austria: [
    seriesWriter("rainer_maria_rilke", [
      ["Записки Мальте Лауридса Бригге", topBooks(7), "Роман"],
    ]),
  ],
  czechia: [
    seriesWriter("milan_kundera", [
      ["Книга смеха и забвения", topBooks(8), "Роман"],
    ]),
  ],
  england: [
    seriesWriter("arthur_conan_doyle", [
      ["Белый отряд", topBooks(4), "Роман"],
    ]),
    seriesWriter("charles_dickens", [
      ["Наш общий друг", topBooks(1), "Роман"],
      ["Жизнь и приключения Мартина Чезлвита", topBooks(7), "Роман"],
    ]),
    seriesWriter("george_eliot", [["Мидлмарч", topBooks(9), "Роман"]]),
    seriesWriter("george_orwell", [
      ["Да здравствует фикус!", topBooks(4), "Роман"],
    ]),
    seriesWriter("graham_greene", [
      ["Конец одного романа", topBooks(8), "Роман"],
    ]),
    seriesWriter("h_g_wells", [
      ["Тоно Бенге", topBooks(6), "Роман"],
      ["Звезда", topStories(1), "Рассказ"],
      ["Это было в каменном веке", topStories(1), "Рассказ"],
      ["Чудотворец", topStories(1), "Рассказ"],
      ["Бог Динамо", topStories(1), "Рассказ"],
      ["История покойного мистера Элвешема", topStories(1), "Рассказ"],
      ["Странная орхидея", topStories(1), "Рассказ"],
      ["Сокровище в лесу", topStories(1), "Рассказ"],
    ]),
    seriesWriter("john_galsworthy", [["Конец главы", topBooks(9), "Роман"]]),
    seriesWriter("laurence_sterne", [
      ["Жизнь и мнения Тристрама Шенди, джентльмена", topBooks(9), "Роман"],
    ]),
    seriesWriter("robert_louis_stevenson", [
      ["Чёрная стрела", topBooks(1), "Роман"],
    ]),
    seriesWriter("virginia_woolf", [["Между актов", topBooks(3), "Роман"]]),
    seriesWriter(
      "evelyn_waugh",
      [["Упадок и разрушение", topBooks(6), "Роман"]],
      {
        name: "Ивлин Во",
        fullName: "Артур Ивлин Сент-Джон Во",
        years: "1903–1966",
        birthDate: "1903-10-28",
        deathDate: "1966-04-10",
        portrait: "",
        bio: "Английский романист, биограф, автор путевой прозы и литературной критики. В ранних книгах Ивлин Во соединял точность композиции с сатирическим взглядом на британское общество; роман «Упадок и разрушение» стал его литературным дебютом в большой прозе.",
        genres: ["роман", "сатира", "биография", "путевая проза"],
        language: "английский",
        nationality: "англичанин",
        editorial: {
          status: "reviewed",
          reviewedAt,
          sources: [
            {
              title: "Evelyn Waugh — biographical record",
              url: "https://www.britannica.com/biography/Evelyn-Waugh",
              publisher: "Encyclopaedia Britannica",
            },
          ],
        },
      }
    ),
    seriesWriter(
      "anthony_trollope",
      [["Барчестерские башни", topBooks(8), "Роман"]],
      {
        name: "Энтони Троллоп",
        fullName: "Энтони Троллоп",
        years: "1815–1882",
        birthDate: "1815-04-24",
        deathDate: "1882-12-06",
        portrait: "",
        bio: "Английский писатель викторианской эпохи, прославившийся циклами о вымышленных графствах и внимательным изображением общественных институтов, повседневных компромиссов и нравственного выбора. «Барчестерские башни» входят в его Барсетширские хроники.",
        genres: ["роман", "социальная проза"],
        language: "английский",
        nationality: "англичанин",
        editorial: {
          status: "reviewed",
          reviewedAt,
          sources: [
            {
              title: "Anthony Trollope — biographical record",
              url: "https://www.britannica.com/biography/Anthony-Trollope",
              publisher: "Encyclopaedia Britannica",
            },
          ],
        },
      }
    ),
    seriesWriter(
      "wilkie_collins",
      [["Лунный камень", topBooks(9), "Роман"]],
      {
        name: "Уилки Коллинз",
        fullName: "Уильям Уилки Коллинз",
        years: "1824–1889",
        birthDate: "1824-01-08",
        deathDate: "1889-09-23",
        portrait: "",
        bio: "Английский романист и драматург, один из главных мастеров сенсационного романа. «Лунный камень» соединил многоголосное повествование, тайну и процедуру расследования и стал важной вехой в истории детективной прозы.",
        genres: ["роман", "детектив", "сенсационная проза"],
        language: "английский",
        nationality: "англичанин",
        editorial: {
          status: "reviewed",
          reviewedAt,
          sources: [
            {
              title: "William Wilkie Collins",
              url: "https://en.wikisource.org/wiki/1911_Encyclop%C3%A6dia_Britannica/Collins%2C_William_Wilkie",
              publisher: "Encyclopaedia Britannica (1911)",
            },
          ],
        },
      }
    ),
    seriesWriter(
      "roald_dahl",
      [
        ["Хозяйка пансиона", topStories(11), "Рассказ"],
        ["Человек с юга", topStories(11), "Рассказ"],
        ["Ягнёнок на заклание", topStories(11), "Рассказ"],
        ["Кожа", topStories(11), "Рассказ"],
        ["Уильям и Мэри", topStories(11), "Рассказ"],
        ["Дорога в рай", topStories(11), "Рассказ"],
        ["Дегустатор", topStories(11), "Рассказ"],
      ],
      {
        name: "Роальд Даль",
        fullName: "Роальд Даль",
        years: "1916–1990",
        birthDate: "1916-09-13",
        deathDate: "1990-11-23",
        portrait: "",
        bio: "Британский писатель валлийского происхождения, автор детских книг и рассказов для взрослой аудитории. Его малая проза часто строится на точной бытовой детали, психологическом напряжении и неожиданном, нередко мрачном финале.",
        genres: ["рассказ", "детская литература", "чёрный юмор"],
        language: "английский",
        nationality: "британец",
        editorial: {
          status: "reviewed",
          reviewedAt,
          sources: [
            {
              title: "Roald Dahl — biographical record",
              url: "https://www.britannica.com/biography/Roald-Dahl",
              publisher: "Encyclopaedia Britannica",
            },
          ],
        },
      }
    ),
  ],
  france: [
    seriesWriter("alexandre_dumas", [["Учитель фехтования", topBooks(1), "Роман"]]),
    seriesWriter("balzac", [["Полковник Шабер", topBooks(2), "Повесть"]]),
    seriesWriter("henri_barbusse", [
      ["Нокаут", topStories(2), "Рассказ"],
      ["Судьба", topStories(2), "Рассказ"],
      ["Шито белыми нитками", topStories(2), "Рассказ"],
      ["Подвиги Лантюрлю", topStories(2), "Рассказ"],
      ["Каменный человек", topStories(2), "Рассказ"],
      ["Саар", topStories(2), "Рассказ"],
    ]),
    seriesWriter("marcel_proust", [["Пленница", topBooks(3), "Роман"]]),
    seriesWriter("voltaire", [["Кандид, или Оптимизм", topBooks(8), "Повесть"]]),
    seriesWriter(
      "louis_ferdinand_celine",
      [["Смерть в кредит", topBooks(7), "Роман"]],
      {
        name: "Луи-Фердинанд Селин",
        fullName: "Луи-Фердинанд Селин (Луи Фердинанд Огюст Детуш)",
        years: "1894–1961",
        birthDate: "1894-05-27",
        deathDate: "1961-07-01",
        portrait: "",
        bio: "Французский писатель и врач, заметно повлиявший на ритм и разговорную интонацию прозы XX века. Его литературное новаторство рассматривается вместе с принципиально важным историческим контекстом: автор также публиковал антисемитские памфлеты, остающиеся предметом критической оценки.",
        genres: ["роман", "модернистская проза"],
        language: "французский",
        nationality: "француз",
        editorial: {
          status: "reviewed",
          reviewedAt,
          sources: [
            {
              title: "Louis-Ferdinand Céline — biographical record",
              url: "https://www.britannica.com/biography/Louis-Ferdinand-Celine",
              publisher: "Encyclopaedia Britannica",
            },
          ],
        },
      }
    ),
  ],
  germany: [
    seriesWriter("thomas_mann", [["Королевское высочество", topBooks(2), "Роман"]]),
  ],
  ireland: [
    seriesWriter(
      "iris_murdoch",
      [
        ["Чёрный принц", topBooks(6), "Роман"],
        ["Под сетью", topBooks(8), "Роман"],
      ],
      {
        name: "Айрис Мёрдок",
        fullName: "Джин Айрис Мёрдок",
        years: "1919–1999",
        birthDate: "1919-07-15",
        deathDate: "1999-02-08",
        birthPlace: "Дублин, Ирландия",
        portrait: "",
        bio: "Ирландско-британская писательница и философ, исследовавшая в романах свободу, нравственный выбор, любовь и самообман. Её проза соединяет интеллектуальную проблематику с драматической интригой; «Под сетью» стало первым романом Мёрдок, а «Чёрный принц» — одной из её наиболее известных книг.",
        genres: ["роман", "философская проза"],
        language: "английский",
        nationality: "ирландско-британская писательница",
        editorial: {
          status: "reviewed",
          reviewedAt,
          sources: [
            {
              title: "Iris Murdoch — biographical record",
              url: "https://en.wikipedia.org/wiki/Iris_Murdoch",
              publisher: "Wikipedia",
            },
          ],
        },
      }
    ),
  ],
  nigeria: [
    seriesWriter("chinua_achebe", [["Всё рушится", topBooks(9), "Роман"]]),
  ],
  poland: [
    seriesWriter(
      "joseph_conrad",
      [["Ностромо", topBooks(5), "Роман"]],
      {
        name: "Джозеф Конрад",
        fullName: "Юзеф Теодор Конрад Коженёвский",
        years: "1857–1924",
        birthDate: "1857-12-03",
        deathDate: "1924-08-03",
        portrait: "",
        bio: "Польско-британский писатель, создававший произведения на английском языке после многолетней морской службы. В его прозе нравственный выбор и ответственность раскрываются в ситуациях риска, изоляции и столкновения культур; «Ностромо» относится к центральным романам Конрада.",
        genres: ["роман", "морская проза", "модернизм"],
        language: "английский",
        nationality: "поляк, британский писатель",
        editorial: {
          status: "reviewed",
          reviewedAt,
          sources: [
            {
              title: "Joseph Conrad — biographical record",
              url: "https://en.wikipedia.org/wiki/Joseph_Conrad",
              publisher: "Wikipedia",
            },
          ],
        },
      }
    ),
  ],
  portugal: [
    seriesWriter("jose_saramago", [["Прозрение", topBooks(7), "Роман"]]),
  ],
  russia: [
    seriesWriter("chekhov", [
      ["Степь", topBooks(5), "Повесть"],
      ["Брожение умов", topStories(4), "Рассказ"],
      ["Жалобная книга", topStories(4), "Рассказ"],
      ["Смерть чиновника", topStories(4), "Рассказ"],
      ["В бане", topStories(4), "Рассказ"],
      ["Лошадиная фамилия", topStories(4), "Рассказ"],
      ["Розовый чулок", topStories(4), "Рассказ"],
      ["Случай с классиком", topStories(4), "Рассказ"],
    ]),
    seriesWriter("dostoevsky", [
      ["Подросток", topBooks(1), "Роман"],
      ["Село Степанчиково и его обитатели", topBooks(3), "Повесть"],
    ]),
    seriesWriter("gogol", [["Рим", topBooks(2), "Повесть"]]),
    seriesWriter("tolstoy", [
      ["Казаки", topBooks(1), "Повесть"],
      ["После бала", topStories(8), "Рассказ"],
      ["Алёша Горшок", topStories(8), "Рассказ"],
      ["Страшный зверь", topStories(8), "Рассказ"],
      ["Эскимосы", topStories(8), "Рассказ"],
      ["Лев и собачка", topStories(8), "Рассказ"],
      ["Филипок", topStories(8), "Рассказ"],
      ["Царь и рубашка", topStories(8), "Рассказ"],
    ]),
    seriesWriter("turgenev", [["Дым", topBooks(5), "Роман"]]),
  ],
  south_africa: [
    seriesWriter("jm_coetzee", [["Мастер из Петербурга", topBooks(8), "Роман"]]),
  ],
  usa: [
    seriesWriter("edgar_allan_poe", [
      ["Лигейя", topStories(10), "Рассказ"],
      ["Морелла", topStories(10), "Рассказ"],
      ["Разговор с мумией", topStories(10), "Рассказ"],
      ["Человек толпы", topStories(10), "Рассказ"],
      ["Береника", topStories(10), "Рассказ"],
      ["Тень", topStories(10), "Рассказ"],
      ["Остров феи", topStories(10), "Рассказ"],
    ]),
    seriesWriter("ernest_hemingway", [
      ["Иметь и не иметь", topBooks(2), "Роман"],
      ["Праздник, который всегда с тобой", topBooks(9), "Проза"],
      ["Там, где светло и чисто", topStories(9), "Рассказ"],
      ["Убийцы", topStories(9), "Рассказ"],
      ["Кошка под дождём", topStories(9), "Рассказ"],
      ["Американский боец", topStories(9), "Рассказ"],
      ["Индейский посёлок", topStories(9), "Рассказ"],
      ["Свет мира", topStories(9), "Рассказ"],
      ["Недолгое счастье Фрэнсиса Макомбера", topStories(9), "Рассказ"],
    ]),
    seriesWriter("francis_scott_fitzgerald", [
      ["Прекрасные и проклятые", topBooks(4), "Роман"],
    ]),
    seriesWriter("henry_james", [["Крылья голубки", topBooks(6), "Роман"]]),
    seriesWriter("herman_melville", [
      ["Писец Бартлби", topBooks(3), "Повесть"],
      ["Билли Бадд, фор-марсовый матрос", topBooks(5), "Повесть"],
    ]),
    seriesWriter("jack_london", [
      ["Закон жизни", topStories(6), "Рассказ"],
      ["Отступник", topStories(6), "Рассказ"],
      ["Как аргонавты в старину", topStories(6), "Рассказ"],
      ["Там, где расходятся пути", topStories(6), "Рассказ"],
      ["Страшные Соломоновы острова", topStories(6), "Рассказ"],
      ["Тайфун у берегов Японии", topStories(6), "Рассказ"],
      ["Кусок мяса", topStories(6), "Рассказ"],
    ]),
    seriesWriter("mark_twain", [
      ["Таинственный незнакомец", topBooks(1), "Повесть"],
      ["Знаменитая скачущая лягушка из Калавераса", topStories(3), "Рассказ"],
      ["Рассказ о дурном мальчике", topStories(3), "Рассказ"],
      ["Мак-Вильямсы и круп", topStories(3), "Рассказ"],
      ["Рассказ коммивояжера", topStories(3), "Рассказ"],
      ["Журналистика в Теннеси", topStories(3), "Рассказ"],
      ["Правдивая история, записанная слово в слово, как я ее слышал", topStories(3), "Рассказ"],
      ["Письмо ангела-хранителя", topStories(3), "Рассказ"],
    ]),
    seriesWriter("sinclair_lewis", [
      ["Призрачный страж", topStories(5), "Рассказ"],
      ["Длинная рука маленького города", topStories(5), "Рассказ"],
      ["Возница", topStories(5), "Рассказ"],
      ["Юный Кнут Аксельброд", topStories(5), "Рассказ"],
      ["Назад в Вермонт", topStories(5), "Рассказ"],
      ["Издательская старина", topStories(5), "Рассказ"],
      ["Мой первый день в Нью-Йорке", topStories(5), "Рассказ"],
    ]),
    seriesWriter("theodore_dreiser", [["Гений", topBooks(6), "Роман"]]),
    seriesWriter("vladimir_nabokov", [["Пнин", topBooks(7), "Роман"]]),
    seriesWriter("william_faulkner", [
      ["Пилон", topBooks(3), "Роман"],
      ["Святилище", topBooks(4), "Роман"],
    ]),
  ],
};

function normalizedTitle(value = "") {
  return value.trim().toLocaleLowerCase("ru").replace(/[«»"'.,:;!?()[\]{}]/g, "");
}

function mergeWriter(existing: WriterProfile, supplement: WriterProfile) {
  const currentDetails = existing.workDetails || [];
  const supplementalDetails = supplement.workDetails || [];
  const supplementalByTitle = new Map(
    supplementalDetails.map((work) => [normalizedTitle(work.title), work])
  );
  const mergedCurrentDetails = currentDetails.map((work) => {
    const incoming = supplementalByTitle.get(normalizedTitle(work.title));
    if (!incoming) return work;
    supplementalByTitle.delete(normalizedTitle(work.title));
    return {
      ...incoming,
      ...work,
      alternateTitles: [
        ...new Set([
          ...(work.alternateTitles || []),
          ...(incoming.alternateTitles || []),
        ]),
      ],
      tags: [...new Set([...(work.tags || []), ...(incoming.tags || [])])],
      sourceUrl: work.sourceUrl || incoming.sourceUrl,
    };
  });
  const currentTitles = new Set(
    [...(existing.works || []), ...currentDetails.map((work) => work.title)].map(
      normalizedTitle
    )
  );
  const newDetails = [...supplementalByTitle.values()].filter(
    (work) => !currentTitles.has(normalizedTitle(work.title))
  );
  const works = [...(existing.works || [])];
  for (const title of supplement.works || []) {
    if (!currentTitles.has(normalizedTitle(title))) works.push(title);
  }

  return {
    ...supplement,
    ...existing,
    works,
    workDetails: [...mergedCurrentDetails, ...newDetails],
    articles: [
      ...new Set([...(existing.articles || []), ...(supplement.articles || [])]),
    ],
    articleUrl: existing.articleUrl || supplement.articleUrl,
  };
}

export function mergeArticleReferencedBooks(countries: Country[]): Country[] {
  return countries.map((country) => {
    const supplementsById = new Map<string, WriterProfile>();
    for (const supplement of [
      ...(articleReferencedWriters[country.id] || []),
      ...(articleSeriesWriters[country.id] || []),
      ...(articleCatalogWriters[country.id] || []),
    ]) {
      const current = supplementsById.get(supplement.id);
      supplementsById.set(
        supplement.id,
        current ? mergeWriter(current, supplement) : supplement
      );
    }
    const supplements = [...supplementsById.values()];
    if (!supplements.length) return country;

    const byId = new Map(supplements.map((writer) => [writer.id, writer]));
    const writers = country.writers.map((writer) => {
      const supplement = byId.get(writer.id);
      if (!supplement) return writer;
      byId.delete(writer.id);
      return mergeWriter(writer, supplement);
    });

    return { ...country, writers: [...writers, ...byId.values()] };
  });
}
