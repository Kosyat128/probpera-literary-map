import { useEffect, useRef, useState } from "react";

import background from "../assets/map/literary-map-background.png";
import svgMap from "../assets/map/literary-world-map.svg";



export default function LiteraryWorldMap(){


const svgRef = useRef<HTMLDivElement>(null);

const [active,setActive]=useState("");



useEffect(()=>{


fetch(svgMap)

.then(res=>res.text())

.then(svg=>{


if(!svgRef.current) return;


svgRef.current.innerHTML=svg;



const paths =

svgRef.current.querySelectorAll(
"path"
);



paths.forEach((path)=>{


path.addEventListener(
"mouseenter",
()=>{


path.setAttribute(
"fill",
"#E97824"
);


setActive(
path.id || "unknown"
);


}

);



path.addEventListener(
"mouseleave",
()=>{


path.removeAttribute(
"fill"
);


setActive("");

}

);



});



});



},[]);






return(


<div

style={{

position:"relative",

height:"700px",

overflow:"hidden",

borderRadius:"18px"

}}

>



<img

src={background}

style={{

position:"absolute",

width:"100%",

height:"100%",

objectFit:"cover"

}}

/>





<div

ref={svgRef}


style={{

position:"absolute",

inset:0,

zIndex:2,

cursor:"pointer"

}}


/>






{

active &&

<div

style={{

position:"absolute",

top:30,

left:30,

zIndex:5,

background:"#FFF8EE",

padding:"15px",

borderRadius:"12px",

color:"#35205F"

}}

>


SVG объект:

<br/>

<b>

{active}

</b>


</div>


}



</div>


)


}
