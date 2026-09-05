import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { installObservers } from './lib/bookshelf-physics-observer.mjs';

const base = process.argv[2] || 'http://127.0.0.1:4185/';
const output = process.argv[3] || 'reports/bookshelf-owner-evidence/landscape-final';
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = { startedAt: new Date().toISOString(), cases: [], issues: [], errors: [] };
const check = (value, message) => { if (!value) report.issues.push(message); };
const phase = (page, wanted) => page.waitForFunction(
  expected => window.__shelfAudit.read()?.phase === expected, wanted, { timeout: 25000 },
);

async function capture(page, label) {
  // Wait for the coalesced DOM inset measurement as well as the demand render.
  await page.waitForFunction(() => {
    const state = window.__shelfAudit.read();
    if (!state) return false;
    const key = JSON.stringify([innerWidth, innerHeight, state.canvas, state.insets, state.phase]);
    const now = performance.now();
    if (window.__landscapeLayout?.key !== key) {
      window.__landscapeLayout = { key, time: now };
      return false;
    }
    return now - window.__landscapeLayout.time >= 320;
  }, null, { timeout: 8000 });
  await page.waitForFunction(() => {
    const data = window.__shelfAudit.sceneData();
    const selected = data?.books.find(book => book.selectedBookKey === book.layout.spec.key);
    return selected && !selected.group.children.some(child => child.userData.inspectionSurface && !child.visible)
      && window.__shelfAudit.read()?.pendingFrames === 0;
  }, null, { timeout: 8000 });

  const result = await page.evaluate(() => {
    const state = window.__shelfAudit.read();
    const data = window.__shelfAudit.sceneData();
    const selected = data.books.find(book => book.selectedBookKey === book.layout.spec.key);
    const bounds = window.__shelfAudit.footprint();
    const { insets: i, canvas: c } = state;
    const free = { left: c.x + i.left, top: c.y + i.top, right: c.x + c.width - i.right, bottom: c.y + c.height - i.bottom };
    const panel = document.querySelector('.book-shelf-frame__detail');
    const reader = document.querySelector('.book-dossier-reader');
    const bars = [...document.querySelectorAll('.site-header, .mobile-nav, .topline')]
      .filter(bar => bar.getClientRects().length && ['fixed', 'sticky'].includes(getComputedStyle(bar).position))
      .map(bar => ({ className: bar.className, rect: bar.getBoundingClientRect().toJSON() }));
    const controls = [...document.querySelectorAll('.book-shelf-scene__accessible-actions button')]
      .filter(button => button.getClientRects().length && getComputedStyle(button).visibility !== 'hidden')
      .map(button => ({ text: button.textContent, rect: button.getBoundingClientRect().toJSON() }));
    return {
      viewport: { width: innerWidth, height: innerHeight }, state, bounds, free,
      semantic: selected?.inspectionSession?.semanticPosition || null,
      panel: { position: panel?.dataset.mobilePosition, rect: panel?.getBoundingClientRect().toJSON() },
      reader: { present: Boolean(reader), text: reader?.textContent?.trim().slice(0, 220), editable: reader?.querySelectorAll('[contenteditable=true],textarea').length || 0 },
      controls, bars, scrollY,
    };
  });
  result.label = label;
  report.cases.push(result);
  const { bounds: b, free: f } = result;
  const overlaps = r => b && Math.min(b.right, r.right) > Math.max(b.x, r.x) + 1
    && Math.min(b.bottom, r.bottom) > Math.max(b.y, r.y) + 1;
  result.inside = Boolean(b && b.x >= f.left - 1 && b.y >= f.top - 1 && b.right <= f.right + 1 && b.bottom <= f.bottom + 1);
  result.freeInViewport = f.bottom > f.top && f.right > f.left && f.top >= -1 && f.bottom <= result.viewport.height + 1;
  result.overlappingControls = result.controls.filter(({ rect }) => overlaps(rect)).map(control => control.text);
  result.overlappingBars = result.bars.filter(({ rect }) => overlaps(rect)).map(bar => bar.className);
  check(!result.overlappingBars.length, `${label}: sticky header overlaps physical book`);
  check(result.inside, `${label}: physical bounds leave free rect`);
  check(result.freeInViewport, `${label}: free rect not in viewport`);
  check(!result.overlappingControls.length, `${label}: physical book overlaps actions`);
  await page.screenshot({ path: path.join(output, `${label}.png`) });
}

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  page.on('pageerror', error => report.errors.push(error.message));
  await page.addInitScript(installObservers);
  await page.goto(new URL('#books', base).href);
  // The hash targets the archive heading; the scene below it is loaded lazily.
  await page.locator('.book-shelf-frame__workspace').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => window.__shelfAudit.read()?.books.length);
  await page.evaluate(() => document.fonts.ready);
  await page.locator('.book-shelf-frame__workspace').evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await page.waitForTimeout(400);
  await page.waitForFunction(() => window.__shelfAudit.read()?.pendingFrames === 0);
  report.initial = await page.evaluate(() => {
    const state = window.__shelfAudit.read();
    const first = state.books[0];
    return { state, hit: document.elementFromPoint(first.x, first.y)?.outerHTML.slice(0, 240) };
  });
  const first = report.initial.state.books[0];
  await page.mouse.click(first.x, first.y);
  await phase(page, 'INSPECTION_CLOSED');
  await page.locator('.book-detail-open-cover').click();
  await phase(page, 'BOOK_OPEN');
  await page.locator('.book-detail-page-turn.is-next').click();
  await page.waitForFunction(() => window.__shelfAudit.read()?.phase === 'BOOK_OPEN' && window.__shelfAudit.read()?.pageIndex === 1);
  await capture(page, 'portrait-half');
  const semantic = JSON.stringify(report.cases[0].semantic);
  check(report.cases[0].semantic, 'Initial semantic position missing');

  const handle = await page.locator('.book-detail-mobile-handle').boundingBox();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + 20);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + 155, { steps: 10 });
  await page.mouse.up();
  await page.waitForFunction(() => document.querySelector('.book-shelf-frame__detail')?.dataset.mobilePosition === 'collapsed');
  await capture(page, 'portrait-collapsed');
  await page.setViewportSize({ width: 844, height: 390 });
  await capture(page, 'rotated-collapsed');
  await page.locator('.book-shelf-frame__workspace').scrollIntoViewIfNeeded();
  await capture(page, 'landscape-centred');

  report.panelControls = await page.locator('.book-detail-page-turn').evaluateAll(buttons => buttons.map(button => ({ width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height })));
  check(report.panelControls.every(rect => rect.width >= 44 && rect.height >= 44), 'Landscape panel page controls smaller than 44px');
  await page.locator('.book-detail-page-turn.is-next').click();
  await page.waitForFunction(() => window.__shelfAudit.read()?.phase === 'BOOK_OPEN' && window.__shelfAudit.read()?.pageIndex === 2);
  await page.locator('.book-detail-page-turn.is-previous').click();
  await page.waitForFunction(() => window.__shelfAudit.read()?.phase === 'BOOK_OPEN' && window.__shelfAudit.read()?.pageIndex === 1);
  report.panelNavigationPassed = true;
  await page.locator('.book-detail-read-dossier').click();
  await page.locator('.book-dossier-reader').waitFor({ state: 'visible' });
  report.domReader = await page.locator('.book-dossier-reader').evaluate(reader => ({ text: reader.textContent?.trim().slice(0, 280), focus: document.activeElement === reader, rect: reader.getBoundingClientRect().toJSON(), editable: reader.querySelectorAll('[contenteditable=true],textarea').length }));
  check(Boolean(report.domReader.text) && report.domReader.editable === 0, 'Readonly dossier unavailable after rotation');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.book-shelf-frame__workspace').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('.book-shelf-frame__detail')?.dataset.mobilePosition === 'half');
  await capture(page, 'portrait-restored');
  for (const item of report.cases) check(JSON.stringify(item.semantic) === semantic, `${item.label}: semantic anchor changed`);
  await page.locator('.book-detail-close').click();
  await phase(page, 'SHELF_IDLE');
  await page.waitForTimeout(300);
  report.closed = await page.evaluate(() => ({ selected: window.__shelfAudit.read()?.selectedKey, detailPresent: Boolean(document.querySelector('.book-shelf-frame__detail')), active: { tag: document.activeElement.tagName, className: document.activeElement.className, text: document.activeElement.textContent?.slice(0, 100) }, focusInShelf: document.querySelector('#books')?.contains(document.activeElement) }));
  check(!report.closed.selected && !report.closed.detailPresent && report.closed.focusInShelf, 'Close did not restore shelf focus');
} catch (error) {
  report.issues.push(error.stack || String(error));
  const page = browser.contexts()[0]?.pages()[0];
  if (page) {
    report.failureState = await page.evaluate(() => window.__shelfAudit?.read()).catch(() => null);
    await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
  }
} finally {
  await browser.close();
}
check(!report.errors.length, 'Browser reported page errors');
fs.writeFileSync(path.join(output, 'result.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ cases: report.cases.map(({ label, inside, free, bounds, overlappingControls }) => ({ label, inside, free, bounds, overlappingControls })), closed: report.closed, issues: report.issues }));
if (report.issues.length) process.exitCode = 1;
