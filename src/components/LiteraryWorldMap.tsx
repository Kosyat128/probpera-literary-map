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

      .then(response=>response.text())

      .then(data=>{


        const fixed = data.replace(

          /<svg([^>]*)>/,

          `<svg$1 
          preserveAspectRatio="xMidYMid meet"
          style="width:100%;height:100%;position:absolute;left:0;top:0;"
          >`

        );


        setSvg(fixed);


      });


  },[]);








  useEffect(()=>{


    if(!mapRef.current) return;


    const paths =

      mapRef.current.querySelectorAll("path");



    console.log(

      "Найдено стран:",

      paths.length

    );





    paths.forEach((path)=>{



      const element = path as SVGPathElement;




      element.addEventListener(

        "mouseenter",

        ()=>{


          element.style.fill = "#E97824";

          element.style.opacity = "0.85";

          element.style.cursor = "pointer";


          setActive(

            element.id || "unknown"

          );


        }

      );







      element.addEventListener(

        "mouseleave",

        ()=>{


          element.style.fill = "";

          element.style.opacity = "";


          setActive("");


        }

      );







      element.addEventListener(

        "click",

        ()=>{


          console.log(

            "Выбрано:",

            element.id

          );



          onCountrySelect?.(

            element.id

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





      {/* ФОН */}

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








      {/* SVG */}

      <div


        ref={mapRef}


        style={{

          position:"absolute",

          inset:0,

          width:"100%",

          height:"100%",

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

            left:"20px",

            top:"20px",

            zIndex:10,

            background:"#FFF8EE",

            padding:"15px 20px",

            borderRadius:"12px",

            color:"#35205F",

            boxShadow:"0 5px 20px rgba(0,0,0,.2)"

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


  );

}
