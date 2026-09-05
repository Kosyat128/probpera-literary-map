import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { installObservers } from "./lib/bookshelf-physics-observer.mjs";

const baseURL = process.argv[2] || "http://127.0.0.1:4185/";
if (process.argv.length > 3) throw new Error("Only the preview URL is configurable");
const output = fileURLToPath(new URL("../.review/spine-restoration-final/", import.meta.url));
await mkdir(output, { recursive: true });
const report = { baseURL, capturedAt: new Date().toISOString(), renderedFrom: "Actual compiled WebGL; no source injection", stages: {}, issues: [] };
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1720, height: 1000 }, deviceScaleFactor: 1 });
  page.on("pageerror", error => report.issues.push(error.message));
  await page.addInitScript(installObservers);
  await page.addInitScript(() => localStorage.setItem("probpera-interface-language", "ru"));
  await page.goto(new URL("#books", baseURL).href, { waitUntil: "domcontentloaded" });
  const workspace = page.locator(".book-shelf-frame__workspace");
  await workspace.scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
  const idle = () => page.waitForFunction(() => {
    const state = window.__shelfAudit.read();
    return state?.books.length === 17 && state.phase === "SHELF_IDLE" && state.pendingFrames === 0;
  }, null, { timeout: 30000 });
  const measure = () => page.evaluate(() => {
    const data = window.__shelfAudit.sceneData();
    const patches = window.__shelfAudit.palettePatches().sort((a, b) => a.x - b.x);
    const books = data.books.map(book => {
      let foil = null;
      let material = null;
      book.group.traverse(object => {
        if (object.renderOrder === 4) foil = object;
        const surface = object.material;
        if (surface?.normalMap && surface.map?.image && surface.map.image.width / surface.map.image.height < .3) material = surface;
      });
      const image = foil?.material?.map?.image;
      const ink = (top, bottom) => {
        if (!image?.getContext) return 0;
        const pixels = image.getContext("2d").getImageData(0, Math.floor(image.height * top), image.width, Math.ceil(image.height * (bottom - top))).data;
        let count = 0;
        for (let index = 3; index < pixels.length; index += 4) if (pixels[index] > 100) count++;
        return count;
      };
      return { key: book.layout.spec.key, z: book.group.position.z, titlePixels: ink(.15, .40), authorPixels: ink(.465, .675),
        normalScale: material?.normalScale.toArray(), bumpScale: material?.bumpScale, roughness: material?.roughness, foilRelief: foil?.material?.bumpScale };
    });
    const gaps = patches.slice(1).map((patch, index) => patch.x - patches[index].x - patches[index].width);
    return { ...window.__shelfAudit.read(), patches, physicalBooks: books,
      topSpread: Math.max(...patches.map(patch => patch.y)) - Math.min(...patches.map(patch => patch.y)),
      bottomSpread: Math.max(...patches.map(patch => patch.y + patch.height)) - Math.min(...patches.map(patch => patch.y + patch.height)),
      minGap: Math.min(...gaps), maxGap: Math.max(...gaps) };
  });
  await idle();
  report.stages.idle = await measure();
  assert.equal(report.stages.idle.patches.length, 17);
  assert.equal(new Set(report.stages.idle.patches.map(patch => patch.slot)).size, 17);
  assert.ok(report.stages.idle.topSpread <= 1 && report.stages.idle.bottomSpread <= 1);
  assert.ok(report.stages.idle.minGap > 0 && report.stages.idle.maxGap - report.stages.idle.minGap <= 1);
  assert.ok(report.stages.idle.physicalBooks.every(book => book.titlePixels > 0 && book.authorPixels > 0 && Math.abs(book.z) < .001));
  await workspace.screenshot({ path: output + "/row.png" });
  await writeFile(output + "/row.json", JSON.stringify(report.stages.idle, null, 2) + "\n");

  const target = report.stages.idle.books[3];
  const selectedZ = () => page.evaluate(key => window.__shelfAudit.sceneData().books.find(book => book.layout.spec.key === key).group.position.z, target.key);
  await page.mouse.move(target.x, target.y);
  await page.waitForFunction(key => window.__shelfAudit.sceneData().books.find(book => book.layout.spec.key === key).group.position.z > .05, target.key);
  await page.waitForTimeout(650);
  report.stages.hover = await measure();
  const hoverZ = await selectedZ();
  assert.ok(hoverZ > .05 && hoverZ < .2);
  assert.ok(report.stages.hover.physicalBooks.filter(book => book.key !== target.key).every(book => Math.abs(book.z) < .001));
  await workspace.screenshot({ path: output + "/hover.png" });

  await page.mouse.down();
  await page.waitForTimeout(450);
  const pressedZ = await selectedZ();
  report.stages.pressed = { key: target.key, z: pressedZ };
  assert.ok(pressedZ > 0 && pressedZ < hoverZ - .01);
  await page.mouse.up();
  await page.mouse.move(0, 0);
  await page.waitForFunction(key => window.__shelfAudit.read()?.selectedKey === key && window.__shelfAudit.read()?.phase === "INSPECTION_CLOSED", target.key, { timeout: 30000 });
  report.stages.selected = await measure();
  assert.ok(await selectedZ() > hoverZ + .5);
  await page.keyboard.press("Escape");
  await idle();
  report.stages.returned = await measure();
  assert.ok(report.stages.returned.physicalBooks.every(book => Math.abs(book.z) < .001));
  assert.ok(report.stages.returned.topSpread <= 1 && report.stages.returned.bottomSpread <= 1);
} catch (error) {
  report.issues.push(String(error));
} finally {
  await browser.close();
  await writeFile(output + "/result.json", JSON.stringify(report, null, 2) + "\n");
}
console.log(JSON.stringify({ stages: Object.keys(report.stages), issues: report.issues, output }));
if (report.issues.length) process.exitCode = 1;
