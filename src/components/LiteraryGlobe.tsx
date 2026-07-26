import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls, Sphere } from "@react-three/drei";
import { useEffect, useMemo, useState } from "react";
import { countries } from "../data/countries";
import { worldContours, setWorldContours } from "../data/worldContours";
import { parseWorldContours } from "../data/loadWorldContours";
import AntiqueContinentLayer from "./AntiqueContinentLayer";
import GlobeCountryFocus from "./GlobeCountryFocus";

interface Props { onCountrySelect?: (name:string)=>void; }

function geoToSphere(lat:number,lng:number,radius=0.78):[number,number,number]{
 const phi=(90-lat)*Math.PI/180;
 const theta=(lng+180)*Math.PI/180;
 return [-radius*Math.sin(phi)*Math.cos(theta),radius*Math.cos(phi),radius*Math.sin(phi)*Math.sin(theta)];
}

function LiteraryMarkers({onCountrySelect}:Props){
 const [active,setActive]=useState<string|null>(null);
 const [hovered,setHovered]=useState<string|null>(null);
 const markers=useMemo(()=>countries.filter(c=>c.coordinates&&c.writers.length>0).map(c=>{
  const co=c.coordinates; const lat=Array.isArray(co)?co[0]:co?.lat; const lng=Array.isArray(co)?co[1]:co?.lng;
  return {name:c.name,count:c.writers.length,position:geoToSphere(lat||0,lng||0),color:c.writers.length>=20?"#D66A1F":"#6B3FA0",size:.026+Math.min(c.writers.length/700,.038)};
 }),[]);
 return <>{markers.map(p=>{const focus=active===p.name||hovered===p.name;return <group key={p.name} position={p.position}>
 <mesh onClick={()=>{setActive(p.name);onCountrySelect?.(p.name)}} onPointerOver={()=>setHovered(p.name)} onPointerOut={()=>setHovered(null)}><sphereGeometry args={[focus?p.size*2.5:p.size,32,32]}/><meshStandardMaterial color={focus?"#F3B24D":p.color} emissive={p.color} emissiveIntensity={focus?4:1}/></mesh>
 {focus&&<Html center><div style={{background:'#F7EBD8',color:'#35205F',border:'2px solid #D66A1F',borderRadius:12,padding:'10px 14px',fontWeight:700}}>🌍 {p.name}<br/>📚 Авторов: {p.count}</div></Html>}
 </group>})}</>;
}

function AntiqueGlobe(){return <Sphere args={[0.72,128,128]}><meshStandardMaterial color="#7A5A32" roughness={1}/></Sphere>}
function ParchmentSurface(){return <Sphere args={[0.724,128,128]}><meshStandardMaterial color="#D2B47C" transparent opacity={.22} roughness={1}/></Sphere>}
function OldAtlasInk(){return <Sphere args={[0.728,96,96]}><meshStandardMaterial color="#3D2412" wireframe transparent opacity={.1}/></Sphere>}
function AntiqueContinents(){return <Sphere args={[0.731,128,128]}><meshStandardMaterial color="#5A3B20" transparent opacity={.11} roughness={1}/></Sphere>}
function ContinentInk(){return <Sphere args={[0.733,128,128]}><meshBasicMaterial color="#24150C" transparent opacity={.04}/></Sphere>}
function HistoricalMapLines(){return <Sphere args={[0.735,96,96]}><meshBasicMaterial color="#4A2A16" wireframe transparent opacity={.035}/></Sphere>}
function SeaRoutes(){return <Sphere args={[0.737,96,96]}><meshStandardMaterial color="#D66A1F" wireframe transparent opacity={.02}/></Sphere>}
function CompassLayer(){return <Sphere args={[0.739,64,64]}><meshBasicMaterial color="#3D2412" wireframe transparent opacity={.025}/></Sphere>}
function AntiqueFrame(){return <Sphere args={[0.79,64,64]}><meshBasicMaterial color="#D66A1F" transparent opacity={.01}/></Sphere>}
function AntiqueGlow(){return <Sphere args={[0.745,64,64]}><meshBasicMaterial color="#D66A1F" transparent opacity={.025}/></Sphere>}
function Atmosphere(){return <Sphere args={[0.82,64,64]}><meshBasicMaterial color="#35205F" transparent opacity={.12}/></Sphere>}

export default function LiteraryGlobe({onCountrySelect}:Props){
 useEffect(()=>{
  fetch('/data/geo/countries.geojson')
   .then(response=>response.json())
   .then(data=>setWorldContours(parseWorldContours(data)))
   .catch(()=>{});
 },[]);

 return <div style={{width:'100%',height:'560px',background:'radial-gradient(circle,#35205F,#1F103D)',borderRadius:18,overflow:'hidden'}}>
 <Canvas camera={{position:[0,0,3.45],fov:35}}>
  <ambientLight intensity={2}/><directionalLight position={[4,3,4]} intensity={2.5}/>
  <AntiqueFrame/><AntiqueGlow/><AntiqueGlobe/><ParchmentSurface/><AntiqueContinents/><ContinentInk/><HistoricalMapLines/><OldAtlasInk/><SeaRoutes/><CompassLayer/><Atmosphere/>
  <AntiqueContinentLayer features={worldContours}/>
  <LiteraryMarkers onCountrySelect={onCountrySelect}/>
  <GlobeCountryFocus />
  <OrbitControls enableZoom enablePan={false} autoRotate autoRotateSpeed={0.06}/>
 </Canvas>
 </div>
}