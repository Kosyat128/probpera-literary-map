import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import sharp from "sharp";
import { fileURLToPath } from "node:url";

const modulePath = fileURLToPath(new URL("../../apps/admin/lib/client-image-upload.ts", import.meta.url));
const corePath = fileURLToPath(new URL("../../src/utils/imageUploadOptimization.ts", import.meta.url));
let runtime;
test.beforeAll(async () => {
  const output = await build({
    stdin: { contents: `import {prepareClientImage,formatImagePreparation} from ${JSON.stringify(modulePath)};
      import {optimizeUploadImage} from ${JSON.stringify(corePath)};
      window.uploadTest={prepareClientImage,formatImagePreparation,optimizeUploadImage};`, resolveDir: process.cwd(), loader: "ts" },
    bundle: true, write: false, format: "esm", platform: "browser",
  });
  runtime = output.outputFiles[0].text;
});

test.beforeEach(async ({ page }) => {
  // Genuine browser canvas and upload code, with no account, storage or publication calls.
  await page.route("**/upload-test-runtime.js", (route) => route.fulfill({ contentType: "text/javascript", body: runtime }));
  await page.route("**/upload-test-fixture", (route) => route.fulfill({ contentType: "text/html", body: '<!doctype html><html lang="ru"><body><script type="module" src="/upload-test-runtime.js"></script></body></html>' }));
  await page.goto("/upload-test-fixture");
  await page.waitForFunction(() => Boolean(window.uploadTest));
});

async function optimize(page, bytes, { type = "image/png", name = "picture.png", avatar = false } = {}) {
  return page.evaluate(async ({ base64, type, name, avatar }) => {
    const source = new File([Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))], name, { type, lastModified: 123456 });
    const prepared = avatar
      ? await window.uploadTest.optimizeUploadImage(source, { maxOutputBytes: 2 * 1024 * 1024, maxDimension: 1024, allowedOriginalTypes: ["image/jpeg", "image/png", "image/webp"] })
      : await window.uploadTest.prepareClientImage(source, "cover");
    const output = new Uint8Array(await prepared.file.arrayBuffer());
    let binary = "";
    for (let index = 0; index < output.length; index += 0x8000) binary += String.fromCharCode(...output.subarray(index, index + 0x8000));
    return {
      width: prepared.width, height: prepared.height, originalBytes: prepared.originalBytes, outputBytes: prepared.outputBytes,
      type: prepared.file.type, name: prepared.file.name, lastModified: prepared.file.lastModified,
      summary: window.uploadTest.formatImagePreparation(prepared), base64: btoa(binary),
    };
  }, { base64: bytes.toString("base64"), type, name, avatar });
}

function pixels(width, height, transparent = false) {
  const channels = transparent ? 4 : 3;
  const bytes = Buffer.alloc(width * height * channels);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const offset = (y * width + x) * channels;
    bytes[offset] = Math.round(x / width * 255);
    bytes[offset + 1] = Math.round(y / height * 255);
    bytes[offset + 2] = 110 + Math.round(Math.sin(x / 15) * 60);
    if (transparent) bytes[offset + 3] = x < width / 4 ? 0 : x < width / 2 ? 128 : 255;
  }
  return { bytes, raw: { width, height, channels } };
}

test("a 2MB editorial image gets smaller while retaining resolution and visible detail", async ({ page }) => {
  const fixture = pixels(1200, 600);
  const source = await sharp(fixture.bytes, { raw: fixture.raw }).png({ compressionLevel: 0 }).toBuffer();
  expect(source.length).toBeGreaterThan(2 * 1024 * 1024);
  const result = await optimize(page, source, { type: "image/jpeg", name: "wrong-extension.jpg" });
  expect(result).toMatchObject({ width: 1200, height: 600, type: "image/webp", lastModified: 123456 });
  expect(result.outputBytes).toBeLessThan(source.length);
  expect(result.summary).toContain("→");
  expect(result.summary).toContain("1200 × 600, разрешение сохранено");
  const output = Buffer.from(result.base64, "base64");
  const decoded = await sharp(output).removeAlpha().raw().toBuffer();
  const mse = decoded.reduce((sum, value, index) => sum + (value - fixture.bytes[index]) ** 2, 0) / decoded.length;
  expect(10 * Math.log10(255 ** 2 / mse)).toBeGreaterThan(38);
  const avatar = await optimize(page, source, { avatar: true });
  expect(avatar).toMatchObject({ width: 1024, height: 512, type: "image/webp" });
  test.info().annotations.push({ type: "optimization", description: `${source.length} → ${result.outputBytes} bytes, 1200×600; PSNR ${(10 * Math.log10(255 ** 2 / mse)).toFixed(1)}dB` });
});

test("transparent pixels and EXIF portrait orientation survive optimization", async ({ page }) => {
  const fixture = pixels(640, 360, true);
  const source = await sharp(fixture.bytes, { raw: fixture.raw }).png({ compressionLevel: 0 }).toBuffer();
  const result = await optimize(page, source);
  const alpha = await sharp(Buffer.from(result.base64, "base64")).extractChannel("alpha").raw().toBuffer();
  expect(alpha).toEqual(Buffer.from(Array.from({ length: alpha.length }, (_, index) => fixture.bytes[index * 4 + 3])));
  const oriented = await sharp(fixture.bytes, { raw: fixture.raw }).removeAlpha().withMetadata({ orientation: 6 }).jpeg({ quality: 100 }).toBuffer();
  const portrait = await optimize(page, oriented, { type: "image/jpeg", name: "portrait.jpg" });
  expect(portrait).toMatchObject({ width: 360, height: 640 });
  const expected = await sharp(oriented).autoOrient().removeAlpha().raw().toBuffer();
  const actual = await sharp(Buffer.from(portrait.base64, "base64")).autoOrient().removeAlpha().raw().toBuffer();
  const meanDifference = actual.reduce((sum, value, index) => sum + Math.abs(value - expected[index]), 0) / actual.length;
  expect(meanDifference).toBeLessThan(4);
});

test("animation and already smaller originals keep their bytes; unsafe input is rejected", async ({ page }) => {
  const raw = Buffer.alloc(96 * 128 * 4, 255);
  raw.fill(80, 96 * 64 * 4);
  const animated = await sharp(raw, { raw: { width: 96, height: 128, channels: 4, pageHeight: 64 } }).webp({ loop: 0, delay: [100, 100] }).toBuffer();
  expect((await sharp(animated, { animated: true }).metadata()).pages).toBe(2);
  const preserved = await optimize(page, animated, { type: "image/webp", name: "animated.webp" });
  expect(Buffer.from(preserved.base64, "base64")).toEqual(animated);
  const tiny = await sharp({ create: { width: 1, height: 1, channels: 3, background: "white" } }).png({ palette: true }).toBuffer();
  // Explicitly emulate an encoder whose output is larger, as can happen for small icons.
  await page.evaluate(() => {
    HTMLCanvasElement.prototype.toBlob = function (callback) { callback(new Blob([new Uint8Array(4096)], { type: "image/webp" })); };
  });
  const original = await optimize(page, tiny);
  expect(Buffer.from(original.base64, "base64")).toEqual(tiny);
  expect(original.summary).toContain("исходный файл");
  const failures = await page.evaluate(async () => {
    const results = [];
    for (const bytes of ["GIF89a", "<svg><script/></svg>"]) {
      try { await window.uploadTest.prepareClientImage(new File([bytes], "fake.png", { type: "image/png" })); }
      catch (error) { results.push(error.code); }
    }
    return results;
  });
  expect(failures).toEqual(["gif", "format"]);
});
