import { test, expect, chromium } from '@playwright/test';
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SITE = 'https://booky-support.test';
const KEY = 'probpera-planet-composition-v1';
const BOOKY = 'probpera-booky-adult-v1';
const SEED = {schemaVersion:2,audience:'adult',visible:true,resume:null,progress:[]};
const HIDDEN = {schemaVersion:1,audience:'adult',visible:false,resume:null};
const ASSET = 'src/assets/mascots/knizhulyk-green-v1.png';
const ASSET_SHA = '44f97b5c83189ba1ddca26fd1313edc515e5008a2e92c2c694d1d57c29a2a4ed';
const BASE = { editionId: 'rand-mcnally-1887', standId: 'canonical', backgroundId: 'background.base.site-starfield' };
const CUSTOMIZATION_KEYS = new Set([KEY, 'probpera.globe-edition.v2', 'probpera.globe-style.v1',
  'probpera-planet-stand-v1', 'probpera-planet-background-v1']);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const mime = { '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.geojson': 'application/geo+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.woff': 'font/woff', '.woff2': 'font/woff2' };
let files, selectedAssets, sourceEvidence, bookChunks, primaryBookChunk, retryBookChunk;
let countryChunks, primaryCountryChunk, retryCountryChunk, componentChunks, primaryComponentChunk, retryComponentChunk;

// Actual App, source CSS and existing R3F scene. Native OS/preference bindings
// and HTTP delivery of real split chunks are controlled. Every camera movement uses real product controls or
// a Playwright pointer gesture; the fixture never assigns camera/controls state.
test.beforeAll(async () => {
  test.setTimeout(120_000);
  const output = path.join(ROOT, '.tmp/booky-support-memory');
  const built = await build({ absWorkingDir: ROOT, stdin: { resolveDir: ROOT, loader: 'ts', contents: `
    import{_roots}from'@react-three/fiber';
    import{mountHostApp}from'./src/host/mountHostApp';
    import{parseBookArchiveNavigationContext,BOOK_ARCHIVE_CONTEXT_HISTORY_STATE_KEY}from'./src/books/bookArchiveLocation';
    import{createAndroidPlatformAdapter}from'./src/platform/adapters/android/AndroidPlatformAdapter';
    const handles=[];let active=true,networkState={connected:true,connectionType:'wifi'};
    const subscribe=async(event,listener)=>{const handle={event,listener,removed:false,async remove(){handle.removed=true}};handles.push(handle);return handle};
    const bindings={core:{getPlatform:()=> 'android',isNativePlatform:()=>true,isPluginAvailable:()=>true},
      app:{getAppLanguage:async()=>({value:'ru-RU'}),getState:async()=>({isActive:active}),getLaunchUrl:async()=>undefined,addListener:subscribe},
      network:{getStatus:async()=>networkState,addListener:subscribe},
      preferences:{get:async({key})=>({value:await window.__osPreference('get',key)}),
        set:async({key,value})=>{await window.__osPreference('set',key,value,window.__bookySupportFixture.sample?.()??null)},
        remove:async({key})=>{await window.__osPreference('remove',key)}},
      browser:{open:async()=>{throw Error('External browser unavailable in this source fixture')}},appLauncher:{openUrl:async()=>({completed:false})}};
    const scenes=()=>[..._roots.entries()].map(([canvas,root])=>{const s=root.store.getState();
      return{canvas,renderer:s.gl,camera:s.camera,scene:s.scene,controls:s.controls,invalidate:s.invalidate}});
    const current=()=>scenes().find(value=>document.querySelector('#atlas')?.contains(value.canvas));
    const rounded=array=>array.map(n=>Number(n.toFixed(5)));
    const pose=root=>({position:rounded(root.camera.position.toArray()),quaternion:rounded(root.camera.quaternion.toArray()),
      zoom:root.camera.zoom,fov:root.camera.fov,target:root.controls?rounded(root.controls.target.toArray()):null});
    let original=null;
    window.__bookySupportFixture={scenes,remember:()=>{original=current()},
      historyObservation(){const serialized=history.state?.[BOOK_ARCHIVE_CONTEXT_HISTORY_STATE_KEY];return{url:location.href,context:parseBookArchiveNavigationContext(typeof serialized==='string'?serialized:null)};},
      setConnectivity(value){networkState=value;for(const handle of handles)if(!handle.removed&&handle.event==='networkStatusChange')handle.listener(value);},
      setVisible(value){active=value;for(const handle of handles)if(!handle.removed&&handle.event==='appStateChange')handle.listener({isActive:value});},
      sample(){const root=current();if(!root)return null;const stands=[],backgrounds=[],surfaces=[],mascotObjects=[];
        root.scene.traverse(object=>{if(object.name==='globe-planetka'||object.name.startsWith('planetka-')||object.name.startsWith('booky-'))mascotObjects.push(object.name);if(object.name.startsWith('included-globe-stand:'))stands.push(object);
          if(object.name.startsWith('included-globe-background:'))backgrounds.push(object);
          if(object.isMesh&&object.geometry?.type==='SphereGeometry'&&object.geometry.parameters.radius===1
            &&object.material?.isMeshPhysicalMaterial&&object.material.map?.isCanvasTexture)surfaces.push(object)});
        const surface=surfaces[0],map=surface?.material.map,gpu=map?root.renderer.properties.get(map):null;
        return{selection:{editionId:document.querySelector('#atlas .literary-globe')?.getAttribute('data-globe-edition'),
          standId:stands[0]?.userData.standId??'canonical',backgroundId:backgrounds[0]?.userData.backgroundId??'background.base.site-starfield'},
          quality:document.querySelector('#atlas .literary-globe')?.getAttribute('data-globe-quality-tier'),
          mascotObjects,backgroundResource:backgrounds[0]?.uuid??null,
          standCount:stands.length,backgroundCount:backgrounds.length,surfaceCount:surfaces.length,
          sameScene:!!original&&root.canvas===original.canvas&&root.renderer===original.renderer&&root.camera===original.camera&&root.scene===original.scene,
          pose:pose(root),url:location.href,texture:map?.uuid,geometry:surface?.geometry.uuid,
          uploaded:!!gpu?.__webglTexture&&gpu.__version===map?.version,frame:root.renderer.info.render.frame,
          gpu:{calls:root.renderer.info.render.calls,triangles:root.renderer.info.render.triangles,textures:root.renderer.info.memory.textures,geometries:root.renderer.info.memory.geometries},
          contextLost:root.renderer.getContext().isContextLost()};
      },
      async renderSample(){const root=current();if(!root)throw Error('No mounted globe renderer');
        for(let i=0;i<2;i++){root.invalidate();await new Promise(requestAnimationFrame)}return window.__bookySupportFixture.sample();},
    };
    createAndroidPlatformAdapter({bindings,channel:'dev'}).then(mountHostApp).catch(error=>{window.__bookySupportFixtureError=error.message});
  ` }, bundle: true, write: false, metafile: true, outdir: output, entryNames: 'booky-support', assetNames: 'assets/[name]-[hash]',
    publicPath: '/fixture/', format: 'esm', splitting: true, chunkNames: 'chunks/[name]-[hash]', platform: 'browser', target: 'es2020', jsx: 'automatic', logLevel: 'silent',
    define: { 'process.env.NODE_ENV': '"development"', 'import.meta.env': JSON.stringify({ BASE_URL: '/', DEV: false, PROD: true,
      VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '', VITE_TURNSTILE_SITE_KEY: '' }),
      __LITERARY_PLANET_EDITION__: '"native"', __LITERARY_PLANET_LOCAL_QA__: 'false',
      __LITERARY_PLANET_LICENSE_AUTHORITY__: 'null', __YANDEX_METRIKA_COUNTER_ID__: '""' },
    loader: { '.css': 'css', '.png': 'file', '.webp': 'file', '.avif': 'file', '.jpg': 'file', '.jpeg': 'file', '.svg': 'file', '.woff': 'file', '.woff2': 'file' },
    plugins: [{ name: 'canonical-vite-resources', setup(builder) {
      // Bounded read-only author-effect telemetry; original branches, request/token
      // identities and callbacks are retained. No corpus or request outcomes are injected.
      builder.onLoad({filter:/[\\/]BookArchiveSection\.tsx$/},async args=>{
        let contents=await fs.readFile(args.path,'utf8');
        const replaceOnce=(before,after)=>{if(contents.split(before).length!==2)throw Error('Review author trace anchor '+before);contents=contents.replace(before,after);};
        replaceOnce('    const state = authorRequestRef.current;',
          '    const state = authorRequestRef.current;'+
          '\n    const diagnosticTrace = (phase: string, extra: Record<string, unknown> = {}) => { const entries = ((window as any).__bookyAuthorTrace ??= []); entries.push(JSON.parse(JSON.stringify({ phase, id: requestedAuthor?.id ?? null, countryId: requestedAuthor?.countryId, writerId: requestedAuthor?.writerId, recovery: !!requestedAuthor?.recovery, countriesCount: countries.length, matchingCountries: countries.filter(c => c.id === requestedAuthor?.countryId).length, matchingWriters: countries.filter(c => c.id === requestedAuthor?.countryId).flatMap(c => c.writers).filter(w => w.id === requestedAuthor?.writerId).length, authorIndexCount: archiveFacetIndex.indexes.author.get(String(requestedAuthor?.countryId)+":"+String(requestedAuthor?.writerId))?.length ?? 0, nativePanelActive, requestedBook: !!requestedBook, selectedBook: !!selectedBook, selectedBookRef: !!selectedBookRef.current, shelfPhase: shelfState.phase, pending: !!state.pending, samePendingRender: state.pending?.render === authorRequestRender, committedAuthorRequestId: committedAuthorRequest?.id ?? null, sameCommittedRequest: committedAuthorRequest === state.pending?.request, pendingBookClose: !!pendingBookCloseRef.current, pendingBookSwitch: !!pendingBookSwitchRef.current, pendingInspectionBook: !!pendingInspectionBookRef.current, skipNextBookPopstate: !!skipNextBookPopstateRef.current, query, deferredQuery, searchScope, authorKey: filterState.authorKey, activeShelfId, ...extra }))); if (entries.length > 300) entries.shift(); }; diagnosticTrace("entry");');
        replaceOnce('    const settle = (result: BookArchiveAuthorRequestResult) => {','    const settle = (result: BookArchiveAuthorRequestResult) => { diagnosticTrace("settle", {result});');
        replaceOnce('    const resolved = resolveBookArchiveAuthorRequest(requestedAuthor, countries, archiveFacetIndex.indexes.author);','    const resolved = resolveBookArchiveAuthorRequest(requestedAuthor, countries, archiveFacetIndex.indexes.author); diagnosticTrace("resolved", {status: resolved.status});');
        replaceOnce('if (state.waitingFilters !== null && state.waitingFilters !== filters) { settle("invalid"); return; }','if (state.waitingFilters !== null && state.waitingFilters !== filters) { diagnosticTrace("waiting-filter-mismatch", {waiting: state.waitingFilters, current: filters}); settle("invalid"); return; }');
        replaceOnce('      if (state.pending.render === authorRequestRender || committedAuthorRequest !== state.pending.request) return;', '      if (state.pending.render === authorRequestRender || committedAuthorRequest !== state.pending.request) { diagnosticTrace("pending-wait", {sameRender: state.pending.render === authorRequestRender, markerWait: committedAuthorRequest !== state.pending.request}); return; }');
        replaceOnce('// A newer local navigation/filter edit wins over a settling request.','// A newer local navigation/filter edit wins over a settling request.\n        diagnosticTrace("pending-mismatch", {pendingAuthor: state.pending.authorKey, pendingCountry: state.pending.request.countryId, pendingWriter: state.pending.request.writerId, recoveryViewKey: state.pending.recoveryViewKey, authorViewKey});');
        replaceOnce('      const recovery = planBookArchiveAuthorRecovery(resolved, authorViewState, authorViewToken);','      const recovery = planBookArchiveAuthorRecovery(resolved, authorViewState, authorViewToken); diagnosticTrace("recovery-plan", {accepted: !!recovery, sameToken: resolved.request.recovery?.view === authorViewToken});');
        replaceOnce('      setQuery(recovery.query); setFilterState(recovery.filterState); setSearchScope("library");','      diagnosticTrace("recovery-dispatch"); setQuery(recovery.query); setFilterState(recovery.filterState); setSearchScope("library");');
        replaceOnce('    activateGlobalSearchAction({ type: "select-writer", authorKey: resolved.authorKey,','    diagnosticTrace("ordinary-dispatch", {resolvedAuthorKey: resolved.authorKey}); activateGlobalSearchAction({ type: "select-writer", authorKey: resolved.authorKey,');
        replaceOnce('      || shelfState.phase === "SHELF_RESTORING") return;', '      || shelfState.phase === "SHELF_RESTORING") { diagnosticTrace("reader-defer", {readerBookKey: selectedBookRef.current ? bookKey(selectedBookRef.current) : null, recoveryViewKey: authorViewKey}); return; }');
        // Transparent committed reader-view telemetry; original callback/view and
        // all private clipping/ownership guards are forwarded once unchanged.
        replaceOnce('    onDetailViewChangeRef.current?.(view);',
          '    const readerTrace = ((window as any).__bookyReaderTrace ??= []); const readerDetail = document.querySelector("#book-archive-detail"); const readerOwner = readerDetail?.closest(".native-planet-panel__content") as HTMLElement | null; readerTrace.push({time:performance.now(),view:{...view},helpOpen:!!document.querySelector("[data-planet-mascot-panel]"),focusInReader:!!readerDetail?.contains(document.activeElement),focusOnBookyToggle:!!document.activeElement?.matches("[data-planet-mascot-toggle]"),scrollTop:readerOwner?.scrollTop??null,clientHeight:readerOwner?.clientHeight??null,scrollHeight:readerOwner?.scrollHeight??null,url:location.href}); if(readerTrace.length>160)readerTrace.shift();\n    onDetailViewChangeRef.current?.(view);');
        return {contents,loader:'tsx',resolveDir:path.dirname(args.path)};
      });
      builder.onLoad({ filter: /[\\/]BookShelfScene\.tsx$/ }, async args => {
        const source = await fs.readFile(args.path, 'utf8'), attempts = [];
        const contents = source.replace(/import\.meta\.glob<\s*ComponentType<BookShelfSceneCanvasProps>\s*>\("\.\/BookShelfSceneCanvas\.tsx",\s*\{\s*import: "default",\s*query: \{ stage5Load: "(primary|retry)" \},\s*\}\)/gu, (_match, attempt) => {
          attempts.push(attempt); return `({"./BookShelfSceneCanvas.tsx":()=>import("./BookShelfSceneCanvas.tsx?stage5Load=${attempt}").then(module=>module.default)})`;
        });
        if (attempts.join(',') !== 'primary,retry' || contents.includes('import.meta.glob')) throw Error('Review changed canonical Vite glob imports');
        return { contents, loader: 'tsx', resolveDir: path.dirname(args.path) };
      });
      builder.onResolve({ filter: /BookShelfSceneCanvas\.tsx\?stage5Load=(primary|retry)$/ }, args => {
        const [filename, query] = args.path.split('?'); return { path: path.resolve(args.resolveDir, filename), suffix: '?' + query };
      });
      builder.onLoad({ filter: /[\\/](?:bookArchiveRuntime\.ts|App\.tsx|DeferredHomepageArchives\.tsx)$/ }, async args => {
        const source = await fs.readFile(args.path, 'utf8'); let replacements = 0;
        const expected = args.path.endsWith('bookArchiveRuntime.ts') ? ['../planet/books', '../planet/books.ts']
          : args.path.endsWith('DeferredHomepageArchives.tsx') ? ['../components/BookArchiveSection', '../components/BookArchiveSection.tsx']
          : ['./planet/catalog', './planet/catalog.ts'];
        const contents = source.replace(/import\.meta\.glob<\s*typeof import\("([^"]+)"\)\s*>\(\s*"([^"]+)",\s*\{\s*query:\s*\{\s*stage5Load:\s*"retry"\s*\},?\s*\},?\s*\)/gu, (_match, module, glob) => {
          if (module !== expected[0] || glob !== expected[1]) throw Error('Unexpected canonical retry glob in ' + args.path);
          replacements++;
          return `({${JSON.stringify(glob)}:()=>import(${JSON.stringify(glob + '?stage5Load=retry')})})`;
        });
        if (replacements !== 1 || contents.includes('import.meta.glob')) throw Error('Review changed canonical Vite retry glob in ' + args.path);
        return { contents, loader: args.path.endsWith('.tsx') ? 'tsx' : 'ts', resolveDir: path.dirname(args.path) };
      });
      builder.onResolve({ filter: /(?:books\.ts|catalog\.ts|BookArchiveSection\.tsx)\?stage5Load=retry$/ }, args => {
        const [filename, query] = args.path.split('?'); return { path: path.resolve(args.resolveDir, filename), suffix: '?' + query };
      });
      builder.onResolve({ filter: /^\// }, args => args.kind === 'url-token' ? { path: args.path, external: true } : undefined);
      builder.onResolve({ filter: /\.geojson\?url$/ }, args => ({ path: path.resolve(args.resolveDir, args.path.slice(0, -4)), namespace: 'canonical-geojson-url' }));
      builder.onLoad({ filter: /.*/, namespace: 'canonical-geojson-url' }, async args => ({ contents: await fs.readFile(args.path), loader: 'file' }));
    } }],
  });
  const outputs = Object.entries(built.metafile.outputs);
  const fixtureUrl = filename => '/fixture/' + path.relative(output, path.resolve(ROOT, filename)).replaceAll('\\', '/');
  const entriesFor = source => {
    const entries = outputs.filter(([_filename, value]) => [source, source + '?stage5Load=retry'].includes(value.entryPoint?.replaceAll('\\', '/')));
    const primary = entries.find(([_filename, value]) => value.entryPoint === source);
    const retry = entries.find(([_filename, value]) => value.entryPoint === source + '?stage5Load=retry');
    expect(primary, source + ' primary entry').toBeTruthy(); expect(retry, source + ' retry entry').toBeTruthy();
    expect(entries).toHaveLength(2);
    const urls = [fixtureUrl(primary[0]), fixtureUrl(retry[0])]; expect(new Set(urls).size).toBe(2);
    return { entries, urls };
  };
  const books = entriesFor('src/planet/books.ts'), countries = entriesFor('src/planet/catalog.ts'), component = entriesFor('src/components/BookArchiveSection.tsx');
  bookChunks = books.urls; [primaryBookChunk, retryBookChunk] = bookChunks;
  countryChunks = countries.urls; [primaryCountryChunk, retryCountryChunk] = countryChunks;
  componentChunks = component.urls; [primaryComponentChunk, retryComponentChunk] = componentChunks;
  expect(new Set([...bookChunks, ...countryChunks, ...componentChunks]).size).toBe(6);
  // Every generated retry entry reaches the same physical domain/hook outputs
  // as its primary. Failed facade fetches never manufacture canonical data.
  const reaches = (from, target, visited = new Set()) => {
    if (from === target) return true;
    if (visited.has(from)) return false;
    visited.add(from);
    return (built.metafile.outputs[from]?.imports ?? []).some(value => !value.external && reaches(value.path, target, visited));
  };
  const sharedOwners = (entries, inputs) => inputs.map(input => {
    const owners = outputs.filter(([_filename, value]) => Object.hasOwn(value.inputs, input));
    expect(owners, input + ' has one canonical compiled owner').toHaveLength(1);
    for (const [entry] of entries) expect(reaches(entry, owners[0][0]), entry + ' reuses ' + input).toBe(true);
    return { input, output: fixtureUrl(owners[0][0]) };
  });
  const sharedBookDependencies = sharedOwners(books.entries, ['src/data/bookArchive.ts', 'src/data/bookArchiveQueue.ts']);
  const sharedCountryDependencies = sharedOwners(countries.entries, ['src/data/countries.ts']);
  const sharedComponentDependencies = sharedOwners(component.entries, ['src/data/bookArchive.ts', 'src/data/bookArchiveQueue.ts', 'src/hooks/useBookCollections.ts']);
  const inputs = Object.keys(built.metafile.inputs).map(value => value.replaceAll('\\', '/'));
  const assetBytes = await fs.readFile(path.join(ROOT, ASSET));
  expect(digest(assetBytes)).toBe(ASSET_SHA); expect(assetBytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect([assetBytes.readUInt32BE(16), assetBytes.readUInt32BE(20), assetBytes[25]]).toEqual([1254, 1254, 6]);
  const assetOutput = built.outputFiles.find(file => digest(file.contents) === ASSET_SHA); expect(assetOutput).toBeTruthy();
  const required = ['src/App.tsx', 'src/host/mountHostApp.tsx', 'src/components/LiteraryGlobe.tsx', 'src/components/LiteraryWorldMap.tsx',
    'src/components/GlobeCameraRig.tsx', 'src/components/globeAtlas.ts', 'src/host/planetMascot.ts', 'src/host/planetMascotRoutes.ts',
    'src/host/PlanetMascotControls.tsx', 'src/host/PlanetMascotControls.css', 'src/host/PlanetMascotAvatar.tsx', 'src/host/PlanetMascotAvatar.css',
    'src/host/bookyModel.ts', 'src/host/bookyAnimation.ts', 'src/host/useBookyRenderer.ts', 'src/host/bookySupport.ts',
    'src/host/planetMascotPreference.ts', 'src/host/planetMascotPersistence.ts', 'src/host/HostPlatformServices.ts', ASSET];
  for (const filename of required) expect(inputs).toContain(filename);
  const sourcePaths = [...new Set([...required, ...inputs.filter(value => value.startsWith('src/') && !value.includes('?')), 'tests/pwa/booky-writer-filter-recovery.spec.mjs'])].sort();
  const sourceInputs = await Promise.all(sourcePaths.map(async filename => ({ path: filename, sha256: digest(await fs.readFile(path.join(ROOT, filename))) })));
  files = new Map(built.outputFiles.map(file => ['/fixture/' + path.relative(output, file.path).replaceAll('\\', '/'), Buffer.from(file.contents)]));
  const selectionBytes = await fs.readFile(path.join(ROOT, 'scripts/mobile/native-base-assets.json'));
  selectedAssets = new Map(JSON.parse(selectionBytes).files.map(entry => {
    if (entry.source !== 'public/' + entry.output || entry.transformation !== 'none' || /(?:^|\/)\.\.(?:\/|$)|\\/u.test(entry.output)) throw Error('Invalid selected native asset');
    return ['/' + entry.output, entry];
  }));
  sourceEvidence = { externalFixtureSha256: digest(await fs.readFile(fileURLToPath(import.meta.url))), kind: 'canonical-app-booky-writer-filter-recovery-in-Chrome', actualApp: true, actualCss: true, actualGlobe: true,
    controlledPorts: ['native OS plugins and preferences backed by a Node map', 'HTTP responses for real dynamic country, book runtime and collection component chunks, with no injected transport failure', 'Native selectOption used only for initial sort and shelf setup; Booky actions and country facet use CDP trusted touch', 'Bounded read-only author effect trace: original request/recovery-token identity, branches and outcomes unchanged', 'Bounded read-only committed reader-view callback trace; callback/view forwarded once unchanged; OS motion media and viewport reflow are controlled'],
    bookChunks, primaryBookChunk, retryBookChunk, sharedBookDependencies,
    countryChunks, primaryCountryChunk, retryCountryChunk, sharedCountryDependencies,
    componentChunks, primaryComponentChunk, retryComponentChunk, sharedComponentDependencies, sourceInputs,
    cameraAuthority: 'Companion show/hide/tour steps do not own the camera. Only existing canonical App navigation owns scene changes; no fixture camera assignments.',
    representation: 'Actual-App RU/EN writer filter recovery with real catalog data. Controlled native select setup is distinct from trusted Booky touch input. The fixture expands canonical Vite globs and builds in-memory esbuild ESM chunks; this is source behavior evidence, not a dist artifact, installed-device or service-availability test.',
    fallbackArtwork: { path: ASSET, sha256: ASSET_SHA, bytes: assetBytes.length, width: 1254, height: 1254, pngColorType: 6,
      bundledPath: '/fixture/' + path.relative(output, assetOutput.path).replaceAll('\\', '/') },
    publicAssetSelectionSha256: digest(selectionBytes), selectedAssetCount: selectedAssets.size,
    builtFiles: built.outputFiles.map(file => ({ path: path.relative(output, file.path).replaceAll('\\', '/'), sha256: digest(file.contents) })),
    installedNative: false, deviceTested: false, childReviewed: false, childProfileCreated: false, childAccessGranted: false, reviewedDialogueAccepted: false, narrationEnabled: false, artAccepted: false, devicePerformanceAccepted: false, releaseReady: false };
});

async function open(testInfo, { rejectBooks = 0, rejectCountries = 0, rejectComponents = 0 } = {}) {
  const profileRoot = path.resolve(process.env.S15_BROWSER_PROFILE_ROOT ?? path.join(ROOT, '.tmp/s15-booky-live'));
  await fs.mkdir(profileRoot, { recursive: true }); const profile = await fs.mkdtemp(path.join(profileRoot, 'pk-'));
  const context = await chromium.launchPersistentContext(profile, { channel: process.env.S15_BROWSER_CHANNEL ?? 'chrome', headless: true,
    viewport: { width: 1440, height: 850 }, reducedMotion: 'reduce', hasTouch: true });
  const page = await context.newPage(); page.setDefaultTimeout(12_000);
  const initialRecord = JSON.stringify({ schemaVersion: 1, commitId: 'booky-support-fixture:1', selection: BASE });
  const memory = new Map([['probpera-interface-language', 'ru'], ['probpera-planet-welcome-v1', 'completed'], [KEY, initialRecord], [BOOKY, JSON.stringify(SEED)]]);
  const operations = [], errors = [], externalRequests = [], missingResources = [];
  const bookRequests = [], countryRequests = [], componentRequests = [], controlledFailures = [];
  const failuresRemaining = { books: rejectBooks, countries: rejectCountries, component: rejectComponents };
  const result = { ...sourceEvidence, pass: false, observations: {}, screenshots: [] };
  page.on('pageerror', error => errors.push(error.message));
  await page.exposeBinding('__osPreference', (_source, operation, key, value, observed) => {
    const entry={ operation, key, ...(value === undefined ? {} : { value }), ...(observed ? { observed } : {}) };operations.push(entry);
    if (operation === 'get') {
      const stored=memory.get(key)??null;if(key===BOOKY)entry.result=stored;return stored;
    }
    if (operation === 'set') {
      memory.set(key, value);return;
    }
    if (operation === 'remove') { memory.delete(key); return; }
    throw Error('Unknown native preference fixture operation');
  });
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== SITE) { externalRequests.push(url.href); await route.abort(); return; }
    if (route.request().resourceType() === 'document' && url.pathname === '/') {
      await route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="/fixture/booky-support.css"></head><body><div id="root"></div><script type="module" src="/fixture/booky-support.js"></script></body></html>' }); return;
    }
    const pathname = decodeURIComponent(url.pathname);
    const target = bookChunks.includes(pathname) ? 'books' : countryChunks.includes(pathname) ? 'countries'
      : componentChunks.includes(pathname) ? 'component' : null;
    if (target) {
      ({ books: bookRequests, countries: countryRequests, component: componentRequests })[target].push(pathname);
      if (failuresRemaining[target] > 0) { failuresRemaining[target]--; controlledFailures.push({ path: pathname, status: 503 });
        await route.fulfill({ status: 503, contentType: 'text/plain', body: 'Controlled chunk transport failure' }); return; }
    }
    if (!files.has(pathname) && selectedAssets.has(pathname)) {
      const entry = selectedAssets.get(pathname), filename = path.resolve(ROOT, entry.source);
      if (await fs.realpath(filename) !== filename) throw Error('Linked selected asset');
      const bytes = await fs.readFile(filename); if (digest(bytes) !== entry.sourceSha256) throw Error('Stale selected fixture asset: ' + entry.output);
      files.set(pathname, bytes);
    }
    const bytes = files.get(pathname);
    if (bytes) { await route.fulfill({ contentType: mime[path.extname(pathname)] ?? 'application/octet-stream', body: bytes }); return; }
    if (pathname !== '/favicon.ico') missingResources.push(pathname);
    await route.fulfill({ status: 404, contentType: 'text/plain', body: 'Unselected fixture asset' });
  });
  try {
    await page.goto(SITE + '/?country=russia&writer=dostoevsky#atlas');
    if (rejectCountries) {
      await expect(page.locator('.native-planet-app')).toBeVisible({ timeout: 60_000 });
      await expect(page.locator('.native-planet-launch')).toBeHidden();
      await expect(pet(page)).toHaveAttribute('data-planet-mascot-visibility', 'shown');
    } else await ready(page);
    return { page, memory, operations, result, initialRecord, bookRequests, countryRequests, componentRequests, controlledFailures,
      bookyWrites:()=>operations.filter(value=>value.operation==='set'&&value.key===BOOKY),
      writes: () => operations.filter(value => value.operation !== 'get' && CUSTOMIZATION_KEYS.has(value.key)),
      verify() { expect(errors).toEqual([]); expect(externalRequests).toEqual([]); expect(missingResources).toEqual([]);
        expect(operations.filter(value=>value.operation!=='get'&&![BOOKY,'probpera-interface-language','probpera-planet-recent-adult-v1'].includes(value.key))).toEqual([]);
        result.pass = true; },
      async close() {
        result.customizationWrites = operations.filter(value => value.operation !== 'get' && CUSTOMIZATION_KEYS.has(value.key));
        result.unexpectedPreferenceWrites = operations.filter(value => value.operation !== 'get' && ![BOOKY, 'probpera-interface-language', 'probpera-planet-recent-adult-v1'].includes(value.key));
        result.bookyWrites=operations.filter(value=>value.operation==='set'&&value.key===BOOKY);result.finalBookyPreference=JSON.parse(memory.get(BOOKY)??'null');
        result.preferenceOperations = operations; result.bookRequests = bookRequests; result.countryRequests = countryRequests;
        result.componentRequests = componentRequests; result.controlledFailures = controlledFailures;
        result.errors = errors; result.externalRequests = externalRequests; result.missingResources = missingResources;
        const filename = testInfo.outputPath('booky-writer-filter-recovery.json'); await fs.writeFile(filename, JSON.stringify(result, null, 2) + '\n');
        await testInfo.attach('booky-writer-filter-recovery-source-evidence', { path: filename, contentType: 'application/json' }); await context.close();
      } };
  } catch (error) { await context.close(); throw error; }
}
const sample = page => page.evaluate(() => window.__bookySupportFixture.sample());
const globe = page => page.locator('#atlas .literary-globe');
const pet = page => page.locator('[data-planet-mascot-pet]');
const panel = page => page.locator('[data-planet-mascot-panel]');
async function ready(page) {
  await expect(page.locator('.native-planet-app[data-planet-ready="true"]')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.native-planet-launch')).toBeHidden();
  await expect(globe(page)).toHaveAttribute('data-globe-webgl-context', 'ready');
  await expect(globe(page)).toHaveAttribute('data-globe-camera-phase', 'idle');
  await expect(page.locator('#atlas canvas')).toHaveCount(1);
  expect(await page.evaluate(() => window.__bookySupportFixtureError ?? null)).toBeNull();
}
async function actual(page) {
  let observed;
  await expect.poll(async () => { observed = await sample(page); return observed?.uploaded ? observed.selection : null; }).toEqual(BASE);
  observed = await page.evaluate(() => window.__bookySupportFixture.renderSample());
  expect(observed.surfaceCount).toBe(1); expect(observed.mascotObjects).toEqual([]);
  expect(observed.contextLost).toBe(false); expect(observed.gpu.calls).toBeGreaterThan(0);
  return observed;
}
async function stablePose(page) {
  let previous, matches = 0;
  await expect.poll(async () => { const key = JSON.stringify((await sample(page)).pose);
    matches = key === previous ? matches + 1 : 0; previous = key; return matches;
  }, { intervals: [80, 150, 250] }).toBeGreaterThanOrEqual(3);
}
function retained(current, original, samePose = true, sameRoute = true) {
  expect(current.sameScene).toBe(true); expect(current.texture).toBe(original.texture); expect(current.geometry).toBe(original.geometry);
  expect(current.backgroundResource).toBe(original.backgroundResource); expect(current.selection).toEqual(original.selection);
  if (sameRoute) expect(current.url).toBe(original.url);
  if (samePose) expect(current.pose).toEqual(original.pose);
}
async function snapshot(page) {
  return{globe:await sample(page) ? await actual(page) : null,ui:await page.evaluate(()=>{
    const pet=document.querySelector('[data-planet-mascot-pet]'),panel=document.querySelector('[data-planet-mascot-panel]');
    return{visibility:pet?.dataset.planetMascotVisibility,mode:pet?.dataset.planetMascotMode,
      route:pet?.dataset.planetMascotCurrentRoute,step:pet?.dataset.planetMascotStep,screen:pet?.dataset.planetMascotScreen,
      panelOpen:!!panel,text:panel?.textContent??'',language:document.documentElement.lang,
      support:[...document.querySelectorAll('[data-booky-support]')].map(item=>({id:item.dataset.bookySupport,text:item.textContent}))};
  })};
}
async function fitNarrow(page) {
  // Capture only after fonts and two consecutive layout samples agree. A
  // transient locale/ResizeObserver frame is not evidence of settled geometry.
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  let layout, previousGeometry, stableSamples = 0;
  await expect.poll(async()=>{
    layout=await page.evaluate(()=>{
      const bounds=element=>{const r=element.getBoundingClientRect();
        return{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
      const rect=selector=>{const element=document.querySelector(selector);return element?bounds(element):null;};
      const pet=rect('[data-planet-mascot-pet]'),panel=rect('[data-planet-mascot-panel]'),avatar=rect('[data-planet-mascot-avatar]');
      const overlaps=(a,b)=>!!a&&!!b&&Math.min(a.right,b.right)-Math.max(a.left,b.left)>.5
        &&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>.5;
      const languageButtons=[...document.querySelectorAll('.native-planet-app .interface-language-control button')]
        .filter(button=>!button.closest('[hidden], [inert], [aria-hidden="true"]')&&button.getClientRects().length
          &&getComputedStyle(button).visibility==='visible'&&getComputedStyle(button).display!=='none')
        .map(button=>{const rectangle=bounds(button),center={x:rectangle.left+rectangle.width/2,y:rectangle.top+rectangle.height/2};
          const hit=document.elementFromPoint(center.x,center.y);
          return{label:button.textContent.trim(),...rectangle,center,reachable:!!hit&&button.contains(hit),
            overlapsPet:overlaps(rectangle,pet),overlapsPanel:overlaps(rectangle,panel),
            hitTarget:hit?{tag:hit.tagName,className:typeof hit.className==='string'?hit.className:null}:null};});
      return{width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth+1,
        pet,panel,avatar,languageButtons,panelOverlapsPet:overlaps(panel,pet),panelOverlapsAvatar:overlaps(panel,avatar)};
    });
    const inside=rect=>rect&&rect.width>0&&rect.height>0&&rect.left>=-.5&&rect.top>=-.5
      &&rect.right<=layout.width+.5&&rect.bottom<=layout.height+.5;
    const valid=!layout.overflow&&!layout.panelOverlapsPet&&!layout.panelOverlapsAvatar
      &&[layout.pet,layout.panel,layout.avatar].every(inside)
      &&layout.languageButtons.length===2&&layout.languageButtons.map(button=>button.label).sort().join(',')==='EN,RU'
      &&layout.languageButtons.every(button=>inside(button)&&button.reachable&&!button.overlapsPet&&!button.overlapsPanel);
    const geometry=JSON.stringify([layout.width,layout.height,layout.pet,layout.panel,layout.avatar,
      layout.languageButtons.map(({left,top,right,bottom,width,height})=>({left,top,right,bottom,width,height}))]);
    stableSamples=valid?(geometry===previousGeometry?stableSamples+1:1):0;
    previousGeometry=valid?geometry:undefined;
    layout.stableSamples=stableSamples;
    return stableSamples>=2;
  },{intervals:[100,200,300],message:'Two stable 320px samples show pet/card without overlap, all inside the viewport, with both language controls directly clickable'}).toBe(true);
  return layout;
}

const support = page => page.locator('[data-booky-support]');
async function network(page, value) {
  const states = { online: { connected: true, connectionType: 'wifi' }, offline: { connected: false, connectionType: 'none' },
    unknown: { connected: null, connectionType: 'unknown' } };
  await page.evaluate(state => window.__bookySupportFixture.setConnectivity(state), states[value]);
  if (value === 'online') await expect(page.locator('[data-host-network-hint]')).toHaveCount(0);
  else await expect(page.locator('[data-host-connectivity]')).toHaveAttribute('data-host-connectivity', value);
}
async function locale(page, value) {
  await page.locator('.native-planet-app .interface-language-control button').filter({ hasText: new RegExp('^' + value.toUpperCase() + '$', 'u') }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', value);
}
async function capture(fixture, testInfo, filename, framing) {
  const bytes = await fixture.page.screenshot({ path: testInfo.outputPath(filename) });
  fixture.result.screenshots.push({ filename, sha256: digest(bytes), ...fixture.page.viewportSize(), framing });
}


// D201: actual App and canonical catalog. Native picker setup is controlled;
// all Booky actions/recovery and country-facet activation use trusted CDP touch.
async function writerSettle(page) {
  await page.evaluate(async () => { await document.fonts.ready; await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); });
}
async function writerControls(page) {
  return page.locator('#book-archive-advanced-filters').evaluate(drawer => ({
    author: drawer.querySelector('[data-book-author-filter]')?.value,
    sort: [...drawer.querySelectorAll('select')].find(select => !select.hasAttribute('data-book-author-filter'))?.value,
    checked: [...drawer.querySelectorAll('input[type="checkbox"]:checked')].map(input => ({group: input.closest('fieldset')?.querySelector('legend')?.textContent.trim(), label: input.closest('label')?.textContent.trim()})),
    presets: [...drawer.querySelectorAll('.book-shelf-filter-drawer__presets [aria-pressed="true"]')].map(button => button.textContent.trim()),
  }));
}
async function writerOwnedState(page) {
  return page.evaluate(async () => {
    const databases=[];
    for(const info of (await indexedDB.databases()).sort((a,b)=>a.name.localeCompare(b.name))) {
      const db=await new Promise((resolve,reject)=>{const request=indexedDB.open(info.name);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
      const stores={};
      for(const name of [...db.objectStoreNames].sort()) stores[name]=await new Promise((resolve,reject)=>{const request=db.transaction(name,'readonly').objectStore(name).getAll();request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
      databases.push({name:info.name,version:db.version,stores});db.close();
    }
    const pet=document.querySelector('[data-planet-mascot-pet]');
    return {databases,localStorage:Object.fromEntries(Object.keys(localStorage).sort().map(key=>[key,localStorage.getItem(key)])),
      tour:{mode:pet.dataset.planetMascotMode,route:pet.dataset.planetMascotCurrentRoute,step:pet.dataset.planetMascotStep},
      country:new URL(location.href).searchParams.get('country'),writer:new URL(location.href).searchParams.get('writer'),hash:location.hash,
      viewMode:[...document.querySelectorAll('.book-shelf-controls__views button')].find(button=>button.getAttribute('aria-pressed')==='true')?.textContent.trim()??null};
  });
}
async function writerReaderObservation(page) {
  return page.evaluate(()=>{
    const detail=document.querySelector('#book-archive-detail'),owner=detail?.closest('.native-planet-panel__content'),pet=document.querySelector('[data-planet-mascot-pet]'),canvas=pet?.querySelector('[data-booky-canvas]'),focus=document.activeElement;
    const r=detail?.getBoundingClientRect(),url=new URL(location.href);
    return {url:location.href,bookKey:url.searchParams.get('book'),title:detail?.querySelector('.book-detail-copy h3')?.textContent?.trim()??null,
      reader:{present:!!detail,visible:!!detail?.getClientRects().length,inert:!!detail?.closest('[inert],[aria-hidden="true"]'),rect:r?{top:r.top,bottom:r.bottom,width:r.width,height:r.height}:null},
      focus:{reader:!!detail?.contains(focus),bookyToggle:!!focus?.matches('[data-planet-mascot-toggle]'),help:!!pet?.querySelector('[data-planet-mascot-panel]')?.contains(focus),tag:focus?.tagName,id:focus?.id},
      nativeOwner:owner?{scrollTop:owner.scrollTop,clientHeight:owner.clientHeight,scrollHeight:owner.scrollHeight}:null,
      history:window.__bookySupportFixture.historyObservation(),helpOpen:!!pet?.querySelector('[data-planet-mascot-panel]'),
      booky:{readerOwned:pet?.dataset.bookyReaderOwned??null,readerPaused:pet?.dataset.bookyReaderPaused??null,gesture:pet?.dataset.planetMascotGesture??null,targets:document.querySelectorAll('[data-booky-target]').length,context:canvas?.dataset.bookyContext??null,animating:canvas?.dataset.bookyAnimating??null,reducedMotion:canvas?.dataset.bookyReducedMotion??null,renderCount:canvas?.dataset.bookyRenderCount??null,systemReducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches}};
  });
}
async function writerReaderComposition(page) {
  return page.evaluate(()=>{
    const frame=document.querySelector('.native-planet-panel .book-shelf-frame'),detail=frame?.querySelector('.book-shelf-frame__detail'),catalog=frame?.querySelector('.book-shelf-frame__catalog'),position=frame?.querySelector('.book-shelf-navigation__position'),navigation=frame?.querySelector('.book-shelf-frame__navigation');
    const rect=e=>{const r=e?.getBoundingClientRect();return r?{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}:null;},visible=e=>!!e?.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
    const controls=[...(navigation?.querySelectorAll('.book-shelf-navigation__single, .book-shelf-navigation__actions > button')??[])].map(e=>({label:e.getAttribute('aria-label')??e.textContent.trim(),visible:visible(e),disabled:e.disabled,rect:rect(e)}));
    return {bookKey:new URL(location.href).searchParams.get('book'),position:detail?.dataset.mobilePosition??null,phase:detail?.dataset.mobilePhase??null,catalogPresent:!!catalog,catalogVisible:visible(catalog),navigationPresent:!!position,navigationVisible:visible(position),navigationCount:Number(navigation?.dataset.navigationCount??NaN),controls,documentOverflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),frameOverflow:frame?Math.max(0,frame.scrollWidth-frame.clientWidth):null,history:window.__bookySupportFixture.historyObservation()};
  });
}
async function writerInputs(page, observation) {
  const cdp=await page.context().newCDPSession(page);
  const touch=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
  async function geometry(locator) {
    return locator.evaluate(element=>{
      const rect=node=>{const r=node.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
      const box=rect(element);let clip={left:0,top:0,right:innerWidth,bottom:innerHeight};const scrollers=[];
      for(let parent=element.parentElement;parent;parent=parent.parentElement){const style=getComputedStyle(parent);if(/auto|scroll|hidden|clip/.test(style.overflowY)){const r=rect(parent);clip={left:Math.max(clip.left,r.left+parent.clientLeft),right:Math.min(clip.right,r.left+parent.clientLeft+parent.clientWidth),top:Math.max(clip.top,r.top+parent.clientTop),bottom:Math.min(clip.bottom,r.top+parent.clientTop+parent.clientHeight)};if(/auto|scroll/.test(style.overflowY)&&parent.scrollHeight>parent.clientHeight+1)scrollers.push({index:scrollers.length,tag:parent.tagName,className:parent.className,rect:r,top:parent.scrollTop,height:parent.clientHeight,range:parent.scrollHeight-parent.clientHeight});}}
      const center={x:(box.left+box.right)/2,y:(box.top+box.bottom)/2};const points=[center,{x:center.x-box.width*.2,y:center.y},{x:center.x+box.width*.2,y:center.y}];
      const hits=points.map(point=>{const hit=document.elementFromPoint(point.x,point.y);return {point,inside:!!hit&&element.contains(hit),hit:hit?{tag:hit.tagName,className:typeof hit.className==='string'?hit.className:null,text:hit.textContent?.trim().slice(0,70)}:null};});
      return {box,clip,scrollers,scroll:scrollers[0]??null,center,hits,text:element.textContent?.trim(),disabled:!!element.disabled,visible:!!element.getClientRects().length&&getComputedStyle(element).visibility==='visible',borderRadius:getComputedStyle(element).borderRadius};
    });
  }
  async function expose(locator,label) {
    await expect(locator,label+' present').toBeVisible();let state=await geometry(locator);
    const usable=Math.max(40,Math.min(page.viewportSize().height,...state.scrollers.map(owner=>owner.height))*.55);const budget=Math.min(160,Math.max(8,Math.ceil(state.scrollers.reduce((sum,owner)=>sum+owner.range,0)/usable)+8));
    for(let attempt=0;attempt<=budget;attempt++) {
      state=await geometry(locator);const b=state.box,c=state.clip;
      if(b.top>=c.top-.5&&b.bottom<=c.bottom+.5&&b.left>=c.left-.5&&b.right<=c.right+.5&&state.hits.every(hit=>hit.inside)) return state;
      const towardTop=b.top<c.top-.5;state.scroll=state.scrollers.find(owner=>towardTop?owner.top>.5:owner.top<owner.range-.5)??null;
      if(!state.scroll||attempt===budget)throw Error(label+' cannot be exposed: '+JSON.stringify({budget,attempt,state}));
      const s=state.scroll.rect,left=Math.max(2,s.left),right=Math.min(page.viewportSize().width-2,s.right),top=Math.max(2,s.top+3),bottom=Math.min(page.viewportSize().height-2,s.bottom-3),down=b.top<c.top;
      const overflow=down?c.top-b.top:Math.max(0,b.bottom-c.bottom),distance=Math.min(240,(bottom-top)*.45,Math.max(64,overflow+48));
      const middle=(top+bottom)/2,start=middle+(down?-distance/2:distance/2),end=middle+(down?distance/2:-distance/2);
      const corridor=await locator.evaluate((element,{left,right,start,end,ownerIndex})=>{
        const scrollers=[];for(let parent=element.parentElement;parent;parent=parent.parentElement){const style=getComputedStyle(parent);if(/auto|scroll/.test(style.overflowY)&&parent.scrollHeight>parent.clientHeight+1)scrollers.push(parent);}const scroll=scrollers[ownerIndex];
        const describe=node=>({tag:node.tagName,className:typeof node.className==='string'?node.className:null,touchAction:getComputedStyle(node).touchAction,pointerEvents:getComputedStyle(node).pointerEvents,overflowY:getComputedStyle(node).overflowY,scrollTop:node.scrollTop,scrollHeight:node.scrollHeight,clientHeight:node.clientHeight,chosenScroll:node===scroll});
        const candidates=[left+8,right-8,(left+right)/2].map(x=>({x,points:[start,(start+end)/2,end].map(y=>{const hit=document.elementFromPoint(x,y),ancestors=[];let current=hit;while(current){ancestors.push(describe(current));if(current===scroll)break;current=current.parentElement;}return {x,y,hit:hit?describe(hit):null,inside:!!scroll&&!!hit&&scroll.contains(hit),interactive:!!scroll&&!!hit&&(()=>{const owner=hit.closest('canvas,button,a,input,textarea,select,[role="button"],[data-planet-mascot-pet]');return !!owner&&owner!==scroll&&scroll.contains(owner);})(),ancestors};})}));
        const chosen=candidates.find(candidate=>candidate.points.every(point=>point.inside&&!point.interactive&&point.ancestors.every(node=>node.touchAction!=='none'&&(node.chosenScroll||!/auto|scroll/.test(node.overflowY)||node.scrollHeight<=node.clientHeight+1))));
        return {candidates,chosen:chosen?.x??null};
      },{left,right,start,end,ownerIndex:state.scroll.index});
      const record={label,attempt,budget,ownerIndex:state.scroll.index,scrollersBefore:state.scrollers,before:state.scroll.top,direction:down?'toward top':'toward bottom',targetBefore:state.box,clipBefore:state.clip,distance,start,end,holdBeforeReleaseMs:180,corridor};observation.scrolls.push(record);
      if(corridor.chosen===null)throw Error(label+' has no touch-scroll corridor: '+JSON.stringify(record));
      const x=corridor.chosen;await touch('touchStart',[{x,y:start}]);for(let step=1;step<=8;step++){await touch('touchMove',[{x,y:start+(end-start)*step/8}]);await page.waitForTimeout(35);}await page.waitForTimeout(180);await touch('touchEnd',[]);await page.waitForTimeout(100);await writerSettle(page);
      const after=await geometry(locator);record.after=after.scrollers.find(owner=>owner.index===record.ownerIndex)?.top??null;record.scrollersAfter=after.scrollers;record.targetAfter=after.box;
    }
  }
  async function tap(locator,label,{minimum44=true,rangeEdge=null}={}) {
    await expose(locator,label);let state,last=null,matches=0;
    await expect.poll(async()=>{state=await geometry(locator);const key=JSON.stringify([state.box,state.clip,state.hits.map(hit=>hit.inside)]);matches=key===last?matches+1:1;last=key;return matches>=3&&state.hits.every(hit=>hit.inside);},{intervals:[80],message:label+' settled touch geometry'}).toBe(true);
    observation.targets.push({label,...state});
    if(minimum44){expect(state.box.width,label+' width').toBeGreaterThanOrEqual(44);expect(state.box.height,label+' height').toBeGreaterThanOrEqual(44);}expect(state.disabled,label+' enabled').toBe(false);
    const rangeBefore=rangeEdge!==null?await locator.inputValue():null;
    await locator.evaluate((target,isRange)=>{window.__writerRecoveryTouch=[];for(const type of isRange?['pointerdown','pointerup','input','change']:['pointerdown','pointerup','click'])target.addEventListener(type,event=>window.__writerRecoveryTouch.push({type,trusted:event.isTrusted,pointerType:event.pointerType,intended:target.contains(event.target),...(isRange?{value:target.value}:{})}),{once:true});},rangeEdge!==null);
    let point=state.center;
    if(rangeEdge!==null){expect(['start','end']).toContain(rangeEdge);await expect(locator).toHaveAttribute('type','range');point={x:rangeEdge==='start'?state.box.left+1:state.box.right-1,y:state.center.y};expect(await locator.evaluate((target,p)=>{const hit=document.elementFromPoint(p.x,p.y);return hit===target||target.contains(hit);},point),label+' actual endpoint belongs to the same native range').toBe(true);observation.targets.at(-1).actualRangeEndpoint={edge:rangeEdge,point};}
    await touch('touchStart',[point]);await page.waitForTimeout(65);await touch('touchEnd',[]);await writerSettle(page);
    const events=await page.evaluate(()=>window.__writerRecoveryTouch),rangeAfter=rangeEdge!==null?await locator.inputValue():null;observation.touches.push({label,events,...(rangeEdge!==null?{nativeRange:{edge:rangeEdge,before:rangeBefore,after:rangeAfter}}:{})});
    for(const type of rangeEdge!==null?['pointerdown','pointerup']:['pointerdown','pointerup','click'])expect(events.some(event=>event.type===type&&event.trusted&&event.pointerType==='touch'&&event.intended),label+' trusted '+type).toBe(true);
    if(rangeEdge!==null&&rangeAfter!==rangeBefore)for(const type of ['input','change'])expect(events.some(event=>event.type===type&&event.trusted&&event.intended&&event.value===rangeAfter),label+' native '+type+' commits the actual changed value').toBe(true);
  }
  return {tap,expose,geometry,close:()=>cdp.detach()};
}
for (const language of ['ru','en']) test('Booky explicit writer filter recovery '+language, async ({},testInfo)=>{
  test.setTimeout(180_000);const fixture=await open(testInfo),{page,result}=fixture;
  const o=result.observations.writerFilterRecovery={language,scenario:language==='ru'?'conflicting country facet':'empty saved Favorites shelf',touches:[],targets:[],scrolls:[],pickerSetup:[],ordinaryRequests:[],checks:[],readerDeferralExercised:false,newerUserEditIntegrationExercised:false};
  result.scenario='booky-writer-filter-recovery-'+language;result.nativePickerEquivalent=false;result.controlledPickerSetup=true;
  const input=await writerInputs(page,o),writerAction=()=>page.locator('[data-planet-mascot-action="writer-books"]'),recovery=()=>page.locator('[data-booky-show-all-writer-books]'),drawer=()=>page.locator('#book-archive-advanced-filters'),shelf=()=>page.locator('#book-collection-shelf');
  const help=async()=>{if(!await panel(page).count())await input.tap(page.locator('[data-planet-mascot-toggle]'),'open Booky help');await expect(panel(page)).toBeVisible();};
  const collapse=async()=>{if(await panel(page).count())await input.tap(page.locator('[data-planet-mascot-collapse]'),'close Booky help');};
  const filters=async()=>{await collapse();await input.tap(page.locator('.book-shelf-controls__advanced'),'open collection filters');await expect(drawer()).toBeVisible();};
  const closeFilters=async()=>{await input.tap(drawer().locator('.book-shelf-filter-drawer__header button'),'close collection filters');await expect(drawer()).toBeHidden();};
  const status=async value=>{
    let failure;
    try { await expect(page.locator('[data-planet-mascot-author-books-status]').first()).toHaveAttribute('data-planet-mascot-author-books-status',value); } catch(error) { failure=error; }
    const current=await page.evaluate(()=>({authorEffectTrace:window.__bookyAuthorTrace??[],url:location.href,feedback:[...document.querySelectorAll('[data-planet-mascot-author-books-status]')].map(node=>({status:node.dataset.planetMascotAuthorBooksStatus,text:node.textContent})),pet:{...document.querySelector('[data-planet-mascot-pet]')?.dataset},archive:{present:!!document.querySelector('#books'),shelf:document.querySelector('#book-collection-shelf')?.value,authorOptions:[...document.querySelectorAll('[data-book-author-filter] option')].map(option=>({value:option.value,text:option.textContent})),visibleBookKeys:[...document.querySelectorAll('.archive-book-detail[data-book-key]')].slice(0,8).map(node=>node.dataset.bookKey),empty:[...document.querySelectorAll('.book-archive-empty')].map(node=>node.textContent)}}));
    (o.statusObservations??=[]).push({expected:value,pass:!failure,...current});if(failure)throw failure;
  };
  const nativeSelect=async(locator,value,label)=>{const before=await locator.inputValue();await locator.selectOption(value);await expect(locator).toHaveValue(value);o.pickerSetup.push({label,mechanism:'controlled Playwright selectOption for native picker setup only',before,value});await writerSettle(page);};
  try {
    await page.setViewportSize({width:language==='ru'?390:320,height:844});await writerSettle(page);
    if(language==='en'){await input.tap(page.locator('.native-planet-app .interface-language-control button:visible').filter({hasText:/^EN$/u}),'English interface');await expect(page.locator('html')).toHaveAttribute('lang','en');}
    await help();await input.tap(writerAction(),'initial ordinary writer request');await expect(page.locator('.native-planet-panel')).toBeVisible();await status('applied');
    const initialTrace=o.statusObservations.at(-1).authorEffectTrace;
    const initialWaitIndex=initialTrace.findIndex(row=>row.id===1&&row.phase==='pending-wait'&&row.sameRender===false&&row.markerWait===true&&row.sameCommittedRequest===false);
    const initialAppliedIndex=initialTrace.findIndex(row=>row.id===1&&row.phase==='settle'&&row.result==='applied'&&row.sameCommittedRequest===true&&row.committedAuthorRequestId===1);
    expect(initialWaitIndex,'initial distinct render waits for its own filter batch').toBeGreaterThanOrEqual(0);expect(initialAppliedIndex,'matching committed filter batch acknowledges after pending wait').toBeGreaterThan(initialWaitIndex);
    o.initialAuthorCommit={waitIndex:initialWaitIndex,appliedIndex:initialAppliedIndex,wait:initialTrace[initialWaitIndex],applied:initialTrace[initialAppliedIndex]};result.pendingAuthorCommitVerified=true;
    await collapse();
    const views=page.locator('.book-shelf-controls__views button');if(await views.count()){const catalog=views.nth(1);if(await catalog.getAttribute('aria-pressed')!=='true')await input.tap(catalog,'catalog presentation');}
    await filters();const sort=drawer().locator('.book-shelf-filter-drawer__select select').filter({has:page.locator('option[value="title"]')});await nativeSelect(sort,'title','nondefault title sort');
    if(language==='ru'){const country=drawer().locator('fieldset').filter({has:page.locator('legend').filter({hasText:/^Страны$/u})});const france=country.locator('label').filter({hasText:/^Франция$/u});await input.tap(france,'conflicting France facet',{minimum44:false});await expect(france.locator('input')).toBeChecked();}
    await closeFilters();if(language==='en')await nativeSelect(shelf(),'favorites','empty built-in Favorites shelf');
    await filters();const restricted=await writerControls(page);expect(restricted.author).toBe('russia:dostoevsky');expect(restricted.sort).toBe('title');expect(restricted.checked.length).toBe(language==='ru'?1:0);if(language==='ru')expect(restricted.checked[0].label).toBe('Франция');await closeFilters();
    await expect(shelf()).toHaveValue(language==='ru'?'all':'favorites');await expect(page.locator('.book-archive-empty')).toBeVisible();await stablePose(page);await page.evaluate(()=>window.__bookySupportFixture.remember());
    const baseGlobe=await actual(page),baseOwned=await writerOwnedState(page),basePreferences=[...fixture.memory.entries()].sort(),writeStart=fixture.operations.length;
    o.before={filters:restricted,shelf:await shelf().inputValue(),owned:baseOwned,globe:baseGlobe,preferenceValues:basePreferences};
    for(let index=0;index<2;index++){
      await help();await input.tap(writerAction(),'ordinary writer request '+(index+1));await status('filtered-empty');await expect(recovery()).toBeVisible();
      const acknowledgement=await page.locator('[data-planet-mascot-author-books-status]').first().textContent();await filters();const kept=await writerControls(page);expect(kept).toEqual(restricted);await closeFilters();await expect(shelf()).toHaveValue(language==='ru'?'all':'favorites');await expect(page.locator('.book-archive-empty')).toBeVisible();
      expect(await writerOwnedState(page)).toEqual(baseOwned);expect([...fixture.memory.entries()].sort()).toEqual(basePreferences);retained(await actual(page),baseGlobe);o.ordinaryRequests.push({index:index+1,acknowledgement,filters:kept,shelf:await shelf().inputValue()});
    }
    if(language==='ru'){
      await filters();const france=drawer().locator('fieldset').filter({has:page.locator('legend').filter({hasText:/^Страны$/u})}).locator('label').filter({hasText:/^Франция$/u});
      await input.tap(france,'manually remove conflicting France facet',{minimum44:false});await expect(france.locator('input')).not.toBeChecked();await closeFilters();await expect(page.locator('.book-archive-empty')).toHaveCount(0);await expect(page.locator('.archive-book-card').first()).toBeVisible();
      await help();await status('applied');await expect(recovery()).toHaveCount(0);const repairedAcknowledgement=await page.locator('[data-planet-mascot-author-books-status]').first().textContent();expect(repairedAcknowledgement).toBe('Список книг писателя готов.');expect(await writerOwnedState(page)).toEqual(baseOwned);expect([...fixture.memory.entries()].sort()).toEqual(basePreferences);
      await filters();const repaired=await writerControls(page);expect(repaired.author).toBe(restricted.author);expect(repaired.sort).toBe('title');expect(repaired.checked).toEqual([]);
      await input.tap(france,'reapply conflicting France facet',{minimum44:false});await expect(france.locator('input')).toBeChecked();expect(await writerControls(page)).toEqual(restricted);await closeFilters();await expect(page.locator('.book-archive-empty')).toBeVisible();await help();await status('filtered-empty');await expect(recovery()).toBeVisible();
      o.manualRepair={appliedAcknowledgement:repairedAcknowledgement,filters:repaired,currentStatusAfterReapply:'filtered-empty',noNewBookyRequest:true};result.manualCurrentStatusRepairVerified=true;
    }
    await help();await input.expose(recovery(),'explicit writer recovery control');await expect(recovery()).toHaveText(language==='ru'?'Все доступные книги писателя':'All available books by this writer');
    const recoveryExplanation=await page.locator('[data-booky-writer-filter-recovery]').textContent();o.recoveryExplanation=recoveryExplanation;
    await capture(fixture,testInfo,'booky-writer-filter-recovery-'+language+'-filtered-empty.png','Actual App; repeated ordinary writer request preserves restrictive view; explicit localized recovery is available. Picker setup is controlled.');
    await input.tap(recovery(),'explicit show all current writer books');await status('applied');await expect(recovery()).toHaveCount(0);await expect(shelf()).toHaveValue('all');await expect(page.locator('.book-archive-empty')).toHaveCount(0);await expect(page.locator('.archive-book-card').first()).toBeVisible();
    o.appliedAcknowledgement=await page.locator('[data-planet-mascot-author-books-status]').first().textContent();expect(o.appliedAcknowledgement).toBe(language==='ru'?'Список книг писателя готов.':"The writer's book list is ready.");
    await input.expose(page.locator('[data-planet-mascot-author-books-status]').first(),'rendered writer result acknowledgement');
    await capture(fixture,testInfo,'booky-writer-filter-recovery-'+language+'-recovered.png','Actual App; explicit recovery acknowledged after rendered current-writer results; canonical scene and saved content retained.');
    await filters();const recovered=await writerControls(page);expect(recovered.author).toBe(restricted.author);expect(recovered.sort).toBe('title');expect(recovered.checked).toEqual([]);expect(recovered.presets).toEqual([]);await closeFilters();
    await expect(page.locator('.book-shelf-controls__search input')).toHaveValue('');await expect(page.locator('.book-shelf-controls__scope select')).toHaveValue('library');
    const keys=await page.locator('.archive-book-detail[data-book-key]').evaluateAll(elements=>elements.map(element=>element.dataset.bookKey));expect(keys.length).toBeGreaterThan(0);expect(keys.every(key=>key.startsWith('russia:dostoevsky:'))).toBe(true);
    const afterOwned=await writerOwnedState(page);expect(afterOwned).toEqual(baseOwned);expect([...fixture.memory.entries()].sort()).toEqual(basePreferences);expect(fixture.operations.slice(writeStart).filter(entry=>entry.operation!=='get')).toEqual([]);expect(fixture.bookyWrites()).toEqual([]);expect(fixture.writes()).toEqual([]);
    const afterGlobe=await actual(page);retained(afterGlobe,baseGlobe,true,language==='ru');const beforeUrl=new URL(baseGlobe.url),afterUrl=new URL(afterGlobe.url);if(language==='en'){expect(beforeUrl.searchParams.get('archiveShelf')).toBe('favorites');beforeUrl.searchParams.delete('archiveShelf');expect(afterUrl.href).toBe(beforeUrl.href);}else expect(afterUrl.href).toBe(beforeUrl.href);
    o.after={filters:recovered,shelf:await shelf().inputValue(),owned:afterOwned,globe:afterGlobe,visibleBookKeys:keys};
    o.checks=['ordinary writer requests preserve the conflicting view and nondefault sort','explicit trusted recovery opens All books and clears only restrictions','current canonical writer and title sort remain selected','rendered current-writer results receive visible applied acknowledgement','saved shelves favorites history and local storage remain exact','Booky route progress preferences and canonical globe remain exact','native picker setup is explicitly controlled and Booky activations are trusted touch','initial intervening render waits for its own filter batch before applied acknowledgement'].map(name=>({name,pass:true}));
    Object.assign(result,{ordinaryRestrictionsPreserved:true,explicitRecoveryTrustedTouch:true,allBooksSelected:true,writerAndSortPreserved:true,renderedResultsAcknowledged:true,savedContentPreserved:true,preferencesAndGlobePreserved:true,readerDeferralExercised:false,newerUserEditIntegrationExercised:false});if(language==='ru')o.checks.push({name:'manual facet repair updates current rendered status without another Booky request',pass:true});
    // Bounded lifecycle extension: real selected-book ownership defers this
    // exact user-requested recovery. No renderer/state/outcome is assigned.
    const lifecycle=o.currentOnlyRecovery={kind:language==='ru'?'reader-close-restores-current-history':'newer-trusted-facet-edit-during-reader-deferral',touchesStart:o.touches.length,checks:[]};
    await collapse();
    const selectedControl=page.locator('.archive-book-detail[data-book-key]').first();
    const selectedKey=await selectedControl.getAttribute('data-book-key');
    expect(selectedKey).toMatch(/^russia:dostoevsky:/u);
    let priorReaderHistory;
    await expect.poll(async()=>{priorReaderHistory=await page.evaluate(()=>window.__bookySupportFixture.historyObservation());return priorReaderHistory.context?.selectedBookKey===null&&priorReaderHistory.context?.shelfId==='all'&&priorReaderHistory.context?.search?.query===''&&priorReaderHistory.context?.search?.scope==='library'&&priorReaderHistory.context?.filters?.authorKey==='russia:dostoevsky'&&priorReaderHistory.context?.filters?.countryIds?.length===0&&priorReaderHistory.context?.filters?.sort==='title';},{message:'Real pre-book history has the unrestricted current writer view'}).toBe(true);
    await input.tap(selectedControl,'open a real current writer book for reader ownership');
    const selectedReader=page.locator('.book-shelf-frame__detail:has(#book-archive-detail)');
    await expect(selectedReader).toBeVisible();await expect(selectedControl).toHaveAttribute('aria-expanded','true');
    await expect.poll(()=>page.evaluate(()=>new URL(location.href).searchParams.get('book'))).toBe(selectedKey);
    const readerTitle=await selectedReader.locator('.book-detail-copy h3').first().textContent();
    expect(readerTitle?.trim().length).toBeGreaterThan(0);
    lifecycle.reader={bookKey:selectedKey,title:readerTitle,selectedByTrustedTouch:true,dossierPresent:await selectedReader.locator('.book-dossier-reader').count()};
    const readerOwnedBefore=await writerOwnedState(page),readerPreferencesBefore=[...fixture.memory.entries()].sort(),readerBookyWritesBefore=fixture.bookyWrites().length;
    await filters();
    const readerFrance=drawer().locator('fieldset').filter({has:page.locator('legend').filter({hasText:/^(Страны|Countries)$/u})}).locator('label').filter({hasText:/^(Франция|France)$/u});
    await input.tap(readerFrance,'restrict the underlying writer view while the real book stays open',{minimum44:false});
    await expect(readerFrance.locator('input')).toBeChecked();
    const readerRestricted=await writerControls(page);expect(readerRestricted.author).toBe('russia:dostoevsky');expect(readerRestricted.sort).toBe('title');
    await closeFilters();await expect(selectedReader).toBeVisible();await expect(page.locator('.book-archive-empty')).toHaveCount(1);await expect(page.locator('.book-shelf-frame__catalog')).toBeHidden();await expect(selectedReader).toHaveAttribute('data-mobile-position','expanded');
    await help();await status('filtered-empty');await expect(recovery()).toBeVisible();
    const previousAuthorId=await page.evaluate(()=>Math.max(0,...(window.__bookyAuthorTrace??[]).map(row=>row.id??0)));
    await input.tap(recovery(),'explicit recovery while the actual reader still owns its book');
    let deferred;
    await expect.poll(async()=>{deferred=await page.evaluate(previous=>[...(window.__bookyAuthorTrace??[])].reverse().find(row=>row.id>previous&&row.phase==='reader-defer'&&row.recovery),previousAuthorId);return !!deferred;},{message:'The real selected reader defers the admitted recovery request'}).toBe(true);
    const recoveryId=deferred.id;
    expect(deferred.selectedBookRef).toBe(true);expect(deferred.readerBookKey).toBe(selectedKey);expect(deferred.pending).toBe(false);
    await expect(selectedReader).toBeVisible();await expect.poll(()=>page.evaluate(()=>new URL(location.href).searchParams.get('book'))).toBe(selectedKey);
    await status('loading');
    const deferredRows=await page.evaluate(id=>(window.__bookyAuthorTrace??[]).filter(row=>row.id===id),recoveryId);
    expect(deferredRows.some(row=>row.phase==='recovery-dispatch'||row.phase==='settle')).toBe(false);
    expect(await selectedReader.locator('.book-detail-copy h3').first().textContent()).toBe(readerTitle);
    expect(await writerOwnedState(page)).toEqual(readerOwnedBefore);expect([...fixture.memory.entries()].sort()).toEqual(readerPreferencesBefore);expect(fixture.bookyWrites().length).toBe(readerBookyWritesBefore);
    lifecycle.deferred={requestId:recoveryId,row:deferred,rows:deferredRows,filters:readerRestricted,readerIdentityPreserved:true,semanticProgressUnchanged:true,noRecoveryDispatch:true};
    if(language==='en'){
      await filters();
      await input.tap(readerFrance,'newer user removes the country facet while recovery is deferred',{minimum44:false});
      await expect(readerFrance.locator('input')).not.toBeChecked();
      const newerFilters=await writerControls(page);expect(newerFilters.author).toBe(readerRestricted.author);expect(newerFilters.sort).toBe(readerRestricted.sort);expect(newerFilters.checked).toEqual([]);
      await closeFilters();await expect(selectedReader).toBeVisible();await help();await status('invalid');
      const newerRows=await page.evaluate(id=>(window.__bookyAuthorTrace??[]).filter(row=>row.id===id),recoveryId);
      const mismatch=newerRows.findIndex(row=>row.phase==='waiting-filter-mismatch');
      const invalid=newerRows.findIndex(row=>row.phase==='settle'&&row.result==='invalid');
      expect(mismatch).toBeGreaterThanOrEqual(0);expect(invalid).toBeGreaterThan(mismatch);expect(newerRows[invalid].selectedBookRef).toBe(true);
      expect(newerRows.filter(row=>row.phase==='settle').length).toBe(1);expect(newerRows.some(row=>row.phase==='recovery-dispatch')).toBe(false);
      expect(new URL(await page.url()).searchParams.get('book')).toBe(selectedKey);
      await filters();expect(await writerControls(page)).toEqual(newerFilters);await closeFilters();
      lifecycle.newerUserEdit={filters:newerFilters,rows:newerRows,invalidWhileReaderOwned:true,currentViewPreserved:true,noRecoveryDispatch:true};
      o.newerUserEditIntegrationExercised=true;result.newerUserEditIntegrationExercised=true;
    }
    const realCloseBoundary=await page.evaluate(()=>({detailKey:history.state?.probperaBookDetail??null,shelfChanged:!!history.state?.probperaBookDetailShelfChanged,book:new URL(location.href).searchParams.get('book')}));
    expect(realCloseBoundary.detailKey).toBe(selectedKey);expect(realCloseBoundary.book).toBe(selectedKey);expect(realCloseBoundary.shelfChanged).toBe(false);
    lifecycle.historyBoundary={prior:priorReaderHistory,close:realCloseBoundary};
    await collapse();await input.tap(selectedReader.locator('.book-detail-close'),'close only the real book reader through its own Close control');
    await expect(selectedReader).toHaveCount(0);await expect.poll(()=>page.evaluate(()=>new URL(location.href).searchParams.get('book'))).toBeNull();
    await help();await status('invalid');
    const restoredReaderHistory=await page.evaluate(()=>window.__bookySupportFixture.historyObservation());
    expect(restoredReaderHistory.url).toBe(priorReaderHistory.url);expect(restoredReaderHistory.context?.filters).toEqual(priorReaderHistory.context.filters);expect(restoredReaderHistory.context?.search).toEqual(priorReaderHistory.context.search);expect(restoredReaderHistory.context?.shelfId).toBe(priorReaderHistory.context.shelfId);
    lifecycle.historyBoundary.restored=restoredReaderHistory;
    const closedRows=await page.evaluate(id=>(window.__bookyAuthorTrace??[]).filter(row=>row.id===id),recoveryId);
    const mismatch=closedRows.findIndex(row=>row.phase==='waiting-filter-mismatch'),invalid=closedRows.findIndex(row=>row.phase==='settle'&&row.result==='invalid');
    expect(mismatch).toBeGreaterThanOrEqual(0);expect(invalid).toBeGreaterThan(mismatch);expect(closedRows.filter(row=>row.phase==='settle').length).toBe(1);
    expect(closedRows.some(row=>row.phase==='recovery-dispatch')).toBe(false);
    await filters();const currentAfterClose=await writerControls(page);expect(currentAfterClose.author).toBe(readerRestricted.author);expect(currentAfterClose.sort).toBe('title');expect(currentAfterClose.checked).toEqual([]);await closeFilters();
    lifecycle.closed={rows:closedRows,filters:currentAfterClose,bookCloseTrusted:true,oldRecoveryInvalidated:true,noRecoveryDispatch:true,cause:language==='ru'?'actual pre-book history filters restored on Close':'newer explicit facet edit consumed recovery before Close'};
    await help();await input.tap(writerAction(),'fresh explicit writer request after the old recovery was discarded');await status('applied');
    const freshRows=await page.evaluate(id=>(window.__bookyAuthorTrace??[]).filter(row=>row.id>id),recoveryId);
    expect(freshRows.some(row=>row.phase==='ordinary-dispatch')).toBe(true);expect(freshRows.some(row=>row.phase==='settle'&&row.result==='applied')).toBe(true);
    expect(await writerOwnedState(page)).toEqual({...readerOwnedBefore,hash:new URL(priorReaderHistory.url).hash});expect([...fixture.memory.entries()].sort()).toEqual(readerPreferencesBefore);expect(fixture.bookyWrites().length).toBe(readerBookyWritesBefore);
    retained(await actual(page),afterGlobe,true,true);
    lifecycle.freshRequest={rows:freshRows,explicit:true,oldRecoveryNotReplayed:true,semanticProgressUnchanged:true,readerOwnedContentPreserved:true};
    o.readerDeferralExercised=true;result.readerDeferralExercised=true;
    lifecycle.checks=[{name:'trusted real book owns the reader before a current recovery is admitted',pass:true},{name:'reader deferral neither dispatches recovery nor changes the current book or semantic progress',pass:true},{name:'real current-view change discards only the obsolete request before a fresh explicit writer request',pass:true}];
    if(language==='en')lifecycle.checks.push({name:'a newer trusted facet edit invalidates deferred recovery while its reader is still owned',pass:true});

    // Reader foreground extension: help is open BEFORE this genuine new entry.
    // Inactive observer/filter/reflow callbacks never substitute for book Close.
    const foreground=o.readerForeground={touchesStart:o.touches.length,checks:[]};
    const foregroundOwned=await writerOwnedState(page),foregroundPreferences=[...fixture.memory.entries()].sort(),foregroundBookyWrites=fixture.bookyWrites().length,foregroundGlobe=await actual(page);
    await page.emulateMedia({reducedMotion:'no-preference'});await writerSettle(page);
    await help();await expect(selectedReader).toHaveCount(0);
    await input.expose(selectedControl,'real writer book while Booky help is open');
    await expect(panel(page)).toBeVisible();
    foreground.before=await writerReaderObservation(page);
    expect(foreground.before.helpOpen).toBe(true);expect(foreground.before.reader.present).toBe(false);expect(foreground.before.booky.systemReducedMotion).toBe(false);
    const foregroundTraceStart=await page.evaluate(()=>performance.now());
    await page.evaluate(()=>{window.__bookyReaderFocus=[];document.addEventListener('focusin',event=>{const entries=window.__bookyReaderFocus;if(!entries)return;const target=event.target;entries.push({time:performance.now(),reader:!!target?.closest?.('#book-archive-detail'),bookyToggle:!!target?.matches?.('[data-planet-mascot-toggle]'),help:!!target?.closest?.('[data-planet-mascot-panel]'),tag:target?.tagName,id:target?.id});if(entries.length>160)entries.shift();});});
    await input.tap(selectedControl,'open real reader with Booky help already open');
    await expect(selectedReader).toBeVisible();await expect(selectedControl).toHaveAttribute('aria-expanded','true');
    let foregroundArrival;
    await expect.poll(async()=>{foregroundArrival=await page.evaluate(({since,key})=>(window.__bookyReaderTrace??[]).find(row=>row.time>=since&&row.view.active&&row.view.settled&&row.view.countryId+':'+row.view.writerId+':'+row.view.workId===key),{since:foregroundTraceStart,key:selectedKey});return !!foregroundArrival;},{message:'Actual committed selected reader reports its owned active view'}).toBe(true);
    foreground.arrival=foregroundArrival;
    // The old runtime is expected to fail here after the real committed arrival.
    await expect(panel(page),'Booky help retires once on genuine reader arrival').toHaveCount(0);
    await expect(pet(page)).toHaveAttribute('data-booky-reader-owned','true');await expect(pet(page)).toHaveAttribute('data-booky-reader-paused','true');
    await expect(page.locator('[data-booky-canvas]')).toHaveAttribute('data-booky-animating','false');await expect(page.locator('[data-booky-canvas]')).toHaveAttribute('data-booky-reduced-motion','true');
    await expect.poll(async()=>{const current=await writerReaderObservation(page);return current.focus.reader&&!current.focus.bookyToggle&&current.bookKey===selectedKey&&current.title===readerTitle;},{message:'The actual reader keeps its own focus and identity after automatic help retirement'}).toBe(true);
    await writerSettle(page);foreground.collapsed=await writerReaderObservation(page);
    const foregroundFocus=await page.evaluate(since=>(window.__bookyReaderFocus??[]).filter(row=>row.time>=since),foregroundArrival.time);
    expect(foregroundFocus.some(row=>row.bookyToggle),'Automatic retirement never transfers reader focus to Booky').toBe(false);
    expect(foreground.collapsed.booky.context).toBe('ready');expect(foreground.collapsed.booky.systemReducedMotion).toBe(false);expect(foreground.collapsed.booky.targets).toBe(0);
    foreground.composition=await writerReaderComposition(page);
    await expect(selectedReader).toHaveAttribute('data-mobile-position','expanded');await expect(selectedControl).toHaveAttribute('aria-expanded','true');
    expect(foreground.composition.catalogPresent).toBe(true);expect(foreground.composition.catalogVisible).toBe(false);expect(foreground.composition.navigationPresent).toBe(true);expect(foreground.composition.navigationVisible).toBe(false);
    for(const control of foreground.composition.controls.filter(control=>control.visible)){expect(control.rect.width,control.label+' width').toBeGreaterThanOrEqual(44);expect(control.rect.height,control.label+' height').toBeGreaterThanOrEqual(44);}expect(foreground.composition.controls.filter(control=>control.visible)).toHaveLength(2);expect(foreground.composition.documentOverflow).toBeLessThanOrEqual(1);expect(foreground.composition.frameOverflow).toBeLessThanOrEqual(1);
    expect(await writerOwnedState(page)).toEqual({...foregroundOwned,hash:new URL(foreground.collapsed.url).hash});expect([...fixture.memory.entries()].sort()).toEqual(foregroundPreferences);expect(fixture.bookyWrites().length).toBe(foregroundBookyWrites);retained(await actual(page),foregroundGlobe,true,false);
    await capture(fixture,testInfo,'booky-writer-filter-recovery-'+language+'-reader-foreground.png','Actual App; trusted entry retires previously open Booky help; selected reader owns focus, compact Booky stays available and decorative motion is paused. Original recovery captures remain separate.');
    const detailHandle=selectedReader.locator('.book-detail-mobile-handle');
    await expect(detailHandle).toHaveAttribute('aria-label',language==='ru'?'Свернуть сведения о книге':'Collapse book details');await input.tap(detailHandle,'show underlying catalog without closing the owned reader');
    await expect(selectedReader).toHaveAttribute('data-mobile-position','half');await expect(detailHandle).toHaveAttribute('aria-label',language==='ru'?'Развернуть сведения о книге':'Expand book details');await expect(detailHandle).toHaveAttribute('aria-expanded','true');
    foreground.half=await writerReaderComposition(page);expect(foreground.half.catalogVisible).toBe(true);expect(foreground.half.navigationVisible).toBe(false);expect(foreground.half.bookKey).toBe(selectedKey);expect(foreground.half.history).toEqual(foreground.collapsed.history);await expect(selectedControl).toHaveAttribute('aria-expanded','true');await expect(panel(page)).toHaveCount(0);
    await input.tap(detailHandle,'restore the existing full reader');await expect(selectedReader).toHaveAttribute('data-mobile-position','expanded');
    foreground.expandedAgain=await writerReaderComposition(page);expect(foreground.expandedAgain.catalogVisible).toBe(false);expect(foreground.expandedAgain.navigationVisible).toBe(false);expect(foreground.expandedAgain.bookKey).toBe(selectedKey);expect(foreground.expandedAgain.history).toEqual(foreground.collapsed.history);await expect(panel(page)).toHaveCount(0);await expect(pet(page)).toHaveAttribute('data-booky-reader-owned','true');await expect(pet(page)).toHaveAttribute('data-booky-reader-paused','true');
    const ownedReader=await writerOwnedState(page),readerHistory=foreground.collapsed.history;
    await help();await expect(pet(page)).toHaveAttribute('data-booky-reader-owned','true');await expect(pet(page)).toHaveAttribute('data-booky-reader-paused','false');
    const reopenedTraceStart=await page.evaluate(()=>performance.now());
    foreground.explicitReopen=await writerReaderObservation(page);expect(foreground.explicitReopen.helpOpen).toBe(true);
    // No legacy filters() helper here: it deliberately collapses Booky itself.
    await input.tap(page.locator('.book-shelf-controls__advanced'),'open filters while explicitly reopened reader help stays open');await expect(drawer()).toBeVisible();await expect(panel(page)).toBeVisible();
    await expect.poll(()=>page.evaluate(since=>(window.__bookyReaderTrace??[]).some(row=>row.time>=since&&!row.view.active),reopenedTraceStart),{message:'Real filters deliver an inactive reader-view transition'}).toBe(true);
    await closeFilters();await expect(selectedReader).toBeVisible();await expect(panel(page)).toBeVisible();
    await input.expose(selectedReader.locator('.book-detail-close'),'return same reader to actual viewport with help still open');await expect(panel(page)).toBeVisible();
    await expect.poll(()=>page.evaluate(({since,key})=>(window.__bookyReaderTrace??[]).some(row=>row.time>=since&&row.view.active&&row.view.settled&&row.view.countryId+':'+row.view.writerId+':'+row.view.workId===key),{since:reopenedTraceStart,key:selectedKey}),{message:'The same reader owns its real view again after filters close'}).toBe(true);
    const originalViewport=page.viewportSize();
    await page.setViewportSize({width:language==='ru'?414:360,height:originalViewport.height});await writerSettle(page);await expect(panel(page)).toBeVisible();
    await page.emulateMedia({reducedMotion:'reduce'});await writerSettle(page);await expect(panel(page)).toBeVisible();
    await page.setViewportSize(originalViewport);await page.emulateMedia({reducedMotion:'no-preference'});await writerSettle(page);await expect(panel(page)).toBeVisible();await expect(pet(page)).toHaveAttribute('data-booky-reader-paused','false');
    foreground.sameEntry=await writerReaderObservation(page);expect(foreground.sameEntry.bookKey).toBe(selectedKey);expect(foreground.sameEntry.title).toBe(readerTitle);expect(foreground.sameEntry.history).toEqual(readerHistory);
    expect(await writerOwnedState(page)).toEqual(ownedReader);expect([...fixture.memory.entries()].sort()).toEqual(foregroundPreferences);expect(fixture.bookyWrites().length).toBe(foregroundBookyWrites);
    await collapse();await input.tap(selectedReader.locator('.book-detail-close'),'close reader without reopening retired Booky help');
    await expect(selectedReader).toHaveCount(0);await expect(panel(page)).toHaveCount(0);await expect(pet(page)).toHaveAttribute('data-booky-reader-owned','false');
    foreground.closed=await writerReaderObservation(page);expect(foreground.closed.history).toEqual(foreground.before.history);expect(await writerOwnedState(page)).toEqual(foregroundOwned);
    await help();await expect(panel(page)).toBeVisible();const reentryTraceStart=await page.evaluate(()=>performance.now());
    await input.tap(selectedControl,'reopen the same book after genuine Close while help is open');await expect(selectedReader).toBeVisible();
    await expect.poll(()=>page.evaluate(({since,key})=>(window.__bookyReaderTrace??[]).some(row=>row.time>=since&&row.view.active&&row.view.settled&&row.view.countryId+':'+row.view.writerId+':'+row.view.workId===key),{since:reentryTraceStart,key:selectedKey}),{message:'Genuine same-work reentry reports a new committed reader view'}).toBe(true);
    await expect(panel(page)).toHaveCount(0);await expect(pet(page)).toHaveAttribute('data-booky-reader-owned','true');await expect(pet(page)).toHaveAttribute('data-booky-reader-paused','true');await expect(page.locator('[data-booky-canvas]')).toHaveAttribute('data-booky-animating','false');
    await expect.poll(async()=>{const current=await writerReaderObservation(page);return current.focus.reader&&!current.focus.bookyToggle&&current.bookKey===selectedKey;}).toBe(true);
    foreground.reentered=await writerReaderObservation(page);expect(await writerOwnedState(page)).toEqual(ownedReader);expect([...fixture.memory.entries()].sort()).toEqual(foregroundPreferences);expect(fixture.bookyWrites().length).toBe(foregroundBookyWrites);retained(await actual(page),foregroundGlobe,true,false);
    foreground.readerViewTrace=await page.evaluate(since=>(window.__bookyReaderTrace??[]).filter(row=>row.time>=since),foregroundTraceStart);foreground.focusTrace=await page.evaluate(()=>window.__bookyReaderFocus??[]);
    foreground.checks=['Previously open help retires on an actual committed reader entry without moving focus to Booky','Retirement preserves semantic content, preferences, history and canonical resources','Explicit compact-toggle reopen survives actual inactive/active filter callbacks, width reflow and motion media changes','Genuine Close leaves retired help closed; same-work reentry retires newly reopened help again'].map(name=>({name,pass:true}));
    Object.assign(result,{readerForegroundExercised:true,readerAutomaticHelpRetirementVerified:true,readerExplicitReopenSurvivesInactiveViews:true,readerSameBookReentryVerified:true,readerDecorativePauseVerified:true});
    result.nativeReaderCompositionExercised=true;
    if(language==='ru'){
      const many=o.readerCompositionManyBooks={touchesStart:o.touches.length,selectionSetup:'Existing controlled native author picker; every footer/reader activation is trusted CDP touch',steps:[],checks:[]};
      await input.tap(selectedReader.locator('.book-detail-close'),'true Close returns functional catalog navigation');await expect(selectedReader).toHaveCount(0);await expect(page.locator('.book-shelf-navigation__position')).toBeVisible();
      await filters();await nativeSelect(drawer().locator('[data-book-author-filter]'),'','all real public authors for many-book browsing');await closeFilters();await expect(shelf()).toHaveValue('all');await expect(page.locator('.book-shelf-frame__catalog')).toBeVisible();
      const navigation=page.locator('.book-shelf-frame__navigation'),position=navigation.locator('.book-shelf-navigation__position'),rail=position.locator('input[type="range"]'),previous=position.locator('.book-shelf-navigation__single').nth(0),next=position.locator('.book-shelf-navigation__single').nth(1);
      await expect(position).toBeVisible();await expect(rail).toBeEnabled();const total=Number(await rail.getAttribute('max'));expect(total,'Actual public corpus has more than one browsable book').toBeGreaterThan(1);expect(Number(await navigation.getAttribute('data-navigation-count'))).toBe(total);many.total=total;
      const browsingOwned=await writerOwnedState(page),browsingPreferences=[...fixture.memory.entries()].sort(),browsingBookyWrites=fixture.bookyWrites().length,browsingGlobe=await actual(page);
      const observeStep=async(name,value)=>{await expect(rail).toHaveValue(String(value));await expect(position.locator('.book-shelf-navigation__count strong')).toHaveText(String(value));const current=await writerReaderComposition(page);expect(current.navigationCount).toBe(total);expect(current.navigationVisible).toBe(true);expect(current.catalogVisible).toBe(true);expect(current.bookKey).toBeNull();expect(current.documentOverflow).toBeLessThanOrEqual(1);expect(current.frameOverflow).toBeLessThanOrEqual(1);expect(current.history.context?.focusedBookKey?.length).toBeGreaterThan(0);expect(await previous.isDisabled()).toBe(value===1);expect(await next.isDisabled()).toBe(value===total);many.steps.push({name,value,focusedBookKey:current.history.context.focusedBookKey,layout:current});};
      await input.tap(rail,'trusted native range lower boundary',{minimum44:false,rangeEdge:'start'});await observeStep('first boundary',1);
      await input.tap(next,'one actual next book');await observeStep('next increments',2);
      await input.tap(previous,'one actual previous book');await observeStep('previous restores',1);
      await input.tap(rail,'trusted native range upper boundary',{minimum44:false,rangeEdge:'end'});await observeStep('last boundary',total);
      await input.tap(previous,'previous from last boundary');await observeStep('previous decrements',total-1);
      for(const control of (await writerReaderComposition(page)).controls.filter(control=>control.visible)){expect(control.rect.width,control.label+' width').toBeGreaterThanOrEqual(44);expect(control.rect.height,control.label+' height').toBeGreaterThanOrEqual(44);}
      await capture(fixture,testInfo,'native-reader-composition-many-books-ru.png','Actual native App public catalog with observed N>1, trusted single-step navigation and visible 44px previous/count/next. This additional browsing capture is separate from the original six recovery/reader captures.');
      await input.tap(rail,'return to actual first boundary',{minimum44:false,rangeEdge:'start'});await observeStep('first boundary restored',1);expect(many.steps[1].focusedBookKey).not.toBe(many.steps[0].focusedBookKey);expect(many.steps[2].focusedBookKey).toBe(many.steps[0].focusedBookKey);expect(many.steps[4].focusedBookKey).not.toBe(many.steps[3].focusedBookKey);
      expect(await writerOwnedState(page)).toEqual(browsingOwned);expect([...fixture.memory.entries()].sort()).toEqual(browsingPreferences);expect(fixture.bookyWrites().length).toBe(browsingBookyWrites);retained(await actual(page),browsingGlobe,true,false);
      const availableBook=page.locator('.archive-book-detail[data-book-key]').first(),manyReaderKey=await availableBook.getAttribute('data-book-key');expect(manyReaderKey).toMatch(/^[^:]+:[^:]+:[^:]+$/u);many.readerExpectedKey=manyReaderKey;
      const beforeManyReader=await page.evaluate(()=>window.__bookySupportFixture.historyObservation());await input.tap(availableBook,'open an actually loaded real reader from the many-book catalog');await expect(selectedReader).toHaveAttribute('data-mobile-position','expanded');await expect(availableBook).toHaveAttribute('aria-expanded','true');
      many.reader=await writerReaderComposition(page);expect(many.reader.bookKey).toBe(manyReaderKey);expect(many.reader.catalogVisible).toBe(false);expect(many.reader.navigationVisible).toBe(false);expect(many.reader.navigationCount).toBe(total);expect(many.reader.controls.filter(control=>control.visible)).toHaveLength(2);for(const control of many.reader.controls.filter(control=>control.visible)){expect(control.rect.width).toBeGreaterThanOrEqual(44);expect(control.rect.height).toBeGreaterThanOrEqual(44);}
      await input.tap(selectedReader.locator('.book-detail-close'),'true Close restores the many-book catalog footer');await expect(selectedReader).toHaveCount(0);await expect(position).toBeVisible();await expect.poll(()=>page.evaluate(()=>window.__bookySupportFixture.historyObservation())).toEqual(beforeManyReader);
      many.closed=await writerReaderComposition(page);expect(many.closed.catalogVisible).toBe(true);expect(many.closed.navigationVisible).toBe(true);expect(many.closed.navigationCount).toBe(total);
      many.checks=['Real observed N>1 catalog keeps bounded trusted previous/next and native range boundary semantics','Visible footer controls are at least44px with no horizontal overflow','Catalog navigation preserves selected country/writer, saved content, preferences, Booky progress and canonical resources','Mounted reader hides disabled navigation; true Close restores functional catalog navigation and exact prior history'].map(name=>({name,pass:true}));result.nativeManyBookCatalogNavigationVerified=true;
    }
    fixture.verify();
  } catch(error) {
    const filename='diagnostic-failure-'+language+'.png';const bytes=await page.screenshot({path:testInfo.outputPath(filename)});o.failureCapture={filename,sha256:digest(bytes),scope:'failure diagnosis only; not a successful contract capture',error:error.message};await testInfo.attach('diagnostic-failure-'+language,{path:testInfo.outputPath(filename),contentType:'image/png'});throw error;
  } finally {o.readerViewTrace=await page.evaluate(()=>window.__bookyReaderTrace??[]);o.readerFocusTrace=await page.evaluate(()=>window.__bookyReaderFocus??[]);o.authorEffectTrace=await page.evaluate(()=>window.__bookyAuthorTrace??[]);await input.close();await fixture.close();}
});
