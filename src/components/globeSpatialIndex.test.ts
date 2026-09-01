import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  geometryContainsGeographicPoint,
  type GlobeGeoGeometry,
} from "./globeGeography";
import {
  createGlobeCountrySpatialIndex,
  globeGeometryBounds,
} from "./globeAtlas";

function polygon(
  outer: Array<[number, number]>,
  holes: Array<Array<[number, number]>> = []
): GlobeGeoGeometry {
  return { type: "Polygon", coordinates: [outer, ...holes] };
}

describe("globe country spatial index", () => {
  it("splits antimeridian bounds without widening them across the world", () => {
    const geometry = polygon([
      [170, -10],
      [-170, -10],
      [-170, 10],
      [170, 10],
      [170, -10],
    ]);

    expect(globeGeometryBounds(geometry)).toEqual([
      {
        minimumLatitude: -10,
        maximumLatitude: 10,
        longitudeRanges: [
          { minimum: 170, maximum: 180 },
          { minimum: -180, maximum: -170 },
        ],
      },
    ]);
  });

  it("finds both sides of the dateline and retains the exact hole predicate", () => {
    const dateline = polygon([
      [170, -10],
      [-170, -10],
      [-170, 10],
      [170, 10],
      [170, -10],
    ]);
    const withHole = polygon(
      [
        [-20, -20],
        [20, -20],
        [20, 20],
        [-20, 20],
        [-20, -20],
      ],
      [
        [
          [-5, -5],
          [5, -5],
          [5, 5],
          [-5, 5],
          [-5, -5],
        ],
      ]
    );
    const index = createGlobeCountrySpatialIndex([
      { geometry: dateline, value: "dateline" },
      { geometry: withHole, value: "holed" },
    ]);

    expect(index.find(179, 0)).toBe("dateline");
    expect(index.find(-179, 0)).toBe("dateline");
    expect(index.find(10, 0)).toBe("holed");
    expect(index.find(0, 0)).toBeNull();
    expect(index.candidateCountAt(100, 50)).toBe(0);
  });

  it("releases indexed references when its owner is disposed", () => {
    const index = createGlobeCountrySpatialIndex([
      {
        geometry: polygon([
          [30, 30],
          [40, 30],
          [40, 40],
          [30, 40],
          [30, 30],
        ]),
        value: { id: "resource" },
      },
    ]);

    expect(index.find(35, 35)).toEqual({ id: "resource" });
    index.clear();
    expect(index.find(35, 35)).toBeNull();
    expect(index.candidateCountAt(35, 35)).toBe(0);
  });

  it("matches the legacy full scan across the production world geometry", () => {
    const features = (
      JSON.parse(
        readFileSync(
          fileURLToPath(
            new URL("../data/geo/countries.geojson", import.meta.url)
          ),
          "utf8"
        )
      ) as { features: Array<{ geometry: GlobeGeoGeometry }> }
    ).features;
    const index = createGlobeCountrySpatialIndex(
      features.map((feature, featureIndex) => ({
        geometry: feature.geometry,
        value: featureIndex,
      }))
    );
    const mismatches: Array<{
      longitude: number;
      latitude: number;
      expected: number | null;
      actual: number | null;
    }> = [];

    for (let latitude = -85; latitude <= 85; latitude += 10) {
      for (let longitude = -175; longitude <= 175; longitude += 10) {
        const expectedIndex = features.findIndex((feature) =>
          geometryContainsGeographicPoint(
            feature.geometry,
            longitude,
            latitude
          )
        );
        const expected = expectedIndex >= 0 ? expectedIndex : null;
        const actual = index.find(longitude, latitude);
        if (actual !== expected) {
          mismatches.push({ longitude, latitude, expected, actual });
        }
      }
    }

    expect(mismatches).toEqual([]);
  });
});
