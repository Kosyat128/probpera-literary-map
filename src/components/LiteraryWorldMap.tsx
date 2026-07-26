import { useState } from "react";
import WriterPanel from "./WriterPanel";
import GlobalWriterFilters from "./GlobalWriterFilters";
import LiteraryGlobe from "./LiteraryGlobe";
import { countries } from "../data/countries";
import type { Country, WriterProfile } from "../data/countries/types";
import type { WriterFilterState } from "../filters/filterTypes";
import WriterCard from "./WriterCard";

interface Props { onCountrySelect?: (name: string) => void; }

export default function LiteraryWorldMap({onCountrySelect}: Props){
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

 return <div style={{display:"grid",gridTemplateColumns:"280px minmax(650px,1fr) 360px",gap:20,width:"100%",minHeight:820,alignItems:"stretch"}}>
  <aside style={{background:"#1F103D",borderRadius:18,padding:18,color:"white",height:760,overflow:"auto"}}>
   <h2>🌍 Страны мира</h2>
   <input placeholder="Поиск страны..." style={{width:"100%",padding:12,borderRadius:8,border:0}}/>
   {countries.map(c=><div key={c.id} onClick={()=>selectCountry(c.name)} style={{padding:"10px 8px",cursor:"pointer",display:"flex",justifyContent:"space-between"}}><span>🌐 {c.name}</span><span style={{color:"#E97824"}}>{c.writers.length}</span></div>)}
  </aside>
  <main style={{minWidth:0}}>
   <div style={{background:"#FFF8EE",borderRadius:16,padding:12,marginBottom:14}}><GlobalWriterFilters filters={filters} onChange={setFilters}/></div>
   <LiteraryGlobe onCountrySelect={selectCountry}/>
   {selectedWriter&&<WriterCard writer={selectedWriter} onClose={()=>setSelectedWriter(null)}/>} 
  </main>
  {selectedCountry&&<WriterPanel country={selectedCountry} onWriterSelect={selectWriter}/>} 
 </div>;
}
