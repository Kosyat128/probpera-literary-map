import { useEffect, useRef, useState } from "react";

import background from "../assets/map/literary-map-background.png";
import mapSvg from "../assets/map/literary-world-map.svg";


type Props = {
  onCountrySelect?: (country:string)=>void;
};



export default function LiteraryWorldMap({

  onCountrySelect

}:Props){


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



    const paths =

      mapRef.current.querySelectorAll("path");



    console.log(

      "PATH FOUND",

      paths.length

    );





    paths.forEach((path)=>{


      const p = path as SVGPathElement;



      p.addEventListener(

        "mouseenter",

        ()=>{


          p.style.fill="#E97824";

          p.style.opacity="0.8";

          p.style.cursor="pointer";


          setActive(

            p.id || "path"

          );


        }

      );





      p.addEventListener(

        "mouseleave",

        ()=>{


          p.style.fill="";

          p.style.opacity="";


          setActive("");


        }

      );







      p.addEventListener(

        "click",

        ()=>{


          console.log(

            "CLICK",

            p.id

          );


          onCountrySelect?.(

            p.id

          );


        }

      );



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





<img


src={background}


alt="literary map"


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


ref={mapRef}


style={{


position:"absolute",

inset:0,

zIndex:2


}}



dangerouslySetInnerHTML={{


__html:svg


}}



/>







{

active &&


<div


style={{


position:"absolute",

top:20,

left:20,

zIndex:10,

background:"#FFF8EE",

padding:"15px",

borderRadius:"10px",

color:"#35205F"


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
