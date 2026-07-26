import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls, Sphere } from "@react-three/drei";
import { useMemo } from "react";

interface Props {
  onCountrySelect?: (name: string) => void;
}

const markers = [
  { name: "Россия", x: -0.35, y: 0.25, z: 0.9, count: 127, color: "#E97824" },
  { name: "Франция", x: -0.65, y: 0.1, z: 0.75, count: 54, color: "#35205F" },
  { name: "Япония", x: 0.75, y: 0.1, z: 0.7, count: 43, color: "#E97824" },
];

function LiteraryMarkers({ onCountrySelect }: Props) {
  const points = useMemo(() => markers, []);

  return (
    <>
      {points.map((point) => (
        <group key={point.name} position={[point.x, point.y, point.z]}>
          <mesh onClick={() => onCountrySelect?.(point.name)}>
            <sphereGeometry args={[0.085, 32, 32]} />
            <meshStandardMaterial
              color={point.color}
              emissive={point.color}
              emissiveIntensity={1}
            />
          </mesh>
          <Html distanceFactor={6} center>
            <div
              style={{
                background: "#FFF8EE",
                color: "#35205F",
                border: `2px solid ${point.color}`,
                borderRadius: "18px",
                padding: "5px 10px",
                fontSize: "13px",
                fontWeight: 700,
                boxShadow: "0 4px 14px rgba(0,0,0,.25)",
                whiteSpace: "nowrap"
              }}
            >
              {point.name} · {point.count}
            </div>
          </Html>
        </group>
      ))}
    </>
  );
}

function GlobeAtmosphere() {
  return (
    <Sphere args={[1.03, 64, 64]}>
      <meshStandardMaterial
        color="#E7C98A"
        transparent
        opacity={0.12}
      />
    </Sphere>
  );
}

export default function LiteraryGlobe({ onCountrySelect }: Props) {
  return (
    <div
      style={{
        width: "100%",
        height: "760px",
        background: "#1F103D",
        borderRadius: 18,
        overflow: "hidden"
      }}
    >
      <Canvas camera={{ position: [0, 0, 3.2] }}>
        <ambientLight intensity={1.5} />
        <directionalLight position={[3, 3, 3]} intensity={2} />

        <Sphere args={[1, 128, 128]}>
          <meshStandardMaterial
            color="#C8A96A"
            roughness={0.95}
          />
        </Sphere>

        <GlobeAtmosphere />

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
