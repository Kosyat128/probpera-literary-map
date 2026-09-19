import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createContentPackageCache } from "./contentPackageCache";
import { contentPackageCanonicalJson, contentPackageHash } from "./contentPackageProtocol.mjs";
import { prepareContentPackageManifest, signContentPackageManifest } from "../../scripts/mobile/content-package-signature.mjs";
import { contentPackageFixture } from "../../tests/support/content-package-fixtures.mjs";

const origin = "https://content.test";
const selectionUrl = origin + "/__literary_content_qa__/selection.json";
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const pin = fixture => ({ expected: fixture.expected, manifestSha256: fixture.manifestSha256 });
const save = (cache, fixture, prior = null, signal) => cache.save({ ...fixture, expectedCurrentManifestSha256: prior, signal });
const read = (cache, fixture) => cache.read(pin(fixture));
const uninstall = (cache, fixture, receipt, signal) => cache.uninstall({ ...pin(fixture), selectionSha256: receipt.selectionSha256, signal });
const transport = fixture => vi.fn(async url => {
  const path = new URL(url).pathname.slice("/packages/v2/".length);
  const file = fixture.files.find(file => file.path === path);
  if (!file) throw new Error("unexpected-file");
  return new Response(file.bytes, { headers: { "Content-Type": "application/json" } });
});
const download = (cache, fixture, fetch, prior = null) => cache.download({ ...fixture,
  expectedCurrentManifestSha256: prior, baseUrl: origin + "/packages/v2/", fetch });

// The browser cases cover CacheStorage/Web Locks. This double permits precise
// pointer-write and deletion failures without depending on an OS quota race.
class MemoryCacheStorage {
  rows = new Map(); writes = []; deletions = [];
  beforePut = async () => {}; afterPut = async () => {}; beforeDelete = async () => {};
  async keys() { return [...this.rows.keys()]; }
  async delete(name) {
    await this.beforeDelete(name);
    this.deletions.push(name);
    return this.rows.delete(name);
  }
  async open(name) {
    if (!this.rows.has(name)) this.rows.set(name, new Map());
    return { put: async (url, response) => {
      const event = { name, url: String(url), response };
      await this.beforePut(event);
      if (!this.rows.has(name)) throw new Error("cache-evicted");
      this.writes.push({ name, url: String(url) });
      this.rows.get(name).set(String(url), response.clone());
      await this.afterPut(event);
    } };
  }
  async match(url, options) { return this.rows.get(options.cacheName)?.get(String(url))?.clone(); }
  generation(hash) { return [...this.rows.keys()].find(name => name.endsWith("-" + hash)); }
  async selected(name) { return this.rows.get(name)?.get(selectionUrl)?.clone().json() ?? null; }
}
class SerialLocks {
  tails = new Map();
  request(name, options, callback) {
    const pending = (this.tails.get(name) ?? Promise.resolve()).then(async () => {
      if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
      return callback({ name, mode: "exclusive" });
    });
    this.tails.set(name, pending.catch(() => {}));
    return pending;
  }
}
function setup(optional = [], options = {}) {
  const fixture = contentPackageFixture(), storage = new MemoryCacheStorage(), locks = new SerialLocks();
  const config = { allowLocalQa: true, origin, trustedKeys: fixture.trustedKeys, subtle: fixture.subtle,
    caches: storage, locks, optionalPackages: optional.map(pin), ...options };
  return { storage, cache: createContentPackageCache(config), another: extras => createContentPackageCache({ ...config, ...extras }) };
}
const scopeFor = (storage, fixture) => storage.generation(fixture.manifestSha256).slice(0, -65);
const assertSaved = (result, fixture) => {
  expect(result).toMatchObject({ ok: true, manifestSha256: fixture.manifestSha256, activationAllowed: false, releaseReady: false });
  expect(result.selectionSha256).toMatch(/^[a-f0-9]{64}$/u);
  expect(result.files.map(file => [file.path, new TextDecoder().decode(file.bytes)]).sort())
    .toEqual(fixture.files.map(file => [file.path, file.bytes]).sort());
};
function delayedVerification(subtle) {
  const entered = deferred(), release = deferred();
  return { entered, release, subtle: {
    importKey: (...args) => subtle.importKey(...args),
    verify: async (...args) => { entered.resolve(); await release.promise; return subtle.verify(...args); },
  } };
}

describe("confirmed optional package uninstall", () => {
  it("requires an independently trusted exact optional pin and preserves mandatory or neighbouring data", async () => {
    const adult = contentPackageFixture(), child = contentPackageFixture(1, "child");
    const { cache, another, storage } = setup([adult]);
    await save(cache, adult); await save(cache, child);
    await (await storage.open("literary-planet-bootstrap-v1")).put(origin + "/bootstrap", new Response("mandatory"));
    const current = await read(cache, adult), childCurrent = await read(cache, child), before = await storage.keys();
    const mandatory = another({ optionalPackages: [] });
    expect(await uninstall(mandatory, adult, current)).toMatchObject({ ok: false, activationAllowed: false });
    expect(await uninstall(cache, child, childCurrent)).toMatchObject({ ok: false, activationAllowed: false });
    expect(await cache.uninstall({ ...pin(adult), expected: { ...adult.expected, sourceCommit: "b".repeat(40) },
      selectionSha256: current.selectionSha256 })).toMatchObject({ ok: false });
    expect(await cache.uninstall({ ...pin(adult), manifestSha256: "c".repeat(64),
      selectionSha256: current.selectionSha256 })).toMatchObject({ ok: false });
    expect(await storage.keys()).toEqual(before);
    assertSaved(await read(cache, adult), adult); assertSaved(await read(cache, child), child);
  });

  it("retires current and rollback bytes together while retaining a version floor and unrelated caches", async () => {
    const v1 = contentPackageFixture(), v2 = contentPackageFixture(2), child = contentPackageFixture(1, "child");
    const { cache, another, storage } = setup([v2]);
    await save(cache, v1); const saved = await save(cache, v2, v1.manifestSha256); await save(cache, child);
    const scope = scopeFor(storage, v2), receipt = await read(cache, v2);
    expect(saved.selectionSha256).toBe(receipt.selectionSha256);
    expect(await storage.selected(scope)).toEqual({ schemaVersion: 1,
      current: { sha256: v2.manifestSha256, version: 2 }, previous: { sha256: v1.manifestSha256, version: 1 } });
    for (const name of ["literary-planet-bootstrap-v1", scope + "-foreign-cache", scope + "-" + "e".repeat(64)]) await storage.open(name);
    const result = await uninstall(cache, v2, receipt);
    expect(result).toMatchObject({ ok: true, cleanupComplete: true, activationAllowed: false });
    expect(result.selectionSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(result.selectionSha256).not.toBe(receipt.selectionSha256);
    const retired = await storage.selected(scope);
    expect(retired).toMatchObject({ schemaVersion: 2, retired: true, current: { sha256: v2.manifestSha256, version: 2 } });
    expect(Number.isSafeInteger(retired.epoch) && retired.epoch > 0).toBe(true);
    expect(Object.keys(retired).sort()).toEqual(["current", "epoch", "previous", "retired", "schemaVersion"]);
    expect(contentPackageHash(contentPackageCanonicalJson(retired))).toBe(result.selectionSha256);
    expect(await read(another(), v2)).toMatchObject({ ok: false, reason: "content-package-removed",
      selectionSha256: result.selectionSha256, cleanupComplete: true, activationAllowed: false });
    expect((await read(cache, v1)).ok).toBe(false);
    expect((await storage.keys()).sort()).toEqual([scope, scope + "-foreign-cache", "literary-planet-bootstrap-v1",
      scopeFor(storage, child), storage.generation(child.manifestSha256)].sort());
    assertSaved(await read(cache, child), child);
  });

  it("refuses stale confirmation after a higher version replaces the displayed package", async () => {
    const v1 = contentPackageFixture(), v2 = contentPackageFixture(2), { cache, storage } = setup([v1, v2]);
    await save(cache, v1); const stale = await read(cache, v1);
    await save(cache, v2, v1.manifestSha256); const current = await read(cache, v2), before = await storage.keys();
    expect(await uninstall(cache, v1, stale)).toMatchObject({ ok: false });
    expect(await uninstall(cache, v2, stale)).toMatchObject({ ok: false });
    expect(await storage.keys()).toEqual(before);
    assertSaved(await read(cache, v2), v2); assertSaved(await read(cache, v1), v1);
    expect(await uninstall(cache, v2, current)).toMatchObject({ ok: true, cleanupComplete: true });
  });

  it("keeps a durable retired state after cleanup failure and retries with the fresh receipt", async () => {
    const v1 = contentPackageFixture(), v2 = contentPackageFixture(2), { cache, another, storage } = setup([v2]);
    await save(cache, v1); await save(cache, v2, v1.manifestSha256); const before = await read(cache, v2);
    storage.beforeDelete = async () => { throw new Error("storage-busy"); };
    const removed = await uninstall(cache, v2, before);
    expect(removed).toMatchObject({ ok: true, cleanupComplete: false });
    const retired = await read(another(), v2);
    expect(retired).toMatchObject({ ok: false, reason: "content-package-removed", cleanupComplete: false,
      selectionSha256: removed.selectionSha256 });
    expect(storage.generation(v2.manifestSha256)).toBeTruthy();
    expect(await uninstall(cache, v2, before)).toMatchObject({ ok: false });
    storage.beforeDelete = async () => {};
    expect(await uninstall(another(), v2, retired)).toMatchObject({ ok: true, cleanupComplete: true,
      selectionSha256: removed.selectionSha256 });
    expect(storage.generation(v1.manifestSha256)).toBeUndefined();
    expect(storage.generation(v2.manifestSha256)).toBeUndefined();
    expect(await uninstall(cache, v2, retired)).toMatchObject({ ok: true, cleanupComplete: true });
  });

  it("does not claim complete cleanup when storage refuses deletion without throwing", async () => {
    const f = contentPackageFixture(), { cache, storage } = setup([f]);
    await save(cache, f); const receipt = await read(cache, f);
    storage.delete = vi.fn(async () => false);
    expect(await uninstall(cache, f, receipt)).toMatchObject({ ok: true, cleanupComplete: false });
    expect(await read(cache, f)).toMatchObject({ ok: false, reason: "content-package-removed", cleanupComplete: false });
  });

  it("preserves active bytes if cancelled before retirement or if its pointer cannot be written", async () => {
    const f = contentPackageFixture(), { cache, storage } = setup([f]);
    await save(cache, f); const receipt = await read(cache, f), before = await storage.keys();
    const controller = new AbortController(); controller.abort();
    expect(await uninstall(cache, f, receipt, controller.signal)).toMatchObject({ ok: false, reason: "cancelled" });
    storage.beforePut = async event => { if (event.url === selectionUrl) throw new DOMException("quota", "QuotaExceededError"); };
    expect(await uninstall(cache, f, receipt)).toMatchObject({ ok: false });
    expect(await storage.keys()).toEqual(before);
    expect((await read(cache, f)).selectionSha256).toBe(receipt.selectionSha256);
    assertSaved(await read(cache, f), f);
  });

  it("reports retirement truthfully if cancelled at the committed pointer write, then permits cleanup retry", async () => {
    const f = contentPackageFixture(), { cache, storage } = setup([f]), controller = new AbortController();
    await save(cache, f); const receipt = await read(cache, f);
    storage.afterPut = async event => { if (event.url === selectionUrl) controller.abort(); };
    const removed = await uninstall(cache, f, receipt, controller.signal);
    expect(removed).toMatchObject({ ok: true, cleanupComplete: false });
    expect(await read(cache, f)).toMatchObject({ ok: false, reason: "content-package-removed",
      selectionSha256: removed.selectionSha256 });
    storage.afterPut = async () => {};
    expect(await uninstall(cache, f, removed)).toMatchObject({ ok: true, cleanupComplete: true });
  });

  it("recovers an exact committed retirement when its write response is lost", async () => {
    const f = contentPackageFixture(), { cache, storage } = setup([f]);
    await save(cache, f); const confirmed = await read(cache, f);
    storage.afterPut = async event => { if (event.url === selectionUrl) throw new Error("write response lost"); };
    const result = await uninstall(cache, f, confirmed);
    expect(result).toMatchObject({ ok: true, cleanupComplete: true });
    expect(await read(cache, f)).toMatchObject({ ok: false, reason: "content-package-removed", selectionSha256: result.selectionSha256 });
  });

  it("cannot uninstall through malformed selection metadata or a missing exact confirmation hash", async () => {
    const f = contentPackageFixture(), { cache, storage } = setup([f]);
    await save(cache, f); const receipt = await read(cache, f), scope = scopeFor(storage, f), before = await storage.keys();
    for (const hash of [undefined, null, "../selection", "a".repeat(64)]) {
      expect(await uninstall(cache, f, { selectionSha256: hash })).toMatchObject({ ok: false });
    }
    storage.rows.get(scope).set(selectionUrl, new Response('{"schemaVersion":2,"epoch":0,"retired":true}'));
    expect(await uninstall(cache, f, receipt)).toMatchObject({ ok: false });
    expect(await storage.keys()).toEqual(before);
  });

  it("permits an explicit same-version reinstall without making an old confirmation valid again", async () => {
    const f = contentPackageFixture(), { cache, storage } = setup([f]);
    await save(cache, f); const original = await read(cache, f), scope = scopeFor(storage, f);
    const retired = await uninstall(cache, f, original);
    expect(await save(cache, f)).toMatchObject({ ok: true, previousManifestSha256: null });
    const reinstalled = await read(cache, f); assertSaved(reinstalled, f);
    expect(reinstalled.selectionSha256).not.toBe(original.selectionSha256);
    expect(reinstalled.selectionSha256).not.toBe(retired.selectionSha256);
    expect(await storage.selected(scope)).toMatchObject({ schemaVersion: 2, retired: false });
    expect(await uninstall(cache, f, original)).toMatchObject({ ok: false });
    expect(await uninstall(cache, f, retired)).toMatchObject({ ok: false });
    expect(await uninstall(cache, f, reinstalled)).toMatchObject({ ok: true, cleanupComplete: true });
  });

  it("preserves the version floor after uninstall, while allowing a newer explicit download", async () => {
    const v1 = contentPackageFixture(), v2 = contentPackageFixture(2), v3 = contentPackageFixture(3);
    const { cache, storage } = setup([v2, v3]);
    await save(cache, v2); const selected = await read(cache, v2);
    const retired = await uninstall(cache, v2, selected), oldFetch = transport(v1);
    expect(await save(cache, v1)).toMatchObject({ ok: false });
    expect(await download(cache, v1, oldFetch)).toMatchObject({ ok: false });
    expect(oldFetch).not.toHaveBeenCalled();
    expect(await read(cache, v2)).toMatchObject({ ok: false, reason: "content-package-removed", selectionSha256: retired.selectionSha256 });
    const fetch = transport(v3), saved = await download(cache, v3, fetch);
    expect(saved).toMatchObject({ ok: true, previousManifestSha256: null });
    expect(saved.selectionSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(fetch).toHaveBeenCalledTimes(3);
    assertSaved(await read(cache, v3), v3);
    expect(storage.generation(v2.manifestSha256)).toBeUndefined();
  });

  it("rejects a differently signed same-version replacement of the retained version floor", async () => {
    const original = contentPackageFixture(2), key = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const files = original.files.map((file, index) => ({ ...file, bytes: file.bytes + (index === 0 ? " " : "") }));
    const manifest = prepareContentPackageManifest({ ...original.envelope.manifest, files });
    const keyId = "content-qa-alternate-fixture", envelope = signContentPackageManifest({ manifest, keyId, privateKey: key.privateKey });
    const replacement = { ...original, files, envelope, manifestSha256: contentPackageHash(contentPackageCanonicalJson(manifest)) };
    const trustedKeys = [...original.trustedKeys, { keyId, purpose: manifest.purpose, environment: manifest.environment,
      jwk: key.publicKey.export({ format: "jwk" }) }];
    const { cache } = setup([original, replacement], { trustedKeys });
    await save(cache, original); const retired = await uninstall(cache, original, await read(cache, original));
    expect(await save(cache, replacement)).toMatchObject({ ok: false });
    expect(await read(cache, original)).toMatchObject({ ok: false, reason: "content-package-removed", selectionSha256: retired.selectionSha256 });
    expect(await save(cache, original)).toMatchObject({ ok: true });
    assertSaved(await read(cache, original), original);
  });

  it.each(["save", "download"])("does not resurrect removed bytes when an earlier %s finishes authentication late", async operation => {
    const f = contentPackageFixture(), { cache, another, storage } = setup([f]);
    await save(cache, f); const receipt = await read(cache, f), delay = delayedVerification(f.subtle);
    const pendingCache = another({ subtle: delay.subtle }), fetch = transport(f);
    const pending = operation === "save" ? save(pendingCache, f) : download(pendingCache, f, fetch);
    await delay.entered.promise;
    const retired = await uninstall(cache, f, receipt);
    expect(retired).toMatchObject({ ok: true, cleanupComplete: true });
    delay.release.resolve();
    expect(await pending).toMatchObject({ ok: false });
    expect(fetch).not.toHaveBeenCalled();
    expect(storage.generation(f.manifestSha256)).toBeUndefined();
    expect(await read(cache, f)).toMatchObject({ ok: false, reason: "content-package-removed", selectionSha256: retired.selectionSha256 });
  });

  it("does not let a late network response write or prune an explicitly reinstalled newer package", async () => {
    const v1 = contentPackageFixture(), v2 = contentPackageFixture(2), v3 = contentPackageFixture(3);
    const { cache, another, storage } = setup([v1, v3]), entered = deferred(), release = deferred(), real = transport(v2);
    await save(cache, v1); const receipt = await read(cache, v1);
    const fetch = vi.fn(async url => { entered.resolve(); await release.promise; return real(url); });
    const pending = download(another(), v2, fetch, v1.manifestSha256);
    await entered.promise;
    expect(await uninstall(cache, v1, receipt)).toMatchObject({ ok: true, cleanupComplete: true });
    expect(await save(cache, v3)).toMatchObject({ ok: true });
    const saved = await read(cache, v3), names = await storage.keys(), writes = storage.writes.length;
    release.resolve();
    expect(await pending).toMatchObject({ ok: false });
    expect(storage.writes).toHaveLength(writes);
    expect(await storage.keys()).toEqual(names);
    expect((await read(cache, v3)).selectionSha256).toBe(saved.selectionSha256);
    assertSaved(await read(cache, v3), v3);
  });
});
