import { useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import { Color, InstancedMesh, Object3D } from "three";

import type { BookShelfSceneAppearance } from "./BookShelfScene";

export type BookShelfEnvironmentProfile = "HIGH" | "BALANCED" | "ECONOMY";

type EnvironmentTransform = {
  position: readonly [number, number, number];
  scale: readonly [number, number, number];
  rotationY?: number;
  colorSlot?: number;
};

export type BookShelfEnvironmentLayout = {
  books: readonly EnvironmentTransform[];
  shelves: readonly EnvironmentTransform[];
  architecture: readonly EnvironmentTransform[];
};

type EnvironmentProfileConfig = {
  rowsPerSide: number;
  booksPerRow: number;
  shelfWidth: number;
  fogNear: number;
  fogFar: number;
  floorRoughness: number;
};

const PROFILE_CONFIG: Record<
  BookShelfEnvironmentProfile,
  EnvironmentProfileConfig
> = {
  ECONOMY: {
    rowsPerSide: 2,
    booksPerRow: 8,
    shelfWidth: 3.1,
    fogNear: 7.6,
    fogFar: 15.5,
    floorRoughness: 0.56,
  },
  BALANCED: {
    rowsPerSide: 3,
    booksPerRow: 11,
    shelfWidth: 3.35,
    fogNear: 8.4,
    fogFar: 18,
    floorRoughness: 0.43,
  },
  HIGH: {
    rowsPerSide: 4,
    booksPerRow: 13,
    shelfWidth: 3.55,
    fogNear: 9,
    fogFar: 21,
    floorRoughness: 0.34,
  },
};

export const BOOK_SHELF_ENVIRONMENT_MAX_BOOK_INSTANCES =
  PROFILE_CONFIG.HIGH.rowsPerSide * PROFILE_CONFIG.HIGH.booksPerRow * 2;

export function resolveBookShelfEnvironmentProfile(
  canvasWidth: number,
  economical: boolean
): BookShelfEnvironmentProfile {
  if (economical || canvasWidth <= 680) return "ECONOMY";
  if (canvasWidth <= 1360) return "BALANCED";
  return "HIGH";
}

function seededUnit(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function createBookShelfEnvironmentLayout(
  profile: BookShelfEnvironmentProfile
): BookShelfEnvironmentLayout {
  const config = PROFILE_CONFIG[profile];
  const random = seededUnit(
    profile === "HIGH"
      ? 0x5d300003
      : profile === "BALANCED"
        ? 0x5d300002
        : 0x5d300001
  );
  const shelves: EnvironmentTransform[] = [];
  const books: EnvironmentTransform[] = [];
  const shelfCenter = config.shelfWidth / 2 + 2.25;

  for (const side of [-1, 1] as const) {
    const centerX = shelfCenter * side;
    for (let row = 0; row < config.rowsPerSide; row += 1) {
      const shelfY = -0.82 + row * 1.08;
      shelves.push({
        position: [centerX, shelfY, -3.7 - row * 0.035],
        scale: [config.shelfWidth, 0.1, 0.7],
      });
      const spacing = config.shelfWidth / (config.booksPerRow + 1);
      for (let slot = 0; slot < config.booksPerRow; slot += 1) {
        const height = 0.68 + random() * 0.27;
        const width = Math.min(0.21, spacing * (0.62 + random() * 0.2));
        const x =
          centerX - config.shelfWidth / 2 + spacing * (slot + 1);
        books.push({
          position: [
            x,
            shelfY + 0.06 + height / 2,
            -3.57 + random() * 0.055,
          ],
          scale: [width, height, 0.42 + random() * 0.08],
          rotationY: (random() - 0.5) * 0.028,
          colorSlot: Math.floor(random() * 5),
        });
      }
    }
  }

  const architecture: EnvironmentTransform[] = [
    { position: [-7.1, 1.65, -6.55], scale: [0.34, 6.5, 0.58] },
    { position: [-5.55, 1.65, -6.55], scale: [0.22, 6.5, 0.42] },
    { position: [5.55, 1.65, -6.55], scale: [0.22, 6.5, 0.42] },
    { position: [7.1, 1.65, -6.55], scale: [0.34, 6.5, 0.58] },
    { position: [0, 4.86, -7.45], scale: [14.5, 0.22, 0.28] },
  ];
  const mullionCount =
    profile === "ECONOMY" ? 3 : profile === "BALANCED" ? 5 : 7;
  for (let index = 0; index < mullionCount; index += 1) {
    const x = (index - (mullionCount - 1) / 2) * (5.8 / (mullionCount - 1));
    architecture.push({
      position: [x, 2.05, -7.38],
      scale: [0.065, 5.35, 0.12],
    });
  }
  const transomCount = profile === "HIGH" ? 4 : 3;
  for (let index = 0; index < transomCount; index += 1) {
    architecture.push({
      position: [0, 0.08 + index * 1.35, -7.37],
      scale: [5.85, 0.065, 0.12],
    });
  }

  return { books, shelves, architecture };
}

function mixColor(first: string, second: string, amount: number) {
  return `#${new Color(first).lerp(new Color(second), amount).getHexString()}`;
}

function resolveEnvironmentPalette(
  appearance: BookShelfSceneAppearance,
  inspectionActive: boolean
) {
  const dim = inspectionActive ? 0.52 : 0;
  const darken = (color: string) => mixColor(color, "#06050a", dim);
  return {
    shelves: darken(mixColor(appearance.shelfColor, "#2a1714", 0.48)),
    architecture: darken(
      mixColor(appearance.ambientColor, "#14131b", 0.68)
    ),
    floor: darken(mixColor(appearance.shelfColor, "#110d10", 0.72)),
    fog: darken(mixColor(appearance.ambientColor, "#090911", 0.78)),
    window: darken(mixColor(appearance.lightColor, "#6f7b83", 0.7)),
    light: darken(appearance.lightColor),
    books: [
      darken(mixColor(appearance.shelfColor, "#6f2732", 0.52)),
      darken(mixColor(appearance.ambientColor, "#244c5b", 0.52)),
      darken(mixColor(appearance.shelfColor, "#8a5c35", 0.56)),
      darken(mixColor(appearance.lightColor, "#4b312c", 0.72)),
      darken(mixColor(appearance.ambientColor, "#3f5038", 0.58)),
    ],
  };
}

function applyTransforms(
  mesh: InstancedMesh,
  transforms: readonly EnvironmentTransform[],
  colors?: readonly string[]
) {
  const helper = new Object3D();
  transforms.forEach((transform, index) => {
    helper.position.set(...transform.position);
    helper.rotation.set(0, transform.rotationY || 0, 0);
    helper.scale.set(...transform.scale);
    helper.updateMatrix();
    mesh.setMatrixAt(index, helper.matrix);
    if (colors && typeof transform.colorSlot === "number") {
      mesh.setColorAt(
        index,
        new Color(colors[transform.colorSlot % colors.length])
      );
    }
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
}

export default function BookShelfSpatialEnvironment({
  appearance,
  economical,
  inspectionActive,
}: {
  appearance: BookShelfSceneAppearance;
  economical: boolean;
  inspectionActive: boolean;
}) {
  const { size, invalidate } = useThree();
  const profile = resolveBookShelfEnvironmentProfile(size.width, economical);
  const config = PROFILE_CONFIG[profile];
  const layout = useMemo(
    () => createBookShelfEnvironmentLayout(profile),
    [profile]
  );
  const palette = useMemo(
    () => resolveEnvironmentPalette(appearance, inspectionActive),
    [appearance, inspectionActive]
  );
  const shelfRef = useRef<InstancedMesh>(null);
  const bookRef = useRef<InstancedMesh>(null);
  const architectureRef = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    if (shelfRef.current) applyTransforms(shelfRef.current, layout.shelves);
    if (bookRef.current) {
      applyTransforms(bookRef.current, layout.books, palette.books);
    }
    if (architectureRef.current) {
      applyTransforms(architectureRef.current, layout.architecture);
    }
    invalidate();
  }, [invalidate, layout, palette.books]);

  const inspectionLightFactor = inspectionActive ? 0.28 : 1;

  return (
    <>
      <fog attach="fog" args={[palette.fog, config.fogNear, config.fogFar]} />
      <group name={`book-shelf-environment-${profile.toLowerCase()}`}>
        <group name="book-shelf-layer-c-architecture">
          <mesh position={[0, 1.78, -7.62]}>
            <planeGeometry args={[18, 7.4]} />
            <meshStandardMaterial
              color={palette.architecture}
              roughness={0.96}
              metalness={0}
            />
          </mesh>
          <mesh position={[0, 2.05, -7.48]}>
            <planeGeometry args={[5.9, 5.4]} />
            <meshBasicMaterial
              color={palette.window}
              transparent
              opacity={
                inspectionActive
                  ? 0.035
                  : profile === "ECONOMY"
                    ? 0.09
                    : 0.14
              }
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
          <instancedMesh
            ref={architectureRef}
            args={[undefined, undefined, layout.architecture.length]}
          >
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial
              color={palette.architecture}
              roughness={0.78}
              metalness={0.04}
            />
          </instancedMesh>
          <mesh
            name="book-shelf-cheap-floor-reflection"
            position={[0, -1.255, -2.6]}
            rotation={[-Math.PI / 2, 0, 0]}
            receiveShadow={profile !== "ECONOMY"}
          >
            <planeGeometry args={[18, 15]} />
            <meshPhysicalMaterial
              color={palette.floor}
              roughness={config.floorRoughness}
              metalness={0.12}
              clearcoat={profile === "ECONOMY" ? 0.18 : 0.5}
              clearcoatRoughness={profile === "HIGH" ? 0.26 : 0.42}
              envMapIntensity={profile === "ECONOMY" ? 0.34 : 0.72}
            />
          </mesh>
          <pointLight
            color={palette.light}
            position={[0, 4.2, -4.8]}
            intensity={
              (profile === "ECONOMY" ? 0.32 : 0.58) * inspectionLightFactor
            }
            distance={14}
            decay={2}
          />
        </group>
        <group name="book-shelf-layer-b-midground">
          <instancedMesh
            ref={shelfRef}
            args={[undefined, undefined, layout.shelves.length]}
            receiveShadow={profile !== "ECONOMY"}
          >
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial
              color={palette.shelves}
              roughness={0.76}
              metalness={0}
            />
          </instancedMesh>
          <instancedMesh
            ref={bookRef}
            args={[undefined, undefined, layout.books.length]}
          >
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial
              color="#ffffff"
              roughness={0.84}
              metalness={0}
            />
          </instancedMesh>
        </group>
      </group>
    </>
  );
}
