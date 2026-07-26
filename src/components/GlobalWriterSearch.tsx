import { useMemo, useState } from "react";
import { countries } from "../data/countries";
import { filterWriters, getAllWriters } from "../filters/writerFilters";

export default function GlobalWriterSearch() {
  const [search, setSearch] = useState("");

  const writers = useMemo(() => getAllWriters(countries), []);

  const results = useMemo(
    () => filterWriters(writers, { search }),
    [writers, search]
  );

  return (
    <div style={{ padding: "15px", background: "#FFF8EE", borderRadius: "16px" }}>
      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="🔎 Найти писателя мира"
        style={{ width: "100%", padding: "10px" }}
      />

      {search && (
        <div style={{ marginTop: "10px" }}>
          {results.slice(0, 20).map((writer) => (
            <div key={writer.id} style={{ padding: "6px" }}>
              {writer.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
