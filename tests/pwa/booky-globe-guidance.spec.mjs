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
let globeFocusTimingTransform;

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

    // Test-only scheduler for the single transformed globe-controls focus RAF.
    // Native RAF identity and every unrelated callback remain untouched.
    const nativeFocusRafOwner=window.requestAnimationFrame,nativeFocusRaf=nativeFocusRafOwner.bind(window);
    let focusArmed=false,focusPending=null,focusRecord=null,focusSerial=0,focusTracing=false,focusEvents=[];
    let releaseTracing=false,releaseSamples=[];
    const focusIdentity=element=>element instanceof Element?{tag:element.tagName,id:element.id,
      atlasOwnerTag:element.closest('[data-atlas-action]')?.tagName??null,
      atlasAction:element.closest('[data-atlas-action]')?.getAttribute('data-atlas-action')??null,
      globeOwnerTag:element.closest('[data-globe-control]')?.tagName??null,
      globeControl:element.closest('[data-globe-control]')?.getAttribute('data-globe-control')??null,
      searchInput:!!element.closest('[data-atlas-search-input]'),bookyToggle:!!element.closest('[data-planet-mascot-toggle]')}:null;
    const recordFocusEvent=event=>{if(focusTracing&&focusEvents.length<320)focusEvents.push({type:event.type,at:performance.now(),
      trusted:event.isTrusted,key:event.key??null,pointerType:event.pointerType??null,target:focusIdentity(event.target),
      active:focusIdentity(document.activeElement)});};
    for(const type of ['pointerdown','keydown','input','focusin'])document.addEventListener(type,recordFocusEvent,true);
    window.__bookyGlobeFocusRace={
      arm(){if(focusArmed||focusPending)throw Error('A focus callback is already armed or pending');
        focusArmed=true;focusRecord=null;focusTracing=true;focusEvents=[];releaseTracing=false;releaseSamples=[];},
      schedule(callback){
        if(!focusArmed)return nativeFocusRaf(callback);
        focusArmed=false;
        if(focusPending)throw Error('Only one globe-controls focus callback may be held');
        const record={id:++focusSerial,callbackText:callback.toString(),scheduledAt:performance.now(),
          nativeFrameAt:null,heldAt:null,releaseAt:null,invocationAt:null,completionAt:null};
        focusRecord=record;focusPending={callback,record};
        return nativeFocusRaf(timestamp=>{record.nativeFrameAt=timestamp;record.heldAt=performance.now();});
      },
      release(){
        if(!focusPending||focusPending.record.heldAt===null)throw Error('Native frame must deliver the held callback first');
        const pending=focusPending;focusPending=null;pending.record.releaseAt=performance.now();
        // Separate read-only bounded samples for this extension; old trace3600 stays exact.
        releaseTracing=true;
        const observeRelease=()=>{if(!releaseTracing)return;const cue=document.querySelector('[data-booky-target]'),pet=document.querySelector('[data-planet-mascot-pet]');
          releaseSamples.push({at:performance.now(),action:cue?.getAttribute('data-booky-target-action')??null,
            cue:cue?.getAttribute('data-booky-target')??null,gesture:pet?.getAttribute('data-planet-mascot-gesture')??null,
            active:focusIdentity(document.activeElement)});
          if(releaseSamples.length<256)nativeFocusRaf(observeRelease);};
        nativeFocusRaf(observeRelease);
        return nativeFocusRaf(timestamp=>{pending.record.invocationAt=performance.now();
          try{pending.callback(timestamp);}finally{pending.record.completionAt=performance.now();}});
      },
      read(){return {armed:focusArmed,pendingId:focusPending?.record.id??null,
        nativeRafUnchanged:window.requestAnimationFrame===nativeFocusRafOwner,
        record:focusRecord?{...focusRecord}:null,events:focusEvents.map(event=>({...event})),
        releaseSamples:releaseSamples.map(sample=>({...sample})),caps:{inputFocusEvents:320,releaseSamples:256}};},
      stop(){focusTracing=false;releaseTracing=false;return this.read();}
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
        const originalSource = await fs.readFile(args.path, 'utf8'); let source=originalSource, replacements = 0;
        if(path.basename(args.path)==='App.tsx'){
          let anchor=[
            '      window.requestAnimationFrame(() => {',
            '        document.removeEventListener("pointerdown", interrupt, true);',
            '        document.removeEventListener("keydown", interrupt, true);',
            '        document.removeEventListener("visibilitychange", interrupt);',
            '        const state = mascot.getSnapshot(), focused = document.activeElement;',
            '        if (interrupted || document.hidden || focusSequence !== mascotFocusSequence.current || state.revision !== revision',
            '          || !state.available || state.visibility !== "shown" || state.panel !== "closed" || state.mode !== "help"',
            '          || findControl() !== target || focused !== origin && focused !== document.body',
            '            && !focused?.closest("[data-planet-mascot-toggle]")) return;',
            '        target.focus({ preventScroll: true });',
            '      });',
          ].join('\n');
          if(!source.includes(anchor))anchor=anchor.replaceAll('\n','\r\n');
          const timingAnchor=anchor.replace('window.requestAnimationFrame(', 'window.__bookyGlobeFocusRace.schedule(');
          expect(source.split(anchor),'one exact globe-controls focus RAF anchor').toHaveLength(2);
          source=source.replace(anchor,timingAnchor);
          expect(source.split(timingAnchor),'one timing-only transformed anchor').toHaveLength(2);
          expect(source.replace(timingAnchor,anchor),'single-callee inverse restores exact App source').toBe(originalSource);
          globeFocusTimingTransform={actualAppSourceSha256:digest(Buffer.from(originalSource)),
            originalAnchorSha256:digest(Buffer.from(anchor)),timingAnchorSha256:digest(Buffer.from(timingAnchor)),
            originalCallee:'window.requestAnimationFrame',timingCallee:'window.__bookyGlobeFocusRace.schedule',
            callbackBodyChanged:false,exactInverseVerified:true};
        }
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
  const sourcePaths = [...new Set([...required, ...inputs.filter(value => value.startsWith('src/') && !value.includes('?')), 'tests/pwa/booky-globe-guidance.spec.mjs'])].sort();
  const sourceInputs = await Promise.all(sourcePaths.map(async filename => ({ path: filename, sha256: digest(await fs.readFile(path.join(ROOT, filename))) })));
  files = new Map(built.outputFiles.map(file => ['/fixture/' + path.relative(output, file.path).replaceAll('\\', '/'), Buffer.from(file.contents)]));
  const selectionBytes = await fs.readFile(path.join(ROOT, 'scripts/mobile/native-base-assets.json'));
  selectedAssets = new Map(JSON.parse(selectionBytes).files.map(entry => {
    if (entry.source !== 'public/' + entry.output || entry.transformation !== 'none' || /(?:^|\/)\.\.(?:\/|$)|\\/u.test(entry.output)) throw Error('Invalid selected native asset');
    return ['/' + entry.output, entry];
  }));
  sourceEvidence = { externalFixtureSha256: digest(await fs.readFile(fileURLToPath(import.meta.url))), kind: 'canonical-app-booky-globe-guidance-in-Chromium', actualApp: true, actualCss: true, actualGlobe: true,
    controlledPorts: ['native OS plugins and preferences backed by a Node map', 'HTTP responses for real dynamic country, book runtime and collection component chunks with no injected transport failures', 'API-initiated real canonical WebGL context loss/restoration via WEBGL_lose_context; not native lifecycle', 'Test-only delayed delivery of the exact single globe-controls focus RAF callback; body and reference retained, native RAF and unrelated callbacks unchanged'],
    globeFocusTimingTransform,
    bookChunks, primaryBookChunk, retryBookChunk, sharedBookDependencies,
    countryChunks, primaryCountryChunk, retryCountryChunk, sharedCountryDependencies,
    componentChunks, primaryComponentChunk, retryComponentChunk, sharedComponentDependencies, sourceInputs,
    cameraAuthority: 'Companion show/hide/tour steps do not own the camera. Only existing canonical App navigation owns scene changes; no fixture camera assignments.',
    representation: 'Original actual-App RU/EN mobile globe guidance uses trusted touch and read-only scene observations. Appended cancellation checks use a disclosed single-focus-callback scheduling hold: RU newer trusted toolbar Search; EN actual keyboard navigation/input as a mobile accessibility race harness. Canonical WebGL loss/restoration is API-initiated. Canonical Vite globs expand into in-memory esbuild ESM chunks; this is source behavior evidence, not a dist artifact, full keyboard/screen-reader acceptance, installed-device or service-availability test.',
    fallbackArtwork: { path: ASSET, sha256: ASSET_SHA, bytes: assetBytes.length, width: 1254, height: 1254, pngColorType: 6,
      bundledPath: '/fixture/' + path.relative(output, assetOutput.path).replaceAll('\\', '/') },
    publicAssetSelectionSha256: digest(selectionBytes), selectedAssetCount: selectedAssets.size,
    builtFiles: built.outputFiles.map(file => ({ path: path.relative(output, file.path).replaceAll('\\', '/'), sha256: digest(file.contents) })),
    installedNative: false, deviceTested: false, childReviewed: false, childProfileCreated: false, childAccessGranted: false, reviewedDialogueAccepted: false, narrationEnabled: false, artAccepted: false, devicePerformanceAccepted: false, releaseReady: false };
});

async function open(testInfo, { rejectBooks = 0, rejectCountries = 0, rejectComponents = 0 } = {}) {
  const profileRoot = path.resolve(process.env.S15_BROWSER_PROFILE_ROOT ?? path.join(ROOT, '.tmp/s15-booky-live'));
  await fs.mkdir(profileRoot, { recursive: true }); const profile = await fs.mkdtemp(path.join(profileRoot, 'pk-'));
  const context = await chromium.launchPersistentContext(profile, { channel: process.env.S15_BROWSER_CHANNEL || 'chrome', headless: true,
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
        const filename = testInfo.outputPath('booky-globe-guidance.json'); await fs.writeFile(filename, JSON.stringify(result, null, 2) + '\n');
        await testInfo.attach('booky-globe-guidance-source-evidence', { path: filename, contentType: 'application/json' }); await context.close();
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

async function installReservedTopObserver(page){await page.evaluate(()=>{
  const rect=element=>{const r=element.getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height};};
  const viewport=()=>{const v=window.visualViewport;return {left:v?.offsetLeft??0,top:v?.offsetTop??0,width:v?.width??innerWidth,height:v?.height??innerHeight};};
  function visibleRect(element,view){
    if(element.closest('[hidden], [inert], [aria-hidden="true"]'))return null;
    const style=getComputedStyle(element),bounds=element.getBoundingClientRect();
    if(style.display==='none'||style.visibility!=='visible'||Number(style.opacity)===0||bounds.width<2||bounds.height<2)return null;
    let left=Math.max(bounds.left,view.left),top=Math.max(bounds.top,view.top),right=Math.min(bounds.right,view.left+view.width),bottom=Math.min(bounds.bottom,view.top+view.height),clipAncestors=style.position!=='fixed';
    for(let parent=element.parentElement;parent;parent=parent.parentElement){const ps=getComputedStyle(parent);if(ps.display==='none'||Number(ps.opacity)===0)return null;
      if(clipAncestors&&parent!==document.body&&parent!==document.documentElement&&/hidden|clip|scroll|auto/.test(ps.overflowX+ps.overflowY)){const clip=parent.getBoundingClientRect();if(/hidden|clip|scroll|auto/.test(ps.overflowX)){left=Math.max(left,clip.left);right=Math.min(right,clip.right);}if(/hidden|clip|scroll|auto/.test(ps.overflowY)){top=Math.max(top,clip.top);bottom=Math.min(bottom,clip.bottom);}}
      if(ps.position==='fixed')clipAncestors=false;
    }
    return right-left>=2&&bottom-top>=2?{left,top,width:right-left,height:bottom-top}:null;
  }
  window.__bookyReservedTopRead=()=>{const view=viewport(),locale=document.querySelector('.native-planet-app .atlas-immersive-chrome .interface-language-control'),ancestors=[];for(let parent=locale?.parentElement;parent;parent=parent.parentElement){const ps=getComputedStyle(parent);ancestors.push({tag:parent.tagName,className:typeof parent.className==='string'?parent.className:null,rect:rect(parent),overflowX:ps.overflowX,overflowY:ps.overflowY,position:ps.position,display:ps.display,opacity:ps.opacity});}
    let top=view.top;const protectedRects=[];for(const element of document.querySelectorAll('.native-planet-panel__header, .native-planet-app .atlas-immersive-chrome .interface-language-control')){const bounds=visibleRect(element,view);protectedRects.push({className:element.className,bounds});if(bounds)top=Math.max(top,bounds.top+bounds.height);}
    return {physicalViewport:view,effectiveReservation:{...view,top,height:Math.max(0,view.top+view.height-top)},localeVisible:locale?visibleRect(locale,view):null,protectedRects,ancestors};};
});}

async function guidanceState(page){return page.evaluate(()=>{const pet=document.querySelector('[data-planet-mascot-pet]'),cue=document.querySelector('[data-booky-target]'),focused=document.activeElement;return {url:location.href,language:document.documentElement.lang,mode:pet?.dataset.planetMascotMode,route:pet?.dataset.planetMascotCurrentRoute,step:pet?.dataset.planetMascotStep,screen:pet?.dataset.planetMascotScreen,visibility:pet?.dataset.planetMascotVisibility,panelOpen:!!document.querySelector('[data-planet-mascot-panel]'),gesture:pet?.dataset.planetMascotGesture,cue:cue?.dataset.bookyTarget??null,cueAction:cue?.dataset.bookyTargetAction??null,returning:pet?.dataset.bookyReturning??null,searchOpen:document.querySelector('[data-atlas-action="toggle-search"]')?.getAttribute('aria-expanded'),focusedIdentity:focused?{tag:focused.tagName,id:focused.id,className:typeof focused.className==='string'?focused.className:null,atlasSearchInput:focused.hasAttribute('data-atlas-search-input'),bookyToggle:!!focused.closest('[data-planet-mascot-toggle]')}:null,focusedControl:focused?.getAttribute('data-globe-control')??null,focusedConnected:!!focused?.isConnected,focusedCanonical:!!document.querySelector('#atlas')?.contains(focused),focusedDisabled:!!focused?.disabled};});}
async function installGuidanceTrace(page){await page.evaluate(()=>{const state={active:true,phase:'setup',samples:[],controlClicks:[]};window.__globeGuidanceTrace=state;document.addEventListener('click',event=>{const button=event.target instanceof Element?event.target.closest('#atlas .globe-controls [data-globe-control]'):null;if(button)state.controlClicks.push({phase:state.phase,control:button.getAttribute('data-globe-control'),trusted:event.isTrusted,pointerType:event.pointerType});},true);const frame=()=>{if(!state.active)return;const pet=document.querySelector('[data-planet-mascot-pet]'),cue=document.querySelector('[data-booky-target]'),r=pet?.getBoundingClientRect();if(state.samples.length<3600)state.samples.push({phase:state.phase,at:performance.now(),cue:cue?.dataset.bookyTarget??null,action:cue?.dataset.bookyTargetAction??null,gesture:pet?.dataset.planetMascotGesture,pet:r?{left:r.left,top:r.top,width:r.width,height:r.height}:null,focus:document.activeElement?.getAttribute('data-globe-control')??null});requestAnimationFrame(frame);};requestAnimationFrame(frame);});}
for(const language of ['ru','en'])test('Booky mobile globe guidance '+language,async({},testInfo)=>{
  test.setTimeout(180_000);const fixture=await open(testInfo),{page,result}=fixture;
  result.scenario='booky-mobile-globe-guidance-'+language;result.apiInitiatedWebGlLoss=true;result.nativeLifecycleEquivalent=false;result.touchOnlyProductActions=true;result.controlledLayoutFaultInjected=false;
  const o=result.observations.globeGuidance={language,touches:[],targets:[],scrolls:[],checks:[],findings:[]},input=await globeGuidanceInputs(page,o),guidance=()=>page.locator('[data-booky-globe-guidance]'),show=()=>page.locator('[data-booky-show-globe-controls]'),notice=()=>page.locator('[data-booky-support="globe-unavailable"]');
  const phase=value=>page.evaluate(value=>{window.__globeGuidanceTrace.phase=value;},value);
  const help=async()=>{if(!await panel(page).count())await input.tap(page.locator('[data-planet-mascot-toggle]'),'open Booky help');await expect(panel(page)).toBeVisible();};
  const expandGuidance=async()=>{await help();if(await guidance().getAttribute('open')===null)await input.tap(guidance().locator('summary'),'open mobile globe guidance');await expect(guidance()).toHaveAttribute('open','');};
  const collapse=async()=>{if(await panel(page).count())await input.tap(page.locator('[data-planet-mascot-collapse]'),'close Booky help');};
  const saved=()=>[...fixture.memory.entries()].sort();
  try {
    await page.setViewportSize({width:language==='ru'?390:320,height:844});await page.emulateMedia({reducedMotion:language==='ru'?'no-preference':'reduce'});await guidanceSettle(page);
    if(language==='en'){await input.tap(page.locator('.native-planet-app .interface-language-control button:visible').filter({hasText:/^EN$/u}),'English interface');await expect(page.locator('html')).toHaveAttribute('lang','en');}
    const rotation=page.locator('#atlas [data-globe-control="auto-rotate"]');if(await rotation.getAttribute('aria-pressed')==='true')await input.tap(rotation,'explicitly pause automatic rotation');await expect(rotation).toHaveAttribute('aria-pressed','false');
    await stablePose(page);await page.evaluate(()=>window.__bookySupportFixture.remember());const baseGlobe=await actual(page),preferences=saved(),operationStart=fixture.operations.length;await installGuidanceTrace(page);o.baseline={globe:baseGlobe,preferences,state:await guidanceState(page),motionPolicy:language==='ru'?'OS no-preference':'OS reduced motion'};
    await expandGuidance();await input.expose(show(),'show globe controls action');await expect(show()).toBeEnabled();await expect(show()).toHaveText(language==='ru'?'Показать кнопки управления':'Show globe controls');const copy=await guidance().textContent();expect(copy).toContain(language==='ru'?'одним пальцем':'one finger');expect(copy).toContain(language==='ru'?'два пальца':'two fingers');expect(copy).not.toMatch(/keyboard|\bHome\b|\bEnter\b|клавиатур/iu);o.mobileCopy=copy;
    retained(await actual(page),baseGlobe);expect(saved()).toEqual(preferences);expect((await guidanceState(page)).route).toBe('none');
    await capture(fixture,testInfo,'booky-globe-guidance-'+language+'-help.png','Actual App mobile globe instructions and explicit localized Show controls action; reading help does not move or select the canonical globe.');
    await phase('show-controls');await input.tap(show(),'explicit show globe controls');await expect(panel(page)).toHaveCount(0);
    await expect.poll(async()=>{const current=await guidanceState(page);return current.focusedConnected&&current.focusedCanonical&&!current.focusedDisabled&&['zoom-in','zoom-out','reset'].includes(current.focusedControl);},{intervals:[16,32,64],timeout:2000,message:'existing enabled canonical globe control receives guarded focus'}).toBe(true);
    o.focus=await guidanceState(page);const focused=page.locator('#atlas .globe-controls [data-globe-control="'+o.focus.focusedControl+'"]');o.focusGeometry=await input.geometry(focused);expect(o.focusGeometry.box.width).toBeGreaterThanOrEqual(44);expect(o.focusGeometry.box.height).toBeGreaterThanOrEqual(44);expect(o.focusGeometry.hits.every(hit=>hit.inside)).toBe(true);retained(await actual(page),baseGlobe);
    await expect(page.locator('[data-booky-target-action="globe-controls"]')).toHaveCount(1);
    if(language==='ru'){
      await expect(page.locator('[data-booky-walk-stop]')).toBeVisible();await expect(page.locator('[data-booky-walk-stop]')).toHaveAccessibleName('Остановить прогулку');await expect(page.locator('[data-booky-walk-stop]')).toHaveAttribute('title','Остановить прогулку');await input.tap(page.locator('[data-booky-walk-stop]'),'Stop finite globe-controls approach',{moving:true});
      await expect(page.locator('[data-booky-target]')).toHaveCount(0);await expect(pet(page)).toHaveAttribute('data-planet-mascot-gesture','rest');await page.waitForTimeout(1900);await expect(page.locator('[data-booky-target]')).toHaveCount(0);o.finiteCuePolicy='normal-motion approach stopped by a genuine trusted Stop';
    }else{
      await expect(pet(page)).toHaveAttribute('data-planet-mascot-gesture','pointing');await expect(page.locator('[data-booky-target]')).toHaveAttribute('data-booky-target','tapping');await expect(page.locator('[data-booky-target]')).toHaveCount(0,{timeout:2000});await page.waitForTimeout(850);o.finiteCuePolicy='OS reduced motion uses a finite still pointing pose, then settles without replay';
    }
    const cueTrace=await page.evaluate(()=>window.__globeGuidanceTrace.samples.filter(row=>row.phase==='show-controls'));expect(cueTrace.some(row=>row.action==='globe-controls')).toBe(true);if(language==='en'){expect(cueTrace.some(row=>row.cue==='approaching')).toBe(false);const still=cueTrace.filter(row=>row.cue==='tapping');expect(still.length).toBeGreaterThan(1);expect(still.every(row=>JSON.stringify(row.pet)===JSON.stringify(still[0].pet))).toBe(true);}else{const approaching=cueTrace.filter(row=>row.cue==='approaching');expect(approaching.length).toBeGreaterThan(0);expect(approaching.every(row=>row.pet.width===120&&row.pet.height===64),'Stop occupies the existing cell without growing the compact actor').toBe(true);}o.cueTrace=cueTrace;
    await capture(fixture,testInfo,'booky-globe-guidance-'+language+'-controls.png','Settled actual-App globe controls after the finite Booky cue completed or was explicitly stopped. Real enabled control focus and the transient cue are proved by the preceding DOM and trace observations, not by this settled image.');
    retained(await actual(page),baseGlobe);expect(await page.evaluate(()=>window.__globeGuidanceTrace.controlClicks)).toEqual([]);expect(saved()).toEqual(preferences);
    if(language==='ru'){
      await installReservedTopObserver(page);await expandGuidance();await input.expose(show(),'fresh Show before controlled header cutoff');await phase('reserved-top-cutoff');await input.tap(show(),'fresh Show for controlled reservation cutoff');
      await expect(panel(page)).toHaveCount(0);await expect(page.locator('[data-booky-target-action="globe-controls"]')).toHaveAttribute('data-booky-target','approaching');
      const cutoff=o.reservedTopCutoff={controlledLayoutFault:true,mechanism:'Existing protected locale and its clipping chrome inline heights only; actual clipped reservation verified, genuine ResizeObserver, no synthetic resize/input event',before:await page.evaluate(()=>{
        const rect=node=>{const r=node.getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height};};
        const locale=document.querySelector('.native-planet-app .atlas-immersive-chrome .interface-language-control'),target=document.querySelector('#atlas .globe-controls');
        const first=window.__globeGuidanceTrace.samples.find(row=>row.phase==='reserved-top-cutoff'&&row.cue==='approaching');
        if(!locale||!target||!first?.pet)throw Error('Fresh actual approach and existing protected control required');
        const chrome=locale.closest('.atlas-immersive-chrome');if(!chrome)throw Error('Existing clipping header required');window.__bookyProtectedHeaderRestore={element:locale,style:locale.getAttribute('style'),chrome,chromeStyle:chrome.getAttribute('style')};
        return {firstApproach:first,locale:rect(locale),target:rect(target),viewport:{width:innerWidth,height:innerHeight},style:locale.getAttribute('style'),chromeStyle:chrome.getAttribute('style'),reservation:window.__bookyReservedTopRead()};
      })};
      try{
        cutoff.injected=await page.evaluate(before=>{
          const rect=node=>{const r=node.getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height};};const locale=window.__bookyProtectedHeaderRestore.element,target=document.querySelector('#atlas .globe-controls');
          const requestedBottom=before.firstApproach.pet.top+32,requestedHeight=requestedBottom-locale.getBoundingClientRect().top;
          if(!Number.isFinite(requestedHeight)||requestedHeight<=0)throw Error('Invalid controlled header height');
          locale.style.setProperty('height',requestedHeight+'px','important');window.__bookyProtectedHeaderRestore.chrome.style.setProperty('height',(requestedHeight+16)+'px','important');
          return {requestedBottom,requestedHeight,locale:rect(locale),target:rect(target),viewport:{width:innerWidth,height:innerHeight},at:performance.now(),cue:document.querySelector('[data-booky-target]')?.getAttribute('data-booky-target'),reservation:window.__bookyReservedTopRead()};
        },cutoff.before);result.controlledLayoutFaultInjected=true;
        expect(cutoff.injected.cue).toBe('approaching');expect(cutoff.injected.target).toEqual(cutoff.before.target);expect(cutoff.injected.viewport).toEqual(cutoff.before.viewport);
        expect(cutoff.injected.locale.left).toBe(cutoff.before.locale.left);expect(cutoff.injected.locale.width).toBe(cutoff.before.locale.width);
        expect(cutoff.injected.reservation.localeVisible).not.toBeNull();expect(cutoff.injected.reservation.effectiveReservation.top+12).toBeGreaterThan(cutoff.before.firstApproach.pet.top);expect(cutoff.injected.reservation.physicalViewport).toEqual(cutoff.before.reservation.physicalViewport);for(const key of ['left','width'])expect(cutoff.injected.reservation.effectiveReservation[key]).toBe(cutoff.before.reservation.effectiveReservation[key]);expect(cutoff.injected.reservation.effectiveReservation.top+cutoff.injected.reservation.effectiveReservation.height).toBe(cutoff.before.reservation.effectiveReservation.top+cutoff.before.reservation.effectiveReservation.height);
        await expect(page.locator('[data-booky-target]')).toHaveCount(0,{timeout:1000});await expect(pet(page)).toHaveAttribute('data-planet-mascot-gesture','rest');
        cutoff.stopped=await guidanceState(page);cutoff.stoppedReservation=await page.evaluate(()=>window.__bookyReservedTopRead());
      }finally{
        cutoff.restoration=await page.evaluate(()=>{const saved=window.__bookyProtectedHeaderRestore;if(!saved?.element.isConnected)throw Error('Original protected locale control missing');if(saved.style===null)saved.element.removeAttribute('style');else saved.element.setAttribute('style',saved.style);if(!saved.chrome.isConnected)throw Error('Original clipping header missing');if(saved.chromeStyle===null)saved.chrome.removeAttribute('style');else saved.chrome.setAttribute('style',saved.chromeStyle);return {style:saved.element.getAttribute('style'),chromeStyle:saved.chrome.getAttribute('style'),sameElement:document.querySelector('.native-planet-app .atlas-immersive-chrome .interface-language-control')===saved.element,sameChrome:document.querySelector('.native-planet-app .atlas-immersive-chrome')===saved.chrome};});
      }
      expect(cutoff.restoration.style).toBe(cutoff.before.style);expect(cutoff.restoration.chromeStyle).toBe(cutoff.before.chromeStyle);expect(cutoff.restoration.sameElement).toBe(true);expect(cutoff.restoration.sameChrome).toBe(true);await guidanceSettle(page);await page.waitForTimeout(1900);
      await expect(page.locator('[data-booky-target]')).toHaveCount(0);await expect(pet(page)).toHaveAttribute('data-planet-mascot-gesture','rest');
      cutoff.final=await guidanceState(page);cutoff.trace=await page.evaluate(()=>window.__globeGuidanceTrace.samples.filter(row=>row.phase==='reserved-top-cutoff'));
      expect(cutoff.trace.some(row=>row.cue==='approaching')).toBe(true);expect(cutoff.trace.some(row=>row.cue==='tapping')).toBe(false);
      const afterTarget=await input.geometry(page.locator('#atlas .globe-controls'));expect(afterTarget.box).toEqual({...cutoff.before.target,right:cutoff.before.target.left+cutoff.before.target.width,bottom:cutoff.before.target.top+cutoff.before.target.height});
      retained(await actual(page),baseGlobe);expect(saved()).toEqual(preferences);expect(await page.evaluate(()=>window.__globeGuidanceTrace.controlClicks)).toEqual([]);result.reservedTopCutoffVerified=true;
    }
    await phase('actual-user-zoom');const beforeZoom=await actual(page);const zoom=page.locator('#atlas [data-globe-control="zoom-in"]');await expect(zoom).toBeEnabled();await input.tap(zoom,'real user zoom in');await expect.poll(async()=>JSON.stringify((await sample(page)).pose),{intervals:[80,150],timeout:5000}).not.toBe(JSON.stringify(beforeZoom.pose));await ready(page);await stablePose(page);const afterZoom=await actual(page);retained(afterZoom,beforeZoom,false,true);const controlClicks=await page.evaluate(()=>window.__globeGuidanceTrace.controlClicks);expect(controlClicks).toEqual([{phase:'actual-user-zoom',control:'zoom-in',trusted:true,pointerType:'touch'}]);o.realZoom={before:beforeZoom,after:afterZoom,controlClicks};
    await phase('globe-loss');await expandGuidance();const beforeLoss=await actual(page),lossContext=await guidanceState(page);await page.evaluate(()=>{const owner=window.__bookySupportFixture.scenes().find(row=>document.querySelector('#atlas')?.contains(row.canvas)),extension=owner?.renderer.getContext().getExtension('WEBGL_lose_context');if(!extension)throw Error('Canonical renderer does not expose WEBGL_lose_context');window.__canonicalGlobeLoss=extension;extension.loseContext();});
    await expect(globe(page)).toHaveAttribute('data-globe-webgl-context','lost');await expect(notice()).toBeVisible();await expect(page.locator('[data-planet-mascot-context-tip]')).toHaveCount(0);await expect(show()).toBeDisabled();const lost=await sample(page);expect(lost.contextLost).toBe(true);retained(lost,beforeLoss);o.loss={before:beforeLoss,beforeContext:lossContext,lost,notice:await notice().textContent(),showDisabled:await show().isDisabled(),state:await guidanceState(page)};
    await input.expose(notice(),'current globe-unavailable explanation');await capture(fixture,testInfo,'booky-globe-guidance-'+language+'-unavailable.png','Actual canonical WebGL context is lost through the disclosed test extension; current localized unavailable explanation replaces the ordinary context tip, with independent Search and Collection actions retained.');
    await input.tap(page.locator('[data-planet-mascot-action="search"]'),'Search remains usable during globe loss');await expect(page.locator('[data-atlas-action="toggle-search"]')).toHaveAttribute('aria-expanded','true');await expect(panel(page)).toHaveCount(0);const unavailableSearch=page.locator('[data-atlas-search-input]:visible');await expect(unavailableSearch).toHaveCount(1);await expect(unavailableSearch).toBeEnabled();await expect(unavailableSearch).toBeFocused();await guidanceSettle(page);await expect(unavailableSearch).toBeFocused();o.refusal={reason:'actual lost globe with mobile Search owning foreground',state:await guidanceState(page),helpRetired:true,showDisabledBeforeSearch:o.loss.showDisabled,contextTipCount:await page.locator('[data-planet-mascot-context-tip]').count()};
    o.searchClose={beforeCollapse:await guidanceState(page)};await collapse();o.searchClose.afterCollapse=await guidanceState(page);
    if(o.searchClose.afterCollapse.searchOpen==='true'){
      await input.tap(page.locator('[data-atlas-action="toggle-search"]'),'close currently open atlas Search');await expect(page.locator('[data-atlas-action="toggle-search"]')).toHaveAttribute('aria-expanded','false');o.searchClose.observedTransition='closed-by-one-toolbar-touch-after-help-collapse';
    }else{expect(o.searchClose.afterCollapse.searchOpen).toBe('false');o.searchClose.observedTransition='already-closed-during-explicit-help-collapse';}
    o.searchClose.final=await guidanceState(page);await expect(page.locator('[data-atlas-action="toggle-search"]')).toHaveAttribute('aria-expanded','false');await help();await expect(show()).toBeDisabled();await expect(notice()).toBeVisible();o.refusal.afterSearchClosed=await guidanceState(page);await page.evaluate(()=>window.__canonicalGlobeLoss.restoreContext());await ready(page);await stablePose(page);const restored=await actual(page);retained(restored,beforeLoss);await help();await expect(notice()).toHaveCount(0);await expect(page.locator('[data-planet-mascot-context-tip]')).toHaveCount(1);await expandGuidance();await expect(show()).toBeEnabled();o.restored={globe:restored,state:await guidanceState(page)};
    expect(saved()).toEqual(preferences);expect(fixture.operations.slice(operationStart).filter(entry=>entry.operation!=='get')).toEqual([]);expect(fixture.bookyWrites()).toEqual([]);expect(fixture.writes()).toEqual([]);const finalState=await guidanceState(page);for(const key of ['mode','route','step','screen','visibility','url'])expect(finalState[key]).toEqual(o.baseline.state[key]);
    o.checks=['localized mobile instructions are readable without implicit globe movement','trusted Show controls closes help and focuses a real enabled canonical control','finite Booky cue respects normal Stop or reduced motion','only the later real user zoom changes the canonical camera pose','actual WebGL loss shows current unavailable help without contradictory context tips','Search remains usable and Show controls is disabled while the globe is unavailable','real context restoration clears unavailable guidance and retains canonical owners','Booky route progress preferences and canonical selection remain exact'].map(name=>({name,pass:true}));Object.assign(result,{mobileGuidanceVerified:true,trustedControlsFocusVerified:true,finiteCuePolicyVerified:true,realZoomOnlyVerified:true,realGlobeLossVerified:true,unavailableSearchGateVerified:true,contextRestorationVerified:true,preferencesAndSelectionPreserved:true});if(language==='ru')o.checks.push({name:'a controlled reserved top cutoff stops a fresh target approach without replay',pass:true});
    // Append after every original assertion and the three original locale captures.
    // Controlled scheduling race only; no native-device or desktop-flow claim.
    result.originalGuidanceTouchOnlyProductActions=result.touchOnlyProductActions;
    result.touchOnlyProductActions=language==='ru';
    result.keyboardAccessibilityRaceHarness=language==='en';
    result.controlledSingleGlobeFocusRafTiming=true;
    const race=o.focusCallbackRace={language,mechanism:'single exact App focus RAF callee only; original callback retained until a later native RAF',
      keyboardScope:language==='en'?'Actual keyboard focus/input in the mobile App solely for cancellation evidence; no desktop flow or full accessibility claim':null};
    await expandGuidance();await input.expose(show(),'fresh Show before focus callback interruption');
    await phase('focus-race-held');await page.evaluate(()=>window.__bookyGlobeFocusRace.arm());
    await input.tap(show(),'trusted Show with its single focus callback held');await expect(panel(page)).toHaveCount(0);
    await expect.poll(()=>page.evaluate(()=>window.__bookyGlobeFocusRace.read().record?.heldAt??null),
      {intervals:[16,32],timeout:2000,message:'native RAF delivered the held single focus callback'}).not.toBeNull();
    race.held=await page.evaluate(()=>window.__bookyGlobeFocusRace.read());
    expect(race.held.nativeRafUnchanged).toBe(true);expect(race.held.armed).toBe(false);
    expect(race.held.pendingId).toBe(race.held.record.id);expect(race.held.record.invocationAt).toBeNull();
    expect(race.held.record.completionAt).toBeNull();await expect(page.locator('[data-booky-target-action="globe-controls"]')).toHaveCount(1);
    race.beforeInterruption={state:await guidanceState(page),globe:await actual(page),preferences:saved()};
    const searchToolbar=page.locator('[data-atlas-action="toggle-search"]');
    await expect(searchToolbar).toHaveAttribute('aria-expanded','false');
    await phase('focus-race-newer-input');
    if(language==='ru'){
      await input.tap(searchToolbar,'newer trusted atlas Search while focus callback is held');
    }else{
      // Actual page.keyboard events only: no locator.press, DOM.focus or assigned outcome.
      race.keyboardSteps=[];
      await expect(page.locator('[data-planet-mascot-toggle]')).toBeFocused();
      let searchFocused=false;
      for(let step=0;step<80;step++){
        await page.keyboard.press('Shift+Tab');
        const observed=await page.evaluate(()=>({searchFocused:document.activeElement?.matches('[data-atlas-action="toggle-search"]')??false,
          active:{tag:document.activeElement?.tagName,id:document.activeElement?.id,
            atlasAction:document.activeElement?.getAttribute('data-atlas-action'),globeControl:document.activeElement?.getAttribute('data-globe-control')}}));
        race.keyboardSteps.push({key:'Shift+Tab',observed});
        if(observed.searchFocused){searchFocused=true;break;}
      }
      expect(searchFocused,'bounded actual keyboard navigation reaches current atlas Search').toBe(true);
      await expect(searchToolbar).toBeFocused();await page.keyboard.press('Enter');
    }
    await expect(searchToolbar).toHaveAttribute('aria-expanded','true');
    const searchInput=page.locator('[data-atlas-search-input]:visible');await expect(searchInput).toHaveCount(1);
    await expect(searchInput).toBeFocused();
    if(language==='en'){
      await page.keyboard.type('verne');await expect(searchInput).toHaveValue('verne');
      race.keyboardSteps.push({key:'Enter then typed verne',observed:await guidanceState(page)});
    }
    await expect(page.locator('[data-booky-target-action="globe-controls"]')).toHaveCount(0);
    await expect(pet(page)).toHaveAttribute('data-planet-mascot-gesture','rest');
    race.interrupted=await page.evaluate(()=>{window.__bookyGuidanceNewerFocus=document.activeElement;return window.__bookyGlobeFocusRace.read();});
    expect(race.interrupted.record.invocationAt).toBeNull();expect(race.interrupted.pendingId).toBe(race.held.record.id);
    const trustedInterrupt=race.interrupted.events.find(event=>event.trusted&&event.at>race.held.record.heldAt
      &&(language==='ru'?event.type==='pointerdown'&&event.target?.atlasAction==='toggle-search':event.type==='keydown'&&event.key==='Tab'));
    expect(trustedInterrupt,'new genuine input occurred after the native frame held the callback').toBeTruthy();
    if(language==='en')expect(race.interrupted.events.some(event=>event.type==='input'&&event.trusted&&event.target?.searchInput)).toBe(true);
    race.newerFocus=await guidanceState(page);race.releaseMarker=await page.evaluate(()=>performance.now());
    await phase('focus-race-release');await page.evaluate(()=>window.__bookyGlobeFocusRace.release());
    await expect.poll(()=>page.evaluate(()=>window.__bookyGlobeFocusRace.read().record?.completionAt??null),
      {intervals:[16,32],timeout:2000,message:'exact delayed callback actually executed after interruption'}).not.toBeNull();
    await guidanceSettle(page);race.completed=await page.evaluate(()=>window.__bookyGlobeFocusRace.read());
    expect(race.completed.nativeRafUnchanged).toBe(true);expect(race.completed.pendingId).toBeNull();
    expect(race.completed.record.id).toBe(race.held.record.id);
    expect(race.completed.record.callbackText).toBe(race.held.record.callbackText);
    expect(race.completed.record.releaseAt).toBeGreaterThan(trustedInterrupt.at);
    expect(race.completed.record.invocationAt).toBeGreaterThanOrEqual(race.completed.record.releaseAt);
    expect(race.completed.record.completionAt).toBeGreaterThanOrEqual(race.completed.record.invocationAt);
    expect(await page.evaluate(()=>document.activeElement===window.__bookyGuidanceNewerFocus)).toBe(true);
    await expect(searchInput).toBeFocused();await expect(searchToolbar).toHaveAttribute('aria-expanded','true');
    expect(race.completed.events.filter(event=>event.type==='focusin'&&event.at>=race.releaseMarker&&event.target?.globeControl)).toEqual([]);
    await expect(page.locator('[data-booky-target-action="globe-controls"]')).toHaveCount(0);
    await expect(pet(page)).toHaveAttribute('data-planet-mascot-gesture','rest');
    await page.waitForTimeout(1900);await expect(searchInput).toBeFocused();
    await expect(page.locator('[data-booky-target-action="globe-controls"]')).toHaveCount(0);
    await expect(pet(page)).toHaveAttribute('data-planet-mascot-gesture','rest');
    race.trace=await page.evaluate(()=>window.__bookyGlobeFocusRace.read().releaseSamples);
    expect(race.trace.length).toBeGreaterThan(1);expect(race.trace.some(row=>row.action==='globe-controls')).toBe(false);
    race.after={state:await guidanceState(page),globe:await actual(page),preferences:saved()};
    retained(race.after.globe,restored);expect(race.after.preferences).toEqual(preferences);
    for(const key of ['mode','route','step','screen','visibility','url'])expect(race.after.state[key]).toEqual(finalState[key]);
    expect(fixture.operations.slice(operationStart).filter(entry=>entry.operation!=='get')).toEqual([]);
    expect(fixture.bookyWrites()).toEqual([]);expect(fixture.writes()).toEqual([]);
    expect(await page.evaluate(()=>window.__globeGuidanceTrace.controlClicks)).toEqual(controlClicks);
    race.completed=await page.evaluate(()=>window.__bookyGlobeFocusRace.stop());
    fixture.verify();
  }catch(error){const filename='diagnostic-failure-'+language+'.png',bytes=await page.screenshot({path:testInfo.outputPath(filename)});o.failureCapture={filename,sha256:digest(bytes),error:error.message,scope:'failure diagnosis only'};await testInfo.attach('diagnostic-failure-'+language,{path:testInfo.outputPath(filename),contentType:'image/png'});throw error;
  }finally{o.trace=await page.evaluate(()=>{const state=window.__globeGuidanceTrace;if(state)state.active=false;return state??null;});await input.close();await fixture.close();}
});
