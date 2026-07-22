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
  onCountrySelect?: (country:string)=>void;
};

function normalizeCoordinates(
 coordinates:
 | [number,number]
 | {lat:number;lng:number}
 | undefined
):[number,number]{
 if(!coordinates) return [0,0];
 if(Array.isArray(coordinates)) return coordinates;
 return [coordinates.lat,coordinates.lng];
}

function createLiteraryIcon(writers:number){
 const size=Math.min(45+writers,90);
 return new L.DivIcon({
  className:"literary-marker",
  html:`<div style="
   width:${size}px;
   height:${size}px;
   border-radius:50%;
   background:#35205F;
   border:3px solid #E97824;
   color:white;
   display:flex;
   align-items:center;
   justify-content:center;
   font-size:18px;
   font-weight:bold;
   box-shadow:0 0 20px rgba(233,120,36,.7);
  ">${writers}</div>`,
  iconSize:[size,size],
  iconAnchor:[size/2,size/2]
 });
}

function Recenter({center}:{center:LatLngExpression}){
 const map=useMap();
 useEffect(()=>{
  map.setView(center,3);
 },[center,map]);
 return null;
}

export default function WorldMap({
 selectedCountry="Франция",
 onCountrySelect,
}:WorldMapProps){

 if(!countries.length) return <div>База стран не загружена</div>;

 const activeCountry=countries.find(c=>c.name===selectedCountry) ?? countries[0];
 const activeCoordinates=normalizeCoordinates(activeCountry.coordinates);

 return (
  <section style={{
   flex:1,
   height:"620px",
   padding:"10px",
   minWidth:0
  }}>

   <MapContainer
    center={activeCoordinates}
    zoom={3}
    scrollWheelZoom={true}
    style={{
     height:"100%",
     width:"100%",
     minHeight:"620px",
     borderRadius:"18px",
     overflow:"hidden"
    }}
   >

    <Recenter center={activeCoordinates}/>

    <TileLayer
     attribution="© OpenStreetMap contributors"
     url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    />

    {countries.map(country=>{
     const coordinates=normalizeCoordinates(country.coordinates);

     return <Marker
      key={country.id}
      position={coordinates}
      icon={createLiteraryIcon(country.writers.length)}
      eventHandlers={{
       click:()=>onCountrySelect?.(country.name)
      }}
     >
      <Popup>
       <div style={{minWidth:"180px"}}>
        <h3 style={{color:"#35205F"}}>{country.name}</h3>
        <p>✒️ Писателей: <b>{country.writers.length}</b></p>
        <p>📚 Литературная база</p>
       </div>
      </Popup>
     </Marker>
    })}

   </MapContainer>
  </section>
 );
}
