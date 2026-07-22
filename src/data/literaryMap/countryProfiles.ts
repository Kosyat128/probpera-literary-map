export type CountryProfile={
 id:string;
 name:string;
 description:string;
 famousGenres:string[];
 writers:number;
};

export const countryProfiles:CountryProfile[]=[
 {id:"russia",name:"Россия",description:"Литературная традиция с богатой школой романа и поэзии",famousGenres:["роман","поэзия"],writers:44}
];
