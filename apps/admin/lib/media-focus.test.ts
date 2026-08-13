import { describe, expect, it } from "vitest";

import { mediaFocusFromPoint } from "./media-focus";

describe("media focal-point geometry", () => {
  const portraitPlane = { left: 280, top: 100, width: 240, height: 360 };

  it("uses the rendered image plane rather than its wider stage", () => {
    expect(mediaFocusFromPoint(400, 280, portraitPlane)).toEqual({ x: 0.5, y: 0.5 });
  });

  it("clamps clicks from the letterbox area to the nearest image edge", () => {
    expect(mediaFocusFromPoint(120, 500, portraitPlane)).toEqual({ x: 0, y: 1 });
  });
});
