import type { Writer } from "./writers";

export const womenWriters: Writer[] = [
{id:"austen",name:"Джейн Остин",country:"Великобритания",city:"Стивентон",years:"1775-1817",x:50,y:38,books:["Гордость и предубеждение","Разум и чувства"],period:"realism",direction:"classic",region:"europe"},
{id:"bronte",name:"Шарлотта Бронте",country:"Великобритания",city:"Торнтон",years:"1816-1855",x:50,y:39,books:["Джейн Эйр"],period:"romanticism",direction:"romanticism",region:"europe"},
{id:"woolf",name:"Вирджиния Вулф",country:"Великобритания",city:"Лондон",years:"1882-1941",x:50,y:39,books:["Миссис Дэллоуэй","На маяк"],period:"modernism",direction:"modernism",region:"europe"},
{id:"mitsuyo",name:"Ёко Огава",country:"Япония",city:"Окаяма",years:"1962-",x:88,y:45,books:["Профессор и его любимое уравнение"],period:"contemporary",direction:"modernism",region:"asia"},
{id:"lessing",name:"Дорис Лессинг",country:"Великобритания",city:"Керманшах",years:"1919-2013",x:50,y:39,books:["Золотая тетрадь"],period:"modernism",direction:"modernism",region:"europe",nobel:true},
{id:"toni_morrison",name:"Тони Моррисон",country:"США",city:"Лорейн",years:"1931-2019",x:25,y:42,books:["Возлюбленная"],period:"contemporary",direction:"realism",region:"america",nobel:true}
];
