import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { installObservers } from "./lib/bookshelf-physics-observer.mjs";

const baseURL = process.argv[2] || "http://127.0.0.1:4185/";
const baseline = process.argv.includes("--baseline");
const smoke = process.argv.includes("--smoke");
const intentOnly = process.argv.includes("--intent-only");
const output = path.resolve("reports/bookshelf-owner-evidence", baseline ? "physics-before" : "physics-after");
await mkdir(output, { recursive: true });
const report = { baseURL, capturedAt: new Date().toISOString(), mode: intentOnly ? "latest-intent" : baseline ? "baseline" : smoke ? "smoke" : "full", cases: [], issues: [] };
const browser = await chromium.launch({ channel: "chrome", headless: true });

const read = (page) => page.evaluate(() => window.__shelfAudit.read());
async function phase(page, value) {
  await page.waitForFunction((wanted) => document.querySelector(".book-shelf-scene")?.dataset.bookShelfPhase === wanted, value, { timeout: 20000 });
}
async function idle(page) {
  await phase(page, "SHELF_IDLE");
  const started = Date.now();
  await page.waitForFunction(() => window.__shelfAudit.read()?.pendingFrames === 0, null, { timeout: 5000 });
  return Date.now() - started;
}
function check(condition, issue) { if (!condition) report.issues.push(issue); }
async function selectedBounds(page, label) {
  await page.waitForTimeout(500);
  const state = await read(page);
  const bounds = await page.evaluate(() => window.__shelfAudit.footprint());
  const free = { x: state.canvas.x + state.insets.left, y: state.canvas.y + state.insets.top,
    right: state.canvas.x + state.canvas.width - state.insets.right,
    bottom: state.canvas.y + state.canvas.height - state.insets.bottom };
  const inside = bounds && bounds.x >= free.x - 1 && bounds.y >= free.y - 1 && bounds.right <= free.right + 1 && bounds.bottom <= free.bottom + 1;
  const height = bounds ? bounds.bottom - bounds.y : 0;
  const heightOccupancy = height / Math.max(1, free.bottom - free.y);
  check(inside, `${label}: physical book crosses the unobscured rectangle`);
  check(height >= Math.min(96, (free.bottom - free.y) / 2) && heightOccupancy >= 0.35,
    `${label}: physical book is too small in its available rectangle (${height.toFixed(1)}px)`);
  return { bounds, free, inside, height, heightOccupancy };
}
async function openSpine(page, index) {
  const before = await read(page);
  const book = before.books[index < 0 ? before.books.length + index : index];
  const started = Date.now();
  await page.mouse.move(book.x, book.y);
  await page.waitForTimeout(120);
  // Hover may pull the same spine a few pixels forward. Use its current centre.
  const current = (await read(page)).books.find((candidate) => candidate.key === book.key);
  await page.mouse.click(current.x, current.y);
  await phase(page, "INSPECTION_CLOSED");
  const after = await read(page);
  check(after.selectedKey === book.key, `Wrong selected spine: ${book.key} -> ${after.selectedKey}`);
  return { key: book.key, elapsedMs: Date.now() - started, title: after.selectedTitle };
}
async function closeBook(page) {
  await page.locator(".book-detail-close").click();
  return idle(page);
}
async function pageDrag(page, direction, cancel = false) {
  const before = await read(page);
  const point = await page.evaluate((backward) => window.__shelfAudit.pagePoint(backward ? 0.18 : 0.92, 0.75), direction === "backward");
  if (!point) throw new Error("The physical page is not available");
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await phase(page, "PAGE_DRAGGING");
  const distance = Math.max(85, Math.min(220, before.canvas.width * 0.55));
  const sign = direction === "forward" ? -1 : 1;
  await page.mouse.move(point.x + distance * sign, point.y, { steps: 12 });
  if (cancel) {
    await page.locator("#books canvas").dispatchEvent("pointercancel", { pointerId: 1, pointerType: "mouse", isPrimary: true, clientX: point.x + distance * sign, clientY: point.y });
  }
  await page.mouse.up();
  await phase(page, "BOOK_OPEN");
  const after = await read(page);
  const expected = before.pageIndex + (cancel ? 0 : direction === "forward" ? 1 : -1);
  check(after.pageIndex === expected, `Page ${direction}${cancel ? " cancel" : ""}: expected ${expected}, received ${after.pageIndex}`);
  return { before: before.pageIndex, after: after.pageIndex, cancel, direction };
}

try {
  for (const viewport of [...(baseline || intentOnly ? [] : [{ width: 390, height: 844 }]), { width: 1440, height: 1000 }]) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    await page.addInitScript(installObservers);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(new URL("#books", baseURL).href, { waitUntil: "domcontentloaded" });
    await page.locator(".book-shelf-frame__workspace").scrollIntoViewIfNeeded();
    await page.waitForFunction(() => window.__shelfAudit.read()?.books.length > 0, null, { timeout: 30000 });
    await idle(page);
    const result = { viewport, initial: await read(page), interactions: [], errors };
    report.cases.push(result);
    if (!intentOnly) {
      await page.locator(".book-shelf-frame__workspace").screenshot({ path: path.join(output, `closed-row-${viewport.width}.png`) });
      await writeFile(path.join(output, `closed-row-${viewport.width}.json`), JSON.stringify({
        ...result.initial, patches: await page.evaluate(() => window.__shelfAudit.palettePatches()),
      }, null, 2) + "\n");
    }
    console.log(`${viewport.width}: scene ready with ${result.initial.books.length} books`);
    for (const index of intentOnly ? [] : baseline ? [0] : [0, Math.floor(result.initial.books.length / 2), -1]) {
      const interaction = await openSpine(page, index);
      interaction.framing = await selectedBounds(page, `${viewport.width} closed ${index}`);
      result.interactions.push(interaction);
      await page.locator(".book-detail-open-cover").click();
      await phase(page, "BOOK_OPEN");
      interaction.openFraming = await selectedBounds(page, `${viewport.width} open ${index}`);
      if (index === 0) await page.locator(".book-shelf-frame__workspace").screenshot({ path: path.join(output, `open-${viewport.width}.png`) });
      interaction.turns = [await pageDrag(page, "forward")];
      if (index === 0) await page.locator(".book-shelf-frame__workspace").screenshot({ path: path.join(output, `page-metadata-${viewport.width}.png`) });
      interaction.turns.push(await pageDrag(page, "backward"), await pageDrag(page, "forward", true));
      console.log(`${viewport.width}: ${interaction.title}: open ${interaction.elapsedMs}ms, page results ${interaction.turns.map((turn) => turn.after).join("/")}`);
      await closeBook(page);
    }
    if (!baseline && viewport.width === 1440) {
      const intentions = [];
      for (const index of [2, -2]) {
        const moving = await read(page);
        const book = moving.books[index < 0 ? moving.books.length + index : index];
        intentions.push({ key: book.key, phase: moving.phase });
        await page.mouse.click(book.x, book.y);
      }
      await phase(page, "INSPECTION_CLOSED");
      result.latestIntent = { intentions, selectedKey: (await read(page)).selectedKey };
      console.log(`${viewport.width}: moving click phases ${intentions.map((intent) => intent.phase).join("/")}`);
      check(["SHELF_MOVING", "SHELF_SETTLING"].includes(intentions.at(-1).phase),
        "The latest-intent probe did not issue its replacement click while moving/settling");
      check(result.latestIntent.selectedKey === intentions.at(-1).key, "The latest click while moving did not win");
      await closeBook(page);
    }
    if (intentOnly) { await page.close(); continue; }
    const warm = await read(page);
    const cycles = baseline ? 3 : smoke ? 2 : viewport.width === 1440 ? 50 : 2;
    for (let index = 0; index < cycles; index++) {
      await openSpine(page, baseline ? 0 : Math.floor((await read(page)).books.length / 2));
      await closeBook(page);
      if ((index + 1) % 10 === 0) console.log(`${viewport.width}: ${index + 1} open/close cycles`);
    }
    result.openClose = { cycles, before: warm, after: await read(page) };
    await openSpine(page, baseline ? 0 : Math.floor((await read(page)).books.length / 2));
    await page.locator(".book-detail-open-cover").click();
    await phase(page, "BOOK_OPEN");
    const turnCount = baseline ? 4 : smoke ? 4 : viewport.width === 1440 ? 100 : 4;
    const turnWarm = await read(page);
    for (let index = 0; index < turnCount; index++) {
      const button = page.locator(index % 2 === 0 ? ".book-detail-page-turn.is-next" : ".book-detail-page-turn.is-previous");
      await button.click();
      await phase(page, "BOOK_OPEN");
      if ((index + 1) % 20 === 0) console.log(`${viewport.width}: ${index + 1} page turns`);
    }
    result.pageTurns = { cycles: turnCount, before: turnWarm, after: await read(page) };
    result.idleSettlingMs = await closeBook(page);
    const still = await read(page);
    await page.waitForTimeout(1200);
    result.idleDrawCalls = (await read(page)).draws - still.draws;
    check(result.idleDrawCalls === 0, `${viewport.width}: ${result.idleDrawCalls} draw calls while idle`);
    for (const metric of ["Texture", "Buffer", "Framebuffer", "Renderbuffer"]) {
      const before = result.openClose.before.resources[metric]?.live ?? 0;
      const after = result.openClose.after.resources[metric]?.live ?? 0;
      check(after <= before + 2, `${viewport.width}: ${metric} grew from ${before} to ${after} after closing`);
    }
    check(errors.length === 0, `${viewport.width}: page errors: ${errors.join("; ")}`);
    await page.close();
  }
} catch (error) {
  report.issues.push(error.message);
  const page = browser.contexts().flatMap((context) => context.pages()).at(-1);
  if (page && !page.isClosed()) {
    report.failureState = await read(page).catch(() => null);
    await page.screenshot({ path: path.join(output, "failure.png") }).catch(() => {});
  }
} finally {
  if (intentOnly && !report.cases.some((result) => result.latestIntent)) report.issues.push("The isolated latest-intent scenario did not execute");
  await browser.close();
  await writeFile(path.join(output, intentOnly ? "latest-intent.json" : "physics.json"), JSON.stringify(report, null, 2) + "\n");
}
console.log(JSON.stringify({ cases: report.cases.length, issues: report.issues, output }));
if (report.issues.length && !baseline) process.exitCode = 1;
