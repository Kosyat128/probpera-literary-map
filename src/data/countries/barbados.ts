import type { Country } from "../types";

export const barbados: Country = {
  id: "barbados",
  name: "Барбадос",
  code: "bb",
  writers: [
    {
      id: "george_lamming",
      name: "Джордж Лэмминг",
      years: "1927-2022",
      birthDate: "1927-06-08",
      deathDate: "2022-06-04",
      birthPlace: "Бриджтаун, Барбадос",
      deathPlace: "Бриджтаун, Барбадос",
      coordinates: {
        lat: 13.0975,
        lng: -59.6167
      },
      portrait: "",
      bio: "Барбадосский писатель, поэт и эссеист. Один из важнейших представителей карибской литературы XX века. Его произведения исследуют темы колониализма, миграции, идентичности и опыта жителей Вест-Индии.",
      works: [
        "В замке моей кожи",
        "Изгнанники из моей страны",
        "Век невинности"
      ],
      genres: [
        "роман",
        "эссе",
        "публицистика"
      ],
      language: "английский",
      nationality: "барбадосец",
      awards: [],
      relatedWriters: [
        "austin_clarke",
        "kamau_brathwaite"
      ],
      tags: [
        "XX век",
        "карибская литература",
        "постколониальная литература"
      ],
      articleUrl: ""
    },

    {
      id: "kamau_brathwaite",
      name: "Камау Брэтуэйт",
      years: "1930-2020",
      birthDate: "1930-05-11",
      deathDate: "2020-02-04",
      birthPlace: "Бриджтаун, Барбадос",
      deathPlace: "Барбадос",
      coordinates: {
        lat: 13.0975,
        lng: -59.6167
      },
      portrait: "",
      bio: "Барбадосский поэт, историк и литературовед. Один из крупнейших поэтов Карибского региона. Развивал идею самостоятельной карибской культурной и литературной традиции.",
      works: [
        "Права прохода",
        "Маскарад"
      ],
      genres: [
        "поэзия",
        "эссе"
      ],
      language: "английский",
      nationality: "барбадосец",
      awards: [
        "Премия Гриффина за поэзию"
      ],
      relatedWriters: [
        "george_lamming"
      ],
      tags: [
        "XX век",
        "поэзия",
        "карибская литература"
      ],
      articleUrl: ""
    },

    {
      id: "austin_clarke",
      name: "Остин Кларк",
      years: "1934-2016",
      birthDate: "1934-07-26",
      deathDate: "2016-06-26",
      birthPlace: "Сент-Майкл, Барбадос",
      deathPlace: "Торонто, Канада",
      coordinates: {
        lat: 13.0975,
        lng: -59.6167
      },
      portrait: "",
      bio: "Писатель барбадосского происхождения. Автор романов, рассказов и эссе о жизни карибской диаспоры, миграции и культурной памяти.",
      works: [
        "The Polished Hoe",
        "Growing Up Stupid Under the Union Jack"
      ],
      genres: [
        "роман",
        "рассказ",
        "эссе"
      ],
      language: "английский",
      nationality: "барбадосец",
      awards: [
        "Премия Скоттиабанк Гиллер 2002"
      ],
      relatedWriters: [
        "george_lamming",
        "kamau_brathwaite"
      ],
      tags: [
        "XX век",
        "XXI век",
        "литература диаспоры"
      ],
      articleUrl: ""
    }
  ]
};
