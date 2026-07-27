import type { WorldContourFeature } from "./worldContours";

function extractCoordinates(geometry:any): Array<number[][] | number[][][]> {
  if (!geometry?.coordinates) return [];

  if (geometry.type === "Polygon") {
    return geometry.coordinates;
  }

  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.flat();
  }

  return [];
}

export function parseWorldContours(data:any): WorldContourFeature[] {
  const features = data?.features ?? [];

  return features.flatMap((feature:any) =>
    extractCoordinates(feature?.geometry).map((coordinates) => ({
      coordinates
    }))
  );
}

export async function loadWorldContoursFromFile(): Promise<WorldContourFeature[]> {
  const response = await fetch(
    `${import.meta.env.BASE_URL}data/geo/countries.geojson`
  );
  const data = await response.json();
  return parseWorldContours(data);
}
