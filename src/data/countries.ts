export interface Writer {
  name: string;
  years: string;
}

export interface CountryData {
  id: string;
  name: string;
  writers: Writer[];
}

export const countries: CountryData[] = [
  {
    id: "france",
    name: "Франция",
    writers: [
      { name: "Виктор Гюго", years: "1802–1885" },
      { name: "Александр Дюма (отец)", years: "1802–1870" },
    ],
  },
  {
    id: "russia",
    name: "Россия",
    writers: [
      { name: "Лев Толстой", years: "1828–1910" },
      { name: "Фёдор Достоевский", years: "1821–1881" },
    ],
  },
];
