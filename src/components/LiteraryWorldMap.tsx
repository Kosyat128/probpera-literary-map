import { useEffect, useState } from "react";

import background from "../assets/map/literary-map-background.png";
import mapSvg from "../assets/map/literary-world-map.svg";


export default function LiteraryWorldMap(){


const [svg,setSvg]=useState("");



useEffect(()=>{


fetch(mapSvg)

.then(r=>r.text())

.then(data=>{


console.log("SVG загрузился");


console.log(

"PATH",

(data.match(/<path/g)||[]).length

);


console.log(

"GROUP",

(data.match(/<g/g)||[]).length

);


console.log(

"USE",

(data.match(/<use/g)||[]).length

);



setSvg(data);


});


},[]);





function click(e:any){


console.log(

"КЛИК",

e.target.tagName,

e.target.id,

e.target.className

);


}




return (

<div

onClick={click}

style={{

position:"relative",

height:"700px",

overflow:"hidden"

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
