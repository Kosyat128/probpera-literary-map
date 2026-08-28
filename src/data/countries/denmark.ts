import type { Country } from "../types";

export const denmark: Country = {
  id: "denmark",
  name: "Дания",
  code: "dk",

  writers: [
    {
      id: "karl_gjellerup",
      name: "Карл Адольф Гьеллеруп",
      fullName: "Karl Adolph Gjellerup",
      years: "1857-1919",
      nobelYear: 1917,
      birthDate: "1857-06-02",
      deathDate: "1919-10-11",
      birthPlace: "Рохольте, Дания",
      coordinates: { lat: 55.1809, lng: 12.0925 },
      portrait: "",
      bio: "Датский поэт и прозаик, писавший также по-немецки. Его творчество прошло путь от натурализма к философской прозе, в которой европейские мотивы соединяются с интересом к буддийской мысли.",
      works: ["Пилигрим Каманита", "Мельница", "Минна"],
      genres: ["роман", "поэзия", "философская проза"],
      language: "датский",
      nationality: "датчанин",
      awards: ["Нобелевская премия по литературе 1917 года"],
      tags: ["XIX век", "XX век", "Нобелевская премия"],
      relatedWriters: ["henrik_pontoppidan"],
      articleUrl: "",
      editorial: {
        status: "verified",
        reviewedAt: "2026-08-01",
        sources: [
          {
            title: "The Nobel Prize in Literature 1917",
            publisher: "Nobel Prize",
            url: "https://www.nobelprize.org/prizes/literature/1917/summary/"
          }
        ]
      }
    },
    {
      id: "henrik_pontoppidan",
      name: "Хенрик Понтоппидан",
      fullName: "Henrik Pontoppidan",
      years: "1857-1943",
      nobelYear: 1917,
      birthDate: "1857-07-24",
      deathDate: "1943-08-21",
      birthPlace: "Фредерисия, Дания",
      coordinates: { lat: 55.5657, lng: 9.7526 },
      portrait: "",
      bio: "Датский писатель-реалист, внимательно исследовавший социальные перемены, религиозную среду и цену личного самоопределения. Его крупные романы создают широкую панораму датского общества конца XIX - начала XX века.",
      works: ["Счастливчик Пер", "Земля обетованная", "Царство мёртвых"],
      genres: ["роман", "реализм", "социальная проза"],
      language: "датский",
      nationality: "датчанин",
      awards: ["Нобелевская премия по литературе 1917 года"],
      tags: ["XIX век", "XX век", "реализм", "Нобелевская премия"],
      relatedWriters: ["karl_gjellerup"],
      articleUrl: "",
      editorial: {
        status: "verified",
        reviewedAt: "2026-08-01",
        sources: [
          {
            title: "The Nobel Prize in Literature 1917",
            publisher: "Nobel Prize",
            url: "https://www.nobelprize.org/prizes/literature/1917/summary/"
          }
        ]
      }
    },
    {
      id: "ludvig_holberg",
      name: "Людвиг Хольберг",
      fullName: "Ludvig Holberg",
      years: "1684-1754",
      birthDate: "1684-12-03",
      deathDate: "1754-01-28",
      birthPlace: "Берген",
      coordinates: {
        lat: 55.6761,
        lng: 12.5683
      },
      portrait: "",
      bio: "Основатель датской драматургии и один из крупнейших писателей эпохи Просвещения.",
      works: [
        "Йеппе с горы"
      ],
      genres: [
        "драма",
        "комедия"
      ],
      language: "датский",
      nationality: "датчанин",
      awards: [],
      relatedWriters: [
        "adam_oehlenschlager"
      ],
      tags: [
        "XVIII век"
      ],
      articleUrl: ""
    },

    {
      id: "adam_oehlenschlager",
      name: "Адам Эленшлегер",
      fullName: "Adam Oehlenschläger",
      years: "1779-1850",
      birthDate: "1779-11-14",
      deathDate: "1850-01-20",
      birthPlace: "Копенгаген",
      coordinates: {
        lat: 55.6761,
        lng: 12.5683
      },
      portrait: "",
      bio: "Один из основателей датского романтизма.",
      works: [
        "Гакон Ярл"
      ],
      genres: [
        "поэзия",
        "драма"
      ],
      language: "датский",
      nationality: "датчанин",
      awards: [],
      relatedWriters: [
        "hans_christian_andersen"
      ],
      tags: [
        "XIX век"
      ],
      articleUrl: ""
    },

    {
      id: "hans_christian_andersen",
      name: "Ганс Христиан Андерсен",
      fullName: "Hans Christian Andersen",
      years: "1805-1875",
      birthDate: "1805-04-02",
      deathDate: "1875-08-04",
      birthPlace: "Оденсе",
      coordinates: {
        lat: 55.4038,
        lng: 10.4024
      },
      portrait: "",
      bio: "Всемирно известный датский писатель, автор литературных сказок.",
      works: [
        "Русалочка",
        "Гадкий утёнок"
      ],
      genres: [
        "сказка",
        "проза"
      ],
      language: "датский",
      nationality: "датчанин",
      awards: [],
      relatedWriters: [
        "soren_kierkegaard"
      ],
      tags: [
        "XIX век"
      ],
      articleUrl: ""
    },

    {
      id: "soren_kierkegaard",
      name: "Сёрен Кьеркегор",
      fullName: "Søren Kierkegaard",
      years: "1813-1855",
      birthDate: "1813-05-05",
      deathDate: "1855-11-11",
      birthPlace: "Копенгаген",
      coordinates: {
        lat: 55.6761,
        lng: 12.5683
      },
      portrait: "",
      bio: "Датский мыслитель и автор философско-литературной прозы.",
      works: [
        "Или - или"
      ],
      genres: [
        "эссе",
        "философская проза"
      ],
      language: "датский",
      nationality: "датчанин",
      awards: [],
      relatedWriters: [
        "martin_andersen_nexo"
      ],
      tags: [
        "XIX век"
      ],
      articleUrl: ""
    },

    {
      id: "martin_andersen_nexo",
      name: "Мартин Андерсен-Нексё",
      fullName: "Martin Andersen Nexø",
      years: "1869-1954",
      birthDate: "1869-06-26",
      deathDate: "1954-06-01",
      birthPlace: "Копенгаген",
      coordinates: {
        lat: 55.6761,
        lng: 12.5683
      },
      portrait: "",
      bio: "Крупный датский прозаик XX века.",
      works: [
        "Пелле-завоеватель"
      ],
      genres: [
        "роман"
      ],
      language: "датский",
      nationality: "датчанин",
      awards: [],
      relatedWriters: [
        "karen_blixen"
      ],
      tags: [
        "XX век"
      ],
      articleUrl: ""
    },

    {
      id: "karen_blixen",
      name: "Карен Бликсен",
      fullName: "Karen Blixen",
      years: "1885-1962",
      birthDate: "1885-04-17",
      deathDate: "1962-09-07",
      birthPlace: "Рунгстед",
      coordinates: {
        lat: 55.88,
        lng: 12.55
      },
      portrait: "",
      bio: "Выдающаяся датская писательница, автор психологической и автобиографической прозы.",
      works: [
        "Из Африки"
      ],
      genres: [
        "проза"
      ],
      language: "датский",
      nationality: "датчанка",
      awards: [],
      relatedWriters: [
        "jacob_paludan"
      ],
      tags: [
        "XX век"
      ],
      articleUrl: ""
    },

    {
      id: "jacob_paludan",
      name: "Якоб Палудан",
      fullName: "Jacob Paludan",
      years: "1896-1975",
      birthDate: "1896-02-07",
      deathDate: "1975-09-26",
      birthPlace: "Копенгаген",
      coordinates: {
        lat: 55.6761,
        lng: 12.5683
      },
      portrait: "",
      bio: "Датский писатель и романист XX века.",
      works: [
        "Жюль Верн"
      ],
      genres: [
        "роман"
      ],
      language: "датский",
      nationality: "датчанин",
      awards: [],
      relatedWriters: [
        "klaus_rifbjerg"
      ],
      tags: [
        "XX век"
      ],
      articleUrl: ""
    },

    {
      id: "klaus_rifbjerg",
      name: "Клаус Рифбьерг",
      fullName: "Klaus Rifbjerg",
      years: "1931-2015",
      birthDate: "1931-12-15",
      deathDate: "2015-04-04",
      birthPlace: "Копенгаген",
      coordinates: {
        lat: 55.6761,
        lng: 12.5683
      },
      portrait: "",
      bio: "Один из ведущих датских писателей второй половины XX века.",
      works: [
        "Дневник Анны"
      ],
      genres: [
        "роман"
      ],
      language: "датский",
      nationality: "датчанин",
      awards: [],
      relatedWriters: [
        "peter_hoeg"
      ],
      tags: [
        "XX век"
      ],
      articleUrl: ""
    },

    {
      id: "peter_hoeg",
      name: "Питер Хёг",
      fullName: "Peter Høeg",
      years: "1957-",
      birthDate: "1957-05-17",
      deathDate: "",
      birthPlace: "Копенгаген",
      coordinates: {
        lat: 55.6761,
        lng: 12.5683
      },
      portrait: "",
      bio: "Современный датский писатель, автор интеллектуальной прозы.",
      works: [
        "Смилла и её чувство снега"
      ],
      genres: [
        "роман"
      ],
      language: "датский",
      nationality: "датчанин",
      awards: [],
      relatedWriters: [
        "klaus_rifbjerg"
      ],
      tags: [
        "XX век",
        "XXI век"
      ],
      articleUrl: ""
    }
  ]
};
