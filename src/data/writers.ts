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
{id:"tolstoy",name:"Лев Николаевич Толстой",country:"Россия",city:"Ясная Поляна",years:"1828–1910",x:67,y:37,books:["Война и мир","Анна Каренина"],period:"realism",direction:"realism",region:"europe"},
{id:"dostoevsky",name:"Фёдор Михайлович Достоевский",country:"Россия",city:"Санкт-Петербург",years:"1821–1881",x:69,y:34,books:["Преступление и наказание","Братья Карамазовы","Идиот"],period:"realism",direction:"realism",region:"europe"},
{id:"chekhov",name:"Антон Павлович Чехов",country:"Россия",city:"Таганрог",years:"1860–1904",x:68,y:38,books:["Вишнёвый сад","Три сестры","Палата №6"],period:"realism",direction:"realism",region:"europe"},
{id:"pushkin",name:"Александр Сергеевич Пушкин",country:"Россия",city:"Москва",years:"1799–1837",x:68,y:36,books:["Евгений Онегин","Капитанская дочка"],period:"romanticism",direction:"romanticism",region:"europe"},
{id:"lermontov",name:"Михаил Юрьевич Лермонтов",country:"Россия",city:"Москва",years:"1814–1841",x:68,y:36,books:["Герой нашего времени","Мцыри"],period:"romanticism",direction:"romanticism",region:"europe"},
{id:"gogol",name:"Николай Васильевич Гоголь",country:"Россия",city:"Великие Сорочинцы",years:"1809–1852",x:67,y:38,books:["Мёртвые души","Ревизор"],period:"realism",direction:"realism",region:"europe"},
{id:"turgenev",name:"Иван Сергеевич Тургенев",country:"Россия",city:"Спасское-Лутовиново",years:"1818–1883",x:67,y:39,books:["Отцы и дети","Дворянское гнездо"],period:"realism",direction:"realism",region:"europe"},
{id:"bulgakov",name:"Михаил Афанасьевич Булгаков",country:"Россия",city:"Москва",years:"1891–1940",x:68,y:36,books:["Мастер и Маргарита","Собачье сердце"],period:"modernism",direction:"modernism",region:"europe"},
{id:"pasternak",name:"Борис Леонидович Пастернак",country:"Россия",city:"Москва",years:"1890–1960",x:68,y:36,books:["Доктор Живаго"],period:"modernism",direction:"modernism",region:"europe",nobel:true},
{id:"solzhenitsyn",name:"Александр Исаевич Солженицын",country:"Россия",city:"Кисловодск",years:"1918–2008",x:70,y:43,books:["Архипелаг ГУЛАГ","Один день Ивана Денисовича"],period:"contemporary",direction:"realism",region:"europe",nobel:true},
{id:"nabokov_ru",name:"Владимир Владимирович Набоков",country:"Россия",city:"Санкт-Петербург",years:"1899–1977",x:69,y:34,books:["Дар","Защита Лужина"],period:"modernism",direction:"modernism",region:"europe"},
{id:"gorky",name:"Максим Горький",country:"Россия",city:"Нижний Новгород",years:"1868–1936",x:68,y:40,books:["Мать","На дне"],period:"realism",direction:"realism",region:"europe"},
{id:"leskov",name:"Николай Лесков",country:"Россия",city:"Орел",years:"1831–1895",x:67,y:38,books:["Левша","Очарованный странник"],period:"realism",direction:"realism",region:"europe"},
{id:"kuprin",name:"Александр Куприн",country:"Россия",city:"Наровчат",years:"1870–1938",x:67,y:39,books:["Гранатовый браслет","Олеся"],period:"realism",direction:"realism",region:"europe"},
{id:"zoshchenko",name:"Михаил Зощенко",country:"Россия",city:"Полтава",years:"1894–1958",x:68,y:38,books:["Голубая книга","Рассказы"],period:"modernism",direction:"satire",region:"europe"}
];