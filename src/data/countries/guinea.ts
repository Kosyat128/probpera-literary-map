import type { Country } from "../types";

export const guineaBissau: Country = {
  id: "guinea_bissau",
  name: "Гвинея-Бисау",
  code: "gw",

  writers: [
    {
      id: "abdulai_sila",
      name: "Абдулай Сила",
      fullName: "Abdulai Silá",
      years: "1958-",
      birthDate: "1958",
      deathDate: "",
      birthPlace: "Бисау, Гвинея-Бисау",
      portrait: "",
      bio: "Первый романист Гвинеи-Бисау, один из главных представителей современной литературы страны.",
      works: ["Eterna Paixão", "A Última Tragédia"],
      genres: ["роман", "проза"],
      language: "португальский",
      nationality: "гвинеец-бисаусец",
      awards: [],
      tags: ["XX век", "XXI век"],
      articleUrl: ""
    },
    {
      id: "odete_semedo",
      name: "Одети Семеду",
      fullName: "Odete Semedo",
      years: "1959-",
      birthDate: "1959",
      deathDate: "",
      birthPlace: "Бисау, Гвинея-Бисау",
      portrait: "",
      bio: "Гвинейско-бисауская поэтесса, писательница и исследовательница культуры.",
      works: ["No Fundo do Canto"],
      genres: ["поэзия", "проза"],
      language: "португальский",
      nationality: "гвинейка-бисауска",
      awards: [],
      tags: ["XX век", "XXI век"],
      articleUrl: ""
    },
    {
      id: "antonio_aurelio_gomes",
      name: "Антониу Аурелиу Гомеш",
      fullName: "António Aurélio Gomes",
      years: "1960-",
      birthDate: "1960",
      deathDate: "",
      birthPlace: "Гвинея-Бисау",
      portrait: "",
      bio: "Современный писатель и поэт Гвинеи-Бисау.",
      works: [],
      genres: ["поэзия", "проза"],
      language: "португальский",
      nationality: "гвинеец-бисаусец",
      awards: [],
      tags: ["XXI век"],
      articleUrl: ""
    }
  ]
};

// Backward compatibility with countries/index.ts
export const guinea = guineaBissau;
