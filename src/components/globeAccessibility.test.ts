import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const globeSource = readFileSync(
  new URL("./LiteraryGlobe.tsx", import.meta.url),
  "utf8"
);
const nobelLayerSource = readFileSync(
  new URL("./NobelMarkerLayer.tsx", import.meta.url),
  "utf8"
);
const worldMapSource = readFileSync(
  new URL("./LiteraryWorldMap.tsx", import.meta.url),
  "utf8"
);
const performanceSource = readFileSync(
  new URL("./globePerformance.ts", import.meta.url),
  "utf8"
);
const experienceChromeSource = readFileSync(
  new URL("./AtlasExperienceChrome.tsx", import.meta.url),
  "utf8"
);
const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");

describe("literary globe accessible interaction wiring", () => {
  it("exposes keyboard shortcuts and explicit touch-sized controls", () => {
    expect(globeSource).toContain('tabIndex={0}');
    expect(globeSource).toContain(
      'aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown + - Home Enter"'
    );
    for (const control of ["zoom-out", "zoom-in", "auto-rotate", "reset"]) {
      expect(globeSource).toContain(`data-globe-control="${control}"`);
    }

    expect(globeSource.indexOf('data-globe-control="zoom-in"')).toBeLessThan(
      globeSource.indexOf('data-globe-control="zoom-out"')
    );
  });

  it("uses the existing Proba Pera mark for the immersive identity", () => {
    const identitySource = experienceChromeSource.slice(
      experienceChromeSource.indexOf('className="atlas-immersive-identity"'),
      experienceChromeSource.indexOf('<nav aria-label=')
    );
    expect(experienceChromeSource).toContain("brand/probpera-logo.png");
    expect(experienceChromeSource).toContain('className="atlas-immersive-identity"');
    expect(identitySource).not.toContain("✦");
  });

  it("uses an icon-only immersive launch and an accessible collapsible edition rail", () => {
    const launchSource = appSource.slice(
      appSource.indexOf('className="atlas-immersion-launch"') - 120,
      appSource.indexOf('className="globe-copy"')
    );

    expect(launchSource).toContain("<IconButton");
    expect(launchSource).toContain("<BrandWidescreenIcon />");
    expect(launchSource).toContain('data-atlas-action="enter-immersive"');
    expect(launchSource).toContain(
      'aria-label={t("Погрузиться в Литературную планету")}'
    );
    expect(launchSource).not.toContain('t("Погрузиться")');

    expect(globeSource).toContain('data-globe-control="edition-rail-toggle"');
    expect(globeSource).toContain('aria-controls="globe-edition-rail"');
    expect(globeSource).toContain("aria-expanded={editionRailVisible}");
    expect(globeSource).toContain("aria-hidden={!editionRailVisible}");
    expect(globeSource).toContain(
      'toggleAttribute("inert", !editionRailVisible)'
    );
  });

  it("uses the shared click-versus-drag gesture for surfaces and markers", () => {
    const interactionSources = `${globeSource}\n${nobelLayerSource}`;
    expect(interactionSources).toContain("beginGlobePointerGesture");
    expect(interactionSources).toContain("updateGlobePointerGesture");
    expect(interactionSources).toContain("isGlobePointerTap");
    expect(
      interactionSources.match(/finishPointerGesture\(/gu)?.length
    ).toBeGreaterThanOrEqual(4);
  });

  it("reports why automatic rotation is paused", () => {
    expect(globeSource).toContain("resolveGlobeAutoRotationPolicy");
    expect(globeSource).toContain("resolveGlobeFrameMode");
    expect(globeSource).toContain("data-globe-auto-rotate={autoRotateStatus}");
    expect(performanceSource).toMatch(/input\.reducedMotion\s*\?\s*"reduced-motion"/u);
    expect(performanceSource).toMatch(/input\.hasSelection\s*\?\s*"selection"/u);
    expect(globeSource).toContain("disabled={reducedMotion}");
    expect(globeSource).toContain("autoRotateControlLabel");
  });

  it("offers recovery and avoids a continuous frame loop for static scenes", () => {
    expect(globeSource).toContain("Повторить загрузку глобуса");
    expect(globeSource).toContain("data-globe-load-state");
    expect(globeSource).toContain("data-globe-frame-mode={frameMode}");
    expect(performanceSource).toContain('? "always"');
    expect(performanceSource).toContain(': "demand"');
    expect(performanceSource).toContain('return "never"');
  });

  it("lets the single R3F canvas own renderer sizing", () => {
    expect(globeSource).not.toContain("function RendererResizeSync");
    expect(globeSource).not.toContain("gl.setSize(");
    expect(globeSource).toContain("camera={GLOBE_CAMERA_CONFIG}");
  });

  it("tags a stable embedded or immersive root without replacing the canvas", () => {
    expect(globeSource.match(/<Canvas/gu)).toHaveLength(1);
    expect(globeSource).toContain('mode = "embedded"');
    expect(globeSource).toContain("data-globe-mode={mode}");
    expect(worldMapSource).toContain("rootRef?: Ref<HTMLElement>");
    expect(worldMapSource).toContain("ref={setRootNode}");
    expect(worldMapSource).toContain("setActivationNode(node)");
    expect(worldMapSource).toContain(
      'if (typeof rootRef === "function") rootRef(node)'
    );
    expect(worldMapSource).toContain("data-globe-mode={mode}");
    expect(worldMapSource).toContain("mode={mode}");
  });

  it("forwards writer selection as one country-writer event", () => {
    expect(worldMapSource).toContain(
      "onWriterSelect?: (country: Country, writer: WriterProfile) => void"
    );
    expect(worldMapSource).toContain("onWriterSelect={onWriterSelect}");
    expect(worldMapSource).not.toContain("onWriterSelect={(country, writer) =>");
  });

  it("keeps Nobel selection separate from the explicit article action", () => {
    const selectGlobeWriterSource = appSource.slice(
      appSource.indexOf("const selectGlobeWriter"),
      appSource.indexOf("const selectPanelWriter")
    );

    expect(nobelLayerSource).toContain("context.fillText(String(count)");
    expect(nobelLayerSource).toContain('kind: "cluster"');
    expect(globeSource).toContain('className="globe-nobel-article-action"');
    expect(globeSource).toContain('t("Статья о лауреате")');
    expect(selectGlobeWriterSource).not.toContain("navigateToArticle");
    expect(selectGlobeWriterSource).not.toContain("findNobelArticle");
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
    expect(sceneSource).toContain("<MuseumSkyDome");
    expect(sceneSource).toContain("<MuseumStarfield");
    expect(sceneSource.match(/animate=\{autoRotate\}/gu)).toHaveLength(2);
    expect(globeSource).toContain(
      '<cylinderGeometry args={[0.31, 0.42, 0.08, 48]} />'
    );
  });
});
