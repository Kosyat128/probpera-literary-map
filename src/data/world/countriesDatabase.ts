export type WorldCountry={
 id:string;
 name:string;
 continent:string;
 writersCount:number;
};

export const worldCountries:WorldCountry[]=[
 {id:'russia',name:'Россия',continent:'Европа/Азия',writersCount:44},
 {id:'france',name:'Франция',continent:'Европа',writersCount:50},
 {id:'uk',name:'Великобритания',continent:'Европа',writersCount:50},
 {id:'usa',name:'США',continent:'Америка',writersCount:50},
 {id:'japan',name:'Япония',continent:'Азия',writersCount:40},
 {id:'germany',name:'Германия',continent:'Европа',writersCount:40},
 {id:'italy',name:'Италия',continent:'Европа',writersCount:40},
 {id:'spain',name:'Испания',continent:'Европа',writersCount:40},
 {id:'brazil',name:'Бразилия',continent:'Южная Америка',writersCount:30},
 {id:'australia',name:'Австралия',continent:'Океания',writersCount:20}
];
