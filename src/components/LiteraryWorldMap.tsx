import { useEffect, useRef, useState } from "react";

import background from "../assets/map/literary-map-background.png";
import svgMap from "../assets/map/literary-world-map.svg";

import { countries } from "../data/countries";



type LiteraryWorldMapProps = {

  selectedCountry?: string;

  onCountrySelect?: (country:string)=>void;

};



export default function LiteraryWorldMap({

  selectedCountry,

  onCountrySelect,

}: LiteraryWorldMapProps){



  const [svg,setSvg] = useState("");

  const [hover,setHover] = useState<any>(null);


  const containerRef = useRef<HTMLDivElement>(null);



  useEffect(()=>{


    fetch(svgMap)

      .then(res=>res.text())

      .then(data=>{

        setSvg(data);

      });


  },[]);





  function searchCountry(name:string){


    return countries.find(

      country =>

      country.name
      .toLowerCase()
      .includes(

        name.toLowerCase()

      )

    );


  }







  function handleMove(

    e:React.MouseEvent

  ){


    const target =
      e.target as SVGElement;



    const id =
      target.id;



    if(!id){

      setHover(null);

      return;

    }



    const country =
      searchCountry(id);



    if(country){

      setHover(country);

    }


  }







  function handleClick(){


    if(hover){


      onCountrySelect?.(

        hover.name

      );


    }


  }







return(


<div


ref={containerRef}


style={{


position:"relative",

width:"100%",

height:"700px",

overflow:"hidden",

borderRadius:"18px",

background:"#F7EBDD"


}}


>



{/* ФИРМЕННЫЙ ФОН */}


<img


src={background}


alt="Literary world map"


style={{


position:"absolute",

inset:0,

width:"100%",

height:"100%",

objectFit:"cover"


}}



/>






{/* SVG КАРТА */}



<div


dangerouslySetInnerHTML={{

__html:svg

}}


style={{


position:"absolute",

inset:0,

width:"100%",

height:"100%",


opacity:.55,


pointerEvents:"none"



}}



/>







{/* ИНТЕРАКТИВНЫЙ СЛОЙ */}



<div


onMouseMove={handleMove}


onClick={handleClick}


style={{


position:"absolute",

inset:0,

cursor:"pointer",


}}



>

</div>








{/* ОКНО */}



{

hover && (


<div


style={{


position:"absolute",

top:"30px",

left:"30px",

background:"#FFF8EE",

padding:"18px",

borderRadius:"15px",

width:"280px",

zIndex:20,

color:"#35205F",

boxShadow:

"0 10px 30px rgba(0,0,0,.2)"


}}


>


<h3>

{hover.name}

</h3>



<p>

📚 Писателей:

{" "}

<b>

{hover.writers?.length || 0}

</b>

</p>



<p>

Статей:

{" "}

{hover.articles || 0}

</p>



</div>



)

}





</div>


);


}
