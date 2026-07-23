import { useEffect, useState } from "react";

import background from "../assets/map/literary-map-background.png";
import svgMap from "../assets/map/literary-world-map.svg";

import { literaryCountries } from "../data/literaryMap/countries";


type LiteraryWorldMapProps = {

  selectedCountry?: string;

  onCountrySelect?: (country: string) => void;

};



export default function LiteraryWorldMap({

  selectedCountry,

  onCountrySelect,

}: LiteraryWorldMapProps) {



  const [svgContent, setSvgContent] = useState("");

  const [hoverCountry, setHoverCountry] = useState<any>(null);





  useEffect(() => {


    fetch(svgMap)

      .then(response => response.text())

      .then(svg => {


        setSvgContent(svg);


      });


  }, []);






  function findCountry(id:string){


    const country = literaryCountries.find(

      item =>

      item.id.toLowerCase() === id.toLowerCase()

    );


    return country;


  }







  function handleMouseMove(

    event:React.MouseEvent<HTMLDivElement>

  ){



    const element =

      event.target as SVGElement;




    const id = element.id;



    if(!id){

      setHoverCountry(null);

      return;

    }





    const country = findCountry(id);



    if(country){

      setHoverCountry(country);

    }


  }








  function handleClick(

    event:React.MouseEvent<HTMLDivElement>

  ){



    const element =

      event.target as SVGElement;



    const id = element.id;



    const country = findCountry(id);



    if(country){

      onCountrySelect?.(

        country.name

      );

    }



  }








  return (



    <div


      style={{


        position:"relative",

        width:"100%",

        height:"700px",

        overflow:"hidden",

        borderRadius:"18px",

        background:"#F7EBDD",


      }}


    >





      {/* ФОН ПРОБА ПЕРА */}


      <img


        src={background}


        alt="Literary Map"


        style={{


          position:"absolute",

          width:"100%",

          height:"100%",

          objectFit:"cover",


        }}


      />








      {/* SVG СТРАНЫ */}



      <div



        onMouseMove={handleMouseMove}


        onMouseLeave={()=>

          setHoverCountry(null)

        }


        onClick={handleClick}


        dangerouslySetInnerHTML={{

          __html:svgContent

        }}


        style={{


          position:"absolute",

          inset:0,


          cursor:"pointer",



        }}



      />








      {/* ОКНО ПРИ НАВЕДЕНИИ */}



      {hoverCountry && (



        <div


          style={{


            position:"absolute",

            top:"30px",

            left:"30px",

            background:"#FFF8EE",

            padding:"18px",

            borderRadius:"15px",

            width:"260px",

            color:"#35205F",

            boxShadow:

            "0 10px 30px rgba(0,0,0,.15)",



            zIndex:10,


          }}



        >



          <h3>

            {hoverCountry.name}

          </h3>



          <p>

            Писателей:

            {" "}

            <b>

            {hoverCountry.writersCount}

            </b>

          </p>



          <p>

            Статей:

            {" "}

            {hoverCountry.articlesCount}

          </p>




          <hr />



          <b>

          Известные авторы:

          </b>



          {

          hoverCountry.famousAuthors

          ?.slice(0,3)

          .map(

            (writer:string)=>(

              <div key={writer}>

                • {writer}

              </div>

            )

          )

          }



        </div>


      )}







    </div>


  );

}
