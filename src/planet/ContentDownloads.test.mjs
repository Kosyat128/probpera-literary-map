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
function setup(input = descriptor()) {
  const cache = { read: vi.fn(async () => missing), download: vi.fn(async () => saved) };
  const createCache = vi.fn(() => cache), fetch = vi.fn();
  return { cache, createCache, fetch, downloads: createContentDownloads({ descriptors: [input], createCache, fetch }) };
}
const phase = downloads => downloads.getSnapshot().items[0].phase;

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
