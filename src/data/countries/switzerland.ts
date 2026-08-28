import type { Country } from "../types";

export const switzerland: Country = {
  id: "switzerland",
  name: "Швейцария",
  code: "ch",

  writers: [
    {
      id: "carl_spitteler",
      name: "Карл Фридрих Георг Шпиттелер",
      fullName: "Carl Friedrich Georg Spitteler",
      years: "1845-1924",
      nobelYear: 1919,
      birthDate: "1845-04-24",
      deathDate: "1924-12-29",
      birthPlace: "Листаль, Швейцария",
      coordinates: { lat: 47.4845, lng: 7.735 },
      portrait: "",
      bio: "Швейцарский поэт и прозаик, создававший масштабные мифологические и аллегорические произведения на немецком языке. Его эпическая поэзия переосмысляет античные образы и ставит вопросы личной ответственности и духовной свободы.",
      works: ["Олимпийская весна", "Прометей и Эпиметей", "Имаго"],
      genres: ["поэзия", "эпос", "аллегорическая проза"],
      language: "немецкий",
      nationality: "швейцарец",
      awards: ["Нобелевская премия по литературе 1919 года"],
      tags: ["XIX век", "XX век", "Нобелевская премия"],
      relatedWriters: [],
      articleUrl: "",
      editorial: {
        status: "verified",
        reviewedAt: "2026-08-01",
        sources: [
          {
            title: "The Nobel Prize in Literature 1919",
            publisher: "Nobel Prize",
            url: "https://www.nobelprize.org/prizes/literature/1919/summary/"
          }
        ]
      }
    },
    {
      id: "johann_kaspar_lavater",
      name: "Иоганн Каспар Лафатер",
      fullName: "Johann Kaspar Lavater",
      years: "1741-1801",

      birthDate: "1741-11-15",
      deathDate: "1801-01-02",

      birthPlace: "Цюрих",

      coordinates: {
        lat: 47.3769,
        lng: 8.5417
      },

      portrait: "",

      bio: "Швейцарский писатель, поэт и мыслитель XVIII века.",

      works: [
        "Физиогномические фрагменты"
      ],

      genres: [
        "эссе",
        "поэзия"
      ],

      language: "немецкий",

      nationality: "швейцарец",

      awards: [],

      relatedWriters: [
        "gottfried_keller"
      ],

      tags: [
        "XVIII век"
      ],

      articleUrl: ""
    },

    {
      id: "gottfried_keller",
      name: "Готфрид Келлер",
      fullName: "Gottfried Keller",

      years: "1819-1890",

      birthDate: "1819-07-19",
      deathDate: "1890-07-15",

      birthPlace: "Цюрих",

      coordinates: {
        lat: 47.3769,
        lng: 8.5417
      },

      portrait: "",

      bio: "Один из крупнейших швейцарских писателей XIX века.",

      works: [
        "Зелёный Генрих"
      ],

      genres: [
        "роман",
        "новелла"
      ],

      language: "немецкий",

      nationality: "швейцарец",

      awards: [],

      relatedWriters: [
        "conrad_ferdinand_meyer"
      ],

      tags: [
        "XIX век"
      ],

      articleUrl: ""
    },

    {
      id: "conrad_ferdinand_meyer",
      name: "Конрад Фердинанд Майер",
      fullName: "Conrad Ferdinand Meyer",

      years: "1825-1898",

      birthDate: "1825-10-11",
      deathDate: "1898-11-28",

      birthPlace: "Цюрих",

      coordinates: {
        lat: 47.3769,
        lng: 8.5417
      },

      portrait: "",

      bio: "Швейцарский поэт и автор исторической прозы.",

      works: [
        "Юрг Дженач"
      ],

      genres: [
        "исторический роман",
        "поэзия"
      ],

      language: "немецкий",

      nationality: "швейцарец",

      awards: [],

      relatedWriters: [
        "hermann_hesse"
      ],

      tags: [
        "XIX век"
      ],

      articleUrl: ""
    },

    {
      id: "hermann_hesse",
      name: "Герман Гессе",
      fullName: "Hermann Hesse",

      years: "1877-1962",

      birthDate: "1877-07-02",
      deathDate: "1962-08-09",

      birthPlace: "Кальв",

      coordinates: {
        lat: 47.6,
        lng: 8.95
      },

      portrait: "",

      bio: "Немецко-швейцарский писатель, лауреат Нобелевской премии по литературе 1946 года.",

      works: [
        "Степной волк",
        "Игра в бисер"
      ],

      genres: [
        "роман"
      ],

      language: "немецкий",

      nationality: "немецко-швейцарский",

      awards: [
        "Нобелевская премия по литературе"
      ],

      relatedWriters: [
        "robert_walser"
      ],

      tags: [
        "XX век"
      ],

      articleUrl: ""
    },

    {
      id: "robert_walser",
      name: "Роберт Вальзер",
      fullName: "Robert Walser",

      years: "1878-1956",

      birthDate: "1878-04-15",
      deathDate: "1956-12-25",

      birthPlace: "Биль",

      coordinates: {
        lat: 47.14,
        lng: 7.25
      },

      portrait: "",

      bio: "Швейцарский писатель, оказавший влияние на литературу XX века.",

      works: [
        "Якоб фон Гунтен"
      ],

      genres: [
        "проза"
      ],

      language: "немецкий",

      nationality: "швейцарец",

      awards: [],

      relatedWriters: [
        "max_frisch"
      ],

      tags: [
        "XX век"
      ],

      articleUrl: ""
    },

    {
      id: "max_frisch",
      name: "Макс Фриш",
      fullName: "Max Frisch",

      years: "1911-1991",

      birthDate: "1911-05-15",
      deathDate: "1991-04-04",

      birthPlace: "Цюрих",

      coordinates: {
        lat: 47.3769,
        lng: 8.5417
      },

      portrait: "",

      bio: "Один из крупнейших швейцарских писателей и драматургов XX века.",

      works: [
        "Штиллер",
        "Homo Faber"
      ],

      genres: [
        "роман",
        "драма"
      ],

      language: "немецкий",

      nationality: "швейцарец",

      awards: [],

      relatedWriters: [
        "friedrich_durrenmatt"
      ],

      tags: [
        "XX век"
      ],

      articleUrl: ""
    },

    {
      id: "friedrich_durrenmatt",
      name: "Фридрих Дюрренматт",
      fullName: "Friedrich Dürrenmatt",

      years: "1921-1990",

      birthDate: "1921-01-05",
      deathDate: "1990-12-14",

      birthPlace: "Конольфинген",

      coordinates: {
        lat: 46.9,
        lng: 7.64
      },

      portrait: "",

      bio: "Швейцарский драматург и писатель, автор интеллектуальной прозы и пьес.",

      works: [
        "Визит старой дамы",
        "Физики"
      ],

      genres: [
        "драма",
        "детектив"
      ],

      language: "немецкий",

      nationality: "швейцарец",

      awards: [],

      relatedWriters: [
        "max_frisch"
      ],

      tags: [
        "XX век"
      ],

      articleUrl: ""
    }
  ]
};
