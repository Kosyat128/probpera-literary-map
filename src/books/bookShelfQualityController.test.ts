import { describe, expect, it } from "vitest";

import {
  BOOK_SHELF_QUALITY_RECOVERY_SAMPLES,
  bookShelfQualityControllerSettings,
  createBookShelfQualityController,
  createBookShelfTextureLru,
  reconcileBookShelfTextureLru,
  reduceBookShelfQualityController,
  resolveBookShelfQualitySettings,
  touchBookShelfTextureLru,
} from "./bookShelfQualityController";

const capableDesktop = {
  viewportWidth: 1920,
  viewportHeight: 1080,
  devicePixelRatio: 2.5,
  deviceMemoryGb: 16,
  hardwareConcurrency: 12,
};

describe("Book Shelf quality profile", () => {
  it("selects HIGH, BALANCED and ECONOMY from bounded device signals", () => {
    expect(resolveBookShelfQualitySettings(capableDesktop)).toMatchObject({
      profile: "HIGH",
      mobile: false,
      liveBookLimit: 21,
      textureBudgets: { shelf: 32, selectedHighResolution: 1 },
      textureResolution: { inspection: 2048 },
      dpr: [1, 2],
    });
    expect(
      resolveBookShelfQualitySettings({
        viewportWidth: 1024,
        deviceMemoryGb: 4,
        hardwareConcurrency: 6,
      })
    ).toMatchObject({
      profile: "BALANCED",
      liveBookLimit: 13,
      textureBudgets: { shelf: 32, selectedHighResolution: 1 },
    });
    expect(
      resolveBookShelfQualitySettings({
        ...capableDesktop,
        viewportWidth: 390,
      })
    ).toMatchObject({
      profile: "ECONOMY",
      mobile: true,
      liveBookLimit: 7,
      textureBudgets: { shelf: 16, selectedHighResolution: 1 },
      textureResolution: { neighbour: 256, inspection: 1024 },
    });
  });

  it("honors Save-Data and low capability without reducing settled quality for reduced motion", () => {
    expect(
      resolveBookShelfQualitySettings({ ...capableDesktop, saveData: true })
        .profile
    ).toBe("ECONOMY");
    expect(
      resolveBookShelfQualitySettings({
        ...capableDesktop,
        deviceMemoryGb: 2,
      }).profile
    ).toBe("ECONOMY");

    const reduced = resolveBookShelfQualitySettings({
      ...capableDesktop,
      reducedMotion: true,
    });
    expect(reduced.profile).toBe("HIGH");
    expect(reduced.textureResolution.inspection).toBe(2048);
    expect(reduced.motion).toEqual({
      reduced: true,
      inertia: false,
      transitionScale: 0,
    });
  });
});

describe("Book Shelf deterministic degradation and recovery", () => {
  it("degrades immediately and recovers one tier only after stable samples", () => {
    let state = createBookShelfQualityController(capableDesktop);
    state = reduceBookShelfQualityController(state, { type: "degrade" });
    expect(state.profile).toBe("BALANCED");
    state = reduceBookShelfQualityController(state, { type: "degrade" });
    expect(state.profile).toBe("ECONOMY");

    for (let index = 1; index < BOOK_SHELF_QUALITY_RECOVERY_SAMPLES; index += 1) {
      state = reduceBookShelfQualityController(state, { type: "recover" });
      expect(state.profile).toBe("ECONOMY");
    }
    state = reduceBookShelfQualityController(state, { type: "recover" });
    expect(state.profile).toBe("BALANCED");

    for (let index = 0; index < BOOK_SHELF_QUALITY_RECOVERY_SAMPLES; index += 1) {
      state = reduceBookShelfQualityController(state, { type: "recover" });
    }
    expect(state.profile).toBe("HIGH");
    expect(bookShelfQualityControllerSettings(state).profile).toBe("HIGH");
  });

  it("drops to a changed ceiling and never recovers past it", () => {
    let state = createBookShelfQualityController(capableDesktop);
    state = reduceBookShelfQualityController(state, {
      type: "signals",
      signals: { ...capableDesktop, saveData: true },
    });
    expect(state).toMatchObject({ profile: "ECONOMY", ceiling: "ECONOMY" });
    const economy = state;
    for (let index = 0; index < 10; index += 1) {
      state = reduceBookShelfQualityController(state, { type: "recover" });
    }
    expect(state).toBe(economy);

    state = reduceBookShelfQualityController(state, {
      type: "signals",
      signals: capableDesktop,
    });
    expect(state).toMatchObject({ profile: "ECONOMY", ceiling: "HIGH" });
  });
});

describe("Book Shelf bounded texture LRU", () => {
  it("keeps at most 32 desktop shelf textures in deterministic LRU order", () => {
    const settings = resolveBookShelfQualitySettings(capableDesktop);
    let cache = createBookShelfTextureLru(settings);
    let evicted: readonly { key: string }[] = [];
    for (let index = 0; index < 33; index += 1) {
      const result = touchBookShelfTextureLru(cache, {
        key: `shelf:${index}`,
        kind: "shelf",
      });
      cache = result.cache;
      evicted = result.evicted;
    }
    expect(cache.entries).toHaveLength(32);
    expect(evicted).toEqual([
      { key: "shelf:0", kind: "shelf" },
    ]);

    cache = touchBookShelfTextureLru(cache, {
      key: "shelf:1",
      kind: "shelf",
    }).cache;
    const result = touchBookShelfTextureLru(cache, {
      key: "shelf:33",
      kind: "shelf",
    });
    expect(result.evicted).toEqual([
      { key: "shelf:2", kind: "shelf" },
    ]);
    expect(result.cache.entries[result.cache.entries.length - 1]?.key).toBe(
      "shelf:33"
    );
  });

  it("owns one selected high-resolution texture and trims to 16 on mobile", () => {
    const desktop = resolveBookShelfQualitySettings(capableDesktop);
    let cache = createBookShelfTextureLru(desktop);
    for (let index = 0; index < 20; index += 1) {
      cache = touchBookShelfTextureLru(cache, {
        key: `shelf:${index}`,
        kind: "shelf",
      }).cache;
    }
    cache = touchBookShelfTextureLru(cache, {
      key: "selected:first",
      kind: "selected-high-resolution",
    }).cache;
    const selected = touchBookShelfTextureLru(cache, {
      key: "selected:latest",
      kind: "selected-high-resolution",
    });
    expect(selected.evicted).toEqual([
      { key: "selected:first", kind: "selected-high-resolution" },
    ]);
    expect(
      selected.cache.entries.filter(
        (entry) => entry.kind === "selected-high-resolution"
      )
    ).toHaveLength(1);

    const mobile = resolveBookShelfQualitySettings({ viewportWidth: 390 });
    const trimmed = reconcileBookShelfTextureLru(selected.cache, mobile);
    expect(
      trimmed.cache.entries.filter((entry) => entry.kind === "shelf")
    ).toHaveLength(16);
    expect(trimmed.evicted.map((entry) => entry.key)).toEqual([
      "shelf:0",
      "shelf:1",
      "shelf:2",
      "shelf:3",
    ]);
  });
});
