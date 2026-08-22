import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  path.join(process.cwd(), "public", "sw.js"),
  "utf8"
);

function numericConstant(name) {
  const match = source.match(new RegExp(`const ${name} = (\\d+);`, "u"));
  return Number(match?.[1] || 0);
}

describe("service worker cache bounds", () => {
  it("rotates the cache generation and removes older namespaces", () => {
    expect(source).toContain('const CACHE_VERSION = "probpera-v3"');
    expect(source).toContain(".filter((key) => !key.startsWith(CACHE_VERSION))");
    expect(source).toContain("caches.delete(key)");
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
