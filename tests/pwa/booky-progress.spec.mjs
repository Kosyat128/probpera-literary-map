import { test, expect, chromium } from '@playwright/test';
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SITE = 'https://booky-progress.test';
const KEY = 'probpera-planet-composition-v1';
const BOOKY = 'probpera-booky-adult-v1';
const V1_SEED = {schemaVersion:1,audience:'adult',visible:true,resume:{route:'overview',stepId:'search'}};
const FUTURE = JSON.stringify({schemaVersion:91,audience:'adult',visible:false,resume:{route:'future-journey',routeVersion:3,stepId:'future-step'},progress:[{route:'future-journey',routeVersion:3,acknowledgedStepIds:['future-step']}],untouched:'future-record-bytes'});
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
  const output = path.join(ROOT, '.tmp/booky-progress-memory');
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
        set:async({key,value})=>{await window.__osPreference('set',key,value,window.__bookyProgressFixture.sample?.()??null)},
        remove:async({key})=>{await window.__osPreference('remove',key)}},
      browser:{open:async()=>{throw Error('External browser unavailable in this source fixture')}},appLauncher:{openUrl:async()=>({completed:false})}};
    const scenes=()=>[..._roots.entries()].map(([canvas,root])=>{const s=root.store.getState();
      return{canvas,renderer:s.gl,camera:s.camera,scene:s.scene,controls:s.controls,invalidate:s.invalidate}});
    const current=()=>scenes().find(value=>document.querySelector('#atlas')?.contains(value.canvas));
    const rounded=array=>array.map(n=>Number(n.toFixed(5)));
    const pose=root=>({position:rounded(root.camera.position.toArray()),quaternion:rounded(root.camera.quaternion.toArray()),
      zoom:root.camera.zoom,fov:root.camera.fov,target:root.controls?rounded(root.controls.target.toArray()):null});
    let original=null;
    window.__bookyProgressFixture={scenes,remember:()=>{original=current()},
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
        for(let i=0;i<2;i++){root.invalidate();await new Promise(requestAnimationFrame)}return window.__bookyProgressFixture.sample();},
    };
    createAndroidPlatformAdapter({bindings,channel:'dev'}).then(mountHostApp).catch(error=>{window.__bookyProgressFixtureError=error.message});
  ` }, bundle: true, write: false, metafile: true, outdir: output, entryNames: 'booky-progress', assetNames: 'assets/[name]-[hash]',
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
    'src/host/bookyModel.ts', 'src/host/bookyAnimation.ts', 'src/host/useBookyRenderer.ts', 'src/host/bookySupport.ts', 'src/host/bookyTourProgress.ts',
    'src/host/planetMascotPreference.ts', 'src/host/planetMascotPersistence.ts', 'src/host/HostPlatformServices.ts', ASSET];
  for (const filename of required) expect(inputs).toContain(filename);
  const sourcePaths = [...new Set([...required, ...inputs.filter(value => value.startsWith('src/') && !value.includes('?')), 'tests/pwa/booky-progress.spec.mjs'])].sort();
  const sourceInputs = await Promise.all(sourcePaths.map(async filename => ({ path: filename, sha256: digest(await fs.readFile(path.join(ROOT, filename))) })));
  files = new Map(built.outputFiles.map(file => ['/fixture/' + path.relative(output, file.path).replaceAll('\\', '/'), Buffer.from(file.contents)]));
  const selectionBytes = await fs.readFile(path.join(ROOT, 'scripts/mobile/native-base-assets.json'));
  selectedAssets = new Map(JSON.parse(selectionBytes).files.map(entry => {
    if (entry.source !== 'public/' + entry.output || entry.transformation !== 'none' || /(?:^|\/)\.\.(?:\/|$)|\\/u.test(entry.output)) throw Error('Invalid selected native asset');
    return ['/' + entry.output, entry];
  }));
  sourceEvidence = { kind: 'canonical-app-adult-booky-progress-in-Chrome', actualApp: true, actualCss: true, actualGlobe: true,
    controlledPorts: ['native OS plugins and preferences backed by a Node map, including controlled delayed preference reads'],
    bookChunks, primaryBookChunk, retryBookChunk, sharedBookDependencies,
    countryChunks, primaryCountryChunk, retryCountryChunk, sharedCountryDependencies,
    componentChunks, primaryComponentChunk, retryComponentChunk, sharedComponentDependencies, sourceInputs,
    cameraAuthority: 'Companion show/hide/tour steps do not own the camera. Only existing canonical App navigation owns scene changes; no fixture camera assignments.',
    representation: 'Unchanged live companion. Actual-App RU/EN navigation progress uses actual controller/persistence/adapters with controlled native preference storage and delayed reads. The fixture expands canonical Vite globs and builds in-memory esbuild ESM chunks; this is source behavior evidence, not a dist artifact, installed-device or literary-progress acceptance test.',
    fallbackArtwork: { path: ASSET, sha256: ASSET_SHA, bytes: assetBytes.length, width: 1254, height: 1254, pngColorType: 6,
      bundledPath: '/fixture/' + path.relative(output, assetOutput.path).replaceAll('\\', '/') },
    publicAssetSelectionSha256: digest(selectionBytes), selectedAssetCount: selectedAssets.size,
    builtFiles: built.outputFiles.map(file => ({ path: path.relative(output, file.path).replaceAll('\\', '/'), sha256: digest(file.contents) })),
    installedNative: false, deviceTested: false, childReviewed: false, childProfileCreated: false, childAccessGranted: false, reviewedDialogueAccepted: false, narrationEnabled: false, artAccepted: false, devicePerformanceAccepted: false, releaseReady: false };
});

async function open(testInfo, { seed = V1_SEED, holdInitialBookyRead = false } = {}) {
  const profileRoot = path.resolve(process.env.S15_BROWSER_PROFILE_ROOT ?? path.join(ROOT, '.tmp/s15-booky-live'));
  await fs.mkdir(profileRoot, { recursive: true }); const profile = await fs.mkdtemp(path.join(profileRoot, 'pk-'));
  const context = await chromium.launchPersistentContext(profile, { channel: 'chrome', headless: true,
    viewport: { width: 1440, height: 850 }, reducedMotion: 'reduce', hasTouch: true });
  const page = await context.newPage(); page.setDefaultTimeout(12_000);
  const initialRecord = JSON.stringify({ schemaVersion: 1, commitId: 'booky-progress-fixture:1', selection: BASE });
  const seedRaw = typeof seed === 'string' ? seed : JSON.stringify(seed);
  const memory = new Map([['probpera-interface-language', 'ru'], ['probpera-planet-welcome-v1', 'completed'], [KEY, initialRecord], [BOOKY, seedRaw]]);
  const operations = [], errors = [], externalRequests = [], missingResources = [];
  const bookRequests = [], countryRequests = [], componentRequests = [], controlledFailures = [];
  let pendingRead = null, holdNextRead = holdInitialBookyRead;
  const result = { ...sourceEvidence, initialBookyPreferenceRaw: seedRaw, pass: false, observations: {}, screenshots: [] };
  page.on('pageerror', error => errors.push(error.message));
  await page.exposeBinding('__osPreference', async (_source, operation, key, value, observed) => {
    const entry={ operation, key, ...(value === undefined ? {} : { value }), ...(observed ? { observed } : {}) };operations.push(entry);
    if (operation === 'get') {
      const stored=memory.get(key)??null; if(key===BOOKY)entry.result=stored;
      if(key===BOOKY&&holdNextRead){holdNextRead=false;entry.delayed=true;await new Promise(resolve=>{pendingRead=resolve;});pendingRead=null;}
      return stored;
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
      await route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="/fixture/booky-progress.css"></head><body><div id="root"></div><script type="module" src="/fixture/booky-progress.js"></script></body></html>' }); return;
    }
    const pathname = decodeURIComponent(url.pathname);
    const target = bookChunks.includes(pathname) ? 'books' : countryChunks.includes(pathname) ? 'countries'
      : componentChunks.includes(pathname) ? 'component' : null;
    if (target) {
      ({ books: bookRequests, countries: countryRequests, component: componentRequests })[target].push(pathname);
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
    await ready(page);
    return { page, memory, operations, result, initialRecord, seedRaw, bookRequests, countryRequests, componentRequests, controlledFailures,
      hasPendingRead:()=>!!pendingRead, releaseRead(){if(!pendingRead)throw Error("No native preference read is pending");pendingRead();},
      bookyWrites:()=>operations.filter(value=>value.operation==='set'&&value.key===BOOKY),
      writes: () => operations.filter(value => value.operation !== 'get' && CUSTOMIZATION_KEYS.has(value.key)),
      verify() { expect(errors).toEqual([]); expect(externalRequests).toEqual([]); expect(missingResources).toEqual([]);
        expect(operations.filter(value=>value.operation!=='get'&&![BOOKY,'probpera-interface-language','probpera-planet-recent-adult-v1'].includes(value.key))).toEqual([]);
        result.pass = true; },
      async close() {
        pendingRead?.();
        result.customizationWrites = operations.filter(value => value.operation !== 'get' && CUSTOMIZATION_KEYS.has(value.key));
        result.unexpectedPreferenceWrites = operations.filter(value => value.operation !== 'get' && ![BOOKY, 'probpera-interface-language', 'probpera-planet-recent-adult-v1'].includes(value.key));
        result.bookyWrites=operations.filter(value=>value.operation==='set'&&value.key===BOOKY);
        result.finalBookyPreferenceRaw=memory.get(BOOKY)??null;result.finalBookyPreference=JSON.parse(memory.get(BOOKY)??'null');
        result.preferenceOperations = operations; result.bookRequests = bookRequests; result.countryRequests = countryRequests;
        result.componentRequests = componentRequests; result.controlledFailures = controlledFailures;
        result.errors = errors; result.externalRequests = externalRequests; result.missingResources = missingResources;
        const filename = testInfo.outputPath('booky-progress.json'); await fs.writeFile(filename, JSON.stringify(result, null, 2) + '\n');
        await testInfo.attach('booky-progress-source-evidence', { path: filename, contentType: 'application/json' }); await context.close();
      } };
  } catch (error) { await context.close(); throw error; }
}
const sample = page => page.evaluate(() => window.__bookyProgressFixture.sample());
const globe = page => page.locator('#atlas .literary-globe');
const pet = page => page.locator('[data-planet-mascot-pet]');
const panel = page => page.locator('[data-planet-mascot-panel]');
async function ready(page) {
  await expect(page.locator('.native-planet-app[data-planet-ready="true"]')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.native-planet-launch')).toBeHidden();
  await expect(globe(page)).toHaveAttribute('data-globe-webgl-context', 'ready');
  await expect(globe(page)).toHaveAttribute('data-globe-camera-phase', 'idle');
  await expect(page.locator('#atlas canvas')).toHaveCount(1);
  expect(await page.evaluate(() => window.__bookyProgressFixtureError ?? null)).toBeNull();
}
async function actual(page) {
  let observed;
  await expect.poll(async () => { observed = await sample(page); return observed?.uploaded ? observed.selection : null; }).toEqual(BASE);
  observed = await page.evaluate(() => window.__bookyProgressFixture.renderSample());
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
      progress:[...document.querySelectorAll('[data-booky-tour-progress]')].map(item=>item.textContent),
      preferenceState:document.querySelector('[data-planet-mascot-preference-state]')?.getAttribute('data-planet-mascot-preference-state')??null,
      resetConfirmation:!!document.querySelector('[data-booky-confirm-reset]')};
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

async function locale(page, value) {
  await page.locator('.native-planet-app .interface-language-control button').filter({ hasText: new RegExp('^' + value.toUpperCase() + '$', 'u') }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', value);
}
async function capture(fixture, testInfo, filename, framing) {
  const bytes = await fixture.page.screenshot({ path: testInfo.outputPath(filename) });
  fixture.result.screenshots.push({ filename, sha256: digest(bytes), ...fixture.page.viewportSize(), framing });
}

const expectedV2 = (visible, stepId = null, acknowledgedStepIds = []) => ({ schemaVersion: 2, audience: 'adult', visible,
  resume: stepId ? { route: 'overview', routeVersion: 1, stepId } : null,
  progress: acknowledgedStepIds.length ? [{ route: 'overview', routeVersion: 1, acknowledgedStepIds }] : [] });
const routeProgress = page => page.locator('[data-booky-tour-progress="overview"]');
const preferenceNotice = page => page.locator('[data-planet-mascot-preference-state]');
async function persisted(fixture, expected) {
  await expect.poll(() => JSON.parse(fixture.memory.get(BOOKY) ?? 'null')).toEqual(expected);
  await expect(preferenceNotice(fixture.page)).toHaveCount(0);
  const confirmed = fixture.operations.filter(value => value.key === BOOKY && value.operation === 'get').at(-1);
  expect(JSON.parse(confirmed.result)).toEqual(expected);
}

test('v1 restores no acknowledgements; explicit next persists versioned progress through hide reload and deliberate resume', async ({}, testInfo) => {
  test.setTimeout(120_000);
  const fixture = await open(testInfo), { page, result } = fixture;
  try {
    await expect(pet(page)).toHaveAttribute('data-planet-mascot-visibility', 'shown');
    await expect(panel(page)).toHaveCount(0); await expect(preferenceNotice(page)).toHaveCount(0);
    expect(fixture.memory.get(BOOKY)).toBe(JSON.stringify(V1_SEED)); expect(fixture.bookyWrites()).toEqual([]);
    await page.evaluate(() => window.__bookyProgressFixture.remember()); await stablePose(page);
    const baseline = await actual(page); result.observations.coldV1Closed = await snapshot(page);

    await page.locator('[data-planet-mascot-toggle]').click();
    await expect(page.locator('[data-planet-mascot-resume-offer]')).toBeVisible();
    await expect(routeProgress(page)).toHaveText('Подтверждено шагов: 0 из 4');
    // Opening is explicit and may migrate valid v1 bytes, but creates no
    // acknowledged steps and never resumes or navigates by itself.
    await persisted(fixture, expectedV2(true, 'search'));
    await expect(pet(page)).toHaveAttribute('data-planet-mascot-mode', 'help');
    await page.locator('[data-planet-mascot-resume]').click();
    await expect(pet(page)).toHaveAttribute('data-planet-mascot-current-route', 'overview');
    await expect(pet(page)).toHaveAttribute('data-planet-mascot-step', '0');
    await expect(routeProgress(page)).toHaveText('Подтверждено шагов: 0 из 4');
    retained(await actual(page), baseline);
    await page.locator('[data-planet-mascot-next]').click();
    await expect(pet(page)).toHaveAttribute('data-planet-mascot-step', '1');
    await persisted(fixture, expectedV2(true, 'country', ['search']));
    await expect(routeProgress(page)).toHaveText('Подтверждено шагов: 1 из 4');
    result.observations.onlyAcknowledgedSearch = await snapshot(page); retained(await actual(page), baseline);

    await page.locator('[data-planet-mascot-hide]').click();
    await expect(pet(page)).toHaveAttribute('data-planet-mascot-visibility', 'hidden');
    await expect(panel(page)).toHaveCount(0); await expect(page.locator('[data-booky-canvas]')).toHaveCount(0);
    await persisted(fixture, expectedV2(false, 'country', ['search']));
    retained(await actual(page), baseline); result.observations.hiddenKeepsProgress = await snapshot(page);
    const writesBeforeReload = fixture.bookyWrites().length;
    await page.reload(); await ready(page);
    await expect(pet(page)).toHaveAttribute('data-planet-mascot-visibility', 'hidden');
    await expect(panel(page)).toHaveCount(0); await expect(preferenceNotice(page)).toHaveCount(0);
    expect(fixture.bookyWrites()).toHaveLength(writesBeforeReload);
    expect(JSON.parse(fixture.memory.get(BOOKY))).toEqual(expectedV2(false, 'country', ['search']));
    await page.evaluate(() => window.__bookyProgressFixture.remember()); await stablePose(page);
    const reloaded = await actual(page); result.observations.reloadClosed = await snapshot(page);

    await page.locator('[data-planet-mascot-toggle]').click();
    await expect(pet(page)).toHaveAttribute('data-planet-mascot-mode', 'help');
    await expect(page.locator('[data-planet-mascot-resume-offer]')).toBeVisible();
    await persisted(fixture, expectedV2(true, 'country', ['search']));
    retained(await actual(page), reloaded);
    await page.locator('[data-planet-mascot-resume]').click();
    await expect(pet(page)).toHaveAttribute('data-planet-mascot-step', '1');
    await locale(page, 'en'); await page.setViewportSize({ width: 320, height: 844 });
    await expect(routeProgress(page)).toHaveText('Steps acknowledged: 1 of 4');
    const layout = await fitNarrow(page); await stablePose(page);
    retained(await actual(page), reloaded, false);
    result.observations.resumedEn320 = { ...await snapshot(page), layout };
    await capture(fixture, testInfo, 'booky-progress-resumed-en-320.png', 'Actual App deliberate resume of one acknowledged navigation step after hidden restart; this is not reading or literary journey completion');
    expect(JSON.parse(fixture.memory.get(BOOKY))).toEqual(expectedV2(true, 'country', ['search']));
    expect(fixture.writes()).toEqual([]); expect(fixture.memory.get(KEY)).toBe(fixture.initialRecord);
    Object.assign(result, { scenario: 'legacy-progress', v1ColdReadDoesNotWrite: true, v1DoesNotInferAcknowledgements: true,
      explicitNextAcknowledgesOnlyCurrentStep: true, versionedSemanticProgressPersisted: true, hidePreservesResumeAndProgress: true,
      coldRestoreStaysClosed: true, explicitResumeRestoresSemanticStep: true, localeAndNarrowViewRetainProgress: true,
      sameCanonicalSceneWithinEachLoad: true, noAutomaticNavigation: true, noReadingCompletionClaim: true, noAppearanceWrites: true });
    fixture.verify();
  } finally { await fixture.close(); }
});

test('future saved progress remains byte exact through local interaction and cancellation until an explicitly confirmed global reset', async ({}, testInfo) => {
  test.setTimeout(120_000);
  const fixture = await open(testInfo, { seed: FUTURE }), { page, result } = fixture;
  try {
    await expect(preferenceNotice(page)).toHaveAttribute('data-planet-mascot-preference-state', 'failed');
    await expect(pet(page)).toHaveAttribute('data-planet-mascot-visibility', 'hidden');
    expect(fixture.memory.get(BOOKY)).toBe(FUTURE); expect(fixture.bookyWrites()).toEqual([]);
    await page.evaluate(() => window.__bookyProgressFixture.remember()); await stablePose(page);
    const baseline = await actual(page);
    await page.locator('[data-planet-mascot-toggle]').click();
    await expect(panel(page)).toBeVisible(); await expect(page.locator('[data-planet-mascot-resume-offer]')).toHaveCount(0);
    await expect(routeProgress(page)).toHaveText('Подтверждено шагов: 0 из 4');
    await page.locator('[data-booky-reset-progress]').click();
    await expect(page.locator('[data-booky-confirm-reset]')).toBeVisible();
    expect(fixture.memory.get(BOOKY)).toBe(FUTURE); expect(fixture.bookyWrites()).toEqual([]);
    await page.locator('[data-booky-cancel-reset]').click();
    await expect(page.locator('[data-booky-confirm-reset]')).toHaveCount(0);
    expect(fixture.memory.get(BOOKY)).toBe(FUTURE); expect(fixture.bookyWrites()).toEqual([]);
    retained(await actual(page), baseline); result.observations.futureUnchangedAfterCancel = await snapshot(page);

    await page.setViewportSize({ width: 320, height: 844 });
    await page.locator('[data-booky-reset-progress]').click();
    await page.locator('[data-booky-confirm-reset]').scrollIntoViewIfNeeded();
    const layout = await fitNarrow(page); await stablePose(page);
    const narrow = await actual(page); retained(narrow, baseline, false);
    result.observations.futureResetConfirmationRu320 = { ...await snapshot(page), layout, storedRaw: fixture.memory.get(BOOKY), writes: fixture.bookyWrites().length };
    await capture(fixture, testInfo, 'booky-progress-future-reset-ru-320.png', 'Actual App explicit reset confirmation while unsupported future preference bytes remain untouched');
    expect(fixture.memory.get(BOOKY)).toBe(FUTURE); expect(fixture.bookyWrites()).toEqual([]);
    await page.locator('[data-booky-confirm-reset]').click();
    await persisted(fixture, expectedV2(true));
    expect(fixture.bookyWrites()).toHaveLength(1);
    await expect(page.locator('[data-booky-confirm-reset]')).toHaveCount(0);
    await expect(routeProgress(page)).toHaveText('Подтверждено шагов: 0 из 4');
    retained(await actual(page), narrow); result.observations.confirmedReset = await snapshot(page);
    await page.locator('[data-planet-mascot-route="overview"]').click();
    await page.locator('[data-planet-mascot-next]').click();
    await persisted(fixture, expectedV2(true, 'country', ['search']));
    retained(await actual(page), narrow); result.observations.newProgressAfterReset = await snapshot(page);
    expect(fixture.writes()).toEqual([]); expect(fixture.memory.get(KEY)).toBe(fixture.initialRecord);
    Object.assign(result, { scenario: 'future-reset', futureRecordPreservedUntilConfirmation: true,
      cancelledResetDoesNotWrite: true, explicitGlobalResetClearsUnsupportedRecord: true,
      resetPreservesVisibilityAndPanel: true, normalProgressWritableAfterConfirmedReset: true,
      sameCanonicalSceneWithinLoad: true, noAutomaticNavigation: true, noAppearanceWrites: true });
    fixture.verify();
  } finally { await fixture.close(); }
});

test('a delayed future preference read cannot overwrite a newer local toggle or authorize an ordinary write', async ({}, testInfo) => {
  test.setTimeout(120_000);
  const fixture = await open(testInfo, { seed: FUTURE, holdInitialBookyRead: true }), { page, result } = fixture;
  try {
    await expect.poll(() => fixture.hasPendingRead()).toBe(true);
    await expect(preferenceNotice(page)).toHaveAttribute('data-planet-mascot-preference-state', 'loading');
    await page.locator('[data-planet-mascot-toggle]').click();
    await expect(panel(page)).toBeVisible(); await expect(pet(page)).toHaveAttribute('data-planet-mascot-visibility', 'shown');
    expect(fixture.bookyWrites()).toEqual([]); expect(fixture.memory.get(BOOKY)).toBe(FUTURE);
    result.observations.localToggleBeforeRead = await snapshot(page);
    fixture.releaseRead();
    await expect(preferenceNotice(page)).toHaveAttribute('data-planet-mascot-preference-state', 'failed');
    await expect(pet(page)).toHaveAttribute('data-planet-mascot-visibility', 'shown'); await expect(panel(page)).toBeVisible();
    await expect(page.locator('[data-planet-mascot-resume-offer]')).toHaveCount(0);
    expect(fixture.bookyWrites()).toEqual([]); expect(fixture.memory.get(BOOKY)).toBe(FUTURE);
    await page.evaluate(() => window.__bookyProgressFixture.remember()); await stablePose(page);
    const baseline = await actual(page);
    await locale(page, 'en'); await page.setViewportSize({ width: 320, height: 844 });
    await expect(routeProgress(page)).toHaveText('Steps acknowledged: 0 of 4');
    const layout = await fitNarrow(page); await stablePose(page);
    const narrow = await actual(page); retained(narrow, baseline, false);
    result.observations.delayedReadProtectedEn320 = { ...await snapshot(page), layout, storedRaw: fixture.memory.get(BOOKY), writes: fixture.bookyWrites().length };
    await capture(fixture, testInfo, 'booky-progress-delayed-future-en-320.png', 'Actual App retains the latest local show action after delayed unsupported preference read; no stored future data was overwritten');
    await page.locator('[data-planet-mascot-collapse]').click();
    await page.locator('[data-planet-mascot-toggle]').click();
    await page.locator('[data-planet-mascot-route="overview"]').click();
    await page.locator('[data-planet-mascot-next]').click();
    await expect(routeProgress(page)).toHaveText('Steps acknowledged: 1 of 4');
    expect(fixture.bookyWrites()).toEqual([]); expect(fixture.memory.get(BOOKY)).toBe(FUTURE);
    retained(await actual(page), narrow); result.observations.localProgressCannotOverwriteFuture = await snapshot(page);
    expect(fixture.operations.filter(value => value.key === BOOKY && value.operation === 'get' && value.delayed)).toHaveLength(1);
    expect(fixture.writes()).toEqual([]); expect(fixture.memory.get(KEY)).toBe(fixture.initialRecord);
    Object.assign(result, { scenario: 'delayed-future-read', delayedNativeReadObserved: true,
      pendingReadDoesNotAuthorizeWrites: true, lateUnsupportedReadPreservesLatestLocalToggle: true,
      ordinaryProgressCannotOverwriteFuture: true, noImplicitReset: true, sameCanonicalSceneWithinLoad: true,
      noAutomaticNavigation: true, noAppearanceWrites: true });
    fixture.verify();
  } finally { await fixture.close(); }
});
