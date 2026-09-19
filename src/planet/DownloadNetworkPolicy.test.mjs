import { describe, it, expect, vi } from "vitest";
import { createContentDownloads } from "./ContentDownloads";
import { createDownloadNetworkPreference, DOWNLOAD_NETWORK_PREFERENCE } from "./DownloadNetworkPreference";
import { contentPackageFixture } from "../../tests/support/content-package-fixtures.mjs";
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const saved = { ok: true, activationAllowed: false };
const missing = { ok: false, activationAllowed: false, reason: "content-generation-not-selected" };
const phase = downloads => downloads.getSnapshot().items[0].phase;
function setup(type = "wifi", preference = null) {
  let state = { visibility: "active", connectivity: "online", networkType: type };
  const listeners = new Set();
  const lifecycle = { getSnapshot: () => state, subscribe: vi.fn(fn => { listeners.add(fn); return () => listeners.delete(fn); }) };
  const preferences = { get: vi.fn(async () => preference), set: vi.fn(async () => true) };
  const f = contentPackageFixture(), cache = { read: vi.fn(async () => missing), discard: vi.fn(async () => saved), download: vi.fn(async () => saved) };
  const fetch = vi.fn(async () => new Response("{}"));
  const downloads = createContentDownloads({ lifecycle, preferences, fetch, createCache: () => cache, descriptors: [{ id: "test",
    title: { ru: "Тест", en: "Test" }, envelope: f.envelope, expected: f.expected, manifestSha256: f.manifestSha256,
    previous: null, baseUrl: "https://packages.test/" }] });
  return { downloads, cache, fetch, preferences, lifecycle, listeners,
    publish(next, emit = true) { state = { ...state, ...next }; if (emit) for (const fn of [...listeners]) fn(); } };
}

describe("Wi-Fi-only transfer policy", () => {
  it.each(["cellular", "ethernet", "unknown", undefined])("blocks %s before network and storage when Wi-Fi is required", async type => {
    const f = setup(type ?? "unknown"); await f.downloads.download("test");
    expect(phase(f.downloads)).toBe("waiting-wifi"); expect(f.cache.read).not.toHaveBeenCalled(); expect(f.fetch).not.toHaveBeenCalled();
    expect(f.preferences.get).toHaveBeenCalledWith(DOWNLOAD_NETWORK_PREFERENCE); f.downloads.dispose();
  });
  it("loads a stored any-network choice before deciding whether a transfer is allowed", async () => {
    const f = setup("cellular", "any-network"); expect(f.preferences.get).not.toHaveBeenCalled();
    await f.downloads.download("test"); expect(phase(f.downloads)).toBe("saved"); expect(f.cache.download).toHaveBeenCalledOnce(); f.downloads.dispose();
  });
  it("allows offline verification and removal without loading or relaxing the preference", async () => {
    const f = setup("unknown"); f.publish({ connectivity: "offline" }); f.cache.read.mockResolvedValue(saved);
    await f.downloads.check("test"); expect(phase(f.downloads)).toBe("saved");
    await f.downloads.discard("test"); expect(phase(f.downloads)).toBe("cleared");
    expect(f.preferences.get).not.toHaveBeenCalled(); expect(f.fetch).not.toHaveBeenCalled(); f.downloads.dispose();
  });
  it.each([false, true])("pauses on Wi-Fi to mobile transition, preserving a late atomic success=%s", async committed => {
    const f = setup(), wait = deferred(); f.cache.download.mockImplementation(() => wait.promise);
    const pending = f.downloads.download("test"); await vi.waitFor(() => expect(f.cache.download).toHaveBeenCalledOnce());
    f.publish({ networkType: "cellular" }); expect(phase(f.downloads)).toBe("pausing");
    expect(f.cache.download.mock.calls[0][0].signal.aborted).toBe(true);
    wait.resolve(committed ? saved : missing); await pending; expect(phase(f.downloads)).toBe(committed ? "saved" : "waiting-wifi");
    f.publish({ networkType: "wifi" }); await Promise.resolve(); expect(f.cache.download).toHaveBeenCalledOnce(); f.downloads.dispose();
  });
  it("enforces a new Wi-Fi preference immediately even when persistence hangs", async () => {
    const f = setup("cellular", "any-network"), transfer = deferred(); f.cache.download.mockImplementation(() => transfer.promise);
    f.preferences.set.mockImplementation(() => new Promise(() => {}));
    const pending = f.downloads.download("test"); await vi.waitFor(() => expect(f.cache.download).toHaveBeenCalledOnce());
    const saving = f.downloads.setNetworkPolicy("wifi-only"); expect(phase(f.downloads)).toBe("pausing");
    transfer.resolve(missing); await pending; expect(phase(f.downloads)).toBe("waiting-wifi");
    f.downloads.dispose(); await saving; expect(f.listeners.size).toBe(0);
  });
  it("rechecks each fetch boundary when the platform change event is delayed", async () => {
    const f = setup(); f.cache.download.mockImplementation(async request => {
      f.publish({ networkType: "cellular" }, false);
      await expect(request.fetch("https://packages.test/bytes", {})).rejects.toThrow("cancelled"); return missing;
    });
    await f.downloads.download("test"); expect(f.fetch).not.toHaveBeenCalled(); expect(phase(f.downloads)).toBe("waiting-wifi"); f.downloads.dispose();
  });
  it("keeps explicit cancellation authoritative and never resumes on preference/network changes", async () => {
    const f = setup("unknown"); await f.downloads.download("test"); f.downloads.cancel("test");
    expect(phase(f.downloads)).toBe("cancelled"); await f.downloads.setNetworkPolicy("any-network"); f.publish({ networkType: "wifi" });
    expect(phase(f.downloads)).toBe("cancelled"); expect(f.cache.download).not.toHaveBeenCalled(); f.downloads.dispose();
  });
});

describe("network preference persistence", () => {
  it("deduplicates initialization and keeps the user's edit ahead of a late stored value", async () => {
    const read = deferred(), store = { get: vi.fn(() => read.promise), set: vi.fn(async () => true) }, changed = vi.fn();
    const preference = createDownloadNetworkPreference(store, changed); expect(store.get).not.toHaveBeenCalled();
    const pending = preference.load(); expect(preference.load()).toBe(pending); await Promise.resolve();
    await preference.set("any-network"); read.resolve("wifi-only"); await pending;
    expect(preference.getSnapshot()).toEqual({ policy: "any-network", status: "ready" });
    expect(store.get).toHaveBeenCalledOnce(); preference.dispose();
  });
  it.each(["garbage", 123])("uses the safe default for invalid persisted %s", async value => {
    const preference = createDownloadNetworkPreference({ get: async () => value, set: async () => true }, () => {});
    await preference.load(); expect(preference.getSnapshot()).toEqual({ policy: "wifi-only", status: "session-only" }); preference.dispose();
  });
  it("bounds reads and ordered writes; stale results cannot overwrite a newer choice", async () => {
    vi.useFakeTimers();
    try {
      const read = deferred(), first = deferred();
      const store = { get: vi.fn(() => read.promise), set: vi.fn().mockImplementationOnce(() => first.promise).mockResolvedValue(true) };
      const preference = createDownloadNetworkPreference(store, () => {}), loading = preference.load();
      await vi.advanceTimersByTimeAsync(4000); await loading;
      expect(preference.getSnapshot()).toEqual({ policy: "wifi-only", status: "session-only" });
      const a = preference.set("any-network"); await vi.advanceTimersByTimeAsync(4000); await a;
      const b = preference.set("wifi-only"); await Promise.resolve(); expect(store.set).toHaveBeenCalledTimes(1);
      first.resolve(true); await b;
      expect(store.set.mock.calls.map(call => call[1])).toEqual(["any-network", "wifi-only"]);
      read.resolve("any-network"); await Promise.resolve(); await Promise.resolve();
      expect(preference.getSnapshot()).toEqual({ policy: "wifi-only", status: "ready" }); preference.dispose(); expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });
  it("keeps a rejected save local and disposal settles a blocked read", async () => {
    const store = { get: () => new Promise(() => {}), set: async () => false };
    const preference = createDownloadNetworkPreference(store, () => {});
    const loading = preference.load(); await Promise.resolve(); await Promise.resolve();
    await preference.set("any-network"); expect(preference.getSnapshot().status).toBe("session-only");
    preference.dispose(); await loading;
  });
});
