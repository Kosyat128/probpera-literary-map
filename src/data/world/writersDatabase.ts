export type WorldWriter={
 id:string;
 fullName:string;
 country:string;
 birth:string;
 movement:string;
 works:string[];
};

export const worldWriters:WorldWriter[]=[
 {id:'leo-tolstoy',fullName:'Лев Николаевич Толстой',country:'Россия',birth:'1828',movement:'Реализм',works:['Война и мир','Анна Каренина']},
 {id:'william-shakespeare',fullName:'Уильям Шекспир',country:'Великобритания',birth:'1564',movement:'Ренессанс',works:['Гамлет','Ромео и Джульетта']},
 {id:'victor-hugo',fullName:'Виктор Гюго',country:'Франция',birth:'1802',movement:'Романтизм',works:['Отверженные']},
 {id:'haruki-murakami',fullName:'Харуки Мураками',country:'Япония',birth:'1949',movement:'Постмодернизм',works:['Норвежский лес']},
 {id:'ernest-hemingway',fullName:'Эрнест Хемингуэй',country:'США',birth:'1899',movement:'Модернизм',works:['Старик и море']}
];
