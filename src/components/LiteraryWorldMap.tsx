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

        console.log("SVG загружен");

      });


  },[]);





  useEffect(()=>{


    if(!mapRef.current || !svg) return;


    const paths = mapRef.current.querySelectorAll("path");


    console.log(
      "PATH найдено:",
      paths.length
    );



    paths.forEach((element)=>{


      const path = element as SVGPathElement;


      path.style.pointerEvents="all";

      path.style.transition="0.2s";



      path.onmouseenter = ()=>{


        path.style.fill="#E97824";

        path.style.opacity="0.8";

        path.style.cursor="pointer";


        setActive(
          path.id || "path"
        );


      };





      path.onmouseleave = ()=>{


        path.style.fill="";

        path.style.opacity="";


        setActive("");

      };





      path.onclick = ()=>{


        console.log(
          "CLICK:",
          path.id
        );


        if(path.id){

          onCountrySelect?.(
            path.id
          );

        }


      };


    });



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


{/* PNG ФОН */}

<img

src={background}

alt="literary map"

style={{

position:"absolute",

left:0,

top:0,

width:"100%",

height:"100%",

objectFit:"cover",

zIndex:1

}}


/>





{/* SVG СЛОЙ */}

<div

style={{

position:"absolute",

left:0,

top:0,

width:"100%",

height:"100%",

overflow:"hidden",

zIndex:2

}}

>


<div

ref={mapRef}

style={{

position:"absolute",


/* ПОДГОНКА SVG */

left:"-70px",

top:"-45px",

width:"115%",

height:"115%",


transform:"scale(1.08)",

transformOrigin:"center center"


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

top:"20px",

left:"20px",

zIndex:10,

background:"#FFF8EE",

color:"#35205F",

padding:"12px 18px",

borderRadius:"10px",

boxShadow:"0 5px 20px rgba(0,0,0,.25)",

fontFamily:"Georgia, serif"

}}

>

SVG:

<br/>

<b>

{active}

</b>


</div>


}



</div>

);


}
