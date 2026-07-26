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
    <aside style={{width:"340px",background:"#FFF8EE",borderRadius:"18px",padding:"20px",height:"620px",overflowY:"auto",color:"#35205F"}}>
      <h2>🌍 {country.name}</h2>

      <div style={{background:"#F7EBDD",padding:"10px",borderRadius:"10px"}}>
        <p>✒️ Авторов: {writers.length}</p>
        <p>📚 Литературная база: {writers.length ? "загружена" : "нет данных"}</p>
        <p>🕰 Эпохи: классическая и современная литература</p>
      </div>

      <CountryStats country={country} onWriterSelect={chooseWriter}/>

      <h3>⭐ Главные авторы</h3>
      {sortedWriters.slice(0,10).map(writer => (
        <div key={writer.id || writer.name}
          onClick={()=>chooseWriter(writer)}
          style={{padding:"10px",cursor:"pointer",background:selected?.id===writer.id?"#E6D5C0":"#F7EBDD",marginBottom:"8px",borderRadius:"10px"}}>
          <b>{writer.name || writer.fullName}</b><br/>
          <small>{writer.years}</small>
        </div>
      ))}

      {selected && (
        <>
          <hr/>
          <button onClick={()=>setOpenProfile(!openProfile)}>
            {openProfile ? "Скрыть профиль" : "Открыть профиль"}
          </button>
          {openProfile && <WriterProfile writer={selected}/>} 
        </>
      )}

      <hr/>
      <h3>Разделы страны</h3>
      <p>🏛 Литературные места</p>
      <p>🏆 Премии и награды</p>
      <p>💬 Цитаты авторов</p>
      <p>📅 Календарь событий</p>
    </aside>
  );
}
