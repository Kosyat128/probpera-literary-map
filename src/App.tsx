import { useState } from "react";

import Sidebar from "./components/Sidebar";
import LiteraryWorldMap from "./components/LiteraryWorldMap";
import WriterProfile from "./components/WriterProfile";
import Timeline from "./components/Timeline";
import LiteraryPlaces from "./components/LiteraryPlaces";

import { countries } from "./data/countries";
import type { Country, Writer } from "./data/countries";

export default function App() {
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(countries[0] ?? null);
  const [selectedWriter, setSelectedWriter] = useState<Writer | null>(null);

  if (!selectedCountry) return <div>База стран не загружена</div>;

  const handleCountrySelect = (name: string) => {
    const country = countries.find((item) => item.name === name);
    if (country) {
      setSelectedCountry(country);
      setSelectedWriter(null);
    }
  };

  const handleWriterSelect = (writer: Writer | null) => {
    setSelectedWriter(writer);
    if (writer) {
      const matchedCountry = countries.find((country) =>
        country.writers.some((countryWriter) =>
          countryWriter.id === writer.id ||
          countryWriter.name === writer.name ||
          countryWriter.fullName === writer.fullName
        )
      );
      if (matchedCountry) setSelectedCountry(matchedCountry);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F7EBDD", color: "#35205F", fontFamily: "Georgia, serif" }}>
      <div style={{height:"72px",background:"#1F103D",color:"white",display:"flex",alignItems:"center",padding:"0 28px",fontSize:"28px",fontWeight:"bold"}}>
        LiteraryMap
        <span style={{marginLeft:"20px",color:"#E97824",fontSize:"18px"}}>Литературная карта мира</span>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"260px minmax(700px,1fr) 340px",gap:"14px",padding:"14px"}}>
        <Sidebar items={countries.map((country)=>country.name)} selectedItem={selectedCountry.name} onSelect={handleCountrySelect}/>

        <main style={{display:"flex",flexDirection:"column",gap:"18px"}}>
          <LiteraryWorldMap onCountrySelect={handleCountrySelect}/>
          <Timeline name={selectedCountry.writers[0]?.name} years={selectedCountry.writers[0]?.years}/>
          <LiteraryPlaces/>
        </main>

        <aside style={{background:"#FFF8EE",borderRadius:"18px",padding:"14px",overflowY:"auto"}}>
          <h2>{selectedCountry.name}</h2>
          {selectedCountry.writers.slice(0,5).map((writer)=> (
            <button key={writer.id || writer.name} onClick={()=>handleWriterSelect(writer)} style={{display:"block",width:"100%",marginBottom:"8px"}}>
              {writer.fullName || writer.name}
            </button>
          ))}
          {selectedWriter && <WriterProfile writer={selectedWriter}/>} 
        </aside>
      </div>
    </div>
  );
}
