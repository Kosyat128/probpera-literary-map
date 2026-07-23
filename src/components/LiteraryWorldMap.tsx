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


setSvg(

data.replace(

"<svg",

`<svg 
style="width:100%;height:100%"
preserveAspectRatio="none"`

)

);


});


},[]);







useEffect(()=>{


if(!mapRef.current) return;



const paths =

mapRef.current.querySelectorAll("path");



console.log(

"PATH FOUND:",

paths.length

);





paths.forEach((path)=>{



path.addEventListener(

"mouseenter",

()=>{


(path as SVGPathElement)

.style.fill="#E97824";



setActive(

path.id || "NO_ID"

);


}

);





path.addEventListener(

"mouseleave",

()=>{


(path as SVGPathElement)

.style.fill="";



setActive("");

}


);





path.addEventListener(

"click",

()=>{


console.log(

"CLICK",

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

Выбран:

<br/>

<b>{active}</b>


</div>



}



</div>


);

}
