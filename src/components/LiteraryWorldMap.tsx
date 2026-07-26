import { useState } from "react";
import WriterPanel from "./WriterPanel";
import GlobalWriterFilters from "./GlobalWriterFilters";
import LiteraryGlobe from "./LiteraryGlobe";
import { countries } from "../data/countries";
import type { Country, WriterProfile } from "../data/countries/types";
import type { WriterFilterState } from "../filters/filterTypes";
import WriterCard from "./WriterCard";

interface Props { onCountrySelect?: (name:string)=>void; }

export default function LiteraryWorldMap({onCountrySelect}:Props){
 const [selectedCountry,setSelectedCountry]=useState<Country|null>(null);
 const [selectedWriter,setSelectedWriter]=useState<WriterProfile|null>(null);
 const [filters,setFilters]=useState<WriterFilterState>({});

 const selectCountry=(name:string)=>{
  const country=countries.find(c=>c.name===name)||null;
  setSelectedCountry(country);
  setSelectedWriter(null);
  onCountrySelect?.(name);
 };

 const selectWriter=(writer:WriterProfile)=>{
  setSelectedWriter(writer);
  if(writer.country) selectCountry(writer.country);
 };

 return <div style={{display:'grid',gridTemplateColumns:'minmax(700px,1fr) 340px',gap:16,width:'100%',minHeight:700,alignItems:'start'}}>
   <main style={{minWidth:0}}>
    <div style={{background:'#FFF8EE',borderRadius:16,padding:10,marginBottom:12}}>
     <GlobalWriterFilters filters={filters} onChange={setFilters}/>
    </div>
    <LiteraryGlobe onCountrySelect={selectCountry}/>
    {selectedWriter&&<WriterCard writer={selectedWriter} onClose={()=>setSelectedWriter(null)}/>} 
   </main>

   {selectedCountry&&<WriterPanel country={selectedCountry} onWriterSelect={selectWriter}/>} 
  </div>;
}
