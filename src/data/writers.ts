export type Writer = {
  id: string;
  name: string;
  country: string;
  city: string;
  years: string;
  x: number;
  y: number;
  books: string[];
  period?: string;
  direction?: string;
  region?: string;
  nobel?: boolean;
  photo?: string;
  article?: string;
};

export const writers: Writer[] = [
  { id:"tolstoy", name:"Лев Николаевич Толстой", country:"Россия", city:"Ясная Поляна", years:"1828–1910", x:67, y:37, books:["Война и мир","Анна Каренина"], period:"realism", direction:"realism", region:"europe" },
  { id:"dostoevsky", name:"Фёдор Михайлович Достоевский", country:"Россия", city:"Санкт-Петербург", years:"1821–1881", x:69, y:34, books:["Преступление и наказание","Братья Карамазовы"], period:"realism", direction:"realism", region:"europe" },
  { id:"chekhov", name:"Антон Павлович Чехов", country:"Россия", city:"Таганрог", years:"1860–1904", x:68, y:38, books:["Вишнёвый сад","Три сестры"], period:"realism", direction:"realism", region:"europe" },
  { id:"turgenev", name:"Иван Сергеевич Тургенев", country:"Россия", city:"Спасское-Лутовиново", years:"1818–1883", x:67, y:39, books:["Отцы и дети","Дворянское гнездо"], period:"realism", direction:"realism", region:"europe" },
  { id:"shakespeare", name:"Уильям Шекспир", country:"Великобритания", city:"Стратфорд-апон-Эйвон", years:"1564–1616", x:50, y:39, books:["Гамлет","Ромео и Джульетта"], period:"renaissance", direction:"classic", region:"europe" },
  { id:"hemingway", name:"Эрнест Хемингуэй", country:"США", city:"Оук-Парк", years:"1899–1961", x:24, y:45, books:["Старик и море","Прощай, оружие!"], period:"modernism", direction:"modernism", region:"america" },
  { id:"murakami", name:"Харуки Мураками", country:"Япония", city:"Киото", years:"1949–", x:88, y:45, books:["Норвежский лес","Кафка на пляже"], period:"contemporary", direction:"postmodernism", region:"asia" },
  { id:"marquez", name:"Габриэль Гарсиа Маркес", country:"Колумбия", city:"Аракатака", years:"1927–2014", x:31, y:57, books:["Сто лет одиночества","Любовь во время чумы"], period:"modernism", direction:"magic_realism", region:"america", nobel:true }
];
