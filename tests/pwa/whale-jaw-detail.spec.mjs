import { test, expect, chromium } from '@playwright/test';
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SITE = 'https://whale-jaw-detail.test';
const KEY = 'probpera-planet-composition-v1';
const WHALES = 'stand.base.three-whales';
const BASE = { editionId: 'rand-mcnally-1887', standId: WHALES, backgroundId: 'background.base.library' };
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
  const output = path.join(ROOT, '.tmp/whale-jaw-detail-memory');
  const built = await build({ absWorkingDir: ROOT, stdin: { resolveDir: ROOT, loader: 'ts', contents: `
    import{_roots}from'@react-three/fiber';import{Box3,Vector3}from'three';
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
    function jawMetrics(group,root){
      if(!group)return null;
      const jaws=[],gems=[],geometries=new Set();
      const rectangle=root.canvas.getBoundingClientRect();
      group.traverse(object=>{
        if(object.name.startsWith('whale-inset-emerald-')&&object.isMesh)gems.push(object.uuid);
        if(object.name!=='whale-cast-lower-jaw'||!object.isMesh)return;
        const positions=object.geometry.getAttribute('position');geometries.add(object.geometry.uuid);
        object.geometry.computeBoundingBox();const local=object.geometry.boundingBox;
        const box=new Box3().setFromObject(object),center=box.getCenter(new Vector3()),projected=center.clone().project(root.camera);
        const corners=[];for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])
          corners.push(new Vector3(x,y,z).project(root.camera));
        const minX=Math.min(...corners.map(point=>point.x)),maxX=Math.max(...corners.map(point=>point.x));
        const minY=Math.min(...corners.map(point=>point.y)),maxY=Math.max(...corners.map(point=>point.y));
        jaws.push({uuid:object.uuid,parent:object.parent.name,geometry:object.geometry.uuid,vertices:positions.count,
          triangles:(object.geometry.index?.count??positions.count)/3,material:object.material.type,
          localBounds:{min:local.min.toArray(),max:local.max.toArray()},worldCenter:center.toArray(),projectedCenter:projected.toArray(),
          projectedPixels:{width:(maxX-minX)*rectangle.width/2,height:(maxY-minY)*rectangle.height/2},
          screenCenter:{x:rectangle.x+(projected.x+1)*rectangle.width/2,y:rectangle.y+(1-projected.y)*rectangle.height/2}});
      });
      const offset=root.camera.position.clone().sub(root.controls.target);
      return{jaws,gems,sharedGeometryCount:geometries.size,
        view:{azimuth:Math.atan2(offset.x,offset.z),elevation:Math.atan2(offset.y,Math.hypot(offset.x,offset.z))}};
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
          stand:standMetrics(stands[0]),jawDetail:jawMetrics(stands[0],root),backgroundResource:backgrounds[0]?.uuid??null,
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
  ` }, bundle: true, write: false, metafile: true, outdir: output, entryNames: 'whale-jaw-detail', assetNames: 'assets/[name]-[hash]',
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
    'src/components/globeCeramicPortraitStandGeometry.ts', 'src/components/globeWhaleStandGeometry.ts', 'src/components/globeCraftMaterials.ts', 'src/components/LiteraryWorldMap.tsx', 'src/planet/globeStands.ts',
    'src/planet/baseEditionPolicy.ts', 'src/host/PlanetStandControls.tsx', 'src/host/planetComposition.ts', 'src/planet/globeComposition.ts',
    'src/components/useGlobeCompositionScene.ts', 'src/components/useGlobeCompositionFrame.ts', 'src/components/GlobeIncludedBackground.tsx',
    'src/components/globeBackgroundGeometry.ts', 'src/components/globeLibraryGeometry.ts', 'src/components/globeWriterStudyGeometry.ts'];
  for (const filename of required) expect(inputs).toContain(filename);
  const sourcePaths = [...required, 'src/components/globeAntiqueGeometry.ts', 'tests/pwa/whale-jaw-detail.spec.mjs'].sort();
  const sourceInputs = await Promise.all(sourcePaths.map(async filename => ({ path: filename, sha256: digest(await fs.readFile(path.join(ROOT, filename))) })));
  files = new Map(built.outputFiles.map(file => ['/fixture/' + path.relative(output, file.path).replaceAll('\\', '/'), Buffer.from(file.contents)]));
  const selectionBytes = await fs.readFile(path.join(ROOT, 'scripts/mobile/native-base-assets.json'));
  selectedAssets = new Map(JSON.parse(selectionBytes).files.map(entry => {
    if (entry.source !== 'public/' + entry.output || entry.transformation !== 'none' || /(?:^|\/)\.\.(?:\/|$)|\\/u.test(entry.output)) throw Error('Invalid selected native asset');
    return ['/' + entry.output, entry];
  }));
  sourceEvidence = { kind: 'canonical-app-whale-jaw-detail-in-Chrome', actualApp: true, actualCss: true, actualGlobe: true,
    controlledPorts: ['native OS plugins and preferences backed by a Node map'], sourceInputs,
    cameraAuthority: 'Actual product Inspect/Return controls and native pointer gestures; no fixture camera assignments.',
    publicAssetSelectionSha256: digest(selectionBytes), selectedAssetCount: selectedAssets.size,
    builtFiles: built.outputFiles.map(file => ({ path: path.relative(output, file.path).replaceAll('\\', '/'), sha256: digest(file.contents) })),
    installedNative: false, deviceTested: false, childReviewed: false, artAccepted: false, devicePerformanceAccepted: false, releaseReady: false };
});

async function open(testInfo) {
  const profileRoot = path.resolve(process.env.S13_BROWSER_PROFILE_ROOT ?? path.join(ROOT, '.tmp/s13-whale-jaw'));
  await fs.mkdir(profileRoot, { recursive: true }); const profile = await fs.mkdtemp(path.join(profileRoot, 'jaw-'));
  const context = await chromium.launchPersistentContext(profile, { channel: 'chrome', headless: true,
    viewport: { width: 1440, height: 850 }, reducedMotion: 'reduce' });
  const page = await context.newPage(); page.setDefaultTimeout(12_000);
  const initialRecord = JSON.stringify({ schemaVersion: 1, commitId: 'whale-jaw-fixture:1', selection: BASE });
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
      await route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="/fixture/whale-jaw-detail.css"></head><body><div id="root"></div><script src="/fixture/whale-jaw-detail.js"></script></body></html>' }); return;
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
        const filename = testInfo.outputPath('whale-jaw-detail.json'); await fs.writeFile(filename, JSON.stringify(result, null, 2) + '\n');
        await testInfo.attach('whale-jaw-detail-source-evidence', { path: filename, contentType: 'application/json' }); await context.close();
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
async function inspected(page, standId) {
  await expect(globe(page)).toHaveAttribute('data-planet-stand-inspection', 'active');
  await expect(globe(page)).toHaveAttribute('data-globe-camera-phase', 'idle');
  await stablePose(page); const observed = await actual(page, standId);
  expect(observed.inspectionPhase).toBe('active'); return observed;
}
async function capture(fixture, testInfo, filename) {
  const bytes = await fixture.page.screenshot({ path: testInfo.outputPath(filename) });
  fixture.result.screenshots.push({ filename, sha256: digest(bytes), ...fixture.page.viewportSize(), framing: 'actual product Inspect stand, optical zoom buttons and keyboard orbit; no camera assignments' });
}

function assertPhysicalJaws(observed) {
  const detail = observed.jawDetail;
  expect(detail.jaws).toHaveLength(3); expect(detail.gems).toHaveLength(6);
  expect(detail.sharedGeometryCount).toBe(1);
  expect(observed.stand.meshCount).toBeLessThanOrEqual(42);
  expect(detail.jaws.map(jaw => jaw.parent).sort()).toEqual([
    'canonical-gold-whale-1', 'canonical-gold-whale-2', 'canonical-gold-whale-3',
  ]);
  for (const jaw of detail.jaws) {
    expect(jaw.triangles).toBeGreaterThan(100); expect(jaw.vertices).toBeGreaterThan(50);
    expect(['MeshStandardMaterial', 'MeshPhysicalMaterial']).toContain(jaw.material);
    for (let axis = 0; axis < 3; axis++) {
      expect(Number.isFinite(jaw.localBounds.min[axis]) && Number.isFinite(jaw.localBounds.max[axis])).toBe(true);
      expect(jaw.localBounds.max[axis] - jaw.localBounds.min[axis]).toBeGreaterThan(.005);
    }
  }
}
async function assertJawFraming(page, observed) {
  const jaw = observed.jawDetail.jaws.find(value => value.parent === 'canonical-gold-whale-1');
  expect(jaw.projectedCenter[0]).toBeGreaterThan(-.92); expect(jaw.projectedCenter[0]).toBeLessThan(.92);
  expect(jaw.projectedCenter[1]).toBeGreaterThan(-.92); expect(jaw.projectedCenter[1]).toBeLessThan(.92);
  expect(jaw.projectedCenter[2]).toBeGreaterThan(-1); expect(jaw.projectedCenter[2]).toBeLessThan(1);
  expect(jaw.projectedPixels.width).toBeGreaterThan(45); expect(jaw.projectedPixels.height).toBeGreaterThan(15);
  expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, jaw.screenCenter)).toBe('CANVAS');
}
async function orbit(page, key, count) {
  await globe(page).focus();
  for (let index = 0; index < count; index++) {
    await globe(page).press(key);
    await expect(globe(page)).toHaveAttribute('data-globe-camera-phase', 'idle');
    await stablePose(page);
  }
  return inspected(page, WHALES);
}

test('physical whale jaw detail is visible through product stand inspection and returns the original view', async ({}, testInfo) => {
  test.setTimeout(120_000);
  const fixture = await open(testInfo), { page, result } = fixture;
  try {
    await actual(page, WHALES);
    await expect(globe(page)).toHaveAttribute('data-planet-composition-phase', 'idle');
    await page.evaluate(() => window.__standInspection.remember()); await stablePose(page);
    const baseline = await actual(page, WHALES); assertPhysicalJaws(baseline);
    expect(baseline.quality).toBe('high'); expect(baseline.url).toContain('country=russia');
    expect(baseline.url).toContain('writer=dostoevsky'); expect(fixture.writes()).toEqual([]);
    result.observations.baseline = baseline;

    await page.locator('[data-planet-stand-toggle]').click(); await expect(panel(page)).toBeVisible();
    const inspect = page.locator('[data-planet-stand-inspect]');
    await expect(inspect).toHaveAccessibleName('Рассмотреть подставку'); await expect(inspect).toBeEnabled();
    await inspect.click();
    const fitted = await inspected(page, WHALES); retained(fitted, baseline); assertPhysicalJaws(fitted);
    expect(fitted.pose).not.toEqual(baseline.pose); result.observations.inspected = fitted;

    // Only the product's optical zoom changes magnification. Inspection dolly
    // remains disabled; the position/target must stay at the fitted orbit here.
    const zoomIn = page.locator('[data-globe-control="zoom-in"]');
    for (let index = 0; index < 5; index++) {
      if (await zoomIn.isDisabled()) break;
      await zoomIn.click(); await stablePose(page);
    }
    await expect(zoomIn).toBeDisabled();
    await expect(page.locator('#globe-scale-feedback')).toContainText(/200\s*%/u);
    const zoomed = await inspected(page, WHALES);
    expect(zoomed.pose.position).toEqual(fitted.pose.position); expect(zoomed.pose.target).toEqual(fitted.pose.target);
    expect(zoomed.pose.zoom / fitted.pose.zoom).toBeCloseTo(2, 5);

    // The first whale faces local +Z. Two right-arrow steps expose its cheek;
    // three down-arrow steps move the actual camera below the sculpted jaw.
    await orbit(page, 'ArrowRight', 2);
    const threeQuarter = await orbit(page, 'ArrowDown', 3);
    retained(threeQuarter, baseline); assertPhysicalJaws(threeQuarter); await assertJawFraming(page, threeQuarter);
    expect(threeQuarter.jawDetail.view.azimuth).toBeGreaterThan(.2);
    expect(threeQuarter.jawDetail.view.elevation).toBeLessThan(-.2);
    expect(threeQuarter.pose.zoom).toBe(zoomed.pose.zoom);
    result.observations.threeQuarter = threeQuarter;
    await capture(fixture, testInfo, 'whale-jaw-three-quarter-ru-1440.png');

    await page.locator('.atlas-immersive-chrome .interface-language-control button').filter({ hasText: /^EN$/u }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(globe(page)).toHaveAttribute('data-planet-composition-phase', 'idle');
    await expect(page.locator('[data-planet-stand-inspection-return]')).toHaveAccessibleName('Return to globe');
    const localized = await inspected(page, WHALES); retained(localized, baseline);
    expect(localized.pose.position).toEqual(threeQuarter.pose.position);
    expect(localized.pose.target).toEqual(threeQuarter.pose.target);
    const underside = await orbit(page, 'ArrowDown', 2);
    retained(underside, baseline); assertPhysicalJaws(underside); await assertJawFraming(page, underside);
    expect(underside.jawDetail.view.elevation).toBeLessThan(threeQuarter.jawDetail.view.elevation - .2);
    expect(underside.jawDetail.jaws.map(jaw => jaw.uuid)).toEqual(baseline.jawDetail.jaws.map(jaw => jaw.uuid));
    result.observations.underside = underside;
    await capture(fixture, testInfo, 'whale-jaw-underside-en-1440.png');

    await page.locator('[data-planet-stand-inspection-return]').click();
    await expect(globe(page)).toHaveAttribute('data-planet-stand-inspection', 'closed');
    await expect(globe(page)).toHaveAttribute('data-globe-camera-phase', 'idle'); await stablePose(page);
    const returned = await actual(page, WHALES); retained(returned, baseline, true); assertPhysicalJaws(returned);
    expect(returned.stand.uuid).toBe(baseline.stand.uuid);
    expect(returned.jawDetail.jaws.map(jaw => jaw.uuid)).toEqual(baseline.jawDetail.jaws.map(jaw => jaw.uuid));
    expect(fixture.writes()).toEqual([]); expect(fixture.memory.get(KEY)).toBe(fixture.initialRecord);
    await expect(page.locator('canvas')).toHaveCount(1); result.observations.returned = returned;
    Object.assign(result, { productCameraControlsOnly: true, physicalJawMeshes: 3, emeraldEyes: 6,
      unchangedSceneAndSelection: true, exactOriginalPoseRestored: true, inspectionDoesNotPersist: true });
    fixture.verify();
  } finally { await fixture.close(); }
});
