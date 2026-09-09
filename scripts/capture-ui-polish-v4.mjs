import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function resolveCaptureOutputDirectory(phase, reportsRoot) {
  if (typeof phase !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/u.test(phase) || /[\r\n]/u.test(phase)) {
    throw new Error('Capture phase must be a lowercase name of 1-64 letters, digits or hyphens, starting with a letter.');
  }
  const directory = path.resolve(reportsRoot, phase);
  const relative = path.relative(reportsRoot, directory);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error('Capture output must remain inside reports/ui-polish-v4.');
  }
  return directory;
}

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const reportsRoot = path.resolve(projectRoot, 'reports', 'ui-polish-v4');
const phase = process.argv[2] || 'after';
const baseURL = process.env.POLISH_URL || 'http://127.0.0.1:4186/probpera-literary-map/';
const out = resolveCaptureOutputDirectory(phase, reportsRoot);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const record = { phase, baseURL, date: new Date().toISOString(), head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: projectRoot, encoding: 'utf8' }).trim(), captures: [] };
record.sourceSha256 = JSON.parse(await readFile(path.join(reportsRoot, 'candidate-source.json'), 'utf8')).sourceSha256;
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', deviceScaleFactor: 1, isMobile: width === 390, hasTouch: width === 390 });
    // Read-only local QA: external writes are never submitted.
    await context.route('**/*', async route => {
      const req = route.request();
      if (!req.url().startsWith('http://127.0.0.1:') && !['GET', 'HEAD', 'OPTIONS'].includes(req.method())) return route.abort();
      return route.continue();
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.__polishShifts = [];
      new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__polishShifts.push(e.value); }).observe({ type: 'layout-shift', buffered: true });
    });
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const early = await page.evaluate(() => ({ requests: performance.getEntriesByType('resource').map(r => ({ name: r.name, bytes: r.transferSize, decoded: r.decodedBodySize })), cls: window.__polishShifts.reduce((a,b)=>a+b,0) }));
    const language = page.locator('.interface-language-control button').first();
    if (await language.count()) await language.click();
    const selectors = ['.magazine-hero', '#atlas', '#book-day', '#books', '#featured-journal', '#reader-discussion', '#journal', '#authors', '#sections', '#calendar', '#community', '#editorial-policy', '.site-footer'];
    for (const selector of selectors) {
      const block = page.locator(selector).first();
      if (!await block.count()) continue;
      await block.evaluate(el => el.scrollIntoView({ block: 'start', behavior: 'instant' }));
      await page.waitForTimeout(650);
      await block.locator('img').evaluateAll(images => Promise.race([Promise.allSettled(images.map(img => img.decode())), new Promise(resolve => setTimeout(resolve, 3500))]));
      console.log(`${phase} ${width}: ${selector}`);
    }
    await page.evaluate(() => document.fonts.ready);
    const blocks = await page.evaluate(selectors => selectors.flatMap(selector => {
      const el = document.querySelector(selector); if (!el) return [];
      const b = el.getBoundingClientRect(); const s = getComputedStyle(el);
      return [{ selector, top: b.top + scrollY, height: b.height, width: b.width, background: s.backgroundColor, font: s.fontFamily }];
    }), selectors);
    for (const b of blocks.filter(b => b.selector !== '.magazine-hero')) {
      const y = Math.max(0, b.top - 130);
      await page.evaluate(y => scrollTo({ top: y, behavior: 'instant' }), y);
      await page.waitForTimeout(150);
      await page.screenshot({ path: `${out}/ru-${width}-${b.selector.slice(1)}.png`, animations: 'disabled' });
    }
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(150);
    // Bounded captures avoid Chromium's unreliable very tall page composites.
    // The twelve boundary frames above are the primary composition evidence.
    await page.screenshot({ path: `${out}/ru-home-top-${width}.png`, animations: 'disabled' });
    record.captures.push({ width, language: await page.locator('html').getAttribute('lang'), dpr: 1, touchEmulated: width === 390, blocks, early, errors, overflow: await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) });
    await context.close();
  }
} finally {
  await browser.close();
  await writeFile(`${out}/measurements.json`, JSON.stringify(record, null, 2) + '\n');
}
console.log(JSON.stringify(record.captures.map(c => ({ width: c.width, blocks: c.blocks.length, overflow: c.overflow, errors: c.errors, earlyRequests: c.early.requests.length, cls: c.early.cls }))));
