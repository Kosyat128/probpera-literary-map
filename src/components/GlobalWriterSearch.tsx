import { useMemo, useState } from "react";
import { countries } from "../data/countries";
import { filterWriters, getAllWriters } from "../filters/writerFilters";
import type { Writer } from "../data/countries/types";

type GlobalWriterSearchProps = {
  onWriterSelect?: (writer: Writer) => void;
};

export default function GlobalWriterSearch({ onWriterSelect }: GlobalWriterSearchProps) {
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("");
  const [genre, setGenre] = useState("");
  const [language, setLanguage] = useState("");
  const [period, setPeriod] = useState("");
  const [award, setAward] = useState("");

  const writers = useMemo(() => getAllWriters(countries), []);

  const countryList = countries.map((item) => item.name);
  const genres = [...new Set(writers.flatMap((writer) => writer.genres || []))];
  const languages = [...new Set(writers.flatMap((writer) => writer.language ? [writer.language] : writer.languages || []))];
  const periods = [...new Set(writers.flatMap((writer) => writer.tags || []))];
  const awards = [...new Set(writers.flatMap((writer) => writer.awards || []))];

  const results = useMemo(
    () => filterWriters(writers, { search, country, genre, language, period, award }),
    [writers, search, country, genre, language, period, award]
  );

  const hasFilters = Boolean(search || country || genre || language || period || award);

  const clearFilters = () => {
    setSearch("");
    setCountry("");
    setGenre("");
    setLanguage("");
    setPeriod("");
    setAward("");
  };

  const getFlag = (name?: string) => {
    const found = countries.find((item) => item.name === name) as typeof countries[number] & { flag?: string } | undefined;
    return found?.flag || "🌍";
  };

  return (
    <div style={{ padding: "15px", background: "#FFF8EE", borderRadius: "16px" }}>
      <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="🔎 Найти писателя мира" style={{ width: "100%", padding: "10px" }} />

      <select value={country} onChange={(event) => setCountry(event.target.value)}>
        <option value="">Все страны</option>
        {countryList.map((item) => <option key={item}>{item}</option>)}
      </select>

      <select value={genre} onChange={(event) => setGenre(event.target.value)}>
        <option value="">Все жанры</option>
        {genres.map((item) => <option key={item}>{item}</option>)}
      </select>

      <select value={language} onChange={(event) => setLanguage(event.target.value)}>
        <option value="">Все языки</option>
        {languages.map((item) => <option key={item}>{item}</option>)}
      </select>

      <select value={period} onChange={(event) => setPeriod(event.target.value)}>
        <option value="">Все эпохи</option>
        {periods.map((item) => <option key={item}>{item}</option>)}
      </select>

      <select value={award} onChange={(event) => setAward(event.target.value)}>
        <option value="">Все премии</option>
        {awards.map((item) => <option key={item}>{item}</option>)}
      </select>

      {hasFilters && <button onClick={clearFilters} style={{ marginTop: "10px" }}>✖ Очистить фильтры</button>}

      {hasFilters && <div style={{ marginTop: "12px", color: "#35205F", fontWeight: "bold" }}>Найдено авторов: {results.length}</div>}

      {hasFilters && (
        <div style={{ marginTop: "10px" }}>
          {results.slice(0, 20).map((writer) => (
            <button key={writer.id} onClick={() => onWriterSelect?.(writer)} style={{ display: "block", width: "100%", padding: "10px", textAlign: "left", marginBottom: "8px", borderRadius: "10px" }}>
              <b>✒️ {writer.fullName || writer.name}</b><br />
              <small>{getFlag(writer.country)} {writer.country || ""}</small><br />
              <small>📅 {writer.years || ""}</small><br />
              {writer.genres?.length ? <small>📚 {writer.genres.join(", ")}</small> : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
