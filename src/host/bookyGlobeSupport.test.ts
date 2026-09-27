import { describe, expect, it } from "vitest";
import { getBookySupport, type BookySupportInput } from "./bookySupport";
import { BOOKY_GLOBE_SUPPORT_COPY_METADATA, getBookyGlobeSupport } from "./bookyGlobeSupport";

const ready: BookySupportInput = Object.freeze({ connectivity: "online", screen: "globe", countryStatus: "ready", booksStatus: "ready" });

describe("adult known globe display loss guidance", () => {
  it("explains known display loss without inventing a retry or promising online materials", () => {
    const result = getBookyGlobeSupport({ ...ready, globeDisplayUnavailable: true })!;
    expect(result.id).toBe("globe-unavailable");
    expect(result.kind).toBe("error");
    expect(result.retry).toBeNull();
    for (const connectivity of ["online", "offline", "unknown"] as const) {
      const input = Object.freeze({ ...ready, connectivity, globeDisplayUnavailable: true });
      expect(getBookyGlobeSupport(input)).toBe(result);
      expect(input.globeDisplayUnavailable).toBe(true);
    }
    expect(result.body.ru).toContain("только материалы, уже доступные на устройстве");
    expect(result.body.en).toContain("only materials already available on this device");
    for (const value of [result, result.title, result.body, BOOKY_GLOBE_SUPPORT_COPY_METADATA]) expect(Object.isFrozen(value)).toBe(true);
    expect(BOOKY_GLOBE_SUPPORT_COPY_METADATA).toEqual({ status: "draft", humanReviewed: false,
      childApproved: false, narrationApproved: false, releaseReady: false });
  });

  it("retains actionable country errors and loading ahead of a simultaneous display loss", () => {
    for (const countryStatus of ["error", "loading"] as const) {
      const input = { ...ready, connectivity: "offline" as const, countryStatus };
      const expected = getBookySupport(input)!;
      expect(getBookyGlobeSupport({ ...input, globeDisplayUnavailable: true })).toBe(expected);
      expect(expected.id).toBe(countryStatus === "error" ? "countries-error" : "countries-loading");
      expect(expected.retry).toBe(countryStatus === "error" ? "countries" : null);
    }
  });

  it("leaves every existing collection recovery and connectivity state unchanged", () => {
    for (const changes of [
      {}, { booksStatus: "error" }, { booksStatus: "loading" }, { countryStatus: "error" },
      { countryStatus: "loading" }, { connectivity: "offline" }, { connectivity: "unknown" },
    ] satisfies Partial<BookySupportInput>[]) {
      const input = { ...ready, ...changes, screen: "collection" as const };
      expect(getBookyGlobeSupport({ ...input, globeDisplayUnavailable: true })).toBe(getBookySupport(input));
    }
  });

  it("restores ordinary help after known recovery and never infers display loss from an absent signal", () => {
    expect(getBookyGlobeSupport({ ...ready, globeDisplayUnavailable: true })?.id).toBe("globe-unavailable");
    for (const changes of [{}, { connectivity: "offline" }, { connectivity: "unknown" },
      { countryStatus: "idle", booksStatus: "idle" }] satisfies Partial<BookySupportInput>[]) {
      const input = { ...ready, ...changes };
      expect(getBookyGlobeSupport(input)).toBe(getBookySupport(input));
      expect(getBookyGlobeSupport({ ...input, globeDisplayUnavailable: false })).toBe(getBookySupport(input));
    }
  });
});
