import { test, expect, chromium } from '@playwright/test';
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Actual archive, public dossier hook, reader, native dialog and reading library.
// Synthetic workflow attestations are test data, never production approvals.
// Auth, public transport and physical page measurement are controlled boundaries.
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SITE = 'https://dossier-character-archive.test', BOOK = 'test:writer:book';
const LIBRARY = 'probpera-reading-library';
const digest = value => createHash('sha256').update(value).digest('hex');
let script, css, mentionIndex, sourceInputs, sourceGraph;

test.beforeAll(async () => {
  test.setTimeout(120_000);
  mentionIndex = await fs.readFile(path.join(ROOT, 'public/articles/book-mentions.json'), 'utf8');
  const result = await build({ absWorkingDir: ROOT, stdin: { resolveDir: ROOT, loader: 'jsx', contents: `
    import React,{useCallback,useRef,useState} from 'react';import{createRoot}from'react-dom/client';
    import{InterfaceLanguageProvider}from'./src/i18n/InterfaceLanguage';
    import BookArchiveSection from'./src/components/BookArchiveSection';
    import{isPublicBook}from'./src/data/bookQuality';
    import{createBookDossierGraphFixture}from'./scripts/lib/book-dossier-graph-fixture';
    import{parsePublishedBookDossier}from'./src/books/bookDossierDelivery';
    import{createBookDossierCharacterViewToken}from'./src/books/bookDossierCharacterView';
    import './src/styles/book-dossier.css';
    const source='https://example.org/synthetic-book';
    const prose={ru:'Это синтетическая карточка для локальной проверки запроса персонажа в интерфейсе книжного досье. Она не описывает настоящее произведение и не является опубликованным редакционным материалом.',
      en:'This synthetic record supports a local interface check of an explicit character request in a book dossier. It describes no real literary work and is not published editorial material.'};
    const writer={id:'writer',name:'Тестовый автор',fullName:'Тестовый автор',works:[]};
    const country={id:'test',name:'Тестовая страна',code:'ZZ',writers:[writer],coordinates:{lat:0,lng:0}};
    const book={id:'book',title:'Тестовая книга',description:prose.ru,editorial:{status:'reviewed',reviewedAt:'2026-09-20'},
      translations:Object.fromEntries(['ru','en'].map(locale=>[locale,{locale,title:locale==='ru'?'Тестовая книга':'Synthetic book',
        description:prose[locale],sourceLanguage:locale,status:'reviewed',sourceUrls:[source],method:'editorial-original',reviewedAt:'2026-09-20'}])),
      sources:[{provider:'Synthetic test source',url:source,fields:['identity','title','description'],usage:'reference-only',retrievedAt:'2026-09-20'}],
      countryId:country.id,countryName:country.name,writerId:writer.id,writerName:writer.name,writer,country};
    if(!isPublicBook(book))throw Error('Invalid synthetic public book fixture');
    const books=[book],countries=[country],noop=()=>{};
    createBookDossierGraphFixture({now:Date.now()}).then(({document:dossier})=>{
      window.__characterSource=dossier;
      window.__characterTransport=async options=>{
        window.__characterTransportCalls.push({bookKey:options.bookKey,locale:options.locale,mode:options.mode,
          revealSpoilers:options.revealSpoilers,reachedItemIds:[...options.reachedItemIds]});
        if(!window.__characterPublished || options.bookKey!==dossier.bookKey || options.locale!==dossier.locale
          || options.mode!==dossier.readingMode)return null;
        return parsePublishedBookDossier({...dossier,validUntil:new Date(Date.now()+60_000).toISOString()});
      };
      function Harness(){
        const [request,setRequest]=useState(null),[generation,setGeneration]=useState(0),[panel,setPanel]=useState(true);
        const [requestedBook,setRequestedBook]=useState(book);
        const issued=useRef(null),allowed=useRef(true),receipt=useRef(null),published=useRef(null),detail=useRef(null),back=useRef(null);
        const handleBook=useCallback(()=>setRequestedBook(null),[]);
        const recordDetail=useCallback(view=>{detail.current=view;},[]);
        const recordPublished=useCallback(view=>{published.current=view;},[]);
        const recordCharacter=useCallback(view=>{
          receipt.current=view;
          window.__characterReceipts.push(view?{bookKey:view.bookKey,cacheKey:view.cacheKey,anchor:view.anchor,
            matchesIssuedToken:view.token===issued.current?.token}:null);
        },[]);
        const valid=useCallback(value=>allowed.current&&value.token===issued.current?.token,[]);
        const registerBack=useCallback(handler=>{back.current=handler;return()=>{if(back.current===handler)back.current=null;};},[]);
        const issue=()=>{
          const current=published.current?.document||window.__characterSource;
          const page=current.pages.find(page=>page.sectionId==='graph-context'),block=page.blocks.find(block=>block.id==='graph-guests');
          const value=Object.freeze({token:createBookDossierCharacterViewToken(),bookKey:current.bookKey,cacheKey:current.cacheKey,
            anchor:Object.freeze({...block.anchor,itemId:'character-c'})});
          issued.current=value;setRequest(value);
        };
        window.__characterArchive={snapshot:()=>({generation,panel,request:!!request,detail:detail.current,
          published:published.current?{bookKey:published.current.bookKey,hasDocument:!!published.current.document,
            validUntil:published.current.document?.validUntil??null,detail:published.current.detail}:null,
          receipt:receipt.current?{bookKey:receipt.current.bookKey,anchor:receipt.current.anchor,matchesIssuedToken:receipt.current.token===issued.current?.token}:null}),
          back:()=>back.current?.()??false,remount:()=>{setRequestedBook(book);setGeneration(value=>value+1);},
          panel:setPanel,revoke:()=>{allowed.current=false;setPanel(value=>value);setRequest(value=>value?{...value}:value);}};
        const observe=!window.__characterConfig.lateObservers||!!request;
        return <><nav className="qa-character-actions" aria-label="Synthetic caller">
          <button data-character-issue onClick={issue}>Open requested character</button>
          <button data-character-remount onClick={()=>window.__characterArchive.remount()}>Remount archive</button>
        </nav><BookArchiveSection key={generation} books={books} countries={countries} onBookSelect={noop}
          embeddedInPlanet requestedBook={requestedBook} onRequestedBookHandled={handleBook}
          nativePanelActive={panel} registerNativeBack={registerBack} onDetailViewChange={recordDetail}
          dossierCharacterRequest={request} canPresentDossierCharacter={valid}
          onPublishedDossierViewChange={observe?recordPublished:undefined}
          onDossierCharacterViewChange={observe?recordCharacter:undefined}/></>;
      }
      createRoot(document.getElementById('root')).render(<InterfaceLanguageProvider><Harness/></InterfaceLanguageProvider>);
    }).catch(error=>{window.__characterFixtureError=String(error?.stack||error)});
  ` }, bundle: true, write: false, metafile: true, format: 'iife', platform: 'browser', target: 'es2020', jsx: 'automatic',
    outdir: path.join(ROOT, '.tmp/book-dossier-character-archive-memory'), publicPath: '/fixture/', logLevel: 'silent',
    define: { 'process.env.NODE_ENV': '"development"', 'import.meta.env': JSON.stringify({ BASE_URL: '/', DEV: false, PROD: true,
      VITE_SUPABASE_URL: 'https://synthetic-dossier.invalid', VITE_SUPABASE_PUBLISHABLE_KEY: 'synthetic-public-test-key', VITE_TURNSTILE_SITE_KEY: '' }),
      __LITERARY_PLANET_EDITION__: '"site"', __LITERARY_PLANET_LOCAL_QA__: 'false',
      __LITERARY_PLANET_LICENSE_AUTHORITY__: 'null', __YANDEX_METRIKA_COUNTER_ID__: '""' },
    loader: { '.css': 'css', '.png': 'file', '.webp': 'file', '.avif': 'file', '.jpg': 'file', '.jpeg': 'file', '.svg': 'file', '.woff': 'file', '.woff2': 'file' },
    plugins: [{ name: 'character-archive-controlled-boundaries', setup(builder) {
      builder.onResolve({ filter: /(?:^|\/)AuthContext$/ }, () => ({ path: 'auth', namespace: 'character-archive' }));
      builder.onResolve({ filter: /bookDossierPublicClient$/ }, args =>
        args.importer.replaceAll('\\', '/').endsWith('/src/books/usePublishedBookDossier.ts')
          ? { path: 'transport', namespace: 'character-archive' } : undefined);
      builder.onResolve({ filter: /bookInspectionPageLayout$/ }, args =>
        args.importer.replaceAll('\\', '/').endsWith('/src/components/BookArchiveSection.tsx')
          ? { path: 'pagination', namespace: 'character-archive' } : undefined);
      builder.onLoad({ filter: /.*/, namespace: 'character-archive' }, args => ({ resolveDir: ROOT, loader: 'js', contents:
        args.path === 'auth' ? "export const useAuth=()=>({configured:false,user:null,loading:false,session:null,role:'reader',displayName:'Synthetic fixture'});"
          : args.path === 'transport' ? 'export const fetchPublishedBookDossier=options=>window.__characterTransport(options);'
            : 'export const paginateBookInspectionDocument=async source=>({status:"ready",document:source,sourceDocument:source,issues:[]});' }));
      builder.onLoad({ filter: /[\\/]BookShelfScene\.tsx$/ }, async args => {
        const source = await fs.readFile(args.path, 'utf8'), attempts = [];
        const contents = source.replace(/import\.meta\.glob<\s*ComponentType<BookShelfSceneCanvasProps>\s*>\("\.\/BookShelfSceneCanvas\.tsx",\s*\{\s*import: "default",\s*query: \{ stage5Load: "(primary|retry)" \},\s*\}\)/gu, (_match, attempt) => {
          attempts.push(attempt); return `({"./BookShelfSceneCanvas.tsx":()=>import("./BookShelfSceneCanvas.tsx?stage5Load=${attempt}").then(module=>module.default)})`;
        });
        if (attempts.join(',') !== 'primary,retry' || contents.includes('import.meta.glob')) throw Error('Review changed Vite shelf imports');
        return { contents, loader: 'tsx', resolveDir: path.dirname(args.path) };
      });
      builder.onResolve({ filter: /BookShelfSceneCanvas\.tsx\?stage5Load=(primary|retry)$/ }, args => {
        const [filename, query] = args.path.split('?'); return { path: path.resolve(args.resolveDir, filename), suffix: '?' + query };
      });
      builder.onResolve({ filter: /^\// }, args => args.kind === 'url-token' ? { path: args.path, external: true } : undefined);
    } }],
  });
  const graph = Object.keys(result.metafile.inputs).map(value => value.replaceAll('\\', '/'));
  sourceGraph = graph;
  for (const source of ['src/components/BookArchiveSection.tsx', 'src/components/BookDossierReader.tsx',
    'src/components/BookDossierMap.tsx', 'src/books/bookDossierCharacterView.ts', 'src/books/usePublishedBookDossier.ts',
    'src/books/bookDossierDelivery.ts', 'src/books/bookDossierCompiler.ts', 'src/hooks/useReadingLibrary.ts']) expect(graph).toContain(source);
  const virtualInputs = new Set(['<stdin>', '<define:import.meta.env>',
    'character-archive:auth', 'character-archive:transport', 'character-archive:pagination']);
  const sourcePaths = [...new Set(graph.filter(value => !value.includes('node_modules/') && !virtualInputs.has(value))
    .map(value => value.replace(/\?stage5Load=(primary|retry)$/u, '')))];
  sourceInputs = await Promise.all(sourcePaths.map(async value => {
    // Only named virtual inputs are excluded. A missing genuine source fails;
    // shelf query variants retain their actual file in the captured inventory.
    const filename = await fs.realpath(path.resolve(ROOT, value));
    if (!(await fs.stat(filename)).isFile()) throw Error(`Source input is not a file: ${value}`);
    return { path: value, sha256: digest(await fs.readFile(filename)) };
  }));
  script = result.outputFiles.find(file => file.path.endsWith('.js')).text;
  css = result.outputFiles.find(file => file.path.endsWith('.css')).text;
});

async function open(testInfo, { published = true, lateObservers = false } = {}) {
  const profileRoot = path.resolve(process.env.S11_BROWSER_PROFILE_ROOT ?? path.join(ROOT, '.tmp/s11-content-browser'));
  await fs.mkdir(profileRoot, { recursive: true });
  const profile = await fs.mkdtemp(path.join(profileRoot, 'character-archive-'));
  const context = await chromium.launchPersistentContext(profile, { channel: 'chrome', headless: true,
    viewport: { width: 1100, height: 850 }, reducedMotion: 'reduce' });
  const page = await context.newPage(), errors = [], remoteRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    const url = route.request().url();
    if (url === SITE + '/ru/') return route.fulfill({ contentType: 'text/html', body:
      '<!doctype html><html lang="ru" data-route-language="ru"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:20px;font-family:system-ui"><div id="root"></div></body></html>' });
    if (url === SITE + '/articles/book-mentions.json') return route.fulfill({ contentType: 'application/json', body: mentionIndex });
    if (['fetch', 'xhr', 'websocket'].includes(route.request().resourceType())) remoteRequests.push(url);
    return route.abort();
  });
  const evidence = { sourceFixture: true, sourceInputs, sourceGraph, actualArchiveReaderMapAndLibrary: true,
    syntheticPublicationWorkflow: true, controlledAuthTransportAndPhysicalMeasurement: true,
    actualAppJourneyWiring: false, realCmsApproval: false, deviceAcceptance: false, releaseReady: false, pass: false };
  try {
    await page.goto(SITE + '/ru/'); await page.addStyleTag({ content: css + '\n.qa-character-actions{position:fixed;top:0;right:0;z-index:10000;background:white;padding:8px;display:flex;gap:8px}.qa-character-actions button{min-height:44px}body{padding-top:65px}' });
    await page.evaluate(({ published, lateObservers, key, book }) => {
      localStorage.setItem('probpera-interface-language', 'ru');
      localStorage.setItem(key, JSON.stringify([{ id: book, kind: 'book', title: 'Synthetic book', sectionLabel: 'QA',
        addedAt: '2026-09-20T00:00:00.000Z', status: 'saved' }]));
      window.__characterConfig = { lateObservers }; window.__characterPublished = published;
      window.__characterReceipts = []; window.__characterTransportCalls = []; window.__characterLibraryWrites = [];
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (name, value) {
        if (this === localStorage && name.startsWith(key)) window.__characterLibraryWrites.push({ key: name, value });
        return original.call(this, name, value);
      };
    }, { published, lateObservers, key: LIBRARY, book: BOOK });
    await page.addScriptTag({ content: script });
    await expect.poll(() => page.evaluate(() => window.__characterFixtureError ?? null)).toBeNull();
    await expect(page.locator('#book-archive-detail')).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.__characterArchive?.snapshot().detail?.settled)).toBe(true);
    await expect(page.locator('#books canvas')).toHaveCount(0);
    if (published) await expect(baseReader(page).locator('.book-dossier-reader__modes')).toHaveCount(1);
    await expect(baseReader(page)).toHaveAttribute('aria-busy', 'false');
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    return { page, evidence, verify() { expect(errors).toEqual([]); expect(remoteRequests).toEqual([]); evidence.pass = true; },
      async close() {
        Object.assign(evidence, await page.evaluate(() => ({ receipts: window.__characterReceipts,
          transportCalls: window.__characterTransportCalls, libraryWrites: window.__characterLibraryWrites,
          fixtureError: window.__characterFixtureError ?? null })), { pageErrors: errors, remoteRequests });
        await fs.writeFile(testInfo.outputPath('dossier-character-archive.json'), JSON.stringify(evidence, null, 2) + '\n');
        await context.close();
      } };
  } catch (error) { await context.close(); throw error; }
}
const baseReader = page => page.locator('section.book-dossier-reader');
const modal = page => page.locator('dialog.book-dossier-map-dialog');
const state = page => page.evaluate(() => window.__characterArchive.snapshot());
const reading = page => page.evaluate(key => ({ raw: localStorage.getItem(key), writes: window.__characterLibraryWrites.length }), LIBRARY);
async function readingItems(page) {
  const stored = JSON.parse((await reading(page)).raw);
  // This fixture has user:null; canonical guest storage remains an array.
  expect(Array.isArray(stored)).toBe(true);
  return stored;
}
async function issue(page) { await page.locator('[data-character-issue]').click(); }
async function expectExactReceipt(page) {
  await expect(modal(page)).toBeVisible(); await expect(modal(page)).toHaveJSProperty('open', true);
  await expect(modal(page).locator('.book-dossier-map__detail h3')).toHaveText('Персонаж В');
  await expect.poll(async () => (await state(page)).receipt).toMatchObject({ bookKey: BOOK, matchesIssuedToken: true,
    anchor: { sectionId: 'graph-context', blockId: 'graph-guests', itemId: 'character-c', dossierVersion: 'test-v1', locale: 'ru', readingMode: 'BEFORE_READING' } });
  await expect(baseReader(page).locator('[data-section]')).toHaveAttribute('data-section', 'graph-context');
}

test('archive presents a requested second-block character without reading writes and dismisses it before native book Back', async ({}, testInfo) => {
  test.setTimeout(120_000);
  const f = await open(testInfo), { page } = f;
  try {
    await expect.poll(async () => (await state(page)).published?.hasDocument).toBe(true);
    const before = await reading(page); await issue(page); await expectExactReceipt(page);
    expect(await reading(page)).toEqual(before);
    expect(await page.evaluate(() => window.__characterArchive.back())).toBe(true);
    await expect(modal(page)).toHaveCount(0); await expect(page.locator('#book-archive-detail')).toBeVisible();
    await expect.poll(async () => (await state(page)).receipt).toBeNull(); expect(await reading(page)).toEqual(before);
    await expect(baseReader(page).locator('[data-section]')).toHaveAttribute('data-section', 'identity');
    await issue(page); await expectExactReceipt(page);
    await modal(page).locator('.book-dossier-map__group').getByRole('button', { name: 'Персонаж А', exact: true }).click();
    await expect(modal(page)).toBeVisible(); await expect(modal(page)).toHaveJSProperty('open', true);
    await expect(modal(page).locator('.book-dossier-map__detail h3')).toHaveText('Персонаж А');
    await expect.poll(async () => (await state(page)).receipt).toBeNull();
    expect(await reading(page)).toEqual(before);
    const oldLease = (await state(page)).published.validUntil;
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect.poll(async () => (await state(page)).published?.validUntil).not.toBe(oldLease);
    await expect(modal(page)).toBeVisible();
    await expect(modal(page).locator('.book-dossier-map__detail h3')).toHaveText('Персонаж А');
    expect((await state(page)).receipt).toBeNull(); expect(await reading(page)).toEqual(before);
    await modal(page).getByRole('button', { name: 'Закрыть', exact: true }).click();
    await expect(modal(page)).toHaveCount(0);
    await expect(baseReader(page).locator('.book-dossier-map__preview')).toBeFocused();
    expect(await reading(page)).toEqual(before);
    expect(await page.evaluate(() => window.__characterArchive.back())).toBe(true);
    await expect(baseReader(page).locator('[data-section]')).toHaveAttribute('data-section', 'identity');
    await baseReader(page).getByRole('button', { name: 'Следующий раздел', exact: true }).click();
    await expect(baseReader(page).locator('[data-section]')).toHaveAttribute('data-section', 'why-read');
    await expect.poll(async () => (await readingItems(page)).find(item => item.id === BOOK)?.dossierProgress?.anchor.sectionId).toBe('why-read');
    await expect(modal(page)).toHaveCount(0);
    await page.locator('[data-character-remount]').click();
    await expect.poll(async () => (await state(page)).generation).toBe(1);
    await expect(baseReader(page)).toHaveAttribute('aria-busy', 'false');
    await expect(baseReader(page).locator('[data-section]')).toHaveAttribute('data-section', 'why-read');
    await expect(modal(page)).toHaveCount(0);
    Object.assign(f.evidence, { exactSecondBlockCharacter: true, requestWritesNoReadingProgress: true, nativeBackDismissesRequestedDialogFirst: true,
      manualCharacterSelectionRetainsDialogAndRevokesReceipt: true, manualCloseRetainsPreviewFocus: true,
      equivalentLeaseRenewalPreservesManualSelectionWithoutReceipt: true,
      ordinaryNavigationWritesOnlyItsOwnPage: true, consumedTokenRemountDoesNotSelectPageOrReopen: true }); f.verify();
  } finally { await f.close(); }
});

test('late archive character observation uses the already settled exact book instead of an inactive initial receipt', async ({}, testInfo) => {
  test.setTimeout(120_000);
  const f = await open(testInfo, { lateObservers: true }), { page } = f;
  try {
    expect((await state(page)).published).toBeNull();
    await expect.poll(() => page.evaluate(() => window.__characterTransportCalls.length)).toBeGreaterThan(0);
    const before = await reading(page); await issue(page); await expectExactReceipt(page);
    expect(await reading(page)).toEqual(before);
    await page.evaluate(() => window.__characterArchive.panel(false));
    await expect(modal(page)).toHaveCount(0); await expect.poll(async () => (await state(page)).receipt).toBeNull();
    await expect.poll(async () => (await state(page)).published?.hasDocument).toBe(false);
    await page.evaluate(() => window.__characterArchive.panel(true));
    await expect.poll(async () => (await state(page)).detail?.settled).toBe(true);
    await expect(modal(page)).toHaveCount(0); expect(await reading(page)).toEqual(before);
    Object.assign(f.evidence, { ordinaryObserverPredatesFirstRequest: true, lateDossierObserverCanOpen: true,
      panelHideRevokesReceipt: true, panelReturnDoesNotReplayToken: true, requestWritesNoReadingProgress: true }); f.verify();
  } finally { await f.close(); }
});

test('archive fallback cannot satisfy a character request and later publication requires a new explicit token', async ({}, testInfo) => {
  test.setTimeout(120_000);
  const f = await open(testInfo, { published: false }), { page } = f;
  try {
    await expect.poll(async () => (await state(page)).published?.hasDocument).toBe(false);
    const before = await reading(page); await issue(page);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect(modal(page)).toHaveCount(0); expect((await state(page)).receipt).toBeNull(); expect(await reading(page)).toEqual(before);
    await page.evaluate(() => { window.__characterPublished = true; document.dispatchEvent(new Event('visibilitychange')); });
    await expect.poll(async () => (await state(page)).published?.hasDocument).toBe(true);
    await expect(baseReader(page)).toHaveAttribute('aria-busy', 'false'); await expect(modal(page)).toHaveCount(0);
    const recovered = await reading(page); await issue(page); await expectExactReceipt(page); expect(await reading(page)).toEqual(recovered);
    await page.evaluate(() => window.__characterArchive.revoke());
    await expect(modal(page)).toHaveCount(0); await expect.poll(async () => (await state(page)).receipt).toBeNull();
    Object.assign(f.evidence, { fallbackDenied: true, absentSourceRequestWritesNoProgress: true,
      restoredPublishedSourceDoesNotReplayToken: true, explicitFreshTokenRequired: true, currentCallerValidatorRevokes: true }); f.verify();
  } finally { await f.close(); }
});
