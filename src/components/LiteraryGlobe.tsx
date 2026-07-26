import { Canvas } from "@react-three/fiber";
import { OrbitControls, Sphere } from "@react-three/drei";

interface Props {
  onCountrySelect?: (name: string) => void;
}

export default function LiteraryGlobe({}: Props) {
  return (
    <div style={{ width: "100%", height: "760px", background: "#F7EBDC", borderRadius: 18 }}>
      <Canvas camera={{ position: [0, 0, 3.2] }}>
        <ambientLight intensity={1.2} />
        <directionalLight position={[3, 3, 3]} />
        <Sphere args={[1, 64, 64]}>
          <meshStandardMaterial color="#35205F" roughness={0.8} />
        </Sphere>
        <OrbitControls enableZoom enablePan={false} />
      </Canvas>
    </div>
  );
}
