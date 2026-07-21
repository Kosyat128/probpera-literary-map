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
      { name: "Александр Сергеевич Пушкин", years: "1799–1837" },
      { name: "Михаил Юрьевич Лермонтов", years: "1814–1841" },
      { name: "Николай Васильевич Гоголь", years: "1809–1852" },
      { name: "Иван Сергеевич Тургенев", years: "1818–1883" },
      { name: "Иван Александрович Гончаров", years: "1812–1891" },
      { name: "Николай Алексеевич Некрасов", years: "1821–1878" },
      { name: "Антон Павлович Чехов", years: "1860–1904" },
      { name: "Лев Николаевич Толстой", years: "1828–1910" },
      { name: "Фёдор Михайлович Достоевский", years: "1821–1881" },
      { name: "Иван Алексеевич Бунин", years: "1870–1953" },
    ],
  },
];
