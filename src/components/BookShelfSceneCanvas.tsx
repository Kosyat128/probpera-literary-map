import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";

import type {
  BookShelfPresentationItem,
  BookShelfSceneAppearance,
} from "./BookShelfScene";

export type BookShelfSceneCanvasProps = {
  items: readonly BookShelfPresentationItem[];
  appearance: BookShelfSceneAppearance;
  focusedBookKey: string | null;
  selectedBookKey: string | null;
  active: boolean;
  economical: boolean;
  reducedMotion: boolean;
  onFocusBook: (key: string) => void;
  onOpenBook: (key: string) => void;
  onContextLost: () => void;
};

function SceneLifecycle({
  dependency,
  onContextLost,
}: {
  dependency: string;
  onContextLost: () => void;
}) {
  const { gl, invalidate } = useThree();

  useEffect(() => {
    invalidate();
  }, [dependency, invalidate]);

  useEffect(() => {
    const canvas = gl.domElement;
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      onContextLost();
    };
    canvas.addEventListener("webglcontextlost", handleContextLost, false);
    return () =>
      canvas.removeEventListener("webglcontextlost", handleContextLost, false);
  }, [gl, onContextLost]);

  return null;
}

function ShelfBook({
  item,
  index,
  focused,
  selected,
  onFocusBook,
  onOpenBook,
}: {
  item: BookShelfPresentationItem;
  index: number;
  focused: boolean;
  selected: boolean;
  onFocusBook: (key: string) => void;
  onOpenBook: (key: string) => void;
}) {
  const row = Math.floor(index / 12);
  const column = index % 12;
  const x = (column - 5.5) * 0.72;
  const y = 1.65 - row * 2.05;
  const z = focused ? 0.48 : selected ? 0.24 : 0;
  const height = 1.34 + ((index * 17) % 7) * 0.055;
  const width = 0.46 + ((index * 11) % 5) * 0.035;

  return (
    <group position={[x, y, z]}>
      <mesh
        scale={[width, height, 0.34]}
        onPointerDown={(event) => {
          event.stopPropagation();
          onFocusBook(item.key);
        }}
        onDoubleClick={(event) => {
          event.stopPropagation();
          onOpenBook(item.key);
        }}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color={focused ? item.accentColor : item.baseColor}
          roughness={0.78}
          metalness={0.04}
          emissive={selected ? item.accentColor : "#000000"}
          emissiveIntensity={selected ? 0.14 : 0}
        />
      </mesh>
      <mesh position={[0, 0, 0.19]} scale={[width * 0.86, height * 0.9, 0.02]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={item.paperColor} roughness={0.92} />
      </mesh>
    </group>
  );
}

export default function BookShelfSceneCanvas({
  items,
  appearance,
  focusedBookKey,
  selectedBookKey,
  active,
  economical,
  reducedMotion,
  onFocusBook,
  onOpenBook,
  onContextLost,
}: BookShelfSceneCanvasProps) {
  const visibleItems = useMemo(() => {
    if (items.length <= 36) return [...items];
    const focusedIndex = Math.max(
      0,
      items.findIndex((item) => item.key === focusedBookKey)
    );
    const start = Math.min(Math.max(0, focusedIndex - 17), items.length - 36);
    return items.slice(start, start + 36);
  }, [focusedBookKey, items]);
  const dependency = `${focusedBookKey || ""}:${selectedBookKey || ""}:${visibleItems
    .map((item) => item.key)
    .join("|")}`;

  return (
    <Canvas
      aria-hidden="true"
      frameloop="demand"
      dpr={economical ? 1 : [1, 1.5]}
      camera={{ position: [0, 0.2, 8.7], fov: 42, near: 0.1, far: 30 }}
      gl={{
        alpha: true,
        antialias: !economical,
        powerPreference: economical ? "low-power" : "high-performance",
      }}
      style={{ pointerEvents: active ? "auto" : "none" }}
    >
      <SceneLifecycle dependency={dependency} onContextLost={onContextLost} />
      <ambientLight
        intensity={(economical ? 0.86 : 0.72) + appearance.intensity * 0.42}
        color={appearance.ambientColor}
      />
      <directionalLight
        position={[4, 6, 6]}
        intensity={(economical ? 0.82 : 1.02) + appearance.intensity * 0.48}
        color={appearance.lightColor}
      />
      <pointLight
        position={[-4, 1, 4]}
        intensity={0.34 + appearance.intensity * 0.46}
        color={appearance.ambientColor}
      />
      {[0, 1, 2].map((row) => (
        <mesh key={row} position={[0, 0.72 - row * 2.05, -0.23]} scale={[9.25, 0.15, 0.8]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color={appearance.shelfColor}
            roughness={appearance.materialRoughness}
          />
        </mesh>
      ))}
      {visibleItems.map((item, index) => (
        <ShelfBook
          key={item.key}
          item={item}
          index={index}
          focused={item.key === focusedBookKey}
          selected={item.key === selectedBookKey}
          onFocusBook={onFocusBook}
          onOpenBook={onOpenBook}
        />
      ))}
      {!reducedMotion ? null : <group />}
    </Canvas>
  );
}
