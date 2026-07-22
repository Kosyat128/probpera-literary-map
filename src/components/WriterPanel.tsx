import { useMemo, useState } from "react";
import type { Country, Writer } from "../data/types";
import CountryStats from "./CountryStats";
import WriterProfile from "./WriterProfile";

type WriterPanelProps = {
  country: Country;
};

export default function WriterPanel({ country }: WriterPanelProps) {
  const writers = country.writers || [];
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Writer | null>(writers[0] || null);
  const [openProfile, setOpenProfile] = useState(false);

  const filteredWriters = useMemo(() => {
    return writers.filter(writer =>
      (writer.fullName || writer.name)
        .toLowerCase()
        .includes(query.toLowerCase())
    );
  }, [writers, query]);

  return (
    <aside style={{
      width:"380px",
      background:"#FFF8EE",
      borderRadius:"18px",
      padding:"20px",
      color:"#2B183F",
      overflowY:"auto",
      height:"620px",
      boxShadow:"0 5px 20px rgba(53,32,95,.15)"
    }}>

      <h2 style={{color:"#35205F"}}>{country.name}</h2>

      <CountryStats country={country}/>

      <input
        value={query}
        onChange={(e)=>setQuery(e.target.value)}
        placeholder="🔎 Найти писателя"
        style={{width:"100%",padding:"10px",margin:"15px 0",borderRadius:"10px"}}
      />

      {selected && !openProfile && <WriterCard writer={selected} onOpen={()=>setOpenProfile(true)}/>}

      {selected && openProfile && <>
        <button onClick={()=>setOpenProfile(false)}>← Назад к списку</button>
        <WriterProfile writer={selected}/>
      </>}

      {!openProfile && <>
        <h3>Известные авторы ({filteredWriters.length})</h3>
        {filteredWriters.map(writer=>(
          <div
            key={writer.id}
            onClick={()=>{
              setSelected(writer);
              setOpenProfile(false);
            }}
            style={{
              background:selected?.id===writer.id ? "#E6D5C0":"#F7EBDD",
              padding:"10px",
              borderRadius:"10px",
              marginBottom:"8px",
              cursor:"pointer"
            }}
          >
            <b>{writer.fullName || writer.name}</b><br/>
            <small>{writer.years}</small>
          </div>
        ))}
      </>}

    </aside>
  );
}

function WriterCard({writer,onOpen}:{writer:Writer,onOpen:()=>void}){
 return <div style={{background:"#F7EBDD",borderRadius:"15px",padding:"15px"}}>
   {writer.portrait && <img src={writer.portrait} alt={writer.fullName || writer.name} style={{width:"100%",height:"160px",objectFit:"cover",borderRadius:"12px"}}/>}
   <h2 style={{color:"#35205F"}}>{writer.fullName || writer.name}</h2>
   <p>📅 {writer.years}</p>
   <button onClick={onOpen}>Открыть полный профиль</button>
 </div>
}
