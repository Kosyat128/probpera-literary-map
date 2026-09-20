import { test, expect, chromium } from '@playwright/test';
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SITE = 'https://planetka-visual-mode.test';
const KEY = 'probpera-planet-composition-v1';
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
  const output = path.join(ROOT, '.tmp/planetka-visual-mode-memory');
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
        set:async({key,value})=>{await window.__osPreference('set',key,value,window.__planetkaVisual.sample?.()??null)},
        remove:async({key})=>{await window.__osPreference('remove',key)}},
      browser:{open:async()=>{throw Error('External browser unavailable in this source fixture')}},appLauncher:{openUrl:async()=>({completed:false})}};
    const scenes=()=>[..._roots.entries()].map(([canvas,root])=>{const s=root.store.getState();
      return{canvas,renderer:s.gl,camera:s.camera,scene:s.scene,controls:s.controls,invalidate:s.invalidate}});
    const current=()=>scenes().find(value=>document.querySelector('#atlas')?.contains(value.canvas));
    const rounded=array=>array.map(n=>Number(n.toFixed(5)));
    const pose=root=>({position:rounded(root.camera.position.toArray()),quaternion:rounded(root.camera.quaternion.toArray()),
      zoom:root.camera.zoom,fov:root.camera.fov,target:root.controls?rounded(root.controls.target.toArray()):null});
    let original=null;
    window.__planetkaVisual={scenes,remember:()=>{original=current()},
      setVisible(value){active=value;for(const handle of handles)if(!handle.removed&&handle.event==='appStateChange')handle.listener({isActive:value});},
      sample(){const root=current();if(!root)return null;const stands=[],backgrounds=[],surfaces=[],mascotObjects=[];
        root.scene.traverse(object=>{if(object.name==='globe-planetka'||object.name.startsWith('planetka-'))mascotObjects.push(object.name);if(object.name.startsWith('included-globe-stand:'))stands.push(object);
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
        for(let i=0;i<2;i++){root.invalidate();await new Promise(requestAnimationFrame)}return window.__planetkaVisual.sample();},
    };
    createAndroidPlatformAdapter({bindings,channel:'dev'}).then(mountHostApp).catch(error=>{window.__planetkaVisualError=error.message});
  ` }, bundle: true, write: false, metafile: true, outdir: output, entryNames: 'planetka-visual-mode', assetNames: 'assets/[name]-[hash]',
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
    'src/books/bookArchiveAuthorRequest.ts', 'src/components/BookArchiveSection.tsx', 'src/loading/DeferredHomepageArchives.tsx', ASSET];
  for (const filename of required) expect(inputs).toContain(filename);
  const sourcePaths = [...new Set([...required, ...inputs.filter(value => value.startsWith('src/') && !value.includes('?')), 'tests/pwa/planetka-visual-mode.spec.mjs'])].sort();
  const sourceInputs = await Promise.all(sourcePaths.map(async filename => ({ path: filename, sha256: digest(await fs.readFile(path.join(ROOT, filename))) })));
  files = new Map(built.outputFiles.map(file => ['/fixture/' + path.relative(output, file.path).replaceAll('\\', '/'), Buffer.from(file.contents)]));
  const selectionBytes = await fs.readFile(path.join(ROOT, 'scripts/mobile/native-base-assets.json'));
  selectedAssets = new Map(JSON.parse(selectionBytes).files.map(entry => {
    if (entry.source !== 'public/' + entry.output || entry.transformation !== 'none' || /(?:^|\/)\.\.(?:\/|$)|\\/u.test(entry.output)) throw Error('Invalid selected native asset');
    return ['/' + entry.output, entry];
  }));
  sourceEvidence = { kind: 'canonical-app-independent-knizhulyk-dom-companion-in-Chrome', actualApp: true, actualCss: true, actualGlobe: true,
    controlledPorts: ['native OS plugins and preferences backed by a Node map'], sourceInputs,
    cameraAuthority: 'Companion show/hide/tour steps do not own the camera. Only existing canonical App navigation owns scene changes; no fixture camera assignments.',
    representation: '3D-rendered PNG bitmap in a decorative DOM image; not live mascot geometry or a globe-character conversion',
    artwork: { path: ASSET, sha256: ASSET_SHA, bytes: assetBytes.length, width: 1254, height: 1254, pngColorType: 6,
      bundledPath: '/fixture/' + path.relative(output, assetOutput.path).replaceAll('\\', '/') },
    publicAssetSelectionSha256: digest(selectionBytes), selectedAssetCount: selectedAssets.size,
    builtFiles: built.outputFiles.map(file => ({ path: path.relative(output, file.path).replaceAll('\\', '/'), sha256: digest(file.contents) })),
    installedNative: false, deviceTested: false, childReviewed: false, childProfileCreated: false, childAccessGranted: false, reviewedDialogueAccepted: false, narrationEnabled: false, artAccepted: false, devicePerformanceAccepted: false, releaseReady: false };
});

async function open(testInfo) {
  const profileRoot = path.resolve(process.env.S15_BROWSER_PROFILE_ROOT ?? path.join(ROOT, '.tmp/s15-planetka-visual'));
  await fs.mkdir(profileRoot, { recursive: true }); const profile = await fs.mkdtemp(path.join(profileRoot, 'pk-'));
  const context = await chromium.launchPersistentContext(profile, { channel: 'chrome', headless: true,
    viewport: { width: 1440, height: 850 }, reducedMotion: 'reduce' });
  const page = await context.newPage(); page.setDefaultTimeout(12_000);
  const initialRecord = JSON.stringify({ schemaVersion: 1, commitId: 'planetka-visual-mode-fixture:1', selection: BASE });
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
      await route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="/fixture/planetka-visual-mode.css"></head><body><div id="root"></div><script src="/fixture/planetka-visual-mode.js"></script></body></html>' }); return;
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
        result.unexpectedPreferenceWrites = operations.filter(value => value.operation !== 'get' && !['probpera-interface-language', 'probpera-planet-recent-adult-v1'].includes(value.key));
        result.preferenceOperations = operations; result.errors = errors; result.externalRequests = externalRequests; result.missingResources = missingResources;
        const filename = testInfo.outputPath('planetka-visual-mode.json'); await fs.writeFile(filename, JSON.stringify(result, null, 2) + '\n');
        await testInfo.attach('planetka-visual-mode-source-evidence', { path: filename, contentType: 'application/json' }); await context.close();
      } };
  } catch (error) { await context.close(); throw error; }
}

const sample = page => page.evaluate(() => window.__planetkaVisual.sample());
const globe = page => page.locator('#atlas .literary-globe');
const pet = page => page.locator('[data-planet-mascot-pet]');
const panel = page => page.locator('[data-planet-mascot-panel]');
async function ready(page) {
  await expect(page.locator('.native-planet-app[data-planet-ready="true"]')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.native-planet-launch')).toBeHidden();
  await expect(globe(page)).toHaveAttribute('data-globe-webgl-context', 'ready');
  await expect(globe(page)).toHaveAttribute('data-globe-camera-phase', 'idle');
  await expect(page.locator('#atlas canvas')).toHaveCount(1);
  expect(await page.evaluate(() => window.__planetkaVisualError ?? null)).toBeNull();
}
async function actual(page) {
  let observed;
  await expect.poll(async () => { observed = await sample(page); return observed?.uploaded ? observed.selection : null; }).toEqual(BASE);
  observed = await page.evaluate(() => window.__planetkaVisual.renderSample());
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
async function petSample(page) {
  return page.evaluate(() => {
    const root = document.querySelector('[data-planet-mascot-pet]'), image = root?.querySelector('img'), card = root?.querySelector('[data-planet-mascot-panel]');
    const rect = element => { if (!element) return null; const r = element.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
    return { viewport: { width: innerWidth, height: innerHeight }, rect: rect(root), card: rect(card),
      visibility: root?.getAttribute('data-planet-mascot-visibility'), mode: root?.getAttribute('data-planet-mascot-mode'),
      route: root?.getAttribute('data-planet-mascot-current-route'), step: Number(root?.getAttribute('data-planet-mascot-step')),
      screen: root?.getAttribute('data-planet-mascot-screen'),
      mood: root?.querySelector('[data-planet-mascot-avatar]')?.getAttribute('data-planet-mascot-avatar'),
      completion: root?.querySelector('[data-planet-mascot-completion]')?.getAttribute('data-planet-mascot-completion') ?? null,
      contextTip: root?.querySelector('[data-planet-mascot-context-tip]')?.textContent ?? null,
      stepStatus: root?.querySelector('[data-planet-mascot-step-status]')?.getAttribute('data-planet-mascot-step-status') ?? null,
      image: image ? { rect: rect(image), currentSrc: image.currentSrc, complete: image.complete, naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight, alt: image.alt, decorative: image.closest('[aria-hidden="true"]') !== null,
        objectFit: getComputedStyle(image).objectFit, transform: getComputedStyle(image).transform } : null,
      highlights: [...document.querySelectorAll('[data-planet-mascot-highlight]')].map(element => ({ target: element.getAttribute('data-planet-mascot-highlight'), rect: rect(element) })),
      overflow: document.documentElement.scrollWidth > innerWidth + 1 };
  });
}
function inside(rect, viewport) {
  expect(rect).not.toBeNull(); expect(Object.values(rect).every(Number.isFinite)).toBe(true);
  expect(rect.width).toBeGreaterThan(0); expect(rect.height).toBeGreaterThan(0);
  expect(rect.left).toBeGreaterThanOrEqual(-.5); expect(rect.top).toBeGreaterThanOrEqual(-.5);
  expect(rect.right).toBeLessThanOrEqual(viewport.width + .5); expect(rect.bottom).toBeLessThanOrEqual(viewport.height + .5);
}
async function shown(page) {
  await expect(pet(page)).toHaveAttribute('data-planet-mascot-visibility', 'shown');
  await expect(panel(page)).toBeVisible();
  let observed;
  // setViewportSize completes before React's resize/ResizeObserver state has
  // necessarily committed. Wait for real layout, keeping the same bounds.
  await expect.poll(async () => {
    observed = await petSample(page);
    const view = page.viewportSize();
    const fits = rect => Boolean(rect && Object.values(rect).every(Number.isFinite)
      && rect.width > 0 && rect.height > 0 && rect.left >= -.5 && rect.top >= -.5
      && rect.right <= view.width + .5 && rect.bottom <= view.height + .5);
    const image = observed.image?.rect, card = observed.card;
    return { viewportApplied: observed.viewport.width === view.width && observed.viewport.height === view.height,
      decoded: observed.image?.naturalWidth === 1254, pet: fits(observed.rect), card: fits(card), image: fits(image),
      separate: Boolean(image && card && (image.right <= card.left || image.left >= card.right
        || image.bottom <= card.top || image.top >= card.bottom)), overflow: observed.overflow };
  }, { message: 'Companion, card and whole image settle inside the current viewport without overlap' })
    .toEqual({ viewportApplied: true, decoded: true, pet: true, card: true, image: true, separate: true, overflow: false });
  inside(observed.rect, observed.viewport); inside(observed.card, observed.viewport); inside(observed.image.rect, observed.viewport);
  expect(observed.image.naturalHeight).toBe(1254); expect(observed.image.complete).toBe(true); expect(observed.image.decorative).toBe(true);
  expect(observed.image.alt).toBe(''); expect(observed.image.objectFit).toBe('contain'); expect(observed.image.transform).toBe('none');
  expect(new URL(observed.image.currentSrc).pathname).toBe(sourceEvidence.artwork.bundledPath);
  expect(observed.overflow).toBe(false); expect(observed.image.rect.width).toBeCloseTo(observed.image.rect.height, 1);
  // The whole imported square is painted with contain, so transparent margins
  // and the already-inspected hands/feet remain inside the displayed image.
  expect(observed.image.rect.right <= observed.card.left || observed.image.rect.left >= observed.card.right
    || observed.image.rect.bottom <= observed.card.top || observed.image.rect.top >= observed.card.bottom).toBe(true);
  return observed;
}
async function step(page, route, index) {
  await expect(pet(page)).toHaveAttribute('data-planet-mascot-mode', 'tour');
  await expect(pet(page)).toHaveAttribute('data-planet-mascot-current-route', route);
  await expect(pet(page)).toHaveAttribute('data-planet-mascot-step', String(index));
}
async function actualHighlight(page, target, selector) {
  const outline = page.locator('[data-planet-mascot-highlight="' + target + '"]'); await expect(outline).toBeVisible();
  const underlying = page.locator(selector).first(); await expect(underlying).toBeVisible();
  const measured = await page.evaluate(({ target, selector }) => {
    const el = document.querySelector(selector), outline = document.querySelector('[data-planet-mascot-highlight="' + target + '"]');
    const a = el.getBoundingClientRect(), b = outline.getBoundingClientRect();
    return { target, selector, targetRect: { left:a.left,top:a.top,right:a.right,bottom:a.bottom,width:a.width,height:a.height },
      highlightRect: {left:b.left,top:b.top,right:b.right,bottom:b.bottom,width:b.width,height:b.height},
      decorationOnly:getComputedStyle(outline).pointerEvents==='none' && outline.getAttribute('aria-hidden')==='true' };
  }, { target, selector });
  expect(measured.decorationOnly).toBe(true);
  // Compare the actual visible control, not a synthetic tooltip token.
  for (const edge of ['left', 'top', 'right', 'bottom']) expect(Math.abs(measured.targetRect[edge] - measured.highlightRect[edge])).toBeLessThanOrEqual(1);
  return measured;
}
async function capture(fixture, testInfo, filename) {
  const bytes = await fixture.page.screenshot({ path: testInfo.outputPath(filename) });
  fixture.result.screenshots.push({ filename, sha256: digest(bytes), ...fixture.page.viewportSize(), framing: 'actual-app-independent-dom-companion' });
}

test('independent Mr. Booky companion guides canonical navigation without changing the globe', async ({}, testInfo) => {
  test.setTimeout(120_000); const fixture = await open(testInfo), { page, result } = fixture;
  try {
    await actual(page); await page.evaluate(() => window.__planetkaVisual.remember()); await stablePose(page);
    const baseline = await actual(page); result.observations.baseline = baseline;
    await expect(pet(page)).toHaveAttribute('data-planet-mascot-visibility', 'hidden');
    await expect(page.locator('[data-planet-mascot-avatar]')).toHaveCount(0);
    const toggle = page.locator('[data-planet-mascot-toggle]'); await expect(toggle).toHaveAccessibleName('Показать: Книжулик');
    await toggle.click(); const desktop = await shown(page); retained(await actual(page), baseline);
    await expect(panel(page).getByRole('heading', { name:'Книжулик', exact:true })).toBeVisible();
    await expect(page.locator('[data-planet-mascot-context-tip="writer"]')).toContainText('Писатель выбран');
    await expect(panel(page).locator('.planet-mascot-controls__context')).toContainText('Достоевск');
    await expect(page.locator('[data-planet-mascot-completion]')).toHaveCount(0);
    result.observations.desktop = { pet:desktop, globe:await actual(page) }; await capture(fixture, testInfo, 'mr-booky-help-ru-1440.png');
    const move = page.locator('[data-planet-mascot-move]'); await move.focus(); await page.keyboard.press('ArrowLeft');
    await expect.poll(async () => (await petSample(page)).rect.left).toBeLessThan(desktop.rect.left);
    retained(await actual(page), baseline); await page.keyboard.press('Home');
    await page.locator('[data-planet-mascot-route="overview"]').click(); await step(page,'overview',0);
    result.observations.searchHint = await actualHighlight(page,'search','.atlas-immersive-chrome [data-atlas-action="toggle-search"]');
    await page.locator('[data-planet-mascot-next]').click(); await step(page,'overview',1); retained(await actual(page), baseline);
    await page.locator('[data-planet-mascot-back]').click(); await step(page,'overview',0);
    await expect(page.locator('[data-planet-mascot-step-status="ready"]')).toBeVisible();
    await page.locator('[data-planet-mascot-finish]').click();
    await expect(pet(page)).toHaveAttribute('data-planet-mascot-mode','help');
    await expect(page.locator('[data-planet-mascot-completion]')).toHaveCount(0);
    await page.locator('[data-planet-mascot-route="overview"]').click(); await step(page,'overview',0);
    await page.locator('[data-planet-mascot-collapse]').click(); await expect(panel(page)).toHaveCount(0);
    await expect(page.locator('[data-planet-mascot-highlight]')).toHaveCount(0);
    await toggle.click(); await step(page,'overview',0); retained(await actual(page), baseline);
    await page.locator('.native-planet-app .interface-language-control button').filter({hasText:/^EN$/u}).click();
    await expect(page.locator('html')).toHaveAttribute('lang','en'); await page.setViewportSize({width:320,height:844});
    await step(page,'overview',0); await expect(panel(page).getByRole('heading',{name:'Mr. Booky',exact:true})).toBeVisible();
    await expect(panel(page)).toContainText('Find something to read');
    const narrow = await shown(page); await stablePose(page); const narrowGlobe = await actual(page);
    retained(narrowGlobe,baseline,false); result.observations.narrow={pet:narrow,globe:narrowGlobe};
    result.observations.narrowHint=await actualHighlight(page,'search','.atlas-immersive-chrome [data-atlas-action="toggle-search"]');
    await capture(fixture,testInfo,'mr-booky-tour-en-320.png');
    await page.locator('[data-planet-mascot-hide]').click(); await expect(pet(page)).toHaveAttribute('data-planet-mascot-visibility','hidden');
    await expect(page.locator('[data-planet-mascot-highlight]')).toHaveCount(0); retained(await actual(page),narrowGlobe);
    await toggle.click(); await shown(page); await expect(pet(page)).toHaveAttribute('data-planet-mascot-mode','help');
    await expect(pet(page)).toHaveAttribute('data-planet-mascot-current-route','none');
    await page.setViewportSize({width:1440,height:850}); await stablePose(page);
    await expect(page.locator('[data-planet-mascot-context-tip="writer"]')).toContainText('A writer is selected');
    await expect(panel(page).locator('.planet-mascot-controls__context')).toContainText('Dostoevsky');
    const beforeAppearance=await actual(page);
    await page.locator('[data-planet-mascot-action="appearance"]').click();
    await expect(page.locator('[data-planet-stand-panel]')).toBeVisible();
    await expect(page.locator('[data-planet-stand-select]')).toBeFocused();
    await expect(page.locator('[data-planet-stand-select]')).toHaveValue('canonical');
    await page.locator('[data-planet-stand-cancel]').click();
    await expect(page.locator('[data-planet-stand-panel]')).toHaveCount(0);
    const appearance=await actual(page); retained(appearance,beforeAppearance);
    expect(fixture.writes()).toEqual([]); result.observations.appearance=appearance;
    await page.locator('[data-planet-mascot-route="country-to-book"]').click(); await step(page,'country-to-book',0);
    await page.locator('[data-planet-mascot-action="country"]').click();
    await expect(page.locator('.atlas-country-presentation')).toBeVisible();
    await expect(page.locator('[data-planet-mascot-next]')).toBeEnabled(); await page.locator('[data-planet-mascot-next]').click();
    await step(page,'country-to-book',1); await page.locator('[data-planet-mascot-action="writer"]').click();
    // Collapse the nonmodal tips to interact with the actual underlying writer
    // archive. Reopening must retain this semantic step after real selection.
    await page.locator('[data-planet-mascot-collapse]').click();
    const writer = page.locator('.atlas-country-presentation .writer-list button[aria-pressed="false"]').filter({ hasText: /Leo Tolstoy/u });
    await expect(writer).toHaveCount(1); await expect(writer).toBeVisible();
    const writerLabel = await writer.getAttribute('aria-label'), writerName=(await writer.locator('.writer-copy strong').innerText()).trim(); await writer.click();
    await expect.poll(() => new URL(page.url()).searchParams.get('writer')).toBe('tolstoy');
    await toggle.click(); await step(page,'country-to-book',1); await expect(panel(page)).toContainText('Choose a writer');
    await expect(panel(page).locator('.planet-mascot-controls__context')).toContainText(writerName);
    await expect(page.locator('[data-planet-mascot-next]')).toBeEnabled();
    const selectedWriter = new URL(page.url()).searchParams.get('writer'); expect(selectedWriter).toBeTruthy();
    result.observations.writerSelected={writerLabel,writerId:selectedWriter,globe:await actual(page)};
    await page.locator('[data-planet-mascot-next]').click(); await step(page,'country-to-book',2);
    await expect(page.locator('[data-planet-mascot-next]')).toBeDisabled();
    await expect(page.locator('[data-planet-mascot-step-status="waiting"]')).toBeVisible();
    await expect(page.locator('[data-planet-mascot-completion]')).toHaveCount(0);
    await page.locator('[data-planet-mascot-action="books"]').click();
    const collection=page.getByRole('dialog',{name:'Collection',exact:true}); await expect(collection).toBeVisible();
    await expect(pet(page)).toHaveAttribute('data-planet-mascot-screen','collection'); await step(page,'country-to-book',2);
    await expect(collection.locator('[data-planet-mascot-pet]')).toHaveCount(1); await expect(page.locator('[data-planet-mascot-pet]')).toHaveCount(1);
    await expect(page.locator('[data-planet-mascot-author-books-status="applied"]')).toBeVisible();
    await expect(page.locator('[data-planet-mascot-next]')).toBeEnabled();
    await collection.getByRole('button',{name:'Advanced filters',exact:true}).click();
    const authorFilter=page.locator('[data-book-author-filter]'); await expect(authorFilter).toBeVisible();
    await expect(authorFilter).toHaveValue('russia:tolstoy');
    const selectedAuthorLabel=await authorFilter.locator('option:checked').innerText(); expect(selectedAuthorLabel).toContain(writerName);
    // A previously acknowledged request is insufficient once the reader changes
    // the real filter. Completion follows the currently committed author view.
    await authorFilter.selectOption(''); await expect(page.locator('[data-planet-mascot-next]')).toBeDisabled();
    await authorFilter.selectOption('russia:tolstoy'); await expect(page.locator('[data-planet-mascot-next]')).toBeEnabled();
    const actualBooks=collection.locator('.archive-book-detail[data-book-key^="russia:tolstoy:"]');
    await expect.poll(()=>actualBooks.count()).toBeGreaterThan(0);
    result.observations.authorFilter={authorKey:await authorFilter.inputValue(),selectedAuthorLabel,writerName,
      bookKeys:await actualBooks.evaluateAll(elements=>elements.map(element=>element.getAttribute('data-book-key')))};
    await page.locator('#book-archive-advanced-filters .book-shelf-filter-drawer__header button').click();
    await expect(authorFilter).toHaveCount(0);
    await page.setViewportSize({width:844,height:390}); const collectionPet=await shown(page);
    result.observations.collection={pet:collectionPet,writerId:selectedWriter,globe:await sample(page)};
    await capture(fixture,testInfo,'mr-booky-collection-en-landscape.png');
    await page.locator('[data-planet-mascot-next]').click(); await expect(pet(page)).toHaveAttribute('data-planet-mascot-mode','help');
    const completion=page.locator('[data-planet-mascot-completion="country-to-book"]');
    await expect(completion).toBeVisible(); await expect(completion).toContainText('tour is complete');
    await expect(page.locator('[data-planet-mascot-avatar]')).toHaveAttribute('data-planet-mascot-avatar','celebrate');
    result.observations.completion={text:await completion.innerText(),pet:await petSample(page)};
    await expect(page.locator('[data-planet-mascot-highlight]')).toHaveCount(0);
    await page.locator('[data-planet-mascot-action="return-globe"]').focus(); await page.keyboard.press('Tab');
    await expect(collection.locator('.interface-language-control button').first()).toBeFocused();
    await collection.getByRole('button',{name:'Return to the planet',exact:true}).focus(); await page.keyboard.press('Escape');
    await expect(panel(page)).toHaveCount(0); await expect(collection).toBeVisible();
    await toggle.click(); await shown(page);
    await page.locator('[data-planet-mascot-action="search"]').click();
    await expect(collection).toBeHidden(); await expect(page.locator('#country-search')).toBeFocused();
    result.observations.searchReturned={focusedId:await page.evaluate(()=>document.activeElement?.id),globe:await sample(page)};
    await page.locator('[data-atlas-action="toggle-search"]').click();
    await page.locator('[data-planet-mascot-action="books"]').click(); await expect(collection).toBeVisible();
    await page.locator('[data-planet-mascot-action="return-globe"]').click();
    await expect(collection).toBeHidden(); await expect(pet(page)).toHaveAttribute('data-planet-mascot-screen','globe'); await ready(page);
    await stablePose(page); const returned=await actual(page); retained(returned,baseline,false,false);
    expect(new URL(returned.url).searchParams.get('writer')).toBe(selectedWriter); result.observations.returned=returned;
    await page.locator('[data-planet-mascot-route="overview"]').click(); await step(page,'overview',0);
    await page.locator('[data-planet-mascot-next]').click(); await step(page,'overview',1);
    await page.evaluate(()=>window.__planetkaVisual.setVisible(false)); await expect(pet(page)).toHaveCount(0);
    await page.evaluate(()=>window.__planetkaVisual.setVisible(true)); await ready(page);
    await expect(pet(page)).toHaveAttribute('data-planet-mascot-visibility','shown'); await step(page,'overview',1);
    await expect(panel(page)).toHaveCount(0);
    await expect(page.locator('[data-planet-mascot-highlight]')).toHaveCount(0);
    await toggle.click(); await step(page,'overview',1); const resumed=await actual(page); retained(resumed,returned);
    result.observations.resumed={pet:await shown(page),globe:resumed};
    await page.locator('[data-planet-mascot-hide]').click(); await expect(pet(page)).toHaveAttribute('data-planet-mascot-visibility','hidden');
    await expect(pet(page)).toHaveAttribute('data-planet-mascot-current-route','none');
    expect(fixture.writes()).toEqual([]); expect(fixture.memory.get(KEY)).toBe(fixture.initialRecord);
    expect(fixture.operations.filter(value=>value.operation!=='get'&&!['probpera-interface-language','probpera-planet-recent-adult-v1'].includes(value.key))).toEqual([]);
    await expect(page.locator('#atlas canvas')).toHaveCount(1);
    Object.assign(result,{independentDomCompanion:true,actualPngDecoded:true,wholeImageFits:true,noGlobeCharacterMeshes:true,
      showHideDoesNotMoveCamera:true,stepsDoNotOwnCamera:true,sameSceneAndAtlas:true,semanticTourSurvivesLocale:true,
      nextBackHighlightActualControls:true,hideCancelsTour:true,canonicalWriterAndBooksNavigation:true,canonicalAuthorFilterApplied:true,
      honestRouteCompletion:true,manualAuthorFilterFencesCompletion:true,appearanceUsesCanonicalControls:true,collectionKeyboardPriority:true,collectionSearchFocusRestored:true,
      visibilitySuspendsWithoutPopup:true,noAppearanceOrProfileWrites:true});fixture.verify();
  } finally {await fixture.close();}
});
