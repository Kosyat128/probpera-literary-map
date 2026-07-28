import type { Country } from "../types";

export const zambia: Country = {
  id: "zambia",
  name: "Замбия",
  code: "zm",
  capital: "Лусака",
  coordinates: [-13.1339, 27.8493],
  region: "Южная Африка",
  continent: "Африка",
  officialLanguage: "английский",
  description:
    "Литература Замбии существует на английском и национальных языках, включая бемба, ньянджа и тонга. Романы и рассказы страны говорят о столкновении традиции и современности, общественном неравенстве, семейной памяти и жизни после обретения независимости.",
  historicalNote:
    "Первые крупные замбийские романы на английском языке появились во второй половине XX века. Новое поколение авторов расширило эту традицию произведениями о взрослении, женском опыте и быстро меняющемся городском обществе.",
  literaryPeriods: [
    "Устная традиция",
    "Литература независимости",
    "Современная англоязычная проза",
  ],
  literaryMovements: ["постколониальная проза", "социальный роман", "литература взросления"],
  facts: [
    "Роман Доминика Мулаишо «Язык немого» считается одним из ранних значительных произведений замбийской прозы на английском языке.",
    "Роман Эллен Банда-Ааку «Лоскутное одеяло» получил премию Penguin за африканскую литературу.",
  ],
  writers: [
    {
      id: "dominic_mulaisho",
      name: "Доминик Мулаишо",
      fullName: "Dominic Mulaisho",
      years: "1933–2013",
      birthDate: "1933-08-15",
      deathDate: "2013-07-01",
      birthPlace: "Фейра, Северная Родезия",
      deathPlace: "Лусака",
      bio:
        "Замбийский романист и государственный служащий. В художественной прозе Мулаишо исследовал конфликт между местными обычаями, христианской миссией и общественными переменами. Его книги важны как ранние попытки осмыслить независимую Замбию изнутри её культурного опыта.",
      works: [
        "«Язык немого» (The Tongue of the Dumb)",
        "«Гремящий дым» (The Smoke That Thunders)",
      ],
      genres: ["роман", "социальная проза"],
      language: "английский",
      nationality: "замбиец",
      tags: ["XX век", "постколониальная литература"],
      editorial: {
        status: "verified",
        reviewedAt: "2026-07-28",
        sources: [
          {
            title: "Исследование романа The Tongue of the Dumb",
            publisher: "University of Zambia",
            url: "https://dspace.unza.zm/bitstreams/faa21cfa-af67-4a84-bdc9-07eba42eebe7/download",
          },
        ],
      },
    },
    {
      id: "ellen_banda_aaku",
      name: "Эллен Банда-Ааку",
      fullName: "Ellen Banda-Aaku",
      years: "1965–",
      birthDate: "1965-05-06",
      birthPlace: "Уокинг, Великобритания",
      bio:
        "Замбийская писательница, автор романов, рассказов и книг для детей. Выросшая в Замбии, Банда-Ааку пишет о семейных отношениях, взрослении и положении женщины в обществе, соединяя психологическую точность с вниманием к социальной среде.",
      works: [
        "«Лоскутное одеяло» (Patchwork)",
        "«Мадам первая леди» (Madam 1st Lady)",
        "«Тихий голос Ванди» (Wandi’s Little Voice)",
      ],
      genres: ["роман", "рассказ", "детская литература"],
      language: "английский",
      nationality: "замбийка",
      awards: [
        "Премия Macmillan для африканских писателей 2004",
        "Премия Penguin за африканскую литературу 2010",
      ],
      tags: ["XXI век", "современная африканская проза"],
      editorial: {
        status: "reviewed",
        reviewedAt: "2026-07-28",
        sources: [
          {
            title: "Ellen Banda-Aaku in African writing",
            publisher: "British Council",
            url: "https://www.britishcouncil.org/east-africa-arts/projects/creative-hustle/rwanda-reads",
          },
          {
            title: "Статья о современной замбийской литературе",
            publisher: "University of Zambia",
            url: "https://journals.unza.zm/index.php/JLSS/article/download/789/656/",
          },
        ],
      },
    },
  ],
};
