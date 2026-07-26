import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls, Sphere } from "@react-three/drei";
import { useMemo, useState } from "react";
import { countries } from "../data/countries";

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
  return {name:c.name,count:c.writers.length,position:geoToSphere(lat||0,lng||0),color:c.writers.length>=20?"#E97824":"#8B5CF6",size:.026+Math.min(c.writers.length/700,.038)};
 }),[]);
 return <>{markers.map(p=>{const focus=active===p.name||hovered===p.name;return <group key={p.name} position={p.position}>
  <mesh onClick={()=>{setActive(p.name);onCountrySelect?.(p.name)}} onPointerOver={()=>setHovered(p.name)} onPointerOut={()=>setHovered(null)}>
   <sphereGeometry args={[focus?p.size*2.5:p.size,32,32]}/><meshStandardMaterial color={focus?"#FFD166":p.color} emissive={p.color} emissiveIntensity={focus?5:1.5}/>
  </mesh>
  {focus&&<Html center><div style={{background:'#FFF8EE',color:'#35205F',border:'2px solid #E97824',borderRadius:16,padding:10,fontWeight:700}}>🌍 {p.name}<br/>📚 Авторов: {p.count}</div></Html>}
 </group>})}</>;
}

function GlobeBase(){return <Sphere args={[0.72,128,128]}><meshStandardMaterial color="#17233B" roughness={.8}/></Sphere>}
function GlobeSurface(){return <Sphere args={[0.724,128,128]}><meshStandardMaterial color="#31476B" transparent opacity={.34}/></Sphere>}
function GlobeGrid(){return <Sphere args={[0.727,96,96]}><meshStandardMaterial color="#E97824" wireframe transparent opacity={.045}/></Sphere>}
function Atmosphere(){return <Sphere args={[0.82,64,64]}><meshBasicMaterial color="#8B5CF6" transparent opacity={.16}/></Sphere>}
function LiteraryRegions(){return <Sphere args={[0.735,64,64]}><meshBasicMaterial color="#E97824" transparent opacity={.025}/></Sphere>}

export default function LiteraryGlobe({onCountrySelect}:Props){
 return <div style={{width:'100%',height:'560px',background:'radial-gradient(circle,#35205F,#1F103D)',borderRadius:18,overflow:'hidden'}}>
  <Canvas camera={{position:[0,0,3.45],fov:35}}>
   <ambientLight intensity={2}/><directionalLight position={[4,3,4]} intensity={3}/>
   <GlobeBase/><GlobeSurface/><LiteraryRegions/><GlobeGrid/><Atmosphere/>
   <LiteraryMarkers onCountrySelect={onCountrySelect}/>
   <OrbitControls enableZoom enablePan={false} autoRotate autoRotateSpeed={0.08}/>
  </Canvas>
 </div>
}
