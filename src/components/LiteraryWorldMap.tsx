import { useState } from "react";
import SvgWorldMap from "./SvgWorldMap";
import WriterPanel from "./WriterPanel";
import { countries } from "../data/countries";
import type { Country } from "../data/countries/types";

type LiteraryWorldMapProps = {
  onCountrySelect?: (name: string) => void;
};

export default function LiteraryWorldMap({ onCountrySelect }: LiteraryWorldMapProps) {
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);

  const selectCountry = (name: string) => {
    const country = countries.find((item) => item.name === name);
    setSelectedCountry(country || null);
    onCountrySelect?.(name);
  };

  return (
    <div style={{ display: "flex", gap: "20px" }}>
      <div style={{ flex: 1 }}>
        <SvgWorldMap onCountrySelect={selectCountry} selectedCountry={selectedCountry?.id} />
      </div>
      {selectedCountry && <WriterPanel country={selectedCountry} />}
    </div>
  );
}
