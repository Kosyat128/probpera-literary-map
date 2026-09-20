import { test, expect, chromium } from '@playwright/test';
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SITE = 'https://booky-live-character.test';
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
  const output = path.join(ROOT, '.tmp/booky-live-character-memory');
  const built = await build({ absWorkingDir: ROOT, stdin: { resolveDir: ROOT, loader: 'ts', contents: `
    import{_roots}from'@react-three/fiber';
    import*as THREE from'three';
    import{mountHostApp}from'./src/host/mountHostApp';
    import{createAndroidPlatformAdapter}from'./src/platform/adapters/android/AndroidPlatformAdapter';
    const handles=[];let active=true;
    const subscribe=async(event,listener)=>{const handle={event,listener,removed:false,async remove(){handle.removed=true}};handles.push(handle);return handle};
    const bindings={core:{getPlatform:()=> 'android',isNativePlatform:()=>true,isPluginAvailable:()=>true},
      app:{getAppLanguage:async()=>({value:'ru-RU'}),getState:async()=>({isActive:active}),getLaunchUrl:async()=>undefined,addListener:subscribe},
      network:{getStatus:async()=>({connected:true,connectionType:'wifi'}),addListener:subscribe},
      preferences:{get:async({key})=>({value:await window.__osPreference('get',key)}),
        set:async({key,value})=>{await window.__osPreference('set',key,value,window.__bookyLiveFixture.sample?.()??null)},
        remove:async({key})=>{await window.__osPreference('remove',key)}},
      browser:{open:async()=>{throw Error('External browser unavailable in this source fixture')}},appLauncher:{openUrl:async()=>({completed:false})}};
    const scenes=()=>[..._roots.entries()].map(([canvas,root])=>{const s=root.store.getState();
      return{canvas,renderer:s.gl,camera:s.camera,scene:s.scene,controls:s.controls,invalidate:s.invalidate}});
    const current=()=>scenes().find(value=>document.querySelector('#atlas')?.contains(value.canvas));
    const rounded=array=>array.map(n=>Number(n.toFixed(5)));
    const pose=root=>({position:rounded(root.camera.position.toArray()),quaternion:rounded(root.camera.quaternion.toArray()),
      zoom:root.camera.zoom,fov:root.camera.fov,target:root.controls?rounded(root.controls.target.toArray()):null});
    let original=null;
    window.__bookyLiveFixture={scenes,remember:()=>{original=current()},
      booky(){
        const record=(window.__bookyRendererObservations??[]).filter(item=>!item.disposed).at(-1);
        const canvas=document.querySelector('[data-booky-canvas]');
        if(!record?.scene||!record.camera||record.renderer.domElement!==canvas)return null;
        const owner=(window.__bookyModelObservations??[]).filter(item=>!item.disposed).at(-1),model=owner?.model;
        if(!model||!record.scene.getObjectById(model.group.id))return null;
        const r=canvas.getBoundingClientRect(),rect={left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};
        const geometry=new Set(),materials=new Set(),textures=new Set(),meshes=[];
        const screen={left:Infinity,top:Infinity,right:-Infinity,bottom:-Infinity,minDepth:Infinity,maxDepth:-Infinity};
        let finite=true,triangles=0;const point=new THREE.Vector3();
        model.group.updateWorldMatrix(true,true);record.camera.updateMatrixWorld();
        model.group.traverse(object=>{if(!object.isMesh)return;
          meshes.push(object.name);geometry.add(object.geometry);
          for(const material of Array.isArray(object.material)?object.material:[object.material]){
            materials.add(material);for(const value of Object.values(material))if(value?.isTexture)textures.add(value);
          }
          const p=object.geometry.getAttribute('position');triangles+=(object.geometry.index?.count??p.count)/3;
          for(let i=0;i<p.count;i++){
            point.fromBufferAttribute(p,i).applyMatrix4(object.matrixWorld).project(record.camera);
            finite=finite&&[point.x,point.y,point.z].every(Number.isFinite);
            const x=r.left+(point.x+1)*r.width/2,y=r.top+(1-point.y)*r.height/2;
            screen.left=Math.min(screen.left,x);screen.right=Math.max(screen.right,x);
            screen.top=Math.min(screen.top,y);screen.bottom=Math.max(screen.bottom,y);
            screen.minDepth=Math.min(screen.minDepth,point.z);screen.maxDepth=Math.max(screen.maxDepth,point.z);
          }
        });
        const transform=object=>({uuid:object.uuid,position:object.position.toArray(),rotation:object.rotation.toArray().slice(0,3),scale:object.scale.toArray()});
        const rig=Object.fromEntries(Object.entries(model.rig).map(([key,value])=>[key,Array.isArray(value)?value.map(transform):transform(value)]));
        const bounds=new THREE.Box3().setFromObject(model.group),canonical=current();
        return{rendererId:record.id,canvasId:canvas.dataset.observedBookyCanvas,scene:record.scene.uuid,camera:record.camera.uuid,model:model.group.uuid,
          independentFromGlobe:!!canonical&&record.renderer!==canonical.renderer&&record.camera!==canonical.camera&&record.scene!==canonical.scene&&canvas!==canonical.canvas,
          renderedFrames:record.frames,renderCount:Number(canvas.getAttribute('data-booky-render-count')),contextLost:record.renderer.getContext().isContextLost(),
          rect,screen,finite,triangles,meshes,rig,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},
          gpu:{calls:record.renderer.info.render.calls,triangles:record.renderer.info.render.triangles,
            textures:record.renderer.info.memory.textures,geometries:record.renderer.info.memory.geometries},
          resources:{geometries:[...geometry].map(item=>item.uuid),materials:[...materials].map(item=>item.uuid),textures:[...textures].map(item=>item.uuid)}};
      },
      owners(){return{renderers:(window.__bookyRendererObservations??[]).map(item=>({id:item.id,frames:item.frames,disposed:item.disposed,disposeCalls:item.disposeCalls})),
        models:(window.__bookyModelObservations??[]).map(item=>({id:item.model.group.uuid,disposed:item.disposed,disposeCalls:item.disposeCalls}))}},
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
        for(let i=0;i<2;i++){root.invalidate();await new Promise(requestAnimationFrame)}return window.__bookyLiveFixture.sample();},
    };
    createAndroidPlatformAdapter({bindings,channel:'dev'}).then(mountHostApp).catch(error=>{window.__bookyLiveFixtureError=error.message});
  ` }, bundle: true, write: false, metafile: true, outdir: output, entryNames: 'booky-live-character', assetNames: 'assets/[name]-[hash]',
    publicPath: '/fixture/', format: 'iife', platform: 'browser', target: 'es2020', jsx: 'automatic', logLevel: 'silent',
    define: { 'process.env.NODE_ENV': '"development"', 'import.meta.env': JSON.stringify({ BASE_URL: '/', DEV: false, PROD: true,
      VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '', VITE_TURNSTILE_SITE_KEY: '' }),
      __LITERARY_PLANET_EDITION__: '"native"', __LITERARY_PLANET_LOCAL_QA__: 'false',
      __LITERARY_PLANET_LICENSE_AUTHORITY__: 'null', __YANDEX_METRIKA_COUNTER_ID__: '""' },
    loader: { '.css': 'css', '.png': 'file', '.webp': 'file', '.avif': 'file', '.jpg': 'file', '.jpeg': 'file', '.svg': 'file', '.woff': 'file', '.woff2': 'file' },
    plugins: [{ name:'observe-real-booky-ownership',setup(builder){
      builder.onResolve({filter:/^three$/},args=>args.importer.replaceAll('\\','/').endsWith('/src/host/useBookyRenderer.ts')
        ?{path:'booky-three-observer',namespace:'booky-three-observer'}:undefined);
      builder.onLoad({filter:/.*/,namespace:'booky-three-observer'},()=>({loader:'js',resolveDir:ROOT,contents:`
        export*from'three';import{WebGLRenderer as ActualRenderer}from'three';
        export class WebGLRenderer extends ActualRenderer{
          constructor(...args){super(...args);const list=window.__bookyRendererObservations??=[];
            const record={id:list.length+1,renderer:this,scene:null,camera:null,frames:0,disposed:false,disposeCalls:0};list.push(record);
            this.domElement.dataset.observedBookyCanvas=String(record.id);
            const render=this.render,dispose=this.dispose;
            this.render=(scene,camera)=>{const result=render.call(this,scene,camera);
              if(scene.getObjectByName('booky-model')){record.scene=scene;record.camera=camera;record.frames++}return result};
            this.dispose=()=>{record.disposeCalls++;record.disposed=true;return dispose.call(this)};
          }
        }` }));
      builder.onResolve({filter:/^\.\/bookyModel$/},args=>args.importer.replaceAll('\\','/').endsWith('/src/host/useBookyRenderer.ts')
        ?{path:path.resolve(ROOT,'src/host/bookyModel.ts'),namespace:'booky-model-observer'}:undefined);
      builder.onLoad({filter:/.*/,namespace:'booky-model-observer'},args=>({loader:'js',resolveDir:ROOT,contents:`
        export*from${JSON.stringify(args.path)};import{createBookyModel as create}from${JSON.stringify(args.path)};
        export function createBookyModel(...args){const model=create(...args),list=window.__bookyModelObservations??=[];
          const record={model,disposed:false,disposeCalls:0};list.push(record);
          return{...model,dispose(){record.disposeCalls++;record.disposed=true;return model.dispose()}};
        }` }));
    } }, { name: 'canonical-vite-resources', setup(builder) {
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
    'src/host/bookyModel.ts', 'src/host/bookyAnimation.ts', 'src/host/useBookyRenderer.ts', ASSET];
  for (const filename of required) expect(inputs).toContain(filename);
  const sourcePaths = [...new Set([...required, ...inputs.filter(value => value.startsWith('src/') && !value.includes('?')), 'tests/pwa/booky-live-character.spec.mjs'])].sort();
  const sourceInputs = await Promise.all(sourcePaths.map(async filename => ({ path: filename, sha256: digest(await fs.readFile(path.join(ROOT, filename))) })));
  files = new Map(built.outputFiles.map(file => ['/fixture/' + path.relative(output, file.path).replaceAll('\\', '/'), Buffer.from(file.contents)]));
  const selectionBytes = await fs.readFile(path.join(ROOT, 'scripts/mobile/native-base-assets.json'));
  selectedAssets = new Map(JSON.parse(selectionBytes).files.map(entry => {
    if (entry.source !== 'public/' + entry.output || entry.transformation !== 'none' || /(?:^|\/)\.\.(?:\/|$)|\\/u.test(entry.output)) throw Error('Invalid selected native asset');
    return ['/' + entry.output, entry];
  }));
  sourceEvidence = { kind: 'canonical-app-independent-live-booky-character-in-Chrome', actualApp: true, actualCss: true, actualGlobe: true,
    controlledPorts: ['native OS plugins and preferences backed by a Node map'], sourceInputs,
    fixtureObservers: ['Real Booky WebGLRenderer render/dispose calls and actual scene/camera references', 'Actual createBookyModel owner and disposer; original model geometry and materials unchanged'],
    cameraAuthority: 'Companion show/hide/tour steps do not own the camera. Only existing canonical App navigation owns scene changes; no fixture camera assignments.',
    representation: 'Live independent Three.js character with owned geometry; original PNG only renderer-failure fallback, canonical globe unchanged',
    fallbackArtwork: { path: ASSET, sha256: ASSET_SHA, bytes: assetBytes.length, width: 1254, height: 1254, pngColorType: 6,
      bundledPath: '/fixture/' + path.relative(output, assetOutput.path).replaceAll('\\', '/') },
    publicAssetSelectionSha256: digest(selectionBytes), selectedAssetCount: selectedAssets.size,
    builtFiles: built.outputFiles.map(file => ({ path: path.relative(output, file.path).replaceAll('\\', '/'), sha256: digest(file.contents) })),
    installedNative: false, deviceTested: false, childReviewed: false, childProfileCreated: false, childAccessGranted: false, reviewedDialogueAccepted: false, narrationEnabled: false, artAccepted: false, devicePerformanceAccepted: false, releaseReady: false };
});

async function open(testInfo) {
  const profileRoot = path.resolve(process.env.S15_BROWSER_PROFILE_ROOT ?? path.join(ROOT, '.tmp/s15-booky-live'));
  await fs.mkdir(profileRoot, { recursive: true }); const profile = await fs.mkdtemp(path.join(profileRoot, 'pk-'));
  const context = await chromium.launchPersistentContext(profile, { channel: 'chrome', headless: true,
    viewport: { width: 1440, height: 850 }, reducedMotion: 'no-preference', hasTouch: true });
  const page = await context.newPage(); page.setDefaultTimeout(12_000);
  const initialRecord = JSON.stringify({ schemaVersion: 1, commitId: 'booky-live-character-fixture:1', selection: BASE });
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
      await route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="/fixture/booky-live-character.css"></head><body><div id="root"></div><script src="/fixture/booky-live-character.js"></script></body></html>' }); return;
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
      verify() { expect(errors).toEqual([]); expect(externalRequests).toEqual([]); expect(missingResources).toEqual([]);
        expect(operations.filter(value=>value.operation!=='get'&&!['probpera-interface-language','probpera-planet-recent-adult-v1'].includes(value.key))).toEqual([]);
        result.pass = true; },
      async close() {
        result.customizationWrites = operations.filter(value => value.operation !== 'get' && CUSTOMIZATION_KEYS.has(value.key));
        result.unexpectedPreferenceWrites = operations.filter(value => value.operation !== 'get' && !['probpera-interface-language', 'probpera-planet-recent-adult-v1'].includes(value.key));
        result.preferenceOperations = operations; result.errors = errors; result.externalRequests = externalRequests; result.missingResources = missingResources;
        const filename = testInfo.outputPath('booky-live-character.json'); await fs.writeFile(filename, JSON.stringify(result, null, 2) + '\n');
        await testInfo.attach('booky-live-character-source-evidence', { path: filename, contentType: 'application/json' }); await context.close();
      } };
  } catch (error) { await context.close(); throw error; }
}
const sample = page => page.evaluate(() => window.__bookyLiveFixture.sample());
const globe = page => page.locator('#atlas .literary-globe');
const pet = page => page.locator('[data-planet-mascot-pet]');
const panel = page => page.locator('[data-planet-mascot-panel]');
async function ready(page) {
  await expect(page.locator('.native-planet-app[data-planet-ready="true"]')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.native-planet-launch')).toBeHidden();
  await expect(globe(page)).toHaveAttribute('data-globe-webgl-context', 'ready');
  await expect(globe(page)).toHaveAttribute('data-globe-camera-phase', 'idle');
  await expect(page.locator('#atlas canvas')).toHaveCount(1);
  expect(await page.evaluate(() => window.__bookyLiveFixtureError ?? null)).toBeNull();
}
async function actual(page) {
  let observed;
  await expect.poll(async () => { observed = await sample(page); return observed?.uploaded ? observed.selection : null; }).toEqual(BASE);
  observed = await page.evaluate(() => window.__bookyLiveFixture.renderSample());
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
const avatar = page => page.locator('[data-planet-mascot-avatar]');
const character = page => page.evaluate(() => window.__bookyLiveFixture.booky());
const owners = page => page.evaluate(() => window.__bookyLiveFixture.owners());
async function layout(page) {
  return page.evaluate(() => {
    const rect = selector => { const element=document.querySelector(selector); if(!element)return null;
      const r=element.getBoundingClientRect();return{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}; };
    const leaf=document.querySelector('[data-planet-mascot-leaf]');
    return{viewport:{width:innerWidth,height:innerHeight},pet:rect('[data-planet-mascot-pet]'),card:rect('[data-planet-mascot-panel]'),
      canvas:rect('[data-booky-canvas]'),overflow:document.documentElement.scrollWidth>innerWidth+1,
      leaf:leaf?{page:Number(leaf.getAttribute('data-planet-mascot-leaf')),animation:getComputedStyle(leaf).animationName,
        duration:getComputedStyle(leaf).animationDuration,transform:getComputedStyle(leaf).transform,scrollTop:leaf.parentElement.scrollTop}:null};
  });
}
function fits(rect, viewport) {
  return Boolean(rect&&Object.values(rect).every(Number.isFinite)&&rect.width>0&&rect.height>0
    &&rect.left>=-.5&&rect.top>=-.5&&rect.right<=viewport.width+.5&&rect.bottom<=viewport.height+.5);
}
async function live(page) {
  await expect(avatar(page)).toHaveAttribute('data-renderer-state','live3d');
  await expect(page.locator('[data-booky-canvas]')).toHaveCount(1);
  await expect(avatar(page).locator('img')).toHaveCount(0);
  let observed, positions;
  await expect.poll(async()=>{
    observed=await character(page);positions=await layout(page);if(!observed)return false;
    const {screen,rect}=observed,view=page.viewportSize();
    const separate=!positions.card||rect.right<=positions.card.left||rect.left>=positions.card.right
      ||rect.bottom<=positions.card.top||rect.top>=positions.card.bottom;
    return observed.finite&&observed.gpu.calls>0&&observed.renderedFrames>0&&!observed.contextLost
      &&fits(rect,view)&&fits(positions.pet,view)&&(!positions.card||fits(positions.card,view))&&!positions.overflow&&separate
      &&screen.left>=rect.left-.5&&screen.right<=rect.right+.5&&screen.top>=rect.top-.5&&screen.bottom<=rect.bottom+.5
      &&screen.minDepth>=-1&&screen.maxDepth<=1;
  },{message:'Actual rendered geometry, decorative canvas and controls fit without cropping or overlap'}).toBe(true);
  expect(observed.triangles).toBeGreaterThan(0);expect(observed.meshes).toContain('booky-magnifier-lens');
  expect(observed.independentFromGlobe).toBe(true);
  expect(Object.keys(observed.rig)).toEqual(expect.arrayContaining(['body','frontCover','leftArm','rightArm','eyes','pupils','brows','mouth']));
  expect(observed.rig.eyes).toHaveLength(2);expect(observed.rig.pupils).toHaveLength(2);
  await expect(page.locator('#atlas canvas')).toHaveCount(1);
  return{character:observed,layout:positions};
}
async function capture(page,result,testInfo,filename) {
  const bytes=await page.screenshot({path:testInfo.outputPath(filename)});
  result.screenshots.push({filename,sha256:digest(bytes),...page.viewportSize(),framing:'actual-app-independent-live-3d-companion'});
}
async function captureCharacterBuffer(page,result,testInfo) {
  // Read the real owned drawing buffer at its native resolution. One explicit
  // diagnostic render preserves all authored transforms, lights and camera;
  // there is no extra scene, renderer, supersampling or bitmap enlargement.
  const capture=await page.evaluate(()=>{
    const record=window.__bookyRendererObservations.filter(item=>!item.disposed).at(-1);
    record.renderer.render(record.scene,record.camera);
    const canvas=record.renderer.domElement;
    return{data:canvas.toDataURL('image/png'),width:canvas.width,height:canvas.height};
  });
  const filename='booky-live-actual-drawing-buffer.png',bytes=Buffer.from(capture.data.split(',')[1],'base64');
  expect(capture.width).toBeGreaterThanOrEqual(160);expect(capture.width).toBeLessThanOrEqual(256);
  await fs.writeFile(testInfo.outputPath(filename),bytes);
  result.screenshots.push({filename,sha256:digest(bytes),width:capture.width,height:capture.height,
    framing:'actual-character-native-drawing-buffer; one diagnostic render; unchanged model, camera and lighting'});
}
async function twoFrames(page) {
  await page.evaluate(async()=>{for(let i=0;i<2;i++)await new Promise(requestAnimationFrame)});
}
test('live Mr. Booky model responds to direct interaction while the canonical globe stays unchanged',async({},testInfo)=>{
  test.setTimeout(120_000);const fixture=await open(testInfo),{page,result}=fixture;
  try{
    await actual(page);await page.evaluate(()=>window.__bookyLiveFixture.remember());await stablePose(page);
    const baseline=await actual(page);result.observations.baseline=baseline;
    await expect(page.locator('[data-booky-canvas]')).toHaveCount(0);
    const toggle=page.locator('[data-planet-mascot-toggle]');await toggle.click();await expect(panel(page)).toBeVisible();
    await live(page);await expect(page.locator('[data-booky-canvas]')).toHaveAttribute('data-booky-animating','false');
    const desktop=await live(page);result.observations.desktop=desktop;retained(await actual(page),baseline);
    await capture(page,result,testInfo,'booky-live-help-ru-1440.png');
    await captureCharacterBuffer(page,result,testInfo);

    // Actual pupil geometry follows the pointer. The observer only reads the
    // real model/renderer; no fixture assigns any model or camera transform.
    let bounds=await toggle.boundingBox();
    await page.mouse.move(bounds.x+8,bounds.y+bounds.height/2);
    await expect.poll(async()=>(await character(page)).rig.pupils[0].position[0])
      .toBeLessThan(desktop.character.rig.pupils[0].position[0]-.001);
    await expect(page.locator('[data-booky-canvas]')).toHaveAttribute('data-booky-animating','false');
    const left=await character(page),leftPupils=JSON.stringify(left.rig.pupils.map(value=>value.position));
    await page.mouse.move(bounds.x+bounds.width-8,bounds.y+bounds.height/2);
    await expect.poll(async()=>JSON.stringify((await character(page)).rig.pupils.map(value=>value.position))).not.toBe(leftPupils);
    await expect(page.locator('[data-booky-canvas]')).toHaveAttribute('data-booky-animating','false');
    const looked=await character(page);expect(looked.model).toBe(desktop.character.model);
    expect(looked.resources).toEqual(desktop.character.resources);result.observations.pointerLook={left,right:looked};

    const origin=(await layout(page)).pet;
    await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);await page.mouse.down();
    await page.mouse.move(bounds.x+bounds.width/2-48,bounds.y+bounds.height/2-24,{steps:4});
    await expect(pet(page)).toHaveAttribute('data-planet-mascot-gesture','dragging');
    await page.keyboard.press('Escape');await page.mouse.up();
    await expect.poll(async()=>{const value=(await layout(page)).pet;return{left:value.left,top:value.top}})
      .toEqual({left:origin.left,top:origin.top});await expect(panel(page)).toBeVisible();
    bounds=await toggle.boundingBox();
    await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);await page.mouse.down();
    await page.mouse.move(bounds.x+bounds.width/2-70,bounds.y+bounds.height/2-30,{steps:5});await page.mouse.up();
    await expect.poll(async()=>(await layout(page)).pet.left).toBeLessThan(origin.left-50);
    await expect(panel(page)).toBeVisible();retained(await actual(page),baseline);
    result.observations.dragged=await live(page);
    bounds=await toggle.boundingBox();await page.touchscreen.tap(bounds.x+bounds.width/2,bounds.y+bounds.height/2);
    await expect(panel(page)).toHaveCount(0);await toggle.focus();await page.keyboard.press('Enter');await expect(panel(page)).toBeVisible();
    await page.locator('[data-planet-mascot-move]').focus();await page.keyboard.press('Home');

    await page.locator('[data-planet-mascot-route="overview"]').click();
    await expect(page.locator('[data-planet-mascot-highlight="search"]')).toBeVisible();
    await page.mouse.move(2,2);
    await expect(page.locator('[data-booky-canvas]')).toHaveAttribute('data-booky-animating','false');
    const guided=await character(page);
    expect(guided.rig.brows[0].position[1]).toBeGreaterThan(desktop.character.rig.brows[0].position[1]);
    expect(Math.max(...['leftArm','rightArm'].map(part=>Math.abs(guided.rig[part].rotation[2]-desktop.character.rig[part].rotation[2])))).toBeGreaterThan(.05);
    result.observations.guidedTarget={character:guided,target:await page.locator('[data-planet-mascot-highlight="search"]').boundingBox()};
    const firstPage=await layout(page);
    await page.locator('[data-planet-mascot-next]').click();await expect(pet(page)).toHaveAttribute('data-planet-mascot-step','1');
    await expect.poll(async()=>(await layout(page)).leaf.page).toBeGreaterThan(firstPage.leaf.page);
    const nextPage=await layout(page);expect(nextPage.leaf.animation).toMatch(/^booky-leaf-reveal-/u);
    expect(Number.parseFloat(nextPage.leaf.duration)).toBeGreaterThan(0);expect(nextPage.leaf.scrollTop).toBe(0);
    result.observations.pageTurn={before:firstPage.leaf,after:nextPage.leaf,character:await character(page)};
    await page.locator('[data-planet-mascot-back]').click();await expect(pet(page)).toHaveAttribute('data-planet-mascot-step','0');
    await page.locator('.native-planet-app .interface-language-control button').filter({hasText:/^EN$/u}).click();
    await expect(page.locator('html')).toHaveAttribute('lang','en');await page.setViewportSize({width:320,height:844});
    await expect(panel(page).getByRole('heading',{name:'Mr. Booky',exact:true})).toBeVisible();
    const narrow=await live(page);retained(await actual(page),baseline,false);result.observations.narrow=narrow;
    expect(narrow.character.model).toBe(desktop.character.model);await capture(page,result,testInfo,'booky-live-guide-en-320.png');
    await page.setViewportSize({width:844,height:390});const landscape=await live(page);
    result.observations.landscape=landscape;await capture(page,result,testInfo,'booky-live-interaction-en-landscape.png');

    await page.emulateMedia({reducedMotion:'reduce'});await live(page);
    await expect(page.locator('[data-booky-canvas]')).toHaveAttribute('data-booky-reduced-motion','true');
    await expect(page.locator('[data-booky-canvas]')).toHaveAttribute('data-booky-animating','false');
    await expect.poll(async()=>{const before=(await character(page)).renderedFrames;await twoFrames(page);return(await character(page)).renderedFrames===before}).toBe(true);
    const reduced=await live(page);expect(reduced.layout.leaf.animation).toBe('none');
    expect(Number.parseFloat(reduced.layout.leaf.duration)).toBeLessThanOrEqual(.00002);
    await page.locator('[data-planet-mascot-next]').click();await expect(pet(page)).toHaveAttribute('data-planet-mascot-step','1');
    const reducedNext=await layout(page);expect(reducedNext.leaf.animation).toBe('none');
    expect(Number.parseFloat(reducedNext.leaf.duration)).toBeLessThanOrEqual(.00002);result.observations.reducedMotion=await live(page);
    await stablePose(page);const preservedView=await actual(page);

    await page.evaluate(()=>window.__bookyLiveFixture.setVisible(false));await expect(pet(page)).toHaveCount(0);
    await expect.poll(async()=>{const value=await owners(page);return value.renderers.every(item=>item.disposed)&&value.models.every(item=>item.disposed)}).toBe(true);
    const inactive=await owners(page);await twoFrames(page);expect(await owners(page)).toEqual(inactive);
    expect(inactive.renderers.every(item=>item.disposed&&item.disposeCalls===1)).toBe(true);
    expect(inactive.models.every(item=>item.disposed&&item.disposeCalls===1)).toBe(true);
    await page.evaluate(()=>window.__bookyLiveFixture.setVisible(true));await ready(page);await expect(panel(page)).toHaveCount(0);
    const resumed=await live(page);expect(resumed.character.model).not.toBe(desktop.character.model);retained(await actual(page),preservedView);
    result.observations.background={inactive,resumed};

    // The first genuine loss recovers the same renderer/model. A second loss
    // exercises the product's bounded fallback; neither recovery nor context
    // events are stubbed, and the canonical globe context is never selected.
    await page.evaluate(()=>new Promise((resolve,reject)=>{
      const record=window.__bookyRendererObservations.filter(item=>!item.disposed).at(-1);
      const canvas=record.renderer.domElement,extension=record.renderer.getContext().getExtension('WEBGL_lose_context');
      if(!extension){reject(Error('Actual WEBGL_lose_context unavailable'));return}
      const timer=setTimeout(()=>reject(Error('Actual Booky context restoration did not complete')),4000);
      canvas.addEventListener('webglcontextrestored',()=>{clearTimeout(timer);resolve()},{once:true});extension.loseContext();
    }));
    const restored=await live(page);
    expect(restored.character.rendererId).toBe(resumed.character.rendererId);
    expect(restored.character.model).toBe(resumed.character.model);
    expect(restored.character.camera).toBe(resumed.character.camera);
    expect(restored.character.scene).toBe(resumed.character.scene);
    expect(restored.character.resources).toEqual(resumed.character.resources);
    expect(restored.character.renderCount).toBeGreaterThan(resumed.character.renderCount);
    result.observations.contextRestored=restored;retained(await actual(page),preservedView);
    await page.evaluate(()=>{
      const record=window.__bookyRendererObservations.filter(item=>!item.disposed).at(-1);
      record.renderer.getContext().getExtension('WEBGL_lose_context').loseContext();
    });
    await expect(avatar(page)).toHaveAttribute('data-renderer-state','fallback');
    const fallback=avatar(page).locator('img');await expect(fallback).toBeVisible();
    await expect.poll(()=>fallback.evaluate(image=>image.naturalWidth)).toBe(1254);
    expect(await fallback.getAttribute('alt')).toBe('');
    await toggle.click();await expect(panel(page)).toBeVisible();await expect(pet(page)).toHaveAttribute('data-planet-mascot-step','1');
    await page.locator('[data-planet-mascot-back]').click();await expect(pet(page)).toHaveAttribute('data-planet-mascot-step','0');
    retained(await actual(page),preservedView);result.observations.fallback={layout:await layout(page),owners:await owners(page),globe:await actual(page)};
    await page.locator('[data-planet-mascot-hide]').click();await expect(page.locator('[data-booky-canvas]')).toHaveCount(0);
    const retired=await owners(page);await twoFrames(page);expect(await owners(page)).toEqual(retired);
    expect(retired.renderers.every(item=>item.disposed&&item.disposeCalls===1)).toBe(true);
    expect(retired.models.every(item=>item.disposed&&item.disposeCalls===1)).toBe(true);result.observations.retired=retired;
    expect(fixture.writes()).toEqual([]);expect(fixture.memory.get(KEY)).toBe(fixture.initialRecord);
    Object.assign(result,{liveThreeModelRendered:true,normalModeHasNoBitmap:true,actualRigResponds:true,actualGuidedTargetPose:true,bodyDragDoesNotTogglePanel:true,
      escapeCancelsBodyDrag:true,touchTapAndKeyboardWork:true,semanticPageTurn:true,wholeModelFits:true,localeRetainsRoute:true,
      reducedMotionStopsAnimation:true,noHiddenFrames:true,independentResourcesDisposed:true,realContextLossFallbackWorks:true,
      realContextRestoreRetainsModel:true,repeatedContextLossUsesFallback:true,sameCanonicalGlobe:true,noAppearanceWrites:true});fixture.verify();
  }finally{await fixture.close();}
});
