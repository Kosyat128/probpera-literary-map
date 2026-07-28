import { Canvas, type ThreeEvent, useThree } from "@react-three/fiber";
import { OrbitControls, Sparkles, Sphere } from "@react-three/drei";
import { gsap } from "gsap";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import type { Country } from "../data/countries";
import { createGlobeAtlas, type GlobeAtlas } from "./globeAtlas";

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
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lng + 180) * Math.PI) / 180;

  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
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

function MuseumMount() {
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

      <mesh position={[0, -1.18, 0]} raycast={() => null}>
        <cylinderGeometry args={[0.11, 0.17, 0.3, 32]} />
        <meshPhysicalMaterial color="#8f4b1d" metalness={0.82} roughness={0.28} />
      </mesh>

      <mesh position={[0, -1.35, 0]} raycast={() => null}>
        <cylinderGeometry args={[0.34, 0.39, 0.08, 48]} />
        <meshPhysicalMaterial
          color="#b56a26"
          metalness={0.86}
          roughness={0.24}
          clearcoat={0.5}
        />
      </mesh>
    </group>
  );
}

function GlobeSurface({
  atlas,
  selectedCountry,
  onCountrySelect,
  onCountryHover,
}: {
  atlas: GlobeAtlas;
  selectedCountry?: Country | null;
  onCountrySelect?: (country: Country) => void;
  onCountryHover: (country: Country | null) => void;
}) {
  const pointerOrigin = useRef<PointerOrigin | null>(null);
  const hoveredCountryId = useRef<string | null>(null);

  const countryFromEvent = (event: ThreeEvent<PointerEvent>) =>
    event.uv ? atlas.countryAtUv(event.uv) : null;

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    const country = countryFromEvent(event);
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

    const country = countryFromEvent(event);
    if (country) onCountrySelect?.(country);
  };

  return (
    <group>
      <Sphere
        args={[1, 128, 128]}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerOut={() => {
          hoveredCountryId.current = null;
          onCountryHover(null);
        }}
      >
        <meshPhysicalMaterial
          map={atlas.mapTexture}
          bumpMap={atlas.reliefTexture}
          bumpScale={0.022}
          roughness={0.76}
          metalness={0.025}
          clearcoat={0.16}
          clearcoatRoughness={0.7}
          emissive="#2b160c"
          emissiveIntensity={0.06}
        />
      </Sphere>

      <Sphere args={[1.006, 128, 128]} raycast={() => null}>
        <meshBasicMaterial
          map={atlas.highlightTexture}
          transparent
          depthWrite={false}
          toneMapped={false}
          blending={THREE.NormalBlending}
        />
      </Sphere>

      <mesh rotation={[Math.PI / 2, 0, 0]} raycast={() => null}>
        <torusGeometry args={[1.009, 0.0022, 8, 256]} />
        <meshBasicMaterial
          color="#e5b66a"
          transparent
          opacity={selectedCountry ? 0.18 : 0.11}
          toneMapped={false}
        />
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
  onCountrySelect,
  onCountryHover,
  reducedMotion,
  economical,
}: {
  atlas: GlobeAtlas;
  countries: Country[];
  selectedCountry?: Country | null;
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
      <ambientLight intensity={0.66} color="#f7d29a" />
      <hemisphereLight args={["#ffe2ab", "#170620", 1.12]} />
      <directionalLight position={[4.5, 3.4, 4]} intensity={2.35} color="#ffd6a0" />
      <pointLight position={[-3.5, -0.7, 2]} intensity={13} distance={7} color="#c45b24" />
      <pointLight position={[0, 3.5, -3]} intensity={8} distance={7} color="#6f2b8d" />

      <GlobeSurface
        atlas={atlas}
        selectedCountry={selectedCountry}
        onCountrySelect={onCountrySelect}
        onCountryHover={onCountryHover}
      />
      <MuseumMount />
      <MicrostateMarkers
        atlas={atlas}
        countries={countries}
        selectedCountry={selectedCountry}
        onCountrySelect={onCountrySelect}
        onCountryHover={onCountryHover}
      />
      <Sparkles
        count={economical ? 24 : 56}
        scale={[4.8, 3.4, 3.6]}
        size={1.1}
        speed={reducedMotion ? 0 : 0.12}
        opacity={0.24}
        color="#d9b36d"
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
        <p>{atlasError ? "Карта временно недоступна" : "Проявляем старинную карту…"}</p>
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
            <p>Используйте текстовый указатель стран ниже</p>
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
          <span>{hoveredCountry.name}</span>
          <small>
            {hoveredCountry.writers.length}{" "}
            {pluralRu(hoveredCountry.writers.length, ["автор", "автора", "авторов"])} в архиве
          </small>
        </div>
      )}

      <div className="globe-instruction">
        <span>Тяните, чтобы вращать</span>
        <i aria-hidden="true" />
        <span>Колесо — масштаб</span>
      </div>
    </div>
  );
}
