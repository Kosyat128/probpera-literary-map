import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  adaptHistoricalPixels,
  buildCanonicalMasks,
  computeUnionCoastlineEdge,
  summarizeConfiguredTransform,
  validateAlignmentConfig,
} from "../build-cassini-adapted-master.mjs";

const rectangle = (west, south, east, north) => [
  [
    [west, south],
    [east, south],
    [east, north],
    [west, north],
    [west, south],
  ],
];

describe("Cassini Interactive Adapted Master", () => {
  it("unions adjacent land, preserves protected RGB, and adapts deterministically", async () => {
    const config = validateAlignmentConfig(
      JSON.parse(
        await readFile(
          fileURLToPath(
            new URL("../globe-editions/cassini-1790-alignment.json", import.meta.url)
          ),
          "utf8"
        )
      )
    );
    const atlas = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { ADM0_A3: "WST" },
          geometry: { type: "Polygon", coordinates: rectangle(-60, 10, 0, 40) },
        },
        {
          type: "Feature",
          properties: { ADM0_A3: "EST" },
          geometry: { type: "Polygon", coordinates: rectangle(0, 10, 60, 40) },
        },
        {
          type: "Feature",
          properties: { ADM0_A3: "ATA" },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [-170, -65],
                [0, -75],
                [170, -65],
                [170, -89],
                [-170, -89],
                [-170, -65],
              ],
            ],
          },
        },
      ],
    };
    const width = 64;
    const height = 32;
    const { landMask, antarcticaMask } = await buildCanonicalMasks(
      atlas,
      width,
      height,
      { property: "ADM0_A3", value: "ATA" }
    );
    const edge = computeUnionCoastlineEdge(landMask, width, height);
    const internalBoundaryX = width / 2;
    const midLandY = Math.floor(((90 - 25) / 180) * height);
    expect(edge[midLandY * width + internalBoundaryX]).toBe(0);
    expect(edge.some((value) => value > 0)).toBe(true);

    const historicalRgb = Buffer.alloc(width * height * 3);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = (y * width + x) * 3;
        historicalRgb[index] = 176 + (x % 11);
        historicalRgb[index + 1] = 148 + (y % 9);
        historicalRgb[index + 2] = 92 + ((x + y) % 7);
      }
    }
    const protectedRegions = [
      {
        id: "synthetic-protected-edge",
        westLongitudeDeg: -64,
        eastLongitudeDeg: -56,
        southLatitudeDeg: 15,
        northLatitudeDeg: 35,
      },
    ];
    const options = {
      historicalRgb,
      width,
      height,
      landMask,
      antarcticaMask,
      coastline: { maximumDarkeningOpacity: 0.28 },
      antarctica: {
        sourceStrip: {
          northLatitudeDeg: -40,
          southLatitudeDeg: -55,
          lowFrequencyColumns: 8,
          lowFrequencyRows: 2,
        },
      },
      protectedRegions,
    };
    const first = adaptHistoricalPixels(options);
    const second = adaptHistoricalPixels(options);
    expect(first.output.equals(second.output)).toBe(true);
    expect(first.coastlineDarkenedPixelCount).toBeGreaterThan(0);
    expect(first.antarcticaAffectedPixelCount).toBeGreaterThan(0);
    expect(
      first.provenanceClasses.reduce(
        (sum, entry) => sum + entry.pixelCount,
        0
      )
    ).toBe(width * height);

    let protectedPixelCount = 0;
    for (let y = 0; y < height; y += 1) {
      const latitude = 90 - ((y + 0.5) / height) * 180;
      for (let x = 0; x < width; x += 1) {
        const longitude = ((x + 0.5) / width) * 360 - 180;
        if (
          longitude >= -64 &&
          longitude <= -56 &&
          latitude >= 15 &&
          latitude <= 35
        ) {
          const start = (y * width + x) * 3;
          expect(first.output.subarray(start, start + 3)).toEqual(
            historicalRgb.subarray(start, start + 3)
          );
          protectedPixelCount += 1;
        }
      }
    }
    expect(protectedPixelCount).toBeGreaterThan(0);

    const transform = summarizeConfiguredTransform(
      config.transform.controlPoints,
      width,
      height
    );
    expect(transform.maximumDisplacementPixels).toBe(0);
    expect(transform.pass).toBeNull();
  });
});
