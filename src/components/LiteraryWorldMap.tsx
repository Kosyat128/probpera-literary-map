import { useMemo, useState } from "react";
import WriterPanel from "./WriterPanel";
import GlobalWriterFilters from "./GlobalWriterFilters";
import LiteraryGlobe from "./LiteraryGlobe";
import { countries } from "../data/countries";
import type { Country, WriterProfile } from "../data/countries/types";
import type { WriterFilterState } from "../filters/filterTypes";
import { filterWriters, getAllWriters } from "../filters/writerFilters";
import WriterCard from "./WriterCard";

export default function LiteraryWorldMap() {
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [selectedWriter, setSelectedWriter] = useState<WriterProfile | null>(null);
  const [filters, setFilters] = useState<WriterFilterState>({});

  const allWriters = useMemo(() => getAllWriters(countries), []);
  const filteredWriters = useMemo(
    () => filterWriters(allWriters, filters),
    [allWriters, filters]
  );

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
      gridTemplateColumns: "260px minmax(700px, 1fr) 340px",
      gap: "16px",
      width: "100%",
      minHeight: "820px"
    }}>
      <aside style={{
        background: "#1F103D",
        borderRadius: "16px",
        padding: "14px",
        color: "white",
        height: "780px",
        overflowY: "auto"
      }}>
        <h2>🌍 Страны мира</h2>
        <input placeholder="Поиск страны..." style={{width:"100%",padding:"10px"}} />
        {countries.map(country => (
          <div key={country.id} onClick={() => selectCountry(country.name)} style={{padding:"9px",cursor:"pointer"}}>
            🌐 {country.name}
            <span style={{float:"right",color:"#E97824"}}>{country.writers.length}</span>
          </div>
        ))}
      </aside>

      <main style={{minWidth:0}}>
        <div style={{background:"#FFF8EE",borderRadius:"14px",padding:"10px",marginBottom:"12px"}}>
          <GlobalWriterFilters filters={filters} onChange={setFilters}/>
        </div>

        <LiteraryGlobe />

        {selectedWriter && (
          <WriterCard writer={selectedWriter} onClose={() => setSelectedWriter(null)} />
        )}
      </main>

      {selectedCountry && (
        <WriterPanel country={selectedCountry} onWriterSelect={selectWriter}/>
      )}
    </div>
  );
}
