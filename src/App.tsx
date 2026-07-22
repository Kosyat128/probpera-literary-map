import { useState } from "react";

import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import WorldMap from "./components/WorldMap";
import WriterPanel from "./components/WriterPanel";
import Timeline from "./components/Timeline";
import LiteraryPlaces from "./components/LiteraryPlaces";

import { countries } from "./data/countries";

import type { Country } from "./data/types";



export default function App() {


  const [selectedCountry, setSelectedCountry] =
    useState<Country | null>(
      countries[0] ?? null
    );



  if (!selectedCountry) {

    return (
      <div>
        База стран не загружена
      </div>
    );

  }




  const handleCountrySelect = (
    countryName:string
  ) => {


    const country = countries.find(

      item =>
      item.name === countryName

    );


    if(country){

      setSelectedCountry(country);

    }

  };





  return (

    <div

      style={{

        minHeight:"100vh",

        background:"#F7EBDD",

        display:"flex",

        flexDirection:"column",

      }}

    >



      <Header

        title="LiteraryMap"

      />





      <div

        style={{

          display:"grid",

          gridTemplateColumns:

          "220px 1fr 360px",

          gap:"12px",

          flex:1,

          padding:"12px",

        }}

      >





        <Sidebar


          items={

            countries.map(

              country =>
              country.name

            )

          }


          selectedItem={

            selectedCountry.name

          }


          onSelect={

            handleCountrySelect

          }


        />







        <main

          style={{

            display:"flex",

            flexDirection:"column",

            gap:"12px",

          }}

        >



          <WorldMap


            selectedCountry={

              selectedCountry.name

            }


            onCountrySelect={

              handleCountrySelect

            }


          />



          <Timeline


            name={

              selectedCountry.writers[0]?.name

            }


            years={

              selectedCountry.writers[0]?.years

            }


          />




          <LiteraryPlaces />



        </main>







        <WriterPanel


          country={

            selectedCountry

          }


        />




      </div>


    </div>

  );

}
