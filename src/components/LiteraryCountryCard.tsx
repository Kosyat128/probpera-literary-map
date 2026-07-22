type Props={name:string; writers:number};

export default function LiteraryCountryCard({name,writers}:Props){
 return <div style={{background:'#FFF8EE',padding:'20px',borderRadius:'16px'}}>
  <h2>{name}</h2>
  <p>✒️ Писателей: {writers}</p>
 </div>;
}
