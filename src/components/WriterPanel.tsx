import { useEffect, useMemo, useState } from "react";
import type { Country, Writer } from "../data/countries";
import CountryStats from "./CountryStats";
import WriterProfile from "./WriterProfile";

type WriterPanelProps = {
  country: Country;
  onWriterSelect?: (writer: Writer) => void;
};

export default function WriterPanel({ country, onWriterSelect }: WriterPanelProps) {
  const writers = country.writers || [];
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("");
  const [language, setLanguage] = useState("");
  const [selected, setSelected] = useState<Writer | null>(writers[0] || null);
  const [openProfile, setOpenProfile] = useState(false);

  useEffect(() => {
    const firstWriter = country.writers?.[0] || null;
    setSelected(firstWriter);
    setOpenProfile(false);
    setQuery("");
    setGenre("");
    setLanguage("");
  }, [country]);

  const genres = [...new Set(writers.flatMap(writer => writer.genres || []))];
  const languages = [...new Set(writers.flatMap(writer => writer.language ? [writer.language] : writer.languages || []))];

  const filteredWriters = useMemo(() => writers.filter(writer => {
    const name = (writer.fullName || writer.name || "").toLowerCase();

    if (query && !name.includes(query.toLowerCase())) return false;
    if (genre && !writer.genres?.includes(genre)) return false;
    if (language && writer.language !== language && !writer.languages?.includes(language)) return false;

    return true;
  }), [writers, query, genre, language]);

  const chooseWriter = (writer: Writer) => {
    setSelected(writer);
    setOpenProfile(false);
    onWriterSelect?.(writer);
  };

  return <aside style={{width:"380px",background:"#FFF8EE",borderRadius:"18px",padding:"20px",height:"620px",overflowY:"auto"}}>
    <h2 style={{color:"#35205F",marginBottom:"5px"}}>{country.name}</h2>
    <div style={{color:"#E97824",fontWeight:"bold",marginBottom:"12px"}}>
      Литературных авторов: {writers.length}
    </div>

    <CountryStats country={country}/>

    <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="🔎 Найти писателя" style={{width:"100%",padding:"10px",margin:"15px 0"}}/>

    <select value={genre} onChange={e=>setGenre(e.target.value)} style={{width:"100%",padding:"8px",marginBottom:"10px"}}>
      <option value="">Все жанры</option>
      {genres.map(item=><option key={item} value={item}>{item}</option>)}
    </select>

    <select value={language} onChange={e=>setLanguage(e.target.value)} style={{width:"100%",padding:"8px",marginBottom:"10px"}}>
      <option value="">Все языки</option>
      {languages.map(item=><option key={item} value={item}>{item}</option>)}
    </select>

    {selected && !openProfile && <div>
      <h3>{selected.fullName || selected.name}</h3>
      <button onClick={()=>setOpenProfile(true)}>Открыть полный профиль</button>
    </div>}

    {selected && openProfile && <WriterProfile writer={selected}/>} 

    <h3>Авторы ({filteredWriters.length})</h3>
    {filteredWriters.map(writer=><div key={writer.id} onClick={()=>chooseWriter(writer)} style={{padding:"10px",cursor:"pointer",background:selected?.id===writer.id?"#E6D5C0":"#F7EBDD",marginBottom:"8px",borderRadius:"10px"}}>
      <b>{writer.fullName || writer.name}</b><br/><small>{writer.years}</small>
    </div>)}
  </aside>;
}
