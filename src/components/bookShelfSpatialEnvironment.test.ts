import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const canvasSource = readFileSync(
  new URL("./BookShelfSceneCanvas.tsx", import.meta.url),
  "utf8"
);

describe("Stage 5D-3 library backdrop composition", () => {
  it("does not mount synthetic background books, shelves, windows, or wall panels", () => {
    expect(canvasSource).not.toContain("BookShelfSpatialEnvironment");
    expect(canvasSource).not.toContain("book-shelf-layer-b-midground");
    expect(canvasSource).not.toContain("book-shelf-layer-c-architecture");
    expect(canvasSource).not.toContain("book-shelf-cheap-floor-reflection");
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
