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



  // Загружаем SVG

  useEffect(()=>{

    fetch(mapSvg)

      .then(response => response.text())

      .then(data => {

        setSvg(data);

        console.log("SVG загружен");

      });


  },[]);





  // Подключаем события к странам

  useEffect(()=>{


    if(!mapRef.current || !svg) return;



    const paths = mapRef.current.querySelectorAll("path");


    console.log("PATH", paths.length);



    paths.forEach((element)=>{


      const path = element as SVGPathElement;



      path.style.pointerEvents="all";



      path.onmouseenter = ()=>{


        path.style.fill="#E97824";

        path.style.fillOpacity="0.75";

        path.style.cursor="pointer";


        setActive(

          path.id || "country"

        );


      };





      path.onmouseleave = ()=>{


        path.style.fill="";

        path.style.fillOpacity="";


        setActive("");

      };






      path.onclick = ()=>{


        console.log(

          "CLICK COUNTRY",

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



{/* ФОН КАРТЫ */}


<img

src={background}

alt="Literary world map"

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








{/* SVG ИНТЕРАКТИВНЫЙ СЛОЙ */}


<div

ref={mapRef}

style={{

position:"absolute",

left:0,

top:0,

width:"100%",

height:"100%",

zIndex:2,

pointerEvents:"all"

}}

dangerouslySetInnerHTML={{

__html:svg

}}

/>







{/* ТЕСТОВАЯ ПОДСКАЗКА */}


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

fontFamily:"Georgia, serif",

boxShadow:"0 5px 20px rgba(0,0,0,.2)"

}}

>

Страна:

<br/>

<b>{active}</b>


</div>


}



</div>


);


}
