import type { Writer } from "./writers";

export const additionalWriters: Writer[] = [
  {id:"virgil",name:"Вергилий",country:"Древний Рим",city:"Мантуя",years:"70–19 до н.э.",x:54,y:50,books:["Энеида"],period:"ancient",direction:"classic",region:"europe"},
  {id:"ovid",name:"Овидий",country:"Древний Рим",city:"Сульмона",years:"43 до н.э.–17 н.э.",x:54,y:50,books:["Метаморфозы"],period:"ancient",direction:"classic",region:"europe"},
  {id:"plato",name:"Платон",country:"Древняя Греция",city:"Афины",years:"428–348 до н.э.",x:57,y:51,books:["Государство","Пир"],period:"ancient",direction:"classic",region:"europe"},
  {id:"aristotle",name:"Аристотель",country:"Древняя Греция",city:"Стагира",years:"384–322 до н.э.",x:58,y:50,books:["Поэтика"],period:"ancient",direction:"classic",region:"europe"},
  {id:"rabelais",name:"Франсуа Рабле",country:"Франция",city:"Шинон",years:"1494–1553",x:52,y:43,books:["Гаргантюа и Пантагрюэль"],period:"renaissance",direction:"humanism",region:"europe"},
  {id:"shiller",name:"Фридрих Шиллер",country:"Германия",city:"Марбах",years:"1759–1805",x:55,y:40,books:["Разбойники","Вильгельм Телль"],period:"romanticism",direction:"romanticism",region:"europe"},
  {id:"anderssen",name:"Ганс Христиан Андерсен",country:"Дания",city:"Оденсе",years:"1805–1875",x:54,y:34,books:["Русалочка","Гадкий утёнок"],period:"romanticism",direction:"fairytale",region:"europe"},
  {id:"ibsen",name:"Генрик Ибсен",country:"Норвегия",city:"Шиен",years:"1828–1906",x:52,y:30,books:["Кукольный дом","Пер Гюнт"],period:"realism",direction:"realism",region:"europe"},
  {id:"strindberg",name:"Август Стриндберг",country:"Швеция",city:"Стокгольм",years:"1849–1912",x:54,y:31,books:["Красная комната"],period:"modernism",direction:"modernism",region:"europe"},
  {id:"calvino",name:"Итало Кальвино",country:"Италия",city:"Сан-Ремо",years:"1923–1985",x:54,y:48,books:["Невидимые города","Если однажды зимней ночью путник"],period:"contemporary",direction:"postmodernism",region:"europe"}
];
