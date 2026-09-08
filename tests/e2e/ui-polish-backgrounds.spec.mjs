import { test, expect } from '@playwright/test';
test.use({ serviceWorkers: 'block' });

const home = '/probpera-literary-map/';
const sections = ['atlas', 'book-day', 'books', 'featured-journal', 'reader-discussion', 'journal', 'authors', 'sections', 'calendar', 'editorial-policy'];

async function reveal(page, id) {
  const section = page.locator(`#${id}`).first();
  // Late Suspense consumers can replace their placeholder once. Re-resolve
  // the actual section during reveal, then keep all geometry assertions.
  await expect(async () => {
    await section.scrollIntoViewIfNeeded();
    await expect(section).toBeVisible();
  }).toPass({ timeout: 30_000, intervals: [250, 500] });
  await expect(section.locator('.brush-backdrop').first()).toBeAttached({ timeout: 45_000 });
  await expect.poll(() => section.locator('.brush-backdrop img').evaluateAll(images => images.length === 2 && images.every(img => img.complete && img.naturalWidth > 0)), { timeout: 30_000 }).toBe(true);
  return section;
}

for (const width of [1440, 390, 320, 768, 1920]) test(`V4 artwork remains outside controls and follows real section bounds at ${width}`, async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Widths are explicit in this composition test.');
  test.setTimeout(180_000);
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(home);
  const early = await page.evaluate(() => performance.getEntriesByType('resource').filter(r => r.name.includes('/ui-polish-v4/')).map(r => r.name));
  expect(early.every(url => /(?:orange|white)-stroke\.webp/.test(url))).toBe(true);
  await expect(page.locator('#editorial-policy .brush-backdrop img')).toHaveCount(0);
  const measurements = [];
  for (const id of sections) {
    const section = await reveal(page, id);
    const result = await section.evaluate(el => {
      const bounds = el.getBoundingClientRect();
      const backdrop = el.querySelector('.brush-backdrop');
      const bottom = backdrop.getBoundingClientRect();
      return {
        id: el.id, height: bounds.height,
        bottomDelta: bottom.bottom - bounds.bottom,
        artificialJoins: backdrop.querySelectorAll('.brush-backdrop__join, .brush-backdrop__outgoing').length,
        pointer: getComputedStyle(backdrop).pointerEvents,
        hidden: backdrop.getAttribute('aria-hidden'),
        images: [...backdrop.querySelectorAll('img')].map(img => {
          const rect = img.getBoundingClientRect();
          return { url: img.currentSrc, naturalWidth: img.naturalWidth, width: parseFloat(getComputedStyle(img).width), visibleWidth: Math.max(0, Math.min(rect.right, bounds.right) - Math.max(rect.left, bounds.left)), visibleHeight: Math.max(0, Math.min(rect.bottom, bounds.bottom) - Math.max(rect.top, bounds.top)), color: img.classList.contains('brush-backdrop__accent--orange') ? 'orange' : img.classList.contains('brush-backdrop__accent--white') ? 'white' : 'violet' };
        }),
        gradients: getComputedStyle(el).backgroundImage,
        overlayOverflow: getComputedStyle(el).overflowX,
      };
    });
    expect(Math.abs(result.bottomDelta)).toBeLessThanOrEqual(1);
    expect(result.artificialJoins).toBe(0);
    expect(result.pointer).toBe('none');
    expect(result.hidden).toBe('true');
    expect(result.images).toHaveLength(2);
    expect(result.images.map(img => img.color).sort()).toEqual(['orange', ['books', 'reader-discussion', 'authors', 'calendar'].includes(id) ? 'violet' : 'white'].sort());
    expect(result.images.every(img => /(?:orange|white)-stroke\.webp/.test(img.url))).toBe(true);
    expect(result.images.every(img => img.width <= img.naturalWidth)).toBe(true);
    expect(result.images.every(img => img.visibleWidth > 1 && img.visibleHeight > 1)).toBe(true);
    const orange = result.images.find(img => img.color === 'orange');
    const secondary = result.images.find(img => img.color !== 'orange');
    expect(orange.width).toBeCloseTo(width <= 680 ? 510 : Math.min(1140, Math.max(840, width * .81)), 0);
    expect(secondary.width).toBeCloseTo(width <= 680 ? 330 : 600, 0);
    expect(result.gradients).toBe('none');
    measurements.push(result);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  const discussion = page.locator('#reader-discussion');
  await discussion.scrollIntoViewIfNeeded();
  expect(await discussion.locator('#about').count()).toBe(1);
  expect(await page.locator('#book-day .literary-news-panel, #book-day [id="literary-news"]').count()).toBeGreaterThan(0);
  const panel = discussion.locator('.engagement-card');
  expect(await panel.innerText()).not.toBe('');

  const journal = await reveal(page, 'journal');
  const before = await journal.boundingBox();
  await journal.locator('input').fill('no-matches-ui-polish-fixture');
  await expect(journal.locator('.article-library-empty')).toBeVisible();
  const empty = await journal.boundingBox();
  expect(empty.height).toBeLessThan(before.height);
  expect(await journal.evaluate(el => Math.abs(el.querySelector('.brush-backdrop').getBoundingClientRect().bottom - el.getBoundingClientRect().bottom))).toBeLessThanOrEqual(1);
  await journal.locator('input').fill('');
  await expect(journal.locator('.article-library-grid')).toBeVisible();
  const policy = await reveal(page, 'editorial-policy');
  const wasOpen = await policy.locator('details').first().evaluate(el => el.open);
  await policy.locator('summary').first().click();
  expect(await policy.locator('details').first().evaluate(el => el.open)).toBe(!wasOpen);
  expect(await policy.evaluate(el => Math.abs(el.querySelector('.brush-backdrop').getBoundingClientRect().bottom - el.getBoundingClientRect().bottom))).toBeLessThanOrEqual(1);
  await testInfo.attach(`brush-bounds-${width}`, { body: JSON.stringify({ width, early, measurements, heightChange: [before.height, empty.height] }, null, 2), contentType: 'application/json' });
});

test('V4 decoration failure and changed neighbours preserve content and navigation', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium');
  test.setTimeout(90_000);
  await page.route('**/brand/ui-polish-v4/**', route => route.abort('failed'));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${home}#featured-journal`);
  await expect(page.locator('#featured-journal h2')).toBeVisible();
  await expect(page.locator('#featured-journal .article-card-link').first()).toBeVisible();
  await page.locator('#reader-discussion').evaluate(el => { el.hidden = true; });
  await page.locator('#journal').scrollIntoViewIfNeeded();
  await expect(page.locator('#journal input')).toBeVisible();
  await page.locator('#journal input').fill('no-matches-ui-polish-fixture');
  await expect(page.locator('.article-library-empty')).toBeVisible();
  await page.locator('#reader-discussion').evaluate(el => { el.hidden = false; });
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.locator('.site-header .interface-language-control button').last().click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.locator('#featured-journal .article-card-link').first().click();
  // The actual featured article has no approved EN translation. Its honest
  // empty state and the existing RU control must remain usable without art.
  await expect(page.locator('h1')).toHaveText('English translation is not available yet');
  await page.locator('.article-reader .interface-language-control button').first().click();
  await expect(page.locator('.article-reader-content')).toBeVisible({ timeout: 30_000 });
});
