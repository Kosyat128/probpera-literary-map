import type { Country } from "../data/types";
import CountryStats from "./CountryStats";

type WriterPanelProps = {
  country: Country;
};

export default function WriterPanel({country}: WriterPanelProps){

 const writers = country.writers;
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

   {mainWriter && (
    <div style={{
      background:"#F7EBDD",
      borderRadius:"15px",
      padding:"15px"
    }}>
      {mainWriter.portrait && (
       <img
        src={mainWriter.portrait}
        alt={mainWriter.name}
        style={{width:"100%",height:"160px",objectFit:"cover",borderRadius:"12px"}}
       />
      )}

      <h2 style={{color:"#35205F"}}>{mainWriter.name}</h2>
      <p>📅 {mainWriter.years}</p>
      {mainWriter.birthPlace && <p>📍 {mainWriter.birthPlace}</p>}
    </div>
   )}

   <h3>Известные авторы</h3>
   {writers.slice(0,6).map(writer=>(
    <div key={writer.id} style={{background:"#F7EBDD",padding:"10px",borderRadius:"10px",marginBottom:"8px"}}>
      <b>{writer.name}</b><br/>
      <small>{writer.years}</small>
    </div>
   ))}

   <h3>Основные произведения</h3>
   {mainWriter?.works?.map(work=>(
    <p key={work}>📖 {work}</p>
   ))}

   <h3>Литературные места</h3>
   <div style={{background:"#F7EBDD",padding:"12px",borderRadius:"12px"}}>
    📍 Дома-музеи писателей<br/>
    📍 Исторические литературные места
   </div>

   <h3>Связи</h3>
   <div style={{height:"120px",background:"#F7EBDD",borderRadius:"15px",display:"flex",alignItems:"center",justifyContent:"center"}}>
    Граф литературных связей
   </div>

  </aside>
 );
}
