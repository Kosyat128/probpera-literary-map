import { describe, expect, it, vi } from "vitest";

import {
  decodeHashTarget,
  scrollToDeferredHashTarget,
} from "./deferredHashNavigation";

describe("deferred homepage hash navigation", () => {
  it("decodes safe homepage targets and rejects malformed hashes", () => {
    expect(decodeHashTarget("#calendar")).toBe("calendar");
    expect(decodeHashTarget("#editorial-policy?source=menu")).toBe(
      "editorial-policy"
    );
    expect(decodeHashTarget("#%E0%A4%A")).toBe("");
  });

  it("scrolls only when an allowlisted deferred target exists", () => {
    const scrollIntoView = vi.fn();
    const target = { scrollIntoView } as unknown as HTMLElement;
    expect(scrollToDeferredHashTarget("#calendar", () => target)).toBe(true);
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "auto",
      block: "start",
    });
    expect(scrollToDeferredHashTarget("#unknown", () => target)).toBe(false);
    expect(scrollToDeferredHashTarget("#calendar", () => null)).toBe(false);
  });
});
