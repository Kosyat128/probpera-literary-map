import { describe, it, expect, vi } from "vitest";
import { createNativeContentStorage, createNativeContentLocks, NATIVE_CONTENT_ORIGIN } from "./nativeContentStorage";
import { createContentPackageCache } from "../planet/contentPackageCache";
import { contentPackageHash } from "../planet/contentPackageProtocol.mjs";
import { contentPackageFixture } from "../../tests/support/content-package-fixtures.mjs";

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
// Byte bridge double: assertions below test the shared verifier's native port,
// not installed Android/iOS filesystem behavior or crash durability.
function bridgeFixture() {
  const rows = new Map(), address = (name, key) => name + ":" + key;
  const bridge = {
    async read({ name, key }) { return { base64: rows.get(address(name, key)) ?? null }; },
    async write({ name, key, base64 }) { rows.set(address(name, key), base64); },
    async list() { return { names: [...new Set([...rows.keys()].map(value => value.split(":")[0]))] }; },
    async remove({ name }) { for (const id of rows.keys()) if (id.startsWith(name + ":")) rows.delete(id); return { removed: true }; },
    commit: vi.fn(async input => {
      const old = rows.get(address(input.name, input.key)), bytes = old ? Buffer.from(old, "base64") : null;
      if ((bytes ? contentPackageHash(bytes) : null) !== input.expectedSha256) return { committed: false };
      for (const entry of input.candidate.entries) {
        const stored = rows.get(address(input.candidate.name, entry.key));
        if (!stored) throw new Error("candidate removed before CAS");
        const bytes = Buffer.from(stored, "base64");
        if (bytes.length !== entry.bytes || contentPackageHash(bytes) !== entry.sha256) throw new Error("candidate changed before CAS");
      }
      rows.set(address(input.name, input.key), Buffer.from(input.json).toString("base64"));
      return { committed: true };
    }),
  };
  return { bridge, rows };
}
const path = NATIVE_CONTENT_ORIGIN + "/__literary_content_qa__/files/en/catalog.json";
const name = "literary-planet-content-qa-v1-" + "a".repeat(64) + "-" + "b".repeat(64);

describe("native content storage port", () => {
  it("round trips a multi-megabyte file without argument or regex stack overflow", async () => {
    const { bridge } = bridgeFixture(), storage = createNativeContentStorage(bridge);
    const bytes = new Uint8Array(3 * 1024 * 1024 + 1); for (let i = 0; i < bytes.length; i++) bytes[i] = i % 251;
    const file = await storage.open(name); await file.put(path, new Response(bytes));
    const read = new Uint8Array(await (await storage.match(path, { cacheName: name })).arrayBuffer());
    expect(read.byteLength).toBe(bytes.byteLength); expect(contentPackageHash(read)).toBe(contentPackageHash(bytes));
    expect(await storage.match(path + "missing", { cacheName: name })).toBeUndefined();
  });
  it("rejects arbitrary names/URLs, direct selection writes and oversized native responses", async () => {
    const { bridge } = bridgeFixture(), storage = createNativeContentStorage(bridge);
    await expect(storage.open("../other-app")).rejects.toThrow();
    const file = await storage.open(name); await expect(file.put("file:///data", new Response("{}"))).rejects.toThrow();
    const index = await storage.open(name.slice(0, -65)); await expect(index.put(path, new Response("{}"))).rejects.toThrow();
    await expect(storage.delete(name.slice(0, -65))).rejects.toThrow();
    bridge.read = async () => ({ base64: "!invalid!" });
    await expect(storage.match(path, { cacheName: name })).rejects.toThrow();
  });
  it("sends complete signed byte receipts into native CAS and preserves both pinned versions across port recreation", async () => {
    const { bridge } = bridgeFixture(), f = contentPackageFixture(), f2 = contentPackageFixture(2);
    const create = () => createContentPackageCache({ allowLocalQa: true, origin: NATIVE_CONTENT_ORIGIN,
      trustedKeys: f.trustedKeys, subtle: f.subtle, caches: createNativeContentStorage(bridge), locks: createNativeContentLocks() });
    expect(await create().save({ ...f, expectedCurrentManifestSha256: null })).toMatchObject({ ok: true, activationAllowed: false });
    const first = bridge.commit.mock.calls[0][0];
    expect(first.candidate.entries).toHaveLength(f.files.length + 2); expect(first.expectedSha256).toBeNull();
    expect(first.candidate.entries.map(entry => entry.bytes).sort((a, b) => a - b)).toEqual(expect.arrayContaining(f.envelope.manifest.files.map(file => file.bytes)));
    expect(await create().save({ ...f2, expectedCurrentManifestSha256: f.manifestSha256 })).toMatchObject({ ok: true });
    for (const fixture of [f, f2]) expect(await create().read(fixture)).toMatchObject({ ok: true, activationAllowed: false, releaseReady: false, manifestSha256: fixture.manifestSha256 });
  });
  it.each(["conflict", "candidate-changed"])("retains the previous generation on native %s after JS verification", async reason => {
    const { bridge, rows } = bridgeFixture(), f = contentPackageFixture(), next = contentPackageFixture(2);
    const cache = createContentPackageCache({ allowLocalQa: true, origin: NATIVE_CONTENT_ORIGIN,
      trustedKeys: f.trustedKeys, subtle: f.subtle, caches: createNativeContentStorage(bridge), locks: createNativeContentLocks() });
    expect((await cache.save({ ...f, expectedCurrentManifestSha256: null })).ok).toBe(true);
    const commit = bridge.commit.getMockImplementation();
    bridge.commit.mockImplementationOnce(async input => {
      if (reason === "conflict") return { committed: false };
      rows.delete(input.candidate.name + ":" + input.candidate.entries[0].key);
      return commit(input);
    });
    expect(await cache.save({ ...next, expectedCurrentManifestSha256: f.manifestSha256 })).toMatchObject({ ok: false, activationAllowed: false });
    expect((await cache.read(f)).ok).toBe(true); expect((await cache.read(next)).ok).toBe(false);
  });
  it("holds same-host locks until outstanding IO settles and cancels queued jobs promptly", async () => {
    const locks = createNativeContentLocks(), entered = deferred(), release = deferred(), controller = new AbortController();
    const first = locks.request("scope", { mode: "exclusive" }, async () => { entered.resolve(); await release.promise; });
    await entered.promise;
    const cancelledOperation = vi.fn(), second = locks.request("scope", { mode: "exclusive", signal: controller.signal }, cancelledOperation);
    controller.abort(); await expect(second).rejects.toThrow("cancelled"); expect(cancelledOperation).not.toHaveBeenCalled();
    const nextOperation = vi.fn(async () => "done"), third = locks.request("scope", { mode: "exclusive" }, nextOperation);
    await Promise.resolve(); expect(nextOperation).not.toHaveBeenCalled(); release.resolve();
    await first; expect(await third).toBe("done"); expect(cancelledOperation).not.toHaveBeenCalled();
  });
});
