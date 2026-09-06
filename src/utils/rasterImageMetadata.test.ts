import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { inspectRasterImage, isGifImage } from "./rasterImageMetadata";

const source = () => sharp({ create: { width: 96, height: 64, channels: 4, background: "#ff810080" } });

describe("portable upload container inspection", () => {
  it.each(["jpeg", "png", "webp", "avif"] as const)("reads real %s encoded bytes independently of a filename", async (format) => {
    const bytes = await source().toFormat(format).toBuffer();
    const parsed = inspectRasterImage(bytes);
    expect(parsed).toMatchObject({ mime: `image/${format}`, width: 96, height: 64, animated: false });
    expect(inspectRasterImage(bytes.subarray(0, Math.floor(bytes.length / 2)))).toBeNull();
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8])("reports displayed JPEG dimensions for EXIF orientation %s", async (orientation) => {
    const bytes = await source().withMetadata({ orientation }).jpeg().toBuffer();
    expect(inspectRasterImage(bytes)).toMatchObject({
      width: orientation >= 5 ? 64 : 96,
      height: orientation >= 5 ? 96 : 64,
    });
  });

  it("reads lossless WebP, alpha WebP, and oriented WebP", async () => {
    for (const pipeline of [source().webp({ lossless: true }), source().webp(), source().withMetadata({ orientation: 6 }).webp()]) {
      const bytes = await pipeline.toBuffer();
      const reference = await sharp(bytes).metadata();
      expect(inspectRasterImage(bytes)).toMatchObject({ width: reference.autoOrient.width, height: reference.autoOrient.height });
    }
  });

  it("recognizes animated WebP without decoding it to its first frame", async () => {
    const pixels = Buffer.alloc(96 * 128 * 4, 255);
    pixels.fill(80, 96 * 64 * 4);
    const bytes = await sharp(pixels, { raw: { width: 96, height: 128, channels: 4, pageHeight: 64 } }).webp({ loop: 0, delay: [100, 100] }).toBuffer();
    expect((await sharp(bytes, { animated: true }).metadata()).pages).toBe(2);
    expect(inspectRasterImage(bytes)).toMatchObject({ width: 96, height: 64, animated: true });
  });

  it("does not accept SVG/HTML/GIF masquerading as a supported upload", () => {
    expect(inspectRasterImage(new TextEncoder().encode('<svg width="96" height="64"><script/></svg>'))).toBeNull();
    const gif = new TextEncoder().encode("GIF89a");
    expect(isGifImage(gif)).toBe(true);
    expect(inspectRasterImage(gif)).toBeNull();
  });

  it("rejects malformed WebP chunk bounds and conflicting RIFF length", async () => {
    const bytes = await source().webp().toBuffer();
    const badLength = Buffer.from(bytes);
    badLength.writeUInt32LE(bytes.length, 4);
    expect(inspectRasterImage(badLength)).toBeNull();
    const badChunk = Buffer.from(bytes);
    badChunk.writeUInt32LE(bytes.length, 16);
    expect(inspectRasterImage(badChunk)).toBeNull();
  });
});
