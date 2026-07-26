import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls, Sphere } from "@react-three/drei";
import { useEffect, useMemo, useState } from "react";
import { countries } from "../data/countries";
import { worldContours, setWorldContours } from "../data/worldContours";
import { parseWorldContours } from "../data/loadWorldContours";
import AntiqueContinentLayer from "./AntiqueContinentLayer";
import GlobeCountryFocus from "./GlobeCountryFocus";

interface Props {
  onCountrySelect?: (name: string) => void;
}

type CountryFocus = { name: string; coordinates: [number, number] } | null;

function geoToSphere(lat: number, lng: number, radius = 0.78): [number, number, number] {
  const phi = (90 - lat) * Math.PI / 180;
  const theta = (lng + 180) * Math.PI / 180;
  return [
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  ];
}

function LiteraryMarkers({
  onCountrySelect,
  onFocus,
}: {
  onCountrySelect?: Props["onCountrySelect"];
  onFocus: (focus: CountryFocus) => void;
}) {
  const [active, setActive] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  const markers = useMemo(
    () =>
      countries
        .filter((country) => country.coordinates && country.writers.length > 0)
        .map((country) => {
          const co = country.coordinates;
          const lat = Array.isArray(co) ? co[0] : co?.lat;
          const lng = Array.isArray(co) ? co[1] : co?.lng;

          return {
            name: country.name,
            count: country.writers.length,
            lat: lat || 0,
            lng: lng || 0,
            position: geoToSphere(lat || 0, lng || 0),
            color: country.writers.length >= 20 ? "#D66A1F" : "#6B3FA0",
            size: 0.024 + Math.min(country.writers.length / 750, 0.034),
          };
        }),
    []
  );

  return (
    <>
      {markers.map((marker) => {
        const focus = active === marker.name || hovered === marker.name;

        return (
          <group key={marker.name} position={marker.position}>
            <mesh
              onClick={() => {
                setActive(marker.name);
                onFocus({ name: marker.name, coordinates: [marker.lat, marker.lng] });
                onCountrySelect?.(marker.name);
              }}
              onPointerOver={() => setHovered(marker.name)}
              onPointerOut={() => setHovered(null)}
            >
              <sphereGeometry args={[focus ? marker.size * 2.35 : marker.size, 32, 32]} />
              <meshStandardMaterial
                color={focus ? "#F3B24D" : marker.color}
                emissive={marker.color}
                emissiveIntensity={focus ? 4 : 1}
              />
            </mesh>
            {focus && (
              <Html center>
                <div
                  style={{
                    background: "#F7EBD8",
                    color: "#35205F",
                    border: "2px solid #D66A1F",
                    borderRadius: 12,
                    padding: "10px 14px",
                    fontWeight: 700,
                    boxShadow: "0 12px 30px rgba(31,16,61,0.18)",
                  }}
                >
                  🌍 {marker.name}
                  <br />
                  📚 Авторов: {marker.count}
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </>
  );
}

function AntiqueGlobe() {
  return (
    <Sphere args={[0.72, 128, 128]}>
      <meshStandardMaterial color="#7A5A32" roughness={1} metalness={0.02} />
    </Sphere>
  );
}

function ParchmentSurface() {
  return (
    <Sphere args={[0.724, 128, 128]}>
      <meshStandardMaterial color="#D2B47C" transparent opacity={0.22} roughness={1} metalness={0} />
    </Sphere>
  );
}

function OldAtlasInk() {
  return (
    <Sphere args={[0.728, 96, 96]}>
      <meshBasicMaterial color="#3D2412" wireframe transparent opacity={0.055} />
    </Sphere>
  );
}

function AntiqueContinents() {
  return (
    <Sphere args={[0.731, 128, 128]}>
      <meshStandardMaterial color="#5A3B20" transparent opacity={0.13} roughness={1} metalness={0} />
    </Sphere>
  );
}

function ContinentInk() {
  return (
    <Sphere args={[0.733, 128, 128]}>
      <meshBasicMaterial color="#24150C" transparent opacity={0.045} />
    </Sphere>
  );
}

function HistoricalMapLines() {
  return (
    <Sphere args={[0.735, 96, 96]}>
      <meshBasicMaterial color="#4A2A16" wireframe transparent opacity={0.03} />
    </Sphere>
  );
}

function SeaRoutes() {
  return (
    <Sphere args={[0.737, 96, 96]}>
      <meshStandardMaterial color="#D66A1F" wireframe transparent opacity={0.014} />
    </Sphere>
  );
}

function CompassLayer() {
  return (
    <Sphere args={[0.739, 64, 64]}>
      <meshBasicMaterial color="#3D2412" wireframe transparent opacity={0.02} />
    </Sphere>
  );
}

function AntiqueGlow() {
  return (
    <Sphere args={[0.745, 64, 64]}>
      <meshBasicMaterial color="#D66A1F" transparent opacity={0.018} />
    </Sphere>
  );
}

function Atmosphere() {
  return (
    <Sphere args={[0.82, 64, 64]}>
      <meshBasicMaterial color="#35205F" transparent opacity={0.09} />
    </Sphere>
  );
}

export default function LiteraryGlobe({ onCountrySelect }: Props) {
  const [selectedCountry, setSelectedCountry] = useState<CountryFocus>(null);

  useEffect(() => {
    fetch("/data/geo/countries.geojson")
      .then((response) => response.json())
      .then((data) => setWorldContours(parseWorldContours(data)))
      .catch(() => {});
  }, []);

  return (
    <div
      style={{
        width: "100%",
        height: "560px",
        background: "radial-gradient(circle at 50% 40%, #4a2c76 0%, #1F103D 58%, #12081f 100%)",
        borderRadius: 18,
        overflow: "hidden",
        boxShadow: "0 20px 55px rgba(31,16,61,0.28)",
      }}
    >
      <Canvas camera={{ position: [0, 0, 3.45], fov: 35 }}>
        <ambientLight intensity={2.25} />
        <directionalLight position={[4, 3, 4]} intensity={2.8} />
        <pointLight position={[-2, 1, 2]} intensity={1.2} />

        <AntiqueGlobe />
        <ParchmentSurface />
        <AntiqueContinents />
        <ContinentInk />
        <HistoricalMapLines />
        <OldAtlasInk />
        <SeaRoutes />
        <CompassLayer />
        <AntiqueGlow />
        <Atmosphere />

        <AntiqueContinentLayer features={worldContours} />
        <LiteraryMarkers onCountrySelect={onCountrySelect} onFocus={setSelectedCountry} />
        <GlobeCountryFocus country={selectedCountry?.name} coordinates={selectedCountry?.coordinates} />
        <OrbitControls
          enableZoom
          enablePan={false}
          autoRotate={!selectedCountry}
          autoRotateSpeed={0.05}
          rotateSpeed={0.6}
          zoomSpeed={0.7}
        />
      </Canvas>
    </div>
  );
}