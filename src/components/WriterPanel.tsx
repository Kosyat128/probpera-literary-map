import { useMemo, useState } from "react";
import type { Country, Writer } from "../data/types";
import CountryStats from "./CountryStats";
import WriterProfile from "./WriterProfile";

type WriterPanelProps = {
  country: Country;
  onWriterSelect?: (writer: Writer) => void;
};

export default function WriterPanel({ country, onWriterSelect }: WriterPanelProps) {
  const writers = country.writers || [];
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Writer | null>(writers[0] || null);
  const [openProfile, setOpenProfile] = useState(false);

  const filteredWriters = useMemo(() => writers.filter(writer =>
    (writer.fullName || writer.name).toLowerCase().includes(query.toLowerCase())
  ), [writers, query]);

  const chooseWriter = (writer: Writer) => {
    setSelected(writer);
    setOpenProfile(false);
    onWriterSelect?.(writer);
  };

  return <aside style={{width:"380px",background:"#FFF8EE",borderRadius:"18px",padding:"20px",height:"620px",overflowY:"auto"}}>
    <h2 style={{color:"#35205F"}}>{country.name}</h2>
    <CountryStats country={country}/>
    <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="🔎 Найти писателя" style={{width:"100%",padding:"10px",margin:"15px 0"}}/>

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
