export type Writer = {
  id: string;
  name: string;
  country: string;
  city: string;
  years: string;
  x: number;
  y: number;
  books: string[];
};

export const writers: Writer[] = [
  {
    id: "tolstoy",
    name: "Лев Толстой",
    country: "Россия",
    city: "Ясная Поляна",
    years: "1828–1910",
    x: 67,
    y: 37,
    books: ["Война и мир", "Анна Каренина"]
  },
  {
    id: "dostoevsky",
    name: "Фёдор Достоевский",
    country: "Россия",
    city: "Санкт-Петербург",
    years: "1821–1881",
    x: 69,
    y: 34,
    books: ["Преступление и наказание", "Братья Карамазовы"]
  },
  {
    id: "shakespeare",
    name: "Уильям Шекспир",
    country: "Великобритания",
    city: "Стратфорд-апон-Эйвон",
    years: "1564–1616",
    x: 50,
    y: 39,
    books: ["Гамлет", "Ромео и Джульетта"]
  },
  {
    id: "hemingway",
    name: "Эрнест Хемингуэй",
    country: "США",
    city: "Оук-Парк",
    years: "1899–1961",
    x: 24,
    y: 45,
    books: ["Старик и море", "Прощай, оружие!"]
  },
  {
    id: "murakami",
    name: "Харуки Мураками",
    country: "Япония",
    city: "Киото",
    years: "1949–",
    x: 88,
    y: 45,
    books: ["Норвежский лес", "Кафка на пляже"]
  }
];
