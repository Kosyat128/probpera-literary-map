import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls, Sphere } from "@react-three/drei";
import { useMemo, useState } from "react";
import { countries } from "../data/countries";

interface Props { onCountrySelect?: (name: string) => void; }

function geoToSphere(lat:number,lng:number,radius=1.08):[number,number,number]{
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
  return {name:c.name,count:c.writers.length,position:geoToSphere(lat||0,lng||0),color:c.writers.length>=20?"#E97824":"#35205F",size:.05+Math.min(c.writers.length/350,.07)};
 }),[]);
 return <>{markers.map(p=>{const focus=active===p.name||hovered===p.name;return <group key={p.name} position={p.position}>
 <mesh onClick={()=>{setActive(p.name);onCountrySelect?.(p.name)}} onPointerOver={()=>setHovered(p.name)} onPointerOut={()=>setHovered(null)}>
 <sphereGeometry args={[focus?p.size*1.5:p.size,48,48]}/>
 <meshStandardMaterial color={focus?"#F6B04A":p.color} emissive={p.color} emissiveIntensity={focus?2.6:1.2}/>
 </mesh>
 {focus&&<Html distanceFactor={6} center><div style={{background:"#FFF8EE",color:"#35205F",border:`2px solid ${p.color}`,borderRadius:20,padding:"10px 16px",fontWeight:700,boxShadow:"0 14px 35px rgba(0,0,0,.4)",whiteSpace:"nowrap"}}>{p.name}<br/>📚 {p.count} писателей</div></Html>}
 </group>})}</>;
}

function GlobeBase(){return <Sphere args={[1,128,128]}><meshStandardMaterial color="#C8A96A" roughness={.92}/></Sphere>}
function GlobeGrid(){return <Sphere args={[1.005,64,64]}><meshStandardMaterial color="#7A5420" wireframe transparent opacity={.08}/></Sphere>}
function AntiqueGlow(){return <Sphere args={[1.06,64,64]}><meshStandardMaterial color="#F2D39A" transparent opacity={.06}/></Sphere>}
function OuterAtmosphere(){return <Sphere args={[1.14,64,64]}><meshStandardMaterial color="#35205F" transparent opacity={.08}/></Sphere>}
function DepthRing(){return <Sphere args={[1.16,32,32]}><meshStandardMaterial color="#E97824" wireframe transparent opacity={.03}/></Sphere>}
function NavigationHalo(){return <Sphere args={[1.19,48,48]}><meshStandardMaterial color="#E97824" transparent wireframe opacity={.025}/></Sphere>}

export default function LiteraryGlobe({onCountrySelect}:Props){return <div style={{width:"100%",height:"760px",background:"#1F103D",borderRadius:18,overflow:"hidden"}}>
<Canvas camera={{position:[0,0,3.2],fov:42}}>
<ambientLight intensity={1.4}/><directionalLight position={[3,3,3]} intensity={2.5}/><pointLight position={[-3,2,3]} intensity={1.7}/>
<GlobeBase/><GlobeGrid/><AntiqueGlow/><OuterAtmosphere/><DepthRing/><NavigationHalo/><LiteraryMarkers onCountrySelect={onCountrySelect}/>
<OrbitControls enableZoom enablePan={false} autoRotate autoRotateSpeed={.25} minDistance={2.2} maxDistance={5}/>
</Canvas></div>}