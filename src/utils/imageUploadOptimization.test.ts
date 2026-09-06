import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import { imageUploadErrorMessage, optimizeUploadImage } from "./imageUploadOptimization";

afterEach(() => vi.unstubAllGlobals());

describe("upload preservation before browser canvas", () => {
  it("retains AVIF and its dimensions without color conversion", async () => {
    const bytes = await sharp({ create: { width: 96, height: 64, channels: 4, background: "#ff880080" } }).avif().toBuffer();
    const decode = vi.fn(() => { throw new Error("Must not decode preserved input"); });
    vi.stubGlobal("createImageBitmap", decode);
    const result = await optimizeUploadImage(new File([Uint8Array.from(bytes)], "wrong.jpg", { type: "image/jpeg" }), { maxOutputBytes: 4_000_000 });
    expect(result).toMatchObject({ width: 96, height: 64, originalBytes: bytes.length, outputBytes: bytes.length });
    expect(result.file.type).toBe("image/avif");
    expect(result.file.name).toBe("wrong.avif");
    expect(Buffer.from(await result.file.arrayBuffer())).toEqual(bytes);
    expect(decode).not.toHaveBeenCalled();
  });

  it("keeps animated WebP untouched and rejects a cap it cannot meet without flattening", async () => {
    const pixels = Buffer.alloc(96 * 128 * 4, 255);
    pixels.fill(80, 96 * 64 * 4);
    const bytes = await sharp(pixels, { raw: { width: 96, height: 128, channels: 4, pageHeight: 64 } }).webp({ delay: [100, 100], loop: 0 }).toBuffer();
    const file = new File([Uint8Array.from(bytes)], "animation.webp", { type: "image/webp" });
    const decode = vi.fn();
    vi.stubGlobal("createImageBitmap", decode);
    const result = await optimizeUploadImage(file, { maxOutputBytes: bytes.length, maxDimension: 32 });
    expect(result).toMatchObject({ width: 96, height: 64 });
    expect(Buffer.from(await result.file.arrayBuffer())).toEqual(bytes);
    await expect(optimizeUploadImage(file, { maxOutputBytes: bytes.length - 1 })).rejects.toMatchObject({ code: "outputSize" });
    expect(decode).not.toHaveBeenCalled();
  });

  it("rejects GIF explicitly even when its filename and MIME claim PNG", async () => {
    const error = await optimizeUploadImage(new File(["GIF89a"], "pretend.png", { type: "image/png" }), { maxOutputBytes: 10_000 }).catch((reason) => reason);
    expect(error).toMatchObject({ code: "gif" });
    expect(imageUploadErrorMessage(error, "en")).toContain("keep every frame");
    expect(imageUploadErrorMessage(error, "ru")).toContain("кадры не будут удалены");
  });
});
