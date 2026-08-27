import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  BOOK_SHELF_ENVIRONMENT_MAX_BOOK_INSTANCES,
  createBookShelfEnvironmentLayout,
  resolveBookShelfEnvironmentProfile,
} from "./BookShelfSpatialEnvironment";

const environmentSource = readFileSync(
  new URL("./BookShelfSpatialEnvironment.tsx", import.meta.url),
  "utf8"
);
const canvasSource = readFileSync(
  new URL("./BookShelfSceneCanvas.tsx", import.meta.url),
  "utf8"
);

describe("Stage 5D-3 spatial bookshelf environment", () => {
  it("selects a bounded quality profile from width and economy mode", () => {
    expect(resolveBookShelfEnvironmentProfile(1800, false)).toBe("HIGH");
    expect(resolveBookShelfEnvironmentProfile(1024, false)).toBe("BALANCED");
    expect(resolveBookShelfEnvironmentProfile(640, false)).toBe("ECONOMY");
    expect(resolveBookShelfEnvironmentProfile(1800, true)).toBe("ECONOMY");
    expect(resolveBookShelfEnvironmentProfile(640, false, "HIGH")).toBe(
      "HIGH"
    );
  });

  it("builds deterministic bounded instanced midground shelves and books", () => {
    const first = createBookShelfEnvironmentLayout("HIGH");
    const second = createBookShelfEnvironmentLayout("HIGH");
    const balanced = createBookShelfEnvironmentLayout("BALANCED");
    const economy = createBookShelfEnvironmentLayout("ECONOMY");

    expect(first).toEqual(second);
    expect(first.books).toHaveLength(BOOK_SHELF_ENVIRONMENT_MAX_BOOK_INSTANCES);
    expect(first.books.length).toBeLessThanOrEqual(104);
    expect(balanced.books.length).toBeLessThan(first.books.length);
    expect(economy.books.length).toBeLessThan(balanced.books.length);
    expect(first.shelves).toHaveLength(8);
    expect(first.architecture.length).toBeLessThanOrEqual(16);
    expect(first.books.every((book) => book.position[2] < -3.4)).toBe(true);
  });

  it("uses instancing, cheap material reflection, and no continuous effects", () => {
    expect(environmentSource.match(/<instancedMesh\b/gu)).toHaveLength(3);
    expect(environmentSource).toContain("book-shelf-layer-b-midground");
    expect(environmentSource).toContain("book-shelf-layer-c-architecture");
    expect(environmentSource).toContain("book-shelf-cheap-floor-reflection");
    expect(environmentSource).toContain("inspectionActive");
    expect(environmentSource).toContain("appearance.shelfColor");
    expect(environmentSource).toContain("appearance.lightColor");
    expect(environmentSource).not.toMatch(
      /useFrame|EffectComposer|postprocessing|TextureLoader|useLoader/gu
    );
  });

  it("keeps one demand Canvas and suspends frames while the page is hidden", () => {
    expect(canvasSource.match(/<Canvas\b/gu)).toHaveLength(1);
    expect(canvasSource).toContain('frameloop="demand"');
    expect(canvasSource).toContain("preserveDrawingBuffer: false");
    expect(canvasSource).toContain(
      'document.addEventListener("visibilitychange", handleVisibilityChange)'
    );
    const hiddenBranch = canvasSource.slice(
      canvasSource.indexOf('document.visibilityState === "hidden"'),
      canvasSource.indexOf('setFrameloop("demand")')
    );
    expect(hiddenBranch).toContain('setFrameloop("never")');
    expect(hiddenBranch).not.toContain("invalidate()");
  });
});
