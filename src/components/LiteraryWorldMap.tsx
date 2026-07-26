import { useMemo, useState } from "react";
import SvgWorldMap from "./SvgWorldMap";
import WriterPanel from "./WriterPanel";
import GlobalWriterSearch from "./GlobalWriterSearch";
import GlobalWriterFilters from "./GlobalWriterFilters";
import WriterClusters from "./WriterClusters";
import { countries } from "../data/countries";
import type { Country, WriterProfile } from "../data/countries/types";
import type { WriterFilterState } from "../filters/filterTypes";
import { filterWriters, getAllWriters } from "../filters/writerFilters";
import WriterCard from "./WriterCard";

type LiteraryWorldMapProps = {
  onCountrySelect?: (name: string) => void;
};

export default function LiteraryWorldMap({ onCountrySelect }: LiteraryWorldMapProps) {
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const allWriters = useMemo(() => getAllWriters(countries), []);
  const [selectedWriter, setSelectedWriter] = useState<WriterProfile | null>(allWriters[0] ?? null);
  const [filters, setFilters] = useState<WriterFilterState>({});

  const filteredWriters = useMemo(() => filterWriters(allWriters, filters), [allWriters, filters]);

  const selectCountry = (name: string) => {
    const country = countries.find((item) => item.name === name);
    setSelectedCountry(country || null);
    onCountrySelect?.(name);
  };

  const selectWriter = (writer: WriterProfile) => {
    setSelectedWriter(writer);
    if (writer.country) selectCountry(writer.country);
  };

  return (
    <div style={{ display: "flex", gap: "20px", position: "relative" }}>
      <div style={{ flex: 1, position: "relative" }}>
        <GlobalWriterFilters filters={filters} onChange={setFilters} />
        <div style={{ color: "#35205F", margin: "10px 0", fontWeight: "bold" }}>
          Найдено авторов: {filteredWriters.length}
        </div>
        <GlobalWriterSearch onWriterSelect={selectWriter} />
        <SvgWorldMap onCountrySelect={selectCountry} selectedCountry={selectedCountry?.id} />
        <WriterClusters writers={filteredWriters} onCountrySelect={selectCountry} selectedCountry={selectedCountry?.id} />
      </div>
      {selectedCountry && <WriterPanel country={selectedCountry} onWriterSelect={selectWriter} />}
      {selectedWriter && <WriterCard writer={selectedWriter} onClose={() => setSelectedWriter(null)} />}
    </div>
  );
}
