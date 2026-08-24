import { describe, expect, it } from "vitest";

import {
  createGlobeCoordinates,
  formatGlobeCoordinatesDms,
  formatLatitudeDms,
  formatLongitudeDms,
  resolveCountryGlobeCoordinates,
  resolveGlobeCoordinateContext,
} from "./globeCoordinates";

describe("globe coordinate context", () => {
  it("uses writer, selected country, hover country, then view centre priority", () => {
    const context = resolveGlobeCoordinateContext({
      viewCentre: {
        coordinates: { latitude: 1, longitude: 2 },
        label: "View centre",
      },
      hoverCountry: {
        coordinates: { latitude: 3, longitude: 4 },
        label: "Hover",
      },
      selectedCountry: {
        coordinates: { latitude: 5, longitude: 6 },
        label: "Selected",
      },
      writer: {
        coordinates: { latitude: 7, longitude: 8 },
        label: "Writer",
      },
    });

    expect(context).toEqual({
      latitude: 7,
      longitude: 8,
      source: "writer",
      label: "Writer",
    });
  });

  it("skips invalid higher-priority coordinates", () => {
    expect(
      resolveGlobeCoordinateContext({
        writer: { coordinates: { latitude: 91, longitude: 20 } },
        selectedCountry: {
          coordinates: { latitude: 48.8566, longitude: 2.3522 },
          label: "Paris",
        },
      })
    ).toMatchObject({
      source: "selected-country",
      latitude: 48.8566,
      longitude: 2.3522,
    });
    expect(createGlobeCoordinates(Number.NaN, 0)).toBeNull();
    expect(createGlobeCoordinates(0, 181)).toBeNull();
  });

  it("normalizes tuple, object, microstate and writer-mean country centres", () => {
    const country = (value: Partial<Parameters<typeof resolveCountryGlobeCoordinates>[0]>) => ({
      code: undefined,
      coordinates: undefined,
      writers: [],
      ...value,
    });
    expect(resolveCountryGlobeCoordinates(country({ coordinates: [12, 34] })))
      .toEqual({ latitude: 12, longitude: 34 });
    expect(
      resolveCountryGlobeCoordinates(
        country({ coordinates: { lat: -22, lng: 44 } })
      )
    ).toEqual({ latitude: -22, longitude: 44 });
    expect(resolveCountryGlobeCoordinates(country({ code: "VA" }))).toEqual({
      latitude: 41.9029,
      longitude: 12.4534,
    });
    expect(
      resolveCountryGlobeCoordinates(
        country({
          writers: [
            { id: "a", coordinates: { lat: 10, lng: 20 } },
            { id: "b", coordinates: { lat: 10, lng: 20 } },
          ],
        })
      )
    ).toMatchObject({ latitude: 10, longitude: 20 });
  });
});

describe("DMS coordinate formatting", () => {
  it("carries rounded minutes without ever producing 60 minutes", () => {
    expect(formatLatitudeDms(12 + 59 / 60 + 59.8 / 3600)).toBe(
      "13°00′ N"
    );
    expect(formatLongitudeDms(-(4 + 59 / 60 + 59.8 / 3600))).toBe(
      "5°00′ W"
    );
  });

  it("clamps display rounding to the geographic poles and antimeridian", () => {
    const display = formatGlobeCoordinatesDms({
      latitude: 89.9999999,
      longitude: 179.9999999,
    });
    expect(display).toBe("90°00′ N · 180°00′ E");
    expect(display).not.toContain("60′");
    expect(display).not.toContain("181°");
  });

  it("returns no readout for invalid data", () => {
    expect(
      formatGlobeCoordinatesDms({ latitude: -91, longitude: 37.62 })
    ).toBeNull();
    expect(formatLatitudeDms(Number.POSITIVE_INFINITY)).toBeNull();
  });
});
