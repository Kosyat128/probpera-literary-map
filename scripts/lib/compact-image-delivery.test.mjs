import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compactImageDeliveryManifest, partitionImageDeliveryManifest } from "./compact-image-delivery.mjs";
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

  it("defers only article-body-only images while keeping covers, CMS pages and unknown contexts immediate", () => {
    const entry = { ...full, variants: [small, full] };
    const manifest = Object.fromEntries(["body", "cover", "shared", "page", "homepage", "css", "unknown"].map(key => [key, entry]));
    const records = [
      { sourceUrl: "body", contexts: ["public/articles/legacy.json", "public/cms/articles/cms-one.json"] },
      { sourceUrl: "cover", contexts: ["public/articles/legacy.json:imageUrl"] },
      { sourceUrl: "shared", contexts: ["public/articles/legacy.json", "src/App.tsx"] },
      { sourceUrl: "page", contexts: ["public/cms/pages/about.json"] },
      { sourceUrl: "homepage", contexts: ["public/cms/site.json"] },
      { sourceUrl: "css", contexts: ["src/index.css"] },
    ];
    const partition = partitionImageDeliveryManifest(manifest, records);
    expect(Object.keys(partition.articles)).toEqual(["body"]);
    expect(Object.keys(partition.initial)).toEqual(["cover", "shared", "page", "homepage", "css", "unknown"]);
    expect({ ...partition.initial, ...partition.articles }).toEqual(manifest);
  });

  it("refreshes previously built reverse aliases when a reader registers its images", () => {
    const entry = { ...full, variants: [small, full] };
    const initial = { "https://example.org/a.png": entry };
    const added = { "https://example.org/z.png": entry, [source]: { src: "media/other.webp", width: 30, height: 20, variants: [] } };
    const resolver = createImageDeliveryResolver(initial, "/journal/");
    expect(resolver.original("/journal/media/art-640w.webp")).toBe("https://example.org/a.png");
    resolver.register(added);
    expect(resolver.original("/journal/media/art-640w.webp")).toBe("https://example.org/z.png");
    expect(resolver.url(source)).toBe("/journal/media/other.webp");
  });

  it("keeps every committed image URL and responsive/full-resolution lookup identical", () => {
    const manifest = JSON.parse(readFileSync(new URL("../../src/data/imageDelivery.generated.json", import.meta.url), "utf8"));
    const report = JSON.parse(readFileSync(new URL("../../reports/public-image-delivery.json", import.meta.url), "utf8"));
    const compactInitial = JSON.parse(readFileSync(new URL("../../src/data/imageDelivery.initial.generated.json", import.meta.url), "utf8"));
    const compactArticles = JSON.parse(readFileSync(new URL("../../src/data/imageDelivery.articles.generated.json", import.meta.url), "utf8"));
    const partition = partitionImageDeliveryManifest(manifest, report.images);
    expect(compactInitial).toEqual(compactImageDeliveryManifest(partition.initial));
    expect(compactArticles).toEqual(compactImageDeliveryManifest(partition.articles));
    const initial = expandImageDeliveryManifest(compactInitial), articles = expandImageDeliveryManifest(compactArticles);
    expect(Object.keys(initial).filter(source => source in articles)).toEqual([]);
    expect({ ...initial, ...articles }).toEqual(manifest);
    // The encoding must materially reduce parsed JS, not merely move a large eager dependency.
    expect(JSON.stringify(compactInitial).length + JSON.stringify(compactArticles).length).toBeLessThan(JSON.stringify(manifest).length * 0.45);
    for (const base of ["/", "/journal/"]) {
      const original = createImageDeliveryResolver(manifest, base);
      const expanded = createImageDeliveryResolver(initial, base);
      const previousAliases = new Map();
      for (const [sourceUrl, entry] of Object.entries(manifest)) {
        for (const rendition of [entry, ...entry.variants]) previousAliases.set(rendition.src, sourceUrl);
      }
      // Build the homepage's alias cache before the lazy article module arrives.
      expanded.original(`${base}${Object.values(initial)[0].src}`);
      expanded.register(articles);
      for (const [sourceUrl, entry] of Object.entries(manifest)) {
        for (const width of [390, 1280, 10000]) {
          expect(expanded.attributes(sourceUrl, width, "880px")).toEqual(original.attributes(sourceUrl, width, "880px"));
        }
        for (const rendition of [entry, ...entry.variants]) {
          const url = `https://site.example${base}${rendition.src}`;
          expect(expanded.original(url)).toBe(original.original(url));
          expect(expanded.original(url)).toBe(previousAliases.get(rendition.src));
          expect(expanded.url(url, 10000)).toBe(original.url(url, 10000));
        }
      }
    }
  });
});
