import { Canvas } from "@react-three/fiber";
import { OrbitControls, Sphere } from "@react-three/drei";
import { useMemo } from "react";

interface Props {
  onCountrySelect?: (name: string) => void;
}

const markers = [
  { name: "Россия", x: -0.35, y: 0.25, z: 0.9, count: 127, color: "#E97824" },
  { name: "Франция", x: -0.65, y: 0.1, z: 0.75, count: 54, color: "#35205F" },
  { name: "Япония", x: 0.75, y: 0.1, z: 0.7, count: 43, color: "#E97824" },
];

function LiteraryMarkers() {
  const points = useMemo(() => markers, []);

  return (
    <>
      {points.map((point) => (
        <mesh key={point.name} position={[point.x, point.y, point.z]}>
          <sphereGeometry args={[0.035, 24, 24]} />
          <meshStandardMaterial color={point.color} emissive={point.color} />
        </mesh>
      ))}
    </>
  );
}

export default function LiteraryGlobe({}: Props) {
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
        <ambientLight intensity={1.4} />
        <directionalLight position={[3, 3, 3]} intensity={2} />

        <Sphere args={[1, 96, 96]}>
          <meshStandardMaterial
            color="#C8A96A"
            roughness={1}
          />
        </Sphere>

        <LiteraryMarkers />

        <OrbitControls
          enableZoom
          enablePan={false}
          autoRotate
          autoRotateSpeed={0.5}
        />
      </Canvas>
    </div>
  );
}
