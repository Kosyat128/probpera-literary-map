import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const atlasSource = readFileSync(new URL("./globeAtlas.ts", import.meta.url), "utf8");
const globeSource = readFileSync(
  new URL("./LiteraryGlobe.tsx", import.meta.url),
  "utf8"
);

describe("globe atlas performance contracts", () => {
  it("keeps dynamic highlights mip-free and bounded", () => {
    const dynamicTextureSource = atlasSource.slice(
      atlasSource.indexOf("function configureDynamicHighlightTexture"),
      atlasSource.indexOf("async function loadVisualStyleMap")
    );
    expect(dynamicTextureSource).toContain("texture.generateMipmaps = false");
    expect(dynamicTextureSource).toContain("texture.minFilter = THREE.LinearFilter");
    expect(atlasSource).toContain("const HIGHLIGHT_WIDTH = 1024");
    expect(atlasSource).toContain("const HIGHLIGHT_HEIGHT = 512");
    expect(atlasSource).toContain("configureDynamicHighlightTexture(");
  });

  it("loads flags only for selected or hovered countries", () => {
    expect(atlasSource).not.toContain("flagPreloadQueue");
    expect(atlasSource).not.toContain("preloadFlagBatch");
    const highlightSource = atlasSource.slice(
      atlasSource.indexOf("const drawFlagHighlight"),
      atlasSource.indexOf("const drawModernHighlight")
    );
    expect(highlightSource).toContain("loadFlagImage(countryId)");
  });

  it("caches principal-geometry focus metrics", () => {
    expect(atlasSource).toContain("countryFocusMetricsFromGeometries(");
    expect(atlasSource).toContain("focusMetricsForCountry");
    expect(atlasSource).toContain("const focusMetrics = new Map");
  });

  it("delegates focus prewarm to the input-aware idle scheduler", () => {
    const prewarmSource = atlasSource.slice(
      atlasSource.indexOf("const prewarmFocusMetrics"),
      atlasSource.indexOf("const outlineGeometryForCountry")
    );
    expect(prewarmSource).toContain("scheduleGlobeIdlePrewarm");
    expect(prewarmSource).toContain("options.shouldPause");
    expect(prewarmSource).not.toContain("requestIdleCallback");
    expect(prewarmSource).not.toContain("setTimeout");
  });

  it("pauses prewarm for camera and every globe input family", () => {
    expect(globeSource).toContain("shouldPause: shouldPauseFocusPrewarm");
    expect(globeSource).toContain("if (!atlas || !globeActive) return");
    expect(globeSource).toContain("cameraFlightActive || cameraControlsActive");
    for (const handler of [
      "onPointerDownCapture",
      "onPointerMoveCapture",
      "onTouchStartCapture",
      "onTouchMoveCapture",
      "onWheelCapture",
      "onKeyDownCapture",
    ]) {
      expect(globeSource).toContain(handler);
    }
  });
});
