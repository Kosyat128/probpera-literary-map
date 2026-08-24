import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const publicStyles = readFileSync(
  new URL("../index.css", import.meta.url),
  "utf8"
).replace(/\r\n/gu, "\n");
const globeSource = readFileSync(
  new URL("./LiteraryGlobe.tsx", import.meta.url),
  "utf8"
).replace(/\r\n/gu, "\n");

const sharedSceneStart = publicStyles.indexOf(
  '.literary-globe[data-globe-style="antique"],\n.literary-globe[data-globe-style="earth"],\n.literary-globe[data-globe-style="modern"]'
);
const sharedPaletteStart = publicStyles.indexOf(
  '.literary-globe[data-globe-style="antique"],\n.literary-globe[data-globe-style="earth"],\n.literary-globe[data-globe-style="modern"]',
  sharedSceneStart + 1
);
const sharedPaletteEnd = publicStyles.indexOf(
  ".literary-globe::before {",
  sharedPaletteStart + 1
);
const sharedStarfield = publicStyles.slice(sharedSceneStart, sharedPaletteStart);
const sharedPalette = publicStyles.slice(sharedPaletteStart, sharedPaletteEnd);
const stageThemeStart = publicStyles.indexOf(
  ".world-map-stage {\n  background:\n    radial-gradient(ellipse at 50% 41%"
);
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
const laterStageOverrides = publicStyles.slice(stageFrameEnd);

describe("globe scene starfield", () => {
  it("does not force a 320px document under classic scrollbar viewports", () => {
    expect(publicStyles).not.toContain("min-width: 320px");
  });

  it("renders one irregular field across the full scene without tiled seams", () => {
    expect(sharedSceneStart).toBeGreaterThan(-1);
    expect(sharedPaletteStart).toBeGreaterThan(sharedSceneStart);
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
    expect(laterStageOverrides).not.toMatch(/background-repeat:\s*repeat/);
    expect(laterStageOverrides).not.toMatch(/background-size:\s*\d+px/);
  });

  it("gives every globe mode the exact same visible background palette", () => {
    expect(sharedPaletteEnd).toBeGreaterThan(sharedPaletteStart);
    expect(sharedPalette).toContain("--globe-scene-theme: shared-starry");
    expect(sharedPalette).toContain("--globe-star-bright: rgba(255, 252, 247, 0.88)");
    expect(sharedPalette).toContain("--globe-star-cool: rgba(178, 215, 255, 0.72)");
    expect(sharedPalette).toContain(
      "--globe-scene-base: linear-gradient(155deg, #271039 0%, #180722 56%, #100418 100%)"
    );
    expect(sharedPalette).not.toContain("#132c39");
    expect(publicStyles).not.toContain("--globe-scene-theme: purple-starry");
    expect(publicStyles).not.toContain("--globe-scene-theme: cold-starry");
    expect(sharedStarfield).not.toContain("animation:");
  });

  it("keeps the WebGL sky and vignette identical in all three modes", () => {
    expect(globeSource).toMatch(
      /<MuseumSkyDome\s+reducedMotion=\{reducedMotion\}\s+economical=\{economical\}\s+animate=\{autoRotate\}\s*\/>/u
    );
    expect(globeSource).not.toContain('visualStyle !== "modern" &&');
    expect(publicStyles).not.toContain(
      '[data-globe-style="modern"] .globe-vignette'
    );
    expect(publicStyles).not.toContain(
      '[data-globe-style="earth"] .globe-vignette'
    );
  });
});
