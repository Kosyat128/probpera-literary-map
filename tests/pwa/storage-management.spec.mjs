import { test, expect, chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { build } from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { contentPackageFixture } from '../support/content-package-fixtures.mjs';

// Real Chrome HTTP, CacheStorage, Web Locks and origin capacity estimate.
// Synthetic signed package data; no installed-native or production claim.
for (const outcome of ['cancelled', 'committed']) test(`storage cleanup after a ${outcome} transfer preserves offline versions across tabs and restart`, async ({}, testInfo) => {
  const fixtures = [1, 2, 3].map(version => contentPackageFixture(version));
  const f = fixtures[2], requests = [], errors = [], held = new Set(); let stall = true;
  const bundle = await build({ stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import {InterfaceLanguageProvider,useInterfaceLanguage} from './src/i18n/InterfaceLanguage';
    import PlanetDownloadsPanel from './src/host/PlanetDownloadsPanel';
    import {createWebContentDownloads} from './src/platform/adapters/web/WebContentDownloads';
    import {createContentPackageCache} from './src/planet/contentPackageCache';
    const config=window.__configuration;
    const cache=createContentPackageCache({allowLocalQa:true,origin:location.origin,trustedKeys:config.trustedKeys,caches,locks:navigator.locks,subtle:crypto.subtle});
    const host={caches,location,crypto,fetch:fetch.bind(window),navigator:{locks:navigator.locks,storage:{estimate:()=>window.__denySpace?Promise.reject(Error('fixture denial')):navigator.storage.estimate()}}};
    const downloads=createWebContentDownloads(host,config); window.__downloads=downloads;
    window.__seed=async()=>{let prior=null;for(const fixture of window.__fixtures.slice(0,2)){
      const result=await cache.save({...fixture,expectedCurrentManifestSha256:prior});if(!result.ok)throw Error(result.reason);prior=fixture.manifestSha256;
    }const bootstrap=await caches.open('mandatory-bootstrap-fixture');await bootstrap.put(location.origin+'/bootstrap',new Response('mandatory'));};
    window.__read=async index=>(await cache.read(window.__fixtures[index])).ok;
    function Harness(){const {setLanguage}=useInterfaceLanguage();return <main>
      <nav aria-label="Test harness"><button onClick={()=>setLanguage('ru')}>RU</button><button onClick={()=>setLanguage('en')}>EN</button></nav>
      <PlanetDownloadsPanel downloads={downloads}/></main>}
    createRoot(document.getElementById('root')).render(<InterfaceLanguageProvider><Harness/></InterfaceLanguageProvider>);
  ` }, bundle: true, write: false, platform: 'browser', format: 'iife', target: 'es2022', jsx: 'automatic', outdir: '.tmp/storage-memory',
    define: { 'process.env.NODE_ENV': '"development"' } });
  const js = bundle.outputFiles.find(file => file.path.endsWith('.js')).text, css = bundle.outputFiles.find(file => file.path.endsWith('.css')).text;
  const server = http.createServer((request, response) => {
    if (request.url === '/harness') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end('<!doctype html><html lang="ru"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Storage fixture</title></head><body style="margin:0;background:#efe5d4;font-family:system-ui"><div id="root"></div></body></html>'); return;
    }
    const file = f.files.find(file => request.url === '/package/' + file.path);
    if (!file) { response.writeHead(404); response.end(); return; }
    requests.push(file.path); const bytes = Buffer.from(file.bytes);
    response.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': bytes.length });
    if (stall && file.path === 'en/catalog.json') {
      response.write(bytes.subarray(0, 10)); const finish = () => response.end(bytes.subarray(10)); held.add(finish);
      response.on('close', () => held.delete(finish));
    } else response.end(bytes);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const profileRoot = path.resolve(process.env.S11_BROWSER_PROFILE_ROOT ?? '.tmp/s11-content-browser');
  await fs.mkdir(profileRoot, { recursive: true }); const profile = await fs.mkdtemp(path.join(profileRoot, 'space-'));
  const configuration = { descriptors: [{ id: 'test', title: { ru: 'Проверочный пакет', en: 'Test package' },
    envelope: f.envelope, expected: f.expected, manifestSha256: f.manifestSha256,
    previous: { expected: fixtures[1].expected, manifestSha256: fixtures[1].manifestSha256 }, baseUrl: origin + '/package/' }], trustedKeys: f.trustedKeys };
  let context;
  async function launch() { context = await chromium.launchPersistentContext(profile, { channel: 'chrome', headless: true, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' }); }
  async function open() {
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin + '/harness'); await page.addStyleTag({ content: css });
    await page.evaluate(({ configuration, fixtures }) => { window.__configuration = configuration; window.__fixtures = fixtures; }, { configuration, fixtures });
    await page.addScriptTag({ content: js }); await page.locator('[data-planet-downloads] summary').click(); return page;
  }
  const result = { sourceFixture: true, outcome, actualBrowserStorage: true, deviceTested: false, releaseReady: false, pass: false };
  try {
    await launch(); const first = await open(); await first.evaluate(() => window.__seed());
    const initialKeys = await first.evaluate(() => caches.keys());
    await first.getByRole('button', { name: 'Проверить место', exact: true }).click();
    await expect(first.locator('[data-storage-space]')).toHaveAttribute('data-storage-space', 'ready');
    await expect(first.getByRole('button', { name: 'Проверить место', exact: true })).toBeFocused();
    await expect(first.locator('[data-storage-space]')).toContainText('по оценке браузера');
    await first.locator('[data-storage-space]').screenshot({ path: testInfo.outputPath('space-ru.png') });
    await first.getByRole('button', { name: 'Загрузить', exact: true }).click();
    await expect.poll(() => requests.filter(value => value === 'en/catalog.json').length).toBe(1);
    expect(await first.evaluate(() => Promise.all([window.__read(0), window.__read(1)]))).toEqual([true, true]);
    const second = await open(); await second.getByRole('button', { name: 'EN', exact: true }).click();
    await second.evaluate(() => { window.__denySpace = true; });
    await second.getByRole('button', { name: 'Check space', exact: true }).click();
    await expect(second.locator('[data-storage-space]')).toHaveAttribute('data-storage-space', 'unavailable');
    await second.evaluate(() => { window.__denySpace = false; });
    await second.getByRole('button', { name: 'Check space', exact: true }).click();
    await expect(second.locator('[data-storage-space]')).toHaveAttribute('data-storage-space', 'ready');
    const remove = second.getByRole('button', { name: 'Remove unfinished download', exact: true });
    const row = second.locator('[data-download-id="test"]');
    if (outcome === 'cancelled') {
      // The canonical language provider synchronizes localStorage across tabs.
      await expect(first.locator('html')).toHaveAttribute('lang', 'en');
      await first.getByRole('button', { name: 'Pause', exact: true }).click();
      await expect(first.locator('[data-download-id="test"]')).toHaveAttribute('data-download-phase', 'paused');
      const before = [...requests]; await context.setOffline(true);
      await remove.click(); await expect(row).toHaveAttribute('data-download-phase', 'cleared'); await expect(remove).toBeFocused();
      expect(await second.evaluate(() => caches.keys())).toEqual(initialKeys);
      expect(await second.evaluate(() => Promise.all([window.__read(0), window.__read(1)]))).toEqual([true, true]);
      expect(requests).toEqual(before); await context.setOffline(false); stall = false;
      await second.locator('[data-planet-downloads]').screenshot({ path: testInfo.outputPath('cleared-en.png') });
      await first.getByRole('button', { name: 'Resume download', exact: true }).click();
      await expect(first.locator('[data-download-id="test"]')).toHaveAttribute('data-download-phase', 'saved');
      expect(requests.filter(value => value === 'dependency-index.json')).toHaveLength(2);
    } else {
      await remove.click(); await expect(row).toHaveAttribute('data-download-phase', 'clearing');
      await expect(remove).toHaveAttribute('aria-disabled', 'true');
      stall = false; for (const finish of held) finish();
      await expect(first.locator('[data-download-id="test"]')).toHaveAttribute('data-download-phase', 'saved');
      await expect(row).toHaveAttribute('data-download-phase', 'protected'); await expect(remove).toBeFocused();
      await second.locator('[data-planet-downloads]').screenshot({ path: testInfo.outputPath('protected-en.png') });
    }
    expect(await second.evaluate(() => Promise.all([window.__read(1), window.__read(2)]))).toEqual([true, true]);
    expect(await second.evaluate(async () => (await (await caches.open('mandatory-bootstrap-fixture')).match(location.origin + '/bootstrap')).text())).toBe('mandatory');
    expect((await new AxeBuilder({ page: second }).include('[data-planet-downloads]').analyze()).violations).toEqual([]);
    expect(await second.locator('[data-planet-downloads]').evaluate(element => element.scrollWidth > element.clientWidth)).toBe(false);
    const beforeRestart = [...requests]; await context.close(); context = undefined;
    await launch(); const reopened = await open(); await context.setOffline(true);
    await reopened.getByRole('button', { name: 'EN', exact: true }).click();
    await reopened.getByRole('button', { name: 'Check files', exact: true }).click();
    await expect(reopened.locator('[data-download-id="test"]')).toHaveAttribute('data-download-phase', 'saved');
    await expect(reopened.getByRole('button', { name: 'Remove unfinished download', exact: true })).toHaveAttribute('aria-disabled', 'true');
    expect(await reopened.evaluate(() => Promise.all([window.__read(1), window.__read(2)]))).toEqual([true, true]);
    expect(requests).toEqual(beforeRestart); expect(errors).toEqual([]);
    Object.assign(result, { requests, currentAndPreviousReadable: true, bootstrapPreserved: true, offlineAfterBrowserRestart: true,
      actualOriginEstimate: true, capacityDenialRecovery: true, locales: ['ru', 'en'], accessibilityViolations: 0, pass: true });
  } finally {
    if (context) await context.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    await testInfo.attach('storage-management-result', { contentType: 'application/json', body: JSON.stringify(result, null, 2) });
  }
});
