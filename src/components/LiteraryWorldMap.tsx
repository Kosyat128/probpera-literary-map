import { useEffect, useState } from "react";

import background from "../assets/map/literary-map-background.png";
import mapSvg from "../assets/map/literary-world-map.svg";


export default function LiteraryWorldMap() {


  const [svg, setSvg] = useState("");



  useEffect(() => {

    fetch(mapSvg)

      .then(response => response.text())

      .then(data => {

        setSvg(data);

      });


  }, []);





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



      {/* ФОН */}

      <img

        src={background}

        alt="Literary map"

        style={{

          position:"absolute",

          inset:0,

          width:"100%",

          height:"100%",

          objectFit:"cover"

        }}

      />




      {/* SVG */}

      <div

        style={{

          position:"absolute",

          inset:0,

          width:"100%",

          height:"100%"

        }}


        dangerouslySetInnerHTML={{

          __html:svg

        }}


      />


    </div>

  );

}
