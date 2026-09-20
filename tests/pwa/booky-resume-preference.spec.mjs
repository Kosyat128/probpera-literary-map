import { test, expect, chromium } from '@playwright/test';
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SITE = 'https://booky-resume-preference.test';
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
let files, selectedAssets, sourceEvidence;

// Actual App, source CSS and existing R3F scene. Only native OS/preference
// bindings are controlled. Every camera movement uses real product controls or
// a Playwright pointer gesture; the fixture never assigns camera/controls state.
test.beforeAll(async () => {
  test.setTimeout(120_000);
  const output = path.join(ROOT, '.tmp/booky-resume-preference-memory');
  const built = await build({ absWorkingDir: ROOT, stdin: { resolveDir: ROOT, loader: 'ts', contents: `
    import{_roots}from'@react-three/fiber';
    import{mountHostApp}from'./src/host/mountHostApp';
    import{createAndroidPlatformAdapter}from'./src/platform/adapters/android/AndroidPlatformAdapter';
    const handles=[];let active=true;
    const subscribe=async(event,listener)=>{const handle={event,listener,removed:false,async remove(){handle.removed=true}};handles.push(handle);return handle};
    const bindings={core:{getPlatform:()=> 'android',isNativePlatform:()=>true,isPluginAvailable:()=>true},
      app:{getAppLanguage:async()=>({value:'ru-RU'}),getState:async()=>({isActive:active}),getLaunchUrl:async()=>undefined,addListener:subscribe},
      network:{getStatus:async()=>({connected:true,connectionType:'wifi'}),addListener:subscribe},
      preferences:{get:async({key})=>({value:await window.__osPreference('get',key)}),
        set:async({key,value})=>{await window.__osPreference('set',key,value,window.__bookyResumeFixture.sample?.()??null)},
        remove:async({key})=>{await window.__osPreference('remove',key)}},
      browser:{open:async()=>{throw Error('External browser unavailable in this source fixture')}},appLauncher:{openUrl:async()=>({completed:false})}};
    const scenes=()=>[..._roots.entries()].map(([canvas,root])=>{const s=root.store.getState();
      return{canvas,renderer:s.gl,camera:s.camera,scene:s.scene,controls:s.controls,invalidate:s.invalidate}});
    const current=()=>scenes().find(value=>document.querySelector('#atlas')?.contains(value.canvas));
    const rounded=array=>array.map(n=>Number(n.toFixed(5)));
    const pose=root=>({position:rounded(root.camera.position.toArray()),quaternion:rounded(root.camera.quaternion.toArray()),
      zoom:root.camera.zoom,fov:root.camera.fov,target:root.controls?rounded(root.controls.target.toArray()):null});
    let original=null;
    window.__bookyResumeFixture={scenes,remember:()=>{original=current()},
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
        for(let i=0;i<2;i++){root.invalidate();await new Promise(requestAnimationFrame)}return window.__bookyResumeFixture.sample();},
    };
    createAndroidPlatformAdapter({bindings,channel:'dev'}).then(mountHostApp).catch(error=>{window.__bookyResumeFixtureError=error.message});
  ` }, bundle: true, write: false, metafile: true, outdir: output, entryNames: 'booky-resume-preference', assetNames: 'assets/[name]-[hash]',
    publicPath: '/fixture/', format: 'iife', platform: 'browser', target: 'es2020', jsx: 'automatic', logLevel: 'silent',
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
      builder.onResolve({ filter: /^\// }, args => args.kind === 'url-token' ? { path: args.path, external: true } : undefined);
      builder.onResolve({ filter: /\.geojson\?url$/ }, args => ({ path: path.resolve(args.resolveDir, args.path.slice(0, -4)), namespace: 'canonical-geojson-url' }));
      builder.onLoad({ filter: /.*/, namespace: 'canonical-geojson-url' }, async args => ({ contents: await fs.readFile(args.path), loader: 'file' }));
    } }],
  });
  const inputs = Object.keys(built.metafile.inputs).map(value => value.replaceAll('\\', '/'));
  const assetBytes = await fs.readFile(path.join(ROOT, ASSET));
  expect(digest(assetBytes)).toBe(ASSET_SHA); expect(assetBytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect([assetBytes.readUInt32BE(16), assetBytes.readUInt32BE(20), assetBytes[25]]).toEqual([1254, 1254, 6]);
  const assetOutput = built.outputFiles.find(file => digest(file.contents) === ASSET_SHA); expect(assetOutput).toBeTruthy();
  const required = ['src/App.tsx', 'src/host/mountHostApp.tsx', 'src/components/LiteraryGlobe.tsx', 'src/components/LiteraryWorldMap.tsx',
    'src/components/GlobeCameraRig.tsx', 'src/components/globeAtlas.ts', 'src/host/planetMascot.ts', 'src/host/planetMascotRoutes.ts',
    'src/host/PlanetMascotControls.tsx', 'src/host/PlanetMascotControls.css', 'src/host/PlanetMascotAvatar.tsx', 'src/host/PlanetMascotAvatar.css',
    'src/host/bookyModel.ts', 'src/host/bookyAnimation.ts', 'src/host/useBookyRenderer.ts',
    'src/host/planetMascotPreference.ts', 'src/host/planetMascotPersistence.ts', 'src/host/HostPlatformServices.ts', ASSET];
  for (const filename of required) expect(inputs).toContain(filename);
  const sourcePaths = [...new Set([...required, ...inputs.filter(value => value.startsWith('src/') && !value.includes('?')), 'tests/pwa/booky-resume-preference.spec.mjs'])].sort();
  const sourceInputs = await Promise.all(sourcePaths.map(async filename => ({ path: filename, sha256: digest(await fs.readFile(path.join(ROOT, filename))) })));
  files = new Map(built.outputFiles.map(file => ['/fixture/' + path.relative(output, file.path).replaceAll('\\', '/'), Buffer.from(file.contents)]));
  const selectionBytes = await fs.readFile(path.join(ROOT, 'scripts/mobile/native-base-assets.json'));
  selectedAssets = new Map(JSON.parse(selectionBytes).files.map(entry => {
    if (entry.source !== 'public/' + entry.output || entry.transformation !== 'none' || /(?:^|\/)\.\.(?:\/|$)|\\/u.test(entry.output)) throw Error('Invalid selected native asset');
    return ['/' + entry.output, entry];
  }));
  sourceEvidence = { kind: 'canonical-app-adult-booky-resume-preference-in-Chrome', actualApp: true, actualCss: true, actualGlobe: true,
    controlledPorts: ['native OS plugins and preferences backed by a Node map'], sourceInputs,
    cameraAuthority: 'Companion show/hide/tour steps do not own the camera. Only existing canonical App navigation owns scene changes; no fixture camera assignments.',
    representation: 'Unchanged live companion. This scenario checks adult preference restoration and explicit resume through actual App UI.',
    fallbackArtwork: { path: ASSET, sha256: ASSET_SHA, bytes: assetBytes.length, width: 1254, height: 1254, pngColorType: 6,
      bundledPath: '/fixture/' + path.relative(output, assetOutput.path).replaceAll('\\', '/') },
    publicAssetSelectionSha256: digest(selectionBytes), selectedAssetCount: selectedAssets.size,
    builtFiles: built.outputFiles.map(file => ({ path: path.relative(output, file.path).replaceAll('\\', '/'), sha256: digest(file.contents) })),
    installedNative: false, deviceTested: false, childReviewed: false, childProfileCreated: false, childAccessGranted: false, reviewedDialogueAccepted: false, narrationEnabled: false, artAccepted: false, devicePerformanceAccepted: false, releaseReady: false };
});

async function open(testInfo, { rejectInitialBookyRead = false } = {}) {
  const profileRoot = path.resolve(process.env.S15_BROWSER_PROFILE_ROOT ?? path.join(ROOT, '.tmp/s15-booky-live'));
  await fs.mkdir(profileRoot, { recursive: true }); const profile = await fs.mkdtemp(path.join(profileRoot, 'pk-'));
  const context = await chromium.launchPersistentContext(profile, { channel: 'chrome', headless: true,
    viewport: { width: 1440, height: 850 }, reducedMotion: 'reduce', hasTouch: true });
  const page = await context.newPage(); page.setDefaultTimeout(12_000);
  const initialRecord = JSON.stringify({ schemaVersion: 1, commitId: 'booky-resume-preference-fixture:1', selection: BASE });
  const memory = new Map([['probpera-interface-language', 'ru'], ['probpera-planet-welcome-v1', 'completed'], [KEY, initialRecord], [BOOKY, JSON.stringify(SEED)]]);
  const operations = [], errors = [], externalRequests = [], missingResources = [];
  let rejectedWrites = 0, rejectedReads = rejectInitialBookyRead ? 1 : 0;
  const result = { ...sourceEvidence, pass: false, observations: {}, screenshots: [] };
  page.on('pageerror', error => errors.push(error.message));
  await page.exposeBinding('__osPreference', (_source, operation, key, value, observed) => {
    const entry={ operation, key, ...(value === undefined ? {} : { value }), ...(observed ? { observed } : {}) };operations.push(entry);
    if (operation === 'get') {
      if(key===BOOKY&&rejectedReads>0){rejectedReads--;entry.rejected=true;throw Error('Controlled native Booky read failure');}
      const stored=memory.get(key)??null;if(key===BOOKY)entry.result=stored;return stored;
    }
    if (operation === 'set') {
      if(key===BOOKY&&rejectedWrites>0){rejectedWrites--;entry.rejected=true;throw Error('Controlled native Booky write failure');}
      memory.set(key, value);return;
    }
    if (operation === 'remove') { memory.delete(key); return; }
    throw Error('Unknown native preference fixture operation');
  });
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== SITE) { externalRequests.push(url.href); await route.abort(); return; }
    if (route.request().resourceType() === 'document' && url.pathname === '/') {
      await route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="/fixture/booky-resume-preference.css"></head><body><div id="root"></div><script src="/fixture/booky-resume-preference.js"></script></body></html>' }); return;
    }
    const pathname = decodeURIComponent(url.pathname);
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
    await page.goto(SITE + '/?country=russia&writer=dostoevsky#atlas'); await ready(page);
    return { page, memory, operations, result, initialRecord,
      rejectNextBookyWrite(){rejectedWrites++;},
      bookyWrites:()=>operations.filter(value=>value.operation==='set'&&value.key===BOOKY),
      writes: () => operations.filter(value => value.operation !== 'get' && CUSTOMIZATION_KEYS.has(value.key)),
      verify() { expect(errors).toEqual([]); expect(externalRequests).toEqual([]); expect(missingResources).toEqual([]);
        expect(operations.filter(value=>value.operation!=='get'&&![BOOKY,'probpera-interface-language','probpera-planet-recent-adult-v1'].includes(value.key))).toEqual([]);
        result.pass = true; },
      async close() {
        result.customizationWrites = operations.filter(value => value.operation !== 'get' && CUSTOMIZATION_KEYS.has(value.key));
        result.unexpectedPreferenceWrites = operations.filter(value => value.operation !== 'get' && ![BOOKY, 'probpera-interface-language', 'probpera-planet-recent-adult-v1'].includes(value.key));
        result.bookyWrites=operations.filter(value=>value.operation==='set'&&value.key===BOOKY);result.finalBookyPreference=JSON.parse(memory.get(BOOKY)??'null');
        result.preferenceOperations = operations; result.errors = errors; result.externalRequests = externalRequests; result.missingResources = missingResources;
        const filename = testInfo.outputPath('booky-resume-preference.json'); await fs.writeFile(filename, JSON.stringify(result, null, 2) + '\n');
        await testInfo.attach('booky-resume-preference-source-evidence', { path: filename, contentType: 'application/json' }); await context.close();
      } };
  } catch (error) { await context.close(); throw error; }
}
const sample = page => page.evaluate(() => window.__bookyResumeFixture.sample());
const globe = page => page.locator('#atlas .literary-globe');
const pet = page => page.locator('[data-planet-mascot-pet]');
const panel = page => page.locator('[data-planet-mascot-panel]');
async function ready(page) {
  await expect(page.locator('.native-planet-app[data-planet-ready="true"]')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.native-planet-launch')).toBeHidden();
  await expect(globe(page)).toHaveAttribute('data-globe-webgl-context', 'ready');
  await expect(globe(page)).toHaveAttribute('data-globe-camera-phase', 'idle');
  await expect(page.locator('#atlas canvas')).toHaveCount(1);
  expect(await page.evaluate(() => window.__bookyResumeFixtureError ?? null)).toBeNull();
}
async function actual(page) {
  let observed;
  await expect.poll(async () => { observed = await sample(page); return observed?.uploaded ? observed.selection : null; }).toEqual(BASE);
  observed = await page.evaluate(() => window.__bookyResumeFixture.renderSample());
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
async function persisted(fixture, expected) {
  await expect.poll(()=>JSON.parse(fixture.memory.get(BOOKY)??'null')).toEqual(expected);
  await expect.poll(()=>{
    const operation=fixture.operations.filter(value=>value.key===BOOKY).at(-1);
    return operation?.operation==='get'?JSON.parse(operation.result??'null'):null;
  }).toEqual(expected);
}
const savedStep=stepId=>({...SEED,resume:{route:'overview',stepId}});
async function snapshot(page) {
  return{globe:await actual(page),ui:await page.evaluate(()=>{
    const pet=document.querySelector('[data-planet-mascot-pet]'),panel=document.querySelector('[data-planet-mascot-panel]');
    return{visibility:pet?.dataset.planetMascotVisibility,mode:pet?.dataset.planetMascotMode,
      route:pet?.dataset.planetMascotCurrentRoute,step:pet?.dataset.planetMascotStep,screen:pet?.dataset.planetMascotScreen,
      panelOpen:!!panel,text:panel?.textContent??'',language:document.documentElement.lang};
  })};
}
async function fitNarrow(page) {
  let layout;
  await expect.poll(async()=>{
    layout=await page.evaluate(()=>{
      const rect=selector=>{const element=document.querySelector(selector);if(!element)return null;
        const r=element.getBoundingClientRect();return{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
      return{width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth+1,
        pet:rect('[data-planet-mascot-pet]'),panel:rect('[data-planet-mascot-panel]'),avatar:rect('[data-planet-mascot-avatar]')};
    });
    return !layout.overflow&&[layout.pet,layout.panel,layout.avatar].every(rect=>rect&&rect.width>0&&rect.height>0
      &&rect.left>=-.5&&rect.top>=-.5&&rect.right<=layout.width+.5&&rect.bottom<=layout.height+.5);
  },{message:'Actual 320px pet and saved-tour card have settled inside the viewport'}).toBe(true);
  return layout;
}
async function fitClosedNotice(page) {
  let layout;
  await expect.poll(async()=>{
    layout=await page.evaluate(()=>{
      const rect=selector=>{const element=document.querySelector(selector);if(!element)return null;
        const r=element.getBoundingClientRect();return{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
      const button=document.querySelector('[data-planet-mascot-retry-preference]'),r=button?.getBoundingClientRect();
      return{width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth+1,
        pet:rect('[data-planet-mascot-pet]'),notice:rect('[data-planet-mascot-preference-state]'),retry:rect('[data-planet-mascot-retry-preference]'),
        retryReachable:!!r&&button.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2))};
    });
    return !layout.overflow&&layout.retryReachable&&[layout.pet,layout.notice,layout.retry].every(rect=>rect&&rect.width>0&&rect.height>0
      &&rect.left>=-.5&&rect.top>=-.5&&rect.right<=layout.width+.5&&rect.bottom<=layout.height+.5);
  },{message:'Actual 320px closed companion failure and retry remain reachable inside the viewport'}).toBe(true);
  return layout;
}

test('adult Booky preferences offer explicit tour resume and persist hiding and the current semantic step',async({},testInfo)=>{
  test.setTimeout(120_000);const fixture=await open(testInfo,{rejectInitialBookyRead:true}),{page,result}=fixture;
  try{
    // A failed initial native read must be recoverable before Show creates an
    // explicit preference, otherwise the unread saved route would be erased.
    await page.setViewportSize({width:320,height:844});
    await expect(pet(page)).toHaveAttribute('data-planet-mascot-visibility','hidden');
    await expect(panel(page)).toHaveCount(0);await expect(page.locator('[data-booky-canvas]')).toHaveCount(0);
    await expect(page.locator('[data-planet-mascot-preference-state]')).toHaveCount(1);
    await expect(page.locator('[data-planet-mascot-preference-state="failed"]')).toContainText('Не удалось восстановить настройки помощника.');
    const readFailureLayout=await fitClosedNotice(page);
    expect(fixture.bookyWrites()).toEqual([]);expect(JSON.parse(fixture.memory.get(BOOKY))).toEqual(SEED);
    await page.evaluate(()=>window.__bookyResumeFixture.remember());await stablePose(page);
    const readFailureBaseline=await actual(page);
    result.observations.coldReadFailure={...await snapshot(page),layout:readFailureLayout};
    const readFailureImage='booky-read-failure-ru-320.png',readFailureBytes=await page.screenshot({path:testInfo.outputPath(readFailureImage)});
    result.screenshots.push({filename:readFailureImage,sha256:digest(readFailureBytes),width:320,height:844,
      framing:'actual-App hidden companion read failure with direct retry; saved preference unchanged'});
    await page.locator('[data-planet-mascot-retry-preference]').click();
    await expect(page.locator('[data-planet-mascot-preference-state]')).toHaveCount(0);
    await expect(page.locator('[data-planet-mascot-toggle]')).toBeFocused();
    await expect(pet(page)).toHaveAttribute('data-planet-mascot-visibility','shown');
    await expect(panel(page)).toHaveCount(0);
    expect(fixture.bookyWrites()).toEqual([]);expect(JSON.parse(fixture.memory.get(BOOKY))).toEqual(SEED);
    expect(fixture.operations.filter(value=>value.operation==='get'&&value.key===BOOKY&&value.rejected)).toHaveLength(1);
    retained(await actual(page),readFailureBaseline);result.observations.readRetryRestoresClosedOffer=await snapshot(page);
    await page.setViewportSize({width:1440,height:850});
    await expect(pet(page)).toHaveAttribute('data-planet-mascot-visibility','shown');
    await expect(panel(page)).toHaveCount(0);
    await expect(pet(page)).toHaveAttribute('data-planet-mascot-mode','help');
    await expect(pet(page)).toHaveAttribute('data-planet-mascot-current-route','none');
    await expect(pet(page)).toHaveAttribute('data-planet-mascot-screen','globe');
    await page.evaluate(()=>window.__bookyResumeFixture.remember());await stablePose(page);
    const baseline=await actual(page);result.observations.coldRestored=await snapshot(page);
    expect(fixture.bookyWrites()).toEqual([]);expect(JSON.parse(fixture.memory.get(BOOKY))).toEqual(SEED);

    await page.locator('[data-planet-mascot-toggle]').click();await expect(panel(page)).toBeVisible();
    const offer=page.locator('[data-planet-mascot-resume-offer]');await expect(offer).toBeVisible();
    await expect(offer.getByRole('heading',{name:'Продолжим маршрут?',exact:true})).toBeVisible();
    await expect(offer).toContainText('Откройте коллекцию');
    retained(await actual(page),baseline);result.observations.offerRu=await snapshot(page);
    await page.locator('.native-planet-app .interface-language-control button').filter({hasText:/^EN$/u}).click();
    await expect(page.locator('html')).toHaveAttribute('lang','en');
    await expect(offer.getByRole('heading',{name:'Continue your tour?',exact:true})).toBeVisible();
    await expect(offer).toContainText('Open the collection');retained(await actual(page),baseline);
    await page.setViewportSize({width:320,height:844});const narrow=await fitNarrow(page);await stablePose(page);
    await expect(page.locator('[data-planet-mascot-avatar]')).toHaveAttribute('data-renderer-state','live3d');
    const narrowBaseline=await actual(page);retained(narrowBaseline,baseline,false);
    const filename='booky-resume-offer-en-320.png',bytes=await page.screenshot({path:testInfo.outputPath(filename)});
    result.screenshots.push({filename,sha256:digest(bytes),width:320,height:844,framing:'actual-App saved-tour offer; unchanged canonical globe'});
    result.observations.offerEn320={...await snapshot(page),layout:narrow};

    // The saved semantic collection step opens its instruction only. It must
    // not navigate, select content or claim that the collection is already open.
    await page.locator('[data-planet-mascot-resume]').click();
    await expect(pet(page)).toHaveAttribute('data-planet-mascot-current-route','overview');
    await expect(pet(page)).toHaveAttribute('data-planet-mascot-step','2');
    await expect(pet(page)).toHaveAttribute('data-planet-mascot-screen','globe');
    await expect(panel(page).getByRole('heading',{name:'Open the collection',exact:true})).toBeVisible();
    await expect(page.locator('[data-planet-mascot-next]')).toBeDisabled();
    await expect(page.locator('[data-planet-mascot-action="books"]')).toBeEnabled();
    retained(await actual(page),narrowBaseline);result.observations.resumedWithoutNavigation=await snapshot(page);
    expect(fixture.bookyWrites()).toEqual([]);

    fixture.rejectNextBookyWrite();
    await page.locator('[data-planet-mascot-hide]').click();
    await expect(pet(page)).toHaveAttribute('data-planet-mascot-visibility','hidden');
    await expect(panel(page)).toHaveCount(0);await expect(page.locator('[data-booky-canvas]')).toHaveCount(0);
    await expect(page.locator('[data-planet-mascot-preference-state]')).toHaveCount(1);
    await expect(page.locator('[data-planet-mascot-preference-state="failed"]')).toContainText('Could not save your choice.');
    expect(JSON.parse(fixture.memory.get(BOOKY))).toEqual(SEED);
    expect(fixture.bookyWrites()).toHaveLength(1);expect(fixture.bookyWrites()[0].rejected).toBe(true);
    const hideFailureLayout=await fitClosedNotice(page);
    retained(await actual(page),narrowBaseline);result.observations.failedHide={...await snapshot(page),layout:hideFailureLayout};
    const hideFailureImage='booky-hide-failure-en-320.png',hideFailureBytes=await page.screenshot({path:testInfo.outputPath(hideFailureImage)});
    result.screenshots.push({filename:hideFailureImage,sha256:digest(hideFailureBytes),width:320,height:844,
      framing:'actual-App hidden companion save failure with direct retry; globe retained'});
    await page.locator('[data-planet-mascot-retry-preference]').click();await persisted(fixture,HIDDEN);
    await expect(page.locator('[data-planet-mascot-preference-state]')).toHaveCount(0);
    await expect(page.locator('[data-planet-mascot-toggle]')).toBeFocused();
    await expect(pet(page)).toHaveAttribute('data-planet-mascot-visibility','hidden');await expect(panel(page)).toHaveCount(0);
    expect(fixture.bookyWrites()).toHaveLength(2);
    expect(fixture.bookyWrites().every(value=>JSON.stringify(JSON.parse(value.value))===JSON.stringify(HIDDEN))).toBe(true);
    retained(await actual(page),narrowBaseline);result.observations.hidden=await snapshot(page);
    const readsBefore=fixture.operations.filter(value=>value.key===BOOKY&&value.operation==='get').length;
    await page.reload();await ready(page);
    await expect.poll(()=>fixture.operations.filter(value=>value.key===BOOKY&&value.operation==='get').length).toBeGreaterThan(readsBefore);
    await expect(pet(page)).toHaveAttribute('data-planet-mascot-visibility','hidden');await expect(panel(page)).toHaveCount(0);
    await expect(page.locator('[data-booky-canvas]')).toHaveCount(0);
    await expect(page.locator('html')).toHaveAttribute('lang','en');
    await page.evaluate(()=>window.__bookyResumeFixture.remember());await stablePose(page);
    const reloadBaseline=await actual(page);result.observations.hiddenAfterReload=await snapshot(page);
    expect(fixture.bookyWrites()).toHaveLength(2);

    await page.locator('[data-planet-mascot-toggle]').click();await expect(panel(page)).toBeVisible();
    await expect(page.locator('[data-planet-mascot-resume-offer]')).toHaveCount(0);
    await persisted(fixture,{...HIDDEN,visible:true});
    await page.locator('[data-planet-mascot-route="overview"]').click();await persisted(fixture,savedStep('search'));
    await page.locator('[data-planet-mascot-next]').click();await expect(pet(page)).toHaveAttribute('data-planet-mascot-step','1');
    await persisted(fixture,savedStep('country'));result.observations.savedSemanticStep=await snapshot(page);
    retained(await actual(page),reloadBaseline);

    fixture.rejectNextBookyWrite();const beforeFailure=fixture.bookyWrites().length;
    await page.locator('[data-planet-mascot-next]').click();await expect(pet(page)).toHaveAttribute('data-planet-mascot-step','2');
    await expect(page.locator('[data-planet-mascot-preference-state="failed"]')).toContainText('Could not save your choice.');
    expect(JSON.parse(fixture.memory.get(BOOKY))).toEqual(savedStep('country'));
    expect(fixture.bookyWrites()).toHaveLength(beforeFailure+1);expect(fixture.bookyWrites().at(-1).rejected).toBe(true);
    result.observations.failedSaveKeepsCurrentStep=await snapshot(page);
    await page.locator('[data-planet-mascot-retry-preference]').click();await persisted(fixture,savedStep('collection'));
    await expect(page.locator('[data-planet-mascot-preference-state]')).toHaveCount(0);
    await expect(panel(page).getByRole('heading',{name:'Open the collection',exact:true})).toBeFocused();
    expect(fixture.bookyWrites()).toHaveLength(beforeFailure+2);
    expect(fixture.bookyWrites().at(-1).rejected).toBeUndefined();
    expect(JSON.parse(fixture.bookyWrites().at(-1).value)).toEqual(savedStep('collection'));
    retained(await actual(page),reloadBaseline);result.observations.retryConfirmedCurrentStep=await snapshot(page);
    expect(fixture.writes()).toEqual([]);expect(fixture.memory.get(KEY)).toBe(fixture.initialRecord);
    Object.assign(result,{closedOfferAfterLoad:true,explicitSemanticResume:true,noAutomaticNavigation:true,hideSurvivesReload:true,
      coldReadFailureRetryReachable:true,readRetryPreservesSavedRoute:true,failedHideRetryReachable:true,hideRetryKeepsCompanionHidden:true,
      closedRetryRestoresToggleFocus:true,narrowClosedFailuresFit:true,noDuplicatePersistenceNotices:true,
      semanticStepIdPersisted:true,failedWriteDoesNotRevertUi:true,explicitRetrySavesCurrentValue:true,retryRestoresHeadingFocus:true,
      localeRetainsOffer:true,narrowOfferFits:true,sameCanonicalSceneWithinEachLoad:true,noAppearanceWrites:true});fixture.verify();
  }finally{await fixture.close();}
});
