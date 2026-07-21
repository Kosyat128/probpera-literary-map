import type { Country } from "../types";

export const france: Country = {
  id: "france",
  name: "Франция",
  code: "fr",
  writers: [
    {
      id: "victor-hugo",
      name: "Виктор Гюго",
      years: "1802–1885",
      birthPlace: "Безансон, Франция",
      coordinates: [47.2378, 6.0241],
      portrait: "",
      bio: "Французский писатель, поэт и драматург, один из крупнейших представителей французского романтизма.",
      works: ["Собор Парижской Богоматери", "Отверженные"],
    },
    {
      id: "alexandre-dumas-pere",
      name: "Александр Дюма (отец)",
      years: "1802–1870",
      birthPlace: "Вилле-Котре, Франция",
      coordinates: [49.2582, 3.0909],
      portrait: "",
      bio: "Французский писатель, автор историко-приключенческих романов и пьес.",
      works: ["Три мушкетёра", "Граф Монте-Кристо"],
    },
  ],
};
