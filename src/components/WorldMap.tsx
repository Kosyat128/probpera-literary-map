import {
  MapContainer,
  Marker,
  TileLayer,
  Popup,
  useMap,
} from "react-leaflet";

import { useEffect } from "react";

import type { LatLngExpression } from "leaflet";

import L from "leaflet";

import { countries } from "../data/countries";



export type WorldMapProps = {
  selectedCountry?: string;
  onCountrySelect?: (country: string) => void;
};



const countryIcon = new L.Icon({

  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",

  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",

  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",

  iconSize: [25, 41],

  iconAnchor: [12, 41],

  popupAnchor: [1, -34],

  shadowSize: [41, 41],

});



function normalizeCoordinates(

  coordinates:
    | [number, number]
    | {
        lat: number;
        lng: number;
      }
    | undefined

): [number, number] {


  if (!coordinates) {

    return [0, 0];

  }


  if (Array.isArray(coordinates)) {

    return coordinates;

  }


  return [

    coordinates.lat,

    coordinates.lng

  ];

}




function Recenter({

  center,

}: {

  center: LatLngExpression;

}) {


  const map = useMap();


  useEffect(() => {

    map.setView(center, 3);

  }, [center, map]);


  return null;

}





export default function WorldMap({

  selectedCountry = "Франция",

  onCountrySelect,

}: WorldMapProps) {



  if (!countries.length) {

    return (

      <div>

        База стран не загружена

      </div>

    );

  }



  const activeCountry =

    countries.find(

      (country) =>

        country.name === selectedCountry

    ) ?? countries[0];



  const activeCoordinates = normalizeCoordinates(

    activeCountry.coordinates

  );





  return (

    <section

      style={{

        flex: 1,

        padding: "1rem",

        minWidth: 0,

        height: "calc(100vh - 80px)",

      }}

    >



      <MapContainer


        center={activeCoordinates}


        zoom={3}


        scrollWheelZoom={true}


        style={{

          height: "100%",

          width: "100%",

          minHeight: "700px",

          borderRadius: "14px",

          overflow: "hidden",

        }}

      >



        <Recenter

          center={activeCoordinates}

        />




        <TileLayer


          attribution="© OpenStreetMap contributors"


          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"


        />





        {

          countries.map((country) => {


            const coordinates = normalizeCoordinates(

              country.coordinates

            );



            return (

              <Marker


                key={country.id}


                position={coordinates}


                icon={countryIcon}



                eventHandlers={{


                  click: () => {


                    onCountrySelect?.(

                      country.name

                    );


                  },


                }}


              >



                <Popup>


                  <div

                    style={{

                      minWidth: "120px",

                    }}

                  >


                    <strong>

                      {country.name}

                    </strong>


                    <br />


                    Писателей:

                    {" "}

                    {country.writers.length}


                  </div>


                </Popup>



              </Marker>

            );


          })

        }



      </MapContainer>



    </section>

  );

}
