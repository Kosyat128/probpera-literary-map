import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium, expect, test } from '@playwright/test';

const SITE = 'https://reading-progress.test';
const FIRST = '11111111-1111-4111-8111-111111111111';
const SECOND = '22222222-2222-4222-8222-222222222222';

// Real React hook and browser localStorage. Auth observations and Supabase
// responses are explicit test ports; this never contacts an account or database.
test('reading progress survives delayed hydration and article changes without crossing account boundaries', async ({}, testInfo) => {
  const bundle = await build({ stdin: { resolveDir: fileURLToPath(new URL('../../', import.meta.url)), loader: 'jsx', contents: `
    import React,{useState} from 'react';import{createRoot}from'react-dom/client';
    import{useReadingProgress,readingProgressStorageKey}from'./src/hooks/useReadingProgress';
    const root=createRoot(document.getElementById('root'));
    function Reader(){const [article,setArticle]=useState('first'),[,render]=useState(0);
      const progress=useReadingProgress('article',article);
      window.__reader={article:id=>setArticle(id),save:(value,hint)=>progress.saveProgress(value,hint),
        local:()=>JSON.parse(localStorage.getItem(readingProgressStorageKey(window.__readingAuth.user?.id??null))??'{}')['article:'+article],
        configure:auth=>{window.__readingAuth=auth;render(value=>value+1)},unmount:()=>root.unmount()};
      return <main><h1>Reading progress fixture</h1><output data-article>{article}</output>
        <output data-subject>{window.__readingAuth.user?.id??'guest'}</output>
        <output data-progress>{progress.restoredProgress===null?'none':String(progress.restoredProgress)}</output></main>}
    root.render(<Reader/>);
  ` }, bundle: true, write: false, format: 'iife', platform: 'browser', target: 'es2022', jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"development"' }, logLevel: 'silent',
    plugins: [{ name: 'controlled-reading-auth-and-transport', setup(builder) {
      builder.onResolve({ filter: /(?:AuthContext|supabase)$/ }, args => {
        if (!args.path.startsWith('.')) return undefined;
        return { path: args.path.endsWith('AuthContext') ? 'auth' : 'transport', namespace: 'reading-fixture' };
      });
      builder.onLoad({ filter: /.*/, namespace: 'reading-fixture' }, args => ({ loader: 'js', contents: args.path === 'auth'
        ? 'export const useAuth=()=>window.__readingAuth;'
        : 'export const supabase={from:table=>window.__remote.from(table)};' }));
    } }],
  });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install({ time: new Date('2026-09-19T18:00:00.000Z') });
  await page.route('**/*', route => route.request().url() === SITE + '/'
    ? route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="en"><head><title>Reading progress fixture</title></head><body><div id="root"></div></body></html>' })
    : route.abort());
  const result = { sourceFixture: true, actualReactAndLocalStorage: true, remoteTransportStubbed: true,
    installedNative: false, releaseReady: false, pass: false };
  const reads = () => page.evaluate(() => window.__remote.reads());
  const writes = () => page.evaluate(() => window.__remote.writes());
  const configure = async (configured, user) => {
    await page.evaluate(auth => window.__reader.configure(auth), { configured, user: user ? { id: user } : null });
    await expect(page.locator('[data-subject]')).toHaveText(user ?? 'guest');
  };
  const article = async id => {
    await page.evaluate(id => window.__reader.article(id), id);
    await expect(page.locator('[data-article]')).toHaveText(id);
  };
  const save = progress => page.evaluate(progress => window.__reader.save(progress, 'paragraph-' + progress), progress);
  const latestRead = async (subject, item, after = 0) => {
    const matches = call => call.id > after && call.filters.user_id === subject && call.filters.item_id === item;
    await expect.poll(async () => (await reads()).filter(matches).length).toBeGreaterThan(0);
    return (await reads()).filter(matches).at(-1);
  };
  try {
    await page.goto(SITE + '/');
    await page.evaluate(subject => {
      window.__readingAuth = { configured: true, user: { id: subject } };
      const readCalls = [], writeCalls = [], pending = new Map();
      window.__remote = {
        reads: () => JSON.parse(JSON.stringify(readCalls)), writes: () => JSON.parse(JSON.stringify(writeCalls)),
        resolve(id, progress) {
          const settle = pending.get(id); if (!settle) throw Error('Unknown reading request ' + id);
          pending.delete(id); settle({ data: progress === null ? null : { progress_percent: progress,
            position_hint: 'remote-paragraph', updated_at: new Date(Date.now() + 60_000).toISOString() }, error: null });
        },
        from(table) {
          const filters = {};
          const query = {
            select(columns) { this.columns = columns; return this; },
            eq(field, value) { filters[field] = value; return this; },
            abortSignal(signal) { this.signal = signal; return this; },
            maybeSingle() {
              const id = readCalls.length + 1;
              readCalls.push({ id, table, filters: { ...filters }, columns: this.columns });
              return new Promise(resolve => pending.set(id, resolve));
            },
            upsert(value, options) {
              writeCalls.push({ table, value: JSON.parse(JSON.stringify(value)), options });
              const response = Promise.resolve({ data: null, error: null });
              response.abortSignal = () => response;
              return response;
            },
          };
          return query;
        },
      };
    }, FIRST);
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    await expect(page.locator('[data-progress]')).toHaveText('none');
    const initialRead = await latestRead(FIRST, 'first');
    await save(65);
    // Even a later-dated remote response belongs to the earlier hydration:
    // an explicit local change made while it was pending remains authoritative.
    await page.evaluate(id => window.__remote.resolve(id, 12), initialRead.id);
    expect(await page.evaluate(() => window.__reader.local())).toMatchObject({ progress: 65 });
    await article('second');
    const secondRead = await latestRead(FIRST, 'second');
    await page.evaluate(id => window.__remote.resolve(id, null), secondRead.id);
    await save(30);
    await page.clock.fastForward(5_001);
    await expect.poll(async () => (await writes()).some(call => call.value.user_id === FIRST
      && call.value.item_id === 'second' && call.value.progress_percent === 30)).toBe(true);
    expect((await writes()).some(call => call.value.user_id === FIRST && call.value.item_id === 'first'
      && call.value.progress_percent === 12)).toBe(false);
    await article('first');
    await expect(page.locator('[data-progress]')).toHaveText('65');
    await article('second');
    await expect(page.locator('[data-progress]')).toHaveText('30');
    const supersededRead = await latestRead(FIRST, 'second', secondRead.id);
    await save(45); const beforeIdentityChange = await writes();
    await configure(true, SECOND);
    const otherRead = await latestRead(SECOND, 'second');
    await expect(page.locator('[data-progress]')).toHaveText('none');
    await page.evaluate(id => window.__remote.resolve(id, 99), supersededRead.id);
    await expect(page.locator('[data-progress]')).toHaveText('none');
    await page.clock.fastForward(5_001);
    expect(await writes()).toEqual(beforeIdentityChange);
    await page.evaluate(id => window.__remote.resolve(id, 8), otherRead.id);
    await expect(page.locator('[data-progress]')).toHaveText('8');
    await save(0);
    await page.clock.fastForward(5_001);
    await expect.poll(async () => (await writes()).some(call => call.value.user_id === SECOND
      && call.value.item_id === 'second' && call.value.progress_percent === 0 && call.value.completed_at === null)).toBe(true);
    const beforeAccountless = { reads: await reads(), writes: await writes() };
    await configure(false, null); await expect(page.locator('[data-progress]')).toHaveText('none');
    await save(19); await page.clock.fastForward(5_001);
    await article('third'); await article('second');
    await expect(page.locator('[data-progress]')).toHaveText('19');
    expect({ reads: await reads(), writes: await writes() }).toEqual(beforeAccountless);
    await configure(true, SECOND); await expect(page.locator('[data-progress]')).toHaveText('0');
    await configure(true, FIRST); await expect(page.locator('[data-progress]')).toHaveText('45');
    expect((await writes()).filter(call => call.value.user_id === SECOND).every(call => call.value.progress_percent === 0)).toBe(true);
    expect(errors).toEqual([]);
    Object.assign(result, { delayedHydrationPreservesFreshLocalProgress: true, articleSwitchReschedulesDebounce: true,
      identitySwitchDropsOldPendingUpload: true, accountScopedLocalRestoration: true, zeroProgressResetPreserved: true,
      accountlessRemoteCalls: 0, clockAdvancedWithoutRealDebounceWait: true, reads: await reads(), writes: await writes(), pass: true });
  } finally {
    await browser.close();
    await testInfo.attach('reading-progress-result', { contentType: 'application/json', body: JSON.stringify(result, null, 2) });
  }
});
