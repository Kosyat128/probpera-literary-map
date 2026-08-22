import * as THREE from "three";

import {
  geographicToSphere,
  normalizeLongitude,
  type GeoMultiPolygonCoordinates,
  type GeoPolygonCoordinates,
  type GlobeGeoGeometry,
} from "./globeGeography";

export type ViewInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type CountryFocusMetrics = {
  direction: THREE.Vector3;
  angularRadius: number;
  principalAngularExtent: number;
  principalPolygonCount: number;
  source: "geometry" | "fallback";
};

export type GlobeCameraTimingOptions = {
  mobile?: boolean;
  reducedMotion?: boolean;
};

export type GlobeCameraTrajectory = {
  fromDirection: THREE.Vector3;
  toDirection: THREE.Vector3;
  fromRadius: number;
  toRadius: number;
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
  safeMinimumRadius: number;
};

export type GlobeCameraSample = {
  position: THREE.Vector3;
  target: THREE.Vector3;
};

export const GLOBE_CENTER = Object.freeze({ x: 0, y: 0, z: 0 });
export const HOME_ORBIT_TARGET = Object.freeze({ x: 0, y: -0.2, z: 0 });
export const HOME_CAMERA_POSITION = Object.freeze({ x: 0, y: 0.08, z: 4.9 });
export const GLOBE_SAFE_CAMERA_RADIUS = 2.25;
export const GLOBE_MAX_FOCUS_RADIUS = 4.45;

const EPSILON = 1e-8;
const OPPOSITE_THRESHOLD = -0.9995;
const DEFAULT_INSETS: ViewInsets = { top: 0, right: 0, bottom: 0, left: 0 };

function vectorFromReadonly(value: Readonly<{ x: number; y: number; z: number }>) {
  return new THREE.Vector3(value.x, value.y, value.z);
}

export function globeCenterVector() {
  return vectorFromReadonly(GLOBE_CENTER);
}

export function homeOrbitTargetVector() {
  return vectorFromReadonly(HOME_ORBIT_TARGET);
}

export function homeCameraPositionVector() {
  return vectorFromReadonly(HOME_CAMERA_POSITION);
}

export function angularDistanceRadians(
  first: Readonly<THREE.Vector3>,
  second: Readonly<THREE.Vector3>
) {
  const firstLength = Math.sqrt(first.x ** 2 + first.y ** 2 + first.z ** 2);
  const secondLength = Math.sqrt(second.x ** 2 + second.y ** 2 + second.z ** 2);
  if (firstLength < EPSILON || secondLength < EPSILON) return 0;
  const dot = THREE.MathUtils.clamp(
    (first.x * second.x + first.y * second.y + first.z * second.z) /
      (firstLength * secondLength),
    -1,
    1
  );
  return Math.acos(dot);
}

function stableOrthogonalAxis(direction: Readonly<THREE.Vector3>) {
  const normalized = new THREE.Vector3(
    direction.x,
    direction.y,
    direction.z
  ).normalize();
  const reference =
    Math.abs(normalized.x) <= Math.abs(normalized.y) &&
    Math.abs(normalized.x) <= Math.abs(normalized.z)
      ? new THREE.Vector3(1, 0, 0)
      : Math.abs(normalized.y) <= Math.abs(normalized.z)
        ? new THREE.Vector3(0, 1, 0)
        : new THREE.Vector3(0, 0, 1);
  return normalized.clone().cross(reference).normalize();
}

/**
 * Interpolates two unit directions along the sphere. The exact-opposite branch
 * uses a deterministic orthogonal axis, so repeated flights never choose a
 * random hemisphere, flip, or produce NaN values.
 */
export function stableSphericalDirection(
  from: Readonly<THREE.Vector3>,
  to: Readonly<THREE.Vector3>,
  progress: number,
  target = new THREE.Vector3()
) {
  const t = THREE.MathUtils.clamp(progress, 0, 1);
  const origin = new THREE.Vector3(from.x, from.y, from.z).normalize();
  const destination = new THREE.Vector3(to.x, to.y, to.z).normalize();
  if (origin.lengthSq() < EPSILON || destination.lengthSq() < EPSILON) {
    return target.copy(destination.lengthSq() >= EPSILON ? destination : origin);
  }

  const dot = THREE.MathUtils.clamp(origin.dot(destination), -1, 1);
  if (dot > 0.9995) {
    return target.copy(origin).lerp(destination, t).normalize();
  }
  if (dot < OPPOSITE_THRESHOLD) {
    const axis = stableOrthogonalAxis(origin);
    return target
      .copy(origin)
      .applyAxisAngle(axis, Math.PI * t)
      .normalize();
  }

  const angle = Math.acos(dot);
  const sinAngle = Math.sin(angle);
  const fromWeight = Math.sin((1 - t) * angle) / sinAngle;
  const toWeight = Math.sin(t * angle) / sinAngle;
  return target
    .set(
      origin.x * fromWeight + destination.x * toWeight,
      origin.y * fromWeight + destination.y * toWeight,
      origin.z * fromWeight + destination.z * toWeight
    )
    .normalize();
}

export function premiumCameraEaseOut(progress: number) {
  const t = THREE.MathUtils.clamp(progress, 0, 1);
  return 1 - (1 - t) ** 3;
}

export function cameraFlightDurationMs(
  angularDistance: number,
  options: GlobeCameraTimingOptions = {}
) {
  if (options.reducedMotion) return 0;
  const normalized = THREE.MathUtils.clamp(angularDistance / Math.PI, 0, 1);
  if (options.mobile) {
    return Math.round(280 + 300 * Math.pow(normalized, 0.72));
  }
  return Math.round(320 + 510 * Math.pow(normalized, 0.72));
}

export function opticalCenterOffset(
  width: number,
  height: number,
  insets: ViewInsets = DEFAULT_INSETS
) {
  const safeWidth = Math.max(1, width - insets.left - insets.right);
  const safeHeight = Math.max(1, height - insets.top - insets.bottom);
  const safeCenterX = insets.left + safeWidth / 2;
  const safeCenterY = insets.top + safeHeight / 2;
  return {
    x: THREE.MathUtils.clamp((safeCenterX / Math.max(1, width)) * 2 - 1, -0.82, 0.82),
    y: THREE.MathUtils.clamp(1 - (safeCenterY / Math.max(1, height)) * 2, -0.82, 0.82),
    availableWidth: safeWidth,
    availableHeight: safeHeight,
  };
}

export function focusCameraRadius({
  metrics,
  verticalFovDegrees,
  viewportWidth,
  viewportHeight,
  insets = DEFAULT_INSETS,
}: {
  metrics: Pick<CountryFocusMetrics, "principalAngularExtent">;
  verticalFovDegrees: number;
  viewportWidth: number;
  viewportHeight: number;
  insets?: ViewInsets;
}) {
  const { availableWidth, availableHeight } = opticalCenterOffset(
    viewportWidth,
    viewportHeight,
    insets
  );
  const verticalFov = THREE.MathUtils.degToRad(verticalFovDegrees);
  const aspect = Math.max(0.2, viewportWidth / Math.max(1, viewportHeight));
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspect);
  const availableVerticalFov = verticalFov * (availableHeight / Math.max(1, viewportHeight));
  const availableHorizontalFov = horizontalFov * (availableWidth / Math.max(1, viewportWidth));
  const limitingHalfFov = Math.max(
    THREE.MathUtils.degToRad(8),
    Math.min(availableVerticalFov, availableHorizontalFov) * 0.5
  );
  const extent = THREE.MathUtils.clamp(
    metrics.principalAngularExtent,
    THREE.MathUtils.degToRad(0.35),
    THREE.MathUtils.degToRad(78)
  );
  const surfaceHalfSpan = Math.max(0.015, Math.sin(extent));
  const surfaceDepth = Math.max(0, 1 - Math.cos(extent));
  const radius = 1 + surfaceDepth + surfaceHalfSpan / Math.tan(limitingHalfFov) * 1.08;
  return THREE.MathUtils.clamp(
    radius,
    GLOBE_SAFE_CAMERA_RADIUS,
    GLOBE_MAX_FOCUS_RADIUS
  );
}

export function sampleCameraTrajectory(
  trajectory: GlobeCameraTrajectory,
  progress: number,
  sample: GlobeCameraSample = {
    position: new THREE.Vector3(),
    target: new THREE.Vector3(),
  }
) {
  const eased = premiumCameraEaseOut(progress);
  const direction = stableSphericalDirection(
    trajectory.fromDirection,
    trajectory.toDirection,
    eased
  );
  const radius = Math.max(
    trajectory.safeMinimumRadius,
    THREE.MathUtils.lerp(trajectory.fromRadius, trajectory.toRadius, eased)
  );
  sample.position.copy(direction).multiplyScalar(radius);
  sample.target.copy(trajectory.fromTarget).lerp(trajectory.toTarget, eased);
  return sample;
}

type PolygonMetric = {
  area: number;
  center: THREE.Vector3;
  directions: THREE.Vector3[];
};

function unwrapRingLongitudes(ring: ReadonlyArray<readonly [number, number]>) {
  if (!ring.length) return [] as Array<[number, number]>;
  const result: Array<[number, number]> = [[ring[0][0], ring[0][1]]];
  let previous = ring[0][0];
  for (let index = 1; index < ring.length; index += 1) {
    let longitude = ring[index][0];
    while (longitude - previous > 180) longitude -= 360;
    while (longitude - previous < -180) longitude += 360;
    result.push([longitude, ring[index][1]]);
    previous = longitude;
  }
  return result;
}

function polygonMetric(polygon: GeoPolygonCoordinates): PolygonMetric | null {
  const ring = polygon[0];
  if (!ring || ring.length < 3) return null;
  const unwrapped = unwrapRingLongitudes(ring);
  let twiceArea = 0;
  let centroidLongitude = 0;
  let centroidLatitude = 0;
  for (let index = 0; index < unwrapped.length - 1; index += 1) {
    const [firstLongitude, firstLatitude] = unwrapped[index];
    const [secondLongitude, secondLatitude] = unwrapped[index + 1];
    const cross =
      firstLongitude * secondLatitude - secondLongitude * firstLatitude;
    twiceArea += cross;
    centroidLongitude += (firstLongitude + secondLongitude) * cross;
    centroidLatitude += (firstLatitude + secondLatitude) * cross;
  }
  const planarArea = Math.abs(twiceArea / 2);
  const meanLatitude =
    ring.reduce((sum, [, latitude]) => sum + latitude, 0) / ring.length;
  const area = planarArea * Math.max(0.12, Math.cos(THREE.MathUtils.degToRad(meanLatitude)));
  const fallbackLongitude = unwrapped.reduce((sum, [longitude]) => sum + longitude, 0) / unwrapped.length;
  const fallbackLatitude = unwrapped.reduce((sum, [, latitude]) => sum + latitude, 0) / unwrapped.length;
  const divisor = 3 * twiceArea;
  const longitude = Number.isFinite(centroidLongitude / divisor)
    ? centroidLongitude / divisor
    : fallbackLongitude;
  const latitude = Number.isFinite(centroidLatitude / divisor)
    ? centroidLatitude / divisor
    : fallbackLatitude;
  const center = geographicToSphere(normalizeLongitude(longitude), latitude).normalize();
  const directions = ring.map(([ringLongitude, ringLatitude]) =>
    geographicToSphere(ringLongitude, ringLatitude).normalize()
  );
  return { area: Math.max(area, EPSILON), center, directions };
}

function geometryPolygons(geometry: GlobeGeoGeometry) {
  return geometry.type === "Polygon"
    ? [geometry.coordinates as GeoPolygonCoordinates]
    : (geometry.coordinates as GeoMultiPolygonCoordinates);
}

/**
 * Builds camera data from the principal land mass. Remote tiny territories do
 * not force a country-wide zoom-out, while neighbouring substantial polygons
 * (archipelagos) remain part of the focus envelope.
 */
export function countryFocusMetricsFromGeometries(
  geometries: GlobeGeoGeometry[],
  fallback?: readonly [latitude: number, longitude: number] | null
): CountryFocusMetrics | null {
  const polygons = geometries
    .flatMap(geometryPolygons)
    .map(polygonMetric)
    .filter((metric): metric is PolygonMetric => Boolean(metric))
    .sort((first, second) => second.area - first.area);

  if (!polygons.length) {
    if (!fallback) return null;
    return {
      direction: geographicToSphere(fallback[1], fallback[0]).normalize(),
      angularRadius: THREE.MathUtils.degToRad(0.35),
      principalAngularExtent: THREE.MathUtils.degToRad(0.35),
      principalPolygonCount: 0,
      source: "fallback",
    };
  }

  const primary = polygons[0];
  const principal = polygons.filter(
    (candidate, index) =>
      index === 0 ||
      (candidate.area >= primary.area * 0.12 &&
        angularDistanceRadians(primary.center, candidate.center) <=
          THREE.MathUtils.degToRad(42))
  );
  const direction = principal
    .reduce(
      (sum, metric) => sum.addScaledVector(metric.center, metric.area),
      new THREE.Vector3()
    )
    .normalize();
  const angularRadius = principal.reduce(
    (maximum, metric) =>
      Math.max(
        maximum,
        ...metric.directions.map((point) => angularDistanceRadians(direction, point))
      ),
    THREE.MathUtils.degToRad(0.35)
  );

  return {
    direction,
    angularRadius,
    principalAngularExtent: THREE.MathUtils.clamp(
      angularRadius,
      THREE.MathUtils.degToRad(0.35),
      THREE.MathUtils.degToRad(78)
    ),
    principalPolygonCount: principal.length,
    source: "geometry",
  };
}
