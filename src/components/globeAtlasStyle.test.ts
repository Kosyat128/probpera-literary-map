import { describe, expect, it } from "vitest";

import {
  GLOBE_VISUAL_STYLES,
  globeTextureAssetName,
  isGlobeVisualStyle,
} from "./globeAtlas";

describe("globe visual styles", () => {
  it("keeps a stable, exhaustive three-style contract", () => {
    expect(GLOBE_VISUAL_STYLES).toEqual(["antique", "earth", "modern"]);
    expect(GLOBE_VISUAL_STYLES.every(isGlobeVisualStyle)).toBe(true);
    expect(isGlobeVisualStyle("satellite")).toBe(false);
    expect(isGlobeVisualStyle(null)).toBe(false);
  });

  it("uses only local, responsive raster assets", () => {
    expect(globeTextureAssetName("antique", false)).toBe(
      "textures/antique-world-1887.webp"
    );
    expect(globeTextureAssetName("antique", true)).toBe(
      "textures/antique-world-1887-mobile.webp"
    );
    expect(globeTextureAssetName("earth", false)).toBe(
      "textures/earth-blue-marble.webp"
    );
    expect(globeTextureAssetName("earth", true)).toBe(
      "textures/earth-blue-marble-mobile.webp"
    );
  });

  it("keeps the modern surface procedural", () => {
    expect(globeTextureAssetName("modern", false)).toBeNull();
    expect(globeTextureAssetName("modern", true)).toBeNull();
  });
});
