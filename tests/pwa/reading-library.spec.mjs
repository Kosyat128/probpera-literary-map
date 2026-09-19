import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium, expect, test } from '@playwright/test';

const SITE = 'https://reading-library.test';
const FIRST = '11111111-1111-4111-8111-111111111111';
const SECOND = '22222222-2222-4222-8222-222222222222';
const book = suffix => ({ id: 'fixture:writer:' + suffix, kind: 'book', title: 'Fixture ' + suffix,
  sectionId: 'books', sectionLabel: 'Books', href: '/books/fixture-' + suffix + '/' });
const GUEST_BOOK = book('guest'), FIRST_BOOK = book('first'), SECOND_BOOK = book('second');
const DOSSIER = { anchor: { sectionId: 'during', blockId: 'chapter-1', dossierVersion: 'fixture-v1',
  locale: 'ru', readingMode: 'DURING_READING' }, pageId: 'page-2', updatedAt: '2026-09-19T18:00:00.000Z' };

// Actual React StrictMode and localStorage. The transport deliberately performs
// work only when its thenable is consumed, matching installed PostgREST behavior.
// Constructing and discarding a mutation builder cannot make this fixture pass.
test('reading library executes explicit mutations once and isolates local intent from late remote accounts', async ({}, testInfo) => {
  const bundle = await build({ stdin: { resolveDir: fileURLToPath(new URL('../../', import.meta.url)), loader: 'jsx', contents: `
    import React,{useState}from'react';import{createRoot}from'react-dom/client';
    import{useReadingLibrary}from'./src/hooks/useReadingLibrary';
    const root=createRoot(document.getElementById('root'));
    function Library(){const[,render]=useState(0),library=useReadingLibrary();
      window.__library={snapshot:()=>library.items,configure:(auth,candidate)=>{
        window.__libraryAuth=auth;window.__candidate=candidate;render(value=>value+1)},unmount:()=>root.unmount()};
      return <main><h1>Reading library fixture</h1><output data-subject>{window.__libraryAuth.user?.id??'guest'}</output>
        <button onClick={()=>library.toggle(window.__candidate)}>Toggle candidate</button>
        <button onClick={()=>library.setStatus(window.__candidate.id,'book','reading')}>Start reading</button>
        <button onClick={()=>{void library.remove(window.__candidate.id,'book')}}>Remove candidate</button>
        <button onClick={()=>library.setDossierProgress(window.__candidate.id,window.__dossier)}>Keep dossier page</button>
        <ul>{library.items.map(item=><li key={item.kind+':'+item.id} data-library-item={item.id}>{item.title}: {item.status}</li>)}</ul></main>}
    root.render(<React.StrictMode><Library/></React.StrictMode>);
  ` }, bundle: true, write: false, format: 'iife', platform: 'browser', target: 'es2022', jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"development"' }, logLevel: 'silent',
    plugins: [{ name: 'controlled-library-auth-and-lazy-transport', setup(builder) {
      builder.onResolve({ filter: /(?:AuthContext|supabase)$/ }, args => !args.path.startsWith('.') ? undefined
        : { path: args.path.endsWith('AuthContext') ? 'auth' : 'transport', namespace: 'library-fixture' });
      builder.onLoad({ filter: /.*/, namespace: 'library-fixture' }, args => ({ loader: 'js', contents: args.path === 'auth'
        ? 'export const useAuth=()=>window.__libraryAuth;'
        : 'export const supabase={from:table=>window.__remote.from(table)};' }));
    } }],
  });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => route.request().url() === SITE + '/'
    ? route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="en"><head><title>Reading library fixture</title></head><body><div id="root"></div></body></html>' })
    : route.abort());
  const result = { sourceFixture: true, actualReactStrictModeAndLocalStorage: true, remoteTransportStubbed: true,
    lazyThenableTransport: true, installedNative: false, releaseReady: false, pass: false };
  const snapshot = () => page.evaluate(() => window.__library.snapshot());
  const calls = () => page.evaluate(() => window.__remote.calls());
  const writes = async () => (await calls()).filter(call => call.operation !== 'select');
  async function configure(configured, subject, candidate) {
    await page.evaluate(({ auth, candidate }) => window.__library.configure(auth, candidate),
      { auth: { configured, user: subject ? { id: subject } : null }, candidate });
    await expect(page.locator('[data-subject]')).toHaveText(subject ?? 'guest');
  }
  try {
    await page.goto(SITE + '/');
    await page.evaluate(({ guest, dossier }) => {
      window.__libraryAuth = { configured: false, user: null }; window.__candidate = guest; window.__dossier = dossier;
      localStorage.setItem('probpera-reading-library', JSON.stringify([{ ...guest, status: 'saved',
        addedAt: '2026-09-19T17:00:00.000Z', dossierProgress: dossier }]));
      const calls = [], signals = new Map(), pending = new Map();
      window.__remote = {
        holdNextMutation: false,
        calls: () => calls.map(call => ({ ...JSON.parse(JSON.stringify(call)), aborted: signals.get(call.id)?.aborted ?? false })),
        resolve(id, data = null, error = null) {
          const settle = pending.get(id); if (!settle) throw Error('Unknown library request ' + id);
          pending.delete(id); settle({ data, error });
        },
        from(table) {
          const state = { operation: 'select', filters: {}, value: null, options: null, signal: null };
          return {
            select(columns) { state.operation = 'select'; state.columns = columns; return this; },
            upsert(value, options) { state.operation = 'upsert'; state.value = value; state.options = options; return this; },
            update(value) { state.operation = 'update'; state.value = value; return this; },
            delete() { state.operation = 'delete'; return this; },
            eq(field, value) { state.filters[field] = value; return this; },
            order() { return this; }, limit() { return this; },
            abortSignal(signal) { state.signal = signal; return this; },
            then(resolve, reject) {
              // No method above starts work. Each consumption represents the
              // actual request, so duplicate StrictMode effects are observable.
              const id = calls.length + 1;
              calls.push({ id, table, operation: state.operation, filters: { ...state.filters },
                value: JSON.parse(JSON.stringify(state.value)), options: state.options });
              signals.set(id, state.signal);
              const hold = state.operation === 'select' || window.__remote.holdNextMutation;
              if (state.operation !== 'select') window.__remote.holdNextMutation = false;
              const request = hold ? new Promise(settle => pending.set(id, settle)) : Promise.resolve({ data: null, error: null });
              return request.then(resolve, reject);
            },
          };
        },
      };
    }, { guest: GUEST_BOOK, dossier: DOSSIER });
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    await expect(page.locator('[data-library-item]')).toHaveCount(1);
    expect(await snapshot()).toEqual([expect.objectContaining({ ...GUEST_BOOK, dossierProgress: DOSSIER })]);
    expect(await calls()).toEqual([]);
    await configure(true, FIRST, FIRST_BOOK);
    await expect(page.locator('[data-library-item]')).toHaveCount(0);
    await expect.poll(async () => (await calls()).filter(call => call.operation === 'select' && call.filters.user_id === FIRST && !call.aborted).length).toBeGreaterThan(0);
    const initialRead = (await calls()).filter(call => call.operation === 'select' && call.filters.user_id === FIRST && !call.aborted).at(-1);
    await page.getByRole('button', { name: 'Toggle candidate', exact: true }).click();
    await expect(page.locator('[data-library-item]')).toHaveCount(1);
    await expect.poll(async () => (await writes()).length).toBe(1);
    expect((await writes())[0]).toMatchObject({ operation: 'upsert', value: { user_id: FIRST, item_id: FIRST_BOOK.id, reading_status: 'saved' } });
    await page.getByRole('button', { name: 'Keep dossier page', exact: true }).click();
    expect((await snapshot())[0].dossierProgress).toEqual(DOSSIER);
    expect(await writes()).toHaveLength(1);
    await page.getByRole('button', { name: 'Start reading', exact: true }).click();
    await expect(page.locator('[data-library-item]')).toContainText('reading');
    await expect.poll(async () => (await writes()).length).toBe(2);
    expect((await writes())[1].value).toMatchObject({ reading_status: 'reading' });
    expect((await snapshot())[0].dossierProgress).toEqual(DOSSIER);
    await page.getByRole('button', { name: 'Remove candidate', exact: true }).click();
    await expect(page.locator('[data-library-item]')).toHaveCount(0);
    await expect.poll(async () => (await writes()).length).toBe(3);
    expect((await writes())[2]).toMatchObject({ operation: 'delete', filters: { user_id: FIRST, item_type: 'book', item_id: FIRST_BOOK.id } });
    await page.evaluate(async ({ id, item }) => {
      window.__remote.resolve(id, [{ item_type: item.kind, item_id: item.id, title: item.title,
        section_id: item.sectionId, section_label: item.sectionLabel, href: item.href,
        added_at: new Date().toISOString(), reading_status: 'saved' }]);
      await new Promise(resolve => setTimeout(resolve, 0));
    }, { id: initialRead.id, item: FIRST_BOOK });
    await expect(page.locator('[data-library-item]')).toHaveCount(0);
    expect(await snapshot()).toEqual([]); expect(await writes()).toHaveLength(3);
    // A pending failure belongs to the old account; it cannot roll a removed
    // item back into the next account's list or persistent storage.
    await page.getByRole('button', { name: 'Toggle candidate', exact: true }).click();
    await expect.poll(async () => (await writes()).length).toBe(4);
    await page.evaluate(() => { window.__remote.holdNextMutation = true; });
    await page.getByRole('button', { name: 'Remove candidate', exact: true }).click();
    await expect.poll(async () => (await writes()).length).toBe(5);
    const delayedDelete = (await writes()).at(-1);
    await configure(true, SECOND, SECOND_BOOK);
    await expect(page.locator('[data-library-item]')).toHaveCount(0);
    await page.getByRole('button', { name: 'Toggle candidate', exact: true }).click();
    await expect.poll(async () => (await writes()).length).toBe(6);
    await expect(page.locator('[data-library-item]')).toHaveAttribute('data-library-item', SECOND_BOOK.id);
    await page.evaluate(async id => {
      window.__remote.resolve(id, null, { message: 'fixture delayed account failure' });
      await new Promise(resolve => setTimeout(resolve, 0));
    }, delayedDelete.id);
    expect((await snapshot()).map(item => item.id)).toEqual([SECOND_BOOK.id]);
    expect(await writes()).toHaveLength(6);
    const accountWrites = await writes();
    expect(accountWrites.filter(call => call.value?.user_id === SECOND)).toHaveLength(1);
    expect(JSON.stringify(accountWrites)).not.toContain('dossierProgress');
    expect(JSON.stringify(accountWrites)).not.toContain('dossierVersion');
    expect(JSON.stringify(accountWrites)).not.toContain(GUEST_BOOK.id);
    await configure(false, null, GUEST_BOOK);
    expect(await snapshot()).toEqual([expect.objectContaining({ ...GUEST_BOOK, dossierProgress: DOSSIER, status: 'saved' })]);
    const beforeGuestEdit = await calls();
    await page.getByRole('button', { name: 'Start reading', exact: true }).click();
    await expect(page.locator('[data-library-item]')).toContainText('reading');
    expect((await snapshot())[0].dossierProgress).toEqual(DOSSIER);
    expect(await calls()).toHaveLength(beforeGuestEdit.length);
    await configure(true, SECOND, SECOND_BOOK);
    expect((await snapshot()).map(item => item.id)).toEqual([SECOND_BOOK.id]);
    expect(errors).toEqual([]);
    Object.assign(result, { calls: await calls(), strictModeMutationsExecutedOnce: true,
      lateHydrationCannotResurrectRemovedItem: true, lateAccountFailureCannotRollbackIntoAnotherAccount: true,
      guestDataPreservedAndNeverUploaded: true, accountScopedRestoration: true, dossierProgressKeptLocal: true, pass: true });
  } finally {
    await browser.close();
    await testInfo.attach('reading-library-result', { contentType: 'application/json', body: JSON.stringify(result, null, 2) });
  }
});
