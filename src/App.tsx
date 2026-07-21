import { useState } from "react";

import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import WorldMap from "./components/WorldMap";
import WriterPanel from "./components/WriterPanel";

import { countries } from "./data/countries";

export default function App() {
  const [selectedCountry, setSelectedCountry] = useState(countries[0]);

  return (
    <>
      <Header title="LiteraryMap" />

      <div
        style={{
          display: "flex",
          height: "calc(100vh - 80px)",
        }}
      >
        <Sidebar
          items={countries.map((country) => country.name)}
          selectedItem={selectedCountry.name}
          onSelect={(countryName) => {
            const country = countries.find((c) => c.name === countryName);
            if (country) {
              setSelectedCountry(country);
            }
          }}
        />

        <WorldMap
          selectedCountry={selectedCountry.name}
          onCountrySelect={(countryName) => {
            const country = countries.find((c) => c.name === countryName);
            if (country) {
              setSelectedCountry(country);
            }
          }}
        />

        <WriterPanel country={selectedCountry} />
      </div>
    </>
  );
}
