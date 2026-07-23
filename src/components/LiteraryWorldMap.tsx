import { useEffect, useRef, useState } from "react";
import background from "../assets/map/literary-map-background.png";
import mapSvg from "../assets/map/literary-world-map.svg";

type Props = {
  onCountrySelect?: (country:string)=>void;
};

export default function LiteraryWorldMap({onCountrySelect}: Props){
  const mapRef = useRef<HTMLDivElement>(null);
  const [svg,setSvg]=useState("");
  const [active,setActive]=useState("");

  useEffect(()=>{
    fetch(mapSvg).then(r=>r.text()).then(setSvg);
  },[]);

  useEffect(()=>{
    if(!mapRef.current || !svg) return;

    const paths=mapRef.current.querySelectorAll("path");

    paths.forEach((el)=>{
      const path=el as SVGPathElement;
      path.style.pointerEvents="all";
      path.style.cursor="pointer";
      path.style.transition=".2s";

      path.onmouseenter=()=>{
        path.style.fill="#E97824";
        path.style.opacity=".8";
        setActive(path.id || "path");
      };

      path.onmouseleave=()=>{
        path.style.fill="";
        path.style.opacity="";
        setActive("");
      };

      path.onclick=()=>{
        if(path.id) onCountrySelect?.(path.id);
      };
    });
  },[svg,onCountrySelect]);

  return <div style={{position:"relative",width:"100%",height:"700px",overflow:"hidden",borderRadius:"18px"}}>
    <img src={background} alt="literary map" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",zIndex:1}} />

    <div style={{position:"absolute",inset:0,zIndex:2,overflow:"hidden"}}>
      <div
        ref={mapRef}
        style={{
          position:"absolute",
          left:"24px",
          top:"12px",
          width:"96%",
          height:"96%",
          transform:"scale(1.03)",
          transformOrigin:"left top"
        }}
        dangerouslySetInnerHTML={{__html:svg}}
      />
    </div>

    {active && <div style={{position:"absolute",top:20,left:20,zIndex:10,background:"#FFF8EE",color:"#35205F",padding:"12px 18px",borderRadius:"10px",fontFamily:"Georgia,serif"}}>
      SVG:<br/><b>{active}</b>
    </div>}
  </div>;
}
