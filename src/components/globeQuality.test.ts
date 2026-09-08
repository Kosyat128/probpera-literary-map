import { describe, expect, it } from "vitest";
import { resolveGlobeQualityProfile } from "./globeQuality";

describe("canonical globe render quality profiles", () => {
  it("keeps the richest existing path as the default and explicit High overrides legacy economy", () => {
    const profile = resolveGlobeQualityProfile();
    expect(profile).toMatchObject({ tier: "high", dprCap: 1.5, starCount: 2400,
      surfaceWidthSegments: 144, surfaceHeightSegments: 96, antialias: true });
    expect(resolveGlobeQualityProfile("high", true)).toBe(profile);
  });

  it("gives Balanced strictly intermediate pixel and geometry budgets", () => {
    const high = resolveGlobeQualityProfile("high");
    const balanced = resolveGlobeQualityProfile("balanced");
    const economy = resolveGlobeQualityProfile("economy");
    for (const field of ["dprCap", "starCount", "skyWidthSegments", "skyHeightSegments",
      "surfaceWidthSegments", "surfaceHeightSegments", "highlightWidthSegments",
      "highlightHeightSegments", "contemporaryFrameSegments", "contemporaryBaseSegments",
      "modernFrameSegments", "equatorSegments"] as const) {
      expect(balanced[field], field).toBeGreaterThan(economy[field]);
      expect(balanced[field], field).toBeLessThan(high[field]);
    }
    expect(economy.skyShader).toBe(false);
    expect(balanced.skyShader).toBe(true);
  });

  it("never changes a context-creation attribute across explicit application tiers", () => {
    for (const tier of ["high", "balanced", "economy"] as const) {
      const profile = resolveGlobeQualityProfile(tier);
      expect(profile.antialias).toBe(true);
      expect(resolveGlobeQualityProfile(tier, true)).toBe(profile);
      expect(Object.isFrozen(profile)).toBe(true);
      expect(resolveGlobeQualityProfile(tier)).toBe(profile);
    }
  });

  it("preserves the legacy website economy detail and renderer creation settings", () => {
    const legacy = resolveGlobeQualityProfile(undefined, true);
    const explicit = resolveGlobeQualityProfile("economy");
    expect(legacy).toMatchObject({ dprCap: 1.1, starCount: 900,
      surfaceWidthSegments: 112, surfaceHeightSegments: 72, antialias: false });
    expect({ ...legacy, antialias: true }).toEqual(explicit);
    expect(Object.isFrozen(legacy)).toBe(true);
  });
});
