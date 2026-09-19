import { test, expect, chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { build } from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { contentPackageFixture } from '../support/content-package-fixtures.mjs';

// Real Chrome HTTP, CacheStorage and Web Locks. Packages contain only signed
// synthetic test records; this does not establish native or release readiness.
test('optional package confirmation rejects stale intent and survives offline restart with explicit reinstall', async ({}, testInfo) => {
  const fixtures = [1, 2].map(version => contentPackageFixture(version)), f = fixtures[1];
  const requests = [], errors = [];
  const bundle = await build({ stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import {InterfaceLanguageProvider,useInterfaceLanguage} from './src/i18n/InterfaceLanguage';
    import PlanetDownloadsPanel from './src/host/PlanetDownloadsPanel';
    import {createWebContentDownloads} from './src/platform/adapters/web/WebContentDownloads';
    import {createContentPackageCache} from './src/planet/contentPackageCache';
    const config=window.__configuration;
    const cache=createContentPackageCache({allowLocalQa:true,origin:location.origin,trustedKeys:config.trustedKeys,
      caches,locks:navigator.locks,subtle:crypto.subtle,
      optionalPackages:config.descriptors.filter(item=>item.retention==='optional').map(({expected,manifestSha256})=>({expected,manifestSha256}))});
    const downloads=createWebContentDownloads(window,config); window.__downloads=downloads;
    window.__seed=async()=>{let prior=null;for(const fixture of window.__fixtures){
      const result=await cache.save({...fixture,expectedCurrentManifestSha256:prior});
      if(!result.ok)throw Error(result.reason);prior=fixture.manifestSha256;
    }const bootstrap=await caches.open('mandatory-bootstrap-fixture');
      await bootstrap.put(location.origin+'/bootstrap',new Response('mandatory'));};
    window.__read=async()=>Promise.all(window.__fixtures.map(fixture=>cache.read(fixture)));
    window.__retireAndReinstall=async()=>{const fixture=window.__fixtures[1];
      const receipt=await cache.read(fixture);if(!receipt.ok)throw Error(receipt.reason);
      const retired=await cache.uninstall({...fixture,selectionSha256:receipt.selectionSha256});
      if(!retired.ok||!retired.cleanupComplete)throw Error('retirement-fixture-failed');
      const installed=await cache.save({...fixture,expectedCurrentManifestSha256:null});
      if(!installed.ok)throw Error(installed.reason);
      return {before:receipt.selectionSha256,after:installed.selectionSha256};};
    function Harness(){const {setLanguage}=useInterfaceLanguage();return <main>
      <nav aria-label="Test harness"><button onClick={()=>setLanguage('ru')}>RU</button><button onClick={()=>setLanguage('en')}>EN</button></nav>
      <PlanetDownloadsPanel downloads={downloads}/></main>}
    createRoot(document.getElementById('root')).render(<InterfaceLanguageProvider><Harness/></InterfaceLanguageProvider>);
  ` }, bundle: true, write: false, platform: 'browser', format: 'iife', target: 'es2022', jsx: 'automatic',
    outdir: '.tmp/optional-uninstall-memory', define: { 'process.env.NODE_ENV': '"development"' } });
  const js = bundle.outputFiles.find(file => file.path.endsWith('.js')).text;
  const css = bundle.outputFiles.find(file => file.path.endsWith('.css')).text;
  const server = http.createServer((request, response) => {
    if (request.url === '/harness') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end('<!doctype html><html lang="ru"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Optional download fixture</title></head><body style="margin:0;background:#efe5d4;font-family:system-ui"><div id="root"></div></body></html>');
      return;
    }
    const file = f.files.find(file => request.url === '/package/' + file.path);
    if (!file) { response.writeHead(404); response.end(); return; }
    requests.push({ path: file.path, cookie: request.headers.cookie ?? null, referrer: request.headers.referer ?? null });
    const bytes = Buffer.from(file.bytes);
    response.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': bytes.length }); response.end(bytes);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const profileRoot = path.resolve(process.env.S11_BROWSER_PROFILE_ROOT ?? '.tmp/s11-content-browser');
  await fs.mkdir(profileRoot, { recursive: true }); const profile = await fs.mkdtemp(path.join(profileRoot, 'optional-'));
  const configuration = { descriptors: [{ id: 'test', title: { ru: 'Проверочный пакет', en: 'Test package' }, retention: 'optional',
    envelope: f.envelope, expected: f.expected, manifestSha256: f.manifestSha256,
    previous: { expected: fixtures[0].expected, manifestSha256: fixtures[0].manifestSha256 }, baseUrl: origin + '/package/' }], trustedKeys: f.trustedKeys };
  let context;
  async function launch() {
    context = await chromium.launchPersistentContext(profile, { channel: 'chrome', headless: true,
      viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  }
  async function open() {
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin + '/harness'); await page.addStyleTag({ content: css });
    await page.evaluate(({ configuration, fixtures }) => { window.__configuration = configuration; window.__fixtures = fixtures; }, { configuration, fixtures });
    await page.addScriptTag({ content: js }); await page.locator('[data-planet-downloads] summary').click(); return page;
  }
  async function assertBootstrap(page) {
    expect(await page.evaluate(async () => (await (await caches.open('mandatory-bootstrap-fixture')).match(location.origin + '/bootstrap')).text())).toBe('mandatory');
  }
  async function assertRetired(page) {
    const states = await page.evaluate(() => window.__read());
    expect(states.every(state => !state.ok)).toBe(true);
    expect(states[1]).toMatchObject({ reason: 'content-package-removed', cleanupComplete: true });
    expect((await page.evaluate(() => caches.keys())).some(name => fixtures.some(fixture => name.endsWith('-' + fixture.manifestSha256)))).toBe(false);
    await assertBootstrap(page);
  }
  const result = { sourceFixture: true, actualHttpAndBrowserStorage: true, installedNative: false,
    releaseReady: false, pass: false };
  try {
    await launch(); const first = await open(); await first.evaluate(() => window.__seed());
    const row = first.locator('[data-download-id="test"]');
    await first.getByRole('button', { name: 'RU', exact: true }).click();
    await first.getByRole('button', { name: 'Проверить файлы', exact: true }).click();
    await expect(row).toHaveAttribute('data-download-phase', 'saved');
    expect((await first.evaluate(() => window.__read())).every(state => state.ok)).toBe(true);
    const removeRu = first.getByRole('button', { name: 'Удалить сохранённый пакет', exact: true });
    await removeRu.click();
    const confirmation = first.locator('.planet-downloads__confirmation');
    await expect(confirmation).toBeVisible();
    await first.locator('[data-planet-downloads]').screenshot({ path: testInfo.outputPath('optional-confirm-ru.png') });
    expect((await new AxeBuilder({ page: first }).include('[data-planet-downloads]').analyze()).violations).toEqual([]);
    await confirmation.getByRole('button', { name: 'Закрыть', exact: true }).click();
    await expect(confirmation).toHaveCount(0); await expect(removeRu).toBeFocused();
    await expect(row).toHaveAttribute('data-download-phase', 'saved');
    await assertBootstrap(first); expect(requests).toEqual([]);
    await removeRu.click(); await expect(confirmation).toBeVisible();
    const second = await open();
    const replacement = await second.evaluate(() => window.__retireAndReinstall());
    expect(replacement.after).not.toBe(replacement.before);
    await confirmation.getByRole('button', { name: 'Подтвердить удаление', exact: true }).click();
    await expect(row).toHaveAttribute('data-download-phase', 'uninstall-error');
    expect((await first.evaluate(() => window.__read()))[1].ok).toBe(true);
    expect(requests).toEqual([]); await assertBootstrap(first);
    await first.getByRole('button', { name: 'Проверить файлы', exact: true }).click();
    await expect(row).toHaveAttribute('data-download-phase', 'saved');
    await first.getByRole('button', { name: 'EN', exact: true }).click();
    await context.setOffline(true);
    await first.getByRole('button', { name: 'Remove saved package', exact: true }).click();
    await expect(confirmation).toBeVisible();
    const confirmEn = confirmation.getByRole('button', { name: 'Confirm removal', exact: true });
    await confirmEn.click();
    await expect(row).toHaveAttribute('data-download-phase', 'uninstalled');
    await expect(confirmation).toHaveCount(0);
    await expect(first.getByRole('button', { name: 'Remove saved package', exact: true })).toBeFocused();
    await assertRetired(first); expect(requests).toEqual([]);
    await first.locator('[data-planet-downloads]').screenshot({ path: testInfo.outputPath('optional-removed-en.png') });
    expect((await new AxeBuilder({ page: first }).include('[data-planet-downloads]').analyze()).violations).toEqual([]);
    expect(await first.locator('[data-planet-downloads]').evaluate(element => element.scrollWidth > element.clientWidth)).toBe(false);
    await context.close(); context = undefined;
    await launch(); const reopened = await open(); await context.setOffline(true);
    await reopened.getByRole('button', { name: 'EN', exact: true }).click();
    const reopenedRow = reopened.locator('[data-download-id="test"]');
    await reopened.getByRole('button', { name: 'Check files', exact: true }).click();
    await expect(reopenedRow).toHaveAttribute('data-download-phase', 'uninstalled');
    await assertRetired(reopened); expect(requests).toEqual([]);
    await context.setOffline(false);
    await reopened.getByRole('button', { name: 'Download', exact: true }).click();
    await expect(reopenedRow).toHaveAttribute('data-download-phase', 'saved');
    const restored = (await reopened.evaluate(() => window.__read()))[1];
    expect(restored).toMatchObject({ ok: true, manifestSha256: f.manifestSha256, activationAllowed: false, releaseReady: false });
    expect(requests.map(request => request.path).sort()).toEqual(f.files.map(file => file.path).sort());
    expect(requests.every(request => request.cookie === null && request.referrer === null)).toBe(true);
    await assertBootstrap(reopened); expect(errors).toEqual([]);
    Object.assign(result, { requests, cancelRestoresFocus: true, staleConfirmationRejectedAcrossTabs: true,
      currentAndRollbackBytesRemoved: true, bootstrapPreserved: true, offlineRemoval: true,
      offlineRemovedStateAfterBrowserRestart: true, explicitHttpReinstall: true,
      locales: ['ru', 'en'], accessibilityViolations: 0, pass: true });
  } finally {
    if (context) await context.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    await testInfo.attach('optional-uninstall-result', { contentType: 'application/json', body: JSON.stringify(result, null, 2) });
  }
});

test('a saved previous version remains removable after the optional catalogue advances', async ({}, testInfo) => {
  const fixtures = [1, 2, 3].map(version => contentPackageFixture(version)), offered = fixtures[2];
  const requests = [], errors = [];
  const bundle = await build({ stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
    import React from 'react';import{createRoot}from'react-dom/client';
    import{InterfaceLanguageProvider,useInterfaceLanguage}from'./src/i18n/InterfaceLanguage';
    import PlanetDownloadsPanel from './src/host/PlanetDownloadsPanel';
    import{createWebContentDownloads}from'./src/platform/adapters/web/WebContentDownloads';
    import{createContentPackageCache}from'./src/planet/contentPackageCache';
    const config=window.__configuration;
    const cache=createContentPackageCache({allowLocalQa:true,origin:location.origin,trustedKeys:config.trustedKeys,
      caches,locks:navigator.locks,subtle:crypto.subtle});
    const downloads=createWebContentDownloads(window,config);
    window.__seed=async()=>{let prior=null;for(const fixture of window.__fixtures.slice(0,2)){
      const result=await cache.save({...fixture,expectedCurrentManifestSha256:prior});
      if(!result.ok)throw Error(result.reason);prior=fixture.manifestSha256;
    }const bootstrap=await caches.open('mandatory-bootstrap-fixture');
      await bootstrap.put(location.origin+'/bootstrap',new Response('mandatory'));};
    window.__read=()=>Promise.all(window.__fixtures.map(fixture=>cache.read(fixture)));
    function Harness(){const{setLanguage}=useInterfaceLanguage();return <main>
      <nav aria-label="Test harness"><button onClick={()=>setLanguage('ru')}>RU</button><button onClick={()=>setLanguage('en')}>EN</button></nav>
      <PlanetDownloadsPanel downloads={downloads}/></main>}
    createRoot(document.getElementById('root')).render(<InterfaceLanguageProvider><Harness/></InterfaceLanguageProvider>);
  ` }, bundle: true, write: false, platform: 'browser', format: 'iife', target: 'es2022', jsx: 'automatic',
    outdir: '.tmp/optional-previous-memory', define: { 'process.env.NODE_ENV': '"development"' } });
  const js = bundle.outputFiles.find(file => file.path.endsWith('.js')).text;
  const css = bundle.outputFiles.find(file => file.path.endsWith('.css')).text;
  const server = http.createServer((request, response) => {
    if (request.url === '/harness') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end('<!doctype html><html lang="ru"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Previous optional download fixture</title></head><body style="margin:0;background:#efe5d4;font-family:system-ui"><div id="root"></div></body></html>'); return;
    }
    const file = offered.files.find(file => request.url === '/package/' + file.path);
    if (!file) { response.writeHead(404); response.end(); return; }
    requests.push(file.path); const bytes = Buffer.from(file.bytes);
    response.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': bytes.length }); response.end(bytes);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const profileRoot = path.resolve(process.env.S11_BROWSER_PROFILE_ROOT ?? '.tmp/s11-content-browser');
  // Keep Chrome's nested CacheStorage paths within Windows path limits.
  await fs.mkdir(profileRoot, { recursive: true }); const profile = await fs.mkdtemp(path.join(profileRoot, 'ov-'));
  const configuration = { descriptors: [{ id: 'test', title: { ru: 'Проверочный пакет', en: 'Test package' }, retention: 'optional',
    envelope: offered.envelope, expected: offered.expected, manifestSha256: offered.manifestSha256,
    previous: { expected: fixtures[1].expected, manifestSha256: fixtures[1].manifestSha256 }, baseUrl: origin + '/package/' }], trustedKeys: offered.trustedKeys };
  let context;
  async function launch() {
    context = await chromium.launchPersistentContext(profile, { channel: 'chrome', headless: true,
      viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  }
  async function open() {
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin + '/harness'); await page.addStyleTag({ content: css });
    await page.evaluate(({ configuration, fixtures }) => { window.__configuration = configuration; window.__fixtures = fixtures; }, { configuration, fixtures });
    await page.addScriptTag({ content: js }); await page.locator('[data-planet-downloads] summary').click(); return page;
  }
  async function assertBootstrap(page) {
    expect(await page.evaluate(async () => (await (await caches.open('mandatory-bootstrap-fixture')).match(location.origin + '/bootstrap')).text())).toBe('mandatory');
  }
  async function assertPreviousRetired(page) {
    const states = await page.evaluate(() => window.__read());
    expect(states.every(state => !state.ok)).toBe(true);
    expect(states[1]).toMatchObject({ reason: 'content-package-removed', cleanupComplete: true });
    expect((await page.evaluate(() => caches.keys())).some(name => fixtures.some(fixture => name.endsWith('-' + fixture.manifestSha256)))).toBe(false);
    await assertBootstrap(page);
  }
  const result = { sourceFixture: true, actualHttpAndBrowserStorage: true, installedNative: false,
    offeredVersion: 3, savedVersion: 2, releaseReady: false, pass: false };
  try {
    await launch(); const page = await open(); await page.evaluate(() => window.__seed());
    const row = page.locator('[data-download-id="test"]');
    await page.getByRole('button', { name: 'RU', exact: true }).click();
    await page.getByRole('button', { name: 'Проверить файлы', exact: true }).click();
    await expect(row).toHaveAttribute('data-download-phase', 'update-available');
    await expect(row).toContainText('Сохранённая версия 2. Доступно обновление.');
    await expect(row.getByRole('button', { name: 'Обновить пакет', exact: true })).toHaveAttribute('aria-disabled', 'false');
    expect((await page.evaluate(() => window.__read())).map(state => state.ok)).toEqual([true, true, false]);
    await row.getByRole('button', { name: 'Удалить сохранённый пакет', exact: true }).click();
    const confirmation = row.locator('.planet-downloads__confirmation');
    await expect(confirmation).toContainText('Версия: 2');
    await page.locator('[data-planet-downloads]').screenshot({ path: testInfo.outputPath('optional-previous-confirm-ru.png') });
    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await expect(row).toContainText('Saved version 2. An update is available.');
    await expect(confirmation).toContainText('Version: 2');
    await expect(row.getByRole('button', { name: 'Update package', exact: true })).toHaveAttribute('aria-disabled', 'false');
    await page.locator('[data-planet-downloads]').screenshot({ path: testInfo.outputPath('optional-previous-confirm-en.png') });
    expect((await new AxeBuilder({ page }).include('[data-planet-downloads]').analyze()).violations).toEqual([]);
    expect(await page.locator('[data-planet-downloads]').evaluate(element => element.scrollWidth > element.clientWidth)).toBe(false);
    await context.setOffline(true);
    await confirmation.getByRole('button', { name: 'Confirm removal', exact: true }).click();
    await expect(row).toHaveAttribute('data-download-phase', 'uninstalled');
    await expect(confirmation).toHaveCount(0);
    await expect(row.getByRole('button', { name: 'Remove saved package', exact: true })).toBeFocused();
    await assertPreviousRetired(page); expect(requests).toEqual([]);
    await context.close(); context = undefined;
    await launch(); const reopened = await open(); await context.setOffline(true);
    await reopened.getByRole('button', { name: 'EN', exact: true }).click();
    const reopenedRow = reopened.locator('[data-download-id="test"]');
    await reopened.getByRole('button', { name: 'Check files', exact: true }).click();
    await expect(reopenedRow).toHaveAttribute('data-download-phase', 'uninstalled');
    await assertPreviousRetired(reopened); expect(requests).toEqual([]);
    await context.setOffline(false);
    await reopened.getByRole('button', { name: 'Download', exact: true }).click();
    await expect(reopenedRow).toHaveAttribute('data-download-phase', 'saved');
    const loaded = await reopened.evaluate(() => window.__read());
    expect(loaded[2]).toMatchObject({ ok: true, manifestSha256: offered.manifestSha256, activationAllowed: false, releaseReady: false });
    expect(loaded.slice(0, 2).every(state => !state.ok)).toBe(true);
    expect([...requests].sort()).toEqual(offered.files.map(file => file.path).sort());
    await assertBootstrap(reopened); expect(errors).toEqual([]);
    Object.assign(result, { requests, savedVersionDisplayedInBothLocales: true, confirmationRetainsVersionAcrossLocale: true,
      offlinePreviousVersionRemoval: true, previousTombstoneRestoredAfterBrowserRestart: true,
      bootstrapPreserved: true, explicitCurrentVersionDownload: true, accessibilityViolations: 0, pass: true });
  } finally {
    if (context) await context.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    await testInfo.attach('optional-previous-uninstall-result', { contentType: 'application/json', body: JSON.stringify(result, null, 2) });
  }
});
