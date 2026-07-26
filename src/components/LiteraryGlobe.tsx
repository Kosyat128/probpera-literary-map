import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls, Sphere } from "@react-three/drei";
import { useMemo, useState } from "react";
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
  const [active, setActive] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

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

  return <>{markers.map((point) => {
    const isFocused = active === point.name || hovered === point.name;

    return <group key={point.name} position={point.position}>
      <mesh
        onClick={() => {
          setActive(point.name);
          onCountrySelect?.(point.name);
        }}
        onPointerOver={() => setHovered(point.name)}
        onPointerOut={() => setHovered(null)}
      >
        <sphereGeometry args={[isFocused ? point.size * 1.45 : point.size, 40, 40]} />
        <meshStandardMaterial
          color={isFocused ? "#F6B04A" : point.color}
          emissive={point.color}
          emissiveIntensity={isFocused ? 2.4 : 1.2}
        />
      </mesh>

      {isFocused && <Html distanceFactor={6} center>
        <div style={{
          background: "#FFF8EE",
          color: "#35205F",
          border: `2px solid ${point.color}`,
          borderRadius: "18px",
          padding: "10px 16px",
          fontSize: "13px",
          fontWeight: 700,
          boxShadow: "0 12px 30px rgba(0,0,0,.35)",
          whiteSpace: "nowrap"
        }}>
          {point.name}<br />
          📚 {point.count} писателей
        </div>
      </Html>}
    </group>;
  })}</>;
}

function GlobeGrid() {
  return <Sphere args={[1.005, 64, 64]}>
    <meshStandardMaterial color="#7A5420" wireframe transparent opacity={0.1} />
  </Sphere>;
}

function AntiqueGlow() {
  return <Sphere args={[1.07, 64, 64]}>
    <meshStandardMaterial color="#F2D39A" transparent opacity={0.08} />
  </Sphere>;
}

export default function LiteraryGlobe({ onCountrySelect }: Props) {
  return <div style={{
    width: "100%",
    height: "760px",
    background: "#1F103D",
    borderRadius: 18,
    overflow: "hidden"
  }}>
    <Canvas camera={{ position: [0, 0, 3.2] }}>
      <ambientLight intensity={1.4} />
      <directionalLight position={[3, 3, 3]} intensity={2.5} />
      <pointLight position={[-3, 2, 3]} intensity={1.7} />
      <Sphere args={[1, 128, 128]}>
        <meshStandardMaterial color="#C8A96A" roughness={0.9} metalness={0.05} />
      </Sphere>
      <GlobeGrid />
      <AntiqueGlow />
      <LiteraryMarkers onCountrySelect={onCountrySelect} />
      <OrbitControls enableZoom enablePan={false} autoRotate autoRotateSpeed={0.25} />
    </Canvas>
  </div>;
}
