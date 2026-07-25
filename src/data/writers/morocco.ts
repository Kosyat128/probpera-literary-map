import type { Country } from "../types";

export const morocco: Country = {
  id: "morocco",
  name: "Марокко",
  code: "ma",
  writers: [
    {
      id: "ahmed_sefrioui",
      name: "Ахмед Сефриуи",
      fullName: "Ahmed Sefrioui",
      years: "1915–2004",
      birth: "1915",
      death: "2004-02-25",
      birthPlace: "Фес",
      coordinates: { lat: 34.03, lng: -5.00 },
      portrait: "",
      bio: "Один из основателей современного марокканского романа на французском языке.",
      works: ["Книга очарования"],
      language: "французский",
      genres: ["роман", "проза"]
    },
    {
      id: "driss_chraibi",
      name: "Дрис Шрайби",
      fullName: "Driss Chraïbi",
      years: "1926–2007",
      birth: "1926-07-15",
      death: "2007-04-01",
      birthPlace: "Эль-Джадида",
      coordinates: { lat: 33.23, lng: -8.50 },
      portrait: "",
      bio: "Крупный марокканский франкоязычный писатель XX века.",
      works: ["Прошлое простое"],
      language: "французский",
      genres: ["роман"]
    },
    {
      id: "tahar_ben_jelloun",
      name: "Тахар Бен Джеллун",
      fullName: "Tahar Ben Jelloun",
      years: "1944–",
      birth: "1944-12-01",
      birthPlace: "Фес",
      coordinates: { lat: 34.03, lng: -5.00 },
      portrait: "",
      bio: "Современный марокканский писатель, пишущий на французском языке.",
      works: ["Священная ночь"],
      language: "французский",
      genres: ["роман"]
    },
    {
      id: "mohamed_choukri",
      name: "Мохаммед Шукри",
      fullName: "Mohamed Choukri",
      years: "1935–2003",
      birth: "1935-07-15",
      death: "2003-11-15",
      birthPlace: "Бени-Шикер",
      coordinates: { lat: 35.17, lng: -2.93 },
      portrait: "",
      bio: "Марокканский писатель, известный автобиографической прозой.",
      works: ["Хлеб насущный"],
      language: "арабский",
      genres: ["автобиография"]
    },
    {
      id: "fatima_mernissi",
      name: "Фатима Мернисси",
      fullName: "Fatima Mernissi",
      years: "1940–2015",
      birth: "1940-09-27",
      death: "2015-11-30",
      birthPlace: "Фес",
      coordinates: { lat: 34.03, lng: -5.00 },
      portrait: "",
      bio: "Марокканская писательница и эссеистка.",
      works: ["Сны о запретном"],
      language: "арабский",
      genres: ["эссе"]
    }
  ]
};
