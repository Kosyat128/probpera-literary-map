import * as THREE from "three";

export type GeoPosition = [longitude: number, latitude: number];
export type GeoLinearRing = GeoPosition[];
export type GeoPolygonCoordinates = GeoLinearRing[];
export type GeoMultiPolygonCoordinates = GeoPolygonCoordinates[];

export type GlobeGeoGeometry = {
  type: "Polygon" | "MultiPolygon";
  coordinates: GeoPolygonCoordinates | GeoMultiPolygonCoordinates;
};

/**
 * The restored museum texture starts at 180°W. Keeping the correction in one
 * place prevents the texture, picking, outlines and camera from drifting apart.
 */
export const GLOBE_LONGITUDE_OFFSET_DEGREES = 0;
export const GLOBE_TEXTURE_FLIP_Y = true;

export type GeographicLatitudeBounds = {
  minimum: number;
  maximum: number;
};

export function normalizeLongitude(value: number) {
  return ((((value + 180) % 360) + 360) % 360) - 180;
}

/**
 * A lossless broad-phase bound for pointer picking. Longitude needs special
 * antimeridian handling, while latitude is monotonic in GeoJSON coordinates;
 * filtering only by latitude therefore cannot change the exact polygon result.
 */
export function geometryLatitudeBounds(
  geometry: GlobeGeoGeometry
): GeographicLatitudeBounds {
  const polygons =
    geometry.type === "Polygon"
      ? [geometry.coordinates as GeoPolygonCoordinates]
      : (geometry.coordinates as GeoMultiPolygonCoordinates);
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;

  polygons.forEach((polygon) => {
    polygon.forEach((ring) => {
      ring.forEach(([, latitude]) => {
        minimum = Math.min(minimum, latitude);
        maximum = Math.max(maximum, latitude);
      });
    });
  });

  // Empty geometries remain eligible for the exact predicate, avoiding false
  // negatives if a future reviewed atlas contains an empty coordinate array.
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum)) {
    return { minimum: -90, maximum: 90 };
  }
  return { minimum, maximum };
}

export function latitudeBoundsContain(
  bounds: GeographicLatitudeBounds,
  latitude: number
) {
  return latitude >= bounds.minimum && latitude <= bounds.maximum;
}

export function uvToGeographic(uv: Pick<THREE.Vector2, "x" | "y">): GeoPosition {
  const textureLatitudeV = GLOBE_TEXTURE_FLIP_Y ? uv.y : 1 - uv.y;
  const textureLongitude = uv.x * 360 - 180;

  return [
    normalizeLongitude(textureLongitude - GLOBE_LONGITUDE_OFFSET_DEGREES),
    THREE.MathUtils.clamp((textureLatitudeV - 0.5) * 180, -90, 90),
  ];
}

export function longitudeToTextureX(longitude: number, width: number) {
  const textureLongitude = normalizeLongitude(
    longitude + GLOBE_LONGITUDE_OFFSET_DEGREES
  );
  return ((textureLongitude + 180) / 360) * width;
}

export function geographicToSphere(
  longitude: number,
  latitude: number,
  radius = 1
) {
  const displayedLongitude = THREE.MathUtils.degToRad(
    normalizeLongitude(longitude + GLOBE_LONGITUDE_OFFSET_DEGREES)
  );
  const latitudeRadians = THREE.MathUtils.degToRad(
    THREE.MathUtils.clamp(latitude, -90, 90)
  );
  const latitudeRadius = radius * Math.cos(latitudeRadians);

  return new THREE.Vector3(
    latitudeRadius * Math.cos(displayedLongitude),
    radius * Math.sin(latitudeRadians),
    -latitudeRadius * Math.sin(displayedLongitude)
  );
}

function unwrapRing(ring: GeoLinearRing) {
  if (ring.length < 2) return ring;

  const result: GeoLinearRing = [[ring[0][0], ring[0][1]]];
  let previousLongitude = ring[0][0];

  for (let index = 1; index < ring.length; index += 1) {
    const [, latitude] = ring[index];
    let longitude = ring[index][0];

    while (longitude - previousLongitude > 180) longitude -= 360;
    while (longitude - previousLongitude < -180) longitude += 360;

    result.push([longitude, latitude]);
    previousLongitude = longitude;
  }

  return result;
}

function pointOnSegment(
  pointLongitude: number,
  pointLatitude: number,
  first: GeoPosition,
  second: GeoPosition
) {
  const lengthSquared =
    (second[0] - first[0]) ** 2 + (second[1] - first[1]) ** 2;
  if (lengthSquared < 1e-14) {
    return (
      Math.abs(pointLongitude - first[0]) < 1e-7 &&
      Math.abs(pointLatitude - first[1]) < 1e-7
    );
  }

  const cross =
    (pointLatitude - first[1]) * (second[0] - first[0]) -
    (pointLongitude - first[0]) * (second[1] - first[1]);
  if (Math.abs(cross) > 1e-7) return false;

  const dot =
    (pointLongitude - first[0]) * (second[0] - first[0]) +
    (pointLatitude - first[1]) * (second[1] - first[1]);
  if (dot < 0) return false;

  return dot <= lengthSquared;
}

function pointInUnwrappedRing(
  pointLongitude: number,
  pointLatitude: number,
  ring: GeoLinearRing
) {
  let inside = false;

  for (let current = 0, previous = ring.length - 1; current < ring.length; previous = current++) {
    const first = ring[previous];
    const second = ring[current];
    if (pointOnSegment(pointLongitude, pointLatitude, first, second)) return true;

    const intersects =
      first[1] > pointLatitude !== second[1] > pointLatitude &&
      pointLongitude <
        ((second[0] - first[0]) * (pointLatitude - first[1])) /
          (second[1] - first[1]) +
          first[0];

    if (intersects) inside = !inside;
  }

  return inside;
}

export function pointInGeoRing(
  longitude: number,
  latitude: number,
  sourceRing: GeoLinearRing
) {
  if (sourceRing.length < 3) return false;
  const ring = unwrapRing(sourceRing);

  return [longitude - 360, longitude, longitude + 360].some((candidateLongitude) =>
    pointInUnwrappedRing(candidateLongitude, latitude, ring)
  );
}

function pointInPolygon(
  longitude: number,
  latitude: number,
  polygon: GeoPolygonCoordinates
) {
  const [outerRing, ...holes] = polygon;
  if (!outerRing || !pointInGeoRing(longitude, latitude, outerRing)) return false;
  return !holes.some((hole) => pointInGeoRing(longitude, latitude, hole));
}

export function geometryContainsGeographicPoint(
  geometry: GlobeGeoGeometry,
  longitude: number,
  latitude: number
) {
  const normalizedLongitude = normalizeLongitude(longitude);
  const polygons =
    geometry.type === "Polygon"
      ? [geometry.coordinates as GeoPolygonCoordinates]
      : (geometry.coordinates as GeoMultiPolygonCoordinates);

  return polygons.some((polygon) =>
    pointInPolygon(normalizedLongitude, latitude, polygon)
  );
}

/**
 * Splits a multi-territory geometry at an authoritative geographic anchor.
 * This is useful for an overseas territory that has its own encyclopedia card
 * while still remaining part of its sovereign country's complete outline.
 */
export function partitionGeometryAtGeographicPoint(
  geometry: GlobeGeoGeometry,
  longitude: number,
  latitude: number
): {
  matching: GlobeGeoGeometry | null;
  remainder: GlobeGeoGeometry | null;
} {
  const polygons =
    geometry.type === "Polygon"
      ? [geometry.coordinates as GeoPolygonCoordinates]
      : (geometry.coordinates as GeoMultiPolygonCoordinates);
  const matchingPolygons = polygons.filter((polygon) =>
    pointInPolygon(normalizeLongitude(longitude), latitude, polygon)
  );

  if (!matchingPolygons.length) {
    return { matching: null, remainder: geometry };
  }

  const remainingPolygons = polygons.filter(
    (polygon) => !matchingPolygons.includes(polygon)
  );
  const toGeometry = (
    source: GeoPolygonCoordinates[]
  ): GlobeGeoGeometry | null => {
    if (!source.length) return null;
    if (source.length === 1) {
      return { type: "Polygon", coordinates: source[0] };
    }
    return { type: "MultiPolygon", coordinates: source };
  };

  return {
    matching: toGeometry(matchingPolygons),
    remainder: toGeometry(remainingPolygons),
  };
}

export function buildSphericalOutlinePositions(
  geometries: GlobeGeoGeometry[],
  radius = 1.009
) {
  const positions: number[] = [];

  geometries.forEach((geometry) => {
    const polygons =
      geometry.type === "Polygon"
        ? [geometry.coordinates as GeoPolygonCoordinates]
        : (geometry.coordinates as GeoMultiPolygonCoordinates);

    polygons.forEach((polygon) => {
      polygon.forEach((ring) => {
        for (let index = 1; index < ring.length; index += 1) {
          const first = geographicToSphere(ring[index - 1][0], ring[index - 1][1], radius);
          const second = geographicToSphere(ring[index][0], ring[index][1], radius);
          positions.push(first.x, first.y, first.z, second.x, second.y, second.z);
        }
      });
    });
  });

  return new Float32Array(positions);
}
