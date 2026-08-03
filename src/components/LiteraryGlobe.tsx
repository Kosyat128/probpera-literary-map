import { Canvas, type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useTexture } from "@react-three/drei";
import { gsap } from "gsap";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
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
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import CountryFlagIcon from "./CountryFlagIcon";
import WriterPortrait from "./WriterPortrait";
import { createGlobeAtlas, type GlobeAtlas } from "./globeAtlas";
import { geographicToSphere } from "./globeGeography";

interface Props {
  countries: Country[];
  selectedCountry?: Country | null;
  selectedWriter?: Writer | null;
  onCountrySelect?: (country: Country) => void;
  onWriterSelect?: (country: Country, writer: Writer) => void;
  showNobelLaureates?: boolean;
  nobelCountryId?: string | null;
}

function pluralRu(count: number, forms: [string, string, string]) {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return forms[2];
  if (last === 1) return forms[0];
  if (last >= 2 && last <= 4) return forms[1];
  return forms[2];
}

type PointerOrigin = {
  x: number;
  y: number;
};

function geoToCameraPosition(lat: number, lng: number, radius = 3.45) {
  return geographicToSphere(lng, lat, radius);
}

function fallbackCountryCoordinates(country: Country): [number, number] | null {
  if (Array.isArray(country.coordinates)) return country.coordinates;
  if (country.coordinates) return [country.coordinates.lat, country.coordinates.lng];

  const points = country.writers
    .map((writer) => writer.coordinates)
    .filter((coordinates): coordinates is { lat: number; lng: number } => Boolean(coordinates));
  if (!points.length) return null;

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

function writerDisplayName(writer: Writer) {
  return writer.name || writer.fullName || "Автор";
}

type HoveredLaureate = {
  writer: Writer;
  country: Country;
};

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
  const { camera } = useThree();

  useEffect(() => {
    const controls = controlsRef.current;

    if (!countryId || !coordinates) {
      if (controls) controls.autoRotate = !reducedMotion;
      return;
    }

    const [lat, lng] = coordinates;
    const destination = geoToCameraPosition(lat, lng);
    if (controls) controls.autoRotate = false;

    const cameraTween = gsap.to(camera.position, {
      x: destination.x,
      y: destination.y,
      z: destination.z,
      duration: reducedMotion ? 0.01 : 1.45,
      ease: "power3.inOut",
      overwrite: true,
      onUpdate: () => {
        camera.lookAt(0, -0.2, 0);
        controls?.update();
      },
    });

    const rotationResume = gsap.delayedCall(reducedMotion ? 0.02 : 1.75, () => {
      if (controlsRef.current) controlsRef.current.autoRotate = !reducedMotion;
    });

    return () => {
      cameraTween.kill();
      rotationResume.kill();
    };
  }, [camera, controlsRef, coordinates, countryId, reducedMotion]);

  return null;
}

function MuseumAtmosphere() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
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
          varying vec3 vWorldNormal;
          varying vec3 vWorldPosition;

          void main() {
            vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
            float fresnel = 1.0 - max(0.0, dot(normalize(vWorldNormal), viewDirection));
            float glow = pow(fresnel, 2.7);
            gl_FragColor = vec4(0.91, 0.55, 0.20, glow * 0.21);
          }
        `,
      }),
    []
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
  const radialSegments = 18;
  const positions: number[] = [];
  const indices: number[] = [];

  for (let slice = 0; slice <= longitudinalSegments; slice += 1) {
    const progress = slice / longitudinalSegments;
    const tailToBody = THREE.MathUtils.smoothstep(progress, 0.02, 0.5);
    const shoulderToHead = THREE.MathUtils.smoothstep(progress, 0.7, 1);
    const width =
      THREE.MathUtils.lerp(0.055, 0.225, tailToBody) *
      THREE.MathUtils.lerp(1, 0.92, shoulderToHead);
    const height =
      THREE.MathUtils.lerp(0.045, 0.165, tailToBody) *
      THREE.MathUtils.lerp(1, 0.94, shoulderToHead);
    const centerY = Math.sin(progress * Math.PI) * 0.035 - shoulderToHead * 0.012;
    const x = THREE.MathUtils.lerp(-0.72, 0.72, progress);

    for (let segment = 0; segment <= radialSegments; segment += 1) {
      const angle = (segment / radialSegments) * Math.PI * 2;
      positions.push(
        x,
        centerY + Math.sin(angle) * height,
        Math.cos(angle) * width
      );
    }
  }

  const row = radialSegments + 1;
  for (let slice = 0; slice < longitudinalSegments; slice += 1) {
    for (let segment = 0; segment < radialSegments; segment += 1) {
      const first = slice * row + segment;
      const second = first + row;
      indices.push(first, first + 1, second, second, first + 1, second + 1);
    }
  }

  const tailCapIndex = positions.length / 3;
  positions.push(-0.72, 0, 0);
  const headCapIndex = positions.length / 3;
  positions.push(0.72, -0.012, 0);
  for (let segment = 0; segment < radialSegments; segment += 1) {
    indices.push(tailCapIndex, segment + 1, segment);
    const headRow = longitudinalSegments * row;
    indices.push(headCapIndex, headRow + segment, headRow + segment + 1);
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

function createWhaleMouthGeometry() {
  const positions: number[] = [];
  const pointAt = (progress: number, side: -1 | 1) =>
    [
      THREE.MathUtils.lerp(0.54, 0.87, progress),
      -0.055 - Math.cos((progress - 0.5) * Math.PI) * 0.018,
      side * 0.224,
    ] as const;

  ([-1, 1] as const).forEach((side) => {
    for (let index = 0; index < 16; index += 1) {
      positions.push(
        ...pointAt(index / 16, side),
        ...pointAt((index + 1) / 16, side)
      );
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );
  return geometry;
}

function createWhaleThroatGeometry() {
  const positions: number[] = [];
  ([-1, 1] as const).forEach((side) => {
    for (let groove = 0; groove < 4; groove += 1) {
      const x = 0.53 + groove * 0.065;
      positions.push(x, -0.08, side * 0.226, x - 0.018, -0.145, side * 0.218);
    }
  });
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
      color="#8b6246"
      emissive="#32160c"
      emissiveIntensity={0.28}
      metalness={0.62}
      roughness={0.42}
      clearcoat={0.28}
      clearcoatRoughness={0.46}
      side={THREE.DoubleSide}
    />
  );
}

function BronzeWhale({
  position,
  rotationY,
  scale,
  bodyGeometry,
  mouthGeometry,
  throatGeometry,
}: {
  position: [number, number, number];
  rotationY: number;
  scale: number;
  bodyGeometry: THREE.BufferGeometry;
  mouthGeometry: THREE.BufferGeometry;
  throatGeometry: THREE.BufferGeometry;
}) {
  return (
    <group
      position={position}
      rotation={[0, rotationY, 0]}
      scale={scale}
    >
      <mesh geometry={bodyGeometry} dispose={null} raycast={() => null}>
        <WhaleBronzeMaterial />
      </mesh>

      <mesh position={[0.71, -0.018, 0]} scale={[0.3, 0.16, 0.27]} raycast={() => null}>
        <sphereGeometry args={[1, 24, 16]} />
        <WhaleBronzeMaterial />
      </mesh>

      {([-1, 1] as const).map((side) => (
        <mesh
          key={`fluke-${side}`}
          position={[-0.79, -0.005, side * 0.17]}
          rotation={[side * 0.32, side * -0.35, side * 0.04]}
          scale={[0.18, 0.038, 0.245]}
          raycast={() => null}
        >
          <sphereGeometry args={[1, 18, 9]} />
          <WhaleBronzeMaterial />
        </mesh>
      ))}

      {([-1, 1] as const).map((side) => (
        <mesh
          key={`pectoral-${side}`}
          position={[0.06, -0.15, side * 0.21]}
          rotation={[side * 0.1, side * 0.38, side * -0.08]}
          scale={[0.39, 0.034, 0.09]}
          raycast={() => null}
        >
          <sphereGeometry args={[1, 18, 9]} />
          <WhaleBronzeMaterial />
        </mesh>
      ))}

      <mesh position={[-0.05, 0.205, 0]} rotation={[0, Math.PI / 4, 0]} raycast={() => null}>
        <coneGeometry args={[0.075, 0.17, 4]} />
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

      <lineSegments geometry={throatGeometry} dispose={null} raycast={() => null}>
        <lineBasicMaterial
          color="#35130d"
          transparent
          opacity={0.68}
          toneMapped={false}
        />
      </lineSegments>

      {([-1, 1] as const).map((side) => (
        <mesh
          key={`mouth-${side}`}
          position={[0.71, -0.063, side * 0.237]}
          rotation={[0, 0, -0.045]}
          scale={[0.16, 0.01, 0.012]}
          raycast={() => null}
        >
          <sphereGeometry args={[1, 14, 7]} />
          <meshBasicMaterial color="#210b08" toneMapped={false} />
        </mesh>
      ))}

      {[
        [0.79, 0.105, 0.12],
        [0.85, 0.075, -0.13],
        [0.9, 0.025, 0.1],
      ].map(([x, y, z], index) => (
        <mesh key={`tubercle-${index}`} position={[x, y, z]} raycast={() => null}>
          <sphereGeometry args={[0.017, 9, 7]} />
          <WhaleBronzeMaterial />
        </mesh>
      ))}

      {([-1, 1] as const).map((side) => (
        <mesh key={`eye-${side}`} position={[0.75, 0.055, side * 0.215]} raycast={() => null}>
          <sphereGeometry args={[0.033, 12, 8]} />
          <meshPhysicalMaterial
            color="#080405"
            emissive="#d77930"
            emissiveIntensity={0.42}
            metalness={0.22}
            roughness={0.24}
          />
        </mesh>
      ))}

      <mesh position={[0.54, 0.175, 0]} rotation={[Math.PI / 2, 0, 0]} raycast={() => null}>
        <torusGeometry args={[0.027, 0.006, 7, 14]} />
        <meshBasicMaterial color="#1d0a08" toneMapped={false} />
      </mesh>
    </group>
  );
}

function MythicGlobeFrame() {
  const bodyGeometry = useMemo(createWhaleBodyGeometry, []);
  const mouthGeometry = useMemo(createWhaleMouthGeometry, []);
  const throatGeometry = useMemo(createWhaleThroatGeometry, []);

  useEffect(
    () => () => {
      bodyGeometry.dispose();
      mouthGeometry.dispose();
      throatGeometry.dispose();
    },
    [bodyGeometry, mouthGeometry, throatGeometry]
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

      {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((angle) => (
        <BronzeWhale
          key={angle}
          position={[
            Math.sin(angle) * 0.58,
            -1.13,
            Math.cos(angle) * 0.58,
          ]}
          rotationY={angle}
          scale={0.64}
          bodyGeometry={bodyGeometry}
          mouthGeometry={mouthGeometry}
          throatGeometry={throatGeometry}
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
  selectedCountry,
  hoveredCountry,
  onCountrySelect,
  onCountryHover,
  economical,
}: {
  atlas: GlobeAtlas;
  selectedCountry?: Country | null;
  hoveredCountry?: Country | null;
  onCountrySelect?: (country: Country) => void;
  onCountryHover: (country: Country | null) => void;
  economical: boolean;
}) {
  const { camera, gl } = useThree();
  const globeMesh = useRef<THREE.Mesh>(null);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const normalizedPointer = useMemo(() => new THREE.Vector2(), []);
  const pointerOrigin = useRef<PointerOrigin | null>(null);
  const hoveredCountryId = useRef<string | null>(null);
  const pointerFrame = useRef(0);
  const latestPointer = useRef<PointerOrigin | null>(null);

  useEffect(
    () => () => {
      cancelAnimationFrame(pointerFrame.current);
    },
    []
  );

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
    pointerOrigin.current = {
      x: event.nativeEvent.clientX,
      y: event.nativeEvent.clientY,
    };
  };

  const handlePointerUp = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    const start = pointerOrigin.current;
    pointerOrigin.current = null;
    if (!start) return;

    const distance = Math.hypot(
      event.nativeEvent.clientX - start.x,
      event.nativeEvent.clientY - start.y
    );
    if (distance > 7) return;

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
        onPointerOut={() => {
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
          bumpScale={0.028}
          roughness={0.68}
          metalness={0.035}
          clearcoat={0.24}
          clearcoatRoughness={0.58}
          emissive="#2b160c"
          emissiveIntensity={0.045}
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
            color="#e5b66a"
            transparent
            opacity={selectedCountry ? 0.2 : 0.11}
            toneMapped={false}
          />
        </mesh>
      </mesh>

      <MuseumAtmosphere />
    </group>
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
        const position = geoToCameraPosition(coordinates[0], coordinates[1], 1.016);

        return (
          <mesh
            key={country.id}
            position={position}
            onPointerOver={(event) => {
              event.stopPropagation();
              onCountryHover(country);
            }}
            onPointerOut={(event) => {
              event.stopPropagation();
              onCountryHover(null);
            }}
            onClick={(event) => {
              event.stopPropagation();
              onCountrySelect?.(country);
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
        onHover(null);
      }}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(country, writer);
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
  countries,
  selectedCountry,
  selectedWriter,
  hoveredCountry,
  onCountrySelect,
  onCountryHover,
  reducedMotion,
  economical,
  showNobelLaureates,
  nobelCountryId,
  onWriterSelect,
  onLaureateHover,
}: {
  atlas: GlobeAtlas;
  countries: Country[];
  selectedCountry?: Country | null;
  selectedWriter?: Writer | null;
  hoveredCountry?: Country | null;
  onCountrySelect?: (country: Country) => void;
  onCountryHover: (country: Country | null) => void;
  reducedMotion: boolean;
  economical: boolean;
  showNobelLaureates: boolean;
  nobelCountryId?: string | null;
  onWriterSelect?: (country: Country, writer: Writer) => void;
  onLaureateHover: (laureate: HoveredLaureate | null) => void;
}) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const coordinates = selectedCountry
    ? atlas.centroidForCountry(selectedCountry.id) || fallbackCountryCoordinates(selectedCountry)
    : null;

  return (
    <>
      <RendererResizeSync />
      <MuseumSkyDome reducedMotion={reducedMotion} economical={economical} />
      <MuseumStarfield economical={economical} reducedMotion={reducedMotion} />
      <ambientLight intensity={0.66} color="#f7d29a" />
      <hemisphereLight args={["#ffe2ab", "#170620", 1.12]} />
      <directionalLight position={[4.5, 3.4, 4]} intensity={2.35} color="#ffd6a0" />
      <pointLight position={[-3.5, -0.7, 2]} intensity={13} distance={7} color="#c45b24" />
      <pointLight position={[0, -1.55, 2.35]} intensity={9.5} distance={4.8} color="#e89a5d" />
      <pointLight position={[0, -1.2, -2.4]} intensity={6.5} distance={4.6} color="#7b3c91" />
      <pointLight position={[0, 3.5, -3]} intensity={8} distance={7} color="#6f2b8d" />
      <spotLight
        position={[0.4, 4.2, 3.2]}
        angle={0.42}
        penumbra={0.82}
        intensity={7.5}
        distance={9}
        color="#ffe3b1"
      />

      <GlobeSurface
        atlas={atlas}
        selectedCountry={selectedCountry}
        hoveredCountry={hoveredCountry}
        onCountrySelect={onCountrySelect}
        onCountryHover={onCountryHover}
        economical={economical}
      />
      <MythicGlobeFrame />
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
        autoRotate={!reducedMotion}
        autoRotateSpeed={0.24}
        target={[0, -0.2, 0]}
        onStart={() => {
          if (controlsRef.current) controlsRef.current.autoRotate = false;
        }}
        onEnd={() => {
          if (controlsRef.current && !reducedMotion) {
            controlsRef.current.autoRotate = true;
          }
        }}
      />
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
  selectedCountry,
  selectedWriter,
  onCountrySelect,
  onWriterSelect,
  showNobelLaureates = false,
  nobelCountryId,
}: Props) {
  const { language, t, countryName, number } = useInterfaceLanguage();
  const [atlas, setAtlas] = useState<GlobeAtlas | null>(null);
  const [atlasError, setAtlasError] = useState(false);
  const [hoveredCountry, setHoveredCountry] = useState<Country | null>(null);
  const [hoveredLaureate, setHoveredLaureate] =
    useState<HoveredLaureate | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [globeActive, setGlobeActive] = useState(false);
  const [atlasRequested, setAtlasRequested] = useState(false);
  const hoveredNobelYear = hoveredLaureate
    ? getNobelYear(hoveredLaureate.writer)
    : null;
  const hoveredNobelArticle = hoveredLaureate
    ? findNobelArticle(hoveredLaureate.writer)
    : null;
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

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let intersects = true;
    const update = () =>
      setGlobeActive(intersects && document.visibilityState !== "hidden");
    const observer = new IntersectionObserver(
      ([entry]) => {
        intersects = Boolean(entry?.isIntersecting);
        if (intersects) setAtlasRequested(true);
        update();
      },
      { rootMargin: "160px", threshold: 0.01 }
    );
    observer.observe(container);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
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

    createGlobeAtlas(countries)
      .then((nextAtlas) => {
        createdAtlas = nextAtlas;
        if (disposed) nextAtlas.dispose();
        else setAtlas(nextAtlas);
      })
      .catch(() => {
        if (!disposed) setAtlasError(true);
      });

    return () => {
      disposed = true;
      createdAtlas?.dispose();
    };
  }, [atlasRequested, countries]);

  useEffect(() => {
    atlas?.updateHighlight(selectedCountry?.id, hoveredCountry?.id);
  }, [atlas, hoveredCountry?.id, selectedCountry?.id]);

  if (!atlas) {
    return (
      <div ref={containerRef} className="literary-globe is-loading">
        <div className="globe-loading" role="status">
          <span aria-hidden="true">✦</span>
          <p>
            {atlasError
              ? t("Карта временно недоступна")
              : t("Проявляем старинную карту…")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`literary-globe${hoveredCountry ? " is-hovering" : ""}`}
    >
      <Canvas
        camera={{ position: [0, 0.08, 4.9], fov: 43, near: 0.1, far: 100 }}
        dpr={[1, economical ? 1.1 : 1.5]}
        frameloop={globeActive ? "always" : "never"}
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
          countries={countries}
          selectedCountry={selectedCountry}
          selectedWriter={selectedWriter}
          hoveredCountry={hoveredCountry}
          onCountrySelect={onCountrySelect}
          onCountryHover={setHoveredCountry}
          reducedMotion={reducedMotion}
          economical={economical}
          showNobelLaureates={showNobelLaureates}
          nobelCountryId={nobelCountryId}
          onWriterSelect={onWriterSelect}
          onLaureateHover={setHoveredLaureate}
        />
      </Canvas>

      <div className="globe-vignette" aria-hidden="true" />
      <div className="globe-shadow" aria-hidden="true" />

      {showNobelLaureates && visibleNobelCount > 0 && (
        <div className="globe-nobel-status" role="status" aria-live="polite">
          <img
            src={`${import.meta.env.BASE_URL}brand/alfred-nobel-medallion.png`}
            alt=""
            aria-hidden="true"
          />
          <div>
            <strong>{number(visibleNobelCount)}</strong>
            <span>
              {language === "en"
                ? visibleNobelCount === 1
                  ? "laureate on the globe"
                  : "laureates on the globe"
                : `${pluralRu(visibleNobelCount, [
                    "лауреат",
                    "лауреата",
                    "лауреатов",
                  ])} на глобусе`}
            </span>
          </div>
        </div>
      )}

      {hoveredLaureate ? (
        <div className="globe-country-label globe-laureate-label" role="status">
          <WriterPortrait
            writer={hoveredLaureate.writer}
            className="globe-laureate-portrait"
            decorative
          />
          <div>
            <span>{writerDisplayName(hoveredLaureate.writer)}</span>
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
      ) : hoveredCountry ? (
        <div className="globe-country-label" role="status">
          <CountryFlagIcon
            code={hoveredCountry.code}
            countryName={hoveredCountry.name}
            className="globe-country-label-flag"
            size={38}
            decorative
            priority
          />
          <div>
            <span>{countryName(hoveredCountry.code, hoveredCountry.name)}</span>
            <small>
              {number(hoveredCountry.writers.length)}{" "}
              {language === "en"
                ? `${hoveredCountry.writers.length === 1 ? "writer" : "writers"} in the archive`
                : `${pluralRu(hoveredCountry.writers.length, [
                    "автор",
                    "автора",
                    "авторов",
                  ])} в архиве`}
            </small>
          </div>
        </div>
      ) : null}

      <div className="globe-instruction">
        <span>{t("Тяните, чтобы вращать")}</span>
        <i aria-hidden="true" />
        <span>{t("Колесо — масштаб")}</span>
      </div>
    </div>
  );
}
