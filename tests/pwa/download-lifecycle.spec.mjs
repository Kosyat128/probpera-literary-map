import { test, expect, chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { build } from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { contentPackageFixture } from '../support/content-package-fixtures.mjs';

// Actual HTTP/React/CacheStorage; lifecycle events are controlled host fixtures.
// Neither case claims installed Android/iOS storage or OS background execution.
for (const host of ['web', 'native-events']) test(`downloads pause and recover through ${host}, cancellation, corrupt bytes and restart`, async ({}, testInfo) => {
  const f = contentPackageFixture(), requests = [], errors = []; let stallEnglish = true;
  const bundle = await build({ stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
    import React,{useState} from 'react'; import {createRoot} from 'react-dom/client';
    import {InterfaceLanguageProvider,useInterfaceLanguage} from './src/i18n/InterfaceLanguage';
    import PlanetDownloadsPanel from './src/host/PlanetDownloadsPanel';
    import {createWebContentDownloads} from './src/platform/adapters/web/WebContentDownloads';
    import {createWebPlatformAdapter} from './src/platform/adapters/web/WebPlatformAdapter';
    import {createHostPlatformServices} from './src/host/HostPlatformServices';
    let active=true,connected=true;const appListeners=new Set(),networkListeners=new Set();
    const lifecycle=window.__host==='web'?createWebPlatformAdapter({window}):createHostPlatformServices({
      kind:'android',channel:'dev',languages:['ru'],
      app:{getState:async()=>({isActive:active}),addListener:async(_,listener)=>{appListeners.add(listener);return {remove:()=>appListeners.delete(listener)}}},
      network:{getStatus:async()=>({connected}),addListener:async(_,listener)=>{networkListeners.add(listener);return {remove:()=>networkListeners.delete(listener)}}}});
    window.__setActive=value=>{active=value;if(window.__host==='web'){
      Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>active?'visible':'hidden'});
      document.dispatchEvent(new Event('visibilitychange'));
    }else for(const listener of appListeners)listener({isActive:value});};
    window.__setConnected=value=>{connected=value;if(window.__host==='web'){
      Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>connected});
      window.dispatchEvent(new Event(value?'online':'offline'));
    }else for(const listener of networkListeners)listener({connected:value});};
    const downloads=createWebContentDownloads(window,window.__downloadConfig,lifecycle);window.__downloads=downloads;
    window.__listenerCounts=()=>({app:appListeners.size,network:networkListeners.size});
    function Harness(){const [visible,setVisible]=useState(true);const {setLanguage}=useInterfaceLanguage();return <>
      <nav aria-label="Test harness"><button onClick={()=>setLanguage('ru')}>RU</button><button onClick={()=>setLanguage('en')}>EN</button>
      <button onClick={()=>setVisible(value=>!value)}>Toggle panel</button></nav>
      {visible&&<PlanetDownloadsPanel downloads={downloads}/>}</>}
    createRoot(document.getElementById('root')).render(<InterfaceLanguageProvider><Harness/></InterfaceLanguageProvider>);
  ` }, bundle: true, write: false, platform: 'browser', format: 'iife', target: 'es2022', jsx: 'automatic', outdir: '.tmp/lifecycle-memory',
    define: { 'process.env.NODE_ENV': '"development"' } });
  const js = bundle.outputFiles.find(file => file.path.endsWith('.js')).text, css = bundle.outputFiles.find(file => file.path.endsWith('.css')).text;
  const server = http.createServer((request, response) => {
    if (request.url === '/harness') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end('<!doctype html><html lang="ru"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Downloads lifecycle fixture</title></head><body style="margin:0;background:#efe5d4;font-family:system-ui"><div id="root"></div></body></html>'); return;
    }
    const file = f.files.find(file => request.url === '/package/' + file.path);
    if (!file) { response.writeHead(404); response.end(); return; }
    requests.push({ path: file.path, cookie: request.headers.cookie ?? null, referrer: request.headers.referer ?? null });
    const bytes = Buffer.from(file.bytes); response.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': bytes.length });
    if (stallEnglish && file.path === 'en/catalog.json') response.write(bytes.subarray(0, 10));
    else response.end(bytes);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const profileRoot = path.resolve(process.env.S11_BROWSER_PROFILE_ROOT ?? '.tmp/s11-content-browser');
  await fs.mkdir(profileRoot, { recursive: true }); const profile = await fs.mkdtemp(path.join(profileRoot, 'life-'));
  const configuration = { descriptors: [{ id: 'test', title: { ru: 'Проверочный пакет', en: 'Test package' },
    envelope: f.envelope, expected: f.expected, manifestSha256: f.manifestSha256, previous: null, baseUrl: origin + '/package/' }], trustedKeys: f.trustedKeys };
  let context;
  async function open() {
    context = await chromium.launchPersistentContext(profile, { channel: 'chrome', headless: true, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin + '/harness'); await page.addStyleTag({ content: css });
    await page.evaluate(({ configuration, host }) => { window.__downloadConfig = configuration; window.__host = host; }, { configuration, host });
    await page.addScriptTag({ content: js }); await page.locator('[data-planet-downloads] summary').click(); return page;
  }
  const result = { sourceFixture: true, host, injectedLifecycle: true, actualHttpAndBrowserStorage: true, installedNative: false, releaseReady: false, pass: false };
  const englishRequests = () => requests.filter(request => request.path === 'en/catalog.json').length;
  try {
    let page = await open(); const row = page.locator('[data-download-id="test"]');
    await page.getByRole('button', { name: 'Загрузить', exact: true }).click();
    await expect.poll(englishRequests).toBe(1);
    await page.getByRole('button', { name: 'Приостановить', exact: true }).click();
    await expect(row).toHaveAttribute('data-download-phase', 'paused');
    await expect(page.getByRole('button', { name: 'Приостановить', exact: true })).toBeFocused();
    expect(Number(await page.getByRole('progressbar').getAttribute('value'))).toBeGreaterThan(0);
    if (host === 'web') await page.locator('[data-planet-downloads]').screenshot({ path: testInfo.outputPath('downloads-paused-ru.png') });
    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Resume download', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Resume download', exact: true }).click();
    await expect.poll(englishRequests).toBe(2);
    await page.getByRole('button', { name: 'Toggle panel', exact: true }).click();
    await page.evaluate(() => window.__setActive(false));
    await expect.poll(() => page.evaluate(() => window.__downloads.getSnapshot().items[0].phase)).toBe('paused');
    await page.evaluate(() => window.__setActive(true));
    expect(englishRequests()).toBe(2);
    await page.getByRole('button', { name: 'Toggle panel', exact: true }).click();
    await page.locator('[data-planet-downloads] summary').click();
    await page.getByRole('button', { name: 'Resume download', exact: true }).click();
    await expect.poll(englishRequests).toBe(3);
    await page.evaluate(() => window.__setConnected(false));
    await expect(row).toHaveAttribute('data-download-phase', 'paused');
    await page.getByRole('button', { name: 'Resume download', exact: true }).click();
    await expect(row).toHaveAttribute('data-download-phase', 'paused'); expect(englishRequests()).toBe(3);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(row).toHaveAttribute('data-download-phase', 'cancelled');
    await page.evaluate(() => window.__setConnected(true)); expect(englishRequests()).toBe(3);
    // A verified candidate changed on disk while paused must be re-fetched.
    await page.evaluate(async digest => {
      const name = (await caches.keys()).find(name => name.endsWith('-' + digest));
      if (!name) throw Error('Missing candidate'); const cache = await caches.open(name);
      const key = (await cache.keys()).find(request => request.url.endsWith('/files/dependency-index.json'));
      if (!key) throw Error('Missing verified dependency'); await cache.put(key, new Response('corrupt', { headers: { 'Content-Type': 'application/json' } }));
    }, f.manifestSha256);
    stallEnglish = false;
    await page.getByRole('button', { name: 'Retry download', exact: true }).click();
    await expect(row).toHaveAttribute('data-download-phase', 'saved');
    expect(englishRequests()).toBe(4);
    expect(requests.filter(request => request.path === 'dependency-index.json')).toHaveLength(2);
    expect(requests.filter(request => request.path === 'ru/catalog.json')).toHaveLength(1);
    expect(requests.every(request => request.cookie === null && request.referrer === null)).toBe(true);
    expect(await page.evaluate(() => window.__listenerCounts())).toEqual(host === 'web' ? { app: 0, network: 0 } : { app: 1, network: 1 });
    const accessibility = await new AxeBuilder({ page }).include('[data-planet-downloads]').analyze(); expect(accessibility.violations).toEqual([]);
    expect(await page.locator('[data-planet-downloads]').evaluate(element => element.scrollWidth > element.clientWidth)).toBe(false);
    if (host === 'web') await page.locator('[data-planet-downloads]').screenshot({ path: testInfo.outputPath('downloads-saved-en.png') });
    const savedRequests = [...requests];
    await page.evaluate(() => window.__downloads.dispose());
    expect(await page.evaluate(() => window.__listenerCounts())).toEqual({ app: 0, network: 0 });
    await context.close(); context = undefined;
    page = await open(); await context.setOffline(true); await page.evaluate(() => window.__setConnected(false));
    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await page.getByRole('button', { name: 'Check files', exact: true }).click();
    await expect(page.locator('[data-download-id="test"]')).toHaveAttribute('data-download-phase', 'saved');
    expect(requests).toEqual(savedRequests); expect(errors).toEqual([]);
    Object.assign(result, { requests, manualPause: true, backgroundPause: true, offlinePause: true, explicitResume: true,
      cancelOverridesPause: true, corruptCandidateRefetched: true, offlineAfterBrowserRestart: true, accessibilityViolations: 0, pass: true });
  } finally {
    if (context) await context.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    await testInfo.attach('download-lifecycle-result', { contentType: 'application/json', body: JSON.stringify(result, null, 2) });
  }
});
