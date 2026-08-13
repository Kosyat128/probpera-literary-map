import { Canvas, type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useTexture } from "@react-three/drei";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import type { Country, Writer } from "../data/countries";
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
import { selectWriterDisplayName } from "../data/bookLocalization";
import CountryFlagIcon from "./CountryFlagIcon";
import WriterPortrait from "./WriterPortrait";
import {
  createGlobeAtlas,
  GLOBE_VISUAL_STYLE_LABELS,
  GLOBE_VISUAL_STYLES,
  isGlobeVisualStyle,
  type GlobeAtlas,
  type GlobeVisualStyle,
} from "./globeAtlas";
import { geographicToSphere } from "./globeGeography";
import {
  beginGlobePointerGesture,
  GLOBE_INTERACTION_RESUME_DELAY_MS,
  globeControlActionForKey,
  isGlobePointerTap,
  shouldGlobeAutoRotate,
  updateGlobePointerGesture,
  type GlobeControlAction,
  type GlobePointerGesture,
} from "./globeInteraction";

interface Props {
  countries: Country[];
  atlasCountries?: Country[];
  selectedCountry?: Country | null;
  selectedWriter?: Writer | null;
  onCountrySelect?: (country: Country) => void;
  onWriterSelect?: (country: Country, writer: Writer) => void;
  showNobelLaureates?: boolean;
  nobelCountryId?: string | null;
}

const GLOBE_STYLE_STORAGE_KEY = "probpera.globe-style.v1";

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

function storedGlobeVisualStyle(): GlobeVisualStyle {
  if (typeof window === "undefined") return "antique";

  try {
    const stored = window.localStorage.getItem(GLOBE_STYLE_STORAGE_KEY);
    return isGlobeVisualStyle(stored) ? stored : "antique";
  } catch {
    return "antique";
  }
}

function geoToCameraPosition(lat: number, lng: number, radius = 3.45) {
  return geographicToSphere(lng, lat, radius);
}

// The 1:110m Natural Earth sheet intentionally omits some very small states
// and islands. These geographic centers keep their 3D markers available even
// when a country's currently published writer cards have no usable location.
const COUNTRY_MARKER_COORDINATE_FALLBACKS: Readonly<
  Partial<Record<string, [latitude: number, longitude: number]>>
> = {
  AD: [42.5063, 1.5218],
  CK: [-21.2367, -159.7777],
  FM: [6.9248, 158.161],
  HK: [22.3193, 114.1694],
  KI: [1.4518, 172.9717],
  KM: [-11.6455, 43.3333],
  LI: [47.141, 9.5209],
  MC: [43.7384, 7.4246],
  MO: [22.1987, 113.5439],
  MU: [-20.1609, 57.5012],
  NR: [-0.5228, 166.9315],
  NU: [-19.0544, -169.8672],
  SC: [-4.6796, 55.492],
  SM: [43.9424, 12.4578],
  TV: [-8.5211, 179.1983],
  VA: [41.9029, 12.4534],
};

export function fallbackCountryCoordinates(
  country: Country
): [number, number] | null {
  if (Array.isArray(country.coordinates)) return country.coordinates;
  if (country.coordinates) return [country.coordinates.lat, country.coordinates.lng];

  const countryMarker = country.code
    ? COUNTRY_MARKER_COORDINATE_FALLBACKS[country.code.toUpperCase()]
    : null;
  if (countryMarker) return countryMarker;

  const points = country.writers
    .map((writer) => writer.coordinates)
    .filter((coordinates): coordinates is { lat: number; lng: number } => Boolean(coordinates));
  if (!points.length) {
    return null;
  }

  const vector = points.reduce(
    (sum, point) => {
      const lat = THREE.MathUtils.degToRad(point.lat);
      const lng = THREE.MathUtils.degToRad(point.lng);
      sum.x += Math.cos(lat) * Math.cos(lng);
      sum.y += Math.cos(lat) * Math.sin(lng);
      sum.z += Math.sin(lat);
      return sum;
    },
    new THREE.Vector3()
  );
  vector.normalize();

  return [
    THREE.MathUtils.radToDeg(Math.atan2(vector.z, Math.hypot(vector.x, vector.y))),
    THREE.MathUtils.radToDeg(Math.atan2(vector.y, vector.x)),
  ];
}

function writerDisplayName(
  writer: Writer,
  fallback = "Автор",
  language: "ru" | "en" = "ru"
) {
  return selectWriterDisplayName(writer, language, fallback);
}

type HoveredLaureate = {
  writer: Writer;
  country: Country;
};

type GlobeControlRequest = {
  id: number;
  action: Exclude<GlobeControlAction, { type: "select" }>;
};

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

function CameraFocus({
  countryId,
  coordinates,
  controlsRef,
  reducedMotion,
}: {
  countryId?: string | null;
  coordinates?: [number, number] | null;
  controlsRef: RefObject<OrbitControlsImpl>;
  reducedMotion: boolean;
}) {
  const { camera, invalidate } = useThree();
  const latitude = coordinates?.[0];
  const longitude = coordinates?.[1];

  useEffect(() => {
    const controls = controlsRef.current;

    if (
      !countryId ||
      latitude === undefined ||
      longitude === undefined
    ) {
      return;
    }

    const destination = geoToCameraPosition(latitude, longitude);
    const origin = camera.position.clone();
    const target = new THREE.Vector3(0, -0.2, 0);
    const startedAt = performance.now();
    const duration = reducedMotion ? 0 : 1450;
    let animationFrame = 0;

    const renderFrame = (now: number) => {
      const progress = duration === 0
        ? 1
        : THREE.MathUtils.clamp((now - startedAt) / duration, 0, 1);
      const eased = progress < 0.5
        ? 4 * progress ** 3
        : 1 - ((-2 * progress + 2) ** 3) / 2;

      camera.position.lerpVectors(origin, destination, eased);
      if (controls) {
        controls.target.copy(target);
        controls.update();
      } else {
        camera.lookAt(target);
      }
      invalidate();

      if (progress < 1) {
        animationFrame = requestAnimationFrame(renderFrame);
      }
    };
    renderFrame(startedAt);

    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, [
    camera,
    controlsRef,
    countryId,
    invalidate,
    latitude,
    longitude,
    reducedMotion,
  ]);

  return null;
}

function GlobeControlDriver({
  request,
  controlsRef,
}: {
  request: GlobeControlRequest | null;
  controlsRef: RefObject<OrbitControlsImpl>;
}) {
  const { camera, invalidate } = useThree();

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls || !request) return;

    const { action } = request;
    if (action.type === "rotate") {
      controls.setAzimuthalAngle(
        controls.getAzimuthalAngle() + action.azimuthDelta
      );
      controls.setPolarAngle(
        THREE.MathUtils.clamp(
          controls.getPolarAngle() + action.polarDelta,
          controls.minPolarAngle,
          controls.maxPolarAngle
        )
      );
    } else if (action.type === "zoom") {
      if (action.direction === "in") controls.dollyIn(1.18);
      else controls.dollyOut(1.18);
    } else {
      camera.position.set(0, 0.08, 4.9);
      camera.zoom = 1;
      camera.updateProjectionMatrix();
      controls.target.set(0, -0.2, 0);
      controls.update();
    }

    invalidate();
  }, [camera, controlsRef, invalidate, request]);

  return null;
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
}: {
  economical: boolean;
  reducedMotion: boolean;
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
    if (materialRef.current && !reducedMotion) {
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
}: {
  reducedMotion: boolean;
  economical: boolean;
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
    if (materialRef.current && !reducedMotion) {
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

function RendererResizeSync() {
  const { camera, gl } = useThree();

  useEffect(() => {
    const canvas = gl.domElement;
    const container = canvas.parentElement;
    if (!container) return;

    let animationFrame = 0;
    const synchronize = () => {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(() => {
        const rect = canvas.getBoundingClientRect();
        const width = Math.max(1, Math.round(rect.width));
        const height = Math.max(1, Math.round(rect.height));
        gl.setSize(width, height, false);

        if (camera instanceof THREE.PerspectiveCamera) {
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
        }
      });
    };

    const observer = new ResizeObserver(synchronize);
    observer.observe(container);
    window.addEventListener("resize", synchronize, { passive: true });
    synchronize();

    return () => {
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
      window.removeEventListener("resize", synchronize);
    };
  }, [camera, gl]);

  return null;
}

function CountrySphericalOutline({
  atlas,
  country,
  selected = false,
}: {
  atlas: GlobeAtlas;
  country?: Country | null;
  selected?: boolean;
}) {
  const geometry = country ? atlas.outlineGeometryForCountry(country.id) : null;
  if (!geometry) return null;

  return (
    <lineSegments geometry={geometry} dispose={null} raycast={() => null}>
      <lineBasicMaterial
        color={selected ? "#ffd486" : "#ff9a38"}
        transparent
        opacity={selected ? 0.98 : 0.72}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </lineSegments>
  );
}

function GlobeSurface({
  atlas,
  visualStyle,
  selectedCountry,
  hoveredCountry,
  onCountrySelect,
  onCountryHover,
  economical,
}: {
  atlas: GlobeAtlas;
  visualStyle: GlobeVisualStyle;
  selectedCountry?: Country | null;
  hoveredCountry?: Country | null;
  onCountrySelect?: (country: Country) => void;
  onCountryHover: (country: Country | null) => void;
  economical: boolean;
}) {
  const surfaceMaterial = globeSurfaceMaterials[visualStyle];
  const { camera, gl } = useThree();
  const globeMesh = useRef<THREE.Mesh>(null);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const normalizedPointer = useMemo(() => new THREE.Vector2(), []);
  const pointerGesture = useRef<GlobePointerGesture | null>(null);
  const hoveredCountryId = useRef<string | null>(null);
  const pointerFrame = useRef(0);
  const latestPointer = useRef<{ x: number; y: number } | null>(null);

  useEffect(
    () => () => {
      cancelAnimationFrame(pointerFrame.current);
    },
    []
  );

  useEffect(() => {
    hoveredCountryId.current = null;
    latestPointer.current = null;
    onCountryHover(null);
  }, [onCountryHover]);

  const countryFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const mesh = globeMesh.current;
      if (!mesh) return null;

      const bounds = gl.domElement.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return null;

      normalizedPointer.set(
        ((clientX - bounds.left) / bounds.width) * 2 - 1,
        -((clientY - bounds.top) / bounds.height) * 2 + 1
      );
      raycaster.setFromCamera(normalizedPointer, camera);
      mesh.updateWorldMatrix(true, false);

      const intersection = raycaster.intersectObject(mesh, false)[0];
      return intersection?.uv ? atlas.countryAtUv(intersection.uv) : null;
    },
    [atlas, camera, gl, normalizedPointer, raycaster]
  );

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    trackPointerGesture(pointerGesture, event);
    if (event.nativeEvent.pointerType === "touch") return;

    latestPointer.current = {
      x: event.nativeEvent.clientX,
      y: event.nativeEvent.clientY,
    };
    if (pointerFrame.current) return;

    pointerFrame.current = requestAnimationFrame(() => {
      pointerFrame.current = 0;
      const pointer = latestPointer.current;
      if (!pointer) return;
      const country = countryFromPointer(pointer.x, pointer.y);
      const nextId = country?.id ?? null;
      if (hoveredCountryId.current === nextId) return;

      hoveredCountryId.current = nextId;
      onCountryHover(country);
    });
  };

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    startPointerGesture(pointerGesture, event);
  };

  const handlePointerUp = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    if (!finishPointerGesture(pointerGesture, event)) return;

    const country = countryFromPointer(
      event.nativeEvent.clientX,
      event.nativeEvent.clientY
    );
    if (country) onCountrySelect?.(country);
  };

  return (
    <group>
      <mesh
        ref={globeMesh}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          pointerGesture.current = null;
        }}
        onPointerOut={() => {
          pointerGesture.current = null;
          cancelAnimationFrame(pointerFrame.current);
          pointerFrame.current = 0;
          latestPointer.current = null;
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

        <CountrySphericalOutline
          atlas={atlas}
          country={hoveredCountry?.id === selectedCountry?.id ? null : hoveredCountry}
        />
        <CountrySphericalOutline atlas={atlas} country={selectedCountry} selected />

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

      <MuseumAtmosphere visualStyle={visualStyle} />
    </group>
  );
}

function MicrostateMarker({
  country,
  coordinates,
  selected,
  onCountrySelect,
  onCountryHover,
}: {
  country: Country;
  coordinates: [number, number];
  selected: boolean;
  onCountrySelect?: (country: Country) => void;
  onCountryHover: (country: Country | null) => void;
}) {
  const pointerGesture = useRef<GlobePointerGesture | null>(null);
  const position = geoToCameraPosition(coordinates[0], coordinates[1], 1.016);

  return (
    <mesh
      position={position}
      onPointerOver={(event) => {
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
      <sphereGeometry args={[selected ? 0.019 : 0.012, 16, 16]} />
      <meshStandardMaterial
        color={selected ? "#ffe0a0" : "#d9a650"}
        emissive="#d48a2e"
        emissiveIntensity={selected ? 4.2 : 2.1}
        roughness={0.45}
        metalness={0.24}
      />
    </mesh>
  );
}

function MicrostateMarkers({
  atlas,
  countries,
  selectedCountry,
  onCountrySelect,
  onCountryHover,
}: {
  atlas: GlobeAtlas;
  countries: Country[];
  selectedCountry?: Country | null;
  onCountrySelect?: (country: Country) => void;
  onCountryHover: (country: Country | null) => void;
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

        return (
          <MicrostateMarker
            key={country.id}
            country={country}
            coordinates={coordinates}
            selected={selected}
            onCountrySelect={onCountrySelect}
            onCountryHover={onCountryHover}
          />
        );
      })}
    </group>
  );
}

function NobelLaureateMarker({
  country,
  writer,
  position,
  selected,
  reducedMotion,
  texture,
  onSelect,
  onHover,
}: {
  country: Country;
  writer: Writer;
  position: THREE.Vector3;
  selected: boolean;
  reducedMotion: boolean;
  texture: THREE.Texture;
  onSelect: (country: Country, writer: Writer) => void;
  onHover: (laureate: HoveredLaureate | null) => void;
}) {
  const marker = useRef<THREE.Group>(null);
  const pointerGesture = useRef<GlobePointerGesture | null>(null);

  useFrame(({ clock }) => {
    if (!marker.current || reducedMotion) return;
    const pulse = 1 + Math.sin(clock.elapsedTime * 2.1 + position.x * 4) * 0.1;
    marker.current.scale.setScalar(pulse);
  });

  return (
    <group
      ref={marker}
      position={position}
      onPointerOver={(event) => {
        event.stopPropagation();
        onHover({ country, writer });
      }}
      onPointerOut={(event) => {
        event.stopPropagation();
        pointerGesture.current = null;
        onHover(null);
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
          onSelect(country, writer);
        }
      }}
      onPointerCancel={() => {
        pointerGesture.current = null;
      }}
    >
      <sprite scale={selected ? [0.1, 0.1, 1] : [0.072, 0.072, 1]}>
        <spriteMaterial
          map={texture}
          color={selected ? "#fff4c4" : "#ffffff"}
          transparent
          alphaTest={0.025}
          depthWrite={false}
          toneMapped={false}
        />
      </sprite>
    </group>
  );
}

function NobelLaureateMarkers({
  atlas,
  countries,
  nobelCountryId,
  selectedWriter,
  reducedMotion,
  onSelect,
  onHover,
}: {
  atlas: GlobeAtlas;
  countries: Country[];
  nobelCountryId?: string | null;
  selectedWriter?: Writer | null;
  reducedMotion: boolean;
  onSelect: (country: Country, writer: Writer) => void;
  onHover: (laureate: HoveredLaureate | null) => void;
}) {
  const medalTexture = useTexture(
    `${import.meta.env.BASE_URL}brand/alfred-nobel-medallion.png`
  );
  medalTexture.colorSpace = THREE.SRGBColorSpace;

  const laureates = useMemo(() => {
    const entries = nobelCountryId
      ? collectCountryNobelLaureates(countries, nobelCountryId)
      : collectNobelLaureates(countries);
    const source = entries
      .flatMap(({ country, writer }) => {
        const countryCentroid = atlas.centroidForCountry(country.id);
        const fallback = countryCentroid
          ? { lat: countryCentroid[0], lng: countryCentroid[1] }
          : null;

        return [
          {
            country,
            writer,
            coordinates: writer.coordinates || fallback,
          },
        ]
          .filter(
            (
              item
            ): item is {
              country: Country;
              writer: Writer;
              coordinates: { lat: number; lng: number };
            } => Boolean(item.coordinates)
          );
      });

    const placed: typeof source = [];
    const distance = (
      first: { lat: number; lng: number },
      second: { lat: number; lng: number }
    ) => {
      const meanLatitude = THREE.MathUtils.degToRad((first.lat + second.lat) / 2);
      const longitudeDistance =
        (first.lng - second.lng) * Math.max(0.3, Math.cos(meanLatitude));
      return Math.hypot(first.lat - second.lat, longitudeDistance);
    };

    for (const [index, laureate] of source.entries()) {
      let coordinates = laureate.coordinates;
      let attempt = 0;

      while (
        placed.some(
          (candidate) =>
            candidate.country.id === laureate.country.id &&
            distance(candidate.coordinates, coordinates) < 2.15
        ) &&
        attempt < 18
      ) {
        attempt += 1;
        const ring = 1.55 + Math.floor((attempt - 1) / 6) * 1.05;
        const angle = index * 2.3999632297 + attempt * (Math.PI / 3);
        const longitudeScale = Math.max(
          0.32,
          Math.cos(THREE.MathUtils.degToRad(laureate.coordinates.lat))
        );
        coordinates = {
          lat: THREE.MathUtils.clamp(
            laureate.coordinates.lat + Math.sin(angle) * ring,
            -89.5,
            89.5
          ),
          lng:
            laureate.coordinates.lng +
            (Math.cos(angle) * ring) / longitudeScale,
        };
      }

      placed.push({ ...laureate, coordinates });
    }

    return placed;
  }, [atlas, countries, nobelCountryId]);

  return (
    <group>
      {laureates.map(({ country, writer, coordinates }) => (
        <NobelLaureateMarker
          key={`${country.id}:${writer.id}`}
          country={country}
          writer={writer}
          position={geographicToSphere(
            coordinates.lng,
            coordinates.lat,
            1.026
          )}
          selected={selectedWriter?.id === writer.id}
          reducedMotion={reducedMotion}
          texture={medalTexture}
          onSelect={onSelect}
          onHover={onHover}
        />
      ))}
    </group>
  );
}

function GlobeScene({
  atlas,
  visualStyle,
  countries,
  selectedCountry,
  selectedWriter,
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
}: {
  atlas: GlobeAtlas;
  visualStyle: GlobeVisualStyle;
  countries: Country[];
  selectedCountry?: Country | null;
  selectedWriter?: Writer | null;
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
  onLaureateHover: (laureate: HoveredLaureate | null) => void;
}) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const palette = globeStylePalette[visualStyle];
  const coordinates = selectedCountry
    ? atlas.centroidForCountry(selectedCountry.id) || fallbackCountryCoordinates(selectedCountry)
    : null;

  return (
    <>
      <RendererResizeSync />
      {visualStyle !== "modern" && (
        <>
          <MuseumSkyDome reducedMotion={reducedMotion} economical={economical} />
          <MuseumStarfield economical={economical} reducedMotion={reducedMotion} />
        </>
      )}
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
        selectedCountry={selectedCountry}
        hoveredCountry={hoveredCountry}
        onCountrySelect={onCountrySelect}
        onCountryHover={onCountryHover}
        economical={economical}
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
        onCountrySelect={onCountrySelect}
        onCountryHover={onCountryHover}
      />
      {showNobelLaureates && (
        <NobelLaureateMarkers
          atlas={atlas}
          countries={countries}
          nobelCountryId={nobelCountryId}
          selectedWriter={selectedWriter}
          reducedMotion={reducedMotion}
          onSelect={(country, writer) => {
            if (onWriterSelect) onWriterSelect(country, writer);
            else onCountrySelect?.(country);
          }}
          onHover={onLaureateHover}
        />
      )}
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.055}
        enablePan={false}
        enableZoom
        minDistance={2.25}
        maxDistance={5}
        minPolarAngle={0.5}
        maxPolarAngle={2.62}
        rotateSpeed={0.48}
        zoomSpeed={0.75}
        autoRotate={autoRotate}
        autoRotateSpeed={0.24}
        target={[0, -0.2, 0]}
        onStart={onInteractionStart}
        onEnd={onInteractionEnd}
      />
      <GlobeControlDriver request={controlRequest} controlsRef={controlsRef} />
      <CameraFocus
        countryId={selectedCountry?.id}
        coordinates={coordinates}
        controlsRef={controlsRef}
        reducedMotion={reducedMotion}
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
}: Props) {
  const { language, t, countryName, number } = useInterfaceLanguage();
  const [visualStyle, setVisualStyle] = useState<GlobeVisualStyle>(
    storedGlobeVisualStyle
  );
  const initialVisualStyle = useRef(visualStyle);
  const initialLanguage = useRef(language);
  const [renderedVisualStyle, setRenderedVisualStyle] =
    useState<GlobeVisualStyle>(visualStyle);
  const [pendingVisualStyle, setPendingVisualStyle] =
    useState<GlobeVisualStyle | null>(null);
  const [visualStyleError, setVisualStyleError] = useState(false);
  const [atlas, setAtlas] = useState<GlobeAtlas | null>(null);
  const [atlasError, setAtlasError] = useState(false);
  const [atlasLoadRequest, setAtlasLoadRequest] = useState(0);
  const [hoveredCountry, setHoveredCountry] = useState<Country | null>(null);
  const [hoveredLaureate, setHoveredLaureate] =
    useState<HoveredLaureate | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [globeActive, setGlobeActive] = useState(false);
  const [atlasRequested, setAtlasRequested] = useState(false);
  const [autoRotateRequested, setAutoRotateRequested] = useState(true);
  const [interactionPaused, setInteractionPaused] = useState(false);
  const [controlRequest, setControlRequest] =
    useState<GlobeControlRequest | null>(null);
  const controlRequestId = useRef(0);
  const autoRotateResumeTimer = useRef<number | null>(null);
  const hoveredNobelYear = hoveredLaureate
    ? getNobelYear(hoveredLaureate.writer)
    : null;
  const hoveredNobelArticle = hoveredLaureate
    ? findNobelArticle(hoveredLaureate.writer)
    : null;
  const contextualCountry = hoveredCountry ?? selectedCountry ?? null;
  const atlasSourceCountries = atlasCountries ?? countries;
  const selectableCountryIds = useMemo(
    () => new Set(countries.map((country) => country.id)),
    [countries]
  );
  const visibleNobelCount = useMemo(
    () =>
      nobelCountryId
        ? collectCountryNobelLaureates(countries, nobelCountryId).length
        : collectNobelLaureates(countries).length,
    [countries, nobelCountryId]
  );
  const [reducedMotion, setReducedMotion] = useState(() =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  const economical =
    ((navigator as Navigator & { deviceMemory?: number }).deviceMemory || 8) <= 4 ||
    navigator.hardwareConcurrency <= 4 ||
    window.devicePixelRatio >= 2.5 ||
    window.innerWidth <= 680;
  const autoRotateActive = shouldGlobeAutoRotate({
    requested: autoRotateRequested,
    reducedMotion,
    selectedCountryId: selectedCountry?.id,
    interactionPaused,
    visible: globeActive,
  });
  const autoRotateStatus = !autoRotateRequested
    ? "off"
    : reducedMotion
      ? "reduced-motion"
      : selectedCountry
        ? "selection"
        : interactionPaused
          ? "interaction"
          : globeActive
            ? "active"
            : "offscreen";
  const autoRotateControlLabel = !autoRotateRequested
    ? t("Включить автоматическое вращение")
    : reducedMotion
      ? t("Автовращение отключено в режиме уменьшения движения")
      : selectedCountry
        ? t("Автовращение приостановлено, пока выбрана страна")
        : interactionPaused
          ? t("Автовращение приостановлено во время взаимодействия")
          : t("Остановить автоматическое вращение");
  const autoRotateControlCaption = [
    "selection",
    "interaction",
    "reduced-motion",
  ].includes(autoRotateStatus)
    ? t("Пауза")
    : t("Авто");
  const sceneHasAmbientAnimation =
    renderedVisualStyle !== "modern" ||
    (showNobelLaureates && visibleNobelCount > 0);
  const frameMode = !globeActive
    ? "never"
    : !reducedMotion && (autoRotateActive || sceneHasAmbientAnimation)
      ? "always"
      : "demand";
  const visualStyleLabels: Record<GlobeVisualStyle, string> = {
    antique: t(GLOBE_VISUAL_STYLE_LABELS.antique.full),
    earth: t(GLOBE_VISUAL_STYLE_LABELS.earth.full),
    modern: t(GLOBE_VISUAL_STYLE_LABELS.modern.full),
  };
  const compactVisualStyleLabels: Record<GlobeVisualStyle, string> = {
    antique: t(GLOBE_VISUAL_STYLE_LABELS.antique.compact),
    earth: t(GLOBE_VISUAL_STYLE_LABELS.earth.compact),
    modern: t(GLOBE_VISUAL_STYLE_LABELS.modern.compact),
  };

  const clearAutoRotateResumeTimer = useCallback(() => {
    if (autoRotateResumeTimer.current === null) return;
    window.clearTimeout(autoRotateResumeTimer.current);
    autoRotateResumeTimer.current = null;
  }, []);

  const handleInteractionStart = useCallback(() => {
    clearAutoRotateResumeTimer();
    setInteractionPaused(true);
  }, [clearAutoRotateResumeTimer]);

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
      if (selectableCountryIds.has(country.id)) onCountrySelect?.(country);
    },
    [onCountrySelect, selectableCountryIds]
  );

  const handleCountryHover = useCallback(
    (country: Country | null) => {
      setHoveredCountry(
        country && selectableCountryIds.has(country.id) ? country : null
      );
    },
    [selectableCountryIds]
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
        const country = hoveredCountry ?? selectedCountry;
        if (!country || !onCountrySelect) return;
        event.preventDefault();
        onCountrySelect(country);
        return;
      }

      event.preventDefault();
      requestGlobeControl(action);
    },
    [hoveredCountry, onCountrySelect, requestGlobeControl, selectedCountry]
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
    const update = () =>
      setGlobeActive(
        intersectsViewport && document.visibilityState !== "hidden"
      );
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
    if (!atlasRequested) return;
    let disposed = false;
    let createdAtlas: GlobeAtlas | null = null;
    const controller = new AbortController();
    const requestedInitialStyle = initialVisualStyle.current;
    setAtlas(null);
    setAtlasError(false);

    createGlobeAtlas(
      atlasSourceCountries,
      requestedInitialStyle,
      initialLanguage.current,
      { signal: controller.signal }
    )
      .catch(async (error: unknown) => {
        if (controller.signal.aborted) throw error;
        if (requestedInitialStyle === "antique") throw error;

        const fallbackAtlas = await createGlobeAtlas(
          atlasSourceCountries,
          "antique",
          initialLanguage.current,
          { signal: controller.signal }
        );
        initialVisualStyle.current = "antique";
        if (!disposed) {
          setVisualStyleError(true);
          setVisualStyle("antique");
          try {
            window.localStorage.setItem(GLOBE_STYLE_STORAGE_KEY, "antique");
          } catch {
            // The in-session fallback is sufficient when storage is blocked.
          }
        }
        return fallbackAtlas;
      })
      .then((nextAtlas) => {
        createdAtlas = nextAtlas;
        if (disposed) nextAtlas.dispose();
        else {
          setRenderedVisualStyle(initialVisualStyle.current);
          setAtlas(nextAtlas);
        }
      })
      .catch(() => {
        if (!disposed) setAtlasError(true);
      });

    return () => {
      disposed = true;
      controller.abort();
      createdAtlas?.dispose();
    };
  }, [atlasLoadRequest, atlasRequested, atlasSourceCountries]);

  useEffect(() => {
    setHoveredCountry(null);
    setHoveredLaureate(null);
  }, [countries]);

  useEffect(() => {
    atlas?.updateHighlight(selectedCountry?.id, hoveredCountry?.id);
  }, [atlas, hoveredCountry?.id, selectedCountry?.id]);

  useEffect(() => {
    if (!atlas) return;
    let cancelled = false;
    setPendingVisualStyle(visualStyle);

    atlas
      .setVisualStyle(visualStyle, language)
      .then(() => {
        if (cancelled) return;
        setRenderedVisualStyle(visualStyle);
        setPendingVisualStyle(null);
        try {
          window.localStorage.setItem(GLOBE_STYLE_STORAGE_KEY, visualStyle);
        } catch {
          // Storage can be unavailable in strict privacy modes; the switch
          // still works for the current session.
        }
      })
      .catch(() => {
        if (cancelled) return;
        setPendingVisualStyle(null);
        setVisualStyleError(true);
        setVisualStyle("antique");
      });

    return () => {
      cancelled = true;
    };
  }, [atlas, language, visualStyle]);

  if (!atlas) {
    return (
      <div
        ref={containerRef}
        className="literary-globe is-loading"
        data-globe-load-state={atlasError ? "error" : "loading"}
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
      ref={containerRef}
      className={`literary-globe${hoveredCountry ? " is-hovering" : ""}`}
      role="region"
      tabIndex={0}
      aria-label={t(
        "Интерактивный литературный глобус. Стрелки вращают, плюс и минус меняют масштаб, Home возвращает исходный вид."
      )}
      aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown + - Home Enter"
      onKeyDown={handleGlobeKeyDown}
      data-globe-style={renderedVisualStyle}
      data-globe-render-loop={globeActive ? "active" : "paused"}
      data-globe-frame-mode={frameMode}
      data-globe-auto-rotate={autoRotateStatus}
    >
      <Canvas
        camera={{ position: [0, 0.08, 4.9], fov: 43, near: 0.1, far: 100 }}
        dpr={[1, economical ? 1.1 : 1.5]}
        frameloop={frameMode}
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
          countries={countries}
          selectedCountry={selectedCountry}
          selectedWriter={selectedWriter}
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
        />
      </Canvas>

      <div
        className="globe-controls"
        role="group"
        aria-label={t("Управление глобусом")}
      >
        <button
          type="button"
          data-globe-control="zoom-out"
          aria-label={t("Уменьшить масштаб глобуса")}
          aria-keyshortcuts="-"
          title={t("Уменьшить масштаб глобуса")}
          onClick={() =>
            requestGlobeControl({ type: "zoom", direction: "out" })
          }
        >
          <span aria-hidden="true">−</span>
        </button>
        <button
          type="button"
          data-globe-control="zoom-in"
          aria-label={t("Увеличить масштаб глобуса")}
          aria-keyshortcuts="+"
          title={t("Увеличить масштаб глобуса")}
          onClick={() =>
            requestGlobeControl({ type: "zoom", direction: "in" })
          }
        >
          <span aria-hidden="true">+</span>
        </button>
        <button
          type="button"
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
          <span aria-hidden="true">↻</span>
          <small>{autoRotateControlCaption}</small>
        </button>
        <button
          type="button"
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
          <span aria-hidden="true">⌂</span>
          <small>{t("Сброс")}</small>
        </button>
      </div>

      <div
        className="globe-style-switch"
        role="group"
        aria-label={t("Стиль глобуса")}
      >
        {GLOBE_VISUAL_STYLES.map((style) => (
          <button
            key={style}
            type="button"
            className={visualStyle === style ? "is-active" : undefined}
            data-globe-style-option={style}
            aria-pressed={visualStyle === style}
            aria-busy={pendingVisualStyle === style || undefined}
            aria-label={visualStyleLabels[style]}
            onPointerEnter={() => {
              if (style !== renderedVisualStyle) {
                void atlas.preloadVisualStyle(style, language).catch(() => undefined);
              }
            }}
            onFocus={() => {
              if (style !== renderedVisualStyle) {
                void atlas.preloadVisualStyle(style, language).catch(() => undefined);
              }
            }}
            onPointerDown={() => {
              if (style !== renderedVisualStyle) {
                void atlas.preloadVisualStyle(style, language).catch(() => undefined);
              }
            }}
            onClick={() => {
              setVisualStyleError(false);
              setVisualStyle(style);
            }}
          >
            <span className="globe-style-label-full">
              {visualStyleLabels[style]}
            </span>
            <span className="globe-style-label-compact" aria-hidden="true">
              {compactVisualStyleLabels[style]}
            </span>
          </button>
        ))}
        <span className="globe-style-status" role="status" aria-live="polite">
          {visualStyleError
            ? t("Текстуру Земли не удалось загрузить. Возвращён старинный стиль.")
            : pendingVisualStyle
              ? `${t("Загружается стиль")} «${visualStyleLabels[pendingVisualStyle]}»`
              : ""}
        </span>
      </div>

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
        <div className="globe-nobel-status" role="status" aria-live="polite">
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
        </div>
      )}

      {hoveredLaureate ? (
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
              {hoveredNobelArticle
                ? t("Нажмите на метку — откроется статья о лауреате")
                : t("Нажмите на метку — откроется карточка лауреата")}
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
        <span>{t("Колесо или ± — масштаб")}</span>
      </div>
    </div>
  );
}
