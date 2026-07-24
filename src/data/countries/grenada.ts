import type { Country } from "../types";

export const grenada: Country = {
  id: "grenada",
  name: "Гренада",
  code: "gd",
  writers: [
    {
      id: "george_brizan",
      name: "Джордж Бризан",
      years: "1942–2012",
      birthDate: "1942-01-01",
      deathDate: "2012-01-01",
      birthPlace: "Гренада",
      coordinates: {
        lat: 12.0561,
        lng: -61.7488
      },
      portrait: "",
      bio: "Гренадский писатель, историк и исследователь культуры. Автор работ, посвящённых истории Гренады, её обществу и национальной памяти. Один из заметных представителей интеллектуальной традиции страны.",
      works: [
        "Grenada: Island of Conflict",
        "Исторические исследования Гренады"
      ],
      genres: [
        "историческая проза",
        "эссе",
        "исследование культуры"
      ],
      language: "английский",
      nationality: "гренадец",
      awards: [],
      relatedWriters: [],
      tags: [
        "XX век",
        "история",
        "карибская культура"
      ],
      articleUrl: ""
    },

    {
      id: "julian_fedon",
      name: "Джулиан Федон",
      years: "1940–",
      birthDate: "1940-01-01",
      birthPlace: "Гренада",
      coordinates: {
        lat: 12.0561,
        lng: -61.7488
      },
      portrait: "",
      bio: "Гренадский автор и культурный деятель. В своих работах обращается к истории острова, национальной идентичности и культурному наследию Карибского региона.",
      works: [
        "Литературные и культурные очерки"
      ],
      genres: [
        "эссе",
        "проза"
      ],
      language: "английский",
      nationality: "гренадец",
      awards: [],
      relatedWriters: [
        "george_brizan"
      ],
      tags: [
        "XX век",
        "карибская литература"
      ],
      articleUrl: ""
    }
  ]
};
