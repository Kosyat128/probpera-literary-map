import { useMemo, useState } from "react";
import type { Country, Writer } from "../data/countries";
import CountryStats from "./CountryStats";
import WriterProfile from "./WriterProfile";

type WriterPanelProps = {
  country: Country;
  onWriterSelect?: (writer: Writer) => void;
};

export default function WriterPanel({ country, onWriterSelect }: WriterPanelProps) {
  const writers = country.writers || [];
  const [selected, setSelected] = useState<Writer | null>(writers[0] || null);
  const [openProfile, setOpenProfile] = useState(false);

  const sortedWriters = useMemo(() =>
    [...writers].sort((a, b) => (a.name || a.fullName || "").localeCompare(b.name || b.fullName || "")),
    [writers]
  );

  const chooseWriter = (writer: Writer) => {
    setSelected(writer);
    setOpenProfile(false);
    onWriterSelect?.(writer);
  };

  return (
    <aside style={{width:"340px",background:"#FFF8EE",borderRadius:"18px",padding:"20px",height:"620px",overflowY:"auto"}}>
      <h2 style={{color:"#35205F"}}>{country.name}</h2>
      <div style={{color:"#E97824",fontWeight:"bold"}}>Литературных авторов: {writers.length}</div>

      <CountryStats country={country} onWriterSelect={chooseWriter}/>

      {selected && !openProfile && (
        <div>
          <h3>{selected.name || selected.fullName}</h3>
          <button onClick={()=>setOpenProfile(true)}>Открыть полный профиль</button>
        </div>
      )}

      {selected && openProfile && <WriterProfile writer={selected}/>} 

      <h3>Главные авторы ({sortedWriters.length})</h3>
      {sortedWriters.map(writer => (
        <div key={writer.id} onClick={()=>chooseWriter(writer)} style={{padding:"10px",cursor:"pointer",background:selected?.id===writer.id?"#E6D5C0":"#F7EBDD",marginBottom:"8px",borderRadius:"10px"}}>
          <b>{writer.name || writer.fullName}</b><br/>
          <small>{writer.years}</small>
        </div>
      ))}
    </aside>
  );
}
