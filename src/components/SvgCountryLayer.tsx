type SvgCountryLayerProps={
 onCountrySelect:(id:string)=>void;
};

export default function SvgCountryLayer({onCountrySelect}:SvgCountryLayerProps){
 const countries=["RU","FR","GB","US","JP"];
 return <svg viewBox="0 0 1000 500" style={{width:"100%"}}>
  {countries.map((id,index)=>(
   <path
    key={id}
    d={`M ${100+index*150} 150 h100 v100 h-100 z`}
    onClick={()=>onCountrySelect(id)}
    style={{cursor:"pointer"}}
   />
  ))}
 </svg>;
}
