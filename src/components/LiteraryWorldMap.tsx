import { useEffect, useState } from "react";

import background from "../assets/map/literary-map-background.png";
import mapSvg from "../assets/map/literary-world-map.svg";
import hitmapSvg from "../assets/map/country-hitmap.svg";


type Props = {

  onCountrySelect?: (country:string)=>void;

};



export default function LiteraryWorldMap({

  onCountrySelect

}:Props){


const [map,setMap]=useState("");

const [hitmap,setHitmap]=useState("");

const [hover,setHover]=useState("");





useEffect(()=>{


fetch(mapSvg)

.then(r=>r.text())

.then(setMap);



fetch(hitmapSvg)

.then(r=>r.text())

.then(setHitmap);



},[]);







function mouseMove(

e:React.MouseEvent<HTMLDivElement>

){


const target =

e.target as HTMLElement;



const country =

target.dataset.country;



if(country){

setHover(country);

}


}







function clickCountry(){

if(hover){

onCountrySelect?.(hover);

}

}







return (

<div


style={{

position:"relative",

width:"100%",

height:"700px",

overflow:"hidden"

}}



>



{/* ФОН */}


<img

src={background}

style={{

position:"absolute",

width:"100%",

height:"100%",

objectFit:"cover"

}}

/>






{/* КРАСИВАЯ SVG КАРТА */}



<div

dangerouslySetInnerHTML={{

__html:map

}}


style={{

position:"absolute",

inset:0,

pointerEvents:"none"

}}


/>






{/* КЛИКАБЕЛЬНЫЙ СЛОЙ */}



<div


onMouseMove={mouseMove}


onClick={clickCountry}


dangerouslySetInnerHTML={{

__html:hitmap

}}



style={{

position:"absolute",

inset:0,

zIndex:5,

cursor:"pointer"

}}


/>







{

hover &&

<div


style={{

position:"absolute",

top:20,

left:20,

background:"#FFF8EE",

padding:"15px",

borderRadius:"12px",

zIndex:10,

color:"#35205F"

}}



>

Выбрано:

<br/>

<b>

{hover}

</b>


</div>


}



</div>


);

}
