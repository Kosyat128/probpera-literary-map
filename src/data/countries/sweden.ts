import type { Country } from "../types";

export const sweden: Country = {
  id: "sweden",
  name: "Швеция",
  code: "se",

  writers: [
    {
      id: "verner_von_heidenstam",
      name: "Карл Густав Вернер фон Хейденстам",
      fullName: "Carl Gustaf Verner von Heidenstam",
      years: "1859–1940",
      nobelYear: 1916,
      birthDate: "1859-07-06",
      deathDate: "1940-05-20",
      birthPlace: "Ольсхаммар, Швеция",
      coordinates: { lat: 58.75, lng: 14.78 },
      portrait: "",
      bio: "Шведский поэт и прозаик, одна из центральных фигур национального неоромантизма. В его произведениях историческая память, пейзаж и личное переживание образуют торжественную, но внутренне напряжённую картину Швеции.",
      works: ["Паломничество и годы странствий", "Каролинцы", "Стихи"],
      genres: ["поэзия", "историческая проза", "роман"],
      language: "шведский",
      nationality: "швед",
      awards: ["Нобелевская премия по литературе 1916 года"],
      tags: ["XIX век", "XX век", "неоромантизм", "Нобелевская премия"],
      relatedWriters: [],
      articleUrl: "",
      editorial: {
        status: "verified",
        reviewedAt: "2026-08-01",
        sources: [
          {
            title: "The Nobel Prize in Literature 1916",
            publisher: "Nobel Prize",
            url: "https://www.nobelprize.org/prizes/literature/1916/summary/"
          }
        ]
      }
    },
    {
      id: "carl_michael_bellman",
      name: "Карл Михаэль Бельман",
      fullName: "Carl Michael Bellman",
      years: "1740–1795",

      birthDate: "1740-02-04",
      deathDate: "1795-02-11",

      birthPlace: "Стокгольм",

      coordinates: {
        lat: 59.3293,
        lng: 18.0686
      },

      portrait: "",

      bio: "Шведский поэт и автор песен XVIII века, один из крупнейших представителей шведской литературы эпохи Просвещения.",

      works: [
        "Послания Фредмана",
        "Песни Фредмана"
      ],

      genres: [
        "поэзия",
        "песни"
      ],

      language: "шведский",
      nationality: "швед",

      awards: [],

      relatedWriters: [
        "esaias_tegner"
      ],

      tags: [
        "XVIII век"
      ],

      articleUrl: ""
    },

    {
      id: "esaias_tegner",
      name: "Эсайас Тегнер",
      fullName: "Esaias Tegnér",

      years: "1782–1846",

      birthDate: "1782-11-13",
      deathDate: "1846-11-02",

      birthPlace: "Киркхульт",

      coordinates: {
        lat: 56.5,
        lng: 14.1
      },

      portrait: "",

      bio: "Шведский поэт эпохи романтизма, автор знаменитой эпической поэмы «Сага о Фритьофе».",

      works: [
        "Сага о Фритьофе"
      ],

      genres: [
        "эпос",
        "поэзия"
      ],

      language: "шведский",
      nationality: "швед",

      awards: [],

      relatedWriters: [
        "august_strindberg"
      ],

      tags: [
        "XIX век"
      ],

      articleUrl: ""
    },

    {
      id: "august_strindberg",
      name: "Август Стриндберг",
      fullName: "August Strindberg",

      years: "1849–1912",

      birthDate: "1849-01-22",
      deathDate: "1912-05-14",

      birthPlace: "Стокгольм",

      coordinates: {
        lat: 59.3293,
        lng: 18.0686
      },

      portrait: "",

      bio: "Великий шведский писатель и драматург, один из основателей современной европейской драмы.",

      works: [
        "Красная комната",
        "Фрёкен Жюли"
      ],

      genres: [
        "роман",
        "драма"
      ],

      language: "шведский",
      nationality: "швед",

      awards: [],

      relatedWriters: [
        "selma_lagerlof"
      ],

      tags: [
        "XIX век",
        "XX век"
      ],

      articleUrl: ""
    },

    {
      id: "selma_lagerlof",
      nobelYear: 1909,
      name: "Сельма Лагерлёф",
      fullName: "Selma Lagerlöf",

      years: "1858–1940",

      birthDate: "1858-11-20",
      deathDate: "1940-03-16",

      birthPlace: "Морбакка",

      coordinates: {
        lat: 59.73,
        lng: 13.16
      },

      portrait: "",

      bio: "Шведская писательница, первая женщина — лауреат Нобелевской премии по литературе.",

      works: [
        "Сага о Йёсте Берлинге",
        "Чудесное путешествие Нильса"
      ],

      genres: [
        "роман",
        "сказка"
      ],

      language: "шведский",
      nationality: "шведка",

      awards: [
        "Нобелевская премия по литературе 1909"
      ],

      relatedWriters: [
        "hjalmar_soderberg"
      ],

      tags: [
        "XIX век",
        "XX век"
      ],

      articleUrl: ""
    },

    {
      id: "hjalmar_soderberg",
      name: "Хьялмар Сёдерберг",
      fullName: "Hjalmar Söderberg",

      years: "1869–1941",

      birthDate: "1869-07-02",
      deathDate: "1941-10-14",

      birthPlace: "Стокгольм",

      coordinates: {
        lat: 59.3293,
        lng: 18.0686
      },

      portrait: "",

      bio: "Шведский писатель и драматург, один из крупнейших авторов рубежа XIX–XX веков.",

      works: [
        "Доктор Глас"
      ],

      genres: [
        "роман",
        "проза"
      ],

      language: "шведский",
      nationality: "швед",

      awards: [],

      relatedWriters: [
        "par_lagerkvist"
      ],

      tags: [
        "XX век"
      ],

      articleUrl: ""
    },

    {
      id: "par_lagerkvist",
      name: "Пэр Лагерквист",
      fullName: "Pär Lagerkvist",

      years: "1891–1974",

      birthDate: "1891-05-23",
      deathDate: "1974-07-11",

      birthPlace: "Векшё",

      coordinates: {
        lat: 56.88,
        lng: 14.81
      },

      portrait: "",

      bio: "Шведский писатель, лауреат Нобелевской премии по литературе 1951 года.",

      works: [
        "Варавва",
        "Карлик"
      ],

      genres: [
        "роман",
        "проза"
      ],

      language: "шведский",
      nationality: "швед",

      awards: [
        "Нобелевская премия по литературе 1951"
      ],

      relatedWriters: [
        "gunnar_ekelof"
      ],

      tags: [
        "XX век"
      ],

      articleUrl: ""
    },

    {
      id: "gunnar_ekelof",
      name: "Гуннар Эклёф",
      fullName: "Gunnar Ekelöf",

      years: "1907–1968",

      birthDate: "1907-09-15",
      deathDate: "1968-03-16",

      birthPlace: "Стокгольм",

      coordinates: {
        lat: 59.3293,
        lng: 18.0686
      },

      portrait: "",

      bio: "Один из крупнейших шведских поэтов XX века.",

      works: [
        "Диуан"
      ],

      genres: [
        "поэзия"
      ],

      language: "шведский",
      nationality: "швед",

      awards: [],

      relatedWriters: [
        "astrid_lindgren"
      ],

      tags: [
        "XX век"
      ],

      articleUrl: ""
    },

    {
      id: "astrid_lindgren",
      name: "Астрид Линдгрен",
      fullName: "Astrid Lindgren",

      years: "1907–2002",

      birthDate: "1907-11-14",
      deathDate: "2002-01-28",

      birthPlace: "Виммербю",

      coordinates: {
        lat: 57.67,
        lng: 15.85
      },

      portrait: "",

      bio: "Всемирно известная шведская писательница, автор произведений для детей.",

      works: [
        "Пеппи Длинныйчулок",
        "Карлсон, который живёт на крыше"
      ],

      genres: [
        "детская литература"
      ],

      language: "шведский",
      nationality: "шведка",

      awards: [],

      relatedWriters: [
        "kerstin_ekman"
      ],

      tags: [
        "XX век"
      ],

      articleUrl: ""
    },

    {
      id: "kerstin_ekman",
      name: "Керстин Экман",
      fullName: "Kerstin Ekman",

      years: "1933–",

      birthDate: "1933-08-27",
      deathDate: "",

      birthPlace: "Фалуне",

      coordinates: {
        lat: 60.61,
        lng: 15.63
      },

      portrait: "",

      bio: "Современная шведская писательница, автор романов и детективной прозы.",

      works: [
        "Ведьмы"
      ],

      genres: [
        "роман",
        "детектив"
      ],

      language: "шведский",
      nationality: "шведка",

      awards: [],

      relatedWriters: [
        "henning_mankell"
      ],

      tags: [
        "XX век",
        "XXI век"
      ],

      articleUrl: ""
    },

    {
      id: "henning_mankell",
      name: "Хеннинг Манкель",
      fullName: "Henning Mankell",

      years: "1948–2015",

      birthDate: "1948-02-03",
      deathDate: "2015-10-05",

      birthPlace: "Стокгольм",

      coordinates: {
        lat: 59.3293,
        lng: 18.0686
      },

      portrait: "",

      bio: "Шведский писатель, драматург и автор знаменитой серии детективов о комиссаре Валландере.",

      works: [
        "Убийца без лица"
      ],

      genres: [
        "детектив",
        "роман"
      ],

      language: "шведский",
      nationality: "швед",

      awards: [],

      relatedWriters: [
        "kerstin_ekman"
      ],

      tags: [
        "XX век",
        "XXI век"
      ],

      articleUrl: ""
    }
  ]
};
