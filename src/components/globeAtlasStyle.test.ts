import { describe, expect, it } from "vitest";

import {
  GLOBE_VISUAL_STYLES,
  GLOBE_VISUAL_STYLE_LABELS,
  MODERN_GLOBE_EDITION,
  featureCountryCodeCandidates,
  globeTextureAssetName,
  isGlobeVisualStyle,
  modernFeatureColor,
} from "./globeAtlas";

describe("globe visual styles", () => {
  it("keeps a stable, exhaustive three-style contract", () => {
    expect(GLOBE_VISUAL_STYLES).toEqual(["antique", "earth", "modern"]);
    expect(GLOBE_VISUAL_STYLES.every(isGlobeVisualStyle)).toBe(true);
    expect(isGlobeVisualStyle("satellite")).toBe(false);
    expect(isGlobeVisualStyle(null)).toBe(false);
  });

  it("matches public mode names to the actual texture semantics", () => {
    expect(GLOBE_VISUAL_STYLE_LABELS).toEqual({
      antique: { full: "Старинный", compact: "Ретро" },
      earth: { full: "Современный", compact: "Современный" },
      modern: { full: "Классический", compact: "Классич." },
    });
    expect(globeTextureAssetName("earth", false)).toContain("blue-marble");
    expect(globeTextureAssetName("modern", false)).toContain("modern-atlas");
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

  it("uses a responsive 2026 texture for the modern surface", () => {
    expect(globeTextureAssetName("modern", false, "ru")).toBe(
      "textures/modern-atlas-2026-ru.webp"
    );
    expect(globeTextureAssetName("modern", true, "ru")).toBe(
      "textures/modern-atlas-2026-ru-mobile.webp"
    );
    expect(globeTextureAssetName("modern", false, "en")).toBe(
      "textures/modern-atlas-2026-en.webp"
    );
    expect(globeTextureAssetName("modern", true, "en")).toBe(
      "textures/modern-atlas-2026-en-mobile.webp"
    );
    expect(MODERN_GLOBE_EDITION).toEqual({
      year: 2026,
      source: "Natural Earth",
      sourceVersion: "5.1.2",
      scale: "1:110m",
    });
  });

  it("keeps modern country colors stable for the source map color index", () => {
    expect(modernFeatureColor(1, 99)).toBe("#d4df86");
    expect(modernFeatureColor(13, 0)).toBe("#d5cc7b");
    expect(modernFeatureColor(1, 4)).toBe(modernFeatureColor(1, 12));
  });

  it("never treats Natural Earth postal abbreviations as ISO country codes", () => {
    expect(
      featureCountryCodeCandidates({
        ISO_A2: "-99",
        WB_A2: "-99",
        POSTAL: "CN",
        ADM0_A3: "CYN",
      })
    ).toEqual(["CY"]);
    expect(
      featureCountryCodeCandidates({
        ISO_A2: "-99",
        WB_A2: "-99",
        POSTAL: "SL",
        ADM0_A3: "SOL",
      })
    ).toEqual(["SO"]);
  });

  it("keeps reviewed Natural Earth special mappings explicit", () => {
    expect(featureCountryCodeCandidates({ ADM0_A3: "KOS" })).toEqual(["XK"]);
    expect(featureCountryCodeCandidates({ ADM0_A3: "NOR" })).toEqual(["NO"]);
    expect(
      featureCountryCodeCandidates({ ADM0_A3: "TWN", ISO_A2: "CN-TW" })
    ).toEqual(["TW"]);
    expect(featureCountryCodeCandidates({ ADM0_A3: "CYN" })).toEqual(["CY"]);
    expect(featureCountryCodeCandidates({ ADM0_A3: "SOL" })).toEqual(["SO"]);
  });
});
