import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const canvasSource = readFileSync(
  new URL("../components/BookShelfSceneCanvas.tsx", import.meta.url),
  "utf8"
);
const rendererSource = readFileSync(
  new URL("./completeShelfRenderer.tsx", import.meta.url),
  "utf8"
);
const textureSource = readFileSync(
  new URL("./completeShelfTextures.ts", import.meta.url),
  "utf8"
);
const combinedSource = canvasSource + rendererSource + textureSource;

describe("Complete Shelf Canvas source contract", () => {
  it("keeps one demand-driven Canvas and no audio or remote asset loader", () => {
    expect(canvasSource.match(/<Canvas\b/gu)).toHaveLength(1);
    expect(canvasSource).toContain('frameloop="demand"');
    expect(canvasSource).toContain("preserveDrawingBuffer: false");
    expect(combinedSource).not.toMatch(
      /new\s+Audio\b|<audio\b|AudioContext|TextureLoader|useLoader/iu
    );
  });

  it("contains the procedural hardcover and open-book mechanics", () => {
    expect(rendererSource).toContain("artwork.spineFoil");
    expect(rendererSource).toContain("artwork.frontFoil");
    expect(rendererSource).toContain("boardThickness");
    expect(rendererSource).toContain("pageThickness");
    expect(rendererSource).toContain("<cylinderGeometry");
    expect(rendererSource).toContain("ref={coverRef}");
    expect(rendererSource).toContain("ref={firstLeafRef}");
    expect(rendererSource).toContain("ref={secondLeafRef}");
    expect(rendererSource).toContain("onStartPageDrag");
    expect(rendererSource).toContain("createCompleteShelfBowedSpineGeometry");
    expect(rendererSource).toContain(
      "createCompleteShelfBowedSpineFoilGeometry"
    );
    expect(rendererSource).not.toContain("spineBandGeometry");
    expect(rendererSource).not.toContain("onDoubleClick");
  });

  it("uses the controller phases and exact settlement callbacks", () => {
    for (const callback of [
      "onMotionReached",
      "onMotionSettled",
      "onInspectionEntered",
      "onCoverOpened",
      "onPageSettled",
      "onInspectionClosed",
      "onShelfRestored",
    ]) {
      expect(combinedSource).toContain(callback);
    }
    expect(rendererSource).toContain("onPointerCancel");
    expect(rendererSource).toContain('phase === "INSPECTION_CLOSED"');
    expect(rendererSource).toContain('phase !== "BOOK_OPEN"');
    expect(rendererSource).toContain("pageGestureStartedRef");
  });

  it("builds a low premium walnut shelf instead of a black podium", () => {
    expect(rendererSource).not.toContain(
      "scale={[width - 0.18, 2.22, 0.11]}"
    );
    expect(rendererSource).not.toContain(
      "scale={[width + 0.24, 0.13, 1.08]}"
    );
    expect(rendererSource).not.toContain('color="#c18a45"');
    expect(rendererSource).toContain("const topGeometry = useMemo");
    expect(rendererSource).not.toContain("const lipGeometry = useMemo");
    expect(rendererSource).toContain("const backRailGeometry = useMemo");
    expect(rendererSource).not.toContain("undersideGeometry");
    expect(rendererSource).toContain("const shelfWidth = Math.max(");
    expect(rendererSource).toContain("    6.5,");
    expect(rendererSource).toContain('color="#fff3e5"');
    expect(rendererSource).toContain("clearcoat={0.08}");
    expect(rendererSource).toContain(
      "roughnessMap={woodDetailMap || undefined}"
    );
    expect(rendererSource).toContain("alphaMap={contactShadowMap || undefined}");
    expect(textureSource).toContain("const width = economical ? 384 : 1024");
    expect(textureSource).toContain("texture.repeat.set(2.65, 1)");
  });

  it("separates non-metallic cloth from transparent metallic foil", () => {
    expect(rendererSource).toContain("metalness={0}");
    expect(rendererSource).toContain(
      "metalness={precolored ? 0.64 : front ? 0.94 : 0.92}"
    );
    expect(rendererSource).toContain(
      "roughness={precolored ? 0.27 : front ? 0.18 : 0.16}"
    );
    expect(rendererSource).toContain("transparent");
    expect(rendererSource).toContain("alphaTest={0.015}");
    expect(rendererSource).toContain("bumpScale={front ? 0.016 : 0.017}");
    expect(rendererSource).toContain("new RoundedBoxGeometry");
    expect(rendererSource).toContain("createCompleteShelfPageBlockGeometry");
    expect(rendererSource).toContain("<meshPhysicalMaterial");
    expect(rendererSource).not.toMatch(/\bemissive(?:Map|Intensity)?=/u);
    expect(textureSource).toContain("context.clearRect(0, 0, width, height)");
    expect(textureSource).toContain(
      "const frontHeight = economical ? 512 : 1536"
    );
    expect(textureSource).toContain("const spinePhysicalWidth");
    expect(textureSource).toContain(
      "spec.dimensions.coverWidth / spec.dimensions.height"
    );
    expect(textureSource).toContain("const widthCap = economical ? 320 : 1024");
    expect(textureSource).toContain("resolveCompleteShelfCoverTextureSize");
    expect(textureSource).toContain("texture.anisotropy = anisotropy");
    expect(textureSource).toContain("economical ? 4 : 16");
    expect(textureSource).toContain("const size = economical ? 96 : 256");
    expect(textureSource).toContain("const frontFoil = !includeFrontFoil");
    expect(textureSource).not.toContain(
      "!includeFrontFoil || plan.hasCoverArtwork"
    );
    expect(textureSource).toContain("loadCompleteShelfCoverTexture");
    expect(textureSource).toContain("image.src = normalizedUrl");
    expect(textureSource).toContain(
      "isCompleteShelfCoverTextureUrlAllowed(normalizedUrl)"
    );
    expect(textureSource).toContain("resolveCompleteShelfCoverContainRect");
    expect(rendererSource).toContain("coverUrl: presentation.coverUrl");
    expect(rendererSource).toContain("loadCompleteShelfCoverTexture");
    expect(rendererSource).toContain("coverArtworkTexture");
    expect(rendererSource).toContain(
      "map={coverArtworkTexture || undefined}"
    );
    expect(rendererSource).toContain('color="#ffffff"');
    expect(rendererSource).toContain(
      "visible={!coverArtworkTexture && Boolean(artwork.frontFoil)}"
    );
    expect(rendererSource).toContain(
      "const renderFullRig = selected && completeShelfPhaseHasInspection(phase)"
    );
    expect(rendererSource).toContain(
      "renderFullRig ? coverWidth * 1.22 : 0.12"
    );
    expect(textureSource).toContain("includeFrontFoil = true");
    expect(rendererSource).toContain(
      "createCompleteShelfArtworkTextures(spec, economical, renderFullRig)"
    );
    expect(rendererSource).toContain("createCompleteShelfLeatherMap");
    expect(rendererSource).toContain("createCompleteShelfLeatherSurfaceMaps");
    expect(rendererSource).toContain("const needsFullRigMaps = Boolean");
    expect(rendererSource).toContain("? createCompleteShelfPageEdgeTextures");
    expect(textureSource).toContain("frontFoil");
    expect(textureSource).toContain("spineFoil");
    expect(textureSource).toContain("paintLiteraryMedallion");
    expect(textureSource).toContain("frontWriterLines");
    expect(textureSource).toContain("context.shadowColor = \"transparent\"");
    expect(textureSource).toContain("paintSpineBinderOrnament");
    expect(textureSource).not.toContain("paintSpineSeparatorRule");
    expect(textureSource).toContain("context.lineCap = \"butt\"");
    expect(textureSource).toContain("layout.dotRadius");
    expect(textureSource).not.toContain("diamondHalfWidth");
    expect(textureSource).not.toContain("upperY:");
    expect(textureSource.match(/paintMotif\(/gu)).toHaveLength(2);
    expect(textureSource).not.toContain("for (const bandY of [0.115, 0.885])");
    expect(textureSource).not.toContain(
      "context.fillText(plan.yearLabel, spineWidth"
    );
    expect(textureSource).toContain('tailShade.addColorStop(1, "rgba(7,5,9,.62)")');
    expect(rendererSource).not.toContain("spineBandGeometry");
    expect(textureSource).toContain("resolveCompleteShelfSpineTextColor");
    expect(rendererSource).toContain(
      "alphaMap={precolored ? undefined : map || undefined}"
    );
    expect(rendererSource).toContain("resolveCompleteShelfViewportFraming");
    expect(rendererSource).toContain("scale={sceneFraming.scale}");
    expect(rendererSource).toContain(
      "const renderingEconomical = props.economical || size.width <= 640"
    );
    expect(rendererSource).toContain(
      "completeShelfWorkingSetLimit(size.width, props.economical)"
    );
    expect(rendererSource).toContain("key={entry.slotIndex}");
    expect(rendererSource).toContain("coverAssignmentGenerationRef");
    expect(rendererSource).toContain(
      "assignmentGeneration !== coverAssignmentGenerationRef.current"
    );
    expect(rendererSource).toContain("cancelTextureLoad()");
    expect(rendererSource).toContain("const scheduleStableFrame = () =>");
    expect(rendererSource).toContain(
      'window.addEventListener("scroll", scheduleStableFrame, true)'
    );
    expect(rendererSource).toContain("secondFrame = window.requestAnimationFrame");
    expect(rendererSource).toContain("window.cancelAnimationFrame(firstFrame)");
    expect(rendererSource).toContain(
      "completeShelfPhaseAllowsSelectionSwitch(phase)"
    );
    expect(rendererSource).toContain("onOpenBook(spec.key)");
    expect(rendererSource).toContain("artwork.frontFoil");
    expect(rendererSource).toContain("artwork.spineFoil");
  });

  it("uses a balanced two-sided key setup and bounded tone exposure", () => {
    expect(canvasSource.match(/<directionalLight\b/gu)).toHaveLength(2);
    expect(canvasSource).toContain("gl.toneMappingExposure = exposure");
    expect(canvasSource).toContain("exposure={economical ? 0.96 : 0.9}");
    expect(canvasSource).toContain("new RoomEnvironment()");
    expect(canvasSource).toContain("scene.environmentIntensity = economical ? 0.48 : 0.72");
    expect(canvasSource).toContain('color="#fff8ed"');
    expect(rendererSource).toContain("roughness={0.98}");
    expect(rendererSource).toContain(
      "normalMap={bindingNormalMap || undefined}"
    );
    expect(rendererSource).not.toContain("const emissive = selected");
  });
});
