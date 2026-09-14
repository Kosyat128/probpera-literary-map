import { describe, it, expect, vi } from "vitest";
import { createContentDownloads } from "./ContentDownloads";
import { contentPackageFixture } from "../../tests/support/content-package-fixtures.mjs";
import { createWebContentDownloads } from "../platform/adapters/web/WebContentDownloads";
import { createWebPlatformAdapter } from "../platform/adapters/web/WebPlatformAdapter";
import { createNativeContentDownloads } from "../host/createNativeContentDownloads";
import { contentDownloadCatalog, contentDownloadTrust } from "./contentDownloadCatalog";

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const descriptor = (f = contentPackageFixture()) => ({ id: "test", title: { ru: "Проверочный пакет", en: "Test package" },
  envelope: f.envelope, expected: f.expected, manifestSha256: f.manifestSha256, previous: null, baseUrl: "https://packages.test/v1/" });
const missing = { ok: false, activationAllowed: false, reason: "content-generation-not-selected" };
const saved = { ok: true, activationAllowed: false, releaseReady: false };
function setup(input = descriptor(), lifecycle) {
  const cache = { read: vi.fn(async () => missing), download: vi.fn(async () => saved) };
  const createCache = vi.fn(() => cache), fetch = vi.fn();
  return { cache, createCache, fetch, downloads: createContentDownloads({ descriptors: [input], createCache, fetch, lifecycle }) };
}
const phase = downloads => downloads.getSnapshot().items[0].phase;
function lifecycleFixture(initial = { visibility: "active", connectivity: "online" }) {
  let snapshot = initial;
  const listeners = new Set(), remove = vi.fn(listener => listeners.delete(listener));
  return {
    getSnapshot: () => snapshot,
    subscribe: vi.fn(listener => { listeners.add(listener); return () => remove(listener); }),
    publish(next) { snapshot = { ...snapshot, ...next }; for (const listener of [...listeners]) listener(); },
    listeners, remove,
  };
}

describe("platform-lifetime downloads", () => {
  it("does no constructor IO and preserves stable snapshots until an operation changes them", async () => {
    const { downloads, cache, createCache, fetch } = setup();
    expect(createCache).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
    expect(downloads.getSnapshot()).toBe(downloads.getSnapshot());
    await downloads.check("test"); expect(phase(downloads)).toBe("not-saved");
    expect(cache.download).not.toHaveBeenCalled(); expect(cache.read).toHaveBeenCalledOnce();
  });
  it("deduplicates a reentrant subscription before IO and holds the same pending promise", async () => {
    const { downloads, cache } = setup(), wait = deferred(); cache.download.mockImplementation(() => wait.promise);
    let nested; downloads.subscribe(() => { nested ??= downloads.download("test"); });
    const pending = downloads.download("test"); expect(nested).toBe(pending);
    let done = false; void pending.then(() => { done = true; });
    await vi.waitFor(() => expect(cache.download).toHaveBeenCalledOnce()); expect(done).toBe(false);
    wait.resolve(saved); await pending; expect(phase(downloads)).toBe("saved");
    expect(downloads.getSnapshot().items[0].completedBytes).toBe(downloads.getSnapshot().items[0].totalBytes);
  });
  it("closing/unsubscribing and switching UI observers keeps the download alive", async () => {
    const { downloads, cache } = setup(), wait = deferred(); let signal;
    cache.download.mockImplementation(request => { signal = request.signal; request.onProgress({ phase: "downloading", downloadedBytes: 100, cachedBytes: 10 }); return wait.promise; });
    const listener = vi.fn(), off = downloads.subscribe(listener), pending = downloads.download("test");
    await vi.waitFor(() => expect(phase(downloads)).toBe("downloading"));
    off(); const latest = vi.fn(); downloads.subscribe(latest);
    expect(signal.aborted).toBe(false); expect(downloads.getSnapshot().items[0].completedBytes).toBe(110);
    wait.resolve(saved); await pending; expect(latest).toHaveBeenCalled(); expect(phase(downloads)).toBe("saved");
  });
  it.each([false, true])("reports late atomic completion truthfully when committed=%s after cancel", async committed => {
    const { downloads, cache } = setup(), wait = deferred(); let signal;
    cache.download.mockImplementation(request => { signal = request.signal; return wait.promise; });
    const pending = downloads.download("test"); await vi.waitFor(() => expect(cache.download).toHaveBeenCalledOnce());
    downloads.cancel("test"); expect(signal.aborted).toBe(true); expect(phase(downloads)).toBe("cancelling");
    wait.resolve(committed ? saved : { ...missing, reason: "cancelled" }); await pending;
    expect(phase(downloads)).toBe(committed ? "saved" : "cancelled");
  });
  it.each([false, true])("waits for IO settlement after pause and preserves late atomic commit=%s", async committed => {
    const lifecycle = lifecycleFixture(), { downloads, cache } = setup(undefined, lifecycle), wait = deferred();
    cache.download.mockImplementation(request => {
      request.onProgress({ phase: "downloading", downloadedBytes: 100, cachedBytes: 10 }); return wait.promise;
    });
    expect(lifecycle.subscribe).not.toHaveBeenCalled();
    const pending = downloads.download("test");
    await vi.waitFor(() => expect(cache.download).toHaveBeenCalledOnce());
    downloads.pause("test"); expect(phase(downloads)).toBe("pausing");
    expect(cache.download.mock.calls[0][0].signal.aborted).toBe(true);
    expect(downloads.download("test")).toBe(pending);
    lifecycle.publish({ visibility: "background" }); lifecycle.publish({ visibility: "active" });
    expect(cache.download).toHaveBeenCalledOnce();
    wait.resolve(committed ? saved : missing); await pending;
    expect(phase(downloads)).toBe(committed ? "saved" : "paused");
    if (!committed) expect(downloads.getSnapshot().items[0].completedBytes).toBe(110);
    expect(lifecycle.listeners.size).toBe(1); downloads.dispose();
    expect(lifecycle.listeners.size).toBe(0); expect(lifecycle.remove).toHaveBeenCalledOnce();
  });
  it.each([{ visibility: "background" }, { connectivity: "offline" }])("pauses on host change %j, resumes only explicitly and keeps panel observers independent", async state => {
    const lifecycle = lifecycleFixture(), { downloads, cache } = setup(undefined, lifecycle), wait = deferred();
    cache.download.mockImplementationOnce(() => wait.promise);
    const off = downloads.subscribe(vi.fn()), pending = downloads.download("test");
    await vi.waitFor(() => expect(cache.download).toHaveBeenCalledOnce()); off();
    lifecycle.publish(state); expect(phase(downloads)).toBe("pausing");
    wait.resolve(missing); await pending; expect(phase(downloads)).toBe("paused");
    lifecycle.publish({ visibility: "active", connectivity: "online" });
    await Promise.resolve(); expect(cache.download).toHaveBeenCalledOnce();
    await downloads.download("test"); expect(phase(downloads)).toBe("saved");
    expect(cache.download).toHaveBeenCalledTimes(2); expect(lifecycle.subscribe).toHaveBeenCalledOnce();
    downloads.dispose(); expect(lifecycle.listeners.size).toBe(0);
  });
  it.each([{ visibility: "background", connectivity: "online" }, { visibility: "active", connectivity: "offline" }])("blocks transfer before storage/network when host is %j", async state => {
    const lifecycle = lifecycleFixture(state), { downloads, createCache, fetch } = setup(undefined, lifecycle);
    await downloads.download("test"); expect(phase(downloads)).toBe("paused");
    expect(createCache).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
    downloads.dispose(); expect(lifecycle.listeners.size).toBe(0);
  });
  it("allows local verification offline without restarting downloads", async () => {
    const lifecycle = lifecycleFixture({ visibility: "active", connectivity: "offline" }), { downloads, cache } = setup(undefined, lifecycle);
    cache.read.mockResolvedValue(saved); await downloads.check("test");
    expect(phase(downloads)).toBe("saved"); expect(cache.download).not.toHaveBeenCalled();
  });
  it("cancellation wins over pause and cannot be undone by host events", async () => {
    const lifecycle = lifecycleFixture(), { downloads, cache } = setup(undefined, lifecycle), wait = deferred();
    cache.download.mockImplementationOnce(() => wait.promise);
    const pending = downloads.download("test"); await vi.waitFor(() => expect(cache.download).toHaveBeenCalledOnce());
    downloads.pause("test"); downloads.cancel("test"); lifecycle.publish({ visibility: "background" });
    expect(phase(downloads)).toBe("cancelling"); wait.resolve(missing); await pending;
    expect(phase(downloads)).toBe("cancelled");
    await downloads.download("test"); expect(phase(downloads)).toBe("paused");
    downloads.cancel("test"); expect(phase(downloads)).toBe("cancelled");
  });
  it("handles synchronous host pause, lifecycle errors, and disposal without leaking a subscription", async () => {
    const lifecycle = lifecycleFixture();
    lifecycle.subscribe.mockImplementation(listener => {
      lifecycle.publish({ visibility: "background" }); listener(); return lifecycle.remove;
    });
    const { downloads, createCache } = setup(undefined, lifecycle);
    await downloads.download("test"); expect(phase(downloads)).toBe("paused"); expect(createCache).not.toHaveBeenCalled();
    expect(lifecycle.remove).not.toHaveBeenCalled(); downloads.dispose(); expect(lifecycle.remove).toHaveBeenCalledOnce();
    lifecycle.subscribe.mockImplementation(() => { throw new Error("unavailable"); });
    const unavailable = setup(undefined, lifecycle); await unavailable.downloads.download("test");
    expect(phase(unavailable.downloads)).toBe("unavailable"); unavailable.downloads.dispose(); expect(createCache).not.toHaveBeenCalled();
  });
  it("rechecks persisted bytes after controller recreation and does not download valid saved bytes again", async () => {
    const { downloads, cache } = setup(); cache.read.mockResolvedValue(saved);
    await downloads.download("test"); expect(phase(downloads)).toBe("saved"); expect(cache.download).not.toHaveBeenCalled();
    const recreated = createContentDownloads({ descriptors: [descriptor()], createCache: () => cache, fetch: vi.fn() });
    expect(phase(recreated)).toBe("unchecked"); await recreated.check("test"); expect(phase(recreated)).toBe("saved");
  });
  it("passes the independently observed prior pin and leaves selection changes to verified storage", async () => {
    const old = contentPackageFixture(), input = descriptor(contentPackageFixture(2));
    input.previous = { expected: old.expected, manifestSha256: old.manifestSha256 };
    const { downloads, cache } = setup(input);
    cache.read.mockResolvedValueOnce(missing).mockResolvedValueOnce({ ...saved, manifestSha256: old.manifestSha256 });
    await downloads.download("test"); expect(cache.download.mock.calls[0][0].expectedCurrentManifestSha256).toBe(old.manifestSha256);
  });
  it("retries verification failures without marking a rejected package saved", async () => {
    const { downloads, cache } = setup(); cache.download.mockResolvedValueOnce({ ...missing, reason: "bad-hash" });
    await downloads.download("test"); expect(phase(downloads)).toBe("error");
    await downloads.download("test"); expect(phase(downloads)).toBe("saved"); expect(cache.download).toHaveBeenCalledTimes(2);
  });
  it("supports synchronous cancellation from the first observer without starting storage", async () => {
    const { downloads, createCache } = setup();
    downloads.subscribe(() => { if (phase(downloads) === "checking") downloads.cancel("test"); });
    await downloads.download("test"); expect(phase(downloads)).toBe("cancelled"); expect(createCache).not.toHaveBeenCalled();
  });
  it("contains observer failures, copies configuration before async work, and aborts on host disposal", async () => {
    const input = descriptor(), { downloads, cache } = setup(input), wait = deferred();
    input.title.en = "Mutated"; input.expected.sourceCommit = "0".repeat(40);
    expect(downloads.getSnapshot().items[0].title.en).toBe("Test package");
    downloads.subscribe(() => { throw new Error("broken observer"); }); cache.download.mockImplementation(() => wait.promise);
    const pending = downloads.download("test"); await vi.waitFor(() => expect(cache.download).toHaveBeenCalledOnce());
    expect(cache.download.mock.calls[0][0].expected.sourceCommit).toBe("a".repeat(40));
    downloads.dispose(); const before = downloads.getSnapshot(); wait.resolve(saved); await pending;
    expect(cache.download.mock.calls[0][0].signal.aborted).toBe(true); expect(downloads.getSnapshot()).toBe(before);
  });
  it.each(["child", "pin", "duplicate", "empty-title", "url"])("rejects unsafe trusted configuration: %s", reason => {
    const input = descriptor(reason === "child" ? contentPackageFixture(1, "child") : undefined);
    if (reason === "pin") input.manifestSha256 = "0".repeat(64);
    if (reason === "empty-title") input.title.en = " ";
    if (reason === "url") input.baseUrl = "http://packages.test/";
    expect(() => createContentDownloads({ descriptors: reason === "duplicate" ? [input, input] : [input], createCache: null, fetch: null })).toThrow();
  });
  it("keeps production catalog and trust empty, does not call unavailable native bridges, and never falls back from an explicitly null host", async () => {
    expect(contentDownloadCatalog).toEqual([]); expect(contentDownloadTrust).toEqual([]);
    const web = createWebContentDownloads(null, { descriptors: [descriptor()], trustedKeys: contentPackageFixture().trustedKeys });
    expect(web.getSnapshot().available).toBe(false); await web.check("test"); expect(phase(web)).toBe("unavailable");
    const native = createNativeContentDownloads(null, { descriptors: [descriptor()], trustedKeys: contentPackageFixture().trustedKeys });
    expect(native.getSnapshot().available).toBe(false); await native.download("test"); expect(phase(native)).toBe("unavailable");
    expect(createWebPlatformAdapter({ window: null }).downloads.getSnapshot().items).toEqual([]);
    expect(createWebPlatformAdapter({ window: null, downloads: web }).downloads).toBe(web);
  });
});
