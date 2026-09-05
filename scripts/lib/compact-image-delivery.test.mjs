import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compactImageDeliveryManifest } from "./compact-image-delivery.mjs";
import { createImageDeliveryResolver, expandImageDeliveryManifest } from "../../src/utils/imageDeliveryModel.ts";

const source = "https://images.example.org/art.png?revision=2#detail";
const full = { src: "media/art-original.png", width: 2100, height: 1377 };
const small = { src: "media/art-640w.webp", width: 640, height: 420 };

describe("compact image delivery manifest", () => {
  it("round trips exact URLs, dimensions, variants and source aliases without an extra request", () => {
    const entry = { ...full, variants: [small, full] };
    const manifest = {
      [source]: entry,
      "https://other.example.org/другая%20копия.png?rev=1&token=public": entry,
      "/brand/local.png": { src: "brand/local.png", width: 31, height: 57, variants: [] },
    };
    const compact = compactImageDeliveryManifest(manifest);
    expect(compact.images).toHaveLength(2);
    expect(expandImageDeliveryManifest(compact)).toEqual(manifest);
    const expanded = createImageDeliveryResolver(expandImageDeliveryManifest(compact), "/journal/");
    const original = createImageDeliveryResolver(manifest, "/journal/");
    for (const input of [source, ...Object.keys(manifest), "/journal/media/art-640w.webp", "https://site.example/journal/media/art-640w.webp"]) {
      expect(expanded.attributes(input, 1900, "880px")).toEqual(original.attributes(input, 1900, "880px"));
      expect(expanded.original(input)).toBe(original.original(input));
    }
  });

  it("preserves a largest rendition omitted from the responsive variants", () => {
    const manifest = { [source]: { ...full, variants: [small] } };
    expect(expandImageDeliveryManifest(compactImageDeliveryManifest(manifest))).toEqual(manifest);
  });

  it("handles an empty inventory and rejects unsupported schema versions", () => {
    expect(expandImageDeliveryManifest(compactImageDeliveryManifest({}))).toEqual({});
    expect(() => expandImageDeliveryManifest({ version: 2 })).toThrow("Unsupported image delivery manifest version");
  });

  it("keeps every committed image URL and responsive/full-resolution lookup identical", () => {
    const manifest = JSON.parse(readFileSync(new URL("../../src/data/imageDelivery.generated.json", import.meta.url), "utf8"));
    const compact = JSON.parse(readFileSync(new URL("../../src/data/imageDelivery.compact.generated.json", import.meta.url), "utf8"));
    expect(compact).toEqual(compactImageDeliveryManifest(manifest));
    const decoded = expandImageDeliveryManifest(compact);
    expect(decoded).toEqual(manifest);
    // The encoding must materially reduce parsed JS, not merely move a large eager dependency.
    expect(JSON.stringify(compact).length).toBeLessThan(JSON.stringify(manifest).length * 0.45);
    for (const base of ["/", "/journal/"]) {
      const original = createImageDeliveryResolver(manifest, base);
      const expanded = createImageDeliveryResolver(decoded, base);
      for (const [sourceUrl, entry] of Object.entries(manifest)) {
        for (const width of [390, 1280, 10000]) {
          expect(expanded.attributes(sourceUrl, width, "880px")).toEqual(original.attributes(sourceUrl, width, "880px"));
        }
        for (const rendition of [entry, ...entry.variants]) {
          const url = `https://site.example${base}${rendition.src}`;
          expect(expanded.original(url)).toBe(original.original(url));
          expect(expanded.url(url, 10000)).toBe(original.url(url, 10000));
        }
      }
    }
  });
});
