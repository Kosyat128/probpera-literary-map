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

const [svg,setSvg]=useState("");

const [active,setActive]=useState("");




useEffect(()=>{


fetch(mapSvg)

.then(r=>r.text())

.then(data=>{


let fixed=data.replace(

"<svg",

`<svg
preserveAspectRatio="none"
style="width:100%;height:100%;"
`

);


setSvg(fixed);


});


},[]);





useEffect(()=>{


if(!mapRef.current) return;


const paths =
mapRef.current.querySelectorAll("path");



paths.forEach((path)=>{


path.addEventListener(

"mouseenter",

()=>{


path.setAttribute(

"data-old-fill",

path.getAttribute("fill") || ""

);


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


const old =
path.getAttribute(
"data-old-fill"
);



if(old){

path.setAttribute(
"fill",
old
);

}



setActive("");

}


);



path.addEventListener(

"click",

()=>{


console.log(

"CLICK PATH",

path.id

);


onCountrySelect?.(

path.id

);


}

);



});


},[svg]);







return (

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

inset:0,

width:"100%",

height:"100%",

objectFit:"cover"

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

borderRadius:"12px",

color:"#35205F"

}}

>

Объект SVG:

<br/>

<b>{active}</b>


</div>


}



</div>


);

}
