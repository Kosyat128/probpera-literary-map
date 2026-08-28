export type NobelMarkerCoordinates = Readonly<{
  lat: number;
  lng: number;
}>;

export type NobelMarkerSource<TCountry = unknown, TWriter = unknown> = Readonly<{
  countryId: string;
  countryName: string;
  writerId: string;
  writerName: string;
  year?: number | null;
  coordinates: NobelMarkerCoordinates;
  country: TCountry;
  writer: TWriter;
}>;

export type NobelMarkerDetailMode = "clustered" | "individual";

export type NobelIndividualMarker<TCountry = unknown, TWriter = unknown> =
  Readonly<{
    kind: "individual";
    id: string;
    coordinates: NobelMarkerCoordinates;
    member: NobelMarkerSource<TCountry, TWriter>;
    selected: boolean;
  }>;

export type NobelClusterMarker<TCountry = unknown, TWriter = unknown> =
  Readonly<{
    kind: "cluster";
    id: string;
    coordinates: NobelMarkerCoordinates;
    countryId: string;
    countryName: string;
    members: ReadonlyArray<NobelMarkerSource<TCountry, TWriter>>;
    count: number;
    yearRange: Readonly<{ first: number; last: number }> | null;
  }>;

export type NobelMarker<TCountry = unknown, TWriter = unknown> =
  | NobelIndividualMarker<TCountry, TWriter>
  | NobelClusterMarker<TCountry, TWriter>;

export type NobelAccessibleLaureateRow = Readonly<{
  id: string;
  markerId: string;
  countryId: string;
  countryName: string;
  writerId: string;
  writerName: string;
  year: number | null;
  label: string;
  clustered: boolean;
  selected: boolean;
}>;

export type NobelMarkerPlan<TCountry = unknown, TWriter = unknown> = Readonly<{
  mode: NobelMarkerDetailMode;
  markers: ReadonlyArray<NobelMarker<TCountry, TWriter>>;
  accessibleRows: ReadonlyArray<NobelAccessibleLaureateRow>;
  sourceCount: number;
  visibleLaureateCount: number;
  renderedMarkerCount: number;
  clusterCount: number;
  skippedInvalidCount: number;
}>;

export type NobelMarkerPlanOptions<TCountry = unknown, TWriter = unknown> =
  Readonly<{
    entries: ReadonlyArray<NobelMarkerSource<TCountry, TWriter>>;
    mode: NobelMarkerDetailMode;
    selectedWriterId?: string | null;
    /**
     * Retained for source compatibility with the first Stage 4 draft. Far mode
     * is now deliberately country-level, so spatial radius no longer splits a
     * country into several competing global markers.
     */
    clusterRadiusDegrees?: number;
  }>;

export const NOBEL_INDIVIDUAL_ENTER_RADIUS = 3.05;
export const NOBEL_CLUSTER_ENTER_RADIUS = 3.35;
export const DEFAULT_NOBEL_CLUSTER_RADIUS_DEGREES = 7.5;
export const DEFAULT_NOBEL_COINCIDENT_DISPLACEMENT_DEGREES = 2.8;

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

function finiteCoordinate(coordinates: NobelMarkerCoordinates) {
  return (
    Number.isFinite(coordinates.lat) &&
    Number.isFinite(coordinates.lng) &&
    coordinates.lat >= -90 &&
    coordinates.lat <= 90
  );
}

function normalizeLongitude(longitude: number) {
  return ((((longitude + 180) % 360) + 360) % 360) - 180;
}

function normalizedSource<TCountry, TWriter>(
  source: NobelMarkerSource<TCountry, TWriter>
): NobelMarkerSource<TCountry, TWriter> {
  return {
    ...source,
    countryId: source.countryId.trim(),
    countryName: source.countryName.trim(),
    writerId: source.writerId.trim(),
    writerName: source.writerName.trim(),
    year: Number.isFinite(source.year) ? source.year : null,
    coordinates: {
      lat: source.coordinates.lat,
      lng: normalizeLongitude(source.coordinates.lng),
    },
  };
}

function sourceIdentity(source: NobelMarkerSource) {
  return `${source.countryId}\u0000${source.writerId}`;
}

function compareSources(
  first: NobelMarkerSource,
  second: NobelMarkerSource
) {
  return (
    first.countryId.localeCompare(second.countryId, "en") ||
    first.writerId.localeCompare(second.writerId, "en") ||
    (first.year ?? Number.MAX_SAFE_INTEGER) -
      (second.year ?? Number.MAX_SAFE_INTEGER) ||
    first.coordinates.lat - second.coordinates.lat ||
    first.coordinates.lng - second.coordinates.lng ||
    first.writerName.localeCompare(second.writerName, "ru")
  );
}

function fnv1a(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function domSegment(value: string) {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLocaleLowerCase("en")
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 32);
  return `${slug || "item"}-${fnv1a(value)}`;
}

export function nobelWriterMarkerId(countryId: string, writerId: string) {
  return `nobel-marker-writer-${domSegment(countryId)}-${domSegment(writerId)}`;
}

export function nobelLaureateRowId(countryId: string, writerId: string) {
  return `nobel-laureate-${domSegment(countryId)}-${domSegment(writerId)}`;
}

function nobelClusterMarkerId(countryId: string, memberIdentities: string[]) {
  return `nobel-marker-cluster-${domSegment(countryId)}-${fnv1a(
    memberIdentities.join("|")
  )}`;
}

/** Great-circle distance; unlike planar longitude deltas this is dateline-safe. */
export function nobelCoordinateDistanceDegrees(
  first: NobelMarkerCoordinates,
  second: NobelMarkerCoordinates
) {
  const firstLatitude = first.lat * DEG_TO_RAD;
  const secondLatitude = second.lat * DEG_TO_RAD;
  const latitudeDelta = (second.lat - first.lat) * DEG_TO_RAD;
  const longitudeDelta =
    normalizeLongitude(second.lng - first.lng) * DEG_TO_RAD;
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 2 * Math.asin(Math.min(1, Math.sqrt(haversine))) * RAD_TO_DEG;
}

function sphericalCentroid<TCountry, TWriter>(
  entries: ReadonlyArray<NobelMarkerSource<TCountry, TWriter>>
): NobelMarkerCoordinates {
  let x = 0;
  let y = 0;
  let z = 0;
  for (const entry of entries) {
    const latitude = entry.coordinates.lat * DEG_TO_RAD;
    const longitude = entry.coordinates.lng * DEG_TO_RAD;
    const latitudeRadius = Math.cos(latitude);
    x += latitudeRadius * Math.cos(longitude);
    y += Math.sin(latitude);
    z += latitudeRadius * Math.sin(longitude);
  }
  const horizontal = Math.hypot(x, z);
  if (Math.hypot(horizontal, y) <= Number.EPSILON) {
    return entries[0]?.coordinates ?? { lat: 0, lng: 0 };
  }
  return {
    lat: Math.atan2(y, horizontal) * RAD_TO_DEG,
    lng: normalizeLongitude(Math.atan2(z, x) * RAD_TO_DEG),
  };
}

function countryGroups<TCountry, TWriter>(
  entries: ReadonlyArray<NobelMarkerSource<TCountry, TWriter>>
) {
  const groups = new Map<
    string,
    Array<NobelMarkerSource<TCountry, TWriter>>
  >();
  for (const entry of entries) {
    const group = groups.get(entry.countryId) ?? [];
    group.push(entry);
    groups.set(entry.countryId, group);
  }
  return [...groups.entries()]
    .sort(([first], [second]) => first.localeCompare(second, "en"))
    .map(([, members]) => members);
}

function yearRange<TCountry, TWriter>(
  members: ReadonlyArray<NobelMarkerSource<TCountry, TWriter>>
) {
  const years = members
    .map((member) => member.year)
    .filter((year): year is number => typeof year === "number")
    .sort((first, second) => first - second);
  if (years.length === 0) return null;
  return { first: years[0], last: years[years.length - 1] };
}

function individualMarker<TCountry, TWriter>(
  member: NobelMarkerSource<TCountry, TWriter>,
  selectedWriterId: string | null,
  coordinates = member.coordinates
): NobelIndividualMarker<TCountry, TWriter> {
  return {
    kind: "individual",
    id: nobelWriterMarkerId(member.countryId, member.writerId),
    coordinates,
    member,
    selected: member.writerId === selectedWriterId,
  };
}

function coincidentCoordinateKey(coordinates: NobelMarkerCoordinates) {
  return `${coordinates.lat.toFixed(6)}:${normalizeLongitude(
    coordinates.lng
  ).toFixed(6)}`;
}

/**
 * Applies a presentation-only spherical offset. The source/member coordinates
 * remain untouched, so the literary data and coordinate readout stay exact.
 */
function displacedCoordinates(
  coordinates: NobelMarkerCoordinates,
  index: number,
  count: number
): NobelMarkerCoordinates {
  if (count <= 1) return coordinates;

  const latitude = coordinates.lat * DEG_TO_RAD;
  const longitude = normalizeLongitude(coordinates.lng) * DEG_TO_RAD;
  const centre = {
    x: Math.cos(latitude) * Math.cos(longitude),
    y: Math.sin(latitude),
    z: Math.cos(latitude) * Math.sin(longitude),
  };
  const east = {
    x: -Math.sin(longitude),
    y: 0,
    z: Math.cos(longitude),
  };
  const north = {
    x: -Math.sin(latitude) * Math.cos(longitude),
    y: Math.cos(latitude),
    z: -Math.sin(latitude) * Math.sin(longitude),
  };
  const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;
  const radius =
    Math.min(
      6,
      DEFAULT_NOBEL_COINCIDENT_DISPLACEMENT_DEGREES *
        Math.max(1, Math.sqrt(count / 2))
    ) * DEG_TO_RAD;
  const tangent = {
    x: east.x * Math.cos(angle) + north.x * Math.sin(angle),
    y: east.y * Math.cos(angle) + north.y * Math.sin(angle),
    z: east.z * Math.cos(angle) + north.z * Math.sin(angle),
  };
  const x = centre.x * Math.cos(radius) + tangent.x * Math.sin(radius);
  const y = centre.y * Math.cos(radius) + tangent.y * Math.sin(radius);
  const z = centre.z * Math.cos(radius) + tangent.z * Math.sin(radius);

  return {
    lat: Math.asin(Math.max(-1, Math.min(1, y))) * RAD_TO_DEG,
    lng: normalizeLongitude(Math.atan2(z, x) * RAD_TO_DEG),
  };
}

function displaceCoincidentMarkers<TCountry, TWriter>(
  markers: ReadonlyArray<NobelMarker<TCountry, TWriter>>
) {
  const indexesByCoordinate = new Map<string, number[]>();
  markers.forEach((marker, index) => {
    const key = coincidentCoordinateKey(marker.coordinates);
    const indexes = indexesByCoordinate.get(key) ?? [];
    indexes.push(index);
    indexesByCoordinate.set(key, indexes);
  });

  const displacementByIndex = new Map<number, NobelMarkerCoordinates>();
  for (const indexes of indexesByCoordinate.values()) {
    if (indexes.length <= 1) continue;
    indexes.forEach((markerIndex, displayIndex) => {
      displacementByIndex.set(
        markerIndex,
        displacedCoordinates(
          markers[markerIndex].coordinates,
          displayIndex,
          indexes.length
        )
      );
    });
  }

  return markers.map((marker, index) => {
    const coordinates = displacementByIndex.get(index);
    return coordinates ? { ...marker, coordinates } : marker;
  });
}

function accessibleLabel<TCountry, TWriter>(
  member: NobelMarkerSource<TCountry, TWriter>
) {
  const year = member.year ? `, ${member.year}` : "";
  return `${member.writerName} - ${member.countryName}${year}`;
}

function buildAccessibleRows<TCountry, TWriter>(
  markers: ReadonlyArray<NobelMarker<TCountry, TWriter>>
) {
  return markers
    .flatMap((marker) => {
      const members = marker.kind === "cluster" ? marker.members : [marker.member];
      return members.map(
        (member): NobelAccessibleLaureateRow => ({
          id: nobelLaureateRowId(member.countryId, member.writerId),
          markerId: marker.id,
          countryId: member.countryId,
          countryName: member.countryName,
          writerId: member.writerId,
          writerName: member.writerName,
          year: member.year ?? null,
          label: accessibleLabel(member),
          clustered: marker.kind === "cluster",
          selected:
            marker.kind === "individual" ? marker.selected : false,
        })
      );
    })
    .sort(
      (first, second) =>
        (first.year ?? Number.MAX_SAFE_INTEGER) -
          (second.year ?? Number.MAX_SAFE_INTEGER) ||
        first.writerName.localeCompare(second.writerName, "ru") ||
        first.id.localeCompare(second.id, "en")
    );
}

/**
 * Produces an input-order-independent marker plan. Far view has at most one
 * non-selected marker per country. The selected writer is peeled out as a
 * directly interactive marker. Near view keeps every laureate individual and
 * deterministically separates coincident display positions without mutating
 * source coordinates.
 */
export function buildNobelMarkerPlan<TCountry, TWriter>({
  entries,
  mode,
  selectedWriterId = null,
}: NobelMarkerPlanOptions<TCountry, TWriter>): NobelMarkerPlan<
  TCountry,
  TWriter
> {
  const valid = entries
    .filter(
      (entry) =>
        entry.countryId.trim() !== "" &&
        entry.writerId.trim() !== "" &&
        finiteCoordinate(entry.coordinates)
    )
    .map(normalizedSource)
    .sort(compareSources);
  const unique = valid.filter(
    (entry, index) =>
      index === 0 || sourceIdentity(entry) !== sourceIdentity(valid[index - 1])
  );

  let markers: Array<NobelMarker<TCountry, TWriter>>;
  if (mode === "individual") {
    markers = displaceCoincidentMarkers(
      unique.map((entry) => individualMarker(entry, selectedWriterId))
    );
  } else {
    const selected = unique.filter(
      (entry) => entry.writerId === selectedWriterId
    );
    const clusterable = unique.filter(
      (entry) => entry.writerId !== selectedWriterId
    );
    const groups = countryGroups(clusterable);
    const farMarkers = [
      ...selected.map((entry) => individualMarker(entry, selectedWriterId)),
      ...groups.map((members): NobelMarker<TCountry, TWriter> => {
        if (members.length === 1) {
          return individualMarker(members[0], selectedWriterId);
        }
        const identities = members.map(sourceIdentity).sort();
        return {
          kind: "cluster",
          id: nobelClusterMarkerId(members[0].countryId, identities),
          coordinates: sphericalCentroid(members),
          countryId: members[0].countryId,
          countryName: members[0].countryName,
          members,
          count: members.length,
          yearRange: yearRange(members),
        };
      }),
    ].sort((first, second) => first.id.localeCompare(second.id, "en"));
    markers = displaceCoincidentMarkers(farMarkers);
  }

  const accessibleRows = buildAccessibleRows(markers);
  return {
    mode,
    markers,
    accessibleRows,
    sourceCount: entries.length,
    visibleLaureateCount: unique.length,
    renderedMarkerCount: markers.length,
    clusterCount: markers.filter((marker) => marker.kind === "cluster").length,
    skippedInvalidCount: entries.length - valid.length,
  };
}

/**
 * Detail hysteresis avoids marker churn around a single camera-radius boundary.
 */
export function resolveNobelMarkerDetailMode(
  cameraRadius: number,
  previousMode?: NobelMarkerDetailMode | null
): NobelMarkerDetailMode {
  if (!Number.isFinite(cameraRadius)) return previousMode ?? "clustered";
  if (previousMode === "individual") {
    return cameraRadius < NOBEL_CLUSTER_ENTER_RADIUS
      ? "individual"
      : "clustered";
  }
  if (previousMode === "clustered") {
    return cameraRadius <= NOBEL_INDIVIDUAL_ENTER_RADIUS
      ? "individual"
      : "clustered";
  }
  return cameraRadius <=
    (NOBEL_INDIVIDUAL_ENTER_RADIUS + NOBEL_CLUSTER_ENTER_RADIUS) / 2
    ? "individual"
    : "clustered";
}

export type NobelMarkerVisualState =
  | "idle"
  | "hovered"
  | "selected"
  | "revealed";

export type NobelMarkerAnimationPolicy = Readonly<{
  fromScale: number;
  toScale: number;
  durationMs: number;
  iterationCount: 0 | 1;
  requiresContinuousFrameLoop: false;
}>;

/** Event-driven, finite emphasis only: this policy can never request a pulse loop. */
export function resolveNobelMarkerAnimation(
  state: NobelMarkerVisualState,
  reducedMotion = false
): NobelMarkerAnimationPolicy {
  const toScale = state === "selected" ? 1.16 : state === "hovered" ? 1.08 : 1;
  if (reducedMotion || state === "idle") {
    return {
      fromScale: toScale,
      toScale,
      durationMs: 0,
      iterationCount: 0,
      requiresContinuousFrameLoop: false,
    };
  }
  return {
    fromScale: state === "revealed" ? 0.86 : 1,
    toScale,
    durationMs: state === "revealed" ? 220 : 160,
    iterationCount: 1,
    requiresContinuousFrameLoop: false,
  };
}
