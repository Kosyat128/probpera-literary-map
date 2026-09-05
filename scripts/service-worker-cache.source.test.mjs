import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

const source = readFileSync(
  path.join(process.cwd(), "public", "sw.js"),
  "utf8"
);

function numericConstant(name) {
  const match = source.match(new RegExp(`const ${name} = (\\d+);`, "u"));
  return Number(match?.[1] || 0);
}

describe("service worker cache bounds", () => {
  it("leaves the exact PWA subtree to its own worker before and after activation", async () => {
    const handlers = new Map();
    const fetch = vi.fn(async () => new Response("site", { headers: { "Cache-Control": "no-store" } }));
    const worker = { registration: { scope: "https://probpera.ru/" }, location: { origin: "https://probpera.ru" }, addEventListener: (name, handler) => handlers.set(name, handler) };
    vm.runInNewContext(source, { self: worker, URL, fetch, Response });
    for (const pathname of ["/planet", "/planet/ru/", "/planet/assets/runtime.js", "/planet/api/license?token=private", "/p%6canet/ru/", "/planet%2Fapi/license", "/%70lanet", "/invalid%zz"]) {
      const respondWith = vi.fn();
      handlers.get("fetch")({ request: { url: "https://probpera.ru" + pathname, method: "GET", mode: "navigate" }, respondWith });
      expect(respondWith).not.toHaveBeenCalled();
    }
    expect(fetch).not.toHaveBeenCalled();
    let response;
    handlers.get("fetch")({ request: { url: "https://probpera.ru/planetarium/", method: "GET", mode: "navigate" }, respondWith: (promise) => { response = promise; } });
    expect(await (await response).text()).toBe("site");
    expect(fetch).toHaveBeenCalledOnce();
  });

  it.each(["/", "/preview/"])("cleans only exact owned legacy caches for site scope %s", async (scope) => {
    const handlers = new Map();
    const names = ["probpera-v1-static", "probpera-v1-pages", "probpera-v2-static", "probpera-v2-pages", "probpera-v3-static", "probpera-v3-pages", "probpera-v2-static-other", "literary-planet-pwa-v1-" + "a".repeat(64), "other-application-cache"];
    const storage = {
      keys: vi.fn(async () => names),
      delete: vi.fn(async () => true),
      open: vi.fn(async () => ({ keys: async () => [] })),
    };
    const worker = {
      registration: { scope: "https://probpera.ru" + scope },
      location: { origin: "https://probpera.ru" },
      addEventListener: (name, handler) => handlers.set(name, handler),
      clients: { claim: vi.fn(async () => undefined) },
    };
    vm.runInNewContext(source, { self: worker, caches: storage, URL });
    let completion;
    handlers.get("activate")({ waitUntil: (promise) => { completion = promise; } });
    await completion;
    expect(storage.delete.mock.calls.map(([name]) => name)).toEqual(scope === "/" ? names.slice(0, 4) : []);
    expect(worker.clients.claim).toHaveBeenCalledOnce();
  });

  it("keeps both runtime caches within deliberate limits", () => {
    const staticLimit = numericConstant("STATIC_CACHE_LIMIT");
    const pageLimit = numericConstant("PAGE_CACHE_LIMIT");

    expect(staticLimit).toBeGreaterThan(0);
    expect(staticLimit).toBeLessThanOrEqual(200);
    expect(pageLimit).toBeGreaterThan(0);
    expect(pageLimit).toBeLessThanOrEqual(50);
    expect(source).toContain("async function trimCache(cacheName, maxEntries)");
    expect(source).toContain("trimCache(STATIC_CACHE, STATIC_CACHE_LIMIT)");
    expect(source).toContain("trimCache(PAGE_CACHE, PAGE_CACHE_LIMIT)");
  });

  it("does not retain no-store responses or search stale cache generations", () => {
    expect(source).toContain('response.headers.get("Cache-Control")');
    expect(source).toContain("no-store");
    expect(source).toContain("return await cache.match(request)");
    expect(source).not.toContain("const cached = await caches.match(request)");
  });

  it("keeps a fresh response usable when runtime cache maintenance fails", () => {
    expect(source).toContain("async function rememberResponse");
    expect(source).toContain("async function cachedResponse");
    expect(source).toContain("await cache.put(request, response.clone())");
    expect(source).toContain("never hide a fresh response");
    expect(source).toContain(
      "await rememberResponse(PAGE_CACHE, request, response, PAGE_CACHE_LIMIT)"
    );
    expect(source).toContain(
      "await rememberResponse(STATIC_CACHE, request, response, STATIC_CACHE_LIMIT)"
    );
  });

  it("attempts network-first requests before touching CacheStorage", () => {
    const networkFirst = source.slice(
      source.indexOf("async function networkFirst"),
      source.indexOf("async function cacheFirst")
    );
    expect(networkFirst.indexOf("await fetch(request)")).toBeLessThan(
      networkFirst.indexOf("cachedResponse(PAGE_CACHE, request)")
    );
    expect(networkFirst).not.toContain("await caches.open(PAGE_CACHE)");

    const cacheFirst = source.slice(
      source.indexOf("async function cacheFirst"),
      source.indexOf('self.addEventListener("fetch"')
    );
    expect(cacheFirst).toContain("await cachedResponse(STATIC_CACHE, request)");
    expect(cacheFirst).toContain("const response = await fetch(request)");
    expect(cacheFirst).not.toContain("await caches.open(STATIC_CACHE)");
  });

  it("does not block installation or activation on optional cleanup", () => {
    expect(source.match(/\.catch\(\(\) => undefined\)/gu)).toHaveLength(2);
    expect(source).toContain("Promise.allSettled([");
    expect(source).toContain(".then(() => self.skipWaiting())");
    expect(source).toContain(".then(() => self.clients.claim())");
  });
});
