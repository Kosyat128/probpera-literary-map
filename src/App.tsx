import { useState } from "react";

import Sidebar from "./components/Sidebar";
import SvgWorldMap from "./components/SvgWorldMap";
import WriterPanel from "./components/WriterPanel";
import WriterProfile from "./components/WriterProfile";
import Timeline from "./components/Timeline";
import LiteraryPlaces from "./components/LiteraryPlaces";

import { countries } from "./data/countries";
import type { Country, Writer } from "./data/types";

export default function App(){
 const [selectedCountry,setSelectedCountry]=useState<Country | null>(countries[0] ?? null);
 const [selectedWriter,setSelectedWriter]=useState<Writer | null>(null);

 if(!selectedCountry) return <div>База стран не загружена</div>;

 const handleCountrySelect=(name:string)=>{
  const country=countries.find(item=>item.name===name);
  if(country){
   setSelectedCountry(country);
   setSelectedWriter(null);
  }
 };

 return <div style={{minHeight:"100vh",background:"#F7EBDD",color:"#35205F",fontFamily:"Georgia, serif"}}>
  <div style={{height:"72px",background:"#1F103D",color:"white",display:"flex",alignItems:"center",padding:"0 28px",fontSize:"28px",fontWeight:"bold"}}>
   LiteraryMap <span style={{marginLeft:"20px",color:"#E97824",fontSize:"18px"}}>Литературная карта мира</span>
  </div>

  <div style={{display:"grid",gridTemplateColumns:"260px minmax(600px,1fr) 380px",gap:"14px",padding:"14px"}}>
   <Sidebar items={countries.map(country=>country.name)} selectedItem={selectedCountry.name} onSelect={handleCountrySelect}/>

   <main style={{display:"flex",flexDirection:"column",gap:"18px"}}>
    <SvgWorldMap selectedCountry={selectedCountry.name} onCountrySelect={handleCountrySelect}/>

    {selectedWriter ? <WriterProfile writer={selectedWriter}/> : <>
      <Timeline name={selectedCountry.writers[0]?.name} years={selectedCountry.writers[0]?.years}/>
      <LiteraryPlaces />
    </>}
   </main>

   <WriterPanel country={selectedCountry} onWriterSelect={setSelectedWriter}/>
  </div>
 </div>;
}
