export type CountryLiterary={
 id:string;
 name:string;
 continent:string;
 language:string[];
};

export const countriesFullList:CountryLiterary[]=[
 {id:'russia',name:'Россия',continent:'Европа/Азия',language:['русский']},
 {id:'france',name:'Франция',continent:'Европа',language:['французский']},
 {id:'uk',name:'Великобритания',continent:'Европа',language:['английский']},
 {id:'germany',name:'Германия',continent:'Европа',language:['немецкий']},
 {id:'italy',name:'Италия',continent:'Европа',language:['итальянский']},
 {id:'spain',name:'Испания',continent:'Европа',language:['испанский']},
 {id:'portugal',name:'Португалия',continent:'Европа',language:['португальский']},
 {id:'poland',name:'Польша',continent:'Европа',language:['польский']},
 {id:'czech',name:'Чехия',continent:'Европа',language:['чешский']},
 {id:'greece',name:'Греция',continent:'Европа',language:['греческий']},
 {id:'norway',name:'Норвегия',continent:'Европа',language:['норвежский']},
 {id:'sweden',name:'Швеция',continent:'Европа',language:['шведский']},
 {id:'finland',name:'Финляндия',continent:'Европа',language:['финский','шведский']},
 {id:'ireland',name:'Ирландия',continent:'Европа',language:['английский','ирландский']},
 {id:'japan',name:'Япония',continent:'Азия',language:['японский']},
 {id:'china',name:'Китай',continent:'Азия',language:['китайский']},
 {id:'india',name:'Индия',continent:'Азия',language:['хинди','английский']},
 {id:'turkey',name:'Турция',continent:'Азия/Европа',language:['турецкий']},
 {id:'iran',name:'Иран',continent:'Азия',language:['персидский']},
 {id:'south-korea',name:'Южная Корея',continent:'Азия',language:['корейский']},
 {id:'usa',name:'США',continent:'Америка',language:['английский']},
 {id:'canada',name:'Канада',continent:'Америка',language:['английский','французский']},
 {id:'mexico',name:'Мексика',continent:'Америка',language:['испанский']},
 {id:'brazil',name:'Бразилия',continent:'Америка',language:['португальский']},
 {id:'argentina',name:'Аргентина',continent:'Америка',language:['испанский']},
 {id:'egypt',name:'Египет',continent:'Африка',language:['арабский']},
 {id:'nigeria',name:'Нигерия',continent:'Африка',language:['английский']},
 {id:'south-africa',name:'ЮАР',continent:'Африка',language:['английский','африкаанс']},
 {id:'australia',name:'Австралия',continent:'Океания',language:['английский']},
 {id:'new-zealand',name:'Новая Зеландия',continent:'Океания',language:['английский','маори']}
];
