import { test, expect, chromium } from '@playwright/test';
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SITE = 'https://stand-inspection.test';
const KEY = 'probpera-planet-composition-v1';
const HEAD = 'stand.base.portrait-pushkin', WHALES = 'stand.base.three-whales', CLOUD = 'stand.base.child-book-cloud';
const BASE = { editionId: 'rand-mcnally-1887', standId: 'stand.base.wood', backgroundId: 'background.base.library' };
const selection = standId => ({ ...BASE, standId });
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
  const output = path.join(ROOT, '.tmp/stand-inspection-memory');
  const built = await build({ absWorkingDir: ROOT, stdin: { resolveDir: ROOT, loader: 'ts', contents: `
    import{_roots}from'@react-three/fiber';import{Vector3}from'three';
    import{mountHostApp}from'./src/host/mountHostApp';
    import{createAndroidPlatformAdapter}from'./src/platform/adapters/android/AndroidPlatformAdapter';
    const handles=[];let active=true;
    const subscribe=async(event,listener)=>{const handle={event,listener,removed:false,async remove(){handle.removed=true}};handles.push(handle);return handle};
    const bindings={core:{getPlatform:()=> 'android',isNativePlatform:()=>true,isPluginAvailable:()=>true},
      app:{getAppLanguage:async()=>({value:'ru-RU'}),getState:async()=>({isActive:active}),getLaunchUrl:async()=>undefined,addListener:subscribe},
      network:{getStatus:async()=>({connected:true,connectionType:'wifi'}),addListener:subscribe},
      preferences:{get:async({key})=>({value:await window.__osPreference('get',key)}),
        set:async({key,value})=>{await window.__osPreference('set',key,value,window.__standInspection.sample?.()??null)},
        remove:async({key})=>{await window.__osPreference('remove',key)}},
      browser:{open:async()=>{throw Error('External browser unavailable in this source fixture')}},appLauncher:{openUrl:async()=>({completed:false})}};
    const scenes=()=>[..._roots.entries()].map(([canvas,root])=>{const s=root.store.getState();
      return{canvas,renderer:s.gl,camera:s.camera,scene:s.scene,controls:s.controls,invalidate:s.invalidate}});
    const current=()=>scenes().find(value=>document.querySelector('#atlas')?.contains(value.canvas));
    const rounded=array=>array.map(n=>Number(n.toFixed(5)));
    const pose=root=>({position:rounded(root.camera.position.toArray()),quaternion:rounded(root.camera.quaternion.toArray()),
      zoom:root.camera.zoom,fov:root.camera.fov,target:root.controls?rounded(root.controls.target.toArray()):null});
    function standMetrics(group){
      if(!group)return null;group.updateWorldMatrix(true,true);
      const geometries=new Set(),textures=new Set(),materials=new Set(),point=new Vector3();
      const meshNames=[];let triangles=0,vertices=0,bytes=0,minY=Infinity,maxY=-Infinity,maxRadius=0;
      group.traverse(object=>{if(!object.isMesh||!object.geometry?.getAttribute('position'))return;
        const geometry=object.geometry,position=geometry.getAttribute('position');meshNames.push(object.name);
        triangles+=(geometry.index?.count??position.count)/3;vertices+=position.count;
        if(!geometries.has(geometry)){geometries.add(geometry);for(const attribute of Object.values(geometry.attributes))bytes+=attribute.array.byteLength;
          if(geometry.index)bytes+=geometry.index.array.byteLength;}
        for(const material of Array.isArray(object.material)?object.material:[object.material]){materials.add(material);
          for(const value of Object.values(material))if(value?.isTexture)textures.add(value);}
        for(let index=0;index<position.count;index++){point.fromBufferAttribute(position,index).applyMatrix4(object.matrixWorld);
          minY=Math.min(minY,point.y);maxY=Math.max(maxY,point.y);maxRadius=Math.max(maxRadius,Math.hypot(point.x,point.z));}
      });
      return{uuid:group.uuid,meshNames:meshNames.sort(),
        meshCount:meshNames.length,geometryCount:geometries.size,materialCount:materials.size,textureCount:textures.size,
        vertices,triangles,geometryBytes:bytes,bounds:{minY,maxY,maxRadius}};
    }
    let original=null;
    window.__standInspection={scenes,remember:()=>{original=current()},
      sample(){const root=current();if(!root)return null;const stands=[],backgrounds=[],surfaces=[];
        root.scene.traverse(object=>{if(object.name.startsWith('included-globe-stand:'))stands.push(object);
          if(object.name.startsWith('included-globe-background:'))backgrounds.push(object);
          if(object.isMesh&&object.geometry?.type==='SphereGeometry'&&object.geometry.parameters.radius===1
            &&object.material?.isMeshPhysicalMaterial&&object.material.map?.isCanvasTexture)surfaces.push(object)});
        const surface=surfaces[0],map=surface?.material.map,gpu=map?root.renderer.properties.get(map):null;
        return{selection:{editionId:document.querySelector('#atlas .literary-globe')?.getAttribute('data-globe-edition'),
          standId:stands[0]?.userData.standId??'canonical',backgroundId:backgrounds[0]?.userData.backgroundId??'background.base.site-starfield'},
          quality:document.querySelector('#atlas .literary-globe')?.getAttribute('data-globe-quality-tier'),
          stand:standMetrics(stands[0]),backgroundResource:backgrounds[0]?.uuid??null,
          standCount:stands.length,backgroundCount:backgrounds.length,surfaceCount:surfaces.length,
          sameScene:!!original&&root.canvas===original.canvas&&root.renderer===original.renderer&&root.camera===original.camera&&root.scene===original.scene,
          pose:pose(root),url:location.href,texture:map?.uuid,geometry:surface?.geometry.uuid,
          uploaded:!!gpu?.__webglTexture&&gpu.__version===map?.version,frame:root.renderer.info.render.frame,
          gpu:{calls:root.renderer.info.render.calls,triangles:root.renderer.info.render.triangles,textures:root.renderer.info.memory.textures,geometries:root.renderer.info.memory.geometries},
          contextLost:root.renderer.getContext().isContextLost(),inspectionPhase:document.querySelector('#atlas .literary-globe')?.getAttribute('data-planet-stand-inspection')};
      },
      async renderSample(){const root=current();if(!root)throw Error('No mounted globe renderer');
        for(let i=0;i<2;i++){root.invalidate();await new Promise(requestAnimationFrame)}return window.__standInspection.sample();},
    };
    createAndroidPlatformAdapter({bindings,channel:'dev'}).then(mountHostApp).catch(error=>{window.__standInspectionError=error.message});
  ` }, bundle: true, write: false, metafile: true, outdir: output, entryNames: 'stand-inspection', assetNames: 'assets/[name]-[hash]',
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
  const required = ['src/App.tsx', 'src/host/mountHostApp.tsx', 'src/components/LiteraryGlobe.tsx', 'src/components/GlobeCameraRig.tsx',
    'src/components/globeAtlas.ts', 'src/components/GlobeIncludedStand.tsx', 'src/components/globeStandGeometry.ts',
    'src/components/globeBookCloudStandGeometry.ts', 'src/components/globeCraftMaterials.ts',
    'src/components/globeStandInspection.ts', 'src/host/planetStandInspection.ts',
    'src/components/globeCeramicPortraitStandGeometry.ts', 'src/components/globeWhaleStandGeometry.ts', 'src/components/LiteraryWorldMap.tsx', 'src/planet/globeStands.ts',
    'src/planet/baseEditionPolicy.ts', 'src/host/PlanetStandControls.tsx', 'src/host/planetComposition.ts', 'src/planet/globeComposition.ts',
    'src/components/useGlobeCompositionScene.ts', 'src/components/useGlobeCompositionFrame.ts', 'src/components/GlobeIncludedBackground.tsx',
    'src/components/globeBackgroundGeometry.ts', 'src/components/globeLibraryGeometry.ts', 'src/components/globeWriterStudyGeometry.ts'];
  for (const filename of required) expect(inputs).toContain(filename);
  const sourcePaths = [...new Set([...required, ...inputs.filter(value => value.startsWith('src/') && !value.includes('?')), 'tests/pwa/stand-inspection.spec.mjs'])].sort();
  const sourceInputs = await Promise.all(sourcePaths.map(async filename => ({ path: filename, sha256: digest(await fs.readFile(path.join(ROOT, filename))) })));
  files = new Map(built.outputFiles.map(file => ['/fixture/' + path.relative(output, file.path).replaceAll('\\', '/'), Buffer.from(file.contents)]));
  const selectionBytes = await fs.readFile(path.join(ROOT, 'scripts/mobile/native-base-assets.json'));
  selectedAssets = new Map(JSON.parse(selectionBytes).files.map(entry => {
    if (entry.source !== 'public/' + entry.output || entry.transformation !== 'none' || /(?:^|\/)\.\.(?:\/|$)|\\/u.test(entry.output)) throw Error('Invalid selected native asset');
    return ['/' + entry.output, entry];
  }));
  sourceEvidence = { kind: 'canonical-app-stand-inspection-in-Chrome', actualApp: true, actualCss: true, actualGlobe: true,
    controlledPorts: ['native OS plugins and preferences backed by a Node map'], sourceInputs,
    cameraAuthority: 'Actual product Inspect/Return controls and native pointer gestures; no fixture camera assignments.',
    publicAssetSelectionSha256: digest(selectionBytes), selectedAssetCount: selectedAssets.size,
    builtFiles: built.outputFiles.map(file => ({ path: path.relative(output, file.path).replaceAll('\\', '/'), sha256: digest(file.contents) })),
    installedNative: false, deviceTested: false, childReviewed: false, artAccepted: false, devicePerformanceAccepted: false, releaseReady: false };
});

async function open(testInfo) {
  const profileRoot = path.resolve(process.env.S13_BROWSER_PROFILE_ROOT ?? path.join(ROOT, '.tmp/s13-stand-inspection'));
  await fs.mkdir(profileRoot, { recursive: true }); const profile = await fs.mkdtemp(path.join(profileRoot, 'inspection-'));
  const context = await chromium.launchPersistentContext(profile, { channel: 'chrome', headless: true,
    viewport: { width: 1440, height: 850 }, reducedMotion: 'reduce' });
  const page = await context.newPage(); page.setDefaultTimeout(12_000);
  const initialRecord = JSON.stringify({ schemaVersion: 1, commitId: 'stand-inspection-fixture:1', selection: BASE });
  const memory = new Map([['probpera-interface-language', 'ru'], ['probpera-planet-welcome-v1', 'completed'], [KEY, initialRecord]]);
  const operations = [], errors = [], externalRequests = [], missingResources = [];
  const result = { ...sourceEvidence, pass: false, observations: {}, screenshots: [] };
  page.on('pageerror', error => errors.push(error.message));
  await page.exposeBinding('__osPreference', (_source, operation, key, value, observed) => {
    operations.push({ operation, key, ...(value === undefined ? {} : { value }), ...(observed ? { observed } : {}) });
    if (operation === 'get') return memory.get(key) ?? null;
    if (operation === 'set') { memory.set(key, value); return; }
    if (operation === 'remove') { memory.delete(key); return; }
    throw Error('Unknown native preference fixture operation');
  });
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== SITE) { externalRequests.push(url.href); await route.abort(); return; }
    if (route.request().resourceType() === 'document' && url.pathname === '/') {
      await route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="/fixture/stand-inspection.css"></head><body><div id="root"></div><script src="/fixture/stand-inspection.js"></script></body></html>' }); return;
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
      writes: () => operations.filter(value => value.operation !== 'get' && CUSTOMIZATION_KEYS.has(value.key)),
      verify() { expect(errors).toEqual([]); expect(externalRequests).toEqual([]); expect(missingResources).toEqual([]); result.pass = true; },
      async close() {
        result.customizationWrites = operations.filter(value => value.operation !== 'get' && CUSTOMIZATION_KEYS.has(value.key));
        result.preferenceOperations = operations; result.errors = errors; result.externalRequests = externalRequests; result.missingResources = missingResources;
        const filename = testInfo.outputPath('stand-inspection.json'); await fs.writeFile(filename, JSON.stringify(result, null, 2) + '\n');
        await testInfo.attach('stand-inspection-source-evidence', { path: filename, contentType: 'application/json' }); await context.close();
      } };
  } catch (error) { await context.close(); throw error; }
}

const sample = page => page.evaluate(() => window.__standInspection.sample());
const globe = page => page.locator('#atlas .literary-globe');
const panel = page => page.locator('[data-planet-stand-panel]');
async function ready(page) {
  await expect(page.locator('.native-planet-app[data-planet-ready="true"]')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.native-planet-launch')).toBeHidden();
  await expect(globe(page)).toHaveAttribute('data-globe-webgl-context', 'ready');
  await expect(globe(page)).toHaveAttribute('data-globe-camera-phase', 'idle');
  await expect(page.locator('canvas')).toHaveCount(1);
  expect(await page.evaluate(() => window.__standInspectionError ?? null)).toBeNull();
}
async function actual(page, standId) {
  let observed;
  await expect.poll(async () => { observed = await sample(page); return observed?.uploaded ? observed.selection : null; }).toEqual(selection(standId));
  observed = await page.evaluate(() => window.__standInspection.renderSample());
  expect(observed.selection).toEqual(selection(standId)); expect(observed.uploaded).toBe(true);
  expect(observed.standCount).toBe(1); expect(observed.backgroundCount).toBe(1); expect(observed.surfaceCount).toBe(1);
  expect(observed.stand.meshCount).toBeGreaterThan(2); expect(observed.stand.triangles).toBeGreaterThan(0);
  expect(observed.contextLost).toBe(false); expect(observed.gpu.calls).toBeGreaterThan(0);
  expect(observed.gpu.triangles).toBeGreaterThan(0); expect(observed.gpu.textures).toBeGreaterThan(0);
  return observed;
}
async function stablePose(page) {
  let previous, matches = 0;
  await expect.poll(async () => { const key = JSON.stringify((await sample(page)).pose);
    matches = key === previous ? matches + 1 : 0; previous = key; return matches;
  }, { intervals: [80, 150, 250] }).toBeGreaterThanOrEqual(3);
}
function retained(current, original, restorePose = false) {
  expect(current.sameScene).toBe(true); expect(current.texture).toBe(original.texture);
  expect(current.geometry).toBe(original.geometry); expect(current.backgroundResource).toBe(original.backgroundResource);
  expect(current.url).toBe(original.url);
  if (restorePose) expect(current.pose).toEqual(original.pose);
}
async function preview(page, standId) {
  await page.locator('[data-planet-stand-select]').selectOption(standId);
  await expect(panel(page)).toHaveAttribute('data-planet-stand-phase', 'preview');
  await expect(page.locator('[data-planet-stand-apply]')).toBeEnabled();
  return actual(page, standId);
}
async function inspected(page, standId) {
  await expect(globe(page)).toHaveAttribute('data-planet-stand-inspection', 'active');
  await expect(globe(page)).toHaveAttribute('data-globe-camera-phase', 'idle');
  await stablePose(page); const observed = await actual(page, standId);
  expect(observed.inspectionPhase).toBe('active'); return observed;
}
async function capture(fixture, testInfo, filename) {
  const bytes = await fixture.page.screenshot({ path: testInfo.outputPath(filename) });
  fixture.result.screenshots.push({ filename, sha256: digest(bytes), ...fixture.page.viewportSize(), framing: 'actual-product-stand-inspection' });
}

test('product stand inspection orbits and changes models without losing the original globe view', async ({}, testInfo) => {
  test.setTimeout(120_000);
  const fixture = await open(testInfo), { page, result } = fixture;
  try {
    await actual(page, BASE.standId); await expect(globe(page)).toHaveAttribute('data-planet-composition-phase', 'idle');
    await page.evaluate(() => window.__standInspection.remember()); await stablePose(page);
    const baseline = await actual(page, BASE.standId); result.observations.baseline = baseline;
    expect(fixture.writes()).toEqual([]);
    await page.locator('[data-planet-stand-toggle]').click(); await expect(panel(page)).toBeVisible();
    const draft = await preview(page, HEAD); retained(draft, baseline, true); result.observations.draft = draft;
    const inspect = page.locator('[data-planet-stand-inspect]');
    await expect(inspect).toHaveAccessibleName('Рассмотреть подставку'); await expect(inspect).toBeEnabled(); await inspect.click();
    const head = await inspected(page, HEAD); retained(head, baseline);
    expect(head.pose).not.toEqual(baseline.pose); expect(head.pose.target).not.toEqual(baseline.pose.target);
    expect(head.pose.zoom).toBeGreaterThan(baseline.pose.zoom);
    await expect(page.locator('[data-planet-stand-inspection-return]')).toHaveAccessibleName('Вернуться к глобусу');
    await expect(page.locator('[data-planet-stand-select]')).toBeVisible();
    await expect(page.locator('[data-planet-stand-cancel]')).toBeVisible();
    result.observations.head = head; await capture(fixture, testInfo, 'stand-inspection-pushkin-ru-1440.png');

    // Use an unobscured real Canvas point between the compact editor and archive.
    const canvas = await page.locator('#atlas canvas').boundingBox();
    const editor = await panel(page).boundingBox();
    const x = Math.max(canvas.x + 430, editor.x + editor.width + 45), y = canvas.y + canvas.height * .52;
    expect(x + 85).toBeLessThan(canvas.x + canvas.width - 470);
    expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, { x, y })).toBe('CANVAS');
    await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 85, y - 24, { steps: 14 });
    await page.mouse.up(); await page.mouse.move(12, 12);
    const orbited = await inspected(page, HEAD); retained(orbited, baseline);
    expect(orbited.pose.position).not.toEqual(head.pose.position); expect(orbited.pose.target).toEqual(head.pose.target);
    expect(orbited.pose.zoom).toBe(head.pose.zoom);
    await globe(page).focus(); await page.keyboard.press('Enter');
    retained(await actual(page, HEAD), baseline); await expect(globe(page)).toHaveAttribute('data-globe-keyboard-candidate', 'inactive');
    result.observations.orbited = orbited;

    await page.locator('[data-globe-control="zoom-in"]').click();
    await expect.poll(async () => (await sample(page)).pose.zoom).toBeGreaterThan(orbited.pose.zoom);
    const zoomed = await inspected(page, HEAD); retained(zoomed, baseline);
    expect(zoomed.pose.position).toEqual(orbited.pose.position); expect(zoomed.pose.target).toEqual(orbited.pose.target);
    await page.locator('[data-globe-control="zoom-out"]').click();
    await expect.poll(async () => (await sample(page)).pose.zoom).toBeLessThan(zoomed.pose.zoom);
    await inspected(page, HEAD); result.observations.zoomed = zoomed;

    await preview(page, WHALES); const whales = await inspected(page, WHALES); retained(whales, baseline);
    expect(whales.pose.target).not.toEqual(baseline.pose.target);
    result.observations.whales = whales; await capture(fixture, testInfo, 'stand-inspection-whales-ru-1440.png');
    await page.locator('.native-planet-app .interface-language-control button').filter({ hasText: /^EN$/u }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await page.setViewportSize({ width: 390, height: 844 });
    const narrow = await inspected(page, WHALES); retained(narrow, baseline);
    const returnButton = page.locator('[data-planet-stand-inspection-return]');
    await expect(returnButton).toHaveAccessibleName('Return to globe'); await expect(returnButton).toBeVisible();
    const buttonBounds = await returnButton.boundingBox();
    expect(buttonBounds.x).toBeGreaterThanOrEqual(0); expect(buttonBounds.x + buttonBounds.width).toBeLessThanOrEqual(390);
    expect(buttonBounds.y).toBeGreaterThanOrEqual(0); expect(buttonBounds.y + buttonBounds.height).toBeLessThanOrEqual(844);
    expect(buttonBounds.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    result.observations.narrow = narrow; await capture(fixture, testInfo, 'stand-inspection-whales-en-390.png');
    expect(fixture.writes()).toEqual([]);

    await returnButton.focus(); await page.keyboard.press('Escape');
    await expect(globe(page)).toHaveAttribute('data-planet-stand-inspection', 'closed');
    await expect(panel(page)).toBeVisible(); await stablePose(page);
    const returned = await actual(page, WHALES); retained(returned, baseline, true);
    result.observations.returned = returned;
    await page.setViewportSize({ width: 1440, height: 850 }); await stablePose(page);
    await expect(inspect).toHaveAccessibleName('Inspect stand'); await inspect.click();
    await inspected(page, WHALES); await preview(page, CLOUD);
    const cloud = await inspected(page, CLOUD); retained(cloud, baseline); result.observations.cloud = cloud;
    await page.locator('[data-planet-stand-cancel]').click();
    await expect(panel(page)).toBeHidden(); await expect(globe(page)).toHaveAttribute('data-planet-stand-inspection', 'closed');
    await stablePose(page); const cancelled = await actual(page, BASE.standId); retained(cancelled, baseline, true);
    expect(cancelled.stand.uuid).toBe(baseline.stand.uuid); result.observations.cancelled = cancelled;
    expect(fixture.writes()).toEqual([]); expect(fixture.memory.get(KEY)).toBe(fixture.initialRecord);
    await expect(page.locator('canvas')).toHaveCount(1);
    Object.assign(result, { productCameraControlsOnly: true, sameSceneAndSelection: true, orbitAccepted: true,
      opticalZoomControlsAccepted: true, modelSwitchPreservesReturnView: true, escapeReturnsWithoutClosingEditor: true,
      cancelRestoresAppliedView: true, localeAndViewportRetainInspection: true, inspectionDoesNotPersist: true }); fixture.verify();
  } finally { await fixture.close(); }
});
