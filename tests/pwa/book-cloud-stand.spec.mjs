import { test, expect, chromium } from '@playwright/test';
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SITE = 'https://book-cloud-stand.test';
const KEY = 'probpera-planet-composition-v1', CLOUD = 'stand.base.child-book-cloud';
const LIBRARY = 'background.base.library', STUDY = 'background.base.writer-study';
const BASE = { editionId: 'rand-mcnally-1887', standId: 'stand.base.wood', backgroundId: LIBRARY };
const COMBINED = { ...BASE, standId: CLOUD, backgroundId: STUDY };
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const mime = { '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.geojson': 'application/geo+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.woff': 'font/woff', '.woff2': 'font/woff2' };
let files, selectedAssets, sourceEvidence;

// Actual native source App and its single R3F scene. Only native OS bindings and
// preferences are controlled. The close inspection temporarily aims the SAME
// mounted camera, then restores it; it is not an available product zoom mode.
test.beforeAll(async () => {
  test.setTimeout(120_000);
  const output = path.join(ROOT, '.tmp/book-cloud-stand-memory');
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
        set:async({key,value})=>{await window.__osPreference('set',key,value,window.__bookCloud.sample?.()??null)},
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
      const meshNames=[],landmarks=[];let triangles=0,vertices=0,bytes=0,minY=Infinity,maxY=-Infinity,maxRadius=0;
      group.traverse(object=>{if(!object.isMesh||!object.geometry?.getAttribute('position'))return;
        const geometry=object.geometry,position=geometry.getAttribute('position');meshNames.push(object.name);
        triangles+=(geometry.index?.count??position.count)/3;vertices+=position.count;
        if(!geometries.has(geometry)){geometries.add(geometry);for(const attribute of Object.values(geometry.attributes))bytes+=attribute.array.byteLength;
          if(geometry.index)bytes+=geometry.index.array.byteLength;}
        for(const material of Array.isArray(object.material)?object.material:[object.material]){materials.add(material);
          for(const value of Object.values(material))if(value?.isTexture)textures.add(value);}
        for(let index=0;index<position.count;index++){point.fromBufferAttribute(position,index).applyMatrix4(object.matrixWorld);
          minY=Math.min(minY,point.y);maxY=Math.max(maxY,point.y);maxRadius=Math.max(maxRadius,Math.hypot(point.x,point.z));}
        if(['book-cloud-sculpted-cloud','book-cloud-rounded-covers','book-cloud-page-blocks'].includes(object.name))
          landmarks.push({name:object.name,matrix:rounded(object.matrixWorld.toArray())});
      });
      return{uuid:group.uuid,meshNames:meshNames.sort(),landmarks:landmarks.sort((a,b)=>a.name.localeCompare(b.name)),
        meshCount:meshNames.length,geometryCount:geometries.size,materialCount:materials.size,textureCount:textures.size,
        vertices,triangles,geometryBytes:bytes,bounds:{minY,maxY,maxRadius}};
    }
    let original=null,inspection=null;
    window.__bookCloud={scenes,remember:()=>{original=current()},
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
          contextLost:root.renderer.getContext().isContextLost(),inspectionView:!!inspection};
      },
      async renderSample(){const root=current();if(!root)throw Error('No mounted globe renderer');
        for(let i=0;i<2;i++){root.invalidate();await new Promise(requestAnimationFrame)}return window.__bookCloud.sample();},
      async closeView(){const root=current(),stand=root?.scene.getObjectByName('included-globe-stand:stand.base.child-book-cloud');
        if(!root||!stand||inspection)throw Error('No current cloud stand for close inspection');
        const camera=root.camera,controls=root.controls,centre=new Box3().setFromObject(stand).getCenter(new Vector3());
        inspection={root,position:camera.position.clone(),quaternion:camera.quaternion.clone(),up:camera.up.clone(),
          zoom:camera.zoom,fov:camera.fov,target:controls?.target.clone(),enabled:controls?.enabled,autoRotate:controls?.autoRotate};
        if(controls){controls.enabled=false;controls.autoRotate=false;}
        camera.position.copy(centre).add(new Vector3(1.05,.43,1.7));camera.up.set(0,1,0);camera.zoom=1;camera.fov=35;
        camera.lookAt(centre);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
        for(let i=0;i<3;i++){root.invalidate();await new Promise(requestAnimationFrame)}
      },
      async restoreView(){const saved=inspection;if(!saved)return;inspection=null;const {root}=saved,camera=root.camera;
        camera.position.copy(saved.position);camera.quaternion.copy(saved.quaternion);camera.up.copy(saved.up);camera.zoom=saved.zoom;camera.fov=saved.fov;
        camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
        if(root.controls){root.controls.target.copy(saved.target);root.controls.enabled=saved.enabled;root.controls.autoRotate=saved.autoRotate;}
        for(let i=0;i<3;i++){root.invalidate();await new Promise(requestAnimationFrame)}
      }};
    createAndroidPlatformAdapter({bindings,channel:'dev'}).then(mountHostApp).catch(error=>{window.__bookCloudError=error.message});
  ` }, bundle: true, write: false, metafile: true, outdir: output, entryNames: 'book-cloud', assetNames: 'assets/[name]-[hash]',
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
    'src/components/globeBookCloudStandGeometry.ts', 'src/components/globeCraftMaterials.ts', 'src/planet/globeStands.ts',
    'src/planet/baseEditionPolicy.ts', 'src/host/PlanetStandControls.tsx', 'src/host/planetComposition.ts', 'src/planet/globeComposition.ts',
    'src/components/useGlobeCompositionScene.ts', 'src/components/useGlobeCompositionFrame.ts', 'src/components/GlobeIncludedBackground.tsx',
    'src/components/globeBackgroundGeometry.ts', 'src/components/globeLibraryGeometry.ts', 'src/components/globeWriterStudyGeometry.ts'];
  for (const filename of required) expect(inputs).toContain(filename);
  const sourcePaths = [...new Set([...required, ...inputs.filter(value => value.startsWith('src/') && !value.includes('?')), 'tests/pwa/book-cloud-stand.spec.mjs'])].sort();
  const sourceInputs = await Promise.all(sourcePaths.map(async filename => ({ path: filename, sha256: digest(await fs.readFile(path.join(ROOT, filename))) })));
  files = new Map(built.outputFiles.map(file => ['/fixture/' + path.relative(output, file.path).replaceAll('\\', '/'), Buffer.from(file.contents)]));
  const selectionBytes = await fs.readFile(path.join(ROOT, 'scripts/mobile/native-base-assets.json'));
  selectedAssets = new Map(JSON.parse(selectionBytes).files.map(entry => {
    if (entry.source !== 'public/' + entry.output || entry.transformation !== 'none' || /(?:^|\/)\.\.(?:\/|$)|\\/u.test(entry.output)) throw Error('Invalid selected native asset');
    return ['/' + entry.output, entry];
  }));
  sourceEvidence = { kind: 'canonical-app-book-cloud-stand-in-Chrome', actualApp: true, actualCss: true, actualGlobe: true,
    controlledPorts: ['native OS plugins and preferences backed by a Node map'], sourceInputs,
    closeView: 'Temporary inspection framing using the same mounted camera/renderer; restored afterwards. Not a product navigation feature.',
    publicAssetSelectionSha256: digest(selectionBytes), selectedAssetCount: selectedAssets.size,
    builtFiles: built.outputFiles.map(file => ({ path: path.relative(output, file.path).replaceAll('\\', '/'), sha256: digest(file.contents) })),
    installedNative: false, deviceTested: false, childReviewed: false, artAccepted: false, devicePerformanceAccepted: false, releaseReady: false };
});

async function open(testInfo) {
  const profileRoot = path.resolve(process.env.S13_BROWSER_PROFILE_ROOT ?? path.join(ROOT, '.tmp/s13-book-cloud'));
  await fs.mkdir(profileRoot, { recursive: true }); const profile = await fs.mkdtemp(path.join(profileRoot, 'cloud-'));
  const context = await chromium.launchPersistentContext(profile, { channel: 'chrome', headless: true,
    viewport: { width: 1440, height: 850 }, reducedMotion: 'reduce' });
  const page = await context.newPage(); page.setDefaultTimeout(12_000);
  const initialRecord = JSON.stringify({ schemaVersion: 1, commitId: 'book-cloud-fixture:1', selection: BASE });
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
      await route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="/fixture/book-cloud.css"></head><body><div id="root"></div><script src="/fixture/book-cloud.js"></script></body></html>' }); return;
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
      writes: () => operations.filter(value => value.operation === 'set' && value.key === KEY),
      verify() { expect(errors).toEqual([]); expect(externalRequests).toEqual([]); expect(missingResources).toEqual([]); result.pass = true; },
      async close() {
        await page.evaluate(() => window.__bookCloud.restoreView()).catch(() => undefined);
        result.preferenceOperations = operations; result.errors = errors; result.externalRequests = externalRequests; result.missingResources = missingResources;
        const filename = testInfo.outputPath('book-cloud-stand.json'); await fs.writeFile(filename, JSON.stringify(result, null, 2) + '\n');
        await testInfo.attach('book-cloud-stand-source-evidence', { path: filename, contentType: 'application/json' }); await context.close();
      } };
  } catch (error) { await context.close(); throw error; }
}

const sample = page => page.evaluate(() => window.__bookCloud.sample());
const globe = page => page.locator('#atlas .literary-globe');
async function ready(page) {
  await expect(page.locator('.native-planet-app[data-planet-ready="true"]')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.native-planet-launch')).toBeHidden();
  await expect(globe(page)).toHaveAttribute('data-globe-webgl-context', 'ready');
  await expect(globe(page)).toHaveAttribute('data-globe-camera-phase', 'idle'); await expect(page.locator('canvas')).toHaveCount(1);
  expect(await page.evaluate(() => window.__bookCloudError ?? null)).toBeNull();
}
async function actual(page, selection) {
  let observed;
  await expect.poll(async () => { observed = await sample(page); return observed?.uploaded ? observed.selection : null; }).toEqual(selection);
  observed = await page.evaluate(() => window.__bookCloud.renderSample());
  expect(observed.selection).toEqual(selection); expect(observed.uploaded).toBe(true);
  expect(observed.surfaceCount).toBe(1); expect(observed.standCount).toBe(1); expect(observed.backgroundCount).toBe(1);
  expect(observed.geometry).toEqual(expect.any(String));
  expect(observed.gpu.calls).toBeGreaterThan(0); expect(observed.gpu.triangles).toBeGreaterThan(0); expect(observed.gpu.textures).toBeGreaterThan(0);
  expect(observed.contextLost).toBe(false); expect(observed.frame).toBeGreaterThan(0); return observed;
}
async function stablePose(page) {
  let previous, pose, matches = 0;
  await expect.poll(async () => { pose = (await sample(page)).pose; const key = JSON.stringify(pose);
    matches = key === previous ? matches + 1 : 0; previous = key; return matches;
  }, { intervals: [80, 150, 250] }).toBeGreaterThanOrEqual(3); return pose;
}
function retained(current, original, pose = original.pose, preserveGeometry = true) {
  expect(current.sameScene).toBe(true); expect(current.texture).toBe(original.texture);
  if (preserveGeometry) expect(current.geometry).toBe(original.geometry);
  expect(current.pose).toEqual(pose); expect(current.url).toBe(original.url);
}
async function show(page, part) {
  const toggle = page.locator('[data-planet-stand-toggle]'); if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
  const panel = page.locator(`[data-planet-${part}-panel]`);
  if (!await panel.isVisible()) await page.locator(`[data-planet-customization-tab="${part}"]`).click();
  await expect(panel).toBeVisible(); return panel;
}
async function preview(page, part, id) {
  const panel = await show(page, part); await panel.locator(`[data-planet-${part}-select]`).selectOption(id);
  await expect(panel).toHaveAttribute(`data-planet-${part}-phase`, 'preview');
  await expect(panel.locator(`[data-planet-${part}-apply]`)).toBeEnabled(); return panel;
}
async function quality(page, tier) {
  await page.locator('[data-atlas-action="open-collection"]').click(); const panel = page.locator('.native-planet-panel');
  await expect(panel).toBeVisible(); const settings = panel.locator('[data-planet-graphics-settings]');
  if (await settings.getAttribute('open') === null) await settings.locator('summary').click();
  await settings.locator(`[data-planet-quality-option="${tier}"]`).check();
  await expect(settings.locator('[data-planet-quality-save-state]')).toHaveAttribute('data-planet-quality-save-state', 'idle');
  await panel.getByRole('button', { name: /^(Вернуться к планете|Return to the planet)$/u }).click(); await expect(panel).toBeHidden();
  await expect(globe(page)).toHaveAttribute('data-globe-quality-tier', tier);
  await expect(globe(page)).toHaveAttribute('data-planet-composition-phase', 'idle'); await stablePose(page); return actual(page, COMBINED);
}
async function overview(page) {
  const zoomOut = page.locator('[data-globe-control="zoom-out"]');
  for (let step = 0; step < 6; step++) {
    // Wait for the previous camera command and its disabled-state publication.
    // Testing enabled while the last dolly is still moving races the limit.
    await expect(globe(page)).toHaveAttribute("data-globe-camera-phase", "idle");
    await stablePose(page);
    if (!await zoomOut.isEnabled()) break;
    const before = Math.hypot(...(await sample(page)).pose.position);
    await zoomOut.click();
    await expect.poll(async () => Math.hypot(...(await sample(page)).pose.position)).toBeGreaterThan(before + .02);
  }
  await expect(zoomOut).toBeDisabled(); await stablePose(page);
  // A genuine pointer gesture lowers the initially steep country-focus angle.
  // Reading the current OrbitControls scale determines the drag distance only;
  // no camera or controls state is written for these product-view screenshots.
  const orbit = await page.evaluate(() => {
    const root = window.__bookCloud.scenes().find(value => document.querySelector('#atlas')?.contains(value.canvas));
    return { polar: root.controls.getPolarAngle(), speed: root.controls.rotateSpeed, height: root.canvas.clientHeight };
  });
  const canvas = await page.locator('#atlas canvas').boundingBox();
  const x = canvas.x + Math.min(450, canvas.width * .32), y = canvas.y + canvas.height * .70;
  const deltaY = (orbit.polar - 1.50) * orbit.height / (2 * Math.PI * orbit.speed);
  expect(y + deltaY).toBeGreaterThan(canvas.y + 150);
  expect(y + deltaY).toBeLessThan(canvas.y + canvas.height - 150);
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x, y + deltaY, { steps: 18 }); await page.mouse.up(); await page.mouse.move(12, 12);
  await expect(globe(page)).toHaveAttribute('data-globe-camera-phase', 'idle'); await stablePose(page);
  const observed = await actual(page, COMBINED), offset = observed.pose.position.map((value, index) => value - observed.pose.target[index]);
  expect(Math.abs(offset[1]) / Math.hypot(...offset)).toBeLessThan(.15);
  return observed;
}
function cloudGeometry(observed) {
  expect(observed.stand.meshCount).toBeGreaterThan(2); expect(observed.stand.triangles).toBeGreaterThan(0);
  expect(observed.stand.landmarks.map(value => value.name)).toEqual(['book-cloud-page-blocks', 'book-cloud-rounded-covers', 'book-cloud-sculpted-cloud']);
  expect(observed.stand.bounds.minY).toBeGreaterThanOrEqual(-1.4401); expect(observed.stand.bounds.maxY).toBeLessThanOrEqual(-1.0299);
  expect(observed.stand.bounds.maxRadius).toBeLessThanOrEqual(.5501);
}
async function capture(fixture, testInfo, filename, framing = 'product-view') {
  const bytes = await fixture.page.screenshot({ path: testInfo.outputPath(filename) });
  fixture.result.screenshots.push({ filename, sha256: digest(bytes), ...fixture.page.viewportSize(), framing });
}

test('book cloud joins the existing composition and retains its full shape across quality tiers', async ({}, testInfo) => {
  test.setTimeout(120_000);
  const fixture = await open(testInfo), { page, result } = fixture;
  try {
    await actual(page, BASE); await expect(globe(page)).toHaveAttribute('data-planet-composition-phase', 'idle');
    await page.evaluate(() => window.__bookCloud.remember()); await stablePose(page);
    const baseline = await actual(page, BASE); result.observations.baseline = baseline;
    expect(fixture.writes()).toEqual([]);
    await preview(page, 'stand', CLOUD); await preview(page, 'background', STUDY);
    await expect(page.locator('[data-planet-composition-summary]')).toHaveText('Подставка: Книга на облаке · Фон: Кабинет писателя');
    const draft = await actual(page, COMBINED); retained(draft, baseline); cloudGeometry(draft);
    const revision = await globe(page).getAttribute('data-planet-composition-revision');
    await show(page, 'stand'); await expect(page.locator('[data-planet-stand-select]')).toHaveValue(CLOUD);
    await show(page, 'background'); await expect(page.locator('[data-planet-background-select]')).toHaveValue(STUDY);
    await expect(globe(page)).toHaveAttribute('data-planet-composition-revision', revision);
    expect((await sample(page)).stand.uuid).toBe(draft.stand.uuid); expect(fixture.writes()).toEqual([]);
    await page.locator('[data-planet-background-cancel]').click();
    const cancelled = await actual(page, BASE); retained(cancelled, baseline);
    expect(cancelled.stand.uuid).toBe(baseline.stand.uuid); expect(cancelled.backgroundResource).toBe(baseline.backgroundResource);
    expect(fixture.memory.get(KEY)).toBe(fixture.initialRecord);
    Object.assign(result.observations, { draft, cancelled });

    await preview(page, 'stand', CLOUD); await preview(page, 'background', STUDY);
    await page.locator('.native-planet-app .interface-language-control button').filter({ hasText: /^EN$/u }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('[data-planet-background-panel]')).toHaveAttribute('data-planet-background-phase', 'preview');
    await expect(page.locator('[data-planet-composition-summary]')).toHaveText("Stand: Book on a cloud · Background: Writer's study");
    await page.setViewportSize({ width: 390, height: 844 }); await stablePose(page);
    const narrow = await actual(page, COMBINED); retained(narrow, baseline, narrow.pose); cloudGeometry(narrow);
    const panelBounds = await page.locator('[data-planet-background-panel]').boundingBox();
    expect(panelBounds.x).toBeGreaterThanOrEqual(0); expect(panelBounds.x + panelBounds.width).toBeLessThanOrEqual(390);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(fixture.writes()).toEqual([]); await capture(fixture, testInfo, 'book-cloud-combined-preview-en-390.png');
    result.observations.narrow = narrow;
    await page.setViewportSize({ width: 1440, height: 850 });
    await page.locator('.native-planet-app .interface-language-control button').filter({ hasText: /^RU$/u }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
    await expect(page.locator('[data-planet-background-panel]')).toHaveAttribute('data-planet-background-phase', 'preview');
    await stablePose(page); await page.locator('[data-planet-background-apply]').click();
    await expect.poll(() => fixture.writes().length).toBe(1);
    expect(JSON.parse(fixture.memory.get(KEY)).selection).toEqual(COMBINED);
    expect(fixture.writes()[0].observed.selection).toEqual(COMBINED); expect(fixture.writes()[0].observed.uploaded).toBe(true);
    await page.locator('[data-planet-background-cancel]').click(); await stablePose(page);
    const focusedApplied = await actual(page, COMBINED); retained(focusedApplied, baseline); cloudGeometry(focusedApplied);
    const high = await overview(page); retained(high, baseline, high.pose); cloudGeometry(high); expect(high.quality).toBe('high');
    expect(high.pose).not.toEqual(focusedApplied.pose);
    Object.assign(result.observations, { combinedApplied: focusedApplied, focusedApplied, high });
    await capture(fixture, testInfo, 'book-cloud-high-ru-1440.png');

    try {
      await page.evaluate(() => window.__bookCloud.closeView());
      const close = await actual(page, COMBINED); expect(close.sameScene).toBe(true); expect(close.inspectionView).toBe(true);
      expect(close.texture).toBe(high.texture); expect(close.stand.uuid).toBe(high.stand.uuid); expect(close.url).toBe(high.url);
      expect(close.pose).not.toEqual(high.pose); expect(close.frame).toBeGreaterThan(high.frame);
      await capture(fixture, testInfo, 'book-cloud-high-inspection-close.png', 'same-mounted-camera-inspection');
      result.observations.highClose = close;
    } finally { await page.evaluate(() => window.__bookCloud.restoreView()); }
    await stablePose(page); const restored = await actual(page, COMBINED); retained(restored, high);
    result.observations.restoredAfterClose = restored;
    for (const tier of ['balanced', 'economy']) {
      // Surface tessellation intentionally changes with the quality profile.
      const observed = await quality(page, tier); retained(observed, high, high.pose, false); cloudGeometry(observed);
      expect(observed.stand.landmarks).toEqual(high.stand.landmarks);
      expect(Math.abs(observed.stand.bounds.minY - high.stand.bounds.minY)).toBeLessThan(.004);
      expect(Math.abs(observed.stand.bounds.maxY - high.stand.bounds.maxY)).toBeLessThan(.004);
      expect(Math.abs(observed.stand.bounds.maxRadius - high.stand.bounds.maxRadius)).toBeLessThan(.004);
      expect(observed.stand.triangles).toBeLessThan(high.stand.triangles);
      result.observations[tier] = observed; await capture(fixture, testInfo, `book-cloud-${tier}-ru-1440.png`);
    }
    expect(fixture.writes()).toHaveLength(1); expect(JSON.parse(fixture.memory.get(KEY)).selection).toEqual(COMBINED);
    await expect(page.locator('canvas')).toHaveCount(1);
    Object.assign(result, { sameSceneAcrossDraftAndQuality: true, combinedCancelRestoresAppliedResources: true,
      oneCombinedApply: true, sameCameraInspectionRestored: true, overviewCameraChangedByUserControls: true, qualityLayoutPreserved: true }); fixture.verify();
  } finally { await fixture.close(); }
});
