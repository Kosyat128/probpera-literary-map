import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import performanceBudget from "../performance-budget.json" with { type: "json" };
import { publishedImageSourceLimit } from "./lib/published-image-performance.mjs";
import { createRemoteImageOriginalReader, extractPublicImageReferences, extractSmallInlineImageReferences, extendSmallInlineRenditions, missingSmallInlineRenditions, preparePublicImageRecord, smallInlineRenditionWidths } from "./prepare-public-images.mjs";

describe("public image delivery inventory", () => {
  it("enforces the configured source ceiling before preparing or checking images", async () => {
    const script = await readFile(new URL("./prepare-public-images.mjs", import.meta.url), "utf8");
    const { publishedImageCorpus } = performanceBudget;
    expect(publishedImageSourceLimit(publishedImageCorpus)).toBe(publishedImageCorpus.fileCount + publishedImageCorpus.sourceAliasCount);
    const budget = script.indexOf("const sourceLimit = publishedImageSourceLimit(performanceBudget.publishedImageCorpus);");
    const guard = script.indexOf("if (inventory.length > sourceLimit)");
    expect(budget).toBeGreaterThan(script.indexOf("const inventory = await collectPublicImageSources();"));
    expect(guard).toBeGreaterThan(budget);
    expect(guard).toBeLessThan(script.indexOf('if (argv.includes("--check")) return checkInventory(inventory);'));
    expect(guard).toBeLessThan(script.indexOf("await seedExistingOriginals();"));
  });

  it("collects actual bilingual article imagery while excluding canonical pages and image credits", () => {
    const references = extractPublicImageReferences({
      canonicalUrl: "https://example.org/article.png",
      imageUrl: "https://cdn.example.org/cover.png?revision=2",
      sources: [{ url: "https://example.org/credits.jpg" }],
      contentHtml: '<p><a href="https://example.org/reference.jpg">Source</a></p><img src="https://cdn.example.org/illustration.jpg"><figure style="background-image:url(https://cdn.example.org/backdrop.webp)"></figure>',
      translations: { en: { contentHtml: '<img src="https://cdn.example.org/english.png">' } },
    });
    expect(references).toEqual([
      "https://cdn.example.org/cover.png?revision=2",
      "https://cdn.example.org/illustration.jpg",
      "https://cdn.example.org/backdrop.webp",
      "https://cdn.example.org/english.png",
    ]);
  });

  it("retains signed and extensionless image URLs, deduplicates exact references and skips non-fetchable assets", () => {
    const url = "https://cdn.example.org/scale_1200?token=public-signature";
    expect(extractPublicImageReferences({ imageUrl: url, contentHtml: `<img src="${url}"><img src="data:image/svg+xml,safe"><img src="blob:local">`, backgroundImageUrl: "/brand/background.avif", portrait: "staging://portrait.webp" })).toEqual([url, "/brand/background.avif"]);
  });

  it("rejects credential-bearing URLs and filesystem references even in image fields", () => {
    expect(extractPublicImageReferences({ imageUrl: "https://user:password@example.org/private.jpg", backgroundImageUrl: "file:///C:/private.png", portrait: "../../secret.png" })).toEqual([]);
  });

  it("discovers new bilingual CMS thumbnail sources from authored metadata without a URL allowlist", () => {
    const fresh = "https://cdn.example.org/new-upload.webp";
    expect(extractSmallInlineImageReferences({
      imageUrl: "https://cdn.example.org/hero.webp",
      contentHtml: `<img src="${fresh}" data-image-width="20"><img src="${fresh}" data-image-width="50"><img src="https://cdn.example.org/full.webp" data-image-width="100">`,
      translations: { en: { contentHtml: '<img src="https://cdn.example.org/new-en.webp" data-image-width="35">' } },
    })).toEqual([fresh, "https://cdn.example.org/new-en.webp"]);
    expect(extractSmallInlineImageReferences({ contentHtml: '<img src="https://cdn.example.org/a.webp"><img src="https://cdn.example.org/b.webp" data-image-width="-1"><img src="https://cdn.example.org/c.webp" data-image-width="20px"><img src="https://cdn.example.org/d.webp" data-image-width="51"><img src="data:image/png,no" data-image-width="20">' })).toEqual([]);
  });

  it("limits added renditions to small raster uses that can preserve resolution and animation", () => {
    const metadata = { width: 1024, height: 1536, format: "webp" };
    expect(smallInlineRenditionWidths({}, metadata)).toEqual([]);
    expect(smallInlineRenditionWidths({ smallInlineImage: true }, metadata)).toEqual([160, 320]);
    expect(smallInlineRenditionWidths({ smallInlineImage: true }, { ...metadata, width: 240 })).toEqual([160]);
    expect(smallInlineRenditionWidths({ smallInlineImage: true }, { ...metadata, pages: 2 })).toEqual([]);
    expect(smallInlineRenditionWidths({ smallInlineImage: true }, { ...metadata, format: "svg" })).toEqual([]);
    expect(smallInlineRenditionWidths({ smallInlineImage: true }, { ...metadata, height: 100000 })).toEqual([]);
  });

  it("extends a previously ready checkpoint once while retaining exact full/lightbox outputs", async () => {
    const bytes = await sharp({ create: { width: 1024, height: 1536, channels: 4, background: '#92643f80' } }).png().toBuffer();
    const source = { smallInlineImage: true };
    const large = { src: "media/reviewed-large.webp", width: 1024, height: 1536, bytes: 1000, sha256: 'b'.repeat(64) };
    const card = { src: "media/reviewed-card.webp", width: 640, height: 960, bytes: 500, sha256: 'c'.repeat(64) };
    const record = { source: { width: 1024, height: 1536, format: 'png', sha256: createHash('sha256').update(bytes).digest('hex') }, largest: large, outputs: [card, large], flags: [] };
    const saved = [];
    const save = async (data, hash, width, height, extension) => {
      const metadata = await sharp(data).metadata();
      expect(metadata).toMatchObject({ width, height, hasAlpha: true, format: 'webp' });
      const output = { src: `media/${hash}-${width}w.${extension}`, width, height, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') };
      saved.push(output);
      return output;
    };
    const extended = await extendSmallInlineRenditions(source, record, bytes, save);
    expect(saved.map(row => row.width)).toEqual([160, 320]);
    expect(extended.largest).toBe(large);
    expect(extended.outputs.filter(row => row.width >= 640)).toEqual(record.outputs);
    expect(record.outputs).toEqual([card, large]);
    expect(missingSmallInlineRenditions(source, extended)).toEqual([]);
    expect(await extendSmallInlineRenditions(source, extended, bytes, save)).toBe(extended);
    expect(saved).toHaveLength(2);
    await expect(extendSmallInlineRenditions(source, record, Buffer.from('different source'), save)).rejects.toThrow('Source differs');
    expect(saved).toHaveLength(2);
    expect(missingSmallInlineRenditions(source, { ...record, flags: ['animation-preserved'] })).toEqual([]);
  });

  it("aborts thumbnail upgrades without replacing a ready checkpoint when the source is unavailable or changed", async () => {
    const source = { sourceUrl: 'https://cdn.example.org/reviewed.webp', smallInlineImage: true };
    const record = { status: 'ready', source: { width: 1024, height: 1536, format: 'webp', sha256: 'a'.repeat(64) }, outputs: [{ src: 'reviewed640.webp', width: 640 }], flags: [] };
    const before = structuredClone(record);
    for (const acquire of [async () => { throw new Error('Source unavailable'); }, async () => ({ bytes: Buffer.from('changed source') })]) {
      const storeCheckpoint = vi.fn();
      await expect(preparePublicImageRecord(source, { loadCheckpoint: async () => record, acquire, storeCheckpoint })).rejects.toThrow(/Source unavailable|Source differs/u);
      expect(storeCheckpoint).not.toHaveBeenCalled();
      expect(record).toEqual(before);
    }
  });
});

describe("public image original downloads", () => {
  it("stops HTTP 402 retries, skips further affected Storage downloads, and uses cached or unrelated originals", async () => {
    const originalsDirectory = await mkdtemp(path.join(os.tmpdir(), "public-image-originals-"));
    const storage = "https://sjqejjmwpzfsczxdghvw.supabase.co/storage/v1/object/public/editorial-media";
    const otherProject = "https://other.supabase.co/storage/v1/object/public/editorial-media/image.webp";
    const cached = `${storage}/cached.webp`;
    const redirected = `${storage}/redirected.webp`;
    const first = `${storage}/first.webp`;
    const unavailable = { sourceUrl: `${storage}/next.webp`, contexts: [] };
    const otherHost = "https://images.example.org/retry.png";
    const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: "white" } }).png().toBuffer();
    const redirectedPaymentError = Object.defineProperty(new Response(null, { status: 402 }), "redirected", { value: true });
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 402 }))
      .mockResolvedValueOnce(redirectedPaymentError)
      .mockResolvedValueOnce(new Response(null, { status: 402 }))
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(png));
    const wait = vi.fn();
    const readOriginal = createRemoteImageOriginalReader({ originalsDirectory, fetchImpl, wait });
    try {
      await writeFile(path.join(originalsDirectory, `${createHash("sha256").update(cached).digest("hex")}.bin`), png);
      await expect(readOriginal(otherProject)).rejects.toThrow("HTTP 402");
      await expect(readOriginal(redirected)).rejects.toThrow("HTTP 402");
      await expect(readOriginal(first)).rejects.toThrow("HTTP 402");
      await expect(readOriginal(cached)).resolves.toEqual({ bytes: png, downloaded: false, attempts: 0 });

      const storeCheckpoint = vi.fn();
      const failedRecord = await preparePublicImageRecord(unavailable, {
        loadCheckpoint: async () => null,
        acquire: readOriginal,
        storeCheckpoint,
      });
      expect(failedRecord).toMatchObject({ status: "failed", error: expect.stringContaining("HTTP 402") });
      expect(storeCheckpoint).toHaveBeenCalledWith(unavailable, failedRecord);
      expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([otherProject, redirected, first]);
      expect(wait).not.toHaveBeenCalled();

      await expect(readOriginal(otherHost)).resolves.toEqual({ bytes: png, downloaded: true, attempts: 3 });
      expect(fetchImpl.mock.calls.slice(3).map(([url]) => url)).toEqual([otherHost, otherHost, otherHost]);
      expect(wait.mock.calls).toEqual([[250], [500]]);
      const storedName = `${createHash("sha256").update(otherHost).digest("hex")}.bin`;
      expect(await readFile(path.join(originalsDirectory, storedName))).toEqual(png);
      expect(await readdir(originalsDirectory)).toHaveLength(2);
    } finally {
      await rm(originalsDirectory, { recursive: true, force: true });
    }
  });

  it("checks the actual remote image format before storing new or reading restored originals", async () => {
    const originalsDirectory = await mkdtemp(path.join(os.tmpdir(), "public-image-format-"));
    const source = "https://images.example.org/image.png";
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>';
    const fetchImpl = vi.fn().mockResolvedValue(new Response(svg, { headers: { "content-type": "image/png" } }));
    const wait = vi.fn();
    const readOriginal = createRemoteImageOriginalReader({ originalsDirectory, fetchImpl, wait });
    try {
      await expect(readOriginal(source)).rejects.toThrow("Remote SVG originals");
      expect(await readdir(originalsDirectory)).toEqual([]);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      expect(wait).not.toHaveBeenCalled();

      const storedName = `${createHash("sha256").update(source).digest("hex")}.bin`;
      await writeFile(path.join(originalsDirectory, storedName), svg);
      await expect(readOriginal(source)).rejects.toThrow("Remote SVG originals");
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    } finally {
      await rm(originalsDirectory, { recursive: true, force: true });
    }
  });
});
