import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  geometryContainsGeographicPoint,
  geographicToSphere,
  GLOBE_LONGITUDE_OFFSET_DEGREES,
  uvToGeographic,
  type GlobeGeoGeometry,
} from "./globeGeography";

type TestFeature = {
  properties: {
    ISO_A2?: string;
    WB_A2?: string;
    POSTAL?: string;
  };
  geometry: GlobeGeoGeometry;
};

const worldAtlas = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../data/geo/countries.geojson", import.meta.url)),
    "utf8"
  )
) as { features: TestFeature[] };

function featureByCode(code: string) {
  return worldAtlas.features.find((feature) =>
    [
      feature.properties.ISO_A2,
      feature.properties.WB_A2,
      feature.properties.POSTAL,
    ].includes(code)
  );
}

describe("география интерактивного глобуса", () => {
  it("переводит UV в долготу и широту без ручных поправок по странам", () => {
    const [centerLongitude, centerLatitude] = uvToGeographic({
      x: 0.5,
      y: 0.5,
    });
    expect(centerLongitude).toBeCloseTo(-GLOBE_LONGITUDE_OFFSET_DEGREES);
    expect(centerLatitude).toBe(0);
    expect(uvToGeographic({ x: 0.75, y: 0.75 })).toEqual([
      90 - GLOBE_LONGITUDE_OFFSET_DEGREES,
      45,
    ]);
    expect(uvToGeographic({ x: 0.25, y: 0.25 })).toEqual([
      -90 - GLOBE_LONGITUDE_OFFSET_DEGREES,
      -45,
    ]);
  });

  it("использует ту же ориентацию для точки на сфере", () => {
    const textureCenter = geographicToSphere(
      -GLOBE_LONGITUDE_OFFSET_DEGREES,
      0
    );
    const textureEast = geographicToSphere(
      90 - GLOBE_LONGITUDE_OFFSET_DEGREES,
      0
    );
    const north = geographicToSphere(0, 90);

    expect(textureCenter.x).toBeCloseTo(1);
    expect(textureCenter.z).toBeCloseTo(0);
    expect(textureEast.x).toBeCloseTo(0);
    expect(textureEast.z).toBeCloseTo(-1);
    expect(north.y).toBeCloseTo(1);
  });

  it("учитывает отверстия в GeoJSON-полигонах", () => {
    const geometry: GlobeGeoGeometry = {
      type: "Polygon",
      coordinates: [
        [
          [-10, -10],
          [10, -10],
          [10, 10],
          [-10, 10],
          [-10, -10],
        ],
        [
          [-2, -2],
          [2, -2],
          [2, 2],
          [-2, 2],
          [-2, -2],
        ],
      ],
    };

    expect(geometryContainsGeographicPoint(geometry, 7, 0)).toBe(true);
    expect(geometryContainsGeographicPoint(geometry, 0, 0)).toBe(false);
  });

  it("корректно распознаёт полигон через линию перемены дат", () => {
    const geometry: GlobeGeoGeometry = {
      type: "Polygon",
      coordinates: [
        [
          [170, -10],
          [-170, -10],
          [-170, 10],
          [170, 10],
          [170, -10],
        ],
      ],
    };

    expect(geometryContainsGeographicPoint(geometry, 179, 0)).toBe(true);
    expect(geometryContainsGeographicPoint(geometry, -179, 0)).toBe(true);
    expect(geometryContainsGeographicPoint(geometry, 0, 0)).toBe(false);
  });

  it.each([
    ["BR", -47.8828, -15.7939],
    ["FR", 2.3522, 48.8566],
    ["JP", 139.6917, 35.6895],
    ["AU", 133.7751, -25.2744],
    ["RU", 37.6173, 55.7558],
  ])(
    "находит реальную контрольную точку %s внутри того же GeoJSON-контура",
    (countryCode, longitude, latitude) => {
      const feature = featureByCode(countryCode);

      expect(feature, `В атласе отсутствует ${countryCode}`).toBeDefined();
      expect(
        geometryContainsGeographicPoint(
          feature!.geometry,
          longitude,
          latitude
        )
      ).toBe(true);
    }
  );
});
