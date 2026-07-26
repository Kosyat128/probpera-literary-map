import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

interface Props {
  country?: string | null;
  coordinates?: [number, number] | null;
}

function geoToCameraPosition(lat:number,lng:number,radius=3.2):THREE.Vector3 {
  const phi=(90-lat)*Math.PI/180;
  const theta=(lng+180)*Math.PI/180;

  return new THREE.Vector3(
    -radius*Math.sin(phi)*Math.cos(theta),
    radius*Math.cos(phi),
    radius*Math.sin(phi)*Math.sin(theta)
  );
}

export default function GlobeCountryFocus({ country, coordinates }: Props) {
  const { camera } = useThree();

  useEffect(() => {
    if (!country || !coordinates) return;

    const [lat,lng]=coordinates;
    const target=geoToCameraPosition(lat,lng);

    camera.position.lerp(target,0.25);
    camera.lookAt(0,0,0);
    camera.updateProjectionMatrix();
  }, [country, coordinates, camera]);

  return null;
}
