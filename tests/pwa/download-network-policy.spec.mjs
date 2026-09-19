import { test, expect, chromium } from '@playwright/test';
import { build } from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { contentPackageFixture } from '../support/content-package-fixtures.mjs';

// Real HTTP, React, browser preferences, Web Locks and CacheStorage. Transport
// types are injected host observations, not claims about the machine's radio.
test('Wi-Fi policy blocks unknown transport, pauses cellular transfer and persists with explicit recovery', async ({}, testInfo) => {
  const f = contentPackageFixture(), requests = [], errors = []; let stallEnglish = true;
  const bundle = await build({ stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
    import React,{useEffect} from 'react'; import {createRoot} from 'react-dom/client';
    import {InterfaceLanguageProvider,useInterfaceLanguage} from './src/i18n/InterfaceLanguage';
    import PlanetDownloadsPanel from './src/host/PlanetDownloadsPanel';
    import {createWebContentDownloads} from './src/platform/adapters/web/WebContentDownloads';
    import {createWebPlatformAdapter} from './src/platform/adapters/web/WebPlatformAdapter';
    const connection=new EventTarget();let connected=true,speedReads=0;
    Object.defineProperty(connection,'effectiveType',{get:()=>{speedReads++;return '4g'}});
    Object.defineProperty(navigator,'connection',{configurable:true,value:connection});
    Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>connected});
    window.__speedReads=()=>speedReads;
    window.__setNetworkType=type=>{if(type===null)delete connection.type;else connection.type=type;connection.dispatchEvent(new Event('change'));};
    window.__setConnected=value=>{connected=value;window.dispatchEvent(new Event(value?'online':'offline'));};
    const platform=createWebPlatformAdapter({window});
    const downloads=createWebContentDownloads(window,window.__downloadConfig,platform,platform.preferences);
    window.__downloads=downloads;
    function Harness(){const {setLanguage}=useInterfaceLanguage();useEffect(()=>{window.__setLanguage=setLanguage},[setLanguage]);return <>
      <nav aria-label="Test harness"><button onClick={()=>setLanguage('ru')}>RU</button><button onClick={()=>setLanguage('en')}>EN</button></nav>
      <PlanetDownloadsPanel downloads={downloads}/></>}
    createRoot(document.getElementById('root')).render(<InterfaceLanguageProvider><Harness/></InterfaceLanguageProvider>);
  ` }, bundle: true, write: false, platform: 'browser', format: 'iife', target: 'es2022', jsx: 'automatic', outdir: '.tmp/network-policy-memory',
    define: { 'process.env.NODE_ENV': '"development"' } });
  const js = bundle.outputFiles.find(file => file.path.endsWith('.js')).text, css = bundle.outputFiles.find(file => file.path.endsWith('.css')).text;
  const server = http.createServer((request, response) => {
    if (request.url === '/harness') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end('<!doctype html><html lang="ru"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Download network policy fixture</title></head><body style="margin:0;background:#efe5d4;font-family:system-ui"><div id="root"></div></body></html>'); return;
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
  await fs.mkdir(profileRoot, { recursive: true }); const profile = await fs.mkdtemp(path.join(profileRoot, 'network-'));
  const configuration = { descriptors: [{ id: 'test', title: { ru: 'Проверочный пакет', en: 'Test package' },
    envelope: f.envelope, expected: f.expected, manifestSha256: f.manifestSha256, previous: null, baseUrl: origin + '/package/' }], trustedKeys: f.trustedKeys };
  const key = 'probpera-planet-download-network-v1'; let context;
  async function render(page) {
    await page.goto(origin + '/harness'); await page.addStyleTag({ content: css });
    await page.evaluate(configuration => { window.__downloadConfig = configuration; }, configuration);
    await page.addScriptTag({ content: js }); await page.locator('[data-planet-downloads] summary').click();
    await expect.poll(() => page.evaluate(() => window.__downloads.getSnapshot().network.status)).toBe('ready');
    return page;
  }
  async function open() {
    context = await chromium.launchPersistentContext(profile, { channel: 'chrome', headless: true, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message)); return render(page);
  }
  const result = { sourceFixture: true, injectedNetworkTypes: true, actualHttpAndBrowserStorage: true,
    installedNative: false, releaseReady: false, pass: false };
  const englishRequests = () => requests.filter(request => request.path === 'en/catalog.json').length;
  try {
    let page = await open(); const row = page.locator('[data-download-id="test"]');
    await page.getByRole('button', { name: 'RU', exact: true }).click();
    const wifi = page.getByRole('checkbox', { name: 'Загружать только по Wi-Fi', exact: true });
    await expect(wifi).toBeChecked();
    await page.getByRole('button', { name: 'Загрузить', exact: true }).click();
    await expect(row).toHaveAttribute('data-download-phase', 'waiting-wifi');
    expect(requests).toEqual([]); expect(await page.evaluate(() => window.__speedReads())).toBe(0);
    await wifi.uncheck();
    await expect.poll(() => page.evaluate(key => localStorage.getItem(key), key)).toBe('any-network');
    expect(requests).toEqual([]);
    await page.getByRole('button', { name: 'Продолжить загрузку', exact: true }).click();
    await expect.poll(englishRequests).toBe(1);
    await page.evaluate(() => window.__setNetworkType('cellular'));
    await wifi.check();
    await expect(row).toHaveAttribute('data-download-phase', 'waiting-wifi');
    await expect(wifi).toBeFocused();
    const retainedBytes = Number(await page.getByRole('progressbar').getAttribute('value'));
    expect(retainedBytes).toBeGreaterThan(0);
    await expect.poll(() => page.evaluate(key => localStorage.getItem(key), key)).toBe('wifi-only');
    await page.evaluate(() => window.__setLanguage('en'));
    const englishWifi = page.getByRole('checkbox', { name: 'Download over Wi-Fi only', exact: true });
    await expect(englishWifi).toBeChecked(); await expect(englishWifi).toBeFocused();
    await expect(page.getByRole('button', { name: 'Resume download', exact: true })).toBeVisible();
    await page.locator('[data-planet-downloads]').screenshot({ path: testInfo.outputPath('wifi-waiting-en.png') });
    await page.evaluate(() => window.__setNetworkType('wifi'));
    await expect(row).toHaveAttribute('data-download-phase', 'waiting-wifi'); expect(englishRequests()).toBe(1);
    stallEnglish = false;
    await page.getByRole('button', { name: 'Resume download', exact: true }).click();
    await expect(row).toHaveAttribute('data-download-phase', 'saved');
    expect(englishRequests()).toBe(2);
    expect(requests.filter(request => request.path === 'dependency-index.json')).toHaveLength(1);
    expect(requests.filter(request => request.path === 'ru/catalog.json')).toHaveLength(1);
    expect(requests.every(request => request.cookie === null && request.referrer === null)).toBe(true);
    // Persist a non-default value first so a fresh controller cannot pass by
    // merely falling back to the Wi-Fi-only default.
    await englishWifi.uncheck();
    await expect.poll(() => page.evaluate(key => localStorage.getItem(key), key)).toBe('any-network');
    await render(page);
    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await expect(page.getByRole('checkbox', { name: 'Download over Wi-Fi only', exact: true })).not.toBeChecked();
    await page.getByRole('checkbox', { name: 'Download over Wi-Fi only', exact: true }).check();
    await expect.poll(() => page.evaluate(key => localStorage.getItem(key), key)).toBe('wifi-only');
    const savedRequests = [...requests];
    await page.evaluate(() => window.__downloads.dispose()); await context.close(); context = undefined;
    page = await open(); await context.setOffline(true); await page.evaluate(() => window.__setConnected(false));
    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await expect(page.getByRole('checkbox', { name: 'Download over Wi-Fi only', exact: true })).toBeChecked();
    await page.getByRole('button', { name: 'Check files', exact: true }).click();
    await expect(page.locator('[data-download-id="test"]')).toHaveAttribute('data-download-phase', 'saved');
    expect(requests).toEqual(savedRequests); expect(errors).toEqual([]);
    expect(await page.locator('[data-planet-downloads]').evaluate(element => element.scrollWidth > element.clientWidth)).toBe(false);
    Object.assign(result, { requests, unknownAndSpeedOnlyBlocked: true, enablingWifiOnCellularPaused: true,
      wholeFileResume: true, explicitResume: true, localeAndFocusPreserved: true, nonDefaultPreferenceRestoredAfterReload: true,
      offlineCheckAfterBrowserRestart: true, retainedBytes, pass: true });
  } finally {
    if (context) await context.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    await testInfo.attach('download-network-policy-result', { contentType: 'application/json', body: JSON.stringify(result, null, 2) });
  }
});
