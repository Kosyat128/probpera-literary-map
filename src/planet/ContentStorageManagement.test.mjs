import { describe, it, expect, vi } from "vitest";
import { createContentDownloads } from "./ContentDownloads";
import { createWebContentDownloads } from "../platform/adapters/web/WebContentDownloads";
import { createNativeContentDownloads } from "../host/createNativeContentDownloads";
import { contentPackageFixture } from "../../tests/support/content-package-fixtures.mjs";

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const create = readSpace => createContentDownloads({ descriptors: [], createCache: null, fetch: null, readSpace });
const space = downloads => downloads.getSnapshot().space;
const phase = downloads => downloads.getSnapshot().items[0].phase;

describe("available space display", () => {
  it("is lazy, deduplicates reentrant requests, and works without a downloadable catalogue", async () => {
    const wait = deferred(), reader = vi.fn(() => wait.promise), downloads = create(reader);
    expect(reader).not.toHaveBeenCalled(); expect(space(downloads).phase).toBe("unchecked");
    let nested; downloads.subscribe(() => { nested ??= downloads.checkSpace(); });
    const pending = downloads.checkSpace(); expect(nested).toBe(pending);
    await Promise.resolve(); expect(reader).toHaveBeenCalledOnce();
    wait.resolve({ kind: "device", availableBytes: 0 }); await pending;
    expect(space(downloads)).toEqual({ phase: "ready", kind: "device", availableBytes: 0 });
    expect(Object.isFrozen(space(downloads))).toBe(true); expect(downloads.getSnapshot().available).toBe(false);
    downloads.dispose();
  });
  it.each([undefined, { availableBytes: -1, kind: "device" }, { availableBytes: Infinity, kind: "device" },
    { availableBytes: 2 ** 53, kind: "device" }, { availableBytes: 1.5, kind: "device" },
    { availableBytes: "12", kind: "device" }, { availableBytes: 12, kind: "disk" }])("does not invent available space from %j", async value => {
    const downloads = create(async () => value); await downloads.checkSpace();
    expect(space(downloads)).toEqual({ phase: "unavailable", kind: null, availableBytes: null }); downloads.dispose();
  });
  it("bounds a hung provider and ignores its late result after a successful retry", async () => {
    vi.useFakeTimers();
    try {
      const wait = deferred(), reader = vi.fn().mockImplementationOnce(() => wait.promise).mockResolvedValue({ kind: "device", availableBytes: 8 });
      const downloads = create(reader), pending = downloads.checkSpace();
      await vi.advanceTimersByTimeAsync(5000); await pending; expect(space(downloads).phase).toBe("unavailable");
      await downloads.checkSpace(); expect(space(downloads).availableBytes).toBe(8);
      const snapshot = downloads.getSnapshot(); wait.resolve({ kind: "device", availableBytes: 999 });
      await Promise.resolve(); await Promise.resolve(); expect(downloads.getSnapshot()).toBe(snapshot);
      downloads.dispose(); expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });
  it("settles disposal even during a synchronous subscriber callback, without starting native IO", async () => {
    const reader = vi.fn(), downloads = create(reader); downloads.subscribe(() => downloads.dispose());
    await downloads.checkSpace(); expect(reader).not.toHaveBeenCalled();
    const snapshot = downloads.getSnapshot(); await downloads.checkSpace(); expect(downloads.getSnapshot()).toBe(snapshot);
  });
  it("binds browser estimate to its receiver and reports origin quota rather than disk capacity", async () => {
    const storage = { estimate: vi.fn(async function () { expect(this).toBe(storage); return { quota: 1000, usage: 200.7 }; }) };
    const downloads = createWebContentDownloads({ navigator: { storage } });
    expect(storage.estimate).not.toHaveBeenCalled(); await downloads.checkSpace();
    expect(space(downloads)).toEqual({ phase: "ready", kind: "browser-estimate", availableBytes: 799 }); downloads.dispose();
  });
  it.each([{ quota: 10, usage: 15 }, { quota: 0, usage: 0 }])("clamps an exhausted browser quota %j to zero", async value => {
    const downloads = createWebContentDownloads({ navigator: { storage: { estimate: async () => value } } });
    await downloads.checkSpace(); expect(space(downloads).availableBytes).toBe(0); downloads.dispose();
  });
  it.each([{}, { quota: -1, usage: 0 }, { quota: Infinity, usage: 0 }, { quota: 12, usage: NaN },
    { quota: "12", usage: 0 }, { quota: 2 ** 53, usage: 0 }])("rejects an invalid browser estimate %j", async value => {
    const downloads = createWebContentDownloads({ navigator: { storage: { estimate: async () => value } } });
    await downloads.checkSpace(); expect(space(downloads).phase).toBe("unavailable"); downloads.dispose();
  });
  it("handles missing or denied browser storage without rejecting the action", async () => {
    for (const host of [null, {}, { navigator: { get storage() { throw new Error("denied"); } } }]) {
      const downloads = createWebContentDownloads(host); await downloads.checkSpace();
      expect(space(downloads).phase).toBe("unavailable"); downloads.dispose();
    }
  });
  it("uses only the native capacity bridge, tolerating older and rejected bridges without web fallback", async () => {
    const bridge = { capacity: vi.fn(async function () { expect(this).toBe(bridge); return { availableBytes: 2048 }; }) };
    const downloads = createNativeContentDownloads(bridge); expect(bridge.capacity).not.toHaveBeenCalled();
    await downloads.checkSpace(); expect(space(downloads)).toEqual({ phase: "ready", availableBytes: 2048, kind: "device" }); downloads.dispose();
    for (const native of [null, {}, { capacity: async () => { throw new Error("native unavailable"); } }]) {
      const unavailable = createNativeContentDownloads(native); await unavailable.checkSpace();
      expect(space(unavailable).phase).toBe("unavailable"); unavailable.dispose();
    }
  });
});

describe("unfinished download removal controller", () => {
  const setup = (result, lifecycle) => {
    const f = contentPackageFixture(), cache = { discard: vi.fn(async () => result), read: vi.fn(), download: vi.fn() }, fetch = vi.fn();
    const downloads = createContentDownloads({ descriptors: [{ id: "test", title: { ru: "Тест", en: "Test" },
      envelope: f.envelope, expected: f.expected, manifestSha256: f.manifestSha256, previous: null, baseUrl: "https://packages.test/" }],
      createCache: () => cache, fetch, lifecycle });
    return { downloads, cache, fetch };
  };
  it.each([[{ ok: true, removed: true }, "cleared"], [{ ok: true, removed: false }, "cleared"],
    [{ ok: false, reason: "content-generation-protected" }, "protected"], [{ ok: false, reason: "denied" }, "clear-error"]])
  ("reports removal %j truthfully while offline", async (result, expectedPhase) => {
    const { downloads, cache, fetch } = setup(result, { getSnapshot: () => ({ visibility: "active", connectivity: "offline" }), subscribe: vi.fn() });
    await downloads.discard("test"); expect(phase(downloads)).toBe(expectedPhase);
    expect(cache.discard).toHaveBeenCalledOnce(); expect(cache.read).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled(); downloads.dispose();
  });
  it("holds removal until storage settles and deduplicates Check/Download/Remove without issuing other IO", async () => {
    const wait = deferred(), { downloads, cache } = setup(); cache.discard.mockImplementation(() => wait.promise);
    const pending = downloads.discard("test"); await Promise.resolve(); expect(phase(downloads)).toBe("clearing");
    expect(downloads.check("test")).toBe(pending); expect(downloads.download("test")).toBe(pending); expect(downloads.discard("test")).toBe(pending);
    downloads.pause("test"); downloads.cancel("test"); expect(phase(downloads)).toBe("clearing");
    wait.resolve({ ok: true, removed: true }); await pending; expect(phase(downloads)).toBe("cleared");
    expect(cache.read).not.toHaveBeenCalled(); expect(cache.download).not.toHaveBeenCalled(); downloads.dispose();
  });
  it("disposes a lifecycle subscription created by a reentrant native callback", async () => {
    const remove = vi.fn(); let downloads;
    const lifecycle = { getSnapshot: () => ({ visibility: "active", connectivity: "online" }), subscribe: () => { downloads.dispose(); return remove; } };
    ({ downloads } = setup(undefined, lifecycle)); await downloads.check("test"); expect(remove).toHaveBeenCalledOnce();
  });
});
