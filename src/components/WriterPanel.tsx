import type { Country, Writer } from "../data/types";
import CountryStats from "./CountryStats";

type WriterPanelProps = {
  country: Country;
};

export default function WriterPanel({ country }: WriterPanelProps) {

  const writers = country.writers || [];
  const mainWriter = writers[0];

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

      <div style={{display:"flex",justifyContent:"space-between",marginBottom:"15px"}}>
        <button>←</button>
        <button>⭐</button>
        <button>↗</button>
      </div>

      <h2 style={{color:"#35205F"}}>{country.name}</h2>

      <CountryStats country={country}/>

      {mainWriter && <WriterCard writer={mainWriter}/>} 

      <h3>Известные авторы</h3>

      {writers.map(writer=>(
        <div key={writer.id} style={{background:"#F7EBDD",padding:"10px",borderRadius:"10px",marginBottom:"8px"}}>
          <b>{writer.fullName || writer.name}</b><br/>
          <small>{writer.years}</small>
        </div>
      ))}

    </aside>
  );
}

function WriterCard({writer}:{writer:Writer}){
 return <div style={{background:"#F7EBDD",borderRadius:"15px",padding:"15px"}}>
   {writer.portrait && <img src={writer.portrait} alt={writer.fullName || writer.name} style={{width:"100%",height:"160px",objectFit:"cover",borderRadius:"12px"}}/>}
   <h2 style={{color:"#35205F"}}>{writer.fullName || writer.name}</h2>
   <p>📅 {writer.years}</p>
   {writer.birthPlace && <p>📍 {writer.birthPlace}</p>}
   {writer.movement && <p>Направление: {writer.movement}</p>}
   <h3>Произведения</h3>
   {writer.works?.map(work=><p key={work}>📖 {work}</p>)}
 </div>
}
