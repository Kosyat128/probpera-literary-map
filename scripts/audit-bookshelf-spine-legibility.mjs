import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { installObservers } from "./lib/bookshelf-physics-observer.mjs";

const baseURL = process.argv[2] || "http://127.0.0.1:4185/";
const output = path.resolve(process.argv[3] || ".review/spine-legibility-final");
await mkdir(output, { recursive: true });
const report = { baseURL, capturedAt: new Date().toISOString(), scope: "Actual compiled WebGL, current 46-book shelf in RU/EN; no source injection", cases: [], issues: [] };
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const language of ["ru", "en"]) {
    const page = await browser.newPage({ viewport: { width: 1720, height: 1000 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.addInitScript(installObservers);
    await page.addInitScript(value => localStorage.setItem("probpera-interface-language", value), language);
    await page.goto(new URL("#books", baseURL).href, { waitUntil: "domcontentloaded" });
    await page.locator(".book-shelf-frame__workspace").scrollIntoViewIfNeeded();
    const seen = new Set();
    for (let batch = 0; batch < 4; batch += 1) {
      await page.mouse.move(0, 0);
      await page.waitForFunction(() => {
        const state = window.__shelfAudit.read();
        return state?.books.length === 17 && state.phase === "SHELF_IDLE" && state.pendingFrames === 0;
      }, null, { timeout: 30000 });
      const result = await page.evaluate(() => {
        const data = window.__shelfAudit.sceneData();
        const patches = window.__shelfAudit.palettePatches().sort((a, b) => a.x - b.x);
        const alphaPixels = (image, top, bottom) => {
          if (!image?.getContext) return 0;
          const pixels = image.getContext("2d").getImageData(0, Math.floor(image.height * top), image.width, Math.ceil(image.height * (bottom - top))).data;
          let count = 0;
          for (let index = 3; index < pixels.length; index += 4) if (pixels[index] > 100) count += 1;
          return count;
        };
        const books = data.books.map(book => {
          let foil = null;
          book.group.traverse(object => { if (object.isMesh && object.renderOrder === 4) foil = object; });
          const image = foil?.material?.map?.image;
          return { key: book.layout.spec.key, title: book.layout.spec.title, writer: book.layout.spec.writer,
            visible: Boolean(foil?.visible), titlePixels: alphaPixels(image, .15, .40), authorPixels: alphaPixels(image, .465, .675) };
        });
        const gaps = patches.slice(1).map((patch, index) => patch.x - patches[index].x - patches[index].width);
        return { state: window.__shelfAudit.read(), patches, books,
          topSpread: Math.max(...patches.map(patch => patch.y)) - Math.min(...patches.map(patch => patch.y)),
          bottomSpread: Math.max(...patches.map(patch => patch.y + patch.height)) - Math.min(...patches.map(patch => patch.y + patch.height)),
          minGap: Math.min(...gaps), maxGap: Math.max(...gaps) };
      });
      for (const book of result.books) {
        seen.add(book.key);
        if (!book.visible || book.titlePixels === 0 || book.authorPixels === 0) report.issues.push(language + ": empty spine " + book.key);
      }
      if (result.topSpread > 1 || result.bottomSpread > 1 || result.maxGap - result.minGap > 1 || result.minGap <= 0) report.issues.push(language + ": misaligned batch " + batch);
      report.cases.push({ language, batch, ...result });
      if (batch === 0) await page.locator(".book-shelf-frame__workspace").screenshot({ path: path.join(output, language + "-row.png") });
      if (language === "ru") {
        for (const [key, name] of [["england:h_g_wells:the-world-set-free", "world-set-free"], ["usa:harper_lee:to-kill-a-mockingbird-editorial", "mockingbird"], ["england:jane_austen:pride-and-prejudice", "pride-prejudice"]]) {
          const patch = result.patches.find(item => item.key === key);
          if (!patch) continue;
          await page.screenshot({ path: path.join(output, name + ".png"), clip: {
            x: result.state.canvas.x + patch.x, y: result.state.canvas.y + patch.y,
            width: patch.width, height: patch.height,
          } });
        }
      }
      const next = page.getByRole("button", { name: language === "ru" ? "Следующие 13 произведений" : "Next 13 works", exact: true });
      if (batch === 3 || await next.isDisabled()) break;
      await next.dispatchEvent("click");
      await page.waitForFunction(previous => window.__shelfAudit.read()?.books[0]?.key !== previous, result.state.books[0].key, { timeout: 12000 });
    }
    if (seen.size !== 46) report.issues.push(language + ": expected 46 unique books, received " + seen.size);
    report.issues.push(...errors.map(error => language + ": " + error));
    console.log(language + ": " + seen.size + " actual titles and authors checked");
    await page.close();
  }
} catch (error) {
  report.issues.push(String(error));
} finally {
  await browser.close();
  await writeFile(path.join(output, "result.json"), JSON.stringify(report, null, 2) + "\n");
}
console.log(JSON.stringify({ cases: report.cases.length, issues: report.issues, output }));
if (report.issues.length) process.exitCode = 1;
