import { useEffect, useState } from "react";

import background from "../assets/map/literary-map-background.png";
import mapSvg from "../assets/map/literary-world-map.svg";


type LiteraryWorldMapProps = {

  onCountrySelect?: (country:string)=>void;

};



export default function LiteraryWorldMap({

  onCountrySelect

}: LiteraryWorldMapProps) {



  const [svg,setSvg] = useState("");

  const [hover,setHover] = useState("");





  useEffect(()=>{


    fetch(mapSvg)

      .then(response => response.text())

      .then(data => {


        let fixed = data

          .replace(

            /<svg([^>]*)>/,

            `<svg$1 
              preserveAspectRatio="xMidYMid meet"
              style="width:100%;height:100%;"
            >`

          );



        setSvg(fixed);


      });


  },[]);







  function handleMouseMove(

    e:React.MouseEvent<HTMLDivElement>

  ){


    const target = e.target as SVGElement;



    if(target.tagName==="path"){


      const id = target.id;


      if(id){

        setHover(id);

      }


    }


  }







  function handleClick(){


    if(hover){


      console.log(

        "Нажата область SVG:",

        hover

      );


      onCountrySelect?.(hover);


    }


  }








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







      {/* ФОН PNG */}


      <img


        src={background}


        alt="literary world map"


        style={{


          position:"absolute",

          inset:0,

          width:"100%",

          height:"100%",

          objectFit:"cover",

          zIndex:1


        }}


      />








      {/* SVG СЛОЙ */}


      <div


        onMouseMove={handleMouseMove}


        onClick={handleClick}


        style={{


          position:"absolute",

          inset:0,

          width:"100%",

          height:"100%",

          zIndex:2,

          cursor:"pointer"


        }}


        dangerouslySetInnerHTML={{


          __html:svg


        }}



      />








      {/* ОКНО ПРОВЕРКИ */}



      {

        hover &&


        <div


          style={{


            position:"absolute",

            top:"20px",

            left:"20px",

            background:"#FFF8EE",

            color:"#35205F",

            padding:"15px",

            borderRadius:"12px",

            zIndex:5,

            boxShadow:"0 5px 20px rgba(0,0,0,.2)"


          }}



        >


          SVG объект:


          <br/>


          <b>

            {hover}

          </b>


        </div>


      }





    </div>



  );

}
