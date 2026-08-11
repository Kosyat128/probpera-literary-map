import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { countries } from "../data/countries";
import {
  featureCentroid,
  featureCountryCodeCandidates,
} from "./globeAtlas";
import { fallbackCountryCoordinates } from "./LiteraryGlobe";
import {
  geometryContainsGeographicPoint,
  type GlobeGeoGeometry,
} from "./globeGeography";

type AtlasFeature = {
  type: "Feature";
  properties: {
    NAME?: string;
    ISO_A2?: string;
    WB_A2?: string;
    POSTAL?: string;
    ADM0_A3?: string;
    MAPCOLOR13?: number;
  };
  geometry: GlobeGeoGeometry;
};

const atlas = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../data/geo/countries.geojson", import.meta.url)),
    "utf8"
  )
) as { features: AtlasFeature[] };

function countryCoverageInventory() {
  const exactPolygonCodes = new Set(
    atlas.features.flatMap((feature) =>
      featureCountryCodeCandidates(feature.properties)
    )
  );
  // Metropolitan France and French Guiana share one Natural Earth feature;
  // createGlobeAtlas partitions the South-American polygon for the GF card.
  exactPolygonCodes.add("GF");

  return countries.map((country) => {
    const code = country.code?.toUpperCase() ?? "";
    const mode = exactPolygonCodes.has(code)
      ? "polygon"
      : fallbackCountryCoordinates(country)
        ? "marker"
        : "missing";
    return { code, id: country.id, mode } as const;
  });
}

describe("globe country coverage", () => {
  it("gives every one of the 200 country cards a polygon or intentional marker", () => {
    const inventory = countryCoverageInventory();
    const polygons = inventory.filter(({ mode }) => mode === "polygon");
    const markers = inventory.filter(({ mode }) => mode === "marker");
    const missing = inventory.filter(({ mode }) => mode === "missing");

    expect(inventory).toHaveLength(200);
    expect(missing).toEqual([]);
    expect(polygons).toHaveLength(167);
    expect(markers).toHaveLength(33);
    expect(markers.map(({ code }) => code).sort()).toEqual([
      "AD",
      "AG",
      "BB",
      "BH",
      "CK",
      "CV",
      "DM",
      "FM",
      "GD",
      "HK",
      "KI",
      "KM",
      "KN",
      "LC",
      "LI",
      "MC",
      "MH",
      "MO",
      "MT",
      "MU",
      "MV",
      "NR",
      "NU",
      "PW",
      "SC",
      "SG",
      "SM",
      "ST",
      "TO",
      "TV",
      "VA",
      "VC",
      "WS",
    ]);
  });

  it("keeps every separately drawn Natural Earth territory clickable", () => {
    expect(featureCountryCodeCandidates({ ADM0_A3: "TWN", ISO_A2: "CN-TW" })).toContain(
      "TW"
    );
    expect(featureCountryCodeCandidates({ ADM0_A3: "CYN", POSTAL: "CN" })).toEqual([
      "CY",
    ]);
    expect(featureCountryCodeCandidates({ ADM0_A3: "SOL", POSTAL: "SL" })).toEqual([
      "SO",
    ]);
  });

  it("centers Indonesia across the complete archipelago", () => {
    const indonesia = atlas.features.find(
      (feature) => feature.properties.ADM0_A3 === "IDN"
    );
    expect(indonesia).toBeDefined();
    expect(indonesia!.geometry.type).toBe("MultiPolygon");
    expect(indonesia!.geometry.coordinates).toHaveLength(13);

    const center = featureCentroid([indonesia!]);
    expect(center).not.toBeNull();
    expect(center![0]).toBeGreaterThan(-5);
    expect(center![0]).toBeLessThan(1);
    expect(center![1]).toBeGreaterThan(115);
    expect(center![1]).toBeLessThan(120);
  });

  it.each([
    ["Sumatra", 98.6722, 3.5952],
    ["Java", 106.8456, -6.2088],
    ["Kalimantan", 109.3425, -0.0263],
    ["Sulawesi", 121.1964, -2.112],
    ["Papua", 140.6689, -2.5916],
  ])("keeps the %s part of Indonesia selectable", (_, longitude, latitude) => {
    const indonesia = atlas.features.find(
      (feature) => feature.properties.ADM0_A3 === "IDN"
    );
    expect(indonesia).toBeDefined();
    expect(
      geometryContainsGeographicPoint(
        indonesia!.geometry,
        longitude as number,
        latitude as number
      )
    ).toBe(true);
  });
});
