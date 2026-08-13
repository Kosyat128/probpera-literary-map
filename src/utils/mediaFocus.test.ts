import { describe, expect, it } from "vitest";

import { mediaFocusPosition, normalizeMediaFocus } from "./mediaFocus";

describe("media focus", () => {
  it("keeps focal coordinates inside the image", () => {
    expect(normalizeMediaFocus(-2)).toBe(0);
    expect(normalizeMediaFocus(2)).toBe(1);
    expect(normalizeMediaFocus(undefined)).toBe(0.5);
    expect(normalizeMediaFocus(null)).toBe(0.5);
    expect(normalizeMediaFocus("")).toBe(0.5);
  });

  it("converts normalized coordinates into a CSS position", () => {
    expect(mediaFocusPosition(0.125, 0.875)).toBe("12.5% 87.5%");
  });
});
