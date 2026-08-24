import { describe, expect, it, vi } from "vitest";

import { createGlobeHighlightUpdater } from "./globeAtlas";

describe("globe highlight update gate", () => {
  it("does not redraw for passive view samples when the effective IDs stay empty", () => {
    const redraw = vi.fn();
    const upload = vi.fn();
    const updateHighlight = createGlobeHighlightUpdater(() => {
      redraw();
      upload();
    });

    for (let sample = 0; sample < 120; sample += 1) {
      expect(updateHighlight(undefined, undefined, undefined)).toBe(false);
    }

    expect(redraw).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });

  it("redraws exactly once for each changed effective ID triple", () => {
    const redraw = vi.fn();
    const updateHighlight = createGlobeHighlightUpdater(redraw);

    expect(updateHighlight("colombia", null, undefined)).toBe(true);
    expect(updateHighlight("colombia", undefined, null)).toBe(false);
    expect(updateHighlight("colombia", "ecuador", null)).toBe(true);
    expect(updateHighlight("colombia", "ecuador", undefined)).toBe(false);
    expect(updateHighlight(null, null, null)).toBe(true);
    expect(updateHighlight(undefined, undefined, undefined)).toBe(false);

    expect(redraw).toHaveBeenCalledTimes(3);
    expect(redraw).toHaveBeenNthCalledWith(1, {
      selectedCountryId: "colombia",
      hoveredCountryId: null,
      candidateCountryId: null,
    });
    expect(redraw).toHaveBeenNthCalledWith(2, {
      selectedCountryId: "colombia",
      hoveredCountryId: "ecuador",
      candidateCountryId: null,
    });
    expect(redraw).toHaveBeenNthCalledWith(3, {
      selectedCountryId: null,
      hoveredCountryId: null,
      candidateCountryId: null,
    });
  });
});
