type WriterMapProps={
 places:string[];
};

export default function WriterMap({places}:WriterMapProps){
 return <div style={{background:'#FFF8EE',padding:'16px',borderRadius:'14px'}}>
  <h3>Литературные места</h3>
  {places.map(place=><p key={place}>📍 {place}</p>)}
 </div>;
}
