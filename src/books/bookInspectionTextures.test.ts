import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import { buildBookEditorialDocument } from "./bookEditorialPages";
import {
  BookInspectionTextureLru,
  BookInspectionTextureStore,
  createBookInspectionTextureCacheKey,
  resolveBookInspectionTexturePlan,
} from "./bookInspectionTextures";

const document = buildBookEditorialDocument({
  bookKey: "book-1",
  locale: "ru",
  themeVersion: "theme-v2",
  title: "Книга",
  writer: "Автор",
});

describe("book inspection textures", () => {
  it("uses bounded quality-specific page surfaces", () => {
    const high = resolveBookInspectionTexturePlan("HIGH");
    const balanced = resolveBookInspectionTexturePlan("BALANCED");
    const economy = resolveBookInspectionTexturePlan("ECONOMY");

    expect(high).toMatchObject({ width: 1_400, height: 2_000, dpi: 192 });
    expect(balanced).toMatchObject({ width: 980, height: 1_400, dpi: 144 });
    expect(economy).toMatchObject({ width: 560, height: 800, dpi: 96 });
    expect(high.estimatedRgbaBytes).toBeGreaterThan(
      balanced.estimatedRgbaBytes
    );
    expect(balanced.estimatedRgbaBytes).toBeGreaterThan(
      economy.estimatedRgbaBytes
    );
    expect(resolveBookInspectionTexturePlan("HIGH", 10).width).toBe(1_560);
    expect(resolveBookInspectionTexturePlan("HIGH", 0).width).toBe(1_240);
  });

  it("pins document, page, quality, typography, layout and theme in the resource key", () => {
    const key = createBookInspectionTextureCacheKey({
      documentCacheKey: document.cacheKey,
      page: document.pages[0],
      quality: "HIGH",
    });

    expect(key).toBe(
      `${document.cacheKey}|page=0:identity|quality=HIGH|owner-book-typography-v2|book-inspection-layout-v3|{}`
    );
  });

  it("evicts least-recently-used resources and disposes them", () => {
    const disposeA = vi.fn();
    const disposeB = vi.fn();
    const disposeC = vi.fn();
    const cache = new BookInspectionTextureLru(2);
    const a = { dispose: disposeA };
    const b = { dispose: disposeB };
    const c = { dispose: disposeC };

    cache.set("a", a);
    cache.set("b", b);
    expect(cache.get("a")).toBe(a);
    cache.set("c", c);

    expect(cache.size).toBe(2);
    expect(disposeA).not.toHaveBeenCalled();
    expect(disposeB).toHaveBeenCalledOnce();
    cache.clear();
    expect(disposeA).toHaveBeenCalledOnce();
    expect(disposeC).toHaveBeenCalledOnce();
  });

  it("cancels stale generations before browser canvas allocation", async () => {
    const store = new BookInspectionTextureStore();
    const stale = store.beginGeneration();
    const pending = store.request(
      {
        documentCacheKey: document.cacheKey,
        page: document.pages[0],
        quality: "BALANCED",
      },
      stale
    );
    const current = store.beginGeneration();

    await expect(pending).resolves.toBeNull();
    expect(stale.isCurrent()).toBe(false);
    expect(current.isCurrent()).toBe(true);
    store.dispose();
    expect(current.isCurrent()).toBe(false);
  });

  it("is browser-lazy and contains no network or audio path", async () => {
    const source = readFileSync(
      new URL("./bookInspectionTextures.ts", import.meta.url),
      "utf8"
    );
    expect(source).toContain("globalThis.OffscreenCanvas");
    expect(source).toContain('document.createElement("canvas")');
    expect(source).not.toMatch(/\bfetch\s*\(/u);
    expect(source).not.toMatch(/new\s+Audio\b|AudioContext|<audio/iu);

    const store = new BookInspectionTextureStore();
    const generation = store.beginGeneration();
    await expect(
      store.request(
        {
          documentCacheKey: document.cacheKey,
          page: document.pages[0],
          quality: "ECONOMY",
        },
        generation
      )
    ).resolves.toBeNull();
    expect(store.size).toBe(0);
  });
});
