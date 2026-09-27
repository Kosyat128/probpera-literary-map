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


describe("observed globe loading guidance", () => {
  it("reports known loading as loading with immutable copy and no second retry owner", () => {
    const result = getBookyGlobeSupport({ ...ready, globeLoadStatus: "loading" })!;
    expect(result.id).toBe("globe-unavailable");
    expect(result.kind).toBe("loading");
    expect(result.retry).toBeNull();
    expect(result.title.ru).toBe("Глобус ещё загружается");
    expect(result.title.en).toBe("The globe is still loading");
    for (const connectivity of ["online", "offline", "unknown"] as const) {
      expect(getBookyGlobeSupport({ ...ready, connectivity, globeLoadStatus: "loading" })).toBe(result);
    }
    for (const value of [result, result.title, result.body]) expect(Object.isFrozen(value)).toBe(true);
  });

  it("explains an observed initial failure and points to the globe's existing retry", () => {
    const result = getBookyGlobeSupport({ ...ready, globeLoadStatus: "error" })!;
    expect(result.id).toBe("globe-unavailable");
    expect(result.kind).toBe("error");
    expect(result.retry).toBeNull();
    expect(result.title.ru).toBe("Глобус не удалось загрузить");
    expect(result.title.en).toBe("The globe could not be loaded");
    expect(result.body.ru).toContain("кнопкой в области глобуса");
    expect(result.body.en).toContain("button in the globe area");
    for (const value of [result, result.title, result.body]) expect(Object.isFrozen(value)).toBe(true);
  });

  it("follows loading, failure, retry loading and readiness without conflating display loss", () => {
    const loading = getBookyGlobeSupport({ ...ready, globeLoadStatus: "loading" });
    const failed = getBookyGlobeSupport({ ...ready, globeLoadStatus: "error" });
    expect(failed).not.toBe(loading);
    expect(getBookyGlobeSupport({ ...ready, globeLoadStatus: "loading" })).toBe(loading);
    expect(getBookyGlobeSupport({ ...ready, globeLoadStatus: "ready" })).toBeNull();
    const lost = getBookyGlobeSupport({ ...ready, globeDisplayUnavailable: true });
    expect(lost).not.toBe(failed);
    for (const globeLoadStatus of ["loading", "error", "ready"] as const) {
      expect(getBookyGlobeSupport({ ...ready, globeLoadStatus, globeDisplayUnavailable: true })).toBe(lost);
    }
  });

  it("retains catalog priority and all collection support while globe status changes", () => {
    for (const globeLoadStatus of ["loading", "error", "ready"] as const) {
      for (const countryStatus of ["loading", "error"] as const) {
        const input = { ...ready, countryStatus };
        expect(getBookyGlobeSupport({ ...input, globeLoadStatus })).toBe(getBookySupport(input));
      }
      for (const changes of [{}, { booksStatus: "error" }, { booksStatus: "loading" },
        { connectivity: "offline" }, { connectivity: "unknown" }] satisfies Partial<BookySupportInput>[]) {
        const input = { ...ready, ...changes, screen: "collection" as const };
        expect(getBookyGlobeSupport({ ...input, globeLoadStatus })).toBe(getBookySupport(input));
      }
    }
  });

  it("does not infer a load failure from null, omitted or idle observations", () => {
    for (const globeLoadStatus of [undefined, null, "idle", "ready"] as const) {
      for (const connectivity of ["online", "offline", "unknown"] as const) {
        const input = { ...ready, connectivity };
        expect(getBookyGlobeSupport({ ...input, globeLoadStatus })).toBe(getBookySupport(input));
      }
    }
  });
});
