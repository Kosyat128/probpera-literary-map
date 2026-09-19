import { test, expect, chromium } from '@playwright/test';
import { build } from 'esbuild';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { preservedFixture } from './support/preserved-content-package.mjs';

// Actual panel, Web adapter, signature verification, CacheStorage and Web Locks.
// The independently pinned S08 QA export is a source fixture, never production content.
test('optional content inspection works offline and retains only the observed package across RUEN and panel remounts', async ({}, testInfo) => {
  test.setTimeout(120_000);
  const preserved = await preservedFixture(2), fixture = preserved.fixture;
  const requests = [], errors = [];
  const bundle = await build({ stdin: { resolveDir: fileURLToPath(new URL('../../', import.meta.url)), loader: 'tsx', contents: `
    import React,{useEffect,useState} from 'react';import{createRoot}from'react-dom/client';
    import{InterfaceLanguageProvider,useInterfaceLanguage}from'./src/i18n/InterfaceLanguage';
    import PlanetDownloadsPanel from './src/host/PlanetDownloadsPanel';
    import{createWebContentDownloads}from'./src/platform/adapters/web/WebContentDownloads';
    import{createWebPlatformAdapter}from'./src/platform/adapters/web/WebPlatformAdapter';
    const platform=createWebPlatformAdapter({window});
    const downloads=createWebContentDownloads(window,window.__inspectionConfiguration,platform,platform.preferences);
    window.__downloads=downloads;window.__inspectionTrace=[];
    downloads.subscribe(()=>{const item=downloads.getSnapshot().items.find(item=>item.id==='candidate');
      window.__inspectionTrace.push({download:item.phase,inspection:item.inspection.phase,hasView:!!downloads.getInspection('candidate')});});
    function Harness(){const {setLanguage}=useInterfaceLanguage();const [generation,remount]=useState(0);
      useEffect(()=>{window.__inspectionHarness={setLanguage,remount:()=>remount(value=>value+1)}},[setLanguage]);
      return <><nav aria-label="Test harness"><button onClick={()=>setLanguage('ru')}>RU</button>
        <button onClick={()=>setLanguage('en')}>EN</button></nav><PlanetDownloadsPanel key={generation} downloads={downloads}/></>}
    createRoot(document.getElementById('root')).render(<InterfaceLanguageProvider><Harness/></InterfaceLanguageProvider>);
  ` }, bundle: true, write: false, platform: 'browser', format: 'iife', target: 'es2022', jsx: 'automatic',
    outdir: '.tmp/content-inspection-memory', define: { 'process.env.NODE_ENV': '"development"' } });
  const script = bundle.outputFiles.find(file => file.path.endsWith('.js')).text;
  const css = bundle.outputFiles.find(file => file.path.endsWith('.css')).text;
  const server = http.createServer((request, response) => {
    if (request.url === '/harness') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end('<!doctype html><html lang="ru"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Content inspection fixture</title></head><body style="margin:0;background:#efe5d4;font-family:system-ui"><div id="root"></div></body></html>');
      return;
    }
    const file = fixture.files.find(file => request.url === '/package/' + file.path);
    if (!file) { response.writeHead(404); response.end(); return; }
    const bytes = Buffer.from(file.bytes);
    requests.push({ path: file.path, bytes: bytes.length, cookie: request.headers.cookie ?? null, referrer: request.headers.referer ?? null });
    response.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': bytes.length }); response.end(bytes);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const descriptor = { envelope: fixture.envelope, expected: fixture.expected, manifestSha256: fixture.manifestSha256,
    previous: null, retention: 'optional', baseUrl: origin + '/package/' };
  const configuration = { descriptors: [
    { ...descriptor, id: 'candidate', title: { ru: 'Сохранённый литературный пакет', en: 'Saved literary package' }, inspection: 'adult-candidate-v1' },
    { ...descriptor, id: 'generic', title: { ru: 'Обычный проверочный пакет', en: 'Generic test package' } },
  ], trustedKeys: [preserved.trustedKey] };
  const result = { sourceFixture: true, actualPanelAndWebAdapter: true, actualHttpAndBrowserStorage: true,
    preservedInput: preserved.evidence, installedNative: false, activationAllowed: false, releaseReady: false, pass: false };
  let context;
  try {
    const profileRoot = path.resolve(process.env.S11_BROWSER_PROFILE_ROOT ?? '.tmp/s11-content-browser');
    await fs.mkdir(profileRoot, { recursive: true });
    const profile = await fs.mkdtemp(path.join(profileRoot, 'ci-'));
    context = await chromium.launchPersistentContext(profile, { channel: 'chrome', headless: true,
      viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin + '/harness'); await page.addStyleTag({ content: css });
    await page.evaluate(configuration => {
      localStorage.setItem('probpera-interface-language', 'ru');
      localStorage.setItem('probpera-planet-download-network-v1', 'any-network');
      window.__inspectionConfiguration = configuration;
    }, configuration);
    await page.addScriptTag({ content: script });
    const panel = page.locator('[data-planet-downloads]'), row = panel.locator('[data-download-id="candidate"]');
    const inspection = row.locator('[data-content-inspection]');
    await panel.locator('summary').click();
    await expect.poll(() => page.evaluate(() => window.__downloads.getSnapshot().network.status)).toBe('ready');
    await expect(inspection).toHaveAttribute('data-content-inspection', 'unavailable');
    await expect(row.getByRole('button', { name: 'Проверить содержимое', exact: true })).toHaveAttribute('aria-disabled', 'true');
    await expect(panel.locator('[data-download-id="generic"] [data-content-inspection]')).toHaveCount(0);
    await row.getByRole('button', { name: 'Загрузить', exact: true }).click();
    await expect(row).toHaveAttribute('data-download-phase', 'saved', { timeout: 45_000 });
    await expect(inspection).toHaveAttribute('data-content-inspection', 'ready');
    expect(requests.map(request => request.path).sort()).toEqual(fixture.files.map(file => file.path).sort());
    expect(requests.every(request => request.cookie === null && request.referrer === null)).toBe(true);
    const downloadedRequests = [...requests];
    await context.setOffline(true);
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);

    // These actions reauthenticate saved bytes through the actual adapter with
    // network disabled; no injected inspector/cache response can make them pass.
    await row.getByRole('button', { name: 'Проверить файлы', exact: true }).click();
    await expect(row).toHaveAttribute('data-download-phase', 'saved');
    const button = row.getByRole('button', { name: 'Проверить содержимое', exact: true });
    const originalButton = await button.elementHandle();
    await button.focus(); await button.press('Enter');
    await expect(inspection).toHaveAttribute('data-content-inspection', 'inspected', { timeout: 30_000 });
    await expect(inspection.getByRole('status')).toHaveText('Проверка содержимого завершена.');
    await expect(button).toBeFocused();
    expect(await originalButton.evaluate(element => element === document.querySelector('[data-content-inspection] button'))).toBe(true);
    const proof = await page.evaluate(() => {
      const view = window.__downloads.getInspection('candidate'); window.__retainedInspection = view;
      return { version: view.version, manifestSha256: view.manifestSha256, selectionSha256: view.selectionSha256,
        selectionRole: view.selectionRole, unitCount: view.units.length, diagnosticCount: view.diagnostics.length,
        locales: [...new Set(view.units.map(unit => unit.locale))].sort(), frozen: Object.isFrozen(view) && Object.isFrozen(view.units),
        activationAllowed: view.activationAllowed, releaseReady: view.releaseReady,
        summary: window.__downloads.getSnapshot().items.find(item => item.id === 'candidate').inspection.summary };
    });
    expect(proof).toMatchObject({ version: 2, manifestSha256: fixture.manifestSha256, selectionRole: 'current',
      locales: ['en', 'ru'], frozen: true, activationAllowed: false, releaseReady: false });
    expect(proof.unitCount).toBeGreaterThan(0); expect(proof.summary.unitCount).toBe(proof.unitCount);
    expect(await row.innerText()).not.toMatch(/[a-f0-9]{64}/u);
    await row.screenshot({ path: testInfo.outputPath('content-inspected-ru.png') });

    await page.evaluate(() => window.__inspectionHarness.setLanguage('en'));
    await expect(panel.locator('summary')).toHaveText('Downloads');
    await expect(row.getByRole('button', { name: 'Check content', exact: true })).toBeFocused();
    await expect(inspection.getByRole('status')).toHaveText('Content check complete.');
    expect(await originalButton.evaluate(element => element === document.querySelector('[data-content-inspection] button'))).toBe(true);
    expect(await page.evaluate(() => window.__downloads.getInspection('candidate') === window.__retainedInspection)).toBe(true);
    await page.evaluate(() => window.__inspectionHarness.remount());
    await expect(panel).not.toHaveAttribute('open'); await panel.locator('summary').click();
    await expect(inspection).toHaveAttribute('data-content-inspection', 'inspected');
    await expect(inspection.getByRole('status')).toHaveText('Content check complete.');
    expect(await page.evaluate(() => window.__downloads.getInspection('candidate') === window.__retainedInspection)).toBe(true);
    await expect(row).toContainText('Test package: its content is not yet added to the literary archive.');
    await page.setViewportSize({ width: 320, height: 760 });
    expect(await panel.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await row.screenshot({ path: testInfo.outputPath('content-inspected-en-mobile.png') });

    await row.getByRole('button', { name: 'Check files', exact: true }).click();
    await expect(row).toHaveAttribute('data-download-phase', 'saved');
    await expect(inspection).toHaveAttribute('data-content-inspection', 'ready');
    expect(await page.evaluate(() => window.__downloads.getInspection('candidate'))).toBeNull();
    await row.getByRole('button', { name: 'Check content', exact: true }).click();
    await expect(inspection).toHaveAttribute('data-content-inspection', 'inspected', { timeout: 30_000 });
    expect(await page.evaluate(() => window.__downloads.getInspection('candidate') === window.__retainedInspection)).toBe(false);
    await row.getByRole('button', { name: 'Remove saved package', exact: true }).click();
    await row.getByRole('button', { name: 'Confirm removal', exact: true }).click();
    await expect(row).toHaveAttribute('data-download-phase', 'uninstalled');
    await expect(inspection).toHaveAttribute('data-content-inspection', 'unavailable');
    await expect(row.getByRole('button', { name: 'Check content', exact: true })).toHaveAttribute('aria-disabled', 'true');
    expect(await page.evaluate(() => window.__downloads.getInspection('candidate'))).toBeNull();
    await page.evaluate(() => window.__inspectionHarness.setLanguage('ru'));
    await expect(inspection.getByRole('status')).toHaveText('Содержимое пока недоступно для проверки.');
    await expect(panel.locator('[data-download-id="generic"] [data-content-inspection]')).toHaveCount(0);
    expect(requests).toEqual(downloadedRequests); expect(errors).toEqual([]);
    const transitions = await page.evaluate(() => window.__inspectionTrace);
    expect(transitions.some(step => step.inspection === 'inspecting' && step.hasView === false)).toBe(true);
    expect(transitions.some(step => step.download === 'checking' && step.hasView === false)).toBe(true);
    expect(transitions.some(step => step.download === 'uninstalling' && step.hasView === false)).toBe(true);
    Object.assign(result, { pass: true, proof, requests, offlineCheckAndInspection: true, locales: ['ru', 'en', 'ru'],
      stableButtonAndKeyboardFocus: true, remountRetainsExactView: true, recheckClearsPreviousView: true,
      removalClearsView: true, genericRowUnchanged: true, mobileNoHorizontalOverflow: true, transitions });
    await originalButton.dispose();
  } finally {
    if (context) await context.close();
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    await testInfo.attach('content-inspection-result', { contentType: 'application/json', body: JSON.stringify(result, null, 2) });
  }
});
