import { test, expect, chromium } from '@playwright/test';
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SITE = 'https://booky-journey.test';
const KEY = 'probpera-planet-composition-v1';
const BOOKY = 'probpera-booky-adult-v1';
const READER='probpera-booky-reader-policy-v1';
const V1_SEED = {schemaVersion:2,audience:'adult',visible:true,resume:null,progress:[]};
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

// Test-only interface guidance and synthetic independent receipts. No literary
// facts, production approval, child access or content are supplied by this module.
const SYNTHETIC_CONTENT = `
import { contentTextHash } from '../planet/contentExportHash';
import { getBookyDialogueChecksum, getBookyDialogueContentChecksum } from './bookyDialogueRegistry';
import { bookyJourneyEntityId, getBookyJourneyChecksum } from './bookyJourney';
const id='test.actual-app-journey',reviewedAt='2026-09-20T12:00:00.000Z';
const definitions=[],dialogues=[],dialogueApprovals=[],journeyApprovals=[],availability=[];
for(const locale of ['ru','en']){
  const nodes=[
    {id:'country',kind:'country',screen:'globe',entity:{kind:'country',countryId:'russia'}},
    {id:'writer',kind:'writer',screen:'globe',entity:{kind:'writer',countryId:'russia',writerId:'dostoevsky'}},
    {id:'work',kind:'work',screen:'collection',entity:{kind:'work',countryId:'russia',writerId:'dostoevsky',workId:'crime-and-punishment'}},
    {id:'checkpoint',kind:'checkpoint',screen:'globe',entity:null},
  ].map(node=>{
    const title=locale==='ru'?'Тест интерфейса: '+node.id:'Interface test: '+node.id;
    const body=locale==='ru'?'Откройте этот экран и подтвердите шаг, когда будете готовы.':'Open this screen and acknowledge the step when you are ready.';
    const payload={id:id+'.'+node.id,locale,version:1,audience:'adult',ageRange:{min:18,max:120},readingLevel:'plain',
      intent:'navigation',screens:[node.screen],context:id+':'+node.id,
      entityIds:node.entity?[bookyJourneyEntityId(node.entity)]:[],claimKind:'interface-guidance',factualSources:[],
      copy:{title,body,caption:body,reduced:title},narration:null,prohibitedTags:[],
      provenance:{kind:'editorial',sourcePath:'tests/pwa/booky-journey.spec.mjs',sourceVersion:1,sourceRef:'synthetic-only:'+node.id,
        sourceSha256:'a'.repeat(64),copySha256:contentTextHash(JSON.stringify({title,body}))}};
    const review={status:'approved',reviewer:'synthetic-dialogue-reviewer-not-real',reviewedAt,contentChecksum:getBookyDialogueContentChecksum(payload)};
    dialogues.push({payload,review,checksum:getBookyDialogueChecksum({payload,review})});
    dialogueApprovals.push({id:payload.id,locale,version:1,contentChecksum:review.contentChecksum,reviewer:review.reviewer,reviewedAt});
    return {...node,dialogue:{id:payload.id,version:1,contentChecksum:review.contentChecksum}};
  });
  const definition={schemaVersion:1,id,version:1,locale,audience:'adult',ageRange:{min:18,max:120},readingLevel:'plain',
    title:locale==='ru'?'Тестовый маршрут интерфейса':'Synthetic interface journey',prerequisites:[],nodes};
  definitions.push(definition);
  journeyApprovals.push({id,version:1,locale,definitionChecksum:getBookyJourneyChecksum(definition),reviewer:'synthetic-journey-reviewer-not-real',reviewedAt});
  availability.push({journeyId:id,version:1,locale,nodes:nodes.map(node=>({nodeId:node.id,locale,
    dialogueContentChecksum:node.dialogue.contentChecksum,available:true,offlineAvailable:true}))});
}
const approved={definitions,dialogues,currentVersions:[{id,version:1}],dialogueApprovals,journeyApprovals,availability};
const missingReview={...approved,journeyApprovals:[]};
export function readBookyJourneyContent(){return window.__journeyContentMode==='missing-review'?missingReview:approved;}
`;

// Actual App, source CSS and existing R3F scene. Native OS/preference bindings
// and HTTP delivery of real split chunks are controlled. Every camera movement uses real product controls or
// a Playwright pointer gesture; the fixture never assigns camera/controls state.
test.beforeAll(async () => {
  test.setTimeout(120_000);
  const output = path.join(ROOT, '.tmp/booky-journey-memory');
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
        set:async({key,value})=>{await window.__osPreference('set',key,value,window.__bookyJourneyFixture.sample?.()??null)},
        remove:async({key})=>{await window.__osPreference('remove',key)}},
      browser:{open:async()=>{throw Error('External browser unavailable in this source fixture')}},appLauncher:{openUrl:async()=>({completed:false})}};
    const scenes=()=>[..._roots.entries()].map(([canvas,root])=>{const s=root.store.getState();
      return{canvas,renderer:s.gl,camera:s.camera,scene:s.scene,controls:s.controls,invalidate:s.invalidate}});
    const current=()=>scenes().find(value=>document.querySelector('#atlas')?.contains(value.canvas));
    const rounded=array=>array.map(n=>Number(n.toFixed(5)));
    const pose=root=>({position:rounded(root.camera.position.toArray()),quaternion:rounded(root.camera.quaternion.toArray()),
      zoom:root.camera.zoom,fov:root.camera.fov,target:root.controls?rounded(root.controls.target.toArray()):null});
    let original=null;
    window.__bookyJourneyFixture={scenes,remember:()=>{original=current()},
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
        for(let i=0;i<2;i++){root.invalidate();await new Promise(requestAnimationFrame)}return window.__bookyJourneyFixture.sample();},
    };
    createAndroidPlatformAdapter({bindings,channel:'dev'}).then(mountHostApp).catch(error=>{window.__bookyJourneyFixtureError=error.message});
  ` }, bundle: true, write: false, metafile: true, outdir: output, entryNames: 'booky-journey', assetNames: 'assets/[name]-[hash]',
    publicPath: '/fixture/', format: 'esm', splitting: true, chunkNames: 'chunks/[name]-[hash]', platform: 'browser', target: 'es2020', jsx: 'automatic', logLevel: 'silent',
    define: { 'process.env.NODE_ENV': '"development"', 'import.meta.env': JSON.stringify({ BASE_URL: '/', DEV: false, PROD: true,
      VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '', VITE_TURNSTILE_SITE_KEY: '' }),
      __LITERARY_PLANET_EDITION__: '"native"', __LITERARY_PLANET_LOCAL_QA__: 'false',
      __LITERARY_PLANET_LICENSE_AUTHORITY__: 'null', __YANDEX_METRIKA_COUNTER_ID__: '""' },
    loader: { '.css': 'css', '.png': 'file', '.webp': 'file', '.avif': 'file', '.jpg': 'file', '.jpeg': 'file', '.svg': 'file', '.woff': 'file', '.woff2': 'file' },
    plugins: [{ name: 'canonical-vite-resources', setup(builder) {
      builder.onLoad({ filter: /[\\/]bookyJourneyContent\.ts$/ }, args => ({ contents: SYNTHETIC_CONTENT, loader: 'ts', resolveDir: path.dirname(args.path) }));
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
  const required = ['src/host/bookyJourneyContent.ts','src/host/bookyJourneyRuntime.ts','src/host/bookyJourney.ts','src/host/BookyJourneyControls.tsx','src/components/WriterPanel.tsx','src/components/BookArchiveSection.tsx','src/books/bookArchiveDetailView.ts','src/host/bookyReaderPolicy.ts','src/host/bookyReaderPolicyStore.ts','src/host/BookyReaderSettings.tsx','src/host/bookyJourneyHost.ts','src/App.tsx', 'src/host/mountHostApp.tsx', 'src/components/LiteraryGlobe.tsx', 'src/components/LiteraryWorldMap.tsx',
    'src/components/GlobeCameraRig.tsx', 'src/components/globeAtlas.ts', 'src/host/planetMascot.ts', 'src/host/planetMascotRoutes.ts',
    'src/host/PlanetMascotControls.tsx', 'src/host/PlanetMascotControls.css', 'src/host/PlanetMascotAvatar.tsx', 'src/host/PlanetMascotAvatar.css',
    'src/host/bookyModel.ts', 'src/host/bookyAnimation.ts', 'src/host/useBookyRenderer.ts', 'src/host/bookySupport.ts', 'src/host/bookyTourProgress.ts',
    'src/host/planetMascotPreference.ts', 'src/host/planetMascotPersistence.ts', 'src/host/HostPlatformServices.ts', ASSET];
  for (const filename of required) expect(inputs).toContain(filename);
  const sourcePaths = [...new Set([...required, ...inputs.filter(value => value.startsWith('src/') && !value.includes('?')), 'tests/pwa/booky-journey.spec.mjs'])].sort();
  const sourceInputs = await Promise.all(sourcePaths.map(async filename => ({ path: filename, sha256: digest(await fs.readFile(path.join(ROOT, filename))) })));
  files = new Map(built.outputFiles.map(file => ['/fixture/' + path.relative(output, file.path).replaceAll('\\', '/'), Buffer.from(file.contents)]));
  const selectionBytes = await fs.readFile(path.join(ROOT, 'scripts/mobile/native-base-assets.json'));
  selectedAssets = new Map(JSON.parse(selectionBytes).files.map(entry => {
    if (entry.source !== 'public/' + entry.output || entry.transformation !== 'none' || /(?:^|\/)\.\.(?:\/|$)|\\/u.test(entry.output)) throw Error('Invalid selected native asset');
    return ['/' + entry.output, entry];
  }));
  sourceEvidence = { kind: 'canonical-app-adult-booky-journey-in-Chrome', actualApp: true, actualCss: true, actualGlobe: true,
    controlledPorts: ['native OS lifecycle and preference map', 'HTTP delivery of real split chunks', 'explicitly synthetic content provider'],
    controllerObservation: 'No controller is replaced or called by the fixture. Semantic progress and readiness are observed through the real rendered controls.',
    bookChunks, primaryBookChunk, retryBookChunk, sharedBookDependencies,
    countryChunks, primaryCountryChunk, retryCountryChunk, sharedCountryDependencies,
    componentChunks, primaryComponentChunk, retryComponentChunk, sharedComponentDependencies, sourceInputs,
    cameraAuthority: 'Only existing canonical App navigation owns scene changes; no fixture camera assignments or synthetic navigation acknowledgement.',
    representation: 'Actual App journey controls, compiler, fresh admission, runtime and canonical country/writer/book navigation. Only the content provider is replaced with explicitly synthetic RU/EN interface guidance and test review receipts; native bindings and Vite glob delivery are controlled. Source fixture evidence, not a dist artifact, installed-device or production journey acceptance.',
    contentSubstitution: { path: 'src/host/bookyJourneyContent.ts', syntheticOnly: true, sourceSha256: digest(SYNTHETIC_CONTENT), realCanonicalTuple: ['russia','dostoevsky','crime-and-punishment'] },
    fallbackArtwork: { path: ASSET, sha256: ASSET_SHA, bytes: assetBytes.length, width: 1254, height: 1254, pngColorType: 6,
      bundledPath: '/fixture/' + path.relative(output, assetOutput.path).replaceAll('\\', '/') },
    publicAssetSelectionSha256: digest(selectionBytes), selectedAssetCount: selectedAssets.size,
    builtFiles: built.outputFiles.map(file => ({ path: path.relative(output, file.path).replaceAll('\\', '/'), sha256: digest(file.contents) })),
    installedNative: false, deviceTested: false, childReviewed: false, childProfileCreated: false, childAccessGranted: false, reviewedDialogueAccepted: false, narrationEnabled: false, artAccepted: false, devicePerformanceAccepted: false, releaseReady: false };
});

const CONFIRMED_READER = JSON.stringify({ schemaVersion: 1, audience: 'adult', age: 30,
  readingLevel: 'plain', confirmedAt: '2026-09-22T12:00:00.000Z', revision: 1 });
const WORK_KEY = 'russia:dostoevsky:crime-and-punishment';
const panel = page => page.locator('[data-planet-mascot-panel]');
const pet = page => page.locator('[data-planet-mascot-pet]');
const status = page => page.locator('[data-booky-journey-status]');
const next = page => page.locator('[data-booky-journey-next]');
const node = page => page.locator('[data-booky-journey-node]');
const sample = page => page.evaluate(() => window.__bookyJourneyFixture.sample());

async function open(testInfo, { contentMode = 'approved', readerSeed = CONFIRMED_READER } = {}) {
  const profileRoot = path.resolve(process.env.S15_BROWSER_PROFILE_ROOT ?? path.join(ROOT, '.tmp/s15-booky-live'));
  await fs.mkdir(profileRoot, { recursive: true });
  const profile = await fs.mkdtemp(path.join(profileRoot, 'journey-'));
  const context = await chromium.launchPersistentContext(profile, { channel: 'chrome', headless: true,
    viewport: { width: 1440, height: 850 }, reducedMotion: 'reduce', hasTouch: true });
  const page = await context.newPage(); page.setDefaultTimeout(15_000);
  const memory = new Map([['probpera-interface-language', 'ru'], ['probpera-planet-welcome-v1', 'completed'],
    [KEY, JSON.stringify({ schemaVersion: 1, commitId: 'booky-journey-fixture:1', selection: BASE })],
    [BOOKY, JSON.stringify(V1_SEED)]]);
  if (readerSeed !== null) memory.set(READER, readerSeed);
  const operations = [], errors = [], externalRequests = [], missingResources = [], requestedChunks = [];
  const result = { ...sourceEvidence, contentMode, initialReaderPreference: readerSeed,
    pass: false, observations: {}, screenshots: [] };
  await page.addInitScript(mode => { window.__journeyContentMode = mode; }, contentMode);
  page.on('pageerror', error => errors.push(error.message));
  await page.exposeBinding('__osPreference', async (_source, operation, key, value) => {
    operations.push({ operation, key, ...(value === undefined ? {} : { value }) });
    if (operation === 'get') return memory.get(key) ?? null;
    if (operation === 'set') { memory.set(key, value); return; }
    if (operation === 'remove') { memory.delete(key); return; }
    throw Error('Unknown native preference operation');
  });
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== SITE) { externalRequests.push(url.href); await route.abort(); return; }
    if (route.request().resourceType() === 'document' && url.pathname === '/') {
      await route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="/fixture/booky-journey.css"></head><body><div id="root"></div><script type="module" src="/fixture/booky-journey.js"></script></body></html>' }); return;
    }
    const pathname = decodeURIComponent(url.pathname);
    if ([...bookChunks, ...countryChunks, ...componentChunks].includes(pathname)) requestedChunks.push(pathname);
    if (!files.has(pathname) && selectedAssets.has(pathname)) {
      const entry = selectedAssets.get(pathname), filename = path.resolve(ROOT, entry.source);
      if (await fs.realpath(filename) !== filename) throw Error('Linked selected asset');
      const bytes = await fs.readFile(filename);
      if (digest(bytes) !== entry.sourceSha256) throw Error('Stale selected fixture asset: ' + entry.output);
      files.set(pathname, bytes);
    }
    const bytes = files.get(pathname);
    if (bytes) { await route.fulfill({ contentType: mime[path.extname(pathname)] ?? 'application/octet-stream', body: bytes }); return; }
    if (pathname !== '/favicon.ico') missingResources.push(pathname);
    await route.fulfill({ status: 404, contentType: 'text/plain', body: 'Unselected fixture asset' });
  });
  try {
    await page.goto(SITE + '/#atlas');
    await expect(page.locator('.native-planet-app[data-planet-ready="true"]')).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('.native-planet-launch')).toBeHidden();
    await expect(page.locator('#atlas .literary-globe')).toHaveAttribute('data-globe-webgl-context', 'ready');
    await expect(page.locator('#atlas .literary-globe')).toHaveAttribute('data-globe-camera-phase', 'idle');
    await expect(page.locator('#atlas canvas')).toHaveCount(1);
    expect(await page.evaluate(() => window.__bookyJourneyFixtureError ?? null)).toBeNull();
    await page.evaluate(() => window.__bookyJourneyFixture.remember());
    return { page, memory, result, requestedChunks,
      verify() {
        expect(errors).toEqual([]); expect(externalRequests).toEqual([]); expect(missingResources).toEqual([]);
        expect(operations.filter(entry => entry.operation !== 'get' && CUSTOMIZATION_KEYS.has(entry.key))).toEqual([]);
        expect(operations.filter(entry => entry.operation !== 'get'
          && ![BOOKY, READER, 'probpera-interface-language', 'probpera-planet-recent-adult-v1'].includes(entry.key))).toEqual([]);
        expect(memory.get(READER) ?? null).toBe(readerSeed); result.pass = true;
      },
      async close() {
        result.finalDom = await page.evaluate(() => {
          const describe = element => {
            if (!element) return null;
            const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
            return { tag: element.tagName, className: element.className, data: { ...element.dataset },
              rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, top: rect.top, bottom: rect.bottom },
              display: style.display, visibility: style.visibility, height: style.height, overflowX: style.overflowX,
              overflowY: style.overflowY, scrollTop: element.scrollTop, transition: style.transition,
              hiddenAncestor: element.closest('[hidden], [inert], [aria-hidden="true"]')?.className ?? null,
              animations: element.getAnimations().map(animation => ({ state: animation.playState,
                pending: animation.pending, currentTime: animation.currentTime,
                timing: animation.effect?.getComputedTiming(), transitionProperty: animation.transitionProperty })) };
          };
          const detail = document.querySelector('#book-archive-detail'), ancestors = [];
          for (let ancestor = detail?.parentElement; ancestor; ancestor = ancestor.parentElement) ancestors.push(describe(ancestor));
          return { url: location.href, hidden: document.hidden, reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
            journey: document.querySelector('[data-booky-journey-status]')?.getAttribute('data-booky-journey-status'),
            node: document.querySelector('[data-booky-journey-node]')?.getAttribute('data-booky-journey-node'),
            detail: describe(detail), ancestors,
            workObservations: window.__journeyWorkObservations ?? [] };
        }).catch(error => ({ diagnosticError: error.message }));
        Object.assign(result, { operations, errors, externalRequests, missingResources, requestedChunks,
          finalReaderPreference: memory.get(READER) ?? null, finalBookyPreference: JSON.parse(memory.get(BOOKY) ?? 'null') });
        const filename = testInfo.outputPath('booky-journey.json');
        await fs.writeFile(filename, JSON.stringify(result, null, 2) + '\n');
        await testInfo.attach('booky-journey-source-evidence', { path: filename, contentType: 'application/json' });
        await context.close();
      } };
  } catch (error) { await context.close(); throw error; }
}

async function actual(page) {
  let observed;
  await expect.poll(async () => { observed = await sample(page); return observed?.uploaded ? observed.selection : null; }).toEqual(BASE);
  observed = await page.evaluate(() => window.__bookyJourneyFixture.renderSample());
  expect(observed.surfaceCount).toBe(1); expect(observed.mascotObjects).toEqual([]);
  expect(observed.contextLost).toBe(false); expect(observed.gpu.calls).toBeGreaterThan(0);
  return observed;
}
function retained(current, original, samePose = false) {
  expect(current.sameScene).toBe(true); expect(current.texture).toBe(original.texture);
  expect(current.geometry).toBe(original.geometry); expect(current.backgroundResource).toBe(original.backgroundResource);
  expect(current.selection).toEqual(original.selection);
  if (samePose) expect(current.pose).toEqual(original.pose);
}
async function stablePose(page) {
  let previous, matches = 0;
  await expect.poll(async () => { const key = JSON.stringify((await sample(page)).pose);
    matches = key === previous ? matches + 1 : 0; previous = key; return matches;
  }, { intervals: [80, 150, 250] }).toBeGreaterThanOrEqual(3);
}
async function openPanel(page) {
  if (!await panel(page).count()) await page.locator('[data-planet-mascot-toggle]').click();
  await expect(page.locator('[data-booky-journey-controls]')).toBeVisible();
  await expect(page.locator('[data-booky-reader-state]')).toHaveAttribute('data-booky-reader-state', 'ready');
}
async function loadBooks(page) {
  const load = page.locator('[data-booky-journey-load]');
  if (await load.count()) { await expect(load).toBeEnabled(); await load.click(); await expect(load).toHaveCount(0, { timeout: 60_000 }); }
}
async function expectProgress(page, count) {
  await expect(page.locator('[data-booky-journey-progress]')).toHaveText(new RegExp('(?:Подтверждено шагов:|Steps acknowledged:) ' + count + ' (?:из|of) 4', 'u'));
}
async function resumeIfPaused(page) {
  await openPanel(page);
  const resume = page.locator('[data-booky-journey-resume]');
  if (await resume.count()) { await expect(resume).toBeEnabled(); await resume.click(); }
}
async function expectReadyNode(page, id, count) {
  await openPanel(page);
  await expect(node(page)).toHaveAttribute('data-booky-journey-node', id);
  await expect(status(page)).toHaveAttribute('data-booky-journey-status', /^(ready|paused)$/u);
  await resumeIfPaused(page);
  await expect(status(page)).toHaveAttribute('data-booky-journey-status', 'ready');
  await expect(next(page)).toBeEnabled();
  await expectProgress(page, count);
}
async function locale(page, language) {
  await page.locator('.native-planet-app .interface-language-control button:visible')
    .filter({ hasText: new RegExp('^' + language.toUpperCase() + '$', 'u') }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', language);
}
async function capture(fixture, testInfo, filename, framing) {
  await fixture.page.evaluate(() => document.fonts.ready);
  await fixture.page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const bytes = await fixture.page.screenshot({ path: testInfo.outputPath(filename), animations: 'disabled' });
  fixture.result.screenshots.push({ filename, sha256: digest(bytes), ...fixture.page.viewportSize(), framing });
}
async function reachableJourneyControls(page) {
  const controls = page.locator('[data-booky-journey-controls] button:visible');
  const observations = [];
  for (let index = 0; index < await controls.count(); index++) {
    const button = controls.nth(index); await button.scrollIntoViewIfNeeded();
    let observed;
    await expect.poll(async () => {
      observed = await button.evaluate(element => {
        const bounds = element.getBoundingClientRect(), hit = document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
        return { label: element.textContent, left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom,
          width: bounds.width, height: bounds.height, viewport: innerWidth, reachable: !!hit && element.contains(hit),
          overflow: document.documentElement.scrollWidth > innerWidth + 1 };
      });
      return observed.height >= 44 && observed.left >= 0 && observed.right <= observed.viewport && observed.reachable && !observed.overflow;
    }).toBe(true);
    observations.push(observed);
  }
  expect(observations.length).toBeGreaterThanOrEqual(3);
  await next(page).scrollIntoViewIfNeeded();
  return observations;
}

test('actual reviewed fixture follows country writer work and explicit checkpoint across locale and suspension', async ({}, testInfo) => {
  test.setTimeout(180_000);
  const fixture = await open(testInfo), { page, result } = fixture;
  result.scenario = 'explicit-journey';
  try {
    const original = await actual(page);
    await openPanel(page); await loadBooks(page);
    const route = page.locator('[data-booky-journey-route]');
    await expect(route).toHaveCount(1); await route.click();
    await expectReadyNode(page, 'country', 0);
    await expect(page.locator('#atlas .literary-globe')).toHaveAttribute('data-globe-camera-phase', 'idle');
    await page.setViewportSize({ width: 320, height: 780 });
    await expectReadyNode(page, 'country', 0);
    result.observations.ruReachability = await reachableJourneyControls(page);
    await capture(fixture, testInfo, 'journey-country-ru.png', '320px actual App country step with explicit acknowledgement; synthetic guidance only');
    await next(page).click();
    await expectReadyNode(page, 'writer', 1);
    await expect(page.locator('.writer-detail')).toBeVisible();
    await expect(page.locator('.writer-detail-heading')).toContainText('Достоевский');
    await locale(page, 'en');
    await expectProgress(page, 1);
    await expect(node(page)).toHaveAttribute('data-booky-journey-node', 'writer');
    await expect(node(page)).toContainText('Interface test: writer');
    await resumeIfPaused(page); await expectReadyNode(page, 'writer', 1);
    result.observations.enReachability = await reachableJourneyControls(page);
    await capture(fixture, testInfo, 'journey-writer-en.png', '320px actual App writer step retains one semantic acknowledgement after EN switch');

    await stablePose(page); const beforePause = await actual(page);
    await page.locator('[data-planet-mascot-collapse]').click(); await expect(panel(page)).toHaveCount(0);
    await page.evaluate(() => window.__bookyJourneyFixture.setVisible(false));
    await page.evaluate(() => window.__bookyJourneyFixture.setVisible(true));
    await openPanel(page);
    await expect(status(page)).toHaveAttribute('data-booky-journey-status', 'paused');
    await expectProgress(page, 1); await stablePose(page);
    retained(await actual(page), beforePause, true);
    await page.locator('[data-booky-journey-resume]').click();
    await expectReadyNode(page, 'writer', 1);
    await page.emulateMedia({ reducedMotion: 'no-preference' });

    // Observe real rendered readiness throughout the work transition. This
    // observer never invokes product methods or supplies an acknowledgement.
    await page.evaluate(() => {
      window.__journeyWorkObservations = [];
      const observe = () => {
        const current = document.querySelector('[data-booky-journey-node]');
        if (current?.getAttribute('data-booky-journey-node') !== 'work') return;
        const detail = document.querySelector('#book-archive-detail'), button = document.querySelector('[data-booky-journey-next]');
        const sheet = detail?.closest('.book-shelf-frame__detail');
        const bounds = detail?.getBoundingClientRect();
        window.__journeyWorkObservations.push({ enabled: !!button && !button.disabled,
          phase: document.querySelector('[data-booky-journey-status]')?.getAttribute('data-booky-journey-status'),
          visible: !!bounds?.width && !!bounds?.height && !detail.closest('[hidden], [inert], [aria-hidden="true"]'),
          sheetPhase: sheet?.getAttribute('data-mobile-phase') ?? null,
          sheetAnimations: sheet?.getAnimations().filter(animation => animation.pending
            || animation.playState === 'running' || animation.playState === 'paused').length ?? 0,
          bookKey: new URL(location.href).searchParams.get('book'), title: detail?.getAttribute('aria-label') ?? null });
      };
      const observer = new MutationObserver(observe); observer.observe(document.body, { subtree: true, childList: true, attributes: true });
      window.__stopJourneyWorkObservation = () => { observe(); observer.disconnect(); return window.__journeyWorkObservations; };
    });
    await next(page).click();
    await expectReadyNode(page, 'work', 2);
    await expect(pet(page)).toHaveAttribute('data-planet-mascot-screen', 'collection');
    await expect(page.locator('#book-archive-detail')).toBeVisible();
    await expect(page.locator('#book-archive-detail')).toHaveAttribute('aria-label', 'Crime and Punishment');
    expect(new URL(page.url()).searchParams.get('book')).toBe(WORK_KEY);
    const workObservations = await page.evaluate(() => window.__stopJourneyWorkObservation());
    expect(workObservations.some(item => !item.enabled)).toBe(true);
    expect(workObservations.some(item => item.enabled)).toBe(true);
    for (const item of workObservations.filter(item => item.enabled)) {
      expect(item.phase).toBe('ready'); expect(item.visible).toBe(true); expect(item.bookKey).toBe(WORK_KEY);
      expect(item.sheetPhase).toBe('idle'); expect(item.sheetAnimations).toBe(0);
    }
    result.observations.workReadiness = workObservations;
    retained(await actual(page), original);
    await next(page).click();
    await expectReadyNode(page, 'checkpoint', 3);
    await expect(pet(page)).toHaveAttribute('data-planet-mascot-screen', 'globe');
    await expectProgress(page, 3);
    await next(page).click();
    await expect(status(page)).toHaveAttribute('data-booky-journey-status', 'complete');
    await expectProgress(page, 4);
    retained(await actual(page), original);
    Object.assign(result.observations, { actualCountryWriterWork: true, exactWorkVisible: true,
      acknowledgementRequiresSettledView: true, explicitCheckpointCompletion: true, localeRetainsSemanticProgress: true,
      collapseBackgroundRequireResume: true, noAutomaticMovementOnResume: true, canonicalSceneRetained: true,
      syntheticApprovalOnly: true, durableJourneyProgressClaimed: false });
    fixture.verify();
  } finally { await fixture.close(); }
});

for (const scenario of [
  { name: 'no-profile', options: { readerSeed: null }, expectedStatus: 'profile-required' },
  { name: 'no-independent-journey-review', options: { contentMode: 'missing-review' }, expectedStatus: 'unavailable' },
]) test('journey admission fails closed: ' + scenario.name, async ({}, testInfo) => {
  test.setTimeout(120_000);
  const fixture = await open(testInfo, scenario.options), { page, result } = fixture;
  result.scenario = scenario.name;
  try {
    const original = await actual(page);
    await openPanel(page); await loadBooks(page);
    await expect(status(page)).toHaveAttribute('data-booky-journey-status', scenario.expectedStatus);
    await expect(page.locator('[data-booky-journey-route]')).toHaveCount(0);
    await expect(page.locator('[data-booky-journey-open]')).toHaveCount(0);
    await expect(next(page)).toHaveCount(0);
    await locale(page, 'en');
    await expect(status(page)).toHaveAttribute('data-booky-journey-status', scenario.expectedStatus);
    await expect(page.locator('[data-booky-journey-route]')).toHaveCount(0);
    await expect(page.locator('[data-booky-journey-progress]')).toHaveCount(0);
    retained(await actual(page), original, true);
    Object.assign(result.observations, { admissionDeniedRuEn: true, noJourneyNavigation: true,
      noJourneyProgress: true, canonicalSceneRetained: true, syntheticApprovalOnly: true });
    fixture.verify();
  } finally { await fixture.close(); }
});
