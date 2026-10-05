import { afterEach, describe, expect, it, vi } from "vitest";
import type { Country } from "../data/countries/types";
import type { GlobeEditionId } from "./globeEditions";

const releaseRuntimeFixtures: Array<() => void> = [];

afterEach(() => {
  releaseRuntimeFixtures.splice(0).forEach((release) => release());
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function createSourceLeaseFixture(
  failInitialImage = false,
  childNativeOwned = false,
  options: { countries?: Country[]; editionId?: GlobeEditionId } = {}
) {
  vi.resetModules();
  const network = { blocked: false, failNextImage: failInitialImage, holdNextDecode: false };
  const images: FixtureImage[] = [];
  const requests: string[] = [];
  class FixtureImage {
    decoding = "auto";
    fetchPriority = "auto";
    naturalWidth = 32;
    naturalHeight = 16;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    decodeCalls = 0;
    private value = "";
    private decodePromise: Promise<void> | null = null;
    private resolveDecode: (() => void) | null = null;

    constructor() {
      images.push(this);
      if (network.holdNextDecode) {
        network.holdNextDecode = false;
        this.decodePromise = new Promise((resolve) => { this.resolveDecode = resolve; });
      }
    }
    get src() { return this.value; }
    set src(value: string) {
      this.value = value;
      requests.push(value);
      const failed = network.blocked || network.failNextImage;
      network.failNextImage = false;
      queueMicrotask(() => failed ? this.onerror?.() : this.onload?.());
    }
    decode() {
      this.decodeCalls += 1;
      return this.decodePromise ?? Promise.resolve();
    }
    finishDecode() { this.resolveDecode?.(); }
    removeAttribute(name: string) { if (name === "src") this.value = ""; }
  }
  class FixtureCanvas {
    width = 0;
    height = 0;
    fillCount = 0;
    context = {
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      fillRect: () => { this.fillCount += 1; },
      createLinearGradient: () => ({ addColorStop: () => undefined }),
      createRadialGradient: () => ({ addColorStop: () => undefined }),
      save: vi.fn(), restore: () => undefined,
      beginPath: () => undefined, moveTo: () => undefined, lineTo: () => undefined,
      stroke: () => undefined, setLineDash: () => undefined,
      arc: () => undefined, fill: () => undefined, bezierCurveTo: () => undefined,
    };
    getContext() { return this.context; }
  }
  const canvases: FixtureCanvas[] = [];
  const createElement = vi.fn((name: string) => {
    if (name !== "canvas") throw new Error(`Unexpected atlas element: ${name}`);
    const canvas = new FixtureCanvas();
    canvases.push(canvas);
    return canvas;
  });
  const fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => ({ type: "FeatureCollection", features: [] }),
  }));
  vi.stubGlobal("Image", FixtureImage);
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("document", { createElement });
  const { createGlobeAtlas } = await import("./globeAtlas");
  const atlas = await createGlobeAtlas(options.countries ?? [], options.editionId ?? "natural-earth-2026", "ru", { compact: false, surfaceSourceMode: childNativeOwned ? "child-native-owned" : undefined });
  releaseRuntimeFixtures.push(() => {
    atlas.dispose();
    images.forEach((image) => image.finishDecode());
  });
  return { atlas, network, images, requests, canvases, createElement, fetchMock };
}

describe("globe atlas retained edition source", () => {
  it("restores an evicted source offline into the same canvas and texture with current highlights", async () => {
    const fixture = await createSourceLeaseFixture();
    const { atlas, images, canvases } = fixture;
    const mapTexture = atlas.mapTexture, canvas = mapTexture.image;
    const reliefVersion = atlas.reliefTexture.version;
    const source = images[0];
    atlas.updateHighlight("fixture-selected-country");
    const lease = atlas.captureEditionSource()!;
    expect(lease).toMatchObject({ editionId: "natural-earth-2026", language: "ru" });
    expect(Object.isFrozen(lease)).toBe(true);
    expect(atlas.getEditionSourceState()).toEqual({ editionId: "natural-earth-2026", language: "ru", generation: 0 });
    await atlas.setEdition("cassini-1790");
    // Three decoded assets exceed the real module cache's two-entry LRU.
    await atlas.preloadEdition("nasa-blue-marble");
    expect(images).toHaveLength(3);
    fixture.network.blocked = true;
    const requestCount = fixture.requests.length;
    const version = mapTexture.version;
    const highlightVersion = atlas.highlightTexture.version;
    const highlightDraws = canvases[2].context.save.mock.calls.length;
    expect(lease.restore()).toBe(true);
    expect(atlas.mapTexture).toBe(mapTexture);
    expect(mapTexture.image).toBe(canvas);
    expect(canvases[0].context.drawImage).toHaveBeenLastCalledWith(source, 0, 0, 32, 16);
    expect(fixture.requests).toHaveLength(requestCount);
    expect(fixture.createElement).toHaveBeenCalledTimes(3);
    expect(fixture.fetchMock).toHaveBeenCalledOnce();
    expect(mapTexture.version).toBeGreaterThan(version);
    expect(atlas.reliefTexture.version).toBe(reliefVersion);
    expect(atlas.highlightTexture.version).toBeGreaterThan(highlightVersion);
    expect(canvases[2].context.save.mock.calls.length).toBeGreaterThan(highlightDraws);
    expect(atlas.getEditionSourceState()).toEqual({ editionId: "natural-earth-2026", language: "ru", generation: 2 });
    await atlas.setEdition("natural-earth-2026", "ru");
    expect(atlas.getEditionSourceState()?.generation).toBe(2);
  });

  it("fences an already decoding candidate and cancels its queued successor even before the baseline changed", async () => {
    const fixture = await createSourceLeaseFixture();
    const { atlas, images, canvases } = fixture;
    const lease = atlas.captureEditionSource()!;
    fixture.network.holdNextDecode = true;
    const decoding = atlas.setEdition("cassini-1790");
    await Promise.resolve();
    expect(images[1].decodeCalls).toBe(1);
    const queued = atlas.setEdition("nasa-blue-marble").catch((error: unknown) => error);
    expect(images).toHaveLength(2);
    expect(lease.restore()).toBe(true);
    const version = atlas.mapTexture.version;
    const drawCount = canvases[0].context.drawImage.mock.calls.length;
    images[1].finishDecode();
    await decoding;
    await expect(queued).resolves.toMatchObject({ name: "AbortError" });
    expect(images).toHaveLength(2);
    expect(atlas.mapTexture.version).toBe(version);
    expect(canvases[0].context.drawImage).toHaveBeenCalledTimes(drawCount);
    expect(atlas.getEditionSourceState()).toEqual({ editionId: "natural-earth-2026", language: "ru", generation: 1 });
  });

  it("invalidates old leases without letting their release cancel the current owner", async () => {
    const { atlas } = await createSourceLeaseFixture();
    const oldLease = atlas.captureEditionSource()!;
    await atlas.setEdition("cassini-1790");
    const currentLease = atlas.captureEditionSource()!;
    expect(oldLease.restore()).toBe(false);
    oldLease.release();
    await atlas.setEdition("nasa-blue-marble");
    expect(currentLease.restore()).toBe(true);
    expect(atlas.getEditionSourceState()?.editionId).toBe("cassini-1790");
    currentLease.release();
    currentLease.release();
    const state = atlas.getEditionSourceState();
    const version = atlas.mapTexture.version;
    expect(currentLease.restore()).toBe(false);
    expect(atlas.getEditionSourceState()).toEqual(state);
    expect(atlas.mapTexture.version).toBe(version);
  });

  it("retains the exact localized source rather than silently substituting the other language", async () => {
    const fixture = await createSourceLeaseFixture();
    const { atlas, images, canvases } = fixture;
    const russianLease = atlas.captureEditionSource()!;
    await atlas.setEdition("natural-earth-2026", "en");
    const englishSource = images[1];
    expect(englishSource.src).toContain("modern-atlas-2026-en.webp");
    const englishLease = atlas.captureEditionSource()!;
    expect(englishLease.language).toBe("en");
    await atlas.setEdition("cassini-1790", "ru");
    await atlas.preloadEdition("nasa-blue-marble", "ru");
    fixture.network.blocked = true;
    const requestCount = fixture.requests.length;
    expect(russianLease.restore()).toBe(false);
    expect(englishLease.restore()).toBe(true);
    expect(canvases[0].context.drawImage).toHaveBeenLastCalledWith(englishSource, 0, 0, 32, 16);
    expect(atlas.getEditionSourceState()).toEqual({ editionId: "natural-earth-2026", language: "en", generation: 3 });
    expect(fixture.requests).toHaveLength(requestCount);
  });

  it("restores a procedural canonical fallback without retrying its failed source", async () => {
    const fixture = await createSourceLeaseFixture(true);
    const { atlas, canvases } = fixture;
    expect(canvases[0].context.drawImage).not.toHaveBeenCalled();
    const lease = atlas.captureEditionSource()!;
    await atlas.setEdition("cassini-1790");
    fixture.network.blocked = true;
    const requestCount = fixture.requests.length;
    const fillCount = canvases[0].fillCount;
    expect(lease.restore()).toBe(true);
    expect(canvases[0].context.drawImage).toHaveBeenCalledOnce();
    expect(canvases[0].fillCount).toBeGreaterThan(fillCount);
    expect(fixture.requests).toHaveLength(requestCount);
    expect(atlas.getEditionSourceState()?.editionId).toBe("natural-earth-2026");
  });

  it("invalidates leases and rejects further source work after disposal, including a late decode", async () => {
    const fixture = await createSourceLeaseFixture();
    const { atlas, images, canvases } = fixture;
    const lease = atlas.captureEditionSource()!;
    fixture.network.holdNextDecode = true;
    const pending = atlas.setEdition("cassini-1790");
    await Promise.resolve();
    expect(images[1].decodeCalls).toBe(1);
    const disposeMap = vi.fn();
    atlas.mapTexture.addEventListener("dispose", disposeMap);
    atlas.dispose();
    atlas.dispose();
    const requestCount = fixture.requests.length;
    const drawCount = canvases[0].context.drawImage.mock.calls.length;
    images[1].finishDecode();
    await pending;
    await atlas.setEdition("nasa-blue-marble");
    await atlas.preloadEdition("nasa-blue-marble");
    expect(lease.restore()).toBe(false);
    lease.release();
    expect(atlas.captureEditionSource()).toBeNull();
    expect(atlas.getEditionSourceState()).toBeNull();
    expect(fixture.requests).toHaveLength(requestCount);
    expect(canvases[0].context.drawImage).toHaveBeenCalledTimes(drawCount);
    expect(disposeMap).toHaveBeenCalledOnce();
    expect(canvases.every((canvas) => canvas.width === 1 && canvas.height === 1)).toBe(true);
  });
});

describe("globe atlas initialization", () => {
  it("does not allocate atlas canvases after an in-flight mount is aborted", async () => {
    vi.resetModules();
    let resolveFetch!: (response: Response) => void;
    const fetchResponse = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    vi.stubGlobal("fetch", vi.fn(() => fetchResponse));

    class FakeImage {
      decoding = "auto";
      fetchPriority = "auto";
      naturalWidth = 4096;
      naturalHeight = 2048;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }

      decode() {
        return Promise.resolve();
      }
    }

    const createElement = vi.fn(() => {
      throw new Error("stale atlas attempted to allocate a canvas");
    });
    vi.stubGlobal("Image", FakeImage);
    vi.stubGlobal("document", { createElement });

    const { createGlobeAtlas } = await import("./globeAtlas");
    const controller = new AbortController();
    const pendingAtlas = createGlobeAtlas([], "antique", "ru", {
      compact: false,
      signal: controller.signal,
    });

    controller.abort();
    resolveFetch({
      ok: true,
      json: async () => ({ type: "FeatureCollection", features: [] }),
    } as Response);

    await expect(pendingAtlas).rejects.toMatchObject({ name: "AbortError" });
    expect(createElement).not.toHaveBeenCalled();
  });

  it("retries GeoJSON after a transient first-request failure", async () => {
    vi.resetModules();
    let resolveRetry!: (response: Response) => void;
    const retryResponse = new Promise<Response>((resolve) => {
      resolveRetry = resolve;
    });
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary atlas network failure"))
      .mockImplementationOnce(() => retryResponse);
    vi.stubGlobal("fetch", fetchMock);

    class FakeImage {
      decoding = "auto";
      fetchPriority = "auto";
      naturalWidth = 4096;
      naturalHeight = 2048;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }

      decode() {
        return Promise.resolve();
      }
    }

    const createElement = vi.fn(() => {
      throw new Error("retry test attempted to allocate a canvas");
    });
    vi.stubGlobal("Image", FakeImage);
    vi.stubGlobal("document", { createElement });

    const { createGlobeAtlas } = await import("./globeAtlas");
    await expect(
      createGlobeAtlas([], "antique", "ru", { compact: false })
    ).rejects.toThrow("temporary atlas network failure");

    const controller = new AbortController();
    const retriedAtlas = createGlobeAtlas([], "antique", "ru", {
      compact: false,
      signal: controller.signal,
    });
    controller.abort();
    resolveRetry({
      ok: true,
      json: async () => ({ type: "FeatureCollection", features: [] }),
    } as Response);

    await expect(retriedAtlas).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(createElement).not.toHaveBeenCalled();
  });
});

describe("child native owned atlas surface",()=>{
 it("retains original geography/canvas/texture while fetching no adult edition or flag images",async()=>{
  const f=await createSourceLeaseFixture(false,true),texture=f.atlas.mapTexture,canvas=texture.image;
  expect(f.images).toHaveLength(0);expect(f.requests).toEqual([]);
  await f.atlas.setEdition("nasa-blue-marble");await f.atlas.preloadEdition("cassini-1790");
  f.atlas.updateHighlight("fixture-country");expect(f.images).toHaveLength(0);expect(f.requests).toEqual([]);
  expect(f.atlas.mapTexture).toBe(texture);expect(f.atlas.mapTexture.image).toBe(canvas);
  expect(typeof f.atlas.countryAtGeographicCoordinates).toBe("function");
 });
});

describe("globe atlas flag highlight settlement", () => {
  const countries: Country[] = [
    { id: "russia", code: "RU", name: "Fixture country", description: "", writers: [] },
  ];
  type Fixture = Awaited<ReturnType<typeof createSourceLeaseFixture>>;

  async function expectSettled(fixture: Fixture, expectedVersion: number) {
    // Bounded promise turns reach the real image callback. Assert before waiting
    // for a task: the old redraw loop starves timers, but finally can dispose it.
    for (let turn = 0; turn < 8; turn += 1) await Promise.resolve();
    expect(fixture.atlas.highlightTexture.version).toBe(expectedVersion);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(fixture.atlas.highlightTexture.version).toBe(expectedVersion);
  }

  it("settles child native selection and hover without loading any flag or adult image", async () => {
    const fixture = await createSourceLeaseFixture(false, true, {
      countries, editionId: "rand-mcnally-1887",
    });
    const texture = fixture.atlas.mapTexture, canvas = texture.image;
    try {
      fixture.atlas.updateHighlight("russia");
      await expectSettled(fixture, fixture.atlas.highlightTexture.version);
      fixture.atlas.updateHighlight(null, "russia");
      await expectSettled(fixture, fixture.atlas.highlightTexture.version);
      expect(fixture.images).toHaveLength(0);
      expect(fixture.requests).toEqual([]);
      expect(fixture.fetchMock).toHaveBeenCalledOnce();
      expect(fixture.atlas.mapTexture).toBe(texture);
      expect(texture.image).toBe(canvas);
      expect(fixture.createElement).toHaveBeenCalledTimes(3);
    } finally { fixture.atlas.dispose(); }
  });

  it("settles canonical selection and hover when the country has no flag code", async () => {
    const fixture = await createSourceLeaseFixture(false, false, {
      countries: countries.map(({ code: _code, ...country }) => country),
      editionId: "rand-mcnally-1887",
    });
    try {
      const initialRequests = fixture.requests.length;
      fixture.atlas.updateHighlight("russia");
      await expectSettled(fixture, fixture.atlas.highlightTexture.version);
      fixture.atlas.updateHighlight(null, "russia");
      await expectSettled(fixture, fixture.atlas.highlightTexture.version);
      expect(fixture.requests).toHaveLength(initialRequests);
    } finally { fixture.atlas.dispose(); }
  });

  it("keeps the geometry highlight after a failed flag without retrying from its callback", async () => {
    const fixture = await createSourceLeaseFixture(false, false, {
      countries, editionId: "rand-mcnally-1887",
    });
    try {
      const initialRequests = fixture.requests.length;
      fixture.network.blocked = true;
      fixture.atlas.updateHighlight("russia");
      await expectSettled(fixture, fixture.atlas.highlightTexture.version);
      expect(fixture.requests).toHaveLength(initialRequests + 1);
      expect(fixture.requests[fixture.requests.length - 1]).toMatch(/country-flags\/ru\.svg$/);
    } finally { fixture.atlas.dispose(); }
  });

  it("repaints once when an actual flag image finishes and then settles", async () => {
    const fixture = await createSourceLeaseFixture(false, false, {
      countries, editionId: "rand-mcnally-1887",
    });
    try {
      const initialRequests = fixture.requests.length;
      fixture.atlas.updateHighlight("russia");
      const versionBeforeImage = fixture.atlas.highlightTexture.version;
      await expectSettled(fixture, versionBeforeImage + 1);
      expect(fixture.requests).toHaveLength(initialRequests + 1);
      expect(fixture.requests[fixture.requests.length - 1]).toMatch(/country-flags\/ru\.svg$/);
    } finally { fixture.atlas.dispose(); }
  });
});
