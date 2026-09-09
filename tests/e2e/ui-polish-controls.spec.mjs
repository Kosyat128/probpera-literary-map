import { expect, test } from '@playwright/test';
import { clickAtlasDiscoveryControl } from './helpers/atlas-discovery.mjs';

test.use({ serviceWorkers: 'block' });
const startURL = process.env.UI_POLISH_BASE_URL || '/';

async function readyGlobe(page) {
  await page.goto(startURL);
  const atlas = page.locator('#atlas');
  await atlas.scrollIntoViewIfNeeded();
  const globe = atlas.locator('.literary-globe[data-globe-webgl-context="ready"]');
  await expect(globe).toBeVisible({ timeout: 60000 });
  return { atlas, globe };
}

test('F13 WebGL creation failure preserves country search and article reading', async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.route('**/*', route => {
    const request = route.request();
    return !['GET', 'HEAD', 'OPTIONS'].includes(request.method())
      ? route.abort()
      : route.continue();
  });
  // Browser-only fault injection: no production writes or changes to rendering.
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(kind, ...args) {
      if (/^(webgl2?|experimental-webgl)$/.test(kind)) return null;
      return original.call(this, kind, ...args);
    };
  });
  await page.goto(startURL);
  const atlas = page.locator('#atlas');
  await atlas.scrollIntoViewIfNeeded();
  await expect(atlas.getByText('Используйте текстовый указатель стран ниже', { exact: true })).toBeVisible();
  await expect(page.locator('.fatal-error-screen')).toHaveCount(0);
  await expect(page.locator('.magazine-hero')).toBeVisible();
  await clickAtlasDiscoveryControl(atlas.locator('.atlas-embedded-discovery [data-atlas-action="toggle-search"]'));
  await page.locator('#country-search').fill('Россия');
  await page.getByRole('option', { name: 'Россия', exact: true }).click();
  expect(new URL(page.url()).searchParams.get('country')).toBe('russia');
  await page.locator('#featured-journal .article-card-link').first().click();
  await expect(page.locator('.article-reader-content')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});

for (const width of [1440, 390]) {
  test(`R05 panels, zoom, resize and immersive return at ${width}px`, async ({ page, isMobile }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const { atlas, globe } = await readyGlobe(page);
    const rail = globe.locator('#globe-edition-rail');
    const railLayout = await globe.locator('.globe-edition-controls').evaluate(element => {
      const bounds = selector => {
        const rect = element.querySelector(selector).getBoundingClientRect();
        return { left: rect.left, right: rect.right };
      };
      return { previous: bounds('.is-previous'), rail: bounds('.globe-style-switch'), next: bounds('.is-next') };
    });
    expect(railLayout.previous.right).toBeLessThanOrEqual(railLayout.rail.left);
    expect(railLayout.rail.right).toBeLessThanOrEqual(railLayout.next.left);
    const nextEdition = globe.getByRole('button', { name: 'Следующие издания глобуса', exact: true });
    const previousEdition = globe.getByRole('button', { name: 'Предыдущие издания глобуса', exact: true });
    const initialRailScroll = await rail.evaluate(element => element.scrollLeft);
    if (await nextEdition.isVisible() && await nextEdition.isEnabled()) {
      await nextEdition.click();
      await expect.poll(() => rail.evaluate(element => element.scrollLeft)).toBeGreaterThan(initialRailScroll);
    } else {
      await previousEdition.click();
      await expect.poll(() => rail.evaluate(element => element.scrollLeft)).toBeLessThan(initialRailScroll);
    }
    const filters = atlas.locator('.atlas-embedded-discovery [data-atlas-action="toggle-filters"]');
    const searchToggle = atlas.locator('.atlas-embedded-discovery [data-atlas-action="toggle-search"]');
    await expect(atlas.locator('.atlas-toolbar')).toBeHidden();
    await expect(page.locator('#country-search')).toBeHidden();
    await clickAtlasDiscoveryControl(filters);
    await expect(filters).toHaveAttribute('aria-expanded', 'true');
    await expect(atlas.getByRole('button', { name: /^Все страны \d+$/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(filters).toBeFocused();
    await expect(filters).toHaveAttribute('aria-expanded', 'false');
    await clickAtlasDiscoveryControl(searchToggle);
    await expect(page.locator('#country-search')).toBeFocused();
    await expect(page.locator('#country-search')).toBeInViewport({ ratio: 1 });
    const stickyBottom = await page.locator('.site-header, .mobile-nav').evaluateAll(elements => Math.max(...elements.map(element => element.getBoundingClientRect().bottom)));
    expect((await page.locator('#country-search').boundingBox()).y).toBeGreaterThanOrEqual(stickyBottom + 8);
    await page.locator('#country-search').fill('Россия');
    await expect(page.getByRole('option', { name: 'Россия', exact: true })).toBeVisible();
    await expect(page.locator('#country-search')).toBeInViewport({ ratio: 1 });
    expect((await page.locator('#country-search').boundingBox()).y).toBeGreaterThanOrEqual(stickyBottom + 8);
    const resultsBounds = await atlas.locator('#country-results').boundingBox();
    const stageBounds = await atlas.locator('.globe-column').boundingBox();
    const topControlsBounds = await atlas.locator('.atlas-embedded-discovery').boundingBox();
    expect(resultsBounds.y + resultsBounds.height).toBeLessThanOrEqual(stageBounds.y - 16);
    expect(resultsBounds.y + resultsBounds.height).toBeLessThanOrEqual(topControlsBounds.y - 16);
    expect(resultsBounds.height).toBeLessThanOrEqual(320);
    const windowScroll = await page.evaluate(() => window.scrollY);
    await page.keyboard.press('End');
    await expect.poll(() => atlas.locator('#country-results').evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    const activeResultFits = await page.locator('#country-search').evaluate(input => {
      const option = document.getElementById(input.getAttribute('aria-activedescendant')).getBoundingClientRect();
      const list = document.getElementById('country-results').getBoundingClientRect();
      return option.top >= list.top && option.bottom <= list.bottom;
    });
    expect(activeResultFits).toBe(true);
    expect(await page.evaluate(() => window.scrollY)).toBe(windowScroll);
    await expect(page.locator('#country-search')).toBeFocused();
    await page.keyboard.press('Home');
    const firstActive = await page.locator('#country-search').getAttribute('aria-activedescendant');
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('#country-search')).not.toHaveAttribute('aria-activedescendant', firstActive);
    expect(await page.evaluate(() => window.scrollY)).toBe(windowScroll);
    await page.keyboard.press('Home');
    await clickAtlasDiscoveryControl(filters);
    await expect(filters).toHaveAttribute('aria-expanded', 'true');
    await expect(atlas.locator('#atlas-filter-panel')).toBeVisible();
    await expect(atlas.locator('#atlas-filter-panel [data-atlas-filter][aria-pressed="true"]')).toBeFocused();
    await expect(page.locator('#country-search')).toBeHidden();
    await clickAtlasDiscoveryControl(searchToggle);
    await expect(page.locator('#country-search')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(searchToggle).toBeFocused();
    await clickAtlasDiscoveryControl(searchToggle);
    await expect(page.locator('#country-search')).toHaveValue('Россия');
    await page.getByRole('option', { name: 'Россия', exact: true }).click();
    const selectedCountry = new URL(page.url()).searchParams.get('country');
    expect(selectedCountry).toBeTruthy();
    await expect(page.locator('#country-search')).toBeHidden();
    const canvas = globe.locator('canvas');
    await canvas.evaluate(element => { element.dataset.polishIdentity = 'preserved'; });
    await page.setViewportSize({ width: width === 1440 ? 768 : 320, height: 900 });
    await expect(canvas).toHaveAttribute('data-polish-identity', 'preserved');
    expect(new URL(page.url()).searchParams.get('country')).toBe(selectedCountry);
    if (isMobile && width === 390) {
      const touchActivation = globe.locator('[data-globe-control="touch-activation"]');
      await expect(touchActivation).toBeVisible();
      await expect(touchActivation).toHaveAttribute('aria-pressed', 'false');
      const touchGeometry = await touchActivation.evaluate(element => {
        const touch = element.getBoundingClientRect();
        const stage = element.closest('.literary-globe').getBoundingClientRect();
        const otherControls = [...element.closest('.globe-column').querySelectorAll('.globe-controls, .globe-edition-controls, .atlas-embedded-discovery, .atlas-immersion-launch')];
        return {
          inside: touch.left >= stage.left && touch.right <= stage.right && touch.top >= stage.top && touch.bottom <= stage.bottom,
          height: touch.height,
          overlaps: otherControls.filter(control => {
            const bounds = control.getBoundingClientRect();
            return Math.min(touch.right, bounds.right) > Math.max(touch.left, bounds.left) && Math.min(touch.bottom, bounds.bottom) > Math.max(touch.top, bounds.top);
          }).map(control => control.className),
        };
      });
      expect(touchGeometry.inside).toBe(true);
      expect(touchGeometry.height).toBeGreaterThanOrEqual(44);
      expect(touchGeometry.overlaps).toEqual([]);
    }
    const scale = globe.locator('#globe-scale-feedback');
    await expect(globe).toHaveAttribute('data-globe-camera-phase', 'idle');
    const initialScale = await scale.textContent();
    const zoomIn = globe.locator('[data-globe-control="zoom-in"]');
    await zoomIn.click();
    await expect(scale).not.toHaveText(initialScale);
    const order = await globe.locator('.globe-controls').evaluate(element => {
      const minus = element.querySelector('[data-globe-control="zoom-out"]').getBoundingClientRect();
      const value = element.querySelector('output').getBoundingClientRect();
      const plus = element.querySelector('[data-globe-control="zoom-in"]').getBoundingClientRect();
      return { minusRight: minus.right, valueLeft: value.left, valueRight: value.right, plusLeft: plus.left };
    });
    expect(order.minusRight).toBeLessThanOrEqual(order.valueLeft + .5);
    expect(order.valueRight).toBeLessThanOrEqual(order.plusLeft + .5);
    await page.setViewportSize({ width, height: 1000 });
    const enter = atlas.locator('[data-atlas-action="enter-immersive"]');
    await enter.click();
    const surface = page.locator('[data-atlas-experience]');
    await expect(surface).toHaveAttribute('data-atlas-view', 'immersive');
    await expect(surface).toHaveAttribute('data-atlas-transition', 'idle');
    await page.keyboard.press('Escape');
    await expect(surface).toHaveAttribute('data-atlas-view', 'embedded');
    await expect(enter).toBeFocused();
    expect(new URL(page.url()).searchParams.get('country')).toBe(selectedCountry);
    await expect(canvas).toHaveAttribute('data-polish-identity', 'preserved');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test(`R04 archive, shelf search, random selection and centered navigation at ${width}px`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(startURL);
    const books = page.locator('#books');
    await books.scrollIntoViewIfNeeded();
    const controls = books.locator('.book-shelf-controls');
    await expect(controls).toBeVisible({ timeout: 60000 });
    const archive = controls.getByRole('button', { name: 'Весь архив', exact: true });
    await archive.click();
    await expect(books.locator('.archive-book-card').first()).toBeVisible();
    const search = controls.getByRole('combobox', { name: 'Поиск по книге, автору или стране', exact: true });
    const suggestions = controls.locator('.book-shelf-controls__suggestions');
    const expectSuggestionsAboveActions = async () => {
      await expect(suggestions).toBeVisible();
      await expect(search).toHaveAttribute('aria-expanded', 'true');
      await expect.poll(() => controls.evaluate(element => {
        const list = element.querySelector('.book-shelf-controls__suggestions').getBoundingClientRect();
        const actions = element.querySelector('.book-shelf-controls__view-actions').getBoundingClientRect();
        return actions.top - list.bottom;
      })).toBeGreaterThanOrEqual(0);
    };
    await search.fill('1984');
    await expect(books.locator('.archive-book-card').filter({ hasText: '1984' }).first()).toBeVisible();
    await expectSuggestionsAboveActions();
    // One real pointer click must clear the search while its results are open.
    await archive.click({ timeout: 10000 });
    await expect(search).toHaveValue('');
    await expect(suggestions).toBeHidden();
    for (const selector of ['.book-shelf-controls__advanced', '.book-shelf-quality-menu > button']) {
      await search.fill('1984');
      await expectSuggestionsAboveActions();
      const action = controls.locator(selector);
      // A blur must not remove the results row between pointerdown and click.
      await action.click({ timeout: 10000 });
      await expect(action).toHaveAttribute('aria-expanded', 'true');
      await expect(suggestions).toBeHidden();
      await page.keyboard.press('Escape');
      await expect(action).toHaveAttribute('aria-expanded', 'false');
      await expect(action).toBeFocused();
    }
    await archive.click();
    await expect(search).toHaveValue('');
    await controls.getByRole('button', { name: 'ПОЛКА', exact: false }).click();
    await expect(books.locator('.book-shelf-scene canvas')).toBeVisible({ timeout: 60000 });
    await expect(books.locator('.book-shelf-brand-loader')).toBeHidden({ timeout: 60000 });
    const geometry = await books.locator('.book-shelf-navigation__position').evaluate(element => {
      const box = element.getBoundingClientRect();
      const parent = element.parentElement.getBoundingClientRect();
      return Math.abs((box.left + box.right) / 2 - (parent.left + parent.right) / 2);
    });
    expect(geometry).toBeLessThan(2);
    const random = controls.getByRole('button', { name: 'Выбрать случайное произведение из всего архива', exact: true });
    await expect(random).toBeEnabled();
    await random.click();
    await expect(books.locator('.book-detail-card')).toBeVisible({ timeout: 30000 });
    await page.setViewportSize({ width: width === 1440 ? 768 : 320, height: 900 });
    await expect(books.locator('.book-detail-card')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
