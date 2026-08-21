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
    expect(source).toContain("const cached = await cache.match(request)");
    expect(source).not.toContain("const cached = await caches.match(request)");
  });
});
