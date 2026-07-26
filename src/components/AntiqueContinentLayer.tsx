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

function normalizeCoordinates(coords:number[][]|number[][][]){
  if(!coords.length) return [];

  // Polygon: берём внешний контур
  if(Array.isArray(coords[0]) && typeof coords[0][0] === "number") {
    return coords as number[][];
  }

  // MultiPolygon: внешний контур каждого полигона
  return (coords as number[][][]).map(polygon => polygon[0]).filter(Boolean);
}

export default function AntiqueContinentLayer({features=[]}:Props){
  return <>
    {features.map((feature,index)=>{
      const normalized=normalizeCoordinates(feature.coordinates);

      if(normalized.length && Array.isArray(normalized[0][0])){
        return (normalized as number[][][]).map((line,i)=>(
          <Line
            key={`${index}-${i}`}
            points={line.map(([lng,lat])=>projectPoint(lat,lng))}
            color="#24150C"
            lineWidth={1}
            transparent
            opacity={0.55}
          />
        ));
      }

      return <Line
        key={index}
        points={(normalized as number[][]).map(([lng,lat])=>projectPoint(lat,lng))}
        color="#24150C"
        lineWidth={1}
        transparent
        opacity={0.55}
      />;
    })}
  </>;
}
