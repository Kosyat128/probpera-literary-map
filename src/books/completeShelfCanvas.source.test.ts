import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const canvasSource = readFileSync(
  new URL("../components/BookShelfSceneCanvas.tsx", import.meta.url),
  "utf8"
);
const sceneSource = readFileSync(
  new URL("../components/BookShelfScene.tsx", import.meta.url),
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
const combinedSource =
  sceneSource + canvasSource + rendererSource + textureSource;

describe("Complete Shelf Canvas source contract", () => {
  it("keeps one demand-driven Canvas and no audio or remote asset loader", () => {
    expect(canvasSource.match(/<Canvas\b/gu)).toHaveLength(1);
    expect(canvasSource).toContain('frameloop="demand"');
    expect(canvasSource).toContain("preserveDrawingBuffer: false");
    expect(canvasSource).toContain('touchAction: "pan-y"');
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
    expect(rendererSource).toContain('canvas.addEventListener("pointercancel", cancelCapturedPage)');
    expect(rendererSource).toContain('canvas.removeEventListener("pointercancel", cancelCapturedPage)');
    expect(rendererSource).toContain('phase === "INSPECTION_CLOSED"');
    expect(rendererSource).toContain('phase !== "BOOK_OPEN"');
    expect(rendererSource).toContain("pageGestureStartedRef");
    expect(rendererSource).toContain("lastVelocity: number");
    expect(rendererSource).toContain("elapsed <= 80");
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
    expect(rendererSource).toContain("completeShelfRowWidth(layout.length)");
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
      "metalness={precolored ? 0.16 : 0.7}"
    );
    expect(rendererSource).toContain(
      "roughness={precolored ? 0.62 : 0.4}"
    );
    expect(rendererSource).toContain("transparent");
    expect(rendererSource).toContain("alphaTest={0.015}");
    const coloredFoilRelief = rendererSource.match(/bumpScale=\{precolored \? ([\d.]+)/u);
    expect(coloredFoilRelief).not.toBeNull();
    expect(Number(coloredFoilRelief?.[1])).toBeGreaterThan(0);
    expect(Number(coloredFoilRelief?.[1])).toBeLessThanOrEqual(0.0003);
    expect(rendererSource).toContain("new RoundedBoxGeometry");
    expect(rendererSource).toContain("createCompleteShelfPageBlockGeometry");
    expect(rendererSource).toContain("<meshPhysicalMaterial");
    expect(rendererSource).not.toMatch(/\bemissive(?:Map|Intensity)?=/u);
    expect(textureSource).toContain("context.clearRect(0, 0, width, height)");
    expect(textureSource).toContain("const frontHeight = quality");
    expect(textureSource).toContain("Math.trunc(quality.height)");
    expect(textureSource).toContain("const physicalWidth = spec.dimensions.pageDepth");
    expect(textureSource).toContain(
      "spec.dimensions.coverWidth / spec.dimensions.height"
    );
    expect(textureSource).toContain("const widthCap = safeMaximumHeight");
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
    expect(rendererSource).not.toContain("coverUrl: presentation.coverUrl");
    expect(rendererSource).not.toContain("loadCompleteShelfCoverTexture");
    expect(rendererSource).not.toContain("coverArtworkTexture");
    expect(rendererSource).toContain(
      "visible={Boolean(artwork.frontFoil)}"
    );
    expect(rendererSource).toContain(
      "const renderFullRig = selected && (completeShelfPhaseHasInspection(phase) || phase === \"SHELF_RESTORING\")"
    );
    expect(rendererSource).toContain(
      "renderFullRig ? coverWidth * 1.22 : 0.12"
    );
    expect(textureSource).toContain("includeFrontFoil = true");
    expect(rendererSource).toContain(
      "createCompleteShelfArtworkTextures(spec, economical, renderFullRig, {"
    );
    expect(rendererSource).toContain("height: artworkTextureHeight");
    expect(rendererSource).toContain("anisotropy: artworkTextureAnisotropy");
    expect(rendererSource).not.toContain("createCompleteShelfLeatherMap");
    expect(rendererSource).not.toContain("createCompleteShelfLeatherSurfaceMaps");
    expect(rendererSource).toContain("const needsFullRigMaps = Boolean");
    expect(rendererSource).toContain("? createCompleteShelfPageEdgeTextures");
    expect(textureSource).toContain("frontFoil");
    expect(textureSource).toContain("spineFoil");
    expect(textureSource).not.toContain("paintLiteraryMedallion");
    expect(textureSource).toContain("paintPublisherMark");
    expect(textureSource).toContain("if (!bookTypographyIsReady()) return unavailable");
    expect(textureSource).toContain("frontWriterLines");
    expect(textureSource).toContain("context.strokeStyle = OwnerBookTypographyTokens.sepia");
    expect(textureSource).toContain("context.fillStyle = OwnerBookTypographyTokens.ivory");
    expect(textureSource).toContain("paintSpineBinderOrnament");
    expect(textureSource).not.toContain("paintSpineSeparatorRule");
    expect(textureSource).toContain("context.lineCap = \"butt\"");
    expect(textureSource).toContain("layout.dotRadius");
    expect(textureSource).not.toContain("diamondHalfWidth");
    expect(textureSource).not.toContain("upperY:");
    expect(textureSource).not.toContain("paintMotif(");
    expect(textureSource).not.toContain("for (const bandY of [0.115, 0.885])");
    expect(textureSource).not.toContain(
      "context.fillText(plan.yearLabel, spineWidth"
    );
    expect(textureSource).not.toContain("tailShade");
    expect(textureSource).not.toContain('spec.binding === "leather"');
    expect(rendererSource).not.toContain("spineBandGeometry");
    expect(textureSource).toContain("resolveCompleteShelfSpineTextColor");
    expect(rendererSource).toContain(
      "alphaMap={precolored ? undefined : map || undefined}"
    );
    expect(canvasSource).toContain("resolveBookInspectionCameraFraming");
    expect(canvasSource).toContain("viewportInsets={viewportInsets}");
    expect(rendererSource).toContain("scale={sceneFraming.scale}");
    expect(rendererSource).toContain(
      'const renderingEconomical = props.qualitySettings.profile === "ECONOMY"'
    );
    expect(rendererSource).toContain(
      "props.qualitySettings.liveBookLimit"
    );
    expect(rendererSource).toContain("qualitySettings.pageSegments.width");
    expect(rendererSource).toContain("qualitySettings.pageSegments.height");
    expect(rendererSource).toContain("key={entry.item.key}");
    expect(rendererSource).not.toContain("coverAssignmentGenerationRef");
    expect(rendererSource).not.toMatch(/window\.addEventListener\("scroll"/u);
    expect(rendererSource).toContain("bookShelfPointerIsClick");
    expect(rendererSource).toContain("nearestBookShelfSpine");
    expect(rendererSource).toContain("useOwnedGeometry");
    expect(sceneSource).toContain("ensureBookTypographyReady()");
    expect(rendererSource).toContain(
      "completeShelfPhaseAllowsSelectionSwitch(phase)"
    );
    expect(rendererSource).toContain("onOpenBook(spec.key)");
    expect(rendererSource).toContain("artwork.frontFoil");
    expect(rendererSource).toContain("artwork.spineFoil");
  });

  it("uses neutral calibrated lights and the same owner exposure at every quality", () => {
    expect(canvasSource.match(/<directionalLight\b/gu)).toHaveLength(2);
    expect(canvasSource).toContain("gl.toneMappingExposure = exposure");
    expect(canvasSource).toContain('qualitySettings.profile === "HIGH"');
    expect(canvasSource).toContain("exposure={0.38}");
    expect(canvasSource).toContain('color="#ffffff"');
    expect(canvasSource).toContain("new RoomEnvironment()");
    expect(canvasSource).toContain("scene.environmentIntensity = 0.72;");
    expect(canvasSource).not.toContain("qualitySettings.ambientTintStrength");
    expect(canvasSource).toContain('"webglcontextrestored"');
    expect(canvasSource).toContain("onTextureFailure={reportTextureFailure}");
    expect(sceneSource).toContain("resolveBookShelfSceneQualitySettings");
    expect(sceneSource).toContain("qualitySettings={qualitySettings}");
    expect(sceneSource).toContain('props.onFailure("texture-error")');
    expect(sceneSource).toContain("props.onContextRestored?.()");
    expect(canvasSource).not.toContain('color="#fff8ed"');
    expect(rendererSource).toContain("roughness={0.98}");
    expect(rendererSource).toContain(
      "normalMap={bindingNormalMap || undefined}"
    );
    expect(rendererSource).not.toContain("const emissive = selected");
  });
});
