import { Line } from "@react-three/drei";

interface Props {
  features?: Array<{
    coordinates: number[][] | number[][][];
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

function normalizeCoordinates(coords:number[][]|number[][][]):number[][][]{
  if(!coords.length) return [];

  if(Array.isArray(coords[0]) && typeof coords[0][0] === "number") {
    return [coords as number[][]];
  }

  return (coords as number[][][]).filter((line) => line.length > 0);
}

export default function AntiqueContinentLayer({features=[]}:Props){
  return <>
    {features.map((feature,index)=>{
      const normalized=normalizeCoordinates(feature.coordinates);

      return normalized.map((line,i)=>(
        <Line
          key={`${index}-${i}`}
          points={line.map(([lng,lat])=>projectPoint(lat,lng))}
          color="#24150C"
          lineWidth={1}
          transparent
          opacity={0.55}
        />
      ));
    })}
  </>;
}
