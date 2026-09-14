import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

test('built PWA keeps bilingual downloads on the same globe after cold offline navigation', async ({ page, context, request }, testInfo) => {
  const config = JSON.parse(await readFile(process.env.PWA_QA_CONTROL_PATH, 'utf8'));
  expect(config.localQaOnly).toBe(true); expect(config.origin).toBe(process.env.PWA_QA_ORIGIN);
  const reset = await request.post(config.origin + '/__pwa_qa__/control', {
    headers: { Authorization: 'Bearer ' + config.controlToken }, data: { action: 'reset' } });
  expect(reset.status()).toBe(200);
  await page.goto('/planet/ru/?country=russia#atlas');
  await expect(page.locator('[data-pwa-authorized]')).toBeVisible({ timeout: 45000 });
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? ''), { timeout: 60000 }).toBe(config.origin + '/planet/sw.js');
  await context.setOffline(true);
  const observations = [];
  try {
    for (const locale of ['ru', 'en']) {
      await page.goto('/planet/' + locale + '/?country=russia#atlas');
      await expect(page.locator('[data-pwa-authorized]')).toBeVisible({ timeout: 45000 });
      await expect(page.locator('#atlas .literary-globe')).toHaveAttribute('data-globe-webgl-context', 'ready', { timeout: 45000 });
      await expect(page.locator('.native-planet-launch')).toBeHidden();
      await expect(page.locator('canvas')).toHaveCount(1);
      await expect(page.locator('.magazine-hero, .site-header')).toHaveCount(0);
      await expect.poll(() => page.evaluate(() => typeof window.__literaryPlanetQaScenes)).toBe('function');
      const scene = await page.evaluateHandle(() => window.__literaryPlanetQaScenes().find(item => document.querySelector('#atlas').contains(item.canvas)));
      await page.locator('[data-atlas-action="open-collection"]').click();
      const panel = page.locator('.native-planet-panel'), downloads = panel.locator('[data-planet-downloads]');
      if (await downloads.getAttribute('open') === null) await downloads.locator('summary').click();
      await expect(downloads.locator('summary')).toHaveText(locale === 'ru' ? 'Загрузки' : 'Downloads');
      await expect(downloads).toContainText(locale === 'ru' ? 'Дополнительных пакетов для загрузки пока нет.' : 'There are no additional packages to download yet.');
      await downloads.scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath('pwa-downloads-' + locale + '.png') });
      const other = locale === 'ru' ? 'en' : 'ru';
      await panel.locator('.interface-language-control button').filter({ hasText: other.toUpperCase() }).click();
      await expect(downloads.locator('summary')).toHaveText(other === 'ru' ? 'Загрузки' : 'Downloads');
      await panel.getByRole('button', { name: other === 'ru' ? 'Вернуться к планете' : 'Return to the planet', exact: true }).click();
      expect(await scene.evaluate(previous => {
        const current = window.__literaryPlanetQaScenes().find(item => item.canvas === previous.canvas);
        return previous.canvas.isConnected && current?.renderer === previous.renderer && current?.camera === previous.camera && current?.scene === previous.scene;
      })).toBe(true);
      await expect(page.locator('canvas')).toHaveCount(1); await scene.dispose();
      observations.push({ coldLocale: locale, changedTo: other, offline: true, sameCanvasRendererCameraScene: true, productionPackagesEmpty: true });
    }
    await testInfo.attach('built-pwa-downloads-result', { body: JSON.stringify({ pass: true, localQaOnly: true,
      observations, installedDevice: false, releaseReady: false }), contentType: 'application/json' });
  } finally { await context.setOffline(false); }
});
