import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { extractPublicImageReferences, extractSmallInlineImageReferences, extendSmallInlineRenditions, missingSmallInlineRenditions, preparePublicImageRecord, smallInlineRenditionWidths } from "./prepare-public-images.mjs";

describe("public image delivery inventory", () => {
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
