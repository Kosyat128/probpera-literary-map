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
  { id:"tolstoy", name:"Лев Толстой", country:"Россия", city:"Ясная Поляна", years:"1828–1910", x:67, y:37, books:["Война и мир","Анна Каренина"], period:"realism", direction:"realism", region:"europe" },
  { id:"dostoevsky", name:"Фёдор Достоевский", country:"Россия", city:"Санкт-Петербург", years:"1821–1881", x:69, y:34, books:["Преступление и наказание","Братья Карамазовы"], period:"realism", direction:"realism", region:"europe" },
  { id:"shakespeare", name:"Уильям Шекспир", country:"Великобритания", city:"Стратфорд-апон-Эйвон", years:"1564–1616", x:50, y:39, books:["Гамлет","Ромео и Джульетта"], period:"renaissance", direction:"classic", region:"europe" },
  { id:"hemingway", name:"Эрнест Хемингуэй", country:"США", city:"Оук-Парк", years:"1899–1961", x:24, y:45, books:["Старик и море","Прощай, оружие!"], period:"modernism", direction:"modernism", region:"america" },
  { id:"murakami", name:"Харуки Мураками", country:"Япония", city:"Киото", years:"1949–", x:88, y:45, books:["Норвежский лес","Кафка на пляже"], period:"contemporary", direction:"postmodernism", region:"asia" },
  { id:"marquez", name:"Габриэль Гарсиа Маркес", country:"Колумбия", city:"Аракатака", years:"1927–2014", x:31, y:57, books:["Сто лет одиночества","Любовь во время чумы"], period:"modernism", direction:"magic_realism", region:"america", nobel:true },
  { id:"kafka", name:"Франц Кафка", country:"Чехия", city:"Прага", years:"1883–1924", x:56, y:38, books:["Процесс","Превращение"], period:"modernism", direction:"modernism", region:"europe" },
  { id:"orwell", name:"Джордж Оруэлл", country:"Великобритания", city:"Мотихари", years:"1903–1950", x:49, y:40, books:["1984","Скотный двор"], period:"modernism", direction:"dystopia", region:"europe" },
  { id:"hugo", name:"Виктор Гюго", country:"Франция", city:"Безансон", years:"1802–1885", x:52, y:43, books:["Отверженные","Собор Парижской Богоматери"], period:"romanticism", direction:"romanticism", region:"europe" },
  { id:"goethe", name:"Иоганн Вольфганг Гёте", country:"Германия", city:"Франкфурт", years:"1749–1832", x:55, y:40, books:["Фауст","Страдания юного Вертера"], period:"enlightenment", direction:"classic", region:"europe" },
  { id:"dickens", name:"Чарльз Диккенс", country:"Великобритания", city:"Портсмут", years:"1812–1870", x:50, y:38, books:["Оливер Твист","Большие надежды"], period:"realism", direction:"realism", region:"europe" },
  { id:"poe", name:"Эдгар Аллан По", country:"США", city:"Бостон", years:"1809–1849", x:26, y:40, books:["Ворон","Падение дома Ашеров"], period:"romanticism", direction:"detective", region:"america" },
  { id:"borges", name:"Хорхе Луис Борхес", country:"Аргентина", city:"Буэнос-Айрес", years:"1899–1986", x:28, y:61, books:["Вымыслы","Алеф"], period:"modernism", direction:"postmodernism", region:"america" },
  { id:"proust", name:"Марсель Пруст", country:"Франция", city:"Париж", years:"1871–1922", x:53, y:42, books:["В поисках утраченного времени"], period:"modernism", direction:"modernism", region:"europe" },
  { id:"joyce", name:"Джеймс Джойс", country:"Ирландия", city:"Дублин", years:"1882–1941", x:48, y:37, books:["Улисс","Портрет художника в юности"], period:"modernism", direction:"modernism", region:"europe" }
];
