import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import sharp from "sharp";
import { fileURLToPath } from "node:url";

const modulePath = fileURLToPath(new URL("../../apps/admin/lib/client-image-upload.ts", import.meta.url));
const editorUploadPath = fileURLToPath(new URL("../../apps/admin/lib/editor-image-upload.ts", import.meta.url));
const corePath = fileURLToPath(new URL("../../src/utils/imageUploadOptimization.ts", import.meta.url));
const uploadLimit = Math.floor(3.8 * 1024 * 1024);
let runtime;
test.beforeAll(async () => {
  const output = await build({
    stdin: { contents: `import {prepareClientImage,formatImagePreparation} from ${JSON.stringify(modulePath)};
      import {uploadEditorImage} from ${JSON.stringify(editorUploadPath)};
      import {optimizeUploadImage} from ${JSON.stringify(corePath)};
      window.uploadTest={prepareClientImage,formatImagePreparation,optimizeUploadImage,uploadEditorImage};`, resolveDir: process.cwd(), loader: "ts" },
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

const label = [
  ["11111", "11111", "10001", "01111", "11111"],
  ["00100", "10000", "10010", "10000", "00100"],
  ["00100", "10000", "10100", "10000", "00100"],
  ["00100", "11110", "11000", "10000", "00100"],
  ["00100", "10000", "10100", "10000", "00100"],
  ["00100", "10000", "10010", "10000", "00100"],
  ["00100", "11111", "10001", "01111", "00100"],
].map((row) => row.join("0"));
const labelCell = 9;
const labelTop = 32;
const labelLeft = (width) => Math.floor(width / 3);

function detailedPixels(width, height) {
  const channels = 4;
  const bytes = Buffer.alloc(width * height * channels);
  let seed = 0x21bb034a;
  const left = labelLeft(width);
  for (let y = 0; y < height; y += 1) {
    const row = label[Math.floor((y - labelTop) / labelCell)];
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * channels;
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      const ink = row?.[Math.floor((x - left) / labelCell)] === "1";
      const color = ink ? 0xffffff : y < height / 5 ? 0xf02a20 : seed;
      bytes[offset] = color >>> 16;
      bytes[offset + 1] = color >>> 8;
      bytes[offset + 2] = color;
      bytes[offset + 3] = x < width / 10 ? 0 : x < width / 5 ? 128 : 255;
    }
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

test("oversized illustrations fit the upload request and retain their metadata on retry", async ({ page }) => {
  const coverFixture = detailedPixels(5100, 1300);
  const inlineFixture = detailedPixels(5200, 1520);
  const coverSource = await sharp(coverFixture.bytes, { raw: coverFixture.raw }).png().toBuffer();
  const inlineSource = await sharp(inlineFixture.bytes, { raw: inlineFixture.raw }).webp({ lossless: true, effort: 2 }).toBuffer();
  for (const source of [coverSource, inlineSource]) {
    expect(source.length).toBeGreaterThan(uploadLimit);
    expect(source.length).toBeLessThan(20 * 1024 * 1024);
  }
  await page.route("**/upload-test-source/cover", (route) => route.fulfill({ contentType: "image/png", body: coverSource }));
  await page.route("**/upload-test-source/inline", (route) => route.fulfill({ contentType: "image/webp", body: inlineSource }));
  const attempts = [];
  await page.route("**/upload-test-source/prepared", (route) => route.fulfill({ contentType: "image/webp", body: attempts[2].bytes }));
  await page.route("**/api/media/upload", async (route) => {
    const request = route.request();
    const body = request.postDataBuffer();
    const data = await new Response(body, { headers: { "content-type": request.headers()["content-type"] } }).formData();
    const file = data.get("file");
    const bytes = Buffer.from(await file.arrayBuffer());
    const width = Number(data.get("client_width"));
    const height = Number(data.get("client_height"));
    attempts.push({
      bytes, bodySize: body.length, width, height, usage: data.get("image_usage"),
      altText: data.get("alt_text"), caption: data.get("caption"), name: file.name,
    });
    if (attempts.length === 1) {
      await route.fulfill({ status: 503, json: { error: "Тестовый сбой загрузки" } });
      return;
    }
    await route.fulfill({ json: { ok: true, id: `asset-${attempts.length}`, url: `/test-assets/${file.name}`, width, height } });
  });
  const result = await page.evaluate(async () => {
    const coverSource = await (await fetch("/upload-test-source/cover")).blob();
    const inlineSource = await (await fetch("/upload-test-source/inline")).blob();
    const coverFile = new File([coverSource], "cover.png", { type: coverSource.type });
    const inlineFile = new File([inlineSource], "illustration.webp", { type: inlineSource.type });
    const metadata = { altText: "Иллюстрация к статье", caption: "Подпись автора", collectionName: "Статьи" };
    let failure;
    try {
      await window.uploadTest.uploadEditorImage(coverFile, { ...metadata, usage: "cover" });
    } catch (error) {
      failure = { code: error.code, message: error.message };
      if (error.code) return { failure };
    }
    const cover = await window.uploadTest.uploadEditorImage(coverFile, { ...metadata, usage: "cover" });
    const originalEncode = HTMLCanvasElement.prototype.toBlob;
    const encodes = [];
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      const trial = { width: this.width, height: this.height, quality };
      encodes.push(trial);
      return originalEncode.call(this, (blob) => {
        trial.bytes = blob?.size;
        callback(blob);
      }, type, quality);
    };
    try {
      const inline = await window.uploadTest.uploadEditorImage(inlineFile, { ...metadata, usage: "inline" });
      const inlineEncodes = encodes.length;
      const preparedSource = await (await fetch("/upload-test-source/prepared")).blob();
      const preparedFile = new File([preparedSource], "already-prepared.webp", { type: preparedSource.type });
      const repeated = await window.uploadTest.uploadEditorImage(preparedFile, { ...metadata, usage: "inline" });
      return {
        failure, cover, inline, repeated, encodes: encodes.slice(0, inlineEncodes), repeatEncodes: encodes.length - inlineEncodes,
        summary: window.uploadTest.formatImagePreparation(inline.preparation),
      };
    } finally {
      HTMLCanvasElement.prototype.toBlob = originalEncode;
    }
  });

  expect(result.failure).toEqual({ message: "Тестовый сбой загрузки" });
  expect(attempts.map(({ name, usage }) => [name, usage])).toEqual([
    ["cover.webp", "cover"], ["cover.webp", "cover"], ["illustration.webp", "inline"], ["already-prepared.webp", "inline"],
  ]);
  expect(attempts[0].bytes).toEqual(attempts[1].bytes);
  expect(attempts[2].bytes).toEqual(attempts[3].bytes);
  const { width: sourceWidth, height: sourceHeight } = inlineFixture.raw;
  expect(result.encodes.slice(0, 2)).toEqual([
    { width: sourceWidth, height: sourceHeight, quality: 0.94, bytes: expect.any(Number) },
    { width: sourceWidth, height: sourceHeight, quality: 0.88, bytes: expect.any(Number) },
  ]);
  expect(result.encodes[0].bytes).toBeGreaterThan(uploadLimit);
  expect(result.encodes[1].bytes).toBeGreaterThan(uploadLimit);
  expect(result.encodes[1].bytes).toBeLessThan(result.encodes[0].bytes);
  expect(result.repeatEncodes).toBe(0);
  expect(result.repeated.preparation).toMatchObject({ resized: false, originalBytes: attempts[2].bytes.length, outputBytes: attempts[2].bytes.length });
  for (const attempt of attempts) {
    const { raw } = attempt.usage === "cover" ? coverFixture : inlineFixture;
    expect(attempt.bytes.length).toBeLessThanOrEqual(uploadLimit);
    expect(attempt.bodySize).toBeLessThan(4 * 1024 * 1024);
    expect(attempt.width).toBeGreaterThanOrEqual(1920);
    expect(Math.abs(attempt.height - attempt.width * raw.height / raw.width)).toBeLessThan(1);
    expect(attempt.altText).toBe("Иллюстрация к статье");
    expect(attempt.caption).toBe("Подпись автора");
  }
  const { bytes, width, height, bodySize } = attempts[2];
  expect(result.encodes.at(-1)).toEqual({ width, height, quality: 0.92, bytes: bytes.length });
  expect(attempts[1]).toMatchObject({ width: coverFixture.raw.width, height: coverFixture.raw.height });
  expect(width).toBeLessThan(inlineFixture.raw.width);
  const output = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  expect(output.info).toMatchObject({ width, height });
  const sample = (x) => output.data.subarray(Math.floor(width * x) * 4, Math.floor(width * x) * 4 + 4);
  expect(sample(0.05)[3]).toBe(0);
  expect(sample(0.15)[3]).toBe(128);
  for (const [index, channel] of [240, 42, 32].entries()) {
    expect(Math.abs(sample(0.5)[index] - channel)).toBeLessThan(12);
  }
  expect(sample(0.5)[3]).toBe(255);
  const labelSamples = label.map((row, y) => Array.from(row, (_, x) => {
    const outputX = Math.floor((labelLeft(inlineFixture.raw.width) + (x + 0.5) * labelCell) * width / inlineFixture.raw.width);
    const outputY = Math.floor((labelTop + (y + 0.5) * labelCell) * height / inlineFixture.raw.height);
    const green = output.data[(outputY * width + outputX) * 4 + 1];
    return green > 175 ? "1" : "0";
  }).join(""));
  expect(labelSamples).toEqual(label);
  expect(result.cover.url).toBe("/test-assets/cover.webp");
  expect(result.inline.url).toBe("/test-assets/illustration.webp");
  expect(result.summary).toContain("разрешение уменьшено без обрезки");
  test.info().annotations.push(
    { type: "coverUpload", description: `${coverSource.length} → ${attempts[1].bytes.length} bytes, ${attempts[1].width}×${attempts[1].height}; multipart ${attempts[1].bodySize} bytes` },
    { type: "inlineUpload", description: `${inlineSource.length} → ${bytes.length} bytes, ${width}×${height}; multipart ${bodySize} bytes` },
  );
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
