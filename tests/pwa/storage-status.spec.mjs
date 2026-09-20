import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';
import { chromium, expect, test } from '@playwright/test';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SITE = 'https://storage-status.test';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const TIMEOUT = 8_001;

// Actual device panel, its storage controller, locale provider and CSS. Storage
// replies and otherwise unused install/worker ports are controlled. Clock travel
// exercises the real deadline; this does not grant real browser persistence.
test('device storage deadlines preserve useful data and fence late replies across retry and unmount', async ({}, testInfo) => {
  test.setTimeout(120_000);
  const bundle = await build({ absWorkingDir: ROOT, stdin: { resolveDir: ROOT, loader: 'jsx', contents: `
    import React,{useState}from'react';import{createRoot}from'react-dom/client';
    import{InterfaceLanguageProvider}from'./src/i18n/InterfaceLanguage';
    import InterfaceLanguageControl from'./src/components/InterfaceLanguageControl';
    import PwaDevicePanel from'./src/pwa/PwaDevicePanel';import'./src/pwa/pwa.css';
    const subscribe=()=>()=>undefined;
    const installState=Object.freeze({phase:'manual',installationEvidence:null});
    const workerState=Object.freeze({phase:'ready',update:null,error:null,rollback:null,activeBuildId:null,engineBuildId:null});
    const unavailable=async()=>({ok:false,reason:'not-ready'});
    const install=Object.freeze({subscribe,getSnapshot:()=>installState,requestInstall:async()=>({status:'unavailable'}),dispose(){}});
    const worker=Object.freeze({subscribe,getSnapshot:()=>workerState,ready:Promise.resolve(true),checkForUpdate:unavailable,
      checkOfflineReadiness:async()=>({status:'unavailable',reason:'not-ready'}),repairOfflineBase:async()=>({status:'unavailable',reason:'access-required'}),
      activateUpdate:unavailable,rollback:unavailable,dispose(){}});
    function Harness(){const[open,setOpen]=useState(true);return <main className="pwa-help"
      onClickCapture={event=>window.__storageFixture.beginClick(event.isTrusted)} onClick={()=>window.__storageFixture.endClick()}>
      <header><InterfaceLanguageControl/><button onClick={()=>setOpen(false)}>Close panel</button></header>
      {open?<PwaDevicePanel install={install} worker={worker}/>:<p data-panel-closed>Panel closed</p>}</main>}
    const root=createRoot(document.getElementById('root'));window.__unmountStorageFixture=()=>root.unmount();
    root.render(<React.StrictMode><InterfaceLanguageProvider><Harness/></InterfaceLanguageProvider></React.StrictMode>);
  ` }, bundle: true, write: false, metafile: true, platform: 'browser', format: 'iife', target: 'es2022', jsx: 'automatic',
    outdir: path.join(ROOT, '.tmp/storage-status-memory'), entryNames: 'storage-status', logLevel: 'silent',
    define: { 'process.env.NODE_ENV': '"development"', 'import.meta.env': JSON.stringify({ BASE_URL: '/', DEV: false, PROD: true,
      VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '', VITE_TURNSTILE_SITE_KEY: '' }),
      __LITERARY_PLANET_EDITION__: '"pwa"', __LITERARY_PLANET_LOCAL_QA__: 'false',
      __LITERARY_PLANET_LICENSE_AUTHORITY__: 'null', __YANDEX_METRIKA_COUNTER_ID__: '""' },
  });
  const inputs = Object.keys(bundle.metafile.inputs).map(value => value.replaceAll('\\', '/'));
  for (const filename of ['src/pwa/PwaDevicePanel.tsx', 'src/pwa/PwaStorageStatus.ts', 'src/pwa/pwa.css',
    'src/i18n/InterfaceLanguage.tsx', 'src/components/InterfaceLanguageControl.tsx']) expect(inputs).toContain(filename);
  const sources = [...new Set([...inputs.filter(value => value.startsWith('src/')), 'tests/pwa/storage-status.spec.mjs'])].sort();
  const sourceInputs = await Promise.all(sources.map(async filename => ({ path: filename, sha256: digest(await fs.readFile(path.join(ROOT, filename))) })));
  const script = bundle.outputFiles.find(file => file.path.endsWith('.js')).text;
  const css = bundle.outputFiles.find(file => file.path.endsWith('.css')).text;
  const profileRoot = path.resolve(process.env.S11_BROWSER_PROFILE_ROOT ?? path.join(ROOT, '.tmp/s11-storage-status'));
  await fs.mkdir(profileRoot, { recursive: true });
  const profile = await fs.mkdtemp(path.join(profileRoot, 'status-'));
  const context = await chromium.launchPersistentContext(profile, { channel: 'chrome', headless: true,
    viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage(), errors = [], unexpectedRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install({ time: new Date('2026-09-20T12:00:00.000Z') });
  await page.route('**/*', route => {
    if (route.request().url() === SITE + '/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ru"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Device storage source fixture</title></head><body style="margin:0;font:16px/1.5 system-ui;background:#fffaf2;color:#271538"><div id="root"></div></body></html>' });
    if (route.request().url() !== SITE + '/favicon.ico') unexpectedRequests.push(route.request().url());
    return route.abort();
  });
  const result = { sourceFixture: true, actualReactStrictMode: true, actualDevicePanel: true, actualLanguageProvider: true, actualCss: true,
    actualFullApp: false, actualGlobe: false, storageApiControlled: true, clockControlled: true, deviceTested: false,
    browserPersistenceGranted: false, releaseReady: false, pass: false, sourceInputs,
    builtFiles: bundle.outputFiles.map(file => ({ path: path.basename(file.path), sha256: digest(file.contents) })),
    observations: [], screenshots: [] };
  const calls = () => page.evaluate(() => window.__storageFixture.calls());
  const persistCalls = async () => (await calls()).filter(call => call.operation === 'persist');
  const plan = (operation, mode, value) => page.evaluate(({ operation, mode, value }) => window.__storageFixture.plan(operation, mode, value), { operation, mode, value });
  const resolve = (id, value) => page.evaluate(({ id, value }) => window.__storageFixture.resolve(id, value), { id, value });
  const storage = language => page.getByRole('region', { name: language === 'ru' ? 'Место на устройстве' : 'Device storage', exact: true });
  async function capture(filename, language, width) {
    await page.setViewportSize({ width, height: 844 }); await storage(language).scrollIntoViewIfNeeded();
    const bounds = await storage(language).boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    expect(await storage(language).evaluate(element => element.scrollWidth > element.clientWidth)).toBe(false);
    const bytes = await page.screenshot({ path: testInfo.outputPath(filename) });
    result.screenshots.push({ filename, sha256: digest(bytes), width, height: 844 });
  }
  try {
    await page.goto(SITE + '/');
    await page.addStyleTag({ content: css });
    await page.evaluate(() => {
      localStorage.setItem('probpera-interface-language', 'ru');
      const calls = [], pending = new Map(), plans = new Map([
        ['estimate', { mode: 'value', value: { usage: 12_000_000, quota: 64_000_000 } }],
        ['persisted', { mode: 'hold' }], ['persist', { mode: 'hold' }],
      ]);
      let clickOpen = false, clickTrusted = false;
      function invoke(operation) {
        const plan = plans.get(operation), call = { id: calls.length + 1, operation, settled: false,
          userActivation: navigator.userActivation.isActive, duringReactClick: clickOpen, trustedClick: clickTrusted };
        calls.push(call);
        if (plan.mode === 'hold') return new Promise(resolve => pending.set(call.id, value => {
          call.settled = true; call.result = value; resolve(value);
        }));
        call.settled = true; call.result = plan.value;
        return Promise.resolve(plan.value);
      }
      Object.defineProperty(navigator, 'storage', { configurable: true,
        value: { estimate: () => invoke('estimate'), persisted: () => invoke('persisted'), persist: () => invoke('persist') } });
      window.__storageFixture = {
        calls: () => structuredClone(calls),
        beginClick(trusted) { clickOpen = true; clickTrusted = trusted; }, endClick() { clickOpen = false; clickTrusted = false; },
        plan(operation, mode, value) { plans.set(operation, { mode, value }); },
        resolve(id, value) { const settle = pending.get(id); if (!settle) throw Error('Unknown storage request ' + id); pending.delete(id); settle(value); },
        releaseAll() { for (const settle of pending.values()) settle(false); pending.clear(); },
      };
    });
    await page.addScriptTag({ content: script });
    await expect(storage('ru')).toBeVisible();
    await expect.poll(async () => (await calls()).filter(call => call.operation === 'persisted').length).toBeGreaterThan(0);
    const oldPersisted = (await calls()).filter(call => call.operation === 'persisted').at(-1);
    await expect(storage('ru').getByRole('button', { name: 'Обновить оценку', exact: true })).toBeDisabled();
    expect(await persistCalls()).toEqual([]);
    await page.clock.fastForward(TIMEOUT);
    await expect(storage('ru').getByRole('button', { name: 'Обновить оценку', exact: true })).toBeEnabled();
    await expect(storage('ru').getByRole('status')).toHaveText('Не удалось проверить хранилище. Можно повторить попытку.');
    await expect(storage('ru').locator('dl')).toContainText('12 МБ');
    await expect(storage('ru').locator('dl')).toContainText('64 МБ');
    await capture('storage-status-timeout-ru-390.png', 'ru', 390);
    result.observations.push({ phase: 'persisted-timeout-keeps-good-estimate', text: await storage('ru').innerText() });

    const readsBeforeLocale = (await calls()).length;
    await page.locator('.interface-language-control button').filter({ hasText: /^EN$/u }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(storage('en').getByRole('status')).toHaveText('Storage could not be checked. You can try again.');
    expect((await calls()).length).toBe(readsBeforeLocale); expect(await persistCalls()).toEqual([]);
    await plan('estimate', 'value', { usage: 24_000_000, quota: 96_000_000 }); await plan('persisted', 'value', false);
    await storage('en').getByRole('button', { name: 'Refresh estimate', exact: true }).click();
    await expect(storage('en').getByRole('status')).toHaveText('The browser may remove data when storage runs low.');
    await expect(storage('en').locator('dl')).toContainText('24 MB');
    await expect(storage('en').locator('dl')).toContainText('96 MB');
    await resolve(oldPersisted.id, true);
    await expect(storage('en').getByRole('button', { name: 'Request persistent storage', exact: true })).toBeEnabled();
    await expect(storage('en').getByRole('status')).toHaveText('The browser may remove data when storage runs low.');
    await capture('storage-status-recovered-en-1440.png', 'en', 1440);
    result.observations.push({ phase: 'retry-recovered-and-old-grant-ignored', text: await storage('en').innerText() });

    const protect = storage('en').getByRole('button', { name: 'Request persistent storage', exact: true });
    await protect.click(); await expect.poll(async () => (await persistCalls()).length).toBe(1);
    const timedOutPersist = (await persistCalls())[0];
    expect(timedOutPersist).toMatchObject({ userActivation: true, duringReactClick: true, trustedClick: true, settled: false });
    await expect(protect).toBeDisabled(); await page.clock.fastForward(TIMEOUT);
    await expect(protect).toBeEnabled();
    await expect(storage('en').getByRole('status')).toHaveText('Storage could not be checked. You can try again.');
    await expect(storage('en').locator('dl')).toContainText('24 MB');
    await plan('persist', 'value', 'granted'); await protect.click();
    await expect.poll(async () => (await persistCalls()).length).toBe(2);
    await expect(protect).toBeEnabled();
    await expect(storage('en').getByRole('status')).toHaveText('Storage could not be checked. You can try again.');
    result.observations.push({ phase: 'timeout-and-invalid-persist-make-no-grant-or-denial-claim', text: await storage('en').innerText() });

    await plan('persist', 'value', false); await protect.click();
    await expect(storage('en').getByRole('status')).toHaveText('The browser did not grant persistent storage. Saved data remains available while the browser retains it.');
    await expect(protect).toBeEnabled();
    await plan('persist', 'value', true); await protect.click();
    await expect(storage('en').getByRole('status')).toHaveText('The browser granted persistent storage. Clearing site data manually still removes it.');
    await expect(protect).toHaveCount(0);
    await resolve(timedOutPersist.id, false);
    await expect(storage('en').getByRole('status')).toHaveText('The browser granted persistent storage. Clearing site data manually still removes it.');
    expect(await persistCalls()).toHaveLength(4);
    for (const call of await persistCalls()) expect(call).toMatchObject({ userActivation: true, duringReactClick: true, trustedClick: true });
    result.observations.push({ phase: 'only-actual-booleans-report-denial-or-grant', text: await storage('en').innerText() });

    await plan('estimate', 'hold'); await plan('persisted', 'hold');
    const count = (await calls()).length;
    await storage('en').getByRole('button', { name: 'Refresh estimate', exact: true }).click();
    await expect.poll(async () => (await calls()).length).toBe(count + 2);
    await page.getByRole('button', { name: 'Close panel', exact: true }).click();
    await expect(page.locator('[data-panel-closed]')).toBeVisible(); await expect(page.locator('.pwa-device')).toHaveCount(0);
    await page.evaluate(() => window.__storageFixture.releaseAll()); await page.clock.fastForward(TIMEOUT);
    await page.evaluate(() => window.__unmountStorageFixture());
    expect(errors).toEqual([]); expect(unexpectedRequests).toEqual([]); expect(await persistCalls()).toHaveLength(4);
    Object.assign(result, { pass: true, boundedTimeoutWithoutRealEightSecondWait: true,
      successfulPartialDataRetained: true, lateResponseFenced: true, persistStartedInsideTrustedReactClick: true,
      noAutomaticPersist: true, invalidOrTimeoutNeverClaimsDenialOrGrant: true, unmountIgnoresLateResponses: true });
  } finally {
    result.calls = await calls().catch(() => []); result.errors = errors; result.unexpectedRequests = unexpectedRequests;
    await context.close();
    const filename = testInfo.outputPath('storage-status-result.json');
    await fs.writeFile(filename, JSON.stringify(result, null, 2) + '\n');
    await testInfo.attach('storage-status-result', { path: filename, contentType: 'application/json' });
  }
});
