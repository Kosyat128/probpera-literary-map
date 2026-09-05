import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { installObservers } from './lib/bookshelf-physics-observer.mjs';
const baseURL = process.argv.find((value, index) => index > 1 && !value.startsWith('--')) || 'http://127.0.0.1:4185/';
const directory = fileURLToPath(new URL('../.review/spine-extraction-final/', import.meta.url));
await mkdir(directory, { recursive: true });
const report = { capturedAt: new Date().toISOString(), baseURL, renderedFrom: 'Actual compiled production, no source injection', cases: [], issues: [] };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
let activePage; let stage = "startup";
try {
  for (const width of [1720, 390]) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1000 }, deviceScaleFactor: 1 });
    const page = await context.newPage(); activePage = page;
    await page.addInitScript(installObservers);
    page.on('pageerror', error => report.issues.push(error.message));
    await page.goto(new URL('#books', baseURL).href, { waitUntil: 'domcontentloaded' });
    const workspace = page.locator('.book-shelf-frame__workspace');
    await workspace.scrollIntoViewIfNeeded();
    const idle = () => page.waitForFunction(() => { const s = window.__shelfAudit.read(); return s?.books.length >= 7 && s.phase === 'SHELF_IDLE' && s.pendingFrames === 0; }, null, { timeout: 30000 });
    await page.mouse.move(0, 0);
    stage = "initial idle"; await idle(); console.log(stage);
    for (const edge of (process.argv.includes('--last-only') ? ['last'] : ['first', 'last'])) {
      const before = await page.evaluate(() => ({ state: window.__shelfAudit.read(), identities: window.__shelfAudit.sceneData().books.map(book => ({ key: book.layout.spec.key, group: book.group.uuid, x: book.group.position.x })) }));
      const target = edge === 'first' ? before.state.books[0] : before.state.books.at(-1);
      if (edge === 'last') await page.screenshot({ path: `${directory}/${width}-${edge}-0-row.png` });
      await page.evaluate(key => {
        window.__extractionTrace = [];
        window.__extractionRecording = true;
        const sample = () => {
          if (!window.__extractionRecording) return;
          const data = window.__shelfAudit.sceneData();
          const book = data?.books.find(book => book.layout.spec.key === key);
          if (book) {
            const canvas = data.state.gl.domElement.getBoundingClientRect();
            const insets = data.controller?.viewportInsets || { top: 0, right: 0, bottom: 0, left: 0 };
            window.__extractionTrace.push({ at: performance.now(), phase: book.phase, clock: { ...data.controller.extractionClock.current },
              group: book.group.uuid, position: book.group.position.toArray(), rotation: book.group.rotation.toArray().slice(0, 3), scale: book.group.scale.x,
              footprint: window.__shelfAudit.footprint(), camera: data.state.camera.position.toArray(),
              free: { x: canvas.x + insets.left, y: canvas.y + insets.top, right: canvas.right - insets.right, bottom: canvas.bottom - insets.bottom } });
          }
          if (window.__extractionTrace.length < 2000) requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      }, target.key);
      stage = "clicked " + target.key; console.log(stage); await page.mouse.click(target.x, target.y);
      await page.mouse.move(0, 0);
      const frames = [];
      for (const [index, progress] of [.12, .4, .6, .85].entries()) {
        stage = "entry progress " + progress; console.log(stage); await page.waitForFunction(progress => {
          const c = window.__shelfAudit.sceneData()?.controller?.extractionClock.current;
          return c?.phase === 'INSPECTION_ENTERING' && c.ready && c.progress >= progress;
        }, progress, { timeout: 30000 });
        frames.push(await page.evaluate(() => ({ ...window.__shelfAudit.sceneData().controller.extractionClock.current })));
        if (edge === 'last' && width === 1720) await page.screenshot({ path: `${directory}/${width}-${edge}-${index + 1}-pull.png` });
      }
      await page.waitForFunction(() => window.__shelfAudit.read()?.phase === 'INSPECTION_CLOSED', null, { timeout: 30000 });
      if (edge === 'last') await page.screenshot({ path: `${directory}/${width}-${edge}-5-inspection.png` });
      stage = "return idle"; console.log(stage); await page.keyboard.press('Escape');
      await idle();
      await page.waitForTimeout(350);
      const result = await page.evaluate(() => {
        window.__extractionRecording = false;
        return { trace: window.__extractionTrace, after: window.__shelfAudit.read(), identities: window.__shelfAudit.sceneData().books.map(book => ({ key: book.layout.spec.key, group: book.group.uuid, x: book.group.position.x })) };
      });
      const moving = result.trace.filter(sample => sample.clock.ready && sample.clock.progress > .02 && sample.clock.progress < 1 && ['INSPECTION_ENTERING', 'SHELF_RESTORING'].includes(sample.phase));
      const clipped = moving.filter(sample => sample.footprint && (sample.footprint.x < sample.free.x - 1 || sample.footprint.right > sample.free.right + 1 || sample.footprint.y < sample.free.y - 1 || sample.footprint.bottom > sample.free.bottom + 1));
      const entry = moving.filter(sample => sample.phase === 'INSPECTION_ENTERING');
      const straight = entry.filter(sample => sample.clock.progress < .45);
      const missing = !straight.length || straight.some(sample => Math.abs(sample.rotation[1] - Math.PI / 2) > .001 || Math.abs(sample.scale - 1) > .001);
      if (clipped.length) report.issues.push(`${width}/${edge}: ${clipped.length} clipped moving frames`);
      if (missing) report.issues.push(`${width}/${edge}: missing straight extraction`);
      if (JSON.stringify(before.identities) !== JSON.stringify(result.identities)) report.issues.push(`${width}/${edge}: changed row identity/slot`);
      report.cases.push({ width, edge, key: target.key, frames, clipped, straightFrames: straight.length, before, ...result });
      await writeFile(directory + '/result.json', JSON.stringify(report, null, 2));
      console.log(JSON.stringify({ width, edge, movingFrames: moving.length, straightFrames: straight.length, clipped: clipped.length }));
    }
    await context.close();
  }
} catch (error) { report.issues.push(stage + ": " + String(error)); if (activePage) { report.failure = await activePage.evaluate(() => ({state:window.__shelfAudit?.read(), controller:window.__shelfAudit?.sceneData()?.controller, trace:window.__extractionTrace})).catch(String); await activePage.screenshot({path:directory+"/failure.png"}).catch(()=>{}); } }
finally { await browser.close(); await writeFile(directory + '/result.json', JSON.stringify(report, null, 2)); }
console.log(JSON.stringify({ cases: report.cases.length, issues: report.issues }));
if (report.issues.length) process.exitCode = 1;
