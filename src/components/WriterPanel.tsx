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
  const [selected, setSelected] = useState<Writer | null>(writers[0] || null);
  const [openProfile, setOpenProfile] = useState(false);

  useEffect(() => {
    const firstWriter = country.writers?.[0] || null;
    setSelected(firstWriter);
    setOpenProfile(false);
    if (firstWriter) onWriterSelect?.(firstWriter);
  }, [country.id]);

  const sortedWriters = useMemo(
    () => [...writers].sort((a, b) => (a.name || a.fullName || "").localeCompare(b.name || b.fullName || "")),
    [writers]
  );

  const chooseWriter = (writer: Writer) => {
    setSelected(writer);
    setOpenProfile(false);
    onWriterSelect?.(writer);
  };

  const eraLabel = country.periods?.length ? country.periods.join(" • ") : "Классическая и современная литература";
  const mainAuthors = sortedWriters.slice(0, 3);
  const nobelAuthors = sortedWriters.filter((writer) => writer.nobel || writer.isNobel || writer.nobelPrize).slice(0, 3);
  const literaryPlaces = country.literaryPlaces?.slice(0, 4) || [];

  return (
    <aside style={{width:"340px",background:"#FFF8EE",borderRadius:"18px",padding:"20px",height:"620px",overflowY:"auto",color:"#35205F"}}>
      <h2>🌍 {country.name}</h2>

      <div style={{background:"#F7EBDD",padding:"10px",borderRadius:"10px"}}>
        <p>✒️ Авторов: {writers.length}</p>
        <p>🕰 Эпохи: {eraLabel}</p>
      </div>

      <CountryStats country={country} onWriterSelect={chooseWriter}/>

      <h3>⭐ Главные авторы</h3>
      {mainAuthors.map(writer => (
        <div key={writer.id || writer.name || writer.fullName}
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
      <h3>🏆 Нобелевские</h3>
      <div>
        {nobelAuthors.length ? nobelAuthors.map(writer => (
          <p key={writer.id || writer.name || writer.fullName}>• {writer.name || writer.fullName}</p>
        )) : <p>Нет данных</p>}
      </div>

      <h3>📍 Литературные места</h3>
      <div>
        {literaryPlaces.length ? literaryPlaces.map((place) => <p key={place}>• {place}</p>) : <p>Нет данных</p>}
      </div>

      <h3>Разделы страны</h3>
      <p>🏛 Литературные места</p>
      <p>🏆 Премии и награды</p>
      <p>💬 Цитаты авторов</p>
      <p>📅 Календарь событий</p>
    </aside>
  );
}