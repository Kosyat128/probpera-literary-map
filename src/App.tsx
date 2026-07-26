import { useState } from "react";

import Sidebar from "./components/Sidebar";
import LiteraryWorldMap from "./components/LiteraryWorldMap";
import WriterPanel from "./components/WriterPanel";
import Timeline from "./components/Timeline";
import LiteraryPlaces from "./components/LiteraryPlaces";
import QuoteOfDay from "./components/QuoteOfDay";
import LiteraryCalendar from "./components/LiteraryCalendar";

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
      setSelectedWriter(country.writers?.[0] ?? null);
    }
  };

  const handleWriterSelect = (writer: Writer) => setSelectedWriter(writer);

  return (
    <div style={{ minHeight: "100vh", background: "#F7EBDD", color: "#35205F", fontFamily: "Georgia, serif" }}>
      <header style={{height:"72px",background:"#1F103D",color:"white",display:"flex",alignItems:"center",padding:"0 28px",fontSize:"28px",fontWeight:"bold"}}>
        LiteraryMap
        <span style={{marginLeft:"20px",color:"#E97824",fontSize:"18px"}}>Литературная карта мира</span>
      </header>

      <div style={{display:"grid",gridTemplateColumns:"260px minmax(700px,1fr) 340px",gap:"14px",padding:"14px"}}>
        <Sidebar items={countries.map((country)=>country.name)} selectedItem={selectedCountry.name} onSelect={handleCountrySelect}/>
        <main style={{display:"flex",flexDirection:"column",gap:"18px"}}>
          <LiteraryWorldMap onCountrySelect={handleCountrySelect}/>
          <Timeline name={selectedWriter?.name || selectedWriter?.fullName || selectedCountry.writers[0]?.name} years={selectedWriter?.years || selectedCountry.writers[0]?.years}/>
          <LiteraryPlaces/>
        </main>
        <WriterPanel country={selectedCountry} onWriterSelect={handleWriterSelect}/>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"14px",padding:"14px"}}>
        <QuoteOfDay countryName={selectedCountry.name} writer={selectedWriter || selectedCountry.writers[0] || null}/>
        <LiteraryCalendar countryName={selectedCountry.name} writer={selectedWriter || selectedCountry.writers[0] || null}/>
      </div>
    </div>
  );
}