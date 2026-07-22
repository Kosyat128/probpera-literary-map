import { useState } from "react";

import Sidebar from "./components/Sidebar";
import SvgWorldMap from "./components/SvgWorldMap";
import WriterPanel from "./components/WriterPanel";
import Timeline from "./components/Timeline";
import LiteraryPlaces from "./components/LiteraryPlaces";

import { countries } from "./data/countries";
import type { Country } from "./data/types";

export default function App(){

 const [selectedCountry,setSelectedCountry]=useState<Country | null>(countries[0] ?? null);

 if(!selectedCountry){
  return <div>База стран не загружена</div>;
 }

 const handleCountrySelect=(name:string)=>{
  const country=countries.find(item=>item.name===name);
  if(country) setSelectedCountry(country);
 };

 return (
  <div style={{
   minHeight:"100vh",
   background:"#F7EBDD",
   color:"#35205F",
   fontFamily:"Georgia, serif",
   display:"flex",
   flexDirection:"column"
  }}>

   <div style={{
    height:"72px",
    background:"#1F103D",
    color:"white",
    display:"flex",
    alignItems:"center",
    padding:"0 28px",
    fontSize:"28px",
    fontWeight:"bold"
   }}>
    LiteraryMap
    <span style={{marginLeft:"20px",color:"#E97824",fontSize:"18px"}}>
     Литературная карта мира
    </span>
   </div>

   <div style={{
    display:"grid",
    gridTemplateColumns:"260px minmax(600px,1fr) 380px",
    gap:"14px",
    padding:"14px"
   }}>

    <Sidebar
     items={countries.map(country=>country.name)}
     selectedItem={selectedCountry.name}
     onSelect={handleCountrySelect}
    />

    <main style={{display:"flex",flexDirection:"column",gap:"18px"}}>

     <SvgWorldMap
      selectedCountry={selectedCountry.name}
      onCountrySelect={handleCountrySelect}
     />

     <Timeline
      name={selectedCountry.writers[0]?.name}
      years={selectedCountry.writers[0]?.years}
     />

     <section style={{
      background:"#FFF8EE",
      border:"1px solid #E5C9A8",
      borderRadius:"18px",
      padding:"18px"
     }}>
      <LiteraryPlaces />
     </section>

    </main>

    <WriterPanel country={selectedCountry}/>

   </div>

  </div>
 );
}
