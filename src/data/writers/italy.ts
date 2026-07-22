import type { Country } from "../types";

export const italy: Country = {
  id: "italy",
  name: "Италия",
  code: "it",
  writers: [
    { id: "dante", name: "Данте Алигьери", years: "1265–1321", birthPlace: "Флоренция, Италия", coordinates: [43.7696, 11.2558], portrait: "", bio: "Итальянский поэт, автор «Божественной комедии».", works: ["Божественная комедия"] },
    { id: "boccaccio", name: "Джованни Боккаччо", years: "1313–1375", birthPlace: "Чертальдо, Италия", coordinates: [43.5472, 11.0415], portrait: "", bio: "Итальянский писатель и поэт, автор «Декамерона».", works: ["Декамерон"] },
    { id: "leopardi", name: "Джакомо Леопарди", years: "1798–1837", birthPlace: "Реканати, Италия", coordinates: [43.4063, 13.5412], portrait: "", bio: "Итальянский поэт, философ и филолог.", works: ["Песни"] },
    { id: "pirandello", name: "Луиджи Пиранделло", years: "1867–1936", birthPlace: "Агра-джентский район, Италия", coordinates: [37.3111, 13.5765], portrait: "", bio: "Итальянский драматург и прозаик, лауреат Нобелевской премии по литературе.", works: ["Шесть персонажей в поисках автора"] }
  ]
};