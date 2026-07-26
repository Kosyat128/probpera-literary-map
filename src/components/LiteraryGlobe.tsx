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
  const co=c.coordinates;
  const lat=Array.isArray(co)?co[0]:co?.lat;
  const lng=Array.isArray(co)?co[1]:co?.lng;
  return {name:c.name,count:c.writers.length,position:geoToSphere(lat||0,lng||0),color:c.writers.length>=20?"#E97824":"#8B5CF6",size:.028+Math.min(c.writers.length/600,.04)};
 }),[]);
 return <>{markers.map(p=>{const focus=active===p.name||hovered===p.name;return <group key={p.name} position={p.position}>
  <mesh onClick={()=>{setActive(p.name);onCountrySelect?.(p.name)}} onPointerOver={()=>setHovered(p.name)} onPointerOut={()=>setHovered(null)}>
   <sphereGeometry args={[focus?p.size*2:p.size,32,32]}/>
   <meshStandardMaterial color={focus?"#FFB347":p.color} emissive={p.color} emissiveIntensity={focus?3:1.2}/>
  </mesh>
  {focus&&<Html distanceFactor={5} center><div style={{background:'#FFF8EE',color:'#35205F',border:`2px solid ${p.color}`,borderRadius:14,padding:'8px 14px',fontWeight:700,whiteSpace:'nowrap',boxShadow:'0 0 20px #E97824'}}>{p.name}<br/>📚 Авторов: {p.count}</div></Html>}
 </group>})}</>;
}

function GlobeBase(){return <Sphere args={[0.72,128,128]}><meshStandardMaterial color="#30204F" roughness={.7}/></Sphere>}
function GlobeGrid(){return <Sphere args={[0.724,96,96]}><meshStandardMaterial color="#E97824" wireframe transparent opacity={.12}/></Sphere>}
function Atmosphere(){return <Sphere args={[0.80,64,64]}><meshStandardMaterial color="#8B5CF6" transparent opacity={.12}/></Sphere>}
function Glow(){return <Sphere args={[0.86,64,64]}><meshBasicMaterial color="#E97824" transparent opacity={.04}/></Sphere>}

export default function LiteraryGlobe({onCountrySelect}:Props){
 return <div style={{width:'100%',height:'560px',background:'radial-gradient(circle,#35205F,#1F103D)',borderRadius:18,overflow:'hidden'}}>
  <Canvas camera={{position:[0,0,3.6],fov:36}}>
   <ambientLight intensity={1.7}/>
   <directionalLight position={[3,3,3]} intensity={2.5}/>
   <Glow/><GlobeBase/><GlobeGrid/><Atmosphere/>
   <LiteraryMarkers onCountrySelect={onCountrySelect}/>
   <OrbitControls enableZoom enablePan={false} autoRotate autoRotateSpeed={0.12} minDistance={2.3} maxDistance={5}/>
  </Canvas>
 </div>
}
