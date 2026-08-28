import type { Country } from "../types";

export const saintLucia: Country = {
  id: "saint_lucia",
  name: "Сент-Люсия",
  code: "lc",
  writers: [
    {
      id: "derek_walcott",
      name: "Дерек Уолкотт",
      years: "1930-2017",
      birthDate: "1930-01-23",
      deathDate: "2017-03-17",
      birthPlace: "Кастри, Сент-Люсия",
      deathPlace: "Кап-Эстейт, Сент-Люсия",
      coordinates: {
        lat: 14.0101,
        lng: -60.9875
      },
      portrait: "",
      bio: "Сент-люсийский поэт, драматург и писатель. Один из крупнейших англоязычных авторов XX века. Лауреат Нобелевской премии по литературе 1992 года. В его творчестве соединяются античная традиция, европейская культура и история Карибского региона.",
      works: [
        "Омерос",
        "Звёздное яблочное королевство",
        "Сон на горе Оберон"
      ],
      genres: [
        "поэзия",
        "драма",
        "эссе"
      ],
      language: "английский",
      nationality: "сент-люсиец",
      awards: [
        "Нобелевская премия по литературе 1992"
      ],
      relatedWriters: [
        "john_robert_lee"
      ],
      tags: [
        "XX век",
        "Нобелевская премия",
        "карибская литература"
      ],
      articleUrl: ""
    },

    {
      id: "john_robert_lee",
      name: "Джон Роберт Ли",
      years: "1948-",
      birthDate: "1948-01-01",
      birthPlace: "Сент-Люсия",
      coordinates: {
        lat: 14.0101,
        lng: -60.9875
      },
      portrait: "",
      bio: "Сент-люсийский поэт, писатель и культурный деятель. Один из представителей современной литературы Сент-Люсии. Его творчество связано с темами духовности, истории и карибской идентичности.",
      works: [
        "Elemental",
        "Artefacts"
      ],
      genres: [
        "поэзия",
        "эссе"
      ],
      language: "английский",
      nationality: "сент-люсиец",
      awards: [],
      relatedWriters: [
        "derek_walcott"
      ],
      tags: [
        "XX век",
        "XXI век",
        "поэзия",
        "карибская литература"
      ],
      articleUrl: ""
    }
  ]
};
