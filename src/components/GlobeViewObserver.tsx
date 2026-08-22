import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";

import type { Country } from "../data/countries";
import type { GlobeAtlas } from "./globeAtlas";
import { resolveCountryGlobeCoordinates } from "./globeCoordinates";
import type { ViewInsets } from "./globeFocusMath";
import { geographicToSphere } from "./globeGeography";
import {
  selectGlobeKeyboardCandidate,
  type GlobeKeyboardCandidate,
} from "./globeKeyboardNavigation";
import { globeReticleNdc, raycastGlobeAtNdc } from "./globeProjection";

export type GlobeViewSample = Readonly<{
  candidate: Country | null;
  coordinates: Readonly<{ latitude: number; longitude: number }> | null;
  cameraRadius: number;
  revision: number;
}>;

type GlobeViewObserverProps = {
  atlas: GlobeAtlas;
  countries: Country[];
  globeObjectRef: RefObject<THREE.Mesh>;
  viewInsets: ViewInsets;
  active: boolean;
  sampleRequest?: number;
  sampleIntervalMs?: number;
  onSample: (sample: GlobeViewSample) => void;
};

function countryCandidate(
  country: Country,
  atlas: GlobeAtlas
): GlobeKeyboardCandidate<Country> | null {
  const atlasCoordinates = atlas.centroidForCountry(country.id);
  const coordinates = atlasCoordinates
    ? { latitude: atlasCoordinates[0], longitude: atlasCoordinates[1] }
    : resolveCountryGlobeCoordinates(country);
  if (!coordinates) return null;
  const direction = geographicToSphere(
    coordinates.longitude,
    coordinates.latitude
  ).normalize();
  return {
    id: country.id,
    name: country.name,
    value: country,
    direction,
    visible: true,
    selectable: true,
  };
}

export default function GlobeViewObserver({
  atlas,
  countries,
  globeObjectRef,
  viewInsets,
  active,
  sampleRequest = 0,
  sampleIntervalMs = 100,
  onSample,
}: GlobeViewObserverProps) {
  const { camera, size } = useThree();
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const lastSampleAt = useRef(Number.NEGATIVE_INFINITY);
  const lastSignature = useRef("");
  const revisionRef = useRef(0);
  const onSampleRef = useRef(onSample);
  onSampleRef.current = onSample;
  const countriesById = useMemo(
    () => new Map(countries.map((country) => [country.id, country])),
    [countries]
  );
  const candidates = useMemo(
    () =>
      countries.flatMap((country) => {
        const candidate = countryCandidate(country, atlas);
        return candidate ? [candidate] : [];
      }),
    [atlas, countries]
  );

  const sampleView = useCallback((force: boolean) => {
    if (!active || !globeObjectRef.current) return;
    const now = performance.now();
    if (
      !force &&
      now - lastSampleAt.current < Math.max(80, sampleIntervalMs)
    ) {
      return;
    }
    lastSampleAt.current = now;

    const ndc = globeReticleNdc(size.width, size.height, viewInsets);
    const hit = raycastGlobeAtNdc({
      camera,
      globeObject: globeObjectRef.current,
      ndc,
      raycaster,
    });
    const geographic = hit ? atlas.geographicCoordinatesAtUv(hit.uv) : null;
    const directCountry = hit ? atlas.countryAtUv(hit.uv) : null;
    const directCandidate = directCountry
      ? candidates.find((candidate) => candidate.id === directCountry.id) ?? null
      : null;
    const viewDirection = hit?.point.clone().normalize() ?? camera.position.clone().normalize();
    const candidate = selectGlobeKeyboardCandidate({
      centreHit: directCandidate,
      candidates,
      viewDirection,
    });
    const cameraRadius = camera.position.length();
    const sampleBase = {
      candidate: candidate ? countriesById.get(candidate.id) ?? null : null,
      coordinates: geographic
        ? { longitude: geographic[0], latitude: geographic[1] }
        : null,
    };
    const signature = `${sampleBase.candidate?.id ?? "ocean"}:${sampleBase.coordinates?.latitude.toFixed(4) ?? "-"}:${sampleBase.coordinates?.longitude.toFixed(4) ?? "-"}:${cameraRadius.toFixed(4)}`;
    if (signature === lastSignature.current) return;
    lastSignature.current = signature;
    revisionRef.current += 1;
    const sample: GlobeViewSample = {
      ...sampleBase,
      cameraRadius,
      revision: revisionRef.current,
    };
    onSampleRef.current(sample);
  }, [
    active,
    atlas,
    camera,
    candidates,
    countriesById,
    globeObjectRef,
    raycaster,
    sampleIntervalMs,
    size.height,
    size.width,
    viewInsets,
  ]);

  useFrame(() => sampleView(false));

  useEffect(() => {
    if (sampleRequest <= 0) return;
    sampleView(true);
  }, [sampleRequest, sampleView]);

  return null;
}
