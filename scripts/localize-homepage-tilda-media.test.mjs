import { describe, expect, it } from "vitest";

import { homepageTildaAssets } from "./localize-homepage-tilda-media.mjs";

describe("homepage Tilda media migration map", () => {
  it("covers every reviewed handwritten homepage reference exactly once", () => {
    expect(homepageTildaAssets).toHaveLength(12);
    expect(new Set(homepageTildaAssets.map((asset) => asset.sourceUrl)).size).toBe(
      homepageTildaAssets.length
    );
    expect(new Set(homepageTildaAssets.map((asset) => asset.publicPath)).size).toBe(
      homepageTildaAssets.length
    );
    expect(
      homepageTildaAssets.reduce(
        (total, asset) => total + asset.expectedOccurrences,
        0
      )
    ).toBe(15);
  });

  it("keeps sources and local destinations inside deliberate boundaries", () => {
    for (const asset of homepageTildaAssets) {
      expect(asset.sourceUrl).toMatch(
        /^https:\/\/static\.tildacdn\.com\/[^\s]+$/u
      );
      expect(asset.publicPath).toMatch(
        /^brand\/legacy-sections\/[a-z0-9-]+\.webp$/u
      );
      expect(asset.expectedOccurrences).toBeGreaterThan(0);
      expect(asset.label.trim().length).toBeGreaterThan(0);
    }
  });
});
