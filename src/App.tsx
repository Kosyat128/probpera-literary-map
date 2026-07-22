import { useState } from "react";

import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import WorldMap from "./components/WorldMap";
import WriterPanel from "./components/WriterPanel";

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
    countryName: string
  ) => {


    const country = countries.find(
      (item) =>
        item.name === countryName
    );


    if (country) {

      setSelectedCountry(country);

    }

  };



  return (

    <>

      <Header title="LiteraryMap" />


      <div

        style={{

          display: "flex",

          height: "calc(100vh - 80px)",

        }}

      >


        <Sidebar


          items={
            countries.map(
              (country) =>
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



        <WorldMap


          selectedCountry={
            selectedCountry.name
          }


          onCountrySelect={
            handleCountrySelect
          }


        />



        <WriterPanel

          country={
            selectedCountry
          }

        />


      </div>


    </>

  );

}
