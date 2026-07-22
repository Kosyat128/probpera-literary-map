export type CountryMapItem = {
 id:string;
 name:string;
 svgId:string;
 writersCount:number;
};

export const countryMap:CountryMapItem[]=[
 {id:"russia",name:"Россия",svgId:"RU",writersCount:44},
 {id:"france",name:"Франция",svgId:"FR",writersCount:0},
 {id:"uk",name:"Великобритания",svgId:"GB",writersCount:0},
 {id:"usa",name:"США",svgId:"US",writersCount:0},
 {id:"japan",name:"Япония",svgId:"JP",writersCount:0}
];
