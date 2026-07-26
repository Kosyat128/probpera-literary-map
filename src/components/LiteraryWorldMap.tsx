import GlobalWriterFilters from "./GlobalWriterFilters";
import LiteraryGlobe from "./LiteraryGlobe";
import WriterCard from "./WriterCard";
import type { Country, WriterProfile } from "../data/countries/types";
import type { WriterFilterState } from "../filters/filterTypes";

interface Props {
  selectedCountry?: Country | null;
  selectedWriter?: WriterProfile | null;
  onCountrySelect?: (name: string) => void;
  onWriterSelect?: (writer: WriterProfile) => void;
  filters: WriterFilterState;
  onFiltersChange: (filters: WriterFilterState) => void;
}

export default function LiteraryWorldMap({
  selectedCountry,
  selectedWriter,
  onCountrySelect,
  onWriterSelect,
  filters,
  onFiltersChange,
}: Props) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(700px,1fr) 340px", gap: 16, width: "100%", minHeight: 700, alignItems: "start" }}>
      <main style={{ minWidth: 0 }}>
        <div style={{ background: '#FFF8EE', borderRadius: 16, padding: 10, marginBottom: 12 }}>
          <GlobalWriterFilters filters={filters} onChange={onFiltersChange} />
        </div>
        <LiteraryGlobe onCountrySelect={onCountrySelect} />
        {selectedWriter && <WriterCard writer={selectedWriter} onClose={() => onWriterSelect?.(null as unknown as WriterProfile)} />}
      </main>

      {selectedCountry && <WriterPanel country={selectedCountry} onWriterSelect={onWriterSelect as unknown as (writer: any) => void} />}
    </div>
  );
}