import { describe, expect, it } from "vitest";
import { createContentPackageCache } from "./contentPackageCache";
import { contentPackageFixture } from "../../tests/support/content-package-fixtures.mjs";

const origin = "https://content.test";
const selectionUrl = origin + "/__literary_content_qa__/selection.json";
const fileUrl = path => origin + "/__literary_content_qa__/files/" + path;
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

// Fault-injectable cache double. The separate Chrome test uses actual CacheStorage
// and Web Locks; these cases exercise failures that cannot be requested from an OS.
class MemoryCacheStorage {
  rows = new Map(); writes = []; beforePut = async () => {}; afterPut = async () => {};
  async keys() { return [...this.rows.keys()]; }
  async delete(name) { return this.rows.delete(name); }
  async open(name) {
    if (!this.rows.has(name)) this.rows.set(name, new Map());
    return { put: async (url, response) => {
      const event = { name, url: String(url), response };
      this.writes.push({ name, url: String(url) });
      await this.beforePut(event);
      if (!this.rows.has(name)) throw new Error("cache-evicted");
      this.rows.get(name).set(String(url), response.clone());
      await this.afterPut(event);
    } };
  }
  async match(url, options) { return this.rows.get(options.cacheName)?.get(String(url))?.clone(); }
  async selected() {
    for (const rows of this.rows.values()) if (rows.has(selectionUrl)) return rows.get(selectionUrl).clone().json();
    return null;
  }
  generation(hash) { return [...this.rows.keys()].find(name => name.endsWith("-" + hash)); }
}
class SerialLocks {
  tails = new Map(); active = 0; maxActive = 0; requests = 0;
  request(name, options, callback) {
    this.requests++;
    const pending = (this.tails.get(name) ?? Promise.resolve()).then(async () => {
      if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
      this.maxActive = Math.max(this.maxActive, ++this.active);
      try { return await callback({ name, mode: "exclusive" }); } finally { this.active--; }
    });
    this.tails.set(name, pending.catch(() => {}));
    return pending;
  }
}
function setup(options = {}) {
  const f = contentPackageFixture(), storage = new MemoryCacheStorage(), locks = new SerialLocks();
  const config = { allowLocalQa: true, origin, trustedKeys: f.trustedKeys, subtle: f.subtle, caches: storage, locks, ...options };
  return { storage, locks, cache: createContentPackageCache(config), another: () => createContentPackageCache(config) };
}
const save = (cache, fixture, prior = null, signal) => cache.save({ ...fixture, expectedCurrentManifestSha256: prior, signal });
const read = (cache, fixture) => cache.read({ expected: fixture.expected, manifestSha256: fixture.manifestSha256 });
const assertBytes = (result, fixture) => {
  expect(result).toMatchObject({ ok: true, manifestSha256: fixture.manifestSha256, activationAllowed: false, releaseReady: false });
  expect(result.files.map(file => [file.path, new TextDecoder().decode(file.bytes)]).sort()).toEqual(fixture.files.map(file => [file.path, file.bytes]).sort());
};

describe("signed candidate byte cache", () => {
  it("commits both locales together, retains the previous package and returns independent byte copies", async () => {
    const { cache, another, storage } = setup(), v1 = contentPackageFixture(), v2 = contentPackageFixture(2);
    expect(await save(cache, v1)).toMatchObject({ ok: true, previousManifestSha256: null, persistence: "best-effort", activationAllowed: false });
    expect(await save(another(), v2, v1.manifestSha256)).toMatchObject({ ok: true, previousManifestSha256: v1.manifestSha256 });
    expect(await storage.selected()).toEqual({ schemaVersion: 1, current: { sha256: v2.manifestSha256, version: 2 }, previous: { sha256: v1.manifestSha256, version: 1 } });
    const current = await read(cache, v2); assertBytes(current, v2); current.files[0].bytes.fill(0);
    assertBytes(await read(another(), v2), v2);
    assertBytes(await read(another(), v1), v1);
  });

  it.each(["data", "manifest-pin", "prior-pin", "missing-prior-pin", "older-version"])("preserves the selected package after invalid %s", async failure => {
    const { cache, storage } = setup(), current = contentPackageFixture(2), candidate = contentPackageFixture(failure === "older-version" ? 1 : 3);
    await save(cache, current); const writes = storage.writes.length;
    if (failure === "data") candidate.files[1].bytes = candidate.files[1].bytes.replace("Test", "Fake");
    if (failure === "manifest-pin") candidate.manifestSha256 = "c".repeat(64);
    const prior = failure === "prior-pin" ? "d".repeat(64) : failure === "missing-prior-pin" ? undefined : current.manifestSha256;
    expect(await cache.save({ ...candidate, expectedCurrentManifestSha256: prior })).toMatchObject({ ok: false, activationAllowed: false });
    expect(storage.writes).toHaveLength(writes);
    assertBytes(await read(cache, current), current);
  });

  it.each(["file quota", "signature write", "completion write", "selection write", "readback corruption", "generation eviction"])
  ("keeps the old selection on %s and can retry the same exact candidate", async failure => {
    const { cache, storage } = setup(), v1 = contentPackageFixture(), v2 = contentPackageFixture(2);
    await save(cache, v1);
    storage.beforePut = async event => {
      const target = failure === "file quota" ? "/files/en/catalog.json" : failure === "signature write" ? "/signature.json"
        : failure === "completion write" ? "/complete.json" : failure === "selection write" ? "/selection.json" : null;
      if (target && event.url.endsWith(target)) throw new DOMException("quota-fixture", "QuotaExceededError");
    };
    storage.afterPut = async event => {
      if (event.name.endsWith(v2.manifestSha256) && event.url.endsWith("/signature.json")) {
        if (failure === "readback corruption") storage.rows.get(event.name).set(fileUrl("en/catalog.json"), new Response("{}"));
        if (failure === "generation eviction") storage.rows.delete(event.name);
      }
    };
    expect(await save(cache, v2, v1.manifestSha256)).toMatchObject({ ok: false, activationAllowed: false });
    expect((await storage.selected()).current.sha256).toBe(v1.manifestSha256);
    assertBytes(await read(cache, v1), v1);
    expect(await read(cache, v2)).toMatchObject({ ok: false, reason: "content-generation-not-selected" });
    storage.beforePut = async () => {}; storage.afterPut = async () => {};
    expect(await save(cache, v2, v1.manifestSha256)).toMatchObject({ ok: true });
    assertBytes(await read(cache, v2), v2); assertBytes(await read(cache, v1), v1);
  });

  it("holds the cross-instance lock through an outstanding cancelled write and lets the waiting candidate commit afterward", async () => {
    const { cache, another, storage, locks } = setup(), v1 = contentPackageFixture(), v2 = contentPackageFixture(2), v3 = contentPackageFixture(3);
    await save(cache, v1);
    const controller = new AbortController(), entered = deferred(), release = deferred();
    storage.beforePut = async event => {
      if (event.name.endsWith(v2.manifestSha256) && event.url.endsWith("/files/ru/catalog.json")) { entered.resolve(); await release.promise; }
    };
    const first = save(cache, v2, v1.manifestSha256, controller.signal);
    await entered.promise;
    const waiting = save(another(), v3, v1.manifestSha256);
    controller.abort();
    expect(locks.active).toBe(1);
    expect((await storage.selected()).current.sha256).toBe(v1.manifestSha256);
    release.resolve();
    expect(await first).toMatchObject({ ok: false, reason: "cancelled" });
    expect(await waiting).toMatchObject({ ok: true, previousManifestSha256: v1.manifestSha256 });
    expect(locks.maxActive).toBe(1);
    assertBytes(await read(cache, v3), v3); assertBytes(await read(cache, v1), v1);
  });

  it("reports a durable commit truthfully if cancellation arrives during the final pointer write", async () => {
    const { cache, storage } = setup(), f = contentPackageFixture(), controller = new AbortController();
    storage.beforePut = async event => { if (event.url === selectionUrl) controller.abort(); };
    expect(await save(cache, f, null, controller.signal)).toMatchObject({ ok: true, activationAllowed: false });
    assertBytes(await read(cache, f), f);
  });

  it("serializes competing replacements: only one can consume the previous receipt", async () => {
    const { cache, another, storage, locks } = setup(), v1 = contentPackageFixture(), candidates = [contentPackageFixture(2), contentPackageFixture(3)];
    await save(cache, v1);
    const outcomes = await Promise.all(candidates.map((f, index) => save(index ? another() : cache, f, v1.manifestSha256)));
    expect(outcomes.filter(result => result.ok)).toHaveLength(1);
    expect(outcomes.find(result => !result.ok)).toMatchObject({ reason: "content-generation-conflict" });
    const selected = await storage.selected(), winner = candidates.find(f => f.manifestSha256 === selected.current.sha256);
    assertBytes(await read(cache, winner), winner); assertBytes(await read(cache, v1), v1);
    expect(locks.maxActive).toBe(1);
  });

  it("does not rewrite a verified repeated import, but can repair exactly its damaged selected generation", async () => {
    const { cache, storage } = setup(), f = contentPackageFixture();
    await save(cache, f); const writes = storage.writes.length;
    expect(await save(cache, f)).toMatchObject({ ok: true });
    expect(storage.writes).toHaveLength(writes);
    storage.rows.get(storage.generation(f.manifestSha256)).set(fileUrl("en/catalog.json"), new Response("{}"));
    expect(await read(cache, f)).toMatchObject({ ok: false });
    expect(await save(cache, f)).toMatchObject({ ok: true });
    assertBytes(await read(cache, f), f);
  });

  it.each(["bytes", "missing", "signature", "marker", "selection", "oversize"])("refuses damaged cached %s on a fresh read", async failure => {
    const { cache, another, storage } = setup(), f = contentPackageFixture();
    await save(cache, f);
    const rows = storage.rows.get(storage.generation(f.manifestSha256));
    if (failure === "bytes") rows.set(fileUrl("en/catalog.json"), new Response(f.files[1].bytes.replace("Test", "Fake")));
    if (failure === "missing") rows.delete(fileUrl("en/catalog.json"));
    if (failure === "signature") rows.set(origin + "/__literary_content_qa__/signature.json", new Response("{}"));
    if (failure === "marker") rows.delete(origin + "/__literary_content_qa__/complete.json");
    if (failure === "oversize") rows.set(fileUrl("en/catalog.json"), new Response("x".repeat(f.files[1].bytes.length + 1)));
    if (failure === "selection") for (const item of storage.rows.values()) if (item.has(selectionUrl)) item.set(selectionUrl, new Response('{"schemaVersion":1,"schemaVersion":1}'));
    expect(await read(another(), f)).toMatchObject({ ok: false, activationAllowed: false });
  });

  it("keeps namespace and exact child policy separate without granting child activation", async () => {
    const { cache } = setup(), adult = contentPackageFixture(), child = contentPackageFixture(1, "child");
    await save(cache, adult);
    expect(await read(cache, child)).toMatchObject({ ok: false });
    expect(await save(cache, child)).toMatchObject({ ok: true, activationAllowed: false });
    assertBytes(await read(cache, adult), adult); assertBytes(await read(cache, child), child);
    child.expected.childPolicy.version = "2";
    expect(await read(cache, child)).toMatchObject({ ok: false });
  });

  it.each(["caches", "locks"])("reports unavailable %s instead of claiming a memory-only save", async capability => {
    const { cache, storage } = setup({ [capability]: null }), f = contentPackageFixture();
    expect(await save(cache, f)).toMatchObject({ ok: false, reason: "content-cache-unavailable" });
    expect(await read(cache, f)).toMatchObject({ ok: false, reason: "content-cache-unavailable" });
    expect(storage.writes).toHaveLength(0);
  });

  it("prunes only its unselected generations and preserves other application caches", async () => {
    const { cache, storage } = setup(), versions = [1, 2, 3, 4].map(version => contentPackageFixture(version));
    await storage.open("pwa-core-complete");
    await save(cache, versions[0]);
    const scope = storage.generation(versions[0].manifestSha256).slice(0, -65);
    await storage.open(scope + "-foreign-cache");
    await storage.open(scope + "-" + "e".repeat(64)); // Own interrupted orphan.
    for (let i = 1; i < versions.length; i++) expect(await save(cache, versions[i], versions[i - 1].manifestSha256)).toMatchObject({ ok: true });
    expect(await storage.keys()).toEqual(expect.arrayContaining(["pwa-core-complete", scope + "-foreign-cache", scope]));
    expect((await storage.keys()).filter(name => name.startsWith(scope + "-") && /^[a-f0-9]{64}$/u.test(name.slice(scope.length + 1))))
      .toHaveLength(2);
    expect(await read(cache, versions[0])).toMatchObject({ ok: false, reason: "content-generation-not-selected" });
    assertBytes(await read(cache, versions[2]), versions[2]); assertBytes(await read(cache, versions[3]), versions[3]);
  });

  it("snapshots caller-owned bytes and expected context before asynchronous writes", async () => {
    const { cache, storage } = setup(), f = contentPackageFixture(), original = contentPackageFixture();
    const entered = deferred(), release = deferred();
    storage.beforePut = async event => { if (event.url.endsWith("/files/ru/catalog.json")) { entered.resolve(); await release.promise; } };
    const pending = save(cache, f);
    await entered.promise;
    f.files[1].bytes = "changed"; f.expected.version = 99; f.envelope.manifest.version = 99;
    release.resolve();
    expect(await pending).toMatchObject({ ok: true });
    assertBytes(await read(cache, original), original);
  });
});
