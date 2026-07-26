import { useMemo, useState } from "react";
import SvgWorldMap from "./SvgWorldMap";
import WriterPanel from "./WriterPanel";
import GlobalWriterSearch from "./GlobalWriterSearch";
import WriterClusters from "./WriterClusters";
import { countries } from "../data/countries";
import type { Country } from "../data/countries/types";
import WriterCard from "./WriterCard";
import { getAllWriters } from "../filters/writerFilters";

type LiteraryWorldMapProps = {
  onCountrySelect?: (name: string) => void;
};

export default function LiteraryWorldMap({ onCountrySelect }: LiteraryWorldMapProps) {
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const allWriters = useMemo(() => getAllWriters(countries), []);
  const [selectedWriter, setSelectedWriter] = useState(allWriters[0] ?? null);

  const selectCountry = (name: string) => {
    const country = countries.find((item) => item.name === name);
    setSelectedCountry(country || null);
    onCountrySelect?.(name);
  };

  const selectWriter = (writer: typeof selectedWriter) => {
    setSelectedWriter(writer);
    if (writer?.country) selectCountry(writer.country);
  };

  return (
    <div style={{ display: "flex", gap: "20px", position: "relative" }}>
      <div style={{ flex: 1, position: "relative" }}>
        <GlobalWriterSearch onWriterSelect={selectWriter} />
        <SvgWorldMap onCountrySelect={selectCountry} selectedCountry={selectedCountry?.id} />
        <WriterClusters onCountrySelect={selectCountry} />
      </div>

      {selectedCountry && (
        <WriterPanel
          country={selectedCountry}
          onWriterSelect={selectWriter}
        />
      )}

      {selectedWriter && (
        <WriterCard
          writer={selectedWriter}
          onClose={() => setSelectedWriter(null)}
        />
      )}
    </div>
  );
}
