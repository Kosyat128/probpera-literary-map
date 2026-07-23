import { useEffect, useState } from "react";

import background from "../assets/map/literary-map-background.png";
import mapSvg from "../assets/map/literary-world-map.svg";


type Props = {
  onCountrySelect?: (country:string)=>void;
};


export default function LiteraryWorldMap({

  onCountrySelect

}:Props){


const [svg,setSvg]=useState("");

const [active,setActive]=useState("");





useEffect(()=>{


fetch(mapSvg)

.then(r=>r.text())

.then(data=>{


let fixed = data.replace(

"<svg",

`<svg
style="width:100%;height:100%;"
preserveAspectRatio="none"`

);



setSvg(fixed);


});


},[]);








function move(e:any){


const target=e.target;


if(target.tagName==="path"){


target.classList.add("active-country");


setActive(

target.id || "path"

);


}



}








function leave(e:any){


const target=e.target;


if(target.tagName==="path"){


target.classList.remove(

"active-country"

);


}



}





function click(e:any){


const target=e.target;


if(target.tagName==="path"){


console.log(

"PATH",

target.id

);



onCountrySelect?.(

target.id

);


}


}





return (

<div

style={{

position:"relative",

height:"700px",

overflow:"hidden",

borderRadius:"18px"

}}

>



<style>

{`

.active-country{

fill:#E97824 !important;

opacity:.8;

cursor:pointer;

}

path{

transition:.2s;

}

`}

</style>




<img

src={background}

alt="map"

style={{

position:"absolute",

inset:0,

width:"100%",

height:"100%",

objectFit:"cover"

}}


/>






<div

onMouseMove={move}

onMouseLeave={leave}

onClick={click}


style={{

position:"absolute",

inset:0,

zIndex:2

}}



dangerouslySetInnerHTML={{

__html:svg

}}


/>






<div

style={{

position:"absolute",

top:20,

left:20,

zIndex:5,

background:"#FFF8EE",

padding:"15px",

borderRadius:"12px",

color:"#35205F"

}}

>

{

active &&

<>

SVG объект:

<br/>

<b>{active}</b>

</>

}


</div>



</div>


);


}
