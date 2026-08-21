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
const stageThemeStart = publicStyles.lastIndexOf(".world-map-stage {");
const stageFrameStart = publicStyles.indexOf(
  ".world-map-stage::before {",
  stageThemeStart
);
const stageFrameEnd = publicStyles.indexOf(
  ".world-map-stage::after {",
  stageFrameStart
);
const stageTheme = publicStyles.slice(stageThemeStart, stageFrameStart);
const stageFrame = publicStyles.slice(stageFrameStart, stageFrameEnd);

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
    expect(stageThemeStart).toBeGreaterThan(-1);
    expect(stageFrameStart).toBeGreaterThan(stageThemeStart);
    expect(stageTheme).toContain("background-repeat: no-repeat");
    expect(stageTheme).toContain("background-size: 100% 100%");
    expect(stageTheme).not.toMatch(/\/\s*\d+px\s+\d+px/);
    expect(stageFrame).toContain("background: none");
    expect(stageFrame).not.toMatch(/linear-gradient\([^)]*50%/);
  });

  it("keeps separate purple and cold palettes without animating the field", () => {
    expect(publicStyles).toContain("--globe-scene-theme: purple-starry");
    expect(publicStyles).toContain("--globe-scene-theme: cold-starry");
    expect(sharedStarfield).not.toContain("animation:");
  });
});
