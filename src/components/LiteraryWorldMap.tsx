import { useEffect, useRef, useState } from "react";

import background from "../assets/map/literary-map-background.png";
import mapSvg from "../assets/map/literary-world-map.svg";


type Props = {
  onCountrySelect?: (country:string)=>void;
};


export default function LiteraryWorldMap({
  onCountrySelect
}: Props) {


  const mapRef = useRef<HTMLDivElement>(null);

  const [svg,setSvg] = useState("");

  const [active,setActive] = useState("");



  useEffect(()=>{

    fetch(mapSvg)
      .then(res=>res.text())
      .then(data=>{

        setSvg(data);

      });

  },[]);





  useEffect(()=>{


    if(!mapRef.current) return;


    const timer = setTimeout(()=>{


      const paths =
        mapRef.current!.querySelectorAll("path");


      console.log(
        "PATH FOUND:",
        paths.length
      );



      paths.forEach((element)=>{


        const path =
          element as SVGPathElement;



        path.style.pointerEvents="all";

        path.style.cursor="pointer";



        path.onmouseenter=()=>{


          path.style.fill="#E97824";

          path.style.opacity="0.8";


          setActive(
            path.id || "country"
          );


        };



        path.onmouseleave=()=>{


          path.style.fill="";

          path.style.opacity="";


          setActive("");

        };



        path.onclick=()=>{


          console.log(
            "CLICK:",
            path.id
          );


          onCountrySelect?.(
            path.id
          );


        };


      });



    },300);



    return ()=>clearTimeout(timer);



  },[svg,onCountrySelect]);








return (

<div

style={{

position:"relative",

width:"100%",

height:"700px",

overflow:"hidden",

borderRadius:"18px"

}}

>


<img

src={background}

alt="map"

style={{

position:"absolute",

inset:0,

width:"100%",

height:"100%",

objectFit:"cover",

zIndex:1

}}


/>





<div

style={{

position:"absolute",

left:0,

top:0,

width:"100%",

height:"100%",

zIndex:2,

overflow:"hidden"

}}

>


<div

ref={mapRef}

style={{

position:"absolute",

left:"35px",

top:"20px",

width:"100%",

height:"100%",

pointerEvents:"all"

}}

dangerouslySetInnerHTML={{

__html:svg

}}


/>


</div>






{

active &&


<div

style={{

position:"absolute",

top:20,

left:20,

zIndex:10,

background:"#FFF8EE",

color:"#35205F",

padding:"12px 18px",

borderRadius:"10px"

}}

>

<b>{active}</b>

</div>


}



</div>

);


}
