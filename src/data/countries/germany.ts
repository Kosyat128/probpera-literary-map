import type { Country } from "../types";

export const germany: Country = {
  id: "germany",
  name: "Германия",
  code: "de",
  writers: [
    {
      id: "theodor_mommsen",
      name: "Кристиан Маттиас Теодор Моммзен",
      fullName: "Christian Matthias Theodor Mommsen",
      years: "1817–1903",
      nobelYear: 1902,
      birthDate: "1817-11-30",
      deathDate: "1903-11-01",
      birthPlace: "Гардинг, Германия",
      coordinates: { lat: 54.3306, lng: 8.7808 },
      portrait: "",
      bio: "Немецкий историк античности, правовед и автор монументальной «Римской истории». Его труды объединили источниковедческую строгость с выразительным историческим повествованием и заметно повлияли на представление Европы о Древнем Риме.",
      works: ["Римская история", "Римское государственное право", "Римское уголовное право"],
      genres: ["историческая проза", "историография", "эссе"],
      language: "немецкий",
      nationality: "немец",
      awards: ["Нобелевская премия по литературе 1902 года"],
      tags: ["XIX век", "античность", "Нобелевская премия"],
      relatedWriters: [],
      articleUrl: "",
      editorial: {
        status: "verified",
        reviewedAt: "2026-08-01",
        sources: [
          {
            title: "The Nobel Prize in Literature 1902",
            publisher: "Nobel Prize",
            url: "https://www.nobelprize.org/prizes/literature/1902/summary/"
          }
        ]
      }
    },
    {
      id: "rudolf_eucken",
      name: "Рудольф Кристоф Эйкен",
      fullName: "Rudolf Christoph Eucken",
      years: "1846–1926",
      nobelYear: 1908,
      birthDate: "1846-01-05",
      deathDate: "1926-09-15",
      birthPlace: "Аурих, Германия",
      coordinates: { lat: 53.4692, lng: 7.4823 },
      portrait: "",
      bio: "Немецкий философ и автор трудов о духовной жизни, этике и месте человека в современной культуре. Его публицистическая проза стремилась соединить философскую систему с нравственной практикой.",
      works: ["Смысл и ценность жизни", "Основные течения современной мысли", "Борьба за духовное содержание жизни"],
      genres: ["философская проза", "эссе", "публицистика"],
      language: "немецкий",
      nationality: "немец",
      awards: ["Нобелевская премия по литературе 1908 года"],
      tags: ["XIX век", "XX век", "философия", "Нобелевская премия"],
      relatedWriters: [],
      articleUrl: "",
      editorial: {
        status: "verified",
        reviewedAt: "2026-08-01",
        sources: [
          {
            title: "The Nobel Prize in Literature 1908",
            publisher: "Nobel Prize",
            url: "https://www.nobelprize.org/prizes/literature/1908/summary/"
          }
        ]
      }
    },
    {
      id: "paul_heyse",
      name: "Пауль Йохан Людвиг фон Хейзе",
      fullName: "Paul Johann Ludwig von Heyse",
      years: "1830–1914",
      nobelYear: 1910,
      birthDate: "1830-03-15",
      deathDate: "1914-04-02",
      birthPlace: "Берлин, Германия",
      coordinates: { lat: 52.52, lng: 13.405 },
      portrait: "",
      bio: "Немецкий прозаик, поэт и драматург, мастер психологической новеллы. Хейзе также переводил итальянскую литературу и поддерживал связи между немецкой и средиземноморской культурными традициями.",
      works: ["Л’Арраббьята", "Дети мира", "В раю"],
      genres: ["новелла", "роман", "драма", "поэзия"],
      language: "немецкий",
      nationality: "немец",
      awards: ["Нобелевская премия по литературе 1910 года"],
      tags: ["XIX век", "немецкая новелла", "Нобелевская премия"],
      relatedWriters: [],
      articleUrl: "",
      editorial: {
        status: "verified",
        reviewedAt: "2026-08-01",
        sources: [
          {
            title: "The Nobel Prize in Literature 1910",
            publisher: "Nobel Prize",
            url: "https://www.nobelprize.org/prizes/literature/1910/summary/"
          }
        ]
      }
    },
    {
      id: "walther_von_der_vogelweide",
      name: "Вальтер фон дер Фогельвейде",
      years: "ок. 1170–1230",
      birthDate: "ок. 1170",
      deathDate: "ок. 1230",
      birthPlace: "Тироль или Франкония",
      deathPlace: "Вюрцбургская область",
      coordinates: {
        lat: 49.7913,
        lng: 9.9534
      },
      portrait: "",
      bio: "Крупнейший немецкий поэт Средневековья, один из самых известных представителей миннезанга.",
      works: [
        "Песни Вальтера фон дер Фогельвейде",
        "Политические песни"
      ],
      genres: [
        "рыцарская поэзия",
        "лирика",
        "миннезанг"
      ],
      language: "средневерхненемецкий",
      nationality: "немец",
      awards: [],
      relatedWriters: [],
      tags: [
        "Средневековье",
        "немецкая литература"
      ],
      articleUrl: ""
    },
    {
      id: "wolfram_von_eschenbach",
      name: "Вольфрам фон Эшенбах",
      years: "ок. 1170–ок. 1220",
      birthDate: "ок. 1170",
      deathDate: "ок. 1220",
      birthPlace: "Эшенбах, Германия",
      deathPlace: "Германия",
      coordinates: {
        lat: 49.583,
        lng: 10.86
      },
      portrait: "",
      bio: "Немецкий поэт Средневековья, один из крупнейших авторов рыцарского романа.",
      works: [
        "Парцифаль",
        "Виллехальм"
      ],
      genres: [
        "рыцарский роман",
        "эпос"
      ],
      language: "средневерхненемецкий",
      nationality: "немец",
      awards: [],
      relatedWriters: [
        "walther_von_der_vogelweide"
      ],
      tags: [
        "Средневековье",
        "рыцарская литература"
      ],
      articleUrl: ""
    },
    {
      id: "hartmann_von_aue",
      name: "Гартман фон Ауэ",
      years: "ок. 1160–ок. 1210",
      birthDate: "ок. 1160",
      deathDate: "ок. 1210",
      birthPlace: "Германия",
      deathPlace: "Германия",
      coordinates: {
        lat: 48.1351,
        lng: 11.582
      },
      portrait: "",
      bio: "Немецкий средневековый поэт, один из основателей немецкого рыцарского романа.",
      works: [
        "Эрек",
        "Бедный Генрих",
        "Ивейн"
      ],
      genres: [
        "рыцарский роман",
        "эпос"
      ],
      language: "средневерхненемецкий",
      nationality: "немец",
      awards: [],
      relatedWriters: [],
      tags: [
        "Средневековье"
      ],
      articleUrl: ""
    },
    {
      id: "martin_luther",
      name: "Мартин Лютер",
      years: "1483–1546",
      birthDate: "1483-11-10",
      deathDate: "1546-02-18",
      birthPlace: "Айслебен, Германия",
      deathPlace: "Айслебен, Германия",
      coordinates: {
        lat: 51.527,
        lng: 11.55
      },
      portrait: "",
      bio: "Немецкий богослов, переводчик и писатель, сыгравший важную роль в развитии немецкого литературного языка.",
      works: [
        "Перевод Библии на немецкий язык",
        "95 тезисов"
      ],
      genres: [
        "богословская литература",
        "перевод"
      ],
      language: "немецкий",
      nationality: "немец",
      awards: [],
      relatedWriters: [],
      tags: [
        "Реформация",
        "XVI век"
      ],
      articleUrl: ""
    },
    {
      id: "sebastian_brant",
      name: "Себастьян Брант",
      years: "1457–1521",
      birthDate: "1457",
      deathDate: "1521-05-10",
      birthPlace: "Страсбург",
      deathPlace: "Страсбург",
      coordinates: {
        lat: 48.5734,
        lng: 7.7521
      },
      portrait: "",
      bio: "Немецкий писатель-гуманист эпохи Возрождения, автор знаменитой сатирической поэмы.",
      works: [
        "Корабль дураков"
      ],
      genres: [
        "сатира",
        "аллегория",
        "поэма"
      ],
      language: "немецкий",
      nationality: "немец",
      awards: [],
      relatedWriters: [],
      tags: [
        "Возрождение",
        "гуманизм"
      ],
      articleUrl: ""
    },
    {
      id: "hans_sachs",
      name: "Ганс Сакс",
      years: "1494–1576",
      birthDate: "1494-11-05",
      deathDate: "1576-01-19",
      birthPlace: "Нюрнберг, Германия",
      deathPlace: "Нюрнберг, Германия",
      coordinates: {
        lat: 49.4521,
        lng: 11.0767
      },
      portrait: "",
      bio: "Немецкий поэт, драматург и мастерзингер эпохи Возрождения, один из самых плодотворных авторов своего времени.",
      works: [
        "Шванк",
        "Мейстерзингерские песни",
        "Драматические произведения"
      ],
      genres: [
        "драма",
        "поэзия",
        "сатира"
      ],
      language: "немецкий",
      nationality: "немец",
      awards: [],
      relatedWriters: [],
      tags: [
        "Возрождение",
        "XVI век"
      ],
      articleUrl: ""
    },
        {
      id: "andreas_gryphius",
      name: "Андреас Грифиус",
      years: "1616–1664",
      birthDate: "1616-10-02",
      deathDate: "1664-07-16",
      birthPlace: "Глогау, Силезия",
      deathPlace: "Глогау, Силезия",
      coordinates: {
        lat: 51.6636,
        lng: 16.0845
      },
      portrait: "",
      bio: "Немецкий поэт и драматург эпохи барокко, один из крупнейших представителей немецкой литературы XVII века.",
      works: [
        "Лео Армениус",
        "Карденио и Целинда",
        "Слезы отечества"
      ],
      genres: [
        "драма",
        "трагедия",
        "поэзия"
      ],
      language: "немецкий",
      nationality: "немец",
      awards: [],
      relatedWriters: [],
      tags: [
        "XVII век",
        "барокко"
      ],
      articleUrl: ""
    },
    {
      id: "grimmelshausen",
      name: "Ганс Якоб Кристоф Гриммельсгаузен",
      years: "ок. 1621–1676",
      birthDate: "ок. 1621",
      deathDate: "1676-08-17",
      birthPlace: "Гельнхаузен, Германия",
      deathPlace: "Ренхен, Германия",
      coordinates: {
        lat: 50.202,
        lng: 9.187
      },
      portrait: "",
      bio: "Немецкий писатель эпохи барокко, автор одного из важнейших немецких романов XVII века.",
      works: [
        "Симплициссимус"
      ],
      genres: [
        "роман",
        "сатира",
        "плутовской роман"
      ],
      language: "немецкий",
      nationality: "немец",
      awards: [],
      relatedWriters: [],
      tags: [
        "XVII век",
        "барокко"
      ],
      articleUrl: ""
    },
    {
      id: "lessing",
      name: "Готхольд Эфраим Лессинг",
      years: "1729–1781",
      birthDate: "1729-01-22",
      deathDate: "1781-02-15",
      birthPlace: "Каменц, Германия",
      deathPlace: "Брауншвейг, Германия",
      coordinates: {
        lat: 51.267,
        lng: 14.09
      },
      portrait: "",
      bio: "Немецкий писатель, драматург и философ эпохи Просвещения, один из основателей немецкой классической литературы.",
      works: [
        "Натан Мудрый",
        "Эмилия Галотти",
        "Лаокоон"
      ],
      genres: [
        "драма",
        "эстетика",
        "философская литература"
      ],
      language: "немецкий",
      nationality: "немец",
      awards: [],
      relatedWriters: [],
      tags: [
        "XVIII век",
        "Просвещение"
      ],
      articleUrl: ""
    },
    {
      id: "christoph_martin_wieland",
      name: "Кристоф Мартин Виланд",
      years: "1733–1813",
      birthDate: "1733-09-05",
      deathDate: "1813-01-20",
      birthPlace: "Оберхольцхайм, Германия",
      deathPlace: "Веймар, Германия",
      coordinates: {
        lat: 48.0,
        lng: 10.0
      },
      portrait: "",
      bio: "Немецкий писатель и поэт эпохи Просвещения, один из представителей Веймарского классицизма.",
      works: [
        "История Агатона",
        "Оберон"
      ],
      genres: [
        "роман",
        "поэзия",
        "эпос"
      ],
      language: "немецкий",
      nationality: "немец",
      awards: [],
      relatedWriters: [
        "goethe",
        "schiller"
      ],
      tags: [
        "XVIII век",
        "классицизм"
      ],
      articleUrl: ""
    },
    {
      id: "johann_gottfried_herder",
      name: "Иоганн Готфрид Гердер",
      years: "1744–1803",
      birthDate: "1744-08-25",
      deathDate: "1803-12-18",
      birthPlace: "Морунген, Пруссия",
      deathPlace: "Веймар, Германия",
      coordinates: {
        lat: 53.85,
        lng: 19.94
      },
      portrait: "",
      bio: "Немецкий философ, писатель и литературный теоретик, оказавший влияние на развитие немецкого романтизма.",
      works: [
        "Идеи к философии истории человечества",
        "О происхождении языка"
      ],
      genres: [
        "философия",
        "литературная критика"
      ],
      language: "немецкий",
      nationality: "немец",
      awards: [],
      relatedWriters: [
        "goethe"
      ],
      tags: [
        "XVIII век",
        "философия"
      ],
      articleUrl: ""
    },
    {
      id: "johann_wolfgang_goethe",
      name: "Иоганн Вольфганг Гёте",
      years: "1749–1832",
      birthDate: "1749-08-28",
      deathDate: "1832-03-22",
      birthPlace: "Франкфурт-на-Майне, Германия",
      deathPlace: "Веймар, Германия",
      coordinates: {
        lat: 50.1109,
        lng: 8.6821
      },
      portrait: "",
      bio: "Величайший немецкий писатель, поэт, мыслитель и государственный деятель, один из основателей мировой классической литературы.",
      works: [
        "Фауст",
        "Страдания юного Вертера",
        "Избирательное сродство",
        "Западно-восточный диван"
      ],
      genres: [
        "роман",
        "трагедия",
        "поэзия",
        "философская литература"
      ],
      language: "немецкий",
      nationality: "немец",
      awards: [],
      relatedWriters: [
        "schiller",
        "herder"
      ],
      tags: [
        "XVIII век",
        "Веймарский классицизм",
        "мировая литература"
      ],
      articleUrl: ""
    },
    {
      id: "friedrich_schiller",
      name: "Фридрих Шиллер",
      years: "1759–1805",
      birthDate: "1759-11-10",
      deathDate: "1805-05-09",
      birthPlace: "Марбах-на-Неккаре, Германия",
      deathPlace: "Веймар, Германия",
      coordinates: {
        lat: 48.939,
        lng: 9.26
      },
      portrait: "",
      bio: "Немецкий поэт, драматург и философ, один из крупнейших представителей Веймарского классицизма.",
      works: [
        "Разбойники",
        "Мария Стюарт",
        "Вильгельм Телль",
        "Ода к радости"
      ],
      genres: [
        "драма",
        "трагедия",
        "поэзия"
      ],
      language: "немецкий",
      nationality: "немец",
      awards: [],
      relatedWriters: [
        "johann_wolfgang_goethe"
      ],
      tags: [
        "XVIII век",
        "классицизм"
      ],
      articleUrl: ""
    },
        {
      id: "heinrich_von_kleist",
      name: "Генрих фон Клейст",
      years: "1777–1811",
      birthDate: "1777-10-18",
      deathDate: "1811-11-21",
      birthPlace: "Франкфурт-на-Одере, Пруссия",
      deathPlace: "Берлин, Пруссия",
      coordinates: {
        lat: 52.3471,
        lng: 14.5506
      },
      portrait: "",
      bio: "Немецкий писатель, драматург и поэт, один из самых значительных авторов переходного периода между классицизмом и романтизмом.",
      works: [
        "Разбитый кувшин",
        "Принц Фридрих Гомбургский",
        "Михаэль Кольхаас"
      ],
      genres: [
        "драма",
        "новелла",
        "романтизм"
      ],
      language: "немецкий",
      nationality: "немец",
      awards: [],
      relatedWriters: [
        "goethe",
        "schiller"
      ],
      tags: [
        "XIX век",
        "романтизм"
      ],
      articleUrl: ""
    },
    {
      id: "heinrich_heine",
      name: "Генрих Гейне",
      years: "1797–1856",
      birthDate: "1797-12-13",
      deathDate: "1856-02-17",
      birthPlace: "Дюссельдорф, Германия",
      deathPlace: "Париж, Франция",
      coordinates: {
        lat: 51.2277,
        lng: 6.7735
      },
      portrait: "",
      bio: "Немецкий поэт, публицист и критик, один из крупнейших представителей немецкого романтизма.",
      works: [
        "Книга песен",
        "Германия. Зимняя сказка",
        "Путевые картины"
      ],
      genres: [
        "поэзия",
        "сатира",
        "публицистика"
      ],
      language: "немецкий",
      nationality: "немец",
      awards: [],
      relatedWriters: [],
      tags: [
        "XIX век",
        "романтизм"
      ],
      articleUrl: ""
    },
    {
      id: "eduard_morike",
      name: "Эдуард Мёрике",
      years: "1804–1875",
      birthDate: "1804-09-08",
      deathDate: "1875-06-04",
      birthPlace: "Людвигсбург, Германия",
      deathPlace: "Штутгарт, Германия",
      coordinates: {
        lat: 48.897,
        lng: 9.191
      },
      portrait: "",
      bio: "Немецкий поэт и писатель XIX века, один из крупнейших представителей позднего романтизма.",
      works: [
        "Моцарт на пути в Прагу",
        "Стихотворения"
      ],
      genres: [
        "поэзия",
        "новелла"
      ],
      language: "немецкий",
      nationality: "немец",
      awards: [],
      relatedWriters: [],
      tags: [
        "XIX век",
        "романтизм"
      ],
      articleUrl: ""
    },
    {
      id: "theodor_fontane",
      name: "Теодор Фонтане",
      years: "1819–1898",
      birthDate: "1819-12-30",
      deathDate: "1898-09-20",
      birthPlace: "Нёйруппин, Пруссия",
      deathPlace: "Берлин, Германия",
      coordinates: {
        lat: 52.9167,
        lng: 12.8
      },
      portrait: "",
      bio: "Немецкий писатель и поэт, один из крупнейших представителей немецкого реализма XIX века.",
      works: [
        "Эффи Брист",
        "Госпожа Женни Трайбель",
        "Шах фон Вутенов"
      ],
      genres: [
        "реализм",
        "роман"
      ],
      language: "немецкий",
      nationality: "немец",
      awards: [],
      relatedWriters: [],
      tags: [
        "XIX век",
        "реализм"
      ],
      articleUrl: ""
    },
    {
      id: "gerhart_hauptmann",
      nobelYear: 1912,
      name: "Герхарт Гауптман",
      years: "1862–1946",
      birthDate: "1862-11-15",
      deathDate: "1946-06-06",
      birthPlace: "Обесальцбрунн, Германия",
      deathPlace: "Агнетендорф, Германия",
      coordinates: {
        lat: 50.8,
        lng: 15.6
      },
      portrait: "",
      bio: "Немецкий драматург и писатель, лауреат Нобелевской премии по литературе 1912 года.",
      works: [
        "Ткачи",
        "Перед восходом солнца",
        "Потонувший колокол"
      ],
      genres: [
        "драма",
        "натурализм"
      ],
      language: "немецкий",
      nationality: "немец",
      awards: [
        "Нобелевская премия по литературе 1912 года"
      ],
      relatedWriters: [],
      tags: [
        "XIX век",
        "XX век",
        "Нобелевская премия"
      ],
      articleUrl: ""
    },
    {
      id: "thomas_mann",
      name: "Томас Манн",
      years: "1875–1955",
      birthDate: "1875-06-06",
      deathDate: "1955-08-12",
      birthPlace: "Любек, Германия",
      deathPlace: "Цюрих, Швейцария",
      coordinates: {
        lat: 53.8655,
        lng: 10.6866
      },
      portrait: "",
      bio: "Немецкий писатель и эссеист, лауреат Нобелевской премии по литературе 1929 года, один из крупнейших романистов XX века.",
      workDetails: [
        {
          "id": "buddenbrooks-editorial",
          "title": "Будденброки",
          "coverUrl": "brand/book-covers/buddenbrooks-editorial.webp",
          "coverThumbnailUrl": "brand/book-covers/thumbs/buddenbrooks-editorial.webp",
          "coverSourceUrl": "brand/book-covers/buddenbrooks-editorial.webp",
          "coverRights": {
            "status": "editorial-original",
            "licenseName": "Редакционное оформление «Пробы Пера»",
            "creator": "Редакция «Пробы Пера»",
            "rightsHolder": "Проба Пера",
            "sourceUrl": "brand/book-covers/buddenbrooks-editorial.webp",
            "checkedAt": "2026-08-02",
            "note": "Собственное редакционное оформление; не является обложкой конкретного издательского издания."
          },
          "editorial": {
            "status": "draft"
          }
        }
      ],
      works: [
        "Волшебная гора",
        "Доктор Фаустус",
        "Смерть в Венеции"
      ],
      genres: [
        "роман",
        "философская проза"
      ],
      language: "немецкий",
      nationality: "немец",
      awards: [
        "Нобелевская премия по литературе 1929 года"
      ],
      relatedWriters: [
        "hermann_hesse"
      ],
      tags: [
        "XX век",
        "Нобелевская премия"
      ],
      articleUrl: ""
    },
    {
      id: "hermann_hesse",
      name: "Герман Гессе",
      years: "1877–1962",
      birthDate: "1877-07-02",
      deathDate: "1962-08-09",
      birthPlace: "Кальв, Германия",
      deathPlace: "Монтаньола, Швейцария",
      coordinates: {
        lat: 48.714,
        lng: 8.738
      },
      portrait: "",
      bio: "Немецко-швейцарский писатель и поэт, лауреат Нобелевской премии по литературе 1946 года.",
      works: [
        "Степной волк",
        "Игра в бисер",
        "Сиддхартха",
        "Демиан"
      ],
      genres: [
        "роман",
        "философская литература"
      ],
      language: "немецкий",
      nationality: "немецко-швейцарский",
      awards: [
        "Нобелевская премия по литературе 1946 года"
      ],
      relatedWriters: [
        "thomas_mann"
      ],
      tags: [
        "XX век",
        "Нобелевская премия"
      ],
      articleUrl: ""
    },
        {
      id: "franz_kafka",
      name: "Франц Кафка",
      years: "1883–1924",
      birthDate: "1883-07-03",
      deathDate: "1924-06-03",
      birthPlace: "Прага, Австро-Венгрия",
      deathPlace: "Кирлинг, Австрия",
      coordinates: {
        lat: 50.0755,
        lng: 14.4378
      },
      portrait: "",
      bio: "Немецкоязычный писатель еврейского происхождения из Праги, один из крупнейших авторов модернизма XX века.",
      works: [
        "Процесс",
        "Замок",
        "Превращение",
        "Америка"
      ],
      genres: [
        "модернизм",
        "экзистенциальная проза",
        "фантастика"
      ],
      language: "немецкий",
      nationality: "немецкоязычный писатель",
      awards: [],
      relatedWriters: [
        "hermann_hesse"
      ],
      tags: [
        "XX век",
        "модернизм",
        "пражская школа"
      ],
      articleUrl: ""
    },
    {
      id: "bertolt_brecht",
      name: "Бертольт Брехт",
      years: "1898–1956",
      birthDate: "1898-02-10",
      deathDate: "1956-08-14",
      birthPlace: "Аугсбург, Германия",
      deathPlace: "Берлин, Германия",
      coordinates: {
        lat: 48.3668,
        lng: 10.8985
      },
      portrait: "",
      bio: "Немецкий драматург, поэт и театральный режиссёр, создатель теории эпического театра.",
      works: [
        "Трёхгрошовая опера",
        "Мамаша Кураж и её дети",
        "Жизнь Галилея"
      ],
      genres: [
        "драма",
        "театр",
        "поэзия"
      ],
      language: "немецкий",
      nationality: "немец",
      awards: [],
      relatedWriters: [],
      tags: [
        "XX век",
        "драматургия"
      ],
      articleUrl: ""
    },
    {
      id: "stefan_zweig",
      name: "Стефан Цвейг",
      years: "1881–1942",
      birthDate: "1881-11-28",
      deathDate: "1942-02-22",
      birthPlace: "Вена, Австро-Венгрия",
      deathPlace: "Петрополис, Бразилия",
      coordinates: {
        lat: 48.2082,
        lng: 16.3738
      },
      portrait: "",
      bio: "Австрийский писатель, биограф и драматург, один из самых популярных европейских авторов первой половины XX века.",
      works: [
        "Нетерпение сердца",
        "Мария Стюарт",
        "Шахматная новелла",
        "Звёздные часы человечества"
      ],
      genres: [
        "новелла",
        "биография",
        "эссе"
      ],
      language: "немецкий",
      nationality: "австриец",
      awards: [],
      relatedWriters: [],
      tags: [
        "XX век",
        "немецкоязычная литература"
      ],
      articleUrl: ""
    },
    {
      id: "erich_maria_remarque",
      name: "Эрих Мария Ремарк",
      years: "1898–1970",
      birthDate: "1898-06-22",
      deathDate: "1970-09-25",
      birthPlace: "Оснабрюк, Германия",
      deathPlace: "Локарно, Швейцария",
      coordinates: {
        lat: 52.2799,
        lng: 8.0472
      },
      portrait: "",
      bio: "Немецкий писатель, один из наиболее известных авторов литературы о войне и «потерянном поколении».",
      workDetails: [
        {
          "id": "all-quiet-on-the-western-front-editorial",
          "title": "На Западном фронте без перемен",
          "coverUrl": "brand/book-covers/all-quiet-on-the-western-front-editorial.webp",
          "coverThumbnailUrl": "brand/book-covers/thumbs/all-quiet-on-the-western-front-editorial.webp",
          "coverSourceUrl": "brand/book-covers/all-quiet-on-the-western-front-editorial.webp",
          "coverRights": {
            "status": "editorial-original",
            "licenseName": "Редакционное оформление «Пробы Пера»",
            "creator": "Редакция «Пробы Пера»",
            "rightsHolder": "Проба Пера",
            "sourceUrl": "brand/book-covers/all-quiet-on-the-western-front-editorial.webp",
            "checkedAt": "2026-08-02",
            "note": "Собственное редакционное оформление; не является обложкой конкретного издательского издания."
          },
          "editorial": {
            "status": "draft"
          }
        },
        {
          "id": "arch-of-triumph-editorial",
          "title": "Триумфальная арка",
          "coverUrl": "brand/book-covers/arch-of-triumph-editorial.webp",
          "coverThumbnailUrl": "brand/book-covers/thumbs/arch-of-triumph-editorial.webp",
          "coverSourceUrl": "brand/book-covers/arch-of-triumph-editorial.webp",
          "coverRights": {
            "status": "editorial-original",
            "licenseName": "Редакционное оформление «Пробы Пера»",
            "creator": "Редакция «Пробы Пера»",
            "rightsHolder": "Проба Пера",
            "sourceUrl": "brand/book-covers/arch-of-triumph-editorial.webp",
            "checkedAt": "2026-08-02",
            "note": "Собственное редакционное оформление; не является обложкой конкретного издательского издания."
          },
          "editorial": {
            "status": "draft"
          }
        }
      ],
      works: [
        "Три товарища",
        "Жизнь взаймы"
      ],
      genres: [
        "роман",
        "антивоенная литература"
      ],
      language: "немецкий",
      nationality: "немец",
      awards: [],
      relatedWriters: [],
      tags: [
        "XX век",
        "потерянное поколение"
      ],
      articleUrl: ""
    },
    {
      id: "alfred_doblin",
      name: "Альфред Дёблин",
      years: "1878–1957",
      birthDate: "1878-08-10",
      deathDate: "1957-06-26",
      birthPlace: "Щецин, Германия",
      deathPlace: "Эммендинген, Германия",
      coordinates: {
        lat: 53.4285,
        lng: 14.5528
      },
      portrait: "",
      bio: "Немецкий писатель и врач, один из крупнейших представителей немецкого модернизма.",
      works: [
        "Берлин, Александерплац",
        "Три прыжка Ван Луня"
      ],
      genres: [
        "модернизм",
        "роман"
      ],
      language: "немецкий",
      nationality: "немец",
      awards: [],
      relatedWriters: [
        "franz_kafka"
      ],
      tags: [
        "XX век",
        "модернизм"
      ],
      articleUrl: ""
    },
    {
      id: "robert_musil",
      name: "Роберт Музиль",
      years: "1880–1942",
      birthDate: "1880-11-06",
      deathDate: "1942-04-15",
      birthPlace: "Клагенфурт, Австро-Венгрия",
      deathPlace: "Женева, Швейцария",
      coordinates: {
        lat: 46.6247,
        lng: 14.3053
      },
      portrait: "",
      bio: "Австрийский писатель и драматург, один из крупнейших авторов модернизма XX века.",
      works: [
        "Человек без свойств",
        "Три женщины"
      ],
      genres: [
        "модернизм",
        "роман"
      ],
      language: "немецкий",
      nationality: "австриец",
      awards: [],
      relatedWriters: [
        "franz_kafka"
      ],
      tags: [
        "XX век",
        "модернизм"
      ],
      articleUrl: ""
    },
    {
      id: "anna_seghers",
      name: "Анна Зегерс",
      years: "1900–1983",
      birthDate: "1900-11-19",
      deathDate: "1983-06-01",
      birthPlace: "Майнц, Германия",
      deathPlace: "Берлин, ГДР",
      coordinates: {
        lat: 49.9929,
        lng: 8.2473
      },
      portrait: "",
      bio: "Немецкая писательница, известная произведениями о фашизме, эмиграции и сопротивлении.",
      works: [
        "Седьмой крест",
        "Транзит"
      ],
      genres: [
        "роман",
        "историческая проза"
      ],
      language: "немецкий",
      nationality: "немка",
      awards: [],
      relatedWriters: [],
      tags: [
        "XX век",
        "антифашистская литература"
      ],
      articleUrl: ""
    },
        {
      id: "heinrich_boell",
      name: "Генрих Бёлль",
      years: "1917–1985",
      birthDate: "1917-12-21",
      deathDate: "1985-07-16",
      birthPlace: "Кёльн, Германия",
      deathPlace: "Лангенбройх, Германия",
      coordinates: {
        lat: 50.9375,
        lng: 6.9603
      },
      portrait: "",
      bio: "Немецкий писатель и публицист, один из крупнейших авторов послевоенной немецкой литературы, лауреат Нобелевской премии по литературе 1972 года.",
      works: [
        "Глазами клоуна",
        "Групповой портрет с дамой",
        "Где ты был, Адам?"
      ],
      genres: [
        "роман",
        "социальная проза"
      ],
      language: "немецкий",
      nationality: "немец",
      awards: [
        "Нобелевская премия по литературе 1972 года"
      ],
      relatedWriters: [
        "erich_maria_remarque"
      ],
      tags: [
        "XX век",
        "Нобелевская премия",
        "послевоенная литература"
      ],
      articleUrl: ""
    },
    {
      id: "guenter_grass",
      name: "Гюнтер Грасс",
      years: "1927–2015",
      birthDate: "1927-10-16",
      deathDate: "2015-04-13",
      birthPlace: "Данциг, Германия",
      deathPlace: "Любек, Германия",
      coordinates: {
        lat: 54.352,
        lng: 18.6466
      },
      portrait: "",
      bio: "Немецкий писатель, поэт и художник, лауреат Нобелевской премии по литературе 1999 года.",
      works: [
        "Жестяной барабан",
        "Собачьи годы",
        "Под местным наркозом"
      ],
      genres: [
        "роман",
        "магический реализм",
        "сатира"
      ],
      language: "немецкий",
      nationality: "немец",
      awards: [
        "Нобелевская премия по литературе 1999 года"
      ],
      relatedWriters: [
        "heinrich_boell"
      ],
      tags: [
        "XX век",
        "Нобелевская премия"
      ],
      articleUrl: ""
    },
    {
      id: "herta_mueller",
      name: "Герта Мюллер",
      years: "1953–",
      birthDate: "1953-08-17",
      birthPlace: "Ницкидорф, Румыния",
      coordinates: {
        lat: 45.752,
        lng: 21.0
      },
      portrait: "",
      bio: "Немецкая писательница румынского происхождения, лауреат Нобелевской премии по литературе 2009 года.",
      works: [
        "Качели дыхания",
        "Сердце-зверь",
        "Человек есть большой фазан на свете"
      ],
      genres: [
        "роман",
        "эссе",
        "поэзия"
      ],
      language: "немецкий",
      nationality: "немецкая",
      awards: [
        "Нобелевская премия по литературе 2009 года"
      ],
      relatedWriters: [],
      tags: [
        "современная литература",
        "Нобелевская премия"
      ],
      articleUrl: ""
    },
    {
      id: "patrick_suskind",
      name: "Патрик Зюскинд",
      years: "1949–",
      birthDate: "1949-03-26",
      birthPlace: "Амбах, Германия",
      coordinates: {
        lat: 47.95,
        lng: 11.32
      },
      portrait: "",
      bio: "Немецкий писатель и сценарист, один из наиболее известных современных немецких авторов.",
      works: [
        "Парфюмер",
        "Голубка",
        "Контрабас"
      ],
      genres: [
        "роман",
        "повесть",
        "драма"
      ],
      language: "немецкий",
      nationality: "немец",
      awards: [],
      relatedWriters: [],
      tags: [
        "современная литература"
      ],
      articleUrl: ""
    },
    {
      id: "christa_wolf",
      name: "Криста Вольф",
      years: "1929–2011",
      birthDate: "1929-03-18",
      deathDate: "2011-12-01",
      birthPlace: "Ландсберг-на-Варте, Германия",
      deathPlace: "Берлин, Германия",
      coordinates: {
        lat: 52.52,
        lng: 13.405
      },
      portrait: "",
      bio: "Немецкая писательница и эссеист, одна из крупнейших представительниц литературы ГДР.",
      works: [
        "Кассандра",
        "Расколотое небо",
        "Медея"
      ],
      genres: [
        "роман",
        "историческая проза"
      ],
      language: "немецкий",
      nationality: "немка",
      awards: [],
      relatedWriters: [],
      tags: [
        "XX век",
        "немецкая литература"
      ],
      articleUrl: ""
    },
    {
      id: "bernhard_schlink",
      name: "Бернхард Шлинк",
      years: "1944–",
      birthDate: "1944-07-06",
      birthPlace: "Билефельд, Германия",
      coordinates: {
        lat: 52.0302,
        lng: 8.5325
      },
      portrait: "",
      bio: "Немецкий писатель и юрист, автор современных романов о памяти и исторической ответственности.",
      works: [
        "Чтец",
        "Ольга",
        "Возвращение"
      ],
      genres: [
        "роман",
        "историческая проза"
      ],
      language: "немецкий",
      nationality: "немец",
      awards: [],
      relatedWriters: [],
      tags: [
        "современная литература"
      ],
      articleUrl: ""
    },
    {
      id: "daniel_kehlmann",
      name: "Даниэль Кельман",
      years: "1975–",
      birthDate: "1975-01-13",
      birthPlace: "Мюнхен, Германия",
      coordinates: {
        lat: 48.1351,
        lng: 11.582
      },
      portrait: "",
      bio: "Немецко-австрийский писатель, один из наиболее известных современных авторов немецкого языка.",
      works: [
        "Измеряя мир",
        "Тиль"
      ],
      genres: [
        "роман",
        "историческая проза"
      ],
      language: "немецкий",
      nationality: "немецко-австрийский",
      awards: [],
      relatedWriters: [],
      tags: [
        "XXI век",
        "современная литература"
      ],
      articleUrl: ""
    }
  ]
};
