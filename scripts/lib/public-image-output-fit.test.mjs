import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { encodePublicRasterRendition } from "./public-image-output-fit.mjs";

const { individualImageBytes } = JSON.parse(await readFile(new URL("../../performance-budget.json", import.meta.url), "utf8"));

function encodeAtQuality(source, width, quality = 90) {
  return sharp(source, { limitInputPixels: false }).rotate()
    .resize({ width, height: 8192, fit: "inside", withoutEnlargement: true })
    .webp({ quality, effort: 5, smartSubsample: true })
    .toBuffer();
}

function noiseRgba(width, height) {
  const pixels = Buffer.alloc(width * height * 4, 255);
  let noise = 0x8b8b8b8b;
  for (let offset = 0; offset < pixels.length; offset += 4) {
    noise ^= noise << 13;
    noise ^= noise >>> 17;
    noise ^= noise << 5;
    pixels[offset] = noise & 255;
    pixels[offset + 1] = (noise >>> 8) & 255;
    pixels[offset + 2] = (noise >>> 16) & 255;
  }
  return pixels;
}

describe("public raster output fitting", () => {
  it("keeps the baseline bytes and native dimensions when they already meet the budget", async () => {
    const source = await sharp({ create: { width: 300, height: 150, channels: 4, background: "#765432a0" } })
      .png().toBuffer();
    const output = await encodePublicRasterRendition(source, 640, individualImageBytes);
    expect(output.data.equals(await encodeAtQuality(source, 640))).toBe(true);
    expect(output.info).toMatchObject({ format: "webp", width: 300, height: 150 });
    expect(output.fitted).toBeUndefined();
  });

  it("keeps every pixel for a near-limit image when a small quality adjustment meets the cap", async () => {
    const width = 512;
    const height = 384;
    const source = await sharp(noiseRgba(width, height), { raw: { width, height, channels: 4 } }).png().toBuffer();
    const baseline = await encodeAtQuality(source, width);
    const highQuality = await encodeAtQuality(source, width, 85);
    const limit = Math.round((baseline.length + highQuality.length) / 2);
    expect(baseline.length).toBeGreaterThan(limit);

    const output = await encodePublicRasterRendition(source, width, limit);
    expect(output.info).toMatchObject({ width, height });
    expect(output.fitted).toBe(true);
    expect(output.data.length).toBeLessThanOrEqual(limit);
    expect(output.data.equals(highQuality)).toBe(true);
  });

  it("fits an output over the real cap while keeping orientation, proportions and high-contrast detail on alpha", async () => {
    const width = 2688;
    const height = 2304;
    const pixels = noiseRgba(width, height);
    for (let y = 0; y < 150; y++) {
      for (let x = 0; x < 200; x++) {
        const stroke = (y >= 20 && y <= 95 && ((x >= 30 && x <= 45) || (x >= 95 && x <= 110))) ||
          (y >= 50 && y <= 65 && x >= 30 && x <= 110);
        const offset = (y * width + x) * 4;
        pixels.fill(stroke ? 0 : 255, offset, offset + 3);
        pixels[offset + 3] = 140;
      }
    }
    const source = await sharp(pixels, { raw: { width, height, channels: 4 } })
      .withMetadata({ orientation: 6 })
      .png({ compressionLevel: 1 }).toBuffer();
    expect((await encodeAtQuality(source, height)).length).toBeGreaterThan(individualImageBytes);

    const output = await encodePublicRasterRendition(source, height, individualImageBytes);
    expect(output.fitted).toBe(true);
    expect(output.data.length).toBeLessThanOrEqual(individualImageBytes);
    expect(output.data.length).toBeGreaterThanOrEqual(individualImageBytes * 0.8);
    expect(output.info.width).toBeGreaterThanOrEqual(height * 0.67);
    expect(output.info.width).toBeLessThanOrEqual(height);
    expect(output.info.height).toBeLessThanOrEqual(width);
    expect(Math.abs(output.info.height - output.info.width * width / height)).toBeLessThan(2);

    const { data, info } = await sharp(output.data).raw().toBuffer({ resolveWithObject: true });
    expect(info.channels).toBe(4);
    const sample = (x, y) => {
      const orientedX = Math.floor((height - 1 - y) * info.width / height);
      const orientedY = Math.floor(x * info.height / width);
      const offset = (orientedY * info.width + orientedX) * 4;
      return { red: data[offset], alpha: data[offset + 3] };
    };
    const stroke = sample(37, 32);
    const background = sample(66, 32);
    expect(stroke.red).toBeLessThan(25);
    expect(background.red).toBeGreaterThan(230);
    expect(stroke.alpha).toBe(140);
    expect(background.alpha).toBe(140);
  }, 30000);
});
