import type { Country } from "../data/countries";

declare const latitudeBrand: unique symbol;
declare const longitudeBrand: unique symbol;

/** A validated latitude in the closed interval [-90, 90]. */
export type Latitude = number & { readonly [latitudeBrand]: "Latitude" };

/** A validated longitude in the closed interval [-180, 180]. */
export type Longitude = number & { readonly [longitudeBrand]: "Longitude" };

export type GlobeCoordinates = Readonly<{
  latitude: Latitude;
  longitude: Longitude;
}>;

export type RawGlobeCoordinates = Readonly<{
  latitude: number;
  longitude: number;
}>;

export type GlobeCoordinateSource =
  | "writer"
  | "selected-country"
  | "hover-country"
  | "view-centre";

export type GlobeCoordinateCandidate = Readonly<{
  coordinates?: RawGlobeCoordinates | GlobeCoordinates | null;
  label?: string | null;
}>;

export type GlobeCoordinateContextInput = Readonly<{
  writer?: GlobeCoordinateCandidate | null;
  selectedCountry?: GlobeCoordinateCandidate | null;
  hoverCountry?: GlobeCoordinateCandidate | null;
  viewCentre?: GlobeCoordinateCandidate | null;
}>;

export type ResolvedGlobeCoordinateContext = GlobeCoordinates &
  Readonly<{
    source: GlobeCoordinateSource;
    label: string | null;
  }>;

// Natural Earth 1:110m omits several small states and islands. These reviewed
// centres keep their markers, keyboard path and camera focus available.
export const COUNTRY_MARKER_COORDINATE_FALLBACKS: Readonly<
  Partial<Record<string, RawGlobeCoordinates>>
> = {
  AD: { latitude: 42.5063, longitude: 1.5218 },
  CK: { latitude: -21.2367, longitude: -159.7777 },
  FM: { latitude: 6.9248, longitude: 158.161 },
  HK: { latitude: 22.3193, longitude: 114.1694 },
  KI: { latitude: 1.4518, longitude: 172.9717 },
  KM: { latitude: -11.6455, longitude: 43.3333 },
  LI: { latitude: 47.141, longitude: 9.5209 },
  MC: { latitude: 43.7384, longitude: 7.4246 },
  MO: { latitude: 22.1987, longitude: 113.5439 },
  MU: { latitude: -20.1609, longitude: 57.5012 },
  NR: { latitude: -0.5228, longitude: 166.9315 },
  NU: { latitude: -19.0544, longitude: -169.8672 },
  SC: { latitude: -4.6796, longitude: 55.492 },
  SM: { latitude: 43.9424, longitude: 12.4578 },
  TV: { latitude: -8.5211, longitude: 179.1983 },
  VA: { latitude: 41.9029, longitude: 12.4534 },
};

function isFiniteInRange(value: number, minimum: number, maximum: number) {
  return Number.isFinite(value) && value >= minimum && value <= maximum;
}

export function createLatitude(value: number): Latitude | null {
  return isFiniteInRange(value, -90, 90) ? (value as Latitude) : null;
}

export function createLongitude(value: number): Longitude | null {
  return isFiniteInRange(value, -180, 180) ? (value as Longitude) : null;
}

export function createGlobeCoordinates(
  latitudeValue: number,
  longitudeValue: number
): GlobeCoordinates | null {
  const latitude = createLatitude(latitudeValue);
  const longitude = createLongitude(longitudeValue);
  return latitude === null || longitude === null
    ? null
    : { latitude, longitude };
}

export function resolveCountryGlobeCoordinates(
  country: Pick<Country, "code" | "coordinates" | "writers">
): GlobeCoordinates | null {
  if (Array.isArray(country.coordinates)) {
    return createGlobeCoordinates(country.coordinates[0], country.coordinates[1]);
  }
  if (country.coordinates) {
    return createGlobeCoordinates(
      country.coordinates.lat,
      country.coordinates.lng
    );
  }

  const fallback = country.code
    ? COUNTRY_MARKER_COORDINATE_FALLBACKS[country.code.trim().toUpperCase()]
    : null;
  if (fallback) {
    return createGlobeCoordinates(fallback.latitude, fallback.longitude);
  }

  const writerPoints = country.writers
    .map((writer) => writer.coordinates)
    .filter(
      (coordinates): coordinates is { lat: number; lng: number } =>
        Boolean(
          coordinates &&
            createGlobeCoordinates(coordinates.lat, coordinates.lng)
        )
    );
  if (!writerPoints.length) return null;

  const vector = writerPoints.reduce(
    (sum, point) => {
      const latitude = (point.lat * Math.PI) / 180;
      const longitude = (point.lng * Math.PI) / 180;
      return {
        x: sum.x + Math.cos(latitude) * Math.cos(longitude),
        y: sum.y + Math.cos(latitude) * Math.sin(longitude),
        z: sum.z + Math.sin(latitude),
      };
    },
    { x: 0, y: 0, z: 0 }
  );
  const horizontal = Math.hypot(vector.x, vector.y);
  return createGlobeCoordinates(
    (Math.atan2(vector.z, horizontal) * 180) / Math.PI,
    (Math.atan2(vector.y, vector.x) * 180) / Math.PI
  );
}

const CONTEXT_PRIORITY: ReadonlyArray<
  readonly [source: GlobeCoordinateSource, key: keyof GlobeCoordinateContextInput]
> = [
  ["writer", "writer"],
  ["selected-country", "selectedCountry"],
  ["hover-country", "hoverCountry"],
  ["view-centre", "viewCentre"],
];

/**
 * Resolves the coordinate readout without allowing an invalid high-priority
 * record to hide a valid lower-priority context.
 */
export function resolveGlobeCoordinateContext(
  input: GlobeCoordinateContextInput
): ResolvedGlobeCoordinateContext | null {
  for (const [source, key] of CONTEXT_PRIORITY) {
    const candidate = input[key];
    if (!candidate?.coordinates) continue;
    const coordinates = createGlobeCoordinates(
      candidate.coordinates.latitude,
      candidate.coordinates.longitude
    );
    if (!coordinates) continue;
    return {
      ...coordinates,
      source,
      label: candidate.label?.trim() || null,
    };
  }
  return null;
}

function formatDms(
  value: number,
  maximumDegrees: 90 | 180,
  positiveHemisphere: "N" | "E",
  negativeHemisphere: "S" | "W"
) {
  if (!isFiniteInRange(value, -maximumDegrees, maximumDegrees)) return null;

  // The public atlas readout intentionally stops at rounded arc-minutes: it is
  // calmer than fluctuating seconds while still carrying 59.5′ into the next
  // degree and never producing 60′ or an impossible 91°/181° value.
  const maximumArcMinutes = maximumDegrees * 60;
  const totalArcMinutes = Math.min(
    maximumArcMinutes,
    Math.round(Math.abs(value) * 60)
  );
  const degrees = Math.floor(totalArcMinutes / 60);
  const minutes = totalArcMinutes - degrees * 60;
  const hemisphere = value < 0 ? negativeHemisphere : positiveHemisphere;

  return `${degrees}°${String(minutes).padStart(2, "0")}′ ${hemisphere}`;
}

export function formatLatitudeDms(value: number) {
  return formatDms(value, 90, "N", "S");
}

export function formatLongitudeDms(value: number) {
  return formatDms(value, 180, "E", "W");
}

export function formatGlobeCoordinatesDms(
  coordinates: RawGlobeCoordinates | GlobeCoordinates | null | undefined
) {
  if (!coordinates) return null;
  const latitude = formatLatitudeDms(coordinates.latitude);
  const longitude = formatLongitudeDms(coordinates.longitude);
  return latitude && longitude ? `${latitude} · ${longitude}` : null;
}
