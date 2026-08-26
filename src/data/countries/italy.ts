import type { Country } from "../types";

export const italy: Country = {
  id: "italy",
  name: "Италия",
  code: "it",
  writers: [
    {
      id: "giosue_carducci",
      name: "Джозуэ Кардуччи",
      fullName: "Giosuè Carducci",
      years: "1835-1907",
      nobelYear: 1906,
      birthDate: "1835-07-27",
      deathDate: "1907-02-16",
      birthPlace: "Вальдикастелло, Италия",
      coordinates: { lat: 43.9762, lng: 10.2337 },
      portrait: "",
      bio: "Итальянский поэт, литературовед и педагог, связавший гражданскую поэзию эпохи Рисорджименто с вниманием к античной метрике и классической форме. Его творчество стало важной частью формирования культурного языка объединённой Италии.",
      works: ["Варварские оды", "Новые стихи", "Рифмы и ритмы"],
      genres: ["поэзия", "литературная критика", "эссе"],
      language: "итальянский",
      nationality: "итальянец",
      awards: ["Нобелевская премия по литературе 1906 года"],
      tags: ["XIX век", "Рисорджименто", "Нобелевская премия"],
      relatedWriters: [],
      articleUrl: "",
      editorial: {
        status: "verified",
        reviewedAt: "2026-08-01",
        sources: [
          {
            title: "The Nobel Prize in Literature 1906",
            publisher: "Nobel Prize",
            url: "https://www.nobelprize.org/prizes/literature/1906/summary/"
          }
        ]
      }
    },
    {
      id: "dante_alighieri",
      name: "Данте Алигьери",
      years: "1265-1321",
      birthDate: "1265-05-21",
      deathDate: "1321-09-14",
      birthPlace: "Флоренция, Италия",
      deathPlace: "Равенна, Италия",
      coordinates: {
        lat: 43.7696,
        lng: 11.2558
      },
      portrait: "",
      bio: "Величайший итальянский поэт Средневековья, создатель «Божественной комедии» и один из основателей итальянского литературного языка.",
      works: [
        "Божественная комедия",
        "Новая жизнь",
        "Пир"
      ],
      genres: [
        "эпическая поэзия",
        "философская литература",
        "лирика"
      ],
      language: "итальянский",
      nationality: "итальянец",
      awards: [],
      relatedWriters: [
        "petrarch",
        "boccaccio"
      ],
      tags: [
        "Средневековье",
        "мировая литература",
        "классика"
      ],
      articleUrl: ""
    },
    {
      id: "francesco_petrarca",
      name: "Франческо Петрарка",
      years: "1304-1374",
      birthDate: "1304-07-20",
      deathDate: "1374-07-19",
      birthPlace: "Ареццо, Италия",
      deathPlace: "Аркуа-Петрарка, Италия",
      coordinates: {
        lat: 43.4631,
        lng: 11.8796
      },
      portrait: "",
      bio: "Итальянский поэт и гуманист, один из основателей эпохи Возрождения.",
      works: [
        "Канцоньере",
        "Триумфы",
        "Моя тайна"
      ],
      genres: [
        "сонет",
        "лирика",
        "гуманистическая литература"
      ],
      language: "итальянский и латинский",
      nationality: "итальянец",
      awards: [],
      relatedWriters: [
        "dante_alighieri",
        "boccaccio"
      ],
      tags: [
        "Возрождение",
        "гуманизм"
      ],
      articleUrl: ""
    },
    {
      id: "giovanni_boccaccio",
      name: "Джованни Боккаччо",
      years: "1313-1375",
      birthDate: "1313-06-16",
      deathDate: "1375-12-21",
      birthPlace: "Чертальдо или Флоренция, Италия",
      deathPlace: "Чертальдо, Италия",
      coordinates: {
        lat: 43.548,
        lng: 11.042
      },
      portrait: "",
      bio: "Итальянский писатель и гуманист, автор «Декамерона», одного из важнейших произведений европейской литературы.",
      works: [
        "Декамерон",
        "Филоколо",
        "Фьяметта"
      ],
      genres: [
        "новелла",
        "проза",
        "гуманистическая литература"
      ],
      language: "итальянский",
      nationality: "итальянец",
      awards: [],
      relatedWriters: [
        "dante_alighieri",
        "francesco_petrarca"
      ],
      tags: [
        "Возрождение",
        "новеллистика"
      ],
      articleUrl: ""
    },
    {
      id: "jacopone_da_todi",
      name: "Якопоне да Тоди",
      years: "ок. 1230-1306",
      birthDate: "ок. 1230",
      deathDate: "1306-12-25",
      birthPlace: "Тоди, Италия",
      deathPlace: "Коллаццоне, Италия",
      coordinates: {
        lat: 42.779,
        lng: 12.406
      },
      portrait: "",
      bio: "Итальянский поэт и религиозный деятель Средневековья, один из крупнейших авторов духовной поэзии.",
      works: [
        "Лауды"
      ],
      genres: [
        "религиозная поэзия",
        "гимн"
      ],
      language: "итальянский",
      nationality: "итальянец",
      awards: [],
      relatedWriters: [],
      tags: [
        "Средневековье",
        "духовная литература"
      ],
      articleUrl: ""
    },
    {
      id: "niccolo_machiavelli",
      name: "Никколо Макиавелли",
      years: "1469-1527",
      birthDate: "1469-05-03",
      deathDate: "1527-06-21",
      birthPlace: "Флоренция, Италия",
      deathPlace: "Флоренция, Италия",
      coordinates: {
        lat: 43.7696,
        lng: 11.2558
      },
      portrait: "",
      bio: "Итальянский писатель, философ и политический мыслитель эпохи Возрождения.",
      works: [
        "Государь",
        "История Флоренции",
        "Мандрагора"
      ],
      genres: [
        "политическая философия",
        "трактат",
        "драма"
      ],
      language: "итальянский",
      nationality: "итальянец",
      awards: [],
      relatedWriters: [
        "dante_alighieri"
      ],
      tags: [
        "Возрождение",
        "политическая литература"
      ],
      articleUrl: ""
    },
    {
      id: "ludovico_ariosto",
      name: "Лудовико Ариосто",
      years: "1474-1533",
      birthDate: "1474-09-08",
      deathDate: "1533-07-06",
      birthPlace: "Реджо-нель-Эмилия, Италия",
      deathPlace: "Феррара, Италия",
      coordinates: {
        lat: 44.698,
        lng: 10.631
      },
      portrait: "",
      bio: "Итальянский поэт эпохи Возрождения, автор одного из величайших произведений рыцарской эпической поэзии.",
      works: [
        "Неистовый Роланд"
      ],
      genres: [
        "эпическая поэзия",
        "рыцарский роман"
      ],
      language: "итальянский",
      nationality: "итальянец",
      awards: [],
      relatedWriters: [
        "torquato_tasso"
      ],
      tags: [
        "Возрождение",
        "эпос"
      ],
      articleUrl: ""
    },
        {
      id: "torquato_tasso",
      name: "Торквато Тассо",
      years: "1544-1595",
      birthDate: "1544-03-11",
      deathDate: "1595-04-25",
      birthPlace: "Сорренто, Италия",
      deathPlace: "Рим, Италия",
      coordinates: {
        lat: 40.6263,
        lng: 14.3758
      },
      portrait: "",
      bio: "Итальянский поэт эпохи позднего Возрождения, автор одной из величайших эпических поэм европейской литературы.",
      works: [
        "Освобождённый Иерусалим",
        "Аминта"
      ],
      genres: [
        "эпическая поэзия",
        "пастораль",
        "драма"
      ],
      language: "итальянский",
      nationality: "итальянец",
      awards: [],
      relatedWriters: [
        "ludovico_ariosto"
      ],
      tags: [
        "Возрождение",
        "эпос"
      ],
      articleUrl: ""
    },
    {
      id: "baldassare_castiglione",
      name: "Бальдассаре Кастильоне",
      years: "1478-1529",
      birthDate: "1478-12-06",
      deathDate: "1529-02-02",
      birthPlace: "Казатико, Италия",
      deathPlace: "Толедо, Испания",
      coordinates: {
        lat: 45.107,
        lng: 10.758
      },
      portrait: "",
      bio: "Итальянский писатель и дипломат эпохи Возрождения, автор одного из главных произведений европейского гуманизма.",
      works: [
        "Книга о придворном"
      ],
      genres: [
        "диалог",
        "гуманистическая литература"
      ],
      language: "итальянский",
      nationality: "итальянец",
      awards: [],
      relatedWriters: [
        "niccolo_machiavelli"
      ],
      tags: [
        "Возрождение",
        "гуманизм"
      ],
      articleUrl: ""
    },
    {
      id: "giambattista_marino",
      name: "Джамбаттиста Марино",
      years: "1569-1625",
      birthDate: "1569-10-18",
      deathDate: "1625-03-26",
      birthPlace: "Неаполь, Италия",
      deathPlace: "Неаполь, Италия",
      coordinates: {
        lat: 40.8518,
        lng: 14.2681
      },
      portrait: "",
      bio: "Итальянский поэт эпохи барокко, основатель литературного направления маринизма.",
      works: [
        "Адонис",
        "Лира"
      ],
      genres: [
        "поэзия",
        "барокко"
      ],
      language: "итальянский",
      nationality: "итальянец",
      awards: [],
      relatedWriters: [],
      tags: [
        "XVII век",
        "барокко"
      ],
      articleUrl: ""
    },
    {
      id: "carlo_goldoni",
      name: "Карло Гольдони",
      years: "1707-1793",
      birthDate: "1707-02-25",
      deathDate: "1793-02-06",
      birthPlace: "Венеция, Италия",
      deathPlace: "Париж, Франция",
      coordinates: {
        lat: 45.4408,
        lng: 12.3155
      },
      portrait: "",
      bio: "Итальянский драматург, реформатор итальянской комедии и один из крупнейших авторов европейского театра XVIII века.",
      works: [
        "Слуга двух господ",
        "Трактирщица",
        "Кьоджинские перепалки"
      ],
      genres: [
        "комедия",
        "драматургия"
      ],
      language: "итальянский",
      nationality: "итальянец",
      awards: [],
      relatedWriters: [],
      tags: [
        "XVIII век",
        "театр"
      ],
      articleUrl: ""
    },
    {
      id: "vittorio_alfieri",
      name: "Витторио Альфьери",
      years: "1749-1803",
      birthDate: "1749-01-16",
      deathDate: "1803-10-08",
      birthPlace: "Асти, Италия",
      deathPlace: "Флоренция, Италия",
      coordinates: {
        lat: 44.9,
        lng: 8.206
      },
      portrait: "",
      bio: "Итальянский поэт и драматург эпохи Просвещения, один из основателей итальянской трагедии.",
      works: [
        "Филиппо",
        "Саул",
        "Мирра"
      ],
      genres: [
        "трагедия",
        "драма",
        "поэзия"
      ],
      language: "итальянский",
      nationality: "итальянец",
      awards: [],
      relatedWriters: [],
      tags: [
        "XVIII век",
        "драматургия"
      ],
      articleUrl: ""
    },
    {
      id: "cesare_beccaria",
      name: "Чезаре Беккариа",
      years: "1738-1794",
      birthDate: "1738-03-15",
      deathDate: "1794-11-28",
      birthPlace: "Милан, Италия",
      deathPlace: "Милан, Италия",
      coordinates: {
        lat: 45.4642,
        lng: 9.19
      },
      portrait: "",
      bio: "Итальянский мыслитель эпохи Просвещения, юрист и автор важнейших трудов по праву и гуманизму.",
      works: [
        "О преступлениях и наказаниях"
      ],
      genres: [
        "философский трактат",
        "правовая литература"
      ],
      language: "итальянский",
      nationality: "итальянец",
      awards: [],
      relatedWriters: [
        "vittorio_alfieri"
      ],
      tags: [
        "XVIII век",
        "Просвещение"
      ],
      articleUrl: ""
    },
    {
      id: "alessandro_manzoni",
      name: "Алессандро Мандзони",
      years: "1785-1873",
      birthDate: "1785-03-07",
      deathDate: "1873-05-22",
      birthPlace: "Милан, Италия",
      deathPlace: "Милан, Италия",
      coordinates: {
        lat: 45.4642,
        lng: 9.19
      },
      portrait: "",
      bio: "Итальянский писатель и поэт, один из основателей современного итальянского литературного языка.",
      works: [
        "Обручённые",
        "Гимны священные",
        "История итальянской революции"
      ],
      genres: [
        "исторический роман",
        "поэзия"
      ],
      language: "итальянский",
      nationality: "итальянец",
      awards: [],
      relatedWriters: [
        "giacomo_leopardi"
      ],
      tags: [
        "XIX век",
        "романтизм"
      ],
      articleUrl: ""
    },
        {
      id: "giacomo_leopardi",
      name: "Джакомо Леопарди",
      years: "1798-1837",
      birthDate: "1798-06-29",
      deathDate: "1837-06-14",
      birthPlace: "Реканати, Италия",
      deathPlace: "Неаполь, Италия",
      coordinates: {
        lat: 43.4035,
        lng: 13.549
      },
      portrait: "",
      bio: "Итальянский поэт, философ и мыслитель, один из величайших представителей европейского романтизма.",
      works: [
        "Бесконечность",
        "Песни",
        "Нравственные очерки"
      ],
      genres: [
        "поэзия",
        "философская проза"
      ],
      language: "итальянский",
      nationality: "итальянец",
      awards: [],
      relatedWriters: [
        "alessandro_manzoni"
      ],
      tags: [
        "XIX век",
        "романтизм",
        "поэзия"
      ],
      articleUrl: ""
    },
    {
      id: "silvio_pellico",
      name: "Сильвио Пеллико",
      years: "1789-1854",
      birthDate: "1789-06-25",
      deathDate: "1854-01-31",
      birthPlace: "Салуццо, Италия",
      deathPlace: "Турин, Италия",
      coordinates: {
        lat: 44.646,
        lng: 7.486
      },
      portrait: "",
      bio: "Итальянский писатель, драматург и участник движения Рисорджименто.",
      works: [
        "Мои темницы",
        "Франческа да Римини"
      ],
      genres: [
        "мемуары",
        "драма"
      ],
      language: "итальянский",
      nationality: "итальянец",
      awards: [],
      relatedWriters: [],
      tags: [
        "XIX век",
        "Рисорджименто"
      ],
      articleUrl: ""
    },
    {
      id: "giovanni_verga",
      name: "Джованни Верга",
      years: "1840-1922",
      birthDate: "1840-09-02",
      deathDate: "1922-01-27",
      birthPlace: "Катания, Италия",
      deathPlace: "Катания, Италия",
      coordinates: {
        lat: 37.5079,
        lng: 15.083
      },
      portrait: "",
      bio: "Итальянский писатель, крупнейший представитель веризма - итальянского направления реализма.",
      works: [
        "Семья Малаволья",
        "Сельская честь",
        "Мастро-дон Джезуальдо"
      ],
      genres: [
        "реализм",
        "натурализм",
        "новелла"
      ],
      language: "итальянский",
      nationality: "итальянец",
      awards: [],
      relatedWriters: [],
      tags: [
        "XIX век",
        "веризм"
      ],
      articleUrl: ""
    },
    {
      id: "luigi_capuana",
      name: "Луиджи Капуана",
      years: "1839-1915",
      birthDate: "1839-05-28",
      deathDate: "1915-11-29",
      birthPlace: "Минео, Италия",
      deathPlace: "Катания, Италия",
      coordinates: {
        lat: 37.265,
        lng: 14.691
      },
      portrait: "",
      bio: "Итальянский писатель и литературный критик, один из основателей направления веризма.",
      works: [
        "Джачинта",
        "Маркези ди Роккавердина"
      ],
      genres: [
        "роман",
        "реализм"
      ],
      language: "итальянский",
      nationality: "итальянец",
      awards: [],
      relatedWriters: [
        "giovanni_verga"
      ],
      tags: [
        "XIX век",
        "веризм"
      ],
      articleUrl: ""
    },
    {
      id: "gabriele_d_annunzio",
      name: "Габриэле Д’Аннунцио",
      years: "1863-1938",
      birthDate: "1863-03-12",
      deathDate: "1938-03-01",
      birthPlace: "Пескара, Италия",
      deathPlace: "Гардоне-Ривьера, Италия",
      coordinates: {
        lat: 42.4618,
        lng: 14.2161
      },
      portrait: "",
      bio: "Итальянский писатель, поэт и драматург, один из крупнейших представителей итальянского декаданса.",
      works: [
        "Наслаждение",
        "Дочь Иорио",
        "Триумф смерти"
      ],
      genres: [
        "роман",
        "поэзия",
        "драма"
      ],
      language: "итальянский",
      nationality: "итальянец",
      awards: [],
      relatedWriters: [],
      tags: [
        "XIX век",
        "декаданс"
      ],
      articleUrl: ""
    },
    {
      id: "luigi_pirandello",
      name: "Луиджи Пиранделло",
      years: "1867-1936",
      birthDate: "1867-06-28",
      deathDate: "1936-12-10",
      birthPlace: "Агридженто, Италия",
      deathPlace: "Рим, Италия",
      coordinates: {
        lat: 37.3111,
        lng: 13.5765
      },
      portrait: "",
      bio: "Итальянский драматург, писатель и поэт, лауреат Нобелевской премии по литературе 1934 года.",
      works: [
        "Шесть персонажей в поисках автора",
        "Генрих IV",
        "Покойный Маттиа Паскаль"
      ],
      genres: [
        "драма",
        "роман",
        "театр абсурда"
      ],
      language: "итальянский",
      nationality: "итальянец",
      awards: [
        "Нобелевская премия по литературе 1934 года"
      ],
      relatedWriters: [],
      tags: [
        "XX век",
        "Нобелевская премия",
        "драматургия"
      ],
      articleUrl: ""
    },
        {
      id: "italo_svevo",
      name: "Итало Свево",
      years: "1861-1928",
      birthDate: "1861-12-19",
      deathDate: "1928-09-13",
      birthPlace: "Триест, Австрийская империя",
      deathPlace: "Мотта-ди-Ливенца, Италия",
      coordinates: {
        lat: 45.6495,
        lng: 13.7768
      },
      portrait: "",
      bio: "Итальянский писатель еврейского происхождения, один из предшественников европейского модернизма и психологического романа.",
      works: [
        "Самопознание Дзено",
        "Старость",
        "Жизнь"
      ],
      genres: [
        "психологический роман",
        "модернизм"
      ],
      language: "итальянский",
      nationality: "итальянец",
      awards: [],
      relatedWriters: [
        "luigi_pirandello"
      ],
      tags: [
        "XX век",
        "модернизм"
      ],
      articleUrl: ""
    },
    {
      id: "grazia_deledda",
      name: "Грация Деледда",
      years: "1871-1936",
      birthDate: "1871-09-27",
      deathDate: "1936-08-15",
      birthPlace: "Нуоро, Италия",
      deathPlace: "Рим, Италия",
      coordinates: {
        lat: 40.321,
        lng: 9.329
      },
      portrait: "",
      bio: "Итальянская писательница, лауреат Нобелевской премии по литературе 1926 года.",
      works: [
        "Тростник на ветру",
        "Матерь",
        "Золото"
      ],
      genres: [
        "роман",
        "реализм"
      ],
      language: "итальянский",
      nationality: "итальянка",
      awards: [
        "Нобелевская премия по литературе 1926 года"
      ],
      relatedWriters: [],
      tags: [
        "XX век",
        "Нобелевская премия"
      ],
      articleUrl: ""
    },
    {
      id: "salvatore_quasimodo",
      name: "Сальваторе Квазимодо",
      years: "1901-1968",
      birthDate: "1901-08-20",
      deathDate: "1968-06-14",
      birthPlace: "Модика, Италия",
      deathPlace: "Неаполь, Италия",
      coordinates: {
        lat: 36.858,
        lng: 14.76
      },
      portrait: "",
      bio: "Итальянский поэт и переводчик, представитель герметизма, лауреат Нобелевской премии по литературе 1959 года.",
      works: [
        "И вдруг вечер",
        "Воды и земли",
        "День за днём"
      ],
      genres: [
        "поэзия",
        "лирика"
      ],
      language: "итальянский",
      nationality: "итальянец",
      awards: [
        "Нобелевская премия по литературе 1959 года"
      ],
      relatedWriters: [],
      tags: [
        "XX век",
        "Нобелевская премия",
        "поэзия"
      ],
      articleUrl: ""
    },
    {
      id: "eugenio_montale",
      name: "Эудженио Монтале",
      years: "1896-1981",
      birthDate: "1896-10-12",
      deathDate: "1981-09-12",
      birthPlace: "Генуя, Италия",
      deathPlace: "Милан, Италия",
      coordinates: {
        lat: 44.4056,
        lng: 8.9463
      },
      portrait: "",
      bio: "Итальянский поэт, лауреат Нобелевской премии по литературе 1975 года, один из крупнейших поэтов XX века.",
      works: [
        "Кости каракатицы",
        "Сатура",
        "Буря и другое"
      ],
      genres: [
        "поэзия",
        "эссе"
      ],
      language: "итальянский",
      nationality: "итальянец",
      awards: [
        "Нобелевская премия по литературе 1975 года"
      ],
      relatedWriters: [
        "salvatore_quasimodo"
      ],
      tags: [
        "XX век",
        "Нобелевская премия"
      ],
      articleUrl: ""
    },
    {
      id: "alberto_moravia",
      name: "Альберто Моравиа",
      years: "1907-1990",
      birthDate: "1907-11-28",
      deathDate: "1990-09-26",
      birthPlace: "Рим, Италия",
      deathPlace: "Рим, Италия",
      coordinates: {
        lat: 41.9028,
        lng: 12.4964
      },
      portrait: "",
      bio: "Итальянский писатель и журналист, один из крупнейших представителей итальянской прозы XX века.",
      works: [
        "Равнодушные",
        "Чочара",
        "Римлянка"
      ],
      genres: [
        "роман",
        "социальная проза"
      ],
      language: "итальянский",
      nationality: "итальянец",
      awards: [],
      relatedWriters: [],
      tags: [
        "XX век",
        "реализм"
      ],
      articleUrl: ""
    },
    {
      id: "cesare_pavese",
      name: "Чезаре Павезе",
      years: "1908-1950",
      birthDate: "1908-09-09",
      deathDate: "1950-08-27",
      birthPlace: "Сан-Стефано-Бельбо, Италия",
      deathPlace: "Турин, Италия",
      coordinates: {
        lat: 44.657,
        lng: 8.178
      },
      portrait: "",
      bio: "Итальянский писатель, поэт и переводчик, один из наиболее значительных авторов итальянского неореализма.",
      works: [
        "Луна и костры",
        "Дом на холме",
        "Товарищ"
      ],
      genres: [
        "роман",
        "поэзия",
        "неореализм"
      ],
      language: "итальянский",
      nationality: "итальянец",
      awards: [],
      relatedWriters: [],
      tags: [
        "XX век",
        "неореализм"
      ],
      articleUrl: ""
    },
    {
      id: "primo_levi",
      name: "Примо Леви",
      years: "1919-1987",
      birthDate: "1919-07-31",
      deathDate: "1987-04-11",
      birthPlace: "Турин, Италия",
      deathPlace: "Турин, Италия",
      coordinates: {
        lat: 45.0703,
        lng: 7.6869
      },
      portrait: "",
      bio: "Итальянский писатель и химик, автор важнейших произведений о Холокосте и человеческой памяти.",
      works: [
        "Человек ли это?",
        "Периодическая система",
        "Покоя нет"
      ],
      genres: [
        "мемуары",
        "документальная проза"
      ],
      language: "итальянский",
      nationality: "итальянец",
      awards: [],
      relatedWriters: [],
      tags: [
        "XX век",
        "историческая память"
      ],
      articleUrl: ""
    },
        {
      id: "italo_calvino",
      name: "Итало Кальвино",
      years: "1923-1985",
      birthDate: "1923-10-15",
      deathDate: "1985-09-19",
      birthPlace: "Сантьяго-де-Лас-Вегас, Куба",
      deathPlace: "Сиена, Италия",
      coordinates: {
        lat: 23.098,
        lng: -82.355
      },
      portrait: "",
      bio: "Итальянский писатель и журналист, один из крупнейших авторов европейского постмодернизма XX века.",
      works: [
        "Если однажды зимней ночью путник",
        "Невидимые города",
        "Барон на дереве",
        "Замок скрестившихся судеб"
      ],
      genres: [
        "постмодернизм",
        "фантастика",
        "роман"
      ],
      language: "итальянский",
      nationality: "итальянец",
      awards: [],
      relatedWriters: [
        "umberto_eco"
      ],
      tags: [
        "XX век",
        "постмодернизм"
      ],
      articleUrl: ""
    },
    {
      id: "dino_buzzati",
      name: "Дино Буццати",
      years: "1906-1972",
      birthDate: "1906-10-16",
      deathDate: "1972-01-28",
      birthPlace: "Сан-Пеллегрино-ди-Бельзуно, Италия",
      deathPlace: "Милан, Италия",
      coordinates: {
        lat: 46.171,
        lng: 12.248
      },
      portrait: "",
      bio: "Итальянский писатель и журналист, мастер философской и фантастической прозы.",
      works: [
        "Татарская пустыня",
        "Шестьдесят рассказов",
        "Любовь"
      ],
      genres: [
        "роман",
        "фантастика",
        "притча"
      ],
      language: "итальянский",
      nationality: "итальянец",
      awards: [],
      relatedWriters: [
        "italo_calvino"
      ],
      tags: [
        "XX век",
        "философская проза"
      ],
      articleUrl: ""
    },
    {
      id: "umberto_eco",
      name: "Умберто Эко",
      years: "1932-2016",
      birthDate: "1932-01-05",
      deathDate: "2016-02-19",
      birthPlace: "Алессандрия, Италия",
      deathPlace: "Милан, Италия",
      coordinates: {
        lat: 45.07,
        lng: 7.69
      },
      portrait: "",
      bio: "Итальянский писатель, философ, семиотик и учёный, автор интеллектуальных романов.",
      workDetails: [
        {
          "id": "the-name-of-the-rose-editorial",
          "title": "Имя розы",
          "coverUrl": "brand/book-covers/the-name-of-the-rose-editorial.webp",
          "coverThumbnailUrl": "brand/book-covers/thumbs/the-name-of-the-rose-editorial.webp",
          "coverSourceUrl": "brand/book-covers/the-name-of-the-rose-editorial.webp",
          "coverRights": {
            "status": "editorial-original",
            "licenseName": "Редакционное оформление «Пробы Пера»",
            "creator": "Редакция «Пробы Пера»",
            "rightsHolder": "Проба Пера",
            "sourceUrl": "brand/book-covers/the-name-of-the-rose-editorial.webp",
            "checkedAt": "2026-08-02",
            "note": "Собственное редакционное оформление; не является обложкой конкретного издательского издания."
          },
          "editorial": {
            "status": "draft"
          }
        }
      ],
      works: [
        "Маятник Фуко",
        "Остров накануне",
        "Пражское кладбище"
      ],
      genres: [
        "исторический роман",
        "детектив",
        "интеллектуальная проза"
      ],
      language: "итальянский",
      nationality: "итальянец",
      awards: [],
      relatedWriters: [
        "italo_calvino"
      ],
      tags: [
        "XX век",
        "постмодернизм",
        "мировая литература"
      ],
      articleUrl: ""
    },
    {
      id: "dario_fo",
      name: "Дарио Фо",
      years: "1926-2016",
      birthDate: "1926-03-24",
      deathDate: "2016-10-13",
      birthPlace: "Леньяно, Италия",
      deathPlace: "Милан, Италия",
      coordinates: {
        lat: 45.596,
        lng: 8.915
      },
      portrait: "",
      bio: "Итальянский драматург, актёр и режиссёр, лауреат Нобелевской премии по литературе 1997 года.",
      works: [
        "Случайная смерть анархиста",
        "Мистерия-буфф",
        "Не заплатим! Не заплатим!"
      ],
      genres: [
        "драма",
        "сатира",
        "театр"
      ],
      language: "итальянский",
      nationality: "итальянец",
      awards: [
        "Нобелевская премия по литературе 1997 года"
      ],
      relatedWriters: [
        "luigi_pirandello"
      ],
      tags: [
        "XX век",
        "Нобелевская премия",
        "театр"
      ],
      articleUrl: ""
    },
    {
      id: "andrea_camilleri",
      name: "Андреа Камиллери",
      years: "1925-2019",
      birthDate: "1925-09-06",
      deathDate: "2019-07-17",
      birthPlace: "Порто-Эмпедокле, Италия",
      deathPlace: "Рим, Италия",
      coordinates: {
        lat: 37.289,
        lng: 13.526
      },
      portrait: "",
      bio: "Итальянский писатель и сценарист, создатель популярной серии детективов о комиссаре Монтальбано.",
      works: [
        "Форма воды",
        "Собака из терракоты",
        "Голос скрипки"
      ],
      genres: [
        "детектив",
        "роман"
      ],
      language: "итальянский",
      nationality: "итальянец",
      awards: [],
      relatedWriters: [],
      tags: [
        "современная литература",
        "детектив"
      ],
      articleUrl: ""
    },
    {
      id: "elena_ferrante",
      name: "Елена Ферранте",
      years: "1943-",
      birthDate: "1943",
      birthPlace: "Неаполь, Италия",
      coordinates: {
        lat: 40.8518,
        lng: 14.2681
      },
      portrait: "",
      bio: "Итальянская писательница, известная романами о женской судьбе, дружбе и взрослении.",
      works: [
        "Моя гениальная подруга",
        "История нового имени",
        "Дни одиночества"
      ],
      genres: [
        "роман",
        "современная проза"
      ],
      language: "итальянский",
      nationality: "итальянка",
      awards: [],
      relatedWriters: [],
      tags: [
        "XXI век",
        "современная литература"
      ],
      articleUrl: ""
    },
    {
      id: "alessandro_baricco",
      name: "Алессандро Барикко",
      years: "1958-",
      birthDate: "1958-01-25",
      birthPlace: "Турин, Италия",
      coordinates: {
        lat: 45.0703,
        lng: 7.6869
      },
      portrait: "",
      bio: "Итальянский писатель, драматург и музыкальный критик, один из наиболее известных современных авторов Италии.",
      works: [
        "Шёлк",
        "Море-океан",
        "Такая история"
      ],
      genres: [
        "роман",
        "лирическая проза"
      ],
      language: "итальянский",
      nationality: "итальянец",
      awards: [],
      relatedWriters: [],
      tags: [
        "современная литература"
      ],
      articleUrl: ""
    },
    {
      id: "roberto_saviano",
      name: "Роберто Савиано",
      years: "1979-",
      birthDate: "1979-09-22",
      birthPlace: "Неаполь, Италия",
      coordinates: {
        lat: 40.8518,
        lng: 14.2681
      },
      portrait: "",
      bio: "Итальянский писатель и журналист, автор документальной прозы о современной Италии.",
      works: [
        "Гоморра",
        "Красный карнавал"
      ],
      genres: [
        "документальная проза",
        "журналистика"
      ],
      language: "итальянский",
      nationality: "итальянец",
      awards: [],
      relatedWriters: [],
      tags: [
        "XXI век",
        "документальная литература"
      ],
      articleUrl: ""
    }
  ]
};
