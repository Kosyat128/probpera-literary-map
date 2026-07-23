import background from "../assets/map/literary-map-background.png";
import svgMap from "../assets/map/literary-world-map.svg";
import { useEffect, useState } from "react";


export default function LiteraryWorldMap(){

const [svg,setSvg]=useState("");



useEffect(()=>{

fetch(svgMap)

.then(res=>res.text())

.then(data=>{

setSvg(data);

});


},[]);



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
width:"100%",
height:"100%",
objectFit:"cover"

}}


/>


<div

style={{

position:"absolute",
inset:0

}}

dangerouslySetInnerHTML={{

__html:svg

}}


/>


</div>

);

}
