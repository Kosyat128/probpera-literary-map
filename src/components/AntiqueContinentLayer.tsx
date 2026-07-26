import { Line } from "@react-three/drei";

interface Props {
  features?: Array<{
    coordinates: number[][];
  }>;
}

function projectPoint(lat:number,lng:number,radius=0.742):[number,number,number]{
  const phi=(90-lat)*Math.PI/180;
  const theta=(lng+180)*Math.PI/180;
  return [
    -radius*Math.sin(phi)*Math.cos(theta),
    radius*Math.cos(phi),
    radius*Math.sin(phi)*Math.sin(theta)
  ];
}

export default function AntiqueContinentLayer({features=[]}:Props){
 return <>
  {features.map((feature,index)=>(
    <Line
      key={index}
      points={feature.coordinates.map(([lng,lat])=>projectPoint(lat,lng))}
      color="#24150C"
      lineWidth={1}
      transparent
      opacity={0.55}
    />
  ))}
 </>;
}
