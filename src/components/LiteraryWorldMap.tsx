import { useEffect, useRef, useState } from "react";
import background from "../assets/map/literary-map-background.png";
import mapSvg from "../assets/map/literary-world-map.svg";

type Props={onCountrySelect?:(country:string)=>void};

export default function LiteraryWorldMap({onCountrySelect}:Props){
 const mapRef=useRef<HTMLDivElement>(null);
 const [svg,setSvg]=useState("");
 const [active,setActive]=useState("");

 useEffect(()=>{fetch(mapSvg).then(r=>r.text()).then(setSvg)},[]);

 useEffect(()=>{
  if(!mapRef.current||!svg)return;
  const root=mapRef.current.querySelector("svg");
  if(root){
   root.setAttribute("preserveAspectRatio","xMidYMid meet");
   root.style.width="100%";
   root.style.height="100%";
  }
  mapRef.current.querySelectorAll("path").forEach(el=>{
   const p=el as SVGPathElement;
   p.style.pointerEvents="all";
   p.style.cursor="pointer";
   p.onmouseenter=()=>{p.style.fill="#E97824";p.style.opacity="0.8";setActive(p.id||"path")};
   p.onmouseleave=()=>{p.style.fill="";p.style.opacity="";setActive("")};
   p.onclick=()=>p.id&&onCountrySelect?.(p.id);
  });
 },[svg,onCountrySelect]);

 return <div style={{position:"relative",width:"100%",height:"700px",overflow:"hidden",borderRadius:"18px"}}>
  <img src={background} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",zIndex:1}}/>
  <div style={{position:"absolute",inset:0,overflow:"hidden",zIndex:2}}>
   <div ref={mapRef} style={{position:"absolute",left:"55px",top:"38px",width:"calc(100% - 110px)",height:"calc(100% - 76px)",transform:"scale(1)",transformOrigin:"center center",pointerEvents:"auto"}} dangerouslySetInnerHTML={{__html:svg}}/>
  </div>
  {active&&<div style={{position:"absolute",top:20,left:20,zIndex:10,background:"#FFF8EE",color:"#35205F",padding:"12px 18px",borderRadius:"10px",fontFamily:"Georgia,serif"}}>SVG:<br/><b>{active}</b></div>}
 </div>
}