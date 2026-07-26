import { useMemo } from "react";
import { countries } from "../data/countries";
import { getAllWriters } from "../filters/writerFilters";

export default function MapStatistics() {
  const writers = useMemo(() => getAllWriters(countries), []);
  const languages = new Set(
    writers.flatMap((writer) => writer.language ? [writer.language] : writer.languages || [])
  );

  return (
    <div
      style={{
        position: "absolute",
        left: "20px",
        bottom: "20px",
        background: "#FFF8EE",
        color: "#35205F",
        padding: "16px",
        borderRadius: "14px",
        zIndex: 10,
        boxShadow: "0 8px 25px rgba(53,32,95,.18)",
        fontFamily: "Georgia, serif",
      }}
    >
      <div><b>Литературный атлас мира</b></div>
      <div>Стран: {countries.length}</div>
      <div>Писателей: {writers.length}</div>
      <div>Языков: {languages.size}</div>
    </div>
  );
}
