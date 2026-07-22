import type { Country } from "../types";

export const usa: Country = {
  id: "usa",
  name: "США",
  code: "us",
  writers: [
    { id:"twain", name:"Марк Твен", years:"1835–1910", birthPlace:"Флорида, Миссури", coordinates:[39.4923,-91.8032], portrait:"", bio:"Американский писатель и юморист.", works:["Приключения Тома Сойера","Приключения Гекльберри Финна"]},
    { id:"poe", name:"Эдгар Аллан По", years:"1809–1849", birthPlace:"Бостон", coordinates:[42.3601,-71.0589], portrait:"", bio:"Поэт и мастер готической прозы.", works:["Ворон","Убийство на улице Морг"]},
    { id:"hemingway", name:"Эрнест Хемингуэй", years:"1899–1961", birthPlace:"Оук-Парк", coordinates:[41.8850,-87.7845], portrait:"", bio:"Лауреат Нобелевской премии по литературе.", works:["Старик и море","Прощай, оружие!"]},
    { id:"fitzgerald", name:"Фрэнсис Скотт Фицджеральд", years:"1896–1940", birthPlace:"Сент-Пол", coordinates:[44.9537,-93.0900], portrait:"", bio:"Классик американской литературы XX века.", works:["Великий Гэтсби","Ночь нежна"]}
  ]
};