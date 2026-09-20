import * as THREE from "three";
import { isIncludedGlobeStandId, type IncludedGlobeStandId } from "../planet/globeStands";
import { GLOBE_MAX_CAMERA_RADIUS, GLOBE_SAFE_CAMERA_RADIUS, type ViewInsets } from "./globeFocusMath";
import type { GlobeQualityTier } from "./globeQuality";

export type GlobeStandInspectionPhase = "waiting" | "focusing" | "active" | "returning" | "closed";
export type GlobeStandInspectionRequest = Readonly<{
  sessionId: number;
  standId: IncludedGlobeStandId;
  renderRevision: number;
}>;
export type GlobeStandInspectionEvent = Readonly<{
  sessionId: number;
  phase: GlobeStandInspectionPhase;
  reason?: "returned" | "superseded" | "unavailable";
}>;
export type GlobeStandInspectionBridge = Readonly<{
  sessionId: number | null;
  request: GlobeStandInspectionRequest | null;
  phase: GlobeStandInspectionPhase;
  insets?: Partial<ViewInsets>;
  onState: (event: GlobeStandInspectionEvent) => void;
}>;
export type GlobeRenderedStandBounds = Readonly<{
  standId: IncludedGlobeStandId;
  renderRevision: number;
  qualityTier: GlobeQualityTier;
  min: readonly [number, number, number];
  max: readonly [number, number, number];
}>;
export type GlobeStandInspectionFrame = Readonly<{
  position: THREE.Vector3;
  target: THREE.Vector3;
  zoom: number;
  minDistance: number;
  maxDistance: number;
}>;
export type GlobeStandInspectionZoomState = Readonly<{
  zoom: number;
  minZoom: number;
  maxZoom: number;
  percent: number;
}>;

/** User magnification is separate from the viewport fit, so resizing does not
 * erase an intentional zoom. Absolute limits also bound the perspective zoom. */
export function globeStandInspectionMagnification(fittedZoom: number, factor = 1):
  (GlobeStandInspectionZoomState & Readonly<{ factor: number }>) | null {
  if (!Number.isFinite(fittedZoom) || fittedZoom < .1 || fittedZoom > 8 || !Number.isFinite(factor)) return null;
  const minZoom = Math.max(.1, fittedZoom * .65), maxZoom = Math.min(16, fittedZoom * 2);
  const zoom = THREE.MathUtils.clamp(fittedZoom * factor, minZoom, maxZoom);
  return { zoom, minZoom, maxZoom, factor: zoom / fittedZoom, percent: Math.round(zoom / fittedZoom * 100) };
}
type Projection = {
  verticalFovDegrees: number;
  viewportWidth: number;
  viewportHeight: number;
  viewInsets: ViewInsets;
};
const finiteVector = (point: Readonly<THREE.Vector3>) => [point.x, point.y, point.z].every(Number.isFinite);

export function standInspectionBoundsMatch(request: GlobeStandInspectionRequest, bounds: GlobeRenderedStandBounds | null | undefined) {
  return Number.isSafeInteger(request.sessionId) && request.sessionId > 0
    && Number.isSafeInteger(request.renderRevision) && request.renderRevision >= 0
    && isIncludedGlobeStandId(request.standId) && Boolean(bounds && bounds.standId === request.standId
      && bounds.renderRevision === request.renderRevision && ["high", "balanced", "economy"].includes(bounds.qualityTier));
}

/** Every orbit direction remains inside the existing origin-centred camera
 * shell. Moving the OrbitControls target alone would invalidate those bounds. */
export function globeStandInspectionOrbitLimits(target: Readonly<THREE.Vector3>) {
  if (!finiteVector(target)) return null;
  const offset = Math.hypot(target.x, target.y, target.z);
  const minDistance = GLOBE_SAFE_CAMERA_RADIUS + offset + 1e-5;
  const maxDistance = GLOBE_MAX_CAMERA_RADIUS - offset - 1e-5;
  return minDistance <= maxDistance ? { minDistance, maxDistance } : null;
}

function checkedBox(bounds: GlobeRenderedStandBounds) {
  if (!bounds.min.every(Number.isFinite) || !bounds.max.every(Number.isFinite)
    || bounds.min.some((value, axis) => value >= bounds.max[axis])) return null;
  return new THREE.Box3(new THREE.Vector3(...bounds.min), new THREE.Vector3(...bounds.max));
}

/** Exact perspective corner fit; the same helper also reframes a resized
 * viewport around a manually chosen pose without resetting its orbit. */
export function globeStandInspectionZoom({ bounds, position, target, verticalFovDegrees, viewportWidth, viewportHeight, viewInsets }:
  Projection & { bounds: GlobeRenderedStandBounds; position: THREE.Vector3; target: THREE.Vector3 }): number | null {
  const box = checkedBox(bounds);
  if (!box || !finiteVector(position) || !finiteVector(target)
    || ![verticalFovDegrees, viewportWidth, viewportHeight, ...Object.values(viewInsets)].every(Number.isFinite)
    || verticalFovDegrees <= 1 || verticalFovDegrees >= 170 || viewportWidth <= 0 || viewportHeight <= 0
    || Object.values(viewInsets).some(value => value < 0)) return null;
  const freeWidth = viewportWidth - viewInsets.left - viewInsets.right;
  const freeHeight = viewportHeight - viewInsets.top - viewInsets.bottom;
  if (freeWidth < 32 || freeHeight < 32) return null;
  const forward = target.clone().sub(position);
  if (forward.lengthSq() < 1e-8) return null;
  forward.normalize();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0));
  if (right.lengthSq() < 1e-8) return null;
  right.normalize();
  const up = new THREE.Vector3().crossVectors(right, forward), delta = new THREE.Vector3();
  let horizontal = 0, vertical = 0;
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    delta.set(x, y, z).sub(position);
    const depth = delta.dot(forward);
    if (depth <= .05) return null;
    horizontal = Math.max(horizontal, Math.abs(delta.dot(right)) / depth);
    vertical = Math.max(vertical, Math.abs(delta.dot(up)) / depth);
  }
  const tangent = Math.tan(THREE.MathUtils.degToRad(verticalFovDegrees) / 2);
  const zoom = Math.min(8, tangent * (viewportWidth / viewportHeight) * (freeWidth / viewportWidth) / (horizontal * 1.12),
    tangent * (freeHeight / viewportHeight) / (vertical * 1.12));
  return Number.isFinite(zoom) && zoom >= .1 ? zoom : null;
}

export function globeStandInspectionFrame(options: Projection & { bounds: GlobeRenderedStandBounds }): GlobeStandInspectionFrame | null {
  const box = checkedBox(options.bounds);
  if (!box) return null;
  const target = box.getCenter(new THREE.Vector3()), limits = globeStandInspectionOrbitLimits(target);
  if (!limits) return null;
  const distance = (limits.minDistance + limits.maxDistance) / 2;
  const position = new THREE.Vector3(0, .16, 1).normalize().multiplyScalar(distance).add(target);
  const zoom = globeStandInspectionZoom({ ...options, position, target });
  return zoom === null ? null : { position, target, zoom, ...limits };
}
