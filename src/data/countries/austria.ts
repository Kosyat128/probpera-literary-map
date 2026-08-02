import type { Country } from "../types";

export const austria: Country = {
  id: "austria",
  name: "Австрия",
  code: "at",

  writers: [
    {
      id: "arthur_schnitzler",
      name: "Артур Шницлер",
      fullName: "Arthur Schnitzler",
      years: "1862–1931",
      birthDate: "1862-05-15",
      deathDate: "1931-10-21",
      birthPlace: "Вена",
      coordinates: {
        lat: 48.2082,
        lng: 16.3738
      },
      portrait: "",
      bio: "Австрийский писатель и драматург эпохи модернизма.",
      works: [
        "Круг",
        "Новелла о снах"
      ],
      genres: [
        "драма",
        "проза"
      ],
      language: "немецкий",
      nationality: "австриец",
      awards: [],
      relatedWriters: [
        "stefan_zweig"
      ],
      tags: [
        "XX век"
      ],
      articleUrl: ""
    },

    {
      id: "hugo_von_hofmannsthal",
      name: "Гуго фон Гофмансталь",
      fullName: "Hugo von Hofmannsthal",
      years: "1874–1929",
      birthDate: "1874-02-01",
      deathDate: "1929-07-15",
      birthPlace: "Вена",
      coordinates: {
        lat: 48.2082,
        lng: 16.3738
      },
      portrait: "",
      bio: "Австрийский поэт, драматург и один из основателей Зальцбургского фестиваля.",
      works: [
        "Башня",
        "Каждый человек"
      ],
      genres: [
        "драма",
        "поэзия"
      ],
      language: "немецкий",
      nationality: "австриец",
      awards: [],
      relatedWriters: [
        "rainer_maria_rilke"
      ],
      tags: [
        "XX век"
      ],
      articleUrl: ""
    },

    {
      id: "rainer_maria_rilke",
      name: "Райнер Мария Рильке",
      fullName: "Rainer Maria Rilke",
      years: "1875–1926",
      birthDate: "1875-12-04",
      deathDate: "1926-12-29",
      birthPlace: "Прага",
      coordinates: {
        lat: 50.0755,
        lng: 14.4378
      },
      portrait: "",
      bio: "Немецкоязычный поэт австро-центральноевропейской культурной традиции.",
      works: [
        "Дуинские элегии",
        "Сонеты к Орфею"
      ],
      genres: [
        "поэзия"
      ],
      language: "немецкий",
      nationality: "немецкоязычный автор",
      awards: [],
      relatedWriters: [
        "robert_musil"
      ],
      tags: [
        "XX век"
      ],
      articleUrl: ""
    },

    {
      id: "robert_musil",
      name: "Роберт Музиль",
      fullName: "Robert Musil",
      years: "1880–1942",
      birthDate: "1880-11-06",
      deathDate: "1942-04-15",
      birthPlace: "Клагенфурт",
      coordinates: {
        lat: 46.62,
        lng: 14.31
      },
      portrait: "",
      bio: "Австрийский писатель-модернист, автор одного из главных романов XX века.",
      works: [
        "Человек без свойств"
      ],
      genres: [
        "роман"
      ],
      language: "немецкий",
      nationality: "австриец",
      awards: [],
      relatedWriters: [
        "stefan_zweig"
      ],
      tags: [
        "XX век"
      ],
      articleUrl: ""
    },

    {
      id: "stefan_zweig",
      name: "Стефан Цвейг",
      fullName: "Stefan Zweig",
      years: "1881–1942",
      birthDate: "1881-11-28",
      deathDate: "1942-02-23",
      birthPlace: "Вена",
      coordinates: {
        lat: 48.2082,
        lng: 16.3738
      },
      portrait: "",
      bio: "Австрийский писатель, биограф и эссеист.",
      works: [
        "Шахматная новелла",
        "Нетерпение сердца"
      ],
      genres: [
        "новелла",
        "эссе"
      ],
      language: "немецкий",
      nationality: "австриец",
      awards: [],
      relatedWriters: [
        "franz_kafka"
      ],
      tags: [
        "XX век"
      ],
      articleUrl: ""
    },

    {
      id: "franz_kafka",
      name: "Франц Кафка",
      fullName: "Franz Kafka",
      years: "1883–1924",
      birthDate: "1883-07-03",
      deathDate: "1924-06-03",
      birthPlace: "Прага",
      coordinates: {
        lat: 50.0755,
        lng: 14.4378
      },
      portrait: "",
      bio: "Немецкоязычный писатель Австро-Венгрии, один из крупнейших представителей модернизма.",
      workDetails: [
        {
          "id": "the-castle-editorial",
          "title": "Замок",
          "coverUrl": "brand/book-covers/the-castle-editorial.webp",
          "coverThumbnailUrl": "brand/book-covers/thumbs/the-castle-editorial.webp",
          "coverSourceUrl": "brand/book-covers/the-castle-editorial.webp",
          "coverRights": {
            "status": "editorial-original",
            "licenseName": "Редакционное оформление «Пробы Пера»",
            "creator": "Редакция «Пробы Пера»",
            "rightsHolder": "Проба Пера",
            "sourceUrl": "brand/book-covers/the-castle-editorial.webp",
            "checkedAt": "2026-08-02",
            "note": "Собственное редакционное оформление; не является обложкой конкретного издательского издания."
          },
          "editorial": {
            "status": "draft"
          }
        }
      ],
      works: [
        "Превращение",
        "Процесс",
      ],
      genres: [
        "роман",
        "новелла"
      ],
      language: "немецкий",
      nationality: "австро-венгерская немецкоязычная традиция",
      awards: [],
      relatedWriters: [
        "thomas_bernhard"
      ],
      tags: [
        "XX век"
      ],
      articleUrl: ""
    },

    {
      id: "thomas_bernhard",
      name: "Томас Бернхард",
      fullName: "Thomas Bernhard",
      years: "1931–1989",
      birthDate: "1931-02-09",
      deathDate: "1989-02-12",
      birthPlace: "Херлен",
      coordinates: {
        lat: 50.89,
        lng: 5.98
      },
      portrait: "",
      bio: "Австрийский писатель и драматург XX века.",
      works: [
        "Старые мастера"
      ],
      genres: [
        "роман",
        "драма"
      ],
      language: "немецкий",
      nationality: "австриец",
      awards: [],
      relatedWriters: [
        "elfriede_jelinek"
      ],
      tags: [
        "XX век"
      ],
      articleUrl: ""
    },

    {
      id: "elfriede_jelinek",
      name: "Эльфрида Елинек",
      fullName: "Elfriede Jelinek",
      years: "1946–",
      birthDate: "1946-10-20",
      deathDate: "",
      birthPlace: "Мюрццушлаг",
      coordinates: {
        lat: 47.6,
        lng: 15.67
      },
      portrait: "",
      bio: "Австрийская писательница, лауреат Нобелевской премии по литературе 2004 года.",
      works: [
        "Пианистка"
      ],
      genres: [
        "роман"
      ],
      language: "немецкий",
      nationality: "австрийка",
      awards: [
        "Нобелевская премия по литературе 2004"
      ],
      relatedWriters: [
        "peter_handke"
      ],
      tags: [
        "XX век",
        "XXI век"
      ],
      articleUrl: ""
    },

    {
      id: "peter_handke",
      name: "Петер Хандке",
      fullName: "Peter Handke",
      years: "1942–",
      birthDate: "1942-12-06",
      deathDate: "",
      birthPlace: "Гриффен",
      coordinates: {
        lat: 46.7,
        lng: 14.72
      },
      portrait: "",
      bio: "Австрийский писатель, лауреат Нобелевской премии по литературе 2019 года.",
      works: [
        "Страх вратаря перед одиннадцатиметровым"
      ],
      genres: [
        "роман",
        "драма"
      ],
      language: "немецкий",
      nationality: "австриец",
      awards: [
        "Нобелевская премия по литературе 2019"
      ],
      relatedWriters: [
        "daniel_kehlmann"
      ],
      tags: [
        "XX век",
        "XXI век"
      ],
      articleUrl: ""
    },

    {
      id: "daniel_kehlmann",
      name: "Даниэль Кельман",
      fullName: "Daniel Kehlmann",
      years: "1975–",
      birthDate: "1975-01-13",
      deathDate: "",
      birthPlace: "Мюнхен",
      coordinates: {
        lat: 48.1351,
        lng: 11.582
      },
      portrait: "",
      bio: "Современный немецкоязычный писатель австрийско-немецкой литературной традиции.",
      works: [
        "Измеряя мир"
      ],
      genres: [
        "роман"
      ],
      language: "немецкий",
      nationality: "австрийско-немецкая литературная традиция",
      awards: [],
      relatedWriters: [
        "stefan_zweig"
      ],
      tags: [
        "XXI век"
      ],
      articleUrl: ""
    }
  ]
};
