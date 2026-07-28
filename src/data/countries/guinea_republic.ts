import type { Country } from "../types";

export const guineaRepublic: Country = {
  id: "guinea_republic",
  name: "Гвинея",
  code: "gn",
  capital: "Конакри",
  coordinates: [9.9456, -9.6966],
  region: "Западная Африка",
  continent: "Африка",
  officialLanguage: "французский",
  description:
    "Литература Гвинеи соединяет письменную франкоязычную прозу с живой традицией народов манинка, фульбе и сусу. В центре многих произведений — память о детстве, устное наследие, опыт колониального времени, изгнание и поиск культурной опоры.",
  historicalNote:
    "Международную известность гвинейской прозе принёс Камара Лайе. Во второй половине XX века тему родины, утраты и странствия продолжили Тьерно Моненембо и другие авторы гвинейской диаспоры.",
  literaryPeriods: [
    "Устная традиция",
    "Антиколониальная литература XX века",
    "Современная франкоязычная проза",
  ],
  literaryMovements: [
    "франкоязычная литература Африки",
    "автобиографическая проза",
    "литература изгнания",
  ],
  facts: [
    "Роман Камары Лайе «Чёрный ребёнок» стал одним из наиболее известных автобиографических текстов франкоязычной Африки.",
    "Тьерно Моненембо получил премию Ренодо за роман «Король Кахеля» и Большую премию Франкофонии Французской академии.",
  ],
  writers: [
    {
      id: "camara_laye",
      name: "Камара Лайе",
      fullName: "Camara Laye",
      years: "1928–1980",
      birthDate: "1928-01-01",
      deathDate: "1980-02-04",
      birthPlace: "Куруса, Французская Гвинея",
      deathPlace: "Дакар, Сенегал",
      bio:
        "Гвинейский романист, один из основоположников франкоязычной литературы Западной Африки. В автобиографической прозе Лайе бережно сохранил устройство традиционной жизни народа манинка, а в более поздних книгах писал об изгнании, политическом насилии и разрыве между родиной и чужбиной.",
      works: [
        "«Чёрный ребёнок» (L’Enfant noir)",
        "«Взгляд короля» (Le Regard du roi)",
        "«Мечта об Африке» (Dramouss)",
        "«Хранитель слова» (Le Maître de la parole)",
      ],
      genres: ["роман", "автобиографическая проза"],
      language: "французский",
      nationality: "гвинеец",
      tags: ["XX век", "франкоязычная литература Африки"],
      editorial: {
        status: "verified",
        reviewedAt: "2026-07-28",
        sources: [
          {
            title: "Camara Laye",
            publisher: "Encyclopaedia Britannica",
            url: "https://www.britannica.com/biography/Camara-Laye",
          },
          {
            title: "Laye, Camara",
            publisher: "Treccani",
            url: "https://www.treccani.it/enciclopedia/camara-laye/",
          },
        ],
      },
    },
    {
      id: "tierno_monenembo",
      name: "Тьерно Моненембо",
      fullName: "Tierno Monénembo",
      years: "1947–",
      birthDate: "1947",
      birthPlace: "Поредака, Гвинея",
      bio:
        "Гвинейский писатель, чья проза исследует изгнание, историческую память и движение человека между культурами. Покинув Гвинею в конце 1960-х годов, он жил в разных странах Африки и Европы; этот опыт странствия стал одной из ключевых тем его романов.",
      works: [
        "«Старший сирота» (L’Aîné des orphelins)",
        "«Король Кахеля» (Le Roi de Kahel)",
        "«Кубинские петухи поют в полночь» (Les Coqs cubains chantent à minuit)",
      ],
      genres: ["роман", "историческая проза"],
      language: "французский",
      nationality: "гвинеец",
      awards: [
        "Премия Ренодо 2008",
        "Большая премия Франкофонии Французской академии 2017",
      ],
      tags: ["XX век", "XXI век", "литература изгнания"],
      editorial: {
        status: "verified",
        reviewedAt: "2026-07-28",
        sources: [
          {
            title: "Tierno Monénembo",
            publisher: "Académie française",
            url: "https://www.academie-francaise.fr/tierno-monenembo",
          },
          {
            title: "Discours sur les prix littéraires 2017",
            publisher: "Académie française",
            url: "https://www.academie-francaise.fr/discours-sur-les-prix-litteraires-2017",
          },
        ],
      },
    },
  ],
};
