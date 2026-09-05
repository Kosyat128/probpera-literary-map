import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';

// These fixtures exist only in intercepted browser responses, never in the editorial feed.
const base = process.env.LITERARY_NEWS_PREVIEW_URL || 'http://127.0.0.1:5188/probpera-literary-map/';
const output = fileURLToPath(new URL('../.tmp/literary-news-evidence/', import.meta.url));
const readKey = 'probpera-literary-news-read-v1';
function item(id, category, eventDate) {
  return {
    id, category, eventDate, region: ({ first: 'europe', second: 'north-america', third: 'asia', incoming: 'africa' })[id] || 'global', kind: 'announcement', publishedAt: '2026-09-04',
    verifiedAt: '2026-09-05T12:00:00Z', verification: 'confirmed',
    title: { ru: `Тестовая новость ${id}`, en: `Test story ${id}` },
    summary: { ru: `Тестовое описание ${id}`, en: `Test summary ${id}` },
    source: { name: 'Test source', url: `https://example.org/${id}`, language: 'en' },
  };
}
const first = item('first', 'anniversaries', '2026-09-05');
const second = item('second', 'awards', '2026-09-06');
const third = item('third', 'adaptations', '2026-09-07');
const incoming = item('incoming', 'releases', '2026-09-08');
function feed(items) {
  return {
    mode: 'local-prototype', generatedAt: '2026-09-05T20:59:00Z',
    lastCheckedAt: '2026-09-05T20:59:00Z', refreshIntervalSeconds: 600,
    timeZone: 'Europe/Moscow', sources: [], pendingCount: 0, items,
  };
}
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' });
const context = await browser.newContext({ viewport: { width: 1585, height: 1050 }, timezoneId: 'Europe/Moscow' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const results = [];
let current = feed([first, second, third]);
await page.addInitScript(() => { Date.now = () => Date.parse('2026-09-05T20:59:00Z'); });
await page.route('**/__literary-news/feed*', route => route.fulfill({ json: current }));
const panel = page.locator('#literary-news');
const card = id => panel.locator(`article[data-news-id="${id}"]`);
async function refresh() {
  const response = page.waitForResponse(response => new URL(response.url()).pathname === '/__literary-news/feed');
  await panel.locator('.literary-news__refresh').click();
  await response;
  await expect(panel.locator('.literary-news__refresh')).toBeEnabled();
}
try {
  await page.goto(`${base}?literary-news=1#book-day`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await expect(panel.locator('article')).toHaveCount(3, { timeout: 60000 });
  await page.locator('.interface-language-control button').filter({ hasText: 'RU' }).first().click();
  await expect(panel.locator('.literary-news__apply-updates')).toHaveCount(0);
  await expect(card('first').locator('.literary-news__date-hint')).toHaveText('Сегодня');
  await expect(card('second').locator('.literary-news__date-hint')).toHaveText('Завтра');
  await expect(card('third').locator('.literary-news__date-hint')).toHaveText('Через 2 дня');
  results.push('First load is not called new; date hints use Moscow calendar days at 23:59');

  await panel.locator('.literary-news__unread-filter').click();
  await card('first').locator('.literary-news__headline').click();
  await expect(card('first')).toHaveAttribute('data-read', 'true');
  await expect(card('first').locator('.literary-news__summary')).toBeVisible();
  await expect(panel.locator('article')).toHaveCount(3);
  await card('first').locator('.literary-news__headline').click();
  await expect(card('first')).toHaveCount(0);
  await expect(panel.locator('.literary-news__unread-filter')).toBeFocused();
  await panel.locator('.literary-news__unread-filter').click();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(card('first')).toHaveAttribute('data-read', 'true', { timeout: 60000 });
  await card('first').locator('.literary-news__read-toggle').click();
  await expect(card('first')).toHaveAttribute('data-read', 'false');
  results.push('Read history persists; an open story stays in Unread until closed; focus and mark-unread work');

  await card('third').locator('.literary-news__bookmark').click();
  await card('second').locator('.literary-news__headline').click();
  await expect(card('second').locator('.literary-news__summary')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const geometry = () => card('second').evaluate(node => {
    const panel = node.closest('#literary-news');
    const list = panel.querySelector('.literary-news__content');
    return { top: node.getBoundingClientRect().top - panel.getBoundingClientRect().top, scrollTop: list.scrollTop, listTop: list.getBoundingClientRect().top - panel.getBoundingClientRect().top, firstHeight: list.querySelector('article').getBoundingClientRect().height };
  });
  const geometryBefore = await geometry();
  const topBefore = (await card('second').boundingBox()).y - (await panel.boundingBox()).y;
  const corrected = { ...first, summary: { ru: 'Исправленное описание', en: 'Corrected summary' } };
  current = feed([incoming, third, second, corrected]);
  await refresh();
  await expect(card('incoming')).toHaveCount(0);
  await expect(panel.locator('.literary-news__apply-updates')).toBeVisible();
  assert.deepEqual(await panel.locator('article').evaluateAll(nodes => nodes.map(node => node.dataset.newsId)), ['first', 'second', 'third']);
  const topAfter = (await card('second').boundingBox()).y - (await panel.boundingBox()).y;
  assert.ok(Math.abs(topAfter - topBefore) < 1, `Arrivals do not shift an open story within the panel (${JSON.stringify(geometryBefore)} → ${JSON.stringify(await geometry())})`);
  await expect(card('second').locator('.literary-news__summary')).toBeVisible();
  await card('first').locator('.literary-news__headline').click();
  await expect(card('first').locator('.literary-news__summary')).toHaveText('Исправленное описание');
  await card('first').locator('.literary-news__headline').click();
  await refresh();
  await expect(panel.locator('.literary-news__update-status')).toContainText('1');
  current = feed([third, second, corrected]);
  await refresh();
  await expect(panel.locator('.literary-news__apply-updates')).toHaveCount(0);
  current = feed([incoming, third, second, corrected]);
  await refresh();
  await panel.getByLabel('Тема новостей').selectOption('awards');
  await panel.locator('.literary-news__apply-updates').click();
  await expect(panel.getByLabel('Тема новостей')).toHaveValue('awards');
  await expect(panel.locator('.literary-news__content')).toBeFocused();
  await expect(panel.locator('article')).toHaveCount(1);
  await panel.getByLabel('Тема новостей').selectOption('all');
  await expect(card('incoming')).toBeVisible();
  await expect(card('third').locator('.literary-news__bookmark')).toHaveAttribute('aria-pressed', 'true');
  await card('third').locator('.literary-news__headline').click();
  current = feed([incoming, second, corrected]);
  await refresh();
  await expect(card('third')).toHaveCount(0);
  results.push('New arrivals wait without reordering or moving the open story; corrections and withdrawals are immediate; applying preserves filters and saves');

  await page.locator('.interface-language-control button').filter({ hasText: 'EN' }).first().click();
  await expect(panel.locator('.literary-news__unread-filter')).toContainText('Unread');
  await expect(card('second').locator('.literary-news__date-hint')).toHaveText('Tomorrow');
  await page.evaluate(() => { Date.now = () => Date.parse('2026-09-05T21:01:00Z'); });
  await refresh();
  await expect(card('second').locator('.literary-news__date-hint')).toHaveText('Today');
  await expect(card('first').locator('.literary-news__date-hint')).toHaveCount(0);
  results.push('Language switch preserves state; hints advance after Moscow midnight');

  await panel.getByLabel('Event region').selectOption('north-america');
  await expect(panel.locator('article')).toHaveCount(1);
  await expect(card('second')).toBeVisible();
  await panel.getByLabel('Event region').selectOption('all');
  await panel.locator('.literary-news__search-toggle').click();
  await panel.getByRole('searchbox', { name: 'Search the digest' }).fill('новость incoming');
  await expect(panel.locator('article')).toHaveCount(1);
  await expect(card('incoming')).toBeVisible();
  await panel.getByLabel('Event region').selectOption('europe');
  await expect(panel.locator('article')).toHaveCount(0);
  await expect(panel).toContainText('No events match this search yet');
  await panel.getByRole('button', { name: 'Show all news', exact: true }).click();
  await expect(panel.locator('article')).toHaveCount(3);
  await expect(panel.locator('.literary-news__content')).toBeFocused();
  await panel.locator('.literary-news__search-toggle').click();
  results.push('Region and bilingual keyword search combine, preserve language choice and reset cleanly');

  await card('first').locator('.literary-news__bookmark').click();
  await panel.locator('.literary-news__saved-filter').click();
  await card('first').locator('.literary-news__bookmark').focus();
  await page.keyboard.press('Enter');
  await expect(card('first')).toHaveCount(0);
  await expect(panel.locator('.literary-news__saved-filter')).toBeFocused();
  await panel.locator('.literary-news__saved-filter').click();
  current = feed([incoming, second, corrected, third]);
  await refresh();
  await panel.locator('.literary-news__apply-updates').click();
  await panel.locator('.literary-news__expand').click();
  for (const id of ['incoming', 'second', 'first', 'third']) {
    if (await card(id).getAttribute('data-read') === 'true') await card(id).locator('.literary-news__read-toggle').click();
  }
  await panel.locator('.literary-news__unread-filter').click();
  await panel.locator('.literary-news__expand').click();
  await card('first').locator('.literary-news__read-toggle').click();
  await expect(panel.locator('article')).toHaveCount(3);
  await expect(panel.locator('.literary-news__expand')).toHaveAttribute('aria-expanded', 'true');
  await panel.locator('.literary-news__expand').click();
  await expect(panel).not.toHaveClass(/is-expanded/);
  results.push('Removing a saved story preserves keyboard focus; a shrinking expanded list can still be collapsed');

  await page.evaluate(key => localStorage.setItem(key, '{broken json'), readKey);
  await page.goto(`${base}news-preview.html`, { waitUntil: 'networkidle' });
  await expect(card('first')).toHaveAttribute('data-read', 'false');
  await card('first').locator('.literary-news__read-toggle').click();
  await expect(card('first')).toHaveAttribute('data-read', 'true');
  await page.setViewportSize({ width: 360, height: 800 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  results.push('Wide cards offer explicit read controls; malformed storage recovers; 360px fits');

  const blocked = await context.newPage();
  blocked.on('pageerror', error => errors.push(error.message));
  await blocked.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new DOMException('Denied', 'SecurityError'); };
    Storage.prototype.setItem = () => { throw new DOMException('Denied', 'SecurityError'); };
  });
  await blocked.route('**/__literary-news/feed*', route => route.fulfill({ json: feed([first]) }));
  await blocked.goto(`${base}news-preview.html`, { waitUntil: 'networkidle' });
  await blocked.locator('.literary-news__read-toggle').click();
  await expect(blocked.locator('article')).toHaveAttribute('data-read', 'true');
  await blocked.locator('.literary-news__unread-filter').click();
  await expect(blocked.locator('#literary-news article')).toHaveCount(0);
  results.push('Denied browser storage keeps read controls working within the session');
  await blocked.close();

  const dateTexts = [];
  for (const [zone, todayId, expectedHour] of [['America/Los_Angeles', 'first', '18:30'], ['Asia/Tokyo', 'second', '10:30']]) {
    const localContext = await browser.newContext({ timezoneId: zone, viewport: { width: 390, height: 844 } });
    const localPage = await localContext.newPage();
    localPage.on('pageerror', error => errors.push(error.message));
    await localPage.addInitScript(() => { Date.now = () => Date.parse('2026-09-06T01:30:00Z'); });
    let requestedZone;
    await localPage.route('**/__literary-news/feed*', route => {
      requestedZone = new URL(route.request().url()).searchParams.get('timeZone');
      return route.fulfill({ json: { ...feed([first, second, third]), timeZone: zone, lastCheckedAt: '2026-09-06T01:30:00Z' } });
    });
    await localPage.goto(`${base}news-preview.html`, { waitUntil: 'networkidle' });
    const localPanel = localPage.locator('#literary-news');
    assert.equal(requestedZone, zone, 'Browser sends its zone to the editorial feed');
    await expect(localPanel).toHaveAttribute('data-time-zone', zone);
    dateTexts.push(await localPanel.locator('article[data-news-id="first"] .literary-news__event-date').evaluate(node => node.firstChild.textContent));
    await expect(localPanel.locator('.literary-news__freshness')).toContainText(expectedHour);
    await localPanel.getByRole('button', { name: 'Сегодня', exact: true }).click();
    await expect(localPanel.locator('article')).toHaveCount(1);
    await expect(localPanel.locator('article')).toHaveAttribute('data-news-id', todayId);
    await localContext.close();
  }
  assert.equal(dateTexts[0], dateTexts[1], 'Date-only events keep their stated day worldwide');
  results.push('Los Angeles and Tokyo use different local Today filters and clock times at the same instant; event dates remain unchanged');
  assert.deepEqual(errors, []);
  await writeFile(`${output}/smart-checks.json`, JSON.stringify({ passed: results, pageErrors: errors }, null, 2));
  console.log(JSON.stringify({ passed: results, evidence: output }, null, 2));
} finally {
  await browser.close();
}
