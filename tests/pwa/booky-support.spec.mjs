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
const SEED = {schemaVersion:1,audience:'adult',visible:true,resume:{route:'overview',stepId:'collection'}};
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
  const sourcePaths = [...new Set([...required, ...inputs.filter(value => value.startsWith('src/') && !value.includes('?')), 'tests/pwa/booky-support.spec.mjs'])].sort();
  const sourceInputs = await Promise.all(sourcePaths.map(async filename => ({ path: filename, sha256: digest(await fs.readFile(path.join(ROOT, filename))) })));
  files = new Map(built.outputFiles.map(file => ['/fixture/' + path.relative(output, file.path).replaceAll('\\', '/'), Buffer.from(file.contents)]));
  const selectionBytes = await fs.readFile(path.join(ROOT, 'scripts/mobile/native-base-assets.json'));
  selectedAssets = new Map(JSON.parse(selectionBytes).files.map(entry => {
    if (entry.source !== 'public/' + entry.output || entry.transformation !== 'none' || /(?:^|\/)\.\.(?:\/|$)|\\/u.test(entry.output)) throw Error('Invalid selected native asset');
    return ['/' + entry.output, entry];
  }));
  sourceEvidence = { kind: 'canonical-app-adult-booky-support-in-Chromium', actualApp: true, actualCss: true, actualGlobe: true,
    controlledPorts: ['native OS plugins and preferences backed by a Node map', 'HTTP responses for real dynamic country, book runtime and collection component chunks'],
    bookChunks, primaryBookChunk, retryBookChunk, sharedBookDependencies,
    countryChunks, primaryCountryChunk, retryCountryChunk, sharedCountryDependencies,
    componentChunks, primaryComponentChunk, retryComponentChunk, sharedComponentDependencies, sourceInputs,
    cameraAuthority: 'Companion show/hide/tour steps do not own the camera. Only existing canonical App navigation owns scene changes; no fixture camera assignments.',
    representation: 'Unchanged live companion. Actual-App RU/EN support observes native network hints and real dynamic book loader failures. The fixture expands canonical Vite globs and builds in-memory esbuild ESM chunks; this is source behavior evidence, not a dist artifact, installed-device or service-availability test.',
    fallbackArtwork: { path: ASSET, sha256: ASSET_SHA, bytes: assetBytes.length, width: 1254, height: 1254, pngColorType: 6,
      bundledPath: '/fixture/' + path.relative(output, assetOutput.path).replaceAll('\\', '/') },
    publicAssetSelectionSha256: digest(selectionBytes), selectedAssetCount: selectedAssets.size,
    builtFiles: built.outputFiles.map(file => ({ path: path.relative(output, file.path).replaceAll('\\', '/'), sha256: digest(file.contents) })),
    installedNative: false, deviceTested: false, childReviewed: false, childProfileCreated: false, childAccessGranted: false, reviewedDialogueAccepted: false, narrationEnabled: false, artAccepted: false, devicePerformanceAccepted: false, releaseReady: false };
});

async function open(testInfo, { rejectBooks = 0, rejectCountries = 0, rejectComponents = 0, holdBooksAfterFailures = false, bookySeed = SEED } = {}) {
  const profileRoot = path.resolve(process.env.S15_BROWSER_PROFILE_ROOT ?? path.join(ROOT, '.tmp/s15-booky-live'));
  await fs.mkdir(profileRoot, { recursive: true }); const profile = await fs.mkdtemp(path.join(profileRoot, 'pk-'));
  const context = await chromium.launchPersistentContext(profile, { channel: process.env.S15_BROWSER_CHANNEL || 'chrome', headless: true,
    viewport: { width: 1440, height: 850 }, reducedMotion: 'reduce', hasTouch: true });
  const page = await context.newPage(); page.setDefaultTimeout(12_000);
  const initialRecord = JSON.stringify({ schemaVersion: 1, commitId: 'booky-support-fixture:1', selection: BASE });
  const memory = new Map([['probpera-interface-language', 'ru'], ['probpera-planet-welcome-v1', 'completed'], [KEY, initialRecord], [BOOKY, JSON.stringify(bookySeed)]]);
  const operations = [], errors = [], externalRequests = [], missingResources = [];
  const bookRequests = [], countryRequests = [], componentRequests = [], controlledFailures = [];
  const failuresRemaining = { books: rejectBooks, countries: rejectCountries, component: rejectComponents };
  let bookDeliveryHeld = holdBooksAfterFailures;
  const bookDeliveryEvents = [];
  const bookEvent = value => { if (holdBooksAfterFailures) { expect(bookDeliveryEvents.length).toBeLessThan(64); bookDeliveryEvents.push({ at: Date.now(), ...value }); } };
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
      if (target === 'books') bookEvent({ kind: 'request', path: pathname, remainingFailures: failuresRemaining.books, held: bookDeliveryHeld });
      if (failuresRemaining[target] > 0 || target === 'books' && bookDeliveryHeld) {
        if (failuresRemaining[target] > 0) failuresRemaining[target]--;
        controlledFailures.push({ path: pathname, status: 503 });
        await route.fulfill({ status: 503, contentType: 'text/plain', body: 'Controlled chunk transport failure' });
        if (target === 'books') bookEvent({ kind: 'response', path: pathname, status: 503, controlledTransportFailure: true });
        return; }
    }
    if (!files.has(pathname) && selectedAssets.has(pathname)) {
      const entry = selectedAssets.get(pathname), filename = path.resolve(ROOT, entry.source);
      if (await fs.realpath(filename) !== filename) throw Error('Linked selected asset');
      const bytes = await fs.readFile(filename); if (digest(bytes) !== entry.sourceSha256) throw Error('Stale selected fixture asset: ' + entry.output);
      files.set(pathname, bytes);
    }
    const bytes = files.get(pathname);
    if (bytes) { await route.fulfill({ contentType: mime[path.extname(pathname)] ?? 'application/octet-stream', body: bytes });
      if (target === 'books') bookEvent({ kind: 'response', path: pathname, status: 200, sha256: digest(bytes), bytes: bytes.length });
      return; }
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
    return { page, memory, operations, result, initialRecord, bookySeed, bookRequests, countryRequests, componentRequests, controlledFailures, bookDeliveryEvents,
      restoreBookDelivery() {
        expect(holdBooksAfterFailures).toBe(true); expect(bookDeliveryHeld).toBe(true); expect(failuresRemaining.books).toBe(0);
        bookDeliveryHeld = false;
        const available = bookChunks.map(filename => { const bytes = files.get(filename); expect(bytes).toBeTruthy();
          return { path: filename, sha256: digest(bytes), bytes: bytes.length }; });
        bookEvent({ kind: 'delivery-restored', available }); return available;
      },
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
        if (holdBooksAfterFailures) result.bookDeliveryEvents = bookDeliveryEvents;
        result.errors = errors; result.externalRequests = externalRequests; result.missingResources = missingResources;
        const filename = testInfo.outputPath('booky-support.json'); await fs.writeFile(filename, JSON.stringify(result, null, 2) + '\n');
        await testInfo.attach('booky-support-source-evidence', { path: filename, contentType: 'application/json' }); await context.close();
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
      const header=rect('.planet-mascot-controls__heading');
      const headerTargets=[...document.querySelectorAll('.planet-mascot-controls__heading h2, .planet-mascot-controls__heading button')]
        .filter(element=>!element.closest('[hidden], [inert], [aria-hidden="true"]')&&element.getClientRects().length
          &&getComputedStyle(element).visibility==='visible'&&getComputedStyle(element).display!=='none')
        .map(element=>{const rectangle=bounds(element),hit=document.elementFromPoint(rectangle.left+rectangle.width/2,rectangle.top+rectangle.height/2);
          return{kind:element.tagName,label:element.textContent.trim(),...rectangle,reachable:!!hit&&element.contains(hit),
            overlapsPet:overlaps(rectangle,pet),overlapsAvatar:overlaps(rectangle,avatar)};});
      const contains=(outer,inner,tolerance=.5)=>!!outer&&!!inner&&inner.left>=outer.left-tolerance&&inner.top>=outer.top-tolerance
        &&inner.right<=outer.right+tolerance&&inner.bottom<=outer.bottom+tolerance;
      // Open help reserves a header column for the same companion. Its visual
      // avatar and hit area must fit there and keep the title/buttons clear.
      const petInReservedHeader=contains(panel,pet)&&contains(pet,avatar)&&contains(header,pet,2)&&contains(header,avatar,2)
        &&headerTargets.some(target=>target.kind==='H2')&&headerTargets.some(target=>target.kind==='BUTTON')
        &&headerTargets.every(target=>!target.overlapsPet&&!target.overlapsAvatar&&contains(header,target)
          &&(target.kind!=='BUTTON'||target.reachable));
      const languageButtons=[...document.querySelectorAll('.native-planet-app .interface-language-control button')]
        .filter(button=>!button.closest('[hidden], [inert], [aria-hidden="true"]')&&button.getClientRects().length
          &&getComputedStyle(button).visibility==='visible'&&getComputedStyle(button).display!=='none')
        .map(button=>{const rectangle=bounds(button),center={x:rectangle.left+rectangle.width/2,y:rectangle.top+rectangle.height/2};
          const hit=document.elementFromPoint(center.x,center.y);
          return{label:button.textContent.trim(),...rectangle,center,reachable:!!hit&&button.contains(hit),
            overlapsPet:overlaps(rectangle,pet),overlapsPanel:overlaps(rectangle,panel),
            hitTarget:hit?{tag:hit.tagName,className:typeof hit.className==='string'?hit.className:null}:null};});
      return{width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth+1,
        pet,panel,avatar,header,headerTargets,petInReservedHeader,languageButtons,panelOverlapsPet:overlaps(panel,pet),panelOverlapsAvatar:overlaps(panel,avatar)};
    });
    const inside=rect=>rect&&rect.width>0&&rect.height>0&&rect.left>=-.5&&rect.top>=-.5
      &&rect.right<=layout.width+.5&&rect.bottom<=layout.height+.5;
    const clearCompanion=(!layout.panelOverlapsPet&&!layout.panelOverlapsAvatar)||layout.petInReservedHeader;
    const valid=!layout.overflow&&clearCompanion
      &&[layout.pet,layout.panel,layout.avatar].every(inside)
      &&layout.languageButtons.length===2&&layout.languageButtons.map(button=>button.label).sort().join(',')==='EN,RU'
      &&layout.languageButtons.every(button=>inside(button)&&button.reachable&&!button.overlapsPet&&!button.overlapsPanel);
    const geometry=JSON.stringify([layout.width,layout.height,layout.pet,layout.panel,layout.avatar,layout.header,layout.headerTargets,
      layout.languageButtons.map(({left,top,right,bottom,width,height})=>({left,top,right,bottom,width,height}))]);
    stableSamples=valid?(geometry===previousGeometry?stableSamples+1:1):0;
    previousGeometry=valid?geometry:undefined;
    layout.stableSamples=stableSamples;
    return stableSamples>=2;
  },{intervals:[100,200,300],message:'Two stable narrow samples keep the companion separate or inside its reserved header without covering title/buttons; all content fits and both language controls are clickable'}).toBe(true).catch(error => { error.bookyNarrowLayout = layout; throw error; });
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

test('network support preserves the adult tour and scene across locales, narrow view and lifecycle changes without opening itself', async ({}, testInfo) => {
  test.setTimeout(120_000);
  const fixture = await open(testInfo), { page, result } = fixture;
  try {
    await expect(pet(page)).toHaveAttribute('data-planet-mascot-visibility', 'shown');
    await expect(panel(page)).toHaveCount(0); await expect(support(page)).toHaveCount(0);
    await page.evaluate(() => window.__bookySupportFixture.remember()); await stablePose(page);
    const original = await actual(page);
    await network(page, 'offline');
    await expect(panel(page)).toHaveCount(0); await expect(support(page)).toHaveCount(0);
    expect(fixture.bookyWrites()).toEqual([]); retained(await actual(page), original);
    result.observations.offlineKeepsPanelClosed = await snapshot(page);

    await page.locator('[data-planet-mascot-toggle]').click();
    await expect(support(page)).toHaveAttribute('data-booky-support', 'offline');
    await expect(support(page).getByRole('heading', { name: 'Сейчас нет подключения', exact: true })).toBeVisible();
    await expect(support(page)).toContainText('уже доступными на устройстве');
    await expect(page.locator('[data-booky-retry-content]')).toHaveCount(0);
    await page.locator('[data-planet-mascot-resume]').click();
    await expect(pet(page)).toHaveAttribute('data-planet-mascot-current-route', 'overview');
    await expect(pet(page)).toHaveAttribute('data-planet-mascot-step', '2');
    retained(await actual(page), original); expect(fixture.bookyWrites()).toEqual([]);
    result.observations.offlineRu = await snapshot(page);

    await locale(page, 'en'); await page.setViewportSize({ width: 320, height: 844 });
    await expect(support(page).getByRole('heading', { name: 'Currently offline', exact: true })).toBeVisible();
    await expect(support(page)).toContainText('already available on this device');
    const layout = await fitNarrow(page); await stablePose(page);
    const narrow = await actual(page); retained(narrow, original, false);
    await expect(page.locator('[data-planet-mascot-avatar]')).toHaveAttribute('data-renderer-state', 'live3d');
    result.observations.offlineEn320 = { ...await snapshot(page), layout };
    await capture(fixture, testInfo, 'booky-support-offline-en-320.png', 'Actual App with explicit open Booky support and restored adult tour; canonical globe retained');

    await network(page, 'unknown');
    await expect(support(page)).toHaveAttribute('data-booky-support', 'network-unknown');
    await expect(support(page).getByRole('heading', { name: 'Connection status is unknown', exact: true })).toBeVisible();
    await expect(page.locator('[data-booky-retry-content]')).toHaveCount(0);
    retained(await actual(page), narrow); result.observations.unknown = await snapshot(page);
    await network(page, 'online'); await expect(support(page)).toHaveCount(0);
    await expect(pet(page)).toHaveAttribute('data-planet-mascot-current-route', 'overview');
    await expect(pet(page)).toHaveAttribute('data-planet-mascot-step', '2');
    retained(await actual(page), narrow); expect(fixture.bookyWrites()).toEqual([]);
    result.observations.onlineRemovesNetworkHint = await snapshot(page);

    await page.locator('[data-planet-mascot-collapse]').click();
    await network(page, 'offline'); await expect(panel(page)).toHaveCount(0); await expect(support(page)).toHaveCount(0);
    await page.locator('[data-planet-mascot-toggle]').click(); await expect(support(page)).toHaveAttribute('data-booky-support', 'offline');
    await page.evaluate(() => window.__bookySupportFixture.setVisible(false));
    await expect(panel(page)).toHaveCount(0); await expect(support(page)).toHaveCount(0);
    await network(page, 'unknown');
    await page.evaluate(() => window.__bookySupportFixture.setVisible(true));
    await expect(pet(page)).toHaveAttribute('data-planet-mascot-visibility', 'shown');
    await expect(panel(page)).toHaveCount(0); await expect(support(page)).toHaveCount(0);
    await expect(pet(page)).toHaveAttribute('data-planet-mascot-current-route', 'overview');
    await expect(pet(page)).toHaveAttribute('data-planet-mascot-step', '2');
    expect(fixture.bookyWrites()).toEqual([]); expect(JSON.parse(fixture.memory.get(BOOKY))).toEqual(SEED);
    retained(await actual(page), narrow); result.observations.resumedClosed = await snapshot(page);

    await page.locator('[data-planet-mascot-hide]').click();
    await expect.poll(() => JSON.parse(fixture.memory.get(BOOKY))).toEqual(HIDDEN);
    const writesAfterExplicitHide = fixture.bookyWrites().length;
    expect(writesAfterExplicitHide).toBe(1);
    for (const value of ['offline', 'unknown', 'online']) await network(page, value);
    await expect(pet(page)).toHaveAttribute('data-planet-mascot-visibility', 'hidden');
    await expect(panel(page)).toHaveCount(0); await expect(support(page)).toHaveCount(0);
    await expect(page.locator('[data-booky-canvas]')).toHaveCount(0);
    expect(fixture.bookyWrites()).toHaveLength(writesAfterExplicitHide); retained(await actual(page), narrow);
    expect(fixture.writes()).toEqual([]); expect(fixture.memory.get(KEY)).toBe(fixture.initialRecord);
    Object.assign(result, { supportOnlyInsideExplicitOpenPanel: true, localeAndNarrowViewRetainTour: true,
      offlineUnknownOnlineDoNotChangePreferences: true, hiddenAndCollapsedStayClosed: true,
      backgroundClosesAndResumeDoesNotReopen: true, explicitHideIsOnlyBookyWrite: true,
      canonicalSceneAndSelectionRetained: true, noAppearanceWrites: true, noEndpointReachabilityClaim: true });
    fixture.verify();
  } finally { await fixture.close(); }
});

test('a real book chunk failure stays visible across network hints and only explicit recovery retries the collection', async ({}, testInfo) => {
  test.setTimeout(120_000);
  const fixture = await open(testInfo, { rejectBooks: 1 }), { page, result } = fixture;
  try {
    await expect.poll(() => fixture.controlledFailures.length).toBe(1);
    await expect(panel(page)).toHaveCount(0); await expect(support(page)).toHaveCount(0);
    await page.locator('[data-planet-mascot-toggle]').click();
    await page.locator('[data-planet-mascot-action="books"]').click();
    await expect(pet(page)).toHaveAttribute('data-planet-mascot-screen', 'collection');
    await expect(support(page)).toHaveAttribute('data-booky-support', 'books-error');
    await expect(support(page).getByRole('heading', { name: 'Не удалось открыть коллекцию', exact: true })).toBeVisible();
    await expect(page.locator('[data-booky-retry-content="books"]')).toBeVisible();
    await expect(page.locator('[data-booky-recovery-return]')).toBeVisible();
    await page.evaluate(() => window.__bookySupportFixture.remember()); await stablePose(page);
    const original = await actual(page), failedRequests = fixture.bookRequests.length;
    result.observations.failedRu = await snapshot(page);
    for (const value of ['offline', 'unknown', 'online']) {
      await network(page, value);
      await expect(support(page)).toHaveAttribute('data-booky-support', 'books-error');
      expect(fixture.bookRequests).toHaveLength(failedRequests);
      retained(await actual(page), original);
    }
    await locale(page, 'en'); await page.setViewportSize({ width: 320, height: 844 });
    await expect(support(page).getByRole('heading', { name: 'The collection could not be opened', exact: true })).toBeVisible();
    const layout = await fitNarrow(page); await stablePose(page);
    const narrow = await actual(page); retained(narrow, original, false);
    result.observations.errorEn320 = { ...await snapshot(page), layout };
    await capture(fixture, testInfo, 'booky-support-collection-error-en-320.png', 'Actual App collection failure from HTTP 503 on the real dynamic book chunk; explicit Booky retry and return controls');
    expect(fixture.bookyWrites()).toEqual([]); expect(fixture.bookRequests).toHaveLength(failedRequests);

    // A native online hint is not proof that this loader has recovered. Only
    // its actual retry completion may clear the content error.
    await page.locator('[data-booky-retry-content="books"]').click();
    await expect.poll(() => fixture.bookRequests.length).toBeGreaterThan(failedRequests);
    expect(fixture.bookRequests).toEqual([primaryBookChunk, retryBookChunk]);
    expect(fixture.controlledFailures).toEqual([{ path: primaryBookChunk, status: 503 }]);
    await expect(support(page)).toHaveCount(0);
    await expect(page.locator('.stage5-deferred-books')).toHaveAttribute('data-loading-status', 'ready');
    await expect(pet(page)).toHaveAttribute('data-planet-mascot-screen', 'collection');
    retained(await actual(page), narrow); result.observations.recovered = await snapshot(page);
    expect(fixture.bookyWrites()).toEqual([]); expect(JSON.parse(fixture.memory.get(BOOKY))).toEqual(SEED);
    expect(fixture.writes()).toEqual([]); expect(fixture.memory.get(KEY)).toBe(fixture.initialRecord);
    Object.assign(result, { realSplitChunkFailure: true, networkHintsCannotClearContentError: true,
      explicitRetryLoadsCanonicalCollection: true, distinctBoundedRetryUrl: true, canonicalBookDependenciesShared: true,
      noAutomaticRetry: true, sameCanonicalSceneWithinLoad: true,
      noAutomaticNavigationDuringRecovery: true, narrowErrorFits: true, noAppearanceWrites: true });
    fixture.verify();
  } finally { await fixture.close(); }
});


// Assessment-only observers for the single existing two-failure case. Read UI,
// trusted input and original HTTP bytes; never assign product state or focus.
async function retryAssessmentState(page) {
  const ui = await page.evaluate(() => ({ timeOrigin: performance.timeOrigin, href: location.href,
    detailStatus: document.querySelector('.stage5-deferred-books')?.getAttribute('data-loading-status') ?? null,
    selectedCountry: document.querySelector('[data-country-id]')?.getAttribute('data-country-id') ?? null,
    activeElement: document.activeElement ? { tag: document.activeElement.tagName, id: document.activeElement.id } : null }));
  return { ...await snapshot(page), ...ui };
}
async function observeRetryInput(page) {
  const retainedEvents = [];
  await page.exposeBinding('__bookyRecoveryInput', (_source, event) => { retainedEvents.push(event); });
  await page.evaluate(() => {
    const ownerSelector = '[data-booky-retry-content], [data-booky-restart-content], [data-atlas-action], [data-planet-mascot-toggle]';
    const evidence = window.__bookyRetryAssessment = { events: [], overflow: false, loadingStates: [] };
    const input = event => {
      const owner = event.target instanceof Element ? event.target.closest(ownerSelector) : null;
      if (!owner) return;
      if (evidence.events.length >= 32) { evidence.overflow = true; return; }
      evidence.events.push({ type: event.type, trusted: event.isTrusted,
        pointerType: 'pointerType' in event ? event.pointerType : null, tag: event.target.tagName,
        bookyRetry: owner.getAttribute('data-booky-retry-content'), atlasAction: owner.getAttribute('data-atlas-action'), bookyHelp: owner.hasAttribute('data-planet-mascot-toggle'), bookyRestart: owner.getAttribute('data-booky-restart-content') });
      void window.__bookyRecoveryInput(evidence.events.at(-1)).catch(() => undefined);
    };
    for (const type of ['pointerdown', 'pointerup', 'click']) document.addEventListener(type, input, true);
    const record = () => {
      const status = document.querySelector('.stage5-deferred-books')?.getAttribute('data-loading-status') ?? null;
      if (evidence.loadingStates.at(-1)?.status === status) return;
      if (evidence.loadingStates.length >= 32) { evidence.overflow = true; return; }
      evidence.loadingStates.push({ at: performance.now(), status });
    };
    const observer = new MutationObserver(record);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-loading-status'] });
    record(); evidence.stop = () => { observer.disconnect(); for (const type of ['pointerdown', 'pointerup', 'click']) document.removeEventListener(type, input, true); };
  });
  return retainedEvents;
}
const retryInputEvidence = page => page.evaluate(() => {
  const evidence = window.__bookyRetryAssessment;
  return evidence ? { events: evidence.events, loadingStates: evidence.loadingStates, overflow: evidence.overflow } : null;
});
async function trustedRetryAssessmentTap(page, locator, label) {
  await expect(locator).toHaveCount(1); await expect(locator).toBeVisible(); await expect(locator).toBeEnabled();
  await locator.scrollIntoViewIfNeeded();
  const bounds = await locator.boundingBox(); expect(bounds, label + ' actual bounds').toBeTruthy();
  expect(bounds.width).toBeGreaterThanOrEqual(43.5); expect(bounds.height).toBeGreaterThanOrEqual(43.5);
  const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  expect(await locator.evaluate((owner, point) => { const hit = document.elementFromPoint(point.x, point.y);
    return !!hit && owner.contains(hit) && !owner.closest('[hidden], [inert], [aria-hidden="true"]'); }, center), label + ' direct owner hit').toBe(true);
  await page.touchscreen.tap(center.x, center.y);
  return { label, bounds, center, driver: 'Playwright touchscreen.tap with actual pointer/click isTrusted observations' };
}
async function assessRestoredBookRestart(fixture) {
  const { page, result } = fixture;
  const observation = result.observations.restoredDeliveryExplicitRestart = {
    before: await retryAssessmentState(page), requestsBefore: [...fixture.bookRequests],
    expectedTransportPathAfterRestart: primaryBookChunk, phase: 'before-extension', verified: false,
    originalNoSuccessfulCollectionClaim: result.noSuccessfulCollectionClaim,
  };
  const retainedInput = await observeRetryInput(page);
  try {
    observation.collectionTap = await trustedRetryAssessmentTap(page,
      page.locator('.atlas-immersive-chrome [data-atlas-action="open-collection"]'), 'existing collection toolbar');
    await expect(pet(page)).toHaveAttribute('data-planet-mascot-screen', 'collection');
    await expect(page.locator('.stage5-deferred-books')).toHaveAttribute('data-loading-status', 'error');
    expect(fixture.bookRequests).toEqual([primaryBookChunk, retryBookChunk]);
    await expect(panel(page)).toHaveCount(0);
    observation.helpTap = await trustedRetryAssessmentTap(page, page.locator('[data-planet-mascot-toggle]'), 'explicitly reopen Booky help');
    await expect(support(page)).toHaveAttribute('data-booky-support', 'books-error');
    await expect(page.locator('[data-booky-retry-content="books"]')).toHaveCount(0);
    await expect(page.locator('[data-booky-restart-content="books"]')).toHaveText('Перезапустить приложение');
    expect(fixture.bookRequests).toEqual([primaryBookChunk, retryBookChunk]);
    observation.beforeRestoration = await retryAssessmentState(page);
    observation.availableBytes = fixture.restoreBookDelivery(); observation.phase = 'delivery-restored';
    await page.waitForTimeout(350);
    expect(fixture.bookRequests).toEqual([primaryBookChunk, retryBookChunk]);
    await expect(support(page)).toHaveAttribute('data-booky-support', 'books-error');
    observation.afterRestorationWithoutAction = await retryAssessmentState(page);
    expect(observation.afterRestorationWithoutAction.timeOrigin).toBe(observation.before.timeOrigin);
    expect(observation.afterRestorationWithoutAction.href).toBe(observation.before.href);
    retained(observation.afterRestorationWithoutAction.globe, observation.before.globe, false, false);
    expect(fixture.bookyWrites()).toEqual([]); expect(fixture.writes()).toEqual([]);
    observation.inputBeforeRestart = await retryInputEvidence(page);
    observation.phase = 'explicit-restart';
    const navigation = page.waitForEvent('framenavigated', frame => frame === page.mainFrame());
    observation.restartTap = await trustedRetryAssessmentTap(page,
      page.locator('[data-booky-restart-content="books"]'), 'explicit application restart');
    await navigation;
    await ready(page);
    await page.evaluate(() => window.__bookySupportFixture.remember()); await stablePose(page);
    await expect.poll(() => retainedInput.filter(event => event.bookyRestart === 'books' && event.trusted).length).toBe(3);
    expect(retainedInput.some(event => event.type === 'pointerdown' && event.trusted && event.pointerType === 'touch' && event.bookyRestart === 'books')).toBe(true);
    expect(retainedInput.some(event => event.type === 'click' && event.trusted && event.bookyRestart === 'books')).toBe(true);
    observation.afterRestart = await retryAssessmentState(page);
    expect(observation.afterRestart.timeOrigin).not.toBe(observation.before.timeOrigin);
    expect(observation.afterRestart.href).toBe(observation.before.href);
    expect(observation.afterRestart.globe.surfaceCount).toBe(1);
    expect(observation.afterRestart.globe.selection).toEqual(observation.before.globe.selection);
    observation.reopenCollectionTap = await trustedRetryAssessmentTap(page,
      page.locator('.atlas-immersive-chrome [data-atlas-action="open-collection"]'), 'collection after explicit restart');
    await expect(page.locator('.stage5-deferred-books')).toHaveAttribute('data-loading-status', 'ready');
    await expect(support(page)).toHaveCount(0);
    await expect.poll(() => fixture.bookRequests.length).toBe(3);
    expect(fixture.bookRequests).toEqual([primaryBookChunk, retryBookChunk, primaryBookChunk]);
    const response = fixture.bookDeliveryEvents.filter(event => event.kind === 'response' && event.status === 200);
    expect(response).toHaveLength(1); expect(response[0].path).toBe(primaryBookChunk);
    expect(response[0].sha256).toBe(observation.availableBytes.find(item => item.path === primaryBookChunk).sha256);
    observation.afterRecovery = await retryAssessmentState(page);
    retained(observation.afterRecovery.globe, observation.afterRestart.globe, false, false);
    expect(fixture.controlledFailures).toEqual([{ path: primaryBookChunk, status: 503 }, { path: retryBookChunk, status: 503 }]);
    expect(fixture.bookyWrites()).toEqual([]); expect(JSON.parse(fixture.memory.get(BOOKY))).toEqual(fixture.bookySeed);
    expect(fixture.writes()).toEqual([]); expect(fixture.memory.get(KEY)).toBe(fixture.initialRecord);
    observation.phase = 'actual-ready-after-explicit-restart'; observation.verified = true;
    result.originalExhaustionSegmentNoSuccessfulCollectionClaim = observation.originalNoSuccessfulCollectionClaim;
    result.noSuccessfulCollectionClaim = false; result.restoredDeliveryExplicitRestartVerified = true;
  } catch (error) {
    observation.failure = { name: error.name, message: error.message, phase: observation.phase };
    observation.failureState = await retryAssessmentState(page).catch(sampleError => ({ observationError: sampleError.message }));
    observation.actualBookRequests = [...fixture.bookRequests]; result.pass = false; throw error;
  } finally {
    observation.retainedInputEvents = structuredClone(retainedInput);
    observation.inputInCurrentDocument = await retryInputEvidence(page).catch(() => null);
    observation.delivery = structuredClone(fixture.bookDeliveryEvents);
    await page.evaluate(() => window.__bookyRetryAssessment?.stop()).catch(() => undefined);
  }
}

test('when both book entry fetches fail the companion keeps an honest error and explicitly returns to the retained globe', async ({}, testInfo) => {
  test.setTimeout(120_000);
  // Recovery preserves a current preference; legacy schema migration is tested separately.
  const bookySeed = { schemaVersion: 2, audience: 'adult', visible: true,
    resume: { route: 'overview', routeVersion: 1, stepId: 'collection' }, progress: [] };
  const fixture = await open(testInfo, { rejectBooks: 2, holdBooksAfterFailures: true, bookySeed }), { page, result } = fixture;
  try {
    await expect.poll(() => fixture.controlledFailures.length).toBe(1);
    await page.setViewportSize({ width: 320, height: 844 });
    await page.evaluate(() => window.__bookySupportFixture.remember()); await stablePose(page);
    const original = await actual(page);
    await page.locator('[data-planet-mascot-toggle]').click();
    await page.locator('[data-planet-mascot-action="books"]').click();
    await expect(support(page)).toHaveAttribute('data-booky-support', 'books-error');
    await page.locator('[data-booky-retry-content="books"]').click();
    await expect.poll(() => fixture.controlledFailures.length).toBe(2);
    await expect(support(page)).toHaveAttribute('data-booky-support', 'books-error');
    await expect(page.locator('.stage5-deferred-books')).toHaveAttribute('data-loading-status', 'error');
    expect(fixture.bookRequests).toEqual([primaryBookChunk, retryBookChunk]);
    expect(fixture.controlledFailures).toEqual([
      { path: primaryBookChunk, status: 503 }, { path: retryBookChunk, status: 503 },
    ]);
    await expect(page.locator('[data-booky-retry-content="books"]')).toHaveCount(0);
    await expect(page.locator('[data-booky-restart-content="books"]')).toHaveText('Перезапустить приложение');
    const layout = await fitNarrow(page).catch(async error => {
      result.observations.narrowLayoutFailure = { layout: error.bookyNarrowLayout, state: await snapshot(page) };
      await capture(fixture, testInfo, 'booky-support-retry-failed-ru-320.png', 'Diagnostic: actual two-failure state before the existing narrow-layout assertion failed; recovery extension not reached');
      throw error;
    }); await stablePose(page);
    retained(await actual(page), original, false, false);
    result.observations.secondFailure = { ...await snapshot(page), layout };
    await capture(fixture, testInfo, 'booky-support-retry-failed-ru-320.png', 'Actual App remains failed after primary and retry book entry HTTP 503; explicit return to the globe remains available');
    for (const value of ['offline', 'unknown', 'online']) {
      await network(page, value);
      await expect(support(page)).toHaveAttribute('data-booky-support', 'books-error');
    }
    expect(fixture.bookRequests).toEqual([primaryBookChunk, retryBookChunk]);
    await page.locator('[data-booky-recovery-return]').click();
    await expect(pet(page)).toHaveAttribute('data-planet-mascot-screen', 'globe');
    await expect(support(page)).toHaveCount(0);
    await expect(globe(page)).toBeVisible(); await stablePose(page);
    retained(await actual(page), original, false, false);
    result.observations.explicitReturn = await snapshot(page);
    expect(fixture.bookRequests).toEqual([primaryBookChunk, retryBookChunk]);
    expect(fixture.bookyWrites()).toEqual([]); expect(JSON.parse(fixture.memory.get(BOOKY))).toEqual(fixture.bookySeed);
    expect(fixture.writes()).toEqual([]); expect(fixture.memory.get(KEY)).toBe(fixture.initialRecord);
    Object.assign(result, { realPrimaryAndRetryChunkFailures: true, persistentFailureStaysHonest: true,
      networkHintsCannotClearContentError: true, noAutomaticRetry: true, explicitReturnUsesCanonicalGlobe: true,
      noSuccessfulCollectionClaim: true, sameCanonicalSceneWithinLoad: true, noAppearanceWrites: true });
    await assessRestoredBookRestart(fixture);
    fixture.verify();
  } finally { await fixture.close(); }
});

test('a real country catalog failure reveals recovery before a globe exists and explicit retry mounts the canonical scene', async ({}, testInfo) => {
  test.setTimeout(120_000);
  const fixture = await open(testInfo, { rejectCountries: 1 }), { page, result } = fixture;
  try {
    await expect.poll(() => fixture.countryRequests.length).toBe(1);
    expect(fixture.countryRequests).toEqual([primaryCountryChunk]);
    expect(fixture.controlledFailures).toEqual([{ path: primaryCountryChunk, status: 503 }]);
    await expect(page.locator('#atlas canvas')).toHaveCount(0);
    expect(await sample(page)).toBeNull();
    await expect(panel(page)).toHaveCount(0); await expect(support(page)).toHaveCount(0);
    const initialUrl = page.url();
    result.actualGlobeInitiallyMounted = false;
    result.observations.beforeExplicitOpen = await snapshot(page);

    await page.locator('[data-planet-mascot-toggle]').click();
    await expect(support(page)).toHaveAttribute('data-booky-support', 'countries-error');
    await expect(support(page).getByRole('heading', { name: 'Не удалось открыть страны', exact: true })).toBeVisible();
    await expect(page.locator('[data-booky-retry-content="countries"]')).toBeVisible();
    await expect(page.locator('[data-booky-retry-content="books"]')).toHaveCount(0);
    await expect(page.locator('[data-booky-recovery-return]')).toHaveCount(0);
    await locale(page, 'en'); await page.setViewportSize({ width: 320, height: 844 });
    await expect(support(page).getByRole('heading', { name: 'Countries could not be opened', exact: true })).toBeVisible();
    const layout = await fitNarrow(page);
    result.observations.countryErrorEn320 = { ...await snapshot(page), layout };
    await capture(fixture, testInfo, 'booky-support-countries-error-en-320.png', 'Actual App catalog HTTP 503 exposes Booky recovery before any canonical globe is mounted; no previous scene is claimed');
    for (const value of ['offline', 'unknown', 'online']) {
      await network(page, value);
      await expect(support(page)).toHaveAttribute('data-booky-support', 'countries-error');
    }
    expect(fixture.countryRequests).toEqual([primaryCountryChunk]);
    expect(fixture.bookRequests).toEqual([]); expect(fixture.bookyWrites()).toEqual([]);
    expect(page.url()).toBe(initialUrl);

    await page.locator('[data-booky-retry-content="countries"]').click();
    await expect.poll(() => fixture.countryRequests.length).toBe(2);
    expect(fixture.countryRequests).toEqual([primaryCountryChunk, retryCountryChunk]);
    await ready(page); await expect(support(page)).toHaveCount(0);
    await expect(pet(page)).toHaveAttribute('data-planet-mascot-screen', 'globe');
    await page.evaluate(() => window.__bookySupportFixture.remember()); await stablePose(page);
    const recovered = await actual(page);
    expect(recovered.selection).toEqual(BASE); expect(page.url()).toBe(initialUrl);
    result.observations.canonicalGlobeAfterRetry = await snapshot(page);
    expect(fixture.bookyWrites()).toEqual([]); expect(JSON.parse(fixture.memory.get(BOOKY))).toEqual(SEED);
    expect(fixture.writes()).toEqual([]); expect(fixture.memory.get(KEY)).toBe(fixture.initialRecord);
    Object.assign(result, { realCountryCatalogFailure: true, errorRevealedBeforeGlobeMount: true,
      noInitialSceneRetentionClaim: true, explicitRetryMountsCanonicalGlobe: true, distinctBoundedCountryRetryUrl: true,
      canonicalCountryDependenciesShared: true, networkHintsCannotClearContentError: true,
      noAutomaticRetry: true, noAutomaticNavigationDuringRecovery: true, noAppearanceWrites: true });
    fixture.verify();
  } finally { await fixture.close(); }
});

test('a real collection component failure retries its own distinct entry while reusing loaded books and the canonical globe', async ({}, testInfo) => {
  test.setTimeout(120_000);
  const fixture = await open(testInfo, { rejectComponents: 1 }), { page, result } = fixture;
  try {
    await page.locator('[data-planet-mascot-toggle]').click();
    await page.locator('[data-planet-mascot-action="books"]').click();
    await expect.poll(() => fixture.componentRequests.length).toBe(1);
    expect(fixture.componentRequests).toEqual([primaryComponentChunk]);
    expect(fixture.controlledFailures).toEqual([{ path: primaryComponentChunk, status: 503 }]);
    await expect(support(page)).toHaveAttribute('data-booky-support', 'books-error');
    await expect(page.locator('.stage5-deferred-books')).toHaveAttribute('data-loading-status', 'error');
    await expect(support(page).getByRole('heading', { name: 'Не удалось открыть коллекцию', exact: true })).toBeVisible();
    await page.setViewportSize({ width: 320, height: 844 });
    const layout = await fitNarrow(page);
    await page.evaluate(() => window.__bookySupportFixture.remember()); await stablePose(page);
    const original = await actual(page);
    result.observations.componentErrorRu320 = { ...await snapshot(page), layout };
    await capture(fixture, testInfo, 'booky-support-component-error-ru-320.png', 'Actual App collection component HTTP 503 with loaded canonical book data, retained globe and explicit Booky retry');
    await locale(page, 'en');
    await expect(support(page).getByRole('heading', { name: 'The collection could not be opened', exact: true })).toBeVisible();
    for (const value of ['offline', 'unknown', 'online']) {
      await network(page, value);
      await expect(support(page)).toHaveAttribute('data-booky-support', 'books-error');
    }
    expect(fixture.componentRequests).toEqual([primaryComponentChunk]);
    const dataRequests = [...fixture.bookRequests]; expect(dataRequests).toEqual([primaryBookChunk]);
    retained(await actual(page), original); expect(fixture.bookyWrites()).toEqual([]);

    await page.locator('[data-booky-retry-content="books"]').click();
    await expect.poll(() => fixture.componentRequests.length).toBe(2);
    expect(fixture.componentRequests).toEqual([primaryComponentChunk, retryComponentChunk]);
    await expect(support(page)).toHaveCount(0);
    await expect(page.locator('.stage5-deferred-books')).toHaveAttribute('data-loading-status', 'ready');
    await expect(pet(page)).toHaveAttribute('data-planet-mascot-screen', 'collection');
    retained(await actual(page), original); result.observations.componentRecovered = await snapshot(page);
    expect(fixture.bookRequests).toEqual(dataRequests);
    expect(fixture.bookyWrites()).toEqual([]); expect(JSON.parse(fixture.memory.get(BOOKY))).toEqual(SEED);
    expect(fixture.writes()).toEqual([]); expect(fixture.memory.get(KEY)).toBe(fixture.initialRecord);
    Object.assign(result, { realCollectionComponentFailure: true, explicitRetryLoadsCanonicalComponent: true,
      distinctBoundedComponentRetryUrl: true, canonicalComponentDependenciesShared: true,
      loadedBookDataReusedWithoutRefetch: true, networkHintsCannotClearContentError: true, noAutomaticRetry: true,
      sameCanonicalSceneWithinLoad: true, noAutomaticNavigationDuringRecovery: true, noAppearanceWrites: true });
    fixture.verify();
  } finally { await fixture.close(); }
});
