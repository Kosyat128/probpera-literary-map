import * as THREE from "three";

import { opticalCenterOffset, type ViewInsets } from "./globeFocusMath";

export type GlobeProjectionHit = {
  point: THREE.Vector3;
  uv: THREE.Vector2;
};

export type GlobeProjectedCandidate = GlobeProjectionHit & {
  countryId: string;
};

const ZERO_INSETS: ViewInsets = { top: 0, right: 0, bottom: 0, left: 0 };

export function normalizedViewInsets(insets?: Partial<ViewInsets> | null): ViewInsets {
  return {
    top: Math.max(0, insets?.top ?? 0),
    right: Math.max(0, insets?.right ?? 0),
    bottom: Math.max(0, insets?.bottom ?? 0),
    left: Math.max(0, insets?.left ?? 0),
  };
}

export function globeReticleNdc(
  width: number,
  height: number,
  insets: ViewInsets = ZERO_INSETS,
  target = new THREE.Vector2()
) {
  const offset = opticalCenterOffset(width, height, insets);
  return target.set(offset.x, offset.y);
}

/**
 * Shifts the perspective frustum so the orbit target is framed inside the
 * unobscured part of the globe stage. This changes projection only; it never
 * writes the camera position or OrbitControls target.
 */
export function applyPerspectiveViewInsets(
  camera: THREE.PerspectiveCamera,
  width: number,
  height: number,
  insets: ViewInsets = ZERO_INSETS
) {
  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));
  const normalized = normalizedViewInsets(insets);
  const xOffset = (normalized.right - normalized.left) / 2;
  const yOffset = (normalized.bottom - normalized.top) / 2;

  if (Math.abs(xOffset) < 0.5 && Math.abs(yOffset) < 0.5) {
    camera.clearViewOffset();
  } else {
    camera.setViewOffset(
      safeWidth,
      safeHeight,
      xOffset,
      yOffset,
      safeWidth,
      safeHeight
    );
  }
  camera.updateProjectionMatrix();
}

export function raycastGlobeAtNdc({
  camera,
  globeObject,
  ndc,
  raycaster = new THREE.Raycaster(),
}: {
  camera: THREE.Camera;
  globeObject: THREE.Object3D;
  ndc: Readonly<THREE.Vector2>;
  raycaster?: THREE.Raycaster;
}): GlobeProjectionHit | null {
  globeObject.updateWorldMatrix(true, false);
  raycaster.setFromCamera(ndc, camera);
  const intersection = raycaster.intersectObject(globeObject, false)[0];
  if (!intersection?.uv) return null;
  return {
    point: intersection.point.clone(),
    uv: intersection.uv.clone(),
  };
}

export function projectGlobeCandidate({
  camera,
  globeObject,
  atlas,
  selectableCountryIds,
  width,
  height,
  insets = ZERO_INSETS,
  raycaster,
}: {
  camera: THREE.Camera;
  globeObject: THREE.Object3D;
  atlas: { countryAtUv: (uv: THREE.Vector2) => { id: string } | null };
  selectableCountryIds?: ReadonlySet<string>;
  width: number;
  height: number;
  insets?: ViewInsets;
  raycaster?: THREE.Raycaster;
}): GlobeProjectedCandidate | null {
  const ndc = globeReticleNdc(width, height, insets);
  const hit = raycastGlobeAtNdc({ camera, globeObject, ndc, raycaster });
  if (!hit) return null;
  const country = atlas.countryAtUv(hit.uv);
  if (!country || (selectableCountryIds && !selectableCountryIds.has(country.id))) {
    return null;
  }
  return { ...hit, countryId: country.id };
}
