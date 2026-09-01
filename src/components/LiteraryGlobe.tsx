import { Canvas, type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type Ref,
  type RefObject,
} from "react";
import * as THREE from "three";

import type { Country, Writer } from "../data/countries";
import Button from "../ui/Button";
import IconButton from "../ui/IconButton";
import {
  findNobelArticle,
  getNobelYear,
} from "../data/articles/nobelArticles";
import {
  collectCountryNobelLaureates,
  collectNobelLaureates,
} from "../data/nobel";
import {
  selectInterfacePlural,
  useInterfaceLanguage,
} from "../i18n/InterfaceLanguage";
import { articlePath } from "../utils/articleRoutes";
import { selectWriterDisplayName } from "../data/bookLocalization";
import CountryFlagIcon from "./CountryFlagIcon";
import BrandMinusIcon from "./BrandMinusIcon";
import BrandPlusIcon from "./BrandPlusIcon";
import BrandResetIcon from "./BrandResetIcon";
import BrandRotateIcon from "./BrandRotateIcon";
import WriterPortrait from "./WriterPortrait";
import NobelMarkerLayer, { type NobelLayerHover } from "./NobelMarkerLayer";
import GlobeCameraRig, {
  globeCameraIntentKey,
  type GlobeCameraCancellationEvent,
  type GlobeCameraPhase,
  type GlobeCameraControlRequest,
  type GlobeCameraFocusIntent,
  type GlobeCameraView,
  type GlobeCountryCameraIntentKind,
} from "./GlobeCameraRig";
import type { CountryFocusMetrics, ViewInsets } from "./globeFocusMath";
import { useGlobeStyleState } from "./useGlobeStyleState";
import GlobeViewObserver, { type GlobeViewSample } from "./GlobeViewObserver";
import { resolveCountryGlobeCoordinates } from "./globeCoordinates";
import {
  createGlobeAtlas,
  type GlobeAtlas,
  type GlobeVisualStyle,
} from "./globeAtlas";
import {
  DEFAULT_GLOBE_EDITION_ID,
  AVAILABLE_GLOBE_EDITIONS,
  GLOBE_EDITION_BY_ID,
  legacySurfaceProfileForEdition,
  parseStoredGlobeEdition,
  type GlobeEditionId,
  type GlobeOverlayProfile,
} from "./globeEditions";
import { geographicToSphere } from "./globeGeography";
import { raycastGlobeAtNdc } from "./globeProjection";
import {
  beginGlobePointerGesture,
  GLOBE_INTERACTION_RESUME_DELAY_MS,
  globeControlActionForKey,
  isGlobePointerTap,
  updateGlobePointerGesture,
  type GlobeControlAction,
  type GlobePointerGesture,
} from "./globeInteraction";
import {
  globeKeyboardCandidateAriaCopy,
} from "./globeKeyboardNavigation";
import {
  resolveGlobeAutoRotationPolicy,
  resolveGlobeFrameMode,
} from "./globePerformance";
import {
  createGlobeTouchActivationState,
  globeTouchActivationReducer,
  resolveGlobeTouchActivationPolicy,
} from "./globeTouchActivation";
import {
  nobelLaureateRowId,
  resolveNobelMarkerDetailMode,
  type NobelMarkerDetailMode,
} from "./nobelMarkerPolicy";

export type LiteraryGlobeMode = "embedded" | "immersive";
export type GlobeCountrySelectionSource = "pointer" | "keyboard";
export type GlobeCountrySelectionFocusKind = Exclude<
  GlobeCountryCameraIntentKind,
  "writer-focus"
>;

export type GlobeExplicitFocusRequest =
  | Readonly<{
      id: number;
      kind: "home";
    }>
  | Readonly<{
      id: number;
      kind: GlobeCountrySelectionFocusKind;
      countryId: string;
    }>
  | Readonly<{
      id: number;
      kind: "writer-focus";
      countryId: string;
      writerId: string;
      coordinates: Readonly<{ latitude: number; longitude: number }>;
    }>;

interface Props {
  countries: Country[];
  atlasCountries?: Country[];
  selectedCountry?: Country | null;
  selectedWriter?: Writer | null;
  onCountrySelect?: (
    country: Country,
    source?: GlobeCountrySelectionSource
  ) => void;
  onWriterSelect?: (country: Country, writer: Writer) => void;
  showNobelLaureates?: boolean;
  nobelCountryId?: string | null;
  mode?: LiteraryGlobeMode;
  rootRef?: Ref<HTMLDivElement>;
  onViewSample?: (sample: GlobeViewSample) => void;
  onHoverCountryChange?: (country: Country | null) => void;
  focusRequest?: GlobeExplicitFocusRequest | null;
  economical?: boolean;
}

const GLOBE_EDITION_STORAGE_KEY = "probpera.globe-edition.v2";
const LEGACY_GLOBE_STYLE_STORAGE_KEY = "probpera.globe-style.v1";
const GLOBE_CAMERA_CONFIG = {
  position: [0, 0.08, 4.9] as [number, number, number],
  fov: 43,
  near: 0.1,
  far: 100,
};

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") ref(value);
  else if (ref) (ref as { current: T | null }).current = value;
}

const globeStylePalette: Record<
  GlobeVisualStyle,
  {
    atmosphere: string;
    atmosphereStrength: number;
    ambient: string;
    ambientIntensity: number;
    hemisphereSky: string;
    hemisphereGround: string;
    hemisphereIntensity: number;
    directional: string;
    directionalIntensity: number;
    sideLight: string;
    sideLightIntensity: number;
    lowerLight: string;
    lowerLightIntensity: number;
    rearLight: string;
    upperLight: string;
    spotLight: string;
    spotIntensity: number;
  }
> = {
  antique: {
    atmosphere: "#e88c33",
    atmosphereStrength: 0.21,
    ambient: "#f7d29a",
    ambientIntensity: 0.66,
    hemisphereSky: "#ffe2ab",
    hemisphereGround: "#170620",
    hemisphereIntensity: 1.12,
    directional: "#ffd6a0",
    directionalIntensity: 2.35,
    sideLight: "#c45b24",
    sideLightIntensity: 13,
    lowerLight: "#e89a5d",
    lowerLightIntensity: 9.5,
    rearLight: "#7b3c91",
    upperLight: "#6f2b8d",
    spotLight: "#ffe3b1",
    spotIntensity: 7.5,
  },
  earth: {
    atmosphere: "#54b8ff",
    atmosphereStrength: 0.34,
    ambient: "#a7cbe0",
    ambientIntensity: 0.5,
    hemisphereSky: "#bce7ff",
    hemisphereGround: "#020713",
    hemisphereIntensity: 0.92,
    directional: "#fff6df",
    directionalIntensity: 2.72,
    sideLight: "#287fc2",
    sideLightIntensity: 8.2,
    lowerLight: "#76c9ec",
    lowerLightIntensity: 5.2,
    rearLight: "#17427d",
    upperLight: "#245c91",
    spotLight: "#eaf8ff",
    spotIntensity: 6.4,
  },
  modern: {
    atmosphere: "#72cfff",
    atmosphereStrength: 0.23,
    ambient: "#dce9ec",
    ambientIntensity: 0.56,
    hemisphereSky: "#f2fbff",
    hemisphereGround: "#07141d",
    hemisphereIntensity: 0.9,
    directional: "#fffdf4",
    directionalIntensity: 2.32,
    sideLight: "#67bce5",
    sideLightIntensity: 4.8,
    lowerLight: "#73c8e9",
    lowerLightIntensity: 3.5,
    rearLight: "#2b6788",
    upperLight: "#9fdcf2",
    spotLight: "#ffffff",
    spotIntensity: 5.4,
  },
};

const globeSurfaceMaterials: Record<
  GlobeVisualStyle,
  {
    bumpScale: number;
    roughness: number;
    metalness: number;
    clearcoat: number;
    clearcoatRoughness: number;
    emissive: string;
    emissiveIntensity: number;
    equator: string;
  }
> = {
  antique: {
    bumpScale: 0.028,
    roughness: 0.68,
    metalness: 0.035,
    clearcoat: 0.24,
    clearcoatRoughness: 0.58,
    emissive: "#2b160c",
    emissiveIntensity: 0.045,
    equator: "#e5b66a",
  },
  earth: {
    bumpScale: 0.016,
    roughness: 0.56,
    metalness: 0.018,
    clearcoat: 0.34,
    clearcoatRoughness: 0.46,
    emissive: "#03111c",
    emissiveIntensity: 0.034,
    equator: "#62e2b7",
  },
  modern: {
    bumpScale: 0.014,
    roughness: 0.48,
    metalness: 0.012,
    clearcoat: 0.34,
    clearcoatRoughness: 0.42,
    emissive: "#06151d",
    emissiveIntensity: 0.022,
    equator: "#b5483e",
  },
};

function storedGlobeEdition(): GlobeEditionId {
  if (typeof window === "undefined") return DEFAULT_GLOBE_EDITION_ID;

  try {
    const stored =
      window.localStorage.getItem(GLOBE_EDITION_STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_GLOBE_STYLE_STORAGE_KEY);
    return parseStoredGlobeEdition(stored);
  } catch {
    return DEFAULT_GLOBE_EDITION_ID;
  }
}

export function fallbackCountryCoordinates(
  country: Country
): [number, number] | null {
  const resolved = resolveCountryGlobeCoordinates(country);
  return resolved ? [resolved.latitude, resolved.longitude] : null;
}

function writerDisplayName(
  writer: Writer,
  fallback = "Автор",
  language: "ru" | "en" = "ru"
) {
  return selectWriterDisplayName(writer, language, fallback);
}

type GlobeControlRequest = GlobeCameraControlRequest;

type PointerGestureRef = {
  current: GlobePointerGesture | null;
};

function startPointerGesture(
  gestureRef: PointerGestureRef,
  event: ThreeEvent<PointerEvent>
) {
  gestureRef.current = beginGlobePointerGesture(event.nativeEvent);
}

function trackPointerGesture(
  gestureRef: PointerGestureRef,
  event: ThreeEvent<PointerEvent>
) {
  gestureRef.current = updateGlobePointerGesture(
    gestureRef.current,
    event.nativeEvent
  );
}

function finishPointerGesture(
  gestureRef: PointerGestureRef,
  event: ThreeEvent<PointerEvent>
) {
  const isTap = isGlobePointerTap(gestureRef.current, event.nativeEvent);
  gestureRef.current = null;
  return isTap;
}

function MuseumAtmosphere({ visualStyle }: { visualStyle: GlobeVisualStyle }) {
  const material = useMemo(
    () => {
      const palette = globeStylePalette[visualStyle];
      return new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        uniforms: {
          glowColor: { value: new THREE.Color(palette.atmosphere) },
          glowStrength: { value: palette.atmosphereStrength },
        },
        vertexShader: `
          varying vec3 vWorldNormal;
          varying vec3 vWorldPosition;

          void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            vWorldNormal = normalize(mat3(modelMatrix) * normal);
            gl_Position = projectionMatrix * viewMatrix * worldPosition;
          }
        `,
        fragmentShader: `
          uniform vec3 glowColor;
          uniform float glowStrength;
          varying vec3 vWorldNormal;
          varying vec3 vWorldPosition;

          void main() {
            vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
            float fresnel = 1.0 - max(0.0, dot(normalize(vWorldNormal), viewDirection));
            float glow = pow(fresnel, 2.7);
            gl_FragColor = vec4(glowColor, glow * glowStrength);
          }
        `,
      });
    },
    [visualStyle]
  );

  useEffect(() => () => material.dispose(), [material]);

  return (
    <mesh scale={1.09}>
      <sphereGeometry args={[1, 64, 48]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

function createWhaleBodyGeometry() {
  const longitudinalSegments = 34;
  const radialSegments = 20;
  const positions: number[] = [];
  const indices: number[] = [];

  for (let slice = 0; slice <= longitudinalSegments; slice += 1) {
    const progress = slice / longitudinalSegments;
    const profile = Math.pow(Math.sin(Math.PI * progress), 0.52);
    const headFullness =
      0.72 + THREE.MathUtils.smoothstep(progress, 0.48, 0.86) * 0.34;
    const width = 0.275 * profile * headFullness;
    const height =
      0.17 *
      profile *
      (0.88 + THREE.MathUtils.smoothstep(progress, 0.64, 0.92) * 0.1);
    const spineY =
      -1.105 +
      Math.sin(progress * Math.PI) * 0.105 -
      THREE.MathUtils.smoothstep(progress, 0.78, 1) * 0.055;
    const z = THREE.MathUtils.lerp(-0.27, 1.06, progress);

    for (let segment = 0; segment <= radialSegments; segment += 1) {
      const angle = (segment / radialSegments) * Math.PI * 2;
      const lowerJawWeight = Math.sin(angle) < 0 ? 0.9 : 1;
      positions.push(
        Math.cos(angle) * width,
        spineY + Math.sin(angle) * height * lowerJawWeight,
        z
      );
    }
  }

  for (let slice = 0; slice < longitudinalSegments; slice += 1) {
    for (let segment = 0; segment < radialSegments; segment += 1) {
      const row = radialSegments + 1;
      const first = slice * row + segment;
      const second = first + row;
      indices.push(first, second, first + 1, second, second + 1, first + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function createWhaleTailGeometry() {
  const contour = [
    new THREE.Vector2(-0.035, 0),
    new THREE.Vector2(-0.17, -0.05),
    new THREE.Vector2(-0.46, -0.27),
    new THREE.Vector2(-0.34, -0.39),
    new THREE.Vector2(-0.09, -0.28),
    new THREE.Vector2(0, -0.2),
    new THREE.Vector2(0.09, -0.28),
    new THREE.Vector2(0.34, -0.39),
    new THREE.Vector2(0.46, -0.27),
    new THREE.Vector2(0.17, -0.05),
    new THREE.Vector2(0.035, 0),
  ];
  const faces = THREE.ShapeUtils.triangulateShape(contour, []);
  const positions = contour.flatMap((point) => [point.x, -1.105, point.y - 0.24]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );
  geometry.setIndex(faces.flat());
  geometry.computeVertexNormals();
  return geometry;
}

function createWhaleFinGeometry(side: -1 | 1) {
  const positions = [
    side * 0.18,
    -1.11,
    0.58,
    side * 0.5,
    -1.28,
    0.16,
    side * 0.27,
    -1.17,
    0.72,
    side * 0.23,
    -1.14,
    0.34,
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );
  geometry.setIndex([0, 1, 2, 0, 3, 1]);
  geometry.computeVertexNormals();
  return geometry;
}

function createWhaleMouthGeometry() {
  const positions: number[] = [];
  const pointAt = (progress: number) =>
    [
      THREE.MathUtils.lerp(-0.185, 0.185, progress),
      -1.135 - Math.cos((progress - 0.5) * Math.PI) * 0.018,
      0.925 + Math.cos((progress - 0.5) * Math.PI) * 0.048,
    ] as const;

  for (let index = 0; index < 18; index += 1) {
    positions.push(...pointAt(index / 18), ...pointAt((index + 1) / 18));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );
  return geometry;
}

function WhaleBronzeMaterial() {
  return (
    <meshPhysicalMaterial
      color="#795035"
      emissive="#36140d"
      emissiveIntensity={0.34}
      metalness={0.8}
      roughness={0.34}
      clearcoat={0.38}
      clearcoatRoughness={0.4}
      side={THREE.DoubleSide}
    />
  );
}

function BronzeWhale({
  rotation,
  bodyGeometry,
  tailGeometry,
  leftFinGeometry,
  rightFinGeometry,
  mouthGeometry,
}: {
  rotation: number;
  bodyGeometry: THREE.BufferGeometry;
  tailGeometry: THREE.BufferGeometry;
  leftFinGeometry: THREE.BufferGeometry;
  rightFinGeometry: THREE.BufferGeometry;
  mouthGeometry: THREE.BufferGeometry;
}) {
  return (
    <group rotation={[0, rotation, 0]}>
      <mesh geometry={bodyGeometry} dispose={null} raycast={() => null}>
        <WhaleBronzeMaterial />
      </mesh>
      <mesh geometry={tailGeometry} dispose={null} raycast={() => null}>
        <WhaleBronzeMaterial />
      </mesh>
      <mesh geometry={leftFinGeometry} dispose={null} raycast={() => null}>
        <WhaleBronzeMaterial />
      </mesh>
      <mesh geometry={rightFinGeometry} dispose={null} raycast={() => null}>
        <WhaleBronzeMaterial />
      </mesh>

      <mesh
        position={[0, -0.94, 0.35]}
        rotation={[0.12, 0, 0]}
        scale={[0.085, 0.17, 0.16]}
        raycast={() => null}
      >
        <coneGeometry args={[1, 1.5, 22]} />
        <WhaleBronzeMaterial />
      </mesh>

      <lineSegments geometry={mouthGeometry} dispose={null} raycast={() => null}>
        <lineBasicMaterial
          color="#230b09"
          transparent
          opacity={0.82}
          toneMapped={false}
        />
      </lineSegments>

      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * 0.205, -1.055, 0.86]}
          scale={[0.018, 0.018, 0.011]}
          raycast={() => null}
        >
          <sphereGeometry args={[1, 16, 12]} />
          <meshPhysicalMaterial
            color="#0d0708"
            emissive="#d77930"
            emissiveIntensity={0.48}
            metalness={0.28}
            roughness={0.2}
          />
        </mesh>
      ))}
    </group>
  );
}

function MythicGlobeFrame() {
  const bodyGeometry = useMemo(createWhaleBodyGeometry, []);
  const tailGeometry = useMemo(createWhaleTailGeometry, []);
  const leftFinGeometry = useMemo(() => createWhaleFinGeometry(-1), []);
  const rightFinGeometry = useMemo(() => createWhaleFinGeometry(1), []);
  const mouthGeometry = useMemo(createWhaleMouthGeometry, []);

  useEffect(
    () => () => {
      bodyGeometry.dispose();
      tailGeometry.dispose();
      leftFinGeometry.dispose();
      rightFinGeometry.dispose();
      mouthGeometry.dispose();
    },
    [
      bodyGeometry,
      leftFinGeometry,
      mouthGeometry,
      rightFinGeometry,
      tailGeometry,
    ]
  );

  return (
    <group>
      <mesh raycast={() => null}>
        <torusGeometry args={[1.09, 0.014, 18, 256]} />
        <meshPhysicalMaterial
          color="#c58a43"
          emissive="#3b1506"
          emissiveIntensity={0.28}
          roughness={0.32}
          metalness={0.78}
          clearcoat={0.46}
          clearcoatRoughness={0.3}
        />
      </mesh>

      <mesh rotation={[Math.PI / 2, 0, 0]} raycast={() => null}>
        <torusGeometry args={[1.02, 0.008, 14, 256]} />
        <meshPhysicalMaterial
          color="#d59a50"
          emissive="#472007"
          emissiveIntensity={0.22}
          roughness={0.34}
          metalness={0.74}
          clearcoat={0.45}
        />
      </mesh>

      <mesh position={[0, 1.13, 0]} raycast={() => null}>
        <sphereGeometry args={[0.07, 24, 24]} />
        <meshPhysicalMaterial color="#c37a2c" metalness={0.85} roughness={0.24} />
      </mesh>

      {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((rotation) => (
        <BronzeWhale
          key={rotation}
          rotation={rotation}
          bodyGeometry={bodyGeometry}
          tailGeometry={tailGeometry}
          leftFinGeometry={leftFinGeometry}
          rightFinGeometry={rightFinGeometry}
          mouthGeometry={mouthGeometry}
        />
      ))}

      {[0.62, 1.02, 1.38].map((radius, index) => (
        <mesh
          key={radius}
          position={[0, -1.31 - index * 0.012, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          raycast={() => null}
        >
          <torusGeometry args={[radius, 0.0035, 6, 192]} />
          <meshBasicMaterial
            color={index === 0 ? "#f29548" : "#8b4ba5"}
            transparent
            opacity={0.2 - index * 0.035}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function ContemporaryGlobeFrame({
  visualStyle,
  economical,
}: {
  visualStyle: Exclude<GlobeVisualStyle, "antique">;
  economical: boolean;
}) {
  const earth = visualStyle === "earth";
  const primary = earth ? "#5fd6b2" : "#9b72ff";
  const secondary = earth ? "#9edfff" : "#ff8354";
  const emissive = earth ? "#115445" : "#34166b";
  const segments = economical ? 128 : 192;

  return (
    <group>
      <mesh raycast={() => null}>
        <torusGeometry args={[1.075, 0.0085, 12, segments]} />
        <meshPhysicalMaterial
          color={primary}
          emissive={emissive}
          emissiveIntensity={earth ? 0.26 : 0.48}
          roughness={earth ? 0.32 : 0.24}
          metalness={0.72}
          clearcoat={0.58}
          clearcoatRoughness={0.24}
        />
      </mesh>

      <mesh rotation={[Math.PI / 2, 0, 0]} raycast={() => null}>
        <torusGeometry args={[1.035, 0.0055, 10, segments]} />
        <meshPhysicalMaterial
          color={secondary}
          emissive={earth ? "#1a6556" : "#6f2518"}
          emissiveIntensity={earth ? 0.18 : 0.42}
          roughness={0.3}
          metalness={0.68}
          clearcoat={0.5}
        />
      </mesh>

      <mesh rotation={[0, Math.PI / 2, 0]} raycast={() => null}>
        <torusGeometry args={[1.035, 0.0035, 8, segments]} />
        <meshBasicMaterial
          color={primary}
          transparent
          opacity={earth ? 0.34 : 0.5}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {[0.7, 1.05].map((radius, index) => (
        <mesh
          key={radius}
          position={[0, -1.27 - index * 0.015, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          raycast={() => null}
        >
          <torusGeometry args={[radius, 0.003, 6, economical ? 96 : 144]} />
          <meshBasicMaterial
            color={index === 0 ? primary : secondary}
            transparent
            opacity={earth ? 0.18 - index * 0.04 : 0.28 - index * 0.05}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}

      <mesh position={[0, -1.18, 0]} raycast={() => null}>
        <cylinderGeometry args={[0.035, 0.055, 0.2, 32]} />
        <meshPhysicalMaterial
          color={earth ? "#173c55" : "#25133c"}
          emissive={earth ? "#0e4f55" : "#3b1b5f"}
          emissiveIntensity={0.2}
          roughness={0.28}
          metalness={0.76}
          clearcoat={0.62}
          clearcoatRoughness={0.2}
        />
      </mesh>
      <mesh position={[0, -1.31, 0]} raycast={() => null}>
        <cylinderGeometry args={[0.12, 0.21, 0.09, 40]} />
        <meshPhysicalMaterial
          color={earth ? "#102d42" : "#1d102e"}
          emissive={earth ? "#0c3d49" : "#30164c"}
          emissiveIntensity={0.16}
          roughness={0.32}
          metalness={0.72}
          clearcoat={0.54}
        />
      </mesh>
      <mesh position={[0, -1.4, 0]} raycast={() => null}>
        <cylinderGeometry args={[0.31, 0.42, 0.08, 48]} />
        <meshPhysicalMaterial
          color={earth ? "#0b2031" : "#160b24"}
          emissive={earth ? "#092b37" : "#25103b"}
          emissiveIntensity={0.14}
          roughness={0.36}
          metalness={0.68}
          clearcoat={0.48}
        />
      </mesh>
    </group>
  );
}

function ModernGlobeFrame({ economical }: { economical: boolean }) {
  const meridianRef = useRef<THREE.Group>(null);
  const segments = economical ? 112 : 176;
  const ticks = Array.from({ length: 13 }, (_, index) => {
    const angle = -Math.PI / 2 + (index / 12) * Math.PI;
    return { angle, x: Math.cos(angle) * 1.105, y: Math.sin(angle) * 1.105 };
  });

  useFrame(({ camera }) => {
    if (!meridianRef.current) return;
    meridianRef.current.rotation.y = Math.atan2(
      camera.position.x,
      camera.position.z
    );
  });

  return (
    <group>
      <group ref={meridianRef}>
        <group rotation={[0, 0, -0.16]}>
          <mesh rotation={[0, 0, -Math.PI / 2]} raycast={() => null}>
            <torusGeometry args={[1.105, 0.017, 14, segments, Math.PI]} />
            <meshPhysicalMaterial
              color="#11171b"
              roughness={0.34}
              metalness={0.78}
              clearcoat={0.42}
              clearcoatRoughness={0.28}
            />
          </mesh>

          {ticks.map(({ angle, x, y }, index) => (
            <mesh
              key={index}
              position={[x, y, 0.018]}
              rotation={[0, 0, angle]}
              raycast={() => null}
            >
              <boxGeometry args={[index % 3 === 0 ? 0.032 : 0.022, 0.005, 0.004]} />
              <meshBasicMaterial color="#61717a" toneMapped={false} />
            </mesh>
          ))}
        </group>
      </group>

      <mesh position={[0, -1.15, 0]} raycast={() => null}>
        <cylinderGeometry args={[0.065, 0.092, 0.3, 32]} />
        <meshPhysicalMaterial
          color="#11171b"
          roughness={0.36}
          metalness={0.76}
          clearcoat={0.4}
        />
      </mesh>
      <mesh position={[0, -1.32, 0]} raycast={() => null}>
        <cylinderGeometry args={[0.12, 0.22, 0.14, 40]} />
        <meshPhysicalMaterial
          color="#0d1215"
          roughness={0.4}
          metalness={0.72}
          clearcoat={0.36}
        />
      </mesh>
      <mesh position={[0, -1.445, 0]} raycast={() => null}>
        <cylinderGeometry args={[0.31, 0.38, 0.11, 48]} />
        <meshPhysicalMaterial
          color="#0b0f12"
          roughness={0.42}
          metalness={0.7}
          clearcoat={0.32}
        />
      </mesh>
    </group>
  );
}

function MuseumStarfield({
  economical,
  reducedMotion,
  animate,
}: {
  economical: boolean;
  reducedMotion: boolean;
  animate: boolean;
}) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const count = economical ? 900 : 2400;
  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const speeds = new Float32Array(count);
    const warmth = new Float32Array(count);
    const brightness = new Float32Array(count);
    let seed = 0x51f15e;

    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    for (let index = 0; index < count; index += 1) {
      const radius = 7.5 + random() * 11;
      const longitude = random() * Math.PI * 2;
      let x: number;
      let y: number;
      let z: number;

      if (random() < 0.38) {
        const bandLatitude =
          (random() + random() + random() + random() - 2) * 0.16;
        const bandRadius = Math.cos(bandLatitude);
        x = bandRadius * Math.cos(longitude);
        y = Math.sin(bandLatitude);
        z = bandRadius * Math.sin(longitude);
        const tilt = 0.48;
        const tiltedY = y * Math.cos(tilt) - z * Math.sin(tilt);
        const tiltedZ = y * Math.sin(tilt) + z * Math.cos(tilt);
        y = tiltedY;
        z = tiltedZ;
      } else {
        const latitude = Math.acos(2 * random() - 1);
        x = Math.sin(latitude) * Math.cos(longitude);
        y = Math.cos(latitude);
        z = Math.sin(latitude) * Math.sin(longitude);
      }

      const offset = index * 3;
      positions[offset] = radius * x;
      positions[offset + 1] = radius * y;
      positions[offset + 2] = radius * z;
      const brightStar = random() > 0.975;
      sizes[index] = brightStar
        ? 2.35 + random() * 1.65
        : 0.82 + Math.pow(random(), 2.2) * 1.05;
      phases[index] = random() * Math.PI * 2;
      speeds[index] = 0.28 + random() * 0.56;
      warmth[index] = random();
      brightness[index] = brightStar
        ? 0.86 + random() * 0.14
        : 0.32 + Math.pow(random(), 2.4) * 0.48;
    }

    const nextGeometry = new THREE.BufferGeometry();
    nextGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    nextGeometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    nextGeometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
    nextGeometry.setAttribute("aSpeed", new THREE.BufferAttribute(speeds, 1));
    nextGeometry.setAttribute("aWarmth", new THREE.BufferAttribute(warmth, 1));
    nextGeometry.setAttribute(
      "aBrightness",
      new THREE.BufferAttribute(brightness, 1)
    );
    nextGeometry.computeBoundingSphere();
    return nextGeometry;
  }, [count]);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uMotion: { value: reducedMotion ? 0 : 1 },
    }),
    [reducedMotion]
  );

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((_, delta) => {
    if (materialRef.current && animate && !reducedMotion) {
      materialRef.current.uniforms.uTime.value += Math.min(delta, 0.05);
    }
  });

  return (
    <points geometry={geometry} frustumCulled={false} raycast={() => null}>
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
        vertexShader={`
          attribute float aSize;
          attribute float aPhase;
          attribute float aSpeed;
          attribute float aWarmth;
          attribute float aBrightness;
          varying float vTwinkle;
          varying float vWarmth;
          varying float vBrightness;
          uniform float uTime;
          uniform float uMotion;

          void main() {
            vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
            float pulse = 0.94 + 0.06 * sin(aPhase + uTime * aSpeed * uMotion);
            float perspective = 9.5 / max(3.0, -viewPosition.z);
            gl_PointSize = clamp(aSize * pulse * perspective, 0.72, 4.2);
            gl_Position = projectionMatrix * viewPosition;
            vTwinkle = pulse;
            vWarmth = aWarmth;
            vBrightness = aBrightness;
          }
        `}
        fragmentShader={`
          varying float vTwinkle;
          varying float vWarmth;
          varying float vBrightness;

          void main() {
            vec2 centered = gl_PointCoord - vec2(0.5);
            float distanceFromCenter = length(centered);
            float core = smoothstep(0.47, 0.055, distanceFromCenter);
            float halo = smoothstep(0.5, 0.2, distanceFromCenter) * 0.24;
            float horizontalRay =
              smoothstep(0.08, 0.0, abs(centered.y)) *
              smoothstep(0.48, 0.05, abs(centered.x));
            float verticalRay =
              smoothstep(0.08, 0.0, abs(centered.x)) *
              smoothstep(0.48, 0.05, abs(centered.y));
            float diffraction =
              (horizontalRay + verticalRay) *
              smoothstep(0.82, 0.98, vBrightness) *
              0.18;
            vec3 cool = vec3(0.74, 0.84, 1.0);
            vec3 neutral = vec3(1.0, 0.97, 0.88);
            vec3 warm = vec3(1.0, 0.76, 0.46);
            vec3 color = mix(cool, neutral, smoothstep(0.15, 0.7, vWarmth));
            color = mix(color, warm, smoothstep(0.87, 1.0, vWarmth));
            float alpha =
              (core + halo + diffraction) *
              vTwinkle *
              mix(0.58, 0.98, vBrightness);
            gl_FragColor = vec4(color, alpha);
          }
        `}
      />
    </points>
  );
}

function MuseumSkyDome({
  reducedMotion,
  economical,
  animate,
}: {
  reducedMotion: boolean;
  economical: boolean;
  animate: boolean;
}) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uMotion: { value: reducedMotion ? 0 : 1 },
    }),
    [reducedMotion]
  );

  useFrame((_, delta) => {
    if (materialRef.current && animate && !reducedMotion) {
      materialRef.current.uniforms.uTime.value += Math.min(delta, 0.05) * 0.025;
    }
  });

  if (economical) {
    return (
      <mesh scale={22} raycast={() => null} renderOrder={-100}>
        <sphereGeometry args={[1, 24, 16]} />
        <meshBasicMaterial
          color="#050914"
          side={THREE.BackSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    );
  }

  return (
    <mesh scale={22} raycast={() => null} renderOrder={-100}>
      <sphereGeometry args={[1, 48, 32]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        side={THREE.BackSide}
        depthWrite={false}
        toneMapped={false}
        vertexShader={`
          varying vec3 vDirection;

          void main() {
            vDirection = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          varying vec3 vDirection;
          uniform float uTime;
          uniform float uMotion;

          float hash(vec3 point) {
            point = fract(point * 0.3183099 + vec3(0.1, 0.2, 0.3));
            point *= 17.0;
            return fract(point.x * point.y * point.z * (point.x + point.y + point.z));
          }

          float noise(vec3 point) {
            vec3 cell = floor(point);
            vec3 local = fract(point);
            local = local * local * (3.0 - 2.0 * local);
            return mix(
              mix(
                mix(hash(cell), hash(cell + vec3(1, 0, 0)), local.x),
                mix(hash(cell + vec3(0, 1, 0)), hash(cell + vec3(1, 1, 0)), local.x),
                local.y
              ),
              mix(
                mix(hash(cell + vec3(0, 0, 1)), hash(cell + vec3(1, 0, 1)), local.x),
                mix(hash(cell + vec3(0, 1, 1)), hash(cell + vec3(1, 1, 1)), local.x),
                local.y
              ),
              local.z
            );
          }

          float nebulaNoise(vec3 point) {
            float value = 0.0;
            value += noise(point) * 0.58;
            value += noise(point * 2.03 + 2.7) * 0.28;
            value += noise(point * 4.01 + 5.4) * 0.14;
            return value;
          }

          void main() {
            vec3 direction = normalize(vDirection);
            vec3 drift = vec3(uTime * uMotion, 0.0, -uTime * 0.42 * uMotion);
            float detail = nebulaNoise(direction * 3.15 + drift);
            vec3 galaxyNormal = normalize(vec3(0.05, 0.88, 0.47));
            float broadBand = pow(
              max(0.0, 1.0 - abs(dot(direction, galaxyNormal))),
              2.35
            );
            float galacticBand = pow(broadBand, 1.72);
            float cloud = smoothstep(0.39, 0.76, detail) * galacticBand;
            float dustLane =
              smoothstep(0.45, 0.73, 1.0 - detail) *
              pow(galacticBand, 1.4);
            float warmCloud =
              smoothstep(0.67, 0.9, detail) *
              pow(galacticBand, 2.2);

            vec3 color = vec3(0.0045, 0.0075, 0.017);
            color += vec3(0.025, 0.035, 0.07) * broadBand * 0.58;
            color += vec3(0.075, 0.07, 0.088) * cloud * 0.55;
            color -= vec3(0.012, 0.013, 0.016) * dustLane * 0.35;
            color += vec3(0.11, 0.055, 0.025) * warmCloud * 0.16;
            gl_FragColor = vec4(color, 1.0);
          }
        `}
      />
    </mesh>
  );
}

function CountrySphericalOutline({
  atlas,
  country,
  candidate = false,
  selected = false,
}: {
  atlas: GlobeAtlas;
  country?: Country | null;
  candidate?: boolean;
  selected?: boolean;
}) {
  const geometry = country ? atlas.outlineGeometryForCountry(country.id) : null;
  if (!geometry) return null;

  return (
    <lineSegments geometry={geometry} dispose={null} raycast={() => null}>
      <lineBasicMaterial
        color={selected ? "#ffd486" : candidate ? "#9fd8ff" : "#ff9a38"}
        transparent
        opacity={selected ? 0.98 : candidate ? 0.56 : 0.76}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </lineSegments>
  );
}

function CountryCentroidSelectionMarker({
  atlas,
  country,
}: {
  atlas: GlobeAtlas;
  country?: Country | null;
}) {
  // Countries without atlas geometry already use MicrostateMarkers below, so
  // only canonical atlas centroids are rendered here to avoid duplicate dots.
  const coordinates = country ? atlas.centroidForCountry(country.id) : null;
  if (!coordinates) return null;

  const position = geographicToSphere(coordinates[1], coordinates[0], 1.018);
  return (
    <group position={position} name={`edition-selection-${country?.id ?? "none"}`}>
      <mesh raycast={() => null}>
        <sphereGeometry args={[0.022, 20, 16]} />
        <meshStandardMaterial
          color="#fff0c4"
          emissive="#f67518"
          emissiveIntensity={4.4}
          roughness={0.32}
          metalness={0.3}
        />
      </mesh>
      <mesh scale={2.15} raycast={() => null}>
        <sphereGeometry args={[0.022, 20, 16]} />
        <meshBasicMaterial
          color="#ff9a38"
          transparent
          opacity={0.2}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

function GlobeSurface({
  atlas,
  visualStyle,
  overlayProfile,
  selectedCountry,
  candidateCountry,
  hoveredCountry,
  onCountrySelect,
  onCountryHover,
  economical,
  globeObjectRef,
  touchInteractionEnabled,
}: {
  atlas: GlobeAtlas;
  visualStyle: GlobeVisualStyle;
  overlayProfile: GlobeOverlayProfile;
  selectedCountry?: Country | null;
  candidateCountry?: Country | null;
  hoveredCountry?: Country | null;
  onCountrySelect?: (country: Country) => void;
  onCountryHover: (country: Country | null) => void;
  economical: boolean;
  globeObjectRef: RefObject<THREE.Mesh>;
  touchInteractionEnabled: boolean;
}) {
  const surfaceMaterial = globeSurfaceMaterials[visualStyle];
  const hoveredCountryId = useRef<string | null>(null);
  const pointerFrame = useRef(0);
  const latestPointerUv = useRef<THREE.Vector2 | null>(null);

  useEffect(
    () => () => {
      cancelAnimationFrame(pointerFrame.current);
    },
    []
  );

  useEffect(() => {
    hoveredCountryId.current = null;
    latestPointerUv.current = null;
    onCountryHover(null);
  }, [onCountryHover]);

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    if (event.nativeEvent.pointerType === "touch") return;

    latestPointerUv.current = event.uv?.clone() ?? null;
    if (pointerFrame.current) return;

    pointerFrame.current = requestAnimationFrame(() => {
      pointerFrame.current = 0;
      const uv = latestPointerUv.current;
      if (!uv) return;
      const country = atlas.countryAtUv(uv);
      const nextId = country?.id ?? null;
      if (hoveredCountryId.current === nextId) return;

      hoveredCountryId.current = nextId;
      onCountryHover(country);
    });
  };

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    const country = event.uv ? atlas.countryAtUv(event.uv) : null;
    if (country) onCountrySelect?.(country);
  };

  return (
    <group>
      <mesh
        ref={globeObjectRef}
        onPointerMove={handlePointerMove}
        onClick={touchInteractionEnabled ? handleClick : undefined}
        onPointerOut={() => {
          cancelAnimationFrame(pointerFrame.current);
          pointerFrame.current = 0;
          latestPointerUv.current = null;
          hoveredCountryId.current = null;
          onCountryHover(null);
        }}
      >
        <sphereGeometry args={[1, economical ? 112 : 144, economical ? 72 : 96]} />
        <meshPhysicalMaterial
          map={atlas.mapTexture}
          bumpMap={atlas.reliefTexture}
          bumpScale={surfaceMaterial.bumpScale}
          roughness={surfaceMaterial.roughness}
          metalness={surfaceMaterial.metalness}
          clearcoat={surfaceMaterial.clearcoat}
          clearcoatRoughness={surfaceMaterial.clearcoatRoughness}
          emissive={surfaceMaterial.emissive}
          emissiveIntensity={surfaceMaterial.emissiveIntensity}
        />

        {(overlayProfile.selectionRasterFill ||
          overlayProfile.selectionRasterOutline) && (
          <mesh raycast={() => null}>
            <sphereGeometry args={[1.006, economical ? 96 : 112, economical ? 64 : 72]} />
            <meshBasicMaterial
              map={atlas.highlightTexture}
              transparent
              depthWrite={false}
              toneMapped={false}
              blending={THREE.NormalBlending}
            />
          </mesh>
        )}

        {overlayProfile.selectionVectorOutline && (
          <>
            <CountrySphericalOutline
              atlas={atlas}
              country={
                candidateCountry?.id === selectedCountry?.id ||
                candidateCountry?.id === hoveredCountry?.id
                  ? null
                  : candidateCountry
              }
              candidate
            />
            <CountrySphericalOutline
              atlas={atlas}
              country={
                hoveredCountry?.id === selectedCountry?.id ? null : hoveredCountry
              }
            />
            <CountrySphericalOutline atlas={atlas} country={selectedCountry} selected />
          </>
        )}

        <mesh rotation={[Math.PI / 2, 0, 0]} raycast={() => null}>
          <torusGeometry args={[1.009, 0.0022, 8, economical ? 144 : 192]} />
          <meshBasicMaterial
            color={surfaceMaterial.equator}
            transparent
            opacity={selectedCountry ? 0.2 : 0.11}
            toneMapped={false}
          />
        </mesh>
      </mesh>

      {overlayProfile.selectionCentroidMarker && (
        <CountryCentroidSelectionMarker atlas={atlas} country={selectedCountry} />
      )}

      <MuseumAtmosphere visualStyle={visualStyle} />
    </group>
  );
}

function MicrostateMarker({
  country,
  coordinates,
  candidate,
  hovered,
  selected,
  onCountrySelect,
  onCountryHover,
  touchInteractionEnabled,
}: {
  country: Country;
  coordinates: [number, number];
  candidate: boolean;
  hovered: boolean;
  selected: boolean;
  onCountrySelect?: (country: Country) => void;
  onCountryHover: (country: Country | null) => void;
  touchInteractionEnabled: boolean;
}) {
  const pointerGesture = useRef<GlobePointerGesture | null>(null);
  const position = geographicToSphere(coordinates[1], coordinates[0], 1.016);
  const radius = selected ? 0.021 : hovered ? 0.018 : candidate ? 0.016 : 0.012;
  const color = selected
    ? "#ffe4aa"
    : hovered
      ? "#ffb45f"
      : candidate
        ? "#9fd8ff"
        : "#d9a650";

  return (
    <group
      position={position}
      onPointerOver={(event) => {
        if (event.nativeEvent.pointerType === "touch" && !touchInteractionEnabled) {
          return;
        }
        event.stopPropagation();
        onCountryHover(country);
      }}
      onPointerOut={(event) => {
        event.stopPropagation();
        pointerGesture.current = null;
        onCountryHover(null);
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
        startPointerGesture(pointerGesture, event);
      }}
      onPointerMove={(event) => {
        event.stopPropagation();
        trackPointerGesture(pointerGesture, event);
      }}
      onPointerUp={(event) => {
        event.stopPropagation();
        if (finishPointerGesture(pointerGesture, event)) {
          onCountrySelect?.(country);
        }
      }}
      onPointerCancel={() => {
        pointerGesture.current = null;
      }}
    >
      <mesh>
        <sphereGeometry args={[0.034, 14, 10]} />
        <meshBasicMaterial
          transparent
          opacity={0}
          depthWrite={false}
          colorWrite={false}
        />
      </mesh>
      <mesh raycast={() => null}>
        <sphereGeometry args={[radius, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={candidate && !hovered && !selected ? "#579fd0" : "#d48a2e"}
          emissiveIntensity={selected ? 4.2 : hovered ? 3 : candidate ? 2.5 : 2.1}
          roughness={0.45}
          metalness={0.24}
        />
      </mesh>
    </group>
  );
}

function GlobePagePanTapBridge({
  atlas,
  countries,
  globeObjectRef,
  active,
  onCountrySelect,
}: {
  atlas: GlobeAtlas;
  countries: Country[];
  globeObjectRef: RefObject<THREE.Mesh>;
  active: boolean;
  onCountrySelect?: (country: Country) => void;
}) {
  const { camera, gl } = useThree();
  const gestureRef = useRef<GlobePointerGesture | null>(null);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const ndc = useMemo(() => new THREE.Vector2(), []);
  const countriesById = useMemo(
    () => new Map(countries.map((country) => [country.id, country])),
    [countries]
  );
  const onCountrySelectRef = useRef(onCountrySelect);
  onCountrySelectRef.current = onCountrySelect;

  useEffect(() => {
    if (!active) {
      gestureRef.current = null;
      return undefined;
    }
    const canvas = gl.domElement;
    const handlePointerDown = (event: PointerEvent) => {
      if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) {
        return;
      }
      gestureRef.current = beginGlobePointerGesture(event);
    };
    const handlePointerMove = (event: PointerEvent) => {
      gestureRef.current = updateGlobePointerGesture(
        gestureRef.current,
        event
      );
    };
    const handlePointerUp = (event: PointerEvent) => {
      if (!isGlobePointerTap(gestureRef.current, event)) {
        gestureRef.current = null;
        return;
      }
      gestureRef.current = null;
      const globeObject = globeObjectRef.current;
      if (!globeObject) return;
      const bounds = canvas.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return;
      ndc.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1
      );
      const hit = raycastGlobeAtNdc({
        camera,
        globeObject,
        ndc,
        raycaster,
      });
      const country = hit ? atlas.countryAtUv(hit.uv) : null;
      const selectableCountry = country
        ? countriesById.get(country.id) ?? null
        : null;
      if (selectableCountry) {
        onCountrySelectRef.current?.(selectableCountry);
      }
    };
    const clearGesture = () => {
      gestureRef.current = null;
    };

    canvas.addEventListener("pointerdown", handlePointerDown, { passive: true });
    canvas.addEventListener("pointermove", handlePointerMove, { passive: true });
    canvas.addEventListener("pointerup", handlePointerUp, { passive: true });
    canvas.addEventListener("pointercancel", clearGesture, { passive: true });
    return () => {
      gestureRef.current = null;
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("pointercancel", clearGesture);
    };
  }, [active, atlas, camera, countriesById, gl, globeObjectRef, ndc, raycaster]);

  return null;
}

function MicrostateMarkers({
  atlas,
  countries,
  selectedCountry,
  candidateCountry,
  hoveredCountry,
  onCountrySelect,
  onCountryHover,
  touchInteractionEnabled,
}: {
  atlas: GlobeAtlas;
  countries: Country[];
  selectedCountry?: Country | null;
  candidateCountry?: Country | null;
  hoveredCountry?: Country | null;
  onCountrySelect?: (country: Country) => void;
  onCountryHover: (country: Country | null) => void;
  touchInteractionEnabled: boolean;
}) {
  const microstates = useMemo(
    () =>
      countries
        .filter((country) => !atlas.centroidForCountry(country.id))
        .map((country) => ({
          country,
          coordinates: fallbackCountryCoordinates(country),
        }))
        .filter(
          (
            item
          ): item is {
            country: Country;
            coordinates: [number, number];
          } => Boolean(item.coordinates)
        ),
    [atlas, countries]
  );

  return (
    <group>
      {microstates.map(({ country, coordinates }) => {
        const selected = selectedCountry?.id === country.id;
        const hovered = hoveredCountry?.id === country.id && !selected;
        const candidate =
          candidateCountry?.id === country.id && !selected && !hovered;

        return (
          <MicrostateMarker
            key={country.id}
            country={country}
            coordinates={coordinates}
            candidate={candidate}
            hovered={hovered}
            selected={selected}
            onCountrySelect={onCountrySelect}
            onCountryHover={onCountryHover}
            touchInteractionEnabled={touchInteractionEnabled}
          />
        );
      })}
    </group>
  );
}

function SelectedWriterLocationMarker({
  writer,
  coordinates,
}: {
  writer: Writer;
  coordinates: Readonly<{ latitude: number; longitude: number }>;
}) {
  const position = geographicToSphere(
    coordinates.longitude,
    coordinates.latitude,
    1.035
  );

  return (
    <group name={`selected-writer-location-${writer.id}`} position={position}>
      <mesh raycast={() => null}>
        <sphereGeometry args={[0.017, 18, 14]} />
        <meshStandardMaterial
          color="#fff0c4"
          emissive="#f67518"
          emissiveIntensity={4.4}
          roughness={0.32}
          metalness={0.3}
        />
      </mesh>
      <mesh scale={1.85} raycast={() => null}>
        <sphereGeometry args={[0.017, 18, 14]} />
        <meshBasicMaterial
          color="#ff9a38"
          transparent
          opacity={0.18}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

function GlobeScene({
  atlas,
  visualStyle,
  overlayProfile,
  countries,
  selectedCountry,
  selectedWriter,
  candidateCountry,
  hoveredCountry,
  onCountrySelect,
  onCountryHover,
  reducedMotion,
  economical,
  autoRotate,
  controlRequest,
  onInteractionStart,
  onInteractionEnd,
  showNobelLaureates,
  nobelCountryId,
  onWriterSelect,
  onLaureateHover,
  active,
  mobile,
  viewInsets,
  onCameraPhaseChange,
  onCameraFocusStarted,
  onCameraFocusCancelled,
  onCameraFocusSettled,
  onViewSample,
  focusRequest,
  touchInteractionEnabled,
}: {
  atlas: GlobeAtlas;
  visualStyle: GlobeVisualStyle;
  overlayProfile: GlobeOverlayProfile;
  countries: Country[];
  selectedCountry?: Country | null;
  selectedWriter?: Writer | null;
  candidateCountry?: Country | null;
  hoveredCountry?: Country | null;
  onCountrySelect?: (country: Country) => void;
  onCountryHover: (country: Country | null) => void;
  reducedMotion: boolean;
  economical: boolean;
  autoRotate: boolean;
  controlRequest: GlobeControlRequest | null;
  onInteractionStart: () => void;
  onInteractionEnd: () => void;
  showNobelLaureates: boolean;
  nobelCountryId?: string | null;
  onWriterSelect?: (country: Country, writer: Writer) => void;
  onLaureateHover: (laureate: NobelLayerHover | null) => void;
  active: boolean;
  mobile: boolean;
  viewInsets: ViewInsets;
  onCameraPhaseChange: (phase: GlobeCameraPhase) => void;
  onCameraFocusStarted: (intentKey: string) => void;
  onCameraFocusCancelled: (event: GlobeCameraCancellationEvent) => void;
  onCameraFocusSettled: (intentKey: string) => void;
  onViewSample: (sample: GlobeViewSample) => void;
  focusRequest?: GlobeExplicitFocusRequest | null;
  touchInteractionEnabled: boolean;
}) {
  const globeObjectRef = useRef<THREE.Mesh>(null);
  const [nobelDetailMode, setNobelDetailMode] =
    useState<NobelMarkerDetailMode>("clustered");
  const [viewSampleRequest, setViewSampleRequest] = useState(0);
  const palette = globeStylePalette[visualStyle];
  const matchingFocusRequest =
    selectedCountry &&
    focusRequest?.kind !== "home" &&
    focusRequest?.countryId === selectedCountry.id
      ? focusRequest
      : null;
  const explicitWriterCoordinates =
    matchingFocusRequest?.kind === "writer-focus" &&
    matchingFocusRequest.writerId === selectedWriter?.id &&
    matchingFocusRequest.coordinates
      ? matchingFocusRequest.coordinates
      : null;
  const focusIntent = useMemo<GlobeCameraFocusIntent | null>(() => {
    if (focusRequest?.kind === "home") {
      return { id: focusRequest.id, kind: "home" };
    }
    if (!selectedCountry) {
      return null;
    }
    let metrics = atlas.focusMetricsForCountry(selectedCountry.id);
    if (
      matchingFocusRequest?.kind === "writer-focus" &&
      matchingFocusRequest.coordinates
    ) {
      const direction = geographicToSphere(
        matchingFocusRequest.coordinates.longitude,
        matchingFocusRequest.coordinates.latitude
      ).normalize();
      metrics = {
        direction,
        angularRadius: THREE.MathUtils.degToRad(0.35),
        principalAngularExtent: THREE.MathUtils.degToRad(0.35),
        principalPolygonCount: 0,
        source: "fallback",
      } satisfies CountryFocusMetrics;
    }
    return metrics
      ? {
          id: matchingFocusRequest?.id ?? `country:${selectedCountry.id}`,
          kind: matchingFocusRequest?.kind ?? "country-focus",
          countryId: selectedCountry.id,
          metrics,
        }
      : null;
  }, [atlas, focusRequest, matchingFocusRequest, selectedCountry]);
  const updateNobelDetailMode = useCallback((view: GlobeCameraView) => {
    const radius = Math.hypot(...view.position);
    setNobelDetailMode((current) =>
      resolveNobelMarkerDetailMode(radius, current)
    );
  }, []);
  const handleViewSettled = useCallback(
    (view: GlobeCameraView) => {
      updateNobelDetailMode(view);
      setViewSampleRequest((request) => request + 1);
      if (focusIntent && view.source === focusIntent.kind) {
        onCameraFocusSettled(globeCameraIntentKey(focusIntent));
      }
    },
    [focusIntent, onCameraFocusSettled, updateNobelDetailMode]
  );

  return (
    <>
      <MuseumSkyDome
        reducedMotion={reducedMotion}
        economical={economical}
        animate={autoRotate}
      />
      <MuseumStarfield
        economical={economical}
        reducedMotion={reducedMotion}
        animate={autoRotate}
      />
      <ambientLight intensity={palette.ambientIntensity} color={palette.ambient} />
      <hemisphereLight
        args={[
          palette.hemisphereSky,
          palette.hemisphereGround,
          palette.hemisphereIntensity,
        ]}
      />
      <directionalLight
        position={[4.5, 3.4, 4]}
        intensity={palette.directionalIntensity}
        color={palette.directional}
      />
      <pointLight
        position={[-3.5, -0.7, 2]}
        intensity={palette.sideLightIntensity}
        distance={7}
        color={palette.sideLight}
      />
      <pointLight
        position={[0, -1.55, 2.35]}
        intensity={palette.lowerLightIntensity}
        distance={4.8}
        color={palette.lowerLight}
      />
      <pointLight
        position={[0, -1.2, -2.4]}
        intensity={
          visualStyle === "antique" ? 6.5 : visualStyle === "modern" ? 3.4 : 5.2
        }
        distance={4.6}
        color={palette.rearLight}
      />
      <pointLight
        position={[0, 3.5, -3]}
        intensity={visualStyle === "modern" ? 4.8 : 8}
        distance={7}
        color={palette.upperLight}
      />
      <spotLight
        position={[0.4, 4.2, 3.2]}
        angle={0.42}
        penumbra={0.82}
        intensity={palette.spotIntensity}
        distance={9}
        color={palette.spotLight}
      />

      <GlobeSurface
        atlas={atlas}
        visualStyle={visualStyle}
        overlayProfile={overlayProfile}
        selectedCountry={selectedCountry}
        candidateCountry={candidateCountry}
        hoveredCountry={hoveredCountry}
        onCountrySelect={onCountrySelect}
        onCountryHover={onCountryHover}
        economical={economical}
        globeObjectRef={globeObjectRef}
        touchInteractionEnabled={touchInteractionEnabled}
      />
      <GlobePagePanTapBridge
        atlas={atlas}
        countries={countries}
        globeObjectRef={globeObjectRef}
        active={!touchInteractionEnabled}
        onCountrySelect={onCountrySelect}
      />
      {visualStyle === "antique" ? (
        <MythicGlobeFrame />
      ) : visualStyle === "modern" ? (
        <ModernGlobeFrame economical={economical} />
      ) : (
        <ContemporaryGlobeFrame
          visualStyle={visualStyle}
          economical={economical}
        />
      )}
      <MicrostateMarkers
        atlas={atlas}
        countries={countries}
        selectedCountry={selectedCountry}
        candidateCountry={candidateCountry}
        hoveredCountry={hoveredCountry}
        onCountrySelect={onCountrySelect}
        onCountryHover={onCountryHover}
        touchInteractionEnabled={touchInteractionEnabled}
      />
      {selectedWriter && explicitWriterCoordinates && (
        <SelectedWriterLocationMarker
          writer={selectedWriter}
          coordinates={explicitWriterCoordinates}
        />
      )}
      {showNobelLaureates && (
        <NobelMarkerLayer
          atlas={atlas}
          countries={countries}
          nobelCountryId={nobelCountryId}
          selectedWriter={selectedWriter}
          detailMode={nobelDetailMode}
          touchInteractionEnabled={touchInteractionEnabled}
          onCountrySelect={(country) => onCountrySelect?.(country)}
          onWriterSelect={(country, writer) => {
            if (onWriterSelect) onWriterSelect(country, writer);
            else onCountrySelect?.(country);
          }}
          onHover={onLaureateHover}
        />
      )}
      <GlobeCameraRig
        focusIntent={focusIntent}
        controlRequest={controlRequest}
        autoRotate={autoRotate}
        reducedMotion={reducedMotion}
        mobile={mobile}
        active={active}
        interactionEnabled={touchInteractionEnabled}
        viewInsets={viewInsets}
        onInteractionStart={onInteractionStart}
        onInteractionEnd={onInteractionEnd}
        onPhaseChange={onCameraPhaseChange}
        onProgrammaticStart={onCameraFocusStarted}
        onProgrammaticCancel={onCameraFocusCancelled}
        onViewChange={updateNobelDetailMode}
        onViewSettled={handleViewSettled}
      />
      <GlobeViewObserver
        atlas={atlas}
        countries={countries}
        globeObjectRef={globeObjectRef}
        viewInsets={viewInsets}
        active={active}
        sampleRequest={viewSampleRequest}
        onSample={onViewSample}
      />
    </>
  );
}

export default function LiteraryGlobe({
  countries,
  atlasCountries,
  selectedCountry,
  selectedWriter,
  onCountrySelect,
  onWriterSelect,
  showNobelLaureates = false,
  nobelCountryId,
  mode = "embedded",
  rootRef,
  onViewSample,
  onHoverCountryChange,
  focusRequest,
  economical = false,
}: Props) {
  const { language, t, countryName, number } = useInterfaceLanguage();
  const initialEditionId = useRef(storedGlobeEdition());
  const initialLanguage = useRef(language);
  const languageRef = useRef(language);
  const renderedNaturalEarthLanguageRef = useRef(initialLanguage.current);
  languageRef.current = language;
  const atlasInstanceRef = useRef<GlobeAtlas | null>(null);
  const globeStyle = useGlobeStyleState({
    initialStyle: initialEditionId.current,
    applyStyle: async (editionId) => {
      const currentAtlas = atlasInstanceRef.current;
      if (!currentAtlas) throw new Error("globe-atlas-unavailable");
      const requestedLanguage = languageRef.current;
      await currentAtlas.setEdition(editionId, requestedLanguage);
      if (editionId === "natural-earth-2026") {
        renderedNaturalEarthLanguageRef.current = requestedLanguage;
      }
    },
    onCommit: (editionId) => {
      window.localStorage.setItem(GLOBE_EDITION_STORAGE_KEY, editionId);
    },
  });
  const renderedEditionId = globeStyle.renderedStyle;
  const pendingEditionId = globeStyle.pendingStyle;
  const renderedEdition = GLOBE_EDITION_BY_ID[renderedEditionId];
  const renderedVisualStyle = legacySurfaceProfileForEdition(renderedEditionId);
  const visualStyleError = Boolean(globeStyle.error);
  const sourceDialogRef = useRef<HTMLDialogElement>(null);
  const editionRailRef = useRef<HTMLDivElement>(null);
  const editionRailToggleRef = useRef<HTMLButtonElement>(null);
  const editionPreloadTimerRef = useRef<number | null>(null);
  const editionRailHideTimerRef = useRef<number | null>(null);
  const editionRailRestoreFocusRef = useRef(false);
  const editionRailFocusToggleAfterHideRef = useRef(false);
  const [atlas, setAtlas] = useState<GlobeAtlas | null>(null);
  const [atlasError, setAtlasError] = useState(false);
  const [atlasLoadRequest, setAtlasLoadRequest] = useState(0);
  const [hoveredCountry, setHoveredCountry] = useState<Country | null>(null);
  const [hoveredLaureate, setHoveredLaureate] =
    useState<NobelLayerHover | null>(null);
  const [viewSample, setViewSample] = useState<GlobeViewSample>({
    candidate: null,
    coordinates: null,
    cameraRadius: Math.hypot(...GLOBE_CAMERA_CONFIG.position),
    revision: 0,
  });
  const [keyboardCandidateActive, setKeyboardCandidateActive] = useState(false);
  const [editionRailVisible, setEditionRailVisible] = useState(true);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [globeVisible, setGlobeVisible] = useState(false);
  const [documentVisible, setDocumentVisible] = useState(
    () => document.visibilityState !== "hidden"
  );
  const globeActive = globeVisible && documentVisible;
  const [atlasRequested, setAtlasRequested] = useState(false);
  const [autoRotateRequested, setAutoRotateRequested] = useState(true);
  const [interactionPaused, setInteractionPaused] = useState(false);
  const [controlRequest, setControlRequest] =
    useState<GlobeControlRequest | null>(null);
  const [cameraPhase, setCameraPhase] = useState<GlobeCameraPhase>("idle");
  const [startedCameraIntent, setStartedCameraIntent] = useState("none");
  const [cancelledCameraMotion, setCancelledCameraMotion] =
    useState<GlobeCameraCancellationEvent | null>(null);
  const [settledCameraIntent, setSettledCameraIntent] = useState("none");
  const controlRequestId = useRef(0);
  const prewarmInputPauseUntilRef = useRef(0);
  const prewarmRuntimeRef = useRef({
    globeActive: false,
    interactionPaused: false,
    cameraBusy: false,
  });
  const setContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node;
      assignRef(rootRef, node);
    },
    [rootRef]
  );
  const autoRotateResumeTimer = useRef<number | null>(null);
  const hoveredNobelYear = hoveredLaureate?.kind === "writer"
    ? getNobelYear(hoveredLaureate.writer)
    : null;
  const contextualCountry = hoveredCountry ?? selectedCountry ?? null;
  const atlasSourceCountries = atlasCountries ?? countries;
  const selectableCountryIds = useMemo(
    () => new Set(countries.map((country) => country.id)),
    [countries]
  );
  const visibleNobelEntries = useMemo(
    () =>
      nobelCountryId
        ? collectCountryNobelLaureates(countries, nobelCountryId)
        : collectNobelLaureates(countries),
    [countries, nobelCountryId]
  );
  const visibleNobelCount = visibleNobelEntries.length;
  const [reducedMotion, setReducedMotion] = useState(() =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  const [coarsePointer, setCoarsePointer] = useState(() =>
    window.matchMedia("(any-pointer: coarse)").matches
  );
  const [touchActivationState, touchActivationDispatch] = useReducer(
    globeTouchActivationReducer,
    undefined,
    () =>
      createGlobeTouchActivationState({
        view: mode,
        pointer: coarsePointer ? "coarse" : "fine",
        reducedMotion,
        globeVisible: globeActive,
      })
  );
  const touchActivationPolicy = resolveGlobeTouchActivationPolicy(
    touchActivationState
  );
  const [viewportSize, setViewportSize] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  useEffect(() => {
    const rail = editionRailRef.current;
    if (!rail) return;
    const activeEdition = Array.from(
      rail.querySelectorAll<HTMLElement>("[data-globe-edition-option]")
    ).find(
      (element) => element.dataset.globeEditionOption === renderedEditionId
    );
    if (!activeEdition) return;
    const centeredLeft =
      activeEdition.offsetLeft - (rail.clientWidth - activeEdition.offsetWidth) / 2;
    const maximumLeft = Math.max(0, rail.scrollWidth - rail.clientWidth);
    const boundedLeft = Math.min(maximumLeft, Math.max(0, centeredLeft));
    const editionButtons = Array.from(
      rail.querySelectorAll<HTMLElement>("[data-globe-edition-option]")
    );
    const originLeft = editionButtons[0]?.offsetLeft ?? 0;
    const alignedLeft = editionButtons
      .map((editionButton) =>
        Math.max(0, editionButton.offsetLeft - originLeft)
      )
      .filter((candidate) => candidate <= maximumLeft)
      .reduce(
        (closest, candidate) =>
          Math.abs(candidate - boundedLeft) < Math.abs(closest - boundedLeft)
            ? candidate
            : closest,
        0
      );
    rail.scrollTo({
      left: Math.min(maximumLeft, alignedLeft),
      behavior: "auto",
    });
  }, [atlas, renderedEditionId, selectedCountry?.id, viewportSize.width]);
  useEffect(() => {
    let frame = 0;
    const updateViewport = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        setViewportSize({ width: window.innerWidth, height: window.innerHeight });
      });
    };
    window.addEventListener("resize", updateViewport, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateViewport);
    };
  }, []);
  const mobileGlobe = viewportSize.width <= 680;
  const cameraViewInsets = useMemo<ViewInsets>(() => {
    if (!selectedCountry) return { top: 0, right: 0, bottom: 0, left: 0 };
    if (viewportSize.width <= 980) {
      return { top: 0, right: 0, bottom: 154, left: 0 };
    }
    return {
      top: 0,
      right: mode === "immersive" ? 470 : 445,
      bottom: 0,
      left: 0,
    };
  }, [mode, selectedCountry, viewportSize.width]);
  const cameraFlightActive = cameraPhase === "programmatic";
  const cameraControlsActive = ["manual", "settling", "command"].includes(
    cameraPhase
  );
  prewarmRuntimeRef.current = {
    globeActive,
    interactionPaused,
    cameraBusy: cameraFlightActive || cameraControlsActive,
  };
  const autoRotatePolicy = resolveGlobeAutoRotationPolicy({
    requested: autoRotateRequested,
    reducedMotion,
    documentVisible,
    globeVisible,
    hasSelection: Boolean(selectedCountry),
    hasHover: Boolean(hoveredCountry || hoveredLaureate),
    interacting: interactionPaused || cameraControlsActive,
    cameraFlightActive,
  });
  const autoRotateActive = autoRotatePolicy.active;
  const autoRotateStatus = autoRotatePolicy.status;
  const autoRotateControlLabel = !autoRotateRequested
    ? t("Включить автоматическое вращение")
    : reducedMotion
      ? t("Автовращение отключено в режиме уменьшения движения")
      : selectedCountry
        ? t("Автовращение приостановлено, пока выбрана страна")
        : hoveredCountry || hoveredLaureate
          ? t("Автовращение приостановлено во время наведения")
          : cameraFlightActive
            ? t("Автовращение приостановлено во время перелёта камеры")
        : interactionPaused
          ? t("Автовращение приостановлено во время взаимодействия")
          : !globeActive
            ? t("Автовращение приостановлено вне экрана")
          : t("Остановить автоматическое вращение");
  const autoRotateControlCaption = [
    "selection",
    "hover",
    "interaction",
    "camera-flight",
    "reduced-motion",
    "document-hidden",
    "offscreen",
  ].includes(autoRotateStatus)
    ? t("Пауза")
    : t("Авто");
  const frameMode = resolveGlobeFrameMode({
    globeVisible,
    documentVisible,
    autoRotateActive,
    cameraFlightActive,
    controlsDampingActive: cameraControlsActive,
  });
  const sourceEdition = renderedEdition;
  const openSourceDialog = () => {
    const dialog = sourceDialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  };
  const clearEditionRailHideTimer = useCallback(() => {
    if (editionRailHideTimerRef.current === null) return;
    window.clearTimeout(editionRailHideTimerRef.current);
    editionRailHideTimerRef.current = null;
  }, []);
  const revealEditionRail = useCallback(() => {
    clearEditionRailHideTimer();
    setEditionRailVisible(true);
  }, [clearEditionRailHideTimer]);
  const hideEditionRail = useCallback(() => {
    const rail = editionRailRef.current;
    const shouldRestoreFocus =
      editionRailRestoreFocusRef.current ||
      Boolean(rail && rail.contains(document.activeElement));
    editionRailRestoreFocusRef.current = false;
    editionRailFocusToggleAfterHideRef.current = shouldRestoreFocus;
    setEditionRailVisible(false);
  }, []);
  const scheduleEditionRailHide = useCallback(() => {
    clearEditionRailHideTimer();
    editionRailHideTimerRef.current = window.setTimeout(() => {
      editionRailHideTimerRef.current = null;
      hideEditionRail();
    }, 650);
  }, [clearEditionRailHideTimer, hideEditionRail]);
  const openEditionRailFromToggle = useCallback(() => {
    editionRailRestoreFocusRef.current = false;
    revealEditionRail();
    window.requestAnimationFrame(() => {
      const rail = editionRailRef.current;
      const renderedButton = rail?.querySelector<HTMLButtonElement>(
        `button[data-globe-edition-option="${renderedEditionId}"]`
      );
      const target = renderedButton ?? rail?.querySelector<HTMLButtonElement>("button");
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({
        behavior: "auto",
        block: "nearest",
        inline: "nearest",
      });
    });
  }, [renderedEditionId, revealEditionRail]);
  const requestEdition = useCallback(
    async (editionId: GlobeEditionId) => {
      editionRailRestoreFocusRef.current = Boolean(
        editionRailRef.current?.contains(document.activeElement)
      );
      revealEditionRail();
      const outcome = await globeStyle.requestStyle(editionId);
      if (outcome === "committed" || outcome === "unchanged") {
        scheduleEditionRailHide();
      } else {
        editionRailRestoreFocusRef.current = false;
      }
    },
    [globeStyle.requestStyle, revealEditionRail, scheduleEditionRailHide]
  );
  const clearEditionPreload = useCallback(() => {
    if (editionPreloadTimerRef.current === null) return;
    window.clearTimeout(editionPreloadTimerRef.current);
    editionPreloadTimerRef.current = null;
  }, []);
  const preloadEdition = useCallback(
    (editionId: GlobeEditionId, delayMs = 0) => {
      clearEditionPreload();
      if (!atlas || editionId === renderedEditionId) return;
      const start = () => {
        editionPreloadTimerRef.current = null;
        void atlas.preloadEdition(editionId, language).catch(() => undefined);
      };
      if (delayMs > 0) {
        editionPreloadTimerRef.current = window.setTimeout(start, delayMs);
      } else {
        start();
      }
    },
    [atlas, clearEditionPreload, language, renderedEditionId]
  );

  useEffect(() => clearEditionPreload, [clearEditionPreload]);
  useEffect(() => clearEditionRailHideTimer, [clearEditionRailHideTimer]);

  useEffect(() => {
    revealEditionRail();
  }, [mode, revealEditionRail]);

  useEffect(() => {
    if (pendingEditionId || visualStyleError) revealEditionRail();
  }, [pendingEditionId, revealEditionRail, visualStyleError]);

  useLayoutEffect(() => {
    editionRailRef.current?.toggleAttribute("inert", !editionRailVisible);
    if (
      !editionRailVisible &&
      editionRailFocusToggleAfterHideRef.current
    ) {
      editionRailFocusToggleAfterHideRef.current = false;
      editionRailToggleRef.current?.focus({ preventScroll: true });
    }
  }, [editionRailVisible]);

  const handleEditionRailKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const navigationKeys = [
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "Home",
        "End",
      ];
      if (!navigationKeys.includes(event.key)) return;

      const rail = event.currentTarget;
      const buttons = Array.from(
        rail.querySelectorAll<HTMLButtonElement>(
          "button[data-globe-edition-option]:not(:disabled)"
        )
      );
      if (buttons.length === 0) return;

      const focusedButton = (event.target as Element | null)?.closest(
        "button[data-globe-edition-option]"
      );
      const focusedIndex = focusedButton
        ? buttons.indexOf(focusedButton as HTMLButtonElement)
        : -1;
      const currentIndex =
        focusedIndex >= 0
          ? focusedIndex
          : Math.max(
              0,
              buttons.findIndex(
                (button) =>
                  button.dataset.globeEditionOption === renderedEditionId
              )
            );

      let nextIndex = currentIndex;
      if (event.key === "Home") nextIndex = 0;
      if (event.key === "End") nextIndex = buttons.length - 1;
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        nextIndex = (currentIndex - 1 + buttons.length) % buttons.length;
      }
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        nextIndex = (currentIndex + 1) % buttons.length;
      }

      event.preventDefault();
      const nextButton = buttons[nextIndex];
      nextButton.focus({ preventScroll: true });
      nextButton.scrollIntoView({
        behavior: "auto",
        block: "nearest",
        inline: "nearest",
      });
    },
    [renderedEditionId]
  );

  const clearAutoRotateResumeTimer = useCallback(() => {
    if (autoRotateResumeTimer.current === null) return;
    window.clearTimeout(autoRotateResumeTimer.current);
    autoRotateResumeTimer.current = null;
  }, []);

  const markPrewarmInputActivity = useCallback((cooldownMs = 240) => {
    prewarmInputPauseUntilRef.current = Math.max(
      prewarmInputPauseUntilRef.current,
      performance.now() + cooldownMs
    );
  }, []);

  const handleGlobePointerMoveCapture = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      markPrewarmInputActivity();
      if (editionRailVisible || event.pointerType === "touch") return;

      const offsetFromTop =
        event.clientY - event.currentTarget.getBoundingClientRect().top;
      const revealBoundary = mode === "immersive" ? 96 : 84;
      if (offsetFromTop <= revealBoundary) {
        revealEditionRail();
      }
    }, [editionRailVisible, markPrewarmInputActivity, mode, revealEditionRail]
  );

  const shouldPauseFocusPrewarm = useCallback(() => {
    const runtime = prewarmRuntimeRef.current;
    return (
      !runtime.globeActive ||
      runtime.interactionPaused ||
      runtime.cameraBusy ||
      performance.now() < prewarmInputPauseUntilRef.current
    );
  }, []);

  const handleInteractionStart = useCallback(() => {
    clearAutoRotateResumeTimer();
    markPrewarmInputActivity(420);
    setKeyboardCandidateActive(false);
    setInteractionPaused(true);
  }, [clearAutoRotateResumeTimer, markPrewarmInputActivity]);

  const handleInteractionEnd = useCallback(() => {
    clearAutoRotateResumeTimer();
    autoRotateResumeTimer.current = window.setTimeout(() => {
      autoRotateResumeTimer.current = null;
      setInteractionPaused(false);
    }, GLOBE_INTERACTION_RESUME_DELAY_MS);
  }, [clearAutoRotateResumeTimer]);

  const requestGlobeControl = useCallback(
    (action: Exclude<GlobeControlAction, { type: "select" }>) => {
      handleInteractionStart();
      controlRequestId.current += 1;
      setControlRequest({ id: controlRequestId.current, action });
      handleInteractionEnd();
    },
    [handleInteractionEnd, handleInteractionStart]
  );

  const handleCountrySelect = useCallback(
    (country: Country) => {
      if (selectableCountryIds.has(country.id)) {
        setKeyboardCandidateActive(false);
        onCountrySelect?.(country, "pointer");
      }
    },
    [onCountrySelect, selectableCountryIds]
  );

  const handleCountryHover = useCallback(
    (country: Country | null) => {
      const nextCountry =
        country && selectableCountryIds.has(country.id) ? country : null;
      setHoveredCountry(nextCountry);
      onHoverCountryChange?.(nextCountry);
    },
    [onHoverCountryChange, selectableCountryIds]
  );

  const handleViewSample = useCallback(
    (sample: GlobeViewSample) => {
      setViewSample(sample);
      onViewSample?.(sample);
    },
    [onViewSample]
  );

  const toggleAutoRotate = useCallback(() => {
    clearAutoRotateResumeTimer();
    setInteractionPaused(false);
    setAutoRotateRequested((enabled) => !enabled);
  }, [clearAutoRotateResumeTimer]);

  const handleGlobeKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget) return;
      const action = globeControlActionForKey(event.key, event.shiftKey);
      if (!action) return;

      if (action.type === "select") {
        const country = keyboardCandidateActive ? viewSample.candidate : null;
        if (!country || !onCountrySelect) return;
        event.preventDefault();
        onCountrySelect(country, "keyboard");
        return;
      }

      event.preventDefault();
      requestGlobeControl(action);
      setKeyboardCandidateActive(action.type === "rotate");
    },
    [
      keyboardCandidateActive,
      onCountrySelect,
      requestGlobeControl,
      viewSample.candidate,
    ]
  );

  useEffect(
    () => () => {
      clearAutoRotateResumeTimer();
    },
    [clearAutoRotateResumeTimer]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let intersectsViewport = false;
    const update = () => {
      setGlobeVisible(intersectsViewport);
      setDocumentVisible(document.visibilityState !== "hidden");
    };
    const preloadObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setAtlasRequested(true);
      },
      { rootMargin: "160px", threshold: 0.01 }
    );
    const activityObserver = new IntersectionObserver(
      ([entry]) => {
        intersectsViewport = Boolean(entry?.isIntersecting);
        update();
      },
      { threshold: 0.01 }
    );
    preloadObserver.observe(container);
    activityObserver.observe(container);
    document.addEventListener("visibilitychange", update);
    return () => {
      preloadObserver.disconnect();
      activityObserver.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(media.matches);
    media.addEventListener("change", updatePreference);
    return () => media.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(any-pointer: coarse)");
    const updatePreference = () => setCoarsePointer(media.matches);
    updatePreference();
    media.addEventListener("change", updatePreference);
    return () => media.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    touchActivationDispatch({
      type: "SYNC_ENVIRONMENT",
      environment: {
        view: mode,
        pointer: coarsePointer ? "coarse" : "fine",
        reducedMotion,
        globeVisible: globeActive,
      },
    });
  }, [coarsePointer, globeActive, mode, reducedMotion]);

  useEffect(() => {
    if (!atlasRequested) return;
    let disposed = false;
    let createdAtlas: GlobeAtlas | null = null;
    let failedInitialEditionId: GlobeEditionId | null = null;
    const controller = new AbortController();
    const requestedInitialEditionId = initialEditionId.current;
    setAtlas(null);
    setAtlasError(false);

    createGlobeAtlas(
      atlasSourceCountries,
      requestedInitialEditionId,
      initialLanguage.current,
      { signal: controller.signal }
    )
      .catch(async (error: unknown) => {
        if (controller.signal.aborted) throw error;
        if (requestedInitialEditionId === DEFAULT_GLOBE_EDITION_ID) throw error;

        const fallbackAtlas = await createGlobeAtlas(
          atlasSourceCountries,
          DEFAULT_GLOBE_EDITION_ID,
          initialLanguage.current,
          { signal: controller.signal }
        );
        failedInitialEditionId = requestedInitialEditionId;
        return fallbackAtlas;
      })
      .then((nextAtlas) => {
        createdAtlas = nextAtlas;
        if (disposed) nextAtlas.dispose();
        else {
          atlasInstanceRef.current = nextAtlas;
          setAtlas(nextAtlas);
          if (failedInitialEditionId) {
            globeStyle.reportFallback(
              failedInitialEditionId,
              DEFAULT_GLOBE_EDITION_ID
            );
          } else {
            void globeStyle.requestStyle(requestedInitialEditionId, {
              force: true,
            });
          }
        }
      })
      .catch(() => {
        if (!disposed) setAtlasError(true);
      });

    return () => {
      disposed = true;
      controller.abort();
      if (atlasInstanceRef.current === createdAtlas) {
        atlasInstanceRef.current = null;
      }
      createdAtlas?.dispose();
    };
  }, [
    atlasLoadRequest,
    atlasRequested,
    atlasSourceCountries,
    globeStyle.reportFallback,
    globeStyle.requestStyle,
  ]);

  useEffect(() => {
    setHoveredCountry(null);
    setHoveredLaureate(null);
    setKeyboardCandidateActive(false);
    onHoverCountryChange?.(null);
  }, [countries, onHoverCountryChange]);

  useEffect(() => {
    atlas?.updateHighlight(
      selectedCountry?.id,
      hoveredCountry?.id,
      keyboardCandidateActive ? viewSample.candidate?.id : undefined
    );
  }, [
    atlas,
    hoveredCountry?.id,
    keyboardCandidateActive,
    selectedCountry?.id,
    viewSample.candidate?.id,
  ]);

  useEffect(() => {
    if (!atlas || !globeActive) return;
    return atlas.prewarmFocusMetrics(
      atlasSourceCountries.map((country) => country.id),
      { shouldPause: shouldPauseFocusPrewarm }
    );
  }, [atlas, atlasSourceCountries, globeActive, shouldPauseFocusPrewarm]);

  useEffect(() => {
    if (
      !atlas ||
      pendingEditionId ||
      visualStyleError ||
      renderedEditionId !== "natural-earth-2026" ||
      renderedNaturalEarthLanguageRef.current === language
    ) {
      return;
    }
    void globeStyle.requestStyle(renderedEditionId, { force: true });
  }, [
    atlas,
    globeStyle.requestStyle,
    language,
    pendingEditionId,
    renderedEditionId,
    visualStyleError,
  ]);

  if (!atlas) {
    return (
      <div
        ref={setContainerRef}
        className="literary-globe is-loading"
        data-globe-load-state={atlasError ? "error" : "loading"}
        data-globe-mode={mode}
        style={{ touchAction: mode === "immersive" ? "none" : "pan-y" }}
      >
        <div className="globe-loading">
          <span aria-hidden="true">✦</span>
          <p role={atlasError ? "alert" : "status"}>
            {atlasError
              ? t("Литературная планета временно недоступна")
              : t("Готовим интерактивный глобус…")}
          </p>
          {atlasError && (
            <button
              type="button"
              onClick={() => {
                setAtlasError(false);
                setAtlasRequested(true);
                setAtlasLoadRequest((request) => request + 1);
              }}
            >
              {t("Повторить загрузку глобуса")}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setContainerRef}
      className={`literary-globe${hoveredCountry ? " is-hovering" : ""}`}
      role="region"
      tabIndex={0}
      aria-label={t(
        "Интерактивный литературный глобус. Стрелки вращают, плюс и минус меняют масштаб, Home возвращает исходный вид."
      )}
      aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown + - Home Enter"
      onKeyDown={handleGlobeKeyDown}
      onPointerDownCapture={() => markPrewarmInputActivity(420)}
      onPointerMoveCapture={handleGlobePointerMoveCapture}
      onTouchStartCapture={() => markPrewarmInputActivity(420)}
      onTouchMoveCapture={() => markPrewarmInputActivity(320)}
      onWheelCapture={() => markPrewarmInputActivity(420)}
      onKeyDownCapture={(event) => {
        markPrewarmInputActivity(420);
        if (sourceDialogRef.current?.open) return;
        if (event.key !== "Escape" || !touchActivationPolicy.escapeDeactivates) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        touchActivationDispatch({ type: "ESCAPE" });
      }}
      data-globe-style={renderedVisualStyle}
      data-globe-edition={renderedEditionId}
      data-globe-edition-rail={editionRailVisible ? "visible" : "hidden"}
      data-globe-overlay-profile={renderedEdition.overlayProfile.profileId}
      data-globe-render-loop={globeActive ? "active" : "paused"}
      data-globe-frame-mode={frameMode}
      data-globe-auto-rotate={autoRotateStatus}
      data-globe-mode={mode}
      data-globe-touch-mode={touchActivationPolicy.mode}
      data-globe-camera-phase={cameraPhase}
      data-globe-camera-intent={
        focusRequest ? `${focusRequest.kind}:${String(focusRequest.id)}` : "none"
      }
      data-globe-camera-started-intent={startedCameraIntent}
      data-globe-camera-cancelled-intent={
        cancelledCameraMotion?.intentKey ?? "none"
      }
      data-globe-camera-cancellation-source={
        cancelledCameraMotion?.source ?? "none"
      }
      data-globe-camera-settled-intent={settledCameraIntent}
      data-globe-camera-radius={viewSample.cameraRadius.toFixed(4)}
      data-globe-view-revision={viewSample.revision}
      data-globe-view-country={viewSample.candidate?.id ?? "ocean"}
      data-globe-keyboard-candidate={
        keyboardCandidateActive ? viewSample.candidate?.id ?? "ocean" : "inactive"
      }
      data-globe-writer-marker={
        focusRequest?.kind === "writer-focus" &&
        selectedWriter &&
        focusRequest.writerId === selectedWriter.id &&
        focusRequest.countryId === selectedCountry?.id &&
        focusRequest.coordinates
          ? selectedWriter.id
          : "none"
      }
      style={{ touchAction: touchActivationPolicy.touchAction }}
    >
      <Canvas
        camera={GLOBE_CAMERA_CONFIG}
        dpr={[1, economical ? 1.1 : 1.5]}
        frameloop={frameMode}
        style={{ touchAction: touchActivationPolicy.touchAction }}
        fallback={
          <div className="globe-loading" role="status">
            <span aria-hidden="true">✦</span>
            <p>{t("Используйте текстовый указатель стран ниже")}</p>
          </div>
        }
        gl={{
          antialias: !economical,
          alpha: true,
          powerPreference: "high-performance",
        }}
      >
        <GlobeScene
          atlas={atlas}
          visualStyle={renderedVisualStyle}
          overlayProfile={renderedEdition.overlayProfile}
          countries={countries}
          selectedCountry={selectedCountry}
          selectedWriter={selectedWriter}
          candidateCountry={keyboardCandidateActive ? viewSample.candidate : null}
          hoveredCountry={hoveredCountry}
          onCountrySelect={handleCountrySelect}
          onCountryHover={handleCountryHover}
          reducedMotion={reducedMotion}
          economical={economical}
          autoRotate={autoRotateActive}
          controlRequest={controlRequest}
          onInteractionStart={handleInteractionStart}
          onInteractionEnd={handleInteractionEnd}
          showNobelLaureates={showNobelLaureates}
          nobelCountryId={nobelCountryId}
          onWriterSelect={onWriterSelect}
          onLaureateHover={setHoveredLaureate}
          active={globeActive}
          mobile={mobileGlobe}
          viewInsets={cameraViewInsets}
          onCameraPhaseChange={setCameraPhase}
          onCameraFocusStarted={setStartedCameraIntent}
          onCameraFocusCancelled={setCancelledCameraMotion}
          onCameraFocusSettled={setSettledCameraIntent}
          onViewSample={handleViewSample}
          focusRequest={focusRequest}
          touchInteractionEnabled={touchActivationPolicy.controlsEnabled}
        />
      </Canvas>

      {touchActivationPolicy.activationControl && (
        <Button
          className="globe-touch-activation"
          size="md"
          surface="dark"
          variant="secondary"
          data-globe-control="touch-activation"
          aria-pressed={touchActivationPolicy.controlsEnabled}
          onClick={() =>
            touchActivationDispatch({
              type:
                touchActivationPolicy.activationControl === "activate"
                  ? "ACTIVATE"
                  : "DEACTIVATE",
            })
          }
        >
          {touchActivationPolicy.activationControl === "activate"
            ? t("Управлять глобусом")
            : t("Вернуться к прокрутке")}
        </Button>
      )}

      <span className="globe-keyboard-status" role="status" aria-live="polite">
        {keyboardCandidateActive
          ? globeKeyboardCandidateAriaCopy({
              countryName: viewSample.candidate
                ? countryName(viewSample.candidate.code, viewSample.candidate.name)
                : null,
              writerCount: viewSample.candidate?.writers.length,
              selected: viewSample.candidate?.id === selectedCountry?.id,
              language,
            })
          : ""}
      </span>

      <div
        className="globe-controls"
        role="group"
        aria-label={t("Управление глобусом")}
      >
        <IconButton
          icon={<BrandPlusIcon />}
          surface="dark"
          data-globe-control="zoom-in"
          aria-label={t("Увеличить масштаб глобуса")}
          aria-keyshortcuts="+"
          title={t("Увеличить масштаб глобуса")}
          onClick={() =>
            requestGlobeControl({ type: "zoom", direction: "in" })
          }
        />
        <IconButton
          icon={<BrandMinusIcon />}
          surface="dark"
          data-globe-control="zoom-out"
          aria-label={t("Уменьшить масштаб глобуса")}
          aria-keyshortcuts="-"
          title={t("Уменьшить масштаб глобуса")}
          onClick={() =>
            requestGlobeControl({ type: "zoom", direction: "out" })
          }
        />
        <Button
          surface="dark"
          variant="text"
          startIcon={<BrandRotateIcon />}
          className={
            autoRotateRequested && !reducedMotion ? "is-active" : undefined
          }
          data-globe-control="auto-rotate"
          data-globe-auto-rotate-state={autoRotateStatus}
          aria-label={autoRotateControlLabel}
          aria-pressed={autoRotateRequested && !reducedMotion}
          disabled={reducedMotion}
          title={autoRotateControlLabel}
          onClick={toggleAutoRotate}
        >
          <small>{autoRotateControlCaption}</small>
        </Button>
        <Button
          surface="dark"
          variant="text"
          startIcon={<BrandResetIcon />}
          data-globe-control="reset"
          aria-label={t("Вернуть исходный вид глобуса")}
          aria-keyshortcuts="Home"
          title={t("Вернуть исходный вид глобуса")}
          onClick={() => {
            setHoveredCountry(null);
            setHoveredLaureate(null);
            requestGlobeControl({ type: "reset" });
          }}
        >
          <small>{t("Сброс")}</small>
        </Button>
        <Button
          surface="dark"
          variant="text"
          data-globe-control="edition-info"
          aria-label={t("Источник и права текущего издания глобуса")}
          title={t("Источник и права")}
          onClick={() => openSourceDialog()}
        >
          <small>{t("Источник")}</small>
        </Button>
      </div>

      <div
        className="globe-style-switch-reveal-zone"
        aria-hidden="true"
        onPointerEnter={(event) => {
          if (event.pointerType !== "touch") revealEditionRail();
        }}
      />

      <IconButton
        ref={editionRailToggleRef}
        className="globe-style-switch-toggle"
        icon={
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m7.5 9.5 4.5 4.5 4.5-4.5" />
          </svg>
        }
        surface="dark"
        data-globe-control="edition-rail-toggle"
        aria-label={t("Издание глобуса")}
        aria-controls="globe-edition-rail"
        aria-expanded={editionRailVisible}
        title={t("Издание глобуса")}
        onClick={openEditionRailFromToggle}
      />

      <div
        ref={editionRailRef}
        id="globe-edition-rail"
        className="globe-style-switch"
        role="group"
        aria-label={t("Издание глобуса")}
        aria-busy={Boolean(pendingEditionId)}
        aria-hidden={!editionRailVisible}
        onFocusCapture={revealEditionRail}
        onKeyDown={handleEditionRailKeyDown}
      >
        {AVAILABLE_GLOBE_EDITIONS.map((edition) => {
          const fullLabel = edition.fullLabel[language];
          const compactLabel = edition.compactLabel[language];
          const legacyStyle = edition.legacySurfaceProfile;
          return (
          <Button
            key={edition.id}
            surface="dark"
            variant="text"
            className={
              globeStyle.ariaPressedFor(edition.id) ? "is-active" : undefined
            }
            data-globe-style-option={legacyStyle}
            data-globe-edition-option={edition.id}
            aria-pressed={globeStyle.ariaPressedFor(edition.id)}
            loading={pendingEditionId === edition.id}
            aria-label={fullLabel}
            title={fullLabel}
            onPointerEnter={() => {
              preloadEdition(edition.id, 140);
            }}
            onPointerLeave={clearEditionPreload}
            onPointerDown={() => {
              preloadEdition(edition.id);
            }}
            onClick={() => {
              void requestEdition(edition.id);
            }}
          >
            <span className="globe-style-label-full">
              {compactLabel}
            </span>
            <span className="globe-style-label-compact" aria-hidden="true">
              {compactLabel}
            </span>
          </Button>
          );
        })}
      </div>

      <span
        className={`globe-style-status${visualStyleError ? " is-error" : ""}`}
        role={visualStyleError ? "alert" : "status"}
        aria-live={visualStyleError ? "assertive" : "polite"}
      >
        {visualStyleError
          ? t("Издание не загрузилось. Предыдущее издание сохранено.")
          : pendingEditionId
            ? `${t("Загружается издание")} «${GLOBE_EDITION_BY_ID[pendingEditionId].compactLabel[language]}»`
            : ""}
        {visualStyleError && (
          <button type="button" onClick={() => void globeStyle.retryStyle()}>
            {t("Повторить")}
          </button>
        )}
      </span>

      <dialog
        ref={sourceDialogRef}
        className="globe-edition-info-dialog"
        aria-labelledby="globe-edition-info-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
      >
        <article>
          <header>
            <p>{t("Источник издания")}</p>
            <h2 id="globe-edition-info-title">
              {sourceEdition.fullLabel[language]}
            </h2>
          </header>
          {sourceEdition.reconstructionNote && (
            <p>{sourceEdition.reconstructionNote[language]}</p>
          )}
          <dl>
            <dt>{t("Автор / составитель")}</dt>
            <dd>{sourceEdition.creator[language]}</dd>
            <dt>{t("Оригинал")}</dt>
            <dd>{sourceEdition.sourceTitle[language]}</dd>
            <dt>{t("Хранилище")}</dt>
            <dd>{sourceEdition.sourceInstitution[language]}</dd>
            {sourceEdition.sourceCatalogId && (
              <>
                <dt>{t("Каталожная запись")}</dt>
                <dd>{sourceEdition.sourceCatalogId}</dd>
              </>
            )}
            <dt>{t("Права и указание источника")}</dt>
            <dd>{sourceEdition.rightsSummary[language]}</dd>
            {sourceEdition.alignmentDisclosure && (
              <>
                <dt>{t("Совмещение карты")}</dt>
                <dd>{sourceEdition.alignmentDisclosure[language]}</dd>
              </>
            )}
          </dl>
          <p>
            <a href={sourceEdition.sourceUrl} target="_blank" rel="noreferrer">
              {t("Открыть запись источника")}
            </a>
          </p>
          <form method="dialog">
            <Button type="submit">{t("Закрыть")}</Button>
          </form>
        </article>
      </dialog>

      {renderedVisualStyle === "modern" && (
        <div
          className="globe-modern-badge"
          role="status"
          aria-live="polite"
          title={t(
            "Классический картографический атлас, редакция 2026 года. Картография: Natural Earth."
          )}
        >
          {t("Классический атлас · 2026")}
        </div>
      )}

      <div className="globe-vignette" aria-hidden="true" />
      <div className="globe-shadow" aria-hidden="true" />

      {showNobelLaureates && visibleNobelCount > 0 && (
        <details className="globe-nobel-status">
          <summary>
            <img
              src={`${import.meta.env.BASE_URL}brand/alfred-nobel-medallion.png`}
              alt=""
              aria-hidden="true"
              loading="lazy"
              decoding="async"
            />
            <div>
              <strong>{number(visibleNobelCount)}</strong>
              <span>
                {t(
                  selectInterfacePlural(visibleNobelCount, language, [
                    "лауреат на глобусе",
                    "лауреата на глобусе",
                    "лауреатов на глобусе",
                  ])
                )}
              </span>
            </div>
          </summary>
          <ul className="globe-nobel-index" aria-label={t("Нобелевские лауреаты")}>
            {visibleNobelEntries.map(({ country, writer }) => {
              const article = findNobelArticle(writer);
              return (
                <li key={`${country.id}:${writer.id}`}>
                  <button
                    id={nobelLaureateRowId(country.id, writer.id)}
                    type="button"
                    onClick={() => {
                      if (onWriterSelect) onWriterSelect(country, writer);
                      else handleCountrySelect(country);
                    }}
                  >
                    <span>{writerDisplayName(writer, t("Автор"), language)}</span>
                    <small>
                      {countryName(country.code, country.name)}
                      {getNobelYear(writer) ? ` · ${getNobelYear(writer)}` : ""}
                    </small>
                  </button>
                  {article && (
                    <a
                      className="globe-nobel-article-action"
                      href={articlePath(
                        article.id,
                        article.title,
                        article.sectionId,
                        article.slug
                      )}
                    >
                      {t("Статья о лауреате")}
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </details>
      )}

      {hoveredLaureate?.kind === "writer" ? (
        <div className="globe-country-label globe-laureate-label" role="tooltip">
          <WriterPortrait
            writer={hoveredLaureate.writer}
            className="globe-laureate-portrait"
            decorative
          />
          <div>
            <span>
              {writerDisplayName(
                hoveredLaureate.writer,
                t("Автор"),
                language
              )}
            </span>
            <small>
              {t("Нобелевский лауреат")}
              {hoveredNobelYear
                ? ` · ${hoveredNobelYear}`
                : ""}
              {` · ${countryName(
                hoveredLaureate.country.code,
                hoveredLaureate.country.name
              )}`}
            </small>
            <em>
              {t("Нажмите на метку - откроется карточка лауреата")}
            </em>
          </div>
        </div>
      ) : hoveredLaureate?.kind === "cluster" ? (
        <div className="globe-country-label globe-laureate-label" role="tooltip">
          <img
            src={`${import.meta.env.BASE_URL}brand/alfred-nobel-medallion.png`}
            className="globe-laureate-portrait"
            alt=""
            aria-hidden="true"
          />
          <div>
            <span>
              {countryName(
                hoveredLaureate.country.code,
                hoveredLaureate.country.name
              )}
            </span>
            <small>
              {number(hoveredLaureate.count)}{" "}
              {t(
                selectInterfacePlural(hoveredLaureate.count, language, [
                  "лауреат страны",
                  "лауреата страны",
                  "лауреатов страны",
                ])
              )}
              {hoveredLaureate.yearRange
                ? ` · ${hoveredLaureate.yearRange.first}-${hoveredLaureate.yearRange.last}`
                : ""}
            </small>
            <em>
              {t(
                "Нажмите на кластер - откроется Нобелевский контекст страны"
              )}
            </em>
          </div>
        </div>
      ) : contextualCountry ? (
        <div
          className="globe-country-label"
          role="status"
          aria-live={hoveredCountry ? "off" : "polite"}
          data-country-code={contextualCountry.code}
          data-country-label-source={hoveredCountry ? "hover" : "selection"}
        >
          <CountryFlagIcon
            code={contextualCountry.code}
            countryName={contextualCountry.name}
            className="globe-country-label-flag country-flag-icon--round"
            size={30}
            decorative
            priority
          />
          <div>
            <span>
              {countryName(contextualCountry.code, contextualCountry.name)}
            </span>
            <small>
              {number(contextualCountry.writers.length)}{" "}
              {t(
                selectInterfacePlural(contextualCountry.writers.length, language, [
                  "автор в архиве",
                  "автора в архиве",
                  "авторов в архиве",
                ])
              )}
            </small>
            <em>
              {hoveredCountry
                ? t("Нажмите, чтобы открыть архив страны")
                : t("Страна выбрана · карточка архива открыта")}
            </em>
          </div>
        </div>
      ) : null}

      <div className="globe-instruction" aria-hidden="true">
        <span>{t("Тяните или используйте стрелки")}</span>
        <i aria-hidden="true" />
        <span>{t("Колесо или ± - масштаб")}</span>
      </div>
    </div>
  );
}
