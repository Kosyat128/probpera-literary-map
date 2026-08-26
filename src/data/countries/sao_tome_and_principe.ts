import type { Country } from "../types";

export const saoTomeAndPrincipe: Country = {
  id: "sao_tome_and_principe",
  name: "Сан-Томе и Принсипи",
  code: "st",
  capital: "Сан-Томе",
  coordinates: [0.1864, 6.6131],
  region: "Гвинейский залив",
  continent: "Африка",
  officialLanguage: "португальский",
  description:
    "Литература Сан-Томе и Принсипи формировалась на пересечении португалоязычной письменной культуры, островного фольклора и памяти о колониальных плантациях. Поэзия стала главным способом говорить о земле, достоинстве, свободе и национальной идентичности.",
  historicalNote:
    "В XX веке Франсишку Жозе Тенрейру и Алда ду Эшпириту Санту вывели поэзию архипелага в широкий круг лузофонской литературы. Их произведения связали личную лирику с историей островов и антиколониальным опытом.",
  literaryPeriods: [
    "Устная островная традиция",
    "Антиколониальная поэзия XX века",
    "Современная лузофонская литература",
  ],
  literaryMovements: ["негритюд", "антиколониальная поэзия", "островная лирика"],
  facts: [
    "Алда ду Эшпириту Санту написала текст государственного гимна страны.",
    "Франсишку Жозе Тенрейру был не только поэтом, но и географом, исследовавшим остров Сан-Томе.",
  ],
  writers: [
    {
      id: "francisco_jose_tenreiro",
      name: "Франсишку Жозе Тенрейру",
      fullName: "Francisco José Tenreiro",
      years: "1921-1963",
      birthDate: "1921-01-20",
      deathDate: "1963",
      birthPlace: "остров Сан-Томе",
      deathPlace: "Лиссабон",
      bio:
        "Поэт, эссеист и географ из Сан-Томе. В его стихах островной пейзаж соединён с темами африканской идентичности и расового достоинства. Тенрейру участвовал в формировании португалоязычной поэзии негритюда и одновременно занимался научным исследованием родного острова.",
      works: [
        "«Остров святого имени» (Ilha de Nome Santo)",
        "«Сердце в Африке» (Coração em África)",
        "«Чёрная поэзия на португальском языке» (Poesia Negra de Expressão Portuguesa)",
      ],
      genres: ["поэзия", "эссе", "научная проза"],
      language: "португальский",
      nationality: "сантомеец",
      tags: ["XX век", "негритюд", "лузофонская литература"],
      editorial: {
        status: "verified",
        reviewedAt: "2026-07-28",
        sources: [
          {
            title: "Francisco José de Vasques Tenreiro",
            publisher: "Associação Portuguesa de Geógrafos",
            url: "https://www.apgeo.pt/francisco-jose-de-vasques-tenreiro",
          },
          {
            title: "Учебные материалы по литературе Сан-Томе",
            publisher: "Министерство образования Сан-Томе и Принсипи",
            url: "https://repositoriodigital.me.gov.st/files/download?f=app%2Fpublic%2Ffiles%2FSeptember2022%2FDTYNa7Z9MD5bKZhGOe4h.pdf",
          },
        ],
      },
    },
    {
      id: "alda_do_espirito_santo",
      name: "Алда ду Эшпириту Санту",
      fullName: "Alda do Espírito Santo",
      years: "1926-2010",
      birthDate: "1926-04-30",
      deathDate: "2010-03-09",
      birthPlace: "Сан-Томе",
      deathPlace: "Луанда, Ангола",
      bio:
        "Поэтесса, педагог и общественный деятель, одна из центральных фигур литературы Сан-Томе и Принсипи. Её стихи обращены к земле, труду, колониальному насилию и свободе; после независимости она участвовала в культурной и государственной жизни страны.",
      works: [
        "«Хор островов» (O Jogral das Ilhas)",
        "«Наша священная земля» (É Nosso o Solo Sagrado da Terra)",
        "«Они убили реку моего города» (Mataram o Rio da Minha Cidade)",
      ],
      genres: ["поэзия", "публицистика"],
      language: "португальский",
      nationality: "сантомейка",
      tags: ["XX век", "антиколониальная поэзия"],
      editorial: {
        status: "reviewed",
        reviewedAt: "2026-07-28",
        sources: [
          {
            title: "Каталог изданий Алды Эшпириту Санту",
            publisher: "Camões - Instituto da Cooperação e da Língua",
            url: "https://www.instituto-camoes.pt/images/lingua_cultura/edestrangeiro_jan13.pdf",
          },
        ],
      },
    },
  ],
};
