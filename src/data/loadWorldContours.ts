import type { WorldContourFeature } from "./worldContours";

export function parseWorldContours(data:any): WorldContourFeature[] {
  const features = data?.features ?? [];

  return features
    .map((feature:any) => ({
      coordinates: feature?.geometry?.coordinates
    }))
    .filter((item:WorldContourFeature) => Boolean(item.coordinates));
}
