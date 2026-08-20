import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const publicStyles = readFileSync(
  new URL("../index.css", import.meta.url),
  "utf8"
);

const sharedSceneStart = publicStyles.indexOf(
  '.literary-globe[data-globe-style="earth"],\n.literary-globe[data-globe-style="modern"]'
);
const earthThemeStart = publicStyles.indexOf(
  '.literary-globe[data-globe-style="earth"] {',
  sharedSceneStart + 1
);
const sharedStarfield = publicStyles.slice(sharedSceneStart, earthThemeStart);

describe("globe scene starfield", () => {
  it("does not force a 320px document under classic scrollbar viewports", () => {
    expect(publicStyles).not.toContain("min-width: 320px");
  });

  it("renders one irregular field across the full scene without tiled seams", () => {
    expect(sharedSceneStart).toBeGreaterThan(-1);
    expect(earthThemeStart).toBeGreaterThan(sharedSceneStart);
    expect(
      sharedStarfield.match(/radial-gradient\(circle at/g)?.length
    ).toBeGreaterThanOrEqual(30);
    expect(sharedStarfield).toContain("background-repeat: no-repeat");
    expect(sharedStarfield).toContain("background-size: 100% 100%");
    expect(sharedStarfield).not.toMatch(/background-size:\s*\n?\s*\d+px/);
    expect(sharedStarfield).not.toContain("repeating-radial-gradient");
  });

  it("keeps separate purple and cold palettes without animating the field", () => {
    expect(publicStyles).toContain("--globe-scene-theme: purple-starry");
    expect(publicStyles).toContain("--globe-scene-theme: cold-starry");
    expect(sharedStarfield).not.toContain("animation:");
  });
});
