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
  const [selectedWriter, setSelectedWriter] = useState<WriterProfile | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const allWriters = useMemo(() => getAllWriters(countries), []);
  const [filters, setFilters] = useState<WriterFilterState>({});

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
      gridTemplateColumns: "260px minmax(800px, 1fr) 340px",
      gap: "12px",
      minHeight: "820px",
      position: "relative"
    }}>
      <aside style={{
        background:"#1F103D",
        borderRadius:"16px",
        padding:"16px",
        color:"white",
        overflowY:"auto"
      }}>
        <h2>🌍 Страны мира</h2>
        {countries.map(country => (
          <div key={country.id}
            onClick={()=>selectCountry(country.name)}
            style={{padding:"8px",cursor:"pointer"}}>
            🌐 {country.name}
            <span style={{float:"right",color:"#E97824"}}>
              {country.writers.length}
            </span>
          </div>
        ))}
      </aside>

      <main style={{position:"relative",minWidth:0}}>
        {showFilters && (
          <div style={{position:"absolute",top:10,left:10,zIndex:10}}>
            <GlobalWriterFilters filters={filters} onChange={setFilters}/>
          </div>
        )}

        <button
          onClick={()=>setShowFilters(!showFilters)}
          style={{
            position:"absolute",
            right:15,
            bottom:15,
            zIndex:10,
            background:"#FFF8EE",
            border:"none",
            padding:"10px 16px",
            borderRadius:"10px"
          }}>
          ⚱ Фильтры
        </button>

        <div style={{
          height:"760px",
          position:"relative",
          borderRadius:"18px",
          overflow:"hidden"
        }}>
          <SvgWorldMap
            onCountrySelect={selectCountry}
            selectedCountry={selectedCountry?.id}
          />
          <WriterClusters
            writers={filteredWriters}
            onCountrySelect={selectCountry}
            selectedCountry={selectedCountry?.id}
          />
          {selectedWriter && (
            <WriterCard
              writer={selectedWriter}
              onClose={()=>setSelectedWriter(null)}
            />
          )}
        </div>
      </main>

      {selectedCountry && (
        <WriterPanel
          country={selectedCountry}
          onWriterSelect={selectWriter}
        />
      )}
    </div>
  );
}
