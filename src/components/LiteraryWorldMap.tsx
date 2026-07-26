import { useMemo, useState } from "react";
import SvgWorldMap from "./SvgWorldMap";
import WriterPanel from "./WriterPanel";
import GlobalWriterSearch from "./GlobalWriterSearch";
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

  return (
    <div style={{ display: "flex", gap: "20px", position: "relative" }}>
      <div style={{ flex: 1, position: "relative" }}>
        <GlobalWriterSearch onWriterSelect={setSelectedWriter} />

        <SvgWorldMap onCountrySelect={selectCountry} selectedCountry={selectedCountry?.id} />

        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          {allWriters.map((writer) => (
            <button
              key={writer.id}
              onClick={() => setSelectedWriter(writer)}
              aria-label={writer.name}
              style={{
                position: "absolute",
                left: `${writer.coordinates?.lng ?? 0}%`,
                top: `${writer.coordinates?.lat ?? 0}%`,
                width: "14px",
                height: "14px",
                borderRadius: "50%",
                border: "2px solid #fff8ee",
                background: "#E97824",
                transform: "translate(-50%, -50%)",
                cursor: "pointer",
                pointerEvents: "auto",
                padding: 0,
              }}
            />
          ))}
        </div>
      </div>

      {selectedCountry && <WriterPanel country={selectedCountry} />}
      {selectedWriter && (
        <WriterCard
          writer={selectedWriter}
          onClose={() => setSelectedWriter(null)}
        />
      )}
    </div>
  );
}
