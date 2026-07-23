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

      .then(res=>res.text())

      .then(data=>{


        let clean = data;


        /*
          Убираем размеры SVG,
          которые ломают совпадение
        */


        clean = clean.replace(

          /width="[^"]*"/g,

          ""

        );


        clean = clean.replace(

          /height="[^"]*"/g,

          ""

        );



        clean = clean.replace(

          "<svg",

          `<svg 
          width="100%"
          height="100%"
          preserveAspectRatio="none"
          `

        );



        setSvg(clean);


      });


  },[]);








  useEffect(()=>{


    if(!mapRef.current) return;


    const paths =

      mapRef.current.querySelectorAll("path");



    console.log(

      "SVG PATH:",

      paths.length

    );





    paths.forEach((path)=>{


      const item = path as SVGPathElement;



      item.style.transition = "0.2s";





      item.addEventListener(

        "mouseenter",

        ()=>{


          item.style.fill="#E97824";

          item.style.opacity="0.8";

          item.style.cursor="pointer";


          setActive(

            item.id || "path"

          );


        }

      );





      item.addEventListener(

        "mouseleave",

        ()=>{


          item.style.fill="";

          item.style.opacity="";


          setActive("");


        }

      );





      item.addEventListener(

        "click",

        ()=>{


          console.log(

            "CLICK:",

            item.id

          );


          onCountrySelect?.(

            item.id

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





      {/* BACKGROUND PNG */}


      <img

        src={background}

        alt="literary map"

        style={{

          position:"absolute",

          left:0,

          top:0,

          width:"100%",

          height:"100%",

          objectFit:"fill",

          zIndex:1

        }}

      />







      {/* SVG OVERLAY */}


      <div


        ref={mapRef}


        style={{

          position:"absolute",

          left:0,

          top:0,

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

            top:"20px",

            left:"20px",

            zIndex:5,

            background:"#FFF8EE",

            color:"#35205F",

            padding:"15px",

            borderRadius:"12px"

          }}



        >

          Выбрано:

          <br/>

          <b>

          {active}

          </b>


        </div>


      }



    </div>

  );


}
