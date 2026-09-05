import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { installObservers } from "./lib/bookshelf-physics-observer.mjs";

const baseURL = process.argv[2] || "http://127.0.0.1:4185/";
const output = path.resolve("reports/bookshelf-owner-evidence/physics-after");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const report = { baseURL, capturedAt: new Date().toISOString(), issues: [] };
const check = (condition, issue) => { if (!condition) report.issues.push(issue); };
const read = page => page.evaluate(() => window.__shelfAudit.read());
const phase = (page, value) => page.waitForFunction(wanted => window.__shelfAudit.read()?.phase === wanted, value, { timeout: 25000 });

function installTrace() {
  window.__openTrace = { longTasks: [], gpu: [], phases: [], heartbeats: [] };
  new PerformanceObserver(list => window.__openTrace.longTasks.push(...list.getEntries().map(entry => ({ start: entry.startTime, duration: entry.duration })))).observe({ type: "longtask", buffered: true });
  for (const prototype of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
    for (const method of ["getProgramInfoLog", "getShaderInfoLog", "getProgramParameter", "getActiveUniform", "getUniformLocation", "getActiveAttrib", "compileShader", "linkProgram", "texImage2D", "drawArrays", "drawElements"]) {
      const original = prototype[method];
      if (!original || original.firstUseTraced) continue;
      const wrapped = function (...args) {
        const start = performance.now();
        const result = original.apply(this, args);
        const duration = performance.now() - start;
        if (duration > 2) window.__openTrace.gpu.push({ method, start, duration });
        return result;
      };
      wrapped.firstUseTraced = true;
      prototype[method] = wrapped;
    }
  }
}

async function openFirst(page) {
  const first = (await read(page)).books[0];
  await page.mouse.click(first.x, first.y);
  await phase(page, "INSPECTION_CLOSED");
  check((await read(page)).selectedKey === first.key, "Cold selection changed book identity");
}

async function close(page) {
  await page.locator(".book-detail-close").click();
  await phase(page, "SHELF_IDLE");
  await page.waitForFunction(() => window.__shelfAudit.read()?.pendingFrames === 0, null, { timeout: 5000 });
}

async function cancelPage(page) {
  const before = await read(page);
  const point = await page.evaluate(() => window.__shelfAudit.pagePoint(0.92, 0.75));
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await phase(page, "PAGE_DRAGGING");
  await page.mouse.move(point.x - 150, point.y, { steps: 8 });
  await page.locator("#books canvas").dispatchEvent("pointercancel", { pointerId: 1, pointerType: "mouse", isPrimary: true, clientX: point.x - 150, clientY: point.y });
  await page.mouse.up();
  await phase(page, "BOOK_OPEN");
  check((await read(page)).pageIndex === before.pageIndex, "Cancelled page drag committed a page");
}

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.addInitScript(installObservers);
  await page.addInitScript(installTrace);
  await page.goto(`${baseURL.replace(/\/$/u, "")}/#books`);
  await page.locator(".book-shelf-frame__workspace").scrollIntoViewIfNeeded();
  await page.waitForFunction(() => window.__shelfAudit.read()?.books.length);
  await page.waitForTimeout(2000);
  await page.evaluate(() => {
    const state = window.__shelfAudit.sceneData().state;
    const context = state.gl.getContext();
    const extension = context.getExtension("WEBGL_debug_renderer_info");
    Object.assign(window.__openTrace, {
      renderer: extension ? context.getParameter(extension.UNMASKED_RENDERER_WEBGL) : "unknown",
      parallelShaderCompile: Boolean(context.getExtension("KHR_parallel_shader_compile")),
      shaderChecks: state.gl.debug.checkShaderErrors,
      fontStatus: document.fonts.status,
    });
    new MutationObserver(() => window.__openTrace.phases.push({ at: performance.now(), phase: window.__shelfAudit.read()?.phase })).observe(document.querySelector(".book-shelf-scene"), { attributes: true, attributeFilter: ["data-book-shelf-phase"] });
    state.gl.domElement.addEventListener("pointerdown", () => {
      window.__openTrace.clickedAt = performance.now();
      window.__openTrace.timer = setInterval(() => window.__openTrace.heartbeats.push(performance.now()), 50);
    }, { capture: true, once: true });
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Profiler.enable");
  await cdp.send("Profiler.start");
  await openFirst(page);
  const { profile } = await cdp.send("Profiler.stop");
  const trace = await page.evaluate(() => {
    clearInterval(window.__openTrace.timer);
    delete window.__openTrace.timer;
    return { ...window.__openTrace, finishedAt: performance.now() };
  });
  const samples = new Map();
  for (let index = 0; index < profile.samples.length; index++) samples.set(profile.samples[index], (samples.get(profile.samples[index]) || 0) + (profile.timeDeltas[index] || 0) / 1000);
  trace.cpuTop = profile.nodes.map(node => ({ ms: samples.get(node.id) || 0, ...node.callFrame })).sort((a, b) => b.ms - a.ms).slice(0, 15);
  trace.elapsedMs = trace.finishedAt - trace.clickedAt;
  trace.postClickLongTasks = trace.longTasks.filter(task => task.start >= trace.clickedAt);
  trace.maxLongTaskMs = Math.max(0, ...trace.postClickLongTasks.map(task => task.duration));
  trace.maxHeartbeatGapMs = Math.max(0, ...[trace.clickedAt, ...trace.heartbeats, trace.finishedAt].slice(1).map((at, index) => at - [trace.clickedAt, ...trace.heartbeats][index]));
  report.trace = trace;
  check(trace.shaderChecks, "Shader diagnostics were disabled");
  check(trace.maxLongTaskMs < 500, `First-use main thread blocked for ${trace.maxLongTaskMs}ms`);
  check(trace.elapsedMs < 5000, `First-use readiness took ${Math.round(trace.elapsedMs)}ms`);

  await page.locator(".book-detail-open-cover").click();
  await phase(page, "BOOK_OPEN");
  await cancelPage(page);
  await page.locator(".book-shelf-scene__page").last().click();
  await page.waitForFunction(() => window.__shelfAudit.read()?.phase === "BOOK_OPEN" && window.__shelfAudit.read()?.pageIndex === 1);
  await page.locator(".book-shelf-scene__page").first().click();
  await page.waitForFunction(() => window.__shelfAudit.read()?.phase === "BOOK_OPEN" && window.__shelfAudit.read()?.pageIndex === 0);
  report.open = await read(page);
  await page.locator(".book-shelf-frame__workspace").screenshot({ path: path.join(output, "shader-warmup-open-1440.png") });
  await close(page);
  report.resourcesBefore = (await read(page)).resources;
  for (let cycle = 0; cycle < 3; cycle++) {
    await openFirst(page);
    await close(page);
  }
  report.resourcesAfter = (await read(page)).resources;
  for (const name of ["Texture", "Buffer", "Program", "Shader", "Framebuffer", "Renderbuffer"]) check(report.resourcesAfter[name]?.live === report.resourcesBefore[name]?.live, `${name} resources grew after warmup cycles`);
  const draws = (await read(page)).draws;
  await page.waitForTimeout(1200);
  report.idleDraws = (await read(page)).draws - draws;
  check(report.idleDraws === 0, "Warmup left idle rendering active");
  await page.close();

  const abortPage = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  abortPage.on("pageerror", error => errors.push(error.message));
  abortPage.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await abortPage.addInitScript(installObservers);
  await abortPage.goto(`${baseURL.replace(/\/$/u, "")}/#books`);
  await abortPage.locator(".book-shelf-frame__workspace").scrollIntoViewIfNeeded();
  await abortPage.waitForFunction(() => window.__shelfAudit.read()?.books.length);
  await abortPage.waitForFunction(() => window.__shelfAudit.read()?.pendingFrames === 0);
  await abortPage.evaluate(() => {
    window.__earlyShaderAbort = [];
    document.addEventListener("keydown", event => {
      if (event.key !== "Escape") return;
      const data = window.__shelfAudit.sceneData();
      const selected = data.books.find(book => book.selectedBookKey === book.layout.spec.key);
      window.__earlyShaderAbort.push({
        phase: window.__shelfAudit.read()?.phase,
        hiddenSurfaces: selected?.group.children.filter(child => child.userData.inspectionSurface && !child.visible).length || 0,
      });
    }, true);
  });
  report.earlyAbort = { before: (await read(abortPage)).resources };
  for (let cycle = 0; cycle < 3; cycle++) {
    const first = (await read(abortPage)).books[0];
    await abortPage.mouse.click(first.x, first.y);
    await phase(abortPage, "INSPECTION_ENTERING");
    await abortPage.keyboard.press("Escape");
    await phase(abortPage, "SHELF_IDLE");
    await abortPage.waitForFunction(() => window.__shelfAudit.read()?.pendingFrames === 0, null, { timeout: 5000 });
  }
  report.earlyAbort.events = await abortPage.evaluate(() => window.__earlyShaderAbort);
  report.earlyAbort.after = (await read(abortPage)).resources;
  check(report.earlyAbort.events.some(event => event.phase === "INSPECTION_ENTERING" && event.hiddenSurfaces > 0), "Early Escape did not occur while shader preparation was pending");
  check(report.earlyAbort.after.Shader?.live <= report.earlyAbort.before.Shader?.live, "Cancelled preparation retained native shaders");
  for (const name of ["Program", "Buffer", "Framebuffer", "Renderbuffer"]) check(report.earlyAbort.after[name]?.live === report.earlyAbort.before[name]?.live, `Cancelled preparation retained ${name} resources`);
  check(errors.length === 0, `Browser page errors: ${errors.join(", ")}`);
  report.errors = errors;
} catch (error) {
  report.issues.push(error.stack || String(error));
} finally {
  await browser.close();
  await writeFile(path.join(output, "shader-warmup-first-use.json"), `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify({ elapsedMs: report.trace?.elapsedMs, maxLongTaskMs: report.trace?.maxLongTaskMs, maxHeartbeatGapMs: report.trace?.maxHeartbeatGapMs, idleDraws: report.idleDraws, issues: report.issues }));
if (report.issues.length) process.exitCode = 1;
