import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';
import { chromium, expect, test } from '@playwright/test';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SITE = 'https://reading-library.test';
const FIRST = '11111111-1111-4111-8111-111111111111';
const SECOND = '22222222-2222-4222-8222-222222222222';
const GUEST_KEY = 'probpera-reading-library';
const accountKey = id => `${GUEST_KEY}:user:${encodeURIComponent(id)}`;
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const book = suffix => ({ id: 'fixture:writer:' + suffix, kind: 'book', title: 'Fixture ' + suffix,
  sectionId: 'books', sectionLabel: 'Books', href: '/books/fixture-' + suffix + '/' });
const GUEST_BOOK = book('guest'), FIRST_BOOK = book('first'), SECOND_BOOK = book('second');
const DOSSIER = { anchor: { sectionId: 'during', blockId: 'chapter-1', dossierVersion: 'fixture-v1',
  locale: 'ru', readingMode: 'DURING_READING' }, pageId: 'page-2', updatedAt: '2026-09-19T18:00:00.000Z' };
const remoteRow = item => ({ item_type: item.kind, item_id: item.id, title: item.title,
  section_id: item.sectionId, section_label: item.sectionLabel, href: item.href,
  added_at: '2026-09-19T17:00:00.000Z', reading_status: 'saved' });

// Actual hook, sync notice, React StrictMode and localStorage. Only auth and the
// transport are controlled. Builders execute in .then, not when constructed.
// The request ledger survives a real document reload; local items remain in
// actual browser storage, without a fixture persistence substitute.
test('reading library keeps offline intent, retries durable state once and isolates adult accounts', async ({}, testInfo) => {
  test.setTimeout(120_000);
  const bundle = await build({ absWorkingDir: ROOT, stdin: { resolveDir: ROOT, loader: 'jsx', contents: `
    import React,{useState}from'react';import{createRoot}from'react-dom/client';
    import{useReadingLibrary}from'./src/hooks/useReadingLibrary';
    import ReadingLibrarySyncNotice from'./src/components/ReadingLibrarySyncNotice';
    function Consumer({name,language}){const library=useReadingLibrary(),[accepted,setAccepted]=useState(null);
      window.__consumers[name]=library;
      return <section data-consumer={name} hidden={name==='second'}><output data-sync hidden>{JSON.stringify(library.sync)}</output>
        <ul>{library.items.map(item=><li key={item.kind+':'+item.id} data-library-item={item.id}>{item.title}: {item.status}</li>)}</ul>
        {name==='main'&&<><output data-accepted hidden>{accepted===null?'none':String(accepted)}</output>
          <button onClick={()=>{setAccepted(null);void library.save(window.__candidate).then(setAccepted)}}>Save candidate</button>
          <button onClick={()=>library.toggle(window.__candidate)}>Toggle candidate</button>
          <button onClick={()=>library.setStatus(window.__candidate.id,'book','reading')}>Start reading</button>
          <button onClick={()=>{setAccepted(null);void library.remove(window.__candidate.id,'book').then(setAccepted)}}>Remove candidate</button>
          <button onClick={()=>library.setDossierProgress(window.__candidate.id,window.__dossier)}>Keep dossier page</button>
          <ReadingLibrarySyncNotice sync={library.sync} onRetry={library.retrySync} language={language}/></>}
      </section>}
    function Library(){const[,render]=useState(0),[language,setLanguage]=useState('ru');
      window.__library={snapshot:()=>window.__consumers.main.items,sync:()=>window.__consumers.main.sync,
        peers:()=>Object.values(window.__consumers).map(value=>({items:value.items,sync:value.sync})),
        configure:(auth,candidate)=>{window.__libraryAuth=auth;window.__candidate=candidate;render(value=>value+1)},
        online:value=>{window.__online=value;window.dispatchEvent(new Event(value?'online':'offline'))}};
      return <main><h1>Reading library fixture</h1><output data-subject hidden>{window.__libraryAuth.user?.id??'guest'}</output>
        <button onClick={()=>setLanguage(language==='ru'?'en':'ru')}>Change notice language</button>
        <Consumer name="main" language={language}/><Consumer name="second" language={language}/></main>}
    window.__fixtureConfiguration().then(setup=>{
      window.__libraryAuth=setup.auth;window.__candidate=setup.candidate;window.__dossier=setup.dossier;
      window.__online=setup.online;window.__consumers={};
      Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>window.__online});
      if(localStorage.getItem('probpera-reading-library')===null)localStorage.setItem('probpera-reading-library',JSON.stringify(setup.guest));
      let sequence=0;
      window.__remote={from(table){const state={operation:'select',filters:{},value:null,options:null,signal:null};
        return{select(columns){state.operation='select';state.columns=columns;return this},
          upsert(value,options){state.operation='upsert';state.value=value;state.options=options;return this},
          update(value){state.operation='update';state.value=value;return this},delete(){state.operation='delete';return this},
          eq(field,value){state.filters[field]=value;return this},order(){return this},limit(){return this},
          abortSignal(signal){state.signal=signal;return this},
          then(resolve,reject){const requestId=setup.documentId+':'+(++sequence),signal=state.signal;
            const abort=()=>{void window.__libraryAbort(requestId)};
            signal?.addEventListener('abort',abort,{once:true});
            const request=window.__executeLibrary({requestId,table,operation:state.operation,filters:state.filters,
              value:state.value,options:state.options,aborted:signal?.aborted??false});
            return request.finally(()=>signal?.removeEventListener('abort',abort)).then(resolve,reject)}}}};
      createRoot(document.getElementById('root')).render(<React.StrictMode><Library/></React.StrictMode>);
    }).catch(error=>{window.__fixtureError=error.message});
  ` }, bundle: true, write: false, metafile: true, outdir: path.join(ROOT, '.tmp/reading-library-browser-memory'), entryNames: 'reading-library',
    format: 'iife', platform: 'browser', target: 'es2022', jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"development"' }, logLevel: 'silent',
    plugins: [{ name: 'controlled-library-auth-and-lazy-transport', setup(builder) {
      builder.onResolve({ filter: /(?:AuthContext|supabase)$/ }, args => !args.path.startsWith('.') ? undefined
        : { path: args.path.endsWith('AuthContext') ? 'auth' : 'transport', namespace: 'library-fixture' });
      builder.onLoad({ filter: /.*/, namespace: 'library-fixture' }, args => ({ loader: 'js', contents: args.path === 'auth'
        ? 'export const useAuth=()=>window.__libraryAuth;'
        : 'export const supabase={from:table=>window.__remote.from(table)};' }));
    } }],
  });
  const inputs = Object.keys(bundle.metafile.inputs).map(value => value.replaceAll('\\', '/'));
  for (const file of ['src/hooks/useReadingLibrary.ts', 'src/components/ReadingLibrarySyncNotice.tsx', 'src/components/ReadingLibrarySyncNotice.css']) {
    expect(inputs).toContain(file);
  }
  const sources = [...new Set([...inputs.filter(value => value.startsWith('src/')), 'tests/pwa/reading-library.spec.mjs'])].sort();
  const sourceInputs = await Promise.all(sources.map(async filename => ({ path: filename, sha256: digest(await fs.readFile(path.join(ROOT, filename))) })));
  const script = bundle.outputFiles.find(file => file.path.endsWith('.js')).text;
  const css = bundle.outputFiles.find(file => file.path.endsWith('.css')).text;
  const profileRoot = path.resolve(process.env.S11_BROWSER_PROFILE_ROOT ?? process.env.S13_BROWSER_PROFILE_ROOT ?? path.join(ROOT, '.tmp/s11-reading-library'));
  await fs.mkdir(profileRoot, { recursive: true });
  const profile = await fs.mkdtemp(path.join(profileRoot, 'rl-'));
  const context = await chromium.launchPersistentContext(profile, { channel: 'chrome', headless: true, viewport: { width: 1440, height: 850 } });
  const page = await context.newPage(), errors = [], unexpectedRequests = [];
  const calls = [], pending = new Map(), earlyAborts = new Set();
  const state = { auth: { configured: false, user: null }, candidate: GUEST_BOOK,
    online: true, mutation: 'hold', holdReads: true, rows: [], documentId: 0 };
  const result = { sourceFixture: true, actualFullApp: false, actualGlobe: false,
    actualReactStrictModeAndLocalStorage: true, actualSyncNotice: true, mountedConsumers: 2,
    remoteTransportStubbed: true, lazyThenableTransport: true, sourceInputs,
    builtFiles: bundle.outputFiles.map(file => ({ path: path.basename(file.path), sha256: digest(file.contents) })),
    installedNative: false, releaseReady: false, pass: false, observations: [], screenshots: [] };
  const writes = () => calls.filter(call => call.operation !== 'select');
  const snapshot = () => page.evaluate(() => window.__library.snapshot());
  const sync = () => page.evaluate(() => window.__library.sync());
  const main = page.locator('[data-consumer="main"]'), peer = page.locator('[data-consumer="second"]');
  async function peers() {
    await expect.poll(() => page.evaluate(() => {
      const peers=window.__library.peers();return peers.length===2&&JSON.stringify(peers[0])===JSON.stringify(peers[1]);
    })).toBe(true);
  }
  async function configure(configured, subject, candidate) {
    state.auth = { configured, user: subject ? { id: subject } : null }; state.candidate = candidate;
    await page.evaluate(({ auth, candidate }) => window.__library.configure(auth, candidate), { auth: state.auth, candidate });
    await expect(page.locator('[data-subject]')).toHaveText(subject ?? 'guest');
  }
  function settle(call, data = null, error = null) {
    const complete = pending.get(call.requestId); if (!complete) throw Error('Unknown held library request ' + call.requestId);
    pending.delete(call.requestId); call.settled = true; complete({ data, error });
  }
  const envelope = id => page.evaluate(key => JSON.parse(localStorage.getItem(key)), accountKey(id));
  async function capture(filename, width) {
    await page.setViewportSize({ width, height: 850 });
    const notice = main.locator('[data-reading-library-sync="pending"]'); await expect(notice).toBeVisible();
    const bounds = await notice.boundingBox(); expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    const bytes = await page.screenshot({ path: testInfo.outputPath(filename) });
    result.screenshots.push({ filename, sha256: digest(bytes), width, height: 850 });
  }
  page.on('pageerror', error => errors.push(error.message));
  await page.exposeBinding('__fixtureConfiguration', () => ({ auth: state.auth, candidate: state.candidate, online: state.online,
    documentId: ++state.documentId, dossier: DOSSIER,
    guest: [{ ...GUEST_BOOK, status: 'saved', addedAt: '2026-09-19T17:00:00.000Z', dossierProgress: DOSSIER }] }));
  await page.exposeBinding('__libraryAbort', (_source, requestId) => {
    const call = calls.find(value => value.requestId === requestId);
    if (call) call.aborted = true; else earlyAborts.add(requestId);
  });
  await page.exposeBinding('__executeLibrary', (_source, input) => {
    const call = { ...input, aborted: input.aborted || earlyAborts.has(input.requestId), settled: false }; calls.push(call);
    const hold = call.operation === 'select' ? state.holdReads : state.mutation === 'hold';
    if (hold) return new Promise(resolve => pending.set(call.requestId, resolve));
    call.settled = true;
    return { data: call.operation === 'select' ? state.rows : null,
      error: call.operation !== 'select' && state.mutation === 'reject' ? { message: 'controlled unavailable remote' } : null };
  });
  await page.route('**/*', route => {
    const url = route.request().url();
    if (url === SITE + '/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="en"><head><title>Reading library fixture</title><link rel="stylesheet" href="/fixture.css"><style>body{margin:20px;font:16px/1.5 system-ui;background:#faf8f3;color:#2e2434}main{max-width:800px;margin:auto}h1{font-size:24px}section>button,main>button{min-height:44px;margin:4px}</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>' });
    if (url === SITE + '/fixture.js') return route.fulfill({ contentType: 'text/javascript', body: script });
    if (url === SITE + '/fixture.css') return route.fulfill({ contentType: 'text/css', body: css });
    if (url !== SITE + '/favicon.ico') unexpectedRequests.push(url);
    return route.abort();
  });
  try {
    await page.goto(SITE + '/');
    await expect(main.locator('[data-library-item]')).toHaveCount(1);
    await expect(peer.locator('[data-library-item]')).toHaveCount(1); await peers();
    expect(await snapshot()).toEqual([expect.objectContaining({ ...GUEST_BOOK, dossierProgress: DOSSIER })]);
    expect(calls).toEqual([]); expect(await sync()).toMatchObject({ status: 'local', pendingCount: 0, persistence: 'persistent' });

    await configure(true, FIRST, FIRST_BOOK);
    await expect(main.locator('[data-library-item]')).toHaveCount(0);
    await expect.poll(() => calls.filter(call => call.operation === 'select' && call.filters.user_id === FIRST && !call.aborted).length).toBeGreaterThan(0);
    const initialRead = calls.filter(call => call.operation === 'select' && call.filters.user_id === FIRST && !call.aborted).at(-1);
    await main.getByRole('button', { name: 'Save candidate', exact: true }).click();
    await expect(main.locator('[data-accepted]')).toHaveText('true');
    await expect.poll(() => writes().length).toBe(1);
    const firstSave = writes()[0]; expect(firstSave.settled).toBe(false);
    expect(firstSave).toMatchObject({ operation: 'upsert', value: { user_id: FIRST, item_id: FIRST_BOOK.id, reading_status: 'saved' } });
    await expect(peer.locator('[data-library-item]')).toHaveCount(1);
    await main.getByRole('button', { name: 'Keep dossier page', exact: true }).click();
    expect((await snapshot())[0].dossierProgress).toEqual(DOSSIER); await peers(); expect(writes()).toHaveLength(1);
    settle(firstSave, null, { message: 'controlled remote rejection' });
    await expect.poll(sync).toMatchObject({ status: 'pending', pendingCount: 1, persistence: 'persistent' });
    expect((await snapshot())[0]).toMatchObject({ id: FIRST_BOOK.id, dossierProgress: DOSSIER }); await peers();
    const pendingSave = await envelope(FIRST);
    expect(pendingSave.schemaVersion).toBe(1); expect(pendingSave.items).toHaveLength(1); expect(pendingSave.pending).toHaveLength(1);
    expect(pendingSave.pending[0]).toMatchObject({ operation: 'upsert', item: { id: FIRST_BOOK.id } });
    expect(JSON.stringify(pendingSave.pending)).not.toContain('dossierProgress');
    await expect(main.getByRole('button', { name: 'Повторить синхронизацию', exact: true })).toBeVisible();
    await capture('reading-library-pending-ru-390.png', 390);
    await page.getByRole('button', { name: 'Change notice language', exact: true }).click();
    await expect(main.getByRole('button', { name: 'Retry sync', exact: true })).toBeVisible();
    await capture('reading-library-pending-en-1440.png', 1440);
    state.mutation = 'ok';
    await main.getByRole('button', { name: 'Retry sync', exact: true }).click();
    await expect.poll(() => writes().length).toBe(2);
    await expect.poll(sync).toMatchObject({ status: 'idle', pendingCount: 0, persistence: 'persistent' });
    expect((await snapshot())[0].dossierProgress).toEqual(DOSSIER); await peers();
    result.observations.push({ phase: 'remote-rejection-keeps-local-item-and-retry-succeeds', sync: await sync(), items: await snapshot() });

    // A local delete is accepted offline. Its atomic record keeps the deletion
    // intent beside the empty visible list, ready for the next document.
    state.online = false; await page.evaluate(() => window.__library.online(false));
    await main.getByRole('button', { name: 'Remove candidate', exact: true }).click();
    await expect(main.locator('[data-accepted]')).toHaveText('true');
    await expect(main.locator('[data-library-item]')).toHaveCount(0); await peers();
    await expect.poll(sync).toMatchObject({ status: 'pending', pendingCount: 1 }); expect(writes()).toHaveLength(2);
    const deleted = await envelope(FIRST);
    expect(deleted).toMatchObject({ schemaVersion: 1, items: [] }); expect(deleted.pending).toHaveLength(1);
    expect(deleted.pending[0]).toMatchObject({ operation: 'delete', id: FIRST_BOOK.id, kind: 'book' });
    settle(initialRead, [remoteRow(FIRST_BOOK)]);
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 0)));
    expect(await snapshot()).toEqual([]); await peers(); expect(writes()).toHaveLength(2);
    result.observations.push({ phase: 'offline-delete-shields-late-hydration', durableState: deleted });

    state.online = true; state.mutation = 'hold'; state.holdReads = false; state.rows = [remoteRow(FIRST_BOOK)];
    await page.reload();
    await expect(page.locator('[data-subject]')).toHaveText(FIRST);
    await expect.poll(() => writes().length).toBe(3);
    const delayedDelete = writes()[2];
    expect(delayedDelete).toMatchObject({ operation: 'delete', filters: { user_id: FIRST, item_type: 'book', item_id: FIRST_BOOK.id }, settled: false });
    await expect(main.locator('[data-library-item]')).toHaveCount(0); await expect(peer.locator('[data-library-item]')).toHaveCount(0);
    expect(await sync()).toMatchObject({ pendingCount: 1, persistence: 'persistent' }); await peers();
    expect((await envelope(FIRST)).pending).toEqual(deleted.pending);
    result.observations.push({ phase: 'real-reload-retries-one-current-delete', sync: await sync(), durableState: await envelope(FIRST) });

    // The uncooperative A request may settle after B is visible. Both consumers
    // share B's one queue; A's pending deletion remains in A's storage scope.
    state.mutation = 'ok'; state.rows = [];
    await configure(true, SECOND, SECOND_BOOK);
    await main.getByRole('button', { name: 'Toggle candidate', exact: true }).click();
    await expect.poll(() => writes().length).toBe(4);
    await expect(main.locator('[data-library-item]')).toHaveAttribute('data-library-item', SECOND_BOOK.id);
    await main.getByRole('button', { name: 'Start reading', exact: true }).click();
    await expect.poll(() => writes().length).toBe(5);
    expect(writes()[4].value).toMatchObject({ user_id: SECOND, reading_status: 'reading' });
    await expect.poll(sync).toMatchObject({ status: 'idle', pendingCount: 0 });
    settle(delayedDelete, null, { message: 'controlled delayed old-account rejection' });
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 0)));
    expect((await snapshot()).map(item => [item.id, item.status])).toEqual([[SECOND_BOOK.id, 'reading']]); await peers();
    expect((await envelope(FIRST)).items).toEqual([]); expect((await envelope(FIRST)).pending).toHaveLength(1);
    expect(writes()).toHaveLength(5);

    await configure(false, null, GUEST_BOOK);
    expect(await snapshot()).toEqual([expect.objectContaining({ ...GUEST_BOOK, dossierProgress: DOSSIER, status: 'saved' })]);
    const beforeGuestEdit = calls.length;
    await main.getByRole('button', { name: 'Start reading', exact: true }).click();
    await expect(peer.locator('[data-library-item]')).toContainText('reading');
    expect((await snapshot())[0].dossierProgress).toEqual(DOSSIER); expect(calls).toHaveLength(beforeGuestEdit);
    expect(await page.evaluate(key => Array.isArray(JSON.parse(localStorage.getItem(key))), GUEST_KEY)).toBe(true);
    await configure(true, FIRST, FIRST_BOOK);
    await expect.poll(() => writes().length).toBe(6);
    await expect.poll(sync).toMatchObject({ status: 'idle', pendingCount: 0 });
    expect(await snapshot()).toEqual([]); expect((await envelope(FIRST)).pending).toEqual([]); await peers();
    await configure(true, SECOND, SECOND_BOOK);
    expect((await snapshot()).map(item => [item.id, item.status])).toEqual([[SECOND_BOOK.id, 'reading']]); await peers();
    expect(writes()).toHaveLength(6);

    // Exercise the real hook's reconnect listener, distinct from mount/manual
    // retry: both consumers observe one offline intent and one resumed delete.
    state.online = false; await page.evaluate(() => window.__library.online(false));
    await main.getByRole('button', { name: 'Remove candidate', exact: true }).click();
    await expect(main.locator('[data-accepted]')).toHaveText('true');
    await expect.poll(sync).toMatchObject({ status: 'pending', pendingCount: 1 });
    expect(await snapshot()).toEqual([]); await peers(); expect(writes()).toHaveLength(6);
    state.online = true; await page.evaluate(() => window.__library.online(true));
    await expect.poll(() => writes().length).toBe(7);
    await expect.poll(sync).toMatchObject({ status: 'idle', pendingCount: 0 });
    expect(writes()[6]).toMatchObject({ operation: 'delete', filters: { user_id: SECOND, item_type: 'book', item_id: SECOND_BOOK.id } });
    expect(await snapshot()).toEqual([]); await peers(); expect(writes()).toHaveLength(7);
    result.observations.push({ phase: 'online-event-retries-one-current-delete', sync: await sync(), durableState: await envelope(SECOND) });
    expect(JSON.stringify(writes())).not.toContain('dossierProgress');
    expect(JSON.stringify(writes())).not.toContain('dossierVersion');
    expect(JSON.stringify(writes())).not.toContain(GUEST_BOOK.id);
    expect(errors).toEqual([]); expect(unexpectedRequests).toEqual([]);
    expect(await page.evaluate(() => window.__fixtureError ?? null)).toBeNull();
    Object.assign(result, { calls, strictModeAndSecondConsumerDoNotDuplicateMutations: true,
      acceptedBeforeRemoteResponse: true, rejectedRemoteDoesNotRollbackLocalChoice: true,
      atomicAdultItemsAndPendingRestoredOnReload: true, pendingDeleteShieldsStaleHydration: true,
      automaticReconnectRetriesExactlyOnce: true,
      guestDataPreservedAndNeverUploaded: true, accountScopedRestoration: true, dossierProgressKeptLocal: true,
      timeoutCoveredHere: false, pass: true });
  } finally {
    result.calls = calls; result.errors = errors; result.unexpectedRequests = unexpectedRequests;
    for (const complete of pending.values()) complete({ data: null, error: { message: 'fixture cleanup' } });
    await context.close();
    const filename = testInfo.outputPath('reading-library-result.json');
    await fs.writeFile(filename, JSON.stringify(result, null, 2) + '\n');
    await testInfo.attach('reading-library-result', { contentType: 'application/json', path: filename });
  }
});
