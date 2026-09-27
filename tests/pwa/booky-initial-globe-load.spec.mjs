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
let countryChunks, primaryCountryChunk, retryCountryChunk, componentChunks, primaryComponentChunk, retryComponentChunk, geoJsonAsset;

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
  const geoJsonBytes = await fs.readFile(path.join(ROOT, 'src/data/geo/countries.geojson'));
  const geoJsonOutputs = built.outputFiles.filter(file => digest(file.contents) === digest(geoJsonBytes));
  expect(geoJsonOutputs).toHaveLength(1);
  geoJsonAsset = { input: 'src/data/geo/countries.geojson', url: '/fixture/' + path.relative(output, geoJsonOutputs[0].path).replaceAll('\\', '/'), sha256: digest(geoJsonBytes), bytes: geoJsonBytes.length };
  const required = ['src/host/bookyGlobeSupport.ts', 'src/App.tsx', 'src/host/mountHostApp.tsx', 'src/components/LiteraryGlobe.tsx', 'src/components/LiteraryWorldMap.tsx',
    'src/components/GlobeCameraRig.tsx', 'src/components/globeAtlas.ts', 'src/host/planetMascot.ts', 'src/host/planetMascotRoutes.ts',
    'src/host/PlanetMascotControls.tsx', 'src/host/PlanetMascotControls.css', 'src/host/PlanetMascotAvatar.tsx', 'src/host/PlanetMascotAvatar.css',
    'src/host/bookyModel.ts', 'src/host/bookyAnimation.ts', 'src/host/useBookyRenderer.ts', 'src/host/bookySupport.ts',
    'src/host/planetMascotPreference.ts', 'src/host/planetMascotPersistence.ts', 'src/host/HostPlatformServices.ts', ASSET];
  for (const filename of required) expect(inputs).toContain(filename);
  const sourcePaths = [...new Set([...required, 'src/data/geo/countries.geojson', 'src/host/bookyGlobeSupport.test.ts', 'src/host/planetMascot.test.ts', ...inputs.filter(value => value.startsWith('src/') && !value.includes('?')), "tests/pwa/booky-initial-globe-load.spec.mjs"])].sort();
  const sourceInputs = await Promise.all(sourcePaths.map(async filename => ({ path: filename, sha256: digest(await fs.readFile(path.join(ROOT, filename))) })));
  files = new Map(built.outputFiles.map(file => ['/fixture/' + path.relative(output, file.path).replaceAll('\\', '/'), Buffer.from(file.contents)]));
  const selectionBytes = await fs.readFile(path.join(ROOT, 'scripts/mobile/native-base-assets.json'));
  selectedAssets = new Map(JSON.parse(selectionBytes).files.map(entry => {
    if (entry.source !== 'public/' + entry.output || entry.transformation !== 'none' || /(?:^|\/)\.\.(?:\/|$)|\\/u.test(entry.output)) throw Error('Invalid selected native asset');
    return ['/' + entry.output, entry];
  }));
  sourceEvidence = { externalFixtureSha256: digest(await fs.readFile(fileURLToPath(import.meta.url))), kind: 'canonical-app-booky-initial-globe-load-in-Chrome', actualApp: true, actualCss: true, actualGlobe: true,
    controlledPorts: ['native OS plugins and preferences backed by a Node map', 'HTTP responses for real dynamic country, book runtime and collection component chunks with no injected transport failures', 'Actual canonical countries.geojson delivery held, failed with HTTP 503 and later restored; no runtime status overrides or native lifecycle equivalence'],
    geoJsonAsset, bookChunks, primaryBookChunk, retryBookChunk, sharedBookDependencies,
    countryChunks, primaryCountryChunk, retryCountryChunk, sharedCountryDependencies,
    componentChunks, primaryComponentChunk, retryComponentChunk, sharedComponentDependencies, sourceInputs,
    cameraAuthority: 'Companion show/hide/tour steps do not own the camera. Only existing canonical App navigation owns scene changes; no fixture camera assignments.',
    representation: 'Actual-App RU/EN initial globe loading uses trusted touch and read-only scene observations. Initial atlas asset latency and failure are controlled HTTP delivery; recovery uses the real existing Retry. The fixture expands canonical Vite globs and builds in-memory esbuild ESM chunks; this is source behavior evidence, not a dist artifact, installed-device or service-availability test.',
    fallbackArtwork: { path: ASSET, sha256: ASSET_SHA, bytes: assetBytes.length, width: 1254, height: 1254, pngColorType: 6,
      bundledPath: '/fixture/' + path.relative(output, assetOutput.path).replaceAll('\\', '/') },
    publicAssetSelectionSha256: digest(selectionBytes), selectedAssetCount: selectedAssets.size,
    builtFiles: built.outputFiles.map(file => ({ path: path.relative(output, file.path).replaceAll('\\', '/'), sha256: digest(file.contents) })),
    installedNative: false, deviceTested: false, childReviewed: false, childProfileCreated: false, childAccessGranted: false, reviewedDialogueAccepted: false, narrationEnabled: false, artAccepted: false, devicePerformanceAccepted: false, releaseReady: false };
});

async function open(testInfo, { language, width, rejectBooks = 0, rejectCountries = 0, rejectComponents = 0 } = {}) {
  const profileRoot = path.resolve(process.env.S15_BROWSER_PROFILE_ROOT ?? path.join(ROOT, '.tmp/s15-booky-live'));
  await fs.mkdir(profileRoot, { recursive: true }); const profile = await fs.mkdtemp(path.join(profileRoot, 'pk-'));
  const context = await chromium.launchPersistentContext(profile, { channel: 'chrome', headless: true,
    viewport: { width, height: 844 }, reducedMotion: 'reduce', hasTouch: true });
  const page = await context.newPage(); page.setDefaultTimeout(12_000);
  const initialRecord = JSON.stringify({ schemaVersion: 1, commitId: 'booky-support-fixture:1', selection: BASE });
  const memory = new Map([['probpera-interface-language', language], ['probpera-planet-welcome-v1', 'completed'], [KEY, initialRecord], [BOOKY, JSON.stringify(SEED)]]);
  const operations = [], errors = [], externalRequests = [], missingResources = [];
  const bookRequests = [], countryRequests = [], componentRequests = [], controlledFailures = [];
  const failuresRemaining = { books: rejectBooks, countries: rejectCountries, component: rejectComponents };
  let atlasDelivery='hold-initial';const atlasRequests=[],pendingAtlas=new Set();
  const releaseAtlas=delivery=>{atlasDelivery=delivery;if(!delivery.startsWith('hold-'))for(const release of [...pendingAtlas])release(delivery);};
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
    if(pathname===geoJsonAsset.url){
      const record={index:atlasRequests.length+1,path:pathname,requestedAt:Date.now(),deliveryAtRequest:atlasDelivery};atlasRequests.push(record);
      let delivery=atlasDelivery;
      if(delivery.startsWith('hold-'))delivery=await new Promise(resolve=>{const release=value=>{clearTimeout(deadline);pendingAtlas.delete(release);resolve(value);};const deadline=setTimeout(()=>{record.holdDeadlineExpired=true;release('fail');},60000);pendingAtlas.add(release);});
      record.deliveredAt=Date.now();record.delivery=delivery;record.status=delivery==='success'?200:503;
      if(delivery==='success'){const bytes=files.get(pathname);expect(digest(bytes)).toBe(geoJsonAsset.sha256);record.sha256=digest(bytes);await route.fulfill({status:200,contentType:'application/geo+json',body:bytes});}
      else{controlledFailures.push({path:pathname,status:503,scope:'actual initial atlas asset transport'});await route.fulfill({status:503,contentType:'text/plain',body:'Controlled initial atlas asset transport failure'});}return;
    }
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
    if (rejectCountries || atlasDelivery.startsWith('hold-')) {
      await expect(page.locator('.native-planet-app')).toBeVisible({ timeout: 60_000 });
      await expect(page.locator('.native-planet-launch')).toBeHidden({ timeout: 12_000 });
      await expect(pet(page)).toHaveAttribute('data-planet-mascot-visibility', 'shown');
    } else await ready(page);
    return { page, memory, operations, result, initialRecord, bookRequests, countryRequests, componentRequests, controlledFailures, atlasRequests, releaseAtlas,
      bookyWrites:()=>operations.filter(value=>value.operation==='set'&&value.key===BOOKY),
      writes: () => operations.filter(value => value.operation !== 'get' && CUSTOMIZATION_KEYS.has(value.key)),
      verify() { expect(errors).toEqual([]); expect(externalRequests).toEqual([]); expect(missingResources).toEqual([]);
        expect(operations.filter(value=>value.operation!=='get'&&![BOOKY,'probpera-interface-language','probpera-planet-recent-adult-v1'].includes(value.key))).toEqual([]);
        expect(atlasRequests.some(row=>row.holdDeadlineExpired)).toBe(false);result.pass = true; },
      async close() {
        result.customizationWrites = operations.filter(value => value.operation !== 'get' && CUSTOMIZATION_KEYS.has(value.key));
        result.unexpectedPreferenceWrites = operations.filter(value => value.operation !== 'get' && ![BOOKY, 'probpera-interface-language', 'probpera-planet-recent-adult-v1'].includes(value.key));
        result.bookyWrites=operations.filter(value=>value.operation==='set'&&value.key===BOOKY);result.finalBookyPreference=JSON.parse(memory.get(BOOKY)??'null');
        result.preferenceOperations = operations; result.bookRequests = bookRequests; result.countryRequests = countryRequests;
        result.componentRequests = componentRequests; result.controlledFailures = controlledFailures; result.atlasRequests = atlasRequests;
        result.errors = errors; result.externalRequests = externalRequests; result.missingResources = missingResources;
        const filename = testInfo.outputPath('booky-initial-globe-load.json'); await fs.writeFile(filename, JSON.stringify(result, null, 2) + '\n');
        await testInfo.attach('booky-initial-globe-load-source-evidence', { path: filename, contentType: 'application/json' }); releaseAtlas('fail'); await context.close();
      } };
  } catch (error) { releaseAtlas('fail'); await context.close(); throw error; }
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
      const middle=(top+bottom)/2,start=middle+(down?-distance/2:distance/2),end=middle+(down?distance/2:-distance/2);
      const corridor=await locator.evaluate((element,{left,right,start,end,ownerIndex})=>{
        const scrollers=[];for(let parent=element.parentElement;parent;parent=parent.parentElement){const style=getComputedStyle(parent);if(/auto|scroll/.test(style.overflowY)&&parent.scrollHeight>parent.clientHeight+1)scrollers.push(parent);}const scroll=scrollers[ownerIndex];
        const describe=node=>({tag:node.tagName,className:typeof node.className==='string'?node.className:null,touchAction:getComputedStyle(node).touchAction,pointerEvents:getComputedStyle(node).pointerEvents,overflowY:getComputedStyle(node).overflowY,scrollTop:node.scrollTop,scrollHeight:node.scrollHeight,clientHeight:node.clientHeight,chosenScroll:node===scroll});
        const candidates=[left+8,right-8,(left+right)/2].map(x=>({x,points:[start,(start+end)/2,end].map(y=>{const hit=document.elementFromPoint(x,y),ancestors=[];let current=hit;while(current){ancestors.push(describe(current));if(current===scroll)break;current=current.parentElement;}return {x,y,hit:hit?describe(hit):null,inside:!!scroll&&!!hit&&scroll.contains(hit),interactive:!!scroll&&!!hit&&(()=>{const owner=hit.closest('canvas,button,a,input,textarea,select,[role="button"],[data-planet-mascot-pet]');return !!owner&&scroll.contains(owner);})(),ancestors};})}));
        const chosen=candidates.find(candidate=>candidate.points.every(point=>point.inside&&!point.interactive&&point.ancestors.every(node=>node.touchAction!=='none'&&(node.chosenScroll||!/auto|scroll/.test(node.overflowY)||node.scrollHeight<=node.clientHeight+1))));
        return {candidates,chosen:chosen?.x??null};
      },{left,right,start,end,ownerIndex:state.scroll.index});
      const record={label,attempt,budget,ownerIndex:state.scroll.index,scrollersBefore:state.scrollers,before:state.scroll.top,direction:down?'toward top':'toward bottom',targetBefore:state.box,clipBefore:state.clip,distance,start,end,holdBeforeReleaseMs:180,corridor};observation.scrolls.push(record);
      if(corridor.chosen===null)throw Error(label+' has no touch-scroll corridor: '+JSON.stringify(record));
      const x=corridor.chosen;await touch('touchStart',[{x,y:start}]);for(let step=1;step<=8;step++){await touch('touchMove',[{x,y:start+(end-start)*step/8}]);await page.waitForTimeout(35);}await page.waitForTimeout(180);await touch('touchEnd',[]);await page.waitForTimeout(100);await guidanceSettle(page);
      const after=await geometry(locator);record.after=after.scrollers.find(owner=>owner.index===record.ownerIndex)?.top??null;record.scrollersAfter=after.scrollers;record.targetAfter=after.box;
    }
  }
  async function tap(locator,label,{minimum44=true,moving=false}={}) {
    if(!moving)await expose(locator,label);let state,last=null,matches=0;
    if(moving){state=await geometry(locator);expect(state.hits.every(hit=>hit.inside),label+' current moving target hits').toBe(true);expect(state.box.top>=state.clip.top-.5&&state.box.bottom<=state.clip.bottom+.5&&state.box.left>=state.clip.left-.5&&state.box.right<=state.clip.right+.5,label+' current moving target contained').toBe(true);}else
    await expect.poll(async()=>{state=await geometry(locator);const key=JSON.stringify([state.box,state.clip,state.hits.map(hit=>hit.inside)]);matches=key===last?matches+1:1;last=key;return matches>=3&&state.hits.every(hit=>hit.inside);},{intervals:[80],message:label+' settled touch geometry'}).toBe(true);
    observation.targets.push({label,...state});
    if(minimum44){expect(state.box.width,label+' width').toBeGreaterThanOrEqual(44);expect(state.box.height,label+' height').toBeGreaterThanOrEqual(44);}expect(state.disabled,label+' enabled').toBe(false);
    await locator.evaluate(target=>{window.__writerRecoveryTouch=[];for(const type of ['pointerdown','pointerup','click'])target.addEventListener(type,event=>window.__writerRecoveryTouch.push({type,trusted:event.isTrusted,pointerType:event.pointerType,intended:target.contains(event.target)}),{once:true});});
    await touch('touchStart',[state.center]);await page.waitForTimeout(65);await touch('touchEnd',[]);await guidanceSettle(page);
    const events=await page.evaluate(()=>window.__writerRecoveryTouch);observation.touches.push({label,events});
    for(const type of ['pointerdown','pointerup','click'])expect(events.some(event=>event.type===type&&event.trusted&&event.pointerType==='touch'&&event.intended),label+' trusted '+type).toBe(true);
  }
  return {tap,expose,geometry,close:()=>cdp.detach()};
}

async function initialLoadState(page){return page.evaluate(()=>{const pet=document.querySelector('[data-planet-mascot-pet]'),focus=document.activeElement;return {url:location.href,language:document.documentElement.lang,wrapperStatus:document.querySelector('.world-map-stage')?.getAttribute('data-loading-status'),planetReady:document.querySelector('.native-planet-app')?.getAttribute('data-planet-ready'),globeLoad:document.querySelector('#atlas .literary-globe')?.getAttribute('data-globe-load-state'),canvasCount:document.querySelectorAll('#atlas canvas').length,mode:pet?.dataset.planetMascotMode,route:pet?.dataset.planetMascotCurrentRoute,step:pet?.dataset.planetMascotStep,screen:pet?.dataset.planetMascotScreen,visibility:pet?.dataset.planetMascotVisibility,searchOpen:document.querySelector('[data-atlas-action="toggle-search"]')?.getAttribute('aria-expanded'),focus:focus?{tag:focus.tagName,id:focus.id,atlasSearchInput:focus.hasAttribute('data-atlas-search-input')}:null,support:[...document.querySelectorAll('[data-booky-support]')].map(node=>({id:node.dataset.bookySupport,title:node.querySelector('h3')?.textContent,body:node.querySelector('p')?.textContent}))};});}

for(const language of ['ru','en'])test('Booky initial globe load recovery '+language,async({},testInfo)=>{
  test.setTimeout(180_000);const fixture=await open(testInfo,{language,width:language==='ru'?390:320}),{page,result}=fixture;
  result.scenario='booky-initial-globe-load-'+language;Object.assign(result,{controlledInitialAtlasTransport:true,initialCatalogFailure:false,nativeLifecycleEquivalent:false,touchOnlyProductActions:true});
  const o=result.observations.initialGlobeLoad={language,touches:[],targets:[],scrolls:[],checks:[],findings:[]},input=await globeGuidanceInputs(page,o);
  const notice=()=>page.locator('[data-booky-support="globe-unavailable"]'),guidance=()=>page.locator('[data-booky-globe-guidance]'),show=()=>page.locator('[data-booky-show-globe-controls]');
  const help=async()=>{if(!await panel(page).count())await input.tap(page.locator('[data-planet-mascot-toggle]'),'open Booky help');await expect(panel(page)).toBeVisible();};
  const collapse=async()=>{if(await panel(page).count())await input.tap(page.locator('[data-planet-mascot-collapse]'),'close Booky help');};
  const expand=async()=>{await help();if(await guidance().getAttribute('open')===null)await input.tap(guidance().locator('summary'),'open mobile globe guidance');await expect(guidance()).toHaveAttribute('open','');};
  const saved=()=>[...fixture.memory.entries()].sort();
  const unrendered=async expected=>{await expect(page.locator('.world-map-stage')).toHaveAttribute('data-loading-status','ready');await expect(globe(page)).toHaveAttribute('data-globe-load-state',expected);await expect(page.locator('.native-planet-app')).toHaveAttribute('data-planet-ready','false');await expect(page.locator('#atlas canvas')).toHaveCount(0);expect(await sample(page)).toBeNull();};
  const assertNotice=async kind=>{await help();await expect(notice()).toBeVisible();await expect(notice().locator('h3')).toHaveText(kind==='loading'?(language==='ru'?'Глобус ещё загружается':'The globe is still loading'):(language==='ru'?'Глобус не удалось загрузить':'The globe could not be loaded'));await expect(page.locator('[data-planet-mascot-context-tip]')).toHaveCount(0);await expect(notice().locator('[data-booky-retry-content]')).toHaveCount(0);await expect(page.locator('[data-planet-mascot-action="search"]')).toBeEnabled();await expect(page.locator('[data-planet-mascot-action="books"]')).toBeEnabled();await expand();await expect(show()).toBeDisabled();};
  try{
    await guidanceSettle(page);await expect(page.locator('html')).toHaveAttribute('lang',language);await unrendered('loading');await expect.poll(()=>fixture.atlasRequests.length).toBeGreaterThan(0);
    await assertNotice('loading');const preferences=saved(),operationStart=fixture.operations.length;o.baseline={state:await initialLoadState(page),preferences,requests:structuredClone(fixture.atlasRequests)};expect(o.baseline.state.route).toBe('none');
    fixture.releaseAtlas('fail');await unrendered('error');await assertNotice('error');const retry=()=>page.locator('#atlas .literary-globe.is-loading .globe-loading > button');await expect(retry()).toHaveCount(1);
    o.failed={state:await initialLoadState(page),requests:structuredClone(fixture.atlasRequests),retryText:await retry().textContent()};expect(fixture.controlledFailures.length).toBeGreaterThan(0);expect(fixture.controlledFailures.every(row=>row.path===geoJsonAsset.url)).toBe(true);
    await input.expose(notice().locator('h3'),'initial globe error heading');await capture(fixture,testInfo,'booky-initial-globe-load-'+language+'-error.png','Actual-App localized Booky initial atlas error and real globe load fallback. The support heading is exposed; this bounded scroll framing does not claim that all help copy is simultaneously visible.');
    if(language==='ru'){
      await input.tap(page.locator('[data-planet-mascot-action="search"]'),'Search while initial globe load has failed');await expect(page.locator('[data-atlas-action="toggle-search"]')).toHaveAttribute('aria-expanded','true');await expect(page.locator('[data-atlas-search-input]')).toBeVisible();o.retainedAction={action:'search',open:await initialLoadState(page)};
      await collapse();o.retainedAction.afterCollapse=await initialLoadState(page);if(o.retainedAction.afterCollapse.searchOpen==='true'){await input.tap(page.locator('[data-atlas-action="toggle-search"]'),'close currently open atlas Search');await expect(page.locator('[data-atlas-action="toggle-search"]')).toHaveAttribute('aria-expanded','false');o.retainedAction.close='one trusted toolbar touch';}else{expect(o.retainedAction.afterCollapse.searchOpen).toBe('false');o.retainedAction.close='already closed by explicit help-collapse focus change';}
    }else{
      await input.tap(page.locator('[data-planet-mascot-action="books"]'),'Collection while initial globe load has failed');await expect(page.locator('.native-planet-panel:not([hidden])')).toBeVisible();await expect(pet(page)).toHaveAttribute('data-planet-mascot-screen','collection');await help();await expect(notice()).toHaveCount(0);o.retainedAction={action:'books',open:await initialLoadState(page)};
      await input.tap(page.locator('[data-planet-mascot-action="return-globe"]'),'Return from Collection to failed globe');await expect(page.locator('.native-planet-panel')).toBeHidden();await expect(pet(page)).toHaveAttribute('data-planet-mascot-screen','globe');
    }
    await unrendered('error');await assertNotice('error');expect(saved()).toEqual(preferences);o.retainedAction.returned=await initialLoadState(page);
    const settledRequestCount=fixture.atlasRequests.length;fixture.releaseAtlas('hold-retry');await page.waitForTimeout(350);expect(fixture.atlasRequests).toHaveLength(settledRequestCount);await unrendered('error');o.noImplicitRetry={settledRequestCount,requestCountAfterDeliveryChange:fixture.atlasRequests.length,observationMs:350};
    await collapse();await expect(retry()).toBeEnabled();await input.tap(retry(),'existing globe Retry after initial asset failure');await expect.poll(()=>fixture.atlasRequests.length).toBeGreaterThan(settledRequestCount);await unrendered('loading');await assertNotice('loading');o.retryLoading={state:await initialLoadState(page),requests:structuredClone(fixture.atlasRequests)};expect(fixture.atlasRequests.at(-1).deliveryAtRequest).toBe('hold-retry');expect(fixture.atlasRequests.at(-1).deliveredAt).toBeUndefined();
    fixture.releaseAtlas('success');await ready(page);await help();await expect(notice()).toHaveCount(0);await expect(page.locator('[data-planet-mascot-context-tip]')).toHaveCount(1);await expand();await expect(show()).toBeEnabled();const firstScene=await actual(page);o.firstScene={state:await initialLoadState(page),globe:firstScene};expect(firstScene.frame).toBeGreaterThan(0);expect(fixture.atlasRequests.at(-1).sha256).toBe(geoJsonAsset.sha256);expect(fixture.atlasRequests.at(-1).status).toBe(200);
    await collapse();const rotation=page.locator('#atlas [data-globe-control="auto-rotate"]');if(await rotation.getAttribute('aria-pressed')==='true')await input.tap(rotation,'explicitly pause the first recovered globe');await expect(rotation).toHaveAttribute('aria-pressed','false');await stablePose(page);await page.evaluate(()=>window.__bookySupportFixture.remember());const recovered=await actual(page);await expand();await expect(show()).toBeEnabled();retained(await actual(page),recovered);await input.expose(show(),'ready Show controls after actual first frame');await capture(fixture,testInfo,'booky-initial-globe-load-'+language+'-recovered.png','Actual first canonical globe scene after a trusted tap on the existing Retry and successful authenticated atlas asset delivery. Initial-load support has cleared and existing Show controls is available; no transient Booky cue is claimed.');
    expect(saved()).toEqual(preferences);expect(fixture.operations.slice(operationStart).filter(row=>row.operation!=='get')).toEqual([]);expect(fixture.bookyWrites()).toEqual([]);expect(fixture.writes()).toEqual([]);o.recovered={state:await initialLoadState(page),globe:await actual(page)};retained(o.recovered.globe,recovered);for(const key of ['url','mode','route','step','screen','visibility'])expect(o.recovered.state[key]).toEqual(o.baseline.state[key]);
    o.checks=['real initial atlas loading and failure precede any canonical scene sample','localized loading and error guidance replaces the contradictory ordinary globe tip','existing Search or Collection remains explicitly usable while the atlas has failed','only a trusted tap on the existing globe Retry requests recovery','authenticated atlas delivery creates the first real scene and clears current help','preferences progress selection and recovered canonical scene owners remain exact'].map(name=>({name,pass:true}));
    Object.assign(result,{actualInitialAtlasFailureVerified:true,loadingAndErrorGuidanceVerified:true,retainedRecoveryActionsVerified:true,trustedExistingGlobeRetryVerified:true,firstSceneRecoveryVerified:true,preferencesAndSelectionPreserved:true,initialSampleAbsent:true,actualRetryTouch:true,actualFirstSampleAfterRetry:true});fixture.verify();
  }catch(error){o.failureState=await initialLoadState(page);const filename='diagnostic-failure-'+language+'.png',bytes=await page.screenshot({path:testInfo.outputPath(filename)});o.failureCapture={filename,sha256:digest(bytes),error:error.message,scope:'failure diagnosis only'};await testInfo.attach('diagnostic-failure-'+language,{path:testInfo.outputPath(filename),contentType:'image/png'});throw error;
  }finally{await input.close();await fixture.close();}
});
