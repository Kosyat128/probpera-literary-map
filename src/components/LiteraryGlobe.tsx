import { Canvas, type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
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

import type { Country } from "../data/countries";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import { createGlobeAtlas, type GlobeAtlas } from "./globeAtlas";
import { geographicToSphere } from "./globeGeography";

interface Props {
  countries: Country[];
  selectedCountry?: Country | null;
  onCountrySelect?: (country: Country) => void;
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
        camera.lookAt(0, 0, 0);
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
      <sphereGeometry args={[1, 96, 96]} />
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

function MuseumStarfield({
  economical,
  reducedMotion,
}: {
  economical: boolean;
  reducedMotion: boolean;
}) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const count = economical ? 1100 : 3600;
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
}: {
  atlas: GlobeAtlas;
  selectedCountry?: Country | null;
  hoveredCountry?: Country | null;
  onCountrySelect?: (country: Country) => void;
  onCountryHover: (country: Country | null) => void;
}) {
  const { camera, gl } = useThree();
  const globeMesh = useRef<THREE.Mesh>(null);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const normalizedPointer = useMemo(() => new THREE.Vector2(), []);
  const pointerOrigin = useRef<PointerOrigin | null>(null);
  const hoveredCountryId = useRef<string | null>(null);

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
    const country = countryFromPointer(
      event.nativeEvent.clientX,
      event.nativeEvent.clientY
    );
    const nextId = country?.id ?? null;
    if (hoveredCountryId.current === nextId) return;

    hoveredCountryId.current = nextId;
    onCountryHover(country);
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
          hoveredCountryId.current = null;
          onCountryHover(null);
        }}
      >
        <sphereGeometry args={[1, 160, 112]} />
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
          <sphereGeometry args={[1.006, 144, 104]} />
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
          <torusGeometry args={[1.009, 0.0022, 8, 256]} />
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

function GlobeScene({
  atlas,
  countries,
  selectedCountry,
  hoveredCountry,
  onCountrySelect,
  onCountryHover,
  reducedMotion,
  economical,
}: {
  atlas: GlobeAtlas;
  countries: Country[];
  selectedCountry?: Country | null;
  hoveredCountry?: Country | null;
  onCountrySelect?: (country: Country) => void;
  onCountryHover: (country: Country | null) => void;
  reducedMotion: boolean;
  economical: boolean;
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
      />
      <MythicGlobeFrame />
      <MicrostateMarkers
        atlas={atlas}
        countries={countries}
        selectedCountry={selectedCountry}
        onCountrySelect={onCountrySelect}
        onCountryHover={onCountryHover}
      />
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

export default function LiteraryGlobe({ countries, selectedCountry, onCountrySelect }: Props) {
  const { language, t, countryName, number } = useInterfaceLanguage();
  const [atlas, setAtlas] = useState<GlobeAtlas | null>(null);
  const [atlasError, setAtlasError] = useState(false);
  const [hoveredCountry, setHoveredCountry] = useState<Country | null>(null);
  const [reducedMotion, setReducedMotion] = useState(() =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  const economical =
    ((navigator as Navigator & { deviceMemory?: number }).deviceMemory || 8) <= 4 ||
    window.innerWidth <= 680;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(media.matches);
    media.addEventListener("change", updatePreference);
    return () => media.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
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
  }, [countries]);

  useEffect(() => {
    atlas?.updateHighlight(selectedCountry?.id, hoveredCountry?.id);
  }, [atlas, hoveredCountry?.id, selectedCountry?.id]);

  if (!atlas) {
    return (
      <div className="globe-loading" role="status">
        <span aria-hidden="true">✦</span>
        <p>
          {atlasError
            ? t("Карта временно недоступна")
            : t("Проявляем старинную карту…")}
        </p>
      </div>
    );
  }

  return (
    <div className={`literary-globe${hoveredCountry ? " is-hovering" : ""}`}>
      <Canvas
        camera={{ position: [0, 0.08, 3.55], fov: 43, near: 0.1, far: 100 }}
        dpr={[1, economical ? 1.25 : 1.75]}
        fallback={
          <div className="globe-loading" role="status">
            <span aria-hidden="true">✦</span>
            <p>{t("Используйте текстовый указатель стран ниже")}</p>
          </div>
        }
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        }}
      >
        <GlobeScene
          atlas={atlas}
          countries={countries}
          selectedCountry={selectedCountry}
          hoveredCountry={hoveredCountry}
          onCountrySelect={onCountrySelect}
          onCountryHover={setHoveredCountry}
          reducedMotion={reducedMotion}
          economical={economical}
        />
      </Canvas>

      <div className="globe-vignette" aria-hidden="true" />
      <div className="globe-shadow" aria-hidden="true" />

      {hoveredCountry && (
        <div className="globe-country-label" role="status">
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
      )}

      <div className="globe-instruction">
        <span>{t("Тяните, чтобы вращать")}</span>
        <i aria-hidden="true" />
        <span>{t("Колесо — масштаб")}</span>
      </div>
    </div>
  );
}
