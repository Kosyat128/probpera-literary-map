import { useTexture } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import type { Country, Writer } from "../data/countries";
import { getNobelYear } from "../data/articles/nobelArticles";
import {
  collectCountryNobelLaureates,
  collectNobelLaureates,
} from "../data/nobel";
import type { GlobeAtlas } from "./globeAtlas";
import { geographicToSphere } from "./globeGeography";
import {
  beginGlobePointerGesture,
  isGlobePointerTap,
  updateGlobePointerGesture,
  type GlobePointerGesture,
} from "./globeInteraction";
import {
  buildNobelMarkerPlan,
  type NobelMarkerDetailMode,
} from "./nobelMarkerPolicy";

const NOBEL_COUNT_SPRITE_CENTER = new THREE.Vector2(0, 1);

export type NobelLayerHover =
  | {
      kind: "writer";
      writer: Writer;
      country: Country;
    }
  | {
      kind: "cluster";
      country: Country;
      count: number;
      yearRange: Readonly<{ first: number; last: number }> | null;
    };

export type NobelMarkerLayerProps = {
  atlas: GlobeAtlas;
  countries: Country[];
  nobelCountryId?: string | null;
  selectedWriter?: Writer | null;
  detailMode: NobelMarkerDetailMode;
  touchInteractionEnabled: boolean;
  onCountrySelect: (country: Country) => void;
  onWriterSelect: (country: Country, writer: Writer) => void;
  onHover: (hover: NobelLayerHover | null) => void;
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

function NobelLaureateMarker({
  markerId,
  country,
  writer,
  position,
  selected,
  texture,
  touchInteractionEnabled,
  onSelect,
  onHover,
}: {
  markerId: string;
  country: Country;
  writer: Writer;
  position: THREE.Vector3;
  selected: boolean;
  texture: THREE.Texture;
  touchInteractionEnabled: boolean;
  onSelect: (country: Country, writer: Writer) => void;
  onHover: (hover: NobelLayerHover | null) => void;
}) {
  const pointerGesture = useRef<GlobePointerGesture | null>(null);

  return (
    <group
      name={markerId}
      position={position}
      onPointerOver={(event) => {
        if (event.nativeEvent.pointerType === "touch" && !touchInteractionEnabled) {
          return;
        }
        event.stopPropagation();
        onHover({ kind: "writer", country, writer });
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

function createClusterCountTexture(count: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (context) {
    context.clearRect(0, 0, 128, 128);
    context.beginPath();
    context.arc(64, 64, 52, 0, Math.PI * 2);
    context.fillStyle = "#f57a1f";
    context.fill();
    context.lineWidth = 7;
    context.strokeStyle = "#ffe0a2";
    context.stroke();
    context.fillStyle = "#24052f";
    context.font = `900 ${count >= 100 ? 42 : count >= 10 ? 50 : 58}px Arial, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(String(count), 64, 67);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function NobelLaureateClusterMarker({
  markerId,
  country,
  count,
  yearRange,
  position,
  texture,
  touchInteractionEnabled,
  onSelect,
  onHover,
}: {
  markerId: string;
  country: Country;
  count: number;
  yearRange: Readonly<{ first: number; last: number }> | null;
  position: THREE.Vector3;
  texture: THREE.Texture;
  touchInteractionEnabled: boolean;
  onSelect: (country: Country) => void;
  onHover: (hover: NobelLayerHover | null) => void;
}) {
  const pointerGesture = useRef<GlobePointerGesture | null>(null);
  const scale = THREE.MathUtils.clamp(0.086 + count * 0.008, 0.098, 0.14);
  const countTexture = useMemo(() => createClusterCountTexture(count), [count]);

  useEffect(() => () => countTexture.dispose(), [countTexture]);

  return (
    <group
      name={markerId}
      position={position}
      onPointerOver={(event) => {
        if (event.nativeEvent.pointerType === "touch" && !touchInteractionEnabled) {
          return;
        }
        event.stopPropagation();
        onHover({ kind: "cluster", country, count, yearRange });
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
        if (finishPointerGesture(pointerGesture, event)) onSelect(country);
      }}
      onPointerCancel={() => {
        pointerGesture.current = null;
      }}
    >
      <sprite scale={[scale, scale, 1]}>
        <spriteMaterial
          map={texture}
          color="#fff0ad"
          transparent
          alphaTest={0.025}
          depthWrite={false}
          toneMapped={false}
        />
      </sprite>
      <sprite
        center={NOBEL_COUNT_SPRITE_CENTER}
        scale={[scale * 0.52, scale * 0.52, 1]}
        raycast={() => null}
      >
        <spriteMaterial
          map={countTexture}
          transparent
          alphaTest={0.025}
          depthWrite={false}
          toneMapped={false}
        />
      </sprite>
      <mesh scale={0.024 + Math.min(count, 6) * 0.002} raycast={() => null}>
        <sphereGeometry args={[1, 18, 12]} />
        <meshBasicMaterial color="#f6a536" transparent opacity={0.72} />
      </mesh>
    </group>
  );
}

export default function NobelMarkerLayer({
  atlas,
  countries,
  nobelCountryId,
  selectedWriter,
  detailMode,
  touchInteractionEnabled,
  onCountrySelect,
  onWriterSelect,
  onHover,
}: NobelMarkerLayerProps) {
  const medalTexture = useTexture(
    `${import.meta.env.BASE_URL}brand/alfred-nobel-medallion.png`
  );
  medalTexture.colorSpace = THREE.SRGBColorSpace;

  const plan = useMemo(() => {
    const entries = nobelCountryId
      ? collectCountryNobelLaureates(countries, nobelCountryId)
      : collectNobelLaureates(countries);
    const source = entries.flatMap(({ country, writer }) => {
      const countryCentroid = atlas.centroidForCountry(country.id);
      const fallback = countryCentroid
        ? { lat: countryCentroid[0], lng: countryCentroid[1] }
        : null;

      return [
        {
          countryId: country.id,
          countryName: country.name,
          writerId: writer.id,
          writerName: writer.name || writer.id,
          year: getNobelYear(writer),
          country,
          writer,
          coordinates: writer.coordinates || fallback,
        },
      ].filter(
        (
          item
        ): item is {
          country: Country;
          writer: Writer;
          coordinates: { lat: number; lng: number };
          countryId: string;
          countryName: string;
          writerId: string;
          writerName: string;
          year: number | null;
        } => Boolean(item.coordinates)
      );
    });
    return buildNobelMarkerPlan({
      entries: source,
      mode: detailMode,
      selectedWriterId: selectedWriter?.id ?? null,
    });
  }, [atlas, countries, detailMode, nobelCountryId, selectedWriter?.id]);

  return (
    <group>
      {plan.markers.map((marker) => {
        const position = geographicToSphere(
          marker.coordinates.lng,
          marker.coordinates.lat,
          1.026
        );
        if (marker.kind === "cluster") {
          const first = marker.members[0];
          return (
            <NobelLaureateClusterMarker
              key={marker.id}
              markerId={marker.id}
              country={first.country}
              count={marker.count}
              yearRange={marker.yearRange}
              position={position}
              texture={medalTexture}
              touchInteractionEnabled={touchInteractionEnabled}
              onSelect={onCountrySelect}
              onHover={onHover}
            />
          );
        }
        return (
          <NobelLaureateMarker
            key={marker.id}
            markerId={marker.id}
            country={marker.member.country}
            writer={marker.member.writer}
            position={position}
            selected={marker.selected}
            texture={medalTexture}
            touchInteractionEnabled={touchInteractionEnabled}
            onSelect={onWriterSelect}
            onHover={onHover}
          />
        );
      })}
    </group>
  );
}
