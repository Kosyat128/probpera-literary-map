import { test, expect, chromium } from '@playwright/test';
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SITE = 'https://booky-live-character.test';
const KEY = 'probpera-planet-composition-v1';
const BOOKY = 'probpera-booky-adult-v1';
const ASSET = 'src/assets/mascots/knizhulyk-green-v1.png';
const ASSET_SHA = '44f97b5c83189ba1ddca26fd1313edc515e5008a2e92c2c694d1d57c29a2a4ed';
const BASE = { editionId: 'rand-mcnally-1887', standId: 'canonical', backgroundId: 'background.base.site-starfield' };
const CUSTOMIZATION_KEYS = new Set([KEY, 'probpera.globe-edition.v2', 'probpera.globe-style.v1',
  'probpera-planet-stand-v1', 'probpera-planet-background-v1']);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const mime = { '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.geojson': 'application/geo+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.woff': 'font/woff', '.woff2': 'font/woff2' };
let files, selectedAssets, sourceEvidence;

// Actual App, source CSS and existing R3F scene. Native OS/preference bindings
// and the declared panel-focus scheduling gate are controlled. Camera movement uses product controls or
// a Playwright pointer gesture; the fixture never assigns camera/controls state.
test.beforeAll(async () => {
  test.setTimeout(120_000);
  const output = path.join(ROOT, '.tmp/booky-live-character-memory');
  const built = await build({ absWorkingDir: ROOT, stdin: { resolveDir: ROOT, loader: 'ts', contents: `
    import{_roots}from'@react-three/fiber';
    import*as THREE from'three';
    import{mountHostApp}from'./src/host/mountHostApp';
    import{parseBookyPreference}from'./src/host/planetMascotPreference';
    import{bookyReactionDuration}from'./src/host/bookyAnimation';
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
    // Only the existing panel's focus callbacks can be held. The canonical
    // globe and character retain the real browser clock and frame scheduler.
    let sectionHeld=false,sectionSequence=0;const sectionFrames=new Map();
    window.__bookySectionFrames={
      request(callback){const id=++sectionSequence,entry={callback,native:null};sectionFrames.set(id,entry);
        if(!sectionHeld)entry.native=requestAnimationFrame(time=>{sectionFrames.delete(id);callback(time)});return id},
      cancel(id){const entry=sectionFrames.get(id);if(entry?.native!==null)cancelAnimationFrame(entry?.native);sectionFrames.delete(id)},
      hold(){sectionHeld=true},
      release(){sectionHeld=false;for(const[id,entry]of sectionFrames)if(entry.native===null)
        entry.native=requestAnimationFrame(time=>{sectionFrames.delete(id);entry.callback(time)})},
      pending(){return [...sectionFrames.values()].filter(entry=>entry.native===null).length},
    };
    const downloadCalls=[];
    window.__bookyLiveFixture={scenes,remember:()=>{original=current()},downloadCalls,
      parseCompanion:parseBookyPreference,reactionDuration:interaction=>bookyReactionDuration({interaction}),
      observeWalk(){
        window.__bookyWalkObservation?.stop();
        const value={startedAt:performance.now(),samples:[],frame:0,stopped:false,
          stop(){this.stopped=true;cancelAnimationFrame(this.frame);return{startedAt:this.startedAt,samples:this.samples}}};
        const sample=()=>{if(value.stopped)return;
          const element=document.querySelector('[data-planet-mascot-pet]');
          if(element){const r=element.getBoundingClientRect();value.samples.push({at:performance.now(),left:r.left,top:r.top,
            right:r.right,bottom:r.bottom,width:r.width,height:r.height,viewport:{width:innerWidth,height:innerHeight}})}
          if(performance.now()-value.startedAt<6000)value.frame=requestAnimationFrame(sample);else value.stop();};
        window.__bookyWalkObservation=value;value.frame=requestAnimationFrame(sample);
      },
      stopObservingWalk(){return window.__bookyWalkObservation?.stop()??null},
      markGesture(){document.addEventListener('click',()=>{
        const record=(window.__bookyRendererObservations??[]).filter(item=>!item.disposed).at(-1);
        window.__bookyGestureStart={at:performance.now(),frames:record?.frames??0};
      },{capture:true,once:true})},
      gestureTrace(){const record=(window.__bookyRendererObservations??[]).filter(item=>!item.disposed).at(-1),start=window.__bookyGestureStart;
        return{start,frames:record?.frames??0,timeline:record?.timeline.filter(entry=>entry.at>=start?.at)??[]}},
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
    createAndroidPlatformAdapter({bindings,channel:'dev'}).then(host=>{
      const actualDownloads=host.services.downloads;
      const observed=Object.freeze(Object.fromEntries(Object.entries(actualDownloads).map(([name,value])=>[name,
        typeof value!=='function'?value:(...args)=>{if(!['subscribe','getSnapshot','getInspection','dispose'].includes(name))downloadCalls.push(name);
          return value.apply(actualDownloads,args)}])));
      return mountHostApp({...host,services:Object.freeze({...host.services,downloads:observed})});
    }).catch(error=>{window.__bookyLiveFixtureError=error.message});
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
            const record={id:list.length+1,renderer:this,scene:null,camera:null,frames:0,timeline:[],disposed:false,disposeCalls:0};list.push(record);
            this.domElement.dataset.observedBookyCanvas=String(record.id);
            const render=this.render,dispose=this.dispose;
            this.render=(scene,camera)=>{const result=render.call(this,scene,camera);
              if(scene.getObjectByName('booky-model')){record.scene=scene;record.camera=camera;record.frames++;
                const owner=(window.__bookyModelObservations??[]).filter(item=>!item.disposed).at(-1);
                const transform=object=>[...object.position.toArray(),...object.quaternion.toArray(),...object.scale.toArray()];
                const pose=owner?Object.fromEntries(['body','leftArm','rightArm','frontCover','mouth','eyes','leftLeg','rightLeg','leftFoot','rightFoot']
                  .filter(key=>owner.model.rig[key]).map(key=>{const object=owner.model.rig[key];
                    return[key,Array.isArray(object)?object.map(transform):transform(object)]})):null;
                record.timeline.push({at:performance.now(),pose});if(record.timeline.length>180)record.timeline.shift();
              }return result};
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
    } }, { name:'controlled-panel-focus-scheduler',setup(builder){
      builder.onLoad({filter:/[\\/]NativePlanetPanel\.tsx$/},async args=>{
        let contents=await fs.readFile(args.path,'utf8');
        const requested=(contents.match(/\brequestAnimationFrame\(/gu)??[]).length;
        const cancelled=(contents.match(/\bcancelAnimationFrame\(/gu)??[]).length;
        expect([requested,cancelled]).toEqual([2,2]);
        contents=contents.replace(/\brequestAnimationFrame\(/gu,'window.__bookySectionFrames.request(')
          .replace(/\bcancelAnimationFrame\(/gu,'window.__bookySectionFrames.cancel(');
        return{contents,loader:'tsx',resolveDir:path.dirname(args.path)};
      });
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
    'src/host/bookyModel.ts', 'src/host/bookyAnimation.ts', 'src/host/useBookyRenderer.ts', 'src/host/NativePlanetPanel.tsx',
    'src/host/PlanetDownloadsPanel.tsx', 'src/host/PlanetGraphicsSettings.tsx', 'src/components/RecentHistoryPanel.tsx', ASSET];
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
    fixtureObservers: ['Real Booky WebGLRenderer render/dispose calls, frame times, rig poses and actual scene/camera references',
      'Actual createBookyModel owner and disposer; fixture never assigns geometry or material values',
      'Delegating observer of actual native ContentDownloads methods; no replacement outcomes'],
    controlledScheduling: 'Only the two NativePlanetPanel RAF callbacks may be held/released explicitly for stale-focus regression; no globe or character clock changes',
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
      async verify() { expect(errors).toEqual([]); expect(externalRequests).toEqual([]); expect(missingResources).toEqual([]);
        expect(operations.filter(value=>value.operation!=='get'&&![BOOKY,'probpera-interface-language','probpera-planet-recent-adult-v1'].includes(value.key))).toEqual([]);
        const companionWrites=operations.filter(value=>value.operation!=='get'&&value.key===BOOKY);
        expect(companionWrites.every(value=>value.operation==='set')).toBe(true);
        for(const value of companionWrites)expect(await page.evaluate(raw=>window.__bookyLiveFixture.parseCompanion(raw),value.value)).not.toBeNull();
        result.validatedExplicitCompanionWrites=companionWrites;
        result.pass = true; },
      async close() {
        result.customizationWrites = operations.filter(value => value.operation !== 'get' && CUSTOMIZATION_KEYS.has(value.key));
        result.unexpectedPreferenceWrites = operations.filter(value => value.operation !== 'get' && ![BOOKY, 'probpera-interface-language', 'probpera-planet-recent-adult-v1'].includes(value.key));
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
    await page.mouse.move(2,2);await expect(page.locator('[data-booky-canvas]')).toHaveAttribute('data-booky-animating','false');
    const neutralGuidanceReference=await character(page);

    await page.locator('[data-planet-mascot-route="overview"]').click();
    await expect(page.locator('[data-planet-mascot-highlight="search"]')).toBeVisible();
    await page.mouse.move(2,2);
    await expect(page.locator('[data-booky-canvas]')).toHaveAttribute('data-booky-animating','false');
    const guided=await character(page);
    expect(guided.rig.brows[0].position[1]).toBeGreaterThan(neutralGuidanceReference.rig.brows[0].position[1]);
    expect(Math.max(...['leftArm','rightArm'].map(part=>Math.abs(guided.rig[part].rotation[2]-neutralGuidanceReference.rig[part].rotation[2])))).toBeGreaterThan(.05);
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
      realContextRestoreRetainsModel:true,repeatedContextLossUsesFallback:true,sameCanonicalGlobe:true,noAppearanceWrites:true});await fixture.verify();
  }finally{await fixture.close();}
});


async function openUtility(page, name, summaryName) {
  if(!await panel(page).isVisible()){
    await page.locator('[data-planet-mascot-toggle]').click();await expect(panel(page)).toBeVisible();
  }
  const summary=panel(page).locator('summary').filter({hasText:new RegExp('^'+summaryName+'$','u')});
  if(!await summary.evaluate(element=>element.parentElement.open))await summary.click();
  const action=panel(page).getByRole('button',{name,exact:true});
  await expect(action).toBeEnabled();await action.focus();await page.keyboard.press('Enter');
  await expect(panel(page)).not.toBeVisible();
}
async function companionSaved(fixture) {
  await expect(fixture.page.locator('[data-planet-mascot-preference-state]')).toHaveCount(0);
  await expect.poll(()=>JSON.parse(fixture.memory.get(BOOKY)??'null')?.visible).toBe(true);
}
const mutations=fixture=>fixture.operations.filter(value=>value.operation!=='get').map(({operation,key,value})=>({operation,key,value}));
const downloadActions=page=>page.evaluate(()=>window.__bookyLiveFixture.downloadCalls.filter(name=>name!=='loadNetworkPreference'));

test('Mr. Booky opens canonical local utilities without writes and preserves newer keyboard focus',async({},testInfo)=>{
  test.setTimeout(150_000);const fixture=await open(testInfo),{page,result}=fixture;
  try{
    await actual(page);await page.evaluate(()=>window.__bookyLiveFixture.remember());await stablePose(page);
    await page.locator('[data-planet-mascot-toggle]').click();await expect(panel(page)).toBeVisible();
    await companionSaved(fixture);await live(page);
    const useful=panel(page).locator('summary').filter({hasText:/^Полезные действия$/u});
    await expect(useful).toBeVisible();expect(await useful.evaluate(element=>element.parentElement.open)).toBe(false);
    await useful.click();
    for(const name of ['Случайная страна','Недавно открытое','Загрузки и память','Настройки графики']){
      const button=panel(page).getByRole('button',{name,exact:true});await expect(button).toBeEnabled();
      const box=await button.boundingBox();expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await page.setViewportSize({width:320,height:844});await live(page);
    await useful.scrollIntoViewIfNeeded();await capture(page,result,testInfo,'booky-useful-actions-ru-320.png');
    await page.setViewportSize({width:1440,height:850});await live(page);await stablePose(page);
    const original=await actual(page),before=mutations(fixture),saved=fixture.memory.get(BOOKY);

    // Accepted utilities collapse tips so the requested section stays usable.
    // Panel state fences local preference intent; its confirmed saved bytes
    // and semantic progress remain unchanged, including across the remount.
    await openUtility(page,'Настройки графики','Полезные действия');
    const graphics=page.locator('[data-planet-graphics-settings]'),graphicsSummary=graphics.locator(':scope > summary');
    await expect(graphics).toHaveAttribute('open','');await expect(graphicsSummary).toBeFocused();
    await graphicsSummary.click();await expect(graphics).not.toHaveAttribute('open','');
    await graphicsSummary.click();await expect(graphics).toHaveAttribute('open','');
    await page.locator('[data-planet-quality-option="high"]').click({trial:true});
    await expect(page.locator('[data-planet-quality-option="high"]')).toBeChecked();
    expect(mutations(fixture)).toEqual(before);expect(fixture.memory.get(BOOKY)).toBe(saved);
    retained(await actual(page),original,false);

    await openUtility(page,'Загрузки и память','Полезные действия');
    const downloads=page.locator('[data-planet-downloads]'),downloadSummary=downloads.locator(':scope > summary');
    await expect(downloads).toHaveAttribute('open','');await expect(downloadSummary).toBeFocused();
    expect(await downloadActions(page)).toEqual([]);expect(mutations(fixture)).toEqual(before);

    await openUtility(page,'Недавно открытое','Полезные действия');
    const recent=page.locator('[data-recent-history]');
    await expect(recent).toHaveAttribute('open','');await expect(recent.locator(':scope > summary')).toBeFocused();
    expect(mutations(fixture)).toEqual(before);expect(fixture.memory.get(BOOKY)).toBe(saved);
    retained(await actual(page),original,false);

    // Hold only the panel's actual focus callback. A newer real Enter on an
    // unrelated summary owns focus even after the old callback is released.
    await graphicsSummary.click();await expect(graphics).not.toHaveAttribute('open','');
    await page.evaluate(()=>window.__bookySectionFrames.hold());
    await openUtility(page,'Настройки графики','Полезные действия');
    await expect.poll(()=>page.evaluate(()=>window.__bookySectionFrames.pending())).toBe(1);
    await downloadSummary.focus();await page.keyboard.press('Enter');await expect(downloadSummary).toBeFocused();
    await page.evaluate(()=>window.__bookySectionFrames.release());await twoFrames(page);
    await expect(downloadSummary).toBeFocused();await expect(graphics).not.toHaveAttribute('open','');
    expect(await downloadActions(page)).toEqual([]);expect(mutations(fixture)).toEqual(before);
    // A new explicit command remains usable after the rejected older one.
    await openUtility(page,'Настройки графики','Полезные действия');
    await expect(graphics).toHaveAttribute('open','');await expect(graphicsSummary).toBeFocused();

    await page.locator('.native-planet-panel .interface-language-control button').filter({hasText:/^EN$/u}).click();
    await expect(page.locator('html')).toHaveAttribute('lang','en');
    await expect.poll(()=>fixture.memory.get('probpera-interface-language')).toBe('en');
    const englishBefore=mutations(fixture);
    for(const [name,selector]of [['Recently opened','[data-recent-history]'],['Downloads and storage','[data-planet-downloads]'],['Graphics settings','[data-planet-graphics-settings]']]){
      await openUtility(page,name,'Useful actions');await expect(page.locator(selector+'>summary')).toBeFocused();
      expect(mutations(fixture)).toEqual(englishBefore);
    }
    const countryBefore=new URL(page.url()).searchParams.get('country');
    await openUtility(page,'Random country','Useful actions');
    await expect(page.locator('.native-planet-panel')).toBeHidden();await ready(page);
    await expect.poll(()=>new URL(page.url()).searchParams.get('country')).not.toBe(countryBefore);
    await stablePose(page);retained(await actual(page),original,false,false);
    expect(fixture.memory.get(BOOKY)).toBe(saved);expect(fixture.writes()).toEqual([]);expect(await downloadActions(page)).toEqual([]);
    const afterRandom=mutations(fixture).slice(englishBefore.length);
    expect(afterRandom.every(value=>value.key==='probpera-planet-recent-adult-v1')).toBe(true);
    result.observations.utilities={before,englishBefore,afterRandom,downloadActions:await downloadActions(page),
      savedCompanionSha256:digest(Buffer.from(saved)),countryBefore,countryAfter:new URL(page.url()).searchParams.get('country'),globe:await actual(page)};
    Object.assign(result,{scenario:'explicit-local-utilities',fourCanonicalActions:true,utilitiesBilingual:true,
      initialPanelHeadingDoesNotBlockRequestedFocus:true,utilitiesCollapseTips:true,underlyingSectionControlsUsable:true,
      newerKeyboardFocusRetained:true,staleFocusDoesNotReopenSection:true,
      openDoesNotChangeGraphicsOrDownloads:true,noUtilityProgressWrites:true,randomUsesCanonicalGlobe:true,sameCanonicalGlobe:true});
    await fixture.verify();
  }finally{await fixture.close();}
});

test('Mr. Booky thirteen gestures and nonrepeating surprises finish and remain still with reduced motion',async({},testInfo)=>{
  test.setTimeout(150_000);const fixture=await open(testInfo),{page,result}=fixture;
  try{
    await actual(page);await page.evaluate(()=>window.__bookyLiveFixture.remember());await stablePose(page);
    const original=await actual(page);
    await page.locator('[data-planet-mascot-toggle]').click();await expect(panel(page)).toBeVisible();await companionSaved(fixture);await live(page);
    await page.locator('.native-planet-app .interface-language-control button:visible').filter({hasText:/^EN$/u}).click();
    await expect(page.locator('html')).toHaveAttribute('lang','en');await expect.poll(()=>fixture.memory.get('probpera-interface-language')).toBe('en');
    const gestures=panel(page).locator('summary').filter({hasText:'Mr. Booky’s gestures'});
    expect(await gestures.evaluate(element=>element.parentElement.open)).toBe(false);await gestures.click();
    await page.mouse.move(2,2);await expect(page.locator('[data-booky-canvas]')).toHaveAttribute('data-booky-animating','false');
    const gestureCases=[['Wave','greeting'],['Nod','nod'],['Take a closer look','curious'],['Celebrate','happy'],['Encourage','reassuring'],['Wink','wink'],['Sway','sway'],
      ['Dance','dance'],['Hop','hop'],['Twirl','twirl'],['Stretch','stretch'],['Act shy','shy'],['High five!','highfive']];
    const originalGestures=new Set(gestureCases.slice(0,7).map(([,interaction])=>interaction));
    await expect(panel(page).locator('[data-booky-gesture]')).toHaveCount(13);
    const before=mutations(fixture),saved=fixture.memory.get(BOOKY),traces=[];
    for(const [name,expectedInteraction]of [...gestureCases,['Sway','sway'],['Surprise me',null],['Surprise me',null]]){
      const button=expectedInteraction===null?panel(page).locator('[data-booky-surprise]'):panel(page).getByRole('button',{name,exact:true});
      await expect(button).toHaveAccessibleName(name);await expect(button).toBeEnabled();await button.focus();
      const previousInteraction=await pet(page).getAttribute('data-planet-mascot-gesture');
      await page.evaluate(()=>window.__bookyLiveFixture.markGesture());await page.keyboard.press('Enter');
      const interaction=await pet(page).getAttribute('data-planet-mascot-gesture');
      if(expectedInteraction===null){
        expect(gestureCases.map(([,value])=>value)).toContain(interaction);expect(interaction).not.toBe(previousInteraction);
      }else expect(interaction).toBe(expectedInteraction);
      await expect.poll(()=>page.evaluate(()=>{const value=window.__bookyLiveFixture.gestureTrace();return value.frames-value.start.frames})).toBeGreaterThan(2);
      await expect(page.locator('[data-booky-canvas]')).toHaveAttribute('data-booky-animating','false',{timeout:4000});
      const trace=await page.evaluate(()=>window.__bookyLiveFixture.gestureTrace());
      expect(trace.timeline.length).toBeGreaterThan(2);
      expect(new Set(trace.timeline.map(value=>JSON.stringify(value.pose))).size).toBeGreaterThan(1);
      if(interaction==='wink'){
        const left=trace.timeline.map(value=>value.pose.eyes[0][8]),right=trace.timeline.map(value=>value.pose.eyes[1][8]);
        expect(Math.min(...left)).toBeLessThan(Math.max(...left)*.5);
        expect(Math.max(...right)-Math.min(...right)).toBeLessThan(1e-8);
      }
      if(interaction==='sway'){
        for(const key of ['leftLeg','rightLeg','leftFoot','rightFoot']){
          const values=trace.timeline.map(value=>value.pose[key]);
          expect(values.every(value=>Array.isArray(value)&&value.length===10)).toBe(true);
          expect(new Set(values.map(value=>JSON.stringify(value))).size).toBe(1);
        }
      }
      const values=key=>{const result=trace.timeline.map(value=>value.pose[key]);
        expect(result.every(value=>Array.isArray(value)&&value.length===10)).toBe(true);return result;};
      const range=values=>Math.max(...values)-Math.min(...values);
      if(interaction==='dance'){
        expect(range(values('body').map(value=>value[5]))).toBeGreaterThan(.01);
        for(const key of ['leftLeg','rightLeg'])expect(range(values(key).map(value=>value[3]))).toBeGreaterThan(.005);
      }
      if(interaction==='hop'){
        expect(range(values('body').map(value=>value[1]))).toBeGreaterThan(.02);
        for(const key of ['leftLeg','rightLeg']){
          const rotations=values(key).map(value=>value[3]);expect(Math.max(...rotations)-rotations[rotations.length-1]).toBeGreaterThan(.005);
        }
      }
      if(interaction==='twirl'){
        expect(Math.max(...values('body').map(value=>value[4]))).toBeGreaterThan(.7);
        expect(Math.min(...values('body').map(value=>value[6]))).toBeLessThan(-.5);
      }
      if(interaction==='stretch'){
        const scales=values('body').map(value=>value[8]);expect(Math.max(...scales)/scales[scales.length-1]).toBeGreaterThan(1.015);
        expect(range(values('leftArm').map(value=>value[5]))).toBeGreaterThan(.02);
      }
      if(interaction==='shy')expect(range(values('body').map(value=>value[3]))).toBeGreaterThan(.01);
      if(interaction==='highfive'){
        expect(range(values('leftArm').map(value=>value[5]))).toBeGreaterThan(.15);
        expect(new Set(values('rightArm').map(value=>JSON.stringify(value))).size).toBe(1);
      }
      const first=trace.timeline[0].at,last=trace.timeline[trace.timeline.length-1].at;
      const configuredDuration=await page.evaluate(value=>window.__bookyLiveFixture.reactionDuration(value),interaction);
      expect(configuredDuration).toBeGreaterThan(0);
      expect(configuredDuration).toBeLessThanOrEqual(originalGestures.has(interaction)?1100:2400);
      // A browser stall must not be confused with an endless animation. The
      // deadline is bounded above; the final frame may arrive one observed
      // scheduling interval later. This is not device performance acceptance.
      const maxFrameGap=Math.max(0,...trace.timeline.slice(1).map((value,index)=>value.at-trace.timeline[index].at));
      const frameAllowance=Math.max(100,maxFrameGap);
      expect(last-first).toBeLessThanOrEqual(configuredDuration+frameAllowance);
      expect(last-trace.start.at).toBeLessThan(5000);
      const stopped=(await character(page)).renderedFrames;await twoFrames(page);expect((await character(page)).renderedFrames).toBe(stopped);
      traces.push({interaction,trigger:expectedInteraction===null?'surprise':'explicit',previousInteraction,frames:trace.timeline.length,durationMs:last-first,configuredDurationMs:configuredDuration,frameSchedulingAllowanceMs:frameAllowance,maxObservedFrameGapMs:maxFrameGap,poses:trace.timeline.map(value=>value.pose)});
      expect(mutations(fixture)).toEqual(before);expect(fixture.memory.get(BOOKY)).toBe(saved);
    }
    await live(page);retained(await actual(page),original);
    await capture(page,result,testInfo,'booky-explicit-gestures-en-1440.png');
    await page.emulateMedia({reducedMotion:'reduce'});
    await expect(page.locator('[data-booky-canvas]')).toHaveAttribute('data-booky-reduced-motion','true');
    await expect(page.locator('[data-booky-canvas]')).toHaveAttribute('data-booky-animating','false');await twoFrames(page);
    const reduced=[];
    for(const [name]of [...gestureCases,['Surprise me',null]]){
      const button=panel(page).getByRole('button',{name,exact:true});await button.focus();await page.keyboard.press('Enter');await twoFrames(page);
      await expect(page.locator('[data-booky-canvas]')).toHaveAttribute('data-booky-animating','false');
      const settled=await character(page);await twoFrames(page);const unchanged=await character(page);
      expect(unchanged.renderedFrames).toBe(settled.renderedFrames);expect(unchanged.rig).toEqual(settled.rig);
      reduced.push({name,interaction:await pet(page).getAttribute('data-planet-mascot-gesture'),frames:settled.renderedFrames,
        pose:Object.fromEntries(['body','leftArm','rightArm','eyes'].map(key=>[key,settled.rig[key]]))});
    }
    const newStaticPoses=reduced.filter(value=>gestureCases.slice(7).some(([name])=>name===value.name));
    expect(newStaticPoses).toHaveLength(6);expect(new Set(newStaticPoses.map(value=>JSON.stringify(value.pose))).size).toBe(6);
    expect(mutations(fixture)).toEqual(before);expect(fixture.memory.get(BOOKY)).toBe(saved);expect(await downloadActions(page)).toEqual([]);
    retained(await actual(page),original);result.observations.explicitGestures={traces,reduced};
    Object.assign(result,{scenario:'explicit-bounded-gestures',thirteenExplicitGestures:true,repeatedReactionRestarts:true,surpriseChoosesDifferentGesture:true,
      actualRigChanges:true,sixNewMotionsObserved:true,newGesturesHaveDistinctStaticPoses:true,winkMovesOnlyOneEye:true,swayDoesNotStep:true,originalSevenAtMost1100ms:true,configuredReactionsAtMost2400ms:true,
      reactionsStopWithinSchedulingAllowance:true,reducedMotionHasNoReactionLoop:true,
      gesturesDoNotWritePreferencesOrProgress:true,sameCanonicalGlobe:true});await fixture.verify();
  }finally{await fixture.close();}
});


test('Mr. Booky walks along the margin only by request and stops for drag, hiding and reduced motion',async({},testInfo)=>{
  test.setTimeout(150_000);const fixture=await open(testInfo),{page,result}=fixture;
  const walk=()=>page.locator('[data-booky-walk]');
  const walking=()=>expect(pet(page)).toHaveAttribute('data-planet-mascot-gesture','walking');
  const stopped=(timeout=1000)=>expect(pet(page)).not.toHaveAttribute('data-planet-mascot-gesture','walking',{timeout});
  async function showWalk(){
    // The product deliberately disables walking while tips are open. Closing
    // them is an explicit user action, never a hidden test state assignment.
    if(await panel(page).isVisible()){
      await page.locator('[data-planet-mascot-collapse]').click();
      await expect(panel(page)).toHaveCount(0);await companionSaved(fixture);
    }
    await expect(walk()).toBeVisible();
  }
  async function begin(){
    await showWalk();await expect(walk()).toBeEnabled();await walk().focus();
    await page.evaluate(()=>{window.__bookyLiveFixture.observeWalk();window.__bookyLiveFixture.markGesture()});
    await page.keyboard.press('Enter');await walking();
  }
  async function moved(origin){
    await expect.poll(async()=>{const box=(await layout(page)).pet;return Math.hypot(box.left-origin.left,box.top-origin.top)}).toBeGreaterThan(8);
  }
  try{
    await actual(page);await page.evaluate(()=>window.__bookyLiveFixture.remember());await stablePose(page);
    await page.locator('[data-planet-mascot-toggle]').click();await expect(panel(page)).toBeVisible();await companionSaved(fixture);await live(page);
    await expect(walk()).toBeDisabled();await showWalk();
    const original=await actual(page),before=mutations(fixture),saved=fixture.memory.get(BOOKY);
    const origin=(await layout(page)).pet;await begin();await moved(origin);
    await capture(page,result,testInfo,'booky-margin-walk-ru-1440.png');
    await stopped(6000);const complete=await page.evaluate(()=>window.__bookyLiveFixture.stopObservingWalk());
    expect(complete.samples.length).toBeGreaterThan(5);
    expect(complete.samples.every(value=>Math.min(value.left,value.top,value.viewport.width-value.right,value.viewport.height-value.bottom)<=48)).toBe(true);
    expect(complete.samples.every(value=>fits({left:value.left,top:value.top,right:value.right,bottom:value.bottom,width:value.width,height:value.height},value.viewport))).toBe(true);
    const trace=await page.evaluate(()=>window.__bookyLiveFixture.gestureTrace());
    for(const key of ['leftLeg','rightLeg']){
      expect(trace.timeline.every(value=>Boolean(value.pose?.[key]))).toBe(true);
      expect(new Set(trace.timeline.map(value=>JSON.stringify(value.pose[key]))).size).toBeGreaterThan(1);
    }
    const duration=await page.evaluate(()=>window.__bookyLiveFixture.reactionDuration('walking'));expect(duration).toBe(4000);
    const completedPosition=(await layout(page)).pet;await twoFrames(page);expect((await layout(page)).pet).toEqual(completedPosition);
    expect(mutations(fixture)).toEqual(before);expect(fixture.memory.get(BOOKY)).toBe(saved);retained(await actual(page),original);

    await begin();await moved(completedPosition);
    const handle=page.locator('[data-planet-mascot-move]'),box=await handle.boundingBox();
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
    await expect(pet(page)).toHaveAttribute('data-planet-mascot-gesture','dragging');
    await page.mouse.move(box.x+box.width/2-25,box.y+box.height/2-15,{steps:3});await page.mouse.up();await stopped();
    const dragged=(await layout(page)).pet;await twoFrames(page);expect((await layout(page)).pet).toEqual(dragged);
    await page.evaluate(()=>window.__bookyLiveFixture.stopObservingWalk());
    expect(mutations(fixture)).toEqual(before);retained(await actual(page),original);

    await begin();await moved(dragged);
    await page.locator('[data-booky-walk-stop]').focus();await page.keyboard.press('Enter');await stopped();
    const manuallyStopped=(await layout(page)).pet;await twoFrames(page);expect((await layout(page)).pet).toEqual(manuallyStopped);
    await page.evaluate(()=>window.__bookyLiveFixture.stopObservingWalk());expect(mutations(fixture)).toEqual(before);

    await begin();await moved(manuallyStopped);
    await page.emulateMedia({reducedMotion:'reduce'});await stopped();await expect(walk()).toBeDisabled();
    // Stop first retires the walk, then hands its final local point to the
    // parent. Observe that bounded handoff before taking the exact stillness
    // reference; inactive gesture alone does not acknowledge the parent.
    const motionHandoff=[];result.observations.motionHandoff=motionHandoff;let previousMotionRect=null,motionRectMatches=0;
    await expect.poll(async()=>{
      const state=await page.evaluate(()=>{
        const element=document.querySelector('[data-planet-mascot-pet]'),r=element.getBoundingClientRect();
        return{at:performance.now(),rect:{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height},
          inactive:element.getAttribute('data-planet-mascot-gesture')!=='walking',disabled:document.querySelector('[data-booky-walk]')?.disabled===true};
      });
      motionHandoff.push(state);const key=JSON.stringify(state.rect);
      motionRectMatches=state.inactive&&state.disabled&&key===previousMotionRect?motionRectMatches+1:0;previousMotionRect=key;return motionRectMatches;
    },{timeout:500,intervals:[16,32],message:'Reduced-motion stop completes its finite parent-position handoff'}).toBeGreaterThanOrEqual(2);
    expect(motionHandoff.every(state=>state.inactive&&state.disabled)).toBe(true);
    const motionStoppedPosition=(await layout(page)).pet;await twoFrames(page);expect((await layout(page)).pet).toEqual(motionStoppedPosition);
    await page.evaluate(()=>window.__bookyLiveFixture.stopObservingWalk());expect(mutations(fixture)).toEqual(before);
    await page.emulateMedia({reducedMotion:'no-preference'});await expect(walk()).toBeEnabled();await stopped();
    await twoFrames(page);expect((await layout(page)).pet).toEqual(motionStoppedPosition);
    await begin();await moved(motionStoppedPosition);
    await page.evaluate(()=>window.__bookyLiveFixture.setVisible(false));await expect(pet(page)).toHaveCount(0);
    await expect.poll(async()=>{const value=await owners(page);return value.renderers.every(item=>item.disposed)&&value.models.every(item=>item.disposed)}).toBe(true);
    const retired=await owners(page);await twoFrames(page);expect(await owners(page)).toEqual(retired);
    await page.evaluate(()=>window.__bookyLiveFixture.stopObservingWalk());expect(mutations(fixture)).toEqual(before);
    await page.evaluate(()=>window.__bookyLiveFixture.setVisible(true));await ready(page);await live(page);await stopped();
    // Reduced motion prevents a new walk instead of silently starting a sweep.
    await showWalk();await page.emulateMedia({reducedMotion:'reduce'});
    await expect(page.locator('[data-booky-canvas]')).toHaveAttribute('data-booky-reduced-motion','true');
    await expect(walk()).toBeDisabled();await twoFrames(page);const reducedPosition=(await layout(page)).pet;
    await twoFrames(page);expect((await layout(page)).pet).toEqual(reducedPosition);await stopped();
    expect(mutations(fixture)).toEqual(before);expect(fixture.memory.get(BOOKY)).toBe(saved);retained(await actual(page),original);
    result.observations.walk={complete,configuredDurationMs:duration,completedPosition,dragged,manuallyStopped,motionStoppedPosition,retired,reducedPosition};
    Object.assign(result,{scenario:'explicit-margin-walk',explicitFiniteWalk:true,tipsRequireExplicitCollapse:true,walkFitsViewport:true,walkStaysNearViewportEdge:true,actualLegsStep:true,
      dragStopsWalk:true,manualStopWorks:true,backgroundStopsWalk:true,noAutomaticWalkResume:true,
      reducedMotionStopsCurrentWalk:true,reducedMotionPreventsWalk:true,walkDoesNotWritePreferencesOrProgress:true,sameCanonicalGlobe:true});await fixture.verify();
  }finally{
    await page.evaluate(()=>window.__bookyLiveFixture.stopObservingWalk()).catch(()=>undefined);
    await fixture.close();
  }
});


test('Mr. Booky approaches the selected section once, points, and respects cancellation and reduced motion',async({},testInfo)=>{
  test.setTimeout(150_000);const fixture=await open(testInfo),{page,result}=fixture;
  const target=()=>page.locator('[data-booky-target]');
  const graphics=()=>page.locator('[data-planet-graphics-settings]');
  async function observe(){
    await page.evaluate(()=>{
      window.__bookyApproachObservation?.stop();
      const result={samples:[],clicks:0,frame:0,stopped:false,startedAt:performance.now()};
      const click=event=>{if(event.target instanceof Element&&event.target.closest('[data-planet-graphics-settings]'))result.clicks++;};
      const sample=()=>{
        if(result.stopped)return;const pet=document.querySelector('[data-planet-mascot-pet]'),target=document.querySelector('[data-booky-target]');
        if(pet){const r=pet.getBoundingClientRect();result.samples.push({at:performance.now(),phase:target?.getAttribute('data-booky-target')??null,
          gesture:pet.getAttribute('data-planet-mascot-gesture'),left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height,
          viewport:{width:innerWidth,height:innerHeight},sectionOpen:document.querySelector('[data-planet-graphics-settings]')?.open??null});}
        if(performance.now()-result.startedAt<6500)result.frame=requestAnimationFrame(sample);
      };
      result.stop=()=>{result.stopped=true;cancelAnimationFrame(result.frame);document.removeEventListener('click',click,true);
        const {samples,clicks,startedAt}=result;return{samples,clicks,startedAt};};
      document.addEventListener('click',click,true);window.__bookyApproachObservation=result;result.frame=requestAnimationFrame(sample);
      window.__bookyLiveFixture.markGesture();
    });
  }
  async function observation(){return page.evaluate(()=>window.__bookyApproachObservation.stop());}
  async function parkAway(){
    const handle=page.locator('[data-planet-mascot-move]'),box=await handle.boundingBox();
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
    await page.mouse.move(1270,800,{steps:5});await page.mouse.up();await twoFrames(page);
    await expect(pet(page)).not.toHaveAttribute('data-planet-mascot-gesture','walking');
  }
  try{
    await page.setViewportSize({width:1440,height:900});await actual(page);await page.evaluate(()=>window.__bookyLiveFixture.remember());await stablePose(page);
    await page.locator('[data-planet-mascot-toggle]').click();await expect(panel(page)).toBeVisible();await companionSaved(fixture);await live(page);
    const original=await actual(page),before=mutations(fixture),saved=fixture.memory.get(BOOKY);
    await observe();await openUtility(page,'Настройки графики','Полезные действия');
    await expect(graphics()).toHaveAttribute('open','');await expect(graphics().locator(':scope > summary')).toBeFocused();
    result.observations.approachPlanning={layout:await layout(page),graphics:await graphics().boundingBox(),
      summary:await graphics().locator(':scope > summary').boundingBox(),fieldset:await graphics().locator('fieldset').boundingBox(),
      header:await page.locator('.native-planet-panel__header').boundingBox()};
    await expect(target()).toHaveAttribute('data-booky-target','approaching',{timeout:2000});
    await expect(target()).toHaveAttribute('data-booky-target-action','graphics');
    await expect(pet(page)).toHaveAttribute('data-planet-mascot-gesture','walking');
    await expect.poll(()=>page.evaluate(()=>{const values=window.__bookyApproachObservation.samples.filter(value=>value.phase==='approaching');
      if(values.length<2)return 0;const first=values[0],last=values[values.length-1];return Math.hypot(last.left-first.left,last.top-first.top);})).toBeGreaterThan(8);
    await capture(page,result,testInfo,'booky-target-approach-ru-1440.png');
    await expect(target()).toHaveAttribute('data-booky-target','tapping',{timeout:3000});
    await expect(pet(page)).toHaveAttribute('data-planet-mascot-gesture','pointing');
    const selectedGraphicsArea=await graphics().locator('fieldset').boundingBox(),tapCue=await target().boundingBox();
    expect(selectedGraphicsArea).not.toBeNull();expect(tapCue).not.toBeNull();
    const contact={left:tapCue.x+tapCue.width/2,top:tapCue.y+tapCue.height/2};
    expect(contact.left).toBeGreaterThanOrEqual(selectedGraphicsArea.x);expect(contact.left).toBeLessThanOrEqual(selectedGraphicsArea.x+selectedGraphicsArea.width);
    expect(contact.top).toBeGreaterThanOrEqual(selectedGraphicsArea.y);expect(contact.top).toBeLessThanOrEqual(selectedGraphicsArea.y+selectedGraphicsArea.height);
    const trace=await page.evaluate(()=>window.__bookyLiveFixture.gestureTrace());
    for(const key of ['leftLeg','rightLeg']){
      expect(trace.timeline.every(value=>Array.isArray(value.pose?.[key])&&value.pose[key].length===10)).toBe(true);
      expect(new Set(trace.timeline.map(value=>JSON.stringify(value.pose[key]))).size).toBeGreaterThan(1);
    }
    await expect(target()).toHaveCount(0,{timeout:2000});await expect(pet(page)).not.toHaveAttribute('data-planet-mascot-gesture','walking');
    const complete=await observation();expect(complete.clicks).toBe(0);
    const moving=complete.samples.filter(value=>value.phase==='approaching'),tapping=complete.samples.filter(value=>value.phase==='tapping');
    expect(moving.length).toBeGreaterThan(2);expect(tapping.length).toBeGreaterThan(0);expect(tapping[0].at).toBeGreaterThan(moving[moving.length-1].at);
    expect(complete.samples.filter(value=>value.phase).every(value=>value.sectionOpen&&fits({left:value.left,top:value.top,right:value.right,bottom:value.bottom,width:value.width,height:value.height},value.viewport))).toBe(true);
    expect(complete.samples[complete.samples.length-1].at-complete.startedAt).toBeLessThan(6000);
    await expect(graphics()).toHaveAttribute('open','');await expect(page.locator('[data-planet-quality-option="high"]')).toBeChecked();
    expect(mutations(fixture)).toEqual(before);expect(fixture.memory.get(BOOKY)).toBe(saved);retained(await actual(page),original,false);

    await parkAway();await observe();await openUtility(page,'Настройки графики','Полезные действия');
    await expect(target()).toHaveAttribute('data-booky-target','approaching',{timeout:2000});
    await page.keyboard.press('Tab');await expect(target()).toHaveCount(0);await expect(pet(page)).not.toHaveAttribute('data-planet-mascot-gesture','walking');
    const cancelledPosition=(await layout(page)).pet;await twoFrames(page);expect((await layout(page)).pet).toEqual(cancelledPosition);
    const cancelled=await observation();expect(cancelled.samples.some(value=>value.phase==='tapping')).toBe(false);expect(cancelled.clicks).toBe(0);
    await expect(graphics()).toHaveAttribute('open','');expect(mutations(fixture)).toEqual(before);

    await parkAway();await page.emulateMedia({reducedMotion:'reduce'});await twoFrames(page);
    const reducedOrigin=(await layout(page)).pet;await observe();await openUtility(page,'Настройки графики','Полезные действия');
    await expect(target()).toHaveAttribute('data-booky-target','tapping',{timeout:2000});
    await expect(pet(page)).toHaveAttribute('data-planet-mascot-gesture','pointing');
    await expect(page.locator('[data-booky-canvas]')).toHaveAttribute('data-booky-animating','false');
    expect((await layout(page)).pet).toEqual(reducedOrigin);
    await expect(target()).toHaveCount(0,{timeout:2000});const reduced=await observation();expect(reduced.clicks).toBe(0);
    expect(reduced.samples.some(value=>value.phase==='tapping')).toBe(true);expect(reduced.samples.some(value=>value.phase==='approaching'||value.gesture==='walking')).toBe(false);
    expect(reduced.samples.every(value=>Math.hypot(value.left-reducedOrigin.left,value.top-reducedOrigin.top)<.5)).toBe(true);
    expect(mutations(fixture)).toEqual(before);expect(fixture.memory.get(BOOKY)).toBe(saved);expect(await downloadActions(page)).toEqual([]);
    await expect(graphics()).toHaveAttribute('open','');retained(await actual(page),original,false);
    result.observations.targetApproach={complete,cancelled,reduced,cancelledPosition,reducedOrigin,selectedGraphicsArea,tapCue,contact,trace,
      savedCompanionSha256:digest(Buffer.from(saved)),globe:await actual(page)};
    Object.assign(result,{scenario:'explicit-target-approach',canonicalSectionOpensBeforeWalk:true,approachMovesActualPet:true,actualLegsStep:true,
      tapFollowsWalk:true,tapInsideSelectedGraphicsArea:true,targetSectionStaysOpen:true,noSyntheticTargetClick:true,approachFitsViewport:true,newKeyboardInputCancelsApproach:true,
      cancelledApproachDoesNotTapOrResume:true,reducedMotionPointsWithoutTravel:true,approachDoesNotWritePreferencesOrProgress:true,sameCanonicalGlobe:true});await fixture.verify();
  }finally{
    await page.evaluate(()=>window.__bookyApproachObservation?.stop()).catch(()=>undefined);await fixture.close();
  }
});

test('Mr. Booky mobile placement preserves globe and collection hit targets in both locales',async({},testInfo)=>{
  test.setTimeout(150_000);const fixture=await open(testInfo),{page,result}=fixture;
  const globeTargets=['[data-globe-control="zoom-in"]','[data-globe-control="zoom-out"]',
    '[data-globe-control="reset"]','[data-globe-control="edition-info"]','.atlas-country-sheet-toggle'];
  const railTargets=['.globe-edition-scroll-cue.is-previous[data-visible="true"] button',
    '.globe-edition-scroll-cue.is-next[data-visible="true"] button','[data-globe-control="edition-rail-toggle"]'];
  const overlap=(a,b)=>Boolean(a&&b&&Math.min(a.right,b.right)-Math.max(a.left,b.left)>.5
    &&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>.5);
  async function reachable(selectors,{tips=false,requireAll=true,baseline=null,observeOnly=false}={}){
    const observed=await page.evaluate(selectors=>selectors.map(selector=>{
      const element=document.querySelector(selector),r=element?.getBoundingClientRect();
      if(!element||!r||r.width<2||r.height<2||element.closest('[hidden],[inert]')
        ||getComputedStyle(element).visibility==='hidden')return{selector,visible:false};
      const rect={left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};
      const points=[[.5,.5],[.15,.5],[.85,.5]].map(([x,y])=>{
        const hit=document.elementFromPoint(r.left+r.width*x,r.top+r.height*y);
        return{target:hit?.tagName??null,className:typeof hit?.className==='string'?hit.className:null,reachable:!!hit&&element.contains(hit),
          companionBlocked:!!hit?.closest('[data-planet-mascot-pet]')};
      });
      return{selector,visible:r.left>=0&&r.top>=0&&r.right<=innerWidth+.5&&r.bottom<=innerHeight+.5,rect,points};
    }),selectors);
    const positions=await layout(page);
    (result.observations.hitTests??=[]).push({tips,observeOnly,positions,controls:observed});
    if(observeOnly)return{positions,controls:observed};
    for(const item of observed){
      if(requireAll)expect(item.visible,item.selector+' is fully visible').toBe(true);
      if(!item.visible)continue;
      // Open tips are a deliberate sheet. Their covered page controls are
      // checked after collapse; the separate character cannot cover controls
      // outside that sheet, including the persistent globe toolbar.
      if(tips&&overlap(item.rect,positions.card))continue;
      expect(overlap(item.rect,positions.pet),item.selector+' does not overlap the companion').toBe(false);
      const prior=baseline?.controls.find(control=>control.selector===item.selector&&control.visible);
      expect(item.points.every((point,index)=>!point.companionBlocked&&(!prior||prior.points[index].reachable?point.reachable:true)),
        item.selector+' retains its baseline pointer hits').toBe(true);
    }
    return{positions,controls:observed};
  }
  async function settle(){await companionSaved(fixture);await twoFrames(page);await live(page);}
  async function collapse(){if(await panel(page).isVisible())await page.locator('[data-planet-mascot-collapse]').click();await settle();}
  try{
    await actual(page);await page.evaluate(()=>window.__bookyLiveFixture.remember());await stablePose(page);
    const baseline=await actual(page);result.observations.mobilePlacement=[];result.observations.hostBaselineObstructions=[];
    await page.setViewportSize({width:320,height:844});
    const country=page.locator('.atlas-country-sheet-toggle');
    // Establish the actual compact country bar with product keyboard actions.
    for(let i=0;i<3&&await country.getAttribute('aria-expanded')==='true';i++){
      await country.focus();await page.keyboard.press('Enter');
    }
    await expect(country).toHaveAttribute('aria-expanded','false');
    const hostBaselines=new Map();
    for(const[language,size]of [['ru',{width:320,height:844}],['en',{width:320,height:844}],['en',{width:800,height:400}]]){
      const languageButton=page.locator('.atlas-immersive-chrome .interface-language-control button').filter({hasText:new RegExp('^'+language.toUpperCase()+'$','u')});
      if(await page.locator('html').getAttribute('lang')!==language){await languageButton.click();await expect(page.locator('html')).toHaveAttribute('lang',language);
        await expect.poll(()=>fixture.memory.get('probpera-interface-language')).toBe(language);}
      await page.setViewportSize(size);
      if(await avatar(page).count()){
        await page.locator('[data-planet-mascot-hide]').click();await expect(avatar(page)).toHaveCount(0);
        await expect(page.locator('[data-planet-mascot-preference-state]')).toHaveCount(0);
        await expect.poll(()=>JSON.parse(fixture.memory.get(BOOKY)??'null')?.visible).toBe(false);
      }
      await twoFrames(page);const hostBaseline=await reachable([...globeTargets,...railTargets],{observeOnly:true});hostBaselines.set(size.width,hostBaseline);
      result.observations.hostBaselineObstructions.push({language,size,controls:hostBaseline.controls.filter(control=>control.points?.some(point=>!point.reachable))});
      await page.locator('[data-planet-mascot-toggle]').click();await expect(panel(page)).toBeVisible();await settle();
      const before=mutations(fixture),shown=await reachable(globeTargets,{tips:true,baseline:hostBaseline});
      await reachable(railTargets,{tips:true,baseline:hostBaseline,requireAll:false});
      await twoFrames(page);expect(mutations(fixture)).toEqual(before);
      await collapse();const closedBefore=mutations(fixture),collapsed=await reachable(globeTargets,{baseline:hostBaseline});
      await reachable(railTargets,{baseline:hostBaseline,requireAll:false});
      for(const control of hostBaseline.controls.filter(control=>control.visible&&control.points.every(point=>point.reachable)))await page.locator(control.selector).click({trial:true});
      await twoFrames(page);expect(mutations(fixture)).toEqual(closedBefore);retained(await actual(page),baseline,false);
      result.observations.mobilePlacement.push({language,size,hostBaseline,shown,collapsed});
      if(size.width===320)await capture(page,result,testInfo,`booky-mobile-controls-${language}-320.png`);
      else await capture(page,result,testInfo,'booky-mobile-controls-en-landscape.png');
    }

    // Deliberate placement remains available and Home restores the automatic
    // safe location. Resizing only clamps local position, never preferences.
    const handle=page.locator('[data-planet-mascot-move]'),origin=(await layout(page)).pet,box=await handle.boundingBox();
    const beforeDrag=mutations(fixture);await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
    await page.mouse.move(box.x+box.width/2+(origin.left>80?-60:60),box.y+box.height/2+(origin.top>60?-25:25),{steps:5});await page.mouse.up();
    const dragged=(await layout(page)).pet;expect(Math.hypot(dragged.left-origin.left,dragged.top-origin.top)).toBeGreaterThan(10);
    await handle.focus();await page.keyboard.press('Home');await settle();await reachable(globeTargets,{baseline:hostBaselines.get(800)});
    await page.setViewportSize({width:320,height:844});await settle();await reachable(globeTargets,{baseline:hostBaselines.get(320)});
    expect(mutations(fixture)).toEqual(beforeDrag);

    // The first walking position can be below the safe resting position.
    // An immediate genuine stop must release its transient position even
    // when the parent's corrected resting coordinates did not change.
    await page.locator('[data-booky-walk]').focus();await page.keyboard.press('Enter');
    await expect(pet(page)).toHaveAttribute('data-planet-mascot-gesture','walking');
    await page.locator('[data-booky-walk-stop]').focus();await page.keyboard.press('Enter');
    await expect(pet(page)).not.toHaveAttribute('data-planet-mascot-gesture','walking');await twoFrames(page);
    result.observations.immediateWalkStop=await reachable(globeTargets,{baseline:hostBaselines.get(320)});
    await twoFrames(page);expect((await layout(page)).pet).toEqual(result.observations.immediateWalkStop.positions.pet);
    expect(mutations(fixture)).toEqual(beforeDrag);

    // Open the real collection, cancel its optional visual approach with a
    // genuine key, and inspect the lower scroll surface after tips collapse.
    await openUtility(page,'Graphics settings','Useful actions');await page.keyboard.press('Tab');
    await page.locator('[data-planet-mascot-move]').focus();await page.keyboard.press('Home');await settle();
    const collection=page.locator('.native-planet-panel');await expect(collection).toBeVisible();
    const headerTargets=['.native-planet-panel__header .interface-language-control button:first-child',
      '.native-planet-panel__header .interface-language-control button:last-child','.native-planet-panel__header > button'];
    await reachable(headerTargets);
    await page.setViewportSize({width:800,height:400});await settle();
    await page.locator('.native-planet-panel__content').evaluate(element=>{element.scrollTop=element.scrollHeight});await twoFrames(page);await settle();
    const collectionTargets=await collection.locator('.native-planet-panel__content button,.native-planet-panel__content summary').evaluateAll(elements=>elements
      .filter(element=>{const r=element.getBoundingClientRect();return !element.closest('[data-planet-mascot-pet]')&&!element.disabled
        &&element.getAttribute('aria-disabled')!=='true'&&r.width>2&&r.height>2&&r.top>=0&&r.bottom<=innerHeight})
      .map(element=>{const path=[];let node=element;while(node&&!node.classList.contains('native-planet-panel__content')){
        path.unshift(node.tagName.toLowerCase()+':nth-child('+([...node.parentElement.children].indexOf(node)+1)+')');node=node.parentElement;}
        return'.native-planet-panel__content > '+path.join(' > ');}));
    expect(collectionTargets.length).toBeGreaterThan(0);
    const collectionBefore=mutations(fixture);result.observations.collection=await reachable([...headerTargets,...collectionTargets]);
    await twoFrames(page);expect(mutations(fixture)).toEqual(collectionBefore);
    await capture(page,result,testInfo,'booky-mobile-collection-en-landscape.png');

    await page.locator('[data-planet-mascot-hide]').click();await expect(avatar(page)).toHaveCount(0);
    await expect(page.locator('[data-planet-mascot-preference-state]')).toHaveCount(0);
    await expect.poll(()=>JSON.parse(fixture.memory.get(BOOKY)??'null')?.visible).toBe(false);
    const hiddenBefore=mutations(fixture);await page.setViewportSize({width:320,height:844});await twoFrames(page);
    await reachable(headerTargets);expect(mutations(fixture)).toEqual(hiddenBefore);
    await page.locator('[data-planet-mascot-toggle]').click();await expect(panel(page)).toBeVisible();await settle();
    await capture(page,result,testInfo,'booky-mobile-collection-tips-en-320.png');
    await reachable(headerTargets,{tips:true});await collapse();retained(await actual(page),baseline,false);
    expect(fixture.writes()).toEqual([]);expect(fixture.memory.get(KEY)).toBe(fixture.initialRecord);
    Object.assign(result,{scenario:'mobile-companion-placement',mobileLocales:['ru','en'],portraitWidth:320,landscapeViewport:{width:800,height:400},
      companionAddsNoGlobeObstruction:true,openTipsDoNotBlockOutsideControls:true,collectionVisibleControlsReachable:true,
      manualDragAndHomeRetained:true,immediateWalkStopSettlesClear:true,resizeClampsWithoutPreferenceWrites:true,hideAndShowRetained:true,sameCanonicalGlobe:true});
    await fixture.verify();
  }catch(error){
    await capture(page,result,testInfo,'booky-mobile-placement-failure.png').catch(()=>undefined);throw error;
  }finally{await fixture.close();}
});

test('short landscape globe controls stay reachable beside the collapsed country archive in both locales',async({},testInfo)=>{
  test.setTimeout(150_000);const fixture=await open(testInfo),{page,result}=fixture;
  const controls=['zoom-in','zoom-out','reset','edition-info'];
  const country=page.locator('.atlas-country-sheet-toggle');
  async function hostLayout(label){
    const state=await page.evaluate(()=>{
      const describe=element=>{
        if(!element)return null;const r=element.getBoundingClientRect(),s=getComputedStyle(element);
        return{tag:element.tagName,className:typeof element.className==='string'?element.className:null,
          rect:{left:r.left,top:r.top,width:r.width,height:r.height},scrollLeft:element.scrollLeft,scrollTop:element.scrollTop,
          scrollWidth:element.scrollWidth,clientWidth:element.clientWidth,overflowX:s.overflowX,overflowY:s.overflowY,
          transform:s.transform,position:s.position,attributes:Object.fromEntries([...element.attributes].filter(a=>a.name.startsWith('data-atlas-')).map(a=>[a.name,a.value]))};
      };
      const selectors=['html','body','.native-planet-app','.atlas-experience-surface','.atlas-layout','.globe-column','.literary-globe','.globe-controls'];
      const ancestors=[];for(let node=document.querySelector('.literary-globe');node;node=node.parentElement)ancestors.push(describe(node));
      return{scrollX,scrollY,scrollingElement:describe(document.scrollingElement),elements:selectors.map(selector=>({selector,...describe(document.querySelector(selector))})),ancestors};
    });
    (result.observations.hostLayoutSnapshots??=[]).push({label,...state});return state;
  }
  async function settleLayout(){
    let previous=null,matches=0;
    await expect.poll(async()=>{
      const key=await page.evaluate(()=>JSON.stringify(['.atlas-country-sheet-toggle','.globe-controls'].map(selector=>{
        const r=document.querySelector(selector)?.getBoundingClientRect();return r?[r.left,r.top,r.width,r.height]:null;
      })));
      matches=key===previous?matches+1:0;previous=key;return matches;
    },{intervals:[50,100],message:'Country sheet and globe toolbar finish their finite layout transition'}).toBeGreaterThanOrEqual(3);
  }
  async function collapseCountry(){
    for(let i=0;i<3&&await country.getAttribute('aria-expanded')==='true';i++){
      await country.focus();await page.keyboard.press('Enter');
    }
    await expect(country).toHaveAttribute('aria-expanded','false');await settleLayout();
  }
  async function hitTargets(label,{withCountry=true,onlyCountry=false,withPanelClose=false}={}){
    const selectors=onlyCountry?[]:controls.map(name=>'[data-globe-control="'+name+'"]');
    if(withCountry)selectors.push('.atlas-country-sheet-toggle');
    if(withPanelClose)selectors.push('.country-panel .panel-topline .panel-close');
    const targets=await page.evaluate(selectors=>selectors.map(selector=>{
      const element=document.querySelector(selector);if(!element)return{selector,visible:false};
      const r=element.getBoundingClientRect(),style=getComputedStyle(element);
      const points=[[.15,.5],[.5,.5],[.85,.5]].map(([x,y])=>{
        const hit=document.elementFromPoint(r.left+r.width*x,r.top+r.height*y);
        return{reachable:!!hit&&element.contains(hit),tag:hit?.tagName??null,className:typeof hit?.className==='string'?hit.className:null};
      });
      return{selector,rect:{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height},points,
        visible:r.width>=44&&r.height>=44&&r.left>=0&&r.top>=0&&r.right<=innerWidth+.5&&r.bottom<=innerHeight+.5
          &&style.display!=='none'&&style.visibility!=='hidden'&&!element.closest('[hidden],[inert]')};
    }),selectors);
    const observation={label,viewport:page.viewportSize(),layout:await layout(page),targets,hostLayout:await hostLayout(label)};
    result.observations.landscapeControlChecks.push(observation);
    for(const target of targets){
      expect(target.visible,label+': '+target.selector+' stays visible with a 44px target').toBe(true);
      // This regression has no host-baseline exemption: every sampled point
      // must reach the actual requested control, even while Booky is hidden.
      expect(target.points.every(point=>point.reachable),label+': '+target.selector+' receives pointer hits').toBe(true);
      await page.locator(target.selector).click({trial:true});
    }
    return observation;
  }
  async function hideCompanion(){
    if(await avatar(page).count()){
      await page.locator('[data-planet-mascot-hide]').click();await expect(avatar(page)).toHaveCount(0);
      await expect(page.locator('[data-planet-mascot-preference-state]')).toHaveCount(0);
      await expect.poll(()=>JSON.parse(fixture.memory.get(BOOKY)??'null')?.visible).toBe(false);
    }
  }
  try{
    await actual(page);await page.evaluate(()=>window.__bookyLiveFixture.remember());await stablePose(page);
    const baseline=await actual(page);result.observations.landscapeControlChecks=[];
    for(const[language,size]of [['ru',{width:800,height:400}],['en',{width:800,height:400}],
      ['ru',{width:667,height:375}],['en',{width:667,height:375}]]){
      await hideCompanion();
      if(await page.locator('html').getAttribute('lang')!==language){
        await page.locator('.atlas-immersive-chrome .interface-language-control button').filter({hasText:new RegExp('^'+language.toUpperCase()+'$','u')}).click();
        await expect(page.locator('html')).toHaveAttribute('lang',language);await expect.poll(()=>fixture.memory.get('probpera-interface-language')).toBe(language);
      }
      await page.setViewportSize(size);await collapseCountry();
      const unchanged=mutations(fixture);await hitTargets(language+' '+size.width+' hidden');
      if(language==='en'&&size.width===667){
        // Declared DOM scroll-capability probe: browser focus can scroll a
        // hidden-overflow ancestor. Request that same native scroll directly;
        // no camera assignment, layout override or application event is faked.
        await stablePose(page);const beforeProbe=await actual(page),stage=page.locator('#atlas .world-map-stage');
        const before=await stage.evaluate(element=>{const r=element.getBoundingClientRect();
          return{left:r.left,top:r.top,width:r.width,height:r.height,scrollLeft:element.scrollLeft,scrollTop:element.scrollTop,
            scrollWidth:element.scrollWidth,scrollHeight:element.scrollHeight,clientWidth:element.clientWidth,clientHeight:element.clientHeight};});
        await stage.evaluate(element=>element.scrollTo({left:element.scrollWidth,top:element.scrollHeight,behavior:'instant'}));
        await twoFrames(page);const after=await stage.evaluate(element=>{const r=element.getBoundingClientRect();
          return{left:r.left,top:r.top,width:r.width,height:r.height,scrollLeft:element.scrollLeft,scrollTop:element.scrollTop};});
        expect(after).toEqual({left:before.left,top:before.top,width:before.width,height:before.height,scrollLeft:0,scrollTop:0});
        retained(await actual(page),beforeProbe);await hitTargets('after declared globe frame scroll probe');
        result.observations.globeScrollProbe={kind:'native-globe-stage-DOM-scroll-capability-probe',before,after,noCameraAssignment:true,noLayoutOverride:true};
      }
      await twoFrames(page);expect(mutations(fixture)).toEqual(unchanged);
      await page.locator('[data-planet-mascot-toggle]').click();await expect(panel(page)).toBeVisible();await companionSaved(fixture);
      await page.locator('[data-planet-mascot-collapse]').click();await expect(panel(page)).toHaveCount(0);await live(page);
      const shownBefore=mutations(fixture);await hitTargets(language+' '+size.width+' shown');
      await twoFrames(page);expect(mutations(fixture)).toEqual(shownBefore);retained(await actual(page),baseline,false);
      if(size.width===800)await capture(page,result,testInfo,`globe-landscape-controls-${language}-800.png`);
      else if(language==='en')await capture(page,result,testInfo,'globe-landscape-controls-en-667.png');
    }

    // Exercise the same genuine controls whose hit targets were measured.
    const beforeControls=mutations(fixture);
    const beforeZoom=Number(await globe(page).getAttribute('data-globe-camera-radius'));
    await page.locator('[data-globe-control="zoom-in"]').click();
    await expect.poll(async()=>Number(await globe(page).getAttribute('data-globe-camera-radius'))).toBeLessThan(beforeZoom-.01);
    await expect(globe(page)).toHaveAttribute('data-globe-camera-phase','idle');
    const zoomed=Number(await globe(page).getAttribute('data-globe-camera-radius'));
    await page.locator('[data-globe-control="zoom-out"]').click();
    await expect.poll(async()=>Number(await globe(page).getAttribute('data-globe-camera-radius'))).toBeGreaterThan(zoomed+.01);
    await expect(globe(page)).toHaveAttribute('data-globe-camera-phase','idle');
    const beforeReset=JSON.stringify((await sample(page)).pose);await page.locator('[data-globe-control="reset"]').click();
    await expect.poll(async()=>JSON.stringify((await sample(page)).pose)).not.toBe(beforeReset);
    await expect(globe(page)).toHaveAttribute('data-globe-camera-phase','idle');await stablePose(page);
    await hostLayout('before source open');await page.locator('[data-globe-control="edition-info"]').click();
    const source=page.locator('.globe-edition-info-dialog');await expect(source).toBeVisible();
    await expect(source.locator('#globe-edition-info-title')).toContainText('Rand');
    await source.locator('form button').click();await expect(source).not.toBeVisible();await hitTargets('after source close');
    await hostLayout('before country open');await country.click();await expect(country).toHaveAttribute('aria-expanded','true');
    await expect(page.locator('#atlas-country-sheet-content')).not.toHaveAttribute('inert','');
    await settleLayout();
    await hitTargets('expanded country header and panel close',{onlyCountry:true,withPanelClose:true});
    await hostLayout('after country open');
    await capture(page,result,testInfo,'globe-landscape-archive-open-en-667.png');
    await collapseCountry();await hitTargets('after country collapse');
    expect(mutations(fixture)).toEqual(beforeControls);retained(await actual(page),baseline,false);

    await hideCompanion();const afterExplicitHide=mutations(fixture);
    await page.setViewportSize({width:320,height:844});await collapseCountry();await hitTargets('portrait 320 regression');
    await page.setViewportSize({width:1440,height:850});await ready(page);await hitTargets('desktop regression',{withCountry:false});
    expect(mutations(fixture)).toEqual(afterExplicitHide);expect(fixture.writes()).toEqual([]);expect(fixture.memory.get(KEY)).toBe(fixture.initialRecord);
    retained(await actual(page),baseline,false);
    Object.assign(result,{scenario:'globe-landscape-controls',locales:['ru','en'],landscapeViewports:[{width:800,height:400},{width:667,height:375}],
      hiddenCompanionToolbarReachable:true,shownCompanionToolbarReachable:true,allFourControlsReceiveHits:true,
      genuineZoomAndResetWork:true,sourceDialogCloses:true,countryExpandCollapseRetained:true,expandedCountryHeaderReachable:true,countryPanelCloseReachable:true,portraitAndDesktopRetained:true,
      globeFrameCannotScroll:true,directStageScrollProbe:true,noAutomaticPreferenceWrites:true,sameCanonicalGlobe:true});await fixture.verify();
  }catch(error){
    await capture(page,result,testInfo,'globe-landscape-controls-failure.png').catch(()=>undefined);throw error;
  }finally{await fixture.close();}
});

test('Mr. Booky open help preserves primary navigation and scrolls independently in both locales',async({},testInfo)=>{
  test.setTimeout(150_000);const fixture=await open(testInfo),{page,result}=fixture;
  const globeTargets=['zoom-in','zoom-out','reset','edition-info'].map(name=>'[data-globe-control="'+name+'"]');
  const globeHeader=['.atlas-immersive-chrome .interface-language-control button:first-child',
    '.atlas-immersive-chrome .interface-language-control button:last-child'];
  const optionalGlobeHeader=['toggle-search','toggle-filters','random-journey','open-collection']
    .map(name=>'.atlas-immersive-chrome [data-atlas-action="'+name+'"]');
  const collectionHeader=['.native-planet-panel__header .interface-language-control button:first-child',
    '.native-planet-panel__header .interface-language-control button:last-child','.native-planet-panel__header > button'];
  const optionalRail=['[data-globe-control="edition-rail-toggle"]',
    '.globe-edition-scroll-cue.is-previous[data-visible="true"] button',
    '.globe-edition-scroll-cue.is-next[data-visible="true"] button'];
  async function settleHelp(){
    await live(page);let previous=null,matches=0;
    await expect.poll(async()=>{
      const key=JSON.stringify(await layout(page));matches=key===previous?matches+1:0;previous=key;return matches;
    },{intervals:[50,100],message:'The open help and companion settle in their actual viewport'}).toBeGreaterThanOrEqual(3);
  }
  async function hitTargets(label,selectors,optional=[]){
    const targets=await page.evaluate(({selectors,optional})=>[...selectors,...optional].map(selector=>{
      const element=document.querySelector(selector),r=element?.getBoundingClientRect();
      let shown=!!element&&!!r&&r.width>0&&r.height>0&&!element.closest('[hidden],[inert],[aria-hidden="true"]');
      for(let node=element;node&&shown;node=node.parentElement){const style=getComputedStyle(node);
        if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0)shown=false;}
      if(!shown)return{selector,optional:optional.includes(selector),shown:false};
      const points=[[.15,.5],[.5,.5],[.85,.5]].map(([x,y])=>{
        const hit=document.elementFromPoint(r.left+r.width*x,r.top+r.height*y);
        return{reachable:!!hit&&element.contains(hit),tag:hit?.tagName??null,className:typeof hit?.className==='string'?hit.className:null};
      });
      return{selector,optional:optional.includes(selector),shown:true,
        rect:{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height},points,
        fits:r.width>=44-.001&&r.height>=44-.001&&r.left>=0&&r.top>=0&&r.right<=innerWidth+.5&&r.bottom<=innerHeight+.5};
    }),{selectors,optional});
    const observation={label,viewport:page.viewportSize(),layout:await layout(page),targets};result.observations.openHelpChecks.push(observation);
    for(const target of targets){
      if(target.optional&&!target.shown)continue;
      expect(target.shown,label+': '+target.selector+' exists visibly').toBe(true);
      expect(target.fits,label+': '+target.selector+' fits with a 44px target').toBe(true);
      // Every specified outside control is strict while tips are open: the
      // card never supplies an overlap exemption or a hidden-host baseline.
      expect(target.points.every(point=>point.reachable),label+': '+target.selector+' receives all pointer hits').toBe(true);
      await page.locator(target.selector).click({trial:true});
    }
    return observation;
  }
  async function scrollAndClose(label,selectors,closedSelectors=selectors,optional=[],closedOptional=optional){
    const before=mutations(fixture),canonical=await actual(page);
    await hitTargets(label+' top',[...selectors,'[data-planet-mascot-collapse]'],optional);
    const metrics=()=>panel(page).evaluate(element=>({scrollTop:element.scrollTop,scrollHeight:element.scrollHeight,clientHeight:element.clientHeight}));
    const top=await metrics();expect(top.scrollTop).toBe(0);expect(top.scrollHeight).toBeGreaterThan(top.clientHeight+40);
    const box=await panel(page).boundingBox();await page.mouse.move(box.x+box.width*.65,box.y+box.height*.65);await page.mouse.wheel(0,600);
    await expect.poll(async()=>(await metrics()).scrollTop).toBeGreaterThan(40);const scrolled=await metrics();
    await hitTargets(label+' scrolled',[...selectors,'[data-planet-mascot-collapse]'],optional);retained(await actual(page),canonical);
    expect((await metrics()).scrollTop).toBeGreaterThan(40);
    if(page.viewportSize().width<=640&&page.viewportSize().width>page.viewportSize().height){
      await capture(page,result,testInfo,`booky-help-globe-${label.replaceAll(' ','-')}-scrolled.png`);
    }
    await page.locator('[data-planet-mascot-collapse]').click();await expect(panel(page)).toHaveCount(0);await live(page);
    await hitTargets(label+' closed',closedSelectors,closedOptional);retained(await actual(page),canonical);expect(mutations(fixture)).toEqual(before);
    result.observations.helpScrolls.push({label,top,scrolled,closedWhileScrolled:true,closedByActualButton:true});
  }
  async function setLanguage(language,header){
    if(await page.locator('html').getAttribute('lang')===language)return;
    await page.locator(header+' .interface-language-control button').filter({hasText:new RegExp('^'+language.toUpperCase()+'$','u')}).click();
    await expect(page.locator('html')).toHaveAttribute('lang',language);await expect.poll(()=>fixture.memory.get('probpera-interface-language')).toBe(language);
  }
  try{
    await actual(page);await page.evaluate(()=>window.__bookyLiveFixture.remember());await stablePose(page);
    const original=await actual(page);result.observations.openHelpChecks=[];result.observations.helpScrolls=[];const landscapeHeights=[];
    for(const[language,size]of [['ru',{width:568,height:320}],['en',{width:568,height:320}],
      ['ru',{width:640,height:360}],['en',{width:640,height:360}],
      ['ru',{width:800,height:400}],['en',{width:800,height:400}],
      ['ru',{width:667,height:375}],['en',{width:667,height:375}]]){
      await setLanguage(language,'.atlas-immersive-chrome');await page.setViewportSize(size);
      const country=page.locator('.atlas-country-sheet-toggle');
      for(let i=0;i<3&&await country.getAttribute('aria-expanded')==='true';i++){await country.focus();await page.keyboard.press('Enter');}
      await expect(country).toHaveAttribute('aria-expanded','false');await stablePose(page);const beforeOpen=await actual(page);
      await page.locator('[data-planet-mascot-toggle]').click();await expect(panel(page)).toBeVisible();await companionSaved(fixture);await settleHelp();
      const helpHeight=(await panel(page).boundingBox()).height;landscapeHeights.push(helpHeight);
      retained(await actual(page),beforeOpen);
      // A readable help card cannot avoid every strip on a 375px-high screen.
      // Persistent host controls stay strict while open; every dock, country
      // and visible rail control is strict after the real close action.
      await hitTargets(language+' '+size.width+' open',globeHeader);
      if(size.width<=640){
        await capture(page,result,testInfo,`booky-help-globe-${language}-${size.width}.png`);
        expect(helpHeight,'Compact landscape help retains a readable scrolling area').toBeGreaterThanOrEqual(180);
      }
      if(language==='ru'&&size.width===800)await capture(page,result,testInfo,'booky-help-globe-ru-800.png');
      if(language==='en'&&size.width===667)await capture(page,result,testInfo,'booky-help-globe-en-667.png');
      await scrollAndClose(language+' '+size.width,globeHeader,[...globeTargets,...globeHeader,'.atlas-country-sheet-toggle'],[],[...optionalRail,...optionalGlobeHeader]);
      retained(await actual(page),original,false);
    }

    await page.setViewportSize({width:1440,height:850});await ready(page);await stablePose(page);
    const beforeDesktop=await actual(page);await page.locator('[data-planet-mascot-toggle]').click();
    await expect(panel(page)).toBeVisible();await settleHelp();retained(await actual(page),beforeDesktop);
    const desktopHeight=(await panel(page).boundingBox()).height;expect(desktopHeight).toBeGreaterThan(Math.max(...landscapeHeights)+40);
    result.observations.helpHeightRegrowth={landscapeHeights,desktopHeight};
    await scrollAndClose('desktop feasible clear placement',[...globeTargets,...globeHeader],undefined,optionalRail);

    // Enter the actual collection through Booky's existing utility. Its
    // ordinary content remains a deliberate overlay; the persistent header
    // must remain usable throughout help scrolling and after collapse.
    await openUtility(page,'Graphics settings','Useful actions');await page.keyboard.press('Tab');
    await expect(page.locator('.native-planet-panel')).toBeVisible();await page.setViewportSize({width:320,height:844});
    await page.locator('[data-planet-mascot-move]').focus();await page.keyboard.press('Home');await live(page);
    for(const language of ['ru','en']){
      await setLanguage(language,'.native-planet-panel__header');await stablePose(page);const beforeOpen=await actual(page);
      await page.locator('[data-planet-mascot-toggle]').click();await expect(panel(page)).toBeVisible();await settleHelp();
      retained(await actual(page),beforeOpen);await hitTargets(language+' collection open',collectionHeader);
      await capture(page,result,testInfo,`booky-help-collection-${language}-320.png`);
      await scrollAndClose(language+' collection',collectionHeader);retained(await actual(page),original,false);
    }
    expect(fixture.writes()).toEqual([]);expect(fixture.memory.get(KEY)).toBe(fixture.initialRecord);expect(await downloadActions(page)).toEqual([]);
    Object.assign(result,{scenario:'booky-open-help-placement',locales:['ru','en'],landscapeViewports:[{width:568,height:320},{width:640,height:360},{width:800,height:400},{width:667,height:375}],collectionPortraitWidth:320,
      openHelpLocaleControlsReachable:true,desktopOpenHelpNavigationReachable:true,closedHelpNavigationReachable:true,closedHelpGlobalHeaderReachable:true,
      collectionHeaderReachable:true,helpScrollsByPointerWheel:true,helpClosesWhileScrolled:true,helpRegrowsOnLargerViewport:true,compactLandscapeHelpReadable:true,compactLandscapeHelpMinimumHeight:180,petAndHelpFitWithoutOverlap:true,
      noAutomaticPreferenceWrites:true,noHelpCameraChanges:true,sameCanonicalGlobe:true});await fixture.verify();
  }catch(error){
    result.observations.failureLayout=await layout(page).catch(()=>null);
    result.observations.failureCharacter=await character(page).catch(()=>null);
    await capture(page,result,testInfo,'booky-help-placement-failure.png').catch(()=>undefined);throw error;
  }finally{await fixture.close();}
});
