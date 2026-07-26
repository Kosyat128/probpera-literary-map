import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls, Sphere } from "@react-three/drei";
import { useMemo } from "react";
import { countries } from "../data/countries";

interface Props {
  onCountrySelect?: (name: string) => void;
}

function geoToSphere(lat: number, lng: number, radius = 1.08) {
  const phi = (90 - lat) * Math.PI / 180;
  const theta = (lng + 180) * Math.PI / 180;

  return [
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  ] as [number, number, number];
}

function LiteraryMarkers({ onCountrySelect }: Props) {
  const markers = useMemo(() => countries
    .filter((country) => country.coordinates && country.writers.length > 0)
    .map((country) => {
      const coordinates = country.coordinates;
      const lat = Array.isArray(coordinates) ? coordinates[0] : coordinates?.lat;
      const lng = Array.isArray(coordinates) ? coordinates[1] : coordinates?.lng;
      const count = country.writers.length;

      return {
        name: country.name,
        count,
        position: geoToSphere(lat || 0, lng || 0),
        color: count >= 20 ? "#E97824" : "#35205F",
        size: 0.05 + Math.min(count / 350, 0.07),
      };
    }), []);

  return <>
    {markers.map((point) => (
      <group key={point.name} position={point.position}>
        <mesh onClick={() => onCountrySelect?.(point.name)}>
          <sphereGeometry args={[point.size, 32, 32]} />
          <meshStandardMaterial color={point.color} emissive={point.color} emissiveIntensity={1.2} />
        </mesh>
        <Html distanceFactor={7} center>
          <div style={{
            background: "rgba(255,248,238,.95)",
            color: "#35205F",
            border: `2px solid ${point.color}`,
            borderRadius: "20px",
            padding: "5px 12px",
            fontSize: "12px",
            fontWeight: 700,
            boxShadow: "0 5px 16px rgba(0,0,0,.25)",
            whiteSpace: "nowrap"
          }}>
            {point.name}<br />📚 {point.count}
          </div>
        </Html>
      </group>
    ))}
  </>;
}

function GlobeGrid() {
  return (
    <Sphere args={[1.005, 48, 48]}>
      <meshStandardMaterial
        color="#8C6A32"
        wireframe
        transparent
        opacity={0.08}
      />
    </Sphere>
  );
}

export default function LiteraryGlobe({ onCountrySelect }: Props) {
  return (
    <div style={{
      width: "100%",
      height: "760px",
      background: "#1F103D",
      borderRadius: 18,
      overflow: "hidden"
    }}>
      <Canvas camera={{ position: [0, 0, 3.2] }}>
        <ambientLight intensity={1.3} />
        <directionalLight position={[3, 3, 3]} intensity={2.4} />
        <pointLight position={[-3, 2, 3]} intensity={1.5} />

        <Sphere args={[1, 128, 128]}>
          <meshStandardMaterial
            color="#C8A96A"
            roughness={0.95}
          />
        </Sphere>

        <GlobeGrid />

        <Sphere args={[1.03, 64, 64]}>
          <meshStandardMaterial
            color="#E7C98A"
            transparent
            opacity={0.12}
          />
        </Sphere>

        <LiteraryMarkers onCountrySelect={onCountrySelect} />

        <OrbitControls
          enableZoom
          enablePan={false}
          autoRotate
          autoRotateSpeed={0.35}
        />
      </Canvas>
    </div>
  );
}
