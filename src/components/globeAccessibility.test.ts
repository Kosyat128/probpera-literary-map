import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const globeSource = readFileSync(
  new URL("./LiteraryGlobe.tsx", import.meta.url),
  "utf8"
);

describe("literary globe accessible interaction wiring", () => {
  it("exposes keyboard shortcuts and explicit touch-sized controls", () => {
    expect(globeSource).toContain('tabIndex={0}');
    expect(globeSource).toContain(
      'aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown + - Home Enter"'
    );
    for (const control of ["zoom-out", "zoom-in", "auto-rotate", "reset"]) {
      expect(globeSource).toContain(`data-globe-control="${control}"`);
    }
  });

  it("uses the shared click-versus-drag gesture for surfaces and markers", () => {
    expect(globeSource).toContain("beginGlobePointerGesture");
    expect(globeSource).toContain("updateGlobePointerGesture");
    expect(globeSource).toContain("isGlobePointerTap");
    expect(globeSource.match(/finishPointerGesture\(/gu)?.length).toBeGreaterThanOrEqual(
      4
    );
  });

  it("reports why automatic rotation is paused", () => {
    expect(globeSource).toContain("shouldGlobeAutoRotate");
    expect(globeSource).toContain("data-globe-auto-rotate={autoRotateStatus}");
    expect(globeSource).toMatch(/reducedMotion\s*\?\s*"reduced-motion"/u);
    expect(globeSource).toMatch(/selectedCountry\s*\?\s*"selection"/u);
    expect(globeSource).toContain("disabled={reducedMotion}");
    expect(globeSource).toContain("autoRotateControlLabel");
  });

  it("offers recovery and avoids a continuous frame loop for static scenes", () => {
    expect(globeSource).toContain("Повторить загрузку глобуса");
    expect(globeSource).toContain("data-globe-load-state");
    expect(globeSource).toContain("data-globe-frame-mode={frameMode}");
    expect(globeSource).toMatch(/\?\s*"always"\s*:\s*"demand"/u);
  });

  it("keeps the same real sky and star field behind every public style", () => {
    const sceneSource = globeSource.slice(
      globeSource.indexOf("function GlobeScene"),
      globeSource.indexOf("export default function LiteraryGlobe")
    );
    const skyDomeStart = sceneSource.indexOf("<MuseumSkyDome");
    const starFieldStart = sceneSource.indexOf("<MuseumStarfield");

    expect(skyDomeStart).toBeGreaterThan(0);
    expect(starFieldStart).toBeGreaterThan(skyDomeStart);
    expect(sceneSource).not.toContain('visualStyle !== "modern"');
    expect(sceneSource).toContain(
      '<MuseumSkyDome reducedMotion={reducedMotion} economical={economical} />'
    );
    expect(sceneSource).toContain(
      '<MuseumStarfield economical={economical} reducedMotion={reducedMotion} />'
    );
    expect(globeSource).toContain(
      '<cylinderGeometry args={[0.31, 0.42, 0.08, 48]} />'
    );
  });
});
