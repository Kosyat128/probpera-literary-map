import type { Country } from "../types";

export const bahamas: Country = {
  id: "bahamas",
  name: "Багамы",
  code: "bs",
  writers: [
    {
      id: "cyril_bray",
      name: "Сирил Д. Б. Брей",
      years: "1922-2011",
      birthPlace: "Нассау, Багамы",
      coordinates: {
        lat: 25.0343,
        lng: -77.3963
      },
      portrait: "",
      bio: "Багамский писатель, поэт и журналист. Один из представителей литературной традиции Багамских островов XX века. Его творчество связано с культурой, историей и общественной жизнью страны.",
      works: [
        "Поэтические произведения",
        "Публицистические работы"
      ],
      genres: [
        "поэзия",
        "публицистика"
      ],
      language: "английский",
      nationality: "багамец",
      awards: [],
      relatedWriters: [
        "wallace_whitfield"
      ],
      tags: [
        "XX век",
        "багамская литература",
        "карибская литература"
      ],
      articleUrl: ""
    },

    {
      id: "wallace_whitfield",
      name: "Уоллес Уитфилд",
      years: "1930-2007",
      birthPlace: "Багамы",
      coordinates: {
        lat: 25.0343,
        lng: -77.3963
      },
      portrait: "",
      bio: "Багамский писатель и поэт. Представитель национальной литературной культуры Багам, развивавший англоязычную карибскую традицию.",
      works: [
        "Поэтические произведения"
      ],
      genres: [
        "поэзия",
        "проза"
      ],
      language: "английский",
      nationality: "багамец",
      awards: [],
      relatedWriters: [
        "cyril_bray"
      ],
      tags: [
        "XX век",
        "карибская литература"
      ],
      articleUrl: ""
    }
  ]
};
