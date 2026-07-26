import { useMemo, useState } from "react";
import SvgWorldMap from "./SvgWorldMap";
import WriterPanel from "./WriterPanel";
import GlobalWriterFilters from "./GlobalWriterFilters";
import WriterClusters from "./WriterClusters";
import { countries } from "../data/countries";
import type { Country, WriterProfile } from "../data/countries/types";
import type { WriterFilterState } from "../filters/filterTypes";
import { filterWriters, getAllWriters } from "../filters/writerFilters";
import WriterCard from "./WriterCard";

export default function LiteraryWorldMap() {
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const allWriters = useMemo(() => getAllWriters(countries), []);
  const [selectedWriter, setSelectedWriter] = useState<WriterProfile | null>(allWriters[0] ?? null);
  const [filters, setFilters] = useState<WriterFilterState>({});

  const filteredWriters = useMemo(() => filterWriters(allWriters, filters), [allWriters, filters]);

  const selectCountry = (name: string) => {
    setSelectedCountry(countries.find((item) => item.name === name) || null);
  };

  const selectWriter = (writer: WriterProfile) => {
    setSelectedWriter(writer);
    if (writer.country) selectCountry(writer.country);
  };

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "260px minmax(0,1fr) 360px",
      gap: "14px",
      minHeight: "900px",
      position: "relative"
    }}>
      <aside style={{background:"#1F103D",borderRadius:"18px",padding:"18px",color:"white"}}>
        <h2>🌍 Страны мира</h2>
        {countries.slice(0,20).map(country => (
          <div key={country.id} onClick={()=>selectCountry(country.name)} style={{padding:"10px",cursor:"pointer"}}>
            🌐 {country.name} <span style={{float:"right",color:"#E97824"}}>{country.writers.length}</span>
          </div>
        ))}
      </aside>

      <main style={{position:"relative",minWidth:0}}>
        <GlobalWriterFilters filters={filters} onChange={setFilters}/>
        <div style={{margin:"10px 0",fontWeight:"bold",color:"#35205F"}}>
          Найдено авторов: {filteredWriters.length}
        </div>
        <div style={{position:"relative",height:"700px"}}>
          <SvgWorldMap onCountrySelect={selectCountry} selectedCountry={selectedCountry?.id}/>
          <WriterClusters writers={filteredWriters} onCountrySelect={selectCountry} selectedCountry={selectedCountry?.id}/>
          {selectedWriter && <WriterCard writer={selectedWriter} onClose={()=>setSelectedWriter(null)}/>} 
        </div>
      </main>

      {selectedCountry && <WriterPanel country={selectedCountry} onWriterSelect={selectWriter}/>} 
    </div>
  );
}
