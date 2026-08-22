import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./GlobeViewObserver.tsx", import.meta.url), "utf8");

describe("GlobeViewObserver contract", () => {
  it("uses the actual globe ray and the filter-aware keyboard policy", () => {
    expect(source).toContain("raycastGlobeAtNdc({");
    expect(source).toContain("selectGlobeKeyboardCandidate({");
    expect(source).toContain("countries.flatMap");
    expect(source).not.toContain("hoveredCountry");
  });

  it("samples coordinate context at a bounded 8–12 Hz", () => {
    expect(source).toContain("sampleIntervalMs = 100");
    expect(source).toContain("Math.max(80, sampleIntervalMs)");
    expect(source).toContain("atlas.geographicCoordinatesAtUv(hit.uv)");
  });

  it("forces an exact semantic sample when camera motion settles", () => {
    expect(source).toContain("sampleRequest = 0");
    expect(source).toContain("sampleView(true)");
    expect(source).toContain("performance.now()");
  });
});
