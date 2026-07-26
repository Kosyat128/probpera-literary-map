import type { WriterFilterState } from "../filters/filterTypes";

type Props = {
  filters: WriterFilterState;
  onChange: (filters: WriterFilterState) => void;
};

export default function GlobalWriterFilters({ filters, onChange }: Props) {
  return (
    <div style={{
      display: "grid",
      gap: "8px",
      padding: "12px",
      background: "#FFF8EE",
      borderRadius: "14px"
    }}>
      <input
        placeholder="🔎 Найти автора"
        value={filters.search || ""}
        onChange={(e) => onChange({ ...filters, search: e.target.value })}
      />

      <input
        placeholder="🌍 Страна"
        value={filters.country || ""}
        onChange={(e) => onChange({ ...filters, country: e.target.value })}
      />

      <input
        placeholder="📚 Жанр"
        value={filters.genre || ""}
        onChange={(e) => onChange({ ...filters, genre: e.target.value })}
      />

      <input
        placeholder="🗣 Язык"
        value={filters.language || ""}
        onChange={(e) => onChange({ ...filters, language: e.target.value })}
      />

      <input
        placeholder="📅 Эпоха"
        value={filters.period || ""}
        onChange={(e) => onChange({ ...filters, period: e.target.value })}
      />

      <input
        placeholder="🏆 Награда"
        value={filters.award || ""}
        onChange={(e) => onChange({ ...filters, award: e.target.value })}
      />
    </div>
  );
}
