import { createHash, webcrypto } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { installPwaWorker, normalizePwaWorkerConfig } from "./serviceWorkerRuntime.js";
import { PWA_BOOTSTRAP_MAX_MARKER_BYTES as MAX_MARKER_BYTES } from "./pwaBootstrapBudgets.ts";

const ORIGIN = "https://probpera.ru";
const PREFIX = "literary-planet-pwa-v1-";
const MARKER = ORIGIN + "/planet/__pwa_complete__";
const CANDIDATE = ORIGIN + "/planet/__pwa_candidate__";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const absolute = (input) => new URL(typeof input === "string" ? input : input.url, ORIGIN).href;

function memoryCaches() {
  const stores = new Map();
  const cacheStorage = {
    stores,
    putFailure: undefined,
    keys: vi.fn(async () => [...stores.keys()]),
    delete: vi.fn(async (name) => stores.delete(name)),
    match: vi.fn(async (request, options) => stores.get(options.cacheName)?.match(request)),
    open: vi.fn(async (name) => {
      if (!stores.has(name)) {
        const entries = new Map();
        stores.set(name, {
          entries,
          match: vi.fn(async (request) => entries.get(absolute(request))?.clone()),
          keys: vi.fn(async () => [...entries.keys()].map((url) => new Request(url))),
          delete: vi.fn(async (request) => entries.delete(absolute(request))),
          put: vi.fn(async (request, response) => {
            if (cacheStorage.putFailure?.(name, absolute(request))) throw new Error("Quota exceeded");
            entries.set(absolute(request), response.clone());
          }),
        });
      }
      return stores.get(name);
    }),
  };
  return cacheStorage;
}
function shell(build = "a", includeRoot = false) {
  const bodies = new Map([
    ["/planet/ru/", `<html lang="ru"><body>RU ${build}</body></html>`],
    ["/planet/en/", `<html lang="en"><body>EN ${build}</body></html>`],
    [`/planet/assets/app-${build}.js`, `export const build = "${build}";`],
    ["/planet/textures/antique-world.webp", `texture bytes ${build}`],
  ]);
  if (includeRoot) bodies.set("/planet/", `<html><body>NEUTRAL ${build}</body></html>`);
  return {
    bodies,
    config: {
      schemaVersion: 1,
      scopePath: "/planet/",
      buildId: build.repeat(64),
      entrypoints: { ...(includeRoot ? { root: "/planet/" } : {}), ru: "/planet/ru/", en: "/planet/en/" },
      files: [...bodies].map(([url, text]) => ({
        url, bytes: Buffer.byteLength(text), sha256: sha256(text), kind: url.endsWith("/") ? "shell" : "asset",
        ...(url.endsWith(".webp") ? { aliases: [url + "?v=sha256-canonical"] } : {}),
      })),
    },
  };
}
function environment(pkg = shell(), caches = memoryCaches()) {
  const handlers = new Map();
  const client = { id: "app-client", type: "window", url: ORIGIN + "/planet/ru/", postMessage: vi.fn() };
  const clients = new Map([[client.id, client]]);
  const worker = {
    location: { href: ORIGIN + "/planet/sw.js" },
    registration: { scope: ORIGIN + "/planet/" },
    caches, crypto: webcrypto, Response, Request,
    addEventListener: vi.fn((name, handler) => handlers.set(name, handler)),
    fetch: vi.fn(async (request) => {
      const body = pkg.bodies.get(new URL(request.url).pathname);
      if (!body) throw new Error("Not found");
      const pathname = new URL(request.url).pathname;
      const mime = pathname.endsWith("/") ? "text/html" : pathname.endsWith(".js") ? "text/javascript" : "application/octet-stream";
      return new Response(body, { headers: { "Content-Type": mime } });
    }),
    clients: { claim: vi.fn(async () => undefined), get: vi.fn(async (id) => clients.get(id)), matchAll: vi.fn(async () => [...clients.values()]) },
    skipWaiting: vi.fn(async () => undefined),
  };
  const registration = installPwaWorker(worker, pkg.config);
  function lifetime(type, fields = {}) {
    const pending = [];
    handlers.get(type)({ ...fields, waitUntil: (promise) => pending.push(promise) });
    return Promise.all(pending);
  }
  function fetchRequest(pathname, { mode, method = "GET", headers, clientId, resultingClientId = "new-document" } = {}) {
    const request = new Request(new URL(pathname, ORIGIN), { method, headers });
    if (mode) Object.defineProperty(request, "mode", { value: mode });
    let response = null;
    handlers.get("fetch")({ request, clientId, resultingClientId, respondWith: (promise) => { response = promise; } });
    return response;
  }
  const send = (data, fields = {}) => lifetime("message", { source: client, origin: ORIGIN, data, ...fields });
  return { ...pkg, worker, caches, handlers, client, clients, registration, lifetime, fetchRequest, send };
}

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

function anchored(pkg, previous) {
  const manifest = normalizePwaWorkerConfig(previous.config);
  pkg.config.rollbackReference = { buildId: manifest.buildId, manifestSha256: sha256(JSON.stringify(manifest)), routes: manifest.files.flatMap(file => [file.url, ...file.aliases]).sort() };
  return pkg;
}
async function rollbackFixture() {
  const caches = memoryCaches();
  const prior = environment(shell("a", true), caches);
  await prior.lifetime("install"); await prior.lifetime("activate");
  const current = environment(anchored(shell("b", true), prior), caches);
  await current.lifetime("install"); await current.lifetime("activate");
  const rollback = (patch = {}) => current.send({ type: "PLANET_ACTIVATE_ROLLBACK", requestId: "explicit-rollback", engineBuildId: current.config.buildId, targetBuildId: prior.config.buildId, ...patch });
  return { prior, current, caches, rollback };
}

function readinessRequest(env, patch = {}) {
  return { type: "PLANET_OFFLINE_READINESS", requestId: "offline-check", engineBuildId: env.config.buildId, activeBuildId: env.config.buildId, ...patch };
}
function repairRequest(env, patch = {}) {
  return { type: "PLANET_OFFLINE_REPAIR", requestId: "offline-repair", engineBuildId: env.config.buildId, activeBuildId: env.config.buildId, ...patch };
}
function permitRepairs(env, deadline = () => Date.now() + 29_000) {
  env.client.postMessage.mockImplementation(data => {
    if (data.type === "PLANET_OFFLINE_REPAIR_PERMISSION_REQUEST") void env.send({ ...data,
      type: "PLANET_OFFLINE_REPAIR_PERMISSION", deadline: deadline() });
  });
}
const repairResult = env => env.client.postMessage.mock.calls.map(([data]) => data).filter(data => data.type === "PLANET_OFFLINE_REPAIR_RESULT").at(-1);

describe("explicit offline base repair", () => {
  it.each(["missing", "corrupt"])("repairs only %s bytes and verifies the whole unchanged generation", async damage => {
    const env = environment(); await env.lifetime("install"); await env.lifetime("activate");
    const cache = env.caches.stores.get(env.registration.cacheName), markerBefore = await (await cache.match(MARKER)).text();
    const target = ORIGIN + "/planet/en/";
    if (damage === "missing") cache.entries.delete(target);
    else cache.entries.set(target, new Response("bad bytes", { headers: { "Content-Type": "text/html" } }));
    clearReadinessEffects(env); permitRepairs(env);
    await env.send(repairRequest(env));
    expect(repairResult(env)).toMatchObject({ status: "complete", repairedFiles: 1, repairedBytes: env.bodies.get("/planet/en/").length,
      fileCount: env.config.files.length, engineBuildId: env.config.buildId, activeBuildId: env.config.buildId });
    expect(env.worker.fetch).toHaveBeenCalledTimes(1);
    expect(env.worker.fetch.mock.calls[0][0]).toMatchObject({ url: target, credentials: "omit", redirect: "error", cache: "no-store" });
    expect(cache.put.mock.calls.map(([url]) => url)).toEqual([target]);
    expect(await (await cache.match(MARKER)).text()).toBe(markerBefore);
    expect(env.worker.skipWaiting).not.toHaveBeenCalled(); expect(env.worker.clients.claim).not.toHaveBeenCalled();
    expect(env.caches.delete).not.toHaveBeenCalled(); expect(cache.delete).not.toHaveBeenCalled();
    expect(await (await cache.match(target)).text()).toBe(env.bodies.get("/planet/en/"));
  });
  it("does not download or rewrite a complete generation", async () => {
    const env = environment(); await env.lifetime("install"); await env.lifetime("activate");
    clearReadinessEffects(env); permitRepairs(env); await env.send(repairRequest(env));
    expect(repairResult(env)).toMatchObject({ status: "complete", repairedFiles: 0, repairedBytes: 0 });
    expect(env.worker.fetch).not.toHaveBeenCalled();
    for (const cache of env.caches.stores.values()) expect(cache.put).not.toHaveBeenCalled();
  });
  it.each(["missing marker", "evicted cache", "inactive marker"])("fails closed for %s without creating a replacement manifest", async damage => {
    const env = environment(); await env.lifetime("install"); await env.lifetime("activate");
    const cache = env.caches.stores.get(env.registration.cacheName);
    if (damage === "missing marker") cache.entries.delete(MARKER);
    if (damage === "evicted cache") env.caches.stores.clear();
    if (damage === "inactive marker") {
      const marker = await (await cache.match(MARKER)).json(); marker.activationSequence = 0;
      cache.entries.set(MARKER, new Response(JSON.stringify(marker)));
    }
    clearReadinessEffects(env); permitRepairs(env); await env.send(repairRequest(env));
    expect(repairResult(env)).toMatchObject({ status: "unavailable", reason: "missing-manifest" });
    expectReadOnly(env);
  });
  it.each(["hash", "oversized", "private", "wrong MIME", "foreign URL", "network", "quota"])("rejects %s recovery without recording a complete result", async failure => {
    const env = environment(); await env.lifetime("install"); await env.lifetime("activate");
    const cache = env.caches.stores.get(env.registration.cacheName); cache.entries.delete(ORIGIN + "/planet/en/");
    clearReadinessEffects(env); permitRepairs(env);
    if (failure === "quota") env.caches.putFailure = () => true;
    else if (failure === "network") env.worker.fetch.mockRejectedValue(new Error("offline"));
    else env.worker.fetch.mockImplementation(async () => {
      const response = new Response(failure === "hash" ? "x".repeat(env.bodies.get("/planet/en/").length) : failure === "oversized" ? "x".repeat(1024) : env.bodies.get("/planet/en/"),
        { headers: { "Content-Type": failure === "wrong MIME" ? "text/plain" : "text/html", ...(failure === "private" ? { "Cache-Control": "private" } : {}) } });
      if (failure === "foreign URL") Object.defineProperty(response, "url", { value: "https://other.invalid/planet/en/" });
      return response;
    });
    await env.send(repairRequest(env));
    expect(repairResult(env)).toMatchObject({ status: "incomplete", repairedFiles: 0, repairedBytes: 0, reason: failure === "quota" ? "storage" : "network-or-integrity" });
    expect(cache.entries.has(ORIGIN + "/planet/en/")).toBe(false);
  });
  it("keeps successful exact writes but reports partial failure honestly", async () => {
    const env = environment(); await env.lifetime("install"); await env.lifetime("activate");
    const cache = env.caches.stores.get(env.registration.cacheName);
    cache.entries.delete(ORIGIN + "/planet/en/"); cache.entries.delete(ORIGIN + "/planet/ru/");
    const fetch = env.worker.fetch.getMockImplementation();
    clearReadinessEffects(env); permitRepairs(env);
    env.worker.fetch.mockImplementation(request => request.url.endsWith("/ru/") ? Promise.reject(new Error("offline")) : fetch(request));
    await env.send(repairRequest(env));
    expect(repairResult(env)).toMatchObject({ status: "incomplete", repairedFiles: 1, repairedBytes: env.bodies.get("/planet/en/").length });
    expect(cache.entries.has(ORIGIN + "/planet/en/")).toBe(true); expect(cache.entries.has(ORIGIN + "/planet/ru/")).toBe(false);
  });
  it("requires a final whole-cache check even after successful writes", async () => {
    const env = environment(); await env.lifetime("install"); await env.lifetime("activate");
    const cache = env.caches.stores.get(env.registration.cacheName), put = cache.put.getMockImplementation();
    cache.entries.delete(ORIGIN + "/planet/en/"); clearReadinessEffects(env); permitRepairs(env);
    cache.put.mockImplementation(async (url, response) => { await put(url, response); cache.entries.delete(ORIGIN + "/planet/assets/app-a.js"); });
    await env.send(repairRequest(env));
    expect(repairResult(env)).toMatchObject({ status: "incomplete", reason: "verification-failed", repairedFiles: 1 });
  });
  it.each(["expired", "future", "wrong sequence", "foreign client"])("refuses an invalid permission: %s", async failure => {
    vi.useFakeTimers();
    const env = environment(); await env.lifetime("install"); await env.lifetime("activate");
    clearReadinessEffects(env);
    const other = { ...env.client, id: "other", postMessage: vi.fn() }; env.clients.set(other.id, other);
    env.client.postMessage.mockImplementation(data => {
      if (data.type === "PLANET_OFFLINE_REPAIR_PERMISSION_REQUEST") void env.send({ ...data, type: "PLANET_OFFLINE_REPAIR_PERMISSION",
        sequence: failure === "wrong sequence" ? data.sequence + 1 : data.sequence,
        deadline: Date.now() + (failure === "expired" ? -1 : failure === "future" ? 60_000 : 29_000) }, failure === "foreign client" ? { source: other } : {});
    });
    const pending = env.send(repairRequest(env)); await vi.advanceTimersByTimeAsync(5001); await pending;
    expect(repairResult(env)).toMatchObject({ status: "unavailable", reason: "access-required" }); expectReadOnly(env);
  });
  it("cancels a stalled fetch and rejects duplicate operations without later writes", async () => {
    const env = environment(); await env.lifetime("install"); await env.lifetime("activate");
    const cache = env.caches.stores.get(env.registration.cacheName); cache.entries.delete(ORIGIN + "/planet/en/");
    clearReadinessEffects(env); permitRepairs(env);
    let started, finish; const begun = new Promise(resolve => { started = resolve; });
    env.worker.fetch.mockImplementation(() => { started(); return new Promise(resolve => { finish = resolve; }); });
    const pending = env.send(repairRequest(env)); await begun;
    await env.send(repairRequest(env, { requestId: "duplicate" }));
    expect(repairResult(env)).toMatchObject({ status: "unavailable", reason: "busy" });
    await env.send(readinessRequest(env));
    expect(env.client.postMessage.mock.calls.at(-1)[0]).toMatchObject({ status: "unavailable", reason: "busy" });
    await env.send(repairRequest(env, { type: "PLANET_CANCEL_OFFLINE_REPAIR", requestId: "wrong" }));
    expect(env.worker.fetch.mock.calls[0][0].signal.aborted).toBe(false);
    await env.send(repairRequest(env, { type: "PLANET_CANCEL_OFFLINE_REPAIR" })); await pending;
    expect(repairResult(env)).toMatchObject({ status: "unavailable", reason: "cancelled" });
    expect(env.worker.fetch.mock.calls[0][0].signal.aborted).toBe(true);
    finish(new Response(env.bodies.get("/planet/en/"), { headers: { "Content-Type": "text/html" } })); await Promise.resolve();
    expect(cache.put).not.toHaveBeenCalled();
  });
  it("checks permission again after network completion before writing", async () => {
    const env = environment(); await env.lifetime("install"); await env.lifetime("activate");
    const cache = env.caches.stores.get(env.registration.cacheName); cache.entries.delete(ORIGIN + "/planet/en/");
    let valid = true; clearReadinessEffects(env); permitRepairs(env, () => valid ? Date.now() + 29_000 : 0);
    const fetch = env.worker.fetch.getMockImplementation();
    env.worker.fetch.mockImplementation(async request => { const response = await fetch(request); valid = false; return response; });
    await env.send(repairRequest(env));
    expect(repairResult(env)).toMatchObject({ status: "unavailable", reason: "access-required" }); expect(cache.put).not.toHaveBeenCalled();
  });
  it("keeps an uncancellable pending write serialized and does not claim it was undone", async () => {
    const env = environment(); await env.lifetime("install"); await env.lifetime("activate");
    const cache = env.caches.stores.get(env.registration.cacheName), put = cache.put.getMockImplementation();
    cache.entries.delete(ORIGIN + "/planet/en/"); clearReadinessEffects(env); permitRepairs(env);
    let entered, finish; const started = new Promise(resolve => { entered = resolve; });
    cache.put.mockImplementation(async (url, response) => { entered(); await new Promise(resolve => { finish = resolve; }); await put(url, response); });
    const pending = env.send(repairRequest(env)); await started;
    await env.send(repairRequest(env, { type: "PLANET_CANCEL_OFFLINE_REPAIR" })); await pending;
    expect(repairResult(env)).toMatchObject({ status: "unavailable", reason: "cancelled" });
    expect(repairResult(env)).not.toHaveProperty("repairedFiles");
    await env.send(repairRequest(env, { requestId: "during-pending-write" }));
    expect(repairResult(env)).toMatchObject({ status: "unavailable", reason: "busy" });
    finish(); await vi.waitFor(() => expect(cache.entries.has(ORIGIN + "/planet/en/")).toBe(true));
    await env.send(readinessRequest(env));
    expect(env.client.postMessage.mock.calls.at(-1)[0]).toMatchObject({ status: "complete" });
  });
  it("renews a live permit during a slow intact-file scan without downloading", async () => {
    vi.useFakeTimers(); vi.setSystemTime(1_800_000_000_000);
    const env = environment(); await env.lifetime("install"); await env.lifetime("activate");
    const cache = env.caches.stores.get(env.registration.cacheName), match = cache.match.getMockImplementation();
    let advanced = false;
    cache.match.mockImplementation(async request => {
      const response = await match(request);
      if (!advanced && absolute(request).endsWith("app-a.js")) { advanced = true; vi.setSystemTime(Date.now() + 26_000); }
      return response;
    });
    clearReadinessEffects(env); permitRepairs(env); await env.send(repairRequest(env));
    expect(repairResult(env)).toMatchObject({ status: "complete", repairedFiles: 0 });
    expect(env.client.postMessage.mock.calls.filter(([data]) => data.type === "PLANET_OFFLINE_REPAIR_PERMISSION_REQUEST").length).toBe(4);
    expect(env.worker.fetch).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  });
  it("aborts a download when another valid action selects rollback", async () => {
    const { current: env, rollback } = await rollbackFixture();
    const cache = env.caches.stores.get(env.registration.cacheName); cache.entries.delete(ORIGIN + "/planet/en/");
    clearReadinessEffects(env); permitRepairs(env);
    let started; const begun = new Promise(resolve => { started = resolve; });
    env.worker.fetch.mockImplementation(() => { started(); return new Promise(() => undefined); });
    const pending = env.send(repairRequest(env)); await begun; await rollback(); await pending;
    expect(repairResult(env)).toMatchObject({ status: "unavailable", reason: "cancelled" }); expect(cache.put.mock.calls.some(([url]) => url.endsWith("/en/"))).toBe(false);
    expect(env.worker.fetch.mock.calls[0][0].signal.aborted).toBe(true);
  });
  it("refuses a damaged persisted rollback generation after restart rather than reconstructing its selection", async () => {
    const { current, prior, caches, rollback } = await rollbackFixture(); await rollback();
    caches.stores.get(prior.registration.cacheName).entries.delete(ORIGIN + "/planet/en/");
    const env = environment(current, caches); clearReadinessEffects(env); permitRepairs(env);
    await env.send(repairRequest(env, { activeBuildId: prior.config.buildId }));
    expect(repairResult(env)).toMatchObject({ status: "unavailable", reason: "worker-changed" }); expectReadOnly(env);
  });
  it.each(["origin", "source", "extra URL", "engine"])("rejects hostile repair request %s without network", async failure => {
    const env = environment(); await env.lifetime("install"); await env.lifetime("activate"); clearReadinessEffects(env);
    const data = repairRequest(env, failure === "extra URL" ? { url: "https://other.invalid/file" } : failure === "engine" ? { engineBuildId: "b".repeat(64) } : {});
    await env.send(data, failure === "origin" ? { origin: "https://other.invalid" } : failure === "source" ? { source: { ...env.client, id: "unknown" } } : {});
    expect(env.client.postMessage).not.toHaveBeenCalled(); expectReadOnly(env);
  });
});
function clearReadinessEffects(env) {
  for (const mock of [env.worker.fetch, env.worker.skipWaiting, env.worker.clients.claim, env.caches.open, env.caches.delete, env.caches.match]) mock.mockClear();
  for (const cache of env.caches.stores.values()) { cache.put.mockClear(); cache.delete.mockClear(); }
  env.client.postMessage.mockClear();
}
function expectReadOnly(env) {
  for (const mock of [env.worker.fetch, env.worker.skipWaiting, env.worker.clients.claim, env.caches.open, env.caches.delete]) expect(mock).not.toHaveBeenCalled();
  for (const cache of env.caches.stores.values()) { expect(cache.put).not.toHaveBeenCalled(); expect(cache.delete).not.toHaveBeenCalled(); }
}
async function stalledReadiness(env) {
  const cache = env.caches.stores.get(env.registration.cacheName);
  const match = cache.match.getMockImplementation();
  let entered;
  const started = new Promise(resolve => { entered = resolve; });
  const cancelled = vi.fn();
  cache.match.mockImplementation(async request => {
    if (absolute(request).endsWith(`/assets/app-${env.config.buildId[0]}.js`)) {
      return new Response(new ReadableStream({ start: () => entered(), cancel: cancelled }), { headers: { "Content-Type": "text/javascript" } });
    }
    return match(request);
  });
  const pending = env.send(readinessRequest(env));
  await started;
  return { pending, cancelled, restore: () => cache.match.mockImplementation(match) };
}

describe("explicit read-only offline readiness", () => {
  it("checks every selected file and reports only validated counts without any repair or lifecycle mutation", async () => {
    const env = environment(); await env.lifetime("install"); await env.lifetime("activate");
    clearReadinessEffects(env);
    await env.send(readinessRequest(env));
    expect(env.client.postMessage).toHaveBeenCalledExactlyOnceWith({ ...readinessRequest(env), type: "PLANET_OFFLINE_READINESS_RESULT", status: "complete", fileCount: env.config.files.length, bytes: env.config.files.reduce((sum, file) => sum + file.bytes, 0) });
    for (const file of env.config.files) expect(env.caches.match).toHaveBeenCalledWith(ORIGIN + file.url, { cacheName: env.registration.cacheName });
    expectReadOnly(env);
  });
  it.each(["missing file", "corrupt file", "missing marker", "evicted cache"])("does not mistake a prior COMPLETE marker for surviving files: %s", async reason => {
    const env = environment(); await env.lifetime("install"); await env.lifetime("activate");
    const cache = env.caches.stores.get(env.registration.cacheName);
    const url = ORIGIN + "/planet/assets/app-a.js";
    if (reason === "missing file") cache.entries.delete(url);
    if (reason === "corrupt file") cache.entries.set(url, new Response("x".repeat(env.bodies.get("/planet/assets/app-a.js").length), { headers: { "Content-Type": "text/javascript" } }));
    if (reason === "missing marker") cache.entries.delete(MARKER);
    if (reason === "evicted cache") env.caches.stores.delete(env.registration.cacheName);
    clearReadinessEffects(env);
    await env.send(readinessRequest(env));
    expect(env.client.postMessage).toHaveBeenLastCalledWith({ ...readinessRequest(env), type: "PLANET_OFFLINE_READINESS_RESULT", status: "incomplete" });
    expectReadOnly(env);
    if (reason === "evicted cache") expect(env.caches.stores.size).toBe(0);
  });
  it("checks the selected rollback generation after restart, then detects later eviction in that generation", async () => {
    const { prior, current, caches, rollback } = await rollbackFixture(); await rollback();
    const restarted = environment(current, caches);
    await restarted.send({ type: "PLANET_ROLLBACK_STATUS", requestId: "restore-selection" });
    clearReadinessEffects(restarted);
    const request = readinessRequest(restarted, { activeBuildId: prior.config.buildId });
    await restarted.send(request);
    expect(restarted.client.postMessage.mock.calls.at(-1)[0]).toMatchObject({ status: "complete", engineBuildId: current.config.buildId, activeBuildId: prior.config.buildId });
    expect(restarted.caches.match).not.toHaveBeenCalledWith(ORIGIN + "/planet/assets/app-b.js", expect.anything());
    caches.stores.get(prior.registration.cacheName).entries.delete(ORIGIN + "/planet/assets/app-a.js");
    await restarted.send(request);
    expect(restarted.client.postMessage.mock.calls.at(-1)[0]).toMatchObject({ status: "incomplete", activeBuildId: prior.config.buildId });
    expectReadOnly(restarted);
  });
  it("rejects a result spanning a rollback selection even when all scanned old bytes are valid", async () => {
    const { current, rollback } = await rollbackFixture();
    const cache = current.caches.stores.get(current.registration.cacheName), match = cache.match.getMockImplementation();
    let entered, release;
    const started = new Promise(resolve => { entered = resolve; });
    const held = new Promise(resolve => { release = resolve; });
    cache.match.mockImplementation(async request => {
      if (absolute(request).endsWith("/assets/app-b.js")) { entered(); await held; }
      return match(request);
    });
    const pending = current.send(readinessRequest(current)); await started;
    await rollback(); release(); await pending;
    expect(current.client.postMessage.mock.calls.at(-1)[0]).toMatchObject({ type: "PLANET_OFFLINE_READINESS_RESULT", status: "unavailable", reason: "worker-changed" });
  });
  it.each(["wrong origin", "missing origin", "unknown client", "hostile current URL", "wrong engine", "invalid request", "extra field"])("ignores an unauthorized readiness query: %s", async reason => {
    const env = environment(); await env.lifetime("install"); await env.lifetime("activate");
    const request = readinessRequest(env), fields = {};
    if (reason === "wrong origin") fields.origin = "https://other.test";
    if (reason === "missing origin") fields.origin = "";
    if (reason === "unknown client") fields.source = { id: "unknown", type: "window" };
    if (reason === "hostile current URL") env.client.url = ORIGIN + "/planet/admin/";
    if (reason === "wrong engine") request.engineBuildId = "b".repeat(64);
    if (reason === "invalid request") request.requestId = "../private";
    if (reason === "extra field") request.repair = true;
    clearReadinessEffects(env);
    await env.send(request, fields);
    expect(env.client.postMessage).not.toHaveBeenCalled(); expect(env.caches.match).not.toHaveBeenCalled(); expectReadOnly(env);
  });
  it("reauthorizes a client whose document changes during verification", async () => {
    const env = environment(); await env.lifetime("install"); await env.lifetime("activate");
    const cache = env.caches.stores.get(env.registration.cacheName), match = cache.match.getMockImplementation();
    cache.match.mockImplementation(async request => {
      if (absolute(request).endsWith(".webp")) env.client.url = ORIGIN + "/planet/admin/";
      return match(request);
    });
    clearReadinessEffects(env);
    await env.send(readinessRequest(env));
    expect(env.client.postMessage).not.toHaveBeenCalled(); expectReadOnly(env);
  });
  it("bounds concurrent scans and permits cancellation only by the originating client, request and generation", async () => {
    const env = environment(); await env.lifetime("install"); await env.lifetime("activate");
    clearReadinessEffects(env);
    const stalled = await stalledReadiness(env);
    await env.send(readinessRequest(env, { requestId: "second-query" }));
    expect(env.client.postMessage.mock.calls.at(-1)[0]).toMatchObject({ requestId: "second-query", status: "unavailable", reason: "busy" });
    const other = { id: "other-client", type: "window", url: ORIGIN + "/planet/en/", postMessage: vi.fn() }; env.clients.set(other.id, other);
    const cancel = readinessRequest(env, { type: "PLANET_CANCEL_OFFLINE_READINESS" });
    await env.send(cancel, { source: other });
    await env.send({ ...cancel, requestId: "wrong-request" });
    await env.send({ ...cancel, activeBuildId: "b".repeat(64) });
    expect(stalled.cancelled).not.toHaveBeenCalled();
    await env.send(cancel); await stalled.pending;
    expect(stalled.cancelled).toHaveBeenCalledOnce();
    expect(env.client.postMessage.mock.calls.at(-1)[0]).toMatchObject({ requestId: "offline-check", status: "unavailable", reason: "cancelled" });
    stalled.restore(); await env.send(readinessRequest(env, { requestId: "after-cancel" }));
    expect(env.client.postMessage.mock.calls.at(-1)[0]).toMatchObject({ status: "complete" }); expectReadOnly(env);
  });
  it("releases a stalled cached stream at the worker deadline without downloading or leaving the query slot occupied", async () => {
    vi.useFakeTimers();
    const env = environment(); await env.lifetime("install"); await env.lifetime("activate");
    clearReadinessEffects(env);
    const stalled = await stalledReadiness(env);
    await vi.advanceTimersByTimeAsync(30_001); await stalled.pending;
    expect(env.client.postMessage.mock.calls.at(-1)[0]).toMatchObject({ status: "unavailable", reason: "timeout" });
    expect(stalled.cancelled).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    stalled.restore(); await env.send(readinessRequest(env, { requestId: "after-timeout" }));
    expect(env.client.postMessage.mock.calls.at(-1)[0]).toMatchObject({ status: "complete" }); expectReadOnly(env);
  });
});

describe("explicit whole-generation rollback", () => {
  it("normalizes entrypoints, files and aliases into one immutable canonical manifest", () => {
    const original = shell("a", true).config;
    const reordered = { ...original, entrypoints: { en: "/planet/en/", ru: "/planet/ru/", root: "/planet/" }, files: [...original.files].reverse() };
    expect(JSON.stringify(normalizePwaWorkerConfig(original))).toBe(JSON.stringify(normalizePwaWorkerConfig(reordered)));
    expect(Object.isFrozen(normalizePwaWorkerConfig(original).files)).toBe(true);
  });
  it.each(["same build", "bad digest", "duplicate route", "unsorted routes", "private route", "foreign route", "query bypass", "unknown field"])("refuses invalid immutable rollback anchor: %s", reason => {
    const config = anchored(shell("b"), shell("a")).config;
    if (reason === "same build") config.rollbackReference.buildId = config.buildId;
    if (reason === "bad digest") config.rollbackReference.manifestSha256 = "guessed";
    if (reason === "duplicate route") config.rollbackReference.routes.push(config.rollbackReference.routes[0]);
    if (reason === "unsorted routes") config.rollbackReference.routes.reverse();
    if (reason === "private route") config.rollbackReference.routes = ["/planet/api/license/session", "/planet/ru/"];
    if (reason === "foreign route") config.rollbackReference.routes = ["/outside/asset.js", "/planet/ru/"];
    if (reason === "query bypass") config.rollbackReference.routes = ["/planet/assets/app.js?v=1&token=private", "/planet/ru/"];
    if (reason === "unknown field") config.rollbackReference.authority = "untrusted";
    expect(() => environment({ ...shell("b"), config })).toThrow();
  });
  it("discovers only the anchored immediate activated prior build without switching or skipWaiting", async () => {
    const { prior, current } = await rollbackFixture();
    await current.send({ type: "PLANET_ROLLBACK_STATUS", requestId: "discover" });
    expect(current.client.postMessage).toHaveBeenLastCalledWith({ type: "PLANET_ROLLBACK_STATUS_RESULT", requestId: "discover", engineBuildId: current.config.buildId, activeBuildId: current.config.buildId, rollbackBuildId: prior.config.buildId, ready: true });
    expect(await (await current.fetchRequest("/planet/en/", { mode: "navigate" })).text()).toContain("EN b");
    expect(current.worker.skipWaiting).not.toHaveBeenCalled();
  });
  it("atomically selects complete RU/EN/root, modules and exact aliases without mixing generations", async () => {
    const { prior, current, rollback } = await rollbackFixture();
    await rollback();
    expect(current.client.postMessage.mock.calls.at(-1)[0]).toMatchObject({ accepted: true, activeBuildId: prior.config.buildId });
    for (const [route, text] of [["/planet/", "NEUTRAL a"], ["/planet/ru/?country=russia#atlas", "RU a"], ["/planet/en/#atlas", "EN a"], ["/planet/assets/app-a.js", 'build = "a"'], ["/planet/textures/antique-world.webp?v=sha256-canonical", "texture bytes a"]]) {
      const response = await current.fetchRequest(route, { mode: route.includes(".js") || route.includes(".webp") ? undefined : "navigate", clientId: "new-document" });
      expect(await response.text()).toContain(text); expect(response.headers.get("X-Literary-Planet-Build")).toBe(prior.config.buildId);
    }
    expect((await current.fetchRequest("/planet/assets/app-b.js", { clientId: "new-document" })).type).toBe("error");
    expect(current.fetchRequest("/planet/api/license/session")).toBeNull();
    expect(current.fetchRequest("/planet/assets/unknown.js")).toBeNull();
  });
  it("restores the verified selection after worker restart before an old hashed module request", async () => {
    const { current, caches, rollback } = await rollbackFixture(); await rollback();
    expect(await (await current.fetchRequest("/planet/en/", { mode: "navigate", resultingClientId: "reloaded-document" })).text()).toContain("EN a");
    const restarted = environment(current, caches);
    expect(await (await restarted.fetchRequest("/planet/assets/app-a.js", { clientId: "reloaded-document" })).text()).toContain('build = "a"');
    await restarted.send({ type: "PLANET_ROLLBACK_STATUS", requestId: "status-after-restart" });
    expect(restarted.client.postMessage.mock.calls.at(-1)[0]).toMatchObject({ ready: false, activeBuildId: "a".repeat(64), rollbackBuildId: null });
  });
  it("never gives an older or unbound document prior assets even after a worker process restart", async () => {
    const { current, caches, rollback } = await rollbackFixture(); await rollback();
    const restarted = environment(current, caches);
    expect((await restarted.fetchRequest("/planet/assets/app-a.js", { clientId: "old-late-window" })).type).toBe("error");
    expect((await restarted.fetchRequest("/planet/assets/app-a.js")).type).toBe("error");
  });
  it("fences a late navigation and its assets while selection storage is in progress", async () => {
    const { current, caches, rollback } = await rollbackFixture();
    const cache = await caches.open(current.registration.cacheName), originalPut = cache.put.getMockImplementation();
    let release, entered;
    const held = new Promise(resolve => { release = resolve; });
    const started = new Promise(resolve => { entered = resolve; });
    cache.put.mockImplementation(async (request, response) => {
      if (absolute(request).endsWith("/__pwa_selection__")) { entered(); await held; }
      return originalPut(request, response);
    });
    const operation = rollback(); await started;
    current.clients.set("late-window", { id: "late-window", type: "window", url: ORIGIN + "/planet/en/" });
    const navigation = await current.fetchRequest("/planet/en/", { mode: "navigate", resultingClientId: "late-window" });
    expect(navigation.type).toBe("error");
    release(); await operation;
    expect((await current.fetchRequest("/planet/textures/antique-world.webp", { clientId: "late-window" })).type).toBe("error");
  });
  it("rejects a current-generation response whose cache lookup completes after rollback", async () => {
    const { current, caches, rollback } = await rollbackFixture();
    const cache = await caches.open(current.registration.cacheName), originalMatch = cache.match.getMockImplementation();
    let release, entered;
    const held = new Promise(resolve => { release = resolve; });
    const started = new Promise(resolve => { entered = resolve; });
    cache.match.mockImplementation(async request => {
      if (absolute(request).endsWith("/app-b.js")) { entered(); await held; }
      return originalMatch(request);
    });
    const response = current.fetchRequest("/planet/assets/app-b.js", { clientId: current.client.id });
    await started; await rollback(); release();
    expect((await response).type).toBe("error");
  });
  it("requires a document binding to persist before returning a rollback shell", async () => {
    const { current, caches, rollback } = await rollbackFixture(); await rollback();
    caches.putFailure = (_name, url) => url.includes("/__pwa_client__/");
    expect((await current.fetchRequest("/planet/en/", { mode: "navigate", resultingClientId: "new-document" })).type).toBe("error");
    expect((await current.fetchRequest("/planet/assets/app-a.js", { clientId: "new-document" })).type).toBe("error");
  });
  it("does not advertise a previously rolled-back engine as the last app version after a later update", async () => {
    const { prior, current, caches, rollback } = await rollbackFixture(); await rollback();
    const next = environment(anchored(shell("c", true), current), caches);
    await next.lifetime("install"); await next.lifetime("activate");
    await next.send({ type: "PLANET_ROLLBACK_STATUS", requestId: "after-another-update" });
    expect(next.client.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({ activeBuildId: next.config.buildId, rollbackBuildId: null, ready: false }));
    expect(await caches.keys()).toEqual(expect.arrayContaining([prior.registration.cacheName, next.registration.cacheName]));
    expect(await caches.keys()).not.toContain(current.registration.cacheName);
  });
  it("blocks old document subresources during the explicit reload transition", async () => {
    const { current, rollback } = await rollbackFixture(); await rollback();
    expect((await current.fetchRequest("/planet/textures/antique-world.webp", { clientId: current.client.id })).type).toBe("error");
    expect(await (await current.fetchRequest("/planet/en/", { mode: "navigate", clientId: current.client.id })).text()).toContain("EN a");
  });
  it.each(["missing", "corrupt", "wrong anchor", "not activated", "not immediate", "route mismatch"])("rejects %s prior generation and preserves current app", async failure => {
    const { prior, current, rollback, caches } = await rollbackFixture();
    const priorCache = await caches.open(prior.registration.cacheName);
    if (failure === "missing") await priorCache.delete(ORIGIN + "/planet/assets/app-a.js");
    if (failure === "corrupt") await priorCache.put(ORIGIN + "/planet/assets/app-a.js", new Response("bad", { headers: { "Content-Type": "text/javascript" } }));
    if (["not activated", "not immediate"].includes(failure)) { const marker = await (await priorCache.match(MARKER)).json(); marker.activationSequence = failure === "not activated" ? 0 : 30; await priorCache.put(MARKER, new Response(JSON.stringify(marker))); }
    let env = current;
    if (failure === "wrong anchor" || failure === "route mismatch") {
      const config = structuredClone(current.config);
      if (failure === "wrong anchor") config.rollbackReference.manifestSha256 = "f".repeat(64);
      else config.rollbackReference.routes = config.rollbackReference.routes.filter(route => !route.endsWith("app-a.js"));
      env = environment({ bodies: current.bodies, config }, caches);
    }
    await (env === current ? rollback() : env.send({ type: "PLANET_ACTIVATE_ROLLBACK", requestId: "request", engineBuildId: env.config.buildId, targetBuildId: prior.config.buildId }));
    expect(env.client.postMessage.mock.calls.at(-1)[0]).toMatchObject({ accepted: false });
    if (env === current) expect(await (await env.fetchRequest("/planet/en/", { mode: "navigate" })).text()).toContain("EN b");
  });
  it("preserves current generation when selection persistence hits quota", async () => {
    const { current, caches, rollback } = await rollbackFixture();
    caches.putFailure = (_name, url) => url.endsWith("/__pwa_selection__");
    await rollback();
    expect(current.client.postMessage.mock.calls.at(-1)[0]).toMatchObject({ accepted: false });
    expect(await (await current.fetchRequest("/planet/en/", { mode: "navigate" })).text()).toContain("EN b");
  });
  it("rejects multiple controlled windows without changing either generation", async () => {
    const { current, rollback } = await rollbackFixture();
    current.clients.set("other", { id: "other", type: "window", url: ORIGIN + "/planet/en/" });
    await rollback();
    expect(current.client.postMessage.mock.calls.at(-1)[0]).toMatchObject({ accepted: false, reason: "multiple-clients" });
    expect(await (await current.fetchRequest("/planet/en/", { mode: "navigate" })).text()).toContain("EN b");
  });
  it("fails closed on a forged or corrupted persisted selection after restart", async () => {
    const { current, caches } = await rollbackFixture();
    await (await caches.open(current.registration.cacheName)).put(ORIGIN + "/planet/__pwa_selection__", new Response(JSON.stringify({ schemaVersion: 1, engineBuildId: current.config.buildId, buildId: "c".repeat(64), manifestSha256: "f".repeat(64), requestedBy: "client" })));
    const restarted = environment(current, caches);
    expect((await restarted.fetchRequest("/planet/en/", { mode: "navigate" })).type).toBe("error");
  });
  it.each(["foreign source", "wrong engine", "wrong target"])("requires authenticated exact user request: %s", async failure => {
    const { current, rollback } = await rollbackFixture();
    if (failure === "foreign source") current.client.url = "https://other.test/planet/ru/";
    await rollback(failure === "wrong engine" ? { engineBuildId: "f".repeat(64) } : failure === "wrong target" ? { targetBuildId: "f".repeat(64) } : {});
    expect(current.client.postMessage.mock.calls.some(([data]) => data.accepted === true)).toBe(false);
    expect(await (await current.fetchRequest("/planet/en/", { mode: "navigate" })).text()).toContain("EN b");
  });
});

describe("isolated immutable PWA configuration", () => {
  it("registers the bounded worker without network, caches, activation or broadcasts", () => {
    const env = environment();
    expect(env.worker.fetch).not.toHaveBeenCalled();
    expect(env.caches.open).not.toHaveBeenCalled();
    expect(env.worker.skipWaiting).not.toHaveBeenCalled();
    expect(env.worker.clients.claim).not.toHaveBeenCalled();
    expect(env.client.postMessage).not.toHaveBeenCalled();
    expect(env.registration.cacheName).toBe(PREFIX + "a".repeat(64));
    expect(Object.isFrozen(env.registration)).toBe(true);
  });
  it.each([
    ["unknown field", (config) => { config.remoteManifest = "https://example.test/runtime.json"; }],
    ["wrong version", (config) => { config.schemaVersion = 2; }],
    ["root scope", (config) => { config.scopePath = "/"; }],
    ["weak build identity", (config) => { config.buildId = "latest"; }],
    ["missing English", (config) => { config.files.splice(1, 1); }],
    ["foreign entry", (config) => { config.entrypoints.en = "/en/"; }],
    ["unknown entry", (config) => { config.entrypoints.fr = "/planet/fr/"; }],
    ["invalid root", (config) => { config.entrypoints.root = "/planet/index.html"; }],
    ["missing root file", (config) => { config.entrypoints.root = "/planet/"; }],
    ["duplicate URL", (config) => { config.files.push({ ...config.files[0] }); }],
    ["remote file", (config) => { config.files[2].url = "https://example.test/planet/app.js"; }],
    ["out-of-scope file", (config) => { config.files[2].url = "/assets/app.js"; }],
    ["traversal", (config) => { config.files[2].url = "/planet/../private/app.js"; }],
    ["encoded private path", (config) => { config.files[2].url = "/planet/%61uth/token.js"; }],
    ["double encoded private path", (config) => { config.files[2].url = "/planet/%2561uth/token.js"; }],
    ["child package", (config) => { config.files[2].url = "/planet/child/index.json"; }],
    ["metadata collision", (config) => { config.files[2].url = "/planet/__pwa_complete__"; }],
    ["arbitrary query", (config) => { config.files[2].url += "?token=private"; }],
    ["cross-path alias", (config) => { config.files[2].aliases = ["/planet/other.js?v=1"]; }],
    ["unsafe alias", (config) => { config.files[2].aliases = [config.files[2].url + "?v=1&cms-edit=1"]; }],
    ["duplicate alias", (config) => { config.files[3].aliases.push(config.files[3].aliases[0]); }],
    ["negative size", (config) => { config.files[2].bytes = -1; }],
    ["oversized file", (config) => { config.files[2].bytes = 16 * 1024 * 1024 + 1; }],
    ["wrong checksum", (config) => { config.files[2].sha256 = "guess"; }],
    ["unexpected shell", (config) => { config.files[2].kind = "shell"; }],
    ["file count overflow", (config) => { config.files = Array.from({ length: 2049 }, (_, index) => ({ ...config.files[2], url: `/planet/assets/${index}.js` })); }],
    ["total budget overflow", (config) => { config.files.push(...Array.from({ length: 5 }, (_, index) => ({ ...config.files[2], url: `/planet/assets/${index}.js`, bytes: 16 * 1024 * 1024 }))); }],
  ])("rejects %s before registering executable work", (_name, mutate) => {
    const pkg = shell();
    mutate(pkg.config);
    expect(() => environment(pkg)).toThrow();
  });
  it("requires the real registration scope to equal the bundled scope", () => {
    const env = environment();
    env.worker.registration.scope = ORIGIN + "/";
    expect(() => installPwaWorker(env.worker, env.config)).toThrow("registration scope");
  });
});

describe("bounded completed-generation metadata", () => {
  it("installs and rereads an expanded rollback generation while corrupt bytes remain incomplete", async () => {
    const largeShell = build => {
      const pkg = shell(build, true);
      for (let index = 0; index < 600; index++) {
        const url = `/planet/assets/${String(index).padStart(4, "0")}-${"x".repeat(200)}.bin`;
        const body = `package ${build} ${index}`;
        pkg.bodies.set(url, body);
        pkg.config.files.push({ url, bytes: Buffer.byteLength(body), sha256: sha256(body), kind: "asset" });
      }
      return pkg;
    };
    const caches = memoryCaches(), prior = environment(largeShell("a"), caches);
    await prior.lifetime("install"); await prior.lifetime("activate");
    const priorCache = caches.stores.get(prior.registration.cacheName);
    const priorMarker = await (await priorCache.match(MARKER)).text();
    const bad = environment(anchored(largeShell("c"), prior), caches);
    expect(Buffer.byteLength(JSON.stringify(normalizePwaWorkerConfig(bad.config)))).toBeGreaterThan(MAX_MARKER_BYTES / 2);
    const damaged = bad.config.files.find(file => file.url.endsWith(".bin"));
    bad.bodies.set(damaged.url, "!".repeat(damaged.bytes));
    await expect(bad.lifetime("install")).rejects.toThrow("integrity mismatch");
    const badCache = caches.stores.get(bad.registration.cacheName);
    expect(await badCache.match(CANDIDATE)).toBeDefined();
    expect(await badCache.match(MARKER)).toBeUndefined();
    await expect(bad.lifetime("activate")).rejects.toThrow("incomplete shell");
    expect(bad.worker.clients.claim).not.toHaveBeenCalled();
    expect(bad.worker.skipWaiting).not.toHaveBeenCalled();
    expect(await (await priorCache.match(MARKER)).text()).toBe(priorMarker);
    expect(await (await prior.fetchRequest("/planet/en/", { mode: "navigate" })).text()).toContain("EN a");

    const current = environment(anchored(largeShell("b"), prior), caches);
    await current.lifetime("install");
    const currentCache = caches.stores.get(current.registration.cacheName);
    const installedMarker = await (await currentCache.match(MARKER)).text();
    expect(Buffer.byteLength(installedMarker)).toBeGreaterThan(MAX_MARKER_BYTES / 2);
    expect(Buffer.byteLength(installedMarker)).toBeLessThanOrEqual(MAX_MARKER_BYTES);
    expect(caches.stores.has(bad.registration.cacheName)).toBe(false);
    await current.lifetime("activate");
    current.worker.fetch.mockClear();
    await current.send(readinessRequest(current));
    expect(current.client.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({ status: "complete", fileCount: current.config.files.length }));
    expect(current.worker.fetch).not.toHaveBeenCalled();
    const restarted = environment(current, caches);
    await restarted.send({ type: "PLANET_ROLLBACK_STATUS", requestId: "expanded-restart" });
    expect(restarted.client.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({ ready: true,
      activeBuildId: current.config.buildId, rollbackBuildId: prior.config.buildId }));
    await restarted.send({ type: "PLANET_ACTIVATE_ROLLBACK", requestId: "expanded-rollback",
      engineBuildId: current.config.buildId, targetBuildId: prior.config.buildId });
    expect(restarted.client.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({ accepted: true, activeBuildId: prior.config.buildId }));
    for (const pathname of ["/planet/ru/", "/planet/en/", "/planet/assets/app-a.js", damaged.url]) {
      const response = await restarted.fetchRequest(pathname, { mode: pathname.endsWith("/") ? "navigate" : undefined,
        clientId: "expanded-document", resultingClientId: "expanded-document" });
      expect(await response.text()).toBe(prior.bodies.get(pathname));
      expect(response.headers.get("X-Literary-Planet-Build")).toBe(prior.config.buildId);
    }
    expect((await restarted.fetchRequest("/planet/assets/app-b.js", { clientId: "expanded-document" })).type).toBe("error");
    expect(restarted.worker.fetch).not.toHaveBeenCalled();
  }, 60_000);

  it("accepts the complete marker at its byte limit and rejects one extra byte before adoption", async () => {
    const sample = environment(shell("b", true));
    await sample.lifetime("install");
    const observedMarker = await (await sample.caches.stores.get(sample.registration.cacheName).match(MARKER)).json();
    observedMarker.completedAt = Number.MAX_SAFE_INTEGER;
    observedMarker.activationSequence = Number.MAX_SAFE_INTEGER;
    const config = structuredClone(normalizePwaWorkerConfig(sample.config));
    config.rollbackReference = { buildId: "a".repeat(64), manifestSha256: "f".repeat(64),
      routes: Array.from({ length: 1024 }, (_, index) => `/planet/assets/${String(index).padStart(4, "0")}-${"x".repeat(480)}`) };
    const envelope = manifest => JSON.stringify({ ...observedMarker, manifest });
    let remaining = MAX_MARKER_BYTES - Buffer.byteLength(envelope(config));
    expect(remaining).toBeGreaterThan(0);
    for (let index = 0; remaining > 0 && index < config.rollbackReference.routes.length; index++) {
      const extra = Math.min(512 - config.rollbackReference.routes[index].length, remaining);
      config.rollbackReference.routes[index] += "x".repeat(extra); remaining -= extra;
    }
    expect(remaining).toBe(0);
    expect(Buffer.byteLength(envelope(config))).toBe(MAX_MARKER_BYTES);
    const accepted = environment({ ...shell("b", true), config });
    await accepted.lifetime("install");
    const cache = accepted.caches.stores.get(accepted.registration.cacheName);
    const marker = await (await cache.match(MARKER)).json();
    marker.completedAt = Number.MAX_SAFE_INTEGER; marker.activationSequence = Number.MAX_SAFE_INTEGER;
    const maximum = JSON.stringify(marker);
    expect(Buffer.byteLength(maximum)).toBe(MAX_MARKER_BYTES);
    await cache.put(MARKER, new Response(maximum));
    await accepted.send({ type: "PLANET_UPDATE_STATUS", requestId: "maximum-marker" });
    expect(accepted.client.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({ ready: true }));

    const oversized = structuredClone(config);
    oversized.rollbackReference.routes[1023] += "x";
    expect(Buffer.byteLength(JSON.stringify(oversized))).toBeLessThan(MAX_MARKER_BYTES);
    expect(Buffer.byteLength(envelope(oversized))).toBe(MAX_MARKER_BYTES + 1);
    expect(() => environment({ ...shell("c", true), config: oversized })).toThrow("metadata budget");
    await cache.put(MARKER, new Response(maximum + " "));
    await accepted.send({ type: "PLANET_UPDATE_STATUS", requestId: "oversized-stored-marker" });
    expect(accepted.client.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({ ready: false }));
    expect(await (await cache.match(MARKER)).text()).toBe(maximum + " ");
    expect(accepted.worker.clients.claim).not.toHaveBeenCalled();
    expect(accepted.worker.skipWaiting).not.toHaveBeenCalled();
  });
});

describe("atomic verified install and recovery", () => {
  const failDownload = (env, pathname) => {
    const normalFetch = env.worker.fetch.getMockImplementation();
    env.worker.fetch.mockImplementation(request => new URL(request.url).pathname === pathname
      ? Promise.reject(new Error("Interrupted download")) : normalFetch(request));
  };
  const downloadedPaths = env => env.worker.fetch.mock.calls.map(([request]) => new URL(request.url).pathname);
  it("installs a portrait-scale package and verifies its offline readiness without network on read", async () => {
    const pkg = shell();
    for (let index = pkg.config.files.length; index < 1339; index++) {
      const url = `/planet/assets/writer-portraits/q${100000 + index}.webp`, body = `test portrait bytes ${index}`;
      pkg.bodies.set(url, body);
      pkg.config.files.push({ url, bytes: Buffer.byteLength(body), sha256: sha256(body), kind: "asset" });
    }
    const env = environment(pkg);
    await env.lifetime("install");
    expect(env.worker.fetch).toHaveBeenCalledTimes(1339);
    await env.lifetime("activate");
    env.worker.fetch.mockClear();
    await env.send(readinessRequest(env));
    expect(env.client.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({ status: "complete", fileCount: 1339 }));
    expect(await (await env.fetchRequest(pkg.config.files.at(-1).url)).text()).toBe(pkg.bodies.get(pkg.config.files.at(-1).url));
    expect(env.worker.fetch).not.toHaveBeenCalled();
  }, 20_000);
  it("checks every byte/hash, stores aliases only once, and never activates automatically", async () => {
    const env = environment();
    await env.lifetime("install");
    expect(env.worker.fetch).toHaveBeenCalledTimes(env.config.files.length);
    for (const [request] of env.worker.fetch.mock.calls) {
      expect(request.credentials).toBe("omit");
      expect(request.cache).toBe("no-store");
      expect(request.redirect).toBe("error");
    }
    const cache = await env.caches.open(env.registration.cacheName);
    expect(await cache.keys()).toHaveLength(env.config.files.length + 1);
    expect(await (await cache.match(MARKER)).json()).toMatchObject({ state: "COMPLETE", manifest: { buildId: env.config.buildId } });
    expect(env.worker.skipWaiting).not.toHaveBeenCalled();
    expect(env.client.postMessage).not.toHaveBeenCalled();
    await env.lifetime("activate");
    expect(env.worker.clients.claim).toHaveBeenCalledOnce();
    expect(env.worker.skipWaiting).not.toHaveBeenCalled();
  });
  it("joins duplicate installs and neither serves nor activates while an essential download is pending", async () => {
    const env = environment();
    let release;
    let notifyWaiting;
    const waiting = new Promise(resolve => { notifyWaiting = resolve; });
    const normalFetch = env.worker.fetch.getMockImplementation();
    env.worker.fetch.mockImplementation((request) => {
      if (request.url.endsWith(".webp")) return new Promise(resolve => { release = resolve; notifyWaiting(); });
      return normalFetch(request);
    });
    const installing = env.lifetime("install");
    const duplicate = env.lifetime("install");
    await waiting;
    const cache = await env.caches.open(env.registration.cacheName);
    expect(await cache.match(MARKER)).toBeUndefined();
    expect(await (await cache.match(CANDIDATE)).json()).toEqual({ schemaVersion: 1, state: "CANDIDATE", buildId: env.config.buildId, manifestSha256: sha256(JSON.stringify(normalizePwaWorkerConfig(env.config))) });
    expect((await env.fetchRequest("/planet/en/", { mode: "navigate" })).type).toBe("error");
    await expect(env.lifetime("activate")).rejects.toThrow("incomplete shell");
    expect(env.worker.clients.claim).not.toHaveBeenCalled();
    release(new Response(env.bodies.get("/planet/textures/antique-world.webp")));
    await Promise.all([installing, duplicate]);
    expect(env.worker.fetch).toHaveBeenCalledTimes(env.config.files.length);
    expect(await cache.match(MARKER)).toBeDefined();
    expect(await cache.match(CANDIDATE)).toBeUndefined();
  });
  it.each(["corrupt", "short", "quota", "marker quota", "network"])("failed %s update stays incomplete and leaves the prior worker untouched", async (failure) => {
    const storage = memoryCaches();
    const previous = environment(shell("a"), storage);
    await previous.lifetime("install");
    await previous.lifetime("activate");
    const previousCache = storage.stores.get(previous.registration.cacheName);
    const previousEntries = [...previousCache.entries];
    previousCache.put.mockClear(); previousCache.delete.mockClear();
    const current = environment(shell("b"), storage);
    if (failure === "corrupt") current.worker.fetch.mockResolvedValue(new Response("different bytes"));
    if (failure === "short") current.worker.fetch.mockResolvedValue(new Response("x"));
    if (failure === "network") current.worker.fetch.mockRejectedValue(new Error("Offline"));
    if (failure === "quota") storage.putFailure = (name, url) => name === current.registration.cacheName && url.endsWith("app-b.js");
    if (failure === "marker quota") storage.putFailure = (name, url) => name === current.registration.cacheName && url === MARKER;
    await expect(current.lifetime("install")).rejects.toThrow();
    const candidate = storage.stores.get(current.registration.cacheName);
    expect(await candidate.match(CANDIDATE)).toBeDefined();
    expect(await candidate.match(MARKER)).toBeUndefined();
    if (failure === "marker quota") expect(candidate.entries.size).toBe(current.config.files.length + 1);
    else expect(await candidate.match(ORIGIN + "/planet/assets/app-b.js")).toBeUndefined();
    expect(storage.stores.has(previous.registration.cacheName)).toBe(true);
    expect([...previousCache.entries]).toEqual(previousEntries);
    expect(previousCache.put).not.toHaveBeenCalled(); expect(previousCache.delete).not.toHaveBeenCalled();
    expect(await (await previous.fetchRequest("/planet/en/", { mode: "navigate" })).text()).toContain("EN a");
    expect(current.worker.skipWaiting).not.toHaveBeenCalled();
    expect(storage.delete).not.toHaveBeenCalled();
  });
  it("rejects a same-size SHA mismatch", async () => {
    const env = environment();
    const original = env.bodies.get("/planet/ru/");
    env.bodies.set("/planet/ru/", original.replace("RU", "XX"));
    await expect(env.lifetime("install")).rejects.toThrow("integrity mismatch");
    const cache = env.caches.stores.get(env.registration.cacheName);
    expect(await cache.match(MARKER)).toBeUndefined();
    expect(await cache.match(ORIGIN + "/planet/ru/")).toBeUndefined();
  });
  it("cancels an overlong response without retaining the failed file or marking COMPLETE", async () => {
    const env = environment();
    const cancel = vi.fn();
    env.worker.fetch.mockImplementation(async request => new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(4096)); }, cancel }), { headers: { "Content-Type": new URL(request.url).pathname.endsWith(".js") ? "text/javascript" : "text/html" } }));
    await expect(env.lifetime("install")).rejects.toThrow("byte budget");
    expect(cancel).toHaveBeenCalledOnce();
    const cache = env.caches.stores.get(env.registration.cacheName);
    expect([...cache.entries.keys()]).toEqual([CANDIDATE]);
  });
  it("aborts a stalled install and never marks it complete", async () => {
    vi.useFakeTimers();
    const env = environment();
    let notifyFetch;
    const fetching = new Promise(resolve => { notifyFetch = resolve; });
    env.worker.fetch.mockImplementation((request) => new Promise((_resolve, reject) => {
      request.signal.addEventListener("abort", () => reject(new Error("Aborted")));
      notifyFetch();
    }));
    const result = env.lifetime("install").catch((error) => error);
    await fetching;
    await vi.advanceTimersByTimeAsync(30_001);
    expect(await result).toBeInstanceOf(Error);
    const cache = env.caches.stores.get(env.registration.cacheName);
    expect([...cache.entries.keys()]).toEqual([CANDIDATE]);
  });
  it.each(["no-store", "private"])("rejects %s responses even with matching bytes", async (policy) => {
    const env = environment();
    env.worker.fetch.mockResolvedValue(new Response(env.bodies.get("/planet/ru/"), { headers: { "Cache-Control": policy } }));
    await expect(env.lifetime("install")).rejects.toThrow("immutable public");
  });
  it.each(["*", "Cookie", "Authorization"])("rejects private Vary %s responses", async (vary) => {
    const env = environment();
    env.worker.fetch.mockResolvedValue(new Response(env.bodies.get("/planet/ru/"), { headers: { Vary: vary } }));
    await expect(env.lifetime("install")).rejects.toThrow("immutable public");
  });
  it.each([
    ["/planet/ru/", "application/octet-stream"], ["/planet/en/", "text/plain"],
    ["/planet/assets/app-a.js", "application/octet-stream"], ["/planet/assets/app-a.js", "text/html"],
    ["/planet/assets/app-a.css", "text/plain"], ["/planet/assets/app-a.json", "text/html"],
  ])("rejects unusable MIME for %s before marking COMPLETE (%s)", async (pathname, contentType) => {
    const pkg = shell();
    if (!pkg.bodies.has(pathname)) {
      const body = "immutable fixture";
      pkg.bodies.set(pathname, body);
      pkg.config.files.push({ url: pathname, bytes: Buffer.byteLength(body), sha256: sha256(body), kind: "asset" });
    }
    const env = environment(pkg);
    const normalFetch = env.worker.fetch.getMockImplementation();
    env.worker.fetch.mockImplementation((request) => new URL(request.url).pathname === pathname
      ? new Response(pkg.bodies.get(pathname), { headers: { "Content-Type": contentType } }) : normalFetch(request));
    await expect(env.lifetime("install")).rejects.toThrow("Content-Type");
    const cache = env.caches.stores.get(env.registration.cacheName);
    expect(await cache.match(MARKER)).toBeUndefined();
    expect(await cache.match(ORIGIN + pathname)).toBeUndefined();
  });
  it("resumes multiple failed registrations using only exact files from the same normalized manifest", async () => {
    const storage = memoryCaches(), pkg = shell();
    const first = environment(pkg, storage);
    failDownload(first, "/planet/en/");
    await expect(first.lifetime("install")).rejects.toThrow("Interrupted download");
    expect(downloadedPaths(first)).toEqual(["/planet/assets/app-a.js", "/planet/en/"]);
    const second = environment(pkg, storage);
    failDownload(second, "/planet/ru/");
    await expect(second.lifetime("install")).rejects.toThrow("Interrupted download");
    expect(downloadedPaths(second)).toEqual(["/planet/en/", "/planet/ru/"]);
    const cache = storage.stores.get(first.registration.cacheName);
    expect(await cache.match(MARKER)).toBeUndefined();
    const final = environment(pkg, storage);
    await final.lifetime("install");
    expect(downloadedPaths(final)).toEqual(["/planet/ru/", "/planet/textures/antique-world.webp"]);
    expect(await cache.match(CANDIDATE)).toBeUndefined();
    expect(await cache.keys()).toHaveLength(pkg.config.files.length + 1);
    await final.lifetime("activate");
    final.worker.fetch.mockClear();
    for (const locale of ["ru", "en"]) expect(await (await final.fetchRequest(`/planet/${locale}/`, { mode: "navigate" })).text()).toContain(locale.toUpperCase() + " a");
    expect(final.worker.fetch).not.toHaveBeenCalled();
    expect(storage.delete).not.toHaveBeenCalled();
  });
  it("bounds failed builds to the latest candidate while preserving complete, damaged and unrelated caches", async () => {
    const storage = memoryCaches(), previous = environment(shell("a"), storage);
    await previous.lifetime("install"); await previous.lifetime("activate");
    const previousCache = storage.stores.get(previous.registration.cacheName), previousEntries = [...previousCache.entries];
    const unrelated = await storage.open("unrelated-app");
    await unrelated.put(ORIGIN + "/unrelated", new Response("preserve"));
    const damaged = await storage.open(PREFIX + "c".repeat(64));
    await damaged.put(MARKER, new Response("damaged COMPLETE", { headers: { Vary: "Cookie" } }));
    await damaged.put(CANDIDATE, new Response(JSON.stringify({ schemaVersion: 1, state: "CANDIDATE", buildId: "c".repeat(64), manifestSha256: "1".repeat(64) })));
    const malformed = await storage.open(PREFIX + "d".repeat(64));
    await malformed.put(CANDIDATE, new Response(JSON.stringify({ schemaVersion: 1, state: "CANDIDATE", buildId: "d".repeat(64), manifestSha256: ["1".repeat(64)] })));
    for (const build of ["b", "e", "f"]) {
      const attempt = environment(shell(build), storage);
      failDownload(attempt, "/planet/textures/antique-world.webp");
      await expect(attempt.lifetime("install")).rejects.toThrow("Interrupted download");
      expect(await storage.keys()).toEqual([previous.registration.cacheName, "unrelated-app", PREFIX + "c".repeat(64), PREFIX + "d".repeat(64), attempt.registration.cacheName]);
    }
    expect(storage.delete.mock.calls.map(([name]) => name)).toEqual([PREFIX + "b".repeat(64), PREFIX + "e".repeat(64)]);
    expect(storage.match).toHaveBeenCalledWith(MARKER, { cacheName: PREFIX + "c".repeat(64), ignoreVary: true });
    expect([...previousCache.entries]).toEqual(previousEntries);
    expect(await (await previous.fetchRequest("/planet/en/", { mode: "navigate" })).text()).toContain("EN a");
    expect(await (await unrelated.match(ORIGIN + "/unrelated")).text()).toBe("preserve");
  });
  it("refuses a same-build conflicting candidate without changing its files or metadata", async () => {
    const storage = memoryCaches(), first = environment(shell(), storage);
    failDownload(first, "/planet/textures/antique-world.webp");
    await expect(first.lifetime("install")).rejects.toThrow("Interrupted download");
    const cache = storage.stores.get(first.registration.cacheName), before = [...cache.entries];
    cache.put.mockClear(); cache.delete.mockClear();
    const changed = shell();
    changed.config.files.find(file => file.url.endsWith(".webp")).aliases = ["/planet/textures/antique-world.webp?v=different-binding"];
    const conflicting = environment(changed, storage);
    await expect(conflicting.lifetime("install")).rejects.toThrow("candidate is incompatible");
    expect(conflicting.worker.fetch).not.toHaveBeenCalled();
    expect(cache.put).not.toHaveBeenCalled(); expect(cache.delete).not.toHaveBeenCalled();
    expect([...cache.entries]).toEqual(before);
    expect(storage.delete).not.toHaveBeenCalled();
  });
  it.each(["hash", "MIME", "private"])("repairs a candidate with %s damage and prunes only its noncanonical entries", async damage => {
    const storage = memoryCaches(), first = environment(shell(), storage);
    failDownload(first, "/planet/textures/antique-world.webp");
    await expect(first.lifetime("install")).rejects.toThrow("Interrupted download");
    const cache = storage.stores.get(first.registration.cacheName), en = first.bodies.get("/planet/en/");
    const untouched = [cache.entries.get(ORIGIN + "/planet/assets/app-a.js"), cache.entries.get(ORIGIN + "/planet/ru/")];
    await cache.put(ORIGIN + "/planet/en/", new Response(damage === "hash" ? en.replace("EN", "XX") : en,
      { headers: { "Content-Type": damage === "MIME" ? "text/plain" : "text/html", ...(damage === "private" ? { "Cache-Control": "private" } : {}) } }));
    await cache.put(ORIGIN + "/planet/textures/antique-world.webp?v=sha256-canonical", new Response("unverified alias"));
    await cache.put(ORIGIN + "/planet/unlisted", new Response("unlisted"));
    const other = await storage.open("unrelated-app");
    await other.put(ORIGIN + "/unrelated", new Response("preserve"));
    const retry = environment(shell(), storage);
    await retry.lifetime("install");
    expect(downloadedPaths(retry)).toEqual(["/planet/en/", "/planet/textures/antique-world.webp"]);
    expect([cache.entries.get(ORIGIN + "/planet/assets/app-a.js"), cache.entries.get(ORIGIN + "/planet/ru/")]).toEqual(untouched);
    expect([...cache.entries.keys()].sort()).toEqual([...retry.config.files.map(file => ORIGIN + file.url), MARKER].sort());
    expect(await (await other.match(ORIGIN + "/unrelated")).text()).toBe("preserve");
    expect(storage.delete).not.toHaveBeenCalled();
  });
  it("revalidates all candidate files before COMPLETE and resumes a final eviction", async () => {
    const env = environment(), cache = await env.caches.open(env.registration.cacheName);
    const put = cache.put.getMockImplementation();
    cache.put.mockImplementation(async (request, response) => {
      await put(request, response);
      if (absolute(request).endsWith(".webp")) await cache.delete(ORIGIN + "/planet/ru/");
    });
    await expect(env.lifetime("install")).rejects.toThrow("immutable public content");
    expect(await cache.match(MARKER)).toBeUndefined();
    expect(await cache.match(CANDIDATE)).toBeDefined();
    cache.put.mockImplementation(put);
    const retry = environment(shell(), env.caches);
    await retry.lifetime("install");
    expect(downloadedPaths(retry)).toEqual(["/planet/ru/"]);
    expect(await cache.match(MARKER)).toBeDefined();
  });
  it("retries a failed COMPLETE write in the same worker without downloading verified files again", async () => {
    const env = environment();
    env.caches.putFailure = (_name, url) => url === MARKER;
    await expect(env.lifetime("install")).rejects.toThrow("Quota exceeded");
    const cache = env.caches.stores.get(env.registration.cacheName);
    expect(await cache.match(CANDIDATE)).toBeDefined();
    expect(await cache.match(MARKER)).toBeUndefined();
    expect(await cache.keys()).toHaveLength(env.config.files.length + 1);
    env.caches.putFailure = undefined; env.worker.fetch.mockClear();
    await env.lifetime("install");
    expect(env.worker.fetch).not.toHaveBeenCalled();
    expect(await cache.match(MARKER)).toBeDefined();
    expect(await cache.match(CANDIDATE)).toBeUndefined();
  });
  it("does not download files before a candidate binding can be persisted", async () => {
    const env = environment();
    env.caches.putFailure = (_name, url) => url === CANDIDATE;
    await expect(env.lifetime("install")).rejects.toThrow("Quota exceeded");
    expect(env.worker.fetch).not.toHaveBeenCalled();
    expect(env.caches.stores.get(env.registration.cacheName).entries.size).toBe(0);
    env.caches.putFailure = undefined;
    await env.lifetime("install");
    expect(env.worker.fetch).toHaveBeenCalledTimes(env.config.files.length);
  });
  it.each(["invalid JSON", "unknown fields", "oversized"])("refuses %s candidate metadata without adopting its bytes", async damage => {
    const env = environment(), cache = await env.caches.open(env.registration.cacheName);
    const marker = { schemaVersion: 1, state: "CANDIDATE", buildId: env.config.buildId, manifestSha256: sha256(JSON.stringify(normalizePwaWorkerConfig(env.config))) };
    const text = damage === "invalid JSON" ? "{" : damage === "oversized" ? " ".repeat(1025) + JSON.stringify(marker) : JSON.stringify({ ...marker, extra: true });
    await cache.put(CANDIDATE, new Response(text));
    await cache.put(ORIGIN + "/planet/ru/", new Response(env.bodies.get("/planet/ru/"), { headers: { "Content-Type": "text/html" } }));
    const before = [...cache.entries]; cache.put.mockClear(); cache.delete.mockClear();
    await expect(env.lifetime("install")).rejects.toThrow();
    expect(env.worker.fetch).not.toHaveBeenCalled();
    expect(cache.put).not.toHaveBeenCalled(); expect(cache.delete).not.toHaveBeenCalled();
    expect([...cache.entries]).toEqual(before);
  });
  it("does not overwrite an existing completed build on reinstall or caller config mutation", async () => {
    const env = environment();
    env.config.files[0].sha256 = "f".repeat(64);
    await env.lifetime("install");
    env.worker.fetch.mockRejectedValue(new Error("Offline"));
    await env.lifetime("install");
    expect(env.worker.fetch).toHaveBeenCalledTimes(env.config.files.length);
    const fresh = environment(shell(), env.caches);
    fresh.worker.fetch.mockRejectedValue(new Error("Offline"));
    await fresh.lifetime("install");
    expect(fresh.worker.fetch).not.toHaveBeenCalled();
    expect(env.caches.delete).not.toHaveBeenCalled();
  });
  it("preserves existing completed data if a conflicting manifest reuses its build ID", async () => {
    const storage = memoryCaches();
    const previous = environment(shell("a"), storage);
    await previous.lifetime("install");
    const pkg = shell("b");
    pkg.config.buildId = previous.config.buildId;
    const conflicting = environment(pkg, storage);
    await expect(conflicting.lifetime("install")).rejects.toThrow("do not overwrite");
    expect(storage.delete).not.toHaveBeenCalled();
    expect(await (await previous.fetchRequest("/planet/ru/", { mode: "navigate" })).text()).toContain("RU a");
  });
  it("retains one intact previous version and preserves unrelated application caches", async () => {
    const storage = memoryCaches();
    await storage.open("probpera-v3-static");
    await storage.open(PREFIX + "not-a-build");
    const first = environment(shell("a"), storage);
    await first.lifetime("install");
    await first.lifetime("activate");
    const second = environment(shell("b"), storage);
    await second.lifetime("install");
    await second.lifetime("activate");
    const current = environment(shell("c"), storage);
    await current.lifetime("install");
    await current.lifetime("activate");
    expect(await storage.keys()).toEqual(["probpera-v3-static", PREFIX + "not-a-build", second.registration.cacheName, current.registration.cacheName]);
  });
  it("retains the previous active build after a clock rollback and ignores never-activated candidates", async () => {
    const now = vi.spyOn(Date, "now");
    const storage = memoryCaches();
    const first = environment(shell("a"), storage);
    now.mockReturnValue(3000);
    await first.lifetime("install");
    await first.lifetime("activate");
    const previous = environment(shell("b"), storage);
    now.mockReturnValue(2000);
    await previous.lifetime("install");
    await previous.lifetime("activate");
    const waiting = environment(shell("c"), storage);
    now.mockReturnValue(9000);
    await waiting.lifetime("install");
    const current = environment(shell("d"), storage);
    now.mockReturnValue(4000);
    await current.lifetime("install");
    await current.lifetime("activate");
    expect(await storage.keys()).toEqual([previous.registration.cacheName, current.registration.cacheName]);
    const marker = await (await (await storage.open(current.registration.cacheName)).match(MARKER)).json();
    expect(marker.activationSequence).toBe(3);
    expect(marker.completedAt).toBe(4000);
  });
  it("preserves previous caches if activation metadata cannot be persisted", async () => {
    const storage = memoryCaches();
    const first = environment(shell("a"), storage);
    await first.lifetime("install");
    await first.lifetime("activate");
    const current = environment(shell("b"), storage);
    await current.lifetime("install");
    storage.putFailure = (_name, url) => url === MARKER;
    await expect(current.lifetime("activate")).rejects.toThrow("Quota");
    expect(await storage.keys()).toEqual([first.registration.cacheName, current.registration.cacheName]);
    expect(storage.delete).not.toHaveBeenCalled();
    expect(current.worker.clients.claim).not.toHaveBeenCalled();
  });
  it("refuses activation after essential cache bytes are damaged", async () => {
    const env = environment();
    await env.lifetime("install");
    const cache = await env.caches.open(env.registration.cacheName);
    await cache.put(ORIGIN + "/planet/en/", new Response("corrupt"));
    await expect(env.lifetime("activate")).rejects.toThrow("incomplete shell");
    expect(env.worker.clients.claim).not.toHaveBeenCalled();
  });
});

describe("strict app-only request handling", () => {
  it.each(["ru", "en"])("serves the same verified %s shell offline with the canonical #atlas navigation state", async (locale) => {
    const env = environment();
    await env.lifetime("install");
    env.worker.fetch.mockRejectedValue(new Error("Offline"));
    const response = await env.fetchRequest(`/planet/${locale}/?country=russia#atlas`, { mode: "navigate" });
    expect(await response.text()).toContain(locale === "ru" ? "RU a" : "EN a");
    expect(env.worker.fetch).toHaveBeenCalledTimes(env.config.files.length);
  });
  it.each(["#bad%00", "#bad%0A", "#bad%7f", "#bad%zz", "#" + "a".repeat(512)])("does not accept unsafe or oversized navigation fragment %s", async (fragment) => {
    const env = environment();
    expect(env.fetchRequest("/planet/en/" + fragment, { mode: "navigate" })).toBeNull();
    env.client.url = ORIGIN + "/planet/en/" + fragment;
    await env.send({ type: "PLANET_UPDATE_STATUS", requestId: "unsafe-fragment" });
    expect(env.client.postMessage).not.toHaveBeenCalled();
  });
  it("does not extend asset hash/query aliases or private navigation because a safe fragment exists", async () => {
    const env = environment();
    expect(env.fetchRequest("/planet/assets/app-a.js#atlas")).toBeNull();
    expect(env.fetchRequest("/planet/en/?mode=child#atlas", { mode: "navigate" })).toBeNull();
    expect(env.fetchRequest("/planet/api/license#atlas", { mode: "navigate" })).toBeNull();
  });
  it("serves the explicit neutral installed start URL offline with safe selection queries", async () => {
    const env = environment(shell("a", true));
    await env.lifetime("install");
    env.worker.fetch.mockRejectedValue(new Error("Offline"));
    const response = await env.fetchRequest("/planet/?country=russia&writer=tolstoy", { mode: "navigate" });
    expect(await response.text()).toContain("NEUTRAL a");
    expect(env.worker.fetch).toHaveBeenCalledTimes(env.config.files.length);
    for (const query of ["?mode=child", "?token=private", "?cms-edit=1", "?country=a&country=b"]) {
      expect(env.fetchRequest("/planet/" + query, { mode: "navigate" })).toBeNull();
    }
    expect(environment().fetchRequest("/planet/", { mode: "navigate" })).toBeNull();
  });
  it("serves exact locales, safe selection query and version aliases while offline", async () => {
    const env = environment();
    await env.lifetime("install");
    env.worker.fetch.mockRejectedValue(new Error("Offline"));
    for (const [locale, expected] of [["ru", "RU a"], ["en", "EN a"]]) {
      const response = await env.fetchRequest(`/planet/${locale}/?country=russia&writer=tolstoy&atlasView=immersive&book=russia%3Atolstoy%3Awar-and-peace`, { mode: "navigate" });
      expect(await response.text()).toContain(expected);
    }
    const alias = await env.fetchRequest("/planet/textures/antique-world.webp?v=sha256-canonical");
    expect(await alias.text()).toBe(env.bodies.get("/planet/textures/antique-world.webp"));
    expect(alias.headers.get("X-Literary-Planet-Build")).toBe(env.config.buildId);
    expect(env.worker.fetch).toHaveBeenCalledTimes(env.config.files.length);
  });
  it.each([
    ["/", "navigate"], ["/planet", "navigate"], ["/planet/ru/child/", "navigate"], ["/planet/child/", "navigate"], ["/planet/en/?mode=child", "navigate"], ["/planet/en/?cms-edit=1", "navigate"], ["/planet/en/?token=secret", "navigate"], ["/planet/en/?country=a&country=b", "navigate"], ["/planet/en/?country=%00", "navigate"], ["/planet/fr/", "navigate"], ["/planet/api/license", undefined], ["/planet/private/content.json", undefined], ["/planet/assets/app-a.js?auth=1", undefined], ["/planet/textures/antique-world.webp?v=other", undefined], ["/planet/textures/antique-world.webp?v=sha256-canonical&v=sha256-canonical", undefined], ["/planet/en/", undefined], ["/planet/assets/app-a.js", "navigate"], ["https://other.test/planet/assets/app-a.js", undefined],
  ])("never intercepts excluded request %s", async (url, mode) => {
    const env = environment();
    expect(env.fetchRequest(url, { mode })).toBeNull();
    expect(env.caches.open).not.toHaveBeenCalled();
    expect(env.worker.fetch).not.toHaveBeenCalled();
  });
  it.each([
    { method: "POST" }, { headers: { Authorization: "Bearer test" } }, { headers: { Range: "bytes=0-1" } }, { headers: { "X-API-Key": "test" } }, { headers: { "X-CMS-Edit": "1" } },
  ])("does not intercept authenticated, partial or non-GET requests %#", (options) => {
    const env = environment();
    expect(env.fetchRequest("/planet/assets/app-a.js", options)).toBeNull();
  });
  it("fails closed without a marker and does not fetch a half-installed shell", async () => {
    const env = environment();
    const response = await env.fetchRequest("/planet/ru/", { mode: "navigate" });
    expect(response.type).toBe("error");
    expect(env.worker.fetch).not.toHaveBeenCalled();
  });
  it("repairs only an exact missing asset and rejects corrupt offline bytes without old-build fallback", async () => {
    const env = environment();
    await env.lifetime("install");
    const cache = await env.caches.open(env.registration.cacheName);
    await cache.delete(ORIGIN + "/planet/assets/app-a.js");
    const repaired = await env.fetchRequest("/planet/assets/app-a.js");
    expect(await repaired.text()).toBe(env.bodies.get("/planet/assets/app-a.js"));
    await cache.put(ORIGIN + "/planet/en/", new Response("unverified adult fallback"));
    env.worker.fetch.mockRejectedValue(new Error("Offline"));
    expect((await env.fetchRequest("/planet/en/", { mode: "navigate" })).type).toBe("error");
  });
});

describe("explicit authenticated update messages", () => {
  it.each(["/planet/?country=russia#atlas", "/planet/ru/?country=russia#atlas", "/planet/en/?country=russia#atlas"])("discovers and explicitly activates a waiting update from %s without altering navigation", async (pathname) => {
    const env = environment(shell("a", true));
    await env.lifetime("install");
    env.client.url = ORIGIN + pathname;
    await env.send({ type: "PLANET_UPDATE_STATUS", requestId: "atlas-discovery" });
    expect(env.client.postMessage).toHaveBeenLastCalledWith({ type: "PLANET_UPDATE_STATUS_RESULT", requestId: "atlas-discovery", buildId: env.config.buildId, ready: true });
    expect(env.worker.skipWaiting).not.toHaveBeenCalled();
    await env.send({ type: "PLANET_ACTIVATE_UPDATE", requestId: "atlas-update", buildId: env.config.buildId });
    expect(env.worker.skipWaiting).toHaveBeenCalledOnce();
    expect(env.client.url).toBe(ORIGIN + pathname);
  });
  it("allows authorized status discovery without a known future build ID, never activation discovery", async () => {
    const env = environment();
    await env.lifetime("install");
    await env.send({ type: "PLANET_UPDATE_STATUS", requestId: "discover" });
    expect(env.client.postMessage).toHaveBeenLastCalledWith({ type: "PLANET_UPDATE_STATUS_RESULT", requestId: "discover", buildId: env.config.buildId, ready: true });
    expect(env.worker.skipWaiting).not.toHaveBeenCalled();
    env.client.postMessage.mockClear();
    await env.send({ type: "PLANET_ACTIVATE_UPDATE", requestId: "missing-build" });
    await env.send({ type: "PLANET_UPDATE_STATUS", requestId: "wrong-build", buildId: "b".repeat(64) });
    await env.send({ type: "PLANET_UPDATE_STATUS", requestId: "undefined-build", buildId: undefined });
    env.client.url = ORIGIN + "/";
    await env.send({ type: "PLANET_UPDATE_STATUS", requestId: "unauthorized" });
    expect(env.worker.skipWaiting).not.toHaveBeenCalled();
    expect(env.client.postMessage).not.toHaveBeenCalled();
  });
  it("exposes readiness only on request and activates only on an exact explicit request", async () => {
    const env = environment();
    await env.lifetime("install");
    const request = { buildId: env.config.buildId, requestId: "user-request-1" };
    expect(env.client.postMessage).not.toHaveBeenCalled();
    await env.send({ ...request, type: "PLANET_UPDATE_STATUS" });
    expect(env.client.postMessage).toHaveBeenLastCalledWith({ ...request, type: "PLANET_UPDATE_STATUS_RESULT", ready: true });
    expect(env.worker.skipWaiting).not.toHaveBeenCalled();
    await env.send({ ...request, type: "PLANET_ACTIVATE_UPDATE" });
    expect(env.worker.skipWaiting).toHaveBeenCalledOnce();
    expect(env.client.postMessage).toHaveBeenLastCalledWith({ ...request, type: "PLANET_UPDATE_ACTIVATION_RESULT", accepted: true });
  });
  it.each(["missing source", "message port", "unknown client", "foreign origin", "public site", "child client", "encoded admin client", "unknown scoped client", "private query client", "unconfigured root client", "spoofed URL", "wrong event origin", "wrong build", "legacy skipWaiting"])("ignores %s without activation or replies", async (reason) => {
    const env = environment();
    await env.lifetime("install");
    const fields = {};
    const data = { type: "PLANET_ACTIVATE_UPDATE", buildId: env.config.buildId, requestId: "test" };
    if (reason === "missing source") fields.source = null;
    if (reason === "message port") fields.source = { type: "messageport", id: env.client.id };
    if (reason === "unknown client") fields.source = { type: "window", id: "not-known" };
    if (reason === "foreign origin") env.client.url = "https://other.test/planet/ru/";
    if (reason === "public site") env.client.url = ORIGIN + "/ru/";
    if (reason === "child client") env.client.url = ORIGIN + "/planet/child/";
    if (reason === "encoded admin client") env.client.url = ORIGIN + "/planet/%61dmin/";
    if (reason === "unknown scoped client") env.client.url = ORIGIN + "/planet/arbitrary/";
    if (reason === "private query client") env.client.url = ORIGIN + "/planet/en/?mode=child";
    if (reason === "unconfigured root client") env.client.url = ORIGIN + "/planet/";
    if (reason === "spoofed URL") { fields.source = { ...env.client }; env.client.url = ORIGIN + "/private/"; }
    if (reason === "wrong event origin") fields.origin = "https://other.test";
    if (reason === "wrong build") data.buildId = "b".repeat(64);
    if (reason === "legacy skipWaiting") data.type = "SKIP_WAITING";
    await env.send(data, fields);
    expect(env.worker.skipWaiting).not.toHaveBeenCalled();
    expect(env.client.postMessage).not.toHaveBeenCalled();
  });
  it("accepts explicit update requests from the configured neutral start URL", async () => {
    const env = environment(shell("a", true));
    await env.lifetime("install");
    env.client.url = ORIGIN + "/planet/?country=russia";
    await env.send({ type: "PLANET_ACTIVATE_UPDATE", buildId: env.config.buildId, requestId: "root-update" });
    expect(env.worker.skipWaiting).toHaveBeenCalledOnce();
  });
  it("rejects incomplete activation and rechecks source after asynchronous integrity verification", async () => {
    const env = environment();
    const data = { type: "PLANET_ACTIVATE_UPDATE", buildId: env.config.buildId, requestId: "test" };
    await env.send(data);
    expect(env.client.postMessage).toHaveBeenLastCalledWith({ ...data, type: "PLANET_UPDATE_ACTIVATION_RESULT", accepted: false });
    expect(env.worker.skipWaiting).not.toHaveBeenCalled();
    await env.lifetime("install");
    env.client.postMessage.mockClear();
    env.worker.clients.get.mockResolvedValueOnce(env.client).mockResolvedValue({ ...env.client, url: ORIGIN + "/private/" });
    await env.send(data);
    expect(env.worker.skipWaiting).not.toHaveBeenCalled();
    expect(env.client.postMessage).not.toHaveBeenCalled();
  });
});
