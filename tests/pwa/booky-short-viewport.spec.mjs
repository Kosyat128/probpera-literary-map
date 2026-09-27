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
  const sourcePaths = [...new Set([...required, ...inputs.filter(value => value.startsWith('src/') && !value.includes('?')), 'tests/pwa/booky-short-viewport.spec.mjs'])].sort();
  const sourceInputs = await Promise.all(sourcePaths.map(async filename => ({ path: filename, sha256: digest(await fs.readFile(path.join(ROOT, filename))) })));
  files = new Map(built.outputFiles.map(file => ['/fixture/' + path.relative(output, file.path).replaceAll('\\', '/'), Buffer.from(file.contents)]));
  const selectionBytes = await fs.readFile(path.join(ROOT, 'scripts/mobile/native-base-assets.json'));
  selectedAssets = new Map(JSON.parse(selectionBytes).files.map(entry => {
    if (entry.source !== 'public/' + entry.output || entry.transformation !== 'none' || /(?:^|\/)\.\.(?:\/|$)|\\/u.test(entry.output)) throw Error('Invalid selected native asset');
    return ['/' + entry.output, entry];
  }));
  sourceEvidence = { externalFixtureSha256: digest(await fs.readFile(fileURLToPath(import.meta.url))), kind: 'canonical-app-booky-observed-short-space-in-Chrome', actualApp: true, actualCss: true, actualGlobe: true,
    controlledPorts: ['native OS plugins and preferences backed by a Node map', 'HTTP responses for real dynamic country, book runtime and collection component chunks with no injected HTTP transport failures; the persistence case rejects exactly one initial native Booky preference get', 'Only visualViewport.height is shadowed to 240 with synthetic resize and a labelled external hit-occluding overlay; not a native keyboard or real viewport contraction'],
    bookChunks, primaryBookChunk, retryBookChunk, sharedBookDependencies,
    countryChunks, primaryCountryChunk, retryCountryChunk, sharedCountryDependencies,
    componentChunks, primaryComponentChunk, retryComponentChunk, sharedComponentDependencies, sourceInputs,
    cameraAuthority: 'Companion show/hide/tour steps do not own the camera. Only existing canonical App navigation owns scene changes; no fixture camera assignments.',
    representation: 'Actual-App RU390/EN320 portrait observed-space stress uses trusted Search focus, read-only geometry/scene/current-owner observations, a disclosed viewport-height getter shadow and external labelled occluder. No app state setter or camera assignment is used. The fixture expands canonical Vite globs and builds in-memory esbuild ESM chunks; this is source behavior evidence, not a dist artifact, installed-device or service-availability test.',
    fallbackArtwork: { path: ASSET, sha256: ASSET_SHA, bytes: assetBytes.length, width: 1254, height: 1254, pngColorType: 6,
      bundledPath: '/fixture/' + path.relative(output, assetOutput.path).replaceAll('\\', '/') },
    publicAssetSelectionSha256: digest(selectionBytes), selectedAssetCount: selectedAssets.size,
    builtFiles: built.outputFiles.map(file => ({ path: path.relative(output, file.path).replaceAll('\\', '/'), sha256: digest(file.contents) })),
    installedNative: false, deviceTested: false, childReviewed: false, childProfileCreated: false, childAccessGranted: false, reviewedDialogueAccepted: false, narrationEnabled: false, artAccepted: false, devicePerformanceAccepted: false, releaseReady: false };
});

async function open(testInfo, { rejectBooks = 0, rejectCountries = 0, rejectComponents = 0, language = 'ru', width = 390, rejectInitialBookyRead = false } = {}) {
  const profileRoot = path.resolve(process.env.S15_BROWSER_PROFILE_ROOT ?? path.join(ROOT, '.tmp/s15-booky-live'));
  await fs.mkdir(profileRoot, { recursive: true }); const profile = await fs.mkdtemp(path.join(profileRoot, 'pk-'));
  const context = await chromium.launchPersistentContext(profile, { channel: 'chrome', headless: true,
    viewport: { width, height: 844 }, reducedMotion: 'reduce', hasTouch: true });
  const page = await context.newPage(); page.setDefaultTimeout(12_000);
  const initialRecord = JSON.stringify({ schemaVersion: 1, commitId: 'booky-support-fixture:1', selection: BASE });
  const memory = new Map([['probpera-interface-language', language], ['probpera-planet-welcome-v1', 'completed'], [KEY, initialRecord], [BOOKY, JSON.stringify(SEED)]]);
  const operations = [], errors = [], externalRequests = [], missingResources = [];
  let rejectedBookyReads = rejectInitialBookyRead ? 1 : 0;
  const bookRequests = [], countryRequests = [], componentRequests = [], controlledFailures = [];
  const failuresRemaining = { books: rejectBooks, countries: rejectCountries, component: rejectComponents };
  const result = { ...sourceEvidence, pass: false, observations: {}, screenshots: [] };
  page.on('pageerror', error => errors.push(error.message));
  await page.exposeBinding('__osPreference', (_source, operation, key, value, observed) => {
    const entry={ operation, key, ...(value === undefined ? {} : { value }), ...(observed ? { observed } : {}) };operations.push(entry);
    if (operation === 'get') {
      if(key===BOOKY&&rejectedBookyReads>0){rejectedBookyReads--;entry.rejected=true;entry.controlledFault='native Booky preference get rejected once';throw Error('Controlled native Booky read failure');}
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
        const filename = testInfo.outputPath('booky-short-viewport.json'); await fs.writeFile(filename, JSON.stringify(result, null, 2) + '\n');
        await testInfo.attach('booky-short-viewport-source-evidence', { path: filename, contentType: 'application/json' }); await context.close();
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


async function guidanceSettle(page){await page.evaluate(async()=>{await document.fonts.ready;await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);});}
async function globeGuidanceInputs(page, observation) {
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
      const middle=(top+bottom)/2;let start=middle+(down?-distance/2:distance/2),end=middle+(down?distance/2:-distance/2);
      const corridor=await locator.evaluate((element,{left,right,start,end,top,bottom,down,ownerIndex})=>{
        const scrollers=[];for(let parent=element.parentElement;parent;parent=parent.parentElement){const style=getComputedStyle(parent);if(/auto|scroll/.test(style.overflowY)&&parent.scrollHeight>parent.clientHeight+1)scrollers.push(parent);}const scroll=scrollers[ownerIndex];
        const describe=node=>({tag:node.tagName,className:typeof node.className==='string'?node.className:null,touchAction:getComputedStyle(node).touchAction,pointerEvents:getComputedStyle(node).pointerEvents,overflowY:getComputedStyle(node).overflowY,scrollTop:node.scrollTop,scrollHeight:node.scrollHeight,clientHeight:node.clientHeight,chosenScroll:node===scroll});
        const paths=[{start,end}];if(scroll?.hasAttribute('data-planet-mascot-pet'))for(const length of [64,48,32,24])for(let low=top+4;low+length<=bottom-4;low+=8)paths.push({start:down?low:low+length,end:down?low+length:low});
        const candidates=paths.flatMap(route=>[left+8,right-8,(left+right)/2].map(x=>({x,start:route.start,end:route.end,points:[route.start,(route.start+route.end)/2,route.end].map(y=>{const hit=document.elementFromPoint(x,y),ancestors=[];let current=hit;while(current){ancestors.push(describe(current));if(current===scroll)break;current=current.parentElement;}return {x,y,hit:hit?describe(hit):null,inside:!!scroll&&!!hit&&scroll.contains(hit),interactive:!!scroll&&!!hit&&(()=>{const owner=hit.closest('canvas,button,a,input,textarea,select,[role="button"],[data-planet-mascot-pet]');return !!owner&&owner!==scroll&&scroll.contains(owner);})(),ancestors};})})));
        const chosen=candidates.find(candidate=>candidate.points.every(point=>point.inside&&!point.interactive&&point.ancestors.every(node=>node.touchAction!=='none'&&(node.chosenScroll||!/auto|scroll/.test(node.overflowY)||node.scrollHeight<=node.clientHeight+1))));
        return {candidates,chosen:chosen?{x:chosen.x,start:chosen.start,end:chosen.end}:null};
      },{left,right,start,end,top,bottom,down,ownerIndex:state.scroll.index});
      const record={label,attempt,budget,ownerIndex:state.scroll.index,scrollersBefore:state.scrollers,before:state.scroll.top,direction:down?'toward top':'toward bottom',targetBefore:state.box,clipBefore:state.clip,distance,start,end,holdBeforeReleaseMs:180,corridor};observation.scrolls.push(record);
      if(corridor.chosen===null)throw Error(label+' has no touch-scroll corridor: '+JSON.stringify(record));
      const x=corridor.chosen.x;start=corridor.chosen.start;end=corridor.chosen.end;record.actualStart=start;record.actualEnd=end;record.actualDistance=Math.abs(end-start);await touch('touchStart',[{x,y:start}]);for(let step=1;step<=8;step++){await touch('touchMove',[{x,y:start+(end-start)*step/8}]);await page.waitForTimeout(35);}await page.waitForTimeout(180);await touch('touchEnd',[]);await page.waitForTimeout(100);await guidanceSettle(page);
      const after=await geometry(locator);record.after=after.scrollers.find(owner=>owner.index===record.ownerIndex)?.top??null;record.scrollersAfter=after.scrollers;record.targetAfter=after.box;
    }
  }
  async function tap(locator,label,{minimum44=true,moving=false}={}) {
    if(!moving)await expose(locator,label);let state,last=null,matches=0;
    if(moving){state=await geometry(locator);expect(state.hits.every(hit=>hit.inside),label+' current moving target hits').toBe(true);expect(state.box.top>=state.clip.top-.5&&state.box.bottom<=state.clip.bottom+.5&&state.box.left>=state.clip.left-.5&&state.box.right<=state.clip.right+.5,label+' current moving target contained').toBe(true);}else
    await expect.poll(async()=>{state=await geometry(locator);const key=JSON.stringify([state.box,state.clip,state.hits.map(hit=>hit.inside)]);matches=key===last?matches+1:1;last=key;return matches>=3&&state.hits.every(hit=>hit.inside);},{intervals:[80],message:label+' settled touch geometry'}).toBe(true);
    observation.targets.push({label,...state});
    if(minimum44){expect(state.box.width,label+' width').toBeGreaterThanOrEqual(44);expect(state.box.height,label+' height').toBeGreaterThanOrEqual(44);}expect(state.disabled,label+' enabled').toBe(false);
    await locator.evaluate(target=>{window.__writerRecoveryTouch=[];window.__d205TouchTarget=target;window.__d205TouchStarted=performance.now();for(const type of ['pointerdown','pointerup','click'])target.addEventListener(type,event=>window.__writerRecoveryTouch.push({type,trusted:event.isTrusted,pointerType:event.pointerType,pointerId:event.pointerId,intended:target.contains(event.target),sameTarget:event.currentTarget===target,connected:target.isConnected,eventTime:event.timeStamp,observedTime:performance.now()}),{once:true});});
    const record={label,events:[],singleTouch:true,maximumClickObservationMs:750};observation.touches.push(record);
    await touch('touchStart',[state.center]);await page.waitForTimeout(65);await touch('touchEnd',[]);await guidanceSettle(page);
    try{await expect.poll(async()=>{record.events=await page.evaluate(()=>window.__writerRecoveryTouch);const down=record.events.find(event=>event.type==='pointerdown');return record.events.some(event=>event.type==='click'&&event.trusted&&event.pointerType==='touch'&&event.intended&&event.sameTarget&&event.pointerId===down?.pointerId);},{timeout:750,intervals:[25,50,100],message:label+' one trusted click from the same single touch and target'}).toBe(true);}
    finally{record.events=await page.evaluate(()=>window.__writerRecoveryTouch);record.after=await page.evaluate(()=>{const target=window.__d205TouchTarget,r=target?.getBoundingClientRect(),pet=document.querySelector('[data-planet-mascot-pet]');return{elapsedMs:performance.now()-window.__d205TouchStarted,targetConnected:target?.isConnected,targetClass:target?.className,targetBounds:r?{left:r.left,top:r.top,width:r.width,height:r.height}:null,visibility:pet?.dataset.planetMascotVisibility,panel:pet?.dataset.planetMascotPanelState,focus:document.activeElement?.outerHTML.slice(0,300)};});}
    const events=record.events,down=events.find(event=>event.type==='pointerdown');for(const type of ['pointerdown','pointerup','click'])expect(events.some(event=>event.type===type&&event.trusted&&event.pointerType==='touch'&&event.intended&&event.sameTarget&&event.pointerId===down?.pointerId),label+' trusted '+type).toBe(true);
  }
  return {tap,expose,geometry,close:()=>cdp.detach()};
}

async function shortSpaceMeasure(page){return page.evaluate(()=>{
  const rect=node=>{const r=node.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
  const view=window.visualViewport,visual={left:view?.offsetLeft??0,top:view?.offsetTop??0,width:view?.width??innerWidth,height:view?.height??innerHeight};visual.right=visual.left+visual.width;visual.bottom=visual.top+visual.height;
  const visibleRect=element=>{if(element.closest('[hidden],[inert],[aria-hidden="true"]'))return null;const style=getComputedStyle(element),bounds=rect(element);if(style.display==='none'||style.visibility!=='visible'||Number(style.opacity)===0||bounds.width<2||bounds.height<2)return null;let left=Math.max(bounds.left,visual.left),top=Math.max(bounds.top,visual.top),right=Math.min(bounds.right,visual.right),bottom=Math.min(bounds.bottom,visual.bottom),clipAncestors=style.position!=='fixed';
    for(let parent=element.parentElement;parent;parent=parent.parentElement){const ps=getComputedStyle(parent);if(ps.display==='none'||Number(ps.opacity)===0)return null;if(clipAncestors&&parent!==document.body&&parent!==document.documentElement&&/hidden|clip|scroll|auto/.test(ps.overflowX+ps.overflowY)){const clip=rect(parent);if(/hidden|clip|scroll|auto/.test(ps.overflowX)){left=Math.max(left,clip.left);right=Math.min(right,clip.right);}if(/hidden|clip|scroll|auto/.test(ps.overflowY)){top=Math.max(top,clip.top);bottom=Math.min(bottom,clip.bottom);}}if(ps.position==='fixed')clipAncestors=false;}
    return right-left>=2&&bottom-top>=2?{left,top,right,bottom,width:right-left,height:bottom-top}:null;};
  const describe=node=>node?{tag:node.tagName,id:node.id,className:typeof node.className==='string'?node.className:null,stressOccluder:node.hasAttribute('data-d205-observed-space-occluder'),text:node.textContent?.trim().slice(0,90)}:null;
  const measure=selector=>{const node=document.querySelector(selector);if(!node)return{present:false};const bounds=rect(node),clip=visibleRect(node),center={x:(bounds.left+bounds.right)/2,y:(bounds.top+bounds.bottom)/2},points=[center,{x:center.x-bounds.width*.2,y:center.y},{x:center.x+bounds.width*.2,y:center.y}],hits=points.map(point=>{const hit=document.elementFromPoint(point.x,point.y);return{point,inside:!!hit&&node.contains(hit),hit:describe(hit)};});const full=!!clip&&bounds.left>=clip.left-.5&&bounds.top>=clip.top-.5&&bounds.right<=clip.right+.5&&bounds.bottom<=clip.bottom+.5;return{present:true,bounds,visibleRect:clip,fullRectangleExposed:full,hits,allHitsOwn:hits.every(row=>row.inside),minimum44:bounds.width>=44&&bounds.height>=44,disabled:!!node.disabled,computed:{display:getComputedStyle(node).display,visibility:getComputedStyle(node).visibility,touchAction:getComputedStyle(node).touchAction},text:node.textContent?.trim(),inlineStyle:node.getAttribute('style')};};
  const protectedRows=[...document.querySelectorAll('.native-planet-panel__header,.native-planet-app .atlas-immersive-chrome .interface-language-control')].map(node=>({node:describe(node),bounds:rect(node),visible:visibleRect(node)}));let top=visual.top;for(const row of protectedRows)if(row.visible)top=Math.max(top,row.visible.bottom);const reserved={left:visual.left,top,width:visual.width,height:Math.max(0,visual.bottom-top),right:visual.right,bottom:visual.bottom};
  const targets={pet:measure('[data-planet-mascot-pet]'),avatar:measure('[data-planet-mascot-avatar]'),move:measure('[data-planet-mascot-move]'),hide:measure('[data-planet-mascot-hide]'),walk:measure('[data-booky-walk]')};const pet=document.querySelector('[data-planet-mascot-pet]');
  // Read only the current committed owner tree; never call a setter or infer a
  // missing/alternate owner as a null desired position.
  const container=document.querySelector('#root'),key=container&&Object.keys(container).find(key=>key.startsWith('__reactContainer$')),containerFiber=key?container[key]:null,current=containerFiber?.stateNode?.current,owners=[];let scanned=0;const stack=current?[current]:[];
  while(stack.length&&scanned++<50000){const fiber=stack.pop(),props=fiber.memoizedProps;if(fiber.type?.name==='PlanetMascotControls'&&props&&Object.hasOwn(props,'position')&&typeof props.onPositionChange==='function'&&props.controller&&props.snapshot){owners.push({position:props.position===null?null:{left:props.position.left,top:props.position.top},screen:props.screen,mode:props.snapshot.mode,route:props.snapshot.route,revision:props.snapshot.revision});}if(fiber.sibling)stack.push(fiber.sibling);if(fiber.child)stack.push(fiber.child);}
  const restore=window.__d205ObservedSpaceRestore,focus=document.activeElement;
  return{layout:{innerWidth,innerHeight,clientWidth:document.documentElement.clientWidth,clientHeight:document.documentElement.clientHeight,portrait:matchMedia('(orientation:portrait)').matches,shortLandscape:matchMedia('(max-height:540px) and (orientation:landscape)').matches,orientation:screen.orientation?{type:screen.orientation.type,angle:screen.orientation.angle}:null},visual:{...visual,scale:view?.scale,offsetLeft:view?.offsetLeft,offsetTop:view?.offsetTop},nativeVisualHeight:restore?.nativeGetter?restore.nativeGetter.call(view):view?.height,protectedRows,reserved,targets,desiredPositionObservation:{method:'read-only current committed React owner memoizedProps.position; no setters or source transformation',currentRootFound:!!current,owners,scanned,limitReached:scanned>=50000},search:{expanded:document.querySelector('[data-atlas-action="toggle-search"]')?.getAttribute('aria-expanded'),inputValue:document.querySelector('[data-atlas-search-input]')?.value,focused:!!focus?.hasAttribute('data-atlas-search-input'),focus:describe(focus)},booky:{shortSpace:pet?.dataset.bookyShortSpace??null,panel:pet?.dataset.planetMascotPanelState,gesture:pet?.dataset.planetMascotGesture,route:pet?.dataset.planetMascotCurrentRoute,step:pet?.dataset.planetMascotStep,cueCount:document.querySelectorAll('[data-booky-target]').length},occluder:document.querySelector('[data-d205-observed-space-occluder]')?rect(document.querySelector('[data-d205-observed-space-occluder]')):null};
});}
async function shortSpaceSettle(page){let previous,matches=0,current;await expect.poll(async()=>{await guidanceSettle(page);current=await shortSpaceMeasure(page);const key=JSON.stringify([current.visual,current.reserved,Object.fromEntries(Object.entries(current.targets).map(([key,value])=>[key,value.bounds]))]);matches=key===previous?matches+1:1;previous=key;return matches;},{intervals:[80,100,150],message:'three stable measured short-space samples'}).toBeGreaterThanOrEqual(3);return current;}
async function installObservedSpace(page){return page.evaluate(()=>{
  const view=window.visualViewport;if(!view)throw Error('Real visualViewport required');if(window.__d205ObservedSpaceRestore||document.querySelector('[data-d205-observed-space-occluder]'))throw Error('Duplicate controlled viewport injection');
  const own=Object.getOwnPropertyDescriptor(view,'height');let owner=view,nativeDescriptor;while(owner&&!nativeDescriptor){nativeDescriptor=Object.getOwnPropertyDescriptor(owner,'height');owner=Object.getPrototypeOf(owner);}if(typeof nativeDescriptor?.get!=='function')throw Error('Native height getter unavailable');
  const occluder=document.createElement('div');occluder.setAttribute('data-d205-observed-space-occluder','');occluder.setAttribute('aria-hidden','true');occluder.style.cssText='position:fixed;left:0;right:0;top:240px;bottom:0;z-index:2147483646;pointer-events:auto;background:repeating-linear-gradient(135deg,#f0e7d8,#f0e7d8 14px,#ded2bf 14px,#ded2bf 28px);border-top:3px solid #962e20;box-sizing:border-box;padding:18px;color:#48251d;font:16px/1.5 sans-serif;';occluder.textContent='D205: контролируемая закрытая область ниже 240 px. Это тестовое перекрытие, не экранная клавиатура.';
  window.__d205ObservedSpaceRestore={view,own,prototype:Object.getPrototypeOf(view),nativeGetter:nativeDescriptor.get,occluder};Object.defineProperty(view,'height',{configurable:true,enumerable:own?.enumerable??true,get:()=>240});document.body.append(occluder);view.dispatchEvent(new Event('resize'));
  return{controlledObservedSpaceStress:true,mechanism:'own visualViewport.height shadow=240, synthetic visualViewport resize and labelled external hit-occluding overlay; no layout/media/scale/app/source override',nativeHeight:nativeDescriptor.get.call(view),observedHeight:view.height,sameVisualViewport:view===window.visualViewport};
});}
async function restoreObservedSpace(page){return page.evaluate(()=>{const saved=window.__d205ObservedSpaceRestore;if(!saved)return{restored:false,reason:'not installed'};if(saved.view!==visualViewport)throw Error('VisualViewport identity changed');if(saved.own)Object.defineProperty(saved.view,'height',saved.own);else delete saved.view.height;saved.occluder.remove();saved.view.dispatchEvent(new Event('resize'));const actual=Object.getOwnPropertyDescriptor(saved.view,'height'),descriptorRestored=saved.own?actual?.get===saved.own.get&&actual?.set===saved.own.set&&actual?.value===saved.own.value&&actual?.enumerable===saved.own.enumerable&&actual?.configurable===saved.own.configurable:actual===undefined;const result={restored:true,descriptorRestored,sameVisualViewport:saved.view===visualViewport,samePrototype:Object.getPrototypeOf(saved.view)===saved.prototype,height:saved.view.height,nativeHeight:saved.nativeGetter.call(saved.view),occluderRemoved:!saved.occluder.isConnected};delete window.__d205ObservedSpaceRestore;return result;});}

for(const [language,width] of [['ru',390],['en',320]])test('Booky short observed space controls '+language,async({},testInfo)=>{
  test.setTimeout(180_000);const fixture=await open(testInfo,{language,width}),{page,result}=fixture;result.scenario='booky-short-viewport-'+language;Object.assign(result,{controlledObservedSpaceStress:true,nativeKeyboardEquivalent:false,realVisualViewportContraction:false,applicationBehaviorOverridden:false,diagnosticCompleted:false,productExposurePass:false});
  const o=result.observations.shortViewport={touches:[],targets:[],scrolls:[],checks:[],findings:[]},input=await globeGuidanceInputs(page,o),saved=()=>[...fixture.memory.entries()].sort();let injectionActive=false;
  try{
    await page.setViewportSize({width,height:844});await page.emulateMedia({reducedMotion:'no-preference'});await ready(page);await guidanceSettle(page);await expect(panel(page)).toHaveCount(0);await expect(pet(page)).toHaveAttribute('data-planet-mascot-gesture','rest');await expect(page.locator('[data-booky-target]')).toHaveCount(0);
    const rotation=page.locator('#atlas [data-globe-control="auto-rotate"]');if(await rotation.getAttribute('aria-pressed')==='true')await input.tap(rotation,'pause canonical globe before observed-space diagnostic');await stablePose(page);
    await input.tap(page.locator('[data-atlas-action="toggle-search"]'),'open existing Search');await expect(page.locator('[data-atlas-action="toggle-search"]')).toHaveAttribute('aria-expanded','true');await input.tap(page.locator('[data-atlas-search-input]'),'trusted focus in existing Search input',{minimum44:false});await expect(panel(page)).toHaveCount(0);await stablePose(page);await page.evaluate(()=>window.__bookySupportFixture.remember());const original=await actual(page),preferences=saved(),operationStart=fixture.operations.length;
    o.baseline=await shortSpaceSettle(page);expect(o.baseline.layout).toMatchObject({innerWidth:width,innerHeight:844,portrait:true,shortLandscape:false});expect(o.baseline.search.focused).toBe(true);expect(o.baseline.desiredPositionObservation.currentRootFound).toBe(true);expect(o.baseline.desiredPositionObservation.owners).toHaveLength(1);for(const key of ['move','hide','walk'])expect(o.baseline.targets[key],key+' baseline exposure').toMatchObject({present:true,minimum44:true,fullRectangleExposed:true,allHitsOwn:true});expect(o.baseline.booky.shortSpace).toBeNull();o.originalGlobe=original;o.preferences=preferences;
    await capture(fixture,testInfo,'booky-short-viewport-'+language+'-baseline.png','Actual App at the recorded portrait width by 844 with trusted Search input focus, closed Booky help and measured reachable controls. No native keyboard is emulated.');
    o.injection=await installObservedSpace(page);injectionActive=true;o.contracted=await shortSpaceSettle(page);expect(o.contracted.booky.shortSpace).toBe('true');expect(o.contracted.layout).toEqual(o.baseline.layout);expect(o.contracted.visual).toMatchObject({...o.baseline.visual,height:240,bottom:o.baseline.visual.top+240});expect(o.contracted.nativeVisualHeight).toBe(o.baseline.visual.height);expect(o.contracted.search).toEqual(o.baseline.search);expect(o.contracted.desiredPositionObservation.owners).toHaveLength(1);expect(o.contracted.desiredPositionObservation.owners[0].position).toEqual(o.baseline.desiredPositionObservation.owners[0].position);retained(await actual(page),original);expect(saved()).toEqual(preferences);
    for(const key of ['move','hide','walk']){const target=o.contracted.targets[key];if(!target.present||!target.minimum44||!target.fullRectangleExposed||!target.allHitsOwn)o.findings.push({target:key,kind:'control-or-disabled-status-exposure-loss',bounds:target.bounds,visibleRect:target.visibleRect,minimum44:target.minimum44,allHitsOwn:target.allHitsOwn,disabled:target.disabled,hits:target.hits});}
    await capture(fixture,testInfo,'booky-short-viewport-'+language+'-contracted.png','Controlled observed-space stress: only visualViewport.height is shadowed to 240 and a labelled external occluder blocks hit testing below 240. Layout viewport and media state remain the recorded portrait width by 844. This is not a native keyboard or real viewport contraction.');
    o.restoration=await restoreObservedSpace(page);injectionActive=false;expect(o.restoration).toMatchObject({restored:true,descriptorRestored:true,sameVisualViewport:true,samePrototype:true,occluderRemoved:true});o.restored=await shortSpaceSettle(page);expect(o.restored.booky.shortSpace).toBeNull();expect(o.restored.layout).toEqual(o.baseline.layout);expect(o.restored.visual).toEqual(o.baseline.visual);expect(o.restored.search).toEqual(o.baseline.search);expect(o.restored.desiredPositionObservation.owners).toHaveLength(1);expect(o.restored.desiredPositionObservation.owners[0].position).toEqual(o.baseline.desiredPositionObservation.owners[0].position);expect(o.restored.targets.pet.bounds).toEqual(o.baseline.targets.pet.bounds);for(const key of ['move','hide','walk'])expect(o.restored.targets[key],key+' restored exposure').toMatchObject({present:true,minimum44:true,fullRectangleExposed:true,allHitsOwn:true});retained(await actual(page),original);expect(saved()).toEqual(preferences);expect(fixture.operations.slice(operationStart).filter(row=>row.operation!=='get')).toEqual([]);await expect(page.locator('[data-booky-target]')).toHaveCount(0);await expect(pet(page)).toHaveAttribute('data-planet-mascot-gesture','rest');
    await capture(fixture,testInfo,'booky-short-viewport-'+language+'-restored.png','Restored native visualViewport observation and removed test occluder; actual App Search focus, Booky position and canonical globe are retained without replay or preference writes.');
    if(language==='ru'){
      o.helpInjection=await installObservedSpace(page);injectionActive=true;await shortSpaceSettle(page);
      await input.tap(page.locator('[data-planet-mascot-toggle]'),'open Booky help under short observed space');await expect(panel(page)).toBeVisible();await shortSpaceSettle(page);
      await expect(pet(page)).toHaveAttribute('data-booky-short-space','true');o.shortHelp=await shortSpaceMeasure(page);expect(o.shortHelp.targets.pet.bounds.width).toBe(144);
      o.closeTarget=await input.expose(page.locator('[data-planet-mascot-collapse]'),'short-space help Close');expect(o.closeTarget.box.width).toBeGreaterThanOrEqual(44);expect(o.closeTarget.box.height).toBeGreaterThanOrEqual(44);expect(o.closeTarget.hits.every(hit=>hit.inside)).toBe(true);
      await capture(fixture,testInfo,'booky-short-viewport-ru-help.png','Actual trusted-open Booky help uses the 144px mobile pet variant under controlled observed-space stress. The exposed 44px Close target and trusted open/close actions are measured. No 194px tablet or enlarged-font claim.');
      await input.tap(page.locator('[data-planet-mascot-collapse]'),'close Booky help under short observed space');await expect(panel(page)).toHaveCount(0);await shortSpaceSettle(page);
      o.closedShowTarget=await input.expose(page.locator('[data-planet-mascot-toggle]'),'closed short-space Booky tips toggle');expect(o.closedShowTarget.box.width).toBeGreaterThanOrEqual(44);expect(o.closedShowTarget.box.height).toBeGreaterThanOrEqual(44);expect(o.closedShowTarget.hits.every(hit=>hit.inside)).toBe(true);
      o.helpRestoration=await restoreObservedSpace(page);injectionActive=false;expect(o.helpRestoration).toMatchObject({descriptorRestored:true,sameVisualViewport:true,samePrototype:true,occluderRemoved:true});await shortSpaceSettle(page);retained(await actual(page),original);expect(saved()).toEqual(preferences);expect(fixture.operations.slice(operationStart).filter(row=>row.operation!=='get')).toEqual([]);result.shortHelp144Exercised=true;
    }
    result.diagnosticCompleted=true;result.productExposurePass=o.findings.length===0;result.observedExposureLoss=o.findings.length>0;o.checks=[{name:'controlled observed-space stress leaves layout media scale and Search focus unchanged',pass:true},{name:'exact observation descriptor restoration retains local position preferences and canonical scene',pass:true},{name:'Booky controls and any disabled status remain fully exposed and hit reachable under short observed space',pass:result.productExposurePass}];
    result.controlsExposed=result.productExposurePass;result.descriptorRestored=true;result.canonicalStateRetained=true;result.noResizePreferenceWrites=true;result.exposureFindingCount=o.findings.length;if(language==='ru')o.checks.push({name:'trusted short-space help open and close expose 44px actions in the 144px mobile variant',pass:true});
    // A reproduced defect is a product assertion failure after restoration and
    // all three captures, never an expected-defect feature PASS.
    expect(o.findings,'All Move/Hide/Walk targets must retain full exposure and own hit points').toEqual([]);fixture.verify();
  }finally{if(injectionActive)o.emergencyRestoration=await restoreObservedSpace(page);await input.close();await fixture.close();}
});


test('Booky short observed space persistence Retry ru',async({},testInfo)=>{
  test.setTimeout(180_000);const fixture=await open(testInfo,{width:320,rejectInitialBookyRead:true}),{page,result}=fixture;result.scenario='booky-short-viewport-persistence-ru';Object.assign(result,{controlledObservedSpaceStress:true,nativeKeyboardEquivalent:false,realVisualViewportContraction:false,applicationBehaviorOverridden:false,controlledPreferenceReadFailure:true,diagnosticCompleted:false,productExposurePass:false});
  const o=result.observations.shortViewport={touches:[],targets:[],scrolls:[],checks:[],findings:[]},input=await globeGuidanceInputs(page,o),saved=()=>[...fixture.memory.entries()].sort();let injectionActive=false;
  try{
    await page.emulateMedia({reducedMotion:'no-preference'});await ready(page);const notice=page.locator('[data-planet-mascot-preference-state]'),retry=page.locator('[data-planet-mascot-retry-preference]');await expect(notice).toHaveAttribute('data-planet-mascot-preference-state','failed');await expect(notice).toContainText('Не удалось восстановить настройки помощника.');await expect(pet(page)).toHaveAttribute('data-planet-mascot-visibility','hidden');expect(fixture.operations.filter(row=>row.key===BOOKY&&row.rejected)).toHaveLength(1);expect(fixture.bookyWrites()).toEqual([]);
    o.setupBefore=fixture.operations.slice();await input.tap(page.locator('[data-planet-mascot-toggle]'),'explicit Show after rejected preference read');await expect(panel(page)).toBeVisible();await input.tap(page.locator('[data-planet-mascot-collapse]'),'close help while retaining failed read notice');await expect(panel(page)).toHaveCount(0);await expect(pet(page)).toHaveAttribute('data-planet-mascot-visibility','shown');await expect(notice).toHaveAttribute('data-planet-mascot-preference-state','failed');o.setupOperations=fixture.operations.slice(o.setupBefore.length);expect(fixture.bookyWrites()).toEqual([]);
    const rotation=page.locator('#atlas [data-globe-control="auto-rotate"]');if(await rotation.getAttribute('aria-pressed')==='true')await input.tap(rotation,'pause globe before persistence short-space phase');await stablePose(page);await page.evaluate(()=>window.__bookySupportFixture.remember());const original=await actual(page),preferences=saved(),operationStart=fixture.operations.length;o.originalGlobe=original;o.preferences=preferences;o.baseline=await shortSpaceSettle(page);
    o.injection=await installObservedSpace(page);injectionActive=true;o.contracted=await shortSpaceSettle(page);expect(o.contracted.booky.shortSpace).toBe('true');expect(o.contracted.layout).toEqual(o.baseline.layout);expect(o.contracted.nativeVisualHeight).toBe(o.baseline.visual.height);expect(o.contracted.desiredPositionObservation.owners).toHaveLength(1);expect(o.contracted.desiredPositionObservation.owners[0].position).toEqual(o.baseline.desiredPositionObservation.owners[0].position);
    o.scrollOwnership=await retry.evaluate(button=>{const owners=[];for(let node=button.parentElement;node;node=node.parentElement){const style=getComputedStyle(node);if(/auto|scroll/.test(style.overflowY)&&node.scrollHeight>node.clientHeight+1)owners.push({pet:node.hasAttribute('data-planet-mascot-pet'),className:node.className,overflowY:style.overflowY,scrollTop:node.scrollTop,scrollHeight:node.scrollHeight,clientHeight:node.clientHeight});}const n=button.closest('[data-planet-mascot-preference-state]');return{owners,noticeOverflowY:getComputedStyle(n).overflowY,noticeMaxHeight:getComputedStyle(n).maxHeight};});expect(o.scrollOwnership.owners).toHaveLength(1);expect(o.scrollOwnership.owners[0].pet).toBe(true);expect(o.scrollOwnership.noticeOverflowY).toBe('visible');expect(o.scrollOwnership.noticeMaxHeight).toBe('none');
    o.retryBefore=await input.geometry(retry);expect(o.retryBefore.box.bottom>o.retryBefore.clip.bottom+.5,'Retry initially extends beyond the outer pet scrollport').toBe(true);o.retryExposed=await input.expose(retry,'expose persistence Retry with trusted outer-pet scrolling');expect(o.retryExposed.box.width).toBeGreaterThanOrEqual(44);expect(o.retryExposed.box.height).toBeGreaterThanOrEqual(44);expect(o.retryExposed.hits.every(hit=>hit.inside)).toBe(true);expect(o.scrolls.some(row=>row.after>row.before)).toBe(true);expect(o.scrolls.every(row=>row.scrollersBefore[row.ownerIndex].className.includes('planet-mascot-controls'))).toBe(true);retained(await actual(page),original);expect(saved()).toEqual(preferences);expect(fixture.operations.slice(operationStart).filter(row=>row.operation!=='get')).toEqual([]);
    await capture(fixture,testInfo,'booky-short-viewport-persistence-ru-retry.png','Actual failed native preference-port read, explicitly shown Booky, and one outer pet scroll owner under controlled 240px observed height. Genuine touch scrolling has fully exposed the 44px Retry button; no record replacement or synthetic app status.');
    const retryStart=fixture.operations.length;await input.tap(retry,'retry actual failed Booky preference read');await expect(notice).toHaveCount(0);await expect(page.locator('[data-planet-mascot-toggle]')).toBeFocused();await expect(pet(page)).toHaveAttribute('data-planet-mascot-visibility','shown');await expect(panel(page)).toHaveCount(0);
    o.retryOperations=fixture.operations.slice(retryStart).filter(row=>row.key===BOOKY);expect(o.retryOperations.map(row=>row.operation)).toEqual(['get','set','get']);expect(o.retryOperations.filter(row=>row.operation==='set')).toHaveLength(1);expect(JSON.parse(o.retryOperations.find(row=>row.operation==='set').value)).toEqual(SEED);expect(fixture.operations.slice(operationStart).filter(row=>row.operation!=='get'&&row.key!==BOOKY)).toEqual([]);expect(saved()).toEqual(preferences);retained(await actual(page),original);
    o.restoration=await restoreObservedSpace(page);injectionActive=false;expect(o.restoration).toMatchObject({descriptorRestored:true,sameVisualViewport:true,samePrototype:true,occluderRemoved:true});o.restored=await shortSpaceSettle(page);expect(o.restored.booky.shortSpace).toBeNull();expect(o.restored.layout).toEqual(o.baseline.layout);expect(o.restored.visual).toEqual(o.baseline.visual);expect(o.restored.desiredPositionObservation.owners).toHaveLength(1);expect(o.restored.desiredPositionObservation.owners[0].position).toEqual(o.baseline.desiredPositionObservation.owners[0].position);for(const key of ['move','hide','walk'])expect(o.restored.targets[key],key+' after persistence recovery').toMatchObject({present:true,minimum44:true,fullRectangleExposed:true,allHitsOwn:true});retained(await actual(page),original);expect(saved()).toEqual(preferences);
    await capture(fixture,testInfo,'booky-short-viewport-persistence-ru-restored.png','Successful real preference Retry consumed the pending explicit Show intent with exactly one unchanged-value Booky write. The native height descriptor is restored, error notice removed, and globe/selection/progress retained. Retry deliberately focuses the stable Booky toggle.');
    Object.assign(result,{diagnosticCompleted:true,productExposurePass:true,descriptorRestored:true,canonicalStateRetained:true,trustedOuterPetScroll:true,retry44Exposed:true,singleNoticeScrollOwner:true,explicitShowWriteCount:1,exposureFindingCount:0});o.checks=[{name:'real failed preference read remains pending until trusted Retry',pass:true},{name:'one outer pet scroll owner exposes the full 44px Retry through genuine touch',pass:true},{name:'Retry confirms exactly the earlier explicit Show intent while preserving stored progress and canonical scene',pass:true},{name:'exact visualViewport descriptor and native identity restore after persistence recovery',pass:true}];fixture.verify();
  }finally{if(injectionActive)o.emergencyRestoration=await restoreObservedSpace(page);await input.close();await fixture.close();}
});
